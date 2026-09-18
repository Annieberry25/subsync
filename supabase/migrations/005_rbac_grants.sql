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