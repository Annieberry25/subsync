-- ==========================================
-- Migration 015: capture account-deletion feedback.
--
-- When a user deletes their account the server records their (optional) reason
-- for leaving in this table so the team can act on churn feedback. The row is
-- written by the service-role client right before auth.users is deleted, so it
-- intentionally does NOT reference auth.users (no FK) — otherwise the deletion
-- would cascade it away.
--
-- Security: RLS is enabled with NO policies and no grants. Only the service
-- role (and the table owner) can read or write it; anon/authenticated cannot
-- touch it, and no browser-visible API reads it.
-- ==========================================

CREATE TABLE IF NOT EXISTS public.account_deletion_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_deletion_reasons_created_at_idx
  ON public.account_deletion_reasons (created_at DESC);

ALTER TABLE public.account_deletion_reasons ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_deletion_reasons FROM anon, authenticated;