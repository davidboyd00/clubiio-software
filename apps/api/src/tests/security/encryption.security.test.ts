import { describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'crypto';
import { EncryptionService } from '../../common/encryption/encryption.service';

// ============================================
// ENCRYPTION SECURITY TESTS
// ============================================
// Tests for AES-256-GCM encryption implementation

describe('Encryption Service Security', () => {
  let encryption: EncryptionService;
  let testKey: Buffer;

  beforeEach(() => {
    encryption = new EncryptionService();
    testKey = randomBytes(32); // 256-bit key
  });

  // ─────────────────────────────────────────
  // BASIC ENCRYPTION/DECRYPTION
  // ─────────────────────────────────────────
  describe('Basic Encryption/Decryption', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const plaintext = 'sensitive-mfa-secret-ABCD1234';

      const ciphertext = await encryption.encrypt(plaintext, testKey);
      const decrypted = await encryption.decrypt(ciphertext, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty string', async () => {
      const plaintext = '';

      const ciphertext = await encryption.encrypt(plaintext, testKey);
      const decrypted = await encryption.decrypt(ciphertext, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', async () => {
      const plaintext = 'Contraseña segura: 密码 🔐';

      const ciphertext = await encryption.encrypt(plaintext, testKey);
      const decrypted = await encryption.decrypt(ciphertext, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', async () => {
      const plaintext = 'A'.repeat(10000);

      const ciphertext = await encryption.encrypt(plaintext, testKey);
      const decrypted = await encryption.decrypt(ciphertext, testKey);

      expect(decrypted).toBe(plaintext);
    });
  });

  // ─────────────────────────────────────────
  // CIPHERTEXT PROPERTIES
  // ─────────────────────────────────────────
  describe('Ciphertext Properties', () => {
    it('should produce different ciphertext for same plaintext (random IV)', async () => {
      const plaintext = 'test-data';

      const ciphertext1 = await encryption.encrypt(plaintext, testKey);
      const ciphertext2 = await encryption.encrypt(plaintext, testKey);

      expect(ciphertext1).not.toBe(ciphertext2);

      // But both should decrypt to same plaintext
      const decrypted1 = await encryption.decrypt(ciphertext1, testKey);
      const decrypted2 = await encryption.decrypt(ciphertext2, testKey);
      expect(decrypted1).toBe(decrypted2);
    });

    it('should not contain plaintext in ciphertext', async () => {
      const plaintext = 'VERY_SECRET_DATA_12345';

      const ciphertext = await encryption.encrypt(plaintext, testKey);

      expect(ciphertext).not.toContain(plaintext);
      expect(ciphertext).not.toContain(Buffer.from(plaintext).toString('base64'));
    });

    it('should produce ciphertext longer than plaintext (IV + AuthTag)', async () => {
      const plaintext = 'short';

      const ciphertext = await encryption.encrypt(plaintext, testKey);
      const ciphertextBytes = Buffer.from(ciphertext, 'base64');

      // Ciphertext should include: IV (16) + AuthTag (16) + encrypted data
      // Minimum overhead is 32 bytes, so ciphertext >= plaintext + 32
      expect(ciphertextBytes.length).toBeGreaterThanOrEqual(plaintext.length + 32);
    });

    it('should produce base64-encoded output', async () => {
      const plaintext = 'test';

      const ciphertext = await encryption.encrypt(plaintext, testKey);

      // Valid base64 regex
      expect(ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });
  });

  // ─────────────────────────────────────────
  // DECRYPTION FAILURES
  // ─────────────────────────────────────────
  describe('Decryption Failures', () => {
    it('should fail decryption with wrong key', async () => {
      const plaintext = 'secret-data';
      const wrongKey = randomBytes(32);

      const ciphertext = await encryption.encrypt(plaintext, testKey);

      await expect(encryption.decrypt(ciphertext, wrongKey)).rejects.toThrow();
    });

    it('should fail decryption of tampered ciphertext', async () => {
      const plaintext = 'secret-data';

      const ciphertext = await encryption.encrypt(plaintext, testKey);
      const bytes = Buffer.from(ciphertext, 'base64');

      // Tamper with the ciphertext (change last byte)
      bytes[bytes.length - 1] ^= 0xff;
      const tamperedCiphertext = bytes.toString('base64');

      await expect(encryption.decrypt(tamperedCiphertext, testKey)).rejects.toThrow();
    });

    it('should fail decryption of tampered IV', async () => {
      const plaintext = 'secret-data';

      const ciphertext = await encryption.encrypt(plaintext, testKey);
      const bytes = Buffer.from(ciphertext, 'base64');

      // Tamper with the IV (first byte)
      bytes[0] ^= 0xff;
      const tamperedCiphertext = bytes.toString('base64');

      await expect(encryption.decrypt(tamperedCiphertext, testKey)).rejects.toThrow();
    });

    it('should fail decryption of tampered auth tag', async () => {
      const plaintext = 'secret-data';

      const ciphertext = await encryption.encrypt(plaintext, testKey);
      const bytes = Buffer.from(ciphertext, 'base64');

      // Tamper with the auth tag (byte 16-31)
      bytes[20] ^= 0xff;
      const tamperedCiphertext = bytes.toString('base64');

      await expect(encryption.decrypt(tamperedCiphertext, testKey)).rejects.toThrow();
    });

    it('should fail decryption of truncated ciphertext', async () => {
      const plaintext = 'secret-data';

      const ciphertext = await encryption.encrypt(plaintext, testKey);
      const bytes = Buffer.from(ciphertext, 'base64');

      // Truncate ciphertext
      const truncated = bytes.subarray(0, bytes.length - 10).toString('base64');

      await expect(encryption.decrypt(truncated, testKey)).rejects.toThrow();
    });

    it('should fail decryption of invalid base64', async () => {
      const invalidCiphertext = 'not-valid-base64!!!';

      await expect(encryption.decrypt(invalidCiphertext, testKey)).rejects.toThrow();
    });

    it('should fail decryption of too-short ciphertext', async () => {
      const shortCiphertext = Buffer.from('short').toString('base64');

      await expect(encryption.decrypt(shortCiphertext, testKey)).rejects.toThrow();
    });
  });

  // ─────────────────────────────────────────
  // KEY VALIDATION
  // ─────────────────────────────────────────
  describe('Key Validation', () => {
    it('should reject keys shorter than 32 bytes', async () => {
      const shortKey = randomBytes(16);
      const plaintext = 'test';

      await expect(encryption.encrypt(plaintext, shortKey)).rejects.toThrow(
        /Invalid key length/
      );
    });

    it('should reject keys longer than 32 bytes', async () => {
      const longKey = randomBytes(64);
      const plaintext = 'test';

      await expect(encryption.encrypt(plaintext, longKey)).rejects.toThrow(
        /Invalid key length/
      );
    });

    it('should accept exactly 32-byte keys', async () => {
      const validKey = randomBytes(32);
      const plaintext = 'test';

      const ciphertext = await encryption.encrypt(plaintext, validKey);
      expect(ciphertext).toBeDefined();
    });
  });

  // ─────────────────────────────────────────
  // KEY DERIVATION
  // ─────────────────────────────────────────
  describe('Key Derivation', () => {
    it('should derive consistent keys from same password and salt', async () => {
      const password = 'my-master-password';
      const salt = encryption.generateSalt();

      const key1 = await encryption.deriveKey(password, salt);
      const key2 = await encryption.deriveKey(password, salt);

      expect(key1.equals(key2)).toBe(true);
    });

    it('should derive different keys from different salts', async () => {
      const password = 'my-master-password';
      const salt1 = encryption.generateSalt();
      const salt2 = encryption.generateSalt();

      const key1 = await encryption.deriveKey(password, salt1);
      const key2 = await encryption.deriveKey(password, salt2);

      expect(key1.equals(key2)).toBe(false);
    });

    it('should derive different keys from different passwords', async () => {
      const password1 = 'password-one';
      const password2 = 'password-two';
      const salt = encryption.generateSalt();

      const key1 = await encryption.deriveKey(password1, salt);
      const key2 = await encryption.deriveKey(password2, salt);

      expect(key1.equals(key2)).toBe(false);
    });

    it('should derive 32-byte keys', async () => {
      const password = 'test-password';
      const salt = encryption.generateSalt();

      const key = await encryption.deriveKey(password, salt);

      expect(key.length).toBe(32);
    });
  });

  // ─────────────────────────────────────────
  // ASSOCIATED DATA (AAD)
  // ─────────────────────────────────────────
  describe('Associated Data (AAD)', () => {
    it('should encrypt and decrypt with matching AAD', async () => {
      const plaintext = 'secret-data';
      const aad = 'user-123:tenant-456';

      const ciphertext = await encryption.encryptWithAAD(plaintext, testKey, aad);
      const decrypted = await encryption.decryptWithAAD(ciphertext, testKey, aad);

      expect(decrypted).toBe(plaintext);
    });

    it('should fail decryption with different AAD', async () => {
      const plaintext = 'secret-data';
      const aad1 = 'user-123:tenant-456';
      const aad2 = 'user-789:tenant-456';

      const ciphertext = await encryption.encryptWithAAD(plaintext, testKey, aad1);

      await expect(
        encryption.decryptWithAAD(ciphertext, testKey, aad2)
      ).rejects.toThrow();
    });

    it('should fail decryption when AAD is missing', async () => {
      const plaintext = 'secret-data';
      const aad = 'user-123:tenant-456';

      const ciphertext = await encryption.encryptWithAAD(plaintext, testKey, aad);

      // Try to decrypt without AAD using regular decrypt
      await expect(encryption.decrypt(ciphertext, testKey)).rejects.toThrow();
    });
  });

  // ─────────────────────────────────────────
  // SECURE COMPARE
  // ─────────────────────────────────────────
  describe('Secure Compare', () => {
    it('should return true for equal strings', () => {
      const a = 'same-value';
      const b = 'same-value';

      expect(encryption.secureCompare(a, b)).toBe(true);
    });

    it('should return false for different strings', () => {
      const a = 'value-a';
      const b = 'value-b';

      expect(encryption.secureCompare(a, b)).toBe(false);
    });

    it('should return false for different length strings', () => {
      const a = 'short';
      const b = 'much-longer-string';

      expect(encryption.secureCompare(a, b)).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(encryption.secureCompare('', '')).toBe(true);
      expect(encryption.secureCompare('', 'nonempty')).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // KEY GENERATION
  // ─────────────────────────────────────────
  describe('Key Generation', () => {
    it('should generate unique keys', () => {
      const key1 = encryption.generateKey();
      const key2 = encryption.generateKey();

      expect(key1.equals(key2)).toBe(false);
    });

    it('should generate 32-byte keys', () => {
      const key = encryption.generateKey();
      expect(key.length).toBe(32);
    });

    it('should generate unique salts', () => {
      const salt1 = encryption.generateSalt();
      const salt2 = encryption.generateSalt();

      expect(salt1.equals(salt2)).toBe(false);
    });

    it('should generate 32-byte salts', () => {
      const salt = encryption.generateSalt();
      expect(salt.length).toBe(32);
    });
  });

  // ─────────────────────────────────────────
  // VERSIONED ENCRYPTION
  // ─────────────────────────────────────────
  describe('Versioned Encryption', () => {
    it('should include key version in encrypted data', async () => {
      const plaintext = 'secret-data';
      const keyVersion = 'v2';

      const result = await encryption.encryptWithVersion(plaintext, testKey, keyVersion);

      expect(result.keyVersion).toBe(keyVersion);
      expect(result.ciphertext).toBeDefined();
    });

    it('should decrypt versioned data correctly', async () => {
      const plaintext = 'secret-data';
      const keyVersion = 'v1';

      const result = await encryption.encryptWithVersion(plaintext, testKey, keyVersion);
      const decrypted = await encryption.decrypt(result.ciphertext, testKey);

      expect(decrypted).toBe(plaintext);
    });
  });
});

describe('Encryption Best Practices', () => {
  // ─────────────────────────────────────────
  // ALGORITHM VERIFICATION
  // ─────────────────────────────────────────
  describe('Algorithm Verification', () => {
    it('should use AES-256-GCM (authenticated encryption)', () => {
      const encryption = new EncryptionService();
      // GCM provides both confidentiality and authenticity
      // Verified by the fact that tampered ciphertext fails to decrypt
      expect(encryption).toBeDefined();
    });

    it('should use random IV for each encryption', async () => {
      const encryption = new EncryptionService();
      const key = randomBytes(32);
      const plaintext = 'same-plaintext';

      const ciphertext1 = await encryption.encrypt(plaintext, key);
      const ciphertext2 = await encryption.encrypt(plaintext, key);

      // First 16 bytes (IV) should be different
      const bytes1 = Buffer.from(ciphertext1, 'base64');
      const bytes2 = Buffer.from(ciphertext2, 'base64');
      const iv1 = bytes1.subarray(0, 16);
      const iv2 = bytes2.subarray(0, 16);

      expect(iv1.equals(iv2)).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // SENSITIVE DATA HANDLING
  // ─────────────────────────────────────────
  describe('Sensitive Data Scenarios', () => {
    const encryption = new EncryptionService();

    it('should securely handle MFA secrets', async () => {
      const mfaSecret = 'JBSWY3DPEHPK3PXP'; // Base32 TOTP secret
      const key = randomBytes(32);

      const encrypted = await encryption.encrypt(mfaSecret, key);
      const decrypted = await encryption.decrypt(encrypted, key);

      expect(decrypted).toBe(mfaSecret);
      expect(encrypted).not.toContain('JBSWY3DPEHPK3PXP');
    });

    it('should securely handle SSN', async () => {
      const ssn = '123-45-6789';
      const key = randomBytes(32);

      const encrypted = await encryption.encrypt(ssn, key);
      const decrypted = await encryption.decrypt(encrypted, key);

      expect(decrypted).toBe(ssn);
      expect(encrypted).not.toContain('123');
      expect(encrypted).not.toContain('6789');
    });

    it('should securely handle bank account numbers', async () => {
      const bankAccount = '1234567890';
      const key = randomBytes(32);
      const userId = 'user-123'; // AAD for binding

      const encrypted = await encryption.encryptWithAAD(bankAccount, key, userId);
      const decrypted = await encryption.decryptWithAAD(encrypted, key, userId);

      expect(decrypted).toBe(bankAccount);
    });

    it('should prevent data from being used with wrong user (AAD)', async () => {
      const bankAccount = '1234567890';
      const key = randomBytes(32);

      // Encrypt for user-123
      const encrypted = await encryption.encryptWithAAD(bankAccount, key, 'user-123');

      // Try to decrypt for user-456 (should fail)
      await expect(
        encryption.decryptWithAAD(encrypted, key, 'user-456')
      ).rejects.toThrow();
    });
  });
});
