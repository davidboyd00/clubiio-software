import { z } from 'zod';

export const cashSessionStatusEnum = z.enum(['OPEN', 'CLOSED']);
export const cashMovementTypeEnum = z.enum(['SALE', 'WITHDRAWAL', 'DEPOSIT', 'ADJUSTMENT']);

export const openCashSessionSchema = z.object({
  cashRegisterId: z.string().min(1),
  initialAmount: z.number().min(0),
});

export const closeCashSessionSchema = z.object({
  finalAmount: z.number().min(0),
  notes: z.string().max(500).optional(),
});

export const createCashMovementSchema = z.object({
  type: cashMovementTypeEnum,
  amount: z.number().positive(),
  reason: z.string().max(200).optional(),
});

export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;
export type CreateCashMovementInput = z.infer<typeof createCashMovementSchema>;
