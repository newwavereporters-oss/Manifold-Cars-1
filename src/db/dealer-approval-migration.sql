-- ==============================================================================
-- MANIFOLD — Dealer Account Approval & Admin Directory Migration
-- ==============================================================================
-- Guarantees:
--   1. Admin Portal houses ALL dealer accounts (dealer_accounts + public.dealers).
--   2. Admin can Approve ('active' + is_verified=true) or Disapprove ('rejected' + is_verified=false)
--      or Suspend ('suspended') dealer accounts via SECURITY DEFINER RPCs.
--   3. Approval ONLY affects a dealer's ability to LIST cars (public.cars INSERT /
--      submitting for review). Unapproved ('pending' or 'rejected') dealers STILL
--      sign in and access their full dealer dashboard, business profile, and enquiries.
--   4. Newly registered dealers start as account_status = 'pending', is_verified = false.
--   5. Existing verified/active dealers remain approved without disruption.
--   6. Safe for BOTH UUID and TEXT public.dealers(id) schemas and both name/business_name columns.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENHANCE public.dealer_accounts WITH APPROVAL METADATA (IDEMPOTENT)
-- ------------------------------------------------------------------------------
ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS approval_notes TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS disapproved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure account_status CHECK constraint permits pending, active, rejected, suspended
DO $$
DECLARE
  v_con RECORD;
BEGIN
  FOR v_con IN
    SELECT c.conname
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'dealer_accounts'
      AND c.contype = 'c'
      AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%account_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.dealer_accounts DROP CONSTRAINT %I', v_con.conname);
  END LOOP;

  -- Normalize any unexpected legacy statuses safely to 'pending' before re-adding CHECK
  UPDATE public.dealer_accounts
  SET account_status = 'pending'
  WHERE account_status IS NULL
     OR account_status NOT IN ('pending', 'active', 'rejected', 'suspended');

  ALTER TABLE public.dealer_accounts
    ALTER COLUMN account_status SET DEFAULT 'pending';

  ALTER TABLE public.dealer_accounts
    ADD CONSTRAINT dealer_accounts_account_status_check
    CHECK (account_status IN ('pending', 'active', 'rejected', 'suspended'));
END $$;

-- Backfill approved_at for existing active dealers so audit fields are clean
UPDATE public.dealer_accounts
SET approved_at = COALESCE(approved_at, created_at, NOW())
WHERE account_status = 'active'
  AND approved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dealer_accounts_status
  ON public.dealer_accounts (account_status);

CREATE INDEX IF NOT EXISTS idx_dealer_accounts_dealer_id
  ON public.dealer_accounts (dealer_id);

-- ------------------------------------------------------------------------------
-- 1B. ADD dealer_status & is_verified COLUMNS TO public.dealers (IDEMPOTENT + BACKFILL)
-- ------------------------------------------------------------------------------
-- Note: Add both columns WITHOUT defaults first so pre-existing rows have NULL
-- and get accurately backfilled before NOT NULL / DEFAULT constraints are applied.
ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS dealer_status TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN;

DO $$
DECLARE
  v_con RECORD;
