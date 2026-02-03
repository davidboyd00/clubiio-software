import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Clock,
  RefreshCw,
  Loader2,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCashSession } from '../hooks/useCashSession';
import { HourlySalesChart, TopProducts, PaymentMethodsChart } from '../components/dashboard';
import { Order } from '../lib/api';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, cashSessionId } = useAuth();
  const { currentSession, sessionSummary, isLoading, refreshSummary } = useCashSession();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redirect if no active session
  useEffect(() => {
    if (!cashSessionId && !isLoading) {
      navigate('/open-cash');
    }
  }, [cashSessionId, isLoading, navigate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshSummary();
    setIsRefreshing(false);
  };

  // Get orders from session summary
  const orders: Order[] = useMemo(() => {
    return ((sessionSummary?.session as any)?.orders || []).filter(
      (o: Order) => o.status === 'COMPLETED'
    );
  }, [sessionSummary]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalSales = sessionSummary?.summary?.totalSales || 0;
    const totalOrders = sessionSummary?.summary?.totalOrders || 0;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Session duration
    const openedAt = currentSession?.openedAt ? new Date(currentSession.openedAt) : new Date();
    const durationMinutes = differenceInMinutes(new Date(), openedAt);
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    const duration = `${hours}h ${minutes}m`;

    return { totalSales, totalOrders, avgTicket, duration };
  }, [sessionSummary, currentSession]);

  // Calculate hourly sales
  const hourlySales = useMemo(() => {
    const hourlyMap = new Map<number, number>();

    // Initialize all hours from session start to now
    const startHour = currentSession?.openedAt
      ? new Date(currentSession.openedAt).getHours()
      : new Date().getHours();
    const currentHour = new Date().getHours();

    for (let h = startHour; h <= currentHour; h++) {
      hourlyMap.set(h, 0);
    }

    // Sum up orders by hour
    orders.forEach((order) => {
      const hour = new Date(order.createdAt).getHours();
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + Number(order.total));
    });

    return Array.from(hourlyMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([hour, sales]) => ({ hour, sales }));
  }, [orders, currentSession]);

  // Calculate top products
  const topProducts = useMemo(() => {
    const productMap = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();

    orders.forEach((order) => {
      order.items?.forEach((item: any) => {
        const id = item.productId;
        const existing = productMap.get(id) || {
          id,
          name: item.product?.name || 'Producto',
          quantity: 0,
          revenue: 0,
        };
        existing.quantity += item.quantity;
        // Use subtotal (from DB) or total (from frontend type) - handle both
        existing.revenue += Number(item.subtotal || item.total || 0);
        productMap.set(id, existing);
      });
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [orders]);

  // Payment methods data
  const paymentMethodsData = useMemo(() => {
    return (sessionSummary?.summary?.paymentsByMethod || []).map((p) => ({
      method: p.method,
      amount: p.amount,
      count: p.count,
    }));
  }, [sessionSummary]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (isLoading && !sessionSummary) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/pos')}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold">Dashboard</h1>
            <p className="text-xs text-slate-400">
              Resumen de la sesion actual
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 border border-emerald-600/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-600/30 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-emerald-300">Total Ventas</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {formatPrice(stats.totalSales)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-600/20 to-indigo-600/5 border border-indigo-600/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-600/30 rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-indigo-300">Pedidos</p>
                <p className="text-2xl font-bold text-indigo-400">
                  {stats.totalOrders}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600/20 to-purple-600/5 border border-purple-600/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-600/30 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-purple-300">Ticket Promedio</p>
                <p className="text-2xl font-bold text-purple-400">
                  {formatPrice(stats.avgTicket)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-600/20 to-amber-600/5 border border-amber-600/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-600/30 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-amber-300">Duracion</p>
                <p className="text-2xl font-bold text-amber-400">
                  {stats.duration}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Hourly Sales Chart */}
          {hourlySales.length > 0 ? (
            <HourlySalesChart data={hourlySales} />
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center h-56">
              <BarChart3 className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-slate-500">Sin datos de ventas por hora</p>
            </div>
          )}

          {/* Payment Methods */}
          <PaymentMethodsChart data={paymentMethodsData} />
        </div>

        {/* Top Products */}
        <div className="grid grid-cols-2 gap-4">
          <TopProducts products={topProducts} />

          {/* Session Info */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h3 className="font-semibold mb-4">Informacion de Sesion</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-slate-700">
                <span className="text-slate-400">Caja</span>
                <span className="font-medium">{currentSession?.cashRegister?.name || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-700">
                <span className="text-slate-400">Cajero</span>
                <span className="font-medium">{user?.firstName} {user?.lastName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-700">
                <span className="text-slate-400">Apertura</span>
                <span className="font-medium">
                  {currentSession?.openedAt
                    ? format(new Date(currentSession.openedAt), "HH:mm", { locale: es })
                    : '-'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-700">
                <span className="text-slate-400">Monto Inicial</span>
                <span className="font-medium text-emerald-400">
                  {formatPrice(currentSession?.initialAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Efectivo Esperado</span>
                <span className="font-bold text-lg text-emerald-400">
                  {formatPrice(sessionSummary?.summary?.expectedCash || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
