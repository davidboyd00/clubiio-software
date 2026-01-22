import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { config, validateConfig } from './config';
import { notFoundHandler, errorHandler } from './middleware/error.middleware';

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

// Validate environment variables
validateConfig();

// Create Express app
const app = express();

// Create HTTP server for Socket.io
const httpServer = createServer(app);

// Setup Socket.io
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '10mb' })); // Increased for bulk imports
app.use(express.urlencoded({ extended: true }));

// Request logging in development
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

// Root route
app.get('/', (_req, res) => {
  res.json({
    name: 'Clubio API',
    version: '0.1.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      venues: '/api/venues',
      users: '/api/users',
      categories: '/api/categories',
      products: '/api/products',
      cashRegisters: '/api/cash-registers',
      cashSessions: '/api/cash-sessions',
      orders: '/api/orders',
    },
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
  
  // Join venue room
  socket.on('join:venue', (venueId: string) => {
    socket.join(`venue:${venueId}`);
    console.log(`Socket ${socket.id} joined venue:${venueId}`);
  });
  
  // Leave venue room
  socket.on('leave:venue', (venueId: string) => {
    socket.leave(`venue:${venueId}`);
    console.log(`Socket ${socket.id} left venue:${venueId}`);
  });
});

// Export io for use in other modules
export { io };

// Start server
const PORT = config.port;

httpServer.listen(PORT, () => {
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
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
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