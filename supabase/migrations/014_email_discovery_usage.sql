-- ==========================================
-- Migration 014: Email discovery usage accounting.
--
-- `maxEmailDiscoveryPerMonth` was declared in the plan limits (100 for Plus,
-- 0 for Free) but had no enforcement site: the inbound email webhook parsed and
-- inserted subscriptions without ever counting them, so a forwarded-receipt
-- flood was unbounded. Mirrors `receipt_scan_usage`: rows are written
-- server-side only, the browser never reads or writes this table.
-- ==========================================

CREATE TABLE IF NOT EXISTS public.email_discovery_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'email_forwarding'
    CHECK (source IN ('email_forwarding', 'gmail_monitoring')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_email_discovery_usage_user_created
  ON public.email_discovery_usage (user_id, created_at DESC);

ALTER TABLE public.email_discovery_usage ENABLE ROW LEVEL SECURITY;

-- No client policies: quota accounting must not be client-writable.
REVOKE ALL ON public.email_discovery_usage FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.email_discovery_usage TO service_role;