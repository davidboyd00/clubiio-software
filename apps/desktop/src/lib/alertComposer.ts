// ============================================
// ALERT COMPOSER (LLM)
// Solo redacta mensajes - NO calcula ni decide
// Recibe datos del motor determinístico
// ============================================

import { StockState, ReplenishmentRecommendation, SalesVelocity } from './stockEngine';

// ============================================
// Configuration
// ============================================

export interface ComposerConfig {
  ollamaUrl: string;
  model: string;
  enabled: boolean;
  language: 'es' | 'en';
  tone: 'formal' | 'casual' | 'urgent';
}

const CONFIG_KEY = 'clubio_composer_config';

const DEFAULT_CONFIG: ComposerConfig = {
  ollamaUrl: 'http://localhost:11434',
  model: 'llama3.2',
  enabled: true,
  language: 'es',
  tone: 'casual',
};

export function loadComposerConfig(): ComposerConfig {
  const stored = localStorage.getItem(CONFIG_KEY);
  if (stored) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

export function saveComposerConfig(config: ComposerConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// ============================================
// LLM Communication
// ============================================

async function callLLM(prompt: string, systemPrompt: string): Promise<string> {
  const config = loadComposerConfig();

  if (!config.enabled) {
    throw new Error('LLM composer disabled');
  }

  try {
    const response = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        stream: false,
        options: {
          temperature: 0.5, // Lower for more consistent output
          num_predict: 150, // Keep responses short
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content?.trim() || '';
  } catch (error) {
    console.error('LLM call failed:', error);
    throw error;
  }
}

// ============================================
// Message Composition
// ============================================

export interface ComposedAlert {
  shortMessage: string;     // Para notificación push (max 100 chars)
  fullMessage: string;      // Para panel de alertas
  whatsappMessage: string;  // Para WhatsApp/Telegram
  explanation: string;      // Para cuando pregunten "¿por qué?"
}

const SYSTEM_PROMPT = `Eres un asistente de inventario para un bar/discoteca.

REGLAS ESTRICTAS:
1. NUNCA inventes números - usa SOLO los datos que te proporciono
2. NUNCA digas "creo que" o "podría ser" - los datos son exactos
3. Responde en español, máximo 2 oraciones
4. Sé directo y accionable
5. Usa emojis apropiados para severidad (🔴 crítico, 🟡 warning, 🟢 info)

Tu trabajo es REDACTAR mensajes claros, no calcular ni decidir.`;

export async function composeAlertMessage(
  state: StockState,
  recommendation: ReplenishmentRecommendation,
  velocity: SalesVelocity
): Promise<ComposedAlert> {
  // Build data context for LLM
  const dataContext = `
DATOS (exactos, no modificar):
- Producto: ${state.productName}
- Stock actual: ${state.available} unidades
- Severidad: ${state.severity.toUpperCase()}
- Cobertura: ${state.coverageHours !== null ? `${state.coverageHours} horas` : 'N/A'}
- Velocidad actual: ${velocity.ewma.toFixed(1)} uds/hora
- Tendencia: ${velocity.trend === 'rising' ? 'subiendo' : velocity.trend === 'falling' ? 'bajando' : 'estable'}
- Acción recomendada: ${recommendation.action}
- Cantidad a pedir: ${recommendation.suggestedQty} unidades
- Urgencia: ${recommendation.urgency}`;

  try {
    // Compose short message
    const shortPrompt = `${dataContext}

Genera UN mensaje corto (máximo 80 caracteres) para notificación push.`;

    const shortMessage = await callLLM(shortPrompt, SYSTEM_PROMPT);

    // Compose full message
    const fullPrompt = `${dataContext}

Genera un mensaje completo (2-3 oraciones) explicando la situación y qué hacer.`;

    const fullMessage = await callLLM(fullPrompt, SYSTEM_PROMPT);

    // Compose WhatsApp message
    const whatsappPrompt = `${dataContext}

Genera un mensaje para WhatsApp/Telegram con:
1. Emoji de severidad
2. Producto y stock
3. Acción clara
Máximo 3 líneas.`;

    const whatsappMessage = await callLLM(whatsappPrompt, SYSTEM_PROMPT);

    // Compose explanation
    const explanationPrompt = `${dataContext}

Razonamiento del sistema: ${recommendation.reasoning}

Explica brevemente por qué se recomienda pedir ${recommendation.suggestedQty} unidades.
Usa los datos proporcionados, no inventes.`;

    const explanation = await callLLM(explanationPrompt, SYSTEM_PROMPT);

    return {
      shortMessage: shortMessage || fallbackShort(state),
      fullMessage: fullMessage || fallbackFull(state, recommendation),
      whatsappMessage: whatsappMessage || fallbackWhatsApp(state, recommendation),
      explanation: explanation || recommendation.reasoning,
    };
  } catch {
    // Fallback to templates if LLM fails
    return {
      shortMessage: fallbackShort(state),
      fullMessage: fallbackFull(state, recommendation),
      whatsappMessage: fallbackWhatsApp(state, recommendation),
      explanation: recommendation.reasoning,
    };
  }
}

// ============================================
// Fallback Templates (when LLM unavailable)
// ============================================

function fallbackShort(state: StockState): string {
  const icons = { critical: '🔴', warning: '🟡', info: '🟢', ok: '✅' };
  return `${icons[state.severity]} ${state.productName}: ${state.available} uds`;
}

function fallbackFull(state: StockState, rec: ReplenishmentRecommendation): string {
  const actions = {
    order: 'Solicitar reposición',
    transfer: 'Transferir de otra barra',
    substitute: 'Usar producto sustituto',
    limit_promo: 'Limitar promociones',
  };

  if (state.severity === 'critical') {
    return `URGENTE: ${state.productName} con solo ${state.available} unidades. ${actions[rec.action]} de ${rec.suggestedQty} uds inmediatamente.`;
  }

  if (state.severity === 'warning') {
    return `${state.productName} en nivel bajo (${state.available} uds). ${actions[rec.action]} de ${rec.suggestedQty} uds antes del próximo turno.`;
  }

  return `${state.productName} con tendencia a bajar (${state.available} uds). Planificar pedido de ${rec.suggestedQty} uds.`;
}

function fallbackWhatsApp(state: StockState, rec: ReplenishmentRecommendation): string {
  const icons = { critical: '🔴', warning: '🟡', info: '🟢', ok: '✅' };
  const urgency = { immediate: '⚡ URGENTE', today: '📦 HOY', planned: '📋 Planificado' };

  return `${icons[state.severity]} *${state.productName}*
Stock: ${state.available} uds
${urgency[rec.urgency]}: Pedir ${rec.suggestedQty} uds`;
}

// ============================================
// Batch Digest Composition
// ============================================

export async function composeDigest(
  alerts: Array<{ state: StockState; recommendation: ReplenishmentRecommendation }>
): Promise<string> {
  if (alerts.length === 0) return '';

  const critical = alerts.filter(a => a.state.severity === 'critical');
  const warning = alerts.filter(a => a.state.severity === 'warning');
  const info = alerts.filter(a => a.state.severity === 'info');

  const summary = `
RESUMEN DE STOCK - ${new Date().toLocaleString('es-CL')}

${critical.length > 0 ? `🔴 CRÍTICOS (${critical.length}):
${critical.map(a => `  • ${a.state.productName}: ${a.state.available} uds → Pedir ${a.recommendation.suggestedQty}`).join('\n')}` : ''}

${warning.length > 0 ? `🟡 ADVERTENCIAS (${warning.length}):
${warning.map(a => `  • ${a.state.productName}: ${a.state.available} uds`).join('\n')}` : ''}

${info.length > 0 ? `🟢 INFO (${info.length}):
${info.map(a => `  • ${a.state.productName}: tendencia ${a.state.coverageHours}h`).join('\n')}` : ''}`;

  try {
    const prompt = `Datos del resumen:
${summary}

Genera un mensaje breve de resumen para el equipo de turno.
Prioriza los críticos, menciona cuántos warnings hay.
Máximo 5 líneas.`;

    return await callLLM(prompt, SYSTEM_PROMPT);
  } catch {
    return summary;
  }
}

// ============================================
// Explain Decision (for when staff asks "why?")
// ============================================

export async function explainDecision(
  question: string,
  state: StockState,
  recommendation: ReplenishmentRecommendation,
  velocity: SalesVelocity
): Promise<string> {
  const context = `
DATOS DEL SISTEMA:
- Producto: ${state.productName}
- Stock: ${state.available} uds
- Velocidad: ${velocity.ewma.toFixed(1)} uds/hora (${velocity.trend})
- Cobertura: ${state.coverageHours || 'N/A'} horas
- Recomendación: ${recommendation.suggestedQty} uds
- Razonamiento: ${recommendation.reasoning}

PREGUNTA DEL USUARIO: ${question}`;

  const systemPrompt = `Eres un asistente que explica decisiones de inventario.
SOLO usa los datos proporcionados para responder.
Si no tienes datos para responder, di "No tengo esa información".
Responde en español, máximo 3 oraciones.`;

  try {
    return await callLLM(context, systemPrompt);
  } catch {
    return `Basado en los datos: ${recommendation.reasoning}`;
  }
}
