// ============================================
// REDIS SERVICE
// ============================================
// Redis connection management and health monitoring

import Redis, { RedisOptions } from 'ioredis';
import { logger } from '../logger';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
  retryDelayMs?: number;
  connectionTimeoutMs?: number;
  commandTimeoutMs?: number;
  enableOfflineQueue?: boolean;
  lazyConnect?: boolean;
}

const DEFAULT_CONFIG: Partial<RedisConfig> = {
  host: 'localhost',
  port: 6379,
  db: 0,
  keyPrefix: 'clubio:',
  maxRetriesPerRequest: 3,
  retryDelayMs: 100,
  connectionTimeoutMs: 10000,
  commandTimeoutMs: 5000,
  enableOfflineQueue: true,
  lazyConnect: false,
};

/**
 * Redis Service
 * Manages Redis connections with health monitoring and graceful handling
 */
export class RedisService {
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private config: RedisConfig;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(config: Partial<RedisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as RedisConfig;
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.initializeConnection();
    return this.connectionPromise;
  }

  private async initializeConnection(): Promise<void> {
    const options: RedisOptions = {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      keyPrefix: this.config.keyPrefix,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      connectTimeout: this.config.connectionTimeoutMs,
      commandTimeout: this.config.commandTimeoutMs,
      enableOfflineQueue: this.config.enableOfflineQueue,
      lazyConnect: this.config.lazyConnect,
      retryStrategy: (times: number) => {
        if (times > 10) {
          logger.error('Redis: Max retry attempts reached');
          return null; // Stop retrying
        }
        const delay = Math.min(times * this.config.retryDelayMs!, 3000);
        logger.warn(`Redis: Retrying connection in ${delay}ms (attempt ${times})`);
        return delay;
      },
    };

    this.client = new Redis(options);

    this.setupEventHandlers(this.client, 'main');

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, this.config.connectionTimeoutMs);

      this.client!.once('ready', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        logger.info('Redis: Connected successfully', {
          host: this.config.host,
          port: this.config.port,
          db: this.config.db,
        });
        resolve();
      });

      this.client!.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private setupEventHandlers(client: Redis, name: string): void {
    client.on('connect', () => {
      logger.debug(`Redis ${name}: Connecting...`);
    });

    client.on('ready', () => {
      this.isConnected = true;
      logger.info(`Redis ${name}: Ready`);
    });

    client.on('error', (err) => {
      logger.error(`Redis ${name}: Error`, { error: err.message });
    });

    client.on('close', () => {
      this.isConnected = false;
      logger.warn(`Redis ${name}: Connection closed`);
    });

    client.on('reconnecting', () => {
      logger.info(`Redis ${name}: Reconnecting...`);
    });

    client.on('end', () => {
      this.isConnected = false;
      logger.info(`Redis ${name}: Connection ended`);
    });
  }

  /**
   * Get the Redis client (for direct access if needed)
   */
  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis not connected. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Get a dedicated subscriber client for pub/sub
   */
  async getSubscriber(): Promise<Redis> {
    if (!this.subscriber) {
      this.subscriber = this.client!.duplicate();
      this.setupEventHandlers(this.subscriber, 'subscriber');
    }
    return this.subscriber;
  }

  /**
   * Check if Redis is connected and healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; ready: boolean } {
    return {
      connected: this.isConnected,
      ready: this.client?.status === 'ready',
    };
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }

    if (this.client) {
      await this.client.quit();
      this.client = null;
    }

    this.isConnected = false;
    this.connectionPromise = null;
    logger.info('Redis: Disconnected');
  }

  /**
   * Get Redis info for monitoring
   */
  async getInfo(): Promise<Record<string, string>> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }

    const info = await this.client.info();
    const result: Record<string, string> = {};

    info.split('\n').forEach((line) => {
      const [key, value] = line.split(':');
      if (key && value) {
        result[key.trim()] = value.trim();
      }
    });

    return result;
  }
}

// Parse Redis URL (for environments like Railway, Render, etc.)
export function parseRedisUrl(url: string): Partial<RedisConfig> {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1)) || 0 : 0,
    };
  } catch {
    throw new Error(`Invalid Redis URL: ${url}`);
  }
}

// Create singleton instance
let redisService: RedisService | null = null;

export function getRedisService(): RedisService {
  if (!redisService) {
    const config: Partial<RedisConfig> = {};

    // Check for Redis URL (common in PaaS environments)
    if (process.env.REDIS_URL) {
      Object.assign(config, parseRedisUrl(process.env.REDIS_URL));
    } else {
      config.host = process.env.REDIS_HOST || 'localhost';
      config.port = parseInt(process.env.REDIS_PORT || '6379');
      config.password = process.env.REDIS_PASSWORD;
      config.db = parseInt(process.env.REDIS_DB || '0');
    }

    config.keyPrefix = process.env.REDIS_PREFIX || 'clubio:';

    redisService = new RedisService(config);
  }

  return redisService;
}

export async function initializeRedis(): Promise<RedisService> {
  const service = getRedisService();
  await service.connect();
  return service;
}

export async function shutdownRedis(): Promise<void> {
  if (redisService) {
    await redisService.disconnect();
    redisService = null;
  }
}
