import { CarBrand, CreateCarBrandInput, UpdateCarBrandInput } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

class BrandService {
  private cache: CarBrand[] = [];

  private generateSlug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private mapBrandRow(row: any): CarBrand {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      logo_url: row.logo_url ?? null,
      description: row.description ?? null,
      is_featured: Boolean(row.is_featured),
      is_active: row.is_active ?? true,
      created_at: row.created_at,
      updated_at: row.updated_at,
      car_count: Number(row.car_count ?? 0),
    };
  }

  /**
   * Reads brands with calculated car_count from public.car_brand_inventory view.
   * Never writes to car_brand_inventory and handles 0-car inventories cleanly.
   */
  public async getBrands(): Promise<CarBrand[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('car_brand_inventory')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[BrandService] Failed to query public.car_brand_inventory:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(`Failed to load brands from Supabase: ${error.message}`);
    }

    this.cache = (data || []).map((row: any) => this.mapBrandRow(row));
    return [...this.cache];
  }

  /**
   * Reads active brands (including those with car_count = 0) from public.car_brand_inventory.
   */
  public async getActiveBrands(): Promise<CarBrand[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('car_brand_inventory')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('[BrandService] Failed to query active brands from public.car_brand_inventory:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(`Failed to load active brands from Supabase: ${error.message}`);
    }

    const activeBrands = (data || []).map((row: any) => this.mapBrandRow(row));
    if (this.cache.length === 0) {
      this.cache = activeBrands;
    }
    return activeBrands;
  }

  public getBrandsSync(): CarBrand[] {
    return [...this.cache];
  }

  public async getBrandByName(name: string): Promise<CarBrand | null> {
    if (!isSupabaseConfigured || !name.trim()) return null;

    const { data, error } = await supabase
      .from('car_brand_inventory')
      .select('*')
      .ilike('name', name.trim())
      .maybeSingle();

    if (error) {
      console.error('[BrandService] Failed to look up brand by name from public.car_brand_inventory:', {
        name,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return null;
    }

    if (!data) return null;
    return this.mapBrandRow(data);
  }

  public async getBrandBySlug(slug: string): Promise<CarBrand | null> {
    if (!isSupabaseConfigured || !slug.trim()) return null;

    const { data, error } = await supabase
      .from('car_brand_inventory')
      .select('*')
      .eq('slug', slug.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('[BrandService] Failed to look up brand by slug from public.car_brand_inventory:', {
        slug,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return null;
    }

    if (!data) return null;
    return this.mapBrandRow(data);
  }

  /**
   * Writes ONLY physical columns of public.car_brands (never car_count).
   */
  public async createBrand(brand: CreateCarBrandInput): Promise<CarBrand> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const name = (brand.name || '').trim();
    if (!name) {
      throw new Error('Brand name is required.');
    }

    const slug = this.generateSlug(brand.slug || name);
    if (!slug) {
      throw new Error('A valid brand slug could not be generated from the brand name.');
    }

    // Check uniqueness on name or slug before inserting using parameterized filters
    const [{ data: slugMatch }, { data: nameMatch }] = await Promise.all([
      supabase.from('car_brands').select('id, name, slug').eq('slug', slug).maybeSingle(),
      supabase.from('car_brands').select('id, name, slug').ilike('name', name).maybeSingle(),
    ]);

    if (nameMatch) {
      throw new Error(`A brand named "${nameMatch.name}" already exists.`);
    }
    if (slugMatch) {
      throw new Error(`A brand with slug "${slugMatch.slug}" already exists.`);
    }

    const payload = {
      name,
      slug,
      logo_url: brand.logo_url?.trim() || null,
      description: brand.description?.trim() || null,
      is_featured: Boolean(brand.is_featured ?? false),
      is_active: brand.is_active ?? true,
    };

    const { data, error } = await supabase
      .from('car_brands')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Brand "${name}" or slug "${slug}" already exists.`);
      }
      throw new Error(`Failed to create brand in Supabase: ${error.message}`);
    }

    // Refresh inventory cache from car_brand_inventory view
    await this.getBrands().catch(() => undefined);

    const fromCache = this.cache.find((b) => b.id === data.id);
    return fromCache || this.mapBrandRow({ ...data, car_count: 0 });
  }

  /**
   * Updates ONLY physical columns of public.car_brands (strips car_count and non-table fields).
   */
  public async updateBrand(
    id: string,
    updates: UpdateCarBrandInput & Record<string, unknown>
  ): Promise<CarBrand> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }
    if (!id) {
      throw new Error('Brand ID is required for update.');
    }

    const sanitizedUpdates: Record<string, unknown> = {};

    if (typeof updates.name === 'string') {
      const trimmedName = updates.name.trim();
      if (!trimmedName) {
        throw new Error('Brand name cannot be empty.');
      }
      sanitizedUpdates.name = trimmedName;
    }

    if (typeof updates.slug === 'string') {
      const cleanSlug = this.generateSlug(updates.slug);
      if (!cleanSlug) {
        throw new Error('Brand slug cannot be empty.');
      }
      sanitizedUpdates.slug = cleanSlug;
    }

    if (updates.logo_url !== undefined) {
      sanitizedUpdates.logo_url =
        typeof updates.logo_url === 'string' && updates.logo_url.trim()
          ? updates.logo_url.trim()
          : null;
    }

    if (updates.description !== undefined) {
      sanitizedUpdates.description =
        typeof updates.description === 'string' && updates.description.trim()
          ? updates.description.trim()
          : null;
    }

    if (typeof updates.is_featured === 'boolean') {
      sanitizedUpdates.is_featured = updates.is_featured;
    }

    if (typeof updates.is_active === 'boolean') {
      sanitizedUpdates.is_active = updates.is_active;
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw new Error('No valid brand fields provided to update.');
    }

    const { data, error } = await supabase
      .from('car_brands')
      .update(sanitizedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Another brand with that name or slug already exists.');
      }
      throw new Error(`Failed to update brand in Supabase: ${error.message}`);
    }

    await this.getBrands().catch(() => undefined);

    const fromCache = this.cache.find((b) => b.id === id);
    return fromCache || this.mapBrandRow({ ...data, car_count: 0 });
  }

  public async deactivateBrand(id: string): Promise<CarBrand> {
    return this.updateBrand(id, { is_active: false });
  }

  public async deleteBrand(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }
    if (!id) {
      throw new Error('Brand ID is required.');
    }

    const { error } = await supabase.from('car_brands').delete().eq('id', id);
    if (error) {
      throw new Error(`Failed to delete brand in Supabase: ${error.message}`);
    }

    await this.getBrands().catch(() => undefined);
  }
}

export const brandService = new BrandService();
