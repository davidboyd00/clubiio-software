import { Banknote, CreditCard, Ticket, TrendingUp, TrendingDown } from 'lucide-react';

interface PaymentBreakdownProps {
  cashPayments: number;
  cardPayments: number;
  voucherPayments: number;
  cashMovementsIn: number;
  cashMovementsOut: number;
  openingAmount: number;
}

export function PaymentBreakdown({
  cashPayments,
  cardPayments,
  voucherPayments,
  cashMovementsIn,
  cashMovementsOut,
  openingAmount,
}: PaymentBreakdownProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const totalSales = cashPayments + cardPayments + voucherPayments;
  const expectedCash = openingAmount + cashPayments + cashMovementsIn - cashMovementsOut;

  const items = [
    {
      icon: Banknote,
      label: 'Ventas en efectivo',
      value: cashPayments,
      color: 'text-green-400',
      bgColor: 'bg-green-600/20',
    },
    {
      icon: CreditCard,
      label: 'Ventas con tarjeta',
      value: cardPayments,
      color: 'text-blue-400',
      bgColor: 'bg-blue-600/20',
    },
    {
      icon: Ticket,
      label: 'Ventas con voucher',
      value: voucherPayments,
      color: 'text-purple-400',
      bgColor: 'bg-purple-600/20',
    },
  ];

  const movements = [
    {
      icon: TrendingUp,
      label: 'Ingresos de caja',
      value: cashMovementsIn,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-600/20',
    },
    {
      icon: TrendingDown,
      label: 'Retiros de caja',
      value: -cashMovementsOut,
      color: 'text-orange-400',
      bgColor: 'bg-orange-600/20',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Sales breakdown */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
          Ventas por método
        </h3>
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${item.bgColor} rounded-lg flex items-center justify-center`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <span className="text-slate-300">{item.label}</span>
            </div>
            <span className={`font-semibold ${item.color}`}>
              {formatPrice(item.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Movements */}
      {(cashMovementsIn > 0 || cashMovementsOut > 0) && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
            Movimientos de caja
          </h3>
          {movements.map((item) => (
            item.value !== 0 && (
              <div
                key={item.label}
                className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${item.bgColor} rounded-lg flex items-center justify-center`}>
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <span className="text-slate-300">{item.label}</span>
                </div>
                <span className={`font-semibold ${item.color}`}>
                  {formatPrice(item.value)}
                </span>
              </div>
            )
          ))}
        </div>
      )}

      {/* Totals */}
      <div className="border-t border-slate-700 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Apertura de caja</span>
          <span className="font-semibold">{formatPrice(openingAmount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Total ventas</span>
          <span className="font-semibold text-indigo-400">{formatPrice(totalSales)}</span>
        </div>
        <div className="flex items-center justify-between text-lg">
          <span className="font-medium">Efectivo esperado</span>
          <span className="font-bold text-green-400">{formatPrice(expectedCash)}</span>
        </div>
      </div>
    </div>
  );
}
