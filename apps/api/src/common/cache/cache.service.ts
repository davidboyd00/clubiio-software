// ============================================
// CACHE SERVICE
// ============================================
// High-level caching abstraction with TTL strategies

import { getRedisService, RedisService } from './redis.service';
import { logger } from '../logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Additional key prefix
  tags?: string[]; // Tags for cache invalidation
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

// TTL presets for different data types
export const CacheTTL = {
  SHORT: 60, // 1 minute - for frequently changing data
  MEDIUM: 300, // 5 minutes - for moderately stable data
  LONG: 3600, // 1 hour - for stable data
  VERY_LONG: 86400, // 24 hours - for rarely changing data
  SESSION: 1800, // 30 minutes - for session data
  USER: 600, // 10 minutes - for user data
  CONFIG: 3600, // 1 hour - for configuration
  LIST: 120, // 2 minutes - for list queries
} as const;

/**
 * Cache Service
 * Provides high-level caching operations with TTL strategies
 */
export class CacheService {
  private redis: RedisService;
  private stats = { hits: 0, misses: 0 };
  private defaultTTL: number;

  constructor(redis?: RedisService, defaultTTL = CacheTTL.MEDIUM) {
    this.redis = redis || getRedisService();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const fullKey = this.buildKey(key, options.prefix);

    try {
      const client = this.redis.getClient();
      const value = await client.get(fullKey);

      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return this.deserialize<T>(value);
    } catch (error) {
      logger.warn('Cache get error', { key: fullKey, error });
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<boolean> {
    const fullKey = this.buildKey(key, options.prefix);
    const ttl = options.ttl ?? this.defaultTTL;

    try {
      const client = this.redis.getClient();
      const serialized = this.serialize(value);

      if (ttl > 0) {
        await client.setex(fullKey, ttl, serialized);
      } else {
        await client.set(fullKey, serialized);
      }

      // Store tags for invalidation
      if (options.tags?.length) {
        await this.addToTags(fullKey, options.tags);
      }

      return true;
    } catch (error) {
      logger.warn('Cache set error', { key: fullKey, error });
      return false;
    }
  }

  /**
   * Delete a value from cache
   */
  async del(key: string, prefix?: string): Promise<boolean> {
    const fullKey = this.buildKey(key, prefix);

    try {
      const client = this.redis.getClient();
      await client.del(fullKey);
      return true;
    } catch (error) {
      logger.warn('Cache del error', { key: fullKey, error });
      return false;
    }
  }

  /**
   * Get or set (cache-aside pattern)
   * Returns cached value if exists, otherwise calls factory and caches result
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);

    return value;
  }

  /**
   * Check if a key exists
   */
  async exists(key: string, prefix?: string): Promise<boolean> {
    const fullKey = this.buildKey(key, prefix);

    try {
      const client = this.redis.getClient();
      const result = await client.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.warn('Cache exists error', { key: fullKey, error });
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string, prefix?: string): Promise<number> {
    const fullKey = this.buildKey(key, prefix);

    try {
      const client = this.redis.getClient();
      return await client.ttl(fullKey);
    } catch (error) {
      logger.warn('Cache ttl error', { key: fullKey, error });
      return -1;
    }
  }

  /**
   * Invalidate all keys with a specific tag
   */
  async invalidateTag(tag: string): Promise<number> {
    const tagKey = this.buildTagKey(tag);

    try {
      const client = this.redis.getClient();
      const keys = await client.smembers(tagKey);

      if (keys.length === 0) {
        return 0;
      }

      // Delete all tagged keys
      await client.del(...keys);

      // Delete the tag set
      await client.del(tagKey);

      logger.info('Cache invalidated by tag', { tag, keysInvalidated: keys.length });
      return keys.length;
    } catch (error) {
      logger.warn('Cache invalidateTag error', { tag, error });
      return 0;
    }
  }

  /**
   * Invalidate keys matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const client = this.redis.getClient();
      let cursor = '0';
      let totalDeleted = 0;

      do {
        const [newCursor, keys] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = newCursor;

        if (keys.length > 0) {
          await client.del(...keys);
          totalDeleted += keys.length;
        }
      } while (cursor !== '0');

      logger.info('Cache invalidated by pattern', { pattern, keysInvalidated: totalDeleted });
      return totalDeleted;
    } catch (error) {
      logger.warn('Cache invalidatePattern error', { pattern, error });
      return 0;
    }
  }

  /**
   * Increment a counter
   */
  async incr(key: string, prefix?: string): Promise<number> {
    const fullKey = this.buildKey(key, prefix);

    try {
      const client = this.redis.getClient();
      return await client.incr(fullKey);
    } catch (error) {
      logger.warn('Cache incr error', { key: fullKey, error });
      return 0;
    }
  }

  /**
   * Increment with expiration
   */
  async incrEx(key: string, ttl: number, prefix?: string): Promise<number> {
    const fullKey = this.buildKey(key, prefix);

    try {
      const client = this.redis.getClient();
      const pipeline = client.pipeline();
      pipeline.incr(fullKey);
      pipeline.expire(fullKey, ttl);
      const results = await pipeline.exec();
      return (results?.[0]?.[1] as number) || 0;
    } catch (error) {
      logger.warn('Cache incrEx error', { key: fullKey, error });
      return 0;
    }
  }

  /**
   * Set multiple values at once
   */
  async mset(
    entries: Array<{ key: string; value: unknown; ttl?: number }>,
    prefix?: string
  ): Promise<boolean> {
    try {
      const client = this.redis.getClient();
      const pipeline = client.pipeline();

      for (const entry of entries) {
        const fullKey = this.buildKey(entry.key, prefix);
        const serialized = this.serialize(entry.value);
        const ttl = entry.ttl ?? this.defaultTTL;

        if (ttl > 0) {
          pipeline.setex(fullKey, ttl, serialized);
        } else {
          pipeline.set(fullKey, serialized);
        }
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      logger.warn('Cache mset error', { error });
      return false;
    }
  }

  /**
   * Get multiple values at once
   */
  async mget<T>(keys: string[], prefix?: string): Promise<Map<string, T | null>> {
    const fullKeys = keys.map((k) => this.buildKey(k, prefix));
    const result = new Map<string, T | null>();

    try {
      const client = this.redis.getClient();
      const values = await client.mget(...fullKeys);

      keys.forEach((key, index) => {
        const value = values[index];
        if (value === null) {
          this.stats.misses++;
          result.set(key, null);
        } else {
          this.stats.hits++;
          result.set(key, this.deserialize<T>(value));
        }
      });

      return result;
    } catch (error) {
      logger.warn('Cache mget error', { error });
      keys.forEach((key) => result.set(key, null));
      return result;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Flush all cache (use with caution)
   */
  async flush(): Promise<void> {
    try {
      const client = this.redis.getClient();
      await client.flushdb();
      logger.warn('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error', { error });
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────

  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  private buildTagKey(tag: string): string {
    return `_tags:${tag}`;
  }

  private async addToTags(key: string, tags: string[]): Promise<void> {
    const client = this.redis.getClient();
    const pipeline = client.pipeline();

    for (const tag of tags) {
      const tagKey = this.buildTagKey(tag);
      pipeline.sadd(tagKey, key);
      // Set TTL on tag set (max 24 hours)
      pipeline.expire(tagKey, 86400);
    }

    await pipeline.exec();
  }

  private serialize(value: unknown): string {
    return JSON.stringify(value);
  }

  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }
}

// Export singleton instance
let cacheService: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!cacheService) {
    cacheService = new CacheService();
  }
  return cacheService;
}

// ─────────────────────────────────────────
// DECORATOR HELPERS
// ─────────────────────────────────────────

/**
 * Create a cached version of an async function
 */
export function cached(
  keyFn: (...args: unknown[]) => string,
  options: CacheOptions = {}
) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const cache = getCacheService();
      const key = keyFn(...args);

      return cache.getOrSet(key, () => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
