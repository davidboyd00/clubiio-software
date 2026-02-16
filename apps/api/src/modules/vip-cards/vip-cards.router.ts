import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { vipCardsService } from './vip-cards.service';
import {
  createVipCardSchema,
  updateVipCardSchema,
  loadBalanceSchema,
  purchaseSchema,
  transferSchema,
} from './vip-cards.schema';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /vip-cards
 * Get all VIP cards for current tenant
 */
router.get(
  '/',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const cards = await vipCardsService.findAll(req.tenantId!);
    successResponse(res, cards);
  })
);

/**
 * GET /vip-cards/:id
 * Get a VIP card by ID with recent transactions
 */
router.get(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'CASHIER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const card = await vipCardsService.findById(req.tenantId!, req.params.id);
    successResponse(res, card);
  })
);

/**
 * POST /vip-cards
 * Create a new VIP card
 */
router.post(
  '/',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createVipCardSchema.parse(req.body);
    const card = await vipCardsService.create(req.tenantId!, input);
    createdResponse(res, card);
  })
);

/**
 * PUT /vip-cards/:id
 * Update a VIP card
 */
router.put(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateVipCardSchema.parse(req.body);
    const card = await vipCardsService.update(req.tenantId!, req.params.id, input);
    successResponse(res, card);
  })
);

/**
 * POST /vip-cards/:id/load
 * Load balance onto a VIP card
 */
router.post(
  '/:id/load',
  requireRole('OWNER', 'ADMIN', 'CASHIER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = loadBalanceSchema.parse(req.body);
    const card = await vipCardsService.loadBalance(
      req.tenantId!,
      req.params.id,
      req.user!.id,
      input
    );
    successResponse(res, card);
  })
);

/**
 * POST /vip-cards/:id/purchase
 * Make a purchase using a VIP card
 */
router.post(
  '/:id/purchase',
  requireRole('OWNER', 'ADMIN', 'CASHIER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = purchaseSchema.parse(req.body);
    const card = await vipCardsService.purchase(
      req.tenantId!,
      req.params.id,
      req.user!.id,
      input
    );
    successResponse(res, card);
  })
);

/**
 * POST /vip-cards/:id/transfer
 * Transfer balance between VIP cards
 */
router.post(
  '/:id/transfer',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = transferSchema.parse(req.body);
    const result = await vipCardsService.transfer(
      req.tenantId!,
      req.params.id,
      req.user!.id,
      input
    );
    successResponse(res, result);
  })
);

/**
 * POST /vip-cards/:id/block
 * Block a VIP card
 */
router.post(
  '/:id/block',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const card = await vipCardsService.block(req.tenantId!, req.params.id);
    successResponse(res, card);
  })
);

/**
 * POST /vip-cards/:id/unblock
 * Unblock a VIP card
 */
router.post(
  '/:id/unblock',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const card = await vipCardsService.unblock(req.tenantId!, req.params.id);
    successResponse(res, card);
  })
);

export default router;
