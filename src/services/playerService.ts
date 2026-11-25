import { supabase, isSupabaseConfigured, supabaseUrl } from '../lib/supabase';
import { retryWithBackoff, withTimeout } from '../utils/networkReliability';
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
  xp_balance?: number;
  missions_completed_count?: number;
  badges_earned?: string[];
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

export interface WorldDbCheckEntry {
  exists: boolean;
  unverifiedAnonRestricted?: boolean;
  code?: string;
  error?: string;
}

export interface WorldDbStatus {
  configured: boolean;
  tablesExist: boolean;
  migrationRequired: boolean;
  verificationMode?: 'service_role' | 'authenticated_user' | 'anon';
  supabaseHost?: string | null;
  clientSupabaseHost?: string | null;
  hostMismatch?: boolean;
  checks?: Record<string, WorldDbCheckEntry>;
  networkUnreachable?: boolean;
  migrationFilePath?: string;
  error?: string;
  httpStatus?: number;
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

function extractClientSupabaseHost(url?: string | null): string | null {
  const trimmed = String(url || '').trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).host;
  } catch {
    return null;
  }
}

export function formatWorldSupabaseError(err: any, fallback = 'Database request failed'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const code = err?.code ? String(err.code).trim() : '';
  const message = String(err?.message || fallback).trim();
  const details = err?.details ? String(err.details).trim() : '';
  const hint = err?.hint ? String(err.hint).trim() : '';
  const prefix = code ? `[${code}] ` : '';
  const suffixParts = [
    details ? `Details: ${details}` : '',
    hint ? `Hint: ${hint}` : '',
  ].filter(Boolean);
  return `${prefix}${message}${suffixParts.length > 0 ? ` (${suffixParts.join(' | ')})` : ''}`;
}

function mapWorldError(err: any): string {
  const msg = String(err?.message || err || 'Unexpected error');
  const lower = msg.toLowerCase();

  if (err?.isTimeout || lower.includes('timed out') || lower.includes('network')) {
    return 'Connection timed out. Please check your internet connection and try again.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please verify your email address using the confirmation link in your inbox before signing in.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'Incorrect email address or password. Please check your details and try again.';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (msg.includes('idx_player_profiles_nickname_lower') || lower.includes('nickname')) {
    return 'That public nickname is already taken or invalid. Choose a unique 3–20 character nickname.';
  }
  return formatWorldSupabaseError(err, 'Something went wrong while connecting to MANIFOLD World.');
}

export async function checkWorldDbStatus(): Promise<WorldDbStatus> {
  const clientSupabaseHost = extractClientSupabaseHost(supabaseUrl);
  try {
    const headers: Record<string, string> = {};
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // Proceed without token if session lookup fails
      }
    }

    const res = await fetch('/api/world/db-status', {
      cache: 'no-store',
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const payload = (await res.json()) as WorldDbStatus;
      const serverHost = payload.supabaseHost ?? null;
      const hostMismatch = Boolean(
        clientSupabaseHost && serverHost && clientSupabaseHost !== serverHost
      );
      return {
        ...payload,
        clientSupabaseHost,
        hostMismatch,
      };
    }

    let serverError = `Database status check failed (HTTP ${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error) serverError = `${serverError}: ${errBody.error}`;
    } catch {
      // ignore non-JSON error body
    }

    return {
      configured: isSupabaseConfigured,
      tablesExist: false,
      migrationRequired: false,
      clientSupabaseHost,
      httpStatus: res.status,
      error: serverError,
    };
  } catch (err: any) {
    return {
      configured: isSupabaseConfigured,
      tablesExist: true,
      migrationRequired: false,
      networkUnreachable: true,
      clientSupabaseHost,
      error: err?.message || 'Unable to reach /api/world/db-status',
    };
  }
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
    const { data: avail, error: availErr } = await withTimeout(
      supabase.rpc('check_player_registration_available', {
        p_email: email,
        p_nickname: nickname,
      }),
      10000,
      'Registration availability check'
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

  let data: any;
  let error: any;
  try {
    const res = await withTimeout(
      supabase.auth.signUp({
        email,
        password: params.password,
        options: {
          data: {
            full_name: fullName,
            nickname,
            phone_number: phoneNumber,
          },
        },
      }),
      12000,
      'Create account'
    );
    data = res.data;
    error = res.error;
  } catch (err) {
    return { success: false, error: mapWorldError(err) };
  }

  if (error) {
    return { success: false, error: mapWorldError(error) };
  }

  // Ensure profile row exists if session was returned immediately, then signOut so user MUST login explicitly
  if (data.session) {
    try {
      const { error: profileErr } = await withTimeout(
        supabase.rpc('get_or_create_my_player_profile', {
          p_full_name: fullName,
          p_nickname: nickname,
          p_phone_number: phoneNumber,
        }),
        10000,
        'Save player profile'
      );
      await withTimeout(supabase.auth.signOut(), 6000, 'Reset post-signup session').catch(() => {});
      if (profileErr) {
        return { success: false, error: mapWorldError(profileErr) };
      }
      return { success: true, needsEmailVerification: false };
    } catch (err) {
      await supabase.auth.signOut().catch(() => {});
      return { success: false, error: mapWorldError(err) };
    }
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

  try {
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      }),
      12000,
      'Sign in'
    );

    if (error || !data.user) {
      return { success: false, error: error ? mapWorldError(error) : 'Invalid email or password.' };
    }

    return await fetchMyPlayerProfile();
  } catch (err) {
    return { success: false, error: mapWorldError(err) };
  }
}

export async function requestPlayerPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase authentication is not configured.' };
  }
  try {
    const { error } = await withTimeout(
      supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/`,
      }),
      10000,
      'Password reset'
    );
    if (error) return { success: false, error: mapWorldError(error) };
    return { success: true };
  } catch (err) {
    return { success: false, error: mapWorldError(err) };
  }
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

  try {
    const { data: sessionData } = await withTimeout(
      supabase.auth.getSession(),
      8000,
      'Session verification'
    );
    if (!sessionData.session) {
      return { success: false, error: 'No active session.' };
    }

    const { data, error } = await retryWithBackoff(
      () =>
        withTimeout(
          supabase.rpc('get_or_create_my_player_profile', {}),
          10000,
          'Fetch player profile'
        ),
      { maxAttempts: 2 }
    );
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
  } catch (err) {
    return { success: false, error: mapWorldError(err) };
  }
}

