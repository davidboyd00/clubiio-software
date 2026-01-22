import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  noContentResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { cashRegistersService } from './cash-registers.service';
import {
  createCashRegisterSchema,
  updateCashRegisterSchema,
} from './cash-registers.schema';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /cash-registers/venue/:venueId
 * Get all cash registers for a venue
 */
router.get(
  '/venue/:venueId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const cashRegisters = await cashRegistersService.findAllByVenue(
      req.tenantId!,
      req.params.venueId
    );
    successResponse(res, cashRegisters);
  })
);

/**
 * GET /cash-registers/:id
 * Get a cash register by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const cashRegister = await cashRegistersService.findById(
      req.tenantId!,
      req.params.id
    );
    successResponse(res, cashRegister);
  })
);

/**
 * GET /cash-registers/:id/status
 * Get cash register with current session status
 */
router.get(
  '/:id/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const cashRegister = await cashRegistersService.findWithStatus(
      req.tenantId!,
      req.params.id
    );
    successResponse(res, cashRegister);
  })
);

/**
 * POST /cash-registers
 * Create a new cash register (OWNER, ADMIN, MANAGER only)
 */
router.post(
  '/',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createCashRegisterSchema.parse(req.body);
    const cashRegister = await cashRegistersService.create(req.tenantId!, input);
    createdResponse(res, cashRegister);
  })
);

/**
 * PUT /cash-registers/:id
 * Update a cash register (OWNER, ADMIN, MANAGER only)
 */
router.put(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateCashRegisterSchema.parse(req.body);
    const cashRegister = await cashRegistersService.update(
      req.tenantId!,
      req.params.id,
      input
    );
    successResponse(res, cashRegister);
  })
);

/**
 * DELETE /cash-registers/:id
 * Delete a cash register (OWNER, ADMIN only)
 */
router.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await cashRegistersService.delete(req.tenantId!, req.params.id);
    noContentResponse(res);
  })
);

export default router;
