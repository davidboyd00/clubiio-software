// ============================================
// COMPRESSION MIDDLEWARE TESTS
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock logger
vi.mock('../../common/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

import {
  generateETag,
  generateWeakETag,
  etagsMatch,
  buildCacheControl,
  checkIfModifiedSince,
  checkIfUnmodifiedSince,
  addVary,
  CacheConfig,
} from '../../middleware/compression.middleware';

describe('Compression Middleware', () => {
  describe('ETag Generation', () => {
    it('should generate consistent ETag for same content', () => {
      const content = 'test content';
      const etag1 = generateETag(content);
      const etag2 = generateETag(content);

      expect(etag1).toBe(etag2);
      expect(etag1).toMatch(/^"[a-f0-9]{32}"$/);
    });

    it('should generate different ETags for different content', () => {
      const etag1 = generateETag('content 1');
      const etag2 = generateETag('content 2');

      expect(etag1).not.toBe(etag2);
    });

    it('should handle Buffer input', () => {
      const buffer = Buffer.from('test content');
      const etag = generateETag(buffer);

      expect(etag).toMatch(/^"[a-f0-9]{32}"$/);
    });

    it('should generate weak ETag', () => {
      const content = 'test content';
      const weakEtag = generateWeakETag(content);

      expect(weakEtag).toMatch(/^W\/"[a-f0-9]{16}"$/);
    });
  });

  describe('ETag Matching', () => {
    it('should match identical ETags', () => {
      const etag = '"abc123"';
      expect(etagsMatch(etag, etag)).toBe(true);
    });

    it('should not match different ETags', () => {
      expect(etagsMatch('"abc"', '"xyz"')).toBe(false);
    });

    it('should handle weak matching', () => {
      expect(etagsMatch('W/"abc"', '"abc"', true)).toBe(true);
      expect(etagsMatch('"abc"', 'W/"abc"', true)).toBe(true);
    });

    it('should fail weak matching when disabled', () => {
      expect(etagsMatch('W/"abc"', '"abc"', false)).toBe(false);
    });

    it('should return false for empty ETags', () => {
      expect(etagsMatch('', '"abc"')).toBe(false);
      expect(etagsMatch('"abc"', '')).toBe(false);
    });
  });

  describe('Cache-Control Builder', () => {
    it('should build no-store directive', () => {
      const config: CacheConfig = { noStore: true };
      const result = buildCacheControl(config);

      expect(result).toBe('no-store, no-cache, must-revalidate');
    });

    it('should build private cache with max-age', () => {
      const config: CacheConfig = {
        private: true,
        maxAge: 300,
      };
      const result = buildCacheControl(config);

      expect(result).toContain('private');
      expect(result).toContain('max-age=300');
    });

    it('should build public cache', () => {
      const config: CacheConfig = {
        private: false,
        maxAge: 3600,
      };
      const result = buildCacheControl(config);

      expect(result).toContain('public');
      expect(result).toContain('max-age=3600');
    });

    it('should include s-maxage for CDN', () => {
      const config: CacheConfig = {
        maxAge: 60,
        sMaxAge: 3600,
        private: false,
      };
      const result = buildCacheControl(config);

      expect(result).toContain('s-maxage=3600');
    });

    it('should include must-revalidate', () => {
      const config: CacheConfig = {
        maxAge: 300,
        mustRevalidate: true,
      };
      const result = buildCacheControl(config);

      expect(result).toContain('must-revalidate');
    });

    it('should include immutable', () => {
      const config: CacheConfig = {
        maxAge: 31536000,
        immutable: true,
      };
      const result = buildCacheControl(config);

      expect(result).toContain('immutable');
    });

    it('should include stale-while-revalidate', () => {
      const config: CacheConfig = {
        maxAge: 300,
        staleWhileRevalidate: 60,
      };
      const result = buildCacheControl(config);

      expect(result).toContain('stale-while-revalidate=60');
    });

    it('should include stale-if-error', () => {
      const config: CacheConfig = {
        maxAge: 300,
        staleIfError: 86400,
      };
      const result = buildCacheControl(config);

      expect(result).toContain('stale-if-error=86400');
    });

    it('should default to private', () => {
      const config: CacheConfig = { maxAge: 300 };
      const result = buildCacheControl(config);

      expect(result).toContain('private');
    });
  });

  describe('Conditional Request Helpers', () => {
    describe('checkIfModifiedSince', () => {
      let mockReq: Partial<Request>;

      beforeEach(() => {
        mockReq = { headers: {} };
      });

      it('should return true when header not present', () => {
        const lastModified = new Date();
        const result = checkIfModifiedSince(mockReq as Request, lastModified);

        expect(result).toBe(true);
      });

      it('should return true when resource was modified', () => {
        const oldDate = new Date('2024-01-01');
        const newDate = new Date('2024-01-02');
        mockReq.headers = { 'if-modified-since': oldDate.toUTCString() };

        const result = checkIfModifiedSince(mockReq as Request, newDate);

        expect(result).toBe(true);
      });

      it('should return false when resource was not modified', () => {
        const date = new Date('2024-01-01');
        mockReq.headers = { 'if-modified-since': date.toUTCString() };

        const result = checkIfModifiedSince(mockReq as Request, date);

        expect(result).toBe(false);
      });
    });

    describe('checkIfUnmodifiedSince', () => {
      let mockReq: Partial<Request>;

      beforeEach(() => {
        mockReq = { headers: {} };
      });

      it('should return true when header not present', () => {
        const lastModified = new Date();
        const result = checkIfUnmodifiedSince(mockReq as Request, lastModified);

        expect(result).toBe(true);
      });

      it('should return true when resource was not modified', () => {
        const date = new Date('2024-01-02');
        const lastModified = new Date('2024-01-01');
        mockReq.headers = { 'if-unmodified-since': date.toUTCString() };

        const result = checkIfUnmodifiedSince(mockReq as Request, lastModified);

        expect(result).toBe(true);
      });

      it('should return false when resource was modified after the date', () => {
        const oldDate = new Date('2024-01-01');
        const newDate = new Date('2024-01-02');
        mockReq.headers = { 'if-unmodified-since': oldDate.toUTCString() };

        const result = checkIfUnmodifiedSince(mockReq as Request, newDate);

        expect(result).toBe(false);
      });
    });
  });

  describe('Vary Header Helper', () => {
    let mockRes: Partial<Response>;

    beforeEach(() => {
      const headers: Record<string, string> = {};
      mockRes = {
        getHeader: vi.fn((name: string) => headers[name.toLowerCase()]),
        setHeader: vi.fn((name: string, value: string) => {
          headers[name.toLowerCase()] = value;
        }),
      } as unknown as Partial<Response>;
    });

    it('should set Vary header when not present', () => {
      addVary(mockRes as Response, 'Accept');

      expect(mockRes.setHeader).toHaveBeenCalledWith('Vary', 'Accept');
    });

    it('should handle array of fields', () => {
      addVary(mockRes as Response, ['Accept', 'Accept-Encoding']);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Vary',
        'Accept, Accept-Encoding'
      );
    });

    it('should append to existing Vary header', () => {
      // Mock existing header
      (mockRes.getHeader as ReturnType<typeof vi.fn>).mockReturnValue('Accept');

      addVary(mockRes as Response, 'Accept-Encoding');

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Vary',
        'accept, Accept-Encoding'
      );
    });

    it('should not duplicate existing fields', () => {
      (mockRes.getHeader as ReturnType<typeof vi.fn>).mockReturnValue('Accept');

      addVary(mockRes as Response, 'accept');

      // Should not call setHeader since field already exists
      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('Pre-configured Cache Policies', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {};
      mockRes = {
        setHeader: vi.fn(),
      };
      mockNext = vi.fn() as unknown as NextFunction;
    });

    it('noCache should set no-store', async () => {
      const mod = await vi.importActual<typeof import('../../middleware/compression.middleware')>(
        '../../middleware/compression.middleware'
      );
      mod.noCache(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-store, no-cache, must-revalidate'
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('shortCache should set 1 minute max-age', async () => {
      const mod = await vi.importActual<typeof import('../../middleware/compression.middleware')>(
        '../../middleware/compression.middleware'
      );
      mod.shortCache(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('max-age=60')
      );
    });

    it('standardCache should set 5 minute max-age', async () => {
      const mod = await vi.importActual<typeof import('../../middleware/compression.middleware')>(
        '../../middleware/compression.middleware'
      );
      mod.standardCache(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('max-age=300')
      );
    });

    it('longCache should set 1 hour max-age', async () => {
      const mod = await vi.importActual<typeof import('../../middleware/compression.middleware')>(
        '../../middleware/compression.middleware'
      );
      mod.longCache(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('max-age=3600')
      );
    });

    it('immutableCache should set 1 year max-age with immutable', async () => {
      const mod = await vi.importActual<typeof import('../../middleware/compression.middleware')>(
        '../../middleware/compression.middleware'
      );
      mod.immutableCache(mockReq as Request, mockRes as Response, mockNext);

      const header = (mockRes.setHeader as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(header).toContain('max-age=31536000');
      expect(header).toContain('immutable');
    });

    it('cdnCache should set both max-age and s-maxage', async () => {
      const mod = await vi.importActual<typeof import('../../middleware/compression.middleware')>(
        '../../middleware/compression.middleware'
      );
      mod.cdnCache(mockReq as Request, mockRes as Response, mockNext);

      const header = (mockRes.setHeader as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(header).toContain('max-age=60');
      expect(header).toContain('s-maxage=3600');
    });
  });
});
