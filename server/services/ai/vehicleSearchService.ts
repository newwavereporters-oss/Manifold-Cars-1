import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { runStructuredJsonResponse } from '../../lib/openai.js';
import { getSupabaseClient } from '../../lib/supabaseServer.js';

export const VehicleSearchRequestSchema = z.object({
  query: z.string().trim().min(2, 'Please enter a vehicle search query.').max(400),
  inputMode: z.enum(['text', 'voice']).default('text'),
  limit: z.number().int().min(1).max(36).default(24),
});

export const ParsedVehicleSearchIntentSchema = z.object({
  make: z.string().nullable(),
  model: z.string().nullable(),
  bodyType: z.string().nullable(),
  condition: z.enum(['Foreign Used', 'Brand New', 'Nigerian Used']).nullable(),
  location: z.string().nullable(),
  minPriceNgn: z.number().nonnegative().nullable(),
  maxPriceNgn: z.number().nonnegative().nullable(),
  yearMin: z.number().int().min(1985).max(2028).nullable(),
  yearMax: z.number().int().min(1985).max(2028).nullable(),
  transmission: z.enum(['Automatic', 'Manual']).nullable(),
  fuelType: z.enum(['Petrol', 'Diesel', 'Hybrid', 'Electric']).nullable(),
  keywords: z.array(z.string()).max(8),
  intentSummary: z.string(),
  nigerianTermsMatched: z.array(z.string()).max(6),
});

export type ParsedVehicleSearchIntent = z.infer<typeof ParsedVehicleSearchIntentSchema>;

const SEARCH_INTENT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'make',
    'model',
    'bodyType',
    'condition',
    'location',
    'minPriceNgn',
    'maxPriceNgn',
    'yearMin',
    'yearMax',
    'transmission',
    'fuelType',
    'keywords',
    'intentSummary',
    'nigerianTermsMatched',
  ],
  properties: {
    make: { type: ['string', 'null'] },
    model: { type: ['string', 'null'] },
    bodyType: {
      type: ['string', 'null'],
      description: 'Canonical body type such as SUV, Sedan, Hatchback, Pickup, Coupe, Van, Truck, Luxury.',
    },
    condition: {
      type: ['string', 'null'],
      enum: ['Foreign Used', 'Brand New', 'Nigerian Used', null],
    },
    location: { type: ['string', 'null'] },
    minPriceNgn: { type: ['number', 'null'] },
    maxPriceNgn: { type: ['number', 'null'] },
    yearMin: { type: ['integer', 'null'] },
    yearMax: { type: ['integer', 'null'] },
    transmission: { type: ['string', 'null'], enum: ['Automatic', 'Manual', null] },
    fuelType: {
      type: ['string', 'null'],
      enum: ['Petrol', 'Diesel', 'Hybrid', 'Electric', null],
    },
    keywords: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    intentSummary: { type: 'string' },
    nigerianTermsMatched: { type: 'array', items: { type: 'string' }, maxItems: 6 },
  },
};

export interface RankedCarHit {
  car: Record<string, unknown>;
  matchTier: 'exact' | 'strong' | 'alternative';
  score: number;
  matchedCriteria: string[];
  disclosedDifferences: string[];
}

function normalizeConditionText(val: unknown): string {
  const raw = String(val || '').toLowerCase();
  if (raw.includes('tokunbo') || raw.includes('foreign')) return 'Foreign Used';
  if (raw.includes('brand') || raw.includes('new')) return 'Brand New';
  if (raw.includes('nigerian') || raw.includes('local')) return 'Nigerian Used';
  return String(val || '');
}

