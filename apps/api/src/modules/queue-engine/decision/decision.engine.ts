import { stateManager } from '../state/state.manager';
import { metricsCalculator } from '../metrics/metrics.calculator';
import {
  Task,
  NextTaskResponse,
  GuardrailStatus,
  TaskExplanation,
  OrderState,
} from '../queue.types';
import { prisma } from '../../../common/database';

// ============================================
// DECISION ENGINE
// ============================================

interface SkuInfo {
  sku_id: string;
  family_id: string;
  classification: 'stockable' | 'batchable' | 'custom';
  prep_time_mean: number;
  prep_time_std: number;
  max_batch_size: number;
}

export class DecisionEngine {
  // Cache for SKU mappings
  private skuCache: Map<string, Map<string, SkuInfo>> = new Map(); // tenantId -> sku_id -> info

  // ─────────────────────────────────────────
  // MAIN DECISION ENTRY POINT
  // ─────────────────────────────────────────

  async getNextTask(
    venueId: string,
    barId: string,
    bartenderId?: string,
    _stationId?: string,
    excludeFamilies?: string[]
  ): Promise<NextTaskResponse> {
    const now = new Date();
    const config = stateManager.getConfig(venueId, barId);
    const guardrailState = stateManager.getGuardrailState(venueId, barId);

    // Calculate current metrics
    const utilization = metricsCalculator.calculateUtilization(venueId, barId);
    const lambda = metricsCalculator.calculateLambda(venueId, barId);
    const percentiles = metricsCalculator.calculatePercentiles(venueId, barId);

    // Evaluate guardrails
    const guardrails = this.evaluateGuardrails(
      venueId,
      barId,
      percentiles.p95_sec,
      utilization.utilization,
      config,
      guardrailState
    );

    // Find best task
    const { task, explanation, alternatives } = await this.selectBestTask(
      venueId,
      barId,
      bartenderId,
      excludeFamilies,
      guardrails,
      utilization.utilization,
      lambda.rate_per_min,
      config
    );

    return {
      request_id: crypto.randomUUID(),
      ts: now.toISOString(),
      bar_id: barId,
      task,
      alternatives,
      guardrails,
      explain: explanation,
      valid_until: new Date(now.getTime() + 60000).toISOString(), // 60s TTL
    };
  }

  // ─────────────────────────────────────────
  // TASK SELECTION
  // ─────────────────────────────────────────

  private async selectBestTask(
    venueId: string,
    barId: string,
    _bartenderId: string | undefined,
    excludeFamilies: string[] | undefined,
    guardrails: GuardrailStatus,
    rho: number,
    lambda: number,
    config: ReturnType<typeof stateManager.getConfig>
  ): Promise<{
    task: Task | null;
    explanation: TaskExplanation;
    alternatives?: Task[];
  }> {
    const candidates: Task[] = [];

    // 1. Check circuit breakers first (emergency tasks)
    const circuitBreakerTask = this.checkCircuitBreakers(venueId, barId, config);
    if (circuitBreakerTask) {
      return {
        task: circuitBreakerTask,
        explanation: {
          rho_est: rho,
          lambda_est: lambda,
          decision_rule: 'circuit_breaker_triggered',
          confidence: 1.0,
        },
      };
    }

    // 2. Evaluate batchable SKUs
    if (guardrails.batching_enabled) {
      const batchTasks = await this.evaluateBatchCandidates(
        venueId,
        barId,
        rho,
        excludeFamilies,
        config
      );
      candidates.push(...batchTasks);
    }

    // 3. Evaluate custom orders (with aging priority)
    const customTasks = this.evaluateCustomOrders(venueId, barId, config);
    candidates.push(...customTasks);

    // 4. Evaluate stocking tasks (if enabled and capacity available)
    if (guardrails.stocking_enabled && rho < 0.75) {
      const stockTasks = await this.evaluateStockingTasks(venueId, barId, config);
      candidates.push(...stockTasks);
    }

    // Sort by priority (highest first)
    candidates.sort((a, b) => b.priority - a.priority);

    // Get best task and alternatives
    const task = candidates.length > 0 ? candidates[0] : null;
    const alternatives = candidates.slice(1, 4); // Up to 3 alternatives

    // Build explanation
    const oldestAge = stateManager.getOldestOrderAge(venueId, barId);
    const queueLength = stateManager.getQueueLength(venueId, barId);

    // Calculate B_eff and tau_eff for explanation
    const B_eff = this.calculateBEff(rho, oldestAge, config);
    const tau_eff = this.calculateTauEff(rho, oldestAge, config);

    let decisionRule = 'no_pending_work';
    if (task) {
      if (task.type === 'batch') {
        decisionRule =
          queueLength >= B_eff
            ? 'queue_ge_B_eff'
            : oldestAge >= tau_eff
              ? 'oldest_age_exceeded_tau'
              : 'batch_ready';
      } else if (task.type === 'custom') {
        decisionRule = 'custom_order_priority';
      } else if (task.type === 'stock') {
        decisionRule = 'stocking_capacity_available';
      }
    }

    return {
      task,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
      explanation: {
        rho_est: rho,
        lambda_est: lambda,
        queue_length: queueLength,
        oldest_age_sec: oldestAge,
        B_eff,
        tau_eff_sec: tau_eff,
        decision_rule: decisionRule,
        confidence: task ? 0.85 : 0.5,
      },
    };
  }

