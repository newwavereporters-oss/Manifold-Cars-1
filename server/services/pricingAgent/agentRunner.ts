import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient, getSupabaseClient } from '../../lib/supabaseServer.js';
import { calculateMarketPriceEstimate } from './calculator.js';
import {
  detectDuplicateObservation,
  extractDomainFromUrl,
  normalizeListingUrl,
} from './deduplicator.js';
import { extractListingDetails } from './extractor.js';
import {
  normalizeBrandName,
  normalizeMarketCategory,
  normalizeModelName,
} from './matcher.js';
import {
  executeProviderSearch,
  isProviderConfigured,
} from './providers.js';
import {
  buildTargetedQueries,
  type ExplicitTargetInput,
} from './queryBuilder.js';
import type {
  CalculatedMarketEstimate,
  DuplicateCandidateRecord,
  ExtractedListingRecord,
  MatchCandidate,
  PricingAgentConfig,
  PricingAgentRunResult,
  ProviderKey,
  SourceFetchOutcome,
} from './types.js';

export const DEFAULT_AGENT_CONFIG: PricingAgentConfig = {
  id: 'default',
  schedule_enabled: false,
  is_paused: false,
  default_frequency: 'daily',
  high_demand_interval_hours: 24,
  standard_interval_hours: 72,
  insufficient_retry_hours: 12,
  max_vehicles_per_run: 5,
  max_queries_per_run: 10,
  max_fetches_per_query: 4,
  max_daily_provider_queries: 50,
  monthly_provider_budget_usd: 25,
  provider_priority: ['serper', 'google_cse', 'brave_search', 'approved_feed', 'manifold_inventory'],
  last_scheduled_run_at: null,
  next_scheduled_run_at: null,
};

export async function loadPricingAgentConfig(
  supabase: SupabaseClient | null
): Promise<{ config: PricingAgentConfig; persisted: boolean }> {
  if (!supabase) return { config: { ...DEFAULT_AGENT_CONFIG }, persisted: false };
  try {
    const { data, error } = await supabase
      .from('pricing_agent_config')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();
    if (error || !data) {
      return { config: { ...DEFAULT_AGENT_CONFIG }, persisted: false };
    }
    return {
      config: {
        ...DEFAULT_AGENT_CONFIG,
        ...data,
        monthly_provider_budget_usd: Number(data.monthly_provider_budget_usd ?? 25),
        provider_priority: Array.isArray(data.provider_priority)
          ? (data.provider_priority as ProviderKey[])
          : DEFAULT_AGENT_CONFIG.provider_priority,
      },
      persisted: true,
    };
  } catch {
    return { config: { ...DEFAULT_AGENT_CONFIG }, persisted: false };
  }
}

export async function savePricingAgentConfig(
  supabase: SupabaseClient | null,
  patch: Partial<PricingAgentConfig>
): Promise<{ config: PricingAgentConfig; persisted: boolean; error?: string }> {
  const { config: current } = await loadPricingAgentConfig(supabase);
  const merged: PricingAgentConfig = {
    ...current,
    ...patch,
    id: 'default',
    updated_at: new Date().toISOString(),
  };

  if (!supabase) {
    return { config: merged, persisted: false, error: 'Supabase client unavailable.' };
  }

  try {
    const { data, error } = await supabase
      .from('pricing_agent_config')
      .upsert(merged, { onConflict: 'id' })
      .select('*')
      .maybeSingle();

    if (error) {
      return { config: merged, persisted: false, error: error.message };
    }
    return {
      config: { ...merged, ...(data || {}) },
      persisted: true,
    };
  } catch (err: any) {
    return { config: merged, persisted: false, error: err?.message || 'Failed saving agent config.' };
  }
}

