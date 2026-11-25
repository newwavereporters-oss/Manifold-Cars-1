import {
  filterComparableVehicles,
  formatMarketCategoryLabel,
  normalizeLocationToken,
} from './matcher.js';
import type {
  CalculatedMarketEstimate,
  ConfidenceBreakdown,
  MatchCandidate,
  MatchSubject,
  OutlierExcludedItem,
  PriceDistributionSummary,
} from './types.js';

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

function medianOfSorted(sorted: number[]): number {
  return percentile(sorted, 0.5);
}

export function detectStatisticalOutliers<
  T extends { id: string; price: number; make?: string; model?: string; year?: number; trim?: string | null }
>(samples: T[]): {
  retained: T[];
  excluded: OutlierExcludedItem[];
  method: PriceDistributionSummary['outlierMethod'];
  mad: number;
  iqr: number;
} {
  if (samples.length < 4) {
    const sorted = samples.map((s) => s.price).sort((a, b) => a - b);
    const iqr = sorted.length >= 2 ? percentile(sorted, 0.75) - percentile(sorted, 0.25) : 0;
    return {
      retained: samples,
      excluded: [],
      method: 'none_small_sample',
      mad: 0,
      iqr,
    };
  }

  const pricesSorted = samples.map((s) => s.price).sort((a, b) => a - b);
  const med = medianOfSorted(pricesSorted);
  const q1 = percentile(pricesSorted, 0.25);
  const q3 = percentile(pricesSorted, 0.75);
  const iqr = Math.max(0, q3 - q1);

  const absDeviations = pricesSorted.map((p) => Math.abs(p - med)).sort((a, b) => a - b);
  const mad = medianOfSorted(absDeviations);

  const retained: T[] = [];
  const excluded: OutlierExcludedItem[] = [];

  if (mad > 0) {
    for (const item of samples) {
      const modifiedZ = Math.abs((0.6745 * (item.price - med)) / mad);
      if (modifiedZ > 3.5) {
        excluded.push({
          id: item.id,
          label: `${item.year || ''} ${item.make || ''} ${item.model || ''}${item.trim ? ` ${item.trim}` : ''}`.trim() || item.id,
          price: item.price,
          reason: `Modified Z-score ${modifiedZ.toFixed(2)} exceeds 3.5 threshold relative to median ₦${med.toLocaleString()}`,
        });
      } else {
        retained.push(item);
      }
    }
    return { retained, excluded, method: 'mad_modified_z', mad, iqr };
  }

  // Fallback to Tukey IQR when MAD === 0 (e.g. >50% identical prices + one extreme spike)
  const effectiveIqr = iqr > 0 ? iqr : Math.round(med * 0.2);
  const lowerFence = Math.max(0, q1 - 1.5 * effectiveIqr);
  const upperFence = q3 + 1.5 * effectiveIqr;

  for (const item of samples) {
    if (item.price < lowerFence || item.price > upperFence) {
      excluded.push({
        id: item.id,
        label: `${item.year || ''} ${item.make || ''} ${item.model || ''}${item.trim ? ` ${item.trim}` : ''}`.trim() || item.id,
        price: item.price,
        reason: `Outside Tukey 1.5×IQR fence (₦${Math.round(lowerFence).toLocaleString()}–₦${Math.round(upperFence).toLocaleString()})`,
      });
    } else {
      retained.push(item);
    }
  }

  return { retained, excluded, method: 'iqr_tukey', mad, iqr };
}

function buildHistogramBuckets(
  sortedPrices: number[]
): Array<{ label: string; min: number; max: number; count: number }> {
  if (sortedPrices.length === 0) return [];
  const min = sortedPrices[0];
  const max = sortedPrices[sortedPrices.length - 1];
  if (min === max) {
    return [
      {
        label: `₦${(min / 1_000_000).toFixed(1)}M`,
        min,
        max,
        count: sortedPrices.length,
      },
    ];
  }

  const bucketCount = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(sortedPrices.length))));
  const step = Math.ceil((max - min) / bucketCount);
  const buckets: Array<{ label: string; min: number; max: number; count: number }> = [];

  for (let i = 0; i < bucketCount; i++) {
    const bMin = min + i * step;
    const bMax = i === bucketCount - 1 ? max : min + (i + 1) * step - 1;
    const count = sortedPrices.filter((p) => p >= bMin && p <= bMax).length;
    buckets.push({
      label: `₦${(bMin / 1_000_000).toFixed(1)}M–₦${(bMax / 1_000_000).toFixed(1)}M`,
      min: bMin,
      max: bMax,
      count,
    });
  }

  return buckets;
}

