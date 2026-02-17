import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  X,
  Check,
  Calendar,
  AlertTriangle,
  ChevronDown,
  Eye,
  Ticket,
} from 'lucide-react';
import {
  Event,
  EventStatus,
  TicketType,
  ConsumptionType,
  eventsApi,
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';

const STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicado',
  CANCELLED: 'Cancelado',
  COMPLETED: 'Completado',
};

const STATUS_COLORS: Record<EventStatus, string> = {
  DRAFT: 'bg-slate-600 text-slate-200',
  PUBLISHED: 'bg-emerald-600/20 text-emerald-400',
  CANCELLED: 'bg-red-600/20 text-red-400',
  COMPLETED: 'bg-blue-600/20 text-blue-400',
};

const CONSUMPTION_LABELS: Record<ConsumptionType, string> = {
  NONE: 'Sin consumo',
  FIXED_ITEMS: 'Items fijos',
  CHOICE_UP_TO_VALUE: 'Elección hasta valor',
  MONEY_TICKET_SINGLE_USE: 'Ticket dinero (un uso)',
  MONEY_CARD_ACCOUNT: 'Cuenta tarjeta',
};

export function EventsPage() {
  const navigate = useNavigate();
  const { venueId } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EventStatus | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const loadEvents = useCallback(async () => {
    if (!venueId) return;
    try {
      setLoading(true);
      const res = await eventsApi.getAll(venueId);
      if (res.data.data) setEvents(res.data.data);
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = events.filter((e) => {
    const matchesSearch = !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = () => {
    setEditingEvent(null);
    setShowModal(true);
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await eventsApi.delete(id);
      await loadEvents();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting event:', err);
    }
  };

  const handleStatusChange = async (id: string, status: EventStatus) => {
    try {
      await eventsApi.updateStatus(id, status);
      await loadEvents();
      if (selectedEvent?.id === id) {
        const res = await eventsApi.getById(id);
        if (res.data.data) setSelectedEvent(res.data.data);
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleSave = async () => {
    await loadEvents();
    setShowModal(false);
    setEditingEvent(null);
  };

  const handleViewDetail = async (event: Event) => {
    try {
      const res = await eventsApi.getById(event.id);
      if (res.data.data) setSelectedEvent(res.data.data);
    } catch (err) {
      console.error('Error loading event detail:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (selectedEvent) {
    return (
      <EventDetailView
        event={selectedEvent}
        onBack={() => setSelectedEvent(null)}
        onRefresh={async () => {
          const res = await eventsApi.getById(selectedEvent.id);
          if (res.data.data) setSelectedEvent(res.data.data);
        }}
        onStatusChange={handleStatusChange}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/pos')} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-semibold">Eventos</h1>
              <p className="text-xs text-slate-400">{events.length} eventos</p>
            </div>
          </div>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">
          <Plus className="w-5 h-5" />
          <span>Nuevo Evento</span>
        </button>
      </div>

      {/* Filters */}
      <div className="p-4 flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar eventos..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as EventStatus | '')}
          className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Events Table */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Calendar className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">Sin eventos</p>
            <p className="text-sm mt-1">{searchQuery ? 'No hay eventos que coincidan' : 'Crea tu primer evento'}</p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Capacidad</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{event.name}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{formatDate(event.date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{event.capacity || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg ${STATUS_COLORS[event.status]}`}>
                        {STATUS_LABELS[event.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleViewDetail(event)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Ver detalle">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEdit(event)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {event.status === 'DRAFT' && (
                          <button onClick={() => setDeleteConfirm(event.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors" title="Eliminar">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <StatusDropdown event={event} onStatusChange={handleStatusChange} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <EventModal event={editingEvent} venueId={venueId!} onClose={() => { setShowModal(false); setEditingEvent(null); }} onSave={handleSave} />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Eliminar Evento</h3>
                <p className="text-slate-400 mt-1">Esta acción no se puede deshacer. Solo se pueden eliminar eventos en borrador.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl font-medium transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDropdown({ event, onStatusChange }: { event: Event; onStatusChange: (id: string, status: EventStatus) => void }) {
  const [open, setOpen] = useState(false);

  const transitions: Record<EventStatus, EventStatus[]> = {
    DRAFT: ['PUBLISHED', 'CANCELLED'],
    PUBLISHED: ['CANCELLED', 'COMPLETED'],
    CANCELLED: [],
    COMPLETED: [],
  };

  const options = transitions[event.status];
  if (options.length === 0) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Cambiar estado">
        <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-slate-700 border border-slate-600 rounded-lg shadow-xl min-w-[160px]">
            {options.map((s) => (
              <button
                key={s}
                onClick={() => { onStatusChange(event.id, s); setOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-600 transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EventModal({ event, venueId, onClose, onSave }: { event: Event | null; venueId: string; onClose: () => void; onSave: () => void }) {
  const [formData, setFormData] = useState({
    name: event?.name || '',
    date: event?.date ? new Date(event.date).toISOString().slice(0, 16) : '',
    doorsOpen: event?.doorsOpen ? new Date(event.doorsOpen).toISOString().slice(0, 16) : '',
    doorsClose: event?.doorsClose ? new Date(event.doorsClose).toISOString().slice(0, 16) : '',
    capacity: event?.capacity?.toString() || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name.trim()) { setError('El nombre es requerido'); return; }
    if (!formData.date) { setError('La fecha es requerida'); return; }

    setIsLoading(true);
    try {
      const data = {
        venueId,
        name: formData.name.trim(),
        date: new Date(formData.date).toISOString(),
        doorsOpen: formData.doorsOpen ? new Date(formData.doorsOpen).toISOString() : undefined,
        doorsClose: formData.doorsClose ? new Date(formData.doorsClose).toISOString() : undefined,
        capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
      };

      if (event) {
        const { venueId: _, ...updateData } = data;
        await eventsApi.update(event.id, updateData);
      } else {
        await eventsApi.create(data);
      }
      onSave();
    } catch (err: any) {
      setError(err.message || 'Error al guardar evento');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-800 rounded-2xl border border-slate-700 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">{event ? 'Editar Evento' : 'Nuevo Evento'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nombre *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="Nombre del evento" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Fecha del evento *</label>
            <input type="datetime-local" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Apertura puertas</label>
              <input type="datetime-local" value={formData.doorsOpen} onChange={(e) => setFormData({ ...formData, doorsOpen: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Cierre puertas</label>
              <input type="datetime-local" value={formData.doorsClose} onChange={(e) => setFormData({ ...formData, doorsClose: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Capacidad</label>
            <input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="0" min="0" />
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

function EventDetailView({ event, onBack, onRefresh, onStatusChange }: { event: Event; onBack: () => void; onRefresh: () => void; onStatusChange: (id: string, status: EventStatus) => void }) {
  const [showTicketTypeModal, setShowTicketTypeModal] = useState(false);
  const [editingTicketType, setEditingTicketType] = useState<TicketType | null>(null);
  const [deleteTicketTypeConfirm, setDeleteTicketTypeConfirm] = useState<string | null>(null);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatPrice = (price: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(price);

  const handleDeleteTicketType = async (ticketTypeId: string) => {
    try {
      await eventsApi.deleteTicketType(event.id, ticketTypeId);
      onRefresh();
      setDeleteTicketTypeConfirm(null);
    } catch (err) {
      console.error('Error deleting ticket type:', err);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold">{event.name}</h1>
            <p className="text-xs text-slate-400">{formatDate(event.date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-xs font-medium rounded-lg ${STATUS_COLORS[event.status]}`}>{STATUS_LABELS[event.status]}</span>
          <StatusDropdown event={event} onStatusChange={onStatusChange} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Event Info */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h2 className="font-semibold mb-3">Detalles del Evento</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-slate-400">Fecha</p><p className="font-medium">{formatDate(event.date)}</p></div>
            <div><p className="text-slate-400">Apertura</p><p className="font-medium">{formatDate(event.doorsOpen)}</p></div>
            <div><p className="text-slate-400">Cierre</p><p className="font-medium">{formatDate(event.doorsClose)}</p></div>
            <div><p className="text-slate-400">Capacidad</p><p className="font-medium">{event.capacity || '-'}</p></div>
          </div>
        </div>

        {/* Ticket Types */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold">Tipos de Ticket</h2>
              <span className="text-xs text-slate-400">({event.ticketTypes?.length || 0})</span>
            </div>
            <button onClick={() => { setEditingTicketType(null); setShowTicketTypeModal(true); }} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm transition-colors">
              <Plus className="w-4 h-4" />Agregar
            </button>
          </div>

          {(!event.ticketTypes || event.ticketTypes.length === 0) ? (
            <p className="text-slate-500 text-sm text-center py-6">No hay tipos de ticket definidos</p>
          ) : (
            <div className="space-y-2">
              {event.ticketTypes.map((tt) => (
                <div key={tt.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg group">
                  <div className="flex-1">
                    <p className="font-medium">{tt.name}</p>
                    <div className="flex gap-4 text-xs text-slate-400 mt-1">
                      <span>{formatPrice(tt.price)}</span>
                      <span>Qty: {tt.quantity}</span>
                      <span>{CONSUMPTION_LABELS[tt.consumptionType]}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingTicketType(tt); setShowTicketTypeModal(true); }} className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTicketTypeConfirm(tt.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showTicketTypeModal && (
        <TicketTypeModal eventId={event.id} ticketType={editingTicketType} onClose={() => { setShowTicketTypeModal(false); setEditingTicketType(null); }} onSave={() => { setShowTicketTypeModal(false); setEditingTicketType(null); onRefresh(); }} />
      )}

      {deleteTicketTypeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteTicketTypeConfirm(null)} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-lg mb-2">Eliminar Tipo de Ticket</h3>
            <p className="text-slate-400 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTicketTypeConfirm(null)} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
              <button onClick={() => handleDeleteTicketType(deleteTicketTypeConfirm)} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl font-medium transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TicketTypeModal({ eventId, ticketType, onClose, onSave }: { eventId: string; ticketType: TicketType | null; onClose: () => void; onSave: () => void }) {
  const [formData, setFormData] = useState({
    name: ticketType?.name || '',
    price: ticketType?.price?.toString() || '',
    quantity: ticketType?.quantity?.toString() || '',
    consumptionType: ticketType?.consumptionType || 'NONE' as ConsumptionType,
    consumptionValue: ticketType?.consumptionValue?.toString() || '',
    sortOrder: ticketType?.sortOrder?.toString() || '0',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name.trim()) { setError('El nombre es requerido'); return; }
    if (!formData.price || parseFloat(formData.price) < 0) { setError('El precio es requerido'); return; }
    if (!formData.quantity || parseInt(formData.quantity) <= 0) { setError('La cantidad es requerida'); return; }

    setIsLoading(true);
    try {
      const data = {
        name: formData.name.trim(),
        price: parseFloat(formData.price),
        quantity: parseInt(formData.quantity),
        consumptionType: formData.consumptionType,
        consumptionValue: formData.consumptionValue ? parseFloat(formData.consumptionValue) : undefined,
        sortOrder: parseInt(formData.sortOrder) || 0,
      };
      if (ticketType) {
        await eventsApi.updateTicketType(eventId, ticketType.id, data);
      } else {
        await eventsApi.createTicketType(eventId, data);
      }
      onSave();
    } catch (err: any) {
      setError(err.message || 'Error al guardar tipo de ticket');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">{ticketType ? 'Editar Tipo de Ticket' : 'Nuevo Tipo de Ticket'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nombre *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="Ej: General, VIP" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Precio *</label>
              <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="0" min="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Cantidad *</label>
              <input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="100" min="1" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de consumo</label>
            <select value={formData.consumptionType} onChange={(e) => setFormData({ ...formData, consumptionType: e.target.value as ConsumptionType })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none">
              {Object.entries(CONSUMPTION_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          {formData.consumptionType !== 'NONE' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Valor de consumo</label>
              <input type="number" value={formData.consumptionValue} onChange={(e) => setFormData({ ...formData, consumptionValue: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="0" min="0" />
            </div>
          )}
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
