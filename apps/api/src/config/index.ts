import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // JWT - SECURITY: No default secret, must be set via env
  jwt: {
    secret: process.env.JWT_SECRET || '', // Will be validated at startup
    expiresIn: process.env.JWT_EXPIRES_IN || '15m', // Reduced from 7d to 15m for security
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],

  // Feature flags
  features: {
    queueEngine: process.env.FEATURE_QUEUE_ENGINE === 'true',
    stockAlerts: process.env.FEATURE_STOCK_ALERTS === 'true',
    analyticsSnapshots: process.env.FEATURE_ANALYTICS_SNAPSHOTS !== 'false',
  },

  // Security settings
  security: {
    // Rate limiting (higher limits in development)
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX || (process.env.NODE_ENV === 'development' ? '1000' : '100'), 10),
      loginMaxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS || (process.env.NODE_ENV === 'development' ? '50' : '5'), 10),
      loginWindowMs: parseInt(process.env.LOGIN_WINDOW_MS || '900000', 10), // 15 minutes
      pinMaxAttempts: parseInt(process.env.PIN_MAX_ATTEMPTS || (process.env.NODE_ENV === 'development' ? '50' : '3'), 10),
      pinWindowMs: parseInt(process.env.PIN_WINDOW_MS || '300000', 10), // 5 minutes
    },
    // Account lockout
    lockout: {
      maxAttempts: parseInt(process.env.LOCKOUT_MAX_ATTEMPTS || '5', 10),
      durationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15', 10),
    },
    // Session
    sessionSecret: process.env.SESSION_SECRET || '',
  },

  // Helpers
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
};

// Validate required env vars
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
const requiredInProduction = ['SESSION_SECRET'];

export function validateConfig(): void {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Additional validation for production
  if (config.isProd) {
    const missingProd = requiredInProduction.filter((key) => !process.env[key]);
    if (missingProd.length > 0) {
      throw new Error(`Missing required production environment variables: ${missingProd.join(', ')}`);
    }
  }

  // SECURITY: Validate JWT secret strength
  if (config.jwt.secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }

  // SECURITY: Warn about weak secrets in production
  if (config.isProd) {
    const weakPatterns = ['secret', 'password', 'test', 'demo', 'example', 'change'];
    const secretLower = config.jwt.secret.toLowerCase();
    if (weakPatterns.some(pattern => secretLower.includes(pattern))) {
      console.warn('\n⚠️  WARNING: JWT_SECRET appears to contain weak patterns. Use a strong random secret in production!\n');
    }
  }
}
