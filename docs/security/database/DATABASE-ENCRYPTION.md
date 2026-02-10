# Database Encryption at Rest

## Overview

This document describes the encryption-at-rest configuration for Clubio's database infrastructure. We use Neon PostgreSQL as our primary database provider, which provides built-in encryption capabilities.

## Table of Contents

1. [Infrastructure Encryption](#infrastructure-encryption)
2. [Application-Level Encryption](#application-level-encryption)
3. [Key Management](#key-management)
4. [Sensitive Data Fields](#sensitive-data-fields)
5. [Implementation Guide](#implementation-guide)
6. [Compliance](#compliance)

---

## Infrastructure Encryption

### Neon PostgreSQL Encryption

Neon provides encryption at rest by default for all data:

| Layer | Encryption | Key Management |
|-------|------------|----------------|
| Storage | AES-256 | Neon-managed |
| Backups | AES-256 | Neon-managed |
| WAL logs | AES-256 | Neon-managed |
| Network | TLS 1.3 | Certificate-based |

**Key Features:**
- All data encrypted at rest using AES-256
- Encryption keys are managed by Neon
- Data is encrypted before being written to disk
- Automatic key rotation (managed by Neon)

### Connection Security

```typescript
// Database connection must use SSL
const connectionString = process.env.DATABASE_URL;
// Neon connection strings include sslmode=require by default
// Example: postgres://user:pass@host.neon.tech/db?sslmode=require
```

**SSL/TLS Requirements:**
- Minimum TLS version: 1.2 (TLS 1.3 recommended)
- Certificate verification: Required
- Connection string must include `sslmode=require` or `sslmode=verify-full`

---

## Application-Level Encryption

While Neon handles storage encryption, certain sensitive fields require additional application-level encryption for defense in depth.

### When to Use Application-Level Encryption

| Data Type | Infrastructure Encryption | App Encryption | Reason |
|-----------|---------------------------|----------------|--------|
| Passwords | Yes | Hashed (bcrypt) | One-way hashing |
| PINs | Yes | Hashed (bcrypt) | One-way hashing |
| MFA Secrets | Yes | **Required** | Recovery prevention |
| Backup Codes | Yes | Hashed | One-way hashing |
| API Keys | Yes | **Recommended** | Limit exposure |
| PII (SSN, ID) | Yes | **Required** | Compliance |
| Credit Cards | Yes | **Required** | PCI-DSS |
| Health Data | Yes | **Required** | HIPAA |

### Encryption Service Implementation

```typescript
// src/common/encryption/encryption.service.ts
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly authTagLength = 16;

  /**
   * Encrypt sensitive data
   * Returns: base64(iv + authTag + ciphertext)
   */
  async encrypt(plaintext: string, key: Buffer): Promise<string> {
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Combine: IV (16) + AuthTag (16) + Ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(ciphertext: string, key: Buffer): Promise<string> {
    const combined = Buffer.from(ciphertext, 'base64');

    const iv = combined.subarray(0, this.ivLength);
    const authTag = combined.subarray(this.ivLength, this.ivLength + this.authTagLength);
    const encrypted = combined.subarray(this.ivLength + this.authTagLength);

    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  }

  /**
   * Derive encryption key from password/master key
   */
  async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return (await scryptAsync(password, salt, this.keyLength)) as Buffer;
  }
}
```

### Usage Example

```typescript
// Encrypting MFA secrets before storing
const encryption = new EncryptionService();
const masterKey = Buffer.from(process.env.ENCRYPTION_MASTER_KEY!, 'base64');

// Encrypt before saving to database
const encryptedSecret = await encryption.encrypt(totpSecret, masterKey);
await prisma.user.update({
  where: { id: userId },
  data: { mfaSecret: encryptedSecret }
});

// Decrypt when verifying
const user = await prisma.user.findUnique({ where: { id: userId } });
const decryptedSecret = await encryption.decrypt(user.mfaSecret!, masterKey);
const isValid = totp.verify({ secret: decryptedSecret, token: userToken });
```

---

## Key Management

### Master Key Generation

```bash
# Generate a 256-bit master key
openssl rand -base64 32

# Example output (store securely):
# K7Hy4dF9gH2kL8mN3pQ6rS9tU2vW5xY8zA3bC6dE9fG=
```

### Environment Configuration

```bash
# .env (development)
ENCRYPTION_MASTER_KEY=K7Hy4dF9gH2kL8mN3pQ6rS9tU2vW5xY8zA3bC6dE9fG=

# Production: Use secrets manager
# AWS Secrets Manager, HashiCorp Vault, or GCP Secret Manager
```

### Key Rotation Strategy

```typescript
// Key rotation process
export class KeyRotationService {
  private readonly ROTATION_GRACE_PERIOD_DAYS = 30;

  /**
   * Step 1: Add new key version
   * Step 2: Re-encrypt data with new key (batch process)
   * Step 3: Remove old key after grace period
   */
  async rotateEncryptionKey(
    oldKey: Buffer,
    newKey: Buffer,
    records: EncryptedRecord[]
  ): Promise<void> {
    const encryption = new EncryptionService();

    for (const record of records) {
      // Decrypt with old key
      const plaintext = await encryption.decrypt(record.encryptedData, oldKey);

      // Re-encrypt with new key
      const newCiphertext = await encryption.encrypt(plaintext, newKey);

      // Update record
      await this.updateRecord(record.id, {
        encryptedData: newCiphertext,
        keyVersion: 'v2',
      });
    }
  }
}
```

### Secrets Manager Integration

**AWS Secrets Manager:**
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

async function getEncryptionKey(): Promise<Buffer> {
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: 'clubio/encryption-master-key' })
  );
  return Buffer.from(response.SecretString!, 'base64');
}
```

**HashiCorp Vault:**
```typescript
import Vault from 'node-vault';

const vault = Vault({ endpoint: process.env.VAULT_ADDR });

async function getEncryptionKey(): Promise<Buffer> {
  await vault.approleLogin({
    role_id: process.env.VAULT_ROLE_ID,
    secret_id: process.env.VAULT_SECRET_ID,
  });

  const result = await vault.read('secret/data/clubio/encryption');
  return Buffer.from(result.data.data.master_key, 'base64');
}
```

---

## Sensitive Data Fields

### Data Classification

| Field | Classification | Encryption | Retention |
|-------|---------------|------------|-----------|
| `user.password` | Critical | Bcrypt hash | Indefinite |
| `user.pin` | Critical | Bcrypt hash | Indefinite |
| `user.mfaSecret` | Critical | AES-256-GCM | Until disabled |
| `user.mfaBackupCodes` | Critical | Bcrypt hash | Until used |
| `user.email` | PII | TDE only | Account lifetime |
| `user.phone` | PII | TDE only | Account lifetime |
| `employee.ssn` | Critical PII | AES-256-GCM | Employment + 7y |
| `employee.bankAccount` | Critical | AES-256-GCM | Employment |
| `payment.cardNumber` | PCI | Tokenized | Per PCI-DSS |
| `auditLog.data` | Sensitive | TDE only | 2 years |

### Prisma Schema Example

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String    // bcrypt hash
  pinHash         String?   // bcrypt hash
  mfaSecret       String?   // AES-256-GCM encrypted
  mfaEnabled      Boolean   @default(false)

  // Sensitive fields - consider app-level encryption
  phone           String?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model Employee {
  id              String    @id @default(cuid())
  userId          String    @unique

  // These fields MUST be app-level encrypted
  ssnEncrypted    String?   // AES-256-GCM encrypted
  bankAccount     String?   // AES-256-GCM encrypted

  // Metadata for encrypted fields
  ssnKeyVersion   String?   @default("v1")

  user            User      @relation(fields: [userId], references: [id])
}
```

---

## Implementation Guide

### Step 1: Enable SSL Connections

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Neon URLs include SSL by default
}
```

### Step 2: Create Encryption Utilities

```typescript
// src/common/encryption/index.ts
export { EncryptionService } from './encryption.service';
export { KeyManagementService } from './key-management.service';

// src/common/encryption/encrypted-field.decorator.ts
export function EncryptedField() {
  return function (target: any, propertyKey: string) {
    // Metadata for fields requiring encryption
    Reflect.defineMetadata('encrypted', true, target, propertyKey);
  };
}
```

### Step 3: Implement Field-Level Encryption

```typescript
// src/modules/users/users.service.ts
import { EncryptionService } from '@/common/encryption';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  async updateMfaSecret(userId: string, secret: string): Promise<void> {
    const masterKey = await this.getEncryptionKey();
    const encryptedSecret = await this.encryption.encrypt(secret, masterKey);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: encryptedSecret,
        mfaKeyVersion: 'v1',
      },
    });
  }

  async getMfaSecret(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaKeyVersion: true },
    });

    if (!user?.mfaSecret) return null;

    const key = await this.getEncryptionKey(user.mfaKeyVersion);
    return this.encryption.decrypt(user.mfaSecret, key);
  }
}
```

### Step 4: Secure Key Storage

```typescript
// src/common/encryption/key-management.service.ts
@Injectable()
export class KeyManagementService {
  private keyCache: Map<string, Buffer> = new Map();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  async getKey(version: string = 'current'): Promise<Buffer> {
    // Check cache first
    const cached = this.keyCache.get(version);
    if (cached) return cached;

    // Fetch from secrets manager
    const key = await this.fetchKeyFromSecretsManager(version);

    // Cache with TTL
    this.keyCache.set(version, key);
    setTimeout(() => this.keyCache.delete(version), this.CACHE_TTL_MS);

    return key;
  }

