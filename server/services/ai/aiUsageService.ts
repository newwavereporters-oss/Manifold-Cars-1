import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../lib/supabaseServer';

export type AiFeatureModuleKey =
  | 'listing_copy'
  | 'vehicle_search'
  | 'voice_transcribe'
  | 'price_intelligence'
  | 'market_insights'
  | 'assistant'
  | 'health_test';

export interface AiFeatureSetting {
  module_key: AiFeatureModuleKey;
  display_name: string;
  description: string;
  enabled: boolean;
  model_override: string | null;
  max_requests_per_min: number;
  max_output_tokens: number;
  monthly_budget_usd: number;
  updated_at?: string;
}

export interface AiUsageLogEntry {
  request_id: string;
  user_id?: string | null;
  user_role: 'admin' | 'dealer' | 'buyer' | 'anonymous';
  dealer_id?: string | null;
  feature_module: AiFeatureModuleKey;
  provider?: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd?: number;
  latency_ms: number;
  success: boolean;
  error_code?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

const DEFAULT_SETTINGS: Record<AiFeatureModuleKey, AiFeatureSetting> = {
  listing_copy: {
    module_key: 'listing_copy',
    display_name: 'Dealer Listing Intelligence',
    description: 'Structured descriptions, selling highlights, and SEO metadata for approved dealers.',
    enabled: true,
    model_override: null,
    max_requests_per_min: 25,
    max_output_tokens: 1100,
    monthly_budget_usd: 120,
  },
  vehicle_search: {
    module_key: 'vehicle_search',
    display_name: 'Vehicle Intelligence Search',
    description: 'Natural-language vehicle search parsing, ranking, and zero-result recovery.',
    enabled: true,
    model_override: null,
    max_requests_per_min: 40,
    max_output_tokens: 600,
    monthly_budget_usd: 150,
  },
  voice_transcribe: {
    module_key: 'voice_transcribe',
    display_name: 'Voice Search Transcription',
    description: 'Speech-to-text tuned for Nigerian English automotive queries.',
    enabled: true,
    model_override: null,
    max_requests_per_min: 15,
    max_output_tokens: 300,
    monthly_budget_usd: 80,
  },
  price_intelligence: {
    module_key: 'price_intelligence',
    display_name: 'Price Intelligence Commentary',
    description: 'Grounded statistical valuation commentary over verified comparables.',
    enabled: true,
    model_override: null,
    max_requests_per_min: 30,
    max_output_tokens: 650,
    monthly_budget_usd: 100,
  },
  market_insights: {
    module_key: 'market_insights',
    display_name: 'Market Intelligence Synthesis',
    description: 'Executive supply, demand, and search-gap analytics for Admins and Dealers.',
    enabled: true,
    model_override: null,
    max_requests_per_min: 20,
    max_output_tokens: 1000,
    monthly_budget_usd: 100,
  },
  assistant: {
    module_key: 'assistant',
    display_name: 'AI Automotive Assistant',
    description: 'Conversational buyer concierge and dealer advisor grounded in live inventory.',
    enabled: true,
    model_override: null,
    max_requests_per_min: 30,
    max_output_tokens: 800,
    monthly_budget_usd: 150,
  },
  health_test: {
    module_key: 'health_test',
    display_name: 'Connection Health Verification',
    description: 'Diagnostic OpenAI verification endpoint for administrators.',
    enabled: true,
    model_override: null,
    max_requests_per_min: 30,
    max_output_tokens: 64,
    monthly_budget_usd: 10,
  },
};

// In-memory runtime fallback buffer if migration SQL hasn't been applied in Supabase yet
const memorySettingsOverrides = new Map<AiFeatureModuleKey, Partial<AiFeatureSetting>>();
const memoryUsageRing: AiUsageLogEntry[] = [];
const MAX_MEMORY_LOGS = 200;

export function estimateOpenAiCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const m = model.toLowerCase();
  // Conservative indicative USD per 1M tokens rates for admin budget awareness
  let inPerMillion = 0.40;
  let outPerMillion = 1.60;

  if (m.includes('gpt-4.1-nano') || m.includes('gpt-4o-mini')) {
    inPerMillion = 0.15;
    outPerMillion = 0.60;
  } else if (m.includes('gpt-4.1-mini') || m.includes('gpt-5-mini')) {
    inPerMillion = 0.40;
    outPerMillion = 1.60;
  } else if (m.includes('gpt-4.1') || m.includes('gpt-4o') || m.includes('gpt-5')) {
    inPerMillion = 2.00;
    outPerMillion = 8.00;
  } else if (m.includes('transcribe') || m.includes('whisper')) {
    inPerMillion = 0.60;
    outPerMillion = 0.0;
  }