export async function acceptGameBriefing(): Promise<{
  success: boolean;
  profile?: PlayerProfile;
  serverClockOffsetMs?: number;
  error?: string;
}> {
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('accept_game_briefing', {
        p_terms_version: TERMS_VERSION,
      }),
      10000,
      'Accept driver briefing'
    );
    if (error || !data?.profile) {
      return { success: false, error: mapWorldError(error) };
    }
    const serverNowMs = data.serverNow ? Date.parse(data.serverNow) : Date.now();
    return {
      success: true,
      profile: data.profile as PlayerProfile,
      serverClockOffsetMs: Number.isNaN(serverNowMs) ? 0 : serverNowMs - Date.now(),
    };
  } catch (err) {
    return { success: false, error: mapWorldError(err) };
  }
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
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('confirm_vehicle_configuration', {
        p_vehicle: params.vehicle,
        p_color: params.color,
        p_interior: params.interior,
        p_music: params.music,
      }),
      10000,
      'Save vehicle configuration'
    );

    if (error || !data?.profile) {
      return { success: false, error: mapWorldError(error) };
    }

    const serverNowMs = data.serverNow ? Date.parse(data.serverNow) : Date.now();
    return {
      success: true,
      profile: data.profile as PlayerProfile,
      serverClockOffsetMs: Number.isNaN(serverNowMs) ? 0 : serverNowMs - Date.now(),
    };
  } catch (err) {
    return { success: false, error: mapWorldError(err) };
  }
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
// ADMIN GAME PLAYERS, MODERATION & AUDIT APIs (Requires Admin Session + is_active_admin())
// ==============================================================================
export type AdminPlayerActionType =
  | 'suspend_account'
  | 'reactivate_account'
  | 'restrict_chat_temp'
  | 'restrict_chat_permanent'
  | 'restore_chat'
  | 'review_report'
  | 'dismiss_report';

export interface AdminPlayersDirectorySummary {
  totalRegistered: number;
  onlineCount: number;
  offlineCount: number;
  completedOnboarding: number;
  incompleteOnboarding: number;
  suspendedCount: number;
  chatRestrictedCount: number;
  newRegistrations24h: number;
}

export interface AdminPlayerDirectoryItem {
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
  selected_vehicle: VehicleModelType | null;
  selected_vehicle_color: string | null;
  selected_interior: InteriorTheme | null;
  selected_music_preference: MusicPreference | null;
  settings_lock_expires_at: string | null;
  chat_violation_count: number;
  chat_restricted_until: string | null;
  chat_restriction_reason: string | null;
  suspended_reason: string | null;
  last_activity_at: string;
  world_region: string | null;
  is_online: boolean;
  last_heartbeat_at: string | null;
}

export interface AdminPlayersDirectoryResponse {
  summary: AdminPlayersDirectorySummary;
  totalCount: number;
  page: number;
  pageSize: number;
  players: AdminPlayerDirectoryItem[];
}

