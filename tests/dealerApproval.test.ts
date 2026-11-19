import { resolveDealerApprovalState } from '../src/services/dealerOnboardingService';
import {
  dealerVehicleService,
  getDealerListingBlockReason,
  type DealerCarFormInput,
} from '../src/services/dealerVehicleService';
import { dealerService } from '../src/services/dealerService';
import { supabase } from '../src/lib/supabase';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed (${message}): expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

const SAMPLE_CAR_INPUT: DealerCarFormInput = {
  make: 'Toyota',
  model: 'Camry',
  year: 2022,
  body_type: 'Sedan',
  condition: 'Foreign Used (Tokunbo)',
  mileage: 32000,
  fuel_type: 'Petrol',
  transmission: 'Automatic',
  drive_type: 'FWD',
  exterior_color: 'Pearl White',
  interior_color: 'Black Leather',
  price: 26500000,
  location: 'Lekki Phase 1',
  state: 'Lagos',
  description: 'Clean unit with complete customs papers and smooth engine.',
};

interface MockSupabaseConfig {
  accountStatus: string;
  isVerified: boolean;
  dealerStatus?: string;
  onCarsInsert?: (payload: any) => void;
  onCarsUpdate?: (payload: any) => void;
}

function installMockDealerSupabase(config: MockSupabaseConfig) {
  const client = supabase as any;
  const originalAuth = client.auth;
  const originalFrom = client.from.bind(client);

  client.auth = {
    ...originalAuth,
    getSession: async () => ({
      data: {
        session: {
          user: {
            id: 'user-dealer-1',
            email: 'dealer@example.com',
          },
        },
      },
      error: null,
    }),
  };

  client.from = (table: string) => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      maybeSingle: async () => {
        if (table === 'admin_users') return { data: null, error: null };
        if (table === 'dealer_accounts') {
          return {
            data: { dealer_id: 'dealer-uuid-1', account_status: config.accountStatus },
            error: null,
          };
        }
        if (table === 'dealers') {
          return {
            data: {
              is_verified: config.isVerified,
              ...(config.dealerStatus !== undefined ? { dealer_status: config.dealerStatus } : {}),
            },
            error: null,
          };
        }
        if (table === 'cars') {
          return {
            data: {
              id: 'car-existing-1',
              slug: '2022-toyota-camry',
              title: '2022 Toyota Camry',
              year: 2022,
              make: 'Toyota',
              model: 'Camry',
              body_type: 'Sedan',
              condition: 'Foreign Used (Tokunbo)',
              price: 26500000,
              currency: 'NGN',
              mileage: 32000,
              transmission: 'Automatic',
              fuel_type: 'Petrol',
              drive_type: 'FWD',
              exterior_color: 'Pearl White',
              interior_color: 'Black Leather',
              location: 'Lekki Phase 1',
              state: 'Lagos',
              description: 'Clean unit',
              status: 'DRAFT',
              is_verified: false,
              is_featured: false,
              dealer_id: 'dealer-uuid-1',
              car_media: [],
              car_images: [],
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      insert: async (payload: any) => {
        if (table === 'cars' && config.onCarsInsert) {
          config.onCarsInsert(payload);
        }
        return { error: null };
      },
      update: (payload: any) => {
        if (table === 'cars' && config.onCarsUpdate) {
          config.onCarsUpdate(payload);
        }
        return {
          eq: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      },
      delete: () => ({
        eq: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    };
    return chain;
  };

  return () => {
    client.auth = originalAuth;
    client.from = originalFrom;
  };
}

async function runTests() {
  const results: Array<{ name: string; ok: boolean }> = [];

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`PASS: ${name}`);
    } catch (err) {
      results.push({ name, ok: false });
      console.error(`FAIL: ${name}`, err);
    }
  }

  await test('resolveDealerApprovalState maps pending, active, rejected, suspended, isVerified, and dealerStatus accurately', () => {
    const pending = resolveDealerApprovalState('pending', false, 'pending');
    assertEqual(pending.accountStatus, 'pending', 'pending accountStatus');
    assertEqual(pending.dealerStatus, 'pending', 'pending dealerStatus');
    assertEqual(pending.approvalStatus, 'pending', 'pending approvalStatus');
    assertEqual(pending.isApproved, false, 'pending isApproved');

    const activeVerified = resolveDealerApprovalState('active', true, 'approved');
    assertEqual(activeVerified.accountStatus, 'active', 'active accountStatus');
    assertEqual(activeVerified.dealerStatus, 'approved', 'approved dealerStatus');
    assertEqual(activeVerified.approvalStatus, 'approved', 'active approvalStatus');
    assertEqual(activeVerified.isApproved, true, 'active verified isApproved');

    const activeButPendingDealerStatus = resolveDealerApprovalState('active', true, 'pending');
    assertEqual(activeButPendingDealerStatus.dealerStatus, 'pending', 'explicit pending overrides active');
    assertEqual(activeButPendingDealerStatus.isApproved, false, 'explicit pending blocks listing');

    const activeButDisapprovedDealerStatus = resolveDealerApprovalState('active', true, 'disapproved');
    assertEqual(
      activeButDisapprovedDealerStatus.dealerStatus,
      'disapproved',
      'explicit disapproved overrides active'
    );
    assertEqual(
      activeButDisapprovedDealerStatus.isApproved,
      false,
      'explicit disapproved blocks listing'
    );

    const activeUnverified = resolveDealerApprovalState('active', false);
    assertEqual(activeUnverified.approvalStatus, 'disapproved', 'active + isVerified=false becomes disapproved');
    assertEqual(activeUnverified.isApproved, false, 'active + isVerified=false blocks listing');

    const rejected = resolveDealerApprovalState('rejected', true);
    assertEqual(rejected.accountStatus, 'rejected', 'rejected accountStatus');
    assertEqual(rejected.approvalStatus, 'disapproved', 'rejected approvalStatus');
    assertEqual(rejected.isApproved, false, 'rejected blocks listing');

    const suspended = resolveDealerApprovalState('suspended', true, 'approved');
    assertEqual(suspended.accountStatus, 'suspended', 'suspended accountStatus');
    assertEqual(suspended.approvalStatus, 'suspended', 'suspended approvalStatus');
    assertEqual(suspended.isApproved, false, 'suspended blocks listing');

    const unknown = resolveDealerApprovalState(undefined, null, undefined);
    assertEqual(unknown.approvalStatus, 'pending', 'unknown defaults safely to pending');
    assertEqual(unknown.dealerStatus, 'pending', 'unknown dealerStatus defaults to pending');
    assertEqual(unknown.isApproved, false, 'unknown cannot list cars');
  });

  await test('getDealerListingBlockReason enforces dealerStatus and explains non-blocking dashboard access', () => {
    assertEqual(getDealerListingBlockReason('active', true, 'approved'), null, 'approved active+verified');
    assertEqual(getDealerListingBlockReason('active', null), null, 'legacy active+null');

    const pendingColReason = getDealerListingBlockReason('active', true, 'pending');
    assert(
      pendingColReason && pendingColReason.toLowerCase().includes('dashboard'),
      'pending dealer_status blocks listing while explaining dashboard access'
    );

    const disapprovedColReason = getDealerListingBlockReason('active', true, 'disapproved');
    assert(
      disapprovedColReason && disapprovedColReason.toLowerCase().includes('dashboard'),
      'disapproved dealer_status blocks listing while explaining dashboard access'
    );

    const pendingReason = getDealerListingBlockReason('pending', false);
    assert(pendingReason && pendingReason.toLowerCase().includes('dashboard'), 'pending explains dashboard access');

    const disapprovedReason = getDealerListingBlockReason('rejected', false);
    assert(
      disapprovedReason && disapprovedReason.toLowerCase().includes('dashboard'),
      'disapproved explains dashboard access remains open'
    );

    const suspendedReason = getDealerListingBlockReason('suspended', false);
    assert(Boolean(suspendedReason), 'suspended returns block message');
  });

  await test('createDealerCar blocks pending and disapproved dealers (including via dealer_status) before inserting into cars', async () => {
    let inserted = false;
    const restorePending = installMockDealerSupabase({
      accountStatus: 'pending',
      isVerified: false,
      dealerStatus: 'pending',
      onCarsInsert: () => {
        inserted = true;
      },
    });
    try {
      const pendingRes = await dealerVehicleService.createDealerCar(SAMPLE_CAR_INPUT, 'dealer-uuid-1', false);
      assertEqual(pendingRes.car, null, 'pending dealer cannot create car');
      assert(Boolean(pendingRes.error), 'pending dealer gets explanation');
      assertEqual(inserted, false, 'pending dealer never hits cars.insert');
    } finally {
      restorePending();
    }

    const restoreDealerStatusDisapproved = installMockDealerSupabase({
      accountStatus: 'active',
      isVerified: true,
      dealerStatus: 'disapproved',
      onCarsInsert: () => {
        inserted = true;
      },
    });
    try {
      const disColRes = await dealerVehicleService.createDealerCar(SAMPLE_CAR_INPUT, 'dealer-uuid-1', false);
      assertEqual(disColRes.car, null, 'dealer_status=disapproved blocks car creation even if active');
      assert(Boolean(disColRes.error), 'dealer_status=disapproved returns block error');
      assertEqual(inserted, false, 'dealer_status=disapproved never hits cars.insert');
    } finally {
      restoreDealerStatusDisapproved();
    }

    const restoreDisapproved = installMockDealerSupabase({
      accountStatus: 'rejected',
      isVerified: false,
      dealerStatus: 'disapproved',
      onCarsInsert: () => {
        inserted = true;
      },
    });
    try {
      const disRes = await dealerVehicleService.createDealerCar(SAMPLE_CAR_INPUT, 'dealer-uuid-1', true);
      assertEqual(disRes.car, null, 'disapproved dealer cannot create draft car');
      assert(Boolean(disRes.error), 'disapproved dealer gets explanation');
      assertEqual(inserted, false, 'disapproved dealer never hits cars.insert');
    } finally {
      restoreDisapproved();
    }
  });

  await test('createDealerCar allows approved dealers (active + verified + approved) to insert into cars', async () => {
    let insertedPayload: any = null;
    const restoreApproved = installMockDealerSupabase({
      accountStatus: 'active',
      isVerified: true,
      dealerStatus: 'approved',
      onCarsInsert: (payload) => {
        insertedPayload = payload;
      },
    });
    try {
      const res = await dealerVehicleService.createDealerCar(SAMPLE_CAR_INPUT, 'dealer-uuid-1', false);
      assertEqual(res.error, null, 'approved dealer insert succeeds');
      assert(insertedPayload !== null, 'cars.insert executed for approved dealer');
      assertEqual(insertedPayload.status, 'PENDING_REVIEW', 'new submitted car enters PENDING_REVIEW');
      assertEqual(insertedPayload.is_verified, false, 'dealer cannot self-verify car');
    } finally {
      restoreApproved();
    }
  });

  await test('updateDealerCar blocks submitting existing car for review when dealer is pending/disapproved', async () => {
    let updated = false;
    const restorePending = installMockDealerSupabase({
      accountStatus: 'pending',
      isVerified: false,
      dealerStatus: 'pending',
      onCarsUpdate: () => {
        updated = true;
      },
    });
    try {
      const res = await dealerVehicleService.updateDealerCar(
        'car-existing-1',
        SAMPLE_CAR_INPUT,
        'dealer-uuid-1',
        false
      );
      assertEqual(res.car, null, 'unapproved dealer cannot submit for review');
      assert(Boolean(res.error), 'returns approval error message');
      assertEqual(updated, false, 'cars.update skipped when unapproved');
    } finally {
      restorePending();
    }
  });

  await test('dealerService.getAllDealerAccountsForAdmin, setDealerApprovalStatus & toggleDealerVerification handle RPC and fallback', async () => {
    const client = supabase as any;
    const originalRpc = client.rpc.bind(client);
    const originalFrom = client.from.bind(client);
    const prevUrl = process.env.VITE_SUPABASE_URL;
    const prevKey = process.env.VITE_SUPABASE_ANON_KEY;
    process.env.VITE_SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';

    // 1. RPC present
    const rpcCalls: Array<{ fn: string; params: any }> = [];
    client.rpc = async (fn: string, params: any = {}) => {
      rpcCalls.push({ fn, params });
      if (fn === 'admin_list_dealer_accounts') {
        return {
          data: [
            {
              dealerId: 'dlr-1',
              dealerAccountId: 'da-1',
              userId: 'u-1',
              hasPortalAccount: true,
              businessName: 'Lagos Auto Hub',
              accountStatus: 'pending',
              dealerStatus: 'pending',
              isVerified: false,
              approvalStatus: 'pending',
              canListCars: false,
              totalVehicles: 0,
              publishedVehicles: 0,
              inReviewVehicles: 0,
            },
          ],
          error: null,
        };
      }
      if (fn === 'admin_set_dealer_approval_status') {
        return { data: { success: true, dealer_id: params.p_dealer_id }, error: null };
      }
      return { data: null, error: null };
    };
    client.from = () => ({
      select: async () => ({
        data: [{ id: 'dlr-1', business_name: 'Lagos Auto Hub', is_verified: true, dealer_status: 'pending' }],
        error: null,
      }),
    });

    try {
      const dir = await dealerService.getAllDealerAccountsForAdmin();
      assertEqual(dir.migrationRequired, false, 'RPC installed -> migrationRequired false');
      assertEqual(dir.accounts.length, 1, 'returns unified dealer record');
      assertEqual(dir.accounts[0].dealerStatus, 'pending', 'preserves pending dealerStatus');
      assertEqual(dir.accounts[0].approvalStatus, 'pending', 'preserves pending approvalStatus');
      assertEqual(dir.accounts[0].canListCars, false, 'pending dealer cannot list cars');

      const act = await dealerService.setDealerApprovalStatus('dlr-1', 'approve', 'Verified showroom');
      assertEqual(act.success, true, 'approve RPC succeeds');
      const setCall = rpcCalls.find((c) => c.fn === 'admin_set_dealer_approval_status');
      assert(setCall !== undefined, 'called admin_set_dealer_approval_status RPC');
      assertEqual(setCall?.params.p_action, 'approve', 'passes approve action');

      const toggleOff = await dealerService.toggleDealerVerification('dlr-1', true, 'Hold verification');
      assertEqual(toggleOff.success, true, 'toggleDealerVerification off succeeds');
      const lastCall = rpcCalls[rpcCalls.length - 1];
      assertEqual(lastCall.params.p_action, 'disapprove', 'toggling from approved dispatches disapprove');

      // 2. Missing RPC fallback (PGRST202)
      client.rpc = async () => ({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function public.admin_list_dealer_accounts' },
      });
      client.from = (table: string) => ({
        select: async () => {
          if (table === 'dealers') {
            return {
              data: [
                {
                  id: 'dlr-2',
                  business_name: 'Island Motors',
                  is_verified: false,
                  dealer_status: 'disapproved',
                },
              ],
              error: null,
            };
          }
          if (table === 'dealer_accounts') {
            return {
              data: [{ id: 'da-2', dealer_id: 'dlr-2', user_id: 'u-2', account_status: 'rejected' }],
              error: null,
            };
          }
          return { data: [], error: null };
        },
      });

      const fallbackDir = await dealerService.getAllDealerAccountsForAdmin();
      assertEqual(fallbackDir.migrationRequired, true, 'missing RPC flags migrationRequired=true');
      assertEqual(fallbackDir.accounts.length, 1, 'fallback merges dealers & dealer_accounts');
      assertEqual(fallbackDir.accounts[0].businessName, 'Island Motors', 'fallback reads business_name');
      assertEqual(fallbackDir.accounts[0].dealerStatus, 'disapproved', 'fallback reads dealer_status');
      assertEqual(fallbackDir.accounts[0].approvalStatus, 'disapproved', 'fallback resolves rejected->disapproved');
    } finally {
      client.rpc = originalRpc;
      client.from = originalFrom;
      if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL;
      else process.env.VITE_SUPABASE_URL = prevUrl;
      if (prevKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
      else process.env.VITE_SUPABASE_ANON_KEY = prevKey;
    }
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    throw new Error(`${failed.length} test(s) failed`);
  }
}

runTests().catch((err) => {
  console.error(err);
  throw err;
});
