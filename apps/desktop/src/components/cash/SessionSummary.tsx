import { Clock, ShoppingBag, Banknote, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SessionSummaryProps {
  openedAt: string;
  cashRegisterName: string;
  userName: string;
  totalOrders: number;
  totalSales: number;
  openingAmount: number;
}

export function SessionSummary({
  openedAt,
  cashRegisterName,
  userName,
  totalOrders,
  totalSales,
  openingAmount,
}: SessionSummaryProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const openDate = new Date(openedAt);
  const duration = Math.floor((Date.now() - openDate.getTime()) / 1000 / 60);
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;

  const stats = [
    {
      icon: Clock,
      label: 'Duración',
      value: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      color: 'text-slate-300',
      bgColor: 'bg-slate-600/50',
    },
    {
      icon: ShoppingBag,
      label: 'Órdenes',
      value: totalOrders.toString(),
      color: 'text-blue-400',
      bgColor: 'bg-blue-600/20',
    },
    {
      icon: TrendingUp,
      label: 'Ventas',
      value: formatPrice(totalSales),
      color: 'text-green-400',
      bgColor: 'bg-green-600/20',
    },
    {
      icon: Banknote,
      label: 'Apertura',
      value: formatPrice(openingAmount),
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-600/20',
    },
  ];

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">{cashRegisterName}</h3>
            <p className="text-sm text-slate-400">Operado por {userName}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Abierta</p>
            <p className="font-medium">
              {format(openDate, "d MMM, HH:mm", { locale: es })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-px bg-slate-700">
        {stats.map((stat) => (
          <div key={stat.label} className="p-4 bg-slate-800">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-slate-400">{stat.label}</p>
                <p className={`font-semibold ${stat.color}`}>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