export interface AdminPlayerDetailResponse {
  player: AdminPlayerDirectoryItem & {
    terms_accepted_at: string | null;
    settings_confirmed_at: string | null;
    credits_balance: number;
    suspended_at: string | null;
  };
  incidents: {
    id: string;
    violation_category: string;
    severity: 'blocked' | 'flagged_for_review' | 'cleared';
    action_taken: string;
    attempted_content: string;
    created_at: string;
  }[];
  reports: {
    id: string;
    reason: string;
    description: string | null;
    review_status: 'pending' | 'reviewed' | 'action_taken' | 'dismissed';
    admin_notes: string | null;
    reporter_nickname: string;
    created_at: string;
    reviewed_at: string | null;
  }[];
  auditLogs: {
    id: string;
    admin_email: string;
    action: string;
    reason: string;
    metadata: Record<string, any>;
    created_at: string;
  }[];
}

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
    reported_chat_status: PlayerChatStatus;
    reported_violation_count: number;
  }[];
  incidents: {
    id: string;
    player_id: string;
    nickname: string;
    violation_category: string;
    severity?: 'blocked' | 'flagged_for_review' | 'cleared';
    action_taken: string;
    attempted_content: string;
    created_at: string;
  }[];
  flaggedPlayers: {
    id: string;
    nickname: string;
    account_status: PlayerAccountStatus;
    chat_status: PlayerChatStatus;
    chat_violation_count: number;
    chat_restricted_until: string | null;
    last_activity_at: string;
  }[];
  auditLogs: {
    id: string;
    admin_email: string;
    player_id: string;
    player_nickname: string;
    action: string;
    reason: string;
    created_at: string;
  }[];
  config: {
    discovery_radius: number;
    heartbeat_timeout_minutes: number;
    warning_threshold: number;
    temp_restriction_minutes: number;
    suspension_threshold: number;
  } | null;
}

export async function adminFetchPlayersDirectory(params: {
  search?: string;
  accountStatus?: string;
  chatStatus?: string;
  onboardingStatus?: string;
  onlineFilter?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  success: boolean;
  data?: AdminPlayersDirectoryResponse;
  error?: string;
  code?: string;
}> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: 'Browser Supabase client is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).',
    };
  }
  const { data, error } = await supabase.rpc('admin_get_players_directory', {
    p_search: params.search ?? '',
    p_account_status: params.accountStatus ?? 'all',
    p_chat_status: params.chatStatus ?? 'all',
    p_onboarding_status: params.onboardingStatus ?? 'all',
    p_online_filter: params.onlineFilter ?? 'all',
    p_page: params.page ?? 1,
    p_page_size: params.pageSize ?? 20,
  });
  if (error) {
    return {
      success: false,
      error: formatWorldSupabaseError(error, 'Failed to query admin_get_players_directory.'),
      code: error.code,
    };
  }
  return { success: true, data: data as AdminPlayersDirectoryResponse };
}

export async function adminFetchPlayerDetail(playerId: string): Promise<{
  success: boolean;
  data?: AdminPlayerDetailResponse;
  error?: string;
  code?: string;
}> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Browser Supabase client is not configured.' };
  }
  const { data, error } = await supabase.rpc('admin_get_player_detail', {
    p_player_id: playerId,
  });
  if (error) {
    return {
      success: false,
      error: formatWorldSupabaseError(error, 'Failed to query admin_get_player_detail.'),
      code: error.code,
    };
  }
  return { success: true, data: data as AdminPlayerDetailResponse };
}

export async function adminFetchModerationOverview(): Promise<{
  success: boolean;
  data?: AdminModerationOverview;
  error?: string;
  code?: string;
}> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Browser Supabase client is not configured.' };
  }
  const { data, error } = await supabase.rpc('admin_get_moderation_overview');
  if (error) {
    return {
      success: false,
      error: formatWorldSupabaseError(error, 'Failed to query admin_get_moderation_overview.'),
      code: error.code,
    };
  }
  return { success: true, data: data as AdminModerationOverview };
}

export async function adminExecutePlayerAction(params: {
  playerId: string;
  action: AdminPlayerActionType;
  reason: string;
  restrictMinutes?: number | null;
  reportId?: string | null;
  reportStatus?: 'reviewed' | 'action_taken' | 'dismissed' | null;
}): Promise<{ success: boolean; error?: string; code?: string }> {
  const cleanReason = params.reason.trim();
  if (cleanReason.length < 3) {
    return { success: false, error: 'A clear administrative reason (at least 3 characters) is required.' };
  }
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Browser Supabase client is not configured.' };
  }
  const { error } = await supabase.rpc('admin_execute_player_action', {
    p_player_id: params.playerId,
    p_action: params.action,
    p_reason: cleanReason,
    p_restrict_minutes: params.restrictMinutes ?? null,
    p_report_id: params.reportId ?? null,
    p_report_status: params.reportStatus ?? null,
  });
  if (error) {
    return {
      success: false,
      error: formatWorldSupabaseError(error, 'Failed to execute admin_execute_player_action.'),
      code: error.code,
    };
  }
  return { success: true };
}

export async function adminSaveModerationConfig(cfg: {
  discoveryRadius: number;
  heartbeatTimeoutMinutes: number;
  warningThreshold: number;
  tempRestrictionMinutes: number;
  suspensionThreshold: number;
}): Promise<{ success: boolean; error?: string; code?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Browser Supabase client is not configured.' };
  }
  const { error } = await supabase.rpc('admin_update_moderation_config', {
    p_discovery_radius: cfg.discoveryRadius,
    p_heartbeat_timeout_minutes: cfg.heartbeatTimeoutMinutes,
    p_warning_threshold: cfg.warningThreshold,
    p_temp_restriction_minutes: cfg.tempRestrictionMinutes,
    p_suspension_threshold: cfg.suspensionThreshold,
  });
  if (error) {
    return {
      success: false,
      error: formatWorldSupabaseError(error, 'Failed to update moderation configuration.'),
      code: error.code,
    };
  }
  return { success: true };
}