  const total = (inputTokens / 1_000_000) * inPerMillion + (outputTokens / 1_000_000) * outPerMillion;
  return Number(total.toFixed(6));
}

export async function getModuleSetting(
  moduleKey: AiFeatureModuleKey,
  supabaseClient?: SupabaseClient | null
): Promise<AiFeatureSetting> {
  const fallback: AiFeatureSetting = {
    ...DEFAULT_SETTINGS[moduleKey],
    ...(memorySettingsOverrides.get(moduleKey) || {}),
  };

  const client = supabaseClient ?? getSupabaseClient();
  if (!client) return fallback;

  try {
    const { data, error } = await client
      .from('ai_feature_settings')
      .select('*')
      .eq('module_key', moduleKey)
      .maybeSingle();

    if (error || !data) return fallback;

    return {
      module_key: moduleKey,
      display_name: data.display_name || fallback.display_name,
      description: data.description || fallback.description,
      enabled: typeof data.enabled === 'boolean' ? data.enabled : fallback.enabled,
      model_override: data.model_override || null,
      max_requests_per_min: Number(data.max_requests_per_min || fallback.max_requests_per_min),
      max_output_tokens: Number(data.max_output_tokens || fallback.max_output_tokens),
      monthly_budget_usd: Number(data.monthly_budget_usd || fallback.monthly_budget_usd),
      updated_at: data.updated_at,
    };
  } catch {
    return fallback;
  }
}

export async function getAllModuleSettings(
  supabaseClient?: SupabaseClient | null
): Promise<AiFeatureSetting[]> {
  const keys: AiFeatureModuleKey[] = [
    'listing_copy',
    'vehicle_search',
    'voice_transcribe',
    'price_intelligence',
    'market_insights',
    'assistant',
  ];

  const client = supabaseClient ?? getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('ai_feature_settings')
        .select('*')
        .order('module_key', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        const byKey = new Map<string, any>(data.map((row: any) => [row.module_key, row]));
        return keys.map((key) => {
          const row = byKey.get(key);
          const def = DEFAULT_SETTINGS[key];
          if (!row) return { ...def, ...(memorySettingsOverrides.get(key) || {}) };
          return {
            module_key: key,
            display_name: row.display_name || def.display_name,
            description: row.description || def.description,
            enabled: typeof row.enabled === 'boolean' ? row.enabled : def.enabled,
            model_override: row.model_override || null,
            max_requests_per_min: Number(row.max_requests_per_min || def.max_requests_per_min),
            max_output_tokens: Number(row.max_output_tokens || def.max_output_tokens),
            monthly_budget_usd: Number(row.monthly_budget_usd || def.monthly_budget_usd),
            updated_at: row.updated_at,
          };
        });
      }
    } catch {
      // fall through to defaults
    }
  }

  return keys.map((k) => ({ ...DEFAULT_SETTINGS[k], ...(memorySettingsOverrides.get(k) || {}) }));
}

export async function updateModuleSetting(params: {
  supabase: SupabaseClient;
  adminUserId: string;
  moduleKey: AiFeatureModuleKey;
  enabled?: boolean;
  modelOverride?: string | null;
  maxRequestsPerMin?: number;
  maxOutputTokens?: number;
  monthlyBudgetUsd?: number;
}): Promise<{ setting: AiFeatureSetting; persistedToDb: boolean; warning?: string }> {
  const current = await getModuleSetting(params.moduleKey, params.supabase);
  const next: AiFeatureSetting = {
    ...current,
    enabled: params.enabled !== undefined ? params.enabled : current.enabled,
    model_override:
      params.modelOverride !== undefined
        ? (params.modelOverride?.trim() ? params.modelOverride.trim() : null)
        : current.model_override,
    max_requests_per_min:
      params.maxRequestsPerMin !== undefined ? params.maxRequestsPerMin : current.max_requests_per_min,
    max_output_tokens:
      params.maxOutputTokens !== undefined ? params.maxOutputTokens : current.max_output_tokens,
    monthly_budget_usd:
      params.monthlyBudgetUsd !== undefined ? params.monthlyBudgetUsd : current.monthly_budget_usd,
    updated_at: new Date().toISOString(),
  };

  memorySettingsOverrides.set(params.moduleKey, next);

  try {
    const { error } = await params.supabase
      .from('ai_feature_settings')
      .upsert(
        {
          module_key: next.module_key,
          display_name: next.display_name,
          description: next.description,
          enabled: next.enabled,
          model_override: next.model_override,
          max_requests_per_min: next.max_requests_per_min,
          max_output_tokens: next.max_output_tokens,
          monthly_budget_usd: next.monthly_budget_usd,
          updated_at: next.updated_at,
          updated_by: params.adminUserId,
        },
        { onConflict: 'module_key' }
      );

    if (error) {
      return {
        setting: next,
        persistedToDb: false,
        warning: `Applied in runtime memory; Supabase table unavailable (${error.message}).`,
      };
    }

    return { setting: next, persistedToDb: true };
  } catch (err: any) {
    return {
      setting: next,
      persistedToDb: false,
      warning: `Applied in runtime memory (${err?.message || 'DB write skipped'}).`,
    };
  }
}

