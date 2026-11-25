import type {
  MarketCategory,
  MatchCandidate,
  MatchEvaluation,
  MatchSubject,
} from './types.js';

const BRAND_ALIASES: Record<string, string> = {
  merc: 'mercedes-benz',
  mercedes: 'mercedes-benz',
  'mercedes benz': 'mercedes-benz',
  mercedesbenz: 'mercedes-benz',
  mb: 'mercedes-benz',
  vw: 'volkswagen',
  volks: 'volkswagen',
  chevy: 'chevrolet',
  landrover: 'land rover',
  rangerover: 'land rover',
  'range rover': 'land rover',
  lexus: 'lexus',
  toyota: 'toyota',
  honda: 'honda',
  hyundai: 'hyundai',
  kia: 'kia',
  nissan: 'nissan',
  ford: 'ford',
  bmw: 'bmw',
  audi: 'audi',
  acura: 'acura',
  infiniti: 'infiniti',
  peugeot: 'peugeot',
  mazda: 'mazda',
  mitsubishi: 'mitsubishi',
  suzuki: 'suzuki',
  volvo: 'volvo',
  porsche: 'porsche',
  jeep: 'jeep',
  gac: 'gac',
  changan: 'changan',
  jetour: 'jetour',
  innoson: 'innoson',
  ivm: 'innoson',
};

const LUXURY_OR_PERF_TRIMS = [
  'amg',
  'f sport',
  'fsport',
  'f-sport',
  'platinum',
  'limited',
  'xle',
  'xse',
  'touring',
  'ex-l',
  'exl',
  'luxury',
  'prestige',
  'autobiography',
  'denali',
  'trd',
  'v6',
  'v8',
  'hybrid',
  'awd',
  '4matic',
  'quattro',
  'xdrive',
];

const MID_TRIMS = ['se', 'sport', 'ex', 'sel', 'sr5', 'premium', 'glx', 'gls', 's-line'];
const BASE_TRIMS = ['le', 'lx', 'base', 'l', 's', 'ce', 'dx', 'standard'];

