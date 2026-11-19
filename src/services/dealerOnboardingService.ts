import { supabase } from '../lib/supabase';

export interface DealerOnboardingPayload {
  business_name: string;
  contact_name: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  cac_registration_number?: string | null;
  business_type?: string | null;
  business_description?: string | null;
  website?: string | null;
  minimum_inventory_confirmed: boolean;
}

export type DealerRawAccountStatus = 'pending' | 'active' | 'suspended' | 'rejected';
export type DealerApprovalState = 'pending' | 'approved' | 'disapproved' | 'suspended';
export type DealerTableStatus = 'pending' | 'approved' | 'disapproved';

export interface DealerAccountStatus {
  hasAccount: boolean;
  dealerId?: string;
  accountStatus?: DealerRawAccountStatus;
  dealerStatus?: DealerTableStatus;
  approvalStatus?: DealerApprovalState;
  isVerified?: boolean;
  isApproved?: boolean;
  approvalNotes?: string | null;
  onboardingStatus?: string;
  businessName?: string;
}

/**
 * Pure resolver separating dashboard access from vehicle-listing approval.
 * Only Admin-approved ('approved' / 'active' AND verified) dealers may list cars.
 * 'pending' and 'disapproved'/'rejected' dealers retain full dashboard access.
 */
export function resolveDealerApprovalState(
  rawStatus: unknown,
  isVerified?: boolean | null,
  dealerStatus?: unknown
): {
  accountStatus: DealerRawAccountStatus;
  dealerStatus: DealerTableStatus;
  approvalStatus: DealerApprovalState;
  isApproved: boolean;
} {
  const normalizedAcc = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : '';
  const normalizedDealer = typeof dealerStatus === 'string' ? dealerStatus.trim().toLowerCase() : '';

  if (normalizedAcc === 'suspended') {
    return {
      accountStatus: 'suspended',
      dealerStatus: 'disapproved',
      approvalStatus: 'suspended',
      isApproved: false,
    };
  }

  // If explicit dealers.dealer_status column is present, enforce it strictly for car listing
  if (normalizedDealer === 'disapproved' || normalizedDealer === 'rejected') {
    return {
      accountStatus: normalizedAcc === 'active' ? 'active' : 'rejected',
      dealerStatus: 'disapproved',
      approvalStatus: 'disapproved',
      isApproved: false,
    };
  }

  if (normalizedDealer === 'pending') {
    return {
      accountStatus: normalizedAcc === 'active' ? 'active' : 'pending',
      dealerStatus: 'pending',
      approvalStatus: 'pending',
      isApproved: false,
    };
  }

  if (normalizedDealer === 'approved') {
    if (normalizedAcc === 'rejected') {
      return {
        accountStatus: 'rejected',
        dealerStatus: 'disapproved',
        approvalStatus: 'disapproved',
        isApproved: false,
      };
    }
    if (isVerified === false) {
      return {
        accountStatus: normalizedAcc === 'active' ? 'active' : 'pending',
        dealerStatus: 'disapproved',
        approvalStatus: 'disapproved',
        isApproved: false,
      };
    }
    return {
      accountStatus: 'active',
      dealerStatus: 'approved',
      approvalStatus: 'approved',
      isApproved: true,
    };
  }

  // Fallback when dealer_status column is absent (e.g. legacy DB before migration runs)
  if (normalizedAcc === 'rejected' || normalizedAcc === 'disapproved') {
    return {
      accountStatus: 'rejected',
      dealerStatus: 'disapproved',
      approvalStatus: 'disapproved',
      isApproved: false,
    };
  }
  if (normalizedAcc === 'active' || normalizedAcc === 'approved') {
    if (isVerified === false) {
      return {
        accountStatus: 'active',
        dealerStatus: 'disapproved',
        approvalStatus: 'disapproved',
        isApproved: false,
      };
    }
    return {
      accountStatus: 'active',
      dealerStatus: 'approved',
      approvalStatus: 'approved',
      isApproved: true,
    };
  }

  return {
    accountStatus: 'pending',
    dealerStatus: 'pending',
    approvalStatus: 'pending',
    isApproved: false,
  };
}

class DealerOnboardingService {
  private cachedStatus: DealerAccountStatus | null = null;

