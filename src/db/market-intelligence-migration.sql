-- ==============================================================================
-- MANIFOLD Automotive Marketplace — Market Intelligence Schema & Knowledge Base
-- Phase 1C: Hardened Database Security, Least-Privilege RLS & Clean Knowledge Base
-- ==============================================================================

-- 0. Required Extensions (uuid-ossp & pgvector)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Attempt pgvector installation (768-dimensional gemini-embedding-2-preview)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector extension not available or permission restricted. Vector similarity will activate once enabled.';
END $$;

-- ==============================================================================
-- 1. HELPER FUNCTIONS: is_active_admin() with secure search_path
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE (user_id = auth.uid() OR email = auth.jwt()->>'email')
      AND status = 'active'
  );
END;
$$;

-- Revoke direct execution from public and anon, grant only to authenticated API roles
REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated, service_role;

-- ==============================================================================
-- 2. MARKET DATA SOURCES
-- Default trust_level is strictly 'unverified'. crawl_enabled defaults to FALSE.
-- Added UNIQUE constraint on name so seeding is idempotent and conflict-safe.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.market_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  base_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'marketplace',
  trust_level TEXT NOT NULL DEFAULT 'unverified', -- 'unverified', 'verified', 'partner', 'official'
  is_active BOOLEAN DEFAULT true,
  crawl_enabled BOOLEAN DEFAULT false,           -- Must be individually assessed and enabled
  crawl_frequency TEXT DEFAULT 'weekly',
  last_successful_fetch TIMESTAMPTZ,
  last_error TEXT,
  notes TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if table was previously partially created
ALTER TABLE public.market_data_sources ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.market_data_sources ADD COLUMN IF NOT EXISTS base_url TEXT;
ALTER TABLE public.market_data_sources ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'marketplace';
ALTER TABLE public.market_data_sources ADD COLUMN IF NOT EXISTS trust_level TEXT DEFAULT 'unverified';
ALTER TABLE public.market_data_sources ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.market_data_sources ADD COLUMN IF NOT EXISTS crawl_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.market_data_sources ADD COLUMN IF NOT EXISTS crawl_frequency TEXT DEFAULT 'weekly';
ALTER TABLE public.market_data_sources ADD COLUMN IF NOT EXISTS last_successful_fetch TIMESTAMPTZ;
ALTER TABLE public.market_data_sources ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE public.market_data_sources ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.market_data_sources ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Ensure UNIQUE constraint on name for safe ON CONFLICT handling
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_market_data_sources_name'
  ) THEN
    ALTER TABLE public.market_data_sources ADD CONSTRAINT uq_market_data_sources_name UNIQUE (name);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ==============================================================================
