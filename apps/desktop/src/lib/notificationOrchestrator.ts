// ============================================
// NOTIFICATION ORCHESTRATOR
// Maneja: deduplicación, cooldowns, routing por rol, ventanas horarias
// ============================================

import { StockState, ReplenishmentRecommendation, calculateVelocity } from './stockEngine';
import { composeAlertMessage, composeDigest, ComposedAlert } from './alertComposer';
import { sendTelegramMessage, sendWhatsAppMessage, sendAlertToAllChannels } from './messaging';
import { notifyStockAlert } from '../stores/notificationStore';

// ============================================
// Types
// ============================================

export type StaffRole = 'bartender' | 'bodega' | 'gerente' | 'all';

export interface NotificationRoute {
  role: StaffRole;
  telegramChatId?: string;
  whatsappNumber?: string;
  severities: Array<'info' | 'warning' | 'critical'>;
  barIds?: string[]; // Para bartenders: solo alertas de su barra
}

export interface NotificationState {
  productId: string;
  lastNotifiedAt: string;
  lastSeverity: string;
  cooldownUntil: string;
  notificationCount: number;
  acknowledged: boolean;
}

export interface OrchestratorConfig {
  enabled: boolean;

  // Cooldowns (en minutos)
  cooldownInfo: number;      // Cooldown para alertas info
  cooldownWarning: number;   // Cooldown para warnings
  cooldownCritical: number;  // Cooldown para críticos

  // Ventanas horarias
  quietHoursStart: number;   // Hora de inicio de silencio (ej: 4 = 4am)
  quietHoursEnd: number;     // Hora de fin de silencio (ej: 10 = 10am)
  ignoreQuietForCritical: boolean;

  // Digest
  digestEnabled: boolean;
  digestIntervalMinutes: number;

  // Escalamiento
  escalateAfterMinutes: number;  // Escalar si no hay ACK en X minutos
  escalateTo: StaffRole;

  // Rutas por rol
  routes: NotificationRoute[];
}

// ============================================
// Storage
// ============================================

const CONFIG_KEY = 'clubio_notif_orchestrator_config';
const STATE_KEY = 'clubio_notif_states';
const DIGEST_KEY = 'clubio_last_digest';

const DEFAULT_CONFIG: OrchestratorConfig = {
  enabled: true,
  cooldownInfo: 120,      // 2 horas
  cooldownWarning: 60,    // 1 hora
  cooldownCritical: 15,   // 15 minutos

  quietHoursStart: 4,     // 4am
  quietHoursEnd: 10,      // 10am
  ignoreQuietForCritical: true,

  digestEnabled: true,
  digestIntervalMinutes: 60,

  escalateAfterMinutes: 10,
  escalateTo: 'gerente',

  routes: [
    {
      role: 'bartender',
      severities: ['critical'],
      // barIds configurado por usuario
    },
    {
      role: 'bodega',
      severities: ['warning', 'critical'],
    },
    {
      role: 'gerente',
      severities: ['critical'], // Solo críticos escalados
    },
  ],
};

export function loadOrchestratorConfig(): OrchestratorConfig {
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

export function saveOrchestratorConfig(config: OrchestratorConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function loadNotificationStates(): Map<string, NotificationState> {
  const stored = localStorage.getItem(STATE_KEY);
  if (stored) {
    try {
      const arr: NotificationState[] = JSON.parse(stored);
      return new Map(arr.map(s => [s.productId, s]));
    } catch {
      return new Map();
    }
  }
  return new Map();
}

function saveNotificationStates(states: Map<string, NotificationState>): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(Array.from(states.values())));
}

// ============================================
// Antispam Logic
// ============================================

function isInCooldown(
  productId: string,
  severity: 'info' | 'warning' | 'critical'
): boolean {
  const states = loadNotificationStates();
  const state = states.get(productId);

  if (!state) return false;

  const now = new Date();
  const cooldownEnd = new Date(state.cooldownUntil);

  if (now < cooldownEnd) {
    // Still in cooldown, but allow if severity escalated
    const severityOrder = { info: 0, warning: 1, critical: 2 };
    const lastSeverityOrder = severityOrder[state.lastSeverity as keyof typeof severityOrder] ?? 0;
    const newSeverityOrder = severityOrder[severity];

    // Allow notification if severity increased
    if (newSeverityOrder > lastSeverityOrder) {
      return false;
    }

    return true;
  }

  return false;
}

