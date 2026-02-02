import { describe, it, expect } from 'vitest';
import {
  calculateExpectedCash,
  calculateSessionBalance,
  calculateDifference,
  isDifferenceAcceptable,
  canWithdraw,
  extractCashSales,
  formatCurrency,
  calculateSessionDuration,
  formatDuration,
  calculateOrdersPerHour,
  calculateRevenuePerHour,
  getSessionStatus,
  validateInitialAmount,
  calculateMovementTotals,
  CashMovement,
  PaymentSummary,
} from './cash-sessions.utils';

describe('Cash Sessions Utils', () => {
  // ─────────────────────────────────────────
  // EXPECTED CASH CALCULATION
  // ─────────────────────────────────────────
  describe('calculateExpectedCash', () => {
    it('should calculate expected cash correctly', () => {
      // Initial: 100, Sales: 500, Deposits: 50, Withdrawals: 100, Adjustments: -10
      const expected = calculateExpectedCash(100, 500, 50, 100, -10);
      expect(expected).toBe(540);
    });

    it('should handle zero values', () => {
      const expected = calculateExpectedCash(0, 0, 0, 0, 0);
      expect(expected).toBe(0);
    });

    it('should handle only initial amount', () => {
      const expected = calculateExpectedCash(100, 0, 0, 0, 0);
      expect(expected).toBe(100);
    });

    it('should handle negative adjustments', () => {
      const expected = calculateExpectedCash(100, 0, 0, 0, -50);
      expect(expected).toBe(50);
    });
  });

  // ─────────────────────────────────────────
  // SESSION BALANCE
  // ─────────────────────────────────────────
  describe('calculateSessionBalance', () => {
    it('should calculate balance from movements', () => {
      const movements: CashMovement[] = [
        { type: 'DEPOSIT', amount: 100 },
        { type: 'WITHDRAWAL', amount: 50 },
        { type: 'ADJUSTMENT', amount: -10 },
      ];

      const balance = calculateSessionBalance(200, movements, 500);

      expect(balance.initialAmount).toBe(200);
      expect(balance.cashSales).toBe(500);
      expect(balance.deposits).toBe(100);
      expect(balance.withdrawals).toBe(50);
      expect(balance.adjustments).toBe(-10);
      expect(balance.expectedCash).toBe(740); // 200 + 500 + 100 - 50 - 10
    });

    it('should handle empty movements', () => {
      const balance = calculateSessionBalance(100, [], 200);

      expect(balance.initialAmount).toBe(100);
      expect(balance.cashSales).toBe(200);
      expect(balance.deposits).toBe(0);
      expect(balance.withdrawals).toBe(0);
      expect(balance.adjustments).toBe(0);
      expect(balance.expectedCash).toBe(300);
    });
  });

  // ─────────────────────────────────────────
  // DIFFERENCE CALCULATION
  // ─────────────────────────────────────────
  describe('calculateDifference', () => {
    it('should calculate overage correctly', () => {
      const diff = calculateDifference(550, 540);
      expect(diff).toBe(10);
    });

    it('should calculate shortage correctly', () => {
      const diff = calculateDifference(530, 540);
      expect(diff).toBe(-10);
    });

    it('should handle exact match', () => {
      const diff = calculateDifference(540, 540);
      expect(diff).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // DIFFERENCE THRESHOLD
  // ─────────────────────────────────────────
  describe('isDifferenceAcceptable', () => {
    it('should accept differences within threshold', () => {
      expect(isDifferenceAcceptable(3, 5)).toBe(true);
      expect(isDifferenceAcceptable(-3, 5)).toBe(true);
      expect(isDifferenceAcceptable(5, 5)).toBe(true);
    });

    it('should reject differences outside threshold', () => {
      expect(isDifferenceAcceptable(6, 5)).toBe(false);
      expect(isDifferenceAcceptable(-6, 5)).toBe(false);
    });

    it('should use default threshold of 5', () => {
      expect(isDifferenceAcceptable(5)).toBe(true);
      expect(isDifferenceAcceptable(6)).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // WITHDRAWAL VALIDATION
  // ─────────────────────────────────────────
  describe('canWithdraw', () => {
    it('should allow valid withdrawals', () => {
      expect(canWithdraw(100, 500)).toBe(true);
      expect(canWithdraw(500, 500)).toBe(true);
    });

    it('should reject withdrawals exceeding available cash', () => {
      expect(canWithdraw(600, 500)).toBe(false);
    });

    it('should reject zero or negative withdrawals', () => {
      expect(canWithdraw(0, 500)).toBe(false);
      expect(canWithdraw(-100, 500)).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // CASH SALES EXTRACTION
  // ─────────────────────────────────────────
  describe('extractCashSales', () => {
    it('should extract cash payment amount', () => {
      const payments: PaymentSummary[] = [
        { method: 'CASH', amount: 500 },
        { method: 'CARD', amount: 300 },
      ];

      expect(extractCashSales(payments)).toBe(500);
    });

    it('should return 0 if no cash payments', () => {
      const payments: PaymentSummary[] = [{ method: 'CARD', amount: 300 }];

      expect(extractCashSales(payments)).toBe(0);
    });

    it('should handle empty payments', () => {
      expect(extractCashSales([])).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // CURRENCY FORMATTING
  // ─────────────────────────────────────────
  describe('formatCurrency', () => {
    it('should format CLP correctly', () => {
      const formatted = formatCurrency(1500, 'CLP', 'es-CL');
      expect(formatted).toContain('1.500');
    });

    it('should handle large amounts', () => {
      const formatted = formatCurrency(1000000, 'CLP', 'es-CL');
      expect(formatted).toContain('1.000.000');
    });
  });

  // ─────────────────────────────────────────
  // SESSION DURATION
  // ─────────────────────────────────────────
  describe('calculateSessionDuration', () => {
    it('should calculate duration in minutes', () => {
      const opened = new Date('2024-01-15T10:00:00');
      const closed = new Date('2024-01-15T14:30:00');

      const duration = calculateSessionDuration(opened, closed);

      expect(duration).toBe(270); // 4.5 hours = 270 minutes
    });

    it('should use current time if not closed', () => {
      const opened = new Date();
      opened.setMinutes(opened.getMinutes() - 60);

      const duration = calculateSessionDuration(opened);

      expect(duration).toBeGreaterThanOrEqual(59);
      expect(duration).toBeLessThanOrEqual(61);
    });
  });

  // ─────────────────────────────────────────
  // DURATION FORMATTING
  // ─────────────────────────────────────────
  describe('formatDuration', () => {
    it('should format minutes only', () => {
      expect(formatDuration(45)).toBe('45m');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(90)).toBe('1h 30m');
      expect(formatDuration(270)).toBe('4h 30m');
    });

    it('should handle exact hours', () => {
      expect(formatDuration(120)).toBe('2h 0m');
    });
  });

  // ─────────────────────────────────────────
  // RATES CALCULATION
  // ─────────────────────────────────────────
  describe('calculateOrdersPerHour', () => {
    it('should calculate orders per hour', () => {
      expect(calculateOrdersPerHour(120, 120)).toBe(60); // 120 orders in 2 hours
      expect(calculateOrdersPerHour(30, 60)).toBe(30); // 30 orders in 1 hour
    });

    it('should handle zero duration', () => {
      expect(calculateOrdersPerHour(10, 0)).toBe(0);
    });
  });

  describe('calculateRevenuePerHour', () => {
    it('should calculate revenue per hour', () => {
      expect(calculateRevenuePerHour(60000, 120)).toBe(30000); // $60k in 2 hours
    });

    it('should handle zero duration', () => {
      expect(calculateRevenuePerHour(1000, 0)).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // SESSION STATUS
  // ─────────────────────────────────────────
  describe('getSessionStatus', () => {
    it('should return balanced for small differences', () => {
      expect(getSessionStatus(0)).toBe('balanced');
      expect(getSessionStatus(3)).toBe('balanced');
      expect(getSessionStatus(-3)).toBe('balanced');
    });

    it('should return overage for positive large differences', () => {
      expect(getSessionStatus(10)).toBe('overage');
    });

    it('should return shortage for negative large differences', () => {
      expect(getSessionStatus(-10)).toBe('shortage');
    });
  });

  // ─────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────
  describe('validateInitialAmount', () => {
    it('should accept valid amounts', () => {
      expect(validateInitialAmount(0)).toBeNull();
      expect(validateInitialAmount(100)).toBeNull();
    });

    it('should reject negative amounts', () => {
      expect(validateInitialAmount(-10)).toBe('Initial amount cannot be negative');
    });
  });

  // ─────────────────────────────────────────
  // MOVEMENT TOTALS
  // ─────────────────────────────────────────
  describe('calculateMovementTotals', () => {
    it('should calculate totals by type', () => {
      const movements: CashMovement[] = [
        { type: 'DEPOSIT', amount: 100 },
        { type: 'DEPOSIT', amount: 50 },
        { type: 'WITHDRAWAL', amount: 30 },
        { type: 'ADJUSTMENT', amount: -10 },
      ];

      const totals = calculateMovementTotals(movements);

      expect(totals.DEPOSIT).toBe(150);
      expect(totals.WITHDRAWAL).toBe(30);
      expect(totals.ADJUSTMENT).toBe(-10);
    });

    it('should handle empty movements', () => {
      const totals = calculateMovementTotals([]);
      expect(Object.keys(totals)).toHaveLength(0);
    });
  });
});
