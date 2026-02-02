import axios from 'axios';
import { useSuperAdminStore } from '@/stores/superAdmin.store';

const superAdminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
superAdminApi.interceptors.request.use((config) => {
  const token = useSuperAdminStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
superAdminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      useSuperAdminStore.getState().logout();
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default superAdminApi;

// API functions
export const superAdminAuthApi = {
  login: (email: string, password: string) =>
    superAdminApi.post('/api/super-admin/login', { email, password }),
};

export const tenantsApi = {
  list: () => superAdminApi.get('/api/super-admin/tenants'),
  get: (id: string) => superAdminApi.get(`/api/super-admin/tenants/${id}`),
  updateSubscription: (id: string, data: {
    status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
    expiresAt?: string | null;
    reason?: string;
    maxVenues?: number;
    maxUsers?: number;
  }) => superAdminApi.patch(`/api/super-admin/tenants/${id}/subscription`, data),
  activate: (id: string, months: number = 1) =>
    superAdminApi.post(`/api/super-admin/tenants/${id}/activate`, { months }),
  suspend: (id: string, reason?: string) =>
    superAdminApi.post(`/api/super-admin/tenants/${id}/suspend`, { reason }),
  delete: (id: string, confirmName: string) =>
    superAdminApi.delete(`/api/super-admin/tenants/${id}`, { data: { confirmName } }),
};

export const statsApi = {
  get: () => superAdminApi.get('/api/super-admin/stats'),
};
