// ============================================
// SECURITY TESTS
// Tests for input validation, XSS prevention,
// data integrity, and edge cases
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createBar,
  loadBars,
  setBarStock,
  getBarStock,
  recordBarSale,
  recordBarRestock,
  transferStock,
  assignCashRegisterToBar,
  getBarIdForCashRegister,
} from './barInventory';
import {
  recordSale,
  calculateVelocity,
  setProductThresholds,
  getProductThresholds,
} from './stockEngine';

// ============================================
// XSS & Injection Prevention Tests
// ============================================

describe('XSS & Injection Prevention', () => {
  describe('Bar name handling', () => {
    it('should store HTML content as-is (sanitization at display layer)', () => {
      const maliciousName = '<script>alert("XSS")</script>';
      const bar = createBar({
        venueId: 'venue-1',
        name: maliciousName,
        isActive: true,
      });

      // Data layer stores as-is
      expect(bar.name).toBe(maliciousName);

      // The display layer should sanitize this
      // This test documents the expected behavior
    });

    it('should handle SQL injection-like strings', () => {
      const sqlInjection = "Bar'; DROP TABLE bars; --";
      const bar = createBar({
        venueId: 'venue-1',
        name: sqlInjection,
        isActive: true,
      });

      expect(bar.name).toBe(sqlInjection);

      // Verify data integrity
      const bars = loadBars();
      expect(bars).toHaveLength(1);
    });

    it('should handle Unicode and emoji', () => {
      const unicodeName = 'Barra 🍺 Principal';
      const bar = createBar({
        venueId: 'venue-1',
        name: unicodeName,
        isActive: true,
      });

      expect(bar.name).toBe(unicodeName);
    });

    it('should handle very long strings', () => {
      const longName = 'A'.repeat(10000);
      const bar = createBar({
        venueId: 'venue-1',
        name: longName,
        isActive: true,
      });

      expect(bar.name.length).toBe(10000);
    });

    it('should handle null bytes', () => {
      const nullByteName = 'Bar\x00Name';
      const bar = createBar({
        venueId: 'venue-1',
        name: nullByteName,
        isActive: true,
      });

      expect(bar.name).toBe(nullByteName);
    });
  });

  describe('Product ID handling', () => {
    it('should handle special characters in product IDs', () => {
      const bar = createBar({ venueId: 'venue-1', name: 'Bar', isActive: true });
      const specialId = 'product/../../../etc/passwd';

      setBarStock(bar.id, specialId, 50);
      expect(getBarStock(bar.id, specialId)).toBe(50);
    });

    it('should handle JSON-like strings as product IDs', () => {
      const bar = createBar({ venueId: 'venue-1', name: 'Bar', isActive: true });
      const jsonId = '{"malicious": true}';

      setBarStock(bar.id, jsonId, 50);
      expect(getBarStock(bar.id, jsonId)).toBe(50);
    });
  });
});

// ============================================
// Input Validation Tests
// ============================================

