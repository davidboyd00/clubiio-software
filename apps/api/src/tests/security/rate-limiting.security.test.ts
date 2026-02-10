import { describe, it, expect, beforeEach } from 'vitest';

// ============================================
// RATE LIMITING SECURITY TESTS
// ============================================
// Tests for rate limiting, brute force prevention, and DoS protection

describe('Rate Limiting', () => {
  // ─────────────────────────────────────────
  // SLIDING WINDOW RATE LIMITER
  // ─────────────────────────────────────────
  describe('Sliding Window Rate Limiter', () => {
    class SlidingWindowRateLimiter {
      private requests: Map<string, number[]> = new Map();
      private windowMs: number;
      private maxRequests: number;

      constructor(windowMs: number, maxRequests: number) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
      }

      isAllowed(key: string): boolean {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // Get existing requests for this key
        let timestamps = this.requests.get(key) || [];

        // Filter out old requests outside the window
        timestamps = timestamps.filter(ts => ts > windowStart);

        if (timestamps.length >= this.maxRequests) {
          this.requests.set(key, timestamps);
          return false;
        }

        // Add current request
        timestamps.push(now);
        this.requests.set(key, timestamps);
        return true;
      }

      getRemaining(key: string): number {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        const timestamps = this.requests.get(key) || [];
        const validTimestamps = timestamps.filter(ts => ts > windowStart);
        return Math.max(0, this.maxRequests - validTimestamps.length);
      }

      reset(key: string): void {
        this.requests.delete(key);
      }
    }

    let limiter: SlidingWindowRateLimiter;

    beforeEach(() => {
      // 1 minute window, 5 requests max
      limiter = new SlidingWindowRateLimiter(60000, 5);
    });

    it('should allow requests within limit', () => {
      const clientIp = '192.168.1.1';

      for (let i = 0; i < 5; i++) {
        expect(limiter.isAllowed(clientIp)).toBe(true);
      }
    });

    it('should block requests exceeding limit', () => {
      const clientIp = '192.168.1.1';

      // Use up all requests
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed(clientIp);
      }

      // Next request should be blocked
      expect(limiter.isAllowed(clientIp)).toBe(false);
    });

    it('should track limits per client', () => {
      const client1 = '192.168.1.1';
      const client2 = '192.168.1.2';

      // Client 1 uses all requests
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed(client1);
      }

      // Client 2 should still be allowed
      expect(limiter.isAllowed(client2)).toBe(true);

      // Client 1 should be blocked
      expect(limiter.isAllowed(client1)).toBe(false);
    });

    it('should report remaining requests correctly', () => {
      const clientIp = '192.168.1.1';

      expect(limiter.getRemaining(clientIp)).toBe(5);

      limiter.isAllowed(clientIp);
      limiter.isAllowed(clientIp);

      expect(limiter.getRemaining(clientIp)).toBe(3);
    });
  });

  // ─────────────────────────────────────────
  // TOKEN BUCKET RATE LIMITER
  // ─────────────────────────────────────────
  describe('Token Bucket Rate Limiter', () => {
    class TokenBucketRateLimiter {
      private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
      private maxTokens: number;
      private refillRate: number; // tokens per second

      constructor(maxTokens: number, refillRate: number) {
        this.maxTokens = maxTokens;
        this.refillRate = refillRate;
      }

      isAllowed(key: string, tokens: number = 1): boolean {
        const now = Date.now();
        let bucket = this.buckets.get(key);

        if (!bucket) {
          bucket = { tokens: this.maxTokens, lastRefill: now };
        }

        // Calculate tokens to add based on time elapsed
        const timePassed = (now - bucket.lastRefill) / 1000;
        const tokensToAdd = Math.floor(timePassed * this.refillRate);

        bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;

        if (bucket.tokens >= tokens) {
          bucket.tokens -= tokens;
          this.buckets.set(key, bucket);
          return true;
        }

        this.buckets.set(key, bucket);
        return false;
      }

      getTokens(key: string): number {
        const bucket = this.buckets.get(key);
        return bucket ? bucket.tokens : this.maxTokens;
      }
    }

    let limiter: TokenBucketRateLimiter;

    beforeEach(() => {
      // 10 tokens max, refill 1 token per second
      limiter = new TokenBucketRateLimiter(10, 1);
    });

    it('should allow burst requests up to bucket size', () => {
      const clientIp = '192.168.1.1';

      // Should allow 10 rapid requests
      for (let i = 0; i < 10; i++) {
        expect(limiter.isAllowed(clientIp)).toBe(true);
      }

      // 11th should fail
      expect(limiter.isAllowed(clientIp)).toBe(false);
    });

    it('should allow variable cost operations', () => {
      const clientIp = '192.168.1.1';

      // Large operation costing 5 tokens
      expect(limiter.isAllowed(clientIp, 5)).toBe(true);

      // Another large operation should also succeed
      expect(limiter.isAllowed(clientIp, 5)).toBe(true);

      // Small operation should now fail
      expect(limiter.isAllowed(clientIp, 1)).toBe(false);
    });
  });
});

