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
  PackagePlus,
  Minus,
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
  const [showStockModal, setShowStockModal] = useState(false);

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
            onClick={() => setShowStockModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
          >
            <PackagePlus className="w-5 h-5" />
            <span>Agregar Stock</span>
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

      {/* Stock Modal */}
      {showStockModal && (
        <AddStockModal
          products={products}
          categories={categories}
          onClose={() => setShowStockModal(false)}
          onSave={async () => {
            await refreshProducts();
            setShowStockModal(false);
          }}
        />
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
        categoryId: formData.categoryId && formData.categoryId.length > 0 ? formData.categoryId : null,
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

// Add Stock Modal Component
function AddStockModal({
  products,
  categories,
  onClose,
  onSave,
}: {
  products: Product[];
  categories: Category[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredProducts = products.filter((p) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.sku?.toLowerCase().includes(query)
    );
  });

  const handleAddStock = async () => {
    if (!selectedProduct) {
      setError('Selecciona un producto');
      return;
    }
    if (quantity <= 0) {
      setError('La cantidad debe ser mayor a 0');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const currentStock = selectedProduct.stock || 0;
      const newStock = currentStock + quantity;

      await productsApi.update(selectedProduct.id, { stock: newStock });

      setSuccess(`Stock actualizado: ${selectedProduct.name} ahora tiene ${newStock} unidades`);

      // Reset for next product
      setTimeout(() => {
        setSelectedProduct(null);
        setQuantity(1);
        setSuccess(null);
        onSave();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar stock');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-slate-800 rounded-2xl border border-slate-700 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600/20 rounded-xl flex items-center justify-center">
              <PackagePlus className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Agregar Stock</h2>
              <p className="text-sm text-slate-400">Ingreso de mercadería</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Left - Product Selection */}
          <div className="w-1/2 border-r border-slate-700 flex flex-col">
            <div className="p-3 border-b border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="Buscar producto..."
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredProducts.map((product) => {
                const category = categories.find((c) => c.id === product.categoryId);
                const isSelected = selectedProduct?.id === product.id;
                return (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={`w-full p-3 flex items-center gap-3 border-b border-slate-700 transition-colors text-left ${
                      isSelected
                        ? 'bg-emerald-600/20 border-l-2 border-l-emerald-500'
                        : 'hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${isSelected ? 'text-emerald-400' : ''}`}>
                        {product.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {category?.name || 'Sin categoría'} • {formatPrice(Number(product.price))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        (product.stock || 0) <= (product.minStock || 5)
                          ? 'text-amber-400'
                          : 'text-slate-300'
                      }`}>
                        {product.stock || 0}
                      </p>
                      <p className="text-xs text-slate-500">stock</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right - Quantity Input */}
          <div className="w-1/2 p-4 flex flex-col">
            {error && (
              <div className="mb-4 p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-emerald-600/20 border border-emerald-600/30 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
                <Check className="w-4 h-4" />
                {success}
              </div>
            )}

            {selectedProduct ? (
              <>
                <div className="mb-4 p-4 bg-slate-700/50 rounded-xl">
                  <p className="font-semibold text-lg">{selectedProduct.name}</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Stock actual: <span className="text-white font-medium">{selectedProduct.stock || 0}</span> unidades
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Cantidad a agregar
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-12 h-12 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white text-center text-xl font-bold focus:border-emerald-500 focus:outline-none"
                      min="1"
                    />
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-12 h-12 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Quick quantity buttons */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[6, 12, 24, 48].map((n) => (
                    <button
                      key={n}
                      onClick={() => setQuantity(n)}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        quantity === n
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                      }`}
                    >
                      +{n}
                    </button>
                  ))}
                </div>

                <div className="p-4 bg-emerald-600/10 border border-emerald-600/20 rounded-xl mb-4">
                  <p className="text-sm text-slate-400">Nuevo stock total:</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {(selectedProduct.stock || 0) + quantity} unidades
                  </p>
                </div>

                <button
                  onClick={handleAddStock}
                  disabled={isLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Confirmar Ingreso
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                <Package className="w-16 h-16 mb-3 opacity-30" />
                <p className="text-lg">Selecciona un producto</p>
                <p className="text-sm mt-1">de la lista para agregar stock</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
