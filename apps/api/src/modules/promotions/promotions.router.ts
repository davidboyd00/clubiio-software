import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  noContentResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { requireRole } from '../../middleware/auth.middleware';
import { promotionsService } from './promotions.service';
import { createPromotionSchema, updatePromotionSchema } from './promotions.schema';

const router: Router = Router();

/**
 * GET /promotions
 * List promotions with optional activeOnly filter
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const activeOnly = req.query.activeOnly === 'true';
    const promotions = await promotionsService.findAll(req.tenantId!, { activeOnly });
    successResponse(res, promotions);
  })
);

/**
 * GET /promotions/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const promotion = await promotionsService.findById(req.tenantId!, req.params.id);
    successResponse(res, promotion);
  })
);

/**
 * POST /promotions
 */
router.post(
  '/',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createPromotionSchema.parse(req.body);
    const promotion = await promotionsService.create(req.tenantId!, input);
    createdResponse(res, promotion);
  })
);

/**
 * PUT /promotions/:id
 */
router.put(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updatePromotionSchema.parse(req.body);
    const promotion = await promotionsService.update(req.tenantId!, req.params.id, input);
    successResponse(res, promotion);
  })
);

/**
 * DELETE /promotions/:id
 */
router.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await promotionsService.delete(req.tenantId!, req.params.id);
    noContentResponse(res);
  })
);

export default router;