export async function getProviderQuotaUsageSummary(supabase: SupabaseClient | null): Promise<{
  queriesTodayTotal: number;
  queriesTodayByProvider: Partial<Record<ProviderKey, number>>;
  monthSpendUsd: number;
}> {
  const empty: {
    queriesTodayTotal: number;
    queriesTodayByProvider: Partial<Record<ProviderKey, number>>;
    monthSpendUsd: number;
  } = {
    queriesTodayTotal: 0,
    queriesTodayByProvider: {},
    monthSpendUsd: 0,
  };

  if (!supabase) return empty;

  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  try {
    const { data, error } = await supabase
      .from('pricing_provider_usage')
      .select('provider_key, estimated_cost_usd, created_at')
      .gte('created_at', startOfMonth)
      .limit(2000);

    if (error || !data) return empty;

    let queriesTodayTotal = 0;
    let monthSpendUsd = 0;
    const byProvider: Partial<Record<ProviderKey, number>> = {};

    for (const row of data) {
      monthSpendUsd += Number(row.estimated_cost_usd || 0);
      if (row.created_at >= startOfDay) {
        const key = row.provider_key as ProviderKey;
        if (key !== 'manifold_inventory' && key !== 'approved_feed') {
          queriesTodayTotal++;
        }
        byProvider[key] = (byProvider[key] || 0) + 1;
      }
    }

    return {
      queriesTodayTotal,
      queriesTodayByProvider: byProvider,
      monthSpendUsd: Number(monthSpendUsd.toFixed(4)),
    };
  } catch {
    return empty;
  }
}

async function fetchExistingObservationsAndCars(
  supabase: SupabaseClient | null,
  make: string,
  model: string
): Promise<{
  baselineDedupe: DuplicateCandidateRecord[];
  candidates: MatchCandidate[];
}> {
  if (!supabase) return { baselineDedupe: [], candidates: [] };

  const normMake = normalizeBrandName(make);
  const normModel = normalizeModelName(model);
  const baselineDedupe: DuplicateCandidateRecord[] = [];
  const candidates: MatchCandidate[] = [];

  try {
    const [carsRes, obsRes] = await Promise.all([
      supabase
        .from('cars')
        .select('id, make, model, trim, year, condition, mileage, location, state, price, created_at')
        .ilike('make', make)
        .in('status', ['PUBLISHED', 'published'])
        .limit(100),
      supabase
        .from('market_price_observations')
        .select(
          'id, make, model, trim, variant, generation, year, condition, market_category, mileage, location, price, currency, source_url, normalized_url, source_listing_id, publisher, observed_at, created_at, confidence_score, status, is_duplicate, quality_status, dedupe_hash, description, image_urls'
        )
        .ilike('make', make)
        .limit(200),
    ]);

    for (const row of carsRes.data || []) {
      if (normalizeBrandName(row.make) !== normMake || normalizeModelName(row.model) !== normModel) {
        continue;
      }
      candidates.push({
        id: String(row.id),
        make: String(row.make),
        model: String(row.model),
        year: Number(row.year),
        trim: row.trim || null,
        marketCategory: normalizeMarketCategory(row.condition),
        condition: row.condition || 'Foreign Used',
        mileage: row.mileage != null ? Number(row.mileage) : null,
        location: row.location || row.state || null,
        price: Number(row.price),
        currency: 'NGN',
        sourceWebsite: 'manifold.ng',
        sourceTrustLevel: 'official',
        observedAt: String(row.created_at || new Date().toISOString()),
        isDuplicate: false,
        sourceType: 'internal_asking',
      });
    }

    for (const row of obsRes.data || []) {
      if (normalizeBrandName(row.make) !== normMake || normalizeModelName(row.model) !== normModel) {
        continue;
      }
      const cat =
        row.market_category && row.market_category !== 'unknown'
          ? row.market_category
          : normalizeMarketCategory(row.condition);

      baselineDedupe.push({
        id: String(row.id),
        normalizedUrl: row.normalized_url || normalizeListingUrl(row.source_url),
        sourceListingId: row.source_listing_id || null,
        make: String(row.make),
        model: String(row.model),
        year: Number(row.year),
        marketCategory: cat,
        price: Number(row.price),
        mileage: row.mileage != null ? Number(row.mileage) : null,
        location: row.location || null,
        description: row.description || null,
        imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
        dedupeHash: row.dedupe_hash || null,
      });

      const isRejectedStatus =
        row.status === 'rejected' ||
        row.quality_status === 'rejected' ||
        row.quality_status === 'outlier_excluded';

      if (!isRejectedStatus && !row.is_duplicate) {
        candidates.push({
          id: String(row.id),
          make: String(row.make),
          model: String(row.model),
          year: Number(row.year),
          trim: row.trim || null,
          variant: row.variant || null,
          generation: row.generation || null,
          marketCategory: cat,
          condition: row.condition || 'Unknown',
          mileage: row.mileage != null ? Number(row.mileage) : null,
          location: row.location || null,
          price: Number(row.price),
          currency: row.currency || 'NGN',
          sourceWebsite: row.publisher || extractDomainFromUrl(row.source_url) || 'market_observation',
          sourceUrl: row.source_url || null,
          sourceTrustLevel: row.status === 'approved' ? 'verified' : 'partner',
          observedAt: String(row.observed_at || row.created_at || new Date().toISOString()),
          isDuplicate: Boolean(row.is_duplicate),
          extractionConfidence: Number(row.confidence_score || 0.7),
          sourceType: 'external_observation',
        });
      }
    }
  } catch {
    // Graceful fallback if optional columns/tables missing
  }

  return { baselineDedupe, candidates };
}

