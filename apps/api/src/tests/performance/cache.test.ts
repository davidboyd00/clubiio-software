import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheService, CacheTTL, CacheOptions } from '../../common/cache/cache.service';

// ============================================
// CACHE SERVICE TESTS
// ============================================
// Tests for caching abstraction layer
// Note: These tests use mocked Redis for unit testing

// Mock Redis client
const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  ttl: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  mget: vi.fn(),
  smembers: vi.fn(),
  sadd: vi.fn(),
  scan: vi.fn(),
  flushdb: vi.fn(),
  pipeline: vi.fn(() => ({
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    setex: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    sadd: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([[null, 1]]),
  })),
};

// Mock Redis service
const mockRedisService = {
  getClient: vi.fn(() => mockRedisClient),
  isHealthy: vi.fn().mockResolvedValue(true),
};

describe('Cache Service', () => {
  let cache: CacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new CacheService(mockRedisService as any);
  });

  // ─────────────────────────────────────────
  // BASIC OPERATIONS
  // ─────────────────────────────────────────
  describe('Basic Operations', () => {
    it('should get a cached value', async () => {
      const testData = { id: 1, name: 'Test' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cache.get<typeof testData>('test-key');

      expect(result).toEqual(testData);
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null for missing key', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cache.get('missing-key');

      expect(result).toBeNull();
    });

    it('should set a value with TTL', async () => {
      const testData = { id: 1 };
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await cache.set('test-key', testData, { ttl: 300 });

      expect(result).toBe(true);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-key',
        300,
        JSON.stringify(testData)
      );
    });

    it('should delete a key', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await cache.del('test-key');

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
    });

    it('should check key existence', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await cache.exists('test-key');

      expect(result).toBe(true);
    });

    it('should get TTL of a key', async () => {
      mockRedisClient.ttl.mockResolvedValue(120);

      const result = await cache.ttl('test-key');

      expect(result).toBe(120);
    });
  });

  // ─────────────────────────────────────────
  // CACHE-ASIDE PATTERN
  // ─────────────────────────────────────────
  describe('Cache-Aside Pattern (getOrSet)', () => {
    it('should return cached value if exists', async () => {
      const cachedData = { id: 1, name: 'Cached' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const factory = vi.fn().mockResolvedValue({ id: 2, name: 'Fresh' });

      const result = await cache.getOrSet('test-key', factory);

      expect(result).toEqual(cachedData);
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result on miss', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue('OK');

      const freshData = { id: 2, name: 'Fresh' };
      const factory = vi.fn().mockResolvedValue(freshData);

      const result = await cache.getOrSet('test-key', factory, { ttl: 300 });

      expect(result).toEqual(freshData);
      expect(factory).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // KEY PREFIX
  // ─────────────────────────────────────────
  describe('Key Prefix', () => {
    it('should apply prefix to keys', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await cache.get('my-key', { prefix: 'users' });

      expect(mockRedisClient.get).toHaveBeenCalledWith('users:my-key');
    });

    it('should work without prefix', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await cache.get('my-key');

      expect(mockRedisClient.get).toHaveBeenCalledWith('my-key');
    });
  });

  // ─────────────────────────────────────────
  // COUNTERS
  // ─────────────────────────────────────────
  describe('Counters', () => {
    it('should increment a counter', async () => {
      mockRedisClient.incr.mockResolvedValue(5);

      const result = await cache.incr('counter');

      expect(result).toBe(5);
      expect(mockRedisClient.incr).toHaveBeenCalledWith('counter');
    });

    it('should increment with expiration', async () => {
      const result = await cache.incrEx('counter', 3600);

      expect(result).toBe(1);
    });
  });

  // ─────────────────────────────────────────
  // BATCH OPERATIONS
  // ─────────────────────────────────────────
  describe('Batch Operations', () => {
    it('should get multiple keys at once', async () => {
      mockRedisClient.mget.mockResolvedValue([
        JSON.stringify({ id: 1 }),
        null,
        JSON.stringify({ id: 3 }),
      ]);

      const result = await cache.mget<{ id: number }>(['key1', 'key2', 'key3']);

      expect(result.get('key1')).toEqual({ id: 1 });
      expect(result.get('key2')).toBeNull();
      expect(result.get('key3')).toEqual({ id: 3 });
    });

    it('should set multiple keys at once', async () => {
      const entries = [
        { key: 'key1', value: { id: 1 }, ttl: 300 },
        { key: 'key2', value: { id: 2 }, ttl: 600 },
      ];

      const result = await cache.mset(entries);

      expect(result).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // STATISTICS
  // ─────────────────────────────────────────
  describe('Statistics', () => {
    it('should track cache hits', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ data: 'test' }));

      await cache.get('key1');
      await cache.get('key2');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(0);
    });

    it('should track cache misses', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await cache.get('missing1');
      await cache.get('missing2');
      await cache.get('missing3');

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(3);
    });

    it('should calculate hit rate', async () => {
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ data: 'hit' }))
        .mockResolvedValueOnce(JSON.stringify({ data: 'hit' }))
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await cache.get('key1');
      await cache.get('key2');
      await cache.get('key3');
      await cache.get('key4');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should reset statistics', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ data: 'test' }));
      await cache.get('key');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // ERROR HANDLING
  // ─────────────────────────────────────────
  describe('Error Handling', () => {
    it('should return null on get error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await cache.get('key');

      expect(result).toBeNull();
    });

    it('should return false on set error', async () => {
      mockRedisClient.setex.mockRejectedValue(new Error('Redis error'));

      const result = await cache.set('key', { data: 'test' });

      expect(result).toBe(false);
    });

    it('should count errors as misses', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      await cache.get('key');

      const stats = cache.getStats();
      expect(stats.misses).toBe(1);
    });
  });
});

