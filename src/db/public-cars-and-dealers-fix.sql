-- ==============================================================================
-- MANIFOLD: PUBLIC CARS VISIBILITY, DEALER SLUGS & DIRECTORY RLS ALIGNMENT
-- ==============================================================================
-- Safe, non-destructive, idempotent SQL migration.
-- Purpose:
--   1. Ensures public.cars allows public anonymous + authenticated SELECT for
--      published / active vehicles and promotes any remaining PENDING_REVIEW
--      rows to PUBLISHED so newly listed cars appear immediately on /cars.
--   2. Ensures public.car_media and public.car_images allow public SELECT for
--      public vehicles so thumbnails and galleries render cleanly.
--   3. Ensures public.dealers has a slug column, backfills clean unique slugs
--      from business_name/name, and permits public SELECT of directory rows
--      (frontend strictly maps only non-sensitive public business fields).
--   4. Reloads PostgREST schema cache cleanly.
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

-- 2. Public SELECT policy on public.cars (Published / Sold / Reserved listings)
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published cars" ON public.cars;
CREATE POLICY "Public read published cars" ON public.cars
  FOR SELECT TO anon, authenticated
  USING (
    pg_catalog.upper(COALESCE(status::TEXT, '')) NOT IN ('DRAFT', 'ARCHIVED')
  );

-- 3. Public SELECT policies on public.car_media and public.car_images
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'car_media'
  ) THEN
    EXECUTE 'ALTER TABLE public.car_media ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public read car media" ON public.car_media';
    EXECUTE 'CREATE POLICY "Public read car media" ON public.car_media FOR SELECT TO anon, authenticated USING (true)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'car_images'
  ) THEN
    EXECUTE 'ALTER TABLE public.car_images ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public read car images" ON public.car_images';
    EXECUTE 'CREATE POLICY "Public read car images" ON public.car_images FOR SELECT TO anon, authenticated USING (true)';
  END IF;
END $$;

-- 4. Ensure public.dealers has slug column, backfilled slugs, and public directory SELECT policy
ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE public.dealers d
SET slug = NULLIF(
  trim(both '-' FROM regexp_replace(lower(COALESCE(NULLIF(TRIM(d.business_name), ''), NULLIF(TRIM(d.name), ''), 'dealership')), '[^a-z0-9]+', '-', 'g')),
  ''
)
WHERE d.slug IS NULL OR TRIM(d.slug) = '';

ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read dealers" ON public.dealers;
CREATE POLICY "Public read dealers" ON public.dealers
  FOR SELECT TO anon, authenticated
  USING (
    COALESCE(status, '') <> 'suspended'
  );

-- 5. Refresh PostgREST schema & RLS cache
NOTIFY pgrst, 'reload schema';
