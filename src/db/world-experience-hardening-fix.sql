-- ==============================================================================
-- MANIFOLD CARS 3D WORLD — SAFE CORRECTIVE HARDENING MIGRATION (IDEMPOTENT)
-- ==============================================================================
-- Purpose:
--   Safely patches production database policies, triggers, and RPCs WITHOUT
--   dropping, recreating, or truncating any existing tables or user data.
--   (Run alongside src/db/admin-auth-fix.sql if needed.)
--
-- Fixes applied:
--   1. Eliminates PostgreSQL RLS infinite recursion (42P17) on public.player_presence
--      via a SECURITY DEFINER proximity helper function.
--   2. Hardens public.handle_new_manifold_player() so partial/non-game auth.users
--      inserts never fail with "Database error saving new user".
--   3. Secures public.check_player_registration_available(TEXT, TEXT) against
--      anonymous auth.users email enumeration while preserving nickname checks.
--   4. Hardens search_path and execute scopes cleanly.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FIX RLS INFINITE RECURSION ON public.player_presence
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_viewer_in_proximity(
  p_target_x DOUBLE PRECISION,
  p_target_z DOUBLE PRECISION,
  p_target_player_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_viewer_uid UUID := auth.uid();
  v_timeout_mins INTEGER := 10;
  v_radius DOUBLE PRECISION := 110;
  v_viewer_player_id UUID;
  v_viewer_x DOUBLE PRECISION;
  v_viewer_z DOUBLE PRECISION;
BEGIN
  IF v_viewer_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT
    COALESCE(heartbeat_timeout_minutes, 10),
    COALESCE(discovery_radius, 110)
  INTO v_timeout_mins, v_radius
  FROM public.chat_moderation_config
  WHERE id = 'default';

  SELECT me.player_id, me.pos_x, me.pos_z
  INTO v_viewer_player_id, v_viewer_x, v_viewer_z
  FROM public.player_presence me
  JOIN public.player_profiles my_prof ON my_prof.id = me.player_id
  WHERE me.user_id = v_viewer_uid
    AND me.is_online = true
    AND me.last_heartbeat_at >= NOW() - make_interval(mins => v_timeout_mins)
    AND my_prof.account_status = 'active'
    AND my_prof.onboarding_status = 'active'
  LIMIT 1;

  IF v_viewer_player_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.player_profiles target_prof
    WHERE target_prof.id = p_target_player_id
      AND target_prof.account_status = 'active'
      AND target_prof.onboarding_status = 'active'
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.player_blocks pb
    WHERE (pb.blocker_player_id = v_viewer_player_id AND pb.blocked_player_id = p_target_player_id)
       OR (pb.blocked_player_id = v_viewer_player_id AND pb.blocker_player_id = p_target_player_id)
  ) THEN
    RETURN false;
  END IF;

  RETURN SQRT(POWER(p_target_x - v_viewer_x, 2) + POWER(p_target_z - v_viewer_z, 2)) <= v_radius;
END;
$$;

REVOKE ALL ON FUNCTION public.check_viewer_in_proximity(DOUBLE PRECISION, DOUBLE PRECISION, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_viewer_in_proximity(DOUBLE PRECISION, DOUBLE PRECISION, UUID) TO authenticated;

DROP POLICY IF EXISTS "Authenticated reads active presence" ON public.player_presence;
CREATE POLICY "Authenticated reads active presence" ON public.player_presence
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND (
      user_id = auth.uid()
      OR public.is_active_admin()
      OR (
        is_online = true
        AND last_heartbeat_at >= NOW() - make_interval(
          mins => COALESCE((SELECT heartbeat_timeout_minutes FROM public.chat_moderation_config WHERE id = 'default'), 10)
        )
        AND public.check_viewer_in_proximity(pos_x, pos_z, player_id)
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 2. HARDEN auth.users TRIGGER public.handle_new_manifold_player()
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_manifold_player()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_nickname TEXT;
  v_full_name TEXT;
  v_phone TEXT;
  v_email TEXT;
BEGIN
  v_nickname := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'nickname', '')), '');
  v_full_name := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');
  v_phone := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'phone_number', '')), '');
  v_email := LOWER(NULLIF(BTRIM(COALESCE(NEW.email, '')), ''));

  -- Skip cleanly unless complete, valid MANIFOLD World player signup metadata is present.
  -- Prevents breaking admin/dealer/OAuth auth.users creation with "Database error saving new user".
  IF v_nickname IS NULL OR v_full_name IS NULL OR v_phone IS NULL OR v_email IS NULL THEN
    RETURN NEW;
  END IF;

  IF char_length(v_nickname) < 3 OR char_length(v_nickname) > 20 OR v_nickname !~ '^[A-Za-z0-9_ ]+$' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.player_profiles (
    user_id, full_name, nickname, email, phone_number,
    registration_date, account_status, chat_status, onboarding_status
  ) VALUES (
    NEW.id,
    v_full_name,
    v_nickname,
    v_email,
    v_phone,
    NOW(),
    'active',
    'enabled',
    'registered'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block auth.users signup; get_or_create_my_player_profile() reconciles on first login.
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. CLOSE ANONYMOUS EMAIL ENUMERATION IN check_player_registration_available()
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_player_registration_available(
  p_email TEXT,
  p_nickname TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nick_taken BOOLEAN := false;
BEGIN
  -- Do NOT enumerate auth.users or player emails for anonymous callers.
  -- Auth signUp enforces email uniqueness safely without leaking registered accounts.
  IF p_nickname IS NOT NULL AND BTRIM(p_nickname) <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.player_profiles WHERE lower(nickname) = lower(BTRIM(p_nickname))
    ) INTO v_nick_taken;
  END IF;

  RETURN jsonb_build_object(
    'emailAvailable', true,
    'nicknameAvailable', NOT v_nick_taken
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_player_registration_available(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_player_registration_available(TEXT, TEXT) TO anon, authenticated;
