import { Car } from '../types';
import { supabase, isSupabaseConfigured, getSupabaseConfig } from '../lib/supabase';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl, formatStandardYouTubeUrl } from '../utils/youtube';
import { buildVehicleModelTitle, generateUuid, normalizeVehicleCondition } from '../utils/carMedia';
import { isApprovedVehicleImageUrl } from '../utils/vehicleImageUrl';
import { brandService } from './brandService';
import { categoryService } from './categoryService';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_DEALER_SELECT_CANDIDATES = [
  'id, business_name, slug, city, state, is_verified, dealer_status, joined_year',
  'id, name, business_name, slug, city, state, is_verified, dealer_status, joined_year',
  'id, business_name, slug, city, state, is_verified, joined_year',
  'id, name, slug, city, state, is_verified, joined_year',
];
let resolvedCarDealerSelect: string | null = null;

type CarChangeListener = (cars: Car[]) => void;

export interface CarServiceLoadState {
  hasLoaded: boolean;
  loading: boolean;
  error: string | null;
}

type LoadStateListener = (state: CarServiceLoadState) => void;

export function isPublicMarketplaceCar(car: Pick<Car, 'status'>): boolean {
  const statusUpper = String(car.status || '').trim().toUpperCase();
  return statusUpper === 'PUBLISHED';
}

export function sanitizePublicDealerRow(raw: any): any | null {
  if (!raw || typeof raw !== 'object') return null;
  const {
    phone: _p,
    email: _e,
    address: _a,
    address_line_1: _a1,
    address_line_2: _a2,
    cac_registration_number: _cac,
    ...safeRest
  } = raw;
  return safeRest;
}

