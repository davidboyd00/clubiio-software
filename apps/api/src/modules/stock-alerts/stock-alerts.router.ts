import { Router } from 'express';
import {
  asyncHandler,
  successResponse,
  createdResponse,
  AuthenticatedRequest,
} from '../../common/response';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { randomUUID } from 'crypto';

import { stockMonitor } from './stock-monitor.service';
import { alertEngine } from './alert-engine.service';
import { notificationRouter } from './notification-router.service';

import {
  createStockAlertConfigSchema,
  updateStockAlertConfigSchema,
  acknowledgeAlertSchema,
  resolveAlertSchema,
  bulkAcknowledgeSchema,
  getAlertsQuerySchema,
  stockUpdateEventSchema,
  restockEventSchema,
  addMonitoredCategorySchema,
  updateMonitoredCategorySchema,
} from './stock-alerts.schema';

import type { StockAlertConfig } from './stock-alerts.types';

// ============================================
// STOCK ALERTS ROUTER
// ============================================

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

// ============================================
// CONFIGURATION ENDPOINTS
// ============================================

/**
 * GET /stock-alerts/config
 * Get current stock alert configuration for a venue
 */
router.get(
  '/config',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (_req: AuthenticatedRequest, res): Promise<void> => {
    const config = alertEngine.getConfig();

    if (!config) {
      res.status(404).json({ error: 'Configuration not initialized' });
      return;
    }

    successResponse(res, { config });
  })
);

/**
 * POST /stock-alerts/config
 * Create or update stock alert configuration
 */
router.post(
  '/config',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = createStockAlertConfigSchema.parse(req.body);
    const venueId = req.body.venueId || req.tenantId;

    const config: StockAlertConfig = {
      configId: randomUUID(),
      venueId,
      enabled: input.enabled,
      defaultThresholds: input.defaultThresholds,
      monitoredCategories: input.monitoredCategories.map(cat => ({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        productType: cat.productType,
        rotation: cat.rotation,
        enabled: cat.enabled,
        thresholds: cat.thresholds ?? input.defaultThresholds,
      })),
      notifications: input.notifications,
      monitoring: input.monitoring,
    };

    // Configure all services
    alertEngine.setConfig(config);
    notificationRouter.setConfig(config);

    // Start monitoring if enabled
    if (config.enabled && !stockMonitor.isActive()) {
      stockMonitor.start();
    }

    createdResponse(res, { config, message: 'Configuration saved' });
  })
);

/**
 * PATCH /stock-alerts/config
 * Update specific configuration fields
 */
router.patch(
  '/config',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
    const updates = updateStockAlertConfigSchema.parse(req.body);
    const currentConfig = alertEngine.getConfig();

    if (!currentConfig) {
      res.status(404).json({ error: 'Configuration not initialized' });
      return;
    }

    // Ensure monitoredCategories always have thresholds defined
    const monitoredCategories = updates.monitoredCategories
      ? updates.monitoredCategories.map(cat => ({
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          productType: cat.productType,
          rotation: cat.rotation,
          enabled: cat.enabled,
          thresholds: cat.thresholds ?? currentConfig.defaultThresholds,
        }))
      : currentConfig.monitoredCategories;

    const updatedConfig: StockAlertConfig = {
      ...currentConfig,
      ...updates,
      monitoredCategories,
      notifications: { ...currentConfig.notifications, ...updates.notifications },
      monitoring: { ...currentConfig.monitoring, ...updates.monitoring },
    };

    alertEngine.setConfig(updatedConfig);
    notificationRouter.setConfig(updatedConfig);

    successResponse(res, { config: updatedConfig });
  })
);

// ============================================
// ALERT ENDPOINTS
// ============================================

/**
 * GET /stock-alerts/alerts
 * Get alerts with optional filters
 */
