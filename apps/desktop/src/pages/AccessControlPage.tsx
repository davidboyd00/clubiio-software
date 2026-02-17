import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Check,
  DoorOpen,
  LogIn,
  LogOut,
  RotateCcw,
  BarChart3,
  Users,
  List as ListIcon,
  Send,
} from 'lucide-react';
import {
  Event,
  AccessLog,
  AccessType,
  AccessSource,
  OccupancyData,
  AccessStats,
  eventsApi,
  accessApi,
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';

type TabType = 'log' | 'logs' | 'occupancy' | 'stats';

const ACCESS_TYPE_LABELS: Record<AccessType, string> = {
  ENTRY: 'Entrada',
  EXIT: 'Salida',
  RE_ENTRY: 'Re-entrada',
};

const ACCESS_TYPE_COLORS: Record<AccessType, string> = {
  ENTRY: 'bg-emerald-600/20 text-emerald-400',
  EXIT: 'bg-red-600/20 text-red-400',
  RE_ENTRY: 'bg-blue-600/20 text-blue-400',
};

const ACCESS_TYPE_ICONS: Record<AccessType, typeof LogIn> = {
  ENTRY: LogIn,
  EXIT: LogOut,
  RE_ENTRY: RotateCcw,
};

const ACCESS_SOURCE_LABELS: Record<AccessSource, string> = {
  CLUBIO_TICKET: 'Ticket Clubio',
  EXTERNAL_TICKET: 'Ticket Externo',
  DOOR_SALE: 'Venta en puerta',
  VIP_LIST: 'Lista VIP',
  COURTESY: 'Cortesía',
  STAFF: 'Staff',
};

export function AccessControlPage() {
  const navigate = useNavigate();
  const { venueId } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('log');
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
    { id: 'log' as TabType, label: 'Registrar', icon: Send },
    { id: 'logs' as TabType, label: 'Historial', icon: ListIcon },
    { id: 'occupancy' as TabType, label: 'Ocupación', icon: Users },
    { id: 'stats' as TabType, label: 'Estadísticas', icon: BarChart3 },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/pos')} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600/20 rounded-xl flex items-center justify-center">
              <DoorOpen className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="font-semibold">Control de Acceso</h1>
          </div>
        </div>
      </div>

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

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'log' && <LogEntryTab venueId={venueId!} events={events} />}
        {activeTab === 'logs' && <LogsTab venueId={venueId!} events={events} />}
        {activeTab === 'occupancy' && <OccupancyTab venueId={venueId!} />}
        {activeTab === 'stats' && <StatsTab venueId={venueId!} events={events} />}
      </div>
    </div>
  );
}

