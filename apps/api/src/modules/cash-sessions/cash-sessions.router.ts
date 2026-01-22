import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { cashSessionsService } from './cash-sessions.service';
import {
  openCashSessionSchema,
  closeCashSessionSchema,
  createCashMovementSchema,
} from './cash-sessions.schema';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /cash-sessions/my-session
 * Get current user's open session
 */
router.get(
  '/my-session',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const session = await cashSessionsService.findOpenByUser(
      req.tenantId!,
      req.user!.id
    );
    successResponse(res, session);
  })
);

/**
 * GET /cash-sessions/cash-register/:cashRegisterId
 * Get sessions for a cash register
 */
router.get(
  '/cash-register/:cashRegisterId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const includeAll = req.query.includeAll === 'true';
    const sessions = await cashSessionsService.findAllByCashRegister(
      req.tenantId!,
      req.params.cashRegisterId,
      includeAll
    );
    successResponse(res, sessions);
  })
);

/**
 * GET /cash-sessions/:id
 * Get a session by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const session = await cashSessionsService.findById(
      req.tenantId!,
      req.params.id
    );
    successResponse(res, session);
  })
);

/**
 * GET /cash-sessions/:id/summary
 * Get session summary with totals
 */
router.get(
  '/:id/summary',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const summary = await cashSessionsService.getSessionSummary(
      req.tenantId!,
      req.params.id
    );
    successResponse(res, summary);
  })
);

/**
 * GET /cash-sessions/:id/movements
 * Get movements for a session
 */
router.get(
  '/:id/movements',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const movements = await cashSessionsService.getMovements(
      req.tenantId!,
      req.params.id
    );
    successResponse(res, movements);
  })
);

/**
 * POST /cash-sessions/open
 * Open a new cash session
 */
router.post(
  '/open',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = openCashSessionSchema.parse(req.body);
    const session = await cashSessionsService.open(
      req.tenantId!,
      req.user!.id,
      input
    );
    createdResponse(res, session);
  })
);

/**
 * POST /cash-sessions/:id/close
 * Close a cash session
 */
router.post(
  '/:id/close',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = closeCashSessionSchema.parse(req.body);
    const session = await cashSessionsService.close(
      req.tenantId!,
      req.user!.id,
      req.params.id,
      input
    );
    successResponse(res, session);
  })
);

/**
 * POST /cash-sessions/:id/movements
 * Add a movement to a session (OWNER, ADMIN, MANAGER only)
 */
router.post(
  '/:id/movements',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createCashMovementSchema.parse(req.body);
    const movement = await cashSessionsService.addMovement(
      req.tenantId!,
      req.params.id,
      input
    );
    createdResponse(res, movement);
  })
);

export default router;
