-- ==============================================================================
-- MANIFOLD — VEHICLE IMAGES STORAGE RLS & CLEAN UNIQUE DEALER SLUGS MIGRATION
-- ==============================================================================
-- Idempotent, non-destructive migration for existing MANIFOLD databases.
-- Does NOT create duplicate tables or duplicate buckets.
-- Targets existing:
--   - Storage bucket: 'vehicle-images' (strict 100 KB / 102,400 bytes max)
--   - public.dealers (clean collision-free slug backfill + unique index)
--   - public.create_dealer_onboarding & public.admin_create_partner_dealer
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENSURE EXISTING 'vehicle-images' BUCKET CONFIGURATION (100 KB LIMIT)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-images',
  'vehicle-images',
  true,
  102400,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 102400,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- ------------------------------------------------------------------------------
-- 1B. SAFE PLAYER CHECK HELPER (targets actual public.player_profiles table)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_game_player()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_player BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF pg_catalog.to_regclass('public.player_profiles') IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.player_profiles pp WHERE pp.user_id = $1)'
    INTO v_is_player
    USING v_uid;

  RETURN COALESCE(v_is_player, false);
END;
$$;

REVOKE ALL ON FUNCTION public.is_game_player() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_game_player() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. STORAGE RLS POLICIES FOR 'vehicle-images'
--    Path convention: {dealer_id}/{vehicle_id}/(front-exterior|cabin).(webp|jpg|jpeg|png)
--    Access rules:
--      - Public: read-only (SELECT)
--      - Approved, active Dealers: INSERT/UPDATE/DELETE only inside own dealer_id folder
--      - Active Admins: full INSERT/UPDATE/DELETE
--      - Game Players: strictly forbidden from uploading/modifying/deleting
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read vehicle images" ON storage.objects;
DROP POLICY IF EXISTS "Dealers upload own vehicle images" ON storage.objects;
DROP POLICY IF EXISTS "Dealers update own vehicle images" ON storage.objects;
DROP POLICY IF EXISTS "Dealers delete own vehicle images" ON storage.objects;

CREATE POLICY "Public read vehicle images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'vehicle-images');

CREATE POLICY "Dealers upload own vehicle images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-images'
  AND (
    metadata IS NULL
    OR (
      COALESCE((metadata->>'size')::BIGINT, 1) BETWEEN 1 AND 102400
      AND (
        metadata->>'mimetype' IS NULL
        OR pg_catalog.lower(metadata->>'mimetype') IN ('image/jpeg', 'image/png', 'image/webp')
      )
    )
  )
  AND NOT public.is_game_player()
  AND array_length(storage.foldername(name), 1) = 2
  AND pg_catalog.split_part(name, '/', 3) ~* '^(front-exterior|cabin)\.(webp|jpe?g|png)$'
  AND (
    public.is_active_admin()
    OR (
      public.is_approved_dealer()
      AND public.current_dealer_id() IS NOT NULL
      AND (storage.foldername(name))[1] = public.current_dealer_id()::TEXT
    )
  )
);

CREATE POLICY "Dealers update own vehicle images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vehicle-images'
  AND NOT public.is_game_player()
  AND array_length(storage.foldername(name), 1) = 2
  AND (
    public.is_active_admin()
    OR (
      public.is_approved_dealer()
      AND public.current_dealer_id() IS NOT NULL
      AND (storage.foldername(name))[1] = public.current_dealer_id()::TEXT
    )
  )
)
WITH CHECK (
  bucket_id = 'vehicle-images'
  AND (
    metadata IS NULL
    OR (
      COALESCE((metadata->>'size')::BIGINT, 1) BETWEEN 1 AND 102400
      AND (
        metadata->>'mimetype' IS NULL
        OR pg_catalog.lower(metadata->>'mimetype') IN ('image/jpeg', 'image/png', 'image/webp')
      )
    )
  )
  AND NOT public.is_game_player()
  AND array_length(storage.foldername(name), 1) = 2
  AND pg_catalog.split_part(name, '/', 3) ~* '^(front-exterior|cabin)\.(webp|jpe?g|png)$'
  AND (
    public.is_active_admin()
    OR (
      public.is_approved_dealer()
      AND public.current_dealer_id() IS NOT NULL
      AND (storage.foldername(name))[1] = public.current_dealer_id()::TEXT
    )
  )
);

