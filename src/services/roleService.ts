import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type AccountRole =
  | 'anonymous'
  | 'admin'
  | 'dealer'
  | 'dealer_onboarding'
  | 'player'
  | 'buyer';

export interface AccountRoleResolution {
  role: AccountRole;
  userId: string | null;
  email: string | null;
  adminRole?: string | null;
  dealerId?: string | null;
  dealerBusinessName?: string | null;
  dealerAccountStatus?: string | null;
  dealerApproved?: boolean;
  playerId?: string | null;
  playerNickname?: string | null;
  playerAccountStatus?: string | null;
}

const ALLOWED_ADMIN_ROLES = new Set([
  'admin',
  'super_admin',
  'superadmin',
  'administrator',
]);

async function checkIsActiveAdminDirect(userId: string, email: string): Promise<{ isAdmin: boolean; role?: string }> {
  try {
    const uidRes = await supabase
      .from('admin_users')
      .select('id, user_id, role, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (!uidRes.error && uidRes.data) {
      const rawRole = String(uidRes.data.role || '').trim().toLowerCase();
      if (ALLOWED_ADMIN_ROLES.has(rawRole)) {
        return { isAdmin: true, role: rawRole };
      }
    }

    if (email) {
      const emailRes = await supabase
        .from('admin_users')
        .select('id, user_id, role, status')
        .ilike('email', email)
        .eq('status', 'active')
        .maybeSingle();

      if (!emailRes.error && emailRes.data) {
        const row = emailRes.data;
        if (!row.user_id || String(row.user_id) === userId) {
          const rawRole = String(row.role || '').trim().toLowerCase();
          if (ALLOWED_ADMIN_ROLES.has(rawRole)) {
            return { isAdmin: true, role: rawRole };
          }
        }
      }
    }

    const rpcRes = await supabase.rpc('is_active_admin');
    if (!rpcRes.error && rpcRes.data === true) {
      return { isAdmin: true, role: 'admin' };
    }
  } catch {
    // non-fatal
  }

  return { isAdmin: false };
}

/**
 * Authoritatively resolves the currently authenticated user's role from the database.
 * Uses /api/auth/me first and falls back to direct RLS-protected Supabase queries if needed.
 */
export async function resolveCurrentUserRole(explicitToken?: string | null): Promise<AccountRoleResolution> {
  if (!isSupabaseConfigured) {
    return { role: 'anonymous', userId: null, email: null };
  }

  let accessToken = explicitToken || null;
  let sessionUser: { id: string; email?: string; user_metadata?: Record<string, any> } | null = null;

  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      sessionUser = data.session.user;
      if (!accessToken) {
        accessToken = data.session.access_token;
      }
    }
  } catch {
    // ignore
  }

  if (!accessToken && !sessionUser) {
    return { role: 'anonymous', userId: null, email: null };
  }

  // 1. Authoritative server verification via /api/auth/me
  if (accessToken) {
    try {
      const res = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(4500),
      });

      if (res.ok) {
        const payload = await res.json();
        if (payload && payload.role) {
          return {
            role: payload.role as AccountRole,
            userId: payload.userId || sessionUser?.id || null,
            email: payload.email || sessionUser?.email || null,
            adminRole: payload.adminRole || null,
            dealerId: payload.dealerId || null,
            dealerBusinessName: payload.dealerBusinessName || null,
            dealerAccountStatus: payload.dealerAccountStatus || null,
            dealerApproved: Boolean(payload.dealerApproved),
            playerId: payload.playerId || null,
            playerNickname: payload.playerNickname || null,
            playerAccountStatus: payload.playerAccountStatus || null,
          };
        }
      } else if (res.status === 401) {
        return { role: 'anonymous', userId: null, email: null };
      }
    } catch {
      // Fall back to direct Supabase DB lookups when API server is unreachable
    }
  }

  if (!sessionUser) {
    return { role: 'anonymous', userId: null, email: null };
  }

  const userId = sessionUser.id;
  const email = (sessionUser.email || '').trim().toLowerCase();

  // 2. Direct DB role resolution (strict separation order)
  const [adminCheck, playerRes, dealerRes] = await Promise.all([
    checkIsActiveAdminDirect(userId, email),
    supabase
      .from('player_profiles')
      .select('id, nickname, account_status')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('dealer_accounts')
      .select('dealer_id, account_status')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (adminCheck.isAdmin) {
    return {
      role: 'admin',
      userId,
      email,
      adminRole: adminCheck.role || 'admin',
    };
  }

  if (!playerRes.error && playerRes.data?.id) {
    return {
      role: 'player',
      userId,
      email,
      playerId: String(playerRes.data.id),
      playerNickname: playerRes.data.nickname || null,
      playerAccountStatus: playerRes.data.account_status || 'active',
    };
  }

  if (!dealerRes.error && dealerRes.data?.dealer_id) {
    return {
      role: 'dealer',
      userId,
      email,
      dealerId: String(dealerRes.data.dealer_id),
      dealerAccountStatus: dealerRes.data.account_status || 'pending',
    };
  }

  const metaRole = String(sessionUser.user_metadata?.role || '').trim().toLowerCase();
  if (metaRole === 'dealer') {
    return { role: 'dealer_onboarding', userId, email };
  }

  return { role: 'buyer', userId, email };
}
