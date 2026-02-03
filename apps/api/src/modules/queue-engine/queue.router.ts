import { Router } from 'express';
import { QueueAlertSeverity } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware as requireAuth, requireRole } from '../../middleware/auth.middleware';
import { eventProcessor } from './events/event.processor';
import { decisionEngine } from './decision/decision.engine';
import { metricsCalculator } from './metrics/metrics.calculator';
import { stateManager } from './state/state.manager';
import { prisma } from '../../common/database';
import { QueueEvent } from './queue.types';
import {
  queueEventSchema,
  batchEventsSchema,
  nextTaskRequestSchema,
  acceptTaskRequestSchema,
  stockTargetsRequestSchema,
  metricsSnapshotRequestSchema,
  engineConfigUpdateSchema,
  featureToggleSchema,
} from './queue.schema';

const router: Router = Router();

// ============================================
// EVENTS - Ingesta
// ============================================

/**
 * POST /events
 * Ingest single event
 */
router.post('/events', requireAuth, async (req, res): Promise<void> => {
  try {
    const event = queueEventSchema.parse(req.body) as QueueEvent;
    const result = await eventProcessor.processEvent(event);

    res.status(202).json({
      event_id: event.event_id || crypto.randomUUID(),
      processed: result.processed,
      warnings: result.warnings,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    console.error('Event processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /events/batch
 * Ingest batch of events
 */
router.post('/events/batch', requireAuth, async (req, res): Promise<void> => {
  try {
    const { events } = batchEventsSchema.parse(req.body);
    const result = await eventProcessor.processBatch(events as QueueEvent[]);

    res.status(202).json({
      accepted: result.accepted,
      rejected: result.rejected,
      errors: result.errors,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }
    console.error('Batch processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// DECISIONS - Tiempo real
// ============================================

/**
 * POST /decision/next-task
 * Get next recommended task
 */
router.post('/decision/next-task', requireAuth, async (req, res): Promise<void> => {
  try {
    const params = nextTaskRequestSchema.parse(req.body);

    // Check if we have enough data
    const arrivals = stateManager.getArrivals(params.venue_id, params.bar_id);
    if (arrivals.length < 5) {
      res.status(503).json({
        status: 'warming_up',
        ready_in_sec: 60,
        min_events_needed: 10,
        message: 'Insufficient data for recommendations. Need more order_paid events.',
      });
      return;
    }

    const result = await decisionEngine.getNextTask(
      params.venue_id,
      params.bar_id,
      params.bartender_id,
      params.station_id,
      params.exclude_families
    );

    if (!result.task) {
      res.status(204).send();
      return;
    }

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Decision error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /decision/next-task/accept
 * Accept or reject a task recommendation
 */
router.post('/decision/next-task/accept', requireAuth, async (req, res): Promise<void> => {
  try {
    const params = acceptTaskRequestSchema.parse(req.body);

    // Store acceptance for analytics
    // TODO: Implement acceptance tracking

    res.json({
      task_id: params.task_id,
      accepted: params.accepted,
      recorded_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /decision/stock-targets
 * Get stock targets for stockable SKUs
 */
router.get('/decision/stock-targets', requireAuth, async (req, res): Promise<void> => {
  try {
    const params = stockTargetsRequestSchema.parse(req.query);

    // Get stockable SKUs and their targets
    const venue = await prisma.venue.findUnique({
      where: { id: params.venue_id },
      select: { tenantId: true },
    });

    if (!venue) {
      res.status(404).json({ error: 'Venue not found' });
      return;
    }

    const stockableMappings = await prisma.queueSkuMapping.findMany({
      where: {
        tenantId: venue.tenantId,
        classification: 'STOCKABLE',
        isActive: true,
      },
      include: { family: true },
    });

    const lambda = metricsCalculator.calculateLambda(params.venue_id, params.bar_id);
    const config = stateManager.getConfig(params.venue_id, params.bar_id);

    type StockMapping = typeof stockableMappings[number];
    const targets = stockableMappings.map((m: StockMapping) => {
      const currentStock = stateManager.getPreStock(params.venue_id, params.bar_id, m.productId);

      // Estimate demand based on lambda and historical mix
      // Simplified: assume uniform distribution across stockables
      const ratePerMin = lambda.rate_per_min / stockableMappings.length;
      const targetStock = Math.ceil(
        ratePerMin * params.horizon_minutes * config.stocking.safety_factor
      );
      const deficit = Math.max(0, targetStock - currentStock);

      return {
        sku_id: m.productId,
        family: m.family.name,
        current_stock: currentStock,
        target_stock: Math.min(targetStock, m.maxPreStock),
        deficit,
        forecast: {
          rate_per_min: ratePerMin,
          confidence: lambda.confidence,
          trend: lambda.trend,
        },
        action: deficit > 0 ? 'produce' : currentStock > targetStock * 1.5 ? 'reduce' : 'hold',
        priority: deficit > 0 ? Math.min(80, 50 + deficit * 2) : 20,
      };
    });

    type TargetItem = typeof targets[number];
    res.json({
      request_id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      bar_id: params.bar_id,
      horizon_minutes: params.horizon_minutes,
      targets: targets.sort((a: TargetItem, b: TargetItem) => b.priority - a.priority),
      production_queue: targets
        .filter((t: TargetItem) => t.action === 'produce')
        .map((t: TargetItem) => ({
          sku_id: t.sku_id,
          qty: t.deficit,
          reason: 'forecast_deficit',
        })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Stock targets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /decision/queue-status
 * Get current queue status
 */
router.get('/decision/queue-status', requireAuth, async (req, res): Promise<void> => {
  try {
    const { venue_id, bar_id } = req.query as { venue_id: string; bar_id?: string };

    if (!venue_id) {
      res.status(400).json({ error: 'venue_id is required' });
      return;
    }

    // Get queue stats
    const state = stateManager.getBarState(venue_id, bar_id || 'default');
    const stats = stateManager.getOrderStats(venue_id, bar_id || 'default');

    const byFamily: Record<string, { pending: number; oldest_age_sec: number }> = {};
    for (const [familyId, orderIds] of state.queues) {
      byFamily[familyId] = {
        pending: orderIds.length,
        oldest_age_sec: stateManager.getOldestOrderAge(venue_id, bar_id || 'default', familyId),
      };
    }

    res.json({
      ts: new Date().toISOString(),
      bars: [
        {
          bar_id: bar_id || 'default',
          total_pending: stats.byStage.paid + stats.byStage.queued_prep,
          by_stage: stats.byStage,
          by_family: byFamily,
        },
      ],
    });
  } catch (error) {
    console.error('Queue status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// METRICS - Observabilidad
// ============================================

/**
 * GET /metrics/snapshot
 * Get metrics snapshot
 */
router.get('/metrics/snapshot', requireAuth, async (req, res): Promise<void> => {
  try {
    const params = metricsSnapshotRequestSchema.parse(req.query);

    const snapshot = metricsCalculator.generateSnapshot(
      params.venue_id,
      params.bar_id || 'default',
      params.window_minutes
    );

    res.json(snapshot);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Metrics snapshot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /metrics/alerts
 * Get active alerts
 */
router.get('/metrics/alerts', requireAuth, async (req, res): Promise<void> => {
  try {
    const { venue_id, severity } = req.query as { venue_id: string; severity?: string };

    if (!venue_id) {
      res.status(400).json({ error: 'venue_id is required' });
      return;
    }

    // Get active alerts from database
    const where: { venueId: string; resolvedAt: null; severity?: QueueAlertSeverity } = {
      venueId: venue_id,
      resolvedAt: null,
    };

    if (severity) {
      where.severity = severity.toUpperCase() as QueueAlertSeverity;
    }

    const alerts = await prisma.queueAlert.findMany({
      where,
      orderBy: { triggeredAt: 'desc' },
    });

    type AlertItem = typeof alerts[number];
    res.json({
      alerts: alerts.map((a: AlertItem) => ({
        code: a.code,
        severity: a.severity.toLowerCase(),
        message: a.message,
        triggered_at: a.triggeredAt.toISOString(),
        bar_id: a.barId,
      })),
    });
  } catch (error) {
    console.error('Alerts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// CONFIG - Administración
// ============================================

/**
 * GET /config
 * Get current config
 */
router.get('/config', requireAuth, requireRole('OWNER', 'ADMIN', 'MANAGER'), async (req, res): Promise<void> => {
  try {
    const { venue_id, festival_event_id } = req.query as {
      venue_id: string;
      festival_event_id?: string;
    };

    if (!venue_id) {
      res.status(400).json({ error: 'venue_id is required' });
      return;
    }

    const config = await prisma.queueEngineConfig.findFirst({
      where: {
        venueId: venue_id,
        eventId: festival_event_id || null,
        isActive: true,
      },
    });

    if (!config) {
      // Return default config
      const defaultConfig = stateManager.getConfig(venue_id, 'default');
      res.json({
        ...defaultConfig,
        config_id: 'default',
        venue_id,
        version: 1,
      });
      return;
    }

    res.json({
      config_id: config.id,
      venue_id: config.venueId,
      event_id: config.eventId,
      version: config.version,
      features: {
        batching_enabled: config.batchingEnabled,
        stocking_enabled: config.stockingEnabled,
        autopilot_enabled: config.autopilotEnabled,
      },
      batching: {
        B0: config.batchB0,
        B_min: config.batchBMin,
        B_max: config.batchBMax,
        tau0_sec: config.batchTau0Sec,
        tau_min_sec: config.batchTauMinSec,
        tau_max_sec: config.batchTauMaxSec,
      },
      stocking: {
        horizon_minutes: config.stockHorizonMin,
        safety_factor: Number(config.stockSafetyFactor),
        max_capacity_pct: Number(config.stockMaxCapacityPct),
      },
      guardrails: {
        p95_target_sec: config.p95TargetSec,
        p95_warning_sec: config.p95WarningSec,
        p95_critical_sec: config.p95CriticalSec,
        utilization_target: Number(config.utilTarget),
        utilization_warning: Number(config.utilWarning),
        utilization_critical: Number(config.utilCritical),
        max_queue_length: config.maxQueueLength,
        max_oldest_age_sec: config.maxOldestAgeSec,
      },
    });
  } catch (error) {
    console.error('Config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /config
 * Update config
 */
router.put('/config', requireAuth, requireRole('OWNER', 'ADMIN'), async (req, res): Promise<void> => {
  try {
    const params = engineConfigUpdateSchema.parse(req.body);

    // Find existing config or create new
    const existing = await prisma.queueEngineConfig.findFirst({
      where: {
        venueId: params.venue_id,
        eventId: params.event_id || null,
      },
    });

    const data: any = {
      venueId: params.venue_id,
      eventId: params.event_id || null,
      isActive: true,
    };

    if (params.features) {
      if (params.features.batching_enabled !== undefined) {
        data.batchingEnabled = params.features.batching_enabled;
      }
      if (params.features.stocking_enabled !== undefined) {
        data.stockingEnabled = params.features.stocking_enabled;
      }
      if (params.features.autopilot_enabled !== undefined) {
        data.autopilotEnabled = params.features.autopilot_enabled;
      }
    }

    if (params.batching) {
      if (params.batching.B0 !== undefined) data.batchB0 = params.batching.B0;
      if (params.batching.B_min !== undefined) data.batchBMin = params.batching.B_min;
      if (params.batching.B_max !== undefined) data.batchBMax = params.batching.B_max;
      if (params.batching.tau0_sec !== undefined) data.batchTau0Sec = params.batching.tau0_sec;
      if (params.batching.tau_min_sec !== undefined) data.batchTauMinSec = params.batching.tau_min_sec;
      if (params.batching.tau_max_sec !== undefined) data.batchTauMaxSec = params.batching.tau_max_sec;
    }

    if (params.stocking) {
      if (params.stocking.horizon_minutes !== undefined) {
        data.stockHorizonMin = params.stocking.horizon_minutes;
      }
      if (params.stocking.safety_factor !== undefined) {
        data.stockSafetyFactor = params.stocking.safety_factor;
      }
      if (params.stocking.max_capacity_pct !== undefined) {
        data.stockMaxCapacityPct = params.stocking.max_capacity_pct;
      }
    }

    if (params.guardrails) {
      if (params.guardrails.p95_target_sec !== undefined) {
        data.p95TargetSec = params.guardrails.p95_target_sec;
      }
      if (params.guardrails.p95_warning_sec !== undefined) {
        data.p95WarningSec = params.guardrails.p95_warning_sec;
      }
      if (params.guardrails.p95_critical_sec !== undefined) {
        data.p95CriticalSec = params.guardrails.p95_critical_sec;
      }
      if (params.guardrails.utilization_target !== undefined) {
        data.utilTarget = params.guardrails.utilization_target;
      }
      if (params.guardrails.utilization_warning !== undefined) {
        data.utilWarning = params.guardrails.utilization_warning;
      }
      if (params.guardrails.utilization_critical !== undefined) {
        data.utilCritical = params.guardrails.utilization_critical;
      }
      if (params.guardrails.max_queue_length !== undefined) {
        data.maxQueueLength = params.guardrails.max_queue_length;
      }
      if (params.guardrails.max_oldest_age_sec !== undefined) {
        data.maxOldestAgeSec = params.guardrails.max_oldest_age_sec;
      }
    }

    let config;
    if (existing) {
      config = await prisma.queueEngineConfig.update({
        where: { id: existing.id },
        data: {
          ...data,
          version: { increment: 1 },
        },
      });
    } else {
      config = await prisma.queueEngineConfig.create({
        data: {
          ...data,
          version: 1,
        },
      });
    }

    // Update in-memory state
    stateManager.updateConfig(params.venue_id, 'default', {
      config_id: config.id,
      venue_id: config.venueId,
      event_id: config.eventId || undefined,
      version: config.version,
      features: {
        batching_enabled: config.batchingEnabled,
        stocking_enabled: config.stockingEnabled,
        autopilot_enabled: config.autopilotEnabled,
      },
      batching: {
        B0: config.batchB0,
        B_min: config.batchBMin,
        B_max: config.batchBMax,
        tau0_sec: config.batchTau0Sec,
        tau_min_sec: config.batchTauMinSec,
        tau_max_sec: config.batchTauMaxSec,
      },
      stocking: {
        horizon_minutes: config.stockHorizonMin,
        safety_factor: Number(config.stockSafetyFactor),
        max_capacity_pct: Number(config.stockMaxCapacityPct),
      },
      guardrails: {
        p95_target_sec: config.p95TargetSec,
        p95_warning_sec: config.p95WarningSec,
        p95_critical_sec: config.p95CriticalSec,
        utilization_target: Number(config.utilTarget),
        utilization_warning: Number(config.utilWarning),
        utilization_critical: Number(config.utilCritical),
        max_queue_length: config.maxQueueLength,
        max_oldest_age_sec: config.maxOldestAgeSec,
      },
    });

    res.json({
      config_id: config.id,
      version: config.version,
      applied_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Config update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /config/features
 * Toggle feature flags
 */
router.patch('/config/features', requireAuth, requireRole('OWNER', 'ADMIN', 'MANAGER'), async (req, res): Promise<void> => {
  try {
    const params = featureToggleSchema.parse(req.body);

    const config = await prisma.queueEngineConfig.findFirst({
      where: {
        venueId: params.venue_id,
        isActive: true,
      },
    });

    const data: any = {};
    if (params.features.batching_enabled !== undefined) {
      data.batchingEnabled = params.features.batching_enabled;
    }
    if (params.features.stocking_enabled !== undefined) {
      data.stockingEnabled = params.features.stocking_enabled;
    }
    if (params.features.autopilot_enabled !== undefined) {
      data.autopilotEnabled = params.features.autopilot_enabled;
    }

    if (config) {
      await prisma.queueEngineConfig.update({
        where: { id: config.id },
        data,
      });
    } else {
      await prisma.queueEngineConfig.create({
        data: {
          venueId: params.venue_id,
          ...data,
        },
      });
    }

    // Update in-memory state
    const currentConfig = stateManager.getConfig(params.venue_id, 'default');
    stateManager.updateConfig(params.venue_id, 'default', {
      ...currentConfig,
      features: {
        ...currentConfig.features,
        ...params.features,
      },
    });

    res.json({
      venue_id: params.venue_id,
      features: params.features,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Feature toggle error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
