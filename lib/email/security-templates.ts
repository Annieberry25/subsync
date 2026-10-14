/**
 * Email copy for account-security messages: sign-in codes and magic links.
 *
 * Separate from templates.ts because these are a different job. Everything else in
 * that file is either a receipt or a note about something that already happened.
 * These two are the user proving they hold an inbox, and that changes what the
 * email has to do:
 *
 *   - The code or link is the whole point of the message, so it is rendered as the
 *     largest thing on the page rather than as a detail row.
 *   - It is left aligned with the logo and the prose. A centred code is easier to
 *     misread as part of a centred composition, and security mail from modern
 *     products reads as a column, not a poster.
 *   - Both state plainly what happens if the user did not ask for it. That is the
 *     line a recipient checks first when an unexpected code arrives, so it sits
 *     below the code rather than buried under the expiry note.
 *
 * The voice follows DESIGN_SYSTEM.md's Midnight register (see templates.ts for the
 * derivation): state the fact, then the next action. No exclamation marks.
 */

import { renderSecurityEmailLayout, emailCodeBlock, emailSecurityNote } from './layout';

export interface RenderedEmail {
  subject: string;
  html: string;
}

export interface SecurityEmailInput {
  /** Used for the greeting. Falls back to a neutral line when absent. */
  username?: string | null;
  /** How long the code or link stays valid, phrased for the reader. */
  expiresIn?: string;
  /**
   * Source for the wordmark at desktop widths, on a light background. Real sends
   * pass `cid:` references with both PNGs attached inline, because Gmail strips
   * `data:` URIs.
   */
  logoSrc?: string;
  /** Source for the wordmark at narrow viewports, on a dark background. */
  logoSrcNarrow?: string;
}

/**
 * Greeting. "Hi {name}," only when there is a name to use — an empty "Hi ," reads
 * broken, and saying nothing is better than that.
 */
function greeting(username?: string | null): string {
  const name = (username ?? '').trim();
  if (!name) return 'Hi,';
  // Escaped here rather than inside the layout because the layout escapes the
  // heading and preheader but takes body HTML as already-built markup.
  return `Hi ${name
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')},`;
}

/** 1. One-time sign-in / verification code. */
export function renderVerificationCodeEmail({
  code,
  username,
  expiresIn = '10 minutes',
  logoSrc,
  logoSrcNarrow,
}: SecurityEmailInput & { code: string }): RenderedEmail {
  const trimmed = (code ?? '').trim();
  if (!trimmed) {
    throw new Error('renderVerificationCodeEmail requires a code');
  }

  return {
    subject: `${trimmed} is your SubHalt verification code`,
    html: renderSecurityEmailLayout({
      preheader: `Your verification code is ${trimmed}. It expires in ${expiresIn}.`,
      heading: 'Verification code',
      greeting: greeting(username),
      bodyHtml: [
        emailSecurityNote(
          'Enter this code to finish signing in. It works only in the browser you requested it from.'
        ),
        emailCodeBlock(trimmed),
        emailSecurityNote(
          `This code expires in ${expiresIn}. After that, request a new one from the sign-in screen.`
        ),
      ].join(''),
      footerNote:
        'If you did not try to sign in, you can ignore this email. Nobody can use the code without it.',
      logoSrc,
      logoSrcNarrow,
    }),
  };
}

/** 2. Magic link sign-in. */
export function renderLoginLinkEmail({
  loginUrl,
  username,
  expiresIn = '10 minutes',
  logoSrc,
  logoSrcNarrow,
}: SecurityEmailInput & { loginUrl: string }): RenderedEmail {
  if (!loginUrl) {
    throw new Error('renderLoginLinkEmail requires a loginUrl');
  }

  return {
    subject: 'Your SubHalt sign-in link',
    html: renderSecurityEmailLayout({
      preheader: 'Sign in to SubHalt using the link in this email.',
      heading: 'Your login link',
      greeting: greeting(username),
      bodyHtml: [
        emailSecurityNote(
          'Use the button below to sign in. The link is unique to you and opens in whichever browser you open it in, so there is no code to copy.'
        ),
        emailCodeBlock('Sign In', {
          href: loginUrl,
          label: 'Sign In',
        }),
        emailSecurityNote(
          `This link expires in ${expiresIn}. After that, request a new one from the sign-in screen.`
        ),
      ].join(''),
      footerNote:
        'If you did not try to sign in, you can ignore this email. The link only works from this message.',
      logoSrc,
      logoSrcNarrow,
    }),
  };
}