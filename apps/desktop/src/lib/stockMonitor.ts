// Stock Monitoring System
import { Product } from './api';

export interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  minStock: number;
  severity: 'low' | 'critical' | 'out';
  category?: string;
  createdAt: string;
  acknowledged: boolean;
  aiSuggestion?: string;
}

export interface StockStatus {
  product: Product;
  status: 'ok' | 'low' | 'critical' | 'out';
  percentRemaining: number;
}

const ALERTS_KEY = 'clubio_stock_alerts';
const MONITOR_SETTINGS_KEY = 'clubio_stock_monitor_settings';

export interface StockMonitorSettings {
  enabled: boolean;
  checkIntervalMinutes: number;
  lowStockThreshold: number; // Percentage of minStock (e.g., 150 = alert when at 150% of minStock)
  criticalStockThreshold: number; // Percentage of minStock (e.g., 100 = alert when at minStock)
  notifyInApp: boolean;
  notifyExternal: boolean;
  externalWebhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  whatsappWebhookUrl?: string;
}

const DEFAULT_SETTINGS: StockMonitorSettings = {
  enabled: true,
  checkIntervalMinutes: 15,
  lowStockThreshold: 150,
  criticalStockThreshold: 100,
  notifyInApp: true,
  notifyExternal: false,
};

// Load settings
export function loadMonitorSettings(): StockMonitorSettings {
  const stored = localStorage.getItem(MONITOR_SETTINGS_KEY);
  if (stored) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

// Save settings
export function saveMonitorSettings(settings: StockMonitorSettings): void {
  localStorage.setItem(MONITOR_SETTINGS_KEY, JSON.stringify(settings));
}

// Load alerts
export function loadStockAlerts(): StockAlert[] {
  const stored = localStorage.getItem(ALERTS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

// Save alerts
export function saveStockAlerts(alerts: StockAlert[]): void {
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

// Add new alert
export function addStockAlert(alert: Omit<StockAlert, 'id' | 'createdAt' | 'acknowledged'>): StockAlert {
  const alerts = loadStockAlerts();

  // Check if alert for this product already exists and is not acknowledged
  const existingAlert = alerts.find(
    (a) => a.productId === alert.productId && !a.acknowledged
  );

  if (existingAlert) {
    // Update existing alert if severity changed
    if (existingAlert.severity !== alert.severity) {
      existingAlert.severity = alert.severity;
      existingAlert.currentStock = alert.currentStock;
      existingAlert.aiSuggestion = alert.aiSuggestion;
      saveStockAlerts(alerts);
    }
    return existingAlert;
  }

  const newAlert: StockAlert = {
    ...alert,
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    acknowledged: false,
  };

  alerts.unshift(newAlert);
  saveStockAlerts(alerts);

  return newAlert;
}

// Acknowledge alert
export function acknowledgeAlert(alertId: string): void {
  const alerts = loadStockAlerts();
  const alert = alerts.find((a) => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    saveStockAlerts(alerts);
  }
}

// Clear old acknowledged alerts (older than 24 hours)
export function clearOldAlerts(): void {
  const alerts = loadStockAlerts();
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  const filtered = alerts.filter((a) => {
    if (!a.acknowledged) return true;
    return new Date(a.createdAt).getTime() > oneDayAgo;
  });

  saveStockAlerts(filtered);
}

// Check stock levels for all products
export function checkStockLevels(products: Product[]): StockStatus[] {
  const settings = loadMonitorSettings();

  return products
    .filter((p) => p.minStock !== undefined && p.minStock > 0)
    .map((product) => {
      const currentStock = product.stock || 0;
      const minStock = product.minStock || 1;
      const percentRemaining = (currentStock / minStock) * 100;

      let status: StockStatus['status'] = 'ok';

      if (currentStock === 0) {
        status = 'out';
      } else if (percentRemaining <= settings.criticalStockThreshold) {
        status = 'critical';
      } else if (percentRemaining <= settings.lowStockThreshold) {
        status = 'low';
      }

      return {
        product,
        status,
        percentRemaining,
      };
    });
}

// Get products with stock issues
export function getStockIssues(products: Product[]): StockStatus[] {
  return checkStockLevels(products).filter((s) => s.status !== 'ok');
}

// Format alert for display
export function formatAlertMessage(alert: StockAlert): string {
  const severityLabels = {
    low: 'Stock Bajo',
    critical: 'Stock Crítico',
    out: 'Sin Stock',
  };

  return `${severityLabels[alert.severity]}: ${alert.productName} (${alert.currentStock}/${alert.minStock} unidades)`;
}

// Calculate suggested restock quantity
export function calculateRestockQuantity(
  currentStock: number,
  minStock: number,
  avgDailySales: number = 0
): number {
  // Target: 7 days of stock or 3x minStock, whichever is higher
  const targetFromSales = avgDailySales * 7;
  const targetFromMin = minStock * 3;
  const target = Math.max(targetFromSales, targetFromMin, minStock * 2);

  return Math.max(0, Math.ceil(target - currentStock));
}
