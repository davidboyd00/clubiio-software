import { Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';

// Extend Express Request to include user and tenant info
export interface AuthenticatedRequest extends Request {
  user?: User;
  tenantId?: string;
  venueId?: string;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export function successResponse<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({
    success: true,
    data,
  });
}

export function errorResponse(
  res: Response,
  error: string,
  status = 400
): Response {
  return res.status(status).json({
    success: false,
    error,
  });
}

export function createdResponse<T>(res: Response, data: T): Response {
  return successResponse(res, data, 201);
}

export function noContentResponse(res: Response): Response {
  return res.status(204).send();
}

// Async handler wrapper to catch errors
export function asyncHandler(
  fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthenticatedRequest, res, next)).catch(next);
  };
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export function getPagination(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || '20'), 10)));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  pagination: PaginationParams
): PaginatedResponse<T> {
  return {
    items,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}
