import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  noContentResponse,
  AuthenticatedRequest,
  getPagination,
} from '../../common/response';
import { requireRole } from '../../middleware/auth.middleware';
import { warehousesService } from './warehouses.service';
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  upsertStockSchema,
  adjustStockSchema,
  transferStockSchema,
  purchaseStockSchema,
} from './warehouses.schema';
import { io } from '../../index';

const router: Router = Router();

// ============================================
// Warehouse CRUD
// ============================================

/**
 * GET /warehouses?venueId=xxx
 * List warehouses for a venue
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const venueId = req.query.venueId as string;
    if (!venueId) {
      res.status(400).json({ success: false, error: 'venueId query parameter is required' });
      return;
    }
    const warehouses = await warehousesService.findAll(req.tenantId!, venueId);
    successResponse(res, warehouses);
  })
);

/**
 * GET /warehouses/:id
 * Get warehouse detail with stock items
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const warehouse = await warehousesService.findById(req.tenantId!, req.params.id);
    successResponse(res, warehouse);
  })
);

/**
 * POST /warehouses
 * Create a warehouse
 */
router.post(
  '/',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createWarehouseSchema.parse(req.body);
    const warehouse = await warehousesService.create(req.tenantId!, input);
    createdResponse(res, warehouse);
  })
);

/**
 * PUT /warehouses/:id
 * Update a warehouse
 */
router.put(
  '/:id',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = updateWarehouseSchema.parse(req.body);
    const warehouse = await warehousesService.update(req.tenantId!, req.params.id, input);
    successResponse(res, warehouse);
  })
);

/**
 * DELETE /warehouses/:id
 * Deactivate a warehouse
 */
router.delete(
  '/:id',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await warehousesService.delete(req.tenantId!, req.params.id);
    noContentResponse(res);
  })
);

// ============================================
// Stock Items
// ============================================

/**
 * GET /warehouses/:id/stock
 * List stock items with product info
 */
router.get(
  '/:id/stock',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const items = await warehousesService.getStock(req.tenantId!, req.params.id);
    successResponse(res, items);
  })
);

/**
 * PUT /warehouses/:id/stock
 * Upsert batch of stock items
 */
router.put(
  '/:id/stock',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = upsertStockSchema.parse(req.body);
    const items = await warehousesService.upsertStock(req.tenantId!, req.params.id, input);
    successResponse(res, items);
  })
);

// ============================================
// Stock Movements
// ============================================

/**
 * GET /warehouses/:id/movements
 * Movement history with filters
 */
router.get(
  '/:id/movements',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { page, limit } = getPagination(req.query);
    const result = await warehousesService.getMovements(req.tenantId!, req.params.id, {
      productId: req.query.productId as string | undefined,
      type: req.query.type as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page,
      limit,
    });
    successResponse(res, result);
  })
);

/**
 * POST /warehouses/:id/adjust
 * Manual stock adjustment
 */
router.post(
  '/:id/adjust',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = adjustStockSchema.parse(req.body);
    const result = await warehousesService.adjustStock(
      req.tenantId!,
      req.params.id,
      req.user!.id,
      input
    );
    io.to(`venue:${result.venueId}`).emit('stock:adjusted', {
      warehouseId: req.params.id,
      movement: result.movement,
    });
    createdResponse(res, result.movement);
  })
);

/**
 * POST /warehouses/:id/transfer
 * Transfer stock to another warehouse
 */
router.post(
  '/:id/transfer',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = transferStockSchema.parse(req.body);
    const result = await warehousesService.transferStock(
      req.tenantId!,
      req.params.id,
      req.user!.id,
      input
    );
    io.to(`venue:${result.venueId}`).emit('stock:transferred', {
      fromWarehouseId: req.params.id,
      toWarehouseId: input.toWarehouseId,
      movements: result.movements,
    });
    createdResponse(res, result.movements);
  })
);

/**
 * POST /warehouses/:id/purchase
 * Record purchase/incoming stock
 */
router.post(
  '/:id/purchase',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = purchaseStockSchema.parse(req.body);
    const result = await warehousesService.purchaseStock(
      req.tenantId!,
      req.params.id,
      req.user!.id,
      input
    );
    io.to(`venue:${result.venueId}`).emit('stock:purchased', {
      warehouseId: req.params.id,
      movements: result.movements,
    });
    createdResponse(res, result.movements);
  })
);

export default router;
