import { EventEmitter } from 'events';
import type {
  StockAlertConfig,
  ProductStockLevel,
  BarStockSnapshot,
  MonitoredProductType,
} from './stock-alerts.types';
import type { StockUpdateEvent } from './stock-alerts.schema';

// ============================================
// STOCK MONITOR SERVICE
// ============================================
// Monitors inventory levels in real-time for high-rotation products
// Emits events when stock levels change or reach thresholds

export interface StockMonitorEvents {
  'stock:updated': (data: ProductStockLevel) => void;
  'stock:low': (data: ProductStockLevel) => void;
  'stock:critical': (data: ProductStockLevel) => void;
  'stock:depleted': (data: ProductStockLevel) => void;
  'stock:restocked': (data: ProductStockLevel) => void;
  'snapshot:updated': (data: BarStockSnapshot) => void;
}

class StockMonitorService extends EventEmitter {
  private config: StockAlertConfig | null = null;
  private stockCache: Map<string, Map<string, ProductStockLevel>> = new Map(); // barId -> productId -> level
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  // High-rotation product types that should be monitored
  private readonly HIGH_ROTATION_TYPES: MonitoredProductType[] = [
    'bebida_preparada',
    'cerveza_tirada',
    'pisco',
    'vino_copa',
    'shot',
  ];

