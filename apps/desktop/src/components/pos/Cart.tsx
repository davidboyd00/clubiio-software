import { useState } from 'react';
import { ShoppingCart, Trash2, AlertTriangle, Tag, Percent, Clock, Banknote, CreditCard, MoreHorizontal } from 'lucide-react';
import { CartItem } from './CartItem';
import { useCart } from '../../hooks/useCart';
import { DiscountModal } from './DiscountModal';
import { CustomerSelector, Customer } from './CustomerSelector';

interface CartProps {
  onCheckout: (customer: Customer | null) => void;
  onQuickCash?: (customer: Customer | null) => void;
  onQuickCard?: (customer: Customer | null) => void;
  onClear: () => void;
  disabled?: boolean;
  onDiscountOpen?: () => void;
}

export function Cart({ onCheckout, onQuickCash, onQuickCard, onClear, disabled, onDiscountOpen }: CartProps) {
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const {
    items,
    subtotal,
    originalSubtotal,
    total,
    itemCount,
    discountAmount,
    promotionDiscount,
    hasAlcoholicItems,
    hasActivePromotions,
    activePromotions,
    isEmpty,
    incrementQuantity,
    decrementQuantity,
    removeItem,
    setDiscount,
    clearDiscount,
  } = useCart();

  const handleApplyDiscount = (discount: { type: 'percentage' | 'fixed'; value: number }) => {
    setDiscount(discount.value, discount.type);
  };

  const handleOpenDiscount = () => {
    setShowDiscountModal(true);
    onDiscountOpen?.();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold">Orden Actual</span>
          {itemCount > 0 && (
            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {itemCount}
            </span>
          )}
        </div>
        {!isEmpty && (
          <button
            onClick={onClear}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
            title="Vaciar carrito"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Active Promotions Banner */}
      {hasActivePromotions && (
        <div className="px-4 py-2 bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-b border-green-600/30">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-green-400">
              <Percent className="w-4 h-4" />
              <span className="text-sm font-medium">
                {activePromotions.length === 1
                  ? activePromotions[0].name
                  : `${activePromotions.length} promociones activas`}
              </span>
            </div>
            <Clock className="w-3 h-3 text-green-400/60 ml-auto" />
          </div>
        </div>
      )}

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <ShoppingCart className="w-16 h-16 mb-3 opacity-30" />
            <p className="text-lg">Carrito vacío</p>
            <p className="text-sm mt-1">Selecciona productos para agregar</p>
          </div>
        ) : (
          <>
            {/* Alcoholic warning */}
            {hasAlcoholicItems && (
              <div className="flex items-center gap-2 p-3 bg-amber-600/20 border border-amber-600/30 rounded-lg mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-xs text-amber-300">
                  Contiene bebidas alcohólicas. Verificar edad.
                </span>
              </div>
            )}

            {items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onIncrement={() => incrementQuantity(item.productId)}
                onDecrement={() => decrementQuantity(item.productId)}
                onRemove={() => removeItem(item.productId)}
              />
            ))}
          </>
        )}
      </div>

      {/* Footer - Totals & Actions */}
      <div className="p-4 border-t border-slate-700 space-y-3 bg-slate-800/50">
        {/* Customer Selector */}
        {!isEmpty && (
          <CustomerSelector
            selectedCustomer={selectedCustomer}
            onSelect={setSelectedCustomer}
            compact
          />
        )}

        {/* Discount Button */}
        {!isEmpty && (
          <div className="flex gap-2">
            {discountAmount > 0 ? (
              <button
                onClick={clearDiscount}
                className="flex-1 py-2 px-3 bg-green-600/20 border border-green-600/30 text-green-400 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-green-600/30 transition-colors"
              >
                <Tag className="w-4 h-4" />
                -{formatPrice(discountAmount)} aplicado
              </button>
            ) : (
              <button
                onClick={handleOpenDiscount}
                className="flex-1 py-2 px-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2 text-slate-300 transition-colors"
              >
                <Tag className="w-4 h-4" />
                Descuento
              </button>
            )}
          </div>
        )}

        {/* Subtotal and Discounts */}
        {(promotionDiscount > 0 || discountAmount > 0) && (
          <>
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Subtotal</span>
              <span>{formatPrice(originalSubtotal)}</span>
            </div>
            {promotionDiscount > 0 && (
              <div className="flex items-center justify-between text-sm text-green-400">
                <span className="flex items-center gap-1">
                  <Percent className="w-3 h-3" />
                  Promoción
                </span>
                <span>-{formatPrice(promotionDiscount)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm text-green-400">
                <span>Descuento manual</span>
                <span>-{formatPrice(discountAmount)}</span>
              </div>
            )}
          </>
        )}

        {/* Total */}
        <div className="flex items-center justify-between text-2xl font-bold">
          <span>Total</span>
          <span className="text-indigo-400">{formatPrice(total)}</span>
        </div>

        {/* Quick Payment Buttons - 2 taps to complete sale */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onQuickCash?.(selectedCustomer)}
            disabled={isEmpty || disabled || !onQuickCash}
            className="
              py-4 rounded-xl font-bold text-base
              bg-green-600 hover:bg-green-500
              active:bg-green-700 active:scale-[0.98]
              disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed
              transition-all duration-100 touch-manipulation
              flex items-center justify-center gap-2
            "
          >
            <Banknote className="w-5 h-5" />
            <span>Efectivo</span>
          </button>
          <button
            onClick={() => onQuickCard?.(selectedCustomer)}
            disabled={isEmpty || disabled || !onQuickCard}
            className="
              py-4 rounded-xl font-bold text-base
              bg-blue-600 hover:bg-blue-500
              active:bg-blue-700 active:scale-[0.98]
              disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed
              transition-all duration-100 touch-manipulation
              flex items-center justify-center gap-2
            "
          >
            <CreditCard className="w-5 h-5" />
            <span>Tarjeta</span>
          </button>
        </div>

        {/* More Options Button (Mixed payment, etc) */}
        <button
          onClick={() => onCheckout(selectedCustomer)}
          disabled={isEmpty || disabled}
          className="
            w-full py-3 rounded-xl font-medium text-sm
            bg-slate-700 hover:bg-slate-600
            active:bg-slate-800 active:scale-[0.98]
            disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed
            transition-all duration-100 touch-manipulation
            flex items-center justify-center gap-2 text-slate-300
          "
        >
          <MoreHorizontal className="w-4 h-4" />
          <span>Más opciones {!isEmpty && `(${formatPrice(total)})`}</span>
        </button>
      </div>

      {/* Discount Modal */}
      <DiscountModal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        onApply={handleApplyDiscount}
        currentTotal={subtotal}
      />
    </div>
  );
}
