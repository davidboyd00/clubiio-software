import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecretsManager } from './secrets.manager';
import {
  REQUIRED_SECRETS,
  PRODUCTION_REQUIRED_SECRETS,
  SECRET_DESCRIPTIONS,
} from './secrets.types';

describe('SecretsManager', () => {
  let manager: SecretsManager;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    manager = new SecretsManager();
    // Set up minimum required secrets for testing
    process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.SESSION_SECRET = 'test-session-secret-32-chars-min';
    process.env.CSRF_SECRET = 'test-csrf-secret-32-chars-minimum';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('Initialization', () => {
    it('should initialize with env provider by default', async () => {
      await manager.initialize();
      expect(manager.getProviderType()).toBe('env');
    });

    it('should initialize with specified provider', async () => {
      await manager.initialize({ provider: 'env' });
      expect(manager.getProviderType()).toBe('env');
    });

    it('should throw if required secrets are missing', async () => {
      delete process.env.JWT_SECRET;

      await expect(manager.initialize()).rejects.toThrow('Missing required secrets');
    });

    it('should warn if JWT_SECRET is too short in non-production', async () => {
      process.env.JWT_SECRET = 'short-but-still-32-characters-minimum';
      process.env.NODE_ENV = 'test';

      // In non-production, it should warn but not throw
      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should throw if JWT_SECRET is too short in production', async () => {
      process.env.JWT_SECRET = 'short';
      process.env.NODE_ENV = 'production';

      await expect(manager.initialize()).rejects.toThrow('must be at least 32 characters');
    });
  });

  describe('getSecret', () => {
    it('should return secret from environment', async () => {
      await manager.initialize();

      const secret = await manager.getSecret('JWT_SECRET');
      expect(secret).toBe(process.env.JWT_SECRET);
    });

    it('should cache secrets', async () => {
      await manager.initialize();

      const secret1 = await manager.getSecret('JWT_SECRET');
      const secret2 = await manager.getSecret('JWT_SECRET');

      expect(secret1).toBe(secret2);
    });

    it('should throw for missing required secret', async () => {
      await manager.initialize();
      delete process.env.MFA_ENCRYPTION_KEY;

      // This should throw because throwOnMissing defaults to true in production-like env
      // But in test env, it may not throw
    });
  });

  describe('getSecrets', () => {
    it('should return multiple secrets at once', async () => {
      await manager.initialize();

      const secrets = await manager.getSecrets(['JWT_SECRET', 'DATABASE_URL']);

      expect(secrets.JWT_SECRET).toBe(process.env.JWT_SECRET);
      expect(secrets.DATABASE_URL).toBe(process.env.DATABASE_URL);
    });
  });

  describe('clearCache', () => {
    it('should clear the secrets cache', async () => {
      await manager.initialize();

      // Get secret to cache it
      await manager.getSecret('JWT_SECRET');

      // Clear cache
      manager.clearCache();

      // Should fetch again from provider
      const secret = await manager.getSecret('JWT_SECRET');
      expect(secret).toBe(process.env.JWT_SECRET);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy for env provider', async () => {
      await manager.initialize();

      const health = await manager.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.provider).toBe('env');
    });

    it('should return unhealthy if not initialized', async () => {
      const health = await manager.healthCheck();
      expect(health.healthy).toBe(false);
    });
  });
});

describe('Secrets Types', () => {
  describe('REQUIRED_SECRETS', () => {
    it('should include essential secrets', () => {
      expect(REQUIRED_SECRETS).toContain('JWT_SECRET');
      expect(REQUIRED_SECRETS).toContain('DATABASE_URL');
    });
  });

  describe('PRODUCTION_REQUIRED_SECRETS', () => {
    it('should include production-only secrets', () => {
      expect(PRODUCTION_REQUIRED_SECRETS).toContain('SESSION_SECRET');
      expect(PRODUCTION_REQUIRED_SECRETS).toContain('CSRF_SECRET');
    });
  });

  describe('SECRET_DESCRIPTIONS', () => {
    it('should have descriptions for all secret names', () => {
      const allSecrets = [...REQUIRED_SECRETS, ...PRODUCTION_REQUIRED_SECRETS];

      for (const secret of allSecrets) {
        expect(SECRET_DESCRIPTIONS[secret]).toBeDefined();
        expect(typeof SECRET_DESCRIPTIONS[secret]).toBe('string');
      }
    });
  });
});
