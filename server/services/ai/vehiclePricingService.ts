import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { runStructuredJsonResponse } from '../../lib/openai';
import { getSupabaseClient } from '../../lib/supabaseServer';

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

export interface DeterministicPriceStats {
  insufficientData: boolean;
  insufficiencyReason: string | null;
  sampleCount: number;
  internalAskingCount: number;
  externalObservationCount: number;
  completedSalesCount: number;
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
  comparables: ComparableSample[];
  methodologyNote: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const weight = idx - lo;
  return Math.round(sorted[lo] * (1 - weight) + sorted[hi] * weight);
}

function normalizeModelToken(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
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
}): DeterministicPriceStats {
  const { input, comparables, completedSalesCount } = params;
  const validComps = comparables
    .filter((c) => Number.isFinite(c.price) && c.price >= 500_000)
    .sort((a, b) => b.similarityScore - a.similarityScore);

  const internalAskingCount = validComps.filter((c) => c.sourceType === 'internal_asking').length;
  const externalObservationCount = validComps.filter(
    (c) => c.sourceType === 'external_observation'
  ).length;
  const sampleCount = validComps.length;
  const askingPrice = input.askingPrice && input.askingPrice > 0 ? input.askingPrice : null;

  if (sampleCount < 2) {
    return {
      insufficientData: true,
      insufficiencyReason:
        sampleCount === 0
          ? `No verified MANIFOLD listings or approved market observations were found for ${input.year || ''} ${input.make} ${input.model}.`.trim()
          : `Only 1 verified comparable exists for ${input.year || ''} ${input.make} ${input.model}. At least 2 comparables are required before issuing a market range.`.trim(),
      sampleCount,
      internalAskingCount,
      externalObservationCount,
      completedSalesCount,
      minPrice: sampleCount === 1 ? validComps[0].price : null,
      q1Price: null,
      medianPrice: sampleCount === 1 ? validComps[0].price : null,
      meanPrice: sampleCount === 1 ? validComps[0].price : null,
      q3Price: null,
      maxPrice: sampleCount === 1 ? validComps[0].price : null,
      recommendedRangeLow: null,
      recommendedRangeHigh: null,
      askingPrice,
      askingVsMedianPct: null,
      positioning: 'insufficient_data',
      confidence: 'insufficient',
      comparables: validComps.slice(0, 8),
      methodologyNote:
        'Computed deterministically from active asking prices and approved external market observations. Completed transaction volume is tracked separately where verified.',
    };
  }

  const prices = validComps.map((c) => c.price).sort((a, b) => a - b);
  const minPrice = prices[0];
  const maxPrice = prices[prices.length - 1];
  const q1Price = percentile(prices, 0.25);
  const medianPrice = percentile(prices, 0.5);
  const q3Price = percentile(prices, 0.75);
  const meanPrice = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);

  // Typical healthy market band around median using IQR clamped to +/- 12%
  const recommendedRangeLow = Math.max(minPrice, Math.min(q1Price, Math.round(medianPrice * 0.92)));
  const recommendedRangeHigh = Math.min(maxPrice, Math.max(q3Price, Math.round(medianPrice * 1.08)));

  let askingVsMedianPct: number | null = null;
  let positioning: DeterministicPriceStats['positioning'] = 'competitive';
  if (askingPrice && medianPrice > 0) {
    askingVsMedianPct = Number((((askingPrice - medianPrice) / medianPrice) * 100).toFixed(1));
    if (askingVsMedianPct <= -8) {
      positioning = 'below_market';
    } else if (askingVsMedianPct >= 10) {
      positioning = 'above_market';
    } else {
      positioning = 'competitive';
    }
  }

  const yearMatchedCount = validComps.filter(
    (c) => !input.year || Math.abs(c.year - input.year) <= 1
  ).length;
  const confidence: DeterministicPriceStats['confidence'] =
    sampleCount >= 6 && yearMatchedCount >= 3
      ? 'high'
      : sampleCount >= 3
      ? 'moderate'
      : 'low';

  return {
    insufficientData: false,
    insufficiencyReason: null,
    sampleCount,
    internalAskingCount,
    externalObservationCount,
    completedSalesCount,
    minPrice,
    q1Price,
    medianPrice,
    meanPrice,
    q3Price,
    maxPrice,
    recommendedRangeLow,
    recommendedRangeHigh,
    askingPrice,
    askingVsMedianPct,
    positioning,
    confidence,
    comparables: validComps.slice(0, 8),
    methodologyNote: `Based on ${internalAskingCount} active asking listing(s) on MANIFOLD and ${externalObservationCount} admin-approved external market observation(s)${
      completedSalesCount > 0 ? ` (${completedSalesCount} recorded completed sale(s) referenced)` : ' (asking-price benchmark; completed sales tracked separately)'
    }. Dealers retain full pricing autonomy.`,
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
  const normalizedTargetModel = normalizeModelToken(input.model);

  const comparables: ComparableSample[] = [];
  let completedSalesCount = 0;

  if (supabase) {
    const [carsRes, obsRes] = await Promise.all([
      supabase
        .from('cars')
        .select('id, make, model, trim, year, condition, mileage, location, state, price, created_at')
        .ilike('make', input.make)
        .in('status', ['PUBLISHED', 'published'])
        .limit(100),
      supabase
        .from('market_price_observations')
        .select('id, make, model, trim, year, condition, mileage, location, price, source_name, observed_at, created_at')
        .eq('status', 'approved')
        .ilike('make', input.make)
        .limit(100),
    ]);

    if (!carsRes.error && Array.isArray(carsRes.data)) {
      for (const row of carsRes.data) {
        if (input.carId && row.id === input.carId) continue;
        const rowModelNorm = normalizeModelToken(String(row.model || ''));
        if (
          rowModelNorm !== normalizedTargetModel &&
          !rowModelNorm.includes(normalizedTargetModel) &&
          !normalizedTargetModel.includes(rowModelNorm)
        ) {
          continue;
        }
        const yearDiff = input.year ? Math.abs(Number(row.year) - input.year) : 0;
        if (yearDiff > 4) continue;

        let sim = 100 - yearDiff * 15;
        if (
          input.condition &&
          String(row.condition || '').toLowerCase().includes(input.condition.toLowerCase().split(' ')[0])
        ) {
          sim += 10;
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
          similarityScore: sim,
        });
      }
    }

    if (!obsRes.error && Array.isArray(obsRes.data)) {
      for (const row of obsRes.data) {
        const rowModelNorm = normalizeModelToken(String(row.model || ''));
        if (
          rowModelNorm !== normalizedTargetModel &&
          !rowModelNorm.includes(normalizedTargetModel) &&
          !normalizedTargetModel.includes(rowModelNorm)
        ) {
          continue;
        }
        const yearDiff = input.year ? Math.abs(Number(row.year) - input.year) : 0;
        if (yearDiff > 4) continue;

        let sim = 95 - yearDiff * 15;
        if (
          input.condition &&
          String(row.condition || '').toLowerCase().includes(input.condition.toLowerCase().split(' ')[0])
        ) {
          sim += 8;
        }

        comparables.push({
          id: String(row.id),
          label: `${row.year} ${row.make} ${row.model}${row.trim ? ` ${row.trim}` : ''}`,
          year: Number(row.year),
          make: String(row.make),
          model: String(row.model),
          trim: row.trim || null,
          condition: String(row.condition || 'Unknown'),
          mileage: row.mileage !== null && row.mileage !== undefined ? Number(row.mileage) : null,
          location: String(row.location || 'Nigeria'),
          price: Number(row.price),
          sourceType: 'external_observation',
          sourceLabel: row.source_name ? `${row.source_name} (Observed Asking)` : 'Verified Market Observation',
          observedDate: String(row.observed_at || row.created_at || '').slice(0, 10),
          similarityScore: sim,
        });
      }
    }

    // Count verified sales non-fatally if admin/dealer permitted
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
3. Respect dealer pricing autonomy: offer objective market context rather than commanding a mandatory price.
4. Keep numbers formatted cleanly in Naira (₦).`;

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
        condition: input.condition,
        mileage: input.mileage,
        location: input.location,
        askingPrice: stats.askingPrice,
      },
      computedStats: {
        sampleCount: stats.sampleCount,
        internalAskingCount: stats.internalAskingCount,
        externalObservationCount: stats.externalObservationCount,
        completedSalesCount: stats.completedSalesCount,
        minPrice: stats.minPrice,
        medianPrice: stats.medianPrice,
        recommendedRangeLow: stats.recommendedRangeLow,
        recommendedRangeHigh: stats.recommendedRangeHigh,
        maxPrice: stats.maxPrice,
        askingVsMedianPct: stats.askingVsMedianPct,
        positioning: stats.positioning,
        confidence: stats.confidence,
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
