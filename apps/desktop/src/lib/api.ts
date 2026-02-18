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

export interface AnalyticsAction {
  id: string;
  venueId: string;
  type: string;
  label: string;
  status: 'PENDING' | 'APPLIED' | 'FAILED';
  priority?: number;
  assignedRole?: string | null;
  metadata?: Record<string, unknown>;
  requestedById?: string | null;
  appliedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  error?: string | null;
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
  startTime: string | null;
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
// Events
// ============================================

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';

export interface Event {
  id: string;
  venueId: string;
  name: string;
  date: string;
  doorsOpen: string | null;
  doorsClose: string | null;
  capacity: number | null;
  status: EventStatus;
  settings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  ticketTypes?: TicketType[];
}

export type ConsumptionType = 'NONE' | 'FIXED_ITEMS' | 'CHOICE_UP_TO_VALUE' | 'MONEY_TICKET_SINGLE_USE' | 'MONEY_CARD_ACCOUNT';

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  price: number;
  quantity: number;
  consumptionType: ConsumptionType;
  consumptionValue: number | null;
  sortOrder: number;
  items?: Array<{ productId: string; quantity: number }>;
}

// ============================================
// Tickets
// ============================================

export type TicketStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';

export interface Ticket {
  id: string;
  ticketTypeId: string;
  code: string;
  status: TicketStatus;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  usedAt: string | null;
  createdAt: string;
  ticketType?: TicketType & { event?: Event };
}

// ============================================
// VIP Cards
// ============================================

export type VipCardType = 'CUSTOMER' | 'TABLE_VIP' | 'STAFF' | 'ADMIN' | 'COURTESY';

export interface VipCard {
  id: string;
  tenantId: string;
  cardNumber: string;
  type: VipCardType;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  balance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  transactions?: VipCardTransaction[];
}

export interface VipCardTransaction {
  id: string;
  cardId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  notes: string | null;
  createdAt: string;
}

// ============================================
// VIP Tables
// ============================================

export interface VipTable {
  id: string;
  venueId: string;
  name: string;
  capacity: number;
  minConsumption: number;
  location: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface ReservationGuest {
  id: string;
  reservationId: string;
  name: string;
  phone: string | null;
  isHolder: boolean;
  isLateGuest: boolean;
  arrivedAt: string | null;
  createdAt: string;
}

export interface Reservation {
  id: string;
  tableId: string;
  eventId: string;
  holderName: string;
  holderPhone: string;
  holderEmail: string | null;
  guestCount: number;
  lateGuestLimit: number;
  notes: string | null;
  status: ReservationStatus;
  vipCardId: string | null;
  lateCode: string | null;
  createdAt: string;
  updatedAt: string;
  table?: VipTable;
  guests?: ReservationGuest[];
}

// ============================================
// Access Control
// ============================================

export type AccessType = 'ENTRY' | 'EXIT' | 'RE_ENTRY';
export type AccessSource = 'CLUBIO_TICKET' | 'EXTERNAL_TICKET' | 'DOOR_SALE' | 'VIP_LIST' | 'COURTESY' | 'STAFF';

export interface AccessLog {
  id: string;
  venueId: string;
  eventId: string | null;
  type: AccessType;
  source: AccessSource;
  externalTicketId: string | null;
  internalTicketId: string | null;
  personName: string | null;
  scannedCode: string | null;
  createdAt: string;
}

export interface OccupancyData {
  venueId: string;
  currentOccupancy: number;
  totalEntries: number;
  totalExits: number;
}

export interface AccessStats {
  venueId: string;
  totalEntries: number;
  totalExits: number;
  totalReEntries: number;
  bySource: Record<string, number>;
}

// ============================================
// Warehouses
// ============================================

export type WarehouseType = 'MAIN_WAREHOUSE' | 'BAR';
export type StockMovementType = 'PURCHASE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'BREAKAGE' | 'THEFT_SUSPECTED' | 'SALE';

export interface Warehouse {
  id: string;
  venueId: string;
  name: string;
  type: WarehouseType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockItem {
  id: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  minQuantity: number;
  product?: Product;
}

export interface StockMovement {
  id: string;
  warehouseId: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  notes: string | null;
  reference: string | null;
  createdAt: string;
  product?: Product;
}

// ============================================
// Customers
// ============================================

export interface Customer {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  rut: string | null;
  notes: string | null;
  totalPurchases: number;
  lastPurchaseAt: string | null;
  isVip: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Promotions
// ============================================

export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type PromotionApplyTo = 'ALL' | 'CATEGORIES' | 'PRODUCTS';

export interface Promotion {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  applyTo: PromotionApplyTo;
  categoryIds: string[];
  productIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Reports
// ============================================

export interface DailySalesReport {
  date: string;
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  categorySales: Array<{ name: string; sales: number }>;
}

export interface SalesRangeSummary {
  startDate: string;
  endDate: string;
  days: DailySalesReport[];
  summary: {
    totalSales: number;
    totalOrders: number;
    avgTicket: number;
    avgDailySales: number;
    bestDay: { date: string; sales: number } | null;
    worstDay: { date: string; sales: number } | null;
    growthPercent: number;
    paymentMethods: Record<string, number>;
    topCategories: Array<{ name: string; sales: number }>;
    topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  };
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
      // Only logout if we have a token and it's actually invalid
      // Don't logout on transient errors (like DB connection issues)
      const errorMessage = error.response?.data?.error || '';
      const isTokenInvalid =
        errorMessage.includes('Invalid token') ||
        errorMessage.includes('Token expired') ||
        errorMessage.includes('No token provided');

