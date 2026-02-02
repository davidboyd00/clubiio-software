interface QuickAmountButtonsProps {
  onSelect: (amount: number) => void;
  currentAmount: number;
  total: number;
}

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

export function QuickAmountButtons({
  onSelect,
  currentAmount,
  total,
}: QuickAmountButtonsProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-400 mb-2">Montos rápidos</div>

      <div className="grid grid-cols-3 gap-2">
        {QUICK_AMOUNTS.map((amount) => {
          const isSelected = currentAmount === amount;
          const isSufficient = amount >= total;

          return (
            <button
              key={amount}
              onClick={() => onSelect(amount)}
              className={`
                py-3 px-4 rounded-xl font-semibold text-sm
                transition-all duration-150 active:scale-95
                ${isSelected
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                  : isSufficient
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                }
              `}
            >
              {formatPrice(amount)}
            </button>
          );
        })}
      </div>

      {/* Exact amount button */}
      <button
        onClick={() => onSelect(total)}
        className={`
          w-full py-3 rounded-xl font-semibold
          transition-all duration-150 active:scale-98
          ${currentAmount === total
            ? 'bg-green-600 text-white ring-2 ring-green-400'
            : 'bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/50'
          }
        `}
      >
        Monto exacto: {formatPrice(total)}
      </button>
    </div>
  );
}
