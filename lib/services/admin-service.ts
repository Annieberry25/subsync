import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database.types';
import {
  type AdminActivityItem,
  type AdminBillProviderRow,
  type AdminOverview,
  type AdminPlanSubscriptionRow,
  type AdminProviderInput,
  type AdminUserDetail,
  type AdminUserRow,
} from '@/lib/types/admin.types';
import { createAdminClient } from '@/lib/supabase/admin';
import { downgradeUserToFree } from '@/lib/paystack/grants';

const PLAN_TIER_BY_PLAN: Record<string, 'plus' | 'premium'> = {
  plus: 'plus',
  premium: 'premium',
};

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function attachEmails<T extends { user_id: string }>(
  rows: T[]
): Promise<Record<string, { email: string; full_name: string | null }>> {
  const map: Record<string, { email: string; full_name: string | null }> = {};
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  if (!userIds.length) return map;
  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds);
  data?.forEach((p) => {
    map[p.id] = { email: p.email, full_name: p.full_name };
  });
  return map;
}

async function count(
  admin: SupabaseClient<Database>,
  table: 'profiles' | 'subscriptions' | 'bill_payments' | 'plan_subscriptions' | 'gmail_connections' | 'ai_conversations' | 'inbox_items',
  column = 'id'
): Promise<number> {
  const { count, error } = await admin.from(table).select(column, { count: 'exact', head: true });
  return error ? 0 : (count ?? 0);
}

/**
 * Counts plan_subscriptions rows in a given payment state.
 *
 * The plan-status tiles are broken out per status rather than reusing
 * `count()`, which has no filter. They are the most prominent cards on the
 * admin overview, so returning the unfiltered total three times would show
 * plausible-looking but wrong numbers on exactly the screen admins check
 * first.
 *
 * Typed per-table rather than generically: the two `status` columns have
 * different CHECK constraints, so a shared generic loses the type that would
 * catch a typo in the status string.
 */
async function countPlansByStatus(
  admin: SupabaseClient<Database>,
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired'
): Promise<number> {
  const { count, error } = await admin
    .from('plan_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', status);
  return error ? 0 : (count ?? 0);
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const admin = createAdminClient();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [totalUsers, totalSubscriptions, totalPlanSubscriptions, paidPlans, pendingPlans, failedPlans, gmailConnections, aiConversations, inboxItems, billPayments, activeUsers30d, activeSubscriptions, paidRows, activity] = await Promise.all([
    count(admin, 'profiles'),
    count(admin, 'subscriptions'),
    count(admin, 'plan_subscriptions'),
    countPlansByStatus(admin, 'paid'),
    countPlansByStatus(admin, 'pending'),
    countPlansByStatus(admin, 'failed'),
    count(admin, 'gmail_connections'),
    count(admin, 'ai_conversations'),
    count(admin, 'inbox_items'),
    count(admin, 'bill_payments'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since30),
    admin.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('plan_subscriptions').select('amount').eq('status', 'paid'),
    admin.from('activity_log').select('*').order('timestamp', { ascending: false }).limit(12),
  ]);

  const estimatedMrrUsd = (paidRows.data ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0) / 100;

  const emailMap = await attachEmails(activity.data ?? []);
  const recentActivity: AdminActivityItem[] = (activity.data ?? []).map((row) => {
    const user = emailMap[row.user_id];
    return {
      id: row.id,
      email: user?.email ?? 'unknown',
      user_full_name: user?.full_name ?? null,
      type: row.type,
      title: row.title,
      description: row.description,
      amount: row.amount,
      currency: row.currency,
      timestamp: row.timestamp,
    };
  });

  return {
    totalUsers,
    activeUsers30d: activeUsers30d.count ?? 0,
    totalSubscriptions,
    activeSubscriptions: activeSubscriptions.count ?? 0,
    totalPlanSubscriptions,
    paidPlans,
    pendingPlans,
    failedPlans,
    estimatedMrrUsd,
    gmailConnections,
    aiConversations,
    inboxItems,
    billPayments,
    recentActivity,
  };
}

export async function listAdminUsers(search?: string, limit = 100): Promise<{ users: AdminUserRow[]; total: number }> {
  const admin = createAdminClient();
  const base = admin
    .from('profiles')
    .select('id, email, full_name, plan_tier, plan_expires_at, is_admin, created_at', { count: 'exact' });
  const query = search ? base.ilike('email', `%${search}%`) : base;
  const { data, count, error } = await query.order('created_at', { ascending: false }).limit(limit);
  return { users: (data ?? []) as AdminUserRow[], total: error ? 0 : (count ?? 0) };
}