      if (isTokenInvalid) {
        clearStoredToken();
        if (onUnauthorizedCallback) {
          onUnauthorizedCallback();
        }
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

  getDailySummary: (venueId: string, date?: string) =>
    api.get<ApiResponse<{
      date: string;
      orders: { total: number; revenue: number; discounts: number };
      voided: { total: number; amount: number };
      payments: Array<{ method: string; amount: number; count: number }>;
      topProducts: Array<{ product: { id: string; name: string }; quantitySold: number; totalRevenue: number }>;
    }>>(`/orders/daily-summary/${venueId}${date ? `?date=${date}` : ''}`),

  getRangeSummary: (venueId: string, startDate: string, endDate: string) =>
    api.get<ApiResponse<SalesRangeSummary>>(`/orders/summary/range/${venueId}?startDate=${startDate}&endDate=${endDate}`),
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

export const eventsApi = {
  getAll: (venueId: string) =>
    api.get<ApiResponse<Event[]>>(`/events?venueId=${venueId}`),

  getById: (id: string) =>
    api.get<ApiResponse<Event>>(`/events/${id}`),

  create: (data: { venueId: string; name: string; date: string; doorsOpen?: string; doorsClose?: string; capacity?: number; settings?: Record<string, unknown> }) =>
    api.post<ApiResponse<Event>>('/events', data),

  update: (id: string, data: Partial<{ name: string; date: string; doorsOpen: string; doorsClose: string; capacity: number; settings: Record<string, unknown> }>) =>
    api.put<ApiResponse<Event>>(`/events/${id}`, data),

  updateStatus: (id: string, status: EventStatus) =>
    api.patch<ApiResponse<Event>>(`/events/${id}/status`, { status }),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/events/${id}`),

  createTicketType: (eventId: string, data: { name: string; price: number; quantity: number; consumptionType?: ConsumptionType; consumptionValue?: number; sortOrder?: number }) =>
    api.post<ApiResponse<TicketType>>(`/events/${eventId}/ticket-types`, data),

  updateTicketType: (eventId: string, ticketTypeId: string, data: Partial<{ name: string; price: number; quantity: number; consumptionType: ConsumptionType; consumptionValue: number; sortOrder: number }>) =>
    api.put<ApiResponse<TicketType>>(`/events/${eventId}/ticket-types/${ticketTypeId}`, data),

  deleteTicketType: (eventId: string, ticketTypeId: string) =>
    api.delete<ApiResponse<void>>(`/events/${eventId}/ticket-types/${ticketTypeId}`),
};

export const ticketsApi = {
  generate: (data: { ticketTypeId: string; quantity: number; customerName?: string; customerEmail?: string; customerPhone?: string }) =>
    api.post<ApiResponse<Ticket[]>>('/tickets/generate', data),

  validate: (code: string) =>
    api.post<ApiResponse<Ticket>>('/tickets/validate', { code }),

  consume: (data: { ticketId: string; orderId: string; amount: number }) =>
    api.post<ApiResponse<void>>('/tickets/consume', data),

  getByEvent: (eventId: string) =>
    api.get<ApiResponse<Ticket[]>>(`/tickets/event/${eventId}`),

  getByCode: (code: string) =>
    api.get<ApiResponse<Ticket>>(`/tickets/by-code/${code}`),
};

export const vipCardsApi = {
  getAll: () =>
    api.get<ApiResponse<VipCard[]>>('/vip-cards'),

  getById: (id: string) =>
    api.get<ApiResponse<VipCard>>(`/vip-cards/${id}`),

  create: (data: { cardNumber: string; type?: VipCardType; customerName?: string; customerPhone?: string; customerEmail?: string; pin?: string }) =>
    api.post<ApiResponse<VipCard>>('/vip-cards', data),

  update: (id: string, data: Partial<{ customerName: string; customerPhone: string; customerEmail: string; pin: string }>) =>
    api.put<ApiResponse<VipCard>>(`/vip-cards/${id}`, data),

  loadBalance: (id: string, data: { amount: number; notes?: string }) =>
    api.post<ApiResponse<VipCard>>(`/vip-cards/${id}/load`, data),

  purchase: (id: string, data: { amount: number; orderId: string; notes?: string }) =>
    api.post<ApiResponse<VipCard>>(`/vip-cards/${id}/purchase`, data),

  transfer: (id: string, data: { toCardId: string; amount: number; notes?: string }) =>
    api.post<ApiResponse<VipCard>>(`/vip-cards/${id}/transfer`, data),

  block: (id: string) =>
    api.post<ApiResponse<VipCard>>(`/vip-cards/${id}/block`),

  unblock: (id: string) =>
    api.post<ApiResponse<VipCard>>(`/vip-cards/${id}/unblock`),
};

export const vipTablesApi = {
  getAll: (venueId: string) =>
    api.get<ApiResponse<VipTable[]>>(`/vip-tables?venueId=${venueId}`),

  create: (data: { venueId: string; name: string; capacity: number; minConsumption: number; location?: string; sortOrder?: number }) =>
    api.post<ApiResponse<VipTable>>('/vip-tables', data),

  update: (id: string, data: Partial<{ name: string; capacity: number; minConsumption: number; location: string; sortOrder: number }>) =>
    api.put<ApiResponse<VipTable>>(`/vip-tables/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/vip-tables/${id}`),

  getReservations: (eventId: string) =>
    api.get<ApiResponse<Reservation[]>>(`/vip-tables/reservations?eventId=${eventId}`),

  getReservation: (id: string) =>
    api.get<ApiResponse<Reservation>>(`/vip-tables/reservations/${id}`),

  createReservation: (data: { tableId: string; eventId: string; holderName: string; holderPhone: string; holderEmail?: string; guestCount: number; lateGuestLimit?: number; notes?: string; vipCardId?: string; guests?: Array<{ name: string; phone?: string; isHolder?: boolean }> }) =>
    api.post<ApiResponse<Reservation>>('/vip-tables/reservations', data),

  updateReservation: (id: string, data: Partial<{ holderName: string; holderPhone: string; holderEmail: string; guestCount: number; lateGuestLimit: number; notes: string; vipCardId: string }>) =>
    api.put<ApiResponse<Reservation>>(`/vip-tables/reservations/${id}`, data),

  updateReservationStatus: (id: string, status: ReservationStatus) =>
    api.patch<ApiResponse<Reservation>>(`/vip-tables/reservations/${id}/status`, { status }),

  deleteReservation: (id: string) =>
    api.delete<ApiResponse<void>>(`/vip-tables/reservations/${id}`),

  addGuest: (reservationId: string, data: { name: string; phone?: string; isLateGuest?: boolean }) =>
    api.post<ApiResponse<ReservationGuest>>(`/vip-tables/reservations/${reservationId}/guests`, data),

  removeGuest: (reservationId: string, guestId: string) =>
    api.delete<ApiResponse<void>>(`/vip-tables/reservations/${reservationId}/guests/${guestId}`),

  markGuestArrived: (reservationId: string, guestId: string) =>
    api.patch<ApiResponse<ReservationGuest>>(`/vip-tables/reservations/${reservationId}/guests/${guestId}/arrive`),
};

export const accessApi = {
  log: (data: { venueId: string; eventId?: string; type: AccessType; source: AccessSource; externalTicketId?: string; internalTicketId?: string; personName?: string; scannedCode?: string }) =>
    api.post<ApiResponse<AccessLog>>('/access/log', data),

  getLogs: (params: { venueId: string; eventId?: string; type?: AccessType; source?: AccessSource; startDate?: string; endDate?: string }) =>
    api.get<ApiResponse<AccessLog[]>>('/access/logs', { params }),

  getOccupancy: (venueId: string) =>
    api.get<ApiResponse<OccupancyData>>(`/access/occupancy/${venueId}`),

  getStats: (venueId: string, eventId?: string) =>
    api.get<ApiResponse<AccessStats>>(`/access/stats/${venueId}${eventId ? `?eventId=${eventId}` : ''}`),
};

export const warehousesApi = {
  getAll: (venueId: string) =>
    api.get<ApiResponse<Warehouse[]>>(`/warehouses?venueId=${venueId}`),

  getById: (id: string) =>
    api.get<ApiResponse<Warehouse>>(`/warehouses/${id}`),

  create: (data: { venueId: string; name: string; type?: WarehouseType }) =>
    api.post<ApiResponse<Warehouse>>('/warehouses', data),

  update: (id: string, data: Partial<{ name: string; type: WarehouseType }>) =>
    api.put<ApiResponse<Warehouse>>(`/warehouses/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/warehouses/${id}`),

  getStock: (id: string) =>
    api.get<ApiResponse<StockItem[]>>(`/warehouses/${id}/stock`),

  upsertStock: (id: string, items: Array<{ productId: string; quantity: number; minQuantity?: number }>) =>
    api.put<ApiResponse<void>>(`/warehouses/${id}/stock`, { items }),

  getMovements: (id: string, params?: { productId?: string; type?: StockMovementType; from?: string; to?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<{ movements: StockMovement[]; total: number }>>(`/warehouses/${id}/movements`, { params }),

  adjust: (id: string, data: { productId: string; type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'BREAKAGE' | 'THEFT_SUSPECTED'; quantity: number; notes?: string }) =>
    api.post<ApiResponse<StockMovement>>(`/warehouses/${id}/adjust`, data),

  transfer: (id: string, data: { toWarehouseId: string; items: Array<{ productId: string; quantity: number }> }) =>
    api.post<ApiResponse<void>>(`/warehouses/${id}/transfer`, data),

  purchase: (id: string, data: { items: Array<{ productId: string; quantity: number }>; reference?: string; notes?: string }) =>
    api.post<ApiResponse<void>>(`/warehouses/${id}/purchase`, data),
};

export const customersApi = {
  getAll: (params?: { search?: string; isVip?: boolean }) =>
    api.get<ApiResponse<Customer[]>>('/customers', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Customer>>(`/customers/${id}`),

  create: (data: { firstName: string; lastName: string; email?: string; phone?: string; address?: string; rut?: string; notes?: string; isVip?: boolean }) =>
    api.post<ApiResponse<Customer>>('/customers', data),

  update: (id: string, data: Partial<{ firstName: string; lastName: string; email: string; phone: string; address: string; rut: string; notes: string; isVip: boolean }>) =>
    api.put<ApiResponse<Customer>>(`/customers/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/customers/${id}`),
};

export const promotionsApi = {
  getAll: (activeOnly?: boolean) =>
    api.get<ApiResponse<Promotion[]>>(`/promotions${activeOnly ? '?activeOnly=true' : ''}`),

  getById: (id: string) =>
    api.get<ApiResponse<Promotion>>(`/promotions/${id}`),

  create: (data: {
    name: string;
    description?: string;
    discountType: DiscountType;
    discountValue: number;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    applyTo?: PromotionApplyTo;
    categoryIds?: string[];
    productIds?: string[];
    isActive?: boolean;
  }) =>
    api.post<ApiResponse<Promotion>>('/promotions', data),

  update: (id: string, data: Partial<{
    name: string;
    description: string;
    discountType: DiscountType;
    discountValue: number;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    applyTo: PromotionApplyTo;
    categoryIds: string[];
    productIds: string[];
    isActive: boolean;
  }>) =>
    api.put<ApiResponse<Promotion>>(`/promotions/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/promotions/${id}`),
};

export const analyticsApi = {
  getActions: (
    venueId: string,
    status: 'PENDING' | 'APPLIED' | 'FAILED' = 'PENDING',
    limit: number = 20,
    barId?: string
  ) =>
    api.get<ApiResponse<{ actions: AnalyticsAction[] }>>('/analytics/actions', {
      params: { venueId, status, limit, barId },
    }),

  resolveAction: (actionId: string, status: 'APPLIED' | 'FAILED', note?: string) =>
    api.post<ApiResponse<{ id: string; status: string }>>('/analytics/actions/resolve', {
      actionId,
      status,
      note,
    }),
};
