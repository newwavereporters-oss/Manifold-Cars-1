-- ==============================================================================
-- MANIFOLD — Dealer Vehicle Creation & Persistence Fix (Idempotent / Safe)
-- ==============================================================================
-- Safety Guarantees:
--   - Does NOT drop tables or delete existing vehicle / dealer / user records.
--   - Compatible with BOTH UUID and TEXT primary/foreign keys on cars, dealers,
--     car_media, and car_images.
--   - Ensures optional/denormalized listing columns exist cleanly.
--   - Ensures public.cars.status accepts DRAFT and PENDING_REVIEW cleanly.
--   - Ensures YouTube media columns on public.cars and public.car_media are
--     optional (nullable) so dealers can submit vehicles without a video URL.
--   - Adds missing least-privilege Dealer RLS policies on public.car_media and
--     public.car_images while reinforcing strict dealer ownership on public.cars.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SAFE ADDITIVE SCHEMA ALIGNMENT ON public.cars
-- ------------------------------------------------------------------------------
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS variant TEXT,
  ADD COLUMN IF NOT EXISTS trim TEXT,
  ADD COLUMN IF NOT EXISTS previous_price BIGINT,
  ADD COLUMN IF NOT EXISTS original_price BIGINT,
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS short_summary TEXT,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS youtube_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_video_id TEXT,
  ADD COLUMN IF NOT EXISTS youtube_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS gallery_image_1_url TEXT,
  ADD COLUMN IF NOT EXISTS gallery_image_2_url TEXT;

-- Ensure optional YouTube fields on public.cars & public.car_media permit NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cars' AND column_name = 'youtube_url' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.cars ALTER COLUMN youtube_url DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cars' AND column_name = 'youtube_video_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.cars ALTER COLUMN youtube_video_id DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'car_media' AND column_name = 'youtube_url' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.car_media ALTER COLUMN youtube_url DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'car_media' AND column_name = 'youtube_video_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.car_media ALTER COLUMN youtube_video_id DROP NOT NULL;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. ENSURE public.cars.status SUPPORTS 'DRAFT' & 'PENDING_REVIEW'
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_udt_schema TEXT;
  v_udt_name TEXT;
  v_data_type TEXT;
  v_con RECORD;
BEGIN
  SELECT c.data_type, c.udt_schema, c.udt_name
  INTO v_data_type, v_udt_schema, v_udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'cars'
    AND c.column_name = 'status';

  IF v_data_type = 'USER-DEFINED' AND v_udt_name IS NOT NULL THEN
    -- Add missing enum labels safely if status uses a PostgreSQL ENUM
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS ''DRAFT''', v_udt_schema, v_udt_name);
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS ''PENDING_REVIEW''', v_udt_schema, v_udt_name);
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS ''PUBLISHED''', v_udt_schema, v_udt_name);
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS ''RESERVED''', v_udt_schema, v_udt_name);
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS ''SOLD''', v_udt_schema, v_udt_name);
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS ''ARCHIVED''', v_udt_schema, v_udt_name);
  ELSE
    -- Drop overly narrow CHECK constraints on status and replace with full MANIFOLD lifecycle statuses
    FOR v_con IN
      SELECT con.conname
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'cars'
        AND con.contype = 'c'
        AND pg_catalog.pg_get_constraintdef(con.oid) ~* '\mstatus\M'
    LOOP
      EXECUTE format('ALTER TABLE public.cars DROP CONSTRAINT %I', v_con.conname);
    END LOOP;

    ALTER TABLE public.cars
      ADD CONSTRAINT cars_status_check
      CHECK (
        pg_catalog.upper(COALESCE(status::TEXT, '')) IN (
          'DRAFT',
          'PENDING_REVIEW',
          'PUBLISHED',
          'RESERVED',
          'SOLD',
          'ARCHIVED'
        )
      );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. HELPER INDEXES FOR DEALER VEHICLE QUERIES & MEDIA LOOKUPS
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cars_dealer_id_created_at
  ON public.cars (dealer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_car_media_car_id
  ON public.car_media (car_id);

CREATE INDEX IF NOT EXISTS idx_car_images_car_id_position
  ON public.car_images (car_id, position);

-- ------------------------------------------------------------------------------
-- 4. HARDEN DEALER RLS POLICIES ON public.cars
-- ------------------------------------------------------------------------------
-- Guarantees:
--   - Dealers can ONLY view, insert, update, and delete rows where dealer_id
--     matches public.current_dealer_id().
--   - Approved dealers can ONLY insert vehicles with DRAFT or PENDING_REVIEW
--     status, is_verified = false, and is_featured = false.
--   - Admins retain full management access; public sees PUBLISHED cars.
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dealers manage own cars" ON public.cars;
DROP POLICY IF EXISTS "Dealers view own cars" ON public.cars;
DROP POLICY IF EXISTS "Dealers insert own cars" ON public.cars;
DROP POLICY IF EXISTS "Dealers update own cars" ON public.cars;
DROP POLICY IF EXISTS "Dealers delete own cars" ON public.cars;

CREATE POLICY "Dealers view own cars" ON public.cars
  FOR SELECT TO authenticated
  USING (
    (public.current_dealer_id() IS NOT NULL AND dealer_id::TEXT = public.current_dealer_id()::TEXT)
    OR public.is_active_admin()
  );

CREATE POLICY "Dealers insert own cars" ON public.cars
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_approved_dealer()
    AND public.current_dealer_id() IS NOT NULL
    AND dealer_id::TEXT = public.current_dealer_id()::TEXT
    AND pg_catalog.upper(COALESCE(status::TEXT, 'DRAFT')) IN ('DRAFT', 'PENDING_REVIEW')
    AND COALESCE(is_verified, false) = false
    AND COALESCE(is_featured, false) = false
  );

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

