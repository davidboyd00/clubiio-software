import { useEffect, useState } from 'react';
import { tenantsApi } from '@/lib/superAdminApi';
import {
  Building2,
  Users,
  MapPin,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  Play,
  Pause,
  Calendar,
} from 'lucide-react';
import clsx from 'clsx';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  subscriptionExpiresAt: string | null;
  trialEndsAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  maxVenues: number;
  maxUsers: number;
  licenseKey: string | null;
  createdAt: string;
  _count: {
    venues: number;
    users: number;
  };
}

const statusConfig = {
  ACTIVE: {
    label: 'Activo',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: CheckCircle2,
  },
  TRIAL: {
    label: 'Prueba',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: Clock,
  },
  SUSPENDED: {
    label: 'Suspendido',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: AlertTriangle,
  },
  CANCELLED: {
    label: 'Cancelado',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: XCircle,
  },
};

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activateMonths, setActivateMonths] = useState(1);
  const [suspendReason, setSuspendReason] = useState('');

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const response = await tenantsApi.list();
      setTenants(response.data.data?.tenants || response.data.tenants || []);
    } catch (err: any) {
      setError('Error al cargar tenants');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (tenant: Tenant) => {
    setActionLoading(tenant.id);
    try {
      await tenantsApi.activate(tenant.id, activateMonths);
      await loadTenants();
      setShowModal(false);
      setSelectedTenant(null);
      setActivateMonths(1);
    } catch (err: any) {
      console.error(err);
      alert('Error al activar: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (tenant: Tenant) => {
    setActionLoading(tenant.id);
    try {
      await tenantsApi.suspend(tenant.id, suspendReason || undefined);
      await loadTenants();
      setShowModal(false);
      setSelectedTenant(null);
      setSuspendReason('');
    } catch (err: any) {
      console.error(err);
      alert('Error al suspender: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-gray-400 mt-1">
            Gestiona las suscripciones de tus clientes
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar tenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/50 border border-red-800 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Tenants Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Estado
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Uso
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Expira
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredTenants.map((tenant) => {
                const status = statusConfig[tenant.subscriptionStatus];
                const StatusIcon = status.icon;

                return (
                  <tr
                    key={tenant.id}
                    className="hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{tenant.name}</p>
                          <p className="text-sm text-gray-400">{tenant.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                          status.color
                        )}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        {status.label}
                      </span>
                      {tenant.suspendedReason && (
                        <p className="text-xs text-red-400 mt-1">
                          {tenant.suspendedReason}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-gray-400">
                          <MapPin className="w-4 h-4" />
                          <span>
                            {tenant._count.venues}/{tenant.maxVenues}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-400">
                          <Users className="w-4 h-4" />
                          <span>
                            {tenant._count.users}/{tenant.maxUsers}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {formatDate(
                          tenant.subscriptionExpiresAt || tenant.trialEndsAt
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {tenant.subscriptionStatus === 'SUSPENDED' ||
                        tenant.subscriptionStatus === 'CANCELLED' ? (
                          <button
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setShowModal(true);
                            }}
                            disabled={actionLoading === tenant.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            {actionLoading === tenant.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                            Activar
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setShowModal(true);
                            }}
                            disabled={actionLoading === tenant.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            {actionLoading === tenant.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Pause className="w-4 h-4" />
                            )}
                            Suspender
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTenants.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No se encontraron tenants
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {showModal && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4">
            {selectedTenant.subscriptionStatus === 'SUSPENDED' ||
            selectedTenant.subscriptionStatus === 'CANCELLED' ? (
              // Activate Modal
              <>
                <h3 className="text-lg font-semibold text-white mb-4">
                  Activar Suscripción
                </h3>
                <p className="text-gray-400 mb-4">
                  Activar suscripción para{' '}
                  <strong className="text-white">{selectedTenant.name}</strong>
                </p>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Duración (meses)
                  </label>
                  <select
                    value={activateMonths}
                    onChange={(e) => setActivateMonths(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value={1}>1 mes</option>
                    <option value={3}>3 meses</option>
                    <option value={6}>6 meses</option>
                    <option value={12}>12 meses</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setSelectedTenant(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleActivate(selectedTenant)}
                    disabled={actionLoading === selectedTenant.id}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {actionLoading === selectedTenant.id && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    Activar
                  </button>
                </div>
              </>
            ) : (
              // Suspend Modal
              <>
                <h3 className="text-lg font-semibold text-white mb-4">
                  Suspender Suscripción
                </h3>
                <p className="text-gray-400 mb-4">
                  Suspender suscripción de{' '}
                  <strong className="text-white">{selectedTenant.name}</strong>
                </p>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Razón (opcional)
                  </label>
                  <input
                    type="text"
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Ej: Falta de pago"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg mb-4">
                  <p className="text-sm text-red-400">
                    El cliente no podrá usar el software hasta que reactives su
                    suscripción.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setSelectedTenant(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleSuspend(selectedTenant)}
                    disabled={actionLoading === selectedTenant.id}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {actionLoading === selectedTenant.id && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    Suspender
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
