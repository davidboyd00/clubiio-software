import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  CreditCard,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import clsx from 'clsx';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

interface OverviewSummary {
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  activeStaff: number;
  salesChangePct: number | null;
  ordersChangePct: number | null;
  avgTicketChangePct: number | null;
}

interface OverviewResponse {
  summary: OverviewSummary;
  hourlySales: { hour: string; sales: number }[];
  topProducts: { id: string; name: string; qty: number; revenue: number }[];
  paymentMethods: { method: string; amount: number; count: number }[];
}

type RiskSeverity = 'ok' | 'warning' | 'critical';

interface RiskItem {
  type: 'queue' | 'stock' | 'cash';
  severity: RiskSeverity;
  score: number;
  title: string;
  summary: string;
  recommendations: string[];
}

interface SuggestedAction {
  id: string;
  type:
    | 'QUEUE_REDUCE_TIMEOUTS'
    | 'QUEUE_ENABLE_BATCHING'
    | 'QUEUE_ENABLE_AUTOPILOT'
    | 'QUEUE_REBALANCE_BAR'
    | 'STOCK_RESTOCK_REQUEST'
    | 'STOCK_PRESTOCK_PLAN'
    | 'CASH_AUDIT_REQUEST';
  label: string;
  description?: string;
  auto: boolean;
  payload?: Record<string, unknown>;
}

interface CashRegisterOption {
  id: string;
  name: string;
  type: 'BAR' | 'TICKET_BOOTH' | 'GENERAL';
}

interface RisksResponse {
  windowMinutes: number;
  risks: RiskItem[];
  actions: string[];
  suggestedActions: SuggestedAction[];
}

interface ActionHistoryItem {
  id: string;
  type: string;
  label: string;
  status: 'PENDING' | 'APPLIED' | 'FAILED';
  priority?: number;
  assignedRole?: string | null;
  createdAt: string;
  appliedAt?: string | null;
}

