import { z } from 'zod';

export const orderStatusEnum = z.enum(['PENDING', 'COMPLETED', 'VOIDED']);
export const paymentMethodEnum = z.enum([
  'CASH',
  'CARD',
  'TRANSFER',
  'VIP_CARD',
  'MERCADOPAGO',
  'TICKET_CREDIT',
]);

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  notes: z.string().max(100).optional(),
});

export const paymentSchema = z.object({
  method: paymentMethodEnum,
  amount: z.number().positive(),
  reference: z.string().max(100).optional(),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  payments: z.array(paymentSchema).min(1),
  discount: z.number().min(0).default(0),
  notes: z.string().max(500).optional(),
});

export const voidOrderSchema = z.object({
  reason: z.string().min(3).max(200),
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VoidOrderInput = z.infer<typeof voidOrderSchema>;
