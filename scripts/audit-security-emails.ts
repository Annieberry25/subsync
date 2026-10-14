/**
 * Throwaway: audit the rendered security emails against the design spec.
 *
 * Exists because "it looks right" is not checkable, but "no element carries a
 * dark tone", "the body declares a bgcolor" and "every visual element is inline
 * styled" are. Run after any change to the security layout.
 */
import fs from 'node:fs';

const files = ['email-preview-code.html', 'email-preview-login.html'];
let failures = 0;

function check(file: string, label: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
}

for (const file of files) {
  const h = fs.readFileSync(file, 'utf8');
  const has = (s: string) => h.includes(s);
  console.log(`\n${file}`);

  // 1. The page paints nothing; only the card does.
  const cardStart = h.indexOf('border-radius:20px');
  const cardOpen = h.lastIndexOf('<td', cardStart);
  // The <style> block legitimately declares the dark card, and the comments explain
  // the approach in prose, so strip both before asking whether the page markup
  // itself paints anything.
  const page = h
    .slice(0, cardOpen)
    .replace(/<style>[\s\S]*?<\/style>/, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  check(file, 'body declares no background', h.includes('<body style="margin:0; padding:0;">'));
  check(file, 'page paints nothing', !page.includes('background-color') && !page.includes('bgcolor'));
  check(file, 'client follows the system theme', has('<meta name="color-scheme" content="light dark">'));

  // 2. Card: no fill, grey border only, themed.
  const cardCell = h.slice(cardOpen, h.indexOf('>', cardStart));
  check(file, 'card has no fill', !cardCell.includes('background-color') && !cardCell.includes('bgcolor'));
  check(file, 'card border is light grey', cardCell.includes('border:1px solid #E5E7EB'));
  check(file, 'card keeps padding and radius', cardCell.includes('padding:34px') && cardCell.includes('border-radius:20px'));
  check(file, 'card is centred and narrower', has('max-width:560px') && has('align="center"'));
  // Nothing paints a surface anywhere, so neither palette's card colour appears.
  check(file, 'no card fill colour anywhere', !h.includes('#FFFFFF') && !h.includes('#1C2020'));

  // 3. Text, per theme.
  check(file, 'web card text #1A1D1D / #6B7280', has('color:#1A1D1D') && has('color:#6B7280'));
  check(
    file,
    'mobile swaps border and text to the dark palette at 1024px',
    has('@media screen and (max-width: 1024px)') &&
      has('.secur-card      { border-color: #2A2F2F !important; }') &&
      has('.secur-primary   { color: #F5F7F6 !important; }') &&
      has('.secur-secondary { color: #94A3B8 !important; }')
  );
  check(file, 'no min-width rule (600px never matched on mobile)', !h.includes('min-width: 601px'));

  // Every themed text node must carry the class the media query targets.
  const orphans = [...h.matchAll(/<(p|h1|div|span)\b([^>]*)style="[^"]*color:#(1A1D1D|6B7280)[^"]*"[^>]*>/gi)]
    .filter((m) => !/secur-(primary|secondary)/.test(m[2]))
    .map((m) => m[0].slice(0, 40));
  check(file, 'all themed text carries a media-query class', orphans.length === 0, orphans.join(' | '));

  check(file, 'no dark text tone anywhere', !has('#71717a') && !has('#64748B') && !has('#0e0e11'));

  // 4. Logo, inside the card so it is visible on both themes.
  check(file, 'light wordmark embedded as image', has('alt="SubHalt"') && has('data:image/png;base64,'));
  check(
    file,
    'wordmark sits above the card',
    h.indexOf('secur-logo-web') > -1 && h.indexOf('secur-logo-web') < cardStart
  );
  check(
    file,
    'wordmark swaps by viewport',
    /class="secur-logo-web"[^>]*style="display:block/.test(h) &&
      /class="secur-logo-mobile"[^>]*style="display:none/.test(h) &&
      h.includes('.secur-logo-mobile { display: block !important; }')
  );

  // 5. Button contrast. Only the magic-link email has a CTA; the code email has
  // nothing to click, so asserting a button there would be wrong.
  if (file.includes('login')) {
    check(file, 'teal accent button present', has('background:#14B8A6'));
    check(file, 'button label is "Sign In"', />\s*Sign In\s*<\/a>/.test(h));
    check(file, 'expiry note follows the button', h.indexOf('Sign In</a>') < h.indexOf('This link expires in'));
  }

  // 6. Email-safe implementation.
  check(file, '<body> declares no forced background', !/<body[^>]*\bbgcolor=/.test(h));
  check(file, 'layout is table-based', has('<table'));

  // Structural wrapper tables carry role/width/cellpadding/border and nothing to
// style, so they are exempt; anything with a visual property must be inline styled.
  const STRUCTURAL = /^(?:\s|role="presentation"|width="\d+%"|cellpadding="0"|cellspacing="0"|border="0"|align="center")*$/i;
  const unstyled = [...h.matchAll(/<(table|td|p|div|h1|img|a|body)\b([^>]*)>/gi)]
    .filter((m) => !/\sstyle=/.test(m[2]))
    .map((m) => ({ tag: m[1], attrs: m[2], raw: m[0].slice(0, 44) }))
    .filter((m) => !(m.tag.toLowerCase() === 'table' && STRUCTURAL.test(m.attrs)))
    .map((m) => m.raw);
  check(file, 'every visual element is inline styled', unstyled.length === 0, unstyled.join(' | '));
}

// Text now sits directly on the page, which follows the reader's theme, so
  // contrast depends on which theme that is. Reported for both.
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  const ratio = (a: string, b: string) => {
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  console.log('\ncard text contrast (AA body text needs 4.5:1)');
  for (const [label, fg, bg] of [
    ['mobile card  #F5F7F6 on #1C2020', '#F5F7F6', '#1C2020'],
    ['mobile card  #94A3B8 on #1C2020', '#94A3B8', '#1C2020'],
    ['web  card    #1A1D1D on #FFFFFF', '#1A1D1D', '#FFFFFF'],
    ['web  card    #6B7280 on #FFFFFF', '#6B7280', '#FFFFFF'],
  ] as const) {
    const r = ratio(fg, bg);
    check('contrast', `${label} = ${r.toFixed(2)}:1`, r >= 4.5);
  }
  const btn = ratio('#091512', '#14B8A6');
  check('contrast', `button text on accent = ${btn.toFixed(2)}:1`, btn >= 4.5);

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);