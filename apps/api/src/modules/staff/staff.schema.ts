import { z } from 'zod';

export const createStaffSchema = z.object({
  venueId: z.string().uuid(),
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'BARTENDER', 'DOORMAN', 'RRPP']),
  pin: z.string().length(4).regex(/^\d+$/).optional(),
  hourlyRate: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
});

export const updateStaffSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'BARTENDER', 'DOORMAN', 'RRPP']).optional(),
  hourlyRate: z.number().positive().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updatePinSchema = z.object({
  pin: z.string().length(4).regex(/^\d+$/, 'PIN must be 4 digits'),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type UpdatePinInput = z.infer<typeof updatePinSchema>;
