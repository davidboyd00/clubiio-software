// ============================================
// BATCH LOADER
// ============================================
// Utilities for batching database queries to prevent N+1 problems

import { logger } from '../logger';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export type BatchLoadFn<K, V> = (keys: K[]) => Promise<Map<K, V>>;

interface QueuedRequest<K, V> {
  key: K;
  resolve: (value: V | null) => void;
  reject: (error: Error) => void;
}

// ─────────────────────────────────────────
// BATCH LOADER CLASS
// ─────────────────────────────────────────

/**
 * BatchLoader - Groups individual load requests into batched queries
 *
 * @example
 * ```typescript
 * const userLoader = new BatchLoader(async (ids: string[]) => {
 *   const users = await prisma.user.findMany({ where: { id: { in: ids } } });
 *   return new Map(users.map(u => [u.id, u]));
 * });
 *
 * // These will be batched into a single query
 * const [user1, user2, user3] = await Promise.all([
 *   userLoader.load('id-1'),
 *   userLoader.load('id-2'),
 *   userLoader.load('id-3'),
 * ]);
 * ```
 */
export class BatchLoader<K, V> {
  private queue: QueuedRequest<K, V>[] = [];
  private cache: Map<K, V> = new Map();
  private batchFn: BatchLoadFn<K, V>;
  private maxBatchSize: number;
  private batchDelayMs: number;
  private scheduledBatch: NodeJS.Timeout | null = null;
  private useCache: boolean;

  constructor(
    batchFn: BatchLoadFn<K, V>,
    options: {
      maxBatchSize?: number;
      batchDelayMs?: number;
      cache?: boolean;
    } = {}
  ) {
    this.batchFn = batchFn;
    this.maxBatchSize = options.maxBatchSize ?? 100;
    this.batchDelayMs = options.batchDelayMs ?? 0;
    this.useCache = options.cache ?? true;
  }

  /**
   * Load a single item by key
   */
  async load(key: K): Promise<V | null> {
    // Check cache first
    if (this.useCache && this.cache.has(key)) {
      return this.cache.get(key) ?? null;
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ key, resolve, reject });
      this.scheduleBatch();
    });
  }

  /**
   * Load multiple items by keys
   */
  async loadMany(keys: K[]): Promise<Array<V | null>> {
    return Promise.all(keys.map((key) => this.load(key)));
  }

  /**
   * Prime the cache with a known value
   */
  prime(key: K, value: V): void {
    if (this.useCache) {
      this.cache.set(key, value);
    }
  }

  /**
   * Clear a specific key from cache
   */
  clear(key: K): void {
    this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clearAll(): void {
    this.cache.clear();
  }

  private scheduleBatch(): void {
    // If already scheduled, don't reschedule
    if (this.scheduledBatch !== null) {
      return;
    }

    // If batch delay is 0 or queue is full, execute immediately
    if (this.batchDelayMs === 0 || this.queue.length >= this.maxBatchSize) {
      this.executeBatch();
      return;
    }

    // Schedule batch execution
    this.scheduledBatch = setTimeout(() => {
      this.scheduledBatch = null;
      this.executeBatch();
    }, this.batchDelayMs);
  }

  private async executeBatch(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    // Take items from queue (up to maxBatchSize)
    const batch = this.queue.splice(0, this.maxBatchSize);
    const keys = [...new Set(batch.map((item) => item.key))];

    try {
      const startTime = Date.now();
      const results = await this.batchFn(keys);
      const duration = Date.now() - startTime;

      if (duration > 100) {
        logger.debug('BatchLoader query', {
          keys: keys.length,
          duration: `${duration}ms`,
        });
      }

      // Resolve all queued requests
      for (const request of batch) {
        const value = results.get(request.key) ?? null;

        // Update cache
        if (this.useCache && value !== null) {
          this.cache.set(request.key, value);
        }

        request.resolve(value);
      }
    } catch (error) {
      // Reject all queued requests
      for (const request of batch) {
        request.reject(error as Error);
      }
    }

    // If there are more items in queue, schedule another batch
    if (this.queue.length > 0) {
      this.scheduleBatch();
    }
  }
}

// ─────────────────────────────────────────
// FACTORY HELPERS
// ─────────────────────────────────────────

/**
 * Create a batch loader for Prisma findMany queries
 */
export function createPrismaLoader<T extends { id: string }>(
  findMany: (args: { where: { id: { in: string[] } } }) => Promise<T[]>,
  options?: { maxBatchSize?: number; cache?: boolean }
): BatchLoader<string, T> {
  return new BatchLoader(
    async (ids: string[]) => {
      const items = await findMany({ where: { id: { in: ids } } });
      return new Map(items.map((item) => [item.id, item]));
    },
    options
  );
}

/**
 * Create a batch loader with custom key extractor
 */
export function createLoader<K, V>(
  findMany: (keys: K[]) => Promise<V[]>,
  keyExtractor: (item: V) => K,
  options?: { maxBatchSize?: number; cache?: boolean }
): BatchLoader<K, V> {
  return new BatchLoader(
    async (keys: K[]) => {
      const items = await findMany(keys);
      return new Map(items.map((item) => [keyExtractor(item), item]));
    },
    options
  );
}

// ─────────────────────────────────────────
// REQUEST-SCOPED LOADERS
// ─────────────────────────────────────────

/**
 * Create a loader factory that creates new loaders per request
 * This prevents cache from being shared across requests
 */
export function createLoaderFactory<K, V>(
  batchFn: BatchLoadFn<K, V>,
  options?: { maxBatchSize?: number }
): () => BatchLoader<K, V> {
  return () => new BatchLoader(batchFn, { ...options, cache: true });
}