export async function persistMarketEstimateSnapshot(
  supabase: SupabaseClient | null,
  estimate: CalculatedMarketEstimate,
  agentRunId: string
): Promise<boolean> {
  if (!supabase) return false;
  try {
    // Mark previous current estimate for same vehicle segment historical (preserving full audit trail)
    let updateQuery = supabase
      .from('market_price_estimates')
      .update({ is_current: false })
      .eq('is_current', true)
      .ilike('make', estimate.make)
      .ilike('model', estimate.model)
      .eq('market_category', estimate.marketCategory);

    if (estimate.targetYear !== null) {
      updateQuery = updateQuery.eq('target_year', estimate.targetYear);
    } else {
      updateQuery = updateQuery.is('target_year', null);
    }
    await updateQuery;

    const { error } = await supabase.from('market_price_estimates').insert({
      make: estimate.make,
      model: estimate.model,
      target_year: estimate.targetYear,
      year_min: estimate.yearMin,
      year_max: estimate.yearMax,
      trim: estimate.trim,
      market_category: estimate.marketCategory,
      location: estimate.location,
      currency: estimate.currency,
      min_price: estimate.minPrice,
      q1_price: estimate.q1Price,
      median_price: estimate.medianPrice,
      mean_price: estimate.meanPrice,
      q3_price: estimate.q3Price,
      max_price: estimate.maxPrice,
      price_range_low: estimate.priceRangeLow,
      price_range_high: estimate.priceRangeHigh,
      market_estimate: estimate.marketEstimate,
      price_distribution: estimate.priceDistribution,
      valid_observation_count: estimate.validObservationCount,
      rejected_observation_count: estimate.rejectedObservationCount,
      duplicate_observation_count: estimate.duplicateObservationCount,
      internal_listing_count: estimate.internalListingCount,
      confidence_score: estimate.confidenceScore,
      confidence_level: estimate.confidenceLevel,
      confidence_breakdown: estimate.confidenceBreakdown,
      estimation_methodology: estimate.estimationMethodology,
      insufficient_data: estimate.insufficientData,
      insufficiency_reason: estimate.insufficiencyReason,
      last_research_at: estimate.lastResearchAt,
      is_current: true,
      agent_run_id: agentRunId,
    });

    return !error;
  } catch {
    return false;
  }
}

