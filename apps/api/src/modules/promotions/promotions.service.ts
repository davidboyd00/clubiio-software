import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import { CreatePromotionInput, UpdatePromotionInput } from './promotions.schema';

export class PromotionsService {
  async findAll(tenantId: string, options: { activeOnly?: boolean } = {}) {
    const where: any = { tenantId };

    if (options.activeOnly) {
      where.isActive = true;
    }

    return prisma.promotion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const promotion = await prisma.promotion.findFirst({
      where: { id, tenantId },
    });

    if (!promotion) {
      throw new AppError('Promotion not found', 404);
    }

    return promotion;
  }

  async create(tenantId: string, input: CreatePromotionInput) {
    return prisma.promotion.create({
      data: {
        tenantId,
        name: input.name,
        description: input.description || null,
        discountType: input.discountType,
        discountValue: input.discountValue,
        daysOfWeek: input.daysOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        applyTo: input.applyTo,
        categoryIds: input.categoryIds,
        productIds: input.productIds,
        isActive: input.isActive,
      },
    });
  }

  async update(tenantId: string, id: string, input: UpdatePromotionInput) {
    await this.findById(tenantId, id);

    const data: any = { ...input };
    if (data.description === '') data.description = null;

    return prisma.promotion.update({
      where: { id },
      data,
    });
  }

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await prisma.promotion.delete({ where: { id } });
  }
}

export const promotionsService = new PromotionsService();
