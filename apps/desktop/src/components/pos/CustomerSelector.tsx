import { useState, useEffect } from 'react';
import { User, Search, X, Plus, UserCheck, Star } from 'lucide-react';

// Customer type (matching CustomerManagementPage)
export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  rut?: string;
  notes?: string;
  totalPurchases: number;
  lastPurchaseAt?: string;
  isVip: boolean;
  createdAt: string;
}

const CUSTOMERS_KEY = 'clubio_customers';

// Load customers from localStorage
function loadCustomers(): Customer[] {
  const stored = localStorage.getItem(CUSTOMERS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

// Save customers to localStorage
function saveCustomers(customers: Customer[]) {
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
}

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  onSelect: (customer: Customer | null) => void;
  compact?: boolean;
}

export function CustomerSelector({ selectedCustomer, onSelect, compact = false }: CustomerSelectorProps) {
  const [showModal, setShowModal] = useState(false);

  if (compact && selectedCustomer) {
    return (
      <>
        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-600/20 border border-indigo-600/30 rounded-lg">
          <UserCheck className="w-4 h-4 text-indigo-400" />
          <span className="text-sm text-indigo-300 truncate flex-1">
            {selectedCustomer.firstName} {selectedCustomer.lastName}
            {selectedCustomer.isVip && <Star className="w-3 h-3 inline ml-1 text-amber-400" />}
          </span>
          <button
            onClick={() => setShowModal(true)}
            className="p-1 hover:bg-indigo-600/30 rounded transition-colors text-xs text-indigo-400"
          >
            Cambiar
          </button>
          <button
            onClick={() => onSelect(null)}
            className="p-1 hover:bg-indigo-600/30 rounded transition-colors"
          >
            <X className="w-4 h-4 text-indigo-400" />
          </button>
        </div>
        {/* Modal must be rendered outside the early return */}
        {showModal && (
          <CustomerSelectionModal
            onSelect={(customer) => {
              onSelect(customer);
              setShowModal(false);
            }}
            onClose={() => setShowModal(false)}
            currentCustomerId={selectedCustomer?.id}
          />
        )}
      </>
    );
  }

  if (compact) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors w-full"
        >
          <User className="w-4 h-4" />
          <span>Agregar cliente (opcional)</span>
        </button>
        {/* Modal must be rendered outside the early return */}
        {showModal && (
          <CustomerSelectionModal
            onSelect={(customer) => {
              onSelect(customer);
              setShowModal(false);
            }}
            onClose={() => setShowModal(false)}
            currentCustomerId={undefined}
          />
        )}
      </>
    );
  }

  return (
    <>
      {selectedCustomer ? (
        <div className="flex items-center gap-3 p-3 bg-indigo-600/20 border border-indigo-600/30 rounded-xl">
          <div className="w-10 h-10 bg-indigo-600/30 rounded-xl flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">
                {selectedCustomer.firstName} {selectedCustomer.lastName}
              </p>
              {selectedCustomer.isVip && (
                <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-indigo-300 truncate">
              {selectedCustomer.rut || selectedCustomer.email || selectedCustomer.phone || 'Sin datos'}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-1.5 text-sm bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded-lg transition-colors"
          >
            Cambiar
          </button>
          <button
            onClick={() => onSelect(null)}
            className="p-2 hover:bg-indigo-600/30 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-indigo-400" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowModal(true)}
          className="w-full flex items-center justify-center gap-2 p-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 border-dashed rounded-xl text-slate-400 transition-colors"
        >
          <User className="w-5 h-5" />
          <span>Agregar cliente (opcional)</span>
        </button>
      )}

      {/* Customer Selection Modal */}
      {showModal && (
        <CustomerSelectionModal
          onSelect={(customer) => {
            onSelect(customer);
            setShowModal(false);
          }}
          onClose={() => setShowModal(false)}
          currentCustomerId={selectedCustomer?.id}
        />
      )}
    </>
  );
}

