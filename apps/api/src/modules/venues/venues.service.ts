import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import { CreateVenueInput, UpdateVenueInput } from './venues.schema';

export class VenuesService {
  /**
   * Get all venues for a tenant
   */
  async findAll(tenantId: string) {
    return prisma.venue.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }
  
  /**
   * Get a venue by ID
   */
  async findById(tenantId: string, id: string) {
    const venue = await prisma.venue.findFirst({
      where: { id, tenantId },
    });
    
    if (!venue) {
      throw new AppError('Venue not found', 404);
    }
    
    return venue;
  }
  
  /**
   * Create a new venue
   */
  async create(tenantId: string, input: CreateVenueInput) {
    return prisma.venue.create({
      data: {
        tenantId,
        ...input,
      },
    });
  }
  
  /**
   * Update a venue
   */
  async update(tenantId: string, id: string, input: UpdateVenueInput) {
    // Check venue exists and belongs to tenant
    await this.findById(tenantId, id);
    
    return prisma.venue.update({
      where: { id },
      data: input,
    });
  }
  
  /**
   * Delete (deactivate) a venue
   */
  async delete(tenantId: string, id: string) {
    // Check venue exists and belongs to tenant
    await this.findById(tenantId, id);
    
    return prisma.venue.update({
      where: { id },
      data: { isActive: false },
    });
  }
  
  /**
   * Get venue with full stats
   */
  async getVenueWithStats(tenantId: string, id: string) {
    const venue = await this.findById(tenantId, id);
    
    const [
      cashRegistersCount,
      usersCount,
      warehousesCount,
    ] = await Promise.all([
      prisma.cashRegister.count({ where: { venueId: id, isActive: true } }),
      prisma.userVenue.count({ where: { venueId: id } }),
      prisma.warehouse.count({ where: { venueId: id, isActive: true } }),
    ]);
    
    return {
      ...venue,
      stats: {
        cashRegisters: cashRegistersCount,
        users: usersCount,
        warehouses: warehousesCount,
      },
    };
  }
}

export const venuesService = new VenuesService();
