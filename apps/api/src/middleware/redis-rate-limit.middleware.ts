// ============================================
// REDIS RATE LIMITER
// ============================================
// Distributed rate limiting with Redis backend

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { getRedisService } from '../common/cache/redis.service';
import { logger } from '../common/logger';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  keyPrefix?: string; // Redis key prefix
  keyGenerator?: (req: Request) => string; // Custom key generator
  skip?: (req: Request) => boolean; // Skip rate limiting for certain requests
  handler?: (req: Request, res: Response, next: NextFunction) => void; // Custom handler when limit exceeded
  headers?: boolean; // Include rate limit headers
  onLimitReached?: (req: Request, key: string) => void; // Callback when limit reached
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
}

// ─────────────────────────────────────────
// DEFAULT CONFIGURATION
// ─────────────────────────────────────────

const DEFAULT_CONFIG: Partial<RateLimitConfig> = {
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  keyPrefix: 'ratelimit:',
  headers: true,
};

// ─────────────────────────────────────────
// SLIDING WINDOW RATE LIMITER
// ─────────────────────────────────────────

/**
 * Create a Redis-backed sliding window rate limiter
 *
 * @example
 * ```typescript
 * app.use('/api', createRateLimiter({
 *   windowMs: 60000, // 1 minute
 *   max: 100, // 100 requests per minute
 * }));
 * ```
 */
export function createRateLimiter(config: RateLimitConfig): RequestHandler {
  const options = { ...DEFAULT_CONFIG, ...config };

  const keyGenerator = options.keyGenerator || defaultKeyGenerator;
  const windowSeconds = Math.ceil(options.windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if configured to
    if (options.skip?.(req)) {
      return next();
    }

    const key = `${options.keyPrefix}${keyGenerator(req)}`;

    try {
      const redis = getRedisService();
      const client = redis.getClient();

      // Get current timestamp
      const now = Date.now();
      const windowStart = now - options.windowMs;

      // Use Redis transaction for atomic operations
      // Sliding window: remove old entries, add new entry, count total
      const multi = client.multi();

      // Remove entries outside the window
      multi.zremrangebyscore(key, 0, windowStart);

      // Add current request
      multi.zadd(key, now, `${now}-${Math.random()}`);

      // Count requests in window
      multi.zcard(key);

      // Set expiry on the key
      multi.expire(key, windowSeconds);

      const results = await multi.exec();

      // Get current count from results
      const currentCount = (results?.[2]?.[1] as number) || 0;

      // Calculate remaining
      const remaining = Math.max(0, options.max - currentCount);
      const resetTime = new Date(now + options.windowMs);

      // Set rate limit headers
      if (options.headers) {
        res.setHeader('X-RateLimit-Limit', options.max);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime.getTime() / 1000));
      }

      // Check if limit exceeded
      if (currentCount > options.max) {
        // Callback for monitoring
        options.onLimitReached?.(req, key);

        logger.warn('Rate limit exceeded', {
          key,
          current: currentCount,
          limit: options.max,
          ip: req.ip,
          path: req.path,
        });

        // Use custom handler or default
        if (options.handler) {
          return options.handler(req, res, next);
        }

        res.setHeader('Retry-After', windowSeconds);
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: windowSeconds,
        });
      }

      return next();
    } catch (error) {
      // On Redis error, allow the request (fail open)
      logger.error('Rate limiter error', { error });
      return next();
    }
  };
}

// ─────────────────────────────────────────
// TOKEN BUCKET RATE LIMITER
// ─────────────────────────────────────────

export interface TokenBucketConfig {
  capacity: number; // Max tokens
  refillRate: number; // Tokens added per second
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
  headers?: boolean;
}

/**
 * Create a Redis-backed token bucket rate limiter
 * Better for handling bursts while maintaining average rate
 */
