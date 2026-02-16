import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import { io } from '../../index';
import {
  CreateEventInput,
  UpdateEventInput,
  UpdateEventStatusInput,
  CreateTicketTypeInput,
  UpdateTicketTypeInput,
} from './events.schema';

export class EventsService {
  /**
   * Get all events for a venue
   */
  async findByVenue(tenantId: string, venueId: string) {
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, tenantId },
    });
    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    return prisma.event.findMany({
      where: { venueId },
      include: {
        ticketTypes: {
          include: { items: { include: { product: { select: { id: true, name: true } } } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Get an event by ID
   */
  async findById(tenantId: string, id: string) {
    const event = await prisma.event.findFirst({
      where: { id },
      include: {
        venue: { select: { id: true, name: true, tenantId: true } },
        ticketTypes: {
          include: {
            items: { include: { product: { select: { id: true, name: true } } } },
            _count: { select: { tickets: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!event) {
      throw new AppError('Event not found', 404);
    }
    if (event.venue.tenantId !== tenantId) {
      throw new AppError('Event not found', 404);
    }

    return event;
  }

  /**
   * Create a new event
   */
  async create(tenantId: string, input: CreateEventInput) {
    const venue = await prisma.venue.findFirst({
      where: { id: input.venueId, tenantId },
    });
    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    const event = await prisma.event.create({
      data: {
        venueId: input.venueId,
        name: input.name,
        date: new Date(input.date),
        doorsOpen: input.doorsOpen ? new Date(input.doorsOpen) : undefined,
        doorsClose: input.doorsClose ? new Date(input.doorsClose) : undefined,
        capacity: input.capacity,
        settings: (input.settings ?? {}) as any,
      },
      include: {
        venue: { select: { id: true, name: true } },
        ticketTypes: true,
      },
    });

    io.to(`venue:${input.venueId}`).emit('event:created', {
      id: event.id,
      name: event.name,
      date: event.date,
      status: event.status,
    });

    return event;
  }

  /**
   * Update an event
   */
  async update(tenantId: string, id: string, input: UpdateEventInput) {
    const existing = await this.findById(tenantId, id);

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.date !== undefined && { date: new Date(input.date) }),
        ...(input.doorsOpen !== undefined && { doorsOpen: new Date(input.doorsOpen) }),
        ...(input.doorsClose !== undefined && { doorsClose: new Date(input.doorsClose) }),
        ...(input.capacity !== undefined && { capacity: input.capacity }),
        ...(input.settings !== undefined && { settings: input.settings as any }),
      },
      include: {
        venue: { select: { id: true, name: true } },
        ticketTypes: true,
      },
    });

    io.to(`venue:${existing.venue.id}`).emit('event:updated', {
      id: event.id,
      name: event.name,
      date: event.date,
      status: event.status,
    });

    return event;
  }

  /**
   * Update event status
   */
  async updateStatus(tenantId: string, id: string, input: UpdateEventStatusInput) {
    const existing = await this.findById(tenantId, id);

    const event = await prisma.event.update({
      where: { id },
      data: { status: input.status },
    });

    io.to(`venue:${existing.venue.id}`).emit('event:status-changed', {
      id: event.id,
      name: event.name,
      status: event.status,
    });

    return event;
  }

  /**
   * Delete an event (only if DRAFT)
   */
  async delete(tenantId: string, id: string) {
    const event = await this.findById(tenantId, id);

    if (event.status !== 'DRAFT') {
      throw new AppError('Only draft events can be deleted', 400);
    }

    await prisma.event.delete({ where: { id } });
  }

  // ---- Ticket Types ----

  /**
   * Create a ticket type for an event
   */
  async createTicketType(tenantId: string, eventId: string, input: CreateTicketTypeInput) {
    await this.findById(tenantId, eventId);

    // Validate products if items are provided
    if (input.items?.length) {
      const productIds = input.items.map((i) => i.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds }, tenantId, isActive: true },
      });
      if (products.length !== productIds.length) {
        throw new AppError('One or more products not found', 404);
      }
    }

    return prisma.ticketType.create({
      data: {
        eventId,
        name: input.name,
        price: input.price,
        quantity: input.quantity,
        consumptionType: input.consumptionType,
        consumptionValue: input.consumptionValue,
        sortOrder: input.sortOrder,
        items: input.items?.length
          ? { create: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity })) }
          : undefined,
      },
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    });
  }

  /**
   * Update a ticket type
   */
  async updateTicketType(tenantId: string, eventId: string, ticketTypeId: string, input: UpdateTicketTypeInput) {
    await this.findById(tenantId, eventId);

    const ticketType = await prisma.ticketType.findFirst({
      where: { id: ticketTypeId, eventId },
    });
    if (!ticketType) {
      throw new AppError('Ticket type not found', 404);
    }

    return prisma.$transaction(async (tx) => {
      // Update items if provided
      if (input.items) {
        await tx.ticketTypeItem.deleteMany({ where: { ticketTypeId } });
        if (input.items.length > 0) {
          await tx.ticketTypeItem.createMany({
            data: input.items.map((i) => ({
              ticketTypeId,
              productId: i.productId,
              quantity: i.quantity,
            })),
          });
        }
      }

      return tx.ticketType.update({
        where: { id: ticketTypeId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.price !== undefined && { price: input.price }),
          ...(input.quantity !== undefined && { quantity: input.quantity }),
          ...(input.consumptionType !== undefined && { consumptionType: input.consumptionType }),
          ...(input.consumptionValue !== undefined && { consumptionValue: input.consumptionValue }),
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        },
        include: {
          items: { include: { product: { select: { id: true, name: true } } } },
        },
      });
    });
  }

  /**
   * Delete a ticket type (only if no tickets sold)
   */
  async deleteTicketType(tenantId: string, eventId: string, ticketTypeId: string) {
    await this.findById(tenantId, eventId);

    const ticketType = await prisma.ticketType.findFirst({
      where: { id: ticketTypeId, eventId },
    });
    if (!ticketType) {
      throw new AppError('Ticket type not found', 404);
    }
    if (ticketType.sold > 0) {
      throw new AppError('Cannot delete ticket type with sold tickets', 400);
    }

    await prisma.ticketType.delete({ where: { id: ticketTypeId } });
  }
}

export const eventsService = new EventsService();
