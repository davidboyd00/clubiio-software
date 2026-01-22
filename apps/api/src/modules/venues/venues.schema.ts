import { z } from 'zod';

export const createVenueSchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().default('America/Santiago'),
  capacity: z.number().int().positive().optional(),
});

export const updateVenueSchema = createVenueSchema.partial();

export type CreateVenueInput = z.infer<typeof createVenueSchema>;
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>;
