-- 022: renewal-day and overdue reminder stages
--
-- Two stage groups join the renewal-reminder planner:
--
--   * The repayment-day stages. A subscription that renews TODAY is sent one
--     push when the day starts and a second push twelve hours later, plus one
--     email, so the day a charge goes out is unmistakable. Their delivery
--     keys are lead offsets of 0 and -720: a non-negative lead was enough for
--     every pre-charge stage, but "on the day" and "twelve hours into the day"
--     cannot be written while the column insists offsets are positive.
--
--   * The overdue stages. A renewal the calendar has passed is pushed once
--     every day (each overdue day carrying its own key, so a missed morning
--     run still sends on the evening run and the next day starts a fresh copy)
--     and emailed exactly once per overdue lapse (one fixed key for the whole
--     lapse). The planner only emits these within the 30-day overdue window
--     the queries bound.
--
-- The old rule was written under the assumption that a reminder can only fire
-- BEFORE a renewal. The ledger's uniqueness on
-- (subscription_id, renewal_date, lead_minutes, channel) is the part that stops
-- double sends and it does not care what sign the offset carries, so the check
-- outlived its meaning. It is replaced by a bounded window that still rejects
-- nonsense keys while leaving every stage the planner can emit representable:
-- thirty-one days of minutes on either side is wider than the 30-day user
-- custom lead above and wider than the bounded overdue window below.

alter table public.reminder_deliveries
  drop constraint if exists reminder_deliveries_lead_days_check,
  drop constraint if exists reminder_deliveries_lead_minutes_check;

alter table public.reminder_deliveries
  add constraint reminder_deliveries_lead_minutes_window
  check (lead_minutes between -44640 and 44640);
