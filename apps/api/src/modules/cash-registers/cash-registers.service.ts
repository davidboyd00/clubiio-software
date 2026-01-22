import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import {
  CreateCashRegisterInput,
  UpdateCashRegisterInput,
} from './cash-registers.schema';

export class CashRegistersService {
  /**
   * Get all cash registers for a venue
   */
  async findAllByVenue(tenantId: string, venueId: string) {
    // Verify venue belongs to tenant
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, tenantId, isActive: true },
    });

    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    return prisma.cashRegister.findMany({
      where: { venueId, isActive: true },
      include: {
        warehouse: {
          select: { id: true, name: true },
        },
        _count: {
          select: { cashSessions: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get a cash register by ID
   */
  async findById(tenantId: string, id: string) {
    const cashRegister = await prisma.cashRegister.findFirst({
      where: { id },
      include: {
        venue: {
          select: { id: true, name: true, tenantId: true },
        },
        warehouse: {
          select: { id: true, name: true },
        },
        cashSessions: {
          where: { status: 'OPEN' },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!cashRegister) {
      throw new AppError('Cash register not found', 404);
    }

    if (cashRegister.venue.tenantId !== tenantId) {
      throw new AppError('Cash register not found', 404);
    }

    return cashRegister;
  }

  /**
   * Get cash register with current session status
   */
  async findWithStatus(tenantId: string, id: string) {
    const cashRegister = await this.findById(tenantId, id);

    const openSession = cashRegister.cashSessions[0] || null;

    return {
      ...cashRegister,
      hasOpenSession: !!openSession,
      currentSession: openSession,
    };
  }

  /**
   * Create a new cash register
   */
  async create(tenantId: string, input: CreateCashRegisterInput) {
    // Verify venue belongs to tenant
    const venue = await prisma.venue.findFirst({
      where: { id: input.venueId, tenantId, isActive: true },
    });

    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    // Verify warehouse if provided
    if (input.warehouseId) {
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: input.warehouseId, venueId: input.venueId, isActive: true },
      });

      if (!warehouse) {
        throw new AppError('Warehouse not found', 404);
      }
    }

    return prisma.cashRegister.create({
      data: input,
      include: {
        venue: {
          select: { id: true, name: true },
        },
        warehouse: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Update a cash register
   */
  async update(tenantId: string, id: string, input: UpdateCashRegisterInput) {
    const cashRegister = await this.findById(tenantId, id);

    // Verify new warehouse if provided
    if (input.warehouseId) {
      const warehouse = await prisma.warehouse.findFirst({
        where: {
          id: input.warehouseId,
          venueId: cashRegister.venue.id,
          isActive: true,
        },
      });

      if (!warehouse) {
        throw new AppError('Warehouse not found', 404);
      }
    }

    return prisma.cashRegister.update({
      where: { id },
      data: input,
      include: {
        venue: {
          select: { id: true, name: true },
        },
        warehouse: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Delete (deactivate) a cash register
   */
  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);

    // Check for open sessions
    const openSessions = await prisma.cashSession.count({
      where: { cashRegisterId: id, status: 'OPEN' },
    });

    if (openSessions > 0) {
      throw new AppError('Cannot delete cash register with open sessions', 400);
    }

    return prisma.cashRegister.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export const cashRegistersService = new CashRegistersService();
