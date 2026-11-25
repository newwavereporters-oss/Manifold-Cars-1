import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { runStructuredJsonResponse } from '../../lib/openai.js';
import { getSupabaseClient } from '../../lib/supabaseServer.js';
import { calculateMarketPriceEstimate } from '../pricingAgent/calculator.js';
import { extractDomainFromUrl, normalizeListingUrl } from '../pricingAgent/deduplicator.js';
import {
  formatMarketCategoryLabel,
  normalizeBrandName,
  normalizeMarketCategory,
  normalizeModelName,
} from '../pricingAgent/matcher.js';
import type {
  ConfidenceBreakdown,
  MarketCategory,
  MatchCandidate,
  PriceDistributionSummary,
} from '../pricingAgent/types.js';

export const PriceIntelligenceRequestSchema = z.object({
  carId: z.string().trim().max(120).optional(),
  make: z.string().trim().min(1, 'Make is required for price intelligence.').max(80),
  model: z.string().trim().min(1, 'Model is required for price intelligence.').max(80),
  year: z.number().int().min(1985).max(2028).optional(),
  trim: z.string().trim().max(80).optional(),
  condition: z.string().trim().max(60).optional(),
  mileage: z.number().nonnegative().max(2_000_000).optional(),
  location: z.string().trim().max(120).optional(),
  askingPrice: z.number().nonnegative().max(10_000_000_000).optional(),
  includeAiCommentary: z.boolean().default(true),
});

export type PriceIntelligenceInput = z.infer<typeof PriceIntelligenceRequestSchema>;

export interface ComparableSample {
  id: string;
  label: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  condition: string;
  mileage: number | null;
  location: string;
  price: number;
  sourceType: 'internal_asking' | 'external_observation';
  sourceLabel: string;
  observedDate: string;
  similarityScore: number;
}

export interface PriceHistoryPoint {
  date: string;
  medianPrice: number | null;
  validObservationCount: number;
  confidenceLevel: string;
}

export interface DeterministicPriceStats {
  insufficientData: boolean;
  insufficiencyReason: string | null;
  marketCategory: MarketCategory;
  marketCategoryLabel: string;
  sampleCount: number;
  internalAskingCount: number;
  externalObservationCount: number;
  completedSalesCount: number;
  outliersExcludedCount: number;
  duplicatesExcludedCount: number;
  minPrice: number | null;
  q1Price: number | null;
  medianPrice: number | null;
  meanPrice: number | null;
  q3Price: number | null;
  maxPrice: number | null;
  recommendedRangeLow: number | null;
  recommendedRangeHigh: number | null;
  askingPrice: number | null;
  askingVsMedianPct: number | null;
  positioning: 'below_market' | 'competitive' | 'above_market' | 'insufficient_data';
  confidence: 'high' | 'moderate' | 'low' | 'insufficient';
  confidenceScore: number;
  confidenceBreakdown: ConfidenceBreakdown;
  priceDistribution: PriceDistributionSummary;
  lastResearchAt: string | null;
  priceHistory: PriceHistoryPoint[];
  comparables: ComparableSample[];
  methodologyNote: string;
}

const PRICING_COMMENTARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headlineSummary', 'pricingRationale', 'dealerGuidance', 'buyerTransparencyNote'],
  properties: {
    headlineSummary: { type: 'string' },
    pricingRationale: { type: 'string' },
    dealerGuidance: { type: 'string' },
    buyerTransparencyNote: { type: 'string' },
  },
};

