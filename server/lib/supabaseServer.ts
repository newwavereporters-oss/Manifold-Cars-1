import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { getServerEnv } from '../config/env';

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

export async function verifyActiveAdmin(
  supabase: SupabaseClient,
  user: User
): Promise<{ isAdmin: boolean; role?: string }> {
  try {
    let { data, error } = await supabase
      .from('admin_users')
      .select('id, role, status, user_id, email')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!data && user.email) {
      const cleanEmail = user.email.trim().toLowerCase();
      const emailLookup = await supabase
        .from('admin_users')
        .select('id, role, status, user_id, email')
        .ilike('email', cleanEmail)
        .eq('status', 'active')
        .maybeSingle();
      if (emailLookup.data) {
        data = emailLookup.data;
        error = emailLookup.error;
      }
    }

    if (error || !data || data.status !== 'active') {
      return { isAdmin: false };
    }

    const rawRole = String(data.role || '').trim().toLowerCase();
    const isAuthorizedRole =
      rawRole === 'admin' || rawRole === 'super_admin' || rawRole === 'administrator';

    if (!isAuthorizedRole) {
      return { isAdmin: false };
    }

    return { isAdmin: true, role: rawRole };
  } catch {
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
