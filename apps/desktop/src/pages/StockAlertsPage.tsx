import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Bot,
  MessageSquare,
  Settings,
  Play,
  Pause,
  RefreshCw,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Package,
  Wifi,
  WifiOff,
  Send,
} from 'lucide-react';
import {
  loadMonitorSettings,
  saveMonitorSettings,
  StockMonitorSettings,
  loadStockAlerts,
  StockAlert,
  acknowledgeAlert,
} from '../lib/stockMonitor';
import {
  loadAIConfig,
  saveAIConfig,
  AIAgentConfig,
  checkOllamaConnection,
  getAvailableModels,
} from '../lib/aiAgent';
import {
  loadMessagingConfig,
  saveMessagingConfig,
  MessagingConfig,
  testMessagingConnections,
} from '../lib/messaging';
import {
  startStockMonitor,
  stopStockMonitor,
  isMonitorRunning,
  forceStockCheck,
} from '../services/stockMonitorService';
import { useProducts } from '../hooks/useProducts';

type TabType = 'alerts' | 'monitor' | 'ai' | 'messaging';

export function StockAlertsPage() {
  const navigate = useNavigate();
  const { products } = useProducts();
  const [activeTab, setActiveTab] = useState<TabType>('alerts');

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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600/20 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="font-semibold">Alertas de Stock</h1>
              <p className="text-xs text-slate-400">Monitoreo automático con IA</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700 px-4">
        <div className="flex gap-1">
          {[
            { id: 'alerts', label: 'Alertas', icon: AlertTriangle },
            { id: 'monitor', label: 'Monitor', icon: Settings },
            { id: 'ai', label: 'Agente IA', icon: Bot },
            { id: 'messaging', label: 'Mensajería', icon: MessageSquare },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'alerts' && <AlertsTab />}
        {activeTab === 'monitor' && <MonitorTab products={products} />}
        {activeTab === 'ai' && <AITab />}
        {activeTab === 'messaging' && <MessagingTab />}
      </div>
    </div>
  );
}

