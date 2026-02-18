import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  noContentResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { requireRole } from '../../middleware/auth.middleware';
import { customersService } from './customers.service';
import { createCustomerSchema, updateCustomerSchema } from './customers.schema';

const router: Router = Router();

/**
 * GET /customers
 * List customers with optional search and VIP filter
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { search, isVip } = req.query;
    const customers = await customersService.findAll(req.tenantId!, {
      search: search as string | undefined,
      isVip: isVip === 'true' ? true : isVip === 'false' ? false : undefined,
    });
    successResponse(res, customers);
  })
);

/**
 * GET /customers/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const customer = await customersService.findById(req.tenantId!, req.params.id);
    successResponse(res, customer);
  })
);

/**
 * POST /customers
 */
router.post(
  '/',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createCustomerSchema.parse(req.body);
    const customer = await customersService.create(req.tenantId!, input);
    createdResponse(res, customer);
  })
);

/**
 * PUT /customers/:id
 */
router.put(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateCustomerSchema.parse(req.body);
    const customer = await customersService.update(req.tenantId!, req.params.id, input);
    successResponse(res, customer);
  })
);

/**
 * DELETE /customers/:id
 */
router.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await customersService.delete(req.tenantId!, req.params.id);
    noContentResponse(res);
  })
);

export default router;
