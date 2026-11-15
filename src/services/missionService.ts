import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { retryWithBackoff, withTimeout } from '../utils/networkReliability';

export interface MissionProgressStat {
  completedCount: number;
  lastCompletedAt: string | null;
  lastRewardClaimedAt: string | null;
  totalCreditsEarned: number;
}

export interface ServerMissionCheckpointRow {
  x: number;
  z: number;
  radius?: number;
  name?: string;
}

export interface ServerMissionOverrideRow {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  mission_category: string;
  distance_category: 'NEAR' | 'FAR' | 'VERY_FAR';
  start_location_name?: string;
  start_x?: number;
  start_z?: number;
  destination_name?: string;
  dest_x?: number;
  dest_z?: number;
  dest_radius?: number;
  checkpoints?: ServerMissionCheckpointRow[];
  distance_meters: number;
  estimated_minutes: number;
  reward_credits: number;
  reward_xp: number;
  reward_badge: string | null;
  time_limit_seconds: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Master';
  cooldown_seconds: number;
  requires_no_collision: boolean;
  require_park_gear: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface MissionOverviewPayload {
  missions: ServerMissionOverrideRow[];
  progress: Record<string, MissionProgressStat>;
  serverNow: string;
  schemaNotApplied?: boolean;
}

export interface CheckpointSyncResult {
  recorded: boolean;
  alreadyRecorded?: boolean;
  expired?: boolean;
  rejected?: boolean;
  networkError?: boolean;
  distanceFromCheckpoint?: number;
  nextCheckpointIndex?: number;
  totalCheckpoints?: number;
  message?: string;
}

export interface MissionFailResponse {
  success: boolean;
  failed: boolean;
  persisted: boolean;
  alreadyFinalized?: boolean;
  status?: string;
  failureReason?: string;
  creditsAwarded?: number;
  xpAwarded?: number;
  rewardBadge?: string | null;
  networkError?: boolean;
  message?: string;
}

export interface MissionAbandonResponse {
  success: boolean;
  abandoned: boolean;
  alreadyFinalized?: boolean;
  status?: string;
  failureReason?: string | null;
  creditsAwarded?: number;
  xpAwarded?: number;
  rewardBadge?: string | null;
  networkError?: boolean;
  message?: string;
}

export interface MissionCompletionResponse {
  persisted: boolean;
  rejected?: boolean;
  alreadyFinalized?: boolean;
  reason?: string;
  creditsAwarded?: number;
  xpAwarded?: number;
  creditsBalance?: number;
  xpBalance?: number;
  rewardBadge?: string | null;
  checkpointReportsAccepted?: boolean;
  serverVerified?: boolean;
  trustedChecks?: {
    runTokenValid?: boolean;
    serverDeadlineValid?: boolean;
    minDurationPlausible?: boolean;
    checkpointReportsAccepted?: boolean;
    destinationCoordsAccepted?: boolean;
    serverPhysicsVerified?: boolean;
  };
  clientClaims?: {
    untrustedClientReported?: boolean;
    reportedGear?: string;
    parkGearClaimed?: boolean;
    reportedCollisions?: number;
    zeroCollisionClaimed?: boolean;
    reportedFinishRank?: number | null;
  };
}

function isMissingMissionSchemaError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return (
    err?.code === 'PGRST202' ||
    err?.code === 'PGRST205' ||
    err?.code === '42P01' ||
    err?.code === '42883' ||
    msg.includes('Could not find the function') ||
    msg.includes('does not exist')
  );
}

function isLikelyNetworkError(errOrMsg: unknown): boolean {
  const msg = String((errOrMsg as any)?.message || errOrMsg || '').toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('temporarily') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('econn') ||
    msg.includes('offline')
  );
}

// Per-run promise queue so sequential checkpoints ALWAYS settle before complete_game_mission runs
const runRpcQueues = new Map<string, Promise<unknown>>();
// Deduplicate in-flight or acknowledged checkpoints per runToken:checkpointIndex
const checkpointSubmissions = new Map<string, Promise<CheckpointSyncResult>>();
// Deduplicate in-flight or persisted completion submissions per runToken
const completionSubmissions = new Map<string, Promise<MissionCompletionResponse>>();
// Deduplicate in-flight or persisted failure submissions per runToken
const failSubmissions = new Map<string, Promise<MissionFailResponse>>();
// Deduplicate in-flight or finalized abandon submissions per runToken
const abandonSubmissions = new Map<string, Promise<MissionAbandonResponse>>();

