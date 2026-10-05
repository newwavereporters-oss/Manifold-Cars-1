import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { brandService } from './brandService';

export interface CarModelRecord {
  id: string;
  brand_id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

class ModelService {
  public async getModelsByBrand(brandNameOrId: string): Promise<string[]> {
    if (!isSupabaseConfigured || !brandNameOrId) return [];

    try {
      // 1. Resolve brand ID
      let brandId = brandNameOrId;
      const brand = await brandService.getBrandByName(brandNameOrId);
      if (brand) {
        brandId = brand.id;
      }

      // 2. Query public.car_models
      const { data, error } = await supabase
        .from('car_models')
        .select('name')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .order('name');

      if (!error && data && data.length > 0) {
        return data.map((m: any) => m.name);
      }

      // 3. Fallback to brand popular_models if car_models is not populated
      if (brand && Array.isArray(brand.popular_models) && brand.popular_models.length > 0) {
        // Auto-seed to car_models for consistency
        this.seedModelsForBrand(brandId, brand.popular_models).catch(() => {});
        return brand.popular_models;
      }
    } catch (e) {
      console.warn('Failed to fetch models from Supabase:', e);
    }

    return [];
  }

  public async createModel(brandId: string, modelName: string): Promise<void> {
    const slug = modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const { error } = await supabase.from('car_models').insert({
      id: `model-${Date.now()}`,
      brand_id: brandId,
      name: modelName,
      slug,
      is_active: true,
    });

    if (error) {
      throw new Error(`Failed to create car model in Supabase: ${error.message}`);
    }
  }

  private async seedModelsForBrand(brandId: string, modelNames: string[]): Promise<void> {
    try {
      const rows = modelNames.map((name) => ({
        id: `model-${brandId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        brand_id: brandId,
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        is_active: true,
      }));
      await supabase.from('car_models').upsert(rows, { onConflict: 'id' });
    } catch {
      // ignore
    }
  }
}

export const modelService = new ModelService();
