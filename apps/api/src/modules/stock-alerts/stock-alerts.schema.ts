import { z } from 'zod';

// ============================================
// STOCK ALERTS AGENT - SCHEMAS
// ============================================

// Enums as Zod schemas
export const productRotationSchema = z.enum(['high', 'medium', 'low']);

export const monitoredProductTypeSchema = z.enum([
  'bebida_preparada',
  'cerveza_tirada',
  'pisco',
  'vino_copa',
  'shot',
]);

export const alertSeveritySchema = z.enum(['info', 'warning', 'critical', 'emergency']);

export const alertStatusSchema = z.enum(['active', 'acknowledged', 'resolved', 'expired']);

export const notificationChannelSchema = z.enum(['websocket', 'push', 'email', 'sms']);

export const notificationRoleSchema = z.enum(['admin', 'manager', 'supervisor']);

// ============================================
// CONFIGURATION SCHEMAS
// ============================================

export const stockAlertThresholdsSchema = z.object({
  critical: z.number().min(0).max(100).default(10),   // 10%
  warning: z.number().min(0).max(100).default(25),    // 25%
  info: z.number().min(0).max(100).default(40),       // 40%
}).refine(
  (data) => data.critical < data.warning && data.warning < data.info,
  { message: 'Thresholds must be in order: critical < warning < info' }
);

export const monitoredCategorySchema = z.object({
  categoryId: z.string().uuid(),
  categoryName: z.string().min(1).max(100),
  productType: monitoredProductTypeSchema,
  rotation: productRotationSchema,
  thresholds: stockAlertThresholdsSchema.optional(),
  enabled: z.boolean().default(true),
});

export const createStockAlertConfigSchema = z.object({
  enabled: z.boolean().default(true),

  defaultThresholds: stockAlertThresholdsSchema.default({
    critical: 10,
    warning: 25,
    info: 40,
  }),

  monitoredCategories: z.array(monitoredCategorySchema).default([]),

  notifications: z.object({
    channels: z.array(notificationChannelSchema).default(['websocket', 'push']),
    roles: z.array(notificationRoleSchema).default(['admin', 'manager']),
    cooldownMinutes: z.number().min(1).max(60).default(5),
    aggregateAlerts: z.boolean().default(true),
    aggregateWindowSeconds: z.number().min(10).max(300).default(30),
  }).default({}),

  monitoring: z.object({
    checkIntervalSeconds: z.number().min(10).max(300).default(30),
    forecastEnabled: z.boolean().default(true),
    forecastHorizonMinutes: z.number().min(5).max(120).default(30),
  }).default({}),
});

export const updateStockAlertConfigSchema = createStockAlertConfigSchema.partial();

// ============================================
// ALERT MANAGEMENT SCHEMAS
// ============================================

export const acknowledgeAlertSchema = z.object({
  alertId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export const resolveAlertSchema = z.object({
  alertId: z.string().uuid(),
  resolution: z.enum(['restocked', 'removed_from_menu', 'false_alarm', 'other']),
  restockedQty: z.number().min(0).optional(),
  note: z.string().max(500).optional(),
});

export const bulkAcknowledgeSchema = z.object({
  alertIds: z.array(z.string().uuid()).min(1).max(50),
  note: z.string().max(500).optional(),
});

// ============================================
// QUERY SCHEMAS
// ============================================

export const getAlertsQuerySchema = z.object({
  barId: z.string().uuid().optional(),
  status: alertStatusSchema.optional(),
  severity: alertSeveritySchema.optional(),
  productType: monitoredProductTypeSchema.optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'severity', 'stockPercentage']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const getBarStockQuerySchema = z.object({
  barId: z.string().uuid(),
  includeAlerts: z.coerce.boolean().default(true),
  includeRecommendations: z.coerce.boolean().default(true),
});

export const getStatsQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  barId: z.string().uuid().optional(),
});

// ============================================
// STOCK UPDATE SCHEMAS (from POS/Inventory)
// ============================================

export const stockUpdateEventSchema = z.object({
  barId: z.string().uuid(),
  productId: z.string().uuid(),
  previousStock: z.number().min(0),
  newStock: z.number().min(0),
  changeType: z.enum(['sale', 'restock', 'adjustment', 'waste', 'transfer']),
  quantity: z.number(),
  timestamp: z.coerce.date().default(() => new Date()),
  staffId: z.string().uuid().optional(),
});

export const restockEventSchema = z.object({
  barId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().min(1),
    newTotal: z.number().min(0),
  })).min(1),
  staffId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

// ============================================
// CATEGORY CONFIGURATION SCHEMAS
// ============================================

export const addMonitoredCategorySchema = z.object({
  categoryId: z.string().uuid(),
  productType: monitoredProductTypeSchema,
  rotation: productRotationSchema.default('high'),
  thresholds: stockAlertThresholdsSchema.optional(),
});

export const updateMonitoredCategorySchema = z.object({
  categoryId: z.string().uuid(),
  productType: monitoredProductTypeSchema.optional(),
  rotation: productRotationSchema.optional(),
  thresholds: stockAlertThresholdsSchema.optional(),
  enabled: z.boolean().optional(),
});

export const removeMonitoredCategorySchema = z.object({
  categoryId: z.string().uuid(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateStockAlertConfigInput = z.infer<typeof createStockAlertConfigSchema>;
export type UpdateStockAlertConfigInput = z.infer<typeof updateStockAlertConfigSchema>;
export type AcknowledgeAlertInput = z.infer<typeof acknowledgeAlertSchema>;
export type ResolveAlertInput = z.infer<typeof resolveAlertSchema>;
export type BulkAcknowledgeInput = z.infer<typeof bulkAcknowledgeSchema>;
export type GetAlertsQuery = z.infer<typeof getAlertsQuerySchema>;
export type GetBarStockQuery = z.infer<typeof getBarStockQuerySchema>;
export type GetStatsQuery = z.infer<typeof getStatsQuerySchema>;
export type StockUpdateEvent = z.infer<typeof stockUpdateEventSchema>;
export type RestockEvent = z.infer<typeof restockEventSchema>;
export type AddMonitoredCategoryInput = z.infer<typeof addMonitoredCategorySchema>;
export type UpdateMonitoredCategoryInput = z.infer<typeof updateMonitoredCategorySchema>;
