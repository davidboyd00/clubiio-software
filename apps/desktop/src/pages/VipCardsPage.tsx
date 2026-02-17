import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  Edit2,
  Loader2,
  X,
  Check,
  CreditCard,
  DollarSign,
  Ban,
  Unlock,
  ArrowRightLeft,
  Eye,
  ChevronLeft,
} from 'lucide-react';
import {
  VipCard,
  VipCardType,
  vipCardsApi,
} from '../lib/api';

const TYPE_LABELS: Record<VipCardType, string> = {
  CUSTOMER: 'Cliente',
  TABLE_VIP: 'Mesa VIP',
  STAFF: 'Staff',
  ADMIN: 'Admin',
  COURTESY: 'Cortesía',
};

const TYPE_COLORS: Record<VipCardType, string> = {
  CUSTOMER: 'bg-blue-600/20 text-blue-400',
  TABLE_VIP: 'bg-purple-600/20 text-purple-400',
  STAFF: 'bg-emerald-600/20 text-emerald-400',
  ADMIN: 'bg-amber-600/20 text-amber-400',
  COURTESY: 'bg-pink-600/20 text-pink-400',
};

export function VipCardsPage() {
  const navigate = useNavigate();
  const [cards, setCards] = useState<VipCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<VipCardType | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState<VipCard | null>(null);
  const [selectedCard, setSelectedCard] = useState<VipCard | null>(null);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [actionCardId, setActionCardId] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    try {
      setLoading(true);
      const res = await vipCardsApi.getAll();
      if (res.data.data) setCards(res.data.data);
    } catch (err) {
      console.error('Error loading cards:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const filteredCards = cards.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || c.cardNumber.toLowerCase().includes(q) || c.customerName?.toLowerCase().includes(q) || false;
    const matchesType = !typeFilter || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleCreate = () => { setEditingCard(null); setShowModal(true); };
  const handleEdit = (card: VipCard) => { setEditingCard(card); setShowModal(true); };

  const handleViewDetail = async (card: VipCard) => {
    try {
      const res = await vipCardsApi.getById(card.id);
      if (res.data.data) setSelectedCard(res.data.data);
    } catch (err) {
      console.error('Error loading card detail:', err);
    }
  };

  const handleBlock = async (id: string) => {
    try {
      await vipCardsApi.block(id);
      await loadCards();
      if (selectedCard?.id === id) {
        const res = await vipCardsApi.getById(id);
        if (res.data.data) setSelectedCard(res.data.data);
      }
    } catch (err) {
      console.error('Error blocking card:', err);
    }
  };

  const handleUnblock = async (id: string) => {
    try {
      await vipCardsApi.unblock(id);
      await loadCards();
      if (selectedCard?.id === id) {
        const res = await vipCardsApi.getById(id);
        if (res.data.data) setSelectedCard(res.data.data);
      }
    } catch (err) {
      console.error('Error unblocking card:', err);
    }
  };

  const handleSave = async () => {
    await loadCards();
    setShowModal(false);
    setEditingCard(null);
  };

  const formatPrice = (price: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(price);

  if (selectedCard) {
    return (
      <CardDetailView
        card={selectedCard}
        onBack={() => setSelectedCard(null)}
        onBlock={handleBlock}
        onUnblock={handleUnblock}
        onLoad={(id) => { setActionCardId(id); setShowLoadModal(true); }}
        onTransfer={(id) => { setActionCardId(id); setShowTransferModal(true); }}
        onRefresh={async () => {
          const res = await vipCardsApi.getById(selectedCard.id);
          if (res.data.data) setSelectedCard(res.data.data);
          await loadCards();
        }}
        showLoadModal={showLoadModal}
        showTransferModal={showTransferModal}
        actionCardId={actionCardId}
        setShowLoadModal={setShowLoadModal}
        setShowTransferModal={setShowTransferModal}
        cards={cards}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/pos')} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600/20 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="font-semibold">VIP Cards</h1>
              <p className="text-xs text-slate-400">{cards.length} tarjetas</p>
            </div>
          </div>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">
          <Plus className="w-5 h-5" /><span>Nueva Tarjeta</span>
        </button>
      </div>

      <div className="p-4 flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por número o nombre..." className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as VipCardType | '')} className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:outline-none">
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
        ) : filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <CreditCard className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">Sin tarjetas VIP</p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Número</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Tipo</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Saldo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCards.map((card) => (
                  <tr key={card.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm">{card.cardNumber}</td>
                    <td className="px-4 py-3 text-sm">{card.customerName || '-'}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg ${TYPE_COLORS[card.type]}`}>{TYPE_LABELS[card.type]}</span></td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-400">{formatPrice(card.balance)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg ${card.isActive ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'}`}>
                        {card.isActive ? 'Activa' : 'Bloqueada'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleViewDetail(card)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Ver detalle"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => handleEdit(card)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => { setActionCardId(card.id); setShowLoadModal(true); }} className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-colors" title="Cargar saldo"><DollarSign className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <CardModal card={editingCard} onClose={() => { setShowModal(false); setEditingCard(null); }} onSave={handleSave} />}
      {showLoadModal && actionCardId && <LoadBalanceModal cardId={actionCardId} onClose={() => { setShowLoadModal(false); setActionCardId(null); }} onSave={async () => { setShowLoadModal(false); setActionCardId(null); await loadCards(); }} />}
      {showTransferModal && actionCardId && <TransferModal cardId={actionCardId} cards={cards} onClose={() => { setShowTransferModal(false); setActionCardId(null); }} onSave={async () => { setShowTransferModal(false); setActionCardId(null); await loadCards(); }} />}
    </div>
  );
}

function CardDetailView({ card, onBack, onBlock, onUnblock, onLoad, onTransfer, onRefresh, showLoadModal, showTransferModal, actionCardId, setShowLoadModal, setShowTransferModal, cards }: {
  card: VipCard; onBack: () => void; onBlock: (id: string) => void; onUnblock: (id: string) => void; onLoad: (id: string) => void; onTransfer: (id: string) => void; onRefresh: () => void;
  showLoadModal: boolean; showTransferModal: boolean; actionCardId: string | null; setShowLoadModal: (v: boolean) => void; setShowTransferModal: (v: boolean) => void; cards: VipCard[];
}) {
  const formatPrice = (price: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(price);
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="font-semibold">Tarjeta {card.cardNumber}</h1>
            <p className="text-xs text-slate-400">{card.customerName || 'Sin nombre'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onLoad(card.id)} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm transition-colors"><DollarSign className="w-4 h-4" />Cargar</button>
          <button onClick={() => onTransfer(card.id)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors"><ArrowRightLeft className="w-4 h-4" />Transferir</button>
          {card.isActive ? (
            <button onClick={() => onBlock(card.id)} className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm transition-colors"><Ban className="w-4 h-4" />Bloquear</button>
          ) : (
            <button onClick={() => onUnblock(card.id)} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm transition-colors"><Unlock className="w-4 h-4" />Desbloquear</button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <p className="text-sm text-slate-400">Saldo</p>
            <p className="text-2xl font-bold text-emerald-400">{formatPrice(card.balance)}</p>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <p className="text-sm text-slate-400">Tipo</p>
            <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg mt-1 ${TYPE_COLORS[card.type]}`}>{TYPE_LABELS[card.type]}</span>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <p className="text-sm text-slate-400">Estado</p>
            <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg mt-1 ${card.isActive ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'}`}>{card.isActive ? 'Activa' : 'Bloqueada'}</span>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <p className="text-sm text-slate-400">Contacto</p>
            <p className="text-sm mt-1">{card.customerPhone || card.customerEmail || '-'}</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h2 className="font-semibold mb-3">Transacciones Recientes</h2>
          {(!card.transactions || card.transactions.length === 0) ? (
            <p className="text-slate-500 text-sm text-center py-6">Sin transacciones</p>
          ) : (
            <div className="space-y-2">
              {card.transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{tx.type}</p>
                    <p className="text-xs text-slate-400">{formatDate(tx.createdAt)}{tx.notes ? ` - ${tx.notes}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{tx.amount >= 0 ? '+' : ''}{formatPrice(tx.amount)}</p>
                    <p className="text-xs text-slate-400">Saldo: {formatPrice(tx.balanceAfter)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showLoadModal && actionCardId && <LoadBalanceModal cardId={actionCardId} onClose={() => setShowLoadModal(false)} onSave={async () => { setShowLoadModal(false); await onRefresh(); }} />}
      {showTransferModal && actionCardId && <TransferModal cardId={actionCardId} cards={cards} onClose={() => setShowTransferModal(false)} onSave={async () => { setShowTransferModal(false); await onRefresh(); }} />}
    </div>
  );
}

function CardModal({ card, onClose, onSave }: { card: VipCard | null; onClose: () => void; onSave: () => void }) {
  const [formData, setFormData] = useState({
    cardNumber: card?.cardNumber || '',
    type: card?.type || 'CUSTOMER' as VipCardType,
    customerName: card?.customerName || '',
    customerPhone: card?.customerPhone || '',
    customerEmail: card?.customerEmail || '',
    pin: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!card && !formData.cardNumber.trim()) { setError('El número de tarjeta es requerido'); return; }

    setIsLoading(true);
    try {
      if (card) {
        await vipCardsApi.update(card.id, {
          customerName: formData.customerName.trim() || undefined,
          customerPhone: formData.customerPhone.trim() || undefined,
          customerEmail: formData.customerEmail.trim() || undefined,
          pin: formData.pin.trim() || undefined,
        });
      } else {
        await vipCardsApi.create({
          cardNumber: formData.cardNumber.trim(),
          type: formData.type,
          customerName: formData.customerName.trim() || undefined,
          customerPhone: formData.customerPhone.trim() || undefined,
          customerEmail: formData.customerEmail.trim() || undefined,
          pin: formData.pin.trim() || undefined,
        });
      }
      onSave();
    } catch (err: any) {
      setError(err.message || 'Error al guardar tarjeta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">{card ? 'Editar Tarjeta' : 'Nueva Tarjeta VIP'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">{error}</div>}
          {!card && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Número de tarjeta *</label>
              <input type="text" value={formData.cardNumber} onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="VIP-001" />
            </div>
          )}
          {!card && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tipo</label>
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as VipCardType })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none">
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nombre del cliente</label>
            <input type="text" value={formData.customerName} onChange={(e) => setFormData({ ...formData, customerName: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="Nombre completo" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Teléfono</label>
              <input type="tel" value={formData.customerPhone} onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input type="email" value={formData.customerEmail} onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">PIN (4-6 dígitos)</label>
            <input type="password" value={formData.pin} onChange={(e) => setFormData({ ...formData, pin: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="****" maxLength={6} />
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

function LoadBalanceModal({ cardId, onClose, onSave }: { cardId: string; onClose: () => void; onSave: () => void }) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!amount || parseFloat(amount) <= 0) { setError('El monto debe ser mayor a 0'); return; }
    setIsLoading(true);
    try {
      await vipCardsApi.loadBalance(cardId, { amount: parseFloat(amount), notes: notes.trim() || undefined });
      onSave();
    } catch (err: any) {
      setError(err.message || 'Error al cargar saldo');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">Cargar Saldo</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          {error && <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Monto *</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="0" min="1" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Notas</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="Opcional" />
          </div>
        </div>
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={isLoading} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><DollarSign className="w-5 h-5" />Cargar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function TransferModal({ cardId, cards, onClose, onSave }: { cardId: string; cards: VipCard[]; onClose: () => void; onSave: () => void }) {
  const [toCardId, setToCardId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherCards = cards.filter((c) => c.id !== cardId && c.isActive);

  const handleSubmit = async () => {
    setError(null);
    if (!toCardId) { setError('Selecciona una tarjeta destino'); return; }
    if (!amount || parseFloat(amount) <= 0) { setError('El monto debe ser mayor a 0'); return; }
    setIsLoading(true);
    try {
      await vipCardsApi.transfer(cardId, { toCardId, amount: parseFloat(amount), notes: notes.trim() || undefined });
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
      <div className="relative w-full max-w-sm bg-slate-800 rounded-2xl border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold">Transferir Saldo</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          {error && <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-xl text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tarjeta destino *</label>
            <select value={toCardId} onChange={(e) => setToCardId(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none">
              <option value="">Seleccionar tarjeta</option>
              {otherCards.map((c) => (
                <option key={c.id} value={c.id}>{c.cardNumber} - {c.customerName || 'Sin nombre'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Monto *</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="0" min="1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Notas</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-xl text-white focus:border-indigo-500 focus:outline-none" placeholder="Opcional" />
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
