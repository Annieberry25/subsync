# How Reminders Work (subsync)

Confirmed against `lib/reminders/plan.ts`, `lib/reminders/dates.ts`, and
`lib/reminders/run-reminders.ts`.

## Push notifications

| Timing | Channels |
|--------|----------|
| 10 days before renewal | Push only |
| 5 days before renewal | Push + Email |
| 2 days before renewal | Push + Email |
| 1 day before renewal | Push + Email |
| 12 hours before renewal | Push only (second call) |
| Morning of renewal day | Push + Email |
| Evening of renewal day | Push only |
| Day 1 overdue | Email |
| Day 2 overdue | Push only |
| Day 3 overdue | Push only |

**No reminder on day 3 before renewal** — that stage was removed.

Per renewal, a user can receive push + email at 5/2/1 days, push at 10 days and 12h,
push + email on the morning of renewal day, push on the evening of renewal day,
and overdue notices (email day 1, push days 2-3).

## Email notifications

| Timing | Channels |
|--------|----------|
| 5 days before renewal | Email + Push |
| 2 days before renewal | Email + Push |
| 1 day before renewal | Email + Push |
| Morning of renewal day | Email + Push |
| Day 1 overdue | Email |

Email is **not** sent at 10 days before renewal (push only there). Email is
**not** sent on the evening of renewal day or on overdue days 2-3 (push only).

## Key design rules

- **One notification per stage, per channel** — tracked in `reminder_deliveries`
  so nothing is sent twice for the same renewal.
- **Day-exact windows** — each countdown and overdue stage fires only on its
  calendar day (`isDue: (d) => d === countDay`). A missed day is not owed later;
  a "10 days before" push never arrives late as "renews in 8 days."
- **Closest stage wins per channel** — if multiple windows are open at once
  (e.g. after a missed cron run), only the most urgent is sent.
- **Push and email are independent** — a user with push but no email gets push
  only; both channels get their own schedule.
- **Cancelled/deleted subscriptions** — `remindersAllowed()` returns false for
  non-active rows, so no pre-charge reminders. At delivery time, renewal-day and
  overdue stages are also skipped if the subscription is no longer active.
- **Renewed subscriptions** — when `next_billing_date` changes, the new date
  creates a new delivery key, so morning-of-renewal (email + push) and
  evening-of-renewal (push only) fire for the new date.

## Date accuracy

Push, email, and the in-app inbox all use the same UTC calendar-day count
(`daysUntilRenewal` from `daysBetween()`), so they always agree. `humanizeRenewal()`
in `run-reminders.ts` uses calendar days for day-level labels and minutes only
for sub-day precision (hours/minutes).
