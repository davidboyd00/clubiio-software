import { prisma } from '../../common/database';

// ============================================
// PERMISSIONS SERVICE
// ============================================

export type StaffRole = 'admin' | 'manager' | 'bartender' | 'cashier' | 'warehouse';

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'pos' | 'inventory' | 'cash' | 'reports' | 'settings' | 'staff';
}

export interface RolePermissions {
  role: StaffRole;
  permissions: string[];
}

// Static permissions list
const ALL_PERMISSIONS: Permission[] = [
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

// Default permissions for each role
const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, string[]> = {
  admin: ALL_PERMISSIONS.map(p => p.id),
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

// In-memory store for custom role permissions per tenant
// In production, this should be stored in the database
const tenantRolePermissions = new Map<string, Map<StaffRole, string[]>>();

function getTenantPermissions(tenantId: string): Map<StaffRole, string[]> {
  if (!tenantRolePermissions.has(tenantId)) {
    // Initialize with default permissions
    const roleMap = new Map<StaffRole, string[]>();
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      roleMap.set(role as StaffRole, [...perms]);
    }
    tenantRolePermissions.set(tenantId, roleMap);
  }
  return tenantRolePermissions.get(tenantId)!;
}

export const permissionsService = {
  /**
   * Get all available permissions
   */
  getAllPermissions(): Permission[] {
    return ALL_PERMISSIONS;
  },

  /**
   * Get permissions for a specific role
   */
  getRolePermissions(tenantId: string, role: StaffRole): RolePermissions {
    const tenantPerms = getTenantPermissions(tenantId);
    const permissions = tenantPerms.get(role) || DEFAULT_ROLE_PERMISSIONS[role] || [];

    return {
      role,
      permissions,
    };
  },

  /**
   * Update permissions for a role
   */
  updateRolePermissions(tenantId: string, role: StaffRole, permissionIds: string[]): RolePermissions {
    // Validate permission IDs
    const validIds = new Set(ALL_PERMISSIONS.map(p => p.id));
    const validatedPermissions = permissionIds.filter(id => validIds.has(id));

    const tenantPerms = getTenantPermissions(tenantId);
    tenantPerms.set(role, validatedPermissions);

    return {
      role,
      permissions: validatedPermissions,
    };
  },

  /**
   * Check if a role has a specific permission
   */
  hasPermission(tenantId: string, role: StaffRole, permissionId: string): boolean {
    const rolePerms = this.getRolePermissions(tenantId, role);
    return rolePerms.permissions.includes(permissionId);
  },

  /**
   * Reset role permissions to defaults
   */
  resetRolePermissions(tenantId: string, role: StaffRole): RolePermissions {
    const tenantPerms = getTenantPermissions(tenantId);
    const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || [];
    tenantPerms.set(role, [...defaultPerms]);

    return {
      role,
      permissions: defaultPerms,
    };
  },
};
