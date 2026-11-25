import { supabase } from '../lib/supabase';
import { Car } from '../types';

export type AiFeatureModuleKey =
  | 'listing_copy'
  | 'vehicle_search'
  | 'voice_transcribe'
  | 'price_intelligence'
  | 'market_insights'
  | 'assistant';

export interface AiServiceError extends Error {
  status: number;
  code?: string;
}

function buildError(message: string, status: number, code?: string): AiServiceError {
  const err = new Error(message) as AiServiceError;
  err.status = status;
  err.code = code;
  return err;
}

async function getAuthHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...(extra || {}) };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // public/anonymous requests proceed without Bearer token
  }
  return headers;
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders(
    init?.body && !(init.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : undefined
  );

  const response = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw buildError(
      payload?.error || `Request failed (${response.status})`,
      response.status,
      payload?.code
    );
  }
  return payload as T;
}

// ============================================================================
// 1. ADMIN HEALTH, TEST, OVERVIEW & SETTINGS
// ============================================================================

export interface OpenAiHealthResponse {
  provider: 'openai';
  apiKeyConfigured: boolean;
  modelConfigured: boolean;
  configuredModel: string | null;
  transcriptionModel: string;
  embeddingModel: string;
  ready: boolean;
  rateLimiterScope: string;
  timestamp: string;
}

export interface OpenAiTestResponse {
  connected: boolean;
  requestId: string;
  model?: string;
  responseId?: string;
  output?: string;
  latencyMs: number;
  error?: string;
  code?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface AiFeatureSetting {
  module_key: AiFeatureModuleKey;
  display_name: string;
  description: string;
  enabled: boolean;
  model_override: string | null;
  max_requests_per_min: number;
  max_output_tokens: number;
  monthly_budget_usd: number;
  updated_at?: string;
}

export interface AdminAiOverviewResponse {
  config: {
    apiKeyConfigured: boolean;
    modelConfigured: boolean;
    configuredModel: string | null;
    transcriptionModel: string;
    embeddingModel: string;
  };
  dbStatus: {
    tablesExist: boolean;
    missingTables: string[];
  };
  summary: {
    totalRequests: number;
    successCount: number;
    failureCount: number;
    avgLatencyMs: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    estimatedSpendUsd: number;
    listingGenerations: number;
    searchRequests: number;
    voiceRequests: number;
    assistantRequests: number;
    rateLimitEvents: number;
    trackedSearches: number;
    textSearchCount: number;
    voiceSearchCount: number;
    zeroResultSearches: number;
  };
  byModule: Array<{
    module: string;
    requests: number;
    failures: number;
    tokens: number;
    spendUsd: number;
    avgLatencyMs: number;
  }>;
  byModel: Array<{
    model: string;
    requests: number;
    tokens: number;
    spendUsd: number;
  }>;
  settings: AiFeatureSetting[];
  failedRequests: Array<{
    request_id: string;
    feature_module: string;
    user_role: string;
    model: string;
    latency_ms: number;
    error_code?: string | null;
    error_message?: string | null;
    created_at?: string;
  }>;
  recentLogs: Array<{
    request_id: string;
    feature_module: string;
    user_role: string;
    model: string;
    total_tokens: number;
    estimated_cost_usd?: number;
    latency_ms: number;
    success: boolean;
    created_at?: string;
  }>;
}

// ============================================================================
// 2. DEALER LISTING INTELLIGENCE TYPES
// ============================================================================

export type ListingActionType =
  | 'generate'
  | 'regenerate'
  | 'more_persuasive'
  | 'shorter'
  | 'more_detailed'
  | 'improve_grammar';

export type ListingTone =
  | 'executive_concierge'
  | 'trust_transparent'
  | 'performance_enthusiast'
  | 'family_practical'
  | 'value_focused';

export type ListingTargetBuyer =
  | 'lagos_abuja_executive'
  | 'family_buyer'
  | 'first_time_tokunbo_buyer'
  | 'corporate_fleet'
  | 'enthusiast';

export type ListingLength = 'concise' | 'standard' | 'comprehensive';
export type ListingApproach = 'facts_and_value' | 'story_and_lifestyle' | 'inspection_led';
export type ListingSellingAngle =
  | 'verified_condition'
  | 'value_and_pricing'
  | 'comfort_and_spec'
  | 'reliability_and_low_running_cost';
export type ListingCallToAction =
  | 'book_inspection'
  | 'request_video_walkaround'
  | 'concierge_enquiry';

export interface GenerateListingCopyPayload {
  carId?: string;
  make: string;
  model: string;
  trim?: string;
  year?: number;
  bodyType?: string;
  condition?: string;
  mileage?: number;
  transmission?: string;
  fuelType?: string;
  driveType?: string;
  engine?: string;
  horsepower?: number | null;
  exteriorColor?: string;
  interiorColor?: string;
  seats?: number;
  doors?: number;
  price?: number;
  previousPrice?: number | null;
  location?: string;
  state?: string;
  features?: string[];
  action: ListingActionType;
  currentDescription?: string;
  tone: ListingTone;
  targetBuyer: ListingTargetBuyer;
  length: ListingLength;
  approach: ListingApproach;
  sellingAngle: ListingSellingAngle;
  callToAction: ListingCallToAction;
  customInstructions?: string;
}

export interface ListingCopyResponse {
  requestId: string;
  description: string;
  short_summary: string;
  selling_highlights: string[];
  seo_title: string;
  seo_meta_description: string;
  preserved_model_title: string;
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    latencyMs: number;
  };
}

