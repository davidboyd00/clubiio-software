import bcrypt from 'bcryptjs';
import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import { CreateUserInput, UpdateUserInput } from './users.schema';

export class UsersService {
  /**
   * Get all users for a tenant
   */
  async findAll(tenantId: string) {
    return prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        venues: {
          include: {
            venue: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
  }
  
  /**
   * Get a user by ID
   */
  async findById(tenantId: string, id: string) {
    const user = await prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        pin: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        venues: {
          include: {
            venue: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    return user;
  }
  
  /**
   * Create a new user
   */
  async create(tenantId: string, input: CreateUserInput) {
    // Check if email already exists in tenant
    const existingUser = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId,
          email: input.email,
        },
      },
    });
    
    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }
    
    // If PIN provided, check it doesn't exist in tenant
    if (input.pin) {
      const existingPin = await prisma.user.findFirst({
        where: { tenantId, pin: input.pin },
      });
      
      if (existingPin) {
        throw new AppError('PIN already in use', 409);
      }
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 12);
    
    // Create user with venue assignments
    const { venueIds, password, ...userData } = input;
    
    const user = await prisma.user.create({
      data: {
        tenantId,
        ...userData,
        passwordHash,
        venues: venueIds
          ? {
              create: venueIds.map((venueId) => ({ venueId })),
            }
          : undefined,
      },
      include: {
        venues: {
          include: {
            venue: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    
    // Don't return passwordHash
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  
  /**
   * Update a user
   */
  async update(
    tenantId: string,
    id: string,
    currentUserId: string,
    input: UpdateUserInput
  ) {
    // Check user exists and belongs to tenant
    const existingUser = await prisma.user.findFirst({
      where: { id, tenantId },
    });
    
    if (!existingUser) {
      throw new AppError('User not found', 404);
    }
    
    // Prevent demoting yourself from OWNER
    if (
      id === currentUserId &&
      existingUser.role === 'OWNER' &&
      input.role &&
      input.role !== 'OWNER'
    ) {
      throw new AppError('Cannot demote yourself from OWNER', 400);
    }
    
    // If PIN provided, check it doesn't exist (except for this user)
    if (input.pin) {
      const existingPin = await prisma.user.findFirst({
        where: {
          tenantId,
          pin: input.pin,
          id: { not: id },
        },
      });
      
      if (existingPin) {
        throw new AppError('PIN already in use', 409);
      }
    }
    
    // Extract venueIds to handle separately
    const { venueIds, ...userData } = input;
    
    // Update user
    await prisma.$transaction(async (tx) => {
      // Update user data
      await tx.user.update({
        where: { id },
        data: userData,
      });
      
      // Update venue assignments if provided
      if (venueIds !== undefined) {
        // Delete all existing assignments
        await tx.userVenue.deleteMany({
          where: { userId: id },
        });
        
        // Create new assignments
        if (venueIds.length > 0) {
          await tx.userVenue.createMany({
            data: venueIds.map((venueId) => ({
              userId: id,
              venueId,
            })),
          });
        }
      }
    });
    
    // Get full user with venues
    return this.findById(tenantId, id);
  }
  
  /**
   * Delete (deactivate) a user
   */
  async delete(tenantId: string, id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new AppError('Cannot delete yourself', 400);
    }
    
    // Check user exists and belongs to tenant
    const user = await prisma.user.findFirst({
      where: { id, tenantId },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Prevent deleting the only OWNER
    if (user.role === 'OWNER') {
      const ownerCount = await prisma.user.count({
        where: { tenantId, role: 'OWNER', isActive: true },
      });
      
      if (ownerCount <= 1) {
        throw new AppError('Cannot delete the only owner', 400);
      }
    }
    
    return prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }
  
  /**
   * Get users by venue
   */
  async findByVenue(tenantId: string, venueId: string) {
    return prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { role: { in: ['OWNER', 'ADMIN'] } }, // Admins have access to all venues
          { venues: { some: { venueId } } },
        ],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
  }
}

export const usersService = new UsersService();