import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Loader2, Wifi, WifiOff } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithPin, isLoading, error, isAuthenticated, restoreSession, setError } = useAuth();
  const { isOnline } = useOnlineStatus();

  const [mode, setMode] = useState<'email' | 'pin'>('pin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [isRestoring, setIsRestoring] = useState(true);
  const [hasTriedRestore, setHasTriedRestore] = useState(false);

  // Try to restore session on mount (only once)
  useEffect(() => {
    if (hasTriedRestore) return;

    const tryRestore = async () => {
      setHasTriedRestore(true);
      try {
        const restored = await restoreSession();
        if (restored) {
          navigate('/pos');
        }
      } catch (error) {
        console.error('Session restore failed:', error);
      } finally {
        setIsRestoring(false);
      }
    };
    tryRestore();
  }, [hasTriedRestore, restoreSession, navigate]);

  // Navigate when authenticated
  useEffect(() => {
    if (isAuthenticated && !isRestoring) {
      navigate('/pos');
    }
  }, [isAuthenticated, isRestoring, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setError('Sin conexión. No se puede iniciar sesión.');
      return;
    }
    const success = await login(email, password);
    if (success) {
      navigate('/pos');
    }
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        if (!isOnline) {
          setError('Sin conexión. No se puede iniciar sesión.');
          setPin('');
          return;
        }
        setTimeout(async () => {
          const success = await loginWithPin(newPin);
          if (success) {
            navigate('/pos');
          } else {
            setPin('');
          }
        }, 100);
      }
    }
  };

  const handlePinDelete = () => {
    setPin(pin.slice(0, -1));
  };

  if (isRestoring) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-400">Restaurando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/25">
            <span className="text-white text-3xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Clubio TPV</h1>
          <p className="text-slate-400 mt-1">Sistema de Punto de Venta</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-slate-800 rounded-lg p-1 mb-6">
          <button
            onClick={() => setMode('pin')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'pin'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            PIN Rápido
          </button>
          <button
            onClick={() => setMode('email')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'email'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Email
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {mode === 'pin' ? (
          /* PIN Login */
          <div className="space-y-6">
            {/* PIN Display */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl transition-all ${
                    pin.length > i
                      ? 'border-indigo-500 bg-indigo-500/20'
                      : 'border-slate-600 bg-slate-800'
                  }`}
                >
                  {pin.length > i && (
                    <div className="w-3 h-3 bg-indigo-400 rounded-full" />
                  )}
                </div>
              ))}
            </div>

            {/* PIN Keypad */}
            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(
                (key) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === 'del') handlePinDelete();
                      else if (key) handlePinInput(key);
                    }}
                    disabled={!key || isLoading}
                    className={`h-16 rounded-xl text-xl font-semibold transition-all ${
                      !key
                        ? 'invisible'
                        : key === 'del'
                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-white active:scale-95'
                    } disabled:opacity-50`}
                  >
                    {key === 'del' ? '←' : key}
                  </button>
                )
              )}
            </div>
          </div>
        ) : (
          /* Email Login */
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                placeholder="tu@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !isOnline}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>
        )}

        {/* Server Status */}
        <div className="mt-8 flex items-center justify-center gap-2">
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400">Conectado</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-400">Sin conexión</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