describe('Cache TTL Presets', () => {
  it('should have correct TTL values', () => {
    expect(CacheTTL.SHORT).toBe(60);
    expect(CacheTTL.MEDIUM).toBe(300);
    expect(CacheTTL.LONG).toBe(3600);
    expect(CacheTTL.VERY_LONG).toBe(86400);
    expect(CacheTTL.SESSION).toBe(1800);
    expect(CacheTTL.USER).toBe(600);
    expect(CacheTTL.CONFIG).toBe(3600);
    expect(CacheTTL.LIST).toBe(120);
  });
});

describe('Cache Use Cases', () => {
  let cache: CacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new CacheService(mockRedisService as any);
  });

  it('should cache user data with appropriate TTL', async () => {
    mockRedisClient.setex.mockResolvedValue('OK');

    const userData = { id: 'user-123', name: 'John', email: 'john@example.com' };
    const options: CacheOptions = {
      ttl: CacheTTL.USER,
      prefix: 'users',
      tags: ['user:user-123'],
    };

    await cache.set('user-123', userData, options);

    expect(mockRedisClient.setex).toHaveBeenCalledWith(
      'users:user-123',
      CacheTTL.USER,
      JSON.stringify(userData)
    );
  });

  it('should cache list queries with short TTL', async () => {
    mockRedisClient.setex.mockResolvedValue('OK');

    const listData = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const options: CacheOptions = {
      ttl: CacheTTL.LIST,
      prefix: 'orders',
    };

    await cache.set('list:tenant-abc:page-1', listData, options);

    expect(mockRedisClient.setex).toHaveBeenCalledWith(
      'orders:list:tenant-abc:page-1',
      CacheTTL.LIST,
      JSON.stringify(listData)
    );
  });

  it('should cache configuration with long TTL', async () => {
    mockRedisClient.setex.mockResolvedValue('OK');

    const configData = { feature1: true, feature2: false };
    const options: CacheOptions = {
      ttl: CacheTTL.CONFIG,
      prefix: 'config',
    };

    await cache.set('features', configData, options);

    expect(mockRedisClient.setex).toHaveBeenCalledWith(
      'config:features',
      CacheTTL.CONFIG,
      JSON.stringify(configData)
    );
  });
});
