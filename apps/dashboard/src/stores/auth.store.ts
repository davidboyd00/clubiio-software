import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Venue {
  id: string;
  name: string;
}

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  venues: Venue[];
  token: string | null;
  isAuthenticated: boolean;
  login: (data: {
    user: User;
    tenant: Tenant;
    venues: Venue[];
    tokens: { accessToken: string };
  }) => void;
  logout: () => void;
  setVenues: (venues: Venue[]) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      venues: [],
      token: null,
      isAuthenticated: false,

      login: (data) =>
        set({
          user: data.user,
          tenant: data.tenant,
          venues: data.venues,
          token: data.tokens.accessToken,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          tenant: null,
          venues: [],
          token: null,
          isAuthenticated: false,
        }),

      setVenues: (venues) => set({ venues }),
    }),
    {
      name: 'clubio-dashboard-auth',
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        venues: state.venues,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
