import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Loader2,
  X,
  Check,
  Warehouse as WarehouseIcon,
  AlertTriangle,
  Package,
  ArrowRightLeft,
  ShoppingCart,
  Wrench,
  Trash2,
  Search,
} from 'lucide-react';
import {
  Warehouse,
  WarehouseType,
  StockItem,
  StockMovement,
  StockMovementType,
  Product,
  warehousesApi,
  productsApi,
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';

type TabType = 'stock' | 'movements';

const WAREHOUSE_TYPE_LABELS: Record<WarehouseType, string> = {
  MAIN_WAREHOUSE: 'Bodega Principal',
  BAR: 'Barra',
};

const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  PURCHASE: 'Compra',
  TRANSFER_IN: 'Transferencia entrada',
  TRANSFER_OUT: 'Transferencia salida',
  ADJUSTMENT_IN: 'Ajuste entrada',
  ADJUSTMENT_OUT: 'Ajuste salida',
  BREAKAGE: 'Quiebre',
  THEFT_SUSPECTED: 'Robo sospechado',
  SALE: 'Venta',
};

const MOVEMENT_TYPE_COLORS: Record<StockMovementType, string> = {
  PURCHASE: 'bg-emerald-600/20 text-emerald-400',
  TRANSFER_IN: 'bg-blue-600/20 text-blue-400',
  TRANSFER_OUT: 'bg-blue-600/20 text-blue-400',
  ADJUSTMENT_IN: 'bg-amber-600/20 text-amber-400',
  ADJUSTMENT_OUT: 'bg-amber-600/20 text-amber-400',
  BREAKAGE: 'bg-red-600/20 text-red-400',
  THEFT_SUSPECTED: 'bg-red-600/20 text-red-400',
  SALE: 'bg-slate-600/20 text-slate-400',
};

