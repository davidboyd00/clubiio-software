// ============================================
// STOCK ALERTS AGENT - TYPES
// ============================================
// AI Agent for monitoring high-rotation product stock
// Notifies administrators (NOT cashiers) when stock is low

// Product rotation classification
export type ProductRotation = 'high' | 'medium' | 'low';

// Product type for stock monitoring
export type MonitoredProductType =
  | 'bebida_preparada'  // Prepared drinks (cocktails, etc.)
  | 'cerveza_tirada'    // Draft beer
  | 'pisco'             // Pisco and similar spirits (by serving)
  | 'vino_copa'         // Wine by the glass
  | 'shot';             // Shots

// Excluded from monitoring (full bottles, etc.)
export type ExcludedProductType =
  | 'botella'           // Full bottles
  | 'merchandise'       // Merchandise
  | 'food';             // Food items

// Alert severity levels
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';

// Alert status
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'expired';

// Notification channel
export type NotificationChannel = 'websocket' | 'push' | 'email' | 'sms';

// User role for notification routing
export type NotificationRole = 'admin' | 'manager' | 'supervisor';

// ============================================
// CONFIGURATION
// ============================================

export interface StockAlertThresholds {
  critical: number;    // e.g., 10% - triggers immediate alert
  warning: number;     // e.g., 25% - triggers warning
  info: number;        // e.g., 40% - triggers info notification
}

export interface MonitoredCategory {
  categoryId: string;
  categoryName: string;
  productType: MonitoredProductType;
  rotation: ProductRotation;
  thresholds: StockAlertThresholds;
  enabled: boolean;
}

export interface StockAlertConfig {
  configId: string;
  venueId: string;
  enabled: boolean;

  // Default thresholds (can be overridden per category)
  defaultThresholds: StockAlertThresholds;

  // Categories to monitor
  monitoredCategories: MonitoredCategory[];

  // Notification settings
  notifications: {
    channels: NotificationChannel[];
    roles: NotificationRole[];           // Who receives alerts
    cooldownMinutes: number;             // Min time between repeated alerts
    aggregateAlerts: boolean;            // Group multiple alerts together
    aggregateWindowSeconds: number;      // Window for aggregation
  };

  // Monitoring settings
  monitoring: {
    checkIntervalSeconds: number;        // How often to check stock
    forecastEnabled: boolean;            // Use demand forecasting
    forecastHorizonMinutes: number;      // How far ahead to forecast
  };
}

// ============================================
// STOCK STATE
// ============================================

export interface ProductStockLevel {
  productId: string;
  sku: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  productType: MonitoredProductType;
  rotation: ProductRotation;

  // Current stock
  currentStock: number;
  maxCapacity: number;
  stockPercentage: number;

  // Location
  barId: string;
  barName: string;

  // Forecasting
  demandRatePerHour: number;
  estimatedDepletionMinutes: number | null;

  // Timestamps
  lastUpdated: Date;
  lastRestocked: Date | null;
}

export interface BarStockSnapshot {
  barId: string;
  barName: string;
  venueId: string;
  timestamp: Date;

  products: ProductStockLevel[];

  // Summary stats
  summary: {
    totalProducts: number;
    criticalCount: number;
    warningCount: number;
    healthyCount: number;
    overallHealthPercentage: number;
  };
}

// ============================================
// ALERTS
// ============================================

export interface StockAlert {
  alertId: string;
  venueId: string;
  barId: string;
  barName: string;

  // Product info
  productId: string;
  productName: string;
  sku: string;
  categoryName: string;
  productType: MonitoredProductType;

  // Alert details
  severity: AlertSeverity;
  status: AlertStatus;

  // Stock info at time of alert
  currentStock: number;
  maxCapacity: number;
  stockPercentage: number;
  threshold: number;

  // Forecasting
  estimatedDepletionMinutes: number | null;
  demandRatePerHour: number;

  // Suggested action
  suggestedAction: string;
  suggestedRestockQty: number;

  // Timestamps
  createdAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  resolvedAt: Date | null;
  expiresAt: Date;

  // Notification tracking
  notificationsSent: Array<{
    channel: NotificationChannel;
    sentAt: Date;
    recipientId: string;
    recipientRole: NotificationRole;
  }>;
}

export interface StockAlertEvent {
  eventId: string;
  eventType: 'alert_created' | 'alert_acknowledged' | 'alert_resolved' | 'alert_expired' | 'stock_restocked';
  alert: StockAlert;
  timestamp: Date;
  triggeredBy?: string;
}

// ============================================
// NOTIFICATIONS
// ============================================

export interface StockAlertNotification {
  notificationId: string;
  alertId: string;

  // Recipient
  recipientId: string;
  recipientRole: NotificationRole;
  channel: NotificationChannel;

  // Content
  title: string;
  message: string;
  data: {
    barId: string;
    barName: string;
    productId: string;
    productName: string;
    stockPercentage: number;
    severity: AlertSeverity;
  };

  // Status
  sentAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;

  // Actions
  actionUrl: string;
  actions: Array<{
    label: string;
    action: 'acknowledge' | 'view_details' | 'restock' | 'dismiss';
    url: string;
  }>;
}

// ============================================
// API RESPONSES
// ============================================

export interface GetAlertsResponse {
  alerts: StockAlert[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
  summary: {
    critical: number;
    warning: number;
    info: number;
    activeTotal: number;
  };
}

export interface GetBarStockResponse {
  snapshot: BarStockSnapshot;
  alerts: StockAlert[];
  recommendations: Array<{
    productId: string;
    productName: string;
    action: 'restock_now' | 'restock_soon' | 'monitor';
    suggestedQty: number;
    priority: number;
    reason: string;
  }>;
}

export interface AcknowledgeAlertResponse {
  alert: StockAlert;
  success: boolean;
}

export interface StockAlertStats {
  venueId: string;
  period: {
    start: Date;
    end: Date;
  };

  // Alert counts
  totalAlerts: number;
  byServity: Record<AlertSeverity, number>;
  byBar: Record<string, number>;
  byProductType: Record<MonitoredProductType, number>;

  // Response times
  avgAcknowledgeTimeMinutes: number;
  avgResolveTimeMinutes: number;

  // Trends
  alertTrend: 'increasing' | 'stable' | 'decreasing';
  mostAffectedProducts: Array<{
    productId: string;
    productName: string;
    alertCount: number;
  }>;
}
