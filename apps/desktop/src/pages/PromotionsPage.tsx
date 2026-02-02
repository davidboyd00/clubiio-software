import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Clock,
  Tag,
  Percent,
  DollarSign,
  Calendar,
  Zap,
  ZapOff,
} from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import {
  Promotion,
  loadPromotions,
  savePromotions,
  isPromotionActiveNow,
  formatDaysOfWeek,
} from '../lib/promotions';

const DAYS_OF_WEEK = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

export function PromotionsPage() {
  const navigate = useNavigate();
  const { products, categories } = useProducts();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Load promotions
  useEffect(() => {
    setPromotions(loadPromotions());
  }, []);

  // Refresh active status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setPromotions(loadPromotions());
    }, 60000); // Every minute
    return () => clearInterval(interval);
  }, []);

  const handleCreate = () => {
    setEditingPromotion(null);
    setShowModal(true);
  };

  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setShowModal(true);
  };

  const handleSave = (promotion: Promotion) => {
    let updated: Promotion[];
    if (editingPromotion) {
      updated = promotions.map((p) => (p.id === promotion.id ? promotion : p));
    } else {
      updated = [...promotions, promotion];
    }
    setPromotions(updated);
    savePromotions(updated);
    setShowModal(false);
    setEditingPromotion(null);
  };

  const handleDelete = (id: string) => {
    const updated = promotions.filter((p) => p.id !== id);
    setPromotions(updated);
    savePromotions(updated);
    setDeleteConfirm(null);
  };

  const handleToggle = (id: string) => {
    const updated = promotions.map((p) =>
      p.id === id ? { ...p, isActive: !p.isActive } : p
    );
    setPromotions(updated);
    savePromotions(updated);
  };

  const activeCount = promotions.filter((p) => isPromotionActiveNow(p)).length;

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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600/20 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="font-semibold">Promociones & Happy Hour</h1>
              <p className="text-xs text-slate-400">
                {promotions.length} promociones • {activeCount} activas ahora
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Nueva Promoción</span>
        </button>
      </div>

      {/* Active Promotions Banner */}
      {activeCount > 0 && (
        <div className="mx-4 mt-4 p-4 bg-amber-600/20 border border-amber-600/30 rounded-xl">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-amber-400" />
            <div>
              <p className="font-medium text-amber-400">
                {activeCount} promoción{activeCount > 1 ? 'es' : ''} activa{activeCount > 1 ? 's' : ''} ahora
              </p>
              <p className="text-sm text-amber-300/70">
                Los descuentos se aplican automáticamente en el POS
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Promotions List */}
      <div className="flex-1 overflow-y-auto p-4">
        {promotions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <Zap className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">Sin promociones</p>
            <p className="text-sm mt-1">Crea tu primera promoción o happy hour</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {promotions.map((promotion) => {
              const isActiveNow = isPromotionActiveNow(promotion);
              return (
                <div
                  key={promotion.id}
                  className={`bg-slate-800 border rounded-xl overflow-hidden ${
                    isActiveNow
                      ? 'border-amber-600/50'
                      : 'border-slate-700'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Status indicator */}
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isActiveNow
                            ? 'bg-amber-600/20'
                            : promotion.isActive
                            ? 'bg-slate-700'
                            : 'bg-slate-700/50'
                        }`}
                      >
                        {promotion.discountType === 'percentage' ? (
                          <Percent className={`w-6 h-6 ${isActiveNow ? 'text-amber-400' : 'text-slate-400'}`} />
                        ) : (
                          <DollarSign className={`w-6 h-6 ${isActiveNow ? 'text-amber-400' : 'text-slate-400'}`} />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{promotion.name}</h3>
                          {isActiveNow && (
                            <span className="px-2 py-0.5 bg-amber-600/20 text-amber-400 rounded-full text-xs font-medium flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              Activa
                            </span>
                          )}
                          {!promotion.isActive && (
                            <span className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded-full text-xs font-medium">
                              Desactivada
                            </span>
                          )}
                        </div>

                        {promotion.description && (
                          <p className="text-sm text-slate-400 mt-1">{promotion.description}</p>
                        )}

                        <div className="flex flex-wrap gap-3 mt-3 text-sm">
                          {/* Discount */}
                          <div className="flex items-center gap-1 text-emerald-400">
                            <Tag className="w-4 h-4" />
                            <span>
                              {promotion.discountType === 'percentage'
                                ? `${promotion.discountValue}% descuento`
                                : `$${promotion.discountValue.toLocaleString()} descuento`}
                            </span>
                          </div>

                          {/* Schedule */}
                          <div className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-4 h-4" />
                            <span>
                              {promotion.startTime} - {promotion.endTime}
                            </span>
                          </div>

                          {/* Days */}
                          <div className="flex items-center gap-1 text-slate-400">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDaysOfWeek(promotion.daysOfWeek)}</span>
                          </div>
                        </div>

                        {/* Apply to */}
                        <div className="mt-2 text-xs text-slate-500">
                          Aplica a:{' '}
                          {promotion.applyTo === 'all'
                            ? 'Todos los productos'
                            : promotion.applyTo === 'categories'
                            ? `${promotion.categoryIds?.length || 0} categorías`
                            : `${promotion.productIds?.length || 0} productos`}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggle(promotion.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            promotion.isActive
                              ? 'text-amber-400 hover:bg-amber-600/20'
                              : 'text-slate-500 hover:bg-slate-700'
                          }`}
                          title={promotion.isActive ? 'Desactivar' : 'Activar'}
                        >
                          {promotion.isActive ? (
                            <Zap className="w-5 h-5" />
                          ) : (
                            <ZapOff className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(promotion)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(promotion.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Promotion Modal */}
      {showModal && (
        <PromotionModal
          promotion={editingPromotion}
          categories={categories}
          products={products}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingPromotion(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-lg mb-2">Eliminar Promoción</h3>
            <p className="text-slate-400 mb-6">
              ¿Estás seguro de eliminar esta promoción? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
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

// Promotion Modal Component
import { Product, Category } from '../lib/api';

function PromotionModal({
  promotion,
  categories,
  products,
  onSave,
  onClose,
}: {
  promotion: Promotion | null;
  categories: Category[];
  products: Product[];
  onSave: (promotion: Promotion) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: promotion?.name || '',
    description: promotion?.description || '',
    discountType: promotion?.discountType || 'percentage' as 'percentage' | 'fixed',
    discountValue: promotion?.discountValue?.toString() || '',
    daysOfWeek: promotion?.daysOfWeek || [1, 2, 3, 4, 5], // Mon-Fri default
    startTime: promotion?.startTime || '18:00',
    endTime: promotion?.endTime || '21:00',
    applyTo: promotion?.applyTo || 'all' as 'all' | 'categories' | 'products',
    categoryIds: promotion?.categoryIds || [] as string[],
    productIds: promotion?.productIds || [] as string[],
    isActive: promotion?.isActive ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);

    if (!formData.name.trim()) {
      setError('El nombre es requerido');
      return;
    }
    if (!formData.discountValue || parseFloat(formData.discountValue) <= 0) {
      setError('El descuento debe ser mayor a 0');
      return;
    }
    if (formData.discountType === 'percentage' && parseFloat(formData.discountValue) > 100) {
      setError('El porcentaje no puede ser mayor a 100%');
      return;
    }
    if (formData.daysOfWeek.length === 0) {
      setError('Selecciona al menos un día');
      return;
    }

    const newPromotion: Promotion = {
      id: promotion?.id || `promo-${Date.now()}`,
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      discountType: formData.discountType,
      discountValue: parseFloat(formData.discountValue),
      daysOfWeek: formData.daysOfWeek,
      startTime: formData.startTime,
      endTime: formData.endTime,
      applyTo: formData.applyTo,
      categoryIds: formData.applyTo === 'categories' ? formData.categoryIds : undefined,
      productIds: formData.applyTo === 'products' ? formData.productIds : undefined,
      isActive: formData.isActive,
      createdAt: promotion?.createdAt || new Date().toISOString(),
    };

    onSave(newPromotion);
  };

  const toggleDay = (day: number) => {
    if (formData.daysOfWeek.includes(day)) {
      setFormData({ ...formData, daysOfWeek: formData.daysOfWeek.filter((d) => d !== day) });
    } else {
      setFormData({ ...formData, daysOfWeek: [...formData.daysOfWeek, day] });
    }
  };

  const toggleCategory = (id: string) => {
    if (formData.categoryIds.includes(id)) {
      setFormData({ ...formData, categoryIds: formData.categoryIds.filter((c) => c !== id) });
    } else {
      setFormData({ ...formData, categoryIds: [...formData.categoryIds, id] });
    }
  };

  const toggleProduct = (id: string) => {
    if (formData.productIds.includes(id)) {
      setFormData({ ...formData, productIds: formData.productIds.filter((p) => p !== id) });
    } else {
      setFormData({ ...formData, productIds: [...formData.productIds, id] });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-800 rounded-2xl border border-slate-700 shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">
            {promotion ? 'Editar Promoción' : 'Nueva Promoción'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Nombre *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-amber-500 focus:outline-none"
              placeholder="Ej: Happy Hour, 2x1 Cervezas"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Descripción
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-amber-500 focus:outline-none"
              placeholder="Descripción opcional"
            />
          </div>

          {/* Discount Type & Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tipo de Descuento
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, discountType: 'percentage' })}
                  className={`flex-1 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                    formData.discountType === 'percentage'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  <Percent className="w-4 h-4" />
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, discountType: 'fixed' })}
                  className={`flex-1 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                    formData.discountType === 'fixed'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  $
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Valor *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {formData.discountType === 'percentage' ? '%' : '$'}
                </span>
                <input
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-amber-500 focus:outline-none"
                  placeholder="0"
                  min="0"
                  max={formData.discountType === 'percentage' ? 100 : undefined}
                />
              </div>
            </div>
          </div>

          {/* Schedule - Days */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Días de la Semana *
            </label>
            <div className="flex gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.daysOfWeek.includes(day.value)
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule - Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Hora Inicio
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Hora Fin
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Apply To */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Aplicar a
            </label>
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Todos' },
                { value: 'categories', label: 'Categorías' },
                { value: 'products', label: 'Productos' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, applyTo: option.value as any })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    formData.applyTo === option.value
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Selection */}
          {formData.applyTo === 'categories' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Seleccionar Categorías
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      formData.categoryIds.includes(cat.id)
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product Selection */}
          {formData.applyTo === 'products' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Seleccionar Productos
              </label>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {products.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => toggleProduct(prod.id)}
                    className={`w-full px-3 py-2 rounded-lg text-sm text-left transition-colors flex items-center justify-between ${
                      formData.productIds.includes(prod.id)
                        ? 'bg-amber-600/20 text-amber-400 border border-amber-600/30'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <span>{prod.name}</span>
                    {formData.productIds.includes(prod.id) && (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-300">Promoción activa</span>
          </label>
        </div>

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
            className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
