// External Messaging Integration (WhatsApp/Telegram)

export interface MessagingConfig {
  // Telegram
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;

  // WhatsApp (via webhook - Twilio, MessageBird, or custom)
  whatsappEnabled: boolean;
  whatsappWebhookUrl: string;
  whatsappApiKey?: string;

  // Generic webhook (for custom integrations)
  webhookEnabled: boolean;
  webhookUrl: string;
  webhookHeaders?: Record<string, string>;
}

const MESSAGING_CONFIG_KEY = 'clubio_messaging_config';

const DEFAULT_CONFIG: MessagingConfig = {
  telegramEnabled: false,
  telegramBotToken: '',
  telegramChatId: '',
  whatsappEnabled: false,
  whatsappWebhookUrl: '',
  webhookEnabled: false,
  webhookUrl: '',
};

// Load config
export function loadMessagingConfig(): MessagingConfig {
  const stored = localStorage.getItem(MESSAGING_CONFIG_KEY);
  if (stored) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

// Save config
export function saveMessagingConfig(config: MessagingConfig): void {
  localStorage.setItem(MESSAGING_CONFIG_KEY, JSON.stringify(config));
}

// Send message to Telegram
export async function sendTelegramMessage(message: string): Promise<boolean> {
  const config = loadMessagingConfig();

  if (!config.telegramEnabled || !config.telegramBotToken || !config.telegramChatId) {
    console.warn('Telegram not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: config.telegramChatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      }
    );

    if (!response.ok) {
      console.error('Telegram API error:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Telegram send error:', error);
    return false;
  }
}

// Send message via WhatsApp webhook
export async function sendWhatsAppMessage(message: string): Promise<boolean> {
  const config = loadMessagingConfig();

  if (!config.whatsappEnabled || !config.whatsappWebhookUrl) {
    console.warn('WhatsApp not configured');
    return false;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.whatsappApiKey) {
      headers['Authorization'] = `Bearer ${config.whatsappApiKey}`;
    }

    const response = await fetch(config.whatsappWebhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        timestamp: new Date().toISOString(),
        source: 'clubio-pos',
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return false;
  }
}

// Send message via generic webhook
export async function sendWebhookMessage(message: string, data?: Record<string, unknown>): Promise<boolean> {
  const config = loadMessagingConfig();

  if (!config.webhookEnabled || !config.webhookUrl) {
    console.warn('Webhook not configured');
    return false;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(config.webhookHeaders || {}),
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        data,
        timestamp: new Date().toISOString(),
        source: 'clubio-pos',
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Webhook send error:', error);
    return false;
  }
}

// Send alert to all configured channels
export async function sendAlertToAllChannels(message: string): Promise<{
  telegram: boolean;
  whatsapp: boolean;
  webhook: boolean;
}> {
  const config = loadMessagingConfig();

  const results = await Promise.all([
    config.telegramEnabled ? sendTelegramMessage(message) : Promise.resolve(false),
    config.whatsappEnabled ? sendWhatsAppMessage(message) : Promise.resolve(false),
    config.webhookEnabled ? sendWebhookMessage(message) : Promise.resolve(false),
  ]);

  return {
    telegram: results[0],
    whatsapp: results[1],
    webhook: results[2],
  };
}

// Test connection to configured services
export async function testMessagingConnections(): Promise<{
  telegram: boolean | null;
  whatsapp: boolean | null;
  webhook: boolean | null;
}> {
  const config = loadMessagingConfig();
  const testMessage = '🔔 Test de conexión desde Clubio POS';

  const results = {
    telegram: null as boolean | null,
    whatsapp: null as boolean | null,
    webhook: null as boolean | null,
  };

  if (config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
    results.telegram = await sendTelegramMessage(testMessage);
  }

  if (config.whatsappEnabled && config.whatsappWebhookUrl) {
    results.whatsapp = await sendWhatsAppMessage(testMessage);
  }

  if (config.webhookEnabled && config.webhookUrl) {
    results.webhook = await sendWebhookMessage(testMessage, { test: true });
  }

  return results;
}

// Format stock alert for external messaging
export function formatStockAlertForMessaging(alerts: Array<{
  productName: string;
  currentStock: number;
  minStock: number;
  severity: 'low' | 'critical' | 'out';
  suggestion?: string;
}>): string {
  if (alerts.length === 0) return '';

  const urgentCount = alerts.filter((a) => a.severity === 'out').length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;

  let message = `🚨 *ALERTA DE STOCK - CLUBIO*\n`;
  message += `📅 ${new Date().toLocaleString('es-CL')}\n\n`;

  if (urgentCount > 0) {
    message += `❌ *${urgentCount} producto(s) AGOTADO(S)*\n`;
  }
  if (criticalCount > 0) {
    message += `⚠️ *${criticalCount} producto(s) en nivel crítico*\n`;
  }

  message += `\n📦 *Detalle:*\n`;

  alerts.forEach((alert) => {
    const icon = alert.severity === 'out' ? '🔴' : alert.severity === 'critical' ? '🟡' : '🟢';
    message += `${icon} *${alert.productName}*\n`;
    message += `   Stock: ${alert.currentStock}/${alert.minStock} uds\n`;
    if (alert.suggestion) {
      message += `   💡 ${alert.suggestion}\n`;
    }
    message += `\n`;
  });

  message += `\n_Enviado automáticamente por Clubio POS_`;

  return message;
}
