// ============================================
// QUEUE ENGINE TYPES
// ============================================

// Event Types
export type QueueEventType =
  | 'order_created'
  | 'order_paid'
  | 'prep_started'
  | 'prep_completed'
  | 'order_delivered'
  | 'order_cancelled'
  | 'order_abandoned'
  | 'staff_state'
  | 'inventory_snapshot';

export interface BaseQueueEvent {
  event_id: string;
  event_type: QueueEventType;
  ts: string;
  venue_id: string;
  festival_event_id?: string;
  bar_id: string;
  source: 'pos' | 'totem' | 'app' | 'manual';
}

export interface OrderItem {
  sku_id: string;
  qty: number;
  modifiers?: string[];
  notes?: string;
}

export interface OrderCreatedEvent extends BaseQueueEvent {
  event_type: 'order_created';
  order_id: string;
  channel: 'cashier' | 'totem' | 'app';
  items: OrderItem[];
  customer_id?: string;
  priority_override?: number;
}

export interface OrderPaidEvent extends BaseQueueEvent {
  event_type: 'order_paid';
  order_id: string;
  channel: 'cashier' | 'totem' | 'app';
  items: OrderItem[];
  payment_method: 'cash' | 'card' | 'mixed' | 'wristband';
  cashier_id?: string;
  totem_id?: string;
}

export interface PrepStartedEvent extends BaseQueueEvent {
  event_type: 'prep_started';
  order_id: string;
  bartender_id: string;
  station_id?: string;
  items_started: string[];
}

export interface PrepCompletedEvent extends BaseQueueEvent {
  event_type: 'prep_completed';
  order_id: string;
  bartender_id: string;
  items_completed: string[];
}

export interface OrderDeliveredEvent extends BaseQueueEvent {
  event_type: 'order_delivered';
  order_id: string;
  bartender_id?: string;
  delivery_point?: string;
}

export interface OrderCancelledEvent extends BaseQueueEvent {
  event_type: 'order_cancelled';
  order_id: string;
  reason: 'customer_request' | 'stock_out' | 'timeout' | 'system' | 'other';
  refunded: boolean;
}

export interface OrderAbandonedEvent extends BaseQueueEvent {
  event_type: 'order_abandoned';
  order_id: string;
  last_stage: 'queue_cashier' | 'queue_totem' | 'queue_prep' | 'ready';
  wait_time_sec: number;
}

export interface StaffStateEvent extends BaseQueueEvent {
  event_type: 'staff_state';
  staff_id: string;
  role: 'bartender' | 'cashier' | 'runner';
  action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end' | 'station_change';
  station_id?: string;
  skills?: string[];
}

export interface InventorySnapshotEvent extends BaseQueueEvent {
  event_type: 'inventory_snapshot';
  snapshot_type: 'full' | 'delta';
  items: Array<{
    sku_id: string;
    qty_available: number;
    qty_reserved?: number;
    location?: string;
  }>;
}

export type QueueEvent =
  | OrderCreatedEvent
  | OrderPaidEvent
  | PrepStartedEvent
  | PrepCompletedEvent
  | OrderDeliveredEvent
  | OrderCancelledEvent
  | OrderAbandonedEvent
  | StaffStateEvent
  | InventorySnapshotEvent;

// Order State
export type OrderStage =
  | 'created'
  | 'paid'
  | 'queued_prep'
  | 'in_prep'
  | 'ready'
  | 'delivered'
  | 'cancelled'
  | 'abandoned';

export interface OrderState {
  order_id: string;
  venue_id: string;
  bar_id: string;
  stage: OrderStage;
  channel: 'cashier' | 'totem' | 'app';
  items: Array<{
    sku_id: string;
    qty: number;
    family_id?: string;
    classification?: 'stockable' | 'batchable' | 'custom';
  }>;
  priority: number;
  assigned_to?: string;
  batch_id?: string;
  created_at: Date;
  paid_at?: Date;
  prep_started_at?: Date;
  prep_completed_at?: Date;
  delivered_at?: Date;
}

// Task Types
export type TaskType = 'batch' | 'stock' | 'custom' | 'restock' | 'idle';

