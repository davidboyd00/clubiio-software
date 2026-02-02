import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

// ============================================
// PURE UTILITY FUNCTIONS FOR AUTH
// Extracted for testability
// ============================================

export interface TokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: string;
}

/**
 * Generate a URL-safe slug from a name
 * - Removes accents
 * - Converts to lowercase
 * - Replaces non-alphanumeric with dashes
 * - Adds unique suffix
 */
export function generateSlug(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  // Add random suffix to ensure uniqueness
  const suffix = uuid().substring(0, 6);
  return `${baseSlug}-${suffix}`;
}

/**
 * Generate a base slug without the unique suffix
 * Useful for testing slug generation logic
 */
export function generateBaseSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Generate JWT tokens
 */
export function generateTokens(
  payload: TokenPayload,
  secret: string,
  expiresIn: string
): AuthTokens {
  const accessToken = jwt.sign(payload, secret, {
    expiresIn,
  } as jwt.SignOptions);

  return {
    accessToken,
    expiresIn,
  };
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string, secret: string): TokenPayload | null {
  try {
    return jwt.verify(token, secret) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Hash a password
 */
export async function hashPassword(password: string, rounds = 12): Promise<string> {
  return bcrypt.hash(password, rounds);
}

/**
 * Compare password with hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 * Returns an array of validation errors, empty if valid
 */
export function validatePasswordStrength(password: string): string[] {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return errors;
}

/**
 * Generate a random PIN (4-6 digits)
 */
export function generatePin(length = 4): string {
  const digits = '0123456789';
  let pin = '';
  for (let i = 0; i < length; i++) {
    pin += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return pin;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
