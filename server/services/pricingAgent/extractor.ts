import { runStructuredJsonResponse, getOpenAiConfigStatus } from '../../lib/openai.js';
import {
  extractVehiclesWithGemini,
  fetchListingPageSafe,
  isGeminiConfigured,
  validateAndCrossCheckObservation,
  type FetchResult,
} from '../marketIntelligenceBackend.js';
import {
  computeDedupeHash,
  extractDomainFromUrl,
  extractSourceListingId,
  normalizeListingUrl,
} from './deduplicator.js';
import { normalizeMarketCategory } from './matcher.js';
import { extractNairaPriceFromText } from './providers.js';
import type {
  ExtractedListingRecord,
  MarketCategory,
  SellerType,
} from './types.js';

export interface ParsedHtmlFixtureResult {
  title: string;
  cleanText: string;
  jsonLdItems: any[];
  imageUrls: string[];
}

export function parseAccessibleListingHtml(rawHtml: string): ParsedHtmlFixtureResult {
  const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const jsonLdItems: any[] = [];
  const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdRegex.exec(rawHtml)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) jsonLdItems.push(...parsed);
      else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed['@graph'])) jsonLdItems.push(...parsed['@graph']);
        else jsonLdItems.push(parsed);
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  }

  const imageUrls: string[] = [];
  const ogImgRegex = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
  let imgMatch;
  while ((imgMatch = ogImgRegex.exec(rawHtml)) !== null) {
    if (imgMatch[1]?.startsWith('http')) imageUrls.push(imgMatch[1].trim());
  }

  const cleanText = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  return { title, cleanText, jsonLdItems, imageUrls: Array.from(new Set(imageUrls)).slice(0, 5) };
}

export function inferSellerType(text: string, domain: string): SellerType {
  const combined = `${domain} ${text}`.toLowerCase();
  if (
    combined.includes('dealership') ||
    combined.includes('motors') ||
    combined.includes('autos') ||
    combined.includes('auto gallery') ||
    combined.includes('certified dealer')
  ) {
    return 'dealer';
  }
  if (
    combined.includes('direct owner') ||
    combined.includes('private seller') ||
    combined.includes('owner selling')
  ) {
    return 'private';
  }
  if (domain) return 'marketplace';
  return 'unknown';
}

function collectJsonLdImageUrls(jsonLdItems?: any[]): string[] {
  if (!Array.isArray(jsonLdItems)) return [];
  const urls: string[] = [];
  for (const item of jsonLdItems) {
    if (!item || typeof item !== 'object') continue;
    if (typeof item.image === 'string' && item.image.startsWith('http')) {
      urls.push(item.image);
    } else if (Array.isArray(item.image)) {
      for (const img of item.image) {
        if (typeof img === 'string' && img.startsWith('http')) urls.push(img);
        else if (img?.url && typeof img.url === 'string' && img.url.startsWith('http')) {
          urls.push(img.url);
        }
      }
    }
  }
  return Array.from(new Set(urls)).slice(0, 5);
}

