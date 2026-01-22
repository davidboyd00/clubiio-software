import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  AuthenticatedRequest,
  getPagination,
} from '../../common/response';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { ordersService } from './orders.service';
import {
  createOrderSchema,
  voidOrderSchema,
} from './orders.schema';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /orders/session/:sessionId
 * Get orders for a cash session
 */
router.get(
  '/session/:sessionId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { status, page, limit } = req.query;

    const options: any = {};
    if (status) {
      options.status = status as string;
    }
    if (page || limit) {
      options.pagination = getPagination(req.query as Record<string, unknown>);
    }

    const orders = await ordersService.findBySession(
      req.tenantId!,
      req.params.sessionId,
      options
    );
    successResponse(res, orders);
  })
);

/**
 * GET /orders/daily-summary/:venueId
 * Get daily sales summary for a venue
 */
router.get(
  '/daily-summary/:venueId',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const date = req.query.date
      ? new Date(req.query.date as string)
      : undefined;
    const summary = await ordersService.getDailySummary(
      req.tenantId!,
      req.params.venueId,
      date
    );
    successResponse(res, summary);
  })
);

/**
 * GET /orders/:id
 * Get an order by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const order = await ordersService.findById(req.tenantId!, req.params.id);
    successResponse(res, order);
  })
);

/**
 * POST /orders
 * Create a new order
 */
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createOrderSchema.parse(req.body);
    const order = await ordersService.create(
      req.tenantId!,
      req.user!.id,
      input
    );
    createdResponse(res, order);
  })
);

/**
 * POST /orders/:id/void
 * Void an order (OWNER, ADMIN, MANAGER, or order creator)
 */
router.post(
  '/:id/void',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = voidOrderSchema.parse(req.body);
    const order = await ordersService.void(
      req.tenantId!,
      req.user!.id,
      req.params.id,
      input
    );
    successResponse(res, order);
  })
);

export default router;