BEGIN
  FOR v_con IN
    SELECT c.conname
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'dealers'
      AND c.contype = 'c'
      AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%dealer_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.dealers DROP CONSTRAINT %I', v_con.conname);
  END LOOP;

  -- Reconcile existing dealer rows cleanly from dealer_accounts.account_status,
  -- pre-existing is_verified, or legacy verified_partner column (if present).
  UPDATE public.dealers d
  SET
    dealer_status = CASE
      WHEN d.dealer_status IN ('approved', 'disapproved') THEN d.dealer_status
      WHEN EXISTS (
        SELECT 1 FROM public.dealer_accounts da
        WHERE da.dealer_id::TEXT = d.id::TEXT
          AND da.account_status IN ('rejected', 'suspended')
      ) THEN 'disapproved'
      WHEN EXISTS (
        SELECT 1 FROM public.dealer_accounts da
        WHERE da.dealer_id::TEXT = d.id::TEXT
          AND da.account_status = 'active'
      ) AND COALESCE(
        d.is_verified,
        (pg_catalog.to_jsonb(d)->>'verified_partner')::BOOLEAN,
        true
      ) = false THEN 'disapproved'
      WHEN EXISTS (
        SELECT 1 FROM public.dealer_accounts da
        WHERE da.dealer_id::TEXT = d.id::TEXT
          AND da.account_status = 'active'
      ) AND COALESCE(
        d.is_verified,
        (pg_catalog.to_jsonb(d)->>'verified_partner')::BOOLEAN,
        true
      ) = true THEN 'approved'
      WHEN NOT EXISTS (
        SELECT 1 FROM public.dealer_accounts da
        WHERE da.dealer_id::TEXT = d.id::TEXT
      ) AND COALESCE(
        d.is_verified,
        (pg_catalog.to_jsonb(d)->>'verified_partner')::BOOLEAN,
        false
      ) = true THEN 'approved'
      ELSE 'pending'
    END,
    is_verified = COALESCE(
      d.is_verified,
      (pg_catalog.to_jsonb(d)->>'verified_partner')::BOOLEAN,
      CASE
        WHEN d.dealer_status = 'approved' THEN true
        WHEN d.dealer_status = 'disapproved' THEN false
        WHEN EXISTS (
          SELECT 1 FROM public.dealer_accounts da
          WHERE da.dealer_id::TEXT = d.id::TEXT
            AND da.account_status = 'active'
        ) THEN true
        ELSE false
      END
    )
  WHERE d.dealer_status IS NULL
     OR d.dealer_status NOT IN ('pending', 'approved', 'disapproved')
     OR d.is_verified IS NULL;

  UPDATE public.dealers
  SET is_verified = (dealer_status = 'approved')
  WHERE is_verified IS NULL;

  ALTER TABLE public.dealers
    ALTER COLUMN dealer_status SET DEFAULT 'pending',
    ALTER COLUMN dealer_status SET NOT NULL,
    ALTER COLUMN is_verified SET DEFAULT false;

  ALTER TABLE public.dealers
    ADD CONSTRAINT dealers_dealer_status_check
    CHECK (dealer_status IN ('pending', 'approved', 'disapproved'));
END $$;

CREATE INDEX IF NOT EXISTS idx_dealers_dealer_status
  ON public.dealers (dealer_status);

-- ------------------------------------------------------------------------------
-- 2. DEALER DASHBOARD ACCESS vs CAR LISTING APPROVAL FUNCTIONS
-- ------------------------------------------------------------------------------
-- NOTE: current_dealer_id() and is_active_dealer() allow 'pending' and 'rejected'
-- dealers so they can ALWAYS log in and access their dashboard, business profile,
-- existing cars, and enquiries. Only 'suspended' is blocked from portal access.

-- Preserve existing return type (UUID vs TEXT) of public.current_dealer_id() so
-- all existing RLS policies that depend on current_dealer_id() remain intact.
DO $$
DECLARE
  v_existing_ret TEXT;
  v_col_type TEXT;
BEGIN
  SELECT pg_catalog.format_type(p.prorettype, NULL)
  INTO v_existing_ret
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'current_dealer_id'
    AND p.pronargs = 0
  LIMIT 1;

  IF v_existing_ret IS NULL THEN
    SELECT c.data_type INTO v_col_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'dealer_accounts'
      AND c.column_name = 'dealer_id';
    v_existing_ret := CASE WHEN v_col_type = 'uuid' THEN 'uuid' ELSE 'text' END;
  END IF;

  IF v_existing_ret = 'uuid' THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.current_dealer_id()
      RETURNS UUID
      LANGUAGE plpgsql
      SECURITY DEFINER
      STABLE
      SET search_path = ''
      AS $body$
      BEGIN
        RETURN (
          SELECT da.dealer_id::UUID
          FROM public.dealer_accounts da
          WHERE da.user_id = auth.uid()
            AND da.account_status <> 'suspended'
          LIMIT 1
        );
      END;
      $body$;
    $fn$;
  ELSE
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.current_dealer_id()
      RETURNS TEXT
      LANGUAGE plpgsql
      SECURITY DEFINER
      STABLE
      SET search_path = ''
      AS $body$
      BEGIN
        RETURN (
          SELECT da.dealer_id::TEXT
          FROM public.dealer_accounts da
          WHERE da.user_id = auth.uid()
            AND da.account_status <> 'suspended'
          LIMIT 1
        );
      END;
      $body$;
    $fn$;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_active_dealer()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.dealer_accounts da
    WHERE da.user_id = auth.uid()
      AND da.account_status <> 'suspended'
  );