export async function recordAiUsage(
  entry: AiUsageLogEntry,
  supabaseClient?: SupabaseClient | null
): Promise<void> {
  const estimatedCost =
    entry.estimated_cost_usd !== undefined
      ? entry.estimated_cost_usd
      : estimateOpenAiCostUsd(entry.model, entry.input_tokens, entry.output_tokens);

  const enriched: AiUsageLogEntry = {
    ...entry,
    provider: entry.provider || 'openai',
    estimated_cost_usd: estimatedCost,
    created_at: entry.created_at || new Date().toISOString(),
  };

  memoryUsageRing.unshift(enriched);
  if (memoryUsageRing.length > MAX_MEMORY_LOGS) {
    memoryUsageRing.length = MAX_MEMORY_LOGS;
  }

  const client = supabaseClient ?? getSupabaseClient();
  if (!client) return;

  try {
    await client.from('ai_usage_logs').insert({
      request_id: enriched.request_id,
      user_id: enriched.user_id || null,
      user_role: enriched.user_role,
      dealer_id: enriched.dealer_id || null,
      feature_module: enriched.feature_module,
      provider: enriched.provider,
      model: enriched.model,
      input_tokens: enriched.input_tokens,
      output_tokens: enriched.output_tokens,
      total_tokens: enriched.total_tokens,
      estimated_cost_usd: enriched.estimated_cost_usd,
      latency_ms: enriched.latency_ms,
      success: enriched.success,
      error_code: enriched.error_code || null,
      error_message: enriched.error_message ? enriched.error_message.slice(0, 400) : null,
      metadata: enriched.metadata || {},
    });
  } catch {
    // Non-blocking: AI telemetry never crashes primary user workflows if migration is pending
  }
}

export async function checkAiDatabaseStatus(supabaseClient: SupabaseClient): Promise<{
  tablesExist: boolean;
  missingTables: string[];
}> {
  const required = ['ai_usage_logs', 'ai_feature_settings', 'ai_search_analytics'];
  const missing: string[] = [];

  for (const tbl of required) {
    try {
      const { error } = await supabaseClient.from(tbl).select('id').limit(1);
      if (error && (error.code === '42P01' || error.message.toLowerCase().includes('does not exist'))) {
        missing.push(tbl);
      }
    } catch {
      missing.push(tbl);
    }
  }

  // Note: ai_feature_settings uses module_key PK (no id column)
  if (missing.includes('ai_feature_settings')) {
    try {
      const { error } = await supabaseClient.from('ai_feature_settings').select('module_key').limit(1);
      if (!error) {
        const idx = missing.indexOf('ai_feature_settings');
        if (idx !== -1) missing.splice(idx, 1);
      }
    } catch {
      // keep missing
    }
  }

  return {
    tablesExist: missing.length === 0,
    missingTables: missing,
  };
}

