// AI Agent for Stock Management using Ollama (local LLM)

import { StockAlert, StockStatus, calculateRestockQuantity } from './stockMonitor';

export interface AIAgentConfig {
  ollamaUrl: string;
  model: string;
  enabled: boolean;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StockAnalysis {
  alert: StockAlert;
  suggestion: string;
  urgency: 'immediate' | 'soon' | 'planned';
  estimatedDaysUntilOut?: number;
  recommendedQuantity: number;
}

const AI_CONFIG_KEY = 'clubio_ai_agent_config';

const DEFAULT_CONFIG: AIAgentConfig = {
  ollamaUrl: 'http://localhost:11434',
  model: 'llama3.2', // Default model, user can change
  enabled: true,
};

// Load AI config
export function loadAIConfig(): AIAgentConfig {
  const stored = localStorage.getItem(AI_CONFIG_KEY);
  if (stored) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

// Save AI config
export function saveAIConfig(config: AIAgentConfig): void {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}

// Check if Ollama is available
export async function checkOllamaConnection(): Promise<boolean> {
  const config = loadAIConfig();

  try {
    const response = await fetch(`${config.ollamaUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Get available models from Ollama
export async function getAvailableModels(): Promise<string[]> {
  const config = loadAIConfig();

  try {
    const response = await fetch(`${config.ollamaUrl}/api/tags`);
    if (!response.ok) return [];

    const data = await response.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

// Generate AI response using Ollama
export async function generateAIResponse(
  messages: AIMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const config = loadAIConfig();

  if (!config.enabled) {
    throw new Error('AI Agent está deshabilitado');
  }

  try {
    const response = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 200,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  } catch (error) {
    console.error('AI Agent error:', error);
    throw error;
  }
}

// Generate stock alert suggestion
export async function generateStockSuggestion(
  stockStatus: StockStatus,
  salesHistory?: { dailyAvg: number; peakDay: string; peakAmount: number }
): Promise<string> {
  const { product, status, percentRemaining } = stockStatus;
  const currentStock = product.stock || 0;
  const minStock = product.minStock || 1;
  const recommendedQty = calculateRestockQuantity(
    currentStock,
    minStock,
    salesHistory?.dailyAvg || 0
  );

  const systemPrompt = `Eres un asistente de gestión de inventario para un bar/club nocturno.
Tu trabajo es dar sugerencias breves y accionables sobre reposición de stock.
Responde en español, de forma concisa (máximo 2-3 oraciones).
Incluye la cantidad recomendada a pedir.`;

  const userPrompt = `
Producto: ${product.name}
Stock actual: ${currentStock} unidades
Stock mínimo configurado: ${minStock} unidades
Porcentaje restante: ${percentRemaining.toFixed(0)}%
Estado: ${status === 'out' ? 'SIN STOCK' : status === 'critical' ? 'CRÍTICO' : 'BAJO'}
${salesHistory ? `Ventas promedio diarias: ${salesHistory.dailyAvg} unidades` : ''}
${salesHistory?.peakDay ? `Día de mayor venta: ${salesHistory.peakDay} (${salesHistory.peakAmount} unidades)` : ''}
Cantidad recomendada a reponer: ${recommendedQty} unidades

Dame una sugerencia breve para el encargado de barra.`;

  try {
    const suggestion = await generateAIResponse([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return suggestion.trim();
  } catch (error) {
    // Fallback to template-based suggestion if AI fails
    return generateFallbackSuggestion(stockStatus, recommendedQty);
  }
}

// Fallback suggestion without AI
function generateFallbackSuggestion(
  stockStatus: StockStatus,
  recommendedQty: number
): string {
  const { product, status } = stockStatus;
  const currentStock = product.stock || 0;

  if (status === 'out') {
    return `URGENTE: ${product.name} está agotado. Solicitar reposición inmediata de ${recommendedQty} unidades.`;
  }

  if (status === 'critical') {
    return `${product.name} en nivel crítico (${currentStock} unidades). Reponer ${recommendedQty} unidades antes del próximo turno.`;
  }

  return `${product.name} con stock bajo (${currentStock} unidades). Programar pedido de ${recommendedQty} unidades.`;
}

// Analyze multiple stock issues and prioritize
export async function analyzeStockIssues(
  issues: StockStatus[]
): Promise<StockAnalysis[]> {
  const analyses: StockAnalysis[] = [];

  for (const issue of issues) {
    const { product, status } = issue;
    const currentStock = product.stock || 0;
    const minStock = product.minStock || 1;

    let urgency: StockAnalysis['urgency'] = 'planned';
    if (status === 'out') urgency = 'immediate';
    else if (status === 'critical') urgency = 'soon';

    const suggestion = await generateStockSuggestion(issue);
    const recommendedQuantity = calculateRestockQuantity(currentStock, minStock);

    analyses.push({
      alert: {
        id: `analysis-${product.id}`,
        productId: product.id,
        productName: product.name,
        currentStock,
        minStock,
        severity: status === 'out' ? 'out' : status === 'critical' ? 'critical' : 'low',
        createdAt: new Date().toISOString(),
        acknowledged: false,
        aiSuggestion: suggestion,
      },
      suggestion,
      urgency,
      recommendedQuantity,
    });
  }

  // Sort by urgency
  return analyses.sort((a, b) => {
    const urgencyOrder = { immediate: 0, soon: 1, planned: 2 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });
}

// Generate batch alert message for external notification
export async function generateBatchAlertMessage(
  analyses: StockAnalysis[]
): Promise<string> {
  if (analyses.length === 0) return '';

  const immediateCount = analyses.filter((a) => a.urgency === 'immediate').length;
  const soonCount = analyses.filter((a) => a.urgency === 'soon').length;

  const systemPrompt = `Eres un asistente de bar que envía alertas de stock al equipo.
Genera un mensaje breve y claro para WhatsApp/Telegram.
Usa emojis apropiados. Máximo 5 líneas.`;

  const issuesList = analyses
    .slice(0, 5)
    .map((a) => `- ${a.alert.productName}: ${a.alert.currentStock}/${a.alert.minStock} (${a.urgency === 'immediate' ? 'URGENTE' : a.urgency === 'soon' ? 'Pronto' : 'Planificar'})`)
    .join('\n');

  const userPrompt = `
Hay ${analyses.length} productos con problemas de stock:
${immediateCount > 0 ? `- ${immediateCount} sin stock (urgente)` : ''}
${soonCount > 0 ? `- ${soonCount} en nivel crítico` : ''}
${analyses.length - immediateCount - soonCount > 0 ? `- ${analyses.length - immediateCount - soonCount} con stock bajo` : ''}

Productos prioritarios:
${issuesList}

Genera el mensaje de alerta.`;

  try {
    return await generateAIResponse([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  } catch {
    // Fallback message
    let msg = `🚨 *ALERTA DE STOCK*\n\n`;

    if (immediateCount > 0) {
      msg += `❌ ${immediateCount} producto(s) SIN STOCK\n`;
    }
    if (soonCount > 0) {
      msg += `⚠️ ${soonCount} producto(s) en nivel crítico\n`;
    }

    msg += `\n📦 Productos:\n`;
    analyses.slice(0, 5).forEach((a) => {
      const icon = a.urgency === 'immediate' ? '🔴' : a.urgency === 'soon' ? '🟡' : '🟢';
      msg += `${icon} ${a.alert.productName}: ${a.alert.currentStock} uds\n`;
    });

    if (analyses.length > 5) {
      msg += `\n...y ${analyses.length - 5} más`;
    }

    return msg;
  }
}
