import { Response, NextFunction } from 'express';
import prisma from '../common/database';
import { AuthenticatedRequest, errorResponse } from '../common/response';
import { SubscriptionStatus } from '@prisma/client';

/**
 * Middleware to check if tenant's subscription is active
 * Blocks access if subscription is suspended or cancelled
 */
export async function checkSubscription(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.tenantId) {
      errorResponse(res, 'Tenant not identified', 401);
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        trialEndsAt: true,
        suspendedAt: true,
        suspendedReason: true,
      },
    });

    if (!tenant) {
      errorResponse(res, 'Tenant not found', 404);
      return;
    }

    const now = new Date();

    // Check subscription status
    switch (tenant.subscriptionStatus) {
      case SubscriptionStatus.CANCELLED:
        errorResponse(res, 'Subscription cancelled. Contact support to reactivate.', 403, {
          code: 'SUBSCRIPTION_CANCELLED',
          tenantName: tenant.name,
        });
        return;

      case SubscriptionStatus.SUSPENDED:
        errorResponse(res, 'Subscription suspended. Contact support.', 403, {
          code: 'SUBSCRIPTION_SUSPENDED',
          tenantName: tenant.name,
          suspendedAt: tenant.suspendedAt,
          reason: tenant.suspendedReason,
        });
        return;

      case SubscriptionStatus.TRIAL:
        // Check if trial has expired
        if (tenant.trialEndsAt && tenant.trialEndsAt < now) {
          // Auto-suspend expired trials
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              subscriptionStatus: SubscriptionStatus.SUSPENDED,
              suspendedAt: now,
              suspendedReason: 'Trial period expired',
            },
          });

          errorResponse(res, 'Trial period has expired. Please subscribe to continue.', 403, {
            code: 'TRIAL_EXPIRED',
            tenantName: tenant.name,
            trialEndedAt: tenant.trialEndsAt,
          });
          return;
        }
        break;

      case SubscriptionStatus.ACTIVE:
        // Check if subscription has expired
        if (tenant.subscriptionExpiresAt && tenant.subscriptionExpiresAt < now) {
          // Auto-suspend expired subscriptions
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              subscriptionStatus: SubscriptionStatus.SUSPENDED,
              suspendedAt: now,
              suspendedReason: 'Subscription expired',
            },
          });

          errorResponse(res, 'Subscription has expired. Please renew to continue.', 403, {
            code: 'SUBSCRIPTION_EXPIRED',
            tenantName: tenant.name,
            expiredAt: tenant.subscriptionExpiresAt,
          });
          return;
        }
        break;
    }

    // Subscription is valid, continue
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Get subscription status for a tenant (used by desktop app)
 */
export async function getSubscriptionStatus(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      trialEndsAt: true,
      suspendedReason: true,
      maxVenues: true,
      maxUsers: true,
    },
  });

  if (!tenant) {
    return null;
  }

  const now = new Date();
  let daysRemaining: number | null = null;

  if (tenant.subscriptionStatus === 'TRIAL' && tenant.trialEndsAt) {
    daysRemaining = Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  } else if (tenant.subscriptionStatus === 'ACTIVE' && tenant.subscriptionExpiresAt) {
    daysRemaining = Math.ceil((tenant.subscriptionExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    status: tenant.subscriptionStatus,
    expiresAt: tenant.subscriptionExpiresAt || tenant.trialEndsAt,
    daysRemaining,
    suspendedReason: tenant.suspendedReason,
    limits: {
      maxVenues: tenant.maxVenues,
      maxUsers: tenant.maxUsers,
    },
  };
}
