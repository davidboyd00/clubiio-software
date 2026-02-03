// ============================================
// PURE UTILITY FUNCTIONS FOR QUEUE ENGINE
// Extracted for testability
// ============================================

export interface BatchingConfig {
  B0: number;      // Base batch size
  B_min: number;   // Minimum batch size
  B_max: number;   // Maximum batch size
  tau0_sec: number;    // Base timeout (seconds)
  tau_min_sec: number; // Minimum timeout
  tau_max_sec: number; // Maximum timeout
}

export interface GuardrailConfig {
  p95_target_sec: number;
  p95_warning_sec: number;
  p95_critical_sec: number;
  utilization_target: number;
  utilization_warning: number;
  utilization_critical: number;
  max_queue_length: number;
  max_oldest_age_sec: number;
}

export interface ArrivalRecord {
  ts: Date;
  order_id: string;
}

// ─────────────────────────────────────────
// BATCHING PARAMETERS
// ─────────────────────────────────────────

/**
 * Calculate effective batch size B_eff based on utilization and age
 * Formula: B_eff = clamp(round(B0*(1.10 - 0.45*ρ) - 0.015*age), B_min, B_max)
 *
 * As utilization increases, batch size decreases (process faster)
 * As age increases, batch size decreases (don't wait too long)
 */
export function calculateBEff(
  rho: number,         // Current utilization (0-1)
  oldestAge: number,   // Age of oldest order in seconds
  config: BatchingConfig
): number {
  const { B0, B_min, B_max } = config;
  const raw = B0 * (1.1 - 0.45 * rho) - 0.015 * oldestAge;
  return Math.max(B_min, Math.min(B_max, Math.round(raw)));
}

/**
 * Calculate effective timeout τ_eff based on utilization and age
 * Formula: τ_eff = clamp(τ0*(1.35 - 0.85*ρ) - 0.25*(age/10), τ_min, τ_max)
 *
 * As utilization increases, timeout decreases (trigger batches sooner)
 * As age increases, timeout decreases (don't make customers wait)
 */
export function calculateTauEff(
  rho: number,
  oldestAge: number,
  config: BatchingConfig
): number {
  const { tau0_sec, tau_min_sec, tau_max_sec } = config;
  const raw = tau0_sec * (1.35 - 0.85 * rho) - 0.25 * (oldestAge / 10);
  return Math.max(tau_min_sec, Math.min(tau_max_sec, raw));
}

/**
 * Determine if a batch should be triggered
 */
export function shouldTriggerBatch(
  queueLength: number,
  oldestAge: number,
  bEff: number,
  tauEff: number
): { shouldTrigger: boolean; reason: string } {
  if (queueLength >= bEff) {
    return { shouldTrigger: true, reason: 'queue_ge_B_eff' };
  }
  if (oldestAge >= tauEff) {
    return { shouldTrigger: true, reason: 'oldest_age_exceeded_tau' };
  }
  return { shouldTrigger: false, reason: 'waiting' };
}

// ─────────────────────────────────────────
// METRICS CALCULATION
// ─────────────────────────────────────────

/**
 * Calculate arrival rate λ (orders per minute)
 * Uses EWMA for smoothing
 */
export function calculateLambda(
  arrivals: ArrivalRecord[],
  windowSec = 300,
  now?: Date
): { rate_per_min: number; count: number } {
  const currentTime = now || new Date();
  const windowStart = new Date(currentTime.getTime() - windowSec * 1000);

  const recentArrivals = arrivals.filter((a) => a.ts >= windowStart);
  const count = recentArrivals.length;

  if (count === 0) {
    return { rate_per_min: 0, count: 0 };
  }

  const rate_per_min = (count / windowSec) * 60;
  return { rate_per_min: round2(rate_per_min), count };
}

/**
 * Calculate utilization ρ = λ / (c * μ)
 * Where c = number of servers, μ = service rate
 */