END;
$$;

-- Dedicated listing gate: ONLY Admin-approved dealers (dealer_status='approved' AND active AND verified) may list cars!
CREATE OR REPLACE FUNCTION public.is_approved_dealer()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.dealer_accounts da
    LEFT JOIN public.dealers d ON d.id::TEXT = da.dealer_id::TEXT
    WHERE da.user_id = auth.uid()
      AND da.account_status = 'active'
      AND COALESCE(
        (pg_catalog.to_jsonb(d)->>'is_verified')::BOOLEAN,
        (pg_catalog.to_jsonb(d)->>'verified_partner')::BOOLEAN,
        true
      ) = true
      AND COALESCE(NULLIF(pg_catalog.to_jsonb(d)->>'dealer_status', ''), 'approved') = 'approved'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.current_dealer_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_dealer() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_approved_dealer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_dealer_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_dealer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_dealer() TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. RLS POLICIES: ADMIN ACCESS TO ALL DEALER TABLES & STRICT CAR LISTING GATE
-- ------------------------------------------------------------------------------
ALTER TABLE public.dealer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

-- Admin full access on dealer_accounts, dealer_business_profiles, dealer_addresses
DROP POLICY IF EXISTS "Admins manage dealer accounts" ON public.dealer_accounts;
CREATE POLICY "Admins manage dealer accounts" ON public.dealer_accounts
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "Dealers view own account" ON public.dealer_accounts;
CREATE POLICY "Dealers view own account" ON public.dealer_accounts
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (public.current_dealer_id() IS NOT NULL AND dealer_id::TEXT = public.current_dealer_id()::TEXT)
    OR public.is_active_admin()
  );

