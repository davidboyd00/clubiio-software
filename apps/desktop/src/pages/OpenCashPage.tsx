import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, DollarSign, LogOut } from 'lucide-react';
import { CashRegisterSelector } from '../components/cash';
import { useCashSession } from '../hooks/useCashSession';
import { useAuth } from '../hooks/useAuth';

export function OpenCashPage() {
  const navigate = useNavigate();
  const { user, logout, cashSessionId } = useAuth();
  const {
    cashRegisters,
    isLoading,
    error,
    openSession,
    loadCashRegisters,
  } = useCashSession();

  const [selectedRegisterId, setSelectedRegisterId] = useState<string | null>(null);
  const [openingAmount, setOpeningAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Redirect if already has active session
  useEffect(() => {
    if (cashSessionId) {
      navigate('/pos');
    }
  }, [cashSessionId, navigate]);

  // Load cash registers
  useEffect(() => {
    loadCashRegisters();
  }, [loadCashRegisters]);

  const handleOpenCash = async () => {
    if (!selectedRegisterId) {
      setLocalError('Selecciona una caja');
      return;
    }
    if (!openingAmount || parseFloat(openingAmount) < 0) {
      setLocalError('Ingresa el monto inicial');
      return;
    }

    setIsOpening(true);
    setLocalError(null);

    const success = await openSession(
      selectedRegisterId,
      parseFloat(openingAmount),
      notes || undefined
    );

    setIsOpening(false);

    if (success) {
      navigate('/pos');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatPrice = (value: string) => {
    const num = parseInt(value) || 0;
    return new Intl.NumberFormat('es-CL').format(num);
  };

  const quickAmounts = [0, 10000, 20000, 50000, 100000];

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <div>
            <h1 className="font-semibold">Clubio TPV</h1>
            <p className="text-xs text-slate-400">Apertura de Caja</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">{user?.firstName}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Title */}
          <div className="text-center">
            <div className="w-20 h-20 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-10 h-10 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Abrir Caja</h2>
            <p className="text-slate-400">
              Selecciona una caja e ingresa el monto inicial
            </p>
          </div>

          {/* Error */}
          {(error || localError) && (
            <div className="p-4 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400">
              {error || localError}
            </div>
          )}

          {/* Cash Register Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Caja Registradora
            </label>
            <CashRegisterSelector
              registers={cashRegisters}
              selectedId={selectedRegisterId}
              onSelect={setSelectedRegisterId}
              isLoading={isLoading}
              disabled={isOpening}
            />
          </div>

          {/* Opening Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Monto Inicial en Efectivo
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                $
              </span>
              <input
                type="number"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                disabled={isOpening}
                className="w-full pl-10 pr-4 py-4 bg-slate-700 border border-slate-600 rounded-xl text-white text-2xl font-bold text-right focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                placeholder="0"
                min="0"
              />
            </div>
            {openingAmount && (
              <p className="text-right text-sm text-slate-400 mt-1">
                {formatPrice(openingAmount)} CLP
              </p>
            )}
          </div>

          {/* Quick Amounts */}
          <div className="grid grid-cols-5 gap-2">
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => setOpeningAmount(amount.toString())}
                disabled={isOpening}
                className={`
                  py-2 rounded-lg text-sm font-medium transition-colors
                  ${openingAmount === amount.toString()
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }
                  disabled:opacity-50
                `}
              >
                {amount === 0 ? '$0' : `$${amount / 1000}k`}
              </button>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isOpening}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50 resize-none"
              placeholder="Observaciones al abrir la caja..."
              rows={2}
            />
          </div>

          {/* Open Button */}
          <button
            onClick={handleOpenCash}
            disabled={isOpening || !selectedRegisterId}
            className="
              w-full py-4 rounded-xl font-bold text-lg
              bg-gradient-to-r from-indigo-600 to-purple-600
              hover:from-indigo-500 hover:to-purple-500
              disabled:from-slate-700 disabled:to-slate-700
              disabled:text-slate-500
              transition-all flex items-center justify-center gap-3
            "
          >
            {isOpening ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Abriendo caja...
              </>
            ) : (
              <>
                <DollarSign className="w-6 h-6" />
                Abrir Caja
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
