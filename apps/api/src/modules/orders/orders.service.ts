import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import { paginatedResponse, PaginationParams } from '../../common/response';
import { io } from '../../index';
import {
  CreateOrderInput,
  VoidOrderInput,
} from './orders.schema';

interface FindOrdersOptions {
  cashSessionId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  pagination?: PaginationParams;
}

export class OrdersService {
  /**
   * Get all orders for a session with filtering
   */
  async findBySession(
    tenantId: string,
    cashSessionId: string,
    options: FindOrdersOptions = {}
  ) {
    // Verify session belongs to tenant
    const session = await prisma.cashSession.findFirst({
      where: { id: cashSessionId },
      include: {
        cashRegister: {
          include: { venue: { select: { tenantId: true } } },
        },
      },
    });

    if (!session || session.cashRegister.venue.tenantId !== tenantId) {
      throw new AppError('Session not found', 404);
    }

    const where: any = { cashSessionId };

    if (options.status) {
      where.status = options.status;
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    if (options.pagination) {
      const [items, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: {
            items: {
              include: {
                product: {
                  select: { id: true, name: true, shortName: true },
                },
              },
            },
            payments: true,
            createdBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: options.pagination.skip,
          take: options.pagination.limit,
        }),
        prisma.order.count({ where }),
      ]);

      return paginatedResponse(items, total, options.pagination);
    }

