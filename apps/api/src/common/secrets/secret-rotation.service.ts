// ============================================
// SECRET ROTATION SERVICE
// ============================================
// Handles key versioning and graceful secret rotation
// Allows old secrets to remain valid during transition period

import crypto from 'crypto';
import { logger } from '../logger';

interface KeyVersion {
  id: string;
  key: string;
  createdAt: Date;
  expiresAt: Date | null;
  isPrimary: boolean;
}

interface RotationConfig {
  // How long old keys remain valid after rotation (default: 24 hours)
  gracePeriodMs: number;
  // Maximum number of key versions to keep
  maxVersions: number;
  // Whether to auto-rotate keys based on age
  autoRotate: boolean;
  // Auto-rotation interval (default: 30 days)
  autoRotateIntervalMs: number;
}

const DEFAULT_CONFIG: RotationConfig = {
  gracePeriodMs: 24 * 60 * 60 * 1000, // 24 hours
  maxVersions: 3,
  autoRotate: false,
  autoRotateIntervalMs: 30 * 24 * 60 * 60 * 1000, // 30 days
};

/**
 * Secret Rotation Service
 * Manages multiple versions of secrets with graceful rotation
 */
export class SecretRotationService {
  private keyVersions: Map<string, KeyVersion[]> = new Map();
  private config: RotationConfig;
  private rotationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<RotationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize a secret with its initial value
   * Call this at startup with the current secret value
   */
  initializeSecret(secretName: string, initialValue: string): void {
    const versions = this.keyVersions.get(secretName) || [];

    if (versions.length > 0) {
      logger.warn(`Secret ${secretName} already initialized, skipping`);
      return;
    }

    const version: KeyVersion = {
      id: this.generateVersionId(),
      key: initialValue,
      createdAt: new Date(),
      expiresAt: null, // Primary key doesn't expire
      isPrimary: true,
    };

    this.keyVersions.set(secretName, [version]);

    logger.info('Secret initialized', {
      secretName,
      versionId: version.id,
      isPrimary: true,
    });

    // Setup auto-rotation if enabled
    if (this.config.autoRotate) {
      this.scheduleAutoRotation(secretName);
    }
  }

  /**
   * Get the primary (current) secret value for signing new tokens
   */
  getPrimarySecret(secretName: string): string {
    const versions = this.keyVersions.get(secretName);

    if (!versions || versions.length === 0) {
      throw new Error(`Secret not initialized: ${secretName}`);
    }

    const primary = versions.find((v) => v.isPrimary);

    if (!primary) {
      throw new Error(`No primary secret version for: ${secretName}`);
    }

    return primary.key;
  }

  /**
   * Get the primary secret version ID (for including in tokens)
   */
  getPrimaryVersionId(secretName: string): string {
    const versions = this.keyVersions.get(secretName);

    if (!versions || versions.length === 0) {
      throw new Error(`Secret not initialized: ${secretName}`);
    }

    const primary = versions.find((v) => v.isPrimary);

    if (!primary) {
      throw new Error(`No primary secret version for: ${secretName}`);
    }

    return primary.id;
  }

  /**
   * Get all valid secret values for verification
   * Returns array of [versionId, key] tuples
   * Used when verifying tokens that might be signed with older keys
   */
  getValidSecrets(secretName: string): Array<[string, string]> {
    const versions = this.keyVersions.get(secretName);

    if (!versions || versions.length === 0) {
      throw new Error(`Secret not initialized: ${secretName}`);
    }

    const now = new Date();

    // Filter to only valid (not expired) versions
    return versions
      .filter((v) => v.expiresAt === null || v.expiresAt > now)
      .map((v) => [v.id, v.key]);
  }

  /**
   * Get a specific secret by version ID
   */
  getSecretByVersion(secretName: string, versionId: string): string | null {
    const versions = this.keyVersions.get(secretName);

    if (!versions) {
      return null;
    }

    const version = versions.find((v) => v.id === versionId);

    if (!version) {
      return null;
    }

    // Check if expired
    if (version.expiresAt && version.expiresAt < new Date()) {
      return null;
    }

    return version.key;
  }

