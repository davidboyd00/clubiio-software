import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import { config } from '../config';
import { logSecurityEvent } from './audit.middleware';

// ============================================
// CSRF PROTECTION MIDDLEWARE
// ============================================
// Implements Double Submit Cookie pattern
// Aligned with: OWASP CSRF Prevention Cheat Sheet

/**
 * Routes that should be excluded from CSRF protection
 * These are typically:
 * - Public endpoints that don't modify state
 * - Authentication endpoints (login uses credentials, not session)
 * - API endpoints called from non-browser clients
 */
const CSRF_EXCLUDED_PATHS = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/pin-login',
  '/api/auth/refresh',
  '/api/auth/csrf-token', // Token endpoint itself
];

/**
 * Check if a path should be excluded from CSRF protection
 */
function isExcludedPath(path: string): boolean {
  return CSRF_EXCLUDED_PATHS.some(
    (excluded) => path === excluded || path.startsWith(`${excluded}/`)
  );
}

// Cookie name with security prefix
// __Host- prefix requires: Secure, no Domain, Path=/
const COOKIE_NAME = config.isProd
  ? '__Host-clubio.x-csrf-token'
  : 'clubio.x-csrf-token'; // Dev doesn't support __Host- without HTTPS

// Configure double CSRF protection
const {
  generateCsrfToken,
  doubleCsrfProtection,
  invalidCsrfTokenError,
} = doubleCsrf({
  getSecret: () => config.security.sessionSecret || config.jwt.secret,
  // Session identifier for CSRF token binding
  // For stateless JWT auth, we use a combination of factors
  getSessionIdentifier: (req: Request) => {
    // Use Authorization header hash if present, otherwise use IP + User-Agent
    const auth = req.headers.authorization || '';
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    return `${auth.slice(0, 20)}:${ip}:${ua.slice(0, 50)}`;
  },
  cookieName: COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: config.isProd, // Only secure in production (requires HTTPS)
    maxAge: 60 * 60 * 1000, // 1 hour
  },
  size: 64, // Token size in bytes
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'], // Safe methods don't need CSRF
  getCsrfTokenFromRequest: (req: Request) => {
    // Check header first (preferred for API calls)
    const headerToken = req.headers['x-csrf-token'] as string;
    if (headerToken) return headerToken;

    // Fallback to body for form submissions
    if (req.body && typeof req.body._csrf === 'string') {
      return req.body._csrf;
    }

    return undefined;
  },
});

/**
 * Conditional CSRF middleware that skips excluded paths
 */
export function csrfMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip CSRF for excluded paths
  if (isExcludedPath(req.path)) {
    return next();
  }

  // Skip CSRF for safe HTTP methods (handled by doubleCsrf, but explicit here)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Apply CSRF protection
  doubleCsrfProtection(req, res, next);
}

/**
 * CSRF error handler middleware
 * Must be registered after routes to catch CSRF errors
 */
export function csrfErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err === invalidCsrfTokenError) {
    // Log the security event
    logSecurityEvent('SUSPICIOUS_ACTIVITY', req, {
      type: 'CSRF_VALIDATION_FAILED',
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(403).json({
      success: false,
      error: 'Invalid or missing CSRF token',
      code: 'CSRF_INVALID',
    });
    return;
  }

  // Pass other errors to next handler
  next(err);
}

/**
 * Endpoint handler to get a CSRF token
 * GET /api/auth/csrf-token
 */
export function csrfTokenEndpoint(req: Request, res: Response): void {
  try {
    const token = generateCsrfToken(req, res);
    res.json({
      success: true,
      data: {
        csrfToken: token,
        headerName: 'X-CSRF-Token',
        cookieName: COOKIE_NAME,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate CSRF token',
    });
  }
}

/**
 * Generate CSRF token for a request (useful for SSR)
 */
export function getCsrfToken(req: Request, res: Response): string {
  return generateCsrfToken(req, res);
}

/**
 * Check if CSRF is enabled for current environment
 */
export function isCsrfEnabled(): boolean {
  // CSRF can be disabled for testing via environment variable
  if (process.env.DISABLE_CSRF === 'true') {
    return false;
  }
  return true;
}

export {
  generateCsrfToken,
  CSRF_EXCLUDED_PATHS,
};
