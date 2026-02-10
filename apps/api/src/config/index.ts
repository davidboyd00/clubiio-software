import dotenv from 'dotenv';

dotenv.config();

// ============================================
// APPLICATION CONFIGURATION
// ============================================
// Supports both environment variables and secrets manager
// Use SECRETS_PROVIDER=aws|gcp|azure for production deployments

/**
 * Mutable configuration object
 * Secrets are loaded at startup via initializeSecrets()
 */
export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database - loaded from secrets in production
  databaseUrl: process.env.DATABASE_URL || '',

  // JWT - SECURITY: Loaded from secrets manager in production
  jwt: {
    secret: process.env.JWT_SECRET || '',
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
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
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX || (process.env.NODE_ENV === 'development' ? '1000' : '100'), 10),
      loginMaxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS || (process.env.NODE_ENV === 'development' ? '50' : '5'), 10),
      loginWindowMs: parseInt(process.env.LOGIN_WINDOW_MS || '900000', 10),
      pinMaxAttempts: parseInt(process.env.PIN_MAX_ATTEMPTS || (process.env.NODE_ENV === 'development' ? '50' : '3'), 10),
      pinWindowMs: parseInt(process.env.PIN_WINDOW_MS || '300000', 10),
    },
    // Account lockout
    lockout: {
      maxAttempts: parseInt(process.env.LOCKOUT_MAX_ATTEMPTS || '5', 10),
      durationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15', 10),
    },
    // Session & CSRF secrets - loaded from secrets manager in production
    sessionSecret: process.env.SESSION_SECRET || '',
    csrfSecret: process.env.CSRF_SECRET || process.env.SESSION_SECRET || '',
  },

  // Secrets provider configuration
  secrets: {
    provider: (process.env.SECRETS_PROVIDER || 'env') as 'aws' | 'gcp' | 'azure' | 'env',
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      secretPrefix: process.env.AWS_SECRET_PREFIX || 'clubio/',
    },
  },

  // Helpers
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
};

// ============================================
// CONFIGURATION INITIALIZATION
// ============================================

import { secretsManager, type SecretsProvider } from '../common/secrets';
import { logger } from '../common/logger';

/**
 * Initialize secrets from the configured provider
 * Call this at application startup before using config.jwt.secret, etc.
 */
export async function initializeSecrets(): Promise<void> {
  const provider = config.secrets.provider;

  // For 'env' provider, just validate existing environment variables
  if (provider === 'env') {
    validateEnvSecrets();
    return;
  }

  // For cloud providers, load secrets asynchronously
  try {
    await secretsManager.initialize({
      provider: provider as SecretsProvider,
      aws: config.secrets.aws,
      throwOnMissing: config.isProd,
    });

    // Load and apply secrets to config
    const secrets = await secretsManager.getSecrets([
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'SESSION_SECRET',
      'CSRF_SECRET',
      'DATABASE_URL',
    ]);

    // Update config with loaded secrets
    config.jwt.secret = secrets.JWT_SECRET;
    config.jwt.refreshSecret = secrets.JWT_REFRESH_SECRET || secrets.JWT_SECRET;
    config.security.sessionSecret = secrets.SESSION_SECRET;
    config.security.csrfSecret = secrets.CSRF_SECRET || secrets.SESSION_SECRET;
    config.databaseUrl = secrets.DATABASE_URL;

    logger.info('Configuration secrets loaded', {
      provider,
      secretsLoaded: Object.keys(secrets).length,
    });
  } catch (error) {
    logger.error('Failed to load secrets from provider', { provider, error });
    throw error;
  }
}

/**
 * Validate secrets when using environment variables
 */
function validateEnvSecrets(): void {
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
  const requiredInProduction = ['SESSION_SECRET'];

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

/**
 * Legacy sync validation - use initializeSecrets() instead for production
 * @deprecated Use initializeSecrets() for async secrets loading
 */
export function validateConfig(): void {
  validateEnvSecrets();
}
