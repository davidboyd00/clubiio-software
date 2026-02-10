// ============================================
// ERROR CODES
// ============================================
// Standardized error codes for client handling
// Format: CATEGORY_SPECIFIC_ERROR

export const ErrorCodes = {
  // ─────────────────────────────────────────
  // AUTHENTICATION ERRORS (AUTH_*)
  // ─────────────────────────────────────────
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',
  AUTH_REFRESH_TOKEN_EXPIRED: 'AUTH_REFRESH_TOKEN_EXPIRED',
  AUTH_REFRESH_TOKEN_REUSED: 'AUTH_REFRESH_TOKEN_REUSED',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  AUTH_ACCOUNT_DISABLED: 'AUTH_ACCOUNT_DISABLED',
  AUTH_PASSWORD_WEAK: 'AUTH_PASSWORD_WEAK',
  AUTH_PASSWORD_MISMATCH: 'AUTH_PASSWORD_MISMATCH',

  // ─────────────────────────────────────────
  // MFA ERRORS (MFA_*)
  // ─────────────────────────────────────────
  MFA_REQUIRED: 'MFA_REQUIRED',
  MFA_SETUP_REQUIRED: 'MFA_SETUP_REQUIRED',
  MFA_CODE_INVALID: 'MFA_CODE_INVALID',
  MFA_CODE_EXPIRED: 'MFA_CODE_EXPIRED',
  MFA_ALREADY_ENABLED: 'MFA_ALREADY_ENABLED',
  MFA_NOT_ENABLED: 'MFA_NOT_ENABLED',
  MFA_BACKUP_CODES_EXHAUSTED: 'MFA_BACKUP_CODES_EXHAUSTED',

  // ─────────────────────────────────────────
  // AUTHORIZATION ERRORS (AUTHZ_*)
  // ─────────────────────────────────────────
  AUTHZ_FORBIDDEN: 'AUTHZ_FORBIDDEN',
  AUTHZ_INSUFFICIENT_ROLE: 'AUTHZ_INSUFFICIENT_ROLE',
  AUTHZ_INSUFFICIENT_PERMISSIONS: 'AUTHZ_INSUFFICIENT_PERMISSIONS',
  AUTHZ_TENANT_MISMATCH: 'AUTHZ_TENANT_MISMATCH',
  AUTHZ_VENUE_ACCESS_DENIED: 'AUTHZ_VENUE_ACCESS_DENIED',

  // ─────────────────────────────────────────
  // VALIDATION ERRORS (VALIDATION_*)
  // ─────────────────────────────────────────
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  VALIDATION_REQUIRED_FIELD: 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  VALIDATION_OUT_OF_RANGE: 'VALIDATION_OUT_OF_RANGE',
  VALIDATION_STRING_TOO_LONG: 'VALIDATION_STRING_TOO_LONG',
  VALIDATION_STRING_TOO_SHORT: 'VALIDATION_STRING_TOO_SHORT',
  VALIDATION_INVALID_EMAIL: 'VALIDATION_INVALID_EMAIL',
  VALIDATION_INVALID_UUID: 'VALIDATION_INVALID_UUID',

  // ─────────────────────────────────────────
  // RESOURCE ERRORS (RESOURCE_*)
  // ─────────────────────────────────────────
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  RESOURCE_DELETED: 'RESOURCE_DELETED',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',

  // ─────────────────────────────────────────
  // RATE LIMIT ERRORS (RATE_LIMIT_*)
  // ─────────────────────────────────────────
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_TOO_MANY_REQUESTS: 'RATE_LIMIT_TOO_MANY_REQUESTS',
  RATE_LIMIT_ACCOUNT_LOCKED: 'RATE_LIMIT_ACCOUNT_LOCKED',

  // ─────────────────────────────────────────
  // BUSINESS LOGIC ERRORS (BUSINESS_*)
  // ─────────────────────────────────────────
  BUSINESS_INSUFFICIENT_STOCK: 'BUSINESS_INSUFFICIENT_STOCK',
  BUSINESS_INVALID_ORDER_STATE: 'BUSINESS_INVALID_ORDER_STATE',
  BUSINESS_CASH_SESSION_REQUIRED: 'BUSINESS_CASH_SESSION_REQUIRED',
  BUSINESS_CASH_SESSION_CLOSED: 'BUSINESS_CASH_SESSION_CLOSED',
  BUSINESS_VENUE_CLOSED: 'BUSINESS_VENUE_CLOSED',
  BUSINESS_INVALID_PAYMENT: 'BUSINESS_INVALID_PAYMENT',
  BUSINESS_REFUND_EXCEEDED: 'BUSINESS_REFUND_EXCEEDED',

  // ─────────────────────────────────────────
  // SERVER ERRORS (SERVER_*)
  // ─────────────────────────────────────────
  SERVER_INTERNAL_ERROR: 'SERVER_INTERNAL_ERROR',
  SERVER_DATABASE_ERROR: 'SERVER_DATABASE_ERROR',
  SERVER_SERVICE_UNAVAILABLE: 'SERVER_SERVICE_UNAVAILABLE',
  SERVER_TIMEOUT: 'SERVER_TIMEOUT',
  SERVER_EXTERNAL_SERVICE_ERROR: 'SERVER_EXTERNAL_SERVICE_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// HTTP status code mapping for each error code
export const ErrorHttpStatus: Record<ErrorCode, number> = {
  // Auth errors
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: 401,
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: 401,
  [ErrorCodes.AUTH_TOKEN_INVALID]: 401,
  [ErrorCodes.AUTH_TOKEN_MISSING]: 401,
  [ErrorCodes.AUTH_REFRESH_TOKEN_INVALID]: 401,
  [ErrorCodes.AUTH_REFRESH_TOKEN_EXPIRED]: 401,
  [ErrorCodes.AUTH_REFRESH_TOKEN_REUSED]: 401,
  [ErrorCodes.AUTH_SESSION_EXPIRED]: 401,
  [ErrorCodes.AUTH_ACCOUNT_LOCKED]: 423,
  [ErrorCodes.AUTH_ACCOUNT_DISABLED]: 403,
  [ErrorCodes.AUTH_PASSWORD_WEAK]: 400,
  [ErrorCodes.AUTH_PASSWORD_MISMATCH]: 400,

  // MFA errors
  [ErrorCodes.MFA_REQUIRED]: 403,
  [ErrorCodes.MFA_SETUP_REQUIRED]: 403,
  [ErrorCodes.MFA_CODE_INVALID]: 401,
  [ErrorCodes.MFA_CODE_EXPIRED]: 401,
  [ErrorCodes.MFA_ALREADY_ENABLED]: 400,
  [ErrorCodes.MFA_NOT_ENABLED]: 400,
  [ErrorCodes.MFA_BACKUP_CODES_EXHAUSTED]: 400,

  // Authz errors
  [ErrorCodes.AUTHZ_FORBIDDEN]: 403,
  [ErrorCodes.AUTHZ_INSUFFICIENT_ROLE]: 403,
  [ErrorCodes.AUTHZ_INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCodes.AUTHZ_TENANT_MISMATCH]: 403,
  [ErrorCodes.AUTHZ_VENUE_ACCESS_DENIED]: 403,

  // Validation errors
  [ErrorCodes.VALIDATION_FAILED]: 400,
  [ErrorCodes.VALIDATION_REQUIRED_FIELD]: 400,
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: 400,
  [ErrorCodes.VALIDATION_OUT_OF_RANGE]: 400,
  [ErrorCodes.VALIDATION_STRING_TOO_LONG]: 400,
  [ErrorCodes.VALIDATION_STRING_TOO_SHORT]: 400,
  [ErrorCodes.VALIDATION_INVALID_EMAIL]: 400,
  [ErrorCodes.VALIDATION_INVALID_UUID]: 400,

  // Resource errors
  [ErrorCodes.RESOURCE_NOT_FOUND]: 404,
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: 409,
  [ErrorCodes.RESOURCE_CONFLICT]: 409,
  [ErrorCodes.RESOURCE_DELETED]: 410,
  [ErrorCodes.RESOURCE_LOCKED]: 423,

  // Rate limit errors
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCodes.RATE_LIMIT_TOO_MANY_REQUESTS]: 429,
  [ErrorCodes.RATE_LIMIT_ACCOUNT_LOCKED]: 429,

  // Business errors
  [ErrorCodes.BUSINESS_INSUFFICIENT_STOCK]: 400,
  [ErrorCodes.BUSINESS_INVALID_ORDER_STATE]: 400,
  [ErrorCodes.BUSINESS_CASH_SESSION_REQUIRED]: 400,
  [ErrorCodes.BUSINESS_CASH_SESSION_CLOSED]: 400,
  [ErrorCodes.BUSINESS_VENUE_CLOSED]: 400,
  [ErrorCodes.BUSINESS_INVALID_PAYMENT]: 400,
  [ErrorCodes.BUSINESS_REFUND_EXCEEDED]: 400,

  // Server errors
  [ErrorCodes.SERVER_INTERNAL_ERROR]: 500,
  [ErrorCodes.SERVER_DATABASE_ERROR]: 500,
  [ErrorCodes.SERVER_SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.SERVER_TIMEOUT]: 504,
  [ErrorCodes.SERVER_EXTERNAL_SERVICE_ERROR]: 502,
};

