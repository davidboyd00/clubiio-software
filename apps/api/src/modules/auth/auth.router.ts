import { Router } from 'express';
import { z } from 'zod';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  noContentResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { authMiddleware, requireMfa } from '../../middleware/auth.middleware';
import {
  authRateLimiter,
  pinRateLimiter,
  registrationRateLimiter,
  sensitiveRateLimiter,
  isAccountLocked,
  getLockoutRemaining,
} from '../../middleware/rate-limit.middleware';
import { logAuthEvent, logSecurityEvent } from '../../middleware/audit.middleware';
import { authService } from './auth.service';
import { refreshTokenService } from './refresh-token.service';
import { mfaService } from './mfa.service';
import {
  registerSchema,
  loginSchema,
  pinLoginSchema,
  changePasswordSchema,
} from './auth.schema';

// MFA schemas
const mfaCodeSchema = z.object({
  code: z.string().min(6).max(12),
});

const mfaDisableSchema = z.object({
  password: z.string().min(1),
});

const router: Router = Router();

/**
 * POST /auth/register
 * Register a new tenant with first user
 * Rate limited: 3 per minute per IP
 */
router.post(
  '/register',
  registrationRateLimiter, // Apply registration rate limit
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);

    // Log successful registration
    logAuthEvent('AUTH_LOGIN_SUCCESS', req, {
      action: 'register',
      email: input.email,
      tenantName: input.tenantName,
    });

    createdResponse(res, result);
  })
);

/**
 * POST /auth/login
 * Login with email and password
 * Rate limited: 5 attempts per 15 minutes per IP
 */
router.post(
  '/login',
  authRateLimiter, // Apply auth rate limit
  asyncHandler(async (req, res): Promise<void> => {
    const input = loginSchema.parse(req.body);

    // Check if account is locked
    const lockKey = `login:${input.email}`;
    if (isAccountLocked(lockKey)) {
      const remaining = getLockoutRemaining(lockKey);
      logAuthEvent('AUTH_ACCOUNT_LOCKED', req, { email: input.email });
      res.status(429).json({
        error: 'Account locked',
        message: `Cuenta bloqueada temporalmente. Intenta de nuevo en ${Math.ceil(remaining / 60)} minutos.`,
        retryAfter: remaining,
      });
      return;
    }

    try {
      const result = await authService.login(input);

      // Log successful login
      logAuthEvent('AUTH_LOGIN_SUCCESS', req, { email: input.email });

      successResponse(res, result);
    } catch (error) {
      // Log failed login
      logAuthEvent('AUTH_LOGIN_FAILURE', req, { email: input.email });
      throw error;
    }
  })
);

/**
 * POST /auth/pin-login
 * Login with PIN (for POS terminals)
 * Rate limited: 3 attempts per 5 minutes per venue+IP
 */
router.post(
  '/pin-login',
  pinRateLimiter, // Apply strict PIN rate limit
  asyncHandler(async (req, res): Promise<void> => {
    const input = pinLoginSchema.parse(req.body);

    // Check if venue+IP is locked
    const lockKey = `pin:${input.venueId}:${req.ip}`;
    if (isAccountLocked(lockKey)) {
      const remaining = getLockoutRemaining(lockKey);
      logAuthEvent('AUTH_ACCOUNT_LOCKED', req, { venueId: input.venueId, type: 'pin' });
      res.status(429).json({
        error: 'Too many PIN attempts',
        message: `Demasiados intentos. Intenta de nuevo en ${Math.ceil(remaining / 60)} minutos.`,
        retryAfter: remaining,
      });
      return;
    }

    try {
      const result = await authService.pinLogin(input);

      // Log successful PIN login
      logAuthEvent('AUTH_PIN_LOGIN_SUCCESS', req, { venueId: input.venueId });

      successResponse(res, result);
    } catch (error) {
      // Log failed PIN login
      logAuthEvent('AUTH_PIN_LOGIN_FAILURE', req, { venueId: input.venueId });
      throw error;
    }
  })
);

/**
 * GET /auth/me
 * Get current user info
 */
router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await authService.me(req.user!.id);
    successResponse(res, result);
  })
);

/**
 * POST /auth/change-password
 * Change password
 * Rate limited: 5 attempts per hour
 */
router.post(
  '/change-password',
  authMiddleware,
  sensitiveRateLimiter, // Apply sensitive operation rate limit
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = changePasswordSchema.parse(req.body);
    await authService.changePassword(
      req.user!.id,
      input.currentPassword,
      input.newPassword
    );

    // Log password change
    logAuthEvent('AUTH_LOGIN_SUCCESS', req, {
      action: 'password_change',
      userId: req.user!.id,
    });

    noContentResponse(res);
  })
);

// ============================================
// REFRESH TOKEN ENDPOINTS
// ============================================

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 * Implements token rotation for security
 */
router.post(
  '/refresh',
  authRateLimiter,
  asyncHandler(async (req, res): Promise<void> => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    const tokens = await refreshTokenService.refreshTokens(refreshToken, req);

    successResponse(res, tokens);
  })
);

/**
 * POST /auth/logout
 * Logout from current session (revoke refresh token)
 */
