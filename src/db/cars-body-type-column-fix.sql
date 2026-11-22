-- ==============================================================================
-- MANIFOLD: TARGETED PUBLIC.CARS SCHEMA ALIGNMENT (BODY_TYPE, MAKE, MODEL)
-- ==============================================================================
-- Safe, non-destructive, idempotent SQL migration.
-- Purpose:
--   Resolves PostgREST PGRST204 ("Could not find the 'body_type' column of 'cars'
--   in the schema cache") and aligns the remaining confirmed missing columns
--   ("make", "model") used by dealerVehicleService.ts createDealerCar/updateDealerCar
--   and vehicle filters/search, which were omitted from supabase-schema.sql and
--   dealer-vehicle-persistence-fix.sql.
--
-- Guarantees:
--   - Uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--   - Preserves all existing vehicle records and RLS policies
--   - Does NOT drop, recreate, or alter unrelated columns on public.cars
-- ==============================================================================

-- 1. Add confirmed missing vehicle payload columns to public.cars
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS body_type TEXT DEFAULT 'SUV';

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS make TEXT;

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS model TEXT;

-- 2. Safely backfill ONLY missing/blank values on existing rows without overwriting existing data
DO $$
BEGIN
  -- Backfill body_type from public.car_types when type_id matches, defaulting remaining NULLs to 'SUV'
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cars' AND column_name = 'type_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'car_types'
  ) THEN
    UPDATE public.cars c
    SET body_type = ct.name
    FROM public.car_types ct
    WHERE c.type_id IS NOT NULL
      AND c.type_id::TEXT = ct.id::TEXT
      AND (c.body_type IS NULL OR BTRIM(c.body_type) = '');
  END IF;

  UPDATE public.cars
  SET body_type = 'SUV'
  WHERE body_type IS NULL OR BTRIM(body_type) = '';

  -- Backfill make from public.car_brands when brand_id matches
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cars' AND column_name = 'brand_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'car_brands'
  ) THEN
    UPDATE public.cars c
    SET make = cb.name
    FROM public.car_brands cb
    WHERE c.brand_id IS NOT NULL
      AND c.brand_id::TEXT = cb.id::TEXT
      AND (c.make IS NULL OR BTRIM(c.make) = '');
  END IF;

  -- Backfill model from public.car_models when model_id exists and matches
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cars' AND column_name = 'model_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'car_models'
  ) THEN
    UPDATE public.cars c
    SET model = cm.name
    FROM public.car_models cm
    WHERE c.model_id IS NOT NULL
      AND c.model_id::TEXT = cm.id::TEXT
      AND (c.model IS NULL OR BTRIM(c.model) = '');
  END IF;
END $$;

-- 3. Add non-breaking lookup indexes for marketplace body-type and make filtering
CREATE INDEX IF NOT EXISTS idx_cars_body_type ON public.cars (body_type);
CREATE INDEX IF NOT EXISTS idx_cars_make ON public.cars (make);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cars' AND column_name = 'type_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_cars_type_id ON public.cars (type_id);
  END IF;
END $$;

-- 4. Force PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';
