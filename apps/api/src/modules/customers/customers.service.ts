import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import { CreateCustomerInput, UpdateCustomerInput } from './customers.schema';

export class CustomersService {
  async findAll(tenantId: string, options: { search?: string; isVip?: boolean } = {}) {
    const where: any = { tenantId };

    if (options.search) {
      const search = options.search.trim();
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { rut: { contains: search } },
      ];
    }

    if (options.isVip !== undefined) {
      where.isVip = options.isVip;
    }

    return prisma.customer.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async findById(tenantId: string, id: string) {
    const customer = await prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    return customer;
  }

  async create(tenantId: string, input: CreateCustomerInput) {
    return prisma.customer.create({
      data: {
        tenantId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        rut: input.rut || null,
        notes: input.notes || null,
        isVip: input.isVip,
      },
    });
  }

  async update(tenantId: string, id: string, input: UpdateCustomerInput) {
    await this.findById(tenantId, id);

    const data: any = { ...input };
    // Convert empty strings to null for optional fields
    for (const key of ['email', 'phone', 'address', 'rut', 'notes']) {
      if (data[key] === '') data[key] = null;
    }

    return prisma.customer.update({
      where: { id },
      data,
    });
  }

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await prisma.customer.delete({ where: { id } });
  }
}

export const customersService = new CustomersService();
