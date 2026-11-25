-- ==============================================================================
-- MANIFOLD: PUBLIC CARS VISIBILITY, ANON RLS FIX, DEALER SLUGS & DIRECTORY ALIGNMENT
-- ==============================================================================
-- Safe, non-destructive, idempotent SQL migration.
-- Purpose:
--   1. Fixes ERROR 42501 ("permission denied for function current_dealer_id" /
--      "permission denied for function is_active_admin") on anonymous public
--      SELECT queries against public.cars, public.car_brand_inventory,
--      public.car_brands, public.car_models, public.car_types, public.dealers,
--      public.car_media, and public.car_images by isolating ALL helper-function
--      policies strictly TO authenticated while keeping public SELECT policies
--      (`TO anon, authenticated`) purely column-based.
--   2. Promotes any remaining PENDING_REVIEW rows to PUBLISHED so newly listed
--      cars appear immediately on public /cars.
--   3. Ensures public.dealers has a slug column, backfills clean unique slugs
--      from business_name/name, and uses dealer_status (never non-existent status).
--   4. Grants explicit SELECT privileges on catalog tables and car_brand_inventory
--      view to anon, authenticated and reloads PostgREST schema cache.
-- ==============================================================================

-- 1. Ensure status enum values (if ENUM type is used) and promote PENDING_REVIEW
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

UPDATE public.cars
SET status = 'PUBLISHED',
    updated_at = NOW()
WHERE pg_catalog.upper(COALESCE(status::TEXT, '')) = 'PENDING_REVIEW';

-- 2. Remove any legacy public/anon RLS policies on catalog tables that call
--    authenticated-only helper functions (e.g. current_dealer_id(), is_active_admin())
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('cars', 'dealers', 'car_media', 'car_images', 'car_brands', 'car_models', 'car_types')
      AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
      AND (
        COALESCE(qual, '') ~* '(current_dealer_id|is_approved_dealer|is_active_dealer|is_active_admin|is_admin)'
        OR COALESCE(with_check, '') ~* '(current_dealer_id|is_approved_dealer|is_active_dealer|is_active_admin|is_admin)'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- 3. Public + Authenticated policies on public.cars
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published cars" ON public.cars;
CREATE POLICY "Public read published cars" ON public.cars
  FOR SELECT TO anon, authenticated
  USING (
    pg_catalog.upper(COALESCE(status::TEXT, '')) NOT IN ('DRAFT', 'ARCHIVED')
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'current_dealer_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Dealers view own cars" ON public.cars';
    EXECUTE 'CREATE POLICY "Dealers view own cars" ON public.cars FOR SELECT TO authenticated USING (public.current_dealer_id() IS NOT NULL AND dealer_id::TEXT = public.current_dealer_id()::TEXT)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_active_admin'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins read all cars" ON public.cars';
    EXECUTE 'CREATE POLICY "Admins read all cars" ON public.cars FOR SELECT TO authenticated USING (public.is_active_admin())';
    EXECUTE 'DROP POLICY IF EXISTS "Admins moderate cars" ON public.cars';
    EXECUTE 'CREATE POLICY "Admins moderate cars" ON public.cars FOR UPDATE TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin())';
    EXECUTE 'DROP POLICY IF EXISTS "Admins delete cars" ON public.cars';
    EXECUTE 'CREATE POLICY "Admins delete cars" ON public.cars FOR DELETE TO authenticated USING (public.is_active_admin())';
  END IF;
END $$;

-- 4. Public + Admin policies on car_media, car_images, car_brands, car_models, car_types
DO $$
DECLARE
  has_admin_fn BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_active_admin'
  ) INTO has_admin_fn;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'car_media'
  ) THEN
    EXECUTE 'ALTER TABLE public.car_media ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public read car media" ON public.car_media';
    EXECUTE 'CREATE POLICY "Public read car media" ON public.car_media FOR SELECT TO anon, authenticated USING (true)';
    IF has_admin_fn THEN
      EXECUTE 'DROP POLICY IF EXISTS "Admins full access car media" ON public.car_media';
      EXECUTE 'CREATE POLICY "Admins full access car media" ON public.car_media FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin())';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'car_images'
  ) THEN
    EXECUTE 'ALTER TABLE public.car_images ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public read car images" ON public.car_images';
    EXECUTE 'CREATE POLICY "Public read car images" ON public.car_images FOR SELECT TO anon, authenticated USING (true)';
    IF has_admin_fn THEN
      EXECUTE 'DROP POLICY IF EXISTS "Admins full access car images" ON public.car_images';
      EXECUTE 'CREATE POLICY "Admins full access car images" ON public.car_images FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin())';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'car_brands'
  ) THEN
    EXECUTE 'ALTER TABLE public.car_brands ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public read active brands" ON public.car_brands';
    EXECUTE 'CREATE POLICY "Public read active brands" ON public.car_brands FOR SELECT TO anon, authenticated USING (COALESCE(is_active, true) = true)';
    IF has_admin_fn THEN
      EXECUTE 'DROP POLICY IF EXISTS "Admins full access brands" ON public.car_brands';
      EXECUTE 'CREATE POLICY "Admins full access brands" ON public.car_brands FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin())';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'car_models'
  ) THEN
    EXECUTE 'ALTER TABLE public.car_models ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public read active models" ON public.car_models';
    EXECUTE 'CREATE POLICY "Public read active models" ON public.car_models FOR SELECT TO anon, authenticated USING (COALESCE(is_active, true) = true)';
    IF has_admin_fn THEN
      EXECUTE 'DROP POLICY IF EXISTS "Admins full access models" ON public.car_models';
      EXECUTE 'CREATE POLICY "Admins full access models" ON public.car_models FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin())';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'car_types'
  ) THEN
    EXECUTE 'ALTER TABLE public.car_types ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public read active types" ON public.car_types';
    EXECUTE 'CREATE POLICY "Public read active types" ON public.car_types FOR SELECT TO anon, authenticated USING (COALESCE(is_active, true) = true)';
    IF has_admin_fn THEN
      EXECUTE 'DROP POLICY IF EXISTS "Admins full access types" ON public.car_types';
      EXECUTE 'CREATE POLICY "Admins full access types" ON public.car_types FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin())';
    END IF;
  END IF;