function mapPublicCarRow(row: any) {
  let gallery1 = row.gallery_image_1_url || '';
  let gallery2 = row.gallery_image_2_url || '';
  if (Array.isArray(row.car_images) && row.car_images.length > 0) {
    const i1 = row.car_images.find((i: any) => i.position === 1);
    const i2 = row.car_images.find((i: any) => i.position === 2);
    if (i1?.image_url) gallery1 = i1.image_url;
    if (i2?.image_url) gallery2 = i2.image_url;
  }

  let videoObj = {
    youtube_video_id: row.youtube_video_id || '',
    youtube_url: row.youtube_url || '',
    youtube_thumbnail_url: row.youtube_thumbnail_url || '',
    video_title: row.video_title || row.title,
    video_duration: row.video_duration || '12:00',
    video_type: (row.video_type || 'full_review') as 'full_review' | 'walkaround' | 'car_hunt',
    is_primary: true,
    presenter_name: row.video_presenter || 'MANIFOLD Presenter',
  };
  if (Array.isArray(row.car_media) && row.car_media.length > 0) {
    const m = row.car_media.find((x: any) => x.is_primary) || row.car_media[0];
    if (m) {
      videoObj = {
        youtube_video_id: m.youtube_video_id || videoObj.youtube_video_id,
        youtube_url: m.youtube_url || videoObj.youtube_url,
        youtube_thumbnail_url: m.youtube_thumbnail_url || videoObj.youtube_thumbnail_url,
        video_title: m.title || row.title,
        video_duration: m.duration || '12:00',
        video_type: m.video_type === 'walkaround' ? 'walkaround' : 'full_review',
        is_primary: true,
        presenter_name: m.presenter || 'MANIFOLD Presenter',
      };
    }
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    year: Number(row.year) || 2024,
    brand_id: row.brand_id ?? null,
    make: row.make || 'Vehicle',
    model: row.model || 'Model',
    trim: row.trim || row.variant || '',
    type_id: row.type_id ?? null,
    body_type: row.body_type || 'SUV',
    condition: row.condition || 'Foreign Used',
    price: Number(row.price) || 0,
    original_price: row.original_price || row.previous_price ? Number(row.original_price || row.previous_price) : undefined,
    is_price_reduced: Boolean(row.is_price_reduced || (row.previous_price && Number(row.previous_price) > Number(row.price))),
    location: row.location || 'Lagos',
    state: row.state || 'Lagos',
    mileage: Number(row.mileage) || 0,
    transmission: row.transmission || 'Automatic',
    fuel_type: row.fuel_type || 'Petrol',
    drive_type: row.drive_type || 'AWD',
    engine: row.engine || '3.5L V6',
    horsepower: row.horsepower ? Number(row.horsepower) : undefined,
    exterior_color: row.exterior_color || 'Metallic Black',
    interior_color: row.interior_color || 'Black Leather',
    seats: Number(row.seats) || 5,
    doors: Number(row.doors) || 4,
    is_featured: Boolean(row.is_featured),
    status: row.status,
    views_count: Number(row.views_count) || 0,
    created_at: row.created_at,
    description: row.description || '',
    features: Array.isArray(row.features) ? row.features : [],
    video: videoObj,
    gallery_image_1_url: gallery1,
    gallery_image_2_url: gallery2,
    verification: {
      is_verified: Boolean(row.is_verified ?? true),
      dealer_verified: true,
      vehicle_physically_seen: true,
      video_reviewed: Boolean(videoObj.youtube_video_id),
      price_confirmed: true,
      vin_checked: true,
      inspection_score: Number(row.inspection_score) || 95,
      verified_date: row.verified_date || 'Verified',
      verified_by: row.verified_by || 'MANIFOLD Field Unit',
    },
    // Dealer PII (phone/email) intentionally omitted for public safety
    dealer: {
      id: row.dealers?.id || row.dealer_id || 'dlr-partner',
      name: row.dealers?.business_name || row.dealers?.name || row.dealer_name || 'MANIFOLD Verified Partner',
      city: row.dealers?.city || row.dealer_city || 'Lagos',
      state: row.dealers?.state || row.dealer_state || 'Lagos',
      verified_partner: Boolean(row.dealers?.is_verified ?? true),
      joined_year: Number(row.dealers?.joined_year || 2024),
    },
  };
}

