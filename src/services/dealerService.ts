import { DealerInfo } from '../types';
import { supabase, checkIsSupabaseConfigured } from '../lib/supabase';
import {
  DealerApprovalState,
  DealerRawAccountStatus,
  DealerTableStatus,
  resolveDealerApprovalState,
} from './dealerOnboardingService';

export interface DealerFullRecord extends DealerInfo {
  address?: string;
  phone?: string;
  email?: string;
}

export interface AdminDealerAccountRecord {
  dealerId: string;
  dealerAccountId?: string | null;
  userId?: string | null;
  hasPortalAccount: boolean;
  businessName: string;
  tradingName?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  city: string;
  state: string;
  country: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  businessType?: string | null;
  businessDescription?: string | null;
  website?: string | null;
  cacRegistrationNumber?: string | null;
  accountStatus: DealerRawAccountStatus;
  dealerStatus: DealerTableStatus;
  onboardingStatus: string;
  isVerified: boolean;
  approvalStatus: DealerApprovalState;
  canListCars: boolean;
  approvalNotes?: string | null;
  approvedAt?: string | null;
  disapprovedAt?: string | null;
  joinedYear: number;
  createdAt: string;
  totalVehicles: number;
  publishedVehicles: number;
  inReviewVehicles: number;
}

export interface AdminDealerDirectoryResult {
  accounts: AdminDealerAccountRecord[];
  migrationRequired: boolean;
  error?: string;
}

export type AdminDealerApprovalAction = 'approve' | 'disapprove' | 'pending' | 'suspend';

function isMissingRpcError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  return (
    err.code === 'PGRST202' ||
    err.code === '42883' ||
    msg.includes('could not find the function') ||
    (msg.includes('function') && msg.includes('does not exist'))
  );
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallbackValue: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallbackValue);
      }
    }, ms);
    Promise.resolve(promise)
      .then((val) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(val);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallbackValue);
        }
      });
  });
}

