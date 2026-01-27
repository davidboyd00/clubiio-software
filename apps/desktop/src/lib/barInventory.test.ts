// ============================================
// TESTS: BAR INVENTORY
// Tests for bar management, inventory operations,
// stock movements, and security validations
// ============================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Bar management
  loadBars,
  saveBars,
  createBar,
  updateBar,
  getBarById,
  // Cash register mapping
  getCashRegisterBarMap,
  assignCashRegisterToBar,
  getBarIdForCashRegister,
  getBarForCashRegister,
  // Inventory management
  loadBarInventory,
  loadAllBarInventory,
  getBarStock,
  getBarInventoryItem,
  setBarStock,
  // Stock operations
  recordBarSale,
  recordBarRestock,
  transferStock,
  // Stock queries
  getProductStockAllBars,
  findAlternativeBars,
  getLowStockProducts,
  getBarMovements,
  // Sample data
  generateSampleBars,
  Bar,
  BarInventoryItem,
} from './barInventory';

// ============================================
// Bar Management Tests
// ============================================

describe('Bar Management', () => {
  describe('loadBars / saveBars', () => {
    it('should return empty array when no bars exist', () => {
      const bars = loadBars();
      expect(bars).toEqual([]);
    });

    it('should save and load bars correctly', () => {
      const testBars: Bar[] = [
        {
          id: 'bar-1',
          venueId: 'venue-1',
          name: 'Main Bar',
          location: 'Floor 1',
          isActive: true,
          cashRegisterIds: [],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      saveBars(testBars);
      const loaded = loadBars();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe('Main Bar');
    });

    it('should handle corrupted localStorage gracefully', () => {
      localStorage.setItem('clubio_bars', 'invalid-json{');
      const bars = loadBars();
      expect(bars).toEqual([]);
    });
  });

  describe('createBar', () => {
    it('should create a new bar with generated id', () => {
      const bar = createBar({
        venueId: 'venue-1',
        name: 'VIP Bar',
        location: 'Floor 2',
        isActive: true,
      });

      expect(bar.id).toMatch(/^bar-/);
      expect(bar.name).toBe('VIP Bar');
      expect(bar.venueId).toBe('venue-1');
      expect(bar.cashRegisterIds).toEqual([]);
      expect(bar.createdAt).toBeDefined();
    });

    it('should persist created bar', () => {
      createBar({
        venueId: 'venue-1',
        name: 'Test Bar',
        isActive: true,
      });

      const bars = loadBars();
      expect(bars).toHaveLength(1);
      expect(bars[0].name).toBe('Test Bar');
    });
  });

  describe('updateBar', () => {
    it('should update existing bar', () => {
      const bar = createBar({
        venueId: 'venue-1',
        name: 'Original Name',
        isActive: true,
      });

      const updated = updateBar(bar.id, { name: 'Updated Name' });

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.isActive).toBe(true);
    });

    it('should return null for non-existent bar', () => {
      const result = updateBar('non-existent-id', { name: 'Test' });
      expect(result).toBeNull();
    });
  });

  describe('getBarById', () => {
    it('should return bar by id', () => {
      const created = createBar({
        venueId: 'venue-1',
        name: 'Findable Bar',
        isActive: true,
      });

      const found = getBarById(created.id);
      expect(found?.name).toBe('Findable Bar');
    });

    it('should return null for unknown id', () => {
      const found = getBarById('unknown-id');
      expect(found).toBeNull();
    });
  });
});

// ============================================
// Cash Register Mapping Tests
// ============================================

describe('Cash Register Mapping', () => {
  describe('assignCashRegisterToBar', () => {
    it('should assign cash register to bar', () => {
      const bar = createBar({
        venueId: 'venue-1',
        name: 'Test Bar',
        isActive: true,
      });

      assignCashRegisterToBar('cash-1', bar.id);

      const barId = getBarIdForCashRegister('cash-1');
      expect(barId).toBe(bar.id);
    });

    it('should update bar cashRegisterIds', () => {
      const bar = createBar({
        venueId: 'venue-1',
        name: 'Test Bar',
        isActive: true,
      });

      assignCashRegisterToBar('cash-1', bar.id);
      assignCashRegisterToBar('cash-2', bar.id);

      const updatedBar = getBarById(bar.id);
      expect(updatedBar?.cashRegisterIds).toContain('cash-1');
      expect(updatedBar?.cashRegisterIds).toContain('cash-2');
    });
  });

  describe('getBarForCashRegister', () => {
    it('should return bar for assigned cash register', () => {
      const bar = createBar({
        venueId: 'venue-1',
        name: 'Mapped Bar',
        isActive: true,
      });

      assignCashRegisterToBar('cash-123', bar.id);

      const foundBar = getBarForCashRegister('cash-123');
      expect(foundBar?.name).toBe('Mapped Bar');
    });

    it('should return null for unmapped cash register', () => {
      const bar = getBarForCashRegister('unmapped-cash');
      expect(bar).toBeNull();
    });
  });

  describe('getCashRegisterBarMap', () => {
    it('should return empty map initially', () => {
      const map = getCashRegisterBarMap();
      expect(map).toEqual({});
    });

    it('should handle corrupted data', () => {
      localStorage.setItem('clubio_cashregister_bar_map', 'not-json');
      const map = getCashRegisterBarMap();
      expect(map).toEqual({});
    });
  });
});

// ============================================
// Inventory Management Tests
// ============================================

describe('Inventory Management', () => {
  let testBar: Bar;

  beforeEach(() => {
    testBar = createBar({
      venueId: 'venue-1',
      name: 'Test Bar',
      isActive: true,
    });
  });

  describe('setBarStock / getBarStock', () => {
    it('should set and get stock for a product', () => {
      setBarStock(testBar.id, 'product-1', 50);

      const stock = getBarStock(testBar.id, 'product-1');
      expect(stock).toBe(50);
    });

    it('should return 0 for unknown product', () => {
      const stock = getBarStock(testBar.id, 'unknown-product');
      expect(stock).toBe(0);
    });

    it('should update existing stock', () => {
      setBarStock(testBar.id, 'product-1', 50);
      setBarStock(testBar.id, 'product-1', 75);

      const stock = getBarStock(testBar.id, 'product-1');
      expect(stock).toBe(75);
    });

    it('should set min and max stock', () => {
      setBarStock(testBar.id, 'product-1', 50, 10, 100);

      const item = getBarInventoryItem(testBar.id, 'product-1');
      expect(item?.minStock).toBe(10);
      expect(item?.maxStock).toBe(100);
    });

    it('should use default min/max when not specified', () => {
      setBarStock(testBar.id, 'product-1', 50);

      const item = getBarInventoryItem(testBar.id, 'product-1');
      expect(item?.minStock).toBe(5);
      expect(item?.maxStock).toBe(100);
    });
  });

  describe('loadBarInventory', () => {
    it('should load inventory for specific bar', () => {
      const bar2 = createBar({
        venueId: 'venue-1',
        name: 'Bar 2',
        isActive: true,
      });

      setBarStock(testBar.id, 'product-1', 50);
      setBarStock(bar2.id, 'product-1', 30);

      const inventory = loadBarInventory(testBar.id);
      expect(inventory).toHaveLength(1);
      expect(inventory[0].quantity).toBe(50);
    });
  });

  describe('loadAllBarInventory', () => {
    it('should load all inventory across bars', () => {
      const bar2 = createBar({
        venueId: 'venue-1',
        name: 'Bar 2',
        isActive: true,
      });

      setBarStock(testBar.id, 'product-1', 50);
      setBarStock(bar2.id, 'product-2', 30);

      const allInventory = loadAllBarInventory();
      expect(allInventory).toHaveLength(2);
    });
  });
});

// ============================================
// Stock Operations Tests
// ============================================

describe('Stock Operations', () => {
  let testBar: Bar;

  beforeEach(() => {
    testBar = createBar({
      venueId: 'venue-1',
      name: 'Test Bar',
      isActive: true,
    });
    setBarStock(testBar.id, 'product-1', 100);
  });

  describe('recordBarSale', () => {
    it('should decrement stock on sale', () => {
      const result = recordBarSale(testBar.id, 'product-1', 10);

      expect(result.success).toBe(true);
      expect(result.newStock).toBe(90);
      expect(getBarStock(testBar.id, 'product-1')).toBe(90);
    });

    it('should record multiple sales', () => {
      recordBarSale(testBar.id, 'product-1', 10);
      recordBarSale(testBar.id, 'product-1', 20);
      recordBarSale(testBar.id, 'product-1', 30);

      expect(getBarStock(testBar.id, 'product-1')).toBe(40);
    });

    it('should warn on negative stock but still succeed', () => {
      const result = recordBarSale(testBar.id, 'product-1', 150);

      expect(result.success).toBe(true);
      expect(result.newStock).toBe(-50);
      expect(result.warning).toContain('Stock negativo');
    });

    it('should create inventory item if not exists', () => {
      const result = recordBarSale(testBar.id, 'new-product', 5);

      expect(result.success).toBe(true);
      expect(result.newStock).toBe(-5);
    });

    it('should update lastSaleAt timestamp', () => {
      recordBarSale(testBar.id, 'product-1', 10);

      const item = getBarInventoryItem(testBar.id, 'product-1');
      expect(item?.lastSaleAt).toBeDefined();
    });

    it('should record movement', () => {
      recordBarSale(testBar.id, 'product-1', 10, 'order-123');

      const movements = getBarMovements(testBar.id, 'product-1');
      expect(movements).toHaveLength(1);
      expect(movements[0].type).toBe('sale');
      expect(movements[0].quantity).toBe(-10);
      expect(movements[0].relatedOrderId).toBe('order-123');
    });
  });

  describe('recordBarRestock', () => {
    it('should increment stock on restock', () => {
      const result = recordBarRestock(testBar.id, 'product-1', 50);

      expect(result.success).toBe(true);
      expect(result.newStock).toBe(150);
    });

    it('should update lastRestockedAt timestamp', () => {
      recordBarRestock(testBar.id, 'product-1', 50);

      const item = getBarInventoryItem(testBar.id, 'product-1');
      expect(item?.lastRestockedAt).toBeDefined();
    });

    it('should create inventory item if not exists', () => {
      const result = recordBarRestock(testBar.id, 'new-product', 25);

      expect(result.success).toBe(true);
      expect(result.newStock).toBe(25);
    });

    it('should record movement with notes', () => {
      recordBarRestock(testBar.id, 'product-1', 50, 'Weekly restock');

      const movements = getBarMovements(testBar.id, 'product-1');
      const restockMovement = movements.find(m => m.type === 'restock');
      expect(restockMovement?.notes).toBe('Weekly restock');
    });
  });

  describe('transferStock', () => {
    let bar2: Bar;

    beforeEach(() => {
      bar2 = createBar({
        venueId: 'venue-1',
        name: 'Bar 2',
        isActive: true,
      });
      setBarStock(bar2.id, 'product-1', 20);
    });

    it('should transfer stock between bars', () => {
      const result = transferStock(testBar.id, bar2.id, 'product-1', 30);

      expect(result.success).toBe(true);
      expect(getBarStock(testBar.id, 'product-1')).toBe(70);
      expect(getBarStock(bar2.id, 'product-1')).toBe(50);
    });

    it('should fail if insufficient stock', () => {
      const result = transferStock(testBar.id, bar2.id, 'product-1', 150);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Stock insuficiente');
      // Stock should remain unchanged
      expect(getBarStock(testBar.id, 'product-1')).toBe(100);
    });

    it('should record movements for both bars', () => {
      transferStock(testBar.id, bar2.id, 'product-1', 30);

      const fromMovements = getBarMovements(testBar.id, 'product-1');
      const toMovements = getBarMovements(bar2.id, 'product-1');

      const transferOut = fromMovements.find(m => m.type === 'transfer_out');
      const transferIn = toMovements.find(m => m.type === 'transfer_in');

      expect(transferOut).toBeDefined();
      expect(transferOut?.quantity).toBe(-30);
      expect(transferOut?.relatedBarId).toBe(bar2.id);

      expect(transferIn).toBeDefined();
      expect(transferIn?.quantity).toBe(30);
      expect(transferIn?.relatedBarId).toBe(testBar.id);
    });

    it('should create inventory item in destination if not exists', () => {
      const bar3 = createBar({
        venueId: 'venue-1',
        name: 'Bar 3',
        isActive: true,
      });

      const result = transferStock(testBar.id, bar3.id, 'product-1', 25);

      expect(result.success).toBe(true);
      expect(getBarStock(bar3.id, 'product-1')).toBe(25);
    });
  });
});

// ============================================
// Stock Query Tests
// ============================================

describe('Stock Queries', () => {
  let bar1: Bar;
  let bar2: Bar;
  let bar3: Bar;

  beforeEach(() => {
    bar1 = createBar({ venueId: 'venue-1', name: 'Bar 1', isActive: true });
    bar2 = createBar({ venueId: 'venue-1', name: 'Bar 2', isActive: true });
    bar3 = createBar({ venueId: 'venue-1', name: 'Bar 3', isActive: false });

    setBarStock(bar1.id, 'product-1', 100);
    setBarStock(bar2.id, 'product-1', 50);
    setBarStock(bar3.id, 'product-1', 200); // Inactive bar
  });

  describe('getProductStockAllBars', () => {
    it('should return stock for active bars only', () => {
      const stocks = getProductStockAllBars('product-1');

      // Should include only active bars (bar1, bar2)
      expect(stocks).toHaveLength(2);
      expect(stocks.find(s => s.bar.id === bar1.id)?.stock).toBe(100);
      expect(stocks.find(s => s.bar.id === bar2.id)?.stock).toBe(50);
    });

    it('should return 0 for bars without inventory item', () => {
      const stocks = getProductStockAllBars('unknown-product');

      expect(stocks.every(s => s.stock === 0)).toBe(true);
    });
  });

  describe('findAlternativeBars', () => {
    it('should find bars with available stock', () => {
      const alternatives = findAlternativeBars(bar1.id, 'product-1', 1);

      expect(alternatives).toHaveLength(1);
      expect(alternatives[0].bar.id).toBe(bar2.id);
      expect(alternatives[0].availableStock).toBe(50);
    });

    it('should exclude current bar', () => {
      const alternatives = findAlternativeBars(bar1.id, 'product-1', 1);
      expect(alternatives.find(a => a.bar.id === bar1.id)).toBeUndefined();
    });

    it('should filter by minimum stock', () => {
      const alternatives = findAlternativeBars(bar1.id, 'product-1', 75);
      expect(alternatives).toHaveLength(0);
    });

    it('should sort by available stock descending', () => {
      setBarStock(bar2.id, 'product-1', 150);
      const bar4 = createBar({ venueId: 'venue-1', name: 'Bar 4', isActive: true });
      setBarStock(bar4.id, 'product-1', 75);

      const alternatives = findAlternativeBars(bar1.id, 'product-1', 1);

      expect(alternatives[0].availableStock).toBeGreaterThan(alternatives[1].availableStock);
    });
  });

  describe('getLowStockProducts', () => {
    it('should return products below 150% of min stock', () => {
      setBarStock(bar1.id, 'product-1', 100, 10, 200); // OK
      setBarStock(bar1.id, 'product-2', 12, 10, 200); // Low (120% of min)
      setBarStock(bar1.id, 'product-3', 5, 10, 200); // Critical (50% of min)

      const lowStock = getLowStockProducts(bar1.id);

      expect(lowStock).toHaveLength(2);
      expect(lowStock[0].productId).toBe('product-3'); // Most critical first
      expect(lowStock[1].productId).toBe('product-2');
    });

    it('should calculate correct percentOfMin', () => {
      setBarStock(bar1.id, 'product-x', 5, 10, 100);

      const lowStock = getLowStockProducts(bar1.id);
      const product = lowStock.find(p => p.productId === 'product-x');

      expect(product?.percentOfMin).toBe(50);
    });
  });
});

// ============================================
// Security & Edge Case Tests
// ============================================

describe('Security & Edge Cases', () => {
  let testBar: Bar;

  beforeEach(() => {
    testBar = createBar({
      venueId: 'venue-1',
      name: 'Test Bar',
      isActive: true,
    });
  });

  describe('Input Validation', () => {
    it('should handle zero quantity sale', () => {
      setBarStock(testBar.id, 'product-1', 100);
      const result = recordBarSale(testBar.id, 'product-1', 0);

      expect(result.success).toBe(true);
      expect(result.newStock).toBe(100);
    });

    it('should handle negative quantity (returns stock)', () => {
      setBarStock(testBar.id, 'product-1', 100);
      // Negative quantity would add stock (return)
      const result = recordBarSale(testBar.id, 'product-1', -10);

      expect(result.success).toBe(true);
      expect(result.newStock).toBe(110);
    });

    it('should handle very large quantities', () => {
      setBarStock(testBar.id, 'product-1', 100);
      const result = recordBarSale(testBar.id, 'product-1', 999999);

      expect(result.success).toBe(true);
      expect(result.warning).toBeDefined();
    });

    it('should handle empty product id', () => {
      setBarStock(testBar.id, '', 50);
      expect(getBarStock(testBar.id, '')).toBe(50);
    });

    it('should handle special characters in bar names', () => {
      const bar = createBar({
        venueId: 'venue-1',
        name: 'Bar "Test" <script>alert(1)</script>',
        isActive: true,
      });

      expect(bar.name).toBe('Bar "Test" <script>alert(1)</script>');
      // Name is stored as-is, sanitization should happen at display layer
    });
  });

  describe('Data Integrity', () => {
    it('should maintain inventory consistency after multiple operations', () => {
      setBarStock(testBar.id, 'product-1', 100);

      recordBarSale(testBar.id, 'product-1', 10);
      recordBarRestock(testBar.id, 'product-1', 50);
      recordBarSale(testBar.id, 'product-1', 30);

      const finalStock = getBarStock(testBar.id, 'product-1');
      expect(finalStock).toBe(100 - 10 + 50 - 30); // 110
    });

    it('should handle concurrent-like operations', () => {
      setBarStock(testBar.id, 'product-1', 100);

      // Simulate multiple sales happening quickly
      for (let i = 0; i < 10; i++) {
        recordBarSale(testBar.id, 'product-1', 5);
      }

      expect(getBarStock(testBar.id, 'product-1')).toBe(50);
    });
  });

  describe('localStorage Handling', () => {
    it('should handle missing localStorage data', () => {
      localStorage.clear();

      // Should not throw
      const bars = loadBars();
      const inventory = loadAllBarInventory();
      const map = getCashRegisterBarMap();

      expect(bars).toEqual([]);
      expect(inventory).toEqual([]);
      expect(map).toEqual({});
    });

    it('should handle corrupted inventory data', () => {
      localStorage.setItem('clubio_bar_inventory', '[invalid json');
      const inventory = loadAllBarInventory();
      expect(inventory).toEqual([]);
    });
  });
});

// ============================================
// Sample Data Generation Tests
// ============================================

describe('Sample Data Generation', () => {
  it('should generate sample bars when none exist', () => {
    generateSampleBars('venue-1');

    const bars = loadBars();
    expect(bars.length).toBeGreaterThan(0);
  });

  it('should not generate if bars already exist', () => {
    createBar({ venueId: 'venue-1', name: 'Existing Bar', isActive: true });
    generateSampleBars('venue-1');

    const bars = loadBars();
    expect(bars).toHaveLength(1);
    expect(bars[0].name).toBe('Existing Bar');
  });
});
