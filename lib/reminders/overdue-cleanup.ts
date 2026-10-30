import 'server-only';

/**
 * Notes-metadata helpers for the overdue auto-removal.
 *
 * A soft-deleted row lives entirely in its `notes` column: a
 * `[HistoryState: {...}]` block saying so, with every other block — the
 * user's own text, `[AccountLinks: ...]`, `[AttachedReceipts: ...]` —
 * preserved around it. The client (subscription-service) owns that format
 * for the button-driven paths; the reminder engine needs the same result
 * server-side, where the client module's browser glue cannot run. The
 * regexes and rebuild here mirror the client's exactly, so a row this module
 * removes is indistinguishable from one the Remove button removed: it shows
 * up in Past Activities under Deleted and restores with its receipts.
 */
export type ServerHistoryState = 'active' | 'archived' | 'deleted';

const ACCOUNT_LINKS_RE = /\[AccountLinks:\s*(\[.*?\])\]/;
const ATTACHED_RECEIPTS_RE = /\[AttachedReceipts:\s*(\[.*?\])\]/;
const HISTORY_STATE_RE = /\[HistoryState:\s*(\{.*?\})\]/;

/** The row's own history state, read the way the client reads it. */
export function serverHistoryState(notes: string | null | undefined): ServerHistoryState {
  if (!notes || !notes.includes('[HistoryState:')) return 'active';
  try {
    const match = HISTORY_STATE_RE.exec(notes);
    if (match && match[1]) {
      const parsed = JSON.parse(match[1]) as { state?: string };
      if (parsed.state === 'archived' || parsed.state === 'deleted') {
        return parsed.state;
      }
    }
  } catch {
    // A corrupt block reads as active, matching the client's fallback.
  }
  return 'active';
}

/** The user's own notes text, with every metadata block stripped. */
export function cleanNotesUserTextServer(notes: string | null | undefined): string {
  if (!notes) return '';
  return notes
    .replace(/\[AccountLinks:\s*\[.*?\]\]/g, '')
    .replace(/\[AttachedReceipts:\s*\[.*?\]\]/g, '')
    .replace(/\[HistoryState:\s*\{.*?\}\]/g, '')
    .replace(/^\[(Gmail Discovery|Gmail Monitoring|Email Forwarding|Receipt Import)[^\]]*\]\s*$/gm, '')
    .trim();
}

export interface AutoRemovalNotesInput {
  notes: string | null | undefined;
  status: string | null | undefined;
  /** ISO timestamp of the removal, recorded as the block's deletedAt. */
  removedAt: string;
}

/**
 * Notes rewritten as a soft delete caused by the auto-removal, keeping the
 * links and receipts blocks the row already carried.
 */
export function notesForAutoRemoval({
  notes,
  status,
  removedAt,
}: AutoRemovalNotesInput): string | null {
  const clean = cleanNotesUserTextServer(notes);
  const parts: string[] = [];
  if (clean) parts.push(clean);

  const linksMatch = notes ? ACCOUNT_LINKS_RE.exec(notes) : null;
  const receiptsMatch = notes ? ATTACHED_RECEIPTS_RE.exec(notes) : null;
  if (linksMatch && linksMatch[1]) {
    parts.push(`[AccountLinks: ${linksMatch[1]}]`);
  }
  if (receiptsMatch && receiptsMatch[1]) {
    parts.push(`[AttachedReceipts: ${receiptsMatch[1]}]`);
  }

  /* The state block: rebuilding it (rather than re-emitting the old one) is
     what marks the row deleted, and carries the status the restore should
     bring it back as. */
  const historyMeta = {
    state: 'deleted',
    previousStatus: status ?? 'active',
    deletedAt: removedAt,
  };
  parts.push(`[HistoryState: ${JSON.stringify(historyMeta)}]`);

  return parts.join('\n');
}