interface ActionsResponse {
  actions: ActionHistoryItem[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

function MetricCard({ title, value, change, icon: Icon, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change !== undefined && (
            <div
              className={clsx(
                'flex items-center gap-1 text-sm mt-2',
                change >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {change >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{Math.abs(change)}% vs ayer</span>
            </div>
          )}
        </div>
        <div className={clsx('p-3 rounded-xl', colorClasses[color])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

const defaultHourlyData = Array.from({ length: 24 }, (_, hour) => ({
  hour: `${String(hour).padStart(2, '0')}:00`,
  sales: 0,
}));

export default function OverviewPage() {
  const { venues } = useAuthStore();
  const [selectedVenue, setSelectedVenue] = useState<string>('');
  const [bars, setBars] = useState<CashRegisterOption[]>([]);
  const [selectedBarId, setSelectedBarId] = useState<string>('');
  const [barsLoading, setBarsLoading] = useState(false);
  const [barsError, setBarsError] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [risks, setRisks] = useState<RisksResponse | null>(null);
  const [actionsHistory, setActionsHistory] = useState<ActionHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [applyingActionId, setApplyingActionId] = useState<string | null>(null);
  const [appliedActions, setAppliedActions] = useState<Record<string, 'success' | 'error' | 'pending'>>({});

  useEffect(() => {
    if (venues.length > 0 && !selectedVenue) {
      setSelectedVenue(venues[0].id);
    }
  }, [venues, selectedVenue]);

  useEffect(() => {
    if (selectedVenue) {
      loadBars(selectedVenue);
    }
  }, [selectedVenue]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => new Intl.NumberFormat('es-CL').format(value);
  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  };

  const selectedBar = useMemo(
    () => bars.find((bar) => bar.id === selectedBarId) ?? null,
    [bars, selectedBarId]
  );

  const loadBars = async (venueId: string) => {
    setBarsLoading(true);
    setBarsError(null);
    setSelectedBarId('');
    try {
      const response = await api.get<ApiResponse<CashRegisterOption[]>>(
        `/api/cash-registers/venue/${venueId}`
      );
      const registers = response.data.data || [];
      const barOnly = registers.filter((register) => register.type === 'BAR');
      const nextBars = barOnly.length > 0 ? barOnly : registers;

      setBars(nextBars);
      if (nextBars.length > 0) {
        setSelectedBarId((prev) => (nextBars.some((bar) => bar.id === prev) ? prev : nextBars[0].id));
      }
    } catch (error) {
      setBars([]);
      setSelectedBarId('');
      setBarsError('No pudimos cargar las barras.');
    } finally {
      setBarsLoading(false);
    }
  };

  const loadOverview = async (venueId: string, barId?: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [overviewRes, risksRes, actionsRes] = await Promise.all([
        api.get<ApiResponse<OverviewResponse>>(`/api/analytics/overview`, {
          params: { venueId },
        }),
        api.get<ApiResponse<RisksResponse>>(`/api/analytics/risks`, {
          params: { venueId, windowMinutes: 60, barId },
        }),
        api.get<ApiResponse<ActionsResponse>>(`/api/analytics/actions`, {
          params: { venueId, limit: 10, barId },
        }),
      ]);
      setOverview(overviewRes.data.data);
      setRisks(risksRes.data.data);
      setActionsHistory(actionsRes.data.data.actions || []);
    } catch (error) {
      setErrorMessage('No pudimos cargar los datos del dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const applyAction = async (action: SuggestedAction) => {
    if (!selectedVenue) return;
    setApplyingActionId(action.id);
    try {
      const payload = { ...(action.payload || {}) } as Record<string, unknown>;
      if (selectedBarId && !('bar_id' in payload)) {
        payload.bar_id = selectedBarId;
      }
      if (selectedBar?.name && !('bar_name' in payload)) {
        payload.bar_name = selectedBar.name;
      }

      const response = await api.post<{ data: { status: 'APPLIED' | 'FAILED' | 'PENDING' } }>(
        '/api/analytics/actions/apply',
        {
        venueId: selectedVenue,
        actionId: action.id,
        actionType: action.type,
        label: action.label,
        payload: Object.keys(payload).length > 0 ? payload : undefined,
        }
      );
      const status = response.data?.data?.status;
      if (status === 'FAILED') {
        setAppliedActions((prev) => ({ ...prev, [action.id]: 'error' }));
      } else {
        setAppliedActions((prev) => ({
          ...prev,
          [action.id]: status === 'PENDING' ? 'pending' : 'success',
        }));
      }
      await loadOverview(selectedVenue, selectedBarId || undefined);
    } catch (error) {
      setAppliedActions((prev) => ({ ...prev, [action.id]: 'error' }));
    } finally {
      setApplyingActionId(null);
    }
  };

  useEffect(() => {
    if (!selectedVenue) return;
    if (bars.length > 0 && !selectedBarId) return;
    loadOverview(selectedVenue, selectedBarId || undefined);
  }, [selectedVenue, selectedBarId, bars.length]);

  const hourlyData = overview?.hourlySales?.length ? overview.hourlySales : defaultHourlyData;
  const topProducts = overview?.topProducts ?? [];
  const paymentMethods = overview?.paymentMethods ?? [];
  const summary = overview?.summary;
  const suggestedActions = risks?.suggestedActions ?? [];

  const riskItems = useMemo(() => {
    if (!risks?.risks) return [];
    const alerting = risks.risks.filter((risk) => risk.severity !== 'ok');
    return alerting.length > 0 ? alerting : risks.risks;
  }, [risks]);

  const severityStyles: Record<RiskSeverity, string> = {
    ok: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    critical: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Resumen del día</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {venues.length > 1 && (
            <select
              value={selectedVenue}
              onChange={(e) => setSelectedVenue(e.target.value)}
              className="input w-auto"
            >
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          )}
          {barsLoading && (
            <span className="text-xs text-gray-500">Cargando barras...</span>
          )}
          {!barsLoading && bars.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Barra</span>
              <select
                value={selectedBarId}
                onChange={(e) => setSelectedBarId(e.target.value)}
                className="input w-auto"
              >
                {bars.map((bar) => (
                  <option key={bar.id} value={bar.id}>
                    {bar.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {barsError && (
            <span className="text-xs text-red-500">{barsError}</span>
          )}
        </div>
      </div>

      {errorMessage && !loading && (
        <div className="card border border-red-200 bg-red-50 text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Ventas Hoy"
          value={formatCurrency(summary?.totalSales || 0)}
          change={summary?.salesChangePct ?? undefined}
          icon={DollarSign}
          color="green"
        />
        <MetricCard
          title="Órdenes"
          value={formatNumber(summary?.totalOrders || 0)}
          change={summary?.ordersChangePct ?? undefined}
          icon={ShoppingCart}
          color="blue"
        />
        <MetricCard
          title="Ticket Promedio"
          value={formatCurrency(summary?.avgTicket || 0)}
          change={summary?.avgTicketChangePct ?? undefined}
          icon={CreditCard}
          color="purple"
        />
        <MetricCard
          title="Staff Activo"
          value={formatNumber(summary?.activeStaff || 0)}
          icon={Users}
          color="orange"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Ventas por Hora
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Ventas']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorVentas)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          {/* Payment Methods */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Métodos de Pago
            </h3>
            {paymentMethods.length === 0 ? (
              <p className="text-sm text-gray-500">Aún no hay pagos registrados.</p>
            ) : (
              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <div key={method.method}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">{method.method}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(method.amount)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{
                          width: `${summary?.totalSales ? (method.amount / summary.totalSales) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatNumber(method.count)} transacciones
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Ops */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">AI Ops</h3>
              <span className="text-xs text-gray-500">
                Ventana {risks?.windowMinutes ?? 60} min
              </span>
            </div>
            {loading && (
              <p className="text-sm text-gray-500">Cargando recomendaciones...</p>
            )}
            {!loading && !errorMessage && (
              <div className="space-y-4">
                {riskItems.length === 0 && (
                  <p className="text-sm text-gray-500">Sin alertas activas.</p>
                )}
                {riskItems.map((risk) => (
                  <div key={risk.type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{risk.title}</p>
                      <span className={clsx('text-xs font-medium px-2 py-1 rounded-full', severityStyles[risk.severity])}>
                        {risk.severity === 'critical'
                          ? 'Crítico'
                          : risk.severity === 'warning'
                          ? 'Atención'
                          : 'OK'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{risk.summary}</p>
                    <p className="text-xs text-gray-700">
                      {risk.recommendations.join(' · ')}
                    </p>
                  </div>
                ))}
                {risks?.actions?.length ? (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-900 mb-1">Acciones sugeridas</p>
                    <p className="text-xs text-gray-600">{risks.actions.join(' · ')}</p>
                  </div>
                ) : null}
                {suggestedActions.length > 0 ? (
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <p className="text-xs font-medium text-gray-900">Aplicar con 1-click</p>
                    {suggestedActions.map((action) => {
                      const appliedState = appliedActions[action.id];
                      const isApplying = applyingActionId === action.id;
                      const buttonLabel = appliedState === 'success'
                        ? 'Aplicado'
                        : appliedState === 'pending'
                        ? 'Registrado'
                        : appliedState === 'error'
                        ? 'Reintentar'
                        : action.auto
                        ? 'Aplicar'
                        : 'Registrar';

                      return (
                        <div key={action.id} className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium text-gray-900">{action.label}</p>
                            {action.description && (
                              <p className="text-[11px] text-gray-500">{action.description}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            className={clsx(
                              'px-3 py-1.5 text-xs rounded-lg font-medium transition-colors',
                              appliedState === 'success' || appliedState === 'pending'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-primary-600 text-white hover:bg-primary-700'
                            )}
                            onClick={() => applyAction(action)}
                            disabled={isApplying}
                          >
                            {isApplying ? 'Aplicando...' : buttonLabel}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}
            {!loading && errorMessage && (
              <p className="text-sm text-red-500">{errorMessage}</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Productos Más Vendidos
        </h3>
        {topProducts.length === 0 ? (
          <p className="text-sm text-gray-500">No hay ventas registradas hoy.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th className="pb-3 font-medium">Producto</th>
                  <th className="pb-3 font-medium text-right">Cantidad</th>
                  <th className="pb-3 font-medium text-right">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, i) => (
                  <tr key={product.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                          {i + 1}
                        </span>
                        <span className="font-medium text-gray-900">
                          {product.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-gray-600">
                      {formatNumber(product.qty)}
                    </td>
                    <td className="py-3 text-right font-medium text-gray-900">
                      {formatCurrency(product.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action History */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Historial de Acciones
        </h3>
        {actionsHistory.length === 0 ? (
          <p className="text-sm text-gray-500">Aún no hay acciones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th className="pb-3 font-medium">Acción</th>
                  <th className="pb-3 font-medium">Estado</th>
                  <th className="pb-3 font-medium">Prioridad</th>
                  <th className="pb-3 font-medium">Rol</th>
                  <th className="pb-3 font-medium">Creada</th>
                  <th className="pb-3 font-medium">Aplicada</th>
                </tr>
              </thead>
              <tbody>
                {actionsHistory.map((action) => (
                  <tr key={action.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 font-medium text-gray-900">{action.label}</td>
                    <td className="py-3">
                      <span
                        className={clsx(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          action.status === 'APPLIED'
                            ? 'bg-green-100 text-green-700'
                            : action.status === 'FAILED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        )}
                      >
                        {action.status === 'APPLIED'
                          ? 'Aplicada'
                          : action.status === 'FAILED'
                          ? 'Fallida'
                          : 'Pendiente'}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {action.priority ?? '—'}
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {action.assignedRole ?? '—'}
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {formatDateTime(action.createdAt)}
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {formatDateTime(action.appliedAt || undefined)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