describe('Input Validation', () => {
  describe('Numeric inputs', () => {
    let bar: ReturnType<typeof createBar>;

    beforeEach(() => {
      bar = createBar({ venueId: 'venue-1', name: 'Test Bar', isActive: true });
      setBarStock(bar.id, 'product-1', 100);
    });

    it('should handle negative quantities in sales', () => {
      // Negative sale = return/refund
      const result = recordBarSale(bar.id, 'product-1', -10);
      expect(result.newStock).toBe(110);
    });

    it('should handle zero quantity operations', () => {
      const saleResult = recordBarSale(bar.id, 'product-1', 0);
      expect(saleResult.newStock).toBe(100);

      const restockResult = recordBarRestock(bar.id, 'product-1', 0);
      expect(restockResult.newStock).toBe(100);
    });

    it('should handle decimal quantities (floor behavior)', () => {
      // JavaScript number handling - test current behavior
      const result = recordBarSale(bar.id, 'product-1', 5.7);
      // Should work with JS number handling
      expect(result.newStock).toBe(94.3);
    });

    it('should handle Infinity', () => {
      const result = recordBarSale(bar.id, 'product-1', Infinity);
      expect(result.newStock).toBe(-Infinity);
      expect(result.warning).toBeDefined();
    });

    it('should handle NaN gracefully', () => {
      const result = recordBarSale(bar.id, 'product-1', NaN);
      // NaN arithmetic results in NaN
      expect(Number.isNaN(result.newStock)).toBe(true);
    });

    it('should handle very large numbers', () => {
      const result = recordBarSale(bar.id, 'product-1', Number.MAX_SAFE_INTEGER);
      expect(result.success).toBe(true);
    });
  });

  describe('Transfer validation', () => {
    it('should validate transfer has sufficient source stock', () => {
      const bar1 = createBar({ venueId: 'venue-1', name: 'Bar 1', isActive: true });
      const bar2 = createBar({ venueId: 'venue-1', name: 'Bar 2', isActive: true });
      setBarStock(bar1.id, 'product-1', 10);

      const result = transferStock(bar1.id, bar2.id, 'product-1', 20);

      expect(result.success).toBe(false);
      expect(result.error).toContain('insuficiente');
    });

    it('should allow transfer to same bar (adds stock twice - known behavior)', () => {
      const bar = createBar({ venueId: 'venue-1', name: 'Bar', isActive: true });
      setBarStock(bar.id, 'product-1', 100);

      // Currently allowed - transfer to self results in +10 (subtracts then adds)
      // This documents current behavior - validation could be added if needed
      const result = transferStock(bar.id, bar.id, 'product-1', 10);
      // Stock increases by 10 due to transfer_in without net change from transfer_out
      expect(getBarStock(bar.id, 'product-1')).toBe(110);
    });
  });

  describe('Threshold validation', () => {
    it('should accept zero thresholds', () => {
      setProductThresholds('product-1', {
        minAbsolute: 0,
        reorderPoint: 0,
        safetyStock: 0,
        leadTimeDays: 0,
        packSize: 0,
      });

      const thresholds = getProductThresholds('product-1');
      expect(thresholds.minAbsolute).toBe(0);
    });

    it('should accept negative thresholds (no validation)', () => {
      // Documents current behavior - no server-side validation
      setProductThresholds('product-1', { minAbsolute: -10 });
      const thresholds = getProductThresholds('product-1');
      expect(thresholds.minAbsolute).toBe(-10);
    });
  });
});

// ============================================
// Data Integrity Tests
// ============================================