  private async fetchKeyFromSecretsManager(version: string): Promise<Buffer> {
    // Implementation depends on your secrets manager
    // See AWS/Vault examples above
  }
}
```

---

## Compliance

### PCI-DSS Requirements

For payment card data:

| Requirement | Implementation |
|-------------|----------------|
| 3.4 Render PAN unreadable | Use tokenization service |
| 3.5 Document key procedures | This document + runbooks |
| 3.6 Key management procedures | Secrets Manager + rotation |
| 4.1 Encrypt transmission | TLS 1.2+ required |

**Recommendation:** Use a PCI-compliant payment processor (Stripe, Square) for card handling instead of storing card data.

### GDPR Compliance

| Requirement | Implementation |
|-------------|----------------|
| Encryption at rest | Neon TDE + app-level |
| Access controls | RBAC + tenant isolation |
| Right to erasure | Deletion + key destruction |
| Data portability | Export with decryption |

### SOC 2 Type II

| Control | Implementation |
|---------|----------------|
| CC6.1 Encryption | AES-256-GCM |
| CC6.7 Key management | Secrets Manager |
| CC7.2 Monitoring | Audit logs |

---

## Verification Checklist

- [ ] Database connection uses SSL (`sslmode=require` or `verify-full`)
- [ ] Master encryption key stored in secrets manager
- [ ] Passwords hashed with bcrypt (cost factor >= 10)
- [ ] MFA secrets encrypted with AES-256-GCM
- [ ] Key rotation procedure documented
- [ ] Backup encryption verified
- [ ] Audit logging enabled for key access
- [ ] Data classification completed
- [ ] Compliance requirements mapped

---

## Appendix: Encryption Testing

### Test Encryption/Decryption

```typescript
import { describe, it, expect } from 'vitest';
import { EncryptionService } from './encryption.service';
import { randomBytes } from 'crypto';

describe('EncryptionService', () => {
  const service = new EncryptionService();
  const testKey = randomBytes(32);

  it('should encrypt and decrypt data correctly', async () => {
    const plaintext = 'sensitive-mfa-secret-123';
    const encrypted = await service.encrypt(plaintext, testKey);
    const decrypted = await service.decrypt(encrypted, testKey);

    expect(decrypted).toBe(plaintext);
    expect(encrypted).not.toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext', async () => {
    const plaintext = 'test-data';
    const encrypted1 = await service.encrypt(plaintext, testKey);
    const encrypted2 = await service.encrypt(plaintext, testKey);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should fail decryption with wrong key', async () => {
    const plaintext = 'secret-data';
    const encrypted = await service.encrypt(plaintext, testKey);
    const wrongKey = randomBytes(32);

    await expect(service.decrypt(encrypted, wrongKey)).rejects.toThrow();
  });
});
```

### Verify SSL Connection

```bash
# Check SSL connection to Neon
psql "postgres://user:pass@host.neon.tech/db?sslmode=verify-full" -c "SHOW ssl;"
# Should return: on

# Check SSL certificate
openssl s_client -connect host.neon.tech:5432 -starttls postgres
```
