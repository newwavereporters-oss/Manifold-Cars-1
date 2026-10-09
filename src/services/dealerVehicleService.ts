import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from '../utils/youtube';

export interface DealerCarFormInput {
  brand_id?: string;
  make: string;
  model: string;
  trim?: string;
  year: number;
  type_id?: string;
  body_type: string;
  condition: string;
  mileage: number;
  fuel_type: string;
  transmission: string;
  drive_type: string;
  engine?: string;
  horsepower?: number | null;
  exterior_color: string;
  interior_color: string;
  seats?: number;
  doors?: number;
  price: number;
  previous_price?: number | null;
  location: string;
  state?: string;
  description: string;
  youtube_url?: string;
  youtube_title?: string;
  youtube_description?: string;
  gallery_image_1_url?: string;
  gallery_image_2_url?: string;
}

export interface DealerCarRecord {
  id: string;
  slug: string;
  title: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  body_type: string;
  condition: string;
  price: number;
  previous_price?: number | null;
  currency: string;
  mileage: number;
  transmission: string;
  fuel_type: string;
  drive_type: string;
  engine?: string;
  horsepower?: number | null;
  exterior_color: string;
  interior_color: string;
  seats?: number;
  doors?: number;
  location: string;
  state: string;
  description: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'RESERVED' | 'SOLD' | 'ARCHIVED';
  is_verified: boolean;
  is_featured: boolean;
  dealer_id: string;
  created_at: string;
  updated_at: string;
  youtube_url?: string;
  youtube_video_id?: string;
  youtube_thumbnail_url?: string;
  gallery_image_1_url?: string;
  gallery_image_2_url?: string;
}

class DealerVehicleService {
  /**
   * Fetches only vehicles belonging to the authenticated dealer
   * Database RLS and application filter guarantee dealer isolation
   */
  public async getDealerCars(dealerId: string): Promise<DealerCarRecord[]> {
    if (!isSupabaseConfigured || !dealerId) return [];

    try {
      const { data, error } = await supabase
        .from('cars')
        .select(`
          *,
          car_media (id, youtube_url, youtube_video_id, youtube_thumbnail_url, title),
          car_images (id, image_url, position)
        `)
        .eq('dealer_id', dealerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to query dealer cars:', error);
        return [];
      }

      return (data || []).map((row: any) => this.mapRowToRecord(row));
    } catch (err) {
      console.error('Error fetching dealer cars:', err);
      return [];
    }
  }

