// ============================================
// SECRETS CONFIGURATION LOADER
// ============================================
// Async configuration loader that fetches secrets from secrets manager
// Use this for production deployments with external secrets providers

import { secretsManager, type SecretsConfig } from '../common/secrets';
import { logger } from '../common/logger';

/**
 * Application secrets loaded from secrets manager
 */
export interface AppSecrets {
  jwtSecret: string;
  jwtRefreshSecret: string;
  sessionSecret: string;
  csrfSecret: string;
  databaseUrl: string;
  mfaEncryptionKey?: string;
  apiEncryptionKey?: string;
}

/**
 * Load all application secrets from the configured provider
 * Should be called once during application bootstrap
 */
export async function loadSecrets(config?: Partial<SecretsConfig>): Promise<AppSecrets> {
  const startTime = Date.now();

  try {
    // Initialize secrets manager
    await secretsManager.initialize(config);

    // Fetch all required secrets
    const secrets = await secretsManager.getSecrets([
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'SESSION_SECRET',
      'CSRF_SECRET',
      'DATABASE_URL',
      'MFA_ENCRYPTION_KEY',
      'API_ENCRYPTION_KEY',
    ]);

    const duration = Date.now() - startTime;
    logger.info('Secrets loaded successfully', {
      provider: secretsManager.getProviderType(),
      duration: `${duration}ms`,
    });

    return {
      jwtSecret: secrets.JWT_SECRET,
      jwtRefreshSecret: secrets.JWT_REFRESH_SECRET || secrets.JWT_SECRET,
      sessionSecret: secrets.SESSION_SECRET,
      csrfSecret: secrets.CSRF_SECRET || secrets.SESSION_SECRET,
      databaseUrl: secrets.DATABASE_URL,
      mfaEncryptionKey: secrets.MFA_ENCRYPTION_KEY,
      apiEncryptionKey: secrets.API_ENCRYPTION_KEY,
    };
  } catch (error) {
    logger.error('Failed to load secrets', { error });
    throw error;
  }
}

/**
 * Generate a cryptographically secure random secret
 * Use this to generate new secrets for deployment
 */
export function generateSecureSecret(length: number = 64): string {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Print command to generate all required secrets
 */
export function printSecretGenerationHelp(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                   SECRETS GENERATION GUIDE                      ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Generate secure secrets for production deployment:            ║
║                                                                 ║
║  JWT_SECRET:                                                    ║
║    openssl rand -base64 64                                      ║
║                                                                 ║
║  JWT_REFRESH_SECRET:                                            ║
║    openssl rand -base64 64                                      ║
║                                                                 ║
║  SESSION_SECRET:                                                ║
║    openssl rand -base64 48                                      ║
║                                                                 ║
║  CSRF_SECRET:                                                   ║
║    openssl rand -base64 48                                      ║
║                                                                 ║
║  MFA_ENCRYPTION_KEY:                                            ║
║    openssl rand -base64 32                                      ║
║                                                                 ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  AWS Secrets Manager Setup:                                     ║
║                                                                 ║
║  1. Create a secret in AWS Secrets Manager:                     ║
║     aws secretsmanager create-secret \\                         ║
║       --name clubio/production/secrets \\                       ║
║       --secret-string '{                                        ║
║         "JWT_SECRET": "<generated>",                            ║
║         "JWT_REFRESH_SECRET": "<generated>",                    ║
║         "SESSION_SECRET": "<generated>",                        ║
║         "CSRF_SECRET": "<generated>",                           ║
║         "DATABASE_URL": "<connection-string>"                   ║
║       }'                                                        ║
║                                                                 ║
║  2. Set environment variables:                                  ║
║     SECRETS_PROVIDER=aws                                        ║
║     AWS_REGION=us-east-1                                        ║
║     AWS_SECRET_PREFIX=clubio/production/                        ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
`);
}
