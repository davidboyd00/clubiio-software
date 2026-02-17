import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Loader2,
  Ticket,
  Check,
  AlertTriangle,
  QrCode,
  Send,
  List,
} from 'lucide-react';
import {
  Event,
  Ticket as TicketT,
  TicketStatus,
  eventsApi,
  ticketsApi,
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';

type TabType = 'generate' | 'validate' | 'list';

const STATUS_LABELS: Record<TicketStatus, string> = {
  ACTIVE: 'Activo',
  USED: 'Usado',
  EXPIRED: 'Expirado',
  CANCELLED: 'Cancelado',
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  ACTIVE: 'bg-emerald-600/20 text-emerald-400',
  USED: 'bg-blue-600/20 text-blue-400',
  EXPIRED: 'bg-amber-600/20 text-amber-400',
  CANCELLED: 'bg-red-600/20 text-red-400',
};

export function TicketsPage() {
  const navigate = useNavigate();
  const { venueId } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('generate');
  const [events, setEvents] = useState<Event[]>([]);

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
    loadEvents();
  }, [loadEvents]);

  const tabs = [
    { id: 'generate' as TabType, label: 'Generar', icon: Send },
    { id: 'validate' as TabType, label: 'Validar', icon: QrCode },
    { id: 'list' as TabType, label: 'Tickets por Evento', icon: List },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/pos')} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center">
              <Ticket className="w-5 h-5 text-purple-400" />
            </div>
            <h1 className="font-semibold">Tickets</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'generate' && <GenerateTab events={events} />}
        {activeTab === 'validate' && <ValidateTab />}
        {activeTab === 'list' && <EventTicketsTab events={events} />}
      </div>
    </div>
  );
}

function GenerateTab({ events }: { events: Event[] }) {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    if (selectedEventId) {
      const loadEvent = async () => {
        try {
          const res = await eventsApi.getById(selectedEventId);
          if (res.data.data) setSelectedEvent(res.data.data);
        } catch {
          setSelectedEvent(null);
        }
      };
      loadEvent();
      setSelectedTicketTypeId('');
    } else {
      setSelectedEvent(null);
    }
  }, [selectedEventId]);

  const handleGenerate = async () => {
    setError(null);
    setSuccess(null);
    if (!selectedTicketTypeId) { setError('Selecciona un tipo de ticket'); return; }
    if (!quantity || parseInt(quantity) <= 0) { setError('La cantidad debe ser mayor a 0'); return; }

    setIsLoading(true);
    try {
      const res = await ticketsApi.generate({
        ticketTypeId: selectedTicketTypeId,
        quantity: parseInt(quantity),
        customerName: customerName.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
      });
      const count = Array.isArray(res.data.data) ? res.data.data.length : parseInt(quantity);
      setSuccess(`Se generaron ${count} tickets exitosamente`);
      setQuantity('1');
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
    } catch (err: any) {
      setError(err.message || 'Error al generar tickets');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {error && <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">{error}</div>}
      {success && <div className="p-3 bg-emerald-600/20 border border-emerald-600/30 rounded-xl text-emerald-400 text-sm flex items-center gap-2"><Check className="w-4 h-4" />{success}</div>}

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
        <h2 className="font-semibold">Generar Tickets</h2>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Evento *</label>
          <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none">
            <option value="">Seleccionar evento</option>
            {events.filter(e => e.status === 'PUBLISHED' || e.status === 'DRAFT').map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>

        {selectedEvent && selectedEvent.ticketTypes && selectedEvent.ticketTypes.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Ticket *</label>
            <select value={selectedTicketTypeId} onChange={(e) => setSelectedTicketTypeId(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none">
              <option value="">Seleccionar tipo</option>
              {selectedEvent.ticketTypes.map((tt) => (
                <option key={tt.id} value={tt.id}>{tt.name} - ${tt.price}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Cantidad *</label>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" min="1" max="500" />
        </div>

        <div className="border-t border-slate-700 pt-4">
          <p className="text-sm text-slate-400 mb-3">Info del cliente (opcional)</p>
          <div className="space-y-3">
            <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="Nombre" />
            <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="Email" />
            <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="Teléfono" />
          </div>
        </div>

        <button onClick={handleGenerate} disabled={isLoading || !selectedTicketTypeId} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" />Generar Tickets</>}
        </button>
      </div>
    </div>
  );
}

function ValidateTab() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketT | null>(null);

  const handleValidate = async () => {
    setError(null);
    setTicket(null);
    if (!code.trim()) { setError('Ingresa un código de ticket'); return; }

    setIsLoading(true);
    try {
      const res = await ticketsApi.validate(code.trim());
      if (res.data.data) setTicket(res.data.data);
    } catch (err: any) {
      setError(err.message || 'Ticket no válido');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {error && <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
        <h2 className="font-semibold">Validar Ticket</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
            className="flex-1 px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
            placeholder="Código del ticket o escanear QR"
            autoFocus
          />
          <button onClick={handleValidate} disabled={isLoading} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 rounded-xl font-medium transition-colors flex items-center gap-2">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><QrCode className="w-5 h-5" />Validar</>}
          </button>
        </div>
      </div>

      {ticket && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Resultado</h3>
            <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${STATUS_COLORS[ticket.status]}`}>{STATUS_LABELS[ticket.status]}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-slate-400">Código</p><p className="font-mono font-medium">{ticket.code}</p></div>
            <div><p className="text-slate-400">Estado</p><p className="font-medium">{STATUS_LABELS[ticket.status]}</p></div>
            {ticket.customerName && <div><p className="text-slate-400">Cliente</p><p className="font-medium">{ticket.customerName}</p></div>}
            {ticket.ticketType && <div><p className="text-slate-400">Tipo</p><p className="font-medium">{ticket.ticketType.name}</p></div>}
            {ticket.ticketType?.event && <div><p className="text-slate-400">Evento</p><p className="font-medium">{ticket.ticketType.event.name}</p></div>}
            {ticket.usedAt && <div><p className="text-slate-400">Usado</p><p className="font-medium">{formatDate(ticket.usedAt)}</p></div>}
          </div>
          {ticket.status === 'ACTIVE' && (
            <div className="pt-2 border-t border-slate-700">
              <div className="flex items-center gap-2 text-emerald-400">
                <Check className="w-5 h-5" />
                <span className="font-medium">Ticket válido para ingreso</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventTicketsTab({ events }: { events: Event[] }) {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [tickets, setTickets] = useState<TicketT[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (selectedEventId) {
      const loadTickets = async () => {
        setLoading(true);
        try {
          const res = await ticketsApi.getByEvent(selectedEventId);
          if (res.data.data) setTickets(res.data.data);
        } catch (err) {
          console.error('Error loading tickets:', err);
        } finally {
          setLoading(false);
        }
      };
      loadTickets();
    } else {
      setTickets([]);
    }
  }, [selectedEventId]);

  const filteredTickets = tickets.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return t.code.toLowerCase().includes(q) || t.customerName?.toLowerCase().includes(q) || false;
  });

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:outline-none min-w-[250px]">
          <option value="">Seleccionar evento</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
        {selectedEventId && (
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por código o cliente..." className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
          </div>
        )}
      </div>

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Ticket className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">Selecciona un evento</p>
          <p className="text-sm mt-1">para ver sus tickets</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Ticket className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">Sin tickets</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Código</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Creado</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket) => (
                <tr key={ticket.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm">{ticket.code}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{ticket.customerName || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{ticket.ticketType?.name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg ${STATUS_COLORS[ticket.status]}`}>{STATUS_LABELS[ticket.status]}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{formatDate(ticket.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
