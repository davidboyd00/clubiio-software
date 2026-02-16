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
import { eventsService } from './events.service';
import {
  createEventSchema,
  updateEventSchema,
  updateEventStatusSchema,
  createTicketTypeSchema,
  updateTicketTypeSchema,
} from './events.schema';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /events?venueId=xxx
 * Get all events for a venue
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const venueId = req.query.venueId as string;
    if (!venueId) {
      throw new AppError('venueId query parameter is required', 400);
    }
    const events = await eventsService.findByVenue(req.tenantId!, venueId);
    successResponse(res, events);
  })
);

/**
 * GET /events/:id
 * Get an event by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const event = await eventsService.findById(req.tenantId!, req.params.id);
    successResponse(res, event);
  })
);

/**
 * POST /events
 * Create a new event
 */
router.post(
  '/',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createEventSchema.parse(req.body);
    const event = await eventsService.create(req.tenantId!, input);
    createdResponse(res, event);
  })
);

/**
 * PUT /events/:id
 * Update an event
 */
router.put(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateEventSchema.parse(req.body);
    const event = await eventsService.update(req.tenantId!, req.params.id, input);
    successResponse(res, event);
  })
);

/**
 * PATCH /events/:id/status
 * Update event status
 */
router.patch(
  '/:id/status',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateEventStatusSchema.parse(req.body);
    const event = await eventsService.updateStatus(req.tenantId!, req.params.id, input);
    successResponse(res, event);
  })
);

/**
 * DELETE /events/:id
 * Delete a draft event
 */
router.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await eventsService.delete(req.tenantId!, req.params.id);
    noContentResponse(res);
  })
);

// ---- Ticket Type sub-routes ----

/**
 * POST /events/:id/ticket-types
 * Create a ticket type for an event
 */
router.post(
  '/:id/ticket-types',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createTicketTypeSchema.parse(req.body);
    const ticketType = await eventsService.createTicketType(req.tenantId!, req.params.id, input);
    createdResponse(res, ticketType);
  })
);

/**
 * PUT /events/:id/ticket-types/:ticketTypeId
 * Update a ticket type
 */
router.put(
  '/:id/ticket-types/:ticketTypeId',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateTicketTypeSchema.parse(req.body);
    const ticketType = await eventsService.updateTicketType(
      req.tenantId!,
      req.params.id,
      req.params.ticketTypeId,
      input
    );
    successResponse(res, ticketType);
  })
);

/**
 * DELETE /events/:id/ticket-types/:ticketTypeId
 * Delete a ticket type
 */
router.delete(
  '/:id/ticket-types/:ticketTypeId',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await eventsService.deleteTicketType(req.tenantId!, req.params.id, req.params.ticketTypeId);
    noContentResponse(res);
  })
);

export default router;
