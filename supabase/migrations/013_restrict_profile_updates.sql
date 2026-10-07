-- ==========================================
-- Migration 013: close privileged-column self-update on profiles.
--
-- Vulnerability: the original "Users can update their own profile" policy
--   USING (auth.uid() = id)
-- had no WITH CHECK filter, so a signed-in user could update ANY column of
-- their own profiles row through the browser, including is_admin, plan_tier,
-- and plan_expires_at. Combined with Supabase's default privileges this let
-- anyone self-promote to admin (is_admin = true) and self-assign a paid tier,
-- defeating every requireAdmin()/plan gate derived from that row.
--
-- Fix (defense in depth, mirroring migrations 005/009):
--  1. RLS: the self-UPDATE policy now also requires the three privileged
--     columns to be UNCHANGED. The committed values are recalled through a
--     SECURITY DEFINER function (the same trick migration 009 uses for
--     is_admin() so the policy does not re-enter RLS on profiles).
--  2. Privileges: anon/authenticated lose UPDATE on the privileged columns
--     entirely, so even a future policy slip cannot touch them.
--  3. The service role and the SECURITY DEFINER routines (update_user_name,
--     set_user_admin, Paystack grant/downgrade helpers) are unaffected — they
--     run as the table owner, outside these restrictions.
-- ==========================================

-- Recall the privileged columns of the CALLING user's row only.
-- SECURITY DEFINER so the WITH CHECK can read them without re-entering RLS on
-- profiles; auth.uid() still resolves to the session's user, so this function
-- cannot be used to read another user's flags.
CREATE OR REPLACE FUNCTION public.own_privileged_profile(
  OUT is_admin boolean,
  OUT plan_tier text,
  OUT plan_expires_at timestamptz
)
RETURNS record
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.is_admin, p.plan_tier, p.plan_expires_at
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.own_privileged_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.own_privileged_profile() TO authenticated;

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update non-privileged profile fields" ON public.profiles;

CREATE POLICY "Users can update non-privileged profile fields"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_admin IS NOT DISTINCT FROM (SELECT o.is_admin FROM public.own_privileged_profile() AS o)
    AND plan_tier IS NOT DISTINCT FROM (SELECT o.plan_tier FROM public.own_privileged_profile() AS o)
    AND plan_expires_at IS NOT DISTINCT FROM (SELECT o.plan_expires_at FROM public.own_privileged_profile() AS o)
  );

-- Defense-in-depth: strip UPDATE on the privileged columns at the privilege
-- layer too, so any future code path that tries to set them from the client
-- fails hard even before RLS is evaluated.
REVOKE UPDATE (is_admin, plan_tier, plan_expires_at) ON public.profiles FROM anon, authenticated;