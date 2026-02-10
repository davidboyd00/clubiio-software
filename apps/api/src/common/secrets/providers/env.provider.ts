// ============================================
// ENVIRONMENT VARIABLES PROVIDER
// ============================================
// Fallback provider that reads from process.env
// Used for local development and testing

import type { ISecretsProvider, SecretName } from '../secrets.types';

/**
 * Environment variables secrets provider
 * Reads secrets directly from process.env
 */
export class EnvSecretsProvider implements ISecretsProvider {
  async getSecret(name: SecretName): Promise<string | undefined> {
    return process.env[name];
  }

  async getSecrets(names: SecretName[]): Promise<Map<SecretName, string | undefined>> {
    const results = new Map<SecretName, string | undefined>();
    for (const name of names) {
      results.set(name, process.env[name]);
    }
    return results;
  }

  async healthCheck(): Promise<boolean> {
    // Environment provider is always healthy
    return true;
  }
}