router.post(
  '/logout',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Revoke the specific token family
      try {
        const jwt = await import('jsonwebtoken');
        // @ts-ignore - Dynamic import
        const { config } = await import('../../config/index');
        const decoded = jwt.default.verify(refreshToken, config.jwt.secret) as {
          family: string;
          userId: string;
        };
        await refreshTokenService.revokeTokenFamily(decoded.family, decoded.userId);
      } catch {
        // Token invalid, nothing to revoke
      }
    }

    logAuthEvent('AUTH_LOGOUT', req, { userId: req.user!.id });

    noContentResponse(res);
  })
);

/**
 * POST /auth/logout-all
 * Logout from all sessions (revoke all refresh tokens)
 */
router.post(
  '/logout-all',
  authMiddleware,
  requireMfa, // Require MFA for admin users
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await refreshTokenService.revokeAllUserTokens(req.user!.id);

    logSecurityEvent('AUTH_LOGOUT_ALL', req, { userId: req.user!.id });

    noContentResponse(res);
  })
);

/**
 * GET /auth/sessions
 * Get active sessions for current user
 */
router.get(
  '/sessions',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const sessions = await refreshTokenService.getUserSessions(req.user!.id);
    successResponse(res, { sessions });
  })
);

/**
 * DELETE /auth/sessions/:sessionId
 * Revoke a specific session
 */
router.delete(
  '/sessions/:sessionId',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await refreshTokenService.revokeToken(req.params.sessionId);
    noContentResponse(res);
  })
);

// ============================================
// MFA ENDPOINTS
// ============================================

/**
 * POST /auth/mfa/setup
 * Initialize MFA setup - returns QR code and backup codes
 */
router.post(
  '/mfa/setup',
  authMiddleware,
  sensitiveRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await mfaService.setupMfa(req.user!.id);

    logSecurityEvent('MFA_SETUP_INITIATED', req, { userId: req.user!.id });

    successResponse(res, {
      secret: result.secret,
      qrCode: result.qrCode,
      backupCodes: result.backupCodes,
      message: 'Scan the QR code with your authenticator app and verify with a code',
    });
  })
);

/**
 * POST /auth/mfa/confirm
 * Confirm MFA setup by verifying first code
 */
router.post(
  '/mfa/confirm',
  authMiddleware,
  sensitiveRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { code } = mfaCodeSchema.parse(req.body);

    await mfaService.confirmMfaSetup(req.user!.id, code);

    logSecurityEvent('MFA_ENABLED', req, { userId: req.user!.id });

    successResponse(res, { message: 'MFA enabled successfully' });
  })
);

/**
 * POST /auth/mfa/verify
 * Verify MFA code and get new access token with mfaVerified claim
 */
router.post(
  '/mfa/verify',
  authMiddleware,
  authRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
    const { code } = mfaCodeSchema.parse(req.body);

    const result = await mfaService.verifyMfa(req.user!.id, code, req);

    if (!result.success) {
      res.status(401).json({ error: 'Invalid MFA code' });
      return;
    }

    // Generate new token pair with mfaVerified claim
    const tokens = await refreshTokenService.generateTokenPair(
      {
        userId: req.user!.id,
        tenantId: req.user!.tenantId,
        email: req.user!.email,
        role: req.user!.role,
        mfaVerified: true,
      },
      req
    );

    successResponse(res, {
      ...tokens,
      usedBackupCode: result.usedBackupCode,
      message: result.usedBackupCode
        ? 'MFA verified with backup code. Consider regenerating backup codes.'
        : 'MFA verified successfully',
    });
  })
);

/**
 * POST /auth/mfa/disable
 * Disable MFA (requires password verification)
 */
router.post(
  '/mfa/disable',
  authMiddleware,
  requireMfa, // Must verify current MFA before disabling
  sensitiveRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
    const { password } = mfaDisableSchema.parse(req.body);

    // Verify password before disabling MFA
    const bcrypt = await import('bcryptjs');
    const isValidPassword = await bcrypt.compare(password, req.user!.passwordHash);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    await mfaService.disableMfa(req.user!.id);

    logSecurityEvent('MFA_DISABLED', req, { userId: req.user!.id });

    successResponse(res, { message: 'MFA disabled successfully' });
  })
);

/**
 * POST /auth/mfa/backup-codes
 * Regenerate backup codes
 */
router.post(
  '/mfa/backup-codes',
  authMiddleware,
  requireMfa,
  sensitiveRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const backupCodes = await mfaService.regenerateBackupCodes(req.user!.id);

    logSecurityEvent('MFA_BACKUP_CODES_REGENERATED', req, { userId: req.user!.id });

    successResponse(res, {
      backupCodes,
      message: 'New backup codes generated. Previous codes are now invalid.',
    });
  })
);

/**
 * GET /auth/mfa/status
 * Get MFA status for current user
 */
router.get(
  '/mfa/status',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const backupCodeCount = await mfaService.getBackupCodeCount(req.user!.id);

    successResponse(res, {
      enabled: req.user!.mfaEnabled,
      required: mfaService.isMfaRequired(req.user!.role),
      backupCodesRemaining: req.user!.mfaEnabled ? backupCodeCount : 0,
    });
  })
);

export default router;