function updateCooldown(
  productId: string,
  severity: 'info' | 'warning' | 'critical'
): void {
  const config = loadOrchestratorConfig();
  const states = loadNotificationStates();

  const cooldownMinutes = {
    info: config.cooldownInfo,
    warning: config.cooldownWarning,
    critical: config.cooldownCritical,
  }[severity];

  const cooldownUntil = new Date();
  cooldownUntil.setMinutes(cooldownUntil.getMinutes() + cooldownMinutes);

  const existing = states.get(productId);

  states.set(productId, {
    productId,
    lastNotifiedAt: new Date().toISOString(),
    lastSeverity: severity,
    cooldownUntil: cooldownUntil.toISOString(),
    notificationCount: (existing?.notificationCount || 0) + 1,
    acknowledged: false,
  });

  saveNotificationStates(states);
}

// ============================================
// Quiet Hours Check
// ============================================

function isQuietHours(): boolean {
  const config = loadOrchestratorConfig();
  const hour = new Date().getHours();

  if (config.quietHoursStart < config.quietHoursEnd) {
    // Normal range (e.g., 4am to 10am)
    return hour >= config.quietHoursStart && hour < config.quietHoursEnd;
  } else {
    // Overnight range (e.g., 22pm to 6am)
    return hour >= config.quietHoursStart || hour < config.quietHoursEnd;
  }
}

function shouldNotify(severity: 'info' | 'warning' | 'critical'): boolean {
  const config = loadOrchestratorConfig();

  if (isQuietHours()) {
    // In quiet hours, only notify critical if configured
    return severity === 'critical' && config.ignoreQuietForCritical;
  }

  return true;
}

// ============================================
// Routing Logic
// ============================================

function getRoutesForAlert(
  severity: 'info' | 'warning' | 'critical',
  barId?: string
): NotificationRoute[] {
  const config = loadOrchestratorConfig();

  return config.routes.filter(route => {
    // Check severity match
    if (!route.severities.includes(severity)) return false;

    // Check bar filter for bartenders
    if (route.role === 'bartender' && route.barIds && barId) {
      if (!route.barIds.includes(barId)) return false;
    }

    return true;
  });
}

// ============================================
// Main Orchestration
// ============================================

export interface OrchestrationResult {
  notified: boolean;
  reason?: string;
  channels: {
    inApp: boolean;
    telegram: boolean;
    whatsapp: boolean;
  };
  composedMessage?: ComposedAlert;
}

