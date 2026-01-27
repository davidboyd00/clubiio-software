// ============================================
// MOTOR DETERMINÍSTICO DE STOCK
// 100% auditable, sin IA, solo cálculos
// Trabaja con inventario POR BARRA
// ============================================

import { Product } from './api';
import {
  loadBars,
  getBarStock,
  BarInventoryItem,
  findAlternativeBars,
} from './barInventory';

// ============================================
// Types
// ============================================

export interface StockThresholds {
  minAbsolute: number;      // Stock mínimo absoluto (crítico si < esto)
  reorderPoint: number;     // Punto de pedido (warning si < esto)
  safetyStock: number;      // Stock de seguridad
  leadTimeDays: number;     // Días de entrega del proveedor
  packSize: number;         // Tamaño mínimo de pedido
}

export interface StockState {
  productId: string;
  productName: string;
  categoryId: string | null;

  // Barra
  barId: string;
  barName: string;

  // Inventario
  onHand: number;           // Stock físico actual en ESTA barra
  reserved: number;         // Reservado (pedidos pendientes)
  inTransit: number;        // En tránsito (pedidos a proveedor)
  available: number;        // = onHand - reserved + inTransit

  // Umbrales
  thresholds: StockThresholds;

  // Estado calculado
  severity: 'ok' | 'info' | 'warning' | 'critical';
  coverageHours: number | null;  // Horas de cobertura estimadas
  percentOfReorder: number;      // % respecto al punto de pedido

  // Alternativas (otras barras con stock)
  alternativeBars: Array<{ barId: string; barName: string; stock: number }>;

  // Timestamps
  lastUpdated: string;
  lastSaleAt: string | null;
}

export interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  severity: 'info' | 'warning' | 'critical';

  // Datos calculados (NO alucinaciones)
  currentStock: number;
  minStock: number;
  coverageHours: number | null;
  velocityPerHour: number;

  // Recomendación calculada
  suggestedOrderQty: number;
  suggestedAction: 'order' | 'transfer' | 'substitute' | 'limit_promo';

  // Para el LLM (solo contexto, no decide)
  contextForLLM: {
    dayOfWeek: string;
    currentHour: number;
    isWeekend: boolean;
    hasActivePromo: boolean;
  };

  // Control antispam
  createdAt: string;
  cooldownUntil: string | null;
  acknowledged: boolean;
  acknowledgedBy: string | null;
}

export interface SalesVelocity {
  productId: string;
  last1h: number;
  last2h: number;
  last4h: number;
  last24h: number;
  ewma: number;              // Exponential Weighted Moving Average
  trend: 'rising' | 'stable' | 'falling';
  peakHour: number;
  peakDayOfWeek: number;
}

// ============================================
// Storage
// ============================================

const THRESHOLDS_KEY = 'clubio_stock_thresholds';
const SALES_HISTORY_KEY = 'clubio_sales_history';

// Default thresholds (can be customized per product)
const DEFAULT_THRESHOLDS: StockThresholds = {
  minAbsolute: 5,
  reorderPoint: 20,
  safetyStock: 10,
  leadTimeDays: 1,
  packSize: 6,
};

// ============================================
// Thresholds Management
// ============================================

export function getProductThresholds(productId: string): StockThresholds {
  const stored = localStorage.getItem(THRESHOLDS_KEY);
  if (stored) {
    try {
      const all = JSON.parse(stored);
      return all[productId] || DEFAULT_THRESHOLDS;
    } catch {
      return DEFAULT_THRESHOLDS;
    }
  }
  return DEFAULT_THRESHOLDS;
}

export function setProductThresholds(productId: string, thresholds: Partial<StockThresholds>): void {
  const stored = localStorage.getItem(THRESHOLDS_KEY);
  const all = stored ? JSON.parse(stored) : {};
  all[productId] = { ...DEFAULT_THRESHOLDS, ...all[productId], ...thresholds };
  localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(all));
}

// ============================================
// Sales History (for velocity calculation)
// ============================================

interface SaleEvent {
  productId: string;
  barId?: string;  // Optional for backwards compatibility
  quantity: number;
  timestamp: string;
}

export function recordSale(productId: string, quantity: number, barId?: string): void {
  const stored = localStorage.getItem(SALES_HISTORY_KEY);
  const history: SaleEvent[] = stored ? JSON.parse(stored) : [];

  history.push({
    productId,
    barId,
    quantity,
    timestamp: new Date().toISOString(),
  });

  // Keep only last 7 days
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const filtered = history.filter(e => new Date(e.timestamp).getTime() > cutoff);

  localStorage.setItem(SALES_HISTORY_KEY, JSON.stringify(filtered));
}

