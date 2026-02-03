import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import type {
  StockAlert,
  StockAlertConfig,
  StockAlertNotification,
  NotificationChannel,
  NotificationRole,
  AlertSeverity,
} from './stock-alerts.types';
import { alertEngine } from './alert-engine.service';

// ============================================
// NOTIFICATION ROUTER SERVICE
// ============================================
// Routes stock alerts to appropriate recipients
// CRITICAL: Only notifies ADMIN/MANAGER roles, NOT cashiers

interface Recipient {
  userId: string;
  role: NotificationRole;
  channels: NotificationChannel[];
  email?: string;
  pushToken?: string;
}

export interface NotificationRouterEvents {
  'notification:send': (notification: StockAlertNotification) => void;
  'notification:sent': (notification: StockAlertNotification) => void;
  'notification:failed': (notification: StockAlertNotification, error: Error) => void;
}

class NotificationRouterService extends EventEmitter {
  private config: StockAlertConfig | null = null;
  private recipients: Map<string, Recipient> = new Map();
  private pendingNotifications: StockAlertNotification[] = [];
  private aggregationBuffer: Map<string, StockAlert[]> = new Map(); // barId -> alerts
  private aggregationTimeout: NodeJS.Timeout | null = null;

  // IMPORTANT: Roles that should receive stock alerts
  // Cashiers (cajeros) are EXCLUDED
  private readonly ALLOWED_ROLES: NotificationRole[] = ['admin', 'manager', 'supervisor'];

