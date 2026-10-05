import { Car } from '../types';
import { MOCK_CARS } from '../data/mockCars';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

const CARS_STORAGE_KEY = 'manifold_inventory_cars_v1';

type CarChangeListener = (cars: Car[]) => void;

function carToSupabaseRow(car: Car) {
  return {
    id: car.id,
    slug: car.slug,
    title: car.title,
    year: car.year,
    make: car.make,
    model: car.model,
    trim: car.trim,
    body_type: car.body_type,
    condition: car.condition,
    price: car.price,
    original_price: car.original_price,
    is_price_reduced: car.is_price_reduced,
    location: car.location,
    state: car.state,
    mileage: car.mileage,
    transmission: car.transmission,
    fuel_type: car.fuel_type,
    drive_type: car.drive_type,
    engine: car.engine,
    horsepower: car.horsepower,
    exterior_color: car.exterior_color,
    interior_color: car.interior_color,
    seats: car.seats,
    doors: car.doors,
    is_featured: car.is_featured,
    status: car.status,
    views_count: car.views_count,
    description: car.description,
    features: car.features,
    youtube_video_id: car.video?.youtube_video_id,
    youtube_url: car.video?.youtube_url,
    youtube_thumbnail_url: car.video?.youtube_thumbnail_url,
    video_title: car.video?.video_title,
    video_duration: car.video?.video_duration,
    video_type: car.video?.video_type,
    video_presenter: car.video?.presenter_name,
    gallery_image_1_url: car.gallery_image_1_url,
    gallery_image_2_url: car.gallery_image_2_url,
    is_verified: car.verification?.is_verified,
    inspection_score: car.verification?.inspection_score,
    verified_date: car.verification?.verified_date,
    verified_by: car.verification?.verified_by,
    dealer_id: car.dealer?.id,
    dealer_name: car.dealer?.name,
    dealer_city: car.dealer?.city,
    dealer_state: car.dealer?.state,
  };
}

function supabaseRowToCar(row: any): Car {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    year: row.year,
    make: row.make,
    model: row.model,
    trim: row.trim || '',
    body_type: row.body_type || 'SUV',
    condition: row.condition || 'Foreign Used',
    price: Number(row.price),
    original_price: row.original_price ? Number(row.original_price) : undefined,
    is_price_reduced: !!row.is_price_reduced,
    location: row.location,
    state: row.state || 'Lagos',
    mileage: Number(row.mileage) || 0,
    transmission: row.transmission || 'Automatic',
    fuel_type: row.fuel_type || 'Petrol',
    drive_type: row.drive_type || 'AWD',
    engine: row.engine || '',
    horsepower: row.horsepower ? Number(row.horsepower) : undefined,
    exterior_color: row.exterior_color || '',
    interior_color: row.interior_color || '',
    seats: Number(row.seats) || 5,
    doors: Number(row.doors) || 4,
    is_featured: !!row.is_featured,
    status: row.status || 'PUBLISHED',
    views_count: Number(row.views_count) || 0,
    created_at: row.created_at || new Date().toISOString(),
    description: row.description || '',
    features: Array.isArray(row.features) ? row.features : [],
    video: {
      youtube_video_id: row.youtube_video_id || '',
      youtube_url: row.youtube_url || '',
      youtube_thumbnail_url: row.youtube_thumbnail_url || '',
      video_title: row.video_title || row.title,
      video_duration: row.video_duration || '12:00',
      video_type: row.video_type || 'full_review',
      is_primary: true,
      presenter_name: row.video_presenter || 'MANIFOLD Presenter',
    },
    gallery_image_1_url: row.gallery_image_1_url || '',
    gallery_image_2_url: row.gallery_image_2_url || '',
    verification: {
      is_verified: !!row.is_verified,
      dealer_verified: !!row.is_verified,
      vehicle_physically_seen: !!row.is_verified,
      video_reviewed: !!row.youtube_video_id,
      price_confirmed: true,
      vin_checked: !!row.is_verified,
      inspection_score: Number(row.inspection_score) || 95,
      verified_date: row.verified_date || 'Oct 2026',
      verified_by: row.verified_by || 'MANIFOLD Field Unit',
    },
    dealer: {
      id: row.dealer_id || 'dlr-partner-01',
      name: row.dealer_name || 'MANIFOLD Partner Dealer',
      city: row.dealer_city || 'Lekki',
      state: row.dealer_state || 'Lagos',
      verified_partner: true,
      joined_year: 2023,
    },
  };
}

