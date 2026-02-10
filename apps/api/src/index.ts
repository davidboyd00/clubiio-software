import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { config, initializeSecrets } from './config';
import { notFoundHandler, errorHandler } from './middleware/error.middleware';

// Security middleware imports
import {
  securityHeaders,
  customSecurityHeaders,
  requestId,
  sanitizeHeaders,
} from './middleware/security.middleware';
import {
  standardRateLimiter,
} from './middleware/rate-limit.middleware';
import { auditMiddleware } from './middleware/audit.middleware';
import { csrfMiddleware, csrfErrorHandler, csrfTokenEndpoint, isCsrfEnabled } from './middleware/csrf.middleware';
import { setupSecureSocketHandlers, emitToRole, emitToVenue, emitToCashRegister } from './middleware/socket-auth.middleware';
import prisma from './common/database';
import { analyticsEvents } from './modules/analytics/analytics.events';

// Import routers
import { authRouter } from './modules/auth';
import { venuesRouter } from './modules/venues';
import { usersRouter } from './modules/users';
import { healthRouter } from './modules/health';
import { categoriesRouter } from './modules/categories';
import { productsRouter } from './modules/products';
import { cashRegistersRouter } from './modules/cash-registers';
import { cashSessionsRouter } from './modules/cash-sessions';
import { ordersRouter } from './modules/orders';
import { staffRouter } from './modules/staff';
import { shiftsRouter } from './modules/shifts';
import { permissionsRouter } from './modules/permissions';
import { analyticsRouter } from './modules/analytics';
import { startAnalyticsSnapshotScheduler } from './modules/analytics/analytics.scheduler';
import superAdminRouter from './modules/super-admin/super-admin.router';

// Subscription middleware
import { checkSubscription, getSubscriptionStatus } from './middleware/subscription.middleware';
import { authMiddleware, requireMfa, requireMfaForAdminOps } from './middleware/auth.middleware';

// Note: Secrets are validated in bootstrap() via initializeSecrets()
// For 'env' provider, this happens synchronously; for cloud providers, it's async

// Create Express app
const app = express();

// Create HTTP server for Socket.io
const httpServer = createServer(app);

// Setup Socket.io with authentication
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Security settings
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ============================================
// FAST PATH - Skip middleware for health checks
// ============================================
app.get('/api/health/ping', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// ============================================
// SECURITY MIDDLEWARE (Order matters!)
// ============================================

// 1. Request ID for tracing (before logging)
app.use(requestId);

// 2. Security headers (Helmet.js + custom)
app.use(securityHeaders);
app.use(customSecurityHeaders);

// 3. Sanitize potentially dangerous headers
app.use(sanitizeHeaders);

// 4. CORS configuration
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Tenant-ID'],
  exposedHeaders: ['X-Request-ID', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  maxAge: 86400, // 24 hours preflight cache
}));

// 5. Body parsing with limits
app.use(express.json({
  limit: '10mb',
  strict: true, // Only accept arrays and objects
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 6. CSRF protection (after body parsing, before routes)
if (isCsrfEnabled()) {
  app.use(csrfMiddleware);
}

// 7. Standard rate limiting (all routes)
app.use(standardRateLimiter);

// 8. Audit logging
app.use(auditMiddleware);

// 9. Request logging in development
if (config.isDev) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(
        `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`
      );
    });
    next();
  });
}

// API Routes - Public (no subscription check)
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);

// CSRF token endpoint (public, needed before authenticated requests)
app.get('/api/auth/csrf-token', csrfTokenEndpoint);

// Super Admin Routes (separate from tenant routes)
app.use('/api/super-admin', superAdminRouter);

// License/Subscription check endpoint for desktop app
app.get('/api/license/status', authMiddleware, async (req: any, res): Promise<void> => {
  const status = await getSubscriptionStatus(req.tenantId);
  if (!status) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  res.json({ success: true, data: status });
});

// API Routes - Protected (require auth + active subscription)
// Standard routes - auth + subscription
app.use('/api/venues', authMiddleware, checkSubscription, venuesRouter);
app.use('/api/categories', authMiddleware, checkSubscription, categoriesRouter);
app.use('/api/products', authMiddleware, checkSubscription, productsRouter);
app.use('/api/cash-registers', authMiddleware, checkSubscription, cashRegistersRouter);
app.use('/api/cash-sessions', authMiddleware, checkSubscription, cashSessionsRouter);
app.use('/api/orders', authMiddleware, checkSubscription, ordersRouter);
app.use('/api/staff', authMiddleware, checkSubscription, staffRouter);
app.use('/api/shifts', authMiddleware, checkSubscription, shiftsRouter);

// Admin routes - require MFA for OWNER/ADMIN roles
app.use('/api/users', authMiddleware, requireMfa, checkSubscription, usersRouter);
app.use('/api/analytics', authMiddleware, requireMfa, checkSubscription, analyticsRouter);

// Sensitive admin routes - always require MFA verification
app.use('/api/permissions', authMiddleware, requireMfaForAdminOps, checkSubscription, permissionsRouter);

// Track enabled features for root route
const enabledFeatures: Record<string, string> = {};

