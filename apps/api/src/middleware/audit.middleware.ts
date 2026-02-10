import { Request, Response, NextFunction } from 'express';
import { auditLogger, logger } from '../common/logger';

// ============================================
// AUDIT LOGGING MIDDLEWARE
// ============================================
// Security audit trail for compliance and forensics
// Aligned with: CIS Control 8.1, NIST CSF DE.CM
// Now using Winston for structured logging with file rotation

// Extend Request type to include user info
interface AuditRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  tenantId?: string;
}

// Audit event types
export type AuditEventType =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_LOGOUT'
  | 'AUTH_LOGOUT_ALL'
  | 'AUTH_PIN_LOGIN_SUCCESS'
  | 'AUTH_PIN_LOGIN_FAILURE'
  | 'AUTH_TOKEN_REFRESH'
  | 'AUTH_PASSWORD_CHANGE'
  | 'AUTH_ACCOUNT_LOCKED'
  | 'MFA_SETUP_INITIATED'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'MFA_VERIFIED'
  | 'MFA_VERIFICATION_FAILED'
  | 'MFA_BACKUP_CODE_USED'
  | 'MFA_BACKUP_CODES_REGENERATED'
  | 'TOKEN_REUSE_DETECTED'
  | 'REVOKED_TOKEN_REUSE'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'USER_ROLE_CHANGE'
  | 'DATA_READ'
  | 'DATA_CREATE'
  | 'DATA_UPDATE'
  | 'DATA_DELETE'
  | 'DATA_EXPORT'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'CONFIG_CHANGE'
  | 'ADMIN_ACTION';

export interface AuditEvent {
  requestId: string;
  eventType: AuditEventType;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  tenantId?: string;
  ip: string;
  userAgent: string;
  method: string;
  path: string;
  statusCode?: number;
  duration?: number;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  details?: Record<string, unknown>;
  success: boolean;
  error?: string;
}

// Critical events that require immediate logging and alerting
export const CRITICAL_EVENTS: AuditEventType[] = [
  'AUTH_LOGIN_FAILURE',
  'AUTH_ACCOUNT_LOCKED',
  'PERMISSION_DENIED',
  'SUSPICIOUS_ACTIVITY',
  'DATA_DELETE',
  'USER_DELETE',
  'CONFIG_CHANGE',
  'TOKEN_REUSE_DETECTED',
  'REVOKED_TOKEN_REUSE',
];

/**
 * Log an audit event using Winston
 */
export function logAuditEvent(event: AuditEvent): void {
  const isCritical = CRITICAL_EVENTS.includes(event.eventType);
  const level = isCritical ? 'warn' : 'info';

  // Log to audit logger (separate file with 365 day retention)
  auditLogger.log(level, `Audit: ${event.eventType}`, {
    ...event,
    critical: isCritical,
  });

  // For critical events, also log to main logger for immediate visibility
  if (isCritical) {
    logger.warn(`[SECURITY] ${event.eventType}`, {
      eventType: event.eventType,
      userId: event.userId,
      ip: event.ip,
      path: event.path,
      details: event.details,
    });
  }
}

/**
 * Extract safe request metadata
 */
function getRequestMetadata(req: AuditRequest): Omit<AuditEvent, 'eventType' | 'success'> {
  return {
    requestId: (req.headers['x-request-id'] as string) || 'unknown',
    ip: req.ip || req.socket?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    userEmail: req.user?.email,
    userRole: req.user?.role,
    tenantId: req.tenantId,
  };
}

/**
 * Audit middleware for request/response logging
 */
export function auditMiddleware(req: AuditRequest, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const metadata = getRequestMetadata(req);

    // Determine event type based on method and path
    let eventType: AuditEventType = 'DATA_READ';
    if (req.method === 'POST') eventType = 'DATA_CREATE';
    if (req.method === 'PUT' || req.method === 'PATCH') eventType = 'DATA_UPDATE';
    if (req.method === 'DELETE') eventType = 'DATA_DELETE';

    // Auth-specific events
    if (req.path.includes('/auth/login')) {
      eventType = statusCode < 400 ? 'AUTH_LOGIN_SUCCESS' : 'AUTH_LOGIN_FAILURE';
    }
    if (req.path.includes('/auth/pin-login')) {
      eventType = statusCode < 400 ? 'AUTH_PIN_LOGIN_SUCCESS' : 'AUTH_PIN_LOGIN_FAILURE';
    }

    // Permission denied
    if (statusCode === 403) {
      eventType = 'PERMISSION_DENIED';
    }

    // Only log non-GET requests, failures, and auth/admin paths
    const shouldLog =
      req.method !== 'GET' ||
      statusCode >= 400 ||
      req.path.includes('/auth/') ||
      req.path.includes('/admin/') ||
      req.path.includes('/super-admin/');

    if (shouldLog) {
      logAuditEvent({
        ...metadata,
        eventType,
        statusCode,
        duration,
        success: statusCode < 400,
      });
    }
  });

  next();
}

/**
 * Log authentication events
 */
