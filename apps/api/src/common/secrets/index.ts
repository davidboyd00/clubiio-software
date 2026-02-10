// ============================================
// SECRETS MANAGER - PUBLIC API
// ============================================

export { secretsManager, SecretsManager } from './secrets.manager';
export type {
  SecretsConfig,
  SecretsProvider,
  SecretName,
  ISecretsProvider,
} from './secrets.types';
export {
  REQUIRED_SECRETS,
  PRODUCTION_REQUIRED_SECRETS,
  SECRET_DESCRIPTIONS,
} from './secrets.types';
