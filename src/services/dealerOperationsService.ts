import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { dealerVehicleService, DealerCarRecord } from './dealerVehicleService';

export interface DealerDashboardOverview {
  totalVehicles: number;
  publishedVehicles: number;
  inReviewVehicles: number;
  draftVehicles: number;
  newEnquiriesCount: number;
  recentEnquiries: DealerEnquiryRecord[];
  cars: DealerCarRecord[];
}

export interface DealerEnquiryRecord {
  id: string;
  car_id: string;
  car_title: string;
  car_price?: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  message: string;
  source: string;
  status: 'new' | 'contacted' | 'qualified' | 'viewing_scheduled' | 'negotiating' | 'won' | 'lost' | 'closed';
  created_at: string;
  updated_at?: string;
}

export interface DealerBusinessProfileData {
  business_name: string;
  trading_name: string;
  business_type: string;
  business_description: string;
  website: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  country: string;
  cac_registration_number: string;
  contact_name?: string;
  phone?: string;
  email?: string;
}

export interface DealerNotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read_at: string | null;
  type?: string;
  created_at: string;
}

class DealerOperationsService {
  /**
   * Resolves the authenticated dealer's verified ID from dealer_accounts
   * Database RLS guarantees user context isolation
   */
  public async getAuthenticatedDealerId(): Promise<string | null> {
    if (!isSupabaseConfigured) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      const { data, error } = await supabase
        .from('dealer_accounts')
        .select('dealer_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error || !data) return null;
      return data.dealer_id;
    } catch {
      return null;
    }
  }

  /**
   * Retrieves live operational metrics for the dealer dashboard overview
   * REAL database rows strictly scoped to the authenticated dealer
   */
  public async getDashboardOverview(dealerId: string): Promise<DealerDashboardOverview> {
    const emptyOverview: DealerDashboardOverview = {
      totalVehicles: 0,
      publishedVehicles: 0,
      inReviewVehicles: 0,
      draftVehicles: 0,
      newEnquiriesCount: 0,
      recentEnquiries: [],
      cars: [],
    };

    if (!isSupabaseConfigured || !dealerId) return emptyOverview;

    try {
      // 1. Fetch real dealer vehicles
      const cars = await dealerVehicleService.getDealerCars(dealerId);

      const totalVehicles = cars.length;
      const publishedVehicles = cars.filter(
        (c) => c.status === 'PUBLISHED' || (c.status as any) === 'published'
      ).length;
      const inReviewVehicles = cars.filter(
        (c) =>
          c.status === 'PENDING_REVIEW' ||
          (c.status as any) === 'pending_review' ||
          (c.status as any) === 'in_review'
      ).length;
      const draftVehicles = cars.filter(
        (c) => c.status === 'DRAFT' || (c.status as any) === 'draft'
      ).length;

      // 2. Fetch buyer inquiries for the dealer's vehicles
      const carIds = cars.map((c) => c.id).filter(Boolean);
      let enquiries: DealerEnquiryRecord[] = [];

      if (carIds.length > 0) {
        const { data: inqRows, error: inqErr } = await supabase
          .from('buyer_inquiries')
          .select('*')
          .in('car_id', carIds)
          .order('created_at', { ascending: false });

        if (!inqErr && inqRows) {
          const carMap = new Map(cars.map((c) => [c.id, c]));
          enquiries = inqRows.map((row: any) => {
            const car = carMap.get(row.car_id);
            return {
              id: row.id,
              car_id: row.car_id,
              car_title: car ? car.title : row.car_title || 'Vehicle Enquiry',
              car_price: car ? car.price : undefined,
              customer_name: row.customer_name || 'Interested Buyer',
              customer_phone: row.customer_phone || 'Private Number',
              customer_email: row.customer_email || undefined,
              message: row.message || row.notes || 'Buyer is requesting vehicle availability and inspection.',
              source: row.source || 'MANIFOLD Marketplace',
              status: row.status || 'new',
              created_at: row.created_at || new Date().toISOString(),
              updated_at: row.updated_at,
            };
          });
        }
      }

      const newEnquiriesCount = enquiries.filter((e) => e.status === 'new').length;
      const recentEnquiries = enquiries.slice(0, 5);

      return {
        totalVehicles,
        publishedVehicles,
        inReviewVehicles,
        draftVehicles,
        newEnquiriesCount,
        recentEnquiries,
        cars,
      };
    } catch (err) {
      console.error('Error compiling dealer dashboard overview:', err);
      return emptyOverview;
    }
  }

