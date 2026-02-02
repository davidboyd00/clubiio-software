import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft,
  Plus,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { CashMovementModal } from '../components/cash';
import { useCashSession } from '../hooks/useCashSession';
import { useAuth } from '../hooks/useAuth';
import { CashMovement } from '../lib/api';

export function CashMovementsPage() {
  const navigate = useNavigate();
  const { cashSessionId } = useAuth();
  const {
    currentSession,
    sessionSummary,
    isLoading,
    addMovement,
    refreshSummary,
  } = useCashSession();

  const [showModal, setShowModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redirect if no active session
  useEffect(() => {
    if (!cashSessionId && !isLoading) {
      navigate('/open-cash');
    }
  }, [cashSessionId, isLoading, navigate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshSummary();
    setIsRefreshing(false);
  };

  const handleAddMovement = async (
    type: 'IN' | 'OUT',
    amount: number,
    reason: string
  ): Promise<boolean> => {
    const success = await addMovement(type, amount, reason);
    if (success) {
      await refreshSummary();
    }
    return success;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Get individual movements from the session (returned by getSummary -> findById)
  const movements: CashMovement[] = sessionSummary?.session?.cashMovements || [];

  // Calculate totals from summary or individual movements
  const totalIn = sessionSummary?.summary?.movements?.find(m => m.type === 'DEPOSIT')?.amount ?? 0;
  const totalOut = sessionSummary?.summary?.movements?.find(m => m.type === 'WITHDRAWAL')?.amount ?? 0;

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
            <h1 className="font-semibold">Movimientos de Caja</h1>
            <p className="text-xs text-slate-400">
              {currentSession?.cashRegister?.name || 'Sesion activa'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="p-4 grid grid-cols-2 gap-4">
        <div className="bg-emerald-600/20 border border-emerald-600/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-600/30 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-emerald-300">Total Ingresos</p>
              <p className="text-xl font-bold text-emerald-400">
                {formatPrice(totalIn)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-orange-600/20 border border-orange-600/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-600/30 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-orange-300">Total Retiros</p>
              <p className="text-xl font-bold text-orange-400">
                {formatPrice(totalOut)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Movements List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading && movements.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <TrendingUp className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">Sin movimientos</p>
            <p className="text-sm mt-1">
              Registra ingresos o retiros de efectivo
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Agregar movimiento
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {movements
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((movement) => (
                <MovementItem key={movement.id} movement={movement} />
              ))}
          </div>
        )}
      </div>

      {/* Add Movement Modal */}
      <CashMovementModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleAddMovement}
      />
    </div>
  );
}

// Movement Item Component
function MovementItem({ movement }: { movement: CashMovement }) {
  const isDeposit = movement.type === 'DEPOSIT';

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-start gap-4">
        <div
          className={`
            w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
            ${isDeposit ? 'bg-emerald-600/20' : 'bg-orange-600/20'}
          `}
        >
          {isDeposit ? (
            <TrendingUp className="w-6 h-6 text-emerald-400" />
          ) : (
            <TrendingDown className="w-6 h-6 text-orange-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">
                {isDeposit ? 'Ingreso' : 'Retiro'} de efectivo
              </p>
              {movement.reason && (
                <p className="text-sm text-slate-400 mt-1">{movement.reason}</p>
              )}
            </div>
            <p
              className={`
                text-lg font-bold flex-shrink-0
                ${isDeposit ? 'text-emerald-400' : 'text-orange-400'}
              `}
            >
              {isDeposit ? '+' : '-'}{formatPrice(movement.amount)}
            </p>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {format(new Date(movement.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
          </p>
        </div>
      </div>
    </div>
  );
}
