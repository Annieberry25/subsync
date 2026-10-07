-- ==========================================
-- SUBHALT SUBSCRIPTION MANAGER - DATABASE SCHEMA
-- ==========================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------
-- 1. PROFILES TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  plan_tier TEXT NOT NULL DEFAULT 'free',
  plan_expires_at TIMESTAMPTZ,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Self-service edits are limited to safe profile fields. The privileged
-- columns (is_admin, plan_tier, plan_expires_at) must remain EXACTLY as the
-- server last wrote them; the committed values are recalled through a
-- SECURITY DEFINER function so the policy does not re-enter RLS (see migration
-- 009 for why). Clients are additionally stripped of UPDATE on those columns at
-- the privilege layer (migration 013).
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update non-privileged profile fields" ON public.profiles;

CREATE OR REPLACE FUNCTION public.own_privileged_profile(
  OUT is_admin boolean,
  OUT plan_tier text,
  OUT plan_expires_at timestamptz
)
RETURNS record
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.is_admin, p.plan_tier, p.plan_expires_at
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.own_privileged_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.own_privileged_profile() TO authenticated;

CREATE POLICY "Users can update non-privileged profile fields"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_admin IS NOT DISTINCT FROM (SELECT o.is_admin FROM public.own_privileged_profile() AS o)
    AND plan_tier IS NOT DISTINCT FROM (SELECT o.plan_tier FROM public.own_privileged_profile() AS o)
    AND plan_expires_at IS NOT DISTINCT FROM (SELECT o.plan_expires_at FROM public.own_privileged_profile() AS o)
  );

REVOKE UPDATE (is_admin, plan_tier, plan_expires_at) ON public.profiles FROM anon, authenticated;

-- Trigger to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------
-- 2. SUBSCRIPTIONS TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly', 'weekly', 'quarterly', 'custom')),
  category TEXT NOT NULL CHECK (category IN ('Streaming', 'Software', 'Utilities', 'Fitness', 'Finance', 'Education', 'Gaming', 'Other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'canceled', 'trial')),
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  next_billing_date DATE NOT NULL,
  payment_method TEXT,
  provider_url TEXT,
  notes TEXT,
  cheaper_plan_name TEXT,
  cheaper_plan_price NUMERIC(10, 2) CHECK (cheaper_plan_price >= 0),
  account_links JSONB,
  receipts JSONB,
  is_synced BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON public.subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_category ON public.subscriptions(category);

-- Enable RLS on Subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Subscriptions (Strict User Isolation)
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view their own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can insert their own subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can update their own subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can delete their own subscriptions"
  ON public.subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------
-- 3. BILL PAYMENTS TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  custom_category TEXT,
  provider_name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  country TEXT DEFAULT 'Nigeria',
  region TEXT,
  city TEXT,
  payment_frequency TEXT CHECK (payment_frequency IN ('one_time', 'monthly', 'yearly', 'weekly', 'quarterly', 'custom')),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  receipts JSONB,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'receipt_scan', 'email_discovered')),
  provider_reference TEXT,
  official_provider_url TEXT,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_bill_payments_user_id ON public.bill_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_date ON public.bill_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_bill_payments_category ON public.bill_payments(category);
CREATE INDEX IF NOT EXISTS idx_bill_payments_status ON public.bill_payments(status);

