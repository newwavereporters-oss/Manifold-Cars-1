-- ==============================================================================
-- MANIFOLD: TARGETED PUBLIC.CARS FULL DEALER PAYLOAD SCHEMA ALIGNMENT
-- ==============================================================================
-- Safe, non-destructive, idempotent SQL migration.
-- Purpose:
--   Resolves PostgREST PGRST204 ("Could not find the 'body_type' / 'state'
--   column of 'cars' in the schema cache") and aligns ALL columns sent by
--   dealerVehicleService.ts (createDealerCar & updateDealerCar) on public.cars
--   so no further one-by-one missing column errors occur.
--
-- Guarantees:
--   - Uses ALTER TABLE public.cars ADD COLUMN IF NOT EXISTS for every confirmed
--     payload column (a 100% no-op for columns that already exist, preserving
--     existing UUID/TEXT/ENUM types and constraints).
--   - Preserves all existing vehicle records and RLS policies.
--   - Does NOT drop, recreate, or alter unrelated columns on public.cars.
-- ==============================================================================

-- 1. Align ALL confirmed vehicle payload columns on public.cars
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS brand_id TEXT,
  ADD COLUMN IF NOT EXISTS make TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS variant TEXT,
  ADD COLUMN IF NOT EXISTS trim TEXT,
  ADD COLUMN IF NOT EXISTS type_id TEXT,
  ADD COLUMN IF NOT EXISTS body_type TEXT DEFAULT 'SUV',
  ADD COLUMN IF NOT EXISTS year INTEGER DEFAULT 2024,
  ADD COLUMN IF NOT EXISTS price BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_price BIGINT,
  ADD COLUMN IF NOT EXISTS original_price BIGINT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS mileage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'Foreign Used',
  ADD COLUMN IF NOT EXISTS fuel_type TEXT DEFAULT 'Petrol',
  ADD COLUMN IF NOT EXISTS transmission TEXT DEFAULT 'Automatic',
  ADD COLUMN IF NOT EXISTS drive_type TEXT DEFAULT 'AWD',
  ADD COLUMN IF NOT EXISTS engine TEXT,
  ADD COLUMN IF NOT EXISTS horsepower INTEGER,
  ADD COLUMN IF NOT EXISTS exterior_color TEXT DEFAULT 'Black',
  ADD COLUMN IF NOT EXISTS interior_color TEXT DEFAULT 'Black Leather',
  ADD COLUMN IF NOT EXISTS seats INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS doors INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'Lagos',
  ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'Lagos',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dealer_id TEXT,
  ADD COLUMN IF NOT EXISTS youtube_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_video_id TEXT,
  ADD COLUMN IF NOT EXISTS youtube_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS gallery_image_1_url TEXT,
  ADD COLUMN IF NOT EXISTS gallery_image_2_url TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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

  UPDATE public.cars
  SET state = 'Lagos'
  WHERE state IS NULL OR BTRIM(state) = '';

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
CREATE INDEX IF NOT EXISTS idx_cars_state ON public.cars (state);

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