router.get(
  '/alerts',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const query = getAlertsQuerySchema.parse(req.query);

    const alerts = alertEngine.getAlerts({
      barId: query.barId,
      status: query.status,
      severity: query.severity,
      productType: query.productType,
    });

    // Pagination
    const start = (query.page - 1) * query.pageSize;
    const end = start + query.pageSize;
    const paginatedAlerts = alerts.slice(start, end);

    // Summary
    const activeAlerts = alerts.filter(a => a.status === 'active');
    const summary = {
      critical: activeAlerts.filter(a => a.severity === 'critical' || a.severity === 'emergency').length,
      warning: activeAlerts.filter(a => a.severity === 'warning').length,
      info: activeAlerts.filter(a => a.severity === 'info').length,
      activeTotal: activeAlerts.length,
    };

    successResponse(res, {
      alerts: paginatedAlerts,
      pagination: {
        total: alerts.length,
        page: query.page,
        pageSize: query.pageSize,
        hasMore: end < alerts.length,
      },
      summary,
    });
  })
);

/**
 * GET /stock-alerts/alerts/stats
 * Get alert statistics
 */
router.get(
  '/alerts/stats',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (_req: AuthenticatedRequest, res): Promise<void> => {
    const stats = alertEngine.getAlertStats();
    successResponse(res, { stats });
  })
);

/**
 * GET /stock-alerts/alerts/:alertId
 * Get a specific alert
 */
router.get(
  '/alerts/:alertId',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR'),
  asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
    const alert = alertEngine.getAlert(req.params.alertId);

    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    successResponse(res, { alert });
  })
);

/**
 * POST /stock-alerts/alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.post(
  '/alerts/:alertId/acknowledge',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR'),
  asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
    const body = acknowledgeAlertSchema.partial().parse(req.body);
    const userId = req.user?.id || 'unknown';

    const alert = alertEngine.acknowledgeAlert(req.params.alertId, userId, body?.note);

    if (!alert) {
      res.status(404).json({ error: 'Alert not found or already acknowledged' });
      return;
    }

    successResponse(res, { alert, success: true });
  })
);

/**
 * POST /stock-alerts/alerts/:alertId/resolve
 * Resolve an alert
 */
router.post(
  '/alerts/:alertId/resolve',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR'),
  asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
    const body = resolveAlertSchema.parse({ ...req.body, alertId: req.params.alertId });
    const userId = req.user?.id;

    const alert = alertEngine.resolveAlert(req.params.alertId, body.resolution, userId);

    if (!alert) {
      res.status(404).json({ error: 'Alert not found or already resolved' });
      return;
    }

    successResponse(res, { alert, success: true });
  })
);

/**
 * POST /stock-alerts/alerts/bulk-acknowledge
 * Acknowledge multiple alerts at once
 */
router.post(
  '/alerts/bulk-acknowledge',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { alertIds } = bulkAcknowledgeSchema.parse(req.body);
    const userId = req.user?.id || 'unknown';

    const acknowledged = alertEngine.bulkAcknowledge(alertIds, userId);

    successResponse(res, {
      acknowledged: acknowledged.length,
      alerts: acknowledged,
      success: true,
    });
  })
);

// ============================================
// STOCK ENDPOINTS
// ============================================

/**
 * GET /stock-alerts/stock
 * Get all bars' stock status
 */
router.get(
  '/stock',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR'),
  asyncHandler(async (_req: AuthenticatedRequest, res): Promise<void> => {
    const snapshots = stockMonitor.getAllBarsSnapshot();
    successResponse(res, { bars: snapshots });
  })
);

/**
 * GET /stock-alerts/stock/low
 * Get products with low stock across all bars
 */
router.get(
  '/stock/low',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const threshold = Number(req.query.threshold) || 25;
    const products = stockMonitor.getLowStockProducts(threshold);

    successResponse(res, {
      products,
      count: products.length,
      threshold,
    });
  })
);

/**
 * GET /stock-alerts/stock/depleting
 * Get products that will deplete soon
 */
