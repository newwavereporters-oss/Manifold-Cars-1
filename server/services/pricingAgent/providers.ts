import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '../../config/env.js';
import { fetchListingPageSafe } from '../marketIntelligenceBackend.js';
import { extractDomainFromUrl, normalizeListingUrl } from './deduplicator.js';
import { formatMarketCategoryLabel, normalizeBrandName, normalizeModelName } from './matcher.js';
import type {
  ProviderKey,
  ProviderStatus,
  RawSearchResult,
  SearchQueryTarget,
} from './types.js';

export const PROVIDER_CATALOG: Record<
  ProviderKey,
  {
    displayName: string;
    category: ProviderStatus['category'];
    requiresSubscription: boolean;
    requiredEnvVars: string[];
    costPerQueryUsd: number;
    statusNote: string;
  }
> = {
  manifold_inventory: {
    displayName: 'MANIFOLD Internal Inventory & Approved Observations',
    category: 'internal_inventory',
    requiresSubscription: false,
    requiredEnvVars: [],
    costPerQueryUsd: 0,
    statusNote: 'Reads verified MANIFOLD dealer listings and approved market observations directly from Supabase.',
  },
  approved_feed: {
    displayName: 'Approved Market Data Sources (Permitted Feeds)',
    category: 'approved_feed',
    requiresSubscription: false,
    requiredEnvVars: [],
    costPerQueryUsd: 0,
    statusNote: 'Crawls only explicitly enabled, public, non-protected feeds in public.market_data_sources.',
  },
  serper: {
    displayName: 'Serper.dev Google Search API (Nigeria)',
    category: 'search_api',
    requiresSubscription: true,
    requiredEnvVars: ['SERPER_API_KEY'],
    costPerQueryUsd: 0.001,
    statusNote: 'Server-side web search via Serper.dev (gl=ng) returning Nigerian automotive listing pages and snippets.',
  },
  google_cse: {
    displayName: 'Google Programmable Search Engine (CSE)',
    category: 'search_api',
    requiresSubscription: true,
    requiredEnvVars: ['GOOGLE_CSE_API_KEY', 'GOOGLE_CSE_ID'],
    costPerQueryUsd: 0.005,
    statusNote: 'Official Google Custom Search JSON API scoped to permitted Nigerian automotive domains.',
  },
  brave_search: {
    displayName: 'Brave Web Search API',
    category: 'search_api',
    requiresSubscription: true,
    requiredEnvVars: ['BRAVE_SEARCH_API_KEY'],
    costPerQueryUsd: 0.003,
    statusNote: 'Privacy-preserving web search index API with Nigeria country filtering.',
  },
};

export function isProviderConfigured(providerKey: ProviderKey): {
  configured: boolean;
  missingEnvVars: string[];
} {
  const env = getServerEnv();
  switch (providerKey) {
    case 'manifold_inventory':
    case 'approved_feed':
      return {
        configured: Boolean(env.supabaseUrl && env.supabaseAnonKey),
        missingEnvVars: env.supabaseUrl && env.supabaseAnonKey ? [] : ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
      };
    case 'serper':
      return {
        configured: Boolean(env.serperApiKey),
        missingEnvVars: env.serperApiKey ? [] : ['SERPER_API_KEY'],
      };
    case 'google_cse': {
      const missing: string[] = [];
      if (!env.googleCseApiKey) missing.push('GOOGLE_CSE_API_KEY');
      if (!env.googleCseId) missing.push('GOOGLE_CSE_ID');
      return { configured: missing.length === 0, missingEnvVars: missing };
    }
    case 'brave_search':
      return {
        configured: Boolean(env.braveSearchApiKey),
        missingEnvVars: env.braveSearchApiKey ? [] : ['BRAVE_SEARCH_API_KEY'],
      };
  }
}

