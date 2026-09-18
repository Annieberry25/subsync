-- ==========================================
-- Migration 003: enforce the name-change cooldown inside the database.
--
-- Previously the 30-day window was checked + recorded by the API route using the
-- client role (anon key), which the browser could call directly via PostgREST and
-- backdate name_change_log.last_changed_at to bypass the wait. The cooldown is now
-- authoritative in a SECURITY DEFINER function that checks and records atomically,
-- and the client roles lose direct CRUD on the table.
-- ==========================================

-- Result composite returned to callers.
DO $$
BEGIN
  CREATE TYPE public.name_change_result AS (
    success boolean,
    message text,
    last_changed_at timestamptz,
    next_allowed_at timestamptz
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Single authority for cooldown check + profile update + cooldown record.
CREATE OR REPLACE FUNCTION public.update_user_name(p_full_name text)
RETURNS public.name_change_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_last_changed timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN ROW(false, 'Not authenticated.', NULL, NULL)::public.name_change_result;
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 OR length(p_full_name) > 100 THEN
    RETURN ROW(false, 'Name must be between 1 and 100 characters.', NULL, NULL)::public.name_change_result;
  END IF;

  -- Lock the row so concurrent requests cannot both pass the cooldown check.
  SELECT last_changed_at INTO v_last_changed
  FROM public.name_change_log
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_last_changed IS NOT NULL THEN
    IF v_now < (v_last_changed + interval '30 days') THEN
      RETURN ROW(
        false,
        'Name can only be changed once every 30 days.',
        v_last_changed,
        (v_last_changed + interval '30 days')
      )::public.name_change_result;
    END IF;
  END IF;

  -- Authoritative record of the change (atomic with the check above).
  INSERT INTO public.name_change_log (user_id, last_changed_at, updated_at)
  VALUES (v_user_id, v_now, v_now)
  ON CONFLICT (user_id)
  DO UPDATE SET last_changed_at = EXCLUDED.last_changed_at,
                updated_at = EXCLUDED.updated_at;

  UPDATE public.profiles
  SET full_name = trim(p_full_name), updated_at = v_now
  WHERE id = v_user_id;

  RETURN ROW(true, 'Name updated.', v_now, NULL)::public.name_change_result;
END;
$$;

-- Strip client CRUD; only the SECURITY DEFINER function may touch this table now.
REVOKE ALL ON public.name_change_log FROM anon, authenticated;

DROP POLICY IF EXISTS "Users can view their own name change log" ON public.name_change_log;
DROP POLICY IF EXISTS "Users can insert their own name change log" ON public.name_change_log;
DROP POLICY IF EXISTS "Users can update their own name change log" ON public.name_change_log;
DROP POLICY IF EXISTS "Users can delete their own name change log" ON public.name_change_log;

GRANT EXECUTE ON FUNCTION public.update_user_name(text) TO authenticated;