export async function getUserAdminDetail(userId: string): Promise<AdminUserDetail | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, full_name, plan_tier, plan_expires_at, is_admin, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return null;

  const totalRes = await admin.from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  const activeRes = await admin.from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active');
  const planRes = await admin.from('plan_subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
  const activityRes = await admin.from('activity_log').select('*').eq('user_id', userId).order('timestamp', { ascending: false }).limit(20);

  const { data: emailRow } = await admin.from('profiles').select('id, email, full_name').eq('id', userId).maybeSingle();
  const email = emailRow?.email ?? '';
  const fullName = emailRow?.full_name ?? null;

  const planSubscriptions: AdminPlanSubscriptionRow[] = (planRes.data ?? []).map((row) =>
    toAdminPlanSubscription(row, email, fullName)
  );

  const recentActivity: AdminActivityItem[] = (activityRes.data ?? []).map((row) => ({
    id: row.id,
    email,
    user_full_name: fullName,
    type: row.type,
    title: row.title,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    timestamp: row.timestamp,
  }));

  return {
    profile,
    subscriptionCount: totalRes.error ? 0 : (totalRes.count ?? 0),
    activeSubscriptionCount: activeRes.error ? 0 : (activeRes.count ?? 0),
    planSubscriptions,
    recentActivity,
  };
}

function toAdminPlanSubscription(
  row: Database['public']['Tables']['plan_subscriptions']['Row'],
  email: string,
  fullName: string | null
): AdminPlanSubscriptionRow {
  return {
    id: row.id,
    user_id: row.user_id,
    email,
    full_name: fullName,
    plan: row.plan,
    paystack_reference: row.paystack_reference,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    access_code: row.access_code,
    paid_at: row.paid_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
  };
}

export async function listAdminPlanSubscriptions(limit = 100): Promise<AdminPlanSubscriptionRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.from('plan_subscriptions').select('*').order('created_at', { ascending: false }).limit(limit);
  const emailMap = await attachEmails(data ?? []);
  return (data ?? []).map((row) =>
    toAdminPlanSubscription(row, emailMap[row.user_id]?.email ?? 'unknown', emailMap[row.user_id]?.full_name ?? null)
  );
}

export async function listAdminActivity(limit = 100): Promise<AdminActivityItem[]> {
  const admin = createAdminClient();
  const { data } = await admin.from('activity_log').select('*').order('timestamp', { ascending: false }).limit(limit);
  const emailMap = await attachEmails(data ?? []);
  return (data ?? []).map((row) => ({
    id: row.id,
    email: emailMap[row.user_id]?.email ?? 'unknown',
    user_full_name: emailMap[row.user_id]?.full_name ?? null,
    type: row.type,
    title: row.title,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    timestamp: row.timestamp,
  }));
}

/** Grant a plan manually (admin console). Mirrors the Paystack grant dual-write. */
export async function grantPlanToUser(
  userId: string,
  tier: 'plus' | 'premium',
  days = 30
): Promise<void> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const expiresAt = addUtcDays(new Date(), days).toISOString();
  const plan = PLAN_TIER_BY_PLAN[tier] ?? 'plus';
  const reference = `ADMIN-${globalThis.crypto.randomUUID()}`;

  await admin.from('plan_subscriptions').insert({
    user_id: userId,
    paystack_reference: reference,
    plan,
    status: 'paid',
    amount: 0,
    currency: 'USD',
    paid_at: nowIso,
    expires_at: expiresAt,
  });

  await admin.from('profiles').update({ plan_tier: plan, plan_expires_at: expiresAt }).eq('id', userId);
  await admin.auth.admin.updateUserById(userId, {
    user_metadata: { plan_tier: plan, plan_expires_at: expiresAt },
  });
}

/** Revoke a plan immediately (different from downgradeUserToFree only in naming). */
export async function revokePlanFromUser(userId: string): Promise<void> {
  await downgradeUserToFree(userId);
}

export async function listAdminBillProviders(): Promise<AdminBillProviderRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.from('bill_providers').select('*').order('name');
  return (data ?? []) as AdminBillProviderRow[];
}

export async function createAdminBillProvider(input: AdminProviderInput): Promise<AdminBillProviderRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bill_providers')
    .insert({
      name: input.name.trim(),
      category: input.category.trim(),
      country: input.country.trim(),
      region: input.region ?? null,
      official_website: input.official_website ?? null,
      official_payment_url: input.official_payment_url ?? null,
      verification_status: input.verification_status ?? 'unverified',
      supported_regions: input.supported_regions ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateAdminBillProvider(
  id: string,
  input: Partial<AdminProviderInput>
): Promise<AdminBillProviderRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bill_providers')
    .update({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.category !== undefined ? { category: input.category.trim() } : {}),
      ...(input.country !== undefined ? { country: input.country.trim() } : {}),
      ...(input.region !== undefined ? { region: input.region } : {}),
      ...(input.official_website !== undefined ? { official_website: input.official_website } : {}),
      ...(input.official_payment_url !== undefined ? { official_payment_url: input.official_payment_url } : {}),
      ...(input.verification_status !== undefined ? { verification_status: input.verification_status } : {}),
      ...(input.supported_regions !== undefined ? { supported_regions: input.supported_regions } : {}),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAdminBillProvider(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('bill_providers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}