export function buildDealerDirectoryFromTables(params: {
  dealerRows: any[];
  accountRows?: any[];
  profileRows?: any[];
  addressRows?: any[];
  carRows?: any[];
}): AdminDealerAccountRecord[] {
  const {
    dealerRows = [],
    accountRows = [],
    profileRows = [],
    addressRows = [],
    carRows = [],
  } = params;

  const dealerMap = new Map<string, any>();
  dealerRows.forEach((d: any) => {
    if (d && d.id !== undefined && d.id !== null) {
      dealerMap.set(String(d.id), d);
    }
  });

  const accountMap = new Map<string, any>();
  accountRows.forEach((a: any) => {
    if (a && a.dealer_id !== undefined && a.dealer_id !== null) {
      accountMap.set(String(a.dealer_id), a);
    }
  });

  const profileMap = new Map<string, any>();
  profileRows.forEach((p: any) => {
    if (p && p.dealer_id !== undefined && p.dealer_id !== null) {
      profileMap.set(String(p.dealer_id), p);
    }
  });

  const addrMap = new Map<string, any>();
  addressRows.forEach((ad: any) => {
    if (ad && ad.dealer_id !== undefined && ad.dealer_id !== null) {
      addrMap.set(String(ad.dealer_id), ad);
    }
  });

  const allIds = new Set<string>([
    ...Array.from(dealerMap.keys()),
    ...Array.from(accountMap.keys()),
  ]);

  const merged: AdminDealerAccountRecord[] = Array.from(allIds).map((id) => {
    const d = dealerMap.get(id) || {};
    const da = accountMap.get(id) || null;
    const prof = profileMap.get(id) || {};
    const addr = addrMap.get(id) || {};

    const hasExplicitVerified =
      typeof d.is_verified === 'boolean' || typeof d.verified_partner === 'boolean';
    const rawDealerStatus = d.dealer_status ?? undefined;
    const isVerified =
      typeof d.is_verified === 'boolean'
        ? d.is_verified
        : typeof d.verified_partner === 'boolean'
        ? d.verified_partner
        : rawDealerStatus === 'approved';
    const rawStatus =
      da?.account_status ||
      (rawDealerStatus === 'approved'
        ? 'active'
        : rawDealerStatus === 'disapproved'
        ? 'rejected'
        : isVerified
        ? 'active'
        : 'pending');
    const resolved = resolveDealerApprovalState(rawStatus, isVerified, rawDealerStatus);
    const approvalStatus: DealerApprovalState =
      !da && !hasExplicitVerified && !rawDealerStatus ? 'pending' : resolved.approvalStatus;

    const dealerCars = carRows.filter((c: any) => String(c.dealer_id || '') === id);

    return {
      dealerId: id,
      dealerAccountId: da?.id ? String(da.id) : null,
      userId: da?.user_id ? String(da.user_id) : null,
      hasPortalAccount: Boolean(da?.user_id),
      businessName: d.business_name || d.name || prof.trading_name || 'Unnamed Dealership',
      tradingName: prof.trading_name || null,
      contactName: d.contact_name || null,
      email: d.email || null,
      phone: d.phone || null,
      city: addr.city || d.city || 'Lagos',
      state: addr.state || d.state || 'Lagos',
      country: addr.country || d.country || 'Nigeria',
      addressLine1: addr.address_line_1 || d.address || null,
      addressLine2: addr.address_line_2 || null,
      businessType: prof.business_type || null,
      businessDescription: prof.business_description || d.description || null,
      website: prof.website || null,
      cacRegistrationNumber: prof.cac_registration_number || null,
      accountStatus: resolved.accountStatus,
      dealerStatus: resolved.dealerStatus,
      onboardingStatus: da?.onboarding_status || (da?.user_id ? 'completed' : 'directory_only'),
      isVerified,
      approvalStatus,
      canListCars: da?.user_id
        ? resolved.isApproved
        : rawDealerStatus
        ? resolved.dealerStatus === 'approved' && isVerified
        : isVerified,
      approvalNotes: da?.approval_notes || null,
      approvedAt: da?.approved_at || null,
      disapprovedAt: da?.disapproved_at || null,
      joinedYear: Number(d.joined_year) || new Date().getFullYear(),
      createdAt: da?.created_at || d.created_at || new Date().toISOString(),
      totalVehicles: dealerCars.length,
      publishedVehicles: dealerCars.filter(
        (c: any) => String(c.status || '').toUpperCase() === 'PUBLISHED'
      ).length,
      inReviewVehicles: dealerCars.filter(
        (c: any) => String(c.status || '').toUpperCase() === 'PENDING_REVIEW'
      ).length,
    };
  });

  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return merged;
}

class DealerService {
  private cache: DealerFullRecord[] = [];

