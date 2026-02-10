// ============================================
// SECRETS MANAGER - TYPES
// ============================================
// Type definitions for secrets management
// Supports multiple providers: AWS, GCP, Azure, Env

/**
 * Supported secrets providers
 */
export type SecretsProvider = 'aws' | 'gcp' | 'azure' | 'env';

/**
 * Secret names used in the application
 */
export type SecretName =
  | 'JWT_SECRET'
  | 'JWT_REFRESH_SECRET'
  | 'SESSION_SECRET'
  | 'CSRF_SECRET'
  | 'DATABASE_URL'
  | 'MFA_ENCRYPTION_KEY'
  | 'API_ENCRYPTION_KEY';

/**
 * Configuration for secrets manager
 */
export interface SecretsConfig {
  /**
   * Provider to use (aws, gcp, azure, env)
   * Default: 'env' for development, should be set explicitly for production
   */
  provider: SecretsProvider;

  /**
   * AWS-specific configuration
   */
  aws?: {
    region: string;
    secretPrefix?: string; // e.g., 'clubio/production/'
  };

  /**
   * GCP-specific configuration
   */
  gcp?: {
    projectId: string;
    secretPrefix?: string;
  };

  /**
   * Azure-specific configuration
   */
  azure?: {
    vaultUrl: string;
    secretPrefix?: string;
  };

  /**
   * Cache TTL in milliseconds (default: 5 minutes)
   */
  cacheTtlMs?: number;

  /**
   * Whether to throw on missing secrets (default: true in production)
   */
  throwOnMissing?: boolean;
}

/**
 * Interface for secrets provider implementations
 */
export interface ISecretsProvider {
  /**
   * Get a secret value by name
   */
  getSecret(name: SecretName): Promise<string | undefined>;

  /**
   * Get multiple secrets at once (for efficiency)
   */
  getSecrets(names: SecretName[]): Promise<Map<SecretName, string | undefined>>;

  /**
   * Check if provider is healthy/connected
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Cached secret entry
 */
export interface CachedSecret {
  value: string;
  expiresAt: number;
}

/**
 * Required secrets for the application
 */
export const REQUIRED_SECRETS: SecretName[] = [
  'JWT_SECRET',
  'DATABASE_URL',
];

/**
 * Secrets required only in production
 */
export const PRODUCTION_REQUIRED_SECRETS: SecretName[] = [
  'SESSION_SECRET',
  'CSRF_SECRET',
  'JWT_REFRESH_SECRET',
];

/**
 * All secrets with their descriptions
 */
export const SECRET_DESCRIPTIONS: Record<SecretName, string> = {
  JWT_SECRET: 'Secret key for signing JWT access tokens (min 32 chars)',
  JWT_REFRESH_SECRET: 'Secret key for signing JWT refresh tokens (min 32 chars)',
  SESSION_SECRET: 'Secret key for session management',
  CSRF_SECRET: 'Secret key for CSRF token generation',
  DATABASE_URL: 'PostgreSQL connection string',
  MFA_ENCRYPTION_KEY: 'Key for encrypting MFA secrets at rest',
  API_ENCRYPTION_KEY: 'General purpose encryption key for sensitive data',
};
