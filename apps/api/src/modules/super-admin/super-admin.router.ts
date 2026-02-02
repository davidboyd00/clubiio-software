import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../../common/database';
import { config } from '../../config';
import {
  asyncHandler,
  successResponse,
  errorResponse,
  noContentResponse,
} from '../../common/response';
import { SubscriptionStatus } from '@prisma/client';

const router: Router = Router();

// ============================================
// SCHEMAS
// ============================================

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateSubscriptionSchema = z.object({
  status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']),
  expiresAt: z.string().datetime().optional().nullable(),
  reason: z.string().optional(),
  maxVenues: z.number().int().positive().optional(),
  maxUsers: z.number().int().positive().optional(),
});

const createSuperAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

// ============================================
// SUPER ADMIN AUTH MIDDLEWARE
// ============================================

interface SuperAdminRequest extends Request {
  superAdmin?: {
    id: string;
    email: string;
    name: string;
  };
}

async function superAdminAuth(
  req: SuperAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      errorResponse(res, 'No token provided', 401);
      return;
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, config.jwt.secret) as {
      superAdminId: string;
      email: string;
      isSuperAdmin: boolean;
    };

    if (!decoded.isSuperAdmin) {
      errorResponse(res, 'Not a super admin token', 403);
      return;
    }

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: decoded.superAdminId },
    });

    if (!superAdmin || !superAdmin.isActive) {
      errorResponse(res, 'Super admin not found or inactive', 401);
      return;
    }

    req.superAdmin = {
      id: superAdmin.id,
      email: superAdmin.email,
      name: superAdmin.name,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      errorResponse(res, 'Invalid token', 401);
      return;
    }
    next(error);
  }
}

// ============================================
// AUTH ENDPOINTS
// ============================================

/**
 * POST /super-admin/login
 * Login as super admin
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email },
    });

    if (!superAdmin) {
      // Timing attack prevention
      await bcrypt.compare(password, '$2a$12$invalid.hash');
      errorResponse(res, 'Invalid credentials', 401);
      return;
    }

    if (!superAdmin.isActive) {
      errorResponse(res, 'Account is disabled', 401);
      return;
    }

    const isValid = await bcrypt.compare(password, superAdmin.passwordHash);

    if (!isValid) {
      errorResponse(res, 'Invalid credentials', 401);
      return;
    }

    // Update last login
    await prisma.superAdmin.update({
      where: { id: superAdmin.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate token
    const token = jwt.sign(
      {
        superAdminId: superAdmin.id,
        email: superAdmin.email,
        isSuperAdmin: true,
      },
      config.jwt.secret,
      { expiresIn: '8h' }
    );

    successResponse(res, {
      token,
      superAdmin: {
        id: superAdmin.id,
        email: superAdmin.email,
        name: superAdmin.name,
      },
    });
  })
);

// ============================================
// TENANT/LICENSE MANAGEMENT
// ============================================

/**
 * GET /super-admin/tenants
 * List all tenants with subscription info
 */
router.get(
  '/tenants',
  superAdminAuth,
  asyncHandler(async (_req: SuperAdminRequest, res) => {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        trialEndsAt: true,
        suspendedAt: true,
        suspendedReason: true,
        maxVenues: true,
        maxUsers: true,
        licenseKey: true,
        createdAt: true,
        _count: {
          select: {
            venues: true,
            users: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    successResponse(res, { tenants });
  })
);

/**
 * GET /super-admin/tenants/:id
 * Get tenant details
 */
router.get(
  '/tenants/:id',
  superAdminAuth,
  asyncHandler(async (req: SuperAdminRequest, res) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        venues: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
        _count: {
          select: {
            venues: true,
            users: true,
            products: true,
          },
        },
      },
    });

    if (!tenant) {
      errorResponse(res, 'Tenant not found', 404);
      return;
    }

    successResponse(res, { tenant });
  })
);

/**
 * PATCH /super-admin/tenants/:id/subscription
 * Update tenant subscription status
 */
