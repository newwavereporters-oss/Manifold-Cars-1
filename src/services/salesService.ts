import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface SaleRecord {
  id: string;
  car_id: string;
  car_title?: string;
  dealer_id?: string;
  buyer_name: string;
  buyer_phone?: string;
  buyer_email?: string;
  sale_price: number;
  status: 'pending' | 'completed' | 'cancelled';
  sale_date: string;
  created_at: string;
}

export interface CommissionRecord {
  id: string;
  sale_id: string;
  dealer_id?: string;
  commission_type: 'percentage' | 'fixed';
  commission_rate: number;
  commission_amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'cancelled';
  paid_at?: string;
  created_at: string;
}

class SalesService {
  public async getSales(): Promise<SaleRecord[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('sales')
      .select('*, cars (title), dealers (name)')
      .order('sale_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to load sales: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      car_id: row.car_id,
      car_title: row.cars?.title || 'Sold Vehicle',
      dealer_id: row.dealer_id,
      buyer_name: row.buyer_name,
      buyer_phone: row.buyer_phone,
      buyer_email: row.buyer_email,
      sale_price: Number(row.sale_price) || 0,
      status: row.status || 'completed',
      sale_date: row.sale_date || new Date().toISOString(),
      created_at: row.created_at || new Date().toISOString(),
    }));
  }

  public async getCommissions(): Promise<CommissionRecord[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('commissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load commissions: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      sale_id: row.sale_id,
      dealer_id: row.dealer_id,
      commission_type: row.commission_type || 'percentage',
      commission_rate: Number(row.commission_rate) || 2.5,
      commission_amount: Number(row.commission_amount) || 0,
      currency: row.currency || 'NGN',
      status: row.status || 'pending',
      paid_at: row.paid_at,
      created_at: row.created_at || new Date().toISOString(),
    }));
  }

  public async createSale(sale: Partial<SaleRecord>): Promise<SaleRecord> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const saleId = sale.id || `sale-${Date.now()}`;
    const salePrice = Number(sale.sale_price) || 0;

    // 1. Insert into public.sales
    const { error: saleErr } = await supabase.from('sales').insert({
      id: saleId,
      car_id: sale.car_id,
      dealer_id: sale.dealer_id || null,
      buyer_name: sale.buyer_name || 'Anonymous Buyer',
      buyer_phone: sale.buyer_phone || '',
      buyer_email: sale.buyer_email || '',
      sale_price: salePrice,
      status: sale.status || 'completed',
      sale_date: new Date().toISOString(),
    });

    if (saleErr) {
      throw new Error(`Failed to record sale in Supabase: ${saleErr.message}`);
    }

    // 2. Section 20: Persist commission record (e.g. 2.5% MANIFOLD brokerage commission)
    const commissionAmount = Math.round(salePrice * 0.025);
    await supabase.from('commissions').insert({
      id: `comm-${saleId}`,
      sale_id: saleId,
      dealer_id: sale.dealer_id || null,
      commission_type: 'percentage',
      commission_rate: 2.5,
      commission_amount: commissionAmount,
      currency: 'NGN',
      status: 'pending',
    });

    // 3. Update car status to 'SOLD'
    if (sale.car_id) {
      await supabase.from('cars').update({ status: 'SOLD' }).eq('id', sale.car_id);
    }

    return {
      id: saleId,
      car_id: sale.car_id || '',
      dealer_id: sale.dealer_id,
      buyer_name: sale.buyer_name || '',
      buyer_phone: sale.buyer_phone,
      buyer_email: sale.buyer_email,
      sale_price: salePrice,
      status: sale.status || 'completed',
      sale_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }
}

export const salesService = new SalesService();
