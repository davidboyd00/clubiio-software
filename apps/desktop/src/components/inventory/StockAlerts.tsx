import { useMemo } from 'react';
import { AlertTriangle, Package, X } from 'lucide-react';
import { Product } from '../../lib/api';
import { getSettings } from '../../pages/SettingsPage';

interface StockAlertsProps {
  products: Product[];
  onDismiss?: () => void;
  compact?: boolean;
}

export function StockAlerts({ products, onDismiss, compact = false }: StockAlertsProps) {
  const settings = getSettings();

  const lowStockProducts = useMemo(() => {
    if (!settings.lowStockAlert) return [];

    return products.filter((p) => {
      if (p.stock === undefined || p.stock === null) return false;
      const threshold = p.minStock ?? settings.lowStockThreshold;
      return p.stock <= threshold && p.isActive;
    }).sort((a, b) => (a.stock || 0) - (b.stock || 0));
  }, [products, settings.lowStockAlert, settings.lowStockThreshold]);

  const outOfStock = lowStockProducts.filter((p) => (p.stock || 0) <= 0);
  const lowStock = lowStockProducts.filter((p) => (p.stock || 0) > 0);

  if (lowStockProducts.length === 0) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-600/20 border border-amber-600/30 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span className="text-sm text-amber-300">
          {outOfStock.length > 0 && `${outOfStock.length} sin stock`}
          {outOfStock.length > 0 && lowStock.length > 0 && ' • '}
          {lowStock.length > 0 && `${lowStock.length} con stock bajo`}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-600/20 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold">Alertas de Stock</h3>
            <p className="text-xs text-slate-400">
              {lowStockProducts.length} productos requieren atención
            </p>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-700 max-h-64 overflow-y-auto">
        {/* Out of Stock */}
        {outOfStock.map((product) => (
          <div
            key={product.id}
            className="px-4 py-3 flex items-center gap-3 bg-red-600/10"
          >
            <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{product.name}</p>
              <p className="text-xs text-red-400">Sin stock</p>
            </div>
            <span className="px-2 py-1 bg-red-600/20 text-red-400 text-sm font-bold rounded">
              0
            </span>
          </div>
        ))}

        {/* Low Stock */}
        {lowStock.map((product) => (
          <div
            key={product.id}
            className="px-4 py-3 flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-amber-600/20 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{product.name}</p>
              <p className="text-xs text-slate-400">
                Mínimo: {product.minStock ?? settings.lowStockThreshold}
              </p>
            </div>
            <span className="px-2 py-1 bg-amber-600/20 text-amber-400 text-sm font-bold rounded">
              {product.stock}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Badge component for navbar/sidebar
export function StockAlertBadge({ products }: { products: Product[] }) {
  const settings = getSettings();

  const alertCount = useMemo(() => {
    if (!settings.lowStockAlert) return 0;

    return products.filter((p) => {
      if (p.stock === undefined || p.stock === null) return false;
      const threshold = p.minStock ?? settings.lowStockThreshold;
      return p.stock <= threshold && p.isActive;
    }).length;
  }, [products, settings.lowStockAlert, settings.lowStockThreshold]);

  if (alertCount === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
      {alertCount > 9 ? '9+' : alertCount}
    </span>
  );
}
