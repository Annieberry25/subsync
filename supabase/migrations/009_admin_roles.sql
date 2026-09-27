-- ==========================================
-- Migration 009: Admin roles.
--
-- Adds profiles.is_admin (server-side source of truth for who can reach the
-- /admin area) and grants admins read-access across the app's tables so the
-- admin console can browse users, payments, providers, and audit activity.
--
-- Security model:
--  - is_admin lives in the profiles row; the browser client can read its own
--    row (existing policy already covers this), so middleware/app code can
--    gate on it without extra tools.
--  - Admin SELECT policies only every return rows when the caller's profile
--    has is_admin = true. Writes stay server-side via the service role:
--    admins can NOT write plan_subscriptions, gmail_connections, etc. from
--    the browser.
--  - gmail_connections intentionally gets NO admin RLS policy (it holds
--    OAuth tokens) — it is only reachable through service-role API routes.
--  - set_user_admin() is a SECURITY DEFINER function so only an existing
--    admin can promote another account, and it refuses to demote the last
--    remaining admin (prevents lockout).
-- ==========================================

-- ------------------------------------------
-- 1. PROFILES: admin flag
-- ------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin
  ON public.profiles (is_admin)
  WHERE is_admin;

-- ------------------------------------------
-- 2. Admin read policies (scoped to is_admin callers)
--
-- is_admin() is SECURITY DEFINER so the check reads the profiles row WITHOUT
-- re-triggering RLS on profiles. A plain EXISTS(SELECT ... FROM profiles) in a
-- policy's USING clause re-evaluates the profiles policies for every row and
-- causes "infinite recursion detected in policy for relation profiles".
-- ------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all bill payments" ON public.bill_payments;
CREATE POLICY "Admins can view all bill payments"
  ON public.bill_payments FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all plan subscriptions" ON public.plan_subscriptions;
CREATE POLICY "Admins can view all plan subscriptions"
  ON public.plan_subscriptions FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all activity log" ON public.activity_log;
CREATE POLICY "Admins can view all activity log"
  ON public.activity_log FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all ai conversations" ON public.ai_conversations;
CREATE POLICY "Admins can view all ai conversations"
  ON public.ai_conversations FOR SELECT
  USING (public.is_admin());

-- ------------------------------------------
-- 3. Safe admin promotion helper (SECURITY DEFINER)
-- ------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_admin(target_user_id uuid, make_admin boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_caller boolean;
  admin_count integer;
BEGIN
  -- Only an existing admin may promote/demote (auth.uid() is the caller).
  SELECT is_admin INTO is_admin_caller
  FROM public.profiles
  WHERE id = auth.uid();

  IF is_admin_caller IS NOT TRUE THEN
    RAISE EXCEPTION 'Only an admin can manage admin roles';
  END IF;

  -- Never demote the last remaining admin (prevents lockout).
  IF NOT make_admin THEN
    SELECT count(*) INTO admin_count
    FROM public.profiles
    WHERE is_admin = true;

    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last remaining admin';
    END IF;
  END IF;

  UPDATE public.profiles
  SET is_admin = make_admin
  WHERE id = target_user_id;

  RETURN jsonb_build_object('id', target_user_id, 'is_admin', make_admin);
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_admin(uuid, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_admin(uuid, boolean) TO authenticated;

-- ------------------------------------------
-- 4. Bootstrap your own account as the first admin.
--    Run once (e.g. in the Supabase SQL editor) AFTER applying this migration:
--
--      UPDATE public.profiles SET is_admin = true
--      WHERE email = 'YOUR_EMAIL_HERE';
-- ------------------------------------------