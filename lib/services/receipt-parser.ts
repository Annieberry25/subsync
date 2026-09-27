/**
 * Deterministic receipt text parser — the single source of truth for receipt
 * extraction across every import path (file upload, PDF text layer, image OCR,
 * Gmail discovery, forwarded email).
 *
 * Design rules, in priority order:
 *
 *  1. Never invent data. A field the receipt does not state is returned as
 *     `null` with confidence `none`. We do not guess a renewal date.
 *  2. Every field carries a confidence level and human-readable evidence
 *     (`label "Total due"`, `symbol $`, `provider registry match`) so the UI
 *     can tell the user which values are trustworthy.
 *  3. All keyword matching is boundary-aware. `"aws"` must not match inside
 *     `"laws"`, `"glo"` must not match inside `"Global"`, and the bare `"n"`
 *     naira prefix must not match the `"n"` in `"on 15 August"`.
 *  4. Amounts are label-anchored and ranked, so a `Total:` line beats a
 *     `Subtotal:` or `Tax:` line, and a phone number never becomes a price.
 *  5. Dates are ranked by the label that precedes them, and every date is
 *     validated by round-tripping through `Date`, so `2026-13-45` is rejected
 *     rather than persisted.
 *
 * This module is pure: no I/O, no environment access, no framework imports.
 * That keeps it exhaustively unit-testable — see
 * `lib/services/__tests__/receipt-parser.test.ts`.
 */
import { PROVIDER_REGISTRY } from '@/lib/constants/provider-registry';
import { STANDARD_BILL_CATEGORIES } from '@/lib/types/bills.types';
import { mapBillCategoryToSubscriptionCategory } from '@/lib/services/receipt-discovery';

export type ReceiptKind = 'subscription' | 'bill';

export type FieldConfidence = 'high' | 'medium' | 'low' | 'none';

export type BillingCycle =
  | 'monthly'
  | 'yearly'
  | 'weekly'
  | 'quarterly'
  | 'one_time'
  | 'unknown';

export type SubscriptionCategory =
  | 'Streaming'
  | 'Software'
  | 'Utilities'
  | 'Fitness'
  | 'Finance'
  | 'Education'
  | 'Gaming'
  | 'Other';

export interface ReceiptField<T> {
  value: T;
  confidence: FieldConfidence;
  /** Short provenance string, e.g. `label "Total due"` or `symbol $`. */
  evidence: string;
}

export interface ReceiptExtraction {
  kind: ReceiptKind;
  providerName: ReceiptField<string | null>;
  amount: ReceiptField<number | null>;
  currency: ReceiptField<string | null>;
  /** When the money was actually paid. */
  paymentDate: ReceiptField<string | null>;
  /** When the subscription/period next renews. */
  nextBillingDate: ReceiptField<string | null>;
  billingCycle: ReceiptField<BillingCycle>;
  category: ReceiptField<string | null>;
  providerReference: ReceiptField<string | null>;
  plan: ReceiptField<string | null>;
  region: ReceiptField<string | null>;
  providerUrl: ReceiptField<string | null>;
  /** Human-readable cautions to surface in the review step. */
  warnings: string[];
}

/* -------------------------------------------------------------------------- */
/* Boundary-aware phrase matching                                              */
/* -------------------------------------------------------------------------- */

const WORD_CLASS = '\\p{L}\\p{N}_';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a matcher that only fires on whole words / whole phrases. Lookarounds
 * are applied per-side, because a phrase like `/mo` legitimately follows a
 * digit (`"$15/mo"`) while a phrase like `aws` must not follow a letter.
 */
function phraseRegex(phrase: string): RegExp {
  const startsWithWord = new RegExp(`^[${WORD_CLASS}]`, 'u').test(phrase);
  const endsWithWord = new RegExp(`[${WORD_CLASS}]$`, 'u').test(phrase);
  return new RegExp(
    (startsWithWord ? `(?<![${WORD_CLASS}])` : '') +
      escapeRegExp(phrase) +
      (endsWithWord ? `(?![${WORD_CLASS}])` : ''),
    'iu'
  );
}

/** True when `phrase` appears in `text` as a standalone word or phrase. */
export function hasPhrase(text: string, phrase: string): boolean {
  if (!text || !phrase) return false;
  return phraseRegex(phrase).test(text);
}

/** Index of the first standalone occurrence of `phrase`, or -1. */
function indexOfPhrase(text: string, phrase: string): number {
  if (!text || !phrase) return -1;
  const match = phraseRegex(phrase).exec(text);
  return match ? match.index : -1;
}

/** All standalone occurrences of `phrase`. */
function allPhraseMatches(text: string, phrase: string): number[] {
  if (!text || !phrase) return [];
  const re = new RegExp(phraseRegex(phrase).source, 'giu');
  const out: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    out.push(match.index);
    if (match.index === re.lastIndex) re.lastIndex += 1;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Currency                                                                    */
/* -------------------------------------------------------------------------- */

const CURRENCY_SYMBOLS: Record<string, string> = {
  '₦': 'NGN',
  '₹': 'INR',
  '₽': 'RUB',
  '¥': 'JPY',
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  R$: 'BRL',
};

const CURRENCY_CODES = ['NGN', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'ZAR', 'INR', 'BRL', 'RUB'];

const CURRENCY_CODE_ALTERNATION = CURRENCY_CODES.join('|');

/** Currency code for a token prefix/suffix, or null. */
function currencyFromToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (CURRENCY_SYMBOLS[trimmed]) return CURRENCY_SYMBOLS[trimmed];
  const upper = trimmed.toUpperCase();
  // Bare "N" only counts as naira when it is a standalone prefix, which the
  // caller guarantees via the lookbehind in the money pattern.
  if (upper === 'N') return 'NGN';
  if (CURRENCY_CODES.includes(upper)) return upper;
  return null;
}

/**
 * Detects a document-level currency hint. Used only as a fallback when the
 * winning amount token carries no currency of its own.
 */
