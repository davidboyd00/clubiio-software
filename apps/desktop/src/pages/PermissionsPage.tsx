import { useState, useEffect, useCallback } from 'react';
import {
  StaffRole,
  Permission,
  permissionsApi,
} from '../lib/api';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  bartender: 'Bartender',
  cashier: 'Cajero',
  warehouse: 'Bodega',
};

const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  admin: 'Acceso completo a todas las funciones del sistema',
  manager: 'Gestión de personal, reportes y configuración de venue',
  bartender: 'Punto de venta y gestión de stock en barra',
  cashier: 'Punto de venta y movimientos de caja',
  warehouse: 'Gestión de inventario y stock',
};

const CATEGORY_LABELS: Record<string, string> = {
  pos: 'Punto de Venta',
  inventory: 'Inventario',
  cash: 'Caja',
  reports: 'Reportes',
  settings: 'Configuración',
  staff: 'Personal',
};

// Default permissions for when API is not available
const DEFAULT_PERMISSIONS: Permission[] = [
  { id: 'pos.view', name: 'Ver POS', description: 'Ver el punto de venta', category: 'pos' },
  { id: 'pos.sell', name: 'Realizar ventas', description: 'Crear órdenes y procesar pagos', category: 'pos' },
  { id: 'pos.void', name: 'Anular ventas', description: 'Anular órdenes completadas', category: 'pos' },
  { id: 'pos.discount', name: 'Aplicar descuentos', description: 'Aplicar descuentos a órdenes', category: 'pos' },
  { id: 'inventory.view', name: 'Ver inventario', description: 'Ver stock y productos', category: 'inventory' },
  { id: 'inventory.edit', name: 'Editar inventario', description: 'Modificar stock y productos', category: 'inventory' },
  { id: 'inventory.transfer', name: 'Transferir stock', description: 'Transferir stock entre barras', category: 'inventory' },
  { id: 'cash.view', name: 'Ver caja', description: 'Ver movimientos de caja', category: 'cash' },
  { id: 'cash.open', name: 'Abrir caja', description: 'Iniciar sesión de caja', category: 'cash' },
  { id: 'cash.close', name: 'Cerrar caja', description: 'Cerrar sesión de caja', category: 'cash' },
  { id: 'cash.movement', name: 'Movimientos de caja', description: 'Realizar depósitos y retiros', category: 'cash' },
  { id: 'reports.view', name: 'Ver reportes', description: 'Acceder a reportes básicos', category: 'reports' },
  { id: 'reports.export', name: 'Exportar reportes', description: 'Exportar datos a CSV/Excel', category: 'reports' },
  { id: 'settings.view', name: 'Ver configuración', description: 'Ver configuración del sistema', category: 'settings' },
  { id: 'settings.edit', name: 'Editar configuración', description: 'Modificar configuración', category: 'settings' },
  { id: 'staff.view', name: 'Ver personal', description: 'Ver lista de personal', category: 'staff' },
  { id: 'staff.edit', name: 'Gestionar personal', description: 'Crear y editar personal', category: 'staff' },
  { id: 'staff.shifts', name: 'Gestionar turnos', description: 'Crear y editar turnos', category: 'staff' },
];

// Default role permissions
const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, string[]> = {
  admin: DEFAULT_PERMISSIONS.map(p => p.id),
  manager: [
    'pos.view', 'pos.sell', 'pos.void', 'pos.discount',
    'inventory.view', 'inventory.edit', 'inventory.transfer',
    'cash.view', 'cash.open', 'cash.close', 'cash.movement',
    'reports.view', 'reports.export',
    'settings.view',
    'staff.view', 'staff.edit', 'staff.shifts',
  ],
  bartender: [
    'pos.view', 'pos.sell',
    'inventory.view',
    'cash.view',
  ],
  cashier: [
    'pos.view', 'pos.sell', 'pos.discount',
    'cash.view', 'cash.open', 'cash.close', 'cash.movement',
  ],
  warehouse: [
    'inventory.view', 'inventory.edit', 'inventory.transfer',
    'reports.view',
  ],
};

