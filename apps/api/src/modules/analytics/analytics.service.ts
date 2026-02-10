import prisma from '../../common/database';
import { Prisma } from '@prisma/client';
import { stateManager } from '../queue-engine/state/state.manager';
import { metricsCalculator } from '../queue-engine/metrics/metrics.calculator';
import { analyticsEvents, AnalyticsActionPayload } from './analytics.events';

interface OverviewSummary {
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  activeStaff: number;
  salesChangePct: number | null;
  ordersChangePct: number | null;
  avgTicketChangePct: number | null;
}

interface HourlySalesPoint {
  hour: string;
  sales: number;
}

interface TopProduct {
  id: string;
  name: string;
  qty: number;
  revenue: number;
}

interface PaymentMethodBreakdown {
  method: string;
  amount: number;
  count: number;
}

export interface OverviewPayload {
  summary: OverviewSummary;
  hourlySales: HourlySalesPoint[];
  topProducts: TopProduct[];
  paymentMethods: PaymentMethodBreakdown[];
}

export type RiskSeverity = 'ok' | 'warning' | 'critical';

export interface RiskItem {
  type: 'queue' | 'stock' | 'cash';
  severity: RiskSeverity;
  score: number;
  title: string;
  summary: string;
  recommendations: string[];
  metrics?: Record<string, number | string | null>;
  items?: Array<Record<string, number | string | null>>;
}

export interface RisksPayload {
  windowMinutes: number;
  risks: RiskItem[];
  actions: string[];
  suggestedActions: SuggestedAction[];
}

export interface SuggestedAction {
  id: string;
  type: 'QUEUE_REDUCE_TIMEOUTS' | 'QUEUE_ENABLE_BATCHING' | 'QUEUE_ENABLE_AUTOPILOT' | 'QUEUE_REBALANCE_BAR' | 'STOCK_RESTOCK_REQUEST' | 'STOCK_PRESTOCK_PLAN' | 'CASH_AUDIT_REQUEST';
  label: string;
  description?: string;
  auto: boolean;
  payload?: Record<string, unknown>;
}

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value);
};

const percentChange = (current: number, previous: number): number | null => {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const calculatePercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timeZone: string) => {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      })
    );
  }
  return formatterCache.get(timeZone)!;
};

const getTimeZoneParts = (date: Date, timeZone: string) => {
  const parts = getFormatter(timeZone).formatToParts(date);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value);
    }
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
};

const getTimeZoneOffset = (date: Date, timeZone: string) => {
  const parts = getTimeZoneParts(date, timeZone);
  const utcDate = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return utcDate - date.getTime();
};

const getUtcFromZoned = (
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number
) => {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const offset = getTimeZoneOffset(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset);
};

const getDateRangeForTimeZone = (reference: Date, timeZone: string, offsetDays = 0) => {
  const parts = getTimeZoneParts(reference, timeZone);
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + offsetDays);

  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1;
  const day = base.getUTCDate();

  const start = getUtcFromZoned(timeZone, year, month, day, 0, 0, 0, 0);
  const end = getUtcFromZoned(timeZone, year, month, day, 23, 59, 59, 999);

  return { start, end };
};

const getHourInTimeZone = (date: Date, timeZone: string) => {
  const parts = getTimeZoneParts(date, timeZone);
  return Math.max(0, Math.min(23, parts.hour));
};

export class AnalyticsService {
  private toActionPayload(action: {
    id: string;
    venueId: string;
    type: string;
    label: string;
    status: 'PENDING' | 'APPLIED' | 'FAILED';
    priority: number;
    assignedRole?: string | null;
    metadata?: Record<string, unknown> | null;
    requestedById?: string | null;
    appliedAt?: Date | null;
    createdAt: Date;
    error?: string | null;
  }): AnalyticsActionPayload {
    return {
      id: action.id,
      venueId: action.venueId,
      type: action.type,
      label: action.label,
      status: action.status,
      priority: action.priority,
      assignedRole: action.assignedRole,
      metadata: (action.metadata || {}) as Record<string, unknown>,
      requestedById: action.requestedById,
      appliedAt: action.appliedAt,
      createdAt: action.createdAt,
      error: action.error,
    };
  }

  private getActionDefaults(action: SuggestedAction): { priority: number; assignedRole?: string | null } {
    switch (action.type) {
      case 'STOCK_RESTOCK_REQUEST':
        return { priority: 85, assignedRole: 'BARTENDER' };
      case 'CASH_AUDIT_REQUEST':
        return { priority: 75, assignedRole: 'CASHIER' };
      case 'STOCK_PRESTOCK_PLAN':
        return { priority: 80, assignedRole: 'BARTENDER' };
      case 'QUEUE_REBALANCE_BAR':
        return { priority: 70, assignedRole: 'MANAGER' };
      case 'QUEUE_REDUCE_TIMEOUTS':
      case 'QUEUE_ENABLE_BATCHING':
      case 'QUEUE_ENABLE_AUTOPILOT':
      default:
        return { priority: 60, assignedRole: 'MANAGER' };
    }
  }