  /**
   * Fetches a specific vehicle for editing, verifying dealer ownership
   */
  public async getDealerCarById(carId: string, dealerId: string): Promise<DealerCarRecord | null> {
    if (!isSupabaseConfigured || !carId || !dealerId) return null;

    try {
      const { data, error } = await supabase
        .from('cars')
        .select(`
          *,
          car_media (id, youtube_url, youtube_video_id, youtube_thumbnail_url, title, description),
          car_images (id, image_url, position)
        `)
        .eq('id', carId)
        .eq('dealer_id', dealerId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return this.mapRowToRecord(data);
    } catch (err) {
      console.error('Error fetching dealer car by id:', err);
      return null;
    }
  }

  /**
   * Creates a new vehicle record owned by the authenticated dealer
   * Status is strictly controlled: 'DRAFT' or 'PENDING_REVIEW'
   * The client CANNOT make a vehicle 'PUBLISHED', 'is_verified=true', or 'is_featured=true'
   */
  public async createDealerCar(
    input: DealerCarFormInput,
    dealerId: string,
    isDraft: boolean
  ): Promise<{ car: DealerCarRecord | null; error: string | null }> {
    if (!dealerId) {
      return { car: null, error: 'Dealership authorization context missing.' };
    }

    try {
      // Authoritative security check: resolve current auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        return { car: null, error: 'Authentication required to list vehicles.' };
      }

      // Prevent admin users without a dealer account from listing vehicles
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .maybeSingle();

      const { data: dealerAcc } = await supabase
        .from('dealer_accounts')
        .select('dealer_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (adminRow && !dealerAcc) {
        return { car: null, error: 'Vehicle listing is available to MANIFOLD dealer accounts.' };
      }

      if (dealerAcc && dealerAcc.dealer_id !== dealerId) {
        return { car: null, error: 'Dealership authorization mismatch.' };
      }

      const id = `car-dlr-${Date.now()}`;
      const title = `${input.year} ${input.make} ${input.model}${input.trim ? ` ${input.trim}` : ''}`;
      const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const slug = `${slugBase}-${Date.now().toString(36).substring(0, 4)}`;

      const vidId = input.youtube_url ? extractYouTubeVideoId(input.youtube_url) || '' : '';
      const thumb = vidId ? getYouTubeThumbnailUrl(vidId) : '';

      // Security boundary: Enforcement of dealer ownership and status machine
      const status: DealerCarRecord['status'] = isDraft ? 'DRAFT' : 'PENDING_REVIEW';

      const insertPayload: any = {
        id,
        slug,
        title,
        brand_id: input.brand_id || null,
        make: input.make,
        model: input.model,
        variant: input.trim || null,
        trim: input.trim || null,
        type_id: input.type_id || null,
        body_type: input.body_type || 'SUV',
        year: Number(input.year) || 2024,
        price: Number(input.price) || 0,
        previous_price: input.previous_price ? Number(input.previous_price) : null,
        original_price: input.previous_price ? Number(input.previous_price) : null,
        currency: 'NGN',
        mileage: Number(input.mileage) || 0,
        condition: input.condition || 'Foreign Used',
        fuel_type: input.fuel_type || 'Petrol',
        transmission: input.transmission || 'Automatic',
        drive_type: input.drive_type || 'AWD',
        engine: input.engine || null,
        horsepower: input.horsepower ? Number(input.horsepower) : null,
        exterior_color: input.exterior_color || 'Black',
        interior_color: input.interior_color || 'Black Leather',
        seats: Number(input.seats) || 5,
        doors: Number(input.doors) || 4,
        location: input.location || 'Lagos',
        state: input.state || 'Lagos',
        description: input.description || '',
        
        // PROTECTED FIELDS: Dealer cannot self-publish or self-verify
        status,
        is_verified: false,
        is_featured: false,
        views_count: 0,
        dealer_id: dealerId,

        // Media fields on cars table
        youtube_url: input.youtube_url || null,
        youtube_video_id: vidId || null,
        youtube_thumbnail_url: thumb || null,
        gallery_image_1_url: input.gallery_image_1_url || null,
        gallery_image_2_url: input.gallery_image_2_url || null,
      };

      const { error: carError } = await supabase.from('cars').insert(insertPayload);
      if (carError) {
        console.error('Error inserting dealer car into public.cars:', carError);
        return { car: null, error: 'Failed to create vehicle record. Please try again.' };
      }

      // Save YouTube video to public.car_media if provided
      if (input.youtube_url && vidId) {
        const { error: mediaErr } = await supabase.from('car_media').insert({
          id: `media-${id}-${Date.now()}`,
          car_id: id,
          media_type: 'youtube_video',
          video_type: 'walkaround',
          title: input.youtube_title || `${title} Walkaround Review`,
          youtube_url: input.youtube_url,
          youtube_video_id: vidId,
          youtube_thumbnail_url: thumb,
          description: input.youtube_description || input.description || '',
          is_primary: true,
          status: 'published',
          sort_order: 1,
        });
        if (mediaErr) console.warn('Car media insert note:', mediaErr.message);
      }

      // Save Gallery Images (Image 1 & 2 only) to public.car_images
      if (input.gallery_image_1_url) {
        await supabase.from('car_images').insert({
          id: `img1-${id}-${Date.now()}`,
          car_id: id,
          image_url: input.gallery_image_1_url,
          position: 1,
          is_primary: false,
        });
      }

      if (input.gallery_image_2_url) {
        await supabase.from('car_images').insert({
          id: `img2-${id}-${Date.now()}`,
          car_id: id,
          image_url: input.gallery_image_2_url,
          position: 2,
          is_primary: false,
        });
      }

      const fetched = await this.getDealerCarById(id, dealerId);
      return { car: fetched, error: null };
    } catch (err: any) {
      console.error('Unexpected error creating dealer car:', err);
      return { car: null, error: 'An unexpected error occurred while saving the vehicle.' };
    }
  }

