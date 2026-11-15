import {
  MissionManager,
  MISSIONS_CATALOG,
  type MissionCheckpointCallback,
} from '../src/components/world/missionEngine';
import { RIVAL_RACE_CHECKPOINTS } from '../src/components/world/lagosCityData';
import {
  dispatchBestEffortPageExitAbandon,
  missionService,
} from '../src/services/missionService';
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

type RpcCall = { fn: string; params: Record<string, unknown> };
type RpcHandler = (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

function installMockRpc(handler: RpcHandler) {
  const calls: RpcCall[] = [];
  const client = supabase as unknown as {
    rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const originalRpc = client.rpc.bind(client);
  client.rpc = async (fn: string, params: Record<string, unknown> = {}) => {
    calls.push({ fn, params });
    return handler(fn, params);
  };
  return {
    calls,
    restore: () => {
      client.rpc = originalRpc;
    },
  };
}

/**
 * Helper wiring MissionManager + missionService together similarly to ManifoldWorldPage,
 * including a simulated player wallet guarded by rewardedRunTokens.
 */
function createWiredHarness() {
  const manager = new MissionManager();
  const wallet = {
    credits: 5000,
    xp: 100,
    missionsCompletedCount: 0,
    badges: [] as string[],
    rewardedRunTokens: new Set<string>(),
  };
  const pendingPromises: Promise<unknown>[] = [];

  const track = <T>(p: Promise<T>): Promise<T> => {
    pendingPromises.push(p);
    return p;
  };

  manager.setCheckpointCallback((missionId, cpIdx, x, z, runToken) => {
    if (!runToken) return;
    track(
      missionService
        .reportCheckpoint({ missionId, runToken, checkpointIndex: cpIdx, x, z })
        .then((res) => {
          manager.applyCheckpointSyncResult(missionId, runToken, cpIdx, res);
        })
    );
  });

  manager.setAbandonCallback((missionId, runToken) => {
    track(
      missionService.abandonMission(missionId, runToken).then((res) => {
        manager.applyServerAbandonResult(missionId, runToken, res);
      })
    );
  });

  manager.setCompletionCallback(
    (missionId, success, passedCredits, passedXp, reason, runToken, telemetry, passedBadge) => {
      // Test assertion: engine must NEVER emit non-zero provisional rewards/badges to callback
      assertEqual(passedCredits, 0, 'callback credits must always be 0 (never provisional)');
      assertEqual(passedXp, 0, 'callback xp must always be 0 (never provisional)');
      assertEqual(passedBadge ?? null, null, 'callback badge must always be null (never provisional)');

      if (!runToken) {
        if (success) {
          manager.applyServerVerificationResult(missionId, runToken, {
            persisted: false,
            reason: 'Missing run token',
          });
        }
        return;
      }

      if (!success) {
        track(
          missionService
            .failMission({ missionId, runToken, failureReason: reason })
            .then((res) => {
              manager.applyServerFailureResult(missionId, runToken, res);
            })
        );
        return;
      }

      track(
        missionService
          .completeMission({
            missionId,
            runToken,
            finalX: telemetry.finalX,
            finalZ: telemetry.finalZ,
            gear: telemetry.gear,
            collisionCount: telemetry.collisionCount,
            finishRank: telemetry.finishRank ?? null,
          })
          .then((res) => {
            manager.applyServerVerificationResult(missionId, runToken, res);
            if (res.persisted && !res.rejected && !wallet.rewardedRunTokens.has(runToken)) {
              wallet.rewardedRunTokens.add(runToken);
              if (typeof res.creditsBalance === 'number') wallet.credits = res.creditsBalance;
              if (typeof res.xpBalance === 'number') wallet.xp = res.xpBalance;
              wallet.missionsCompletedCount += 1;
              if (res.rewardBadge && !wallet.badges.includes(res.rewardBadge)) {
                wallet.badges.push(res.rewardBadge);
              }
            }
          })
      );
    }
  );

  async function flushAll() {
    while (pendingPromises.length > 0) {
      const batch = pendingPromises.splice(0, pendingPromises.length);
      await Promise.all(batch);
    }
  }

  return { manager, wallet, flushAll };
}

async function runTests() {
  const results: Array<{ name: string; ok: boolean; err?: string }> = [];

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`PASS: ${name}`);
    } catch (e: any) {
      results.push({ name, ok: false, err: e?.stack || e?.message || String(e) });
      console.error(`FAIL: ${name}\n`, e);
    }
  }

  // 1. Multi-checkpoint completion with sequential ack & server-persisted rewards
  await test('1. Multi-checkpoint completion with sequential ack and server rewards', async () => {
    const runToken = '11111111-1111-4111-8111-111111111101';
    const def = MISSIONS_CATALOG['FAR_TMB_CHECKPOINT_SPRINT'];
    let lastAck = 0;

    const rpc = installMockRpc(async (fn, params) => {
      if (fn === 'report_game_mission_checkpoint') {
        assertEqual(params.p_checkpoint_index, lastAck, 'checkpoints arrive strictly sequentially');
        lastAck += 1;
        return { data: { success: true, recorded: true, nextCheckpointIndex: lastAck }, error: null };
      }
      if (fn === 'complete_game_mission') {
        assertEqual(lastAck, def.checkpoints.length, 'all checkpoints acked before complete RPC');
        return {
          data: {
            success: true,
            persisted: true,
            checkpointReportsAccepted: true,
            serverVerified: false,
            creditsAwarded: 1450,
            xpAwarded: 420,
            creditsBalance: 6450,
            xpBalance: 520,
            rewardBadge: 'Bridge Sprinter',
          },
          error: null,
        };
      }
      throw new Error(`Unexpected RPC ${fn}`);
    });

    try {
      const { manager, wallet, flushAll } = createWiredHarness();
      manager.openBriefing(def.id);
      manager.startMission(runToken);

      for (const cp of def.checkpoints) {
        manager.update(1, { x: cp.x, z: cp.z, speed: 12, gear: 'D2' });
        await flushAll();
      }
      assertEqual(manager.session?.acknowledgedCheckpointIdx, def.checkpoints.length, 'all CPs acked');

      manager.update(1, { x: def.destX, z: def.destZ, speed: 5, gear: 'D1' });
      assertEqual(manager.session?.state, 'VERIFYING', 'transitions to VERIFYING');
      await flushAll();

      assertEqual(manager.session?.state, 'COMPLETED', 'transitions to COMPLETED');
      assertEqual(manager.session?.resultSummary?.persisted, true, 'persisted flag set');
      assertEqual(manager.session?.resultSummary?.creditsEarned, 1450, 'server credits recorded');
      assertEqual(wallet.credits, 6450, 'wallet updated from server');
      assertEqual(wallet.xp, 520, 'xp updated from server');
      assert(wallet.badges.includes('Bridge Sprinter'), 'badge unlocked from server');
    } finally {
      rpc.restore();
    }
  });

  // 2. MISSION_B_RACE waits for checkpoint 9 (index 9) ack before complete_game_mission
  await test('2. MISSION_B_RACE completes only after CP 9 ack + awards participation badge', async () => {
    const runToken = '11111111-1111-4111-8111-111111111102';
    const recordedIndices: number[] = [];

    const rpc = installMockRpc(async (fn, params) => {
      if (fn === 'report_game_mission_checkpoint') {
        const idx = params.p_checkpoint_index as number;
        recordedIndices.push(idx);
        return { data: { success: true, recorded: true, nextCheckpointIndex: idx + 1 }, error: null };
      }
      if (fn === 'complete_game_mission') {
        assertEqual(recordedIndices.length, RIVAL_RACE_CHECKPOINTS.length, 'all 10 race CPs acked first');
        assertEqual(recordedIndices[9], 9, 'CP index 9 acked before complete_game_mission');
        return {
          data: {
            success: true,
            persisted: true,
            checkpointReportsAccepted: true,
            serverVerified: false,
            creditsAwarded: 1000,
            xpAwarded: 300,
            creditsBalance: 6000,
            xpBalance: 400,
            rewardBadge: 'Mainland Circuit Participant',
          },
          error: null,
        };
      }
      throw new Error(`Unexpected RPC ${fn}`);
    });

    try {
      const { manager, wallet, flushAll } = createWiredHarness();
      manager.openBriefing('MISSION_B_RACE');
      manager.startMission(runToken);
      // Finish 3s countdown -> triggers CP 1 (index 0)
      manager.update(3.5, { x: RIVAL_RACE_CHECKPOINTS[0].x, z: RIVAL_RACE_CHECKPOINTS[0].z, speed: 0 });
      await flushAll();

      for (let i = 1; i < RIVAL_RACE_CHECKPOINTS.length; i++) {
        const cp = RIVAL_RACE_CHECKPOINTS[i];
        manager.onPlayerReachRaceCheckpoint(i + 1, 2, undefined, { x: cp.x, z: cp.z, gear: 'D2' });
        await flushAll();
      }

      assertEqual(manager.session?.state, 'COMPLETED', 'race completed after CP 9 ack');
      assert(
        wallet.badges.includes('Mainland Circuit Participant'),
        'awards Mainland Circuit Participant badge'
      );
      assert(
        !wallet.badges.includes('Mainland Street Champion'),
        'never awards retired champion badge'
      );
    } finally {
      rpc.restore();
    }
  });

  // 3. Checkpoint RPC transient failure -> blocks next CP -> retry succeeds -> completion works
  await test('3. Checkpoint transient failure blocks progression until manual retry succeeds', async () => {
    const runToken = '11111111-1111-4111-8111-111111111103';
    const def = MISSIONS_CATALOG['FAR_LEKKI_COURIER']; // 2 checkpoints
    let cp0Attempts = 0;

    const rpc = installMockRpc(async (fn, params) => {
      if (fn === 'report_game_mission_checkpoint') {
        const idx = params.p_checkpoint_index as number;
        if (idx === 0) {
          cp0Attempts += 1;
          if (cp0Attempts <= 2) {
            // Note: missionService retries once via retryWithBackoff, so fail first 2 attempts
            return { data: null, error: { message: 'Failed to fetch' } };
          }
        }
        return { data: { success: true, recorded: true, nextCheckpointIndex: idx + 1 }, error: null };
      }
      if (fn === 'complete_game_mission') {
        return {
          data: {
            success: true,
            persisted: true,
            creditsAwarded: 1300,
            xpAwarded: 360,
            creditsBalance: 6300,
            xpBalance: 460,
            rewardBadge: null,
          },
          error: null,
        };
      }
      throw new Error(`Unexpected RPC ${fn}`);
    });

    try {
      const { manager, flushAll } = createWiredHarness();
      manager.openBriefing(def.id);
      manager.startMission(runToken);

      // Hit CP 0
      manager.update(1, { x: def.checkpoints[0].x, z: def.checkpoints[0].z, speed: 10 });
      await flushAll();

      assertEqual(manager.session?.currentCheckpointIdx, 1, 'local waypoint advanced');
      assertEqual(manager.session?.acknowledgedCheckpointIdx, 0, 'ack still 0');
      assertEqual(manager.session?.pendingCheckpoint?.status, 'FAILED', 'CP 0 marked FAILED');

      // Player hits CP 1 locally while CP 0 is still FAILED: must buffer CP 1, NOT send it!
      manager.update(1, { x: def.checkpoints[1].x, z: def.checkpoints[1].z, speed: 10 });
      await flushAll();
      const cp1CallsBeforeRetry = rpc.calls.filter(
        (c) => c.fn === 'report_game_mission_checkpoint' && c.params.p_checkpoint_index === 1
      );
      assertEqual(cp1CallsBeforeRetry.length, 0, 'CP 1 blocked until CP 0 acknowledged');

      // Retry CP 0
      manager.retryPendingCheckpoint();
      await flushAll();

      assertEqual(manager.session?.pendingCheckpoint, null, 'all buffered CPs settled');
      assertEqual(manager.session?.acknowledgedCheckpointIdx, 2, 'both CP 0 and CP 1 acked in order');

      manager.update(1, { x: def.destX, z: def.destZ, speed: 4 });
      await flushAll();
      assertEqual(manager.session?.state, 'COMPLETED', 'mission completes after retry');
    } finally {
      rpc.restore();
    }
  });

  // 4. Destination arrival while checkpoint ack failed/pending defers complete_game_mission
  await test('4. Destination arrival waits in VERIFYING until final checkpoint retry is acknowledged', async () => {
    const runToken = '11111111-1111-4111-8111-111111111104';
    const def = MISSIONS_CATALOG['NEAR_OBALENDE_PARCEL']; // 1 checkpoint
    let cp0Calls = 0;

    const rpc = installMockRpc(async (fn) => {
      if (fn === 'report_game_mission_checkpoint') {
        cp0Calls += 1;
        if (cp0Calls <= 2) {
          return { data: null, error: { message: 'Network timeout' } };
        }
        return { data: { success: true, recorded: true, nextCheckpointIndex: 1 }, error: null };
      }
      if (fn === 'complete_game_mission') {
        return {
          data: {
            success: true,
            persisted: true,
            creditsAwarded: 450,
            xpAwarded: 120,
            creditsBalance: 5450,
            xpBalance: 220,
          },
          error: null,
        };
      }
      throw new Error(`Unexpected RPC ${fn}`);
    });

    try {
      const { manager, flushAll } = createWiredHarness();
      manager.openBriefing(def.id);
      manager.startMission(runToken);

      // Reach CP 0 -> fails sync
      manager.update(1, { x: def.checkpoints[0].x, z: def.checkpoints[0].z, speed: 10 });
      await flushAll();
      assertEqual(manager.session?.pendingCheckpoint?.status, 'FAILED', 'CP 0 failed');

      // Arrive at final destination while CP 0 is FAILED
      manager.update(1, { x: def.destX, z: def.destZ, speed: 4 });
      await flushAll();

      assertEqual(manager.session?.state, 'VERIFYING', 'stays in VERIFYING waiting on CP 0');
      assertEqual(
        rpc.calls.filter((c) => c.fn === 'complete_game_mission').length,
        0,
        'complete_game_mission NOT sent before CP 0 ack'
      );

      // Retry CP 0 -> automatically flushes queued completion!
      manager.retryPendingCheckpoint();
      await flushAll();

      assertEqual(
        rpc.calls.filter((c) => c.fn === 'complete_game_mission').length,
        1,
        'complete_game_mission sent automatically once CP 0 acked'
      );
      assertEqual(manager.session?.state, 'COMPLETED', 'mission completes cleanly');
    } finally {
      rpc.restore();
    }
  });

  // 5. Local mission timeout -> fail_game_mission persisted -> 0 rewards
  await test('5. Local timeout persists via fail_game_mission with 0 rewards', async () => {
    const runToken = '11111111-1111-4111-8111-111111111105';
    const rpc = installMockRpc(async (fn, params) => {
      assertEqual(fn, 'fail_game_mission', 'timeout must call fail_game_mission, never abandon/complete');
      assert(String(params.p_failure_reason).includes('Time expired'), 'passes timeout reason');
      return {
        data: { success: true, failed: true, persisted: true, status: 'failed', creditsAwarded: 0, xpAwarded: 0 },
        error: null,
      };
    });

    try {
      const { manager, wallet, flushAll } = createWiredHarness();
      manager.openBriefing('MISSION_A_DELIVERY');
      manager.startMission(runToken, 10);
      manager.update(12, { x: 0, z: -100, speed: 10 });
      assertEqual(manager.session?.state, 'FAILING', 'enters FAILING before server ack');
      await flushAll();

      assertEqual(manager.session?.state, 'FAILED', 'enters FAILED after server ack');
      assertEqual(manager.session?.resultSummary?.persisted, true, 'failure persisted');
      assertEqual(manager.session?.resultSummary?.creditsEarned, 0, 'zero credits');
      assertEqual(wallet.credits, 5000, 'wallet unchanged');
    } finally {
      rpc.restore();
    }
  });

  // 6. Zero-collision violation -> fail_game_mission persisted -> 0 rewards
  await test('6. Zero-collision violation calls fail_game_mission with 0 rewards', async () => {
    const runToken = '11111111-1111-4111-8111-111111111106';
    const rpc = installMockRpc(async (fn, params) => {
      assertEqual(fn, 'fail_game_mission', 'collision breach calls fail_game_mission');
      assert(String(params.p_failure_reason).includes('zero-impact'), 'passes collision reason');
      return {
        data: { success: true, failed: true, persisted: true, status: 'failed' },
        error: null,
      };
    });

    try {
      const { manager, wallet, flushAll } = createWiredHarness();
      manager.openBriefing('FAR_IKOYI_CLEAN_TRANSFER');
      manager.startMission(runToken);
      manager.update(1, { x: 10, z: 10, speed: 20 }, true);
      await flushAll();

      assertEqual(manager.session?.state, 'FAILED', 'transitions to FAILED');
      assertEqual(manager.session?.resultSummary?.persisted, true, 'persisted on server');
      assertEqual(wallet.credits, 5000, 'wallet unchanged');
    } finally {
      rpc.restore();
    }
  });

  // 7. Cargo destruction -> fail_game_mission persisted -> 0 rewards
  await test('7. Cargo destruction calls fail_game_mission with 0 rewards', async () => {
    const runToken = '11111111-1111-4111-8111-111111111107';
    const rpc = installMockRpc(async (fn, params) => {
      assertEqual(fn, 'fail_game_mission', 'cargo destruction calls fail_game_mission');
      assert(String(params.p_failure_reason).includes('Cargo was destroyed'), 'passes cargo reason');
      return {
        data: { success: true, failed: true, persisted: true, status: 'failed' },
        error: null,
      };
    });

    try {
      const { manager, wallet, flushAll } = createWiredHarness();
      manager.openBriefing('MISSION_A_DELIVERY');
      manager.startMission(runToken);
      for (let i = 0; i < 8; i++) {
        manager.update(0.5, { x: 0, z: -100, speed: 15 }, true);
      }
      await flushAll();

      assertEqual(manager.session?.cargoIntegrityPercent, 0, 'cargo integrity hits 0');
      assertEqual(manager.session?.state, 'FAILED', 'transitions to FAILED');
      assertEqual(manager.session?.resultSummary?.persisted, true, 'persisted on server');
      assertEqual(wallet.credits, 5000, 'wallet unchanged');
    } finally {
      rpc.restore();
    }
  });

  // 8. fail_game_mission network failure -> Retry Failure Sync -> eventual persistence
  await test('8. fail_game_mission network failure enters FAILURE_SYNC_FAILED and retries cleanly', async () => {
    const runToken = '11111111-1111-4111-8111-111111111108';
    let attempts = 0;

    const rpc = installMockRpc(async (fn) => {
      assertEqual(fn, 'fail_game_mission', 'only calls fail_game_mission');
      attempts += 1;
      if (attempts <= 2) {
        return { data: null, error: { message: 'Failed to fetch' } };
      }
      return {
        data: { success: true, failed: true, persisted: true, status: 'failed', failureReason: 'Time expired before completing the objective.' },
        error: null,
      };
    });

    try {
      const { manager, flushAll } = createWiredHarness();
      manager.openBriefing('MISSION_A_DELIVERY');
      manager.startMission(runToken, 5);
      manager.update(6, { x: 0, z: -100, speed: 5 });
      await flushAll();

      assertEqual(manager.session?.state, 'FAILURE_SYNC_FAILED', 'enters FAILURE_SYNC_FAILED on network error');
      assertEqual(manager.session?.resultSummary?.persisted, false, 'persisted false before retry');

      manager.retryFailureSubmission();
      assertEqual(manager.session?.state, 'FAILING', 'transitions back to FAILING');
      await flushAll();

      assertEqual(manager.session?.state, 'FAILED', 'persisted after retry');
      assertEqual(manager.session?.resultSummary?.persisted, true, 'persisted true after retry');
    } finally {
      rpc.restore();
    }
  });

  // 9. Abandonment succeeds -> local session cleared ONLY after confirmation
  await test('9. Abandonment clears local session only after server confirmation', async () => {
    const runToken = '11111111-1111-4111-8111-111111111109';
    let resolveRpc!: (val: { data: unknown; error: null }) => void;

    const rpc = installMockRpc(async (fn, params) => {
      assertEqual(fn, 'abandon_game_mission', 'calls abandon_game_mission');
      assertEqual(params.p_run_token, runToken, 'captures runToken before clearing');
      return new Promise((resolve) => {
        resolveRpc = resolve;
      });
    });

    try {
      const { manager, flushAll } = createWiredHarness();
      manager.openBriefing('MISSION_A_DELIVERY');
      manager.startMission(runToken);

      const res = manager.abandonMission();
      assertEqual(res.cleared, false, 'must NOT clear before server confirms');
      assertEqual(manager.session?.state, 'ABANDONING', 'state is ABANDONING while waiting');
      assertEqual(manager.session?.runToken, runToken, 'runToken preserved while ABANDONING');

      await new Promise((r) => setTimeout(r, 10));
      resolveRpc({ data: { success: true, abandoned: true }, error: null });
      await flushAll();

      assertEqual(manager.session, null, 'session cleared after abandoned: true');
    } finally {
      rpc.restore();
    }
  });

  // 10. Abandonment network failure -> session preserved -> Retry Abandonment succeeds
  await test('10. Abandonment network failure preserves session until Retry Abandonment succeeds', async () => {
    const runToken = '11111111-1111-4111-8111-111111111110';
    let callCount = 0;

    const rpc = installMockRpc(async (fn) => {
      assertEqual(fn, 'abandon_game_mission', 'calls abandon_game_mission');
      callCount += 1;
      if (callCount === 1) {
        return { data: null, error: { message: 'Network error' } };
      }
      return { data: { success: true, abandoned: true }, error: null };
    });

    try {
      const { manager, flushAll } = createWiredHarness();
      manager.openBriefing('MISSION_A_DELIVERY');
      manager.startMission(runToken);

      manager.abandonMission();
      await flushAll();

      assert(manager.session !== null, 'session NOT silently discarded on network failure');
      assertEqual(manager.session?.state, 'ABANDON_FAILED', 'enters ABANDON_FAILED');
      assertEqual(manager.session?.runToken, runToken, 'retains runToken for retry');

      manager.retryAbandonment();
      assertEqual(manager.session?.state, 'ABANDONING', 're-enters ABANDONING');
      await flushAll();

      assertEqual(manager.session, null, 'session cleared after Retry Abandonment succeeds');
      assertEqual(callCount, 2, 'invoked RPC twice');
    } finally {
      rpc.restore();
    }
  });

  // 11. complete_game_mission returns persisted: false (network error) -> Retry Submission succeeds
  await test('11. Unpersisted completion failure (persisted: false) allows Retry Submission without cache lock', async () => {
    const runToken = '11111111-1111-4111-8111-111111111111';
    const def = MISSIONS_CATALOG['MISSION_A_DELIVERY'];
    let completeCalls = 0;

    const rpc = installMockRpc(async (fn) => {
      assertEqual(fn, 'complete_game_mission', 'calls complete_game_mission');
      completeCalls += 1;
      if (completeCalls === 1) {
        return { data: null, error: { message: 'RequestTimeoutError: Complete mission timed out' } };
      }
      return {
        data: {
          success: true,
          persisted: true,
          creditsAwarded: 500,
          xpAwarded: 150,
          creditsBalance: 5500,
          xpBalance: 250,
          rewardBadge: null,
        },
        error: null,
      };
    });

    try {
      const { manager, wallet, flushAll } = createWiredHarness();
      manager.openBriefing(def.id);
      manager.startMission(runToken);
      manager.update(1, { x: def.destX, z: def.destZ, speed: 5 });
      await flushAll();

      assertEqual(manager.session?.state, 'VERIFICATION_FAILED', 'enters VERIFICATION_FAILED');
      assertEqual(wallet.credits, 5000, 'no credits awarded before persistence');

      manager.retryCompletionSubmission();
      assertEqual(manager.session?.state, 'VERIFYING', 'transitions back to VERIFYING');
      await flushAll();

      assertEqual(completeCalls, 2, 'retry was NOT blocked by 30s cache');
      assertEqual(manager.session?.state, 'COMPLETED', 'completes on retry');
      assertEqual(wallet.credits, 5500, 'credits applied after retry succeeds');
    } finally {
      rpc.restore();
    }
  });

  // 12. complete_game_mission returns persisted: true, rejected: true -> terminal FAILED, 0 rewards
  await test('12. Server-rejected completion (persisted: true, rejected: true) enters FAILED with 0 rewards', async () => {
    const runToken = '11111111-1111-4111-8111-111111111112';
    const def = MISSIONS_CATALOG['NEAR_PRECISION_PARK'];

    const rpc = installMockRpc(async () => ({
      data: {
        success: false,
        persisted: true,
        creditsAwarded: 0,
        xpAwarded: 0,
        creditsBalance: 5000,
        xpBalance: 100,
        rewardBadge: null,
        reason: 'Server time limit exceeded before destination arrival',
      },
      error: null,
    }));

    try {
      const { manager, wallet, flushAll } = createWiredHarness();
      manager.openBriefing(def.id);
      manager.startMission(runToken);
      manager.update(1, { x: def.destX, z: def.destZ, speed: 0.5, gear: 'P' });
      await flushAll();

      assertEqual(manager.session?.state, 'FAILED', 'rejected run is terminal FAILED');
      assertEqual(manager.session?.resultSummary?.persisted, true, 'rejection persisted');
      assertEqual(manager.session?.resultSummary?.creditsEarned, 0, 'zero credits earned');
      assertEqual(manager.session?.rewardClaimed, false, 'rewardClaimed is false');
      assertEqual(wallet.credits, 5000, 'wallet unchanged');
      assertEqual(wallet.missionsCompletedCount, 0, 'completed count unchanged');
    } finally {
      rpc.restore();
    }
  });

  // 13. Duplicate completion/checkpoint/abandon calls do not double-credit or send duplicate RPCs
  await test('13. Duplicate completion, checkpoint, and abandon calls are deduplicated cleanly', async () => {
    const runToken = '11111111-1111-4111-8111-111111111113';
    const def = MISSIONS_CATALOG['NEAR_OBALENDE_PARCEL'];

    const rpc = installMockRpc(async (fn) => {
      await new Promise((r) => setTimeout(r, 15));
      if (fn === 'report_game_mission_checkpoint') {
        return { data: { success: true, recorded: true, nextCheckpointIndex: 1 }, error: null };
      }
      if (fn === 'complete_game_mission') {
        return {
          data: {
            success: true,
            persisted: true,
            creditsAwarded: 450,
            xpAwarded: 120,
            creditsBalance: 5450,
            xpBalance: 220,
          },
          error: null,
        };
      }
      if (fn === 'abandon_game_mission') {
        return { data: { success: true, abandoned: true }, error: null };
      }
      throw new Error(`Unexpected RPC ${fn}`);
    });

    try {
      const { manager, wallet, flushAll } = createWiredHarness();
      manager.openBriefing(def.id);
      manager.startMission(runToken);

      // Trigger same checkpoint via service concurrently -> should call RPC once
      const [cpA, cpB] = await Promise.all([
        missionService.reportCheckpoint({ missionId: def.id, runToken, checkpointIndex: 0, x: 105, z: 0 }),
        missionService.reportCheckpoint({ missionId: def.id, runToken, checkpointIndex: 0, x: 105, z: 0 }),
      ]);
      assert(cpA.recorded && cpB.recorded, 'both callers receive recorded result');
      assertEqual(
        rpc.calls.filter((c) => c.fn === 'report_game_mission_checkpoint').length,
        1,
        'checkpoint RPC invoked only once'
      );

      // Trigger concurrent completions -> only 1 RPC and no double-crediting
      const [c1, c2] = await Promise.all([
        missionService.completeMission({ missionId: def.id, runToken, finalX: def.destX, finalZ: def.destZ, gear: 'D1', collisionCount: 0 }),
        missionService.completeMission({ missionId: def.id, runToken, finalX: def.destX, finalZ: def.destZ, gear: 'D1', collisionCount: 0 }),
      ]);
      assert(c1.persisted && c2.persisted, 'both completion callers settle cleanly');
      assertEqual(
        rpc.calls.filter((c) => c.fn === 'complete_game_mission').length,
        1,
        'complete_game_mission invoked only once'
      );

      // Drive through CP 0 and destination via manager -> uses cached/deduped ack & completion without double credit
      manager.update(1, { x: def.checkpoints[0].x, z: def.checkpoints[0].z, speed: 10 });
      await flushAll();
      manager.update(1, { x: def.destX, z: def.destZ, speed: 5 });
      await flushAll();
      assertEqual(wallet.credits, 5450, 'wallet credited once');
      assertEqual(wallet.missionsCompletedCount, 1, 'completion count incremented once');

      // Duplicate abandon call deduplication on fresh run
      const runToken2 = '11111111-1111-4111-8111-111111111114';
      const [a1, a2] = await Promise.all([
        missionService.abandonMission(def.id, runToken2),
        missionService.abandonMission(def.id, runToken2),
      ]);
      assert(a1.abandoned && a2.abandoned, 'both abandon callers succeed');
      assertEqual(
        rpc.calls.filter((c) => c.fn === 'abandon_game_mission').length,
        1,
        'abandon_game_mission invoked only once'
      );
    } finally {
      rpc.restore();
    }
  });

  // 14. Provisional briefing / preview values never leak into player credits/XP/badges
  await test('14. Provisional briefing values never mutate wallet before server confirmation', async () => {
    const runToken = '11111111-1111-4111-8111-111111111115';
    const def = MISSIONS_CATALOG['VFAR_ISLAND_TO_EPE']; // 2800 MC provisional preview

    const rpc = installMockRpc(async (fn) => {
      if (fn === 'report_game_mission_checkpoint') {
        return { data: { success: true, recorded: true }, error: null };
      }
      // Server returns different authoritative balance/reward than local briefing preview
      return {
        data: {
          success: true,
          persisted: true,
          creditsAwarded: 3100,
          xpAwarded: 900,
          creditsBalance: 8100,
          xpBalance: 1000,
          rewardBadge: 'Epe Voyager',
        },
        error: null,
      };
    });

    try {
      const { manager, wallet, flushAll } = createWiredHarness();
      const briefing = manager.openBriefing(def.id);
      assertEqual(briefing.provisionalRewardPreview.credits, 2800, 'briefing shows provisional preview');
      assertEqual(wallet.credits, 5000, 'wallet untouched during briefing');

      manager.startMission(runToken);
      for (const cp of def.checkpoints) {
        manager.update(1, { x: cp.x, z: cp.z, speed: 12 });
        await flushAll();
      }
      // Before server responds, resultSummary must remain 0
      manager.update(1, { x: def.destX, z: def.destZ, speed: 4 });
      assertEqual(manager.session?.state, 'VERIFYING', 'in VERIFYING state');
      assertEqual(manager.session?.resultSummary?.creditsEarned, 0, '0 earned while VERIFYING');
      assertEqual(wallet.credits, 5000, 'wallet still untouched while VERIFYING');

      await flushAll();
      // Wallet and resultSummary reflect authoritative server payout (3100), not local provisional (2800)
      assertEqual(manager.session?.resultSummary?.creditsEarned, 3100, 'uses server creditsAwarded');
      assertEqual(wallet.credits, 8100, 'uses server creditsBalance');
      assertEqual(wallet.xp, 1000, 'uses server xpBalance');
    } finally {
      rpc.restore();
    }
  });

  // 15. fail_game_mission returning alreadyFinalized for completed or unknown status
  await test('15. Failure response on already-completed run reconciles to COMPLETED without double-crediting (and rejects unknown status)', async () => {
    const runToken = '11111111-1111-4111-8111-111111111116';
    let rpcMode: 'completed' | 'unknown' = 'completed';

    const rpc = installMockRpc(async (fn) => {
      assertEqual(fn, 'fail_game_mission', 'must NEVER invoke complete_game_mission during reconciliation');
      if (rpcMode === 'unknown') {
        return {
          data: {
            success: false,
            failed: false,
            persisted: false,
            alreadyFinalized: true,
            status: 'mystery_state',
            reason: 'Corrupt or unexpected state',
          },
          error: null,
        };
      }
      return {
        data: {
          success: false,
          failed: false,
          persisted: false,
          alreadyFinalized: true,
          status: 'completed',
          creditsAwarded: 500,
          xpAwarded: 150,
          reason: 'Mission run is already finalized as completed',
        },
        error: null,
      };
    });

    try {
      // Part A: alreadyFinalized + status='completed' -> COMPLETED without invoking complete_game_mission or adding credits
      const { manager, wallet, flushAll } = createWiredHarness();
      manager.openBriefing('MISSION_A_DELIVERY');
      manager.startMission(runToken, 5);
      manager.update(6, { x: 0, z: -100, speed: 5 });
      await flushAll();

      assertEqual(manager.session?.state, 'COMPLETED', 'reconciles to COMPLETED');
      assertEqual(manager.session?.rewardClaimed, true, 'marks rewardClaimed true');
      assertEqual(manager.session?.resultSummary?.persisted, true, 'persisted true');
      assertEqual(manager.session?.resultSummary?.creditsEarned, 500, 'preserves server creditsEarned summary');
      assertEqual(
        rpc.calls.filter((c) => c.fn === 'complete_game_mission').length,
        0,
        'never calls complete_game_mission'
      );
      assertEqual(wallet.credits, 5000, 'does not locally double-credit wallet');

      // Part B: alreadyFinalized + unknown status -> preserves session in FAILURE_SYNC_FAILED with reconciliation error
      rpcMode = 'unknown';
      const runTokenUnknown = '11111111-1111-4111-8111-111111111117';
      const h2 = createWiredHarness();
      h2.manager.openBriefing('MISSION_A_DELIVERY');
      h2.manager.startMission(runTokenUnknown, 5);
      h2.manager.update(6, { x: 0, z: -100, speed: 5 });
      await h2.flushAll();

      assert(h2.manager.session !== null, 'session preserved on unknown finalized status');
      assertEqual(h2.manager.session?.state, 'FAILURE_SYNC_FAILED', 'enters FAILURE_SYNC_FAILED');
      assert(
        String(h2.manager.session?.resultSummary?.message).includes('Reconciliation error'),
        'shows explicit reconciliation error'
      );

      // Part C: alreadyFinalized: true alone without status NEVER transitions to FAILED
      const directResult = h2.manager.applyServerFailureResult('MISSION_A_DELIVERY', runTokenUnknown, {
        persisted: true,
        alreadyFinalized: true,
      });
      assertEqual(directResult?.state, 'FAILURE_SYNC_FAILED', 'missing status is rejected as reconciliation error');
    } finally {
      rpc.restore();
    }
  });

  // 16. Failure response on already-abandoned run clears local session cleanly
  await test('16. Failure response on already-abandoned run clears local session', async () => {
    const runToken = '11111111-1111-4111-8111-111111111118';

    const rpc = installMockRpc(async (fn) => {
      assertEqual(fn, 'fail_game_mission', 'calls fail_game_mission');
      return {
        data: {
          success: false,
          failed: false,
          persisted: false,
          alreadyFinalized: true,
          status: 'abandoned',
          creditsAwarded: 0,
          xpAwarded: 0,
          reason: 'Mission run is already finalized as abandoned',
        },
        error: null,
      };
    });

    try {
      const { manager, wallet, flushAll } = createWiredHarness();
      manager.openBriefing('MISSION_A_DELIVERY');
      manager.startMission(runToken, 5);
      manager.update(6, { x: 0, z: -100, speed: 5 });
      await flushAll();

      assertEqual(manager.session, null, 'session cleared when server reports already abandoned');
      assertEqual(wallet.credits, 5000, 'wallet untouched');
    } finally {
      rpc.restore();
    }
  });

  // 17. Permanent vs network checkpoint rejections (and expired run cannot resume)
  await test('17. Permanent checkpoint rejection blocks stale retry while network failure remains retryable; expired stays FAILED', async () => {
    const runTokenPerm = '11111111-1111-4111-8111-111111111119';
    const def = MISSIONS_CATALOG['FAR_LEKKI_COURIER'];

    const rpc = installMockRpc(async (fn) => {
      assertEqual(fn, 'report_game_mission_checkpoint', 'calls checkpoint RPC');
      return {
        data: {
          success: false,
          recorded: false,
          distanceFromCheckpoint: 42.5,
          message: 'Vehicle outside checkpoint verification zone',
        },
        error: null,
      };
    });

    try {
      const { manager, flushAll } = createWiredHarness();
      manager.openBriefing(def.id);
      manager.startMission(runTokenPerm);

      // Hit CP 0 with server permanent rejection
      manager.update(1, { x: def.checkpoints[0].x, z: def.checkpoints[0].z, speed: 12 });
      await flushAll();

      assertEqual(manager.session?.pendingCheckpoint?.status, 'FAILED', 'CP marked FAILED');
      assertEqual(manager.session?.pendingCheckpoint?.failureType, 'PERMANENT', 'classified as PERMANENT');
      assertEqual(manager.session?.pendingCheckpoint?.retryable, false, 'marked non-retryable');
      assertEqual(rpc.calls.length, 1, 'RPC called once (no backoff retry on permanent rejection)');

      // Attempting retryPendingCheckpoint() MUST NOT resubmit identical stale coordinates
      manager.retryPendingCheckpoint();
      await flushAll();
      assertEqual(rpc.calls.length, 1, 'retryPendingCheckpoint refused to resubmit permanent rejection');

      // Expired checkpoint result stays terminal FAILED and recoverPermanentCheckpoint cannot resume it
      manager.applyCheckpointSyncResult(def.id, runTokenPerm, 0, {
        recorded: false,
        expired: true,
        message: 'Mission time limit exceeded on server',
      });
      assertEqual(manager.session?.state, 'FAILED', 'expired run transitions to FAILED');
      manager.recoverPermanentCheckpoint();
      assertEqual(manager.session?.state, 'FAILED', 'expired run MUST never resume');
    } finally {
      rpc.restore();
    }
  });

  // 18. Recovery after permanent checkpoint rejection rewinds & accepts fresh valid checkpoint report
  await test('18. Permanent checkpoint rejection recovers cleanly via Re-drive and completes with fresh coordinates', async () => {
    const runToken = '11111111-1111-4111-8111-111111111120';
    const def = MISSIONS_CATALOG['NEAR_OBALENDE_PARCEL']; // 1 checkpoint
    let cpAttempt = 0;

    const rpc = installMockRpc(async (fn) => {
      if (fn === 'report_game_mission_checkpoint') {
        cpAttempt += 1;
        if (cpAttempt === 1) {
          return {
            data: {
              success: false,
              recorded: false,
              message: 'Checkpoint transition faster than plausible vehicle travel time',
            },
            error: null,
          };
        }
        return { data: { success: true, recorded: true, nextCheckpointIndex: 1 }, error: null };
      }
      if (fn === 'complete_game_mission') {
        return {
          data: {
            success: true,
            persisted: true,
            creditsAwarded: 450,
            xpAwarded: 120,
            creditsBalance: 5450,
            xpBalance: 220,
          },
          error: null,
        };
      }
      throw new Error(`Unexpected RPC ${fn}`);
    });

    try {
      const { manager, wallet, flushAll } = createWiredHarness();
      manager.openBriefing(def.id);
      manager.startMission(runToken);

      // Reach CP 0 -> permanently rejected
      manager.update(1, { x: def.checkpoints[0].x, z: def.checkpoints[0].z, speed: 12 });
      await flushAll();
      // Even if player enters destination while permanent failure pending (state becomes VERIFYING)
      manager.update(1, { x: def.destX, z: def.destZ, speed: 4 });
      assertEqual(manager.session?.state, 'VERIFYING', 'enters VERIFYING while awaiting CP 0');

      // Recover permanent checkpoint -> rewinds back to ACTIVE at CP 0
      manager.recoverPermanentCheckpoint();
      assertEqual(manager.session?.state, 'ACTIVE', 'rewinds VERIFYING back to ACTIVE');
      assertEqual(manager.session?.pendingCheckpoint, null, 'clears failed pendingCheckpoint');
      assertEqual(manager.session?.currentCheckpointIdx, 0, 'rewinds currentCheckpointIdx to acknowledgedCheckpointIdx');
      assertEqual(manager.session?.completionSubmitted, false, 'resets completionSubmitted for fresh completion');

      // Drive freshly through CP 0 -> succeeds!
      manager.update(2, { x: def.checkpoints[0].x, z: def.checkpoints[0].z, speed: 10 });
      await flushAll();
      assertEqual(manager.session?.acknowledgedCheckpointIdx, 1, 'fresh CP 0 accepted by server');

      // Arrive at destination -> completes!
      manager.update(2, { x: def.destX, z: def.destZ, speed: 4 });
      await flushAll();
      assertEqual(manager.session?.state, 'COMPLETED', 'mission completes after fresh checkpoint');
      assertEqual(wallet.credits, 5450, 'credits applied cleanly');
    } finally {
      rpc.restore();
    }
  });

  // 19. Duplicate failure submission is deduplicated cleanly & alreadyFinalized status='failed' converges
  await test('19. Duplicate failure submission is deduplicated and repeated failure returns FAILED cleanly', async () => {
    const runToken = '11111111-1111-4111-8111-111111111121';
    let failRpcCount = 0;

    const rpc = installMockRpc(async (fn) => {
      assertEqual(fn, 'fail_game_mission', 'only calls fail_game_mission');
      failRpcCount += 1;
      await new Promise((r) => setTimeout(r, 15));
      if (failRpcCount === 1) {
        return {
          data: {
            success: true,
            failed: true,
            persisted: true,
            status: 'failed',
            failureReason: 'Time expired',
            creditsAwarded: 0,
            xpAwarded: 0,
          },
          error: null,
        };
      }
      return {
        data: {
          success: true,
          failed: true,
          persisted: true,
          alreadyFinalized: true,
          status: 'failed',
          failureReason: 'Time expired',
          creditsAwarded: 0,
          xpAwarded: 0,
        },
        error: null,
      };
    });

    try {
      const { manager, flushAll } = createWiredHarness();
      manager.openBriefing('MISSION_A_DELIVERY');
      manager.startMission(runToken, 5);

      const [f1, f2] = await Promise.all([
        missionService.failMission({ missionId: 'MISSION_A_DELIVERY', runToken, failureReason: 'Time expired' }),
        missionService.failMission({ missionId: 'MISSION_A_DELIVERY', runToken, failureReason: 'Time expired' }),
      ]);
      assert(f1.persisted && f2.persisted, 'both concurrent callers settle');
      assertEqual(failRpcCount, 1, 'concurrent failMission calls share one RPC');

      // Manager updates on timeout while server already finalized as 'failed'
      manager.update(6, { x: 0, z: -100, speed: 5 });
      await flushAll();
      assertEqual(manager.session?.state, 'FAILED', 'converges cleanly to FAILED');
      assertEqual(manager.session?.resultSummary?.persisted, true, 'persisted remains true');
    } finally {
      rpc.restore();
    }
  });

  // 20. Server-committed completion with lost response followed by safe idempotent retry
  await test('20. Server-committed completion with lost response retries idempotently without double-crediting', async () => {
    const runToken = '11111111-1111-4111-8111-111111111122';
    const def = MISSIONS_CATALOG['MISSION_A_DELIVERY'];
    let serverDbCredits = 5000;
    let serverDbXp = 100;
    let serverRunStatus: 'in_progress' | 'completed' = 'in_progress';
    let serverRewardClaimed = false;
    let completeCallNum = 0;

    const rpc = installMockRpc(async (fn) => {
      assertEqual(fn, 'complete_game_mission', 'calls complete_game_mission');
      completeCallNum += 1;

      if (completeCallNum === 1) {
        // Server commits DB transaction + reward once, then HTTP response drops before reaching client!
        serverRunStatus = 'completed';
        serverRewardClaimed = true;
        serverDbCredits += 500;
        serverDbXp += 150;
        return { data: null, error: { message: 'Failed to fetch (lost response)' } };
      }

      // 2nd call: server sees status = 'completed' AND reward_claimed_at IS NOT NULL -> idempotent replay
      assertEqual(serverRunStatus, 'completed', 'run already completed on server');
      assertEqual(serverRewardClaimed, true, 'reward already claimed on server');
      return {
        data: {
          success: true,
          persisted: true,
          alreadyFinalized: true,
          checkpointReportsAccepted: true,
          serverVerified: false,
          creditsAwarded: 500,
          xpAwarded: 150,
          creditsBalance: serverDbCredits,
          xpBalance: serverDbXp,
          rewardBadge: null,
        },
        error: null,
      };
    });

    try {
      const { manager, wallet, flushAll } = createWiredHarness();
      manager.openBriefing(def.id);
      manager.startMission(runToken);

      manager.update(1, { x: def.destX, z: def.destZ, speed: 5 });
      await flushAll();

      // Response was lost -> client waits in VERIFICATION_FAILED and wallet is untouched locally
      assertEqual(manager.session?.state, 'VERIFICATION_FAILED', 'enters VERIFICATION_FAILED when response lost');
      assertEqual(manager.session?.rewardClaimed, false, 'rewardClaimed stays false until client gets confirmation');
      assertEqual(wallet.credits, 5000, 'local wallet not mutated on lost response');

      // Player retries submission -> idempotent server response returns already-committed payout
      manager.retryCompletionSubmission();
      await flushAll();

      assertEqual(completeCallNum, 2, 'retry hit server again');
      assertEqual(serverDbCredits, 5500, 'server DB credited exactly once (not 6000)');
      assertEqual(serverDbXp, 250, 'server XP credited exactly once');
      assertEqual(manager.session?.state, 'COMPLETED', 'client transitions to COMPLETED');
      assertEqual(manager.session?.rewardClaimed, true, 'rewardClaimed set to true');
      assertEqual(wallet.credits, 5500, 'client wallet matches authoritative server balance');
      assertEqual(wallet.missionsCompletedCount, 1, 'completion count incremented once');
    } finally {
      rpc.restore();
    }
  });

  // 21. Page-exit keepalive deduplication + finalized status reconciliation on abandon
  await test('21. Page-exit keepalive deduplicates duplicate unload events without clearing local state, and abandon reconciles finalized status', async () => {
    const runToken = '11111111-1111-4111-8111-111111111123';
    const sentTokens = new Set<string>();
    const fetchCalls: Array<{ url: string; keepalive?: boolean }> = [];

    const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(input), keepalive: init?.keepalive });
      return new Response(JSON.stringify({ success: true, abandoned: true }), { status: 200 });
    }) as typeof fetch;

    const { manager, flushAll } = createWiredHarness();
    manager.openBriefing('MISSION_A_DELIVERY');
    manager.startMission(runToken);

    const activeRun = { missionId: 'MISSION_A_DELIVERY', runToken };
    const sent1 = dispatchBestEffortPageExitAbandon({
      run: activeRun,
      sentTokens,
      supabaseUrl: 'https://test.supabase.co',
      publishableKey: 'test-anon-key',
      accessToken: 'jwt-token',
      fetchImpl: mockFetch,
    });
    // Simulate duplicate beforeunload + React unmount firing right after pagehide
    const sent2 = dispatchBestEffortPageExitAbandon({
      run: activeRun,
      sentTokens,
      supabaseUrl: 'https://test.supabase.co',
      publishableKey: 'test-anon-key',
      accessToken: 'jwt-token',
      fetchImpl: mockFetch,
    });

    assertEqual(sent1, true, 'first page-exit keepalive dispatched');
    assertEqual(sent2, false, 'duplicate page-exit event deduplicated');
    assertEqual(fetchCalls.length, 1, 'only 1 keepalive request sent');
    assertEqual(fetchCalls[0].keepalive, true, 'keepalive flag set');
    assertEqual(manager.session?.state, 'ACTIVE', 'keepalive does NOT prematurely clear or mutate local MissionManager state');

    // Now test abandon reconciliation across completed / failed / unknown statuses
    let abandonStatus: 'completed' | 'failed' | 'mystery' = 'completed';
    const rpc = installMockRpc(async () => {
      if (abandonStatus === 'completed') {
        return {
          data: {
            success: false,
            abandoned: false,
            alreadyFinalized: true,
            status: 'completed',
            creditsAwarded: 500,
            xpAwarded: 150,
          },
          error: null,
        };
      }
      if (abandonStatus === 'failed') {
        return {
          data: {
            success: false,
            abandoned: false,
            alreadyFinalized: true,
            status: 'failed',
            failureReason: 'Server deadline elapsed',
          },
          error: null,
        };
      }
      return {
        data: {
          success: false,
          abandoned: false,
          alreadyFinalized: true,
          status: 'mystery',
        },
        error: null,
      };
    });

    try {
      // Completed status on abandon -> COMPLETED
      manager.abandonMission();
      await flushAll();
      assertEqual(manager.session?.state, 'COMPLETED', 'abandon reconciles completed run to COMPLETED');

      // Failed status on abandon -> FAILED
      abandonStatus = 'failed';
      const token2 = '11111111-1111-4111-8111-111111111124';
      manager.openBriefing('MISSION_A_DELIVERY');
      manager.startMission(token2);
      manager.abandonMission();
      await flushAll();
      assertEqual(manager.session?.state, 'FAILED', 'abandon reconciles failed run to FAILED');

      // Unknown finalized status on abandon -> ABANDON_FAILED reconciliation error
      abandonStatus = 'mystery';
      const token3 = '11111111-1111-4111-8111-111111111125';
      manager.openBriefing('MISSION_A_DELIVERY');
      manager.startMission(token3);
      manager.abandonMission();
      await flushAll();
      assertEqual(manager.session?.state, 'ABANDON_FAILED', 'unknown status stays in ABANDON_FAILED');
      assert(
        String(manager.session?.resultSummary?.message).includes('Reconciliation error'),
        'shows reconciliation error on unknown abandon status'
      );
    } finally {
      rpc.restore();
    }
  });

  // 22. Completion retry after mission deactivation + original rewardBadge historical consistency
  await test('22. Completion retry after mission deactivation returns original credits/XP/badge without double-crediting', async () => {
    const runToken = '11111111-1111-4111-8111-111111111126';
    const def = MISSIONS_CATALOG['FAR_TMB_CHECKPOINT_SPRINT']; // Bridge Sprinter badge
    const missionOverrides: Record<string, Partial<typeof def>> = {
      [def.id]: { is_active: true, rewardBadge: 'Bridge Sprinter' },
    };
    let serverRunStatus: 'in_progress' | 'completed' = 'in_progress';
    let serverRewardBadgeAwarded: string | null = null;
    let serverDbCredits = 5000;
    let serverDbXp = 100;
    let completeCalls = 0;

    const rpc = installMockRpc(async (fn) => {
      if (fn === 'report_game_mission_checkpoint') {
        return { data: { success: true, recorded: true }, error: null };
      }
      assertEqual(fn, 'complete_game_mission', 'calls complete_game_mission');
      completeCalls += 1;

      if (completeCalls === 1) {
        // Server commits payout & original badge BEFORE mission is later deactivated/edited, then HTTP drops
        serverRunStatus = 'completed';
        serverRewardBadgeAwarded = 'Bridge Sprinter';
        serverDbCredits += 1450;
        serverDbXp += 420;
        return { data: null, error: { message: 'Failed to fetch (dropped response)' } };
      }

      // Even though mission catalog was deactivated (is_active: false) and reward_badge edited,
      // server returns exact persisted reward_badge_awarded from player_mission_progress
      assertEqual(missionOverrides[def.id].is_active, false, 'mission deactivated before retry');
      assertEqual(serverRunStatus, 'completed', 'run already completed');
      return {
        data: {
          success: true,
          persisted: true,
          alreadyFinalized: true,
          checkpointReportsAccepted: true,
          serverVerified: false,
          creditsAwarded: 1450,
          xpAwarded: 420,
          creditsBalance: serverDbCredits,
          xpBalance: serverDbXp,
          rewardBadge: serverRewardBadgeAwarded,
        },
        error: null,
      };
    });

    try {
      const { manager, wallet, flushAll } = createWiredHarness();
      manager.openBriefing(def.id, missionOverrides);
      manager.startMission(runToken, undefined, missionOverrides);

      for (const cp of def.checkpoints) {
        manager.update(1, { x: cp.x, z: cp.z, speed: 12 }, false, missionOverrides);
        await flushAll();
      }

      manager.update(1, { x: def.destX, z: def.destZ, speed: 5 }, false, missionOverrides);
      await flushAll();
      assertEqual(manager.session?.state, 'VERIFICATION_FAILED', 'lost response puts client in VERIFICATION_FAILED');
      assertEqual(wallet.credits, 5000, 'wallet untouched before confirmed retry');

      // Simulate admin deactivating mission and changing/clearing catalog reward_badge before retry
      missionOverrides[def.id] = { is_active: false, rewardBadge: 'Mutated Admin Badge' };

      manager.retryCompletionSubmission();
      await flushAll();

      assertEqual(completeCalls, 2, 'retry sent complete_game_mission');
      assertEqual(manager.session?.state, 'COMPLETED', 'reconciled to COMPLETED despite mission deactivation');
      assertEqual(manager.session?.resultSummary?.rewardBadge, 'Bridge Sprinter', 'preserves original awarded badge');
      assertEqual(serverDbCredits, 6450, 'server credits added only once');
      assertEqual(wallet.credits, 6450, 'wallet updated cleanly');
      assertEqual(wallet.xp, 520, 'xp updated cleanly');
      assertEqual(wallet.missionsCompletedCount, 1, 'completion count incremented once');
      assertEqual(wallet.badges.length, 1, 'exactly one badge unlocked');
      assertEqual(wallet.badges[0], 'Bridge Sprinter', 'does not adopt mutated catalog badge');
    } finally {
      rpc.restore();
    }
  });

  // 23. Null-badge completion consistency + alreadyFinalized badge propagation on fail/abandon
  await test('23. Null-badge completion stays null on retry, and alreadyFinalized fail/abandon preserve stored rewardBadge', async () => {
    const runTokenNoBadge = '11111111-1111-4111-8111-111111111127';
    const def = MISSIONS_CATALOG['MISSION_A_DELIVERY']; // rewardBadge undefined (null)
    let callNum = 0;

    const rpc = installMockRpc(async (fn) => {
      if (fn === 'complete_game_mission') {
        callNum += 1;
        if (callNum === 1) {
          return { data: null, error: { message: 'Network timeout' } };
        }
        return {
          data: {
            success: true,
            persisted: true,
            alreadyFinalized: true,
            creditsAwarded: 500,
            xpAwarded: 150,
            creditsBalance: 5500,
            xpBalance: 250,
            rewardBadge: null,
          },
          error: null,
        };
      }
      if (fn === 'abandon_game_mission') {
        return {
          data: {
            success: false,
            abandoned: false,
            alreadyFinalized: true,
            status: 'completed',
            creditsAwarded: 1450,
            xpAwarded: 420,
            rewardBadge: 'Bridge Sprinter',
          },
          error: null,
        };
      }
      throw new Error(`Unexpected RPC ${fn}`);
    });

    try {
      const { manager, wallet, flushAll } = createWiredHarness();
      manager.openBriefing(def.id);
      manager.startMission(runTokenNoBadge);
      manager.update(1, { x: def.destX, z: def.destZ, speed: 5 });
      await flushAll();
      assertEqual(manager.session?.state, 'VERIFICATION_FAILED', 'enters VERIFICATION_FAILED');

      manager.retryCompletionSubmission();
      await flushAll();

      assertEqual(manager.session?.state, 'COMPLETED', 'completes on retry');
      assertEqual(manager.session?.resultSummary?.rewardBadge, null, 'null badge preserved on retry');
      assertEqual(wallet.badges.length, 0, 'no badge added when reward_badge_awarded is null');

      // Also verify abandonMission preserves stored rewardBadge when server reports alreadyFinalized completed
      const tokenCompleted = '11111111-1111-4111-8111-111111111128';
      manager.openBriefing('FAR_TMB_CHECKPOINT_SPRINT');
      manager.startMission(tokenCompleted);
      manager.abandonMission();
      await flushAll();

      assertEqual(manager.session?.state, 'COMPLETED', 'reconciles completed state on abandon');
      assertEqual(
        manager.session?.resultSummary?.rewardBadge,
        'Bridge Sprinter',
        'abandonMission propagates stored rewardBadge on alreadyFinalized completion'
      );
    } finally {
      rpc.restore();
    }
  });

  // Unused callback type assertion check to keep strict TS clean
  const _cpTypeCheck: MissionCheckpointCallback | undefined = undefined;
  void _cpTypeCheck;

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