  private async buildOverview(
    tenantId: string,
    venueId: string,
    timeZone: string,
    rangeStart: Date,
    rangeEnd: Date
  ): Promise<OverviewPayload> {
    const previousStart = new Date(rangeStart.getTime() - 24 * 60 * 60 * 1000);
    const previousEnd = new Date(rangeEnd.getTime() - 24 * 60 * 60 * 1000);

    const orderWhereToday = {
      cashSession: {
        cashRegister: {
          venueId,
          venue: {
            tenantId,
          },
        },
      },
      status: 'COMPLETED' as const,
      createdAt: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    };

    const orderWhereYesterday = {
      cashSession: {
        cashRegister: {
          venueId,
          venue: {
            tenantId,
          },
        },
      },
      status: 'COMPLETED' as const,
      createdAt: {
        gte: previousStart,
        lt: previousEnd,
      },
    };

    const [todayTotals, yesterdayTotals, ordersForHourly, topProductsAgg, paymentsByMethod, activeShiftCount] = await Promise.all([
      prisma.order.aggregate({
        where: orderWhereToday,
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: orderWhereYesterday,
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.findMany({
        where: orderWhereToday,
        select: {
          createdAt: true,
          total: true,
        },
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: orderWhereToday,
        },
        _sum: {
          quantity: true,
          subtotal: true,
        },
        orderBy: {
          _sum: {
            subtotal: 'desc',
          },
        },
        take: 5,
      }),
      prisma.payment.groupBy({
        by: ['method'],
        where: {
          order: orderWhereToday,
        },
        _sum: { amount: true },
        _count: true,
        orderBy: {
          _sum: {
            amount: 'desc',
          },
        },
      }),
      prisma.shift.count({
        where: {
          venueId,
          status: 'ACTIVE',
        },
      }),
    ]);

    const todaySales = toNumber(todayTotals._sum.total);
    const yesterdaySales = toNumber(yesterdayTotals._sum.total);
    const todayOrders = todayTotals._count || 0;
    const yesterdayOrders = yesterdayTotals._count || 0;

    const avgTicket = todayOrders > 0 ? todaySales / todayOrders : 0;
    const avgTicketYesterday = yesterdayOrders > 0 ? yesterdaySales / yesterdayOrders : 0;

    const hourlySales: HourlySalesPoint[] = Array.from({ length: 24 }, (_, hour) => ({
      hour: formatHour(hour),
      sales: 0,
    }));

    ordersForHourly.forEach((order) => {
      const hour = getHourInTimeZone(order.createdAt, timeZone);
      hourlySales[hour].sales += toNumber(order.total);
    });

    const productIds = topProductsAgg.map((item) => item.productId);
    const products = productIds.length
      ? await prisma.product.findMany({
          where: {
            id: {
              in: productIds,
            },
          },
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        })
      : [];

    const productMap = new Map(products.map((product) => [product.id, product]));

    const topProducts: TopProduct[] = topProductsAgg.map((item) => {
      const product = productMap.get(item.productId);
      return {
        id: item.productId,
        name: product?.shortName || product?.name || 'Producto',
        qty: toNumber(item._sum.quantity),
        revenue: toNumber(item._sum.subtotal),
      };
    });

    const paymentMethods: PaymentMethodBreakdown[] = paymentsByMethod.map((payment) => ({
      method: payment.method,
      amount: toNumber(payment._sum.amount),
      count: payment._count,
    }));

    const activeStaff = activeShiftCount > 0
      ? activeShiftCount
      : await prisma.userVenue.count({
          where: {
            venueId,
            user: {
              tenantId,
              isActive: true,
            },
          },
        });

    return {
      summary: {
        totalSales: todaySales,
        totalOrders: todayOrders,
        avgTicket,
        activeStaff,
        salesChangePct: percentChange(todaySales, yesterdaySales),
        ordersChangePct: percentChange(todayOrders, yesterdayOrders),
        avgTicketChangePct: percentChange(avgTicket, avgTicketYesterday),
      },
      hourlySales,
      topProducts,
      paymentMethods,
    };
  }

  async getOverview(tenantId: string, venueId: string, date?: string): Promise<OverviewPayload> {
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, tenantId },
      select: { timezone: true },
    });
    const timeZone = venue?.timezone || 'UTC';
    const reference = date ? new Date(date) : new Date();
    const { start, end } = getDateRangeForTimeZone(reference, timeZone, 0);

    return this.buildOverview(tenantId, venueId, timeZone, start, end);
  }

  async createDailySnapshotForVenue(tenantId: string, venueId: string, date: Date) {
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, tenantId },
      select: { timezone: true },
    });
    const timeZone = venue?.timezone || 'UTC';
    const { start, end } = getDateRangeForTimeZone(date, timeZone, -1);

    const overview = await this.buildOverview(tenantId, venueId, timeZone, start, end);

    await prisma.analyticsDailySnapshot.upsert({
      where: {
        venueId_date: {
          venueId,
          date: start,
        },
      },
      create: {
        venueId,
        date: start,
        totalSales: overview.summary.totalSales,
        totalOrders: overview.summary.totalOrders,
        avgTicket: overview.summary.avgTicket,
        activeStaff: overview.summary.activeStaff,
        hourlySales: overview.hourlySales as unknown as Prisma.InputJsonValue,
        topProducts: overview.topProducts as unknown as Prisma.InputJsonValue,
        paymentMethods: overview.paymentMethods as unknown as Prisma.InputJsonValue,
      },
      update: {
        totalSales: overview.summary.totalSales,
        totalOrders: overview.summary.totalOrders,
        avgTicket: overview.summary.avgTicket,
        activeStaff: overview.summary.activeStaff,
        hourlySales: overview.hourlySales as unknown as Prisma.InputJsonValue,
        topProducts: overview.topProducts as unknown as Prisma.InputJsonValue,
        paymentMethods: overview.paymentMethods as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async createDailySnapshots(date: Date) {
    const venues = await prisma.venue.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        tenantId: true,
      },
    });

    for (const venue of venues) {
      await this.createDailySnapshotForVenue(venue.tenantId, venue.id, date);
    }
  }

  async getDailySnapshots(
    _tenantId: string,
    venueId: string,
    from?: string,
    to?: string,
    limit = 30
  ) {
    const where: Record<string, unknown> = { venueId };
    if (from || to) {
      where.date = {};
      if (from) {
        (where.date as Record<string, Date>).gte = new Date(from);
      }
      if (to) {
        (where.date as Record<string, Date>).lte = new Date(to);
      }
    }

    const snapshots = await prisma.analyticsDailySnapshot.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
    });

    return {
      venueId,
      snapshots: snapshots.map((snapshot) => ({
        id: snapshot.id,
        date: snapshot.date,
        totalSales: toNumber(snapshot.totalSales),
        totalOrders: snapshot.totalOrders,
        avgTicket: toNumber(snapshot.avgTicket),
        activeStaff: snapshot.activeStaff,
        hourlySales: snapshot.hourlySales,
        topProducts: snapshot.topProducts,
        paymentMethods: snapshot.paymentMethods,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      })),
    };
  }

  async getActions(
    tenantId: string,
    venueId: string,
    status?: 'PENDING' | 'APPLIED' | 'FAILED',
    limit = 20,
    barId?: string
  ) {
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, tenantId },
      select: { id: true },
    });

    if (!venue) {
      throw new Error('Venue not found');
    }

    const where: Record<string, unknown> = { venueId };
    if (status) {
      where.status = status;
    }
    if (barId) {
      where.metadata = {
        path: ['bar_id'],
        equals: barId,
      };
    }

    const actions = await prisma.analyticsAction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      venueId,
      actions: actions.map((action) => ({
        id: action.id,
        venueId: action.venueId,
        type: action.type,
        label: action.label,
        status: action.status,
        priority: action.priority,
        assignedRole: action.assignedRole,
        metadata: action.metadata,
        requestedById: action.requestedById,
        appliedAt: action.appliedAt,
        createdAt: action.createdAt,
        updatedAt: action.updatedAt,
        error: action.error,
      })),
    };
  }

  async resolveAction(
    tenantId: string,
    actionId: string,
    status: 'APPLIED' | 'FAILED',
    resolvedById?: string,
    note?: string
  ) {
    const action = await prisma.analyticsAction.findUnique({
      where: { id: actionId },
      include: {
        venue: { select: { tenantId: true } },
      },
    });

    if (!action || action.venue.tenantId !== tenantId) {
      throw new Error('Action not found');
    }

    const existingMetadata = (action.metadata || {}) as Record<string, unknown>;
    const metadata = {
      ...existingMetadata,
      resolvedById,
      note,
    };

    const updated = await prisma.analyticsAction.update({
      where: { id: actionId },
      data: {
        status,
        appliedAt: status === 'APPLIED' ? new Date() : null,
        error: status === 'FAILED' ? note || 'Marked as failed' : null,
        metadata,
      },
    });

    analyticsEvents.emit('action:resolved', this.toActionPayload({
      id: updated.id,
      venueId: updated.venueId,
      type: updated.type,
      label: updated.label,
      status: updated.status,
      priority: updated.priority,
      assignedRole: updated.assignedRole,
      metadata: updated.metadata as Record<string, unknown>,
      requestedById: updated.requestedById,
      appliedAt: updated.appliedAt,
      createdAt: updated.createdAt,
      error: updated.error,
    }));

    return {
      id: updated.id,
      status: updated.status,
      appliedAt: updated.appliedAt,
    };
  }

  private async upsertQueueConfig(venueId: string, updates: Record<string, unknown>) {
    const existing = await prisma.queueEngineConfig.findFirst({
      where: {
        venueId,
        eventId: null,
      },
      orderBy: { version: 'desc' },
    });

    if (existing) {
      return prisma.queueEngineConfig.update({
        where: { id: existing.id },
        data: {
          ...updates,
          version: { increment: 1 },
        },
      });
    }

    return prisma.queueEngineConfig.create({
      data: {
        venueId,
        eventId: null,
        isActive: true,
        ...updates,
        version: 1,
      },
    });
  }

  private updateQueueState(venueId: string, updates: { features?: Record<string, boolean>; batching?: Record<string, number> }) {
    const current = stateManager.getConfig(venueId, 'default');
    const nextConfig = {
      ...current,
      features: { ...current.features, ...(updates.features || {}) },
      batching: { ...current.batching, ...(updates.batching || {}) },
    };
    stateManager.updateConfig(venueId, 'default', nextConfig);
  }

  private async createPrestockTasks(
    tenantId: string,
    venueId: string,
    barId: string,
    horizonMinutes?: number,
    requestedById?: string
  ) {
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, tenantId },
      select: { tenantId: true },
    });

    if (!venue) {
      throw new Error('Venue not found');
    }

    const bar = await prisma.cashRegister.findFirst({
      where: {
        id: barId,
        venueId,
        isActive: true,
      },
      select: { id: true, name: true },
    });

    if (!bar) {
      throw new Error('Barra no encontrada');
    }

    const stockableMappings = await prisma.queueSkuMapping.findMany({
      where: {
        tenantId: venue.tenantId,
        classification: 'STOCKABLE',
        isActive: true,
      },
    });

    if (stockableMappings.length === 0) {
      return { created: 0 };
    }

    const productIds = stockableMappings.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, shortName: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const lambda = metricsCalculator.calculateLambda(venueId, barId);
    const config = stateManager.getConfig(venueId, barId);
    const horizon = horizonMinutes ?? config.stocking.horizon_minutes ?? 15;
    const safety = config.stocking.safety_factor ?? 1.3;
    const ratePerMin = lambda.rate_per_min / stockableMappings.length;

    const tasks = stockableMappings
      .map((mapping) => {
        const currentStock = stateManager.getPreStock(venueId, barId, mapping.productId);
        const targetStock = Math.ceil(ratePerMin * horizon * safety);
        const cappedTarget = Math.min(targetStock, mapping.maxPreStock);
        const deficit = Math.max(0, cappedTarget - currentStock);

        if (deficit <= 0) return null;

        const product = productMap.get(mapping.productId);
        const name = product?.shortName || product?.name || 'Producto';

        const priority = Math.min(100, 50 + deficit * 3);

        return {
          venueId,
          type: 'TASK_PRESTOCK',
          label: `Pre-stock: ${name}`,
          status: 'PENDING' as const,
          priority,
          assignedRole: 'BARTENDER' as const,
          metadata: {
            productId: mapping.productId,
            productName: name,
            qty: deficit,
            bar_id: barId,
            bar_name: bar.name,
            horizon_minutes: horizon,
            reason: 'forecast_deficit',
          },
          requestedById: requestedById || null,
        };
      })
      .filter(Boolean) as Array<{
      venueId: string;
      type: string;
      label: string;
      status: 'PENDING';
      priority: number;
      assignedRole: 'BARTENDER';
      metadata: Record<string, unknown>;
      requestedById?: string | null;
    }>;

    if (tasks.length === 0) {
      return { created: 0 };
    }

    let createdCount = 0;
    for (const task of tasks) {
      const created = await prisma.analyticsAction.create({
        data: {
          ...task,
          metadata: task.metadata as unknown as Prisma.InputJsonValue,
        },
      });
      createdCount += 1;
      analyticsEvents.emit('action:created', this.toActionPayload({
        id: created.id,
        venueId: created.venueId,
        type: created.type,
        label: created.label,
        status: created.status,
        priority: created.priority,
        assignedRole: created.assignedRole,
        metadata: created.metadata as Record<string, unknown>,
        requestedById: created.requestedById,
        appliedAt: created.appliedAt,
        createdAt: created.createdAt,
        error: created.error,
      }));
    }
    return { created: createdCount };
  }

  async applyAction(
    tenantId: string,
    venueId: string,
    action: SuggestedAction,
    requestedById?: string
  ) {
    const venue = await prisma.venue.findFirst({
      where: { id: venueId, tenantId },
      select: { id: true },
    });

    if (!venue) {
      throw new Error('Venue not found');
    }

    const defaults = this.getActionDefaults(action);
    const metadata = { ...(action.payload || {}) } as Record<string, unknown>;
    const requiresBar = action.type === 'STOCK_PRESTOCK_PLAN' || action.type === 'STOCK_RESTOCK_REQUEST';
    let barId = typeof metadata.bar_id === 'string' ? (metadata.bar_id as string) : undefined;

    if (!barId && requiresBar) {
      const fallbackBar = await prisma.cashRegister.findFirst({
        where: {
          venueId,
          isActive: true,
          type: 'BAR',
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true },
      });

      if (!fallbackBar) {
        throw new Error('No hay barras activas disponibles para esta acción.');
      }

      barId = fallbackBar.id;
      metadata.bar_id = fallbackBar.id;
      if (!metadata.bar_name && fallbackBar.name) {
        metadata.bar_name = fallbackBar.name;
      }
    }

    if (barId && !metadata.bar_name) {
      const cashRegister = await prisma.cashRegister.findFirst({
        where: { id: barId, venueId },
        select: { name: true },
      });
      if (cashRegister?.name) {
        metadata.bar_name = cashRegister.name;
      }
    }

    const actionRecord = await prisma.analyticsAction.create({
      data: {
        venueId,
        type: action.type,
        label: action.label,
        status: 'PENDING',
        metadata: metadata as unknown as Prisma.InputJsonValue,
        priority: defaults.priority,
        assignedRole: (defaults.assignedRole ?? null) as 'BARTENDER' | 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER' | 'DOORMAN' | 'RRPP' | null,
        requestedById,
      },
    });

    const finalize = async (status: 'PENDING' | 'APPLIED' | 'FAILED', error?: string) => {
      return prisma.analyticsAction.update({
        where: { id: actionRecord.id },
        data: {
          status,
          appliedAt: status === 'APPLIED' ? new Date() : null,
          error,
        },
      });
    };

    try {
      switch (action.type) {
        case 'QUEUE_REDUCE_TIMEOUTS': {
          const config = await prisma.queueEngineConfig.findFirst({
            where: { venueId, eventId: null, isActive: true },
            orderBy: { version: 'desc' },
          });

          const tauMin = config?.batchTauMinSec ?? 30;
          const tau0 = config?.batchTau0Sec ?? 90;
          const tauMax = config?.batchTauMaxSec ?? 180;
          const newTau0 = Math.max(tauMin, Math.round(tau0 * 0.8));
          const newTauMax = Math.max(tauMin, Math.round(tauMax * 0.8));

          await this.upsertQueueConfig(venueId, {
            batchTau0Sec: newTau0,
            batchTauMaxSec: newTauMax,
          });

          this.updateQueueState(venueId, {
            batching: {
              tau0_sec: newTau0,
              tau_max_sec: newTauMax,
            },
          });

          await finalize('APPLIED');
          return { actionId: actionRecord.id, status: 'APPLIED' as const };
        }
        case 'QUEUE_ENABLE_BATCHING': {
          await this.upsertQueueConfig(venueId, {
            batchingEnabled: true,
          });
          this.updateQueueState(venueId, {
            features: { batching_enabled: true },
          });
          await finalize('APPLIED');
          return { actionId: actionRecord.id, status: 'APPLIED' as const };
        }
        case 'QUEUE_ENABLE_AUTOPILOT': {
          await this.upsertQueueConfig(venueId, {
            autopilotEnabled: true,
          });
          this.updateQueueState(venueId, {
            features: { autopilot_enabled: true },
          });
          await finalize('APPLIED');
          return { actionId: actionRecord.id, status: 'APPLIED' as const };
        }
        case 'QUEUE_REBALANCE_BAR': {
          const config = await prisma.queueEngineConfig.findFirst({
            where: { venueId, eventId: null, isActive: true },
            orderBy: { version: 'desc' },
          });

          const batchB0 = config?.batchB0 ?? 6;
          const batchBMin = config?.batchBMin ?? 2;
          const batchBMax = config?.batchBMax ?? 12;
          const tauMin = config?.batchTauMinSec ?? 30;
          const tau0 = config?.batchTau0Sec ?? 90;
          const tauMax = config?.batchTauMaxSec ?? 180;

          const newB0 = Math.max(batchBMin, Math.round(batchB0 * 0.85));
          const newBMax = Math.max(newB0, Math.round(batchBMax * 0.85));
          const newTau0 = Math.max(tauMin, Math.round(tau0 * 0.85));
          const newTauMax = Math.max(tauMin, Math.round(tauMax * 0.85));

          await this.upsertQueueConfig(venueId, {
            batchingEnabled: true,
            batchB0: newB0,
            batchBMax: newBMax,
            batchTau0Sec: newTau0,
            batchTauMaxSec: newTauMax,
          });

          this.updateQueueState(venueId, {
            features: { batching_enabled: true },
            batching: {
              B0: newB0,
              B_max: newBMax,
              tau0_sec: newTau0,
              tau_max_sec: newTauMax,
            },
          });

          await finalize('APPLIED');
          return { actionId: actionRecord.id, status: 'APPLIED' as const };
        }
        case 'STOCK_PRESTOCK_PLAN': {
          const barId = typeof metadata.bar_id === 'string' ? (metadata.bar_id as string) : undefined;
          if (!barId) {
            throw new Error('Barra requerida para el plan de pre-stock.');
          }
          const horizonMinutes = typeof action.payload?.horizon_minutes === 'number'
            ? (action.payload?.horizon_minutes as number)
            : undefined;

          const result = await this.createPrestockTasks(
            tenantId,
            venueId,
            barId,
            horizonMinutes,
            requestedById
          );

          await finalize('APPLIED');
          return { actionId: actionRecord.id, status: 'APPLIED' as const, tasksCreated: result.created };
        }
        case 'STOCK_RESTOCK_REQUEST':
        case 'CASH_AUDIT_REQUEST': {
          await finalize('PENDING');
          analyticsEvents.emit('action:created', this.toActionPayload({
            id: actionRecord.id,
            venueId: actionRecord.venueId,
            type: actionRecord.type,
            label: actionRecord.label,
            status: 'PENDING',
            priority: actionRecord.priority,
            assignedRole: actionRecord.assignedRole,
            metadata: (actionRecord.metadata || {}) as Record<string, unknown>,
            requestedById: actionRecord.requestedById,
            appliedAt: actionRecord.appliedAt,
            createdAt: actionRecord.createdAt,
            error: actionRecord.error,
          }));
          return { actionId: actionRecord.id, status: 'PENDING' as const };
        }
        default: {
          await finalize('FAILED', 'Unsupported action');
          return { actionId: actionRecord.id, status: 'FAILED' as const };
        }
      }
    } catch (error) {
      await finalize('FAILED', error instanceof Error ? error.message : 'Unknown error');
      return { actionId: actionRecord.id, status: 'FAILED' as const };
    }
  }

  async getRisks(tenantId: string, venueId: string, windowMinutes: number, barId?: string): Promise<RisksPayload> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
    const cashWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const barContext = barId
      ? await prisma.cashRegister.findFirst({
        where: {
          id: barId,
          venueId,
          isActive: true,
        },
        select: { id: true, name: true, warehouseId: true },
      })
      : null;

    if (barId && !barContext) {
      throw new Error('Barra no encontrada');
    }

    const queueOrderWhere: Record<string, unknown> = {
      venueId,
      stage: {
        in: ['QUEUED_PREP', 'IN_PREP', 'READY'],
      },
    };

    if (barId) {
      queueOrderWhere.barId = barId;
    }

    const deliveredOrderWhere: Record<string, unknown> = {
      venueId,
      stage: 'DELIVERED',
      deliveredAt: {
        gte: windowStart,
      },
      totalWaitSec: {
        not: null,
      },
    };

    if (barId) {
      deliveredOrderWhere.barId = barId;
    }

    const stockWhere: Record<string, unknown> = barContext?.warehouseId
      ? { warehouseId: barContext.warehouseId }
      : { warehouse: { venueId } };

    const orderItemWhere: Record<string, unknown> = {
      order: {
        cashSession: barId
          ? { cashRegisterId: barId }
          : {
            cashRegister: {
              venueId,
              venue: {
                tenantId,
              },
            },
          },
        status: 'COMPLETED',
        createdAt: {
          gte: windowStart,
        },
      },
    };

    const cashSessionWhere: Record<string, unknown> = {
      status: 'CLOSED',
      closedAt: {
        gte: cashWindowStart,
      },
      ...(barId ? { cashRegisterId: barId } : { cashRegister: { venueId } }),
    };

    const voidedOrdersWhere: Record<string, unknown> = {
      createdAt: {
        gte: cashWindowStart,
      },
      status: 'VOIDED',
      cashSession: barId
        ? { cashRegisterId: barId }
        : {
          cashRegister: {
            venueId,
            venue: {
              tenantId,
            },
          },
        },
    };

    const totalOrdersWhere: Record<string, unknown> = {
      createdAt: {
        gte: cashWindowStart,
      },
      cashSession: barId
        ? { cashRegisterId: barId }
        : {
          cashRegister: {
            venueId,
            venue: {
              tenantId,
            },
          },
        },
    };

    const [queueConfig, queueOrders, deliveredOrders, stockItems, orderItems, cashSessions, voidedOrders, totalOrders] = await Promise.all([
      prisma.queueEngineConfig.findFirst({
        where: {
          venueId,
          isActive: true,
        },
        orderBy: {
          version: 'desc',
        },
      }),
      prisma.queueOrderState.findMany({
        where: queueOrderWhere,
        select: {
          createdAt: true,
        },
      }),
      prisma.queueOrderState.findMany({
        where: deliveredOrderWhere,
        select: {
          totalWaitSec: true,
        },
      }),
      prisma.stockItem.findMany({
        where: stockWhere,
        select: {
          quantity: true,
          minQuantity: true,
          product: {
            select: {
              id: true,
              name: true,
              shortName: true,
              minStock: true,
            },
          },
        },
      }),
      prisma.orderItem.findMany({
        where: orderItemWhere,
        select: {
          productId: true,
          quantity: true,
        },
      }),
      prisma.cashSession.findMany({
        where: cashSessionWhere,
        select: {
          difference: true,
          expectedAmount: true,
          finalAmount: true,
        },
      }),
      prisma.order.count({
        where: voidedOrdersWhere,
      }),
      prisma.order.count({
        where: totalOrdersWhere,
      }),
    ]);

    // Queue risk
    const queueLength = queueOrders.length;
    const oldestAgeSec = queueLength > 0
      ? Math.floor((now.getTime() - Math.min(...queueOrders.map((q) => q.createdAt.getTime()))) / 1000)
      : 0;
    const waitTimes = deliveredOrders.map((order) => toNumber(order.totalWaitSec));
    const p95Wait = calculatePercentile(waitTimes, 95);

    const queueTargets = {
      p95WarningSec: queueConfig?.p95WarningSec ?? 240,
      p95CriticalSec: queueConfig?.p95CriticalSec ?? 420,
      maxQueueLength: queueConfig?.maxQueueLength ?? 50,
      maxOldestAgeSec: queueConfig?.maxOldestAgeSec ?? 300,
    };

    let queueSeverity: RiskSeverity = 'ok';
    if (p95Wait >= queueTargets.p95CriticalSec || queueLength >= queueTargets.maxQueueLength || oldestAgeSec >= queueTargets.maxOldestAgeSec) {
      queueSeverity = 'critical';
    } else if (p95Wait >= queueTargets.p95WarningSec || queueLength >= Math.round(queueTargets.maxQueueLength * 0.8)) {
      queueSeverity = 'warning';
    }

    const queueScore = clamp(
      Math.max(
        p95Wait / queueTargets.p95CriticalSec,
        queueLength / queueTargets.maxQueueLength,
        oldestAgeSec / queueTargets.maxOldestAgeSec
      )
    );

    const queueRecommendations = queueSeverity === 'critical'
      ? ['Abrir una barra adicional', 'Asignar un bartender extra', 'Activar batching agresivo']
      : queueSeverity === 'warning'
      ? ['Revisar distribución de barras', 'Preparar pre-stock rápido', 'Reducir tiempos de batch']
      : ['Mantener monitoreo'];

    const queueRisk: RiskItem = {
      type: 'queue',
      severity: queueSeverity,
      score: queueScore,
      title: 'Carga de barra',
      summary: queueLength === 0
        ? 'Sin cola activa en este momento.'
        : `Cola activa con ${queueLength} orden(es) y P95 de ${Math.round(p95Wait)}s.`,
      recommendations: queueRecommendations,
      metrics: {
        queueLength,
        oldestAgeSec,
        p95WaitSec: Math.round(p95Wait),
      },
    };

    // Stock risk
    const consumptionMap = new Map<string, number>();
    orderItems.forEach((item) => {
      const current = consumptionMap.get(item.productId) || 0;
      consumptionMap.set(item.productId, current + item.quantity);
    });

    const stockRiskItems = stockItems.map((item) => {
      const minQuantity = Math.max(
        toNumber(item.minQuantity),
        toNumber(item.product.minStock)
      );
      const quantity = toNumber(item.quantity);
      const consumed = consumptionMap.get(item.product.id) || 0;
      const velocityPerMin = consumed / Math.max(1, windowMinutes);
      const minutesToStockout = velocityPerMin > 0 ? quantity / velocityPerMin : Number.POSITIVE_INFINITY;

      let severity: RiskSeverity = 'ok';
      if (quantity <= minQuantity || minutesToStockout <= 60) {
        severity = 'critical';
      } else if (minutesToStockout <= 120) {
        severity = 'warning';
      }

      return {
        productId: item.product.id,
        name: item.product.shortName || item.product.name,
        quantity,
        minQuantity,
        minutesToStockout: Number.isFinite(minutesToStockout)
          ? Math.round(minutesToStockout)
          : null,
        severity,
      };
    });

    const stockRiskSorted = stockRiskItems
      .filter((item) => item.severity !== 'ok')
      .sort((a, b) => {
        if (a.severity === b.severity) {
          return (a.minutesToStockout ?? 9999) - (b.minutesToStockout ?? 9999);
        }
        return a.severity === 'critical' ? -1 : 1;
      })
      .slice(0, 5);

    const stockSeverity: RiskSeverity = stockRiskSorted.some((item) => item.severity === 'critical')
      ? 'critical'
      : stockRiskSorted.length > 0
      ? 'warning'
      : 'ok';

    const stockScore = clamp(stockRiskSorted.length / 5);

    const stockRisk: RiskItem = {
      type: 'stock',
      severity: stockSeverity,
      score: stockScore,
      title: 'Riesgo de quiebre de stock',
      summary: stockRiskSorted.length === 0
        ? 'Stock en niveles estables para la ventana analizada.'
        : `${stockRiskSorted.length} SKU(s) con riesgo de quiebre en las próximas 2 horas.`,
      recommendations: stockSeverity === 'critical'
        ? ['Reabastecer inmediato desde bodega', 'Transferir stock desde otra barra', 'Desactivar venta temporal']
        : stockSeverity === 'warning'
        ? ['Preparar reposición preventiva', 'Revisar consumos pico']
        : ['Mantener monitoreo'],
      items: stockRiskSorted.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        minQuantity: item.minQuantity,
        minutesToStockout: item.minutesToStockout,
        severity: item.severity,
      })),
    };

    // Cash risk
    const totalDifference = cashSessions.reduce((acc, session) => {
      const diff = toNumber(session.difference ?? 0);
      return acc + Math.abs(diff);
    }, 0);

    const expectedTotals = cashSessions.reduce((acc, session) => acc + toNumber(session.expectedAmount ?? 0), 0);
    const finalTotals = cashSessions.reduce((acc, session) => acc + toNumber(session.finalAmount ?? 0), 0);
    const cashBase = expectedTotals > 0 ? expectedTotals : finalTotals;
    const differenceRate = cashBase > 0 ? totalDifference / cashBase : 0;
    const voidRate = totalOrders > 0 ? voidedOrders / totalOrders : 0;

    let cashSeverity: RiskSeverity = 'ok';
    if (differenceRate >= 0.05 || voidRate >= 0.07) {
      cashSeverity = 'critical';
    } else if (differenceRate >= 0.02 || voidRate >= 0.03) {
      cashSeverity = 'warning';
    }

    const cashScore = clamp(Math.max(differenceRate / 0.05, voidRate / 0.07));

    const cashRisk: RiskItem = {
      type: 'cash',
      severity: cashSeverity,
      score: cashScore,
      title: 'Riesgo de caja',
      summary: cashSessions.length === 0
        ? 'No hay cierres de caja recientes para analizar.'
        : `Diferencias acumuladas ${(differenceRate * 100).toFixed(1)}% y tasa de anulaciones ${(voidRate * 100).toFixed(1)}%.`,
      recommendations: cashSeverity === 'critical'
        ? ['Auditar cierres de caja recientes', 'Revisar anulaciones y devoluciones', 'Aplicar doble control en caja']
        : cashSeverity === 'warning'
        ? ['Revisar desviaciones de caja', 'Validar cierres con supervisión']
        : ['Mantener monitoreo'],
      metrics: {
        differenceRatePct: Math.round(differenceRate * 1000) / 10,
        voidRatePct: Math.round(voidRate * 1000) / 10,
      },
    };

    const risks = [queueRisk, stockRisk, cashRisk];
    const actions = risks
      .filter((risk) => risk.severity !== 'ok')
      .flatMap((risk) => risk.recommendations)
      .slice(0, 5);

    const suggestedActions: SuggestedAction[] = [];
    const barPayload = barContext
      ? {
        bar_id: barContext.id,
        bar_name: barContext.name,
      }
      : undefined;

    if (queueSeverity !== 'ok') {
      suggestedActions.push(
        {
          id: 'queue_reduce_timeouts',
          type: 'QUEUE_REDUCE_TIMEOUTS',
          label: 'Reducir tiempos de batch',
          description: 'Acelera la liberación de batches durante alta demanda.',
          auto: true,
          payload: barPayload,
        }
      );

      if (queueSeverity === 'critical') {
        suggestedActions.push({
          id: 'queue_rebalance_bar',
          type: 'QUEUE_REBALANCE_BAR',
          label: 'Rebalanceo agresivo de barra',
          description: 'Reduce batches y acelera tiempos para aliviar la cola.',
          auto: true,
          payload: barPayload,
        });
      }

      if (queueConfig?.batchingEnabled === false) {
        suggestedActions.push({
          id: 'queue_enable_batching',
          type: 'QUEUE_ENABLE_BATCHING',
          label: 'Activar batching',
          description: 'Activa batching para aumentar throughput en barra.',
          auto: true,
          payload: barPayload,
        });
      }

      if (queueConfig?.autopilotEnabled === false) {
        suggestedActions.push({
          id: 'queue_enable_autopilot',
          type: 'QUEUE_ENABLE_AUTOPILOT',
          label: 'Activar autopilot',
          description: 'Permite ajustes automáticos del motor de cola.',
          auto: true,
          payload: barPayload,
        });
      }
    }

    if (stockSeverity !== 'ok') {
      suggestedActions.push({
        id: 'stock_prestock_plan',
        type: 'STOCK_PRESTOCK_PLAN',
        label: 'Generar plan de pre-stock',
        description: 'Crea tareas automáticas de pre-stock para barra.',
        auto: true,
        payload: {
          ...(barPayload ?? {}),
          horizon_minutes: queueConfig?.stockHorizonMin ?? 15,
        },
      });

      suggestedActions.push({
        id: 'stock_restock_request',
        type: 'STOCK_RESTOCK_REQUEST',
        label: 'Registrar reposición urgente',
        description: 'Genera una solicitud de reposición para el equipo.',
        auto: false,
        payload: {
          ...(barPayload ?? {}),
          items: stockRiskSorted.map((item) => ({
            productId: item.productId,
            productName: item.name,
            quantity: item.quantity,
            minQuantity: item.minQuantity,
            minutesToStockout: item.minutesToStockout,
            severity: item.severity,
          })),
        },
      });
    }

    if (cashSeverity !== 'ok') {
      suggestedActions.push({
        id: 'cash_audit_request',
        type: 'CASH_AUDIT_REQUEST',
        label: 'Iniciar revisión de caja',
        description: 'Registra una revisión de caja para auditoría.',
        auto: false,
        payload: barPayload,
      });
    }

    return {
      windowMinutes,
      risks,
      actions,
      suggestedActions,
    };
  }
}

export const analyticsService = new AnalyticsService();
