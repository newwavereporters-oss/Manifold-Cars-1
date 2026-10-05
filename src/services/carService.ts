import { Car } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl, formatStandardYouTubeUrl } from '../utils/youtube';

type CarChangeListener = (cars: Car[]) => void;

function mapSupabaseToCar(row: any): Car {
  // 1. Resolve Primary Video from joined car_media or fallback columns
  let videoObj = {
    youtube_video_id: row.youtube_video_id || '',
    youtube_url: row.youtube_url || '',
    youtube_thumbnail_url: row.youtube_thumbnail_url || '',
    video_title: row.video_title || row.title,
    video_duration: row.video_duration || '12:00',
    video_type: (row.video_type || 'full_review') as 'full_review' | 'walkaround' | 'car_hunt',
    is_primary: true,
    presenter_name: row.video_presenter || 'MANIFOLD Presenter',
  };

  if (Array.isArray(row.car_media) && row.car_media.length > 0) {
    const primaryMedia = row.car_media.find((m: any) => m.is_primary) || row.car_media[0];
    if (primaryMedia) {
      videoObj = {
        youtube_video_id: primaryMedia.youtube_video_id || extractYouTubeVideoId(primaryMedia.youtube_url) || '',
        youtube_url: primaryMedia.youtube_url || '',
        youtube_thumbnail_url: primaryMedia.youtube_thumbnail_url || getYouTubeThumbnailUrl(primaryMedia.youtube_video_id || ''),
        video_title: primaryMedia.title || row.title,
        video_duration: primaryMedia.duration || '12:00',
        video_type: (primaryMedia.video_type === 'walkaround' ? 'walkaround' : 'full_review') as 'full_review' | 'walkaround' | 'car_hunt',
        is_primary: true,
        presenter_name: primaryMedia.presenter || 'MANIFOLD Presenter',
      };
    }
  }

  // 2. Resolve Gallery Images from joined car_images (position 1 & 2)
  let gallery1 = row.gallery_image_1_url || '';
  let gallery2 = row.gallery_image_2_url || '';

  if (Array.isArray(row.car_images) && row.car_images.length > 0) {
    const img1 = row.car_images.find((img: any) => img.position === 1);
    const img2 = row.car_images.find((img: any) => img.position === 2);
    if (img1 && img1.image_url) gallery1 = img1.image_url;
    if (img2 && img2.image_url) gallery2 = img2.image_url;
  }

  // 3. Resolve Dealer info
  const dealerObj = row.dealers
    ? {
        id: row.dealers.id || row.dealer_id || 'dlr-partner-01',
        name: row.dealers.name || row.dealer_name || 'MANIFOLD Verified Partner',
        city: row.dealers.city || row.dealer_city || 'Lekki',
        state: row.dealers.state || row.dealer_state || 'Lagos',
        verified_partner: row.dealers.is_verified ?? true,
        joined_year: row.dealers.joined_year || 2024,
      }
    : {
        id: row.dealer_id || 'dlr-partner-01',
        name: row.dealer_name || 'MANIFOLD Verified Partner',
        city: row.dealer_city || 'Lekki',
        state: row.dealer_state || 'Lagos',
        verified_partner: true,
        joined_year: 2024,
      };

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    year: Number(row.year) || 2024,
    make: row.make || row.car_brands?.name || 'Vehicle',
    model: row.model || 'Model',
    trim: row.trim || row.variant || '',
    body_type: row.body_type || row.car_types?.name || 'SUV',
    condition: row.condition || 'Foreign Used',
    price: Number(row.price) || 0,
    original_price: row.original_price || row.previous_price ? Number(row.original_price || row.previous_price) : undefined,
    is_price_reduced: Boolean(row.is_price_reduced || (row.previous_price && Number(row.previous_price) > Number(row.price))),
    location: row.location || 'Lagos',
    state: row.state || 'Lagos',
    mileage: Number(row.mileage) || 0,
    transmission: row.transmission || 'Automatic',
    fuel_type: row.fuel_type || 'Petrol',
    drive_type: row.drive_type || 'AWD',
    engine: row.engine || '3.5L V6',
    horsepower: row.horsepower ? Number(row.horsepower) : undefined,
    exterior_color: row.exterior_color || 'Metallic Black',
    interior_color: row.interior_color || 'Black Leather',
    seats: Number(row.seats) || 5,
    doors: Number(row.doors) || 4,
    is_featured: Boolean(row.is_featured),
    status: row.status || 'DRAFT',
    views_count: Number(row.views_count) || 0,
    created_at: row.created_at || new Date().toISOString(),
    description: row.description || '',
    features: Array.isArray(row.features) ? row.features : [],
    video: videoObj,
    gallery_image_1_url: gallery1,
    gallery_image_2_url: gallery2,
    verification: {
      is_verified: Boolean(row.is_verified ?? true),
      dealer_verified: true,
      vehicle_physically_seen: true,
      video_reviewed: Boolean(videoObj.youtube_video_id),
      price_confirmed: true,
      vin_checked: true,
      inspection_score: Number(row.inspection_score) || 95,
      verified_date: row.verified_date || 'Oct 2026',
      verified_by: row.verified_by || 'MANIFOLD Field Unit',
    },
    dealer: dealerObj,
  };
}

