import { useState, useEffect } from 'react';
import {
  X,
  Banknote,
  CreditCard,
  Shuffle,
  Loader2,
  CheckCircle,
  Printer,
  ArrowLeft,
  User,
  Star,
} from 'lucide-react';
import { QuickAmountButtons } from './QuickAmountButtons';
import { useCart, CartItem } from '../../hooks/useCart';
import { Customer } from './CustomerSelector';
import { Order } from '../../lib/api';
import { printReceipt } from '../../lib/print';

type PaymentMethod = 'CASH' | 'CARD' | 'MIXED';
type PaymentStep = 'method' | 'cash' | 'card' | 'mixed' | 'success';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payments: Array<{ method: 'CASH' | 'CARD' | 'VOUCHER'; amount: number }>) => Promise<Order | null>;
  total: number;
  items: CartItem[];
  customer?: Customer | null;
}

export function PaymentModal({
  isOpen,
  onClose,
  onConfirm,
  total,
  items,
  customer,
}: PaymentModalProps) {
  const [step, setStep] = useState<PaymentStep>('method');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const { clear: clearCart } = useCart();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('method');
      setPaymentMethod('CASH');
      setCashAmount(0);
      setCardAmount(0);
      setIsProcessing(false);
      setIsPrinting(false);
      setCompletedOrder(null);
    }
  }, [isOpen]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Calculate change
  const totalPaid = paymentMethod === 'MIXED' ? cashAmount + cardAmount : cashAmount;
  const change = Math.max(0, totalPaid - total);
  const remaining = Math.max(0, total - totalPaid);

  const canConfirm = () => {
    switch (paymentMethod) {
      case 'CASH':
        return cashAmount >= total;
      case 'CARD':
        return true; // Card always pays exact amount
      case 'MIXED':
        return cashAmount + cardAmount >= total;
      default:
        return false;
    }
  };

  const handleMethodSelect = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setCashAmount(0);
    setCardAmount(0);

    switch (method) {
      case 'CASH':
        setStep('cash');
        break;
      case 'CARD':
        setStep('card');
        break;
      case 'MIXED':
        setStep('mixed');
        break;
    }
  };

  const handleConfirm = async () => {
    setIsProcessing(true);

    try {
      const payments: Array<{ method: 'CASH' | 'CARD' | 'VOUCHER'; amount: number }> = [];

      switch (paymentMethod) {
        case 'CASH':
          payments.push({ method: 'CASH', amount: total });
          break;
        case 'CARD':
          payments.push({ method: 'CARD', amount: total });
          break;
        case 'MIXED':
          if (cashAmount > 0) {
            payments.push({ method: 'CASH', amount: Math.min(cashAmount, total) });
          }
          if (cardAmount > 0) {
            const cardPortion = total - Math.min(cashAmount, total);
            if (cardPortion > 0) {
              payments.push({ method: 'CARD', amount: cardPortion });
            }
          }
          break;
      }

      const order = await onConfirm(payments);

      if (order) {
        setCompletedOrder(order);
        setStep('success');

        // Auto-print if enabled
        const settings = loadPrintSettings();
        if (settings.autoPrint && settings.printerEnabled) {
          handlePrint(order);
        }
      }
    } catch (error) {
      console.error('Payment failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Load print settings from localStorage
  const loadPrintSettings = () => {
    const stored = localStorage.getItem('clubio_settings');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return {};
      }
    }
    return {};
  };

  const handlePrint = async (order?: Order) => {
    const orderToPrint = order || completedOrder;
    if (!orderToPrint) return;

    setIsPrinting(true);
    try {
      const settings = loadPrintSettings();

      // Build print config from settings
      const printConfig = {
        businessName: settings.businessName || 'Clubio',
        businessAddress: settings.businessAddress || '',
        businessPhone: settings.businessPhone || '',
        businessRut: settings.businessRut || '',
        footerMessage: 'Gracias por su compra!',
        printerWidth: settings.printerWidth === '58mm' ? 32 : 48,
      };

      // Ensure order has items with product names for printing
      const orderWithItems: Order = {
        ...orderToPrint,
        items: orderToPrint.items || items.map((item, index) => ({
          id: `item-${index}`,
          orderId: orderToPrint.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.price * item.quantity,
          product: {
            id: item.productId,
            categoryId: null,
            name: item.name,
            shortName: item.shortName || null,
            price: item.price,
            isAlcoholic: false,
            barcode: null,
            isActive: true,
            venueId: '',
          },
        })),
      };

      await printReceipt(orderWithItems, printConfig);
    } catch (error) {
      console.error('Print failed:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleFinish = () => {
    clearCart();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={step !== 'success' ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step !== 'method' && step !== 'success' && (
              <button
                onClick={() => setStep('method')}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-xl font-bold">
              {step === 'success' ? 'Pago Completado' : 'Cobrar'}
            </h2>
          </div>
          {step !== 'success' && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Total Display */}
          {step !== 'success' && (
            <div className="text-center mb-6">
              <div className="text-slate-400 text-sm mb-1">Total a cobrar</div>
              <div className="text-4xl font-bold text-indigo-400">
                {formatPrice(total)}
              </div>
            </div>
          )}

          {/* Step: Method Selection */}
          {step === 'method' && (
            <div className="space-y-3">
              <button
                onClick={() => handleMethodSelect('CASH')}
                className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center gap-4 transition-colors"
              >
                <div className="w-12 h-12 bg-green-600/20 rounded-xl flex items-center justify-center">
                  <Banknote className="w-6 h-6 text-green-400" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">Efectivo</div>
                  <div className="text-sm text-slate-400">Pago en dinero</div>
                </div>
              </button>

              <button
                onClick={() => handleMethodSelect('CARD')}
                className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center gap-4 transition-colors"
              >
                <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">Tarjeta</div>
                  <div className="text-sm text-slate-400">Débito o crédito</div>
                </div>
              </button>

              <button
                onClick={() => handleMethodSelect('MIXED')}
                className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center gap-4 transition-colors"
              >
                <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center">
                  <Shuffle className="w-6 h-6 text-purple-400" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">Mixto</div>
                  <div className="text-sm text-slate-400">Efectivo + Tarjeta</div>
                </div>
              </button>
            </div>
          )}

          {/* Step: Cash Payment */}
          {step === 'cash' && (
            <div className="space-y-6">
              <QuickAmountButtons
                onSelect={setCashAmount}
                currentAmount={cashAmount}
                total={total}
              />

              {/* Custom amount input */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  O ingresa el monto recibido
                </label>
                <input
                  type="number"
                  value={cashAmount || ''}
                  onChange={(e) => setCashAmount(Number(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white text-xl font-bold text-center focus:border-indigo-500 focus:outline-none"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Change calculation */}
              {cashAmount > 0 && (
                <div className="bg-slate-700/50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recibido</span>
                    <span className="font-semibold">{formatPrice(cashAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total</span>
                    <span className="font-semibold">{formatPrice(total)}</span>
                  </div>
                  <div className="border-t border-slate-600 pt-2 flex justify-between">
                    <span className={change > 0 ? 'text-green-400' : 'text-red-400'}>
                      {change > 0 ? 'Vuelto' : 'Falta'}
                    </span>
                    <span className={`text-xl font-bold ${change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPrice(change > 0 ? change : remaining)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Card Payment */}
          {step === 'card' && (
            <div className="space-y-6">
              <div className="bg-slate-700/50 rounded-xl p-6 text-center">
                <CreditCard className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Pago con Tarjeta</p>
                <p className="text-slate-400 text-sm">
                  El monto exacto será cobrado: {formatPrice(total)}
                </p>
              </div>
            </div>
          )}

          {/* Step: Mixed Payment */}
          {step === 'mixed' && (
            <div className="space-y-6">
              {/* Cash portion */}
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                  <Banknote className="w-4 h-4" />
                  Monto en efectivo
                </label>
                <input
                  type="number"
                  value={cashAmount || ''}
                  onChange={(e) => setCashAmount(Number(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white text-lg font-bold focus:border-indigo-500 focus:outline-none"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Card portion */}
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                  <CreditCard className="w-4 h-4" />
                  Monto con tarjeta
                </label>
                <input
                  type="number"
                  value={cardAmount || ''}
                  onChange={(e) => setCardAmount(Number(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white text-lg font-bold focus:border-indigo-500 focus:outline-none"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Summary */}
              <div className="bg-slate-700/50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Efectivo</span>
                  <span>{formatPrice(cashAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Tarjeta</span>
                  <span>{formatPrice(cardAmount)}</span>
                </div>
                <div className="border-t border-slate-600 pt-2 flex justify-between">
                  <span className="text-slate-400">Total pagado</span>
                  <span className="font-semibold">{formatPrice(cashAmount + cardAmount)}</span>
                </div>
                {remaining > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Falta</span>
                    <span className="font-bold">{formatPrice(remaining)}</span>
                  </div>
                )}
                {change > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Vuelto</span>
                    <span className="font-bold">{formatPrice(change)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>

              <div>
                <p className="text-2xl font-bold text-green-400 mb-2">
                  ¡Pago Exitoso!
                </p>
                {completedOrder && (
                  <p className="text-slate-400">
                    Orden #{completedOrder.orderNumber}
                  </p>
                )}
              </div>

              {/* Customer info if present */}
              {customer && (
                <div className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600/20 border border-indigo-600/30 rounded-xl">
                  <User className="w-4 h-4 text-indigo-400" />
                  <span className="text-indigo-300">
                    {customer.firstName} {customer.lastName}
                  </span>
                  {customer.isVip && <Star className="w-4 h-4 text-amber-400" />}
                </div>
              )}

              {change > 0 && (
                <div className="bg-green-600/20 border border-green-600/30 rounded-xl p-4">
                  <p className="text-sm text-green-300 mb-1">Vuelto a entregar</p>
                  <p className="text-3xl font-bold text-green-400">
                    {formatPrice(change)}
                  </p>
                </div>
              )}

              {/* Order summary */}
              <div className="bg-slate-700/50 rounded-xl p-4 text-left">
                <p className="text-sm text-slate-400 mb-2">Resumen</p>
                {items.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex justify-between text-sm py-1">
                    <span>{item.quantity}x {item.shortName || item.name}</span>
                    <span>{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
                {items.length > 3 && (
                  <p className="text-xs text-slate-500 mt-1">
                    +{items.length - 3} más...
                  </p>
                )}
                <div className="border-t border-slate-600 mt-2 pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-3">
          {step === 'success' ? (
            <>
              <button
                onClick={() => handlePrint()}
                disabled={isPrinting}
                className="flex-1 py-3 rounded-xl font-semibold bg-slate-700 hover:bg-slate-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isPrinting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Imprimiendo...
                  </>
                ) : (
                  <>
                    <Printer className="w-5 h-5" />
                    Imprimir
                  </>
                )}
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 py-3 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 transition-colors"
              >
                Nueva Venta
              </button>
            </>
          ) : step !== 'method' ? (
            <button
              onClick={handleConfirm}
              disabled={!canConfirm() || isProcessing}
              className="
                w-full py-4 rounded-xl font-bold text-lg
                bg-green-600 hover:bg-green-500
                disabled:bg-slate-700 disabled:text-slate-500
                transition-colors flex items-center justify-center gap-2
              "
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirmar Pago
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
