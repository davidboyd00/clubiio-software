import { z } from 'zod';

export const vipCardTypeEnum = z.enum(['CUSTOMER', 'TABLE_VIP', 'STAFF', 'ADMIN', 'COURTESY']);

export const createVipCardSchema = z.object({
  cardNumber: z.string().min(1).max(50),
  type: vipCardTypeEnum.default('CUSTOMER'),
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(20).optional(),
  customerEmail: z.string().email().optional(),
  pin: z.string().min(4).max(6).optional(),
});

export const updateVipCardSchema = z.object({
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(20).optional(),
  customerEmail: z.string().email().optional(),
  pin: z.string().min(4).max(6).optional(),
});

export const loadBalanceSchema = z.object({
  amount: z.number().positive(),
  notes: z.string().max(200).optional(),
});

export const purchaseSchema = z.object({
  amount: z.number().positive(),
  orderId: z.string().min(1),
  notes: z.string().max(200).optional(),
});

export const transferSchema = z.object({
  toCardId: z.string().min(1),
  amount: z.number().positive(),
  notes: z.string().max(200).optional(),
});

export type CreateVipCardInput = z.infer<typeof createVipCardSchema>;
export type UpdateVipCardInput = z.infer<typeof updateVipCardSchema>;
export type LoadBalanceInput = z.infer<typeof loadBalanceSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
