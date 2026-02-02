import { useEffect, useState } from 'react';
import { statsApi } from '@/lib/superAdminApi';
import {
  Building2,
  Users,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface Stats {
  tenants: {
    total: number;
    active: number;
    suspended: number;
    trial: number;
  };
  users: number;
  venues: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await statsApi.get();
      setStats(response.data.data?.stats || response.data.stats);
    } catch (err: any) {
      setError('Error al cargar estadísticas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/50 border border-red-800 rounded-lg text-red-400">
        {error}
      </div>
    );
  }

  const statCards = [
    {
      name: 'Total Tenants',
      value: stats?.tenants.total || 0,
      icon: Building2,
      color: 'bg-blue-600',
      description: 'Clientes registrados',
    },
    {
      name: 'Activos',
      value: stats?.tenants.active || 0,
      icon: CheckCircle2,
      color: 'bg-green-600',
      description: 'Suscripciones activas',
    },
    {
      name: 'En Prueba',
      value: stats?.tenants.trial || 0,
      icon: Clock,
      color: 'bg-yellow-600',
      description: 'Periodo de prueba',
    },
    {
      name: 'Suspendidos',
      value: stats?.tenants.suspended || 0,
      icon: AlertTriangle,
      color: 'bg-red-600',
      description: 'Cuentas suspendidas',
    },
    {
      name: 'Total Usuarios',
      value: stats?.users || 0,
      icon: Users,
      color: 'bg-purple-600',
      description: 'En toda la plataforma',
    },
    {
      name: 'Total Venues',
      value: stats?.venues || 0,
      icon: MapPin,
      color: 'bg-indigo-600',
      description: 'Locales registrados',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">
          Vista general de la plataforma Clubio
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.name}
            className="bg-gray-800 border border-gray-700 rounded-xl p-6"
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}
              >
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-gray-400">{stat.name}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">{stat.description}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-red-400" />
          Resumen de Suscripciones
        </h2>

        <div className="space-y-4">
          {/* Active Bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Activos</span>
              <span className="text-green-400">{stats?.tenants.active || 0}</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    stats?.tenants.total
                      ? ((stats.tenants.active / stats.tenants.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Trial Bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">En Prueba</span>
              <span className="text-yellow-400">{stats?.tenants.trial || 0}</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    stats?.tenants.total
                      ? ((stats.tenants.trial / stats.tenants.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Suspended Bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Suspendidos</span>
              <span className="text-red-400">{stats?.tenants.suspended || 0}</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    stats?.tenants.total
                      ? ((stats.tenants.suspended / stats.tenants.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-300 mb-2">
          Información del Sistema
        </h3>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>
            • Verificación de licencias cada <strong className="text-white">5 minutos</strong> en apps desktop
          </li>
          <li>
            • Periodo de gracia offline: <strong className="text-white">3 días</strong>
          </li>
          <li>
            • Las suscripciones expiradas se suspenden automáticamente
          </li>
        </ul>
      </div>
    </div>
  );
}
