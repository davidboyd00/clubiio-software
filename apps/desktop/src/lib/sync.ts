import { localDb } from './db';
import { productsApi, categoriesApi, ordersApi } from './api';

// ============================================
// Types
// ============================================

type SyncStatus = 'idle' | 'syncing' | 'error';
type SyncEventType = 'status' | 'progress' | 'complete' | 'error';
type SyncListener = (event: SyncEventType, data?: any) => void;

interface SyncState {
  status: SyncStatus;
  lastSyncAt: Date | null;
  pendingCount: number;
  error: string | null;
}

// ============================================
// Sync Service Class
// ============================================

class SyncService {
  private state: SyncState = {
    status: 'idle',
    lastSyncAt: null,
    pendingCount: 0,
    error: null,
  };

  private listeners: Set<SyncListener> = new Set();
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isOnline = navigator.onLine;

  constructor() {
    // Listen to online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  // ============================================
  // State Management
  // ============================================

  getState(): SyncState {
    return { ...this.state };
  }

  private setState(updates: Partial<SyncState>): void {
    this.state = { ...this.state, ...updates };
    this.notify('status', this.state);
  }

  // ============================================
  // Event Listeners
  // ============================================

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(event: SyncEventType, data?: any): void {
    this.listeners.forEach((listener) => listener(event, data));
  }

  // ============================================
  // Online/Offline Handling
  // ============================================

  private handleOnline(): void {
    console.log('App is online');
    this.isOnline = true;
    // Trigger sync when coming back online
    this.syncPendingData();
  }

  private handleOffline(): void {
    console.log('App is offline');
    this.isOnline = false;
  }

  checkOnlineStatus(): boolean {
    return this.isOnline && navigator.onLine;
  }

  // ============================================
  // Auto Sync
  // ============================================

  startAutoSync(intervalMs: number = 30000): void {
    this.stopAutoSync();
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.syncPendingData();
      }
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // ============================================
  // Download Data (Server -> Local)
  // ============================================

  async downloadProducts(): Promise<boolean> {
    if (!this.isOnline) return false;

    try {
      const response = await productsApi.getAll();
      if (response.data.success && response.data.data) {
        await localDb.cacheProducts(response.data.data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to download products:', error);
      return false;
    }
  }

  async downloadCategories(): Promise<boolean> {
    if (!this.isOnline) return false;

    try {
      const response = await categoriesApi.getAll();
      if (response.data.success && response.data.data) {
        await localDb.cacheCategories(response.data.data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to download categories:', error);
      return false;
    }
  }

  async downloadAllData(): Promise<boolean> {
    if (!this.isOnline) return false;

    this.setState({ status: 'syncing' });
    this.notify('progress', { step: 'downloading', progress: 0 });

    try {
      // Download categories
      this.notify('progress', { step: 'categories', progress: 25 });
      await this.downloadCategories();

      // Download products
      this.notify('progress', { step: 'products', progress: 75 });
      await this.downloadProducts();

      this.notify('progress', { step: 'complete', progress: 100 });
      this.setState({
        status: 'idle',
        lastSyncAt: new Date(),
        error: null,
      });
      this.notify('complete', { type: 'download' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Download failed';
      this.setState({ status: 'error', error: message });
      this.notify('error', { message });
      return false;
    }
  }

  // ============================================
  // Upload Data (Local -> Server)
  // ============================================

  async syncPendingOrders(): Promise<number> {
    if (!this.isOnline) return 0;

    const pendingOrders = await localDb.getUnsyncedOrders();
    let syncedCount = 0;

    for (const localOrder of pendingOrders) {
      try {
        const items = JSON.parse(localOrder.items);
        const payments = JSON.parse(localOrder.payments);

        // Create order on server
        const response = await ordersApi.create({
          cashSessionId: localOrder.cash_session_id!,
          items,
          payments,
          discount: localOrder.discount,
        });

        if (response.data.success) {
          await localDb.markOrderSynced(localOrder.id);
          syncedCount++;
        }
      } catch (error) {
        console.error(`Failed to sync order ${localOrder.id}:`, error);
      }
    }

    return syncedCount;
  }

  async syncPendingItems(): Promise<number> {
    if (!this.isOnline) return 0;

    const pendingItems = await localDb.getPendingSyncItems();
    let syncedCount = 0;

    for (const item of pendingItems) {
      try {
        const payload = JSON.parse(item.payload);
        let success = false;

        // Handle different entity types
        switch (item.entity) {
          case 'order':
            if (item.action === 'create') {
              const response = await ordersApi.create(payload);
              success = response.data.success;
            }
            break;
          // Add more entity types as needed
        }

        if (success) {
          await localDb.markSyncItemCompleted(item.id);
          syncedCount++;
        }
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
      }
    }

    return syncedCount;
  }

  async syncPendingData(): Promise<void> {
    if (!this.isOnline || this.state.status === 'syncing') return;

    this.setState({ status: 'syncing' });

    try {
      // Sync pending orders
      const ordersSynced = await this.syncPendingOrders();

      // Sync other pending items
      const itemsSynced = await this.syncPendingItems();

      // Update pending count
      const pendingOrders = await localDb.getUnsyncedOrders();
      const pendingItems = await localDb.getPendingSyncItems();

      this.setState({
        status: 'idle',
        lastSyncAt: new Date(),
        pendingCount: pendingOrders.length + pendingItems.length,
        error: null,
      });

      if (ordersSynced > 0 || itemsSynced > 0) {
        this.notify('complete', {
          type: 'upload',
          ordersSynced,
          itemsSynced,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      this.setState({ status: 'error', error: message });
      this.notify('error', { message });
    }
  }

  // ============================================
  // Full Sync
  // ============================================

  async fullSync(): Promise<boolean> {
    if (!this.isOnline) return false;

    this.setState({ status: 'syncing' });

    try {
      // First upload pending data
      await this.syncPendingData();

      // Then download fresh data
      await this.downloadAllData();

      // Clean up completed sync items
      await localDb.clearCompletedSyncItems();

      this.setState({
        status: 'idle',
        lastSyncAt: new Date(),
        error: null,
      });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Full sync failed';
      this.setState({ status: 'error', error: message });
      return false;
    }
  }

  // ============================================
  // Pending Count
  // ============================================

  async updatePendingCount(): Promise<number> {
    const pendingOrders = await localDb.getUnsyncedOrders();
    const pendingItems = await localDb.getPendingSyncItems();
    const count = pendingOrders.length + pendingItems.length;
    this.setState({ pendingCount: count });
    return count;
  }
}

// ============================================
// Export Singleton Instance
// ============================================

export const syncService = new SyncService();
