import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// ============================================
// Configuration
// ============================================

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ============================================
// API Types
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export interface Venue {
  id: string;
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: string;
}

export interface AuthResponse {
  user: User;
  tenant: Tenant;
  venues: Venue[];
  tokens: AuthTokens;
}

export interface Category {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  sortOrder: number;
}

export interface Product {
  id: string;
  categoryId: string | null;
  name: string;
  shortName: string | null;
  price: number;
  isAlcoholic: boolean;
  barcode: string | null;
  category?: Category;
  // Extended fields for inventory and management
  sku?: string;
  description?: string;
  imageUrl?: string;
  stock?: number;
  minStock?: number;
  isActive?: boolean;
}

export interface CashRegister {
  id: string;
  venueId: string;
  name: string;
  isActive: boolean;
}

export interface CashSession {
  id: string;
  cashRegisterId: string;
  userId: string;
  initialAmount: number;
  finalAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
  cashRegister?: CashRegister;
  user?: User;
  cashMovements?: CashMovement[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  product?: Product;
}

export interface OrderPayment {
  id: string;
  orderId: string;
  method: 'CASH' | 'CARD' | 'VOUCHER';
  amount: number;
}

export interface Order {
  id: string;
  cashSessionId: string;
  orderNumber: number;
  status: 'PENDING' | 'COMPLETED' | 'VOIDED';
  subtotal: number;
  discount: number;
  total: number;
  createdAt: string;
  items?: OrderItem[];
  payments?: OrderPayment[];
}

export interface CashMovement {
  id: string;
  cashSessionId: string;
  type: 'SALE' | 'WITHDRAWAL' | 'DEPOSIT' | 'ADJUSTMENT';
  amount: number;
  reason: string | null;
  createdAt: string;
}

export interface SessionSummary {
  session: CashSession;
  summary: {
    totalOrders: number;
    totalSales: number;
    paymentsByMethod: Array<{
      method: 'CASH' | 'CARD' | 'VOUCHER';
      amount: number;
      count: number;
    }>;
    movements: Array<{
      type: 'SALE' | 'WITHDRAWAL' | 'DEPOSIT' | 'ADJUSTMENT';
      amount: number;
    }>;
    initialAmount: number;
    expectedCash: number;
    finalAmount: number | null;
    difference: number | null;
  };
}

// ============================================
// Staff & Roles
// ============================================

export type StaffRole = 'admin' | 'manager' | 'bartender' | 'cashier' | 'warehouse';

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'pos' | 'inventory' | 'cash' | 'reports' | 'settings' | 'staff';
}

export interface RolePermissions {
  role: StaffRole;
  permissions: string[]; // Permission IDs
}

export interface Staff {
  id: string;
  venueId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  pin: string | null; // For quick login
  role: StaffRole;
  isActive: boolean;
  hireDate: string;
  terminationDate: string | null;
  hourlyRate: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Shift {
  id: string;
  staffId: string;
  venueId: string;
  cashSessionId: string | null;
  startTime: string;
  endTime: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: 'scheduled' | 'active' | 'completed' | 'missed' | 'cancelled';
  notes: string | null;
  staff?: Staff;
}

export interface StaffSummary {
  staff: Staff;
  totalShifts: number;
  totalHours: number;
  totalSales: number;
  averageTicket: number;
  lastShiftAt: string | null;
}

// ============================================
// Token Management
// ============================================

let cachedToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export function setStoredToken(token: string | null) {
  cachedToken = token;
}

export function getStoredToken(): string | null {
  return cachedToken;
}

export function clearStoredToken() {
  cachedToken = null;
}

export function setOnUnauthorized(callback: () => void) {
  onUnauthorizedCallback = callback;
}

// ============================================
// Axios Instance
// ============================================

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.status === 401) {
      clearStoredToken();
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }

    // Extract error message
    const message = error.response?.data?.error
      || error.response?.data?.message
      || error.message
      || 'Error de conexión';

    return Promise.reject(new Error(message));
  }
);

// ============================================
// API Methods
// ============================================

