// ============================================
// ENCRYPTION SERVICE
// ============================================
// AES-256-GCM encryption for sensitive data fields
// Use for MFA secrets, SSN, bank account numbers, etc.

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

interface EncryptedData {
  ciphertext: string;
  keyVersion: string;
}

interface EncryptionConfig {
  algorithm: 'aes-256-gcm';
  keyLength: number;
  ivLength: number;
  authTagLength: number;
  saltLength: number;
}

const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  ivLength: 16, // 128 bits
  authTagLength: 16, // 128 bits
  saltLength: 32, // 256 bits
};

/**
 * Encryption Service
 * Provides AES-256-GCM encryption for sensitive data fields
 *
 * @example
 * ```typescript
 * const encryption = new EncryptionService();
 * const key = await encryption.deriveKey('master-password', salt);
 *
 * const encrypted = await encryption.encrypt('secret-data', key);
 * const decrypted = await encryption.decrypt(encrypted, key);
 * ```
 */
export class EncryptionService {
  private readonly config: EncryptionConfig;

  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Encrypt plaintext using AES-256-GCM
   *
   * @param plaintext - Data to encrypt
   * @param key - 256-bit encryption key
   * @returns Base64-encoded string: IV (16) + AuthTag (16) + Ciphertext
   */
  async encrypt(plaintext: string, key: Buffer): Promise<string> {
    this.validateKey(key);

    const iv = randomBytes(this.config.ivLength);
    const cipher = createCipheriv(this.config.algorithm, key, iv, {
      authTagLength: this.config.authTagLength,
    });

    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Combine: IV (16 bytes) + AuthTag (16 bytes) + Ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);

    return combined.toString('base64');
  }

  /**
   * Decrypt ciphertext using AES-256-GCM
   *
   * @param ciphertext - Base64-encoded encrypted data
   * @param key - 256-bit encryption key
   * @returns Decrypted plaintext
   * @throws Error if decryption fails (wrong key, tampered data)
   */
  async decrypt(ciphertext: string, key: Buffer): Promise<string> {
    this.validateKey(key);

    const combined = Buffer.from(ciphertext, 'base64');

    if (combined.length < this.config.ivLength + this.config.authTagLength) {
      throw new Error('Invalid ciphertext: too short');
    }

    const iv = combined.subarray(0, this.config.ivLength);
    const authTag = combined.subarray(
      this.config.ivLength,
      this.config.ivLength + this.config.authTagLength
    );
    const encrypted = combined.subarray(
      this.config.ivLength + this.config.authTagLength
    );

    const decipher = createDecipheriv(this.config.algorithm, key, iv, {
      authTagLength: this.config.authTagLength,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  }

  /**
   * Derive encryption key from password/passphrase
   *
   * @param password - Master password or passphrase
   * @param salt - Unique salt (store alongside encrypted data)
   * @returns 256-bit derived key
   */
  async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return (await scryptAsync(password, salt, this.config.keyLength)) as Buffer;
  }

  /**
   * Generate a random salt for key derivation
   *
   * @returns Random salt buffer
   */
  generateSalt(): Buffer {
    return randomBytes(this.config.saltLength);
  }

  /**
   * Generate a random encryption key
   *
   * @returns Random 256-bit key
   */
  generateKey(): Buffer {
    return randomBytes(this.config.keyLength);
  }

  /**
   * Encrypt with associated data (AAD)
   * AAD is authenticated but not encrypted - useful for binding
   * ciphertext to context (e.g., user ID, tenant ID)
   *
   * @param plaintext - Data to encrypt
   * @param key - Encryption key
   * @param aad - Associated data for authentication
   * @returns Base64-encoded encrypted data
   */
  async encryptWithAAD(
    plaintext: string,
    key: Buffer,
    aad: string
  ): Promise<string> {
    this.validateKey(key);

    const iv = randomBytes(this.config.ivLength);
    const cipher = createCipheriv(this.config.algorithm, key, iv, {
      authTagLength: this.config.authTagLength,
    });

    cipher.setAAD(Buffer.from(aad, 'utf8'));

    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, authTag, encrypted]);

    return combined.toString('base64');
  }

  /**
   * Decrypt with associated data (AAD)
   *
   * @param ciphertext - Base64-encoded encrypted data
   * @param key - Encryption key
   * @param aad - Associated data used during encryption
   * @returns Decrypted plaintext
   */
  async decryptWithAAD(
    ciphertext: string,
    key: Buffer,
    aad: string
  ): Promise<string> {
    this.validateKey(key);

    const combined = Buffer.from(ciphertext, 'base64');

    if (combined.length < this.config.ivLength + this.config.authTagLength) {
      throw new Error('Invalid ciphertext: too short');
    }

    const iv = combined.subarray(0, this.config.ivLength);
    const authTag = combined.subarray(
      this.config.ivLength,
      this.config.ivLength + this.config.authTagLength
    );
    const encrypted = combined.subarray(
      this.config.ivLength + this.config.authTagLength
    );

    const decipher = createDecipheriv(this.config.algorithm, key, iv, {
      authTagLength: this.config.authTagLength,
    });
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(aad, 'utf8'));

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  }

  /**
   * Compare two encrypted values in constant time
   * Use for comparing encrypted tokens without decrypting
   *
   * @param a - First encrypted value
   * @param b - Second encrypted value
   * @returns true if equal
   */
  secureCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    if (bufA.length !== bufB.length) {
      // Still perform comparison to maintain constant time
      const dummy = Buffer.alloc(bufA.length);
      timingSafeEqual(bufA, dummy);
      return false;
    }

    return timingSafeEqual(bufA, bufB);
  }

  /**
   * Encrypt a value with metadata for key rotation support
   *
   * @param plaintext - Data to encrypt
   * @param key - Encryption key
   * @param keyVersion - Version identifier for the key
   * @returns Object with ciphertext and key version
   */
  async encryptWithVersion(
    plaintext: string,
    key: Buffer,
    keyVersion: string
  ): Promise<EncryptedData> {
    const ciphertext = await this.encrypt(plaintext, key);
    return { ciphertext, keyVersion };
  }

  /**
   * Validate encryption key length
   */
  private validateKey(key: Buffer): void {
    if (key.length !== this.config.keyLength) {
      throw new Error(
        `Invalid key length: expected ${this.config.keyLength} bytes, got ${key.length}`
      );
    }
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();

// Export types
export type { EncryptedData, EncryptionConfig };
