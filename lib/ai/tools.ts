import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database.types';
import type { SubscriptionRow, SubscriptionUpdate } from '@/lib/services/subscription-service';
import type { BillPaymentRow, BillPaymentUpdate } from '@/lib/types/bills.types';
import { buildInsights } from '@/lib/insights/generate-insights';
import { getPlanLimits, hasReachedSubscriptionCap } from '@/lib/constants/plan-limits';

/**
 * Tool (function-calling) registry for the SubHalt assistant.
 *
 * Read tools execute immediately against the caller's RLS-scoped Supabase
 * client — the model only ever sees this user's rows. Write tools NEVER execute
 * from the model: they are described as pending actions the UI shows as a
 * confirmation card, and only `/api/ai/actions` runs them after the user
 * confirms, re-validating the same schema and plan gate.
 *
 * Server-only. Do not import from client components.
 */

export interface AiToolContext {
  supabase: SupabaseClient<Database>;
  userId: string;
  /** Effective tier (admin already resolved to 'premium' by the caller). */
  tier: string;
  isAdmin: boolean;
  actionsEnabled: boolean;
  displayCurrency: string;
  /** Today's date, YYYY-MM-DD, resolved server-side once per request. */
  today: string;
}

export interface PendingAiAction {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  title: string;
  description: string;
  details: { label: string; value: string }[];
}

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  write: boolean;
}

export type AiWriteResult =
  | { ok: true; message: string; subscription?: ReturnType<typeof compactSubscription>; bill?: ReturnType<typeof compactBill> }
  | { ok: false; message: string };

type Described = { title: string; description: string; details: { label: string; value: string }[] };

// ---------------------------------------------------------------------------
// Validation primitives
// ---------------------------------------------------------------------------

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date formatted YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Not a real date');

const currencyCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, 'Expected a 3-letter currency code (e.g. USD, NGN)')
  .transform((v) => v.toUpperCase());

const subscriptionStatus = z.enum(['active', 'paused', 'canceled', 'trial']);
const billingCycle = z.enum(['monthly', 'yearly', 'weekly', 'quarterly', 'custom']);
const subscriptionCategory = z.enum([
  'Streaming',
  'Software',
  'Utilities',
  'Fitness',
  'Finance',
  'Education',
  'Gaming',
  'Other',
]);
const billStatus = z.enum(['paid', 'pending', 'overdue']);
const billFrequency = z.enum(['one_time', 'monthly', 'yearly', 'weekly', 'quarterly', 'custom']);
const notesField = z.string().trim().max(500);
const shortText = (max: number) => z.string().trim().min(1).max(max);

// ---------------------------------------------------------------------------
// Serializers + math (pure — unit tested)
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Normalizes any billing cycle to a monthly amount; `custom` cannot be normalized. */
export function monthlyEquivalent(
  price: number,
  cycle: SubscriptionRow['billing_cycle']
): number | null {
  switch (cycle) {
    case 'monthly':
      return price;
    case 'yearly':
      return price / 12;
    case 'weekly':
      return (price * 52) / 12;
    case 'quarterly':
      return price / 3;
    default:
      return null;
  }
}

export function compactSubscription(row: SubscriptionRow) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    currency: row.currency,
    billing_cycle: row.billing_cycle,
    category: row.category,
    status: row.status,
    next_billing_date: row.next_billing_date,
  };
}

function fullSubscription(row: SubscriptionRow) {
  return {
    ...compactSubscription(row),
    start_date: row.start_date,
    end_date: row.end_date ?? null,
    payment_method: row.payment_method,
    provider_url: row.provider_url,
    notes: row.notes ? row.notes.slice(0, 300) : null,
  };
}

