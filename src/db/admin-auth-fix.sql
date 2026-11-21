-- ==============================================================================
-- MANIFOLD — Idempotent Admin Authorization & user_id Linking Repair Script
-- Safe to run multiple times in Supabase SQL Editor.
-- Preserves all RLS guarantees, supports both TEXT and ENUM role/status columns,
-- backfills unlinked admin_users.user_id from auth.users, and aligns
-- public.is_admin() / public.is_active_admin() with server verification.
-- ==============================================================================

-- 1. Backfill admin_users.user_id from auth.users where email matches and user_id is NULL
DO $$
DECLARE
  has_email_col BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_users'
      AND column_name = 'email'
  ) INTO has_email_col;

  IF has_email_col THEN
    -- Ensure lead admin row exists and is active/admin (idempotent)
    INSERT INTO public.admin_users (email, name, role, status)
    VALUES ('newwavereporters@gmail.com', 'MANIFOLD Lead Administrator', 'admin', 'active')
    ON CONFLICT (email) DO UPDATE
      SET status = 'active',
          role = 'admin';

    -- Link any unlinked admin_users row to its matching auth.users UUID
    UPDATE public.admin_users au
    SET user_id = u.id,
        updated_at = NOW()
    FROM auth.users u
    WHERE au.user_id IS NULL
      AND au.email IS NOT NULL
      AND u.email IS NOT NULL
      AND lower(au.email) = lower(u.email);
  END IF;
END $$;

-- 2. Harden public.is_admin() and public.is_active_admin() (SECURITY DEFINER)
-- Works whether role/status are TEXT or ENUM (admin_role / user_status) via ::TEXT cast.
-- Checks user_id = auth.uid() AND (when email column exists) safe unlinked email match.
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  uid UUID := auth.uid();
  jwt_email TEXT := lower(COALESCE(auth.jwt()->>'email', ''));
  matched BOOLEAN := false;
  has_email_col BOOLEAN := false;
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  -- Primary authoritative check by user_id
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = uid
      AND lower(status::TEXT) = 'active'
      AND lower(role::TEXT) IN ('admin', 'super_admin', 'superadmin', 'administrator')
  ) INTO matched;

  IF matched THEN
    RETURN true;
  END IF;

  -- Secondary check for unlinked rows matching verified JWT email
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_users'
      AND column_name = 'email'
  ) INTO has_email_col;

  IF has_email_col AND jwt_email <> '' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE user_id IS NULL
        AND lower(email) = jwt_email
        AND lower(status::TEXT) = 'active'
        AND lower(role::TEXT) IN ('admin', 'super_admin', 'superadmin', 'administrator')
    ) INTO matched;
  END IF;

  RETURN matched;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT public.is_active_admin();
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated, service_role;

-- 3. Tighten self-read RLS policy on public.admin_users
-- Allows reading own row by user_id = auth.uid(), OR an unlinked row matching verified JWT email
DO $$
DECLARE
  has_email_col BOOLEAN := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_users'
      AND column_name = 'email'
  ) INTO has_email_col;

  DROP POLICY IF EXISTS "Self read admin authorization" ON public.admin_users;

  IF has_email_col THEN
    CREATE POLICY "Self read admin authorization" ON public.admin_users
      FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid()
        OR (
          user_id IS NULL
          AND lower(email) = lower(COALESCE(auth.jwt()->>'email', ''))
        )
      );
  ELSE
    CREATE POLICY "Self read admin authorization" ON public.admin_users
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