  // ─────────────────────────────────────────
  // CIRCUIT BREAKERS
  // ─────────────────────────────────────────

  private checkCircuitBreakers(
    venueId: string,
    barId: string,
    config: ReturnType<typeof stateManager.getConfig>
  ): Task | null {
    const queueLength = stateManager.getQueueLength(venueId, barId);
    const oldestAge = stateManager.getOldestOrderAge(venueId, barId);

    // Queue length breaker - force flush
    if (queueLength > config.guardrails.max_queue_length) {
      return {
        task_id: crypto.randomUUID(),
        type: 'batch',
        priority: 100,
        batch_size: 5, // Small batch to flush quickly
        estimated_prep_sec: 60,
        estimated_setup_sec: 0,
      };
    }

    // Age breaker - prioritize oldest
    if (oldestAge > config.guardrails.max_oldest_age_sec) {
      // Find the oldest order and create a task for it
      // For now, return a high priority custom task marker
      return {
        task_id: crypto.randomUUID(),
        type: 'custom',
        priority: 100,
        estimated_prep_sec: 30,
        estimated_setup_sec: 0,
      };
    }

    return null;
  }

  // ─────────────────────────────────────────
  // BATCH EVALUATION
  // ─────────────────────────────────────────

  private async evaluateBatchCandidates(
    venueId: string,
    barId: string,
    rho: number,
    excludeFamilies: string[] | undefined,
    config: ReturnType<typeof stateManager.getConfig>
  ): Promise<Task[]> {
    const tasks: Task[] = [];
    const state = stateManager.getBarState(venueId, barId);

    // Get all family queues
    for (const [familyId, orderIds] of state.queues) {
      if (excludeFamilies?.includes(familyId)) continue;
      if (orderIds.length === 0) continue;

      // Get queued orders
      const orders = orderIds
        .map((id) => state.orders.get(id))
        .filter((o): o is OrderState => o !== undefined && o.paid_at !== undefined);

      if (orders.length === 0) continue;

      // Calculate oldest age in this queue
      const now = Date.now();
      const oldestAge = Math.max(
        ...orders.map((o) => (now - o.paid_at!.getTime()) / 1000)
      );

      // Calculate B_eff and tau_eff
      const B_eff = this.calculateBEff(rho, oldestAge, config);
      const tau_eff = this.calculateTauEff(rho, oldestAge, config);

      // Check if batch should trigger
      const shouldTrigger = orders.length >= B_eff || oldestAge >= tau_eff;

      if (shouldTrigger) {
        const batchSize = Math.min(orders.length, config.batching.B_max);
        const batchOrders = orders.slice(0, batchSize);

        // Priority based on age and queue length
        const priority = Math.min(
          90,
          50 + (oldestAge / config.guardrails.max_oldest_age_sec) * 30 +
            (orders.length / config.guardrails.max_queue_length) * 10
        );

        tasks.push({
          task_id: crypto.randomUUID(),
          type: 'batch',
          priority,
          family: familyId,
          batch_size: batchSize,
          order_ids: batchOrders.map((o) => o.order_id),
          estimated_prep_sec: 30 * batchSize * 0.6, // Assume 40% efficiency gain
          estimated_setup_sec: 5, // TODO: use setup matrix
        });
      }
    }

    return tasks;
  }

