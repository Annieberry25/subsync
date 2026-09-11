-- ==========================================
-- Migration 001: strig the name-change rate limiter, harden bill_providers RLS.
-- ==========================================

-- 1. Dedicated table for server-side 30-day name-change rate limiting.
--    Replaces reliance on client-controllable auth user_metadata.last_name_change.
CREATE TABLE IF NOT EXISTS public.name_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  last_changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.name_change_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own row.
CREATE POLICY "Users can view their own name change log"
  ON public.name_change_log FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own row.
CREATE POLICY "Users can insert their own name change log"
  ON public.name_change_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own row.
CREATE POLICY "Users can update their own name change log"
  ON public.name_change_log FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own row (account deletion flows).
CREATE POLICY "Users can delete their own name change log"
  ON public.name_change_log FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_name_change_log_updated_at
  BEFORE UPDATE ON public.name_change_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Harden bill_providers: explicitly deny client writes.
--    (Only SELECT is currently allowed; these make denial explicit.)
CREATE POLICY "No anonymous inserts on bill_providers"
  ON public.bill_providers FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No anonymous updates on bill_providers"
  ON public.bill_providers FOR UPDATE
  USING (false);

CREATE POLICY "No anonymous deletes on bill_providers"
  ON public.bill_providers FOR DELETE
  USING (false);