export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', { email, password }),

  pinLogin: (pin: string, venueId?: string) =>
    api.post<ApiResponse<AuthResponse>>('/auth/pin-login', { pin, venueId }),

  me: () =>
    api.get<ApiResponse<Omit<AuthResponse, 'tokens'>>>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<ApiResponse<void>>('/auth/change-password', { currentPassword, newPassword }),
};

export const categoriesApi = {
  getAll: () =>
    api.get<ApiResponse<Category[]>>('/categories'),

  getById: (id: string) =>
    api.get<ApiResponse<Category>>(`/categories/${id}`),

  create: (data: { name: string; color?: string; icon?: string; sortOrder?: number }) =>
    api.post<ApiResponse<Category>>('/categories', data),

  update: (id: string, data: Partial<{ name: string; color: string; icon: string; sortOrder: number }>) =>
    api.put<ApiResponse<Category>>(`/categories/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/categories/${id}`),
};

export const productsApi = {
  getAll: () =>
    api.get<ApiResponse<Product[]>>('/products'),

  getById: (id: string) =>
    api.get<ApiResponse<Product>>(`/products/${id}`),

  getByCategory: (categoryId: string) =>
    api.get<ApiResponse<Product[]>>(`/products?categoryId=${categoryId}`),

  create: (data: {
    categoryId?: string;
    name: string;
    shortName?: string;
    price: number;
    isAlcoholic?: boolean;
    barcode?: string;
  }) =>
    api.post<ApiResponse<Product>>('/products', data),

  update: (id: string, data: Partial<Product>) =>
    api.put<ApiResponse<Product>>(`/products/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/products/${id}`),
};

export const cashRegistersApi = {
  getAll: (venueId: string) =>
    api.get<ApiResponse<CashRegister[]>>(`/cash-registers/venue/${venueId}`),

  getById: (id: string) =>
    api.get<ApiResponse<CashRegister>>(`/cash-registers/${id}`),

  getStatus: (id: string) =>
    api.get<ApiResponse<CashRegister & { hasActiveSession: boolean }>>(`/cash-registers/${id}/status`),

  create: (data: { venueId: string; name: string }) =>
    api.post<ApiResponse<CashRegister>>('/cash-registers', data),

  update: (id: string, data: Partial<{ name: string; isActive: boolean }>) =>
    api.put<ApiResponse<CashRegister>>(`/cash-registers/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/cash-registers/${id}`),
};

export const cashSessionsApi = {
  getMySession: () =>
    api.get<ApiResponse<CashSession | null>>('/cash-sessions/my-session'),

  getByCashRegister: (cashRegisterId: string, includeAll = false) =>
    api.get<ApiResponse<CashSession[]>>(`/cash-sessions/cash-register/${cashRegisterId}?includeAll=${includeAll}`),

  getById: (sessionId: string) =>
    api.get<ApiResponse<CashSession>>(`/cash-sessions/${sessionId}`),

  open: (data: { cashRegisterId: string; openingAmount: number; notes?: string }) =>
    api.post<ApiResponse<CashSession>>('/cash-sessions/open', {
      cashRegisterId: data.cashRegisterId,
      initialAmount: data.openingAmount,
    }),

  close: (sessionId: string, data: { closingAmount: number; notes?: string }) =>
    api.post<ApiResponse<CashSession>>(`/cash-sessions/${sessionId}/close`, {
      finalAmount: data.closingAmount,
      notes: data.notes,
    }),

  addMovement: (sessionId: string, data: { type: 'IN' | 'OUT'; amount: number; reason: string }) =>
    api.post<ApiResponse<CashMovement>>(`/cash-sessions/${sessionId}/movements`, {
      type: data.type === 'IN' ? 'DEPOSIT' : 'WITHDRAWAL',
      amount: data.amount,
      reason: data.reason,
    }),

  getMovements: (sessionId: string) =>
    api.get<ApiResponse<CashMovement[]>>(`/cash-sessions/${sessionId}/movements`),

  getSummary: (sessionId: string) =>
    api.get<ApiResponse<SessionSummary>>(`/cash-sessions/${sessionId}/summary`),
};

