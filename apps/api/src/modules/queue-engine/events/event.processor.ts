import { prisma } from '../../../common/database';
import { stateManager } from '../state/state.manager';
import {
  QueueEvent,
  OrderPaidEvent,
  PrepStartedEvent,
  OrderDeliveredEvent,
  OrderCancelledEvent,
  OrderAbandonedEvent,
  StaffStateEvent,
} from '../queue.types';
import { QueueEventType } from '@prisma/client';

// ============================================
// EVENT PROCESSOR
// ============================================

export class EventProcessor {
  /**
   * Process a single event
   */
  async processEvent(event: QueueEvent): Promise<{ processed: boolean; warnings: string[] }> {
    const warnings: string[] = [];

    try {
      // Store event in database for telemetry
      await this.storeEvent(event);

      // Process based on event type
      switch (event.event_type) {
        case 'order_created':
          await this.handleOrderCreated(event);
          break;

        case 'order_paid':
          await this.handleOrderPaid(event);
          break;

        case 'prep_started':
          await this.handlePrepStarted(event);
          break;

        case 'prep_completed':
          await this.handlePrepCompleted(event);
          break;

        case 'order_delivered':
          await this.handleOrderDelivered(event);
          break;

        case 'order_cancelled':
          await this.handleOrderCancelled(event);
          break;

        case 'order_abandoned':
          await this.handleOrderAbandoned(event);
          break;

        case 'staff_state':
          await this.handleStaffState(event);
          break;

        case 'inventory_snapshot':
          await this.handleInventorySnapshot(event);
          break;

        default:
          warnings.push(`Unknown event type: ${(event as any).event_type}`);
      }

      return { processed: true, warnings };
    } catch (error) {
      console.error(`Error processing event ${event.event_type}:`, error);
      return {
        processed: false,
        warnings: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Process batch of events
   */
  async processBatch(
    events: QueueEvent[]
  ): Promise<{ accepted: number; rejected: number; errors: Array<{ index: number; error: string }> }> {
    let accepted = 0;
    let rejected = 0;
    const errors: Array<{ index: number; error: string }> = [];

    // Sort by timestamp to maintain order
    const sorted = [...events].sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      const result = await this.processEvent(sorted[i]);
      if (result.processed) {
        accepted++;
      } else {
        rejected++;
        errors.push({ index: i, error: result.warnings.join(', ') });
      }
    }

    return { accepted, rejected, errors };
  }

  // ─────────────────────────────────────────
  // EVENT HANDLERS
  // ─────────────────────────────────────────

  private async handleOrderCreated(event: QueueEvent & { event_type: 'order_created' }): Promise<void> {
    // Create order in state with 'created' stage
    stateManager.createOrder(event.venue_id, event.bar_id, event.order_id, {
      channel: event.channel,
      items: event.items.map((i) => ({
        sku_id: i.sku_id,
        qty: i.qty,
      })),
      priority: event.priority_override ?? 50,
    });
  }

  private async handleOrderPaid(event: OrderPaidEvent): Promise<void> {
    const { venue_id, bar_id, order_id, channel, items } = event;

    // Check if order exists, create if not (for systems that skip order_created)
    let order = stateManager.getOrder(venue_id, bar_id, order_id);

    if (!order) {
      order = stateManager.createOrder(venue_id, bar_id, order_id, {
        channel,
        items: items.map((i) => ({ sku_id: i.sku_id, qty: i.qty })),
        priority: 50,
      });
    }

    // Update to paid stage
    stateManager.updateOrderStage(venue_id, bar_id, order_id, 'paid');

    // Enrich items with family info and add to queues
    await this.enrichAndQueueOrder(venue_id, bar_id, order_id, items);

    // Update order in database for persistence
    await this.updateOrderState(venue_id, bar_id, order_id, 'PAID');
  }

  private async handlePrepStarted(event: PrepStartedEvent): Promise<void> {
    const { venue_id, bar_id, order_id, bartender_id } = event;

    // Update order stage
    stateManager.updateOrderStage(venue_id, bar_id, order_id, 'in_prep', {
      assigned_to: bartender_id,
    });

    // Update bartender state
    stateManager.setBartenderState(venue_id, bar_id, bartender_id, {
      current_order: order_id,
    });

    // Remove from queues
    const order = stateManager.getOrder(venue_id, bar_id, order_id);
    if (order) {
      for (const item of order.items) {
        if (item.family_id) {
          stateManager.removeFromQueue(venue_id, bar_id, item.family_id, order_id);
        }
      }
    }

    await this.updateOrderState(venue_id, bar_id, order_id, 'QUEUED_PREP');
  }

  private async handlePrepCompleted(_event: QueueEvent & { event_type: 'prep_completed' }): Promise<void> {
    // Partial completion - items are done but order may not be delivered yet
    // For now, we treat this as informational
  }

  private async handleOrderDelivered(event: OrderDeliveredEvent): Promise<void> {
    const { venue_id, bar_id, order_id, bartender_id } = event;

    // Update order stage (this also moves to completed buffer)
    stateManager.updateOrderStage(venue_id, bar_id, order_id, 'delivered');

    // Clear bartender's current order
    if (bartender_id) {
      stateManager.setBartenderState(venue_id, bar_id, bartender_id, {
        current_order: undefined,
      });
    }

    await this.updateOrderState(venue_id, bar_id, order_id, 'DELIVERED');
  }

  private async handleOrderCancelled(event: OrderCancelledEvent): Promise<void> {
    const { venue_id, bar_id, order_id } = event;

    // Remove from queues
    const order = stateManager.getOrder(venue_id, bar_id, order_id);
    if (order) {
      for (const item of order.items) {
        if (item.family_id) {
          stateManager.removeFromQueue(venue_id, bar_id, item.family_id, order_id);
        }
      }
    }

    // Update stage
    stateManager.updateOrderStage(venue_id, bar_id, order_id, 'cancelled');

    await this.updateOrderState(venue_id, bar_id, order_id, 'CANCELLED');
  }

  private async handleOrderAbandoned(event: OrderAbandonedEvent): Promise<void> {
    const { venue_id, bar_id, order_id } = event;

    // Similar to cancelled
    const order = stateManager.getOrder(venue_id, bar_id, order_id);
    if (order) {
      for (const item of order.items) {
        if (item.family_id) {
          stateManager.removeFromQueue(venue_id, bar_id, item.family_id, order_id);
        }
      }
    }

    stateManager.updateOrderStage(venue_id, bar_id, order_id, 'abandoned');

    await this.updateOrderState(venue_id, bar_id, order_id, 'ABANDONED');
  }

  private async handleStaffState(event: StaffStateEvent): Promise<void> {
    const { venue_id, bar_id, staff_id, role, action, station_id, skills } = event;

    if (role === 'bartender') {
      switch (action) {
        case 'clock_in':
          stateManager.setBartenderState(venue_id, bar_id, staff_id, {
            id: staff_id,
            active: true,
            station_id,
            skills: skills ?? [],
          });
          break;

        case 'clock_out':
          stateManager.setBartenderState(venue_id, bar_id, staff_id, {
            active: false,
            current_order: undefined,
          });
          break;

        case 'break_start':
          stateManager.setBartenderState(venue_id, bar_id, staff_id, {
            break_until: new Date(Date.now() + 15 * 60 * 1000), // 15 min default
          });
          break;

        case 'break_end':
          stateManager.setBartenderState(venue_id, bar_id, staff_id, {
            break_until: undefined,
          });
          break;

        case 'station_change':
          stateManager.setBartenderState(venue_id, bar_id, staff_id, {
            station_id,
            skills: skills ?? [],
          });
          break;
      }
    }
  }

  private async handleInventorySnapshot(
    event: QueueEvent & { event_type: 'inventory_snapshot' }
  ): Promise<void> {
    const { venue_id, bar_id, items } = event;

    for (const item of items) {
      // Update pre-stock tracking
      stateManager.setPreStock(venue_id, bar_id, item.sku_id, item.qty_available);
    }
  }

  // ─────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────

  private async storeEvent(event: QueueEvent): Promise<void> {
    const eventTypeMap: Record<string, QueueEventType> = {
      order_created: 'ORDER_CREATED',
      order_paid: 'ORDER_PAID',
      prep_started: 'PREP_STARTED',
      prep_completed: 'PREP_COMPLETED',
      order_delivered: 'ORDER_DELIVERED',
      order_cancelled: 'ORDER_CANCELLED',
      order_abandoned: 'ORDER_ABANDONED',
      staff_state: 'STAFF_STATE',
      inventory_snapshot: 'INVENTORY_SNAPSHOT',
    };

    await prisma.queueEvent.create({
      data: {
        venueId: event.venue_id,
        eventId: event.festival_event_id,
        barId: event.bar_id,
        eventType: eventTypeMap[event.event_type],
        orderId: 'order_id' in event ? (event as any).order_id : undefined,
        staffId: 'staff_id' in event ? (event as any).staff_id : undefined,
        channel: 'channel' in event ? (event as any).channel : undefined,
        payload: event as any,
        processedAt: new Date(),
      },
    });
  }

  private async enrichAndQueueOrder(
    venueId: string,
    barId: string,
    orderId: string,
    items: Array<{ sku_id: string; qty: number }>
  ): Promise<void> {
    // Look up tenant from venue
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { tenantId: true },
    });

    if (!venue) return;

    // Get SKU mappings
    const skuMappings = await prisma.queueSkuMapping.findMany({
      where: {
        tenantId: venue.tenantId,
        productId: { in: items.map((i) => i.sku_id) },
        isActive: true,
      },
    });

    const mappingByProduct = new Map(skuMappings.map((m: typeof skuMappings[number]) => [m.productId, m] as const));

    // Update order items with family info and add to queues
    const order = stateManager.getOrder(venueId, barId, orderId);
    if (!order) return;

    for (const item of order.items) {
      const mapping = mappingByProduct.get(item.sku_id);
      if (mapping) {
        item.family_id = mapping.familyId;
        item.classification = mapping.classification.toLowerCase() as 'stockable' | 'batchable' | 'custom';

        // Add batchable items to family queue
        if (item.classification === 'batchable') {
          stateManager.addToQueue(venueId, barId, mapping.familyId, orderId);
        }
      }
    }
  }

