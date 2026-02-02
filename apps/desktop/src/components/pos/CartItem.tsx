import { Minus, Plus, Trash2, Wine, Percent } from 'lucide-react';
import { CartItemWithPromotion } from '../../hooks/useCart';

interface CartItemProps {
  item: CartItemWithPromotion;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

export function CartItem({
  item,
  onIncrement,
  onDecrement,
  onRemove,
}: CartItemProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const hasPromotion = item.promotionDiscount > 0;
  const subtotal = item.finalPrice * item.quantity;
  const displayName = item.shortName || item.name;

  return (
    <div className={`bg-slate-700/50 rounded-lg p-3 flex items-center gap-3 animate-slide-in border ${hasPromotion ? 'border-green-600/50' : 'border-slate-600/50'}`}>
      {/* Product info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-white truncate">{displayName}</p>
          {item.isAlcoholic && (
            <Wine className="w-3 h-3 text-purple-400 flex-shrink-0" />
          )}
          {hasPromotion && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-600/20 text-green-400 text-[10px] font-medium rounded">
              <Percent className="w-2.5 h-2.5" />
              Promo
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {hasPromotion ? (
            <>
              <span className="text-sm text-slate-500 line-through">
                {formatPrice(item.price)}
              </span>
              <span className="text-sm text-green-400">
                {formatPrice(item.finalPrice)} c/u
              </span>
            </>
          ) : (
            <span className="text-sm text-slate-400">
              {formatPrice(item.price)} c/u
            </span>
          )}
          <span className="text-sm text-indigo-400 font-semibold">
            = {formatPrice(subtotal)}
          </span>
        </div>
        {hasPromotion && item.promotionName && (
          <p className="text-[10px] text-green-400/70 mt-0.5 truncate">
            {item.promotionName}
          </p>
        )}
      </div>

      {/* Quantity controls - larger touch targets */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onDecrement}
          className="
            w-11 h-11 rounded-xl bg-slate-600 hover:bg-slate-500
            flex items-center justify-center transition-colors
            active:scale-95 active:bg-slate-700 touch-manipulation
          "
          aria-label="Disminuir cantidad"
        >
          <Minus className="w-5 h-5" />
        </button>

        <span className="w-10 text-center font-bold text-xl tabular-nums">
          {item.quantity}
        </span>

        <button
          onClick={onIncrement}
          className="
            w-11 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500
            flex items-center justify-center transition-colors
            active:scale-95 active:bg-indigo-700 touch-manipulation
          "
          aria-label="Aumentar cantidad"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Remove button - larger touch target */}
      <button
        onClick={onRemove}
        className="
          w-11 h-11 rounded-xl bg-red-600/20 hover:bg-red-600
          text-red-400 hover:text-white
          flex items-center justify-center transition-all
          active:scale-95 touch-manipulation
        "
        aria-label="Eliminar item"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}
