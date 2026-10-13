-- 017: reminder offsets move from days to minutes
--
-- The Payment Reminder now offers 12 hours / 3 hours / custom, and the
-- automatic day-before reminder is a fixed 24 hours. A day-granular offset
-- cannot express any of those distinctions, so the stored lead for both
-- channels becomes minutes before the renewal date. The renewal date itself is
-- still a DATE; it is anchored to midnight UTC when the offset is measured.
--
-- Both columns are renamed in place and their existing day values are converted,
-- so nothing already stored is lost. The unique key on reminder_deliveries
-- follows the rename, so deliveries already recorded keep suppressing duplicates
-- for the renewals they covered.

alter table public.subscription_reminders
  rename column email_lead_days to email_lead_minutes;

alter table public.subscription_reminders
  rename column push_lead_days to push_lead_minutes;

update public.subscription_reminders
  set email_lead_minutes = email_lead_minutes * 1440;

update public.subscription_reminders
  set push_lead_minutes = push_lead_minutes * 1440;

-- New rows default to a 12-hour heads-up, matching the UI default.
alter table public.subscription_reminders
  alter column email_lead_minutes set default 720;

alter table public.subscription_reminders
  alter column push_lead_minutes set default 720;

alter table public.reminder_deliveries
  rename column lead_days to lead_minutes;

update public.reminder_deliveries
  set lead_minutes = lead_minutes * 1440;
