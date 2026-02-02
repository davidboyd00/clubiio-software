// ============================================
// PURE UTILITY FUNCTIONS FOR CASH SESSIONS
// Extracted for testability
// ============================================

export interface CashMovement {
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'SALE' | 'ADJUSTMENT';
  amount: number;
}

export interface PaymentSummary {
  method: string;
  amount: number;
}

export interface SessionBalance {
  initialAmount: number;
  cashSales: number;
  deposits: number;
  withdrawals: number;
  adjustments: number;
  expectedCash: number;
}

/**
 * Calculate expected cash in drawer
 */
export function calculateExpectedCash(
  initialAmount: number,
  cashSales: number,
  deposits: number,
  withdrawals: number,
  adjustments: number
): number {
  return round2(
    initialAmount + cashSales + deposits - withdrawals + adjustments
  );
}

/**
 * Calculate session balance from movements
 */
export function calculateSessionBalance(
  initialAmount: number,
  movements: CashMovement[],
  cashSalesTotal: number
): SessionBalance {
  let deposits = 0;
  let withdrawals = 0;
  let adjustments = 0;

  for (const movement of movements) {
    switch (movement.type) {
      case 'DEPOSIT':
        deposits += movement.amount;
        break;
      case 'WITHDRAWAL':
        withdrawals += movement.amount;
        break;
      case 'ADJUSTMENT':
        adjustments += movement.amount;
        break;
      // SALE movements are tracked separately via cashSalesTotal
    }
  }

  const expectedCash = calculateExpectedCash(
    initialAmount,
    cashSalesTotal,
    deposits,
    withdrawals,
    adjustments
  );

  return {
    initialAmount: round2(initialAmount),
    cashSales: round2(cashSalesTotal),
    deposits: round2(deposits),
    withdrawals: round2(withdrawals),
    adjustments: round2(adjustments),
    expectedCash,
  };
}

/**
 * Calculate cash difference (actual - expected)
 * Positive = overage, Negative = shortage
 */
export function calculateDifference(
  actualAmount: number,
  expectedAmount: number
): number {
  return round2(actualAmount - expectedAmount);
}

/**
 * Check if cash difference is within acceptable threshold
 */
export function isDifferenceAcceptable(
  difference: number,
  threshold = 5
): boolean {
  return Math.abs(difference) <= threshold;
}

/**
 * Validate withdrawal amount against available cash
 */
export function canWithdraw(
  withdrawalAmount: number,
  expectedCash: number
): boolean {
  return withdrawalAmount > 0 && withdrawalAmount <= expectedCash;
}

/**
 * Calculate cash sales from payment summaries
 */
export function extractCashSales(payments: PaymentSummary[]): number {
  const cashPayment = payments.find((p) => p.method === 'CASH');
  return cashPayment ? round2(cashPayment.amount) : 0;
}

/**
 * Format currency for display
 */
export function formatCurrency(
  amount: number,
  currency = 'CLP',
  locale = 'es-CL'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calculate session duration in minutes
 */
export function calculateSessionDuration(
  openedAt: Date,
  closedAt?: Date
): number {
  const end = closedAt || new Date();
  const durationMs = end.getTime() - openedAt.getTime();
  return Math.round(durationMs / (1000 * 60));
}

/**
 * Format session duration for display
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }

  return `${hours}h ${mins}m`;
}

/**
 * Calculate orders per hour rate
 */
export function calculateOrdersPerHour(
  orderCount: number,
  durationMinutes: number
): number {
  if (durationMinutes === 0) return 0;
  return round2((orderCount / durationMinutes) * 60);
}

/**
 * Calculate revenue per hour rate
 */
export function calculateRevenuePerHour(
  totalRevenue: number,
  durationMinutes: number
): number {
  if (durationMinutes === 0) return 0;
  return round2((totalRevenue / durationMinutes) * 60);
}

/**
 * Determine session status based on difference
 */
export function getSessionStatus(
  difference: number,
  threshold = 5
): 'balanced' | 'overage' | 'shortage' {
  if (Math.abs(difference) <= threshold) {
    return 'balanced';
  }
  return difference > 0 ? 'overage' : 'shortage';
}

/**
 * Round to 2 decimal places
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Validate initial amount
 */
export function validateInitialAmount(amount: number): string | null {
  if (amount < 0) {
    return 'Initial amount cannot be negative';
  }
  return null;
}

/**
 * Calculate movement totals by type
 */
export function calculateMovementTotals(
  movements: CashMovement[]
): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const movement of movements) {
    totals[movement.type] = (totals[movement.type] || 0) + movement.amount;
  }

  return totals;
}