describe('Brute Force Prevention', () => {
  // ─────────────────────────────────────────
  // LOGIN ATTEMPT LIMITING
  // ─────────────────────────────────────────
  describe('Login Attempt Limiting', () => {
    class LoginAttemptTracker {
      private attempts: Map<string, { count: number; lastAttempt: number; lockedUntil?: number }> = new Map();
      private maxAttempts: number;
      private lockoutDurationMs: number;
      private attemptWindowMs: number;

      constructor(maxAttempts: number = 5, lockoutDurationMs: number = 900000, attemptWindowMs: number = 300000) {
        this.maxAttempts = maxAttempts;
        this.lockoutDurationMs = lockoutDurationMs;
        this.attemptWindowMs = attemptWindowMs;
      }

      recordFailedAttempt(identifier: string): { allowed: boolean; remainingAttempts: number; lockoutSeconds?: number } {
        const now = Date.now();
        let record = this.attempts.get(identifier);

        // Check if currently locked out
        if (record?.lockedUntil && record.lockedUntil > now) {
          return {
            allowed: false,
            remainingAttempts: 0,
            lockoutSeconds: Math.ceil((record.lockedUntil - now) / 1000),
          };
        }

        // Reset if outside attempt window
        if (!record || (now - record.lastAttempt) > this.attemptWindowMs) {
          record = { count: 0, lastAttempt: now };
        }

        record.count++;
        record.lastAttempt = now;

        if (record.count >= this.maxAttempts) {
          record.lockedUntil = now + this.lockoutDurationMs;
          this.attempts.set(identifier, record);
          return {
            allowed: false,
            remainingAttempts: 0,
            lockoutSeconds: Math.ceil(this.lockoutDurationMs / 1000),
          };
        }

        this.attempts.set(identifier, record);
        return {
          allowed: true,
          remainingAttempts: this.maxAttempts - record.count,
        };
      }

      recordSuccessfulLogin(identifier: string): void {
        this.attempts.delete(identifier);
      }

      isLockedOut(identifier: string): boolean {
        const record = this.attempts.get(identifier);
        if (!record?.lockedUntil) return false;
        return record.lockedUntil > Date.now();
      }
    }

    let tracker: LoginAttemptTracker;

    beforeEach(() => {
      tracker = new LoginAttemptTracker(5, 900000, 300000);
    });

    it('should allow attempts within limit', () => {
      const email = 'user@example.com';

      for (let i = 0; i < 4; i++) {
        const result = tracker.recordFailedAttempt(email);
        expect(result.allowed).toBe(true);
        expect(result.remainingAttempts).toBe(4 - i);
      }
    });

    it('should lock account after max attempts', () => {
      const email = 'user@example.com';

      // Use up all attempts
      for (let i = 0; i < 5; i++) {
        tracker.recordFailedAttempt(email);
      }

      // Should be locked out
      expect(tracker.isLockedOut(email)).toBe(true);

      const result = tracker.recordFailedAttempt(email);
      expect(result.allowed).toBe(false);
      expect(result.lockoutSeconds).toBeGreaterThan(0);
    });

    it('should reset on successful login', () => {
      const email = 'user@example.com';

      // Record some failed attempts
      for (let i = 0; i < 3; i++) {
        tracker.recordFailedAttempt(email);
      }

      // Successful login should reset
      tracker.recordSuccessfulLogin(email);

      // Should have full attempts again
      const result = tracker.recordFailedAttempt(email);
      expect(result.remainingAttempts).toBe(4);
    });

    it('should track attempts per identifier', () => {
      const user1 = 'user1@example.com';
      const user2 = 'user2@example.com';

      // Lock out user1
      for (let i = 0; i < 5; i++) {
        tracker.recordFailedAttempt(user1);
      }

      // user2 should still be allowed
      const result = tracker.recordFailedAttempt(user2);
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(4);
    });
  });

  // ─────────────────────────────────────────
  // PASSWORD RESET LIMITING
  // ─────────────────────────────────────────
  describe('Password Reset Limiting', () => {
    class PasswordResetLimiter {
      private requests: Map<string, number[]> = new Map();
      private maxRequests: number;
      private windowMs: number;

      constructor(maxRequests: number = 3, windowMs: number = 3600000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
      }

      canRequestReset(email: string): boolean {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        let timestamps = this.requests.get(email) || [];
        timestamps = timestamps.filter(ts => ts > windowStart);

        if (timestamps.length >= this.maxRequests) {
          return false;
        }

        timestamps.push(now);
        this.requests.set(email, timestamps);
        return true;
      }

      getTimeUntilNextAllowed(email: string): number {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        const timestamps = this.requests.get(email) || [];
        const validTimestamps = timestamps.filter(ts => ts > windowStart);

        if (validTimestamps.length < this.maxRequests) {
          return 0;
        }

        // Return time until oldest request expires
        const oldestTimestamp = Math.min(...validTimestamps);
        return Math.max(0, oldestTimestamp + this.windowMs - now);
      }
    }

    let limiter: PasswordResetLimiter;

    beforeEach(() => {
      // 3 requests per hour
      limiter = new PasswordResetLimiter(3, 3600000);
    });

    it('should allow limited reset requests', () => {
      const email = 'user@example.com';

      expect(limiter.canRequestReset(email)).toBe(true);
      expect(limiter.canRequestReset(email)).toBe(true);
      expect(limiter.canRequestReset(email)).toBe(true);
      expect(limiter.canRequestReset(email)).toBe(false);
    });

    it('should report time until next allowed request', () => {
      const email = 'user@example.com';

      // Use up all requests
      for (let i = 0; i < 3; i++) {
        limiter.canRequestReset(email);
      }

      const waitTime = limiter.getTimeUntilNextAllowed(email);
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(3600000);
    });
  });
});