  /**
   * Updates an existing vehicle record owned by the authenticated dealer
   * Prevents manipulation of protected fields (dealer_id, is_verified, is_featured, published_at)
   */
  public async updateDealerCar(
    carId: string,
    input: DealerCarFormInput,
    dealerId: string,
    isDraft: boolean
  ): Promise<{ car: DealerCarRecord | null; error: string | null }> {
    if (!dealerId || !carId) {
      return { car: null, error: 'Invalid car update request.' };
    }

    try {
      // First verify ownership
      const existing = await this.getDealerCarById(carId, dealerId);
      if (!existing) {
        return { car: null, error: 'Vehicle not found or you do not have permission to modify it.' };
      }

      const title = `${input.year} ${input.make} ${input.model}${input.trim ? ` ${input.trim}` : ''}`;
      const vidId = input.youtube_url ? extractYouTubeVideoId(input.youtube_url) || '' : '';
      const thumb = vidId ? getYouTubeThumbnailUrl(vidId) : '';

      // If existing vehicle is already published, a resubmission sets it to PENDING_REVIEW; drafts stay DRAFT
      let nextStatus: DealerCarRecord['status'] = isDraft ? 'DRAFT' : 'PENDING_REVIEW';
      if (existing.status === 'PUBLISHED' && isDraft) {
        // Keep published if just updating notes unless explicitly drafting
        nextStatus = 'PUBLISHED';
      }

      const updates: any = {
        title,
        brand_id: input.brand_id || null,
        make: input.make,
        model: input.model,
        variant: input.trim || null,
        trim: input.trim || null,
        type_id: input.type_id || null,
        body_type: input.body_type || 'SUV',
        year: Number(input.year) || 2024,
        price: Number(input.price) || 0,
        previous_price: input.previous_price ? Number(input.previous_price) : null,
        original_price: input.previous_price ? Number(input.previous_price) : null,
        mileage: Number(input.mileage) || 0,
        condition: input.condition || 'Foreign Used',
        fuel_type: input.fuel_type || 'Petrol',
        transmission: input.transmission || 'Automatic',
        drive_type: input.drive_type || 'AWD',
        engine: input.engine || null,
        horsepower: input.horsepower ? Number(input.horsepower) : null,
        exterior_color: input.exterior_color || 'Black',
        interior_color: input.interior_color || 'Black Leather',
        seats: Number(input.seats) || 5,
        doors: Number(input.doors) || 4,
        location: input.location || 'Lagos',
        state: input.state || 'Lagos',
        description: input.description || '',
        
        status: nextStatus,
        updated_at: new Date().toISOString(),

        youtube_url: input.youtube_url || null,
        youtube_video_id: vidId || null,
        youtube_thumbnail_url: thumb || null,
        gallery_image_1_url: input.gallery_image_1_url || null,
        gallery_image_2_url: input.gallery_image_2_url || null,
      };

      const { error: carError } = await supabase
        .from('cars')
        .update(updates)
        .eq('id', carId)
        .eq('dealer_id', dealerId);

      if (carError) {
        console.error('Error updating dealer car in public.cars:', carError);
        return { car: null, error: 'Failed to update vehicle record.' };
      }

      // Update car_media
      if (input.youtube_url && vidId) {
        await supabase.from('car_media').delete().eq('car_id', carId).eq('media_type', 'youtube_video');
        await supabase.from('car_media').insert({
          id: `media-${carId}-${Date.now()}`,
          car_id: carId,
          media_type: 'youtube_video',
          video_type: 'walkaround',
          title: input.youtube_title || `${title} Walkaround Review`,
          youtube_url: input.youtube_url,
          youtube_video_id: vidId,
          youtube_thumbnail_url: thumb,
          description: input.youtube_description || input.description || '',
          is_primary: true,
          status: 'published',
          sort_order: 1,
        });
      }

      // Update car_images (Position 1 & 2)
      if (input.gallery_image_1_url !== undefined) {
        await supabase.from('car_images').delete().eq('car_id', carId).eq('position', 1);
        if (input.gallery_image_1_url) {
          await supabase.from('car_images').insert({
            id: `img1-${carId}-${Date.now()}`,
            car_id: carId,
            image_url: input.gallery_image_1_url,
            position: 1,
            is_primary: false,
          });
        }
      }

      if (input.gallery_image_2_url !== undefined) {
        await supabase.from('car_images').delete().eq('car_id', carId).eq('position', 2);
        if (input.gallery_image_2_url) {
          await supabase.from('car_images').insert({
            id: `img2-${carId}-${Date.now()}`,
            car_id: carId,
            image_url: input.gallery_image_2_url,
            position: 2,
            is_primary: false,
          });
        }
      }

      const refreshed = await this.getDealerCarById(carId, dealerId);
      return { car: refreshed, error: null };
    } catch (err: any) {
      console.error('Unexpected error updating dealer car:', err);
      return { car: null, error: 'An unexpected error occurred while updating the vehicle.' };
    }
  }

