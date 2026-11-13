import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  InteriorTheme,
  MusicPreference,
  VehicleModelType,
} from '../components/world/worldModels';

export const TERMS_VERSION = '2026-11-v1';

export type PlayerAccountStatus = 'active' | 'suspended';
export type PlayerChatStatus = 'enabled' | 'temporarily_restricted' | 'permanently_restricted';
export type PlayerOnboardingStatus = 'registered' | 'briefing_accepted' | 'active';

export interface PlayerProfile {
  id: string;
  user_id: string;
  full_name: string;
  nickname: string;
  email: string;
  phone_number: string;
  registration_date: string;
  account_status: PlayerAccountStatus;
  chat_status: PlayerChatStatus;
  onboarding_status: PlayerOnboardingStatus;
  terms_accepted: boolean;
  terms_version: string | null;
  terms_accepted_at: string | null;
  selected_vehicle: VehicleModelType | null;
  selected_vehicle_color: string | null;
  selected_interior: InteriorTheme | null;
  selected_music_preference: MusicPreference | null;
  settings_confirmed_at: string | null;
  settings_lock_expires_at: string | null;
  credits_balance: number;
  chat_violation_count: number;
  chat_restricted_until: string | null;
  chat_restriction_reason: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  last_activity_at: string;
}

export interface BlockedPlayerEntry {
  block_id: string;
  blocked_player_id: string;
  nickname: string;
  created_at: string;
}

export interface WorldDbStatus {
  configured: boolean;
  tablesExist: boolean;
  migrationRequired: boolean;
  networkUnreachable?: boolean;
  migrationFilePath?: string;
  error?: string;
}

export function isPlayerChatRestricted(
  profile: Pick<PlayerProfile, 'chat_status' | 'chat_restricted_until'> | null | undefined,
  serverClockOffsetMs = 0
): { restricted: boolean; permanent: boolean; untilFormatted: string } {
  if (!profile) return { restricted: false, permanent: false, untilFormatted: '' };
  if (profile.chat_status === 'permanently_restricted') {
    return { restricted: true, permanent: true, untilFormatted: '' };
  }
  if (profile.chat_status === 'temporarily_restricted') {
    if (!profile.chat_restricted_until) {
      return { restricted: true, permanent: false, untilFormatted: '' };
    }
    const untilMs = Date.parse(profile.chat_restricted_until);
    const nowMs = Date.now() + serverClockOffsetMs;
    if (!Number.isNaN(untilMs) && untilMs > nowMs) {
      return {
        restricted: true,
        permanent: false,
        untilFormatted: new Date(untilMs).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
    }
  }
  return { restricted: false, permanent: false, untilFormatted: '' };
}

function mapWorldError(err: any): string {
  const msg = String(err?.message || err || 'Unexpected error');
  if (
    msg.includes('Could not find the function') ||
    msg.includes('does not exist') ||
    err?.code === 'PGRST205' ||
    err?.code === '42P01'
  ) {
    return 'Game world database schema is not yet applied. Run src/db/game-world-social-migration.sql in your Supabase SQL Editor.';
  }
  return msg;
}

export async function checkWorldDbStatus(): Promise<WorldDbStatus> {
  try {
    const res = await fetch('/api/world/db-status', {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) return await res.json();
  } catch {}
  return {
    configured: isSupabaseConfigured,
    tablesExist: true,
    migrationRequired: false,
  };
}

export function computeLockStatus(
  lockExpiresAt: string | null | undefined,
  serverClockOffsetMs = 0
): {
  isLocked: boolean;
  remainingMs: number;
  hhmmss: string;
  unlockFormatted: string;
} {
  if (!lockExpiresAt) {
    return { isLocked: false, remainingMs: 0, hhmmss: '00:00:00', unlockFormatted: '' };
  }
  const expiresMs = Date.parse(lockExpiresAt);
  if (Number.isNaN(expiresMs)) {
    return { isLocked: false, remainingMs: 0, hhmmss: '00:00:00', unlockFormatted: '' };
  }
  const authoritativeNowMs = Date.now() + serverClockOffsetMs;
  const remainingMs = Math.max(0, expiresMs - authoritativeNowMs);
  const totalSec = Math.floor(remainingMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const hhmmss = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  const unlockFormatted = new Date(expiresMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return {
    isLocked: remainingMs > 0,
    remainingMs,
    hhmmss,
    unlockFormatted,
  };
}

export async function registerPlayerAccount(params: {
  fullName: string;
  nickname: string;
  email: string;
  phoneNumber: string;
  password: string;
}): Promise<{ success: boolean; error?: string; needsEmailVerification?: boolean }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase authentication is not configured.' };
  }

  const fullName = params.fullName.trim();
  const nickname = params.nickname.trim();
  const email = params.email.trim().toLowerCase();
  const phoneNumber = params.phoneNumber.trim();

  // Check email & nickname uniqueness before signUp
  try {
    const { data: avail, error: availErr } = await supabase.rpc(
      'check_player_registration_available',
      { p_email: email, p_nickname: nickname }
    );
    if (availErr) {
      return { success: false, error: mapWorldError(availErr) };
    }
    if (avail && avail.emailAvailable === false) {
      return { success: false, error: 'An account with this email address already exists. Please log in instead.' };
    }
    if (avail && avail.nicknameAvailable === false) {
      return { success: false, error: `Nickname "${nickname}" is already taken by another driver.` };
    }
  } catch (err) {
    return { success: false, error: mapWorldError(err) };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: params.password,
    options: {
      data: {
        full_name: fullName,
        nickname,
        phone_number: phoneNumber,
      },
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Ensure profile row exists if session was returned immediately, then signOut so user MUST login explicitly
  if (data.session) {
    try {
      await supabase.rpc('get_or_create_my_player_profile', {
        p_full_name: fullName,
        p_nickname: nickname,
        p_phone_number: phoneNumber,
      });
    } catch {}
    await supabase.auth.signOut();
    return { success: true, needsEmailVerification: false };
  }

  return {
    success: true,
    needsEmailVerification: Boolean(data.user && !data.session),
  };
}

export async function loginPlayerAccount(
  email: string,
  password: string
): Promise<{
  success: boolean;
  profile?: PlayerProfile;
  serverClockOffsetMs?: number;
  error?: string;
}> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase authentication is not configured.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.user) {
    return { success: false, error: error?.message || 'Invalid email or password.' };
  }

  return await fetchMyPlayerProfile();
}

export async function requestPlayerPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase authentication is not configured.' };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/`,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function logoutPlayerAccount(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.rpc('logout_player_presence');
  } catch {}
  try {
    await supabase.auth.signOut();
  } catch {}
}