-- ---------- Receipt scan quota ----------
-- Mirrors supabase/migrations/010_receipt_storage.sql. Server-writable only:
-- quota accounting must not be reachable from the browser.
CREATE TABLE IF NOT EXISTS public.receipt_scan_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'upload'
    CHECK (source IN ('upload', 'paste', 'email', 'gmail')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_receipt_scan_usage_user_created
  ON public.receipt_scan_usage (user_id, created_at DESC);

ALTER TABLE public.receipt_scan_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.receipt_scan_usage FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.receipt_scan_usage TO service_role;

-- ---------- Receipt files ----------
-- The bytes behind a scanned receipt. `bill_payments.receipts` above is only
-- JSONB metadata; this table plus the private `receipts` bucket hold the file.
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  bill_payment_id UUID REFERENCES public.bill_payments(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  amount NUMERIC(14, 2),
  currency TEXT,
  provider TEXT,
  payment_date DATE,
  extraction_confidence JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT receipts_single_parent
    CHECK (num_nonnulls(subscription_id, bill_payment_id) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_subscription_path
  ON public.receipts (subscription_id, storage_path)
  WHERE subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_bill_path
  ON public.receipts (bill_payment_id, storage_path)
  WHERE bill_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON public.receipts (user_id);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;

DROP POLICY IF EXISTS "receipts_select_own" ON public.receipts;
CREATE POLICY "receipts_select_own" ON public.receipts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "receipts_insert_own" ON public.receipts;
CREATE POLICY "receipts_insert_own" ON public.receipts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "receipts_update_own" ON public.receipts;
CREATE POLICY "receipts_update_own" ON public.receipts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "receipts_delete_own_rows" ON public.receipts;
CREATE POLICY "receipts_delete_own_rows" ON public.receipts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Private bucket: reads require a short-lived server-minted signed URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts', 'receipts', false, 10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
        'image/heic', 'image/heif', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Object keys are namespaced by user id, which is what makes these policies safe.
DROP POLICY IF EXISTS "receipts_read_own" ON storage.objects;
CREATE POLICY "receipts_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "receipts_write_own" ON storage.objects;
CREATE POLICY "receipts_write_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "receipts_delete_own" ON storage.objects;
CREATE POLICY "receipts_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);


-- Enable RLS on Bill Payments
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Bill Payments (Strict User Isolation)
DROP POLICY IF EXISTS "Users can view their own bill payments" ON public.bill_payments;
CREATE POLICY "Users can view their own bill payments"
  ON public.bill_payments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own bill payments" ON public.bill_payments;
CREATE POLICY "Users can insert their own bill payments"
  ON public.bill_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own bill payments" ON public.bill_payments;
CREATE POLICY "Users can update their own bill payments"
  ON public.bill_payments FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own bill payments" ON public.bill_payments;
CREATE POLICY "Users can delete their own bill payments"
  ON public.bill_payments FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_bill_payments_updated_at ON public.bill_payments;
CREATE TRIGGER update_bill_payments_updated_at
  BEFORE UPDATE ON public.bill_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------
-- 4. VERIFIED BILL PROVIDERS TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.bill_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Global',
  region TEXT,
  official_website TEXT,
  official_payment_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'user_submitted', 'unverified')),
  supported_regions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on Bill Providers (Public Read, Admin Write)
ALTER TABLE public.bill_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view verified bill providers" ON public.bill_providers;
CREATE POLICY "Anyone authenticated can view verified bill providers"
  ON public.bill_providers FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- ------------------------------------------
-- 5. NAME CHANGE LOG (cooldown authority)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.name_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  last_changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.name_change_log ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_name_change_log_updated_at ON public.name_change_log;
CREATE TRIGGER update_name_change_log_updated_at
  BEFORE UPDATE ON public.name_change_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- The 30-day window is checked + recorded inside a SECURITY DEFINER function so
-- the client role can never backdate last_changed_at. No client CRUD policies.
DO $$
BEGIN
  CREATE TYPE public.name_change_result AS (
    success boolean,
    message text,
    last_changed_at timestamptz,
    next_allowed_at timestamptz
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.update_user_name(p_full_name text)
RETURNS public.name_change_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_last_changed timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN ROW(false, 'Not authenticated.', NULL, NULL)::public.name_change_result;
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 OR length(p_full_name) > 100 THEN
    RETURN ROW(false, 'Name must be between 1 and 100 characters.', NULL, NULL)::public.name_change_result;
  END IF;

  SELECT last_changed_at INTO v_last_changed
  FROM public.name_change_log
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_last_changed IS NOT NULL THEN
    IF v_now < (v_last_changed + interval '30 days') THEN
      RETURN ROW(
        false,
        'Name can only be changed once every 30 days.',
        v_last_changed,
        (v_last_changed + interval '30 days')
      )::public.name_change_result;
    END IF;
  END IF;

  INSERT INTO public.name_change_log (user_id, last_changed_at, updated_at)
  VALUES (v_user_id, v_now, v_now)
  ON CONFLICT (user_id)
  DO UPDATE SET last_changed_at = EXCLUDED.last_changed_at,
                updated_at = EXCLUDED.updated_at;

  UPDATE public.profiles
  SET full_name = trim(p_full_name), updated_at = v_now
  WHERE id = v_user_id;

  RETURN ROW(true, 'Name updated.', v_now, NULL)::public.name_change_result;
END;
$$;

REVOKE ALL ON public.name_change_log FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_name(text) TO authenticated;

-- Postgres-backed rate limiter for the Edge middleware.
-- Replaces the throwaway in-memory Map with persistent sliding-window counters
-- so limits survive cold starts and apply across instances/regions.

create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  bucket_start timestamptz not null,
  count bigint not null default 1,
  expires_at timestamptz not null,
  unique (bucket_key, bucket_start)
);

create index if not exists rate_limit_events_expires_at_idx on public.rate_limit_events (expires_at);

alter table public.rate_limit_events enable row level security;

DO $$
BEGIN
  CREATE TYPE public.rate_limit_result AS (
    allowed boolean,
    retry_after_seconds integer,
    count bigint,
    limit_value integer
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

create or replace function public.check_rate_limit(
  p_bucket_key text,
  p_window_seconds integer default 60,
  p_max_requests integer default 30
) returns public.rate_limit_result
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_seconds integer := greatest(p_window_seconds, 1);
  v_max_requests integer := greatest(p_max_requests, 1);
  v_bucket_start timestamptz;
  v_count bigint;
  v_expires_at timestamptz;
  v_result public.rate_limit_result;
begin
  -- Sliding window aligned to the epoch (works for any window size).
  select to_timestamp(floor(extract(epoch from v_now) / v_window_seconds) * v_window_seconds)
    into v_bucket_start;

  -- Opportunistic cleanup of expired buckets.
  delete from public.rate_limit_events where expires_at < v_now;

  -- Atomically increment the current bucket within this transaction.
  select count, expires_at
    into v_count, v_expires_at
    from public.rate_limit_events
   where bucket_key = p_bucket_key
     and bucket_start = v_bucket_start
   for update;

  if v_count is null then
    insert into public.rate_limit_events (bucket_key, bucket_start, count, expires_at)
    values (p_bucket_key, v_bucket_start, 1, v_bucket_start + make_interval(secs => v_window_seconds))
    returning count into v_count;
    v_expires_at := v_bucket_start + make_interval(secs => v_window_seconds);
  else
    update public.rate_limit_events
       set count = count + 1
     where bucket_key = p_bucket_key
       and bucket_start = v_bucket_start
    returning count into v_count;
  end if;

  v_result.allowed := v_count <= v_max_requests;
  v_result.retry_after_seconds := greatest(
    1,
    ceil(extract(epoch from (v_expires_at - v_now)))::integer
  );
v_result.count := v_count;
  v_result.limit_value := v_max_requests;

  return v_result;
end;
$$;

-- RPC is the only access path: deny direct table access, allow the function.
revoke all on public.rate_limit_events from anon, authenticated;
revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer)
  to anon, authenticated, service_role;
grant select, insert, update, delete on public.rate_limit_events to service_role;

-- ==========================================
-- Migration 005: RBAC hardening — defense-in-depth grants.
--
-- RLS already scopes every row to its owner. This migration strips raw DML
-- privileges from the client roles on the reference/audit tables so that even
-- a policy slip cannot be exploited directly; those tables are only reachable
-- through SECURITY DEFINER functions.
-- ==========================================

-- Reference catalog: read-only (via RLS) submission policy still applies,
-- but the client roles no longer hold raw INSERT/UPDATE/DELETE privileges.
REVOKE INSERT, UPDATE, DELETE ON public.bill_providers FROM anon, authenticated;

-- Name-change / cooldown ledger: only update_user_name() may touch it.
REVOKE ALL ON public.name_change_log FROM anon, authenticated;

-- Rate-limit buckets: only check_rate_limit() may touch them.
REVOKE ALL ON public.rate_limit_events FROM anon, authenticated;

-- Owner tables keep standard privileges (RLS enforces user isolation):
-- profiles, subscriptions, bill_payments are scoped by auth.uid() policies.

-- ==========================================
-- Migration 006: Supabase-backed persistence for activity log, AI chat
-- conversations, and inbox items.
--
-- Strategy (per product decision): Supabase is the source of truth and every
-- write goes straight to the DB. The apps keep a localStorage mirror as a
-- read fallback; there is NO pending-sync queue (offline writes are not
-- pushed later).
-- ==========================================

-- ------------------------------------------
-- 1. ACTIVITY LOG
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID,
  subscription_name TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(14, 2),
  currency TEXT,
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_time ON public.activity_log (user_id, timestamp DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own activity log" ON public.activity_log;
CREATE POLICY "Users can view their own activity log"
  ON public.activity_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own activity log" ON public.activity_log;
CREATE POLICY "Users can insert their own activity log"
  ON public.activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own activity log" ON public.activity_log;
CREATE POLICY "Users can update their own activity log"
  ON public.activity_log FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own activity log" ON public.activity_log;
CREATE POLICY "Users can delete their own activity log"
  ON public.activity_log FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------
-- 2. AI CHAT CONVERSATIONS
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_time ON public.ai_conversations (user_id, updated_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can view their own conversations"
  ON public.ai_conversations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can insert their own conversations"
  ON public.ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can update their own conversations"
  ON public.ai_conversations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.ai_conversations;
CREATE POLICY "Users can delete their own conversations"
  ON public.ai_conversations FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------
-- 3. INBOX ITEMS
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_favourited BOOLEAN NOT NULL DEFAULT false,
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  action_type TEXT,
  action_label TEXT,
  subscription_name TEXT,
  subscription_price NUMERIC(14, 2),
  currency TEXT,
  provider_url TEXT,
  metadata JSONB,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_inbox_items_user_date ON public.inbox_items (user_id, date DESC);

ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own inbox items" ON public.inbox_items;
CREATE POLICY "Users can view their own inbox items"
  ON public.inbox_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own inbox items" ON public.inbox_items;
CREATE POLICY "Users can insert their own inbox items"
  ON public.inbox_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own inbox items" ON public.inbox_items;
CREATE POLICY "Users can update their own inbox items"
  ON public.inbox_items FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own inbox items" ON public.inbox_items;
CREATE POLICY "Users can delete their own inbox items"
  ON public.inbox_items FOR DELETE
  USING (auth.uid() = user_id);

-- ==========================================
-- Migration 007: Server-authoritative plan subscriptions (Paystack).
--
-- Model (per product decision): single payment per month. Each Plus checkout
-- creates one plan_subscriptions row (pending -> paid on a verified Paystack
-- charge.success). profiles.plan_tier is the server-side source of truth for
-- premium gating; this table additionally records payment history. There is no
-- Paystack Plans/subscriptions API object and no auto-renewal — renewal is a
-- fresh checkout. Cancel = downgrade to free immediately (there is no
-- pre-paid recurring cycle to keep until period-end).
-- ==========================================

-- ------------------------------------------
-- 1. PROFILES: plan columns
-- ------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

-- ------------------------------------------
-- 2. PLAN SUBSCRIPTIONS (payment ledger)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  paystack_reference TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'plus',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  access_code TEXT,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_plan_subscriptions_user_id
  ON public.plan_subscriptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_subscriptions_reference
  ON public.plan_subscriptions (paystack_reference);

DROP TRIGGER IF EXISTS update_plan_subscriptions_updated_at ON public.plan_subscriptions;
CREATE TRIGGER update_plan_subscriptions_updated_at
  BEFORE UPDATE ON public.plan_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Locked down: no client-side write policies. Users may read their own rows
-- (display in settings); all writes happen server-side via the service role
-- (initialize/callback/webhook/cancel API routes) so a browser can never
-- fabricate a paid reference or backdate an expiry.
ALTER TABLE public.plan_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own plan subscriptions" ON public.plan_subscriptions;
CREATE POLICY "Users can view their own plan subscriptions"
  ON public.plan_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

REVOKE ALL ON public.plan_subscriptions FROM anon, authenticated;
GRANT SELECT ON public.plan_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_subscriptions TO service_role;
