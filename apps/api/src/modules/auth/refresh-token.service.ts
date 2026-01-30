import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import prisma from '../../common/database';
import { config } from '../../config';
import { AppError } from '../../middleware/error.middleware';
import { logSecurityEvent } from '../../middleware/audit.middleware';

interface TokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  mfaVerified?: boolean;
}

interface RefreshTokenPayload {
  tokenId: string;
  family: string;
  userId: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

// Parse duration string to milliseconds
function parseDuration(duration: string): number {
  const units: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const [, value, unit] = match;
  return parseInt(value, 10) * units[unit];
}

export class RefreshTokenService {
  /**
   * Generate a new token pair (access + refresh)
   */
  async generateTokenPair(
    payload: TokenPayload,
    req?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<TokenPair> {
    // Generate access token
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    // Generate refresh token
    const tokenId = uuid();
    const family = uuid(); // New family for new login
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = this.hashToken(rawToken);

    const expiresAt = new Date(
      Date.now() + parseDuration(config.jwt.refreshExpiresIn)
    );

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId: payload.userId,
        token: hashedToken,
        family,
        expiresAt,
        userAgent: req?.headers?.['user-agent']?.toString(),
        ipAddress: req?.ip,
      },
    });

    // Create signed refresh token
    const refreshToken = jwt.sign(
      { tokenId, family, userId: payload.userId } as RefreshTokenPayload,
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiresIn } as jwt.SignOptions
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
    };
  }

  /**
   * Refresh tokens using a refresh token
   * Implements token rotation with reuse detection
   */
  async refreshTokens(
    refreshToken: string,
    req?: {
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
    }
  ): Promise<TokenPair> {
    let decoded: RefreshTokenPayload;

    try {
      decoded = jwt.verify(refreshToken, config.jwt.secret) as RefreshTokenPayload;
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }

    const { tokenId, family, userId } = decoded;

    // Find the stored token
    const storedToken = await prisma.refreshToken.findUnique({
      where: { id: tokenId },
      include: {
        user: {
          include: { tenant: true },
        },
      },
    });

    if (!storedToken) {
      // Token not found - possible reuse attack or already rotated
      // Revoke all tokens in this family as a precaution
      await this.revokeTokenFamily(family, userId);

      logSecurityEvent('TOKEN_REUSE_DETECTED', req as any, {
        userId,
        family,
        tokenId,
      });

      throw new AppError('Token reuse detected. All sessions revoked for security.', 401);
    }

    // Check if token is revoked
    if (storedToken.isRevoked) {
      // Revoked token being used - definite reuse attack
      await this.revokeTokenFamily(family, userId);

      logSecurityEvent('REVOKED_TOKEN_REUSE', req as any, {
        userId,
        family,
        tokenId,
      });

      throw new AppError('Session compromised. All sessions revoked for security.', 401);
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      throw new AppError('Refresh token expired', 401);
    }

    // Check user is still active
    if (!storedToken.user.isActive) {
      throw new AppError('Account is deactivated', 401);
    }

    // Revoke the used token (one-time use)
    await prisma.refreshToken.update({
      where: { id: tokenId },
      data: {
        isRevoked: true,
        lastUsedAt: new Date(),
      },
    });

    // Generate new token pair with same family
    const newTokenId = uuid();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = this.hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + parseDuration(config.jwt.refreshExpiresIn)
    );

    // Create new access token
    const payload: TokenPayload = {
      userId: storedToken.user.id,
      tenantId: storedToken.user.tenantId,
      email: storedToken.user.email,
      role: storedToken.user.role,
      mfaVerified: storedToken.user.mfaEnabled ? storedToken.user.mfaVerifiedAt !== null : undefined,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    // Store new refresh token (same family for rotation tracking)
    await prisma.refreshToken.create({
      data: {
        id: newTokenId,
        userId: storedToken.userId,
        token: hashedToken,
        family, // Same family - critical for reuse detection
        expiresAt,
        userAgent: req?.headers?.['user-agent']?.toString(),
        ipAddress: req?.ip,
      },
    });

    // Create new signed refresh token
    const newRefreshToken = jwt.sign(
      { tokenId: newTokenId, family, userId } as RefreshTokenPayload,
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiresIn } as jwt.SignOptions
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: config.jwt.expiresIn,
    };
  }

  /**
   * Revoke a specific refresh token
   */
  async revokeToken(tokenId: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id: tokenId },
      data: { isRevoked: true },
    });
  }

  /**
   * Revoke all tokens in a family (for security incidents)
   */
  async revokeTokenFamily(family: string, userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: {
        family,
        userId,
        isRevoked: false,
      },
      data: { isRevoked: true },
    });
  }

  /**
   * Revoke all user tokens (logout everywhere)
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        isRevoked: false,
      },
      data: { isRevoked: true },
    });
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string) {
    const tokens = await prisma.refreshToken.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return tokens.map((token) => ({
      id: token.id,
      device: this.parseUserAgent(token.userAgent),
      ipAddress: token.ipAddress,
      createdAt: token.createdAt,
      lastUsedAt: token.lastUsedAt,
    }));
  }

  /**
   * Cleanup expired tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            isRevoked: true,
            lastUsedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Keep revoked tokens for 7 days for audit
          },
        ],
      },
    });

    return result.count;
  }

  // Private helpers

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseUserAgent(userAgent?: string | null): string {
    if (!userAgent) return 'Unknown device';

    // Simple parsing - could be enhanced with a proper UA parser
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Linux')) return 'Linux';

    return 'Unknown device';
  }
}

export const refreshTokenService = new RefreshTokenService();
