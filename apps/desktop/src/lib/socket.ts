import { io, Socket } from 'socket.io-client';
import { getStoredToken } from './api';

// ============================================
// Configuration
// ============================================

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

// ============================================
// Socket Events Types
// ============================================

export interface ServerToClientEvents {
  // Cash session events
  'cash-session:opened': (data: { sessionId: string; cashRegisterId: string; userId: string }) => void;
  'cash-session:closed': (data: { sessionId: string; cashRegisterId: string }) => void;
  'cash-session:movement': (data: { sessionId: string; type: 'IN' | 'OUT'; amount: number }) => void;

  // Order events
  'order:created': (data: { orderId: string; orderNumber: number; total: number }) => void;
  'order:voided': (data: { orderId: string }) => void;

  // Product events
  'product:updated': (data: { productId: string }) => void;
  'product:deleted': (data: { productId: string }) => void;

  // Category events
  'category:updated': (data: { categoryId: string }) => void;
  'category:deleted': (data: { categoryId: string }) => void;

  // Connection events
  'connect': () => void;
  'disconnect': (reason: string) => void;
  'connect_error': (error: Error) => void;
}

export interface ClientToServerEvents {
  // Join rooms
  'join:venue': (venueId: string) => void;
  'leave:venue': (venueId: string) => void;
  'join:cash-register': (cashRegisterId: string) => void;
  'leave:cash-register': (cashRegisterId: string) => void;
}

// ============================================
// Socket Manager Class
// ============================================

type EventCallback = (...args: any[]) => void;

class SocketManager {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private eventHandlers: Map<string, Set<EventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private currentVenueId: string | null = null;
  private currentCashRegisterId: string | null = null;

  /**
   * Connect to the Socket.io server
   */
  connect(): void {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    const token = getStoredToken();

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.setupEventListeners();
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentVenueId = null;
    this.currentCashRegisterId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Join a venue room
   */
  joinVenue(venueId: string): void {
    if (!this.socket?.connected) return;

    // Leave previous venue if different
    if (this.currentVenueId && this.currentVenueId !== venueId) {
      this.socket.emit('leave:venue', this.currentVenueId);
    }

    this.socket.emit('join:venue', venueId);
    this.currentVenueId = venueId;
  }

  /**
   * Leave the current venue room
   */
  leaveVenue(): void {
    if (!this.socket?.connected || !this.currentVenueId) return;

    this.socket.emit('leave:venue', this.currentVenueId);
    this.currentVenueId = null;
  }

  /**
   * Join a cash register room
   */
  joinCashRegister(cashRegisterId: string): void {
    if (!this.socket?.connected) return;

    // Leave previous cash register if different
    if (this.currentCashRegisterId && this.currentCashRegisterId !== cashRegisterId) {
      this.socket.emit('leave:cash-register', this.currentCashRegisterId);
    }

    this.socket.emit('join:cash-register', cashRegisterId);
    this.currentCashRegisterId = cashRegisterId;
  }

  /**
   * Leave the current cash register room
   */
  leaveCashRegister(): void {
    if (!this.socket?.connected || !this.currentCashRegisterId) return;

    this.socket.emit('leave:cash-register', this.currentCashRegisterId);
    this.currentCashRegisterId = null;
  }

  /**
   * Subscribe to an event
   */
  on<K extends keyof ServerToClientEvents>(
    event: K,
    callback: ServerToClientEvents[K]
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(callback as EventCallback);

    // Also attach to socket if connected
    if (this.socket) {
      this.socket.on(event, callback as any);
    }

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof ServerToClientEvents>(
    event: K,
    callback: ServerToClientEvents[K]
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(callback as EventCallback);
    }

    if (this.socket) {
      this.socket.off(event, callback as any);
    }
  }

  /**
   * Setup internal event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.reconnectAttempts = 0;

      // Rejoin rooms after reconnection
      if (this.currentVenueId) {
        this.socket?.emit('join:venue', this.currentVenueId);
      }
      if (this.currentCashRegisterId) {
        this.socket?.emit('join:cash-register', this.currentCashRegisterId);
      }

      // Notify external handlers
      this.notifyHandlers('connect');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.notifyHandlers('disconnect', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
      this.notifyHandlers('connect_error', error);
    });

    // Re-attach all registered event handlers
    this.eventHandlers.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        this.socket?.on(event as any, handler as any);
      });
    });
  }

  /**
   * Notify registered handlers for an event
   */
  private notifyHandlers(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
    }
  }
}

// ============================================
// Export Singleton Instance
// ============================================

export const socketManager = new SocketManager();
