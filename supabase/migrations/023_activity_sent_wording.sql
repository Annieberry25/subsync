-- The activity feed is user-facing: internal channel jargon ("pushed") leaked
-- into Past Activities. New writes say "sent"; this migration normalizes the
-- rows that were already recorded so the feed reads one way everywhere.
--
-- Types stay compatible with the idempotency machinery:
--   * reminder rows move from 'reminder_pushed' to 'reminder_sent', the type the
--     email path has always written, so the "Reminders Sent" filter covers both;
--   * weekly-recap and smart-insight rows keep their types (migration 020's
--     unique claim index and the insight re-announce check query those types),
--     only their visible titles change. The (user_id, title) rewrite is
--     injective, so no unique-index collision is possible.

UPDATE activity_log
SET type = 'reminder_sent',
    title = 'Renewal reminder sent'
WHERE type = 'reminder_pushed';

UPDATE activity_log
SET title = replace(title, 'Weekly recap pushed', 'Weekly recap sent')
WHERE type = 'weekly_recap_pushed'
  AND title LIKE '%Weekly recap pushed%';

UPDATE activity_log
SET title = 'Insight notification sent'
WHERE type = 'smart_insight_pushed'
  AND title = 'Insight notification pushed';
