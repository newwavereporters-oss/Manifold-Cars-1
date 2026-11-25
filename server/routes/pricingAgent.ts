import crypto from 'node:crypto';
import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import { getServerEnv } from '../config/env.js';
import { sendMigrationSqlFile } from '../lib/migrationSql.js';
import {
  getSupabaseAdminClient,
  getSupabaseClient,
  verifyActiveAdmin,
  verifySupabaseUser,
} from '../lib/supabaseServer.js';
import {
  optionalAuth,
  requireAdmin,
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import { aiIngestionLimiter, standardApiLimiter } from '../middleware/rateLimit.js';
import {
  getProviderQuotaUsageSummary,
  loadPricingAgentConfig,
  runPricingAgentResearch,
  savePricingAgentConfig,
} from '../services/pricingAgent/agentRunner.js';
import {
  getProvidersStatus,
  testProviderConnection,
} from '../services/pricingAgent/providers.js';
import {
  computeNextScheduledRunAt,
  runDueScheduledResearch,
} from '../services/pricingAgent/scheduler.js';
import type { ProviderKey } from '../services/pricingAgent/types.js';

const router = Router();

const PROVIDER_KEYS = [
  'manifold_inventory',
  'approved_feed',
  'serper',
  'google_cse',
  'brave_search',
] as const;

const ConfigPatchSchema = z.object({
  schedule_enabled: z.boolean().optional(),
  is_paused: z.boolean().optional(),
  default_frequency: z.enum(['daily', 'weekly', 'manual']).optional(),
  high_demand_interval_hours: z.number().int().min(1).max(720).optional(),
  standard_interval_hours: z.number().int().min(6).max(720).optional(),
  insufficient_retry_hours: z.number().int().min(1).max(336).optional(),
  max_vehicles_per_run: z.number().int().min(1).max(25).optional(),
  max_queries_per_run: z.number().int().min(1).max(50).optional(),
  max_fetches_per_query: z.number().int().min(1).max(10).optional(),
  max_daily_provider_queries: z.number().int().min(1).max(1000).optional(),
  monthly_provider_budget_usd: z.number().min(0).max(5000).optional(),
  provider_priority: z.array(z.enum(PROVIDER_KEYS)).min(1).max(5).optional(),
});

const RunRequestSchema = z.object({
  forceRefresh: z.boolean().optional().default(true),
  targets: z
    .array(
      z.object({
        make: z.string().trim().min(1).max(80),
        model: z.string().trim().min(1).max(80),
        year: z.number().int().min(1985).max(2028).nullable().optional(),
        trim: z.string().trim().max(80).nullable().optional(),
        marketCategory: z
          .enum(['foreign_used', 'nigerian_used', 'brand_new', 'unknown'])
          .optional(),
        location: z.string().trim().max(120).nullable().optional(),
      })
    )
    .max(10)
    .optional(),
});

const TestProviderSchema = z.object({
  providerKey: z.enum(PROVIDER_KEYS),
});

function verifyCronSecret(authHeader: string | undefined): boolean {
  const { cronSecret } = getServerEnv();
  if (!cronSecret || !authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;

  const expectedBuf = Buffer.from(cronSecret, 'utf8');
  const providedBuf = Buffer.from(token, 'utf8');
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

// Serve Pricing Agent additive SQL migration
router.get('/migration-sql', standardApiLimiter, (_req, res: Response) => {
  sendMigrationSqlFile('pricing-agent-migration.sql', '-- Pricing agent migration SQL missing.', res);
});

// Admin status: migration check, provider configs, daily quota/spend, active config
router.get(
  '/status',
  requireAuth,
  requireAdmin,
  standardApiLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const supabase = getSupabaseAdminClient() ?? req.auth?.supabase ?? getSupabaseClient(req.headers.authorization);
    const tables = [
      'market_price_estimates',
      'pricing_agent_config',
      'pricing_agent_runs',
      'pricing_provider_usage',
    ];

    const tableChecks: Record<string, { exists: boolean; count?: number | null; error?: string }> = {};
    if (supabase) {
      for (const t of tables) {
        const { error } = await supabase.from(t).select('id').limit(1);
        if (error) {
          tableChecks[t] = { exists: false, error: error.message };
        } else {
          const { count } = await supabase.from(t).select('id', { count: 'exact', head: true });
          tableChecks[t] = { exists: true, count: count ?? 0 };
        }
      }
    }

    const tablesExist = Boolean(supabase) && Object.values(tableChecks).every((c) => c.exists);
    const { config, persisted } = await loadPricingAgentConfig(supabase);
    const usage = await getProviderQuotaUsageSummary(supabase);
    const providers = getProvidersStatus(
      usage.queriesTodayByProvider,
      config.max_daily_provider_queries
    );

    const { cronSecret } = getServerEnv();

    return res.json({
      tablesExist,
      migrationRequired: !tablesExist,
      migrationFilePath: 'src/db/pricing-agent-migration.sql',
      tableChecks,
      configPersisted: persisted,
      config,
      cronSecretConfigured: Boolean(cronSecret),
      usage,
      providers,
    });
  }
);

// Update scheduling, pause state, quotas, budget, and provider priority
router.patch(
  '/config',
  requireAuth,
  requireAdmin,
  standardApiLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = ConfigPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid pricing agent configuration payload.',
      });
    }

    const supabase = getSupabaseAdminClient() ?? req.auth?.supabase ?? getSupabaseClient(req.headers.authorization);
    const { config: existing } = await loadPricingAgentConfig(supabase);

    const patch: Record<string, any> = { ...parsed.data };
    const nextFreq = parsed.data.default_frequency ?? existing.default_frequency;
    const nextEnabled = parsed.data.schedule_enabled ?? existing.schedule_enabled;

    if (nextEnabled && nextFreq !== 'manual') {
      patch.next_scheduled_run_at = computeNextScheduledRunAt(nextFreq);
    } else if (!nextEnabled || nextFreq === 'manual') {
      patch.next_scheduled_run_at = null;
    }

    const saved = await savePricingAgentConfig(supabase, patch);
    return res.json({
      config: saved.config,
      persistedToDb: saved.persisted,
      warning: saved.error,
    });
  }
);