export function normalizeBrandName(raw: string | null | undefined): string {
  const cleaned = String(raw || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (BRAND_ALIASES[cleaned]) return BRAND_ALIASES[cleaned];
  const compact = cleaned.replace(/\s+/g, '');
  if (BRAND_ALIASES[compact]) return BRAND_ALIASES[compact];
  return cleaned;
}

export function normalizeModelName(raw: string | null | undefined): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/\b(sedan|suv|saloon|coupe|hatchback|pickup|truck|car|vehicle)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function normalizeLocationToken(raw: string | null | undefined): string {
  const cleaned = String(raw || '').toLowerCase().trim();
  if (!cleaned) return '';
  if (
    cleaned.includes('lagos') ||
    cleaned.includes('lekki') ||
    cleaned.includes('ikeja') ||
    cleaned.includes('victoria island') ||
    cleaned.includes('vi') ||
    cleaned.includes('ajah') ||
    cleaned.includes('ikoyi') ||
    cleaned.includes('surulere')
  ) {
    return 'lagos';
  }
  if (
    cleaned.includes('abuja') ||
    cleaned.includes('fct') ||
    cleaned.includes('wuse') ||
    cleaned.includes('maitama') ||
    cleaned.includes('garki') ||
    cleaned.includes('gwarinpa')
  ) {
    return 'abuja';
  }
  if (cleaned.includes('port harcourt') || cleaned.includes('rivers')) {
    return 'rivers';
  }
  if (cleaned.includes('ibadan') || cleaned.includes('oyo')) return 'oyo';
  if (cleaned.includes('kano')) return 'kano';
  if (cleaned.includes('enugu')) return 'enugu';
  if (cleaned.includes('ogun') || cleaned.includes('abeokuta')) return 'ogun';
  if (cleaned.includes('benin') || cleaned.includes('edo')) return 'edo';
  return cleaned.replace(/[^a-z]/g, '');
}

export function normalizeMarketCategory(raw: string | null | undefined): MarketCategory {
  const text = String(raw || '').toLowerCase().trim();
  if (!text) return 'unknown';

  if (
    text === 'foreign_used' ||
    text.includes('foreign used') ||
    text.includes('tokunbo') ||
    text.includes('direct belgium') ||
    text.includes('belgium') ||
    text.includes('usa used') ||
    text.includes('us used') ||
    text.includes('canada used') ||
    text.includes('duty paid')
  ) {
    return 'foreign_used';
  }

  if (
    text === 'nigerian_used' ||
    text.includes('nigerian used') ||
    text.includes('nigeria used') ||
    text.includes('naija used') ||
    text.includes('locally used') ||
    (text.includes('registered') && !text.includes('unregistered'))
  ) {
    return 'nigerian_used';
  }

  if (
    text === 'brand_new' ||
    text.includes('brand new') ||
    text === 'new' ||
    text.includes('0km') ||
    text.includes('0 km') ||
    text.includes('zero mileage')
  ) {
    return 'brand_new';
  }

  return 'unknown';
}

export function formatMarketCategoryLabel(category: MarketCategory): string {
  switch (category) {
    case 'foreign_used':
      return 'Foreign Used (Tokunbo)';
    case 'nigerian_used':
      return 'Nigerian Used';
    case 'brand_new':
      return 'Brand New';
    default:
      return 'Unspecified Condition';
  }
}

export function extractTrimTier(
  trimOrText: string | null | undefined
): 'base' | 'mid' | 'luxury' | 'unknown' {
  const text = String(trimOrText || '').toLowerCase().trim();
  if (!text) return 'unknown';

  for (const token of LUXURY_OR_PERF_TRIMS) {
    if (new RegExp(`\\b${token.replace(/[-]/g, '[-\\s]?')}\\b`, 'i').test(text)) {
      return 'luxury';
    }
  }
  for (const token of MID_TRIMS) {
    if (new RegExp(`\\b${token}\\b`, 'i').test(text)) {
      return 'mid';
    }
  }
  for (const token of BASE_TRIMS) {
    if (new RegExp(`\\b${token}\\b`, 'i').test(text)) {
      return 'base';
    }
  }
  return 'unknown';
}

export function computeVehicleMatchScore(
  subject: MatchSubject,
  candidate: MatchCandidate
): MatchEvaluation {
  const disqualificationReasons: string[] = [];
  const matchedAttributes: string[] = [];
  const penalties: string[] = [];

  if (candidate.isDuplicate) {
    disqualificationReasons.push('Candidate flagged as duplicate listing.');
  }

  if (!Number.isFinite(candidate.price) || candidate.price < 300_000) {
    disqualificationReasons.push('Candidate price missing or below valid Nigerian vehicle threshold.');
  }

  const subjectMake = normalizeBrandName(subject.make);
  const candidateMake = normalizeBrandName(candidate.make);
  if (!subjectMake || !candidateMake || subjectMake !== candidateMake) {
    disqualificationReasons.push(
      `Make mismatch (${candidate.make || 'unknown'} !== ${subject.make || 'unknown'}).`
    );
  } else {
    matchedAttributes.push('exact_make');
  }

  const subjectModel = normalizeModelName(subject.model);
  const candidateModel = normalizeModelName(candidate.model);
  if (!subjectModel || !candidateModel) {
    disqualificationReasons.push('Model identifier missing.');
  } else if (subjectModel !== candidateModel) {
    disqualificationReasons.push(
      `Model mismatch (${candidate.model} !== ${subject.model}).`
    );
  } else {
    matchedAttributes.push('exact_model');
  }

  // Strict category isolation: Foreign Used vs Nigerian Used vs Brand New must never be mixed
  const subjectCategory = subject.marketCategory;
  const candidateCategory =
    candidate.marketCategory && candidate.marketCategory !== 'unknown'
      ? candidate.marketCategory
      : normalizeMarketCategory(candidate.condition);

  if (subjectCategory !== 'unknown') {
    if (candidateCategory === 'unknown') {
      disqualificationReasons.push(
        `Candidate condition is unverified; excluded from ${formatMarketCategoryLabel(subjectCategory)} comparison.`
      );
    } else if (candidateCategory !== subjectCategory) {
      disqualificationReasons.push(
        `Market category mismatch (${candidateCategory} !== ${subjectCategory}).`
      );
    } else {
      matchedAttributes.push(`category:${subjectCategory}`);
    }
  }

  let score = 60;

  // Model year proximity (reject > 2 years apart, e.g. 2018 vs 2023)
  if (subject.year && subject.year >= 1985) {
    if (!candidate.year || candidate.year < 1985) {
      disqualificationReasons.push('Candidate model year missing or invalid.');
    } else {
      const yearDiff = Math.abs(candidate.year - subject.year);
      if (yearDiff > 2) {
        disqualificationReasons.push(
          `Model year difference (${candidate.year} vs ${subject.year}) exceeds ±2 year comparable limit.`
        );
      } else if (yearDiff === 0) {
        score += 20;
        matchedAttributes.push('exact_year');
      } else if (yearDiff === 1) {
        score += 10;
        penalties.push('year_delta_1');
      } else {
        score += 2;
        penalties.push('year_delta_2');
      }
    }
  }

  // Trim / variant compatibility
  const subjectTrim = [subject.trim, subject.variant].filter(Boolean).join(' ').trim();
  const candidateTrim = [candidate.trim, candidate.variant].filter(Boolean).join(' ').trim();
  if (subjectTrim && candidateTrim) {
    const subNorm = subjectTrim.toLowerCase().replace(/[^a-z0-9]/g, '');
    const candNorm = candidateTrim.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (subNorm === candNorm) {
      score += 12;
      matchedAttributes.push('exact_trim');
    } else {
      const subTier = extractTrimTier(subjectTrim);
      const candTier = extractTrimTier(candidateTrim);
      if (subTier !== 'unknown' && candTier !== 'unknown' && subTier !== candTier) {
        score -= 10;
        penalties.push(`trim_tier_mismatch:${subTier}_vs_${candTier}`);
      } else {
        score += 4;
      }
    }
  } else if (subjectTrim || candidateTrim) {
    score -= 2;
    penalties.push('partial_trim_metadata');
  }

  // Mileage delta scoring
  if (
    subject.mileage &&
    subject.mileage > 0 &&
    candidate.mileage &&
    candidate.mileage > 0
  ) {
    const mileageDiff = Math.abs(candidate.mileage - subject.mileage);
    if (mileageDiff <= 15_000) {
      score += 6;
      matchedAttributes.push('close_mileage');
    } else if (mileageDiff <= 40_000) {
      score += 2;
    } else if (mileageDiff > 90_000) {
      score -= 8;
      penalties.push('high_mileage_spread');
    }
  }

  // Regional proximity bonus (Lagos vs Abuja vs other states)
  const subLoc = normalizeLocationToken(subject.location);
  const candLoc = normalizeLocationToken(candidate.location);
  if (subLoc && candLoc) {
    if (subLoc === candLoc) {
      score += 5;
      matchedAttributes.push(`location:${subLoc}`);
    } else {
      score -= 2;
      penalties.push('cross_city_comparable');
    }
  }

  return {
    isComparable: disqualificationReasons.length === 0,
    score: Math.max(0, Math.min(100, score)),
    disqualificationReasons,
    matchedAttributes,
    penalties,
  };
}

export function filterComparableVehicles(
  subject: MatchSubject,
  candidates: MatchCandidate[]
): {
  comparables: Array<MatchCandidate & { matchScore: number; evaluation: MatchEvaluation }>;
  rejected: Array<{ id: string; reasons: string[] }>;
} {
  const comparables: Array<MatchCandidate & { matchScore: number; evaluation: MatchEvaluation }> = [];
  const rejected: Array<{ id: string; reasons: string[] }> = [];

  for (const candidate of candidates) {
    const evaluation = computeVehicleMatchScore(subject, candidate);
    if (evaluation.isComparable) {
      comparables.push({
        ...candidate,
        matchScore: evaluation.score,
        evaluation,
      });
    } else {
      rejected.push({
        id: candidate.id,
        reasons: evaluation.disqualificationReasons,
      });
    }
  }

  comparables.sort((a, b) => b.matchScore - a.matchScore);
  return { comparables, rejected };
}
