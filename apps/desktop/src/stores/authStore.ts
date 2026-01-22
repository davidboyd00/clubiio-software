import { create } from 'zustand';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  tenantId: string | null;
  venueId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithPin: (pin: string) => Promise<boolean>;
  logout: () => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  tenantId: null,
  venueId: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.post('/auth/login', { email, password });

      if (response.data.success) {
        const { user, tokens, tenant, venues } = response.data.data;

        // Save to local database for offline access
        await saveSessionToDb({
          userId: user.id,
          tenantId: tenant.id,
          venueId: venues[0]?.id || null,
          accessToken: tokens.accessToken,
        });

        set({
          user,
          token: tokens.accessToken,
          tenantId: tenant.id,
          venueId: venues[0]?.id || null,
          isAuthenticated: true,
          isLoading: false,
        });

        return true;
      } else {
        set({ error: response.data.error, isLoading: false });
        return false;
      }
    } catch (error: any) {
      const message =
        error.response?.data?.error || 'Error de conexión al servidor';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  loginWithPin: async (pin: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.post('/auth/pin-login', { pin });

      if (response.data.success) {
        const { user, tokens, tenant, venues } = response.data.data;

        await saveSessionToDb({
          userId: user.id,
          tenantId: tenant.id,
          venueId: venues[0]?.id || null,
          accessToken: tokens.accessToken,
        });

        set({
          user,
          token: tokens.accessToken,
          tenantId: tenant.id,
          venueId: venues[0]?.id || null,
          isAuthenticated: true,
          isLoading: false,
        });

        return true;
      } else {
        set({ error: response.data.error || 'PIN inválido', isLoading: false });
        return false;
      }
    } catch (error: any) {
      const message =
        error.response?.data?.error || 'Error de conexión al servidor';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  logout: () => {
    clearSessionFromDb();
    set({
      user: null,
      token: null,
      tenantId: null,
      venueId: null,
      isAuthenticated: false,
      error: null,
    });
  },

  setError: (error) => set({ error }),
}));

// Helper functions for local database
async function saveSessionToDb(session: {
  userId: string;
  tenantId: string;
  venueId: string | null;
  accessToken: string;
}) {
  if (!window.electronAPI?.db) return;

  await window.electronAPI.db.execute(
    `INSERT OR REPLACE INTO session_info (id, user_id, tenant_id, venue_id, access_token, updated_at)
     VALUES (1, ?, ?, ?, ?, datetime('now'))`,
    [session.userId, session.tenantId, session.venueId, session.accessToken]
  );
}

async function clearSessionFromDb() {
  if (!window.electronAPI?.db) return;

  await window.electronAPI.db.execute('DELETE FROM session_info WHERE id = 1');
}
