import { z } from 'zod';

export const cashRegisterTypeEnum = z.enum(['BAR', 'TICKET_BOOTH', 'GENERAL']);

export const createCashRegisterSchema = z.object({
  venueId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  name: z.string().min(2).max(50),
  type: cashRegisterTypeEnum.default('BAR'),
});

export const updateCashRegisterSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  type: cashRegisterTypeEnum.optional(),
  warehouseId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateCashRegisterInput = z.infer<typeof createCashRegisterSchema>;
export type UpdateCashRegisterInput = z.infer<typeof updateCashRegisterSchema>;
