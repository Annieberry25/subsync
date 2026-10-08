import { describe, it, expect } from 'vitest';
import {
  renderWelcomeEmail,
  renderSubscriptionCreatedEmail,
  renderRenewalReminderEmail,
  renderAccountDeletedEmail,
} from '@/lib/email/templates';
import { renderEmailLayout, escapeHtml, SIGN_IN_URL } from '@/lib/email/layout';
import type { SubscriptionEmailData } from '@/lib/email/types';

const sub: SubscriptionEmailData = {
  id: 'sub_1',
  name: 'Netflix',
  price: 15.99,
  currency: 'USD',
  billingCycle: 'monthly',
  nextBillingDate: '2026-10-20',
};

const allEmails = () => [
  ['welcome', renderWelcomeEmail({ firstName: 'Ada' })],
  ['welcome (no name)', renderWelcomeEmail({})],
  ['goodbye', renderAccountDeletedEmail()],
  ['subscription created', renderSubscriptionCreatedEmail(sub)],
  ['reminder, 3 days out', renderRenewalReminderEmail({ ...sub, daysUntilRenewal: 3 })],
  ['reminder, tomorrow', renderRenewalReminderEmail({ ...sub, daysUntilRenewal: 1 })],
  ['reminder, overdue', renderRenewalReminderEmail({ ...sub, daysUntilRenewal: -2 })],
] as const;

/**
 * Visible copy only.
 *
 * Stripping tags matters: the HTML legitimately contains `!` in Outlook
 * conditional comments (`<!--[if !mso]>`), so asserting on the raw markup would
 * fail for reasons that have nothing to do with the writing.
 */
function visibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The Sign In button is a hard requirement on every transactional email, so it is
 * asserted for each template rather than only the shared layout. A future template
 * that forgets to use the layout would otherwise slip through.
 */
describe('Sign In button', () => {
  it.each(allEmails())('%s includes the Sign In button', (_label, email) => {
    expect(email.html).toContain(SIGN_IN_URL);
    expect(email.html).toContain('Sign In');
    expect(SIGN_IN_URL).toBe('https://subhalt.xyz/login');
  });

  it.each(allEmails())('%s puts the button in the body, after the copy', (_label, email) => {
    const buttonAt = email.html.indexOf(SIGN_IN_URL);
    const headingAt = email.html.indexOf('<h1');
    expect(buttonAt).toBeGreaterThan(-1);
    expect(buttonAt).toBeGreaterThan(headingAt);
  });

  it('renders a VML fallback so Outlook shows a real button', () => {
    const { html } = renderWelcomeEmail({ firstName: 'Ada' });
    // Outlook ignores <a> backgrounds without a VML roundrect.
    expect(html).toContain('v:roundrect');
    expect(html).toContain('mso-padding-alt');
  });
});

describe('voice', () => {
  /**
   * Midnight's documented personality is "Professional, modern, focused", with
   * Linear/Raycast/Vercel as the inspiration. These assertions encode the
   * practical form of that: declarative, no exclamation marks, no emoji.
   * Deliberate failures here are a signal that the copy drifted toward hype.
   *
   * The welcome email is exempt: DESIGN_SYSTEM.md specifies that message
   * verbatim ("Hey friend! ... Let's get started!") and it is asserted
   * separately below.
   */
  const professionalEmails = () =>
    allEmails().filter(([label]) => !label.startsWith('welcome') && label !== 'goodbye');

  it.each(professionalEmails())('%s avoids exclamation marks and emoji', (_label, email) => {
    expect(email.subject).not.toMatch(/!/);
    expect(visibleText(email.html)).not.toMatch(/!/);
    expect(visibleText(email.html)).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it('states the fact plainly rather than celebrating', () => {
    const created = renderSubscriptionCreatedEmail(sub);
    expect(created.subject).toBe('Netflix added');
    expect(created.html).toContain('Netflix is now tracked');
    // No "we're excited", no " congrats".
    expect(created.html.toLowerCase()).not.toContain('excited');
    expect(created.html.toLowerCase()).not.toContain('congrat');
  });

  it('writes the DESIGN_SYSTEM welcome copy verbatim', () => {
    const { subject, html } = renderWelcomeEmail({ firstName: 'Ada' });
    const { subject: noNameSubject, html: noNameHtml } = renderWelcomeEmail({});
    expect(subject).toBe('Welcome to the subHalt hut!');
    expect(noNameSubject).toBe('Welcome to the subHalt hut!');
    expect(visibleText(html)).toContain('Hey friend!');
    expect(visibleText(html)).toContain('help you find missing subscriptions');
    expect(visibleText(html)).toContain('stop wasting money on forgotten subscriptions');
    expect(visibleText(html)).toContain("save money. Let's get started!");
    // The copy is fixed regardless of the resolved user name.
    expect(visibleText(noNameHtml)).toBe(visibleText(html));
  });

  it('writes the farewell copy verbatim with the sign-in link at the bottom', () => {
    const { subject, html } = renderAccountDeletedEmail();
    expect(subject).toBe('Goodbye from the subHalt hut');
    expect(visibleText(html)).toContain(
      'Hey friend! Thank you for staying in our hut for a while.'
    );
    expect(visibleText(html)).toContain(
      'We hate to see you go, we hope to have you back someday.'
    );
    expect(visibleText(html)).toContain(
      'In case you change your mind, here is the link below to sign up again.'
    );
    expect(visibleText(html)).toContain('Take care!');
    // The "link below" is the layout button, pointing at the sign-in/sign-up page.
    expect(html).toContain('https://subhalt.xyz/login');
  });
});

describe('renewal reminder wording', () => {
  it.each([
    [5, 'renews in 5 days'],
    [1, 'renews tomorrow'],
    [0, 'is due for payment'],
    [-3, 'is due for payment'],
  ])('%i days out reads as "%s"', (days, expected) => {
    const { html } = renderRenewalReminderEmail({ ...sub, daysUntilRenewal: days });
    expect(html).toContain(expected);
  });
});

describe('cadence formatting', () => {
  it.each([
    ['monthly', '$15.99 / month'],
    ['yearly', '$15.99 / year'],
    ['quarterly', '$15.99 / quarter'],
    ['weekly', '$15.99 / week'],
    ['annual', '$15.99 / year'],
  ])('renders %s as %s', (cycle, expected) => {
    const { html } = renderSubscriptionCreatedEmail({ ...sub, billingCycle: cycle });
    expect(html).toContain(expected);
  });

  it('falls back gracefully on an unknown currency', () => {
    const { html } = renderSubscriptionCreatedEmail({ ...sub, currency: 'XXXXX' });
    // Must not throw and must not emit "NaN" or an empty amount.
    expect(html).toContain('XXXXX');
    expect(html).not.toContain('NaN');
  });
});

describe('layout safety', () => {
  it('escapes untrusted values', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
    expect(escapeHtml(`Ada's "plan"`)).toContain('&#39;');
  });

  it('does not allow markup injection through a subscription name', () => {
    const { html } = renderSubscriptionCreatedEmail({
      ...sub,
      name: '<img src=x onerror=alert(1)>',
    });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('always includes a preheader for the inbox list', () => {
    const html = renderEmailLayout({
      preheader: 'Hidden preview text',
      heading: 'Heading',
      bodyHtml: '<p>Body</p>',
    });
    expect(html).toContain('Hidden preview text');
    expect(html).toContain('max-height:0');
  });
});