// ============================================================================
// 3. SEARCH & VOICE TYPES
// ============================================================================

export interface ParsedSearchIntent {
  make: string | null;
  model: string | null;
  bodyType: string | null;
  condition: 'Foreign Used' | 'Brand New' | 'Nigerian Used' | null;
  location: string | null;
  minPriceNgn: number | null;
  maxPriceNgn: number | null;
  yearMin: number | null;
  yearMax: number | null;
  transmission: 'Automatic' | 'Manual' | null;
  fuelType: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric' | null;
  keywords: string[];
  intentSummary: string;
  nigerianTermsMatched: string[];
}

export interface RankedCarHit {
  car: Car;
  matchTier: 'exact' | 'strong' | 'alternative';
  score: number;
  matchedCriteria: string[];
  disclosedDifferences: string[];
}

export interface VehicleSearchResponse {
  requestId: string;
  analyticsId: string | null;
  parsedIntent: ParsedSearchIntent;
  exactMatches: RankedCarHit[];
  strongMatches: RankedCarHit[];
  alternatives: RankedCarHit[];
  totalInventoryChecked: number;
  zeroExactResults: boolean;
  noExactMatchMessage: string | null;
  usage: {
    model: string;
    totalTokens: number;
    latencyMs: number;
  };
}

// ============================================================================
// 4. PRICE INTELLIGENCE TYPES
// ============================================================================

