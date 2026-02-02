import { describe, it, expect } from 'vitest';
import {
  generateBaseSlug,
  generateSlug,
  generateTokens,
  verifyToken,
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  generatePin,
  isValidEmail,
} from './auth.utils';

describe('Auth Utils', () => {
  // ─────────────────────────────────────────
  // SLUG GENERATION
  // ─────────────────────────────────────────
  describe('generateBaseSlug', () => {
    it('should convert to lowercase', () => {
      expect(generateBaseSlug('MyClub')).toBe('myclub');
    });

    it('should remove accents', () => {
      expect(generateBaseSlug('Café Niño')).toBe('cafe-nino');
    });

    it('should replace spaces with dashes', () => {
      expect(generateBaseSlug('My Cool Club')).toBe('my-cool-club');
    });

    it('should replace special characters with dashes', () => {
      expect(generateBaseSlug('Club & Bar')).toBe('club-bar');
    });

    it('should remove leading and trailing dashes', () => {
      expect(generateBaseSlug('  Club  ')).toBe('club');
      expect(generateBaseSlug('---Club---')).toBe('club');
    });

    it('should handle multiple consecutive special chars', () => {
      expect(generateBaseSlug('Club!!!Bar')).toBe('club-bar');
    });

    it('should handle numbers', () => {
      expect(generateBaseSlug('Club 2024')).toBe('club-2024');
    });

    it('should handle Spanish characters', () => {
      expect(generateBaseSlug('Año Nuevo Fiesta')).toBe('ano-nuevo-fiesta');
    });
  });

  describe('generateSlug', () => {
    it('should append a unique suffix', () => {
      const slug = generateSlug('My Club');
      expect(slug).toMatch(/^my-club-[a-f0-9]{6}$/);
    });

    it('should generate different slugs for same input', () => {
      const slug1 = generateSlug('Test Club');
      const slug2 = generateSlug('Test Club');
      expect(slug1).not.toBe(slug2);
    });
  });

  // ─────────────────────────────────────────
  // JWT TOKENS
  // ─────────────────────────────────────────
  describe('generateTokens', () => {
    const payload = {
      userId: 'user-123',
      tenantId: 'tenant-456',
      email: 'test@example.com',
      role: 'ADMIN',
    };
    const secret = 'test-secret';
    const expiresIn = '1h';

    it('should generate a valid JWT token', () => {
      const tokens = generateTokens(payload, secret, expiresIn);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.expiresIn).toBe(expiresIn);
      expect(typeof tokens.accessToken).toBe('string');
    });

    it('should include payload data in token', () => {
      const tokens = generateTokens(payload, secret, expiresIn);
      const decoded = verifyToken(tokens.accessToken, secret);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(payload.userId);
      expect(decoded?.tenantId).toBe(payload.tenantId);
      expect(decoded?.email).toBe(payload.email);
      expect(decoded?.role).toBe(payload.role);
    });
  });

  describe('verifyToken', () => {
    const payload = {
      userId: 'user-123',
      tenantId: 'tenant-456',
      email: 'test@example.com',
      role: 'ADMIN',
    };
    const secret = 'test-secret';

    it('should verify a valid token', () => {
      const tokens = generateTokens(payload, secret, '1h');
      const decoded = verifyToken(tokens.accessToken, secret);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(payload.userId);
    });

    it('should return null for invalid token', () => {
      const decoded = verifyToken('invalid-token', secret);
      expect(decoded).toBeNull();
    });

    it('should return null for wrong secret', () => {
      const tokens = generateTokens(payload, secret, '1h');
      const decoded = verifyToken(tokens.accessToken, 'wrong-secret');
      expect(decoded).toBeNull();
    });
  });

  // ─────────────────────────────────────────
  // PASSWORD HASHING
  // ─────────────────────────────────────────
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'MySecurePassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'MySecurePassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for correct password', async () => {
      const password = 'MySecurePassword123';
      const hash = await hashPassword(password);

      const result = await comparePassword(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'MySecurePassword123';
      const hash = await hashPassword(password);

      const result = await comparePassword('WrongPassword', hash);
      expect(result).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // PASSWORD VALIDATION
  // ─────────────────────────────────────────
  describe('validatePasswordStrength', () => {
    it('should accept a strong password', () => {
      const errors = validatePasswordStrength('MyPassword123');
      expect(errors).toHaveLength(0);
    });

    it('should reject short passwords', () => {
      const errors = validatePasswordStrength('Short1');
      expect(errors).toContain('Password must be at least 8 characters');
    });

    it('should require uppercase letters', () => {
      const errors = validatePasswordStrength('lowercase123');
      expect(errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require lowercase letters', () => {
      const errors = validatePasswordStrength('UPPERCASE123');
      expect(errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require numbers', () => {
      const errors = validatePasswordStrength('NoNumbersHere');
      expect(errors).toContain('Password must contain at least one number');
    });

    it('should return multiple errors for weak passwords', () => {
      const errors = validatePasswordStrength('weak');
      expect(errors.length).toBeGreaterThan(1);
    });
  });

  // ─────────────────────────────────────────
  // PIN GENERATION
  // ─────────────────────────────────────────
  describe('generatePin', () => {
    it('should generate a 4-digit PIN by default', () => {
      const pin = generatePin();
      expect(pin).toMatch(/^\d{4}$/);
    });

    it('should generate a PIN of specified length', () => {
      const pin6 = generatePin(6);
      expect(pin6).toMatch(/^\d{6}$/);

      const pin5 = generatePin(5);
      expect(pin5).toMatch(/^\d{5}$/);
    });

    it('should generate different PINs', () => {
      const pins = new Set();
      for (let i = 0; i < 10; i++) {
        pins.add(generatePin());
      }
      // Should have multiple unique PINs (statistically unlikely to be all same)
      expect(pins.size).toBeGreaterThan(1);
    });
  });

  // ─────────────────────────────────────────
  // EMAIL VALIDATION
  // ─────────────────────────────────────────
  describe('isValidEmail', () => {
    it('should accept valid emails', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('user.name@example.com')).toBe(true);
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
    });
  });
});
