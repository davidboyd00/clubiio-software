// ============================================
// PAGINATION UTILITIES
// ============================================
// Cursor-based and offset pagination helpers

import { z } from 'zod';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface CursorPaginatedResult<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

// ─────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─────────────────────────────────────────
// OFFSET PAGINATION
// ─────────────────────────────────────────

/**
 * Calculate skip/take values for Prisma offset pagination
 */
export function getOffsetPagination(params: PaginationParams): {
  skip: number;
  take: number;
  page: number;
  limit: number;
} {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));

  return {
    skip: (page - 1) * limit,
    take: limit,
    page,
    limit,
  };
}

/**
 * Build paginated response with metadata
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

// ─────────────────────────────────────────
// CURSOR PAGINATION
// ─────────────────────────────────────────

/**
 * Encode cursor (usually the last item's ID)
 */
export function encodeCursor(value: string | number): string {
  return Buffer.from(String(value)).toString('base64url');
}

/**
 * Decode cursor back to original value
 */
export function decodeCursor(cursor: string): string {
  try {
    return Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw new Error('Invalid cursor');
  }
}

/**
 * Get cursor pagination params for Prisma
 */
export function getCursorPagination(
  cursor?: string,
  limit: number = 20
): {
  take: number;
  skip?: number;
  cursor?: { id: string };
} {
  const take = Math.min(100, Math.max(1, limit));

  if (!cursor) {
    return { take };
  }

  const decodedCursor = decodeCursor(cursor);

  return {
    take,
    skip: 1, // Skip the cursor item itself
    cursor: { id: decodedCursor },
  };
}

/**
 * Build cursor paginated response
 */
export function buildCursorResponse<T extends { id: string }>(
  data: T[],
  limit: number
): CursorPaginatedResult<T> {
  const hasMore = data.length === limit;
  const lastItem = data[data.length - 1];
  const cursor = lastItem ? encodeCursor(lastItem.id) : null;

  return {
    data,
    pagination: {
      cursor,
      hasMore,
      limit,
    },
  };
}

// ─────────────────────────────────────────
// KEYSET PAGINATION (for sorted results)
// ─────────────────────────────────────────

export interface KeysetCursor {
  id: string;
  sortValue: string | number | Date;
}

/**
 * Encode keyset cursor (ID + sort value)
 */
export function encodeKeysetCursor(cursor: KeysetCursor): string {
  const value = JSON.stringify({
    id: cursor.id,
    sv: cursor.sortValue instanceof Date ? cursor.sortValue.toISOString() : cursor.sortValue,
  });
  return Buffer.from(value).toString('base64url');
}

/**
 * Decode keyset cursor
 */
export function decodeKeysetCursor(cursor: string): KeysetCursor {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);
    return {
      id: parsed.id,
      sortValue: parsed.sv,
    };
  } catch {
    throw new Error('Invalid keyset cursor');
  }
}

// ─────────────────────────────────────────
// PAGINATION MIDDLEWARE HELPER
// ─────────────────────────────────────────

/**
 * Parse pagination from query string
 */
export function parsePaginationQuery(query: Record<string, unknown>): PaginationParams {
  return {
    page: query.page ? Number(query.page) : undefined,
    limit: query.limit ? Number(query.limit) : undefined,
    cursor: query.cursor as string | undefined,
  };
}
