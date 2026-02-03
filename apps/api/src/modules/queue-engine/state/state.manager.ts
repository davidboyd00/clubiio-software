import { OrderState, OrderStage, EngineConfig, GuardrailAlert } from '../queue.types';

// ============================================
// IN-MEMORY STATE MANAGER
// ============================================

interface BarState {
  // Active orders by stage
  orders: Map<string, OrderState>;

  // Queue by family for batching
  queues: Map<string, string[]>; // family_id -> order_ids

  // Staff state
  bartenders: Map<string, BartenderState>;
  cashiers: Map<string, boolean>; // id -> active

  // Last family per bartender (for setup time calculation)
  lastFamily: Map<string, string>; // bartender_id -> family_id

  // Pre-stock inventory
  preStock: Map<string, number>; // sku_id -> qty

  // Completed orders ring buffer (for percentiles)
  completedOrders: CompletedOrder[];

  // Lambda estimation
  arrivals: number[]; // timestamps of recent arrivals

  // Config
  config: EngineConfig;

  // Guardrail state
  guardrailState: GuardrailState;
}

interface BartenderState {
  id: string;
  active: boolean;
  current_order?: string;
  station_id?: string;
  skills: string[]; // family_ids
  break_until?: Date;
}

interface CompletedOrder {
  order_id: string;
  created_at: Date;
  paid_at?: Date;
  prep_started_at?: Date;
  delivered_at: Date;
  total_wait_sec: number;
  items: Array<{ sku_id: string; qty: number }>;
}

interface GuardrailState {
  batching_enabled: boolean;
  stocking_enabled: boolean;
  last_toggle_ts: number;
  consecutive_p95_violations: number;
  alerts: GuardrailAlert[];
}

// Default config
const DEFAULT_CONFIG: EngineConfig = {
  config_id: 'default',
  venue_id: '',
  version: 1,
  features: {
    batching_enabled: true,
    stocking_enabled: true,
    autopilot_enabled: false,
  },
  batching: {
    B0: 6,
    B_min: 2,
    B_max: 12,
    tau0_sec: 90,
    tau_min_sec: 30,
    tau_max_sec: 180,
  },
  stocking: {
    horizon_minutes: 15,
    safety_factor: 1.3,
    max_capacity_pct: 0.2,
  },
  guardrails: {
    p95_target_sec: 300,
    p95_warning_sec: 240,
    p95_critical_sec: 420,
    utilization_target: 0.80,
    utilization_warning: 0.90,
    utilization_critical: 0.95,
    max_queue_length: 50,
    max_oldest_age_sec: 300,
  },
};

// Ring buffer size for completed orders (15 min at ~4 orders/min = 60)
const COMPLETED_ORDERS_BUFFER_SIZE = 200;
// Arrivals buffer for lambda estimation (5 min window)
const ARRIVALS_BUFFER_WINDOW_MS = 5 * 60 * 1000;

export class StateManager {
  private venues: Map<string, Map<string, BarState>> = new Map();

  // Get or create bar state
  getBarState(venueId: string, barId: string): BarState {
    if (!this.venues.has(venueId)) {
      this.venues.set(venueId, new Map());
    }
    const venueState = this.venues.get(venueId)!;

    if (!venueState.has(barId)) {
      venueState.set(barId, this.createBarState(venueId));
    }

    return venueState.get(barId)!;
  }

  private createBarState(venueId: string): BarState {
    return {
      orders: new Map(),
      queues: new Map(),
      bartenders: new Map(),
      cashiers: new Map(),
      lastFamily: new Map(),
      preStock: new Map(),
      completedOrders: [],
      arrivals: [],
      config: { ...DEFAULT_CONFIG, venue_id: venueId },
      guardrailState: {
        batching_enabled: true,
        stocking_enabled: true,
        last_toggle_ts: 0,
        consecutive_p95_violations: 0,
        alerts: [],
      },
    };
  }

  // ─────────────────────────────────────────
  // ORDER STATE MANAGEMENT
  // ─────────────────────────────────────────

  createOrder(
    venueId: string,
    barId: string,
    orderId: string,
    data: Omit<OrderState, 'order_id' | 'venue_id' | 'bar_id' | 'stage' | 'created_at'>
  ): OrderState {
    const state = this.getBarState(venueId, barId);
    const order: OrderState = {
      order_id: orderId,
      venue_id: venueId,
      bar_id: barId,
      stage: 'created',
      created_at: new Date(),
      ...data,
    };
    state.orders.set(orderId, order);
    return order;
  }

