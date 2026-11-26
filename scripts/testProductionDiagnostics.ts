import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateWorldDbStatus,
  extractSupabaseHost,
} from '../server/routes/world.js';
import {
  fetchPublicCarsFromSupabase,
  isPublicCarStatus,
  sanitizePublicDealerPayload,
} from '../server/routes/cars.js';
import {
  formatCarQueryError,
  isPublicMarketplaceCar,
  sanitizePublicDealerRow,
} from '../src/services/carService.js';
import { formatWorldSupabaseError } from '../src/services/playerService.js';

const ACTUAL_WORLD_TABLE_COLUMNS: Record<string, string[]> = {
  player_profiles: ['id', 'user_id', 'nickname', 'email', 'account_status', 'chat_status', 'created_at', 'updated_at'],
  player_presence: ['player_id', 'user_id', 'nickname', 'is_online', 'last_heartbeat_at', 'updated_at'],
  chat_invitations: ['id', 'sender_player_id', 'recipient_player_id', 'status', 'created_at', 'expires_at'],
  chat_conversations: ['id', 'player_a_id', 'player_b_id', 'status', 'created_at', 'last_activity_at'],
  chat_messages: ['id', 'conversation_id', 'sender_player_id', 'content', 'moderation_status', 'created_at'],
  player_blocks: ['id', 'blocker_player_id', 'blocked_player_id', 'created_at'],
  player_reports: ['id', 'reporting_player_id', 'reported_player_id', 'review_status', 'created_at'],
  moderation_incidents: ['id', 'player_id', 'severity', 'action_taken', 'created_at'],
  player_admin_audit_logs: ['id', 'admin_user_id', 'player_id', 'action', 'reason', 'created_at'],
  chat_moderation_config: [
    'id',
    'max_message_length',
    'discovery_radius',
    'heartbeat_timeout_minutes',
    'invite_expiry_seconds',
    'warning_threshold',
    'temp_restriction_minutes',
    'suspension_threshold',
    'updated_at',
  ],
};

function createMockWorldSupabaseClient(handlers: {
  tableResponses?: Record<string, { data?: any; error?: any }>;
  tableSchemas?: Record<string, string[]>;
  rpcResponses?: Record<string, { data?: any; error?: any }>;
}) {
  const schemas = handlers.tableSchemas ?? ACTUAL_WORLD_TABLE_COLUMNS;
  return {
    from(table: string) {
      return {
        select(cols?: string) {
          return {
            limit: async () => {
              const explicit = handlers.tableResponses?.[table];
              if (explicit) return explicit;

              const availableCols = schemas[table];
              if (availableCols && cols) {
                const requestedCols = cols
                  .split(',')
                  .map((c) => c.trim())
                  .filter(Boolean);
                const missingCol = requestedCols.find((col) => !availableCols.includes(col));
                if (missingCol) {
                  return {
                    data: null,
                    error: {
                      code: '42703',
                      message: `column ${table}.${missingCol} does not exist`,
                    },
                  };
                }
              }

              return { data: [], error: null };
            },
          };
        },
      };
    },
    rpc: async (fn: string) => {
      return handlers.rpcResponses?.[fn] ?? { data: null, error: null };
    },
  } as any;
}