  private mapRowToRecord(row: any): DealerCarRecord {
    let vidUrl = row.youtube_url;
    let vidId = row.youtube_video_id;
    let thumb = row.youtube_thumbnail_url;

    if (Array.isArray(row.car_media) && row.car_media.length > 0) {
      const primaryMedia = row.car_media.find((m: any) => m.is_primary) || row.car_media[0];
      if (primaryMedia) {
        vidUrl = primaryMedia.youtube_url || vidUrl;
        vidId = primaryMedia.youtube_video_id || vidId;
        thumb = primaryMedia.youtube_thumbnail_url || thumb;
      }
    }

    let img1 = row.gallery_image_1_url;
    let img2 = row.gallery_image_2_url;
    if (Array.isArray(row.car_images) && row.car_images.length > 0) {
      const found1 = row.car_images.find((i: any) => i.position === 1);
      const found2 = row.car_images.find((i: any) => i.position === 2);
      if (found1?.image_url) img1 = found1.image_url;
      if (found2?.image_url) img2 = found2.image_url;
    }

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      year: Number(row.year) || 2024,
      make: row.make,
      model: row.model,
      trim: row.trim || row.variant || undefined,
      body_type: row.body_type || 'SUV',
      condition: row.condition || 'Foreign Used',
      price: Number(row.price) || 0,
      previous_price: row.previous_price ? Number(row.previous_price) : null,
      currency: row.currency || 'NGN',
      mileage: Number(row.mileage) || 0,
      transmission: row.transmission || 'Automatic',
      fuel_type: row.fuel_type || 'Petrol',
      drive_type: row.drive_type || 'AWD',
      engine: row.engine || undefined,
      horsepower: row.horsepower ? Number(row.horsepower) : null,
      exterior_color: row.exterior_color || 'Black',
      interior_color: row.interior_color || 'Black',
      seats: Number(row.seats) || 5,
      doors: Number(row.doors) || 4,
      location: row.location || 'Lagos',
      state: row.state || 'Lagos',
      description: row.description || '',
      status: row.status || 'DRAFT',
      is_verified: Boolean(row.is_verified),
      is_featured: Boolean(row.is_featured),
      dealer_id: row.dealer_id,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
      youtube_url: vidUrl,
      youtube_video_id: vidId,
      youtube_thumbnail_url: thumb,
      gallery_image_1_url: img1,
      gallery_image_2_url: img2,
    };
  }
}

export const dealerVehicleService = new DealerVehicleService();
