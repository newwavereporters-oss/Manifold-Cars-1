import type { SupabaseClient } from '@supabase/supabase-js';
import { runStructuredJsonResponse } from '../../lib/openai.js';
import { getSupabaseClient } from '../../lib/supabaseServer.js';

const MARKET_INSIGHTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'executiveSummary',
    'supplyAndPricingSignals',
    'unmetBuyerDemandSignals',
    'recommendedActions',
  ],
  properties: {
    executiveSummary: { type: 'string' },
    supplyAndPricingSignals: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    unmetBuyerDemandSignals: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    recommendedActions: { type: 'array', items: { type: 'string' }, maxItems: 5 },
  },
};

function topN<T extends string>(items: T[], limit = 6): Array<{ name: T; count: number }> {
  const counts = new Map<T, number>();
  for (const item of items) {
    if (!item) continue;
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

export async function generateMarketIntelligenceInsights(params: {
  role: 'admin' | 'dealer';
  dealerId?: string;
  dealerBusinessName?: string;
  includeAiSummary?: boolean;
  focusTopic?: string;
  supabase?: SupabaseClient | null;
  modelOverride?: string | null;
  maxOutputTokens?: number;
}) {
  const supabase = params.supabase ?? getSupabaseClient();
  if (!supabase) {
    throw new Error('Database connection unavailable for Market Intelligence synthesis.');
  }

  const isAdmin = params.role === 'admin';

  // 1. Internal MANIFOLD Data
  let carsQuery = supabase
    .from('cars')
    .select('id, make, model, body_type, year, price, condition, location, state, status, views_count, dealer_id, created_at')
    .order('created_at', { ascending: false })
    .limit(250);

  if (!isAdmin && params.dealerId) {
    carsQuery = carsQuery.eq('dealer_id', params.dealerId);
  }

  const [carsRes, approvedObsRes, searchAnalyticsRes, inquiriesRes, huntRes] = await Promise.all([
    carsQuery,
    supabase
      .from('market_price_observations')
      .select('make, model, year, price, location, source_name, observed_at, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(120),
    supabase
      .from('ai_search_analytics')
      .select('query_text, parsed_make, parsed_model, parsed_body_type, parsed_location, budget_max, zero_results, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    isAdmin
      ? supabase
          .from('buyer_inquiries')
          .select('car_title, car_price, location, status, created_at')
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: null, error: null }),
    isAdmin
      ? supabase
          .from('car_hunt_requests')
          .select('budget_max, location, year_min, status, created_at')
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const cars = (!carsRes.error && Array.isArray(carsRes.data)) ? carsRes.data : [];
  const publishedCars = isAdmin
    ? cars.filter((c: any) => String(c.status || '').toUpperCase() === 'PUBLISHED')
    : cars;

  const approvedObservations =
    !approvedObsRes.error && Array.isArray(approvedObsRes.data) ? approvedObsRes.data : [];
  const searchRows =
    !searchAnalyticsRes.error && Array.isArray(searchAnalyticsRes.data) ? searchAnalyticsRes.data : [];
  const inquiries =
    isAdmin && inquiriesRes && !inquiriesRes.error && Array.isArray(inquiriesRes.data)
      ? inquiriesRes.data
      : [];
  const hunts =
    isAdmin && huntRes && !huntRes.error && Array.isArray(huntRes.data) ? huntRes.data : [];

  // Aggregate budget distribution safely
  const budgetBuckets = {
    under20M: 0,
    from20Mto45M: 0,
    from45Mto90M: 0,
    over90M: 0,
  };
  for (const c of publishedCars) {
    const p = Number(c.price || 0);
    if (p < 20_000_000) budgetBuckets.under20M += 1;
    else if (p < 45_000_000) budgetBuckets.from20Mto45M += 1;
    else if (p < 90_000_000) budgetBuckets.from45Mto90M += 1;
    else budgetBuckets.over90M += 1;
  }

  const zeroResultRows = searchRows.filter((r: any) => r.zero_results);

  const internalPlatformData = {
    scope: isAdmin ? 'platform_wide' : `dealer_only:${params.dealerBusinessName || params.dealerId}`,
    inventoryCount: publishedCars.length,
    topMakesInInventory: topN(publishedCars.map((c: any) => String(c.make || ''))),
    topBodyTypesInInventory: topN(publishedCars.map((c: any) => String(c.body_type || ''))),
    topLocationsInInventory: topN(publishedCars.map((c: any) => String(c.state || c.location || ''))),
    budgetBrackets: budgetBuckets,
    searchVolumeTracked: searchRows.length,
    topSearchedMakes: topN(searchRows.map((r: any) => String(r.parsed_make || '')).filter(Boolean)),
    topSearchedBodyTypes: topN(
      searchRows.map((r: any) => String(r.parsed_body_type || '')).filter(Boolean)
    ),
    topSearchedLocations: topN(
      searchRows.map((r: any) => String(r.parsed_location || '')).filter(Boolean)
    ),
    zeroResultSearchCount: zeroResultRows.length,
    topUnmetQueries: topN(zeroResultRows.map((r: any) => String(r.query_text || '')), 5),
    ...(isAdmin
      ? {
          totalRecentInquiries: inquiries.length,
          totalRecentCarHunts: hunts.length,
        }
      : {}),
  };

  // Verified External Market Data summary with explicit source attribution and observation date
  const extByMake = new Map<
    string,
    { make: string; count: number; totalPrice: number; sources: Set<string>; latestDate: string }
  >();
  for (const obs of approvedObservations) {
    const make = String(obs.make || 'Unknown');
    const existing = extByMake.get(make) || {
      make,
      count: 0,
      totalPrice: 0,
      sources: new Set<string>(),
      latestDate: '',
    };
    existing.count += 1;
    existing.totalPrice += Number(obs.price || 0);
    if (obs.source_name) existing.sources.add(String(obs.source_name));
    const dateStr = String(obs.observed_at || obs.created_at || '').slice(0, 10);
    if (dateStr > existing.latestDate) existing.latestDate = dateStr;
    extByMake.set(make, existing);
  }

  const verifiedExternalData = {
    approvedObservationCount: approvedObservations.length,
    byMakeSummary: Array.from(extByMake.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((item) => ({
        make: item.make,
        sampleCount: item.count,
        avgAskingPriceNgn: Math.round(item.totalPrice / Math.max(1, item.count)),
        sources: Array.from(item.sources),
        latestObservedDate: item.latestDate,
      })),
  };

  if (params.includeAiSummary === false) {
    return {
      internalPlatformData,
      verifiedExternalData,
      aiInterpretation: null,
      usage: null,
    };
  }

  const instructions = `You are MANIFOLD Automotive Market Intelligence Strategist.
Analyze ONLY the supplied verified metrics. Clearly ground recommendations in Internal MANIFOLD Data vs Verified External Data.
${
  isAdmin
    ? 'Scope: Platform-wide executive strategy across inventory, buyer search gaps, enquiries, and approved external benchmarks.'
    : 'Scope: Single approved dealership view. Tailor advice to this dealer’s inventory positioning and anonymized buyer search demand without assuming competitor data.'
}
${params.focusTopic ? `User focus topic: ${params.focusTopic}` : ''}
NEVER invent statistics or external prices not listed in the payload.`;

  const aiResult = await runStructuredJsonResponse<{
    executiveSummary: string;
    supplyAndPricingSignals: string[];
    unmetBuyerDemandSignals: string[];
    recommendedActions: string[];
  }>({
    instructions,
    input: JSON.stringify({
      internalPlatformData,
      verifiedExternalData,
    }),
    schemaName: 'manifold_market_intelligence_synthesis',
    schema: MARKET_INSIGHTS_SCHEMA,
    modelOverride: params.modelOverride,
    maxOutputTokens: Math.min(params.maxOutputTokens ?? 900, 1200),
    temperature: 0.3,
  });

  return {
    internalPlatformData,
    verifiedExternalData,
    aiInterpretation: {
      ...aiResult.data,
      disclaimer:
        'AI-generated interpretation synthesized strictly from live MANIFOLD platform metrics and admin-approved external market observations.',
    },
    usage: {
      model: aiResult.model,
      responseId: aiResult.responseId,
      inputTokens: aiResult.inputTokens,
      outputTokens: aiResult.outputTokens,
      totalTokens: aiResult.totalTokens,
      latencyMs: aiResult.latencyMs,
    },
  };
}