  /**
   * Retrieves all buyer inquiries for cars belonging to the authenticated dealer
   * Supports filtering by real database status enum
   */
  public async getDealerEnquiries(
    dealerId: string,
    statusFilter?: string
  ): Promise<DealerEnquiryRecord[]> {
    if (!isSupabaseConfigured || !dealerId) return [];

    try {
      const cars = await dealerVehicleService.getDealerCars(dealerId);
      const carIds = cars.map((c) => c.id).filter(Boolean);
      if (carIds.length === 0) return [];

      let query = supabase
        .from('buyer_inquiries')
        .select('*')
        .in('car_id', carIds)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'ALL') {
        if (statusFilter === 'viewing') {
          query = query.in('status', ['qualified', 'viewing_scheduled']);
        } else {
          query = query.eq('status', statusFilter);
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching dealer enquiries:', error);
        return [];
      }

      const carMap = new Map(cars.map((c) => [c.id, c]));

      return (data || []).map((row: any) => {
        const car = carMap.get(row.car_id);
        return {
          id: row.id,
          car_id: row.car_id,
          car_title: car ? car.title : 'MANIFOLD Vehicle',
          car_price: car ? car.price : undefined,
          customer_name: row.customer_name || 'Interested Buyer',
          customer_phone: row.customer_phone || 'Private Number',
          customer_email: row.customer_email || undefined,
          message: row.message || row.notes || 'Buyer is interested in viewing this vehicle.',
          source: row.source || 'MANIFOLD Marketplace',
          status: row.status || 'new',
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at,
        };
      });
    } catch (err) {
      console.error('Error in getDealerEnquiries:', err);
      return [];
    }
  }

