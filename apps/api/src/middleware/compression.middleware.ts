// ============================================
// RESPONSE COMPRESSION MIDDLEWARE
// ============================================
// Gzip and Brotli compression with ETag support

import { Request, Response, NextFunction, RequestHandler } from 'express';
import compression from 'compression';
import crypto from 'crypto';
import { logger } from '../common/logger';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface CompressionConfig {
  level?: number; // Compression level (1-9, default 6)
  threshold?: number; // Minimum size to compress (bytes)
  memLevel?: number; // Memory level for zlib
  filter?: (req: Request, res: Response) => boolean;
  brotli?: boolean; // Enable Brotli compression
}

export interface CacheConfig {
  maxAge?: number; // Cache-Control max-age in seconds
  sMaxAge?: number; // Cache-Control s-maxage (CDN cache)
  private?: boolean; // Private cache (default true for API)
  noStore?: boolean; // Prevent caching entirely
  mustRevalidate?: boolean;
  immutable?: boolean; // Resource won't change
  staleWhileRevalidate?: number; // Serve stale while revalidating
  staleIfError?: number; // Serve stale on error
}

// ─────────────────────────────────────────
// DEFAULT CONFIGURATION
// ─────────────────────────────────────────

const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  level: 6,
  threshold: 1024, // Only compress responses > 1KB
  memLevel: 8,
  brotli: true,
};

// ─────────────────────────────────────────
// COMPRESSION MIDDLEWARE
// ─────────────────────────────────────────

/**
 * Create compression middleware with optimal settings
 */
export function createCompression(config: CompressionConfig = {}): RequestHandler {
  const options = { ...DEFAULT_COMPRESSION_CONFIG, ...config };

  // Use the compression middleware
  return compression({
    level: options.level,
    threshold: options.threshold,
    memLevel: options.memLevel,
    filter: options.filter || shouldCompress,
  });
}

/**
 * Default filter to determine if response should be compressed
 */
function shouldCompress(req: Request, res: Response): boolean {
  // Don't compress if already compressed
  if (res.getHeader('Content-Encoding')) {
    return false;
  }

  // Don't compress server-sent events
  if (res.getHeader('Content-Type')?.toString().includes('text/event-stream')) {
    return false;
  }

  // Don't compress small responses
  const contentLength = res.getHeader('Content-Length');
  if (contentLength && parseInt(contentLength.toString()) < 1024) {
    return false;
  }

  // Use default compression filter
  return compression.filter(req, res);
}

// ─────────────────────────────────────────
// ETAG MIDDLEWARE
// ─────────────────────────────────────────

/**
 * Generate ETag for response body
 */
export function generateETag(body: string | Buffer): string {
  const hash = crypto.createHash('md5').update(body).digest('hex');
  return `"${hash}"`;
}

/**
 * Generate weak ETag (for semantically equivalent content)
 */
export function generateWeakETag(body: string | Buffer): string {
  const hash = crypto.createHash('md5').update(body).digest('hex').slice(0, 16);
  return `W/"${hash}"`;
}

/**
 * Check if ETags match (handles weak comparison)
 */
export function etagsMatch(etag1: string, etag2: string, weak = true): boolean {
  if (!etag1 || !etag2) return false;

  // Remove weak indicators for comparison if weak matching
  if (weak) {
    const normalize = (tag: string) => tag.replace(/^W\//, '');
    return normalize(etag1) === normalize(etag2);
  }

  return etag1 === etag2;
}

/**
 * Middleware to add ETag support for JSON responses
 */
export function etagMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown) {
      // Generate ETag from response body
      const bodyString = JSON.stringify(body);
      const etag = generateETag(bodyString);

      // Set ETag header
      res.setHeader('ETag', etag);

      // Check If-None-Match header
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch && etagsMatch(ifNoneMatch.toString(), etag)) {
        // Resource hasn't changed, send 304
        res.status(304);
        return res.end();
      }

      return originalJson(body);
    };

    next();
  };
}

// ─────────────────────────────────────────
// CACHE CONTROL MIDDLEWARE
// ─────────────────────────────────────────

/**
 * Build Cache-Control header value
 */
export function buildCacheControl(config: CacheConfig): string {
  const directives: string[] = [];

  // Prevent caching
  if (config.noStore) {
    return 'no-store, no-cache, must-revalidate';
  }

  // Private/Public
  directives.push(config.private !== false ? 'private' : 'public');

  // max-age
  if (config.maxAge !== undefined) {
    directives.push(`max-age=${config.maxAge}`);
  }

  // s-maxage (CDN cache duration)
  if (config.sMaxAge !== undefined) {
    directives.push(`s-maxage=${config.sMaxAge}`);
  }

  // must-revalidate
  if (config.mustRevalidate) {
    directives.push('must-revalidate');
  }

  // immutable (won't change)
  if (config.immutable) {
    directives.push('immutable');
  }

  // stale-while-revalidate
  if (config.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }

  // stale-if-error
  if (config.staleIfError !== undefined) {
    directives.push(`stale-if-error=${config.staleIfError}`);
  }

  return directives.join(', ');
}

