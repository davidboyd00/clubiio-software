import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Bot,
  User,
  Loader2,
  Settings,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Sparkles,
} from 'lucide-react';
import {
  AIMessage,
  loadAIConfig,
  saveAIConfig,
  AIAgentConfig,
  checkOllamaConnection,
  getAvailableModels,
  generateAIResponse,
} from '../../lib/aiAgent';

interface ChatMessage extends AIMessage {
  id: string;
  timestamp: Date;
  isLoading?: boolean;
  error?: string;
}

const SYSTEM_PROMPT = `Eres un asistente inteligente para Clubio, un sistema POS para bares y discotecas.
Tu rol es ayudar a los usuarios con:
- Consultas sobre ventas, productos e inventario
- Recomendaciones de stock basadas en patrones de venta
- Ayuda con funciones del sistema
- Análisis de tendencias y reportes

Responde siempre en español, de forma concisa y práctica.
Si no tienes datos específicos, ofrece orientación general.
Usa emojis moderadamente para hacer la conversación más amigable.`;

const QUICK_ACTIONS = [
  { label: '📊 Resumen de ventas', prompt: '¿Cuál es el resumen de ventas del día?' },
  { label: '📦 Estado del stock', prompt: '¿Cómo está el inventario? ¿Hay productos bajos?' },
  { label: '🔥 Productos más vendidos', prompt: '¿Cuáles son los productos más vendidos?' },
  { label: '💡 Sugerencias', prompt: 'Dame sugerencias para mejorar las ventas de hoy' },
];

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<AIAgentConfig>(loadAIConfig);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input after loading
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const checkConnection = async () => {
    setIsConnected(null);
    const connected = await checkOllamaConnection();
    setIsConnected(connected);

    if (connected) {
      const models = await getAvailableModels();
      setAvailableModels(models);
    }
  };

  const handleSend = useCallback(async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history
      const history: AIMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.filter(m => !m.isLoading && !m.error).map(m => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: messageText },
      ];

      const response = await generateAIResponse(history, {
        temperature: 0.7,
        maxTokens: 500,
      });

      setMessages(prev => prev.map(m =>
        m.id === assistantMessage.id
          ? { ...m, content: response, isLoading: false }
          : m
      ));
    } catch (error) {
      setMessages(prev => prev.map(m =>
        m.id === assistantMessage.id
          ? {
              ...m,
              isLoading: false,
              error: error instanceof Error ? error.message : 'Error de conexión',
              content: 'No pude procesar tu mensaje. Verifica que Ollama esté ejecutándose.',
            }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveConfig = () => {
    saveAIConfig(config);
    setShowSettings(false);
    checkConnection();
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold">Asistente Clubio</h2>
            <div className="flex items-center gap-2 text-xs text-white/80">
              {isConnected === null ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Conectando...</>
              ) : isConnected ? (
                <><CheckCircle className="w-3 h-3" /> {config.model}</>
              ) : (
                <><AlertCircle className="w-3 h-3" /> Sin conexión</>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={checkConnection}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Reconectar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Configuración"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3">Configuración de IA</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL de Ollama
              </label>
              <input
                type="text"
                value={config.ollamaUrl}
                onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modelo
              </label>
              {availableModels.length > 0 ? (
                <select
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                >
                  {availableModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                  placeholder="llama3.2"
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="aiEnabled"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="aiEnabled" className="text-sm text-gray-700">
                Habilitar IA
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              >
                Guardar
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
            <Bot className="w-16 h-16 mb-4 text-purple-300" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              ¡Hola! Soy tu asistente
            </h3>
            <p className="text-sm mb-6 max-w-sm">
              Puedo ayudarte con consultas de ventas, inventario, reportes y más.
              {!isConnected && ' Verifica que Ollama esté ejecutándose.'}
            </p>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(action.prompt)}
                  disabled={!isConnected || isLoading}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-purple-100 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-purple-100 text-purple-600'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.error
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {message.isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Pensando...</span>
                    </div>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </div>
                  )}
                  <div
                    className={`text-xs mt-1 ${
                      message.role === 'user'
                        ? 'text-blue-200'
                        : 'text-gray-400'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString('es-CL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Quick Actions Bar (when messages exist) */}
      {messages.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 flex gap-2 overflow-x-auto">
          {QUICK_ACTIONS.map((action, i) => (
            <button
              key={i}
              onClick={() => handleSend(action.prompt)}
              disabled={!isConnected || isLoading}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-purple-100 text-gray-600 rounded-full whitespace-nowrap disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
          <button
            onClick={clearChat}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-full whitespace-nowrap ml-auto"
          >
            Limpiar chat
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              isConnected
                ? 'Escribe tu mensaje...'
                : 'Conectando con Ollama...'
            }
            disabled={!isConnected || isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || !isConnected || isLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        {!isConnected && isConnected !== null && (
          <p className="mt-2 text-xs text-red-500">
            No hay conexión con Ollama. Asegúrate de que esté ejecutándose en {config.ollamaUrl}
          </p>
        )}
      </div>
    </div>
  );
}

export default AIChat;
