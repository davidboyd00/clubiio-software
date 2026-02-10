import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import type {
  StockAlert,
  StockAlertConfig,
  ProductStockLevel,
  AlertSeverity,
  AlertStatus,
  StockAlertEvent,
  MonitoredProductType,
} from './stock-alerts.types';
import { stockMonitor } from './stock-monitor.service';

// ============================================
// ALERT ENGINE SERVICE
// ============================================
// Creates and manages stock alerts based on monitoring events
// Filters alerts to only high-rotation products (NOT bottles)

export interface AlertEngineEvents {
  'alert:created': (alert: StockAlert) => void;
  'alert:updated': (alert: StockAlert) => void;
  'alert:acknowledged': (alert: StockAlert, acknowledgedBy: string) => void;
  'alert:resolved': (alert: StockAlert) => void;
  'alert:expired': (alert: StockAlert) => void;
}

class AlertEngineService extends EventEmitter {
  private config: StockAlertConfig | null = null;
  private alerts: Map<string, StockAlert> = new Map();
  private alertCooldowns: Map<string, Date> = new Map(); // productId-barId -> lastAlertTime
  private alertHistory: StockAlertEvent[] = [];

  // Products to EXCLUDE from alerts (bottles, merchandise, etc.)
  private readonly EXCLUDED_KEYWORDS = [
    'botella',
    'bottle',
    'magnum',
    'merchandise',
    'merch',
    'food',
    'comida',
  ];

  constructor() {
    super();
    this.setMaxListeners(100);
    this.setupMonitorListeners();
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  setConfig(config: StockAlertConfig): void {
    this.config = config;
    stockMonitor.setConfig(config);
    console.log(`[AlertEngine] Configuration updated for venue ${config.venueId}`);
  }

  getConfig(): StockAlertConfig | null {
    return this.config;
  }

  // ============================================
  // MONITOR EVENT HANDLERS
  // ============================================

  private setupMonitorListeners(): void {
    // Critical stock level (≤10%)
    stockMonitor.on('stock:critical', (product: ProductStockLevel) => {
      this.handleLowStock(product, 'critical');
    });

    // Low stock level (≤25%)
    stockMonitor.on('stock:low', (product: ProductStockLevel) => {
      this.handleLowStock(product, 'warning');
    });

    // Depleted stock
    stockMonitor.on('stock:depleted', (product: ProductStockLevel) => {
      this.handleLowStock(product, 'emergency');
    });

    // Stock restocked - resolve related alerts
    stockMonitor.on('stock:restocked', (product: ProductStockLevel) => {
      this.handleRestock(product);
    });
  }

  private handleLowStock(product: ProductStockLevel, severity: AlertSeverity): void {
    if (!this.config?.enabled) return;

    // Filter: Only monitor high-rotation products
    if (!this.isMonitoredProduct(product)) {
      console.log(`[AlertEngine] Skipping non-monitored product: ${product.productName}`);
      return;
    }

    // Filter: Exclude bottles and non-serving items
    if (this.isExcludedProduct(product.productName)) {
      console.log(`[AlertEngine] Skipping excluded product (bottle/etc): ${product.productName}`);
      return;
    }

    // Check cooldown to prevent alert spam
    const cooldownKey = `${product.productId}-${product.barId}`;
    const lastAlert = this.alertCooldowns.get(cooldownKey);
    const cooldownMs = (this.config.notifications.cooldownMinutes || 5) * 60 * 1000;

    if (lastAlert && Date.now() - lastAlert.getTime() < cooldownMs) {
      console.log(`[AlertEngine] Alert on cooldown for ${product.productName}`);
      return;
    }

    // Create alert
    const alert = this.createAlert(product, severity);
    this.alerts.set(alert.alertId, alert);
    this.alertCooldowns.set(cooldownKey, new Date());

    // Record event
    this.recordEvent('alert_created', alert);

    // Emit for notification routing
    this.emit('alert:created', alert);

    console.log(`[AlertEngine] Created ${severity} alert for ${product.productName} at ${product.barName}`);
  }

  private handleRestock(product: ProductStockLevel): void {
    // Find active alerts for this product/bar and resolve them
    for (const alert of this.alerts.values()) {
      if (
        alert.productId === product.productId &&
        alert.barId === product.barId &&
        alert.status === 'active'
      ) {
        this.resolveAlert(alert.alertId, 'restocked');
      }
    }
  }

  // ============================================
  // ALERT MANAGEMENT
  // ============================================

  private createAlert(product: ProductStockLevel, severity: AlertSeverity): StockAlert {
    const suggestedQty = stockMonitor.calculateSuggestedRestock(product);

    return {
      alertId: randomUUID(),
      venueId: this.config?.venueId || '',
      barId: product.barId,
      barName: product.barName,

      productId: product.productId,
      productName: product.productName,
      sku: product.sku,
      categoryName: product.categoryName,
      productType: product.productType,

      severity,
      status: 'active',

      currentStock: product.currentStock,
      maxCapacity: product.maxCapacity,
      stockPercentage: product.stockPercentage,
      threshold: this.getThresholdForSeverity(severity),

      estimatedDepletionMinutes: product.estimatedDepletionMinutes,
      demandRatePerHour: product.demandRatePerHour,

      suggestedAction: this.getSuggestedAction(severity, product),
      suggestedRestockQty: suggestedQty,

      createdAt: new Date(),
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours

      notificationsSent: [],
    };
  }

  acknowledgeAlert(alertId: string, userId: string, _note?: string): StockAlert | null {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== 'active') return null;

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;

    this.recordEvent('alert_acknowledged', alert, userId);
    this.emit('alert:acknowledged', alert, userId);

    console.log(`[AlertEngine] Alert ${alertId} acknowledged by ${userId}`);
    return alert;
  }

