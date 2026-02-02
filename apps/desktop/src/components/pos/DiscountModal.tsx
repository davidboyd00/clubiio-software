import { useState } from 'react';
import { X, Percent, DollarSign, Tag } from 'lucide-react';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (discount: { type: 'percentage' | 'fixed'; value: number }) => void;
  currentTotal: number;
}

export function DiscountModal({ isOpen, onClose, onApply, currentTotal }: DiscountModalProps) {
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApply = () => {
    const numValue = parseFloat(value);

    if (!value || isNaN(numValue) || numValue <= 0) {
      setError('Ingresa un valor válido');
      return;
    }

    if (discountType === 'percentage' && numValue > 100) {
      setError('El porcentaje no puede ser mayor a 100%');
      return;
    }

    if (discountType === 'fixed' && numValue > currentTotal) {
      setError('El descuento no puede ser mayor al total');
      return;
    }

    onApply({ type: discountType, value: numValue });
    setValue('');
    setError(null);
    onClose();
  };

  const previewDiscount = () => {
    const numValue = parseFloat(value) || 0;
    if (discountType === 'percentage') {
      return (currentTotal * numValue) / 100;
    }
    return numValue;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const quickPercentages = [5, 10, 15, 20, 25, 50];
  const quickAmounts = [1000, 2000, 5000, 10000];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600/20 rounded-xl flex items-center justify-center">
              <Tag className="w-5 h-5 text-orange-400" />
            </div>
            <h2 className="text-lg font-bold">Aplicar Descuento</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Discount Type */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setDiscountType('percentage');
                setValue('');
              }}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                discountType === 'percentage'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              <Percent className="w-5 h-5" />
              Porcentaje
            </button>
            <button
              onClick={() => {
                setDiscountType('fixed');
                setValue('');
              }}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                discountType === 'fixed'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              <DollarSign className="w-5 h-5" />
              Monto Fijo
            </button>
          </div>

          {/* Value Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {discountType === 'percentage' ? 'Porcentaje de descuento' : 'Monto de descuento'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                {discountType === 'percentage' ? '%' : '$'}
              </span>
              <input
                type="number"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                className="w-full pl-10 pr-4 py-4 bg-slate-700 border border-slate-600 rounded-xl text-white text-2xl font-bold text-right focus:border-indigo-500 focus:outline-none"
                placeholder="0"
                min="0"
                max={discountType === 'percentage' ? 100 : currentTotal}
                autoFocus
              />
            </div>
          </div>

          {/* Quick Select */}
          <div>
            <p className="text-sm text-slate-400 mb-2">Selección rápida</p>
            <div className="grid grid-cols-4 gap-2">
              {discountType === 'percentage'
                ? quickPercentages.map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setValue(pct.toString())}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        value === pct.toString()
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))
                : quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setValue(amt.toString())}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        value === amt.toString()
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      ${amt / 1000}k
                    </button>
                  ))}
            </div>
          </div>

          {/* Preview */}
          {value && parseFloat(value) > 0 && (
            <div className="p-3 bg-orange-600/20 border border-orange-600/30 rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-orange-300">Descuento a aplicar:</span>
                <span className="font-bold text-orange-400">
                  -{formatPrice(previewDiscount())}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-400">Nuevo total:</span>
                <span className="font-bold text-white">
                  {formatPrice(currentTotal - previewDiscount())}
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={!value || parseFloat(value) <= 0}
            className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl font-medium transition-colors"
          >
            Aplicar Descuento
          </button>
        </div>
      </div>
    </div>
  );
}