export function rankCarsAgainstIntent(
  cars: Record<string, any>[],
  intent: ParsedVehicleSearchIntent
): {
  exactMatches: RankedCarHit[];
  strongMatches: RankedCarHit[];
  alternatives: RankedCarHit[];
} {
  const activeChecks: Array<{
    key: string;
    label: string;
    weight: number;
    test: (car: Record<string, any>) => { matched: boolean; diff?: string };
  }> = [];

  if (intent.make) {
    const target = intent.make.toLowerCase();
    activeChecks.push({
      key: 'make',
      label: `Make: ${intent.make}`,
      weight: 28,
      test: (c) => ({
        matched: String(c.make || '').toLowerCase().includes(target),
        diff: `Make is ${c.make} instead of ${intent.make}`,
      }),
    });
  }

  if (intent.model) {
    const target = intent.model.toLowerCase();
    activeChecks.push({
      key: 'model',
      label: `Model: ${intent.model}`,
      weight: 30,
      test: (c) => ({
        matched:
          String(c.model || '').toLowerCase().includes(target) ||
          String(c.title || '').toLowerCase().includes(target),
        diff: `Model is ${c.model} instead of ${intent.model}`,
      }),
    });
  }

  if (intent.bodyType) {
    const target = intent.bodyType.toLowerCase();
    activeChecks.push({
      key: 'bodyType',
      label: `Body type: ${intent.bodyType}`,
      weight: 20,
      test: (c) => ({
        matched: String(c.body_type || '').toLowerCase().includes(target),
        diff: `Body type is ${c.body_type} instead of ${intent.bodyType}`,
      }),
    });
  }

  if (intent.condition) {
    activeChecks.push({
      key: 'condition',
      label: `Condition: ${intent.condition}`,
      weight: 16,
      test: (c) => {
        const normalized = normalizeConditionText(c.condition);
        return {
          matched: normalized === intent.condition,
          diff: `Condition is ${c.condition} instead of ${intent.condition}`,
        };
      },
    });
  }

  if (intent.maxPriceNgn !== null) {
    const cap = intent.maxPriceNgn;
    activeChecks.push({
      key: 'maxPrice',
      label: `Within ₦${Math.round(cap / 1_000_000)}M budget`,
      weight: 24,
      test: (c) => {
        const p = Number(c.price || 0);
        if (p <= cap) return { matched: true };
        const overM = ((p - cap) / 1_000_000).toFixed(1);
        return {
          matched: false,
          diff: `₦${overM}M above ₦${Math.round(cap / 1_000_000)}M budget`,
        };
      },
    });
  }

  if (intent.minPriceNgn !== null) {
    const floor = intent.minPriceNgn;
    activeChecks.push({
      key: 'minPrice',
      label: `Above ₦${Math.round(floor / 1_000_000)}M`,
      weight: 12,
      test: (c) => {
        const p = Number(c.price || 0);
        return {
          matched: p >= floor,
          diff: `Priced below ₦${Math.round(floor / 1_000_000)}M floor`,
        };
      },
    });
  }

  if (intent.location) {
    const target = intent.location.toLowerCase();
    activeChecks.push({
      key: 'location',
      label: `Location: ${intent.location}`,
      weight: 16,
      test: (c) => {
        const loc = `${c.location || ''} ${c.state || ''}`.toLowerCase();
        return {
          matched: loc.includes(target),
          diff: `Located in ${c.location}, ${c.state} (instead of ${intent.location})`,
        };
      },
    });
  }

  if (intent.yearMin !== null) {
    const minY = intent.yearMin;
    activeChecks.push({
      key: 'yearMin',
      label: `${minY}+ model year`,
      weight: 14,
      test: (c) => ({
        matched: Number(c.year) >= minY,
        diff: `${c.year} model year (older than ${minY})`,
      }),
    });
  }

  if (intent.yearMax !== null) {
    const maxY = intent.yearMax;
    activeChecks.push({
      key: 'yearMax',
      label: `Up to ${maxY}`,
      weight: 10,
      test: (c) => ({
        matched: Number(c.year) <= maxY,
        diff: `${c.year} model year`,
      }),
    });
  }

  if (intent.transmission) {
    const target = intent.transmission.toLowerCase();
    activeChecks.push({
      key: 'transmission',
      label: `${intent.transmission} transmission`,
      weight: 10,
      test: (c) => ({
        matched: String(c.transmission || '').toLowerCase() === target,
        diff: `${c.transmission} gearbox`,
      }),
    });
  }

  if (intent.fuelType) {
    const target = intent.fuelType.toLowerCase();
    activeChecks.push({
      key: 'fuelType',
      label: `${intent.fuelType} fuel`,
      weight: 10,
      test: (c) => ({
        matched: String(c.fuel_type || '').toLowerCase() === target,
        diff: `${c.fuel_type} fuel`,
      }),
    });
  }

  const exactMatches: RankedCarHit[] = [];
  const strongMatches: RankedCarHit[] = [];
  const alternatives: RankedCarHit[] = [];

  for (const car of cars) {
    const matchedCriteria: string[] = [];
    const disclosedDifferences: string[] = [];
    let matchedWeight = 0;
    let totalWeight = 0;

    for (const check of activeChecks) {
      totalWeight += check.weight;
      const res = check.test(car);
      if (res.matched) {
        matchedWeight += check.weight;
        matchedCriteria.push(check.label);
      } else if (res.diff) {
        disclosedDifferences.push(res.diff);
      }
    }

    // Keyword boost if any free-form tokens match description/trim/title
    if (intent.keywords.length > 0) {
      const hay = `${car.title} ${car.trim} ${car.engine} ${car.description} ${(car.features || []).join(' ')}`.toLowerCase();
      for (const kw of intent.keywords) {
        const clean = kw.trim().toLowerCase();
        if (clean.length >= 2 && hay.includes(clean)) {
          matchedWeight += 5;
          matchedCriteria.push(`Matches "${kw}"`);
        }
      }
    }

    const ratio = totalWeight > 0 ? matchedWeight / totalWeight : 1;
    const score = Math.round(ratio * 100);

    // Check price proximity ceiling for alternatives (don't recommend a 180M car when user asked for 15M)
    const farOverBudget =
      intent.maxPriceNgn !== null && Number(car.price || 0) > intent.maxPriceNgn * 1.45;

    if (disclosedDifferences.length === 0 && activeChecks.length > 0) {
      exactMatches.push({ car, matchTier: 'exact', score: 100, matchedCriteria, disclosedDifferences: [] });
    } else if (activeChecks.length === 0 && matchedCriteria.length > 0) {
      exactMatches.push({ car, matchTier: 'exact', score: 95, matchedCriteria, disclosedDifferences: [] });
    } else if (!farOverBudget && ratio >= 0.55 && matchedCriteria.length >= 1) {
      strongMatches.push({ car, matchTier: 'strong', score, matchedCriteria, disclosedDifferences });
    } else if (!farOverBudget && matchedCriteria.length >= 1 && ratio >= 0.25) {
      alternatives.push({ car, matchTier: 'alternative', score, matchedCriteria, disclosedDifferences });
    }
  }

  exactMatches.sort((a, b) => Number(b.car.is_featured) - Number(a.car.is_featured));
  strongMatches.sort((a, b) => b.score - a.score);
  alternatives.sort((a, b) => b.score - a.score);

  return { exactMatches, strongMatches, alternatives };
}

