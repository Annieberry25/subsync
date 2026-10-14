import { describe, it, expect } from 'vitest';

import { renderVerificationCodeEmail, renderLoginLinkEmail } from '@/lib/email/security-templates';
import { renderEmailLayout, SIGN_IN_URL } from '@/lib/email/layout';

describe('security email — verification code', () => {
  it('leads with the code in the subject so it is readable in a notification', () => {
    const { subject } = renderVerificationCodeEmail({ code: '418204', username: 'Ada' });
    expect(subject).toContain('418204');
  });

  it('renders the code in the body as oversized monospaced text', () => {
    const { html } = renderVerificationCodeEmail({ code: '418204' });
    expect(html).toContain('418204');
    expect(html).toContain('letter-spacing:10px');
    expect(html).toContain('monospace');
  });

  /**
   * A bordered box inside the panel read as a frame within a frame and made the
   * page look crowded. The panel is already the surface, so the code sits directly
   * in it with no container of its own.
   */
  it('renders the code without a box inside the panel', () => {
    const { html } = renderVerificationCodeEmail({ code: '418204' });
    // No second surface and no inner border for the code.
    expect(html).not.toContain('border-radius:16px');
    expect(html).toContain('padding:4px 0 0');
  });

  it('greets by name when there is one and stays neutral when there is not', () => {
    expect(renderVerificationCodeEmail({ code: '1', username: 'Ada' }).html).toContain('Hi Ada,');
    expect(renderVerificationCodeEmail({ code: '1' }).html).toContain('Hi,');
    // A blank name must not produce an empty greeting.
    expect(renderVerificationCodeEmail({ code: '1', username: '   ' }).html).not.toContain('Hi ,');
  });

  it('states the expiry and what to do about an unexpected code', () => {
    const { html } = renderVerificationCodeEmail({ code: '418204' });
    expect(html).toContain('expires in 10 minutes');
    expect(html).toContain('ignore this email');
  });

  it('honours a custom expiry', () => {
    const { html } = renderVerificationCodeEmail({ code: '418204', expiresIn: '30 minutes' });
    expect(html).toContain('expires in 30 minutes');
  });

  it('refuses to render without a code', () => {
    expect(() => renderVerificationCodeEmail({ code: '  ' })).toThrow(/requires a code/i);
  });

  it('escapes a name that contains markup', () => {
    const { html } = renderVerificationCodeEmail({ code: '1', username: '<script>x</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  /**
   * The code row was tinted to match the card. With an unpainted card there is
   * nothing to match, so it carries no colour of its own either.
   */
  it('leaves the code row unpainted like the card', () => {
    const { html } = renderVerificationCodeEmail({ code: '418204' });
    const cell = html.match(/<td[^>]*padding:4px 0 0;">[\s\S]*?secur-code/);
    expect(cell).not.toBeNull();
    expect(cell![0]).not.toContain('bgcolor');
    expect(cell![0]).not.toContain('background-color');
    expect(html).toContain('418204');
  });
});

describe('security email — login link', () => {
  it('renders the link as a real button with a VML fallback for Outlook', () => {
    const { html } = renderLoginLinkEmail({ loginUrl: SIGN_IN_URL });
    expect(html).toContain(SIGN_IN_URL);
    expect(html).toContain('v:roundrect');
  });

  /**
   * The button read as part of the expiry sentence because both sat on one line.
   * The button has to be a block of its own for the note to drop below it.
   */
  it('keeps the button on its own line, clear of the expiry note', () => {
    const { html } = renderLoginLinkEmail({ loginUrl: SIGN_IN_URL });
    // The CTA sits inside a full-width row rather than being a bare left table,
    // which is what stops the following note flowing in beside it.
    expect(html).toMatch(/<table[^>]*width="100%"[^>]*>\s*<tr>\s*<td align="left" style="padding:0;">\s*<table/);
    // The expiry note comes after the button, not before it.
    expect(html.indexOf(SIGN_IN_URL)).toBeLessThan(html.indexOf('This link expires in'));
  });

  it('labels the button "Sign In" rather than repeating the product name', () => {
    const { html } = renderLoginLinkEmail({ loginUrl: SIGN_IN_URL });
    expect(html).toMatch(/>\s*Sign In\s*<\/a>/);
    expect(html).not.toMatch(/>\s*Sign in to SubHalt\s*<\/a>/);
  });

  /**
   * VML needs a pixel width; a fixed one would stretch a short label across the
   * panel, so the width tracks the label length.
   */
  it('sizes the VML fallback to the label rather than a fixed width', () => {
    const { html } = renderLoginLinkEmail({ loginUrl: SIGN_IN_URL });
    const width = html.match(/v-text-anchor:middle;width:(\d+)px;/);
    expect(width).not.toBeNull();
    // "Sign In" is 7 characters, so the fallback must be nowhere near 250px.
    expect(Number(width![1])).toBeLessThan(160);
  });

  it('asks for the decision rather than showing a code', () => {
    const { html } = renderLoginLinkEmail({ loginUrl: SIGN_IN_URL });
    expect(html).toContain('Your login link');
    expect(html).toContain('no code to copy');
  });

  it('refuses to render without a link', () => {
    expect(() => renderLoginLinkEmail({ loginUrl: '' })).toThrow(/requires a loginUrl/i);
  });
});

describe('security email — layout', () => {
  const { html } = renderVerificationCodeEmail({ code: '418204', username: 'Ada' });

  /**
   * Declares both schemes rather than forcing one, so the page follows the theme
   * the recipient already has instead of being repainted dark on a light client.
   */
  it('declares both colour schemes so clients follow the system theme', () => {
    expect(html).toContain('name="color-scheme" content="light dark"');
    expect(html).toContain('name="supported-color-schemes" content="light dark"');
    expect(html).not.toContain('content="dark"');
  });

  /**
   * Nothing paints the page or the card, so whatever light or dark theme the
   * recipient already has shows through both.
   */
  /**
   * The card carries no fill at all — only its border. The white container would
   * not turn grey on mobile no matter which way the query was written, so the fill
   * is gone and the elevated container is carried by the border alone.
   */
  it('gives the card no fill, only a border', () => {
    const start = html.indexOf('border-radius:20px');
    const cell = html.slice(html.lastIndexOf('<td', start), html.indexOf('>', start));
    expect(cell).not.toContain('background-color');
    expect(cell).not.toContain('bgcolor');
    expect(cell).toContain('border:1px solid #E5E7EB');
    expect(cell).toContain('border-radius:20px');
    expect(cell).toContain('padding:34px');
    // Neither palette paints a surface anywhere in the document.
    expect(html).not.toContain('#FFFFFF');
    expect(html).not.toContain('#1C2020');
  });

  /**
   * The breakpoint is 1024px, not 600px: at 600 the mobile client reported a
   * viewport wider than the breakpoint, so the mobile rules never matched.
   */
  it('swaps theme at 1024px and sizes text at 600px', () => {
    expect(html).toContain('@media screen and (max-width: 1024px)');
    expect(html).toContain('@media screen and (max-width: 600px)');
    expect(html).not.toContain('@media screen and (min-width: 601px)');
    expect(html).toContain('.secur-card      { border-color: #2A2F2F !important; }');
    expect(html).toContain('.secur-primary   { color: #F5F7F6 !important; }');
    expect(html).toContain('.secur-secondary { color: #94A3B8 !important; }');
    expect(html).toContain('.secur-divider   { border-top-color: #2A2F2F !important; }');
  });

  /**
   * Inline styles beat a stylesheet unless the override is !important, so any
   * themed text missing its class would silently keep the light-palette colour on
   * the dark page. This is the guard for that.
   */
  it('gives every themed text node the class the media query targets', () => {
    const orphans = [...html.matchAll(/<(p|h1|div|span)\b([^>]*)style="[^"]*color:#(1A1D1D|6B7280)[^"]*"[^>]*>/gi)]
      .filter((m) => !/secur-(primary|secondary)/.test(m[2]))
      .map((m) => m[0].slice(0, 40));
    expect(orphans).toEqual([]);
  });

  /**
   * The page paints nothing at all, so whatever light or dark theme the recipient
   * already has is what shows through: dark on a phone, light in a browser.
   * Declaring a colour here is what previously fought the client.
   */
  it('leaves the page background unpainted so the client theme shows through', () => {
    expect(html).toContain('<body style="margin:0; padding:0;">');
    // No background colour anywhere outside the card itself, ignoring the
    // stylesheet, which legitimately declares the dark card for the media query.
    const cardStart = html.lastIndexOf('<td', html.indexOf('border-radius:20px'));
    const before = html.slice(0, cardStart).replace(/<style>[\s\S]*?<\/style>/, '');
    expect(before).not.toContain('background-color');
    expect(before).not.toMatch(/bgcolor="/i);
    // The client is told to follow the system rather than a forced scheme.
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
  });

  /** The card keeps the Midnight surface in both themes. */
  /** Text tones are unchanged by the card losing its fill. */
  it('keeps the text tones the brief specified', () => {
    expect(html).toContain('color:#1A1D1D');
    expect(html).toContain('color:#6B7280');
    expect(html).toContain('color: #F5F7F6');
    expect(html).toContain('color: #94A3B8');
  });

  /**
   * The card is a bordered outline rather than a filled container, so nothing
   * paints a white or grey surface behind the text.
   */
  it('paints no surface behind the card', () => {
    const start = html.indexOf('border-radius:20px');
    expect(start).toBeGreaterThan(-1);
    const cell = html.slice(html.lastIndexOf('<td', start), html.indexOf('>', start));
    expect(cell).not.toContain('background-color');
    expect(cell).not.toContain('bgcolor');
    expect(cell).toContain('padding:34px');
  });

  /**
   * Nothing may be dark-on-dark. The previous footer colour #71717a measured
   * 3.40:1 on this card, under the 4.5:1 AA floor for body text; #94A3B8 is
   * 6.41:1. Text is pinned so the muted tone cannot drift back down.
   */
  /** Contrast floor for the tones in force; see the ratios in the audit script. */
  it('keeps every text tone readable', () => {
    // Web: #1A1D1D on #FFFFFF is 16.97:1, #6B7280 on #FFFFFF is 4.83:1.
    // Mobile: #F5F7F6 on #1C2020 is 15.29:1, #94A3B8 on #1C2020 is 6.41:1.
    expect(html).toContain('color:#1A1D1D');
    expect(html).toContain('color:#6B7280');
    expect(html).toContain('#F5F7F6');
    expect(html).toContain('#94A3B8');
    // The earlier #71717a was 3.40:1 and must not come back.
    expect(html).not.toContain('#71717a');
    expect(html).not.toContain('#64748B');
  });

  /**
   * The app crops the 2000x2000 source logos with CSS, which email cannot do, so
   * the shell uses a pre-cropped 1103x303 asset. The light-on-white source is the
   * wrong one here and would be invisible.
   */
  it('uses the cropped dark wordmark, not the white-page one', () => {
    // Embedded as a data URI for local preview only; real sends override this.
    expect(html).toContain('alt="SubHalt"');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toMatch(/width:116px; height:32px/);
  });

  /**
   * Gmail strips `data:` URIs from image sources, so a real send must reference
   * the inline attachments by cid. The data URI fallback rendered as nothing in
   * both Gmail web and the Gmail app.
   *
   * Two are sent: the page is unpainted, so the reader's theme decides whether it
   * is light or dark, and each wordmark is baked for one of those.
   */
  it('lets the caller point both wordmarks at inline cid attachments', () => {
    const cid = renderLoginLinkEmail({
      loginUrl: SIGN_IN_URL,
      logoSrc: 'cid:subhalt-wordmark-light',
      logoSrcNarrow: 'cid:subhalt-wordmark-dark',
    });
    expect(cid.html).toContain('src="cid:subhalt-wordmark-light"');
    expect(cid.html).toContain('src="cid:subhalt-wordmark-dark"');
    expect(cid.html).not.toContain('data:image/png;base64,');

    const code = renderVerificationCodeEmail({
      code: '418204',
      logoSrc: 'cid:subhalt-wordmark-light',
      logoSrcNarrow: 'cid:subhalt-wordmark-dark',
    });
    expect(code.html).toContain('src="cid:subhalt-wordmark-light"');
    expect(code.html).toContain('src="cid:subhalt-wordmark-dark"');
  });

  /**
   * The white-background wordmark shows in a browser and the dark-background one
   * on a phone. Both are in the markup; the media query decides which is visible,
   * because an image's baked colours cannot be changed by CSS. The white-background
   * mark is visible by default, matching the inline light card.
   */
  it('swaps the wordmark by viewport so each matches its background', () => {
    expect(html).toMatch(/class="secur-logo-web"[^>]*style="display:block/);
    expect(html).toMatch(/class="secur-logo-mobile"[^>]*style="display:none/);
    expect(html).toContain('.secur-logo-web    { display: none !important; }');
    expect(html).toContain('.secur-logo-mobile { display: block !important; }');
    const web = html.match(/class="secur-logo-web" src="([^"]+)"/);
    const mobile = html.match(/class="secur-logo-mobile" src="([^"]+)"/);
    expect(web).not.toBeNull();
    expect(mobile).not.toBeNull();
    expect(web![1]).not.toBe(mobile![1]);
  });

  /**
   * The card is centred in the viewport, but everything inside it is left aligned.
   * The centring applies to the column, not to its contents.
   */
  it('centres the card but keeps its contents left aligned', () => {
    expect(html).toContain('max-width:560px');
    expect(html).toContain('align="center"');
    // Nothing inside the card is centred.
    expect(html).not.toContain('text-align:center');
    const card = html.slice(html.indexOf('border-radius:20px'));
    expect(card).toContain('align="left"');
    expect(card).toContain('text-align:left');
  });

  it('sizes the card at 560px and pads it generously', () => {
    expect(html).toContain('max-width:560px');
    expect(html).toContain('padding:34px;');
  });

  /**
   * The CTA brief: pill, left aligned inside the card, not centred and not full
   * width. The card around it is centred, which is a different element.
   */
  it('renders the CTA as a left-aligned pill in the vibrant accent', () => {
    const link = renderLoginLinkEmail({ loginUrl: SIGN_IN_URL }).html;

    expect(link).toContain('border-radius:9999px');
    expect(link).toContain('background:#14B8A6');
    expect(link).toContain('font-weight:700');
    expect(link).toContain('color:#091512');

    // The button lives in its own left-aligned cell, so it neither floats in the
    // middle of the panel nor stretches to its edges.
    const buttonCell = link.slice(link.indexOf('border-radius:9999px') - 400);
    expect(buttonCell).toContain('align="left"');
    expect(buttonCell).not.toContain('width:100%');
    // The button itself is never centred, only the card containing it.
    expect(link.slice(link.indexOf('border-radius:9999px') - 400)).not.toContain('text-align:center');
  });

  /**
   * The wordmark sits above the card, on the page, rather than inside the detail
   * container.
   */
  it('puts the brand above the card, outside it', () => {
    const brandIndex = html.indexOf('secur-logo-web');
    const cardIndex = html.indexOf('border-radius:20px');
    const headingIndex = html.indexOf('<h1');
    expect(brandIndex).toBeGreaterThan(-1);
    expect(brandIndex).toBeLessThan(cardIndex);
    expect(cardIndex).toBeLessThan(headingIndex);
    expect(html).toContain('padding:0 0 22px');
  });

  it('uses a modern sans-serif stack throughout', () => {
    expect(html).toContain('-apple-system');
    expect(html).toContain('BlinkMacSystemFont');
  });

  it('has a responsive fallback for narrow viewports', () => {
    expect(html).toContain('@media screen and (max-width: 600px)');
    expect(html).toContain('.secur-code { font-size: 28px !important;');
  });

  /** Both palettes are declared; the dark one lives in the media query. */
  it('states every colour explicitly so a colour-forcing client stays readable', () => {
    expect(html).toContain('color:#1A1D1D');
    expect(html).toContain('color:#6B7280');
    // Spaced form: these come from the media query, not inline.
    expect(html).toContain('color: #F5F7F6');
    expect(html).toContain('color: #94A3B8');
  });

  it('hides the preheader from the body but keeps it in the markup', () => {
    expect(html).toMatch(/display:none; max-height:0; overflow:hidden/);
    expect(html).toContain('Your verification code is 418204');
  });

  it('keeps the legacy light-shell layout working alongside it', () => {
    // The two shells are separate on purpose; one must not regress the other.
    expect(renderEmailLayout({ preheader: 'x', heading: 'y', bodyHtml: '' })).toContain('<html lang="en">');
  });
});