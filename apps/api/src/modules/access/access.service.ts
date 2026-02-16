import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import { io } from '../../index';
import { CreateAccessLogInput } from './access.schema';

export class AccessService {
  /**
   * Log an access event (entry/exit/re-entry)
   */
  async logAccess(tenantId: string, userId: string, input: CreateAccessLogInput) {
    // Verify venue belongs to tenant
    const venue = await prisma.venue.findFirst({
      where: { id: input.venueId, tenantId },
    });
    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    // Verify event if provided
    if (input.eventId) {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, venueId: input.venueId },
      });
      if (!event) {
        throw new AppError('Event not found', 404);
      }
    }

    // If ticket-based entry, mark ticket as used
    if (input.internalTicketId && input.type === 'ENTRY') {
      const ticket = await prisma.ticket.findFirst({
        where: { id: input.internalTicketId },
        include: {
          ticketType: {
            include: { event: { include: { venue: { select: { tenantId: true } } } } },
          },
        },
      });

      if (!ticket || ticket.ticketType.event.venue.tenantId !== tenantId) {
        throw new AppError('Ticket not found', 404);
      }

      if (ticket.status !== 'VALID') {
        throw new AppError(`Ticket is ${ticket.status}`, 400);
      }

      await prisma.ticket.update({
        where: { id: input.internalTicketId },
        data: { status: 'USED', usedAt: new Date(), usedById: userId },
      });
    }

    const log = await prisma.accessLog.create({
      data: {
        venueId: input.venueId,
        eventId: input.eventId,
        type: input.type,
        source: input.source,
        externalTicketId: input.externalTicketId,
        internalTicketId: input.internalTicketId,
        personName: input.personName,
        scannedCode: input.scannedCode,
        scannedById: userId,
      },
    });

    // Calculate current occupancy
    const occupancy = await this.getOccupancy(tenantId, input.venueId);

    const eventName = input.type === 'ENTRY' ? 'access:entry' : input.type === 'EXIT' ? 'access:exit' : 'access:entry';

    io.to(`venue:${input.venueId}`).emit(eventName, {
      logId: log.id,
      type: log.type,
      source: log.source,
      personName: log.personName,
      occupancy,
    });

    return { ...log, occupancy };
  }

  /**
   * Get access logs with filters
   */
  async getLogs(
    tenantId: string,
    filters: {
      venueId: string;
      eventId?: string;
      type?: string;
      source?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    // Verify venue
    const venue = await prisma.venue.findFirst({
      where: { id: filters.venueId, tenantId },
    });
    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    const where: any = { venueId: filters.venueId };

    if (filters.eventId) where.eventId = filters.eventId;
    if (filters.type) where.type = filters.type;
    if (filters.source) where.source = filters.source;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    return prisma.accessLog.findMany({
      where,
      include: {
        scannedBy: { select: { id: true, firstName: true, lastName: true } },
        event: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  /**
   * Get current occupancy for a venue
   */
  async getOccupancy(tenantId: string, venueId: string) {
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, tenantId },
    });
    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    // Count entries and exits for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [entries, exits] = await Promise.all([
      prisma.accessLog.count({
        where: {
          venueId,
          type: { in: ['ENTRY', 'RE_ENTRY'] },
          createdAt: { gte: today },
        },
      }),
      prisma.accessLog.count({
        where: {
          venueId,
          type: 'EXIT',
          createdAt: { gte: today },
        },
      }),
    ]);

    const current = entries - exits;

    return {
      current: Math.max(0, current),
      entries,
      exits,
      capacity: venue.capacity,
      percentage: venue.capacity ? Math.round((Math.max(0, current) / venue.capacity) * 100) : null,
    };
  }

  /**
   * Get access stats for a venue
   */
  async getStats(tenantId: string, venueId: string, eventId?: string) {
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, tenantId },
    });
    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    const where: any = { venueId };
    if (eventId) where.eventId = eventId;

    const [byType, bySource, total] = await Promise.all([
      prisma.accessLog.groupBy({
        by: ['type'],
        where,
        _count: true,
      }),
      prisma.accessLog.groupBy({
        by: ['source'],
        where,
        _count: true,
      }),
      prisma.accessLog.count({ where }),
    ]);

    const occupancy = await this.getOccupancy(tenantId, venueId);

    return {
      total,
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
      bySource: bySource.map((s) => ({ source: s.source, count: s._count })),
      occupancy,
    };
  }
}

export const accessService = new AccessService();
