-- Atomic weekly-recap idempotency for app/api/cron/weekly-recap/route.ts.
--
-- Overlapping cron runs could previously both pass the "already sent" SELECT
-- and each push a recap. The route now claims the week before sending, and
-- this partial unique index is what makes the claim atomic: a concurrent
-- ON CONFLICT DO NOTHING insert loses and skips the send.
--
-- Historical rows carry the old constant title "Weekly recap pushed" (one per
-- user per week), which would collide, so they are stamped with their own
-- date first. Exact same-title duplicates (past double-sends) keep one row.
UPDATE public.activity_log
SET title = 'Weekly recap pushed — ' || to_char(timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE type = 'weekly_recap_pushed'
  AND title = 'Weekly recap pushed';

DELETE FROM public.activity_log a
USING public.activity_log b
WHERE a.type = 'weekly_recap_pushed'
  AND b.type = 'weekly_recap_pushed'
  AND a.user_id = b.user_id
  AND a.title = b.title
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS activity_log_weekly_recap_week_idx
  ON public.activity_log (user_id, title)
  WHERE type = 'weekly_recap_pushed';
