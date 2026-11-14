-- ==============================================================================
-- MANIFOLD CARS 3D — HARDENED SECURITY, REGISTERED PLAYER WORLD, PRESENCE,
-- PROXIMITY DISCOVERY, SEPARATED ACCOUNT/CHAT STATUS, MODERATION & AUDIT MIGRATION
-- Strictly additive & idempotent. Preserves all marketplace/dealer/admin tables.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 0. ADMIN AUTHORIZATION HELPERS (Preserves existing public.admin_users & RLS policies)
-- Expects existing public.admin_users(id, user_id, role::admin_role, status::user_status, ...).
-- Does NOT create, drop, alter, truncate, insert into, or recreate policies on admin_users.
-- Uses CREATE OR REPLACE FUNCTION so existing RLS policies depending on is_admin()
-- and is_active_admin() remain intact.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role = 'admin'::admin_role
      AND status = 'active'::user_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role = 'admin'::admin_role
      AND status = 'active'::user_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 1. PLAYER PROFILES (Private PII + Onboarding + 24h Lock + Separated Statuses)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nickname TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  registration_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended')),
  chat_status TEXT NOT NULL DEFAULT 'enabled'
    CHECK (chat_status IN ('enabled', 'temporarily_restricted', 'permanently_restricted')),
  onboarding_status TEXT NOT NULL DEFAULT 'registered'
    CHECK (onboarding_status IN ('registered', 'briefing_accepted', 'active')),
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  terms_version TEXT,
  terms_accepted_at TIMESTAMPTZ,
  selected_vehicle TEXT
    CHECK (selected_vehicle IS NULL OR selected_vehicle IN ('SPORTS_COUPE', 'LUXURY_SUV', 'EXECUTIVE_SEDAN', 'RUGGED_4X4')),
  selected_vehicle_color TEXT,
  selected_interior TEXT
    CHECK (selected_interior IS NULL OR selected_interior IN ('BLACK', 'CREAM', 'BROWN', 'GREY', 'SPORT')),
  selected_music_preference TEXT
    CHECK (selected_music_preference IS NULL OR selected_music_preference IN ('AFROBEATS', 'HIP_HOP', 'RNB', 'GOSPEL', 'INSTRUMENTAL', 'ELECTRONIC_HOUSE', 'NO_MUSIC')),
  settings_confirmed_at TIMESTAMPTZ,
  settings_lock_expires_at TIMESTAMPTZ,
  credits_balance INTEGER NOT NULL DEFAULT 5000,
  chat_violation_count INTEGER NOT NULL DEFAULT 0,
  chat_restricted_until TIMESTAMPTZ,
  chat_restriction_reason TEXT,
  suspended_at TIMESTAMPTZ,
  suspended_reason TEXT,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe ALTER TABLE upgrades for existing deployments that ran the earlier schema
ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS chat_status TEXT NOT NULL DEFAULT 'enabled',
  ADD COLUMN IF NOT EXISTS chat_restriction_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- Migrate any legacy account_status = 'chat_restricted' rows cleanly to separated chat_status
DO $$
DECLARE
  v_con RECORD;
BEGIN
  -- Drop legacy CHECK constraints on account_status / chat_status before re-adding cleanly
  FOR v_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.player_profiles'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%account_status%'
        OR pg_get_constraintdef(oid) ILIKE '%chat_status%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.player_profiles DROP CONSTRAINT %I', v_con.conname);
  END LOOP;

  UPDATE public.player_profiles
  SET
    chat_status = CASE
      WHEN account_status = 'chat_restricted' THEN 'temporarily_restricted'
      ELSE COALESCE(NULLIF(chat_status, ''), 'enabled')
    END,
    account_status = CASE
      WHEN account_status = 'chat_restricted' THEN 'active'
      ELSE account_status
    END
  WHERE account_status = 'chat_restricted' OR chat_status IS NULL;

  ALTER TABLE public.player_profiles
    ADD CONSTRAINT player_profiles_account_status_check
      CHECK (account_status IN ('active', 'suspended'));

  ALTER TABLE public.player_profiles
    ADD CONSTRAINT player_profiles_chat_status_check
      CHECK (chat_status IN ('enabled', 'temporarily_restricted', 'permanently_restricted'));
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_profiles_nickname_lower
  ON public.player_profiles (lower(nickname));
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_profiles_email_lower
  ON public.player_profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_player_profiles_status
  ON public.player_profiles (account_status, chat_status, onboarding_status);

-- ------------------------------------------------------------------------------
-- 2. PLAYER PRESENCE (Public in-game telemetry ONLY — zero PII)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_presence (
  player_id UUID PRIMARY KEY REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  vehicle_model TEXT NOT NULL DEFAULT 'SPORTS_COUPE',
  paint_color TEXT NOT NULL DEFAULT '#DC2626',
  world_region TEXT NOT NULL DEFAULT 'Lagos Island',
  pos_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  pos_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  pos_z DOUBLE PRECISION NOT NULL DEFAULT 10,
  heading DOUBLE PRECISION NOT NULL DEFAULT 3.14159,
  speed DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_online BOOLEAN NOT NULL DEFAULT true,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_presence_active
  ON public.player_presence (is_online, last_heartbeat_at DESC);

-- ------------------------------------------------------------------------------
-- 3. CHAT INVITATIONS (30s expiring proximity chat requests)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  recipient_player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 seconds'),
  responded_at TIMESTAMPTZ,
  CHECK (sender_player_id <> recipient_player_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_invitations_recipient
  ON public.chat_invitations (recipient_player_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_invitations_sender
  ON public.chat_invitations (sender_player_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. CHAT CONVERSATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  player_b_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (player_a_id <> player_b_id),
  UNIQUE (player_a_id, player_b_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_players
  ON public.chat_conversations (player_a_id, player_b_id, status);

-- ------------------------------------------------------------------------------
-- 5. CHAT MESSAGES (Moderated messages, 500 chars max)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  moderation_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('approved', 'rejected', 'flagged_review')),
  moderation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
  v_con RECORD;
BEGIN
  FOR v_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.chat_messages'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%moderation_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.chat_messages DROP CONSTRAINT %I', v_con.conname);
  END LOOP;

  ALTER TABLE public.chat_messages
    ADD CONSTRAINT chat_messages_moderation_status_check
      CHECK (moderation_status IN ('approved', 'rejected', 'flagged_review'));
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_time
  ON public.chat_messages (conversation_id, created_at ASC);

-- ------------------------------------------------------------------------------
-- 6. PLAYER BLOCKS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  blocked_player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (blocker_player_id <> blocked_player_id),
  UNIQUE (blocker_player_id, blocked_player_id)
);

-- ------------------------------------------------------------------------------
-- 7. PLAYER REPORTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporting_player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  reported_player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  description TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'reviewed', 'action_taken', 'dismissed')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reporting_player_id <> reported_player_id)
);

-- ------------------------------------------------------------------------------
-- 8. MODERATION INCIDENTS, IMMUTABLE ADMIN AUDIT LOGS & RULE CONFIG
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  attempted_content TEXT NOT NULL,
  violation_category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'blocked'
    CHECK (severity IN ('blocked', 'flagged_for_review', 'cleared')),
  action_taken TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.moderation_incidents
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'blocked';

DO $$
DECLARE
  v_con RECORD;
BEGIN
  FOR v_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.moderation_incidents'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%severity%'
  LOOP
    EXECUTE format('ALTER TABLE public.moderation_incidents DROP CONSTRAINT %I', v_con.conname);
  END LOOP;

  ALTER TABLE public.moderation_incidents
    ADD CONSTRAINT moderation_incidents_severity_check
      CHECK (severity IN ('blocked', 'flagged_for_review', 'cleared'));
END $$;

CREATE TABLE IF NOT EXISTS public.player_admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  admin_email TEXT NOT NULL,
  player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(BTRIM(reason)) >= 3),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_admin_audit_player_time
  ON public.player_admin_audit_logs (player_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_player_admin_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'player_admin_audit_logs records are immutable and cannot be modified or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_player_admin_audit_mutation ON public.player_admin_audit_logs;
CREATE TRIGGER trg_prevent_player_admin_audit_mutation
  BEFORE UPDATE OR DELETE ON public.player_admin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_player_admin_audit_mutation();

CREATE TABLE IF NOT EXISTS public.chat_moderation_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  max_message_length INTEGER NOT NULL DEFAULT 500,
  discovery_radius DOUBLE PRECISION NOT NULL DEFAULT 110,
  heartbeat_timeout_minutes INTEGER NOT NULL DEFAULT 10,
  invite_expiry_seconds INTEGER NOT NULL DEFAULT 30,
  warning_threshold INTEGER NOT NULL DEFAULT 2,
  temp_restriction_minutes INTEGER NOT NULL DEFAULT 15,
  suspension_threshold INTEGER NOT NULL DEFAULT 6,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.chat_moderation_config (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (STRICT LEAST-PRIVILEGE, NO GLOBAL DIRECTORY, NO PRIVATE CHAT SNOOPING)
-- ------------------------------------------------------------------------------
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_moderation_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_player_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.player_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- player_profiles policies (private PII: ONLY owning player or active admin)
DROP POLICY IF EXISTS "Player reads own profile" ON public.player_profiles;
CREATE POLICY "Player reads own profile" ON public.player_profiles
  FOR SELECT USING (auth.uid() = user_id OR public.is_active_admin());

DROP POLICY IF EXISTS "Admin manages player profiles" ON public.player_profiles;
CREATE POLICY "Admin manages player profiles" ON public.player_profiles
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- player_presence policies (proximity-bounded! No global player directory dump via SELECT)
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
        AND EXISTS (
          SELECT 1
          FROM public.player_presence me
          JOIN public.player_profiles my_prof ON my_prof.id = me.player_id
          WHERE me.user_id = auth.uid()
            AND me.is_online = true
            AND me.last_heartbeat_at >= NOW() - make_interval(
              mins => COALESCE((SELECT heartbeat_timeout_minutes FROM public.chat_moderation_config WHERE id = 'default'), 10)
            )
            AND my_prof.account_status = 'active'
            AND my_prof.onboarding_status = 'active'
            AND SQRT(POWER(player_presence.pos_x - me.pos_x, 2) + POWER(player_presence.pos_z - me.pos_z, 2))
                <= COALESCE((SELECT discovery_radius FROM public.chat_moderation_config WHERE id = 'default'), 110)
        )
        AND EXISTS (
          SELECT 1 FROM public.player_profiles target_prof
          WHERE target_prof.id = player_presence.player_id
            AND target_prof.account_status = 'active'
            AND target_prof.onboarding_status = 'active'
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.player_blocks pb
          WHERE (pb.blocker_player_id = public.current_player_id() AND pb.blocked_player_id = player_presence.player_id)
             OR (pb.blocked_player_id = public.current_player_id() AND pb.blocker_player_id = player_presence.player_id)
        )
      )
    )
  );

