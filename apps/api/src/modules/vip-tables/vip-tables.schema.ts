import { z } from 'zod';

export const reservationStatusEnum = z.enum([
  'PENDING',
  'CONFIRMED',
  'ARRIVED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);

// VIP Table schemas
export const createVipTableSchema = z.object({
  venueId: z.string().min(1),
  name: z.string().min(1).max(50),
  capacity: z.number().int().positive(),
  minConsumption: z.number().min(0),
  location: z.string().max(100).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateVipTableSchema = createVipTableSchema.omit({ venueId: true }).partial();

// Reservation schemas
export const guestSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  isHolder: z.boolean().default(false),
});

export const createReservationSchema = z.object({
  tableId: z.string().min(1),
  eventId: z.string().min(1),
  holderName: z.string().min(1).max(100),
  holderPhone: z.string().min(1).max(20),
  holderEmail: z.string().email().optional(),
  guestCount: z.number().int().positive(),
  lateGuestLimit: z.number().int().min(0).default(2),
  notes: z.string().max(500).optional(),
  vipCardId: z.string().optional(),
  guests: z.array(guestSchema).optional(),
});

export const updateReservationSchema = z.object({
  holderName: z.string().min(1).max(100).optional(),
  holderPhone: z.string().min(1).max(20).optional(),
  holderEmail: z.string().email().optional(),
  guestCount: z.number().int().positive().optional(),
  lateGuestLimit: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional(),
  vipCardId: z.string().optional(),
});

export const updateReservationStatusSchema = z.object({
  status: reservationStatusEnum,
});

// Guest schemas
export const addGuestSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  isLateGuest: z.boolean().default(false),
});

export const validateLateCodeSchema = z.object({
  code: z.string().min(1),
});

export type CreateVipTableInput = z.infer<typeof createVipTableSchema>;
export type UpdateVipTableInput = z.infer<typeof updateVipTableSchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type UpdateReservationStatusInput = z.infer<typeof updateReservationStatusSchema>;
export type AddGuestInput = z.infer<typeof addGuestSchema>;
export type ValidateLateCodeInput = z.infer<typeof validateLateCodeSchema>;
