// ============================================
// USER & AUTH TYPES
// ============================================

export type UserRole =
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'CASHIER'
  | 'BARTENDER'
  | 'DOORMAN'
  | 'RRPP';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  tenantId: string;
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

// ============================================
// TENANT & VENUE TYPES
// ============================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export interface Venue {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  timezone: string;
  capacity?: number;
  isActive: boolean;
}

// ============================================
// PRODUCT TYPES
// ============================================

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  shortName?: string;
  sku?: string;
  barcode?: string;
  price: number;
  cost?: number;
  isAlcoholic: boolean;
  isReturnable: boolean;
  depositAmount?: number;
  trackStock: boolean;
  sortOrder: number;
  isActive: boolean;
}

// ============================================
// ORDER TYPES
// ============================================

export type OrderStatus = 'PENDING' | 'COMPLETED' | 'VOIDED';

export type PaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'TRANSFER'
  | 'VIP_CARD'
  | 'MERCADOPAGO'
  | 'TICKET_CREDIT';

export interface OrderItem {
  id: string;
  productId: string;
  product?: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
}

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  items: OrderItem[];
  payments: Payment[];
  subtotal: number;
  discount: number;
  total: number;
  notes?: string;
  createdAt: string;
}

// ============================================
// CASH REGISTER TYPES
// ============================================

export type CashRegisterType = 'BAR' | 'TICKET_BOOTH' | 'GENERAL';
export type CashSessionStatus = 'OPEN' | 'CLOSED';

export interface CashRegister {
  id: string;
  venueId: string;
  name: string;
  type: CashRegisterType;
  isActive: boolean;
}

export interface CashSession {
  id: string;
  cashRegisterId: string;
  userId: string;
  status: CashSessionStatus;
  initialAmount: number;
  finalAmount?: number;
  expectedAmount?: number;
  difference?: number;
  openedAt: string;
  closedAt?: string;
}

// ============================================
// TICKET TYPES
// ============================================

export type TicketConsumptionType =
  | 'NONE'
  | 'FIXED_ITEMS'
  | 'CHOICE_UP_TO_VALUE'
  | 'MONEY_TICKET_SINGLE_USE'
  | 'MONEY_CARD_ACCOUNT';

export type TicketStatus = 'VALID' | 'USED' | 'CANCELLED' | 'EXPIRED';

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
  consumptionType: TicketConsumptionType;
  consumptionValue?: number;
  isActive: boolean;
}

export interface Ticket {
  id: string;
  ticketTypeId: string;
  code: string;
  status: TicketStatus;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  consumptionRemaining?: number;
  consumptionUsed: boolean;
  purchasedAt: string;
  usedAt?: string;
}

// ============================================
// VIP CARD TYPES
// ============================================

export type VIPCardType =
  | 'CUSTOMER'
  | 'TABLE_VIP'
  | 'STAFF'
  | 'ADMIN'
  | 'COURTESY';

export type VIPCardStatus = 'ACTIVE' | 'BLOCKED' | 'EXPIRED';

export interface VIPCard {
  id: string;
  cardNumber: string;
  type: VIPCardType;
  status: VIPCardStatus;
  balance: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
}

// ============================================
// VIP TABLE TYPES
// ============================================

export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface VIPTable {
  id: string;
  venueId: string;
  name: string;
  capacity: number;
  minConsumption: number;
  location?: string;
  isActive: boolean;
}

export interface VIPTableReservation {
  id: string;
  tableId: string;
  eventId: string;
  status: ReservationStatus;
  holderName: string;
  holderPhone: string;
  holderEmail?: string;
  guestCount: number;
  lateGuestCode: string;
  lateGuestLimit: number;
  totalConsumption: number;
}

// ============================================
// SOCKET EVENTS
// ============================================

export interface SocketEvents {
  // Orders
  'order:created': Order;
  'order:voided': { orderId: string; reason: string };
  
  // Cash
  'cash:opened': { sessionId: string; cashRegisterId: string; userId: string };
  'cash:closed': { sessionId: string; summary: CashSession };
  
  // Tickets
  'ticket:sold': { ticketId: string; ticketTypeId: string };
  'ticket:checkin': { ticketId: string; personName?: string };
  
  // VIP Tables
  'vip-table:updated': { reservationId: string; status: ReservationStatus };
  'vip-table:late-guest': { reservationId: string; guestName: string };
  
  // Alerts
  'alert:stock-low': { productId: string; productName: string; quantity: number };
  'alert:void-request': { orderId: string; amount: number; reason?: string };
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
