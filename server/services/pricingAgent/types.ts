export type MarketCategory = 'foreign_used' | 'nigerian_used' | 'brand_new' | 'unknown';

export type SellerType = 'dealer' | 'private' | 'marketplace' | 'unknown';

export type ProviderKey =
  | 'manifold_inventory'
  | 'approved_feed'
  | 'serper'
  | 'google_cse'
  | 'brave_search';

export interface ProviderStatus {
  key: ProviderKey;
  displayName: string;
  category: 'internal_inventory' | 'approved_feed' | 'search_api';
  configured: boolean;
  requiresSubscription: boolean;
  requiredEnvVars: string[];
  missingEnvVars: string[];
  costPerQueryUsd: number;
  dailyQuotaLimit: number | null;
  queriesToday: number;
  statusNote: string;
}

export interface SearchQueryTarget {
  make: string;
  model: string;
  year: number | null;
  trim: string | null;
  marketCategory: MarketCategory;
  location: string | null;
  queryText: string;
  sourceCarId?: string;
  demandScore: number;
  reason: string;
}

export interface RawSearchResult {
  providerKey: ProviderKey;
  title: string;
  url: string;
  snippet: string;
  sourceDomain: string;
  publishedDate?: string | null;
  detectedPriceNgn?: number | null;
}

export interface ExtractedListingRecord {
  sourceWebsite: string;
  sourceUrl: string;
  normalizedUrl: string;
  sourceListingId: string | null;
  make: string;
  model: string;
  variant: string | null;
  trim: string | null;
  generation: string | null;
  modelYear: number;
  askingPrice: number;
  currency: string;
  mileage: number | null;
  mileageUnit: string;
  condition: 'Foreign Used' | 'Nigerian Used' | 'Brand New' | 'Unknown';
  marketCategory: MarketCategory;
  transmission: string | null;
  fuelType: string | null;
  bodyType: string | null;
  drivetrain: string | null;
  engine: string | null;
  location: string | null;
  sellerType: SellerType;
  listingDate: string | null;
  observationDate: string;
  description: string | null;
  imageUrls: string[];
  supportingEvidence: string[];
  missingFields: string[];
  uncertaintyReasons: string[];
  extractionConfidence: number;
  extractionMethod: string;
  qualityStatus: 'valid' | 'rejected' | 'outlier_excluded' | 'insufficient_fields';
  rejectionReason: string | null;
  dedupeHash: string;
}

export interface MatchSubject {
  make: string;
  model: string;
  year?: number | null;
  trim?: string | null;
  variant?: string | null;
  generation?: string | null;
  marketCategory: MarketCategory;
  mileage?: number | null;
  location?: string | null;
}

export interface MatchCandidate {
  id: string;
  make: string;
  model: string;
  year: number;
  trim?: string | null;
  variant?: string | null;
  generation?: string | null;
  marketCategory: MarketCategory;
  condition?: string | null;
  mileage?: number | null;
  location?: string | null;
  price: number;
  currency?: string;
  sourceWebsite?: string;
  sourceUrl?: string | null;
  sourceTrustLevel?: 'official' | 'verified' | 'partner' | 'unverified';
  observedAt: string;
  isDuplicate?: boolean;
  missingFields?: string[];
  extractionConfidence?: number;
  sourceType: 'internal_asking' | 'external_observation';
}

export interface MatchEvaluation {
  isComparable: boolean;
  score: number;
  disqualificationReasons: string[];
  matchedAttributes: string[];
  penalties: string[];
}

export interface DuplicateCandidateRecord {
  id?: string;
  normalizedUrl?: string | null;
  sourceListingId?: string | null;
  make: string;
  model: string;
  year: number;
  marketCategory: MarketCategory;
  price: number;
  mileage?: number | null;
  location?: string | null;
  description?: string | null;
  imageUrls?: string[];
  dedupeHash?: string | null;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  duplicateOfId: string | null;
  reason: string | null;
  similarityScore: number;
  dedupeHash: string;
}

