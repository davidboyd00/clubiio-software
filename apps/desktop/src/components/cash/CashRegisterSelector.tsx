import { useState } from 'react';
import { ChevronDown, Monitor, Check } from 'lucide-react';
import { CashRegister } from '../../lib/api';

interface CashRegisterSelectorProps {
  registers: CashRegister[];
  selectedId: string | null;
  onSelect: (registerId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function CashRegisterSelector({
  registers,
  selectedId,
  onSelect,
  isLoading,
  disabled,
}: CashRegisterSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedRegister = registers.find((r) => r.id === selectedId);

  if (isLoading) {
    return (
      <div className="w-full h-14 bg-slate-700 rounded-xl animate-pulse" />
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-4 py-4 bg-slate-700 border border-slate-600 rounded-xl
          flex items-center justify-between
          transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-500'}
          ${isOpen ? 'border-indigo-500' : ''}
        `}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center">
            <Monitor className="w-5 h-5 text-slate-300" />
          </div>
          <div className="text-left">
            {selectedRegister ? (
              <>
                <p className="font-medium text-white">{selectedRegister.name}</p>
                <p className="text-sm text-slate-400">Caja seleccionada</p>
              </>
            ) : (
              <>
                <p className="text-slate-400">Seleccionar caja</p>
                <p className="text-sm text-slate-500">
                  {registers.length} disponibles
                </p>
              </>
            )}
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
            {registers.length === 0 ? (
              <div className="p-4 text-center text-slate-400">
                No hay cajas disponibles
              </div>
            ) : (
              registers.map((register) => (
                <button
                  key={register.id}
                  onClick={() => {
                    onSelect(register.id);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full px-4 py-3 flex items-center justify-between
                    transition-colors
                    ${selectedId === register.id
                      ? 'bg-indigo-600/20 text-indigo-400'
                      : 'hover:bg-slate-700 text-white'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Monitor className="w-5 h-5" />
                    <span className="font-medium">{register.name}</span>
                  </div>
                  {selectedId === register.id && (
                    <Check className="w-5 h-5 text-indigo-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