export function extractFromStructuredJsonLd(
  jsonLdItems: any[],
  sourceUrl: string,
  textEvidence: string,
  title: string
): ExtractedListingRecord[] {
  const results: ExtractedListingRecord[] = [];
  const normUrl = normalizeListingUrl(sourceUrl);
  const domain = extractDomainFromUrl(normUrl) || 'unknown';
  const today = new Date().toISOString().split('T')[0];

  for (const item of jsonLdItems || []) {
    if (!item || typeof item !== 'object') continue;
    const itemType = String(item['@type'] || '').toLowerCase();
    if (
      !itemType.includes('car') &&
      !itemType.includes('vehicle') &&
      !itemType.includes('product') &&
      !itemType.includes('offer')
    ) {
      continue;
    }

    const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers || item;
    const rawPrice = Number(
      String(offer?.price ?? item.price ?? '').replace(/[^0-9.]/g, '')
    );
    const currency = String(offer?.priceCurrency || item.priceCurrency || 'NGN').toUpperCase();

    if (!Number.isFinite(rawPrice) || rawPrice < 300_000 || currency !== 'NGN') {
      continue;
    }

    const name = String(item.name || title || '').trim();
    const make = String(item.brand?.name || item.brand || item.manufacturer || '').trim();
    const model = String(item.model || '').trim();
    const yearMatch = `${item.vehicleModelDate || item.modelDate || ''} ${name}`.match(
      /\b(199\d|20[0-2]\d)\b/
    );
    const modelYear = yearMatch ? parseInt(yearMatch[1], 10) : 0;

    if (!make || !model || !modelYear) continue;

    const rawMileage = item.mileageFromOdometer?.value ?? item.mileageFromOdometer;
    const mileage =
      rawMileage !== undefined && rawMileage !== null && !isNaN(Number(rawMileage)) && Number(rawMileage) > 0
        ? Math.round(Number(rawMileage))
        : null;

    const combinedText = `${name} ${item.description || ''} ${textEvidence}`;
    let marketCategory = normalizeMarketCategory(
      `${item.itemCondition || ''} ${combinedText}`
    );
    if (marketCategory === 'unknown' && item.itemCondition?.includes('NewCondition')) {
      marketCategory = 'brand_new';
    }

    const conditionLabel: ExtractedListingRecord['condition'] =
      marketCategory === 'foreign_used'
        ? 'Foreign Used'
        : marketCategory === 'nigerian_used'
        ? 'Nigerian Used'
        : marketCategory === 'brand_new'
        ? 'Brand New'
        : 'Unknown';

    const location =
      String(
        offer?.areaServed?.name ||
          item.location?.name ||
          item.contentLocation?.name ||
          ''
      ).trim() || null;

    const missingFields: string[] = [];
    if (mileage === null) missingFields.push('mileage');
    if (!location) missingFields.push('location');
    if (!item.vehicleConfiguration && !item.trim) missingFields.push('trim');

    const imageUrls = collectJsonLdImageUrls([item]);
    const sourceListingId = extractSourceListingId(sourceUrl, [item]);
    const dedupeHash = computeDedupeHash({
      normalizedUrl: normUrl,
      sourceListingId,
      make,
      model,
      year: modelYear,
      marketCategory,
      price: Math.round(rawPrice),
      mileage,
      location,
      description: item.description || name,
      imageUrls,
    });

    results.push({
      sourceWebsite: domain,
      sourceUrl,
      normalizedUrl: normUrl,
      sourceListingId,
      make,
      model,
      variant: item.vehicleEngine?.name || null,
      trim: item.vehicleConfiguration || item.trim || null,
      generation: null,
      modelYear,
      askingPrice: Math.round(rawPrice),
      currency: 'NGN',
      mileage,
      mileageUnit: 'km',
      condition: conditionLabel,
      marketCategory,
      transmission: item.vehicleTransmission || null,
      fuelType: item.fuelType || null,
      bodyType: item.bodyType || null,
      drivetrain: item.driveWheelConfiguration || null,
      engine: item.vehicleEngine?.engineDisplacement || null,
      location,
      sellerType: inferSellerType(combinedText, domain),
      listingDate: typeof offer?.validFrom === 'string' ? offer.validFrom.slice(0, 10) : null,
      observationDate: today,
      description: String(item.description || name).slice(0, 600),
      imageUrls,
      supportingEvidence: [`JSON-LD: ${name} — NGN ${Math.round(rawPrice).toLocaleString()}`],
      missingFields,
      uncertaintyReasons: [],
      extractionConfidence: missingFields.length === 0 ? 0.94 : 0.85,
      extractionMethod: 'json_ld_structured',
      qualityStatus: 'valid',
      rejectionReason: null,
      dedupeHash,
    });
  }

  return results;
}

const OPENAI_LISTING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['vehicles'],
  properties: {
    vehicles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'make',
          'model',
          'model_year',
          'advertised_price',
          'currency',
          'condition',
          'supporting_evidence',
          'confidence_score',
        ],
        properties: {
          make: { type: 'string' },
          model: { type: 'string' },
          model_year: { type: 'integer' },
          trim: { type: ['string', 'null'] },
          variant: { type: ['string', 'null'] },
          body_type: { type: ['string', 'null'] },
          advertised_price: { type: 'number' },
          currency: { type: 'string' },
          mileage: { type: ['integer', 'null'] },
          condition: {
            type: 'string',
            enum: ['Foreign Used', 'Nigerian Used', 'Brand New', 'Unknown'],
          },
          transmission: { type: ['string', 'null'] },
          fuel_type: { type: ['string', 'null'] },
          location: { type: ['string', 'null'] },
          supporting_evidence: { type: 'array', items: { type: 'string' } },
          confidence_score: { type: 'number' },
        },
      },
    },
  },
};