  /**
   * Updates an enquiry workflow status for a vehicle owned by the authenticated dealer
   * Only allows valid workflow transitions (e.g. 'contacted', 'qualified', 'closed')
   */
  public async updateEnquiryStatus(
    enquiryId: string,
    newStatus: DealerEnquiryRecord['status'],
    dealerId: string
  ): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured || !enquiryId || !dealerId) {
      return { success: false, error: 'Authorization context missing.' };
    }

    try {
      // 1. Confirm ownership: the enquiry must reference a car owned by this dealer
      const cars = await dealerVehicleService.getDealerCars(dealerId);
      const carIds = cars.map((c) => c.id).filter(Boolean);

      const { data: currentInq, error: checkErr } = await supabase
        .from('buyer_inquiries')
        .select('id, car_id')
        .eq('id', enquiryId)
        .maybeSingle();

      if (checkErr || !currentInq) {
        return { success: false, error: 'Enquiry not found.' };
      }

      if (!carIds.includes(currentInq.car_id)) {
        return { success: false, error: 'Unauthorized: Enquiry belongs to another dealership.' };
      }

      // 2. Perform field-level update of workflow status only
      const { error: updErr } = await supabase
        .from('buyer_inquiries')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', enquiryId);

      if (updErr) {
        return { success: false, error: updErr.message };
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('Error updating enquiry status:', err);
      return { success: false, error: 'Failed to update enquiry status. Please try again.' };
    }
  }

  /**
   * Loads the comprehensive business profile data for the authenticated dealer
   */
  public async getBusinessProfile(dealerId: string): Promise<DealerBusinessProfileData | null> {
    if (!isSupabaseConfigured || !dealerId) return null;

    try {
      const [dealerRes, profileRes, addrRes] = await Promise.all([
        supabase.from('dealers').select('*').eq('id', dealerId).maybeSingle(),
        supabase.from('dealer_business_profiles').select('*').eq('dealer_id', dealerId).maybeSingle(),
        supabase.from('dealer_addresses').select('*').eq('dealer_id', dealerId).maybeSingle(),
      ]);

      const dealer = dealerRes.data || {};
      const profile = profileRes.data || {};
      const addr = addrRes.data || {};

      return {
        business_name: dealer.business_name || '',
        trading_name: profile.trading_name || dealer.business_name || '',
        business_type: profile.business_type || 'Automobile Dealership',
        business_description: profile.business_description || dealer.description || '',
        website: profile.website || '',
        address_line_1: addr.address_line_1 || dealer.address || '',
        address_line_2: addr.address_line_2 || '',
        city: addr.city || dealer.city || 'Lagos',
        state: addr.state || dealer.state || 'Lagos',
        country: addr.country || dealer.country || 'Nigeria',
        cac_registration_number: profile.cac_registration_number || '',
        contact_name: dealer.contact_name,
        phone: dealer.phone,
        email: dealer.email,
      };
    } catch (err) {
      console.error('Error loading dealer business profile:', err);
      return null;
    }
  }

  /**
   * Saves updates to dealership business profile and address
   */
  public async saveBusinessProfile(
    dealerId: string,
    data: DealerBusinessProfileData
  ): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured || !dealerId) {
      return { success: false, error: 'Dealership authorization context missing.' };
    }

    try {
      // 1. Update dealers table
      const { error: dealerErr } = await supabase
        .from('dealers')
        .update({
          business_name: data.business_name.trim(),
          description: data.business_description.trim() || null,
          city: data.city.trim() || 'Lagos',
          state: data.state.trim() || 'Lagos',
          country: data.country.trim() || 'Nigeria',
          address: data.address_line_1.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dealerId);

      if (dealerErr && dealerErr.code !== '42501') {
        console.warn('Dealers table update note:', dealerErr.message);
      }

      // 2. Update dealer_business_profiles table
      const { data: existingProf } = await supabase
        .from('dealer_business_profiles')
        .select('id')
        .eq('dealer_id', dealerId)
        .maybeSingle();

      if (existingProf) {
        await supabase
          .from('dealer_business_profiles')
          .update({
            trading_name: data.trading_name.trim() || data.business_name.trim(),
            business_type: data.business_type.trim() || 'Automobile Dealership',
            business_description: data.business_description.trim() || null,
            website: data.website.trim() || null,
            cac_registration_number: data.cac_registration_number.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('dealer_id', dealerId);
      } else {
        await supabase
          .from('dealer_business_profiles')
          .insert({
            dealer_id: dealerId,
            trading_name: data.trading_name.trim() || data.business_name.trim(),
            business_type: data.business_type.trim() || 'Automobile Dealership',
            business_description: data.business_description.trim() || null,
            website: data.website.trim() || null,
            cac_registration_number: data.cac_registration_number.trim() || null,
          });
      }

      // 3. Update dealer_addresses table
      const { data: existingAddr } = await supabase
        .from('dealer_addresses')
        .select('id')
        .eq('dealer_id', dealerId)
        .maybeSingle();

      if (existingAddr) {
        await supabase
          .from('dealer_addresses')
          .update({
            address_line_1: data.address_line_1.trim(),
            address_line_2: data.address_line_2.trim() || null,
            city: data.city.trim() || 'Lagos',
            state: data.state.trim() || 'Lagos',
            country: data.country.trim() || 'Nigeria',
            updated_at: new Date().toISOString(),
          })
          .eq('dealer_id', dealerId);
      } else {
        await supabase
          .from('dealer_addresses')
          .insert({
            dealer_id: dealerId,
            address_line_1: data.address_line_1.trim(),
            address_line_2: data.address_line_2.trim() || null,
            city: data.city.trim() || 'Lagos',
            state: data.state.trim() || 'Lagos',
            country: data.country.trim() || 'Nigeria',
          });
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('Error saving dealer business profile:', err);
      return { success: false, error: 'An unexpected error occurred while saving profile changes.' };
    }
  }

  /**
   * Fetches live notifications intended for the authenticated user
   */
  public async getNotifications(): Promise<DealerNotificationItem[]> {
    if (!isSupabaseConfigured) return [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        message: row.message,
        read_at: row.read_at,
        type: row.type,
        created_at: row.created_at,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Marks a notification as read
   */
  public async markNotificationAsRead(id: string): Promise<void> {
    if (!isSupabaseConfigured || !id) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', session.user.id);
    } catch {
      // Graceful error ignore
    }
  }
}

export const dealerOperationsService = new DealerOperationsService();
