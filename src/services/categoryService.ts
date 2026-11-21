import { BodyTypeCategory } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class CategoryService {
  private cache: BodyTypeCategory[] = [];

  private generateSlug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private mapTypeRow(t: any): BodyTypeCategory {
    return {
      id: String(t.id),
      name: t.name,
      slug: t.slug,
      car_count: Number(t.car_count ?? 0),
      description: t.description || '',
      image_url: t.image_url ?? undefined,
      is_active: t.is_active ?? true,
    };
  }

  public async getBodyTypes(): Promise<BodyTypeCategory[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('car_types')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[CategoryService] Failed to query public.car_types:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(`Failed to load vehicle types from Supabase: ${error.message}`);
    }

    this.cache = (data || []).map((t: any) => this.mapTypeRow(t));
    return [...this.cache];
  }

  /**
   * Reads active vehicle types from public.car_types preserving database UUIDs.
   */
  public async getActiveBodyTypes(): Promise<BodyTypeCategory[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('car_types')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('[CategoryService] Failed to query active vehicle types from public.car_types:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(`Failed to load active vehicle types from Supabase: ${error.message}`);
    }

    const activeTypes = (data || []).map((t: any) => this.mapTypeRow(t));
    if (this.cache.length === 0) {
      this.cache = activeTypes;
    }
    return activeTypes;
  }

  public getBodyTypesSync(): BodyTypeCategory[] {
    return [...this.cache];
  }

  public async getBodyTypeBySlug(slug: string): Promise<BodyTypeCategory | null> {
    if (!isSupabaseConfigured || !slug.trim()) return null;

    const cleanSlug = this.generateSlug(slug);
    if (!cleanSlug) return null;

    const { data, error } = await supabase
      .from('car_types')
      .select('*')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (error) {
      console.error('[CategoryService] Failed to look up car type by slug:', {
        slug: cleanSlug,
        code: error.code,
        message: error.message,
      });
      return null;
    }

    return data ? this.mapTypeRow(data) : null;
  }

  public async getBodyTypeByName(name: string): Promise<BodyTypeCategory | null> {
    if (!isSupabaseConfigured || !name.trim()) return null;

    const { data, error } = await supabase
      .from('car_types')
      .select('*')
      .ilike('name', name.trim())
      .maybeSingle();

    if (error) {
      console.error('[CategoryService] Failed to look up car type by name:', {
        name,
        code: error.code,
        message: error.message,
      });
      return null;
    }

    return data ? this.mapTypeRow(data) : null;
  }

  /**
   * Resolves a car_types UUID from either an existing UUID, slug (e.g. "sedan"), or name (e.g. "Sedan").
   * Never returns a non-UUID string so UUID columns (such as cars.type_id) never receive text slugs.
   */
  public async resolveTypeId(
    typeIdOrSlugOrName?: string | null,
    fallbackName?: string | null
  ): Promise<string | null> {
    const primary = (typeIdOrSlugOrName || '').trim();
    if (primary && UUID_REGEX.test(primary)) {
      return primary;
    }

    const candidates = [primary, (fallbackName || '').trim()].filter(Boolean);
    for (const candidate of candidates) {
      const normalized = candidate.replace(/^__legacy__:/, '').trim();
      if (!normalized) continue;

      if (UUID_REGEX.test(normalized)) {
        return normalized;
      }

      const bySlug = await this.getBodyTypeBySlug(normalized);
      if (bySlug && UUID_REGEX.test(bySlug.id)) {
        return bySlug.id;
      }

      const byName = await this.getBodyTypeByName(normalized);
      if (byName && UUID_REGEX.test(byName.id)) {
        return byName.id;
      }
    }

    return null;
  }

  /**
   * Inserts only physical non-key columns of public.car_types so PostgreSQL generates the UUID id.
   */
  public async createBodyType(type: Partial<BodyTypeCategory>): Promise<BodyTypeCategory> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const name = (type.name || '').trim();
    if (!name) {
      throw new Error('Vehicle type name is required.');
    }

    const slug = this.generateSlug(type.slug || name);
    if (!slug) {
      throw new Error('A valid vehicle type slug could not be generated from the name.');
    }

    const [{ data: slugMatch }, { data: nameMatch }] = await Promise.all([
      supabase.from('car_types').select('id, name, slug').eq('slug', slug).maybeSingle(),
      supabase.from('car_types').select('id, name, slug').ilike('name', name).maybeSingle(),
    ]);

    if (nameMatch) {
      throw new Error(`A vehicle type named "${nameMatch.name}" already exists.`);
    }
    if (slugMatch) {
      throw new Error(`A vehicle type with slug "${slugMatch.slug}" already exists.`);
    }

    const payload = {
      name,
      slug,
      description: type.description?.trim() || null,
      image_url: type.image_url?.trim() || null,
      is_active: type.is_active ?? true,
    };

    const { data, error } = await supabase
      .from('car_types')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('[CategoryService] Failed to create car type in public.car_types:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      if (error.code === '23505') {
        throw new Error(`Vehicle type "${name}" or slug "${slug}" already exists.`);
      }
      throw new Error(`Failed to create car type in Supabase: ${error.message}`);
    }

    await this.getBodyTypes().catch(() => undefined);
    return this.mapTypeRow(data);
  }

  public async updateBodyType(
    id: string,
    updates: Partial<BodyTypeCategory> & Record<string, unknown>
  ): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }
    if (!id) {
      throw new Error('Vehicle type ID is required for update.');
    }

    const sanitizedUpdates: Record<string, unknown> = {};

    if (typeof updates.name === 'string') {
      const trimmedName = updates.name.trim();
      if (!trimmedName) {
        throw new Error('Vehicle type name cannot be empty.');
      }
      sanitizedUpdates.name = trimmedName;
    }

    if (typeof updates.slug === 'string') {
      const cleanSlug = this.generateSlug(updates.slug);
      if (!cleanSlug) {
        throw new Error('Vehicle type slug cannot be empty.');
      }
      sanitizedUpdates.slug = cleanSlug;
    }

    if (updates.description !== undefined) {
      sanitizedUpdates.description =
        typeof updates.description === 'string' && updates.description.trim()
          ? updates.description.trim()
          : null;
    }

    if (updates.image_url !== undefined) {
      sanitizedUpdates.image_url =
        typeof updates.image_url === 'string' && updates.image_url.trim()
          ? updates.image_url.trim()
          : null;
    }

    if (typeof updates.is_active === 'boolean') {
      sanitizedUpdates.is_active = updates.is_active;
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw new Error('No valid vehicle type fields provided to update.');
    }

    const { error } = await supabase.from('car_types').update(sanitizedUpdates).eq('id', id);
    if (error) {
      console.error('[CategoryService] Failed to update car type in public.car_types:', {
        id,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(`Failed to update car type in Supabase: ${error.message}`);
    }
    await this.getBodyTypes().catch(() => undefined);
  }

  public async deactivateBodyType(id: string): Promise<void> {
    return this.updateBodyType(id, { is_active: false });
  }
}

export const categoryService = new CategoryService();
