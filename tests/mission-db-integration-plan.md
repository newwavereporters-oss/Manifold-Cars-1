# MANIFOLD CARS 3D — Database Integration Test Plan

This plan verifies the security, privilege boundaries, ownership checks, schema reconciliation, billboard triggers, and mission lifecycle RPCs defined in `src/db/manifold-game-expansion-migration.sql` against a live PostgreSQL / Supabase instance using non-destructive, rolled-back transactions (`BEGIN; ... ROLLBACK;`).

> **Safety Rule:** Execute only inside a staging database or a `BEGIN; ... ROLLBACK;` block so zero production records, wallet balances, marketplace listings, or dealer accounts are altered.

---

## 0. Verification Scope Boundaries (Local vs Disposable Postgres vs Production)

| Verification Tier | What It Validates | What It Does **NOT** Validate |
| :--- | :--- | :--- |
| **1. Local Mocked & Static Verification** (`tests/missionLifecycle.test.ts`, SQL static assertions, `tsc --noEmit`, `npm run build`) | Frontend state machine transitions (`MissionManager`), deduplication, retry flows, badge/reward reconciliation against mocked RPC payloads, static presence of SQL constraint-restoration `DO $$` blocks, Section 9 verification gate, functions/grants/triggers, and TypeScript/Vite compilation. | Real PostgreSQL trigger execution, `SECURITY DEFINER` privilege boundaries, RLS policy evaluation, `pg_advisory_xact_lock`, partial-schema DDL execution, `RAISE EXCEPTION` blockers on dirty legacy data, or actual `cars.dealer_id` FK/trigger behavior. |
| **2. Disposable / Staging Postgres (`BEGIN; ... ROLLBACK;`)** (Sections 1–7 below) | Full live PostgreSQL execution of `manifold-game-expansion-migration.sql`: missing PK/FK/NOT NULL/CHECK/default restoration on partially existing tables, deployment blockers on invalid/orphaned/duplicate records (all 5 uniqueness invariants), idempotent reruns, RPC ordering (`complete_game_mission` after deactivation), `reward_badge_awarded` persistence, `cars.dealer_id` auto-pause trigger, RLS isolation, and privilege denials. | Live production data cleanliness or production user traffic concurrency. |
| **3. Non-Destructive Production Verification** (Read-only `SELECT` / catalog checks) | Confirms migration objects, grants, PKs, FKs, CHECKs, NOT NULLs, valid unique indexes (`indisvalid`), triggers, and `reward_badge_awarded` nullable schema match deployment expectations without modifying any rows. | Write-path rollback tests (never run test mutations directly on production). |

---

## 1. Prerequisites & Test Fixtures

Before running the rolled-back SQL checks:
1. Ensure `src/db/manifold-game-expansion-migration.sql` has been applied to the target staging database (or for Section 5 partial-schema tests, start in a clean staging schema inside `BEGIN; ... ROLLBACK;`).
2. Identify or create two test `auth.users` / `public.player_profiles` rows inside the `BEGIN; ... ROLLBACK;` transaction (`v_player_a_id`, `v_player_b_id`) with known starting `credits_balance` and `xp_balance`.
3. Helper for simulating Supabase caller identity inside SQL:
   ```sql
   SET LOCAL ROLE authenticated;
   SELECT set_config('request.jwt.claim.sub', '<player_a_auth_uid>', true);
   SELECT set_config('request.jwt.claims', '{"sub":"<player_a_auth_uid>","role":"authenticated"}', true);
   ```

---

## 2. Privilege & Grant Verification (`PUBLIC`, `anon`, `authenticated`, `service_role`)