export function logAuthEvent(
  eventType: 'AUTH_LOGIN_SUCCESS' | 'AUTH_LOGIN_FAILURE' | 'AUTH_LOGOUT' | 'AUTH_PIN_LOGIN_SUCCESS' | 'AUTH_PIN_LOGIN_FAILURE' | 'AUTH_ACCOUNT_LOCKED',
  req: Request,
  details?: Record<string, unknown>
): void {
  logAuditEvent({
    requestId: (req.headers['x-request-id'] as string) || 'unknown',
    eventType,
    ip: req.ip || req.socket?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    method: req.method,
    path: req.path,
    success: eventType.includes('SUCCESS'),
    details: maskSensitiveData(details || {}),
  });
}

/**
 * Log user management events
 */
export function logUserEvent(
  eventType: 'USER_CREATE' | 'USER_UPDATE' | 'USER_DELETE' | 'USER_ROLE_CHANGE',
  req: AuditRequest,
  targetUserId: string,
  details?: Record<string, unknown>
): void {
  logAuditEvent({
    ...getRequestMetadata(req),
    eventType,
    resourceType: 'user',
    resourceId: targetUserId,
    success: true,
    details: maskSensitiveData(details || {}),
  });
}

/**
 * Log data access events
 */
export function logDataEvent(
  eventType: 'DATA_READ' | 'DATA_CREATE' | 'DATA_UPDATE' | 'DATA_DELETE' | 'DATA_EXPORT',
  req: AuditRequest,
  resourceType: string,
  resourceId: string,
  details?: Record<string, unknown>
): void {
  logAuditEvent({
    ...getRequestMetadata(req),
    eventType,
    resourceType,
    resourceId,
    success: true,
    details,
  });
}

// Security event types
type SecurityEventType =
  | 'PERMISSION_DENIED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'AUTH_LOGOUT_ALL'
  | 'MFA_SETUP_INITIATED'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'MFA_VERIFIED'
  | 'MFA_VERIFICATION_FAILED'
  | 'MFA_BACKUP_CODE_USED'
  | 'MFA_BACKUP_CODES_REGENERATED'
  | 'TOKEN_REUSE_DETECTED'
  | 'REVOKED_TOKEN_REUSE';

/**
 * Log security events
 */
export function logSecurityEvent(
  eventType: SecurityEventType,
  req: Request,
  details?: Record<string, unknown>
): void {
  const metadata = {
    requestId: (req.headers['x-request-id'] as string) || 'unknown',
    ip: req.ip || req.socket?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    method: req.method,
    path: req.path,
  };

  logAuditEvent({
    ...metadata,
    eventType,
    success: false,
    details,
  });

  // Alert on suspicious activity (in addition to logging)
  if (eventType === 'SUSPICIOUS_ACTIVITY') {
    logger.error(`[SECURITY ALERT] Suspicious activity detected`, {
      alertType: 'SUSPICIOUS_ACTIVITY',
      ...metadata,
      details,
    });

    // TODO: Integrate with external alerting (PagerDuty, Slack, etc.)
    // alertService.sendSecurityAlert({ eventType, ...metadata, details });
  }
}

/**
 * Log configuration changes
 */
export function logConfigChange(
  req: AuditRequest,
  configType: string,
  changes: Record<string, unknown>
): void {
  logAuditEvent({
    ...getRequestMetadata(req),
    eventType: 'CONFIG_CHANGE',
    resourceType: 'config',
    resourceId: configType,
    success: true,
    details: maskSensitiveData(changes),
  });
}

/**
 * Log admin actions
 */
export function logAdminAction(
  req: AuditRequest,
  action: string,
  details?: Record<string, unknown>
): void {
  logAuditEvent({
    ...getRequestMetadata(req),
    eventType: 'ADMIN_ACTION',
    action,
    success: true,
    details,
  });
}

/**
 * Mask sensitive data in audit logs
 * Prevents accidental logging of passwords, tokens, etc.
 */
export function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ['password', 'pin', 'token', 'secret', 'key', 'authorization', 'cookie', 'csrf'];
  const masked = { ...data };

  for (const key of Object.keys(masked)) {
    const keyLower = key.toLowerCase();
    if (sensitiveFields.some(field => keyLower.includes(field))) {
      masked[key] = '***MASKED***';
    }
    // Recursively mask nested objects
    if (masked[key] && typeof masked[key] === 'object' && !Array.isArray(masked[key])) {
      masked[key] = maskSensitiveData(masked[key] as Record<string, unknown>);
    }
  }

  return masked;
}

/**
 * Check if an event type is critical (for external alerting integration)
 */
export function isCriticalEvent(eventType: AuditEventType): boolean {
  return CRITICAL_EVENTS.includes(eventType);
}

export default {
  auditMiddleware,
  logAuditEvent,
  logAuthEvent,
  logUserEvent,
  logDataEvent,
  logSecurityEvent,
  logConfigChange,
  logAdminAction,
  maskSensitiveData,
  isCriticalEvent,
  CRITICAL_EVENTS,
};
