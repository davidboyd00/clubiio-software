import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  X,
  XCircle,
  CreditCard,
  Banknote,
  Ticket,
  AlertTriangle,
  Loader2,
  Printer,
} from 'lucide-react';
import { Order } from '../../lib/api';

interface OrderDetailModalProps {
  order: Order;
  onClose: () => void;
  onVoid: (orderId: string, reason: string) => Promise<void>;
  onPrint: () => void;
}

export function OrderDetailModal({ order, onClose, onVoid, onPrint }: OrderDetailModalProps) {
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const isVoided = order.status === 'VOIDED';

  const handleVoid = async () => {
    if (!voidReason.trim()) return;

    setIsVoiding(true);
    await onVoid(order.id, voidReason);
    setIsVoiding(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'CASH':
        return <Banknote className="w-4 h-4" />;
      case 'CARD':
        return <CreditCard className="w-4 h-4" />;
      case 'VOUCHER':
        return <Ticket className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case 'CASH':
        return 'Efectivo';
      case 'CARD':
        return 'Tarjeta';
      case 'VOUCHER':
        return 'Vale';
      default:
        return method;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-slate-800 rounded-2xl border border-slate-700 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg
              ${isVoided ? 'bg-red-600/20 text-red-400' : 'bg-indigo-600/20 text-indigo-400'}
            `}>
              #{order.orderNumber}
            </div>
            <div>
              <h2 className="text-lg font-bold">Pedido #{order.orderNumber}</h2>
              <p className="text-sm text-slate-400">
                {format(new Date(order.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Status Badge */}
          {isVoided && (
            <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl">
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="w-5 h-5" />
                <span className="font-medium">Pedido Anulado</span>
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="bg-slate-700/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-600">
              <h3 className="font-medium text-sm text-slate-300">Productos</h3>
            </div>
            <div className="divide-y divide-slate-600">
              {order.items?.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center text-sm font-medium">
                      {item.quantity}x
                    </span>
                    <div>
                      <p className="font-medium">{item.product?.name || 'Producto'}</p>
                      <p className="text-sm text-slate-400">
                        {formatPrice(item.unitPrice)} c/u
                      </p>
                    </div>
                  </div>
                  <p className="font-medium">{formatPrice(item.total)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Order Totals */}
          <div className="bg-slate-700/50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-orange-400">
                <span>Descuento</span>
                <span>-{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-600">
              <span>Total</span>
              <span className={isVoided ? 'text-red-400 line-through' : ''}>
                {formatPrice(order.total)}
              </span>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-slate-700/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-600">
              <h3 className="font-medium text-sm text-slate-300">Metodos de Pago</h3>
            </div>
            <div className="divide-y divide-slate-600">
              {order.payments?.map((payment, index) => (
                <div key={index} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`
                      w-8 h-8 rounded-lg flex items-center justify-center
                      ${payment.method === 'CASH' ? 'bg-emerald-600/20 text-emerald-400' :
                        payment.method === 'CARD' ? 'bg-blue-600/20 text-blue-400' :
                        'bg-purple-600/20 text-purple-400'}
                    `}>
                      {getPaymentIcon(payment.method)}
                    </span>
                    <span>{getPaymentLabel(payment.method)}</span>
                  </div>
                  <p className="font-medium">{formatPrice(payment.amount)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Void Confirmation */}
          {showVoidConfirm && !isVoided && (
            <div className="bg-red-600/20 border border-red-600/30 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                <div>
                  <p className="font-medium text-red-400">Anular Pedido</p>
                  <p className="text-sm text-red-300/80">
                    Esta accion no se puede deshacer. El pedido sera marcado como anulado.
                  </p>
                </div>
              </div>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Motivo de anulacion..."
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowVoidConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleVoid}
                  disabled={!voidReason.trim() || isVoiding}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isVoiding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Confirmar Anulacion
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!showVoidConfirm && (
          <div className="p-4 border-t border-slate-700 flex gap-3">
            <button
              onClick={onPrint}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Printer className="w-5 h-5" />
              Imprimir Ticket
            </button>
            {!isVoided && (
              <button
                onClick={() => setShowVoidConfirm(true)}
                className="flex-1 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="w-5 h-5" />
                Anular Pedido
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
