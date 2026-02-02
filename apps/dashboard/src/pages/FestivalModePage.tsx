import { useState, useEffect } from 'react';
import {
  Zap,
  Activity,
  Users,
  Clock,
  TrendingUp,
  AlertTriangle,
  Play,
  Pause,
  Settings,
  BarChart3,
  Wine,
  RefreshCw,
  X,
  Plus,
  Trash2,
  Bell,
  Sliders,
  Save,
  MapPin
} from 'lucide-react';
import clsx from 'clsx';

// Types
interface BarStation {
  id: string;
  name: string;
  zone: string;
  status: 'active' | 'inactive' | 'paused';
  queueLength: number;
  avgWaitTime: number;
  ordersProcessed: number;
  utilization: number;
  staff: { id: string; name: string; avatar?: string }[];
}

interface QueueMetrics {
  totalQueueLength: number;
  avgWaitTime: number;
  throughput: number;
  globalUtilization: number;
  p95WaitTime: number;
  activeBars: number;
  totalBars: number;
}

interface FestivalConfig {
  thresholds: {
    critical: number;
    warning: number;
    normal: number;
  };
  notifications: {
    criticalAlerts: boolean;
    warningAlerts: boolean;
    soundEnabled: boolean;
  };
  queue: {
    maxBatchSize: number;
    batchInterval: number;
    maxWaitTime: number;
  };
  zones: string[];
}

const defaultConfig: FestivalConfig = {
  thresholds: {
    critical: 85,
    warning: 65,
    normal: 30,
  },
  notifications: {
    criticalAlerts: true,
    warningAlerts: true,
    soundEnabled: false,
  },
  queue: {
    maxBatchSize: 15,
    batchInterval: 30,
    maxWaitTime: 300,
  },
  zones: ['Escenario A', 'Escenario B', 'VIP', 'Food Court'],
};

// Sample data - replace with real-time API/WebSocket data
const sampleBars: BarStation[] = [
  { id: '1', name: 'Barra Principal', zone: 'Escenario A', status: 'active', queueLength: 28, avgWaitTime: 3.2, ordersProcessed: 456, utilization: 0.92, staff: [{ id: '1', name: 'Carlos M.' }, { id: '2', name: 'Ana R.' }] },
  { id: '2', name: 'Barra VIP', zone: 'VIP', status: 'active', queueLength: 8, avgWaitTime: 1.5, ordersProcessed: 234, utilization: 0.45, staff: [{ id: '3', name: 'Pedro S.' }] },
  { id: '3', name: 'Barra Norte', zone: 'Escenario A', status: 'active', queueLength: 18, avgWaitTime: 2.8, ordersProcessed: 389, utilization: 0.78, staff: [{ id: '4', name: 'María G.' }, { id: '5', name: 'Luis T.' }] },
  { id: '4', name: 'Barra Sur', zone: 'Escenario B', status: 'active', queueLength: 35, avgWaitTime: 4.1, ordersProcessed: 412, utilization: 0.95, staff: [{ id: '6', name: 'Jorge V.' }] },
  { id: '5', name: 'Barra Este', zone: 'Escenario B', status: 'active', queueLength: 12, avgWaitTime: 2.0, ordersProcessed: 298, utilization: 0.55, staff: [{ id: '7', name: 'Sofia L.' }, { id: '8', name: 'Diego R.' }] },
  { id: '6', name: 'Barra Oeste', zone: 'Food Court', status: 'paused', queueLength: 0, avgWaitTime: 0, ordersProcessed: 156, utilization: 0, staff: [] },
  { id: '7', name: 'Barra Terraza', zone: 'VIP', status: 'active', queueLength: 5, avgWaitTime: 1.2, ordersProcessed: 189, utilization: 0.35, staff: [{ id: '9', name: 'Andrea M.' }] },
  { id: '8', name: 'Barra Central', zone: 'Food Court', status: 'active', queueLength: 22, avgWaitTime: 3.5, ordersProcessed: 367, utilization: 0.82, staff: [{ id: '10', name: 'Pablo C.' }, { id: '11', name: 'Laura S.' }] },
];