async function runTests() {
  console.log('1. Testing extractSupabaseHost (non-secret hostname extraction)...');
  assert.equal(
    extractSupabaseHost('https://abcdefghij.supabase.co'),
    'abcdefghij.supabase.co'
  );
  assert.equal(extractSupabaseHost(''), null);

  console.log('2. Testing /api/world/db-status anon PGRST202 regression...');
  const anonClient = createMockWorldSupabaseClient({
    tableResponses: {
      player_profiles: {
        data: null,
        error: { code: '42501', message: 'permission denied for table player_profiles' },
      },
    },
    rpcResponses: {
      check_player_registration_available: { data: { emailAvailable: true }, error: null },
      admin_get_players_directory: {
        data: null,
        error: {
          code: 'PGRST202',
          message:
            'Could not find the function public.admin_get_players_directory() in the schema cache',
        },
      },
    },
  });

  const anonStatus = await evaluateWorldDbStatus({
    client: anonClient,
    verificationMode: 'anon',
    supabaseUrl: 'https://demo-proj.supabase.co',
  });
  assert.equal(anonStatus.migrationRequired, false, 'anon PGRST202 must NOT trigger migrationRequired');
  assert.equal(anonStatus.tablesExist, true);
  assert.equal(anonStatus.supabaseHost, 'demo-proj.supabase.co');
  assert.equal(anonStatus.checks['rpc:admin_get_players_directory'].exists, true);
  assert.equal(
    anonStatus.checks['rpc:admin_get_players_directory'].unverifiedAnonRestricted,
    true
  );

  console.log('3. Testing /api/world/db-status service_role with P0001 Admin privileges required...');
  const serviceClient = createMockWorldSupabaseClient({
    rpcResponses: {
      check_player_registration_available: { data: { emailAvailable: true }, error: null },
      admin_get_players_directory: {
        data: null,
        error: { code: 'P0001', message: 'Admin privileges required' },
      },
    },
  });

  const serviceStatus = await evaluateWorldDbStatus({
    client: serviceClient,
    verificationMode: 'service_role',
    supabaseUrl: 'https://demo-proj.supabase.co',
  });
  assert.equal(serviceStatus.migrationRequired, false);
  assert.equal(serviceStatus.checks['rpc:admin_get_players_directory'].exists, true);
  assert.equal(serviceStatus.checks['rpc:admin_get_players_directory'].code, 'P0001');

  console.log('4. Testing /api/world/db-status succeeds on actual schema (no created_at on player_presence/chat_moderation_config) & catches genuine missing columns (42703)...');
  assert.equal(serviceStatus.checks.player_presence.exists, true);
  assert.equal(serviceStatus.checks.chat_moderation_config.exists, true);

  const missingColClient = createMockWorldSupabaseClient({
    tableSchemas: {
      ...ACTUAL_WORLD_TABLE_COLUMNS,
      player_presence: ['player_id', 'is_online', 'updated_at'],
      chat_moderation_config: ['id', 'heartbeat_timeout_minutes', 'updated_at'],
    },
    rpcResponses: {
      check_player_registration_available: { data: { emailAvailable: true }, error: null },
      admin_get_players_directory: { data: [], error: null },
    },
  });

  const missingColStatus = await evaluateWorldDbStatus({
    client: missingColClient,
    verificationMode: 'service_role',
    supabaseUrl: 'https://demo-proj.supabase.co',
  });
  assert.equal(missingColStatus.migrationRequired, true);
  assert.equal(missingColStatus.checks.player_presence.exists, false);
  assert.equal(missingColStatus.checks.player_presence.code, '42703');
  assert.ok(missingColStatus.checks.player_presence.error?.includes('last_heartbeat_at'));
  assert.equal(missingColStatus.checks.chat_moderation_config.exists, false);
  assert.equal(missingColStatus.checks.chat_moderation_config.code, '42703');
  assert.ok(missingColStatus.checks.chat_moderation_config.error?.includes('discovery_radius'));

  console.log('5. Testing /api/world/db-status detects genuine missing table (42P01)...');
  const missingTableClient = createMockWorldSupabaseClient({
    tableResponses: {
      player_profiles: {
        data: null,
        error: { code: '42P01', message: 'relation "public.player_profiles" does not exist' },
      },
    },
  });

  const missingStatus = await evaluateWorldDbStatus({
    client: missingTableClient,
    verificationMode: 'service_role',
    supabaseUrl: 'https://demo-proj.supabase.co',
  });
  assert.equal(missingStatus.migrationRequired, true);
  assert.equal(missingStatus.checks.player_profiles.exists, false);
  assert.equal(missingStatus.checks.player_profiles.code, '42P01');

  console.log('6. Testing formatWorldSupabaseError preserves real DB errors...');
  const preservedWorldErr = formatWorldSupabaseError({
    code: 'P0001',
    message: 'Admin privileges required',
    hint: 'Ensure user is active in admin_users',
  });
  assert.ok(preservedWorldErr.includes('P0001'));
  assert.ok(preservedWorldErr.includes('Admin privileges required'));
  assert.ok(preservedWorldErr.includes('admin_users'));

  console.log('7. Testing public /api/cars PII stripping, status filtering, and error preservation...');
  const mockPublicCarsClient = {
    from(table: string) {
      assert.equal(table, 'cars');
      return {
        select(cols: string) {
          assert.ok(!cols.includes('dealers (*)'), 'Must never select dealers (*) on public query');
          return {
            order: async () => ({
              data: [
                {
                  id: 'car-1',
                  slug: 'jetour-g700',
                  title: 'Jetour G700',
                  status: 'PUBLISHED',
                  dealers: {
                    id: 'dlr-1',
                    name: 'Test Motors',
                    business_name: 'Test Motors Ltd',
                    city: 'Lekki',
                    state: 'Lagos',
                    phone: '+2348000000000',
                    email: 'secret@dealer.test',
                    address: '12 Private St',
                  },
                },
                {
                  id: 'car-2',
                  slug: 'hidden-draft',
                  title: 'Draft Car',
                  status: 'DRAFT',
                  dealers: null,
                },
              ],
              error: null,
            }),
          };
        },
      };
    },
  } as any;

  const carsRes = await fetchPublicCarsFromSupabase(mockPublicCarsClient);
  assert.equal(carsRes.ok, true);
  if (carsRes.ok) {
    assert.equal(carsRes.cars.length, 1);
    assert.equal(carsRes.cars[0].id, 'car-1');
    assert.equal(carsRes.cars[0].dealers.phone, undefined);
    assert.equal(carsRes.cars[0].dealers.email, undefined);
    assert.equal(carsRes.cars[0].dealers.address, undefined);
  }

  // Test query failure preservation (must return ok: false, never [])
  const failingCarsClient = {
    from() {
      return {
        select() {
          return {
            order: async () => ({
              data: null,
              error: {
                code: '42501',
                message: 'permission denied for table cars',
              },
            }),
          };
        },
      };
    },
  } as any;

  const failRes = await fetchPublicCarsFromSupabase(failingCarsClient);
  assert.equal(failRes.ok, false);
  if (!failRes.ok) {
    assert.equal(failRes.status, 502);
    assert.equal(failRes.payload.code, '42501');
    assert.ok(failRes.payload.error.includes('permission denied'));
  }

  assert.equal(isPublicCarStatus('PUBLISHED'), true);
  assert.equal(isPublicCarStatus('published'), true);
  assert.equal(isPublicCarStatus('DRAFT'), false);
  assert.equal(isPublicCarStatus('ARCHIVED'), false);
  assert.equal(isPublicMarketplaceCar({ status: 'PUBLISHED' }), true);
  assert.equal(isPublicMarketplaceCar({ status: 'DRAFT' }), false);

  const sanitizedServer = sanitizePublicDealerPayload({
    id: '1',
    name: 'Dealer',
    phone: '080',
    email: 'a@b.com',
    address: 'x',
    cac_registration_number: 'RC123',
  });
  assert.equal(sanitizedServer?.phone, undefined);
  assert.equal(sanitizedServer?.email, undefined);
  assert.equal(sanitizedServer?.address, undefined);
  assert.equal(sanitizedServer?.cac_registration_number, undefined);

  const sanitizedClient = sanitizePublicDealerRow({
    id: '1',
    name: 'Dealer',
    phone: '080',
    email: 'a@b.com',
    address: 'x',
  });
  assert.equal(sanitizedClient?.phone, undefined);
  assert.equal(sanitizedClient?.email, undefined);
  assert.equal(sanitizedClient?.address, undefined);

  assert.ok(
    formatCarQueryError('Inventory failed', { code: '42501', message: 'denied' }).includes('[42501]')
  );

  console.log('8. Verifying SQL fixes isolate current_dealer_id()/is_active_admin() away from anon...');
  const sqlContent = fs.readFileSync(
    path.join(process.cwd(), 'src/db/public-cars-and-dealers-fix.sql'),
    'utf8'
  );
  assert.ok(
    !sqlContent.includes("COALESCE(status, '') <> 'suspended'"),
    'public-cars-and-dealers-fix.sql must not reference missing dealers.status column'
  );
  assert.ok(sqlContent.includes("to_jsonb(dealers)->>'dealer_status'"));
  assert.ok(sqlContent.includes('FOR SELECT TO authenticated'));
  assert.ok(sqlContent.includes('car_brand_inventory'));

  const persistenceSql = fs.readFileSync(
    path.join(process.cwd(), 'src/db/dealer-vehicle-persistence-fix.sql'),
    'utf8'
  );
  assert.ok(
    persistenceSql.includes('CREATE POLICY "Dealers view own cars" ON public.cars\n  FOR SELECT TO authenticated') ||
      persistenceSql.includes('CREATE POLICY "Dealers view own cars" ON public.cars\r\n  FOR SELECT TO authenticated'),
    'Dealers view own cars must be scoped TO authenticated'
  );

  const dealerApprovalSql = fs.readFileSync(
    path.join(process.cwd(), 'src/db/dealer-approval-migration.sql'),
    'utf8'
  );
  assert.ok(
    dealerApprovalSql.includes('CREATE POLICY "Dealers view own cars" ON public.cars\n  FOR SELECT TO authenticated') ||
      dealerApprovalSql.includes('CREATE POLICY "Dealers view own cars" ON public.cars\r\n  FOR SELECT TO authenticated'),
    'dealer-approval-migration.sql Dealers view own cars must be scoped TO authenticated'
  );

  console.log('All production diagnostics regression tests passed!');
}

runTests().catch((err) => {
  console.error('Regression test failed:', err);
  process.exit(1);
});
