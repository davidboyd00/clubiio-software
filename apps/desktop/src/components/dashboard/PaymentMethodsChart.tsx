import { Banknote, CreditCard, Ticket } from 'lucide-react';

interface PaymentMethodData {
  method: 'CASH' | 'CARD' | 'VOUCHER';
  amount: number;
  count: number;
}

interface PaymentMethodsChartProps {
  data: PaymentMethodData[];
}

export function PaymentMethodsChart({ data }: PaymentMethodsChartProps) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getMethodInfo = (method: string) => {
    switch (method) {
      case 'CASH':
        return {
          label: 'Efectivo',
          icon: Banknote,
          color: 'emerald',
          bgClass: 'bg-emerald-500',
          textClass: 'text-emerald-400',
          bgLightClass: 'bg-emerald-500/20',
        };
      case 'CARD':
        return {
          label: 'Tarjeta',
          icon: CreditCard,
          color: 'blue',
          bgClass: 'bg-blue-500',
          textClass: 'text-blue-400',
          bgLightClass: 'bg-blue-500/20',
        };
      case 'VOUCHER':
        return {
          label: 'Vales',
          icon: Ticket,
          color: 'purple',
          bgClass: 'bg-purple-500',
          textClass: 'text-purple-400',
          bgLightClass: 'bg-purple-500/20',
        };
      default:
        return {
          label: method,
          icon: Banknote,
          color: 'slate',
          bgClass: 'bg-slate-500',
          textClass: 'text-slate-400',
          bgLightClass: 'bg-slate-500/20',
        };
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <h3 className="font-semibold mb-4">Metodos de Pago</h3>

      {/* Stacked bar */}
      <div className="h-4 rounded-full overflow-hidden flex mb-4">
        {data.map((item) => {
          const percentage = total > 0 ? (item.amount / total) * 100 : 0;
          const info = getMethodInfo(item.method);
          return (
            <div
              key={item.method}
              className={`${info.bgClass} transition-all duration-500`}
              style={{ width: `${percentage}%` }}
              title={`${info.label}: ${formatPrice(item.amount)} (${percentage.toFixed(1)}%)`}
            />
          );
        })}
        {total === 0 && (
          <div className="w-full bg-slate-700" />
        )}
      </div>

      {/* Legend */}
      <div className="space-y-3">
        {data.map((item) => {
          const info = getMethodInfo(item.method);
          const Icon = info.icon;
          const percentage = total > 0 ? (item.amount / total) * 100 : 0;

          return (
            <div key={item.method} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${info.bgLightClass}`}>
                  <Icon className={`w-5 h-5 ${info.textClass}`} />
                </div>
                <div>
                  <p className="font-medium">{info.label}</p>
                  <p className="text-sm text-slate-400">
                    {item.count} {item.count === 1 ? 'transaccion' : 'transacciones'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold ${info.textClass}`}>{formatPrice(item.amount)}</p>
                <p className="text-sm text-slate-400">{percentage.toFixed(1)}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