export function getProvidersStatus(
  dailyCountsByProvider: Partial<Record<ProviderKey, number>> = {},
  dailyQuotaLimit: number | null = null
): ProviderStatus[] {
  const keys: ProviderKey[] = [
    'manifold_inventory',
    'approved_feed',
    'serper',
    'google_cse',
    'brave_search',
  ];

  return keys.map((key) => {
    const meta = PROVIDER_CATALOG[key];
    const cfg = isProviderConfigured(key);
    return {
      key,
      displayName: meta.displayName,
      category: meta.category,
      configured: cfg.configured,
      requiresSubscription: meta.requiresSubscription,
      requiredEnvVars: meta.requiredEnvVars,
      missingEnvVars: cfg.missingEnvVars,
      costPerQueryUsd: meta.costPerQueryUsd,
      dailyQuotaLimit: meta.category === 'search_api' ? dailyQuotaLimit : null,
      queriesToday: dailyCountsByProvider[key] ?? 0,
      statusNote: cfg.configured
        ? meta.statusNote
        : `Not configured. Set ${cfg.missingEnvVars.join(' & ')} in server environment variables to enable.`,
    };
  });
}

export function extractNairaPriceFromText(text: string | null | undefined): number | null {
  const raw = String(text || '');
  if (!raw) return null;

  // Match explicit Naira amounts like ₦24,500,000 or NGN 24,500,000 or N24,500,000
  const nairaFullMatch = raw.match(/(?:₦|NGN|N)\s*([0-9]{1,3}(?:,[0-9]{3}){2,}|[0-9]{7,10})\b/i);
  if (nairaFullMatch?.[1]) {
    const val = parseInt(nairaFullMatch[1].replace(/,/g, ''), 10);
    if (val >= 400_000 && val <= 900_000_000) return val;
  }

  // Match shorthand millions like ₦24.5m or 24.5 million
  const millionMatch = raw.match(/(?:₦|NGN)?\s*([0-9]{1,3}(?:\.[0-9]{1,2})?)\s*(?:m|million)\b/i);
  if (millionMatch?.[1]) {
    const val = Math.round(parseFloat(millionMatch[1]) * 1_000_000);
    if (val >= 400_000 && val <= 900_000_000) return val;
  }

  return null;
}

export function parseSerperResponse(payload: any): RawSearchResult[] {
  const organic = Array.isArray(payload?.organic) ? payload.organic : [];
  const results: RawSearchResult[] = [];
  for (const item of organic) {
    const url = String(item?.link || '').trim();
    if (!url.startsWith('http')) continue;
    const title = String(item?.title || '').trim();
    const snippet = String(item?.snippet || '').trim();
    results.push({
      providerKey: 'serper',
      title,
      url,
      snippet,
      sourceDomain: extractDomainFromUrl(url),
      publishedDate: typeof item?.date === 'string' ? item.date : null,
      detectedPriceNgn: extractNairaPriceFromText(`${title} ${snippet}`),
    });
  }
  return results;
}

export function parseGoogleCseResponse(payload: any): RawSearchResult[] {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const results: RawSearchResult[] = [];
  for (const item of items) {
    const url = String(item?.link || '').trim();
    if (!url.startsWith('http')) continue;
    const title = String(item?.title || '').trim();
    const snippet = String(item?.snippet || '').trim();
    results.push({
      providerKey: 'google_cse',
      title,
      url,
      snippet,
      sourceDomain: extractDomainFromUrl(url),
      publishedDate: null,
      detectedPriceNgn: extractNairaPriceFromText(`${title} ${snippet}`),
    });
  }
  return results;
}

export function parseBraveSearchResponse(payload: any): RawSearchResult[] {
  const webResults = Array.isArray(payload?.web?.results) ? payload.web.results : [];
  const results: RawSearchResult[] = [];
  for (const item of webResults) {
    const url = String(item?.url || '').trim();
    if (!url.startsWith('http')) continue;
    const title = String(item?.title || '').trim();
    const snippet = String(item?.description || '').trim();
    results.push({
      providerKey: 'brave_search',
      title,
      url,
      snippet,
      sourceDomain: extractDomainFromUrl(url),
      publishedDate: typeof item?.age === 'string' ? item.age : null,
      detectedPriceNgn: extractNairaPriceFromText(`${title} ${snippet}`),
    });
  }
  return results;
}