export async function fetchMyPlayerProfile(): Promise<{
  success: boolean;
  profile?: PlayerProfile;
  serverClockOffsetMs?: number;
  error?: string;
}> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured.' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { success: false, error: 'No active session.' };
  }

  const { data, error } = await supabase.rpc('get_or_create_my_player_profile', {});
  if (error || !data?.profile) {
    return { success: false, error: mapWorldError(error) };
  }

  const serverNowMs = data.serverNow ? Date.parse(data.serverNow) : Date.now();
  const serverClockOffsetMs = Number.isNaN(serverNowMs) ? 0 : serverNowMs - Date.now();

  return {
    success: true,
    profile: data.profile as PlayerProfile,
    serverClockOffsetMs,
  };
}

export async function acceptGameBriefing(): Promise<{
  success: boolean;
  profile?: PlayerProfile;
  serverClockOffsetMs?: number;
  error?: string;
}> {
  const { data, error } = await supabase.rpc('accept_game_briefing', {
    p_terms_version: TERMS_VERSION,
  });
  if (error || !data?.profile) {
    return { success: false, error: mapWorldError(error) };
  }
  const serverNowMs = data.serverNow ? Date.parse(data.serverNow) : Date.now();
  return {
    success: true,
    profile: data.profile as PlayerProfile,
    serverClockOffsetMs: Number.isNaN(serverNowMs) ? 0 : serverNowMs - Date.now(),
  };
}

export async function confirmVehicleConfiguration(params: {
  vehicle: VehicleModelType;
  color: string;
  interior: InteriorTheme;
  music: MusicPreference;
}): Promise<{
  success: boolean;
  profile?: PlayerProfile;
  serverClockOffsetMs?: number;
  error?: string;
}> {
  const { data, error } = await supabase.rpc('confirm_vehicle_configuration', {
    p_vehicle: params.vehicle,
    p_color: params.color,
    p_interior: params.interior,
    p_music: params.music,
  });

  if (error || !data?.profile) {
    return { success: false, error: mapWorldError(error) };
  }

  const serverNowMs = data.serverNow ? Date.parse(data.serverNow) : Date.now();
  return {
    success: true,
    profile: data.profile as PlayerProfile,
    serverClockOffsetMs: Number.isNaN(serverNowMs) ? 0 : serverNowMs - Date.now(),
  };
}

