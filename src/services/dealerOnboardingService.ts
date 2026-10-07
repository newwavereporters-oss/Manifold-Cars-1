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

export interface DealerAccountStatus {
  hasAccount: boolean;
  dealerId?: string;
  accountStatus?: 'pending' | 'active' | 'suspended' | 'rejected';
  onboardingStatus?: string;
  businessName?: string;
}

class DealerOnboardingService {
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

      return { data, error: null };
    } catch (err: any) {
      console.error('MANIFOLD Dealer Onboarding Unexpected Exception:', err);
      return { data: null, error: 'An unexpected network error occurred. Please try again.' };
    }
  }

  /**
   * Retrieves the current authenticated user's dealer account status from the database
   * Authoritative source of truth is dealer_accounts matching session.user.id
   */
  public async getDealerAccountStatus(): Promise<DealerAccountStatus> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        return { hasAccount: false };
      }

      // Query dealer_accounts directly without embedded relations that might fail in PostgREST
      const { data, error } = await supabase
        .from('dealer_accounts')
        .select('dealer_id, account_status, onboarding_status')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) {
        console.warn('Could not query dealer_accounts for user:', error.message);
      }

      if (!data || !data.dealer_id) {
        return { hasAccount: false };
      }

      const rawStatus = data.account_status;
      // In the MANIFOLD active model, registered dealers receive immediate active access (never blocked in pending)
      const accountStatus = (rawStatus === 'suspended' || rawStatus === 'rejected') ? rawStatus : 'active';

      // Safely look up dealer name
      let businessName = 'Your Dealership';
      try {
        const { data: dealerRow } = await supabase
          .from('dealers')
          .select('name')
          .eq('id', data.dealer_id)
          .maybeSingle();
        if (dealerRow?.name) {
          businessName = dealerRow.name;
        }
      } catch {
        // Fallback to default name if table read fails
      }

      return {
        hasAccount: true,
        dealerId: data.dealer_id,
        accountStatus,
        onboardingStatus: data.onboarding_status || 'completed',
        businessName,
      };
    } catch (err) {
      console.warn('Could not check dealer status:', err);
      return { hasAccount: false };
    }
  }
}

export const dealerOnboardingService = new DealerOnboardingService();