function getSalesHistory(productId: string): SaleEvent[] {
  const stored = localStorage.getItem(SALES_HISTORY_KEY);
  if (!stored) return [];

  const all: SaleEvent[] = JSON.parse(stored);
  return all.filter(e => e.productId === productId);
}

function getSalesHistoryForBar(barId: string, productId: string): SaleEvent[] {
  const stored = localStorage.getItem(SALES_HISTORY_KEY);
  if (!stored) return [];

  const all: SaleEvent[] = JSON.parse(stored);
  return all.filter(e => e.productId === productId && e.barId === barId);
}

// ============================================
// Velocity Calculation (EWMA)
// ============================================

export function calculateVelocity(productId: string): SalesVelocity {
  const history = getSalesHistory(productId);
  const now = Date.now();

  // Calculate sales in different windows
  const sales1h = history
    .filter(e => now - new Date(e.timestamp).getTime() < 1 * 60 * 60 * 1000)
    .reduce((sum, e) => sum + e.quantity, 0);

  const sales2h = history
    .filter(e => now - new Date(e.timestamp).getTime() < 2 * 60 * 60 * 1000)
    .reduce((sum, e) => sum + e.quantity, 0);

  const sales4h = history
    .filter(e => now - new Date(e.timestamp).getTime() < 4 * 60 * 60 * 1000)
    .reduce((sum, e) => sum + e.quantity, 0);

  const sales24h = history
    .filter(e => now - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000)
    .reduce((sum, e) => sum + e.quantity, 0);

  // EWMA calculation (α = 0.3 for recent bias)
  const alpha = 0.3;
  const hourlyRates = [
    sales1h,
    sales2h / 2,
    sales4h / 4,
    sales24h / 24,
  ];

  let ewma = hourlyRates[hourlyRates.length - 1];
  for (let i = hourlyRates.length - 2; i >= 0; i--) {
    ewma = alpha * hourlyRates[i] + (1 - alpha) * ewma;
  }

  // Trend detection
  const recentRate = sales2h / 2;
  const olderRate = (sales24h - sales2h) / 22;
  let trend: 'rising' | 'stable' | 'falling' = 'stable';

  if (olderRate > 0) {
    const change = (recentRate - olderRate) / olderRate;
    if (change > 0.2) trend = 'rising';
    else if (change < -0.2) trend = 'falling';
  }

  // Peak detection
  const byHour = new Map<number, number>();
  const byDay = new Map<number, number>();

  history.forEach(e => {
    const date = new Date(e.timestamp);
    const hour = date.getHours();
    const day = date.getDay();

    byHour.set(hour, (byHour.get(hour) || 0) + e.quantity);
    byDay.set(day, (byDay.get(day) || 0) + e.quantity);
  });

  let peakHour = 22; // Default
  let peakHourQty = 0;
  byHour.forEach((qty, hour) => {
    if (qty > peakHourQty) {
      peakHour = hour;
      peakHourQty = qty;
    }
  });

  let peakDay = 5; // Friday default
  let peakDayQty = 0;
  byDay.forEach((qty, day) => {
    if (qty > peakDayQty) {
      peakDay = day;
      peakDayQty = qty;
    }
  });

  return {
    productId,
    last1h: sales1h,
    last2h: sales2h,
    last4h: sales4h,
    last24h: sales24h,
    ewma,
    trend,
    peakHour,
    peakDayOfWeek: peakDay,
  };
}