class CarService {
  private cars: Car[] = [];
  private listeners: Set<CarChangeListener> = new Set();
  private initialized = false;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initialized) return;

    // 1. Try local storage cache first for instant UI response
    try {
      const stored = localStorage.getItem(CARS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.cars = parsed;
          this.initialized = true;
        }
      }
    } catch (e) {
      console.warn('Failed to load cars from localStorage', e);
    }

    if (!this.initialized) {
      this.cars = [...MOCK_CARS];
      this.saveToStorage();
      this.initialized = true;
    }

    // 2. If Supabase is configured, sync in background
    if (isSupabaseConfigured()) {
      this.syncFromSupabase();
    }
  }

  public async syncFromSupabase(): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase car fetch error:', error.message);
        return false;
      }

      if (data && data.length > 0) {
        this.cars = data.map(supabaseRowToCar);
        this.saveToStorage();
        return true;
      } else if (data && data.length === 0 && this.cars.length > 0) {
        // Table exists but is empty - push local cars to seed Supabase
        await this.pushAllToSupabase();
        return true;
      }
    } catch (e) {
      console.warn('Failed to sync from Supabase', e);
    }
    return false;
  }

  public async pushAllToSupabase(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase || this.cars.length === 0) return;

    try {
      const rows = this.cars.map(carToSupabaseRow);
      await supabase.from('cars').upsert(rows, { onConflict: 'id' });
    } catch (e) {
      console.warn('Failed to push seed to Supabase', e);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(CARS_STORAGE_KEY, JSON.stringify(this.cars));
    } catch (e) {
      console.warn('Failed to save cars to localStorage', e);
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener([...this.cars]);
      } catch (e) {
        console.error('CarService listener error', e);
      }
    });
  }

  public async getCars(): Promise<Car[]> {
    this.init();
    return [...this.cars];
  }

  public getCarsSync(): Car[] {
    this.init();
    return [...this.cars];
  }

  public async getCarById(id: string): Promise<Car | null> {
    this.init();
    const found = this.cars.find((c) => c.id === id);
    return found ? { ...found } : null;
  }

  public async getCarBySlug(slug: string): Promise<Car | null> {
    this.init();
    const found = this.cars.find((c) => c.slug === slug);
    return found ? { ...found } : null;
  }

  public async createCar(carData: Partial<Car>): Promise<Car> {
    this.init();

    const title = carData.title || `${carData.year || 2024} ${carData.make || 'Toyota'} ${carData.model || 'Model'}`;
    const id = carData.id || `car-${Date.now()}`;
    const slugBase = (carData.slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slug = `${slugBase}-${Date.now().toString(36).substring(0, 4)}`;

    const newCar: Car = {
      id,
      slug: carData.slug || slug,
      title,
      year: carData.year || 2024,
      make: carData.make || 'Toyota',
      model: carData.model || 'Model',
      trim: carData.trim || 'Standard',
      body_type: carData.body_type || 'SUV',
      condition: carData.condition || 'Foreign Used',
      price: carData.price || 0,
      original_price: carData.original_price,
      is_price_reduced: !!carData.is_price_reduced,
      location: carData.location || 'Lekki Phase 1, Lagos',
      state: carData.state || 'Lagos',
      mileage: carData.mileage || 0,
      transmission: carData.transmission || 'Automatic',
      fuel_type: carData.fuel_type || 'Petrol',
      drive_type: carData.drive_type || 'AWD',
      engine: carData.engine || '3.5L V6',
      horsepower: carData.horsepower,
      exterior_color: carData.exterior_color || 'Metallic Black',
      interior_color: carData.interior_color || 'Black Leather',
      seats: carData.seats || 5,
      doors: carData.doors || 4,
      is_featured: !!carData.is_featured,
      status: carData.status || 'DRAFT',
      views_count: carData.views_count || 0,
      created_at: carData.created_at || new Date().toISOString(),
      description: carData.description || '',
      features: carData.features || [],
      video: carData.video || {
        youtube_video_id: '',
        youtube_url: '',
        youtube_thumbnail_url: '',
        video_title: '',
        video_duration: '',
        video_type: 'full_review',
        is_primary: true,
        presenter_name: 'MANIFOLD Presenter',
      },
      gallery_image_1_url: carData.gallery_image_1_url || '',
      gallery_image_2_url: carData.gallery_image_2_url || '',
      additional_images: carData.additional_images || [],
      verification: carData.verification || {
        is_verified: true,
        dealer_verified: true,
        vehicle_physically_seen: true,
        video_reviewed: true,
        price_confirmed: true,
        vin_checked: true,
        inspection_score: 95,
        verified_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        verified_by: 'MANIFOLD Field Unit',
      },
      dealer: carData.dealer || {
        id: 'dlr-partner-01',
        name: 'MANIFOLD Verified Partner Dealership',
        city: 'Lekki',
        state: 'Lagos',
        verified_partner: true,
        joined_year: 2024,
      },
    };

    this.cars.unshift(newCar);
    this.saveToStorage();

    // Persist to Supabase if configured
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('cars').insert(carToSupabaseRow(newCar));
      } catch (e) {
        console.warn('Failed to insert car to Supabase', e);
      }
    }

    return { ...newCar };
  }

  public async updateCar(id: string, updates: Partial<Car>): Promise<Car> {
    this.init();
    const index = this.cars.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error(`Vehicle with ID ${id} not found.`);
    }

    const existing = this.cars[index];
    const updated: Car = {
      ...existing,
      ...updates,
      id: existing.id, // prevent ID change
      video: {
        ...existing.video,
        ...(updates.video || {}),
      },
      verification: {
        ...existing.verification,
        ...(updates.verification || {}),
      },
      dealer: {
        ...existing.dealer,
        ...(updates.dealer || {}),
      },
    };

    this.cars[index] = updated;
    this.saveToStorage();

    // Persist to Supabase if configured
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('cars').upsert(carToSupabaseRow(updated));
      } catch (e) {
        console.warn('Failed to update car in Supabase', e);
      }
    }

    return { ...updated };
  }

  public async deleteCar(id: string): Promise<boolean> {
    this.init();
    const index = this.cars.findIndex((c) => c.id === id);
    if (index === -1) return false;
    this.cars.splice(index, 1);
    this.saveToStorage();

    // Persist to Supabase if configured
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('cars').delete().eq('id', id);
      } catch (e) {
        console.warn('Failed to delete car from Supabase', e);
      }
    }

    return true;
  }

  public async duplicateCar(id: string): Promise<Car> {
    this.init();
    const source = this.cars.find((c) => c.id === id);
    if (!source) {
      throw new Error(`Vehicle with ID ${id} not found.`);
    }

    const duplicateTitle = `${source.title} (Copy)`;
    const newId = `car-${Date.now()}`;
    const slugBase = duplicateTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slug = `${slugBase}-${Date.now().toString(36).substring(0, 4)}`;

    const duplicated: Car = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      slug,
      title: duplicateTitle,
      status: 'DRAFT', // Always DRAFT on duplicate
      is_featured: false,
      created_at: new Date().toISOString(),
      views_count: 0,
    };

    this.cars.unshift(duplicated);
    this.saveToStorage();

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('cars').insert(carToSupabaseRow(duplicated));
      } catch (e) {
        console.warn('Failed to insert duplicated car to Supabase', e);
      }
    }

    return { ...duplicated };
  }

  public subscribe(listener: CarChangeListener): () => void {
    this.listeners.add(listener);
    listener([...this.cars]);
    return () => this.listeners.delete(listener);
  }

  public resetToDefault(): void {
    this.cars = [...MOCK_CARS];
    this.saveToStorage();
  }
}

export const carService = new CarService();
