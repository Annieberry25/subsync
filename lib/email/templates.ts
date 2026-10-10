/**
 * Email copy.
 *
 * PROVENANCE — the design system this project has on disk
 * (docs/DESIGN_SYSTEM.md) defines colour, layout, typography and, for the
 * welcome message, the exact copy. That one template follows its "Welcome
 * Message" voice ("Hey friend! ... Let's get started!").
 *
 * For everything else it contains no prose guidance, so the voice is derived
 * from the one thing it does specify for the shipped theme, Midnight:
 *
 *   Personality   "Professional, modern, focused."
 *   Inspiration   Linear, Raycast, Arc Browser, Vercel
 *   Accent        Teal #14B8A6 on dark text
 *   Feeling       "Like working in a premium developer tool."
 *
 * The rules applied for non-welcome templates, all taken from that:
 *   - Short declarative sentences. No exclamation marks, no "🎉", no "we're
 *     excited". Linear and Raycast do not write that way, and "focused" rules
 *     them out.
 *   - State the fact, then the next action. Never restate what the user just did
 *     at length.
 *   - "Pre-professional tool" register: terse, specific, unfussy.
 *
 * Every line is marked with the source so a real voice bible can replace it
 * line by line rather than by rewriting the module.
 */

import {
  renderEmailLayout,
  emailParagraph,
  emailDetailRow,
  emailFinePrint,
} from './layout';
import type { SubscriptionEmailData } from './types';

export interface RenderedEmail {
  subject: string;
  html: string;
}

/**
 * 1. New account.
 *
 * Voice: DESIGN_SYSTEM.md "Welcome Message" (line 175) — verbatim, including
 * the exclamation marks. This is the one template with a documented friendly
 * register; every other template follows the Midnight professional voice.
 */
export function renderWelcomeEmail(_input: {
  firstName?: string | null;
  loginUrl?: string;
}): RenderedEmail {
  return {
    subject: 'Welcome to the subHalt hut!',
    html: renderEmailLayout({
      preheader: 'Your account is ready. Start tracking your subscriptions.',
      heading: 'Welcome to the subHalt hut!',
      bodyHtml: [
        emailParagraph(
          "Hey friend! I'm your new spending tracker, here to help you find missing subscriptions and stop wasting money on forgotten subscriptions and save money. Let's get started!"
        ),
        emailFinePrint(
          'Nothing to set up. Everything is optional and can be changed later in Settings.'
        ),
      ].join(''),
    }),
  };
}

/** 2. Subscription created. */
export function renderSubscriptionCreatedEmail(
  sub: SubscriptionEmailData
): RenderedEmail {
  const cadence = formatCadence(sub.billingCycle, sub.price, sub.currency);

  return {
    // Voice source: states the fact plainly. No "Great news!".
    subject: `${sub.name} added`,
    html: renderEmailLayout({
      preheader: `${sub.name} is now being tracked.`,
      heading: `${sub.name} is now tracked`,
      bodyHtml: [
        emailParagraph(
          'We will remind you before the next charge so nothing is a surprise.'
        ),
        emailDetailRow('Next charge', sub.nextBillingDate),
        emailDetailRow('Amount', cadence),
      ].join(''),
    }),
  };
}

/** 3. Renewal reminder. */
export function renderRenewalReminderEmail(
  sub: SubscriptionEmailData
): RenderedEmail {
  const days = sub.daysUntilRenewal ?? 0;
  const cadence = formatCadence(sub.billingCycle, sub.price, sub.currency);

  const heading =
    days <= 0
      ? `${sub.name} is due for payment`
      : days === 1
        ? `${sub.name} renews tomorrow`
        : `${sub.name} renews in ${days} days`;

  return {
    subject: days <= 0 ? `${sub.name} payment due` : `${sub.name} renews in ${days} days`,
    html: renderEmailLayout({
      preheader: `${cadence}. ${sub.nextBillingDate}.`,
      heading,
      bodyHtml: [
        emailParagraph(
          days <= 0
            ? 'This charge has already passed its billing date.'
            : 'A reminder so the next charge does not catch you by surprise.'
        ),
        emailDetailRow('Next charge', sub.nextBillingDate),
        emailDetailRow('Amount', cadence),
      ].join(''),
    }),
  };
}

/**
 * 4. Account deletion code.
 *
 * Sent to every user before account deletion — ownership is always proven by
 * access to the account email, password or OAuth-only alike.
 */
export function renderAccountDeleteCodeEmail(code: string): RenderedEmail {
  return {
    subject: 'Your account deletion code',
    html: renderEmailLayout({
      preheader: 'Use this code to confirm account deletion.',
      heading: 'Confirm account deletion',
      bodyHtml: [
        emailParagraph(
          'Use the code below to confirm that you want to permanently delete your SubHalt account. It expires in a few minutes.'
        ),
        emailDetailRow('Your code', code),
        emailFinePrint(
          'If you did not request this, you can safely ignore this email and your account will stay active.'
        ),
      ].join(''),
    }),
  };
}

/**
 * 5. Account deleted (farewell).
 *
 * Voice: same DESIGN_SYSTEM friendly register as the welcome email — a goodbye
 * to a customer who asked to leave mirrors the marketing voice rather than the
 * transactional one. The "link below" is the layout's Sign In button, which
 * points at https://subhalt.xyz/login.
 */
export function renderAccountDeletedEmail(): RenderedEmail {
  return {
    subject: 'Goodbye from the subHalt hut',
    html: renderEmailLayout({
      preheader: 'You have left the subHalt hut. We hope to have you back someday.',
      heading: 'Goodbye, friend',
      bodyHtml: [
        emailParagraph(
          "Hey friend! Thank you for staying in our hut for a while. We hate to see you go, we hope to have you back someday. In case you change your mind, here is the link below to sign up again. Take care!"
        ),
      ].join(''),
    }),
  };
}

function formatCadence(
  billingCycle: string | null | undefined,
  price: number,
  currency: string | null | undefined
): string {
  const amount = formatAmount(price, currency);
  switch ((billingCycle || 'monthly').toLowerCase()) {
    case 'yearly':
    case 'annual':
      return `${amount} / year`;
    case 'quarterly':
      return `${amount} / quarter`;
    case 'weekly':
      return `${amount} / week`;
    default:
      return `${amount} / month`;
  }
}

function formatAmount(price: number, currency: string | null | undefined): string {
  const code = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    // Unknown currency code from user data must not break the send.
    return `${price.toFixed(2)} ${code}`;
  }
}