export async function fetchMyBlockedPlayers(): Promise<BlockedPlayerEntry[]> {
  const { data, error } = await supabase.rpc('get_my_blocked_players');
  if (error || !Array.isArray(data)) return [];
  return data as BlockedPlayerEntry[];
}

export async function blockDriverById(targetPlayerId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('block_player', { p_target_player_id: targetPlayerId });
  if (error) return { success: false, error: mapWorldError(error) };
  return { success: true };
}

export async function unblockDriverById(targetPlayerId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('unblock_player', { p_target_player_id: targetPlayerId });
  if (error) return { success: false, error: mapWorldError(error) };
  return { success: true };
}

export async function reportDriverById(params: {
  reportedPlayerId: string;
  conversationId?: string | null;
  reason: string;
  description?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('report_player', {
    p_reported_player_id: params.reportedPlayerId,
    p_conversation_id: params.conversationId || null,
    p_reason: params.reason,
    p_description: params.description || null,
  });
  if (error) return { success: false, error: mapWorldError(error) };
  return { success: true };
}

// ==============================================================================
// ADMIN MODERATION APIs (Requires Admin Session + is_active_admin())
// ==============================================================================
export interface AdminModerationOverview {
  reports: {
    id: string;
    reason: string;
    description: string | null;
    review_status: 'pending' | 'reviewed' | 'action_taken' | 'dismissed';
    admin_notes: string | null;
    created_at: string;
    reviewed_at: string | null;
    conversation_id: string | null;
    reporter_nickname: string;
    reported_player_id: string;
    reported_nickname: string;
    reported_account_status: PlayerAccountStatus;
    reported_violation_count: number;
  }[];
  incidents: {
    id: string;
    player_id: string;
    nickname: string;
    violation_category: string;
    action_taken: string;
    attempted_content: string;
    created_at: string;
  }[];
  flaggedPlayers: {
    id: string;
    nickname: string;
    account_status: PlayerAccountStatus;
    chat_violation_count: number;
    chat_restricted_until: string | null;
    last_activity_at: string;
  }[];
  config: {
    discovery_radius: number;
    heartbeat_timeout_minutes: number;
    warning_threshold: number;
    temp_restriction_minutes: number;
    suspension_threshold: number;
  } | null;
}

export async function adminFetchModerationOverview(): Promise<{
  success: boolean;
  data?: AdminModerationOverview;
  error?: string;
}> {
  const { data, error } = await supabase.rpc('admin_get_moderation_overview');
  if (error) return { success: false, error: mapWorldError(error) };
  return { success: true, data: data as AdminModerationOverview };
}

export async function adminUpdatePlayerModerationAction(params: {
  playerId: string;
  accountStatus: PlayerAccountStatus;
  restrictMinutes?: number | null;
  reportId?: string | null;
  reportStatus?: 'reviewed' | 'action_taken' | 'dismissed' | null;
  adminNotes?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('admin_update_player_moderation', {
    p_player_id: params.playerId,
    p_account_status: params.accountStatus,
    p_restrict_minutes: params.restrictMinutes ?? null,
    p_report_id: params.reportId ?? null,
    p_report_status: params.reportStatus ?? null,
    p_admin_notes: params.adminNotes ?? null,
  });
  if (error) return { success: false, error: mapWorldError(error) };
  return { success: true };
}

export async function adminSaveModerationConfig(cfg: {
  discoveryRadius: number;
  heartbeatTimeoutMinutes: number;
  warningThreshold: number;
  tempRestrictionMinutes: number;
  suspensionThreshold: number;
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('admin_update_moderation_config', {
    p_discovery_radius: cfg.discoveryRadius,
    p_heartbeat_timeout_minutes: cfg.heartbeatTimeoutMinutes,
    p_warning_threshold: cfg.warningThreshold,
    p_temp_restriction_minutes: cfg.tempRestrictionMinutes,
    p_suspension_threshold: cfg.suspensionThreshold,
  });
  if (error) return { success: false, error: mapWorldError(error) };
  return { success: true };
}
