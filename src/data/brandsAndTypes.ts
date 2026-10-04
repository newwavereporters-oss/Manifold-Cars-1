import { BodyTypeCategory, CarBrand } from '../types';
import imgHighlander from '../assets/images/car_highlander_review_1791137926981.jpg';
import imgLexusRx from '../assets/images/car_lexus_rx_review_1791137937466.jpg';
import imgDealership from '../assets/images/hero_manifold_dealership_1791137893826.jpg';
import imgMercedesGle from '../assets/images/car_mercedes_gle_review_1791137948450.jpg';

export const BODY_TYPES: BodyTypeCategory[] = [
  {
    id: 'type-suv',
    name: 'SUV',
    slug: 'suv',
    car_count: 2854,
    description: 'High clearance, versatile, command view for Nigerian road conditions.'
  },
  {
    id: 'type-sedan',
    name: 'Sedan',
    slug: 'sedan',
    car_count: 4120,
    description: 'Comfortable executive cruisers, fuel-efficient daily drivers.'
  },
  {
    id: 'type-hatchback',
    name: 'Hatchback',
    slug: 'hatchback',
    car_count: 1320,
    description: 'Compact, nimble urban mobility with generous cargo versatility.'
  },
  {
    id: 'type-pickup',
    name: 'Pickup',
    slug: 'pickup',
    car_count: 780,
    description: 'Rugged utility, unmatched payload, and off-road power.'
  },
  {
    id: 'type-coupe',
    name: 'Coupe',
    slug: 'coupe',
    car_count: 430,
    description: 'Sporty silhouette, high performance, and distinctive design.'
  },
  {
    id: 'type-van',
    name: 'Van',
    slug: 'van',
    car_count: 620,
    description: 'People mover and commercial logistics capability.'
  },
  {
    id: 'type-truck',
    name: 'Truck',
    slug: 'truck',
    car_count: 290,
    description: 'Heavy duty transport and industrial logistics.'
  },
  {
    id: 'type-luxury',
    name: 'Luxury',
    slug: 'luxury',
    car_count: 1510,
    description: 'Ultra-premium flagships, pinnacle craftsmanship, and prestige.'
  }
];

export const CAR_BRANDS: CarBrand[] = [
  {
    id: 'brand-toyota',
    name: 'Toyota',
    slug: 'toyota',
    car_count: 4500,
    country: 'Japan',
    popular_models: ['Highlander', 'Camry', 'Prado', 'Corolla', 'RAV4']
  },
  {
    id: 'brand-lexus',
    name: 'Lexus',
    slug: 'lexus',
    car_count: 2800,
    country: 'Japan',
    popular_models: ['RX 350', 'ES 350', 'GX 460', 'LX 570', 'LX 600']
  },
  {
    id: 'brand-mercedes',
    name: 'Mercedes-Benz',
    slug: 'mercedes-benz',
    car_count: 1900,
    country: 'Germany',
    popular_models: ['GLE', 'C-Class', 'E-Class', 'G-Class', 'GLC']
  },
  {
    id: 'brand-bmw',
    name: 'BMW',
    slug: 'bmw',
    car_count: 1210,
    country: 'Germany',
    popular_models: ['X5', '3 Series', '5 Series', 'X6', '7 Series']
  },
  {
    id: 'brand-range-rover',
    name: 'Range Rover',
    slug: 'range-rover',
    car_count: 920,
    country: 'United Kingdom',
    popular_models: ['Sport', 'Vogue', 'Velar', 'Evoque', 'Defender']
  },
  {
    id: 'brand-honda',
    name: 'Honda',
    slug: 'honda',
    car_count: 1640,
    country: 'Japan',
    popular_models: ['Accord', 'CR-V', 'Pilot', 'Civic']
  },
  {
    id: 'brand-hyundai',
    name: 'Hyundai',
    slug: 'hyundai',
    car_count: 850,
    country: 'South Korea',
    popular_models: ['Santa Fe', 'Tucson', 'Elantra', 'Sonata', 'Palisade']
  },
  {
    id: 'brand-kia',
    name: 'Kia',
    slug: 'kia',
    car_count: 640,
    country: 'South Korea',
    popular_models: ['Sportage', 'Sorento', 'Cerato', 'Telluride']
  }
];

