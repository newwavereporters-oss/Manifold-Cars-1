-- ==============================================================================
-- MANIFOLD CARS 3D — GAME EXPANSION MIGRATION (TRANSMISSION, MISSIONS, BILLBOARDS)
-- ==============================================================================
-- Hardened, additive, idempotent, non-destructive PostgreSQL migration for Supabase.
-- Preserves all existing marketplace, dealer, cars, admin_users, player_profiles,
-- and moderation schemas, records, and RLS/auth functions.
--
-- IMPORTANT SECURITY & ARCHITECTURE NOTES:
--   * public.dealers.id is UUID
--   * public.cars.id and public.cars.dealer_id are UUID
--   * public.cars has previous_price but no original_price or image URL columns
--   * public.player_profiles.id is UUID
--   * public.is_active_admin(), public.is_active_dealer(), public.current_dealer_id(),
--     and public.current_player_id() are reused directly without duplication.
--   * Architectural Boundary Notice: Driving physics, collisions, gear shifts, and
--     autonomous rival AI execute client-side in WebGL (no dedicated authoritative
--     physics simulation server). Consequently, PostgreSQL RPCs enforce run ownership,
--     active mission rules, single-use run tokens, server timestamps/deadlines, minimum
--     plausible travel durations, sequential DB checkpoint coordinates, finite world
--     coordinate bounds, destination zone arrival, and fixed DB-configured payouts.
--     Client-supplied collision/rank/gear values are recorded as unverified client
--     telemetry (server_verified = false; checkpoint_reports_accepted = true) and
--     NEVER inflate credits, XP, or award exclusive telemetry-gated badges.
--   * Marketplace Field Compatibility: public.cars has no original_price, gallery_image_1_url,
--     or youtube_thumbnail_url columns; billboard JSON preserves those response keys with
--     NULL/empty placeholders rather than altering the production marketplace schema.
--   * Marketplace Status Compatibility: public.cars.status is cast to TEXT and compared
--     using lowercase 'published' to match the live database schema safely whether
--     public.cars.status is an enum or TEXT column.
--   * Dealer ID Compatibility: dealer IDs are UUID in the live marketplace schema.
--     Text casts are retained only where needed for comparisons or backward-compatible
--     TEXT RPC parameters; UUID values are cast back to UUID for inserts and foreign keys.
--   * Vehicle Image Compatibility: the live public.cars table has no image URL columns.
--     Billboard JSON keeps the image keys but returns an empty string until image storage
--     is connected to the game feed. Original price is returned as NULL because the live
--     schema has no original_price column and previous_price is not equivalent to it.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. EXTEND player_profiles FOR PERSISTENT MISSION XP, COUNTS & BADGES
-- ------------------------------------------------------------------------------
ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS xp_balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missions_completed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badges_earned JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ------------------------------------------------------------------------------
-- 2. DEALER ADVERTISING SLOT ENTITLEMENTS (DEFAULT 1 ACTIVE SLOT PER DEALER)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dealer_advertising_plans (
  dealer_id UUID PRIMARY KEY REFERENCES public.dealers(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL DEFAULT 'standard',
  max_active_slots INTEGER NOT NULL DEFAULT 1 CHECK (max_active_slots >= 1 AND max_active_slots <= 25),
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reconcile partial pre-existing dealer_advertising_plans schemas safely
ALTER TABLE public.dealer_advertising_plans
  ADD COLUMN IF NOT EXISTS dealer_id UUID,
  ADD COLUMN IF NOT EXISTS plan_code TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS max_active_slots INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Inspect existing data and restore defaults, PK, NOT NULL, FKs, CHECK, and unique invariants
DO $$
DECLARE
  v_rel REGCLASS := 'public.dealer_advertising_plans'::regclass;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_count BIGINT;
  v_samples TEXT;
  v_pk_name TEXT;
  v_pk_cols TEXT[];
  v_fk_name TEXT;
  v_fk_confrel OID;
  v_fk_col TEXT;
  v_fk_deltype CHAR;
  v_has_check BOOLEAN;
  v_col TEXT;
  v_attnotnull BOOLEAN;
BEGIN
  -- 1. Ensure canonical column defaults exist
  ALTER TABLE public.dealer_advertising_plans
    ALTER COLUMN plan_code SET DEFAULT 'standard',
    ALTER COLUMN max_active_slots SET DEFAULT 1,
    ALTER COLUMN created_at SET DEFAULT NOW(),
    ALTER COLUMN updated_at SET DEFAULT NOW();

  -- 2. Inspect Primary Key & dealer_id uniqueness/NULLs
  SELECT c.conname,
         (
           SELECT pg_catalog.array_agg(a.attname::TEXT ORDER BY u.ord)
           FROM pg_catalog.unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord)
           JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
         )
  INTO v_pk_name, v_pk_cols
  FROM pg_catalog.pg_constraint c
  WHERE c.conrelid = v_rel AND c.contype = 'p';

  IF v_pk_name IS NOT NULL AND v_pk_cols IS DISTINCT FROM ARRAY['dealer_id']::TEXT[] THEN
    v_errors := array_append(
      v_errors,
      pg_catalog.format('Conflicting primary key %I on (%s); expected (dealer_id).', v_pk_name, pg_catalog.array_to_string(v_pk_cols, ', '))
    );
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.dealer_advertising_plans WHERE dealer_id IS NULL;
  IF v_count > 0 THEN
    v_errors := array_append(v_errors, pg_catalog.format('dealer_id has %s NULL row(s).', v_count));
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT dealer_id FROM public.dealer_advertising_plans
    WHERE dealer_id IS NOT NULL
    GROUP BY dealer_id HAVING COUNT(*) > 1
  ) d;
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.lbl, ', ') INTO v_samples
    FROM (
      SELECT dealer_id::TEXT || ' (' || COUNT(*)::TEXT || 'x)' AS lbl
      FROM public.dealer_advertising_plans
      WHERE dealer_id IS NOT NULL
      GROUP BY dealer_id HAVING COUNT(*) > 1
      ORDER BY dealer_id LIMIT 10
    ) s;
    v_errors := array_append(v_errors, pg_catalog.format('Duplicate dealer_id conflicts (%s group(s)): %s', v_count, v_samples));
  END IF;

  -- 3. Inspect NOT NULL columns
  FOREACH v_col IN ARRAY ARRAY['dealer_id', 'plan_code', 'max_active_slots', 'created_at', 'updated_at'] LOOP
    SELECT a.attnotnull INTO v_attnotnull
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = v_rel AND a.attname = v_col AND NOT a.attisdropped;

    IF NOT COALESCE(v_attnotnull, false) THEN
      EXECUTE pg_catalog.format('SELECT COUNT(*) FROM public.dealer_advertising_plans WHERE %I IS NULL', v_col) INTO v_count;
      IF v_count > 0 THEN
        v_errors := array_append(v_errors, pg_catalog.format('Column %I has %s NULL row(s) blocking NOT NULL.', v_col, v_count));
      END IF;
    END IF;
  END LOOP;

  -- 4. Inspect Foreign Keys (dealer_id -> public.dealers(id), updated_by -> auth.users(id))
  SELECT c.conname, c.confrelid, fa.attname::TEXT, c.confdeltype
  INTO v_fk_name, v_fk_confrel, v_fk_col, v_fk_deltype
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_attribute la ON la.attrelid = c.conrelid AND la.attnum = c.conkey[1]
  JOIN pg_catalog.pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
  WHERE c.conrelid = v_rel AND c.contype = 'f' AND pg_catalog.array_length(c.conkey, 1) = 1 AND la.attname = 'dealer_id'
  LIMIT 1;

  IF v_fk_name IS NOT NULL AND (v_fk_confrel <> 'public.dealers'::regclass OR v_fk_col <> 'id' OR v_fk_deltype <> 'c') THEN
    v_errors := array_append(v_errors, pg_catalog.format('Conflicting FK %I on dealer_id; expected REFERENCES public.dealers(id) ON DELETE CASCADE.', v_fk_name));
  ELSIF v_fk_name IS NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.dealer_advertising_plans t
    WHERE t.dealer_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.dealers d WHERE d.id::TEXT = t.dealer_id::TEXT);
    IF v_count > 0 THEN
      SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
      FROM (
        SELECT t.dealer_id::TEXT AS val
        FROM public.dealer_advertising_plans t
        WHERE t.dealer_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.dealers d WHERE d.id::TEXT = t.dealer_id::TEXT)
        ORDER BY t.dealer_id::TEXT LIMIT 10
      ) s;
      v_errors := array_append(v_errors, pg_catalog.format('Orphaned dealer_id rows not in public.dealers (%s row(s)): %s', v_count, v_samples));
    END IF;
  END IF;

  SELECT c.conname, c.confrelid, fa.attname::TEXT, c.confdeltype
  INTO v_fk_name, v_fk_confrel, v_fk_col, v_fk_deltype
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_attribute la ON la.attrelid = c.conrelid AND la.attnum = c.conkey[1]
  JOIN pg_catalog.pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
  WHERE c.conrelid = v_rel AND c.contype = 'f' AND pg_catalog.array_length(c.conkey, 1) = 1 AND la.attname = 'updated_by'
  LIMIT 1;

  IF v_fk_name IS NOT NULL AND (v_fk_confrel <> 'auth.users'::regclass OR v_fk_col <> 'id' OR v_fk_deltype <> 'n') THEN
    v_errors := array_append(v_errors, pg_catalog.format('Conflicting FK %I on updated_by; expected REFERENCES auth.users(id) ON DELETE SET NULL.', v_fk_name));
  ELSIF v_fk_name IS NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.dealer_advertising_plans t
    WHERE t.updated_by IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.updated_by);
    IF v_count > 0 THEN
      SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
      FROM (
        SELECT COALESCE(t.dealer_id::TEXT, '<null>') || '->' || t.updated_by::TEXT AS val
        FROM public.dealer_advertising_plans t
        WHERE t.updated_by IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.updated_by)
        LIMIT 10
      ) s;
      v_errors := array_append(v_errors, pg_catalog.format('Orphaned updated_by rows not in auth.users (%s row(s)): %s', v_count, v_samples));
    END IF;
  END IF;

  -- 5. Inspect CHECK constraint (max_active_slots BETWEEN 1 AND 25)
  SELECT COUNT(*) INTO v_count
  FROM public.dealer_advertising_plans
  WHERE max_active_slots IS NULL OR max_active_slots < 1 OR max_active_slots > 25;
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
    FROM (
      SELECT COALESCE(dealer_id::TEXT, '<null>') || '=' || COALESCE(max_active_slots::TEXT, 'NULL') AS val
      FROM public.dealer_advertising_plans
      WHERE max_active_slots IS NULL OR max_active_slots < 1 OR max_active_slots > 25
      LIMIT 10
    ) s;
    v_errors := array_append(v_errors, pg_catalog.format('Invalid max_active_slots outside [1, 25] (%s row(s)): %s', v_count, v_samples));
  END IF;

  IF pg_catalog.array_length(v_errors, 1) > 0 THEN
    RAISE EXCEPTION E'DEPLOYMENT BLOCKER: Cannot establish integrity constraints on public.dealer_advertising_plans (existing rows preserved):\n  - %',
      pg_catalog.array_to_string(v_errors, E'\n  - ');
  END IF;

  -- 6. Apply missing constraints safely now that 100% of data invariants are verified
  IF v_pk_name IS NULL THEN
    ALTER TABLE public.dealer_advertising_plans
      ADD CONSTRAINT dealer_advertising_plans_pkey PRIMARY KEY (dealer_id);
  END IF;

  FOREACH v_col IN ARRAY ARRAY['dealer_id', 'plan_code', 'max_active_slots', 'created_at', 'updated_at'] LOOP
    SELECT a.attnotnull INTO v_attnotnull
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = v_rel AND a.attname = v_col AND NOT a.attisdropped;
    IF NOT COALESCE(v_attnotnull, false) THEN
      EXECUTE pg_catalog.format('ALTER TABLE public.dealer_advertising_plans ALTER COLUMN %I SET NOT NULL', v_col);
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_attribute la ON la.attrelid = c.conrelid AND la.attnum = c.conkey[1]
    WHERE c.conrelid = v_rel AND c.contype = 'f' AND pg_catalog.array_length(c.conkey, 1) = 1 AND la.attname = 'dealer_id'
  ) THEN
    ALTER TABLE public.dealer_advertising_plans
      ADD CONSTRAINT fk_dealer_advertising_plans_dealer_id
      FOREIGN KEY (dealer_id) REFERENCES public.dealers(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_attribute la ON la.attrelid = c.conrelid AND la.attnum = c.conkey[1]
    WHERE c.conrelid = v_rel AND c.contype = 'f' AND pg_catalog.array_length(c.conkey, 1) = 1 AND la.attname = 'updated_by'
  ) THEN
    ALTER TABLE public.dealer_advertising_plans
      ADD CONSTRAINT fk_dealer_advertising_plans_updated_by
      FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_rel AND c.contype = 'c'
      AND (
        c.conname = 'chk_dealer_advertising_plans_max_active_slots'
        OR (
          pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%max_active_slots >= 1%'
          AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%max_active_slots <= 25%'
        )
      )
  ) INTO v_has_check;

  IF NOT v_has_check THEN
    ALTER TABLE public.dealer_advertising_plans
      ADD CONSTRAINT chk_dealer_advertising_plans_max_active_slots
      CHECK (max_active_slots >= 1 AND max_active_slots <= 25);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. GAME WORLD DEALER BILLBOARD ASSIGNMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_billboard_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
vehicle_listing_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'removed', 'expired')),
  display_order INTEGER NOT NULL DEFAULT 100,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reconcile partial pre-existing game_billboard_assignments schemas safely
