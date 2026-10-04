-- ==========================================
-- Migration 011: reconcile public.subscriptions with schema.sql / database.types.ts.
-- ==========================================
--
-- Why this file exists
-- --------------------
-- supabase/schema.sql and supabase/migrations/ have drifted apart, and the live
-- database was built from neither consistently. Columns that lib/types/
-- database.types.ts declares — and that subscription-service.ts writes on every
-- insert and update — were never added by any migration, so PostgREST rejected
-- every subscription write with:
--
--   Could not find the '<column>' column of 'subscriptions' in the schema cache
--   (PostgREST 42703)
--
-- Two separate gaps caused this:
--
--   1. 002_subscriptions_metadata.sql was never applied, even though 003 and
--      006-010 were. Skipped, i.e. the migrations were run out of order.
--   2. cheaper_plan_name / cheaper_plan_price exist in schema.sql (lines 71-72)
--      and in database.types.ts, but appear in NO migration file at all, so
--      applying 002 would never have added them.
--
-- Verified against production by diffing every column of every table in
-- database.types.ts against the live PostgREST schema. All 11 tables reconcile
-- except these two columns on subscriptions, so this file closes the gap in
-- full:
--
--   profiles            ok        plan_subscriptions  ok      bill_payments     ok
--   subscriptions       2 missing bill_providers      ok      receipt_scan_usage ok
--   receipts            ok        activity_log        ok      ai_conversations  ok
--   inbox_items         ok        gmail_connections   ok
--
-- Verified again after applying: all 11 tables report ok.
--
-- Impact while this was missing
-- -----------------------------
-- Not reads only. subscription-service.ts writes end_date, account_links,
-- receipts, is_synced, cheaper_plan_name and cheaper_plan_price on every insert
-- (createSubscription) and update (updateSubscription), and import-utils.ts does
-- the same on import. Creating, editing and importing a subscription therefore
-- failed outright rather than degrading, and because each run stopped at
-- whichever column the schema cache noticed first, the error surfaced one
-- column at a time as earlier gaps were closed.
--
-- Why not `supabase db push`
-- --------------------------
-- The project is not linked (no supabase/config.toml, no supabase/.temp) and
-- there is no supabase_migrations.schema_migrations ledger on the project, so
-- the CLI has no record of what is applied and would attempt to replay 002
-- through 010, including statements that are not idempotent (the 005 grants,
-- 004's rate-limit function). Applying this file on its own is the safe route.
--
-- Every statement is ADD COLUMN IF NOT EXISTS, so this is safe to run against a
-- fresh database, a partially migrated one, or one where 002 has since been
-- applied by hand, and safe to run repeatedly.

ALTER TABLE public.subscriptions
  -- From 002_subscriptions_metadata.sql.
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS account_links JSONB,
  ADD COLUMN IF NOT EXISTS receipts JSONB,
  ADD COLUMN IF NOT EXISTS is_synced BOOLEAN,
  -- Never present in any migration; taken from schema.sql lines 71-72 so the
  -- column constraints match a fresh install exactly.
  ADD COLUMN IF NOT EXISTS cheaper_plan_name TEXT,
  ADD COLUMN IF NOT EXISTS cheaper_plan_price NUMERIC(10, 2);

-- schema.sql declares CHECK (cheaper_plan_price >= 0) inline, and declares
-- ADD COLUMN IF NOT EXISTS cannot carry a constraint, so the check is added
-- separately. The guard is on the constraint name only: if existing rows violate
-- it this fails loudly rather than silently leaving the migrated database
-- without a constraint a fresh install would have.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.subscriptions'::regclass
      AND conname = 'subscriptions_cheaper_plan_price_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_cheaper_plan_price_check
      CHECK (cheaper_plan_price >= 0);
  END IF;
END $$;

-- PostgREST caches the table definition it exposes over the REST API. It
-- reloads on its own schedule and immediately after a DDL change notification,
-- but the client-side error can outlive the ALTER by a minute or two. Verify
-- with the query below; if it still reports a column missing, wait and retry.
--
--   SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name = 'subscriptions'
--   ORDER BY ordinal_position;
--
-- Expect the four 002 columns plus cheaper_plan_name (text) and
-- cheaper_plan_price (numeric).
--
-- Existing rows keep is_synced = NULL, which is a valid state in the declared
-- schema (database.types.ts types it `boolean | null`). It is not used as a
-- read filter — fetchSubscriptions() selects * and does not narrow on it — so
-- no backfill is required. is_synced is only ever written explicitly: true once
-- a subscription has been synced to the server, false when created locally.
--
-- Keeping schema.sql and migrations/ in step
-- -------------------------------------------
-- This file now covers every subscriptions column, so a fresh install built from
-- schema.sql and one built by replaying migrations agree. Any future column
-- must be added to schema.sql, to a migration, and regenerated into
-- database.types.ts — a column present only in database.types.ts is exactly how
-- cheaper_plan_name went missing.