export function formatCarQueryError(prefix: string, error: any): string {
  if (!error) return prefix;
  const code = error?.code ? `[${error.code}] ` : '';
  const msg = String(error?.message || error || 'Unknown error');
  const details = error?.details ? ` | ${error.details}` : '';
  const hint = error?.hint ? ` (Hint: ${error.hint})` : '';
  return `${prefix}: ${code}${msg}${details}${hint}`;
}

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

  // 2. Resolve Gallery Images from joined car_images (position 1 & 2) and filter untrusted URLs
  let gallery1 = row.gallery_image_1_url || '';
  let gallery2 = row.gallery_image_2_url || '';

  if (Array.isArray(row.car_images) && row.car_images.length > 0) {
    const img1 = row.car_images.find((img: any) => img.position === 1);
    const img2 = row.car_images.find((img: any) => img.position === 2);
    if (img1 && img1.image_url) gallery1 = img1.image_url;
    if (img2 && img2.image_url) gallery2 = img2.image_url;
  }

  const configuredSupabaseUrl = getSupabaseConfig().url || null;
  if (gallery1 && !isApprovedVehicleImageUrl(gallery1, configuredSupabaseUrl)) {
    gallery1 = '';
  }
  if (gallery2 && !isApprovedVehicleImageUrl(gallery2, configuredSupabaseUrl)) {
    gallery2 = '';
  }

  // 3. Resolve Dealer info (strictly public fields only — never expose phone/email/address)
  const safeJoinedDealer = sanitizePublicDealerRow(row.dealers);
  const dealerObj = safeJoinedDealer
    ? {
        id: String(safeJoinedDealer.id || row.dealer_id || 'dlr-partner-01'),
        name:
          safeJoinedDealer.business_name ||
          safeJoinedDealer.name ||
          row.dealer_name ||
          'MANIFOLD Partner Dealership',
        city: safeJoinedDealer.city || row.dealer_city || 'Lekki',
        state: safeJoinedDealer.state || row.dealer_state || 'Lagos',
        verified_partner:
          safeJoinedDealer.dealer_status === 'disapproved' ||
          safeJoinedDealer.dealer_status === 'suspended'
            ? false
            : Boolean(safeJoinedDealer.is_verified ?? safeJoinedDealer.verified_partner ?? false),
        joined_year: safeJoinedDealer.joined_year || 2024,
      }
    : {
        id: String(row.dealer_id || 'dlr-partner-01'),
        name: row.dealer_name || 'MANIFOLD Partner Dealership',
        city: row.dealer_city || 'Lekki',
        state: row.dealer_state || 'Lagos',
        verified_partner: false,
        joined_year: 2024,
      };

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    year: Number(row.year) || 2024,
    brand_id: row.brand_id ?? null,
    make: row.make || row.car_brands?.name || 'Vehicle',
    model: row.model || 'Model',
    trim: row.trim || row.variant || '',
    type_id: row.type_id ?? null,
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
      is_verified: Boolean(row.is_verified ?? false),
      dealer_verified: Boolean(dealerObj.verified_partner),
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
  private loadStateListeners: Set<LoadStateListener> = new Set();
  private hasLoaded = false;
  private loading = false;
  private lastError: string | null = null;
  private authWatcherBound = false;
  private inflightFetch: Promise<Car[]> | null = null;

  constructor() {
    this.ensureAuthWatcher();
  }

  private ensureAuthWatcher() {
    if (this.authWatcherBound || !isSupabaseConfigured || typeof window === 'undefined') return;
    this.authWatcherBound = true;
    try {
      supabase.auth.onAuthStateChange((event) => {
        if (
          event === 'SIGNED_IN' ||
          event === 'SIGNED_OUT' ||
          event === 'TOKEN_REFRESHED'
        ) {
          this.getCars().catch(() => {});
        }
      });
    } catch {
      // ignore in non-browser/test environments
    }
  }

  private async enrichCarsFromSeparateTables(rawCarRows: any[]): Promise<any[]> {
    if (!Array.isArray(rawCarRows) || rawCarRows.length === 0) return [];

    const carIds = Array.from(
      new Set(rawCarRows.map((r) => String(r.id || '')).filter(Boolean))
    );
    const dealerIds = Array.from(
      new Set(rawCarRows.map((r) => String(r.dealer_id || '')).filter(Boolean))
    );

    const fetchSafeDealers = async () => {
      if (dealerIds.length === 0) return { data: [], error: null };
      const candidates = resolvedCarDealerSelect
        ? [
            resolvedCarDealerSelect,
            ...PUBLIC_DEALER_SELECT_CANDIDATES.filter((c) => c !== resolvedCarDealerSelect),
          ]
        : PUBLIC_DEALER_SELECT_CANDIDATES;
      let res: any = { data: [], error: null };
      for (const cols of candidates) {
        res = await supabase.from('dealers').select(cols).in('id', dealerIds);
        if (!res.error) {
          resolvedCarDealerSelect = cols;
          break;
        }
        if (res.error?.code !== '42703') break;
      }
      return res;
    };

    const [mediaSettled, imagesSettled, dealersSettled] = await Promise.allSettled([
      carIds.length > 0
        ? supabase.from('car_media').select('*').in('car_id', carIds)
        : Promise.resolve({ data: [], error: null }),
      carIds.length > 0
        ? supabase.from('car_images').select('*').in('car_id', carIds)
        : Promise.resolve({ data: [], error: null }),
      fetchSafeDealers(),
    ]);

    const mediaRows =
      mediaSettled.status === 'fulfilled' && Array.isArray(mediaSettled.value?.data)
        ? mediaSettled.value.data
        : [];
    const imageRows =
      imagesSettled.status === 'fulfilled' && Array.isArray(imagesSettled.value?.data)
        ? imagesSettled.value.data
        : [];
    const dealerRows =
      dealersSettled.status === 'fulfilled' && Array.isArray(dealersSettled.value?.data)
        ? dealersSettled.value.data
        : [];

    const mediaByCar = new Map<string, any[]>();
    mediaRows.forEach((m: any) => {
      const key = String(m.car_id || '');
      if (!key) return;
      const list = mediaByCar.get(key) || [];
      list.push(m);
      mediaByCar.set(key, list);
    });

    const imagesByCar = new Map<string, any[]>();
    imageRows.forEach((img: any) => {
      const key = String(img.car_id || '');
      if (!key) return;
      const list = imagesByCar.get(key) || [];
      list.push(img);
      imagesByCar.set(key, list);
    });

    const dealerById = new Map<string, any>();
    dealerRows.forEach((d: any) => {
      if (d?.id) {
        dealerById.set(String(d.id), sanitizePublicDealerRow(d));
      }
    });

    return rawCarRows.map((row) => ({
      ...row,
      car_media: Array.isArray(row.car_media)
        ? row.car_media
        : mediaByCar.get(String(row.id)) || [],
      car_images: Array.isArray(row.car_images)
        ? row.car_images
        : imagesByCar.get(String(row.id)) || [],
      dealers: row.dealers
        ? sanitizePublicDealerRow(row.dealers)
        : row.dealer_id
        ? dealerById.get(String(row.dealer_id)) || null
        : null,
    }));
  }

  public getLoadState(): CarServiceLoadState {
    return {
      hasLoaded: this.hasLoaded,
      loading: this.loading,
      error: this.lastError,
    };
  }

  public subscribeLoadState(listener: LoadStateListener): () => void {
    this.loadStateListeners.add(listener);
    listener(this.getLoadState());
    return () => this.loadStateListeners.delete(listener);
  }

  private notifyLoadState(): void {
    const state = this.getLoadState();
    this.loadStateListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (e) {
        console.error('CarService load-state listener error:', e);
      }
    });
  }

  private async fetchPublicCarsViaApi(): Promise<any[]> {
    const res = await fetch('/api/cars', {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const errMsg = body?.error
        ? formatCarQueryError('Unable to load public vehicle inventory', body)
        : `Unable to load public vehicle inventory (HTTP ${res.status})`;
      throw new Error(errMsg);
    }
    return Array.isArray(body?.cars) ? body.cars : [];
  }

  private async fetchPublicCarViaApi(slugOrId: string): Promise<any | null> {
    const res = await fetch(`/api/cars/${encodeURIComponent(slugOrId)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return null;
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const errMsg = body?.error
        ? formatCarQueryError('Unable to load vehicle', body)
        : `Unable to load vehicle (HTTP ${res.status})`;
      throw new Error(errMsg);
    }
    return body?.car || null;
  }

  public async getCars(): Promise<Car[]> {
    if (this.inflightFetch) {
      return this.inflightFetch;
    }

    this.loading = true;
    this.lastError = null;
    this.notifyLoadState();

    this.inflightFetch = (async () => {
      try {
        let resolvedRows: any[] | null = null;

        if (!isSupabaseConfigured) {
          // Browser has no VITE_SUPABASE_* / localStorage config (e.g. incognito / new device):
          // load shared public inventory from /api/cars instead of failing.
          resolvedRows = await this.fetchPublicCarsViaApi();
        } else {
          // 1. Primary relational query with non-PII dealer projection
          const candidates = resolvedCarDealerSelect
            ? [
                resolvedCarDealerSelect,
                ...PUBLIC_DEALER_SELECT_CANDIDATES.filter((c) => c !== resolvedCarDealerSelect),
              ]
            : PUBLIC_DEALER_SELECT_CANDIDATES;
          let primary: any = { data: null, error: null };
          for (const cols of candidates) {
            primary = await supabase
              .from('cars')
              .select(`
                *,
                car_media (*),
                car_images (*),
                dealers (${cols})
              `)
              .order('created_at', { ascending: false });
            if (!primary.error) {
              resolvedCarDealerSelect = cols;
              break;
            }
            if (primary.error?.code !== '42703') break;
          }

          if (!primary.error && Array.isArray(primary.data)) {
            resolvedRows = primary.data;
          } else {
            // 2. Fallback when relational FKs or join permissions fail (e.g. PGRST200)
            console.warn(
              '[carService] Relational cars query failed; falling back to decoupled table fetch:',
              primary.error?.message
            );
            let fallbackQuery = await supabase
              .from('cars')
              .select('*')
              .order('created_at', { ascending: false });

            if (fallbackQuery.error?.code === '42703') {
              fallbackQuery = await supabase.from('cars').select('*');
            }

            if (fallbackQuery.error) {
              throw new Error(
                formatCarQueryError('Unable to load vehicle inventory', fallbackQuery.error)
              );
            }

            resolvedRows = await this.enrichCarsFromSeparateTables(fallbackQuery.data || []);
          }
        }

        this.cache = (resolvedRows || []).map(mapSupabaseToCar);
        this.hasLoaded = true;
        this.loading = false;
        this.lastError = null;
        this.notify();
        this.notifyLoadState();
        return [...this.cache];
      } catch (err: any) {
        this.hasLoaded = true;
        this.loading = false;
        this.lastError = err?.message || 'Unable to load vehicle inventory.';
        this.notifyLoadState();
        throw err;
      } finally {
        this.inflightFetch = null;
      }
    })();

    return this.inflightFetch;
  }

  public getCarsSync(): Car[] {
    return [...this.cache];
  }

  public async getCarById(id: string): Promise<Car | null> {
    if (!isSupabaseConfigured) {
      const apiRow = await this.fetchPublicCarViaApi(id);
      return apiRow ? mapSupabaseToCar(apiRow) : null;
    }

    const candidates = resolvedCarDealerSelect
      ? [
          resolvedCarDealerSelect,
          ...PUBLIC_DEALER_SELECT_CANDIDATES.filter((c) => c !== resolvedCarDealerSelect),
        ]
      : PUBLIC_DEALER_SELECT_CANDIDATES;

    let primary: any = { data: null, error: null };
    for (const cols of candidates) {
      primary = await supabase
        .from('cars')
        .select(`
          *,
          car_media (*),
          car_images (*),
          dealers (${cols})
        `)
        .eq('id', id)
        .maybeSingle();
      if (!primary.error) {
        resolvedCarDealerSelect = cols;
        break;
      }
      if (primary.error?.code !== '42703') break;
    }

    if (!primary.error) {
      return primary.data ? mapSupabaseToCar(primary.data) : null;
    }

    const fallback = await supabase.from('cars').select('*').eq('id', id).maybeSingle();
    if (fallback.error) {
      throw new Error(formatCarQueryError('Failed to load vehicle', fallback.error));
    }
    if (!fallback.data) return null;
    const [enriched] = await this.enrichCarsFromSeparateTables([fallback.data]);
    return enriched ? mapSupabaseToCar(enriched) : null;
  }

  public async getCarBySlug(slug: string): Promise<Car | null> {
    if (!isSupabaseConfigured) {
      const apiRow = await this.fetchPublicCarViaApi(slug);
      return apiRow ? mapSupabaseToCar(apiRow) : null;
    }

    const candidates = resolvedCarDealerSelect
      ? [
          resolvedCarDealerSelect,
          ...PUBLIC_DEALER_SELECT_CANDIDATES.filter((c) => c !== resolvedCarDealerSelect),
        ]
      : PUBLIC_DEALER_SELECT_CANDIDATES;

    let primary: any = { data: null, error: null };
    for (const cols of candidates) {
      primary = await supabase
        .from('cars')
        .select(`
          *,
          car_media (*),
          car_images (*),
          dealers (${cols})
        `)
        .eq('slug', slug)
        .maybeSingle();
      if (!primary.error) {
        resolvedCarDealerSelect = cols;
        break;
      }
      if (primary.error?.code !== '42703') break;
    }

    if (!primary.error) {
      return primary.data ? mapSupabaseToCar(primary.data) : null;
    }

    const fallback = await supabase.from('cars').select('*').eq('slug', slug).maybeSingle();
    if (fallback.error) {
      throw new Error(formatCarQueryError('Failed to load vehicle', fallback.error));
    }
    if (!fallback.data) return null;
    const [enriched] = await this.enrichCarsFromSeparateTables([fallback.data]);
    return enriched ? mapSupabaseToCar(enriched) : null;
  }

  /**
   * Section 9 & 10: CREATE CAR in Supabase
   * Saves to public.cars, public.car_media, public.car_images
   */
  public async createCar(carData: Partial<Car>): Promise<Car> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Unable to persist vehicle.');
    }

    const id = carData.id && UUID_REGEX.test(carData.id) ? carData.id : generateUuid();
    const canonicalTitle = buildVehicleModelTitle(carData.make || 'Toyota', carData.model || 'Model');
    const title = carData.title?.trim() || canonicalTitle;
    const slugBase = (carData.slug || `${carData.year || ''}-${canonicalTitle}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'vehicle';
    const slug = `${slugBase}-${id.slice(0, 8)}`;

    const resolveBrandUuid = async (): Promise<string | null> => {
      if (carData.brand_id && UUID_REGEX.test(carData.brand_id)) return carData.brand_id;
      if (carData.make) {
        const b = await brandService.getBrandByName(carData.make);
        if (b && UUID_REGEX.test(b.id)) return b.id;
      }
      return null;
    };

    const [resolvedBrandId, resolvedTypeId] = await Promise.all([
      resolveBrandUuid(),
      categoryService.resolveTypeId(carData.type_id, carData.body_type),
    ]);

    const carInsertRow = {
      id,
      slug,
      title,
      year: carData.year || 2024,
      brand_id: resolvedBrandId,
      make: carData.make || 'Toyota',
      model: carData.model || 'Model',
      variant: carData.trim || 'Standard',
      trim: carData.trim || 'Standard',
      type_id: resolvedTypeId,
      body_type: carData.body_type || 'SUV',
      condition: normalizeVehicleCondition(carData.condition),
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
        id: generateUuid(),
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
        id: generateUuid(),
        car_id: id,
        image_url: carData.gallery_image_1_url,
        position: 1,
        is_primary: false,
      });
      if (img1Err) console.warn('Warning: car_images 1 insert error:', img1Err.message);
    }

    if (carData.gallery_image_2_url) {
      const { error: img2Err } = await supabase.from('car_images').insert({
        id: generateUuid(),
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
    if (updates.brand_id !== undefined || updates.make !== undefined) {
      if (updates.brand_id && UUID_REGEX.test(updates.brand_id)) {
        carUpdateRow.brand_id = updates.brand_id;
      } else if (updates.make) {
        const b = await brandService.getBrandByName(updates.make);
        carUpdateRow.brand_id = b && UUID_REGEX.test(b.id) ? b.id : null;
      } else {
        carUpdateRow.brand_id = null;
      }
    }
    if (updates.model !== undefined) carUpdateRow.model = updates.model;
    if (updates.trim !== undefined) {
      carUpdateRow.trim = updates.trim;
      carUpdateRow.variant = updates.trim;
    }
    if (updates.body_type !== undefined) carUpdateRow.body_type = updates.body_type;
    if (updates.type_id !== undefined || updates.body_type !== undefined) {
      carUpdateRow.type_id = await categoryService.resolveTypeId(updates.type_id, updates.body_type);
    }
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

    // 2. Section 11: Update or Insert into public.car_media (or remove if cleared)
    if (updates.video !== undefined) {
      await supabase.from('car_media').delete().eq('car_id', id).eq('media_type', 'youtube_video');
    }
    if (updates.video?.youtube_url) {
      const vidId = updates.video.youtube_video_id || extractYouTubeVideoId(updates.video.youtube_url) || '';
      const thumb = updates.video.youtube_thumbnail_url || (vidId ? getYouTubeThumbnailUrl(vidId) : '');

      // Delete existing primary video and insert clean record
      await supabase.from('car_media').delete().eq('car_id', id).eq('media_type', 'youtube_video');
      await supabase.from('car_media').insert({
        id: generateUuid(),
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
          id: generateUuid(),
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
          id: generateUuid(),
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
      id: generateUuid(),
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