export async function runPricingAgentResearch(options: {
  triggerType: 'manual' | 'scheduled' | 'targeted';
  triggeredBy?: string | null;
  explicitTargets?: ExplicitTargetInput[];
  forceRefresh?: boolean;
  authHeader?: string;
  supabaseOverride?: SupabaseClient | null;
}): Promise<PricingAgentRunResult> {
  const startedAt = new Date().toISOString();
  const runId = crypto.randomUUID();
  const supabase =
    options.supabaseOverride !== undefined
      ? options.supabaseOverride
      : getSupabaseAdminClient() ?? getSupabaseClient(options.authHeader);

  const { config } = await loadPricingAgentConfig(supabase);

  if (config.is_paused && options.triggerType === 'scheduled') {
    return {
      runId,
      triggerType: options.triggerType,
      status: 'paused',
      startedAt,
      completedAt: new Date().toISOString(),
      queriesExecuted: 0,
      urlsFetched: 0,
      observationsCollected: 0,
      observationsRejected: 0,
      duplicatesDetected: 0,
      restrictedSourcesCount: 0,
      estimatesUpdated: 0,
      estimatedCostUsd: 0,
      targetsProcessed: [],
      providerUsage: {},
      sourceOutcomes: [],
      estimates: [],
      persistedToDb: false,
      notice: 'Scheduled pricing agent runs are paused in configuration.',
    };
  }

  const quotaUsage = await getProviderQuotaUsageSummary(supabase);
  const { targets, skippedFreshCount } = await buildTargetedQueries({
    supabase,
    config,
    explicitTargets: options.explicitTargets,
    forceRefresh: options.forceRefresh,
  });

  if (targets.length === 0) {
    return {
      runId,
      triggerType: options.triggerType,
      status: 'skipped_fresh',
      startedAt,
      completedAt: new Date().toISOString(),
      queriesExecuted: 0,
      urlsFetched: 0,
      observationsCollected: 0,
      observationsRejected: 0,
      duplicatesDetected: 0,
      restrictedSourcesCount: 0,
      estimatesUpdated: 0,
      estimatedCostUsd: 0,
      targetsProcessed: [],
      providerUsage: {},
      sourceOutcomes: [],
      estimates: [],
      persistedToDb: false,
      notice:
        skippedFreshCount > 0
          ? `All ${skippedFreshCount} candidate vehicle(s) were recently researched within configured freshness windows.`
          : 'No target vehicles available for research.',
    };
  }

  // Persist initial run log row when pricing_agent_runs exists
  let runTableAvailable = false;
  if (supabase) {
    try {
      const { error } = await supabase.from('pricing_agent_runs').insert({
        id: runId,
        trigger_type: options.triggerType,
        triggered_by: options.triggeredBy || null,
        status: 'running',
        target_vehicles: targets,
        started_at: startedAt,
      });
      runTableAvailable = !error;
    } catch {
      runTableAvailable = false;
    }
  }

  let queriesExecuted = 0;
  let urlsFetched = 0;
  let observationsCollected = 0;
  let observationsRejected = 0;
  let duplicatesDetected = 0;
  let estimatesUpdated = 0;
  let estimatedCostUsd = 0;

  const restrictedDomains = new Set<string>();
  const fetchedUrlsInRun = new Set<string>();
  const providerUsage: PricingAgentRunResult['providerUsage'] = {};
  const providerErrors: string[] = [];
  const sourceOutcomes: SourceFetchOutcome[] = [];
  const estimates: CalculatedMarketEstimate[] = [];

  const activeExternalProviders = (config.provider_priority || []).filter(
    (p) => p !== 'manifold_inventory' && isProviderConfigured(p).configured
  );

  for (const target of targets) {
    const { baselineDedupe, candidates } = await fetchExistingObservationsAndCars(
      supabase,
      target.make,
      target.model
    );
    const localDedupePool: DuplicateCandidateRecord[] = [...baselineDedupe];
    const targetCandidates: MatchCandidate[] = [...candidates];
    let targetRejected = 0;
    let targetDuplicates = 0;

    // Select provider(s): run configured search/feed providers up to query budget
    const providersToTry: ProviderKey[] =
      activeExternalProviders.length > 0 ? activeExternalProviders : ['manifold_inventory'];

    for (const providerKey of providersToTry) {
      const isPaidSearchApi =
        providerKey !== 'manifold_inventory' && providerKey !== 'approved_feed';

      if (isPaidSearchApi) {
        if (queriesExecuted >= (config.max_queries_per_run || 10)) break;
        if (
          quotaUsage.queriesTodayTotal + queriesExecuted >=
          (config.max_daily_provider_queries || 50)
        ) {
          break;
        }
        if (
          quotaUsage.monthSpendUsd + estimatedCostUsd >=
          (config.monthly_provider_budget_usd || 25)
        ) {
          break;
        }
      }

      const searchRes = await executeProviderSearch({
        providerKey,
        target,
        maxResults: config.max_fetches_per_query || 4,
        supabase,
      });

      queriesExecuted++;
      estimatedCostUsd += searchRes.costUsd;

      if (!providerUsage[providerKey]) {
        providerUsage[providerKey] = { queries: 0, results: 0, errors: 0, costUsd: 0 };
      }
      providerUsage[providerKey].queries++;
      providerUsage[providerKey].results += searchRes.results.length;
      providerUsage[providerKey].costUsd += searchRes.costUsd;
      if (!searchRes.ok) {
        providerUsage[providerKey].errors++;
        if (searchRes.error) {
          providerErrors.push(`${providerKey}: ${searchRes.error}`);
        }
      }

      if (supabase && runTableAvailable) {
        try {
          await supabase.from('pricing_provider_usage').insert({
            agent_run_id: runId,
            provider_key: providerKey,
            query_text: target.queryText,
            results_count: searchRes.results.length,
            http_status: searchRes.httpStatus || null,
            success: searchRes.ok,
            latency_ms: searchRes.latencyMs,
            estimated_cost_usd: searchRes.costUsd,
            error_message: searchRes.error || searchRes.notice || null,
          });
        } catch {
          // Non-fatal telemetry failure
        }
      }

      // If internal inventory only, targetCandidates already includes published cars
      if (providerKey === 'manifold_inventory') {
        continue;
      }

      let fetchedForQuery = 0;
      for (const hit of searchRes.results) {
        if (fetchedForQuery >= (config.max_fetches_per_query || 4)) break;
        const normHitUrl = normalizeListingUrl(hit.url);
        const domain = hit.sourceDomain || extractDomainFromUrl(normHitUrl);

        if (domain && restrictedDomains.has(domain)) {
          sourceOutcomes.push({
            url: hit.url,
            domain,
            providerKey,
            status: 'BLOCKED_BY_PROTECTION',
            extractedCount: 0,
            validCount: 0,
            rejectedCount: 0,
            duplicateCount: 0,
            error: `Skipped ${domain}: previously blocked automated access in this run.`,
          });
          continue;
        }

        if (fetchedUrlsInRun.has(normHitUrl)) {
          sourceOutcomes.push({
            url: hit.url,
            domain,
            providerKey,
            status: 'SKIPPED_DUPLICATE_URL',
            extractedCount: 0,
            validCount: 0,
            rejectedCount: 0,
            duplicateCount: 1,
          });
          targetDuplicates++;
          duplicatesDetected++;
          continue;
        }
        fetchedUrlsInRun.add(normHitUrl);
        fetchedForQuery++;
        urlsFetched++;

        const extraction = await extractListingDetails({
          url: hit.url,
          titleHint: hit.title,
          snippetHint: hit.snippet,
          expectedMake: target.make,
          expectedModel: target.model,
          expectedCategory: target.marketCategory,
        });

        if (extraction.fetchStatus === 'BLOCKED_BY_PROTECTION') {
          if (domain) restrictedDomains.add(domain);
          sourceOutcomes.push({
            url: hit.url,
            domain,
            providerKey,
            status: 'BLOCKED_BY_PROTECTION',
            httpStatus: extraction.httpStatus,
            extractedCount: 0,
            validCount: 0,
            rejectedCount: 0,
            duplicateCount: 0,
            error: extraction.error,
          });
          continue;
        }

        if (
          extraction.fetchStatus === 'SSRF_BLOCKED' ||
          extraction.fetchStatus === 'RENDERING_REQUIRED' ||
          extraction.fetchStatus === 'FAILED'
        ) {
          sourceOutcomes.push({
            url: hit.url,
            domain,
            providerKey,
            status: extraction.fetchStatus,
            httpStatus: extraction.httpStatus,
            extractedCount: 0,
            validCount: 0,
            rejectedCount: 0,
            duplicateCount: 0,
            error: extraction.error,
          });
          continue;
        }

        let outcomeValid = 0;
        let outcomeRejected = 0;
        let outcomeDupes = 0;

        for (const obs of extraction.observations) {
          const dupCheck = detectDuplicateObservation(
            {
              normalizedUrl: obs.normalizedUrl,
              sourceListingId: obs.sourceListingId,
              make: obs.make,
              model: obs.model,
              year: obs.modelYear,
              marketCategory: obs.marketCategory,
              price: obs.askingPrice,
              mileage: obs.mileage,
              location: obs.location,
              description: obs.description,
              imageUrls: obs.imageUrls,
              dedupeHash: obs.dedupeHash,
            },
            localDedupePool
          );

          const isValid = obs.qualityStatus === 'valid' && !dupCheck.isDuplicate;
          if (dupCheck.isDuplicate) {
            outcomeDupes++;
            targetDuplicates++;
            duplicatesDetected++;
          } else if (obs.qualityStatus !== 'valid') {
            outcomeRejected++;
            targetRejected++;
            observationsRejected++;
          } else {
            outcomeValid++;
            observationsCollected++;
          }

          let persistedId = `obs-${crypto.randomBytes(5).toString('hex')}`;
          if (supabase) {
            try {
              const { data: insertedObs } = await supabase
                .from('market_price_observations')
                .insert({
                  make: obs.make,
                  model: obs.model,
                  year: obs.modelYear,
                  trim: obs.trim,
                  variant: obs.variant,
                  generation: obs.generation,
                  body_type: obs.bodyType,
                  drivetrain: obs.drivetrain,
                  price: obs.askingPrice,
                  currency: obs.currency,
                  mileage: obs.mileage,
                  mileage_unit: obs.mileageUnit,
                  condition: obs.condition,
                  market_category: obs.marketCategory,
                  seller_type: obs.sellerType,
                  location: obs.location,
                  transmission: obs.transmission,
                  fuel_type: obs.fuelType,
                  engine: obs.engine,
                  source_url: obs.sourceUrl,
                  normalized_url: obs.normalizedUrl,
                  source_listing_id: obs.sourceListingId,
                  publisher: obs.sourceWebsite,
                  listing_date: obs.listingDate,
                  observed_at: obs.observationDate,
                  description: obs.description,
                  image_urls: obs.imageUrls,
                  confidence_score: obs.extractionConfidence,
                  status:
                    obs.qualityStatus === 'rejected' || dupCheck.isDuplicate
                      ? 'rejected'
                      : obs.extractionConfidence >= 0.8
                      ? 'approved'
                      : 'pending_review',
                  quality_status: obs.qualityStatus,
                  is_duplicate: dupCheck.isDuplicate,
                  duplicate_reason: dupCheck.reason,
                  dedupe_hash: dupCheck.dedupeHash,
                  rejection_reason: obs.rejectionReason || dupCheck.reason,
                  notes: `Agent ${obs.extractionMethod}: ${obs.supportingEvidence.join('; ')}`.slice(0, 500),
                  agent_run_id: runTableAvailable ? runId : null,
                })
                .select('id')
                .maybeSingle();

              if (insertedObs?.id) persistedId = insertedObs.id;
            } catch {
              // Non-fatal if migration columns aren't applied yet
            }
          }

          localDedupePool.push({
            id: persistedId,
            normalizedUrl: obs.normalizedUrl,
            sourceListingId: obs.sourceListingId,
            make: obs.make,
            model: obs.model,
            year: obs.modelYear,
            marketCategory: obs.marketCategory,
            price: obs.askingPrice,
            mileage: obs.mileage,
            location: obs.location,
            description: obs.description,
            imageUrls: obs.imageUrls,
            dedupeHash: dupCheck.dedupeHash,
          });

          if (isValid) {
            targetCandidates.push({
              id: persistedId,
              make: obs.make,
              model: obs.model,
              year: obs.modelYear,
              trim: obs.trim,
              variant: obs.variant,
              generation: obs.generation,
              marketCategory: obs.marketCategory,
              condition: obs.condition,
              mileage: obs.mileage,
              location: obs.location,
              price: obs.askingPrice,
              currency: 'NGN',
              sourceWebsite: obs.sourceWebsite,
              sourceUrl: obs.sourceUrl,
              sourceTrustLevel: obs.extractionConfidence >= 0.85 ? 'verified' : 'partner',
              observedAt: obs.observationDate,
              isDuplicate: false,
              extractionConfidence: obs.extractionConfidence,
              sourceType: 'external_observation',
            });
          }
        }

        sourceOutcomes.push({
          url: hit.url,
          domain,
          providerKey,
          status: extraction.fetchStatus,
          httpStatus: extraction.httpStatus,
          extractedCount: extraction.observations.length,
          validCount: outcomeValid,
          rejectedCount: outcomeRejected,
          duplicateCount: outcomeDupes,
        });
      }

      if (targetCandidates.length >= 8) break;
    }

    const estimate = calculateMarketPriceEstimate({
      subject: {
        make: target.make,
        model: target.model,
        year: target.year,
        trim: target.trim,
        marketCategory: target.marketCategory,
        location: target.location,
      },
      candidates: targetCandidates,
      additionalRejectedCount: targetRejected,
      additionalDuplicateCount: targetDuplicates,
    });

    estimates.push(estimate);
    const savedEst = await persistMarketEstimateSnapshot(supabase, estimate, runId);
    if (savedEst) estimatesUpdated++;
  }

  const completedAt = new Date().toISOString();
  const hasProviderErrors = providerErrors.length > 0;
  const finalStatus: PricingAgentRunResult['status'] =
    hasProviderErrors && estimatesUpdated === 0 && observationsCollected === 0
      ? 'partial'
      : activeExternalProviders.length === 0 && estimates.length > 0
      ? 'partial'
      : hasProviderErrors
      ? 'partial'
      : estimates.length > 0
      ? 'completed'
      : 'failed';

  const errorSummary =
    providerErrors.length > 0 ? Array.from(new Set(providerErrors)).join(' | ').slice(0, 1000) : null;

  let persistedRun = false;
  if (supabase && runTableAvailable) {
    try {
      const { error } = await supabase
        .from('pricing_agent_runs')
        .update({
          status: finalStatus,
          queries_executed: queriesExecuted,
          urls_fetched: urlsFetched,
          observations_collected: observationsCollected,
          observations_rejected: observationsRejected,
          duplicates_detected: duplicatesDetected,
          restricted_sources_count: restrictedDomains.size,
          estimates_updated: estimatesUpdated,
          estimated_cost_usd: Number(estimatedCostUsd.toFixed(4)),
          provider_usage: providerUsage,
          source_outcomes: sourceOutcomes.slice(0, 50),
          error_summary: errorSummary,
          completed_at: completedAt,
        })
        .eq('id', runId);
      persistedRun = !error;
    } catch {
      persistedRun = false;
    }
  }

  return {
    runId,
    triggerType: options.triggerType,
    status: finalStatus,
    startedAt,
    completedAt,
    queriesExecuted,
    urlsFetched,
    observationsCollected,
    observationsRejected,
    duplicatesDetected,
    restrictedSourcesCount: restrictedDomains.size,
    estimatesUpdated,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
    targetsProcessed: targets,
    providerUsage,
    sourceOutcomes,
    estimates,
    persistedToDb: persistedRun,
    notice:
      errorSummary
        ? `Provider warning(s): ${errorSummary}`
        : activeExternalProviders.length === 0
        ? 'No external search API keys (SERPER_API_KEY, GOOGLE_CSE_API_KEY, BRAVE_SEARCH_API_KEY) are configured; estimates reflect internal MANIFOLD listings and previously approved observations.'
        : undefined,
  };
}
