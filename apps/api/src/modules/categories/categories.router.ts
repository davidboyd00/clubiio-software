import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  noContentResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { categoriesService } from './categories.service';
import {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
} from './categories.schema';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /categories
 * Get all categories for current tenant
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const categories = await categoriesService.findAll(req.tenantId!);
    successResponse(res, categories);
  })
);

/**
 * GET /categories/:id
 * Get a category by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const category = await categoriesService.findById(
      req.tenantId!,
      req.params.id
    );
    successResponse(res, category);
  })
);

/**
 * GET /categories/:id/products
 * Get a category with its products
 */
router.get(
  '/:id/products',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const category = await categoriesService.findWithProducts(
      req.tenantId!,
      req.params.id
    );
    successResponse(res, category);
  })
);

/**
 * POST /categories
 * Create a new category (OWNER, ADMIN, MANAGER only)
 */
router.post(
  '/',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createCategorySchema.parse(req.body);
    const category = await categoriesService.create(req.tenantId!, input);
    createdResponse(res, category);
  })
);

/**
 * PUT /categories/:id
 * Update a category (OWNER, ADMIN, MANAGER only)
 */
router.put(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateCategorySchema.parse(req.body);
    const category = await categoriesService.update(
      req.tenantId!,
      req.params.id,
      input
    );
    successResponse(res, category);
  })
);

/**
 * DELETE /categories/:id
 * Delete (deactivate) a category (OWNER, ADMIN only)
 */
router.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await categoriesService.delete(req.tenantId!, req.params.id);
    noContentResponse(res);
  })
);

/**
 * PATCH /categories/reorder
 * Reorder categories (OWNER, ADMIN, MANAGER only)
 */
router.patch(
  '/reorder',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = reorderCategoriesSchema.parse(req.body);
    const categories = await categoriesService.reorder(req.tenantId!, input);
    successResponse(res, categories);
  })
);

export default router;