import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeBrandName, normalizeMarketCategory, normalizeModelName } from './matcher.js';
import type { MarketCategory, PricingAgentConfig, SearchQueryTarget } from './types.js';

export interface ExplicitTargetInput {
  make: string;
  model: string;
  year?: number | null;
  trim?: string | null;
  marketCategory?: MarketCategory;
  location?: string | null;
}

export function formatSearchQueryText(target: {
  make: string;
  model: string;
  year?: number | null;
  trim?: string | null;
  marketCategory: MarketCategory;
  location?: string | null;
}): string {
  const parts: string[] = [];
  if (target.year && target.year >= 1990) parts.push(String(target.year));
  parts.push(target.make.trim());
  parts.push(target.model.trim());
  if (target.trim) parts.push(target.trim.trim());

  if (target.marketCategory === 'foreign_used') parts.push('foreign used tokunbo');
  else if (target.marketCategory === 'nigerian_used') parts.push('nigerian used');
  else if (target.marketCategory === 'brand_new') parts.push('brand new');

  if (target.location && !target.location.toLowerCase().includes('national')) {
    parts.push(target.location.trim());
  } else {
    parts.push('Nigeria');
  }
  parts.push('price NGN');

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export async function buildTargetedQueries(params: {
  supabase: SupabaseClient | null;
  config: PricingAgentConfig;
  explicitTargets?: ExplicitTargetInput[];
  forceRefresh?: boolean;
}): Promise<{
  targets: SearchQueryTarget[];
  skippedFreshCount: number;
}> {
  const { supabase, config, explicitTargets, forceRefresh } = params;
  const maxTargets = Math.max(1, Math.min(config.max_vehicles_per_run || 6, 25));

  const candidateMap = new Map<string, SearchQueryTarget>();

  const registerTarget = (
    item: ExplicitTargetInput & { sourceCarId?: string; demandScore: number; reason: string }
  ) => {
    const makeNorm = normalizeBrandName(item.make);
    const modelNorm = normalizeModelName(item.model);
    if (!makeNorm || !modelNorm) return;

    const category: MarketCategory =
      item.marketCategory && item.marketCategory !== 'unknown'
        ? item.marketCategory
        : 'foreign_used';
    const year = item.year && item.year >= 1985 ? item.year : null;
    const key = `${makeNorm}|${modelNorm}|${year ?? 'any'}|${category}`;

    const existing = candidateMap.get(key);
    if (existing) {
      existing.demandScore = Math.max(existing.demandScore, item.demandScore) + 1;
      return;
    }

    candidateMap.set(key, {
      make: item.make.trim(),
      model: item.model.trim(),
      year,
      trim: item.trim?.trim() || null,
      marketCategory: category,
      location: item.location?.trim() || 'Nigeria',
      queryText: formatSearchQueryText({
        make: item.make,
        model: item.model,
        year,
        trim: item.trim,
        marketCategory: category,
        location: item.location,
      }),
      sourceCarId: item.sourceCarId,
      demandScore: item.demandScore,
      reason: item.reason,
    });
  };

  if (explicitTargets && explicitTargets.length > 0) {
    for (const target of explicitTargets) {
      registerTarget({
        ...target,
        demandScore: 100,
        reason: 'admin_targeted_research',
      });
    }
  } else if (supabase) {
    // 1. Discover published dealer inventory vehicles prioritized by recent listings
    try {
      const { data: cars } = await supabase
        .from('cars')
        .select('id, make, model, year, trim, condition, state, location, created_at')
        .in('status', ['PUBLISHED', 'published'])
        .order('created_at', { ascending: false })
        .limit(40);

      for (const car of cars || []) {
        const category = normalizeMarketCategory(car.condition);
        registerTarget({
          make: String(car.make || ''),
          model: String(car.model || ''),
          year: car.year ? Number(car.year) : null,
          trim: car.trim ? String(car.trim) : null,
          marketCategory: category === 'unknown' ? 'foreign_used' : category,
          location: car.state || car.location || 'Nigeria',
          sourceCarId: String(car.id),
          demandScore: 60,
          reason: 'active_inventory_vehicle',
        });
      }
    } catch {
      // Non-fatal
    }

    // 2. Boost demand score from search analytics when available
    try {
      const { data: searches } = await supabase
        .from('ai_search_analytics')
        .select('parsed_filters, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      for (const row of searches || []) {
        const filters = (row.parsed_filters || {}) as Record<string, any>;
        if (filters.make && filters.model) {
          registerTarget({
            make: String(filters.make),
            model: String(filters.model),
            year: filters.yearMin ? Number(filters.yearMin) : null,
            marketCategory: normalizeMarketCategory(filters.condition),
            demandScore: 80,
            reason: 'buyer_search_demand',
          });
        }
      }
    } catch {
      // Table may not exist yet; safe fallback
    }
  }

  let candidates = Array.from(candidateMap.values()).sort(
    (a, b) => b.demandScore - a.demandScore
  );

  let skippedFreshCount = 0;

  if (!forceRefresh && supabase && candidates.length > 0) {
    try {
      const { data: existingEstimates } = await supabase
        .from('market_price_estimates')
        .select('make, model, target_year, market_category, last_research_at, insufficient_data')
        .eq('is_current', true)
        .limit(200);

      if (existingEstimates && existingEstimates.length > 0) {
        const nowMs = Date.now();
        candidates = candidates.filter((target) => {
          const match = existingEstimates.find(
            (est) =>
              normalizeBrandName(est.make) === normalizeBrandName(target.make) &&
              normalizeModelName(est.model) === normalizeModelName(target.model) &&
              (est.target_year ?? null) === target.year &&
              est.market_category === target.marketCategory
          );
          if (!match || !match.last_research_at) return true;

          const ageHours = (nowMs - Date.parse(match.last_research_at)) / 3_600_000;
          const thresholdHours = match.insufficient_data
            ? config.insufficient_retry_hours || 12
            : target.demandScore >= 75
            ? config.high_demand_interval_hours || 24
            : config.standard_interval_hours || 72;

          if (ageHours < thresholdHours) {
            skippedFreshCount++;
            return false;
          }
          return true;
        });
      }
    } catch {
      // market_price_estimates table may not be migrated yet; proceed without skipping
    }
  }

  return {
    targets: candidates.slice(0, maxTargets),
    skippedFreshCount,
  };
}
