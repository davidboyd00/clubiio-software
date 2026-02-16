import { z } from 'zod';

export const accessTypeEnum = z.enum(['ENTRY', 'EXIT', 'RE_ENTRY']);
export const accessSourceEnum = z.enum([
  'CLUBIO_TICKET',
  'EXTERNAL_TICKET',
  'DOOR_SALE',
  'VIP_LIST',
  'COURTESY',
  'STAFF',
]);

export const createAccessLogSchema = z.object({
  venueId: z.string().min(1),
  eventId: z.string().optional(),
  type: accessTypeEnum,
  source: accessSourceEnum,
  externalTicketId: z.string().optional(),
  internalTicketId: z.string().optional(),
  personName: z.string().max(100).optional(),
  scannedCode: z.string().max(200).optional(),
});

export const accessLogsQuerySchema = z.object({
  venueId: z.string().min(1),
  eventId: z.string().optional(),
  type: accessTypeEnum.optional(),
  source: accessSourceEnum.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type CreateAccessLogInput = z.infer<typeof createAccessLogSchema>;
export type AccessLogsQuery = z.infer<typeof accessLogsQuerySchema>;