-- chat_invitations policies (only sender or recipient participants)
DROP POLICY IF EXISTS "Participants read invitations" ON public.chat_invitations;
CREATE POLICY "Participants read invitations" ON public.chat_invitations
  FOR SELECT USING (
    sender_player_id = public.current_player_id()
    OR recipient_player_id = public.current_player_id()
  );

-- chat_conversations policies (strictly participants only; admins do not browse private chat sessions)
DROP POLICY IF EXISTS "Participants read conversations" ON public.chat_conversations;
CREATE POLICY "Participants read conversations" ON public.chat_conversations
  FOR SELECT USING (
    player_a_id = public.current_player_id()
    OR player_b_id = public.current_player_id()
  );

-- chat_messages policies (strictly participants only for non-rejected messages; admins inspect incidents/reports instead)
DROP POLICY IF EXISTS "Participants read approved messages" ON public.chat_messages;
CREATE POLICY "Participants read approved messages" ON public.chat_messages
  FOR SELECT USING (
    moderation_status IN ('approved', 'flagged_review')
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND (c.player_a_id = public.current_player_id() OR c.player_b_id = public.current_player_id())
    )
  );

-- player_blocks policies (only blocker sees their own blocks, or admin)
DROP POLICY IF EXISTS "Player reads own blocks" ON public.player_blocks;
CREATE POLICY "Player reads own blocks" ON public.player_blocks
  FOR SELECT USING (
    blocker_player_id = public.current_player_id()
    OR public.is_active_admin()
  );

-- player_reports policies (reporter or admin)
DROP POLICY IF EXISTS "Reporter or admin reads reports" ON public.player_reports;
CREATE POLICY "Reporter or admin reads reports" ON public.player_reports
  FOR SELECT USING (
    reporting_player_id = public.current_player_id()
    OR public.is_active_admin()
  );

DROP POLICY IF EXISTS "Admin updates reports" ON public.player_reports;
CREATE POLICY "Admin updates reports" ON public.player_reports
  FOR UPDATE USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- moderation_incidents, audit logs & config
DROP POLICY IF EXISTS "Admin reads moderation incidents" ON public.moderation_incidents;
CREATE POLICY "Admin reads moderation incidents" ON public.moderation_incidents
  FOR SELECT USING (public.is_active_admin());

DROP POLICY IF EXISTS "Admin reads player audit logs" ON public.player_admin_audit_logs;
CREATE POLICY "Admin reads player audit logs" ON public.player_admin_audit_logs
  FOR SELECT USING (public.is_active_admin());

DROP POLICY IF EXISTS "Authenticated reads moderation config" ON public.chat_moderation_config;
CREATE POLICY "Authenticated reads moderation config" ON public.chat_moderation_config
  FOR SELECT USING (auth.role() = 'authenticated' OR public.is_active_admin());

DROP POLICY IF EXISTS "Admin updates moderation config" ON public.chat_moderation_config;
CREATE POLICY "Admin updates moderation config" ON public.chat_moderation_config
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- ------------------------------------------------------------------------------
-- 10. AUTHORITATIVE AUTH SYNC TRIGGER (Fails visibly on invalid player signups)
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
  -- Only provision a game player profile if nickname metadata was supplied (leaves admin/dealer signups untouched)
  v_nickname := NULLIF(BTRIM(NEW.raw_user_meta_data->>'nickname'), '');
  IF v_nickname IS NULL THEN
    RETURN NEW;
  END IF;

  IF char_length(v_nickname) < 3 OR char_length(v_nickname) > 20 OR v_nickname !~ '^[A-Za-z0-9_ ]+$' THEN
    RAISE EXCEPTION 'Nickname must be 3 to 20 characters using letters, numbers, spaces, or underscores';
  END IF;

  v_full_name := NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), '');
  v_phone := NULLIF(BTRIM(NEW.raw_user_meta_data->>'phone_number'), '');
  v_email := LOWER(NULLIF(BTRIM(COALESCE(NEW.email, '')), ''));

  IF v_full_name IS NULL OR v_phone IS NULL OR v_email IS NULL THEN
    RAISE EXCEPTION 'Player registration requires full_name, nickname, email, and phone_number';
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
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_manifold_player ON auth.users;
CREATE TRIGGER on_auth_user_created_manifold_player
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_manifold_player();

