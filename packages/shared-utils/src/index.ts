// ============================================
// FORMAT UTILITIES
// ============================================

/**
 * Format number as currency
 */
export function formatCurrency(
  amount: number,
  currency = 'CLP',
  locale = 'es-CL'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date
 */
export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
  locale = 'es-CL'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, options);
}

/**
 * Format time
 */
export function formatTime(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
  locale = 'es-CL'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

/**
 * Format date and time
 */
export function formatDateTime(
  date: Date | string,
  locale = 'es-CL'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${formatDate(d, undefined, locale)} ${formatTime(d, undefined, locale)}`;
}

// ============================================
// VALIDATION UTILITIES
// ============================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate Chilean RUT
 */
export function isValidRut(rut: string): boolean {
  if (!rut || rut.trim().length < 3) return false;
  
  const cleanRut = rut.replace(/[.-]/g, '').toUpperCase();
  const body = cleanRut.slice(0, -1);
  const verifier = cleanRut.slice(-1);
  
  let sum = 0;
  let multiplier = 2;
  
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const expectedVerifier = 11 - (sum % 11);
  const verifierChar =
    expectedVerifier === 11 ? '0' : expectedVerifier === 10 ? 'K' : String(expectedVerifier);
  
  return verifier === verifierChar;
}

/**
 * Format RUT with dots and dash
 */
export function formatRut(rut: string): string {
  const cleanRut = rut.replace(/[.-]/g, '');
  if (cleanRut.length < 2) return cleanRut;
  
  const body = cleanRut.slice(0, -1);
  const verifier = cleanRut.slice(-1);
  
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedBody}-${verifier}`;
}

/**
 * Validate Chilean phone number
 */
export function isValidChileanPhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  // Chilean mobile: 9 digits starting with 9
  // Chilean landline: 9 digits starting with 2
  return /^(56)?9\d{8}$/.test(clean) || /^(56)?2\d{8}$/.test(clean);
}

// ============================================
// STRING UTILITIES
// ============================================

/**
 * Generate a random alphanumeric string
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a ticket code
 */
export function generateTicketCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = generateRandomString(4);
  return `${timestamp}-${random}`;
}

/**
 * Generate a late guest code
 */
export function generateLateGuestCode(tableNumber: string): string {
  return `${tableNumber}-${generateRandomString(4)}`;
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.substring(0, length)}...`;
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert to title case
 */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => capitalize(word))
    .join(' ');
}

// ============================================
// ARRAY UTILITIES
// ============================================

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Sum array by key
 */
export function sumBy<T>(array: T[], key: keyof T): number {
  return array.reduce((sum, item) => {
    const value = item[key];
    return sum + (typeof value === 'number' ? value : 0);
  }, 0);
}

/**
 * Remove duplicates from array
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Remove duplicates by key
 */
export function uniqueBy<T>(array: T[], key: keyof T): T[] {
  const seen = new Set();
  return array.filter((item) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

// ============================================
// DATE UTILITIES
// ============================================

/**
 * Check if date is today
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/**
 * Get start of day
 */
export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day
 */
export function endOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Add hours to date
 */
export function addHours(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

/**
 * Get "nightclub day" (6am to 6am next day)
 */
export function getNightclubDay(date: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(date);
  const hour = d.getHours();
  
  // If before 6am, it's still "yesterday's" night
  if (hour < 6) {
    d.setDate(d.getDate() - 1);
  }
  
  const start = new Date(d);
  start.setHours(6, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(5, 59, 59, 999);
  
  return { start, end };
}

// ============================================
// NUMBER UTILITIES
// ============================================

/**
 * Round to N decimal places
 */
export function roundTo(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Calculate percentage
 */
export function percentage(value: number, total: number): number {
  if (total === 0) return 0;
  return roundTo((value / total) * 100, 1);
}

/**
 * Clamp number between min and max
 */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}
