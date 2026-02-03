import { Router } from 'express';
import prisma from '../../common/database';
import { cache } from '../../common/cache';
import { asyncHandler, successResponse } from '../../common/response';

const router: Router = Router();

/**
 * GET /health
 * Basic health check
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    successResponse(res, {
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /health/db
 * Database connectivity check
 */
router.get(
  '/db',
  asyncHandler(async (_req, res) => {
    const start = Date.now();
    
    // Try a simple query
    await prisma.$queryRaw`SELECT 1`;
    
    const latency = Date.now() - start;
    
    successResponse(res, {
      status: 'ok',
      database: 'connected',
      latency: `${latency}ms`,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /health/full
 * Full system health check
 */
router.get(
  '/full',
  asyncHandler(async (_req, res) => {
    const checks: Record<string, unknown> = {
      api: { status: 'ok' },
    };
    
    // Database check
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'ok',
        latency: `${Date.now() - start}ms`,
      };
    } catch (error) {
      checks.database = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
    
    // Memory usage
    const memUsage = process.memoryUsage();
    checks.memory = {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    };

    // Cache stats
    const cacheStats = cache.stats();
    checks.cache = {
      status: 'ok',
      entries: cacheStats.size,
    };

    // Uptime
    checks.uptime = `${Math.round(process.uptime())}s`;
    
    const allOk = Object.values(checks).every(
      (check) => typeof check === 'object' && (check as any).status !== 'error'
    );
    
    successResponse(res, {
      status: allOk ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /health/cache
 * Cache statistics
 */
router.get(
  '/cache',
  asyncHandler(async (_req, res) => {
    const stats = cache.stats();
    successResponse(res, {
      status: 'ok',
      cache: {
        entries: stats.size,
        keys: stats.keys,
      },
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * DELETE /health/cache
 * Clear all cache (admin use)
 */
router.delete(
  '/cache',
  asyncHandler(async (_req, res) => {
    cache.clear();
    successResponse(res, {
      status: 'ok',
      message: 'Cache cleared',
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;