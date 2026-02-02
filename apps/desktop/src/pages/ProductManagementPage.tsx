import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  Loader2,
  AlertTriangle,
  X,
  Check,
  ImageOff,
  FolderOpen,
} from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { Product, Category, productsApi } from '../lib/api';

export function ProductManagementPage() {
  const navigate = useNavigate();
  const { products, categories, isLoading, refreshProducts } = useProducts();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await productsApi.delete(id);
      await refreshProducts();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleSave = async () => {
    await refreshProducts();
    setShowModal(false);
    setEditingProduct(null);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/pos')}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold">Gestión de Productos</h1>
            <p className="text-xs text-slate-400">{products.length} productos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/categories')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <FolderOpen className="w-5 h-5" />
            <span>Categorías</span>
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o SKU..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <select
          value={selectedCategory || ''}
          onChange={(e) => setSelectedCategory(e.target.value || null)}
          className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Package className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">Sin productos</p>
            <p className="text-sm mt-1">
              {searchQuery ? 'No hay productos que coincidan' : 'Agrega tu primer producto'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                category={categories.find((c) => c.id === product.categoryId)}
                onEdit={() => handleEdit(product)}
                onDelete={() => setDeleteConfirm(product.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Modal */}
      {showModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onClose={() => {
            setShowModal(false);
            setEditingProduct(null);
          }}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Eliminar Producto</h3>
                <p className="text-slate-400 mt-1">
                  ¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl font-medium transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Product Card Component
function ProductCard({
  product,
  category,
  onEdit,
  onDelete,
}: {
  product: Product;
  category?: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden group">
      {/* Image */}
      <div className="aspect-square bg-slate-700 relative">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff className="w-12 h-12 text-slate-600" />
          </div>
        )}
        {/* Stock badge */}
        {product.stock !== undefined && product.stock !== null && (
          <div
            className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-medium ${
              product.stock <= 0
                ? 'bg-red-600/90 text-white'
                : product.stock <= 10
                ? 'bg-amber-600/90 text-white'
                : 'bg-slate-800/90 text-white'
            }`}
          >
            Stock: {product.stock}
          </div>
        )}
        {/* Actions overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button
            onClick={onEdit}
            className="p-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors"
          >
            <Edit2 className="w-5 h-5" />
          </button>
          <button
            onClick={onDelete}
            className="p-3 bg-red-600 hover:bg-red-500 rounded-xl transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
      {/* Info */}
      <div className="p-3">
        <p className="font-medium truncate">{product.name}</p>
        <p className="text-sm text-slate-400 truncate">{category?.name || 'Sin categoría'}</p>
        <div className="flex items-center justify-between mt-2">
          <p className="text-lg font-bold text-emerald-400">{formatPrice(product.price)}</p>
          {product.sku && (
            <span className="text-xs text-slate-500">{product.sku}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Product Modal Component
function ProductModal({
  product,
  categories,
  onClose,
  onSave,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price?.toString() || '',
    categoryId: product?.categoryId || '',
    sku: product?.sku || '',
    imageUrl: product?.imageUrl || '',
    stock: product?.stock?.toString() || '',
    minStock: product?.minStock?.toString() || '5',
    isActive: product?.isActive ?? true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('El nombre es requerido');
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      setError('El precio debe ser mayor a 0');
      return;
    }

    setIsLoading(true);

    try {
      const data = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        price: parseFloat(formData.price),
        categoryId: formData.categoryId || undefined,
        sku: formData.sku.trim() || undefined,
        imageUrl: formData.imageUrl.trim() || undefined,
        stock: formData.stock ? parseInt(formData.stock) : undefined,
        minStock: formData.minStock ? parseInt(formData.minStock) : undefined,
        isActive: formData.isActive,
      };

      if (product) {
        await productsApi.update(product.id, data);
      } else {
        await productsApi.create(data as any);
      }

      onSave();
    } catch (err: any) {
      setError(err.message || 'Error al guardar producto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-800 rounded-2xl border border-slate-700 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">
            {product ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Nombre *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
              placeholder="Nombre del producto"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none resize-none"
              placeholder="Descripción opcional"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Precio *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                SKU
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                placeholder="SKU-001"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Categoría
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Sin categoría</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              URL de Imagen
            </label>
            <input
              type="url"
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Stock Actual
              </label>
              <input
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Stock Mínimo
              </label>
              <input
                type="number"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                placeholder="5"
                min="0"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-300">Producto activo (visible en POS)</span>
          </label>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5" />
                Guardar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
