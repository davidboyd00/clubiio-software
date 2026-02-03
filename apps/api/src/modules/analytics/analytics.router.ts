import { Router } from 'express';
import { asyncHandler, successResponse, AuthenticatedRequest } from '../../common/response';
import { venueMiddleware, requireRole } from '../../middleware/auth.middleware';
import { analyticsService } from './analytics.service';
import {
  overviewQuerySchema,
  risksQuerySchema,
  snapshotsQuerySchema,
  applyActionSchema,
  actionsQuerySchema,
  resolveActionSchema,
} from './analytics.schema';

const router: Router = Router();

router.get(
  '/overview',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  venueMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const dateValue = typeof req.query.date === 'string' ? req.query.date : undefined;
    const query = overviewQuerySchema.parse({
      venueId: req.venueId,
      date: dateValue,
    });

    const payload = await analyticsService.getOverview(
      req.tenantId!,
      query.venueId,
      query.date
    );

    successResponse(res, payload);
  })
);

router.get(
  '/risks',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  venueMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const query = risksQuerySchema.parse({
      venueId: req.venueId,
      windowMinutes: req.query.windowMinutes,
    });

    const payload = await analyticsService.getRisks(
      req.tenantId!,
      query.venueId,
      query.windowMinutes
    );

    successResponse(res, payload);
  })
);

router.get(
  '/snapshots',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  venueMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const query = snapshotsQuerySchema.parse({
      venueId: req.venueId,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      limit: req.query.limit,
    });

    const payload = await analyticsService.getDailySnapshots(
      req.tenantId!,
      query.venueId,
      query.from,
      query.to,
      query.limit
    );

    successResponse(res, payload);
  })
);

router.post(
  '/actions/apply',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = applyActionSchema.parse(req.body);

    const result = await analyticsService.applyAction(
      req.tenantId!,
      input.venueId,
      {
        id: input.actionId,
        type: input.actionType,
        label: input.label || input.actionId,
        auto: true,
        payload: input.payload,
      },
      req.user?.id
    );

    successResponse(res, result);
  })
);

router.get(
  '/actions',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'BARTENDER', 'DOORMAN', 'RRPP'),
  venueMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const query = actionsQuerySchema.parse({
      venueId: req.venueId,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      limit: req.query.limit,
    });

    const payload = await analyticsService.getActions(
      req.tenantId!,
      query.venueId,
      query.status,
      query.limit
    );

    successResponse(res, payload);
  })
);

router.post(
  '/actions/resolve',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'BARTENDER', 'DOORMAN', 'RRPP'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = resolveActionSchema.parse(req.body);

    const payload = await analyticsService.resolveAction(
      req.tenantId!,
      input.actionId,
      input.status,
      req.user?.id,
      input.note
    );

    successResponse(res, payload);
  })
);

export default router;
