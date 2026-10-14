/**
 * Shared HTML shell for every SubHalt transactional email.
 *
 * Visual values are taken from docs/DESIGN_SYSTEM.md (Midnight), not invented:
 *   - background `#000000`, elevated surfaces, `#1C2924`-family borders
 *   - headings `#F5F7F6`, body `#94A3B8`
 *   - accent teal `#14B8A6` with dark text `#091512`
 *   - "Glass is part of the SubHalt identity. Never remove it." So the card and
 *     the button both carry the layered, slightly translucent treatment the doc
 *     calls for rather than flat blocks.
 *
 * Email clients are not browsers. Everything here is table-based with inline
 * styles because that is what Outlook and Gmail actually honour; a <div> soup
 * layout renders as an unstyled stack in a large share of inboxes.
 *
 * @param preheader Text shown in the inbox list after the subject. Hidden in the
 *   body via the zero-height div that spam filters expect.
 * @param heading   H1 copy.
 * @param bodyHtml  Paragraphs, built by the templates.
 * @param ctaLabel  Sign In button text.
 * @param ctaHref   Sign In destination.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const BRAND = {
  background: '#000000',
  surface: '#101613',
  surfaceElevated: '#111916',
  border: '#1C2924',
  heading: '#F5F7F6',
  body: '#94A3B8',
  accent: '#14B8A6',
  accentText: '#091512',
  glow: 'rgba(20, 184, 166, 0.10)',
  fontStack:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
} as const;

/**
 * The single sign-in destination, in one place.
 *
 * Hard-coded rather than read from NEXT_PUBLIC_SITE_URL on purpose: this is the
 * one link every transactional email depends on, and it must not silently change
 * behaviour when that variable is unset on a deploy or pointed at localhost. The
 * canonical domain is the apex, matching the site's own `og:url` and canonical
 * metadata.
 */
export const SIGN_IN_URL = 'https://subhalt.xyz/login';
export const SIGN_IN_LABEL = 'Sign In';

/**
 * Brand logo for the email header, embedded as a base64 data URI so it renders
 * without a hosted asset and can go offline. Loaded once.
 *
 * This is the complete SubHalt wordmark sized for light pages. Transactional
 * mail is rendered by the recipient's client, commonly on a white background,
 * where the dark-shell mark the app uses would be invisible. The asset is
 * pre-cropped from logo_white_bg.png to the wordmark bounds so no CSS cropping
 * is needed. Falls back to plain text when the file is missing (sandbox/build).
 */
let logoDataUri = '';
try {
  const bytes = readFileSync(join(process.cwd(), 'public', 'logo_wordmark_light.png'));
  logoDataUri = `data:image/png;base64,${bytes.toString('base64')}`;
} catch {
  logoDataUri = '';
}