export function WarehousesPage() {
  const navigate = useNavigate();
  const { venueId } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('stock');
  const [loading, setLoading] = useState(true);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Modal states
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showUpsertModal, setShowUpsertModal] = useState(false);

  const loadWarehouses = useCallback(async () => {
    if (!venueId) return;
    try {
      setLoading(true);
      const res = await warehousesApi.getAll(venueId);
      if (res.data.data) {
        setWarehouses(res.data.data);
        if (!selectedWarehouseId && res.data.data.length > 0) {
          setSelectedWarehouseId(res.data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading warehouses:', err);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  const handleDeleteWarehouse = async (id: string) => {
    try {
      await warehousesApi.delete(id);
      await loadWarehouses();
      setDeleteConfirm(null);
      if (selectedWarehouseId === id) setSelectedWarehouseId('');
    } catch (err) {
      console.error('Error deleting warehouse:', err);
    }
  };

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId);

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/pos')} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600/20 rounded-xl flex items-center justify-center">
              <WarehouseIcon className="w-5 h-5 text-orange-400" />
            </div>
            <h1 className="font-semibold">Bodegas</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditingWarehouse(null); setShowWarehouseModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">
            <Plus className="w-5 h-5" /><span>Nueva Bodega</span>
          </button>
        </div>
      </div>

      {/* Warehouse Selector + Tabs */}
      <div className="px-4 pt-3 flex items-center gap-4">
        <select
          value={selectedWarehouseId}
          onChange={(e) => setSelectedWarehouseId(e.target.value)}
          className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:outline-none min-w-[200px]"
        >
          <option value="">Seleccionar bodega</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name} ({WAREHOUSE_TYPE_LABELS[w.type]})</option>
          ))}
        </select>

        {selectedWarehouse && (
          <>
            <div className="flex gap-1">
              <button onClick={() => setActiveTab('stock')} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'stock' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>Stock</button>
              <button onClick={() => setActiveTab('movements')} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'movements' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>Movimientos</button>
            </div>

            <div className="ml-auto flex gap-2">
              <button onClick={() => { setEditingWarehouse(selectedWarehouse); setShowWarehouseModal(true); }} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Editar bodega"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => setDeleteConfirm(selectedWarehouse.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors" title="Desactivar bodega"><Trash2 className="w-4 h-4" /></button>
            </div>
          </>
        )}
      </div>

      {/* Action buttons */}
      {selectedWarehouseId && activeTab === 'stock' && (
        <div className="px-4 pt-3 flex gap-2">
          <button onClick={() => setShowUpsertModal(true)} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm transition-colors"><Package className="w-4 h-4" />Agregar Stock</button>
          <button onClick={() => setShowAdjustModal(true)} className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm transition-colors"><Wrench className="w-4 h-4" />Ajuste</button>
          <button onClick={() => setShowTransferModal(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors"><ArrowRightLeft className="w-4 h-4" />Transferir</button>
          <button onClick={() => setShowPurchaseModal(true)} className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm transition-colors"><ShoppingCart className="w-4 h-4" />Compra</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
        ) : !selectedWarehouseId ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <WarehouseIcon className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">{warehouses.length === 0 ? 'Sin bodegas' : 'Selecciona una bodega'}</p>
          </div>
        ) : (
          <>
            {activeTab === 'stock' && <StockTab warehouseId={selectedWarehouseId} />}
            {activeTab === 'movements' && <MovementsTab warehouseId={selectedWarehouseId} />}
          </>
        )}
      </div>

      {showWarehouseModal && <WarehouseModal warehouse={editingWarehouse} venueId={venueId!} onClose={() => { setShowWarehouseModal(false); setEditingWarehouse(null); }} onSave={async () => { setShowWarehouseModal(false); setEditingWarehouse(null); await loadWarehouses(); }} />}
      {showAdjustModal && selectedWarehouseId && <AdjustModal warehouseId={selectedWarehouseId} onClose={() => setShowAdjustModal(false)} onSave={() => { setShowAdjustModal(false); }} />}
      {showTransferModal && selectedWarehouseId && <TransferStockModal warehouseId={selectedWarehouseId} warehouses={warehouses} onClose={() => setShowTransferModal(false)} onSave={() => { setShowTransferModal(false); }} />}
      {showPurchaseModal && selectedWarehouseId && <PurchaseModal warehouseId={selectedWarehouseId} onClose={() => setShowPurchaseModal(false)} onSave={() => { setShowPurchaseModal(false); }} />}
      {showUpsertModal && selectedWarehouseId && <UpsertStockModal warehouseId={selectedWarehouseId} onClose={() => setShowUpsertModal(false)} onSave={() => { setShowUpsertModal(false); }} />}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-6 h-6 text-red-400" /></div>
              <div><h3 className="font-semibold text-lg">Desactivar Bodega</h3><p className="text-slate-400 mt-1">Esta acción desactivará la bodega.</p></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
              <button onClick={() => handleDeleteWarehouse(deleteConfirm)} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl font-medium transition-colors">Desactivar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StockTab({ warehouseId }: { warehouseId: string }) {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadStock = useCallback(async () => {
    try {
      setLoading(true);
      const res = await warehousesApi.getStock(warehouseId);
      if (res.data.data) setStock(res.data.data);
    } catch (err) {
      console.error('Error loading stock:', err);
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  const filteredStock = stock.filter((s) => {
    if (!searchQuery) return true;
    return s.product?.name.toLowerCase().includes(searchQuery.toLowerCase()) || false;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar producto..." className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
      </div>

      {filteredStock.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Package className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">Sin stock</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Producto</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Cantidad</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Mínimo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredStock.map((item) => {
                const isLow = item.quantity <= item.minQuantity;
                return (
                  <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{item.product?.name || item.productId}</td>
                    <td className={`px-4 py-3 text-right font-medium ${isLow ? 'text-red-400' : 'text-white'}`}>{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{item.minQuantity}</td>
                    <td className="px-4 py-3">
                      {isLow && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-red-600/20 text-red-400">
                          <AlertTriangle className="w-3 h-3" />Stock bajo
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MovementsTab({ warehouseId }: { warehouseId: string }) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<StockMovementType | ''>('');

  const loadMovements = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 50 };
      if (typeFilter) params.type = typeFilter;
      const res = await warehousesApi.getMovements(warehouseId, params);
      if (res.data.data) {
        setMovements(res.data.data.movements || []);
        setTotal(res.data.data.total || 0);
      }
    } catch (err) {
      console.error('Error loading movements:', err);
    } finally {
      setLoading(false);
    }
  }, [warehouseId, page, typeFilter]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as StockMovementType | ''); setPage(1); }} className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:outline-none">
          <option value="">Todos los tipos</option>
          {Object.entries(MOVEMENT_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : movements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <ArrowRightLeft className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">Sin movimientos</p>
        </div>
      ) : (
        <>
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Producto</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Cantidad</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Notas</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((mov) => (
                  <tr key={mov.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-400">{formatDate(mov.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg ${MOVEMENT_TYPE_COLORS[mov.type]}`}>{MOVEMENT_TYPE_LABELS[mov.type]}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{mov.product?.name || mov.productId}</td>
                    <td className="px-4 py-3 text-right font-medium">{mov.quantity}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{mov.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > 50 && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm transition-colors">Anterior</button>
              <span className="text-sm text-slate-400">Página {page}</span>
              <button onClick={() => setPage(page + 1)} disabled={page * 50 >= total} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm transition-colors">Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WarehouseModal({ warehouse, venueId, onClose, onSave }: { warehouse: Warehouse | null; venueId: string; onClose: () => void; onSave: () => void }) {
  const [formData, setFormData] = useState({
    name: warehouse?.name || '',
    type: warehouse?.type || 'MAIN_WAREHOUSE' as WarehouseType,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name.trim()) { setError('El nombre es requerido'); return; }

    setIsLoading(true);
    try {
      if (warehouse) {
        await warehousesApi.update(warehouse.id, { name: formData.name.trim(), type: formData.type });
      } else {
        await warehousesApi.create({ venueId, name: formData.name.trim(), type: formData.type });
      }
      onSave();
    } catch (err: any) {
      setError(err.message || 'Error al guardar bodega');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">{warehouse ? 'Editar Bodega' : 'Nueva Bodega'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nombre *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="Bodega principal" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo</label>
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as WarehouseType })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none">
              {Object.entries(WAREHOUSE_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </form>
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={isLoading} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" />Guardar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdjustModal({ warehouseId, onClose, onSave }: { warehouseId: string; onClose: () => void; onSave: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [formData, setFormData] = useState({
    productId: '',
    type: 'ADJUSTMENT_IN' as 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'BREAKAGE' | 'THEFT_SUSPECTED',
    quantity: '',
    notes: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    productsApi.getAll().then((res) => {
      if (res.data.data) setProducts(res.data.data);
    }).catch(console.error);
  }, []);

  const adjustTypes = [
    { value: 'ADJUSTMENT_IN', label: 'Ajuste entrada' },
    { value: 'ADJUSTMENT_OUT', label: 'Ajuste salida' },
    { value: 'BREAKAGE', label: 'Quiebre' },
    { value: 'THEFT_SUSPECTED', label: 'Robo sospechado' },
  ];

  const handleSubmit = async () => {
    setError(null);
    if (!formData.productId) { setError('Selecciona un producto'); return; }
    if (!formData.quantity || parseInt(formData.quantity) <= 0) { setError('La cantidad debe ser mayor a 0'); return; }

    setIsLoading(true);
    try {
      await warehousesApi.adjust(warehouseId, {
        productId: formData.productId,
        type: formData.type,
        quantity: parseInt(formData.quantity),
        notes: formData.notes.trim() || undefined,
      });
      onSave();
    } catch (err: any) {
      setError(err.message || 'Error al realizar ajuste');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">Ajuste de Stock</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          {error && <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Producto *</label>
            <select value={formData.productId} onChange={(e) => setFormData({ ...formData, productId: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none">
              <option value="">Seleccionar producto</option>
              {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de ajuste *</label>
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none">
              {adjustTypes.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Cantidad *</label>
            <input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" min="1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Notas</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none resize-none" rows={2} />
          </div>
        </div>
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={isLoading} className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Wrench className="w-5 h-5" />Ajustar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function TransferStockModal({ warehouseId, warehouses, onClose, onSave }: { warehouseId: string; warehouses: Warehouse[]; onClose: () => void; onSave: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [items, setItems] = useState<Array<{ productId: string; quantity: string }>>([{ productId: '', quantity: '' }]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherWarehouses = warehouses.filter((w) => w.id !== warehouseId && w.isActive);

  useEffect(() => {
    productsApi.getAll().then((res) => {
      if (res.data.data) setProducts(res.data.data);
    }).catch(console.error);
  }, []);

  const addItem = () => setItems([...items, { productId: '', quantity: '' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: string) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!toWarehouseId) { setError('Selecciona bodega destino'); return; }
    const validItems = items.filter((i) => i.productId && parseInt(i.quantity) > 0);
    if (validItems.length === 0) { setError('Agrega al menos un producto'); return; }

    setIsLoading(true);
    try {
      await warehousesApi.transfer(warehouseId, {
        toWarehouseId,
        items: validItems.map((i) => ({ productId: i.productId, quantity: parseInt(i.quantity) })),
      });
      onSave();
    } catch (err: any) {
      setError(err.message || 'Error al transferir');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-800 rounded-2xl border border-slate-700 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">Transferir Stock</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Bodega destino *</label>
            <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none">
              <option value="">Seleccionar bodega</option>
              {otherWarehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Productos *</label>
              <button onClick={addItem} className="text-xs text-indigo-400 hover:text-indigo-300">+ Agregar producto</button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <select value={item.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)} className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="">Producto</option>
                  {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                <input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="w-24 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:border-indigo-500 focus:outline-none" placeholder="Qty" min="1" />
                {items.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="p-2 text-slate-400 hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={isLoading} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRightLeft className="w-5 h-5" />Transferir</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function PurchaseModal({ warehouseId, onClose, onSave }: { warehouseId: string; onClose: () => void; onSave: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<Array<{ productId: string; quantity: string }>>([{ productId: '', quantity: '' }]);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    productsApi.getAll().then((res) => {
      if (res.data.data) setProducts(res.data.data);
    }).catch(console.error);
  }, []);

  const addItem = () => setItems([...items, { productId: '', quantity: '' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: string) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  const handleSubmit = async () => {
    setError(null);
    const validItems = items.filter((i) => i.productId && parseInt(i.quantity) > 0);
    if (validItems.length === 0) { setError('Agrega al menos un producto'); return; }

    setIsLoading(true);
    try {
      await warehousesApi.purchase(warehouseId, {
        items: validItems.map((i) => ({ productId: i.productId, quantity: parseInt(i.quantity) })),
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onSave();
    } catch (err: any) {
      setError(err.message || 'Error al registrar compra');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-800 rounded-2xl border border-slate-700 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">Registrar Compra</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">{error}</div>}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Productos *</label>
              <button onClick={addItem} className="text-xs text-indigo-400 hover:text-indigo-300">+ Agregar producto</button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <select value={item.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)} className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="">Producto</option>
                  {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                <input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="w-24 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:border-indigo-500 focus:outline-none" placeholder="Qty" min="1" />
                {items.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="p-2 text-slate-400 hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
                )}
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Referencia</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="N° factura, guía, etc." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none resize-none" rows={2} />
          </div>
        </div>
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={isLoading} className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShoppingCart className="w-5 h-5" />Registrar Compra</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function UpsertStockModal({ warehouseId, onClose, onSave }: { warehouseId: string; onClose: () => void; onSave: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<Array<{ productId: string; quantity: string; minQuantity: string }>>([{ productId: '', quantity: '', minQuantity: '' }]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    productsApi.getAll().then((res) => {
      if (res.data.data) setProducts(res.data.data);
    }).catch(console.error);
  }, []);

  const addItem = () => setItems([...items, { productId: '', quantity: '', minQuantity: '' }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: string) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  const handleSubmit = async () => {
    setError(null);
    const validItems = items.filter((i) => i.productId && i.quantity);
    if (validItems.length === 0) { setError('Agrega al menos un producto'); return; }

    setIsLoading(true);
    try {
      await warehousesApi.upsertStock(warehouseId, validItems.map((i) => ({
        productId: i.productId,
        quantity: parseInt(i.quantity) || 0,
        minQuantity: i.minQuantity ? parseInt(i.minQuantity) : undefined,
      })));
      onSave();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar stock');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-800 rounded-2xl border border-slate-700 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">Agregar/Actualizar Stock</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">{error}</div>}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Productos</label>
              <button onClick={addItem} className="text-xs text-indigo-400 hover:text-indigo-300">+ Agregar</button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <select value={item.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)} className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="">Producto</option>
                  {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                <input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="w-20 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:border-indigo-500 focus:outline-none" placeholder="Qty" min="0" />
                <input type="number" value={item.minQuantity} onChange={(e) => updateItem(idx, 'minQuantity', e.target.value)} className="w-20 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:border-indigo-500 focus:outline-none" placeholder="Mín" min="0" />
                {items.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="p-2 text-slate-400 hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={isLoading} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" />Guardar Stock</>}
          </button>
        </div>
      </div>
    </div>
  );
}