class CarService {
  private cache: Car[] = [];
  private listeners: Set<CarChangeListener> = new Set();
  private hasLoaded = false;

  public async getCars(): Promise<Car[]> {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
      );
    }

    const { data, error } = await supabase
      .from('cars')
      .select(`
        *,
        car_media (*),
        car_images (*),
        dealers (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Unable to load MANIFOLD data: ${error.message}`);
    }

    this.cache = (data || []).map(mapSupabaseToCar);
    this.hasLoaded = true;
    this.notify();
    return [...this.cache];
  }

  public getCarsSync(): Car[] {
    return [...this.cache];
  }

  public async getCarById(id: string): Promise<Car | null> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('cars')
      .select(`
        *,
        car_media (*),
        car_images (*),
        dealers (*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load vehicle from Supabase: ${error.message}`);
    }

    return data ? mapSupabaseToCar(data) : null;
  }

  public async getCarBySlug(slug: string): Promise<Car | null> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('cars')
      .select(`
        *,
        car_media (*),
        car_images (*),
        dealers (*)
      `)
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load vehicle from Supabase: ${error.message}`);
    }

    return data ? mapSupabaseToCar(data) : null;
  }

  /**
   * Section 9 & 10: CREATE CAR in Supabase
   * Saves to public.cars, public.car_media, public.car_images
   */
  public async createCar(carData: Partial<Car>): Promise<Car> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Unable to persist vehicle.');
    }

    const id = carData.id || `car-${Date.now()}`;
    const title = carData.title || `${carData.year || 2024} ${carData.make || 'Toyota'} ${carData.model || 'Model'}`;
    const slugBase = (carData.slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slug = `${slugBase}-${Date.now().toString(36).substring(0, 4)}`;

    const carInsertRow = {
      id,
      slug,
      title,
      year: carData.year || 2024,
      make: carData.make || 'Toyota',
      model: carData.model || 'Model',
      variant: carData.trim || 'Standard',
      trim: carData.trim || 'Standard',
      body_type: carData.body_type || 'SUV',
      condition: carData.condition || 'Foreign Used',
      price: carData.price || 0,
      previous_price: carData.original_price || null,
      original_price: carData.original_price || null,
      currency: 'NGN',
      mileage: carData.mileage || 0,
      transmission: carData.transmission || 'Automatic',
      fuel_type: carData.fuel_type || 'Petrol',
      drive_type: carData.drive_type || 'AWD',
      engine: carData.engine || '3.5L V6',
      horsepower: carData.horsepower || null,
      exterior_color: carData.exterior_color || 'Metallic Black',
      interior_color: carData.interior_color || 'Black Leather',
      seats: carData.seats || 5,
      doors: carData.doors || 4,
      location: carData.location || 'Lagos',
      state: carData.state || 'Lagos',
      description: carData.description || '',
      status: carData.status || 'DRAFT',
      is_featured: Boolean(carData.is_featured),
      is_verified: Boolean(carData.verification?.is_verified ?? true),
      inspection_score: carData.verification?.inspection_score || 95,
      verified_date: carData.verification?.verified_date || 'Oct 2026',
      verified_by: carData.verification?.verified_by || 'MANIFOLD Field Unit',
      dealer_id: carData.dealer?.id || 'dlr-partner-01',
      dealer_name: carData.dealer?.name || 'Prestige Motors Lekki',
      dealer_city: carData.dealer?.city || 'Lekki',
      dealer_state: carData.dealer?.state || 'Lagos',
      youtube_video_id: carData.video?.youtube_video_id || extractYouTubeVideoId(carData.video?.youtube_url || '') || '',
      youtube_url: carData.video?.youtube_url || '',
      youtube_thumbnail_url: carData.video?.youtube_thumbnail_url || '',
      gallery_image_1_url: carData.gallery_image_1_url || '',
      gallery_image_2_url: carData.gallery_image_2_url || '',
    };

    // 1. Insert into public.cars
    const { error: carError } = await supabase.from('cars').insert(carInsertRow);
    if (carError) {
      throw new Error(`Failed to create car in Supabase: ${carError.message}`);
    }

    // 2. Section 11: Save YouTube video to public.car_media
    if (carData.video?.youtube_url) {
      const vidId = carData.video.youtube_video_id || extractYouTubeVideoId(carData.video.youtube_url) || '';
      const thumb = carData.video.youtube_thumbnail_url || (vidId ? getYouTubeThumbnailUrl(vidId) : '');

      const { error: mediaErr } = await supabase.from('car_media').insert({
        id: `media-${id}-${Date.now()}`,
        car_id: id,
        media_type: 'youtube_video',
        video_type: carData.video.video_type || 'full_review',
        title: carData.video.video_title || `${title} Full Walkaround Review`,
        youtube_url: carData.video.youtube_url,
        youtube_video_id: vidId,
        youtube_thumbnail_url: thumb,
        description: carData.description || '',
        is_primary: true,
        status: 'published',
        sort_order: 1,
        duration: carData.video.video_duration || '12:00',
        presenter: carData.video.presenter_name || 'MANIFOLD Presenter',
      });
      if (mediaErr) {
        console.warn('Warning: car_media insert error:', mediaErr.message);
      }
    }

    // 3. Section 12: Save Gallery Images to public.car_images
    if (carData.gallery_image_1_url) {
      const { error: img1Err } = await supabase.from('car_images').insert({
        id: `img1-${id}-${Date.now()}`,
        car_id: id,
        image_url: carData.gallery_image_1_url,
        position: 1,
        is_primary: false,
      });
      if (img1Err) console.warn('Warning: car_images 1 insert error:', img1Err.message);
    }

    if (carData.gallery_image_2_url) {
      const { error: img2Err } = await supabase.from('car_images').insert({
        id: `img2-${id}-${Date.now()}`,
        car_id: id,
        image_url: carData.gallery_image_2_url,
        position: 2,
        is_primary: false,
      });
      if (img2Err) console.warn('Warning: car_images 2 insert error:', img2Err.message);
    }

    // Refresh database list
    await this.getCars();
    const created = await this.getCarById(id);
    if (!created) {
      throw new Error('Vehicle was created but could not be re-fetched from Supabase.');
    }
    return created;
  }

  /**
   * Section 9 & 10: UPDATE CAR in Supabase
   */
  public async updateCar(id: string, updates: Partial<Car>): Promise<Car> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Unable to update vehicle.');
    }

    const carUpdateRow: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) carUpdateRow.title = updates.title;
    if (updates.year !== undefined) carUpdateRow.year = updates.year;
    if (updates.make !== undefined) carUpdateRow.make = updates.make;
    if (updates.model !== undefined) carUpdateRow.model = updates.model;
    if (updates.trim !== undefined) {
      carUpdateRow.trim = updates.trim;
      carUpdateRow.variant = updates.trim;
    }
    if (updates.body_type !== undefined) carUpdateRow.body_type = updates.body_type;
    if (updates.condition !== undefined) carUpdateRow.condition = updates.condition;
    if (updates.price !== undefined) carUpdateRow.price = updates.price;
    if (updates.original_price !== undefined) {
      carUpdateRow.original_price = updates.original_price;
      carUpdateRow.previous_price = updates.original_price;
    }
    if (updates.mileage !== undefined) carUpdateRow.mileage = updates.mileage;
    if (updates.transmission !== undefined) carUpdateRow.transmission = updates.transmission;
    if (updates.fuel_type !== undefined) carUpdateRow.fuel_type = updates.fuel_type;
    if (updates.drive_type !== undefined) carUpdateRow.drive_type = updates.drive_type;
    if (updates.engine !== undefined) carUpdateRow.engine = updates.engine;
    if (updates.horsepower !== undefined) carUpdateRow.horsepower = updates.horsepower;
    if (updates.exterior_color !== undefined) carUpdateRow.exterior_color = updates.exterior_color;
    if (updates.interior_color !== undefined) carUpdateRow.interior_color = updates.interior_color;
    if (updates.seats !== undefined) carUpdateRow.seats = updates.seats;
    if (updates.doors !== undefined) carUpdateRow.doors = updates.doors;
    if (updates.location !== undefined) carUpdateRow.location = updates.location;
    if (updates.state !== undefined) carUpdateRow.state = updates.state;
    if (updates.description !== undefined) carUpdateRow.description = updates.description;
    if (updates.status !== undefined) carUpdateRow.status = updates.status;
    if (updates.is_featured !== undefined) carUpdateRow.is_featured = updates.is_featured;
    if (updates.verification?.is_verified !== undefined) carUpdateRow.is_verified = updates.verification.is_verified;
    if (updates.gallery_image_1_url !== undefined) carUpdateRow.gallery_image_1_url = updates.gallery_image_1_url;
    if (updates.gallery_image_2_url !== undefined) carUpdateRow.gallery_image_2_url = updates.gallery_image_2_url;

    if (updates.video) {
      const vidId = updates.video.youtube_video_id || extractYouTubeVideoId(updates.video.youtube_url || '') || '';
      carUpdateRow.youtube_video_id = vidId;
      carUpdateRow.youtube_url = updates.video.youtube_url;
      carUpdateRow.youtube_thumbnail_url = updates.video.youtube_thumbnail_url || (vidId ? getYouTubeThumbnailUrl(vidId) : '');
    }

    // 1. Update public.cars
    const { error: carErr } = await supabase.from('cars').update(carUpdateRow).eq('id', id);
    if (carErr) {
      throw new Error(`Failed to update car in Supabase: ${carErr.message}`);
    }

    // 2. Section 11: Update or Insert into public.car_media
    if (updates.video?.youtube_url) {
      const vidId = updates.video.youtube_video_id || extractYouTubeVideoId(updates.video.youtube_url) || '';
      const thumb = updates.video.youtube_thumbnail_url || (vidId ? getYouTubeThumbnailUrl(vidId) : '');

      // Delete existing primary video and insert clean record
      await supabase.from('car_media').delete().eq('car_id', id).eq('media_type', 'youtube_video');
      await supabase.from('car_media').insert({
        id: `media-${id}-${Date.now()}`,
        car_id: id,
        media_type: 'youtube_video',
        video_type: updates.video.video_type || 'full_review',
        title: updates.video.video_title || 'Vehicle Full Review',
        youtube_url: updates.video.youtube_url,
        youtube_video_id: vidId,
        youtube_thumbnail_url: thumb,
        description: updates.description || '',
        is_primary: true,
        status: 'published',
        sort_order: 1,
        duration: updates.video.video_duration || '12:00',
        presenter: updates.video.presenter_name || 'MANIFOLD Presenter',
      });
    }

    // 3. Section 12: Update Gallery Images (Position 1 & 2) in public.car_images
    if (updates.gallery_image_1_url !== undefined) {
      await supabase.from('car_images').delete().eq('car_id', id).eq('position', 1);
      if (updates.gallery_image_1_url) {
        await supabase.from('car_images').insert({
          id: `img1-${id}-${Date.now()}`,
          car_id: id,
          image_url: updates.gallery_image_1_url,
          position: 1,
          is_primary: false,
        });
      }
    }

    if (updates.gallery_image_2_url !== undefined) {
      await supabase.from('car_images').delete().eq('car_id', id).eq('position', 2);
      if (updates.gallery_image_2_url) {
        await supabase.from('car_images').insert({
          id: `img2-${id}-${Date.now()}`,
          car_id: id,
          image_url: updates.gallery_image_2_url,
          position: 2,
          is_primary: false,
        });
      }
    }

    // Refresh database list
    await this.getCars();
    const updated = await this.getCarById(id);
    if (!updated) {
      throw new Error(`Vehicle ${id} updated, but could not be reloaded.`);
    }
    return updated;
  }

  /**
   * Section 9: DELETE / ARCHIVE CAR
   */
  public async deleteCar(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase.from('cars').delete().eq('id', id);
    if (error) {
      throw new Error(`Failed to delete car from Supabase: ${error.message}`);
    }

    await this.getCars();
    return true;
  }

  public async archiveCar(id: string): Promise<Car> {
    return this.updateCar(id, { status: 'ARCHIVED' });
  }

  public async duplicateCar(id: string): Promise<Car> {
    const source = await this.getCarById(id);
    if (!source) {
      throw new Error(`Source vehicle ${id} not found in Supabase.`);
    }

    const duplicateData: Partial<Car> = {
      ...source,
      id: `car-${Date.now()}`,
      title: `${source.title} (Copy)`,
      status: 'DRAFT',
      is_featured: false,
      views_count: 0,
    };

    return this.createCar(duplicateData);
  }

  public subscribe(listener: CarChangeListener): () => void {
    this.listeners.add(listener);
    if (this.hasLoaded) {
      listener([...this.cache]);
    } else {
      this.getCars().catch(() => {});
    }
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const list = [...this.cache];
    this.listeners.forEach((listener) => {
      try {
        listener(list);
      } catch (e) {
        console.error('CarService subscriber error:', e);
      }
    });
  }
}

export const carService = new CarService();