### 2.1 Expansion Table Privileges
Query `information_schema.role_table_grants` to confirm direct write privileges (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`) are revoked from `PUBLIC`, `anon`, and `authenticated` on all 4 expansion tables:

```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'dealer_advertising_plans',
    'game_billboard_assignments',
    'game_missions',
    'player_mission_progress'
  )
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
```

**Expected Result:**
- `dealer_advertising_plans`: ONLY `SELECT` for `authenticated`; zero grants for `anon`/`PUBLIC`.
- `game_billboard_assignments`: ONLY `SELECT` for `authenticated`; zero grants for `anon`/`PUBLIC`.
- `game_missions`: ONLY `SELECT` for `anon` and `authenticated`; zero write grants.
- `player_mission_progress`: ONLY `SELECT` for `authenticated`; zero grants for `anon`/`PUBLIC`; zero write grants for `authenticated`.
- Attempting `INSERT`/`UPDATE`/`DELETE` as `authenticated` or `anon` on `player_mission_progress` or `game_missions` fails with `permission denied`.

### 2.2 Legacy & Trigger Function Execution Revocations
```sql
SELECT p.oid::regprocedure,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
       has_function_privilege('public', p.oid, 'EXECUTE') AS public_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'complete_game_mission',
    'enforce_game_billboard_constraints',
    'sync_car_status_to_billboards',
    'sync_car_dealer_to_billboards'
  );