const sampleMetrics: QueueMetrics = {
  totalQueueLength: 128,
  avgWaitTime: 2.5,
  throughput: 342,
  globalUtilization: 0.72,
  p95WaitTime: 4.8,
  activeBars: 7,
  totalBars: 8,
};

// Helper functions
function getStatusColor(utilization: number, status: string) {
  if (status === 'inactive' || status === 'paused') return { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-500', glow: '' };
  if (utilization >= 0.85) return { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-700', glow: 'shadow-red-200 shadow-lg' };
  if (utilization >= 0.65) return { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-700', glow: 'shadow-orange-200 shadow-md' };
  if (utilization >= 0.30) return { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700', glow: '' };
  return { bg: 'bg-white', border: 'border-gray-200', text: 'text-gray-600', glow: '' };
}

function getStatusLabel(utilization: number, status: string) {
  if (status === 'inactive') return { label: 'Inactiva', color: 'bg-gray-400' };
  if (status === 'paused') return { label: 'Pausada', color: 'bg-gray-400' };
  if (utilization >= 0.85) return { label: 'Crítico', color: 'bg-red-500' };
  if (utilization >= 0.65) return { label: 'Alta carga', color: 'bg-orange-500' };
  if (utilization >= 0.30) return { label: 'Normal', color: 'bg-green-500' };
  return { label: 'Baja carga', color: 'bg-blue-400' };
}

function BarCard({ bar, onClick }: { bar: BarStation; onClick: () => void }) {
  const colors = getStatusColor(bar.utilization, bar.status);
  const statusInfo = getStatusLabel(bar.utilization, bar.status);

  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-[1.02]',
        colors.bg,
        colors.border,
        colors.glow
      )}
    >
      {/* Status indicator */}
      <div className="absolute top-3 right-3">
        <span className={clsx('px-2 py-0.5 text-xs font-medium text-white rounded-full', statusInfo.color)}>
          {statusInfo.label}
        </span>
      </div>

      {/* Bar icon and name */}
      <div className="flex items-start gap-3 mb-3">
        <div className={clsx(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          bar.status === 'active' ? 'bg-primary-100' : 'bg-gray-200'
        )}>
          <Wine className={clsx('w-6 h-6', bar.status === 'active' ? 'text-primary-600' : 'text-gray-400')} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{bar.name}</h3>
          <p className="text-xs text-gray-500">{bar.zone}</p>
        </div>
      </div>

      {/* Metrics */}
      {bar.status === 'active' && (
        <>
          {/* Queue bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-600">Cola</span>
              <span className={clsx('font-semibold', colors.text)}>{bar.queueLength} personas</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all duration-500',
                  bar.utilization >= 0.85 ? 'bg-red-500' :
                  bar.utilization >= 0.65 ? 'bg-orange-500' :
                  bar.utilization >= 0.30 ? 'bg-green-500' : 'bg-blue-400'
                )}
                style={{ width: `${Math.min(bar.utilization * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-gray-900">{bar.avgWaitTime.toFixed(1)}s</p>
              <p className="text-xs text-gray-500">Espera</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{bar.ordersProcessed}</p>
              <p className="text-xs text-gray-500">Órdenes</p>
            </div>
            <div>
              <p className={clsx('text-lg font-bold', colors.text)}>{(bar.utilization * 100).toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Carga</p>
            </div>
          </div>

          {/* Staff */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-500">
                {bar.staff.length} staff: {bar.staff.map(s => s.name).join(', ')}
              </span>
            </div>
          </div>
        </>
      )}

      {bar.status !== 'active' && (
        <div className="text-center py-4 text-gray-400">
          <p className="text-sm">{bar.status === 'paused' ? 'Barra pausada' : 'Barra inactiva'}</p>
        </div>
      )}
    </div>
  );
}

function BarDetailModal({ bar, onClose }: { bar: BarStation; onClose: () => void }) {
  const colors = getStatusColor(bar.utilization, bar.status);
  const statusInfo = getStatusLabel(bar.utilization, bar.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className={clsx('p-6 rounded-t-2xl', colors.bg)}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-white/80 flex items-center justify-center">
                <Wine className="w-8 h-8 text-primary-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{bar.name}</h2>
                <p className="text-gray-600">{bar.zone}</p>
                <span className={clsx('inline-block mt-1 px-2 py-0.5 text-xs font-medium text-white rounded-full', statusInfo.color)}>
                  {statusInfo.label}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Live metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-sm">En cola</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{bar.queueLength}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Tiempo espera</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{bar.avgWaitTime.toFixed(1)}s</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm">Órdenes hoy</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{bar.ordersProcessed}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Activity className="w-4 h-4" />
                <span className="text-sm">Utilización</span>
              </div>
              <p className={clsx('text-3xl font-bold', colors.text)}>{(bar.utilization * 100).toFixed(0)}%</p>
            </div>
          </div>

          {/* Staff assigned */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Staff Asignado ({bar.staff.length})</h3>
            {bar.staff.length > 0 ? (
              <div className="space-y-2">
                {bar.staff.map(person => (
                  <div key={person.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-700 font-medium">
                        {person.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <span className="font-medium text-gray-900">{person.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No hay staff asignado</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button className="flex-1 btn btn-secondary">
              Reasignar Staff
            </button>
            <button className={clsx(
              'flex-1 btn',
              bar.status === 'active' ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'btn-primary'
            )}>
              {bar.status === 'active' ? 'Pausar Barra' : 'Activar Barra'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigModal({
  config,
  bars,
  onSave,
  onClose,
  onAddBar,
  onRemoveBar,
  onToggleBar
}: {
  config: FestivalConfig;
  bars: BarStation[];
  onSave: (config: FestivalConfig) => void;
  onClose: () => void;
  onAddBar: (bar: Partial<BarStation>) => void;
  onRemoveBar: (id: string) => void;
  onToggleBar: (id: string) => void;
}) {
  const [localConfig, setLocalConfig] = useState<FestivalConfig>(config);
  const [activeTab, setActiveTab] = useState<'general' | 'bars' | 'notifications'>('general');
  const [newBarName, setNewBarName] = useState('');
  const [newBarZone, setNewBarZone] = useState(config.zones[0] || '');
  const [newZoneName, setNewZoneName] = useState('');

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  const handleAddBar = () => {
    if (newBarName.trim() && newBarZone) {
      onAddBar({
        name: newBarName.trim(),
        zone: newBarZone,
        status: 'inactive',
        queueLength: 0,
        avgWaitTime: 0,
        ordersProcessed: 0,
        utilization: 0,
        staff: [],
      });
      setNewBarName('');
    }
  };

  const handleAddZone = () => {
    if (newZoneName.trim() && !localConfig.zones.includes(newZoneName.trim())) {
      setLocalConfig(prev => ({
        ...prev,
        zones: [...prev.zones, newZoneName.trim()]
      }));
      setNewZoneName('');
    }
  };

  const handleRemoveZone = (zone: string) => {
    setLocalConfig(prev => ({
      ...prev,
      zones: prev.zones.filter(z => z !== zone)
    }));
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'bars', label: 'Barras', icon: Wine },
    { id: 'notifications', label: 'Alertas', icon: Bell },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Configuración Festival</h2>
              <p className="text-sm text-gray-500">Ajusta los parámetros del sistema</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Thresholds */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Umbrales de Carga</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-gray-600 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        Crítico
                      </label>
                      <span className="text-sm font-medium text-gray-900">{localConfig.thresholds.critical}%</span>
                    </div>
                    <input
                      type="range"
                      min="70"
                      max="100"
                      value={localConfig.thresholds.critical}
                      onChange={(e) => setLocalConfig(prev => ({
                        ...prev,
                        thresholds: { ...prev.thresholds, critical: parseInt(e.target.value) }
                      }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-gray-600 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        Alerta
                      </label>
                      <span className="text-sm font-medium text-gray-900">{localConfig.thresholds.warning}%</span>
                    </div>
                    <input
                      type="range"
                      min="40"
                      max={localConfig.thresholds.critical - 5}
                      value={localConfig.thresholds.warning}
                      onChange={(e) => setLocalConfig(prev => ({
                        ...prev,
                        thresholds: { ...prev.thresholds, warning: parseInt(e.target.value) }
                      }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-gray-600 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        Normal
                      </label>
                      <span className="text-sm font-medium text-gray-900">{localConfig.thresholds.normal}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max={localConfig.thresholds.warning - 5}
                      value={localConfig.thresholds.normal}
                      onChange={(e) => setLocalConfig(prev => ({
                        ...prev,
                        thresholds: { ...prev.thresholds, normal: parseInt(e.target.value) }
                      }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Queue Settings */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Configuración de Colas</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Tamaño máx. batch</label>
                    <input
                      type="number"
                      min="5"
                      max="50"
                      value={localConfig.queue.maxBatchSize}
                      onChange={(e) => setLocalConfig(prev => ({
                        ...prev,
                        queue: { ...prev.queue, maxBatchSize: parseInt(e.target.value) || 15 }
                      }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Intervalo batch (seg)</label>
                    <input
                      type="number"
                      min="10"
                      max="120"
                      value={localConfig.queue.batchInterval}
                      onChange={(e) => setLocalConfig(prev => ({
                        ...prev,
                        queue: { ...prev.queue, batchInterval: parseInt(e.target.value) || 30 }
                      }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Espera máx. (seg)</label>
                    <input
                      type="number"
                      min="60"
                      max="600"
                      value={localConfig.queue.maxWaitTime}
                      onChange={(e) => setLocalConfig(prev => ({
                        ...prev,
                        queue: { ...prev.queue, maxWaitTime: parseInt(e.target.value) || 300 }
                      }))}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              {/* Zones */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Zonas del Evento</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {localConfig.zones.map(zone => (
                    <span
                      key={zone}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      <MapPin className="w-3 h-3" />
                      {zone}
                      <button
                        onClick={() => handleRemoveZone(zone)}
                        className="ml-1 p-0.5 hover:bg-gray-200 rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nueva zona..."
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddZone()}
                    className="input flex-1"
                  />
                  <button onClick={handleAddZone} className="btn btn-secondary">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bars' && (
            <div className="space-y-6">
              {/* Add Bar */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Agregar Barra</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nombre de la barra..."
                    value={newBarName}
                    onChange={(e) => setNewBarName(e.target.value)}
                    className="input flex-1"
                  />
                  <select
                    value={newBarZone}
                    onChange={(e) => setNewBarZone(e.target.value)}
                    className="input w-40"
                  >
                    {localConfig.zones.map(zone => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                  <button onClick={handleAddBar} className="btn btn-primary">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bars List */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Barras Configuradas ({bars.length})</h3>
                <div className="space-y-2">
                  {bars.map(bar => (
                    <div
                      key={bar.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          bar.status === 'active' ? 'bg-green-100' : 'bg-gray-200'
                        )}>
                          <Wine className={clsx(
                            'w-5 h-5',
                            bar.status === 'active' ? 'text-green-600' : 'text-gray-400'
                          )} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{bar.name}</p>
                          <p className="text-xs text-gray-500">{bar.zone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          'px-2 py-1 text-xs font-medium rounded-full',
                          bar.status === 'active' ? 'bg-green-100 text-green-700' :
                          bar.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        )}>
                          {bar.status === 'active' ? 'Activa' : bar.status === 'paused' ? 'Pausada' : 'Inactiva'}
                        </span>
                        <button
                          onClick={() => onToggleBar(bar.id)}
                          className={clsx(
                            'px-3 py-1 text-xs font-medium rounded-lg transition-colors',
                            bar.status === 'active'
                              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          )}
                        >
                          {bar.status === 'active' ? 'Pausar' : 'Activar'}
                        </button>
                        <button
                          onClick={() => onRemoveBar(bar.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Configuración de Alertas</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Alertas Críticas</p>
                        <p className="text-sm text-gray-500">Notificar cuando una barra supere el umbral crítico</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={localConfig.notifications.criticalAlerts}
                      onChange={(e) => setLocalConfig(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, criticalAlerts: e.target.checked }
                      }))}
                      className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Alertas de Advertencia</p>
                        <p className="text-sm text-gray-500">Notificar cuando una barra supere el umbral de alerta</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={localConfig.notifications.warningAlerts}
                      onChange={(e) => setLocalConfig(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, warningAlerts: e.target.checked }
                      }))}
                      className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Sonido de Alertas</p>
                        <p className="text-sm text-gray-500">Reproducir sonido cuando se dispare una alerta</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={localConfig.notifications.soundEnabled}
                      onChange={(e) => setLocalConfig(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, soundEnabled: e.target.checked }
                      }))}
                      className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button onClick={onClose} className="btn btn-secondary">
            Cancelar
          </button>
          <button onClick={handleSave} className="btn btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FestivalModePage() {
  const [festivalModeActive, setFestivalModeActive] = useState(false);
  const [bars, setBars] = useState<BarStation[]>(sampleBars);
  const [_metrics, _setMetrics] = useState<QueueMetrics>(sampleMetrics);
  const [selectedBar, setSelectedBar] = useState<BarStation | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<FestivalConfig>(defaultConfig);

  // Simulate real-time updates
  useEffect(() => {
    if (!festivalModeActive) return;

    const interval = setInterval(() => {
      setBars(prev => prev.map(bar => {
        if (bar.status !== 'active') return bar;
        const change = (Math.random() - 0.5) * 0.1;
        const newUtil = Math.max(0.1, Math.min(0.98, bar.utilization + change));
        const queueChange = Math.floor((Math.random() - 0.5) * 6);
        return {
          ...bar,
          utilization: newUtil,
          queueLength: Math.max(0, bar.queueLength + queueChange),
          avgWaitTime: Math.max(0.5, bar.avgWaitTime + (Math.random() - 0.5) * 0.5),
          ordersProcessed: bar.ordersProcessed + Math.floor(Math.random() * 3),
        };
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [festivalModeActive]);

  const zones = ['all', ...new Set(bars.map(b => b.zone))];
  const filteredBars = selectedZone === 'all' ? bars : bars.filter(b => b.zone === selectedZone);

  const criticalBars = bars.filter(b => b.status === 'active' && b.utilization >= config.thresholds.critical / 100);
  const warningBars = bars.filter(b => b.status === 'active' && b.utilization >= config.thresholds.warning / 100 && b.utilization < config.thresholds.critical / 100);

  const handleAddBar = (newBar: Partial<BarStation>) => {
    const bar: BarStation = {
      id: Date.now().toString(),
      name: newBar.name || 'Nueva Barra',
      zone: newBar.zone || config.zones[0],
      status: 'inactive',
      queueLength: 0,
      avgWaitTime: 0,
      ordersProcessed: 0,
      utilization: 0,
      staff: [],
    };
    setBars(prev => [...prev, bar]);
  };

  const handleRemoveBar = (id: string) => {
    setBars(prev => prev.filter(b => b.id !== id));
  };

  const handleToggleBar = (id: string) => {
    setBars(prev => prev.map(b => {
      if (b.id !== id) return b;
      return {
        ...b,
        status: b.status === 'active' ? 'paused' : 'active',
        utilization: b.status === 'active' ? 0 : 0.3,
        queueLength: b.status === 'active' ? 0 : Math.floor(Math.random() * 10),
      };
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Festival Mode</h1>
            <span className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
              Pro
            </span>
          </div>
          <p className="text-gray-500">Monitoreo en tiempo real de barras y colas</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfig(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Configurar
          </button>
          <button
            onClick={() => setFestivalModeActive(!festivalModeActive)}
            className={clsx(
              'btn flex items-center gap-2',
              festivalModeActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-primary'
            )}
          >
            {festivalModeActive ? (
              <>
                <Pause className="w-4 h-4" />
                Detener
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Activar
              </>
            )}
          </button>
        </div>
      </div>

      {!festivalModeActive ? (
        <div className="card bg-gray-50 border-2 border-dashed border-gray-300">
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-10 h-10 text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Festival Mode Inactivo</h3>
            <p className="text-gray-500 mt-2 max-w-md mx-auto">
              Activa el modo festival para monitorear todas las barras en tiempo real con indicadores de carga.
            </p>
            <button
              onClick={() => setFestivalModeActive(true)}
              className="btn btn-primary mt-6 flex items-center gap-2 mx-auto"
            >
              <Play className="w-4 h-4" />
              Activar Festival Mode
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Status Banner */}
          <div className="flex items-center justify-between card bg-green-50 border border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="font-medium text-green-800">Festival Mode Activo</span>
              <span className="text-green-600 text-sm">Actualizando en tiempo real</span>
            </div>
            <div className="flex items-center gap-2 text-green-700">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Live</span>
            </div>
          </div>

          {/* Alerts */}
          {(criticalBars.length > 0 || warningBars.length > 0) && (
            <div className="space-y-2">
              {criticalBars.length > 0 && (
                <div className="card bg-red-50 border border-red-200">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-800">
                      {criticalBars.length} barra{criticalBars.length > 1 ? 's' : ''} en estado crítico: {criticalBars.map(b => b.name).join(', ')}
                    </span>
                  </div>
                </div>
              )}
              {warningBars.length > 0 && (
                <div className="card bg-orange-50 border border-orange-200">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <span className="font-medium text-orange-800">
                      {warningBars.length} barra{warningBars.length > 1 ? 's' : ''} con alta carga: {warningBars.map(b => b.name).join(', ')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Global Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="card">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs">Cola Total</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{bars.reduce((acc, b) => acc + b.queueLength, 0)}</p>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs">Espera Prom.</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {(bars.filter(b => b.status === 'active').reduce((acc, b) => acc + b.avgWaitTime, 0) / bars.filter(b => b.status === 'active').length || 0).toFixed(1)}s
              </p>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">Órdenes Hoy</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{bars.reduce((acc, b) => acc + b.ordersProcessed, 0)}</p>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Wine className="w-4 h-4" />
                <span className="text-xs">Barras Activas</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {bars.filter(b => b.status === 'active').length}/{bars.length}
              </p>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Activity className="w-4 h-4" />
                <span className="text-xs">Carga Global</span>
              </div>
              <p className={clsx(
                'text-2xl font-bold',
                (bars.filter(b => b.status === 'active').reduce((acc, b) => acc + b.utilization, 0) / bars.filter(b => b.status === 'active').length || 0) >= 0.85 ? 'text-red-600' :
                (bars.filter(b => b.status === 'active').reduce((acc, b) => acc + b.utilization, 0) / bars.filter(b => b.status === 'active').length || 0) >= 0.65 ? 'text-orange-600' : 'text-green-600'
              )}>
                {((bars.filter(b => b.status === 'active').reduce((acc, b) => acc + b.utilization, 0) / bars.filter(b => b.status === 'active').length || 0) * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-gray-500">Estado:</span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Crítico (&gt;85%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span>Alta carga (65-85%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Normal (30-65%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-400" />
              <span>Baja carga (&lt;30%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span>Inactiva</span>
            </div>
          </div>

          {/* Zone Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {zones.map(zone => (
              <button
                key={zone}
                onClick={() => setSelectedZone(zone)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                  selectedZone === zone
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {zone === 'all' ? 'Todas las zonas' : zone}
              </button>
            ))}
          </div>

          {/* Bars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredBars.map(bar => (
              <BarCard key={bar.id} bar={bar} onClick={() => setSelectedBar(bar)} />
            ))}
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selectedBar && (
        <BarDetailModal bar={selectedBar} onClose={() => setSelectedBar(null)} />
      )}

      {/* Config Modal */}
      {showConfig && (
        <ConfigModal
          config={config}
          bars={bars}
          onSave={setConfig}
          onClose={() => setShowConfig(false)}
          onAddBar={handleAddBar}
          onRemoveBar={handleRemoveBar}
          onToggleBar={handleToggleBar}
        />
      )}
    </div>
  );
}
