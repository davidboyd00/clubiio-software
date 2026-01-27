import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  noContentResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { shiftsService } from './shifts.service';
import { createShiftSchema, updateShiftSchema } from './shifts.schema';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /shifts/venue/:venueId
 * Get shifts for a venue (optionally filtered by date)
 */
router.get(
  '/venue/:venueId',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const date = req.query.date as string | undefined;
    const shifts = await shiftsService.findByVenue(req.params.venueId, date);
    successResponse(res, shifts);
  })
);

/**
 * GET /shifts/staff/:staffId
 * Get shifts for a staff member
 */
router.get(
  '/staff/:staffId',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const shifts = await shiftsService.findByStaff(
      req.params.staffId,
      startDate,
      endDate
    );
    successResponse(res, shifts);
  })
);

/**
 * GET /shifts/:id
 * Get a shift by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const shift = await shiftsService.findById(req.params.id);
    successResponse(res, shift);
  })
);

/**
 * POST /shifts
 * Create a new shift
 */
router.post(
  '/',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createShiftSchema.parse(req.body);
    const shift = await shiftsService.create(input);
    createdResponse(res, shift);
  })
);

/**
 * PUT /shifts/:id
 * Update a shift
 */
router.put(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateShiftSchema.parse(req.body);
    const shift = await shiftsService.update(req.params.id, input);
    successResponse(res, shift);
  })
);

/**
 * DELETE /shifts/:id
 * Delete a shift
 */
router.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await shiftsService.delete(req.params.id);
    noContentResponse(res);
  })
);

/**
 * POST /shifts/:id/clock-in
 * Clock in to a shift
 */
router.post(
  '/:id/clock-in',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const shift = await shiftsService.clockIn(req.params.id);
    successResponse(res, shift);
  })
);

/**
 * POST /shifts/:id/clock-out
 * Clock out of a shift
 */
router.post(
  '/:id/clock-out',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const shift = await shiftsService.clockOut(req.params.id);
    successResponse(res, shift);
  })
);

/**
 * POST /shifts/:id/cancel
 * Cancel a shift
 */
router.post(
  '/:id/cancel',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { reason } = req.body || {};
    const shift = await shiftsService.cancel(req.params.id, reason);
    successResponse(res, shift);
  })
);

export default router;
