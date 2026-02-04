import { z } from 'zod';

export const overviewQuerySchema = z.object({
  venueId: z.string().uuid(),
  date: z.string().datetime().optional(),
});

export const risksQuerySchema = z.object({
  venueId: z.string().uuid(),
  windowMinutes: z.coerce.number().int().min(15).max(240).default(60),
  barId: z.string().uuid().optional(),
});

export const snapshotsQuerySchema = z.object({
  venueId: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(365).default(30),
});

export const applyActionSchema = z.object({
  venueId: z.string().uuid(),
  actionId: z.string(),
  actionType: z.enum([
    'QUEUE_REDUCE_TIMEOUTS',
    'QUEUE_ENABLE_BATCHING',
    'QUEUE_ENABLE_AUTOPILOT',
    'QUEUE_REBALANCE_BAR',
    'STOCK_RESTOCK_REQUEST',
    'STOCK_PRESTOCK_PLAN',
    'CASH_AUDIT_REQUEST',
  ]),
  label: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

export const actionsQuerySchema = z.object({
  venueId: z.string().uuid(),
  status: z.enum(['PENDING', 'APPLIED', 'FAILED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  barId: z.string().uuid().optional(),
});

export const resolveActionSchema = z.object({
  actionId: z.string().uuid(),
  status: z.enum(['APPLIED', 'FAILED']),
  note: z.string().max(500).optional(),
});

export type OverviewQuery = z.infer<typeof overviewQuerySchema>;
export type RisksQuery = z.infer<typeof risksQuerySchema>;
export type SnapshotsQuery = z.infer<typeof snapshotsQuerySchema>;
export type ApplyActionInput = z.infer<typeof applyActionSchema>;
export type ActionsQuery = z.infer<typeof actionsQuerySchema>;
export type ResolveActionInput = z.infer<typeof resolveActionSchema>;
