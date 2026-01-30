import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../config';

// ============================================
// RATE LIMITING MIDDLEWARE
// ============================================
// Protects against brute force, DDoS, and abuse
// Aligned with: CIS Control 16.1, OWASP API4

// In-memory store for login attempts (use Redis in production for multi-instance)
const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const pinAttempts = new Map<string, { count: number; resetTime: number }>();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of loginAttempts) {
    if (value.resetTime < now) {
      loginAttempts.delete(key);
    }
  }
  for (const [key, value] of pinAttempts) {
    if (value.resetTime < now) {
      pinAttempts.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Get client identifier for rate limiting
 * Uses IP + User-Agent fingerprint
 */
function getClientId(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  // Simple fingerprint - in production consider more robust fingerprinting
  return `${ip}:${userAgent.slice(0, 50)}`;
}

/**
 * Standard API rate limiter
 * Applies to all API endpoints
 */
export const standardRateLimiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.maxRequests,
  message: {
    error: 'Too many requests',
    message: 'Has excedido el límite de solicitudes. Por favor espera antes de intentar de nuevo.',
    retryAfter: Math.ceil(config.security.rateLimit.windowMs / 1000),
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: getClientId,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health' || req.path === '/api/health/ready';
  },
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Standard limit exceeded for ${getClientId(req)} on ${req.path}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Has excedido el límite de solicitudes. Por favor espera antes de intentar de nuevo.',
      retryAfter: Math.ceil(config.security.rateLimit.windowMs / 1000),
    });
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * Much lower limits to prevent brute force
 */
export const authRateLimiter = rateLimit({
  windowMs: config.security.rateLimit.loginWindowMs,
  max: config.security.rateLimit.loginMaxAttempts,
  message: {
    error: 'Too many login attempts',
    message: 'Demasiados intentos de inicio de sesión. Por favor espera 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientId,
  skipSuccessfulRequests: false, // Count all requests, not just failures
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Auth limit exceeded for ${getClientId(req)}`);
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Demasiados intentos de inicio de sesión. Por favor espera 15 minutos.',
      retryAfter: Math.ceil(config.security.rateLimit.loginWindowMs / 1000),
    });
  },
});

/**
 * PIN login rate limiter
 * Very strict - only 3 attempts per 5 minutes per venue
 */
export const pinRateLimiter = rateLimit({
  windowMs: config.security.rateLimit.pinWindowMs,
  max: config.security.rateLimit.pinMaxAttempts,
  message: {
    error: 'Too many PIN attempts',
    message: 'Demasiados intentos de PIN. Por favor espera 5 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Rate limit by venue + IP to prevent brute force on specific venue
    const venueId = req.body?.venueId || 'unknown';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `pin:${venueId}:${ip}`;
  },
  handler: (req: Request, res: Response) => {
    const venueId = req.body?.venueId || 'unknown';
    console.warn(`[RateLimit] PIN limit exceeded for venue ${venueId} from ${req.ip}`);
    res.status(429).json({
      error: 'Too many PIN attempts',
      message: 'Demasiados intentos de PIN. Por favor espera 5 minutos.',
      retryAfter: Math.ceil(config.security.rateLimit.pinWindowMs / 1000),
    });
  },
});

/**
 * Registration rate limiter
 * Prevents mass account creation
 */
export const registrationRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 3, // 3 registrations per minute per IP
  message: {
    error: 'Too many registration attempts',
    message: 'Demasiados intentos de registro. Por favor espera un momento.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientId,
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Registration limit exceeded for ${getClientId(req)}`);
    res.status(429).json({
      error: 'Too many registration attempts',
      message: 'Demasiados intentos de registro. Por favor espera un momento.',
      retryAfter: 60,
    });
  },
});

/**
 * Sensitive operations rate limiter
 * For password reset, email verification, etc.
 */
export const sensitiveRateLimiter = rateLimit({
  windowMs: 3600000, // 1 hour
  max: 5, // 5 attempts per hour
  message: {
    error: 'Too many attempts',
    message: 'Demasiados intentos. Por favor espera una hora.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientId,
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimit] Sensitive operation limit exceeded for ${getClientId(req)}`);
    res.status(429).json({
      error: 'Too many attempts',
      message: 'Demasiados intentos. Por favor espera una hora.',
      retryAfter: 3600,
    });
  },
});

/**
 * Track failed login attempt (for account lockout)
 */
export function trackFailedLogin(identifier: string): { count: number; locked: boolean } {
  const now = Date.now();
  const windowMs = config.security.lockout.durationMinutes * 60 * 1000;

  const existing = loginAttempts.get(identifier);

  if (existing && existing.resetTime > now) {
    existing.count++;
    const locked = existing.count >= config.security.lockout.maxAttempts;
    return { count: existing.count, locked };
  }

  loginAttempts.set(identifier, {
    count: 1,
    resetTime: now + windowMs,
  });

  return { count: 1, locked: false };
}

/**
 * Clear failed login attempts on successful login
 */
export function clearFailedLogins(identifier: string): void {
  loginAttempts.delete(identifier);
}

/**
 * Check if account is locked
 */
export function isAccountLocked(identifier: string): boolean {
  const now = Date.now();
  const existing = loginAttempts.get(identifier);

  if (!existing) return false;

  if (existing.resetTime < now) {
    loginAttempts.delete(identifier);
    return false;
  }

  return existing.count >= config.security.lockout.maxAttempts;
}

/**
 * Get remaining lockout time in seconds
 */
export function getLockoutRemaining(identifier: string): number {
  const now = Date.now();
  const existing = loginAttempts.get(identifier);

  if (!existing || existing.resetTime < now) return 0;

  return Math.ceil((existing.resetTime - now) / 1000);
}

export default {
  standardRateLimiter,
  authRateLimiter,
  pinRateLimiter,
  registrationRateLimiter,
  sensitiveRateLimiter,
  trackFailedLogin,
  clearFailedLogins,
  isAccountLocked,
  getLockoutRemaining,
};
