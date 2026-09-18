import { createClient } from '@/lib/supabase/client';
import type { Json } from '@/lib/types/database.types';
import { safeSetItem, safeGetItem } from '@/lib/safe-local-storage';
import { logger } from '@/lib/logger';

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
  metadata?: Record<string, unknown>;
}

const STORAGE_KEY = 'subhalt_activity_log';
const MAX_LOCAL_ROWS = 300;

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

function writeActivityCache(records: ActivityRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    safeSetItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_LOCAL_ROWS)));
  } catch (err) {
    logger.warn('[activity-service] writeActivityCache storage error', { message: err instanceof Error ? err.message : String(err) });
  }
}

function mapDbRow(row: {
  id: string;
  subscription_id: string | null;
  subscription_name: string | null;
  type: string;
  title: string;
  description: string | null;
  amount: number | null;
  currency: string | null;
  metadata: Json | null;
  timestamp: string;
}): ActivityRecord {
  const type = row.type as ActivityType;
  return {
    id: row.id,
    subscriptionId: row.subscription_id ?? undefined,
    subscriptionName: row.subscription_name ?? 'Unknown',
    type,
    title: row.title,
    description: row.description ?? '',
    timestamp: row.timestamp,
    amount: row.amount ?? undefined,
    currency: row.currency ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
  };
}

/**
 * Load activity history. Supabase is the source of truth; the local storage
 * mirror covers offline / unauthenticated reads, then stays in sync as a cache
 * (no pending-sync queue).
 */
export async function fetchActivityLog(): Promise<ActivityRecord[]> {
  const local = getActivityHistory();
  if (typeof window === 'undefined') return local;

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return local;

    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(300);

    if (error) {
      logger.warn('[activity-service] fetchActivityLog DB error, using cache', { message: error.message });
      return local;
    }

    const dbRecords = (data ?? []).map(mapDbRow);
    const dbIds = new Set(dbRecords.map((r) => r.id));
    const merged = [...dbRecords, ...local.filter((l) => !dbIds.has(l.id))];
    writeActivityCache(merged);

    return merged;
  } catch (err) {
    logger.warn('[activity-service] fetchActivityLog db error', { message: err instanceof Error ? err.message : String(err) });
    return local;
  }
}

/**
 * Record an activity event. Writes straight to Supabase (source of truth); on
 * failure it falls back to the local cache so the entry still shows up, but it
 * is NOT queued for sync later.
 */
export async function recordActivity(
  record: Omit<ActivityRecord, 'id' | 'timestamp'>
): Promise<ActivityRecord> {
  const localId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  let finalId = localId;

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from('activity_log')
        .insert({
          user_id: user.id,
          subscription_id: record.subscriptionId ?? null,
          subscription_name: record.subscriptionName || null,
          type: record.type,
          title: record.title,
          description: record.description,
          amount: record.amount ?? null,
          currency: record.currency ?? null,
          metadata: (record.metadata as Json) ?? null,
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }
      if (data) finalId = data.id;
    }
  } catch (err) {
    logger.warn('[activity-service] recordActivity db error, recording locally', {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const newRecord: ActivityRecord = {
    ...record,
    id: finalId,
    timestamp: now,
  };

  writeActivityCache([newRecord, ...getActivityHistory()]);

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