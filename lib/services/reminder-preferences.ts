import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Reminder preferences, in the database.
 *
 * These used to live in localStorage (`subhalt_reminders`), which is per-browser.
 * The reminder cron runs server-side and could not see them at all, so it mailed
 * every non-canceled row inside the window regardless of what the user chose and
 * nothing they set had any effect. A preference that drives a server-side job has
 * to be readable by that job.
 *
 * The localStorage copy is still written by the callers that already own the
 * reminder UI, so the on-screen reminder badges keep working offline; this is the
 * durable copy the cron reads.
 */

export interface ReminderPreference {
  subscriptionId: string;
  /** Days before the billing date to send the email. Null when email is off. */
  emailLeadDays: number | null;
  /** Days before the billing date to push. Null when push is off. */
  pushLeadDays: number | null;
  note?: string | null;
}

interface ReminderRow {
  subscription_id: string;
  email_lead_days: number;
  push_lead_days: number;
  email_enabled: boolean;
  push_enabled: boolean;
  note: string | null;
}

function toPreference(row: ReminderRow): ReminderPreference {
  return {
    subscriptionId: row.subscription_id,
    emailLeadDays: row.email_enabled ? row.email_lead_days : null,
    pushLeadDays: row.push_enabled ? row.push_lead_days : null,
    note: row.note,
  };
}

/**
 * Loads every reminder preference for the signed-in user.
 *
 * Returns an empty list rather than throwing when there is no session: callers
 * treat "no preferences" as "use the defaults", and a signed-out render must not
 * throw during hydration.
 */
export async function fetchReminderPreferences(): Promise<ReminderPreference[]> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('subscription_reminders')
      .select('subscription_id, email_lead_days, push_lead_days, email_enabled, push_enabled, note');

    if (error) {
      logger.warn('[reminders] could not load preferences', { message: error.message });
      return [];
    }

    return ((data ?? []) as ReminderRow[]).map(toPreference);
  } catch (err) {
    logger.warn('[reminders] load failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export interface SaveReminderInput {
  subscriptionId: string;
  /** Null turns the email channel off rather than defaulting it on. */
  emailLeadDays: number | null;
  pushLeadDays: number | null;
  note?: string | null;
}

/**
 * Persists one subscription's reminder preference.
 *
 * Both channels are always written explicitly, including as false, because a row
 * is the opt-in signal: absence of the row means "no email, ever", so leaving a
 * stale `email_enabled` true while changing the lead would send mail the user has
 * since turned off.
 */
export async function saveReminderPreference(input: SaveReminderInput): Promise<boolean> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !input.subscriptionId) return false;

    const { error } = await supabase.from('subscription_reminders').upsert(
      {
        user_id: user.id,
        subscription_id: input.subscriptionId,
        email_enabled: input.emailLeadDays !== null,
        email_lead_days: input.emailLeadDays ?? 3,
        push_enabled: input.pushLeadDays !== null,
        push_lead_days: input.pushLeadDays ?? 10,
        note: input.note ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,subscription_id' }
    );

    if (error) {
      logger.warn('[reminders] could not save preference', { message: error.message });
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('[reminders] save failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Removes the preference entirely, restoring the "no email" default. */
export async function clearReminderPreference(subscriptionId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('subscription_reminders')
      .delete()
      .eq('subscription_id', subscriptionId);

    if (error) {
      logger.warn('[reminders] could not clear preference', { message: error.message });
      return false;
    }
    return true;
  } catch {
    return false;
  }
}