ALTER TABLE public.game_billboard_assignments
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS dealer_id UUID,
ADD COLUMN IF NOT EXISTS vehicle_listing_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_billboard_assignments_dealer_status
  ON public.game_billboard_assignments (dealer_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_billboard_assignments_active_order
  ON public.game_billboard_assignments (status, display_order ASC, updated_at DESC);

-- Inspect existing data and restore defaults, PK, NOT NULL, FKs, CHECK, and unique active vehicle index
DO $$
DECLARE
  v_rel REGCLASS := 'public.game_billboard_assignments'::regclass;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_count BIGINT;
  v_samples TEXT;
  v_pk_name TEXT;
  v_pk_cols TEXT[];
  v_fk_name TEXT;
  v_fk_confrel OID;
  v_fk_col TEXT;
  v_fk_deltype CHAR;
  v_has_check BOOLEAN;
  v_col TEXT;
  v_attnotnull BOOLEAN;
BEGIN
  -- 1. Restore canonical column defaults
  ALTER TABLE public.game_billboard_assignments
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN status SET DEFAULT 'active',
    ALTER COLUMN display_order SET DEFAULT 100,
    ALTER COLUMN starts_at SET DEFAULT NOW(),
    ALTER COLUMN created_at SET DEFAULT NOW(),
    ALTER COLUMN updated_at SET DEFAULT NOW();

  -- 2. Inspect Primary Key & id uniqueness/NULLs
  SELECT c.conname,
         (
           SELECT pg_catalog.array_agg(a.attname::TEXT ORDER BY u.ord)
           FROM pg_catalog.unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord)
           JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
         )
  INTO v_pk_name, v_pk_cols
  FROM pg_catalog.pg_constraint c
  WHERE c.conrelid = v_rel AND c.contype = 'p';

  IF v_pk_name IS NOT NULL AND v_pk_cols IS DISTINCT FROM ARRAY['id']::TEXT[] THEN
    v_errors := array_append(
      v_errors,
      pg_catalog.format('Conflicting primary key %I on (%s); expected (id).', v_pk_name, pg_catalog.array_to_string(v_pk_cols, ', '))
    );
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.game_billboard_assignments WHERE id IS NULL;
  IF v_count > 0 THEN
    v_errors := array_append(v_errors, pg_catalog.format('id has %s NULL row(s).', v_count));
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT id FROM public.game_billboard_assignments
    WHERE id IS NOT NULL
    GROUP BY id HAVING COUNT(*) > 1
  ) d;
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.lbl, ', ') INTO v_samples
    FROM (
      SELECT id::TEXT || ' (' || COUNT(*)::TEXT || 'x)' AS lbl
      FROM public.game_billboard_assignments WHERE id IS NOT NULL
      GROUP BY id HAVING COUNT(*) > 1 ORDER BY id LIMIT 10
    ) s;
    v_errors := array_append(v_errors, pg_catalog.format('Duplicate id conflicts (%s group(s)): %s', v_count, v_samples));
  END IF;

  -- 3. Inspect NOT NULL columns
  FOREACH v_col IN ARRAY ARRAY['id', 'dealer_id', 'vehicle_listing_id', 'status', 'display_order', 'starts_at', 'created_at', 'updated_at'] LOOP
    SELECT a.attnotnull INTO v_attnotnull
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = v_rel AND a.attname = v_col AND NOT a.attisdropped;

    IF NOT COALESCE(v_attnotnull, false) THEN
      EXECUTE pg_catalog.format('SELECT COUNT(*) FROM public.game_billboard_assignments WHERE %I IS NULL', v_col) INTO v_count;
      IF v_count > 0 THEN
        v_errors := array_append(v_errors, pg_catalog.format('Column %I has %s NULL row(s) blocking NOT NULL.', v_col, v_count));
      END IF;
    END IF;
  END LOOP;

  -- 4. Inspect Foreign Keys (dealer_id, vehicle_listing_id, created_by)
  SELECT c.conname, c.confrelid, fa.attname::TEXT, c.confdeltype
  INTO v_fk_name, v_fk_confrel, v_fk_col, v_fk_deltype
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_attribute la ON la.attrelid = c.conrelid AND la.attnum = c.conkey[1]
  JOIN pg_catalog.pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
  WHERE c.conrelid = v_rel AND c.contype = 'f' AND pg_catalog.array_length(c.conkey, 1) = 1 AND la.attname = 'dealer_id'
  LIMIT 1;

  IF v_fk_name IS NOT NULL AND (v_fk_confrel <> 'public.dealers'::regclass OR v_fk_col <> 'id' OR v_fk_deltype <> 'c') THEN
    v_errors := array_append(v_errors, pg_catalog.format('Conflicting FK %I on dealer_id; expected REFERENCES public.dealers(id) ON DELETE CASCADE.', v_fk_name));
  ELSIF v_fk_name IS NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.game_billboard_assignments t
    WHERE t.dealer_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.dealers d WHERE d.id::TEXT = t.dealer_id::TEXT);
    IF v_count > 0 THEN
      SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
      FROM (
        SELECT COALESCE(t.id::TEXT, '<null>') || ':' || t.dealer_id::TEXT AS val
        FROM public.game_billboard_assignments t
        WHERE t.dealer_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.dealers d WHERE d.id::TEXT = t.dealer_id::TEXT)
        LIMIT 10
      ) s;
      v_errors := array_append(v_errors, pg_catalog.format('Orphaned dealer_id rows not in public.dealers (%s row(s)): %s', v_count, v_samples));
    END IF;
  END IF;

  SELECT c.conname, c.confrelid, fa.attname::TEXT, c.confdeltype
  INTO v_fk_name, v_fk_confrel, v_fk_col, v_fk_deltype
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_attribute la ON la.attrelid = c.conrelid AND la.attnum = c.conkey[1]
  JOIN pg_catalog.pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
  WHERE c.conrelid = v_rel AND c.contype = 'f' AND pg_catalog.array_length(c.conkey, 1) = 1 AND la.attname = 'vehicle_listing_id'
  LIMIT 1;

  IF v_fk_name IS NOT NULL AND (v_fk_confrel <> 'public.cars'::regclass OR v_fk_col <> 'id' OR v_fk_deltype <> 'c') THEN
    v_errors := array_append(v_errors, pg_catalog.format('Conflicting FK %I on vehicle_listing_id; expected REFERENCES public.cars(id) ON DELETE CASCADE.', v_fk_name));
  ELSIF v_fk_name IS NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.game_billboard_assignments t
    WHERE t.vehicle_listing_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.cars c WHERE c.id::TEXT = t.vehicle_listing_id::TEXT);
    IF v_count > 0 THEN
      SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
      FROM (
        SELECT COALESCE(t.id::TEXT, '<null>') || ':' || t.vehicle_listing_id::TEXT AS val
        FROM public.game_billboard_assignments t
        WHERE t.vehicle_listing_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.cars c WHERE c.id::TEXT = t.vehicle_listing_id::TEXT)
        LIMIT 10
      ) s;
      v_errors := array_append(v_errors, pg_catalog.format('Orphaned vehicle_listing_id rows not in public.cars (%s row(s)): %s', v_count, v_samples));
    END IF;
  END IF;

  SELECT c.conname, c.confrelid, fa.attname::TEXT, c.confdeltype
  INTO v_fk_name, v_fk_confrel, v_fk_col, v_fk_deltype
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_attribute la ON la.attrelid = c.conrelid AND la.attnum = c.conkey[1]
  JOIN pg_catalog.pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
  WHERE c.conrelid = v_rel AND c.contype = 'f' AND pg_catalog.array_length(c.conkey, 1) = 1 AND la.attname = 'created_by'
  LIMIT 1;

  IF v_fk_name IS NOT NULL AND (v_fk_confrel <> 'auth.users'::regclass OR v_fk_col <> 'id' OR v_fk_deltype <> 'n') THEN
    v_errors := array_append(v_errors, pg_catalog.format('Conflicting FK %I on created_by; expected REFERENCES auth.users(id) ON DELETE SET NULL.', v_fk_name));
  ELSIF v_fk_name IS NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.game_billboard_assignments t
    WHERE t.created_by IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.created_by);
    IF v_count > 0 THEN
      SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
      FROM (
        SELECT COALESCE(t.id::TEXT, '<null>') || ':' || t.created_by::TEXT AS val
        FROM public.game_billboard_assignments t
        WHERE t.created_by IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.created_by)
        LIMIT 10
      ) s;
      v_errors := array_append(v_errors, pg_catalog.format('Orphaned created_by rows not in auth.users (%s row(s)): %s', v_count, v_samples));
    END IF;
  END IF;

  -- 5. Inspect CHECK status & duplicate active vehicle_listing_id conflicts
  SELECT COUNT(*) INTO v_count
  FROM public.game_billboard_assignments
  WHERE status IS NULL OR status NOT IN ('active', 'paused', 'removed', 'expired');
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
    FROM (
      SELECT COALESCE(id::TEXT, '<null>') || '=' || COALESCE(status, 'NULL') AS val
      FROM public.game_billboard_assignments
      WHERE status IS NULL OR status NOT IN ('active', 'paused', 'removed', 'expired')
      LIMIT 10
    ) s;
    v_errors := array_append(v_errors, pg_catalog.format('Invalid status rows (%s row(s)): %s', v_count, v_samples));
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT vehicle_listing_id
    FROM public.game_billboard_assignments
    WHERE status = 'active' AND vehicle_listing_id IS NOT NULL
    GROUP BY vehicle_listing_id
    HAVING COUNT(*) > 1
  ) dup;
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.lbl, ', ') INTO v_samples
    FROM (
      SELECT vehicle_listing_id::TEXT || ' (' || COUNT(*)::TEXT || ' active rows)' AS lbl
      FROM public.game_billboard_assignments
      WHERE status = 'active' AND vehicle_listing_id IS NOT NULL
      GROUP BY vehicle_listing_id
      HAVING COUNT(*) > 1
      ORDER BY vehicle_listing_id
      LIMIT 10
    ) s;
    v_errors := array_append(
      v_errors,
      pg_catalog.format('Duplicate active billboard assignments for same vehicle (%s vehicle(s)): %s', v_count, v_samples)
    );
  END IF;

  IF pg_catalog.array_length(v_errors, 1) > 0 THEN
    RAISE EXCEPTION E'DEPLOYMENT BLOCKER: Cannot establish integrity constraints or unique index idx_billboard_unique_active_vehicle on public.game_billboard_assignments (existing rows preserved):\n  - %',
      pg_catalog.array_to_string(v_errors, E'\n  - ');
  END IF;

  -- 6. Apply missing constraints & unique index safely
  IF v_pk_name IS NULL THEN
    ALTER TABLE public.game_billboard_assignments
      ADD CONSTRAINT game_billboard_assignments_pkey PRIMARY KEY (id);
  END IF;

  FOREACH v_col IN ARRAY ARRAY['id', 'dealer_id', 'vehicle_listing_id', 'status', 'display_order', 'starts_at', 'created_at', 'updated_at'] LOOP
    SELECT a.attnotnull INTO v_attnotnull
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = v_rel AND a.attname = v_col AND NOT a.attisdropped;
    IF NOT COALESCE(v_attnotnull, false) THEN
      EXECUTE pg_catalog.format('ALTER TABLE public.game_billboard_assignments ALTER COLUMN %I SET NOT NULL', v_col);
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_attribute la ON la.attrelid = c.conrelid AND la.attnum = c.conkey[1]
    WHERE c.conrelid = v_rel AND c.contype = 'f' AND pg_catalog.array_length(c.conkey, 1) = 1 AND la.attname = 'dealer_id'
  ) THEN
    ALTER TABLE public.game_billboard_assignments
      ADD CONSTRAINT fk_game_billboard_assignments_dealer_id
      FOREIGN KEY (dealer_id) REFERENCES public.dealers(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_attribute la ON la.attrelid = c.conrelid AND la.attnum = c.conkey[1]
    WHERE c.conrelid = v_rel AND c.contype = 'f' AND pg_catalog.array_length(c.conkey, 1) = 1 AND la.attname = 'vehicle_listing_id'
  ) THEN
    ALTER TABLE public.game_billboard_assignments
      ADD CONSTRAINT fk_game_billboard_assignments_vehicle_listing_id
      FOREIGN KEY (vehicle_listing_id) REFERENCES public.cars(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_attribute la ON la.attrelid = c.conrelid AND la.attnum = c.conkey[1]
    WHERE c.conrelid = v_rel AND c.contype = 'f' AND pg_catalog.array_length(c.conkey, 1) = 1 AND la.attname = 'created_by'
  ) THEN
    ALTER TABLE public.game_billboard_assignments
      ADD CONSTRAINT fk_game_billboard_assignments_created_by
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_rel AND c.contype = 'c'
      AND (
        c.conname = 'chk_game_billboard_assignments_status'
        OR (
          pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''active''%'
          AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''paused''%'
          AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''removed''%'
          AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''expired''%'
        )
      )
  ) INTO v_has_check;

  IF NOT v_has_check THEN
    ALTER TABLE public.game_billboard_assignments
      ADD CONSTRAINT chk_game_billboard_assignments_status
      CHECK (status IN ('active', 'paused', 'removed', 'expired'));
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_billboard_unique_active_vehicle
    ON public.game_billboard_assignments (vehicle_listing_id)
    WHERE status = 'active';
END $$;

-- Trigger-only: enforce ownership, published status, and per-dealer slot quota at DB level
CREATE OR REPLACE FUNCTION public.enforce_game_billboard_constraints()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_car_dealer TEXT;
  v_car_status TEXT;
  v_max_slots INTEGER;
  v_active_count INTEGER;
  v_check_ownership BOOLEAN;
BEGIN
  -- Serialize concurrent billboard writes per dealer to prevent slot race conditions
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('billboard_dealer_' || COALESCE(NEW.dealer_id::TEXT, '')));

  SELECT dealer_id::TEXT, status::TEXT INTO v_car_dealer, v_car_status
  FROM public.cars
  WHERE id::TEXT = NEW.vehicle_listing_id::TEXT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced vehicle listing does not exist';
  END IF;

  -- Always enforce dealer ownership on INSERT, on active rows, or whenever dealer_id / vehicle_listing_id changes.
  -- Allow non-activating status transitions (e.g., active -> paused/removed/expired) when car ownership changed.
  v_check_ownership := (
    TG_OP = 'INSERT'
    OR NEW.status = 'active'
    OR NEW.dealer_id::TEXT IS DISTINCT FROM OLD.dealer_id::TEXT
    OR NEW.vehicle_listing_id::TEXT IS DISTINCT FROM OLD.vehicle_listing_id::TEXT
  );

  IF v_check_ownership AND v_car_dealer IS DISTINCT FROM NEW.dealer_id::TEXT THEN
    RAISE EXCEPTION 'Security violation: vehicle listing does not belong to this dealer';
  END IF;

  IF NEW.status = 'active' THEN
    IF pg_catalog.lower(COALESCE(v_car_status, '')) IS DISTINCT FROM 'published' THEN
      RAISE EXCEPTION 'Only published marketplace listings may hold an active game billboard slot';
    END IF;

    IF NEW.ends_at IS NOT NULL AND NEW.ends_at <= pg_catalog.now() THEN
      RAISE EXCEPTION 'Cannot activate an expired billboard assignment';
    END IF;

    SELECT COALESCE(
      (SELECT max_active_slots FROM public.dealer_advertising_plans WHERE dealer_id::TEXT = NEW.dealer_id::TEXT),
      1
    ) INTO v_max_slots;

    SELECT COUNT(*)::INTEGER INTO v_active_count
    FROM public.game_billboard_assignments
    WHERE dealer_id::TEXT = NEW.dealer_id::TEXT
      AND status = 'active'
      AND (ends_at IS NULL OR ends_at > pg_catalog.now())
      AND id IS DISTINCT FROM NEW.id;

    IF v_active_count >= v_max_slots THEN
      RAISE EXCEPTION 'BILLBOARD_SLOT_LIMIT_REACHED: Dealer is limited to % active billboard slot(s)', v_max_slots;
    END IF;
  END IF;

  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_game_billboard_constraints ON public.game_billboard_assignments;
CREATE TRIGGER trg_enforce_game_billboard_constraints
  BEFORE INSERT OR UPDATE ON public.game_billboard_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_game_billboard_constraints();

-- Trigger-only: auto-pause billboard slots if underlying marketplace listing stops being published
CREATE OR REPLACE FUNCTION public.sync_car_status_to_billboards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF pg_catalog.lower(COALESCE(NEW.status::TEXT, '')) IS DISTINCT FROM 'published'
     AND pg_catalog.lower(COALESCE(OLD.status::TEXT, '')) = 'published' THEN
    UPDATE public.game_billboard_assignments
    SET status = 'paused', updated_at = pg_catalog.now()
    WHERE vehicle_listing_id::TEXT = NEW.id::TEXT
      AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_car_status_to_billboards ON public.cars;
CREATE TRIGGER trg_sync_car_status_to_billboards
  AFTER UPDATE OF status ON public.cars
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_car_status_to_billboards();

-- Trigger-only: auto-pause active billboard slots if underlying marketplace listing changes dealer owner (or dealer becomes NULL)
CREATE OR REPLACE FUNCTION public.sync_car_dealer_to_billboards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.dealer_id::TEXT IS DISTINCT FROM OLD.dealer_id::TEXT THEN
    UPDATE public.game_billboard_assignments
    SET
      status = 'paused',
      updated_at = pg_catalog.now()
    WHERE vehicle_listing_id::TEXT = NEW.id::TEXT
      AND status = 'active'
      AND (NEW.dealer_id IS NULL OR dealer_id::TEXT IS DISTINCT FROM NEW.dealer_id::TEXT);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_car_dealer_to_billboards ON public.cars;
CREATE TRIGGER trg_sync_car_dealer_to_billboards
  AFTER UPDATE OF dealer_id ON public.cars
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_car_dealer_to_billboards();

-- ------------------------------------------------------------------------------
-- 4. GAME MISSIONS CATALOG & SERVER-TRACKED PLAYER PROGRESS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_missions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  mission_category TEXT NOT NULL CHECK (
    mission_category IN (
      'DELIVERY',
      'PASSENGER',
      'SHOWROOM',
      'PARKING',
      'CHECKPOINT',
      'SPEED_RUN',
      'STREET_RACE',
      'ENDURANCE'
    )
  ),
  distance_category TEXT NOT NULL CHECK (distance_category IN ('NEAR', 'FAR', 'VERY_FAR')),
  start_location_name TEXT NOT NULL,
  start_x DOUBLE PRECISION NOT NULL,
  start_z DOUBLE PRECISION NOT NULL,
  destination_name TEXT NOT NULL,
  dest_x DOUBLE PRECISION NOT NULL,
  dest_z DOUBLE PRECISION NOT NULL,
  dest_radius DOUBLE PRECISION NOT NULL DEFAULT 15,
  checkpoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  distance_meters INTEGER NOT NULL DEFAULT 500,
  estimated_minutes INTEGER NOT NULL DEFAULT 2,
  reward_credits INTEGER NOT NULL DEFAULT 500 CHECK (reward_credits >= 0),
  reward_xp INTEGER NOT NULL DEFAULT 100 CHECK (reward_xp >= 0),
  reward_badge TEXT,
  time_limit_seconds INTEGER NOT NULL DEFAULT 120 CHECK (time_limit_seconds >= 20),
  difficulty TEXT NOT NULL DEFAULT 'Easy' CHECK (difficulty IN ('Easy', 'Medium', 'Hard', 'Expert', 'Master')),
  cooldown_seconds INTEGER NOT NULL DEFAULT 90 CHECK (cooldown_seconds >= 0),
  requires_no_collision BOOLEAN NOT NULL DEFAULT false,
  require_park_gear BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reconcile partial pre-existing game_missions schemas safely
-- Note: Required columns without canonical defaults are added without fabricating defaults so invalid pre-existing rows are caught cleanly.
ALTER TABLE public.game_missions
  ADD COLUMN IF NOT EXISTS id TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS subtitle TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS mission_category TEXT,
  ADD COLUMN IF NOT EXISTS distance_category TEXT,
  ADD COLUMN IF NOT EXISTS start_location_name TEXT,
  ADD COLUMN IF NOT EXISTS start_x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS start_z DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS destination_name TEXT,
  ADD COLUMN IF NOT EXISTS dest_x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS dest_z DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS dest_radius DOUBLE PRECISION NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS checkpoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS distance_meters INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS reward_credits INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS reward_xp INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS reward_badge TEXT,
  ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'Easy',
  ADD COLUMN IF NOT EXISTS cooldown_seconds INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS requires_no_collision BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_park_gear BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Inspect game_missions data and restore defaults, PK, NOT NULLs, CHECKs, and unique invariants before seeding
