-- 012: user-owned push subscriptions and per-subscription reminder preferences
--
-- Two problems this fixes:
--
-- 1. Reminder preferences lived in localStorage ('subhalt_reminders'), which is
--    per-browser. The reminder cron runs server-side and cannot see it, so it
--    emailed every non-canceled row inside the lead window regardless of what the
--    user chose, and nothing the user set ever reached the cron. Preferences that
--    drive a server-side job have to be in the database.
--
-- 2. There was nowhere to store a push endpoint. Web Push hands the browser an
--    endpoint plus keys; without a table there is nothing to send to.

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  -- The browser's PushSubscription keys and the auth/expiry it minted, as JSON.
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id, endpoint)
);

create index if not exists idx_push_subscriptions_user_id
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- The browser reads and writes only its own rows. No SELECT policy: the endpoint
-- and keys are only ever read by the service role, which bypasses RLS.
create policy "push_subscriptions insert own"
  on public.push_subscriptions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "push_subscriptions delete own"
  on public.push_subscriptions
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- subscription_reminders
-- ---------------------------------------------------------------------------
-- email_lead_days is the user's choice (3 days before, 7 before, ...), stored as
-- days rather than a date so it survives the billing date moving. A row here is
-- the opt-in: absence of a row means "do not email about this subscription",
-- which is the point — it stops the cron mailing rows nobody asked about.
create table if not exists public.subscription_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  email_lead_days integer not null default 3,
  push_lead_days integer not null default 10,
  email_enabled boolean not null default false,
  push_enabled boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, subscription_id),
  -- A lead of 0 or negative would fire on or after the billing date, which reads
  -- as an overdue notice rather than a reminder.
  constraint subscription_reminders_lead_days_positive
    check (email_lead_days > 0 and push_lead_days > 0)
);

create index if not exists idx_subscription_reminders_user_id
  on public.subscription_reminders (user_id);

-- The cron selects upcoming rows by lead time across all users, so this needs the
-- subscription id to be indexed for the join back to subscriptions.
create index if not exists idx_subscription_reminders_subscription_id
  on public.subscription_reminders (subscription_id);

alter table public.subscription_reminders enable row level security;

create policy "subscription_reminders select own"
  on public.subscription_reminders
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "subscription_reminders insert own"
  on public.subscription_reminders
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "subscription_reminders update own"
  on public.subscription_reminders
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "subscription_reminders delete own"
  on public.subscription_reminders
  for delete
  to authenticated
  using (auth.uid() = user_id);