// Alerts Tab
function AlertsTab() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);

  useEffect(() => {
    setAlerts(loadStockAlerts());
  }, []);

  const handleAcknowledge = (id: string) => {
    acknowledgeAlert(id);
    setAlerts(loadStockAlerts());
  };

  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  const acknowledgedAlerts = alerts.filter((a) => a.acknowledged);

  const severityColors = {
    out: 'bg-red-600/20 border-red-600/30 text-red-400',
    critical: 'bg-amber-600/20 border-amber-600/30 text-amber-400',
    low: 'bg-yellow-600/20 border-yellow-600/30 text-yellow-400',
  };

  const severityLabels = {
    out: 'Sin Stock',
    critical: 'Crítico',
    low: 'Bajo',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Active Alerts */}
      <div>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          Alertas Activas ({activeAlerts.length})
        </h2>

        {activeAlerts.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay alertas activas</p>
            <p className="text-sm mt-1">El stock de todos los productos está en orden</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`border rounded-xl p-4 ${severityColors[alert.severity]}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{alert.productName}</span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-black/20">
                        {severityLabels[alert.severity]}
                      </span>
                    </div>
                    <p className="text-sm mt-1 opacity-80">
                      Stock: {alert.currentStock} / {alert.minStock} unidades
                    </p>
                    {alert.aiSuggestion && (
                      <div className="mt-3 p-3 bg-black/20 rounded-lg">
                        <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
                          <Bot className="w-3 h-3" />
                          Sugerencia IA
                        </div>
                        <p className="text-sm">{alert.aiSuggestion}</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Marcar como atendida"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Acknowledged Alerts */}
      {acknowledgedAlerts.length > 0 && (
        <div>
          <h2 className="font-semibold mb-4 text-slate-400">
            Alertas Atendidas ({acknowledgedAlerts.length})
          </h2>
          <div className="space-y-2 opacity-60">
            {acknowledgedAlerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <span className="font-medium">{alert.productName}</span>
                  <span className="text-sm text-slate-400 ml-2">
                    {alert.currentStock}/{alert.minStock} uds
                  </span>
                </div>
                <Check className="w-4 h-4 text-green-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Monitor Tab
function MonitorTab({ products }: { products: any[] }) {
  const [settings, setSettings] = useState<StockMonitorSettings>(loadMonitorSettings());
  const [isRunning, setIsRunning] = useState(isMonitorRunning());
  const [isChecking, setIsChecking] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveMonitorSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    // Restart monitor with new settings
    if (settings.enabled && isRunning) {
      stopStockMonitor();
      startStockMonitor(() => products);
    }
  };

  const toggleMonitor = () => {
    if (isRunning) {
      stopStockMonitor();
      setIsRunning(false);
    } else {
      startStockMonitor(() => products);
      setIsRunning(true);
    }
  };

  const runManualCheck = async () => {
    setIsChecking(true);
    await forceStockCheck(products);
    setIsChecking(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Monitor Status */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                isRunning ? 'bg-green-500 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <div>
              <p className="font-medium">
                Monitor {isRunning ? 'Activo' : 'Detenido'}
              </p>
              <p className="text-sm text-slate-400">
                {isRunning
                  ? `Verificando cada ${settings.checkIntervalMinutes} minutos`
                  : 'El monitor está pausado'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={runManualCheck}
              disabled={isChecking}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              Verificar ahora
            </button>
            <button
              onClick={toggleMonitor}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isRunning
                  ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                  : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isRunning ? 'Detener' : 'Iniciar'}
            </button>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">
        <h3 className="font-semibold">Configuración del Monitor</h3>

        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span>Habilitar monitor automático</span>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"
            />
          </label>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Intervalo de verificación (minutos)
            </label>
            <input
              type="number"
              value={settings.checkIntervalMinutes}
              onChange={(e) =>
                setSettings({ ...settings, checkIntervalMinutes: parseInt(e.target.value) || 15 })
              }
              min={1}
              max={60}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Umbral stock bajo (% del mínimo)
            </label>
            <input
              type="number"
              value={settings.lowStockThreshold}
              onChange={(e) =>
                setSettings({ ...settings, lowStockThreshold: parseInt(e.target.value) || 150 })
              }
              min={100}
              max={300}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-indigo-500 focus:outline-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              Alerta cuando el stock está al {settings.lowStockThreshold}% del mínimo
            </p>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Umbral crítico (% del mínimo)
            </label>
            <input
              type="number"
              value={settings.criticalStockThreshold}
              onChange={(e) =>
                setSettings({ ...settings, criticalStockThreshold: parseInt(e.target.value) || 100 })
              }
              min={50}
              max={150}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-700 space-y-3">
            <label className="flex items-center justify-between">
              <span>Notificaciones en la app</span>
              <input
                type="checkbox"
                checked={settings.notifyInApp}
                onChange={(e) => setSettings({ ...settings, notifyInApp: e.target.checked })}
                className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between">
              <span>Notificaciones externas (WhatsApp/Telegram)</span>
              <input
                type="checkbox"
                checked={settings.notifyExternal}
                onChange={(e) => setSettings({ ...settings, notifyExternal: e.target.checked })}
                className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {saved ? <Check className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
          {saved ? 'Guardado' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}

// AI Tab
function AITab() {
  const [config, setConfig] = useState<AIAgentConfig>(loadAIConfig());
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setIsChecking(true);
    const connected = await checkOllamaConnection();
    setIsConnected(connected);

    if (connected) {
      const models = await getAvailableModels();
      setAvailableModels(models);
    }
    setIsChecking(false);
  };

  const handleSave = () => {
    saveAIConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Connection Status */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isChecking ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : isConnected ? (
              <Wifi className="w-5 h-5 text-green-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-400" />
            )}
            <div>
              <p className="font-medium">
                Ollama {isConnected ? 'Conectado' : 'Desconectado'}
              </p>
              <p className="text-sm text-slate-400">
                {isConnected
                  ? `${availableModels.length} modelo(s) disponible(s)`
                  : 'Asegúrate de que Ollama esté corriendo'}
              </p>
            </div>
          </div>
          <button
            onClick={checkConnection}
            disabled={isChecking}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* AI Settings */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-purple-400" />
          <h3 className="font-semibold">Configuración del Agente IA</h3>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span>Habilitar agente IA</span>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"
            />
          </label>

          <div>
            <label className="block text-sm text-slate-400 mb-2">URL de Ollama</label>
            <input
              type="text"
              value={config.ollamaUrl}
              onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-indigo-500 focus:outline-none"
              placeholder="http://localhost:11434"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Modelo</label>
            {availableModels.length > 0 ? (
              <select
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-indigo-500 focus:outline-none"
              >
                {availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-indigo-500 focus:outline-none"
                placeholder="llama3.2"
              />
            )}
            <p className="text-xs text-slate-500 mt-1">
              Modelos recomendados: llama3.2, mistral, phi3
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-700/50 rounded-lg">
          <h4 className="font-medium mb-2">¿Qué hace el agente IA?</h4>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>• Analiza el estado del stock y genera sugerencias</li>
            <li>• Calcula cantidades óptimas de reposición</li>
            <li>• Genera mensajes de alerta personalizados</li>
            <li>• Prioriza productos por urgencia</li>
          </ul>
        </div>

        <button
          onClick={handleSave}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {saved ? <Check className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
          {saved ? 'Guardado' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}

// Messaging Tab
function MessagingTab() {
  const [config, setConfig] = useState<MessagingConfig>(loadMessagingConfig());
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<{
    telegram: boolean | null;
    whatsapp: boolean | null;
    webhook: boolean | null;
  } | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveMessagingConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setIsTesting(true);
    const results = await testMessagingConnections();
    setTestResults(results);
    setIsTesting(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Telegram */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold">Telegram</h3>
              <p className="text-sm text-slate-400">Enviar alertas a un grupo de Telegram</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.telegramEnabled}
            onChange={(e) => setConfig({ ...config, telegramEnabled: e.target.checked })}
            className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"
          />
        </div>

        {config.telegramEnabled && (
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Bot Token</label>
              <input
                type="password"
                value={config.telegramBotToken}
                onChange={(e) => setConfig({ ...config, telegramBotToken: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-indigo-500 focus:outline-none"
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Chat ID</label>
              <input
                type="text"
                value={config.telegramChatId}
                onChange={(e) => setConfig({ ...config, telegramChatId: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-indigo-500 focus:outline-none"
                placeholder="-1001234567890"
              />
            </div>
            {testResults?.telegram !== undefined && (
              <div className={`flex items-center gap-2 ${testResults.telegram ? 'text-green-400' : 'text-red-400'}`}>
                {testResults.telegram ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {testResults.telegram ? 'Conexión exitosa' : 'Error de conexión'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* WhatsApp */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold">WhatsApp</h3>
              <p className="text-sm text-slate-400">Via webhook (Twilio, MessageBird, etc.)</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.whatsappEnabled}
            onChange={(e) => setConfig({ ...config, whatsappEnabled: e.target.checked })}
            className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-indigo-500"
          />
        </div>

        {config.whatsappEnabled && (
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Webhook URL</label>
              <input
                type="url"
                value={config.whatsappWebhookUrl}
                onChange={(e) => setConfig({ ...config, whatsappWebhookUrl: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-indigo-500 focus:outline-none"
                placeholder="https://api.twilio.com/..."
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">API Key (opcional)</label>
              <input
                type="password"
                value={config.whatsappApiKey || ''}
                onChange={(e) => setConfig({ ...config, whatsappApiKey: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:border-indigo-500 focus:outline-none"
              />
            </div>
            {testResults?.whatsapp !== undefined && (
              <div className={`flex items-center gap-2 ${testResults.whatsapp ? 'text-green-400' : 'text-red-400'}`}>
                {testResults.whatsapp ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {testResults.whatsapp ? 'Conexión exitosa' : 'Error de conexión'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleTest}
          disabled={isTesting}
          className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isTesting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
          Probar Conexiones
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {saved ? <Check className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
          {saved ? 'Guardado' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
