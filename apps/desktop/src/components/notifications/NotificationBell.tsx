import { Bell, X, AlertTriangle, Package, Info, CheckCircle } from 'lucide-react';
import { useNotificationStore, Notification } from '../../stores/notificationStore';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export function NotificationBell() {
  const { unreadCount, showPanel, togglePanel, setShowPanel } =
    useNotificationStore();

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={togglePanel}
        className="relative p-2 hover:bg-slate-700 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {showPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPanel(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-96 max-h-[70vh] bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
            <NotificationPanel />
          </div>
        </>
      )}
    </div>
  );
}

function NotificationPanel() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  } = useNotificationStore();

  return (
    <div className="flex flex-col max-h-[70vh]">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Notificaciones</h3>
          {unreadCount > 0 && (
            <p className="text-xs text-slate-400">{unreadCount} sin leer</p>
          )}
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Marcar todas leídas
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-slate-400 hover:text-slate-300"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Sin notificaciones</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={() => markAsRead(notification.id)}
                onRemove={() => removeNotification(notification.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationItem({
  notification,
  onMarkRead,
  onRemove,
}: {
  notification: Notification;
  onMarkRead: () => void;
  onRemove: () => void;
}) {
  const getIcon = () => {
    switch (notification.type) {
      case 'stock_alert':
        return <Package className="w-5 h-5 text-amber-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      default:
        return <Info className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getBgColor = () => {
    if (notification.read) return '';

    switch (notification.type) {
      case 'stock_alert':
        return 'bg-amber-600/10';
      case 'error':
        return 'bg-red-600/10';
      case 'success':
        return 'bg-green-600/10';
      default:
        return 'bg-indigo-600/10';
    }
  };

  const timeAgo = formatDistanceToNow(new Date(notification.timestamp), {
    addSuffix: true,
    locale: es,
  });

  return (
    <div
      className={`p-4 hover:bg-slate-700/50 transition-colors ${getBgColor()} ${
        !notification.read ? 'border-l-2 border-indigo-500' : ''
      }`}
      onClick={onMarkRead}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`font-medium ${notification.read ? 'text-slate-400' : 'text-white'}`}>
              {notification.title}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="text-slate-500 hover:text-slate-300 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-slate-400 mt-1">{notification.message}</p>
          <p className="text-xs text-slate-500 mt-2">{timeAgo}</p>
          {notification.action && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                notification.action?.handler();
              }}
              className="mt-2 text-sm text-indigo-400 hover:text-indigo-300"
            >
              {notification.action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
