import { Car } from '../types';
import { MOCK_CARS } from '../data/mockCars';

const CARS_STORAGE_KEY = 'manifold_inventory_cars_v1';

type CarChangeListener = (cars: Car[]) => void;

class CarService {
  private cars: Car[] = [];
  private listeners: Set<CarChangeListener> = new Set();
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    try {
      const stored = localStorage.getItem(CARS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.cars = parsed;
          this.initialized = true;
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load cars from localStorage, using mock data', e);
    }

    // Default seed
    this.cars = [...MOCK_CARS];
    this.saveToStorage();
    this.initialized = true;
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
    return { ...updated };
  }

  public async deleteCar(id: string): Promise<boolean> {
    this.init();
    const index = this.cars.findIndex((c) => c.id === id);
    if (index === -1) return false;
    this.cars.splice(index, 1);
    this.saveToStorage();
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