export interface YouTubeMediaItem {
  id: string;
  title: string;
  category: 'Car Hunt' | 'Car Review' | 'Buying Tips' | 'Market Insights';
  duration: string;
  views: string;
  thumbnail_url: string;
  youtube_video_id: string;
  youtube_url: string;
  description: string;
}

export const MEDIA_REVIEWS: YouTubeMediaItem[] = [
  {
    id: 'media-01',
    title: 'BEST SUVS UNDER ₦20M IN NIGERIA (2026 Buyers Guide)',
    category: 'Car Hunt',
    duration: '18:45',
    views: '84K views',
    thumbnail_url: imgHighlander,
    youtube_video_id: 'w4-z4_h1wR0',
    youtube_url: 'https://www.youtube.com/watch?v=w4-z4_h1wR0',
    description: 'We tested 5 top SUVs you can comfortably buy in Nigeria right now under 20 Million Naira. Which one won the durability test?'
  },
  {
    id: 'media-02',
    title: 'WHAT TO CHECK BEFORE BUYING A TOYOTA HIGHLANDER OR LEXUS RX',
    category: 'Buying Tips',
    duration: '14:20',
    views: '112K views',
    thumbnail_url: imgLexusRx,
    youtube_video_id: 'dQw4w9WgXcQ',
    youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: 'Common transmission flaws, VIN verification mistakes, and flood damage tricks used by rogue dealers in Lagos.'
  },
  {
    id: 'media-03',
    title: 'LEKKI SHOWROOM TOUR: Inspecting ₦500M Worth of Verified Cars',
    category: 'Market Insights',
    duration: '22:15',
    views: '67K views',
    thumbnail_url: imgDealership,
    youtube_video_id: 'lJIrF4YjGf0',
    youtube_url: 'https://www.youtube.com/watch?v=lJIrF4YjGf0',
    description: 'MANIFOLD goes behind the scenes at partner dealerships in Lekki Phase 1 to verify customs documents and condition.'
  },
  {
    id: 'media-04',
    title: 'MERCEDES-BENZ GLE VS BMW X5: The Honest 3-Year Maintenance Cost in Nigeria',
    category: 'Car Review',
    duration: '16:50',
    views: '93K views',
    thumbnail_url: imgMercedesGle,
    youtube_video_id: 'e-ORhEE9VVg',
    youtube_url: 'https://www.youtube.com/watch?v=e-ORhEE9VVg',
    description: 'Parts availability, premium fuel requirements, mechanic expertise, and resale value comparison for Nigerian car buyers.'
  }
];

export const NIGERIAN_LOCATIONS = [
  'All Locations',
  'Lekki Phase 1, Lagos',
  'Victoria Island, Lagos',
  'Ikoyi, Lagos',
  'Ikeja GRA, Lagos',
  'Surulere, Lagos',
  'Maitama, Abuja',
  'Wuse 2, Abuja',
  'Gwarinpa, Abuja',
  'Port Harcourt, Rivers'
];

export const PRICE_OPTIONS = [
  { label: 'Any Price', value: '' },
  { label: '₦10,000,000', value: 10000000 },
  { label: '₦15,000,000', value: 15000000 },
  { label: '₦20,000,000', value: 20000000 },
  { label: '₦25,000,000', value: 25000000 },
  { label: '₦35,000,000', value: 35000000 },
  { label: '₦50,000,000', value: 50000000 },
  { label: '₦75,000,000', value: 75000000 },
  { label: '₦100,000,000', value: 100000000 },
  { label: '₦150,000,000+', value: 150000000 }
];