  constructor() {
    super();
    this.setMaxListeners(100);
    this.setupAlertListeners();
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  setConfig(config: StockAlertConfig): void {
    this.config = config;
    console.log(`[NotificationRouter] Configuration updated for venue ${config.venueId}`);
  }

  // ============================================
  // RECIPIENT MANAGEMENT
  // ============================================

  /**
   * Register a recipient for notifications
   * Only admin, manager, and supervisor roles are allowed
   */
  registerRecipient(recipient: Recipient): boolean {
    // SECURITY: Reject non-admin roles
    if (!this.ALLOWED_ROLES.includes(recipient.role)) {
      console.warn(`[NotificationRouter] Rejected registration for role: ${recipient.role}`);
      return false;
    }

    this.recipients.set(recipient.userId, recipient);
    console.log(`[NotificationRouter] Registered ${recipient.role}: ${recipient.userId}`);
    return true;
  }

  unregisterRecipient(userId: string): void {
    this.recipients.delete(userId);
  }

  getRecipients(role?: NotificationRole): Recipient[] {
    const all = Array.from(this.recipients.values());
    if (role) {
      return all.filter(r => r.role === role);
    }
    return all;
  }

  // ============================================
  // ALERT LISTENERS
  // ============================================

  private setupAlertListeners(): void {
    alertEngine.on('alert:created', (alert: StockAlert) => {
      this.handleNewAlert(alert);
    });

    alertEngine.on('alert:resolved', (alert: StockAlert) => {
      // Optionally notify about resolution
      if (alert.severity === 'emergency' || alert.severity === 'critical') {
        this.sendResolutionNotification(alert);
      }
    });
  }

  private handleNewAlert(alert: StockAlert): void {
    if (!this.config?.enabled) return;

    // Check if aggregation is enabled
    if (this.config.notifications.aggregateAlerts) {
      this.addToAggregationBuffer(alert);
    } else {
      this.routeAlert(alert);
    }
  }

  // ============================================
  // ALERT AGGREGATION
  // ============================================

  private addToAggregationBuffer(alert: StockAlert): void {
    const buffer = this.aggregationBuffer.get(alert.barId) || [];
    buffer.push(alert);
    this.aggregationBuffer.set(alert.barId, buffer);

    // Start/reset aggregation timer
    if (this.aggregationTimeout) {
      clearTimeout(this.aggregationTimeout);
    }

    const windowMs = (this.config?.notifications.aggregateWindowSeconds || 30) * 1000;
    this.aggregationTimeout = setTimeout(() => {
      this.flushAggregationBuffer();
    }, windowMs);

    // Immediately send emergency alerts
    if (alert.severity === 'emergency') {
      this.flushAggregationBuffer();
    }
  }

  private flushAggregationBuffer(): void {
    for (const [barId, alerts] of this.aggregationBuffer) {
      if (alerts.length === 1) {
        this.routeAlert(alerts[0]);
      } else if (alerts.length > 1) {
        this.routeAggregatedAlerts(barId, alerts);
      }
    }

    this.aggregationBuffer.clear();
    if (this.aggregationTimeout) {
      clearTimeout(this.aggregationTimeout);
      this.aggregationTimeout = null;
    }
  }

  // ============================================
  // ROUTING
  // ============================================

  private routeAlert(alert: StockAlert): void {
    const recipients = this.getEligibleRecipients(alert);

    for (const recipient of recipients) {
      for (const channel of recipient.channels) {
        if (this.shouldUseChannel(channel, alert.severity)) {
          const notification = this.createNotification(alert, recipient, channel);
          this.sendNotification(notification);
        }
      }
    }
  }

  private routeAggregatedAlerts(barId: string, alerts: StockAlert[]): void {
    const recipients = this.getEligibleRecipients(alerts[0]);
    const mostSevere = this.getMostSevereAlert(alerts);

    for (const recipient of recipients) {
      for (const channel of recipient.channels) {
        if (this.shouldUseChannel(channel, mostSevere.severity)) {
          const notification = this.createAggregatedNotification(
            barId,
            alerts,
            recipient,
            channel
          );
          this.sendNotification(notification);
        }
      }
    }
  }

  private getEligibleRecipients(alert: StockAlert): Recipient[] {
    const configuredRoles = this.config?.notifications.roles || ['admin', 'manager'];

    return Array.from(this.recipients.values()).filter(r => {
      // Must be an allowed role
      if (!this.ALLOWED_ROLES.includes(r.role)) return false;

      // Must be in configured roles for this venue
      if (!configuredRoles.includes(r.role)) return false;

      return true;
    });
  }

  private shouldUseChannel(channel: NotificationChannel, severity: AlertSeverity): boolean {
    const configuredChannels = this.config?.notifications.channels || ['websocket', 'push'];

    if (!configuredChannels.includes(channel)) return false;

    // SMS and email only for critical/emergency
    if ((channel === 'sms' || channel === 'email') &&
        severity !== 'critical' && severity !== 'emergency') {
      return false;
    }

    return true;
  }

  // ============================================
  // NOTIFICATION CREATION
  // ============================================

  private createNotification(
    alert: StockAlert,
    recipient: Recipient,
    channel: NotificationChannel
  ): StockAlertNotification {
    return {
      notificationId: randomUUID(),
      alertId: alert.alertId,

      recipientId: recipient.userId,
      recipientRole: recipient.role,
      channel,

      title: this.getNotificationTitle(alert),
      message: this.getNotificationMessage(alert),
      data: {
        barId: alert.barId,
        barName: alert.barName,
        productId: alert.productId,
        productName: alert.productName,
        stockPercentage: alert.stockPercentage,
        severity: alert.severity,
      },

      sentAt: new Date(),
      deliveredAt: null,
      readAt: null,

      actionUrl: `/dashboard/bars/${alert.barId}/stock`,
      actions: [
        {
          label: 'Ver Detalles',
          action: 'view_details',
          url: `/dashboard/alerts/${alert.alertId}`,
        },
        {
          label: 'Reabastecer',
          action: 'restock',
          url: `/dashboard/bars/${alert.barId}/restock?product=${alert.productId}`,
        },
        {
          label: 'Reconocer',
          action: 'acknowledge',
          url: `/api/stock-alerts/${alert.alertId}/acknowledge`,
        },
      ],
    };
  }

  private createAggregatedNotification(
    barId: string,
    alerts: StockAlert[],
    recipient: Recipient,
    channel: NotificationChannel
  ): StockAlertNotification {
    const mostSevere = this.getMostSevereAlert(alerts);
    const barName = alerts[0]?.barName || 'Barra';

    return {
      notificationId: randomUUID(),
      alertId: mostSevere.alertId,

      recipientId: recipient.userId,
      recipientRole: recipient.role,
      channel,

      title: `⚠️ ${alerts.length} productos con stock bajo en ${barName}`,
      message: this.getAggregatedMessage(alerts),
      data: {
        barId,
        barName,
        productId: mostSevere.productId,
        productName: `${alerts.length} productos`,
        stockPercentage: mostSevere.stockPercentage,
        severity: mostSevere.severity,
      },

      sentAt: new Date(),
      deliveredAt: null,
      readAt: null,

      actionUrl: `/dashboard/bars/${barId}/stock`,
      actions: [
        {
          label: 'Ver Todos',
          action: 'view_details',
          url: `/dashboard/bars/${barId}/alerts`,
        },
        {
          label: 'Reabastecer',
          action: 'restock',
          url: `/dashboard/bars/${barId}/restock`,
        },
      ],
    };
  }

  private getNotificationTitle(alert: StockAlert): string {
    const emoji = this.getSeverityEmoji(alert.severity);

    switch (alert.severity) {
      case 'emergency':
        return `${emoji} AGOTADO: ${alert.productName}`;
      case 'critical':
        return `${emoji} Stock Crítico: ${alert.productName}`;
      case 'warning':
        return `${emoji} Stock Bajo: ${alert.productName}`;
      default:
        return `${emoji} Alerta de Stock: ${alert.productName}`;
    }
  }

  private getNotificationMessage(alert: StockAlert): string {
    const stockInfo = `Stock: ${alert.currentStock}/${alert.maxCapacity} (${alert.stockPercentage.toFixed(0)}%)`;
    const locationInfo = `📍 ${alert.barName}`;

    let timeInfo = '';
    if (alert.estimatedDepletionMinutes !== null && alert.estimatedDepletionMinutes < 60) {
      timeInfo = `\n⏱️ Se agota en ~${Math.round(alert.estimatedDepletionMinutes)} min`;
    }

    let actionInfo = `\n💡 ${alert.suggestedAction}`;
    if (alert.suggestedRestockQty > 0) {
      actionInfo += `\n📦 Sugerido: +${alert.suggestedRestockQty} unidades`;
    }

    return `${locationInfo}\n${stockInfo}${timeInfo}${actionInfo}`;
  }

  private getAggregatedMessage(alerts: StockAlert[]): string {
    const critical = alerts.filter(a => a.severity === 'critical' || a.severity === 'emergency');
    const warning = alerts.filter(a => a.severity === 'warning');

    let message = '';

    if (critical.length > 0) {
      message += `🔴 Críticos (${critical.length}): ${critical.map(a => a.productName).join(', ')}\n`;
    }
    if (warning.length > 0) {
      message += `🟡 Advertencia (${warning.length}): ${warning.map(a => a.productName).join(', ')}\n`;
    }

    message += '\n💡 Revisar inventario y reabastecer productos afectados.';

    return message;
  }

  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case 'emergency': return '🚨';
      case 'critical': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      default: return '⚠️';
    }
  }

  private getMostSevereAlert(alerts: StockAlert[]): StockAlert {
    const severityOrder = { emergency: 0, critical: 1, warning: 2, info: 3 };
    return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])[0];
  }

  // ============================================
  // SENDING
  // ============================================

  private async sendNotification(notification: StockAlertNotification): Promise<void> {
    this.emit('notification:send', notification);

    try {
      switch (notification.channel) {
        case 'websocket':
          await this.sendWebSocket(notification);
          break;
        case 'push':
          await this.sendPush(notification);
          break;
        case 'email':
          await this.sendEmail(notification);
          break;
        case 'sms':
          await this.sendSMS(notification);
          break;
      }

      notification.deliveredAt = new Date();
      this.emit('notification:sent', notification);

      console.log(`[NotificationRouter] Sent ${notification.channel} to ${notification.recipientRole} ${notification.recipientId}`);
    } catch (error) {
      this.emit('notification:failed', notification, error as Error);
      console.error(`[NotificationRouter] Failed to send ${notification.channel}:`, error);
    }

    // Track notification on alert
    const alert = alertEngine.getAlert(notification.alertId);
    if (alert) {
      alert.notificationsSent.push({
        channel: notification.channel,
        sentAt: notification.sentAt,
        recipientId: notification.recipientId,
        recipientRole: notification.recipientRole,
      });
    }
  }

  private async sendWebSocket(notification: StockAlertNotification): Promise<void> {
    // WebSocket implementation would emit to connected admin clients
    // This integrates with your WebSocket server
    this.emit('ws:send', {
      type: 'STOCK_ALERT',
      payload: notification,
      recipientId: notification.recipientId,
    });
  }

  private async sendPush(notification: StockAlertNotification): Promise<void> {
    // Push notification implementation
    // Would integrate with FCM, APNs, or web push
    const recipient = this.recipients.get(notification.recipientId);
    if (!recipient?.pushToken) return;

    // TODO: Integrate with push notification service
    console.log(`[NotificationRouter] Would send push to token: ${recipient.pushToken}`);
  }

  private async sendEmail(notification: StockAlertNotification): Promise<void> {
    const recipient = this.recipients.get(notification.recipientId);
    if (!recipient?.email) return;

    // TODO: Integrate with email service
    console.log(`[NotificationRouter] Would send email to: ${recipient.email}`);
  }

  private async sendSMS(notification: StockAlertNotification): Promise<void> {
    // TODO: Integrate with SMS service (Twilio, etc.)
    console.log(`[NotificationRouter] Would send SMS to recipient: ${notification.recipientId}`);
  }

  private sendResolutionNotification(alert: StockAlert): void {
    const recipients = this.getEligibleRecipients(alert);

    for (const recipient of recipients) {
      // Only WebSocket for resolution notifications
      if (recipient.channels.includes('websocket')) {
        this.emit('ws:send', {
          type: 'STOCK_ALERT_RESOLVED',
          payload: {
            alertId: alert.alertId,
            productName: alert.productName,
            barName: alert.barName,
            resolvedAt: alert.resolvedAt,
          },
          recipientId: recipient.userId,
        });
      }
    }
  }
}

// Singleton instance
export const notificationRouter = new NotificationRouterService();

export default notificationRouter;
