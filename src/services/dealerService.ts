import { DealerInfo } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface DealerFullRecord extends DealerInfo {
  address?: string;
  phone?: string;
  email?: string;
}

class DealerService {
  private cache: DealerFullRecord[] = [];

  public async getDealers(): Promise<DealerFullRecord[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('dealers')
      .select('*')
      .order('name');

    if (error) {
      throw new Error(`Failed to load dealers from Supabase: ${error.message}`);
    }

    if (data && data.length > 0) {
      this.cache = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        city: d.city || 'Lagos',
        state: d.state || 'Lagos',
        verified_partner: d.is_verified ?? true,
        joined_year: d.joined_year || 2024,
        address: d.address,
        phone: d.phone,
        email: d.email,
      }));
      return [...this.cache];
    }

    await this.seedInitialDealer();
    return this.getDealers();
  }

  public getDealersSync(): DealerFullRecord[] {
    return [...this.cache];
  }

  public async createDealer(dealer: Partial<DealerFullRecord>): Promise<DealerFullRecord> {
    const id = dealer.id || `dlr-${Date.now()}`;
    const slug = dealer.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || id;

    const { error } = await supabase.from('dealers').insert({
      id,
      name: dealer.name,
      slug,
      city: dealer.city || 'Lekki',
      state: dealer.state || 'Lagos',
      address: dealer.address || '',
      phone: dealer.phone || '',
      email: dealer.email || '',
      is_verified: dealer.verified_partner ?? true,
      joined_year: dealer.joined_year || 2024,
    });

    if (error) {
      throw new Error(`Failed to create dealer in Supabase: ${error.message}`);
    }

    await this.getDealers();
    return this.cache.find((d) => d.id === id) as DealerFullRecord;
  }

  private async seedInitialDealer(): Promise<void> {
    try {
      await supabase.from('dealers').upsert([
        {
          id: 'dlr-partner-01',
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
          id: 'dlr-partner-02',
          name: 'Apex Luxury Victoria Island',
          slug: 'apex-luxury-vi',
          city: 'Victoria Island',
          state: 'Lagos',
          phone: '+234 809 111 2233',
          email: 'inventory@apexluxury.ng',
          is_verified: true,
          joined_year: 2024,
        }
      ], { onConflict: 'id' });
    } catch {
      // ignore
    }
  }
}

export const dealerService = new DealerService();
