import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  Store,
  Bell,
  Keyboard,
  Save,
  RotateCcw,
  Check,
} from 'lucide-react';

interface AppSettings {
  // Business
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessRut: string;
  receiptFooter: string;

  // Printer
  printerEnabled: boolean;
  printerName: string;
  printerWidth: '58mm' | '80mm';
  autoPrint: boolean;

  // Notifications
  soundEnabled: boolean;
  lowStockAlert: boolean;
  lowStockThreshold: number;

  // Shortcuts
  shortcutsEnabled: boolean;
}

const defaultSettings: AppSettings = {
  businessName: 'Clubio',
  businessAddress: '',
  businessPhone: '',
  businessRut: '',
  receiptFooter: 'Gracias por su compra!',
  printerEnabled: false,
  printerName: '',
  printerWidth: '80mm',
  autoPrint: false,
  soundEnabled: true,
  lowStockAlert: true,
  lowStockThreshold: 10,
  shortcutsEnabled: true,
};

const SETTINGS_KEY = 'clubio_settings';

export function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (e) {
        console.error('Error loading settings:', e);
      }
    }
  }, []);

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setHasChanges(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setHasChanges(true);
    setSaved(false);
  };

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
            <h1 className="font-semibold">Configuración</h1>
            <p className="text-xs text-slate-400">Ajustes de la aplicación</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-emerald-400 text-sm flex items-center gap-1">
              <Check className="w-4 h-4" />
              Guardado
            </span>
          )}
          <button
            onClick={handleReset}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400"
            title="Restablecer valores"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg transition-colors"
          >
            <Save className="w-5 h-5" />
            <span>Guardar</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Business Settings */}
          <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-3">
              <Store className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold">Datos del Negocio</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nombre del Negocio
                </label>
                <input
                  type="text"
                  value={settings.businessName}
                  onChange={(e) => handleChange('businessName', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="Mi Negocio"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Dirección
                </label>
                <input
                  type="text"
                  value={settings.businessAddress}
                  onChange={(e) => handleChange('businessAddress', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="Calle 123, Ciudad"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={settings.businessPhone}
                    onChange={(e) => handleChange('businessPhone', e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                    placeholder="+56 9 1234 5678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    RUT
                  </label>
                  <input
                    type="text"
                    value={settings.businessRut}
                    onChange={(e) => handleChange('businessRut', e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                    placeholder="12.345.678-9"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Mensaje en Ticket
                </label>
                <input
                  type="text"
                  value={settings.receiptFooter}
                  onChange={(e) => handleChange('receiptFooter', e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="Gracias por su compra!"
                />
              </div>
            </div>
          </section>

          {/* Printer Settings */}
          <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-3">
              <Printer className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold">Impresora</h2>
            </div>
            <div className="p-4 space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Habilitar impresión</span>
                <input
                  type="checkbox"
                  checked={settings.printerEnabled}
                  onChange={(e) => handleChange('printerEnabled', e.target.checked)}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              {settings.printerEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Nombre de Impresora
                    </label>
                    <input
                      type="text"
                      value={settings.printerName}
                      onChange={(e) => handleChange('printerName', e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                      placeholder="POS-80"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Ancho de Papel
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleChange('printerWidth', '58mm')}
                        className={`flex-1 py-2.5 rounded-xl font-medium transition-colors ${
                          settings.printerWidth === '58mm'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        58mm
                      </button>
                      <button
                        onClick={() => handleChange('printerWidth', '80mm')}
                        className={`flex-1 py-2.5 rounded-xl font-medium transition-colors ${
                          settings.printerWidth === '80mm'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        80mm
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">Imprimir automáticamente al completar venta</span>
                    <input
                      type="checkbox"
                      checked={settings.autoPrint}
                      onChange={(e) => handleChange('autoPrint', e.target.checked)}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                </>
              )}
            </div>
          </section>

          {/* Notifications */}
          <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-3">
              <Bell className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold">Notificaciones</h2>
            </div>
            <div className="p-4 space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Sonidos habilitados</span>
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={(e) => handleChange('soundEnabled', e.target.checked)}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Alertas de stock bajo</span>
                <input
                  type="checkbox"
                  checked={settings.lowStockAlert}
                  onChange={(e) => handleChange('lowStockAlert', e.target.checked)}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              {settings.lowStockAlert && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Umbral de stock bajo
                  </label>
                  <input
                    type="number"
                    value={settings.lowStockThreshold}
                    onChange={(e) => handleChange('lowStockThreshold', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                    min="1"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-3">
              <Keyboard className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold">Atajos de Teclado</h2>
            </div>
            <div className="p-4 space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Atajos habilitados</span>
                <input
                  type="checkbox"
                  checked={settings.shortcutsEnabled}
                  onChange={(e) => handleChange('shortcutsEnabled', e.target.checked)}
                  className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              {settings.shortcutsEnabled && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">Buscar producto</span>
                    <kbd className="px-2 py-1 bg-slate-700 rounded text-slate-300">Ctrl + K</kbd>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">Completar venta</span>
                    <kbd className="px-2 py-1 bg-slate-700 rounded text-slate-300">Ctrl + Enter</kbd>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">Limpiar carrito</span>
                    <kbd className="px-2 py-1 bg-slate-700 rounded text-slate-300">Ctrl + Backspace</kbd>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-700">
                    <span className="text-slate-400">Aplicar descuento</span>
                    <kbd className="px-2 py-1 bg-slate-700 rounded text-slate-300">Ctrl + D</kbd>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Ir a Dashboard</span>
                    <kbd className="px-2 py-1 bg-slate-700 rounded text-slate-300">Ctrl + Shift + D</kbd>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// Helper to get settings anywhere in the app
export function getSettings(): AppSettings {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    try {
      return { ...defaultSettings, ...JSON.parse(stored) };
    } catch {
      return defaultSettings;
    }
  }
  return defaultSettings;
}