// Bar-specific velocity calculation
export function calculateVelocityForBar(barId: string, productId: string): SalesVelocity {
  const history = getSalesHistoryForBar(barId, productId);
  const now = Date.now();

  // Calculate sales in different windows
  const sales1h = history
    .filter(e => now - new Date(e.timestamp).getTime() < 1 * 60 * 60 * 1000)
    .reduce((sum, e) => sum + e.quantity, 0);

  const sales2h = history
    .filter(e => now - new Date(e.timestamp).getTime() < 2 * 60 * 60 * 1000)
    .reduce((sum, e) => sum + e.quantity, 0);

  const sales4h = history
    .filter(e => now - new Date(e.timestamp).getTime() < 4 * 60 * 60 * 1000)
    .reduce((sum, e) => sum + e.quantity, 0);

  const sales24h = history
    .filter(e => now - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000)
    .reduce((sum, e) => sum + e.quantity, 0);

  // EWMA calculation (α = 0.3 for recent bias)
  const alpha = 0.3;
  const hourlyRates = [
    sales1h,
    sales2h / 2,
    sales4h / 4,
    sales24h / 24,
  ];

  let ewma = hourlyRates[hourlyRates.length - 1];
  for (let i = hourlyRates.length - 2; i >= 0; i--) {
    ewma = alpha * hourlyRates[i] + (1 - alpha) * ewma;
  }

  // Trend detection
  const recentRate = sales2h / 2;
  const olderRate = (sales24h - sales2h) / 22;
  let trend: 'rising' | 'stable' | 'falling' = 'stable';

  if (olderRate > 0) {
    const change = (recentRate - olderRate) / olderRate;
    if (change > 0.2) trend = 'rising';
    else if (change < -0.2) trend = 'falling';
  }

  // Peak detection
  const byHour = new Map<number, number>();
  const byDay = new Map<number, number>();

  history.forEach(e => {
    const date = new Date(e.timestamp);
    const hour = date.getHours();
    const day = date.getDay();

    byHour.set(hour, (byHour.get(hour) || 0) + e.quantity);
    byDay.set(day, (byDay.get(day) || 0) + e.quantity);
  });

  let peakHour = 22; // Default
  let peakHourQty = 0;
  byHour.forEach((qty, hour) => {
    if (qty > peakHourQty) {
      peakHour = hour;
      peakHourQty = qty;
    }
  });

  let peakDay = 5; // Friday default
  let peakDayQty = 0;
  byDay.forEach((qty, day) => {
    if (qty > peakDayQty) {
      peakDay = day;
      peakDayQty = qty;
    }
  });

  return {
    productId,
    last1h: sales1h,
    last2h: sales2h,
    last4h: sales4h,
    last24h: sales24h,
    ewma,
    trend,
    peakHour,
    peakDayOfWeek: peakDay,
  };
}

// ============================================
// Stock State Evaluation (PER BAR)
// ============================================

export function evaluateBarStockState(
  barId: string,
  barName: string,
  product: Product,
  barInventoryItem?: BarInventoryItem
): StockState {
  const thresholds = getProductThresholds(product.id);
  const velocity = calculateVelocityForBar(barId, product.id);

  // Get stock from bar inventory, not product global stock
  const onHand = barInventoryItem?.quantity ?? getBarStock(barId, product.id);
  const reserved = 0; // TODO: connect to reservations
  const inTransit = 0; // TODO: connect to purchase orders
  const available = onHand - reserved + inTransit;

  // Use bar-specific minStock if available
  if (barInventoryItem?.minStock) {
    thresholds.minAbsolute = Math.min(thresholds.minAbsolute, barInventoryItem.minStock);
    thresholds.reorderPoint = barInventoryItem.minStock * 2;
  }

  // Calculate coverage hours
  let coverageHours: number | null = null;
  if (velocity.ewma > 0) {
    coverageHours = Math.round(available / velocity.ewma);
  }

  // Calculate % of reorder point
  const percentOfReorder = thresholds.reorderPoint > 0
    ? Math.round((available / thresholds.reorderPoint) * 100)
    : 100;

  // Determine severity
  let severity: StockState['severity'] = 'ok';

  if (available <= 0) {
    severity = 'critical';
  } else if (available < thresholds.minAbsolute) {
    severity = 'critical';
  } else if (coverageHours !== null && coverageHours < 1) {
    severity = 'critical';
  } else if (available < thresholds.reorderPoint) {
    severity = 'warning';
  } else if (coverageHours !== null && coverageHours < 4) {
    severity = 'warning';
  } else if (velocity.trend === 'rising' && percentOfReorder < 150) {
    severity = 'info';
  }

  // Find alternative bars with stock
  const alternatives = findAlternativeBars(barId, product.id, 1);
  const alternativeBars = alternatives.map(alt => ({
    barId: alt.bar.id,
    barName: alt.bar.name,
    stock: alt.availableStock,
  }));

  // Get last sale timestamp for this bar
  const history = getSalesHistoryForBar(barId, product.id);
  const lastSale = history.length > 0
    ? history.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
    : null;

  return {
    productId: product.id,
    productName: product.name,
    categoryId: product.categoryId || null,
    barId,
    barName,
    onHand,
    reserved,
    inTransit,
    available,
    thresholds,
    severity,
    coverageHours,
    percentOfReorder,
    alternativeBars,
    lastUpdated: new Date().toISOString(),
    lastSaleAt: lastSale?.timestamp || null,
  };
}

