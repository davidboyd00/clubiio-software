// ============================================
// VERSIONED JWT SERVICE
// ============================================
// JWT service with key version support for secret rotation
// Tokens include key version ID for verification

import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { secretRotation } from './secret-rotation.service';
import { logger } from '../logger';

const SECRET_NAME = 'JWT_SECRET';

interface SignResult {
  token: string;
  keyVersion: string;
}

interface VerifyResult<T = JwtPayload> {
  payload: T;
  keyVersion: string;
  isOldKey: boolean;
}

/**
 * Versioned JWT Service
 * Handles JWT signing/verification with key rotation support
 */
export class VersionedJwtService {
  private initialized = false;

  /**
   * Initialize with the current JWT secret
   * Call this at application startup
   */
  initialize(jwtSecret: string): void {
    if (this.initialized) {
      logger.warn('VersionedJwtService already initialized');
      return;
    }

    secretRotation.initializeSecret(SECRET_NAME, jwtSecret);
    this.initialized = true;
    logger.info('VersionedJwtService initialized');
  }

  /**
   * Sign a JWT with the current primary key
   * Includes key version ID in the header
   */
  sign(payload: object, options: SignOptions = {}): SignResult {
    this.ensureInitialized();

    const secret = secretRotation.getPrimarySecret(SECRET_NAME);
    const keyVersion = secretRotation.getPrimaryVersionId(SECRET_NAME);

    // Include key version in header (standard JWT 'kid' claim)
    const signOptions: SignOptions = {
      ...options,
      keyid: keyVersion,
    };

    const token = jwt.sign(payload, secret, signOptions);

    return { token, keyVersion };
  }

  /**
   * Verify a JWT, trying multiple key versions if needed
   * Returns the payload along with key version info
   */
  verify<T extends JwtPayload = JwtPayload>(token: string): VerifyResult<T> {
    this.ensureInitialized();

    // First, try to decode the token to get the key version
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded) {
      throw new jwt.JsonWebTokenError('Invalid token format');
    }

    const kid = decoded.header.kid;
    const primaryVersionId = secretRotation.getPrimaryVersionId(SECRET_NAME);

    // If we have a key ID, try that specific version first
    if (kid) {
      const specificSecret = secretRotation.getSecretByVersion(SECRET_NAME, kid);

      if (specificSecret) {
        try {
          const payload = jwt.verify(token, specificSecret) as T;
          return {
            payload,
            keyVersion: kid,
            isOldKey: kid !== primaryVersionId,
          };
        } catch (error) {
          // Key version found but verification failed
          logger.warn('JWT verification failed for specified key version', {
            kid,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }
      }
    }

    // No key ID or key ID not found - try all valid keys
    const validSecrets = secretRotation.getValidSecrets(SECRET_NAME);
    let lastError: Error | null = null;

    for (const [versionId, secret] of validSecrets) {
      try {
        const payload = jwt.verify(token, secret) as T;

        // Log if token was verified with an old key
        if (versionId !== primaryVersionId) {
          logger.info('JWT verified with old key version', {
            versionId,
            primaryVersionId,
            sub: payload.sub,
          });
        }

        return {
          payload,
          keyVersion: versionId,
          isOldKey: versionId !== primaryVersionId,
        };
      } catch (error) {
        lastError = error as Error;
        // Continue trying other keys
      }
    }

    // All keys failed
    throw lastError || new jwt.JsonWebTokenError('Token verification failed');
  }

  /**
   * Rotate the JWT secret
   * All existing tokens signed with the old key will remain valid
   * for the grace period (default: 24 hours)
   */
  rotateSecret(newSecret?: string): string {
    this.ensureInitialized();

    if (newSecret) {
      return secretRotation.rotateSecret(SECRET_NAME, newSecret);
    } else {
      return secretRotation.rotateSecretAuto(SECRET_NAME);
    }
  }

  /**
   * Force invalidate all tokens signed with old keys
   * Use in case of security breach
   */
  forceInvalidateOldTokens(): void {
    this.ensureInitialized();
    secretRotation.forceExpireOldVersions(SECRET_NAME);
    logger.warn('Force invalidated all old JWT keys');
  }

  /**
   * Get the current rotation status
   */
  getRotationStatus() {
    return secretRotation.getRotationStatus(SECRET_NAME);
  }

  /**
   * Check if a token was signed with an old key
   * Useful for prompting users to re-authenticate
   */
  isTokenUsingOldKey(token: string): boolean {
    try {
      const result = this.verify(token);
      return result.isOldKey;
    } catch {
      return false;
    }
  }

  /**
   * Refresh a token signed with an old key to use the new key
   * Returns the new token with the same payload
   */
  refreshTokenKey<T extends JwtPayload = JwtPayload>(
    oldToken: string,
    options: SignOptions = {}
  ): SignResult | null {
    try {
      const { payload, isOldKey } = this.verify<T>(oldToken);

      if (!isOldKey) {
        return null; // Token is already using current key
      }

      // Extract claims we want to preserve
      const { iat, exp, nbf, jti, ...restPayload } = payload;

      // Sign with new key (will get new iat, exp)
      return this.sign(restPayload, options);
    } catch {
      return null;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('VersionedJwtService not initialized. Call initialize() first.');
    }
  }
}

// Export singleton instance
export const versionedJwt = new VersionedJwtService();
