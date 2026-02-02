import { useState } from 'react';
import {
  Building2,
  Bell,
  CreditCard,
  Shield,
  Palette,
  Globe,
  Save,
  ChevronRight
} from 'lucide-react';
import clsx from 'clsx';

const settingsSections = [
  { id: 'general', name: 'General', icon: Building2, description: 'Información básica del negocio' },
  { id: 'notifications', name: 'Notificaciones', icon: Bell, description: 'Configura alertas y avisos' },
  { id: 'payments', name: 'Pagos', icon: CreditCard, description: 'Métodos de pago y facturación' },
  { id: 'security', name: 'Seguridad', icon: Shield, description: 'Contraseñas y acceso' },
  { id: 'appearance', name: 'Apariencia', icon: Palette, description: 'Personaliza la interfaz' },
  { id: 'localization', name: 'Localización', icon: Globe, description: 'Idioma, moneda y zona horaria' },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general');
  const [formData, setFormData] = useState({
    businessName: 'Mi Club',
    email: 'admin@miclub.com',
    phone: '+56 9 1234 5678',
    address: 'Av. Providencia 1234, Santiago',
    currency: 'CLP',
    timezone: 'America/Santiago',
    language: 'es',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500">Administra las preferencias de tu cuenta</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-2">
            <nav className="space-y-1">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                    activeSection === section.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <section.icon className="w-5 h-5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{section.name}</p>
                    <p className="text-xs text-gray-500 truncate">{section.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="card">
            {activeSection === 'general' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Información General</h3>
                  <p className="text-sm text-gray-500">Datos básicos de tu negocio</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del Negocio
                    </label>
                    <input
                      type="text"
                      value={formData.businessName}
                      onChange={(e) => handleInputChange('businessName', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dirección
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      className="input"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <button className="btn btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Guardar Cambios
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'localization' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Localización</h3>
                  <p className="text-sm text-gray-500">Configura idioma, moneda y zona horaria</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Idioma
                    </label>
                    <select
                      value={formData.language}
                      onChange={(e) => handleInputChange('language', e.target.value)}
                      className="input"
                    >
                      <option value="es">Español</option>
                      <option value="en">English</option>
                      <option value="pt">Português</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Moneda
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => handleInputChange('currency', e.target.value)}
                      className="input"
                    >
                      <option value="CLP">CLP - Peso Chileno</option>
                      <option value="USD">USD - Dólar</option>
                      <option value="EUR">EUR - Euro</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Zona Horaria
                    </label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => handleInputChange('timezone', e.target.value)}
                      className="input"
                    >
                      <option value="America/Santiago">America/Santiago (GMT-3)</option>
                      <option value="America/Lima">America/Lima (GMT-5)</option>
                      <option value="America/Buenos_Aires">America/Buenos_Aires (GMT-3)</option>
                      <option value="America/Bogota">America/Bogota (GMT-5)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <button className="btn btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Guardar Cambios
                  </button>
                </div>
              </div>
            )}

            {activeSection !== 'general' && activeSection !== 'localization' && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  {(() => {
                    const section = settingsSections.find(s => s.id === activeSection);
                    const Icon = section?.icon || Building2;
                    return <Icon className="w-8 h-8 text-gray-400" />;
                  })()}
                </div>
                <h3 className="text-lg font-medium text-gray-900">
                  {settingsSections.find(s => s.id === activeSection)?.name}
                </h3>
                <p className="text-gray-500 mt-2">
                  Esta sección estará disponible próximamente
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