function LogEntryTab({ venueId, events }: { venueId: string; events: Event[] }) {
  const [formData, setFormData] = useState({
    eventId: '',
    type: 'ENTRY' as AccessType,
    source: 'DOOR_SALE' as AccessSource,
    personName: '',
    scannedCode: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    setIsLoading(true);
    try {
      await accessApi.log({
        venueId,
        eventId: formData.eventId || undefined,
        type: formData.type,
        source: formData.source,
        personName: formData.personName.trim() || undefined,
        scannedCode: formData.scannedCode.trim() || undefined,
      });
      setSuccess(`${ACCESS_TYPE_LABELS[formData.type]} registrada`);
      setFormData({ ...formData, personName: '', scannedCode: '' });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al registrar acceso');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {error && <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">{error}</div>}
      {success && <div className="p-3 bg-emerald-600/20 border border-emerald-600/30 rounded-xl text-emerald-400 text-sm flex items-center gap-2"><Check className="w-4 h-4" />{success}</div>}

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
        <h2 className="font-semibold">Registrar Acceso</h2>

        {/* Type buttons */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Tipo *</label>
          <div className="grid grid-cols-3 gap-2">
            {(['ENTRY', 'EXIT', 'RE_ENTRY'] as AccessType[]).map((type) => {
              const Icon = ACCESS_TYPE_ICONS[type];
              return (
                <button
                  key={type}
                  onClick={() => setFormData({ ...formData, type })}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-colors ${
                    formData.type === type
                      ? type === 'ENTRY' ? 'bg-emerald-600 text-white'
                        : type === 'EXIT' ? 'bg-red-600 text-white'
                        : 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {ACCESS_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Fuente *</label>
          <select value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value as AccessSource })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none">
            {Object.entries(ACCESS_SOURCE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Evento</label>
          <select value={formData.eventId} onChange={(e) => setFormData({ ...formData, eventId: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none">
            <option value="">Sin evento específico</option>
            {events.filter(e => e.status === 'PUBLISHED').map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Código escaneado</label>
          <input type="text" value={formData.scannedCode} onChange={(e) => setFormData({ ...formData, scannedCode: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="Escanear o escribir código" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Nombre de persona</label>
          <input type="text" value={formData.personName} onChange={(e) => setFormData({ ...formData, personName: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="Nombre (opcional)" />
        </div>

        <button onClick={handleSubmit} disabled={isLoading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" />Registrar</>}
        </button>
      </div>
    </div>
  );
}

function LogsTab({ venueId, events }: { venueId: string; events: Event[] }) {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    eventId: '',
    type: '' as AccessType | '',
    source: '' as AccessSource | '',
    startDate: '',
    endDate: '',
  });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { venueId };
      if (filters.eventId) params.eventId = filters.eventId;
      if (filters.type) params.type = filters.type;
      if (filters.source) params.source = filters.source;
      if (filters.startDate) params.startDate = new Date(filters.startDate).toISOString();
      if (filters.endDate) params.endDate = new Date(filters.endDate).toISOString();

      const res = await accessApi.getLogs(params);
      if (res.data.data) setLogs(res.data.data);
    } catch (err) {
      console.error('Error loading logs:', err);
    } finally {
      setLoading(false);
    }
  }, [venueId, filters]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select value={filters.eventId} onChange={(e) => setFilters({ ...filters, eventId: e.target.value })} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none">
          <option value="">Todos los eventos</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
        <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value as AccessType | '' })} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none">
          <option value="">Todos los tipos</option>
          {Object.entries(ACCESS_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value as AccessSource | '' })} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none">
          <option value="">Todas las fuentes</option>
          {Object.entries(ACCESS_SOURCE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <input type="datetime-local" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none" placeholder="Desde" />
        <input type="datetime-local" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none" placeholder="Hasta" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <ListIcon className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">Sin registros</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Fuente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Persona</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Código</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-400">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg ${ACCESS_TYPE_COLORS[log.type]}`}>{ACCESS_TYPE_LABELS[log.type]}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{ACCESS_SOURCE_LABELS[log.source]}</td>
                  <td className="px-4 py-3 text-sm">{log.personName || '-'}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-400">{log.scannedCode || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OccupancyTab({ venueId }: { venueId: string }) {
  const [data, setData] = useState<OccupancyData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOccupancy = useCallback(async () => {
    try {
      setLoading(true);
      const res = await accessApi.getOccupancy(venueId);
      if (res.data.data) setData(res.data.data);
    } catch (err) {
      console.error('Error loading occupancy:', err);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    loadOccupancy();
    const interval = setInterval(loadOccupancy, 15000);
    return () => clearInterval(interval);
  }, [loadOccupancy]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  if (!data) {
    return <div className="text-center py-20 text-slate-500">No se pudo cargar la información de ocupación</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
        <p className="text-slate-400 text-sm mb-2">Ocupación Actual</p>
        <p className="text-6xl font-bold text-white">{data.currentOccupancy}</p>
        <p className="text-slate-400 mt-2">personas en el venue</p>
        <button onClick={loadOccupancy} className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors flex items-center gap-2 mx-auto">
          <RotateCcw className="w-4 h-4" />Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <LogIn className="w-5 h-5 text-emerald-400" />
            <p className="text-sm text-slate-400">Total Entradas</p>
          </div>
          <p className="text-3xl font-bold text-emerald-400">{data.totalEntries}</p>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <LogOut className="w-5 h-5 text-red-400" />
            <p className="text-sm text-slate-400">Total Salidas</p>
          </div>
          <p className="text-3xl font-bold text-red-400">{data.totalExits}</p>
        </div>
      </div>
    </div>
  );
}

function StatsTab({ venueId, events }: { venueId: string; events: Event[] }) {
  const [stats, setStats] = useState<AccessStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState('');

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await accessApi.getStats(venueId, selectedEventId || undefined);
      if (res.data.data) setStats(res.data.data);
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  }, [venueId, selectedEventId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <div className="space-y-4">
      <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:outline-none">
        <option value="">Todos los eventos</option>
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>{ev.name}</option>
        ))}
      </select>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : !stats ? (
        <div className="text-center py-20 text-slate-500">Sin datos de estadísticas</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
              <p className="text-sm text-slate-400">Entradas</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.totalEntries}</p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
              <p className="text-sm text-slate-400">Salidas</p>
              <p className="text-2xl font-bold text-red-400">{stats.totalExits}</p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
              <p className="text-sm text-slate-400">Re-entradas</p>
              <p className="text-2xl font-bold text-blue-400">{stats.totalReEntries}</p>
            </div>
          </div>

          {stats.bySource && Object.keys(stats.bySource).length > 0 && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="font-semibold mb-3">Por Fuente</h3>
              <div className="space-y-2">
                {Object.entries(stats.bySource).map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg">
                    <span className="text-sm">{ACCESS_SOURCE_LABELS[source as AccessSource] || source}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
