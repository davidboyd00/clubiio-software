import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

// ============================================
// SECURITY MIDDLEWARE
// ============================================
// HTTP Security Headers and protections
// Aligned with: CIS Control 4.2, OWASP API8

/**
 * Helmet configuration for secure HTTP headers
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for emails
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ...(config.corsOrigin || [])],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: config.isProd ? [] : null,
    },
  },

  // Prevent clickjacking
  frameguard: {
    action: 'deny',
  },

  // Hide X-Powered-By header
  hidePoweredBy: true,

  // Strict Transport Security (HSTS)
  hsts: config.isProd ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  } : false,

  // Prevent MIME type sniffing
  noSniff: true,

  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },

  // XSS Protection
  xssFilter: true,

  // DNS Prefetch Control
  dnsPrefetchControl: {
    allow: false,
  },

  // IE No Open
  ieNoOpen: true,

  // Permitted Cross-Domain Policies
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none',
  },
});

/**
 * Additional custom security headers
 */
export function customSecurityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Permissions Policy (formerly Feature Policy)
  res.setHeader('Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );

  // Cross-Origin policies
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

  // Cache control for API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Prevent caching of sensitive data
  res.setHeader('Surrogate-Control', 'no-store');

  next();
}

/**
 * Request ID middleware for tracing
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.headers['x-request-id'] as string ||
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);

  next();
}

/**
 * Sanitize request headers
 * Remove potentially dangerous headers
 */
export function sanitizeHeaders(req: Request, _res: Response, next: NextFunction): void {
  // Remove potentially dangerous headers from request
  const dangerousHeaders = [
    'x-forwarded-host', // Can be used for host header injection
    'x-original-url',   // Can be used for URL manipulation
    'x-rewrite-url',    // Can be used for URL manipulation
  ];

  for (const header of dangerousHeaders) {
    if (req.headers[header] && !config.isDev) {
      delete req.headers[header];
    }
  }

  next();
}

/**
 * CORS preflight handler with security logging
 */
export function corsPreflightHandler(req: Request, _res: Response, next: NextFunction): void {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (origin && !config.corsOrigin.includes(origin)) {
      console.warn(`[Security] Blocked CORS preflight from unauthorized origin: ${origin}`);
    }
  }
  next();
}

export default {
  securityHeaders,
  customSecurityHeaders,
  requestId,
  sanitizeHeaders,
  corsPreflightHandler,
};
