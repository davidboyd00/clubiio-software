import { EventEmitter } from 'events';

export interface AnalyticsActionPayload {
  id: string;
  venueId: string;
  type: string;
  label: string;
  status: 'PENDING' | 'APPLIED' | 'FAILED';
  priority: number;
  assignedRole?: string | null;
  metadata?: Record<string, unknown>;
  requestedById?: string | null;
  appliedAt?: Date | null;
  createdAt: Date;
  error?: string | null;
}

interface AnalyticsEvents {
  'action:created': (action: AnalyticsActionPayload) => void;
  'action:resolved': (action: AnalyticsActionPayload) => void;
}

class AnalyticsEventEmitter extends EventEmitter {
  emit<K extends keyof AnalyticsEvents>(event: K, payload: Parameters<AnalyticsEvents[K]>[0]): boolean {
    return super.emit(event, payload);
  }

  on<K extends keyof AnalyticsEvents>(event: K, listener: AnalyticsEvents[K]): this {
    return super.on(event, listener);
  }
}

export const analyticsEvents = new AnalyticsEventEmitter();