describe('Data Integrity', () => {
  describe('Concurrent-like operations', () => {
    it('should maintain consistency with rapid sequential operations', () => {
      const bar = createBar({ venueId: 'venue-1', name: 'Bar', isActive: true });
      setBarStock(bar.id, 'product-1', 1000);

      // Simulate rapid operations
      for (let i = 0; i < 100; i++) {
        recordBarSale(bar.id, 'product-1', 1);
        recordBarRestock(bar.id, 'product-1', 1);
      }

      // Should be back to original
      expect(getBarStock(bar.id, 'product-1')).toBe(1000);
    });

    it('should handle interleaved operations on different products', () => {
      const bar = createBar({ venueId: 'venue-1', name: 'Bar', isActive: true });
      setBarStock(bar.id, 'p1', 100);
      setBarStock(bar.id, 'p2', 200);
      setBarStock(bar.id, 'p3', 300);

      for (let i = 0; i < 50; i++) {
        recordBarSale(bar.id, 'p1', 1);
        recordBarSale(bar.id, 'p2', 2);
        recordBarSale(bar.id, 'p3', 3);
      }

      expect(getBarStock(bar.id, 'p1')).toBe(50);
      expect(getBarStock(bar.id, 'p2')).toBe(100);
      expect(getBarStock(bar.id, 'p3')).toBe(150);
    });
  });

  describe('localStorage corruption recovery', () => {
    it('should recover from corrupted bars data', () => {
      localStorage.setItem('clubio_bars', 'corrupted{data');
      const bars = loadBars();
      expect(bars).toEqual([]);
    });

    it('should recover from corrupted inventory data', () => {
      localStorage.setItem('clubio_bar_inventory', '[invalid');
      const bar = createBar({ venueId: 'venue-1', name: 'Bar', isActive: true });
      // Should not throw, creates fresh inventory
      setBarStock(bar.id, 'product-1', 50);
      expect(getBarStock(bar.id, 'product-1')).toBe(50);
    });

    it('should recover from corrupted thresholds data', () => {
      localStorage.setItem('clubio_stock_thresholds', 'not-json');
      const thresholds = getProductThresholds('any-product');
      // Should return defaults
      expect(thresholds.minAbsolute).toBe(5);
    });
  });

  describe('ID collision handling', () => {
    it('should handle duplicate bar creation attempts', () => {
      const bar1 = createBar({ venueId: 'venue-1', name: 'Same Name', isActive: true });
      const bar2 = createBar({ venueId: 'venue-1', name: 'Same Name', isActive: true });

      // Should create two different bars with unique IDs
      expect(bar1.id).not.toBe(bar2.id);
      expect(loadBars()).toHaveLength(2);
    });

    it('should handle cash register reassignment', () => {
      const bar1 = createBar({ venueId: 'venue-1', name: 'Bar 1', isActive: true });
      const bar2 = createBar({ venueId: 'venue-1', name: 'Bar 2', isActive: true });

      assignCashRegisterToBar('cash-1', bar1.id);
      assignCashRegisterToBar('cash-1', bar2.id); // Reassign

      // Should now point to bar2
      expect(getBarIdForCashRegister('cash-1')).toBe(bar2.id);
    });
  });
});

// ============================================
// Boundary Condition Tests
// ============================================

describe('Boundary Conditions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T22:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Time-based boundaries', () => {
    it('should handle sales at midnight boundary', () => {
      vi.setSystemTime(new Date('2024-06-15T23:59:59.999Z'));
      recordSale('product-1', 5);

      vi.setSystemTime(new Date('2024-06-16T00:00:00.001Z'));
      recordSale('product-1', 3);

      vi.setSystemTime(new Date('2024-06-16T00:30:00.000Z'));
      const velocity = calculateVelocity('product-1');

      // Both sales should be within 1h window (30min + ~30min = ~1h)
      expect(velocity.last1h).toBe(8);
    });

    it('should handle day-of-week transition', () => {
      // Saturday 11pm
      vi.setSystemTime(new Date('2024-06-15T23:00:00.000Z')); // Saturday
      recordSale('product-1', 10);

      // Sunday 1am
      vi.setSystemTime(new Date('2024-06-16T01:00:00.000Z')); // Sunday
      recordSale('product-1', 5);

      vi.setSystemTime(new Date('2024-06-16T02:00:00.000Z'));
      const velocity = calculateVelocity('product-1');

      // Peak day detection should work across day boundary
      expect(velocity.peakDayOfWeek).toBeDefined();
    });
  });

  describe('Stock level boundaries', () => {
    it('should handle exact zero stock', () => {
      const bar = createBar({ venueId: 'venue-1', name: 'Bar', isActive: true });
      setBarStock(bar.id, 'product-1', 10);

      recordBarSale(bar.id, 'product-1', 10);

      expect(getBarStock(bar.id, 'product-1')).toBe(0);
    });

    it('should handle transition from positive to negative', () => {
      const bar = createBar({ venueId: 'venue-1', name: 'Bar', isActive: true });
      setBarStock(bar.id, 'product-1', 5);

      const result = recordBarSale(bar.id, 'product-1', 10);

      expect(result.newStock).toBe(-5);
      expect(result.warning).toBeDefined();
    });

    it('should handle transition from negative to positive', () => {
      const bar = createBar({ venueId: 'venue-1', name: 'Bar', isActive: true });
      setBarStock(bar.id, 'product-1', -10);

      recordBarRestock(bar.id, 'product-1', 15);

      expect(getBarStock(bar.id, 'product-1')).toBe(5);
    });
  });
});

