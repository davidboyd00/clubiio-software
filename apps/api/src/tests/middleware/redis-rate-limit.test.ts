// ============================================
// REDIS RATE LIMITER TESTS
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock Redis
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({})),
  };
});

// Mock getRedisService
const mockGetRedisService = vi.fn();
vi.mock('../../common/cache/redis.service', () => ({
  getRedisService: () => mockGetRedisService(),
}));

// Mock logger
vi.mock('../../common/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

// Import after mocks
import {
  createRateLimiter,
  createTokenBucketLimiter,
  getRateLimitInfo,
  resetRateLimit,
  RateLimitConfig,
  TokenBucketConfig,
} from '../../middleware/redis-rate-limit.middleware';

// Helper to create mock client
function createMockClient(currentCount = 1) {
  return {
    multi: vi.fn().mockReturnValue({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 0],
        [null, 1],
        [null, currentCount],
        [null, 1],
      ]),
    }),
    eval: vi.fn().mockResolvedValue([1, 99]),
    zcount: vi.fn().mockResolvedValue(5),
    del: vi.fn().mockResolvedValue(1),
  };
}

function setupMockRedis(currentCount = 1) {
  mockGetRedisService.mockReturnValue({
    getClient: () => createMockClient(currentCount),
  });
}

function setupMockRedisError() {
  mockGetRedisService.mockReturnValue({
    getClient: () => ({
      multi: vi.fn().mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockRejectedValue(new Error('Redis connection error')),
      }),
      eval: vi.fn().mockRejectedValue(new Error('Redis error')),
      zcount: vi.fn().mockRejectedValue(new Error('Redis error')),
      del: vi.fn().mockRejectedValue(new Error('Redis error')),
    }),
  });
}

function setupMockTokenBucket(allowed = 1, remaining = 99) {
  mockGetRedisService.mockReturnValue({
    getClient: () => ({
      eval: vi.fn().mockResolvedValue([allowed, remaining]),
    }),
  });
}

