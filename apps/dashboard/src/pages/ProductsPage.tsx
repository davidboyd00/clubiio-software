import { useState } from 'react';
import { Plus, Search, Package, Edit2, Trash2 } from 'lucide-react';

const categories = [
  { id: 'all', name: 'Todos' },
  { id: 'drinks', name: 'Bebidas' },
  { id: 'food', name: 'Comida' },
  { id: 'merchandise', name: 'Merchandise' },
];

// Sample data - replace with API
const sampleProducts = [
  { id: '1', name: 'Cerveza Draft', category: 'drinks', price: 3000, stock: 500, active: true },
  { id: '2', name: 'Vodka Tonic', category: 'drinks', price: 5000, stock: 200, active: true },
  { id: '3', name: 'Pisco Sour', category: 'drinks', price: 4000, stock: 150, active: true },
  { id: '4', name: 'Nachos', category: 'food', price: 4500, stock: 80, active: true },
  { id: '5', name: 'Papas Fritas', category: 'food', price: 3500, stock: 100, active: false },
];

export default function ProductsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const filteredProducts = sampleProducts.filter((product) => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-500">Gestiona tu catálogo de productos</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Producto
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                <th className="pb-3 font-medium">Producto</th>
                <th className="pb-3 font-medium">Categoría</th>
                <th className="pb-3 font-medium text-right">Precio</th>
                <th className="pb-3 font-medium text-right">Stock</th>
                <th className="pb-3 font-medium text-center">Estado</th>
                <th className="pb-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Package className="w-5 h-5 text-gray-400" />
                      </div>
                      <span className="font-medium text-gray-900">{product.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-gray-600 capitalize">{product.category}</td>
                  <td className="py-3 text-right font-medium text-gray-900">
                    {formatCurrency(product.price)}
                  </td>
                  <td className="py-3 text-right text-gray-600">{product.stock}</td>
                  <td className="py-3 text-center">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        product.active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {product.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