export async function extractListingDetails(params: {
  url: string;
  titleHint?: string;
  snippetHint?: string;
  preFetchedResult?: FetchResult;
  expectedMake?: string;
  expectedModel?: string;
  expectedCategory?: MarketCategory;
}): Promise<{
  fetchStatus: FetchResult['status'];
  httpStatus?: number;
  observations: ExtractedListingRecord[];
  error?: string;
}> {
  const fetchResult =
    params.preFetchedResult ?? (await fetchListingPageSafe(params.url));

  // Strictly respect anti-bot / protection blocks & SSRF policy: never bypass or fabricate
  if (!fetchResult.success) {
    return {
      fetchStatus: fetchResult.status,
      httpStatus: fetchResult.httpStatus,
      observations: [],
      error: fetchResult.error,
    };
  }

  const finalUrl = fetchResult.finalUrl || params.url;
  const normUrl = normalizeListingUrl(finalUrl);
  const domain = extractDomainFromUrl(normUrl) || 'unknown';
  const title = fetchResult.title || params.titleHint || '';
  const textBody = [title, fetchResult.metaDescription, fetchResult.extractedText]
    .filter(Boolean)
    .join('\n')
    .trim();

  // 1. Deterministic JSON-LD extraction first (no LLM cost, highest precision)
  const jsonLdRecords = extractFromStructuredJsonLd(
    fetchResult.jsonLdItems || [],
    finalUrl,
    textBody,
    title
  );
  if (jsonLdRecords.length > 0) {
    return {
      fetchStatus: fetchResult.status,
      httpStatus: fetchResult.httpStatus,
      observations: jsonLdRecords,
    };
  }

  // 2. Existing Gemini Market Intelligence extraction pipeline
  let rawValidatedList: ReturnType<typeof validateAndCrossCheckObservation>[] = [];
  let methodUsed = 'gemini-2.5-flash';

  if (isGeminiConfigured()) {
    const gemRes = await extractVehiclesWithGemini(
      textBody,
      finalUrl,
      title,
      fetchResult.jsonLdItems
    );
    if (gemRes.success && gemRes.observations.length > 0) {
      rawValidatedList = gemRes.observations.map((obs) => ({
        valid: true,
        observation: obs,
        validationErrors: [],
      }));
      methodUsed = gemRes.method;
    }
  } else if (getOpenAiConfigStatus().apiKeyConfigured && getOpenAiConfigStatus().modelConfigured) {
    // Secondary LLM normalization via OpenAI only if Gemini is unconfigured
    try {
      const oaRes = await runStructuredJsonResponse<{ vehicles: any[] }>({
        instructions: `Extract factual Nigerian automotive asking-price observations from the webpage text.
Never invent prices, mileage, model years, or locations. Only return NGN prices corroborated in the text.`,
        input: JSON.stringify({ title, url: finalUrl, text: textBody.slice(0, 12000) }),
        schemaName: 'pricing_agent_listing_extract',
        schema: OPENAI_LISTING_SCHEMA,
        maxOutputTokens: 900,
      });

      methodUsed = oaRes.model;
      for (const item of oaRes.data?.vehicles || []) {
        rawValidatedList.push(
          validateAndCrossCheckObservation(item, textBody, finalUrl, title)
        );
      }
    } catch {
      // Handled below
    }
  } else {
    // Strictly deterministic snippet/title extraction when no LLM key is present (never guesses!)
    const detectedPrice = extractNairaPriceFromText(textBody);
    const yearMatch = `${title} ${textBody.slice(0, 400)}`.match(/\b(199\d|20[0-2]\d)\b/);
    if (detectedPrice && yearMatch && params.expectedMake && params.expectedModel) {
      const hasMake = textBody.toLowerCase().includes(params.expectedMake.toLowerCase());
      const hasModel = textBody.toLowerCase().includes(params.expectedModel.toLowerCase());
      if (hasMake && hasModel) {
        const inferredCat = normalizeMarketCategory(textBody);
        const condLabel =
          inferredCat === 'foreign_used'
            ? 'Foreign Used'
            : inferredCat === 'nigerian_used'
            ? 'Nigerian Used'
            : inferredCat === 'brand_new'
            ? 'Brand New'
            : 'Unknown';

        rawValidatedList.push(
          validateAndCrossCheckObservation(
            {
              make: params.expectedMake,
              model: params.expectedModel,
              model_year: parseInt(yearMatch[1], 10),
              advertised_price: detectedPrice,
              currency: 'NGN',
              condition: condLabel,
              supporting_evidence: [`${title} — ₦${detectedPrice.toLocaleString()}`.trim()],
              confidence_score: 0.72,
            },
            textBody,
            finalUrl,
            title
          )
        );
        methodUsed = 'deterministic_parser';
      }
    }
  }

  const imageUrls = collectJsonLdImageUrls(fetchResult.jsonLdItems);
  const observations: ExtractedListingRecord[] = [];

  for (const check of rawValidatedList) {
    if (!check.valid || !check.observation) continue;
    const obs = check.observation;

    // Require NGN currency and sane Naira vehicle range to avoid USD distortion without verified FX
    if (obs.currency !== 'NGN' || obs.advertised_price < 300_000 || obs.model_year === 0) {
      observations.push({
        sourceWebsite: domain,
        sourceUrl: finalUrl,
        normalizedUrl: normUrl,
        sourceListingId: extractSourceListingId(finalUrl, fetchResult.jsonLdItems),
        make: obs.make,
        model: obs.model,
        variant: obs.variant ?? null,
        trim: obs.trim ?? null,
        generation: obs.generation ?? null,
        modelYear: obs.model_year,
        askingPrice: obs.advertised_price,
        currency: obs.currency,
        mileage: obs.mileage ?? null,
        mileageUnit: obs.mileage_unit || 'km',
        condition: obs.condition,
        marketCategory: normalizeMarketCategory(obs.condition),
        transmission: obs.transmission ?? null,
        fuelType: obs.fuel_type ?? null,
        bodyType: obs.body_type ?? null,
        drivetrain: obs.drivetrain ?? null,
        engine: obs.engine ?? null,
        location: obs.location ?? null,
        sellerType: inferSellerType(textBody, domain),
        listingDate: obs.observation_date ?? null,
        observationDate: obs.observation_date || new Date().toISOString().split('T')[0],
        description: textBody.slice(0, 600),
        imageUrls,
        supportingEvidence: obs.supporting_evidence,
        missingFields: obs.missing_fields,
        uncertaintyReasons: obs.uncertainty_reasons,
        extractionConfidence: obs.confidence_score,
        extractionMethod: methodUsed,
        qualityStatus: 'rejected',
        rejectionReason:
          obs.currency !== 'NGN'
            ? `Non-NGN currency (${obs.currency}) excluded from direct Naira computation.`
            : obs.model_year === 0
            ? 'Missing model year.'
            : 'Asking price below valid Nigerian vehicle minimum threshold.',
        dedupeHash: computeDedupeHash({
          normalizedUrl: normUrl,
          make: obs.make,
          model: obs.model,
          year: obs.model_year,
          marketCategory: normalizeMarketCategory(obs.condition),
          price: obs.advertised_price,
          mileage: obs.mileage,
          location: obs.location,
        }),
      });
      continue;
    }

    const marketCategory = normalizeMarketCategory(
      `${obs.condition} ${obs.import_status || ''} ${textBody.slice(0, 600)}`
    );
    const sourceListingId = extractSourceListingId(finalUrl, fetchResult.jsonLdItems);
    const dedupeHash = computeDedupeHash({
      normalizedUrl: normUrl,
      sourceListingId,
      make: obs.make,
      model: obs.model,
      year: obs.model_year,
      marketCategory,
      price: obs.advertised_price,
      mileage: obs.mileage,
      location: obs.location,
      description: textBody.slice(0, 600),
      imageUrls,
    });

    observations.push({
      sourceWebsite: domain,
      sourceUrl: finalUrl,
      normalizedUrl: normUrl,
      sourceListingId,
      make: obs.make,
      model: obs.model,
      variant: obs.variant ?? null,
      trim: obs.trim ?? null,
      generation: obs.generation ?? null,
      modelYear: obs.model_year,
      askingPrice: obs.advertised_price,
      currency: 'NGN',
      mileage: obs.mileage ?? null,
      mileageUnit: obs.mileage_unit || 'km',
      condition:
        marketCategory === 'foreign_used'
          ? 'Foreign Used'
          : marketCategory === 'nigerian_used'
          ? 'Nigerian Used'
          : marketCategory === 'brand_new'
          ? 'Brand New'
          : obs.condition,
      marketCategory,
      transmission: obs.transmission ?? null,
      fuelType: obs.fuel_type ?? null,
      bodyType: obs.body_type ?? null,
      drivetrain: obs.drivetrain ?? null,
      engine: obs.engine ?? null,
      location: obs.location ?? null,
      sellerType: inferSellerType(textBody, domain),
      listingDate: obs.observation_date ?? null,
      observationDate: obs.observation_date || new Date().toISOString().split('T')[0],
      description: textBody.slice(0, 600),
      imageUrls,
      supportingEvidence: obs.supporting_evidence,
      missingFields: obs.missing_fields,
      uncertaintyReasons: obs.uncertainty_reasons,
      extractionConfidence: obs.confidence_score,
      extractionMethod: methodUsed,
      qualityStatus: obs.review_status === 'rejected' ? 'rejected' : 'valid',
      rejectionReason:
        obs.review_status === 'rejected' ? obs.uncertainty_reasons.join('; ') : null,
      dedupeHash,
    });
  }

  return {
    fetchStatus: fetchResult.status,
    httpStatus: fetchResult.httpStatus,
    observations,
  };
}