END $$;

-- 5. Ensure public.dealers has slug column, backfilled slugs, and public directory SELECT policy
ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE public.dealers d
SET slug = NULLIF(
  trim(both '-' FROM regexp_replace(lower(COALESCE(NULLIF(TRIM(pg_catalog.to_jsonb(d)->>'business_name'), ''), NULLIF(TRIM(pg_catalog.to_jsonb(d)->>'name'), ''), 'dealership')), '[^a-z0-9]+', '-', 'g')),
  ''
)
WHERE d.slug IS NULL OR TRIM(d.slug) = '';

ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read dealers" ON public.dealers;
CREATE POLICY "Public read dealers" ON public.dealers
  FOR SELECT TO anon, authenticated
  USING (
    COALESCE(
      NULLIF(TRIM(pg_catalog.to_jsonb(dealers)->>'dealer_status'), ''),
      NULLIF(TRIM(pg_catalog.to_jsonb(dealers)->>'status'), ''),
      'approved'
    ) NOT IN ('disapproved', 'suspended')
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_active_admin'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins full access dealers" ON public.dealers';
    EXECUTE 'CREATE POLICY "Admins full access dealers" ON public.dealers FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin())';
  END IF;
END $$;

-- 6. Ensure anon/authenticated roles have table & view SELECT privileges alongside RLS policies
GRANT USAGE ON SCHEMA public TO anon, authenticated;
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cars', 'dealers', 'car_media', 'car_images',
    'car_brands', 'car_models', 'car_types', 'car_brand_inventory'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) OR EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

-- 7. Refresh PostgREST schema & RLS cache
NOTIFY pgrst, 'reload schema';
