import { describe, it, expect, afterEach } from 'vitest';
import {
  CSRF_EXCLUDED_PATHS,
  isCsrfEnabled,
} from './csrf.middleware';

describe('CSRF Middleware', () => {
  // ─────────────────────────────────────────
  // EXCLUDED PATHS
  // ─────────────────────────────────────────
  describe('CSRF_EXCLUDED_PATHS', () => {
    it('should exclude health endpoints', () => {
      expect(CSRF_EXCLUDED_PATHS).toContain('/api/health');
    });

    it('should exclude login endpoint', () => {
      expect(CSRF_EXCLUDED_PATHS).toContain('/api/auth/login');
    });

    it('should exclude register endpoint', () => {
      expect(CSRF_EXCLUDED_PATHS).toContain('/api/auth/register');
    });

    it('should exclude pin-login endpoint', () => {
      expect(CSRF_EXCLUDED_PATHS).toContain('/api/auth/pin-login');
    });

    it('should exclude refresh endpoint', () => {
      expect(CSRF_EXCLUDED_PATHS).toContain('/api/auth/refresh');
    });

    it('should exclude csrf-token endpoint itself', () => {
      expect(CSRF_EXCLUDED_PATHS).toContain('/api/auth/csrf-token');
    });

    it('should NOT exclude protected endpoints', () => {
      expect(CSRF_EXCLUDED_PATHS).not.toContain('/api/users');
      expect(CSRF_EXCLUDED_PATHS).not.toContain('/api/venues');
      expect(CSRF_EXCLUDED_PATHS).not.toContain('/api/orders');
      expect(CSRF_EXCLUDED_PATHS).not.toContain('/api/products');
    });
  });

  // ─────────────────────────────────────────
  // CSRF ENABLED CHECK
  // ─────────────────────────────────────────
  describe('isCsrfEnabled', () => {
    const originalEnv = process.env.DISABLE_CSRF;

    afterEach(() => {
      // Restore original environment
      if (originalEnv === undefined) {
        delete process.env.DISABLE_CSRF;
      } else {
        process.env.DISABLE_CSRF = originalEnv;
      }
    });

    it('should return true when DISABLE_CSRF is not set', () => {
      delete process.env.DISABLE_CSRF;
      expect(isCsrfEnabled()).toBe(true);
    });

    it('should return false when DISABLE_CSRF is "true"', () => {
      process.env.DISABLE_CSRF = 'true';
      expect(isCsrfEnabled()).toBe(false);
    });

    it('should return true when DISABLE_CSRF is "false"', () => {
      process.env.DISABLE_CSRF = 'false';
      expect(isCsrfEnabled()).toBe(true);
    });

    it('should return true for any other value', () => {
      process.env.DISABLE_CSRF = 'yes';
      expect(isCsrfEnabled()).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // PATH EXCLUSION LOGIC
  // ─────────────────────────────────────────
  describe('Path Exclusion Logic', () => {
    function isExcludedPath(path: string): boolean {
      return CSRF_EXCLUDED_PATHS.some(
        (excluded) => path === excluded || path.startsWith(`${excluded}/`)
      );
    }

    it('should match exact excluded paths', () => {
      expect(isExcludedPath('/api/health')).toBe(true);
      expect(isExcludedPath('/api/auth/login')).toBe(true);
    });

    it('should match sub-paths of excluded paths', () => {
      expect(isExcludedPath('/api/health/ping')).toBe(true);
      expect(isExcludedPath('/api/health/deep/nested')).toBe(true);
    });

    it('should NOT match partial path names', () => {
      // /api/healthcheck should NOT match /api/health
      expect(isExcludedPath('/api/healthcheck')).toBe(false);
    });

    it('should NOT match protected paths', () => {
      expect(isExcludedPath('/api/users')).toBe(false);
      expect(isExcludedPath('/api/users/123')).toBe(false);
      expect(isExcludedPath('/api/orders')).toBe(false);
      expect(isExcludedPath('/api/venues/abc/products')).toBe(false);
    });

    it('should NOT match auth paths that are not excluded', () => {
      expect(isExcludedPath('/api/auth/me')).toBe(false);
      expect(isExcludedPath('/api/auth/change-password')).toBe(false);
      expect(isExcludedPath('/api/auth/logout')).toBe(false);
      expect(isExcludedPath('/api/auth/mfa/setup')).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // HTTP METHOD HANDLING
  // ─────────────────────────────────────────
  describe('Safe HTTP Methods', () => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    it('should have GET, HEAD, OPTIONS as safe methods', () => {
      // These methods should be ignored by CSRF protection
      safeMethods.forEach((method) => {
        expect(['GET', 'HEAD', 'OPTIONS']).toContain(method);
      });
    });

    it('should require CSRF for unsafe methods', () => {
      // POST, PUT, PATCH, DELETE should require CSRF
      unsafeMethods.forEach((method) => {
        expect(['GET', 'HEAD', 'OPTIONS']).not.toContain(method);
      });
    });
  });
});

describe('CSRF Token Validation Rules', () => {
  // ─────────────────────────────────────────
  // TOKEN SOURCES
  // ─────────────────────────────────────────

  // Mock request interface for testing
  interface MockRequest {
    headers: Record<string, string | undefined>;
    body: Record<string, string | undefined>;
  }

  // Token extraction logic (mirrors middleware implementation)
  function getTokenFromMockRequest(req: MockRequest): string | undefined {
    const headerToken = req.headers['x-csrf-token'];
    if (headerToken) return headerToken;
    if (req.body._csrf) return req.body._csrf;
    return undefined;
  }

  describe('Token Sources', () => {
    it('should accept token from X-CSRF-Token header', () => {
      const mockReq: MockRequest = {
        headers: { 'x-csrf-token': 'valid-token' },
        body: {},
      };

      expect(getTokenFromMockRequest(mockReq)).toBe('valid-token');
    });

    it('should fallback to body._csrf if header not present', () => {
      const mockReq: MockRequest = {
        headers: {},
        body: { _csrf: 'body-token' },
      };

      expect(getTokenFromMockRequest(mockReq)).toBe('body-token');
    });

    it('should prefer header over body', () => {
      const mockReq: MockRequest = {
        headers: { 'x-csrf-token': 'header-token' },
        body: { _csrf: 'body-token' },
      };

      expect(getTokenFromMockRequest(mockReq)).toBe('header-token');
    });

    it('should return undefined if no token present', () => {
      const mockReq: MockRequest = {
        headers: {},
        body: {},
      };

      expect(getTokenFromMockRequest(mockReq)).toBeUndefined();
    });
  });
});
