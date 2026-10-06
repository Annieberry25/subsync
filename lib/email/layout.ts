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
            <span style="font-family:${BRAND.fontStack}; font-size:17px; font-weight:700; letter-spacing:-0.01em; color:${BRAND.heading};">
              SubHalt
            </span>
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
         style="display:inline-block; padding:14px 32px; min-height:48px; line-height:20px;
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