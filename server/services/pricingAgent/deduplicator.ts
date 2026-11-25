import crypto from 'node:crypto';
import {
  normalizeBrandName,
  normalizeLocationToken,
  normalizeMarketCategory,
  normalizeModelName,
} from './matcher.js';
import type {
  DuplicateCandidateRecord,
  DuplicateDetectionResult,
} from './types.js';

const TRACKING_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
  'source',
  'share',
  'tracking_id',
]);

export function normalizeListingUrl(rawUrl: string | null | undefined): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const keptParams: Array<[string, string]> = [];

    for (const [key, value] of parsed.searchParams.entries()) {
      const lowerKey = key.toLowerCase();
      if (!TRACKING_QUERY_PARAMS.has(lowerKey) && !lowerKey.startsWith('utm_')) {
        keptParams.push([key, value]);
      }
    }
    keptParams.sort(([a], [b]) => a.localeCompare(b));

    const cleanSearch =
      keptParams.length > 0
        ? `?${keptParams.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
        : '';

    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `https://${hostname}${pathname}${cleanSearch}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '');
  }
}

export function extractSourceListingId(
  rawUrl: string | null | undefined,
  jsonLdItems?: any[]
): string | null {
  if (Array.isArray(jsonLdItems)) {
    for (const item of jsonLdItems) {
      if (!item || typeof item !== 'object') continue;
      const candidateId = item.sku || item.productID || item.vehicleIdentificationNumber || item.identifier;
      if (typeof candidateId === 'string' && candidateId.trim().length >= 3) {
        return candidateId.trim().slice(0, 120);
      }
    }
  }

  const normalized = normalizeListingUrl(rawUrl);
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    const qId = parsed.searchParams.get('id') || parsed.searchParams.get('listing_id') || parsed.searchParams.get('ad_id');
    if (qId && qId.trim().length >= 3) return qId.trim();

    // e.g. /cars/toyota-camry-2021-12345678.html or /listing/abc12345
    const slugMatch = parsed.pathname.match(/[-/]([a-z0-9]{6,24})(?:\.html?)?$/i);
    if (slugMatch?.[1]) {
      return slugMatch[1].toLowerCase();
    }
  } catch {
    return null;
  }

  return null;
}

