import { prisma } from '../../common/database';
import { CreateStaffInput, UpdateStaffInput } from './staff.schema';
import bcrypt from 'bcryptjs';

class StaffService {
  /**
   * Get all staff members for a venue
   */
  async findByVenue(tenantId: string, venueId: string) {
    // Get users that have access to this venue
    const userVenues = await prisma.userVenue.findMany({
      where: { venueId },
      include: {
        user: true,
      },
    });

    return userVenues
      .filter(uv => uv.user && uv.user.tenantId === tenantId)
      .map(uv => ({
        id: uv.user.id,
        venueId,
        firstName: uv.user.firstName,
        lastName: uv.user.lastName,
        email: uv.user.email,
        phone: uv.user.phone,
        role: uv.user.role.toLowerCase(),
        pin: uv.user.pin ? '****' : null,
        isActive: uv.user.isActive,
        hireDate: uv.user.hireDate.toISOString(),
        terminationDate: uv.user.terminationDate?.toISOString() || null,
        hourlyRate: uv.user.hourlyRate ? Number(uv.user.hourlyRate) : null,
        notes: uv.user.notes,
        createdAt: uv.user.createdAt.toISOString(),
        updatedAt: uv.user.updatedAt.toISOString(),
      }));
  }

  /**
   * Get a staff member by ID
   */
  async findById(tenantId: string, id: string) {
    const user = await prisma.user.findFirst({
      where: { id, tenantId },
      include: {
        venues: true,
      },
    });

    if (!user) {
      throw new Error('Staff member not found');
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role.toLowerCase(),
      pin: user.pin ? '****' : null,
      isActive: user.isActive,
      hireDate: user.hireDate.toISOString(),
      terminationDate: user.terminationDate?.toISOString() || null,
      hourlyRate: user.hourlyRate ? Number(user.hourlyRate) : null,
      notes: user.notes,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      venueIds: user.venues.map(v => v.venueId),
    };
  }

  /**
   * Create a new staff member
   */
  async create(tenantId: string, input: CreateStaffInput) {
    const { venueId, pin, ...userData } = input;

    // Generate a temporary password (they'll use PIN for quick login)
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Hash PIN if provided
    let pinHash: string | undefined;
    if (pin) {
      pinHash = await bcrypt.hash(pin, 10);
    }

    // Create user with venue access
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: userData.email || `staff-${Date.now()}@temp.clubio.local`,
        passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        role: userData.role,
        pin: pinHash,
        hourlyRate: userData.hourlyRate,
        notes: userData.notes,
        venues: {
          create: { venueId },
        },
      },
    });

    return {
      id: user.id,
      venueId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role.toLowerCase(),
      pin: pin ? '****' : null,
      isActive: user.isActive,
      hireDate: user.hireDate.toISOString(),
      terminationDate: null,
      hourlyRate: user.hourlyRate ? Number(user.hourlyRate) : null,
      notes: user.notes,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  /**
   * Update a staff member
   */
  async update(tenantId: string, id: string, input: UpdateStaffInput) {
    // Verify user belongs to tenant
    const existing = await prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('Staff member not found');
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        role: input.role,
        hourlyRate: input.hourlyRate,
        notes: input.notes,
        isActive: input.isActive,
      },
    });

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role.toLowerCase(),
      pin: user.pin ? '****' : null,
      isActive: user.isActive,
      hireDate: user.hireDate.toISOString(),
      terminationDate: user.terminationDate?.toISOString() || null,
      hourlyRate: user.hourlyRate ? Number(user.hourlyRate) : null,
      notes: user.notes,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  /**
   * Update staff PIN
   */
  async updatePin(tenantId: string, id: string, pin: string) {
    // Verify user belongs to tenant
    const existing = await prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('Staff member not found');
    }

    const pinHash = await bcrypt.hash(pin, 10);

    await prisma.user.update({
      where: { id },
      data: { pin: pinHash },
    });

    return { success: true };
  }

  /**
   * Deactivate a staff member
   */
  async deactivate(tenantId: string, id: string) {
    const existing = await prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('Staff member not found');
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        terminationDate: new Date(),
      },
    });

    return {
      id: user.id,
      isActive: user.isActive,
      terminationDate: user.terminationDate?.toISOString() || null,
    };
  }

  /**
   * Activate a staff member
   */
  async activate(tenantId: string, id: string) {
    const existing = await prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('Staff member not found');
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        isActive: true,
        terminationDate: null,
      },
    });

    return {
      id: user.id,
      isActive: user.isActive,
    };
  }

  /**
   * Delete a staff member (permanent)
   */
  async delete(tenantId: string, id: string, requesterId: string) {
    if (id === requesterId) {
      throw new Error('Cannot delete yourself');
    }

    const existing = await prisma.user.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('Staff member not found');
    }

    await prisma.user.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Get staff summary with stats
   */
  async getSummary(tenantId: string, id: string, startDate?: Date, endDate?: Date) {
    const user = await this.findById(tenantId, id);

    // Get shift stats
    const shifts = await prisma.shift.findMany({
      where: {
        userId: id,
        scheduledStart: {
          gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          lte: endDate || new Date(),
        },
      },
    });

    const totalShifts = shifts.length;
    const completedShifts = shifts.filter(s => s.status === 'COMPLETED');

    let totalHours = 0;
    completedShifts.forEach(shift => {
      if (shift.startTime && shift.endTime) {
        totalHours += (shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60);
      }
    });

    // Get sales stats (orders created by this user)
    const orders = await prisma.order.aggregate({
      where: {
        createdById: id,
        status: 'COMPLETED',
        createdAt: {
          gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          lte: endDate || new Date(),
        },
      },
      _sum: { total: true },
      _count: true,
    });

    const totalSales = orders._sum.total ? Number(orders._sum.total) : 0;
    const totalOrders = orders._count;
    const averageTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Get last shift
    const lastShift = await prisma.shift.findFirst({
      where: { userId: id },
      orderBy: { scheduledStart: 'desc' },
    });

    return {
      staff: user,
      totalShifts,
      totalHours: Math.round(totalHours * 100) / 100,
      totalSales,
      averageTicket: Math.round(averageTicket),
      lastShiftAt: lastShift?.endTime || lastShift?.scheduledEnd || null,
    };
  }
}

export const staffService = new StaffService();
