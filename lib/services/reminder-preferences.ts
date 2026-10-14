import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { DEFAULT_USER_LEAD_MINUTES } from '@/lib/reminders/plan';

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
  /** Minutes before the billing date to send the email. Null when email is off. */
  emailLeadMinutes: number | null;
  /** Minutes before the billing date to push. Null when push is off. */
  pushLeadMinutes: number | null;
  note?: string | null;
}

interface ReminderRow {
  subscription_id: string;
  email_lead_minutes: number;
  push_lead_minutes: number;
  email_enabled: boolean;
  push_enabled: boolean;
  note: string | null;
}

function toPreference(row: ReminderRow): ReminderPreference {
  return {
    subscriptionId: row.subscription_id,
    emailLeadMinutes: row.email_enabled ? row.email_lead_minutes : null,
    pushLeadMinutes: row.push_enabled ? row.push_lead_minutes : null,
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
      .select('subscription_id, email_lead_minutes, push_lead_minutes, email_enabled, push_enabled, note');

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
  emailLeadMinutes: number | null;
  pushLeadMinutes: number | null;
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
        email_enabled: input.emailLeadMinutes !== null,
        email_lead_minutes: input.emailLeadMinutes ?? DEFAULT_USER_LEAD_MINUTES,
        push_enabled: input.pushLeadMinutes !== null,
        push_lead_minutes: input.pushLeadMinutes ?? DEFAULT_USER_LEAD_MINUTES,
        note: input.note ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,subscription_id' }
    );

    if (error) {
      logger.warn('[reminders] could not save preference', { message: error.message });
      return false;
    }

    /*
     * Deliver what the account is already owed, right now.
     *
     * The engine only ever runs on a schedule, so a reminder saved after the day's
     * tick would otherwise wait up to 24 hours even when it was due at the moment
     * it was configured. This asks the server to check immediately; the endpoint is
     * scoped to the caller, so it covers this user's opt-in reminder and any
     * automatic stage already due across all of their subscriptions.
     *
     * Fire and forget. The preference is already saved, which is what the caller
     * is waiting on; a delivery failure here must not turn a successful save into
     * a reported failure, and the next cron tick picks up anything missed.
     */
    void fetch('/api/reminders/run-now', { method: 'POST' }).catch(() => undefined);

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