// Customer Selection Modal
function CustomerSelectionModal({
  onSelect,
  onClose,
  currentCustomerId,
}: {
  onSelect: (customer: Customer | null) => void;
  onClose: () => void;
  currentCustomerId?: string;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickRegister, setShowQuickRegister] = useState(false);

  // Load customers
  useEffect(() => {
    setCustomers(loadCustomers());
  }, []);

  // Filter customers
  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(query) ||
      c.lastName.toLowerCase().includes(query) ||
      c.rut?.toLowerCase().includes(query) ||
      c.phone?.includes(query)
    );
  });

  // Check if search looks like a RUT
  const looksLikeRut = /^\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]?$/.test(searchQuery.replace(/\s/g, ''));
  const existingByRut = customers.find(c =>
    c.rut?.replace(/\./g, '').replace(/-/g, '').toLowerCase() ===
    searchQuery.replace(/\./g, '').replace(/-/g, '').toLowerCase()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-800 rounded-2xl border border-slate-700 shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Seleccionar Cliente</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
              placeholder="Buscar por nombre, RUT o teléfono..."
              autoFocus
            />
          </div>
        </div>

        {/* Customer List */}
        <div className="flex-1 overflow-y-auto">
          {/* Quick register suggestion */}
          {searchQuery && looksLikeRut && !existingByRut && (
            <button
              onClick={() => setShowQuickRegister(true)}
              className="w-full p-4 flex items-center gap-3 bg-emerald-600/20 hover:bg-emerald-600/30 border-b border-slate-700 transition-colors"
            >
              <div className="w-10 h-10 bg-emerald-600/30 rounded-xl flex items-center justify-center">
                <Plus className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="font-medium text-emerald-400">Registrar cliente nuevo</p>
                <p className="text-sm text-emerald-300/70">RUT: {searchQuery}</p>
              </div>
            </button>
          )}

          {/* Existing customers */}
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              {searchQuery ? (
                <>
                  <User className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No se encontraron clientes</p>
                  {!looksLikeRut && (
                    <button
                      onClick={() => setShowQuickRegister(true)}
                      className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm"
                    >
                      + Registrar cliente nuevo
                    </button>
                  )}
                </>
              ) : (
                <>
                  <User className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No hay clientes registrados</p>
                  <button
                    onClick={() => setShowQuickRegister(true)}
                    className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm"
                  >
                    + Registrar primer cliente
                  </button>
                </>
              )}
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => onSelect(customer)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-slate-700 border-b border-slate-700 transition-colors text-left ${
                  customer.id === currentCustomerId ? 'bg-indigo-600/20' : ''
                }`}
              >
                <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">
                      {customer.firstName} {customer.lastName}
                    </p>
                    {customer.isVip && (
                      <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-slate-400 truncate">
                    {customer.rut && `RUT: ${customer.rut}`}
                    {customer.rut && customer.phone && ' • '}
                    {customer.phone}
                  </p>
                </div>
                {customer.id === currentCustomerId && (
                  <span className="text-xs text-indigo-400 font-medium">Seleccionado</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={() => onSelect(null)}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
          >
            Sin cliente
          </button>
          <button
            onClick={() => setShowQuickRegister(true)}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Quick Register Modal */}
      {showQuickRegister && (
        <QuickRegisterModal
          initialRut={looksLikeRut ? searchQuery : ''}
          onRegister={(customer) => {
            // Add to customers list
            const updated = [...customers, customer];
            saveCustomers(updated);
            setCustomers(updated);
            setShowQuickRegister(false);
            onSelect(customer);
          }}
          onClose={() => setShowQuickRegister(false)}
        />
      )}
    </div>
  );
}

// Quick Register Modal
function QuickRegisterModal({
  initialRut,
  onRegister,
  onClose,
}: {
  initialRut?: string;
  onRegister: (customer: Customer) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    rut: initialRut || '',
    phone: '',
  });
  const [error, setError] = useState<string | null>(null);

  const formatRut = (value: string) => {
    // Remove all non-alphanumeric characters
    let rut = value.replace(/[^0-9kK]/g, '').toUpperCase();

    if (rut.length > 1) {
      // Add dash before verification digit
      const dv = rut.slice(-1);
      const body = rut.slice(0, -1);

      // Format body with dots
      let formatted = '';
      for (let i = body.length - 1, j = 0; i >= 0; i--, j++) {
        if (j > 0 && j % 3 === 0) {
          formatted = '.' + formatted;
        }
        formatted = body[i] + formatted;
      }

      rut = formatted + '-' + dv;
    }

    return rut;
  };

  const handleRutChange = (value: string) => {
    const formatted = formatRut(value);
    setFormData({ ...formData, rut: formatted });
  };

  const handleSubmit = () => {
    setError(null);

    if (!formData.firstName.trim()) {
      setError('El nombre es requerido');
      return;
    }
    if (!formData.lastName.trim()) {
      setError('El apellido es requerido');
      return;
    }

    const newCustomer: Customer = {
      id: `customer-${Date.now()}`,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      rut: formData.rut || undefined,
      phone: formData.phone || undefined,
      totalPurchases: 0,
      isVip: false,
      createdAt: new Date().toISOString(),
    };

    onRegister(newCustomer);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="font-bold">Registro Rápido</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                placeholder="Juan"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Apellido *
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                placeholder="Pérez"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              RUT
            </label>
            <input
              type="text"
              value={formData.rut}
              onChange={(e) => handleRutChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
              placeholder="12.345.678-9"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Teléfono
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
              placeholder="+56 9 1234 5678"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-medium transition-colors"
          >
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}
