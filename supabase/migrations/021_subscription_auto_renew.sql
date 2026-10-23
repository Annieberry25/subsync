-- Auto-renewal flag for subscriptions. Default off: the app renews manually
-- through the renew button, which turns the flag on per subscription.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false;
