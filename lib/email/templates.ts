/**
 * Email copy.
 *
 * PROVENANCE — the design system this project has on disk
 * (docs/DESIGN_SYSTEM.md) defines colour, layout and typography. It contains no
 * prose guidance, so there is no documented subject-line or body-copy standard to
 * follow. The voice below is therefore derived from the one thing it does
 * specify for the shipped theme, Midnight:
 *
 *   Personality   "Professional, modern, focused."
 *   Inspiration   Linear, Raycast, Arc Browser, Vercel
 *   Accent        Teal #14B8A6 on dark text
 *   Feeling       "Like working in a premium developer tool."
 *
 * The rules applied, all taken from that:
 *   - Short declarative sentences. No exclamation marks, no "🎉", no "we're
 *     excited". Linear and Raycast do not write that way, and "focused" rules
 *     them out.
 *   - State the fact, then the next action. Never restate what the user just did
 *     at length.
 *   - No exclamation marks anywhere.
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

/** 1. New account. Voice: Midnight personality — professional, focused. */
export function renderWelcomeEmail(input: {
  firstName?: string | null;
  loginUrl?: string;
}): RenderedEmail {
  const name = input.firstName?.trim();

  return {
    // Voice source: Midnight Personality + Inspiration (Linear/Raycast = short,
    // lowercase-ish subject, no exclamation).
    subject: name ? `Welcome to SubHalt, ${name}` : 'Welcome to SubHalt',
    html: renderEmailLayout({
      preheader: 'Your SubHalt account is ready.',
      heading: name ? `Welcome, ${name}` : 'Welcome to SubHalt',
      bodyHtml: [
        emailParagraph(
          'Your account is ready. Add your first subscription to start tracking renewals, spend and upcoming charges.'
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
      preheader: `${cadence} — ${sub.nextBillingDate}.`,
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