export function extractDomainFromUrl(rawUrl: string | null | undefined): string {
  try {
    return new URL(String(rawUrl || '')).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function computeDedupeHash(candidate: DuplicateCandidateRecord): string {
  const make = normalizeBrandName(candidate.make);
  const model = normalizeModelName(candidate.model);
  const year = Number(candidate.year) || 0;
  const category = normalizeMarketCategory(candidate.marketCategory);
  // Bucket prices to nearest 100k NGN so trivial formatting variations collapse cleanly
  const priceBucket = Math.round(Number(candidate.price || 0) / 100_000) * 100_000;
  const loc = normalizeLocationToken(candidate.location);
  const mileageBucket =
    candidate.mileage && candidate.mileage > 0
      ? Math.round(candidate.mileage / 2500) * 2500
      : 'na';

  const rawKey = `${make}|${model}|${year}|${category}|${priceBucket}|${mileageBucket}|${loc}`;
  return crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 32);
}

function tokenizeDescription(text: string | null | undefined): Set<string> {
  const cleaned = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
  return new Set(cleaned);
}

export function jaccardTextSimilarity(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const setA = tokenizeDescription(a);
  const setB = tokenizeDescription(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? Number((intersection / union).toFixed(3)) : 0;
}

function hasSharedImageUrl(a?: string[], b?: string[]): boolean {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) {
    return false;
  }
  const normalizedA = new Set(a.map((u) => normalizeListingUrl(u)).filter(Boolean));
  for (const url of b) {
    const norm = normalizeListingUrl(url);
    if (norm && normalizedA.has(norm)) return true;
  }
  return false;
}

export function detectDuplicateObservation(
  candidate: DuplicateCandidateRecord,
  existingRecords: DuplicateCandidateRecord[]
): DuplicateDetectionResult {
  const candidateNormUrl = normalizeListingUrl(candidate.normalizedUrl);
  const candidateDomain = extractDomainFromUrl(candidateNormUrl);
  const candidateListingId = candidate.sourceListingId?.trim().toLowerCase() || null;
  const candidateHash = candidate.dedupeHash || computeDedupeHash(candidate);

  const candMake = normalizeBrandName(candidate.make);
  const candModel = normalizeModelName(candidate.model);
  const candCat = normalizeMarketCategory(candidate.marketCategory);
  const candLoc = normalizeLocationToken(candidate.location);

  for (const existing of existingRecords) {
    const existingId = existing.id || existing.normalizedUrl || existing.dedupeHash || 'existing';

    // 1. Exact normalized URL match
    const existingNormUrl = normalizeListingUrl(existing.normalizedUrl);
    if (candidateNormUrl && existingNormUrl && candidateNormUrl === existingNormUrl) {
      return {
        isDuplicate: true,
        duplicateOfId: existingId,
        reason: 'identical_normalized_url',
        similarityScore: 1,
        dedupeHash: candidateHash,
      };
    }

    // 2. Domain + source listing ID match
    const existingDomain = extractDomainFromUrl(existingNormUrl);
    const existingListingId = existing.sourceListingId?.trim().toLowerCase() || null;
    if (
      candidateListingId &&
      existingListingId &&
      candidateDomain &&
      existingDomain &&
      candidateDomain === existingDomain &&
      candidateListingId === existingListingId
    ) {
      return {
        isDuplicate: true,
        duplicateOfId: existingId,
        reason: 'matching_source_listing_id',
        similarityScore: 0.98,
        dedupeHash: candidateHash,
      };
    }

    // 3. Exact dedupe hash match
    const existingHash = existing.dedupeHash || computeDedupeHash(existing);
    if (candidateHash === existingHash) {
      return {
        isDuplicate: true,
        duplicateOfId: existingId,
        reason: 'identical_vehicle_price_fingerprint',
        similarityScore: 0.95,
        dedupeHash: candidateHash,
      };
    }

    // 4. Fuzzy cross-post duplicate check (same make/model/year/category, near-identical price/mileage/city + text or image overlap)
    if (
      candMake === normalizeBrandName(existing.make) &&
      candModel === normalizeModelName(existing.model) &&
      Number(candidate.year) === Number(existing.year) &&
      candCat === normalizeMarketCategory(existing.marketCategory)
    ) {
      const maxPrice = Math.max(candidate.price, existing.price, 1);
      const priceDiffPct = Math.abs(candidate.price - existing.price) / maxPrice;

      const mileageCompatible =
        candidate.mileage == null ||
        existing.mileage == null ||
        Math.abs(candidate.mileage - existing.mileage) <= 2500;

      const existingLoc = normalizeLocationToken(existing.location);
      const locationCompatible = !candLoc || !existingLoc || candLoc === existingLoc;

      if (priceDiffPct <= 0.03 && mileageCompatible && locationCompatible) {
        const textSim = jaccardTextSimilarity(candidate.description, existing.description);
        const sharedImg = hasSharedImageUrl(candidate.imageUrls, existing.imageUrls);

        if (sharedImg || textSim >= 0.72) {
          return {
            isDuplicate: true,
            duplicateOfId: existingId,
            reason: sharedImg
              ? 'cross_post_shared_image_and_price'
              : `cross_post_text_similarity_${Math.round(textSim * 100)}pct`,
            similarityScore: Math.max(textSim, sharedImg ? 0.9 : 0),
            dedupeHash: candidateHash,
          };
        }
      }
    }
  }

  return {
    isDuplicate: false,
    duplicateOfId: null,
    reason: null,
    similarityScore: 0,
    dedupeHash: candidateHash,
  };
}

export function deduplicateBatch<T extends DuplicateCandidateRecord>(
  items: T[],
  existingBaseline: DuplicateCandidateRecord[] = []
): {
  unique: Array<T & { dedupeHash: string }>;
  duplicates: Array<T & { dedupeHash: string; duplicateOfId: string | null; duplicateReason: string }>;
} {
  const accepted: Array<T & { dedupeHash: string }> = [];
  const duplicates: Array<
    T & { dedupeHash: string; duplicateOfId: string | null; duplicateReason: string }
  > = [];

  const comparisonPool: DuplicateCandidateRecord[] = [...existingBaseline];

  for (const item of items) {
    const result = detectDuplicateObservation(item, comparisonPool);
    if (result.isDuplicate) {
      duplicates.push({
        ...item,
        dedupeHash: result.dedupeHash,
        duplicateOfId: result.duplicateOfId,
        duplicateReason: result.reason || 'duplicate_detected',
      });
    } else {
      const enriched = {
        ...item,
        dedupeHash: result.dedupeHash,
      };
      accepted.push(enriched);
      comparisonPool.push(enriched);
    }
  }

  return { unique: accepted, duplicates };
}