  getOrder(venueId: string, barId: string, orderId: string): OrderState | undefined {
    return this.getBarState(venueId, barId).orders.get(orderId);
  }

  updateOrderStage(
    venueId: string,
    barId: string,
    orderId: string,
    stage: OrderStage,
    extraData?: Partial<OrderState>
  ): OrderState | undefined {
    const state = this.getBarState(venueId, barId);
    const order = state.orders.get(orderId);
    if (!order) return undefined;

    order.stage = stage;

    // Update timestamps based on stage
    const now = new Date();
    switch (stage) {
      case 'paid':
        order.paid_at = now;
        // Add to arrivals for lambda estimation
        state.arrivals.push(now.getTime());
        this.cleanupArrivals(state);
        break;
      case 'in_prep':
        order.prep_started_at = now;
        break;
      case 'delivered':
        order.delivered_at = now;
        // Move to completed orders
        this.addCompletedOrder(state, order);
        state.orders.delete(orderId);
        break;
      case 'cancelled':
      case 'abandoned':
        state.orders.delete(orderId);
        break;
    }

    if (extraData) {
      Object.assign(order, extraData);
    }

    return order;
  }

  private addCompletedOrder(state: BarState, order: OrderState): void {
    const completed: CompletedOrder = {
      order_id: order.order_id,
      created_at: order.created_at,
      paid_at: order.paid_at,
      prep_started_at: order.prep_started_at,
      delivered_at: new Date(),
      total_wait_sec: (Date.now() - order.created_at.getTime()) / 1000,
      items: order.items.map((i) => ({ sku_id: i.sku_id, qty: i.qty })),
    };

    state.completedOrders.push(completed);

    // Keep buffer size limited
    if (state.completedOrders.length > COMPLETED_ORDERS_BUFFER_SIZE) {
      state.completedOrders.shift();
    }
  }

  private cleanupArrivals(state: BarState): void {
    const cutoff = Date.now() - ARRIVALS_BUFFER_WINDOW_MS;
    state.arrivals = state.arrivals.filter((t) => t >= cutoff);
  }

  // ─────────────────────────────────────────
  // QUEUE MANAGEMENT (for batching)
  // ─────────────────────────────────────────

  addToQueue(venueId: string, barId: string, familyId: string, orderId: string): void {
    const state = this.getBarState(venueId, barId);
    if (!state.queues.has(familyId)) {
      state.queues.set(familyId, []);
    }
    const queue = state.queues.get(familyId)!;
    if (!queue.includes(orderId)) {
      queue.push(orderId);
    }
  }

  removeFromQueue(venueId: string, barId: string, familyId: string, orderId: string): void {
    const state = this.getBarState(venueId, barId);
    const queue = state.queues.get(familyId);
    if (queue) {
      const idx = queue.indexOf(orderId);
      if (idx >= 0) {
        queue.splice(idx, 1);
      }
    }
  }