function enqueueForRun<T>(runToken: string | undefined, task: () => Promise<T>): Promise<T> {
  if (!runToken) return task();
  const prev = runRpcQueues.get(runToken) || Promise.resolve();
  const next = prev.catch(() => undefined).then(task);
  runRpcQueues.set(runToken, next);
  next.finally(() => {
    if (runRpcQueues.get(runToken) === next) {
      runRpcQueues.delete(runToken);
    }
  });
  return next;
}

/**
 * Best-effort page-exit abandonment fallback (pagehide / beforeunload).
 * Because browser delivery of keepalive requests during tab/window teardown is not
 * guaranteed, normal user-initiated abandonment uses server-confirmed RPCs, and
 * stale unfinalized runs are also cleaned up server-side on next start_game_mission.
 * Deduplicates via `sentTokens` and never mutates local MissionManager state prematurely.
 */
export function dispatchBestEffortPageExitAbandon(params: {
  run: { missionId: string; runToken: string } | null;
  sentTokens: Set<string>;
  supabaseUrl?: string;
  publishableKey?: string;
  accessToken?: string | null;
  fetchImpl?: typeof fetch;
}): boolean {
  const { run, sentTokens, supabaseUrl, publishableKey, accessToken } = params;
  if (!run || !run.runToken || sentTokens.has(run.runToken)) {
    return false;
  }
  if (!supabaseUrl || !publishableKey || !accessToken) {
    return false;
  }
  const fetchFn = params.fetchImpl ?? globalThis.fetch;
  if (typeof fetchFn !== 'function') {
    return false;
  }
  sentTokens.add(run.runToken);
  try {
    void fetchFn(`${supabaseUrl}/rest/v1/rpc/abandon_game_mission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        p_mission_id: run.missionId,
        p_run_token: run.runToken,
      }),
      keepalive: true,
    }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export const missionService = {
  async getMyMissionOverview(): Promise<MissionOverviewPayload> {
    if (!isSupabaseConfigured) {
      return { missions: [], progress: {}, serverNow: new Date().toISOString() };
    }
    try {
      const { data, error } = await retryWithBackoff(
        () => withTimeout(supabase.rpc('get_my_mission_overview'), 8000, 'Mission overview'),
        { maxAttempts: 2 }
      );
      if (error) {
        if (isMissingMissionSchemaError(error)) {
          return {
            missions: [],
            progress: {},
            serverNow: new Date().toISOString(),
            schemaNotApplied: true,
          };
        }
        throw new Error(error.message);
      }
      const row = (data || {}) as Partial<MissionOverviewPayload>;
      return {
        missions: Array.isArray(row.missions) ? row.missions : [],
        progress: (row.progress || {}) as Record<string, MissionProgressStat>,
        serverNow: String(row.serverNow || new Date().toISOString()),
      };
    } catch {
      return { missions: [], progress: {}, serverNow: new Date().toISOString() };
    }
  },

  async startMission(missionId: string): Promise<{
    success: boolean;
    runToken?: string;
    expiresAt?: string;
    timeLimitSeconds?: number;
    message?: string;
    schemaNotApplied?: boolean;
  }> {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        message: 'Supabase is not configured. Missions require a live database connection.',
      };
    }
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('start_game_mission', {
          p_mission_id: missionId,
        }),
        9000,
        'Start mission'
      );
      if (error) {
        if (isMissingMissionSchemaError(error)) {
          return {
            success: false,
            schemaNotApplied: true,
            message:
              'Mission database schema is not yet applied. Run src/db/manifold-game-expansion-migration.sql in Supabase.',
          };
        }
        return { success: false, message: error.message };
      }
      const res = (data || {}) as {
        success?: boolean;
        runToken?: string;
        expiresAt?: string;
        timeLimitSeconds?: number;
      };
      if (!res.runToken) {
        return { success: false, message: 'Server did not return a valid mission run token.' };
      }
      return {
        success: Boolean(res.success ?? true),
        runToken: res.runToken,
        expiresAt: res.expiresAt,
        timeLimitSeconds: res.timeLimitSeconds,
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Unable to start mission.' };
    }
  },

  async reportCheckpoint(params: {
    missionId: string;
    runToken?: string;
    checkpointIndex: number;
    x: number;
    z: number;
  }): Promise<CheckpointSyncResult> {
    if (!isSupabaseConfigured || !params.runToken) {
      return { recorded: false, networkError: true, message: 'Valid server run token is required.' };
    }

    if (!Number.isFinite(params.x) || !Number.isFinite(params.z)) {
      return {
        recorded: false,
        rejected: true,
        networkError: false,
        message: 'Finite vehicle coordinates within world bounds are required.',
      };
    }

    const dedupeKey = `${params.runToken}:${params.checkpointIndex}`;
    const existing = checkpointSubmissions.get(dedupeKey);
    if (existing) {
      return existing;
    }

    const submission = enqueueForRun(params.runToken, async (): Promise<CheckpointSyncResult> => {
      try {
        const res = await retryWithBackoff(
          async () => {
            const { data, error } = await withTimeout(
              supabase.rpc('report_game_mission_checkpoint', {
                p_mission_id: params.missionId,
                p_run_token: params.runToken,
                p_checkpoint_index: params.checkpointIndex,
                p_x: params.x,
                p_z: params.z,
              }),
              8000,
              'Checkpoint sync'
            );
            if (error) {
              if (isLikelyNetworkError(error.message)) {
                throw new Error(error.message);
              }
              return { __rpcError: error.message } as const;
            }
            return (data || {}) as {
              success?: boolean;
              recorded?: boolean;
              expired?: boolean;
              alreadyRecorded?: boolean;
              distanceFromCheckpoint?: number;
              nextCheckpointIndex?: number;
              totalCheckpoints?: number;
              message?: string;
            };
          },
          { maxAttempts: 2 }
        );
        if ('__rpcError' in res) {
          return {
            recorded: false,
            rejected: true,
            networkError: false,
            message: res.__rpcError,
          };
        }
        const acked = Boolean(res.recorded || res.alreadyRecorded || res.success);
        return {
          recorded: acked,
          alreadyRecorded: Boolean(res.alreadyRecorded),
          expired: Boolean(res.expired),
          rejected: !acked && !res.expired,
          networkError: false,
          distanceFromCheckpoint:
            typeof res.distanceFromCheckpoint === 'number' ? res.distanceFromCheckpoint : undefined,
          nextCheckpointIndex:
            typeof res.nextCheckpointIndex === 'number' ? res.nextCheckpointIndex : undefined,
          totalCheckpoints:
            typeof res.totalCheckpoints === 'number' ? res.totalCheckpoints : undefined,
          message: res.message,
        };
      } catch (err: any) {
        return {
          recorded: false,
          rejected: false,
          networkError: true,
          message: err?.message || 'Checkpoint sync failed.',
        };
      }
    });

    checkpointSubmissions.set(dedupeKey, submission);
    void submission.then(
      (res) => {
        if (!res.recorded && !res.alreadyRecorded) {
          if (checkpointSubmissions.get(dedupeKey) === submission) {
            checkpointSubmissions.delete(dedupeKey);
          }
          return;
        }
        const t = globalThis.setTimeout(() => {
          if (checkpointSubmissions.get(dedupeKey) === submission) {
            checkpointSubmissions.delete(dedupeKey);
          }
        }, 60000) as unknown as { unref?: () => void };
        t?.unref?.();
      },
      () => {
        if (checkpointSubmissions.get(dedupeKey) === submission) {
          checkpointSubmissions.delete(dedupeKey);
        }
      }
    );

    return submission;
  },

  async failMission(params: {
    missionId: string;
    runToken?: string;
    failureReason?: string;
  }): Promise<MissionFailResponse> {
    if (!isSupabaseConfigured || !params.runToken) {
      return {
        success: false,
        failed: false,
        persisted: false,
        message: 'Valid mission run token is required to record failure.',
      };
    }

    const existing = failSubmissions.get(params.runToken);
    if (existing) {
      return existing;
    }

    const submission = enqueueForRun(params.runToken, async (): Promise<MissionFailResponse> => {
      try {
        const res = await retryWithBackoff(
          async () => {
            const { data, error } = await withTimeout(
              supabase.rpc('fail_game_mission', {
                p_mission_id: params.missionId,
                p_run_token: params.runToken,
                p_failure_reason: params.failureReason ?? null,
              }),
              8000,
              'Fail mission'
            );
            if (error) {
              if (isLikelyNetworkError(error.message)) {
                throw new Error(error.message);
              }
              return { __rpcError: error.message } as const;
            }
            return (data || {}) as {
              success?: boolean;
              failed?: boolean;
              persisted?: boolean;
              alreadyFinalized?: boolean;
              status?: string;
              failureReason?: string;
              creditsAwarded?: number;
              xpAwarded?: number;
              rewardBadge?: string | null;
              reason?: string;
            };
          },
          { maxAttempts: 2 }
        );
        if ('__rpcError' in res) {
          return {
            success: false,
            failed: false,
            persisted: false,
            networkError: false,
            message: res.__rpcError,
          };
        }
        return {
          success: Boolean(res.success),
          failed: Boolean(res.failed),
          persisted: Boolean(res.persisted),
          alreadyFinalized: Boolean(res.alreadyFinalized),
          status: res.status,
          failureReason: res.failureReason ?? res.reason,
          creditsAwarded: typeof res.creditsAwarded === 'number' ? res.creditsAwarded : undefined,
          xpAwarded: typeof res.xpAwarded === 'number' ? res.xpAwarded : undefined,
          rewardBadge: res.rewardBadge ?? null,
          networkError: false,
          message: res.reason ?? res.failureReason,
        };
      } catch (err: any) {
        return {
          success: false,
          failed: false,
          persisted: false,
          networkError: true,
          message: err?.message || 'Failed to persist mission failure with server.',
        };
      }
    });

    failSubmissions.set(params.runToken, submission);
    void submission.then(
      (res) => {
        const knownTerminal =
          res.persisted ||
          (res.alreadyFinalized &&
            (res.status === 'failed' || res.status === 'completed' || res.status === 'abandoned'));
        if (!knownTerminal) {
          if (failSubmissions.get(params.runToken!) === submission) {
            failSubmissions.delete(params.runToken!);
          }
          return;
        }
        const t = globalThis.setTimeout(() => {
          if (failSubmissions.get(params.runToken!) === submission) {
            failSubmissions.delete(params.runToken!);
          }
        }, 30000) as unknown as { unref?: () => void };
        t?.unref?.();
      },
      () => {
        if (failSubmissions.get(params.runToken!) === submission) {
          failSubmissions.delete(params.runToken!);
        }
      }
    );

    return submission;
  },

  async abandonMission(
    missionId: string,
    runToken: string
  ): Promise<MissionAbandonResponse> {
    if (!isSupabaseConfigured || !runToken) {
      return {
        success: false,
        abandoned: false,
        message: 'Valid mission run token is required to abandon.',
      };
    }

    const existing = abandonSubmissions.get(runToken);
    if (existing) {
      return existing;
    }

    const submission = enqueueForRun(runToken, async (): Promise<MissionAbandonResponse> => {
      try {
        const { data, error } = await withTimeout(
          supabase.rpc('abandon_game_mission', {
            p_mission_id: missionId,
            p_run_token: runToken,
          }),
          6000,
          'Abandon mission'
        );
        if (error) {
          return {
            success: false,
            abandoned: false,
            networkError: isLikelyNetworkError(error.message),
            message: error.message,
          };
        }
        const res = (data || {}) as {
          success?: boolean;
          abandoned?: boolean;
          alreadyFinalized?: boolean;
          status?: string;
          failureReason?: string | null;
          creditsAwarded?: number;
          xpAwarded?: number;
          rewardBadge?: string | null;
          reason?: string;
        };
        const abandoned = Boolean(res.abandoned ?? res.success);
        const alreadyFinalized = Boolean(res.alreadyFinalized);
        return {
          success: abandoned || alreadyFinalized,
          abandoned,
          alreadyFinalized,
          status: res.status,
          failureReason: res.failureReason ?? null,
          creditsAwarded: typeof res.creditsAwarded === 'number' ? res.creditsAwarded : undefined,
          xpAwarded: typeof res.xpAwarded === 'number' ? res.xpAwarded : undefined,
          rewardBadge: res.rewardBadge ?? null,
          message: res.reason,
        };
      } catch (err: any) {
        return {
          success: false,
          abandoned: false,
          networkError: true,
          message: err?.message || 'Failed to abandon mission on server.',
        };
      }
    });

    abandonSubmissions.set(runToken, submission);
    void submission.then(
      (res) => {
        if (!res.abandoned && !res.alreadyFinalized) {
          if (abandonSubmissions.get(runToken) === submission) {
            abandonSubmissions.delete(runToken);
          }
          return;
        }
        const t = globalThis.setTimeout(() => {
          if (abandonSubmissions.get(runToken) === submission) {
            abandonSubmissions.delete(runToken);
          }
        }, 30000) as unknown as { unref?: () => void };
        t?.unref?.();
      },
      () => {
        if (abandonSubmissions.get(runToken) === submission) {
          abandonSubmissions.delete(runToken);
        }
      }
    );

    return submission;
  },

  async completeMission(params: {
    missionId: string;
    runToken?: string;
    finalX: number;
    finalZ: number;
    gear: string;
    collisionCount: number;
    finishRank?: number | null;
  }): Promise<MissionCompletionResponse> {
    if (!isSupabaseConfigured || !params.runToken) {
      return {
        persisted: false,
        reason: 'Valid server run token and database connection are required to verify completion.',
      };
    }

    const existing = completionSubmissions.get(params.runToken);
    if (existing) {
      return existing;
    }

    const submission = enqueueForRun(params.runToken, async (): Promise<MissionCompletionResponse> => {
      try {
        const { data, error } = await withTimeout(
          supabase.rpc('complete_game_mission', {
            p_mission_id: params.missionId,
            p_run_token: params.runToken,
            p_final_x: params.finalX,
            p_final_z: params.finalZ,
            p_gear: params.gear,
            p_collision_count: Math.max(0, Math.round(params.collisionCount)),
            p_finish_rank: params.finishRank ?? null,
          }),
          9000,
          'Complete mission'
        );
        if (error) {
          const netErr = isLikelyNetworkError(error.message);
          return {
            persisted: false,
            rejected: !netErr,
            reason: error.message,
          };
        }
        const res = (data || {}) as any;
        return {
          persisted: Boolean(res.persisted ?? res.success),
          rejected: res.success === false,
          alreadyFinalized: Boolean(res.alreadyFinalized),
          reason: res.reason,
          creditsAwarded: typeof res.creditsAwarded === 'number' ? res.creditsAwarded : undefined,
          xpAwarded: typeof res.xpAwarded === 'number' ? res.xpAwarded : undefined,
          creditsBalance: typeof res.creditsBalance === 'number' ? res.creditsBalance : undefined,
          xpBalance: typeof res.xpBalance === 'number' ? res.xpBalance : undefined,
          rewardBadge: res.rewardBadge ?? null,
          checkpointReportsAccepted: Boolean(res.checkpointReportsAccepted),
          serverVerified: Boolean(res.serverVerified),
          trustedChecks: res.trustedChecks,
          clientClaims: res.clientClaims,
        };
      } catch (err: any) {
        return {
          persisted: false,
          rejected: false,
          reason: err?.message || 'Unable to verify mission with server.',
        };
      }
    });

    completionSubmissions.set(params.runToken, submission);
    void submission.then(
      (res) => {
        // Retain cache ONLY when completion/rejection is persisted on the server.
        // If persisted === false (transient network error), clear immediately so retry succeeds.
        if (!res.persisted) {
          if (completionSubmissions.get(params.runToken!) === submission) {
            completionSubmissions.delete(params.runToken!);
          }
          return;
        }
        const t = globalThis.setTimeout(() => {
          if (completionSubmissions.get(params.runToken!) === submission) {
            completionSubmissions.delete(params.runToken!);
          }
        }, 60000) as unknown as { unref?: () => void };
        t?.unref?.();
      },
      () => {
        if (completionSubmissions.get(params.runToken!) === submission) {
          completionSubmissions.delete(params.runToken!);
        }
      }
    );

    return submission;
  },

  async adminListMissions(): Promise<{ rows: ServerMissionOverrideRow[]; schemaNotApplied?: boolean }> {
    if (!isSupabaseConfigured) return { rows: [] };
    const { data, error } = await withTimeout(
      supabase.rpc('admin_list_game_missions'),
      9000,
      'Admin list missions'
    );
    if (error) {
      if (isMissingMissionSchemaError(error)) {
        return { rows: [], schemaNotApplied: true };
      }
      throw new Error(error.message);
    }
    return { rows: Array.isArray(data) ? (data as ServerMissionOverrideRow[]) : [] };
  },

  async adminUpdateMission(params: {
    missionId: string;
    isActive?: boolean;
    rewardCredits?: number;
    rewardXp?: number;
    timeLimitSeconds?: number;
    cooldownSeconds?: number;
    difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Master';
  }): Promise<void> {
    const { error } = await withTimeout(
      supabase.rpc('admin_update_game_mission', {
        p_mission_id: params.missionId,
        p_is_active: params.isActive ?? null,
        p_reward_credits: params.rewardCredits ?? null,
        p_reward_xp: params.rewardXp ?? null,
        p_time_limit_seconds: params.timeLimitSeconds ?? null,
        p_cooldown_seconds: params.cooldownSeconds ?? null,
        p_difficulty: params.difficulty ?? null,
      }),
      9000,
      'Admin update mission'
    );
    if (error) throw new Error(error.message);
  },
};
