import { TrendingUp, Package } from 'lucide-react';

interface ProductStat {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
  image?: string;
}

interface TopProductsProps {
  products: ProductStat[];
  title?: string;
  showRevenue?: boolean;
}

export function TopProducts({
  products,
  title = 'Productos Mas Vendidos',
  showRevenue = true,
}: TopProductsProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const maxQuantity = Math.max(...products.map(p => p.quantity), 1);

  if (products.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <h3 className="font-semibold mb-4">{title}</h3>
        <div className="flex flex-col items-center justify-center py-8 text-slate-500">
          <Package className="w-12 h-12 mb-3 opacity-30" />
          <p>Sin datos de productos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{title}</h3>
        <TrendingUp className="w-5 h-5 text-emerald-400" />
      </div>
      <div className="space-y-3">
        {products.map((product, index) => (
          <div key={product.id} className="flex items-center gap-3">
            {/* Ranking */}
            <div className={`
              w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
              ${index === 0 ? 'bg-amber-500/20 text-amber-400' :
                index === 1 ? 'bg-slate-400/20 text-slate-300' :
                index === 2 ? 'bg-orange-600/20 text-orange-400' :
                'bg-slate-700 text-slate-400'}
            `}>
              {index + 1}
            </div>

            {/* Product info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{product.name}</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">{product.quantity} uds</span>
                {showRevenue && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-emerald-400">{formatPrice(product.revenue)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  index === 0 ? 'bg-amber-500' :
                  index === 1 ? 'bg-slate-400' :
                  index === 2 ? 'bg-orange-500' :
                  'bg-indigo-500'
                }`}
                style={{ width: `${(product.quantity / maxQuantity) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
