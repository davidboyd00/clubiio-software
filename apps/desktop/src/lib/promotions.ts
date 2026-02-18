// Promotions/Happy Hour System
// Uses backend API for persistence, keeps pure functions for POS cart logic

import { Promotion as ApiPromotion, promotionsApi } from './api';

// Re-export the API type for convenience
export type Promotion = ApiPromotion;

// Cache for promotions (used by POS cart which needs sync access)
let promotionsCache: Promotion[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds

// Load promotions from API (async)
export async function loadPromotions(): Promise<Promotion[]> {
  try {
    const res = await promotionsApi.getAll();
    promotionsCache = res.data.data || [];
    cacheTimestamp = Date.now();
    return promotionsCache;
  } catch {
    return promotionsCache;
  }
}

// Get cached promotions (sync, for POS cart)
export function getCachedPromotions(): Promotion[] {
  return promotionsCache;
}

// Refresh cache if stale
export async function ensureFreshCache(): Promise<void> {
  if (Date.now() - cacheTimestamp > CACHE_TTL) {
    await loadPromotions();
  }
}

// Check if a promotion is currently active based on schedule
export function isPromotionActiveNow(promotion: Promotion): boolean {
  if (!promotion.isActive) return false;

  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  // Check if current day is in schedule
  if (!promotion.daysOfWeek.includes(currentDay)) return false;

  // Parse start and end times
  const [startHour, startMin] = promotion.startTime.split(':').map(Number);
  const [endHour, endMin] = promotion.endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // Handle overnight promotions (e.g., 22:00 - 02:00)
  if (endMinutes < startMinutes) {
    return currentTime >= startMinutes || currentTime <= endMinutes;
  }

  return currentTime >= startMinutes && currentTime <= endMinutes;
}

// Get all currently active promotions (uses cache for sync access)
export function getActivePromotions(): Promotion[] {
  return promotionsCache.filter(isPromotionActiveNow);
}

// Check if a promotion applies to a specific product
export function promotionAppliesToProduct(
  promotion: Promotion,
  productId: string,
  categoryId: string | null
): boolean {
  if (promotion.applyTo === 'ALL') return true;

  if (promotion.applyTo === 'PRODUCTS' && promotion.productIds) {
    return promotion.productIds.includes(productId);
  }

  if (promotion.applyTo === 'CATEGORIES' && promotion.categoryIds && categoryId) {
    return promotion.categoryIds.includes(categoryId);
  }

  return false;
}

// Calculate discount for a product based on active promotions
export function calculatePromotionDiscount(
  productId: string,
  categoryId: string | null,
  originalPrice: number
): { discount: number; promotionName: string | null } {
  const activePromotions = getActivePromotions();

  let maxDiscount = 0;
  let appliedPromotion: Promotion | null = null;

  for (const promotion of activePromotions) {
    if (promotionAppliesToProduct(promotion, productId, categoryId)) {
      let discount = 0;
      const discountValue = Number(promotion.discountValue);

      if (promotion.discountType === 'PERCENTAGE') {
        discount = Math.round(originalPrice * (discountValue / 100));
      } else {
        discount = Math.min(discountValue, originalPrice);
      }

      // Apply the best discount
      if (discount > maxDiscount) {
        maxDiscount = discount;
        appliedPromotion = promotion;
      }
    }
  }

  return {
    discount: maxDiscount,
    promotionName: appliedPromotion?.name || null,
  };
}

// Get time until next promotion change (start or end)
export function getTimeUntilPromotionChange(): { minutes: number; isStarting: boolean; promotion: Promotion | null } | null {
  const promotions = promotionsCache.filter(p => p.isActive);
  if (promotions.length === 0) return null;

  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let nearestChange: { minutes: number; isStarting: boolean; promotion: Promotion } | null = null;

  for (const promotion of promotions) {
    if (!promotion.daysOfWeek.includes(currentDay)) continue;

    const [startHour, startMin] = promotion.startTime.split(':').map(Number);
    const [endHour, endMin] = promotion.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const isActive = isPromotionActiveNow(promotion);

    if (isActive) {
      let minutesUntilEnd = endMinutes - currentMinutes;
      if (minutesUntilEnd < 0) minutesUntilEnd += 24 * 60;

      if (!nearestChange || minutesUntilEnd < nearestChange.minutes) {
        nearestChange = { minutes: minutesUntilEnd, isStarting: false, promotion };
      }
    } else {
      let minutesUntilStart = startMinutes - currentMinutes;
      if (minutesUntilStart < 0) minutesUntilStart += 24 * 60;

      if (!nearestChange || minutesUntilStart < nearestChange.minutes) {
        nearestChange = { minutes: minutesUntilStart, isStarting: true, promotion };
      }
    }
  }

  return nearestChange;
}

// Format days of week for display
export function formatDaysOfWeek(days: number[]): string {
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  if (days.length === 7) return 'Todos los días';
  if (days.length === 0) return 'Ningún día';

  // Check for weekdays (Mon-Fri)
  if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) {
    return 'Lun - Vie';
  }

  // Check for weekends
  if (days.length === 2 && days.includes(0) && days.includes(6)) {
    return 'Fin de semana';
  }

  return days.map(d => dayNames[d]).join(', ');
}