export function computeDeterministicPriceStats(params: {
  input: PriceIntelligenceInput;
  comparables: ComparableSample[];
  completedSalesCount: number;
  additionalDuplicateCount?: number;
  lastResearchAt?: string | null;
  priceHistory?: PriceHistoryPoint[];
}): DeterministicPriceStats {
  const { input, comparables, completedSalesCount } = params;
  const subjectCategory = normalizeMarketCategory(input.condition);

  const matchCandidates: MatchCandidate[] = comparables
    .filter((c) => Number.isFinite(c.price) && c.price >= 300_000)
    .map((c) => ({
      id: c.id,
      make: c.make,
      model: c.model,
      year: c.year,
      trim: c.trim,
      marketCategory: normalizeMarketCategory(c.condition),
      condition: c.condition,
      mileage: c.mileage,
      location: c.location,
      price: c.price,
      currency: 'NGN',
      sourceWebsite: c.sourceLabel,
      sourceTrustLevel: c.sourceType === 'internal_asking' ? 'official' : 'verified',
      observedAt: c.observedDate || new Date().toISOString(),
      isDuplicate: false,
      sourceType: c.sourceType,
    }));

  const calculated = calculateMarketPriceEstimate({
    subject: {
      make: input.make,
      model: input.model,
      year: input.year ?? null,
      trim: input.trim ?? null,
      marketCategory: subjectCategory,
      mileage: input.mileage ?? null,
      location: input.location ?? null,
    },
    candidates: matchCandidates,
    additionalDuplicateCount: params.additionalDuplicateCount ?? 0,
  });

  const askingPrice = input.askingPrice && input.askingPrice > 0 ? input.askingPrice : null;

  let askingVsMedianPct: number | null = null;
  let positioning: DeterministicPriceStats['positioning'] = 'insufficient_data';
  if (!calculated.insufficientData && calculated.medianPrice) {
    positioning = 'competitive';
    if (askingPrice && calculated.medianPrice > 0) {
      askingVsMedianPct = Number(
        (((askingPrice - calculated.medianPrice) / calculated.medianPrice) * 100).toFixed(1)
      );
      if (askingVsMedianPct <= -8) positioning = 'below_market';
      else if (askingVsMedianPct >= 10) positioning = 'above_market';
      else positioning = 'competitive';
    }
  }

  const mappedConfidence: DeterministicPriceStats['confidence'] =
    calculated.confidenceLevel === 'medium'
      ? 'moderate'
      : calculated.confidenceLevel;

  const comparableSamples: ComparableSample[] = calculated.matchedSamples.slice(0, 8).map((s) => ({
    id: s.id,
    label: `${s.year} ${s.make} ${s.model}${s.trim ? ` ${s.trim}` : ''}`,
    year: s.year,
    make: s.make,
    model: s.model,
    trim: s.trim || null,
    condition: s.condition || formatMarketCategoryLabel(s.marketCategory),
    mileage: s.mileage ?? null,
    location: s.location || 'Nigeria',
    price: s.price,
    sourceType: s.sourceType,
    sourceLabel: s.sourceWebsite || 'Verified Market Observation',
    observedDate: String(s.observedAt || '').slice(0, 10),
    similarityScore: s.matchScore,
  }));

  return {
    insufficientData: calculated.insufficientData,
    insufficiencyReason: calculated.insufficiencyReason,
    marketCategory: subjectCategory,
    marketCategoryLabel: formatMarketCategoryLabel(subjectCategory),
    sampleCount: calculated.validObservationCount,
    internalAskingCount: calculated.internalListingCount,
    externalObservationCount: calculated.externalObservationCount,
    completedSalesCount,
    outliersExcludedCount: calculated.priceDistribution.outliersExcludedCount,
    duplicatesExcludedCount: calculated.duplicateObservationCount,
    minPrice: calculated.minPrice,
    q1Price: calculated.q1Price,
    medianPrice: calculated.medianPrice,
    meanPrice: calculated.meanPrice,
    q3Price: calculated.q3Price,
    maxPrice: calculated.maxPrice,
    recommendedRangeLow: calculated.priceRangeLow,
    recommendedRangeHigh: calculated.priceRangeHigh,
    askingPrice,
    askingVsMedianPct,
    positioning,
    confidence: mappedConfidence,
    confidenceScore: calculated.confidenceScore,
    confidenceBreakdown: calculated.confidenceBreakdown,
    priceDistribution: calculated.priceDistribution,
    lastResearchAt: params.lastResearchAt ?? calculated.lastResearchAt,
    priceHistory: params.priceHistory ?? [],
    comparables: comparableSamples,
    methodologyNote: `${calculated.estimationMethodology} Dealers retain full pricing autonomy.`,
  };
}