router.get(
  '/stock/depleting',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const horizonMinutes = Number(req.query.horizon) || 30;
    const products = stockMonitor.getProductsDepletingSoon(horizonMinutes);

    successResponse(res, {
      products,
      count: products.length,
      horizonMinutes,
    });
  })
);

/**
 * GET /stock-alerts/stock/:barId
 * Get stock snapshot for a bar
 */
router.get(
  '/stock/:barId',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR'),
  asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
    const barId = req.params.barId;
    const includeAlerts = req.query.includeAlerts !== 'false';
    const includeRecommendations = req.query.includeRecommendations !== 'false';

    const snapshot = stockMonitor.getBarSnapshot(barId);

    if (!snapshot) {
      res.status(404).json({ error: 'Bar not found or not initialized' });
      return;
    }

    const response: Record<string, unknown> = { snapshot };

    if (includeAlerts) {
      response.alerts = alertEngine.getAlerts({ barId, status: 'active' });
    }

    if (includeRecommendations) {
      const lowStock = stockMonitor.getLowStockProducts(25);
      const barLowStock = lowStock.filter(p => p.barId === barId);

      response.recommendations = barLowStock.map(product => ({
        productId: product.productId,
        productName: product.productName,
        action: product.stockPercentage <= 10 ? 'restock_now' :
                product.stockPercentage <= 25 ? 'restock_soon' : 'monitor',
        suggestedQty: stockMonitor.calculateSuggestedRestock(product),
        priority: product.stockPercentage <= 10 ? 1 : product.stockPercentage <= 25 ? 2 : 3,
        reason: `Stock al ${product.stockPercentage.toFixed(0)}%`,
      }));
    }

    successResponse(res, response);
  })
);

// ============================================
// STOCK UPDATE ENDPOINTS (from POS/Inventory)
// ============================================

/**
 * POST /stock-alerts/stock/update
 * Process a stock update from POS sale or inventory adjustment
 */
router.post(
  '/stock/update',
  asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
    const event = stockUpdateEventSchema.parse(req.body);

    const updated = stockMonitor.processStockUpdate(event);

    if (!updated) {
      res.status(404).json({ error: 'Product or bar not in monitoring cache' });
      return;
    }

    successResponse(res, {
      product: updated,
      message: 'Stock updated',
    });
  })
);

/**
 * POST /stock-alerts/stock/restock
 * Process a restock event
 */
router.post(
  '/stock/restock',
  requireRole('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { barId, items, staffId } = restockEventSchema.parse(req.body);

    const results = [];

    for (const item of items) {
      const updated = stockMonitor.processStockUpdate({
        barId,
        productId: item.productId,
        previousStock: 0,
        newStock: item.newTotal,
        changeType: 'restock',
        quantity: item.quantity,
        timestamp: new Date(),
        staffId,
      });

      if (updated) {
        results.push(updated);
      }
    }

    successResponse(res, {
      restocked: results.length,
      products: results,
      message: `Restocked ${results.length} products`,
    });
  })
);

// ============================================
// CATEGORY CONFIGURATION ENDPOINTS
// ============================================

/**
 * POST /stock-alerts/categories
 * Add a monitored category
 */
router.post(
  '/categories',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
    const input = addMonitoredCategorySchema.parse(req.body);
    const config = alertEngine.getConfig();

    if (!config) {
      res.status(404).json({ error: 'Configuration not initialized' });
      return;
    }

    if (config.monitoredCategories.some(cat => cat.categoryId === input.categoryId)) {
      res.status(409).json({ error: 'Category already monitored' });
      return;
    }

    config.monitoredCategories.push({
      categoryId: input.categoryId,
      categoryName: '',
      productType: input.productType,
      rotation: input.rotation,
      thresholds: input.thresholds || config.defaultThresholds,
      enabled: true,
    });

    alertEngine.setConfig(config);

    createdResponse(res, { config, message: 'Category added' });
  })
);

/**
 * PATCH /stock-alerts/categories/:categoryId
 * Update a monitored category
 */