export function createTokenBucketLimiter(config: TokenBucketConfig): RequestHandler {
  const keyPrefix = config.keyPrefix || 'tokenbucket:';
  const keyGenerator = config.keyGenerator || defaultKeyGenerator;

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `${keyPrefix}${keyGenerator(req)}`;

    try {
      const redis = getRedisService();
      const client = redis.getClient();

      const now = Date.now();

      // Lua script for atomic token bucket
      const script = `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refillRate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local requested = tonumber(ARGV[4])

        local bucket = redis.call('hmget', key, 'tokens', 'lastRefill')
        local tokens = tonumber(bucket[1]) or capacity
        local lastRefill = tonumber(bucket[2]) or now

        -- Calculate tokens to add based on time passed
        local timePassed = (now - lastRefill) / 1000
        local tokensToAdd = timePassed * refillRate
        tokens = math.min(capacity, tokens + tokensToAdd)

        -- Check if we have enough tokens
        if tokens >= requested then
          tokens = tokens - requested
          redis.call('hmset', key, 'tokens', tokens, 'lastRefill', now)
          redis.call('expire', key, math.ceil(capacity / refillRate) + 10)
          return {1, tokens}
        else
          redis.call('hmset', key, 'tokens', tokens, 'lastRefill', now)
          redis.call('expire', key, math.ceil(capacity / refillRate) + 10)
          return {0, tokens}
        end
      `;

      const result = (await client.eval(
        script,
        1,
        key,
        config.capacity,
        config.refillRate,
        now,
        1 // Request 1 token
      )) as [number, number];

      const [allowed, remaining] = result;

      // Set headers
      if (config.headers !== false) {
        res.setHeader('X-RateLimit-Limit', config.capacity);
        res.setHeader('X-RateLimit-Remaining', Math.floor(remaining));
      }

      if (!allowed) {
        logger.warn('Token bucket rate limit exceeded', {
          key,
          remaining,
          capacity: config.capacity,
        });

        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
        });
      }

      return next();
    } catch (error) {
      logger.error('Token bucket limiter error', { error });
      return next();
    }
  };
}

// ─────────────────────────────────────────
// ENDPOINT-SPECIFIC RATE LIMITERS
// ─────────────────────────────────────────

/**
 * Pre-configured rate limiter for authentication endpoints
 */
export const authRateLimiter: RequestHandler = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  keyPrefix: 'ratelimit:auth:',
  keyGenerator: (req) => `${req.ip}:${req.body?.email || 'unknown'}`,
  onLimitReached: (req) => {
    logger.warn('Auth rate limit reached', {
      ip: req.ip,
      email: req.body?.email,
      path: req.path,
    });
  },
});

/**
 * Pre-configured rate limiter for API endpoints
 */
export const apiRateLimiter: RequestHandler = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyPrefix: 'ratelimit:api:',
  keyGenerator: (req) => {
    // Use tenant ID if available, otherwise IP
    const tenantId = (req as Request & { tenantId?: string }).tenantId;
    return tenantId ? `tenant:${tenantId}` : `ip:${req.ip}`;
  },
});

/**
 * Strict rate limiter for sensitive operations
 */
export const strictRateLimiter: RequestHandler = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  keyPrefix: 'ratelimit:strict:',
  onLimitReached: (req, key) => {
    logger.warn('Strict rate limit reached', {
      key,
      ip: req.ip,
      path: req.path,
      userAgent: req.headers['user-agent'],
    });
  },
});

// ─────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────

/**
 * Default key generator using IP address
 */
function defaultKeyGenerator(req: Request): string {
  // Use X-Forwarded-For if behind proxy, otherwise use IP
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
    : req.ip;

  return `ip:${ip}`;
}

/**
 * Get current rate limit info for a key
 */
export async function getRateLimitInfo(
  key: string,
  windowMs: number,
  max: number
): Promise<RateLimitInfo | null> {
  try {
    const redis = getRedisService();
    const client = redis.getClient();

    const now = Date.now();
    const windowStart = now - windowMs;

    // Count requests in current window
    const current = await client.zcount(key, windowStart, now);

    return {
      limit: max,
      current,
      remaining: Math.max(0, max - current),
      resetTime: new Date(now + windowMs),
    };
  } catch (error) {
    logger.error('Error getting rate limit info', { error });
    return null;
  }
}

/**
 * Reset rate limit for a specific key
 */
export async function resetRateLimit(key: string): Promise<boolean> {
  try {
    const redis = getRedisService();
    const client = redis.getClient();
    await client.del(key);
    return true;
  } catch (error) {
    logger.error('Error resetting rate limit', { error });
    return false;
  }
}