  /**
   * Rotate a secret to a new value
   * The old value remains valid for the grace period
   */
  rotateSecret(secretName: string, newValue: string): string {
    const versions = this.keyVersions.get(secretName);

    if (!versions || versions.length === 0) {
      throw new Error(`Secret not initialized: ${secretName}`);
    }

    // Mark the current primary as expiring after grace period
    const now = new Date();
    const graceExpiry = new Date(now.getTime() + this.config.gracePeriodMs);

    for (const version of versions) {
      if (version.isPrimary) {
        version.isPrimary = false;
        version.expiresAt = graceExpiry;
      }
    }

    // Create new primary version
    const newVersion: KeyVersion = {
      id: this.generateVersionId(),
      key: newValue,
      createdAt: now,
      expiresAt: null,
      isPrimary: true,
    };

    versions.unshift(newVersion);

    // Cleanup old expired versions
    this.cleanupExpiredVersions(secretName);

    // Keep only maxVersions
    if (versions.length > this.config.maxVersions) {
      versions.splice(this.config.maxVersions);
    }

    logger.info('Secret rotated', {
      secretName,
      newVersionId: newVersion.id,
      totalVersions: versions.length,
      gracePeriodHours: this.config.gracePeriodMs / (60 * 60 * 1000),
    });

    return newVersion.id;
  }

  /**
   * Rotate a secret with an auto-generated strong value
   */
  rotateSecretAuto(secretName: string, length: number = 64): string {
    const newValue = crypto.randomBytes(length).toString('base64');
    return this.rotateSecret(secretName, newValue);
  }

  /**
   * Force expire all non-primary versions
   * Use in case of security breach to invalidate old tokens immediately
   */
  forceExpireOldVersions(secretName: string): void {
    const versions = this.keyVersions.get(secretName);

    if (!versions) {
      return;
    }

    const now = new Date();

    for (const version of versions) {
      if (!version.isPrimary && version.expiresAt && version.expiresAt > now) {
        version.expiresAt = now;
      }
    }

    // Cleanup expired versions
    this.cleanupExpiredVersions(secretName);

    logger.warn('Force expired old secret versions', {
      secretName,
      remainingVersions: this.keyVersions.get(secretName)?.length || 0,
    });
  }

  /**
   * Get rotation status for a secret
   */
  getRotationStatus(secretName: string): {
    initialized: boolean;
    versionCount: number;
    primaryVersionId: string | null;
    primaryCreatedAt: Date | null;
    oldestValidVersion: Date | null;
    nextAutoRotation: Date | null;
  } {
    const versions = this.keyVersions.get(secretName);

    if (!versions || versions.length === 0) {
      return {
        initialized: false,
        versionCount: 0,
        primaryVersionId: null,
        primaryCreatedAt: null,
        oldestValidVersion: null,
        nextAutoRotation: null,
      };
    }

    const primary = versions.find((v) => v.isPrimary);
    const validVersions = versions.filter(
      (v) => v.expiresAt === null || v.expiresAt > new Date()
    );
    const oldest = validVersions.length > 0
      ? validVersions.reduce((min, v) =>
          v.createdAt < min.createdAt ? v : min
        )
      : null;

    let nextAutoRotation: Date | null = null;
    if (this.config.autoRotate && primary) {
      nextAutoRotation = new Date(
        primary.createdAt.getTime() + this.config.autoRotateIntervalMs
      );
    }

    return {
      initialized: true,
      versionCount: validVersions.length,
      primaryVersionId: primary?.id || null,
      primaryCreatedAt: primary?.createdAt || null,
      oldestValidVersion: oldest?.createdAt || null,
      nextAutoRotation,
    };
  }

  /**
   * Cleanup all secrets and timers
   */
  shutdown(): void {
    for (const [, timer] of this.rotationTimers) {
      clearTimeout(timer);
    }
    this.rotationTimers.clear();
    this.keyVersions.clear();
    logger.info('SecretRotationService shutdown complete');
  }

  // Private helpers

  private generateVersionId(): string {
    return `v${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  private cleanupExpiredVersions(secretName: string): void {
    const versions = this.keyVersions.get(secretName);

    if (!versions) {
      return;
    }

    const now = new Date();
    const validVersions = versions.filter(
      (v) => v.isPrimary || v.expiresAt === null || v.expiresAt > now
    );

    if (validVersions.length !== versions.length) {
      this.keyVersions.set(secretName, validVersions);
      logger.info('Cleaned up expired secret versions', {
        secretName,
        removed: versions.length - validVersions.length,
        remaining: validVersions.length,
      });
    }
  }

  private scheduleAutoRotation(secretName: string): void {
    // Clear existing timer if any
    const existingTimer = this.rotationTimers.get(secretName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      logger.info('Auto-rotating secret', { secretName });
      this.rotateSecretAuto(secretName);
      this.scheduleAutoRotation(secretName);
    }, this.config.autoRotateIntervalMs);

    // Don't keep the process alive just for rotation
    timer.unref();

    this.rotationTimers.set(secretName, timer);
  }
}

// Export singleton instance with default config
export const secretRotation = new SecretRotationService();
