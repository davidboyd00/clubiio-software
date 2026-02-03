import { stateManager } from '../state/state.manager';
import { PercentileStats, ResourceUtil, QueueStats, MetricsSnapshot } from '../queue.types';

// ============================================
// METRICS CALCULATOR
// ============================================

export class MetricsCalculator {
  // ─────────────────────────────────────────
  // LAMBDA (ARRIVAL RATE) ESTIMATION
  // ─────────────────────────────────────────

  /**
   * Estimate arrival rate λ(t) using EWMA
   * Returns orders per minute
   */
  calculateLambda(
    venueId: string,
    barId: string,
    windowSec: number = 300
  ): {
    rate_per_min: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    confidence: number;
  } {
    const arrivals = stateManager.getArrivals(venueId, barId);
    const now = Date.now();
    const windowStart = now - windowSec * 1000;

    // Filter to window
    const recentArrivals = arrivals.filter((t) => t >= windowStart);

    if (recentArrivals.length < 2) {
      return { rate_per_min: 0, trend: 'stable', confidence: 0 };
    }

    // Simple rate
    const ratePerSec = recentArrivals.length / windowSec;
    const ratePerMin = ratePerSec * 60;

    // Trend detection (compare first half vs second half)
    const halfWindow = windowSec / 2;
    const midpoint = now - halfWindow * 1000;
    const firstHalf = recentArrivals.filter((t) => t < midpoint).length;
    const secondHalf = recentArrivals.length - firstHalf;

    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (secondHalf > firstHalf * 1.2) {
      trend = 'increasing';
    } else if (secondHalf < firstHalf * 0.8) {
      trend = 'decreasing';
    }

    // Confidence based on sample size (30 arrivals = high confidence)
    const confidence = Math.min(1, recentArrivals.length / 30);

    return { rate_per_min: ratePerMin, trend, confidence };
  }

  // ─────────────────────────────────────────
  // UTILIZATION
  // ─────────────────────────────────────────

  /**
   * Calculate bartender utilization ρ(t)
   */
  calculateUtilization(
    venueId: string,
    barId: string
  ): ResourceUtil {
    const activeBartenders = stateManager.getActiveBartenders(venueId, barId);
    const inService = stateManager.getBartendersInService(venueId, barId);

    const total = activeBartenders.length;
    const active = inService;
    const utilization = total > 0 ? active / total : 0;

    const config = stateManager.getConfig(venueId, barId);
    let status: 'ok' | 'warning' | 'critical' = 'ok';
    if (utilization >= config.guardrails.utilization_critical) {
      status = 'critical';
    } else if (utilization >= config.guardrails.utilization_warning) {
      status = 'warning';
    }

    return { active, total, utilization, status };
  }

  // ─────────────────────────────────────────
  // PERCENTILES
  // ─────────────────────────────────────────

  /**
   * Calculate wait time percentiles from completed orders
   */
  calculatePercentiles(
    venueId: string,
    barId: string,
    windowSec: number = 900 // 15 min default
  ): PercentileStats {
    const completed = stateManager.getCompletedOrders(venueId, barId, windowSec);

    if (completed.length === 0) {
      return this.emptyPercentiles();
    }

    const waitTimes = completed
      .map((o) => o.total_wait_sec)
      .sort((a, b) => a - b);

    return {
      p50_sec: this.percentile(waitTimes, 0.5),
      p90_sec: this.percentile(waitTimes, 0.9),
      p95_sec: this.percentile(waitTimes, 0.95),
      p99_sec: this.percentile(waitTimes, 0.99),
      mean_sec: this.mean(waitTimes),
      std_sec: this.std(waitTimes),
      sample_size: waitTimes.length,
    };
  }

  /**
   * Calculate percentiles by stage (capture, queue_prep, preparation)
   */
  calculateStagePercentiles(
    venueId: string,
    barId: string,
    windowSec: number = 900
  ): {
    capture: PercentileStats;
    queue_prep: PercentileStats;
    preparation: PercentileStats;
  } {
    const completed = stateManager.getCompletedOrders(venueId, barId, windowSec);

    // Capture: created -> paid
    const captureTimes = completed
      .filter((o) => o.paid_at)
      .map((o) => (o.paid_at!.getTime() - o.created_at.getTime()) / 1000)
      .sort((a, b) => a - b);

    // Queue prep: paid -> prep_started
    const queuePrepTimes = completed
      .filter((o) => o.paid_at && o.prep_started_at)
      .map((o) => (o.prep_started_at!.getTime() - o.paid_at!.getTime()) / 1000)
      .sort((a, b) => a - b);

    // Preparation: prep_started -> delivered
    const prepTimes = completed
      .filter((o) => o.prep_started_at)
      .map((o) => (o.delivered_at.getTime() - o.prep_started_at!.getTime()) / 1000)
      .sort((a, b) => a - b);

    return {
      capture: this.percentilesFromArray(captureTimes),
      queue_prep: this.percentilesFromArray(queuePrepTimes),
      preparation: this.percentilesFromArray(prepTimes),
    };
  }

