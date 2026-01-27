import { z } from 'zod';

export const createShiftSchema = z.object({
  staffId: z.string().uuid(),
  venueId: z.string().uuid(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

export const updateShiftSchema = z.object({
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  notes: z.string().max(500).optional().nullable(),
});

export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