export async function executeProviderSearch(params: {
  providerKey: ProviderKey;
  target: SearchQueryTarget;
  maxResults?: number;
  supabase?: SupabaseClient | null;
}): Promise<{
  ok: boolean;
  providerKey: ProviderKey;
  httpStatus?: number;
  latencyMs: number;
  costUsd: number;
  results: RawSearchResult[];
  error?: string;
  notice?: string;
}> {
  const { providerKey, target } = params;
  const maxResults = Math.min(Math.max(params.maxResults ?? 6, 1), 10);
  const startedAt = Date.now();
  const cfg = isProviderConfigured(providerKey);
  const hasExplicitSupabase =
    (providerKey === 'approved_feed' || providerKey === 'manifold_inventory') &&
    Boolean(params.supabase);

  if (!cfg.configured && !hasExplicitSupabase) {
    return {
      ok: false,
      providerKey,
      latencyMs: Date.now() - startedAt,
      costUsd: 0,
      results: [],
      error: `Provider ${providerKey} not configured (missing: ${cfg.missingEnvVars.join(', ')}).`,
    };
  }

  const env = getServerEnv();

  if (providerKey === 'serper') {
    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': env.serperApiKey!,
        },
        body: JSON.stringify({
          q: target.queryText,
          gl: 'ng',
          hl: 'en',
          num: maxResults,
        }),
        signal: AbortSignal.timeout(12000),
      });

      const latencyMs = Date.now() - startedAt;
      if (!response.ok) {
        return {
          ok: false,
          providerKey,
          httpStatus: response.status,
          latencyMs,
          costUsd: PROVIDER_CATALOG.serper.costPerQueryUsd,
          results: [],
          error: `Serper HTTP ${response.status}`,
        };
      }

      const json = await response.json();
      return {
        ok: true,
        providerKey,
        httpStatus: response.status,
        latencyMs,
        costUsd: PROVIDER_CATALOG.serper.costPerQueryUsd,
        results: parseSerperResponse(json).slice(0, maxResults),
      };
    } catch (err: any) {
      return {
        ok: false,
        providerKey,
        latencyMs: Date.now() - startedAt,
        costUsd: 0,
        results: [],
        error: err?.message || 'Serper search request failed.',
      };
    }
  }

  if (providerKey === 'google_cse') {
    try {
      const url = new URL('https://www.googleapis.com/customsearch/v1');
      url.searchParams.set('key', env.googleCseApiKey!);
      url.searchParams.set('cx', env.googleCseId!);
      url.searchParams.set('q', target.queryText);
      url.searchParams.set('gl', 'ng');
      url.searchParams.set('num', String(maxResults));

      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: AbortSignal.timeout(12000),
      });

      const latencyMs = Date.now() - startedAt;
      if (!response.ok) {
        return {
          ok: false,
          providerKey,
          httpStatus: response.status,
          latencyMs,
          costUsd: PROVIDER_CATALOG.google_cse.costPerQueryUsd,
          results: [],
          error: `Google CSE HTTP ${response.status}`,
        };
      }

      const json = await response.json();
      return {
        ok: true,
        providerKey,
        httpStatus: response.status,
        latencyMs,
        costUsd: PROVIDER_CATALOG.google_cse.costPerQueryUsd,
        results: parseGoogleCseResponse(json).slice(0, maxResults),
      };
    } catch (err: any) {
      return {
        ok: false,
        providerKey,
        latencyMs: Date.now() - startedAt,
        costUsd: 0,
        results: [],
        error: err?.message || 'Google CSE search request failed.',
      };
    }
  }

  if (providerKey === 'brave_search') {
    try {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.set('q', target.queryText);
      url.searchParams.set('country', 'NG');
      url.searchParams.set('count', String(maxResults));

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': env.braveSearchApiKey!,
        },
        signal: AbortSignal.timeout(12000),
      });

      const latencyMs = Date.now() - startedAt;
      if (!response.ok) {
        return {
          ok: false,
          providerKey,
          httpStatus: response.status,
          latencyMs,
          costUsd: PROVIDER_CATALOG.brave_search.costPerQueryUsd,
          results: [],
          error: `Brave Search HTTP ${response.status}`,
        };
      }

      const json = await response.json();
      return {
        ok: true,
        providerKey,
        httpStatus: response.status,
        latencyMs,
        costUsd: PROVIDER_CATALOG.brave_search.costPerQueryUsd,
        results: parseBraveSearchResponse(json).slice(0, maxResults),
      };
    } catch (err: any) {
      return {
        ok: false,
        providerKey,
        latencyMs: Date.now() - startedAt,
        costUsd: 0,
        results: [],
        error: err?.message || 'Brave Search request failed.',
      };
    }
  }

  if (providerKey === 'approved_feed') {
    if (!params.supabase) {
      return {
        ok: false,
        providerKey,
        latencyMs: Date.now() - startedAt,
        costUsd: 0,
        results: [],
        error: 'Supabase client unavailable for approved_feed lookup.',
      };
    }

    try {
      const { data: sources, error } = await params.supabase
        .from('market_data_sources')
        .select(
          'id, source_name, source_type, base_url, trust_level, is_active, crawl_enabled, crawl_frequency_hours, fetch_settings'
        )
        .eq('is_active', true)
        .eq('crawl_enabled', true)
        .limit(8);

      if (error) {
        return {
          ok: false,
          providerKey,
          latencyMs: Date.now() - startedAt,
          costUsd: 0,
          results: [],
          error: `market_data_sources query failed: ${error.message}`,
        };
      }

      if (!sources || sources.length === 0) {
        return {
          ok: true,
          providerKey,
          latencyMs: Date.now() - startedAt,
          costUsd: 0,
          results: [],
          notice: 'No active crawl-enabled sources configured in market_data_sources.',
        };
      }

      const feedResults: RawSearchResult[] = [];
      const fetchErrors: string[] = [];
      const targetMakeNorm = normalizeBrandName(target.make);
      const targetModelNorm = normalizeModelName(target.model);

      for (const src of sources.slice(0, 4)) {
        const baseUrl = String(src.base_url || '').trim();
        if (!baseUrl.startsWith('http')) continue;
        const page = await fetchListingPageSafe(baseUrl);
        if (!page.success) {
          fetchErrors.push(`${src.source_name || baseUrl}: ${page.error || page.status}`);
          continue;
        }

        const textLower = `${page.title || ''} ${page.extractedText || ''}`.toLowerCase();
        if (textLower.includes(targetMakeNorm) || textLower.includes(targetModelNorm)) {
          const resolvedUrl = normalizeListingUrl(page.finalUrl || baseUrl);
          feedResults.push({
            providerKey: 'approved_feed',
            title: page.title || src.source_name || baseUrl,
            url: resolvedUrl,
            snippet: (page.extractedText || '').slice(0, 600),
            sourceDomain: extractDomainFromUrl(resolvedUrl),
            publishedDate: page.fetchTimestamp,
            detectedPriceNgn: extractNairaPriceFromText(page.extractedText),
          });
        }
      }

      if (feedResults.length === 0 && fetchErrors.length > 0 && fetchErrors.length === sources.slice(0, 4).length) {
        return {
          ok: false,
          providerKey,
          latencyMs: Date.now() - startedAt,
          costUsd: 0,
          results: [],
          error: `All configured approved_feed sources failed fetch: ${fetchErrors.join('; ')}`,
        };
      }

      return {
        ok: true,
        providerKey,
        latencyMs: Date.now() - startedAt,
        costUsd: 0,
        results: feedResults,
        notice: fetchErrors.length > 0 ? fetchErrors.join('; ') : undefined,
      };
    } catch (err: any) {
      return {
        ok: false,
        providerKey,
        latencyMs: Date.now() - startedAt,
        costUsd: 0,
        results: [],
        error: err?.message || 'Failed reading approved feeds.',
      };
    }
  }

  // manifold_inventory provider: confirms baseline internal coverage without external scraping
  if (providerKey === 'manifold_inventory') {
    if (!params.supabase) {
      return {
        ok: false,
        providerKey,
        latencyMs: Date.now() - startedAt,
        costUsd: 0,
        results: [],
        error: 'Supabase client unavailable.',
      };
    }

    try {
      const { data, error } = await params.supabase
        .from('cars')
        .select('id, make, model, trim, year, condition, price, location, state, created_at')
        .ilike('make', target.make)
        .in('status', ['PUBLISHED', 'published'])
        .limit(20);

      if (error) {
        return {
          ok: false,
          providerKey,
          latencyMs: Date.now() - startedAt,
          costUsd: 0,
          results: [],
          error: error.message,
        };
      }

      const normTargetModel = normalizeModelName(target.model);
      const matching = (data || []).filter(
        (c) => normalizeModelName(c.model) === normTargetModel
      );

      return {
        ok: true,
        providerKey,
        latencyMs: Date.now() - startedAt,
        costUsd: 0,
        results: matching.slice(0, maxResults).map((row) => ({
          providerKey: 'manifold_inventory' as const,
          title: `${row.year} ${row.make} ${row.model}${row.trim ? ` ${row.trim}` : ''} (${formatMarketCategoryLabel(target.marketCategory)})`,
          url: `https://manifold.ng/cars/${row.id}`,
          snippet: `${row.condition || 'Foreign Used'} · ₦${Number(row.price || 0).toLocaleString()} · ${row.location || row.state || 'Nigeria'}`,
          sourceDomain: 'manifold.ng',
          publishedDate: row.created_at,
          detectedPriceNgn: Number(row.price || 0) || null,
        })),
      };
    } catch (err: any) {
      return {
        ok: false,
        providerKey,
        latencyMs: Date.now() - startedAt,
        costUsd: 0,
        results: [],
        error: err?.message || 'Failed reading internal inventory.',
      };
    }
  }

  return {
    ok: false,
    providerKey,
    latencyMs: Date.now() - startedAt,
    costUsd: 0,
    results: [],
    error: `Unknown provider ${providerKey}`,
  };
}

