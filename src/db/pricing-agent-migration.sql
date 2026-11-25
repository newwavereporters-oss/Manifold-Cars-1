-- ==============================================================================
-- MANIFOLD AI AUTOMOTIVE PRICING AGENT — SUPABASE MIGRATION
-- ==============================================================================
-- Purpose:
--   Extends MANIFOLD's existing Market & Price Intelligence schema
--   (src/db/market-intelligence-migration.sql) to support:
--     1. Richer vehicle price observation attributes, normalized dedupe keys,
--        duplicate linking, statistical outlier tracking, and market category
--        isolation (Nigerian Used vs Foreign Used vs Brand New).
--     2. Historical & current aggregated market_price_estimates snapshots
--        (never overwrites historical prices, enabling trend analysis).
--     3. Admin-governed pricing_agent_config (schedule frequency, freshness
--        intervals, daily quotas, monthly provider budgets, pause/resume).
--     4. Auditable pricing_agent_runs & pricing_provider_usage logs for rate
--        limit monitoring, restricted/anti-bot tracking, and cost attribution.
--
-- Execution Instructions:
--   Execute AFTER src/db/market-intelligence-migration.sql and
--   src/db/ai-platform-migration.sql in the Supabase SQL Editor.
--   This script is safe, additive, non-destructive, and idempotent.
--   Do NOT delete or overwrite historical market observations.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADDITIVE COLUMNS ON public.market_price_observations
-- Preserves all existing observations and revisions intact.
-- ------------------------------------------------------------------------------
ALTER TABLE public.market_price_observations
  ADD COLUMN IF NOT EXISTS make TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS year INTEGER,
  ADD COLUMN IF NOT EXISTS trim TEXT,
  ADD COLUMN IF NOT EXISTS price NUMERIC,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS mileage INTEGER,
  ADD COLUMN IF NOT EXISTS mileage_unit TEXT DEFAULT 'km',
  ADD COLUMN IF NOT EXISTS condition TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS transmission TEXT,
  ADD COLUMN IF NOT EXISTS fuel_type TEXT,
  ADD COLUMN IF NOT EXISTS engine TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS publisher TEXT,
  ADD COLUMN IF NOT EXISTS observed_at DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC DEFAULT 0.85,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS body_type TEXT,
  ADD COLUMN IF NOT EXISTS variant TEXT,
  ADD COLUMN IF NOT EXISTS generation TEXT,
  ADD COLUMN IF NOT EXISTS drivetrain TEXT,
  ADD COLUMN IF NOT EXISTS market_category TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS seller_type TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS source_listing_id TEXT,
  ADD COLUMN IF NOT EXISTS listing_date DATE,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS normalized_url TEXT,
  ADD COLUMN IF NOT EXISTS dedupe_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_of_id UUID REFERENCES public.market_price_observations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duplicate_reason TEXT,
  ADD COLUMN IF NOT EXISTS quality_status TEXT NOT NULL DEFAULT 'valid',
  ADD COLUMN IF NOT EXISTS outlier_reason TEXT,
  ADD COLUMN IF NOT EXISTS agent_run_id UUID;

