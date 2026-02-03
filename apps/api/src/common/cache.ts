/**
 * Simple in-memory cache with TTL support
 * For frequently accessed data like products, categories, venues
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get cached value or execute fetcher and cache result
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 60
  ): Promise<T> {
    const existing = this.get<T>(key);
    if (existing !== null) {
      return existing;
    }

    const data = await fetcher();
    this.set(key, data, ttlSeconds);
    return data;
  }

  /**
   * Get cached value (returns null if expired or not found)
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached value with TTL
   */
  set<T>(key: string, data: T, ttlSeconds: number = 60): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Invalidate specific key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a pattern (prefix)
   */
  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate all keys for a tenant
   */
  invalidateTenant(tenantId: string): void {
    this.invalidatePattern(`tenant:${tenantId}:`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Destroy cache and cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Singleton instance
export const cache = new MemoryCache();

// Cache key builders for consistency
export const cacheKeys = {
  products: (tenantId: string) => `tenant:${tenantId}:products`,
  productsGrouped: (tenantId: string) => `tenant:${tenantId}:products:grouped`,
  categories: (tenantId: string) => `tenant:${tenantId}:categories`,
  venues: (tenantId: string) => `tenant:${tenantId}:venues`,
  venue: (tenantId: string, venueId: string) => `tenant:${tenantId}:venue:${venueId}`,
  cashRegisters: (tenantId: string, venueId: string) => `tenant:${tenantId}:venue:${venueId}:registers`,
  permissions: (tenantId: string) => `tenant:${tenantId}:permissions`,
  licenseStatus: (tenantId: string) => `tenant:${tenantId}:license`,
};

// TTL presets (in seconds)
export const cacheTTL = {
  short: 30,        // 30 seconds - for frequently changing data
  medium: 120,      // 2 minutes - for semi-static data
  long: 300,        // 5 minutes - for static reference data
  veryLong: 900,    // 15 minutes - for rarely changing data
};