export function computeConfidenceBreakdown(params: {
  validSamples: MatchCandidate[];
  coefficientOfVariation: number;
  duplicateCount: number;
  rejectedCount: number;
  nowMs?: number;
}): ConfidenceBreakdown {
  const { validSamples, coefficientOfVariation, duplicateCount, rejectedCount } = params;
  const nowMs = params.nowMs ?? Date.now();
  const n = validSamples.length;

  if (n < 2) {
    return {
      sampleCountScore: n === 1 ? 5 : 0,
      sourceReliabilityScore: 0,
      recencyScore: 0,
      specCompletenessScore: 0,
      priceConsistencyScore: 0,
      duplicatePenalty: 0,
      totalScore: n === 1 ? 15 : 0,
      level: 'insufficient',
      evidenceSummary:
        n === 0
          ? 'Insufficient data: 0 comparable non-duplicate vehicles passed validation.'
          : 'Insufficient data: only 1 comparable vehicle available (minimum 2 required).',
    };
  }

  // 1. Sample count score (0..35)
  let sampleCountScore = 10;
  if (n >= 10) sampleCountScore = 35;
  else if (n >= 6) sampleCountScore = 28;
  else if (n >= 4) sampleCountScore = 22;
  else if (n >= 3) sampleCountScore = 16;

  // 2. Source reliability & diversity score (0..20)
  const distinctSources = new Set(
    validSamples.map((s) => (s.sourceWebsite || s.sourceType || 'unknown').toLowerCase())
  );
  const trustSum = validSamples.reduce((acc, s) => {
    if (s.sourceType === 'internal_asking' || s.sourceTrustLevel === 'official') return acc + 1.0;
    if (s.sourceTrustLevel === 'verified') return acc + 0.9;
    if (s.sourceTrustLevel === 'partner') return acc + 0.8;
    return acc + 0.65;
  }, 0);
  const avgTrust = trustSum / n;
  const diversityBonus = Math.min(6, (distinctSources.size - 1) * 2.5);
  const sourceReliabilityScore = Math.min(20, Math.round(avgTrust * 14 + diversityBonus));

  // 3. Recency score (0..15)
  const avgAgeDays =
    validSamples.reduce((acc, s) => {
      const ts = Date.parse(s.observedAt);
      const ageDays = Number.isFinite(ts) ? Math.max(0, (nowMs - ts) / 86_400_000) : 45;
      return acc + ageDays;
    }, 0) / n;
  let recencyScore = 4;
  if (avgAgeDays <= 7) recencyScore = 15;
  else if (avgAgeDays <= 30) recencyScore = 12;
  else if (avgAgeDays <= 60) recencyScore = 9;
  else if (avgAgeDays <= 120) recencyScore = 6;

  // 4. Specification completeness score (0..15)
  const avgCompleteness =
    validSamples.reduce((acc, s) => {
      let fields = 0;
      if (s.year && s.year >= 1985) fields++;
      if (s.mileage !== null && s.mileage !== undefined && s.mileage > 0) fields++;
      if (s.trim) fields++;
      if (s.location) fields++;
      if (s.marketCategory && s.marketCategory !== 'unknown') fields++;
      return acc + fields / 5;
    }, 0) / n;
  const specCompletenessScore = Math.round(avgCompleteness * 15);

  // 5. Price consistency score (0..15)
  let priceConsistencyScore = 4;
  if (coefficientOfVariation <= 0.08) priceConsistencyScore = 15;
  else if (coefficientOfVariation <= 0.14) priceConsistencyScore = 12;
  else if (coefficientOfVariation <= 0.22) priceConsistencyScore = 9;
  else if (coefficientOfVariation <= 0.32) priceConsistencyScore = 6;

  // 6. Duplicate/noise penalty (0..8)
  const totalNoise = duplicateCount + rejectedCount;
  const duplicatePenalty = totalNoise > n * 2 ? 6 : totalNoise > n ? 3 : 0;

  const totalScore = Math.max(
    10,
    Math.min(
      100,
      sampleCountScore +
        sourceReliabilityScore +
        recencyScore +
        specCompletenessScore +
        priceConsistencyScore -
        duplicatePenalty
    )
  );

  let level: ConfidenceBreakdown['level'] = 'low';
  if (totalScore >= 74 && n >= 5) level = 'high';
  else if (totalScore >= 50 && n >= 3) level = 'medium';

  return {
    sampleCountScore,
    sourceReliabilityScore,
    recencyScore,
    specCompletenessScore,
    priceConsistencyScore,
    duplicatePenalty,
    totalScore,
    level,
    evidenceSummary: `${n} unique comparable(s) across ${distinctSources.size} source(s), CV ${(coefficientOfVariation * 100).toFixed(1)}%, avg age ${Math.round(avgAgeDays)}d.`,
  };
}

