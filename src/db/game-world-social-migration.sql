-- ==============================================================================
-- MANIFOLD CARS 3D — REGISTERED PLAYER WORLD, MULTIPLAYER PRESENCE,
-- PROXIMITY DISCOVERY, MODERATED REAL-TIME CHAT & ADMIN SAFETY MIGRATION
-- Strictly additive & idempotent. Preserves all marketplace/dealer/admin tables.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. PLAYER PROFILES (Private player account + onboarding + 24h vehicle lock)
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
    CHECK (account_status IN ('active', 'chat_restricted', 'suspended')),
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
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_profiles_nickname_lower
  ON public.player_profiles (lower(nickname));
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_profiles_email_lower
  ON public.player_profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_player_profiles_status
  ON public.player_profiles (account_status, onboarding_status);

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
    CHECK (moderation_status IN ('approved', 'rejected')),
  moderation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
-- 8. MODERATION INCIDENTS & RULE CONFIG
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  attempted_content TEXT NOT NULL,
  violation_category TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
-- 9. ROW LEVEL SECURITY (STRICT LEAST-PRIVILEGE)
-- ------------------------------------------------------------------------------
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_moderation_config ENABLE ROW LEVEL SECURITY;

-- Helpers
CREATE OR REPLACE FUNCTION public.current_player_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.player_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- player_profiles policies (private: ONLY owner or admin)
DROP POLICY IF EXISTS "Player reads own profile" ON public.player_profiles;
CREATE POLICY "Player reads own profile" ON public.player_profiles
  FOR SELECT USING (auth.uid() = user_id OR public.is_active_admin());

DROP POLICY IF EXISTS "Admin manages player profiles" ON public.player_profiles;
CREATE POLICY "Admin manages player profiles" ON public.player_profiles
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- player_presence policies (active authenticated players see active unblocked peers within 10 min)
DROP POLICY IF EXISTS "Authenticated reads active presence" ON public.player_presence;
CREATE POLICY "Authenticated reads active presence" ON public.player_presence
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND (
      user_id = auth.uid()
      OR public.is_active_admin()
      OR (
        is_online = true
        AND last_heartbeat_at >= NOW() - INTERVAL '10 minutes'
        AND NOT EXISTS (
          SELECT 1 FROM public.player_blocks pb
          WHERE (pb.blocker_player_id = public.current_player_id() AND pb.blocked_player_id = player_presence.player_id)
             OR (pb.blocked_player_id = public.current_player_id() AND pb.blocker_player_id = player_presence.player_id)
        )
      )
    )
  );

-- chat_invitations policies (only sender, recipient, or admin)
DROP POLICY IF EXISTS "Participants read invitations" ON public.chat_invitations;
CREATE POLICY "Participants read invitations" ON public.chat_invitations
  FOR SELECT USING (
    sender_player_id = public.current_player_id()
    OR recipient_player_id = public.current_player_id()
    OR public.is_active_admin()
  );

-- chat_conversations policies (only participants or admin)
DROP POLICY IF EXISTS "Participants read conversations" ON public.chat_conversations;
CREATE POLICY "Participants read conversations" ON public.chat_conversations
  FOR SELECT USING (
    player_a_id = public.current_player_id()
    OR player_b_id = public.current_player_id()
    OR public.is_active_admin()
  );