    return prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, shortName: true },
            },
          },
        },
        payments: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get an order by ID
   */
  async findById(tenantId: string, id: string) {
    const order = await prisma.order.findFirst({
      where: { id },
      include: {
        cashSession: {
          include: {
            cashRegister: {
              include: { venue: { select: { id: true, name: true, tenantId: true } } },
            },
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, shortName: true, barcode: true },
            },
          },
        },
        payments: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (order.cashSession.cashRegister.venue.tenantId !== tenantId) {
      throw new AppError('Order not found', 404);
    }

    return order;
  }

  /**
   * Create a new order
   */
  async create(tenantId: string, userId: string, input: CreateOrderInput) {
    // Get user's open session
    const session = await prisma.cashSession.findFirst({
      where: {
        userId,
        status: 'OPEN',
        cashRegister: {
          venue: { tenantId },
        },
      },
      include: {
        cashRegister: {
          include: {
            venue: { select: { id: true, tenantId: true } },
            warehouse: { select: { id: true } },
          },
        },
      },
    });

    if (!session) {
      throw new AppError('No open session found', 400);
    }

    // Validate products exist and belong to tenant
    const productIds = input.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId,
        isActive: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new AppError('One or more products not found', 404);
    }

    // Calculate totals
    const subtotal = input.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    const total = subtotal - input.discount;

    // Validate payment amounts
    const paymentTotal = input.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    if (Math.abs(paymentTotal - total) > 0.01) {
      throw new AppError(
        `Payment total (${paymentTotal}) does not match order total (${total})`,
        400
      );
    }

    // Get next order number for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const lastOrder = await prisma.order.findFirst({
      where: {
        cashSession: {
          cashRegister: {
            venue: { tenantId },
          },
        },
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: { orderNumber: 'desc' },
    });

    const orderNumber = (lastOrder?.orderNumber || 0) + 1;

    // Create order with items and payments in transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          cashSessionId: session.id,
          orderNumber,
          status: 'COMPLETED',
          subtotal,
          discount: input.discount,
          total,
          notes: input.notes,
          createdById: userId,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.unitPrice * item.quantity,
              notes: item.notes,
            })),
          },
          payments: {
            create: input.payments.map((payment) => ({
              method: payment.method,
              amount: payment.amount,
              reference: payment.reference,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, shortName: true },
              },
            },
          },
          payments: true,
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      // Create cash movement for cash payments
      const cashPayment = input.payments.find((p) => p.method === 'CASH');
      if (cashPayment) {
        await tx.cashMovement.create({
          data: {
            cashSessionId: session.id,
            type: 'SALE',
            amount: cashPayment.amount,
            reason: `Order #${orderNumber}`,
          },
        });
      }

      // Update stock if warehouse is linked
      if (session.cashRegister.warehouse) {
        for (const item of input.items) {
          const product = products.find((p) => p.id === item.productId);
          if (product?.trackStock) {
            const stockItem = await tx.stockItem.findUnique({
              where: {
                warehouseId_productId: {
                  warehouseId: session.cashRegister.warehouse.id,
                  productId: item.productId,
                },
              },
            });

            if (stockItem) {
              const newQty = Number(stockItem.quantity) - item.quantity;
              await tx.stockItem.update({
                where: { id: stockItem.id },
                data: { quantity: newQty },
              });

              await tx.stockMovement.create({
                data: {
                  warehouseId: session.cashRegister.warehouse.id,
                  productId: item.productId,
                  type: 'SALE',
                  quantity: item.quantity,
                  previousQty: stockItem.quantity,
                  newQty,
                  reference: newOrder.id,
                  createdById: userId,
                },
              });
            }
          }
        }
      }

      return newOrder;
    });

    // Emit socket event
    io.to(`venue:${session.cashRegister.venue.id}`).emit('order:created', {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        itemCount: order.items.length,
      },
      cashRegisterId: session.cashRegisterId,
    });

    return order;
  }

  /**
   * Void an order
   */
  async void(
    tenantId: string,
    userId: string,
    orderId: string,
    input: VoidOrderInput
  ) {
    const order = await this.findById(tenantId, orderId);

    if (order.status === 'VOIDED') {
      throw new AppError('Order is already voided', 400);
    }

    // Check if session is still open
    if (order.cashSession.status !== 'OPEN') {
      throw new AppError('Cannot void order from a closed session', 400);
    }

    // Only managers or order creator can void
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (
      order.createdById !== userId &&
      !['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role || '')
    ) {
      throw new AppError('Only the order creator or a manager can void this order', 403);
    }

    const voidedOrder = await prisma.$transaction(async (tx) => {
      // Update order status
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'VOIDED',
          voidedAt: new Date(),
          voidReason: input.reason,
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, trackStock: true } },
            },
          },
          payments: true,
          cashSession: {
            include: {
              cashRegister: {
                include: {
                  venue: { select: { id: true } },
                  warehouse: { select: { id: true } },
                },
              },
            },
          },
        },
      });

      // Reverse cash movement if there was a cash payment
      const cashPayment = updated.payments.find((p) => p.method === 'CASH');
      if (cashPayment) {
        await tx.cashMovement.create({
          data: {
            cashSessionId: updated.cashSessionId,
            type: 'ADJUSTMENT',
            amount: -Number(cashPayment.amount),
            reason: `Void Order #${updated.orderNumber}: ${input.reason}`,
          },
        });
      }

      // Restore stock
      if (updated.cashSession.cashRegister.warehouse) {
        for (const item of updated.items) {
          if (item.product.trackStock) {
            const stockItem = await tx.stockItem.findUnique({
              where: {
                warehouseId_productId: {
                  warehouseId: updated.cashSession.cashRegister.warehouse.id,
                  productId: item.productId,
                },
              },
            });

            if (stockItem) {
              const newQty = Number(stockItem.quantity) + item.quantity;
              await tx.stockItem.update({
                where: { id: stockItem.id },
                data: { quantity: newQty },
              });

              await tx.stockMovement.create({
                data: {
                  warehouseId: updated.cashSession.cashRegister.warehouse.id,
                  productId: item.productId,
                  type: 'ADJUSTMENT_IN',
                  quantity: item.quantity,
                  previousQty: stockItem.quantity,
                  newQty,
                  reference: `Void: ${updated.id}`,
                  notes: input.reason,
                  createdById: userId,
                },
              });
            }
          }
        }
      }

      return updated;
    });

    // Emit socket event
    io.to(`venue:${voidedOrder.cashSession.cashRegister.venue.id}`).emit(
      'order:voided',
      {
        orderId: voidedOrder.id,
        orderNumber: voidedOrder.orderNumber,
        reason: input.reason,
        cashRegisterId: voidedOrder.cashSession.cashRegisterId,
      }
    );

    return voidedOrder;
  }

  /**
   * Get daily sales summary
   */
  async getDailySummary(tenantId: string, venueId: string, date?: Date) {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Verify venue belongs to tenant
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, tenantId },
    });

    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    // Get order totals
    const orderStats = await prisma.order.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startOfDay, lte: endOfDay },
        cashSession: {
          cashRegister: { venueId },
        },
      },
      _sum: { total: true, discount: true },
      _count: true,
    });

    // Get voided totals
    const voidedStats = await prisma.order.aggregate({
      where: {
        status: 'VOIDED',
        voidedAt: { gte: startOfDay, lte: endOfDay },
        cashSession: {
          cashRegister: { venueId },
        },
      },
      _sum: { total: true },
      _count: true,
    });

    // Get payment breakdown
    const paymentBreakdown = await prisma.payment.groupBy({
      by: ['method'],
      where: {
        order: {
          status: 'COMPLETED',
          createdAt: { gte: startOfDay, lte: endOfDay },
          cashSession: {
            cashRegister: { venueId },
          },
        },
      },
      _sum: { amount: true },
      _count: true,
    });

    // Get top products
    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          status: 'COMPLETED',
          createdAt: { gte: startOfDay, lte: endOfDay },
          cashSession: {
            cashRegister: { venueId },
          },
        },
      },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: 10,
    });

    // Get product details
    const productIds = topProducts.map((p) => p.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, shortName: true },
    });

    const topProductsWithDetails = topProducts.map((p) => ({
      product: products.find((prod) => prod.id === p.productId),
      quantitySold: p._sum.quantity,
      totalRevenue: p._sum.subtotal,
    }));

    return {
      date: targetDate.toISOString().split('T')[0],
      orders: {
        total: orderStats._count,
        revenue: orderStats._sum.total || 0,
        discounts: orderStats._sum.discount || 0,
      },
      voided: {
        total: voidedStats._count,
        amount: voidedStats._sum.total || 0,
      },
      payments: paymentBreakdown.map((p) => ({
        method: p.method,
        amount: p._sum.amount || 0,
        count: p._count,
      })),
      topProducts: topProductsWithDetails,
    };
  }
  /**
   * Get aggregated sales summary for a date range
   */
  async getRangeSummary(
    tenantId: string,
    venueId: string,
    startDate: Date,
    endDate: Date
  ) {
    // Verify venue belongs to tenant
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, tenantId },
    });

    if (!venue) {
      throw new AppError('Venue not found', 404);
    }

    // Ensure endDate covers the full day
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all completed orders in range with their items and payments
    const orders = await prisma.order.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startDate, lte: endOfDay },
        cashSession: {
          cashRegister: { venueId },
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, shortName: true, categoryId: true, category: { select: { id: true, name: true } } },
            },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group orders by date
    const dayMap = new Map<string, {
      date: string;
      totalSales: number;
      totalOrders: number;
      cashSales: number;
      cardSales: number;
      transferSales: number;
      products: Map<string, { name: string; quantity: number; revenue: number }>;
      categories: Map<string, { name: string; sales: number }>;
    }>();

    let totalSales = 0;
    let totalOrders = 0;
    const paymentTotals: Record<string, number> = {};
    const productTotals = new Map<string, { name: string; quantity: number; revenue: number }>();
    const categoryTotals = new Map<string, { name: string; sales: number }>();

    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      totalSales += Number(order.total);
      totalOrders++;

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          date: dateKey,
          totalSales: 0,
          totalOrders: 0,
          cashSales: 0,
          cardSales: 0,
          transferSales: 0,
          products: new Map(),
          categories: new Map(),
        });
      }
      const day = dayMap.get(dateKey)!;
      day.totalSales += Number(order.total);
      day.totalOrders++;

      // Payments
      for (const payment of order.payments) {
        const amount = Number(payment.amount);
        const method = payment.method;
        paymentTotals[method] = (paymentTotals[method] || 0) + amount;

        if (method === 'CASH') day.cashSales += amount;
        else if (method === 'CARD') day.cardSales += amount;
        else if (method === 'TRANSFER') day.transferSales += amount;
      }

      // Items
      for (const item of order.items) {
        const qty = item.quantity;
        const revenue = Number(item.subtotal);
        const productName = item.product.name;
        const productId = item.product.id;

        // Day product aggregation
        const dayProd = day.products.get(productId) || { name: productName, quantity: 0, revenue: 0 };
        dayProd.quantity += qty;
        dayProd.revenue += revenue;
        day.products.set(productId, dayProd);

        // Total product aggregation
        const totalProd = productTotals.get(productId) || { name: productName, quantity: 0, revenue: 0 };
        totalProd.quantity += qty;
        totalProd.revenue += revenue;
        productTotals.set(productId, totalProd);

        // Category aggregation
        if (item.product.category) {
          const catId = item.product.category.id;
          const catName = item.product.category.name;

          const dayCat = day.categories.get(catId) || { name: catName, sales: 0 };
          dayCat.sales += revenue;
          day.categories.set(catId, dayCat);

          const totalCat = categoryTotals.get(catId) || { name: catName, sales: 0 };
          totalCat.sales += revenue;
          categoryTotals.set(catId, totalCat);
        }
      }
    }

    // Build days array
    const days = Array.from(dayMap.values()).map((day) => ({
      date: day.date,
      totalSales: day.totalSales,
      totalOrders: day.totalOrders,
      avgTicket: day.totalOrders > 0 ? day.totalSales / day.totalOrders : 0,
      cashSales: day.cashSales,
      cardSales: day.cardSales,
      transferSales: day.transferSales,
      topProducts: Array.from(day.products.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
      categorySales: Array.from(day.categories.values())
        .sort((a, b) => b.sales - a.sales),
    }));

    // Build summary
    const daysWithData = days.filter((d) => d.totalSales > 0);
    const sortedBySales = [...daysWithData].sort((a, b) => b.totalSales - a.totalSales);
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
    const avgDailySales = daysWithData.length > 0 ? totalSales / daysWithData.length : 0;

    // Previous period for growth calculation
    const periodMs = endOfDay.getTime() - startDate.getTime();
    const prevStart = new Date(startDate.getTime() - periodMs);
    const prevEnd = new Date(startDate.getTime() - 1);

    const prevAgg = await prisma.order.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: prevStart, lte: prevEnd },
        cashSession: {
          cashRegister: { venueId },
        },
      },
      _sum: { total: true },
    });
    const prevSales = Number(prevAgg._sum.total || 0);
    const growthPercent = prevSales > 0 ? ((totalSales - prevSales) / prevSales) * 100 : 0;

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      days,
      summary: {
        totalSales,
        totalOrders,
        avgTicket,
        avgDailySales,
        bestDay: sortedBySales[0]
          ? { date: sortedBySales[0].date, sales: sortedBySales[0].totalSales }
          : null,
        worstDay: sortedBySales.length > 0
          ? { date: sortedBySales[sortedBySales.length - 1].date, sales: sortedBySales[sortedBySales.length - 1].totalSales }
          : null,
        growthPercent,
        paymentMethods: paymentTotals,
        topCategories: Array.from(categoryTotals.values())
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5),
        topProducts: Array.from(productTotals.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10),
      },
    };
  }
}

export const ordersService = new OrdersService();
