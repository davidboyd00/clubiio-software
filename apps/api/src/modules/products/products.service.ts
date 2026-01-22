import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import { paginatedResponse, PaginationParams } from '../../common/response';
import {
  CreateProductInput,
  UpdateProductInput,
  ReorderProductsInput,
  BulkUpdatePricesInput,
  ImportProductsInput,
} from './products.schema';

interface FindAllOptions {
  categoryId?: string;
  search?: string;
  isAlcoholic?: boolean;
  isActive?: boolean;
  pagination?: PaginationParams;
}

export class ProductsService {
  /**
   * Get all products for a tenant with filtering and pagination
   */
  async findAll(tenantId: string, options: FindAllOptions = {}) {
    const {
      categoryId,
      search,
      isAlcoholic,
      isActive = true,
      pagination,
    } = options;

    const where: any = {
      tenantId,
      isActive,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { shortName: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (typeof isAlcoholic === 'boolean') {
      where.isAlcoholic = isAlcoholic;
    }

    // If pagination provided, return paginated response
    if (pagination) {
      const [items, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: {
              select: { id: true, name: true, color: true },
            },
          },
          orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
          skip: pagination.skip,
          take: pagination.limit,
        }),
        prisma.product.count({ where }),
      ]);

      return paginatedResponse(items, total, pagination);
    }

    // Otherwise return all
    return prisma.product.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
  }

  /**
   * Get products grouped by category (for TPV display)
   */
  async findGroupedByCategory(tenantId: string) {
    const categories = await prisma.category.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            shortName: true,
            price: true,
            isAlcoholic: true,
            barcode: true,
          },
        },
      },
    });

    return categories;
  }

  /**
   * Get a product by ID
   */
  async findById(tenantId: string, id: string) {
    const product = await prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
        stockItems: {
          include: {
            warehouse: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    return product;
  }

  /**
   * Get a product by barcode
   */
  async findByBarcode(tenantId: string, barcode: string) {
    const product = await prisma.product.findFirst({
      where: { tenantId, barcode, isActive: true },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    return product;
  }

  /**
   * Create a new product
   */
  async create(tenantId: string, input: CreateProductInput) {
    // Verify category exists and belongs to tenant
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, tenantId, isActive: true },
    });

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    // Check SKU uniqueness if provided
    if (input.sku) {
      const existingSku = await prisma.product.findUnique({
        where: { tenantId_sku: { tenantId, sku: input.sku } },
      });

      if (existingSku) {
        throw new AppError('SKU already exists', 409);
      }
    }

    // Get max sortOrder in category
    const maxSort = await prisma.product.aggregate({
      where: { tenantId, categoryId: input.categoryId },
      _max: { sortOrder: true },
    });

    const sortOrder = input.sortOrder || (maxSort._max.sortOrder || 0) + 1;

    // Generate shortName if not provided
    const shortName = input.shortName || input.name.substring(0, 15);

    return prisma.product.create({
      data: {
        tenantId,
        ...input,
        shortName,
        sortOrder,
      },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });
  }

  /**
   * Update a product
   */
  async update(tenantId: string, id: string, input: UpdateProductInput) {
    // Check product exists and belongs to tenant
    await this.findById(tenantId, id);

    // If changing category, verify new category exists
    if (input.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: input.categoryId, tenantId, isActive: true },
      });

      if (!category) {
        throw new AppError('Category not found', 404);
      }
    }

    // Check SKU uniqueness if changing
    if (input.sku) {
      const existingSku = await prisma.product.findFirst({
        where: {
          tenantId,
          sku: input.sku,
          id: { not: id },
        },
      });

      if (existingSku) {
        throw new AppError('SKU already exists', 409);
      }
    }

    return prisma.product.update({
      where: { id },
      data: input,
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });
  }

  /**
   * Delete (deactivate) a product
   */
  async delete(tenantId: string, id: string) {
    // Check product exists and belongs to tenant
    await this.findById(tenantId, id);

    return prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Bulk delete products
   */
  async bulkDelete(tenantId: string, ids: string[]) {
    // Verify all products belong to tenant
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, tenantId },
      select: { id: true },
    });

    if (products.length !== ids.length) {
      throw new AppError('One or more products not found', 404);
    }

    await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false },
    });

    return { deleted: ids.length };
  }

  /**
   * Reorder products within a category
   */
  async reorder(tenantId: string, input: ReorderProductsInput) {
    // Verify all products belong to tenant
    const productIds = input.products.map((p) => p.id);
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true },
    });

    if (existingProducts.length !== productIds.length) {
      throw new AppError('One or more products not found', 404);
    }

    // Update all sortOrders in a transaction
    await prisma.$transaction(
      input.products.map((prod) =>
        prisma.product.update({
          where: { id: prod.id },
          data: { sortOrder: prod.sortOrder },
        })
      )
    );

    return { updated: input.products.length };
  }

  /**
   * Bulk update prices
   */
  async bulkUpdatePrices(tenantId: string, input: BulkUpdatePricesInput) {
    // Verify all products belong to tenant
    const productIds = input.products.map((p) => p.id);
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true },
    });

    if (existingProducts.length !== productIds.length) {
      throw new AppError('One or more products not found', 404);
    }

    // Update all prices in a transaction
    await prisma.$transaction(
      input.products.map((prod) =>
        prisma.product.update({
          where: { id: prod.id },
          data: { price: prod.price },
        })
      )
    );

    return { updated: input.products.length };
  }

  /**
   * Import products from CSV/JSON
   */
  async import(tenantId: string, input: ImportProductsInput) {
    const results = {
      created: 0,
      updated: 0,
      errors: [] as { row: number; error: string }[],
    };

    // Get or create categories
    const categoryMap = new Map<string, string>();

    for (const product of input.products) {
      let categoryId = categoryMap.get(product.categoryName);

      if (!categoryId) {
        // Find existing category
        let category = await prisma.category.findFirst({
          where: {
            tenantId,
            name: { equals: product.categoryName, mode: 'insensitive' },
            isActive: true,
          },
        });

        if (!category && input.createMissingCategories) {
          // Create new category
          category = await prisma.category.create({
            data: {
              tenantId,
              name: product.categoryName,
            },
          });
        }

        if (category) {
          categoryId = category.id;
          categoryMap.set(product.categoryName, categoryId);
        }
      }

      if (!categoryId) {
        results.errors.push({
          row: input.products.indexOf(product) + 1,
          error: `Category "${product.categoryName}" not found`,
        });
        continue;
      }

      try {
        // Check if product with same SKU exists
        if (product.sku) {
          const existing = await prisma.product.findUnique({
            where: { tenantId_sku: { tenantId, sku: product.sku } },
          });

          if (existing) {
            // Update existing
            await prisma.product.update({
              where: { id: existing.id },
              data: {
                categoryId,
                name: product.name,
                shortName: product.shortName || product.name.substring(0, 15),
                barcode: product.barcode,
                price: product.price,
                cost: product.cost,
                isAlcoholic: product.isAlcoholic,
              },
            });
            results.updated++;
            continue;
          }
        }

        // Create new product
        await prisma.product.create({
          data: {
            tenantId,
            categoryId,
            name: product.name,
            shortName: product.shortName || product.name.substring(0, 15),
            sku: product.sku,
            barcode: product.barcode,
            price: product.price,
            cost: product.cost,
            isAlcoholic: product.isAlcoholic,
          },
        });
        results.created++;
      } catch (error) {
        results.errors.push({
          row: input.products.indexOf(product) + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get product stats for a tenant
   */
  async getStats(tenantId: string) {
    const [totalProducts, totalCategories, byCategory, alcoholic] =
      await Promise.all([
        prisma.product.count({ where: { tenantId, isActive: true } }),
        prisma.category.count({ where: { tenantId, isActive: true } }),
        prisma.product.groupBy({
          by: ['categoryId'],
          where: { tenantId, isActive: true },
          _count: true,
        }),
        prisma.product.count({
          where: { tenantId, isActive: true, isAlcoholic: true },
        }),
      ]);

    return {
      totalProducts,
      totalCategories,
      alcoholicProducts: alcoholic,
      nonAlcoholicProducts: totalProducts - alcoholic,
      productsPerCategory: byCategory,
    };
  }
}

export const productsService = new ProductsService();