export default function PermissionsPage() {
  const { isOnline } = useOnlineStatus();
  const [permissions, setPermissions] = useState<Permission[]>(DEFAULT_PERMISSIONS);
  const [selectedRole, setSelectedRole] = useState<StaffRole>('admin');
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const loadPermissions = useCallback(async () => {
    if (!isOnline) {
      // Use defaults when offline
      setPermissions(DEFAULT_PERMISSIONS);
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS[selectedRole]);
      return;
    }

    try {
      setLoading(true);
      const [permResponse, roleResponse] = await Promise.all([
        permissionsApi.getAll(),
        permissionsApi.getRolePermissions(selectedRole),
      ]);

      if (permResponse.data.success && permResponse.data.data) {
        setPermissions(permResponse.data.data);
      }

      if (roleResponse.data.success && roleResponse.data.data) {
        setRolePermissions(roleResponse.data.data.permissions);
      }
    } catch (err) {
      // Fall back to defaults on error
      setPermissions(DEFAULT_PERMISSIONS);
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS[selectedRole]);
      console.error('Error loading permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [isOnline, selectedRole]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const handleRoleChange = (role: StaffRole) => {
    if (hasChanges) {
      if (!confirm('Tienes cambios sin guardar. ¿Deseas continuar?')) {
        return;
      }
    }
    setSelectedRole(role);
    setHasChanges(false);
  };

  const handlePermissionToggle = (permissionId: string) => {
    setRolePermissions(prev => {
      if (prev.includes(permissionId)) {
        return prev.filter(id => id !== permissionId);
      }
      return [...prev, permissionId];
    });
    setHasChanges(true);
  };

  const handleCategoryToggle = (category: string) => {
    const categoryPermissions = permissions
      .filter(p => p.category === category)
      .map(p => p.id);

    const allSelected = categoryPermissions.every(id => rolePermissions.includes(id));

    setRolePermissions(prev => {
      if (allSelected) {
        return prev.filter(id => !categoryPermissions.includes(id));
      }
      return [...new Set([...prev, ...categoryPermissions])];
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!isOnline) {
      setError('No hay conexión para guardar cambios');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await permissionsApi.updateRolePermissions(selectedRole, rolePermissions);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando permisos');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setRolePermissions(DEFAULT_ROLE_PERMISSIONS[selectedRole]);
    setHasChanges(true);
  };

  // Group permissions by category
  const permissionsByCategory = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles y Permisos</h1>
          <p className="text-gray-500 mt-1">Configura los permisos para cada rol de usuario</p>
        </div>
        {hasChanges && (
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Restaurar predeterminados
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isOnline}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
            ×
          </button>
        </div>
      )}

      {!isOnline && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-700">
          Modo sin conexión - Los cambios no se guardarán
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Roles List */}
        <div className="col-span-4">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Roles</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {(Object.keys(ROLE_LABELS) as StaffRole[]).map(role => (
                <button
                  key={role}
                  onClick={() => handleRoleChange(role)}
                  className={`w-full p-4 text-left transition-colors ${
                    selectedRole === role
                      ? 'bg-blue-50 border-l-4 border-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-gray-900">{ROLE_LABELS[role]}</div>
                  <div className="text-sm text-gray-500 mt-1">{ROLE_DESCRIPTIONS[role]}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Permissions Grid */}
        <div className="col-span-8">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Permisos de {ROLE_LABELS[selectedRole]}
                </h2>
                <p className="text-sm text-gray-500">
                  {rolePermissions.length} de {permissions.length} permisos activos
                </p>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">Cargando...</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {Object.entries(permissionsByCategory).map(([category, categoryPerms]) => {
                  const allSelected = categoryPerms.every(p => rolePermissions.includes(p.id));
                  const someSelected = categoryPerms.some(p => rolePermissions.includes(p.id));

                  return (
                    <div key={category} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900">
                          {CATEGORY_LABELS[category] || category}
                        </h3>
                        <button
                          onClick={() => handleCategoryToggle(category)}
                          className={`text-sm px-3 py-1 rounded-full ${
                            allSelected
                              ? 'bg-blue-100 text-blue-700'
                              : someSelected
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {categoryPerms.map(permission => (
                          <label
                            key={permission.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              rolePermissions.includes(permission.id)
                                ? 'border-blue-200 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={rolePermissions.includes(permission.id)}
                              onChange={() => handlePermissionToggle(permission.id)}
                              className="mt-1 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 text-sm">
                                {permission.name}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {permission.description}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
