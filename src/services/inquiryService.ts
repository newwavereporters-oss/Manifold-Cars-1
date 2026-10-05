import { BuyerInquiry } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type InquiryDetailedStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'viewing_scheduled'
  | 'negotiating'
  | 'won'
  | 'lost'
  | 'closed';

export interface InquiryRecord extends BuyerInquiry {
  id: string;
  status: any;
  created_at: string;
}

class InquiryService {
  public async getInquiries(): Promise<InquiryRecord[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('buyer_inquiries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load buyer inquiries: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      car_id: row.car_id,
      car_title: row.car_title || 'Vehicle Inquiry',
      car_price: Number(row.car_price) || 0,
      full_name: row.full_name,
      phone_number: row.phone_number,
      email: row.email,
      location: row.location || 'Lagos',
      preferred_contact: row.preferred_contact || 'phone',
      needs_financing: Boolean(row.needs_financing),
      needs_inspection: Boolean(row.needs_inspection),
      notes: row.notes || '',
      status: row.status || 'new',
      created_at: row.created_at || new Date().toISOString(),
    }));
  }

  public async createInquiry(inquiry: Partial<BuyerInquiry>): Promise<InquiryRecord> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Unable to submit inquiry.');
    }

    const id = `inq-${Date.now()}`;
    const insertRow = {
      id,
      car_id: inquiry.car_id || null,
      car_title: inquiry.car_title || null,
      car_price: inquiry.car_price || 0,
      full_name: inquiry.full_name,
      phone_number: inquiry.phone_number,
      email: inquiry.email,
      location: inquiry.location || 'Lagos',
      preferred_contact: inquiry.preferred_contact || 'phone',
      needs_financing: Boolean(inquiry.needs_financing),
      needs_inspection: Boolean(inquiry.needs_inspection),
      notes: inquiry.notes || '',
      status: 'new',
    };

    const { error } = await supabase.from('buyer_inquiries').insert(insertRow);
    if (error) {
      throw new Error(`Failed to submit enquiry: ${error.message}`);
    }

    return {
      ...insertRow,
      created_at: new Date().toISOString(),
    } as InquiryRecord;
  }

  public async updateInquiryStatus(id: string, status: InquiryDetailedStatus): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase
      .from('buyer_inquiries')
      .update({ status })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update inquiry status: ${error.message}`);
    }
  }
}

export const inquiryService = new InquiryService();
