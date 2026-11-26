import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { getServerEnv } from '../config/env.js';

export function getSupabaseClient(authHeader?: string): SupabaseClient | null {
  const { supabaseUrl, supabaseAnonKey } = getServerEnv();
  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  const { supabaseUrl, supabaseServiceRoleKey } = getServerEnv();
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

export async function verifySupabaseUser(authHeader?: string): Promise<
  | { ok: true; user: User; token: string; authHeader: string; supabase: SupabaseClient }
  | { ok: false; status: number; error: string }
> {
  const token = extractBearerToken(authHeader);
  if (!token) {
    return { ok: false, status: 401, error: 'Authentication required. Provide a valid Bearer token.' };
  }

  const { supabaseUrl, supabaseAnonKey } = getServerEnv();
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, status: 503, error: 'Supabase authentication is not configured on the server.' };
  }

  const normalizedHeader = `Bearer ${token}`;
  const supabase = getSupabaseClient(normalizedHeader);
  if (!supabase) {
    return { ok: false, status: 503, error: 'Unable to initialize Supabase client.' };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return { ok: false, status: 401, error: 'Invalid or expired authentication session.' };
    }

    return {
      ok: true,
      user: data.user,
      token,
      authHeader: normalizedHeader,
      supabase,
    };
  } catch {
    return { ok: false, status: 401, error: 'Authentication verification failed.' };
  }
}

const ALLOWED_ADMIN_ROLES = new Set([
  'admin',
  'super_admin',
  'superadmin',
  'administrator',
]);

function evaluateAdminRow(row: Record<string, any> | null | undefined): {
  isAuthorized: boolean;
  role?: string;
  rejectReason?: string;
} {
  if (!row || typeof row !== 'object') {
    return { isAuthorized: false, rejectReason: 'empty_row' };
  }

  const hasStatus = row.status !== undefined && row.status !== null;
  const normalizedStatus = hasStatus ? String(row.status).trim().toLowerCase() : '';
  const isStatusActive = hasStatus
    ? normalizedStatus === 'active'
    : typeof row.is_active === 'boolean'
    ? row.is_active === true
    : false;

  if (!isStatusActive) {
    return {
      isAuthorized: false,
      rejectReason: `inactive_status:${normalizedStatus || String(row.is_active)}`,
    };
  }

  const rawRole = String(row.role || '').trim().toLowerCase();
  if (!ALLOWED_ADMIN_ROLES.has(rawRole)) {
    return {
      isAuthorized: false,
      rejectReason: `unauthorized_role:${rawRole || 'none'}`,
    };
  }

  return { isAuthorized: true, role: rawRole };
}

