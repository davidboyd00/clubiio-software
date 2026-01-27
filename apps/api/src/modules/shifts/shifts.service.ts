import { prisma } from '../../common/database';
import { CreateShiftInput, UpdateShiftInput } from './shifts.schema';

class ShiftsService {
  /**
   * Get shifts for a venue on a specific date
   */
  async findByVenue(venueId: string, date?: string) {
    const startOfDay = date
      ? new Date(date)
      : new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const shifts = await prisma.shift.findMany({
      where: {
        venueId,
        scheduledStart: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            email: true,
          },
        },
      },
      orderBy: { scheduledStart: 'asc' },
    });

    return shifts.map(shift => ({
      ...shift,
      staff: shift.user
        ? {
            id: shift.user.id,
            firstName: shift.user.firstName,
            lastName: shift.user.lastName,
            role: shift.user.role.toLowerCase(),
            email: shift.user.email,
          }
        : null,
    }));
  }

  /**
   * Get shifts for a staff member
   */
  async findByStaff(staffId: string, startDate?: string, endDate?: string) {
    const where: any = { userId: staffId };

    if (startDate || endDate) {
      where.scheduledStart = {};
      if (startDate) where.scheduledStart.gte = new Date(startDate);
      if (endDate) where.scheduledStart.lte = new Date(endDate);
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { scheduledStart: 'desc' },
    });

    return shifts.map(shift => ({
      ...shift,
      staff: shift.user
        ? {
            id: shift.user.id,
            firstName: shift.user.firstName,
            lastName: shift.user.lastName,
            role: shift.user.role.toLowerCase(),
          }
        : null,
    }));
  }

  /**
   * Get a shift by ID
   */
  async findById(id: string) {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    if (!shift) {
      throw new Error('Shift not found');
    }

    return {
      ...shift,
      staff: shift.user
        ? {
            id: shift.user.id,
            firstName: shift.user.firstName,
            lastName: shift.user.lastName,
            role: shift.user.role.toLowerCase(),
          }
        : null,
    };
  }

  /**
   * Create a new shift
   */
  async create(input: CreateShiftInput) {
    const shift = await prisma.shift.create({
      data: {
        userId: input.staffId,
        venueId: input.venueId,
        scheduledStart: new Date(input.scheduledStart),
        scheduledEnd: new Date(input.scheduledEnd),
        notes: input.notes,
        status: 'SCHEDULED',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return {
      ...shift,
      staff: shift.user
        ? {
            id: shift.user.id,
            firstName: shift.user.firstName,
            lastName: shift.user.lastName,
            role: shift.user.role.toLowerCase(),
          }
        : null,
    };
  }

  /**
   * Update a shift
   */
  async update(id: string, input: UpdateShiftInput) {
    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Shift not found');
    }

    const shift = await prisma.shift.update({
      where: { id },
      data: {
        scheduledStart: input.scheduledStart
          ? new Date(input.scheduledStart)
          : undefined,
        scheduledEnd: input.scheduledEnd
          ? new Date(input.scheduledEnd)
          : undefined,
        notes: input.notes,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return {
      ...shift,
      staff: shift.user
        ? {
            id: shift.user.id,
            firstName: shift.user.firstName,
            lastName: shift.user.lastName,
            role: shift.user.role.toLowerCase(),
          }
        : null,
    };
  }

  /**
   * Delete a shift
   */
  async delete(id: string) {
    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Shift not found');
    }

    await prisma.shift.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Clock in to a shift
   */
  async clockIn(id: string) {
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) {
      throw new Error('Shift not found');
    }

    if (shift.status !== 'SCHEDULED') {
      throw new Error('Can only clock in to scheduled shifts');
    }

    return prisma.shift.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        startTime: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Clock out of a shift
   */
  async clockOut(id: string) {
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) {
      throw new Error('Shift not found');
    }

    if (shift.status !== 'ACTIVE') {
      throw new Error('Can only clock out of active shifts');
    }

    return prisma.shift.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endTime: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Cancel a shift
   */
  async cancel(id: string, reason?: string) {
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) {
      throw new Error('Shift not found');
    }

    if (!['SCHEDULED', 'ACTIVE'].includes(shift.status)) {
      throw new Error('Can only cancel scheduled or active shifts');
    }

    return prisma.shift.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: reason ? `${shift.notes || ''}\nCancelled: ${reason}`.trim() : shift.notes,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Mark missed shifts (run periodically)
   */
  async markMissedShifts() {
    const now = new Date();
    const threshold = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes grace

    const result = await prisma.shift.updateMany({
      where: {
        status: 'SCHEDULED',
        scheduledStart: { lt: threshold },
      },
      data: { status: 'MISSED' },
    });

    return { markedAsMissed: result.count };
  }
}

export const shiftsService = new ShiftsService();