DO $$
DECLARE
  v_rel REGCLASS := 'public.game_missions'::regclass;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_count BIGINT;
  v_samples TEXT;
  v_pk_name TEXT;
  v_pk_cols TEXT[];
  v_col TEXT;
  v_attnotnull BOOLEAN;
  v_has_check BOOLEAN;
  v_nn_cols TEXT[] := ARRAY[
    'id', 'title', 'subtitle', 'description', 'mission_category', 'distance_category',
    'start_location_name', 'start_x', 'start_z', 'destination_name', 'dest_x', 'dest_z',
    'dest_radius', 'checkpoints', 'distance_meters', 'estimated_minutes', 'reward_credits',
    'reward_xp', 'time_limit_seconds', 'difficulty', 'cooldown_seconds',
    'requires_no_collision', 'require_park_gear', 'is_active', 'sort_order',
    'created_at', 'updated_at'
  ];
BEGIN
  -- 1. Restore canonical column defaults
  ALTER TABLE public.game_missions
    ALTER COLUMN subtitle SET DEFAULT '',
    ALTER COLUMN dest_radius SET DEFAULT 15,
    ALTER COLUMN checkpoints SET DEFAULT '[]'::jsonb,
    ALTER COLUMN distance_meters SET DEFAULT 500,
    ALTER COLUMN estimated_minutes SET DEFAULT 2,
    ALTER COLUMN reward_credits SET DEFAULT 500,
    ALTER COLUMN reward_xp SET DEFAULT 100,
    ALTER COLUMN time_limit_seconds SET DEFAULT 120,
    ALTER COLUMN difficulty SET DEFAULT 'Easy',
    ALTER COLUMN cooldown_seconds SET DEFAULT 90,
    ALTER COLUMN requires_no_collision SET DEFAULT false,
    ALTER COLUMN require_park_gear SET DEFAULT false,
    ALTER COLUMN is_active SET DEFAULT true,
    ALTER COLUMN sort_order SET DEFAULT 100,
    ALTER COLUMN created_at SET DEFAULT NOW(),
    ALTER COLUMN updated_at SET DEFAULT NOW();

  -- 2. Inspect Primary Key & duplicate/NULL mission IDs
  SELECT c.conname,
         (
           SELECT pg_catalog.array_agg(a.attname::TEXT ORDER BY u.ord)
           FROM pg_catalog.unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord)
           JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
         )
  INTO v_pk_name, v_pk_cols
  FROM pg_catalog.pg_constraint c
  WHERE c.conrelid = v_rel AND c.contype = 'p';

  IF v_pk_name IS NOT NULL AND v_pk_cols IS DISTINCT FROM ARRAY['id']::TEXT[] THEN
    v_errors := array_append(
      v_errors,
      pg_catalog.format('Conflicting primary key %I on (%s); expected (id).', v_pk_name, pg_catalog.array_to_string(v_pk_cols, ', '))
    );
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.game_missions WHERE id IS NULL;
  IF v_count > 0 THEN
    v_errors := array_append(v_errors, pg_catalog.format('id has %s NULL row(s).', v_count));
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT id FROM public.game_missions
    WHERE id IS NOT NULL
    GROUP BY id HAVING COUNT(*) > 1
  ) dup;
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.lbl, ', ') INTO v_samples
    FROM (
      SELECT id::TEXT || ' (' || COUNT(*)::TEXT || 'x)' AS lbl
      FROM public.game_missions
      WHERE id IS NOT NULL
      GROUP BY id HAVING COUNT(*) > 1
      ORDER BY id LIMIT 10
    ) s;
    v_errors := array_append(v_errors, pg_catalog.format('Duplicate mission IDs (%s conflict(s)): %s', v_count, v_samples));
  END IF;

  -- 3. Inspect NOT NULL columns (all except reward_badge)
  FOREACH v_col IN ARRAY v_nn_cols LOOP
    SELECT a.attnotnull INTO v_attnotnull
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = v_rel AND a.attname = v_col AND NOT a.attisdropped;

    IF NOT COALESCE(v_attnotnull, false) THEN
      EXECUTE pg_catalog.format('SELECT COUNT(*) FROM public.game_missions WHERE %I IS NULL', v_col) INTO v_count;
      IF v_count > 0 THEN
        v_errors := array_append(v_errors, pg_catalog.format('Column %I has %s NULL row(s) blocking NOT NULL.', v_col, v_count));
      END IF;
    END IF;
  END LOOP;

  -- 4. Inspect all 7 CHECK invariants before adding constraints
  SELECT COUNT(*) INTO v_count
  FROM public.game_missions
  WHERE mission_category IS NULL
     OR mission_category NOT IN ('DELIVERY', 'PASSENGER', 'SHOWROOM', 'PARKING', 'CHECKPOINT', 'SPEED_RUN', 'STREET_RACE', 'ENDURANCE');
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
    FROM (
      SELECT COALESCE(id::TEXT, '<null>') || '=' || COALESCE(mission_category, 'NULL') AS val
      FROM public.game_missions
      WHERE mission_category IS NULL
         OR mission_category NOT IN ('DELIVERY', 'PASSENGER', 'SHOWROOM', 'PARKING', 'CHECKPOINT', 'SPEED_RUN', 'STREET_RACE', 'ENDURANCE')
      LIMIT 10
    ) s;
    v_errors := array_append(v_errors, pg_catalog.format('Invalid mission_category (%s row(s)): %s', v_count, v_samples));
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.game_missions
  WHERE distance_category IS NULL OR distance_category NOT IN ('NEAR', 'FAR', 'VERY_FAR');
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
    FROM (
      SELECT COALESCE(id::TEXT, '<null>') || '=' || COALESCE(distance_category, 'NULL') AS val
      FROM public.game_missions
      WHERE distance_category IS NULL OR distance_category NOT IN ('NEAR', 'FAR', 'VERY_FAR')
      LIMIT 10
    ) s;
    v_errors := array_append(v_errors, pg_catalog.format('Invalid distance_category (%s row(s)): %s', v_count, v_samples));
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.game_missions WHERE reward_credits IS NULL OR reward_credits < 0;
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
    FROM (
      SELECT COALESCE(id::TEXT, '<null>') || '=' || COALESCE(reward_credits::TEXT, 'NULL') AS val
      FROM public.game_missions WHERE reward_credits IS NULL OR reward_credits < 0 LIMIT 10
    ) s;
    v_errors := array_append(v_errors, pg_catalog.format('Invalid reward_credits < 0 (%s row(s)): %s', v_count, v_samples));
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.game_missions WHERE reward_xp IS NULL OR reward_xp < 0;
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
    FROM (
      SELECT COALESCE(id::TEXT, '<null>') || '=' || COALESCE(reward_xp::TEXT, 'NULL') AS val
      FROM public.game_missions WHERE reward_xp IS NULL OR reward_xp < 0 LIMIT 10
    ) s;
    v_errors := array_append(v_errors, pg_catalog.format('Invalid reward_xp < 0 (%s row(s)): %s', v_count, v_samples));
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.game_missions WHERE time_limit_seconds IS NULL OR time_limit_seconds < 20;
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
    FROM (
      SELECT COALESCE(id::TEXT, '<null>') || '=' || COALESCE(time_limit_seconds::TEXT, 'NULL') AS val
      FROM public.game_missions WHERE time_limit_seconds IS NULL OR time_limit_seconds < 20 LIMIT 10
    ) s;
    v_errors := array_append(v_errors, pg_catalog.format('Invalid time_limit_seconds < 20 (%s row(s)): %s', v_count, v_samples));
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.game_missions
  WHERE difficulty IS NULL OR difficulty NOT IN ('Easy', 'Medium', 'Hard', 'Expert', 'Master');
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
    FROM (
      SELECT COALESCE(id::TEXT, '<null>') || '=' || COALESCE(difficulty, 'NULL') AS val
      FROM public.game_missions
      WHERE difficulty IS NULL OR difficulty NOT IN ('Easy', 'Medium', 'Hard', 'Expert', 'Master')
      LIMIT 10
    ) s;
    v_errors := array_append(v_errors, pg_catalog.format('Invalid difficulty (%s row(s)): %s', v_count, v_samples));
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.game_missions WHERE cooldown_seconds IS NULL OR cooldown_seconds < 0;
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
    FROM (
      SELECT COALESCE(id::TEXT, '<null>') || '=' || COALESCE(cooldown_seconds::TEXT, 'NULL') AS val
      FROM public.game_missions WHERE cooldown_seconds IS NULL OR cooldown_seconds < 0 LIMIT 10
    ) s;
    v_errors := array_append(v_errors, pg_catalog.format('Invalid cooldown_seconds < 0 (%s row(s)): %s', v_count, v_samples));
  END IF;

  IF pg_catalog.array_length(v_errors, 1) > 0 THEN
    RAISE EXCEPTION E'DEPLOYMENT BLOCKER: Cannot establish integrity constraints on public.game_missions (existing rows preserved):\n  - %',
      pg_catalog.array_to_string(v_errors, E'\n  - ');
  END IF;

  -- 5. Apply missing constraints safely
  IF v_pk_name IS NULL THEN
    ALTER TABLE public.game_missions
      ADD CONSTRAINT game_missions_pkey PRIMARY KEY (id);
  END IF;

  FOREACH v_col IN ARRAY v_nn_cols LOOP
    SELECT a.attnotnull INTO v_attnotnull
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = v_rel AND a.attname = v_col AND NOT a.attisdropped;
    IF NOT COALESCE(v_attnotnull, false) THEN
      EXECUTE pg_catalog.format('ALTER TABLE public.game_missions ALTER COLUMN %I SET NOT NULL', v_col);
    END IF;
  END LOOP;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_rel AND c.contype = 'c'
      AND (
        c.conname = 'chk_game_missions_mission_category'
        OR (
          pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''DELIVERY''%'
          AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''STREET_RACE''%'
          AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''ENDURANCE''%'
        )
      )
  ) INTO v_has_check;
  IF NOT v_has_check THEN
    ALTER TABLE public.game_missions
      ADD CONSTRAINT chk_game_missions_mission_category
      CHECK (mission_category IN ('DELIVERY', 'PASSENGER', 'SHOWROOM', 'PARKING', 'CHECKPOINT', 'SPEED_RUN', 'STREET_RACE', 'ENDURANCE'));
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_rel AND c.contype = 'c'
      AND (
        c.conname = 'chk_game_missions_distance_category'
        OR (
          pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''NEAR''%'
          AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''FAR''%'
          AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''VERY_FAR''%'
        )
      )
  ) INTO v_has_check;
  IF NOT v_has_check THEN
    ALTER TABLE public.game_missions
      ADD CONSTRAINT chk_game_missions_distance_category
      CHECK (distance_category IN ('NEAR', 'FAR', 'VERY_FAR'));
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_rel AND c.contype = 'c'
      AND (c.conname = 'chk_game_missions_reward_credits' OR pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%reward_credits >= 0%')
  ) INTO v_has_check;
  IF NOT v_has_check THEN
    ALTER TABLE public.game_missions
      ADD CONSTRAINT chk_game_missions_reward_credits CHECK (reward_credits >= 0);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_rel AND c.contype = 'c'
      AND (c.conname = 'chk_game_missions_reward_xp' OR pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%reward_xp >= 0%')
  ) INTO v_has_check;
  IF NOT v_has_check THEN
    ALTER TABLE public.game_missions
      ADD CONSTRAINT chk_game_missions_reward_xp CHECK (reward_xp >= 0);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_rel AND c.contype = 'c'
      AND (c.conname = 'chk_game_missions_time_limit_seconds' OR pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%time_limit_seconds >= 20%')
  ) INTO v_has_check;
  IF NOT v_has_check THEN
    ALTER TABLE public.game_missions
      ADD CONSTRAINT chk_game_missions_time_limit_seconds CHECK (time_limit_seconds >= 20);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_rel AND c.contype = 'c'
      AND (
        c.conname = 'chk_game_missions_difficulty'
        OR (
          pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''Easy''%'
          AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''Master''%'
        )
      )
  ) INTO v_has_check;
  IF NOT v_has_check THEN
    ALTER TABLE public.game_missions
      ADD CONSTRAINT chk_game_missions_difficulty CHECK (difficulty IN ('Easy', 'Medium', 'Hard', 'Expert', 'Master'));
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_rel AND c.contype = 'c'
      AND (c.conname = 'chk_game_missions_cooldown_seconds' OR pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%cooldown_seconds >= 0%')
  ) INTO v_has_check;
  IF NOT v_has_check THEN
    ALTER TABLE public.game_missions
      ADD CONSTRAINT chk_game_missions_cooldown_seconds CHECK (cooldown_seconds >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_game_missions_active_category
  ON public.game_missions (is_active, distance_category, sort_order ASC);

-- Seed 12 verified Lagos missions across NEAR, FAR, VERY_FAR (idempotent; runs before player_mission_progress FK)
INSERT INTO public.game_missions (
  id, title, subtitle, description, mission_category, distance_category,
  start_location_name, start_x, start_z,
  destination_name, dest_x, dest_z, dest_radius,
  checkpoints, distance_meters, estimated_minutes,
  reward_credits, reward_xp, reward_badge, time_limit_seconds,
  difficulty, cooldown_seconds, requires_no_collision, require_park_gear, is_active, sort_order
) VALUES
  (
    'MISSION_A_DELIVERY',
    'Mainland Cargo Rush',
    'High-Priority ECU Component Delivery',
    'Transport prototype ECU hardware from Yaba Innovation Hub to Mainland Express Depot in Surulere. Avoid heavy collisions to protect cargo integrity.',
    'DELIVERY', 'NEAR',
    'Yaba Innovation Hub', 0, -125,
    'Mainland Express Cargo Terminal', -55, 100, 15,
    '[]'::jsonb, 480, 2, 500, 150, NULL, 95,
    'Easy', 60, false, false, true, 10
  ),
  (
    'NEAR_OBALENDE_PARCEL',
    'Obalende Express Parcel',
    'Commercial Row Courier Dispatch',
    'Deliver urgent vehicle registration documents from Herbert Macaulay North through Bank Row into Obalende Commercial Terminal.',
    'DELIVERY', 'NEAR',
    'Herbert Macaulay North', 0, -80,
    'Obalende Market & Terminal', 160, 30, 16,
    '[{"x":105,"z":0,"radius":14,"name":"Bank Row Junction"}]'::jsonb, 420, 2, 450, 120, NULL, 90,
    'Easy', 60, false, false, true, 20
  ),
  (
    'NEAR_DEALER_VIP_PICKUP',
    'VIP Showroom Chauffeur',
    'Marketplace Pickup & Lounge Transfer',
    'Pick up an executive client at the Grand Marketplace Portal and chauffeur them smoothly to the VIP Concierge & Dealer Lounge.',
    'PASSENGER', 'NEAR',
    'Showroom Esplanade', 0, 10,
    'VIP Dealer Lounge', 56, 16, 12,
    '[{"x":0,"z":100,"radius":14,"name":"Grand Marketplace Gate"}]'::jsonb, 340, 1, 550, 160, NULL, 85,
    'Easy', 60, false, false, true, 30
  ),
  (
    'NEAR_PRECISION_PARK',
    'Proving Ground Precision Bay',
    'Park-Gear Inspection Challenge',
    'Drive cleanly from Commercial Avenue into the central MANIFOLD Showroom bay, stop inside the zone, and shift into P (Park) gear.',
    'PARKING', 'NEAR',
    'Bank Row Junction', 105, 0,
    'MANIFOLD Showroom Bay', 0, -35, 11,
    '[]'::jsonb, 260, 1, 420, 140, NULL, 70,
    'Easy', 60, false, true, true, 40
  ),
  (
    'MISSION_B_RACE',
    'City Rival Challenge',
    'Mainland Grand Prix Street Race',
    'Line up against Tariq, Chidi, and Amara across the 10-checkpoint Surulere and Yaba street circuit.',
    'STREET_RACE', 'NEAR',
    'Surulere Grid Start', -50, -130,
    'Mainland Grand Prix Finish', -50, -130, 12,
    '[{"x":-50,"z":-130,"radius":10,"name":"Starting Grid / Sector 1"},{"x":0,"z":-130,"radius":11,"name":"Yaba Tech Apex Turn"},{"x":105,"z":-130,"radius":12,"name":"Tech Blvd Sweeper"},{"x":105,"z":0,"radius":11,"name":"Bank Row Chicane"},{"x":105,"z":100,"radius":11,"name":"Commercial Sector South"},{"x":0,"z":100,"radius":11,"name":"Marketplace Boulevard"},{"x":-55,"z":100,"radius":11,"name":"Depot S-Bend"},{"x":-110,"z":0,"radius":12,"name":"Surulere Express Straightaway"},{"x":-110,"z":-130,"radius":12,"name":"Expressway Final Hairpin"},{"x":-50,"z":-130,"radius":10,"name":"Finish Line Gantry"}]'::jsonb,
    780, 2, 1000, 300, 'Mainland Circuit Participant', 180,
    'Medium', 90, false, false, true, 50
  ),
  (
    'FAR_IKOYI_CLEAN_TRANSFER',
    'Bourdillon Diplomatic Escort',
    'Zero-Collision Executive Run',
    'Transport diplomatic guests via Adekunle Interchange straight to Bourdillon Towers in Ikoyi. Fixed participation credits/XP apply.',
    'PASSENGER', 'FAR',
    'Showroom Esplanade', 0, 10,
    'Ikoyi Bourdillon Towers', 365, -130, 16,
    '[{"x":160,"z":-130,"radius":16,"name":"Adekunle Interchange"}]'::jsonb, 1050, 3, 1200, 340, NULL, 135,
    'Medium', 120, true, false, true, 60
  ),
  (
    'FAR_LEKKI_COURIER',
    'Ikoyi-Lekki Bridge Courier',
    'Cross-Channel High-Priority Run',
    'Race from Obalende Terminal across the cable-stayed Ikoyi-Lekki Link Bridge into Lekki Phase 1 Admiralty Hub.',
    'SHOWROOM', 'FAR',
    'Obalende Terminal', 160, 30,
    'Lekki Phase 1 Admiralty Hub', 660, -20, 16,
    '[{"x":365,"z":-20,"radius":16,"name":"Ikoyi Link Bridgehead"},{"x":520,"z":-20,"radius":18,"name":"Cable Pylon Crest"}]'::jsonb, 1180, 3, 1300, 360, NULL, 140,
    'Medium', 120, false, false, true, 70
  ),
  (
    'FAR_TMB_CHECKPOINT_SPRINT',
    'Third Mainland Express Run',
    'Multi-Checkpoint Bridge Time Trial',
    'Blast north across Third Mainland Bridge through Iyana-Oworo all the way to Ikeja Central Business District before the timer expires.',
    'CHECKPOINT', 'FAR',
    'Yaba Bridge South Approach', 0, -130,
    'Ikeja Central Business District', 0, -880, 16,
    '[{"x":0,"z":-320,"radius":18,"name":"TMB Center South"},{"x":0,"z":-555,"radius":18,"name":"TMB North Deck"},{"x":0,"z":-640,"radius":18,"name":"Iyana-Oworo Interchange"}]'::jsonb, 1450, 2, 1450, 420, 'Bridge Sprinter', 125,
    'Hard', 120, false, false, true, 80
  ),
  (
    'FAR_OSHODI_FREIGHT',
    'Ikeja-Oshodi Supply Line',
    'Mainland Freight & Terminal Park',
    'Haul commercial dealership equipment from Ikeja CBD via Ikeja West and Dopemu to Oshodi Interchange and lock P (Park) gear on arrival.',
    'PARKING', 'FAR',
    'Ikeja Central Business District', 0, -880,
    'Oshodi Transport Interchange', -260, -640, 16,
    '[{"x":-130,"z":-880,"radius":16,"name":"Ikeja Along"},{"x":-260,"z":-760,"radius":16,"name":"Dopemu Bridge Link"}]'::jsonb, 1120, 3, 1250, 350, NULL, 150,
    'Medium', 120, false, true, true, 90
  ),
  (
    'VFAR_ISLAND_TO_EPE',
    'Cross-Lagos Epe Waterfront Haul',
    'Long-Range Eastern Coastal Logistics',
    'Complete a flagship long-haul delivery from MANIFOLD Showroom through Ikoyi, Lekki Phase 1, and Ajah Flyover to Epe Waterfront Marina.',
    'DELIVERY', 'VERY_FAR',
    'MANIFOLD Showroom', 0, -35,
    'Epe Waterfront Marina', 1565, 100, 18,
    '[{"x":260,"z":-20,"radius":18,"name":"Ikoyi Estates Blvd"},{"x":660,"z":-20,"radius":18,"name":"Lekki Phase 1"},{"x":1135,"z":100,"radius":18,"name":"Ajah Express Overpass"},{"x":1388,"z":100,"radius":18,"name":"Epe Lagoon Bridge"}]'::jsonb, 3150, 5, 2800, 750, 'Epe Voyager', 260,
    'Expert', 180, false, false, true, 100
  ),
  (
    'VFAR_MAINLAND_TO_LASU',
    'Island-to-LASU Campus Marathon',
    'Inter-District Endurance Run',
    'Drive across Lagos Lagoon via Third Mainland Bridge, navigate Oshodi and Igando corridors, and reach LASU Academic Quad in Ojo.',
    'ENDURANCE', 'VERY_FAR',
    'Showroom Esplanade', 0, 10,
    'LASU Academic Quad', -875, -660, 18,
    '[{"x":0,"z":-640,"radius":18,"name":"Iyana-Oworo"},{"x":-260,"z":-640,"radius":18,"name":"Oshodi Terminal"},{"x":-550,"z":-790,"radius":18,"name":"Igando Transit Hub"}]'::jsonb, 3400, 5, 3200, 850, 'LASU Express Legend', 290,
    'Expert', 180, false, false, true, 110
  ),
  (
    'VFAR_EPE_TO_LASU_GRAND_TOUR',
    'Lagos Grand Coast-to-Campus Tour',
    'Master Cross-Region Precision Endurance',
    'Traverse the full width of MANIFOLD Lagos from Epe Town Gateway through VGC, Ikoyi Link Bridge, Yaba, and Mainland to LASU Gate — then engage P gear!',
    'ENDURANCE', 'VERY_FAR',
    'Epe Town Gateway', 1495, 100,
    'LASU Main Entrance Gate', -790, -660, 18,
    '[{"x":1015,"z":100,"radius":18,"name":"VGC Interchange"},{"x":520,"z":-20,"radius":18,"name":"Ikoyi-Lekki Bridge"},{"x":0,"z":-130,"radius":18,"name":"Yaba Approach"},{"x":0,"z":-640,"radius":18,"name":"Iyana-Oworo"}]'::jsonb, 4450, 6, 4500, 1200, 'Trans-Lagos Sovereign', 360,
    'Master', 240, false, true, true, 120
  )
ON CONFLICT (id) DO NOTHING;

-- Backfill MISSION_B_RACE checkpoints & replace telemetry-gated exclusive badges idempotently
UPDATE public.game_missions
SET
  checkpoints = '[{"x":-50,"z":-130,"radius":10,"name":"Starting Grid / Sector 1"},{"x":0,"z":-130,"radius":11,"name":"Yaba Tech Apex Turn"},{"x":105,"z":-130,"radius":12,"name":"Tech Blvd Sweeper"},{"x":105,"z":0,"radius":11,"name":"Bank Row Chicane"},{"x":105,"z":100,"radius":11,"name":"Commercial Sector South"},{"x":0,"z":100,"radius":11,"name":"Marketplace Boulevard"},{"x":-55,"z":100,"radius":11,"name":"Depot S-Bend"},{"x":-110,"z":0,"radius":12,"name":"Surulere Express Straightaway"},{"x":-110,"z":-130,"radius":12,"name":"Expressway Final Hairpin"},{"x":-50,"z":-130,"radius":10,"name":"Finish Line Gantry"}]'::jsonb,
  updated_at = NOW()
WHERE id = 'MISSION_B_RACE'
  AND (checkpoints IS NULL OR jsonb_array_length(checkpoints) <> 10);

UPDATE public.game_missions
SET
  reward_badge = 'Mainland Circuit Participant',
  updated_at = NOW()
WHERE id = 'MISSION_B_RACE'
  AND reward_badge = 'Mainland Street Champion';

UPDATE public.game_missions
SET
  reward_badge = NULL,
  updated_at = NOW()
WHERE (id = 'NEAR_PRECISION_PARK' AND reward_badge = 'Precision Parker')
   OR (id = 'FAR_IKOYI_CLEAN_TRANSFER' AND reward_badge = 'Zero-Impact Chauffeur');

CREATE TABLE IF NOT EXISTS public.player_mission_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL REFERENCES public.game_missions(id) ON DELETE CASCADE,
  run_token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed', 'abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_checkpoint_at TIMESTAMPTZ,
  abandoned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reward_claimed_at TIMESTAMPTZ,
  credits_awarded INTEGER NOT NULL DEFAULT 0,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  reward_badge_awarded TEXT,
  checkpoints_reached JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_checkpoint_index INTEGER NOT NULL DEFAULT 0,
  last_reported_x DOUBLE PRECISION,
  last_reported_z DOUBLE PRECISION,
  failure_reason TEXT,
  checkpoint_reports_accepted BOOLEAN NOT NULL DEFAULT false,
  server_verified BOOLEAN NOT NULL DEFAULT false,
  client_telemetry JSONB NOT NULL DEFAULT '{}'::jsonb,
  progress_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reconcile all 25 player_mission_progress columns if table pre-existed from an earlier draft.
-- Leave reward_badge_awarded NULL on pre-existing completed rows unless already recorded.
-- Required columns without defaults (player_id, mission_id, status) remain NULL on pre-existing invalid rows so diagnostics report them.
ALTER TABLE public.player_mission_progress
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS player_id UUID,
  ADD COLUMN IF NOT EXISTS mission_id TEXT,
  ADD COLUMN IF NOT EXISTS run_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_checkpoint_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reward_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credits_awarded INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xp_awarded INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_badge_awarded TEXT,
  ADD COLUMN IF NOT EXISTS checkpoints_reached JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_checkpoint_index INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reported_x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_reported_z DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS checkpoint_reports_accepted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS server_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_telemetry JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS progress_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill checkpoint_reports_accepted from legacy checkpoint_route_verified if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'player_mission_progress'
      AND column_name = 'checkpoint_route_verified'
  ) THEN
    EXECUTE 'UPDATE public.player_mission_progress
             SET checkpoint_reports_accepted = COALESCE(checkpoint_reports_accepted, false) OR COALESCE(checkpoint_route_verified, false)
             WHERE checkpoint_route_verified = true AND checkpoint_reports_accepted = false';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_player_mission_progress_player_mission
  ON public.player_mission_progress (player_id, mission_id, completed_at DESC);

