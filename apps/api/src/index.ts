import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { config, validateConfig } from './config';
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
  authRateLimiter,
  pinRateLimiter,
  registrationRateLimiter,
} from './middleware/rate-limit.middleware';
import { auditMiddleware } from './middleware/audit.middleware';
import { socketAuthMiddleware } from './middleware/socket-auth.middleware';

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

// Validate environment variables
validateConfig();

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

// 6. Standard rate limiting (all routes)
app.use(standardRateLimiter);

// 7. Audit logging
app.use(auditMiddleware);

// 8. Request logging in development
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

// API Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/venues', venuesRouter);
app.use('/api/users', usersRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/cash-registers', cashRegistersRouter);
app.use('/api/cash-sessions', cashSessionsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/staff', staffRouter);
app.use('/api/shifts', shiftsRouter);

// Track enabled features for root route
const enabledFeatures: Record<string, string> = {};

// Root route
app.get('/', (_req, res) => {
  const endpoints: Record<string, string> = {
    health: '/api/health',
    auth: '/api/auth',
    venues: '/api/venues',
    users: '/api/users',
    categories: '/api/categories',
    products: '/api/products',
    cashRegisters: '/api/cash-registers',
    cashSessions: '/api/cash-sessions',
    orders: '/api/orders',
    staff: '/api/staff',
    shifts: '/api/shifts',
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
// Apply JWT authentication to all socket connections
io.use(socketAuthMiddleware);

// Socket.io connection handling (authenticated)
io.on('connection', (socket: any) => {
  // socket.user is set by socketAuthMiddleware
  const userEmail = socket.user?.email || 'unknown';
  const userId = socket.user?.id;

  console.log(`[Socket] Authenticated connection: ${userEmail}`);

  // Auto-join user's personal room for direct notifications
  if (userId) {
    socket.join(`user:${userId}`);
  }

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${userEmail}`);
  });

  // Join venue room (with authorization check)
  socket.on('join:venue', async (venueId: string) => {
    // TODO: Add venue authorization check here
    // For now, allow if user is authenticated
    if (socket.user) {
      socket.join(`venue:${venueId}`);
      console.log(`[Socket] ${userEmail} joined venue:${venueId}`);
      socket.emit('venue:joined', { venueId });
    } else {
      socket.emit('error', { message: 'Not authorized' });
    }
  });

  // Leave venue room
  socket.on('leave:venue', (venueId: string) => {
    socket.leave(`venue:${venueId}`);
    console.log(`[Socket] ${userEmail} left venue:${venueId}`);
  });

  // Join user room (for stock alert notifications) - already auto-joined above
  socket.on('join:user', (targetUserId: string) => {
    // Only allow joining own user room
    if (targetUserId === userId) {
      socket.join(`user:${targetUserId}`);
      console.log(`[Socket] ${userEmail} joined user:${targetUserId}`);
    } else {
      socket.emit('error', { message: 'Cannot join other user rooms' });
    }
  });

  // Leave user room
  socket.on('leave:user', (targetUserId: string) => {
    socket.leave(`user:${targetUserId}`);
    console.log(`Socket ${socket.id} left user:${userId}`);
  });
});

// Export io for use in other modules
export { io };

// Bootstrap function for async initialization
async function bootstrap() {
  // Conditionally load Queue Engine module
  if (config.features.queueEngine) {
    const { queueEngineRouter } = await import('./modules/queue-engine/index.js');
    app.use('/api/queue-engine', queueEngineRouter);
    enabledFeatures.queueEngine = '/api/queue-engine';
    console.log('✓ Queue Engine module loaded');
  }

  // Conditionally load Stock Alerts module
  if (config.features.stockAlerts) {
    const { stockAlertsRouter, notificationRouter } = await import('./modules/stock-alerts/index.js');
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