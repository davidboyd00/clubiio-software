import { create } from 'zustand';
import { Product } from '../lib/api';
import { calculatePromotionDiscount, getActivePromotions } from '../lib/promotions';

// ============================================
// Types
// ============================================

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  shortName: string | null;
  price: number;
  quantity: number;
  isAlcoholic: boolean;
  categoryId: string | null;
}

export interface CartItemWithPromotion extends CartItem {
  promotionDiscount: number;
  promotionName: string | null;
  finalPrice: number;
}

interface CartState {
  items: CartItem[];
  discount: number;
  discountType: 'fixed' | 'percentage';

  // Computed (via selectors)
  // Actions
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  incrementQuantity: (productId: string) => void;
  decrementQuantity: (productId: string) => void;
  setDiscount: (amount: number, type: 'fixed' | 'percentage') => void;
  clearDiscount: () => void;
  clear: () => void;
}

// ============================================
// Store
// ============================================

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  discount: 0,
  discountType: 'fixed',

  addItem: (product: Product) => {
    set((state) => {
      const existingItem = state.items.find((item) => item.productId === product.id);

      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      }

      const newItem: CartItem = {
        id: `cart-${product.id}-${Date.now()}`,
        productId: product.id,
        name: product.name,
        shortName: product.shortName,
        price: product.price,
        quantity: 1,
        isAlcoholic: product.isAlcoholic,
        categoryId: product.categoryId || null,
      };

      return { items: [...state.items, newItem] };
    });
  },

  removeItem: (productId: string) => {
    set((state) => ({
      items: state.items.filter((item) => item.productId !== productId),
    }));
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }

    set((state) => ({
      items: state.items.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      ),
    }));
  },

  incrementQuantity: (productId: string) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ),
    }));
  },

  decrementQuantity: (productId: string) => {
    const item = get().items.find((i) => i.productId === productId);
    if (!item) return;

    if (item.quantity <= 1) {
      get().removeItem(productId);
    } else {
      set((state) => ({
        items: state.items.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i
        ),
      }));
    }
  },

  setDiscount: (amount: number, type: 'fixed' | 'percentage') => {
    set({ discount: amount, discountType: type });
  },

  clearDiscount: () => {
    set({ discount: 0, discountType: 'fixed' });
  },

  clear: () => {
    set({ items: [], discount: 0, discountType: 'fixed' });
  },
}));

// ============================================
// Selectors / Hook
// ============================================

export function useCart() {
  const store = useCartStore();

  // Calculate items with promotion discounts
  const activePromotions = getActivePromotions();
  const hasActivePromotions = activePromotions.length > 0;

  const itemsWithPromotions: CartItemWithPromotion[] = store.items.map((item) => {
    const { discount, promotionName } = calculatePromotionDiscount(
      item.productId,
      item.categoryId,
      item.price
    );

    return {
      ...item,
      promotionDiscount: discount,
      promotionName,
      finalPrice: item.price - discount,
    };
  });

  // Calculate totals - use final prices (after promotion) for subtotal
  const subtotal = itemsWithPromotions.reduce(
    (sum, item) => sum + item.finalPrice * item.quantity,
    0
  );

  // Total promotion discounts (for display)
  const totalPromotionDiscount = itemsWithPromotions.reduce(
    (sum, item) => sum + item.promotionDiscount * item.quantity,
    0
  );

  // Original subtotal (before any discounts)
  const originalSubtotal = store.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Manual discount (applied after promotion discounts)
  const manualDiscountAmount =
    store.discountType === 'percentage'
      ? Math.round(subtotal * (store.discount / 100))
      : store.discount;

  const total = Math.max(0, subtotal - manualDiscountAmount);

  const itemCount = store.items.reduce((sum, item) => sum + item.quantity, 0);

  const hasAlcoholicItems = store.items.some((item) => item.isAlcoholic);

  return {
    items: itemsWithPromotions,
    rawItems: store.items,
    discount: store.discount,
    discountType: store.discountType,
    discountAmount: manualDiscountAmount,
    promotionDiscount: totalPromotionDiscount,
    originalSubtotal,
    subtotal,
    total,
    itemCount,
    hasAlcoholicItems,
    hasActivePromotions,
    activePromotions,
    isEmpty: store.items.length === 0,

    // Actions
    addItem: store.addItem,
    removeItem: store.removeItem,
    updateQuantity: store.updateQuantity,
    incrementQuantity: store.incrementQuantity,
    decrementQuantity: store.decrementQuantity,
    setDiscount: store.setDiscount,
    clearDiscount: store.clearDiscount,
    clear: store.clear,
  };
}