-- Inspect player_mission_progress data and restore defaults, PK, FKs, NOT NULLs, CHECK, and mandatory unique indexes
DO $$
DECLARE
  v_rel REGCLASS := 'public.player_mission_progress'::regclass;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_count BIGINT;
  v_samples TEXT;
  v_pk_name TEXT;
  v_pk_cols TEXT[];
  v_fk_name TEXT;
  v_fk_confrel OID;
  v_fk_col TEXT;
  v_fk_deltype CHAR;
  v_col TEXT;
  v_attnotnull BOOLEAN;
  v_has_check BOOLEAN;
  v_nn_cols TEXT[] := ARRAY[
    'id', 'player_id', 'mission_id', 'run_token', 'status', 'started_at',
    'credits_awarded', 'xp_awarded', 'checkpoints_reached', 'last_checkpoint_index',
    'checkpoint_reports_accepted', 'server_verified', 'client_telemetry', 'progress_data',
    'created_at', 'updated_at'
  ];
BEGIN
  -- 1. Restore canonical column defaults
  ALTER TABLE public.player_mission_progress
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN run_token SET DEFAULT gen_random_uuid(),
    ALTER COLUMN started_at SET DEFAULT NOW(),
    ALTER COLUMN credits_awarded SET DEFAULT 0,
    ALTER COLUMN xp_awarded SET DEFAULT 0,
    ALTER COLUMN checkpoints_reached SET DEFAULT '[]'::jsonb,
    ALTER COLUMN last_checkpoint_index SET DEFAULT 0,
    ALTER COLUMN checkpoint_reports_accepted SET DEFAULT false,
    ALTER COLUMN server_verified SET DEFAULT false,
    ALTER COLUMN client_telemetry SET DEFAULT '{}'::jsonb,
    ALTER COLUMN progress_data SET DEFAULT '{}'::jsonb,
    ALTER COLUMN created_at SET DEFAULT NOW(),
    ALTER COLUMN updated_at SET DEFAULT NOW();

  -- 2. Inspect Primary Key & id uniqueness/NULLs
  SELECT c.conname,
         (
           SELECT pg_catalog.array_agg(a.attname::TEXT ORDER BY u.ord)
           FROM pg_catalog.unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord)
           JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
         )
  INTO v_pk_name, v_pk_cols
  FROM pg_catalog.pg_constraint c
  WHERE c.conrelid = v_rel AND c.contype = 'p';

  IF v_pk_name IS NOT NULL AND v_pk_cols IS DISTINCT FROM ARRAY['id']::TEXT[] THEN
    v_errors := array_append(
      v_errors,
      pg_catalog.format('Conflicting primary key %I on (%s); expected (id).', v_pk_name, pg_catalog.array_to_string(v_pk_cols, ', '))
    );
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.player_mission_progress WHERE id IS NULL;
  IF v_count > 0 THEN
    v_errors := array_append(v_errors, pg_catalog.format('id has %s NULL row(s).', v_count));
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT id FROM public.player_mission_progress
    WHERE id IS NOT NULL
    GROUP BY id HAVING COUNT(*) > 1
  ) dup;
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.lbl, ', ') INTO v_samples
    FROM (
      SELECT id::TEXT || ' (' || COUNT(*)::TEXT || 'x)' AS lbl
      FROM public.player_mission_progress WHERE id IS NOT NULL
      GROUP BY id HAVING COUNT(*) > 1 ORDER BY id LIMIT 10
    ) s;
    v_errors := array_append(v_errors, pg_catalog.format('Duplicate id conflicts (%s group(s)): %s', v_count, v_samples));
  END IF;

  -- 3. Inspect NOT NULL columns (16 required; reward_badge_awarded & nullable timestamps stay nullable)
  FOREACH v_col IN ARRAY v_nn_cols LOOP
    SELECT a.attnotnull INTO v_attnotnull
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = v_rel AND a.attname = v_col AND NOT a.attisdropped;

    IF NOT COALESCE(v_attnotnull, false) THEN
      EXECUTE pg_catalog.format('SELECT COUNT(*) FROM public.player_mission_progress WHERE %I IS NULL', v_col) INTO v_count;
      IF v_count > 0 THEN
        v_errors := array_append(v_errors, pg_catalog.format('Column %I has %s NULL row(s) blocking NOT NULL.', v_col, v_count));
      END IF;
    END IF;
  END LOOP;

  -- 4. Inspect Foreign Keys (player_id -> player_profiles(id), mission_id -> game_missions(id))
  SELECT c.conname, c.confrelid, fa.attname::TEXT, c.confdeltype
  INTO v_fk_name, v_fk_confrel, v_fk_col, v_fk_deltype
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_attribute la ON la.attrelid = c.conrelid AND la.attnum = c.conkey[1]
  JOIN pg_catalog.pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
  WHERE c.conrelid = v_rel AND c.contype = 'f' AND pg_catalog.array_length(c.conkey, 1) = 1 AND la.attname = 'player_id'
  LIMIT 1;

  IF v_fk_name IS NOT NULL AND (v_fk_confrel <> 'public.player_profiles'::regclass OR v_fk_col <> 'id' OR v_fk_deltype <> 'c') THEN
    v_errors := array_append(v_errors, pg_catalog.format('Conflicting FK %I on player_id; expected REFERENCES public.player_profiles(id) ON DELETE CASCADE.', v_fk_name));
  ELSIF v_fk_name IS NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.player_mission_progress t
    WHERE t.player_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.player_profiles p WHERE p.id = t.player_id);
    IF v_count > 0 THEN
      SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
      FROM (
        SELECT COALESCE(t.id::TEXT, '<null>') || ':' || t.player_id::TEXT AS val
        FROM public.player_mission_progress t
        WHERE t.player_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.player_profiles p WHERE p.id = t.player_id)
        LIMIT 10
      ) s;
      v_errors := array_append(v_errors, pg_catalog.format('Orphaned player_id rows not in public.player_profiles (%s row(s)): %s', v_count, v_samples));
    END IF;
  END IF;

  SELECT c.conname, c.confrelid, fa.attname::TEXT, c.confdeltype
  INTO v_fk_name, v_fk_confrel, v_fk_col, v_fk_deltype
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_attribute la ON la.attrelid = c.conrelid AND la.attnum = c.conkey[1]
  JOIN pg_catalog.pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
  WHERE c.conrelid = v_rel AND c.contype = 'f' AND pg_catalog.array_length(c.conkey, 1) = 1 AND la.attname = 'mission_id'
  LIMIT 1;

  IF v_fk_name IS NOT NULL AND (v_fk_confrel <> 'public.game_missions'::regclass OR v_fk_col <> 'id' OR v_fk_deltype <> 'c') THEN
    v_errors := array_append(v_errors, pg_catalog.format('Conflicting FK %I on mission_id; expected REFERENCES public.game_missions(id) ON DELETE CASCADE.', v_fk_name));
  ELSIF v_fk_name IS NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.player_mission_progress t
    WHERE t.mission_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.game_missions m WHERE m.id = t.mission_id);
    IF v_count > 0 THEN
      SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
      FROM (
        SELECT COALESCE(t.id::TEXT, '<null>') || ':' || t.mission_id::TEXT AS val
        FROM public.player_mission_progress t
        WHERE t.mission_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.game_missions m WHERE m.id = t.mission_id)
        LIMIT 10
      ) s;
      v_errors := array_append(v_errors, pg_catalog.format('Orphaned mission_id rows not in public.game_missions (%s row(s)): %s', v_count, v_samples));
    END IF;
  END IF;

  -- 5. Inspect CHECK status & mandatory unique invariants (run_token, single in_progress per player)
  SELECT COUNT(*) INTO v_count
  FROM public.player_mission_progress
  WHERE status IS NULL OR status NOT IN ('in_progress', 'completed', 'failed', 'abandoned');
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.val, ', ') INTO v_samples
    FROM (
      SELECT COALESCE(id::TEXT, '<null>') || '=' || COALESCE(status, 'NULL') AS val
      FROM public.player_mission_progress
      WHERE status IS NULL OR status NOT IN ('in_progress', 'completed', 'failed', 'abandoned')
      LIMIT 10
    ) s;
    v_errors := array_append(v_errors, pg_catalog.format('Invalid status rows (%s row(s)): %s', v_count, v_samples));
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT run_token FROM public.player_mission_progress
    WHERE run_token IS NOT NULL
    GROUP BY run_token HAVING COUNT(*) > 1
  ) dup;
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.lbl, ', ') INTO v_samples
    FROM (
      SELECT run_token::TEXT || ' (' || COUNT(*)::TEXT || 'x)' AS lbl
      FROM public.player_mission_progress
      WHERE run_token IS NOT NULL
      GROUP BY run_token HAVING COUNT(*) > 1
      ORDER BY run_token LIMIT 10
    ) s;
    v_errors := array_append(v_errors, pg_catalog.format('Duplicate run_token conflicts (%s group(s)): %s', v_count, v_samples));
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT player_id FROM public.player_mission_progress
    WHERE status = 'in_progress' AND player_id IS NOT NULL
    GROUP BY player_id HAVING COUNT(*) > 1
  ) dup;
  IF v_count > 0 THEN
    SELECT pg_catalog.string_agg(s.lbl, ', ') INTO v_samples
    FROM (
      SELECT player_id::TEXT || ' (' || COUNT(*)::TEXT || ' in_progress runs)' AS lbl
      FROM public.player_mission_progress
      WHERE status = 'in_progress' AND player_id IS NOT NULL
      GROUP BY player_id HAVING COUNT(*) > 1
      ORDER BY player_id LIMIT 10
    ) s;
    v_errors := array_append(
      v_errors,
      pg_catalog.format('Multiple in_progress runs for one player (%s player(s)): %s', v_count, v_samples)
    );
  END IF;

  IF pg_catalog.array_length(v_errors, 1) > 0 THEN
    RAISE EXCEPTION E'DEPLOYMENT BLOCKER: Cannot establish integrity constraints or unique indexes on public.player_mission_progress (existing rows preserved):\n  - %',
      pg_catalog.array_to_string(v_errors, E'\n  - ');
  END IF;

  -- 6. Apply missing constraints & mandatory unique indexes safely
  IF v_pk_name IS NULL THEN
    ALTER TABLE public.player_mission_progress
      ADD CONSTRAINT player_mission_progress_pkey PRIMARY KEY (id);
  END IF;

  FOREACH v_col IN ARRAY v_nn_cols LOOP
    SELECT a.attnotnull INTO v_attnotnull
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = v_rel AND a.attname = v_col AND NOT a.attisdropped;
    IF NOT COALESCE(v_attnotnull, false) THEN
      EXECUTE pg_catalog.format('ALTER TABLE public.player_mission_progress ALTER COLUMN %I SET NOT NULL', v_col);
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_attribute la ON la.attrelid = c.conrelid AND la.attnum = c.conkey[1]
    WHERE c.conrelid = v_rel AND c.contype = 'f' AND pg_catalog.array_length(c.conkey, 1) = 1 AND la.attname = 'player_id'
  ) THEN
    ALTER TABLE public.player_mission_progress
      ADD CONSTRAINT fk_player_mission_progress_player_id
      FOREIGN KEY (player_id) REFERENCES public.player_profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_attribute la ON la.attrelid = c.conrelid AND la.attnum = c.conkey[1]
    WHERE c.conrelid = v_rel AND c.contype = 'f' AND pg_catalog.array_length(c.conkey, 1) = 1 AND la.attname = 'mission_id'
  ) THEN
    ALTER TABLE public.player_mission_progress
      ADD CONSTRAINT fk_player_mission_progress_mission_id
      FOREIGN KEY (mission_id) REFERENCES public.game_missions(id) ON DELETE CASCADE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = v_rel AND c.contype = 'c'
      AND (
        c.conname = 'chk_player_mission_progress_status'
        OR (
          pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''in_progress''%'
          AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''completed''%'
          AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''failed''%'
          AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''abandoned''%'
        )
      )
  ) INTO v_has_check;
  IF NOT v_has_check THEN
    ALTER TABLE public.player_mission_progress
      ADD CONSTRAINT chk_player_mission_progress_status
      CHECK (status IN ('in_progress', 'completed', 'failed', 'abandoned'));
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_player_mission_unique_run_token
    ON public.player_mission_progress (run_token);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_player_mission_single_in_progress
    ON public.player_mission_progress (player_id)
    WHERE status = 'in_progress';