export const ordersApi = {
  create: (data: {
    cashSessionId: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    payments: Array<{ method: 'CASH' | 'CARD' | 'VOUCHER'; amount: number }>;
    discount?: number;
  }) =>
    api.post<ApiResponse<Order>>('/orders', data),

  getById: (id: string) =>
    api.get<ApiResponse<Order>>(`/orders/${id}`),

  void: (id: string, reason: string) =>
    api.post<ApiResponse<Order>>(`/orders/${id}/void`, { reason }),

  getDailySummary: (date?: string) =>
    api.get<ApiResponse<{
      date: string;
      totalOrders: number;
      totalSales: number;
      totalVoided: number;
      byPaymentMethod: Record<string, number>;
    }>>(`/orders/summary/daily${date ? `?date=${date}` : ''}`),
};

export const venuesApi = {
  getAll: () =>
    api.get<ApiResponse<Venue[]>>('/venues'),

  getById: (id: string) =>
    api.get<ApiResponse<Venue>>(`/venues/${id}`),
};

export const staffApi = {
  getAll: (venueId: string) =>
    api.get<ApiResponse<Staff[]>>(`/staff/venue/${venueId}`),

  getById: (id: string) =>
    api.get<ApiResponse<Staff>>(`/staff/${id}`),

  create: (data: {
    venueId: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    pin?: string;
    role: StaffRole;
    hourlyRate?: number;
    notes?: string;
  }) =>
    api.post<ApiResponse<Staff>>('/staff', data),

  update: (id: string, data: Partial<Omit<Staff, 'id' | 'venueId' | 'createdAt' | 'updatedAt'>>) =>
    api.put<ApiResponse<Staff>>(`/staff/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/staff/${id}`),

  deactivate: (id: string) =>
    api.post<ApiResponse<Staff>>(`/staff/${id}/deactivate`),

  activate: (id: string) =>
    api.post<ApiResponse<Staff>>(`/staff/${id}/activate`),

  updatePin: (id: string, pin: string) =>
    api.post<ApiResponse<void>>(`/staff/${id}/pin`, { pin }),

  getSummary: (id: string, startDate?: string, endDate?: string) =>
    api.get<ApiResponse<StaffSummary>>(`/staff/${id}/summary${startDate ? `?startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`),
};

export const shiftsApi = {
  getByVenue: (venueId: string, date?: string) =>
    api.get<ApiResponse<Shift[]>>(`/shifts/venue/${venueId}${date ? `?date=${date}` : ''}`),

  getByStaff: (staffId: string, startDate?: string, endDate?: string) =>
    api.get<ApiResponse<Shift[]>>(`/shifts/staff/${staffId}${startDate ? `?startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`),

  create: (data: {
    staffId: string;
    venueId: string;
    scheduledStart: string;
    scheduledEnd: string;
    notes?: string;
  }) =>
    api.post<ApiResponse<Shift>>('/shifts', data),

  update: (id: string, data: Partial<Omit<Shift, 'id' | 'staffId' | 'venueId'>>) =>
    api.put<ApiResponse<Shift>>(`/shifts/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/shifts/${id}`),

  clockIn: (shiftId: string) =>
    api.post<ApiResponse<Shift>>(`/shifts/${shiftId}/clock-in`),

  clockOut: (shiftId: string) =>
    api.post<ApiResponse<Shift>>(`/shifts/${shiftId}/clock-out`),

  cancel: (shiftId: string, reason?: string) =>
    api.post<ApiResponse<Shift>>(`/shifts/${shiftId}/cancel`, { reason }),
};

export const permissionsApi = {
  getAll: () =>
    api.get<ApiResponse<Permission[]>>('/permissions'),

  getRolePermissions: (role: StaffRole) =>
    api.get<ApiResponse<RolePermissions>>(`/permissions/role/${role}`),

  updateRolePermissions: (role: StaffRole, permissionIds: string[]) =>
    api.put<ApiResponse<RolePermissions>>(`/permissions/role/${role}`, { permissionIds }),
};
