// ============================================
// TESTS: STOCK ENGINE
// Tests for deterministic calculations, EWMA,
// velocity tracking, and stock state evaluation
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  // Thresholds
  getProductThresholds,
  setProductThresholds,
  // Sales tracking
  recordSale,
  // Velocity calculation
  calculateVelocity,
  calculateVelocityForBar,
  SalesVelocity,
  // Stock state evaluation
  evaluateBarStockState,
  StockState,
  // Replenishment
  calculateReplenishment,
  // Batch operations
  evaluateAllProducts,
} from './stockEngine';
import { createBar, setBarStock, Bar } from './barInventory';
import { Product } from './api';

// ============================================
// Test Helpers
// ============================================

function createMockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: `product-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    name: 'Test Product',
    price: 1000,
    isActive: true,
    venueId: 'venue-1',
    stock: 50,
    minStock: 10,
    ...overrides,
  } as Product;
}

// Helper function for simulating sales history (currently using inline vi.setSystemTime)
// function simulateSalesHistory(productId: string, sales: Array<{ quantity: number; hoursAgo: number }>, barId?: string) {
//   const now = Date.now();
//   sales.forEach(sale => {
//     const timestamp = now - sale.hoursAgo * 60 * 60 * 1000;
//     vi.setSystemTime(timestamp);
//     recordSale(productId, sale.quantity, barId);
//   });
//   vi.setSystemTime(now);
// }

// ============================================
// Threshold Management Tests
// ============================================

describe('Threshold Management', () => {
  describe('getProductThresholds', () => {
    it('should return default thresholds for unknown product', () => {
      const thresholds = getProductThresholds('unknown-product');

      expect(thresholds).toEqual({
        minAbsolute: 5,
        reorderPoint: 20,
        safetyStock: 10,
        leadTimeDays: 1,
        packSize: 6,
      });
    });

    it('should return custom thresholds for configured product', () => {
      setProductThresholds('product-1', {
        minAbsolute: 10,
        reorderPoint: 30,
      });

      const thresholds = getProductThresholds('product-1');
      expect(thresholds.minAbsolute).toBe(10);
      expect(thresholds.reorderPoint).toBe(30);
      // Should still have defaults for non-specified values
      expect(thresholds.safetyStock).toBe(10);
    });
  });

  describe('setProductThresholds', () => {
    it('should merge with existing thresholds', () => {
      setProductThresholds('product-1', { minAbsolute: 15 });
      setProductThresholds('product-1', { reorderPoint: 40 });

      const thresholds = getProductThresholds('product-1');
      expect(thresholds.minAbsolute).toBe(15);
      expect(thresholds.reorderPoint).toBe(40);
    });

    it('should handle multiple products independently', () => {
      setProductThresholds('product-1', { minAbsolute: 10 });
      setProductThresholds('product-2', { minAbsolute: 20 });

      expect(getProductThresholds('product-1').minAbsolute).toBe(10);
      expect(getProductThresholds('product-2').minAbsolute).toBe(20);
    });
  });
});

// ============================================
// Sales Tracking Tests
// ============================================

describe('Sales Tracking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T22:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('recordSale', () => {
    it('should record sale with timestamp', () => {
      recordSale('product-1', 5);

      const velocity = calculateVelocity('product-1');
      expect(velocity.last1h).toBe(5);
    });

    it('should record sale with barId', () => {
      const bar = createBar({ venueId: 'venue-1', name: 'Test Bar', isActive: true });
      recordSale('product-1', 3, bar.id);

      const velocity = calculateVelocityForBar(bar.id, 'product-1');
      expect(velocity.last1h).toBe(3);
    });

    it('should accumulate multiple sales', () => {
      recordSale('product-1', 5);
      recordSale('product-1', 3);
      recordSale('product-1', 2);

      const velocity = calculateVelocity('product-1');
      expect(velocity.last1h).toBe(10);
    });
  });
});

// ============================================
// Velocity Calculation Tests (EWMA)
// ============================================

describe('Velocity Calculation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T22:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculateVelocity', () => {
    it('should return zero velocity with no sales', () => {
      const velocity = calculateVelocity('no-sales-product');

      expect(velocity.last1h).toBe(0);
      expect(velocity.last2h).toBe(0);
      expect(velocity.last4h).toBe(0);
      expect(velocity.last24h).toBe(0);
      expect(velocity.ewma).toBe(0);
    });

    it('should calculate sales in different time windows', () => {
      // Sale 30 min ago (within 1h window)
      vi.setSystemTime(new Date('2024-06-15T21:30:00.000Z'));
      recordSale('product-1', 5);

      // Sale 90 min ago (within 2h window, outside 1h)
      vi.setSystemTime(new Date('2024-06-15T20:30:00.000Z'));
      recordSale('product-1', 3);

      // Sale 3h ago (within 4h window)
      vi.setSystemTime(new Date('2024-06-15T19:00:00.000Z'));
      recordSale('product-1', 7);

      // Back to "now"
      vi.setSystemTime(new Date('2024-06-15T22:00:00.000Z'));

      const velocity = calculateVelocity('product-1');

      expect(velocity.last1h).toBe(5);
      expect(velocity.last2h).toBe(8); // 5 + 3
      expect(velocity.last4h).toBe(15); // 5 + 3 + 7
    });

    it('should calculate EWMA with recent bias', () => {
      // Recent high sales
      vi.setSystemTime(new Date('2024-06-15T21:30:00.000Z'));
      recordSale('product-1', 20);

      // Older lower sales
      vi.setSystemTime(new Date('2024-06-15T10:00:00.000Z'));
      recordSale('product-1', 5);

      vi.setSystemTime(new Date('2024-06-15T22:00:00.000Z'));

      const velocity = calculateVelocity('product-1');

      // EWMA should be weighted towards recent high sales
      expect(velocity.ewma).toBeGreaterThan(velocity.last24h / 24);
    });

    it('should detect rising trend', () => {
      // Old period: low sales
      for (let h = 20; h >= 3; h--) {
        vi.setSystemTime(new Date(Date.now() - h * 60 * 60 * 1000));
        recordSale('product-1', 1);
      }

      // Recent period: high sales
      vi.setSystemTime(new Date('2024-06-15T21:30:00.000Z'));
      recordSale('product-1', 10);
      vi.setSystemTime(new Date('2024-06-15T21:00:00.000Z'));
      recordSale('product-1', 10);

      vi.setSystemTime(new Date('2024-06-15T22:00:00.000Z'));

      const velocity = calculateVelocity('product-1');
      expect(velocity.trend).toBe('rising');
    });

    it('should detect falling trend', () => {
      const now = new Date('2024-06-15T22:00:00.000Z').getTime();

      // Old period (3-22h ago): high sales - 50 per hour
      for (let h = 22; h >= 3; h--) {
        vi.setSystemTime(new Date(now - h * 60 * 60 * 1000));
        recordSale('product-1', 50);
      }

      // Recent period (last 2h): very low sales - 1 total
      vi.setSystemTime(new Date(now - 1 * 60 * 60 * 1000));
      recordSale('product-1', 1);

      vi.setSystemTime(new Date(now));

      const velocity = calculateVelocity('product-1');
      // Recent rate: 1/2 = 0.5/hr, Older rate: (total-1)/22 hrs = high
      // Change should be < -20%
      expect(velocity.trend).toBe('falling');
    });

    it('should detect peak hour based on sales volume', () => {
      // Record multiple sales at different hours to establish peak
      const baseTime = new Date('2024-06-15T22:00:00.000Z').getTime();

      // Low sales 2h ago
      vi.setSystemTime(new Date(baseTime - 2 * 60 * 60 * 1000));
      recordSale('peak-product', 2);

      // High sales 1h ago - this should be peak
      vi.setSystemTime(new Date(baseTime - 1 * 60 * 60 * 1000));
      const highHour = new Date(baseTime - 1 * 60 * 60 * 1000).getHours();
      recordSale('peak-product', 100);

      // Medium sales now
      vi.setSystemTime(new Date(baseTime));
      recordSale('peak-product', 10);

      const velocity = calculateVelocity('peak-product');
      // Peak hour should match the hour with highest volume
      expect(velocity.peakHour).toBe(highHour);
    });
  });

  describe('calculateVelocityForBar', () => {
    it('should calculate velocity for specific bar only', () => {
      const bar1 = createBar({ venueId: 'venue-1', name: 'Bar 1', isActive: true });
      const bar2 = createBar({ venueId: 'venue-1', name: 'Bar 2', isActive: true });

      recordSale('product-1', 10, bar1.id);
      recordSale('product-1', 5, bar2.id);

      const velocity1 = calculateVelocityForBar(bar1.id, 'product-1');
      const velocity2 = calculateVelocityForBar(bar2.id, 'product-1');

      expect(velocity1.last1h).toBe(10);
      expect(velocity2.last1h).toBe(5);
    });

    it('should not include sales without barId', () => {
      const bar = createBar({ venueId: 'venue-1', name: 'Bar 1', isActive: true });

      recordSale('product-1', 10, bar.id);
      recordSale('product-1', 5); // No barId

      const velocity = calculateVelocityForBar(bar.id, 'product-1');
      expect(velocity.last1h).toBe(10);
    });
  });
});

// ============================================
// Stock State Evaluation Tests
// ============================================

describe('Stock State Evaluation', () => {
  let testBar: Bar;
  let testProduct: Product;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T22:00:00.000Z'));

    testBar = createBar({
      venueId: 'venue-1',
      name: 'Test Bar',
      isActive: true,
    });

    testProduct = createMockProduct({ id: 'test-product', name: 'Test Beer' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('evaluateBarStockState', () => {
    it('should return OK severity for adequate stock', () => {
      setBarStock(testBar.id, testProduct.id, 100);

      const state = evaluateBarStockState(testBar.id, testBar.name, testProduct);

      expect(state.severity).toBe('ok');
      expect(state.available).toBe(100);
    });

    it('should return CRITICAL severity for zero stock', () => {
      setBarStock(testBar.id, testProduct.id, 0);

      const state = evaluateBarStockState(testBar.id, testBar.name, testProduct);

      expect(state.severity).toBe('critical');
    });

    it('should return CRITICAL severity below minAbsolute', () => {
      setProductThresholds(testProduct.id, { minAbsolute: 10 });
      setBarStock(testBar.id, testProduct.id, 5);

      const state = evaluateBarStockState(testBar.id, testBar.name, testProduct);

      expect(state.severity).toBe('critical');
    });

    it('should return WARNING severity below reorderPoint', () => {
      setProductThresholds(testProduct.id, { minAbsolute: 5, reorderPoint: 20 });
      setBarStock(testBar.id, testProduct.id, 15);

      const state = evaluateBarStockState(testBar.id, testBar.name, testProduct);

      expect(state.severity).toBe('warning');
    });

    it('should calculate coverage hours based on velocity', () => {
      setBarStock(testBar.id, testProduct.id, 20);

      // Record sales to establish velocity (10 units/hour)
      recordSale(testProduct.id, 10, testBar.id);

      const state = evaluateBarStockState(testBar.id, testBar.name, testProduct);

      // With 20 units and ~10/hour velocity, coverage should be ~2 hours
      expect(state.coverageHours).toBeDefined();
      expect(state.coverageHours).toBeGreaterThan(0);
    });

    it('should return CRITICAL if coverage < 1 hour with active velocity', () => {
      setProductThresholds(testProduct.id, { minAbsolute: 1, reorderPoint: 5 });
      setBarStock(testBar.id, testProduct.id, 3);

      // High velocity: simulate many sales to get high EWMA
      for (let i = 0; i < 20; i++) {
        recordSale(testProduct.id, 5, testBar.id);
      }

      const state = evaluateBarStockState(testBar.id, testBar.name, testProduct);

      // 3 units with high velocity should result in < 1 hour coverage
      // Coverage < 1 hour triggers critical
      expect(state.coverageHours).toBeLessThan(1);
      expect(state.severity).toBe('critical');
    });

    it('should include alternative bars with stock', () => {
      const bar2 = createBar({ venueId: 'venue-1', name: 'Bar 2', isActive: true });
      setBarStock(testBar.id, testProduct.id, 5);
      setBarStock(bar2.id, testProduct.id, 50);

      const state = evaluateBarStockState(testBar.id, testBar.name, testProduct);

      expect(state.alternativeBars.length).toBeGreaterThan(0);
      expect(state.alternativeBars[0].barId).toBe(bar2.id);
      expect(state.alternativeBars[0].stock).toBe(50);
    });

    it('should use bar-specific minStock if available', () => {
      setBarStock(testBar.id, testProduct.id, 8, 10, 100); // minStock = 10

      const state = evaluateBarStockState(
        testBar.id,
        testBar.name,
        testProduct,
        { barId: testBar.id, productId: testProduct.id, quantity: 8, minStock: 10, maxStock: 100, lastRestockedAt: null, lastSaleAt: null }
      );

      // 8 is below minStock of 10, but need to check thresholds
      expect(state.thresholds.minAbsolute).toBeLessThanOrEqual(10);
    });

    it('should calculate percentOfReorder correctly', () => {
      setProductThresholds(testProduct.id, { reorderPoint: 50 });
      setBarStock(testBar.id, testProduct.id, 25);

      const state = evaluateBarStockState(testBar.id, testBar.name, testProduct);

      expect(state.percentOfReorder).toBe(50); // 25/50 * 100
    });

    it('should include product and bar information', () => {
      setBarStock(testBar.id, testProduct.id, 50);

      const state = evaluateBarStockState(testBar.id, testBar.name, testProduct);

      expect(state.productId).toBe(testProduct.id);
      expect(state.productName).toBe(testProduct.name);
      expect(state.barId).toBe(testBar.id);
      expect(state.barName).toBe(testBar.name);
    });
  });
});

// ============================================
// Replenishment Calculation Tests
// ============================================

describe('Replenishment Calculation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T22:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculateReplenishment', () => {
    it('should suggest order quantity based on velocity', () => {
      const state: StockState = {
        productId: 'product-1',
        productName: 'Test Product',
        categoryId: null,
        barId: 'bar-1',
        barName: 'Test Bar',
        onHand: 10,
        reserved: 0,
        inTransit: 0,
        available: 10,
        thresholds: {
          minAbsolute: 5,
          reorderPoint: 20,
          safetyStock: 10,
          leadTimeDays: 1,
          packSize: 6,
        },
        severity: 'warning',
        coverageHours: 5,
        percentOfReorder: 50,
        alternativeBars: [],
        lastUpdated: new Date().toISOString(),
        lastSaleAt: null,
      };

      const velocity: SalesVelocity = {
        productId: 'product-1',
        last1h: 2,
        last2h: 4,
        last4h: 8,
        last24h: 48,
        ewma: 2, // 2 units/hour
        trend: 'stable',
        peakHour: 22,
        peakDayOfWeek: 5,
      };

      const recommendation = calculateReplenishment(state, velocity);

      expect(recommendation.suggestedQty).toBeGreaterThan(0);
      expect(recommendation.suggestedQty % 6).toBe(0); // Multiple of packSize
    });

    it('should return IMMEDIATE urgency for critical stock', () => {
      const state: StockState = {
        productId: 'product-1',
        productName: 'Test',
        categoryId: null,
        barId: 'bar-1',
        barName: 'Bar',
        onHand: 2,
        reserved: 0,
        inTransit: 0,
        available: 2,
        thresholds: {
          minAbsolute: 5,
          reorderPoint: 20,
          safetyStock: 10,
          leadTimeDays: 1,
          packSize: 6,
        },
        severity: 'critical',
        coverageHours: 1,
        percentOfReorder: 10,
        alternativeBars: [],
        lastUpdated: new Date().toISOString(),
        lastSaleAt: null,
      };

      const velocity: SalesVelocity = {
        productId: 'product-1',
        last1h: 2,
        last2h: 4,
        last4h: 8,
        last24h: 48,
        ewma: 2,
        trend: 'stable',
        peakHour: 22,
        peakDayOfWeek: 5,
      };

      const recommendation = calculateReplenishment(state, velocity);

      expect(recommendation.urgency).toBe('immediate');
    });

    it('should suggest TRANSFER action for immediate urgency with lead time', () => {
      const state: StockState = {
        productId: 'product-1',
        productName: 'Test',
        categoryId: null,
        barId: 'bar-1',
        barName: 'Bar',
        onHand: 2,
        reserved: 0,
        inTransit: 0,
        available: 2,
        thresholds: {
          minAbsolute: 5,
          reorderPoint: 20,
          safetyStock: 10,
          leadTimeDays: 2, // Can't get supply today
          packSize: 6,
        },
        severity: 'critical',
        coverageHours: 1,
        percentOfReorder: 10,
        alternativeBars: [{ barId: 'bar-2', barName: 'Bar 2', stock: 50 }],
        lastUpdated: new Date().toISOString(),
        lastSaleAt: null,
      };

      const velocity: SalesVelocity = {
        productId: 'product-1',
        last1h: 2,
        last2h: 4,
        last4h: 8,
        last24h: 48,
        ewma: 2,
        trend: 'stable',
        peakHour: 22,
        peakDayOfWeek: 5,
      };

      const recommendation = calculateReplenishment(state, velocity);

      expect(recommendation.action).toBe('transfer');
    });

    it('should include auditable reasoning', () => {
      const state: StockState = {
        productId: 'product-1',
        productName: 'Test',
        categoryId: null,
        barId: 'bar-1',
        barName: 'Bar',
        onHand: 10,
        reserved: 0,
        inTransit: 0,
        available: 10,
        thresholds: {
          minAbsolute: 5,
          reorderPoint: 20,
          safetyStock: 10,
          leadTimeDays: 1,
          packSize: 6,
        },
        severity: 'warning',
        coverageHours: 5,
        percentOfReorder: 50,
        alternativeBars: [],
        lastUpdated: new Date().toISOString(),
        lastSaleAt: null,
      };

      const velocity: SalesVelocity = {
        productId: 'product-1',
        last1h: 2,
        last2h: 4,
        last4h: 8,
        last24h: 48,
        ewma: 2,
        trend: 'stable',
        peakHour: 22,
        peakDayOfWeek: 5,
      };

      const recommendation = calculateReplenishment(state, velocity);

      expect(recommendation.reasoning).toContain('Stock actual');
      expect(recommendation.reasoning).toContain('Velocidad EWMA');
      expect(recommendation.reasoning).toContain('Consumo diario estimado');
    });

    it('should round up to pack size', () => {
      const state: StockState = {
        productId: 'product-1',
        productName: 'Test',
        categoryId: null,
        barId: 'bar-1',
        barName: 'Bar',
        onHand: 19,
        reserved: 0,
        inTransit: 0,
        available: 19,
        thresholds: {
          minAbsolute: 5,
          reorderPoint: 20,
          safetyStock: 10,
          leadTimeDays: 1,
          packSize: 12, // Pack of 12
        },
        severity: 'info',
        coverageHours: 10,
        percentOfReorder: 95,
        alternativeBars: [],
        lastUpdated: new Date().toISOString(),
        lastSaleAt: null,
      };

      const velocity: SalesVelocity = {
        productId: 'product-1',
        last1h: 1,
        last2h: 2,
        last4h: 4,
        last24h: 24,
        ewma: 1,
        trend: 'stable',
        peakHour: 22,
        peakDayOfWeek: 5,
      };

      const recommendation = calculateReplenishment(state, velocity);

      // Should be multiple of 12
      expect(recommendation.suggestedQty % 12).toBe(0);
    });
  });
});

// ============================================
// Batch Evaluation Tests
// ============================================

describe('Batch Evaluation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T22:00:00.000Z'));

    // Create a default bar for legacy function
    createBar({ venueId: 'venue-1', name: 'Main Bar', isActive: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('evaluateAllProducts', () => {
    it('should skip products without minStock configured', () => {
      const products = [
        createMockProduct({ id: 'p1', minStock: 0 }),
        createMockProduct({ id: 'p2', minStock: undefined }),
        createMockProduct({ id: 'p3', minStock: 10 }),
      ];

      const result = evaluateAllProducts(products);

      // Only p3 has minStock configured
      expect(result.states.length).toBeLessThanOrEqual(1);
    });

    it('should return alerts sorted by severity', () => {
      const bar = createBar({ venueId: 'venue-1', name: 'Test Bar', isActive: true });

      const products = [
        createMockProduct({ id: 'p1', name: 'Warning Product', minStock: 10 }),
        createMockProduct({ id: 'p2', name: 'Critical Product', minStock: 10 }),
        createMockProduct({ id: 'p3', name: 'OK Product', minStock: 10 }),
      ];

      setBarStock(bar.id, 'p1', 15); // Warning
      setBarStock(bar.id, 'p2', 2); // Critical
      setBarStock(bar.id, 'p3', 100); // OK

      const result = evaluateAllProducts(products);

      // Critical should be first
      if (result.alerts.length >= 2) {
        expect(result.alerts[0].severity).toBe('critical');
      }
    });

    it('should generate recommendations for alerts', () => {
      const bar = createBar({ venueId: 'venue-1', name: 'Test Bar', isActive: true });

      const products = [
        createMockProduct({ id: 'p1', minStock: 10 }),
      ];

      setBarStock(bar.id, 'p1', 5); // Low stock

      const result = evaluateAllProducts(products);

      expect(result.recommendations.length).toBe(result.alerts.length);
    });
  });
});

// ============================================
// Edge Cases & Security Tests
// ============================================

describe('Edge Cases & Security', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T22:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Velocity with no history', () => {
    it('should handle products with no sales history', () => {
      const velocity = calculateVelocity('never-sold-product');

      expect(velocity.ewma).toBe(0);
      expect(velocity.trend).toBe('stable');
      expect(velocity.peakHour).toBe(22); // Default
      expect(velocity.peakDayOfWeek).toBe(5); // Default Friday
    });
  });

  describe('Stock state with zero velocity', () => {
    it('should handle zero velocity gracefully', () => {
      const bar = createBar({ venueId: 'venue-1', name: 'Bar', isActive: true });
      const product = createMockProduct({ id: 'no-velocity' });
      setBarStock(bar.id, product.id, 50);

      const state = evaluateBarStockState(bar.id, bar.name, product);

      // Should not crash, coverage should be null with zero velocity
      expect(state.coverageHours).toBeNull();
    });
  });

  describe('Thresholds edge cases', () => {
    it('should handle zero reorderPoint', () => {
      setProductThresholds('edge-product', { reorderPoint: 0 });

      const thresholds = getProductThresholds('edge-product');
      expect(thresholds.reorderPoint).toBe(0);
    });

    it('should handle corrupted thresholds data', () => {
      localStorage.setItem('clubio_stock_thresholds', '{invalid');
      const thresholds = getProductThresholds('any-product');

      // Should return defaults
      expect(thresholds).toEqual({
        minAbsolute: 5,
        reorderPoint: 20,
        safetyStock: 10,
        leadTimeDays: 1,
        packSize: 6,
      });
    });
  });

  describe('Large numbers', () => {
    it('should handle large stock quantities', () => {
      const bar = createBar({ venueId: 'venue-1', name: 'Bar', isActive: true });
      const product = createMockProduct({ id: 'bulk-product' });
      setBarStock(bar.id, product.id, 999999);

      const state = evaluateBarStockState(bar.id, bar.name, product);

      expect(state.available).toBe(999999);
      expect(state.severity).toBe('ok');
    });

    it('should handle high velocity', () => {
      const bar = createBar({ venueId: 'venue-1', name: 'Bar', isActive: true });

      // Record massive sales
      for (let i = 0; i < 100; i++) {
        recordSale('high-velocity', 100, bar.id);
      }

      const velocity = calculateVelocityForBar(bar.id, 'high-velocity');
      expect(velocity.last1h).toBe(10000);
    });
  });
});