export async function orchestrateNotification(
  state: StockState,
  recommendation: ReplenishmentRecommendation
): Promise<OrchestrationResult> {
  const config = loadOrchestratorConfig();

  if (!config.enabled) {
    return { notified: false, reason: 'Orchestrator disabled', channels: { inApp: false, telegram: false, whatsapp: false } };
  }

  // Check if OK (no alert needed)
  if (state.severity === 'ok') {
    return { notified: false, reason: 'No alert needed', channels: { inApp: false, telegram: false, whatsapp: false } };
  }

  const severity = state.severity as 'info' | 'warning' | 'critical';

  // Check cooldown
  if (isInCooldown(state.productId, severity)) {
    return { notified: false, reason: 'In cooldown', channels: { inApp: false, telegram: false, whatsapp: false } };
  }

  // Check quiet hours
  if (!shouldNotify(severity)) {
    return { notified: false, reason: 'Quiet hours', channels: { inApp: false, telegram: false, whatsapp: false } };
  }

  // Get velocity for message composition
  const velocity = calculateVelocity(state.productId);

  // Compose message (uses LLM if available, fallback to template)
  let composedMessage: ComposedAlert;
  try {
    composedMessage = await composeAlertMessage(state, recommendation, velocity);
  } catch {
    // Use basic template
    composedMessage = {
      shortMessage: `${state.productName}: ${state.available} uds`,
      fullMessage: `${state.productName} en nivel ${severity}. Stock: ${state.available} uds.`,
      whatsappMessage: `🔔 *${state.productName}*\nStock: ${state.available}\nAcción: Pedir ${recommendation.suggestedQty} uds`,
      explanation: recommendation.reasoning,
    };
  }

  // Send notifications
  const results = {
    inApp: false,
    telegram: false,
    whatsapp: false,
  };

  // In-app notification (always)
  // Map severity for notification store
  const notifSeverity = severity === 'info' ? 'low' : severity === 'warning' ? 'critical' : 'out';

  notifyStockAlert({
    id: `alert-${state.productId}-${Date.now()}`,
    productId: state.productId,
    productName: state.productName,
    currentStock: state.available,
    minStock: state.thresholds.reorderPoint,
    severity: notifSeverity,
    createdAt: new Date().toISOString(),
    acknowledged: false,
    aiSuggestion: composedMessage.fullMessage,
  });
  results.inApp = true;

  // External notifications based on routes
  const routes = getRoutesForAlert(severity, state.categoryId || undefined);

  for (const route of routes) {
    if (route.telegramChatId) {
      const sent = await sendTelegramMessage(composedMessage.whatsappMessage);
      if (sent) results.telegram = true;
    }

    if (route.whatsappNumber) {
      const sent = await sendWhatsAppMessage(composedMessage.whatsappMessage);
      if (sent) results.whatsapp = true;
    }
  }

  // Update cooldown
  updateCooldown(state.productId, severity);

  return {
    notified: true,
    channels: results,
    composedMessage,
  };
}

// ============================================
// Batch Processing
// ============================================

export async function processBatchAlerts(
  alerts: Array<{ state: StockState; recommendation: ReplenishmentRecommendation }>
): Promise<{ processed: number; notified: number }> {
  let notified = 0;

  for (const alert of alerts) {
    const result = await orchestrateNotification(alert.state, alert.recommendation);
    if (result.notified) notified++;
  }

  return { processed: alerts.length, notified };
}

// ============================================
// Digest Generation
// ============================================

export async function sendDigest(
  alerts: Array<{ state: StockState; recommendation: ReplenishmentRecommendation }>
): Promise<boolean> {
  const config = loadOrchestratorConfig();

  if (!config.digestEnabled || alerts.length === 0) {
    return false;
  }

  // Check last digest time
  const lastDigest = localStorage.getItem(DIGEST_KEY);
  if (lastDigest) {
    const lastTime = new Date(lastDigest).getTime();
    const minInterval = config.digestIntervalMinutes * 60 * 1000;
    if (Date.now() - lastTime < minInterval) {
      return false; // Too soon for another digest
    }
  }

  // Generate digest
  const digestMessage = await composeDigest(alerts);

  // Send to all external channels
  const results = await sendAlertToAllChannels(digestMessage);

  // Update last digest time
  localStorage.setItem(DIGEST_KEY, new Date().toISOString());

  return results.telegram || results.whatsapp || results.webhook;
}

// ============================================
// Acknowledgment
// ============================================

export function acknowledgeAlert(productId: string, _acknowledgedBy?: string): void {
  const states = loadNotificationStates();
  const state = states.get(productId);

  if (state) {
    state.acknowledged = true;
    states.set(productId, state);
    saveNotificationStates(states);
  }
}

export function getUnacknowledgedAlerts(): NotificationState[] {
  const states = loadNotificationStates();
  return Array.from(states.values()).filter(s => !s.acknowledged);
}

// ============================================
// Escalation Check
// ============================================

export function checkForEscalation(): NotificationState[] {
  const config = loadOrchestratorConfig();
  const states = loadNotificationStates();
  const escalateThreshold = config.escalateAfterMinutes * 60 * 1000;

  const toEscalate: NotificationState[] = [];

  states.forEach(state => {
    if (state.acknowledged) return;
    if (state.lastSeverity !== 'critical') return;

    const timeSinceNotification = Date.now() - new Date(state.lastNotifiedAt).getTime();
    if (timeSinceNotification > escalateThreshold) {
      toEscalate.push(state);
    }
  });

  return toEscalate;
}
