// ============================================
// ENHANCED ERROR HANDLER MIDDLEWARE
// ============================================
// Centralized error handling with logging and sanitization

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../../config';
import { logger, logError } from '../logger';
import {
  AppError,
  ValidationError,
  DatabaseError,
  wrapError,
  isOperationalError,
} from './app-errors';
import { ErrorCodes } from './error-codes';

/**
 * Extended request with request ID
 */
interface ErrorRequest extends Request {
  id?: string;
}

/**
 * Error response format
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
    timestamp?: string;
    stack?: string;
  };
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: ErrorRequest, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: `Route not found: ${req.method} ${req.path}`,
      requestId: req.id || req.headers['x-request-id'],
    },
  });
}

/**
 * Main error handler middleware
 * Converts all errors to consistent JSON responses
 */
export function errorHandler(
  err: Error,
  req: ErrorRequest,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.id || (req.headers['x-request-id'] as string);

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const validationError = ValidationError.fromZodError(err);
    sendErrorResponse(res, validationError, requestId);
    return;
  }

  // Handle our custom AppErrors
  if (err instanceof AppError) {
    logAppError(err, req);
    sendErrorResponse(res, err, requestId);
    return;
  }

  // Handle Prisma errors
  const prismaError = handlePrismaError(err);
  if (prismaError) {
    logAppError(prismaError, req);
    sendErrorResponse(res, prismaError, requestId);
    return;
  }

  // Handle JWT errors
  const jwtError = handleJwtError(err);
  if (jwtError) {
    logAppError(jwtError, req);
    sendErrorResponse(res, jwtError, requestId);
    return;
  }

  // Unknown error - wrap and log
  const wrappedError = wrapError(err);

  // Log the full error for debugging
  logError('Unhandled error', err, {
    requestId,
    path: req.path,
    method: req.method,
    userId: (req as unknown as { user?: { id: string } }).user?.id,
  });

  sendErrorResponse(res, wrappedError, requestId);
}

/**
 * Send formatted error response
 */
function sendErrorResponse(
  res: Response,
  error: AppError,
  requestId?: string
): void {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      requestId,
      timestamp: error.timestamp.toISOString(),
    },
  };

  // Include details if present (validation errors, etc.)
  if (error.details && Object.keys(error.details).length > 0) {
    response.error.details = error.details;
  }

  // Include stack trace only in development
  if (config.isDev && error.stack) {
    response.error.stack = error.stack;
  }

  // Set appropriate headers
  if (error.code === ErrorCodes.RATE_LIMIT_EXCEEDED) {
    const retryAfter = (error.details as { retryAfter?: number })?.retryAfter;
    if (retryAfter) {
      res.set('Retry-After', String(retryAfter));
    }
  }

  res.status(error.statusCode).json(response);
}

/**
 * Log application errors appropriately
 */
function logAppError(error: AppError, req: ErrorRequest): void {
  const meta = {
    requestId: req.id || req.headers['x-request-id'],
    path: req.path,
    method: req.method,
    errorCode: error.code,
    statusCode: error.statusCode,
    userId: (req as unknown as { user?: { id: string } }).user?.id,
    details: error.details,
  };

  // Log level based on status code
  if (error.statusCode >= 500) {
    logger.error(error.message, { ...meta, stack: error.stack });
  } else if (error.statusCode >= 400) {
    // Log auth failures and rate limits at warn level
    if (error.code.startsWith('AUTH_') || error.code.startsWith('RATE_')) {
      logger.warn(error.message, meta);
    } else {
      logger.info(error.message, meta);
    }
  }
}

/**
 * Convert Prisma errors to AppErrors
 */
function handlePrismaError(err: Error): AppError | null {
  if (err.name !== 'PrismaClientKnownRequestError') {
    return null;
  }

  const prismaError = err as Error & { code: string; meta?: Record<string, unknown> };

  switch (prismaError.code) {
    case 'P2002': // Unique constraint violation
      return new AppError(
        ErrorCodes.RESOURCE_ALREADY_EXISTS,
        'A record with this value already exists',
        { field: prismaError.meta?.target }
      );

    case 'P2025': // Record not found
      return new AppError(ErrorCodes.RESOURCE_NOT_FOUND, 'Record not found');

    case 'P2003': // Foreign key constraint failed
      return new AppError(
        ErrorCodes.VALIDATION_FAILED,
        'Related record not found',
        { field: prismaError.meta?.field_name }
      );

    case 'P2014': // Relation violation
      return new AppError(
        ErrorCodes.RESOURCE_CONFLICT,
        'Cannot delete record with existing relations'
      );

    case 'P2024': // Timeout
      return new DatabaseError('Database operation timed out');

    default:
      return new DatabaseError('Database operation failed');
  }
}

/**
 * Convert JWT errors to AppErrors
 */
function handleJwtError(err: Error): AppError | null {
  if (err.name === 'TokenExpiredError') {
    return new AppError(ErrorCodes.AUTH_TOKEN_EXPIRED);
  }

  if (err.name === 'JsonWebTokenError') {
    return new AppError(ErrorCodes.AUTH_TOKEN_INVALID);
  }

  if (err.name === 'NotBeforeError') {
    return new AppError(ErrorCodes.AUTH_TOKEN_INVALID, 'Token not yet active');
  }

  return null;
}

/**
 * Async error wrapper for route handlers
 * Catches promise rejections and forwards to error handler
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Handle uncaught exceptions
 */
export function handleUncaughtException(error: Error): void {
  logger.error('Uncaught Exception', {
    errorName: error.name,
    errorMessage: error.message,
    stack: error.stack,
    isOperational: isOperationalError(error),
  });

  // Only exit for non-operational errors
  if (!isOperationalError(error)) {
    logger.error('Non-operational error, shutting down...');
    process.exit(1);
  }
}

/**
 * Handle unhandled promise rejections
 */
export function handleUnhandledRejection(reason: unknown): void {
  const error = reason instanceof Error ? reason : new Error(String(reason));

  logger.error('Unhandled Promise Rejection', {
    errorName: error.name,
    errorMessage: error.message,
    stack: error.stack,
  });
}
