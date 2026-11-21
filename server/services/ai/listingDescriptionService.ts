import { z } from 'zod';
import { runStructuredJsonResponse } from '../../lib/openai';

export const ListingCopyInputSchema = z.object({
  carId: z.string().trim().max(120).optional(),
  make: z.string().trim().min(1, 'Vehicle Make is required.').max(80),
  model: z.string().trim().min(1, 'Vehicle Model is required.').max(80),
  trim: z.string().trim().max(80).optional(),
  year: z.number().int().min(1985).max(2028).optional(),
  bodyType: z.string().trim().max(60).optional(),
  condition: z.string().trim().max(60).optional(),
  mileage: z.number().nonnegative().max(2_000_000).optional(),
  transmission: z.string().trim().max(40).optional(),
  fuelType: z.string().trim().max(40).optional(),
  driveType: z.string().trim().max(40).optional(),
  engine: z.string().trim().max(80).optional(),
  horsepower: z.number().positive().max(3000).optional().nullable(),
  exteriorColor: z.string().trim().max(60).optional(),
  interiorColor: z.string().trim().max(60).optional(),
  seats: z.number().int().min(1).max(20).optional(),
  doors: z.number().int().min(1).max(8).optional(),
  price: z.number().nonnegative().max(10_000_000_000).optional(),
  previousPrice: z.number().nonnegative().max(10_000_000_000).optional().nullable(),
  location: z.string().trim().max(120).optional(),
  state: z.string().trim().max(80).optional(),
  features: z.array(z.string().trim().max(100)).max(25).optional(),
  // Generation & Rewrite Controls
  action: z
    .enum([
      'generate',
      'regenerate',
      'more_persuasive',
      'shorter',
      'more_detailed',
      'improve_grammar',
    ])
    .default('generate'),
  currentDescription: z.string().trim().max(5000).optional(),
  tone: z
    .enum([
      'executive_concierge',
      'trust_transparent',
      'performance_enthusiast',
      'family_practical',
      'value_focused',
    ])
    .default('executive_concierge'),
  targetBuyer: z
    .enum([
      'lagos_abuja_executive',
      'family_buyer',
      'first_time_tokunbo_buyer',
      'corporate_fleet',
      'enthusiast',
    ])
    .default('lagos_abuja_executive'),
  length: z.enum(['concise', 'standard', 'comprehensive']).default('standard'),
  approach: z
    .enum(['facts_and_value', 'story_and_lifestyle', 'inspection_led'])
    .default('inspection_led'),
  sellingAngle: z
    .enum([
      'verified_condition',
      'value_and_pricing',
      'comfort_and_spec',
      'reliability_and_low_running_cost',
    ])
    .default('verified_condition'),
  callToAction: z
    .enum(['book_inspection', 'request_video_walkaround', 'concierge_enquiry'])
    .default('concierge_enquiry'),
  customInstructions: z.string().trim().max(400).optional(),
});

export type ListingCopyInput = z.infer<typeof ListingCopyInputSchema>;

export interface ListingCopyOutput {
  description: string;
  short_summary: string;
  selling_highlights: string[];
  seo_title: string;
  seo_meta_description: string;
  // Always returned factually from vehicle record — NEVER marketing slogans
  preserved_model_title: string;
}

const LISTING_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'description',
    'short_summary',
    'selling_highlights',
    'seo_title',
    'seo_meta_description',
  ],
  properties: {
    description: {
      type: 'string',
      description: 'Well-structured vehicle listing description grounded strictly in provided facts.',
    },
    short_summary: {
      type: 'string',
      description: '1-2 sentence factual buyer summary.',
    },
    selling_highlights: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: { type: 'string' },
      description: 'Exactly 5 concise bullet highlights grounded only in provided fields.',
    },
    seo_title: {
      type: 'string',
      description: 'Clean search engine title <= 65 chars starting with the vehicle model/year.',
    },
    seo_meta_description: {
      type: 'string',
      description: 'Clean SEO meta description 120-160 chars.',
    },
  },
};

