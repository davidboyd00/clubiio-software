import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  noContentResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { usersService } from './users.service';
import { createUserSchema, updateUserSchema } from './users.schema';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /users
 * Get all users for current tenant (OWNER, ADMIN, MANAGER only)
 */
router.get(
  '/',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const users = await usersService.findAll(req.tenantId!);
    successResponse(res, users);
  })
);

/**
 * GET /users/:id
 * Get a user by ID
 */
router.get(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = await usersService.findById(req.tenantId!, req.params.id);
    successResponse(res, user);
  })
);

/**
 * POST /users
 * Create a new user (OWNER, ADMIN only)
 */
router.post(
  '/',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createUserSchema.parse(req.body);
    const user = await usersService.create(req.tenantId!, input);
    createdResponse(res, user);
  })
);

/**
 * PUT /users/:id
 * Update a user (OWNER, ADMIN only)
 */
router.put(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateUserSchema.parse(req.body);
    const user = await usersService.update(
      req.tenantId!,
      req.params.id,
      req.user!.id,
      input
    );
    successResponse(res, user);
  })
);

/**
 * DELETE /users/:id
 * Delete (deactivate) a user (OWNER, ADMIN only)
 */
router.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await usersService.delete(req.tenantId!, req.params.id, req.user!.id);
    noContentResponse(res);
  })
);

/**
 * GET /users/venue/:venueId
 * Get users with access to a specific venue
 */
router.get(
  '/venue/:venueId',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const users = await usersService.findByVenue(
      req.tenantId!,
      req.params.venueId
    );
    successResponse(res, users);
  })
);

export default router;
