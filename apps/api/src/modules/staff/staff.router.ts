import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  noContentResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { staffService } from './staff.service';
import { createStaffSchema, updateStaffSchema, updatePinSchema } from './staff.schema';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /staff/venue/:venueId
 * Get all staff members for a venue
 */
router.get(
  '/venue/:venueId',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const staff = await staffService.findByVenue(req.tenantId!, req.params.venueId);
    successResponse(res, staff);
  })
);

/**
 * GET /staff/:id
 * Get a staff member by ID
 */
router.get(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const staff = await staffService.findById(req.tenantId!, req.params.id);
    successResponse(res, staff);
  })
);

/**
 * GET /staff/:id/summary
 * Get staff summary with stats
 */
router.get(
  '/:id/summary',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const summary = await staffService.getSummary(
      req.tenantId!,
      req.params.id,
      startDate,
      endDate
    );
    successResponse(res, summary);
  })
);

/**
 * POST /staff
 * Create a new staff member
 */
router.post(
  '/',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createStaffSchema.parse(req.body);
    const staff = await staffService.create(req.tenantId!, input);
    createdResponse(res, staff);
  })
);

/**
 * PUT /staff/:id
 * Update a staff member
 */
router.put(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateStaffSchema.parse(req.body);
    const staff = await staffService.update(req.tenantId!, req.params.id, input);
    successResponse(res, staff);
  })
);

/**
 * POST /staff/:id/pin
 * Update staff PIN
 */
router.post(
  '/:id/pin',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { pin } = updatePinSchema.parse(req.body);
    await staffService.updatePin(req.tenantId!, req.params.id, pin);
    successResponse(res, { message: 'PIN updated successfully' });
  })
);

/**
 * POST /staff/:id/deactivate
 * Deactivate a staff member
 */
router.post(
  '/:id/deactivate',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const staff = await staffService.deactivate(req.tenantId!, req.params.id);
    successResponse(res, staff);
  })
);

/**
 * POST /staff/:id/activate
 * Activate a staff member
 */
router.post(
  '/:id/activate',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const staff = await staffService.activate(req.tenantId!, req.params.id);
    successResponse(res, staff);
  })
);

/**
 * DELETE /staff/:id
 * Delete a staff member (permanent)
 */
router.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await staffService.delete(req.tenantId!, req.params.id, req.user!.id);
    noContentResponse(res);
  })
);

export default router;
