import { create } from 'zustand';
import { authApi, User, setStoredToken, api } from '../lib/api';
import { localDb } from '../lib/db';

// ============================================
// Types
// ============================================

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';

interface LicenseStatus {
  status: SubscriptionStatus;
  expiresAt: string | null;
  daysRemaining: number | null;
  suspendedReason: string | null;
  limits: {
    maxVenues: number;
    maxUsers: number;
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  tenantId: string | null;
  venueId: string | null;
  cashSessionId: string | null;
  cashRegisterId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // License state
  licenseStatus: LicenseStatus | null;
  licenseError: string | null;
  isLicenseValid: boolean;

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  loginWithPin: (pin: string) => Promise<boolean>;
  logout: () => void;
  setError: (error: string | null) => void;
  setSession: (session: {
    user: User;
    token: string;
    tenantId: string;
    venueId: string | null;
    cashSessionId?: string | null;
    cashRegisterId?: string | null;
  }) => void;
  setCashSession: (cashSessionId: string | null, cashRegisterId: string | null) => void;
  setVenue: (venueId: string) => void;
  checkLicense: () => Promise<boolean>;
}

// ============================================
// Store
// ============================================

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  tenantId: null,
  venueId: null,
  cashSessionId: null,
  cashRegisterId: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // License state
  licenseStatus: null,
  licenseError: null,
  isLicenseValid: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authApi.login(email, password);

      if (response.data.success && response.data.data) {
        const { user, tokens, tenant, venues } = response.data.data;
        const venueId = venues[0]?.id || null;

        // Set token in API module
        setStoredToken(tokens.accessToken);

        // Save to local database for offline access
        await localDb.saveSession({
          userId: user.id,
          tenantId: tenant.id,
          venueId,
          accessToken: tokens.accessToken,
        });

        set({
          user,
          token: tokens.accessToken,
          tenantId: tenant.id,
          venueId,
          isAuthenticated: true,
          isLoading: false,
        });

        // Check license status after login
        const licenseValid = await get().checkLicense();
        if (!licenseValid) {
          const licenseError = get().licenseError;
          set({
            error: licenseError || 'Licencia no válida. Contacta al administrador.',
            isAuthenticated: false,
          });
          return false;
        }

        // Start periodic license checks
        startLicenseCheck();

        return true;
      } else {
        set({ error: response.data.error || 'Login failed', isLoading: false });
        return false;
      }
    } catch (error: any) {
      const message = error.message || 'Error de conexión al servidor';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  loginWithPin: async (pin: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authApi.pinLogin(pin);

      if (response.data.success && response.data.data) {
        const { user, tokens, tenant, venues } = response.data.data;
        const venueId = venues[0]?.id || null;

        // Set token in API module
        setStoredToken(tokens.accessToken);

        // Save to local database for offline access
        await localDb.saveSession({
          userId: user.id,
          tenantId: tenant.id,
          venueId,
          accessToken: tokens.accessToken,
        });

        set({
          user,
          token: tokens.accessToken,
          tenantId: tenant.id,
          venueId,
          isAuthenticated: true,
          isLoading: false,
        });

        // Check license status after PIN login
        const licenseValid = await get().checkLicense();
        if (!licenseValid) {
          const licenseError = get().licenseError;
          set({
            error: licenseError || 'Licencia no válida. Contacta al administrador.',
            isAuthenticated: false,
          });
          return false;
        }

        // Start periodic license checks
        startLicenseCheck();

        return true;
      } else {
        set({ error: response.data.error || 'PIN inválido', isLoading: false });
        return false;
      }
    } catch (error: any) {
      const message = error.message || 'Error de conexión al servidor';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  logout: () => {
    // Stop license checking
    stopLicenseCheck();

    // Clear token from API module
    setStoredToken(null);

    // Clear local database session
    localDb.clearSession();

    set({
      user: null,
      token: null,
      tenantId: null,
      venueId: null,
      cashSessionId: null,
      cashRegisterId: null,
      isAuthenticated: false,
      error: null,
      licenseStatus: null,
      licenseError: null,
      isLicenseValid: false,
    });
  },

  setError: (error) => set({ error }),

  setSession: (session) => {
    setStoredToken(session.token);

    set({
      user: session.user,
      token: session.token,
      tenantId: session.tenantId,
      venueId: session.venueId,
      cashSessionId: session.cashSessionId || null,
      cashRegisterId: session.cashRegisterId || null,
      isAuthenticated: true,
    });
  },

  setCashSession: async (cashSessionId, cashRegisterId) => {
    // Update local database
    await localDb.updateCashSession(cashSessionId, cashRegisterId);

    set({
      cashSessionId,
      cashRegisterId,
    });
  },

  setVenue: async (venueId) => {
    const state = get();

    // Update local database
    if (state.user && state.token) {
      await localDb.saveSession({
        userId: state.user.id,
        tenantId: state.tenantId!,
        venueId,
        cashSessionId: state.cashSessionId,
        cashRegisterId: state.cashRegisterId,
        accessToken: state.token,
      });
    }

    set({ venueId });
  },

  checkLicense: async () => {
    const state = get();

    if (!state.token) {
      set({ isLicenseValid: false, licenseError: 'No authenticated' });
      return false;
    }

    try {
      const response = await api.get('/license/status');

      if (response.data.success && response.data.data) {
        const licenseStatus = response.data.data as LicenseStatus;

        const isValid =
          licenseStatus.status === 'ACTIVE' || licenseStatus.status === 'TRIAL';

        set({
          licenseStatus,
          isLicenseValid: isValid,
          licenseError: isValid ? null : licenseStatus.suspendedReason || 'Subscription inactive',
        });

        return isValid;
      } else {
        set({
          isLicenseValid: false,
          licenseError: response.data.error || 'Failed to check license',
        });
        return false;
      }
    } catch (error: any) {
      // If we can't reach the server, allow offline mode with cached status
      const cachedStatus = state.licenseStatus;

      if (cachedStatus) {
        const isValid =
          cachedStatus.status === 'ACTIVE' || cachedStatus.status === 'TRIAL';

        // Check if cached license is still valid (grace period of 3 days offline)
        if (cachedStatus.expiresAt) {
          const expiresAt = new Date(cachedStatus.expiresAt);
          const gracePeriod = new Date();
          gracePeriod.setDate(gracePeriod.getDate() + 3);

          if (expiresAt < new Date() && expiresAt < gracePeriod) {
            set({
              isLicenseValid: true,
              licenseError: 'Offline mode - limited time remaining',
            });
            return true;
          }
        }

        set({ isLicenseValid: isValid });
        return isValid;
      }

      set({
        isLicenseValid: false,
        licenseError: 'Cannot verify license - no connection',
      });
      return false;
    }
  },
}));

// License check interval (every 30 minutes - optimized for performance)
let licenseCheckInterval: NodeJS.Timeout | null = null;

export function startLicenseCheck() {
  if (licenseCheckInterval) {
    clearInterval(licenseCheckInterval);
  }

  // Check immediately
  useAuthStore.getState().checkLicense();

  // Then check every 30 minutes (reduced from 5 min for performance)
  licenseCheckInterval = setInterval(() => {
    const state = useAuthStore.getState();
    if (state.isAuthenticated) {
      state.checkLicense();
    }
  }, 30 * 60 * 1000);
}

export function stopLicenseCheck() {
  if (licenseCheckInterval) {
    clearInterval(licenseCheckInterval);
    licenseCheckInterval = null;
  }
}
