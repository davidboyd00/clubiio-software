import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  X,
  Check,
  Crown,
  AlertTriangle,
  Users,
  ChevronDown,
  UserPlus,
  UserMinus,
  UserCheck,
} from 'lucide-react';
import {
  VipTable,
  Reservation,
  ReservationStatus,
  Event,
  eventsApi,
  vipTablesApi,
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';

type TabType = 'tables' | 'reservations';

const RES_STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  ARRIVED: 'Llegó',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No llegó',
};

const RES_STATUS_COLORS: Record<ReservationStatus, string> = {
  PENDING: 'bg-amber-600/20 text-amber-400',
  CONFIRMED: 'bg-blue-600/20 text-blue-400',
  ARRIVED: 'bg-emerald-600/20 text-emerald-400',
  COMPLETED: 'bg-slate-600/20 text-slate-400',
  CANCELLED: 'bg-red-600/20 text-red-400',
  NO_SHOW: 'bg-red-600/20 text-red-400',
};

export function VipTablesPage() {
  const navigate = useNavigate();
  const { venueId } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('tables');
  const [tables, setTables] = useState<VipTable[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState<VipTable | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    if (!venueId) return;
    try {
      setLoading(true);
      const res = await vipTablesApi.getAll(venueId);
      if (res.data.data) setTables(res.data.data);
    } catch (err) {
      console.error('Error loading tables:', err);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  const loadEvents = useCallback(async () => {
    if (!venueId) return;
    try {
      const res = await eventsApi.getAll(venueId);
      if (res.data.data) setEvents(res.data.data);
    } catch (err) {
      console.error('Error loading events:', err);
    }
  }, [venueId]);

  useEffect(() => {
    loadTables();
    loadEvents();
  }, [loadTables, loadEvents]);

  const handleDeleteTable = async (id: string) => {
    try {
      await vipTablesApi.delete(id);
      await loadTables();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting table:', err);
    }
  };

  const formatPrice = (price: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(price);

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/pos')} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center">
              <Crown className="w-5 h-5 text-purple-400" />
            </div>
            <h1 className="font-semibold">VIP Mesas</h1>
          </div>
        </div>
        {activeTab === 'tables' && (
          <button onClick={() => { setEditingTable(null); setShowTableModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">
            <Plus className="w-5 h-5" /><span>Nueva Mesa</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 flex gap-1">
        <button onClick={() => setActiveTab('tables')} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'tables' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
          Mesas
        </button>
        <button onClick={() => setActiveTab('reservations')} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'reservations' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
          Reservaciones
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'tables' && (
          loading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
          ) : tables.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Crown className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg">Sin mesas VIP</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tables.map((table) => (
                <div key={table.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 group">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{table.name}</h3>
                      {table.location && <p className="text-sm text-slate-400">{table.location}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingTable(table); setShowTableModal(true); }} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteConfirm(table.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-slate-700/50 rounded-lg p-2">
                      <p className="text-slate-400 text-xs">Capacidad</p>
                      <p className="font-medium">{table.capacity} personas</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-2">
                      <p className="text-slate-400 text-xs">Consumo mín.</p>
                      <p className="font-medium">{formatPrice(table.minConsumption)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'reservations' && (
          <ReservationsTab events={events} tables={tables} />
        )}
      </div>

      {showTableModal && (
        <TableModal table={editingTable} venueId={venueId!} onClose={() => { setShowTableModal(false); setEditingTable(null); }} onSave={async () => { setShowTableModal(false); setEditingTable(null); await loadTables(); }} />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-6 h-6 text-red-400" /></div>
              <div><h3 className="font-semibold text-lg">Desactivar Mesa</h3><p className="text-slate-400 mt-1">Esta acción desactivará la mesa VIP.</p></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
              <button onClick={() => handleDeleteTable(deleteConfirm)} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl font-medium transition-colors">Desactivar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TableModal({ table, venueId, onClose, onSave }: { table: VipTable | null; venueId: string; onClose: () => void; onSave: () => void }) {
  const [formData, setFormData] = useState({
    name: table?.name || '',
    capacity: table?.capacity?.toString() || '',
    minConsumption: table?.minConsumption?.toString() || '0',
    location: table?.location || '',
    sortOrder: table?.sortOrder?.toString() || '0',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name.trim()) { setError('El nombre es requerido'); return; }
    if (!formData.capacity || parseInt(formData.capacity) <= 0) { setError('La capacidad es requerida'); return; }

    setIsLoading(true);
    try {
      const data = {
        name: formData.name.trim(),
        capacity: parseInt(formData.capacity),
        minConsumption: parseFloat(formData.minConsumption) || 0,
        location: formData.location.trim() || undefined,
        sortOrder: parseInt(formData.sortOrder) || 0,
      };
      if (table) {
        await vipTablesApi.update(table.id, data);
      } else {
        await vipTablesApi.create({ venueId, ...data });
      }
      onSave();
    } catch (err: any) {
      setError(err.message || 'Error al guardar mesa');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">{table ? 'Editar Mesa' : 'Nueva Mesa VIP'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nombre *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="Mesa VIP 1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Capacidad *</label>
              <input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" min="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Consumo mínimo</label>
              <input type="number" value={formData.minConsumption} onChange={(e) => setFormData({ ...formData, minConsumption: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" min="0" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Ubicación</label>
            <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="Ej: Segundo piso, Terraza" />
          </div>
        </form>
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={isLoading} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" />Guardar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReservationsTab({ events, tables }: { events: Event[]; tables: VipTable[] }) {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResModal, setShowResModal] = useState(false);
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadReservations = useCallback(async () => {
    if (!selectedEventId) { setReservations([]); return; }
    setLoading(true);
    try {
      const res = await vipTablesApi.getReservations(selectedEventId);
      if (res.data.data) setReservations(res.data.data);
    } catch (err) {
      console.error('Error loading reservations:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  const handleStatusChange = async (id: string, status: ReservationStatus) => {
    try {
      await vipTablesApi.updateReservationStatus(id, status);
      await loadReservations();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await vipTablesApi.deleteReservation(id);
      await loadReservations();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting reservation:', err);
    }
  };

  const handleViewDetail = async (res: Reservation) => {
    try {
      const response = await vipTablesApi.getReservation(res.id);
      if (response.data.data) setSelectedRes(response.data.data);
    } catch (err) {
      console.error('Error loading reservation:', err);
    }
  };

  if (selectedRes) {
    return (
      <ReservationDetail
        reservation={selectedRes}
        tables={tables}
        onBack={() => setSelectedRes(null)}
        onRefresh={async () => {
          const response = await vipTablesApi.getReservation(selectedRes.id);
          if (response.data.data) setSelectedRes(response.data.data);
          await loadReservations();
        }}
        onStatusChange={handleStatusChange}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:outline-none min-w-[250px]">
          <option value="">Seleccionar evento</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
        {selectedEventId && (
          <button onClick={() => { setEditingRes(null); setShowResModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">
            <Plus className="w-5 h-5" /><span>Nueva Reservación</span>
          </button>
        )}
      </div>

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Crown className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">Selecciona un evento</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : reservations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Crown className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">Sin reservaciones</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Titular</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Mesa</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Invitados</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((res) => {
                const table = tables.find((t) => t.id === res.tableId);
                return (
                  <tr key={res.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{res.holderName}</p>
                      <p className="text-xs text-slate-400">{res.holderPhone}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{table?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{res.guestCount}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg ${RES_STATUS_COLORS[res.status]}`}>{RES_STATUS_LABELS[res.status]}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleViewDetail(res)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Ver detalle"><Users className="w-4 h-4" /></button>
                        <button onClick={() => { setEditingRes(res); setShowResModal(true); }} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                        {res.status === 'PENDING' && (
                          <button onClick={() => setDeleteConfirm(res.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                        )}
                        <ResStatusDropdown reservation={res} onStatusChange={handleStatusChange} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showResModal && (
        <ReservationModal reservation={editingRes} eventId={selectedEventId} tables={tables} onClose={() => { setShowResModal(false); setEditingRes(null); }} onSave={async () => { setShowResModal(false); setEditingRes(null); await loadReservations(); }} />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-lg mb-2">Eliminar Reservación</h3>
            <p className="text-slate-400 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl font-medium transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResStatusDropdown({ reservation, onStatusChange }: { reservation: Reservation; onStatusChange: (id: string, status: ReservationStatus) => void }) {
  const [open, setOpen] = useState(false);
  const transitions: Record<ReservationStatus, ReservationStatus[]> = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
    ARRIVED: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: [],
  };
  const options = transitions[reservation.status];
  if (options.length === 0) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><ChevronDown className="w-4 h-4" /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-slate-700 border border-slate-600 rounded-lg shadow-xl min-w-[160px]">
            {options.map((s) => (
              <button key={s} onClick={() => { onStatusChange(reservation.id, s); setOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-600 transition-colors first:rounded-t-lg last:rounded-b-lg">
                {RES_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ReservationModal({ reservation, eventId, tables, onClose, onSave }: { reservation: Reservation | null; eventId: string; tables: VipTable[]; onClose: () => void; onSave: () => void }) {
  const [formData, setFormData] = useState({
    tableId: reservation?.tableId || '',
    holderName: reservation?.holderName || '',
    holderPhone: reservation?.holderPhone || '',
    holderEmail: reservation?.holderEmail || '',
    guestCount: reservation?.guestCount?.toString() || '',
    lateGuestLimit: reservation?.lateGuestLimit?.toString() || '2',
    notes: reservation?.notes || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.tableId) { setError('Selecciona una mesa'); return; }
    if (!formData.holderName.trim()) { setError('El nombre del titular es requerido'); return; }
    if (!formData.holderPhone.trim()) { setError('El teléfono es requerido'); return; }
    if (!formData.guestCount || parseInt(formData.guestCount) <= 0) { setError('La cantidad de invitados es requerida'); return; }

    setIsLoading(true);
    try {
      if (reservation) {
        await vipTablesApi.updateReservation(reservation.id, {
          holderName: formData.holderName.trim(),
          holderPhone: formData.holderPhone.trim(),
          holderEmail: formData.holderEmail.trim() || undefined,
          guestCount: parseInt(formData.guestCount),
          lateGuestLimit: parseInt(formData.lateGuestLimit) || 2,
          notes: formData.notes.trim() || undefined,
        });
      } else {
        await vipTablesApi.createReservation({
          tableId: formData.tableId,
          eventId,
          holderName: formData.holderName.trim(),
          holderPhone: formData.holderPhone.trim(),
          holderEmail: formData.holderEmail.trim() || undefined,
          guestCount: parseInt(formData.guestCount),
          lateGuestLimit: parseInt(formData.lateGuestLimit) || 2,
          notes: formData.notes.trim() || undefined,
        });
      }
      onSave();
    } catch (err: any) {
      setError(err.message || 'Error al guardar reservación');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">{reservation ? 'Editar Reservación' : 'Nueva Reservación'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">{error}</div>}
          {!reservation && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Mesa *</label>
              <select value={formData.tableId} onChange={(e) => setFormData({ ...formData, tableId: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none">
                <option value="">Seleccionar mesa</option>
                {tables.filter(t => t.isActive).map((t) => (
                  <option key={t.id} value={t.id}>{t.name} (Cap: {t.capacity})</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nombre del titular *</label>
            <input type="text" value={formData.holderName} onChange={(e) => setFormData({ ...formData, holderName: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Teléfono *</label>
              <input type="tel" value={formData.holderPhone} onChange={(e) => setFormData({ ...formData, holderPhone: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input type="email" value={formData.holderEmail} onChange={(e) => setFormData({ ...formData, holderEmail: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Invitados *</label>
              <input type="number" value={formData.guestCount} onChange={(e) => setFormData({ ...formData, guestCount: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" min="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Límite late guests</label>
              <input type="number" value={formData.lateGuestLimit} onChange={(e) => setFormData({ ...formData, lateGuestLimit: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" min="0" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Notas</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none resize-none" rows={2} />
          </div>
        </form>
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={isLoading} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" />Guardar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReservationDetail({ reservation, tables, onBack, onRefresh, onStatusChange }: { reservation: Reservation; tables: VipTable[]; onBack: () => void; onRefresh: () => void; onStatusChange: (id: string, status: ReservationStatus) => void }) {
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [addingGuest, setAddingGuest] = useState(false);
  const table = tables.find((t) => t.id === reservation.tableId);

  const handleAddGuest = async () => {
    if (!guestName.trim()) return;
    setAddingGuest(true);
    try {
      await vipTablesApi.addGuest(reservation.id, { name: guestName.trim(), phone: guestPhone.trim() || undefined });
      setGuestName('');
      setGuestPhone('');
      await onRefresh();
    } catch (err) {
      console.error('Error adding guest:', err);
    } finally {
      setAddingGuest(false);
    }
  };

  const handleRemoveGuest = async (guestId: string) => {
    try {
      await vipTablesApi.removeGuest(reservation.id, guestId);
      await onRefresh();
    } catch (err) {
      console.error('Error removing guest:', err);
    }
  };

  const handleMarkArrived = async (guestId: string) => {
    try {
      await vipTablesApi.markGuestArrived(reservation.id, guestId);
      await onRefresh();
    } catch (err) {
      console.error('Error marking arrival:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <h2 className="font-semibold">{reservation.holderName}</h2>
          <p className="text-xs text-slate-400">{table?.name} - {reservation.holderPhone}</p>
        </div>
        <span className={`px-3 py-1 text-xs font-medium rounded-lg ${RES_STATUS_COLORS[reservation.status]}`}>{RES_STATUS_LABELS[reservation.status]}</span>
        <ResStatusDropdown reservation={reservation} onStatusChange={onStatusChange} />
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><p className="text-slate-400">Invitados</p><p className="font-medium">{reservation.guestCount}</p></div>
          <div><p className="text-slate-400">Late guest limit</p><p className="font-medium">{reservation.lateGuestLimit}</p></div>
          {reservation.lateCode && <div><p className="text-slate-400">Late code</p><p className="font-mono font-medium">{reservation.lateCode}</p></div>}
        </div>
        {reservation.notes && <p className="text-sm text-slate-400 mt-3">{reservation.notes}</p>}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-indigo-400" />Lista de Invitados ({reservation.guests?.length || 0})</h3>
        </div>

        <div className="flex gap-2 mb-4">
          <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:border-indigo-500 focus:outline-none" placeholder="Nombre del invitado" />
          <input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="w-32 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:border-indigo-500 focus:outline-none" placeholder="Teléfono" />
          <button onClick={handleAddGuest} disabled={addingGuest || !guestName.trim()} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 rounded-lg transition-colors">
            {addingGuest ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          </button>
        </div>

        {(!reservation.guests || reservation.guests.length === 0) ? (
          <p className="text-slate-500 text-sm text-center py-4">Sin invitados registrados</p>
        ) : (
          <div className="space-y-2">
            {reservation.guests.map((guest) => (
              <div key={guest.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${guest.arrivedAt ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  <span className="text-sm font-medium">{guest.name}</span>
                  {guest.isHolder && <span className="text-xs text-amber-400">(Titular)</span>}
                  {guest.isLateGuest && <span className="text-xs text-purple-400">(Late)</span>}
                  {guest.phone && <span className="text-xs text-slate-400">{guest.phone}</span>}
                </div>
                <div className="flex gap-1">
                  {!guest.arrivedAt && (
                    <button onClick={() => handleMarkArrived(guest.id)} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-600 rounded-lg transition-colors" title="Marcar llegada"><UserCheck className="w-4 h-4" /></button>
                  )}
                  {!guest.isHolder && (
                    <button onClick={() => handleRemoveGuest(guest.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded-lg transition-colors" title="Remover"><UserMinus className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
