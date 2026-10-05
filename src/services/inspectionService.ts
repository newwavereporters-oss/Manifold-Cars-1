import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface InspectionRecord {
  id: string;
  car_id: string;
  car_title?: string;
  inspector_name: string;
  inspection_date: string;
  overall_score: number;
  engine_score: number;
  transmission_score: number;
  electrical_score: number;
  body_frame_score: number;
  notes?: string;
  created_at: string;
}

export interface VerificationRecord {
  id: string;
  car_id: string;
  car_title?: string;
  is_verified: boolean;
  dealer_verified: boolean;
  vehicle_physically_seen: boolean;
  video_reviewed: boolean;
  price_confirmed: boolean;
  vin_checked: boolean;
  inspection_score: number;
  verified_date: string;
  verified_by: string;
  created_at: string;
}

class InspectionService {
  public async getInspections(): Promise<InspectionRecord[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('vehicle_inspections')
      .select('*, cars (title)')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load inspections from Supabase: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      car_id: row.car_id,
      car_title: row.cars?.title || 'Inspected Vehicle',
      inspector_name: row.inspector_name || 'MANIFOLD Field Specialist',
      inspection_date: row.inspection_date || new Date().toISOString(),
      overall_score: Number(row.overall_score) || 95,
      engine_score: Number(row.engine_score) || 95,
      transmission_score: Number(row.transmission_score) || 95,
      electrical_score: Number(row.electrical_score) || 95,
      body_frame_score: Number(row.body_frame_score) || 95,
      notes: row.notes || '',
      created_at: row.created_at || new Date().toISOString(),
    }));
  }

  public async createInspection(inspection: Partial<InspectionRecord>): Promise<InspectionRecord> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const id = inspection.id || `insp-${Date.now()}`;
    const insertRow = {
      id,
      car_id: inspection.car_id,
      inspector_name: inspection.inspector_name || 'MANIFOLD Field Specialist',
      inspection_date: inspection.inspection_date || new Date().toISOString(),
      overall_score: inspection.overall_score ?? 95,
      engine_score: inspection.engine_score ?? 95,
      transmission_score: inspection.transmission_score ?? 95,
      electrical_score: inspection.electrical_score ?? 95,
      body_frame_score: inspection.body_frame_score ?? 95,
      notes: inspection.notes || '',
    };

    const { error } = await supabase.from('vehicle_inspections').insert(insertRow);
    if (error) {
      throw new Error(`Failed to create inspection in Supabase: ${error.message}`);
    }

    // Also update car's inspection_score and verification status
    if (inspection.car_id) {
      await supabase
        .from('cars')
        .update({
          is_verified: true,
          inspection_score: inspection.overall_score ?? 95,
        })
        .eq('id', inspection.car_id);
    }

    return {
      ...insertRow,
      created_at: new Date().toISOString(),
    } as InspectionRecord;
  }

  public async deleteInspection(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase.from('vehicle_inspections').delete().eq('id', id);
    if (error) {
      throw new Error(`Failed to delete inspection from Supabase: ${error.message}`);
    }
  }
}

export const inspectionService = new InspectionService();