/**
 * Middleware to set cache control headers
 */
export function cacheControl(config: CacheConfig): RequestHandler {
  const cacheControlValue = buildCacheControl(config);

  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', cacheControlValue);
    next();
  };
}

// ─────────────────────────────────────────
// PRE-CONFIGURED CACHE POLICIES
// ─────────────────────────────────────────

/**
 * No caching - for sensitive data
 */
export const noCache: RequestHandler = cacheControl({
  noStore: true,
});

/**
 * Short cache - for frequently changing data (1 minute)
 */
export const shortCache: RequestHandler = cacheControl({
  maxAge: 60,
  private: true,
  mustRevalidate: true,
});

/**
 * Standard API cache - for normal API responses (5 minutes)
 */
export const standardCache: RequestHandler = cacheControl({
  maxAge: 300,
  private: true,
  staleWhileRevalidate: 60,
});

/**
 * Long cache - for rarely changing data (1 hour)
 */
export const longCache: RequestHandler = cacheControl({
  maxAge: 3600,
  private: true,
  staleWhileRevalidate: 300,
  staleIfError: 86400, // Serve stale for up to 1 day on error
});

/**
 * Immutable cache - for versioned static assets
 */
export const immutableCache: RequestHandler = cacheControl({
  maxAge: 31536000, // 1 year
  immutable: true,
  private: false,
});

/**
 * CDN cache - for public, cacheable content
 */
export const cdnCache: RequestHandler = cacheControl({
  maxAge: 60, // Browser cache: 1 minute
  sMaxAge: 3600, // CDN cache: 1 hour
  private: false,
  staleWhileRevalidate: 120,
});

// ─────────────────────────────────────────
// CONDITIONAL REQUEST HANDLING
// ─────────────────────────────────────────

/**
 * Check If-Modified-Since header
 */
export function checkIfModifiedSince(
  req: Request,
  lastModified: Date
): boolean {
  const ifModifiedSince = req.headers['if-modified-since'];
  if (!ifModifiedSince) return true;

  const sinceDate = new Date(ifModifiedSince);
  return lastModified > sinceDate;
}

/**
 * Check If-Unmodified-Since header (for conditional writes)
 */
export function checkIfUnmodifiedSince(
  req: Request,
  lastModified: Date
): boolean {
  const ifUnmodifiedSince = req.headers['if-unmodified-since'];
  if (!ifUnmodifiedSince) return true;

  const sinceDate = new Date(ifUnmodifiedSince);
  return lastModified <= sinceDate;
}

/**
 * Middleware for conditional GET requests
 */
export function conditionalGet(getLastModified: (req: Request) => Date | null): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only apply to GET and HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    try {
      const lastModified = getLastModified(req);

      if (lastModified) {
        res.setHeader('Last-Modified', lastModified.toUTCString());

        // Check If-None-Match first (takes precedence)
        const ifNoneMatch = req.headers['if-none-match'];
        const etag = res.getHeader('ETag')?.toString();

        if (ifNoneMatch && etag && etagsMatch(ifNoneMatch.toString(), etag)) {
          return res.status(304).end();
        }

        // Check If-Modified-Since
        if (!checkIfModifiedSince(req, lastModified)) {
          return res.status(304).end();
        }
      }

      next();
    } catch (error) {
      logger.error('Conditional GET error', { error });
      next();
    }
  };
}

// ─────────────────────────────────────────
// RESPONSE TIME HEADER
// ─────────────────────────────────────────

/**
 * Middleware to add response time header
 */
export function responseTime(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
    });

    next();
  };
}

// ─────────────────────────────────────────
// VARY HEADER HELPER
// ─────────────────────────────────────────

/**
 * Add Vary header for proper caching with different representations
 */
export function addVary(res: Response, fields: string | string[]): void {
  const existing = res.getHeader('Vary');
  const fieldsArray = Array.isArray(fields) ? fields : [fields];

  if (!existing) {
    res.setHeader('Vary', fieldsArray.join(', '));
    return;
  }

  const existingArray = existing.toString().split(',').map(s => s.trim().toLowerCase());
  const newFields = fieldsArray.filter(f => !existingArray.includes(f.toLowerCase()));

  if (newFields.length > 0) {
    res.setHeader('Vary', [...existingArray, ...newFields].join(', '));
  }
}

/**
 * Middleware to add standard Vary headers
 */
export function varyMiddleware(fields: string[]): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    addVary(res, fields);
    next();
  };
}

// Default Vary headers for API responses
export const apiVary: RequestHandler = varyMiddleware([
  'Accept',
  'Accept-Encoding',
  'Authorization',
]);