export async function verifyActiveAdmin(
  supabase: SupabaseClient,
  user: User
): Promise<{ isAdmin: boolean; role?: string }> {
  const adminClient = getSupabaseAdminClient();
  const lookupClient = adminClient ?? supabase;
  const verifiedEmail =
    typeof user.email === 'string' && user.email.trim().length > 0
      ? user.email.trim().toLowerCase()
      : null;

  const diagnosticReasons: string[] = [];

  try {
    // 1. Primary authoritative lookup by verified Supabase Auth user.id
    const uidLookup = await lookupClient
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .limit(10);

    if (uidLookup.error) {
      diagnosticReasons.push(`uid_query_err:${uidLookup.error.code || uidLookup.error.message}`);
    } else if (Array.isArray(uidLookup.data) && uidLookup.data.length > 0) {
      for (const row of uidLookup.data as Record<string, any>[]) {
        if (String(row.user_id || '') !== user.id) continue;
        const evalRes = evaluateAdminRow(row);
        if (evalRes.isAuthorized) {
          return { isAdmin: true, role: evalRes.role };
        }
        if (evalRes.rejectReason) {
          diagnosticReasons.push(`uid_row_${evalRes.rejectReason}`);
        }
      }
    } else {
      diagnosticReasons.push('uid_not_found');
    }

    // 2. Secondary lookup by server-verified Auth user.email (only for unlinked or matching user_id rows)
    if (verifiedEmail) {
      const emailLookup = await lookupClient
        .from('admin_users')
        .select('*')
        .ilike('email', verifiedEmail)
        .limit(10);

      if (emailLookup.error) {
        diagnosticReasons.push(`email_query_err:${emailLookup.error.code || emailLookup.error.message}`);
      } else if (Array.isArray(emailLookup.data) && emailLookup.data.length > 0) {
        for (const row of emailLookup.data as Record<string, any>[]) {
          // Never allow an account with a different bound user_id to claim another admin row
          if (row.user_id && String(row.user_id) !== user.id) {
            diagnosticReasons.push('email_row_user_id_mismatch');
            continue;
          }

          const evalRes = evaluateAdminRow(row);
          if (!evalRes.isAuthorized) {
            if (evalRes.rejectReason) {
              diagnosticReasons.push(`email_row_${evalRes.rejectReason}`);
            }
            continue;
          }

          // Best-effort auto-link if user_id was NULL in admin_users
          if (!row.user_id && row.id) {
            try {
              await lookupClient
                .from('admin_users')
                .update({ user_id: user.id })
                .eq('id', row.id)
                .is('user_id', null);
            } catch {
              // Non-fatal: authorization already succeeded on verified row
            }
          }

          return { isAdmin: true, role: evalRes.role };
        }
      } else {
        diagnosticReasons.push('email_not_found');
      }
    } else {
      diagnosticReasons.push('no_verified_email');
    }

    // 3. Authoritative PostgreSQL SECURITY DEFINER RPC fallback (bypasses direct table RLS safely using auth.uid())
    try {
      const activeRpc = await supabase.rpc('is_active_admin');
      if (!activeRpc.error && activeRpc.data === true) {
        return { isAdmin: true, role: 'admin' };
      }
      if (activeRpc.error) {
        diagnosticReasons.push(`rpc_is_active_admin_err:${activeRpc.error.code || activeRpc.error.message}`);
      } else {
        diagnosticReasons.push(`rpc_is_active_admin:${String(activeRpc.data)}`);
      }
    } catch {
      diagnosticReasons.push('rpc_is_active_admin_exception');
    }

    try {
      const adminRpc = await supabase.rpc('is_admin');
      if (!adminRpc.error && adminRpc.data === true) {
        return { isAdmin: true, role: 'admin' };
      }
      if (adminRpc.error) {
        diagnosticReasons.push(`rpc_is_admin_err:${adminRpc.error.code || adminRpc.error.message}`);
      } else {
        diagnosticReasons.push(`rpc_is_admin:${String(adminRpc.data)}`);
      }
    } catch {
      diagnosticReasons.push('rpc_is_admin_exception');
    }

    console.warn(
      `[MANIFOLD Auth] verifyActiveAdmin denied for user ${user.id} (serviceRole=${Boolean(
        adminClient
      )}): ${diagnosticReasons.join(', ')}`
    );
    return { isAdmin: false };
  } catch (err: any) {
    console.warn(
      `[MANIFOLD Auth] verifyActiveAdmin exception for user ${user.id}: ${
        err?.message || 'unknown_error'
      }`
    );
    return { isAdmin: false };
  }
}

export interface DealerAccountCheckResult {
  hasAccount: boolean;
  isApproved: boolean;
  dealerId?: string;
  businessName?: string;
  accountStatus?: string;
  dealerStatus?: string;
  reason?: string;
}

