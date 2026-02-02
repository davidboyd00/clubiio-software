import { useCallback, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { setStoredToken, setOnUnauthorized, User } from '../lib/api';
import { socketManager } from '../lib/socket';
import { localDb } from '../lib/db';

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  tenantId: string | null;
  venueId: string | null;
  cashSessionId: string | null;
  cashRegisterId: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithPin: (pin: string) => Promise<boolean>;
  logout: () => void;
  setError: (error: string | null) => void;
  restoreSession: () => Promise<boolean>;
  setCashSession: (cashSessionId: string | null, cashRegisterId: string | null) => void;
}

export function useAuth(): UseAuthReturn {
  const store = useAuthStore();

  // Setup token sync with API module
  useEffect(() => {
    if (store.token) {
      setStoredToken(store.token);
    }
  }, [store.token]);

  // Setup unauthorized callback
  useEffect(() => {
    setOnUnauthorized(() => {
      store.logout();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect/disconnect socket based on auth state
  useEffect(() => {
    if (store.isAuthenticated && store.token) {
      socketManager.connect();
      if (store.venueId) {
        socketManager.joinVenue(store.venueId);
      }
      if (store.cashRegisterId) {
        socketManager.joinCashRegister(store.cashRegisterId);
      }
    } else {
      socketManager.disconnect();
    }
  }, [store.isAuthenticated, store.token, store.venueId, store.cashRegisterId]);

  // Login handler
  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      const success = await store.login(email, password);
      return success;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // PIN login handler
  const loginWithPin = useCallback(
    async (pin: string): Promise<boolean> => {
      const success = await store.loginWithPin(pin);
      return success;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Logout handler
  const logout = useCallback(() => {
    setStoredToken(null);
    socketManager.disconnect();
    store.logout();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore session from local database
  const restoreSession = useCallback(async (): Promise<boolean> => {
    if (!localDb.isAvailable()) return false;

    const session = await localDb.getSession();
    if (!session || !session.access_token) return false;

    // Validate token is still valid by calling /auth/me
    try {
      setStoredToken(session.access_token);

      const { authApi } = await import('../lib/api');
      const response = await authApi.me();

      if (response.data.success && response.data.data) {
        const { user, tenant, venues } = response.data.data;

        // Restore state to store
        store.setSession({
          user,
          token: session.access_token,
          tenantId: tenant.id,
          venueId: session.venue_id || venues[0]?.id || null,
          cashSessionId: session.cash_session_id,
          cashRegisterId: session.cash_register_id,
        });

        return true;
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      // Clear invalid session
      await localDb.clearSession();
      setStoredToken(null);
    }

    return false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    error: store.error,
    tenantId: store.tenantId,
    venueId: store.venueId,
    cashSessionId: store.cashSessionId,
    cashRegisterId: store.cashRegisterId,
    login,
    loginWithPin,
    logout,
    setError: store.setError,
    restoreSession,
    setCashSession: store.setCashSession,
  };
}
