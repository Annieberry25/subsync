import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/types/database.types';

export type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];
export type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert'];
export type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update'];

let cachedSubscriptions: SubscriptionRow[] | null = null;

export function getCachedSubscriptions(): SubscriptionRow[] | null {
  return cachedSubscriptions;
}

export async function fetchSubscriptions(): Promise<{ data: SubscriptionRow[] | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('next_billing_date', { ascending: true });

  if (error) return { data: cachedSubscriptions, error: new Error(error.message) };
  if (data) {
    cachedSubscriptions = data;
  }
  return { data: data || cachedSubscriptions, error: null };
}

export async function createSubscription(
  subscriptionData: Omit<SubscriptionInsert, 'user_id'>
): Promise<{ data: SubscriptionRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new Error('User is not authenticated.') };
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      ...subscriptionData,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data, error: null };
}

export async function updateSubscription(
  id: string,
  subscriptionData: SubscriptionUpdate
): Promise<{ data: SubscriptionRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .update(subscriptionData)
    .eq('id', id)
    .select()
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data, error: null };
}

export async function deleteSubscription(id: string): Promise<{ error: Error | null }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function bulkCreateSubscriptions(
  items: Omit<SubscriptionInsert, 'user_id'>[]
): Promise<{ count: number; error: Error | null }> {
  if (!items || items.length === 0) return { count: 0, error: null };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { count: 0, error: new Error('User is not authenticated.') };
  }

  const recordsToInsert = items.map((item) => ({
    ...item,
    user_id: user.id,
  }));

  const { data, error } = await supabase.from('subscriptions').insert(recordsToInsert).select();

  if (error) return { count: 0, error: new Error(error.message) };
  return { count: data?.length || 0, error: null };
}
