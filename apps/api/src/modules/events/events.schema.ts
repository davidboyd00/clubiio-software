import { z } from 'zod';

export const eventStatusEnum = z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']);
export const consumptionTypeEnum = z.enum([
  'NONE',
  'FIXED_ITEMS',
  'CHOICE_UP_TO_VALUE',
  'MONEY_TICKET_SINGLE_USE',
  'MONEY_CARD_ACCOUNT',
]);

export const createEventSchema = z.object({
  venueId: z.string().min(1),
  name: z.string().min(2).max(200),
  date: z.string().datetime(),
  doorsOpen: z.string().datetime().optional(),
  doorsClose: z.string().datetime().optional(),
  capacity: z.number().int().positive().optional(),
  settings: z.record(z.unknown()).optional(),
});

export const updateEventSchema = createEventSchema.omit({ venueId: true }).partial();

export const updateEventStatusSchema = z.object({
  status: eventStatusEnum,
});

export const ticketTypeItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const createTicketTypeSchema = z.object({
  name: z.string().min(2).max(100),
  price: z.number().min(0),
  quantity: z.number().int().positive(),
  consumptionType: consumptionTypeEnum.default('NONE'),
  consumptionValue: z.number().min(0).optional(),
  sortOrder: z.number().int().min(0).default(0),
  items: z.array(ticketTypeItemSchema).optional(),
});

export const updateTicketTypeSchema = createTicketTypeSchema.partial();

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type UpdateEventStatusInput = z.infer<typeof updateEventStatusSchema>;
export type CreateTicketTypeInput = z.infer<typeof createTicketTypeSchema>;
export type UpdateTicketTypeInput = z.infer<typeof updateTicketTypeSchema>;