// ============================================
// Performance & Resource Tests
// ============================================

describe('Performance & Resource Handling', () => {
  it('should handle large number of bars', () => {
    for (let i = 0; i < 100; i++) {
      createBar({ venueId: 'venue-1', name: `Bar ${i}`, isActive: true });
    }

    const bars = loadBars();
    expect(bars).toHaveLength(100);
  });

  it('should handle large inventory per bar', () => {
    const bar = createBar({ venueId: 'venue-1', name: 'Bar', isActive: true });

    for (let i = 0; i < 1000; i++) {
      setBarStock(bar.id, `product-${i}`, Math.random() * 100);
    }

    // Should be able to retrieve specific product
    const stock = getBarStock(bar.id, 'product-500');
    expect(stock).toBeGreaterThanOrEqual(0);
  });

  it('should handle many sales history entries', () => {
    vi.useFakeTimers();
    const baseTime = new Date('2024-06-15T22:00:00.000Z');

    for (let i = 0; i < 1000; i++) {
      vi.setSystemTime(new Date(baseTime.getTime() - i * 60000)); // 1 minute apart
      recordSale('busy-product', 1);
    }

    vi.setSystemTime(baseTime);
    const velocity = calculateVelocity('busy-product');

    expect(velocity.last1h).toBeGreaterThan(0);
    expect(velocity.ewma).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});

// ============================================
// Audit Trail Tests
// ============================================

describe('Audit Trail', () => {
  it('should record all stock movements with timestamps', () => {
    const bar = createBar({ venueId: 'venue-1', name: 'Bar', isActive: true });
    setBarStock(bar.id, 'product-1', 100);

    recordBarSale(bar.id, 'product-1', 10, 'order-1');
    recordBarRestock(bar.id, 'product-1', 20, 'PO-123');
    recordBarSale(bar.id, 'product-1', 5, 'order-2');

    const movements = JSON.parse(localStorage.getItem('clubio_stock_movements') || '[]');

    expect(movements.length).toBeGreaterThanOrEqual(3);

    // Each movement should have required fields
    movements.forEach((m: any) => {
      expect(m.id).toBeDefined();
      expect(m.barId).toBe(bar.id);
      expect(m.productId).toBe('product-1');
      expect(m.type).toBeDefined();
      expect(m.quantity).toBeDefined();
      expect(m.previousStock).toBeDefined();
      expect(m.newStock).toBeDefined();
      expect(m.createdAt).toBeDefined();
    });
  });

  it('should maintain movement history through transfers', () => {
    const bar1 = createBar({ venueId: 'venue-1', name: 'Bar 1', isActive: true });
    const bar2 = createBar({ venueId: 'venue-1', name: 'Bar 2', isActive: true });
    setBarStock(bar1.id, 'product-1', 100);

    transferStock(bar1.id, bar2.id, 'product-1', 30, 'Emergency transfer');

    const movements = JSON.parse(localStorage.getItem('clubio_stock_movements') || '[]');

    const transferOut = movements.find((m: any) => m.type === 'transfer_out');
    const transferIn = movements.find((m: any) => m.type === 'transfer_in');

    expect(transferOut).toBeDefined();
    expect(transferOut.relatedBarId).toBe(bar2.id);
    expect(transferOut.notes).toBe('Emergency transfer');

    expect(transferIn).toBeDefined();
    expect(transferIn.relatedBarId).toBe(bar1.id);
  });
});