END $$;

-- ------------------------------------------------------------------------------
-- 5. ENABLE ROW LEVEL SECURITY & ACCESS POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.dealer_advertising_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_billboard_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_mission_progress ENABLE ROW LEVEL SECURITY;

-- dealer_advertising_plans: authenticated dealer reads own plan; admin manages all
DROP POLICY IF EXISTS "Dealer reads own advertising plan" ON public.dealer_advertising_plans;
CREATE POLICY "Dealer reads own advertising plan" ON public.dealer_advertising_plans
  FOR SELECT TO authenticated
  USING (
    (public.current_dealer_id() IS NOT NULL AND dealer_id::TEXT = public.current_dealer_id()::TEXT)
    OR public.is_active_admin()
  );

DROP POLICY IF EXISTS "Admin manages dealer advertising plans" ON public.dealer_advertising_plans;
CREATE POLICY "Admin manages dealer advertising plans" ON public.dealer_advertising_plans
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- game_billboard_assignments: authenticated dealer reads own rows; admin manages all; public uses get_active_game_billboards() RPC
DROP POLICY IF EXISTS "Dealer reads own billboard assignments" ON public.game_billboard_assignments;
CREATE POLICY "Dealer reads own billboard assignments" ON public.game_billboard_assignments
  FOR SELECT TO authenticated
  USING (
    (public.current_dealer_id() IS NOT NULL AND dealer_id::TEXT = public.current_dealer_id()::TEXT)
    OR public.is_active_admin()
  );

DROP POLICY IF EXISTS "Admin manages all billboard assignments" ON public.game_billboard_assignments;
CREATE POLICY "Admin manages all billboard assignments" ON public.game_billboard_assignments
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- game_missions: strictly separate anon/authenticated active catalog read from authenticated admin policy
DROP POLICY IF EXISTS "Everyone reads active game missions" ON public.game_missions;
DROP POLICY IF EXISTS "Public reads active game missions" ON public.game_missions;
CREATE POLICY "Public reads active game missions" ON public.game_missions
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admin manages game missions" ON public.game_missions;
CREATE POLICY "Admin manages game missions" ON public.game_missions
  FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- player_mission_progress: owning authenticated player reads own progress; admin reads all; mutations happen via SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "Player reads own mission progress" ON public.player_mission_progress;
CREATE POLICY "Player reads own mission progress" ON public.player_mission_progress
  FOR SELECT TO authenticated
  USING (
    player_id = public.current_player_id()
    OR public.is_active_admin()
  );

-- ------------------------------------------------------------------------------
-- 6. DEALER BILLBOARD RPCs (PUBLIC SANITIZED FEED, DEALER ASSIGN, ADMIN MANAGE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_game_billboards()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    pg_catalog.jsonb_agg(row_obj ORDER BY display_order ASC, updated_at DESC),
    '[]'::jsonb
  )
  FROM (
    SELECT
      gba.display_order,
      gba.updated_at,
      pg_catalog.jsonb_build_object(
        'assignmentId', gba.id,
        'vehicleId', c.id,
        'slug', c.slug,
        'title', c.title,
        'year', c.year,
        'price', c.price,
        'previousPrice', c.previous_price,
        'originalPrice', NULL,
        'description', pg_catalog.left(COALESCE(c.description, ''), 140),
        'imageUrl', '',
        'location', c.location,
        'transmission', c.transmission,
        'condition', c.condition,
        'dealerId', d.id,
        'dealerName', d.business_name,
        'dealerCity', d.city,
        'displayOrder', gba.display_order
      ) AS row_obj
    FROM public.game_billboard_assignments gba
    JOIN public.cars c ON c.id::TEXT = gba.vehicle_listing_id::TEXT
    JOIN public.dealers d ON d.id::TEXT = gba.dealer_id::TEXT
    WHERE gba.status = 'active'
      AND pg_catalog.lower(c.status::TEXT) = 'published'
      AND (gba.starts_at IS NULL OR gba.starts_at <= pg_catalog.now())
      AND (gba.ends_at IS NULL OR gba.ends_at > pg_catalog.now())
  ) sub;
$$;

CREATE OR REPLACE FUNCTION public.get_my_dealer_billboard_state()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dealer_id TEXT := public.current_dealer_id()::TEXT;
  v_max_slots INTEGER := 1;
  v_plan_code TEXT := 'standard';
  v_assignments JSONB := '[]'::jsonb;
  v_active_count INTEGER := 0;
BEGIN
  IF v_dealer_id IS NULL OR NOT public.is_active_dealer() THEN
    RAISE EXCEPTION 'Active dealer account required';
  END IF;

  SELECT
    COALESCE(plan_code, 'standard'),
    COALESCE(max_active_slots, 1)
  INTO v_plan_code, v_max_slots
  FROM public.dealer_advertising_plans
  WHERE dealer_id::TEXT = v_dealer_id;

  IF NOT FOUND THEN
    v_plan_code := 'standard';
    v_max_slots := 1;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_active_count
  FROM public.game_billboard_assignments
  WHERE dealer_id::TEXT = v_dealer_id
    AND status = 'active'
    AND (ends_at IS NULL OR ends_at > pg_catalog.now());

  SELECT COALESCE(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', gba.id,
      'dealerId', gba.dealer_id,
      'vehicleListingId', gba.vehicle_listing_id,
      'status', CASE
        WHEN gba.status = 'active' AND gba.ends_at IS NOT NULL AND gba.ends_at <= pg_catalog.now() THEN 'expired'
        ELSE gba.status
      END,
      'displayOrder', gba.display_order,
      'startsAt', gba.starts_at,
      'endsAt', gba.ends_at,
      'createdAt', gba.created_at,
      'updatedAt', gba.updated_at,
      'vehicleTitle', c.title,
      'vehicleYear', c.year,
      'vehicleSlug', c.slug,
      'vehiclePrice', c.price,
      'vehiclePreviousPrice', c.previous_price,
      'vehicleOriginalPrice', NULL,
      'vehicleStatus', c.status,
      'vehicleImageUrl', ''
    ) ORDER BY (gba.status = 'active' AND (gba.ends_at IS NULL OR gba.ends_at > pg_catalog.now())) DESC, gba.updated_at DESC
  ), '[]'::jsonb)
  INTO v_assignments
  FROM public.game_billboard_assignments gba
  JOIN public.cars c ON c.id::TEXT = gba.vehicle_listing_id::TEXT
  WHERE gba.dealer_id::TEXT = v_dealer_id
    AND gba.status IN ('active', 'paused');

  RETURN pg_catalog.jsonb_build_object(
    'dealerId', v_dealer_id,
    'planCode', v_plan_code,
    'maxActiveSlots', v_max_slots,
    'activeCount', v_active_count,
    'assignments', v_assignments
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_vehicle_to_game_billboard(
  p_vehicle_id TEXT,
  p_replace_existing BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_dealer_id TEXT := public.current_dealer_id()::TEXT;
  v_car public.cars%ROWTYPE;
  v_max_slots INTEGER := 1;
  v_active_count INTEGER := 0;
  v_existing_active RECORD;
  v_new_id UUID;
BEGIN
  IF v_uid IS NULL OR v_dealer_id IS NULL OR NOT public.is_active_dealer() THEN
    RAISE EXCEPTION 'Active dealer authorization required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('billboard_dealer_' || v_dealer_id));

  SELECT * INTO v_car FROM public.cars WHERE id::TEXT = p_vehicle_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle listing not found';
  END IF;

  IF v_car.dealer_id::TEXT IS DISTINCT FROM v_dealer_id THEN
    RAISE EXCEPTION 'You can only assign vehicles belonging to your own dealership';
  END IF;

  IF pg_catalog.lower(COALESCE(v_car.status::TEXT, '')) IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'Vehicle must be published on the marketplace before assigning to the game billboard';
  END IF;

  SELECT COALESCE(
    (SELECT max_active_slots FROM public.dealer_advertising_plans WHERE dealer_id::TEXT = v_dealer_id),
    1
  ) INTO v_max_slots;

  -- If already active (and non-expired) on billboard, return cleanly
  SELECT id INTO v_existing_active
  FROM public.game_billboard_assignments
  WHERE dealer_id::TEXT = v_dealer_id
    AND vehicle_listing_id::TEXT = p_vehicle_id
    AND status = 'active'
    AND (ends_at IS NULL OR ends_at > pg_catalog.now())
  LIMIT 1;

  IF FOUND THEN
    RETURN pg_catalog.jsonb_build_object('success', true, 'assignmentId', v_existing_active.id, 'alreadyActive', true);
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_active_count
  FROM public.game_billboard_assignments
  WHERE dealer_id::TEXT = v_dealer_id
    AND status = 'active'
    AND (ends_at IS NULL OR ends_at > pg_catalog.now());

  IF v_active_count >= v_max_slots THEN
    IF NOT p_replace_existing THEN
      RAISE EXCEPTION 'BILLBOARD_SLOT_LIMIT_REACHED: You already have % of % active billboard slot(s) occupied. Replace an existing slot or contact Admin on WhatsApp (08169664607) to upgrade.', v_active_count, v_max_slots;
    END IF;

    -- Replace enough oldest active non-expired assignments so slot count fits within v_max_slots
    UPDATE public.game_billboard_assignments
    SET status = 'removed', updated_at = pg_catalog.now()
    WHERE id IN (
      SELECT id FROM public.game_billboard_assignments
      WHERE dealer_id::TEXT = v_dealer_id
        AND status = 'active'
        AND (ends_at IS NULL OR ends_at > pg_catalog.now())
      ORDER BY display_order ASC, updated_at ASC, id ASC
      LIMIT GREATEST(1, v_active_count - v_max_slots + 1)
    );
  END IF;

  INSERT INTO public.game_billboard_assignments (
    dealer_id, vehicle_listing_id, status, display_order, created_by
  ) VALUES (
  v_dealer_id::UUID, p_vehicle_id::UUID, 'active', 100, v_uid
  )
  RETURNING id INTO v_new_id;

  RETURN pg_catalog.jsonb_build_object('success', true, 'assignmentId', v_new_id, 'alreadyActive', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_my_game_billboard_slot(
  p_assignment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dealer_id TEXT := public.current_dealer_id()::TEXT;
BEGIN
  IF v_dealer_id IS NULL OR NOT public.is_active_dealer() THEN
    RAISE EXCEPTION 'Active dealer authorization required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('billboard_dealer_' || v_dealer_id));

  UPDATE public.game_billboard_assignments
  SET status = 'removed', updated_at = pg_catalog.now()
  WHERE id = p_assignment_id
    AND dealer_id::TEXT = v_dealer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billboard assignment not found for your dealership';
  END IF;

  RETURN pg_catalog.jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_billboard_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_assignments JSONB;
  v_dealers JSONB;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin authorization required';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', gba.id,
      'dealerId', gba.dealer_id,
      'dealerName', d.business_name,
      'dealerCity', d.city,
      'vehicleListingId', gba.vehicle_listing_id,
      'vehicleTitle', c.title,
      'vehicleYear', c.year,
      'vehicleSlug', c.slug,
      'vehiclePrice', c.price,
      'vehiclePreviousPrice', c.previous_price,
      'vehicleStatus', c.status,
      'vehicleImageUrl', '',
      'status', CASE
        WHEN gba.status = 'active' AND gba.ends_at IS NOT NULL AND gba.ends_at <= pg_catalog.now() THEN 'expired'
        ELSE gba.status
      END,
      'displayOrder', gba.display_order,
      'endsAt', gba.ends_at,
      'createdAt', gba.created_at,
      'updatedAt', gba.updated_at
    ) ORDER BY (gba.status = 'active' AND (gba.ends_at IS NULL OR gba.ends_at > pg_catalog.now())) DESC, gba.display_order ASC, gba.updated_at DESC
  ), '[]'::jsonb)
  INTO v_assignments
  FROM public.game_billboard_assignments gba
  JOIN public.dealers d ON d.id::TEXT = gba.dealer_id::TEXT
  JOIN public.cars c ON c.id::TEXT = gba.vehicle_listing_id::TEXT;

  SELECT COALESCE(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'dealerId', d.id,
      'dealerName', d.business_name,
      'dealerCity', d.city,
      'planCode', COALESCE(dap.plan_code, 'standard'),
      'maxActiveSlots', COALESCE(dap.max_active_slots, 1),
      'activeSlotsUsed', (
        SELECT COUNT(*)::INTEGER FROM public.game_billboard_assignments x
        WHERE x.dealer_id::TEXT = d.id::TEXT
          AND x.status = 'active'
          AND (x.ends_at IS NULL OR x.ends_at > pg_catalog.now())
      ),
      'notes', dap.notes
    ) ORDER BY d.business_name ASC
  ), '[]'::jsonb)
  INTO v_dealers
  FROM public.dealers d
  LEFT JOIN public.dealer_advertising_plans dap ON dap.dealer_id::TEXT = d.id::TEXT;

  RETURN pg_catalog.jsonb_build_object('assignments', v_assignments, 'dealers', v_dealers);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_manage_billboard_assignment(
  p_assignment_id UUID,
  p_status TEXT,
  p_display_order INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_assignment public.game_billboard_assignments%ROWTYPE;
  v_car_status TEXT;
  v_car_dealer TEXT;
  v_max_slots INTEGER := 1;
  v_active_count INTEGER := 0;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin authorization required';
  END IF;

  IF p_status NOT IN ('active', 'paused', 'removed', 'expired') THEN
    RAISE EXCEPTION 'Invalid billboard status';
  END IF;

  SELECT * INTO v_assignment
  FROM public.game_billboard_assignments
  WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billboard assignment not found';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('billboard_dealer_' || v_assignment.dealer_id::TEXT));

  IF p_status = 'active' THEN
    IF v_assignment.ends_at IS NOT NULL AND v_assignment.ends_at <= pg_catalog.now() THEN
      RAISE EXCEPTION 'Cannot reactivate an expired billboard assignment';
    END IF;

    SELECT dealer_id::TEXT, status::TEXT INTO v_car_dealer, v_car_status
    FROM public.cars
    WHERE id::TEXT = v_assignment.vehicle_listing_id::TEXT;

    IF NOT FOUND OR v_car_dealer IS DISTINCT FROM v_assignment.dealer_id::TEXT THEN
      RAISE EXCEPTION 'Referenced vehicle listing does not belong to this assignment dealer';
    END IF;

    IF pg_catalog.lower(COALESCE(v_car_status, '')) IS DISTINCT FROM 'published' THEN
      RAISE EXCEPTION 'Cannot activate billboard for a vehicle that is not published on the marketplace';
    END IF;

    SELECT COALESCE(
      (SELECT max_active_slots FROM public.dealer_advertising_plans WHERE dealer_id::TEXT = v_assignment.dealer_id::TEXT),
      1
    ) INTO v_max_slots;

    SELECT COUNT(*)::INTEGER INTO v_active_count
    FROM public.game_billboard_assignments
    WHERE dealer_id::TEXT = v_assignment.dealer_id::TEXT
      AND status = 'active'
      AND (ends_at IS NULL OR ends_at > pg_catalog.now())
      AND id IS DISTINCT FROM p_assignment_id;

    IF v_active_count >= v_max_slots THEN
      RAISE EXCEPTION 'BILLBOARD_SLOT_LIMIT_REACHED: Dealer already occupies % of % active slot(s); increase entitlement or pause another slot first.', v_active_count, v_max_slots;
    END IF;
  END IF;

  UPDATE public.game_billboard_assignments
  SET
    status = p_status,
    display_order = COALESCE(p_display_order, display_order),
    updated_at = pg_catalog.now()
  WHERE id = p_assignment_id;

  RETURN pg_catalog.jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_dealer_billboard_slots(
  p_dealer_id TEXT,
  p_max_slots INTEGER,
  p_plan_code TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_paused_excess INTEGER := 0;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin authorization required';
  END IF;

  IF p_max_slots < 1 OR p_max_slots > 25 THEN
    RAISE EXCEPTION 'max_active_slots must be between 1 and 25';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.dealers WHERE id::TEXT = p_dealer_id) THEN
    RAISE EXCEPTION 'Dealer not found';
  END IF;

  -- Serialize with dealer billboard assignment/trigger checks
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('billboard_dealer_' || p_dealer_id));

  INSERT INTO public.dealer_advertising_plans (
    dealer_id, plan_code, max_active_slots, notes, updated_by, updated_at
  ) VALUES (
    p_dealer_id::UUID,
    COALESCE(NULLIF(pg_catalog.btrim(p_plan_code), ''), CASE WHEN p_max_slots > 1 THEN 'featured_pro' ELSE 'standard' END),
    p_max_slots,
    NULLIF(pg_catalog.btrim(COALESCE(p_notes, '')), ''),
    auth.uid(),
    pg_catalog.now()
  )
  ON CONFLICT (dealer_id) DO UPDATE SET
    plan_code = COALESCE(NULLIF(pg_catalog.btrim(p_plan_code), ''), CASE WHEN p_max_slots > 1 THEN 'featured_pro' ELSE 'standard' END),
    max_active_slots = p_max_slots,
    notes = COALESCE(NULLIF(pg_catalog.btrim(COALESCE(p_notes, '')), ''), dealer_advertising_plans.notes),
    updated_by = auth.uid(),
    updated_at = pg_catalog.now();

  -- If quota was lowered below existing active non-expired count, auto-pause excess slots FIFO
  -- while leaving expired rows untouched as historical records.
  WITH excess AS (
    SELECT id
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY display_order ASC, created_at ASC, id ASC) AS rn
      FROM public.game_billboard_assignments
      WHERE dealer_id::TEXT = p_dealer_id
        AND status = 'active'
        AND (ends_at IS NULL OR ends_at > pg_catalog.now())
    ) ranked
    WHERE rn > p_max_slots
  )
  UPDATE public.game_billboard_assignments gba
  SET status = 'paused', updated_at = pg_catalog.now()
  FROM excess
  WHERE gba.id = excess.id;

  GET DIAGNOSTICS v_paused_excess = ROW_COUNT;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'dealerId', p_dealer_id,
    'maxActiveSlots', p_max_slots,
    'pausedExcessCount', v_paused_excess
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. SERVER-AUTHORITATIVE MISSION LIFECYCLE RPCs
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_mission_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_player_id UUID := public.current_player_id();
  v_missions JSONB;
  v_progress JSONB := '{}'::jsonb;
