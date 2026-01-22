import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  noContentResponse,
  AuthenticatedRequest,
  getPagination,
} from '../../common/response';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { productsService } from './products.service';
import {
  createProductSchema,
  updateProductSchema,
  reorderProductsSchema,
  bulkUpdatePricesSchema,
  importProductsSchema,
} from './products.schema';
import { z } from 'zod';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /products
 * Get all products with optional filtering and pagination
 * Query params: categoryId, search, isAlcoholic, page, limit
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { categoryId, search, isAlcoholic, page, limit } = req.query;

    const options: any = {};

    if (categoryId) {
      options.categoryId = categoryId as string;
    }

    if (search) {
      options.search = search as string;
    }

    if (isAlcoholic !== undefined) {
      options.isAlcoholic = isAlcoholic === 'true';
    }

    // Add pagination if requested
    if (page || limit) {
      options.pagination = getPagination(req.query as Record<string, unknown>);
    }

    const products = await productsService.findAll(req.tenantId!, options);
    successResponse(res, products);
  })
);

/**
 * GET /products/grouped
 * Get products grouped by category (for TPV display)
 */
router.get(
  '/grouped',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const categories = await productsService.findGroupedByCategory(
      req.tenantId!
    );
    successResponse(res, categories);
  })
);

/**
 * GET /products/stats
 * Get product statistics
 */
router.get(
  '/stats',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const stats = await productsService.getStats(req.tenantId!);
    successResponse(res, stats);
  })
);

/**
 * GET /products/barcode/:barcode
 * Get a product by barcode
 */
router.get(
  '/barcode/:barcode',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const product = await productsService.findByBarcode(
      req.tenantId!,
      req.params.barcode
    );
    successResponse(res, product);
  })
);

/**
 * GET /products/:id
 * Get a product by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const product = await productsService.findById(
      req.tenantId!,
      req.params.id
    );
    successResponse(res, product);
  })
);

/**
 * POST /products
 * Create a new product (OWNER, ADMIN, MANAGER only)
 */
router.post(
  '/',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createProductSchema.parse(req.body);
    const product = await productsService.create(req.tenantId!, input);
    createdResponse(res, product);
  })
);

/**
 * POST /products/import
 * Import products from CSV/JSON (OWNER, ADMIN only)
 */
router.post(
  '/import',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = importProductsSchema.parse(req.body);
    const result = await productsService.import(req.tenantId!, input);
    successResponse(res, result);
  })
);

/**
 * PUT /products/:id
 * Update a product (OWNER, ADMIN, MANAGER only)
 */
router.put(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateProductSchema.parse(req.body);
    const product = await productsService.update(
      req.tenantId!,
      req.params.id,
      input
    );
    successResponse(res, product);
  })
);

/**
 * DELETE /products/:id
 * Delete (deactivate) a product (OWNER, ADMIN only)
 */
router.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await productsService.delete(req.tenantId!, req.params.id);
    noContentResponse(res);
  })
);

/**
 * POST /products/bulk-delete
 * Bulk delete products (OWNER, ADMIN only)
 */
router.post(
  '/bulk-delete',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { ids } = z
      .object({ ids: z.array(z.string().uuid()) })
      .parse(req.body);
    const result = await productsService.bulkDelete(req.tenantId!, ids);
    successResponse(res, result);
  })
);

/**
 * PATCH /products/reorder
 * Reorder products (OWNER, ADMIN, MANAGER only)
 */
router.patch(
  '/reorder',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = reorderProductsSchema.parse(req.body);
    const result = await productsService.reorder(req.tenantId!, input);
    successResponse(res, result);
  })
);

/**
 * PATCH /products/bulk-prices
 * Bulk update prices (OWNER, ADMIN only)
 */
router.patch(
  '/bulk-prices',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = bulkUpdatePricesSchema.parse(req.body);
    const result = await productsService.bulkUpdatePrices(req.tenantId!, input);
    successResponse(res, result);
  })
);

export default router;