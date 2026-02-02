import { useState } from 'react';
import { X, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

interface CashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: 'IN' | 'OUT', amount: number, reason: string) => Promise<boolean>;
}

export function CashMovementModal({
  isOpen,
  onClose,
  onConfirm,
}: CashMovementModalProps) {
  const [type, setType] = useState<'IN' | 'OUT'>('OUT');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Ingresa un monto válido');
      return;
    }
    if (!reason.trim()) {
      setError('La razón es obligatoria');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const success = await onConfirm(type, parseFloat(amount), reason.trim());
      if (success) {
        setAmount('');
        setReason('');
        onClose();
      }
    } catch (err) {
      setError('Error al registrar movimiento');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setAmount('');
      setReason('');
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-slate-700">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold">Movimiento de Caja</h2>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Type Selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setType('IN')}
              disabled={isProcessing}
              className={`
                p-4 rounded-xl border-2 flex flex-col items-center gap-2
                transition-all
                ${type === 'IN'
                  ? 'border-emerald-500 bg-emerald-600/20'
                  : 'border-slate-600 hover:border-slate-500'
                }
              `}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                type === 'IN' ? 'bg-emerald-600/30' : 'bg-slate-700'
              }`}>
                <TrendingUp className={`w-6 h-6 ${type === 'IN' ? 'text-emerald-400' : 'text-slate-400'}`} />
              </div>
              <span className={`font-medium ${type === 'IN' ? 'text-emerald-400' : 'text-slate-300'}`}>
                Ingreso
              </span>
            </button>

            <button
              onClick={() => setType('OUT')}
              disabled={isProcessing}
              className={`
                p-4 rounded-xl border-2 flex flex-col items-center gap-2
                transition-all
                ${type === 'OUT'
                  ? 'border-orange-500 bg-orange-600/20'
                  : 'border-slate-600 hover:border-slate-500'
                }
              `}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                type === 'OUT' ? 'bg-orange-600/30' : 'bg-slate-700'
              }`}>
                <TrendingDown className={`w-6 h-6 ${type === 'OUT' ? 'text-orange-400' : 'text-slate-400'}`} />
              </div>
              <span className={`font-medium ${type === 'OUT' ? 'text-orange-400' : 'text-slate-300'}`}>
                Retiro
              </span>
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Monto
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white text-xl font-bold text-center focus:border-indigo-500 focus:outline-none disabled:opacity-50"
              placeholder="0"
              min="0"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Razón <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50 resize-none"
              placeholder="Ej: Pago a proveedor, cambio de monedas, etc."
              rows={3}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing || !amount || !reason.trim()}
            className={`
              flex-1 py-3 rounded-xl font-semibold transition-colors
              disabled:opacity-50 flex items-center justify-center gap-2
              ${type === 'IN'
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-orange-600 hover:bg-orange-500'
              }
            `}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Procesando...
              </>
            ) : (
              `Registrar ${type === 'IN' ? 'Ingreso' : 'Retiro'}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
