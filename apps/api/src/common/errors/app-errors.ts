// ============================================
// APPLICATION ERROR CLASSES
// ============================================
// Typed error hierarchy for structured error handling

import {
  ErrorCode,
  ErrorCodes,
  ErrorHttpStatus,
  ErrorMessages,
} from './error-codes';

/**
 * Base application error class
 * All custom errors should extend this
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message?: string,
    details?: Record<string, unknown>
  ) {
    super(message || ErrorMessages[code]);
    this.code = code;
    this.statusCode = ErrorHttpStatus[code];
    this.isOperational = true;
    this.details = details;
    this.timestamp = new Date();

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Convert to JSON response format
   */
  toJSON(includeStack = false): Record<string, unknown> {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
        ...(includeStack && { stack: this.stack }),
      },
    };
  }
}

// ─────────────────────────────────────────
// AUTHENTICATION ERRORS
// ─────────────────────────────────────────

export class AuthenticationError extends AppError {
  constructor(
    code: ErrorCode = ErrorCodes.AUTH_INVALID_CREDENTIALS,
    message?: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, details);
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor(message?: string) {
    super(ErrorCodes.AUTH_TOKEN_EXPIRED, message);
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(message?: string) {
    super(ErrorCodes.AUTH_TOKEN_INVALID, message);
  }
}

export class AccountLockedError extends AuthenticationError {
  public readonly unlockAt?: Date;
  public readonly remainingSeconds?: number;

  constructor(remainingSeconds?: number) {
    super(ErrorCodes.AUTH_ACCOUNT_LOCKED, undefined, { remainingSeconds });
    this.remainingSeconds = remainingSeconds;
    if (remainingSeconds) {
      this.unlockAt = new Date(Date.now() + remainingSeconds * 1000);
    }
  }
}

// ─────────────────────────────────────────
// MFA ERRORS
// ─────────────────────────────────────────

export class MfaRequiredError extends AppError {
  constructor(message?: string) {
    super(ErrorCodes.MFA_REQUIRED, message);
  }
}

export class MfaSetupRequiredError extends AppError {
  constructor(message?: string) {
    super(ErrorCodes.MFA_SETUP_REQUIRED, message);
  }
}

export class MfaCodeInvalidError extends AppError {
  constructor(message?: string) {
    super(ErrorCodes.MFA_CODE_INVALID, message);
  }
}

// ─────────────────────────────────────────
// AUTHORIZATION ERRORS
// ─────────────────────────────────────────

export class AuthorizationError extends AppError {
  constructor(
    code: ErrorCode = ErrorCodes.AUTHZ_FORBIDDEN,
    message?: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, details);
  }
}

export class ForbiddenError extends AuthorizationError {
  constructor(message?: string) {
    super(ErrorCodes.AUTHZ_FORBIDDEN, message);
  }
}

export class InsufficientRoleError extends AuthorizationError {
  constructor(requiredRole: string, currentRole: string) {
    super(ErrorCodes.AUTHZ_INSUFFICIENT_ROLE, undefined, {
      requiredRole,
      currentRole,
    });
  }
}

export class TenantMismatchError extends AuthorizationError {
  constructor() {
    super(ErrorCodes.AUTHZ_TENANT_MISMATCH);
  }
}

// ─────────────────────────────────────────
// VALIDATION ERRORS
// ─────────────────────────────────────────

export interface ValidationIssue {
  field: string;
  message: string;
  code?: string;
}

export class ValidationError extends AppError {
  public readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[], message?: string) {
    super(ErrorCodes.VALIDATION_FAILED, message || 'Validation failed', {
      issues,
    });
    this.issues = issues;
  }

  /**
   * Create from Zod validation error
   */
  static fromZodError(zodError: { errors: Array<{ path: (string | number)[]; message: string; code?: string }> }): ValidationError {
    const issues = zodError.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code,
    }));
    return new ValidationError(issues);
  }
}

// ─────────────────────────────────────────
// RESOURCE ERRORS
// ─────────────────────────────────────────

export class NotFoundError extends AppError {
  public readonly resourceType?: string;
  public readonly resourceId?: string;

  constructor(resourceType?: string, resourceId?: string) {
    super(
      ErrorCodes.RESOURCE_NOT_FOUND,
      resourceType ? `${resourceType} not found` : undefined,
      { resourceType, resourceId }
    );
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

export class ConflictError extends AppError {
  constructor(message?: string, details?: Record<string, unknown>) {
    super(ErrorCodes.RESOURCE_CONFLICT, message, details);
  }
}

export class AlreadyExistsError extends AppError {
  constructor(resourceType: string, field?: string) {
    super(
      ErrorCodes.RESOURCE_ALREADY_EXISTS,
      `${resourceType} already exists`,
      { resourceType, field }
    );
  }
}

// ─────────────────────────────────────────
// RATE LIMIT ERRORS
// ─────────────────────────────────────────

export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(retryAfter?: number) {
    super(ErrorCodes.RATE_LIMIT_EXCEEDED, undefined, { retryAfter });
    this.retryAfter = retryAfter;
  }
}

// ─────────────────────────────────────────
// BUSINESS LOGIC ERRORS
// ─────────────────────────────────────────

export class BusinessError extends AppError {
  constructor(
    code: ErrorCode,
    message?: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, details);
  }
}

export class InsufficientStockError extends BusinessError {
  constructor(productId: string, requested: number, available: number) {
    super(ErrorCodes.BUSINESS_INSUFFICIENT_STOCK, undefined, {
      productId,
      requested,
      available,
    });
  }
}

export class InvalidOrderStateError extends BusinessError {
  constructor(currentState: string, requiredState: string) {
    super(ErrorCodes.BUSINESS_INVALID_ORDER_STATE, undefined, {
      currentState,
      requiredState,
    });
  }
}

export class CashSessionRequiredError extends BusinessError {
  constructor() {
    super(ErrorCodes.BUSINESS_CASH_SESSION_REQUIRED);
  }
}

// ─────────────────────────────────────────
// SERVER ERRORS
// ─────────────────────────────────────────

export class InternalError extends AppError {
  constructor(message?: string, details?: Record<string, unknown>) {
    super(ErrorCodes.SERVER_INTERNAL_ERROR, message, details);
    // Note: isOperational remains true from parent, but InternalError indicates
    // a programmer error that should be investigated
  }
}

export class DatabaseError extends AppError {
  constructor(message?: string) {
    super(ErrorCodes.SERVER_DATABASE_ERROR, message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(serviceName?: string) {
    super(ErrorCodes.SERVER_SERVICE_UNAVAILABLE, undefined, { serviceName });
  }
}

// ─────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────

/**
 * Check if an error is an operational (expected) error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Wrap an unknown error as an AppError
 */
export function wrapError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message);
  }

  return new InternalError('An unexpected error occurred');
}