export async function testProviderConnection(
  providerKey: ProviderKey,
  supabase?: SupabaseClient | null
): Promise<{
  providerKey: ProviderKey;
  configured: boolean;
  connected: boolean;
  latencyMs: number;
  httpStatus?: number;
  resultCount: number;
  message: string;
  sampleTitle?: string;
}> {
  const cfg = isProviderConfigured(providerKey);
  if (!cfg.configured) {
    return {
      providerKey,
      configured: false,
      connected: false,
      latencyMs: 0,
      resultCount: 0,
      message: `Not configured: missing ${cfg.missingEnvVars.join(', ')}.`,
    };
  }

  const probeTarget: SearchQueryTarget = {
    make: 'Toyota',
    model: 'Camry',
    year: 2021,
    trim: null,
    marketCategory: 'foreign_used',
    location: 'Lagos',
    queryText: '2021 Toyota Camry foreign used Lagos price Nigeria',
    demandScore: 10,
    reason: 'provider_connection_test',
  };

  const result = await executeProviderSearch({
    providerKey,
    target: probeTarget,
    maxResults: 2,
    supabase,
  });

  return {
    providerKey,
    configured: true,
    connected: result.ok,
    latencyMs: result.latencyMs,
    httpStatus: result.httpStatus,
    resultCount: result.results.length,
    sampleTitle: result.results[0]?.title,
    message: result.ok
      ? result.notice
        ? `Connected (${result.latencyMs}ms): ${result.notice}`
        : `Connected cleanly (${result.latencyMs}ms · ${result.results.length} result(s)).`
      : `Connection failed: ${result.error || 'Unknown error'}`,
  };
}
