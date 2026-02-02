import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock, ArrowLeft, AlertTriangle } from 'lucide-react';
import {
  SessionSummary,
  PaymentBreakdown,
  DifferenceIndicator,
} from '../components/cash';
import { useCashSession } from '../hooks/useCashSession';
import { useAuth } from '../hooks/useAuth';

export function CloseCashPage() {
  const navigate = useNavigate();
  const { user, cashSessionId } = useAuth();
  const {
    currentSession,
    sessionSummary,
    isLoading,
    error,
    closeSession,
    refreshSummary,
  } = useCashSession();

  const [closingAmount, setClosingAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Redirect if no active session
  useEffect(() => {
    if (!cashSessionId && !isLoading) {
      navigate('/open-cash');
    }
  }, [cashSessionId, isLoading, navigate]);

  // Refresh summary on mount
  useEffect(() => {
    refreshSummary();
  }, [refreshSummary]);

  // Get values from the new structure
  const expectedCash = sessionSummary?.summary?.expectedCash ?? currentSession?.initialAmount ?? 0;
  const initialAmount = currentSession?.initialAmount ?? 0;
  const totalOrders = sessionSummary?.summary?.totalOrders ?? 0;
  const totalSales = sessionSummary?.summary?.totalSales ?? 0;

  // Extract payment breakdowns
  const cashPayments = sessionSummary?.summary?.paymentsByMethod?.find(p => p.method === 'CASH')?.amount ?? 0;
  const cardPayments = sessionSummary?.summary?.paymentsByMethod?.find(p => p.method === 'CARD')?.amount ?? 0;
  const voucherPayments = sessionSummary?.summary?.paymentsByMethod?.find(p => p.method === 'VOUCHER')?.amount ?? 0;

  // Extract movement totals
  const depositsTotal = sessionSummary?.summary?.movements?.find(m => m.type === 'DEPOSIT')?.amount ?? 0;
  const withdrawalsTotal = sessionSummary?.summary?.movements?.find(m => m.type === 'WITHDRAWAL')?.amount ?? 0;

  const closingAmountNum = parseFloat(closingAmount) || 0;
  const difference = closingAmountNum - expectedCash;

  const handleClose = async () => {
    if (!closingAmount || closingAmountNum < 0) {
      setLocalError('Ingresa el monto contado');
      return;
    }

    // Show confirmation if there's a significant difference
    if (Math.abs(difference) > 1000 && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    setIsClosing(true);
    setLocalError(null);

    const success = await closeSession(closingAmountNum, notes || undefined);

    setIsClosing(false);

    if (success) {
      navigate('/login');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (isLoading && !sessionSummary) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-400">Cargando resumen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/pos')}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold">Cerrar Caja</h1>
            <p className="text-xs text-slate-400">
              {currentSession?.cashRegister?.name || 'Sesion activa'}
            </p>
          </div>
        </div>
        <div className="text-sm text-slate-400">
          {user?.firstName} {user?.lastName}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Session Summary */}
          {currentSession && (
            <SessionSummary
              openedAt={currentSession.openedAt}
              cashRegisterName={currentSession.cashRegister?.name || 'Caja'}
              userName={`${user?.firstName} ${user?.lastName}`}
              totalOrders={totalOrders}
              totalSales={totalSales}
              openingAmount={initialAmount}
            />
          )}

          {/* Payment Breakdown */}
          {currentSession && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="font-semibold mb-4">Desglose de Ventas</h3>
              <PaymentBreakdown
                cashPayments={cashPayments}
                cardPayments={cardPayments}
                voucherPayments={voucherPayments}
                cashMovementsIn={depositsTotal}
                cashMovementsOut={withdrawalsTotal}
                openingAmount={initialAmount}
              />
            </div>
          )}

          {/* Closing Amount Input */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <h3 className="font-semibold mb-4">Cierre de Caja</h3>

            <div className="space-y-4">
              {/* Expected amount */}
              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <span className="text-slate-400">Efectivo esperado</span>
                <span className="text-xl font-bold text-green-400">
                  {formatPrice(expectedCash)}
                </span>
              </div>

              {/* Closing amount input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Monto contado en caja
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                    $
                  </span>
                  <input
                    type="number"
                    value={closingAmount}
                    onChange={(e) => {
                      setClosingAmount(e.target.value);
                      setShowConfirm(false);
                    }}
                    disabled={isClosing}
                    className="w-full pl-10 pr-4 py-4 bg-slate-700 border border-slate-600 rounded-xl text-white text-2xl font-bold text-right focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              {/* Difference indicator */}
              {closingAmount && (
                <DifferenceIndicator
                  expected={expectedCash}
                  actual={closingAmountNum}
                  size="md"
                />
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Notas de cierre (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isClosing}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50 resize-none"
                  placeholder="Observaciones al cerrar la caja..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {(error || localError) && (
            <div className="p-4 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400">
              {error || localError}
            </div>
          )}

          {/* Confirmation Warning */}
          {showConfirm && Math.abs(difference) > 1000 && (
            <div className="p-4 bg-amber-600/20 border border-amber-600/30 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-400 mb-1">
                    Diferencia detectada
                  </p>
                  <p className="text-sm text-amber-300/80">
                    Hay una diferencia de {formatPrice(Math.abs(difference))}.
                    ¿Estas seguro de cerrar la caja con este monto?
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={handleClose}
            disabled={isClosing || !closingAmount}
            className="
              w-full py-4 rounded-xl font-bold text-lg
              bg-gradient-to-r from-red-600 to-orange-600
              hover:from-red-500 hover:to-orange-500
              disabled:from-slate-700 disabled:to-slate-700
              disabled:text-slate-500
              transition-all flex items-center justify-center gap-3
            "
          >
            {isClosing ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Cerrando caja...
              </>
            ) : showConfirm ? (
              <>
                <AlertTriangle className="w-6 h-6" />
                Confirmar Cierre
              </>
            ) : (
              <>
                <Lock className="w-6 h-6" />
                Cerrar Caja
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