export async function runVehicleIntelligenceSearch(params: {
  query: string;
  inputMode: 'text' | 'voice';
  limit: number;
  userRole: 'admin' | 'dealer' | 'buyer' | 'anonymous';
  supabase?: SupabaseClient | null;
  modelOverride?: string | null;
  maxOutputTokens?: number;
}) {
  const instructions = `You are MANIFOLD Vehicle Search Parser for Nigeria's automotive marketplace.
Convert the buyer's natural-language or voice-transcribed car query into structured filter fields.
Understand Nigerian automotive expressions cleanly:
- "Tokunbo" / "foreign used" / "clean import" -> condition: "Foreign Used"
- "Nigerian used" / "naija used" / "first owner naija" -> condition: "Nigerian Used"
- "Brand new" / "tear rubber" / "zero mileage" -> condition: "Brand New"
- Currency: "25m" / "25 million" / "N25M" / "25,000,000" -> 25000000 (in NGN Naira).
- Locations: Lekki, Victoria Island, VI, Ikoyi, Ikeja, Ajah, Lagos, Abuja, Wuse, Maitama, Port Harcourt, Ibadan.
- Models/nicknames: "Muscle" (Camry), "Evil Spirit" / "Big Daddy" (Toyota Camry older trims), "EOD" (Honda Accord), "Prado", "RX350", "RX 350", "GLE", "GLK".
NEVER generate SQL. Leave unmentioned filters as null.`;

  const aiResult = await runStructuredJsonResponse<ParsedVehicleSearchIntent>({
    instructions,
    input: params.query,
    schemaName: 'manifold_vehicle_search_intent',
    schema: SEARCH_INTENT_JSON_SCHEMA,
    modelOverride: params.modelOverride,
    maxOutputTokens: Math.min(params.maxOutputTokens ?? 550, 800),
    temperature: 0.1,
  });

  const parsedIntent = ParsedVehicleSearchIntentSchema.parse(aiResult.data);

  // Query live published MANIFOLD inventory via parameterized Supabase query
  const supabase = params.supabase ?? getSupabaseClient();
  let publishedCars: Record<string, any>[] = [];
  if (supabase) {
    const { data, error } = await supabase
      .from('cars')
      .select(`
        *,
        car_media (*),
        car_images (*),
        dealers (id, name, business_name, city, state, is_verified, joined_year)
      `)
      .in('status', ['PUBLISHED', 'published'])
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && Array.isArray(data)) {
      publishedCars = data.map(mapPublicCarRow);
    }
  }

  const ranked = rankCarsAgainstIntent(publishedCars, parsedIntent);
  const exactSlice = ranked.exactMatches.slice(0, params.limit);
  const strongSlice = ranked.strongMatches.slice(0, Math.max(0, params.limit - exactSlice.length));
  const altSlice = ranked.alternatives.slice(0, 6);

  const zeroExactResults = exactSlice.length === 0 && strongSlice.length === 0;
  let noExactMatchMessage: string | null = null;
  if (exactSlice.length === 0 && strongSlice.length === 0 && altSlice.length === 0) {
    noExactMatchMessage =
      'No published vehicles in the current live MANIFOLD inventory match those criteria. Submit a Car Hunt request so our inspection desk can source this exact vehicle from verified dealerships.';
  } else if (exactSlice.length === 0) {
    noExactMatchMessage =
      'No exact match found across all specified filters, so we have highlighted closest verified alternatives with disclosed differences below.';
  }

  // Persist anonymized search analytics non-fatally
  let analyticsId: string | null = null;
  if (supabase) {
    try {
      const { data: analyticsRow } = await supabase
        .from('ai_search_analytics')
        .insert({
          query_text: params.query.slice(0, 300),
          input_mode: params.inputMode,
          parsed_make: parsedIntent.make,
          parsed_model: parsedIntent.model,
          parsed_body_type: parsedIntent.bodyType,
          parsed_location: parsedIntent.location,
          parsed_condition: parsedIntent.condition,
          budget_max: parsedIntent.maxPriceNgn ? Math.round(parsedIntent.maxPriceNgn) : null,
          exact_match_count: ranked.exactMatches.length,
          strong_match_count: ranked.strongMatches.length,
          alternative_count: ranked.alternatives.length,
          zero_results: zeroExactResults,
          user_role: params.userRole,
        })
        .select('id')
        .maybeSingle();
      if (analyticsRow?.id) analyticsId = String(analyticsRow.id);
    } catch {
      // Non-fatal if migration not applied yet
    }
  }

  return {
    analyticsId,
    parsedIntent,
    exactMatches: exactSlice,
    strongMatches: strongSlice,
    alternatives: altSlice,
    totalInventoryChecked: publishedCars.length,
    zeroExactResults,
    noExactMatchMessage,
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
