export type ActivityType =
  | 'added'
  | 'edited'
  | 'renewed'
  | 'archived'
  | 'deleted'
  | 'restored'
  | 'reminder_sent'
  | 'updated';

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
  metadata?: Record<string, any>;
}

const STORAGE_KEY = 'subsync_activity_log';

export function getActivityHistory(): ActivityRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed: ActivityRecord[] = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
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

