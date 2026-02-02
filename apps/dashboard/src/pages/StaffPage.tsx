import { useState } from 'react';
import { Search, UserPlus, MoreVertical, Shield, Clock } from 'lucide-react';

const roles = [
  { id: 'all', name: 'Todos' },
  { id: 'admin', name: 'Admin' },
  { id: 'manager', name: 'Manager' },
  { id: 'bartender', name: 'Bartender' },
  { id: 'waiter', name: 'Mesero' },
];

// Sample data - replace with API
const sampleStaff = [
  { id: '1', name: 'Carlos Méndez', email: 'carlos@ejemplo.com', role: 'admin', status: 'active', lastActive: '2024-01-15T10:30:00' },
  { id: '2', name: 'María González', email: 'maria@ejemplo.com', role: 'manager', status: 'active', lastActive: '2024-01-15T09:45:00' },
  { id: '3', name: 'Pedro Silva', email: 'pedro@ejemplo.com', role: 'bartender', status: 'active', lastActive: '2024-01-15T11:00:00' },
  { id: '4', name: 'Ana Rojas', email: 'ana@ejemplo.com', role: 'waiter', status: 'inactive', lastActive: '2024-01-10T18:00:00' },
  { id: '5', name: 'Luis Torres', email: 'luis@ejemplo.com', role: 'bartender', status: 'active', lastActive: '2024-01-15T10:15:00' },
];

export default function StaffPage() {
  const [selectedRole, setSelectedRole] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStaff = sampleStaff.filter((member) => {
    const matchesRole = selectedRole === 'all' || member.role === selectedRole;
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      case 'manager':
        return 'bg-blue-100 text-blue-700';
      case 'bartender':
        return 'bg-orange-100 text-orange-700';
      case 'waiter':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatLastActive = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} horas`;
    return `Hace ${diffDays} días`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-gray-500">Administra tu equipo de trabajo</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Agregar Staff
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedRole === role.id
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {role.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((member) => (
            <div
              key={member.id}
              className="border border-gray-200 rounded-xl p-4 hover:border-primary-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-700 font-semibold text-lg">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{member.name}</h3>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </div>
                </div>
                <button className="p-1 text-gray-400 hover:text-gray-600">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(member.role)}`}>
                    {member.role}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {formatLastActive(member.lastActive)}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    member.status === 'active' ? 'text-green-600' : 'text-gray-500'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    member.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  {member.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
