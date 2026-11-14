import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface MissionProgressStat {
  completedCount: number;
  lastCompletedAt: string | null;
  lastRewardClaimedAt: string | null;
  totalCreditsEarned: number;
}

export interface ServerMissionOverrideRow {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  mission_category: string;
  distance_category: 'NEAR' | 'FAR' | 'VERY_FAR';
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

export const missionService = {
  async getMyMissionOverview(): Promise<MissionOverviewPayload> {
    if (!isSupabaseConfigured) {
      return { missions: [], progress: {}, serverNow: new Date().toISOString() };
    }
    try {
      const { data, error } = await supabase.rpc('get_my_mission_overview');
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

  async startMission(
    missionId: string
  ): Promise<{ success: boolean; runToken?: string; message?: string; schemaNotApplied?: boolean }> {
    if (!isSupabaseConfigured) {
      return { success: true, runToken: `local-${Date.now()}` };
    }
    try {
      const { data, error } = await supabase.rpc('start_game_mission', {
        p_mission_id: missionId,
      });
      if (error) {
        if (isMissingMissionSchemaError(error)) {
          return {
            success: true,
            runToken: `local-${Date.now()}`,
            schemaNotApplied: true,
          };
        }
        return { success: false, message: error.message };
      }
      const res = (data || {}) as { success?: boolean; runToken?: string };
      return {
        success: Boolean(res.success ?? true),
        runToken: res.runToken,
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Unable to start mission.' };
    }
  },

  async completeMission(params: {
    missionId: string;
    runToken?: string;
    success: boolean;
    runData?: Record<string, unknown>;
  }): Promise<{
    persisted: boolean;
    creditsAwarded?: number;
    xpAwarded?: number;
    creditsBalance?: number;
    xpBalance?: number;
    rewardBadge?: string | null;
  }> {
    if (!isSupabaseConfigured || !params.runToken || params.runToken.startsWith('local-')) {
      return { persisted: false };
    }
    try {
      const { data, error } = await supabase.rpc('complete_game_mission', {
        p_mission_id: params.missionId,
        p_run_token: params.runToken,
        p_success: params.success,
        p_run_data: params.runData || {},
      });
      if (error) {
        return { persisted: false };
      }
      const res = (data || {}) as any;
      return {
        persisted: Boolean(res.success),
        creditsAwarded: typeof res.creditsAwarded === 'number' ? res.creditsAwarded : undefined,
        xpAwarded: typeof res.xpAwarded === 'number' ? res.xpAwarded : undefined,
        creditsBalance: typeof res.creditsBalance === 'number' ? res.creditsBalance : undefined,
        xpBalance: typeof res.xpBalance === 'number' ? res.xpBalance : undefined,
        rewardBadge: res.rewardBadge ?? null,
      };
    } catch {
      return { persisted: false };
    }
  },

  async adminListMissions(): Promise<{ rows: ServerMissionOverrideRow[]; schemaNotApplied?: boolean }> {
    if (!isSupabaseConfigured) return { rows: [] };
    const { data, error } = await supabase.rpc('admin_list_game_missions');
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
    const { error } = await supabase.rpc('admin_update_game_mission', {
      p_mission_id: params.missionId,
      p_is_active: params.isActive ?? null,
      p_reward_credits: params.rewardCredits ?? null,
      p_reward_xp: params.rewardXp ?? null,
      p_time_limit_seconds: params.timeLimitSeconds ?? null,
      p_cooldown_seconds: params.cooldownSeconds ?? null,
      p_difficulty: params.difficulty ?? null,
    });
    if (error) throw new Error(error.message);
  },
};