CREATE POLICY "Dealers delete own cars" ON public.cars
  FOR DELETE TO authenticated
  USING (
    public.current_dealer_id() IS NOT NULL
    AND dealer_id::TEXT = public.current_dealer_id()::TEXT
  );

-- ------------------------------------------------------------------------------
-- 5. ADD MISSING DEALER RLS POLICIES ON public.car_media & public.car_images
-- ------------------------------------------------------------------------------
-- Previously car_media and car_images only allowed public read of 'published'
-- rows and admin full access, which blocked dealers from reading/writing media
-- rows attached to their DRAFT / PENDING_REVIEW vehicles.
ALTER TABLE public.car_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dealers view own car media" ON public.car_media;
DROP POLICY IF EXISTS "Dealers insert own car media" ON public.car_media;
DROP POLICY IF EXISTS "Dealers update own car media" ON public.car_media;
DROP POLICY IF EXISTS "Dealers delete own car media" ON public.car_media;

CREATE POLICY "Dealers view own car media" ON public.car_media
  FOR SELECT TO authenticated
  USING (
    public.is_active_admin()
    OR (
      public.current_dealer_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.cars c
        WHERE c.id::TEXT = car_media.car_id::TEXT
          AND c.dealer_id::TEXT = public.current_dealer_id()::TEXT
      )
    )
  );

CREATE POLICY "Dealers insert own car media" ON public.car_media
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_admin()
    OR (
      public.current_dealer_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.cars c
        WHERE c.id::TEXT = car_media.car_id::TEXT
          AND c.dealer_id::TEXT = public.current_dealer_id()::TEXT
      )
    )
  );

CREATE POLICY "Dealers update own car media" ON public.car_media
  FOR UPDATE TO authenticated
  USING (
    public.is_active_admin()
    OR (
      public.current_dealer_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.cars c
        WHERE c.id::TEXT = car_media.car_id::TEXT
          AND c.dealer_id::TEXT = public.current_dealer_id()::TEXT
      )
    )
  )
  WITH CHECK (
    public.is_active_admin()
    OR (
      public.current_dealer_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.cars c
        WHERE c.id::TEXT = car_media.car_id::TEXT
          AND c.dealer_id::TEXT = public.current_dealer_id()::TEXT
      )
    )
  );

CREATE POLICY "Dealers delete own car media" ON public.car_media
  FOR DELETE TO authenticated
  USING (
    public.is_active_admin()
    OR (
      public.current_dealer_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.cars c
        WHERE c.id::TEXT = car_media.car_id::TEXT
          AND c.dealer_id::TEXT = public.current_dealer_id()::TEXT
      )
    )
  );

DROP POLICY IF EXISTS "Dealers view own car images" ON public.car_images;
DROP POLICY IF EXISTS "Dealers insert own car images" ON public.car_images;
DROP POLICY IF EXISTS "Dealers update own car images" ON public.car_images;
DROP POLICY IF EXISTS "Dealers delete own car images" ON public.car_images;

CREATE POLICY "Dealers view own car images" ON public.car_images
  FOR SELECT TO authenticated
  USING (
    public.is_active_admin()
    OR (
      public.current_dealer_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.cars c
        WHERE c.id::TEXT = car_images.car_id::TEXT
          AND c.dealer_id::TEXT = public.current_dealer_id()::TEXT
      )
    )
  );

CREATE POLICY "Dealers insert own car images" ON public.car_images
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_admin()
    OR (
      public.current_dealer_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.cars c
        WHERE c.id::TEXT = car_images.car_id::TEXT
          AND c.dealer_id::TEXT = public.current_dealer_id()::TEXT
      )
    )
  );

CREATE POLICY "Dealers update own car images" ON public.car_images
  FOR UPDATE TO authenticated
  USING (
    public.is_active_admin()
    OR (
      public.current_dealer_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.cars c
        WHERE c.id::TEXT = car_images.car_id::TEXT
          AND c.dealer_id::TEXT = public.current_dealer_id()::TEXT
      )
    )
  )
  WITH CHECK (
    public.is_active_admin()
    OR (
      public.current_dealer_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.cars c
        WHERE c.id::TEXT = car_images.car_id::TEXT
          AND c.dealer_id::TEXT = public.current_dealer_id()::TEXT
      )
    )
  );

CREATE POLICY "Dealers delete own car images" ON public.car_images
  FOR DELETE TO authenticated
  USING (
    public.is_active_admin()
    OR (
      public.current_dealer_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.cars c
        WHERE c.id::TEXT = car_images.car_id::TEXT
          AND c.dealer_id::TEXT = public.current_dealer_id()::TEXT
      )
    )
  );
