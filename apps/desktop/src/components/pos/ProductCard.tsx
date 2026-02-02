import { Product } from '../../lib/api';
import { Wine } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
  categoryColor?: string;
}

export function ProductCard({ product, onAdd, categoryColor }: ProductCardProps) {
  const displayName = product.shortName || product.name;
  const bgColor = categoryColor || '#374151';

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <button
      onClick={() => onAdd(product)}
      className="
        relative flex flex-col items-center justify-center
        p-3 rounded-xl bg-slate-800 border-2 border-slate-700
        hover:border-indigo-500 hover:bg-slate-750
        active:scale-[0.97] active:bg-indigo-600/20
        transition-all duration-100
        min-h-[110px] group touch-manipulation
      "
      style={{
        borderLeftColor: bgColor,
        borderLeftWidth: '5px',
      }}
    >
      {/* Alcoholic indicator */}
      {product.isAlcoholic && (
        <div className="absolute top-1.5 right-1.5">
          <Wine className="w-4 h-4 text-purple-400" />
        </div>
      )}

      {/* Product name - larger text */}
      <span className="text-white font-semibold text-center leading-tight mb-1.5 line-clamp-2 text-base">
        {displayName}
      </span>

      {/* Price - much larger */}
      <span
        className="text-xl font-bold"
        style={{ color: categoryColor || '#818cf8' }}
      >
        {formatPrice(product.price)}
      </span>

      {/* Active/pressed effect */}
      <div
        className="
          absolute inset-0 rounded-xl opacity-0 group-hover:opacity-10 group-active:opacity-20
          transition-opacity duration-100
        "
        style={{ backgroundColor: bgColor }}
      />
    </button>
  );
}