describe('Redis Rate Limiter', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    setupMockRedis(1);

    mockReq = {
      ip: '127.0.0.1',
      path: '/api/test',
      headers: {},
      body: {},
    };

    mockRes = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    } as unknown as Partial<Response>;

    mockNext = vi.fn() as unknown as NextFunction;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createRateLimiter', () => {
    it('should allow requests within limit', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 100,
      };

      const middleware = createRateLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalledWith(429);
    });

    it('should set rate limit headers', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 100,
        headers: true,
      };

      const middleware = createRateLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        expect.any(Number)
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(Number)
      );
    });

    it('should not set headers when disabled', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 100,
        headers: false,
      };

      const middleware = createRateLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });

    it('should use custom key generator', async () => {
      const keyGenerator = vi.fn().mockReturnValue('custom-key');
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 100,
        keyGenerator,
      };

      const middleware = createRateLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(keyGenerator).toHaveBeenCalledWith(mockReq);
    });

    it('should skip rate limiting when skip function returns true', async () => {
      const skip = vi.fn().mockReturnValue(true);
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 100,
        skip,
      };

      const middleware = createRateLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(skip).toHaveBeenCalledWith(mockReq);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject requests exceeding limit', async () => {
      setupMockRedis(101); // Exceeds limit of 100

      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 100,
      };

      const middleware = createRateLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'RATE_LIMIT_EXCEEDED',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call onLimitReached callback when limit exceeded', async () => {
      const onLimitReached = vi.fn();
      setupMockRedis(101);

      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 100,
        onLimitReached,
      };

      const middleware = createRateLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(onLimitReached).toHaveBeenCalledWith(
        mockReq,
        expect.stringContaining('ratelimit:')
      );
    });

    it('should use custom handler when limit exceeded', async () => {
      const customHandler = vi.fn();
      setupMockRedis(101);

      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 100,
        handler: customHandler,
      };

      const middleware = createRateLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(customHandler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });

    it('should fail open on Redis error', async () => {
      setupMockRedisError();

      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 100,
      };

      const middleware = createRateLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalledWith(429);
    });

    it('should use X-Forwarded-For header when available', async () => {
      mockReq.headers = { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' };

      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 100,
      };

      const middleware = createRateLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('createTokenBucketLimiter', () => {
    it('should allow requests when tokens available', async () => {
      setupMockTokenBucket(1, 99);

      const config: TokenBucketConfig = {
        capacity: 100,
        refillRate: 10,
      };

      const middleware = createTokenBucketLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalledWith(429);
    });

    it('should set rate limit headers', async () => {
      setupMockTokenBucket(1, 99);

      const config: TokenBucketConfig = {
        capacity: 100,
        refillRate: 10,
        headers: true,
      };

      const middleware = createTokenBucketLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 99);
    });

    it('should reject when no tokens available', async () => {
      setupMockTokenBucket(0, 0);

      const config: TokenBucketConfig = {
        capacity: 100,
        refillRate: 10,
      };

      const middleware = createTokenBucketLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'RATE_LIMIT_EXCEEDED',
        })
      );
    });

    it('should fail open on Redis error', async () => {
      setupMockRedisError();

      const config: TokenBucketConfig = {
        capacity: 100,
        refillRate: 10,
      };

      const middleware = createTokenBucketLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getRateLimitInfo', () => {
    it('should return rate limit info', async () => {
      mockGetRedisService.mockReturnValue({
        getClient: () => ({
          zcount: vi.fn().mockResolvedValue(25),
        }),
      });

      const info = await getRateLimitInfo('test:key', 60000, 100);

      expect(info).toEqual({
        limit: 100,
        current: 25,
        remaining: 75,
        resetTime: expect.any(Date),
      });
    });

    it('should return zero remaining when at limit', async () => {
      mockGetRedisService.mockReturnValue({
        getClient: () => ({
          zcount: vi.fn().mockResolvedValue(100),
        }),
      });

      const info = await getRateLimitInfo('test:key', 60000, 100);

      expect(info?.remaining).toBe(0);
    });

    it('should return null on error', async () => {
      setupMockRedisError();

      const info = await getRateLimitInfo('test:key', 60000, 100);

      expect(info).toBeNull();
    });
  });

  describe('resetRateLimit', () => {
    it('should delete rate limit key', async () => {
      mockGetRedisService.mockReturnValue({
        getClient: () => ({
          del: vi.fn().mockResolvedValue(1),
        }),
      });

      const result = await resetRateLimit('test:key');

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      setupMockRedisError();

      const result = await resetRateLimit('test:key');

      expect(result).toBe(false);
    });
  });

  describe('Rate Limit Configurations', () => {
    it('should have auth, api, and strict rate limiters defined', async () => {
      // Import the pre-configured rate limiters
      const rateLimitModule = await vi.importActual<typeof import('../../middleware/redis-rate-limit.middleware')>(
        '../../middleware/redis-rate-limit.middleware'
      );
      expect(rateLimitModule.authRateLimiter).toBeDefined();
      expect(rateLimitModule.apiRateLimiter).toBeDefined();
      expect(rateLimitModule.strictRateLimiter).toBeDefined();
    });
  });

  describe('Default Key Generator', () => {
    it('should use IP address from request', async () => {
      const reqWithIp = {
        ...mockReq,
        ip: '10.0.0.1',
        headers: {},
      } as Request;

      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 100,
      };

      const middleware = createRateLimiter(config);
      await middleware(reqWithIp, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should use X-Forwarded-For when available', async () => {
      const reqWithForwarded = {
        ...mockReq,
        headers: { 'x-forwarded-for': '192.168.1.100' },
      } as Request;

      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 100,
      };

      const middleware = createRateLimiter(config);
      await middleware(reqWithForwarded, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty exec results gracefully', async () => {
      mockGetRedisService.mockReturnValue({
        getClient: () => ({
          multi: vi.fn().mockReturnValue({
            zremrangebyscore: vi.fn().mockReturnThis(),
            zadd: vi.fn().mockReturnThis(),
            zcard: vi.fn().mockReturnThis(),
            expire: vi.fn().mockReturnThis(),
            exec: vi.fn().mockResolvedValue(null),
          }),
        }),
      });

      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 100,
      };

      const middleware = createRateLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle very short window correctly', async () => {
      const config: RateLimitConfig = {
        windowMs: 1000,
        max: 10,
      };

      const middleware = createRateLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle very large max correctly', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        max: 1000000,
      };

      const middleware = createRateLimiter(config);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
