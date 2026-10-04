export type ListingStatus = 'PUBLISHED' | 'DRAFT' | 'PENDING' | 'ARCHIVED' | 'SOLD' | 'RESERVED';

export type UserRole = 'ADMIN' | 'EDITOR' | 'INSPECTOR' | 'CONTENT_MANAGER';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  last_sign_in?: string;
}

export interface CarVideo {
  youtube_video_id: string;
  youtube_url: string;
  youtube_thumbnail_url: string;
  video_title: string;
  video_duration: string;
  video_type: 'full_review' | 'walkaround' | 'car_hunt';
  is_primary: boolean;
  presenter_name?: string;
}

export interface VehicleVerification {
  is_verified: boolean;
  dealer_verified: boolean;
  vehicle_physically_seen: boolean;
  video_reviewed: boolean;
  price_confirmed: boolean;
  vin_checked: boolean;
  inspection_score?: number; // e.g. 94/100
  verified_date?: string;
  verified_by?: string;
}

export interface DealerInfo {
  id: string;
  name: string; // e.g. "Apex Motors Lekki"
  city: string;
  state: string; // "Lagos", "Abuja"
  verified_partner: boolean;
  joined_year: number;
}

export interface Car {
  id: string;
  slug: string;
  title: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  body_type: 'SUV' | 'Sedan' | 'Hatchback' | 'Pickup' | 'Coupe' | 'Van' | 'Truck' | 'Luxury';
  condition: 'Foreign Used' | 'Brand New' | 'Nigerian Used';
  price: number; // in Naira (NGN)
  original_price?: number;
  is_price_reduced?: boolean;
  location: string; // e.g. "Lekki Phase 1, Lagos"
  state: string;
  mileage: number; // in kilometers
  transmission: 'Automatic' | 'Manual';
  fuel_type: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';
  drive_type: 'AWD' | '4WD' | 'FWD' | 'RWD';
  engine: string;
  horsepower?: number;
  exterior_color: string;
  interior_color: string;
  seats: number;
  doors: number;
  is_featured: boolean;
  status: ListingStatus;
  views_count: number;
  created_at: string;
  description: string;
  features: string[];
  
  // Signature MANIFOLD media hierarchy
  video: CarVideo;
  gallery_image_1_url: string;
  gallery_image_2_url: string;
  additional_images?: string[];

  // Verification & Dealer (MANIFOLD manages the enquiry - dealer phone NOT exposed)
  verification: VehicleVerification;
  dealer: DealerInfo;
}

export interface CarBrand {
  id: string;
  name: string;
  slug: string;
  car_count: number;
  popular_models: string[];
  country: string;
  logo_url?: string;
  is_active?: boolean;
  is_featured?: boolean;
}

export interface CarModelRecord {
  id: string;
  brand_id: string;
  brand_name: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

export interface BodyTypeCategory {
  id: string;
  name: string;
  slug: string;
  car_count: number;
  description: string;
  image_url?: string;
  is_active?: boolean;
}

export interface FilterState {
  make: string;
  model: string;
  location: string;
  minPrice: number | '';
  maxPrice: number | '';
  yearFrom: number | '';
  yearTo: number | '';
  bodyType: string;
  condition: string;
  transmission: string;
  fuelType: string;
  driveType: string;
  maxMileage: number | '';
  searchQuery: string;
}

export type InquiryStatus = 'NEW' | 'CONTACTED' | 'VIEWING_SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export interface BuyerInquiry {
  id?: string;
  car_id: string;
  car_title: string;
  car_price: number;
  full_name: string;
  phone_number: string;
  email: string;
  location: string;
  preferred_contact: 'call' | 'whatsapp' | 'email';
  needs_financing: boolean;
  needs_inspection: boolean;
  notes?: string;
  status?: InquiryStatus;
  created_at?: string;
}

export interface CarHuntSubmission {
  make: string;
  model: string;
  year_min: number;
  year_max: number;
  budget_max: number;
  body_type: string;
  condition: string;
  preferred_location: string;
  full_name: string;
  phone_number: string;
  email: string;
  timeframe: string;
  notes?: string;
}