describe('DoS Protection', () => {
  // ─────────────────────────────────────────
  // REQUEST SIZE LIMITS
  // ─────────────────────────────────────────
  describe('Request Size Limits', () => {
    const MAX_BODY_SIZE = 1024 * 1024; // 1MB
    const MAX_URL_LENGTH = 2048;
    const MAX_HEADER_SIZE = 8192;

    const validateRequestSize = (request: {
      bodySize: number;
      urlLength: number;
      headerSize: number;
    }): { valid: boolean; error?: string } => {
      if (request.bodySize > MAX_BODY_SIZE) {
        return { valid: false, error: 'Request body too large' };
      }
      if (request.urlLength > MAX_URL_LENGTH) {
        return { valid: false, error: 'URL too long' };
      }
      if (request.headerSize > MAX_HEADER_SIZE) {
        return { valid: false, error: 'Headers too large' };
      }
      return { valid: true };
    };

    it('should reject oversized request bodies', () => {
      const result = validateRequestSize({
        bodySize: 2 * 1024 * 1024, // 2MB
        urlLength: 100,
        headerSize: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Request body too large');
    });

    it('should reject overly long URLs', () => {
      const result = validateRequestSize({
        bodySize: 1000,
        urlLength: 5000,
        headerSize: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('URL too long');
    });

    it('should accept normal requests', () => {
      const result = validateRequestSize({
        bodySize: 50000,
        urlLength: 200,
        headerSize: 2000,
      });

      expect(result.valid).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // CONCURRENT CONNECTION LIMITS
  // ─────────────────────────────────────────
  describe('Concurrent Connection Limits', () => {
    class ConnectionTracker {
      private connections: Map<string, number> = new Map();
      private maxConnectionsPerIp: number;

      constructor(maxConnectionsPerIp: number = 100) {
        this.maxConnectionsPerIp = maxConnectionsPerIp;
      }

      addConnection(ip: string): boolean {
        const current = this.connections.get(ip) || 0;

        if (current >= this.maxConnectionsPerIp) {
          return false;
        }

        this.connections.set(ip, current + 1);
        return true;
      }

      removeConnection(ip: string): void {
        const current = this.connections.get(ip) || 0;
        if (current > 0) {
          this.connections.set(ip, current - 1);
        }
      }

      getConnectionCount(ip: string): number {
        return this.connections.get(ip) || 0;
      }
    }

    let tracker: ConnectionTracker;

    beforeEach(() => {
      tracker = new ConnectionTracker(10);
    });

    it('should limit concurrent connections per IP', () => {
      const clientIp = '192.168.1.1';

      // Add max connections
      for (let i = 0; i < 10; i++) {
        expect(tracker.addConnection(clientIp)).toBe(true);
      }

      // Next connection should fail
      expect(tracker.addConnection(clientIp)).toBe(false);
    });

    it('should track connections per IP separately', () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';

      // IP1 uses all connections
      for (let i = 0; i < 10; i++) {
        tracker.addConnection(ip1);
      }

      // IP2 should still be allowed
      expect(tracker.addConnection(ip2)).toBe(true);
    });

    it('should allow new connections after disconnect', () => {
      const clientIp = '192.168.1.1';

      // Use all connections
      for (let i = 0; i < 10; i++) {
        tracker.addConnection(clientIp);
      }

      // Remove one connection
      tracker.removeConnection(clientIp);

      // Should now allow a new connection
      expect(tracker.addConnection(clientIp)).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // SLOWLORIS PROTECTION
  // ─────────────────────────────────────────
  describe('Slowloris Protection', () => {
    class SlowRequestDetector {
      private requestStarts: Map<string, number> = new Map();
      private maxRequestDurationMs: number;

      constructor(maxRequestDurationMs: number = 30000) {
        this.maxRequestDurationMs = maxRequestDurationMs;
      }

      startRequest(requestId: string): void {
        this.requestStarts.set(requestId, Date.now());
      }

      isRequestTooSlow(requestId: string): boolean {
        const startTime = this.requestStarts.get(requestId);
        if (!startTime) return false;

        return (Date.now() - startTime) > this.maxRequestDurationMs;
      }

      endRequest(requestId: string): void {
        this.requestStarts.delete(requestId);
      }

      getSlowRequests(): string[] {
        const now = Date.now();
        const slowRequests: string[] = [];

        this.requestStarts.forEach((startTime, requestId) => {
          if ((now - startTime) > this.maxRequestDurationMs) {
            slowRequests.push(requestId);
          }
        });

        return slowRequests;
      }
    }

    it('should detect slow requests', () => {
      const detector = new SlowRequestDetector(100); // 100ms for testing

      detector.startRequest('req-1');

      // Simulate slow request
      const start = Date.now();
      while (Date.now() - start < 150) {
        // Wait
      }

      expect(detector.isRequestTooSlow('req-1')).toBe(true);
    });

    it('should not flag fast requests', () => {
      const detector = new SlowRequestDetector(1000);

      detector.startRequest('req-1');

      // Immediate check should not flag as slow
      expect(detector.isRequestTooSlow('req-1')).toBe(false);
    });
  });
});

describe('API Abuse Prevention', () => {
  // ─────────────────────────────────────────
  // ENDPOINT-SPECIFIC RATE LIMITS
  // ─────────────────────────────────────────
  describe('Endpoint-Specific Rate Limits', () => {
    interface EndpointConfig {
      windowMs: number;
      maxRequests: number;
    }

    const endpointLimits: Record<string, EndpointConfig> = {
      '/api/auth/login': { windowMs: 60000, maxRequests: 5 },
      '/api/auth/register': { windowMs: 3600000, maxRequests: 3 },
      '/api/auth/password-reset': { windowMs: 3600000, maxRequests: 3 },
      '/api/orders': { windowMs: 60000, maxRequests: 100 },
      '/api/analytics': { windowMs: 60000, maxRequests: 10 },
      'default': { windowMs: 60000, maxRequests: 60 },
    };

    const getEndpointLimit = (endpoint: string): EndpointConfig => {
      // Find matching endpoint or use default
      for (const [pattern, config] of Object.entries(endpointLimits)) {
        if (endpoint.startsWith(pattern)) {
          return config;
        }
      }
      return endpointLimits['default'];
    };

    it('should have stricter limits for auth endpoints', () => {
      const loginLimit = getEndpointLimit('/api/auth/login');
      const ordersLimit = getEndpointLimit('/api/orders');

      expect(loginLimit.maxRequests).toBeLessThan(ordersLimit.maxRequests);
    });

    it('should have very strict limits for registration', () => {
      const registerLimit = getEndpointLimit('/api/auth/register');

      expect(registerLimit.maxRequests).toBe(3);
      expect(registerLimit.windowMs).toBe(3600000); // 1 hour
    });

    it('should apply default limits to unknown endpoints', () => {
      const unknownLimit = getEndpointLimit('/api/unknown/endpoint');

      expect(unknownLimit.maxRequests).toBe(60);
      expect(unknownLimit.windowMs).toBe(60000);
    });
  });

  // ─────────────────────────────────────────
  // API KEY RATE LIMITING
  // ─────────────────────────────────────────
  describe('API Key Rate Limiting', () => {
    interface ApiKeyTier {
      requestsPerMinute: number;
      requestsPerDay: number;
    }

    const apiKeyTiers: Record<string, ApiKeyTier> = {
      free: { requestsPerMinute: 10, requestsPerDay: 1000 },
      basic: { requestsPerMinute: 60, requestsPerDay: 10000 },
      premium: { requestsPerMinute: 300, requestsPerDay: 100000 },
      enterprise: { requestsPerMinute: 1000, requestsPerDay: -1 }, // Unlimited daily
    };

    it('should enforce tier-based limits', () => {
      expect(apiKeyTiers.free.requestsPerMinute).toBeLessThan(apiKeyTiers.basic.requestsPerMinute);
      expect(apiKeyTiers.basic.requestsPerMinute).toBeLessThan(apiKeyTiers.premium.requestsPerMinute);
      expect(apiKeyTiers.premium.requestsPerMinute).toBeLessThan(apiKeyTiers.enterprise.requestsPerMinute);
    });

    it('should have daily limits for non-enterprise tiers', () => {
      expect(apiKeyTiers.free.requestsPerDay).toBeGreaterThan(0);
      expect(apiKeyTiers.basic.requestsPerDay).toBeGreaterThan(0);
      expect(apiKeyTiers.premium.requestsPerDay).toBeGreaterThan(0);
      expect(apiKeyTiers.enterprise.requestsPerDay).toBe(-1); // Unlimited
    });
  });
});
