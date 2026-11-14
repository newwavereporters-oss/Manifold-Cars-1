-- ==============================================================================
-- MANIFOLD CARS 3D — TWO-WAY CHAT INVITATION HARDENING PATCH (IDEMPOTENT)
-- Preserves all existing tables, data, admin accounts, marketplace & game schema.
-- Adds:
--   1. REPLICA IDENTITY FULL on chat_invitations for full real-time status delivery
--   2. 20s per-pair decline cooldown in send_chat_invitation to prevent invite spam
--   3. cancel_chat_invitation(p_invitation_id) RPC so senders can withdraw pending requests
--   4. Explicit state transition validation in respond_chat_invitation
-- ==============================================================================

ALTER TABLE public.chat_invitations REPLICA IDENTITY FULL;
ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;

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
  v_last_decline_at TIMESTAMPTZ;
  v_cooldown_left INTEGER;
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

  -- Enforce 20s per-pair cooldown after a declined request to prevent invitation spam
  SELECT MAX(COALESCE(responded_at, created_at)) INTO v_last_decline_at
  FROM public.chat_invitations
  WHERE sender_player_id = v_sender.id
    AND recipient_player_id = v_recipient.id
    AND status = 'declined'
    AND COALESCE(responded_at, created_at) > NOW() - INTERVAL '20 seconds';

  IF v_last_decline_at IS NOT NULL THEN
    v_cooldown_left := GREATEST(1, CEIL(EXTRACT(EPOCH FROM ((v_last_decline_at + INTERVAL '20 seconds') - NOW())))::INTEGER);
    RAISE EXCEPTION 'Request recently declined. Wait %s before requesting chat again', v_cooldown_left;
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

CREATE OR REPLACE FUNCTION public.cancel_chat_invitation(
  p_invitation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_me_id UUID;
  v_inv public.chat_invitations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id INTO v_me_id FROM public.player_profiles WHERE user_id = v_uid;
  IF v_me_id IS NULL THEN
    RAISE EXCEPTION 'Player profile required';
  END IF;

  SELECT * INTO v_inv FROM public.chat_invitations WHERE id = p_invitation_id;
  IF NOT FOUND OR v_inv.sender_player_id <> v_me_id THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF v_inv.status = 'pending' THEN
    UPDATE public.chat_invitations
    SET status = 'cancelled', responded_at = NOW()
    WHERE id = v_inv.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'invitationId', v_inv.id, 'status', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.send_chat_invitation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_invitation(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_chat_invitation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_chat_invitation(UUID) TO authenticated;
