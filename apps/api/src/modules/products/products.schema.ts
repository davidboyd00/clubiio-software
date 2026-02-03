import { z } from 'zod';

// Helper to convert empty strings to null for optional string fields
const optionalString = z.preprocess(
  (val) => (val === '' || val === undefined ? null : val),
  z.string().nullable()
);

export const createProductSchema = z.object({
  categoryId: optionalString,
  name: z.string().min(2).max(100),
  shortName: z.string().max(15).optional(), // For receipt printing
  sku: z.string().max(50).optional(),
  barcode: z.string().max(50).optional(),
  price: z.number().positive(),
  cost: z.number().positive().optional(),
  isAlcoholic: z.boolean().default(false),
  isReturnable: z.boolean().default(false),
  depositAmount: z.number().positive().optional(),
  trackStock: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateProductSchema = createProductSchema.partial().extend({
  stock: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
});

export const reorderProductsSchema = z.object({
  products: z.array(
    z.object({
      id: z.string().uuid(),
      sortOrder: z.number().int().min(0),
    })
  ),
});

export const bulkUpdatePricesSchema = z.object({
  products: z.array(
    z.object({
      id: z.string().uuid(),
      price: z.number().positive(),
    })
  ),
});

export const importProductsSchema = z.object({
  products: z.array(
    z.object({
      categoryName: z.string(), // Will be matched or created
      name: z.string().min(2).max(100),
      shortName: z.string().max(15).optional(),
      sku: z.string().max(50).optional(),
      barcode: z.string().max(50).optional(),
      price: z.number().positive(),
      cost: z.number().positive().optional(),
      isAlcoholic: z.boolean().default(false),
    })
  ),
  createMissingCategories: z.boolean().default(true),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ReorderProductsInput = z.infer<typeof reorderProductsSchema>;
export type BulkUpdatePricesInput = z.infer<typeof bulkUpdatePricesSchema>;
export type ImportProductsInput = z.infer<typeof importProductsSchema>;