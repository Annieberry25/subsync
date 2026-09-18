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

CREATE TRIGGER update_plan_subscriptions_updated_at
  BEFORE UPDATE ON public.plan_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Locked down: no client-side write policies. Users may read their own rows
-- (display in settings); all writes happen server-side via the service role
-- (initialize/callback/webhook/cancel API routes) so a browser can never
-- fabricate a paid reference or backdate an expiry.
ALTER TABLE public.plan_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own plan subscriptions"
  ON public.plan_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

REVOKE ALL ON public.plan_subscriptions FROM anon, authenticated;
GRANT SELECT ON public.plan_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_subscriptions TO service_role;