// Legacy function for backwards compatibility
export function evaluateStockState(product: Product): StockState {
  // Use first active bar as default
  const bars = loadBars().filter(b => b.isActive);
  const defaultBar = bars[0];

  if (!defaultBar) {
    // Fallback if no bars configured
    return evaluateBarStockState('default', 'Default', product);
  }

  return evaluateBarStockState(defaultBar.id, defaultBar.name, product);
}

// ============================================
// Replenishment Calculation
// ============================================

export interface ReplenishmentRecommendation {
  productId: string;
  suggestedQty: number;
  coverageDays: number;
  estimatedArrival: string;
  urgency: 'immediate' | 'today' | 'planned';
  action: 'order' | 'transfer' | 'substitute' | 'limit_promo';
  reasoning: string; // Auditable explanation (NOT AI generated)
}

export function calculateReplenishment(
  state: StockState,
  velocity: SalesVelocity
): ReplenishmentRecommendation {
  const { thresholds, available } = state;

  // Target: enough stock to cover lead time + safety buffer
  const dailyConsumption = velocity.ewma * 24;
  const targetCoverage = thresholds.leadTimeDays + 3; // +3 days buffer
  const targetStock = Math.ceil(dailyConsumption * targetCoverage) + thresholds.safetyStock;

  // Calculate needed quantity
  let neededQty = Math.max(0, targetStock - available);

  // Round up to pack size
  if (neededQty > 0) {
    neededQty = Math.ceil(neededQty / thresholds.packSize) * thresholds.packSize;
  }

  // At minimum, order the reorder point
  if (neededQty > 0 && neededQty < thresholds.reorderPoint) {
    neededQty = Math.ceil(thresholds.reorderPoint / thresholds.packSize) * thresholds.packSize;
  }

  // Determine urgency
  let urgency: ReplenishmentRecommendation['urgency'] = 'planned';
  if (state.severity === 'critical') {
    urgency = 'immediate';
  } else if (state.severity === 'warning') {
    urgency = 'today';
  }

  // Determine action
  let action: ReplenishmentRecommendation['action'] = 'order';
  if (urgency === 'immediate' && thresholds.leadTimeDays > 0) {
    // If critical and can't get supply today, suggest alternatives
    action = 'transfer'; // Try to get from another bar first
  }

  // Calculate estimated arrival
  const arrival = new Date();
  arrival.setDate(arrival.getDate() + thresholds.leadTimeDays);

  // Generate auditable reasoning
  const reasoning = [
    `Stock actual: ${available} uds`,
    `Velocidad EWMA: ${velocity.ewma.toFixed(1)} uds/hora`,
    `Consumo diario estimado: ${dailyConsumption.toFixed(0)} uds`,
    `Cobertura objetivo: ${targetCoverage} días`,
    `Stock objetivo: ${targetStock} uds`,
    `Cantidad a pedir: ${neededQty} uds (packs de ${thresholds.packSize})`,
  ].join('. ');

  return {
    productId: state.productId,
    suggestedQty: neededQty,
    coverageDays: targetCoverage,
    estimatedArrival: arrival.toISOString().split('T')[0],
    urgency,
    action,
    reasoning,
  };
}

// ============================================
// Batch Evaluation
// ============================================

export function evaluateAllProducts(products: Product[]): {
  states: StockState[];
  alerts: StockState[];
  recommendations: ReplenishmentRecommendation[];
} {
  const states: StockState[] = [];
  const alerts: StockState[] = [];
  const recommendations: ReplenishmentRecommendation[] = [];

  for (const product of products) {
    // Skip products without minStock configured
    if (!product.minStock || product.minStock <= 0) continue;

    const state = evaluateStockState(product);
    states.push(state);

    if (state.severity !== 'ok') {
      alerts.push(state);

      const velocity = calculateVelocity(product.id);
      const recommendation = calculateReplenishment(state, velocity);
      recommendations.push(recommendation);
    }
  }

  // Sort alerts by severity
  const severityOrder = { critical: 0, warning: 1, info: 2, ok: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return { states, alerts, recommendations };
}
