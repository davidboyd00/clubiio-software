import { z } from 'zod';

export const generateTicketsSchema = z.object({
  ticketTypeId: z.string().min(1),
  quantity: z.number().int().positive().max(500),
  customerName: z.string().max(100).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().max(20).optional(),
});

export const validateTicketSchema = z.object({
  code: z.string().min(1),
});

export const consumeTicketSchema = z.object({
  ticketId: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().positive(),
});

export type GenerateTicketsInput = z.infer<typeof generateTicketsSchema>;
export type ValidateTicketInput = z.infer<typeof validateTicketSchema>;
export type ConsumeTicketInput = z.infer<typeof consumeTicketSchema>;
