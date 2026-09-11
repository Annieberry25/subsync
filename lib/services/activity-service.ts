import { safeSetItem, safeGetItem } from '@/lib/safe-local-storage';
export type ActivityType =
  | 'added'
  | 'edited'
  | 'renewed'
  | 'archived'
  | 'deleted'
  | 'restored'
  | 'reminder_sent'
  | 'updated';

import { logger } from '@/lib/logger';

export interface ActivityRecord {
  id: string;
  subscriptionId?: string;
  subscriptionName: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string; // ISO String
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

const STORAGE_KEY = 'subsync_activity_log';

export function getActivityHistory(): ActivityRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = safeGetItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed: ActivityRecord[] = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logger.warn('[activity-service] getActivityHistory parse error', { message: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

export function recordActivity(record: Omit<ActivityRecord, 'id' | 'timestamp'>): ActivityRecord {
  const newRecord: ActivityRecord = {
    ...record,
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      const current = getActivityHistory();
      const updated = [newRecord, ...current];
      safeSetItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      logger.warn('[activity-service] recordActivity storage error', { message: err instanceof Error ? err.message : String(err) });
    }
  }

  return newRecord;
}

export interface ActivityPreviewTexts {
  normal: string;
  hover: string;
  full: string;
}

export function getActivityPreviewTexts(act: ActivityRecord): ActivityPreviewTexts {
  const full = act.description || '';

  let normal = full.trim();
  if (normal.length > 45) {
    normal = normal.slice(0, 42).trim() + '...';
  } else if (!normal.endsWith('...') && normal.length > 0) {
    normal = normal + '...';
  }

  let hover = full.trim();
  if (hover.length > 85) {
    hover = hover.slice(0, 82).trim() + '...';
  } else if (!hover.endsWith('...') && hover.length > 0) {
    hover = hover + '...';
  }

  return { normal, hover, full };
}