  /**
   * Executes the authoritative PostgreSQL SECURITY DEFINER RPC
   * auth.uid() is resolved internally by Supabase - client NEVER passes user_id
   */
  public async submitOnboarding(payload: DealerOnboardingPayload): Promise<{ data: any; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc('create_dealer_onboarding', {
        p_business_name: payload.business_name.trim(),
        p_contact_name: payload.contact_name.trim(),
        p_phone: payload.phone.trim(),
        p_address_line_1: payload.address_line_1.trim(),
        p_address_line_2: payload.address_line_2?.trim() || null,
        p_city: payload.city?.trim() || 'Lagos',
        p_state: payload.state?.trim() || 'Lagos',
        p_country: payload.country?.trim() || 'Nigeria',
        p_cac_registration_number: payload.cac_registration_number?.trim() || null,
        p_business_type: payload.business_type?.trim() || null,
        p_business_description: payload.business_description?.trim() || null,
        p_website: payload.website?.trim() || null,
        p_minimum_inventory_confirmed: Boolean(payload.minimum_inventory_confirmed),
      });

      if (error) {
        console.error('MANIFOLD Dealer Onboarding RPC Error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });

        // Safe human-readable error messages for UI
        const errMsg = error.message.toLowerCase();
        if (errMsg.includes('minimum inventory') || errMsg.includes('5 vehicles')) {
          return { data: null, error: 'Your dealership must confirm at least 5 available vehicles for listing on MANIFOLD.' };
        }
        if (errMsg.includes('already exists') || errMsg.includes('already registered')) {
          return { data: null, error: 'A dealer account or application is already associated with this user.' };
        }
        if (errMsg.includes('authenticated') || errMsg.includes('permission denied') || error.code === '42501') {
          return { data: null, error: 'Your session has expired. Please sign in again to complete registration.' };
        }
        if (errMsg.includes('required') || errMsg.includes('null value')) {
          return { data: null, error: 'Please fill in all required dealership information.' };
        }

        return { data: null, error: 'Unable to submit dealer onboarding right now. Please verify your details and try again.' };
      }

      // Resolve returned dealer ID & actual initial status (new dealers start in 'pending' until Admin approves)
      let resolvedDealerId: string | undefined = undefined;
      let returnedStatus: unknown = 'pending';
      let returnedDealerStatus: unknown = 'pending';
      let returnedVerified: boolean | null = false;

      if (typeof data === 'string' && data.length > 5) {
        resolvedDealerId = data;
      } else if (data && typeof data === 'object') {
        resolvedDealerId = (data as any).dealer_id || (data as any).id;
        if ((data as any).account_status) returnedStatus = (data as any).account_status;
        if ((data as any).dealer_status) returnedDealerStatus = (data as any).dealer_status;
        if (typeof (data as any).is_verified === 'boolean') returnedVerified = (data as any).is_verified;
      }

      const resolved = resolveDealerApprovalState(returnedStatus, returnedVerified, returnedDealerStatus);

      this.cachedStatus = {
        hasAccount: true,
        dealerId: resolvedDealerId,
        accountStatus: resolved.accountStatus,
        dealerStatus: resolved.dealerStatus,
        approvalStatus: resolved.approvalStatus,
        isVerified: Boolean(returnedVerified),
        isApproved: resolved.isApproved,
        approvalNotes: null,
        onboardingStatus: 'completed',
        businessName: payload.business_name.trim(),
      };

      return { data, error: null };
    } catch (err: any) {
      console.error('MANIFOLD Dealer Onboarding Unexpected Exception:', err);
      return { data: null, error: 'An unexpected network error occurred. Please try again.' };
    }
  }

  /**
   * Retrieves the current authenticated user's dealer account status from the database.
   * Authoritative source of truth is dealer_accounts + dealers.is_verified.
   */
  public async getDealerAccountStatus(): Promise<DealerAccountStatus> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        this.cachedStatus = null;
        return { hasAccount: false };
      }

      // Query dealer_accounts with * so optional approval columns never break older schemas
      const { data, error } = await supabase
        .from('dealer_accounts')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) {
        console.warn('Could not query dealer_accounts for user:', error.message);
      }

      if (!data || !data.dealer_id) {
        if (this.cachedStatus?.hasAccount) {
          return this.cachedStatus;
        }
        return { hasAccount: false };
      }

      // Safely look up dealer name, verification flag, and dealer_status
      let businessName = this.cachedStatus?.businessName || 'Your Dealership';
      let isVerified: boolean | null = null;
      let dealerStatusCol: unknown = undefined;
      try {
        const { data: dealerRow } = await supabase
          .from('dealers')
          .select('*')
          .eq('id', data.dealer_id)
          .maybeSingle();
        if (dealerRow) {
          businessName = dealerRow.business_name || dealerRow.name || businessName;
          if (typeof dealerRow.is_verified === 'boolean') {
            isVerified = dealerRow.is_verified;
          } else if (typeof (dealerRow as any).verified_partner === 'boolean') {
            isVerified = (dealerRow as any).verified_partner;
          }
          if (dealerRow.dealer_status !== undefined && dealerRow.dealer_status !== null) {
            dealerStatusCol = dealerRow.dealer_status;
          }
        }
      } catch {
        // Fallback to default name if table read fails
      }

      const resolved = resolveDealerApprovalState(data.account_status, isVerified, dealerStatusCol);

      const resolvedStatus: DealerAccountStatus = {
        hasAccount: true,
        dealerId: data.dealer_id,
        accountStatus: resolved.accountStatus,
        dealerStatus: resolved.dealerStatus,
        approvalStatus: resolved.approvalStatus,
        isVerified: isVerified ?? resolved.isApproved,
        isApproved: resolved.isApproved,
        approvalNotes: data.approval_notes || null,
        onboardingStatus: data.onboarding_status || 'completed',
        businessName,
      };

      this.cachedStatus = resolvedStatus;
      return resolvedStatus;
    } catch (err) {
      console.warn('Could not check dealer status:', err);
      if (this.cachedStatus?.hasAccount) {
        return this.cachedStatus;
      }
      return { hasAccount: false };
    }
  }

  public clearCache(): void {
    this.cachedStatus = null;
  }
}

export const dealerOnboardingService = new DealerOnboardingService();