  resolveAlert(
    alertId: string,
    resolution: 'restocked' | 'removed_from_menu' | 'false_alarm' | 'other' = 'restocked',
    resolvedBy?: string
  ): StockAlert | null {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status === 'resolved') return null;

    alert.status = 'resolved';
    alert.resolvedAt = new Date();

    this.recordEvent('alert_resolved', alert, resolvedBy);
    this.emit('alert:resolved', alert);

    console.log(`[AlertEngine] Alert ${alertId} resolved (${resolution})`);
    return alert;
  }

  bulkAcknowledge(alertIds: string[], userId: string): StockAlert[] {
    const acknowledged: StockAlert[] = [];

    for (const alertId of alertIds) {
      const alert = this.acknowledgeAlert(alertId, userId);
      if (alert) acknowledged.push(alert);
    }

    return acknowledged;
  }

  // ============================================
  // QUERIES
  // ============================================

  getAlert(alertId: string): StockAlert | null {
    return this.alerts.get(alertId) || null;
  }

  getAlerts(options: {
    barId?: string;
    status?: AlertStatus;
    severity?: AlertSeverity;
    productType?: MonitoredProductType;
  } = {}): StockAlert[] {
    let results = Array.from(this.alerts.values());

    if (options.barId) {
      results = results.filter(a => a.barId === options.barId);
    }
    if (options.status) {
      results = results.filter(a => a.status === options.status);
    }
    if (options.severity) {
      results = results.filter(a => a.severity === options.severity);
    }
    if (options.productType) {
      results = results.filter(a => a.productType === options.productType);
    }

    // Sort by severity (emergency first) then by created date
    return results.sort((a, b) => {
      const severityOrder = { emergency: 0, critical: 1, warning: 2, info: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  getActiveAlerts(): StockAlert[] {
    return this.getAlerts({ status: 'active' });
  }

  getAlertStats() {
    const alerts = Array.from(this.alerts.values());
    const active = alerts.filter(a => a.status === 'active');

    return {
      total: alerts.length,
      active: active.length,
      bySeverity: {
        emergency: active.filter(a => a.severity === 'emergency').length,
        critical: active.filter(a => a.severity === 'critical').length,
        warning: active.filter(a => a.severity === 'warning').length,
        info: active.filter(a => a.severity === 'info').length,
      },
      byBar: this.groupBy(active, 'barId'),
    };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private isMonitoredProduct(product: ProductStockLevel): boolean {
    if (!this.config) return false;

    // Check if category is in monitored list
    const monitoredCategory = this.config.monitoredCategories.find(
      c => c.categoryId === product.categoryId && c.enabled
    );

    if (monitoredCategory) return true;

    // Default: monitor high-rotation products
    return product.rotation === 'high';
  }

  private isExcludedProduct(productName: string): boolean {
    const nameLower = productName.toLowerCase();
    return this.EXCLUDED_KEYWORDS.some(keyword => nameLower.includes(keyword));
  }

  private getThresholdForSeverity(severity: AlertSeverity): number {
    const thresholds = this.config?.defaultThresholds || { critical: 10, warning: 25, info: 40 };

    switch (severity) {
      case 'emergency': return 0;
      case 'critical': return thresholds.critical;
      case 'warning': return thresholds.warning;
      case 'info': return thresholds.info;
      default: return 10;
    }
  }

  private getSuggestedAction(severity: AlertSeverity, product: ProductStockLevel): string {
    switch (severity) {
      case 'emergency':
        return `URGENTE: ${product.productName} agotado en ${product.barName}. Reabastecer inmediatamente.`;
      case 'critical':
        return `Reabastecer ${product.productName} en ${product.barName}. Stock al ${product.stockPercentage.toFixed(0)}%.`;
      case 'warning':
        return `Planificar reabastecimiento de ${product.productName} en ${product.barName}.`;
      default:
        return `Monitorear stock de ${product.productName}.`;
    }
  }

  private recordEvent(
    eventType: StockAlertEvent['eventType'],
    alert: StockAlert,
    triggeredBy?: string
  ): void {
    this.alertHistory.push({
      eventId: randomUUID(),
      eventType,
      alert: { ...alert },
      timestamp: new Date(),
      triggeredBy,
    });

    // Keep last 1000 events
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }
  }

  private groupBy(alerts: StockAlert[], key: keyof StockAlert): Record<string, number> {
    return alerts.reduce((acc, alert) => {
      const value = String(alert[key]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  // ============================================
  // CLEANUP
  // ============================================

  cleanupExpiredAlerts(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [, alert] of this.alerts) {
      if (alert.expiresAt < now && alert.status === 'active') {
        alert.status = 'expired';
        this.recordEvent('alert_expired', alert);
        this.emit('alert:expired', alert);
        cleaned++;
      }
    }

    console.log(`[AlertEngine] Cleaned up ${cleaned} expired alerts`);
    return cleaned;
  }
}

// Singleton instance
export const alertEngine = new AlertEngineService();

export default alertEngine;
