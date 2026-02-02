import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  GripVertical,
  X,
  Check,
  Loader2,
  FolderOpen,
  Palette,
} from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { Category, categoriesApi } from '../lib/api';

// Predefined colors for categories
const CATEGORY_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#0ea5e9', // Sky
  '#3b82f6', // Blue
  '#6b7280', // Gray
];

export function CategoryManagementPage() {
  const navigate = useNavigate();
  const { categories, refreshProducts } = useProducts();

  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreate = () => {
    setEditingCategory(null);
    setShowModal(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await categoriesApi.delete(id);
      await refreshProducts();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting category:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    await refreshProducts();
    setShowModal(false);
    setEditingCategory(null);
  };

  // Sort categories by sortOrder
  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/products')}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="font-semibold">Categorías</h1>
              <p className="text-xs text-slate-400">{categories.length} categorías</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Nueva Categoría</span>
        </button>
      </div>

      {/* Categories List */}
      <div className="flex-1 overflow-y-auto p-4">
        {sortedCategories.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <FolderOpen className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">Sin categorías</p>
            <p className="text-sm mt-1">Crea tu primera categoría</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-2">
            {sortedCategories.map((category) => (
              <div
                key={category.id}
                className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-4 group"
              >
                {/* Drag handle (visual only for now) */}
                <div className="text-slate-600 cursor-grab">
                  <GripVertical className="w-5 h-5" />
                </div>

                {/* Color indicator */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: category.color || '#6b7280' }}
                >
                  {category.icon || category.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h3 className="font-medium">{category.name}</h3>
                  <p className="text-sm text-slate-400">
                    Orden: {category.sortOrder} • {category.color || 'Sin color'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(category)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(category.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category Modal */}
      {showModal && (
        <CategoryModal
          category={editingCategory}
          existingCategories={categories}
          onClose={() => {
            setShowModal(false);
            setEditingCategory(null);
          }}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-lg mb-2">Eliminar Categoría</h3>
            <p className="text-slate-400 mb-1">
              ¿Estás seguro de eliminar esta categoría?
            </p>
            <p className="text-amber-400 text-sm mb-6">
              Los productos de esta categoría quedarán sin categoría asignada.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Category Modal Component
function CategoryModal({
  category,
  existingCategories,
  onClose,
  onSave,
}: {
  category: Category | null;
  existingCategories: Category[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    color: category?.color || CATEGORY_COLORS[0],
    icon: category?.icon || '',
    sortOrder: category?.sortOrder?.toString() || String(existingCategories.length + 1),
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

    setIsLoading(true);

    try {
      const data = {
        name: formData.name.trim(),
        color: formData.color,
        icon: formData.icon.trim() || undefined,
        sortOrder: parseInt(formData.sortOrder) || 0,
      };

      if (category) {
        await categoriesApi.update(category.id, data);
      } else {
        await categoriesApi.create(data);
      }

      onSave();
    } catch (err: any) {
      setError(err.message || 'Error al guardar categoría');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">
            {category ? 'Editar Categoría' : 'Nueva Categoría'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Preview */}
          <div className="flex items-center justify-center py-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
              style={{ backgroundColor: formData.color }}
            >
              {formData.icon || formData.name.charAt(0).toUpperCase() || '?'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Nombre *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
              placeholder="Ej: Bebidas, Comidas, etc."
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <span className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Color
              </span>
            </label>
            <div className="grid grid-cols-9 gap-2">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-lg transition-all ${
                    formData.color === color
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Icono (emoji)
              </label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value.slice(0, 2) })}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white text-center text-xl focus:border-indigo-500 focus:outline-none"
                placeholder="🍺"
                maxLength={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Orden
              </label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none"
                min="1"
              />
            </div>
          </div>
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