DROP POLICY IF EXISTS "Admins manage dealer business profiles" ON public.dealer_business_profiles;
CREATE POLICY "Admins manage dealer business profiles" ON public.dealer_business_profiles
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "Admins manage dealer addresses" ON public.dealer_addresses;
CREATE POLICY "Admins manage dealer addresses" ON public.dealer_addresses
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- CRITICAL FIX: Replace permissive FOR ALL "Dealers manage own cars" policy so
-- unapproved dealers CANNOT bypass the listing gate with a direct INSERT or review submission.
DROP POLICY IF EXISTS "Dealers manage own cars" ON public.cars;
DROP POLICY IF EXISTS "Dealers insert own cars" ON public.cars;
DROP POLICY IF EXISTS "Dealers update own cars" ON public.cars;
DROP POLICY IF EXISTS "Dealers delete own cars" ON public.cars;
DROP POLICY IF EXISTS "Dealers view own cars" ON public.cars;

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
-- 4. UPDATE create_dealer_onboarding(...) TO START NEW DEALERS IN 'pending'
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_dealer_onboarding(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
);

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

  v_slug := pg_catalog.regexp_replace(
    pg_catalog.lower(pg_catalog.btrim(p_business_name)),
    '[^a-z0-9]+',
    '-',
    'g'
  );
  v_slug := pg_catalog.btrim(v_slug, '-') || '-' || pg_catalog.substr(v_dealer_uuid::TEXT, 1, 6);

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

  -- Populate public.dealers columns dynamically based on live schema
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
      -- New dealers are NOT verified for listing until Admin approves them
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

  -- Insert business profile cleanly (safe against UUID vs TEXT dealer_id)
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

  -- Insert showroom address cleanly
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
    'account_status', 'pending',
    'dealer_status', 'pending',
    'onboarding_status', 'completed',
    'is_verified', false,
    'is_approved', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_dealer_onboarding(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_dealer_onboarding(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. ADMIN DEALER DIRECTORY & APPROVAL RPCs
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_list_dealer_accounts();

CREATE OR REPLACE FUNCTION public.admin_list_dealer_accounts()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin authorization required';
  END IF;

  SELECT COALESCE(
    pg_catalog.jsonb_agg(item ORDER BY created_sort DESC, business_name_sort ASC),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT
      COALESCE(da.created_at, d.created_at, pg_catalog.now()) AS created_sort,
      COALESCE(
        NULLIF(pg_catalog.to_jsonb(d)->>'business_name', ''),
        NULLIF(pg_catalog.to_jsonb(d)->>'name', ''),
        NULLIF(pg_catalog.to_jsonb(dbp)->>'trading_name', ''),
        'Unnamed Dealership'
      ) AS business_name_sort,
      pg_catalog.jsonb_build_object(
        'dealerId', COALESCE(d.id::TEXT, da.dealer_id::TEXT),
        'dealerAccountId', da.id::TEXT,
        'userId', da.user_id::TEXT,
        'hasPortalAccount', (da.user_id IS NOT NULL),
        'businessName', COALESCE(
          NULLIF(pg_catalog.to_jsonb(d)->>'business_name', ''),
          NULLIF(pg_catalog.to_jsonb(d)->>'name', ''),
          NULLIF(pg_catalog.to_jsonb(dbp)->>'trading_name', ''),
          'Unnamed Dealership'
        ),
        'tradingName', NULLIF(pg_catalog.to_jsonb(dbp)->>'trading_name', ''),
        'contactName', COALESCE(
          NULLIF(pg_catalog.to_jsonb(d)->>'contact_name', ''),
          NULLIF(pg_catalog.to_jsonb(p)->>'full_name', ''),
          NULLIF(au.raw_user_meta_data->>'full_name', ''),
          NULLIF(au.raw_user_meta_data->>'contact_name', '')
        ),
        'email', COALESCE(
          NULLIF(pg_catalog.to_jsonb(d)->>'email', ''),
          NULLIF(pg_catalog.to_jsonb(p)->>'email', ''),
          NULLIF(au.email, '')
        ),
        'phone', COALESCE(
          NULLIF(pg_catalog.to_jsonb(d)->>'phone', ''),
          NULLIF(pg_catalog.to_jsonb(p)->>'phone', ''),
          NULLIF(au.raw_user_meta_data->>'phone', '')
        ),
        'city', COALESCE(NULLIF(pg_catalog.to_jsonb(daddr)->>'city', ''), NULLIF(pg_catalog.to_jsonb(d)->>'city', ''), 'Lagos'),
        'state', COALESCE(NULLIF(pg_catalog.to_jsonb(daddr)->>'state', ''), NULLIF(pg_catalog.to_jsonb(d)->>'state', ''), 'Lagos'),
        'country', COALESCE(NULLIF(pg_catalog.to_jsonb(daddr)->>'country', ''), NULLIF(pg_catalog.to_jsonb(d)->>'country', ''), 'Nigeria'),
        'addressLine1', COALESCE(NULLIF(pg_catalog.to_jsonb(daddr)->>'address_line_1', ''), NULLIF(pg_catalog.to_jsonb(d)->>'address', '')),
        'addressLine2', NULLIF(pg_catalog.to_jsonb(daddr)->>'address_line_2', ''),
        'businessType', NULLIF(pg_catalog.to_jsonb(dbp)->>'business_type', ''),
        'businessDescription', COALESCE(NULLIF(pg_catalog.to_jsonb(dbp)->>'business_description', ''), NULLIF(pg_catalog.to_jsonb(d)->>'description', '')),
        'website', NULLIF(pg_catalog.to_jsonb(dbp)->>'website', ''),
        'cacRegistrationNumber', NULLIF(pg_catalog.to_jsonb(dbp)->>'cac_registration_number', ''),
        'accountStatus', COALESCE(
          NULLIF(da.account_status, ''),
          CASE WHEN COALESCE((pg_catalog.to_jsonb(d)->>'is_verified')::BOOLEAN, false) THEN 'active' ELSE 'pending' END
        ),
        'onboardingStatus', COALESCE(
          NULLIF(da.onboarding_status, ''),
          CASE WHEN da.user_id IS NOT NULL THEN 'completed' ELSE 'directory_only' END
        ),
        'isVerified', COALESCE((pg_catalog.to_jsonb(d)->>'is_verified')::BOOLEAN, false),
        'dealerStatus', COALESCE(
          NULLIF(pg_catalog.to_jsonb(d)->>'dealer_status', ''),
          CASE
            WHEN da.account_status IN ('rejected', 'suspended') THEN 'disapproved'
            WHEN da.account_status = 'active' AND COALESCE((pg_catalog.to_jsonb(d)->>'is_verified')::BOOLEAN, true) = true THEN 'approved'
            WHEN da.account_status = 'active' AND COALESCE((pg_catalog.to_jsonb(d)->>'is_verified')::BOOLEAN, true) = false THEN 'disapproved'
            WHEN da.user_id IS NULL AND COALESCE((pg_catalog.to_jsonb(d)->>'is_verified')::BOOLEAN, false) = true THEN 'approved'
            ELSE 'pending'
          END
        ),
        'approvalStatus', CASE
          WHEN da.account_status = 'suspended' THEN 'suspended'
          WHEN da.account_status = 'rejected' THEN 'disapproved'
          WHEN NULLIF(pg_catalog.to_jsonb(d)->>'dealer_status', '') = 'disapproved' THEN 'disapproved'
          WHEN da.account_status = 'pending' THEN 'pending'
          WHEN NULLIF(pg_catalog.to_jsonb(d)->>'dealer_status', '') = 'pending' THEN 'pending'
          WHEN da.account_status = 'active'
            AND COALESCE((pg_catalog.to_jsonb(d)->>'is_verified')::BOOLEAN, true) = true
            AND COALESCE(NULLIF(pg_catalog.to_jsonb(d)->>'dealer_status', ''), 'approved') = 'approved' THEN 'approved'
          WHEN da.account_status = 'active' AND COALESCE((pg_catalog.to_jsonb(d)->>'is_verified')::BOOLEAN, true) = false THEN 'disapproved'
          WHEN da.user_id IS NULL AND (
            COALESCE(NULLIF(pg_catalog.to_jsonb(d)->>'dealer_status', ''), '') = 'approved'
            OR COALESCE((pg_catalog.to_jsonb(d)->>'is_verified')::BOOLEAN, false) = true
          ) THEN 'approved'
          ELSE 'pending'
        END,
        'canListCars', CASE
          WHEN da.user_id IS NOT NULL THEN
            (
              da.account_status = 'active'
              AND COALESCE((pg_catalog.to_jsonb(d)->>'is_verified')::BOOLEAN, true) = true
              AND COALESCE(NULLIF(pg_catalog.to_jsonb(d)->>'dealer_status', ''), 'approved') = 'approved'
            )
          ELSE
            (
              COALESCE((pg_catalog.to_jsonb(d)->>'is_verified')::BOOLEAN, false) = true
              AND COALESCE(NULLIF(pg_catalog.to_jsonb(d)->>'dealer_status', ''), 'approved') = 'approved'
            )
        END,
        'approvalNotes', NULLIF(pg_catalog.to_jsonb(da)->>'approval_notes', ''),
        'approvedAt', NULLIF(pg_catalog.to_jsonb(da)->>'approved_at', ''),
        'disapprovedAt', NULLIF(pg_catalog.to_jsonb(da)->>'disapproved_at', ''),
        'joinedYear', COALESCE(
          (pg_catalog.to_jsonb(d)->>'joined_year')::INTEGER,
          EXTRACT(YEAR FROM COALESCE(d.created_at, da.created_at, pg_catalog.now()))::INTEGER
        ),
        'createdAt', COALESCE(da.created_at, d.created_at, pg_catalog.now()),
        'totalVehicles', (
          SELECT pg_catalog.count(*)::INTEGER
          FROM public.cars c
          WHERE c.dealer_id::TEXT = COALESCE(d.id::TEXT, da.dealer_id::TEXT)
        ),
        'publishedVehicles', (
          SELECT pg_catalog.count(*)::INTEGER
          FROM public.cars c
          WHERE c.dealer_id::TEXT = COALESCE(d.id::TEXT, da.dealer_id::TEXT)
            AND pg_catalog.upper(COALESCE(c.status::TEXT, '')) = 'PUBLISHED'
        ),
        'inReviewVehicles', (
          SELECT pg_catalog.count(*)::INTEGER
          FROM public.cars c
          WHERE c.dealer_id::TEXT = COALESCE(d.id::TEXT, da.dealer_id::TEXT)
            AND pg_catalog.upper(COALESCE(c.status::TEXT, '')) = 'PENDING_REVIEW'
        )
      ) AS item
    FROM public.dealers d
    FULL OUTER JOIN public.dealer_accounts da
      ON d.id::TEXT = da.dealer_id::TEXT
    LEFT JOIN public.dealer_business_profiles dbp
      ON dbp.dealer_id::TEXT = COALESCE(d.id::TEXT, da.dealer_id::TEXT)
    LEFT JOIN public.dealer_addresses daddr
      ON daddr.dealer_id::TEXT = COALESCE(d.id::TEXT, da.dealer_id::TEXT)
    LEFT JOIN public.profiles p
      ON p.id = da.user_id
    LEFT JOIN auth.users au
      ON au.id = da.user_id
  ) sub;

  RETURN v_result;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_set_dealer_approval_status(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_set_dealer_approval_status(
  p_dealer_id TEXT,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_uid UUID := auth.uid();
  v_action TEXT := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_action, '')));
  v_account_status TEXT;
  v_dealer_status TEXT;
  v_is_verified BOOLEAN;
  v_approval_status TEXT;
  v_dealer_user_id UUID;
  v_updated_dealers INTEGER := 0;
  v_updated_accounts INTEGER := 0;
  v_clean_reason TEXT := NULLIF(pg_catalog.btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin authorization required';
  END IF;

  IF p_dealer_id IS NULL OR pg_catalog.length(pg_catalog.btrim(p_dealer_id)) = 0 THEN
    RAISE EXCEPTION 'Dealer ID is required';
  END IF;

  IF v_action IN ('approve', 'approved', 'active') THEN
    v_action := 'approve';
    v_account_status := 'active';
    v_dealer_status := 'approved';
    v_is_verified := true;
    v_approval_status := 'approved';
  ELSIF v_action IN ('disapprove', 'disapproved', 'reject', 'rejected') THEN
    v_action := 'disapprove';
    v_account_status := 'rejected';
    v_dealer_status := 'disapproved';
    v_is_verified := false;
    v_approval_status := 'disapproved';
  ELSIF v_action = 'pending' THEN
    v_account_status := 'pending';
    v_dealer_status := 'pending';
    v_is_verified := false;
    v_approval_status := 'pending';
  ELSIF v_action IN ('suspend', 'suspended') THEN
    v_action := 'suspend';
    v_account_status := 'suspended';
    v_dealer_status := 'disapproved';
    v_is_verified := false;
    v_approval_status := 'suspended';
  ELSE
    RAISE EXCEPTION 'Unsupported approval action: %', p_action;
  END IF;

  UPDATE public.dealers
  SET
    is_verified = v_is_verified,
    dealer_status = v_dealer_status
  WHERE id::TEXT = p_dealer_id;
  GET DIAGNOSTICS v_updated_dealers = ROW_COUNT;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'dealers'
      AND c.column_name = 'verified_partner'
  ) THEN
    EXECUTE 'UPDATE public.dealers SET verified_partner = $1 WHERE id::TEXT = $2'
      USING v_is_verified, p_dealer_id;
  END IF;

  UPDATE public.dealer_accounts
  SET
    account_status = v_account_status,
    approval_notes = CASE
      WHEN v_action = 'approve' THEN v_clean_reason
      WHEN v_clean_reason IS NOT NULL THEN v_clean_reason
      ELSE approval_notes
    END,
    approved_at = CASE WHEN v_action = 'approve' THEN pg_catalog.now() ELSE approved_at END,
    approved_by = CASE WHEN v_action = 'approve' THEN v_admin_uid ELSE approved_by END,
    disapproved_at = CASE WHEN v_action = 'disapprove' THEN pg_catalog.now() ELSE disapproved_at END,
    updated_at = pg_catalog.now()
  WHERE dealer_id::TEXT = p_dealer_id
  RETURNING user_id INTO v_dealer_user_id;
  GET DIAGNOSTICS v_updated_accounts = ROW_COUNT;

  IF v_updated_dealers = 0 AND v_updated_accounts = 0 THEN
    RAISE EXCEPTION 'Dealer account not found for ID: %', p_dealer_id;
  END IF;

  -- Send non-fatal in-app notification to the dealer user
  IF v_dealer_user_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (user_id, title, message)
      VALUES (
        v_dealer_user_id,
        CASE
          WHEN v_action = 'approve' THEN 'Dealership Approved for Vehicle Listing'
          WHEN v_action = 'disapprove' THEN 'Dealership Vehicle Listing Approval Updated'
          WHEN v_action = 'suspend' THEN 'Dealership Account Suspended'
          ELSE 'Dealership Account Pending Review'
        END,
        CASE
          WHEN v_action = 'approve' THEN
            'Your MANIFOLD dealership account has been approved! You can now list vehicles in the marketplace.'
          WHEN v_action = 'disapprove' THEN
            COALESCE(
              'Your dealership is currently not approved to list new vehicles (' || v_clean_reason || '). Your dashboard and account remain accessible.',
              'Your dealership is currently not approved to list new vehicles. Your dashboard and account remain accessible while you update your profile or contact Admin.'
            )
          WHEN v_action = 'suspend' THEN
            COALESCE(
              'Your dealership account has been suspended: ' || v_clean_reason,
              'Your dealership account has been suspended. Please contact MANIFOLD Admin support.'
            )
          ELSE
            'Your dealership account status has been set to pending admin review. Your dashboard remains accessible.'
        END
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Audit log (non-fatal)
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      v_admin_uid,
      'dealer_' || v_action,
      'dealer_account',
      p_dealer_id,
      pg_catalog.jsonb_build_object(
        'account_status', v_account_status,
        'is_verified', v_is_verified,
        'reason', v_clean_reason
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'dealerId', p_dealer_id,
    'accountStatus', v_account_status,
    'dealerStatus', v_dealer_status,
    'isVerified', v_is_verified,
    'approvalStatus', v_approval_status,
    'canListCars', (v_account_status = 'active' AND v_is_verified = true AND v_dealer_status = 'approved'),
    'approvalNotes', v_clean_reason
  );
END;
$$;

DROP FUNCTION IF EXISTS public.admin_create_partner_dealer(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);

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

  v_slug := pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_slug := pg_catalog.btrim(v_slug, '-') || '-' || pg_catalog.substr(v_dealer_uuid::TEXT, 1, 6);

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
     v_vals := array_append(v_vals, EXTRACT(YEAR FROM NOW())::INTEGER::TEXT);
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
    'city', COALESCE(NULLIF(pg_catalog.btrim(p_city), ''), 'Lekki'),
    'state', COALESCE(NULLIF(pg_catalog.btrim(p_state), ''), 'Lagos'),
    'verified_partner', COALESCE(p_is_verified, true),
    'joined_year', EXTRACT(YEAR FROM pg_catalog.now())::INTEGER
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_dealer_accounts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_dealer_approval_status(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_partner_dealer(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_list_dealer_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_dealer_approval_status(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_partner_dealer(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
