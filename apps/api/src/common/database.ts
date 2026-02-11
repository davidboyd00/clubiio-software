// ============================================
// DATABASE SERVICE
// ============================================
// Prisma client with optimized connection pooling for Neon

import { PrismaClient, Prisma } from '@prisma/client';
import { config } from '../config';
import { logger } from './logger';

// ─────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────

export interface DatabaseConfig {
  maxRetries: number;
  retryDelayMs: number;
  queryTimeoutMs: number;
  slowQueryThresholdMs: number;
  connectionTimeoutMs: number;
  poolSize: number;
}

const DEFAULT_CONFIG: DatabaseConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  queryTimeoutMs: 30000, // 30 seconds
  slowQueryThresholdMs: 1000, // 1 second
  connectionTimeoutMs: 10000, // 10 seconds
  poolSize: 10, // Default pool size
};

// Environment-based configuration
const getConfig = (): DatabaseConfig => {
  const envPoolSize = process.env.DATABASE_POOL_SIZE;
  const envQueryTimeout = process.env.DATABASE_QUERY_TIMEOUT_MS;
  const envSlowQueryThreshold = process.env.DATABASE_SLOW_QUERY_MS;

  return {
    ...DEFAULT_CONFIG,
    poolSize: envPoolSize ? parseInt(envPoolSize) : DEFAULT_CONFIG.poolSize,
    queryTimeoutMs: envQueryTimeout ? parseInt(envQueryTimeout) : DEFAULT_CONFIG.queryTimeoutMs,
    slowQueryThresholdMs: envSlowQueryThreshold ? parseInt(envSlowQueryThreshold) : DEFAULT_CONFIG.slowQueryThresholdMs,
  };
};

// ─────────────────────────────────────────
// GLOBAL SINGLETON
// ─────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  dbMetrics: DatabaseMetrics | undefined;
};

// ─────────────────────────────────────────
// METRICS
// ─────────────────────────────────────────

export interface DatabaseMetrics {
  totalQueries: number;
  failedQueries: number;
  slowQueries: number;
  totalRetries: number;
  averageQueryTimeMs: number;
  lastQueryTime: Date | null;
}

let metrics: DatabaseMetrics = {
  totalQueries: 0,
  failedQueries: 0,
  slowQueries: 0,
  totalRetries: 0,
  averageQueryTimeMs: 0,
  lastQueryTime: null,
};

// ─────────────────────────────────────────
// CLIENT CREATION
// ─────────────────────────────────────────

const createPrismaClient = (): PrismaClient => {
  const dbConfig = getConfig();

  // Determine log level based on environment
  const logLevels: Prisma.LogLevel[] = config.isDev
    ? ['query', 'error', 'warn']
    : ['error'];

  // Create client with optimized settings
  const client = new PrismaClient({
    log: logLevels.map((level) => ({
      emit: 'event' as const,
      level,
    })),
  });

  // ─────────────────────────────────────────
  // LOGGING EVENTS
  // ─────────────────────────────────────────

  // Log queries in development
  if (config.isDev) {
    client.$on('query' as never, (e: Prisma.QueryEvent) => {
      const duration = e.duration;

      if (duration > dbConfig.slowQueryThresholdMs) {
        logger.warn('Slow query detected', {
          query: e.query.substring(0, 200),
          duration: `${duration}ms`,
          params: e.params,
        });
        metrics.slowQueries++;
      }
    });
  }

  // Log errors
  client.$on('error' as never, (e: Prisma.LogEvent) => {
    logger.error('Database error', { message: e.message });
  });

  // Log warnings
  client.$on('warn' as never, (e: Prisma.LogEvent) => {
    logger.warn('Database warning', { message: e.message });
  });

  // ─────────────────────────────────────────
  // MIDDLEWARE: RETRY LOGIC
  // ─────────────────────────────────────────

  client.$use(async (params, next) => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= dbConfig.maxRetries; attempt++) {
      try {
        const start = Date.now();
        const result = await next(params);
        const duration = Date.now() - start;

        // Update metrics
        metrics.totalQueries++;
        metrics.lastQueryTime = new Date();
        metrics.averageQueryTimeMs =
          (metrics.averageQueryTimeMs * (metrics.totalQueries - 1) + duration) /
          metrics.totalQueries;

        // Log slow queries in production
        if (!config.isDev && duration > dbConfig.slowQueryThresholdMs) {
          logger.warn('Slow query', {
            model: params.model,
            action: params.action,
            duration: `${duration}ms`,
          });
          metrics.slowQueries++;
        }

        return result;
      } catch (error: unknown) {
        lastError = error as Error;
        const errorMessage = (error as Error).message || '';

        // Check if error is retryable (connection issues)
        const isRetryable =
          errorMessage.includes("Can't reach database server") ||
          errorMessage.includes('Connection refused') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('connection') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('TLS') ||
          (error as { code?: string }).code === 'P1001' || // Can't reach database
          (error as { code?: string }).code === 'P1002' || // Database timeout
          (error as { code?: string }).code === 'P1008' || // Operations timed out
          (error as { code?: string }).code === 'P1017';   // Server closed connection

        if (isRetryable && attempt < dbConfig.maxRetries) {
          const delay = dbConfig.retryDelayMs * attempt;
          logger.warn('Database connection error, retrying', {
            attempt,
            maxRetries: dbConfig.maxRetries,
            delay: `${delay}ms`,
            error: errorMessage,
          });
          metrics.totalRetries++;
          await sleep(delay);
          continue;
        }

        // Non-retryable error or max retries reached
        metrics.failedQueries++;
        throw error;
      }
    }

    throw lastError;
  });

  return client;
};

// ─────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!config.isProd) {
  globalForPrisma.prisma = prisma;
}

export default prisma;

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────

export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      healthy: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

// ─────────────────────────────────────────
// METRICS
// ─────────────────────────────────────────

export function getDatabaseMetrics(): DatabaseMetrics {
  return { ...metrics };
}

export function resetDatabaseMetrics(): void {
  metrics = {
    totalQueries: 0,
    failedQueries: 0,
    slowQueries: 0,
    totalRetries: 0,
    averageQueryTimeMs: 0,
    lastQueryTime: null,
  };
}

// ─────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────

export async function disconnectDatabase(): Promise<void> {
  logger.info('Disconnecting from database...');
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

// ─────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with a timeout
 * Useful for wrapping long-running queries
 */
export async function withQueryTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs?: number
): Promise<T> {
  const dbConfig = getConfig();
  const timeout = timeoutMs ?? dbConfig.queryTimeoutMs;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Query timeout after ${timeout}ms`));
    }, timeout);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Execute a transaction with timeout
 */
export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number; maxWait?: number }
): Promise<T> {
  const dbConfig = getConfig();

  return prisma.$transaction(fn, {
    timeout: options?.timeout ?? dbConfig.queryTimeoutMs,
    maxWait: options?.maxWait ?? dbConfig.connectionTimeoutMs,
  });
}
