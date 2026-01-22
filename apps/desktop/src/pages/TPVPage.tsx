import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  LogOut,
  ShoppingCart,
  CreditCard,
  Trash2,
  Plus,
  Minus,
  DollarSign,
} from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

// Demo categories and products
const categories = [
  { id: '1', name: 'Cervezas', color: '#f59e0b' },
  { id: '2', name: 'Tragos', color: '#8b5cf6' },
  { id: '3', name: 'Vinos', color: '#dc2626' },
  { id: '4', name: 'Sin Alcohol', color: '#22c55e' },
  { id: '5', name: 'Snacks', color: '#f97316' },
];

const products: Record<string, { id: string; name: string; price: number }[]> = {
  '1': [
    { id: 'p1', name: 'Corona', price: 3500 },
    { id: 'p2', name: 'Heineken', price: 4000 },
    { id: 'p3', name: 'Kunstmann', price: 4500 },
    { id: 'p4', name: 'Stella Artois', price: 4000 },
  ],
  '2': [
    { id: 'p5', name: 'Pisco Sour', price: 5500 },
    { id: 'p6', name: 'Mojito', price: 6000 },
    { id: 'p7', name: 'Gin Tonic', price: 6500 },
    { id: 'p8', name: 'Margarita', price: 6000 },
  ],
  '3': [
    { id: 'p9', name: 'Copa Tinto', price: 4500 },
    { id: 'p10', name: 'Copa Blanco', price: 4500 },
    { id: 'p11', name: 'Botella Casa', price: 18000 },
  ],
  '4': [
    { id: 'p12', name: 'Coca-Cola', price: 2000 },
    { id: 'p13', name: 'Agua Mineral', price: 1500 },
    { id: 'p14', name: 'Red Bull', price: 4000 },
  ],
  '5': [
    { id: 'p15', name: 'Papas Fritas', price: 3500 },
    { id: 'p16', name: 'Nachos', price: 5000 },
  ],
};

export function TPVPage() {
  const { user, logout } = useAuthStore();
  const [selectedCategory, setSelectedCategory] = useState('1');
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (product: { id: string; name: string; price: number }) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="h-full flex">
      {/* Left Panel - Products */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Categories */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`tpv-btn-category px-6 py-3 whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                  : ''
              }`}
              style={{ backgroundColor: cat.color }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-4 gap-3">
            {products[selectedCategory]?.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="tpv-btn-product h-24"
              >
                <span className="text-white font-medium">{product.name}</span>
                <span className="text-indigo-400 text-lg font-bold mt-1">
                  {formatPrice(product.price)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Cart */}
      <div className="w-96 bg-slate-800 flex flex-col border-l border-slate-700">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold">Orden Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">
              {user?.firstName} {user?.lastName}
            </span>
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center text-slate-500 py-8">
              <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Carrito vacío</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="bg-slate-700 rounded-lg p-3 flex items-center gap-3 animate-slide-in"
              >
                <div className="flex-1">
                  <p className="font-medium text-white">{item.name}</p>
                  <p className="text-sm text-indigo-400">
                    {formatPrice(item.price)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="w-8 h-8 rounded-lg bg-slate-600 hover:bg-slate-500 flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-semibold">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="w-8 h-8 rounded-lg bg-slate-600 hover:bg-slate-500 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="w-8 h-8 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white flex items-center justify-center transition-colors ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer - Total & Actions */}
        <div className="p-4 border-t border-slate-700 space-y-3">
          {/* Total */}
          <div className="flex items-center justify-between text-xl font-bold">
            <span>Total</span>
            <span className="text-indigo-400">{formatPrice(total)}</span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="tpv-btn-danger py-3 disabled:opacity-50"
            >
              <Trash2 className="w-5 h-5 mb-1" />
              Cancelar
            </button>
            <button
              disabled={cart.length === 0}
              className="tpv-btn-success py-3 disabled:opacity-50"
            >
              <DollarSign className="w-5 h-5 mb-1" />
              Efectivo
            </button>
          </div>
          <button
            disabled={cart.length === 0}
            className="w-full tpv-btn-action py-4 disabled:opacity-50"
          >
            <CreditCard className="w-5 h-5 mb-1" />
            Pagar con Tarjeta
          </button>
        </div>
      </div>
    </div>
  );
}