  // ─────────────────────────────────────────
  // QUEUE STATS
  // ─────────────────────────────────────────

  calculateQueueStats(
    venueId: string,
    barId: string,
    familyId?: string
  ): QueueStats {
    const length = stateManager.getQueueLength(venueId, barId, familyId);
    const oldestAge = stateManager.getOldestOrderAge(venueId, barId, familyId);

    // Calculate average age
    let avgAge = 0;
    if (familyId) {
      const orders = stateManager.getQueuedOrders(venueId, barId, familyId);
      if (orders.length > 0) {
        const now = Date.now();
        const ages = orders
          .filter((o) => o.paid_at)
          .map((o) => (now - o.paid_at!.getTime()) / 1000);
        avgAge = ages.length > 0 ? this.mean(ages) : 0;
      }
    }

    return {
      length,
      oldest_age_sec: oldestAge,
      avg_age_sec: avgAge,
    };
  }

  // ─────────────────────────────────────────
  // THROUGHPUT
  // ─────────────────────────────────────────

  calculateThroughput(
    venueId: string,
    barId: string,
    windowSec: number = 300
  ): {
    orders_per_min: number;
    items_per_min: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  } {
    const completed = stateManager.getCompletedOrders(venueId, barId, windowSec);

    const ordersPerMin = (completed.length / windowSec) * 60;

    const totalItems = completed.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0),
      0
    );
    const itemsPerMin = (totalItems / windowSec) * 60;

    // Trend (compare halves)
    const now = Date.now();
    const midpoint = now - (windowSec / 2) * 1000;
    const firstHalf = completed.filter(
      (o) => o.delivered_at.getTime() < midpoint
    ).length;
    const secondHalf = completed.length - firstHalf;

    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (secondHalf > firstHalf * 1.2) {
      trend = 'increasing';
    } else if (secondHalf < firstHalf * 0.8) {
      trend = 'decreasing';
    }

    return { orders_per_min: ordersPerMin, items_per_min: itemsPerMin, trend };
  }

  // ─────────────────────────────────────────
  // FULL SNAPSHOT
  // ─────────────────────────────────────────

  generateSnapshot(
    venueId: string,
    barId: string,
    windowMinutes: number = 15
  ): MetricsSnapshot {
    const windowSec = windowMinutes * 60;
    const now = new Date();

    return {
      request_id: crypto.randomUUID(),
      ts: now.toISOString(),
      venue_id: venueId,
      bar_id: barId,
      window_minutes: windowMinutes,
      wait_times: this.calculatePercentiles(venueId, barId, windowSec),
      stage_times: this.calculateStagePercentiles(venueId, barId, windowSec),
      throughput: this.calculateThroughput(venueId, barId, windowSec),
      utilization: {
        bartenders: this.calculateUtilization(venueId, barId),
        cashiers: { active: 0, total: 0, utilization: 0, status: 'ok' }, // TODO: implement
        totems: { active: 0, total: 0, utilization: 0, status: 'ok' }, // TODO: implement
      },
      queues: {
        cashier: { length: 0, oldest_age_sec: 0, avg_age_sec: 0 }, // TODO: implement
        totem: { length: 0, oldest_age_sec: 0, avg_age_sec: 0 },
        prep_total: this.calculateQueueStats(venueId, barId),
        prep_by_family: {}, // TODO: implement per-family
      },
      batching: {
        batches_formed: 0, // TODO: track
        avg_batch_size: 0,
        efficiency_gain_pct: 0,
      },
      active_alerts: stateManager.getActiveAlerts(venueId, barId),
    };
  }

  // ─────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const idx = Math.ceil(p * sortedValues.length) - 1;
    return sortedValues[Math.max(0, idx)];
  }

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private std(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.mean(values);
    const sqDiffs = values.map((v) => Math.pow(v - avg, 2));
    return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  private emptyPercentiles(): PercentileStats {
    return {
      p50_sec: 0,
      p90_sec: 0,
      p95_sec: 0,
      p99_sec: 0,
      mean_sec: 0,
      std_sec: 0,
      sample_size: 0,
    };
  }

  private percentilesFromArray(values: number[]): PercentileStats {
    if (values.length === 0) return this.emptyPercentiles();

    return {
      p50_sec: this.percentile(values, 0.5),
      p90_sec: this.percentile(values, 0.9),
      p95_sec: this.percentile(values, 0.95),
      p99_sec: this.percentile(values, 0.99),
      mean_sec: this.mean(values),
      std_sec: this.std(values),
      sample_size: values.length,
    };
  }
}

// Singleton instance
export const metricsCalculator = new MetricsCalculator();