-- Safely align legacy column names (model_year, vehicle_condition, advertised_price) if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'market_price_observations' AND column_name = 'model_year'
  ) THEN
    EXECUTE 'UPDATE public.market_price_observations SET year = model_year WHERE year IS NULL';
    EXECUTE 'ALTER TABLE public.market_price_observations ALTER COLUMN model_year DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'market_price_observations' AND column_name = 'advertised_price'
  ) THEN
    EXECUTE 'UPDATE public.market_price_observations SET price = advertised_price WHERE price IS NULL';
    EXECUTE 'ALTER TABLE public.market_price_observations ALTER COLUMN advertised_price DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'market_price_observations' AND column_name = 'vehicle_condition'
  ) THEN
    EXECUTE 'UPDATE public.market_price_observations SET condition = vehicle_condition WHERE condition IS NULL';
    EXECUTE 'ALTER TABLE public.market_price_observations ALTER COLUMN vehicle_condition DROP NOT NULL';
    EXECUTE $sql$
      UPDATE public.market_price_observations
      SET market_category = CASE
        WHEN LOWER(COALESCE(vehicle_condition, '')) LIKE '%nigerian%'
          THEN 'nigerian_used'
        WHEN LOWER(COALESCE(vehicle_condition, '')) LIKE '%foreign%'
          OR LOWER(COALESCE(vehicle_condition, '')) LIKE '%tokunbo%'
          THEN 'foreign_used'
        WHEN LOWER(COALESCE(vehicle_condition, '')) LIKE '%brand new%'
          OR LOWER(COALESCE(vehicle_condition, '')) = 'new'
          THEN 'brand_new'
        ELSE 'unknown'
      END
      WHERE market_category IS NULL
         OR market_category = 'unknown'
    $sql$;
  ELSE
    EXECUTE $sql$
      UPDATE public.market_price_observations
      SET market_category = CASE
        WHEN LOWER(COALESCE(condition, '')) LIKE '%nigerian%'
          THEN 'nigerian_used'
        WHEN LOWER(COALESCE(condition, '')) LIKE '%foreign%'
          OR LOWER(COALESCE(condition, '')) LIKE '%tokunbo%'
          THEN 'foreign_used'
        WHEN LOWER(COALESCE(condition, '')) LIKE '%brand new%'
          OR LOWER(COALESCE(condition, '')) = 'new'
          THEN 'brand_new'
        ELSE 'unknown'
      END
      WHERE market_category IS NULL
         OR market_category = 'unknown'
    $sql$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mkt_obs_dedupe_hash
  ON public.market_price_observations (dedupe_hash)
  WHERE dedupe_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mkt_obs_normalized_url
  ON public.market_price_observations (normalized_url)
  WHERE normalized_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mkt_obs_category
  ON public.market_price_observations (make, model, market_category, year)
  WHERE is_duplicate = false;

CREATE INDEX IF NOT EXISTS idx_mkt_obs_agent_run
  ON public.market_price_observations (agent_run_id)
  WHERE agent_run_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. MARKET PRICE ESTIMATES (Aggregated Current & Historical Benchmarks)
-- Preserves full estimate history: when a new estimate is generated for the
-- same (make, model, target_year, market_category, location), previous rows
-- transition to is_current = false rather than being deleted or overwritten.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_price_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  target_year INTEGER,
  year_min INTEGER,
  year_max INTEGER,
  trim TEXT,
  market_category TEXT NOT NULL DEFAULT 'foreign_used', -- 'foreign_used', 'nigerian_used', 'brand_new'
  location TEXT NOT NULL DEFAULT 'Nigeria',
  currency TEXT NOT NULL DEFAULT 'NGN',
  min_price NUMERIC,
  q1_price NUMERIC,
  median_price NUMERIC,
  mean_price NUMERIC,
  q3_price NUMERIC,
  max_price NUMERIC,
  price_range_low NUMERIC,
  price_range_high NUMERIC,
  market_estimate NUMERIC,
  price_distribution JSONB DEFAULT '{}'::jsonb,
  valid_observation_count INTEGER NOT NULL DEFAULT 0,
  rejected_observation_count INTEGER NOT NULL DEFAULT 0,
  duplicate_observation_count INTEGER NOT NULL DEFAULT 0,
  internal_listing_count INTEGER NOT NULL DEFAULT 0,
  confidence_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  confidence_level TEXT NOT NULL DEFAULT 'insufficient', -- 'high', 'medium', 'low', 'insufficient'
  confidence_breakdown JSONB DEFAULT '{}'::jsonb,
  estimation_methodology TEXT NOT NULL,
  insufficient_data BOOLEAN NOT NULL DEFAULT false,
  insufficiency_reason TEXT,
  last_research_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_current BOOLEAN NOT NULL DEFAULT true,
  agent_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_estimates_lookup
  ON public.market_price_estimates (make, model, market_category, is_current, last_research_at DESC);

CREATE INDEX IF NOT EXISTS idx_mkt_estimates_history
  ON public.market_price_estimates (make, model, target_year, market_category, created_at DESC);

ALTER TABLE public.market_price_estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read market price estimates" ON public.market_price_estimates;
CREATE POLICY "Public read market price estimates" ON public.market_price_estimates
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage market price estimates" ON public.market_price_estimates;
CREATE POLICY "Admins manage market price estimates" ON public.market_price_estimates
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

REVOKE ALL ON public.market_price_estimates FROM anon, authenticated;
GRANT SELECT ON public.market_price_estimates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.market_price_estimates TO authenticated;
GRANT ALL ON public.market_price_estimates TO service_role;