  getQueueLength(venueId: string, barId: string, familyId?: string): number {
    const state = this.getBarState(venueId, barId);
    if (familyId) {
      return state.queues.get(familyId)?.length ?? 0;
    }
    // Total across all families
    let total = 0;
    for (const queue of state.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  getQueuedOrders(venueId: string, barId: string, familyId: string): OrderState[] {
    const state = this.getBarState(venueId, barId);
    const orderIds = state.queues.get(familyId) ?? [];
    return orderIds
      .map((id) => state.orders.get(id))
      .filter((o): o is OrderState => o !== undefined);
  }

  getOldestOrderAge(venueId: string, barId: string, familyId?: string): number {
    const state = this.getBarState(venueId, barId);
    const now = Date.now();
    let oldest = 0;

    const checkQueue = (queue: string[]) => {
      for (const orderId of queue) {
        const order = state.orders.get(orderId);
        if (order?.paid_at) {
          const age = (now - order.paid_at.getTime()) / 1000;
          if (age > oldest) oldest = age;
        }
      }
    };

    if (familyId) {
      const queue = state.queues.get(familyId);
      if (queue) checkQueue(queue);
    } else {
      for (const queue of state.queues.values()) {
        checkQueue(queue);
      }
    }

    return oldest;
  }

  // ─────────────────────────────────────────
  // STAFF MANAGEMENT
  // ─────────────────────────────────────────

  setBartenderState(
    venueId: string,
    barId: string,
    bartenderId: string,
    state: Partial<BartenderState>
  ): void {
    const barState = this.getBarState(venueId, barId);
    const existing = barState.bartenders.get(bartenderId) || {
      id: bartenderId,
      active: false,
      skills: [],
    };
    barState.bartenders.set(bartenderId, { ...existing, ...state });
  }

  getActiveBartenders(venueId: string, barId: string): BartenderState[] {
    const state = this.getBarState(venueId, barId);
    return Array.from(state.bartenders.values()).filter(
      (b) => b.active && (!b.break_until || b.break_until < new Date())
    );
  }

  getBartendersInService(venueId: string, barId: string): number {
    const state = this.getBarState(venueId, barId);
    return Array.from(state.bartenders.values()).filter(
      (b) => b.active && b.current_order
    ).length;
  }

  setLastFamily(venueId: string, barId: string, bartenderId: string, familyId: string): void {
    const state = this.getBarState(venueId, barId);
    state.lastFamily.set(bartenderId, familyId);
  }

  getLastFamily(venueId: string, barId: string, bartenderId: string): string | undefined {
    return this.getBarState(venueId, barId).lastFamily.get(bartenderId);
  }

  // ─────────────────────────────────────────
  // PRE-STOCK MANAGEMENT
  // ─────────────────────────────────────────

  setPreStock(venueId: string, barId: string, skuId: string, qty: number): void {
    this.getBarState(venueId, barId).preStock.set(skuId, qty);
  }

  getPreStock(venueId: string, barId: string, skuId: string): number {
    return this.getBarState(venueId, barId).preStock.get(skuId) ?? 0;
  }

  decrementPreStock(venueId: string, barId: string, skuId: string, qty: number): number {
    const state = this.getBarState(venueId, barId);
    const current = state.preStock.get(skuId) ?? 0;
    const newQty = Math.max(0, current - qty);
    state.preStock.set(skuId, newQty);
    return newQty;
  }

  // ─────────────────────────────────────────
  // METRICS ACCESS
  // ─────────────────────────────────────────

  getCompletedOrders(venueId: string, barId: string, windowSec?: number): CompletedOrder[] {
    const state = this.getBarState(venueId, barId);
    if (!windowSec) return state.completedOrders;

    const cutoff = Date.now() - windowSec * 1000;
    return state.completedOrders.filter((o) => o.delivered_at.getTime() >= cutoff);
  }

  getArrivals(venueId: string, barId: string): number[] {
    const state = this.getBarState(venueId, barId);
    this.cleanupArrivals(state);
    return state.arrivals;
  }

  // ─────────────────────────────────────────
  // CONFIG & GUARDRAILS
  // ─────────────────────────────────────────

  getConfig(venueId: string, barId: string): EngineConfig {
    return this.getBarState(venueId, barId).config;
  }

  updateConfig(venueId: string, barId: string, config: Partial<EngineConfig>): void {
    const state = this.getBarState(venueId, barId);
    state.config = { ...state.config, ...config };
  }

  getGuardrailState(venueId: string, barId: string): GuardrailState {
    return this.getBarState(venueId, barId).guardrailState;
  }

  updateGuardrailState(venueId: string, barId: string, update: Partial<GuardrailState>): void {
    const state = this.getBarState(venueId, barId);
    state.guardrailState = { ...state.guardrailState, ...update };
  }

  addAlert(venueId: string, barId: string, alert: GuardrailAlert): void {
    const state = this.getBarState(venueId, barId);
    // Avoid duplicates by code
    const existing = state.guardrailState.alerts.find((a) => a.code === alert.code);
    if (!existing) {
      state.guardrailState.alerts.push(alert);
    }
  }

  clearAlert(venueId: string, barId: string, code: string): void {
    const state = this.getBarState(venueId, barId);
    state.guardrailState.alerts = state.guardrailState.alerts.filter((a) => a.code !== code);
  }

  getActiveAlerts(venueId: string, barId: string): GuardrailAlert[] {
    return this.getBarState(venueId, barId).guardrailState.alerts;
  }

  // ─────────────────────────────────────────
  // UTILITY
  // ─────────────────────────────────────────

  getAllOrdersByStage(venueId: string, barId: string, stage: OrderStage): OrderState[] {
    const state = this.getBarState(venueId, barId);
    return Array.from(state.orders.values()).filter((o) => o.stage === stage);
  }

  getOrderStats(venueId: string, barId: string): {
    total: number;
    byStage: Record<OrderStage, number>;
  } {
    const state = this.getBarState(venueId, barId);
    const byStage: Record<OrderStage, number> = {
      created: 0,
      paid: 0,
      queued_prep: 0,
      in_prep: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0,
      abandoned: 0,
    };

    for (const order of state.orders.values()) {
      byStage[order.stage]++;
    }

    return {
      total: state.orders.size,
      byStage,
    };
  }
}

// Singleton instance
export const stateManager = new StateManager();
