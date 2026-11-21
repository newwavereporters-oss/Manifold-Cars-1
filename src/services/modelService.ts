import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { brandService } from './brandService';
import { CAR_BRANDS } from '../data/brandsAndTypes';

export interface CarModelRecord {
  id: string;
  brand_id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ModelService {
  public async getModelsByBrand(brandNameOrId: string, explicitBrandId?: string): Promise<string[]> {
    if (!isSupabaseConfigured || (!brandNameOrId && !explicitBrandId)) return [];

    try {
      // 1. Resolve brand ID without unnecessary lookup when UUID is already known
      let brandId = (explicitBrandId || '').trim();
      let resolvedBrandName = brandNameOrId;

      if (!brandId) {
        if (UUID_REGEX.test(brandNameOrId.trim())) {
          brandId = brandNameOrId.trim();
        } else {
          const brand = await brandService.getBrandByName(brandNameOrId);
          if (brand) {
            brandId = brand.id;
            resolvedBrandName = brand.name;
          } else {
            brandId = brandNameOrId;
          }
        }
      }

      // 2. Query public.car_models
      const { data, error } = await supabase
        .from('car_models')
        .select('id, name, slug')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.error('[ModelService] Failed to query public.car_models:', {
          brandId,
          brandNameOrId,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        return [];
      }

      if (data && data.length > 0) {
        return data.map((m: any) => m.name);
      }

      // 3. Secondary helper only when car_models query succeeded with 0 rows
      const fallbackBrand = CAR_BRANDS.find(
        (fb) =>
          fb.id === brandId ||
          fb.slug === resolvedBrandName.toLowerCase() ||
          fb.name.toLowerCase() === resolvedBrandName.toLowerCase()
      );
      if (fallbackBrand?.popular_models && fallbackBrand.popular_models.length > 0) {
        return fallbackBrand.popular_models;
      }
    } catch (e) {
      console.error('[ModelService] Unexpected error fetching models from Supabase:', e);
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
