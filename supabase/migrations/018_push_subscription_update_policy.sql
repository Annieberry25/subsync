-- 018: let a device refresh its own push subscription
--
-- The subscribe route upserts on (user_id, endpoint). Postgres runs that as
-- INSERT ... ON CONFLICT DO UPDATE, and the DO UPDATE branch needs an UPDATE
-- policy. Migration 012 defined only INSERT and DELETE, so any second enable for
-- the same endpoint — a VAPID key rotation, or simply toggling notifications off
-- and on — was denied by RLS, returned a 500, and made the client unsubscribe
-- itself. The device then looked "not subscribed" even though the endpoint was
-- fine, and the cron saw no device to push to.
--
-- Scoped by user_id on both USING and WITH CHECK so a row can never be moved to
-- another user.

drop policy if exists "push_subscriptions update own" on public.push_subscriptions;
create policy "push_subscriptions update own"
  on public.push_subscriptions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