router.patch(
  '/tenants/:id/subscription',
  superAdminAuth,
  asyncHandler(async (req: SuperAdminRequest, res) => {
    const { status, expiresAt, reason, maxVenues, maxUsers } =
      updateSubscriptionSchema.parse(req.body);

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
    });

    if (!tenant) {
      errorResponse(res, 'Tenant not found', 404);
      return;
    }

    const updateData: any = {
      subscriptionStatus: status as SubscriptionStatus,
    };

    // Handle status-specific updates
    if (status === 'SUSPENDED' || status === 'CANCELLED') {
      updateData.suspendedAt = new Date();
      updateData.suspendedReason = reason || `${status} by admin`;
    } else if (status === 'ACTIVE') {
      updateData.suspendedAt = null;
      updateData.suspendedReason = null;
      if (expiresAt) {
        updateData.subscriptionExpiresAt = new Date(expiresAt);
      }
    } else if (status === 'TRIAL') {
      updateData.suspendedAt = null;
      updateData.suspendedReason = null;
      if (expiresAt) {
        updateData.trialEndsAt = new Date(expiresAt);
      }
    }

    if (maxVenues !== undefined) {
      updateData.maxVenues = maxVenues;
    }

    if (maxUsers !== undefined) {
      updateData.maxUsers = maxUsers;
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        trialEndsAt: true,
        suspendedAt: true,
        suspendedReason: true,
        maxVenues: true,
        maxUsers: true,
      },
    });

    successResponse(res, {
      tenant: updatedTenant,
      message: `Subscription updated to ${status}`,
    });
  })
);

/**
 * POST /super-admin/tenants/:id/activate
 * Quick activate a tenant's subscription
 */
router.post(
  '/tenants/:id/activate',
  superAdminAuth,
  asyncHandler(async (req: SuperAdminRequest, res) => {
    const { months = 1 } = req.body;

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + months);

    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionExpiresAt: expiresAt,
        suspendedAt: null,
        suspendedReason: null,
      },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });

    successResponse(res, {
      tenant,
      message: `Subscription activated until ${expiresAt.toISOString()}`,
    });
  })
);

/**
 * POST /super-admin/tenants/:id/suspend
 * Quick suspend a tenant
 */
router.post(
  '/tenants/:id/suspend',
  superAdminAuth,
  asyncHandler(async (req: SuperAdminRequest, res) => {
    const { reason = 'Suspended by admin' } = req.body;

    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: {
        subscriptionStatus: SubscriptionStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspendedReason: reason,
      },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        suspendedAt: true,
        suspendedReason: true,
      },
    });

    successResponse(res, {
      tenant,
      message: 'Tenant suspended',
    });
  })
);

/**
 * DELETE /super-admin/tenants/:id
 * Permanently delete a tenant (use with caution!)
 */
router.delete(
  '/tenants/:id',
  superAdminAuth,
  asyncHandler(async (req: SuperAdminRequest, res) => {
    const { confirmName } = req.body;

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
    });

    if (!tenant) {
      errorResponse(res, 'Tenant not found', 404);
      return;
    }

    // Require name confirmation for safety
    if (confirmName !== tenant.name) {
      errorResponse(res, 'Please confirm tenant name to delete', 400);
      return;
    }

    await prisma.tenant.delete({
      where: { id: req.params.id },
    });

    noContentResponse(res);
  })
);

// ============================================
// SUPER ADMIN MANAGEMENT (BOOTSTRAP)
// ============================================

/**
 * POST /super-admin/bootstrap
 * Create the first super admin (only works if none exist)
 */
router.post(
  '/bootstrap',
  asyncHandler(async (req, res) => {
    const existingAdmin = await prisma.superAdmin.findFirst();

    if (existingAdmin) {
      errorResponse(res, 'Super admin already exists', 400);
      return;
    }

    const { email, password, name } = createSuperAdminSchema.parse(req.body);

    const passwordHash = await bcrypt.hash(password, 12);

    const superAdmin = await prisma.superAdmin.create({
      data: {
        email,
        passwordHash,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    successResponse(res, {
      superAdmin,
      message: 'Super admin created successfully',
    });
  })
);

/**
 * GET /super-admin/stats
 * Get platform statistics
 */
router.get(
  '/stats',
  superAdminAuth,
  asyncHandler(async (_req: SuperAdminRequest, res) => {
    const [
      totalTenants,
      activeTenants,
      suspendedTenants,
      trialTenants,
      totalUsers,
      totalVenues,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { subscriptionStatus: 'ACTIVE' } }),
      prisma.tenant.count({ where: { subscriptionStatus: 'SUSPENDED' } }),
      prisma.tenant.count({ where: { subscriptionStatus: 'TRIAL' } }),
      prisma.user.count(),
      prisma.venue.count(),
    ]);

    successResponse(res, {
      stats: {
        tenants: {
          total: totalTenants,
          active: activeTenants,
          suspended: suspendedTenants,
          trial: trialTenants,
        },
        users: totalUsers,
        venues: totalVenues,
      },
    });
  })
);

export default router;