  // ─────────────────────────────────────────
  // CUSTOM ORDER EVALUATION
  // ─────────────────────────────────────────

  private evaluateCustomOrders(
    venueId: string,
    barId: string,
    _config: ReturnType<typeof stateManager.getConfig>
  ): Task[] {
    const tasks: Task[] = [];
    const orders = stateManager.getAllOrdersByStage(venueId, barId, 'paid');

    // Filter to custom orders (those not in batch queues or marked as custom)
    const customOrders = orders.filter((o) =>
      o.items.some((i) => i.classification === 'custom')
    );

    const now = Date.now();
    const beta = 0.5; // Aging weight

    for (const order of customOrders) {
      const age = order.paid_at ? (now - order.paid_at.getTime()) / 1000 : 0;
      const estimatedPrepTime = 60; // TODO: calculate from SKU info

      // Priority: lower prep time + aging boost
      const priority = Math.min(
        85,
        40 + beta * (age / 60) * 20 + (1 - estimatedPrepTime / 120) * 10
      );

      tasks.push({
        task_id: crypto.randomUUID(),
        type: 'custom',
        priority,
        order_id: order.order_id,
        items: order.items.map((i) => ({ sku_id: i.sku_id, qty: i.qty })),
        estimated_prep_sec: estimatedPrepTime,
        estimated_setup_sec: 5,
      });
    }

    return tasks;
  }

  // ─────────────────────────────────────────
  // STOCKING EVALUATION
  // ─────────────────────────────────────────

  private async evaluateStockingTasks(
    _venueId: string,
    _barId: string,
    _config: ReturnType<typeof stateManager.getConfig>
  ): Promise<Task[]> {
    // Get stockable SKUs with deficit
    // TODO: Implement forecast-based stocking
    // For now, return empty - stocking requires inventory snapshot events
    return [];
  }

  // ─────────────────────────────────────────
  // GUARDRAIL EVALUATION
  // ─────────────────────────────────────────