-- chat_messages policies (only approved messages to conversation participants, or admin)
DROP POLICY IF EXISTS "Participants read approved messages" ON public.chat_messages;
CREATE POLICY "Participants read approved messages" ON public.chat_messages
  FOR SELECT USING (
    public.is_active_admin()
    OR (
      moderation_status = 'approved'
      AND EXISTS (
        SELECT 1 FROM public.chat_conversations c
        WHERE c.id = chat_messages.conversation_id
          AND (c.player_a_id = public.current_player_id() OR c.player_b_id = public.current_player_id())
      )
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

-- moderation_incidents & config (admin only for full log; authenticated read config)
DROP POLICY IF EXISTS "Admin reads moderation incidents" ON public.moderation_incidents;
CREATE POLICY "Admin reads moderation incidents" ON public.moderation_incidents
  FOR SELECT USING (public.is_active_admin());

DROP POLICY IF EXISTS "Authenticated reads moderation config" ON public.chat_moderation_config;
CREATE POLICY "Authenticated reads moderation config" ON public.chat_moderation_config
  FOR SELECT USING (auth.role() = 'authenticated' OR public.is_active_admin());

DROP POLICY IF EXISTS "Admin updates moderation config" ON public.chat_moderation_config;
CREATE POLICY "Admin updates moderation config" ON public.chat_moderation_config
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- ------------------------------------------------------------------------------
-- 10. AUTHORITATIVE AUTH SYNC TRIGGER (Runs when new player registers via SignUp)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_manifold_player()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nickname TEXT;
  v_full_name TEXT;
  v_phone TEXT;
BEGIN
  v_nickname := NULLIF(BTRIM(NEW.raw_user_meta_data->>'nickname'), '');
  IF v_nickname IS NULL THEN
    -- Not a game player signup (e.g., admin or dealer account); leave untouched
    RETURN NEW;
  END IF;

  v_full_name := COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), ''), v_nickname);
  v_phone := COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data->>'phone_number'), ''), '');

  INSERT INTO public.player_profiles (
    user_id, full_name, nickname, email, phone_number,
    registration_date, account_status, onboarding_status
  ) VALUES (
    NEW.id,
    v_full_name,
    v_nickname,
    LOWER(COALESCE(NEW.email, '')),
    v_phone,
    NOW(),
    'active',
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

-- Public availability check BEFORE signUp (returns booleans only, never exposes rows)
CREATE OR REPLACE FUNCTION public.check_player_registration_available(
  p_email TEXT,
  p_nickname TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Bootstrap/fetch authenticated caller's profile + authoritative server timestamp
CREATE OR REPLACE FUNCTION public.get_or_create_my_player_profile(
  p_full_name TEXT DEFAULT NULL,
  p_nickname TEXT DEFAULT NULL,
  p_phone_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    v_nick := COALESCE(
      NULLIF(BTRIM(p_nickname), ''),
      NULLIF(BTRIM(v_meta->>'nickname'), ''),
      'Driver_' || SUBSTRING(v_uid::TEXT FROM 1 FOR 6)
    );
    v_name := COALESCE(
      NULLIF(BTRIM(p_full_name), ''),
      NULLIF(BTRIM(v_meta->>'full_name'), ''),
      v_nick
    );
    v_phone := COALESCE(
      NULLIF(BTRIM(p_phone_number), ''),
      NULLIF(BTRIM(v_meta->>'phone_number'), ''),
      ''
    );

    INSERT INTO public.player_profiles (
      user_id, full_name, nickname, email, phone_number,
      registration_date, account_status, onboarding_status
    ) VALUES (
      v_uid, v_name, v_nick, LOWER(COALESCE(v_auth_email, '')), v_phone,
      NOW(), 'active', 'registered'
    )
    RETURNING * INTO v_profile;
  END IF;

  -- Expire temporary restriction if window elapsed
  IF v_profile.account_status = 'chat_restricted'
     AND v_profile.chat_restricted_until IS NOT NULL
     AND v_profile.chat_restricted_until <= NOW() THEN
    UPDATE public.player_profiles
    SET account_status = 'active', chat_restricted_until = NULL, updated_at = NOW()
    WHERE id = v_profile.id
    RETURNING * INTO v_profile;
  END IF;

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'serverNow', NOW()
  );
END;
$$;

-- Mandatory Game Briefing & Terms Acceptance
CREATE OR REPLACE FUNCTION public.accept_game_briefing(
  p_terms_version TEXT DEFAULT '2026-11-v1'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile public.player_profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
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
  WHERE user_id = v_uid
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player profile not found';
  END IF;

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'serverNow', NOW()
  );
END;
$$;

-- Confirm Personal 3D Vehicle Configuration + Enforce Authoritative 24-Hour Lock
CREATE OR REPLACE FUNCTION public.confirm_vehicle_configuration(
  p_vehicle TEXT,
  p_color TEXT,
  p_interior TEXT,
  p_music TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF NOT v_profile.terms_accepted THEN
    RAISE EXCEPTION 'Mandatory game briefing and terms must be accepted first';
  END IF;

  IF v_profile.account_status = 'suspended' THEN
    RAISE EXCEPTION 'Account is suspended';
  END IF;

  -- Enforce 24-hour lock cleanly on the server
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
    selected_vehicle_color = p_color,
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
-- 12. PRESENCE HEARTBEAT, EXPIRATION & PROXIMITY DISCOVERY RPCs
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
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile public.player_profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile FROM public.player_profiles WHERE user_id = v_uid;
  IF NOT FOUND OR v_profile.onboarding_status <> 'active' OR v_profile.account_status = 'suspended' THEN
    RAISE EXCEPTION 'Active player session required';
  END IF;

  -- Mark timed-out peers offline automatically so database stays fresh
  UPDATE public.player_presence
  SET is_online = false, updated_at = NOW()
  WHERE is_online = true AND last_heartbeat_at < NOW() - INTERVAL '10 minutes';

  -- Expire stale invitations automatically
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
    p_x, p_y, p_z, p_heading, p_speed,
    true, NOW(), NOW()
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
    'serverNow', NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.logout_player_presence()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    SET status = 'cancelled'
    WHERE status = 'pending' AND (sender_player_id = v_pid OR recipient_player_id = v_pid);
  END IF;

  RETURN jsonb_build_object('ok', true, 'serverNow', NOW());
END;
$$;

-- Nearby active players within configurable radius (strictly public telemetry only)
CREATE OR REPLACE FUNCTION public.get_nearby_active_players(
  p_x DOUBLE PRECISION,
  p_z DOUBLE PRECISION,
  p_radius DOUBLE PRECISION DEFAULT 110
)
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
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_my_pid UUID;
  v_clamped_radius DOUBLE PRECISION;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id INTO v_my_pid FROM public.player_profiles WHERE user_id = v_uid;
  IF v_my_pid IS NULL THEN
    RETURN;
  END IF;

  v_clamped_radius := LEAST(GREATEST(COALESCE(p_radius, 110), 20), 200);

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
    SQRT(POWER(pp.pos_x - p_x, 2) + POWER(pp.pos_z - p_z, 2)) AS distance,
    pp.last_heartbeat_at
  FROM public.player_presence pp
  JOIN public.player_profiles prof ON prof.id = pp.player_id
  WHERE pp.player_id <> v_my_pid
    AND pp.is_online = true
    AND pp.last_heartbeat_at >= NOW() - INTERVAL '10 minutes'
    AND prof.account_status <> 'suspended'
    AND prof.onboarding_status = 'active'
    AND SQRT(POWER(pp.pos_x - p_x, 2) + POWER(pp.pos_z - p_z, 2)) <= v_clamped_radius
    AND NOT EXISTS (
      SELECT 1 FROM public.player_blocks pb
      WHERE (pb.blocker_player_id = v_my_pid AND pb.blocked_player_id = pp.player_id)
         OR (pb.blocked_player_id = v_my_pid AND pb.blocker_player_id = pp.player_id)
    )
  ORDER BY distance ASC
  LIMIT 25;
END;
$$;

-- ------------------------------------------------------------------------------
-- 13. CHAT INVITATION RPCs (Proximity + Expiry + Rate Limit + Block Checks)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_chat_invitation(
  p_recipient_player_id UUID,
  p_radius DOUBLE PRECISION DEFAULT 110
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_sender public.player_profiles%ROWTYPE;
  v_recipient public.player_profiles%ROWTYPE;
  v_sender_pres public.player_presence%ROWTYPE;
  v_recip_pres public.player_presence%ROWTYPE;
  v_dist DOUBLE PRECISION;
  v_recent_count INTEGER;
  v_inv_id UUID;
  v_expires TIMESTAMPTZ;
  v_clamped_radius DOUBLE PRECISION := LEAST(GREATEST(COALESCE(p_radius, 110), 20), 200);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_sender FROM public.player_profiles WHERE user_id = v_uid;
  IF NOT FOUND OR v_sender.onboarding_status <> 'active' THEN
    RAISE EXCEPTION 'Active player session required';
  END IF;

  IF v_sender.account_status = 'suspended' THEN
    RAISE EXCEPTION 'Your account is suspended';
  END IF;

  IF v_sender.id = p_recipient_player_id THEN
    RAISE EXCEPTION 'Cannot send a chat invitation to yourself';
  END IF;

  SELECT * INTO v_recipient FROM public.player_profiles WHERE id = p_recipient_player_id;
  IF NOT FOUND OR v_recipient.account_status = 'suspended' THEN
    RAISE EXCEPTION 'Recipient driver is not available';
  END IF;

  -- Block check either direction
  IF EXISTS (
    SELECT 1 FROM public.player_blocks
    WHERE (blocker_player_id = v_sender.id AND blocked_player_id = v_recipient.id)
       OR (blocker_player_id = v_recipient.id AND blocked_player_id = v_sender.id)
  ) THEN
    RAISE EXCEPTION 'Chat unavailable with this player';
  END IF;

  -- Active heartbeat validation (<= 10 minutes)
  SELECT * INTO v_sender_pres FROM public.player_presence WHERE player_id = v_sender.id;
  SELECT * INTO v_recip_pres FROM public.player_presence WHERE player_id = v_recipient.id;

  IF v_sender_pres.player_id IS NULL OR NOT v_sender_pres.is_online
     OR v_sender_pres.last_heartbeat_at < NOW() - INTERVAL '10 minutes' THEN
    RAISE EXCEPTION 'Your active driving session has expired; refresh presence';
  END IF;

  IF v_recip_pres.player_id IS NULL OR NOT v_recip_pres.is_online
     OR v_recip_pres.last_heartbeat_at < NOW() - INTERVAL '10 minutes' THEN
    RAISE EXCEPTION 'This driver is no longer online nearby';
  END IF;

  -- Server-side proximity validation
  v_dist := SQRT(POWER(v_sender_pres.pos_x - v_recip_pres.pos_x, 2) + POWER(v_sender_pres.pos_z - v_recip_pres.pos_z, 2));
  IF v_dist > v_clamped_radius * 1.25 THEN
    RAISE EXCEPTION 'Driver is out of proximity range to initiate chat';
  END IF;

  -- Expire old pending invitations
  UPDATE public.chat_invitations
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at <= NOW();

  -- Prevent duplicate pending request for same pair
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

  -- Anti-spam rate limit (max 5 invitations per minute)
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
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_me public.player_profiles%ROWTYPE;
  v_inv public.chat_invitations%ROWTYPE;
  v_a UUID;
  v_b UUID;
  v_conv public.chat_conversations%ROWTYPE;
  v_sender_pres public.player_presence%ROWTYPE;
  v_me_pres public.player_presence%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_me FROM public.player_profiles WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player profile not found';
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

  -- Check block
  IF EXISTS (
    SELECT 1 FROM public.player_blocks
    WHERE (blocker_player_id = v_me.id AND blocked_player_id = v_inv.sender_player_id)
       OR (blocker_player_id = v_inv.sender_player_id AND blocked_player_id = v_me.id)
  ) THEN
    UPDATE public.chat_invitations SET status = 'cancelled', responded_at = NOW() WHERE id = v_inv.id;
    RAISE EXCEPTION 'Chat cannot be opened due to a block';
  END IF;

  -- Re-check active heartbeat on both sides
  SELECT * INTO v_sender_pres FROM public.player_presence WHERE player_id = v_inv.sender_player_id;
  SELECT * INTO v_me_pres FROM public.player_presence WHERE player_id = v_me.id;

  IF v_sender_pres.player_id IS NULL OR NOT v_sender_pres.is_online
     OR v_sender_pres.last_heartbeat_at < NOW() - INTERVAL '10 minutes'
     OR v_me_pres.player_id IS NULL OR NOT v_me_pres.is_online THEN
    UPDATE public.chat_invitations SET status = 'expired', responded_at = NOW() WHERE id = v_inv.id;
    RAISE EXCEPTION 'The inviting driver went offline';
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
-- 14. SERVER-AUTHORITATIVE CHAT MODERATION ENGINE (Cannot be bypassed via SQL/API)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.moderate_chat_text(p_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_raw TEXT := COALESCE(p_text, '');
  v_lower TEXT := LOWER(v_raw);
  v_digits_only TEXT := REGEXP_REPLACE(v_raw, '[^0-9]', '', 'g');
  v_collapsed TEXT := REGEXP_REPLACE(v_lower, '[^a-z0-9@.+]', '', 'g');
BEGIN
  -- 1. Phone numbers (Nigerian +234 / 080 / 081 / 070 / 090 / 091 or any >= 8 digits / obfuscated digits)
  IF v_raw ~* '(\+?234[\s\-\.]?[0-9]{2,4}[\s\-\.]?[0-9]{3,4}[\s\-\.]?[0-9]{3,4}|0[789][01][\s\-\.]?[0-9]{3,4}[\s\-\.]?[0-9]{4})'
     OR LENGTH(v_digits_only) >= 8
     OR v_lower ~* '(zero|oh)\s*(eight|seven|nine)\s*(zero|one|two|three|four|five|six|seven|eight|nine)' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'category', 'PERSONAL_CONTACT_PHONE',
      'reason', 'Sharing phone numbers or numeric contact details is not permitted in MANIFOLD community chat.'
    );
  END IF;

  -- 2. Email addresses (explicit or obfuscated "at gmail dot com")
  IF v_raw ~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}'
     OR v_lower ~* '[a-z0-9._%+\-]+\s*(at|\(at\)|\[at\])\s*(gmail|yahoo|outlook|hotmail|icloud|proton)\s*(dot|\.)\s*(com|net|org|ng)' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'category', 'PERSONAL_CONTACT_EMAIL',
      'reason', 'Sharing email addresses is not permitted in MANIFOLD community chat.'
    );
  END IF;

  -- 3. External URLs / messaging links
  IF v_raw ~* '(https?://|www\.|wa\.me/|t\.me/|bit\.ly/|instagram\.com|tiktok\.com|snapchat\.com|discord\.gg)'
     OR v_collapsed ~* '(wame|tme|http|https)[a-z0-9]{3,}' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'category', 'EXTERNAL_LINK',
      'reason', 'Sharing external links or URLs is not permitted.'
    );
  END IF;

  -- 4. External social / messaging app handles
  IF v_lower ~* '\y(whatsapp|whatsap|watsapp|whats app|telegram|snapchat|instagram|insta|tiktok|discord|signal app|viber|wechat)\y'
     OR (v_lower ~* '(@[a-z0-9_\.]{3,})' AND v_lower ~* '(add|dm|follow|reach|text|chat|message|handle|snap|ig|tg)')
     OR v_lower ~* '\y(call me|text me|ring me|my number|my digits|drop your number|send your number|dm me on|hit me up on|add me on)\y' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'category', 'OFF_PLATFORM_SOLICITATION',
      'reason', 'Sharing social handles or moving conversations to private messaging apps is not allowed.'
    );
  END IF;

  -- 5. Dating / romance solicitation
  IF v_lower ~* '\y(hookup|hook up|wanna link|link up tonight|date me|be my girlfriend|be my boyfriend|sugar daddy|sugar mommy|single ladies|looking for love|netflix and chill|come over to my place|send your pic|send pics|selfie)\y' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'category', 'DATING_SOLICITATION',
      'reason', 'Dating or personal meetup solicitation is not allowed in MANIFOLD driving chat.'
    );
  END IF;

  -- 6. Sexually explicit / erotic content
  IF v_lower ~* '\y(nudes|nude|naked|horny|sexting|erotic|blowjob|handjob|boobs|tits|pussy|dick|cock|fuck me|suck my|cum|orgasm|porn|onlyfans)\y' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'category', 'SEXUAL_EXPLICIT',
      'reason', 'Sexually explicit or inappropriate content is strictly prohibited.'
    );
  END IF;

  -- 7. Harassment, threats, scams
  IF v_lower ~* '\y(kill yourself|i will kill|stab you|shoot you|scam you|send me money|wire transfer|bank details|bvn|pin code|otp code|motherfucker|bitch|retard|faggot)\y' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'category', 'HARASSMENT_OR_SCAM',
      'reason', 'Harassment, threats, abusive language, or financial solicitation is prohibited.'
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'category', 'CLEAN', 'reason', NULL);
END;
$$;