```
**Expected Result:**
- Legacy `complete_game_mission(text,uuid,boolean,jsonb)` (if present): `anon_exec = false`, `auth_exec = false`, `public_exec = false`.
- New 7-arg `complete_game_mission(text,uuid,double precision,double precision,text,integer,integer)`: `auth_exec = true`, `anon_exec = false`.
- Trigger functions `enforce_game_billboard_constraints()`, `sync_car_status_to_billboards()`, and `sync_car_dealer_to_billboards()`: `anon_exec = false`, `auth_exec = false`, `public_exec = false`.

---

## 3. RLS & Cross-Player Ownership Checks

Run inside `BEGIN; ... ROLLBACK;` using two distinct players (`Player A`, `Player B`):

1. **RLS Isolation on `player_mission_progress`:**
   - As Player A, call `SELECT public.start_game_mission('NEAR_OBALENDE_PARCEL')` -> capture `runToken`.
   - Switch JWT claim to Player B (`set_config('request.jwt.claim.sub', ...)`).
   - `SELECT count(*) FROM public.player_mission_progress WHERE run_token = '<player_a_token>'` must return `0`.
2. **Cross-Player RPC Rejection:**
   - As Player B, attempt:
     - `report_game_mission_checkpoint('NEAR_OBALENDE_PARCEL', '<player_a_token>', 0, 105, 0)` -> raises `'Mission run record not found'`.
     - `fail_game_mission('NEAR_OBALENDE_PARCEL', '<player_a_token>', 'test')` -> returns `{ failed: false, persisted: false, reason: 'Mission run not found' }`.
     - `abandon_game_mission('NEAR_OBALENDE_PARCEL', '<player_a_token>')` -> returns `{ abandoned: false, reason: 'Mission run not found' }`.
     - `complete_game_mission('NEAR_OBALENDE_PARCEL', '<player_a_token>', 160, 30, 'D1', 0, NULL)` -> raises `'Mission run record not found'`.
3. **Unauthenticated Rejection & Existing Marketplace Preservation:**
   - With `ROLE anon` / null `sub`, verify `start_game_mission`, `report_game_mission_checkpoint`, `fail_game_mission`, `abandon_game_mission`, and `complete_game_mission` reject execution.
   - Verify `SELECT count(*) FROM public.game_missions WHERE is_active = true` succeeds as `anon`, and existing `cars`/`dealers` marketplace RLS policies remain unchanged.

---

## 4. Mission Lifecycle, Deactivation Retry & Badge Consistency (`BEGIN; ... ROLLBACK;`)

Execute each test scenario in its own `BEGIN; ... ROLLBACK;` block (or savepoint):

### Scenario A — Checkpoint Validation (Zone, Order, Travel Speed, Expiration)
1. Call `start_game_mission('NEAR_OBALENDE_PARCEL')` -> note `runToken`.
2. Call `report_game_mission_checkpoint` with out-of-zone coords `(0, 0)`:
   - Expect `{ success: false, recorded: false, message: 'Vehicle outside checkpoint verification zone' }`.
   - Verify `last_checkpoint_index` remains `0` and row `status` remains `'in_progress'`.
3. Call `report_game_mission_checkpoint` with invalid index `1` before `0`:
   - Expect exception `'Out-of-order checkpoint sequence (expected 0, received 1)'`.
4. Advance `started_at` back by 5 seconds in DB (simulating driving time), then call `report_game_mission_checkpoint` with valid coords `(105, 0)`:
   - Expect `{ success: true, recorded: true, nextCheckpointIndex: 1 }`.
5. Repeat `report_game_mission_checkpoint` with index `0`:
   - Expect `{ success: true, alreadyRecorded: true, nextCheckpointIndex: 1 }`.
6. Update `expires_at = now() - interval '1 second'` and call `report_game_mission_checkpoint`:
   - Expect `{ success: false, expired: true }` and DB `status = 'failed'`.

### Scenario B — Idempotent Completion Retry After Mission Deactivation & Badge Edit
```sql
-- Inside BEGIN; ... ROLLBACK; (with Player A JWT active for RPC calls, service_role/superuser for catalog setup)
-- 1. Start FAR_TMB_CHECKPOINT_SPRINT ('Bridge Sprinter' badge, 3 checkpoints), backdate timestamps, complete all 3 checkpoints.
-- 2. Call complete_game_mission(...) once:
--    Assert success=true, persisted=true, creditsAwarded=1450, xpAwarded=420, rewardBadge='Bridge Sprinter'.
--    Assert player_mission_progress.reward_badge_awarded = 'Bridge Sprinter'.
-- 3. Deactivate mission & alter reward_badge:
UPDATE public.game_missions
SET is_active = false, reward_badge = 'Mutated Future Badge'
WHERE id = 'FAR_TMB_CHECKPOINT_SPRINT';
-- 4. Call complete_game_mission(...) a 2nd time with the same mission_id and run_token:
--    Expect NO 'Mission is no longer active' error!
--    Expect success=true, persisted=true, alreadyFinalized=true, creditsAwarded=1450, xpAwarded=420, rewardBadge='Bridge Sprinter'.
--    Expect player_profiles.credits_balance and xp_balance did NOT double-increment.
-- 5. Repeat on a no-badge mission (e.g. NEAR_OBALENDE_PARCEL) -> mutate game_missions.reward_badge = 'Late Badge' after completion ->
--    2nd call returns rewardBadge: null (never reconstructs from edited catalog).
-- 6. For any pre-existing completed row where reward_badge_awarded IS NULL, retry returns rewardBadge: null without fabricating a badge.
```

### Scenario C — `fail_game_mission` & `abandon_game_mission` on Finalized Runs
1. On the already-completed run from Scenario B, call `fail_game_mission` and `abandon_game_mission`:
   - Both return `alreadyFinalized: true`, `status: 'completed'`, `creditsAwarded: 1450`, `xpAwarded: 420`, `rewardBadge: 'Bridge Sprinter'`.
   - DB row remains `status = 'completed'` with `reward_claimed_at IS NOT NULL`.
2. On an abandoned run, `fail_game_mission` returns `alreadyFinalized: true, status: 'abandoned', rewardBadge: null`.
3. On a failed run, `abandon_game_mission` returns `alreadyFinalized: true, status: 'failed', failureReason: <reason>, rewardBadge: null`.

---

## 5. Partial-Schema Constraint Restoration, Duplicate Blockers & Rerun Idempotency (Disposable Postgres Only)

Run each sub-test in an isolated disposable staging schema / `BEGIN; ... ROLLBACK;` block before any production deployment:

### 5.1 Clean Upgrade from Stripped-Down Partial Tables (Missing PKs, FKs, NOT NULLs, CHECKs, Defaults, Indexes)
1. Create stripped-down versions of all 4 tables WITHOUT Primary Keys, Foreign Keys, CHECK constraints, defaults, or NOT NULLs on non-nullable columns (plus missing columns `plan_code`, `notes`, `display_order`, `starts_at`, `require_park_gear`, `cooldown_seconds`, `reward_badge_awarded`, `abandoned_at`, `client_telemetry`, `progress_data`).
2. Seed clean valid baseline rows across all 4 tables, including:
   - A completed `player_mission_progress` row referencing a catalog mission ID (`NEAR_OBALENDE_PARCEL`) with `reward_badge_awarded` NULL.
   - Clean `dealer_advertising_plans` and `game_billboard_assignments` rows referencing real `dealers(id)` and `cars(id)`.
3. Execute `src/db/manifold-game-expansion-migration.sql` end-to-end.
4. **Expected Result:**
   - Migration completes cleanly and Section 9 final verification gate passes.
   - `pg_constraint` confirms all 4 Primary Keys (`dealer_id`, `id`, `id`, `id`), all 7 Foreign Keys (including `updated_by -> auth.users` and `created_by -> auth.users` with `ON DELETE SET NULL`), and all 10 `CHECK` constraints (1 + 1 + 7 + 1).
   - `pg_attribute.attnotnull = true` for all required columns across all 4 tables, while optional/historical columns (`reward_badge`, `reward_badge_awarded`, `notes`, `updated_by`, `created_by`, `ends_at`, `expires_at`, `last_checkpoint_at`, `abandoned_at`, `completed_at`, `reward_claimed_at`, `last_reported_x`, `last_reported_z`, `failure_reason`) remain nullable.
   - `pg_index` confirms `idx_billboard_unique_active_vehicle`, `idx_player_mission_unique_run_token`, and `idx_player_mission_single_in_progress` exist with `indisunique = true` and `indisvalid = true`.
   - All pre-existing valid rows are preserved (including `reward_badge_awarded IS NULL` on legacy completed runs).

### 5.2 Migration Rerun Idempotency
1. Immediately re-execute `src/db/manifold-game-expansion-migration.sql` a 2nd time against the already-migrated schema from 5.1 (both with system-generated inline constraint names AND with explicit `fk_*`/`chk_*` names).
2. **Expected Result:**
   - Zero duplicate constraint errors, zero `NOTICE` skips, zero mutations to existing rows or balances, and Section 9 verification gate passes cleanly.

### 5.3 Deployment Blocker Diagnostics (Invalid, Null, Orphaned & Conflicting PK/FK Data)
Inside separate `SAVEPOINT` / `ROLLBACK` cases against partially existing tables with clean rows + one injected anomaly per case, execute `src/db/manifold-game-expansion-migration.sql` and confirm it **fails loudly (`RAISE EXCEPTION 'DEPLOYMENT BLOCKER: ...'`) while preserving every existing row**:
1. **Conflicting Primary Key:** Table has existing PK on a different column (e.g. `(dealer_id, vehicle_listing_id)`) -> fails with `'Conflicting primary key ... expected (id)'`.
2. **Orphaned Foreign Keys (tested for each FK):**
   - `dealer_advertising_plans.dealer_id` not in `public.dealers` or `updated_by` not in `auth.users`.
   - `game_billboard_assignments.dealer_id` not in `public.dealers`, `vehicle_listing_id` not in `public.cars`, or `created_by` not in `auth.users`.
   - `player_mission_progress.player_id` not in `public.player_profiles` or `mission_id` not in `public.game_missions`.
   - Expect exact orphan count and sample keys reported; zero rows deleted or nulled out.
3. **NULLs Blocking `NOT NULL` Restoration:**
   - Null `title` / `mission_category` in `game_missions`, null `dealer_id` in `dealer_advertising_plans`, null `vehicle_listing_id` in `game_billboard_assignments`, or null `player_id` / `mission_id` / `status` in `player_mission_progress`.
   - Expect exact `Column <name> has N NULL row(s) blocking NOT NULL` error; zero fake empty-string or zero defaults fabricated.
4. **Invalid Values Blocking `CHECK` Constraints:**
   - `dealer_advertising_plans.max_active_slots = 0` or `99`.
   - `game_billboard_assignments.status = 'draft'`.
   - `game_missions` invalid `mission_category`, invalid `distance_category`, negative `reward_credits` / `reward_xp` / `cooldown_seconds`, `time_limit_seconds = 5`, invalid `difficulty`.
   - `player_mission_progress.status = 'pending'`.
   - Expect exact offending row counts and sample values reported cleanly.

### 5.4 Deployment Blockers for All 5 Duplicate-Record Uniqueness Invariants
Test each duplicate condition in isolation inside a `BEGIN; ... ROLLBACK;` block against a stripped partial table (no PK/unique index yet) before running `src/db/manifold-game-expansion-migration.sql`:
1. **Duplicate `game_missions.id`:** Insert two rows sharing the same `id` -> migration aborts with `'Duplicate mission IDs (1 conflict(s))'`.
2. **Duplicate `player_mission_progress.run_token`:** Insert two rows with the same `run_token` -> migration aborts with `'Duplicate run_token conflicts (1 group(s))'`.
3. **Multiple `in_progress` runs per player:** Insert two `status = 'in_progress'` rows for the same `player_id` -> migration aborts with `'Multiple in_progress runs for one player (1 player(s))'`.
4. **Duplicate active billboard assignments per vehicle:** Insert two `status = 'active'` rows referencing the same `vehicle_listing_id` in `game_billboard_assignments` -> migration aborts with `'Duplicate active billboard assignments for same vehicle (1 vehicle(s))'`.
5. **Duplicate `dealer_advertising_plans.dealer_id`:** Insert two rows sharing the same `dealer_id` -> migration aborts with `'Duplicate dealer_id conflicts (1 group(s))'`.
- In all 5 cases: verify zero `RAISE NOTICE 'Skipped creating unique index'` warnings, transaction rolls back cleanly while preserving pre-existing rows, and once duplicates are resolved cleanly, migration succeeds and Section 9 confirms valid unique indexes (`indisunique = true AND indisvalid = true`).

---

## 6. Billboard Ownership & Status Trigger Verification (`BEGIN; ... ROLLBACK;`)

1. Assign a published car owned by `Dealer A` to an active billboard slot (`status = 'active'`).
2. Update `public.cars SET dealer_id = '<Dealer B>' WHERE id = '<car_id>'`:
   - Confirm the `UPDATE public.cars` succeeds cleanly (does NOT throw `'Security violation'` inside `enforce_game_billboard_constraints`).
   - Confirm `Dealer A`'s billboard assignment was transitioned to `status = 'paused'` with updated `updated_at`.
   - Confirm historical row is preserved (not deleted or transferred to `Dealer B`), and unrelated vehicles remain `status = 'active'`.
3. Reactivate another published car for `Dealer A`, then run `UPDATE public.cars SET dealer_id = NULL WHERE id = '<car_id_2>'`:
   - Confirm `UPDATE public.cars` succeeds cleanly and pauses the active billboard assignment.
4. Attempt as `Dealer A` (or admin) to reactivate (`status = 'active'`) the paused assignment while `cars.dealer_id` belongs to `Dealer B` or `NULL`:
   - Confirm `enforce_game_billboard_constraints` / `admin_manage_billboard_assignment` strictly rejects activation.
5. Also test listing unpublish (`UPDATE public.cars SET status = 'draft' WHERE id = '<car_id_3>'`) to confirm `trg_sync_car_status_to_billboards` pauses active billboards cleanly.

---

## 7. Clean Rollback Verification

End every live verification session with:
```sql
ROLLBACK;
```
Confirm zero test rows remain in `player_mission_progress`, `game_billboard_assignments`, `dealer_advertising_plans`, `game_missions`, or `cars`, and `player_profiles` balances match baseline.


