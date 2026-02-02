import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft,
  Search,
  Receipt,
  XCircle,
  Eye,
  Loader2,
  ShoppingBag,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCashSession } from '../hooks/useCashSession';
import { Order, ordersApi } from '../lib/api';
import { OrderDetailModal } from '../components/orders/OrderDetailModal';

export function OrderHistoryPage() {
  const navigate = useNavigate();
  const { cashSessionId } = useAuth();
  const { sessionSummary, refreshSummary } = useCashSession();

  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'VOIDED'>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redirect if no active session
  useEffect(() => {
    if (!cashSessionId && !isLoading) {
      navigate('/open-cash');
    }
  }, [cashSessionId, isLoading, navigate]);

  // Load orders from session
  useEffect(() => {
    const loadOrders = async () => {
      if (!sessionSummary?.session?.id) return;

      setIsLoading(true);
      try {
        // Orders come from the session summary (findById includes orders)
        const sessionOrders = (sessionSummary.session as any).orders || [];
        setOrders(sessionOrders);
        setFilteredOrders(sessionOrders);
      } catch (error) {
        console.error('Error loading orders:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadOrders();
  }, [sessionSummary]);

  // Filter orders
  useEffect(() => {
    let filtered = [...orders];

    // Filter by status
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.orderNumber.toString().includes(query) ||
        o.items?.some(item => item.product?.name.toLowerCase().includes(query))
      );
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFilteredOrders(filtered);
  }, [orders, statusFilter, searchQuery]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshSummary();
    setIsRefreshing(false);
  };

  const handleVoidOrder = async (orderId: string, reason: string) => {
    try {
      await ordersApi.void(orderId, reason);
      await refreshSummary();
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error voiding order:', error);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const completedOrders = orders.filter(o => o.status === 'COMPLETED');
  const voidedOrders = orders.filter(o => o.status === 'VOIDED');
  const totalSales = completedOrders.reduce((sum, o) => sum + o.total, 0);

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
            <h1 className="font-semibold">Historial de Pedidos</h1>
            <p className="text-xs text-slate-400">
              {orders.length} pedidos en esta sesion
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

      {/* Summary Cards */}
      <div className="p-4 grid grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Pedidos</p>
              <p className="text-xl font-bold">{completedOrders.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Ventas</p>
              <p className="text-xl font-bold text-emerald-400">{formatPrice(totalSales)}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Anulados</p>
              <p className="text-xl font-bold text-red-400">{voidedOrders.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="px-4 pb-4 flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por # o producto..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Completados
          </button>
          <button
            onClick={() => setStatusFilter('VOIDED')}
            className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${
              statusFilter === 'VOIDED'
                ? 'bg-red-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Anulados
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Receipt className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">Sin pedidos</p>
            <p className="text-sm mt-1">
              {searchQuery || statusFilter !== 'ALL'
                ? 'No hay pedidos que coincidan con el filtro'
                : 'Los pedidos apareceran aqui'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onView={() => setSelectedOrder(order)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onVoid={handleVoidOrder}
          onPrint={() => {
            // Will implement print functionality
            console.log('Print order:', selectedOrder.id);
          }}
        />
      )}
    </div>
  );
}

// Order Card Component
function OrderCard({ order, onView }: { order: Order; onView: () => void }) {
  const isVoided = order.status === 'VOIDED';

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const itemCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <div
      onClick={onView}
      className={`
        bg-slate-800 border rounded-xl p-4 cursor-pointer
        transition-all hover:border-indigo-500/50
        ${isVoided ? 'border-red-600/30 opacity-60' : 'border-slate-700'}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg
            ${isVoided ? 'bg-red-600/20 text-red-400' : 'bg-indigo-600/20 text-indigo-400'}
          `}>
            #{order.orderNumber}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">
                {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
              </p>
              {isVoided && (
                <span className="px-2 py-0.5 bg-red-600/20 text-red-400 text-xs rounded-full">
                  Anulado
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">
              {format(new Date(order.createdAt), "HH:mm", { locale: es })}
              {' - '}
              {order.items?.slice(0, 2).map(i => i.product?.name).join(', ')}
              {(order.items?.length || 0) > 2 && '...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className={`text-lg font-bold ${isVoided ? 'text-red-400 line-through' : 'text-white'}`}>
              {formatPrice(order.total)}
            </p>
            <div className="flex gap-1">
              {order.payments?.map((p, i) => (
                <span
                  key={i}
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    p.method === 'CASH' ? 'bg-emerald-600/20 text-emerald-400' :
                    p.method === 'CARD' ? 'bg-blue-600/20 text-blue-400' :
                    'bg-purple-600/20 text-purple-400'
                  }`}
                >
                  {p.method === 'CASH' ? 'Efectivo' : p.method === 'CARD' ? 'Tarjeta' : 'Vale'}
                </span>
              ))}
            </div>
          </div>
          <Eye className="w-5 h-5 text-slate-400" />
        </div>
      </div>
    </div>
  );
}
