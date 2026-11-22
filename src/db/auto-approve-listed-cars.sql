-- ==============================================================================
-- MANIFOLD: AUTO-APPROVE ALL LISTED DEALER VEHICLES (NO REVIEW QUEUE)
-- ==============================================================================
-- Safe, non-destructive, idempotent SQL migration.
-- Purpose:
--   1. Updates Dealer INSERT / UPDATE RLS policies on public.cars so approved
--      dealers publish vehicles directly with status = 'PUBLISHED' (bypassing
--      the manual PENDING_REVIEW queue).
--   2. Promotes any existing vehicles currently in 'PENDING_REVIEW' to
--      'PUBLISHED' while preserving 'DRAFT', 'SOLD', 'RESERVED', and 'ARCHIVED'.
-- ==============================================================================

-- 1. Ensure 'PUBLISHED' is permitted on public.cars.status (if ENUM or CHECK)
DO $$
DECLARE
  v_udt_schema TEXT;
  v_udt_name TEXT;
  v_data_type TEXT;
BEGIN
  SELECT c.data_type, c.udt_schema, c.udt_name
  INTO v_data_type, v_udt_schema, v_udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'cars'
    AND c.column_name = 'status';

  IF v_data_type = 'USER-DEFINED' AND v_udt_name IS NOT NULL THEN
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS ''PUBLISHED''', v_udt_schema, v_udt_name);
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS ''DRAFT''', v_udt_schema, v_udt_name);
  END IF;
END $$;

-- 2. Update Dealer RLS policies on public.cars to allow immediate 'PUBLISHED' listings
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dealers insert own cars" ON public.cars;
CREATE POLICY "Dealers insert own cars" ON public.cars
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_approved_dealer()
    AND public.current_dealer_id() IS NOT NULL
    AND dealer_id::TEXT = public.current_dealer_id()::TEXT
    AND pg_catalog.upper(COALESCE(status::TEXT, 'DRAFT')) IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED')
    AND COALESCE(is_verified, false) = false
    AND COALESCE(is_featured, false) = false
  );

DROP POLICY IF EXISTS "Dealers update own cars" ON public.cars;
CREATE POLICY "Dealers update own cars" ON public.cars
  FOR UPDATE TO authenticated
  USING (
    public.current_dealer_id() IS NOT NULL
    AND dealer_id::TEXT = public.current_dealer_id()::TEXT
  )
  WITH CHECK (
    public.current_dealer_id() IS NOT NULL
    AND dealer_id::TEXT = public.current_dealer_id()::TEXT
    AND pg_catalog.upper(COALESCE(status::TEXT, 'DRAFT')) IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'SOLD', 'ARCHIVED')
    AND (
      public.is_approved_dealer()
      OR pg_catalog.upper(COALESCE(status::TEXT, '')) IN ('DRAFT', 'ARCHIVED', 'SOLD')
    )
  );

-- 3. Auto-approve any existing listings currently waiting in PENDING_REVIEW
UPDATE public.cars
SET status = 'PUBLISHED',
    updated_at = NOW()
WHERE pg_catalog.upper(COALESCE(status::TEXT, '')) = 'PENDING_REVIEW';

-- 4. Force PostgREST to reload schema/policy state
NOTIFY pgrst, 'reload schema';
