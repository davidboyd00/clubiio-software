import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  BarChart3,
  PieChart,
  RefreshCw,
  Package,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ordersApi, SalesRangeSummary } from '../lib/api';

type PeriodType = '7d' | '14d' | '30d' | 'custom';

function getDateRange(periodType: PeriodType, customStart: string, customEnd: string) {
  const endDate = new Date();
  const startDate = new Date();

  switch (periodType) {
    case '7d':
      startDate.setDate(startDate.getDate() - 6);
      break;
    case '14d':
      startDate.setDate(startDate.getDate() - 13);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 29);
      break;
    case 'custom':
      if (customStart && customEnd) {
        return { startDate: customStart, endDate: customEnd };
      }
      startDate.setDate(startDate.getDate() - 6);
      break;
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export function ReportsPage() {
  const navigate = useNavigate();
  const { venueId } = useAuth();
  const [periodType, setPeriodType] = useState<PeriodType>('7d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [reportData, setReportData] = useState<SalesRangeSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!venueId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { startDate, endDate } = getDateRange(periodType, customStartDate, customEndDate);
      const res = await ordersApi.getRangeSummary(venueId, startDate, endDate);
      setReportData(res.data.data || null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar reportes');
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  }, [venueId, periodType, customStartDate, customEndDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('es-CL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  // Max sales for chart scaling
  const maxDailySales = useMemo(() => {
    if (!reportData?.days.length) return 0;
    return Math.max(...reportData.days.map((d) => d.totalSales));
  }, [reportData]);

  // Payment methods for pie chart
  const paymentData = useMemo(() => {
    if (!reportData) return [];
    const methods = reportData.summary.paymentMethods;
    const total = Object.values(methods).reduce((sum, v) => sum + v, 0);
    if (total === 0) return [];

    const colorMap: Record<string, string> = {
      CASH: '#10b981',
      CARD: '#6366f1',
      TRANSFER: '#f59e0b',
      VIP_CARD: '#ec4899',
      MERCADOPAGO: '#3b82f6',
      TICKET_CREDIT: '#8b5cf6',
    };
    const nameMap: Record<string, string> = {
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      TRANSFER: 'Transferencia',
      VIP_CARD: 'Tarjeta VIP',
      MERCADOPAGO: 'MercadoPago',
      TICKET_CREDIT: 'Crédito Ticket',
    };

    return Object.entries(methods)
      .filter(([, amount]) => amount > 0)
      .map(([method, amount]) => ({
        method: nameMap[method] || method,
        amount,
        percent: (amount / total) * 100,
        color: colorMap[method] || '#64748b',
      }));
  }, [reportData]);

  if (!venueId) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400">
        <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
        <p>Selecciona un local para ver reportes</p>
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-semibold">Reportes</h1>
              <p className="text-xs text-slate-400">Análisis de ventas</p>
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2">
          {(['7d', '14d', '30d'] as PeriodType[]).map((period) => (
            <button
              key={period}
              onClick={() => setPeriodType(period)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                periodType === period
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {period === '7d' ? '7 días' : period === '14d' ? '14 días' : '30 días'}
            </button>
          ))}
          <button
            onClick={() => setPeriodType('custom')}
            className={`p-2 rounded-lg transition-colors ${
              periodType === 'custom'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Custom Date Range */}
      {periodType === 'custom' && (
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-4">
          <span className="text-sm text-slate-400">Período:</span>
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => setCustomStartDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:border-indigo-500 focus:outline-none"
          />
          <span className="text-slate-500">hasta</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => setCustomEndDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
          <p>{error}</p>
          <button
            onClick={loadData}
            className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && reportData && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 border border-emerald-600/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span className="text-sm text-emerald-300">Ventas Totales</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">
                {formatPrice(reportData.summary.totalSales)}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {reportData.summary.growthPercent >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <span
                  className={`text-sm ${reportData.summary.growthPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {formatPercent(reportData.summary.growthPercent)} vs periodo anterior
                </span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-600/20 to-indigo-600/5 border border-indigo-600/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-5 h-5 text-indigo-400" />
                <span className="text-sm text-indigo-300">Pedidos</span>
              </div>
              <p className="text-2xl font-bold text-indigo-400">{reportData.summary.totalOrders}</p>
              <p className="text-sm text-slate-400 mt-1">
                Promedio: {formatPrice(reportData.summary.avgTicket)}
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-600/20 to-purple-600/5 border border-purple-600/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                <span className="text-sm text-purple-300">Promedio Diario</span>
              </div>
              <p className="text-2xl font-bold text-purple-400">
                {formatPrice(reportData.summary.avgDailySales)}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {reportData.days.length} días con datos
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-600/20 to-green-600/5 border border-green-600/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <span className="text-sm text-green-300">Mejor Día</span>
              </div>
              {reportData.summary.bestDay ? (
                <>
                  <p className="text-2xl font-bold text-green-400">
                    {formatPrice(reportData.summary.bestDay.sales)}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    {formatDateDisplay(reportData.summary.bestDay.date)}
                  </p>
                </>
              ) : (
                <p className="text-slate-500">Sin datos</p>
              )}
            </div>

            <div className="bg-gradient-to-br from-amber-600/20 to-amber-600/5 border border-amber-600/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-amber-400" />
                <span className="text-sm text-amber-300">Peor Día</span>
              </div>
              {reportData.summary.worstDay ? (
                <>
                  <p className="text-2xl font-bold text-amber-400">
                    {formatPrice(reportData.summary.worstDay.sales)}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    {formatDateDisplay(reportData.summary.worstDay.date)}
                  </p>
                </>
              ) : (
                <p className="text-slate-500">Sin datos</p>
              )}
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Daily Sales Chart */}
            <div className="col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                Ventas por Día
              </h3>
              {reportData.days.length > 0 ? (
                <div className="h-64 flex items-end gap-1">
                  {reportData.days.map((day) => {
                    const heightPercent = maxDailySales > 0 ? (day.totalSales / maxDailySales) * 100 : 0;
                    return (
                      <div
                        key={day.date}
                        className="flex-1 flex flex-col items-center group"
                      >
                        {/* Bar */}
                        <div className="w-full relative flex-1 flex items-end">
                          <div
                            className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-sm hover:from-indigo-500 hover:to-indigo-300 transition-all cursor-pointer relative group"
                            style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                          >
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-700 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              <p className="font-semibold">{formatPrice(day.totalSales)}</p>
                              <p className="text-slate-400">{day.totalOrders} pedidos</p>
                            </div>
                          </div>
                        </div>
                        {/* Label */}
                        <span className="text-[10px] text-slate-500 mt-1 truncate w-full text-center">
                          {new Date(day.date + 'T12:00:00').toLocaleDateString('es-CL', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-500">
                  No hay datos para este período
                </div>
              )}
            </div>

            {/* Payment Methods */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-purple-400" />
                Métodos de Pago
              </h3>
              {paymentData.length > 0 ? (
                <div className="space-y-4">
                  {/* Pie Chart Visual */}
                  <div className="relative w-32 h-32 mx-auto">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      {(() => {
                        let currentAngle = 0;
                        return paymentData.map((item) => {
                          const angle = (item.percent / 100) * 360;
                          const startAngle = currentAngle;
                          currentAngle += angle;

                          const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                          const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                          const x2 = 50 + 40 * Math.cos(((startAngle + angle) * Math.PI) / 180);
                          const y2 = 50 + 40 * Math.sin(((startAngle + angle) * Math.PI) / 180);

                          const largeArc = angle > 180 ? 1 : 0;

                          return (
                            <path
                              key={item.method}
                              d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                              fill={item.color}
                              className="hover:opacity-80 transition-opacity"
                            />
                          );
                        });
                      })()}
                    </svg>
                  </div>

                  {/* Legend */}
                  <div className="space-y-2">
                    {paymentData.map((item) => (
                      <div key={item.method} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-sm text-slate-300">{item.method}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatPrice(item.amount)}</p>
                          <p className="text-xs text-slate-500">{item.percent.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-500">
                  No hay datos
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Top Products */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                Productos Más Vendidos
              </h3>
              {reportData.summary.topProducts.length > 0 ? (
                <div className="space-y-3">
                  {reportData.summary.topProducts.slice(0, 5).map((product, index) => (
                    <div key={product.name} className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                          index === 0
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : index === 1
                            ? 'bg-slate-400/20 text-slate-300'
                            : index === 2
                            ? 'bg-amber-600/20 text-amber-500'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        <p className="text-sm text-slate-400">{product.quantity} vendidos</p>
                      </div>
                      <p className="font-semibold text-emerald-400">
                        {formatPrice(product.revenue)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-500">
                  No hay datos
                </div>
              )}
            </div>

            {/* Top Categories */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Ventas por Categoría
              </h3>
              {reportData.summary.topCategories.length > 0 ? (
                <div className="space-y-3">
                  {reportData.summary.topCategories.map((category) => {
                    const maxCategorySales = Math.max(...reportData.summary.topCategories.map((c) => c.sales));
                    const widthPercent = maxCategorySales > 0 ? (category.sales / maxCategorySales) * 100 : 0;

                    return (
                      <div key={category.name} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{category.name}</span>
                          <span className="text-indigo-400">{formatPrice(category.sales)}</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-500">
                  No hay datos
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No data state */}
      {!isLoading && !error && !reportData && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
          <BarChart3 className="w-16 h-16 mb-3 opacity-30" />
          <p>No hay datos de ventas</p>
        </div>
      )}
    </div>
  );
}