// Root route
app.get('/', (_req, res) => {
  const endpoints: Record<string, string> = {
    health: '/api/health',
    auth: '/api/auth',
    license: '/api/license/status',
    superAdmin: '/api/super-admin',
    venues: '/api/venues',
    users: '/api/users',
    categories: '/api/categories',
    products: '/api/products',
    cashRegisters: '/api/cash-registers',
    cashSessions: '/api/cash-sessions',
    orders: '/api/orders',
    staff: '/api/staff',
    shifts: '/api/shifts',
    permissions: '/api/permissions',
    analytics: '/api/analytics',
    ...enabledFeatures,
  };

  res.json({
    name: 'Clubio API',
    version: '0.1.0',
    status: 'running',
    endpoints,
  });
});

// ============================================
// SOCKET.IO SECURITY
// ============================================
setupSecureSocketHandlers(io, prisma);

// Analytics real-time events
analyticsEvents.on('action:created', (action) => {
  if (action.status !== 'PENDING') return;
  const barId = typeof action.metadata?.bar_id === 'string' ? (action.metadata.bar_id as string) : undefined;
  if (barId) {
    emitToCashRegister(io, barId, 'analytics:action:created', action);
  }
  if (action.assignedRole) {
    emitToRole(io, action.venueId, [action.assignedRole], 'analytics:action:created', action);
    return;
  }
  emitToVenue(io, action.venueId, 'analytics:action:created', action);
});

analyticsEvents.on('action:resolved', (action) => {
  const barId = typeof action.metadata?.bar_id === 'string' ? (action.metadata.bar_id as string) : undefined;
  if (barId) {
    emitToCashRegister(io, barId, 'analytics:action:resolved', {
      id: action.id,
      venueId: action.venueId,
      status: action.status,
    });
  }
  emitToVenue(io, action.venueId, 'analytics:action:resolved', {
    id: action.id,
    venueId: action.venueId,
    status: action.status,
  });
});

// Export io for use in other modules
export { io };

// Bootstrap function for async initialization
async function bootstrap() {
  // Initialize secrets from configured provider (AWS, GCP, or env)
  // This loads secrets into config before they're used
  await initializeSecrets();

  if (config.features.analyticsSnapshots) {
    startAnalyticsSnapshotScheduler();
    enabledFeatures.analyticsSnapshots = '/api/analytics';
  }

  // Conditionally load Queue Engine module
  if (config.features.queueEngine) {
    // @ts-ignore - Dynamic import for optional module
    const { queueEngineRouter } = await import('./modules/queue-engine/index');
    app.use('/api/queue-engine', queueEngineRouter);
    enabledFeatures.queueEngine = '/api/queue-engine';
    console.log('✓ Queue Engine module loaded');
  }

  // Conditionally load Stock Alerts module
  if (config.features.stockAlerts) {
    // @ts-ignore - Dynamic import for optional module
    const { stockAlertsRouter, notificationRouter } = await import('./modules/stock-alerts/index');
    app.use('/api/stock-alerts', stockAlertsRouter);
    enabledFeatures.stockAlerts = '/api/stock-alerts';

    // Connect WebSocket for real-time notifications
    notificationRouter.on('ws:send', (data: { type: string; payload: unknown; recipientId: string }) => {
      io.to(`user:${data.recipientId}`).emit(data.type, data.payload);
    });

    console.log('✓ Stock Alerts module loaded');
  }

  // Re-register error handlers after dynamic routes
  app.use(notFoundHandler);

  // CSRF error handler (before general error handler)
  if (isCsrfEnabled()) {
    app.use(csrfErrorHandler);
  }

  app.use(errorHandler);
}

// Start server
const PORT = config.port;

bootstrap().then(() => {
  httpServer.listen(PORT, () => {
    const queueEngineStatus = config.features.queueEngine
      ? '║      • /api/queue-engine   - Festival queue optimization      ║'
      : '║      (Queue Engine disabled - set FEATURE_QUEUE_ENGINE=true)  ║';

    const stockAlertsStatus = config.features.stockAlerts
      ? '║      • /api/stock-alerts   - AI Stock monitoring agent        ║'
      : '║      (Stock Alerts disabled - set FEATURE_STOCK_ALERTS=true)  ║';

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ██████╗██╗     ██╗   ██╗██████╗ ██╗ ██████╗               ║
║    ██╔════╝██║     ██║   ██║██╔══██╗██║██╔═══██╗              ║
║    ██║     ██║     ██║   ██║██████╔╝██║██║   ██║              ║
║    ██║     ██║     ██║   ██║██╔══██╗██║██║   ██║              ║
║    ╚██████╗███████╗╚██████╔╝██████╔╝██║╚██████╔╝              ║
║     ╚═════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝               ║
║                                                               ║
║   🚀 Server running on http://localhost:${PORT}                  ║
║   📊 Environment: ${config.nodeEnv.padEnd(12)}                          ║
║   🔌 Socket.io enabled                                        ║
║                                                               ║
║   📦 Endpoints:                                               ║
║      • /api/health         - Health checks                    ║
║      • /api/auth           - Authentication                   ║
║      • /api/venues         - Venue management                 ║
║      • /api/users          - User management                  ║
║      • /api/categories     - Category management              ║
║      • /api/products       - Product management               ║
║      • /api/cash-registers - Cash register management         ║
║      • /api/cash-sessions  - Cash session management          ║
║      • /api/orders         - Order management                 ║
║      • /api/staff          - Staff management                 ║
║      • /api/shifts         - Shift scheduling                 ║
${queueEngineStatus}
${stockAlertsStatus}
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
