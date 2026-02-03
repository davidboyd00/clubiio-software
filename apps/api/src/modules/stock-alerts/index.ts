// ============================================
// STOCK ALERTS MODULE - PUBLIC EXPORTS
// ============================================

// Router
export { default as stockAlertsRouter } from './stock-alerts.router';

// Services (singleton instances)
export { stockMonitor } from './stock-monitor.service';
export { alertEngine } from './alert-engine.service';
export { notificationRouter } from './notification-router.service';

// Types
export type {
  ProductRotation,
  MonitoredProductType,
  ExcludedProductType,
  AlertSeverity,
  AlertStatus,
  NotificationChannel,
  NotificationRole,
  StockAlertThresholds,
  MonitoredCategory,
  StockAlertConfig,
  ProductStockLevel,
  BarStockSnapshot,
  StockAlert,
  StockAlertEvent,
  StockAlertNotification,
  GetAlertsResponse,
  GetBarStockResponse,
  AcknowledgeAlertResponse,
  StockAlertStats,
} from './stock-alerts.types';

// Schemas
export {
  productRotationSchema,
  monitoredProductTypeSchema,
  alertSeveritySchema,
  alertStatusSchema,
  notificationChannelSchema,
  notificationRoleSchema,
  stockAlertThresholdsSchema,
  monitoredCategorySchema,
  createStockAlertConfigSchema,
  updateStockAlertConfigSchema,
  acknowledgeAlertSchema,
  resolveAlertSchema,
  bulkAcknowledgeSchema,
  getAlertsQuerySchema,
  getBarStockQuerySchema,
  getStatsQuerySchema,
  stockUpdateEventSchema,
  restockEventSchema,
  addMonitoredCategorySchema,
  updateMonitoredCategorySchema,
  removeMonitoredCategorySchema,
} from './stock-alerts.schema';

// Schema types
export type {
  CreateStockAlertConfigInput,
  UpdateStockAlertConfigInput,
  AcknowledgeAlertInput,
  ResolveAlertInput,
  BulkAcknowledgeInput,
  GetAlertsQuery,
  GetBarStockQuery,
  GetStatsQuery,
  StockUpdateEvent,
  RestockEvent,
  AddMonitoredCategoryInput,
  UpdateMonitoredCategoryInput,
} from './stock-alerts.schema';