-- Authoritative Moderated Message Sender
CREATE OR REPLACE FUNCTION public.send_moderated_chat_message(
  p_conversation_id UUID,
  p_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_category TEXT;
  v_reason TEXT;
  v_new_violations INTEGER;
  v_restricted_until TIMESTAMPTZ;
  v_new_status TEXT;
  v_action_taken TEXT;
  v_recent_msgs INTEGER;
  v_msg public.chat_messages%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_sender FROM public.player_profiles WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player profile not found';
  END IF;

  SELECT * INTO v_cfg FROM public.chat_moderation_config WHERE id = 'default';

  IF v_sender.account_status = 'suspended' THEN
    RETURN jsonb_build_object(
      'delivered', false,
      'code', 'ACCOUNT_SUSPENDED',
      'message', 'Your account has been suspended from community features.'
    );
  END IF;

  IF v_sender.account_status = 'chat_restricted'
     AND v_sender.chat_restricted_until IS NOT NULL
     AND v_sender.chat_restricted_until > NOW() THEN
    RETURN jsonb_build_object(
      'delivered', false,
      'code', 'CHAT_RESTRICTED',
      'message', 'Chat access is temporarily restricted due to repeated guideline violations.',
      'restrictedUntil', v_sender.chat_restricted_until
    );
  END IF;

  -- Active presence validation
  SELECT * INTO v_sender_pres FROM public.player_presence WHERE player_id = v_sender.id;
  IF v_sender_pres.player_id IS NULL OR NOT v_sender_pres.is_online
     OR v_sender_pres.last_heartbeat_at < NOW() - INTERVAL '10 minutes' THEN
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

  -- Mutual block validation
  IF EXISTS (
    SELECT 1 FROM public.player_blocks
    WHERE (blocker_player_id = v_sender.id AND blocked_player_id = v_other_pid)
       OR (blocker_player_id = v_other_pid AND blocked_player_id = v_sender.id)
  ) THEN
    RAISE EXCEPTION 'Conversation unavailable because a player block is active';
  END IF;

  -- Empty / Max Length check
  IF char_length(v_trimmed) = 0 OR char_length(v_trimmed) > COALESCE(v_cfg.max_message_length, 500) THEN
    RETURN jsonb_build_object(
      'delivered', false,
      'code', 'INVALID_LENGTH',
      'message', 'Message must be between 1 and 500 characters.'
    );
  END IF;

  -- Flood / Spam rate limit (max 10 messages in 10 seconds)
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

  -- Run authoritative moderation
  v_mod := public.moderate_chat_text(v_trimmed);
  v_allowed := COALESCE((v_mod->>'allowed')::BOOLEAN, false);
  v_category := COALESCE(v_mod->>'category', 'POLICY_VIOLATION');
  v_reason := v_mod->>'reason';

  IF NOT v_allowed THEN
    v_new_violations := v_sender.chat_violation_count + 1;
    v_new_status := v_sender.account_status;
    v_restricted_until := v_sender.chat_restricted_until;
    v_action_taken := 'warning_issued';

    IF v_new_violations >= COALESCE(v_cfg.suspension_threshold, 6) THEN
      v_new_status := 'chat_restricted';
      v_restricted_until := NOW() + INTERVAL '24 hours';
      v_action_taken := 'extended_restriction_and_admin_flag';
    ELSIF v_new_violations >= COALESCE(v_cfg.warning_threshold, 2) THEN
      v_new_status := 'chat_restricted';
      v_restricted_until := NOW() + (COALESCE(v_cfg.temp_restriction_minutes, 15) || ' minutes')::INTERVAL;
      v_action_taken := 'temporary_chat_restriction';
    END IF;

    UPDATE public.player_profiles
    SET
      chat_violation_count = v_new_violations,
      account_status = v_new_status,
      chat_restricted_until = v_restricted_until,
      updated_at = NOW()
    WHERE id = v_sender.id;

    INSERT INTO public.moderation_incidents (
      player_id, conversation_id, attempted_content, violation_category, action_taken
    ) VALUES (
      v_sender.id, v_conv.id, LEFT(v_trimmed, 500), v_category, v_action_taken
    );

    RETURN jsonb_build_object(
      'delivered', false,
      'code', 'MODERATION_BLOCKED',
      'message', 'THIS MESSAGE DOES NOT MEET MANIFOLD COMMUNITY CHAT GUIDELINES.',
      'explanation', v_reason,
      'category', v_category,
      'violationCount', v_new_violations,
      'actionTaken', v_action_taken,
      'restrictedUntil', v_restricted_until
    );
  END IF;

  INSERT INTO public.chat_messages (
    conversation_id, sender_player_id, content, moderation_status
  ) VALUES (
    v_conv.id, v_sender.id, v_trimmed, 'approved'
  )
  RETURNING * INTO v_msg;

  UPDATE public.chat_conversations
  SET last_activity_at = NOW()
  WHERE id = v_conv.id;

  RETURN jsonb_build_object(
    'delivered', true,
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
SET search_path = public
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
SET search_path = public
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
SET search_path = public
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
SET search_path = public
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
-- 16. ADMIN MODERATION FOUNDATION RPCs (Strictly gated by public.is_active_admin())
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_moderation_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reports JSONB;
  v_incidents JSONB;
  v_restricted JSONB;
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
      'action_taken', mi.action_taken,
      'attempted_content', mi.attempted_content,
      'created_at', mi.created_at
    ) AS i
    FROM public.moderation_incidents mi
    JOIN public.player_profiles pp ON pp.id = mi.player_id
    ORDER BY mi.created_at DESC
    LIMIT 100
  ) sub;

  SELECT COALESCE(jsonb_agg(p ORDER BY p->>'chat_violation_count' DESC), '[]'::jsonb)
  INTO v_restricted
  FROM (
    SELECT jsonb_build_object(
      'id', pp.id,
      'nickname', pp.nickname,
      'account_status', pp.account_status,
      'chat_violation_count', pp.chat_violation_count,
      'chat_restricted_until', pp.chat_restricted_until,
      'last_activity_at', pp.last_activity_at
    ) AS p
    FROM public.player_profiles pp
    WHERE pp.account_status <> 'active' OR pp.chat_violation_count > 0
    ORDER BY pp.chat_violation_count DESC, pp.updated_at DESC
    LIMIT 100
  ) sub;

  SELECT to_jsonb(c) INTO v_config FROM public.chat_moderation_config c WHERE id = 'default';

  RETURN jsonb_build_object(
    'reports', v_reports,
    'incidents', v_incidents,
    'flaggedPlayers', v_restricted,
    'config', v_config
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_player_moderation(
  p_player_id UUID,
  p_account_status TEXT,
  p_restrict_minutes INTEGER DEFAULT NULL,
  p_report_id UUID DEFAULT NULL,
  p_report_status TEXT DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  IF p_account_status NOT IN ('active', 'chat_restricted', 'suspended') THEN
    RAISE EXCEPTION 'Invalid account status';
  END IF;

  UPDATE public.player_profiles
  SET
    account_status = p_account_status,
    chat_restricted_until = CASE
      WHEN p_account_status = 'chat_restricted' AND p_restrict_minutes IS NOT NULL
        THEN NOW() + (p_restrict_minutes || ' minutes')::INTERVAL
      WHEN p_account_status = 'active' THEN NULL
      ELSE chat_restricted_until
    END,
    chat_violation_count = CASE
      WHEN p_account_status = 'active' THEN 0
      ELSE chat_violation_count
    END,
    updated_at = NOW()
  WHERE id = p_player_id;

  IF p_account_status = 'suspended' THEN
    UPDATE public.player_presence SET is_online = false WHERE player_id = p_player_id;
  END IF;

  IF p_report_id IS NOT NULL THEN
    UPDATE public.player_reports
    SET
      review_status = COALESCE(p_report_status, 'action_taken'),
      admin_notes = COALESCE(p_admin_notes, admin_notes),
      reviewed_by = auth.uid(),
      reviewed_at = NOW()
    WHERE id = p_report_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
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
SET search_path = public
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

-- ------------------------------------------------------------------------------
-- 17. SUPABASE REALTIME PUBLICATION & GRANTS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.player_presence;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_invitations;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.player_blocks;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.player_presence TO authenticated;
GRANT SELECT ON public.chat_invitations TO authenticated;
GRANT SELECT ON public.chat_conversations TO authenticated;
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT SELECT ON public.player_blocks TO authenticated;
GRANT SELECT ON public.player_reports TO authenticated;
GRANT SELECT ON public.player_profiles TO authenticated;
GRANT SELECT ON public.chat_moderation_config TO authenticated;

GRANT EXECUTE ON FUNCTION public.check_player_registration_available(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_my_player_profile(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_game_briefing(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_vehicle_configuration(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_player_presence(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.logout_player_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_active_players(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_invitation(UUID, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_chat_invitation(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_moderated_chat_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_player(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_player(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_blocked_players() TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_player(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_moderation_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_player_moderation(UUID, TEXT, INTEGER, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_moderation_config(DOUBLE PRECISION, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;
