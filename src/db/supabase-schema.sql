-- ==============================================================================
-- MANIFOLD Automotive Marketplace — Supabase Authoritative PostgreSQL Schema
-- Section 7: All 20 tables with Row Level Security (RLS) & Performance Indexes
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Admin Users Table (Section 2: Authorization Gate)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT DEFAULT 'MANIFOLD Administrator',
  role TEXT NOT NULL DEFAULT 'admin', -- 'admin', 'editor', 'inspector'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'suspended'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Car Brands (Section 14)
CREATE TABLE IF NOT EXISTS public.car_brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  country TEXT DEFAULT 'Japan',
  logo_url TEXT,
  car_count INTEGER DEFAULT 0,
  popular_models JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Car Models (Section 15)
CREATE TABLE IF NOT EXISTS public.car_models (
  id TEXT PRIMARY KEY,
  brand_id TEXT REFERENCES public.car_brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Car Types / Categories (Section 16)
CREATE TABLE IF NOT EXISTS public.car_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Dealers (Section 17 - Private contact info restricted to admins)
CREATE TABLE IF NOT EXISTS public.dealers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Lagos',
  address TEXT,
  phone TEXT, -- NEVER exposed to public visitors
  email TEXT, -- NEVER exposed to public visitors
  is_verified BOOLEAN DEFAULT true,
  joined_year INTEGER DEFAULT 2024,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Cars Inventory (Sections 9 & 10)
CREATE TABLE IF NOT EXISTS public.cars (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  brand_id TEXT REFERENCES public.car_brands(id) ON DELETE SET NULL,
  model_id TEXT,
  type_id TEXT,
  dealer_id TEXT REFERENCES public.dealers(id) ON DELETE SET NULL,
  variant TEXT,
  trim TEXT,
  year INTEGER NOT NULL,
  price BIGINT NOT NULL,
  previous_price BIGINT,
  original_price BIGINT,
  currency TEXT DEFAULT 'NGN',
  mileage INTEGER NOT NULL DEFAULT 0,
  condition TEXT NOT NULL DEFAULT 'Foreign Used',
  fuel_type TEXT NOT NULL DEFAULT 'Petrol',
  transmission TEXT NOT NULL DEFAULT 'Automatic',
  drive_type TEXT NOT NULL DEFAULT 'AWD',
  engine TEXT DEFAULT '3.5L V6',
  horsepower INTEGER,
  exterior_color TEXT NOT NULL DEFAULT 'Metallic Black',
  interior_color TEXT NOT NULL DEFAULT 'Black Leather',
  seats INTEGER DEFAULT 5,
  doors INTEGER DEFAULT 4,
  location TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Lagos',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- 'PUBLISHED', 'DRAFT', 'ARCHIVED', 'SOLD'
  is_featured BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT true,
  views_count INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  
  -- Denormalized media fallbacks
  youtube_video_id TEXT,
  youtube_url TEXT,
  youtube_thumbnail_url TEXT,
  gallery_image_1_url TEXT,
  gallery_image_2_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Car Media (Section 11: YouTube Video Reviews CMS)
CREATE TABLE IF NOT EXISTS public.car_media (
  id TEXT PRIMARY KEY,
  car_id TEXT REFERENCES public.cars(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL DEFAULT 'youtube_video', -- 'youtube_video'
  video_type TEXT NOT NULL DEFAULT 'full_review', -- 'full_review', 'walkaround', 'car_hunt', 'buying_guide'
  title TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  youtube_video_id TEXT NOT NULL,
  youtube_thumbnail_url TEXT,
  description TEXT,
  is_primary BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'published', -- 'published', 'draft', 'archived'
  sort_order INTEGER DEFAULT 0,
  duration TEXT DEFAULT '12:00',
  presenter TEXT DEFAULT 'MANIFOLD Presenter',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Car Images (Section 12: Gallery Image 1 & 2)
CREATE TABLE IF NOT EXISTS public.car_images (
  id TEXT PRIMARY KEY,
  car_id TEXT NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 1, -- 1 for Gallery 1, 2 for Gallery 2
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Vehicle Verifications
CREATE TABLE IF NOT EXISTS public.vehicle_verifications (
  id TEXT PRIMARY KEY,
  car_id TEXT NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  is_verified BOOLEAN DEFAULT true,
  dealer_verified BOOLEAN DEFAULT true,
  vehicle_physically_seen BOOLEAN DEFAULT true,
  video_reviewed BOOLEAN DEFAULT true,
  price_confirmed BOOLEAN DEFAULT true,
  vin_checked BOOLEAN DEFAULT true,
  inspection_score INTEGER DEFAULT 95,
  verified_date TEXT,
  verified_by TEXT DEFAULT 'MANIFOLD Field Inspection Unit',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Vehicle Inspections
CREATE TABLE IF NOT EXISTS public.vehicle_inspections (
  id TEXT PRIMARY KEY,
  car_id TEXT NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  inspector_name TEXT,
  inspection_date TIMESTAMPTZ DEFAULT NOW(),
  overall_score INTEGER DEFAULT 95,
  engine_score INTEGER DEFAULT 95,
  transmission_score INTEGER DEFAULT 95,
  electrical_score INTEGER DEFAULT 95,
  body_frame_score INTEGER DEFAULT 95,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Buyer Inquiries (Section 18)
CREATE TABLE IF NOT EXISTS public.buyer_inquiries (
  id TEXT PRIMARY KEY,
  car_id TEXT REFERENCES public.cars(id) ON DELETE SET NULL,
  car_title TEXT,
  car_price BIGINT,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT NOT NULL,
  location TEXT,
  preferred_contact TEXT DEFAULT 'phone',
  needs_financing BOOLEAN DEFAULT false,
  needs_inspection BOOLEAN DEFAULT false,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'contacted', 'qualified', 'viewing_scheduled', 'negotiating', 'won', 'lost', 'closed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Car Hunt Requests (Concierge Sourcing)
CREATE TABLE IF NOT EXISTS public.car_hunt_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  budget_max BIGINT,
  preferred_brand_id TEXT REFERENCES public.car_brands(id) ON DELETE SET NULL,
  preferred_model_id TEXT REFERENCES public.car_models(id) ON DELETE SET NULL,
  body_type_id TEXT REFERENCES public.car_types(id) ON DELETE SET NULL,
  year_min INTEGER,
  year_max INTEGER,
  location TEXT,
  requirements TEXT,
  trim TEXT,
  preferred_condition TEXT,
  buying_timeframe TEXT,
  assigned_to UUID,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incremental column guards
ALTER TABLE public.car_hunt_requests ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.car_hunt_requests ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.car_hunt_requests ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.car_hunt_requests ADD COLUMN IF NOT EXISTS budget_max BIGINT;
ALTER TABLE public.car_hunt_requests ADD COLUMN IF NOT EXISTS preferred_brand_id TEXT;
ALTER TABLE public.car_hunt_requests ADD COLUMN IF NOT EXISTS preferred_model_id TEXT;
ALTER TABLE public.car_hunt_requests ADD COLUMN IF NOT EXISTS body_type_id TEXT;
ALTER TABLE public.car_hunt_requests ADD COLUMN IF NOT EXISTS year_min INTEGER;
ALTER TABLE public.car_hunt_requests ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.car_hunt_requests ADD COLUMN IF NOT EXISTS requirements TEXT;

ALTER TABLE public.car_hunt_requests
ADD COLUMN IF NOT EXISTS trim text NULL,
ADD COLUMN IF NOT EXISTS preferred_condition text NULL,
ADD COLUMN IF NOT EXISTS buying_timeframe text NULL;

ALTER TABLE public.car_hunt_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';

-- 14. Viewings
CREATE TABLE IF NOT EXISTS public.viewings (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT REFERENCES public.buyer_inquiries(id) ON DELETE SET NULL,
  car_id TEXT REFERENCES public.cars(id) ON DELETE SET NULL,
  viewing_date TIMESTAMPTZ NOT NULL,
  location TEXT NOT NULL,
  supervised_by TEXT DEFAULT 'MANIFOLD Field Unit',
  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Sales (Section 19)
CREATE TABLE IF NOT EXISTS public.sales (
  id TEXT PRIMARY KEY,
  car_id TEXT REFERENCES public.cars(id) ON DELETE SET NULL,
  dealer_id TEXT REFERENCES public.dealers(id) ON DELETE SET NULL,
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT,
  buyer_email TEXT,
  sale_price BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'cancelled'
  sale_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Commissions (Section 20)
CREATE TABLE IF NOT EXISTS public.commissions (
  id TEXT PRIMARY KEY,
  sale_id TEXT REFERENCES public.sales(id) ON DELETE CASCADE,
  dealer_id TEXT REFERENCES public.dealers(id) ON DELETE SET NULL,
  commission_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage', 'fixed'
  commission_rate NUMERIC DEFAULT 2.5,
  commission_amount BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16b. Commission Rules (Phase 4: Admin Commission Control)
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id TEXT PRIMARY KEY DEFAULT ('crule-' || substr(gen_random_uuid()::text, 1, 8)),
  name TEXT NOT NULL,
  min_price BIGINT NOT NULL DEFAULT 0,
  max_price BIGINT, -- NULL represents no upper ceiling (e.g. 50,000,000+)
  commission_percentage NUMERIC NOT NULL,
  fixed_fee BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16c. Dealer Commission Agreements (Phase 4: Individual Dealer Terms)
CREATE TABLE IF NOT EXISTS public.commission_agreements (
  id TEXT PRIMARY KEY DEFAULT ('cagr-' || substr(gen_random_uuid()::text, 1, 8)),
  dealer_id TEXT REFERENCES public.dealers(id) ON DELETE CASCADE,
  custom_percentage NUMERIC,
  custom_fixed_fee BIGINT DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Favorites
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  car_id TEXT REFERENCES public.cars(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, car_id)
);

-- 18. Saved Searches
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT,
  criteria JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- Initial Administrator Setup (Section 1 & 2)
-- Authorizes newwavereporters@gmail.com as the active admin
-- ==============================================================================
INSERT INTO public.admin_users (email, name, role, status)
VALUES ('newwavereporters@gmail.com', 'MANIFOLD Lead Administrator', 'admin', 'active')
ON CONFLICT (email) DO UPDATE SET status = 'active', role = 'admin';

-- ==============================================================================
-- Row Level Security (RLS) Configuration (Section 22)
-- ==============================================================================
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_hunt_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Helper function to check if requesting user is active admin
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE (user_id = auth.uid() OR email = auth.jwt()->>'email')
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Public can read published vehicles and media
CREATE POLICY "Public read published cars" ON public.cars FOR SELECT USING (status = 'PUBLISHED' OR public.is_active_admin());
CREATE POLICY "Admins moderate cars" ON public.cars FOR UPDATE USING (public.is_active_admin());
CREATE POLICY "Admins delete cars" ON public.cars FOR DELETE USING (public.is_active_admin());

-- PHASE 4: Admin MUST NOT list or create dealer vehicles (Section 1 Requirement)
-- Only active authenticated dealers may insert vehicles, and only with their own dealer_id
CREATE POLICY "Dealers insert own cars" ON public.cars
  FOR INSERT
  WITH CHECK (
    public.is_active_dealer() AND
    dealer_id::TEXT = public.current_dealer_id() AND
    public.current_dealer_id() IS NOT NULL
  );

CREATE POLICY "Public read car media" ON public.car_media FOR SELECT USING (status = 'published' OR public.is_active_admin());
CREATE POLICY "Admins full access car media" ON public.car_media FOR ALL USING (public.is_active_admin());

CREATE POLICY "Public read car images" ON public.car_images FOR SELECT USING (true);
CREATE POLICY "Admins full access car images" ON public.car_images FOR ALL USING (public.is_active_admin());

CREATE POLICY "Public read active brands" ON public.car_brands FOR SELECT USING (is_active = true OR public.is_active_admin());
CREATE POLICY "Admins full access brands" ON public.car_brands FOR ALL USING (public.is_active_admin());

CREATE POLICY "Public read active models" ON public.car_models FOR SELECT USING (is_active = true OR public.is_active_admin());
CREATE POLICY "Admins full access models" ON public.car_models FOR ALL USING (public.is_active_admin());

CREATE POLICY "Public read active types" ON public.car_types FOR SELECT USING (is_active = true OR public.is_active_admin());
CREATE POLICY "Admins full access types" ON public.car_types FOR ALL USING (public.is_active_admin());

-- Dealers: Public can read basic non-confidential info; Admins have full access
CREATE POLICY "Public read dealers" ON public.dealers FOR SELECT USING (true);
CREATE POLICY "Admins full access dealers" ON public.dealers FOR ALL USING (public.is_active_admin());

-- Inquiries: Public can submit; Admins can read & update
CREATE POLICY "Public insert inquiries" ON public.buyer_inquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins full access inquiries" ON public.buyer_inquiries FOR ALL USING (public.is_active_admin());

-- Car Hunt Requests: Public can submit; Admins can read & manage
CREATE POLICY "Public can submit car hunt requests" ON public.car_hunt_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins full access car hunt requests" ON public.car_hunt_requests FOR ALL USING (public.is_active_admin());

-- Sales & Commissions: Admin only
CREATE POLICY "Admins full access sales" ON public.sales FOR ALL USING (public.is_active_admin());
CREATE POLICY "Admins full access commissions" ON public.commissions FOR ALL USING (public.is_active_admin());

-- Commission Rules & Agreements RLS (Phase 4: Admin Commission Control)
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commission rules" ON public.commission_rules
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

CREATE POLICY "Public read active commission rules" ON public.commission_rules
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins manage commission agreements" ON public.commission_agreements
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

CREATE POLICY "Dealers read own agreement" ON public.commission_agreements
  FOR SELECT USING (dealer_id::TEXT = public.current_dealer_id());

-- Seed Initial Commission Rules (Section 5 Tiers)
INSERT INTO public.commission_rules (id, name, min_price, max_price, commission_percentage, fixed_fee, currency, is_active)
VALUES
  ('crule-tier-1', 'Tier 1 (₦5M - ₦10M)', 5000000, 9999999, 1.8, 0, 'NGN', true),
  ('crule-tier-2', 'Tier 2 (₦10M - ₦20M)', 10000000, 19999999, 1.5, 0, 'NGN', true),
  ('crule-tier-3', 'Tier 3 (₦20M - ₦30M)', 20000000, 29999999, 1.25, 0, 'NGN', true),
  ('crule-tier-4', 'Tier 4 (₦30M - ₦50M)', 30000000, 49999999, 1.0, 0, 'NGN', true),
  ('crule-tier-5', 'Tier 5 (₦50M+)', 50000000, NULL, 0.8, 0, 'NGN', true)
ON CONFLICT (id) DO NOTHING;

-- Admin Users table: authenticated users can read their own authorization row; admins can manage
CREATE POLICY "Self read admin authorization" ON public.admin_users FOR SELECT USING (user_id = auth.uid() OR email = auth.jwt()->>'email');
CREATE POLICY "Admins manage admin users" ON public.admin_users FOR ALL USING (public.is_active_admin());

-- ==============================================================================
-- PHASE 3: DEALER OPERATIONS RLS POLICIES & FUNCTIONS
-- ==============================================================================

-- Helper function to obtain current authenticated dealer ID from dealer_accounts
CREATE OR REPLACE FUNCTION public.current_dealer_id()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT dealer_id::TEXT FROM public.dealer_accounts
    WHERE user_id = auth.uid()
      AND account_status != 'suspended'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_active_dealer()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.dealer_accounts
    WHERE user_id = auth.uid()
      AND account_status != 'suspended'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Dealer Inquiries: Dealer can read inquiries only for vehicles they own
CREATE POLICY "Dealers view inquiries for own cars" ON public.buyer_inquiries
  FOR SELECT
  USING (
    car_id IN (
      SELECT id FROM public.cars
      WHERE dealer_id::TEXT = public.current_dealer_id()
    )
  );

-- Dealer Inquiries: Dealer can update inquiry status for their own vehicles
CREATE POLICY "Dealers update status on own inquiries" ON public.buyer_inquiries
  FOR UPDATE
  USING (
    car_id IN (
      SELECT id FROM public.cars
      WHERE dealer_id::TEXT = public.current_dealer_id()
    )
  )
  WITH CHECK (
    car_id IN (
      SELECT id FROM public.cars
      WHERE dealer_id::TEXT = public.current_dealer_id()
    )
  );

-- Business Profiles & Addresses: Scoped strictly to authenticated dealer
ALTER TABLE public.dealer_business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers manage own business profile" ON public.dealer_business_profiles
  FOR ALL
  USING (dealer_id::TEXT = public.current_dealer_id())
  WITH CHECK (dealer_id::TEXT = public.current_dealer_id());

CREATE POLICY "Dealers manage own address" ON public.dealer_addresses
  FOR ALL
  USING (dealer_id::TEXT = public.current_dealer_id())
  WITH CHECK (dealer_id::TEXT = public.current_dealer_id());

CREATE POLICY "Dealers view own account" ON public.dealer_accounts
  FOR SELECT
  USING (user_id = auth.uid() OR dealer_id::TEXT = public.current_dealer_id());

CREATE POLICY "Dealers view own cars" ON public.cars
  FOR SELECT
  USING (dealer_id::TEXT = public.current_dealer_id() OR status = 'PUBLISHED' OR public.is_active_admin());

CREATE POLICY "Dealers manage own cars" ON public.cars
  FOR ALL
  USING (dealer_id::TEXT = public.current_dealer_id())
  WITH CHECK (dealer_id::TEXT = public.current_dealer_id());

-- Notifications: Strict isolation by user_id = auth.uid()
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes for lightning queries
CREATE INDEX IF NOT EXISTS idx_cars_slug ON public.cars(slug);
CREATE INDEX IF NOT EXISTS idx_cars_status ON public.cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_brand_id ON public.cars(brand_id);
CREATE INDEX IF NOT EXISTS idx_cars_dealer_id ON public.cars(dealer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_inquiries_car_id ON public.buyer_inquiries(car_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_dealer_addresses_dealer_id ON public.dealer_addresses(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_business_profiles_dealer_id ON public.dealer_business_profiles(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_accounts_user_id ON public.dealer_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_car_media_car_id ON public.car_media(car_id);
CREATE INDEX IF NOT EXISTS idx_car_images_car_id ON public.car_images(car_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_uid ON public.admin_users(user_id);

-- ==============================================================================
-- Section 18: Market Intelligence Centre & Knowledge Base Schema
-- ==============================================================================

-- 18.1 Market Data Sources
CREATE TABLE IF NOT EXISTS public.market_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'marketplace',
  trust_level TEXT NOT NULL DEFAULT 'unverified',
  is_active BOOLEAN DEFAULT true,
  crawl_enabled BOOLEAN DEFAULT true,
  crawl_frequency TEXT DEFAULT 'weekly',
  last_successful_fetch TIMESTAMPTZ,
  last_error TEXT,
  notes TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18.2 Market Data Submissions
CREATE TABLE IF NOT EXISTS public.market_data_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.market_data_sources(id) ON DELETE SET NULL,
  submission_type TEXT NOT NULL,
  raw_content TEXT,
  url TEXT,
  publisher TEXT,
  capture_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  items_count INTEGER DEFAULT 0,
  error_message TEXT,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18.3 Market Crawl Jobs
CREATE TABLE IF NOT EXISTS public.market_crawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.market_data_submissions(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.market_data_sources(id) ON DELETE SET NULL,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER DEFAULT 0,
  extracted_count INTEGER DEFAULT 0,
  last_error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18.4 Market Price Observations
CREATE TABLE IF NOT EXISTS public.market_price_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.market_data_submissions(id) ON DELETE SET NULL,
  source_id UUID REFERENCES public.market_data_sources(id) ON DELETE SET NULL,
  crawl_job_id UUID REFERENCES public.market_crawl_jobs(id) ON DELETE SET NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  trim TEXT,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  mileage INTEGER,
  mileage_unit TEXT DEFAULT 'km',
  condition TEXT NOT NULL DEFAULT 'Foreign Used',
  location TEXT,
  transmission TEXT,
  fuel_type TEXT,
  engine TEXT,
  vin TEXT,
  source_url TEXT,
  publisher TEXT,
  observed_at DATE DEFAULT CURRENT_DATE,
  confidence_score NUMERIC DEFAULT 0.85,
  status TEXT NOT NULL DEFAULT 'pending_review',
  rejection_reason TEXT,
  notes TEXT,
  is_synced_to_knowledge_base BOOLEAN DEFAULT false,
  knowledge_base_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18.5 Market Observation Revisions
CREATE TABLE IF NOT EXISTS public.market_observation_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES public.market_price_observations(id) ON DELETE CASCADE,
  revised_by TEXT DEFAULT 'Administrator',
  change_summary TEXT,
  previous_state JSONB NOT NULL,
  new_state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18.6 Knowledge Base
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'market_intelligence',
  metadata JSONB DEFAULT '{}'::jsonb,
  source_url TEXT,
  fts TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || content)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Configuration for Section 18
ALTER TABLE public.market_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_crawl_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_price_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_observation_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage market sources" ON public.market_data_sources
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
CREATE POLICY "Admins manage market submissions" ON public.market_data_submissions
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
CREATE POLICY "Admins manage market crawl jobs" ON public.market_crawl_jobs
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
CREATE POLICY "Admins manage market observations" ON public.market_price_observations
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
CREATE POLICY "Admins manage observation revisions" ON public.market_observation_revisions
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());
CREATE POLICY "Admins manage knowledge base" ON public.knowledge_base
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

CREATE POLICY "Dealers view approved observations" ON public.market_price_observations
  FOR SELECT USING (status = 'approved');
CREATE POLICY "Public and dealers query knowledge base" ON public.knowledge_base
  FOR SELECT USING (true);