export interface PriceComparableSample {
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

export interface PriceIntelligenceResponse {
  requestId: string;
  aiCommentaryEnabled: boolean;
  aiWarning?: string;
  stats: {
    insufficientData: boolean;
    insufficiencyReason: string | null;
    marketCategory?: 'foreign_used' | 'nigerian_used' | 'brand_new' | 'unknown';
    marketCategoryLabel?: string;
    sampleCount: number;
    internalAskingCount: number;
    externalObservationCount: number;
    completedSalesCount: number;
    outliersExcludedCount?: number;
    duplicatesExcludedCount?: number;
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
    confidenceScore?: number;
    confidenceBreakdown?: {
      sampleCountScore: number;
      sourceReliabilityScore: number;
      recencyScore: number;
      specCompletenessScore: number;
      priceConsistencyScore: number;
      duplicatePenalty: number;
      totalScore: number;
      level: string;
      evidenceSummary: string;
    };
    priceDistribution?: {
      outlierMethod: string;
      outliersExcludedCount: number;
      histogramBuckets: Array<{ label: string; min: number; max: number; count: number }>;
    };
    lastResearchAt?: string | null;
    priceHistory?: Array<{
      date: string;
      medianPrice: number | null;
      validObservationCount: number;
      confidenceLevel: string;
    }>;
    comparables: PriceComparableSample[];
    methodologyNote: string;
  };
  commentary: {
    headlineSummary: string;
    pricingRationale: string;
    dealerGuidance: string;
    buyerTransparencyNote: string;
  } | null;
}

// ============================================================================
// 5. MARKET INTELLIGENCE & ASSISTANT TYPES
// ============================================================================

export interface MarketInsightsResponse {
  requestId: string;
  roleScope: 'admin' | 'dealer';
  internalPlatformData: {
    scope: string;
    inventoryCount: number;
    topMakesInInventory: Array<{ name: string; count: number }>;
    topBodyTypesInInventory: Array<{ name: string; count: number }>;
    topLocationsInInventory: Array<{ name: string; count: number }>;
    budgetBrackets: {
      under20M: number;
      from20Mto45M: number;
      from45Mto90M: number;
      over90M: number;
    };
    searchVolumeTracked: number;
    topSearchedMakes: Array<{ name: string; count: number }>;
    topSearchedBodyTypes: Array<{ name: string; count: number }>;
    topSearchedLocations: Array<{ name: string; count: number }>;
    zeroResultSearchCount: number;
    topUnmetQueries: Array<{ name: string; count: number }>;
    totalRecentInquiries?: number;
    totalRecentCarHunts?: number;
  };
  verifiedExternalData: {
    approvedObservationCount: number;
    byMakeSummary: Array<{
      make: string;
      sampleCount: number;
      avgAskingPriceNgn: number;
      sources: string[];
      latestObservedDate: string;
    }>;
  };
  aiInterpretation: {
    executiveSummary: string;
    supplyAndPricingSignals: string[];
    unmetBuyerDemandSignals: string[];
    recommendedActions: string[];
    disclaimer: string;
  } | null;
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantSuggestedAction {
  label: string;
  actionType: 'view_car' | 'open_inquiry' | 'car_hunt' | 'browse_cars' | 'dealer_pricing';
  target: string;
}

export interface AssistantVehicleCitation {
  id: string;
  slug: string;
  title: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  condition: string;
  price_ngn: number;
  mileage_km: number;
  location: string;
  state: string;
}

export interface AssistantChatResponse {
  requestId: string;
  reply: string;
  recommendedVehicles: AssistantVehicleCitation[];
  suggestedActions: AssistantSuggestedAction[];
}

export const aiService = {
  checkHealth: () => apiJson<OpenAiHealthResponse>('/api/ai/health'),

  testConnection: (modelOverride?: string) =>
    apiJson<OpenAiTestResponse>('/api/ai/test', {
      method: 'POST',
      body: JSON.stringify({ modelOverride }),
    }),

  getDbStatus: () =>
    apiJson<{ tablesExist: boolean; missingTables: string[] }>('/api/ai/db-status'),

  getMigrationSql: async (): Promise<string> => {
    const res = await fetch('/api/ai/migration-sql');
    return res.ok ? await res.text() : '';
  },

  getAdminOverview: () => apiJson<AdminAiOverviewResponse>('/api/ai/admin/overview'),

  updateModuleSetting: (payload: {
    moduleKey: AiFeatureModuleKey;
    enabled?: boolean;
    modelOverride?: string | null;
    maxRequestsPerMin?: number;
    maxOutputTokens?: number;
    monthlyBudgetUsd?: number;
  }) =>
    apiJson<{ setting: AiFeatureSetting; persistedToDb: boolean; warning?: string }>(
      '/api/ai/admin/settings',
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    ),

  generateListingCopy: (payload: GenerateListingCopyPayload) =>
    apiJson<ListingCopyResponse>('/api/ai/dealer/listing-copy', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  searchVehicles: (query: string, inputMode: 'text' | 'voice' = 'text', limit = 24) =>
    apiJson<VehicleSearchResponse>('/api/ai/search', {
      method: 'POST',
      body: JSON.stringify({ query, inputMode, limit }),
    }),

  trackSearchEvent: (analyticsId: string, clickedCarId?: string, enquiryConverted?: boolean) =>
    apiJson<{ updated: boolean }>('/api/ai/search/event', {
      method: 'POST',
      body: JSON.stringify({ analyticsId, clickedCarId, enquiryConverted }),
    }).catch(() => ({ updated: false })),

  transcribeVoiceAudio: async (blob: Blob, filename = 'voice-search.webm') => {
    const formData = new FormData();
    formData.append('audio', blob, filename);
    const headers = await getAuthHeaders();
    const res = await fetch('/api/ai/transcribe', {
      method: 'POST',
      headers,
      body: formData,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw buildError(
        payload?.error || `Transcription failed (${res.status})`,
        res.status,
        payload?.code
      );
    }
    return payload as {
      requestId: string;
      transcript: string;
      model: string;
      latencyMs: number;
    };
  },

  getPriceIntelligence: (payload: {
    carId?: string;
    make: string;
    model: string;
    year?: number;
    trim?: string;
    condition?: string;
    mileage?: number;
    location?: string;
    askingPrice?: number;
    includeAiCommentary?: boolean;
  }) =>
    apiJson<PriceIntelligenceResponse>('/api/ai/price-intelligence', {
      method: 'POST',
      body: JSON.stringify({ includeAiCommentary: true, ...payload }),
    }),

  getMarketInsights: (includeAiSummary = true, focusTopic?: string) =>
    apiJson<MarketInsightsResponse>('/api/ai/market-insights', {
      method: 'POST',
      body: JSON.stringify({ includeAiSummary, focusTopic }),
    }),

  sendAssistantMessage: (payload: {
    messages: AssistantMessage[];
    focusedCarSlug?: string;
    surface: 'marketplace' | 'car_detail' | 'dealer_portal';
  }) =>
    apiJson<AssistantChatResponse>('/api/ai/assistant', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
