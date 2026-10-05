import { BodyTypeCategory } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { BODY_TYPES } from '../data/brandsAndTypes';

class CategoryService {
  private cache: BodyTypeCategory[] = [];

  public async getBodyTypes(): Promise<BodyTypeCategory[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('car_types')
      .select('*')
      .order('name');

    if (error) {
      throw new Error(`Failed to load vehicle types from Supabase: ${error.message}`);
    }

    if (data && data.length > 0) {
      this.cache = data.map((t: any) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        car_count: 0,
        description: t.description || '',
        image_url: t.image_url,
        is_active: t.is_active ?? true,
      }));
      return [...this.cache];
    }

    // Auto-seed if empty
    await this.seedInitialBodyTypes();
    return this.getBodyTypes();
  }

  public getBodyTypesSync(): BodyTypeCategory[] {
    return [...this.cache];
  }

  public async createBodyType(type: Partial<BodyTypeCategory>): Promise<BodyTypeCategory> {
    const id = type.id || type.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `type-${Date.now()}`;
    const slug = type.slug || id;

    const { error } = await supabase.from('car_types').insert({
      id,
      name: type.name,
      slug,
      description: type.description || '',
      image_url: type.image_url || null,
      is_active: type.is_active ?? true,
    });

    if (error) {
      throw new Error(`Failed to create car type in Supabase: ${error.message}`);
    }

    await this.getBodyTypes();
    return this.cache.find((t) => t.id === id) as BodyTypeCategory;
  }

  public async updateBodyType(id: string, updates: Partial<BodyTypeCategory>): Promise<void> {
    const { error } = await supabase.from('car_types').update(updates).eq('id', id);
    if (error) {
      throw new Error(`Failed to update car type in Supabase: ${error.message}`);
    }
    await this.getBodyTypes();
  }

  public async deactivateBodyType(id: string): Promise<void> {
    return this.updateBodyType(id, { is_active: false });
  }

  private async seedInitialBodyTypes(): Promise<void> {
    try {
      const rows = BODY_TYPES.map((bt) => ({
        id: bt.id,
        name: bt.name,
        slug: bt.slug,
        description: bt.description,
        is_active: true,
      }));
      await supabase.from('car_types').upsert(rows, { onConflict: 'id' });
    } catch {
      // ignore
    }
  }
}

export const categoryService = new CategoryService();
