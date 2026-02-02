import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SuperAdmin {
  id: string;
  email: string;
  name: string;
}

interface SuperAdminState {
  superAdmin: SuperAdmin | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (data: { superAdmin: SuperAdmin; token: string }) => void;
  logout: () => void;
}

export const useSuperAdminStore = create<SuperAdminState>()(
  persist(
    (set) => ({
      superAdmin: null,
      token: null,
      isAuthenticated: false,

      login: (data) =>
        set({
          superAdmin: data.superAdmin,
          token: data.token,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          superAdmin: null,
          token: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'clubio-super-admin-auth',
      partialize: (state) => ({
        superAdmin: state.superAdmin,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