export function calculateMarketPriceEstimate(params: {
  subject: MatchSubject;
  candidates: MatchCandidate[];
  additionalRejectedCount?: number;
  additionalDuplicateCount?: number;
  nowIso?: string;
}): CalculatedMarketEstimate {
  const nowIso = params.nowIso ?? new Date().toISOString();
  const { subject, candidates } = params;

  const duplicateCandidatesCount =
    candidates.filter((c) => c.isDuplicate).length + (params.additionalDuplicateCount ?? 0);

  const { comparables, rejected } = filterComparableVehicles(
    subject,
    candidates.filter((c) => !c.isDuplicate)
  );

  const rejectedByMatchingCount = rejected.length + (params.additionalRejectedCount ?? 0);

  // Run statistical outlier detection on comparable matches
  const outlierResult = detectStatisticalOutliers(comparables);
  const validComps = outlierResult.retained;
  const totalRejectedCount = rejectedByMatchingCount + outlierResult.excluded.length;

  const locationLabel = normalizeLocationToken(subject.location)
    ? String(subject.location)
    : 'Nigeria (National)';

  const yearMin = subject.year ? subject.year - 2 : validComps.length > 0 ? Math.min(...validComps.map((c) => c.year)) : null;
  const yearMax = subject.year ? subject.year + 2 : validComps.length > 0 ? Math.max(...validComps.map((c) => c.year)) : null;

  if (validComps.length < 2) {
    const emptyConfidence = computeConfidenceBreakdown({
      validSamples: validComps,
      coefficientOfVariation: 0,
      duplicateCount: duplicateCandidatesCount,
      rejectedCount: totalRejectedCount,
      nowMs: Date.parse(nowIso),
    });

    const singlePrice = validComps.length === 1 ? validComps[0].price : null;
    const categoryLabel = formatMarketCategoryLabel(subject.marketCategory);

    return {
      make: subject.make,
      model: subject.model,
      targetYear: subject.year ?? null,
      yearMin,
      yearMax,
      trim: subject.trim ?? null,
      marketCategory: subject.marketCategory,
      location: locationLabel,
      currency: 'NGN',
      insufficientData: true,
      insufficiencyReason:
        validComps.length === 0
          ? `No verified non-duplicate ${categoryLabel} comparables met matching rules for ${subject.year || ''} ${subject.make} ${subject.model}.`.trim()
          : `Only 1 verified ${categoryLabel} comparable remained after filtering (${duplicateCandidatesCount} duplicate(s), ${totalRejectedCount} rejected/outlier(s)). At least 2 independent comparables are required.`,
      minPrice: singlePrice,
      q1Price: null,
      medianPrice: singlePrice,
      meanPrice: singlePrice,
      q3Price: null,
      maxPrice: singlePrice,
      priceRangeLow: null,
      priceRangeHigh: null,
      marketEstimate: null,
      validObservationCount: validComps.length,
      internalListingCount: validComps.filter((c) => c.sourceType === 'internal_asking').length,
      externalObservationCount: validComps.filter((c) => c.sourceType === 'external_observation').length,
      rejectedObservationCount: totalRejectedCount,
      duplicateObservationCount: duplicateCandidatesCount,
      confidenceScore: emptyConfidence.totalScore,
      confidenceLevel: 'insufficient',
      confidenceBreakdown: emptyConfidence,
      priceDistribution: {
        iqr: 0,
        mad: 0,
        stdDev: 0,
        coefficientOfVariation: 0,
        outlierMethod: outlierResult.method,
        outliersExcludedCount: outlierResult.excluded.length,
        outliersExcluded: outlierResult.excluded,
        histogramBuckets: singlePrice
          ? [{ label: `₦${(singlePrice / 1_000_000).toFixed(1)}M`, min: singlePrice, max: singlePrice, count: 1 }]
          : [],
      },
      estimationMethodology: `Asking-price benchmark restricted strictly to ${categoryLabel} comparables within ±2 model years. Estimate withheld due to insufficient sample size.`,
      lastResearchAt: nowIso,
      matchedSamples: validComps,
    };
  }

  const sortedPrices = validComps.map((c) => c.price).sort((a, b) => a - b);
  const minPrice = sortedPrices[0];
  const maxPrice = sortedPrices[sortedPrices.length - 1];
  const q1Price = percentile(sortedPrices, 0.25);
  const medianPrice = percentile(sortedPrices, 0.5);
  const q3Price = percentile(sortedPrices, 0.75);
  const meanPrice = Math.round(
    sortedPrices.reduce((sum, p) => sum + p, 0) / sortedPrices.length
  );

  const variance =
    sortedPrices.reduce((acc, p) => acc + Math.pow(p - meanPrice, 2), 0) /
    sortedPrices.length;
  const stdDev = Math.round(Math.sqrt(variance));
  const coefficientOfVariation =
    meanPrice > 0 ? Number((stdDev / meanPrice).toFixed(4)) : 0;

  const priceRangeLow = Math.max(
    minPrice,
    Math.min(q1Price, Math.round(medianPrice * 0.92))
  );
  const priceRangeHigh = Math.min(
    maxPrice,
    Math.max(q3Price, Math.round(medianPrice * 1.08))
  );

  const confidenceBreakdown = computeConfidenceBreakdown({
    validSamples: validComps,
    coefficientOfVariation,
    duplicateCount: duplicateCandidatesCount,
    rejectedCount: totalRejectedCount,
    nowMs: Date.parse(nowIso),
  });

  const internalListingCount = validComps.filter(
    (c) => c.sourceType === 'internal_asking'
  ).length;
  const externalObservationCount = validComps.filter(
    (c) => c.sourceType === 'external_observation'
  ).length;

  return {
    make: subject.make,
    model: subject.model,
    targetYear: subject.year ?? null,
    yearMin,
    yearMax,
    trim: subject.trim ?? null,
    marketCategory: subject.marketCategory,
    location: locationLabel,
    currency: 'NGN',
    insufficientData: false,
    insufficiencyReason: null,
    minPrice,
    q1Price,
    medianPrice,
    meanPrice,
    q3Price,
    maxPrice,
    priceRangeLow,
    priceRangeHigh,
    marketEstimate: medianPrice,
    validObservationCount: validComps.length,
    internalListingCount,
    externalObservationCount,
    rejectedObservationCount: totalRejectedCount,
    duplicateObservationCount: duplicateCandidatesCount,
    confidenceScore: confidenceBreakdown.totalScore,
    confidenceLevel: confidenceBreakdown.level,
    confidenceBreakdown,
    priceDistribution: {
      iqr: outlierResult.iqr,
      mad: outlierResult.mad,
      stdDev,
      coefficientOfVariation,
      outlierMethod: outlierResult.method,
      outliersExcludedCount: outlierResult.excluded.length,
      outliersExcluded: outlierResult.excluded,
      histogramBuckets: buildHistogramBuckets(sortedPrices),
    },
    estimationMethodology: `Median asking-price benchmark for ${formatMarketCategoryLabel(subject.marketCategory)} computed from ${validComps.length} validated comparables (${internalListingCount} MANIFOLD asking, ${externalObservationCount} external observed; ${duplicateCandidatesCount} duplicate(s) & ${outlierResult.excluded.length} statistical outlier(s) excluded via ${outlierResult.method}).`,
    lastResearchAt: nowIso,
    matchedSamples: validComps.slice(0, 12),
  };
}
