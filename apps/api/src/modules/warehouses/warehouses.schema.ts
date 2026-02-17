import { z } from 'zod';

// ============================================
// Warehouse CRUD
// ============================================

export const createWarehouseSchema = z.object({
  venueId: z.string().uuid(),
  name: z.string().min(2).max(100),
  type: z.enum(['MAIN_WAREHOUSE', 'BAR']).optional(),
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  type: z.enum(['MAIN_WAREHOUSE', 'BAR']).optional(),
});

// ============================================
// Stock Items
// ============================================

export const upsertStockSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().min(0),
        minQuantity: z.number().min(0).optional(),
      })
    )
    .min(1),
});

// ============================================
// Stock Movements
// ============================================

export const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'BREAKAGE', 'THEFT_SUSPECTED']),
  quantity: z.number().positive(),
  notes: z.string().max(500).optional(),
});

export const transferStockSchema = z.object({
  toWarehouseId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive(),
      })
    )
    .min(1),
});

export const purchaseStockSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive(),
      })
    )
    .min(1),
  reference: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

// ============================================
// Types
// ============================================

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type UpsertStockInput = z.infer<typeof upsertStockSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type TransferStockInput = z.infer<typeof transferStockSchema>;
export type PurchaseStockInput = z.infer<typeof purchaseStockSchema>;
