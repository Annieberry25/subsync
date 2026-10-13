/**
 * Contact addresses shown to users.
 *
 * These were written into three separate surfaces — the landing page footer,
 * the help page, and the settings page — as raw `mailto:` strings. They all
 * agreed, but nothing kept them agreeing: changing the support address meant
 * finding every literal, and a miss would leave a dead link on a marketing page
 * where it is the only route to a human.
 *
 * Transactional senders are deliberately absent. Those come from the
 * environment (`EMAIL_FROM`, `VAPID_SUBJECT`) because they are per-deployment
 * configuration, not product copy. See `lib/env.ts`.
 */
export const SUPPORT_EMAIL = 'support@subhalt.app';

export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

/**
 * Pre-addressed enquiry link for the landing page's primary call to action.
 *
 * The subject is filled in so a visitor who does open a compose window does not
 * have to invent a subject line, which is where most of them abandon. Built here
 * rather than in the page so the subject stays consistent if it ever changes.
 */
export const SUPPORT_ENQUIRY_MAILTO = `${SUPPORT_MAILTO}?subject=${encodeURIComponent(
  'SubHalt enquiry'
)}`;