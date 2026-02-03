import { describe, it, expect } from 'vitest';
import {
  calculateBEff,
  calculateTauEff,
  shouldTriggerBatch,
  calculateLambda,
  calculateUtilization,
  calculatePercentile,
  calculatePercentiles,
  evaluateP95Status,
  evaluateUtilizationStatus,
  shouldTriggerCircuitBreaker,
  calculateTaskPriority,
  calculateAgingPriority,
  calculateTargetStock,
  calculateStockDeficit,
  clamp,
  calculateEWMA,
  BatchingConfig,
  GuardrailConfig,
  ArrivalRecord,
} from './queue.utils';

const defaultBatchingConfig: BatchingConfig = {
  B0: 6,
  B_min: 2,
  B_max: 12,
  tau0_sec: 90,
  tau_min_sec: 30,
  tau_max_sec: 180,
};

const defaultGuardrailConfig: GuardrailConfig = {
  p95_target_sec: 300,
  p95_warning_sec: 240,
  p95_critical_sec: 360,
  utilization_target: 0.8,
  utilization_warning: 0.85,
  utilization_critical: 0.95,
  max_queue_length: 50,
  max_oldest_age_sec: 300,
};

describe('Queue Engine Utils', () => {
  // ─────────────────────────────────────────
  // B_EFF CALCULATION
  // ─────────────────────────────────────────
  describe('calculateBEff', () => {
    it('should return B0 at low utilization and zero age', () => {
      // At ρ=0, age=0: B_eff = B0 * 1.1 = 6.6 → 7
      const bEff = calculateBEff(0, 0, defaultBatchingConfig);
      expect(bEff).toBe(7);
    });

    it('should decrease batch size at high utilization', () => {
      // At ρ=1, age=0: B_eff = B0 * (1.1 - 0.45) = 6 * 0.65 = 3.9 → 4
      const bEff = calculateBEff(1, 0, defaultBatchingConfig);
      expect(bEff).toBe(4);
    });

    it('should decrease batch size as age increases', () => {
      // At ρ=0.5, age=0: B_eff ≈ 5.25
      const bEffYoung = calculateBEff(0.5, 0, defaultBatchingConfig);
      // At ρ=0.5, age=100: B_eff ≈ 5.25 - 1.5 = 3.75 → 4
      const bEffOld = calculateBEff(0.5, 100, defaultBatchingConfig);

      expect(bEffOld).toBeLessThan(bEffYoung);
    });

    it('should respect B_min', () => {
      // Very high utilization and age should still respect minimum
      const bEff = calculateBEff(1, 500, defaultBatchingConfig);
      expect(bEff).toBeGreaterThanOrEqual(defaultBatchingConfig.B_min);
    });

    it('should respect B_max', () => {
      // Very low utilization should still respect maximum
      const bEff = calculateBEff(0, 0, defaultBatchingConfig);
      expect(bEff).toBeLessThanOrEqual(defaultBatchingConfig.B_max);
    });
  });

  // ─────────────────────────────────────────
  // TAU_EFF CALCULATION
  // ─────────────────────────────────────────
  describe('calculateTauEff', () => {
    it('should return high timeout at low utilization', () => {
      // At ρ=0, age=0: τ_eff = τ0 * 1.35 = 90 * 1.35 = 121.5
      const tauEff = calculateTauEff(0, 0, defaultBatchingConfig);
      expect(tauEff).toBeCloseTo(121.5, 1);
    });

    it('should decrease timeout at high utilization', () => {
      // At ρ=1, age=0: τ_eff = τ0 * (1.35 - 0.85) = 90 * 0.5 = 45
      const tauEff = calculateTauEff(1, 0, defaultBatchingConfig);
      expect(tauEff).toBeCloseTo(45, 1);
    });

    it('should decrease timeout as age increases', () => {
      const tauEffYoung = calculateTauEff(0.5, 0, defaultBatchingConfig);
      const tauEffOld = calculateTauEff(0.5, 100, defaultBatchingConfig);

      expect(tauEffOld).toBeLessThan(tauEffYoung);
    });

    it('should respect tau_min', () => {
      const tauEff = calculateTauEff(1, 1000, defaultBatchingConfig);
      expect(tauEff).toBeGreaterThanOrEqual(defaultBatchingConfig.tau_min_sec);
    });

    it('should respect tau_max', () => {
      const tauEff = calculateTauEff(0, 0, defaultBatchingConfig);
      expect(tauEff).toBeLessThanOrEqual(defaultBatchingConfig.tau_max_sec);
    });
  });

  // ─────────────────────────────────────────
  // BATCH TRIGGER LOGIC
  // ─────────────────────────────────────────
  describe('shouldTriggerBatch', () => {
    it('should trigger when queue >= B_eff', () => {
      const result = shouldTriggerBatch(6, 50, 6, 90);

      expect(result.shouldTrigger).toBe(true);
      expect(result.reason).toBe('queue_ge_B_eff');
    });

    it('should trigger when age >= tau_eff', () => {
      const result = shouldTriggerBatch(3, 100, 6, 90);

      expect(result.shouldTrigger).toBe(true);
      expect(result.reason).toBe('oldest_age_exceeded_tau');
    });

    it('should not trigger when both conditions not met', () => {
      const result = shouldTriggerBatch(3, 50, 6, 90);

      expect(result.shouldTrigger).toBe(false);
      expect(result.reason).toBe('waiting');
    });

    it('should prefer queue trigger over age trigger', () => {
      // Both conditions met - should report queue trigger first
      const result = shouldTriggerBatch(10, 200, 6, 90);

      expect(result.shouldTrigger).toBe(true);
      expect(result.reason).toBe('queue_ge_B_eff');
    });
  });

  // ─────────────────────────────────────────
  // LAMBDA CALCULATION
  // ─────────────────────────────────────────
  describe('calculateLambda', () => {
    it('should calculate arrival rate correctly', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const arrivals: ArrivalRecord[] = [
        { ts: new Date('2024-01-15T11:58:00Z'), order_id: '1' },
        { ts: new Date('2024-01-15T11:59:00Z'), order_id: '2' },
        { ts: new Date('2024-01-15T11:59:30Z'), order_id: '3' },
      ];

      // 3 arrivals in 5 min window = 0.6 per minute
      const lambda = calculateLambda(arrivals, 300, now);

      expect(lambda.count).toBe(3);
      expect(lambda.rate_per_min).toBeCloseTo(0.6, 1);
    });

    it('should exclude old arrivals', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const arrivals: ArrivalRecord[] = [
        { ts: new Date('2024-01-15T11:50:00Z'), order_id: '1' }, // 10 min ago - excluded
        { ts: new Date('2024-01-15T11:59:00Z'), order_id: '2' },
      ];

      const lambda = calculateLambda(arrivals, 300, now);

      expect(lambda.count).toBe(1);
    });

    it('should handle empty arrivals', () => {
      const lambda = calculateLambda([], 300);

      expect(lambda.count).toBe(0);
      expect(lambda.rate_per_min).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // UTILIZATION CALCULATION
  // ─────────────────────────────────────────
  describe('calculateUtilization', () => {
    it('should calculate utilization correctly', () => {
      // λ = 6 orders/min, c = 3 servers, μ = 2 orders/min/server (30s service time)
      // ρ = 6 / (3 * 2) = 1.0
      const rho = calculateUtilization(6, 3, 30);
      expect(rho).toBe(1);
    });

    it('should return 0 for no servers', () => {
      const rho = calculateUtilization(10, 0, 30);
      expect(rho).toBe(0);
    });

    it('should clamp to [0, 1]', () => {
      // Very high demand should cap at 1
      const rho = calculateUtilization(100, 1, 60);
      expect(rho).toBeLessThanOrEqual(1);
    });

    it('should handle typical festival scenario', () => {
      // 30 orders/min, 5 bartenders, 45s avg service time
      // μ = 60/45 = 1.33 orders/min/bartender
      // ρ = 30 / (5 * 1.33) = 4.5 → clamped to 1
      const rho = calculateUtilization(30, 5, 45);
      expect(rho).toBeLessThanOrEqual(1);
    });
  });

  // ─────────────────────────────────────────
  // PERCENTILE CALCULATION
  // ─────────────────────────────────────────
  describe('calculatePercentile', () => {
    it('should calculate median correctly', () => {
      const values = [10, 20, 30, 40, 50];
      expect(calculatePercentile(values, 50)).toBe(30);
    });

    it('should calculate P95 correctly', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(calculatePercentile(values, 95)).toBe(95);
    });

    it('should handle empty array', () => {
      expect(calculatePercentile([], 50)).toBe(0);
    });

    it('should handle single element', () => {
      expect(calculatePercentile([42], 50)).toBe(42);
      expect(calculatePercentile([42], 95)).toBe(42);
    });
  });

  describe('calculatePercentiles', () => {
    it('should calculate all percentiles', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      const percentiles = calculatePercentiles(values);

      expect(percentiles.p50).toBe(50);
      expect(percentiles.p90).toBe(90);
      expect(percentiles.p95).toBe(95);
      expect(percentiles.p99).toBe(99);
    });
  });

  // ─────────────────────────────────────────
  // GUARDRAIL EVALUATION
  // ─────────────────────────────────────────
  describe('evaluateP95Status', () => {
    it('should return ok when below warning threshold', () => {
      expect(evaluateP95Status(200, defaultGuardrailConfig)).toBe('ok');
    });

    it('should return warning when between warning and critical', () => {
      expect(evaluateP95Status(300, defaultGuardrailConfig)).toBe('warning');
    });

    it('should return critical when above critical threshold', () => {
      expect(evaluateP95Status(400, defaultGuardrailConfig)).toBe('critical');
    });
  });

  describe('evaluateUtilizationStatus', () => {
    it('should return ok when below warning threshold', () => {
      expect(evaluateUtilizationStatus(0.7, defaultGuardrailConfig)).toBe('ok');
    });

    it('should return warning when between warning and critical', () => {
      expect(evaluateUtilizationStatus(0.9, defaultGuardrailConfig)).toBe('warning');
    });

    it('should return critical when above critical threshold', () => {
      expect(evaluateUtilizationStatus(0.98, defaultGuardrailConfig)).toBe('critical');
    });
  });

  // ─────────────────────────────────────────
  // CIRCUIT BREAKER
  // ─────────────────────────────────────────
  describe('shouldTriggerCircuitBreaker', () => {
    it('should trigger on queue length exceeded', () => {
      const result = shouldTriggerCircuitBreaker(60, 100, defaultGuardrailConfig);

      expect(result.trigger).toBe(true);
      expect(result.reason).toBe('queue_length_exceeded');
    });

    it('should trigger on max age exceeded', () => {
      const result = shouldTriggerCircuitBreaker(30, 350, defaultGuardrailConfig);

      expect(result.trigger).toBe(true);
      expect(result.reason).toBe('max_age_exceeded');
    });

    it('should not trigger when within limits', () => {
      const result = shouldTriggerCircuitBreaker(30, 200, defaultGuardrailConfig);

      expect(result.trigger).toBe(false);
      expect(result.reason).toBeNull();
    });
  });

  // ─────────────────────────────────────────
  // PRIORITY CALCULATION
  // ─────────────────────────────────────────
  describe('calculateTaskPriority', () => {
    it('should calculate base priority', () => {
      const priority = calculateTaskPriority(0, 0, 300, 50);
      expect(priority).toBe(50);
    });

    it('should increase priority with age', () => {
      const youngPriority = calculateTaskPriority(50, 5, 300, 50);
      const oldPriority = calculateTaskPriority(200, 5, 300, 50);

      expect(oldPriority).toBeGreaterThan(youngPriority);
    });

    it('should increase priority with queue length', () => {
      const shortQueuePriority = calculateTaskPriority(100, 5, 300, 50);
      const longQueuePriority = calculateTaskPriority(100, 30, 300, 50);

      expect(longQueuePriority).toBeGreaterThan(shortQueuePriority);
    });

    it('should respect max priority', () => {
      const priority = calculateTaskPriority(1000, 100, 300, 50);
      expect(priority).toBeLessThanOrEqual(90);
    });
  });

  describe('calculateAgingPriority', () => {
    it('should double priority at half-life', () => {
      const basePriority = calculateAgingPriority(10, 0, 300);
      const agedPriority = calculateAgingPriority(10, 300, 300);

      expect(agedPriority).toBeCloseTo(basePriority * 2, 1);
    });

    it('should not change priority at age 0', () => {
      const priority = calculateAgingPriority(50, 0, 300);
      expect(priority).toBe(50);
    });
  });

  // ─────────────────────────────────────────
  // STOCK FORECASTING
  // ─────────────────────────────────────────
  describe('calculateTargetStock', () => {
    it('should calculate target with safety factor', () => {
      // 2 orders/min * 30 min * 1.2 safety = 72
      const target = calculateTargetStock(2, 30, 1.2);
      expect(target).toBe(72);
    });

    it('should round up', () => {
      const target = calculateTargetStock(1.5, 10, 1);
      expect(target).toBe(15);
    });
  });

  describe('calculateStockDeficit', () => {
    it('should calculate deficit correctly', () => {
      expect(calculateStockDeficit(10, 50)).toBe(40);
    });

    it('should return 0 when stock exceeds target', () => {
      expect(calculateStockDeficit(60, 50)).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // UTILITY FUNCTIONS
  // ─────────────────────────────────────────
  describe('clamp', () => {
    it('should clamp values correctly', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('calculateEWMA', () => {
    it('should calculate EWMA correctly', () => {
      // EWMA = α * current + (1-α) * previous
      // With α=0.3: 0.3 * 100 + 0.7 * 50 = 30 + 35 = 65
      const ewma = calculateEWMA(100, 50, 0.3);
      expect(ewma).toBe(65);
    });

    it('should handle initial value', () => {
      const ewma = calculateEWMA(100, 0, 0.3);
      expect(ewma).toBe(30);
    });
  });
});
