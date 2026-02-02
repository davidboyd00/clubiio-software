import { Product, Category } from '../../lib/api';
import { ProductCard } from './ProductCard';
import { Package, Loader2 } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  categories: Category[];
  selectedCategoryId: string | null;
  onAddProduct: (product: Product) => void;
  isLoading?: boolean;
}

export function ProductGrid({
  products,
  categories,
  selectedCategoryId,
  onAddProduct,
  isLoading,
}: ProductGridProps) {
  // Get category color
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const categoryColor = selectedCategory?.color || undefined;

  // Filter products by category
  const filteredProducts = selectedCategoryId
    ? products.filter((p) => p.categoryId === selectedCategoryId)
    : products;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          <span className="text-slate-400">Cargando productos...</span>
        </div>
      </div>
    );
  }

  if (filteredProducts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Package className="w-16 h-16 opacity-50" />
          <span className="text-lg">No hay productos en esta categoría</span>
          <span className="text-sm">Selecciona otra categoría o sincroniza</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-1">
      {filteredProducts.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAdd={onAddProduct}
          categoryColor={categoryColor}
        />
      ))}
    </div>
  );
}
