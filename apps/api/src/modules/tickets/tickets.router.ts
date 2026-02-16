import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { ticketsService } from './tickets.service';
import {
  generateTicketsSchema,
  validateTicketSchema,
  consumeTicketSchema,
} from './tickets.schema';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /tickets/generate
 * Generate a batch of tickets
 */
router.post(
  '/generate',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = generateTicketsSchema.parse(req.body);
    const result = await ticketsService.generate(req.tenantId!, input);
    createdResponse(res, result);
  })
);

/**
 * POST /tickets/validate
 * Validate a ticket by code (scan)
 */
router.post(
  '/validate',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'DOORMAN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = validateTicketSchema.parse(req.body);
    const ticket = await ticketsService.validate(req.tenantId!, input.code);
    successResponse(res, ticket);
  })
);

/**
 * POST /tickets/consume
 * Consume ticket credit against an order
 */
router.post(
  '/consume',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'CASHIER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = consumeTicketSchema.parse(req.body);
    const ticket = await ticketsService.consume(req.tenantId!, req.user!.id, input);
    successResponse(res, ticket);
  })
);

/**
 * GET /tickets/event/:eventId
 * Get all tickets for an event
 */
router.get(
  '/event/:eventId',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const tickets = await ticketsService.findByEvent(req.tenantId!, req.params.eventId);
    successResponse(res, tickets);
  })
);

/**
 * GET /tickets/by-code/:code
 * Get a ticket by its code
 */
router.get(
  '/by-code/:code',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'DOORMAN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const ticket = await ticketsService.findByCode(req.tenantId!, req.params.code);
    successResponse(res, ticket);
  })
);

export default router;