export async function getAdminAiOverview(supabaseClient: SupabaseClient) {
  const [settings, dbStatus] = await Promise.all([
    getAllModuleSettings(supabaseClient),
    checkAiDatabaseStatus(supabaseClient),
  ]);

  let logs: AiUsageLogEntry[] = [];
  let searchRows: any[] = [];

  if (dbStatus.tablesExist) {
    const [logsRes, searchRes] = await Promise.all([
      supabaseClient
        .from('ai_usage_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300),
      supabaseClient
        .from('ai_search_analytics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300),
    ]);

    if (!logsRes.error && Array.isArray(logsRes.data)) {
      logs = logsRes.data.map((r: any) => ({
        request_id: r.request_id,
        user_id: r.user_id,
        user_role: r.user_role,
        dealer_id: r.dealer_id,
        feature_module: r.feature_module,
        provider: r.provider,
        model: r.model,
        input_tokens: Number(r.input_tokens || 0),
        output_tokens: Number(r.output_tokens || 0),
        total_tokens: Number(r.total_tokens || 0),
        estimated_cost_usd: Number(r.estimated_cost_usd || 0),
        latency_ms: Number(r.latency_ms || 0),
        success: Boolean(r.success),
        error_code: r.error_code,
        error_message: r.error_message,
        metadata: r.metadata || {},
        created_at: r.created_at,
      }));
    }

    if (!searchRes.error && Array.isArray(searchRes.data)) {
      searchRows = searchRes.data;
    }
  }

  if (logs.length === 0 && memoryUsageRing.length > 0) {
    logs = [...memoryUsageRing];
  }

  const totalRequests = logs.length;
  const successCount = logs.filter((l) => l.success).length;
  const failureCount = totalRequests - successCount;
  const totalInputTokens = logs.reduce((s, l) => s + l.input_tokens, 0);
  const totalOutputTokens = logs.reduce((s, l) => s + l.output_tokens, 0);
  const totalTokens = logs.reduce((s, l) => s + l.total_tokens, 0);
  const estimatedSpendUsd = Number(
    logs.reduce((s, l) => s + Number(l.estimated_cost_usd || 0), 0).toFixed(4)
  );
  const avgLatencyMs =
    totalRequests > 0
      ? Math.round(logs.reduce((s, l) => s + l.latency_ms, 0) / totalRequests)
      : 0;
  const rateLimitEvents = logs.filter((l) => l.error_code === 'RATE_LIMITED' || l.error_code === 'OPENAI_RATE_LIMIT').length;

  const byModuleMap = new Map<
    string,
    { module: string; requests: number; failures: number; tokens: number; spendUsd: number; avgLatencyMs: number }
  >();
  const byModelMap = new Map<
    string,
    { model: string; requests: number; tokens: number; spendUsd: number }
  >();

  for (const log of logs) {
    const mod = byModuleMap.get(log.feature_module) || {
      module: log.feature_module,
      requests: 0,
      failures: 0,
      tokens: 0,
      spendUsd: 0,
      avgLatencyMs: 0,
    };
    mod.requests += 1;
    if (!log.success) mod.failures += 1;
    mod.tokens += log.total_tokens;
    mod.spendUsd = Number((mod.spendUsd + Number(log.estimated_cost_usd || 0)).toFixed(6));
    mod.avgLatencyMs += log.latency_ms;
    byModuleMap.set(log.feature_module, mod);

    const mdl = byModelMap.get(log.model) || { model: log.model, requests: 0, tokens: 0, spendUsd: 0 };
    mdl.requests += 1;
    mdl.tokens += log.total_tokens;
    mdl.spendUsd = Number((mdl.spendUsd + Number(log.estimated_cost_usd || 0)).toFixed(6));
    byModelMap.set(log.model, mdl);
  }

  const byModule = Array.from(byModuleMap.values()).map((m) => ({
    ...m,
    avgLatencyMs: m.requests > 0 ? Math.round(m.avgLatencyMs / m.requests) : 0,
  }));

  const searchCount = searchRows.filter((s) => s.input_mode !== 'voice').length;
  const voiceSearchCount = searchRows.filter((s) => s.input_mode === 'voice').length;
  const zeroResultSearches = searchRows.filter((s) => s.zero_results).length;

  return {
    dbStatus,
    summary: {
      totalRequests,
      successCount,
      failureCount,
      avgLatencyMs,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      estimatedSpendUsd,
      listingGenerations: logs.filter((l) => l.feature_module === 'listing_copy' && l.success).length,
      searchRequests: logs.filter((l) => l.feature_module === 'vehicle_search').length,
      voiceRequests: logs.filter((l) => l.feature_module === 'voice_transcribe').length,
      assistantRequests: logs.filter((l) => l.feature_module === 'assistant').length,
      rateLimitEvents,
      trackedSearches: searchRows.length,
      textSearchCount: searchCount,
      voiceSearchCount,
      zeroResultSearches,
    },
    byModule,
    byModel: Array.from(byModelMap.values()),
    settings,
    failedRequests: logs.filter((l) => !l.success).slice(0, 25),
    recentLogs: logs.slice(0, 40),
  };
}
