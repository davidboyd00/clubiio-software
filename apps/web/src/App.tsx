import { useState } from 'react';
import {
  Zap,
  BarChart3,
  Users,
  Clock,
  Shield,
  ChevronRight,
  Check,
  Menu,
  X,
  ArrowRight,
  Play,
  CreditCard,
  TrendingUp,
  Wifi
} from 'lucide-react';
import clsx from 'clsx';

// Navigation
function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const links = [
    { name: 'Características', href: '#features' },
    { name: 'Precios', href: '#pricing' },
    { name: 'Contacto', href: '#contact' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="container-custom">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="font-bold text-xl text-gray-900">Clubio</span>
          </a>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8">
            {links.map(link => (
              <a
                key={link.name}
                href={link.href}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-4">
            <a href="/login" className="btn btn-ghost">Iniciar Sesión</a>
            <a href="#contact" className="btn btn-primary">
              Comenzar Gratis
              <ChevronRight className="w-4 h-4 ml-1" />
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 text-gray-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col gap-2">
              {links.map(link => (
                <a
                  key={link.name}
                  href={link.href}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.name}
                </a>
              ))}
              <div className="flex flex-col gap-2 mt-4 px-4">
                <a href="/login" className="btn btn-secondary">Iniciar Sesión</a>
                <a href="#contact" className="btn btn-primary">Comenzar Gratis</a>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// Hero Section
function Hero() {
  return (
    <section className="pt-32 lg:pt-40 pb-20 lg:pb-32 overflow-hidden">
      <div className="container-custom">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-full text-primary-700 text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              <span>Nuevo: Festival Mode con Queue Engine</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
              El POS más rápido para{' '}
              <span className="gradient-text">bares y festivales</span>
            </h1>

            <p className="text-lg lg:text-xl text-gray-600 mb-8 max-w-xl">
              Optimiza tus ventas con nuestra plataforma intuitiva. Reduce tiempos de espera,
              aumenta la satisfacción de tus clientes y maximiza tus ingresos.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <a href="#contact" className="btn btn-primary text-lg px-8">
                Prueba Gratis 14 Días
                <ArrowRight className="w-5 h-5 ml-2" />
              </a>
              <a href="#demo" className="btn btn-secondary text-lg px-8">
                <Play className="w-5 h-5 mr-2" />
                Ver Demo
              </a>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8">
              <div>
                <p className="text-3xl font-bold text-gray-900">500+</p>
                <p className="text-gray-500">Clientes activos</p>
              </div>
              <div className="w-px h-12 bg-gray-200" />
              <div>
                <p className="text-3xl font-bold text-gray-900">2M+</p>
                <p className="text-gray-500">Transacciones/mes</p>
              </div>
              <div className="w-px h-12 bg-gray-200" />
              <div>
                <p className="text-3xl font-bold text-gray-900">99.9%</p>
                <p className="text-gray-500">Uptime</p>
              </div>
            </div>
          </div>

          {/* Hero Image/Mockup */}
          <div className="relative">
            <div className="relative bg-gradient-to-br from-primary-500 to-purple-600 rounded-3xl p-1">
              <div className="bg-gray-900 rounded-[22px] p-4">
                <div className="bg-gray-800 rounded-xl overflow-hidden">
                  {/* Fake Dashboard Preview */}
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">C</span>
                        </div>
                        <span className="text-white font-semibold">Dashboard</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-gray-400 text-xs">Ventas Hoy</p>
                        <p className="text-white font-bold text-lg">$4.2M</p>
                        <p className="text-green-400 text-xs">+12.5%</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-gray-400 text-xs">Órdenes</p>
                        <p className="text-white font-bold text-lg">435</p>
                        <p className="text-green-400 text-xs">+8.2%</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-3">
                        <p className="text-gray-400 text-xs">Ticket Prom.</p>
                        <p className="text-white font-bold text-lg">$9,287</p>
                        <p className="text-red-400 text-xs">-2.1%</p>
                      </div>
                    </div>

                    <div className="bg-gray-700/50 rounded-lg p-3 h-32 flex items-end">
                      <div className="flex items-end gap-1 w-full">
                        {[40, 65, 45, 80, 55, 90, 70, 85, 95, 75, 60, 50].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-gradient-to-t from-primary-500 to-purple-500 rounded-t"
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Cards */}
            <div className="absolute -left-8 top-1/4 bg-white rounded-xl shadow-xl p-4 animate-bounce" style={{ animationDuration: '3s' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ventas +</p>
                  <p className="font-bold text-gray-900">32%</p>
                </div>
              </div>
            </div>

            <div className="absolute -right-4 bottom-1/4 bg-white rounded-xl shadow-xl p-4 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Tiempo espera</p>
                  <p className="font-bold text-gray-900">-45%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Features Section
function Features() {
  const features = [
    {
      icon: Zap,
      title: 'Ultra Rápido',
      description: 'Procesa órdenes en segundos. Interfaz optimizada para máxima velocidad en eventos de alto volumen.',
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      icon: BarChart3,
      title: 'Analytics en Tiempo Real',
      description: 'Dashboard con métricas en vivo. Visualiza ventas, productos top y rendimiento del staff al instante.',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: Users,
      title: 'Gestión de Staff',
      description: 'Control total de tu equipo. Turnos, permisos, comisiones y reportes de productividad.',
      color: 'bg-purple-100 text-purple-600',
    },
    {
      icon: CreditCard,
      title: 'Multi-Pago',
      description: 'Acepta efectivo, tarjetas, transferencias y más. Integración con los principales procesadores.',
      color: 'bg-green-100 text-green-600',
    },
    {
      icon: Wifi,
      title: 'Modo Offline',
      description: 'Sigue vendiendo sin internet. Sincronización automática cuando se restablece la conexión.',
      color: 'bg-orange-100 text-orange-600',
    },
    {
      icon: Shield,
      title: 'Seguridad Total',
      description: 'Encriptación de datos, backups automáticos y control de acceso por roles.',
      color: 'bg-red-100 text-red-600',
    },
  ];

  return (
    <section id="features" className="section bg-gray-50">
      <div className="container-custom">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Todo lo que necesitas para{' '}
            <span className="gradient-text">vender más</span>
          </h2>
          <p className="text-lg text-gray-600">
            Herramientas poderosas diseñadas específicamente para bares, clubs y festivales.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-8 shadow-sm card-hover"
            >
              <div className={clsx('w-14 h-14 rounded-xl flex items-center justify-center mb-6', feature.color)}>
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Festival Mode Highlight */}
        <div className="mt-20 bg-gradient-to-br from-primary-600 to-purple-600 rounded-3xl p-8 lg:p-12 text-white">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-sm font-medium mb-4">
                <Zap className="w-4 h-4" />
                Festival Mode
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold mb-4">
                Diseñado para eventos masivos
              </h3>
              <p className="text-white/80 mb-6">
                Nuestro Queue Engine optimiza automáticamente el flujo de órdenes para reducir
                tiempos de espera hasta un 60%. Monitorea todas tus barras en tiempo real.
              </p>
              <ul className="space-y-3">
                {[
                  'Batching inteligente de órdenes',
                  'Balanceo de carga entre barras',
                  'Alertas automáticas de sobrecarga',
                  'Métricas P95 en tiempo real',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-white/60 text-sm">Barras Activas</p>
                  <p className="text-3xl font-bold">8/10</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-white/60 text-sm">Cola Total</p>
                  <p className="text-3xl font-bold">128</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-white/60 text-sm">Tiempo P95</p>
                  <p className="text-3xl font-bold">4.2s</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-white/60 text-sm">Throughput</p>
                  <p className="text-3xl font-bold">342/m</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Benefits Section
function Benefits() {
  const benefits = [
    {
      icon: TrendingUp,
      title: 'Optimiza tus Costos',
      description: 'Reduce gastos operativos hasta un 35%. Automatiza procesos, elimina errores manuales y toma decisiones basadas en datos reales de tu negocio.',
      stats: '35%',
      statsLabel: 'Reducción de costos',
      color: 'from-green-500 to-emerald-600',
    },
    {
      icon: Shield,
      title: 'Elimina Pérdidas de Stock',
      description: 'Control de inventario en tiempo real. Detecta mermas, previene robos y optimiza tus compras con alertas inteligentes de reposición.',
      stats: '90%',
      statsLabel: 'Menos pérdidas',
      color: 'from-red-500 to-orange-600',
    },
    {
      icon: Users,
      title: 'Experiencia Completa',
      description: 'Desde el pedido hasta el pago, ofrece una experiencia fluida. Reduce tiempos de espera y aumenta la satisfacción de tus clientes.',
      stats: '4.8★',
      statsLabel: 'Satisfacción cliente',
      color: 'from-purple-500 to-pink-600',
    },
    {
      icon: CreditCard,
      title: 'Fideliza a tus Clientes',
      description: 'Programa de lealtad integrado, historial de compras y promociones personalizadas. Convierte visitantes ocasionales en clientes frecuentes.',
      stats: '2.5x',
      statsLabel: 'Mayor retención',
      color: 'from-blue-500 to-cyan-600',
    },
  ];

  return (
    <section className="section">
      <div className="container-custom">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full text-green-700 text-sm font-medium mb-6">
            <TrendingUp className="w-4 h-4" />
            <span>Soluciones que impulsan tu negocio</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Beneficios que{' '}
            <span className="gradient-text">transforman tu operación</span>
          </h2>
          <p className="text-lg text-gray-600">
            No solo vendemos software, entregamos resultados medibles para tu negocio nocturno.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="group relative bg-white rounded-2xl p-8 shadow-sm border border-gray-100 card-hover overflow-hidden"
            >
              {/* Background gradient on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${benefit.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

              <div className="relative flex gap-6">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${benefit.color} flex items-center justify-center flex-shrink-0`}>
                  <benefit.icon className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{benefit.title}</h3>
                  <p className="text-gray-600 mb-4">{benefit.description}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold bg-gradient-to-r ${benefit.color} bg-clip-text text-transparent`}>
                      {benefit.stats}
                    </span>
                    <span className="text-sm text-gray-500">{benefit.statsLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Administra desde cualquier lugar */}
        <div className="relative bg-gray-900 rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600/20 to-purple-600/20" />
          <div className="relative grid lg:grid-cols-2 gap-8 p-8 lg:p-12 items-center">
            <div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                Administra tu negocio desde cualquier lugar
              </h3>
              <p className="text-gray-300 mb-6">
                Ya sea que estés en casa, de viaje o en otro local, mantén el control total de tu operación.
                Monitorea ventas, gestiona staff y toma decisiones en tiempo real desde tu celular o computador.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Dashboard móvil con métricas en vivo',
                  'Alertas instantáneas de eventos importantes',
                  'Gestión remota de permisos y accesos',
                  'Reportes automáticos por email',
                  'Cierre de caja desde cualquier dispositivo',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-300">
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a href="#contact" className="btn btn-primary">
                Comienza Ahora
                <ArrowRight className="w-4 h-4 ml-2" />
              </a>
            </div>

            {/* Mobile mockup */}
            <div className="flex justify-center">
              <div className="relative">
                {/* Phone frame */}
                <div className="w-64 h-[500px] bg-gray-800 rounded-[3rem] p-3 shadow-2xl">
                  <div className="w-full h-full bg-gray-900 rounded-[2.5rem] overflow-hidden">
                    {/* Status bar */}
                    <div className="h-8 bg-gray-800 flex items-center justify-center">
                      <div className="w-20 h-5 bg-gray-900 rounded-full" />
                    </div>
                    {/* App content */}
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-xs">Hola, Admin</p>
                          <p className="text-white font-semibold">Club Central</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center">
                          <span className="text-white text-sm font-bold">A</span>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-primary-500 to-purple-500 rounded-xl p-4">
                        <p className="text-white/80 text-xs">Ventas de hoy</p>
                        <p className="text-white text-2xl font-bold">$4.250.000</p>
                        <p className="text-green-300 text-xs">↑ 12.5% vs ayer</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-800 rounded-xl p-3">
                          <p className="text-gray-400 text-xs">Órdenes</p>
                          <p className="text-white font-bold">435</p>
                        </div>
                        <div className="bg-gray-800 rounded-xl p-3">
                          <p className="text-gray-400 text-xs">Staff activo</p>
                          <p className="text-white font-bold">8</p>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-xl p-3">
                        <p className="text-gray-400 text-xs mb-2">Top productos</p>
                        <div className="space-y-2">
                          {['Cerveza Draft', 'Vodka Tonic', 'Pisco Sour'].map((p, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <span className="text-white text-sm">{p}</span>
                              <span className="text-gray-400 text-xs">{245 - i * 50}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating notification */}
                <div className="absolute -right-4 top-1/3 bg-white rounded-xl shadow-xl p-3 animate-bounce" style={{ animationDuration: '3s' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900">Venta completada</p>
                      <p className="text-xs text-gray-500">$45.000</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Pricing Section
function Pricing() {
  const plans = [
    {
      name: 'Starter',
      price: '49.990',
      description: 'Perfecto para bares pequeños',
      features: [
        '1 punto de venta',
        'Hasta 3 usuarios',
        'Reportes básicos',
        'Soporte por email',
        'Actualizaciones incluidas',
      ],
      popular: false,
      customPrice: false,
    },
    {
      name: 'Pro',
      price: '99.990',
      description: 'Para negocios en crecimiento',
      features: [
        'Hasta 5 puntos de venta',
        'Usuarios ilimitados',
        'Analytics avanzados',
        'Soporte prioritario 24/7',
        'API access',
        'Integraciones premium',
      ],
      popular: true,
      customPrice: false,
    },
    {
      name: 'Festival',
      price: 'Consultar',
      description: 'Eventos masivos y festivales',
      features: [
        'Puntos de venta ilimitados',
        'Festival Mode + Queue Engine',
        'Dashboard en tiempo real',
        'Soporte dedicado on-site',
        'Setup y capacitación',
        'SLA 99.99% garantizado',
      ],
      popular: false,
      customPrice: true,
    },
  ];

  return (
    <section id="pricing" className="section">
      <div className="container-custom">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            Planes simples,{' '}
            <span className="gradient-text">precios transparentes</span>
          </h2>
          <p className="text-lg text-gray-600">
            Sin costos ocultos. Cancela cuando quieras.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={clsx(
                'rounded-2xl p-8 relative',
                plan.popular
                  ? 'bg-primary-600 text-white shadow-xl shadow-primary-600/25 scale-105'
                  : 'bg-white border border-gray-200'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-400 text-yellow-900 text-sm font-semibold rounded-full">
                  Más Popular
                </div>
              )}

              <h3 className={clsx('text-xl font-bold mb-2', plan.popular ? 'text-white' : 'text-gray-900')}>
                {plan.name}
              </h3>
              <p className={clsx('text-sm mb-4', plan.popular ? 'text-white/80' : 'text-gray-500')}>
                {plan.description}
              </p>

              <div className="mb-6">
                <span className={clsx('text-4xl font-bold', plan.popular ? 'text-white' : 'text-gray-900')}>
                  {plan.customPrice ? plan.price : `$${plan.price}`}
                </span>
                {!plan.customPrice && (
                  <span className={clsx('text-sm', plan.popular ? 'text-white/80' : 'text-gray-500')}>
                    /mes CLP
                  </span>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className={clsx('w-5 h-5', plan.popular ? 'text-green-300' : 'text-green-500')} />
                    <span className={plan.popular ? 'text-white/90' : 'text-gray-600'}>{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#contact"
                className={clsx(
                  'btn w-full',
                  plan.popular
                    ? 'bg-white text-primary-600 hover:bg-gray-100'
                    : 'btn-primary'
                )}
              >
                Comenzar Ahora
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


// CTA Section
function CTA() {
  return (
    <section id="contact" className="section">
      <div className="container-custom">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 lg:p-16 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            ¿Listo para transformar tu negocio?
          </h2>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Únete a más de 500 bares y festivales que ya usan Clubio.
            Prueba gratis por 14 días, sin tarjeta de crédito.
          </p>

          <form className="max-w-md mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                placeholder="tu@email.com"
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button type="submit" className="btn btn-primary whitespace-nowrap">
                Comenzar Gratis
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </form>

          <p className="text-gray-400 text-sm mt-4">
            Sin tarjeta de crédito requerida. Cancela cuando quieras.
          </p>
        </div>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  const links = {
    Producto: ['Características', 'Precios', 'Integraciones', 'API'],
    Empresa: ['Sobre Nosotros', 'Blog', 'Carreras', 'Contacto'],
    Legal: ['Privacidad', 'Términos', 'Cookies'],
    Soporte: ['Centro de Ayuda', 'Documentación', 'Status'],
  };

  return (
    <footer className="bg-gray-900 text-gray-300 py-16">
      <div className="container-custom">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center">
                <span className="text-white font-bold text-xl">C</span>
              </div>
              <span className="font-bold text-xl text-white">Clubio</span>
            </div>
            <p className="text-gray-400 text-sm">
              El sistema POS más rápido para bares y festivales.
            </p>
          </div>

          {/* Links */}
          {Object.entries(links).map(([title, items]) => (
            <div key={title}>
              <h4 className="font-semibold text-white mb-4">{title}</h4>
              <ul className="space-y-2">
                {items.map(item => (
                  <li key={item}>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} Clubio. Todos los derechos reservados.
          </p>
          <div className="flex gap-6">
            {['Twitter', 'LinkedIn', 'Instagram'].map(social => (
              <a key={social} href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                {social}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// Main App
export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Benefits />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