BEGIN
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated player profile required';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) ORDER BY m.sort_order ASC), '[]'::jsonb)
  INTO v_missions
  FROM public.game_missions m
  WHERE m.is_active = true;

  SELECT COALESCE(
    pg_catalog.jsonb_object_agg(mission_id, stat_obj),
    '{}'::jsonb
  )
  INTO v_progress
  FROM (
    SELECT
      pmp.mission_id,
      pg_catalog.jsonb_build_object(
        'completedCount', COUNT(*) FILTER (WHERE pmp.status = 'completed'),
        'lastCompletedAt', MAX(pmp.completed_at) FILTER (WHERE pmp.status = 'completed'),
        'lastRewardClaimedAt', MAX(pmp.reward_claimed_at) FILTER (WHERE pmp.status = 'completed'),
        'totalCreditsEarned', COALESCE(SUM(pmp.credits_awarded), 0)
      ) AS stat_obj
    FROM public.player_mission_progress pmp
    WHERE pmp.player_id = v_player_id
    GROUP BY pmp.mission_id
  ) s;

  RETURN pg_catalog.jsonb_build_object(
    'missions', v_missions,
    'progress', v_progress,
    'serverNow', pg_catalog.now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.start_game_mission(p_mission_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_player_id UUID := public.current_player_id();
  v_mission public.game_missions%ROWTYPE;
  v_last_claim TIMESTAMPTZ;
  v_wait_sec INTEGER;
  v_run_token UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated player profile required';
  END IF;

  -- Serialize concurrent mission starts/completions per player
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mission_player_' || v_player_id::TEXT));

  SELECT * INTO v_mission FROM public.game_missions WHERE id = p_mission_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found or inactive';
  END IF;

  -- Check cooldown from last claimed completion
  IF v_mission.cooldown_seconds > 0 THEN
    SELECT MAX(reward_claimed_at) INTO v_last_claim
    FROM public.player_mission_progress
    WHERE player_id = v_player_id
      AND mission_id = p_mission_id
      AND status = 'completed';

    IF v_last_claim IS NOT NULL AND v_last_claim + pg_catalog.make_interval(secs => v_mission.cooldown_seconds) > pg_catalog.now() THEN
      v_wait_sec := pg_catalog.ceil(EXTRACT(EPOCH FROM ((v_last_claim + pg_catalog.make_interval(secs => v_mission.cooldown_seconds)) - pg_catalog.now())))::INTEGER;
      RAISE EXCEPTION 'Mission cooldown active (% seconds remaining)', v_wait_sec;
    END IF;
  END IF;

  -- Close any stale open runs atomically before creating a fresh run.
  -- Populate abandoned_at for abandoned runs; NEVER set completed_at on abandoned/stale-closed runs.
  UPDATE public.player_mission_progress
  SET
    status = CASE WHEN expires_at IS NOT NULL AND expires_at < pg_catalog.now() THEN 'failed' ELSE 'abandoned' END,
    abandoned_at = CASE WHEN expires_at IS NOT NULL AND expires_at < pg_catalog.now() THEN NULL ELSE pg_catalog.now() END,
    completed_at = NULL,
    failure_reason = CASE
      WHEN expires_at IS NOT NULL AND expires_at < pg_catalog.now() THEN 'Server time limit expired before completion'
      ELSE COALESCE(failure_reason, 'Superseded by new mission run')
    END,
    updated_at = pg_catalog.now()
  WHERE player_id = v_player_id
    AND status = 'in_progress';

  -- Server-enforced deadline (+5s network/countdown grace buffer)
  v_expires_at := pg_catalog.now() + pg_catalog.make_interval(secs => v_mission.time_limit_seconds + 5);

  INSERT INTO public.player_mission_progress (
    player_id,
    mission_id,
    status,
    started_at,
    expires_at,
    last_checkpoint_at,
    checkpoints_reached,
    last_checkpoint_index,
    last_reported_x,
    last_reported_z,
    checkpoint_reports_accepted,
    server_verified,
    client_telemetry
  ) VALUES (
    v_player_id,
    p_mission_id,
    'in_progress',
    pg_catalog.now(),
    v_expires_at,
    pg_catalog.now(),
    '[]'::jsonb,
    0,
    v_mission.start_x,
    v_mission.start_z,
    false,
    false,
    '{}'::jsonb
  )
  RETURNING run_token INTO v_run_token;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'runToken', v_run_token,
    'serverNow', pg_catalog.now(),
    'expiresAt', v_expires_at,
    'timeLimitSeconds', v_mission.time_limit_seconds
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.report_game_mission_checkpoint(
  p_mission_id TEXT,
  p_run_token UUID,
  p_checkpoint_index INTEGER,
  p_x DOUBLE PRECISION,
  p_z DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_player_id UUID := public.current_player_id();
  v_mission public.game_missions%ROWTYPE;
  v_run public.player_mission_progress%ROWTYPE;
  v_cp JSONB;
  v_cp_count INTEGER;
  v_cp_x DOUBLE PRECISION;
  v_cp_z DOUBLE PRECISION;
  v_cp_radius DOUBLE PRECISION;
  v_dist DOUBLE PRECISION;
  v_prev_x DOUBLE PRECISION;
  v_prev_z DOUBLE PRECISION;
  v_prev_time TIMESTAMPTZ;
  v_segment_dist DOUBLE PRECISION;
  v_segment_elapsed DOUBLE PRECISION;
  v_min_segment_sec DOUBLE PRECISION;
  v_record JSONB;
BEGIN
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated player profile required';
  END IF;

  IF p_mission_id IS NULL OR pg_catalog.btrim(p_mission_id) = '' OR p_run_token IS NULL OR p_checkpoint_index IS NULL THEN
    RAISE EXCEPTION 'Valid mission ID, run token, and checkpoint index are required';
  END IF;

  IF p_x IS NULL OR p_z IS NULL
     OR p_x = 'NaN'::DOUBLE PRECISION OR p_z = 'NaN'::DOUBLE PRECISION
     OR p_x = 'Infinity'::DOUBLE PRECISION OR p_x = '-Infinity'::DOUBLE PRECISION
     OR p_z = 'Infinity'::DOUBLE PRECISION OR p_z = '-Infinity'::DOUBLE PRECISION
     OR pg_catalog.abs(p_x) > 5000.0 OR pg_catalog.abs(p_z) > 5000.0 THEN
    RAISE EXCEPTION 'Finite vehicle coordinates within world bounds are required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mission_player_' || v_player_id::TEXT));

  SELECT * INTO v_mission FROM public.game_missions WHERE id = p_mission_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found or inactive';
  END IF;

  SELECT * INTO v_run
  FROM public.player_mission_progress
  WHERE player_id = v_player_id
    AND mission_id = p_mission_id
    AND run_token = p_run_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission run record not found';
  END IF;

  IF v_run.status <> 'in_progress' OR v_run.reward_claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Mission run is no longer active';
  END IF;

  -- Enforce server time limit
  IF v_run.expires_at IS NOT NULL AND pg_catalog.now() > v_run.expires_at THEN
    UPDATE public.player_mission_progress
    SET
      status = 'failed',
      completed_at = NULL,
      failure_reason = 'Server time limit exceeded before checkpoint',
      updated_at = pg_catalog.now()
    WHERE id = v_run.id;

    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'expired', true,
      'message', 'Mission time limit exceeded on server'
    );
  END IF;

  v_cp_count := COALESCE(pg_catalog.jsonb_array_length(v_mission.checkpoints), 0);
  IF p_checkpoint_index < 0 OR p_checkpoint_index >= v_cp_count THEN
    RAISE EXCEPTION 'Invalid checkpoint index';
  END IF;

  -- Idempotent repeat report for an already-recorded checkpoint
  IF p_checkpoint_index < v_run.last_checkpoint_index THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'alreadyRecorded', true,
      'nextCheckpointIndex', v_run.last_checkpoint_index,
      'totalCheckpoints', v_cp_count
    );
  END IF;

  -- Must progress strictly sequentially
  IF p_checkpoint_index > v_run.last_checkpoint_index THEN
    RAISE EXCEPTION 'Out-of-order checkpoint sequence (expected %, received %)', v_run.last_checkpoint_index, p_checkpoint_index;
  END IF;

  v_cp := v_mission.checkpoints -> p_checkpoint_index;
  v_cp_x := (v_cp->>'x')::DOUBLE PRECISION;
  v_cp_z := (v_cp->>'z')::DOUBLE PRECISION;
  v_cp_radius := COALESCE((v_cp->>'radius')::DOUBLE PRECISION, 14.0);

  IF v_cp_x IS NULL OR v_cp_z IS NULL OR v_cp_radius <= 0
     OR v_cp_x = 'NaN'::DOUBLE PRECISION OR v_cp_z = 'NaN'::DOUBLE PRECISION
     OR v_cp_x = 'Infinity'::DOUBLE PRECISION OR v_cp_z = 'Infinity'::DOUBLE PRECISION THEN
    RAISE EXCEPTION 'Mission checkpoint configuration invalid';
  END IF;

  v_dist := pg_catalog.sqrt(pg_catalog.power(p_x - v_cp_x, 2) + pg_catalog.power(p_z - v_cp_z, 2));

  -- Allow +8.0 units interpolation / network latency tolerance around DB checkpoint radius
  IF v_dist > (v_cp_radius + 8.0) THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'recorded', false,
      'distanceFromCheckpoint', pg_catalog.round(v_dist::NUMERIC, 2),
      'message', 'Vehicle outside checkpoint verification zone'
    );
  END IF;

  -- Enforce minimum plausible inter-checkpoint travel time from start or prior checkpoint
  v_prev_x := COALESCE(v_run.last_reported_x, v_mission.start_x);
  v_prev_z := COALESCE(v_run.last_reported_z, v_mission.start_z);
  v_prev_time := COALESCE(v_run.last_checkpoint_at, v_run.started_at);
  v_segment_dist := pg_catalog.sqrt(pg_catalog.power(v_cp_x - v_prev_x, 2) + pg_catalog.power(v_cp_z - v_prev_z, 2));
  v_segment_elapsed := GREATEST(0.0, EXTRACT(EPOCH FROM (pg_catalog.now() - v_prev_time)));
  v_min_segment_sec := CASE
    WHEN p_checkpoint_index = 0 AND v_segment_dist <= 25.0 THEN 0.15
    ELSE GREATEST(0.4, GREATEST(0.0, v_segment_dist - 30.0) / 160.0)
  END;

  IF v_segment_elapsed < v_min_segment_sec THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'recorded', false,
      'message', 'Checkpoint transition faster than plausible vehicle travel time'
    );
  END IF;

  v_record := pg_catalog.jsonb_build_object(
    'idx', p_checkpoint_index,
    'name', COALESCE(v_cp->>'name', 'Checkpoint ' || (p_checkpoint_index + 1)),
    'x', pg_catalog.round(p_x::NUMERIC, 2),
    'z', pg_catalog.round(p_z::NUMERIC, 2),
    'dist', pg_catalog.round(v_dist::NUMERIC, 2),
    'segmentElapsedSec', pg_catalog.round(v_segment_elapsed::NUMERIC, 2),
    'at', pg_catalog.now()
  );

  UPDATE public.player_mission_progress
  SET
    checkpoints_reached = checkpoints_reached || pg_catalog.jsonb_build_array(v_record),
    last_checkpoint_index = v_run.last_checkpoint_index + 1,
    last_checkpoint_at = pg_catalog.now(),
    last_reported_x = p_x,
    last_reported_z = p_z,
    updated_at = pg_catalog.now()
  WHERE id = v_run.id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'recorded', true,
    'nextCheckpointIndex', v_run.last_checkpoint_index + 1,
    'totalCheckpoints', v_cp_count,
    'serverNow', pg_catalog.now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.abandon_game_mission(
  p_mission_id TEXT,
  p_run_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_player_id UUID := public.current_player_id();
  v_run public.player_mission_progress%ROWTYPE;
BEGIN
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated player profile required';
  END IF;

  IF p_mission_id IS NULL OR pg_catalog.btrim(p_mission_id) = '' OR p_run_token IS NULL THEN
    RAISE EXCEPTION 'Valid mission ID and run token are required to abandon a mission';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mission_player_' || v_player_id::TEXT));

  SELECT * INTO v_run
  FROM public.player_mission_progress
  WHERE player_id = v_player_id
    AND mission_id = p_mission_id
    AND run_token = p_run_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'abandoned', false,
      'reason', 'Mission run not found'
    );
  END IF;

  IF v_run.status <> 'in_progress' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'abandoned', false,
      'alreadyFinalized', true,
      'status', v_run.status,
      'failureReason', CASE WHEN v_run.status = 'failed' THEN v_run.failure_reason ELSE NULL END,
      'creditsAwarded', CASE WHEN v_run.status = 'completed' THEN v_run.credits_awarded ELSE 0 END,
      'xpAwarded', CASE WHEN v_run.status = 'completed' THEN v_run.xp_awarded ELSE 0 END,
      'rewardBadge', CASE WHEN v_run.status = 'completed' THEN v_run.reward_badge_awarded ELSE NULL END
    );
  END IF;

  UPDATE public.player_mission_progress
  SET
    status = 'abandoned',
    abandoned_at = pg_catalog.now(),
    completed_at = NULL,
    failure_reason = 'Abandoned by player',
    updated_at = pg_catalog.now()
  WHERE id = v_run.id;

  RETURN pg_catalog.jsonb_build_object('success', true, 'abandoned', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_game_mission(
  p_mission_id TEXT,
  p_run_token UUID,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_player_id UUID := public.current_player_id();
  v_run public.player_mission_progress%ROWTYPE;
  v_reason TEXT;
BEGIN
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated player profile required';
  END IF;

  IF p_mission_id IS NULL OR pg_catalog.btrim(p_mission_id) = '' OR p_run_token IS NULL THEN
    RAISE EXCEPTION 'Valid mission ID and run token are required to fail a mission';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mission_player_' || v_player_id::TEXT));

  SELECT * INTO v_run
  FROM public.player_mission_progress
  WHERE player_id = v_player_id
    AND mission_id = p_mission_id
    AND run_token = p_run_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'failed', false,
      'persisted', false,
      'reason', 'Mission run not found'
    );
  END IF;

  IF v_run.status = 'failed' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'failed', true,
      'persisted', true,
      'alreadyFinalized', true,
      'status', v_run.status,
      'failureReason', COALESCE(v_run.failure_reason, 'Mission failed'),
      'creditsAwarded', 0,
      'xpAwarded', 0
    );
  END IF;

  IF v_run.status <> 'in_progress' OR v_run.reward_claimed_at IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'failed', false,
      'persisted', false,
      'alreadyFinalized', true,
      'status', v_run.status,
      'creditsAwarded', CASE WHEN v_run.status = 'completed' THEN v_run.credits_awarded ELSE 0 END,
      'xpAwarded', CASE WHEN v_run.status = 'completed' THEN v_run.xp_awarded ELSE 0 END,
      'rewardBadge', CASE WHEN v_run.status = 'completed' THEN v_run.reward_badge_awarded ELSE NULL END,
      'reason', pg_catalog.format('Mission run is already finalized as %s', v_run.status)
    );
  END IF;

  v_reason := pg_catalog.left(
    pg_catalog.regexp_replace(
      COALESCE(pg_catalog.btrim(p_failure_reason), ''),
      '[\r\n\t]+',
      ' ',
      'g'
    ),
    240
  );
  IF v_reason = '' THEN
    v_reason := 'Mission failed';
  END IF;

  UPDATE public.player_mission_progress
  SET
    status = 'failed',
    completed_at = NULL,
    failure_reason = v_reason,
    checkpoint_reports_accepted = false,
    server_verified = false,
    updated_at = pg_catalog.now()
  WHERE id = v_run.id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'failed', true,
    'persisted', true,
    'status', 'failed',
    'failureReason', v_reason,
    'creditsAwarded', 0,
    'xpAwarded', 0
  );