-- ------------------------------------------------------------------------------
-- 11. REGISTRATION & ONBOARDING RPCs
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_player_registration_available(
  p_email TEXT,
  p_nickname TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_email_taken BOOLEAN := false;
  v_nick_taken BOOLEAN := false;
BEGIN
  IF p_email IS NOT NULL AND BTRIM(p_email) <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.player_profiles WHERE lower(email) = lower(BTRIM(p_email))
    ) OR EXISTS (
      SELECT 1 FROM auth.users WHERE lower(email) = lower(BTRIM(p_email))
    ) INTO v_email_taken;
  END IF;

  IF p_nickname IS NOT NULL AND BTRIM(p_nickname) <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.player_profiles WHERE lower(nickname) = lower(BTRIM(p_nickname))
    ) INTO v_nick_taken;
  END IF;

  RETURN jsonb_build_object(
    'emailAvailable', NOT v_email_taken,
    'nicknameAvailable', NOT v_nick_taken
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_my_player_profile(
  p_full_name TEXT DEFAULT NULL,
  p_nickname TEXT DEFAULT NULL,
  p_phone_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_auth_email TEXT;
  v_meta JSONB;
  v_profile public.player_profiles%ROWTYPE;
  v_nick TEXT;
  v_name TEXT;
  v_phone TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile FROM public.player_profiles WHERE user_id = v_uid;

  IF NOT FOUND THEN
    SELECT email, raw_user_meta_data INTO v_auth_email, v_meta FROM auth.users WHERE id = v_uid;
    v_nick := NULLIF(BTRIM(COALESCE(p_nickname, v_meta->>'nickname', '')), '');
    v_name := NULLIF(BTRIM(COALESCE(p_full_name, v_meta->>'full_name', '')), '');
    v_phone := NULLIF(BTRIM(COALESCE(p_phone_number, v_meta->>'phone_number', '')), '');

    IF v_nick IS NULL OR v_name IS NULL OR v_phone IS NULL OR COALESCE(v_auth_email, '') = '' THEN
      RAISE EXCEPTION 'Player profile incomplete. Please register with full name, nickname, email, and phone number.';
    END IF;

    INSERT INTO public.player_profiles (
      user_id, full_name, nickname, email, phone_number,
      registration_date, account_status, chat_status, onboarding_status
    ) VALUES (
      v_uid, v_name, v_nick, LOWER(v_auth_email), v_phone,
      NOW(), 'active', 'enabled', 'registered'
    )
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_profile FROM public.player_profiles WHERE user_id = v_uid;
  END IF;

  -- Expire temporary chat restriction automatically using database time (never touches account_status)
  IF v_profile.chat_status = 'temporarily_restricted'
     AND v_profile.chat_restricted_until IS NOT NULL
     AND v_profile.chat_restricted_until <= NOW() THEN
    UPDATE public.player_profiles
    SET
      chat_status = 'enabled',
      chat_restricted_until = NULL,
      chat_restriction_reason = NULL,
      updated_at = NOW()
    WHERE id = v_profile.id
    RETURNING * INTO v_profile;
  END IF;

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'serverNow', NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_game_briefing(
  p_terms_version TEXT DEFAULT '2026-11-v1'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile public.player_profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile FROM public.player_profiles WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player profile not found';
  END IF;

  IF v_profile.account_status = 'suspended' THEN
    RAISE EXCEPTION 'Account is suspended';
  END IF;

  UPDATE public.player_profiles
  SET
    terms_accepted = true,
    terms_version = COALESCE(NULLIF(BTRIM(p_terms_version), ''), '2026-11-v1'),
    terms_accepted_at = COALESCE(terms_accepted_at, NOW()),
    onboarding_status = CASE
      WHEN onboarding_status = 'registered' THEN 'briefing_accepted'
      ELSE onboarding_status
    END,
    last_activity_at = NOW(),
    updated_at = NOW()
  WHERE id = v_profile.id
  RETURNING * INTO v_profile;

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'serverNow', NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_vehicle_configuration(
  p_vehicle TEXT,
  p_color TEXT,
  p_interior TEXT,
  p_music TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile public.player_profiles%ROWTYPE;
  v_remaining INTERVAL;
  v_hours INTEGER;
  v_mins INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile FROM public.player_profiles WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player profile not found';
  END IF;

  IF NOT v_profile.terms_accepted OR v_profile.onboarding_status = 'registered' THEN
    RAISE EXCEPTION 'Mandatory game briefing and terms must be accepted first';
  END IF;

  IF v_profile.account_status = 'suspended' THEN
    RAISE EXCEPTION 'Account is suspended';
  END IF;

  IF p_vehicle NOT IN ('SPORTS_COUPE', 'LUXURY_SUV', 'EXECUTIVE_SEDAN', 'RUGGED_4X4')
     OR NULLIF(BTRIM(COALESCE(p_color, '')), '') IS NULL
     OR p_interior NOT IN ('BLACK', 'CREAM', 'BROWN', 'GREY', 'SPORT')
     OR p_music NOT IN ('AFROBEATS', 'HIP_HOP', 'RNB', 'GOSPEL', 'INSTRUMENTAL', 'ELECTRONIC_HOUSE', 'NO_MUSIC') THEN
    RAISE EXCEPTION 'Invalid vehicle configuration parameters';
  END IF;

  IF v_profile.settings_lock_expires_at IS NOT NULL AND v_profile.settings_lock_expires_at > NOW() THEN
    v_remaining := v_profile.settings_lock_expires_at - NOW();
    v_hours := FLOOR(EXTRACT(EPOCH FROM v_remaining) / 3600)::INTEGER;
    v_mins := FLOOR((EXTRACT(EPOCH FROM v_remaining) % 3600) / 60)::INTEGER;
    RAISE EXCEPTION 'VEHICLE_CONFIGURATION_LOCKED: Your vehicle configuration is locked for %h %m (until %)',
      v_hours, v_mins, to_char(v_profile.settings_lock_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS UTC');
  END IF;

  UPDATE public.player_profiles
  SET
    selected_vehicle = p_vehicle,
    selected_vehicle_color = BTRIM(p_color),
    selected_interior = p_interior,
    selected_music_preference = p_music,
    settings_confirmed_at = NOW(),
    settings_lock_expires_at = NOW() + INTERVAL '24 hours',
    onboarding_status = 'active',
    last_activity_at = NOW(),
    updated_at = NOW()
  WHERE id = v_profile.id
  RETURNING * INTO v_profile;

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'serverNow', NOW()
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 12. PRESENCE HEARTBEAT, EXPIRATION & SERVER-AUTHORITATIVE PROXIMITY DISCOVERY
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.heartbeat_player_presence(
  p_x DOUBLE PRECISION,
  p_y DOUBLE PRECISION,
  p_z DOUBLE PRECISION,
  p_heading DOUBLE PRECISION,
  p_speed DOUBLE PRECISION,
  p_region TEXT DEFAULT 'Lagos Island'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile public.player_profiles%ROWTYPE;
  v_cfg public.chat_moderation_config%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile FROM public.player_profiles WHERE user_id = v_uid;
  IF NOT FOUND OR NOT v_profile.terms_accepted OR v_profile.onboarding_status <> 'active' THEN
    RAISE EXCEPTION 'Completed onboarding required before entering active world presence';
  END IF;

  IF v_profile.account_status <> 'active' THEN
    RAISE EXCEPTION 'Account is suspended';
  END IF;

  SELECT * INTO v_cfg FROM public.chat_moderation_config WHERE id = 'default';

  -- Sweep inactive players past configured timeout & expire stale invitations
  UPDATE public.player_presence
  SET is_online = false, updated_at = NOW()
  WHERE is_online = true
    AND last_heartbeat_at < NOW() - make_interval(mins => COALESCE(v_cfg.heartbeat_timeout_minutes, 10));

  UPDATE public.chat_invitations
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at <= NOW();

  INSERT INTO public.player_presence (
    player_id, user_id, nickname, vehicle_model, paint_color,
    world_region, pos_x, pos_y, pos_z, heading, speed,
    is_online, last_heartbeat_at, updated_at
  ) VALUES (
    v_profile.id,
    v_uid,
    v_profile.nickname,
    COALESCE(v_profile.selected_vehicle, 'SPORTS_COUPE'),
    COALESCE(v_profile.selected_vehicle_color, '#DC2626'),
    COALESCE(NULLIF(BTRIM(p_region), ''), 'Lagos Island'),
    LEAST(GREATEST(p_x, -1200), 2100),
    LEAST(GREATEST(p_y, -20), 60),
    LEAST(GREATEST(p_z, -1100), 400),
    p_heading,
    LEAST(GREATEST(p_speed, -100), 150),
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (player_id) DO UPDATE SET
    nickname = EXCLUDED.nickname,
    vehicle_model = EXCLUDED.vehicle_model,
    paint_color = EXCLUDED.paint_color,
    world_region = EXCLUDED.world_region,
    pos_x = EXCLUDED.pos_x,
    pos_y = EXCLUDED.pos_y,
    pos_z = EXCLUDED.pos_z,
    heading = EXCLUDED.heading,
    speed = EXCLUDED.speed,
    is_online = true,
    last_heartbeat_at = NOW(),
    updated_at = NOW();

  UPDATE public.player_profiles
  SET last_activity_at = NOW()
  WHERE id = v_profile.id;

  RETURN jsonb_build_object(
    'ok', true,
    'playerId', v_profile.id,
    'discoveryRadius', COALESCE(v_cfg.discovery_radius, 110),
    'serverNow', NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.logout_player_presence()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_pid UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT id INTO v_pid FROM public.player_profiles WHERE user_id = v_uid;

  UPDATE public.player_presence
  SET is_online = false, updated_at = NOW()
  WHERE user_id = v_uid;

  IF v_pid IS NOT NULL THEN
    UPDATE public.chat_invitations
    SET status = 'cancelled', responded_at = NOW()
    WHERE status = 'pending' AND (sender_player_id = v_pid OR recipient_player_id = v_pid);
  END IF;

  RETURN jsonb_build_object('ok', true, 'serverNow', NOW());
END;
$$;

-- Drop legacy signature with untrusted client coordinates if present
DROP FUNCTION IF EXISTS public.get_nearby_active_players(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

-- Authoritative server-position nearby discovery (never trusts client coordinates or radius)
CREATE OR REPLACE FUNCTION public.get_nearby_active_players()
RETURNS TABLE (
  player_id UUID,
  nickname TEXT,
  vehicle_model TEXT,
  paint_color TEXT,
  world_region TEXT,
  pos_x DOUBLE PRECISION,
  pos_y DOUBLE PRECISION,
  pos_z DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  distance DOUBLE PRECISION,
  last_heartbeat_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_my_prof public.player_profiles%ROWTYPE;
  v_my_pres public.player_presence%ROWTYPE;
  v_cfg public.chat_moderation_config%ROWTYPE;
  v_radius DOUBLE PRECISION;
  v_timeout_mins INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_my_prof FROM public.player_profiles WHERE user_id = v_uid;
  IF NOT FOUND OR v_my_prof.account_status <> 'active'
     OR NOT v_my_prof.terms_accepted OR v_my_prof.onboarding_status <> 'active' THEN
    RAISE EXCEPTION 'Active onboarded player profile required';
  END IF;

  SELECT * INTO v_cfg FROM public.chat_moderation_config WHERE id = 'default';
  v_radius := LEAST(GREATEST(COALESCE(v_cfg.discovery_radius, 110), 20), 200);
  v_timeout_mins := LEAST(GREATEST(COALESCE(v_cfg.heartbeat_timeout_minutes, 10), 2), 30);

  SELECT * INTO v_my_pres FROM public.player_presence WHERE player_id = v_my_prof.id;
  IF NOT FOUND OR NOT v_my_pres.is_online
     OR v_my_pres.last_heartbeat_at < NOW() - make_interval(mins => v_timeout_mins) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    pp.player_id,
    pp.nickname,
    pp.vehicle_model,
    pp.paint_color,
    pp.world_region,
    pp.pos_x,
    pp.pos_y,
    pp.pos_z,
    pp.heading,
    pp.speed,
    SQRT(POWER(pp.pos_x - v_my_pres.pos_x, 2) + POWER(pp.pos_z - v_my_pres.pos_z, 2)) AS distance,
    pp.last_heartbeat_at
  FROM public.player_presence pp
  JOIN public.player_profiles prof ON prof.id = pp.player_id
  WHERE pp.player_id <> v_my_prof.id
    AND pp.is_online = true
    AND pp.last_heartbeat_at >= NOW() - make_interval(mins => v_timeout_mins)
    AND prof.account_status = 'active'
    AND prof.terms_accepted = true
    AND prof.onboarding_status = 'active'
    AND SQRT(POWER(pp.pos_x - v_my_pres.pos_x, 2) + POWER(pp.pos_z - v_my_pres.pos_z, 2)) <= v_radius
    AND NOT EXISTS (
      SELECT 1 FROM public.player_blocks pb
      WHERE (pb.blocker_player_id = v_my_prof.id AND pb.blocked_player_id = pp.player_id)
         OR (pb.blocked_player_id = v_my_prof.id AND pb.blocker_player_id = pp.player_id)
    )
  ORDER BY distance ASC
  LIMIT 25;
END;
$$;

-- ------------------------------------------------------------------------------
-- 13. CHAT INVITATION RPCs (Strict dual validation on send AND acceptance)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.send_chat_invitation(UUID, DOUBLE PRECISION);

CREATE OR REPLACE FUNCTION public.send_chat_invitation(
  p_recipient_player_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_sender public.player_profiles%ROWTYPE;
  v_recipient public.player_profiles%ROWTYPE;
  v_sender_pres public.player_presence%ROWTYPE;
  v_recip_pres public.player_presence%ROWTYPE;
  v_cfg public.chat_moderation_config%ROWTYPE;
  v_dist DOUBLE PRECISION;
  v_recent_count INTEGER;
  v_inv_id UUID;
  v_expires TIMESTAMPTZ;
  v_radius DOUBLE PRECISION;
  v_timeout_mins INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_cfg FROM public.chat_moderation_config WHERE id = 'default';
  v_radius := LEAST(GREATEST(COALESCE(v_cfg.discovery_radius, 110), 20), 200);
  v_timeout_mins := LEAST(GREATEST(COALESCE(v_cfg.heartbeat_timeout_minutes, 10), 2), 30);

  SELECT * INTO v_sender FROM public.player_profiles WHERE user_id = v_uid;
  IF NOT FOUND OR NOT v_sender.terms_accepted OR v_sender.onboarding_status <> 'active' THEN
    RAISE EXCEPTION 'Active onboarded player session required';
  END IF;

  IF v_sender.account_status <> 'active' THEN
    RAISE EXCEPTION 'Your account is suspended';
  END IF;

  -- Expire sender temp chat restriction if elapsed
  IF v_sender.chat_status = 'temporarily_restricted'
     AND v_sender.chat_restricted_until IS NOT NULL
     AND v_sender.chat_restricted_until <= NOW() THEN
    UPDATE public.player_profiles
    SET chat_status = 'enabled', chat_restricted_until = NULL, chat_restriction_reason = NULL, updated_at = NOW()
    WHERE id = v_sender.id
    RETURNING * INTO v_sender;
  END IF;

  IF v_sender.chat_status = 'permanently_restricted'
     OR (v_sender.chat_status = 'temporarily_restricted' AND v_sender.chat_restricted_until > NOW()) THEN
    RAISE EXCEPTION 'Your chat access is currently restricted';
  END IF;

  IF v_sender.id = p_recipient_player_id THEN
    RAISE EXCEPTION 'Cannot send a chat invitation to yourself';
  END IF;

  SELECT * INTO v_recipient FROM public.player_profiles WHERE id = p_recipient_player_id;
  IF NOT FOUND OR v_recipient.account_status <> 'active'
     OR NOT v_recipient.terms_accepted OR v_recipient.onboarding_status <> 'active' THEN
    RAISE EXCEPTION 'Recipient driver is not eligible for chat';
  END IF;

  IF v_recipient.chat_status = 'permanently_restricted'
     OR (v_recipient.chat_status = 'temporarily_restricted' AND v_recipient.chat_restricted_until > NOW()) THEN
    RAISE EXCEPTION 'Recipient driver chat access is temporarily unavailable';
  END IF;

  -- Symmetric block check
  IF EXISTS (
    SELECT 1 FROM public.player_blocks
    WHERE (blocker_player_id = v_sender.id AND blocked_player_id = v_recipient.id)
       OR (blocker_player_id = v_recipient.id AND blocked_player_id = v_sender.id)
  ) THEN
    RAISE EXCEPTION 'Chat unavailable with this player';
  END IF;

  -- Validate fresh server presence on both sides
  SELECT * INTO v_sender_pres FROM public.player_presence WHERE player_id = v_sender.id;
  SELECT * INTO v_recip_pres FROM public.player_presence WHERE player_id = v_recipient.id;

  IF v_sender_pres.player_id IS NULL OR NOT v_sender_pres.is_online
     OR v_sender_pres.last_heartbeat_at < NOW() - make_interval(mins => v_timeout_mins) THEN
    RAISE EXCEPTION 'Your active driving session has expired; refresh presence';
  END IF;

  IF v_recip_pres.player_id IS NULL OR NOT v_recip_pres.is_online
     OR v_recip_pres.last_heartbeat_at < NOW() - make_interval(mins => v_timeout_mins) THEN
    RAISE EXCEPTION 'This driver is no longer online nearby';
  END IF;

  -- Server-enforced proximity radius check
  v_dist := SQRT(POWER(v_sender_pres.pos_x - v_recip_pres.pos_x, 2) + POWER(v_sender_pres.pos_z - v_recip_pres.pos_z, 2));
  IF v_dist > v_radius THEN
    RAISE EXCEPTION 'Driver is outside the allowed proximity radius';
  END IF;

  UPDATE public.chat_invitations
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at <= NOW();

  IF EXISTS (
    SELECT 1 FROM public.chat_invitations
    WHERE status = 'pending'
      AND expires_at > NOW()
      AND (
        (sender_player_id = v_sender.id AND recipient_player_id = v_recipient.id)
        OR (sender_player_id = v_recipient.id AND recipient_player_id = v_sender.id)
      )
  ) THEN
    RAISE EXCEPTION 'A pending chat invitation already exists between you and this driver';
  END IF;

  SELECT COUNT(*) INTO v_recent_count
  FROM public.chat_invitations
  WHERE sender_player_id = v_sender.id AND created_at > NOW() - INTERVAL '1 minute';

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Invitation rate limit reached. Wait a moment before sending another request';
  END IF;

  v_expires := NOW() + INTERVAL '30 seconds';

  INSERT INTO public.chat_invitations (
    sender_player_id, recipient_player_id, status, created_at, expires_at
  ) VALUES (
    v_sender.id, v_recipient.id, 'pending', NOW(), v_expires
  )
  RETURNING id INTO v_inv_id;

  RETURN jsonb_build_object(
    'invitationId', v_inv_id,
    'recipientNickname', v_recipient.nickname,
    'expiresAt', v_expires,
    'serverNow', NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_chat_invitation(
  p_invitation_id UUID,
  p_accept BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_me public.player_profiles%ROWTYPE;
  v_sender public.player_profiles%ROWTYPE;
  v_inv public.chat_invitations%ROWTYPE;
  v_cfg public.chat_moderation_config%ROWTYPE;
  v_a UUID;
  v_b UUID;
  v_conv public.chat_conversations%ROWTYPE;
  v_sender_pres public.player_presence%ROWTYPE;
  v_me_pres public.player_presence%ROWTYPE;
  v_dist DOUBLE PRECISION;
  v_radius DOUBLE PRECISION;
  v_timeout_mins INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_cfg FROM public.chat_moderation_config WHERE id = 'default';
  v_radius := LEAST(GREATEST(COALESCE(v_cfg.discovery_radius, 110), 20), 200);
  v_timeout_mins := LEAST(GREATEST(COALESCE(v_cfg.heartbeat_timeout_minutes, 10), 2), 30);

  SELECT * INTO v_me FROM public.player_profiles WHERE user_id = v_uid;
  IF NOT FOUND OR v_me.account_status <> 'active'
     OR NOT v_me.terms_accepted OR v_me.onboarding_status <> 'active' THEN
    RAISE EXCEPTION 'Eligible active player profile required';
  END IF;

  SELECT * INTO v_inv FROM public.chat_invitations WHERE id = p_invitation_id;
  IF NOT FOUND OR v_inv.recipient_player_id <> v_me.id THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer pending';
  END IF;

  IF v_inv.expires_at <= NOW() THEN
    UPDATE public.chat_invitations SET status = 'expired', responded_at = NOW() WHERE id = v_inv.id;
    RAISE EXCEPTION 'Invitation expired';
  END IF;

  IF NOT p_accept THEN
    UPDATE public.chat_invitations SET status = 'declined', responded_at = NOW() WHERE id = v_inv.id;
    RETURN jsonb_build_object('accepted', false, 'invitationId', v_inv.id);
  END IF;

  -- Validate recipient chat eligibility
  IF v_me.chat_status = 'temporarily_restricted'
     AND v_me.chat_restricted_until IS NOT NULL
     AND v_me.chat_restricted_until <= NOW() THEN
    UPDATE public.player_profiles
    SET chat_status = 'enabled', chat_restricted_until = NULL, chat_restriction_reason = NULL, updated_at = NOW()
    WHERE id = v_me.id
    RETURNING * INTO v_me;
  END IF;

  IF v_me.chat_status = 'permanently_restricted'
     OR (v_me.chat_status = 'temporarily_restricted' AND v_me.chat_restricted_until > NOW()) THEN
    RAISE EXCEPTION 'Your chat access is currently restricted';
  END IF;

  -- Validate sender account, onboarding, and chat status at acceptance time
  SELECT * INTO v_sender FROM public.player_profiles WHERE id = v_inv.sender_player_id;
  IF NOT FOUND OR v_sender.account_status <> 'active'
     OR NOT v_sender.terms_accepted OR v_sender.onboarding_status <> 'active' THEN
    UPDATE public.chat_invitations SET status = 'cancelled', responded_at = NOW() WHERE id = v_inv.id;
    RAISE EXCEPTION 'Inviting driver account is no longer eligible';
  END IF;

  IF v_sender.chat_status = 'permanently_restricted'
     OR (v_sender.chat_status = 'temporarily_restricted' AND v_sender.chat_restricted_until > NOW()) THEN
    UPDATE public.chat_invitations SET status = 'cancelled', responded_at = NOW() WHERE id = v_inv.id;
    RAISE EXCEPTION 'Inviting driver chat access is restricted';
  END IF;

  -- Symmetric block check
  IF EXISTS (
    SELECT 1 FROM public.player_blocks
    WHERE (blocker_player_id = v_me.id AND blocked_player_id = v_inv.sender_player_id)
       OR (blocker_player_id = v_inv.sender_player_id AND blocked_player_id = v_me.id)
  ) THEN
    UPDATE public.chat_invitations SET status = 'cancelled', responded_at = NOW() WHERE id = v_inv.id;
    RAISE EXCEPTION 'Chat cannot be opened due to a block';
  END IF;

  -- Validate fresh presence & remaining within proximity radius at acceptance time
  SELECT * INTO v_sender_pres FROM public.player_presence WHERE player_id = v_inv.sender_player_id;
  SELECT * INTO v_me_pres FROM public.player_presence WHERE player_id = v_me.id;

  IF v_sender_pres.player_id IS NULL OR NOT v_sender_pres.is_online
     OR v_sender_pres.last_heartbeat_at < NOW() - make_interval(mins => v_timeout_mins)
     OR v_me_pres.player_id IS NULL OR NOT v_me_pres.is_online
     OR v_me_pres.last_heartbeat_at < NOW() - make_interval(mins => v_timeout_mins) THEN
    UPDATE public.chat_invitations SET status = 'expired', responded_at = NOW() WHERE id = v_inv.id;
    RAISE EXCEPTION 'One of the drivers is no longer actively online';
  END IF;

  v_dist := SQRT(POWER(v_sender_pres.pos_x - v_me_pres.pos_x, 2) + POWER(v_sender_pres.pos_z - v_me_pres.pos_z, 2));
  IF v_dist > v_radius THEN
    UPDATE public.chat_invitations SET status = 'expired', responded_at = NOW() WHERE id = v_inv.id;
    RAISE EXCEPTION 'Drivers moved outside the proximity radius before chat was accepted';
  END IF;

  UPDATE public.chat_invitations SET status = 'accepted', responded_at = NOW() WHERE id = v_inv.id;

  IF v_inv.sender_player_id < v_me.id THEN
    v_a := v_inv.sender_player_id;
    v_b := v_me.id;
  ELSE
    v_a := v_me.id;
    v_b := v_inv.sender_player_id;
  END IF;

  INSERT INTO public.chat_conversations (player_a_id, player_b_id, status, last_activity_at)
  VALUES (v_a, v_b, 'active', NOW())
  ON CONFLICT (player_a_id, player_b_id) DO UPDATE SET
    status = 'active',
    last_activity_at = NOW()
  RETURNING * INTO v_conv;

  RETURN jsonb_build_object(
    'accepted', true,
    'conversationId', v_conv.id,
    'peerPlayerId', v_inv.sender_player_id,
    'peerNickname', v_sender_pres.nickname,
    'serverNow', NOW()
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 14. CONSERVATIVE + CONTEXTUAL CHAT MODERATION ENGINE
-- Allows cars/driving/music/sports/marketplace talk; never auto-punishes ambiguous words.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.moderate_chat_text(p_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_raw TEXT := COALESCE(p_text, '');
  v_lower TEXT := LOWER(v_raw);
  v_collapsed TEXT := REGEXP_REPLACE(v_lower, '[^a-z0-9@.+]', '', 'g');
BEGIN
  -- 1. Unambiguous phone numbers (Nigerian +234/080/081/070/090/091 or contiguous 8-15 digit phone spans; permits car years/speeds like "2024 AMG 180 km/h" or currency "₦45,000,000")
  IF v_raw ~* '(\+?234[\s\-\.]?[0-9]{2,4}[\s\-\.]?[0-9]{3,4}[\s\-\.]?[0-9]{3,4}|0[789][01][\s\-\.]?[0-9]{3,4}[\s\-\.]?[0-9]{4})'
     OR v_raw ~* '(^|[^0-9,])(\+?[0-9]([\s\-\.\(\)]*[0-9]){7,14})([^0-9]|$)'
     OR v_lower ~* '(zero|oh)\s*(eight|seven|nine)\s*(zero|one|two|three|four|five|six|seven|eight|nine)' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'severity', 'block',
      'category', 'PERSONAL_CONTACT_PHONE',
      'reason', 'Sharing phone numbers or numeric contact details is not permitted in MANIFOLD community chat.'
    );
  END IF;

  -- 2. Email addresses (explicit or obfuscated "at gmail dot com")
  IF v_raw ~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}'
     OR v_lower ~* '[a-z0-9._%+\-]+\s*(at|\(at\)|\[at\])\s*(gmail|yahoo|outlook|hotmail|icloud|proton)\s*(dot|\.)\s*(com|net|org|ng)' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'severity', 'block',
      'category', 'PERSONAL_CONTACT_EMAIL',
      'reason', 'Sharing email addresses is not permitted in MANIFOLD community chat.'
    );
  END IF;

  -- 3. External links & messaging invites
  IF v_raw ~* '(https?://|www\.|wa\.me/|t\.me/|bit\.ly/|instagram\.com|tiktok\.com|snapchat\.com|discord\.gg)'
     OR v_collapsed ~* '(wame|tme)[a-z0-9]{3,}' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'severity', 'block',
      'category', 'EXTERNAL_LINK',
      'reason', 'Sharing external links or URLs is not permitted.'
    );
  END IF;

  -- 4. Off-platform social/messaging handles (strict phrase matching so "instagram cars" isn't falsely treated as DM solicitation unless asking to connect)
  IF v_lower ~* '\y(whatsapp|whatsap|watsapp|whats app|telegram|snapchat|signal app|viber|wechat)\y'
     OR (v_lower ~* '\y(instagram|insta|tiktok|discord)\y' AND v_lower ~* '\y(add|dm|follow|reach|text|chat|message|handle|me|my)\y')
     OR (v_lower ~* '(@[a-z0-9_\.]{3,})' AND v_lower ~* '\y(add|dm|follow|reach|text|chat|message|handle|snap|ig|tg)\y')
     OR v_lower ~* '\y(call me|text me|ring me|my number|my digits|drop your number|send your number|dm me on|hit me up on|add me on)\y' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'severity', 'block',
      'category', 'OFF_PLATFORM_SOLICITATION',
      'reason', 'Sharing social handles or moving conversations off MANIFOLD is not allowed.'
    );
  END IF;

  -- 5. Unambiguous dating / romantic solicitation
  IF v_lower ~* '\y(hookup|hook up|wanna link tonight|link up tonight|date me|be my girlfriend|be my boyfriend|sugar daddy|sugar mommy|looking for a girlfriend|looking for a boyfriend|netflix and chill|come over to my place)\y' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'severity', 'block',
      'category', 'DATING_SOLICITATION',
      'reason', 'Dating or personal meetup solicitation is not allowed in MANIFOLD driving chat.'
    );
  END IF;

  -- 6. Unambiguous sexually explicit content
  IF v_lower ~* '\y(send nudes|send me nudes|nudes|horny|sexting|erotic|blowjob|handjob|fuck me|suck my|orgasm|porn|onlyfans)\y' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'severity', 'block',
      'category', 'SEXUAL_EXPLICIT',
      'reason', 'Sexually explicit content is strictly prohibited.'
    );
  END IF;

  -- 7. Severe threats, hate speech & financial scams
  IF v_lower ~* '\y(kill yourself|i will kill you|stab you|shoot you|wire transfer|send me your bank|bank details|bvn|otp code|motherfucker|retard|faggot)\y' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'severity', 'block',
      'category', 'HARASSMENT_OR_SCAM',
      'reason', 'Threats, hate speech, harassment, or financial solicitation is prohibited.'
    );
  END IF;

  -- 8. Ambiguous borderline phrasing: flag conservatively for admin review WITHOUT punishing player
  IF v_lower ~* '\y(send pics|my digits|drop your @|meet in person alone|bank account)\y' THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'severity', 'flagged_for_review',
      'category', 'AMBIGUOUS_REVIEW',
      'reason', 'Flagged conservatively for safety review without automatic penalty.'
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'severity', 'clean', 'category', 'CLEAN', 'reason', NULL);
END;
$$;

DROP FUNCTION IF EXISTS public.send_moderated_chat_message(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.send_moderated_chat_message(
  p_conversation_id UUID,
  p_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_sender public.player_profiles%ROWTYPE;
  v_conv public.chat_conversations%ROWTYPE;
  v_other_pid UUID;
  v_sender_pres public.player_presence%ROWTYPE;
  v_cfg public.chat_moderation_config%ROWTYPE;
  v_trimmed TEXT := BTRIM(COALESCE(p_content, ''));
  v_mod JSONB;
  v_allowed BOOLEAN;
  v_severity TEXT;
  v_category TEXT;
  v_reason TEXT;
  v_new_violations INTEGER;
  v_restricted_until TIMESTAMPTZ;
  v_new_chat_status TEXT;
  v_restriction_reason TEXT;
  v_action_taken TEXT;
  v_recent_msgs INTEGER;
  v_msg public.chat_messages%ROWTYPE;
  v_timeout_mins INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_sender FROM public.player_profiles WHERE user_id = v_uid;
  IF NOT FOUND OR NOT v_sender.terms_accepted OR v_sender.onboarding_status <> 'active' THEN
    RAISE EXCEPTION 'Eligible onboarded player profile required';
  END IF;

  SELECT * INTO v_cfg FROM public.chat_moderation_config WHERE id = 'default';
  v_timeout_mins := LEAST(GREATEST(COALESCE(v_cfg.heartbeat_timeout_minutes, 10), 2), 30);

  IF v_sender.account_status = 'suspended' THEN
    RETURN jsonb_build_object(
      'delivered', false,
      'code', 'ACCOUNT_SUSPENDED',
      'message', 'Your account has been suspended.'
    );
  END IF;

  -- Expire temporary restriction cleanly using DB NOW()
  IF v_sender.chat_status = 'temporarily_restricted'
     AND v_sender.chat_restricted_until IS NOT NULL
     AND v_sender.chat_restricted_until <= NOW() THEN
    UPDATE public.player_profiles
    SET chat_status = 'enabled', chat_restricted_until = NULL, chat_restriction_reason = NULL, updated_at = NOW()
    WHERE id = v_sender.id
    RETURNING * INTO v_sender;
  END IF;

  IF v_sender.chat_status = 'permanently_restricted' THEN
    RETURN jsonb_build_object(
      'delivered', false,
      'code', 'CHAT_PERMANENTLY_RESTRICTED',
      'message', 'Your chat privileges have been permanently restricted.'
    );
  END IF;

  IF v_sender.chat_status = 'temporarily_restricted'
     AND v_sender.chat_restricted_until IS NOT NULL
     AND v_sender.chat_restricted_until > NOW() THEN
    RETURN jsonb_build_object(
      'delivered', false,
      'code', 'CHAT_RESTRICTED',
      'message', 'Chat access is temporarily restricted due to community guideline violations.',
      'restrictedUntil', v_sender.chat_restricted_until
    );
  END IF;

  SELECT * INTO v_sender_pres FROM public.player_presence WHERE player_id = v_sender.id;
  IF v_sender_pres.player_id IS NULL OR NOT v_sender_pres.is_online
     OR v_sender_pres.last_heartbeat_at < NOW() - make_interval(mins => v_timeout_mins) THEN
    RAISE EXCEPTION 'Your active session expired; please reconnect';
  END IF;

  SELECT * INTO v_conv FROM public.chat_conversations WHERE id = p_conversation_id;
  IF NOT FOUND OR (v_conv.player_a_id <> v_sender.id AND v_conv.player_b_id <> v_sender.id) THEN
    RAISE EXCEPTION 'Conversation not accessible';
  END IF;

  IF v_conv.status <> 'active' THEN
    RAISE EXCEPTION 'This conversation is closed or blocked';
  END IF;

  v_other_pid := CASE WHEN v_conv.player_a_id = v_sender.id THEN v_conv.player_b_id ELSE v_conv.player_a_id END;

  IF EXISTS (
    SELECT 1 FROM public.player_blocks
    WHERE (blocker_player_id = v_sender.id AND blocked_player_id = v_other_pid)
       OR (blocker_player_id = v_other_pid AND blocked_player_id = v_sender.id)
  ) THEN
    RAISE EXCEPTION 'Conversation unavailable because a player block is active';
  END IF;

  IF char_length(v_trimmed) = 0 OR char_length(v_trimmed) > COALESCE(v_cfg.max_message_length, 500) THEN
    RETURN jsonb_build_object(
      'delivered', false,
      'code', 'INVALID_LENGTH',
      'message', 'Message must be between 1 and 500 characters.'
    );
  END IF;

  SELECT COUNT(*) INTO v_recent_msgs
  FROM public.chat_messages
  WHERE sender_player_id = v_sender.id AND created_at > NOW() - INTERVAL '10 seconds';

  IF v_recent_msgs >= 10 THEN
    RETURN jsonb_build_object(
      'delivered', false,
      'code', 'RATE_LIMITED',
      'message', 'Slow down! You are sending messages too quickly.'
    );
  END IF;

  v_mod := public.moderate_chat_text(v_trimmed);
  v_allowed := COALESCE((v_mod->>'allowed')::BOOLEAN, false);
  v_severity := COALESCE(v_mod->>'severity', 'block');
  v_category := COALESCE(v_mod->>'category', 'POLICY_VIOLATION');
  v_reason := v_mod->>'reason';

  IF NOT v_allowed THEN
    v_new_violations := v_sender.chat_violation_count + 1;
    v_new_chat_status := v_sender.chat_status;
    v_restricted_until := v_sender.chat_restricted_until;
    v_restriction_reason := v_sender.chat_restriction_reason;
    v_action_taken := 'warning_issued';

    -- Progressive enforcement affects ONLY chat_status (never suspends account_status)
    IF v_new_violations >= COALESCE(v_cfg.suspension_threshold, 6) THEN
      v_new_chat_status := 'temporarily_restricted';
      v_restricted_until := NOW() + INTERVAL '24 hours';
      v_restriction_reason := 'Extended automated chat restriction after repeated violations';
      v_action_taken := 'extended_chat_restriction_and_admin_flag';
    ELSIF v_new_violations >= COALESCE(v_cfg.warning_threshold, 2) THEN
      v_new_chat_status := 'temporarily_restricted';
      v_restricted_until := NOW() + make_interval(mins => COALESCE(v_cfg.temp_restriction_minutes, 15));
      v_restriction_reason := 'Temporary automated chat restriction after policy violations';
      v_action_taken := 'temporary_chat_restriction';
    END IF;

    UPDATE public.player_profiles
    SET
      chat_violation_count = v_new_violations,
      chat_status = v_new_chat_status,
      chat_restricted_until = v_restricted_until,
      chat_restriction_reason = v_restriction_reason,
      updated_at = NOW()
    WHERE id = v_sender.id;

    INSERT INTO public.moderation_incidents (
      player_id, conversation_id, attempted_content, violation_category, severity, action_taken
    ) VALUES (
      v_sender.id, v_conv.id, LEFT(v_trimmed, 500), v_category, 'blocked', v_action_taken
    );

    RETURN jsonb_build_object(
      'delivered', false,
      'code', 'MODERATION_BLOCKED',
      'message', 'THIS MESSAGE DOES NOT MEET MANIFOLD COMMUNITY CHAT GUIDELINES.',
      'explanation', v_reason,
      'category', v_category,
      'violationCount', v_new_violations,
      'chatStatus', v_new_chat_status,
      'actionTaken', v_action_taken,
      'restrictedUntil', v_restricted_until
    );
  END IF;

  -- If conservative ambiguous match: deliver safely AND log review-only incident without incrementing strike counter
  IF v_severity = 'flagged_for_review' THEN
    INSERT INTO public.moderation_incidents (
      player_id, conversation_id, attempted_content, violation_category, severity, action_taken
    ) VALUES (
      v_sender.id, v_conv.id, LEFT(v_trimmed, 500), v_category, 'flagged_for_review', 'delivered_flagged_for_review'
    );
  END IF;

  INSERT INTO public.chat_messages (
    conversation_id, sender_player_id, content, moderation_status
  ) VALUES (
    v_conv.id,
    v_sender.id,
    v_trimmed,
    CASE WHEN v_severity = 'flagged_for_review' THEN 'flagged_review' ELSE 'approved' END
  )
  RETURNING * INTO v_msg;

  UPDATE public.chat_conversations
  SET last_activity_at = NOW()
  WHERE id = v_conv.id;

  RETURN jsonb_build_object(
    'delivered', true,
    'flaggedForReview', (v_severity = 'flagged_for_review'),
    'messageRecord', to_jsonb(v_msg),
    'serverNow', NOW()
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 15. BLOCKING & REPORTING RPCs
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_player(p_target_player_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_me_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id INTO v_me_id FROM public.player_profiles WHERE user_id = v_uid;
  IF v_me_id IS NULL OR v_me_id = p_target_player_id THEN
    RAISE EXCEPTION 'Invalid block request';
  END IF;

  INSERT INTO public.player_blocks (blocker_player_id, blocked_player_id)
  VALUES (v_me_id, p_target_player_id)
  ON CONFLICT (blocker_player_id, blocked_player_id) DO NOTHING;

  UPDATE public.chat_conversations
  SET status = 'blocked', last_activity_at = NOW()
  WHERE (player_a_id = v_me_id AND player_b_id = p_target_player_id)
     OR (player_a_id = p_target_player_id AND player_b_id = v_me_id);

  UPDATE public.chat_invitations
  SET status = 'cancelled', responded_at = NOW()
  WHERE status = 'pending'
    AND (
      (sender_player_id = v_me_id AND recipient_player_id = p_target_player_id)
      OR (sender_player_id = p_target_player_id AND recipient_player_id = v_me_id)
    );

  RETURN jsonb_build_object('ok', true, 'blockedPlayerId', p_target_player_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_player(p_target_player_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_me_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT id INTO v_me_id FROM public.player_profiles WHERE user_id = v_uid;
  DELETE FROM public.player_blocks
  WHERE blocker_player_id = v_me_id AND blocked_player_id = p_target_player_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_blocked_players()
RETURNS TABLE (
  block_id UUID,
  blocked_player_id UUID,
  nickname TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_me_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  SELECT id INTO v_me_id FROM public.player_profiles WHERE user_id = v_uid;
  RETURN QUERY
  SELECT pb.id, pb.blocked_player_id, pp.nickname, pb.created_at
  FROM public.player_blocks pb
  JOIN public.player_profiles pp ON pp.id = pb.blocked_player_id
  WHERE pb.blocker_player_id = v_me_id
  ORDER BY pb.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_player(
  p_reported_player_id UUID,
  p_conversation_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'Inappropriate behavior',
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_me_id UUID;
  v_report_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id INTO v_me_id FROM public.player_profiles WHERE user_id = v_uid;
  IF v_me_id IS NULL OR v_me_id = p_reported_player_id THEN
    RAISE EXCEPTION 'Invalid report target';
  END IF;

  INSERT INTO public.player_reports (
    reporting_player_id, reported_player_id, conversation_id, reason, description
  ) VALUES (
    v_me_id,
    p_reported_player_id,
    p_conversation_id,
    LEFT(COALESCE(NULLIF(BTRIM(p_reason), ''), 'Inappropriate behavior'), 200),
    LEFT(BTRIM(COALESCE(p_description, '')), 1000)
  )
  RETURNING id INTO v_report_id;

  RETURN jsonb_build_object('ok', true, 'reportId', v_report_id);
END;
$$;

-- ------------------------------------------------------------------------------
-- 16. ADMIN PLAYER MANAGEMENT, MODERATION & AUDIT RPCs (Strictly gated by public.is_active_admin())
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_players_directory(
  p_search TEXT DEFAULT '',
  p_account_status TEXT DEFAULT 'all',
  p_chat_status TEXT DEFAULT 'all',
  p_onboarding_status TEXT DEFAULT 'all',
  p_online_filter TEXT DEFAULT 'all',
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cfg public.chat_moderation_config%ROWTYPE;
  v_timeout_mins INTEGER;
  v_search TEXT := LOWER(BTRIM(COALESCE(p_search, '')));
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 20), 5), 100);
  v_offset INTEGER := GREATEST(COALESCE(p_page, 1) - 1, 0) * LEAST(GREATEST(COALESCE(p_page_size, 20), 5), 100);
  v_total_filtered INTEGER;
  v_summary JSONB;
  v_players JSONB;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  SELECT * INTO v_cfg FROM public.chat_moderation_config WHERE id = 'default';
  v_timeout_mins := LEAST(GREATEST(COALESCE(v_cfg.heartbeat_timeout_minutes, 10), 2), 30);

  -- Global KPI Summary
  SELECT jsonb_build_object(
    'totalRegistered', COUNT(*),
    'onlineCount', COUNT(*) FILTER (
      WHERE pp.is_online = true
        AND pp.last_heartbeat_at >= NOW() - make_interval(mins => v_timeout_mins)
        AND p.account_status = 'active'
    ),
    'offlineCount', COUNT(*) FILTER (
      WHERE pp.is_online IS DISTINCT FROM true
        OR pp.last_heartbeat_at < NOW() - make_interval(mins => v_timeout_mins)
        OR p.account_status <> 'active'
    ),
    'completedOnboarding', COUNT(*) FILTER (WHERE p.onboarding_status = 'active'),
    'incompleteOnboarding', COUNT(*) FILTER (WHERE p.onboarding_status <> 'active'),
    'suspendedCount', COUNT(*) FILTER (WHERE p.account_status = 'suspended'),
    'chatRestrictedCount', COUNT(*) FILTER (
      WHERE p.chat_status = 'permanently_restricted'
         OR (p.chat_status = 'temporarily_restricted' AND (p.chat_restricted_until IS NULL OR p.chat_restricted_until > NOW()))
    ),
    'newRegistrations24h', COUNT(*) FILTER (WHERE p.registration_date >= NOW() - INTERVAL '24 hours')
  ) INTO v_summary
  FROM public.player_profiles p
  LEFT JOIN public.player_presence pp ON pp.player_id = p.id;

  -- Filtered Count
  SELECT COUNT(*) INTO v_total_filtered
  FROM public.player_profiles p
  LEFT JOIN public.player_presence pp ON pp.player_id = p.id
  WHERE (
      v_search = ''
      OR LOWER(p.full_name) LIKE '%' || v_search || '%'
      OR LOWER(p.nickname) LIKE '%' || v_search || '%'
      OR LOWER(p.email) LIKE '%' || v_search || '%'
      OR LOWER(p.phone_number) LIKE '%' || v_search || '%'
    )
    AND (p_account_status = 'all' OR p.account_status = p_account_status)
    AND (
      p_chat_status = 'all'
      OR (p_chat_status = 'restricted' AND (
        p.chat_status = 'permanently_restricted'
        OR (p.chat_status = 'temporarily_restricted' AND (p.chat_restricted_until IS NULL OR p.chat_restricted_until > NOW()))
      ))
      OR p.chat_status = p_chat_status
    )
    AND (
      p_onboarding_status = 'all'
      OR (p_onboarding_status = 'incomplete' AND p.onboarding_status <> 'active')
      OR p.onboarding_status = p_onboarding_status
    )
    AND (
      p_online_filter = 'all'
      OR (p_online_filter = 'online' AND pp.is_online = true AND pp.last_heartbeat_at >= NOW() - make_interval(mins => v_timeout_mins) AND p.account_status = 'active')
      OR (p_online_filter = 'offline' AND (pp.is_online IS DISTINCT FROM true OR pp.last_heartbeat_at < NOW() - make_interval(mins => v_timeout_mins) OR p.account_status <> 'active'))
    );

  -- Paginated Rows
  SELECT COALESCE(jsonb_agg(row_obj ORDER BY row_obj->>'registration_date' DESC), '[]'::jsonb)
  INTO v_players
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'user_id', p.user_id,
      'full_name', p.full_name,
      'nickname', p.nickname,
      'email', p.email,
      'phone_number', p.phone_number,
      'registration_date', p.registration_date,
      'account_status', p.account_status,
      'chat_status', CASE
        WHEN p.chat_status = 'temporarily_restricted' AND p.chat_restricted_until IS NOT NULL AND p.chat_restricted_until <= NOW()
          THEN 'enabled'
        ELSE p.chat_status
      END,
      'onboarding_status', p.onboarding_status,
      'terms_accepted', p.terms_accepted,
      'terms_version', p.terms_version,
      'selected_vehicle', p.selected_vehicle,
      'selected_vehicle_color', p.selected_vehicle_color,
      'selected_interior', p.selected_interior,
      'selected_music_preference', p.selected_music_preference,
      'settings_lock_expires_at', p.settings_lock_expires_at,
      'chat_violation_count', p.chat_violation_count,
      'chat_restricted_until', p.chat_restricted_until,
      'chat_restriction_reason', p.chat_restriction_reason,
      'suspended_reason', p.suspended_reason,
      'last_activity_at', p.last_activity_at,
      'world_region', pp.world_region,
      'is_online', COALESCE(
        pp.is_online = true
        AND pp.last_heartbeat_at >= NOW() - make_interval(mins => v_timeout_mins)
        AND p.account_status = 'active',
        false
      ),
      'last_heartbeat_at', pp.last_heartbeat_at
    ) AS row_obj
    FROM public.player_profiles p
    LEFT JOIN public.player_presence pp ON pp.player_id = p.id
    WHERE (
        v_search = ''
        OR LOWER(p.full_name) LIKE '%' || v_search || '%'
        OR LOWER(p.nickname) LIKE '%' || v_search || '%'
        OR LOWER(p.email) LIKE '%' || v_search || '%'
        OR LOWER(p.phone_number) LIKE '%' || v_search || '%'
      )
      AND (p_account_status = 'all' OR p.account_status = p_account_status)
      AND (
        p_chat_status = 'all'
        OR (p_chat_status = 'restricted' AND (
          p.chat_status = 'permanently_restricted'
          OR (p.chat_status = 'temporarily_restricted' AND (p.chat_restricted_until IS NULL OR p.chat_restricted_until > NOW()))
        ))
        OR p.chat_status = p_chat_status
      )
      AND (
        p_onboarding_status = 'all'
        OR (p_onboarding_status = 'incomplete' AND p.onboarding_status <> 'active')
        OR p.onboarding_status = p_onboarding_status
      )
      AND (
        p_online_filter = 'all'
        OR (p_online_filter = 'online' AND pp.is_online = true AND pp.last_heartbeat_at >= NOW() - make_interval(mins => v_timeout_mins) AND p.account_status = 'active')
        OR (p_online_filter = 'offline' AND (pp.is_online IS DISTINCT FROM true OR pp.last_heartbeat_at < NOW() - make_interval(mins => v_timeout_mins) OR p.account_status <> 'active'))
      )
    ORDER BY p.registration_date DESC
    LIMIT v_limit OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'summary', v_summary,
    'totalCount', v_total_filtered,
    'page', GREATEST(COALESCE(p_page, 1), 1),
    'pageSize', v_limit,
    'players', v_players
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_player_detail(
  p_player_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_player JSONB;
  v_incidents JSONB;
  v_reports JSONB;
  v_audits JSONB;
  v_cfg public.chat_moderation_config%ROWTYPE;
  v_timeout_mins INTEGER;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  SELECT * INTO v_cfg FROM public.chat_moderation_config WHERE id = 'default';
  v_timeout_mins := LEAST(GREATEST(COALESCE(v_cfg.heartbeat_timeout_minutes, 10), 2), 30);

  SELECT jsonb_build_object(
    'id', p.id,
    'user_id', p.user_id,
    'full_name', p.full_name,
    'nickname', p.nickname,
    'email', p.email,
    'phone_number', p.phone_number,
    'registration_date', p.registration_date,
    'account_status', p.account_status,
    'chat_status', CASE
      WHEN p.chat_status = 'temporarily_restricted' AND p.chat_restricted_until IS NOT NULL AND p.chat_restricted_until <= NOW()
        THEN 'enabled'
      ELSE p.chat_status
    END,
    'onboarding_status', p.onboarding_status,
    'terms_accepted', p.terms_accepted,
    'terms_version', p.terms_version,
    'terms_accepted_at', p.terms_accepted_at,
    'selected_vehicle', p.selected_vehicle,
    'selected_vehicle_color', p.selected_vehicle_color,
    'selected_interior', p.selected_interior,
    'selected_music_preference', p.selected_music_preference,
    'settings_confirmed_at', p.settings_confirmed_at,
    'settings_lock_expires_at', p.settings_lock_expires_at,
    'credits_balance', p.credits_balance,
    'chat_violation_count', p.chat_violation_count,
    'chat_restricted_until', p.chat_restricted_until,
    'chat_restriction_reason', p.chat_restriction_reason,
    'suspended_at', p.suspended_at,
    'suspended_reason', p.suspended_reason,
    'last_activity_at', p.last_activity_at,
    'world_region', pp.world_region,
    'is_online', COALESCE(
      pp.is_online = true
      AND pp.last_heartbeat_at >= NOW() - make_interval(mins => v_timeout_mins)
      AND p.account_status = 'active',
      false
    ),
    'last_heartbeat_at', pp.last_heartbeat_at
  )
  INTO v_player
  FROM public.player_profiles p
  LEFT JOIN public.player_presence pp ON pp.player_id = p.id
  WHERE p.id = p_player_id;

  IF v_player IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  SELECT COALESCE(jsonb_agg(i ORDER BY i->>'created_at' DESC), '[]'::jsonb)
  INTO v_incidents
  FROM (
    SELECT jsonb_build_object(
      'id', mi.id,
      'violation_category', mi.violation_category,
      'severity', mi.severity,
      'action_taken', mi.action_taken,
      'attempted_content', mi.attempted_content,
      'created_at', mi.created_at
    ) AS i
    FROM public.moderation_incidents mi
    WHERE mi.player_id = p_player_id
    ORDER BY mi.created_at DESC
    LIMIT 50
  ) sub;

  SELECT COALESCE(jsonb_agg(r ORDER BY r->>'created_at' DESC), '[]'::jsonb)
  INTO v_reports
  FROM (
    SELECT jsonb_build_object(
      'id', pr.id,
      'reason', pr.reason,
      'description', pr.description,
      'review_status', pr.review_status,
      'admin_notes', pr.admin_notes,
      'reporter_nickname', rep.nickname,
      'created_at', pr.created_at,
      'reviewed_at', pr.reviewed_at
    ) AS r
    FROM public.player_reports pr
    JOIN public.player_profiles rep ON rep.id = pr.reporting_player_id
    WHERE pr.reported_player_id = p_player_id
    ORDER BY pr.created_at DESC
    LIMIT 50
  ) sub;

  SELECT COALESCE(jsonb_agg(a ORDER BY a->>'created_at' DESC), '[]'::jsonb)
  INTO v_audits
  FROM (
    SELECT jsonb_build_object(
      'id', al.id,
      'admin_email', al.admin_email,
      'action', al.action,
      'reason', al.reason,
      'metadata', al.metadata,
      'created_at', al.created_at
    ) AS a
    FROM public.player_admin_audit_logs al
    WHERE al.player_id = p_player_id
    ORDER BY al.created_at DESC
    LIMIT 50
  ) sub;

  RETURN jsonb_build_object(
    'player', v_player,
    'incidents', v_incidents,
    'reports', v_reports,
    'auditLogs', v_audits
  );
END;
$$;

-- Single authoritative administrative action RPC with mandatory reason & immutable audit log
CREATE OR REPLACE FUNCTION public.admin_execute_player_action(
  p_player_id UUID,
  p_action TEXT,
  p_reason TEXT,
  p_restrict_minutes INTEGER DEFAULT NULL,
  p_report_id UUID DEFAULT NULL,
  p_report_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_admin_uid UUID := auth.uid();
  v_admin_email TEXT;
  v_clean_reason TEXT := BTRIM(COALESCE(p_reason, ''));
  v_target public.player_profiles%ROWTYPE;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  IF char_length(v_clean_reason) < 3 THEN
    RAISE EXCEPTION 'An administrative reason (at least 3 characters) is required for audit compliance';
  END IF;

  IF p_action NOT IN (
    'suspend_account',
    'reactivate_account',
    'restrict_chat_temp',
    'restrict_chat_permanent',
    'restore_chat',
    'review_report',
    'dismiss_report'
  ) THEN
    RAISE EXCEPTION 'Unsupported administrative action: %', p_action;
  END IF;

  SELECT * INTO v_target FROM public.player_profiles WHERE id = p_player_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target player not found';
  END IF;

  SELECT COALESCE(
    NULLIF(au.email, ''),
    'admin:' || v_admin_uid::TEXT
  )
  INTO v_admin_email
  FROM public.admin_users adm
  LEFT JOIN auth.users au ON au.id = adm.user_id
  WHERE adm.user_id = v_admin_uid
    AND adm.role = 'admin'::admin_role
    AND adm.status = 'active'::user_status
  LIMIT 1;

  IF p_action = 'suspend_account' THEN
    UPDATE public.player_profiles
    SET
      account_status = 'suspended',
      suspended_at = NOW(),
      suspended_reason = v_clean_reason,
      updated_at = NOW()
    WHERE id = p_player_id;

    UPDATE public.player_presence
    SET is_online = false, updated_at = NOW()
    WHERE player_id = p_player_id;

    UPDATE public.chat_invitations
    SET status = 'cancelled', responded_at = NOW()
    WHERE status = 'pending' AND (sender_player_id = p_player_id OR recipient_player_id = p_player_id);

  ELSIF p_action = 'reactivate_account' THEN
    UPDATE public.player_profiles
    SET
      account_status = 'active',
      suspended_at = NULL,
      suspended_reason = NULL,
      updated_at = NOW()
    WHERE id = p_player_id;

  ELSIF p_action = 'restrict_chat_temp' THEN
    UPDATE public.player_profiles
    SET
      chat_status = 'temporarily_restricted',
      chat_restricted_until = NOW() + make_interval(mins => LEAST(GREATEST(COALESCE(p_restrict_minutes, 60), 5), 43200)),
      chat_restriction_reason = v_clean_reason,
      updated_at = NOW()
    WHERE id = p_player_id;

  ELSIF p_action = 'restrict_chat_permanent' THEN
    UPDATE public.player_profiles
    SET
      chat_status = 'permanently_restricted',
      chat_restricted_until = NULL,
      chat_restriction_reason = v_clean_reason,
      updated_at = NOW()
    WHERE id = p_player_id;

  ELSIF p_action = 'restore_chat' THEN
    UPDATE public.player_profiles
    SET
      chat_status = 'enabled',
      chat_restricted_until = NULL,
      chat_restriction_reason = NULL,
      chat_violation_count = 0,
      updated_at = NOW()
    WHERE id = p_player_id;
  END IF;

  IF p_report_id IS NOT NULL THEN
    UPDATE public.player_reports
    SET
      review_status = COALESCE(
        p_report_status,
        CASE WHEN p_action = 'dismiss_report' THEN 'dismissed' ELSE 'action_taken' END
      ),
      admin_notes = v_clean_reason,
      reviewed_by = v_admin_uid,
      reviewed_at = NOW()
    WHERE id = p_report_id;
  END IF;

  -- Immutable Audit Record
  INSERT INTO public.player_admin_audit_logs (
    admin_user_id, admin_email, player_id, action, reason, metadata
  ) VALUES (
    COALESCE(v_admin_uid, gen_random_uuid()),
    COALESCE(v_admin_email, 'admin'),
    p_player_id,
    p_action,
    v_clean_reason,
    jsonb_build_object(
      'restrict_minutes', p_restrict_minutes,
      'report_id', p_report_id,
      'report_status', p_report_status,
      'previous_account_status', v_target.account_status,
      'previous_chat_status', v_target.chat_status
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Updated Moderation Overview RPC (returns separated account_status + chat_status + audit logs)
CREATE OR REPLACE FUNCTION public.admin_get_moderation_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reports JSONB;
  v_incidents JSONB;
  v_restricted JSONB;
  v_audits JSONB;
  v_config JSONB;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  SELECT COALESCE(jsonb_agg(r ORDER BY r->>'created_at' DESC), '[]'::jsonb)
  INTO v_reports
  FROM (
    SELECT jsonb_build_object(
      'id', pr.id,
      'reason', pr.reason,
      'description', pr.description,
      'review_status', pr.review_status,
      'admin_notes', pr.admin_notes,
      'created_at', pr.created_at,
      'reviewed_at', pr.reviewed_at,
      'conversation_id', pr.conversation_id,
      'reporter_nickname', rep1.nickname,
      'reported_player_id', rep2.id,
      'reported_nickname', rep2.nickname,
      'reported_account_status', rep2.account_status,
      'reported_chat_status', rep2.chat_status,
      'reported_violation_count', rep2.chat_violation_count
    ) AS r
    FROM public.player_reports pr
    JOIN public.player_profiles rep1 ON rep1.id = pr.reporting_player_id
    JOIN public.player_profiles rep2 ON rep2.id = pr.reported_player_id
    ORDER BY pr.created_at DESC
    LIMIT 100
  ) sub;

  SELECT COALESCE(jsonb_agg(i ORDER BY i->>'created_at' DESC), '[]'::jsonb)
  INTO v_incidents
  FROM (
    SELECT jsonb_build_object(
      'id', mi.id,
      'player_id', mi.player_id,
      'nickname', pp.nickname,
      'violation_category', mi.violation_category,
      'severity', mi.severity,
      'action_taken', mi.action_taken,
      'attempted_content', mi.attempted_content,
      'created_at', mi.created_at
    ) AS i
    FROM public.moderation_incidents mi
    JOIN public.player_profiles pp ON pp.id = mi.player_id
    ORDER BY mi.created_at DESC
    LIMIT 100
  ) sub;

  SELECT COALESCE(jsonb_agg(p ORDER BY (p->>'chat_violation_count')::INTEGER DESC), '[]'::jsonb)
  INTO v_restricted
  FROM (
    SELECT jsonb_build_object(
      'id', pp.id,
      'nickname', pp.nickname,
      'account_status', pp.account_status,
      'chat_status', pp.chat_status,
      'chat_violation_count', pp.chat_violation_count,
      'chat_restricted_until', pp.chat_restricted_until,
      'last_activity_at', pp.last_activity_at
    ) AS p
    FROM public.player_profiles pp
    WHERE pp.account_status <> 'active' OR pp.chat_status <> 'enabled' OR pp.chat_violation_count > 0
    ORDER BY pp.chat_violation_count DESC, pp.updated_at DESC
    LIMIT 100
  ) sub;

  SELECT COALESCE(jsonb_agg(a ORDER BY a->>'created_at' DESC), '[]'::jsonb)
  INTO v_audits
  FROM (
    SELECT jsonb_build_object(
      'id', al.id,
      'admin_email', al.admin_email,
      'player_id', al.player_id,
      'player_nickname', pp.nickname,
      'action', al.action,
      'reason', al.reason,
      'created_at', al.created_at
    ) AS a
    FROM public.player_admin_audit_logs al
    JOIN public.player_profiles pp ON pp.id = al.player_id
    ORDER BY al.created_at DESC
    LIMIT 100
  ) sub;

  SELECT to_jsonb(c) INTO v_config FROM public.chat_moderation_config c WHERE id = 'default';

  RETURN jsonb_build_object(
    'reports', v_reports,
    'incidents', v_incidents,
    'flaggedPlayers', v_restricted,
    'auditLogs', v_audits,
    'config', v_config
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_moderation_config(
  p_discovery_radius DOUBLE PRECISION,
  p_heartbeat_timeout_minutes INTEGER,
  p_warning_threshold INTEGER,
  p_temp_restriction_minutes INTEGER,
  p_suspension_threshold INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  UPDATE public.chat_moderation_config
  SET
    discovery_radius = LEAST(GREATEST(p_discovery_radius, 30), 200),
    heartbeat_timeout_minutes = LEAST(GREATEST(p_heartbeat_timeout_minutes, 2), 30),
    warning_threshold = LEAST(GREATEST(p_warning_threshold, 1), 10),
    temp_restriction_minutes = LEAST(GREATEST(p_temp_restriction_minutes, 5), 1440),
    suspension_threshold = LEAST(GREATEST(p_suspension_threshold, 3), 20),
    updated_at = NOW()
  WHERE id = 'default';

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Remove old combined admin moderation signature so clients use audited admin_execute_player_action
DROP FUNCTION IF EXISTS public.admin_update_player_moderation(UUID, TEXT, INTEGER, UUID, TEXT, TEXT);

-- ------------------------------------------------------------------------------
-- 17. REPEATABLE SUPABASE REALTIME PUBLICATION MEMBERSHIP (NO SILENT CATCHES)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'player_presence',
    'chat_invitations',
    'chat_messages',
    'chat_conversations',
    'player_blocks'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY v_tables LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = v_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      END IF;
    END LOOP;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 18. EXPLICIT LEAST-PRIVILEGE TABLE & FUNCTION PERMISSIONS (REVOKE PUBLIC/ANON)
-- ------------------------------------------------------------------------------
REVOKE ALL ON public.player_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.player_presence FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.chat_invitations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.chat_conversations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.chat_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.player_blocks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.player_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.moderation_incidents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.player_admin_audit_logs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.chat_moderation_config FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.player_presence TO authenticated;
GRANT SELECT ON public.chat_invitations TO authenticated;
GRANT SELECT ON public.chat_conversations TO authenticated;
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT SELECT ON public.player_blocks TO authenticated;
GRANT SELECT ON public.player_reports TO authenticated;
GRANT SELECT ON public.player_profiles TO authenticated;
GRANT SELECT ON public.moderation_incidents TO authenticated;
GRANT SELECT ON public.player_admin_audit_logs TO authenticated;
GRANT SELECT ON public.chat_moderation_config TO authenticated;

-- Revoke default PostgreSQL PUBLIC (and unnecessary anon) execution privileges
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prevent_player_admin_audit_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_player_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_manifold_player() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.moderate_chat_text(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_player_registration_available(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_my_player_profile(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_game_briefing(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_vehicle_configuration(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.heartbeat_player_presence(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.logout_player_presence() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_nearby_active_players() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_chat_invitation(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_chat_invitation(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_moderated_chat_message(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.block_player(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unblock_player(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_blocked_players() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_player(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_players_directory(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_player_detail(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_execute_player_action(UUID, TEXT, TEXT, INTEGER, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_moderation_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_moderation_config(DOUBLE PRECISION, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon;

-- Grant strictly required execution scopes
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_player_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_player_registration_available(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_my_player_profile(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_game_briefing(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_vehicle_configuration(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_player_presence(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.logout_player_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_active_players() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_chat_invitation(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_moderated_chat_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_player(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_player(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_blocked_players() TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_player(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_players_directory(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_player_detail(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_execute_player_action(UUID, TEXT, TEXT, INTEGER, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_moderation_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_moderation_config(DOUBLE PRECISION, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;
