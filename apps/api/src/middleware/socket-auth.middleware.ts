import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// ============================================
// SOCKET.IO AUTHENTICATION MIDDLEWARE
// ============================================
// Secure WebSocket connections with JWT validation
// Aligned with: CIS Control 6.1, OWASP API2

interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    tenantId: string;
    email: string;
    role: string;
  };
  authorizedVenues?: Set<string>;
}

// Track authenticated sockets for rate limiting
const socketRateLimits = new Map<string, { count: number; resetTime: number }>();

/**
 * Validate JWT token from socket handshake
 */
export function socketAuthMiddleware(socket: AuthenticatedSocket, next: (err?: Error) => void): void {
  try {
    const token = socket.handshake.auth?.token ||
                  socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      console.warn(`[Socket Auth] Connection rejected - No token provided from ${socket.handshake.address}`);
      return next(new Error('Authentication required'));
    }

    // Verify JWT
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Attach user info to socket
    socket.user = {
      id: decoded.userId,
      tenantId: decoded.tenantId,
      email: decoded.email,
      role: decoded.role,
    };

    // Initialize authorized venues set
    socket.authorizedVenues = new Set();

    console.log(`[Socket Auth] Authenticated: ${decoded.email} (${decoded.role})`);
    next();

  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.warn(`[Socket Auth] Connection rejected - Token expired from ${socket.handshake.address}`);
      return next(new Error('Token expired'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      console.warn(`[Socket Auth] Connection rejected - Invalid token from ${socket.handshake.address}`);
      return next(new Error('Invalid token'));
    }
    console.error(`[Socket Auth] Connection rejected - Error:`, error);
    return next(new Error('Authentication failed'));
  }
}

/**
 * Check if user can join a venue room
 */
export async function canJoinVenueRoom(
  socket: AuthenticatedSocket,
  venueId: string,
  prisma: any // Pass Prisma client
): Promise<boolean> {
  if (!socket.user) return false;

  // Admins and owners can join any venue in their tenant
  if (['OWNER', 'ADMIN'].includes(socket.user.role)) {
    // Verify venue belongs to user's tenant
    const venue = await prisma.venue.findFirst({
      where: {
        id: venueId,
        tenantId: socket.user.tenantId,
      },
    });
    return !!venue;
  }

  // Other roles: check if user has explicit venue access
  const userVenue = await prisma.userVenue.findFirst({
    where: {
      userId: socket.user.id,
      venueId,
      isActive: true,
    },
  });

  return !!userVenue;
}

/**
 * Rate limit socket events
 */
export function checkSocketRateLimit(socketId: string, eventName: string): boolean {
  const key = `${socketId}:${eventName}`;
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxEvents = 60; // 60 events per minute

  const existing = socketRateLimits.get(key);

  if (existing && existing.resetTime > now) {
    existing.count++;
    if (existing.count > maxEvents) {
      console.warn(`[Socket RateLimit] Exceeded for ${socketId} on ${eventName}`);
      return false;
    }
    return true;
  }

  socketRateLimits.set(key, {
    count: 1,
    resetTime: now + windowMs,
  });

  return true;
}

/**
 * Clean up rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of socketRateLimits) {
    if (value.resetTime < now) {
      socketRateLimits.delete(key);
    }
  }
}, 60000);

/**
 * Setup authenticated socket event handlers
 */
export function setupSecureSocketHandlers(
  io: any, // Socket.io server
  prisma: any // Prisma client
): void {
  io.use(socketAuthMiddleware);

  io.on('connection', (socket: AuthenticatedSocket) => {
    if (!socket.user) {
      socket.disconnect();
      return;
    }

    console.log(`[Socket] User connected: ${socket.user.email}`);

    // Join user-specific room automatically
    socket.join(`user:${socket.user.id}`);

    // Handle venue room join with authorization
    socket.on('join:venue', async (venueId: string) => {
      if (!checkSocketRateLimit(socket.id, 'join:venue')) {
        socket.emit('error', { message: 'Too many requests' });
        return;
      }

      const canJoin = await canJoinVenueRoom(socket, venueId, prisma);

      if (canJoin) {
        socket.join(`venue:${venueId}`);
        socket.authorizedVenues?.add(venueId);
        console.log(`[Socket] ${socket.user?.email} joined venue:${venueId}`);
        socket.emit('venue:joined', { venueId });
      } else {
        console.warn(`[Socket] Unauthorized venue access attempt: ${socket.user?.email} -> ${venueId}`);
        socket.emit('error', { message: 'No autorizado para este venue' });
      }
    });

    // Handle venue room leave
    socket.on('leave:venue', (venueId: string) => {
      socket.leave(`venue:${venueId}`);
      socket.authorizedVenues?.delete(venueId);
      console.log(`[Socket] ${socket.user?.email} left venue:${venueId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${socket.user?.email}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`[Socket] Error for ${socket.user?.email}:`, error);
    });
  });
}

/**
 * Emit event only to authorized venue members
 */
export function emitToVenue(io: any, venueId: string, event: string, data: any): void {
  io.to(`venue:${venueId}`).emit(event, data);
}

/**
 * Emit event to specific user
 */
export function emitToUser(io: any, userId: string, event: string, data: any): void {
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Broadcast to all sockets with a specific role
 */
export function emitToRole(io: any, venueId: string, roles: string[], event: string, data: any): void {
  const room = io.sockets.adapter.rooms.get(`venue:${venueId}`);

  if (room) {
    for (const socketId of room) {
      const socket = io.sockets.sockets.get(socketId) as AuthenticatedSocket;
      if (socket?.user && roles.includes(socket.user.role)) {
        socket.emit(event, data);
      }
    }
  }
}

export default {
  socketAuthMiddleware,
  canJoinVenueRoom,
  checkSocketRateLimit,
  setupSecureSocketHandlers,
  emitToVenue,
  emitToUser,
  emitToRole,
};
