import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import { cache, cacheKeys, cacheTTL } from '../../common/cache';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
  ReorderCategoriesInput,
} from './categories.schema';

export class CategoriesService {
  /**
   * Get all categories for a tenant
   * Cached for 2 minutes
   */
  async findAll(tenantId: string) {
    return cache.getOrSet(
      cacheKeys.categories(tenantId),
      () => prisma.category.findMany({
        where: { tenantId, isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: {
            select: { products: { where: { isActive: true } } },
          },
        },
      }),
      cacheTTL.medium
    );
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

    const category = await prisma.category.create({
      data: {
        tenantId,
        ...input,
        sortOrder,
      },
    });

    // Invalidate cache
    this.invalidateCache(tenantId);

    return category;
  }

  /**
   * Update a category
   */
  async update(tenantId: string, id: string, input: UpdateCategoryInput) {
    // Check category exists and belongs to tenant
    await this.findById(tenantId, id);

    const category = await prisma.category.update({
      where: { id },
      data: input,
    });

    // Invalidate cache
    this.invalidateCache(tenantId);

    return category;
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

    const result = await prisma.category.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidate cache
    this.invalidateCache(tenantId);

    return result;
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

    // Invalidate cache
    this.invalidateCache(tenantId);

    return this.findAll(tenantId);
  }

  /**
   * Invalidate all category-related caches for a tenant
   */
  private invalidateCache(tenantId: string) {
    cache.invalidate(cacheKeys.categories(tenantId));
    cache.invalidate(cacheKeys.productsGrouped(tenantId)); // Products grouped depends on categories
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