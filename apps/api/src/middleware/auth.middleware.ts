import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../common/database';
import { AuthenticatedRequest, errorResponse } from '../common/response';
import { mfaService } from '../modules/auth/mfa.service';

interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  mfaVerified?: boolean;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
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
    
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        venues: {
          include: {
            venue: true,
          },
        },
      },
    });
    
    if (!user || !user.isActive) {
      errorResponse(res, 'User not found or inactive', 401);
      return;
    }
    
    // Attach user and tenant to request
    req.user = user;
    req.tenantId = user.tenantId;
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      errorResponse(res, 'Invalid token', 401);
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      errorResponse(res, 'Token expired', 401);
      return;
    }
    next(error);
  }
}

// Middleware to require specific roles
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      errorResponse(res, 'Not authenticated', 401);
      return;
    }
    
    if (!roles.includes(req.user.role)) {
      errorResponse(res, 'Insufficient permissions', 403);
      return;
    }
    
    next();
  };
}

// Middleware to extract venue from params/query and validate access
export async function venueMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const venueId = req.params.venueId || req.query.venueId as string;

    if (!venueId) {
      errorResponse(res, 'Venue ID required', 400);
      return;
    }

    // Check if user has access to this venue
    const venue = await prisma.venue.findFirst({
      where: {
        id: venueId,
        tenantId: req.tenantId,
        isActive: true,
      },
    });

    if (!venue) {
      errorResponse(res, 'Venue not found', 404);
      return;
    }

    // For non-admin users, check if they have access
    if (!['OWNER', 'ADMIN'].includes(req.user?.role || '')) {
      const hasAccess = await prisma.userVenue.findUnique({
        where: {
          userId_venueId: {
            userId: req.user!.id,
            venueId,
          },
        },
      });

      if (!hasAccess) {
        errorResponse(res, 'No access to this venue', 403);
        return;
      }
    }

    req.venueId = venueId;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require MFA verification for sensitive operations
 * Must be used after authMiddleware
 */
export function requireMfa(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    errorResponse(res, 'Not authenticated', 401);
    return;
  }

  // Check if MFA is required for this user's role
  const mfaRequired = mfaService.isMfaRequired(req.user.role);

  if (!mfaRequired) {
    // MFA not required for this role
    next();
    return;
  }

  // Check if user has MFA enabled
  if (!req.user.mfaEnabled) {
    // User needs to set up MFA
    errorResponse(res, 'MFA setup required for your role', 403, {
      code: 'MFA_SETUP_REQUIRED',
    });
    return;
  }

  // Check if MFA was verified in the current session
  // The mfaVerified claim is set in the JWT after MFA verification
  const token = req.headers.authorization?.substring(7);
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      if (decoded.mfaVerified) {
        next();
        return;
      }
    } catch {
      // Token verification failed, will be handled by next check
    }
  }

  // MFA verification needed
  errorResponse(res, 'MFA verification required', 403, {
    code: 'MFA_VERIFICATION_REQUIRED',
  });
}

/**
 * Middleware to require MFA for admin-only operations
 * More strict than requireMfa - always requires MFA regardless of role
 */
export function requireMfaForAdminOps(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    errorResponse(res, 'Not authenticated', 401);
    return;
  }

  // Only OWNER and ADMIN can access admin operations
  if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
    errorResponse(res, 'Insufficient permissions', 403);
    return;
  }

  // Always require MFA for admin operations
  if (!req.user.mfaEnabled) {
    errorResponse(res, 'MFA must be enabled for administrative operations', 403, {
      code: 'MFA_SETUP_REQUIRED',
    });
    return;
  }

  // Check if MFA was verified in the current session
  const token = req.headers.authorization?.substring(7);
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      if (decoded.mfaVerified) {
        next();
        return;
      }
    } catch {
      // Token verification failed
    }
  }

  errorResponse(res, 'MFA verification required for this operation', 403, {
    code: 'MFA_VERIFICATION_REQUIRED',
  });
}
