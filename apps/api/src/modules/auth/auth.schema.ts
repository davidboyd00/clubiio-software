import { z } from 'zod';

export const registerSchema = z.object({
  // Tenant info
  tenantName: z.string().min(2).max(100),
  
  // User info
  email: z.string().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  phone: z.string().optional(),
  
  // Optional first venue
  venueName: z.string().min(2).max(100).optional(),
  venueAddress: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const pinLoginSchema = z.object({
  pin: z.string().length(4),
  venueId: z.string().uuid(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PinLoginInput = z.infer<typeof pinLoginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