export interface ConfidenceBreakdown {
  sampleCountScore: number;
  sourceReliabilityScore: number;
  recencyScore: number;
  specCompletenessScore: number;
  priceConsistencyScore: number;
  duplicatePenalty: number;
  totalScore: number;
  level: 'high' | 'medium' | 'low' | 'insufficient';
  evidenceSummary: string;
}

export interface OutlierExcludedItem {
  id: string;
  label: string;
  price: number;
  reason: string;
}

export interface PriceDistributionSummary {
  iqr: number;
  mad: number;
  stdDev: number;
  coefficientOfVariation: number;
  outlierMethod: 'mad_modified_z' | 'iqr_tukey' | 'none_small_sample';
  outliersExcludedCount: number;
  outliersExcluded: OutlierExcludedItem[];
  histogramBuckets: Array<{ label: string; min: number; max: number; count: number }>;
}

export interface CalculatedMarketEstimate {
  make: string;
  model: string;
  targetYear: number | null;
  yearMin: number | null;
  yearMax: number | null;
  trim: string | null;
  marketCategory: MarketCategory;
  location: string;
  currency: string;
  insufficientData: boolean;
  insufficiencyReason: string | null;
  minPrice: number | null;
  q1Price: number | null;
  medianPrice: number | null;
  meanPrice: number | null;
  q3Price: number | null;
  maxPrice: number | null;
  priceRangeLow: number | null;
  priceRangeHigh: number | null;
  marketEstimate: number | null;
  validObservationCount: number;
  internalListingCount: number;
  externalObservationCount: number;
  rejectedObservationCount: number;
  duplicateObservationCount: number;
  confidenceScore: number;
  confidenceLevel: 'high' | 'medium' | 'low' | 'insufficient';
  confidenceBreakdown: ConfidenceBreakdown;
  priceDistribution: PriceDistributionSummary;
  estimationMethodology: string;
  lastResearchAt: string;
  matchedSamples: Array<MatchCandidate & { matchScore: number }>;
}

export interface PricingAgentConfig {
  id: string;
  schedule_enabled: boolean;
  is_paused: boolean;
  default_frequency: 'daily' | 'weekly' | 'manual';
  high_demand_interval_hours: number;
  standard_interval_hours: number;
  insufficient_retry_hours: number;
  max_vehicles_per_run: number;
  max_queries_per_run: number;
  max_fetches_per_query: number;
  max_daily_provider_queries: number;
  monthly_provider_budget_usd: number;
  provider_priority: ProviderKey[];
  last_scheduled_run_at: string | null;
  next_scheduled_run_at: string | null;
  updated_at?: string;
}

export interface SourceFetchOutcome {
  url: string;
  domain: string;
  providerKey: ProviderKey;
  status:
    | 'SUCCESS'
    | 'PARTIAL'
    | 'BLOCKED_BY_PROTECTION'
    | 'RENDERING_REQUIRED'
    | 'SSRF_BLOCKED'
    | 'SKIPPED_DUPLICATE_URL'
    | 'FAILED';
  httpStatus?: number;
  extractedCount: number;
  validCount: number;
  rejectedCount: number;
  duplicateCount: number;
  error?: string;
}

export interface PricingAgentRunResult {
  runId: string;
  triggerType: 'manual' | 'scheduled' | 'targeted';
  status: 'completed' | 'partial' | 'failed' | 'skipped_fresh' | 'paused';
  startedAt: string;
  completedAt: string;
  queriesExecuted: number;
  urlsFetched: number;
  observationsCollected: number;
  observationsRejected: number;
  duplicatesDetected: number;
  restrictedSourcesCount: number;
  estimatesUpdated: number;
  estimatedCostUsd: number;
  targetsProcessed: SearchQueryTarget[];
  providerUsage: Record<string, { queries: number; results: number; errors: number; costUsd: number }>;
  sourceOutcomes: SourceFetchOutcome[];
  estimates: CalculatedMarketEstimate[];
  persistedToDb: boolean;
  notice?: string;
}
