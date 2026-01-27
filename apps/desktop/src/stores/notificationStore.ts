// Notification Store for in-app alerts
import { create } from 'zustand';
import { StockAlert } from '../lib/stockMonitor';

export interface Notification {
  id: string;
  type: 'stock_alert' | 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: StockAlert | Record<string, unknown>;
  action?: {
    label: string;
    handler: () => void;
  };
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  showPanel: boolean;

  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  togglePanel: () => void;
  setShowPanel: (show: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  showPanel: false,

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep last 50
      unreadCount: state.unreadCount + 1,
    }));

    // Auto-remove after 30 seconds for non-stock alerts
    if (notification.type !== 'stock_alert') {
      setTimeout(() => {
        get().removeNotification(newNotification.id);
      }, 30000);
    }

    return newNotification;
  },

  markAsRead: (id) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      if (notification && !notification.read) {
        return {
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        };
      }
      return state;
    });
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  removeNotification: (id) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      const wasUnread = notification && !notification.read;

      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    });
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  togglePanel: () => {
    set((state) => ({ showPanel: !state.showPanel }));
  },

  setShowPanel: (show) => {
    set({ showPanel: show });
  },
}));

// Helper to add stock alert notification
export function notifyStockAlert(alert: StockAlert): void {
  const store = useNotificationStore.getState();

  const severityTitles = {
    out: 'Sin Stock',
    critical: 'Stock Crítico',
    low: 'Stock Bajo',
  };

  store.addNotification({
    type: 'stock_alert',
    title: `${severityTitles[alert.severity]}: ${alert.productName}`,
    message: alert.aiSuggestion || `${alert.currentStock}/${alert.minStock} unidades restantes`,
    data: alert,
  });
}

// Helper for general notifications
export function notify(
  type: Notification['type'],
  title: string,
  message: string
): void {
  useNotificationStore.getState().addNotification({ type, title, message });
}
