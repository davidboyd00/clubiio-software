// ============================================
// STOCK MONITOR SERVICE
// Servicio event-driven + scheduled safety check
// ============================================

import { Product } from '../lib/api';
import {
  evaluateAllProducts,
  StockState,
  ReplenishmentRecommendation,
  recordSale,
} from '../lib/stockEngine';
import {
  orchestrateNotification,
  processBatchAlerts,
  sendDigest,
  checkForEscalation,
  loadOrchestratorConfig,
} from '../lib/notificationOrchestrator';

// ============================================
// Types
// ============================================

export interface MonitorStatus {
  isRunning: boolean;
  lastCheckAt: string | null;
  nextCheckAt: string | null;
  alertsCount: number;
  criticalCount: number;
}

// ============================================
// State
// ============================================

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let digestInterval: ReturnType<typeof setInterval> | null = null;
let escalationInterval: ReturnType<typeof setInterval> | null = null;

let lastCheckAt: string | null = null;
let currentAlerts: Array<{ state: StockState; recommendation: ReplenishmentRecommendation }> = [];

// ============================================
// Event Handlers (for real-time updates)
// ============================================

/**
 * Call this when a sale is made to update velocity tracking
 */
export function onSaleEvent(productId: string, quantity: number, barId?: string): void {
  recordSale(productId, quantity, barId);
}

/**
 * Call this when inventory changes to trigger immediate evaluation
 */
export async function onInventoryChanged(
  products: Product[],
  changedProductIds: string[]
): Promise<void> {
  // Evaluate only changed products for immediate response
  const changedProducts = products.filter(p => changedProductIds.includes(p.id));
  const { alerts, recommendations } = evaluateAllProducts(changedProducts);

  // Process alerts for changed products
  for (let i = 0; i < alerts.length; i++) {
    const state = alerts[i];
    const recommendation = recommendations.find(r => r.productId === state.productId);
    if (recommendation) {
      await orchestrateNotification(state, recommendation);
    }
  }
}

// ============================================
// Scheduled Safety Check
// ============================================

async function runScheduledCheck(getProducts: () => Product[]): Promise<void> {
  const products = getProducts();
  const { alerts, recommendations } = evaluateAllProducts(products);

  lastCheckAt = new Date().toISOString();

  // Store current alerts
  currentAlerts = alerts.map(state => {
    const recommendation = recommendations.find(r => r.productId === state.productId);
    return { state, recommendation: recommendation! };
  }).filter(a => a.recommendation);

  // Process batch alerts (orchestrator handles deduplication)
  await processBatchAlerts(currentAlerts);

  console.log(`[StockMonitor] Check complete: ${alerts.length} alerts, ${
    alerts.filter(a => a.severity === 'critical').length
  } critical`);
}

async function runDigestCheck(): Promise<void> {
  if (currentAlerts.length > 0) {
    await sendDigest(currentAlerts);
  }
}

async function runEscalationCheck(): Promise<void> {
  const toEscalate = checkForEscalation();

  if (toEscalate.length > 0) {
    console.log(`[StockMonitor] Escalating ${toEscalate.length} unacknowledged critical alerts`);
    // TODO: Send escalation notification to gerente
  }
}

// ============================================
// Service Control
// ============================================

export interface MonitorConfig {
  checkIntervalMinutes: number;
  digestIntervalMinutes: number;
  escalationCheckMinutes: number;
}

const DEFAULT_MONITOR_CONFIG: MonitorConfig = {
  checkIntervalMinutes: 15,
  digestIntervalMinutes: 60,
  escalationCheckMinutes: 5,
};

export function startStockMonitor(
  getProducts: () => Product[],
  config: Partial<MonitorConfig> = {}
): void {
  const cfg = { ...DEFAULT_MONITOR_CONFIG, ...config };
  const orchestratorConfig = loadOrchestratorConfig();

  if (!orchestratorConfig.enabled) {
    console.log('[StockMonitor] Orchestrator disabled, not starting');
    return;
  }

  // Stop existing intervals
  stopStockMonitor();

  // Run initial check
  runScheduledCheck(getProducts);

  // Schedule periodic safety checks
  monitorInterval = setInterval(
    () => runScheduledCheck(getProducts),
    cfg.checkIntervalMinutes * 60 * 1000
  );

  // Schedule digest (if enabled)
  if (orchestratorConfig.digestEnabled) {
    digestInterval = setInterval(
      runDigestCheck,
      cfg.digestIntervalMinutes * 60 * 1000
    );
  }

  // Schedule escalation checks
  escalationInterval = setInterval(
    runEscalationCheck,
    cfg.escalationCheckMinutes * 60 * 1000
  );

  console.log(`[StockMonitor] Started - check every ${cfg.checkIntervalMinutes}min`);
}

export function stopStockMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  if (digestInterval) {
    clearInterval(digestInterval);
    digestInterval = null;
  }
  if (escalationInterval) {
    clearInterval(escalationInterval);
    escalationInterval = null;
  }

  console.log('[StockMonitor] Stopped');
}

export function isMonitorRunning(): boolean {
  return monitorInterval !== null;
}

export function getMonitorStatus(): MonitorStatus {
  const config = DEFAULT_MONITOR_CONFIG;
  const nextCheck = lastCheckAt
    ? new Date(new Date(lastCheckAt).getTime() + config.checkIntervalMinutes * 60 * 1000).toISOString()
    : null;

  return {
    isRunning: monitorInterval !== null,
    lastCheckAt,
    nextCheckAt: monitorInterval ? nextCheck : null,
    alertsCount: currentAlerts.length,
    criticalCount: currentAlerts.filter(a => a.state.severity === 'critical').length,
  };
}

// ============================================
// Manual Operations
// ============================================

export async function forceStockCheck(products: Product[]): Promise<{
  alerts: StockState[];
  recommendations: ReplenishmentRecommendation[];
}> {
  const result = evaluateAllProducts(products);

  lastCheckAt = new Date().toISOString();
  currentAlerts = result.alerts.map(state => {
    const recommendation = result.recommendations.find(r => r.productId === state.productId);
    return { state, recommendation: recommendation! };
  }).filter(a => a.recommendation);

  // Process alerts
  await processBatchAlerts(currentAlerts);

  return {
    alerts: result.alerts,
    recommendations: result.recommendations,
  };
}

export function getCurrentAlerts(): Array<{ state: StockState; recommendation: ReplenishmentRecommendation }> {
  return currentAlerts;
}