export interface Task {
  task_id: string;
  type: TaskType;
  priority: number;
  family?: string;
  sku_id?: string;
  batch_size?: number;
  order_ids?: string[];
  order_id?: string;
  items?: OrderItem[];
  estimated_prep_sec: number;
  estimated_setup_sec: number;
}

export interface GuardrailAlert {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggered_at: string;
}

export interface GuardrailStatus {
  p95_target_sec: number;
  p95_current_sec: number;
  p95_status: 'ok' | 'warning' | 'critical';
  utilization_target: number;
  utilization_current: number;
  utilization_status: 'ok' | 'warning' | 'critical';
  batching_enabled: boolean;
  batching_reason?: string;
  stocking_enabled: boolean;
  stocking_reason?: string;
  alerts: GuardrailAlert[];
}

export interface TaskExplanation {
  rho_est: number;
  lambda_est: number;
  queue_length?: number;
  oldest_age_sec?: number;
  B_eff?: number;
  tau_eff_sec?: number;
  current_stock?: number;
  target_stock?: number;
  forecast_demand?: number;
  decision_rule: string;
  confidence: number;
}

export interface NextTaskResponse {
  request_id: string;
  ts: string;
  bar_id: string;
  task: Task | null;
  alternatives?: Task[];
  guardrails: GuardrailStatus;
  explain: TaskExplanation;
  valid_until: string;
}

// Metrics
export interface PercentileStats {
  p50_sec: number;
  p90_sec: number;
  p95_sec: number;
  p99_sec: number;
  mean_sec: number;
  std_sec: number;
  sample_size: number;
}

export interface ResourceUtil {
  active: number;
  total: number;
  utilization: number;
  status: 'ok' | 'warning' | 'critical';
}

export interface QueueStats {
  length: number;
  oldest_age_sec: number;
  avg_age_sec: number;
}

export interface MetricsSnapshot {
  request_id: string;
  ts: string;
  venue_id: string;
  bar_id?: string;
  window_minutes: number;
  wait_times: PercentileStats;
  stage_times: {
    capture: PercentileStats;
    queue_prep: PercentileStats;
    preparation: PercentileStats;
  };
  throughput: {
    orders_per_min: number;
    items_per_min: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
  utilization: {
    bartenders: ResourceUtil;
    cashiers: ResourceUtil;
    totems: ResourceUtil;
  };
  queues: {
    cashier: QueueStats;
    totem: QueueStats;
    prep_total: QueueStats;
    prep_by_family: Record<string, QueueStats>;
  };
  batching: {
    batches_formed: number;
    avg_batch_size: number;
    efficiency_gain_pct: number;
  };
  active_alerts: GuardrailAlert[];
}

// Stock Targets
export interface StockTarget {
  sku_id: string;
  family: string;
  current_stock: number;
  target_stock: number;
  deficit: number;
  forecast: {
    rate_per_min: number;
    confidence: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
  action: 'produce' | 'hold' | 'reduce';
  priority: number;
}

export interface StockTargetsResponse {
  request_id: string;
  ts: string;
  bar_id: string;
  horizon_minutes: number;
  targets: StockTarget[];
  production_queue: Array<{
    sku_id: string;
    qty: number;
    deadline?: string;
    reason: string;
  }>;
}

// Config
export interface EngineConfig {
  config_id: string;
  venue_id: string;
  event_id?: string;
  version: number;
  features: {
    batching_enabled: boolean;
    stocking_enabled: boolean;
    autopilot_enabled: boolean;
  };
  batching: {
    B0: number;
    B_min: number;
    B_max: number;
    tau0_sec: number;
    tau_min_sec: number;
    tau_max_sec: number;
  };
  stocking: {
    horizon_minutes: number;
    safety_factor: number;
    max_capacity_pct: number;
  };
  guardrails: {
    p95_target_sec: number;
    p95_warning_sec: number;
    p95_critical_sec: number;
    utilization_target: number;
    utilization_warning: number;
    utilization_critical: number;
    max_queue_length: number;
    max_oldest_age_sec: number;
  };
}