export function calculateUtilization(
  lambdaPerMin: number,
  serverCount: number,
  avgServiceTimeSec: number
): number {
  if (serverCount === 0 || avgServiceTimeSec === 0) {
    return 0;
  }

  // μ = 60 / avgServiceTimeSec (services per minute per server)
  const mu = 60 / avgServiceTimeSec;

  // ρ = λ / (c * μ)
  const rho = lambdaPerMin / (serverCount * mu);

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, round2(rho)));
}

/**
 * Calculate percentiles from an array of values
 */
export function calculatePercentile(
  values: number[],
  percentile: number
): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculate multiple percentiles at once
 */
export function calculatePercentiles(
  values: number[]
): { p50: number; p90: number; p95: number; p99: number } {
  return {
    p50: calculatePercentile(values, 50),
    p90: calculatePercentile(values, 90),
    p95: calculatePercentile(values, 95),
    p99: calculatePercentile(values, 99),
  };
}

// ─────────────────────────────────────────
// GUARDRAIL EVALUATION
// ─────────────────────────────────────────

/**
 * Evaluate P95 status
 */
export function evaluateP95Status(
  p95Current: number,
  config: GuardrailConfig
): 'ok' | 'warning' | 'critical' {
  if (p95Current > config.p95_critical_sec) {
    return 'critical';
  }
  if (p95Current > config.p95_warning_sec) {
    return 'warning';
  }
  return 'ok';
}

/**
 * Evaluate utilization status
 */
export function evaluateUtilizationStatus(
  utilization: number,
  config: GuardrailConfig
): 'ok' | 'warning' | 'critical' {
  if (utilization >= config.utilization_critical) {
    return 'critical';
  }
  if (utilization >= config.utilization_warning) {
    return 'warning';
  }
  return 'ok';
}

/**
 * Check if circuit breaker should trigger
 */
export function shouldTriggerCircuitBreaker(
  queueLength: number,
  oldestAge: number,
  config: GuardrailConfig
): { trigger: boolean; reason: string | null } {
  if (queueLength > config.max_queue_length) {
    return { trigger: true, reason: 'queue_length_exceeded' };
  }
  if (oldestAge > config.max_oldest_age_sec) {
    return { trigger: true, reason: 'max_age_exceeded' };
  }
  return { trigger: false, reason: null };
}

// ─────────────────────────────────────────
// PRIORITY CALCULATION
// ─────────────────────────────────────────

/**
 * Calculate task priority based on age and queue state
 */
export function calculateTaskPriority(
  oldestAge: number,
  queueLength: number,
  maxAge: number,
  maxQueue: number,
  baseWeight = 50,
  ageWeight = 30,
  queueWeight = 10,
  maxPriority = 90
): number {
  const ageContribution = (oldestAge / maxAge) * ageWeight;
  const queueContribution = (queueLength / maxQueue) * queueWeight;

  return Math.min(maxPriority, baseWeight + ageContribution + queueContribution);
}

/**
 * Calculate priority with aging factor
 * Uses exponential aging for urgency
 */
export function calculateAgingPriority(
  baseScore: number,
  ageSec: number,
  halfLifeSec = 300
): number {
  // Exponential aging: priority doubles every halfLife seconds
  const agingFactor = Math.pow(2, ageSec / halfLifeSec);
  return round2(baseScore * agingFactor);
}

// ─────────────────────────────────────────
// STOCK FORECASTING
// ─────────────────────────────────────────

/**
 * Calculate target stock based on demand rate and horizon
 */
export function calculateTargetStock(
  ratePerMin: number,
  horizonMinutes: number,
  safetyFactor = 1.2
): number {
  return Math.ceil(ratePerMin * horizonMinutes * safetyFactor);
}

/**
 * Calculate stock deficit
 */
export function calculateStockDeficit(
  currentStock: number,
  targetStock: number
): number {
  return Math.max(0, targetStock - currentStock);
}

// ─────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────

/**
 * Round to 2 decimal places
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate EWMA (Exponentially Weighted Moving Average)
 */
export function calculateEWMA(
  currentValue: number,
  previousEWMA: number,
  alpha = 0.3
): number {
  return round2(alpha * currentValue + (1 - alpha) * previousEWMA);
}