export async function runVehiclePriceIntelligence(params: {
  input: PriceIntelligenceInput;
  role: 'admin' | 'dealer' | 'buyer' | 'anonymous';
  supabase?: SupabaseClient | null;
  modelOverride?: string | null;
  maxOutputTokens?: number;
}) {
  const supabase = params.supabase ?? getSupabaseClient();
  const { input } = params;
  const normalizedTargetMake = normalizeBrandName(input.make);
  const normalizedTargetModel = normalizeModelName(input.model);
  const subjectCategory = normalizeMarketCategory(input.condition);

  const comparables: ComparableSample[] = [];
  let completedSalesCount = 0;
  let duplicateExcludedCount = 0;
  let lastResearchAt: string | null = null;
  let priceHistory: PriceHistoryPoint[] = [];

  if (supabase) {
    const [carsRes, obsRes] = await Promise.all([
      supabase
        .from('cars')
        .select('id, make, model, trim, year, condition, mileage, location, state, price, created_at')
        .ilike('make', input.make)
        .in('status', ['PUBLISHED', 'published'])
        .limit(120),
      supabase
        .from('market_price_observations')
        .select(
          'id, make, model, trim, year, condition, market_category, mileage, location, price, source_name, source_url, publisher, observed_at, created_at, is_duplicate, quality_status, status'
        )
        .eq('status', 'approved')
        .ilike('make', input.make)
        .limit(150),
    ]);

    if (!carsRes.error && Array.isArray(carsRes.data)) {
      for (const row of carsRes.data) {
        if (input.carId && row.id === input.carId) continue;
        if (
          normalizeBrandName(row.make) !== normalizedTargetMake ||
          normalizeModelName(row.model) !== normalizedTargetModel
        ) {
          continue;
        }

        comparables.push({
          id: String(row.id),
          label: `${row.year} ${row.make} ${row.model}${row.trim ? ` ${row.trim}` : ''}`,
          year: Number(row.year),
          make: String(row.make),
          model: String(row.model),
          trim: row.trim || null,
          condition: String(row.condition || 'Foreign Used'),
          mileage: row.mileage !== null && row.mileage !== undefined ? Number(row.mileage) : null,
          location: String(row.location || row.state || 'Nigeria'),
          price: Number(row.price),
          sourceType: 'internal_asking',
          sourceLabel: 'MANIFOLD Verified Listing (Asking)',
          observedDate: String(row.created_at || '').slice(0, 10),
          similarityScore: 90,
        });
      }
    }

    const seenUrls = new Set<string>();
    if (!obsRes.error && Array.isArray(obsRes.data)) {
      for (const row of obsRes.data) {
        if (
          normalizeBrandName(row.make) !== normalizedTargetMake ||
          normalizeModelName(row.model) !== normalizedTargetModel
        ) {
          continue;
        }
        if (row.is_duplicate || row.quality_status === 'rejected' || row.quality_status === 'outlier_excluded') {
          if (row.is_duplicate) duplicateExcludedCount++;
          continue;
        }

        const normUrl = normalizeListingUrl(row.source_url);
        if (normUrl && seenUrls.has(normUrl)) {
          duplicateExcludedCount++;
          continue;
        }
        if (normUrl) seenUrls.add(normUrl);

        const sourceName = row.source_name || row.publisher || extractDomainFromUrl(row.source_url);
        comparables.push({
          id: String(row.id),
          label: `${row.year} ${row.make} ${row.model}${row.trim ? ` ${row.trim}` : ''}`,
          year: Number(row.year),
          make: String(row.make),
          model: String(row.model),
          trim: row.trim || null,
          condition: String(
            row.condition ||
              (row.market_category ? formatMarketCategoryLabel(row.market_category) : 'Unknown')
          ),
          mileage: row.mileage !== null && row.mileage !== undefined ? Number(row.mileage) : null,
          location: String(row.location || 'Nigeria'),
          price: Number(row.price),
          sourceType: 'external_observation',
          sourceLabel: sourceName ? `${sourceName} (Observed Asking)` : 'Verified Market Observation',
          observedDate: String(row.observed_at || row.created_at || '').slice(0, 10),
          similarityScore: 85,
        });
      }
    }

    // Fetch historical estimate snapshots & latest agent research timestamp when migrated
    try {
      let estQuery = supabase
        .from('market_price_estimates')
        .select('median_price, valid_observation_count, confidence_level, last_research_at')
        .ilike('make', input.make)
        .ilike('model', `%${input.model}%`)
        .order('last_research_at', { ascending: false })
        .limit(12);

      if (subjectCategory !== 'unknown') {
        estQuery = estQuery.eq('market_category', subjectCategory);
      }
      const { data: estRows } = await estQuery;
      if (Array.isArray(estRows) && estRows.length > 0) {
        lastResearchAt = estRows[0].last_research_at || null;
        priceHistory = estRows
          .slice()
          .reverse()
          .map((e) => ({
            date: String(e.last_research_at || '').slice(0, 10),
            medianPrice: e.median_price ? Number(e.median_price) : null,
            validObservationCount: Number(e.valid_observation_count || 0),
            confidenceLevel: String(e.confidence_level || 'insufficient'),
          }));
      }
    } catch {
      // Table may not exist before migration
    }

    if (params.role === 'admin' || params.role === 'dealer') {
      try {
        const { count } = await supabase
          .from('cars')
          .select('id', { count: 'exact', head: true })
          .ilike('make', input.make)
          .ilike('model', `%${input.model}%`)
          .in('status', ['SOLD', 'sold']);
        completedSalesCount = count || 0;
      } catch {
        completedSalesCount = 0;
      }
    }
  }

  const stats = computeDeterministicPriceStats({
    input,
    comparables,
    completedSalesCount,
    additionalDuplicateCount: duplicateExcludedCount,
    lastResearchAt,
    priceHistory,
  });

  if (stats.insufficientData || !input.includeAiCommentary) {
    return {
      stats,
      commentary: null,
      usage: null,
    };
  }

  const instructions = `You are MANIFOLD Price Intelligence Analyst for the Nigerian automotive market.
Explain the deterministic pricing statistics provided in the JSON payload.
STRICT RULES:
1. NEVER invent prices, percentages, or comparables not present in the computed statistics.
2. Explicitly distinguish asking-price comparables from completed sales (if completedSalesCount is 0, clearly note figures represent market asking benchmarks).
3. Emphasize market category isolation (Foreign Used vs Nigerian Used vs Brand New) when interpreting the range.
4. Respect dealer pricing autonomy: offer objective market context rather than commanding a mandatory price.
5. Keep numbers formatted cleanly in Naira (₦).`;

  const aiResult = await runStructuredJsonResponse<{
    headlineSummary: string;
    pricingRationale: string;
    dealerGuidance: string;
    buyerTransparencyNote: string;
  }>({
    instructions,
    input: JSON.stringify({
      subjectVehicle: {
        year: input.year,
        make: input.make,
        model: input.model,
        trim: input.trim,
        marketCategory: stats.marketCategoryLabel,
        mileage: input.mileage,
        location: input.location,
        askingPrice: stats.askingPrice,
      },
      computedStats: {
        sampleCount: stats.sampleCount,
        internalAskingCount: stats.internalAskingCount,
        externalObservationCount: stats.externalObservationCount,
        outliersExcludedCount: stats.outliersExcludedCount,
        duplicatesExcludedCount: stats.duplicatesExcludedCount,
        completedSalesCount: stats.completedSalesCount,
        minPrice: stats.minPrice,
        q1Price: stats.q1Price,
        medianPrice: stats.medianPrice,
        q3Price: stats.q3Price,
        recommendedRangeLow: stats.recommendedRangeLow,
        recommendedRangeHigh: stats.recommendedRangeHigh,
        maxPrice: stats.maxPrice,
        askingVsMedianPct: stats.askingVsMedianPct,
        positioning: stats.positioning,
        confidence: stats.confidence,
        confidenceScore: stats.confidenceScore,
      },
    }),
    schemaName: 'manifold_price_intelligence_commentary',
    schema: PRICING_COMMENTARY_SCHEMA,
    modelOverride: params.modelOverride,
    maxOutputTokens: Math.min(params.maxOutputTokens ?? 600, 900),
    temperature: 0.25,
  });

  return {
    stats,
    commentary: aiResult.data,
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
