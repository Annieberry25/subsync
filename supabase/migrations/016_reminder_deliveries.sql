-- 016: per-renewal reminder delivery log (idempotency)
--
-- The reminder cron needs to send a reminder at each lead offset the user chose
-- (10 days, 3 days, ...) exactly once per renewal. Before this table the guard
-- was an activity_log row stamped with the current UTC date, so it only
-- suppressed duplicates within a single day: the push window is `days <= lead`,
-- which matches every day from the lead day down to the renewal day, and the
-- next calendar day looked "not sent" again. That is a daily reminder, not a
-- 10-day and 3-day reminder.
--
-- This table is the durable ledger. One row per (subscription, renewal date,
-- lead offset, channel). The unique key is what makes a send idempotent across
-- runs, retries, overlapping crons, and multi-day catch-up: keying on the
-- renewal date rather than the send date means a reminder that was missed on
-- its exact trigger day still fires once later, and never fires twice.
--
-- `renewal_date` is copied from subscriptions.next_billing_date at send time.
-- When the subscription advances to its next cycle, the key changes and the
-- offsets fire again for the new renewal — which is the intended behaviour.

create table if not exists public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  -- The renewal this reminder was for, so a repeat send for the same cycle is
  -- recognised even if it happens days late.
  renewal_date date not null,
  -- The offset the user configured (days before renewal) this row satisfies.
  lead_days integer not null check (lead_days > 0),
  channel text not null check (channel in ('push', 'email')),
  -- Denormalised for the delivery log view; the subscription row can be renamed
  -- or deleted and the log should still read sensibly.
  subscription_name text,
  amount numeric(10, 2),
  currency text,
  sent_at timestamptz not null default now(),
  -- The idempotency guarantee: one send per subscription per renewal per offset
  -- per channel, enforced by the database rather than by read-then-write code
  -- that two overlapping runs can both pass.
  unique (subscription_id, renewal_date, lead_days, channel)
);

create index if not exists idx_reminder_deliveries_user_id
  on public.reminder_deliveries (user_id, sent_at desc);

create index if not exists idx_reminder_deliveries_subscription_id
  on public.reminder_deliveries (subscription_id);

alter table public.reminder_deliveries enable row level security;

-- Read-only to the owner so a settings view can show "already notified" history.
-- Writes are the cron's alone (service role bypasses RLS); clients never insert.
create policy "reminder_deliveries select own"
  on public.reminder_deliveries
  for select
  to authenticated
  using (auth.uid() = user_id);
