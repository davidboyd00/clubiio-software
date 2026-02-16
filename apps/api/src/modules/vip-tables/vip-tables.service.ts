import crypto from 'crypto';
import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import { io } from '../../index';
import {
  CreateVipTableInput,
  UpdateVipTableInput,
  CreateReservationInput,
  UpdateReservationInput,
  UpdateReservationStatusInput,
  AddGuestInput,
} from './vip-tables.schema';

export class VipTablesService {
  // ---- VIP Tables ----

  /**
   * Get all VIP tables for a venue
   */
  async findAllTables(tenantId: string, venueId: string) {
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, tenantId },
    });
    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    return prisma.vIPTable.findMany({
      where: { venueId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Create a VIP table
   */
  async createTable(tenantId: string, input: CreateVipTableInput) {
    const venue = await prisma.venue.findFirst({
      where: { id: input.venueId, tenantId },
    });
    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    return prisma.vIPTable.create({
      data: {
        venueId: input.venueId,
        name: input.name,
        capacity: input.capacity,
        minConsumption: input.minConsumption,
        location: input.location,
        sortOrder: input.sortOrder,
      },
    });
  }

  /**
   * Update a VIP table
   */
  async updateTable(tenantId: string, id: string, input: UpdateVipTableInput) {
    const table = await prisma.vIPTable.findFirst({
      where: { id },
      include: { venue: { select: { tenantId: true } } },
    });
    if (!table || table.venue.tenantId !== tenantId) {
      throw new AppError('VIP table not found', 404);
    }

    return prisma.vIPTable.update({
      where: { id },
      data: input,
    });
  }

  /**
   * Delete (deactivate) a VIP table
   */
  async deleteTable(tenantId: string, id: string) {
    const table = await prisma.vIPTable.findFirst({
      where: { id },
      include: { venue: { select: { tenantId: true } } },
    });
    if (!table || table.venue.tenantId !== tenantId) {
      throw new AppError('VIP table not found', 404);
    }

    return prisma.vIPTable.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ---- Reservations ----

  /**
   * Get reservations for an event
   */
  async findReservations(tenantId: string, eventId: string) {
    const event = await prisma.event.findFirst({
      where: { id: eventId },
      include: { venue: { select: { tenantId: true } } },
    });
    if (!event || event.venue.tenantId !== tenantId) {
      throw new AppError('Event not found', 404);
    }

    return prisma.vIPTableReservation.findMany({
      where: { eventId },
      include: {
        table: { select: { id: true, name: true, location: true, capacity: true } },
        guests: true,
        vipCard: { select: { id: true, cardNumber: true, balance: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a reservation by ID
   */
  async findReservationById(tenantId: string, id: string) {
    const reservation = await prisma.vIPTableReservation.findFirst({
      where: { id },
      include: {
        table: {
          include: { venue: { select: { id: true, tenantId: true } } },
        },
        event: { select: { id: true, name: true, date: true } },
        guests: true,
        vipCard: { select: { id: true, cardNumber: true, balance: true } },
      },
    });

    if (!reservation || reservation.table.venue.tenantId !== tenantId) {
      throw new AppError('Reservation not found', 404);
    }

    return reservation;
  }

  /**
   * Create a reservation
   */
  async createReservation(tenantId: string, input: CreateReservationInput) {
    // Verify table
    const table = await prisma.vIPTable.findFirst({
      where: { id: input.tableId },
      include: { venue: { select: { id: true, tenantId: true } } },
    });
    if (!table || table.venue.tenantId !== tenantId) {
      throw new AppError('VIP table not found', 404);
    }

    // Verify event belongs to same venue
    const event = await prisma.event.findFirst({
      where: { id: input.eventId },
      include: { venue: { select: { tenantId: true } } },
    });
    if (!event || event.venue.tenantId !== tenantId) {
      throw new AppError('Event not found', 404);
    }

    // Check table not already reserved for this event
    const existing = await prisma.vIPTableReservation.findFirst({
      where: {
        tableId: input.tableId,
        eventId: input.eventId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    });
    if (existing) {
      throw new AppError('Table is already reserved for this event', 400);
    }

    // Verify VIP card if provided
    if (input.vipCardId) {
      const card = await prisma.vIPCard.findFirst({
        where: { id: input.vipCardId, tenantId },
      });
      if (!card) {
        throw new AppError('VIP card not found', 404);
      }
    }

    const lateGuestCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const reservation = await prisma.vIPTableReservation.create({
      data: {
        tableId: input.tableId,
        eventId: input.eventId,
        holderName: input.holderName,
        holderPhone: input.holderPhone,
        holderEmail: input.holderEmail,
        guestCount: input.guestCount,
        lateGuestCode,
        lateGuestLimit: input.lateGuestLimit,
        notes: input.notes,
        vipCardId: input.vipCardId,
        guests: input.guests?.length
          ? { create: input.guests }
          : undefined,
      },
      include: {
        table: { select: { id: true, name: true } },
        guests: true,
      },
    });

    io.to(`venue:${table.venue.id}`).emit('vip-table:reservation-created', {
      reservationId: reservation.id,
      tableName: reservation.table.name,
      holderName: reservation.holderName,
      guestCount: reservation.guestCount,
    });

    return reservation;
  }

  /**
   * Update a reservation
   */
  async updateReservation(tenantId: string, id: string, input: UpdateReservationInput) {
    await this.findReservationById(tenantId, id);

    return prisma.vIPTableReservation.update({
      where: { id },
      data: input,
      include: {
        table: { select: { id: true, name: true } },
        guests: true,
      },
    });
  }

  /**
   * Update reservation status
   */
  async updateReservationStatus(tenantId: string, id: string, input: UpdateReservationStatusInput) {
    await this.findReservationById(tenantId, id);

    const data: any = { status: input.status };
    if (input.status === 'ARRIVED') {
      data.arrivedAt = new Date();
    }
    if (input.status === 'COMPLETED') {
      data.completedAt = new Date();
    }

    return prisma.vIPTableReservation.update({
      where: { id },
      data,
      include: {
        table: { select: { id: true, name: true } },
        guests: true,
      },
    });
  }

  /**
   * Delete a reservation (only if PENDING)
   */
  async deleteReservation(tenantId: string, id: string) {
    const reservation = await this.findReservationById(tenantId, id);

    if (reservation.status !== 'PENDING') {
      throw new AppError('Only pending reservations can be deleted', 400);
    }

    await prisma.vIPTableReservation.delete({ where: { id } });
  }

  // ---- Guests ----

  /**
   * Add a guest to a reservation
   */
  async addGuest(tenantId: string, reservationId: string, input: AddGuestInput) {
    const reservation = await this.findReservationById(tenantId, reservationId);

    if (input.isLateGuest) {
      const lateGuests = reservation.guests.filter((g) => g.isLateGuest);
      if (lateGuests.length >= reservation.lateGuestLimit) {
        throw new AppError('Late guest limit reached', 400);
      }
    }

    return prisma.vIPTableGuest.create({
      data: {
        reservationId,
        name: input.name,
        phone: input.phone,
        isLateGuest: input.isLateGuest,
      },
    });
  }

  /**
   * Remove a guest from a reservation
   */
  async removeGuest(tenantId: string, reservationId: string, guestId: string) {
    await this.findReservationById(tenantId, reservationId);

    const guest = await prisma.vIPTableGuest.findFirst({
      where: { id: guestId, reservationId },
    });
    if (!guest) {
      throw new AppError('Guest not found', 404);
    }

    await prisma.vIPTableGuest.delete({ where: { id: guestId } });
  }

  /**
   * Mark guest as arrived
   */
  async markGuestArrived(tenantId: string, reservationId: string, guestId: string) {
    const reservation = await this.findReservationById(tenantId, reservationId);

    const guest = await prisma.vIPTableGuest.findFirst({
      where: { id: guestId, reservationId },
    });
    if (!guest) {
      throw new AppError('Guest not found', 404);
    }

    const updated = await prisma.vIPTableGuest.update({
      where: { id: guestId },
      data: { status: 'ARRIVED', arrivedAt: new Date() },
    });

    const venueId = reservation.table.venue.id;
    io.to(`venue:${venueId}`).emit('vip-table:guest-arrived', {
      reservationId,
      guestId: updated.id,
      guestName: updated.name,
      tableName: reservation.table.name,
    });

    return updated;
  }

  /**
   * Validate a late guest code
   */
  async validateLateCode(tenantId: string, code: string) {
    const reservation = await prisma.vIPTableReservation.findFirst({
      where: { lateGuestCode: code },
      include: {
        table: {
          include: { venue: { select: { id: true, tenantId: true } } },
        },
        event: { select: { id: true, name: true, date: true } },
        guests: true,
      },
    });

    if (!reservation || reservation.table.venue.tenantId !== tenantId) {
      throw new AppError('Invalid code', 404);
    }

    return reservation;
  }
}

export const vipTablesService = new VipTablesService();