END;
$$;

-- Legacy 4-argument overload (TEXT, UUID, BOOLEAN, JSONB) compatibility handling:
-- Do NOT blindly DROP FUNCTION IF EXISTS in case live objects/views/triggers reference it.
-- Instead, if that legacy insecure overload exists, REVOKE client EXECUTE rights from
-- PUBLIC, anon, and authenticated immediately so players cannot invoke it directly.
-- Eventual retirement procedure (after live pg_depend verification):
--   1. Check dependencies:
--        SELECT oid::regprocedure FROM pg_proc
--        WHERE pronamespace = 'public'::regnamespace AND proname = 'complete_game_mission';
--        SELECT * FROM pg_depend WHERE refobjid = 'public.complete_game_mission(text,uuid,boolean,jsonb)'::regprocedure;
--   2. Once zero dependencies and zero callers are confirmed, run manually:
--        DROP FUNCTION public.complete_game_mission(TEXT, UUID, BOOLEAN, JSONB);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'complete_game_mission'
      AND pg_catalog.oidvectortypes(p.proargtypes) = 'text, uuid, boolean, jsonb'
  ) THEN
    REVOKE ALL ON FUNCTION public.complete_game_mission(TEXT, UUID, BOOLEAN, JSONB)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.complete_game_mission(TEXT, UUID, BOOLEAN, JSONB)
      TO service_role;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.complete_game_mission(
  p_mission_id TEXT,
  p_run_token UUID,
  p_final_x DOUBLE PRECISION,
  p_final_z DOUBLE PRECISION,
  p_gear TEXT DEFAULT 'D1',
  p_collision_count INTEGER DEFAULT 0,
  p_finish_rank INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_player_id UUID := public.current_player_id();
  v_mission public.game_missions%ROWTYPE;
  v_run public.player_mission_progress%ROWTYPE;
  v_credits INTEGER := 0;
  v_xp INTEGER := 0;
  v_new_balance INTEGER;
  v_new_xp INTEGER;
  v_elapsed_sec DOUBLE PRECISION;
  v_min_elapsed_sec DOUBLE PRECISION;
  v_last_seg_elapsed DOUBLE PRECISION;
  v_last_seg_dist DOUBLE PRECISION;
  v_min_last_seg_sec DOUBLE PRECISION;
  v_required_checkpoints INTEGER;
  v_dist_to_dest DOUBLE PRECISION;
  v_collisions INTEGER := GREATEST(0, LEAST(1000, COALESCE(p_collision_count, 0)));
  v_rank INTEGER := CASE WHEN p_finish_rank IS NULL THEN NULL ELSE GREATEST(1, LEAST(4, p_finish_rank)) END;
  v_gear TEXT := pg_catalog.upper(pg_catalog.btrim(COALESCE(p_gear, '')));
  v_awarded_badge TEXT := NULL;
  v_fail_reason TEXT := NULL;
  v_telemetry JSONB;
  v_trusted_checks JSONB;
  v_client_claims JSONB;
BEGIN
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated player profile required';
  END IF;

  IF p_mission_id IS NULL OR pg_catalog.btrim(p_mission_id) = '' OR p_run_token IS NULL THEN
    RAISE EXCEPTION 'Valid mission ID and run token are required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mission_player_' || v_player_id::TEXT));

  -- Fetch and lock the player's run FIRST so already-completed runs can retry
  -- idempotently even if the mission definition was later deactivated or edited.
  SELECT * INTO v_run
  FROM public.player_mission_progress
  WHERE player_id = v_player_id
    AND mission_id = p_mission_id
    AND run_token = p_run_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission run record not found';
  END IF;

  IF v_run.status = 'completed' AND v_run.reward_claimed_at IS NOT NULL THEN
    -- Idempotent completion retry: return exact persisted payout & badge without double-crediting
    SELECT credits_balance, xp_balance INTO v_new_balance, v_new_xp
    FROM public.player_profiles
    WHERE id = v_player_id;

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'persisted', true,
      'alreadyFinalized', true,
      'checkpointReportsAccepted', v_run.checkpoint_reports_accepted,
      'serverVerified', false,
      'creditsAwarded', v_run.credits_awarded,
      'xpAwarded', v_run.xp_awarded,
      'creditsBalance', COALESCE(v_new_balance, 0),
      'xpBalance', COALESCE(v_new_xp, 0),
      'rewardBadge', v_run.reward_badge_awarded
    );
  END IF;

  IF v_run.reward_claimed_at IS NOT NULL OR v_run.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Mission run has already been finalized as %', v_run.status;
  END IF;

  -- Only active/unclaimed in_progress runs require the mission catalog entry to exist & be active
  SELECT * INTO v_mission FROM public.game_missions WHERE id = p_mission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  IF NOT v_mission.is_active THEN
    RAISE EXCEPTION 'Mission is no longer active';
  END IF;

  -- Record client-supplied driving/telemetry claims separately from server-checked metadata
  v_client_claims := pg_catalog.jsonb_build_object(
    'untrustedClientReported', true,
    'reportedGear', v_gear,
    'parkGearClaimed', (v_gear = 'P'),
    'reportedCollisions', v_collisions,
    'zeroCollisionClaimed', (v_collisions = 0),
    'reportedFinishRank', v_rank
  );

  -- 1. Enforce server deadline
  IF v_run.expires_at IS NOT NULL AND pg_catalog.now() > v_run.expires_at THEN
    v_fail_reason := 'Server time limit exceeded before destination arrival';
  END IF;

  -- 2. Enforce minimum physically plausible elapsed duration based on DB mission distance
  v_elapsed_sec := GREATEST(0.0, EXTRACT(EPOCH FROM (pg_catalog.now() - v_run.started_at)));
  v_min_elapsed_sec := GREATEST(2.5, (v_mission.distance_meters::DOUBLE PRECISION / 160.0));
  IF v_fail_reason IS NULL AND v_elapsed_sec < v_min_elapsed_sec THEN
    v_fail_reason := 'Completion elapsed duration below plausible minimum';
  END IF;

  -- 3. Enforce sequential accepted DB checkpoint reports
  v_required_checkpoints := COALESCE(pg_catalog.jsonb_array_length(v_mission.checkpoints), 0);
  IF v_fail_reason IS NULL AND v_run.last_checkpoint_index < v_required_checkpoints THEN
    v_fail_reason := pg_catalog.format(
      'Only %s of %s required checkpoints were recorded',
      v_run.last_checkpoint_index,
      v_required_checkpoints
    );
  END IF;

  -- 4. Enforce finite destination coordinates inside world bounds and DB radius (+8.0 unit network tolerance)
  IF p_final_x IS NULL OR p_final_z IS NULL
     OR p_final_x = 'NaN'::DOUBLE PRECISION OR p_final_z = 'NaN'::DOUBLE PRECISION
     OR p_final_x = 'Infinity'::DOUBLE PRECISION OR p_final_x = '-Infinity'::DOUBLE PRECISION
     OR p_final_z = 'Infinity'::DOUBLE PRECISION OR p_final_z = '-Infinity'::DOUBLE PRECISION
     OR pg_catalog.abs(p_final_x) > 5000.0 OR pg_catalog.abs(p_final_z) > 5000.0 THEN
    v_fail_reason := 'Valid finite arrival coordinates within world bounds are required';
  ELSE
    v_dist_to_dest := pg_catalog.sqrt(pg_catalog.power(p_final_x - v_mission.dest_x, 2) + pg_catalog.power(p_final_z - v_mission.dest_z, 2));
    IF v_fail_reason IS NULL AND v_dist_to_dest > (v_mission.dest_radius + 8.0) THEN
      v_fail_reason := pg_catalog.format(
        'Arrival coordinates (dist %.1fm) outside destination zone',
        v_dist_to_dest
      );
    END IF;

    IF v_fail_reason IS NULL THEN
      v_last_seg_dist := pg_catalog.sqrt(
        pg_catalog.power(v_mission.dest_x - COALESCE(v_run.last_reported_x, v_mission.start_x), 2)
        + pg_catalog.power(v_mission.dest_z - COALESCE(v_run.last_reported_z, v_mission.start_z), 2)
      );
      v_last_seg_elapsed := GREATEST(0.0, EXTRACT(EPOCH FROM (pg_catalog.now() - COALESCE(v_run.last_checkpoint_at, v_run.started_at))));
      v_min_last_seg_sec := GREATEST(0.0, (v_last_seg_dist - 30.0) / 160.0);
      IF v_last_seg_elapsed < v_min_last_seg_sec THEN
        v_fail_reason := 'Final leg elapsed time below plausible minimum';
      END IF;
    END IF;
  END IF;

  -- 5. Client self-reported rule rejections (can only fail a run; NEVER authoritative proof or bonus)
  IF v_fail_reason IS NULL AND v_mission.require_park_gear THEN
    IF v_gear IS DISTINCT FROM 'P' THEN
      v_fail_reason := 'Client telemetry did not report Park (P) gear inside destination zone';
    END IF;
  END IF;

  IF v_fail_reason IS NULL AND v_mission.requires_no_collision AND v_collisions > 0 THEN
    v_fail_reason := 'Client telemetry reported heavy collision on zero-impact mission';
  END IF;

  v_trusted_checks := pg_catalog.jsonb_build_object(
    'runTokenValid', true,
    'serverDeadlineValid', (v_run.expires_at IS NULL OR pg_catalog.now() <= v_run.expires_at),
    'minDurationPlausible', (v_elapsed_sec >= v_min_elapsed_sec),
    'checkpointReportsAccepted', (v_run.last_checkpoint_index >= v_required_checkpoints AND v_fail_reason IS NULL),
    'destinationCoordsAccepted', (v_fail_reason IS NULL),
    'serverPhysicsVerified', false
  );

  v_telemetry := pg_catalog.jsonb_build_object(
    'clientClaims', v_client_claims,
    'trustedChecks', v_trusted_checks,
    'serverPhysicsVerified', false
  );

  -- Reject payout and mark failed if any validation rule failed
  IF v_fail_reason IS NOT NULL THEN
    UPDATE public.player_mission_progress
    SET
      status = 'failed',
      completed_at = NULL,
      last_reported_x = CASE
        WHEN p_final_x IS NOT NULL AND pg_catalog.abs(p_final_x) <= 5000.0 THEN p_final_x
        ELSE last_reported_x
      END,
      last_reported_z = CASE
        WHEN p_final_z IS NOT NULL AND pg_catalog.abs(p_final_z) <= 5000.0 THEN p_final_z
        ELSE last_reported_z
      END,
      failure_reason = v_fail_reason,
      checkpoint_reports_accepted = false,
      server_verified = false,
      client_telemetry = v_telemetry,
      progress_data = pg_catalog.jsonb_build_object(
        'elapsedSeconds', pg_catalog.round(v_elapsed_sec::NUMERIC, 2),
        'checkpointsAccepted', v_run.last_checkpoint_index,
        'requiredCheckpoints', v_required_checkpoints
      ),
      updated_at = pg_catalog.now()
    WHERE id = v_run.id;

    SELECT credits_balance, xp_balance INTO v_new_balance, v_new_xp
    FROM public.player_profiles
    WHERE id = v_player_id;

    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'persisted', true,
      'checkpointReportsAccepted', false,
      'serverVerified', false,
      'creditsAwarded', 0,
      'xpAwarded', 0,
      'creditsBalance', COALESCE(v_new_balance, 0),
      'xpBalance', COALESCE(v_new_xp, 0),
      'rewardBadge', NULL,
      'trustedChecks', v_trusted_checks,
      'clientClaims', v_client_claims,
      'reason', v_fail_reason
    );
  END IF;

  -- Fixed participation rewards from authoritative DB mission definition.
  -- Telemetry-dependent exclusive badges (rank, zero-collision, park-gear) are NEVER awarded
  -- from untrusted client telemetry; MISSION_B_RACE awards the participation badge only.
  v_credits := v_mission.reward_credits;
  v_xp := v_mission.reward_xp;
  v_awarded_badge := CASE
    WHEN v_mission.id = 'MISSION_B_RACE' THEN
      CASE
        WHEN v_mission.reward_badge = 'Mainland Street Champion' OR v_mission.reward_badge IS NULL
          THEN 'Mainland Circuit Participant'
        ELSE v_mission.reward_badge
      END
    WHEN (v_mission.requires_no_collision OR v_mission.require_park_gear)
      AND v_mission.reward_badge IN ('Zero-Impact Chauffeur', 'Precision Parker')
      THEN NULL
    ELSE v_mission.reward_badge
  END;

  UPDATE public.player_mission_progress
  SET
    status = 'completed',
    completed_at = pg_catalog.now(),
    reward_claimed_at = pg_catalog.now(),
    credits_awarded = v_credits,
    xp_awarded = v_xp,
    reward_badge_awarded = v_awarded_badge,
    last_reported_x = p_final_x,
    last_reported_z = p_final_z,
    checkpoint_reports_accepted = true,
    server_verified = false,
    client_telemetry = v_telemetry,
    progress_data = pg_catalog.jsonb_build_object(
      'elapsedSeconds', pg_catalog.round(v_elapsed_sec::NUMERIC, 2),
      'distToDest', pg_catalog.round(v_dist_to_dest::NUMERIC, 2),
      'checkpointsAccepted', v_run.last_checkpoint_index,
      'requiredCheckpoints', v_required_checkpoints,
      'rewardModel', 'fixed_participation_db_reward',
      'verificationBoundary', 'checkpoint_reports_token_deadline_accepted_physics_client_simulated'
    ),
    updated_at = pg_catalog.now()
  WHERE id = v_run.id;

  UPDATE public.player_profiles
  SET
    credits_balance = credits_balance + v_credits,
    xp_balance = xp_balance + v_xp,
    missions_completed_count = missions_completed_count + 1,
    badges_earned = CASE
      WHEN v_awarded_badge IS NOT NULL AND NOT (badges_earned ? v_awarded_badge)
      THEN badges_earned || pg_catalog.jsonb_build_array(v_awarded_badge)
      ELSE badges_earned
    END,
    last_activity_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
  WHERE id = v_player_id
  RETURNING credits_balance, xp_balance INTO v_new_balance, v_new_xp;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'persisted', true,
    'checkpointReportsAccepted', true,
    'serverVerified', false,
    'creditsAwarded', v_credits,
    'xpAwarded', v_xp,
    'creditsBalance', COALESCE(v_new_balance, 0),
    'xpBalance', COALESCE(v_new_xp, 0),
    'rewardBadge', v_awarded_badge,
    'trustedChecks', v_trusted_checks,
    'clientClaims', v_client_claims
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_game_missions()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin authorization required';
  END IF;

  RETURN COALESCE(
    (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) ORDER BY m.sort_order ASC) FROM public.game_missions m),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_game_mission(
  p_mission_id TEXT,
  p_is_active BOOLEAN DEFAULT NULL,
  p_reward_credits INTEGER DEFAULT NULL,
  p_reward_xp INTEGER DEFAULT NULL,
  p_time_limit_seconds INTEGER DEFAULT NULL,
  p_cooldown_seconds INTEGER DEFAULT NULL,
  p_difficulty TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin authorization required';
  END IF;

  IF p_reward_credits IS NOT NULL AND p_reward_credits < 0 THEN
    RAISE EXCEPTION 'reward_credits must be >= 0';
  END IF;
  IF p_reward_xp IS NOT NULL AND p_reward_xp < 0 THEN
    RAISE EXCEPTION 'reward_xp must be >= 0';
  END IF;
  IF p_time_limit_seconds IS NOT NULL AND p_time_limit_seconds < 20 THEN
    RAISE EXCEPTION 'time_limit_seconds must be >= 20';
  END IF;
  IF p_cooldown_seconds IS NOT NULL AND p_cooldown_seconds < 0 THEN
    RAISE EXCEPTION 'cooldown_seconds must be >= 0';
  END IF;
  IF p_difficulty IS NOT NULL AND p_difficulty NOT IN ('Easy', 'Medium', 'Hard', 'Expert', 'Master') THEN
    RAISE EXCEPTION 'Invalid difficulty tier';
  END IF;

  UPDATE public.game_missions
  SET
    is_active = COALESCE(p_is_active, is_active),
    reward_credits = COALESCE(p_reward_credits, reward_credits),
    reward_xp = COALESCE(p_reward_xp, reward_xp),
    time_limit_seconds = COALESCE(p_time_limit_seconds, time_limit_seconds),
    cooldown_seconds = COALESCE(p_cooldown_seconds, cooldown_seconds),
    difficulty = COALESCE(p_difficulty, difficulty),
    updated_at = pg_catalog.now()
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  RETURN pg_catalog.jsonb_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. LEAST-PRIVILEGE GRANTS & FUNCTION EXECUTION PERMISSIONS
-- ------------------------------------------------------------------------------
REVOKE ALL ON public.dealer_advertising_plans FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.game_billboard_assignments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.game_missions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.player_mission_progress FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.dealer_advertising_plans TO authenticated;
GRANT SELECT ON public.game_billboard_assignments TO authenticated;
GRANT SELECT ON public.game_missions TO anon, authenticated;
GRANT SELECT ON public.player_mission_progress TO authenticated;

GRANT ALL ON public.dealer_advertising_plans TO service_role;
GRANT ALL ON public.game_billboard_assignments TO service_role;
GRANT ALL ON public.game_missions TO service_role;
GRANT ALL ON public.player_mission_progress TO service_role;

-- Trigger-only functions: revoke all client execute rights (must NEVER be directly callable via RPC)
REVOKE ALL ON FUNCTION public.enforce_game_billboard_constraints() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_car_status_to_billboards() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_car_dealer_to_billboards() FROM PUBLIC, anon, authenticated;

-- Public sanitized billboard catalog
REVOKE ALL ON FUNCTION public.get_active_game_billboards() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_game_billboards() TO anon, authenticated, service_role;

-- Authenticated dealer billboard RPCs
REVOKE ALL ON FUNCTION public.get_my_dealer_billboard_state() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_dealer_billboard_state() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.assign_vehicle_to_game_billboard(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_vehicle_to_game_billboard(TEXT, BOOLEAN) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.remove_my_game_billboard_slot(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_my_game_billboard_slot(UUID) TO authenticated, service_role;

-- Authenticated admin billboard RPCs (internally enforced via public.is_active_admin())
REVOKE ALL ON FUNCTION public.admin_get_billboard_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_billboard_overview() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_manage_billboard_assignment(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_billboard_assignment(UUID, TEXT, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_set_dealer_billboard_slots(TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_dealer_billboard_slots(TEXT, INTEGER, TEXT, TEXT) TO authenticated, service_role;

-- Authenticated player mission lifecycle RPCs
REVOKE ALL ON FUNCTION public.get_my_mission_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_mission_overview() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.start_game_mission(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_game_mission(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.report_game_mission_checkpoint(TEXT, UUID, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_game_mission_checkpoint(TEXT, UUID, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.abandon_game_mission(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abandon_game_mission(TEXT, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fail_game_mission(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_game_mission(TEXT, UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.complete_game_mission(TEXT, UUID, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_game_mission(TEXT, UUID, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, INTEGER) TO authenticated, service_role;

-- Authenticated admin mission RPCs (internally enforced via public.is_active_admin())
REVOKE ALL ON FUNCTION public.admin_list_game_missions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_game_missions() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_update_game_mission(TEXT, BOOLEAN, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_game_mission(TEXT, BOOLEAN, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9. FINAL DEPLOYMENT-READINESS SCHEMA & CONSTRAINT VERIFICATION GATE
-- ------------------------------------------------------------------------------
-- Guarantees the migration fails loudly if ANY required PK, FK, NOT NULL, CHECK,
-- unique index, or billboard trigger remains missing or invalid after upgrade.
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_idx_name TEXT;
  v_col TEXT;
BEGIN
  -- Essential Primary Keys
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.dealer_advertising_plans'::regclass AND contype = 'p') THEN
    v_missing := array_append(v_missing, 'PK missing on public.dealer_advertising_plans');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.game_billboard_assignments'::regclass AND contype = 'p') THEN
    v_missing := array_append(v_missing, 'PK missing on public.game_billboard_assignments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.game_missions'::regclass AND contype = 'p') THEN
    v_missing := array_append(v_missing, 'PK missing on public.game_missions');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.player_mission_progress'::regclass AND contype = 'p') THEN
    v_missing := array_append(v_missing, 'PK missing on public.player_mission_progress');
  END IF;

  -- Essential Foreign Keys
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.dealer_advertising_plans'::regclass AND contype = 'f' AND confrelid = 'public.dealers'::regclass) THEN
    v_missing := array_append(v_missing, 'FK dealer_advertising_plans.dealer_id -> public.dealers');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.dealer_advertising_plans'::regclass AND contype = 'f' AND confrelid = 'auth.users'::regclass) THEN
    v_missing := array_append(v_missing, 'FK dealer_advertising_plans.updated_by -> auth.users');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.game_billboard_assignments'::regclass AND contype = 'f' AND confrelid = 'public.dealers'::regclass) THEN
    v_missing := array_append(v_missing, 'FK game_billboard_assignments.dealer_id -> public.dealers');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.game_billboard_assignments'::regclass AND contype = 'f' AND confrelid = 'public.cars'::regclass) THEN
    v_missing := array_append(v_missing, 'FK game_billboard_assignments.vehicle_listing_id -> public.cars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.game_billboard_assignments'::regclass AND contype = 'f' AND confrelid = 'auth.users'::regclass) THEN
    v_missing := array_append(v_missing, 'FK game_billboard_assignments.created_by -> auth.users');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.player_mission_progress'::regclass AND contype = 'f' AND confrelid = 'public.player_profiles'::regclass) THEN
    v_missing := array_append(v_missing, 'FK player_mission_progress.player_id -> public.player_profiles');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.player_mission_progress'::regclass AND contype = 'f' AND confrelid = 'public.game_missions'::regclass) THEN
    v_missing := array_append(v_missing, 'FK player_mission_progress.mission_id -> public.game_missions');
  END IF;

  -- Essential Unique Indexes (active billboard slot, unique run_token, single in_progress run per player)
  FOREACH v_idx_name IN ARRAY ARRAY[
    'idx_billboard_unique_active_vehicle',
    'idx_player_mission_unique_run_token',
    'idx_player_mission_single_in_progress'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index i
      JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = v_idx_name
        AND i.indisunique
        AND i.indisvalid
    ) THEN
      v_missing := array_append(v_missing, 'Valid unique index missing: ' || v_idx_name);
    END IF;
  END LOOP;

  -- Essential NOT NULL checks across all 4 expansion tables
  FOREACH v_col IN ARRAY ARRAY['dealer_id', 'plan_code', 'max_active_slots', 'created_at', 'updated_at'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = 'public.dealer_advertising_plans'::regclass
        AND a.attname = v_col AND NOT a.attisdropped AND a.attnotnull
    ) THEN
      v_missing := array_append(v_missing, 'NOT NULL missing on dealer_advertising_plans.' || v_col);
    END IF;
  END LOOP;

  FOREACH v_col IN ARRAY ARRAY['id', 'dealer_id', 'vehicle_listing_id', 'status', 'display_order', 'starts_at', 'created_at', 'updated_at'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = 'public.game_billboard_assignments'::regclass
        AND a.attname = v_col AND NOT a.attisdropped AND a.attnotnull
    ) THEN
      v_missing := array_append(v_missing, 'NOT NULL missing on game_billboard_assignments.' || v_col);
    END IF;
  END LOOP;

  FOREACH v_col IN ARRAY ARRAY[
    'id', 'title', 'subtitle', 'description', 'mission_category', 'distance_category',
    'start_location_name', 'start_x', 'start_z', 'destination_name', 'dest_x', 'dest_z',
    'dest_radius', 'checkpoints', 'distance_meters', 'estimated_minutes', 'reward_credits',
    'reward_xp', 'time_limit_seconds', 'difficulty', 'cooldown_seconds',
    'requires_no_collision', 'require_park_gear', 'is_active', 'sort_order',
    'created_at', 'updated_at'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = 'public.game_missions'::regclass
        AND a.attname = v_col AND NOT a.attisdropped AND a.attnotnull
    ) THEN
      v_missing := array_append(v_missing, 'NOT NULL missing on game_missions.' || v_col);
    END IF;
  END LOOP;

  FOREACH v_col IN ARRAY ARRAY[
    'id', 'player_id', 'mission_id', 'run_token', 'status', 'started_at',
    'credits_awarded', 'xp_awarded', 'checkpoints_reached', 'last_checkpoint_index',
    'checkpoint_reports_accepted', 'server_verified', 'client_telemetry', 'progress_data',
    'created_at', 'updated_at'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = 'public.player_mission_progress'::regclass
        AND a.attname = v_col AND NOT a.attisdropped AND a.attnotnull
    ) THEN
      v_missing := array_append(v_missing, 'NOT NULL missing on player_mission_progress.' || v_col);
    END IF;
  END LOOP;

  -- Essential CHECK constraints across all 4 expansion tables
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.dealer_advertising_plans'::regclass AND c.contype = 'c'
      AND (c.conname = 'chk_dealer_advertising_plans_max_active_slots' OR (pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%max_active_slots >= 1%' AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%max_active_slots <= 25%'))
  ) THEN
    v_missing := array_append(v_missing, 'CHECK missing: dealer_advertising_plans.max_active_slots [1..25]');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.game_billboard_assignments'::regclass AND c.contype = 'c'
      AND (c.conname = 'chk_game_billboard_assignments_status' OR (pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''active''%' AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''expired''%'))
  ) THEN
    v_missing := array_append(v_missing, 'CHECK missing: game_billboard_assignments.status');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.game_missions'::regclass AND c.contype = 'c'
      AND (c.conname = 'chk_game_missions_mission_category' OR (pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''DELIVERY''%' AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''ENDURANCE''%'))
  ) THEN
    v_missing := array_append(v_missing, 'CHECK missing: game_missions.mission_category');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.game_missions'::regclass AND c.contype = 'c'
      AND (c.conname = 'chk_game_missions_distance_category' OR (pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''NEAR''%' AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''VERY_FAR''%'))
  ) THEN
    v_missing := array_append(v_missing, 'CHECK missing: game_missions.distance_category');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.game_missions'::regclass AND c.contype = 'c'
      AND (c.conname = 'chk_game_missions_reward_credits' OR pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%reward_credits >= 0%')
  ) THEN
    v_missing := array_append(v_missing, 'CHECK missing: game_missions.reward_credits >= 0');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.game_missions'::regclass AND c.contype = 'c'
      AND (c.conname = 'chk_game_missions_reward_xp' OR pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%reward_xp >= 0%')
  ) THEN
    v_missing := array_append(v_missing, 'CHECK missing: game_missions.reward_xp >= 0');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.game_missions'::regclass AND c.contype = 'c'
      AND (c.conname = 'chk_game_missions_time_limit_seconds' OR pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%time_limit_seconds >= 20%')
  ) THEN
    v_missing := array_append(v_missing, 'CHECK missing: game_missions.time_limit_seconds >= 20');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.game_missions'::regclass AND c.contype = 'c'
      AND (c.conname = 'chk_game_missions_difficulty' OR (pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''Easy''%' AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''Master''%'))
  ) THEN
    v_missing := array_append(v_missing, 'CHECK missing: game_missions.difficulty');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.game_missions'::regclass AND c.contype = 'c'
      AND (c.conname = 'chk_game_missions_cooldown_seconds' OR pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%cooldown_seconds >= 0%')
  ) THEN
    v_missing := array_append(v_missing, 'CHECK missing: game_missions.cooldown_seconds >= 0');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid = 'public.player_mission_progress'::regclass AND c.contype = 'c'
      AND (c.conname = 'chk_player_mission_progress_status' OR (pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''in_progress''%' AND pg_catalog.pg_get_constraintdef(c.oid) ILIKE '%''abandoned''%'))
  ) THEN
    v_missing := array_append(v_missing, 'CHECK missing: player_mission_progress.status');
  END IF;

  -- Essential triggers on cars & game_billboard_assignments
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgname = 'trg_enforce_game_billboard_constraints' AND NOT tgisinternal) THEN
    v_missing := array_append(v_missing, 'Trigger missing: trg_enforce_game_billboard_constraints');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgname = 'trg_sync_car_status_to_billboards' AND NOT tgisinternal) THEN
    v_missing := array_append(v_missing, 'Trigger missing: trg_sync_car_status_to_billboards');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgname = 'trg_sync_car_dealer_to_billboards' AND NOT tgisinternal) THEN
    v_missing := array_append(v_missing, 'Trigger missing: trg_sync_car_dealer_to_billboards');
  END IF;

  IF pg_catalog.array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION E'DEPLOYMENT BLOCKER: Post-migration invariant verification failed:\n  - %',
      pg_catalog.array_to_string(v_missing, E'\n  - ');
  END IF;
END $$;


