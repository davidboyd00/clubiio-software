// ============================================
// PURE UTILITY FUNCTIONS FOR ORDERS
// Extracted for testability
// ============================================

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface Payment {
  method: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
  amount: number;
  reference?: string;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  total: number;
  itemCount: number;
}

/**
 * Calculate order totals from items
 */
export function calculateOrderTotals(
  items: OrderItem[],
  discount = 0
): OrderTotals {
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    total: round2(subtotal - discount),
    itemCount,
  };
}

/**
 * Validate that payment amounts match order total
 * Returns null if valid, error message if invalid
 */
export function validatePayments(
  payments: Payment[],
  orderTotal: number,
  tolerance = 0.01
): string | null {
  if (payments.length === 0) {
    return 'At least one payment is required';
  }

  const paymentTotal = payments.reduce((sum, p) => sum + p.amount, 0);

  if (Math.abs(paymentTotal - orderTotal) > tolerance) {
    return `Payment total (${paymentTotal.toFixed(2)}) does not match order total (${orderTotal.toFixed(2)})`;
  }

  // Check for negative payments
  const hasNegative = payments.some((p) => p.amount < 0);
  if (hasNegative) {
    return 'Payment amounts cannot be negative';
  }

  return null;
}

/**
 * Calculate change for cash payments
 */
export function calculateChange(
  payments: Payment[],
  orderTotal: number
): number {
  const cashPayments = payments.filter((p) => p.method === 'CASH');
  const cashTotal = cashPayments.reduce((sum, p) => sum + p.amount, 0);
  const nonCashTotal = payments
    .filter((p) => p.method !== 'CASH')
    .reduce((sum, p) => sum + p.amount, 0);

  const amountDueCash = orderTotal - nonCashTotal;

  if (cashTotal > amountDueCash) {
    return round2(cashTotal - amountDueCash);
  }

  return 0;
}

/**
 * Split payments by method
 */
export function splitPaymentsByMethod(
  payments: Payment[]
): Record<string, number> {
  const byMethod: Record<string, number> = {};

  for (const payment of payments) {
    byMethod[payment.method] = (byMethod[payment.method] || 0) + payment.amount;
  }

  return byMethod;
}

/**
 * Generate order number for display
 * Format: YYYYMMDD-NNNN (e.g., 20240115-0042)
 */
export function formatOrderNumber(orderNumber: number, date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}${month}${day}-${String(orderNumber).padStart(4, '0')}`;
}

/**
 * Calculate item subtotal
 */
export function calculateItemSubtotal(item: OrderItem): number {
  return round2(item.unitPrice * item.quantity);
}

/**
 * Apply percentage discount to total
 */
export function applyPercentageDiscount(
  subtotal: number,
  percentage: number
): number {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Discount percentage must be between 0 and 100');
  }
  return round2(subtotal * (percentage / 100));
}

/**
 * Check if order can be voided based on time elapsed
 * Default: 24 hours
 */
export function canVoidOrder(
  orderDate: Date,
  maxHours = 24,
  now?: Date
): boolean {
  const currentTime = now || new Date();
  const elapsed = currentTime.getTime() - orderDate.getTime();
  const maxMs = maxHours * 60 * 60 * 1000;

  return elapsed <= maxMs;
}

/**
 * Calculate average order value
 */
export function calculateAverageOrderValue(
  totalRevenue: number,
  orderCount: number
): number {
  if (orderCount === 0) return 0;
  return round2(totalRevenue / orderCount);
}

/**
 * Round to 2 decimal places (for currency)
 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Validate order items
 * Returns array of errors, empty if valid
 */
export function validateOrderItems(items: OrderItem[]): string[] {
  const errors: string[] = [];

  if (items.length === 0) {
    errors.push('Order must have at least one item');
    return errors;
  }

  items.forEach((item, index) => {
    if (item.quantity <= 0) {
      errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
    }
    if (item.unitPrice < 0) {
      errors.push(`Item ${index + 1}: Unit price cannot be negative`);
    }
    if (!item.productId) {
      errors.push(`Item ${index + 1}: Product ID is required`);
    }
  });

  return errors;
}
