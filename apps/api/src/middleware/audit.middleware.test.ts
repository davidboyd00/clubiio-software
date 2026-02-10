import { describe, it, expect } from 'vitest';
import {
  maskSensitiveData,
  isCriticalEvent,
  CRITICAL_EVENTS,
  AuditEventType,
} from './audit.middleware';

describe('Audit Middleware', () => {
  // ─────────────────────────────────────────
  // CRITICAL EVENTS
  // ─────────────────────────────────────────
  describe('Critical Events', () => {
    it('should include AUTH_LOGIN_FAILURE as critical', () => {
      expect(CRITICAL_EVENTS).toContain('AUTH_LOGIN_FAILURE');
    });

    it('should include AUTH_ACCOUNT_LOCKED as critical', () => {
      expect(CRITICAL_EVENTS).toContain('AUTH_ACCOUNT_LOCKED');
    });

    it('should include PERMISSION_DENIED as critical', () => {
      expect(CRITICAL_EVENTS).toContain('PERMISSION_DENIED');
    });

    it('should include SUSPICIOUS_ACTIVITY as critical', () => {
      expect(CRITICAL_EVENTS).toContain('SUSPICIOUS_ACTIVITY');
    });

    it('should include DATA_DELETE as critical', () => {
      expect(CRITICAL_EVENTS).toContain('DATA_DELETE');
    });

    it('should include USER_DELETE as critical', () => {
      expect(CRITICAL_EVENTS).toContain('USER_DELETE');
    });

    it('should include CONFIG_CHANGE as critical', () => {
      expect(CRITICAL_EVENTS).toContain('CONFIG_CHANGE');
    });

    it('should include TOKEN_REUSE_DETECTED as critical', () => {
      expect(CRITICAL_EVENTS).toContain('TOKEN_REUSE_DETECTED');
    });

    it('should NOT include AUTH_LOGIN_SUCCESS as critical', () => {
      expect(CRITICAL_EVENTS).not.toContain('AUTH_LOGIN_SUCCESS');
    });

    it('should NOT include DATA_READ as critical', () => {
      expect(CRITICAL_EVENTS).not.toContain('DATA_READ');
    });

    it('should NOT include DATA_CREATE as critical', () => {
      expect(CRITICAL_EVENTS).not.toContain('DATA_CREATE');
    });
  });

  // ─────────────────────────────────────────
  // isCriticalEvent FUNCTION
  // ─────────────────────────────────────────
  describe('isCriticalEvent', () => {
    it('should return true for critical events', () => {
      expect(isCriticalEvent('AUTH_LOGIN_FAILURE')).toBe(true);
      expect(isCriticalEvent('SUSPICIOUS_ACTIVITY')).toBe(true);
      expect(isCriticalEvent('DATA_DELETE')).toBe(true);
    });

    it('should return false for non-critical events', () => {
      expect(isCriticalEvent('AUTH_LOGIN_SUCCESS')).toBe(false);
      expect(isCriticalEvent('DATA_READ')).toBe(false);
      expect(isCriticalEvent('DATA_CREATE')).toBe(false);
      expect(isCriticalEvent('DATA_UPDATE')).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // SENSITIVE DATA MASKING
  // ─────────────────────────────────────────
  describe('maskSensitiveData', () => {
    it('should mask password fields', () => {
      const data = { username: 'john', password: 'secret123' };
      const masked = maskSensitiveData(data);

      expect(masked.username).toBe('john');
      expect(masked.password).toBe('***MASKED***');
    });

    it('should mask token fields', () => {
      const data = { userId: '123', accessToken: 'jwt.token.here' };
      const masked = maskSensitiveData(data);

      expect(masked.userId).toBe('123');
      expect(masked.accessToken).toBe('***MASKED***');
    });

    it('should mask fields containing "secret"', () => {
      const data = { apiSecret: 'abc123', clientSecret: 'xyz789' };
      const masked = maskSensitiveData(data);

      expect(masked.apiSecret).toBe('***MASKED***');
      expect(masked.clientSecret).toBe('***MASKED***');
    });

    it('should mask authorization headers', () => {
      const data = { authorization: 'Bearer token', method: 'POST' };
      const masked = maskSensitiveData(data);

      expect(masked.authorization).toBe('***MASKED***');
      expect(masked.method).toBe('POST');
    });

    it('should mask PIN fields', () => {
      const data = { userPin: '1234', venueId: 'abc' };
      const masked = maskSensitiveData(data);

      expect(masked.userPin).toBe('***MASKED***');
      expect(masked.venueId).toBe('abc');
    });

    it('should mask cookie fields', () => {
      const data = { sessionCookie: 'abc123', userId: '1' };
      const masked = maskSensitiveData(data);

      expect(masked.sessionCookie).toBe('***MASKED***');
    });

    it('should mask CSRF fields', () => {
      const data = { csrfToken: 'token123', _csrf: 'csrf456' };
      const masked = maskSensitiveData(data);

      expect(masked.csrfToken).toBe('***MASKED***');
      expect(masked._csrf).toBe('***MASKED***');
    });

    it('should mask nested sensitive fields', () => {
      const data = {
        user: {
          email: 'test@test.com',
          password: 'secret',
        },
        metadata: {
          apiKey: 'key123',
        },
      };
      const masked = maskSensitiveData(data);

      expect((masked.user as any).email).toBe('test@test.com');
      expect((masked.user as any).password).toBe('***MASKED***');
      expect((masked.metadata as any).apiKey).toBe('***MASKED***');
    });

    it('should preserve non-sensitive data', () => {
      const data = {
        userId: '123',
        email: 'test@test.com',
        role: 'ADMIN',
        action: 'login',
      };
      const masked = maskSensitiveData(data);

      expect(masked).toEqual(data);
    });

    it('should handle empty objects', () => {
      const masked = maskSensitiveData({});
      expect(masked).toEqual({});
    });

    it('should handle objects with arrays (not mask arrays)', () => {
      const data = {
        items: ['a', 'b', 'c'],
        password: 'secret',
      };
      const masked = maskSensitiveData(data);

      expect(masked.items).toEqual(['a', 'b', 'c']);
      expect(masked.password).toBe('***MASKED***');
    });
  });

  // ─────────────────────────────────────────
  // AUDIT EVENT TYPES
  // ─────────────────────────────────────────
  describe('Audit Event Types', () => {
    it('should have authentication event types', () => {
      const authEvents: AuditEventType[] = [
        'AUTH_LOGIN_SUCCESS',
        'AUTH_LOGIN_FAILURE',
        'AUTH_LOGOUT',
        'AUTH_PIN_LOGIN_SUCCESS',
        'AUTH_PIN_LOGIN_FAILURE',
        'AUTH_ACCOUNT_LOCKED',
      ];

      // Type check - if these compile, the types exist
      authEvents.forEach((event) => {
        expect(typeof event).toBe('string');
      });
    });

    it('should have MFA event types', () => {
      const mfaEvents: AuditEventType[] = [
        'MFA_SETUP_INITIATED',
        'MFA_ENABLED',
        'MFA_DISABLED',
        'MFA_VERIFIED',
        'MFA_VERIFICATION_FAILED',
        'MFA_BACKUP_CODE_USED',
        'MFA_BACKUP_CODES_REGENERATED',
      ];

      mfaEvents.forEach((event) => {
        expect(typeof event).toBe('string');
      });
    });

    it('should have data operation event types', () => {
      const dataEvents: AuditEventType[] = [
        'DATA_READ',
        'DATA_CREATE',
        'DATA_UPDATE',
        'DATA_DELETE',
        'DATA_EXPORT',
      ];

      dataEvents.forEach((event) => {
        expect(typeof event).toBe('string');
      });
    });

    it('should have security event types', () => {
      const securityEvents: AuditEventType[] = [
        'PERMISSION_DENIED',
        'RATE_LIMIT_EXCEEDED',
        'SUSPICIOUS_ACTIVITY',
        'TOKEN_REUSE_DETECTED',
        'REVOKED_TOKEN_REUSE',
      ];

      securityEvents.forEach((event) => {
        expect(typeof event).toBe('string');
      });
    });
  });
});

describe('Audit Logging Configuration', () => {
  // ─────────────────────────────────────────
  // LOG RETENTION REQUIREMENTS
  // ─────────────────────────────────────────
  describe('Compliance Requirements', () => {
    it('should have critical events defined for alerting', () => {
      // At least 5 critical events should trigger immediate alerting
      expect(CRITICAL_EVENTS.length).toBeGreaterThanOrEqual(5);
    });

    it('should include token security events as critical', () => {
      // Token reuse is a serious security concern
      expect(CRITICAL_EVENTS).toContain('TOKEN_REUSE_DETECTED');
      expect(CRITICAL_EVENTS).toContain('REVOKED_TOKEN_REUSE');
    });

    it('should include deletion events as critical', () => {
      // Deletions should always be audited with high priority
      expect(CRITICAL_EVENTS).toContain('DATA_DELETE');
      expect(CRITICAL_EVENTS).toContain('USER_DELETE');
    });
  });
});
