import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
  ReorderCategoriesInput,
} from './categories.schema';

export class CategoriesService {
  /**
   * Get all categories for a tenant
   */
  async findAll(tenantId: string) {
    return prisma.category.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
    });
  }

  /**
   * Get a category by ID
   */
  async findById(tenantId: string, id: string) {
    const category = await prisma.category.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
    });

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    return category;
  }

  /**
   * Create a new category
   */
  async create(tenantId: string, input: CreateCategoryInput) {
    // Get max sortOrder to add at the end
    const maxSort = await prisma.category.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });

    const sortOrder = input.sortOrder || (maxSort._max.sortOrder || 0) + 1;

    return prisma.category.create({
      data: {
        tenantId,
        ...input,
        sortOrder,
      },
    });
  }

  /**
   * Update a category
   */
  async update(tenantId: string, id: string, input: UpdateCategoryInput) {
    // Check category exists and belongs to tenant
    await this.findById(tenantId, id);

    return prisma.category.update({
      where: { id },
      data: input,
    });
  }

  /**
   * Delete (deactivate) a category
   */
  async delete(tenantId: string, id: string) {
    // Check category exists and belongs to tenant
    const category = await this.findById(tenantId, id);

    // Check if category has active products
    if (category._count.products > 0) {
      throw new AppError(
        `Cannot delete category with ${category._count.products} active products. Move or delete products first.`,
        400
      );
    }

    return prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Reorder categories
   */
  async reorder(tenantId: string, input: ReorderCategoriesInput) {
    // Verify all categories belong to tenant
    const categoryIds = input.categories.map((c) => c.id);
    const existingCategories = await prisma.category.findMany({
      where: { id: { in: categoryIds }, tenantId },
      select: { id: true },
    });

    if (existingCategories.length !== categoryIds.length) {
      throw new AppError('One or more categories not found', 404);
    }

    // Update all sortOrders in a transaction
    await prisma.$transaction(
      input.categories.map((cat) =>
        prisma.category.update({
          where: { id: cat.id },
          data: { sortOrder: cat.sortOrder },
        })
      )
    );

    return this.findAll(tenantId);
  }

  /**
   * Get category with products
   */
  async findWithProducts(tenantId: string, id: string) {
    const category = await prisma.category.findFirst({
      where: { id, tenantId, isActive: true },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    return category;
  }
}

export const categoriesService = new CategoriesService();