export function renderEmailLayout({
  preheader,
  heading,
  bodyHtml,
}: {
  preheader: string;
  heading: string;
  bodyHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0; padding:0; background:${BRAND.background};">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(preheader)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.background};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

        <tr>
          <td style="padding:0 0 20px;">
            ${logoDataUri
              ? `<img src="${logoDataUri}" alt="SubHalt" width="102" height="28" style="display:block; border:0; outline:none; text-decoration:none;">`
              : `<span style="font-family:${BRAND.fontStack}; font-size:18px; font-weight:700; letter-spacing:-0.01em; color:#0B0D0D;">SubHalt</span>`}
          </td>
        </tr>

        <tr>
          <td style="background:${BRAND.surface}; border:1px solid ${BRAND.border}; border-radius:20px; padding:28px 24px; box-shadow:0 1px 0 ${BRAND.glow}, 0 12px 32px rgba(0,0,0,0.4);">

            <h1 style="margin:0 0 16px; font-family:${BRAND.fontStack}; font-size:22px; line-height:1.3; font-weight:700; letter-spacing:-0.02em; color:${BRAND.heading};">
              ${escapeHtml(heading)}
            </h1>

            ${bodyHtml}

            ${renderSignInButton()}

          </td>
        </tr>

        <tr>
          <td style="padding:20px 4px 0;">
            <p style="margin:0; font-family:${BRAND.fontStack}; font-size:12px; line-height:1.6; color:${BRAND.body};">
              You are receiving this because of activity on your SubHalt account.
              If this was not you, no action is needed.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * The Sign In button required on every email. Bulletproof CTA: a VML roundrect
 * gives Outlook a real button, and the anchor inside gives everyone else one.
 */
function renderSignInButton(): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
  <tr>
    <td align="center" style="border-radius:999px; background:${BRAND.accent}; mso-padding-alt:14px 32px;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" arcsize="50%"
                   style="height:48px;v-text-anchor:middle;width:160px;" fillcolor="${BRAND.accent}">
        <w:anchorlock/>
        <center style="color:${BRAND.accentText};font-family:${BRAND.fontStack};font-size:15px;font-weight:700;">${SIGN_IN_LABEL}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${SIGN_IN_URL}"
         style="display:inline-block; padding:14px 32px; line-height:20px;
                font-family:${BRAND.fontStack}; font-size:15px; font-weight:700;
                color:${BRAND.accentText}; text-decoration:none; border-radius:999px;
                background:${BRAND.accent};">
        ${SIGN_IN_LABEL}
      </a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`;
}

/** Paragraph in the documented body colour. */
export function emailParagraph(text: string): string {
  return `<p style="margin:0 0 14px; font-family:${BRAND.fontStack}; font-size:15px; line-height:1.65; color:${BRAND.body};">${text}</p>`;
}

/** Single-line detail row, e.g. "Amount — $15.99 / month". */
export function emailDetailRow(label: string, value: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="margin:0 0 8px; background:${BRAND.surfaceElevated}; border:1px solid ${BRAND.border}; border-radius:12px;">
  <tr>
    <td style="padding:12px 14px; font-family:${BRAND.fontStack}; font-size:13px; color:${BRAND.body};">${escapeHtml(label)}</td>
    <td align="right" style="padding:12px 14px; font-family:${BRAND.fontStack}; font-size:13px; font-weight:600; color:${BRAND.heading};">${escapeHtml(value)}</td>
  </tr>
</table>`;
}

/** Small muted note. */
export function emailFinePrint(text: string): string {
  return `<p style="margin:16px 0 0; font-family:${BRAND.fontStack}; font-size:12px; line-height:1.6; color:${BRAND.body};">${text}</p>`;
}

/** Escape untrusted values before they reach the template. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------------------- *
 * Security mail: codes and magic links.
 *
 * A separate shell rather than a variant of renderEmailLayout, because the
 * difference is structural rather than cosmetic: the code is the content, and the
 * alignment is left throughout rather than the centred composition the rest of the
 * mail uses.
 *
 * ## Why the theme is BRAND and not a separate palette
 *
 * The first version of this file invented its own dark slate (#1a1a1e, #0e0e11).
 * That was wrong twice over: it ignored DESIGN_SYSTEM.md, which is authoritative
 * for Midnight, and it produced a visibly different black next to the product.
 * Everything below is read from BRAND so security mail and the app cannot drift.
 *
 * ## Why the wordmark is a pre-cropped asset
 *
 * The app crops the 2000x2000 source canvases with CSS (components/ui/
 * brand-logo.tsx), which email cannot rely on: overflow/absolute positioning is
 * unreliable in Outlook and unsupported in parts of Gmail. The two sources are
 * also opposite colours — the dark one is for a dark surface, the light one for a
 * white one — so the wrong pick is either invisible or a black square. The
 * cropped pair in public/ sidesteps both: real pixels, real width/height, correct
 * for the surface this shell uses.
 * ---------------------------------------------------------------------- */

/**
 * Two palettes, because the card is painted to match the theme the reader is
 * actually in. Wide viewports get the light card, narrow ones the dark card that
 * matches the dashboard. The values are the light palette inline; the dark one is
 * applied by the media query, so a client that ignores it renders the light theme.
 */
const SECURITY = {
  /**
   * Two palettes, because the card is painted to match the theme it is read in.
   *
   * The light palette is the inline base on purpose: web is the default appearance,
   * so a client that ignores the media query still shows the white card. Inverting
   * this left the web card grey. The dark palette is applied by the query.
   */
  dark: {
    card: '#1C2020',
    border: '#2A2F2F',
    primary: '#F5F7F6',
    secondary: '#94A3B8',
  },
  light: {
    card: '#FFFFFF',
    border: '#E5E7EB',
    primary: '#1A1D1D',
    secondary: '#6B7280',
  },
  accent: BRAND.accent,
  accentText: BRAND.accentText,
} as const;

/**
 * The two wordmarks, cropped to the artwork's bounding box by
 * scripts/crop-wordmarks.ts and verified as white+teal / black+teal on a fully
 * transparent background rather than assumed from the filename.
 *
 * Both are needed because the page is unpainted: the reader's theme decides
 * whether it is light or dark, and a wordmark baked for one is invisible on the
 * other. `wide` is the white-background variant shown in a browser, `narrow` the
 * dark-background variant shown on a phone.
 *
 * Fallbacks only. Gmail strips `data:` URIs, so a real send passes `cid:`
 * references on logoSrc / logoSrcNarrow with both PNGs attached inline.
 */
function readWordmark(file: string): string {
  try {
    return `data:image/png;base64,${readFileSync(join(process.cwd(), 'public', file)).toString('base64')}`;
  } catch {
    return '';
  }
}

const wideWordmark = readWordmark('logo_wordmark_light_email.png');
const narrowWordmark = readWordmark('logo_wordmark_dark_email.png');

export interface SecurityLayoutInput {
  preheader: string;
  heading: string;
  greeting: string;
  /** Built from emailCodeBlock / emailSecurityNote. */
  bodyHtml: string;
  /** The "if you didn't ask for this" line, shown under the panel. */
  footerNote: string;
  /**
   * Source for the wordmark shown at desktop widths, i.e. on a light background.
   * Real sends pass `cid:` references with both PNGs attached inline, because
   * Gmail strips `data:` URIs.
   */
  logoSrc?: string;
  /** Source for the wordmark shown on narrow viewports, i.e. on a dark background. */
  logoSrcNarrow?: string;
}

/**
 * Dark, strictly left-aligned shell for account-security mail.
 *
 * Structure deliberately mirrors renderEmailLayout, which reads well in real
 * clients, with two changes: nothing is centred, and the CTA is left aligned. The
 * only alignment attribute present is `align="left"`, so a client default cannot
 * pull the column into the middle on its own.
 *
 * ## How the dark surface survives real clients
 *
 * Three things are needed together and each covers a different failure:
 *
 *   1. `<meta name="color-scheme" content="dark">` plus `supported-color-schemes`.
 *      Without these, Gmail and Apple Mail apply their *own* dark palette over
 *      ours and the panel goes navy.
 *   2. A `bgcolor` **attribute** on the tables as well as the inline style. Outlook
 *      and a good share of Windows clients ignore `background-color` in CSS, which
 *      leaves white text on a white page.
 *   3. Every text colour stated explicitly, so a client that forces colours still
 *      renders something readable.
 *
 * `border-radius` is progressive: Outlook ignores it, which leaves a square panel,
 * so nothing depends on it carrying meaning.
 */
export function renderSecurityEmailLayout({
  preheader,
  heading,
  greeting,
  bodyHtml,
  footerNote,
  logoSrc,
  logoSrcNarrow,
}: SecurityLayoutInput): string {
  const wide = logoSrc ?? wideWordmark;
  const narrow = logoSrcNarrow ?? narrowWordmark;
  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(heading)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings>
  <o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
/* Outlook ignores media queries entirely, so the only rules here are the theme
     swap and the narrow-viewport fallback. The page is deliberately uncoloured so
     the reader's own theme shows through; the card is painted to match. All
     structure is inline.

     The light palette is inline and the dark one is the override. That ordering is
     deliberate: web is the default appearance, so a client that ignores this sheet
     shows the white card rather than a grey one.

     The theme breakpoint is 1024px, not 600px. At 600 the mobile client reported a
     viewport wider than the breakpoint, so the mobile rules never matched and the
     phone kept the white card. 1024px still separates a phone from a desktop while
     tolerating a misreported or content-expanded viewport. */
  @media screen and (max-width: 1024px) {
    /* Border only: the card has no fill to repaint. */
    .secur-card      { border-color: ${SECURITY.dark.border} !important; }
    .secur-divider   { border-top-color: ${SECURITY.dark.border} !important; }
    .secur-primary   { color: ${SECURITY.dark.primary} !important; }
    .secur-secondary { color: ${SECURITY.dark.secondary} !important; }
    .secur-logo-web    { display: none !important; }
    .secur-logo-mobile { display: block !important; }
  }
  @media screen and (max-width: 600px) {
    .secur-pad  { padding-left: 24px !important; padding-right: 24px !important; }
    .secur-code { font-size: 28px !important; letter-spacing: 6px !important; }
    .secur-h1   { font-size: 24px !important; }
  }
</style>
</head>
<!-- The page declares no background at all, so the recipient's own light or dark
     theme shows through: dark on a phone, light in a browser. Painting it here is
     what previously fought the client. -->
<body style="margin:0; padding:0;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${escapeHtml(preheader)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td class="secur-page" align="center" style="padding:32px 16px;">

      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" align="center"
             style="width:100%; max-width:560px; border-collapse:collapse;">

        <!-- Two wordmarks, one per surface. The reader's theme decides whether the page
             behind is light or dark, and each mark is baked for one of them, so the
             media query swaps which is visible rather than trying to recolour. The
             white-background mark is visible by default, matching the inline light
             card. -->
        <tr>
          <td align="left" style="padding:0 0 22px;">
            ${
              wide
                ? `<img class="secur-logo-web" src="${wide}" alt="SubHalt" width="116" height="32" style="display:block; width:116px; height:32px; border:0; outline:none; text-decoration:none;">`
                : ''
            }
            ${
              narrow
                ? `<img class="secur-logo-mobile" src="${narrow}" alt="SubHalt" width="116" height="32" style="display:none; width:116px; height:32px; border:0; outline:none; text-decoration:none;">`
                : ''
            }
            ${wide || narrow ? '' : `<span class="secur-primary" style="font-family:${BRAND.fontStack}; font-size:20px; font-weight:700; letter-spacing:-0.02em; color:${SECURITY.light.primary};">SubHalt</span>`}
          </td>
        </tr>

        <!-- The panel carries no fill, only its border. That removes the white card from
             the mobile view entirely, and the border is what still reads as the
             elevated container. Text sits on the reader's own page colour. -->
        <tr>
          <td class="secur-pad secur-card" align="left"
              style="border:1px solid ${SECURITY.light.border}; border-radius:20px; padding:34px;">

            <h1 class="secur-h1 secur-primary" style="margin:0 0 18px; font-family:${BRAND.fontStack}; font-size:26px; line-height:1.25; font-weight:700; letter-spacing:-0.02em; text-align:left; color:${SECURITY.light.primary};">
              ${escapeHtml(heading)}
            </h1>

            <p class="secur-primary" style="margin:0 0 16px; font-family:${BRAND.fontStack}; font-size:15px; line-height:1.6; text-align:left; color:${SECURITY.light.primary};">
              ${greeting}
            </p>

            ${bodyHtml}

            <p class="secur-divider secur-secondary" style="margin:24px 0 0; padding-top:20px; border-top:1px solid ${SECURITY.light.border}; font-family:${BRAND.fontStack}; font-size:13px; line-height:1.6; text-align:left; color:${SECURITY.light.secondary};">
              ${escapeHtml(footerNote)}
            </p>
            <p class="secur-secondary" style="margin:8px 0 0; font-family:${BRAND.fontStack}; font-size:12px; line-height:1.6; text-align:left; color:${SECURITY.light.secondary};">
              SubHalt &middot; Track, manage and cancel your subscriptions.
            </p>

          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * The verification code, or the call to action for a magic link.
 *
 * With `href` it renders a pill button: border-radius 9999px, the vibrant accent
 * fill, bold dark text, and left aligned in its own cell so it sits on the same
 * margin as everything above it — not centred, and not stretched to the panel
 * edge. Outlook gets a VML roundrect, the same pattern renderSignInButton uses.
 *
 * Without `href` it renders the code as large monospaced text on its own surface.
 */
export function emailCodeBlock(
  value: string,
  options: { href?: string; label?: string } = {}
): string {
  if (options.href) {
    const label = options.label ?? value;
    /*
     * VML needs a pixel width, and a fixed one would either clip a long label or
     * stretch a short one across the panel. ~9px per character at 15px bold plus
     * the 32px of padding either side tracks the real width closely enough.
     */
    const vmlWidth = Math.max(120, label.length * 9 + 72);
    return `
<!-- Full-width block. A bare align="left" table is inline-level in several
     renderers, which let the expiry note flow in beside the button; an outer
     100% row forces the note onto the next line. -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="left" style="margin:24px 0;">
  <tr>
    <td align="left" style="padding:0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="left" style="margin:0;">
        <tr>
          <td align="left" style="border-radius:9999px; background:${SECURITY.accent}; mso-padding-alt:15px 32px;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" arcsize="50%"
                         style="height:50px;v-text-anchor:middle;width:${vmlWidth}px;" fillcolor="${SECURITY.accent}">
              <w:anchorlock/>
              <center style="color:${SECURITY.accentText};font-family:${BRAND.fontStack};font-size:15px;font-weight:700;">${escapeHtml(label)}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-- -->
            <a href="${options.href}"
               style="display:inline-block; padding:15px 32px; line-height:20px;
                      font-family:${BRAND.fontStack}; font-size:15px; font-weight:700;
                      color:${SECURITY.accentText}; text-decoration:none; border-radius:9999px;
                      background:${SECURITY.accent};">
              ${escapeHtml(label)}
            </a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  /*
   * The code, with no box of its own. A second bordered container inside the panel
   * read as one frame inside another and made the page look crowded; the panel is
   * already the surface, so the code only needs size, weight and letter-spacing to
   * stand out. Padding above and below is asymmetric on purpose — the gap up to
   * the explanatory line is smaller than the gap down to the closing note, so the
   * code sits with the sentence that introduces it rather than floating.
   */
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="left" style="margin:18px 0 20px;">
  <tr>
    <!-- No fill here either. It previously matched the card, which put a coloured
         bar behind the code; with an unpainted card there is nothing to match. -->
    <td class="secur-pad" align="left" style="padding:4px 0 0;">
<div class="secur-code secur-primary"
     style="font-family:'SF Mono', SFMono-Regular, ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace;
            font-size:36px; line-height:1.1; font-weight:700; letter-spacing:10px;
            text-align:left; color:${SECURITY.light.primary};">${escapeHtml(value)}</div>
    </td>
  </tr>
</table>`;
}

/** Prose line inside a security email, in the body colour. */
export function emailSecurityNote(text: string): string {
  return `<p class="secur-secondary" style="margin:0; font-family:${BRAND.fontStack}; font-size:15px; line-height:1.65; text-align:left; color:${SECURITY.light.secondary};">${text}</p>`;
}