-- ------------------------------------------------------------------------------
-- 3. PRICING AGENT CONFIGURATION (Admin Governance & Cost Controls)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_agent_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  schedule_enabled BOOLEAN NOT NULL DEFAULT false,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  default_frequency TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'manual'
  high_demand_interval_hours INTEGER NOT NULL DEFAULT 24,
  standard_interval_hours INTEGER NOT NULL DEFAULT 168,
  insufficient_retry_hours INTEGER NOT NULL DEFAULT 12,
  max_vehicles_per_run INTEGER NOT NULL DEFAULT 5,
  max_queries_per_run INTEGER NOT NULL DEFAULT 10,
  max_fetches_per_query INTEGER NOT NULL DEFAULT 4,
  max_daily_provider_queries INTEGER NOT NULL DEFAULT 60,
  monthly_provider_budget_usd NUMERIC(10, 2) NOT NULL DEFAULT 25.00,
  provider_priority JSONB DEFAULT '["manifold_inventory","approved_feed","serper","google_cse","brave_search"]'::jsonb,
  last_scheduled_run_at TIMESTAMPTZ,
  next_scheduled_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.pricing_agent_config (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.pricing_agent_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage pricing agent config" ON public.pricing_agent_config;
CREATE POLICY "Admins manage pricing agent config" ON public.pricing_agent_config
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

REVOKE ALL ON public.pricing_agent_config FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_agent_config TO authenticated;
GRANT ALL ON public.pricing_agent_config TO service_role;

-- ------------------------------------------------------------------------------
-- 4. PRICING AGENT RUNS (Execution Progress, Source Failures, Duplicates)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'scheduled', 'targeted'
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'partial', 'failed', 'skipped_fresh', 'paused'
  target_vehicles JSONB DEFAULT '[]'::jsonb,
  queries_executed INTEGER NOT NULL DEFAULT 0,
  urls_fetched INTEGER NOT NULL DEFAULT 0,
  observations_collected INTEGER NOT NULL DEFAULT 0,
  observations_rejected INTEGER NOT NULL DEFAULT 0,
  duplicates_detected INTEGER NOT NULL DEFAULT 0,
  restricted_sources_count INTEGER NOT NULL DEFAULT 0,
  estimates_updated INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  provider_usage JSONB DEFAULT '{}'::jsonb,
  source_outcomes JSONB DEFAULT '[]'::jsonb,
  error_summary TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pricing_agent_runs_started_at
  ON public.pricing_agent_runs (started_at DESC);

ALTER TABLE public.pricing_agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage pricing agent runs" ON public.pricing_agent_runs;
CREATE POLICY "Admins manage pricing agent runs" ON public.pricing_agent_runs
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

REVOKE ALL ON public.pricing_agent_runs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_agent_runs TO authenticated;
GRANT ALL ON public.pricing_agent_runs TO service_role;

-- ------------------------------------------------------------------------------
-- 5. PRICING PROVIDER USAGE & QUOTA TRACKING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_provider_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id UUID REFERENCES public.pricing_agent_runs(id) ON DELETE SET NULL,
  provider_key TEXT NOT NULL,
  query_text TEXT,
  results_count INTEGER NOT NULL DEFAULT 0,
  http_status INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pricing_provider_usage
  ADD COLUMN IF NOT EXISTS agent_run_id UUID REFERENCES public.pricing_agent_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pricing_provider_usage_created
  ON public.pricing_provider_usage (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pricing_provider_usage_provider
  ON public.pricing_provider_usage (provider_key, created_at DESC);

ALTER TABLE public.pricing_provider_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage pricing provider usage" ON public.pricing_provider_usage;
CREATE POLICY "Admins manage pricing provider usage" ON public.pricing_provider_usage
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

REVOKE ALL ON public.pricing_provider_usage FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_provider_usage TO authenticated;
GRANT ALL ON public.pricing_provider_usage TO service_role;

-- ------------------------------------------------------------------------------
-- 6. OPTIONAL AI GOVERNANCE ENTRY FOR PRICING AGENT
-- ------------------------------------------------------------------------------
INSERT INTO public.ai_feature_settings (
  module_key, display_name, description, enabled, max_requests_per_min, max_output_tokens, monthly_budget_usd
)
VALUES (
  'pricing_agent',
  'AI Automotive Pricing Agent',
  'Automated market search extraction, variant normalization, and comparable explanation.',
  true,
  20,
  1100,
  50.00
)
ON CONFLICT (module_key) DO NOTHING;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
