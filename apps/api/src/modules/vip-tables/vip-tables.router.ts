import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  noContentResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { vipTablesService } from './vip-tables.service';
import {
  createVipTableSchema,
  updateVipTableSchema,
  createReservationSchema,
  updateReservationSchema,
  updateReservationStatusSchema,
  addGuestSchema,
  validateLateCodeSchema,
} from './vip-tables.schema';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

// ---- VIP Tables ----

/**
 * GET /vip-tables?venueId=xxx
 * Get all VIP tables for a venue
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const venueId = req.query.venueId as string;
    if (!venueId) {
      throw new AppError('venueId query parameter is required', 400);
    }
    const tables = await vipTablesService.findAllTables(req.tenantId!, venueId);
    successResponse(res, tables);
  })
);

/**
 * POST /vip-tables
 * Create a VIP table
 */
router.post(
  '/',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createVipTableSchema.parse(req.body);
    const table = await vipTablesService.createTable(req.tenantId!, input);
    createdResponse(res, table);
  })
);

/**
 * PUT /vip-tables/:id
 * Update a VIP table
 */
router.put(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateVipTableSchema.parse(req.body);
    const table = await vipTablesService.updateTable(req.tenantId!, req.params.id, input);
    successResponse(res, table);
  })
);

/**
 * DELETE /vip-tables/:id
 * Delete (deactivate) a VIP table
 */
router.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await vipTablesService.deleteTable(req.tenantId!, req.params.id);
    noContentResponse(res);
  })
);

// ---- Reservations ----

/**
 * GET /vip-tables/reservations?eventId=xxx
 * Get reservations for an event
 */
router.get(
  '/reservations',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const eventId = req.query.eventId as string;
    if (!eventId) {
      throw new AppError('eventId query parameter is required', 400);
    }
    const reservations = await vipTablesService.findReservations(req.tenantId!, eventId);
    successResponse(res, reservations);
  })
);

/**
 * GET /vip-tables/reservations/:id
 * Get a reservation by ID
 */
router.get(
  '/reservations/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const reservation = await vipTablesService.findReservationById(req.tenantId!, req.params.id);
    successResponse(res, reservation);
  })
);

/**
 * POST /vip-tables/reservations
 * Create a reservation
 */
router.post(
  '/reservations',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'RRPP'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createReservationSchema.parse(req.body);
    const reservation = await vipTablesService.createReservation(req.tenantId!, input);
    createdResponse(res, reservation);
  })
);

/**
 * PUT /vip-tables/reservations/:id
 * Update a reservation
 */
router.put(
  '/reservations/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'RRPP'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateReservationSchema.parse(req.body);
    const reservation = await vipTablesService.updateReservation(req.tenantId!, req.params.id, input);
    successResponse(res, reservation);
  })
);

/**
 * PATCH /vip-tables/reservations/:id/status
 * Update reservation status
 */
router.patch(
  '/reservations/:id/status',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'RRPP', 'DOORMAN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateReservationStatusSchema.parse(req.body);
    const reservation = await vipTablesService.updateReservationStatus(req.tenantId!, req.params.id, input);
    successResponse(res, reservation);
  })
);

/**
 * DELETE /vip-tables/reservations/:id
 * Delete a pending reservation
 */
router.delete(
  '/reservations/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await vipTablesService.deleteReservation(req.tenantId!, req.params.id);
    noContentResponse(res);
  })
);

// ---- Guests ----

/**
 * POST /vip-tables/reservations/:reservationId/guests
 * Add a guest to a reservation
 */
router.post(
  '/reservations/:reservationId/guests',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'RRPP', 'DOORMAN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = addGuestSchema.parse(req.body);
    const guest = await vipTablesService.addGuest(req.tenantId!, req.params.reservationId, input);
    createdResponse(res, guest);
  })
);

/**
 * DELETE /vip-tables/reservations/:reservationId/guests/:guestId
 * Remove a guest from a reservation
 */
router.delete(
  '/reservations/:reservationId/guests/:guestId',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'RRPP'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await vipTablesService.removeGuest(req.tenantId!, req.params.reservationId, req.params.guestId);
    noContentResponse(res);
  })
);

/**
 * PATCH /vip-tables/reservations/:reservationId/guests/:guestId/arrive
 * Mark a guest as arrived
 */
router.patch(
  '/reservations/:reservationId/guests/:guestId/arrive',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'RRPP', 'DOORMAN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guest = await vipTablesService.markGuestArrived(
      req.tenantId!,
      req.params.reservationId,
      req.params.guestId
    );
    successResponse(res, guest);
  })
);

/**
 * POST /vip-tables/validate-late-code
 * Validate a late guest code
 */
router.post(
  '/validate-late-code',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'RRPP', 'DOORMAN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = validateLateCodeSchema.parse(req.body);
    const reservation = await vipTablesService.validateLateCode(req.tenantId!, input.code);
    successResponse(res, reservation);
  })
);

export default router;
