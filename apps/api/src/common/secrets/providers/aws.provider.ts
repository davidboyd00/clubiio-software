// ============================================
// AWS SECRETS MANAGER PROVIDER
// ============================================
// Production-grade secrets provider using AWS Secrets Manager
// Requires @aws-sdk/client-secrets-manager package (optional dependency)

import type { ISecretsProvider, SecretName, SecretsConfig } from '../secrets.types';
import { logger } from '../../logger';

// Type definitions for AWS SDK (to avoid requiring the package at compile time)
interface AwsSecretsManagerClient {
  send(command: unknown): Promise<{ SecretString?: string }>;
}

interface AwsCommandConstructor {
  new (input: { SecretId: string }): unknown;
}

interface AwsListCommandConstructor {
  new (input: { MaxResults: number }): unknown;
}

/**
 * AWS Secrets Manager provider
 *
 * Secrets should be stored in AWS Secrets Manager with the format:
 * - Individual secrets: {prefix}JWT_SECRET, {prefix}DATABASE_URL, etc.
 * - Or as a single JSON secret: {prefix}secrets containing all values
 */
export class AwsSecretsProvider implements ISecretsProvider {
  private client: AwsSecretsManagerClient | null = null;
  private GetSecretValueCommand: AwsCommandConstructor | null = null;
  private ListSecretsCommand: AwsListCommandConstructor | null = null;
  private region: string;
  private prefix: string;
  private secretsCache: Map<string, string> = new Map();
  private initialized = false;

  constructor(config: SecretsConfig['aws']) {
    if (!config) {
      throw new Error('AWS secrets configuration is required');
    }
    this.region = config.region;
    this.prefix = config.secretPrefix || 'clubio/';
  }

  /**
   * Lazy initialization of AWS SDK
   * This allows the app to start even if AWS SDK is not installed
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic require to avoid bundling AWS SDK when not needed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const awsModule = require('@aws-sdk/client-secrets-manager') as {
        SecretsManagerClient: new (config: { region: string }) => AwsSecretsManagerClient;
        GetSecretValueCommand: AwsCommandConstructor;
        ListSecretsCommand: AwsListCommandConstructor;
      };

      const { SecretsManagerClient, GetSecretValueCommand, ListSecretsCommand } = awsModule;

      this.client = new SecretsManagerClient({ region: this.region });
      this.GetSecretValueCommand = GetSecretValueCommand;
      this.ListSecretsCommand = ListSecretsCommand;
      this.initialized = true;

      logger.info('AWS Secrets Manager provider initialized', {
        region: this.region,
        prefix: this.prefix,
      });
    } catch {
      throw new Error(
        'AWS SDK not installed. Run: pnpm add @aws-sdk/client-secrets-manager'
      );
    }
  }

  async getSecret(name: SecretName): Promise<string | undefined> {
    await this.initialize();

    // Check cache first
    if (this.secretsCache.has(name)) {
      return this.secretsCache.get(name);
    }

    try {
      const secretId = `${this.prefix}${name}`;
      const command = new this.GetSecretValueCommand!({ SecretId: secretId });
      const response = await this.client!.send(command);

      let value: string | undefined;

      if (response.SecretString) {
        // Try to parse as JSON (for bundled secrets)
        try {
          const parsed = JSON.parse(response.SecretString);
          if (typeof parsed === 'object' && parsed[name]) {
            value = parsed[name];
          } else if (typeof parsed === 'string') {
            value = parsed;
          } else {
            value = response.SecretString;
          }
        } catch {
          // Not JSON, use as plain string
          value = response.SecretString;
        }
      }

      if (value) {
        this.secretsCache.set(name, value);
      }

      return value;
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        logger.warn(`Secret not found in AWS: ${name}`);
        return undefined;
      }
      logger.error('Error fetching secret from AWS', {
        secret: name,
        error: error.message,
      });
      throw error;
    }
  }

  async getSecrets(names: SecretName[]): Promise<Map<SecretName, string | undefined>> {
    await this.initialize();

    const results = new Map<SecretName, string | undefined>();

    // First, try to get bundled secrets (more efficient)
    try {
      const bundledSecrets = await this.getBundledSecrets();
      if (bundledSecrets) {
        for (const name of names) {
          results.set(name, bundledSecrets[name]);
        }
        return results;
      }
    } catch {
      // Fall through to individual fetching
    }

    // Fetch each secret individually
    for (const name of names) {
      const value = await this.getSecret(name);
      results.set(name, value);
    }

    return results;
  }

  /**
   * Try to get all secrets from a single bundled secret
   */
  private async getBundledSecrets(): Promise<Record<string, string> | null> {
    try {
      const secretId = `${this.prefix}secrets`;
      const command = new this.GetSecretValueCommand!({ SecretId: secretId });
      const response = await this.client!.send(command);

      if (response.SecretString) {
        const parsed = JSON.parse(response.SecretString);
        if (typeof parsed === 'object') {
          // Cache all secrets
          for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === 'string') {
              this.secretsCache.set(key, value);
            }
          }
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.initialize();
      // Try to list secrets to verify connection
      const command = new this.ListSecretsCommand!({ MaxResults: 1 });
      await this.client!.send(command);
      return true;
    } catch (error) {
      logger.error('AWS Secrets Manager health check failed', { error });
      return false;
    }
  }
}