  constructor() {
    super();
    this.setMaxListeners(100); // Allow many listeners for WebSocket connections
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  setConfig(config: StockAlertConfig): void {
    this.config = config;
    console.log(`[StockMonitor] Configuration updated for venue ${config.venueId}`);
  }

  getConfig(): StockAlertConfig | null {
    return this.config;
  }

  // ============================================
  // MONITORING LIFECYCLE
  // ============================================

  start(): void {
    if (this.isRunning) {
      console.log('[StockMonitor] Already running');
      return;
    }

    if (!this.config) {
      throw new Error('[StockMonitor] Configuration required before starting');
    }

    this.isRunning = true;
    const intervalMs = (this.config.monitoring.checkIntervalSeconds || 30) * 1000;

    this.monitoringInterval = setInterval(() => {
      this.checkAllBars();
    }, intervalMs);

    console.log(`[StockMonitor] Started with ${intervalMs}ms interval`);
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    console.log('[StockMonitor] Stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }

  // ============================================
  // STOCK TRACKING
  // ============================================

  /**
   * Process a stock update event (from POS sale, restock, etc.)
   */
  processStockUpdate(event: StockUpdateEvent): ProductStockLevel | null {
    if (!this.config?.enabled) return null;

    const barStock = this.stockCache.get(event.barId);
    if (!barStock) {
      console.warn(`[StockMonitor] No stock cache for bar ${event.barId}`);
      return null;
    }

    const product = barStock.get(event.productId);
    if (!product) {
      console.warn(`[StockMonitor] Product ${event.productId} not in cache for bar ${event.barId}`);
      return null;
    }

    // Update stock level
    const previousPercentage = product.stockPercentage;
    product.currentStock = event.newStock;
    product.stockPercentage = product.maxCapacity > 0
      ? (event.newStock / product.maxCapacity) * 100
      : 0;
    product.lastUpdated = event.timestamp;

    // Update depletion estimate
    if (product.demandRatePerHour > 0) {
      product.estimatedDepletionMinutes = (product.currentStock / product.demandRatePerHour) * 60;
    }

    // Emit appropriate events
    this.emit('stock:updated', product);

    if (event.changeType === 'restock') {
      product.lastRestocked = event.timestamp;
      this.emit('stock:restocked', product);
    }

    // Check thresholds
    this.checkThresholds(product, previousPercentage);

    return product;
  }

  /**
   * Initialize stock cache for a bar
   */
  initializeBarStock(barId: string, products: ProductStockLevel[]): void {
    const barStock = new Map<string, ProductStockLevel>();

    for (const product of products) {
      // Only cache high-rotation products
      if (this.isHighRotationProduct(product.productType)) {
        barStock.set(product.productId, product);
      }
    }

    this.stockCache.set(barId, barStock);
    console.log(`[StockMonitor] Initialized ${barStock.size} products for bar ${barId}`);
  }

  /**
   * Get current stock snapshot for a bar
   */
  getBarSnapshot(barId: string): BarStockSnapshot | null {
    const barStock = this.stockCache.get(barId);
    if (!barStock) return null;

    const products = Array.from(barStock.values());
    const thresholds = this.config?.defaultThresholds || { critical: 10, warning: 25, info: 40 };

    const criticalCount = products.filter(p => p.stockPercentage <= thresholds.critical).length;
    const warningCount = products.filter(p =>
      p.stockPercentage > thresholds.critical && p.stockPercentage <= thresholds.warning
    ).length;
    const healthyCount = products.filter(p => p.stockPercentage > thresholds.warning).length;

    return {
      barId,
      barName: products[0]?.barName || 'Unknown',
      venueId: this.config?.venueId || '',
      timestamp: new Date(),
      products,
      summary: {
        totalProducts: products.length,
        criticalCount,
        warningCount,
        healthyCount,
        overallHealthPercentage: products.length > 0
          ? (healthyCount / products.length) * 100
          : 100,
      },
    };
  }

  /**
   * Get all bars' stock status
   */
  getAllBarsSnapshot(): BarStockSnapshot[] {
    const snapshots: BarStockSnapshot[] = [];

    for (const barId of this.stockCache.keys()) {
      const snapshot = this.getBarSnapshot(barId);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }

    return snapshots;
  }

  /**
   * Get products below a certain threshold
   */
  getLowStockProducts(thresholdPercentage: number = 10): ProductStockLevel[] {
    const lowStock: ProductStockLevel[] = [];

    for (const barStock of this.stockCache.values()) {
      for (const product of barStock.values()) {
        if (product.stockPercentage <= thresholdPercentage) {
          lowStock.push(product);
        }
      }
    }

    // Sort by stock percentage (lowest first)
    return lowStock.sort((a, b) => a.stockPercentage - b.stockPercentage);
  }

  // ============================================
  // DEMAND FORECASTING
  // ============================================

  /**
   * Update demand rate for a product based on recent sales
   */
  updateDemandRate(barId: string, productId: string, salesLastHour: number): void {
    const barStock = this.stockCache.get(barId);
    if (!barStock) return;

    const product = barStock.get(productId);
    if (!product) return;

    // Exponential moving average for smoother forecasting
    const alpha = 0.3; // Smoothing factor
    product.demandRatePerHour = alpha * salesLastHour + (1 - alpha) * product.demandRatePerHour;

    // Update depletion estimate
    if (product.demandRatePerHour > 0) {
      product.estimatedDepletionMinutes = (product.currentStock / product.demandRatePerHour) * 60;
    } else {
      product.estimatedDepletionMinutes = null;
    }
  }

  /**
   * Get products that will deplete within a time horizon
   */
  getProductsDepletingSoon(horizonMinutes: number = 30): ProductStockLevel[] {
    const depleting: ProductStockLevel[] = [];

    for (const barStock of this.stockCache.values()) {
      for (const product of barStock.values()) {
        if (
          product.estimatedDepletionMinutes !== null &&
          product.estimatedDepletionMinutes <= horizonMinutes &&
          product.currentStock > 0
        ) {
          depleting.push(product);
        }
      }
    }

    // Sort by depletion time (soonest first)
    return depleting.sort((a, b) =>
      (a.estimatedDepletionMinutes || Infinity) - (b.estimatedDepletionMinutes || Infinity)
    );
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private checkAllBars(): void {
    for (const barId of this.stockCache.keys()) {
      const snapshot = this.getBarSnapshot(barId);
      if (snapshot) {
        this.emit('snapshot:updated', snapshot);

        // Check each product
        for (const product of snapshot.products) {
          this.checkThresholds(product);
        }
      }
    }
  }

  private checkThresholds(product: ProductStockLevel, previousPercentage?: number): void {
    if (!this.config) return;

    const thresholds = this.getThresholdsForProduct(product);
    const current = product.stockPercentage;
    const previous = previousPercentage ?? current + 1; // Assume was higher if not provided

    // Only emit if crossing threshold downward
    if (current <= 0 && previous > 0) {
      this.emit('stock:depleted', product);
    } else if (current <= thresholds.critical && previous > thresholds.critical) {
      this.emit('stock:critical', product);
    } else if (current <= thresholds.warning && previous > thresholds.warning) {
      this.emit('stock:low', product);
    }
  }

  private getThresholdsForProduct(product: ProductStockLevel) {
    // Check if category has custom thresholds
    const categoryConfig = this.config?.monitoredCategories.find(
      c => c.categoryId === product.categoryId
    );

    if (categoryConfig?.thresholds) {
      return categoryConfig.thresholds;
    }

    return this.config?.defaultThresholds || { critical: 10, warning: 25, info: 40 };
  }

  private isHighRotationProduct(productType: MonitoredProductType): boolean {
    return this.HIGH_ROTATION_TYPES.includes(productType);
  }

  /**
   * Calculate suggested restock quantity based on demand forecast
   */
  calculateSuggestedRestock(product: ProductStockLevel, targetHours: number = 4): number {
    const targetStock = product.demandRatePerHour * targetHours;
    const deficit = Math.max(0, targetStock - product.currentStock);

    // Round up to nearest 5 for practical restocking
    return Math.ceil(deficit / 5) * 5;
  }
}

// Singleton instance
export const stockMonitor = new StockMonitorService();

export default stockMonitor;