  private evaluateGuardrails(
    _venueId: string,
    _barId: string,
    p95Current: number,
    utilizationCurrent: number,
    config: ReturnType<typeof stateManager.getConfig>,
    state: ReturnType<typeof stateManager.getGuardrailState>
  ): GuardrailStatus {
    const alerts: Array<{
      code: string;
      severity: 'info' | 'warning' | 'critical';
      message: string;
      triggered_at: string;
    }> = [];

    // P95 status
    let p95Status: 'ok' | 'warning' | 'critical' = 'ok';
    if (p95Current > config.guardrails.p95_critical_sec) {
      p95Status = 'critical';
      alerts.push({
        code: 'P95_CRITICAL',
        severity: 'critical',
        message: `P95 wait ${p95Current.toFixed(0)}s exceeds ${config.guardrails.p95_critical_sec}s`,
        triggered_at: new Date().toISOString(),
      });
    } else if (p95Current > config.guardrails.p95_warning_sec) {
      p95Status = 'warning';
      alerts.push({
        code: 'P95_WARNING',
        severity: 'warning',
        message: `P95 wait ${p95Current.toFixed(0)}s exceeds ${config.guardrails.p95_warning_sec}s`,
        triggered_at: new Date().toISOString(),
      });
    }

    // Utilization status
    let utilStatus: 'ok' | 'warning' | 'critical' = 'ok';
    if (utilizationCurrent >= config.guardrails.utilization_critical) {
      utilStatus = 'critical';
      alerts.push({
        code: 'UTILIZATION_CRITICAL',
        severity: 'critical',
        message: `Utilization ${(utilizationCurrent * 100).toFixed(0)}% is critical`,
        triggered_at: new Date().toISOString(),
      });
    } else if (utilizationCurrent >= config.guardrails.utilization_warning) {
      utilStatus = 'warning';
      alerts.push({
        code: 'UTILIZATION_WARNING',
        severity: 'warning',
        message: `Utilization ${(utilizationCurrent * 100).toFixed(0)}% is high`,
        triggered_at: new Date().toISOString(),
      });
    }

    // Decide batching/stocking state based on hysteresis
    let batchingEnabled = state.batching_enabled;
    let stockingEnabled = state.stocking_enabled;
    let batchingReason = 'no_change';
    let stockingReason = 'no_change';

    // Disable batching if P95 critical
    if (p95Status === 'critical') {
      batchingEnabled = false;
      batchingReason = 'p95_critical_disable';
    }

    // Disable stocking if utilization critical
    if (utilStatus === 'critical') {
      stockingEnabled = false;
      stockingReason = 'utilization_critical_pause';
    }

    // Apply feature flags
    if (!config.features.batching_enabled) {
      batchingEnabled = false;
      batchingReason = 'feature_disabled';
    }
    if (!config.features.stocking_enabled) {
      stockingEnabled = false;
      stockingReason = 'feature_disabled';
    }

    return {
      p95_target_sec: config.guardrails.p95_target_sec,
      p95_current_sec: p95Current,
      p95_status: p95Status,
      utilization_target: config.guardrails.utilization_target,
      utilization_current: utilizationCurrent,
      utilization_status: utilStatus,
      batching_enabled: batchingEnabled,
      batching_reason: batchingReason,
      stocking_enabled: stockingEnabled,
      stocking_reason: stockingReason,
      alerts,
    };
  }

  // ─────────────────────────────────────────
  // BATCHING PARAMETER CALCULATION
  // ─────────────────────────────────────────

  /**
   * Calculate effective batch size B_eff based on utilization and age
   * Formula: B_eff = clamp(round(B0*(1.10 - 0.45*ρ) - 0.015*age), B_min, B_max)
   */
  private calculateBEff(
    rho: number,
    oldestAge: number,
    config: ReturnType<typeof stateManager.getConfig>
  ): number {
    const { B0, B_min, B_max } = config.batching;
    const raw = B0 * (1.1 - 0.45 * rho) - 0.015 * oldestAge;
    return Math.max(B_min, Math.min(B_max, Math.round(raw)));
  }

  /**
   * Calculate effective timeout τ_eff based on utilization and age
   * Formula: τ_eff = clamp(τ0*(1.35 - 0.85*ρ) - 0.25*(age/10), τ_min, τ_max)
   */
  private calculateTauEff(
    rho: number,
    oldestAge: number,
    config: ReturnType<typeof stateManager.getConfig>
  ): number {
    const { tau0_sec, tau_min_sec, tau_max_sec } = config.batching;
    const raw = tau0_sec * (1.35 - 0.85 * rho) - 0.25 * (oldestAge / 10);
    return Math.max(tau_min_sec, Math.min(tau_max_sec, raw));
  }

  // ─────────────────────────────────────────
  // SKU CACHE MANAGEMENT
  // ─────────────────────────────────────────

  async loadSkuMappings(tenantId: string): Promise<void> {
    const mappings = await prisma.queueSkuMapping.findMany({
      where: { tenantId, isActive: true },
      include: { family: true },
    });

    const cache = new Map<string, SkuInfo>();
    for (const m of mappings) {
      cache.set(m.productId, {
        sku_id: m.productId,
        family_id: m.familyId,
        classification: m.classification.toLowerCase() as 'stockable' | 'batchable' | 'custom',
        prep_time_mean: m.prepTimeMean,
        prep_time_std: m.prepTimeStd,
        max_batch_size: m.maxBatchSize,
      });
    }

    this.skuCache.set(tenantId, cache);
  }

  getSkuInfo(tenantId: string, skuId: string): SkuInfo | undefined {
    return this.skuCache.get(tenantId)?.get(skuId);
  }
}

// Singleton instance
export const decisionEngine = new DecisionEngine();
