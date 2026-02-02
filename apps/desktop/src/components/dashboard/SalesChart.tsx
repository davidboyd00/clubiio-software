interface SalesData {
  label: string;
  value: number;
}

interface SalesChartProps {
  data: SalesData[];
  title?: string;
  formatValue?: (value: number) => string;
  color?: string;
}

export function SalesChart({
  data,
  title = 'Ventas',
  formatValue = (v) => `$${v.toLocaleString('es-CL')}`,
  color = 'indigo',
}: SalesChartProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  const colorClasses = {
    indigo: { bar: 'bg-indigo-500', bg: 'bg-indigo-500/20' },
    emerald: { bar: 'bg-emerald-500', bg: 'bg-emerald-500/20' },
    blue: { bar: 'bg-blue-500', bg: 'bg-blue-500/20' },
    purple: { bar: 'bg-purple-500', bg: 'bg-purple-500/20' },
  };

  const colors = colorClasses[color as keyof typeof colorClasses] || colorClasses.indigo;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      {title && (
        <h3 className="font-semibold mb-4">{title}</h3>
      )}
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{item.label}</span>
              <span className="font-medium">{formatValue(item.value)}</span>
            </div>
            <div className={`h-2 rounded-full ${colors.bg}`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Hourly sales chart - vertical bars
interface HourlySalesChartProps {
  data: { hour: number; sales: number }[];
}

export function HourlySalesChart({ data }: HourlySalesChartProps) {
  const maxSales = Math.max(...data.map(d => d.sales), 1);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      notation: 'compact',
    }).format(price);
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <h3 className="font-semibold mb-4">Ventas por Hora</h3>
      <div className="flex items-end gap-1 h-40">
        {data.map((item, index) => {
          const height = (item.sales / maxSales) * 100;
          return (
            <div
              key={index}
              className="flex-1 flex flex-col items-center gap-1 group"
            >
              <div className="relative flex-1 w-full flex items-end">
                <div
                  className="w-full bg-indigo-500 rounded-t transition-all duration-300 hover:bg-indigo-400"
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {formatPrice(item.sales)}
                </div>
              </div>
              <span className="text-xs text-slate-500">{item.hour}h</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
