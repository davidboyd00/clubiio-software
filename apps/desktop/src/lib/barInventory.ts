// ============================================
// INVENTARIO POR BARRA
// Cada barra tiene su propio stock independiente
// ============================================

// ============================================
// Types
// ============================================

export interface Bar {
  id: string;
  venueId: string;
  name: string;
  location?: string;        // Ej: "Piso 1", "Terraza", "VIP"
  isActive: boolean;
  cashRegisterIds: string[]; // Cajas asociadas a esta barra
  createdAt: string;
}

export interface BarInventoryItem {
  barId: string;
  productId: string;
  quantity: number;         // Stock actual en esta barra
  minStock: number;         // Stock mínimo para esta barra
  maxStock: number;         // Capacidad máxima de esta barra
  lastRestockedAt: string | null;
  lastSaleAt: string | null;
}

export interface StockMovement {
  id: string;
  barId: string;
  productId: string;
  type: 'sale' | 'restock' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'waste';
  quantity: number;         // Positivo para entradas, negativo para salidas
  previousStock: number;
  newStock: number;
  relatedBarId?: string;    // Para transferencias
  relatedOrderId?: string;  // Para ventas
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface TransferRequest {
  id: string;
  fromBarId: string;
  toBarId: string;
  productId: string;
  quantity: number;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  requestedAt: string;
  requestedBy: string;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
}

// ============================================
// Storage Keys
// ============================================

const BARS_KEY = 'clubio_bars';
const BAR_INVENTORY_KEY = 'clubio_bar_inventory';
const STOCK_MOVEMENTS_KEY = 'clubio_stock_movements';
// const TRANSFER_REQUESTS_KEY = 'clubio_transfer_requests'; // Reserved for future use
const CASH_REGISTER_BAR_MAP_KEY = 'clubio_cashregister_bar_map';

// ============================================
// Bar Management
// ============================================

export function loadBars(): Bar[] {
  const stored = localStorage.getItem(BARS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

export function saveBars(bars: Bar[]): void {
  localStorage.setItem(BARS_KEY, JSON.stringify(bars));
}

export function createBar(data: Omit<Bar, 'id' | 'createdAt' | 'cashRegisterIds'>): Bar {
  const bars = loadBars();

  const newBar: Bar = {
    ...data,
    id: `bar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    cashRegisterIds: [],
    createdAt: new Date().toISOString(),
  };

  bars.push(newBar);
  saveBars(bars);

  return newBar;
}

export function updateBar(barId: string, updates: Partial<Bar>): Bar | null {
  const bars = loadBars();
  const index = bars.findIndex(b => b.id === barId);

  if (index === -1) return null;

  bars[index] = { ...bars[index], ...updates };
  saveBars(bars);

  return bars[index];
}

export function getBarById(barId: string): Bar | null {
  const bars = loadBars();
  return bars.find(b => b.id === barId) || null;
}

// ============================================
// Cash Register ↔ Bar Mapping
// ============================================

export function getCashRegisterBarMap(): Record<string, string> {
  const stored = localStorage.getItem(CASH_REGISTER_BAR_MAP_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return {};
    }
  }
  return {};
}

export function saveCashRegisterBarMap(map: Record<string, string>): void {
  localStorage.setItem(CASH_REGISTER_BAR_MAP_KEY, JSON.stringify(map));
}

export function assignCashRegisterToBar(cashRegisterId: string, barId: string): void {
  const map = getCashRegisterBarMap();
  map[cashRegisterId] = barId;
  saveCashRegisterBarMap(map);

  // Also update the bar's cashRegisterIds
  const bar = getBarById(barId);
  if (bar && !bar.cashRegisterIds.includes(cashRegisterId)) {
    bar.cashRegisterIds.push(cashRegisterId);
    updateBar(barId, { cashRegisterIds: bar.cashRegisterIds });
  }
}

export function getBarIdForCashRegister(cashRegisterId: string): string | null {
  const map = getCashRegisterBarMap();
  return map[cashRegisterId] || null;
}

export function getBarForCashRegister(cashRegisterId: string): Bar | null {
  const barId = getBarIdForCashRegister(cashRegisterId);
  if (!barId) return null;
  return getBarById(barId);
}

// ============================================
// Bar Inventory Management
// ============================================

export function loadBarInventory(barId: string): BarInventoryItem[] {
  const stored = localStorage.getItem(BAR_INVENTORY_KEY);
  if (stored) {
    try {
      const all: BarInventoryItem[] = JSON.parse(stored);
      return all.filter(item => item.barId === barId);
    } catch {
      return [];
    }
  }
  return [];
}

export function loadAllBarInventory(): BarInventoryItem[] {
  const stored = localStorage.getItem(BAR_INVENTORY_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

function saveAllBarInventory(inventory: BarInventoryItem[]): void {
  localStorage.setItem(BAR_INVENTORY_KEY, JSON.stringify(inventory));
}

export function getBarStock(barId: string, productId: string): number {
  const inventory = loadBarInventory(barId);
  const item = inventory.find(i => i.productId === productId);
  return item?.quantity || 0;
}

export function getBarInventoryItem(barId: string, productId: string): BarInventoryItem | null {
  const inventory = loadBarInventory(barId);
  return inventory.find(i => i.productId === productId) || null;
}

export function setBarStock(
  barId: string,
  productId: string,
  quantity: number,
  minStock?: number,
  maxStock?: number
): BarInventoryItem {
  const allInventory = loadAllBarInventory();
  const existingIndex = allInventory.findIndex(
    i => i.barId === barId && i.productId === productId
  );

  if (existingIndex >= 0) {
    allInventory[existingIndex].quantity = quantity;
    if (minStock !== undefined) allInventory[existingIndex].minStock = minStock;
    if (maxStock !== undefined) allInventory[existingIndex].maxStock = maxStock;
    saveAllBarInventory(allInventory);
    return allInventory[existingIndex];
  } else {
    const newItem: BarInventoryItem = {
      barId,
      productId,
      quantity,
      minStock: minStock || 5,
      maxStock: maxStock || 100,
      lastRestockedAt: null,
      lastSaleAt: null,
    };
    allInventory.push(newItem);
    saveAllBarInventory(allInventory);
    return newItem;
  }
}

// ============================================
// Stock Movements
// ============================================

function loadStockMovements(): StockMovement[] {
  const stored = localStorage.getItem(STOCK_MOVEMENTS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

function saveStockMovements(movements: StockMovement[]): void {
  // Keep only last 30 days
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const filtered = movements.filter(m => new Date(m.createdAt).getTime() > cutoff);
  localStorage.setItem(STOCK_MOVEMENTS_KEY, JSON.stringify(filtered));
}

function recordMovement(movement: Omit<StockMovement, 'id' | 'createdAt'>): StockMovement {
  const movements = loadStockMovements();

  const newMovement: StockMovement = {
    ...movement,
    id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };

  movements.push(newMovement);
  saveStockMovements(movements);

  return newMovement;
}

export function getBarMovements(barId: string, productId?: string): StockMovement[] {
  const movements = loadStockMovements();
  return movements.filter(m =>
    m.barId === barId &&
    (productId ? m.productId === productId : true)
  );
}

// ============================================
// Stock Operations
// ============================================

/**
 * Registra una venta y descuenta del stock de la barra
 */
export function recordBarSale(
  barId: string,
  productId: string,
  quantity: number,
  orderId?: string
): { success: boolean; newStock: number; warning?: string } {
  const currentStock = getBarStock(barId, productId);
  const newStock = currentStock - quantity;

  // Allow negative stock but warn
  let warning: string | undefined;
  if (newStock < 0) {
    warning = `Stock negativo para producto en barra: ${newStock} unidades`;
  }

  // Update inventory
  const allInventory = loadAllBarInventory();
  const index = allInventory.findIndex(
    i => i.barId === barId && i.productId === productId
  );

  if (index >= 0) {
    allInventory[index].quantity = newStock;
    allInventory[index].lastSaleAt = new Date().toISOString();
  } else {
    // Create inventory item if it doesn't exist
    allInventory.push({
      barId,
      productId,
      quantity: newStock,
      minStock: 5,
      maxStock: 100,
      lastRestockedAt: null,
      lastSaleAt: new Date().toISOString(),
    });
  }

  saveAllBarInventory(allInventory);

  // Record movement
  recordMovement({
    barId,
    productId,
    type: 'sale',
    quantity: -quantity,
    previousStock: currentStock,
    newStock,
    relatedOrderId: orderId,
  });

  return { success: true, newStock, warning };
}

/**
 * Registra reposición de stock en una barra
 */
export function recordBarRestock(
  barId: string,
  productId: string,
  quantity: number,
  notes?: string
): { success: boolean; newStock: number } {
  const currentStock = getBarStock(barId, productId);
  const newStock = currentStock + quantity;

  // Update inventory
  const allInventory = loadAllBarInventory();
  const index = allInventory.findIndex(
    i => i.barId === barId && i.productId === productId
  );

  if (index >= 0) {
    allInventory[index].quantity = newStock;
    allInventory[index].lastRestockedAt = new Date().toISOString();
  } else {
    allInventory.push({
      barId,
      productId,
      quantity: newStock,
      minStock: 5,
      maxStock: 100,
      lastRestockedAt: new Date().toISOString(),
      lastSaleAt: null,
    });
  }

  saveAllBarInventory(allInventory);

  // Record movement
  recordMovement({
    barId,
    productId,
    type: 'restock',
    quantity,
    previousStock: currentStock,
    newStock,
    notes,
  });

  return { success: true, newStock };
}

/**
 * Transfiere stock de una barra a otra
 */
export function transferStock(
  fromBarId: string,
  toBarId: string,
  productId: string,
  quantity: number,
  notes?: string
): { success: boolean; error?: string } {
  const fromStock = getBarStock(fromBarId, productId);

  if (fromStock < quantity) {
    return {
      success: false,
      error: `Stock insuficiente en barra origen. Disponible: ${fromStock}, Solicitado: ${quantity}`
    };
  }

  const toStock = getBarStock(toBarId, productId);

  // Update both inventories
  const allInventory = loadAllBarInventory();

  // From bar
  const fromIndex = allInventory.findIndex(
    i => i.barId === fromBarId && i.productId === productId
  );
  if (fromIndex >= 0) {
    allInventory[fromIndex].quantity = fromStock - quantity;
  }

  // To bar
  const toIndex = allInventory.findIndex(
    i => i.barId === toBarId && i.productId === productId
  );
  if (toIndex >= 0) {
    allInventory[toIndex].quantity = toStock + quantity;
    allInventory[toIndex].lastRestockedAt = new Date().toISOString();
  } else {
    allInventory.push({
      barId: toBarId,
      productId,
      quantity,
      minStock: 5,
      maxStock: 100,
      lastRestockedAt: new Date().toISOString(),
      lastSaleAt: null,
    });
  }

  saveAllBarInventory(allInventory);

  // Record movements for both bars
  recordMovement({
    barId: fromBarId,
    productId,
    type: 'transfer_out',
    quantity: -quantity,
    previousStock: fromStock,
    newStock: fromStock - quantity,
    relatedBarId: toBarId,
    notes,
  });

  recordMovement({
    barId: toBarId,
    productId,
    type: 'transfer_in',
    quantity,
    previousStock: toStock,
    newStock: toStock + quantity,
    relatedBarId: fromBarId,
    notes,
  });

  return { success: true };
}

// ============================================
// Stock Queries
// ============================================

/**
 * Obtiene el stock de un producto en todas las barras
 */
export function getProductStockAllBars(productId: string): Array<{
  bar: Bar;
  stock: number;
  minStock: number;
}> {
  const bars = loadBars().filter(b => b.isActive);
  const allInventory = loadAllBarInventory();

  return bars.map(bar => {
    const item = allInventory.find(
      i => i.barId === bar.id && i.productId === productId
    );
    return {
      bar,
      stock: item?.quantity || 0,
      minStock: item?.minStock || 5,
    };
  });
}

/**
 * Encuentra barras alternativas que tienen stock de un producto
 */
export function findAlternativeBars(
  currentBarId: string,
  productId: string,
  minimumStock: number = 1
): Array<{ bar: Bar; availableStock: number }> {
  const stockByBar = getProductStockAllBars(productId);

  return stockByBar
    .filter(s => s.bar.id !== currentBarId && s.stock >= minimumStock)
    .map(s => ({ bar: s.bar, availableStock: s.stock }))
    .sort((a, b) => b.availableStock - a.availableStock);
}

/**
 * Obtiene productos con stock bajo en una barra
 */
export function getLowStockProducts(barId: string): Array<{
  productId: string;
  currentStock: number;
  minStock: number;
  percentOfMin: number;
}> {
  const inventory = loadBarInventory(barId);

  return inventory
    .filter(item => item.quantity <= item.minStock * 1.5) // 150% del mínimo
    .map(item => ({
      productId: item.productId,
      currentStock: item.quantity,
      minStock: item.minStock,
      percentOfMin: item.minStock > 0 ? (item.quantity / item.minStock) * 100 : 100,
    }))
    .sort((a, b) => a.percentOfMin - b.percentOfMin);
}

// ============================================
// Sample Data Generation
// ============================================

export function generateSampleBars(venueId: string): void {
  const existingBars = loadBars();
  if (existingBars.length > 0) return;

  const sampleBars: Omit<Bar, 'id' | 'createdAt' | 'cashRegisterIds'>[] = [
    { venueId, name: 'Barra Principal', location: 'Piso 1 - Centro', isActive: true },
    { venueId, name: 'Barra VIP', location: 'Piso 2 - Zona VIP', isActive: true },
    { venueId, name: 'Barra Terraza', location: 'Terraza', isActive: true },
  ];

  sampleBars.forEach(bar => createBar(bar));
}
