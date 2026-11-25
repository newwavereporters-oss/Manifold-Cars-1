import { getSupabaseAdminClient } from '../../lib/supabaseServer.js';
import {
  loadPricingAgentConfig,
  runPricingAgentResearch,
  savePricingAgentConfig,
} from './agentRunner.js';
import type { PricingAgentConfig, PricingAgentRunResult } from './types.js';

export function computeNextScheduledRunAt(
  frequency: PricingAgentConfig['default_frequency'],
  fromDate: Date = new Date()
): string | null {
  if (frequency === 'manual') return null;
  const next = new Date(fromDate.getTime());
  if (frequency === 'weekly') {
    next.setUTCDate(next.getUTCDate() + 7);
  } else {
    next.setUTCHours(next.getUTCHours() + 24);
  }
  return next.toISOString();
}

export async function runDueScheduledResearch(options?: {
  force?: boolean;
}): Promise<{
  executed: boolean;
  reason?: string;
  runResult?: PricingAgentRunResult;
}> {
  const supabase = getSupabaseAdminClient();
  const { config } = await loadPricingAgentConfig(supabase);

  if (!options?.force) {
    if (!config.schedule_enabled) {
      return { executed: false, reason: 'Schedule is currently disabled in pricing_agent_config.' };
    }
    if (config.is_paused) {
      return { executed: false, reason: 'Pricing agent schedule is paused.' };
    }
    if (config.default_frequency === 'manual') {
      return { executed: false, reason: 'Agent frequency is set to manual.' };
    }
    if (config.next_scheduled_run_at) {
      const nextMs = Date.parse(config.next_scheduled_run_at);
      if (Number.isFinite(nextMs) && Date.now() < nextMs) {
        return {
          executed: false,
          reason: `Next scheduled run is due at ${config.next_scheduled_run_at}.`,
        };
      }
    }
  }

  const runResult = await runPricingAgentResearch({
    triggerType: 'scheduled',
    triggeredBy: 'cron_scheduler',
    forceRefresh: Boolean(options?.force),
  });

  const now = new Date();
  await savePricingAgentConfig(supabase, {
    last_scheduled_run_at: now.toISOString(),
    next_scheduled_run_at: computeNextScheduledRunAt(config.default_frequency, now),
  });

  return {
    executed: true,
    runResult,
  };
}

let inProcessTimer: ReturnType<typeof setInterval> | null = null;

export function startInProcessSchedulerIfEnabled() {
  if (process.env.ENABLE_IN_PROCESS_PRICING_SCHEDULER !== 'true') return;
  if (inProcessTimer) return;

  // Poll hourly in persistent Node server runtimes (disabled on serverless Vercel)
  inProcessTimer = setInterval(() => {
    void runDueScheduledResearch().catch((err) => {
      console.error('[MANIFOLD PricingScheduler] Periodic check error:', err?.message);
    });
  }, 60 * 60 * 1000);
}
