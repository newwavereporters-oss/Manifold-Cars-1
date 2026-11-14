-- ==============================================================================
-- MANIFOLD CARS 3D — GAME EXPANSION MIGRATION (TRANSMISSION, MISSIONS, BILLBOARDS)
-- ==============================================================================
-- Additive, idempotent, non-destructive PostgreSQL migration for Supabase.
-- Preserves all existing marketplace, dealer, cars, admin_users, player_profiles,
-- and moderation schemas and RLS policies.
--
-- IMPORTANT NOTES ON EXISTING SCHEMA COMPATIBILITY:
--   * public.dealers.id is TEXT
--   * public.cars.id is TEXT
--   * public.player_profiles.id is UUID
--   * public.is_active_admin() and public.is_active_dealer() and public.current_dealer_id()
--     and public.current_player_id() already exist and are reused directly.
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
  dealer_id TEXT PRIMARY KEY REFERENCES public.dealers(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL DEFAULT 'standard',
  max_active_slots INTEGER NOT NULL DEFAULT 1 CHECK (max_active_slots >= 1 AND max_active_slots <= 25),
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. GAME WORLD DEALER BILLBOARD ASSIGNMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_billboard_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id TEXT NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  vehicle_listing_id TEXT NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'removed', 'expired')),
  display_order INTEGER NOT NULL DEFAULT 100,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billboard_assignments_dealer_status
  ON public.game_billboard_assignments (dealer_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_billboard_assignments_active_order
  ON public.game_billboard_assignments (status, display_order ASC, updated_at DESC);

-- Prevent the exact same vehicle from holding multiple simultaneous active slots
CREATE UNIQUE INDEX IF NOT EXISTS idx_billboard_unique_active_vehicle
  ON public.game_billboard_assignments (vehicle_listing_id)
  WHERE status = 'active';

-- Enforce ownership, published status, and per-dealer slot quota at database level
CREATE OR REPLACE FUNCTION public.enforce_game_billboard_constraints()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_car_dealer TEXT;
  v_car_status TEXT;
  v_max_slots INTEGER;
  v_active_count INTEGER;
BEGIN
  -- Serialize concurrent billboard writes per dealer to prevent slot race conditions
  PERFORM pg_advisory_xact_lock(hashtext('billboard_dealer_' || NEW.dealer_id));

  SELECT dealer_id, status INTO v_car_dealer, v_car_status
  FROM public.cars
  WHERE id = NEW.vehicle_listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced vehicle listing does not exist';
  END IF;

  IF v_car_dealer IS DISTINCT FROM NEW.dealer_id THEN
    RAISE EXCEPTION 'Security violation: vehicle listing does not belong to this dealer';
  END IF;

  IF NEW.status = 'active' THEN
    IF v_car_status IS DISTINCT FROM 'PUBLISHED' THEN
      RAISE EXCEPTION 'Only PUBLISHED marketplace listings may hold an active game billboard slot';
    END IF;

    SELECT COALESCE(
      (SELECT max_active_slots FROM public.dealer_advertising_plans WHERE dealer_id = NEW.dealer_id),
      1
    ) INTO v_max_slots;

    SELECT COUNT(*)::INTEGER INTO v_active_count
    FROM public.game_billboard_assignments
    WHERE dealer_id = NEW.dealer_id
      AND status = 'active'
      AND id IS DISTINCT FROM NEW.id;

    IF v_active_count >= v_max_slots THEN
      RAISE EXCEPTION 'BILLBOARD_SLOT_LIMIT_REACHED: Dealer is limited to % active billboard slot(s)', v_max_slots;
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_game_billboard_constraints ON public.game_billboard_assignments;
CREATE TRIGGER trg_enforce_game_billboard_constraints
  BEFORE INSERT OR UPDATE ON public.game_billboard_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_game_billboard_constraints();

-- Auto-pause billboard slots if underlying marketplace listing stops being PUBLISHED
CREATE OR REPLACE FUNCTION public.sync_car_status_to_billboards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'PUBLISHED' AND OLD.status = 'PUBLISHED' THEN
    UPDATE public.game_billboard_assignments
    SET status = 'paused', updated_at = NOW()
    WHERE vehicle_listing_id = NEW.id
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

-- ------------------------------------------------------------------------------
-- 4. GAME MISSIONS CATALOG & PLAYER PROGRESS
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

CREATE INDEX IF NOT EXISTS idx_game_missions_active_category
  ON public.game_missions (is_active, distance_category, sort_order ASC);

CREATE TABLE IF NOT EXISTS public.player_mission_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL REFERENCES public.game_missions(id) ON DELETE CASCADE,
  run_token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed', 'abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  reward_claimed_at TIMESTAMPTZ,
  credits_awarded INTEGER NOT NULL DEFAULT 0,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  progress_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_mission_progress_player_mission
  ON public.player_mission_progress (player_id, mission_id, completed_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_mission_unique_run_token
  ON public.player_mission_progress (run_token);

-- Seed 12 verified Lagos missions across NEAR, FAR, VERY_FAR (idempotent)
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
    '[]'::jsonb, 260, 1, 420, 140, 'Precision Parker', 70,
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
    '[]'::jsonb, 780, 2, 1000, 300, 'Mainland Street Champion', 180,
    'Medium', 90, false, false, true, 50
  ),
  (
    'FAR_IKOYI_CLEAN_TRANSFER',
    'Bourdillon Diplomatic Escort',
    'Zero-Collision Executive Run',
    'Transport diplomatic guests via Adekunle Interchange straight to Bourdillon Towers in Ikoyi. Any heavy collision fails the mission.',
    'PASSENGER', 'FAR',
    'Showroom Esplanade', 0, 10,
    'Ikoyi Bourdillon Towers', 365, -130, 16,
    '[{"x":160,"z":-130,"radius":16,"name":"Adekunle Interchange"}]'::jsonb, 1050, 3, 1200, 340, 'Zero-Impact Chauffeur', 135,
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

-- ------------------------------------------------------------------------------
-- 5. ENABLE ROW LEVEL SECURITY & ACCESS POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.dealer_advertising_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_billboard_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_mission_progress ENABLE ROW LEVEL SECURITY;

-- dealer_advertising_plans: dealer reads own plan; admin manages all
DROP POLICY IF EXISTS "Dealer reads own advertising plan" ON public.dealer_advertising_plans;
CREATE POLICY "Dealer reads own advertising plan" ON public.dealer_advertising_plans
  FOR SELECT USING (
    dealer_id = public.current_dealer_id()
    OR public.is_active_admin()
  );

DROP POLICY IF EXISTS "Admin manages dealer advertising plans" ON public.dealer_advertising_plans;
CREATE POLICY "Admin manages dealer advertising plans" ON public.dealer_advertising_plans
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- game_billboard_assignments: dealer reads/manages own rows (trigger enforces 1-slot quota); admin manages all; public uses get_active_game_billboards() RPC
DROP POLICY IF EXISTS "Dealer reads own billboard assignments" ON public.game_billboard_assignments;
CREATE POLICY "Dealer reads own billboard assignments" ON public.game_billboard_assignments
  FOR SELECT USING (
    dealer_id = public.current_dealer_id()
    OR public.is_active_admin()
  );

DROP POLICY IF EXISTS "Admin manages all billboard assignments" ON public.game_billboard_assignments;
CREATE POLICY "Admin manages all billboard assignments" ON public.game_billboard_assignments
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- game_missions: public/authenticated reads active missions; admin manages catalog
DROP POLICY IF EXISTS "Everyone reads active game missions" ON public.game_missions;
CREATE POLICY "Everyone reads active game missions" ON public.game_missions
  FOR SELECT USING (is_active = true OR public.is_active_admin());

DROP POLICY IF EXISTS "Admin manages game missions" ON public.game_missions;
CREATE POLICY "Admin manages game missions" ON public.game_missions
  FOR ALL USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- player_mission_progress: owning player reads own progress; admin reads all; mutations happen via SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "Player reads own mission progress" ON public.player_mission_progress;
CREATE POLICY "Player reads own mission progress" ON public.player_mission_progress
  FOR SELECT USING (
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
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    jsonb_agg(row_obj ORDER BY display_order ASC, updated_at DESC),
    '[]'::jsonb
  )
  FROM (
    SELECT
      gba.display_order,
      gba.updated_at,
      jsonb_build_object(
        'assignmentId', gba.id,
        'vehicleId', c.id,
        'slug', c.slug,
        'title', c.title,
        'year', c.year,
        'price', c.price,
        'previousPrice', c.previous_price,
        'originalPrice', COALESCE(c.original_price, c.previous_price),
        'description', LEFT(COALESCE(c.description, ''), 140),
        'imageUrl', COALESCE(NULLIF(c.gallery_image_1_url, ''), NULLIF(c.youtube_thumbnail_url, ''), ''),
        'location', c.location,
        'transmission', c.transmission,
        'condition', c.condition,
        'dealerId', d.id,
        'dealerName', d.name,
        'dealerCity', d.city,
        'displayOrder', gba.display_order
      ) AS row_obj
    FROM public.game_billboard_assignments gba
    JOIN public.cars c ON c.id = gba.vehicle_listing_id
    JOIN public.dealers d ON d.id = gba.dealer_id
    WHERE gba.status = 'active'
      AND c.status = 'PUBLISHED'
      AND (gba.starts_at IS NULL OR gba.starts_at <= NOW())
      AND (gba.ends_at IS NULL OR gba.ends_at > NOW())
  ) sub;
$$;

CREATE OR REPLACE FUNCTION public.get_my_dealer_billboard_state()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_dealer_id TEXT := public.current_dealer_id();
  v_max_slots INTEGER := 1;
  v_plan_code TEXT := 'standard';
  v_assignments JSONB := '[]'::jsonb;
  v_active_count INTEGER := 0;
BEGIN
  IF v_dealer_id IS NULL THEN
    RAISE EXCEPTION 'Active dealer account required';
  END IF;

  SELECT
    COALESCE(plan_code, 'standard'),
    COALESCE(max_active_slots, 1)
  INTO v_plan_code, v_max_slots
  FROM public.dealer_advertising_plans
  WHERE dealer_id = v_dealer_id;

  IF NOT FOUND THEN
    v_plan_code := 'standard';
    v_max_slots := 1;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_active_count
  FROM public.game_billboard_assignments
  WHERE dealer_id = v_dealer_id AND status = 'active';

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', gba.id,
      'dealerId', gba.dealer_id,
      'vehicleListingId', gba.vehicle_listing_id,
      'status', gba.status,
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
      'vehicleOriginalPrice', c.original_price,
      'vehicleStatus', c.status,
      'vehicleImageUrl', COALESCE(NULLIF(c.gallery_image_1_url, ''), NULLIF(c.youtube_thumbnail_url, ''), '')
    ) ORDER BY (gba.status = 'active') DESC, gba.updated_at DESC
  ), '[]'::jsonb)
  INTO v_assignments
  FROM public.game_billboard_assignments gba
  JOIN public.cars c ON c.id = gba.vehicle_listing_id
  WHERE gba.dealer_id = v_dealer_id
    AND gba.status IN ('active', 'paused');

  RETURN jsonb_build_object(
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
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_dealer_id TEXT := public.current_dealer_id();
  v_car public.cars%ROWTYPE;
  v_max_slots INTEGER := 1;
  v_active_count INTEGER := 0;
  v_existing_active RECORD;
  v_new_id UUID;
BEGIN
  IF v_uid IS NULL OR v_dealer_id IS NULL OR NOT public.is_active_dealer() THEN
    RAISE EXCEPTION 'Active dealer authorization required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('billboard_dealer_' || v_dealer_id));

  SELECT * INTO v_car FROM public.cars WHERE id = p_vehicle_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle listing not found';
  END IF;

  IF v_car.dealer_id IS DISTINCT FROM v_dealer_id THEN
    RAISE EXCEPTION 'You can only assign vehicles belonging to your own dealership';
  END IF;

  IF v_car.status IS DISTINCT FROM 'PUBLISHED' THEN
    RAISE EXCEPTION 'Vehicle must be PUBLISHED on the marketplace before assigning to the game billboard';
  END IF;

  SELECT COALESCE(
    (SELECT max_active_slots FROM public.dealer_advertising_plans WHERE dealer_id = v_dealer_id),
    1
  ) INTO v_max_slots;

  -- If already active on billboard, return cleanly
  SELECT id INTO v_existing_active
  FROM public.game_billboard_assignments
  WHERE dealer_id = v_dealer_id
    AND vehicle_listing_id = p_vehicle_id
    AND status = 'active'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'assignmentId', v_existing_active.id, 'alreadyActive', true);
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_active_count
  FROM public.game_billboard_assignments
  WHERE dealer_id = v_dealer_id AND status = 'active';

  IF v_active_count >= v_max_slots THEN
    IF NOT p_replace_existing THEN
      RAISE EXCEPTION 'BILLBOARD_SLOT_LIMIT_REACHED: You already have % of % active billboard slot(s) occupied. Replace an existing slot or contact Admin on WhatsApp (08169664607) to upgrade.', v_active_count, v_max_slots;
    END IF;

    -- Replace the oldest active assignment cleanly
    UPDATE public.game_billboard_assignments
    SET status = 'removed', updated_at = NOW()
    WHERE id = (
      SELECT id FROM public.game_billboard_assignments
      WHERE dealer_id = v_dealer_id AND status = 'active'
      ORDER BY updated_at ASC
      LIMIT 1
    );
  END IF;

  INSERT INTO public.game_billboard_assignments (
    dealer_id, vehicle_listing_id, status, display_order, created_by
  ) VALUES (
    v_dealer_id, p_vehicle_id, 'active', 100, v_uid
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'assignmentId', v_new_id, 'alreadyActive', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_my_game_billboard_slot(
  p_assignment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_dealer_id TEXT := public.current_dealer_id();
BEGIN
  IF v_dealer_id IS NULL OR NOT public.is_active_dealer() THEN
    RAISE EXCEPTION 'Active dealer authorization required';
  END IF;

  UPDATE public.game_billboard_assignments
  SET status = 'removed', updated_at = NOW()
  WHERE id = p_assignment_id
    AND dealer_id = v_dealer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billboard assignment not found for your dealership';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_billboard_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_assignments JSONB;
  v_dealers JSONB;
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin authorization required';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', gba.id,
      'dealerId', gba.dealer_id,
      'dealerName', d.name,
      'dealerCity', d.city,
      'vehicleListingId', gba.vehicle_listing_id,
      'vehicleTitle', c.title,
      'vehicleYear', c.year,
      'vehicleSlug', c.slug,
      'vehiclePrice', c.price,
      'vehiclePreviousPrice', c.previous_price,
      'vehicleStatus', c.status,
      'vehicleImageUrl', COALESCE(NULLIF(c.gallery_image_1_url, ''), NULLIF(c.youtube_thumbnail_url, ''), ''),
      'status', gba.status,
      'displayOrder', gba.display_order,
      'createdAt', gba.created_at,
      'updatedAt', gba.updated_at
    ) ORDER BY (gba.status = 'active') DESC, gba.display_order ASC, gba.updated_at DESC
  ), '[]'::jsonb)
  INTO v_assignments
  FROM public.game_billboard_assignments gba
  JOIN public.dealers d ON d.id = gba.dealer_id
  JOIN public.cars c ON c.id = gba.vehicle_listing_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'dealerId', d.id,
      'dealerName', d.name,
      'dealerCity', d.city,
      'planCode', COALESCE(dap.plan_code, 'standard'),
      'maxActiveSlots', COALESCE(dap.max_active_slots, 1),
      'activeSlotsUsed', (
        SELECT COUNT(*)::INTEGER FROM public.game_billboard_assignments x
        WHERE x.dealer_id = d.id AND x.status = 'active'
      ),
      'notes', dap.notes
    ) ORDER BY d.name ASC
  ), '[]'::jsonb)
  INTO v_dealers
  FROM public.dealers d
  LEFT JOIN public.dealer_advertising_plans dap ON dap.dealer_id = d.id;

  RETURN jsonb_build_object('assignments', v_assignments, 'dealers', v_dealers);
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
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin authorization required';
  END IF;

  IF p_status NOT IN ('active', 'paused', 'removed', 'expired') THEN
    RAISE EXCEPTION 'Invalid billboard status';
  END IF;

  UPDATE public.game_billboard_assignments
  SET
    status = p_status,
    display_order = COALESCE(p_display_order, display_order),
    updated_at = NOW()
  WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billboard assignment not found';
  END IF;

  RETURN jsonb_build_object('success', true);
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
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin authorization required';
  END IF;

  IF p_max_slots < 1 OR p_max_slots > 25 THEN
    RAISE EXCEPTION 'max_active_slots must be between 1 and 25';
  END IF;

  INSERT INTO public.dealer_advertising_plans (
    dealer_id, plan_code, max_active_slots, notes, updated_by, updated_at
  ) VALUES (
    p_dealer_id,
    COALESCE(NULLIF(BTRIM(p_plan_code), ''), CASE WHEN p_max_slots > 1 THEN 'featured_pro' ELSE 'standard' END),
    p_max_slots,
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    auth.uid(),
    NOW()
  )
  ON CONFLICT (dealer_id) DO UPDATE SET
    plan_code = COALESCE(NULLIF(BTRIM(p_plan_code), ''), CASE WHEN p_max_slots > 1 THEN 'featured_pro' ELSE 'standard' END),
    max_active_slots = p_max_slots,
    notes = COALESCE(NULLIF(BTRIM(COALESCE(p_notes, '')), ''), dealer_advertising_plans.notes),
    updated_by = auth.uid(),
    updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'dealerId', p_dealer_id, 'maxActiveSlots', p_max_slots);
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. MISSION LIFECYCLE RPCs (DUPLICATE-CLAIM PROTECTION & COOLDOWN ENFORCEMENT)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_mission_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_player_id UUID := public.current_player_id();
  v_missions JSONB;
  v_progress JSONB := '{}'::jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.sort_order ASC), '[]'::jsonb)
  INTO v_missions
  FROM public.game_missions m
  WHERE m.is_active = true;

  IF v_player_id IS NOT NULL THEN
    SELECT COALESCE(
      jsonb_object_agg(mission_id, stat_obj),
      '{}'::jsonb
    )
    INTO v_progress
    FROM (
      SELECT
        pmp.mission_id,
        jsonb_build_object(
          'completedCount', COUNT(*) FILTER (WHERE pmp.status = 'completed'),
          'lastCompletedAt', MAX(pmp.completed_at) FILTER (WHERE pmp.status = 'completed'),
          'lastRewardClaimedAt', MAX(pmp.reward_claimed_at) FILTER (WHERE pmp.status = 'completed'),
          'totalCreditsEarned', COALESCE(SUM(pmp.credits_awarded), 0)
        ) AS stat_obj
      FROM public.player_mission_progress pmp
      WHERE pmp.player_id = v_player_id
      GROUP BY pmp.mission_id
    ) s;
  END IF;

  RETURN jsonb_build_object(
    'missions', v_missions,
    'progress', v_progress,
    'serverNow', NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.start_game_mission(p_mission_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_player_id UUID := public.current_player_id();
  v_mission public.game_missions%ROWTYPE;
  v_last_claim TIMESTAMPTZ;
  v_wait_sec INTEGER;
  v_run_token UUID;
BEGIN
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated player profile required';
  END IF;

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

    IF v_last_claim IS NOT NULL AND v_last_claim + make_interval(secs => v_mission.cooldown_seconds) > NOW() THEN
      v_wait_sec := CEIL(EXTRACT(EPOCH FROM ((v_last_claim + make_interval(secs => v_mission.cooldown_seconds)) - NOW())))::INTEGER;
      RAISE EXCEPTION 'Mission cooldown active (% seconds remaining)', v_wait_sec;
    END IF;
  END IF;

  -- Mark any stale open runs as abandoned
  UPDATE public.player_mission_progress
  SET status = 'abandoned', updated_at = NOW()
  WHERE player_id = v_player_id AND status = 'in_progress';

  INSERT INTO public.player_mission_progress (
    player_id, mission_id, status, started_at
  ) VALUES (
    v_player_id, p_mission_id, 'in_progress', NOW()
  )
  RETURNING run_token INTO v_run_token;

  RETURN jsonb_build_object('success', true, 'runToken', v_run_token, 'serverNow', NOW());
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_game_mission(
  p_mission_id TEXT,
  p_run_token UUID,
  p_success BOOLEAN,
  p_run_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_player_id UUID := public.current_player_id();
  v_mission public.game_missions%ROWTYPE;
  v_run public.player_mission_progress%ROWTYPE;
  v_credits INTEGER := 0;
  v_xp INTEGER := 0;
  v_integrity NUMERIC;
  v_rank INTEGER;
  v_new_balance INTEGER;
  v_new_xp INTEGER;
BEGIN
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated player profile required';
  END IF;

  SELECT * INTO v_mission FROM public.game_missions WHERE id = p_mission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
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

  IF v_run.reward_claimed_at IS NOT NULL OR v_run.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Mission run has already been finalized';
  END IF;

  IF p_success THEN
    v_credits := v_mission.reward_credits;
    v_xp := v_mission.reward_xp;

    IF v_mission.mission_category = 'DELIVERY' AND (p_run_data ? 'cargoIntegrityPercent') THEN
      v_integrity := GREATEST(10, LEAST(100, (p_run_data->>'cargoIntegrityPercent')::NUMERIC));
      v_credits := ROUND(v_mission.reward_credits * (v_integrity / 100.0))::INTEGER;
    ELSIF v_mission.mission_category = 'STREET_RACE' AND (p_run_data ? 'rank') THEN
      v_rank := GREATEST(1, LEAST(4, (p_run_data->>'rank')::INTEGER));
      IF v_rank = 2 THEN
        v_credits := ROUND(v_mission.reward_credits * 0.6)::INTEGER;
        v_xp := ROUND(v_mission.reward_xp * 0.6)::INTEGER;
      ELSIF v_rank = 3 THEN
        v_credits := ROUND(v_mission.reward_credits * 0.3)::INTEGER;
        v_xp := ROUND(v_mission.reward_xp * 0.35)::INTEGER;
      ELSIF v_rank >= 4 THEN
        v_credits := ROUND(v_mission.reward_credits * 0.1)::INTEGER;
        v_xp := ROUND(v_mission.reward_xp * 0.15)::INTEGER;
      END IF;
    END IF;

    UPDATE public.player_mission_progress
    SET
      status = 'completed',
      completed_at = NOW(),
      reward_claimed_at = NOW(),
      credits_awarded = v_credits,
      xp_awarded = v_xp,
      progress_data = COALESCE(p_run_data, '{}'::jsonb),
      updated_at = NOW()
    WHERE id = v_run.id;

    UPDATE public.player_profiles
    SET
      credits_balance = credits_balance + v_credits,
      xp_balance = xp_balance + v_xp,
      missions_completed_count = missions_completed_count + 1,
      badges_earned = CASE
        WHEN v_mission.reward_badge IS NOT NULL AND NOT (badges_earned ? v_mission.reward_badge)
        THEN badges_earned || jsonb_build_array(v_mission.reward_badge)
        ELSE badges_earned
      END,
      last_activity_at = NOW(),
      updated_at = NOW()
    WHERE id = v_player_id
    RETURNING credits_balance, xp_balance INTO v_new_balance, v_new_xp;
  ELSE
    UPDATE public.player_mission_progress
    SET
      status = 'failed',
      completed_at = NOW(),
      progress_data = COALESCE(p_run_data, '{}'::jsonb),
      updated_at = NOW()
    WHERE id = v_run.id;

    SELECT credits_balance, xp_balance INTO v_new_balance, v_new_xp
    FROM public.player_profiles
    WHERE id = v_player_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'creditsAwarded', v_credits,
    'xpAwarded', v_xp,
    'creditsBalance', COALESCE(v_new_balance, 0),
    'xpBalance', COALESCE(v_new_xp, 0),
    'rewardBadge', CASE WHEN p_success THEN v_mission.reward_badge ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_game_missions()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin authorization required';
  END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.sort_order ASC) FROM public.game_missions m),
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
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_active_admin() THEN
    RAISE EXCEPTION 'Admin authorization required';
  END IF;

  UPDATE public.game_missions
  SET
    is_active = COALESCE(p_is_active, is_active),
    reward_credits = COALESCE(p_reward_credits, reward_credits),
    reward_xp = COALESCE(p_reward_xp, reward_xp),
    time_limit_seconds = COALESCE(p_time_limit_seconds, time_limit_seconds),
    cooldown_seconds = COALESCE(p_cooldown_seconds, cooldown_seconds),
    difficulty = COALESCE(p_difficulty, difficulty),
    updated_at = NOW()
  WHERE id = p_mission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. GRANTS & EXECUTION PERMISSIONS
-- ------------------------------------------------------------------------------
REVOKE ALL ON public.dealer_advertising_plans FROM PUBLIC;
REVOKE ALL ON public.game_billboard_assignments FROM PUBLIC;
REVOKE ALL ON public.game_missions FROM PUBLIC;
REVOKE ALL ON public.player_mission_progress FROM PUBLIC;

GRANT SELECT ON public.dealer_advertising_plans TO authenticated;
GRANT SELECT ON public.game_billboard_assignments TO authenticated;
GRANT SELECT ON public.game_missions TO anon, authenticated;
GRANT SELECT ON public.player_mission_progress TO authenticated;

GRANT ALL ON public.dealer_advertising_plans TO service_role;
GRANT ALL ON public.game_billboard_assignments TO service_role;
GRANT ALL ON public.game_missions TO service_role;
GRANT ALL ON public.player_mission_progress TO service_role;

GRANT EXECUTE ON FUNCTION public.get_active_game_billboards() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_dealer_billboard_state() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_vehicle_to_game_billboard(TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_my_game_billboard_slot(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_billboard_overview() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_manage_billboard_assignment(UUID, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_dealer_billboard_slots(TEXT, INTEGER, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_mission_overview() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_game_mission(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_game_mission(TEXT, UUID, BOOLEAN, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_game_missions() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_game_mission(TEXT, BOOLEAN, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated, service_role;
