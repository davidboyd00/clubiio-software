import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { accessService } from './access.service';
import { createAccessLogSchema } from './access.schema';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /access/log
 * Log an access event (entry/exit/re-entry)
 */
router.post(
  '/log',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'DOORMAN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createAccessLogSchema.parse(req.body);
    const log = await accessService.logAccess(req.tenantId!, req.user!.id, input);
    createdResponse(res, log);
  })
);

/**
 * GET /access/logs?venueId=xxx&eventId=xxx&type=ENTRY&source=CLUBIO_TICKET
 * Get access logs with filters
 */
router.get(
  '/logs',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'DOORMAN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const venueId = req.query.venueId as string;
    if (!venueId) {
      throw new AppError('venueId query parameter is required', 400);
    }
    const logs = await accessService.getLogs(req.tenantId!, {
      venueId,
      eventId: req.query.eventId as string | undefined,
      type: req.query.type as string | undefined,
      source: req.query.source as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    successResponse(res, logs);
  })
);

/**
 * GET /access/occupancy/:venueId
 * Get current occupancy for a venue
 */
router.get(
  '/occupancy/:venueId',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'DOORMAN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const occupancy = await accessService.getOccupancy(req.tenantId!, req.params.venueId);
    successResponse(res, occupancy);
  })
);

/**
 * GET /access/stats/:venueId
 * Get access stats for a venue
 */
router.get(
  '/stats/:venueId',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const stats = await accessService.getStats(
      req.tenantId!,
      req.params.venueId,
      req.query.eventId as string | undefined
    );
    successResponse(res, stats);
  })
);

export default router;
