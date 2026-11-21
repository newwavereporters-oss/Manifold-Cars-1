-- ==============================================================================
-- MANIFOLD — Platform AI Usage, Governance, Search Analytics & Listing Fields
-- ==============================================================================
-- Idempotent migration adding:
--   1. public.ai_usage_logs (token, latency, cost, and error telemetry for Admin)
--   2. public.ai_feature_settings (module toggles, model overrides, budgets, rate caps)
--   3. public.ai_search_analytics (anonymized NL/voice search demand & zero-result trends)
--   4. Optional additive listing AI metadata columns on public.cars
-- Note: Preserves existing Gemini 768-dim knowledge_base embeddings intact.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADDITIVE AI LISTING METADATA COLUMNS ON public.cars (NEVER OVERWRITES title/model)
-- ------------------------------------------------------------------------------
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS short_summary TEXT,
  ADD COLUMN IF NOT EXISTS selling_highlights JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_meta_description TEXT,
  ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMPTZ;

-- ------------------------------------------------------------------------------
-- 2. AI USAGE LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_role TEXT NOT NULL DEFAULT 'buyer', -- 'admin', 'dealer', 'buyer', 'anonymous'
  dealer_id TEXT,
  feature_module TEXT NOT NULL, -- 'listing_copy', 'vehicle_search', 'voice_transcribe', 'price_intelligence', 'market_insights', 'assistant', 'health_test'
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON public.ai_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_module ON public.ai_usage_logs (feature_module);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON public.ai_usage_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_success ON public.ai_usage_logs (success);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read all AI usage logs" ON public.ai_usage_logs;
CREATE POLICY "Admins read all AI usage logs" ON public.ai_usage_logs
  FOR SELECT TO authenticated
  USING (public.is_active_admin());

DROP POLICY IF EXISTS "Authenticated users insert own AI usage logs" ON public.ai_usage_logs;
CREATE POLICY "Authenticated users insert own AI usage logs" ON public.ai_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Anonymous search assistant AI usage insert" ON public.ai_usage_logs;
CREATE POLICY "Anonymous search assistant AI usage insert" ON public.ai_usage_logs
  FOR INSERT TO anon
  WITH CHECK (
    user_id IS NULL
    AND user_role IN ('buyer', 'anonymous')
    AND feature_module IN ('vehicle_search', 'voice_transcribe', 'price_intelligence', 'assistant')
  );

-- ------------------------------------------------------------------------------
-- 3. AI FEATURE SETTINGS & GOVERNANCE TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_feature_settings (
  module_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  model_override TEXT,
  max_requests_per_min INTEGER NOT NULL DEFAULT 30,
  max_output_tokens INTEGER NOT NULL DEFAULT 900,
  monthly_budget_usd NUMERIC(10, 2) NOT NULL DEFAULT 150.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.ai_feature_settings (
  module_key, display_name, description, enabled, max_requests_per_min, max_output_tokens, monthly_budget_usd
)
VALUES
  ('listing_copy', 'Dealer Listing Intelligence', 'Structured descriptions, selling highlights, and SEO copy for approved dealers.', true, 25, 1100, 120.00),
  ('vehicle_search', 'Vehicle Intelligence Search', 'Natural-language vehicle search parsing, ranking, and zero-result recovery.', true, 40, 600, 150.00),
  ('voice_transcribe', 'Voice Search Transcription', 'Microphone speech-to-text tuned for Nigerian English automotive queries.', true, 15, 300, 80.00),
  ('price_intelligence', 'Price Intelligence Commentary', 'Grounded statistical valuation commentary over verified comparables.', true, 30, 650, 100.00),
  ('market_insights', 'Market Intelligence Synthesis', 'Executive supply, demand, and search-gap analytics for Admins and Dealers.', true, 20, 1000, 100.00),
  ('assistant', 'AI Automotive Assistant', 'Conversational buyer concierge and dealer advisor grounded in live inventory.', true, 30, 800, 150.00)
ON CONFLICT (module_key) DO NOTHING;

ALTER TABLE public.ai_feature_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read AI availability flags" ON public.ai_feature_settings;
CREATE POLICY "Public read AI availability flags" ON public.ai_feature_settings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage AI feature settings" ON public.ai_feature_settings;
CREATE POLICY "Admins manage AI feature settings" ON public.ai_feature_settings
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- ------------------------------------------------------------------------------
-- 4. PRIVACY-SAFE VEHICLE SEARCH ANALYTICS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  input_mode TEXT NOT NULL DEFAULT 'text', -- 'text', 'voice'
  parsed_make TEXT,
  parsed_model TEXT,
  parsed_body_type TEXT,
  parsed_location TEXT,
  parsed_condition TEXT,
  budget_max BIGINT,
  exact_match_count INTEGER NOT NULL DEFAULT 0,
  strong_match_count INTEGER NOT NULL DEFAULT 0,
  alternative_count INTEGER NOT NULL DEFAULT 0,
  zero_results BOOLEAN NOT NULL DEFAULT false,
  clicked_car_id TEXT,
  enquiry_converted BOOLEAN NOT NULL DEFAULT false,
  user_role TEXT NOT NULL DEFAULT 'buyer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_search_analytics_created_at ON public.ai_search_analytics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_search_analytics_zero ON public.ai_search_analytics (zero_results);
CREATE INDEX IF NOT EXISTS idx_ai_search_analytics_make ON public.ai_search_analytics (parsed_make);

ALTER TABLE public.ai_search_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can log non-PII search analytics" ON public.ai_search_analytics;
CREATE POLICY "Anyone can log non-PII search analytics" ON public.ai_search_analytics
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read all search analytics" ON public.ai_search_analytics;
CREATE POLICY "Admins read all search analytics" ON public.ai_search_analytics
  FOR SELECT TO authenticated
  USING (public.is_active_admin());

DROP POLICY IF EXISTS "Approved dealers read aggregated category analytics" ON public.ai_search_analytics;
CREATE POLICY "Approved dealers read aggregated category analytics" ON public.ai_search_analytics
  FOR SELECT TO authenticated
  USING (public.is_approved_dealer());
