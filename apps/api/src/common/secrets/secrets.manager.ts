// ============================================
// SECRETS MANAGER SERVICE
// ============================================
// Centralized secrets management with caching
// Supports multiple providers: AWS, GCP, Azure, Env

import type {
  SecretsConfig,
  SecretsProvider,
  SecretName,
  ISecretsProvider,
  CachedSecret,
} from './secrets.types';
import {
  REQUIRED_SECRETS,
  PRODUCTION_REQUIRED_SECRETS,
  SECRET_DESCRIPTIONS,
} from './secrets.types';
import { EnvSecretsProvider } from './providers/env.provider';
import { AwsSecretsProvider } from './providers/aws.provider';
import { logger } from '../logger';

// Default cache TTL: 5 minutes
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Centralized secrets manager
 * Handles caching, validation, and provider abstraction
 */
class SecretsManager {
  private provider: ISecretsProvider | null = null;
  private providerType: SecretsProvider = 'env';
  private cache: Map<SecretName, CachedSecret> = new Map();
  private cacheTtlMs: number = DEFAULT_CACHE_TTL_MS;
  private throwOnMissing: boolean = true;
  private initialized: boolean = false;

  /**
   * Initialize the secrets manager with configuration
   * Should be called once at application startup
   */
  async initialize(config?: Partial<SecretsConfig>): Promise<void> {
    if (this.initialized) {
      logger.warn('SecretsManager already initialized, skipping');
      return;
    }

    const isProd = process.env.NODE_ENV === 'production';
    const providerType = config?.provider || (process.env.SECRETS_PROVIDER as SecretsProvider) || 'env';

    this.providerType = providerType;
    this.cacheTtlMs = config?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.throwOnMissing = config?.throwOnMissing ?? isProd;

    // Create provider based on configuration
    switch (providerType) {
      case 'aws':
        const awsConfig = config?.aws || {
          region: process.env.AWS_REGION || 'us-east-1',
          secretPrefix: process.env.AWS_SECRET_PREFIX || 'clubio/',
        };
        this.provider = new AwsSecretsProvider(awsConfig);
        break;

      case 'gcp':
        // TODO: Implement GCP provider
        throw new Error('GCP secrets provider not yet implemented');

      case 'azure':
        // TODO: Implement Azure provider
        throw new Error('Azure secrets provider not yet implemented');

      case 'env':
      default:
        this.provider = new EnvSecretsProvider();
        break;
    }

    // Validate required secrets
    await this.validateRequiredSecrets(isProd);

    this.initialized = true;
    logger.info('SecretsManager initialized', {
      provider: providerType,
      cacheTtlMs: this.cacheTtlMs,
    });
  }

  /**
   * Get a secret value by name
   * Returns cached value if available and not expired
   */
  async getSecret(name: SecretName): Promise<string> {
    this.ensureInitialized();

    // Check cache first
    const cached = this.cache.get(name);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // Fetch from provider
    const value = await this.provider!.getSecret(name);

    if (!value) {
      if (this.throwOnMissing) {
        throw new Error(`Required secret not found: ${name}. ${SECRET_DESCRIPTIONS[name]}`);
      }
      logger.warn(`Secret not found: ${name}`);
      return '';
    }

    // Cache the value
    this.cache.set(name, {
      value,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return value;
  }

  /**
   * Get multiple secrets at once
   * More efficient for fetching several secrets
   */
  async getSecrets(names: SecretName[]): Promise<Record<SecretName, string>> {
    this.ensureInitialized();

    const results: Partial<Record<SecretName, string>> = {};
    const toFetch: SecretName[] = [];

    // Check cache first
    for (const name of names) {
      const cached = this.cache.get(name);
      if (cached && cached.expiresAt > Date.now()) {
        results[name] = cached.value;
      } else {
        toFetch.push(name);
      }
    }

    // Fetch missing secrets
    if (toFetch.length > 0) {
      const fetched = await this.provider!.getSecrets(toFetch);

      for (const [name, value] of fetched.entries()) {
        if (value) {
          this.cache.set(name, {
            value,
            expiresAt: Date.now() + this.cacheTtlMs,
          });
          results[name] = value;
        } else if (this.throwOnMissing) {
          throw new Error(`Required secret not found: ${name}`);
        }
      }
    }

    return results as Record<SecretName, string>;
  }

  /**
   * Clear the secrets cache
   * Call this if secrets need to be refreshed
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Secrets cache cleared');
  }

  /**
   * Get the current provider type
   */
  getProviderType(): SecretsProvider {
    return this.providerType;
  }

  /**
   * Check if secrets manager is healthy
   */
  async healthCheck(): Promise<{ healthy: boolean; provider: SecretsProvider }> {
    if (!this.initialized || !this.provider) {
      return { healthy: false, provider: this.providerType };
    }

    const healthy = await this.provider.healthCheck();
    return { healthy, provider: this.providerType };
  }

  /**
   * Validate that all required secrets are available
   */
  private async validateRequiredSecrets(isProd: boolean): Promise<void> {
    const allRequired = isProd
      ? [...REQUIRED_SECRETS, ...PRODUCTION_REQUIRED_SECRETS]
      : REQUIRED_SECRETS;

    const missing: string[] = [];

    for (const name of allRequired) {
      const value = await this.provider!.getSecret(name);
      if (!value) {
        missing.push(name);
      } else {
        // Cache the validated secret
        this.cache.set(name, {
          value,
          expiresAt: Date.now() + this.cacheTtlMs,
        });

        // Validate secret strength for sensitive secrets
        if (name.includes('SECRET') || name.includes('KEY')) {
          this.validateSecretStrength(name, value);
        }
      }
    }

    if (missing.length > 0) {
      const details = missing.map(name => `  - ${name}: ${SECRET_DESCRIPTIONS[name as SecretName]}`).join('\n');
      throw new Error(`Missing required secrets:\n${details}`);
    }
  }

  /**
   * Validate that a secret meets minimum security requirements
   */
  private validateSecretStrength(name: SecretName, value: string): void {
    const isProd = process.env.NODE_ENV === 'production';

    // Minimum length check
    if (value.length < 32) {
      const msg = `${name} must be at least 32 characters long`;
      if (isProd) {
        throw new Error(msg);
      }
      logger.warn(msg);
    }

    // Weak pattern check (only in production)
    if (isProd) {
      const weakPatterns = ['secret', 'password', 'test', 'demo', 'example', 'change', '12345'];
      const valueLower = value.toLowerCase();

      if (weakPatterns.some(pattern => valueLower.includes(pattern))) {
        logger.warn(`⚠️  ${name} appears to contain weak patterns. Use a strong random value!`);
      }
    }
  }

  /**
   * Ensure the manager is initialized before use
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.provider) {
      throw new Error('SecretsManager not initialized. Call initialize() first.');
    }
  }
}

// Export singleton instance
export const secretsManager = new SecretsManager();

// Export for testing
export { SecretsManager };