function detectDocumentCurrency(text: string): { code: string | null; evidence: string } {
  for (const code of CURRENCY_CODES) {
    if (hasPhrase(text, code)) return { code, evidence: `code ${code}` };
  }
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(symbol)) return { code, evidence: `symbol ${symbol}` };
  }
  if (hasPhrase(text, 'naira')) return { code: 'NGN', evidence: 'word "naira"' };
  if (hasPhrase(text, 'usd')) return { code: 'USD', evidence: 'word "usd"' };
  return { code: null, evidence: '' };
}

/* -------------------------------------------------------------------------- */
/* Amounts                                                                     */
/* -------------------------------------------------------------------------- */

interface AmountLabel {
  phrase: string;
  /** 4 = definitive total, 3 = likely total, 2 = subtotal/price. */
  tier: number;
}

/** Ordered longest-first within each tier so "total due" beats "total". */
const AMOUNT_LABELS: AmountLabel[] = [
  { phrase: 'total amount due', tier: 4 },
  { phrase: 'total amount payable', tier: 4 },
  { phrase: 'total payment due', tier: 4 },
  { phrase: 'amount payable', tier: 4 },
  { phrase: 'balance due', tier: 4 },
  { phrase: 'total due', tier: 4 },
  { phrase: 'grand total', tier: 4 },
  { phrase: 'total charged', tier: 4 },
  { phrase: 'total payment', tier: 4 },
  { phrase: 'total paid', tier: 4 },
  { phrase: 'payment total', tier: 4 },
  { phrase: 'amount paid', tier: 4 },
  { phrase: 'payment made', tier: 4 },
  { phrase: 'you paid', tier: 4 },
  { phrase: 'total cost', tier: 4 },
  { phrase: 'charged amount', tier: 4 },
  // A bare "Total:" line is the definitive figure on a receipt. This cannot
  // collide with "Subtotal" because the matcher is boundary-aware.
  { phrase: 'total', tier: 4 },
  { phrase: 'amount', tier: 3 },
  { phrase: 'charged', tier: 3 },
  { phrase: 'paid', tier: 3 },
  { phrase: 'cost', tier: 3 },
  { phrase: 'net pay', tier: 3 },
  { phrase: 'subtotal', tier: 2 },
  { phrase: 'sub total', tier: 2 },
  { phrase: 'sub-total', tier: 2 },
  { phrase: 'net amount', tier: 2 },
  { phrase: 'base amount', tier: 2 },
  { phrase: 'subscription price', tier: 2 },
  { phrase: 'plan price', tier: 2 },
  { phrase: 'price', tier: 2 },
];

/**
 * Labels that mark a neighbouring number as *not* the amount owed. A token
 * near one of these is heavily penalised but still usable as a last resort.
 */
const AMOUNT_EXCLUSIONS = [
  'vat',
  'tax',
  'discount',
  'coupon',
  'promo code',
  'tip',
  'gratuity',
  'change due',
  'cash received',
  'you saved',
  'savings',
  'loyalty points',
  'points earned',
  'balance forward',
  'minimum payment',
  'minimum charge',
  'valid until',
  'expiry',
];

/**
 * Labels that mark a neighbouring number as an identity/identifier rather than
 * money. Tokens near these are rejected outright.
 */
const IDENTITY_LABELS = [
  'invoice no',
  'invoice number',
  'invoice #',
  'invoice id',
  'order no',
  'order number',
  'order id',
  'order #',
  'receipt no',
  'receipt number',
  'receipt #',
  'reference no',
  'reference number',
  'transaction id',
  'transaction no',
  'txn id',
  'txn no',
  'ref no',
  'ref:',
  'account no',
  'account number',
  'meter no',
  'meter number',
  'meter reading',
  'phone',
  'tel',
  'mobile',
  'customer id',
  'customer no',
  'page',
  'quantity',
  'qty',
  'item no',
  'card no',
  'last four',
  'auth code',
  'approval code',
];

interface MoneyToken {
  start: number;
  end: number;
  value: number;
  raw: string;
  prefixCurrency: string | null;
  suffixCurrency: string | null;
  lineText: string;
  offsetInLine: number;
  hasGrouping: boolean;
  hasDecimals: boolean;
  hasExclusion: boolean;
  hasIdentity: boolean;
  moneyLabel: AmountLabel | null;
  labelAfter: boolean;
  labelDistance: number;
}

/**
 * Normalises a digit run such as `1,234.56` / `1.234,56` / `1 234,56` into a
 * number, reporting whether grouping separators were used.
 */
