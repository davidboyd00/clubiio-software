import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import { io } from '../../index';
import {
  OpenCashSessionInput,
  CloseCashSessionInput,
  CreateCashMovementInput,
} from './cash-sessions.schema';

export class CashSessionsService {
  /**
   * Get all sessions for a cash register
   */
  async findAllByCashRegister(
    tenantId: string,
    cashRegisterId: string,
    includeAll = false
  ) {
    // Verify cash register belongs to tenant
    const cashRegister = await prisma.cashRegister.findFirst({
      where: { id: cashRegisterId },
      include: { venue: { select: { tenantId: true } } },
    });

    if (!cashRegister || cashRegister.venue.tenantId !== tenantId) {
      throw new AppError('Cash register not found', 404);
    }

    const where: any = { cashRegisterId };
    if (!includeAll) {
      where.status = 'OPEN';
    }

    return prisma.cashSession.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { orders: true, cashMovements: true },
        },
      },
      orderBy: { openedAt: 'desc' },
      take: includeAll ? 50 : undefined,
    });
  }

  /**
   * Get a session by ID
   */
  async findById(tenantId: string, id: string) {
    const session = await prisma.cashSession.findFirst({
      where: { id },
      include: {
        cashRegister: {
          include: {
            venue: { select: { id: true, name: true, tenantId: true } },
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        orders: {
          where: { status: { not: 'VOIDED' } },
          include: {
            payments: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        cashMovements: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!session) {
      throw new AppError('Cash session not found', 404);
    }

    if (session.cashRegister.venue.tenantId !== tenantId) {
      throw new AppError('Cash session not found', 404);
    }

    return session;
  }

  /**
   * Get current open session for a user
   */
  async findOpenByUser(tenantId: string, userId: string) {
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
            venue: { select: { id: true, name: true } },
            warehouse: { select: { id: true, name: true } },
          },
        },
      },
    });

    return session;
  }

  /**
   * Get session summary with totals (OPTIMIZED - single transaction)
   */
  async getSessionSummary(tenantId: string, id: string) {
    // Execute all queries in parallel within a single transaction
    const [session, orderTotals, paymentsByMethod, movements, orders] = await prisma.$transaction([
      // 1. Get session with minimal relations
      prisma.cashSession.findFirst({
        where: { id },
        include: {
          cashRegister: {
            include: {
              venue: { select: { id: true, name: true, tenantId: true } },
            },
          },
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          cashMovements: {
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      // 2. Order totals
      prisma.order.aggregate({
        where: { cashSessionId: id, status: 'COMPLETED' },
        _sum: { total: true },
        _count: true,
      }),
      // 3. Payments by method
      prisma.payment.groupBy({
        by: ['method'],
        where: {
          order: { cashSessionId: id, status: 'COMPLETED' },
        },
        _sum: { amount: true },
        _count: true,
      }),
      // 4. Cash movements aggregated
      prisma.cashMovement.groupBy({
        by: ['type'],
        where: { cashSessionId: id },
        _sum: { amount: true },
      }),
      // 5. Orders for hourly breakdown and top products (dashboard needs)
      prisma.order.findMany({
        where: { cashSessionId: id, status: 'COMPLETED' },
        select: {
          id: true,
          total: true,
          status: true,
          createdAt: true,
          items: {
            select: {
              productId: true,
              quantity: true,
              unitPrice: true,
              subtotal: true,
              product: {
                select: { id: true, name: true, shortName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!session) {
      throw new AppError('Cash session not found', 404);
    }

    if (session.cashRegister.venue.tenantId !== tenantId) {
      throw new AppError('Cash session not found', 404);
    }

    // Calculate expected cash
    const cashSales =
      paymentsByMethod.find((p) => p.method === 'CASH')?._sum.amount || 0;
    const deposits =
      movements.find((m) => m.type === 'DEPOSIT')?._sum.amount || 0;
    const withdrawals =
      movements.find((m) => m.type === 'WITHDRAWAL')?._sum.amount || 0;
    const adjustments =
      movements.find((m) => m.type === 'ADJUSTMENT')?._sum.amount || 0;

    const expectedCash =
      Number(session.initialAmount) +
      Number(cashSales) +
      Number(deposits) -
      Number(withdrawals) +
      Number(adjustments);

    // Attach orders to session for dashboard compatibility
    const sessionWithOrders = {
      ...session,
      orders,
    };

    return {
      session: sessionWithOrders,
      summary: {
        totalOrders: orderTotals._count,
        totalSales: orderTotals._sum.total || 0,
        paymentsByMethod: paymentsByMethod.map((p) => ({
          method: p.method,
          amount: p._sum.amount || 0,
          count: p._count,
        })),
        movements: movements.map((m) => ({
          type: m.type,
          amount: m._sum.amount || 0,
        })),
        initialAmount: session.initialAmount,
        expectedCash,
        finalAmount: session.finalAmount,
        difference: session.difference,
      },
    };
  }

  /**
   * Open a new cash session
   */
  async open(tenantId: string, userId: string, input: OpenCashSessionInput) {
    // Verify cash register
    const cashRegister = await prisma.cashRegister.findFirst({
      where: { id: input.cashRegisterId, isActive: true },
      include: { venue: { select: { id: true, tenantId: true } } },
    });

    if (!cashRegister || cashRegister.venue.tenantId !== tenantId) {
      throw new AppError('Cash register not found', 404);
    }

    // Check if user already has an open session
    const existingUserSession = await prisma.cashSession.findFirst({
      where: {
        userId,
        status: 'OPEN',
      },
    });

    if (existingUserSession) {
      throw new AppError('You already have an open session', 400);
    }

    // Check if cash register already has an open session
    const existingRegisterSession = await prisma.cashSession.findFirst({
      where: {
        cashRegisterId: input.cashRegisterId,
        status: 'OPEN',
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (existingRegisterSession) {
      throw new AppError(
        `Cash register is already in use by ${existingRegisterSession.user.firstName} ${existingRegisterSession.user.lastName}`,
        400
      );
    }

    const session = await prisma.cashSession.create({
      data: {
        cashRegisterId: input.cashRegisterId,
        userId,
        initialAmount: input.initialAmount,
        status: 'OPEN',
      },
      include: {
        cashRegister: {
          include: {
            venue: { select: { id: true, name: true } },
            warehouse: { select: { id: true, name: true } },
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Emit socket event
    io.to(`venue:${cashRegister.venue.id}`).emit('cash-session:opened', {
      sessionId: session.id,
      cashRegisterId: session.cashRegisterId,
      user: session.user,
    });

    return session;
  }

  /**
   * Close a cash session
   */
  async close(
    tenantId: string,
    userId: string,
    sessionId: string,
    input: CloseCashSessionInput
  ) {
    const session = await this.findById(tenantId, sessionId);

    if (session.status !== 'OPEN') {
      throw new AppError('Session is already closed', 400);
    }

    // Only the session owner or managers can close
    if (session.userId !== userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user || !['OWNER', 'ADMIN', 'MANAGER'].includes(user.role)) {
        throw new AppError('Only the session owner or a manager can close this session', 403);
      }
    }

    // Calculate expected amount
    const summary = await this.getSessionSummary(tenantId, sessionId);
    const expectedAmount = summary.summary.expectedCash;
    const difference = input.finalAmount - expectedAmount;

    const closedSession = await prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        finalAmount: input.finalAmount,
        expectedAmount,
        difference,
        closedAt: new Date(),
        notes: input.notes,
      },
      include: {
        cashRegister: {
          include: { venue: { select: { id: true, name: true } } },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Emit socket event
    io.to(`venue:${closedSession.cashRegister.venue.id}`).emit(
      'cash-session:closed',
      {
        sessionId: closedSession.id,
        cashRegisterId: closedSession.cashRegisterId,
        user: closedSession.user,
        summary: {
          expectedAmount,
          finalAmount: input.finalAmount,
          difference,
        },
      }
    );

    return closedSession;
  }

  /**
   * Add a cash movement to a session (optimized)
   */
  async addMovement(
    tenantId: string,
    sessionId: string,
    input: CreateCashMovementInput
  ) {
    // Lightweight query - only get what we need
    const session = await prisma.cashSession.findFirst({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        initialAmount: true,
        cashRegister: {
          select: {
            venue: { select: { id: true, tenantId: true } },
          },
        },
      },
    });

    if (!session || session.cashRegister.venue.tenantId !== tenantId) {
      throw new AppError('Cash session not found', 404);
    }

    if (session.status !== 'OPEN') {
      throw new AppError('Cannot add movements to a closed session', 400);
    }

    // For withdrawals, verify sufficient cash with optimized query
    if (input.type === 'WITHDRAWAL') {
      const expectedCash = await this.calculateExpectedCashFast(sessionId, session.initialAmount);
      if (input.amount > expectedCash) {
        throw new AppError('Insufficient cash for withdrawal', 400);
      }
    }

    const movement = await prisma.cashMovement.create({
      data: {
        cashSessionId: sessionId,
        type: input.type,
        amount: input.amount,
        reason: input.reason,
      },
    });

    // Emit socket event
    io.to(`venue:${session.cashRegister.venue.id}`).emit(
      'cash-movement:created',
      {
        sessionId,
        movement,
      }
    );

    return movement;
  }

  /**
   * Fast calculation of expected cash (optimized for movement validation)
   */
  private async calculateExpectedCashFast(sessionId: string, initialAmount: any): Promise<number> {
    // Single aggregated query for cash sales
    const cashPayments = await prisma.payment.aggregate({
      where: {
        method: 'CASH',
        order: { cashSessionId: sessionId, status: 'COMPLETED' },
      },
      _sum: { amount: true },
    });

    // Single aggregated query for movements
    const movements = await prisma.cashMovement.groupBy({
      by: ['type'],
      where: { cashSessionId: sessionId },
      _sum: { amount: true },
    });

    const cashSales = Number(cashPayments._sum.amount || 0);
    const deposits = Number(movements.find((m) => m.type === 'DEPOSIT')?._sum.amount || 0);
    const withdrawals = Number(movements.find((m) => m.type === 'WITHDRAWAL')?._sum.amount || 0);
    const adjustments = Number(movements.find((m) => m.type === 'ADJUSTMENT')?._sum.amount || 0);

    return Number(initialAmount) + cashSales + deposits - withdrawals + adjustments;
  }

  /**
   * Get movements for a session
   */
  async getMovements(tenantId: string, sessionId: string) {
    await this.findById(tenantId, sessionId);

    return prisma.cashMovement.findMany({
      where: { cashSessionId: sessionId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const cashSessionsService = new CashSessionsService();
