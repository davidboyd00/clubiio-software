import { useEffect, useState } from 'react';
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

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange';
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

// Sample data - replace with real API data
const hourlyData = [
  { hour: '10:00', ventas: 4200 },
  { hour: '11:00', ventas: 5800 },
  { hour: '12:00', ventas: 7200 },
  { hour: '13:00', ventas: 9500 },
  { hour: '14:00', ventas: 8200 },
  { hour: '15:00', ventas: 6800 },
  { hour: '16:00', ventas: 5400 },
  { hour: '17:00', ventas: 6200 },
  { hour: '18:00', ventas: 8900 },
  { hour: '19:00', ventas: 11200 },
  { hour: '20:00', ventas: 13500 },
  { hour: '21:00', ventas: 15800 },
  { hour: '22:00', ventas: 18200 },
  { hour: '23:00', ventas: 14500 },
];

const topProducts = [
  { name: 'Cerveza Draft', qty: 245, revenue: 735000 },
  { name: 'Vodka Tonic', qty: 189, revenue: 945000 },
  { name: 'Pisco Sour', qty: 156, revenue: 624000 },
  { name: 'Ron Cola', qty: 134, revenue: 536000 },
  { name: 'Mojito', qty: 98, revenue: 490000 },
];

const paymentMethods = [
  { method: 'Efectivo', amount: 1250000, count: 156 },
  { method: 'Tarjeta', amount: 2340000, count: 234 },
  { method: 'Transferencia', amount: 450000, count: 45 },
];

export default function OverviewPage() {
  const { venues } = useAuthStore();
  const [selectedVenue, setSelectedVenue] = useState<string>('');

  useEffect(() => {
    if (venues.length > 0 && !selectedVenue) {
      setSelectedVenue(venues[0].id);
    }
  }, [venues, selectedVenue]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Resumen del día</p>
        </div>
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
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Ventas Hoy"
          value={formatCurrency(4040000)}
          change={12.5}
          icon={DollarSign}
          color="green"
        />
        <MetricCard
          title="Órdenes"
          value="435"
          change={8.2}
          icon={ShoppingCart}
          color="blue"
        />
        <MetricCard
          title="Ticket Promedio"
          value={formatCurrency(9287)}
          change={-2.1}
          icon={CreditCard}
          color="purple"
        />
        <MetricCard
          title="Staff Activo"
          value="8"
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
                  dataKey="ventas"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorVentas)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Métodos de Pago
          </h3>
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
                      width: `${(method.amount / 4040000) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {method.count} transacciones
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Productos Más Vendidos
        </h3>
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
                <tr key={product.name} className="border-b border-gray-50 last:border-0">
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
                  <td className="py-3 text-right text-gray-600">{product.qty}</td>
                  <td className="py-3 text-right font-medium text-gray-900">
                    {formatCurrency(product.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
