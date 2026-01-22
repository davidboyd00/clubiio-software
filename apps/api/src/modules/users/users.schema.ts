import { z } from 'zod';

export const userRoleEnum = z.enum([
  'OWNER',
  'ADMIN',
  'MANAGER',
  'CASHIER',
  'BARTENDER',
  'DOORMAN',
  'RRPP',
]);

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  phone: z.string().optional(),
  role: userRoleEnum.default('CASHIER'),
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, 'PIN must be 4 digits')
    .optional(),
  venueIds: z.array(z.string().uuid()).optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  phone: z.string().optional(),
  role: userRoleEnum.optional(),
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, 'PIN must be 4 digits')
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
  venueIds: z.array(z.string().uuid()).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
