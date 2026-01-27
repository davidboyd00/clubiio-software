import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  Settings,
  User,
  ChevronDown,
  Search,
} from 'lucide-react';

// Hooks
import { useAuth } from '../hooks/useAuth';
import { useProducts } from '../hooks/useProducts';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useSync } from '../hooks/useSync';
import { useCart } from '../hooks/useCart';
import { useKeyboardShortcuts, useGlobalShortcuts } from '../hooks/useKeyboardShortcuts';

// Components
import { CategoryTabs, ProductGrid, Cart, PaymentModal } from '../components/pos';
import { Customer } from '../components/pos/CustomerSelector';

// API
import {
  ordersApi,
  cashSessionsApi,
  cashRegistersApi,
  CashRegister,
  CashSession,
} from '../lib/api';
import { localDb } from '../lib/db';
import { v4 as uuid } from 'uuid';

// Stock monitoring
import { onSaleEvent, startStockMonitor, isMonitorRunning } from '../services/stockMonitorService';
import { recordBarSale, getBarIdForCashRegister } from '../lib/barInventory';

export function POSPage() {
  const navigate = useNavigate();

  // Auth & user state
  const {
    user,
    logout,
    venueId,
    cashSessionId,
    setCashSession,
  } = useAuth();

  // Products & categories
  const {
    products,
    categories,
    isLoading: productsLoading,
    selectedCategory,
    setSelectedCategory,
    refreshProducts,
  } = useProducts();

  // Online & sync state
  const { isOnline } = useOnlineStatus();
  const { pendingCount, sync, status: syncStatus } = useSync();

  // Cart
  const cart = useCart();

  // Local state
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCashRegisterModal, setShowCashRegisterModal] = useState(false);
  const [showOpenSessionModal, setShowOpenSessionModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [selectedCashRegister, setSelectedCashRegister] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcuts
  useGlobalShortcuts();

  // POS-specific keyboard shortcuts
  useKeyboardShortcuts({
    onSearch: () => {
      setShowSearch(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    },
    onCheckout: () => {
      if (!cart.isEmpty) {
        handleCheckout(null);
      }
    },
    onClearCart: () => {
      if (!cart.isEmpty) {
        cart.clear();
      }
    },
    onDiscount: () => {
      // Discount modal is handled by Cart component
    },
  });

  // Load cash registers
  useEffect(() => {
    const loadCashRegisters = async () => {
      if (!isOnline || !venueId) return;
      try {
        const response = await cashRegistersApi.getAll(venueId);
        if (response.data.success && response.data.data) {
          setCashRegisters(response.data.data.filter((cr) => cr.isActive));
        }
      } catch (error) {
        console.error('Failed to load cash registers:', error);
      }
    };
    loadCashRegisters();
  }, [isOnline, venueId]);

  // Check for active session
  useEffect(() => {
    const checkActiveSession = async () => {
      if (!isOnline) return;
      try {
        const response = await cashSessionsApi.getMySession();
        if (response.data.success && response.data.data) {
          setCurrentSession(response.data.data);
        }
      } catch (error) {
        console.error('Failed to check active session:', error);
      }
    };
    checkActiveSession();
  }, [isOnline]);

  // Auto-select first category
  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory, setSelectedCategory]);

  // Start stock monitor when session is active
  useEffect(() => {
    if ((currentSession || cashSessionId) && products.length > 0) {
      if (!isMonitorRunning()) {
        startStockMonitor(() => products, {
          checkIntervalMinutes: 15,
          digestIntervalMinutes: 60,
        });
      }
    }

    // Cleanup on unmount
    return () => {
      // Don't stop on unmount - let it run in background
    };
  }, [currentSession, cashSessionId, products]);

  // Open cash session
  const handleOpenSession = async () => {
    if (!selectedCashRegister || !openingAmount) return;
    setIsProcessing(true);
    try {
      const response = await cashSessionsApi.open({
        cashRegisterId: selectedCashRegister,
        openingAmount: parseFloat(openingAmount),
      });
      if (response.data.success && response.data.data) {
        setCurrentSession(response.data.data);
        await setCashSession(response.data.data.id, selectedCashRegister);
        setShowOpenSessionModal(false);
        setShowCashRegisterModal(false);
        setOpeningAmount('');
      }
    } catch (error) {
      console.error('Failed to open session:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Process payment
  const handlePayment = useCallback(
    async (payments: Array<{ method: 'CASH' | 'CARD' | 'VOUCHER'; amount: number }>) => {
      if (cart.isEmpty) return false;

      const sessionId = currentSession?.id || cashSessionId;

      // Check if we have an active session
      if (!sessionId && isOnline) {
        setShowCashRegisterModal(true);
        return false;
      }

      setIsProcessing(true);

      try {
        if (isOnline && sessionId) {
          // Online mode - send to server
          const response = await ordersApi.create({
            cashSessionId: sessionId,
            items: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.price,
            })),
            payments,
            discount: cart.discountAmount,
          });

          if (response.data.success) {
            // Track sales for stock monitoring (per bar)
            const cashRegisterId = currentSession?.cashRegisterId || selectedCashRegister;
            const barId = cashRegisterId ? getBarIdForCashRegister(cashRegisterId) : null;

            cart.items.forEach((item) => {
              // Record sale in bar inventory
              if (barId) {
                const result = recordBarSale(barId, item.productId, item.quantity, response.data.data?.id);
                if (result.warning) {
                  console.warn(`[Stock] ${item.productId}: ${result.warning}`);
                }
              }
              // Track for velocity calculations
              onSaleEvent(item.productId, item.quantity, barId || undefined);
            });
            return true;
          } else {
            throw new Error(response.data.error);
          }
        } else {
          // Offline mode - save locally
          const orderNumber = await localDb.getNextOrderNumber();
          await localDb.saveLocalOrder({
            id: uuid(),
            cashSessionId: sessionId,
            orderNumber,
            status: 'COMPLETED',
            subtotal: cart.subtotal,
            discount: cart.discountAmount,
            total: cart.total,
            items: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.price,
              total: item.price * item.quantity,
            })),
            payments,
          });

          // Track sales for stock monitoring (even offline, per bar)
          const cashRegisterId = currentSession?.cashRegisterId || selectedCashRegister;
          const barId = cashRegisterId ? getBarIdForCashRegister(cashRegisterId) : null;

          cart.items.forEach((item) => {
            // Record sale in bar inventory
            if (barId) {
              const result = recordBarSale(barId, item.productId, item.quantity);
              if (result.warning) {
                console.warn(`[Stock] ${item.productId}: ${result.warning}`);
              }
            }
            // Track for velocity calculations
            onSaleEvent(item.productId, item.quantity, barId || undefined);
          });

          return true;
        }
      } catch (error) {
        console.error('Payment failed:', error);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [cart, currentSession, cashSessionId, isOnline]
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCheckout = (customer: Customer | null) => {
    if (cart.isEmpty) return;

    // Store customer for payment
    setSelectedCustomer(customer);

    // Check if we need a cash session
    if (!currentSession && !cashSessionId && isOnline) {
      setShowCashRegisterModal(true);
      return;
    }

    setShowPaymentModal(true);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Top Bar */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 flex-shrink-0">
        {/* Left - Status */}
        <div className="flex items-center gap-4">
          {/* Online Status */}
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-yellow-400">Offline</span>
              </>
            )}
          </div>

          {/* Pending Sync */}
          {pendingCount > 0 && (
            <button
              onClick={sync}
              disabled={!isOnline || syncStatus === 'syncing'}
              className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600/20 text-yellow-400 rounded-lg text-sm hover:bg-yellow-600/30 disabled:opacity-50 transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}
              />
              {pendingCount} pendientes
            </button>
          )}

          {/* Refresh Products */}
          <button
            onClick={refreshProducts}
            disabled={!isOnline}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
            title="Actualizar productos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Center - Cash Register Info */}
        <div className="flex items-center gap-2">
          {currentSession ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg">
              <span className="text-sm font-medium">
                Caja: {currentSession.cashRegister?.name || 'Activa'}
              </span>
            </div>
          ) : (
            <button
              onClick={() => setShowCashRegisterModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
            >
              <Settings className="w-4 h-4" />
              Seleccionar caja
            </button>
          )}
        </div>

        {/* Right - User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">
              {user?.firstName} {user?.lastName?.[0]}.
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-3 border-b border-slate-700">
                  <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                  <p className="text-sm text-slate-400">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full p-3 flex items-center gap-2 text-red-400 hover:bg-slate-700 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Products */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Categories */}
          <div className="mb-4">
            <CategoryTabs
              categories={categories}
              selectedId={selectedCategory}
              onSelect={setSelectedCategory}
              isLoading={productsLoading}
            />
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto">
            <ProductGrid
              products={products}
              categories={categories}
              selectedCategoryId={selectedCategory}
              onAddProduct={cart.addItem}
              isLoading={productsLoading}
            />
          </div>
        </div>

        {/* Right Panel - Cart */}
        <div className="w-[380px] bg-slate-800 border-l border-slate-700 flex-shrink-0">
          <Cart
            onCheckout={handleCheckout}
            onClear={cart.clear}
            disabled={isProcessing}
          />
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedCustomer(null);
        }}
        onConfirm={handlePayment}
        total={cart.total}
        items={cart.items}
        customer={selectedCustomer}
      />

      {/* Cash Register Selection Modal */}
      {showCashRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowCashRegisterModal(false)}
          />
          <div className="relative bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-bold mb-4">Seleccionar Caja</h2>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {cashRegisters.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  No hay cajas disponibles
                </p>
              ) : (
                cashRegisters.map((cr) => (
                  <button
                    key={cr.id}
                    onClick={() => {
                      setSelectedCashRegister(cr.id);
                      setShowOpenSessionModal(true);
                    }}
                    className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-xl text-left transition-colors"
                  >
                    <p className="font-medium">{cr.name}</p>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setShowCashRegisterModal(false)}
              className="w-full py-3 text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Open Session Modal */}
      {showOpenSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowOpenSessionModal(false)}
          />
          <div className="relative bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-bold mb-4">Abrir Caja</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Monto Inicial
              </label>
              <input
                type="number"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white text-xl font-bold text-center focus:border-indigo-500 focus:outline-none"
                placeholder="0"
                min="0"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowOpenSessionModal(false);
                  setOpeningAmount('');
                }}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleOpenSession}
                disabled={isProcessing || !openingAmount}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors disabled:opacity-50 font-semibold"
              >
                {isProcessing ? 'Abriendo...' : 'Abrir Caja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Search Overlay */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
          />
          <div className="relative w-full max-w-2xl bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-slate-700">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-lg text-white focus:outline-none"
                placeholder="Buscar producto..."
                autoFocus
              />
              <kbd className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-400">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {searchQuery && products
                .filter((p) =>
                  p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  p.shortName?.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .slice(0, 10)
                .map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      cart.addItem(product);
                      setShowSearch(false);
                      setSearchQuery('');
                    }}
                    className="w-full p-4 flex items-center gap-4 hover:bg-slate-700 transition-colors text-left"
                  >
                    <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">{product.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-slate-400">
                        {new Intl.NumberFormat('es-CL', {
                          style: 'currency',
                          currency: 'CLP',
                          minimumFractionDigits: 0,
                        }).format(product.price)}
                      </p>
                    </div>
                    {product.stock !== undefined && product.stock !== null && (
                      <span className={`text-sm ${product.stock <= 5 ? 'text-amber-400' : 'text-slate-400'}`}>
                        Stock: {product.stock}
                      </span>
                    )}
                  </button>
                ))}
              {searchQuery && products.filter((p) =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.shortName?.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  No se encontraron productos
                </div>
              )}
              {!searchQuery && (
                <div className="p-8 text-center text-slate-400">
                  Escribe para buscar productos...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