  private async updateOrderState(
    venueId: string,
    barId: string,
    orderId: string,
    stage: string
  ): Promise<void> {
    const order = stateManager.getOrder(venueId, barId, orderId);

    const stageMap: Record<string, any> = {
      CREATED: 'CREATED',
      PAID: 'PAID',
      QUEUED_PREP: 'QUEUED_PREP',
      IN_PREP: 'IN_PREP',
      READY: 'READY',
      DELIVERED: 'DELIVERED',
      CANCELLED: 'CANCELLED',
      ABANDONED: 'ABANDONED',
    };

    await prisma.queueOrderState.upsert({
      where: { orderId },
      create: {
        venueId,
        barId,
        orderId,
        stage: stageMap[stage],
        channel: order?.channel ?? 'cashier',
        items: order?.items ?? [],
        priority: order?.priority ?? 50,
        paidAt: order?.paid_at,
        prepStartedAt: order?.prep_started_at,
        deliveredAt: order?.delivered_at,
        totalWaitSec: order?.delivered_at
          ? Math.round((order.delivered_at.getTime() - order.created_at.getTime()) / 1000)
          : undefined,
      },
      update: {
        stage: stageMap[stage],
        paidAt: order?.paid_at,
        prepStartedAt: order?.prep_started_at,
        deliveredAt: order?.delivered_at,
        totalWaitSec: order?.delivered_at
          ? Math.round((order.delivered_at.getTime() - order.created_at.getTime()) / 1000)
          : undefined,
      },
    });
  }
}

// Singleton instance
export const eventProcessor = new EventProcessor();
