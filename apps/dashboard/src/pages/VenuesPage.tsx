import { Plus, MapPin, Users, DollarSign, Settings, MoreVertical } from 'lucide-react';

// Sample data - replace with API
const sampleVenues = [
  {
    id: '1',
    name: 'Club Central',
    address: 'Av. Providencia 1234, Santiago',
    capacity: 500,
    todaySales: 4500000,
    activeStaff: 12,
    status: 'open',
  },
  {
    id: '2',
    name: 'Rooftop Bar',
    address: 'Isidora Goyenechea 3000, Las Condes',
    capacity: 200,
    todaySales: 1800000,
    activeStaff: 6,
    status: 'open',
  },
  {
    id: '3',
    name: 'Underground',
    address: 'Bellavista 456, Recoleta',
    capacity: 350,
    todaySales: 0,
    activeStaff: 0,
    status: 'closed',
  },
];

export default function VenuesPage() {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Venues</h1>
          <p className="text-gray-500">Administra tus locales</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Venue
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sampleVenues.map((venue) => (
          <div key={venue.id} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{venue.name}</h3>
                <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate max-w-[200px]">{venue.address}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    venue.status === 'open'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {venue.status === 'open' ? 'Abierto' : 'Cerrado'}
                </span>
                <button className="p-1 text-gray-400 hover:text-gray-600">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-gray-100">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                  <Users className="w-4 h-4" />
                </div>
                <p className="text-lg font-semibold text-gray-900">{venue.capacity}</p>
                <p className="text-xs text-gray-500">Capacidad</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                  <DollarSign className="w-4 h-4" />
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {venue.todaySales > 0 ? `${(venue.todaySales / 1000000).toFixed(1)}M` : '-'}
                </p>
                <p className="text-xs text-gray-500">Ventas Hoy</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                  <Users className="w-4 h-4" />
                </div>
                <p className="text-lg font-semibold text-gray-900">{venue.activeStaff}</p>
                <p className="text-xs text-gray-500">Staff Activo</p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                Ver detalles
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="card bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen General</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-500">Total Venues</p>
            <p className="text-2xl font-bold text-gray-900">{sampleVenues.length}</p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-500">Abiertos Ahora</p>
            <p className="text-2xl font-bold text-green-600">
              {sampleVenues.filter(v => v.status === 'open').length}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-500">Staff Total Activo</p>
            <p className="text-2xl font-bold text-gray-900">
              {sampleVenues.reduce((acc, v) => acc + v.activeStaff, 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <p className="text-sm text-gray-500">Ventas Totales Hoy</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(sampleVenues.reduce((acc, v) => acc + v.todaySales, 0))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
