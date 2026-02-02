import { describe, it, expect } from 'vitest';
import {
  calculateOrderTotals,
  validatePayments,
  calculateChange,
  splitPaymentsByMethod,
  formatOrderNumber,
  calculateItemSubtotal,
  applyPercentageDiscount,
  canVoidOrder,
  calculateAverageOrderValue,
  round2,
  validateOrderItems,
  OrderItem,
  Payment,
} from './orders.utils';

describe('Orders Utils', () => {
  // ─────────────────────────────────────────
  // ORDER TOTALS
  // ─────────────────────────────────────────
  describe('calculateOrderTotals', () => {
    it('should calculate totals correctly', () => {
      const items: OrderItem[] = [
        { productId: 'p1', quantity: 2, unitPrice: 10 },
        { productId: 'p2', quantity: 1, unitPrice: 15 },
      ];

      const totals = calculateOrderTotals(items);

      expect(totals.subtotal).toBe(35);
      expect(totals.total).toBe(35);
      expect(totals.discount).toBe(0);
      expect(totals.itemCount).toBe(3);
    });

    it('should apply discount correctly', () => {
      const items: OrderItem[] = [
        { productId: 'p1', quantity: 2, unitPrice: 10 },
      ];

      const totals = calculateOrderTotals(items, 5);

      expect(totals.subtotal).toBe(20);
      expect(totals.discount).toBe(5);
      expect(totals.total).toBe(15);
    });

    it('should handle empty items', () => {
      const totals = calculateOrderTotals([]);

      expect(totals.subtotal).toBe(0);
      expect(totals.total).toBe(0);
      expect(totals.itemCount).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      const items: OrderItem[] = [
        { productId: 'p1', quantity: 3, unitPrice: 9.99 },
      ];

      const totals = calculateOrderTotals(items);

      expect(totals.subtotal).toBe(29.97);
    });
  });

  // ─────────────────────────────────────────
  // PAYMENT VALIDATION
  // ─────────────────────────────────────────
  describe('validatePayments', () => {
    it('should accept valid payments matching total', () => {
      const payments: Payment[] = [{ method: 'CASH', amount: 50 }];

      const error = validatePayments(payments, 50);

      expect(error).toBeNull();
    });

    it('should accept multiple payments matching total', () => {
      const payments: Payment[] = [
        { method: 'CASH', amount: 30 },
        { method: 'CARD', amount: 20 },
      ];

      const error = validatePayments(payments, 50);

      expect(error).toBeNull();
    });

    it('should reject empty payments', () => {
      const error = validatePayments([], 50);

      expect(error).toBe('At least one payment is required');
    });

    it('should reject mismatched totals', () => {
      const payments: Payment[] = [{ method: 'CASH', amount: 40 }];

      const error = validatePayments(payments, 50);

      expect(error).toContain('does not match');
    });

    it('should allow small tolerance for rounding', () => {
      const payments: Payment[] = [{ method: 'CASH', amount: 50.005 }];

      const error = validatePayments(payments, 50);

      expect(error).toBeNull();
    });

    it('should reject negative payments', () => {
      const payments: Payment[] = [{ method: 'CASH', amount: -10 }];

      const error = validatePayments(payments, -10);

      expect(error).toBe('Payment amounts cannot be negative');
    });
  });

  // ─────────────────────────────────────────
  // CHANGE CALCULATION
  // ─────────────────────────────────────────
  describe('calculateChange', () => {
    it('should calculate change for cash overpayment', () => {
      const payments: Payment[] = [{ method: 'CASH', amount: 100 }];

      const change = calculateChange(payments, 75);

      expect(change).toBe(25);
    });

    it('should return 0 for exact payment', () => {
      const payments: Payment[] = [{ method: 'CASH', amount: 50 }];

      const change = calculateChange(payments, 50);

      expect(change).toBe(0);
    });

    it('should handle mixed payments', () => {
      const payments: Payment[] = [
        { method: 'CARD', amount: 30 },
        { method: 'CASH', amount: 50 },
      ];

      const change = calculateChange(payments, 70);

      expect(change).toBe(10); // Cash covers 40, gave 50, change is 10
    });

    it('should return 0 for card-only payments', () => {
      const payments: Payment[] = [{ method: 'CARD', amount: 50 }];

      const change = calculateChange(payments, 50);

      expect(change).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // PAYMENT SPLIT
  // ─────────────────────────────────────────
  describe('splitPaymentsByMethod', () => {
    it('should split payments by method', () => {
      const payments: Payment[] = [
        { method: 'CASH', amount: 30 },
        { method: 'CARD', amount: 20 },
        { method: 'CASH', amount: 10 },
      ];

      const split = splitPaymentsByMethod(payments);

      expect(split.CASH).toBe(40);
      expect(split.CARD).toBe(20);
    });

    it('should handle empty payments', () => {
      const split = splitPaymentsByMethod([]);

      expect(Object.keys(split)).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────
  // ORDER NUMBER FORMATTING
  // ─────────────────────────────────────────
  describe('formatOrderNumber', () => {
    it('should format order number correctly', () => {
      const date = new Date(2024, 0, 15); // Jan 15, 2024 local time
      const formatted = formatOrderNumber(42, date);

      expect(formatted).toBe('20240115-0042');
    });

    it('should pad order numbers', () => {
      const date = new Date(2024, 11, 1); // Dec 1, 2024 local time

      expect(formatOrderNumber(1, date)).toBe('20241201-0001');
      expect(formatOrderNumber(999, date)).toBe('20241201-0999');
      expect(formatOrderNumber(9999, date)).toBe('20241201-9999');
    });
  });

  // ─────────────────────────────────────────
  // ITEM SUBTOTAL
  // ─────────────────────────────────────────
  describe('calculateItemSubtotal', () => {
    it('should calculate item subtotal', () => {
      const item: OrderItem = { productId: 'p1', quantity: 3, unitPrice: 9.99 };

      expect(calculateItemSubtotal(item)).toBe(29.97);
    });

    it('should handle single quantity', () => {
      const item: OrderItem = { productId: 'p1', quantity: 1, unitPrice: 15.5 };

      expect(calculateItemSubtotal(item)).toBe(15.5);
    });
  });

  // ─────────────────────────────────────────
  // PERCENTAGE DISCOUNT
  // ─────────────────────────────────────────
  describe('applyPercentageDiscount', () => {
    it('should calculate percentage discount', () => {
      expect(applyPercentageDiscount(100, 10)).toBe(10);
      expect(applyPercentageDiscount(100, 25)).toBe(25);
      expect(applyPercentageDiscount(50, 50)).toBe(25);
    });

    it('should handle 0% discount', () => {
      expect(applyPercentageDiscount(100, 0)).toBe(0);
    });

    it('should handle 100% discount', () => {
      expect(applyPercentageDiscount(100, 100)).toBe(100);
    });

    it('should throw for invalid percentages', () => {
      expect(() => applyPercentageDiscount(100, -10)).toThrow();
      expect(() => applyPercentageDiscount(100, 110)).toThrow();
    });
  });

  // ─────────────────────────────────────────
  // VOID ORDER CHECK
  // ─────────────────────────────────────────
  describe('canVoidOrder', () => {
    it('should allow voiding recent orders', () => {
      const orderDate = new Date();
      orderDate.setHours(orderDate.getHours() - 1); // 1 hour ago

      expect(canVoidOrder(orderDate, 24)).toBe(true);
    });

    it('should reject voiding old orders', () => {
      const orderDate = new Date();
      orderDate.setHours(orderDate.getHours() - 25); // 25 hours ago

      expect(canVoidOrder(orderDate, 24)).toBe(false);
    });

    it('should respect custom time limit', () => {
      const orderDate = new Date();
      orderDate.setHours(orderDate.getHours() - 2); // 2 hours ago

      expect(canVoidOrder(orderDate, 1)).toBe(false);
      expect(canVoidOrder(orderDate, 3)).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // AVERAGE ORDER VALUE
  // ─────────────────────────────────────────
  describe('calculateAverageOrderValue', () => {
    it('should calculate average correctly', () => {
      expect(calculateAverageOrderValue(1000, 10)).toBe(100);
      expect(calculateAverageOrderValue(333, 3)).toBe(111);
    });

    it('should handle zero orders', () => {
      expect(calculateAverageOrderValue(0, 0)).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      expect(calculateAverageOrderValue(100, 3)).toBe(33.33);
    });
  });

  // ─────────────────────────────────────────
  // ROUNDING
  // ─────────────────────────────────────────
  describe('round2', () => {
    it('should round to 2 decimal places', () => {
      expect(round2(10.555)).toBe(10.56);
      expect(round2(10.554)).toBe(10.55);
      expect(round2(10.5)).toBe(10.5);
      expect(round2(10)).toBe(10);
    });
  });

  // ─────────────────────────────────────────
  // ORDER ITEM VALIDATION
  // ─────────────────────────────────────────
  describe('validateOrderItems', () => {
    it('should accept valid items', () => {
      const items: OrderItem[] = [
        { productId: 'p1', quantity: 2, unitPrice: 10 },
      ];

      const errors = validateOrderItems(items);

      expect(errors).toHaveLength(0);
    });

    it('should reject empty items', () => {
      const errors = validateOrderItems([]);

      expect(errors).toContain('Order must have at least one item');
    });

    it('should reject zero quantity', () => {
      const items: OrderItem[] = [
        { productId: 'p1', quantity: 0, unitPrice: 10 },
      ];

      const errors = validateOrderItems(items);

      expect(errors.some((e) => e.includes('Quantity'))).toBe(true);
    });

    it('should reject negative price', () => {
      const items: OrderItem[] = [
        { productId: 'p1', quantity: 1, unitPrice: -10 },
      ];

      const errors = validateOrderItems(items);

      expect(errors.some((e) => e.includes('Unit price'))).toBe(true);
    });

    it('should reject missing product ID', () => {
      const items: OrderItem[] = [
        { productId: '', quantity: 1, unitPrice: 10 },
      ];

      const errors = validateOrderItems(items);

      expect(errors.some((e) => e.includes('Product ID'))).toBe(true);
    });
  });
});
