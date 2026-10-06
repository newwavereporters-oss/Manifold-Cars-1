import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CarHuntRequestRecord {
  id: string;
  customer_name: string;
  phone: string;
  email?: string | null;
  budget_max?: number | null;
  preferred_brand_id?: string | null;
  preferred_model_id?: string | null;
  body_type_id?: string | null;
  year_min?: number | null;
  year_max?: number | null;
  location?: string | null;
  requirements?: string | null;
  trim?: string | null;
  preferred_condition?: string | null;
  buying_timeframe?: string | null;
  assigned_to?: string | null;
  status: string;
  created_at: string;
  // Resolved display metadata
  brand_name?: string;
  model_name?: string;
  body_type_name?: string;
}

export interface CreateCarHuntPayload {
  customer_name: string;
  email?: string | null;
  phone: string;
  budget_max?: number | null;
  preferred_brand_id?: string | null;
  preferred_model_id?: string | null;
  body_type_id?: string | null;
  year_min?: number | null;
  location?: string | null;
  requirements?: string | null;
  trim?: string | null;
  preferred_condition?: string | null;
  buying_timeframe?: string | null;
  status: 'new';
  assigned_to?: null;
}

class CarHuntService {
  public async submitRequest(payload: CreateCarHuntPayload): Promise<{ data: any; error: any }> {
    try {
      const { error } = await supabase
        .from('car_hunt_requests')
        .insert({
          customer_name: payload.customer_name,
          email: payload.email,
          phone: payload.phone,
          budget_max: payload.budget_max,
          preferred_brand_id: payload.preferred_brand_id,
          preferred_model_id: payload.preferred_model_id,
          body_type_id: payload.body_type_id,
          year_min: payload.year_min,
          location: payload.location,
          requirements: payload.requirements,
          trim: payload.trim,
          preferred_condition: payload.preferred_condition,
          buying_timeframe: payload.buying_timeframe,
          status: 'new',
          assigned_to: null,
        });

      if (error) {
        console.error('MANIFOLD CAR HUNT ERROR', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        return { data: null, error };
      }

      return { data: { success: true }, error: null };
    } catch (err: any) {
      console.error('MANIFOLD Car Hunt Unexpected Error:', err);
      return { data: null, error: err };
    }
  }

  public async getRequests(): Promise<CarHuntRequestRecord[]> {
    if (!isSupabaseConfigured) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('car_hunt_requests')
        .select(`
          *,
          car_brands:preferred_brand_id(name),
          car_models:preferred_model_id(name),
          car_types:body_type_id(name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback without joins if foreign keys differ
        const fallback = await supabase
          .from('car_hunt_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (fallback.error) {
          throw new Error(`Failed to load Car Hunt requests: ${fallback.error.message}`);
        }

        return (fallback.data || []).map((row: any) => ({
          ...row,
          brand_name: row.preferred_brand_id,
          model_name: row.preferred_model_id,
          body_type_name: row.body_type_id,
        }));
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        customer_name: row.customer_name || row.full_name || 'Anonymous',
        phone: row.phone,
        email: row.email,
        budget_max: row.budget_max ? Number(row.budget_max) : null,
        preferred_brand_id: row.preferred_brand_id,
        preferred_model_id: row.preferred_model_id,
        body_type_id: row.body_type_id,
        year_min: row.year_min,
        year_max: row.year_max,
        location: row.location,
        requirements: row.requirements || row.notes,
        trim: row.trim,
        preferred_condition: row.preferred_condition,
        buying_timeframe: row.buying_timeframe,
        assigned_to: row.assigned_to,
        status: row.status || 'new',
        created_at: row.created_at || new Date().toISOString(),
        brand_name: row.car_brands?.name || null,
        model_name: row.car_models?.name || null,
        body_type_name: row.car_types?.name || null,
      }));
    } catch (e: any) {
      console.warn('Could not fetch car hunt requests:', e.message);
      return [];
    }
  }

  public async updateRequestStatus(id: string, status: string): Promise<void> {
    if (!isSupabaseConfigured) return;

    const { error } = await supabase
      .from('car_hunt_requests')
      .update({ status })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update request status: ${error.message}`);
    }
  }
}

export const carHuntService = new CarHuntService();