export async function generateDealerListingCopy(
  input: ListingCopyInput,
  options?: { modelOverride?: string | null; maxOutputTokens?: number }
) {
  // Capture ONLY real populated vehicle fields; explicitly omit empty fields so OpenAI never guesses
  const knownSpecs: Record<string, unknown> = {
    make: input.make,
    model: input.model,
  };
  if (input.year) knownSpecs.year = input.year;
  if (input.trim) knownSpecs.trim = input.trim;
  if (input.bodyType) knownSpecs.body_type = input.bodyType;
  if (input.condition) knownSpecs.condition = input.condition;
  if (input.mileage !== undefined) knownSpecs.mileage_km = input.mileage;
  if (input.transmission) knownSpecs.transmission = input.transmission;
  if (input.fuelType) knownSpecs.fuel_type = input.fuelType;
  if (input.driveType) knownSpecs.drive_type = input.driveType;
  if (input.engine) knownSpecs.engine = input.engine;
  if (input.horsepower) knownSpecs.horsepower = input.horsepower;
  if (input.exteriorColor) knownSpecs.exterior_color = input.exteriorColor;
  if (input.interiorColor) knownSpecs.interior_color = input.interiorColor;
  if (input.seats) knownSpecs.seats = input.seats;
  if (input.doors) knownSpecs.doors = input.doors;
  if (input.price && input.price > 0) knownSpecs.price_ngn = input.price;
  if (input.previousPrice && input.previousPrice > (input.price || 0)) {
    knownSpecs.previous_price_ngn = input.previousPrice;
  }
  if (input.location) knownSpecs.location = input.location;
  if (input.state) knownSpecs.state = input.state;
  if (input.features && input.features.length > 0) knownSpecs.features = input.features;

  const lengthGuidance =
    input.length === 'concise'
      ? '90–140 words (2 tight paragraphs)'
      : input.length === 'comprehensive'
      ? '210–300 words (3–4 structured paragraphs)'
      : '140–210 words (2–3 clear paragraphs)';

  const actionGuidanceMap: Record<ListingCopyInput['action'], string> = {
    generate: 'Write a fresh listing description from the supplied specifications.',
    regenerate: 'Write a fresh alternative angle while keeping strictly to the supplied specifications.',
    more_persuasive: 'Refine the existing description to emphasize buyer value, confidence, and clarity without fabricating any unverified claims.',
    shorter: 'Condense the existing description into crisp, punchy prose keeping the highest-impact verified specs.',
    more_detailed: 'Expand on the existing description by weaving in every verified specification cleanly without inventing anything missing.',
    improve_grammar: 'Polish grammar, flow, punctuation, and Nigerian-buyer readability while keeping all original facts intact.',
  };

  const instructions = `You are MANIFOLD Listing Intelligence, writing for Nigeria's verified automotive concierge marketplace.

CRITICAL NON-FABRICATION RULES:
1. NEVER invent features, service history, accident-free status, "first body", "buy and drive", duty papers/customs status, warranty, or inspection results unless explicitly provided in the Verified Vehicle Facts or Dealer Notes.
2. ONLY mention attributes present in the supplied payload. If a field is omitted, do NOT guess or mention it.
3. NEVER include dealer phone numbers, WhatsApp numbers, or direct contact bypassing MANIFOLD Concierge.
4. Keep "seo_title" factual (e.g. "${input.year ? `${input.year} ` : ''}${input.make} ${input.model} | MANIFOLD").
5. Generate exactly 5 factual selling_highlights as crisp single-line statements.
6. Tone: ${input.tone}; Target Buyer: ${input.targetBuyer}; Length target: ${lengthGuidance}; Approach: ${input.approach}; Selling Angle: ${input.sellingAngle}; Call to Action: ${input.callToAction}.
7. Action mode: ${actionGuidanceMap[input.action]}`;

  const promptPayload = {
    verifiedVehicleFacts: knownSpecs,
    existingDescription:
      input.action !== 'generate' && input.currentDescription ? input.currentDescription : undefined,
    dealerNotes: input.customInstructions || undefined,
  };

  const result = await runStructuredJsonResponse<{
    description: string;
    short_summary: string;
    selling_highlights: string[];
    seo_title: string;
    seo_meta_description: string;
  }>({
    instructions,
    input: JSON.stringify(promptPayload, null, 2),
    schemaName: 'manifold_dealer_listing_copy',
    schema: LISTING_OUTPUT_SCHEMA,
    modelOverride: options?.modelOverride,
    maxOutputTokens: Math.min(options?.maxOutputTokens ?? 1100, 1400),
    temperature: input.action === 'improve_grammar' || input.action === 'shorter' ? 0.2 : 0.45,
  });

  const preservedModelTitle = [input.year, input.make, input.model, input.trim]
    .filter(Boolean)
    .join(' ');

  return {
    output: {
      description: result.data.description.trim(),
      short_summary: result.data.short_summary.trim(),
      selling_highlights: result.data.selling_highlights.map((h) => h.trim()).slice(0, 5),
      seo_title: result.data.seo_title.trim().slice(0, 75),
      seo_meta_description: result.data.seo_meta_description.trim().slice(0, 175),
      preserved_model_title: preservedModelTitle,
    } satisfies ListingCopyOutput,
    usage: {
      model: result.model,
      responseId: result.responseId,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.totalTokens,
      latencyMs: result.latencyMs,
    },
  };
}