-- 3. MARKET DATA SUBMISSIONS
-- Tracks provenance, submitted URL, validated final URL, retrieval outcome,
-- raw evidence text, and administrative attribution.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.market_data_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.market_data_sources(id) ON DELETE SET NULL,
  submission_type TEXT NOT NULL DEFAULT 'text', -- 'url', 'text', 'file_import'
  raw_content TEXT,                             -- Preserved verbatim input text
  url TEXT,                                     -- Submitted URL
  final_url TEXT,                               -- Validated final URL after redirect check
  publisher TEXT,
  capture_date DATE DEFAULT CURRENT_DATE,
  retrieval_status TEXT DEFAULT 'pending',      -- 'pending', 'success', 'failed', 'blocked'
  retrieval_timestamp TIMESTAMPTZ,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',       -- 'pending', 'processing', 'completed', 'failed'
  items_count INTEGER DEFAULT 0,
  error_message TEXT,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.market_data_sources(id) ON DELETE SET NULL;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS submission_type TEXT DEFAULT 'text';
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS raw_content TEXT;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS final_url TEXT;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS publisher TEXT;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS capture_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS retrieval_status TEXT DEFAULT 'pending';
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS retrieval_timestamp TIMESTAMPTZ;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS items_count INTEGER DEFAULT 0;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.market_data_submissions ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ==============================================================================
-- 4. MARKET CRAWL JOBS
-- Per-URL crawl audit record. Failed or blocked fetches never create observations.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.market_crawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.market_data_submissions(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.market_data_sources(id) ON DELETE SET NULL,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',        -- 'queued', 'fetching', 'extracting', 'completed', 'failed'
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

-- ==============================================================================
-- 5. MARKET PRICE OBSERVATIONS
-- Extracted observations default to 'pending_review'.
-- Only approved records are ever eligible for dealer-facing market intelligence.
-- ==============================================================================
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
  status TEXT NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'approved', 'rejected', 'stale', 'archived'
  rejection_reason TEXT,
  evidence_text TEXT,                           -- Verbatim supporting quote from source
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
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS evidence_text TEXT;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS is_synced_to_knowledge_base BOOLEAN DEFAULT false;
ALTER TABLE public.market_price_observations ADD COLUMN IF NOT EXISTS knowledge_base_id UUID;

-- ==============================================================================
-- 6. MARKET OBSERVATION REVISIONS
-- Audit trail tracking administrative and automated changes.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.market_observation_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES public.market_price_observations(id) ON DELETE CASCADE,
  revised_by TEXT DEFAULT 'Administrator',
  change_summary TEXT,
  previous_state JSONB NOT NULL,
  new_state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. KNOWLEDGE BASE
-- Clean knowledge store with status filtering. Supports 768-d vector embeddings
-- and tsvector full-text search. Private or unapproved entries are strictly protected.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'market_intelligence',
  status TEXT NOT NULL DEFAULT 'approved',      -- 'approved', 'draft', 'pending_review', 'archived'
  metadata JSONB DEFAULT '{}'::jsonb,
  source_url TEXT,
  fts TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || content)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'market_intelligence';
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved';
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Safely add 768-dimensional vector column if vector extension is active
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS embedding vector(768);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ==============================================================================
-- 8. SECURE match_knowledge() RPC FUNCTION
-- Hardened against exposing private, draft, or unapproved records.
-- Restricts retrieval to approved status and enforces safe search path.
-- ==============================================================================
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
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Strict security filter: only approved records in public knowledge base
  RETURN QUERY
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    kb.metadata,
    (1 - (kb.embedding <=> query_embedding))::float AS similarity
  FROM public.knowledge_base kb
  WHERE kb.embedding IS NOT NULL
    AND kb.status = 'approved'
    AND (1 - (kb.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Revoke execution from PUBLIC; grant explicitly to API roles
REVOKE ALL ON FUNCTION public.match_knowledge(vector(768), float, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_knowledge(vector(768), float, int) TO anon, authenticated, service_role;

-- ==============================================================================
-- 9. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_mkt_obs_status ON public.market_price_observations(status);
CREATE INDEX IF NOT EXISTS idx_mkt_obs_make_model ON public.market_price_observations(make, model);
CREATE INDEX IF NOT EXISTS idx_mkt_obs_year ON public.market_price_observations(year);
CREATE INDEX IF NOT EXISTS idx_mkt_obs_price ON public.market_price_observations(price);
CREATE INDEX IF NOT EXISTS idx_mkt_obs_source_id ON public.market_price_observations(source_id);
CREATE INDEX IF NOT EXISTS idx_mkt_obs_created_at ON public.market_price_observations(created_at);
CREATE INDEX IF NOT EXISTS idx_mkt_crawl_jobs_status ON public.market_crawl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_mkt_revisions_obs_id ON public.market_observation_revisions(observation_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_status ON public.knowledge_base(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_fts ON public.knowledge_base USING GIN(fts);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON public.knowledge_base(category);

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict least-privilege isolation:
-- - Active admins have FULL management rights.
-- - Public / Dealers may ONLY SELECT approved observations and approved knowledge.
-- - Submissions, crawl jobs, and unapproved records are NEVER exposed to non-admins.
-- ==============================================================================
ALTER TABLE public.market_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_crawl_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_price_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_observation_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- 10.1 market_data_sources: Admins manage; non-admins may only view active sources
DROP POLICY IF EXISTS "Admins manage market sources" ON public.market_data_sources;
CREATE POLICY "Admins manage market sources" ON public.market_data_sources
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "Public read active sources" ON public.market_data_sources;
CREATE POLICY "Public read active sources" ON public.market_data_sources
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- 10.2 market_data_submissions: Strictly private to administrators
DROP POLICY IF EXISTS "Admins manage market submissions" ON public.market_data_submissions;
CREATE POLICY "Admins manage market submissions" ON public.market_data_submissions
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- 10.3 market_crawl_jobs: Strictly private to administrators
DROP POLICY IF EXISTS "Admins manage market crawl jobs" ON public.market_crawl_jobs;
CREATE POLICY "Admins manage market crawl jobs" ON public.market_crawl_jobs
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- 10.4 market_price_observations: Admins manage all; dealers/public may ONLY SELECT approved
DROP POLICY IF EXISTS "Admins manage market observations" ON public.market_price_observations;
CREATE POLICY "Admins manage market observations" ON public.market_price_observations
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "Dealers view approved observations" ON public.market_price_observations;
CREATE POLICY "Dealers view approved observations" ON public.market_price_observations
  FOR SELECT TO anon, authenticated
  USING (status = 'approved');

-- 10.5 market_observation_revisions: Strictly private audit log for administrators
DROP POLICY IF EXISTS "Admins manage observation revisions" ON public.market_observation_revisions;
CREATE POLICY "Admins manage observation revisions" ON public.market_observation_revisions
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- 10.6 knowledge_base: Admins manage; public and dealers may ONLY read approved records
DROP POLICY IF EXISTS "Admins manage knowledge base" ON public.knowledge_base;
CREATE POLICY "Admins manage knowledge base" ON public.knowledge_base
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "Public and dealers query knowledge base" ON public.knowledge_base;
CREATE POLICY "Public and dealers query knowledge base" ON public.knowledge_base
  FOR SELECT TO anon, authenticated
  USING (status = 'approved');

-- ==============================================================================
-- 11. LEAST-PRIVILEGE TABLE GRANTS
-- Replace blanket GRANT ALL with specific granular permissions.
-- ==============================================================================
-- Revoke any preexisting broad grants
REVOKE ALL ON public.market_data_sources FROM anon, authenticated;
REVOKE ALL ON public.market_data_submissions FROM anon, authenticated;
REVOKE ALL ON public.market_crawl_jobs FROM anon, authenticated;
REVOKE ALL ON public.market_price_observations FROM anon, authenticated;
REVOKE ALL ON public.market_observation_revisions FROM anon, authenticated;
REVOKE ALL ON public.knowledge_base FROM anon, authenticated;

-- Read-only grants governed by RLS
GRANT SELECT ON public.market_data_sources TO anon, authenticated;
GRANT SELECT ON public.market_price_observations TO anon, authenticated;
GRANT SELECT ON public.knowledge_base TO anon, authenticated;

-- Authenticated roles have DML privileges, strictly bounded by is_active_admin() RLS policies
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_data_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_data_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_crawl_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_price_observations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_observation_revisions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base TO authenticated;

-- Service role retains full system access
GRANT ALL ON public.market_data_sources TO service_role;
GRANT ALL ON public.market_data_submissions TO service_role;
GRANT ALL ON public.market_crawl_jobs TO service_role;
GRANT ALL ON public.market_price_observations TO service_role;
GRANT ALL ON public.market_observation_revisions TO service_role;
GRANT ALL ON public.knowledge_base TO service_role;

-- ==============================================================================
-- 12. INITIAL SOURCE SEEDING (Safely Repeatable & Unverified by Default)
-- Sources start as 'unverified' with crawl_enabled = FALSE.
-- Crawling must be explicitly assessed and activated by an administrator.
-- ==============================================================================
INSERT INTO public.market_data_sources (name, base_url, source_type, trust_level, is_active, crawl_enabled, crawl_frequency, notes)
VALUES
  ('Jiji Autos Nigeria', 'https://jiji.ng/cars', 'marketplace', 'unverified', true, false, 'daily', 'Nigerian classifieds marketplace. Crawling pending admin review.'),
  ('Cars45 / Autochek Africa', 'https://autochek.africa/ng/cars-for-sale', 'marketplace', 'unverified', true, false, 'daily', 'Wholesale/retail vehicle pricing platform. Crawling pending admin review.'),
  ('Carmart Nigeria', 'https://carmart.ng', 'marketplace', 'unverified', true, false, 'weekly', 'Nigerian automotive portal. Crawling pending admin review.'),
  ('Naijauto Direct', 'https://naijauto.com/cars-for-sale', 'classifieds', 'unverified', true, false, 'weekly', 'Automotive listings aggregator. Crawling pending admin review.'),
  ('MANIFOLD Partner Dealer Desk', 'https://manifold.ng', 'dealer_site', 'unverified', true, false, 'manual', 'Direct consignments and dealer feed ingestions. Pending verification.')
ON CONFLICT (name) DO UPDATE SET
  base_url = EXCLUDED.base_url,
  source_type = EXCLUDED.source_type,
  updated_at = NOW();
