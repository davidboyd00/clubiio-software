import crypto from 'crypto';
import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import { io } from '../../index';
import {
  GenerateTicketsInput,
  ConsumeTicketInput,
} from './tickets.schema';

export class TicketsService {
  /**
   * Generate a batch of tickets for a ticket type
   */
  async generate(tenantId: string, input: GenerateTicketsInput) {
    const ticketType = await prisma.ticketType.findFirst({
      where: { id: input.ticketTypeId },
      include: {
        event: {
          include: { venue: { select: { id: true, tenantId: true } } },
        },
      },
    });

    if (!ticketType || ticketType.event.venue.tenantId !== tenantId) {
      throw new AppError('Ticket type not found', 404);
    }

    const available = ticketType.quantity - ticketType.sold;
    if (input.quantity > available) {
      throw new AppError(`Only ${available} tickets available`, 400);
    }

    const tickets = await prisma.$transaction(async (tx) => {
      // Generate unique codes
      const codes: string[] = [];
      for (let i = 0; i < input.quantity; i++) {
        codes.push(crypto.randomBytes(8).toString('hex').toUpperCase());
      }

      // Create tickets
      const created = [];
      for (const code of codes) {
        const ticket = await tx.ticket.create({
          data: {
            ticketTypeId: input.ticketTypeId,
            code,
            customerName: input.customerName,
            customerEmail: input.customerEmail,
            customerPhone: input.customerPhone,
            consumptionRemaining:
              ticketType.consumptionValue ? Number(ticketType.consumptionValue) : null,
          },
        });
        created.push(ticket);
      }

      // Update sold count
      await tx.ticketType.update({
        where: { id: input.ticketTypeId },
        data: { sold: { increment: input.quantity } },
      });

      return created;
    });

    return { tickets, count: tickets.length };
  }

  /**
   * Validate a ticket by code (scan)
   */
  async validate(tenantId: string, code: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { code },
      include: {
        ticketType: {
          include: {
            event: {
              include: { venue: { select: { id: true, name: true, tenantId: true } } },
            },
            items: { include: { product: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    if (!ticket || ticket.ticketType.event.venue.tenantId !== tenantId) {
      throw new AppError('Ticket not found', 404);
    }

    const venueId = ticket.ticketType.event.venue.id;

    io.to(`venue:${venueId}`).emit('ticket:validated', {
      ticketId: ticket.id,
      code: ticket.code,
      status: ticket.status,
      eventName: ticket.ticketType.event.name,
    });

    return ticket;
  }

  /**
   * Consume ticket credit (use with an order)
   */
  async consume(tenantId: string, _userId: string, input: ConsumeTicketInput) {
    const ticket = await prisma.ticket.findFirst({
      where: { id: input.ticketId },
      include: {
        ticketType: {
          include: {
            event: {
              include: { venue: { select: { id: true, tenantId: true } } },
            },
          },
        },
      },
    });

    if (!ticket || ticket.ticketType.event.venue.tenantId !== tenantId) {
      throw new AppError('Ticket not found', 404);
    }

    if (ticket.status !== 'VALID' && ticket.status !== 'USED') {
      throw new AppError(`Ticket is ${ticket.status}`, 400);
    }

    if (ticket.consumptionRemaining === null) {
      throw new AppError('This ticket type has no consumption credit', 400);
    }

    if (Number(ticket.consumptionRemaining) < input.amount) {
      throw new AppError(
        `Insufficient credit. Remaining: ${ticket.consumptionRemaining}`,
        400
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create consumption record
      await tx.ticketConsumption.create({
        data: {
          ticketId: input.ticketId,
          orderId: input.orderId,
          amount: input.amount,
        },
      });

      // Update remaining
      const newRemaining = Number(ticket.consumptionRemaining) - input.amount;
      const updated = await tx.ticket.update({
        where: { id: input.ticketId },
        data: {
          consumptionRemaining: newRemaining,
          consumptionUsed: newRemaining <= 0,
        },
      });

      return updated;
    });

    const venueId = ticket.ticketType.event.venue.id;
    io.to(`venue:${venueId}`).emit('ticket:consumed', {
      ticketId: result.id,
      amount: input.amount,
      remaining: result.consumptionRemaining,
    });

    return result;
  }

  /**
   * Get tickets for an event
   */
  async findByEvent(tenantId: string, eventId: string) {
    const event = await prisma.event.findFirst({
      where: { id: eventId },
      include: { venue: { select: { tenantId: true } } },
    });

    if (!event || event.venue.tenantId !== tenantId) {
      throw new AppError('Event not found', 404);
    }

    return prisma.ticket.findMany({
      where: {
        ticketType: { eventId },
      },
      include: {
        ticketType: { select: { id: true, name: true, consumptionType: true } },
      },
      orderBy: { purchasedAt: 'desc' },
    });
  }

  /**
   * Get a ticket by code
   */
  async findByCode(tenantId: string, code: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { code },
      include: {
        ticketType: {
          include: {
            event: {
              include: { venue: { select: { id: true, name: true, tenantId: true } } },
            },
            items: { include: { product: { select: { id: true, name: true } } } },
          },
        },
        consumptions: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!ticket || ticket.ticketType.event.venue.tenantId !== tenantId) {
      throw new AppError('Ticket not found', 404);
    }

    return ticket;
  }
}

export const ticketsService = new TicketsService();
