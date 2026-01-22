import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import prisma from '../../common/database';
import { config } from '../../config';
import { AppError } from '../../middleware/error.middleware';
import { RegisterInput, LoginInput, PinLoginInput } from './auth.schema';

interface TokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

interface AuthTokens {
  accessToken: string;
  expiresIn: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  venues: Array<{
    id: string;
    name: string;
  }>;
  tokens: AuthTokens;
}

export class AuthService {
  /**
   * Register a new tenant with first user
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    // Check if email already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: input.email },
    });
    
    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }
    
    // Generate tenant slug
    const slug = this.generateSlug(input.tenantName);
    
    // Check if slug exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug },
    });
    
    if (existingTenant) {
      throw new AppError('A company with a similar name already exists', 409);
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 12);
    
    // Create tenant, user, and optionally venue in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: input.tenantName,
          slug,
        },
      });
      
      // Create user
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          role: 'OWNER',
        },
      });
      
      // Create venue if provided
      let venue = null;
      if (input.venueName) {
        venue = await tx.venue.create({
          data: {
            tenantId: tenant.id,
            name: input.venueName,
            address: input.venueAddress,
          },
        });
        
        // Assign user to venue
        await tx.userVenue.create({
          data: {
            userId: user.id,
            venueId: venue.id,
          },
        });
      }
      
      return { tenant, user, venue };
    });
    
    // Generate tokens
    const tokens = this.generateTokens({
      userId: result.user.id,
      tenantId: result.tenant.id,
      email: result.user.email,
      role: result.user.role,
    });
    
    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        tenantId: result.user.tenantId,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
      venues: result.venue
        ? [{ id: result.venue.id, name: result.venue.name }]
        : [],
      tokens,
    };
  }
  
  /**
   * Login with email and password
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    // Find user
    const user = await prisma.user.findFirst({
      where: { email: input.email },
      include: {
        tenant: true,
        venues: {
          include: {
            venue: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }
    
    if (!user.isActive) {
      throw new AppError('Account is deactivated', 401);
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
    
    if (!isValidPassword) {
      throw new AppError('Invalid email or password', 401);
    }
    
    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    
    // Generate tokens
    const tokens = this.generateTokens({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    });
    
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      },
      venues: user.venues.map((uv) => ({
        id: uv.venue.id,
        name: uv.venue.name,
      })),
      tokens,
    };
  }
  
  /**
   * Login with PIN (for POS terminals)
   */
  async pinLogin(input: PinLoginInput): Promise<AuthResponse> {
    let user;

    if (input.venueId) {
      // Find user by PIN in the specific venue
      const userVenue = await prisma.userVenue.findFirst({
        where: {
          venueId: input.venueId,
          user: {
            pin: input.pin,
            isActive: true,
          },
        },
        include: {
          user: {
            include: {
              tenant: true,
              venues: {
                include: {
                  venue: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!userVenue) {
        throw new AppError('Invalid PIN', 401);
      }

      user = userVenue.user;
    } else {
      // Find user by PIN across all venues (for desktop app)
      user = await prisma.user.findFirst({
        where: {
          pin: input.pin,
          isActive: true,
        },
        include: {
          tenant: true,
          venues: {
            include: {
              venue: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new AppError('Invalid PIN', 401);
      }
    }
    
    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    
    // Generate tokens
    const tokens = this.generateTokens({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    });
    
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      },
      venues: user.venues.map((uv) => ({
        id: uv.venue.id,
        name: uv.venue.name,
      })),
      tokens,
    };
  }
  
  /**
   * Get current user info
   */
  async me(userId: string): Promise<Omit<AuthResponse, 'tokens'>> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        venues: {
          include: {
            venue: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      },
      venues: user.venues.map((uv) => ({
        id: uv.venue.id,
        name: uv.venue.name,
      })),
    };
  }
  
  /**
   * Change password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    
    if (!isValidPassword) {
      throw new AppError('Current password is incorrect', 401);
    }
    
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });
  }
  
  // Private helpers
  
  private generateTokens(payload: TokenPayload): AuthTokens {
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
    
    return {
      accessToken,
      expiresIn: config.jwt.expiresIn,
    };
  }
  
  private generateSlug(name: string): string {
    const baseSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // Add random suffix to ensure uniqueness
    const suffix = uuid().substring(0, 6);
    return `${baseSlug}-${suffix}`;
  }
}

export const authService = new AuthService();