// User-friendly error messages (safe to show to clients)
export const ErrorMessages: Record<ErrorCode, string> = {
  // Auth errors
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password',
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCodes.AUTH_TOKEN_INVALID]: 'Invalid authentication token',
  [ErrorCodes.AUTH_TOKEN_MISSING]: 'Authentication required',
  [ErrorCodes.AUTH_REFRESH_TOKEN_INVALID]: 'Invalid refresh token',
  [ErrorCodes.AUTH_REFRESH_TOKEN_EXPIRED]: 'Session expired. Please log in again.',
  [ErrorCodes.AUTH_REFRESH_TOKEN_REUSED]: 'Security alert: Session compromised. All sessions revoked.',
  [ErrorCodes.AUTH_SESSION_EXPIRED]: 'Your session has expired',
  [ErrorCodes.AUTH_ACCOUNT_LOCKED]: 'Account temporarily locked due to too many failed attempts',
  [ErrorCodes.AUTH_ACCOUNT_DISABLED]: 'This account has been disabled',
  [ErrorCodes.AUTH_PASSWORD_WEAK]: 'Password does not meet security requirements',
  [ErrorCodes.AUTH_PASSWORD_MISMATCH]: 'Current password is incorrect',

  // MFA errors
  [ErrorCodes.MFA_REQUIRED]: 'Multi-factor authentication required',
  [ErrorCodes.MFA_SETUP_REQUIRED]: 'Please set up two-factor authentication to continue',
  [ErrorCodes.MFA_CODE_INVALID]: 'Invalid verification code',
  [ErrorCodes.MFA_CODE_EXPIRED]: 'Verification code has expired',
  [ErrorCodes.MFA_ALREADY_ENABLED]: 'Two-factor authentication is already enabled',
  [ErrorCodes.MFA_NOT_ENABLED]: 'Two-factor authentication is not enabled',
  [ErrorCodes.MFA_BACKUP_CODES_EXHAUSTED]: 'All backup codes have been used',

  // Authz errors
  [ErrorCodes.AUTHZ_FORBIDDEN]: 'You do not have permission to perform this action',
  [ErrorCodes.AUTHZ_INSUFFICIENT_ROLE]: 'Your role does not have access to this resource',
  [ErrorCodes.AUTHZ_INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions',
  [ErrorCodes.AUTHZ_TENANT_MISMATCH]: 'Access denied to this organization',
  [ErrorCodes.AUTHZ_VENUE_ACCESS_DENIED]: 'You do not have access to this venue',

  // Validation errors
  [ErrorCodes.VALIDATION_FAILED]: 'Invalid input data',
  [ErrorCodes.VALIDATION_REQUIRED_FIELD]: 'Required field is missing',
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: 'Invalid format',
  [ErrorCodes.VALIDATION_OUT_OF_RANGE]: 'Value is out of allowed range',
  [ErrorCodes.VALIDATION_STRING_TOO_LONG]: 'Value exceeds maximum length',
  [ErrorCodes.VALIDATION_STRING_TOO_SHORT]: 'Value is too short',
  [ErrorCodes.VALIDATION_INVALID_EMAIL]: 'Invalid email address',
  [ErrorCodes.VALIDATION_INVALID_UUID]: 'Invalid identifier format',

  // Resource errors
  [ErrorCodes.RESOURCE_NOT_FOUND]: 'The requested resource was not found',
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: 'A resource with this information already exists',
  [ErrorCodes.RESOURCE_CONFLICT]: 'Resource conflict detected',
  [ErrorCodes.RESOURCE_DELETED]: 'This resource has been deleted',
  [ErrorCodes.RESOURCE_LOCKED]: 'This resource is currently locked',

  // Rate limit errors
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later.',
  [ErrorCodes.RATE_LIMIT_TOO_MANY_REQUESTS]: 'Request limit exceeded',
  [ErrorCodes.RATE_LIMIT_ACCOUNT_LOCKED]: 'Account temporarily locked. Try again later.',

  // Business errors
  [ErrorCodes.BUSINESS_INSUFFICIENT_STOCK]: 'Insufficient stock available',
  [ErrorCodes.BUSINESS_INVALID_ORDER_STATE]: 'Invalid order state for this operation',
  [ErrorCodes.BUSINESS_CASH_SESSION_REQUIRED]: 'An active cash session is required',
  [ErrorCodes.BUSINESS_CASH_SESSION_CLOSED]: 'Cash session is closed',
  [ErrorCodes.BUSINESS_VENUE_CLOSED]: 'Venue is currently closed',
  [ErrorCodes.BUSINESS_INVALID_PAYMENT]: 'Invalid payment information',
  [ErrorCodes.BUSINESS_REFUND_EXCEEDED]: 'Refund amount exceeds original payment',

  // Server errors
  [ErrorCodes.SERVER_INTERNAL_ERROR]: 'An unexpected error occurred. Please try again.',
  [ErrorCodes.SERVER_DATABASE_ERROR]: 'Database error. Please try again.',
  [ErrorCodes.SERVER_SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
  [ErrorCodes.SERVER_TIMEOUT]: 'Request timed out. Please try again.',
  [ErrorCodes.SERVER_EXTERNAL_SERVICE_ERROR]: 'External service error',
};
