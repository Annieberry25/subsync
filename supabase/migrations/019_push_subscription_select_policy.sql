-- 019: let a device read its own push rows so upsert can run
--
-- Postgres evaluates the SELECT policy of the target table for an
-- `INSERT ... ON CONFLICT DO UPDATE`, in addition to INSERT and UPDATE. The
-- conflict arbiter row has to be visible to be updated, so without a SELECT
-- policy that admits it the whole statement is denied — even the first insert
-- that never actually conflicts:
--
--   ERROR: 42501: new row violates row-level security policy for table
--   "push_subscriptions"
--
-- Migration 012 defined INSERT and DELETE only (deliberately: the endpoint and
-- keys were meant to be read by the service role), and 018 added UPDATE. That is
-- still not enough, which is why every subscribe attempt returned a 500, the
-- client unsubscribed itself, and the cron never saw an endpoint.
--
-- Scoped to the owner so a device can only ever see its own endpoints and keys.

drop policy if exists "push_subscriptions select own" on public.push_subscriptions;
create policy "push_subscriptions select own"
  on public.push_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);
