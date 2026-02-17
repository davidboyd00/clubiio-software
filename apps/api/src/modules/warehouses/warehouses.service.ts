import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  UpsertStockInput,
  AdjustStockInput,
  TransferStockInput,
  PurchaseStockInput,
} from './warehouses.schema';

export class WarehousesService {
  // ============================================
  // Warehouse CRUD
  // ============================================

  async findAll(tenantId: string, venueId: string) {
    // Verify venue belongs to tenant
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, tenantId },
    });
    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    return prisma.warehouse.findMany({
      where: { venueId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(tenantId: string, id: string) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, venue: { tenantId } },
      include: {
        stockItems: {
          include: { product: { select: { id: true, name: true, sku: true } } },
          orderBy: { product: { name: 'asc' } },
        },
      },
    });

    if (!warehouse) {
      throw new AppError('Warehouse not found', 404);
    }

    return warehouse;
  }

  async create(tenantId: string, input: CreateWarehouseInput) {
    // Verify venue belongs to tenant
    const venue = await prisma.venue.findFirst({
      where: { id: input.venueId, tenantId },
    });
    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    return prisma.warehouse.create({
      data: input,
    });
  }

  async update(tenantId: string, id: string, input: UpdateWarehouseInput) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, venue: { tenantId } },
    });
    if (!warehouse) {
      throw new AppError('Warehouse not found', 404);
    }

    return prisma.warehouse.update({
      where: { id },
      data: input,
    });
  }

  async delete(tenantId: string, id: string) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, venue: { tenantId } },
    });
    if (!warehouse) {
      throw new AppError('Warehouse not found', 404);
    }

    return prisma.warehouse.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ============================================
  // Stock Items
  // ============================================

  async getStock(tenantId: string, warehouseId: string) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, venue: { tenantId } },
    });
    if (!warehouse) {
      throw new AppError('Warehouse not found', 404);
    }

    return prisma.stockItem.findMany({
      where: { warehouseId },
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { product: { name: 'asc' } },
    });
  }

  async upsertStock(tenantId: string, warehouseId: string, input: UpsertStockInput) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, venue: { tenantId } },
    });
    if (!warehouse) {
      throw new AppError('Warehouse not found', 404);
    }

    return prisma.$transaction(
      input.items.map((item) =>
        prisma.stockItem.upsert({
          where: {
            warehouseId_productId: {
              warehouseId,
              productId: item.productId,
            },
          },
          create: {
            warehouseId,
            productId: item.productId,
            quantity: item.quantity,
            minQuantity: item.minQuantity ?? 0,
          },
          update: {
            quantity: item.quantity,
            ...(item.minQuantity !== undefined && { minQuantity: item.minQuantity }),
          },
        })
      )
    );
  }

  // ============================================
  // Stock Movements
  // ============================================

  async getMovements(
    tenantId: string,
    warehouseId: string,
    filters: { productId?: string; type?: string; from?: string; to?: string; page: number; limit: number }
  ) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, venue: { tenantId } },
    });
    if (!warehouse) {
      throw new AppError('Warehouse not found', 404);
    }

    const where: Record<string, unknown> = { warehouseId };
    if (filters.productId) where.productId = filters.productId;
    if (filters.type) where.type = filters.type;
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from && { gte: new Date(filters.from) }),
        ...(filters.to && { lte: new Date(filters.to) }),
      };
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          toWarehouse: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async adjustStock(tenantId: string, warehouseId: string, userId: string, input: AdjustStockInput) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, venue: { tenantId } },
      select: { id: true, venueId: true },
    });
    if (!warehouse) {
      throw new AppError('Warehouse not found', 404);
    }

    return prisma.$transaction(async (tx) => {
      const stockItem = await tx.stockItem.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId,
            productId: input.productId,
          },
        },
      });

      if (!stockItem) {
        throw new AppError('Stock item not found for this product in warehouse', 404);
      }

      const previousQty = Number(stockItem.quantity);
      const delta = input.type === 'ADJUSTMENT_IN' ? input.quantity : -input.quantity;
      const newQty = previousQty + delta;

      if (newQty < 0) {
        throw new AppError('Insufficient stock for this adjustment', 400);
      }

      await tx.stockItem.update({
        where: { id: stockItem.id },
        data: { quantity: newQty },
      });

      const movement = await tx.stockMovement.create({
        data: {
          warehouseId,
          productId: input.productId,
          type: input.type,
          quantity: input.quantity,
          previousQty,
          newQty,
          notes: input.notes,
          createdById: userId,
        },
      });

      return { movement, venueId: warehouse.venueId };
    });
  }

  async transferStock(tenantId: string, warehouseId: string, userId: string, input: TransferStockInput) {
    // Validate both warehouses exist and belong to the same venue/tenant
    const [fromWarehouse, toWarehouse] = await Promise.all([
      prisma.warehouse.findFirst({
        where: { id: warehouseId, venue: { tenantId } },
        select: { id: true, venueId: true },
      }),
      prisma.warehouse.findFirst({
        where: { id: input.toWarehouseId, venue: { tenantId } },
        select: { id: true, venueId: true },
      }),
    ]);

    if (!fromWarehouse) {
      throw new AppError('Source warehouse not found', 404);
    }
    if (!toWarehouse) {
      throw new AppError('Destination warehouse not found', 404);
    }
    if (fromWarehouse.venueId !== toWarehouse.venueId) {
      throw new AppError('Warehouses must belong to the same venue', 400);
    }
    if (fromWarehouse.id === toWarehouse.id) {
      throw new AppError('Cannot transfer to the same warehouse', 400);
    }

    return prisma.$transaction(async (tx) => {
      const movements = [];

      for (const item of input.items) {
        // Deduct from source
        const sourceStock = await tx.stockItem.findUnique({
          where: {
            warehouseId_productId: {
              warehouseId,
              productId: item.productId,
            },
          },
        });

        if (!sourceStock) {
          throw new AppError(`Product ${item.productId} not found in source warehouse`, 404);
        }

        const sourcePrevQty = Number(sourceStock.quantity);
        const sourceNewQty = sourcePrevQty - item.quantity;

        if (sourceNewQty < 0) {
          throw new AppError(`Insufficient stock for product ${item.productId}`, 400);
        }

        await tx.stockItem.update({
          where: { id: sourceStock.id },
          data: { quantity: sourceNewQty },
        });

        // Upsert destination stock
        const destStock = await tx.stockItem.upsert({
          where: {
            warehouseId_productId: {
              warehouseId: input.toWarehouseId,
              productId: item.productId,
            },
          },
          create: {
            warehouseId: input.toWarehouseId,
            productId: item.productId,
            quantity: item.quantity,
          },
          update: {
            quantity: { increment: item.quantity },
          },
        });

        const destPrevQty = Number(destStock.quantity) - item.quantity;

        // Create TRANSFER_OUT movement
        const outMovement = await tx.stockMovement.create({
          data: {
            warehouseId,
            toWarehouseId: input.toWarehouseId,
            productId: item.productId,
            type: 'TRANSFER_OUT',
            quantity: item.quantity,
            previousQty: sourcePrevQty,
            newQty: sourceNewQty,
            createdById: userId,
          },
        });

        // Create TRANSFER_IN movement
        const inMovement = await tx.stockMovement.create({
          data: {
            warehouseId: input.toWarehouseId,
            toWarehouseId: warehouseId,
            productId: item.productId,
            type: 'TRANSFER_IN',
            quantity: item.quantity,
            previousQty: destPrevQty,
            newQty: Number(destStock.quantity),
            createdById: userId,
          },
        });

        movements.push(outMovement, inMovement);
      }

      return { movements, venueId: fromWarehouse.venueId };
    });
  }

  async purchaseStock(tenantId: string, warehouseId: string, userId: string, input: PurchaseStockInput) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, venue: { tenantId } },
      select: { id: true, venueId: true },
    });
    if (!warehouse) {
      throw new AppError('Warehouse not found', 404);
    }

    return prisma.$transaction(async (tx) => {
      const movements = [];

      for (const item of input.items) {
        const stockItem = await tx.stockItem.upsert({
          where: {
            warehouseId_productId: {
              warehouseId,
              productId: item.productId,
            },
          },
          create: {
            warehouseId,
            productId: item.productId,
            quantity: item.quantity,
          },
          update: {
            quantity: { increment: item.quantity },
          },
        });

        const previousQty = Number(stockItem.quantity) - item.quantity;

        const movement = await tx.stockMovement.create({
          data: {
            warehouseId,
            productId: item.productId,
            type: 'PURCHASE',
            quantity: item.quantity,
            previousQty,
            newQty: Number(stockItem.quantity),
            reference: input.reference,
            notes: input.notes,
            createdById: userId,
          },
        });

        movements.push(movement);
      }

      return { movements, venueId: warehouse.venueId };
    });
  }
}

export const warehousesService = new WarehousesService();