  public async getDealers(allowSeed = true): Promise<DealerFullRecord[]> {
    if (!checkIsSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase.from('dealers').select('*');

    if (error) {
      throw new Error(`Failed to load dealers from Supabase: ${error.message}`);
    }

    if (data && data.length > 0) {
      this.cache = data
        .map((d: any) => ({
          id: String(d.id),
          name: d.business_name || d.name || 'Unnamed Dealership',
          city: d.city || 'Lagos',
          state: d.state || 'Lagos',
          verified_partner:
            d.dealer_status === 'approved'
              ? true
              : d.dealer_status === 'disapproved'
              ? false
              : d.is_verified ?? d.verified_partner ?? false,
          joined_year: d.joined_year || 2024,
          address: d.address,
          phone: d.phone,
          email: d.email,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return [...this.cache];
    }

    if (!allowSeed) {
      this.cache = [];
      return [];
    }

    await this.seedInitialDealer();
    return this.getDealers(false);
  }

  public getDealersSync(): DealerFullRecord[] {
    return [...this.cache];
  }

  /**
   * Authoritative Admin Dealer Directory:
   * Combines all public.dealers rows AND registered dealer_accounts (portal signups).
   * Uses admin_list_dealer_accounts() RPC first, with resilient direct-query fallback
   * to Supabase public.dealers so the admin list always populates promptly.
   */
  public async getAllDealerAccountsForAdmin(): Promise<AdminDealerDirectoryResult> {
    if (!checkIsSupabaseConfigured()) {
      return { accounts: [], migrationRequired: false, error: 'Supabase is not configured.' };
    }

    try {
      const rpcRes = await withTimeout<{ data: any; error: any }>(
        supabase.rpc('admin_list_dealer_accounts') as any,
        7000,
        { data: null, error: { code: 'TIMEOUT', message: 'RPC timed out; falling back to dealers table' } }
      );
      const { data, error } = rpcRes;

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped: AdminDealerAccountRecord[] = data.map((row: any) => {
          const resolved = resolveDealerApprovalState(
            row.accountStatus,
            row.isVerified,
            row.dealerStatus
          );
          return {
            dealerId: String(row.dealerId || ''),
            dealerAccountId: row.dealerAccountId ? String(row.dealerAccountId) : null,
            userId: row.userId ? String(row.userId) : null,
            hasPortalAccount: Boolean(row.hasPortalAccount),
            businessName: row.businessName || 'Unnamed Dealership',
            tradingName: row.tradingName || null,
            contactName: row.contactName || null,
            email: row.email || null,
            phone: row.phone || null,
            city: row.city || 'Lagos',
            state: row.state || 'Lagos',
            country: row.country || 'Nigeria',
            addressLine1: row.addressLine1 || null,
            addressLine2: row.addressLine2 || null,
            businessType: row.businessType || null,
            businessDescription: row.businessDescription || null,
            website: row.website || null,
            cacRegistrationNumber: row.cacRegistrationNumber || null,
            accountStatus: resolved.accountStatus,
            dealerStatus: (row.dealerStatus as DealerTableStatus) || resolved.dealerStatus,
            onboardingStatus: row.onboardingStatus || 'completed',
            isVerified: Boolean(row.isVerified),
            approvalStatus: row.approvalStatus || resolved.approvalStatus,
            canListCars: typeof row.canListCars === 'boolean' ? row.canListCars : resolved.isApproved,
            approvalNotes: row.approvalNotes || null,
            approvedAt: row.approvedAt || null,
            disapprovedAt: row.disapprovedAt || null,
            joinedYear: Number(row.joinedYear) || new Date().getFullYear(),
            createdAt: row.createdAt || new Date().toISOString(),
            totalVehicles: Number(row.totalVehicles) || 0,
            publishedVehicles: Number(row.publishedVehicles) || 0,
            inReviewVehicles: Number(row.inReviewVehicles) || 0,
          };
        });
        return { accounts: mapped, migrationRequired: false };
      }

      if (error && !isMissingRpcError(error) && error.code !== 'TIMEOUT') {
        console.warn('admin_list_dealer_accounts notice:', error.message);
      }

      // Direct Supabase fallback: always load public.dealers directly, and enrich with auxiliary tables
      const migrationRequired = isMissingRpcError(error);
      const [dealersSettled, accountsSettled, profilesSettled, addressesSettled, carsSettled] =
        await Promise.allSettled([
          withTimeout(supabase.from('dealers').select('*') as any, 8000, {
            data: null,
            error: { message: 'Timed out reading public.dealers' },
          }),
          withTimeout(supabase.from('dealer_accounts').select('*') as any, 6000, { data: [], error: null }),
          withTimeout(supabase.from('dealer_business_profiles').select('*') as any, 6000, {
            data: [],
            error: null,
          }),
          withTimeout(supabase.from('dealer_addresses').select('*') as any, 6000, { data: [], error: null }),
          withTimeout(supabase.from('cars').select('id, dealer_id, status') as any, 6000, {
            data: [],
            error: null,
          }),
        ]);

      const dealersRes: any =
        dealersSettled.status === 'fulfilled'
          ? dealersSettled.value
          : { data: null, error: { message: 'Failed to query dealers table' } };
      const accountsRes: any =
        accountsSettled.status === 'fulfilled' ? accountsSettled.value : { data: [] };
      const profilesRes: any =
        profilesSettled.status === 'fulfilled' ? profilesSettled.value : { data: [] };
      const addressesRes: any =
        addressesSettled.status === 'fulfilled' ? addressesSettled.value : { data: [] };
      const carsRes: any =
        carsSettled.status === 'fulfilled' ? carsSettled.value : { data: [] };

      const dealerRows = Array.isArray(dealersRes?.data) ? dealersRes.data : [];
      const accountRows = Array.isArray(accountsRes?.data) ? accountsRes.data : [];
      const profileRows = Array.isArray(profilesRes?.data) ? profilesRes.data : [];
      const addressRows = Array.isArray(addressesRes?.data) ? addressesRes.data : [];
      const carRows = Array.isArray(carsRes?.data) ? carsRes.data : [];

      const merged = buildDealerDirectoryFromTables({
        dealerRows,
        accountRows,
        profileRows,
        addressRows,
        carRows,
      });

      const resolvedError =
        merged.length === 0 && dealersRes?.error?.message
          ? dealersRes.error.message
          : error && !migrationRequired && error.code !== 'TIMEOUT' && merged.length === 0
          ? error.message
          : undefined;

      return {
        accounts: merged,
        migrationRequired,
        error: resolvedError,
      };
    } catch (err: any) {
      return {
        accounts: [],
        migrationRequired: false,
        error: err?.message || 'Unable to load dealer accounts.',
      };
    }
  }

  /**
   * Approves, disapproves, sets pending, or suspends a dealer account.
   * Approval ONLY affects car listing ability — pending/disapproved dealers retain dashboard access.
   */
  public async setDealerApprovalStatus(
    dealerId: string,
    action: AdminDealerApprovalAction,
    reason?: string
  ): Promise<{ success: boolean; error?: string; migrationRequired?: boolean }> {
    if (!checkIsSupabaseConfigured()) {
      return { success: false, error: 'Supabase is not configured.' };
    }
    if (!dealerId) {
      return { success: false, error: 'Dealer ID is required.' };
    }

    const { data, error } = await supabase.rpc('admin_set_dealer_approval_status', {
      p_dealer_id: dealerId,
      p_action: action,
      p_reason: reason?.trim() || null,
    });

    if (!error) {
      await this.getDealers(false).catch(() => undefined);
      return { success: true };
    }

    if (!isMissingRpcError(error)) {
      console.warn('admin_set_dealer_approval_status notice, trying direct update:', error.message);
    }

    // Fallback direct update to public.dealers (+ best-effort public.dealer_accounts sync)
    const nextAccountStatus: DealerRawAccountStatus =
      action === 'approve'
        ? 'active'
        : action === 'disapprove'
        ? 'rejected'
        : action === 'suspend'
        ? 'suspended'
        : 'pending';
    const nextDealerStatus: DealerTableStatus =
      action === 'approve' ? 'approved' : action === 'pending' ? 'pending' : 'disapproved';
    const nextIsVerified = action === 'approve';

    let { error: dealerErr } = await supabase
      .from('dealers')
      .update({ is_verified: nextIsVerified, dealer_status: nextDealerStatus })
      .eq('id', dealerId);

    // Retry cleanly if either dealer_status or is_verified is missing on un-migrated tables
    if (dealerErr && dealerErr.code === '42703') {
      const msg = String(dealerErr.message || '').toLowerCase();
      if (msg.includes('is_verified')) {
        const retryStatusOnly = await supabase
          .from('dealers')
          .update({ dealer_status: nextDealerStatus })
          .eq('id', dealerId);
        dealerErr = retryStatusOnly.error;
      } else {
        const retryVerifiedOnly = await supabase
          .from('dealers')
          .update({ is_verified: nextIsVerified })
          .eq('id', dealerId);
        dealerErr = retryVerifiedOnly.error;
      }
    }

    const { error: accErr } = await supabase
      .from('dealer_accounts')
      .update({ account_status: nextAccountStatus })
      .eq('dealer_id', dealerId);

    if (dealerErr && accErr) {
      return {
        success: false,
        migrationRequired: true,
        error:
          dealerErr.message ||
          'Dealer approval RPCs are not installed yet. Run src/db/dealer-approval-migration.sql in Supabase SQL Editor.',
      };
    }

    if (dealerErr) {
      return {
        success: false,
        migrationRequired: isMissingRpcError(error),
        error: dealerErr.message,
      };
    }

    await this.getDealers(false).catch(() => undefined);
    return { success: true, data } as any;
  }

  /**
   * Convenience toggle used by AdminDealerManagement table rows.
   */
  public async toggleDealerVerification(
    dealerId: string,
    currentlyApproved: boolean,
    reason?: string
  ): Promise<{ success: boolean; error?: string; migrationRequired?: boolean }> {
    return this.setDealerApprovalStatus(
      dealerId,
      currentlyApproved ? 'disapprove' : 'approve',
      reason
    );
  }

  public async createDealer(dealer: Partial<DealerFullRecord>): Promise<DealerFullRecord> {
    const cleanName = (dealer.name || '').trim();
    if (!cleanName) {
      throw new Error('Dealership name is required.');
    }

    // Try authoritative RPC first (safe for both UUID/TEXT and name/business_name schemas)
    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_create_partner_dealer', {
      p_name: cleanName,
      p_city: dealer.city || 'Lekki',
      p_state: dealer.state || 'Lagos',
      p_phone: dealer.phone || '',
      p_email: dealer.email || '',
      p_address: dealer.address || '',
      p_is_verified: dealer.verified_partner ?? true,
    });

    if (!rpcErr && rpcData) {
      await this.getDealers().catch(() => undefined);
      return {
        id: String((rpcData as any).id),
        name: (rpcData as any).name || cleanName,
        city: (rpcData as any).city || dealer.city || 'Lekki',
        state: (rpcData as any).state || dealer.state || 'Lagos',
        verified_partner: Boolean((rpcData as any).verified_partner ?? true),
        joined_year: Number((rpcData as any).joined_year) || new Date().getFullYear(),
        address: dealer.address,
        phone: dealer.phone,
        email: dealer.email,
      };
    }

    // Fallback direct insert using a valid UUID (compatible with both UUID & TEXT id columns)
    const id =
      dealer.id ||
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `00000000-0000-4000-8000-${Date.now().toString().padStart(12, '0').slice(-12)}`);
    const slug = `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;

    // Try business_name schema first, then fallback to name schema
    let { error } = await supabase.from('dealers').insert({
      id,
      business_name: cleanName,
      slug,
      city: dealer.city || 'Lekki',
      state: dealer.state || 'Lagos',
      address: dealer.address || '',
      phone: dealer.phone || '',
      email: dealer.email || '',
      is_verified: dealer.verified_partner ?? true,
      joined_year: dealer.joined_year || new Date().getFullYear(),
    });

    if (error && (error.code === '42703' || error.message.includes('business_name'))) {
      const retry = await supabase.from('dealers').insert({
        id,
        name: cleanName,
        slug,
        city: dealer.city || 'Lekki',
        state: dealer.state || 'Lagos',
        address: dealer.address || '',
        phone: dealer.phone || '',
        email: dealer.email || '',
        is_verified: dealer.verified_partner ?? true,
        joined_year: dealer.joined_year || new Date().getFullYear(),
      });
      error = retry.error;
    }

    if (error) {
      throw new Error(`Failed to create dealer in Supabase: ${error.message}`);
    }

    await this.getDealers();
    return (
      this.cache.find((d) => d.id === id) || {
        id,
        name: cleanName,
        city: dealer.city || 'Lekki',
        state: dealer.state || 'Lagos',
        verified_partner: dealer.verified_partner ?? true,
        joined_year: dealer.joined_year || new Date().getFullYear(),
        address: dealer.address,
        phone: dealer.phone,
        email: dealer.email,
      }
    );
  }

  private async seedInitialDealer(): Promise<void> {
    try {
      await supabase.from('dealers').upsert(
        [
          {
            id: '11111111-1111-4111-8111-111111111101',
            name: 'Prestige Motors Lekki',
            slug: 'prestige-motors-lekki',
            city: 'Lekki',
            state: 'Lagos',
            phone: '+234 803 000 1122',
            email: 'partners@prestigemotors.ng',
            is_verified: true,
            joined_year: 2023,
          },
          {
            id: '11111111-1111-4111-8111-111111111102',
            name: 'Apex Luxury Victoria Island',
            slug: 'apex-luxury-vi',
            city: 'Victoria Island',
            state: 'Lagos',
            phone: '+234 809 111 2233',
            email: 'inventory@apexluxury.ng',
            is_verified: true,
            joined_year: 2024,
          },
        ],
        { onConflict: 'id' }
      );
    } catch {
      // ignore
    }
  }
}

export const dealerService = new DealerService();
