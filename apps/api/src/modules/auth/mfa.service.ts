import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import prisma from '../../common/database';
import { config } from '../../config';
import { AppError } from '../../middleware/error.middleware';
import { logSecurityEvent } from '../../middleware/audit.middleware';

// Configure authenticator
authenticator.options = {
  digits: 6,
  step: 30, // 30 seconds
  window: 1, // Allow 1 step before/after for clock drift
};

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

interface MfaSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

interface MfaVerifyResult {
  success: boolean;
  usedBackupCode?: boolean;
}

export class MfaService {
  /**
   * Initialize MFA setup for a user
   * Returns the secret and QR code for authenticator app setup
   */
  async setupMfa(userId: string): Promise<MfaSetupResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.mfaEnabled) {
      throw new AppError('MFA is already enabled', 400);
    }

    // Generate a new TOTP secret
    const secret = authenticator.generateSecret(20);

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Create otpauth URL for QR code
    const issuer = 'Clubiio';
    const accountName = `${user.email} (${user.tenant.name})`;
    const otpauthUrl = authenticator.keyuri(accountName, issuer, secret);

    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
    });

    // Store secret and backup codes temporarily (not enabled yet)
    // They will be confirmed when user verifies the first code
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: this.encryptSecret(secret),
        mfaBackupCodes: backupCodes.map((code) => this.hashBackupCode(code)),
        mfaEnabled: false, // Will be enabled on verification
      },
    });

    return {
      secret, // Show to user for manual entry
      qrCode, // Base64 data URL
      backupCodes, // Show once, user must save them
    };
  }

  /**
   * Confirm MFA setup by verifying the first code
   */
  async confirmMfaSetup(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.mfaEnabled) {
      throw new AppError('MFA is already enabled', 400);
    }

    if (!user.mfaSecret) {
      throw new AppError('MFA setup not initiated', 400);
    }

    const secret = this.decryptSecret(user.mfaSecret);
    const isValid = authenticator.verify({ token: code, secret });

    if (!isValid) {
      throw new AppError('Invalid verification code', 400);
    }

    // Enable MFA
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaVerifiedAt: new Date(),
      },
    });

    return true;
  }

  /**
   * Verify a TOTP code or backup code
   */
  async verifyMfa(
    userId: string,
    code: string,
    req?: any
  ): Promise<MfaVerifyResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new AppError('MFA is not enabled', 400);
    }

    // Try TOTP first
    const secret = this.decryptSecret(user.mfaSecret);
    const isValidTotp = authenticator.verify({ token: code, secret });

    if (isValidTotp) {
      // Update last verification time
      await prisma.user.update({
        where: { id: userId },
        data: { mfaVerifiedAt: new Date() },
      });

      logSecurityEvent('MFA_VERIFIED', req, { userId, method: 'totp' });

      return { success: true, usedBackupCode: false };
    }

    // Try backup codes
    const normalizedCode = code.replace(/[\s-]/g, '').toLowerCase();
    const hashedCode = this.hashBackupCode(normalizedCode);

    const backupCodeIndex = user.mfaBackupCodes.indexOf(hashedCode);

    if (backupCodeIndex !== -1) {
      // Remove used backup code
      const updatedCodes = [...user.mfaBackupCodes];
      updatedCodes.splice(backupCodeIndex, 1);

      await prisma.user.update({
        where: { id: userId },
        data: {
          mfaBackupCodes: updatedCodes,
          mfaVerifiedAt: new Date(),
        },
      });

      logSecurityEvent('MFA_BACKUP_CODE_USED', req, {
        userId,
        remainingCodes: updatedCodes.length,
      });

      return { success: true, usedBackupCode: true };
    }

    logSecurityEvent('MFA_VERIFICATION_FAILED', req, { userId });

    return { success: false };
  }

  /**
   * Disable MFA for a user (requires password verification first)
   */
  async disableMfa(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.mfaEnabled) {
      throw new AppError('MFA is not enabled', 400);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
        mfaVerifiedAt: null,
      },
    });
  }

  /**
   * Generate new backup codes (invalidates old ones)
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.mfaEnabled) {
      throw new AppError('MFA is not enabled', 400);
    }

    const backupCodes = this.generateBackupCodes();

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaBackupCodes: backupCodes.map((code) => this.hashBackupCode(code)),
      },
    });

    return backupCodes;
  }

  /**
   * Get remaining backup code count
   */
  async getBackupCodeCount(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaBackupCodes: true },
    });

    return user?.mfaBackupCodes.length ?? 0;
  }

  /**
   * Check if MFA is required for a user role
   */
  isMfaRequired(role: string): boolean {
    // Require MFA for admin/owner roles
    const mfaRequiredRoles = ['OWNER', 'ADMIN'];
    return mfaRequiredRoles.includes(role);
  }

  // Private helpers

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      let code = '';
      for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
        code += chars[crypto.randomInt(chars.length)];
      }
      // Format as xxxx-xxxx for readability
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }

    return codes;
  }

  private hashBackupCode(code: string): string {
    const normalized = code.replace(/[\s-]/g, '').toLowerCase();
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  private encryptSecret(secret: string): string {
    // In production, use proper encryption with a key from secrets manager
    // For now, using base64 encoding as a placeholder
    // TODO: Implement proper AES-256-GCM encryption
    const key = config.security.sessionSecret || config.jwt.secret;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      crypto.scryptSync(key, 'salt', 32),
      iv
    );
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decryptSecret(encryptedSecret: string): string {
    const key = config.security.sessionSecret || config.jwt.secret;
    const [ivHex, encrypted] = encryptedSecret.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      crypto.scryptSync(key, 'salt', 32),
      iv
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

export const mfaService = new MfaService();
