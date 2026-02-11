import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// ============================================
// CENTRALIZED LOGGING SERVICE
// ============================================
// Structured logging with Winston
// Aligned with: CIS Control 8.1, NIST CSF DE.CM

// Note: We use process.env directly instead of config to avoid circular dependency
// config -> logger -> config

// Environment helpers (avoiding circular dependency with config)
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDev = NODE_ENV === 'development';
const isProd = NODE_ENV === 'production';

// Log directory (relative to project root)
const LOG_DIR = process.env.LOG_DIR || 'logs';

// ─────────────────────────────────────────
// LOG FORMATS
// ─────────────────────────────────────────

/**
 * Structured JSON format for production
 * Includes all metadata for log analysis tools
 */
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Human-readable format for development console
 */
const devConsoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

// ─────────────────────────────────────────
// TRANSPORT CONFIGURATION
// ─────────────────────────────────────────

/**
 * Create transports based on environment
 */
function createTransports(): winston.transport[] {
  const transports: winston.transport[] = [];

  // Console transport (always enabled)
  transports.push(
    new winston.transports.Console({
      level: isDev ? 'debug' : 'info',
      format: isDev ? devConsoleFormat : structuredFormat,
    })
  );

  // File transports (production only, or if LOG_DIR is explicitly set)
  if (isProd || process.env.LOG_DIR) {
    // General application logs
    transports.push(
      new DailyRotateFile({
        dirname: LOG_DIR,
        filename: 'app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '100m',
        maxFiles: '30d',
        level: 'info',
        format: structuredFormat,
      })
    );

    // Error logs (separate file for easier monitoring)
    transports.push(
      new DailyRotateFile({
        dirname: LOG_DIR,
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '50m',
        maxFiles: '90d',
        level: 'error',
        format: structuredFormat,
      })
    );
  }

  return transports;
}

/**
 * Create audit-specific transports
 * Audit logs have longer retention for compliance
 */
function createAuditTransports(): winston.transport[] {
  const transports: winston.transport[] = [];

  // Console in development
  if (isDev) {
    transports.push(
      new winston.transports.Console({
        level: 'info',
        format: devConsoleFormat,
      })
    );
  }

  // Audit file transport (always enabled in production)
  if (isProd || process.env.LOG_DIR) {
    transports.push(
      new DailyRotateFile({
        dirname: LOG_DIR,
        filename: 'audit-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '100m',
        maxFiles: '365d', // 1 year retention for compliance
        level: 'info',
        format: structuredFormat,
      })
    );
  }

  // Fallback console if no transports configured
  if (transports.length === 0) {
    transports.push(
      new winston.transports.Console({
        level: 'info',
        format: structuredFormat,
      })
    );
  }

  return transports;
}

// ─────────────────────────────────────────
// LOGGER INSTANCES
// ─────────────────────────────────────────

/**
 * Main application logger
 * Use for general application logging
 */
export const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: structuredFormat,
  defaultMeta: {
    service: 'clubio-api',
    version: process.env.npm_package_version || '0.1.0',
    environment: NODE_ENV,
  },
  transports: createTransports(),
  // Don't exit on uncaught exceptions
  exitOnError: false,
});

/**
 * Audit logger for security events
 * Separate logger with longer retention
 */
export const auditLogger = winston.createLogger({
  level: 'info',
  format: structuredFormat,
  defaultMeta: {
    service: 'clubio-api',
    logType: 'AUDIT',
    version: process.env.npm_package_version || '0.1.0',
    environment: NODE_ENV,
  },
  transports: createAuditTransports(),
  exitOnError: false,
});

// ─────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────

/**
 * Log levels and their use cases:
 * - error: Application errors that need immediate attention
 * - warn: Potentially harmful situations, security warnings
 * - info: General operational events, state changes
 * - http: HTTP request/response logging
 * - debug: Detailed debugging information
 */

/**
 * Log an HTTP request/response
 */
export function logHttpRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  meta?: Record<string, unknown>
): void {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

  logger.log(level, `${method} ${path} ${statusCode} ${duration}ms`, {
    type: 'http',
    method,
    path,
    statusCode,
    duration,
    ...meta,
  });
}

/**
 * Log an application error with stack trace
 */
export function logError(
  message: string,
  error: Error,
  meta?: Record<string, unknown>
): void {
  logger.error(message, {
    type: 'error',
    errorName: error.name,
    errorMessage: error.message,
    stack: error.stack,
    ...meta,
  });
}

/**
 * Log a security event (uses audit logger)
 */
export function logSecurityAudit(
  eventType: string,
  success: boolean,
  meta?: Record<string, unknown>
): void {
  const level = success ? 'info' : 'warn';

  auditLogger.log(level, `Security event: ${eventType}`, {
    eventType,
    success,
    ...meta,
  });
}

/**
 * Log a data operation (uses audit logger)
 */
export function logDataOperation(
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
  resourceType: string,
  resourceId: string,
  userId?: string,
  meta?: Record<string, unknown>
): void {
  auditLogger.info(`Data operation: ${operation} ${resourceType}`, {
    operation,
    resourceType,
    resourceId,
    userId,
    ...meta,
  });
}

/**
 * Create a child logger with additional context
 * Useful for request-scoped logging
 */
export function createChildLogger(meta: Record<string, unknown>): winston.Logger {
  return logger.child(meta);
}

/**
 * Create a child audit logger with additional context
 */
export function createChildAuditLogger(meta: Record<string, unknown>): winston.Logger {
  return auditLogger.child(meta);
}

// ─────────────────────────────────────────
// STREAM FOR MORGAN (HTTP LOGGING)
// ─────────────────────────────────────────

/**
 * Stream for morgan HTTP logger integration
 * Can be used with: app.use(morgan('combined', { stream: httpLogStream }))
 */
export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// ─────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────

// Log startup info
if (isDev) {
  logger.debug('Logger initialized', {
    logDir: LOG_DIR,
    environment: NODE_ENV,
    logLevel: isDev ? 'debug' : 'info',
  });
}

export default logger;
