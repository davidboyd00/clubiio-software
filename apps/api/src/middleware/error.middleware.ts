// ============================================
// ERROR MIDDLEWARE
// ============================================
// Backward-compatible error handling

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config';
import { logger } from '../common/logger';

/**
 * Legacy AppError class for backward compatibility
 * Accepts (message, statusCode) signature used throughout the codebase
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Re-export new error types for gradual adoption
export {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ForbiddenError,
  RateLimitError,
  BusinessError,
  InternalError,
  DatabaseError,
} from '../common/errors/app-errors';

export {
  ErrorCodes,
  ErrorHttpStatus,
  ErrorMessages,
} from '../common/errors/error-codes';

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = req.headers['x-request-id'] as string;
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    ...(requestId && { requestId }),
  });
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string;

  // Log the error
  logger.error(err.message, {
    errorName: err.name,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      code: 'VALIDATION_FAILED',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
      ...(requestId && { requestId }),
    });
    return;
  }

  // Custom app errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.code && { code: err.code }),
      ...(requestId && { requestId }),
    });
    return;
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as Error & { code: string };

    if (prismaError.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: 'A record with this value already exists',
        code: 'RESOURCE_ALREADY_EXISTS',
        ...(requestId && { requestId }),
      });
      return;
    }

    if (prismaError.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: 'Record not found',
        code: 'RESOURCE_NOT_FOUND',
        ...(requestId && { requestId }),
      });
      return;
    }
  }

  // JWT errors
  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'Token expired',
      code: 'AUTH_TOKEN_EXPIRED',
      ...(requestId && { requestId }),
    });
    return;
  }

  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'AUTH_TOKEN_INVALID',
      ...(requestId && { requestId }),
    });
    return;
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: config.isDev ? err.message : 'Internal server error',
    code: 'SERVER_INTERNAL_ERROR',
    ...(config.isDev && { stack: err.stack }),
    ...(requestId && { requestId }),
  });
}

/**
 * Async handler wrapper for route handlers
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}