export async function verifyDealerAccount(
  supabase: SupabaseClient,
  user: User
): Promise<DealerAccountCheckResult> {
  try {
    const { data: da, error: daErr } = await supabase
      .from('dealer_accounts')
      .select('dealer_id, account_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (daErr || !da || !da.dealer_id) {
      return {
        hasAccount: false,
        isApproved: false,
        reason: 'A registered MANIFOLD dealership account is required.',
      };
    }

    const dealerId = String(da.dealer_id);
    const accountStatus = String(da.account_status || 'pending').toLowerCase();

    if (accountStatus === 'suspended') {
      return {
        hasAccount: true,
        isApproved: false,
        dealerId,
        accountStatus,
        dealerStatus: 'disapproved',
        reason: 'Your dealership account is suspended.',
      };
    }

    const { data: dealerRow } = await supabase
      .from('dealers')
      .select('id, name, business_name, dealer_status, is_verified')
      .eq('id', dealerId)
      .maybeSingle();

    const dealerStatus = String((dealerRow as any)?.dealer_status || '').toLowerCase() || (
      accountStatus === 'active' && (dealerRow as any)?.is_verified !== false ? 'approved' : 'pending'
    );
    const isVerified = typeof (dealerRow as any)?.is_verified === 'boolean'
      ? (dealerRow as any).is_verified
      : accountStatus === 'active';

    const isApproved = accountStatus === 'active' && dealerStatus === 'approved' && isVerified;

    return {
      hasAccount: true,
      isApproved,
      dealerId,
      businessName: (dealerRow as any)?.business_name || (dealerRow as any)?.name || undefined,
      accountStatus,
      dealerStatus,
      reason: isApproved
        ? undefined
        : 'Dealership approval (dealer_status = approved) is required to access dealer AI tools.',
    };
  } catch {
    return {
      hasAccount: false,
      isApproved: false,
      reason: 'Unable to verify dealership authorization.',
    };
  }
}

export interface PlayerProfileCheckResult {
  isPlayer: boolean;
  playerId?: string;
  nickname?: string;
  accountStatus?: string;
}

export async function verifyPlayerProfile(
  supabase: SupabaseClient,
  user: User
): Promise<PlayerProfileCheckResult> {
  const lookupClient = getSupabaseAdminClient() ?? supabase;
  try {
    const { data, error } = await lookupClient
      .from('player_profiles')
      .select('id, nickname, account_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data || !data.id) {
      return { isPlayer: false };
    }

    return {
      isPlayer: true,
      playerId: String(data.id),
      nickname: typeof data.nickname === 'string' ? data.nickname : undefined,
      accountStatus: typeof data.account_status === 'string' ? data.account_status : 'active',
    };
  } catch {
    return { isPlayer: false };
  }
}

export type ManifoldAccountRole =
  | 'admin'
  | 'dealer'
  | 'dealer_onboarding'
  | 'player'
  | 'buyer';

export interface ResolvedAccountIdentity {
  role: ManifoldAccountRole;
  adminRole?: string;
  dealerId?: string;
  dealerBusinessName?: string;
  dealerAccountStatus?: string;
  dealerApproved?: boolean;
  playerId?: string;
  playerNickname?: string;
  playerAccountStatus?: string;
}

/**
 * Resolves the authoritative role for an authenticated Supabase user from database tables.
 * Strict separation:
 * 1. Active row in admin_users -> 'admin'
 * 2. Row in player_profiles -> 'player' (prevents any Game Player from escalating into Dealer routes)
 * 3. Row in dealer_accounts -> 'dealer'
 * 4. Explicit dealer signup metadata prior to completing business info -> 'dealer_onboarding'
 * 5. Otherwise -> 'buyer'
 */
export async function resolveAuthenticatedRole(
  supabase: SupabaseClient,
  user: User
): Promise<ResolvedAccountIdentity> {
  const [adminCheck, playerCheck, dealerCheck] = await Promise.all([
    verifyActiveAdmin(supabase, user),
    verifyPlayerProfile(supabase, user),
    verifyDealerAccount(supabase, user),
  ]);

  if (adminCheck.isAdmin) {
    return {
      role: 'admin',
      adminRole: adminCheck.role,
    };
  }

  if (playerCheck.isPlayer) {
    return {
      role: 'player',
      playerId: playerCheck.playerId,
      playerNickname: playerCheck.nickname,
      playerAccountStatus: playerCheck.accountStatus,
    };
  }

  if (dealerCheck.hasAccount && dealerCheck.dealerId) {
    return {
      role: 'dealer',
      dealerId: dealerCheck.dealerId,
      dealerBusinessName: dealerCheck.businessName,
      dealerAccountStatus: dealerCheck.accountStatus,
      dealerApproved: dealerCheck.isApproved,
    };
  }

  const rawMetaRole = String(user.user_metadata?.role || '').trim().toLowerCase();
  if (rawMetaRole === 'dealer') {
    return { role: 'dealer_onboarding' };
  }

  return { role: 'buyer' };
}