CREATE POLICY "Dealers delete own vehicle images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'vehicle-images'
  AND NOT public.is_game_player()
  AND (
    public.is_active_admin()
    OR (
      public.is_approved_dealer()
      AND public.current_dealer_id() IS NOT NULL
      AND (storage.foldername(name))[1] = public.current_dealer_id()::TEXT
    )
  )
);

-- ------------------------------------------------------------------------------
-- 3. DEALERS SLUG COLUMN, CLEAN BACKFILL & UNIQUE INDEX
-- ------------------------------------------------------------------------------
ALTER TABLE public.dealers ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.dealers ADD COLUMN IF NOT EXISTS business_name TEXT;

CREATE OR REPLACE FUNCTION public.generate_unique_dealer_slug(
  p_source_name TEXT,
  p_exclude_dealer_id TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_base TEXT;
  v_candidate TEXT;
  v_suffix INTEGER := 1;
  v_conflict BOOLEAN;
BEGIN
  v_base := pg_catalog.regexp_replace(
    pg_catalog.lower(pg_catalog.btrim(COALESCE(p_source_name, ''))),
    '[^a-z0-9]+',
    '-',
    'g'
  );
  v_base := pg_catalog.btrim(v_base, '-');

  IF v_base = '' THEN
    v_base := 'dealer';
  END IF;

  v_candidate := v_base;

  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.dealers d
      WHERE pg_catalog.lower(COALESCE(d.slug, '')) = pg_catalog.lower(v_candidate)
        AND (p_exclude_dealer_id IS NULL OR d.id::TEXT <> p_exclude_dealer_id)
    ) INTO v_conflict;

    EXIT WHEN NOT v_conflict;

    v_suffix := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix::TEXT;
  END LOOP;

  RETURN v_candidate;
END;
$$;

-- Backfill clean unique slugs for missing, blank, or legacy auto-hex-suffixed slugs,
-- and resolve any existing duplicates deterministically.
DO $$
DECLARE
  v_row RECORD;
  v_clean_slug TEXT;
  v_has_dupe BOOLEAN;
BEGIN
  FOR v_row IN
    SELECT
      d.id::TEXT AS id_text,
      d.slug,
      COALESCE(
        NULLIF(pg_catalog.btrim(pg_catalog.to_jsonb(d)->>'business_name'), ''),
        NULLIF(pg_catalog.btrim(pg_catalog.to_jsonb(d)->>'name'), ''),
        NULLIF(pg_catalog.btrim(pg_catalog.to_jsonb(d)->>'trading_name'), ''),
        NULLIF(pg_catalog.btrim(pg_catalog.to_jsonb(d)->>'dealership_name'), ''),
        'dealer'
      ) AS display_name
    FROM public.dealers d
    ORDER BY d.id::TEXT
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.dealers other
      WHERE other.id::TEXT <> v_row.id_text
        AND pg_catalog.lower(COALESCE(other.slug, '')) = pg_catalog.lower(COALESCE(v_row.slug, ''))
        AND COALESCE(pg_catalog.btrim(v_row.slug), '') <> ''
    ) INTO v_has_dupe;

    IF v_row.slug IS NULL
       OR pg_catalog.btrim(v_row.slug) = ''
       OR v_row.slug ~ '-[0-9a-f]{6}$'
       OR v_has_dupe
    THEN
      v_clean_slug := public.generate_unique_dealer_slug(v_row.display_name, v_row.id_text);
      UPDATE public.dealers
      SET slug = v_clean_slug
      WHERE id::TEXT = v_row.id_text;
    END IF;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dealers_slug_unique
ON public.dealers (pg_catalog.lower(slug))
WHERE slug IS NOT NULL AND pg_catalog.btrim(slug) <> '';