router.patch(
  '/categories/:categoryId',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
    const updates = updateMonitoredCategorySchema.omit({ categoryId: true }).parse(req.body);
    const config = alertEngine.getConfig();

    if (!config) {
      res.status(404).json({ error: 'Configuration not initialized' });
      return;
    }

    const categoryIndex = config.monitoredCategories.findIndex(
      cat => cat.categoryId === req.params.categoryId
    );

    if (categoryIndex === -1) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    config.monitoredCategories[categoryIndex] = {
      ...config.monitoredCategories[categoryIndex],
      ...updates,
    };

    alertEngine.setConfig(config);

    successResponse(res, { category: config.monitoredCategories[categoryIndex] });
  })
);

/**
 * DELETE /stock-alerts/categories/:categoryId
 * Remove a monitored category
 */
router.delete(
  '/categories/:categoryId',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
    const config = alertEngine.getConfig();

    if (!config) {
      res.status(404).json({ error: 'Configuration not initialized' });
      return;
    }

    const initialLength = config.monitoredCategories.length;
    config.monitoredCategories = config.monitoredCategories.filter(
      cat => cat.categoryId !== req.params.categoryId
    );

    if (config.monitoredCategories.length === initialLength) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    alertEngine.setConfig(config);

    successResponse(res, { message: 'Category removed' });
  })
);

// ============================================
// RECIPIENT MANAGEMENT ENDPOINTS
// ============================================

/**
 * POST /stock-alerts/recipients
 * Register a recipient for notifications
 */
router.post(
  '/recipients',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
    const { userId, role, channels, email, pushToken } = req.body;

    const success = notificationRouter.registerRecipient({
      userId,
      role,
      channels: channels || ['websocket', 'push'],
      email,
      pushToken,
    });

    if (!success) {
      res.status(403).json({
        error: 'Registration rejected',
        message: 'Only admin, manager, and supervisor roles can receive stock alerts',
      });
      return;
    }

    createdResponse(res, { success: true, message: 'Recipient registered' });
  })
);

/**
 * DELETE /stock-alerts/recipients/:userId
 * Unregister a recipient
 */
router.delete(
  '/recipients/:userId',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    notificationRouter.unregisterRecipient(req.params.userId);
    successResponse(res, { success: true, message: 'Recipient unregistered' });
  })
);

/**
 * GET /stock-alerts/recipients
 * List registered recipients
 */
router.get(
  '/recipients',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const role = req.query.role as 'admin' | 'manager' | 'supervisor' | undefined;
    const recipients = notificationRouter.getRecipients(role);
    successResponse(res, { recipients });
  })
);

// ============================================
// MONITORING CONTROL ENDPOINTS
// ============================================

/**
 * POST /stock-alerts/monitoring/start
 * Start the stock monitoring service
 */
router.post(
  '/monitoring/start',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (_req: AuthenticatedRequest, res): Promise<void> => {
    try {
      stockMonitor.start();
      successResponse(res, { status: 'running', message: 'Monitoring started' });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  })
);

/**
 * POST /stock-alerts/monitoring/stop
 * Stop the stock monitoring service
 */
router.post(
  '/monitoring/stop',
  requireRole('OWNER', 'ADMIN'),
  asyncHandler(async (_req: AuthenticatedRequest, res): Promise<void> => {
    stockMonitor.stop();
    successResponse(res, { status: 'stopped', message: 'Monitoring stopped' });
  })
);

/**
 * GET /stock-alerts/monitoring/status
 * Get monitoring service status
 */
router.get(
  '/monitoring/status',
  requireRole('OWNER', 'ADMIN', 'MANAGER'),
  asyncHandler(async (_req: AuthenticatedRequest, res): Promise<void> => {
    successResponse(res, {
      isRunning: stockMonitor.isActive(),
      config: alertEngine.getConfig(),
      alertStats: alertEngine.getAlertStats(),
    });
  })
);

export default router;
