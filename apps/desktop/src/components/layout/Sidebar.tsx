import { useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  ArrowUpDown,
  Lock,
  LogOut,
  User,
  Monitor,
  ChevronLeft,
  ChevronRight,
  Receipt,
  BarChart3,
  Package,
  Settings,
  Users,
  Percent,
  Bell,
  UserCog,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { cashSessionId } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    {
      id: 'pos',
      label: 'Punto de Venta',
      icon: ShoppingCart,
      path: '/pos',
      requiresSession: true,
    },
    {
      id: 'history',
      label: 'Historial',
      icon: Receipt,
      path: '/history',
      requiresSession: true,
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      path: '/dashboard',
      requiresSession: true,
    },
    {
      id: 'movements',
      label: 'Movimientos',
      icon: ArrowUpDown,
      path: '/movements',
      requiresSession: true,
    },
    {
      id: 'products',
      label: 'Productos',
      icon: Package,
      path: '/products',
      requiresSession: true,
    },
    {
      id: 'customers',
      label: 'Clientes',
      icon: Users,
      path: '/customers',
      requiresSession: true,
    },
    {
      id: 'promotions',
      label: 'Promociones',
      icon: Percent,
      path: '/promotions',
      requiresSession: true,
    },
    {
      id: 'reports',
      label: 'Reportes',
      icon: BarChart3,
      path: '/reports',
      requiresSession: true,
    },
    {
      id: 'stock-alerts',
      label: 'Alertas Stock',
      icon: Bell,
      path: '/stock-alerts',
      requiresSession: true,
    },
    {
      id: 'staff',
      label: 'Personal',
      icon: UserCog,
      path: '/staff',
      requiresSession: true,
    },
    {
      id: 'permissions',
      label: 'Permisos',
      icon: Shield,
      path: '/permissions',
      requiresSession: true,
    },
    {
      id: 'ai',
      label: 'Asistente IA',
      icon: Sparkles,
      path: '/ai',
      requiresSession: true,
    },
    {
      id: 'settings',
      label: 'Configuración',
      icon: Settings,
      path: '/settings',
      requiresSession: false,
    },
    {
      id: 'close',
      label: 'Cerrar Caja',
      icon: Lock,
      path: '/close-cash',
      requiresSession: true,
      danger: true,
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div
      className={`
        h-full bg-slate-800 border-r border-slate-700
        flex flex-col transition-all duration-300
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-lg truncate">Clubio</h1>
              <p className="text-xs text-slate-400 truncate">Punto de Venta</p>
            </div>
          )}
        </div>
      </div>

      {/* Cash Register Info */}
      {cashSessionId && (
        <div className={`p-3 mx-3 mt-3 bg-green-600/20 border border-green-600/30 rounded-lg ${collapsed ? 'mx-2' : ''}`}>
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-green-400 flex-shrink-0" />
            {!collapsed && (
              <span className="text-sm text-green-400 truncate">Caja Activa</span>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const disabled = item.requiresSession && !cashSessionId;
          const active = isActive(item.path);

          return (
            <button
              key={item.id}
              onClick={() => !disabled && navigate(item.path)}
              disabled={disabled}
              className={`
                w-full flex items-center gap-3 px-3 py-3 rounded-xl
                transition-all duration-150
                ${collapsed ? 'justify-center' : ''}
                ${active
                  ? item.danger
                    ? 'bg-red-600/20 text-red-400'
                    : 'bg-indigo-600/20 text-indigo-400'
                  : disabled
                  ? 'text-slate-600 cursor-not-allowed'
                  : item.danger
                  ? 'text-slate-400 hover:bg-red-600/10 hover:text-red-400'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                }
              `}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? '' : ''}`} />
              {!collapsed && (
                <span className="font-medium truncate">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Toggle Button */}
      {onToggle && (
        <button
          onClick={onToggle}
          className="p-3 mx-3 mb-2 flex items-center justify-center gap-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Colapsar</span>
            </>
          )}
        </button>
      )}

      {/* User Info */}
      <div className="p-3 border-t border-slate-700">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-slate-400" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`
              p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700
              rounded-lg transition-colors flex-shrink-0
              ${collapsed ? 'hidden' : ''}
            `}
            title="Cerrar sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
