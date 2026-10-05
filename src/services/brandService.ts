import { CarBrand } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CAR_BRANDS } from '../data/brandsAndTypes';

class BrandService {
  private cache: CarBrand[] = [];

  public async getBrands(): Promise<CarBrand[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('car_brands')
      .select('*')
      .order('name');

    if (error) {
      throw new Error(`Failed to load brands from Supabase: ${error.message}`);
    }

    if (data && data.length > 0) {
      this.cache = data.map((b: any) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        car_count: b.car_count || 0,
        popular_models: Array.isArray(b.popular_models) ? b.popular_models : [],
        country: b.country || 'International',
        logo_url: b.logo_url,
        is_active: b.is_active ?? true,
        is_featured: b.is_featured ?? false,
      }));
      return [...this.cache];
    }

    // Auto-seed table if brand table is empty in Supabase
    await this.seedInitialBrands();
    return this.getBrands();
  }

  public getBrandsSync(): CarBrand[] {
    return [...this.cache];
  }

  public async getBrandByName(name: string): Promise<CarBrand | null> {
    const { data, error } = await supabase
      .from('car_brands')
      .select('*')
      .ilike('name', name)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      car_count: data.car_count || 0,
      popular_models: Array.isArray(data.popular_models) ? data.popular_models : [],
      country: data.country || 'International',
      logo_url: data.logo_url,
      is_active: data.is_active ?? true,
      is_featured: data.is_featured ?? false,
    };
  }

  public async createBrand(brand: Partial<CarBrand>): Promise<CarBrand> {
    const id = brand.id || brand.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `brand-${Date.now()}`;
    const slug = brand.slug || id;

    const { error } = await supabase.from('car_brands').insert({
      id,
      name: brand.name,
      slug,
      country: brand.country || 'International',
      logo_url: brand.logo_url || null,
      car_count: brand.car_count || 0,
      popular_models: brand.popular_models || [],
      is_active: brand.is_active ?? true,
      is_featured: brand.is_featured ?? false,
    });

    if (error) {
      throw new Error(`Failed to create brand in Supabase: ${error.message}`);
    }

    await this.getBrands();
    return (await this.getBrandByName(brand.name || '')) as CarBrand;
  }

  public async updateBrand(id: string, updates: Partial<CarBrand>): Promise<void> {
    const { error } = await supabase.from('car_brands').update(updates).eq('id', id);
    if (error) {
      throw new Error(`Failed to update brand in Supabase: ${error.message}`);
    }
    await this.getBrands();
  }

  public async deactivateBrand(id: string): Promise<void> {
    return this.updateBrand(id, { is_active: false });
  }

  private async seedInitialBrands(): Promise<void> {
    try {
      const rows = CAR_BRANDS.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        country: b.country,
        popular_models: b.popular_models,
        car_count: b.car_count,
        is_active: true,
        is_featured: b.is_featured || false,
      }));
      await supabase.from('car_brands').upsert(rows, { onConflict: 'id' });
    } catch (e) {
      console.warn('Initial brand seed notice:', e);
    }
  }
}

export const brandService = new BrandService();
