import type { Category, Product } from './api';

// ============================================
// Types
// ============================================

interface DbResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface SyncQueueItem {
  id: number;
  action: string;
  entity: string;
  payload: string;
  created_at: string;
  synced: number;
}

interface SessionInfo {
  user_id: string;
  tenant_id: string;
  venue_id: string | null;
  cash_session_id: string | null;
  cash_register_id: string | null;
  access_token: string;
}

interface CachedProduct {
  id: string;
  category_id: string | null;
  name: string;
  short_name: string | null;
  price: number;
  is_alcoholic: number;
  barcode: string | null;
}

interface CachedCategory {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
}

interface LocalOrder {
  id: string;
  cash_session_id: string | null;
  order_number: number;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  items: string;
  payments: string;
  created_at: string;
  synced: number;
}

// ============================================
// Database Helper Class
// ============================================

class LocalDatabase {
  /**
   * Check if database is available (Electron app with SQLite)
   */
  isAvailable(): boolean {
    return !!window.electronAPI?.db;
  }

  /**
   * Execute a SQL query
   */
  private async execute<T = any>(sql: string, params: any[] = []): Promise<DbResult<T>> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Database not available' };
    }
    return window.electronAPI!.db.execute(sql, params);
  }

  /**
   * Get a single row
   */
  private async get<T = any>(sql: string, params: any[] = []): Promise<DbResult<T>> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Database not available' };
    }
    return window.electronAPI!.db.get(sql, params);
  }

  /**
   * Get all rows
   */
  private async all<T = any>(sql: string, params: any[] = []): Promise<DbResult<T[]>> {
    if (!this.isAvailable()) {
      return { success: false, error: 'Database not available' };
    }
    return window.electronAPI!.db.all(sql, params);
  }

  // ============================================
  // Session Management
  // ============================================

  async saveSession(session: {
    userId: string;
    tenantId: string;
    venueId: string | null;
    cashSessionId?: string | null;
    cashRegisterId?: string | null;
    accessToken: string;
  }): Promise<boolean> {
    const result = await this.execute(
      `INSERT OR REPLACE INTO session_info
       (id, user_id, tenant_id, venue_id, cash_session_id, cash_register_id, access_token, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        session.userId,
        session.tenantId,
        session.venueId,
        session.cashSessionId || null,
        session.cashRegisterId || null,
        session.accessToken,
      ]
    );
    return result.success;
  }

  async getSession(): Promise<SessionInfo | null> {
    const result = await this.get<SessionInfo>(
      'SELECT * FROM session_info WHERE id = 1'
    );
    return result.success ? result.data || null : null;
  }

  async updateCashSession(cashSessionId: string | null, cashRegisterId: string | null): Promise<boolean> {
    const result = await this.execute(
      `UPDATE session_info SET cash_session_id = ?, cash_register_id = ?, updated_at = datetime('now') WHERE id = 1`,
      [cashSessionId, cashRegisterId]
    );
    return result.success;
  }

  async clearSession(): Promise<boolean> {
    const result = await this.execute('DELETE FROM session_info WHERE id = 1');
    return result.success;
  }

  // ============================================
  // Products Cache
  // ============================================

  async cacheProducts(products: Product[]): Promise<boolean> {
    // Clear existing cache
    await this.execute('DELETE FROM cached_products');

    for (const product of products) {
      await this.execute(
        `INSERT INTO cached_products (id, category_id, name, short_name, price, is_alcoholic, barcode, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          product.id,
          product.categoryId,
          product.name,
          product.shortName,
          product.price,
          product.isAlcoholic ? 1 : 0,
          product.barcode,
        ]
      );
    }
    return true;
  }

  async getCachedProducts(): Promise<Product[]> {
    const result = await this.all<CachedProduct>('SELECT * FROM cached_products ORDER BY name');
    if (!result.success || !result.data) return [];

    return result.data.map((p) => ({
      id: p.id,
      categoryId: p.category_id,
      name: p.name,
      shortName: p.short_name,
      price: p.price,
      isAlcoholic: p.is_alcoholic === 1,
      barcode: p.barcode,
    }));
  }

  async getCachedProductsByCategory(categoryId: string): Promise<Product[]> {
    const result = await this.all<CachedProduct>(
      'SELECT * FROM cached_products WHERE category_id = ? ORDER BY name',
      [categoryId]
    );
    if (!result.success || !result.data) return [];

    return result.data.map((p) => ({
      id: p.id,
      categoryId: p.category_id,
      name: p.name,
      shortName: p.short_name,
      price: p.price,
      isAlcoholic: p.is_alcoholic === 1,
      barcode: p.barcode,
    }));
  }

  // ============================================
  // Categories Cache
  // ============================================

  async cacheCategories(categories: Category[]): Promise<boolean> {
    await this.execute('DELETE FROM cached_categories');

    for (const category of categories) {
      await this.execute(
        `INSERT INTO cached_categories (id, name, color, icon, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [category.id, category.name, category.color, category.icon, category.sortOrder]
      );
    }
    return true;
  }

  async getCachedCategories(): Promise<Category[]> {
    const result = await this.all<CachedCategory>(
      'SELECT * FROM cached_categories ORDER BY sort_order, name'
    );
    if (!result.success || !result.data) return [];

    return result.data.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      sortOrder: c.sort_order,
    }));
  }

  // ============================================
  // Local Orders (Offline Mode)
  // ============================================

  async saveLocalOrder(order: {
    id: string;
    cashSessionId: string | null;
    orderNumber: number;
    status: string;
    subtotal: number;
    discount: number;
    total: number;
    items: any[];
    payments: any[];
  }): Promise<boolean> {
    const result = await this.execute(
      `INSERT INTO local_orders
       (id, cash_session_id, order_number, status, subtotal, discount, total, items, payments, created_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)`,
      [
        order.id,
        order.cashSessionId,
        order.orderNumber,
        order.status,
        order.subtotal,
        order.discount,
        order.total,
        JSON.stringify(order.items),
        JSON.stringify(order.payments),
      ]
    );
    return result.success;
  }

  async getUnsyncedOrders(): Promise<LocalOrder[]> {
    const result = await this.all<LocalOrder>(
      'SELECT * FROM local_orders WHERE synced = 0 ORDER BY created_at'
    );
    return result.success && result.data ? result.data : [];
  }

  async markOrderSynced(orderId: string): Promise<boolean> {
    const result = await this.execute(
      'UPDATE local_orders SET synced = 1 WHERE id = ?',
      [orderId]
    );
    return result.success;
  }

  async getNextOrderNumber(): Promise<number> {
    const result = await this.get<{ max_num: number | null }>(
      'SELECT MAX(order_number) as max_num FROM local_orders'
    );
    return (result.data?.max_num || 0) + 1;
  }

  // ============================================
  // Sync Queue
  // ============================================

  async addToSyncQueue(action: string, entity: string, payload: any): Promise<boolean> {
    const result = await this.execute(
      `INSERT INTO sync_queue (action, entity, payload, created_at, synced)
       VALUES (?, ?, ?, datetime('now'), 0)`,
      [action, entity, JSON.stringify(payload)]
    );
    return result.success;
  }

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    const result = await this.all<SyncQueueItem>(
      'SELECT * FROM sync_queue WHERE synced = 0 ORDER BY created_at'
    );
    return result.success && result.data ? result.data : [];
  }

  async markSyncItemCompleted(id: number): Promise<boolean> {
    const result = await this.execute(
      'UPDATE sync_queue SET synced = 1 WHERE id = ?',
      [id]
    );
    return result.success;
  }

  async clearCompletedSyncItems(): Promise<boolean> {
    const result = await this.execute(
      'DELETE FROM sync_queue WHERE synced = 1'
    );
    return result.success;
  }

  // ============================================
  // Settings
  // ============================================

  async setSetting(key: string, value: string): Promise<boolean> {
    const result = await this.execute(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value]
    );
    return result.success;
  }

  async getSetting(key: string): Promise<string | null> {
    const result = await this.get<{ key: string; value: string }>(
      'SELECT * FROM settings WHERE key = ?',
      [key]
    );
    return result.success && result.data ? result.data.value : null;
  }

  async deleteSetting(key: string): Promise<boolean> {
    const result = await this.execute(
      'DELETE FROM settings WHERE key = ?',
      [key]
    );
    return result.success;
  }

  // ============================================
  // Utilities
  // ============================================

  async clearAllCache(): Promise<void> {
    await this.execute('DELETE FROM cached_products');
    await this.execute('DELETE FROM cached_categories');
  }

  async clearAllData(): Promise<void> {
    await this.execute('DELETE FROM cached_products');
    await this.execute('DELETE FROM cached_categories');
    await this.execute('DELETE FROM local_orders');
    await this.execute('DELETE FROM sync_queue');
    await this.execute('DELETE FROM session_info');
    await this.execute('DELETE FROM settings');
  }
}

// ============================================
// Export Singleton Instance
// ============================================

export const localDb = new LocalDatabase();
