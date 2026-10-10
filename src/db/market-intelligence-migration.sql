-- ==============================================================================
-- MANIFOLD Automotive Marketplace — Market Intelligence Centre Schema
-- Admin Data Submission, AI Extraction, Editing, Review & Knowledge Integration
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Market Data Sources (Trusted platforms, dealer portals, auction houses, classifieds)
CREATE TABLE IF NOT EXISTS public.market_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'marketplace', -- 'marketplace', 'dealer_site', 'auction', 'classifieds', 'report', 'other'
  trust_level TEXT NOT NULL DEFAULT 'unverified', -- 'unverified', 'verified', 'partner', 'official'
  is_active BOOLEAN DEFAULT true,
  crawl_enabled BOOLEAN DEFAULT true,
  crawl_frequency TEXT DEFAULT 'weekly', -- 'hourly', 'daily', 'weekly', 'monthly', 'manual'
  last_successful_fetch TIMESTAMPTZ,
  last_error TEXT,
  notes TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Market Data Submissions (URLs, copied text, or uploaded CSV/spreadsheet batches)
CREATE TABLE IF NOT EXISTS public.market_data_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.market_data_sources(id) ON DELETE SET NULL,
  submission_type TEXT NOT NULL, -- 'url', 'text', 'file_import'
  raw_content TEXT, -- preserved original text or raw import payload
  url TEXT,
  publisher TEXT,
  capture_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  items_count INTEGER DEFAULT 0,
  error_message TEXT,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist on market_data_submissions if table was previously created
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.market_data_sources(id) ON DELETE SET NULL;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS submission_type TEXT DEFAULT 'text';
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS raw_content TEXT;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS publisher TEXT;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS capture_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS items_count INTEGER DEFAULT 0;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Market Crawl Jobs (Per-URL crawling, fetching, and extraction jobs)
CREATE TABLE IF NOT EXISTS public.market_crawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.market_data_submissions(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.market_data_sources(id) ON DELETE SET NULL,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'fetching', 'extracting', 'completed', 'failed'
  attempts INTEGER DEFAULT 0,
  extracted_count INTEGER DEFAULT 0,
  last_error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.market_crawl_jobs ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES public.market_data_submissions(id) ON DELETE CASCADE;
ALTER TABLE public.market_crawl_jobs ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.market_data_sources(id) ON DELETE SET NULL;
ALTER TABLE public.market_crawl_jobs ADD COLUMN IF NOT EXISTS target_url TEXT;
ALTER TABLE public.market_crawl_jobs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'queued';
ALTER TABLE public.market_crawl_jobs ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE public.market_crawl_jobs ADD COLUMN IF NOT EXISTS extracted_count INTEGER DEFAULT 0;
ALTER TABLE public.market_crawl_jobs ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE public.market_crawl_jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE public.market_crawl_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 4. Market Price Observations (Extracted vehicle pricing records)
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
  condition TEXT NOT NULL DEFAULT 'Foreign Used', -- 'Foreign Used', 'Nigerian Used', 'Brand New'
  location TEXT,
  transmission TEXT,
  fuel_type TEXT,
  engine TEXT,
  vin TEXT,
  source_url TEXT,
  publisher TEXT,
  observed_at DATE DEFAULT CURRENT_DATE,
  confidence_score NUMERIC DEFAULT 0.85,
  status TEXT NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'approved', 'rejected', 'stale', 'archived'
  rejection_reason TEXT,
  notes TEXT,
  is_synced_to_knowledge_base BOOLEAN DEFAULT false,
  knowledge_base_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES public.market_data_submissions(id) ON DELETE SET NULL;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.market_data_sources(id) ON DELETE SET NULL;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS crawl_job_id UUID REFERENCES public.market_crawl_jobs(id) ON DELETE SET NULL;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS make TEXT;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS trim TEXT;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN';
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS mileage INTEGER;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS mileage_unit TEXT DEFAULT 'km';
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'Foreign Used';
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS transmission TEXT;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS fuel_type TEXT;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS engine TEXT;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS vin TEXT;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS publisher TEXT;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS observed_at DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS confidence_score NUMERIC DEFAULT 0.85;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_review';
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS is_synced_to_knowledge_base BOOLEAN DEFAULT false;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS knowledge_base_id UUID;

-- 5. Market Observation Revisions (Audit trail and diffs of manual and automated edits)
CREATE TABLE IF NOT EXISTS public.market_observation_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES public.market_price_observations(id) ON DELETE CASCADE,
  revised_by TEXT DEFAULT 'Administrator',
  change_summary TEXT,
  previous_state JSONB NOT NULL,
  new_state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Knowledge Base (Authoritative AI & pricing intelligence index with full-text search)
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

ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'market_intelligence';
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS source_url TEXT;

-- RLS Configuration
ALTER TABLE public.market_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_crawl_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_price_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_observation_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Admins have full access
DROP POLICY IF EXISTS "Admins manage market sources" ON public.market_data_sources;
CREATE POLICY "Admins manage market sources" ON public.market_data_sources
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "Admins manage market submissions" ON public.market_data_submissions;
CREATE POLICY "Admins manage market submissions" ON public.market_data_submissions
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "Admins manage market crawl jobs" ON public.market_crawl_jobs;
CREATE POLICY "Admins manage market crawl jobs" ON public.market_crawl_jobs
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "Admins manage market observations" ON public.market_price_observations;
CREATE POLICY "Admins manage market observations" ON public.market_price_observations
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "Admins manage observation revisions" ON public.market_observation_revisions;
CREATE POLICY "Admins manage observation revisions" ON public.market_observation_revisions
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "Admins manage knowledge base" ON public.knowledge_base;
CREATE POLICY "Admins manage knowledge base" ON public.knowledge_base
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- Authenticated dealers and public can view approved observations & knowledge for pricing intelligence
DROP POLICY IF EXISTS "Dealers view approved observations" ON public.market_price_observations;
CREATE POLICY "Dealers view approved observations" ON public.market_price_observations
  FOR SELECT USING (status = 'approved');

DROP POLICY IF EXISTS "Public and dealers query knowledge base" ON public.knowledge_base;
CREATE POLICY "Public and dealers query knowledge base" ON public.knowledge_base
  FOR SELECT USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mkt_obs_status ON public.market_price_observations(status);
CREATE INDEX IF NOT EXISTS idx_mkt_obs_make_model ON public.market_price_observations(make, model);
CREATE INDEX IF NOT EXISTS idx_mkt_obs_year ON public.market_price_observations(year);
CREATE INDEX IF NOT EXISTS idx_mkt_obs_price ON public.market_price_observations(price);
CREATE INDEX IF NOT EXISTS idx_mkt_obs_source_id ON public.market_price_observations(source_id);
CREATE INDEX IF NOT EXISTS idx_mkt_obs_created_at ON public.market_price_observations(created_at);
CREATE INDEX IF NOT EXISTS idx_mkt_crawl_jobs_status ON public.market_crawl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_mkt_revisions_obs_id ON public.market_observation_revisions(observation_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_fts ON public.knowledge_base USING GIN(fts);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON public.knowledge_base(category);

-- Vector Support (768-dimensional gemini-embedding-2-preview)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
  ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS embedding vector(768);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector extension not installed or permission restricted. Full-text search (tsvector) remains active.';
END $$;

-- 7. match_knowledge RPC Function for Vector Similarity Search
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category TEXT,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base kb
  WHERE kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Grant execution to API roles
GRANT SELECT ON public.knowledge_base TO anon, authenticated;
GRANT ALL ON public.knowledge_base TO authenticated;
GRANT ALL ON public.market_data_sources, public.market_data_submissions, public.market_crawl_jobs, public.market_price_observations, public.market_observation_revisions TO authenticated;
GRANT SELECT ON public.market_price_observations TO anon;

-- Default Trusted Sources Seed
INSERT INTO public.market_data_sources (name, base_url, source_type, trust_level, is_active, crawl_enabled, crawl_frequency, notes)
VALUES
  ('Jiji Autos Nigeria', 'https://jiji.ng/cars', 'marketplace', 'verified', true, true, 'daily', 'Leading Nigerian classifieds marketplace with extensive verified and direct dealer listings.'),
  ('Cars45 / Autochek Africa', 'https://autochek.africa/ng/cars-for-sale', 'marketplace', 'verified', true, true, 'daily', 'Inspected inventory and certified wholesale/retail vehicle pricing platform in Nigeria.'),
  ('Carmart Nigeria', 'https://carmart.ng', 'marketplace', 'verified', true, true, 'weekly', 'Nigerian automotive portal for private and dealership car advertisements.'),
  ('Naijauto Direct', 'https://naijauto.com/cars-for-sale', 'classifieds', 'unverified', true, true, 'weekly', 'Popular Nigerian automotive listings aggregator and market price guide.'),
  ('Lagos & Abuja Partner Dealerships', 'https://manifold.ng', 'dealer_site', 'official', true, false, 'manual', 'Direct inventory consignments, dealer feed ingestions, and certified physically inspected cars.')
ON CONFLICT DO NOTHING;
