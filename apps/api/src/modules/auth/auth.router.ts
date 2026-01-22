import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  noContentResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { authMiddleware } from '../../middleware/auth.middleware';
import { authService } from './auth.service';
import {
  registerSchema,
  loginSchema,
  pinLoginSchema,
  changePasswordSchema,
} from './auth.schema';

const router: Router = Router();

/**
 * POST /auth/register
 * Register a new tenant with first user
 */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    createdResponse(res, result);
  })
);

/**
 * POST /auth/login
 * Login with email and password
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    successResponse(res, result);
  })
);

/**
 * POST /auth/pin-login
 * Login with PIN (for POS terminals)
 */
router.post(
  '/pin-login',
  asyncHandler(async (req, res) => {
    const input = pinLoginSchema.parse(req.body);
    const result = await authService.pinLogin(input);
    successResponse(res, result);
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
 */
router.post(
  '/change-password',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = changePasswordSchema.parse(req.body);
    await authService.changePassword(
      req.user!.id,
      input.currentPassword,
      input.newPassword
    );
    noContentResponse(res);
  })
);

export default router;
