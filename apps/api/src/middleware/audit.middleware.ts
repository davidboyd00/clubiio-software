import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

// ============================================
// AUDIT LOGGING MIDDLEWARE
// ============================================
// Security audit trail for compliance and forensics
// Aligned with: CIS Control 8.1, NIST CSF DE.CM

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
type AuditEventType =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_LOGOUT'
  | 'AUTH_PIN_LOGIN_SUCCESS'
  | 'AUTH_PIN_LOGIN_FAILURE'
  | 'AUTH_TOKEN_REFRESH'
  | 'AUTH_PASSWORD_CHANGE'
  | 'AUTH_ACCOUNT_LOCKED'
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

interface AuditEvent {
  timestamp: Date;
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

// In-memory buffer for audit events (use proper logging service in production)
const auditBuffer: AuditEvent[] = [];
const MAX_BUFFER_SIZE = 1000;

/**
 * Flush audit buffer to persistent storage
 * In production, this should send to:
 * - CloudWatch Logs
 * - Elasticsearch
 * - SIEM system
 * - Dedicated audit database
 */
async function flushAuditBuffer(): Promise<void> {
  if (auditBuffer.length === 0) return;

  const events = [...auditBuffer];
  auditBuffer.length = 0;

  // In production, send to logging service
  if (config.isProd) {
    // TODO: Integrate with logging service
    // await logService.sendAuditEvents(events);
  }

  // Development: log to console in structured format
  if (config.isDev) {
    for (const event of events) {
      console.log(JSON.stringify({
        type: 'AUDIT',
        ...event,
      }));
    }
  }
}

// Flush buffer periodically
setInterval(flushAuditBuffer, 5000);

/**
 * Log an audit event
 */
export function logAuditEvent(event: Omit<AuditEvent, 'timestamp'>): void {
  const auditEvent: AuditEvent = {
    ...event,
    timestamp: new Date(),
  };

  auditBuffer.push(auditEvent);

  // Flush if buffer is full
  if (auditBuffer.length >= MAX_BUFFER_SIZE) {
    flushAuditBuffer();
  }

  // Immediately log high-priority events
  const highPriorityEvents: AuditEventType[] = [
    'AUTH_LOGIN_FAILURE',
    'AUTH_ACCOUNT_LOCKED',
    'PERMISSION_DENIED',
    'SUSPICIOUS_ACTIVITY',
    'DATA_DELETE',
    'USER_DELETE',
    'CONFIG_CHANGE',
  ];

  if (highPriorityEvents.includes(event.eventType)) {
    console.warn(`[AUDIT] ${event.eventType}`, JSON.stringify(auditEvent));
  }
}

/**
 * Extract safe request metadata
 */
function getRequestMetadata(req: AuditRequest) {
  return {
    requestId: (req.headers['x-request-id'] as string) || 'unknown',
    ip: req.ip || req.socket.remoteAddress || 'unknown',
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
  const metadata = getRequestMetadata(req);

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

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

    // Only log non-GET requests and failures
    const shouldLog =
      req.method !== 'GET' ||
      statusCode >= 400 ||
      req.path.includes('/auth/') ||
      req.path.includes('/admin/');

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
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    method: req.method,
    path: req.path,
    success: eventType.includes('SUCCESS'),
    details,
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
    details,
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

/**
 * Log security events
 */
export function logSecurityEvent(
  eventType: 'PERMISSION_DENIED' | 'RATE_LIMIT_EXCEEDED' | 'SUSPICIOUS_ACTIVITY',
  req: Request,
  details?: Record<string, unknown>
): void {
  const metadata = {
    requestId: (req.headers['x-request-id'] as string) || 'unknown',
    ip: req.ip || req.socket.remoteAddress || 'unknown',
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

  // Alert on suspicious activity
  if (eventType === 'SUSPICIOUS_ACTIVITY') {
    console.error(`[SECURITY ALERT] Suspicious activity detected`, JSON.stringify({
      ...metadata,
      details,
    }));
    // TODO: Send to security alerting system
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
    details: changes,
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
 */
export function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ['password', 'pin', 'token', 'secret', 'key', 'authorization'];
  const masked = { ...data };

  for (const key of Object.keys(masked)) {
    const keyLower = key.toLowerCase();
    if (sensitiveFields.some(field => keyLower.includes(field))) {
      masked[key] = '***MASKED***';
    }
  }

  return masked;
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
};
