import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  noContentResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { venuesService } from './venues.service';
import { createVenueSchema, updateVenueSchema } from './venues.schema';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /venues
 * Get all venues for current tenant
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const venues = await venuesService.findAll(req.tenantId!);
    successResponse(res, venues);
  })
);

/**
 * GET /venues/:id
 * Get a venue by ID with stats
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const venue = await venuesService.getVenueWithStats(
      req.tenantId!,
      req.params.id
    );
    successResponse(res, venue);
  })
);

/**
 * POST /venues
 * Create a new venue (OWNER, ADMIN only)
 */
router.post(
  '/',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createVenueSchema.parse(req.body);
    const venue = await venuesService.create(req.tenantId!, input);
    createdResponse(res, venue);
  })
);

/**
 * PUT /venues/:id
 * Update a venue (OWNER, ADMIN only)
 */
router.put(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateVenueSchema.parse(req.body);
    const venue = await venuesService.update(
      req.tenantId!,
      req.params.id,
      input
    );
    successResponse(res, venue);
  })
);

/**
 * DELETE /venues/:id
 * Delete (deactivate) a venue (OWNER only)
 */
router.delete(
  '/:id',
  requireRole('OWNER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await venuesService.delete(req.tenantId!, req.params.id);
    noContentResponse(res);
  })
);

export default router;
