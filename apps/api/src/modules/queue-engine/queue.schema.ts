import { z } from 'zod';

// ============================================
// EVENT SCHEMAS
// ============================================

const orderItemSchema = z.object({
  sku_id: z.string(),
  qty: z.number().int().positive(),
  modifiers: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const baseEventSchema = z.object({
  event_id: z.string().uuid().optional(),
  ts: z.string().datetime(),
  venue_id: z.string(),
  festival_event_id: z.string().optional(),
  bar_id: z.string(),
  source: z.enum(['pos', 'totem', 'app', 'manual']).default('pos'),
});

export const orderCreatedEventSchema = baseEventSchema.extend({
  event_type: z.literal('order_created'),
  order_id: z.string(),
  channel: z.enum(['cashier', 'totem', 'app']),
  items: z.array(orderItemSchema).min(1),
  customer_id: z.string().optional(),
  priority_override: z.number().int().min(0).max(100).optional(),
});

export const orderPaidEventSchema = baseEventSchema.extend({
  event_type: z.literal('order_paid'),
  order_id: z.string(),
  channel: z.enum(['cashier', 'totem', 'app']),
  items: z.array(orderItemSchema).min(1),
  payment_method: z.enum(['cash', 'card', 'mixed', 'wristband']),
  cashier_id: z.string().optional(),
  totem_id: z.string().optional(),
});

export const prepStartedEventSchema = baseEventSchema.extend({
  event_type: z.literal('prep_started'),
  order_id: z.string(),
  bartender_id: z.string(),
  station_id: z.string().optional(),
  items_started: z.array(z.string()),
});

export const prepCompletedEventSchema = baseEventSchema.extend({
  event_type: z.literal('prep_completed'),
  order_id: z.string(),
  bartender_id: z.string(),
  items_completed: z.array(z.string()),
});

export const orderDeliveredEventSchema = baseEventSchema.extend({
  event_type: z.literal('order_delivered'),
  order_id: z.string(),
  bartender_id: z.string().optional(),
  delivery_point: z.string().optional(),
});

export const orderCancelledEventSchema = baseEventSchema.extend({
  event_type: z.literal('order_cancelled'),
  order_id: z.string(),
  reason: z.enum(['customer_request', 'stock_out', 'timeout', 'system', 'other']),
  refunded: z.boolean(),
});

export const orderAbandonedEventSchema = baseEventSchema.extend({
  event_type: z.literal('order_abandoned'),
  order_id: z.string(),
  last_stage: z.enum(['queue_cashier', 'queue_totem', 'queue_prep', 'ready']),
  wait_time_sec: z.number().positive(),
});

export const staffStateEventSchema = baseEventSchema.extend({
  event_type: z.literal('staff_state'),
  staff_id: z.string(),
  role: z.enum(['bartender', 'cashier', 'runner']),
  action: z.enum(['clock_in', 'clock_out', 'break_start', 'break_end', 'station_change']),
  station_id: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

export const inventorySnapshotEventSchema = baseEventSchema.extend({
  event_type: z.literal('inventory_snapshot'),
  snapshot_type: z.enum(['full', 'delta']),
  items: z.array(z.object({
    sku_id: z.string(),
    qty_available: z.number(),
    qty_reserved: z.number().optional(),
    location: z.string().optional(),
  })),
});

export const queueEventSchema = z.discriminatedUnion('event_type', [
  orderCreatedEventSchema,
  orderPaidEventSchema,
  prepStartedEventSchema,
  prepCompletedEventSchema,
  orderDeliveredEventSchema,
  orderCancelledEventSchema,
  orderAbandonedEventSchema,
  staffStateEventSchema,
  inventorySnapshotEventSchema,
]);

export const batchEventsSchema = z.object({
  events: z.array(queueEventSchema).max(100),
});

// ============================================
// REQUEST SCHEMAS
// ============================================

export const nextTaskRequestSchema = z.object({
  venue_id: z.string(),
  festival_event_id: z.string().optional(),
  bar_id: z.string(),
  bartender_id: z.string().optional(),
  station_id: z.string().optional(),
  exclude_families: z.array(z.string()).optional(),
});

export const acceptTaskRequestSchema = z.object({
  task_id: z.string(),
  bartender_id: z.string(),
  accepted: z.boolean().default(true),
  reject_reason: z.enum(['no_stock', 'wrong_station', 'too_complex', 'other']).optional(),
});

export const stockTargetsRequestSchema = z.object({
  venue_id: z.string(),
  bar_id: z.string(),
  horizon_minutes: z.number().int().positive().default(15),
});

export const metricsSnapshotRequestSchema = z.object({
  venue_id: z.string(),
  bar_id: z.string().optional(),
  window_minutes: z.number().int().min(1).max(60).default(15),
});

export const timeseriesRequestSchema = z.object({
  venue_id: z.string(),
  bar_id: z.string().optional(),
  metric: z.enum(['p95_wait', 'throughput', 'utilization', 'queue_length', 'lambda']),
  from: z.string().datetime(),
  to: z.string().datetime(),
  resolution: z.enum(['1m', '5m', '15m', '1h']).default('5m'),
});

// ============================================
// CONFIG SCHEMAS
// ============================================

export const skuMappingSchema = z.object({
  sku_id: z.string(),
  family_id: z.string(),
  classification: z.enum(['stockable', 'batchable', 'custom']),
  prep_time_mean: z.number().int().positive(),
  prep_time_std: z.number().int().nonnegative(),
  max_batch_size: z.number().int().positive().default(8),
  max_pre_stock: z.number().int().nonnegative().default(20),
  shelf_life_min: z.number().int().positive().default(30),
});

export const familyConfigSchema = z.object({
  family_id: z.string(),
  name: z.string(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  avg_prep_time: z.number().int().positive(),
});

export const setupMatrixSchema = z.record(z.string(), z.record(z.string(), z.number().int().nonnegative()));

export const engineConfigUpdateSchema = z.object({
  venue_id: z.string(),
  event_id: z.string().optional(),
  features: z.object({
    batching_enabled: z.boolean(),
    stocking_enabled: z.boolean(),
    autopilot_enabled: z.boolean(),
  }).partial().optional(),
  batching: z.object({
    B0: z.number().int().positive(),
    B_min: z.number().int().positive(),
    B_max: z.number().int().positive(),
    tau0_sec: z.number().int().positive(),
    tau_min_sec: z.number().int().positive(),
    tau_max_sec: z.number().int().positive(),
  }).partial().optional(),
  stocking: z.object({
    horizon_minutes: z.number().int().positive(),
    safety_factor: z.number().positive(),
    max_capacity_pct: z.number().min(0).max(1),
  }).partial().optional(),
  guardrails: z.object({
    p95_target_sec: z.number().int().positive(),
    p95_warning_sec: z.number().int().positive(),
    p95_critical_sec: z.number().int().positive(),
    utilization_target: z.number().min(0).max(1),
    utilization_warning: z.number().min(0).max(1),
    utilization_critical: z.number().min(0).max(1),
    max_queue_length: z.number().int().positive(),
    max_oldest_age_sec: z.number().int().positive(),
  }).partial().optional(),
});

export const featureToggleSchema = z.object({
  venue_id: z.string(),
  features: z.object({
    batching_enabled: z.boolean().optional(),
    stocking_enabled: z.boolean().optional(),
    autopilot_enabled: z.boolean().optional(),
  }),
});

// Type exports
export type QueueEventInput = z.infer<typeof queueEventSchema>;
export type NextTaskRequest = z.infer<typeof nextTaskRequestSchema>;
export type AcceptTaskRequest = z.infer<typeof acceptTaskRequestSchema>;
export type StockTargetsRequest = z.infer<typeof stockTargetsRequestSchema>;
export type MetricsSnapshotRequest = z.infer<typeof metricsSnapshotRequestSchema>;
export type EngineConfigUpdate = z.infer<typeof engineConfigUpdateSchema>;