// Live provider connectivity probe
router.post(
  '/providers/test',
  requireAuth,
  requireAdmin,
  aiIngestionLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = TestProviderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid providerKey.' });
    }

    const supabase = getSupabaseAdminClient() ?? req.auth?.supabase ?? getSupabaseClient(req.headers.authorization);
    const result = await testProviderConnection(parsed.data.providerKey as ProviderKey, supabase);
    return res.json(result);
  }
);

// Trigger manual or targeted vehicle research run
router.post(
  '/run',
  requireAuth,
  requireAdmin,
  aiIngestionLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = RunRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid pricing agent run payload.',
      });
    }

    const triggerType =
      parsed.data.targets && parsed.data.targets.length > 0 ? 'targeted' : 'manual';

    const result = await runPricingAgentResearch({
      triggerType,
      triggeredBy: req.auth?.user?.id || 'admin',
      explicitTargets: parsed.data.targets,
      forceRefresh: parsed.data.forceRefresh,
      authHeader: req.headers.authorization,
    });

    return res.json(result);
  }
);

// List recent runs and provider telemetry
router.get(
  '/runs',
  requireAuth,
  requireAdmin,
  standardApiLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const supabase = getSupabaseAdminClient() ?? req.auth?.supabase ?? getSupabaseClient(req.headers.authorization);
    if (!supabase) {
      return res.json({ runs: [], providerUsage: [], migrationRequired: true });
    }

    const [runsRes, usageRes] = await Promise.all([
      supabase
        .from('pricing_agent_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20),
      supabase
        .from('pricing_provider_usage')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40),
    ]);

    return res.json({
      migrationRequired: Boolean(runsRes.error),
      runs: runsRes.data || [],
      providerUsage: usageRes.data || [],
    });
  }
);

// Query stored market price estimates (current & optional historical snapshots)
router.get(
  '/estimates',
  optionalAuth,
  standardApiLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const supabase = getSupabaseAdminClient() ?? req.auth?.supabase ?? getSupabaseClient(req.headers.authorization);
    if (!supabase) {
      return res.json({ estimates: [], history: [], migrationRequired: true });
    }

    const make = typeof req.query.make === 'string' ? req.query.make.trim() : '';
    const model = typeof req.query.model === 'string' ? req.query.model.trim() : '';
    const category = typeof req.query.marketCategory === 'string' ? req.query.marketCategory.trim() : '';
    const includeHistory = req.query.includeHistory === 'true';

    let currentQuery = supabase
      .from('market_price_estimates')
      .select('*')
      .eq('is_current', true)
      .order('last_research_at', { ascending: false })
      .limit(50);

    if (make) currentQuery = currentQuery.ilike('make', make);
    if (model) currentQuery = currentQuery.ilike('model', `%${model}%`);
    if (category) currentQuery = currentQuery.eq('market_category', category);

    const { data, error } = await currentQuery;
    if (error) {
      return res.json({
        estimates: [],
        history: [],
        migrationRequired: true,
        error: error.message,
      });
    }

    let history: any[] = [];
    if (includeHistory && make && model) {
      let histQuery = supabase
        .from('market_price_estimates')
        .select(
          'id, make, model, target_year, market_category, median_price, price_range_low, price_range_high, valid_observation_count, confidence_score, confidence_level, last_research_at, is_current'
        )
        .ilike('make', make)
        .ilike('model', `%${model}%`)
        .order('last_research_at', { ascending: false })
        .limit(25);
      if (category) histQuery = histQuery.eq('market_category', category);
      const histRes = await histQuery;
      history = histRes.data || [];
    }

    return res.json({
      estimates: data || [],
      history,
      migrationRequired: false,
    });
  }
);

// Vercel Cron / Scheduled Trigger Endpoint (protected by timing-safe CRON_SECRET or Active Admin session)
router.all('/cron', aiIngestionLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers.authorization;
  let authorized = verifyCronSecret(authHeader);

  if (!authorized && authHeader) {
    const userCheck = await verifySupabaseUser(authHeader);
    if (userCheck.ok) {
      const adminCheck = await verifyActiveAdmin(userCheck.supabase, userCheck.user);
      if (adminCheck.isAdmin) authorized = true;
    }
  }

  if (!authorized) {
    return res.status(401).json({
      error: 'Unauthorized scheduled job trigger. Valid CRON_SECRET or active administrator session required.',
    });
  }

  const force = req.query.force === 'true' || req.body?.force === true;
  const result = await runDueScheduledResearch({ force });
  return res.json(result);
});

export const pricingAgentRouter = router;