function compactBill(row: BillPaymentRow) {
  return {
    id: row.id,
    provider_name: row.provider_name,
    amount: Number(row.amount),
    currency: row.currency,
    payment_date: row.payment_date,
    category: row.category,
    status: row.status,
    is_recurring: Boolean(row.is_recurring),
    payment_frequency: row.payment_frequency,
  };
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${round2(amount)} ${currency}`;
  }
}

// ---------------------------------------------------------------------------
// Data access helpers (RLS-scoped; explicit user_id filters as defence in depth)
// ---------------------------------------------------------------------------

async function loadSubscriptions(ctx: AiToolContext): Promise<SubscriptionRow[]> {
  const { data, error } = await ctx.supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('next_billing_date', { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as SubscriptionRow[];
}

async function getSubscriptionById(ctx: AiToolContext, id: string): Promise<SubscriptionRow | null> {
  const { data, error } = await ctx.supabase
    .from('subscriptions')
    .select('*')
    .eq('id', id)
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SubscriptionRow | null) ?? null;
}

async function getBillById(ctx: AiToolContext, id: string): Promise<BillPaymentRow | null> {
  const { data, error } = await ctx.supabase
    .from('bill_payments')
    .select('*')
    .eq('id', id)
    .eq('user_id', ctx.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BillPaymentRow | null) ?? null;
}

async function countActiveSubscriptions(ctx: AiToolContext): Promise<number> {
  const { count } = await ctx.supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId)
    .not('status', 'eq', 'canceled');
  return typeof count === 'number' ? count : 0;
}

async function countBills(ctx: AiToolContext): Promise<number> {
  const { count } = await ctx.supabase
    .from('bill_payments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId);
  return typeof count === 'number' ? count : 0;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

interface RegisteredTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  write: boolean;
  schema: z.ZodType<Record<string, unknown>>;
  execute: (args: Record<string, unknown>, ctx: AiToolContext) => Promise<Record<string, unknown>>;
  /** Write tools only: builds the confirmation card content. */
  describe?: (args: Record<string, unknown>, ctx: AiToolContext) => Promise<Described | { error: string }>;
}

const tools: RegisteredTool[] = [
  // ------------------------------- READ TOOLS ------------------------------
  {
    name: 'list_subscriptions',
    description:
      "List or search the user's own subscriptions with price, billing cycle, status and next billing date. Use this for ANY question about the user's subscriptions, renewals, categories or status counts — never answer from memory.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional case-insensitive name filter.' },
        status: { type: 'string', enum: ['active', 'paused', 'canceled', 'trial'] },
        category: {
          type: 'string',
          enum: ['Streaming', 'Software', 'Utilities', 'Fitness', 'Finance', 'Education', 'Gaming', 'Other'],
        },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Max rows to return (default 20).' },
      },
    },
    schema: z.object({
      query: shortText(120).optional(),
      status: subscriptionStatus.optional(),
      category: subscriptionCategory.optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
    }) as z.ZodType<Record<string, unknown>>,
    write: false,
    async execute(raw, ctx) {
      const a = toolSchema('list_subscriptions').parse(raw) as {
        query?: string;
        status?: string;
        category?: string;
        limit?: number;
      };
      const rows = await loadSubscriptions(ctx);
      let filtered = rows;
      if (a.query) {
        const q = a.query.toLowerCase();
        filtered = filtered.filter((r) => r.name.toLowerCase().includes(q));
      }
      if (a.status) filtered = filtered.filter((r) => r.status === a.status);
      if (a.category) filtered = filtered.filter((r) => r.category === a.category);
      const limit = a.limit ?? 20;
      return {
        total_matches: filtered.length,
        subscriptions: filtered.slice(0, limit).map(compactSubscription),
      };
    },
  },
  {
    name: 'get_subscription',
    description:
      "Fetch full details of one subscription (or close name matches) including notes and provider URL. Use before proposing an edit or cancellation, and whenever the user names a specific subscription.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Exact subscription id when known.' },
        name: { type: 'string', description: 'Name or partial name to search for.' },
      },
    },
    schema: z
      .object({ id: shortText(64).optional(), name: shortText(120).optional() })
      .refine((o) => o.id || o.name, 'Provide either id or name') as z.ZodType<Record<string, unknown>>,
    write: false,
    async execute(raw, ctx) {
      const a = toolSchema('get_subscription').parse(raw) as { id?: string; name?: string };
      const rows = await loadSubscriptions(ctx);
      let matches = rows;
      if (a.id) matches = rows.filter((r) => r.id === a.id);
      else if (a.name) {
        const q = a.name.toLowerCase();
        matches = rows.filter((r) => r.name.toLowerCase().includes(q));
      }
      return { total_matches: matches.length, matches: matches.slice(0, 5).map(fullSubscription) };
    },
  },
  {
    name: 'get_spending_summary',
    description:
      "Compute the user's subscription commitment: monthly and annual totals per currency, breakdown by category, and status counts. Amounts are calculated — never estimate them yourself. Currencies are NOT converted; report each total with its currency.",
    parameters: { type: 'object', properties: {} },
    schema: z.object({}) as z.ZodType<Record<string, unknown>>,
    write: false,
    async execute(_raw, ctx) {
      const rows = await loadSubscriptions(ctx);
      const active = rows.filter((r) => r.status === 'active' || r.status === 'trial');
      const monthlyByCurrency = new Map<string, number>();
      const annualByCurrency = new Map<string, number>();
      const byCategory = new Map<string, { category: string; currency: string; monthly_amount: number; count: number }>();
      let customCycleCount = 0;

      for (const sub of active) {
        const monthly = monthlyEquivalent(Number(sub.price), sub.billing_cycle);
        if (monthly == null) {
          customCycleCount += 1;
          continue;
        }
        const currency = sub.currency || ctx.displayCurrency;
        monthlyByCurrency.set(currency, (monthlyByCurrency.get(currency) ?? 0) + monthly);
        annualByCurrency.set(currency, (annualByCurrency.get(currency) ?? 0) + monthly * 12);
        const key = `${sub.category}|${currency}`;
        const entry = byCategory.get(key) ?? { category: sub.category, currency, monthly_amount: 0, count: 0 };
        entry.monthly_amount += monthly;
        entry.count += 1;
        byCategory.set(key, entry);
      }

      const countBy = (status: SubscriptionRow['status']) => rows.filter((r) => r.status === status).length;

      return {
        today: ctx.today,
        status_counts: {
          active: countBy('active'),
          trial: countBy('trial'),
          paused: countBy('paused'),
          canceled: countBy('canceled'),
          total: rows.length,
        },
        monthly_commitment: [...monthlyByCurrency.entries()]
          .map(([currency, amount]) => ({ currency, amount: round2(amount) }))
          .sort((a, b) => b.amount - a.amount),
        annual_commitment: [...annualByCurrency.entries()]
          .map(([currency, amount]) => ({ currency, amount: round2(amount) }))
          .sort((a, b) => b.amount - a.amount),
        by_category: [...byCategory.values()]
          .map((e) => ({ ...e, monthly_amount: round2(e.monthly_amount) }))
          .sort((a, b) => b.monthly_amount - a.monthly_amount)
          .slice(0, 12),
        custom_cycle_subscriptions_excluded: customCycleCount,
        note: 'Amounts computed from active and trial subscriptions only; currencies are shown separately, not converted.',
      };
    },
  },
  {
    name: 'get_bill_spending',
    description:
      "Compute what the user paid in bills over a date range (defaults to the current month to date): totals per currency, by category, and top providers. Use instead of summing payment rows yourself.",
    parameters: {
      type: 'object',
      properties: {
        since: { type: 'string', description: 'Start date YYYY-MM-DD (default: first day of the current month).' },
        until: { type: 'string', description: 'End date YYYY-MM-DD (default: today).' },
        query: { type: 'string', description: 'Optional provider name filter.' },
      },
    },
    schema: z.object({
      since: isoDate.optional(),
      until: isoDate.optional(),
      query: shortText(120).optional(),
    }) as z.ZodType<Record<string, unknown>>,
    write: false,
    async execute(raw, ctx) {
      const a = toolSchema('get_bill_spending').parse(raw) as { since?: string; until?: string; query?: string };
      const until = a.until ?? ctx.today;
      const since = a.since ?? `${ctx.today.slice(0, 7)}-01`;

      const { data, error } = await ctx.supabase
        .from('bill_payments')
        .select('*')
        .eq('user_id', ctx.userId)
        .gte('payment_date', since)
        .lte('payment_date', until)
        .order('payment_date', { ascending: false })
        .limit(1000);
      if (error) throw new Error(error.message);

      let rows = (data ?? []) as BillPaymentRow[];
      if (a.query) {
        const q = a.query.toLowerCase();
        rows = rows.filter((r) => r.provider_name.toLowerCase().includes(q));
      }

      const totalByCurrency = new Map<string, number>();
      const byCategory = new Map<string, { category: string; currency: string; total: number; count: number }>();
      const byProvider = new Map<string, { provider: string; currency: string; total: number; count: number }>();

      for (const bill of rows) {
        const currency = bill.currency || ctx.displayCurrency;
        const amount = Number(bill.amount);
        totalByCurrency.set(currency, (totalByCurrency.get(currency) ?? 0) + amount);

        const catKey = `${bill.category}|${currency}`;
        const cat = byCategory.get(catKey) ?? { category: bill.category, currency, total: 0, count: 0 };
        cat.total += amount;
        cat.count += 1;
        byCategory.set(catKey, cat);

        const provKey = `${bill.provider_name}|${currency}`;
        const prov = byProvider.get(provKey) ?? { provider: bill.provider_name, currency, total: 0, count: 0 };
        prov.total += amount;
        prov.count += 1;
        byProvider.set(provKey, prov);
      }

      return {
        since,
        until,
        payments_count: rows.length,
        total_by_currency: [...totalByCurrency.entries()]
          .map(([currency, total]) => ({ currency, total: round2(total) }))
          .sort((a2, b2) => b2.total - a2.total),
        by_category: [...byCategory.values()]
          .map((e) => ({ ...e, total: round2(e.total) }))
          .sort((a2, b2) => b2.total - a2.total)
          .slice(0, 12),
        top_providers: [...byProvider.values()]
          .map((e) => ({ ...e, total: round2(e.total) }))
          .sort((a2, b2) => b2.total - a2.total)
          .slice(0, 10),
        note: 'Currencies are shown separately, not converted.',
      };
    },
  },
  {
    name: 'list_bill_payments',
    description:
      "List the user's most recent bill payments with provider, amount, date, category and status. Use for questions about specific payments or bills.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional provider name filter.' },
        status: { type: 'string', enum: ['paid', 'pending', 'overdue'] },
        limit: { type: 'integer', minimum: 1, maximum: 30, description: 'Max rows to return (default 10).' },
      },
    },
    schema: z.object({
      query: shortText(120).optional(),
      status: billStatus.optional(),
      limit: z.coerce.number().int().min(1).max(30).optional(),
    }) as z.ZodType<Record<string, unknown>>,
    write: false,
    async execute(raw, ctx) {
      const a = toolSchema('list_bill_payments').parse(raw) as { query?: string; status?: string; limit?: number };
      const { data, error } = await ctx.supabase
        .from('bill_payments')
        .select('*')
        .eq('user_id', ctx.userId)
        .order('payment_date', { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);

      let rows = (data ?? []) as BillPaymentRow[];
      if (a.query) {
        const q = a.query.toLowerCase();
        rows = rows.filter((r) => r.provider_name.toLowerCase().includes(q));
      }
      if (a.status) rows = rows.filter((r) => r.status === a.status);
      const limit = a.limit ?? 10;
      return { total_matches: rows.length, payments: rows.slice(0, limit).map(compactBill) };
    },
  },
  {
    name: 'get_insights',
    description:
      "Run SubHalt's insight engine over the user's real subscriptions (duplicates, spending trends, streaming overlap, savings progress). Use when the user asks what they could save, what looks off, or for recommendations.",
    parameters: { type: 'object', properties: {} },
    schema: z.object({}) as z.ZodType<Record<string, unknown>>,
    write: false,
    async execute(_raw, ctx) {
      const rows = await loadSubscriptions(ctx);
      const insights = buildInsights(rows)
        .slice(0, 5)
        .map(({ id, title, category, priority, observation, meaning, recommendation }) => ({
          id,
          title,
          category,
          priority,
          observation,
          meaning,
          recommendation,
        }));
      return { insights };
    },
  },

  // ------------------------------- WRITE TOOLS -----------------------------
  {
    name: 'create_subscription',
    description:
      "Propose adding a subscription the user has asked to track. This does NOT save anything by itself: the app shows a confirmation card the user must approve. Only call this when the user explicitly asks to add or track a subscription, never on your own initiative.",
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Service name, e.g. "Netflix".' },
        price: { type: 'number', description: 'Price per billing cycle.' },
        currency: { type: 'string', description: '3-letter code, e.g. USD or NGN.' },
        billing_cycle: { type: 'string', enum: ['monthly', 'yearly', 'weekly', 'quarterly', 'custom'] },
        category: {
          type: 'string',
          enum: ['Streaming', 'Software', 'Utilities', 'Fitness', 'Finance', 'Education', 'Gaming', 'Other'],
        },
        next_billing_date: { type: 'string', description: 'YYYY-MM-DD' },
        status: { type: 'string', enum: ['active', 'trial'] },
        payment_method: { type: 'string' },
        provider_url: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['name', 'price', 'next_billing_date'],
    },
    schema: z.object({
      name: shortText(120),
      price: z.coerce.number().min(0).max(1_000_000),
      currency: currencyCode.optional(),
      billing_cycle: billingCycle.default('monthly'),
      category: subscriptionCategory.default('Other'),
      next_billing_date: isoDate,
      status: z.enum(['active', 'trial']).default('active'),
      payment_method: shortText(80).optional(),
      provider_url: z.string().trim().url().max(300).optional(),
      notes: notesField.optional(),
    }) as z.ZodType<Record<string, unknown>>,
    write: true,
    async describe(raw, ctx) {
      const a = toolSchema('create_subscription').parse(raw) as unknown as CreateSubscriptionArgs;
      const limits = getPlanLimits(ctx.tier, ctx.isAdmin);
      return {
        title: `Add ${a.name}`,
        description: `Create a new subscription in your SubHalt account (your plan allows up to ${limits.maxSubscriptions} active).`,
        details: [
          { label: 'Price', value: formatMoney(a.price, a.currency ?? ctx.displayCurrency) },
          { label: 'Billing cycle', value: a.billing_cycle },
          { label: 'Next billing date', value: a.next_billing_date },
          { label: 'Category', value: a.category },
          { label: 'Status', value: a.status },
        ],
      };
    },
    async execute(raw, ctx) {
      const a = toolSchema('create_subscription').parse(raw) as unknown as CreateSubscriptionArgs;
      const limits = getPlanLimits(ctx.tier, ctx.isAdmin);
      const activeCount = await countActiveSubscriptions(ctx);
      if (hasReachedSubscriptionCap({ tier: ctx.tier, activeCount, isAdmin: ctx.isAdmin })) {
        return {
          ok: false,
          message: `Your plan allows up to ${limits.maxSubscriptions} active subscriptions, and you have ${activeCount}. Remove one or upgrade to Plus.`,
        };
      }
      const { data, error } = await ctx.supabase
        .from('subscriptions')
        .insert({
          user_id: ctx.userId,
          name: a.name,
          price: a.price,
          currency: a.currency ?? ctx.displayCurrency,
          billing_cycle: a.billing_cycle,
          category: a.category,
          status: a.status,
          next_billing_date: a.next_billing_date,
          start_date: ctx.today,
          payment_method: a.payment_method ?? null,
          provider_url: a.provider_url ?? null,
          notes: a.notes ?? null,
          is_synced: true,
        })
        .select()
        .single();
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: `Added ${data.name}.`, subscription: compactSubscription(data as SubscriptionRow) };
    },
  },
  {
    name: 'update_subscription',
    description:
      "Propose changing fields of an existing subscription (price, cycle, category, status, next billing date, notes). This does NOT save anything by itself: the app shows a confirmation card the user must approve. Use status 'paused' to pause and 'active' to resume.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The subscription id (from get_subscription or list_subscriptions).' },
        price: { type: 'number' },
        currency: { type: 'string' },
        billing_cycle: { type: 'string', enum: ['monthly', 'yearly', 'weekly', 'quarterly', 'custom'] },
        category: {
          type: 'string',
          enum: ['Streaming', 'Software', 'Utilities', 'Fitness', 'Finance', 'Education', 'Gaming', 'Other'],
        },
        status: { type: 'string', enum: ['active', 'paused', 'canceled', 'trial'] },
        next_billing_date: { type: 'string', description: 'YYYY-MM-DD' },
        payment_method: { type: 'string' },
        provider_url: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['id'],
    },
    schema: z
      .object({
        id: shortText(64),
        price: z.coerce.number().min(0).max(1_000_000).optional(),
        currency: currencyCode.optional(),
        billing_cycle: billingCycle.optional(),
        category: subscriptionCategory.optional(),
        status: subscriptionStatus.optional(),
        next_billing_date: isoDate.optional(),
        payment_method: shortText(80).optional(),
        provider_url: z.string().trim().url().max(300).optional(),
        notes: notesField.optional(),
      })
      .refine(
        (o) =>
          o.price !== undefined ||
          o.currency !== undefined ||
          o.billing_cycle !== undefined ||
          o.category !== undefined ||
          o.status !== undefined ||
          o.next_billing_date !== undefined ||
          o.payment_method !== undefined ||
          o.provider_url !== undefined ||
          o.notes !== undefined,
        'Provide at least one field to change'
      ) as z.ZodType<Record<string, unknown>>,
    write: true,
    async describe(raw, ctx) {
      const a = toolSchema('update_subscription').parse(raw) as unknown as UpdateSubscriptionArgs;
      const before = await getSubscriptionById(ctx, a.id);
      if (!before) return { error: 'That subscription was not found in the user\'s account. Check the id with list_subscriptions.' };
      const details = changeDetails(before, a);
      if (details.length === 0) return { error: 'The requested change matches the current values — nothing to update.' };
      return { title: `Update ${before.name}`, description: 'Apply these changes to your subscription.', details };
    },
    async execute(raw, ctx) {
      const a = toolSchema('update_subscription').parse(raw) as unknown as UpdateSubscriptionArgs;
      const before = await getSubscriptionById(ctx, a.id);
      if (!before) return { ok: false, message: 'Subscription not found.' };

      const patch: Record<string, unknown> = {};
      for (const key of [
        'price',
        'currency',
        'billing_cycle',
        'category',
        'status',
        'next_billing_date',
        'payment_method',
        'provider_url',
        'notes',
      ] as const) {
        if (a[key] !== undefined) patch[key] = a[key];
      }
      if (patch.status === 'canceled' && a.next_billing_date === undefined) {
        patch.end_date = ctx.today;
      }

      const { data, error } = await ctx.supabase
        .from('subscriptions')
        .update(patch as SubscriptionUpdate)
        .eq('id', a.id)
        .eq('user_id', ctx.userId)
        .select()
        .single();
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: `Updated ${data.name}.`, subscription: compactSubscription(data as SubscriptionRow) };
    },
  },
  {
    name: 'cancel_subscription',
    description:
      "Propose cancelling a subscription the user asked to cancel. This does NOT cancel anything by itself: the app shows a confirmation card the user must approve, and it only updates SubHalt's records — the user must still cancel with the provider if they haven't. Prefer this over update_subscription for cancellations.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The subscription id.' },
        end_date: { type: 'string', description: 'Last day of service YYYY-MM-DD (default: today).' },
      },
      required: ['id'],
    },
    schema: z.object({ id: shortText(64), end_date: isoDate.optional() }) as z.ZodType<Record<string, unknown>>,
    write: true,
    async describe(raw, ctx) {
      const a = toolSchema('cancel_subscription').parse(raw) as { id: string; end_date?: string };
      const before = await getSubscriptionById(ctx, a.id);
      if (!before) return { error: 'That subscription was not found in the user\'s account. Check the id with list_subscriptions.' };
      if (before.status === 'canceled') return { error: `${before.name} is already marked as canceled.` };
      return {
        title: `Cancel ${before.name}`,
        description:
          "Mark this subscription as canceled in SubHalt. This does not cancel it with the provider — cancel there too if you haven't.",
        details: [
          { label: 'Status', value: `${before.status} → canceled` },
          { label: 'End date', value: a.end_date ?? ctx.today },
          { label: 'Price', value: formatMoney(Number(before.price), before.currency) },
        ],
      };
    },
    async execute(raw, ctx) {
      const a = toolSchema('cancel_subscription').parse(raw) as { id: string; end_date?: string };
      const before = await getSubscriptionById(ctx, a.id);
      if (!before) return { ok: false, message: 'Subscription not found.' };
      if (before.status === 'canceled') {
        return { ok: true, message: `${before.name} was already marked as canceled.`, subscription: compactSubscription(before) };
      }
      const { data, error } = await ctx.supabase
        .from('subscriptions')
        .update({ status: 'canceled', end_date: a.end_date ?? ctx.today })
        .eq('id', a.id)
        .eq('user_id', ctx.userId)
        .select()
        .single();
      if (error) return { ok: false, message: error.message };
      return {
        ok: true,
        message: `Marked ${data.name} as canceled (ended ${a.end_date ?? ctx.today}).`,
        subscription: compactSubscription(data as SubscriptionRow),
      };
    },
  },
  {
    name: 'log_bill_payment',
    description:
      "Propose recording a bill payment the user made. This does NOT save anything by itself: the app shows a confirmation card the user must approve. Only call when the user explicitly asks to log or record a payment.",
    parameters: {
      type: 'object',
      properties: {
        provider_name: { type: 'string', description: 'e.g. "Ikeja Electric".' },
        amount: { type: 'number' },
        currency: { type: 'string', description: '3-letter code.' },
        category: {
          type: 'string',
          description: 'e.g. Electricity, Internet, Airtime / Mobile Data, TV / Streaming, Rent / Housing, Insurance, Education, Membership, Utilities, Other.',
        },
        payment_date: { type: 'string', description: 'YYYY-MM-DD (default: today).' },
        payment_frequency: { type: 'string', enum: ['one_time', 'monthly', 'yearly', 'weekly', 'quarterly', 'custom'] },
        is_recurring: { type: 'boolean' },
        notes: { type: 'string' },
      },
      required: ['provider_name', 'amount'],
    },
    schema: z.object({
      provider_name: shortText(120),
      amount: z.coerce.number().positive().max(100_000_000),
      currency: currencyCode.optional(),
      category: shortText(60).default('Other'),
      payment_date: isoDate.optional(),
      payment_frequency: billFrequency.optional(),
      is_recurring: z.boolean().optional(),
      notes: notesField.optional(),
    }) as z.ZodType<Record<string, unknown>>,
    write: true,
    async describe(raw, ctx) {
      const a = toolSchema('log_bill_payment').parse(raw) as unknown as LogBillArgs;
      return {
        title: `Log payment — ${a.provider_name}`,
        description: 'Record this bill payment in your SubHalt account.',
        details: [
          { label: 'Amount', value: formatMoney(a.amount, a.currency ?? ctx.displayCurrency) },
          { label: 'Date', value: a.payment_date ?? ctx.today },
          { label: 'Category', value: a.category },
          ...(a.is_recurring ? [{ label: 'Recurring', value: a.payment_frequency ?? 'yes' }] : []),
        ],
      };
    },
    async execute(raw, ctx) {
      const a = toolSchema('log_bill_payment').parse(raw) as unknown as LogBillArgs;
      const limits = getPlanLimits(ctx.tier, ctx.isAdmin);
      const billCount = await countBills(ctx);
      if (limits.maxBills !== Infinity && billCount >= limits.maxBills) {
        return {
          ok: false,
          message: `Your plan allows up to ${limits.maxBills} tracked bill payments, and you have ${billCount}. Remove some or upgrade to Plus.`,
        };
      }
      const { data, error } = await ctx.supabase
        .from('bill_payments')
        .insert({
          user_id: ctx.userId,
          provider_name: a.provider_name,
          amount: a.amount,
          currency: a.currency ?? ctx.displayCurrency,
          category: a.category,
          payment_date: a.payment_date ?? ctx.today,
          payment_frequency: a.payment_frequency ?? null,
          is_recurring: a.is_recurring ?? false,
          notes: a.notes ?? null,
          source: 'manual',
          status: 'paid',
        })
        .select()
        .single();
      if (error) return { ok: false, message: error.message };
      return {
        ok: true,
        message: `Logged ${formatMoney(a.amount, a.currency ?? ctx.displayCurrency)} payment to ${data.provider_name}.`,
        bill: compactBill(data as BillPaymentRow),
      };
    },
  },
  {
    name: 'update_bill_payment',
    description:
      "Propose correcting a logged bill payment (amount, date, status, category, notes). This does NOT save anything by itself: the app shows a confirmation card the user must approve.",
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The bill payment id.' },
        amount: { type: 'number' },
        status: { type: 'string', enum: ['paid', 'pending', 'overdue'] },
        payment_date: { type: 'string', description: 'YYYY-MM-DD' },
        category: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['id'],
    },
    schema: z
      .object({
        id: shortText(64),
        amount: z.coerce.number().positive().max(100_000_000).optional(),
        status: billStatus.optional(),
        payment_date: isoDate.optional(),
        category: shortText(60).optional(),
        notes: notesField.optional(),
      })
      .refine(
        (o) =>
          o.amount !== undefined ||
          o.status !== undefined ||
          o.payment_date !== undefined ||
          o.category !== undefined ||
          o.notes !== undefined,
        'Provide at least one field to change'
      ) as z.ZodType<Record<string, unknown>>,
    write: true,
    async describe(raw, ctx) {
      const a = toolSchema('update_bill_payment').parse(raw) as unknown as UpdateBillArgs;
      const before = await getBillById(ctx, a.id);
      if (!before) return { error: 'That bill payment was not found. Check the id with list_bill_payments.' };
      const details: { label: string; value: string }[] = [];
      if (a.amount !== undefined) details.push({ label: 'Amount', value: `${before.amount} → ${a.amount}` });
      if (a.status !== undefined) details.push({ label: 'Status', value: `${before.status} → ${a.status}` });
      if (a.payment_date !== undefined) details.push({ label: 'Date', value: `${before.payment_date} → ${a.payment_date}` });
      if (a.category !== undefined) details.push({ label: 'Category', value: `${before.category} → ${a.category}` });
      if (a.notes !== undefined) details.push({ label: 'Notes', value: a.notes.slice(0, 80) });
      if (details.length === 0) return { error: 'The requested change matches the current values — nothing to update.' };
      return {
        title: `Update payment — ${before.provider_name}`,
        description: 'Apply these corrections to the logged payment.',
        details,
      };
    },
    async execute(raw, ctx) {
      const a = toolSchema('update_bill_payment').parse(raw) as unknown as UpdateBillArgs;
      const before = await getBillById(ctx, a.id);
      if (!before) return { ok: false, message: 'Bill payment not found.' };

      const patch: Record<string, unknown> = {};
      for (const key of ['amount', 'status', 'payment_date', 'category', 'notes'] as const) {
        if (a[key] !== undefined) patch[key] = a[key];
      }
      const { data, error } = await ctx.supabase
        .from('bill_payments')
        .update(patch as BillPaymentUpdate)
        .eq('id', a.id)
        .eq('user_id', ctx.userId)
        .select()
        .single();
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: `Updated payment to ${data.provider_name}.`, bill: compactBill(data as BillPaymentRow) };
    },
  },
];

interface CreateSubscriptionArgs {
  name: string;
  price: number;
  currency?: string;
  billing_cycle: SubscriptionRow['billing_cycle'];
  category: SubscriptionRow['category'];
  next_billing_date: string;
  status: 'active' | 'trial';
  payment_method?: string;
  provider_url?: string;
  notes?: string;
}

interface UpdateSubscriptionArgs {
  id: string;
  price?: number;
  currency?: string;
  billing_cycle?: SubscriptionRow['billing_cycle'];
  category?: SubscriptionRow['category'];
  status?: SubscriptionRow['status'];
  next_billing_date?: string;
  payment_method?: string;
  provider_url?: string;
  notes?: string;
}

interface LogBillArgs {
  provider_name: string;
  amount: number;
  currency?: string;
  category: string;
  payment_date?: string;
  payment_frequency?: BillPaymentRow['payment_frequency'];
  is_recurring?: boolean;
  notes?: string;
}

interface UpdateBillArgs {
  id: string;
  amount?: number;
  status?: BillPaymentRow['status'];
  payment_date?: string;
  category?: string;
  notes?: string;
}

function changeDetails(before: SubscriptionRow, patch: UpdateSubscriptionArgs): { label: string; value: string }[] {
  const labels: { key: keyof UpdateSubscriptionArgs; label: string }[] = [
    { key: 'price', label: 'Price' },
    { key: 'currency', label: 'Currency' },
    { key: 'billing_cycle', label: 'Billing cycle' },
    { key: 'category', label: 'Category' },
    { key: 'status', label: 'Status' },
    { key: 'next_billing_date', label: 'Next billing date' },
    { key: 'payment_method', label: 'Payment method' },
    { key: 'provider_url', label: 'Provider URL' },
    { key: 'notes', label: 'Notes' },
  ];
  const details: { label: string; value: string }[] = [];
  for (const { key, label } of labels) {
    const next = patch[key];
    if (next === undefined) continue;
    const prev = before[key as keyof SubscriptionRow];
    const prevText = prev == null ? '—' : String(prev).slice(0, 80);
    const nextText = next == null ? '—' : String(next).slice(0, 80);
    if (prevText === nextText) continue;
    details.push({ label, value: `${prevText} → ${nextText}` });
  }
  return details;
}

const toolByName = new Map(tools.map((t) => [t.name, t]));

function toolSchema(name: string): z.ZodType<Record<string, unknown>> {
  const tool = toolByName.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.schema;
}

export function readToolDefinitions(): AiToolDefinition[] {
  return tools
    .filter((t) => !t.write)
    .map(({ name, description, parameters, write }) => ({ name, description, parameters, write }));
}

export function writeToolDefinitions(): AiToolDefinition[] {
  return tools
    .filter((t) => t.write)
    .map(({ name, description, parameters, write }) => ({ name, description, parameters, write }));
}

export function getToolDefinition(name: string): AiToolDefinition | undefined {
  const tool = toolByName.get(name);
  if (!tool) return undefined;
  return { name: tool.name, description: tool.description, parameters: tool.parameters, write: tool.write };
}

export function parseToolArgs(
  name: string,
  raw: unknown
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const tool = toolByName.get(name);
  if (!tool) return { ok: false, error: `Unknown tool: ${name}` };
  const parsed = tool.schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join('.') ?? '';
    return {
      ok: false,
      error: `Invalid arguments for ${name}${path ? ` (${path})` : ''}: ${issue?.message ?? 'validation failed'}`,
    };
  }
  return { ok: true, data: parsed.data as Record<string, unknown> };
}

export async function runReadTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AiToolContext
): Promise<Record<string, unknown>> {
  const tool = toolByName.get(name);
  if (!tool || tool.write) return { error: `Unknown read tool: ${name}` };
  try {
    return await tool.execute(args, ctx);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'The data could not be read.' };
  }
}

export async function describeWriteTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AiToolContext
): Promise<Described | { error: string }> {
  const tool = toolByName.get(name);
  if (!tool || !tool.write || !tool.describe) return { error: `Unknown action: ${name}` };
  try {
    return await tool.describe(args, ctx);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'The action could not be prepared.' };
  }
}

export async function executeWriteTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AiToolContext
): Promise<AiWriteResult> {
  const tool = toolByName.get(name);
  if (!tool || !tool.write) return { ok: false, message: `Unknown action: ${name}` };
  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join('.') ?? '';
    return { ok: false, message: `${path ? `${path}: ` : ''}${issue?.message ?? 'Invalid action arguments.'}` };
  }
  try {
    const result = await tool.execute(parsed.data as Record<string, unknown>, ctx);
    return result as AiWriteResult;
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'The action failed unexpectedly.' };
  }
}
