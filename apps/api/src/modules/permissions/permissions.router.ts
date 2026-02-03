import { Router, Response } from 'express';
import { permissionsService, StaffRole } from './permissions.service';
import { AuthRequest } from '../../middleware/auth.middleware';

const router = Router();

// Valid roles
const VALID_ROLES: StaffRole[] = ['admin', 'manager', 'bartender', 'cashier', 'warehouse'];

/**
 * GET /permissions
 * Get all available permissions
 */
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const permissions = permissionsService.getAllPermissions();
    res.json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    console.error('Error getting permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener permisos',
    });
  }
});

/**
 * GET /permissions/role/:role
 * Get permissions for a specific role
 */
router.get('/role/:role', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.params;

    // Validate role
    if (!VALID_ROLES.includes(role as StaffRole)) {
      res.status(400).json({
        success: false,
        error: `Rol inválido. Roles válidos: ${VALID_ROLES.join(', ')}`,
      });
      return;
    }

    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({
        success: false,
        error: 'Tenant no identificado',
      });
      return;
    }

    const rolePermissions = permissionsService.getRolePermissions(tenantId, role as StaffRole);

    res.json({
      success: true,
      data: rolePermissions,
    });
  } catch (error) {
    console.error('Error getting role permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener permisos del rol',
    });
  }
});

/**
 * PUT /permissions/role/:role
 * Update permissions for a role
 */
router.put('/role/:role', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.params;
    const { permissionIds } = req.body;

    // Validate role
    if (!VALID_ROLES.includes(role as StaffRole)) {
      res.status(400).json({
        success: false,
        error: `Rol inválido. Roles válidos: ${VALID_ROLES.join(', ')}`,
      });
      return;
    }

    // Validate permissionIds
    if (!Array.isArray(permissionIds)) {
      res.status(400).json({
        success: false,
        error: 'permissionIds debe ser un array',
      });
      return;
    }

    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({
        success: false,
        error: 'Tenant no identificado',
      });
      return;
    }

    const rolePermissions = permissionsService.updateRolePermissions(
      tenantId,
      role as StaffRole,
      permissionIds
    );

    res.json({
      success: true,
      data: rolePermissions,
    });
  } catch (error) {
    console.error('Error updating role permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar permisos del rol',
    });
  }
});

/**
 * POST /permissions/role/:role/reset
 * Reset role permissions to defaults
 */
router.post('/role/:role/reset', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.params;

    // Validate role
    if (!VALID_ROLES.includes(role as StaffRole)) {
      res.status(400).json({
        success: false,
        error: `Rol inválido. Roles válidos: ${VALID_ROLES.join(', ')}`,
      });
      return;
    }

    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({
        success: false,
        error: 'Tenant no identificado',
      });
      return;
    }

    const rolePermissions = permissionsService.resetRolePermissions(tenantId, role as StaffRole);

    res.json({
      success: true,
      data: rolePermissions,
    });
  } catch (error) {
    console.error('Error resetting role permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Error al restablecer permisos del rol',
    });
  }
});

export default router;
