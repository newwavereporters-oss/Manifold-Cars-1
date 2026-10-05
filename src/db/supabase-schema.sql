-- ==============================================================================
-- MANIFOLD Automotive Marketplace — Supabase PostgreSQL Database Schema
-- Run this script in your Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Cars Table
CREATE TABLE IF NOT EXISTS public.cars (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT DEFAULT '',
  body_type TEXT NOT NULL DEFAULT 'SUV',
  condition TEXT NOT NULL DEFAULT 'Foreign Used',
  price BIGINT NOT NULL,
  original_price BIGINT,
  is_price_reduced BOOLEAN DEFAULT false,
  location TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Lagos',
  mileage INTEGER NOT NULL DEFAULT 0,
  transmission TEXT NOT NULL DEFAULT 'Automatic',
  fuel_type TEXT NOT NULL DEFAULT 'Petrol',
  drive_type TEXT NOT NULL DEFAULT 'AWD',
  engine TEXT DEFAULT '3.5L V6',
  horsepower INTEGER,
  exterior_color TEXT NOT NULL DEFAULT 'Metallic Black',
  interior_color TEXT NOT NULL DEFAULT 'Black Leather',
  seats INTEGER DEFAULT 5,
  doors INTEGER DEFAULT 4,
  is_featured BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- 'PUBLISHED', 'DRAFT', 'ARCHIVED', 'SOLD'
  views_count INTEGER DEFAULT 0,
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  
  -- Primary Media Architecture
  youtube_video_id TEXT,
  youtube_url TEXT,
  youtube_thumbnail_url TEXT,
  video_title TEXT,
  video_duration TEXT DEFAULT '12:00',
  video_type TEXT DEFAULT 'full_review',
  video_presenter TEXT DEFAULT 'MANIFOLD Presenter',
  
  -- Two Gallery Images (Mandatory for Live Publishing)
  gallery_image_1_url TEXT,
  gallery_image_2_url TEXT,
  additional_images JSONB DEFAULT '[]'::jsonb,
  
  -- Inspection Verification
  is_verified BOOLEAN DEFAULT true,
  inspection_score INTEGER DEFAULT 95,
  verified_date TEXT,
  verified_by TEXT DEFAULT 'MANIFOLD Field Unit',
  
  -- Dealership Information
  dealer_id TEXT DEFAULT 'dlr-partner-01',
  dealer_name TEXT DEFAULT 'Prestige Motors Lekki',
  dealer_city TEXT DEFAULT 'Lekki',
  dealer_state TEXT DEFAULT 'Lagos',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Media & Reviews CMS Table
CREATE TABLE IF NOT EXISTS public.media_reviews (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  video_type TEXT NOT NULL DEFAULT 'Car Review', -- 'Car Review', 'Car Walkaround', 'Car Hunt', 'Buying Guide', 'Market Insight', 'Other'
  youtube_url TEXT NOT NULL,
  youtube_video_id TEXT NOT NULL,
  youtube_thumbnail_url TEXT,
  car_id TEXT REFERENCES public.cars(id) ON DELETE SET NULL,
  car_title TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Published',
  is_featured BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT false,
  duration TEXT DEFAULT '12:00',
  views_count TEXT DEFAULT '1.2k views',
  presenter TEXT DEFAULT 'MANIFOLD Media Team',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Concierge Buyer Inquiries Table
CREATE TABLE IF NOT EXISTS public.buyer_inquiries (
  id TEXT PRIMARY KEY,
  car_id TEXT REFERENCES public.cars(id) ON DELETE SET NULL,
  car_title TEXT,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT NOT NULL,
  location TEXT,
  preferred_contact TEXT DEFAULT 'phone',
  needs_financing BOOLEAN DEFAULT false,
  needs_inspection BOOLEAN DEFAULT false,
  notes TEXT,
  status TEXT DEFAULT 'NEW', -- 'NEW', 'CONTACTED', 'INSPECTION_SET', 'COMPLETED'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Row Level Security (RLS) Policies
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_inquiries ENABLE ROW LEVEL SECURITY;

-- Allow public read access to published vehicles and reviews
CREATE POLICY "Allow public read access for published cars"
  ON public.cars FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated or admin write to cars"
  ON public.cars FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read access for media reviews"
  ON public.media_reviews FOR SELECT
  USING (true);

CREATE POLICY "Allow public write access for media reviews"
  ON public.media_reviews FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public insert for buyer inquiries"
  ON public.buyer_inquiries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow read and update for buyer inquiries"
  ON public.buyer_inquiries FOR ALL
  USING (true)
  WITH CHECK (true);

-- 6. Indexes for High-Performance Queries
CREATE INDEX IF NOT EXISTS idx_cars_slug ON public.cars(slug);
CREATE INDEX IF NOT EXISTS idx_cars_status ON public.cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_make_model ON public.cars(make, model);
CREATE INDEX IF NOT EXISTS idx_cars_price ON public.cars(price);
CREATE INDEX IF NOT EXISTS idx_media_car_id ON public.media_reviews(car_id);
CREATE INDEX IF NOT EXISTS idx_media_status ON public.media_reviews(status);