-- ------------------------------------------------------------------------------
-- 4. UPDATE DEALER CREATION RPCS TO USE CLEAN UNIQUE BUSINESS SLUGS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_dealer_onboarding(
  p_business_name TEXT,
  p_contact_name TEXT,
  p_phone TEXT,
  p_address_line_1 TEXT,
  p_address_line_2 TEXT DEFAULT NULL,
  p_city TEXT DEFAULT 'Lagos',
  p_state TEXT DEFAULT 'Lagos',
  p_country TEXT DEFAULT 'Nigeria',
  p_cac_registration_number TEXT DEFAULT NULL,
  p_business_type TEXT DEFAULT NULL,
  p_business_description TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_minimum_inventory_confirmed BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user_email TEXT;
  v_existing_dealer TEXT;
  v_dealer_uuid UUID := gen_random_uuid();
  v_dealer_id_type TEXT;
  v_da_dealer_id_type TEXT;
  v_slug TEXT;
  v_cols TEXT[] := ARRAY[]::TEXT[];
  v_vals TEXT[] := ARRAY[]::TEXT[];
  v_col TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authenticated user session required';
  END IF;

  IF NOT COALESCE(p_minimum_inventory_confirmed, false) THEN
    RAISE EXCEPTION 'Minimum inventory of 5 vehicles must be confirmed';
  END IF;

  IF p_business_name IS NULL OR pg_catalog.length(pg_catalog.btrim(p_business_name)) = 0 THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  IF p_address_line_1 IS NULL OR pg_catalog.length(pg_catalog.btrim(p_address_line_1)) = 0 THEN
    RAISE EXCEPTION 'Primary business address is required';
  END IF;

  SELECT da.dealer_id::TEXT INTO v_existing_dealer
  FROM public.dealer_accounts da
  WHERE da.user_id = v_uid
  LIMIT 1;

  IF FOUND AND v_existing_dealer IS NOT NULL THEN
    RAISE EXCEPTION 'A dealer account already exists for this user';
  END IF;

  SELECT COALESCE(au.email, '') INTO v_user_email
  FROM auth.users au
  WHERE au.id = v_uid;

  v_slug := public.generate_unique_dealer_slug(p_business_name, NULL);

  SELECT c.data_type INTO v_dealer_id_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'dealers' AND c.column_name = 'id';

  IF v_dealer_id_type = 'uuid' THEN
    v_cols := array_append(v_cols, 'id');
    v_vals := array_append(v_vals, pg_catalog.quote_literal(v_dealer_uuid::TEXT) || '::uuid');
  ELSE
    v_cols := array_append(v_cols, 'id');
    v_vals := array_append(v_vals, pg_catalog.quote_literal(v_dealer_uuid::TEXT));
  END IF;

  FOR v_col IN
    SELECT c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'dealers'
      AND c.column_name IN (
        'name', 'business_name', 'slug', 'contact_name', 'phone', 'email',
        'address', 'city', 'state', 'country', 'description', 'is_verified', 'dealer_status', 'joined_year'
      )
  LOOP
    v_cols := array_append(v_cols, pg_catalog.quote_ident(v_col));
    IF v_col IN ('name', 'business_name') THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(pg_catalog.btrim(p_business_name)));
    ELSIF v_col = 'slug' THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(v_slug));
    ELSIF v_col = 'contact_name' THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(COALESCE(NULLIF(pg_catalog.btrim(p_contact_name), ''), pg_catalog.btrim(p_business_name))));
    ELSIF v_col = 'phone' THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(COALESCE(NULLIF(pg_catalog.btrim(p_phone), ''), '')));
    ELSIF v_col = 'email' THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(v_user_email));
    ELSIF v_col = 'address' THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(pg_catalog.btrim(p_address_line_1)));
    ELSIF v_col = 'city' THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(COALESCE(NULLIF(pg_catalog.btrim(p_city), ''), 'Lagos')));
    ELSIF v_col = 'state' THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(COALESCE(NULLIF(pg_catalog.btrim(p_state), ''), 'Lagos')));
    ELSIF v_col = 'country' THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(COALESCE(NULLIF(pg_catalog.btrim(p_country), ''), 'Nigeria')));
    ELSIF v_col = 'description' THEN
      v_vals := array_append(v_vals, CASE WHEN p_business_description IS NULL THEN 'NULL' ELSE pg_catalog.quote_literal(pg_catalog.btrim(p_business_description)) END);
    ELSIF v_col = 'is_verified' THEN
      v_vals := array_append(v_vals, 'false');
    ELSIF v_col = 'dealer_status' THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal('pending'));
    ELSIF v_col = 'joined_year' THEN
      v_vals := array_append(v_vals, EXTRACT(YEAR FROM pg_catalog.now())::INTEGER::TEXT);
    END IF;
  END LOOP;

  EXECUTE format(
    'INSERT INTO public.dealers (%s) VALUES (%s)',
    pg_catalog.array_to_string(v_cols, ', '),
    pg_catalog.array_to_string(v_vals, ', ')
  );

  SELECT c.data_type INTO v_da_dealer_id_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'dealer_accounts' AND c.column_name = 'dealer_id';

  IF v_da_dealer_id_type = 'uuid' THEN
    INSERT INTO public.dealer_accounts (
      user_id, dealer_id, account_status, onboarding_status, updated_at
    ) VALUES (
      v_uid, v_dealer_uuid, 'pending', 'completed', pg_catalog.now()
    );
  ELSE
    INSERT INTO public.dealer_accounts (
      user_id, dealer_id, account_status, onboarding_status, updated_at
    ) VALUES (
      v_uid, v_dealer_uuid::TEXT, 'pending', 'completed', pg_catalog.now()
    );
  END IF;

  BEGIN
    IF v_dealer_id_type = 'uuid' THEN
      INSERT INTO public.dealer_business_profiles (
        dealer_id, trading_name, business_type, business_description, website, cac_registration_number
      ) VALUES (
        v_dealer_uuid,
        pg_catalog.btrim(p_business_name),
        COALESCE(NULLIF(pg_catalog.btrim(p_business_type), ''), 'Automobile Dealership'),
        NULLIF(pg_catalog.btrim(COALESCE(p_business_description, '')), ''),
        NULLIF(pg_catalog.btrim(COALESCE(p_website, '')), ''),
        NULLIF(pg_catalog.btrim(COALESCE(p_cac_registration_number, '')), '')
      );
    ELSE
      INSERT INTO public.dealer_business_profiles (
        dealer_id, trading_name, business_type, business_description, website, cac_registration_number
      ) VALUES (
        v_dealer_uuid::TEXT,
        pg_catalog.btrim(p_business_name),
        COALESCE(NULLIF(pg_catalog.btrim(p_business_type), ''), 'Automobile Dealership'),
        NULLIF(pg_catalog.btrim(COALESCE(p_business_description, '')), ''),
        NULLIF(pg_catalog.btrim(COALESCE(p_website, '')), ''),
        NULLIF(pg_catalog.btrim(COALESCE(p_cac_registration_number, '')), '')
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    IF v_dealer_id_type = 'uuid' THEN
      INSERT INTO public.dealer_addresses (
        dealer_id, address_line_1, address_line_2, city, state, country
      ) VALUES (
        v_dealer_uuid,
        pg_catalog.btrim(p_address_line_1),
        NULLIF(pg_catalog.btrim(COALESCE(p_address_line_2, '')), ''),
        COALESCE(NULLIF(pg_catalog.btrim(p_city), ''), 'Lagos'),
        COALESCE(NULLIF(pg_catalog.btrim(p_state), ''), 'Lagos'),
        COALESCE(NULLIF(pg_catalog.btrim(p_country), ''), 'Nigeria')
      );
    ELSE
      INSERT INTO public.dealer_addresses (
        dealer_id, address_line_1, address_line_2, city, state, country
      ) VALUES (
        v_dealer_uuid::TEXT,
        pg_catalog.btrim(p_address_line_1),
        NULLIF(pg_catalog.btrim(COALESCE(p_address_line_2, '')), ''),
        COALESCE(NULLIF(pg_catalog.btrim(p_city), ''), 'Lagos'),
        COALESCE(NULLIF(pg_catalog.btrim(p_state), ''), 'Lagos'),
        COALESCE(NULLIF(pg_catalog.btrim(p_country), ''), 'Nigeria')
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN pg_catalog.jsonb_build_object(
    'dealer_id', v_dealer_uuid::TEXT,
    'business_name', pg_catalog.btrim(p_business_name),
    'slug', v_slug,
    'account_status', 'pending',
    'onboarding_status', 'completed',
    'approval_status', 'pending',
    'is_verified', false,
    'can_list_cars', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_partner_dealer(
  p_name TEXT,
  p_city TEXT DEFAULT 'Lekki',
  p_state TEXT DEFAULT 'Lagos',
  p_phone TEXT DEFAULT '',
  p_email TEXT DEFAULT '',
  p_address TEXT DEFAULT '',
  p_is_verified BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dealer_uuid UUID := gen_random_uuid();
  v_dealer_id_type TEXT;
  v_slug TEXT;
  v_cols TEXT[] := ARRAY[]::TEXT[];
  v_vals TEXT[] := ARRAY[]::TEXT[];
  v_col TEXT;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin authorization required';
  END IF;

  IF p_name IS NULL OR pg_catalog.length(pg_catalog.btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Dealership name is required';
  END IF;

  v_slug := public.generate_unique_dealer_slug(p_name, NULL);

  SELECT c.data_type INTO v_dealer_id_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'dealers' AND c.column_name = 'id';

  v_cols := array_append(v_cols, 'id');
  IF v_dealer_id_type = 'uuid' THEN
    v_vals := array_append(v_vals, pg_catalog.quote_literal(v_dealer_uuid::TEXT) || '::uuid');
  ELSE
    v_vals := array_append(v_vals, pg_catalog.quote_literal(v_dealer_uuid::TEXT));
  END IF;

  FOR v_col IN
    SELECT c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'dealers'
      AND c.column_name IN (
        'name', 'business_name', 'slug', 'city', 'state', 'address', 'phone', 'email', 'is_verified', 'dealer_status', 'joined_year'
      )
  LOOP
    v_cols := array_append(v_cols, pg_catalog.quote_ident(v_col));
    IF v_col IN ('name', 'business_name') THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(pg_catalog.btrim(p_name)));
    ELSIF v_col = 'slug' THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(v_slug));
    ELSIF v_col = 'city' THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(COALESCE(NULLIF(pg_catalog.btrim(p_city), ''), 'Lekki')));
    ELSIF v_col = 'state' THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(COALESCE(NULLIF(pg_catalog.btrim(p_state), ''), 'Lagos')));
    ELSIF v_col = 'address' THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(COALESCE(pg_catalog.btrim(p_address), '')));
    ELSIF v_col = 'phone' THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(COALESCE(NULLIF(pg_catalog.btrim(p_phone), ''), '')));
    ELSIF v_col = 'email' THEN
      v_vals := array_append(v_vals, pg_catalog.quote_literal(COALESCE(pg_catalog.btrim(p_email), '')));
    ELSIF v_col = 'is_verified' THEN
      v_vals := array_append(v_vals, CASE WHEN COALESCE(p_is_verified, true) THEN 'true' ELSE 'false' END);
    ELSIF v_col = 'dealer_status' THEN
      v_vals := array_append(v_vals, CASE WHEN COALESCE(p_is_verified, true) THEN pg_catalog.quote_literal('approved') ELSE pg_catalog.quote_literal('pending') END);
    ELSIF v_col = 'joined_year' THEN
      v_vals := array_append(v_vals, EXTRACT(YEAR FROM pg_catalog.now())::INTEGER::TEXT);
    END IF;
  END LOOP;

  EXECUTE format(
    'INSERT INTO public.dealers (%s) VALUES (%s)',
    pg_catalog.array_to_string(v_cols, ', '),
    pg_catalog.array_to_string(v_vals, ', ')
  );

  RETURN pg_catalog.jsonb_build_object(
    'id', v_dealer_uuid::TEXT,
    'name', pg_catalog.btrim(p_name),
    'slug', v_slug,
    'city', COALESCE(NULLIF(pg_catalog.btrim(p_city), ''), 'Lekki'),
    'state', COALESCE(NULLIF(pg_catalog.btrim(p_state), ''), 'Lagos'),
    'verified_partner', COALESCE(p_is_verified, true),
    'joined_year', EXTRACT(YEAR FROM pg_catalog.now())::INTEGER
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