function parseNumericRun(run: string): { value: number; hasGrouping: boolean; hasDecimals: boolean } | null {
  const cleaned = run.replace(/[\u00a0\u202f\s]/g, '').replace(/[.,]+$/, '');
  if (!cleaned || !/^\d/.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized: string;

  if (lastComma >= 0 && lastDot >= 0) {
    // Rightmost separator is the decimal point.
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // A single comma is grouping only when it groups exactly three digits.
    normalized = /^\d{1,3}(?:,\d{3})+$/.test(cleaned) ? cleaned.replace(/,/g, '') : cleaned.replace(',', '.');
  } else if (lastDot >= 0) {
    normalized = /^\d{1,3}(?:\.\d{3})+$/.test(cleaned) ? cleaned.replace(/\./g, '') : cleaned;
  } else {
    normalized = cleaned;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;

  return {
    value,
    hasGrouping: /[,\u00a0\u202f]/.test(run) || /^\d{1,3}(?:\.\d{3})+$/.test(cleaned),
    hasDecimals: /\.\d+$/.test(normalized) || /,\d{1,2}$/.test(cleaned),
  };
}

/**
 * Scans the document for money tokens. The bare `N` naira prefix is guarded by
 * a lookbehind so `"on 15 August"` can never be read as "naira 15".
 */
function scanMoneyTokens(text: string): MoneyToken[] {
  const prefix = `(?:(?<![\\p{L}\\p{N}])(?:N)|₦|₹|₽|¥|R\\$|\\$|€|£|${CURRENCY_CODE_ALTERNATION})`;
  const number = '(?:\\d{1,3}(?:[,\\u00a0\\u202f]\\d{3})+(?:[.,]\\d{1,2})?|\\d+[.,]\\d{1,2}|\\d+)';
  const re = new RegExp(
    `(${prefix})?[ \\t]*(${number})[ \\t]*(?:(${CURRENCY_CODE_ALTERNATION})\\b)?`,
    'giu'
  );

  const tokens: MoneyToken[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const numberRaw = match[2];
    if (!numberRaw) continue;
    const start = match.index;
    const end = start + match[0].length;

    // A code we already consumed as a prefix must not be re-read as the number.
    if (/^(?:USD|EUR|GBP|CAD|AUD|JPY|ZAR|INR|BRL|RUB|NGN)$/i.test(numberRaw)) continue;

    const parsed = parseNumericRun(numberRaw);
    if (!parsed) continue;
    if (parsed.value <= 0) continue;

    const lineStart = text.lastIndexOf('\n', start) + 1;
    const lineEndIndex = text.indexOf('\n', end);
    const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
    const lineText = text.slice(lineStart, lineEnd);
    const offsetInLine = start - lineStart;

    const before = lineText.slice(0, offsetInLine);
    const after = lineText.slice(offsetInLine + match[0].length);

    const moneyLabel = nearestAmountLabel(before);
    const labelAfterMatch = moneyLabel ? null : nearestAmountLabel(after, 18);
    const hasExclusion = AMOUNT_EXCLUSIONS.some((phrase) => hasPhrase(before.slice(-32), phrase));
    const hasIdentity = IDENTITY_LABELS.some((phrase) => hasPhrase(before.slice(-28), phrase));

    tokens.push({
      start,
      end,
      value: parsed.value,
      raw: numberRaw,
      prefixCurrency: match[1] ? currencyFromToken(match[1]) : null,
      suffixCurrency: match[3] ? currencyFromToken(match[3]) : null,
      lineText,
      offsetInLine,
      hasGrouping: parsed.hasGrouping,
      hasDecimals: parsed.hasDecimals,
      hasExclusion,
      hasIdentity,
      moneyLabel: moneyLabel ?? labelAfterMatch ?? null,
      labelAfter: !moneyLabel && Boolean(labelAfterMatch),
      labelDistance: moneyLabel ? before.length : (labelAfterMatch ? after.indexOf(labelAfterMatch.phrase) : 999),
    });
  }

  return tokens;
}

function nearestAmountLabel(before: string, window = 40): AmountLabel | null {
  const scope = before.slice(-window);
  let best: { label: AmountLabel; index: number } | null = null;
  for (const label of AMOUNT_LABELS) {
    const idx = indexOfPhrase(scope, label.phrase);
    if (idx === -1) continue;
    if (!best || label.phrase.length > best.label.phrase.length) {
      best = { label, index: idx };
    }
  }
  return best ? best.label : null;
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const MONTH_ALTERNATION = MONTH_NAMES.map((m) => m.slice(0, 3)).join('|');
const MONTH_LOOKUP: Record<string, number> = {};
MONTH_NAMES.forEach((name, i) => {
  MONTH_LOOKUP[name] = i;
  MONTH_LOOKUP[name.slice(0, 3)] = i;
});

/** Validates a calendar date by round-tripping, so 2026-13-45 is rejected. */
function toIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1990 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeYear(year: number): number {
  if (year >= 1000) return year;
  return year >= 90 ? 1900 + year : 2000 + year;
}

type DateRole = 'next_billing' | 'payment' | 'invoice' | 'none';

const NEXT_BILLING_LABELS = [
  'next billing date',
  'next billing',
  'next charge date',
  'next charge',
  'next payment date',
  'next payment',
  'next renewal date',
  'next renewal',
  'renewal date',
  'renews on',
  'renew on',
  'renews',
  'trial ends on',
  'trial ends',
  'trial end date',
  'free until',
  'valid until',
  'valid thru',
  'ends on',
  'expires on',
  'expiry date',
];

const PAYMENT_LABELS = [
  'payment date',
  'date of payment',
  'date paid',
  'paid on',
  'payment received',
  'received on',
  'transaction date',
  'date of transaction',
  'purchase date',
  'payment timestamp',
  'debit date',
  'value date',
  'postpaid',
  'prepaid',
];

/** Issue/billing-period dates: acceptable only when nothing better exists. */
const INVOICE_LABELS = [
  'invoice date',
  'date of issue',
  'issue date',
  'issued on',
  'billing period',
  'billing period start',
  'order date',
  'dated',
  'statement date',
  'period from',
  'from',
];

interface DateCandidate {
  iso: string;
  start: number;
  end: number;
  role: DateRole;
  evidence: string;
  ambiguousOrder: boolean;
  inPeriodLine: boolean;
}

function classifyDateLabel(before: string): { role: DateRole; evidence: string } {
  const scope = before.slice(-48);
  const find = (labels: string[]): string | null => {
    let best: { phrase: string; index: number } | null = null;
    for (const phrase of labels) {
      const idx = indexOfPhrase(scope, phrase);
      if (idx === -1) continue;
      if (!best || phrase.length > best.phrase.length) best = { phrase, index: idx };
    }
    return best ? best.phrase : null;
  };
  const next = find(NEXT_BILLING_LABELS);
  if (next) return { role: 'next_billing', evidence: `label "${next}"` };
  const paid = find(PAYMENT_LABELS);
  if (paid) return { role: 'payment', evidence: `label "${paid}"` };
  const invoice = find(INVOICE_LABELS);
  if (invoice) return { role: 'invoice', evidence: `label "${invoice}"` };
  return { role: 'none', evidence: '' };
}

function collectDateCandidates(text: string): DateCandidate[] {
  const found: DateCandidate[] = [];
  const seen = new Set<string>();

  const push = (iso: string | null, start: number, end: number, ambiguous = false) => {
    if (!iso) return;
    const key = `${start}:${end}`;
    if (seen.has(key)) return;
    seen.add(key);
    const before = text.slice(Math.max(0, start - 48), start);
    const { role, evidence } = classifyDateLabel(before);
    const lineStart = text.lastIndexOf('\n', start) + 1;
    const lineEndIndex = text.indexOf('\n', end);
    const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
    const lineText = text.slice(lineStart, lineEnd);
    found.push({
      iso,
      start,
      end,
      role,
      evidence,
      ambiguousOrder: ambiguous,
      inPeriodLine: hasPhrase(lineText, 'period') || hasPhrase(lineText, 'valid from'),
    });
  };

  // 1. ISO-ish: 2026-08-25 / 2026/08/25 / 2026.08.25
  const isoRe = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = isoRe.exec(text)) !== null) {
    push(toIsoDate(Number(m[1]), Number(m[2]), Number(m[3])), m.index, m.index + m[0].length);
  }

  // 2. 25 August 2026 / 25th Aug 2026
  const dayMonthRe = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?[ \\t]+(${MONTH_ALTERNATION})[a-z]*\\.?[,]?[ \\t]+(\\d{2,4})\\b`,
    'gi'
  );
  while ((m = dayMonthRe.exec(text)) !== null) {
    const month = MONTH_LOOKUP[m[2].toLowerCase()];
    push(toIsoDate(normalizeYear(Number(m[3])), month + 1, Number(m[1])), m.index, m.index + m[0].length);
  }

  // 3. August 25, 2026 / Aug 25 2026
  const monthDayRe = new RegExp(
    `\\b(${MONTH_ALTERNATION})[a-z]*\\.?[ \\t]+(\\d{1,2})(?:st|nd|rd|th)?[,]?[ \\t]+(\\d{2,4})\\b`,
    'gi'
  );
  while ((m = monthDayRe.exec(text)) !== null) {
    const month = MONTH_LOOKUP[m[1].toLowerCase()];
    push(toIsoDate(normalizeYear(Number(m[3])), month + 1, Number(m[2])), m.index, m.index + m[0].length);
  }

  // 4. Numeric 25/08/2026 — day-first is the default because the primary
  // markets for this app (Nigeria, UK, EU) write dates that way. When both
  // components are <= 12 the ordering cannot be proven, so it is flagged.
  const numericRe = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g;
  while ((m = numericRe.exec(text)) !== null) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let ambiguous = false;
    const year = normalizeYear(Number(m[3]));
    let month: number;
    let day: number;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b;
      ambiguous = true;
    }
    push(toIsoDate(year, month, day), m.index, m.index + m[0].length, ambiguous);
  }

  return found.sort((x, y) => x.start - y.start);
}

/* -------------------------------------------------------------------------- */
/* Provider, category, cycle, reference, plan, region, url                    */
/* -------------------------------------------------------------------------- */

const SUBSCRIPTION_BRANDS: Array<{ name: string; aliases: string[] }> = [
  { name: 'Netflix', aliases: ['netflix'] },
  { name: 'Spotify', aliases: ['spotify'] },
  { name: 'Disney+', aliases: ['disney+', 'disney plus'] },
  { name: 'Amazon Prime', aliases: ['amazon prime', 'prime video'] },
  { name: 'YouTube Premium', aliases: ['youtube premium', 'youtube music'] },
  { name: 'Apple', aliases: ['apple.com', 'apple one', 'applecare', 'itunes', 'icloud+'] },
  { name: 'Google One', aliases: ['google one', 'google storage', 'google cloud storage'] },
  { name: 'ChatGPT Plus', aliases: ['chatgpt', 'openai'] },
  { name: 'Adobe Creative Cloud', aliases: ['adobe creative cloud', 'creative cloud'] },
  { name: 'GitHub Pro', aliases: ['github pro', 'github copilot'] },
  { name: 'PlayStation Plus', aliases: ['playstation plus', 'playstation store'] },
  { name: 'Xbox Game Pass', aliases: ['xbox game pass', 'game pass'] },
  { name: 'Midjourney', aliases: ['midjourney'] },
  { name: 'Notion', aliases: ['notion'] },
  { name: 'Figma', aliases: ['figma'] },
  { name: 'Slack', aliases: ['slack'] },
  { name: 'Zoom', aliases: ['zoom'] },
  { name: 'Dropbox', aliases: ['dropbox'] },
  { name: 'Audible', aliases: ['audible'] },
  { name: 'Canva', aliases: ['canva'] },
  { name: 'Linear', aliases: ['linear.app'] },
];

const BILL_CATEGORY_KEYWORDS: Array<{ category: (typeof STANDARD_BILL_CATEGORIES)[number]; keys: string[] }> = [
  {
    category: 'Electricity',
    keys: ['electricity', 'electric', 'disco', 'prepaid token', 'energy bill', 'power bill', 'kwh', 'tarrif', 'tariff'],
  },
  {
    category: 'Internet',
    keys: ['internet', 'broadband', 'fiber', 'fibre', 'data bundle', 'wifi', '4g lte', 'home internet'],
  },
  {
    category: 'Airtime / Mobile Data',
    keys: ['airtime', 'recharge', 'mobile data', 'data subscription', 'talk time', 'ussd'],
  },
  {
    category: 'TV / Streaming',
    keys: ['dstv', 'gotv', 'startimes', 'tv licence', 'tv license', 'cable tv', 'subscription tv', 'streaming'],
  },
  {
    category: 'Rent / Housing',
    keys: ['rent', 'rental', 'tenancy', 'apartment', 'lease payment', 'housing'],
  },
  {
    category: 'Insurance',
    keys: ['insurance', 'policy premium', 'premium payment', 'life cover'],
  },
  {
    category: 'Education',
    keys: ['tuition', 'school fees', 'waec', 'jamb', 'university fees', 'course fee', 'academy'],
  },
  {
    category: 'Software / Digital Services',
    keys: ['software', 'saas', 'subscription fee', 'hosting', 'domain name', 'cloud services'],
  },
  {
    category: 'Membership',
    keys: ['membership', 'gym', 'fitness', 'club dues'],
  },
  {
    category: 'Utilities',
    keys: ['water', 'waste', 'refuse', 'sanitation', 'security services', 'electricity bill'],
  },
];

const SUBSCRIPTION_CATEGORY_KEYWORDS: Array<{ category: SubscriptionCategory; keys: string[] }> = [
  { category: 'Gaming', keys: ['gaming', 'playstation', 'xbox', 'nintendo', 'steam games', 'game pass', 'game library'] },
  {
    category: 'Streaming',
    keys: ['streaming', 'netflix', 'spotify', 'youtube premium', 'disney+', 'disney plus', 'prime video', 'hulu', 'apple tv', 'audible'],
  },
  {
    category: 'Software',
    keys: ['software', 'saas', 'adobe', 'github', 'chatgpt', 'openai', 'figma', 'notion', 'slack', 'zoom', 'cloud storage', 'aws', 'amazon web services', 'canva', 'linear', 'dropbox'],
  },
  {
    category: 'Fitness',
    keys: ['gym', 'fitness', 'workout', 'crossfit', 'health club', 'membership'],
  },
  {
    category: 'Finance',
    keys: ['banking', 'insurance', 'investment', 'loan', 'credit card', 'finance'],
  },
  {
    category: 'Education',
    keys: ['tuition', 'education', 'course', 'university', 'udemy', 'coursera', 'duolingo', 'masterclass', 'school'],
  },
  {
    category: 'Utilities',
    keys: ['utility', 'storage', 'cloud hosting', 'domain', 'sim card', 'telecom'],
  },
];

const REGIONS: Array<{ label: string; keys: string[] }> = [
  { label: 'Lagos', keys: ['lagos', 'ikeja', 'lekki', 'victoria island', 'yaba', 'surulere', 'apapa'] },
  { label: 'Abuja (FCT)', keys: ['abuja', 'fct', 'gwagwalada', 'wuse'] },
  { label: 'Rivers', keys: ['port harcourt', 'rivers state', 'obio akpor'] },
  { label: 'Oyo', keys: ['ibadan', 'oyo state', 'mokola'] },
  { label: 'Enugu', keys: ['enugu', 'nsukka'] },
  { label: 'Kano', keys: ['kano', 'kano state'] },
];

const REFERENCE_LABELS = [
  'receipt no',
  'receipt number',
  'receipt #',
  'receipt id',
  'reference no',
  'reference number',
  'reference #',
  'transaction id',
  'transaction no',
  'transaction reference',
  'txn id',
  'txn no',
  'ref no',
  'ref number',
  'ref #',
  'ref:',
  'meter no',
  'meter number',
  'token no',
  'token number',
  'order id',
  'order no',
  'confirmation code',
  'confirmation no',
];

const JUNK_PROVIDER_LINE = [
  /^(?:total|subtotal|sub total|grand total|amount|tax|vat|invoice|receipt|payment|thank|thanks|order|statement|period|item|description|qty|quantity|date|bill|dear|hi|hello|welcome|page)\b/i,
  /https?:\/\//i,
  /[\w.+-]+@[\w-]+\.[\w.]+/,
  /^\W*\d[\d\s.,/:-]*\W*$/,
  /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/,
  /\bpage\s+\d+\s+of\s+\d+\b/i,
  /\b(?:billing|shipping|delivery|service)\s+address\b/i,
  /\b\d{1,5}\s+[A-Za-z.'-]+\s+(?:street|st|road|rd|avenue|ave|close|crescent|drive|dr|way|lane|ln|boulevard|blvd|estate|plaza)\b/i,
];

const PROVIDER_NAME_LABELS = [
  'billed by',
  'sold by',
  'paid to',
  'payment to',
  'issued by',
  'merchant',
  'provider',
  'vendor',
  'supplier',
  'beneficiary',
  'payee',
];

const JUNK_URL_HOSTS = [
  'unsubscribe',
  'privacy',
  'terms',
  'legal',
  'no-reply',
  'noreply',
  'donotreply',
  'help.',
  'support.',
  'sentry',
  'w3.org',
  'schemas.',
  'example.com',
  'mailto',
  'preferences',
  'optout',
  'opt-out',
  'list-manage',
  'mailchimp',
];

/** Full-URL path fragments that mean "manage/cancel", never "official site". */
const JUNK_URL_PATHS = [
  'cancelplan',
  '/cancel',
  'unsubscribe',
  'account/settings',
  'signin',
  'sign-in',
  'login',
  'preferences',
  'manage-subscription',
  'payment-method',
  '?ref=',
  'redirect',
];

/** Standalone place names that must never be offered as a merchant name. */
const PLACE_NAME_ALIASES = REGIONS.flatMap((r) => r.keys);

const PLAN_TIERS = [
  'premium',
  'standard',
  'basic',
  'family',
  'individual',
  'single',
  'student',
  'business',
  'enterprise',
  'professional',
  'pro',
  'plus',
  'ultra',
  'max',
  'lite',
  'essential',
  'unlimited',
  'duo',
];

/* -------------------------------------------------------------------------- */
/* Field extractors                                                            */
/* -------------------------------------------------------------------------- */

/** A line is unusable as a merchant name if it is structural, not a name. */
function isJunkProviderCandidate(line: string): boolean {
  if (line.length < 3 || line.length > 60) return true;
  if (JUNK_PROVIDER_LINE.some((re) => re.test(line))) return true;
  if (AMOUNT_LABELS.some((l) => hasPhrase(line, l.phrase))) return true;
  // A bare place name is a location, not a merchant.
  const bare = line.replace(/[.,:;]+$/, '').trim();
  if (PLACE_NAME_ALIASES.some((place) => bare.toLowerCase() === place)) return true;
  return false;
}

function detectProviderName(
  text: string,
  kind: ReceiptKind,
  fileName?: string
): ReceiptField<string | null> {
  // 1. Registry aliases (utilities, telcos, telco/streaming brands).
  let best: { name: string; length: number } | null = null;
  for (const entry of PROVIDER_REGISTRY) {
    for (const alias of [entry.name, ...entry.aliases]) {
      for (const candidate of aliasVariants(alias)) {
        if (!hasPhrase(text, candidate)) continue;
        if (!best || candidate.length > best.length) {
          best = { name: entry.name, length: candidate.length };
        }
      }
    }
  }
  if (best) {
    return { value: best.name, confidence: 'high', evidence: 'provider registry match' };
  }

  // 2. Subscription brand table.
  if (kind === 'subscription') {
    for (const brand of SUBSCRIPTION_BRANDS) {
      for (const alias of brand.aliases) {
        if (hasPhrase(text, alias)) {
          return { value: brand.name, confidence: 'high', evidence: `brand "${alias}"` };
        }
      }
    }
  }

  const lines = text.split('\n');

  // 3. Explicit "Billed by / Merchant / Provider" label.
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    for (const label of PROVIDER_NAME_LABELS) {
      if (!hasPhrase(line, label)) continue;
      const after = line
        .slice(allPhraseMatches(line, label).slice(-1)[0] + label.length)
        .replace(/^\s*[:\-–]\s*/, '')
        .trim();
      if (after && !isJunkProviderCandidate(after)) {
        return { value: after, confidence: 'high', evidence: `label "${label}"` };
      }
      const nextLine = lines[i + 1]?.trim();
      if (nextLine && !isJunkProviderCandidate(nextLine)) {
        return { value: nextLine, confidence: 'medium', evidence: `line after "${label}"` };
      }
    }
  }

  // 4. First meaningful line near the top of the document.
  const scanLimit = Math.min(lines.length, 10);
  for (let i = 0; i < scanLimit; i += 1) {
    const line = lines[i].replace(/\s+/g, ' ').trim();
    if (isJunkProviderCandidate(line)) continue;
    const cleaned = line
      .replace(/^(?:receipt|invoice|payment receipt|tax invoice|bill)\s*[-:–]?\s*/i, '')
      .replace(/\s*[-–—]\s*(receipt|invoice|payment|thank you).*$/i, '')
      .trim();
    if (cleaned.length < 3) continue;
    return {
      value: cleaned,
      confidence: i === 0 ? 'medium' : 'low',
      evidence: `document line ${i + 1}`,
    };
  }

  // 5. File name stem.
  if (fileName) {
    const stem = fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b(receipt|invoice|screenshot|img|image|scan|photo|paste|untitled|download)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (stem.length >= 3) {
      return { value: stem.slice(0, 60), confidence: 'low', evidence: 'file name' };
    }
  }

  return { value: null, confidence: 'none', evidence: '' };
}

/** Expands registry aliases so "MTN Nigeria" also matches "MTN" as a word. */
function aliasVariants(alias: string): string[] {
  const variants = new Set<string>();
  const trimmed = alias.trim();
  if (trimmed.length < 2) return [];
  variants.add(trimmed);
  // Drop parenthetical acronym suffixes: "Ikeja Electric (IKEDC)" -> "Ikeja Electric".
  const withoutParens = trimmed.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (withoutParens.length >= 2) variants.add(withoutParens);
  return [...variants];
}

function detectAmount(text: string, dates: DateCandidate[]): {
  field: ReceiptField<number | null>;
  token: MoneyToken | null;
} {
  const tokens = scanMoneyTokens(text);
  if (tokens.length === 0) {
    return { field: { value: null, confidence: 'none', evidence: '' }, token: null };
  }

  const dateSpans = dates.map((d) => ({ start: d.start, end: d.end }));

  let best: { token: MoneyToken; score: number } | null = null;
  let sawLabelled = false;

  for (const token of tokens) {
    // Reject identity/meter/account/phone numbers.
    if (token.hasIdentity) continue;
    // Reject long bare digit runs (phone, meter, account) with no separators.
    if (!token.hasGrouping && !token.hasDecimals && token.raw.replace(/\D/g, '').length >= 7) continue;
    // Reject tokens that are part of a date.
    if (dateSpans.some((span) => token.start < span.end && token.end > span.start)) continue;

    if (token.moneyLabel) sawLabelled = true;

    const tier = token.moneyLabel?.tier ?? 0;
    let score = tier * 1000;
    if (token.labelAfter) score -= 300;
    score -= Math.min(token.labelDistance, 400);
    if (token.hasGrouping || token.hasDecimals) score += 50;
    if (token.hasExclusion) score -= 100000;
    if (token.value < 0.01) score -= 10000;

    if (!best || score > best.score) best = { token, score };
  }

  if (!best) {
    return { field: { value: null, confidence: 'none', evidence: '' }, token: null };
  }

  const { token } = best;
  const tier = token.moneyLabel?.tier ?? 0;
  const evidence = token.moneyLabel
    ? `label "${token.moneyLabel.phrase}"`
    : token.labelAfter
      ? 'label after amount'
      : 'largest number found';

  let confidence: FieldConfidence;
  if (token.hasExclusion) confidence = 'low';
  else if (tier >= 4) confidence = token.hasDecimals || token.hasGrouping ? 'high' : 'medium';
  else if (tier === 3) confidence = token.hasDecimals || token.hasGrouping ? 'medium' : 'low';
  else if (tier === 2) confidence = 'low';
  else if (sawLabelled) confidence = 'low';
  else confidence = 'low';

  return { field: { value: token.value, confidence, evidence }, token };
}

function detectCurrency(text: string, token: MoneyToken | null): ReceiptField<string | null> {
  if (token) {
    if (token.prefixCurrency) {
      return { value: token.prefixCurrency, confidence: 'high', evidence: 'amount prefix' };
    }
    if (token.suffixCurrency) {
      return { value: token.suffixCurrency, confidence: 'high', evidence: 'amount suffix' };
    }
  }
  const doc = detectDocumentCurrency(text);
  if (doc.code) {
    return { value: doc.code, confidence: 'low', evidence: `document ${doc.evidence}` };
  }
  return { value: null, confidence: 'none', evidence: '' };
}

function detectDates(
  text: string,
  candidates: DateCandidate[]
): {
  paymentDate: ReceiptField<string | null>;
  nextBillingDate: ReceiptField<string | null>;
  warnings: string[];
} {
  const warnings: string[] = [];

  const pick = (role: DateRole, warningsOut: string[]): ReceiptField<string | null> => {
    const explicit = candidates.filter((c) => c.role === role);
    if (explicit.length > 0) {
      const best = explicit[0];
      let confidence: FieldConfidence = 'high';
      if (best.ambiguousOrder) {
        confidence = 'low';
        warningsOut.push(
          `A date was written ambiguously (for example ${best.iso}); please confirm the day and month.`
        );
      }
      return { value: best.iso, confidence, evidence: best.evidence || 'nearest date' };
    }
    return { value: null, confidence: 'none', evidence: '' };
  };

  const nextBillingDate = pick('next_billing', warnings);

  // A "billing period 2026-08-01 to 2026-09-01" line means the SECOND date is
  // the renewal, which is the most common shape on an invoice.
  let resolvedNext = nextBillingDate;
  if (resolvedNext.value === null) {
    const periodDates = candidates.filter((c) => c.inPeriodLine);
    if (periodDates.length >= 2) {
      const end = periodDates[periodDates.length - 1];
      resolvedNext = { value: end.iso, confidence: 'medium', evidence: 'end of billing period' };
    }
  }

  const paymentDate = pick('payment', warnings);

  // Nothing was labelled: fall back to the earliest real date, but say so.
  let resolvedPayment = paymentDate;
  if (resolvedPayment.value === null && resolvedNext.value === null) {
    const unlabelled = candidates.filter((c) => c.role === 'none');
    const chosen = unlabelled[0] ?? candidates.find((c) => c.role === 'invoice') ?? candidates[0];
    if (chosen) {
      const isInvoice = chosen.role === 'invoice';
      resolvedPayment = {
        value: chosen.iso,
        confidence: 'low',
        evidence: isInvoice ? chosen.evidence : 'earliest date found',
      };
      warnings.push(
        isInvoice
          ? `Only an invoice issue date (${chosen.iso}) was found — please confirm the date you actually paid.`
          : `No payment date was labelled on the receipt; ${chosen.iso} was the first date found. Please confirm it.`
      );
    }
  } else if (resolvedPayment.value === null) {
    const invoiceDate = candidates.find((c) => c.role === 'invoice');
    if (invoiceDate) {
      resolvedPayment = {
        value: invoiceDate.iso,
        confidence: 'low',
        evidence: invoiceDate.evidence,
      };
      warnings.push(
        `No payment date was labelled; the invoice date ${invoiceDate.iso} was used. Please confirm it.`
      );
    }
  }

  return { paymentDate: resolvedPayment, nextBillingDate: resolvedNext, warnings };
}

function detectProviderReference(text: string): ReceiptField<string | null> {
  for (const label of REFERENCE_LABELS) {
    const after = allPhraseMatches(text, label);
    if (after.length === 0) continue;
    for (const idx of after) {
      const window = text.slice(idx + label.length, idx + label.length + 48);
      const match = /^\s*[:\-–#]?\s*([A-Za-z0-9][A-Za-z0-9\-_/]{4,39})\b/.exec(window);
      if (match) {
        return { value: match[1], confidence: 'high', evidence: `label "${label}"` };
      }
    }
  }
  return { value: null, confidence: 'none', evidence: '' };
}

function detectPlan(text: string): ReceiptField<string | null> {
  for (const tier of PLAN_TIERS) {
    if (hasPhrase(text, `${tier} plan`)) {
      return { value: `${tier[0].toUpperCase()}${tier.slice(1)}`, confidence: 'medium', evidence: `"${tier} plan"` };
    }
    if (hasPhrase(text, `plan: ${tier}`) || hasPhrase(text, `plan - ${tier}`)) {
      return { value: `${tier[0].toUpperCase()}${tier.slice(1)}`, confidence: 'medium', evidence: 'plan label' };
    }
  }
  const labelled = allPhraseMatches(text, 'plan');
  for (const idx of labelled) {
    const window = text.slice(idx + 4, idx + 44);
    const match = /^\s*[:\-–]\s*([A-Za-z0-9][A-Za-z0-9 &/.'-]{1,30})/.exec(window);
    if (!match) continue;
    const value = match[1].trim();
    if (value) return { value, confidence: 'medium', evidence: 'label "plan"' };
  }
  return { value: null, confidence: 'none', evidence: '' };
}

function detectCategory(
  text: string,
  kind: ReceiptKind,
  provider: ReceiptField<string | null>
): ReceiptField<string | null> {
  if (provider.confidence === 'high' && provider.value) {
    const registryEntry = PROVIDER_REGISTRY.find((p) => p.name === provider.value);
    if (registryEntry) {
      if (kind === 'bill') {
        if (STANDARD_BILL_CATEGORIES.includes(registryEntry.category as never)) {
          return { value: registryEntry.category, confidence: 'high', evidence: 'provider registry' };
        }
      } else {
        // Registry categories are bill-shaped; map them onto the subscription
        // vocabulary rather than leaking "TV / Streaming" into a subscription.
        const mapped = mapBillCategoryToSubscriptionCategory(registryEntry.category);
        if (mapped !== 'Other') {
          return { value: mapped, confidence: 'high', evidence: 'provider registry' };
        }
      }
    }
  }

  const table = kind === 'bill' ? BILL_CATEGORY_KEYWORDS : SUBSCRIPTION_CATEGORY_KEYWORDS;
  for (const entry of table) {
    for (const key of entry.keys) {
      if (hasPhrase(text, key)) {
        return { value: entry.category, confidence: 'medium', evidence: `keyword "${key}"` };
      }
    }
  }
  return { value: null, confidence: 'none', evidence: '' };
}

function detectRegion(text: string, kind: ReceiptKind): ReceiptField<string | null> {
  if (kind !== 'bill') return { value: null, confidence: 'none', evidence: '' };
  for (const entry of REGIONS) {
    for (const key of entry.keys) {
      if (hasPhrase(text, key)) {
        return { value: entry.label, confidence: 'medium', evidence: `keyword "${key}"` };
      }
    }
  }
  return { value: null, confidence: 'none', evidence: '' };
}

function detectBillingCycle(text: string): ReceiptField<BillingCycle> {
  // Yearly is checked first so "billed annually for 12 months" resolves to
  // yearly rather than being dragged into "month".
  const ordered: Array<{ cycle: BillingCycle; keys: string[] }> = [
    {
      cycle: 'yearly',
      keys: ['annually', 'annual', 'yearly', 'per year', 'per annum', '/yr', 'a year', '12-month', '12 month', 'year plan', 'yearly subscription'],
    },
    { cycle: 'quarterly', keys: ['quarterly', 'per quarter', '/qtr', '3-month', '3 month', 'quarter'] },
    { cycle: 'weekly', keys: ['weekly', 'per week', '/wk', 'a week'] },
    { cycle: 'monthly', keys: ['monthly', 'per month', '/mo', '/month', 'a month', 'month-to-month'] },
  ];
  for (const entry of ordered) {
    for (const key of entry.keys) {
      if (hasPhrase(text, key)) {
        return { value: entry.cycle, confidence: 'medium', evidence: `keyword "${key}"` };
      }
    }
  }
  if (hasPhrase(text, 'one time') || hasPhrase(text, 'one-time') || hasPhrase(text, 'once off')) {
    return { value: 'one_time', confidence: 'medium', evidence: 'keyword "one time"' };
  }
  return { value: 'unknown', confidence: 'none', evidence: '' };
}

function detectProviderUrl(
  text: string,
  provider: ReceiptField<string | null>
): ReceiptField<string | null> {
  const re = /https?:\/\/[^\s<>"')\]]+/gi;
  const found: Array<{ url: string; host: string; line: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const url = m[0].replace(/[.,;:)]+$/, '');
    let host = '';
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (JUNK_URL_HOSTS.some((junk) => host.includes(junk))) continue;
    const lowerUrl = url.toLowerCase();
    if (JUNK_URL_PATHS.some((junk) => lowerUrl.includes(junk))) continue;
    const lineStart = text.lastIndexOf('\n', m.index) + 1;
    const lineEndIndex = text.indexOf('\n', m.index + url.length);
    found.push({
      url,
      host,
      line: text.slice(lineStart, lineEndIndex === -1 ? text.length : lineEndIndex),
    });
  }
  if (found.length === 0) return { value: null, confidence: 'none', evidence: '' };

  const providerValue = provider.value?.toLowerCase();
  if (providerValue) {
    const providerToken = providerValue.split(/[\s(]+/).filter((t) => t.length >= 3)[0];
    if (providerToken) {
      const official = found.find(
        (f) => f.host.includes(providerToken) || f.line.toLowerCase().includes(providerToken)
      );
      if (official) {
        return { value: official.url, confidence: 'medium', evidence: `host matches "${providerValue}"` };
      }
    }
  }
  const first = found[0];
  return { value: first.url, confidence: 'low', evidence: 'first non-legal link' };
}

/* -------------------------------------------------------------------------- */
/* Public entry point                                                          */
/* -------------------------------------------------------------------------- */

const EMPTY_FIELD = { value: null, confidence: 'none' as const, evidence: '' };

export interface ParseReceiptOptions {
  kind?: ReceiptKind;
  fileName?: string;
}

export function parseReceiptDocument(
  rawText: string,
  options: ParseReceiptOptions = {}
): ReceiptExtraction {
  const kind: ReceiptKind = options.kind ?? 'subscription';
  const text = normalizeDocumentText(rawText);
  const warnings: string[] = [];

  if (!text.trim()) {
    return {
      kind,
      providerName: { ...EMPTY_FIELD },
      amount: { ...EMPTY_FIELD },
      currency: { ...EMPTY_FIELD },
      paymentDate: { ...EMPTY_FIELD },
      nextBillingDate: { ...EMPTY_FIELD },
      billingCycle: { value: 'unknown', confidence: 'none', evidence: '' },
      category: { ...EMPTY_FIELD },
      providerReference: { ...EMPTY_FIELD },
      plan: { ...EMPTY_FIELD },
      region: { ...EMPTY_FIELD },
      providerUrl: { ...EMPTY_FIELD },
      warnings: ['No readable text was found in the receipt.'],
    };
  }

  const dateCandidates = collectDateCandidates(text);
  const { field: amount, token } = detectAmount(text, dateCandidates);
  const currency = detectCurrency(text, token);
  const dates = detectDates(text, dateCandidates);
  warnings.push(...dates.warnings);

  const providerName = detectProviderName(text, kind, options.fileName);
  const billingCycle = detectBillingCycle(text);
  const category = detectCategory(text, kind, providerName);

  if (amount.value === null) {
    warnings.push('No amount could be read from this receipt. Please enter it manually.');
  }
  if (amount.confidence === 'low' && amount.value !== null) {
    warnings.push(
      `The amount ${amount.value} was a best guess (${amount.evidence}). Please check it against the receipt.`
    );
  }
  if (providerName.confidence === 'none') {
    warnings.push('No merchant name was recognised. Please enter the provider manually.');
  } else if (providerName.confidence === 'low') {
    warnings.push('The provider name was guessed from the file name. Please confirm it.');
  }
  if (currency.value === null) {
    warnings.push('No currency could be read from this receipt.');
  }

  // For subscriptions the renewal date is the critical field; if the receipt
  // only had a payment date, surface that as a candidate rather than inventing
  // a date one month out.
  const nextBillingDate = dates.nextBillingDate;
  if (kind === 'subscription' && nextBillingDate.value === null) {
    warnings.push(
      'No renewal date was found on this receipt. Add the next billing date so reminders work.'
    );
  }

  return {
    kind,
    providerName,
    amount,
    currency,
    paymentDate: dates.paymentDate,
    nextBillingDate,
    billingCycle,
    category,
    providerReference: detectProviderReference(text),
    plan: detectPlan(text),
    region: detectRegion(text, kind),
    providerUrl: detectProviderUrl(text, providerName),
    warnings,
  };
}

/**
 * Normalises extracted text: strips control characters, normalises exotic
 * whitespace/dashes, and drops the long runs of binary noise that come out of
 * reading a PDF or an image without a decoder.
 */
export function normalizeDocumentText(rawText: string): string {
  return (rawText ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\u00A0\u202F\u2007]/g, ' ')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

/**
 * True when a blob of "text" is really undecoded binary (a PDF read as a
 * string, a mis-decoded image). Used to reject input before it reaches the
 * parser so we can return an honest error instead of garbage fields.
 */
export function looksLikeBinaryNoise(text: string): boolean {
  if (!text) return true;
  let suspicious = 0;
  const sample = text.slice(0, 4000);
  for (const char of sample) {
    const code = char.codePointAt(0) ?? 0;
    const printable =
      (code >= 0x20 && code <= 0x7e) ||
      code === 0x0a ||
      code === 0x0d ||
      code === 0x09 ||
      code >= 0xa0;
    if (!printable) suspicious += 1;
  }
  return suspicious / Math.max(sample.length, 1) > 0.05;
}
