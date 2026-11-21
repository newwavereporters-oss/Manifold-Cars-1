import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { z } from 'zod';
import {
  AuthenticatedRequest,
  optionalAuth,
  requireAdmin,
  requireApprovedDealer,
  requireAuth,
} from '../middleware/auth.js';
import {
  aiAssistantLimiter,
  aiHealthLimiter,
  aiPricingLimiter,
  aiSearchLimiter,
  aiVoiceLimiter,
  dealerListingAiLimiter,
  standardApiLimiter,
} from '../middleware/rateLimit.js';
import {
  getOpenAiConfigStatus,
  runTextResponse,
  sanitizeOpenAiError,
} from '../lib/openai.js';
import { sendMigrationSqlFile } from '../lib/migrationSql.js';
import { getSupabaseClient } from '../lib/supabaseServer.js';
import {
  checkAiDatabaseStatus,
  getAdminAiOverview,
  getModuleSetting,
  recordAiUsage,
  updateModuleSetting,
  type AiFeatureModuleKey,
} from '../services/ai/aiUsageService.js';
import {
  generateDealerListingCopy,
  ListingCopyInputSchema,
} from '../services/ai/listingDescriptionService.js';
import {
  runVehicleIntelligenceSearch,
  VehicleSearchRequestSchema,
} from '../services/ai/vehicleSearchService.js';
import {
  MAX_VOICE_AUDIO_BYTES,
  processVoiceSearchAudio,
} from '../services/ai/transcriptionService.js';
import {
  PriceIntelligenceRequestSchema,
  runVehiclePriceIntelligence,
} from '../services/ai/vehiclePricingService.js';
import { generateMarketIntelligenceInsights } from '../services/ai/marketIntelligenceService.js';
import {
  AssistantChatRequestSchema,
  runAutomotiveAssistant,
} from '../services/ai/automotiveAssistantService.js';

export const aiRouter = Router();

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_VOICE_AUDIO_BYTES,
    files: 1,
  },
});

function makeRequestId(): string {
  return `ai_${crypto.randomUUID().slice(0, 12)}`;
}

// ==============================================================================
// 1. ADMIN HEALTH, TEST, DB STATUS & MIGRATION SQL
// ==============================================================================

aiRouter.get(
  '/health',
  requireAdmin,
  aiHealthLimiter,
  async (_req: AuthenticatedRequest, res: Response) => {
    const config = getOpenAiConfigStatus();
    res.json({
      provider: 'openai',
      ...config,
      ready: config.apiKeyConfigured && config.modelConfigured,
      rateLimiterScope: 'per-instance-memory',
      timestamp: new Date().toISOString(),
    });
  }
);

aiRouter.post(
  '/test',
  requireAdmin,
  aiHealthLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = makeRequestId();
    const started = Date.now();
    const setting = await getModuleSetting('health_test', req.auth?.supabase);
    const bodyModel =
      typeof req.body?.modelOverride === 'string' && req.body.modelOverride.trim()
        ? req.body.modelOverride.trim()
        : setting.model_override;

    try {
      const result = await runTextResponse({
        instructions: 'Reply with exactly: MANIFOLD_OPENAI_OK',
        input: 'Confirm live API connectivity.',
        modelOverride: bodyModel,
        maxOutputTokens: 32,
        temperature: 0,
        timeoutMs: 15_000,
      });

      await recordAiUsage(
        {
          request_id: requestId,
          user_id: req.auth?.user?.id,
          user_role: 'admin',
          feature_module: 'health_test',
          model: result.model,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          total_tokens: result.totalTokens,
          latency_ms: result.latencyMs,
          success: true,
        },
        req.auth?.supabase
      );

      res.json({
        connected: true,
        requestId,
        model: result.model,
        responseId: result.responseId,
        output: result.text,
        latencyMs: result.latencyMs,
        usage: {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          totalTokens: result.totalTokens,
        },
      });
    } catch (err) {
      const safe = sanitizeOpenAiError(err);
      const latencyMs = Date.now() - started;

      await recordAiUsage(
        {
          request_id: requestId,
          user_id: req.auth?.user?.id,
          user_role: 'admin',
          feature_module: 'health_test',
          model: bodyModel || getOpenAiConfigStatus().configuredModel || 'unconfigured',
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          latency_ms: latencyMs,
          success: false,
          error_code: safe.code,
          error_message: safe.message,
        },
        req.auth?.supabase
      );

      res.status(safe.status).json({
        connected: false,
        requestId,
        error: safe.message,
        code: safe.code,
        latencyMs,
      });
    }
  }
);

aiRouter.get('/migration-sql', (_req: Request, res: Response) => {
  sendMigrationSqlFile(
    'ai-platform-migration.sql',
    '-- Migration SQL file not found on server.',
    res
  );
});

aiRouter.get(
  '/db-status',
  requireAdmin,
  standardApiLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.auth?.supabase) {
      res.status(503).json({ error: 'Supabase not configured.' });
      return;
    }
    const status = await checkAiDatabaseStatus(req.auth.supabase);
    res.json(status);
  }
);

// ==============================================================================
// 2. ADMIN AI CONTROL CENTRE OVERVIEW & MODULE GOVERNANCE
// ==============================================================================

aiRouter.get(
  '/admin/overview',
  requireAdmin,
  standardApiLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.auth?.supabase) {
      res.status(503).json({ error: 'Supabase client unavailable.' });
      return;
    }
    try {
      const [overview, configStatus] = await Promise.all([
        getAdminAiOverview(req.auth.supabase),
        Promise.resolve(getOpenAiConfigStatus()),
      ]);
      res.json({
        config: configStatus,
        ...overview,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Unable to load AI overview metrics.' });
    }
  }
);

const UpdateAiSettingSchema = z.object({
  moduleKey: z.enum([
    'listing_copy',
    'vehicle_search',
    'voice_transcribe',
    'price_intelligence',
    'market_insights',
    'assistant',
  ]),
  enabled: z.boolean().optional(),
  modelOverride: z.string().trim().max(80).nullable().optional(),
  maxRequestsPerMin: z.number().int().min(1).max(300).optional(),
  maxOutputTokens: z.number().int().min(128).max(2000).optional(),
  monthlyBudgetUsd: z.number().min(0).max(100_000).optional(),
});

aiRouter.patch(
  '/admin/settings',
  requireAdmin,
  standardApiLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = UpdateAiSettingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid settings payload.' });
      return;
    }

    if (!req.auth?.supabase || !req.auth.user) {
      res.status(503).json({ error: 'Authentication context missing.' });
      return;
    }

    const result = await updateModuleSetting({
      supabase: req.auth.supabase,
      adminUserId: req.auth.user.id,
      moduleKey: parsed.data.moduleKey as AiFeatureModuleKey,
      enabled: parsed.data.enabled,
      modelOverride: parsed.data.modelOverride,
      maxRequestsPerMin: parsed.data.maxRequestsPerMin,
      maxOutputTokens: parsed.data.maxOutputTokens,
      monthlyBudgetUsd: parsed.data.monthlyBudgetUsd,
    });

    res.json(result);
  }
);

// ==============================================================================
// 3. DEALER LISTING INTELLIGENCE (Approved Dealers Only + Ownership Check)
// ==============================================================================

aiRouter.post(
  '/dealer/listing-copy',
  requireApprovedDealer,
  dealerListingAiLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = makeRequestId();
    const started = Date.now();
    const setting = await getModuleSetting('listing_copy', req.auth?.supabase);

    if (!setting.enabled) {
      res.status(503).json({
        error: 'Dealer Listing Intelligence has been temporarily disabled by MANIFOLD Admin.',
        code: 'MODULE_DISABLED',
      });
      return;
    }

    const parsed = ListingCopyInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid listing payload.' });
      return;
    }

    // Ownership verification when editing an existing listing
    if (parsed.data.carId && req.auth?.supabase && req.auth.dealerId) {
      const { data: carRow } = await req.auth.supabase
        .from('cars')
        .select('id, dealer_id')
        .eq('id', parsed.data.carId)
        .maybeSingle();

      if (!carRow || String(carRow.dealer_id) !== String(req.auth.dealerId)) {
        res.status(403).json({
          error: 'You can only generate listing copy for vehicles owned by your dealership.',
          code: 'OWNERSHIP_DENIED',
        });
        return;
      }
    }

    try {
      const result = await generateDealerListingCopy(parsed.data, {
        modelOverride: setting.model_override,
        maxOutputTokens: setting.max_output_tokens,
      });

      await recordAiUsage(
        {
          request_id: requestId,
          user_id: req.auth?.user?.id,
          user_role: 'dealer',
          dealer_id: req.auth?.dealerId,
          feature_module: 'listing_copy',
          model: result.usage.model,
          input_tokens: result.usage.inputTokens,
          output_tokens: result.usage.outputTokens,
          total_tokens: result.usage.totalTokens,
          latency_ms: result.usage.latencyMs,
          success: true,
          metadata: { action: parsed.data.action, make: parsed.data.make, model: parsed.data.model },
        },
        req.auth?.supabase
      );

      res.json({
        requestId,
        ...result.output,
        usage: result.usage,
      });
    } catch (err) {
      const safe = sanitizeOpenAiError(err);
      await recordAiUsage(
        {
          request_id: requestId,
          user_id: req.auth?.user?.id,
          user_role: 'dealer',
          dealer_id: req.auth?.dealerId,
          feature_module: 'listing_copy',
          model: setting.model_override || getOpenAiConfigStatus().configuredModel || 'unconfigured',
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          latency_ms: Date.now() - started,
          success: false,
          error_code: safe.code,
          error_message: safe.message,
        },
        req.auth?.supabase
      );
      res.status(safe.status).json({ error: safe.message, code: safe.code, requestId });
    }
  }
);

// ==============================================================================
// 4. VEHICLE INTELLIGENCE SEARCH & VOICE TRANSCRIPTION (Public + Authenticated)
// ==============================================================================

aiRouter.post(
  '/search',
  optionalAuth,
  aiSearchLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = makeRequestId();
    const started = Date.now();
    const setting = await getModuleSetting('vehicle_search', req.auth?.supabase);

    if (!setting.enabled) {
      res.status(503).json({
        error: 'Vehicle Intelligence Search is temporarily disabled by Admin.',
        code: 'MODULE_DISABLED',
      });
      return;
    }

    const parsed = VehicleSearchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid search query.' });
      return;
    }

    try {
      const result = await runVehicleIntelligenceSearch({
        query: parsed.data.query,
        inputMode: parsed.data.inputMode,
        limit: parsed.data.limit,
        userRole: req.auth?.role || 'anonymous',
        supabase: req.auth?.supabase,
        modelOverride: setting.model_override,
        maxOutputTokens: setting.max_output_tokens,
      });

      await recordAiUsage(
        {
          request_id: requestId,
          user_id: req.auth?.user?.id || null,
          user_role: req.auth?.role || 'anonymous',
          dealer_id: req.auth?.dealerId || null,
          feature_module: 'vehicle_search',
          model: result.usage.model,
          input_tokens: result.usage.inputTokens,
          output_tokens: result.usage.outputTokens,
          total_tokens: result.usage.totalTokens,
          latency_ms: result.usage.latencyMs,
          success: true,
          metadata: {
            inputMode: parsed.data.inputMode,
            exactCount: result.exactMatches.length,
            zeroExactResults: result.zeroExactResults,
          },
        },
        req.auth?.supabase
      );

      res.json({
        requestId,
        ...result,
      });
    } catch (err) {
      const safe = sanitizeOpenAiError(err);
      await recordAiUsage(
        {
          request_id: requestId,
          user_id: req.auth?.user?.id || null,
          user_role: req.auth?.role || 'anonymous',
          feature_module: 'vehicle_search',
          model: setting.model_override || getOpenAiConfigStatus().configuredModel || 'unconfigured',
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          latency_ms: Date.now() - started,
          success: false,
          error_code: safe.code,
          error_message: safe.message,
        },
        req.auth?.supabase
      );
      res.status(safe.status).json({ error: safe.message, code: safe.code, requestId });
    }
  }
);

const SearchEventSchema = z.object({
  analyticsId: z.string().uuid(),
  clickedCarId: z.string().trim().max(120).optional(),
  enquiryConverted: z.boolean().optional(),
});

aiRouter.post(
  '/search/event',
  standardApiLimiter,
  async (req: Request, res: Response) => {
    const parsed = SearchEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid search event payload.' });
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      res.json({ updated: false });
      return;
    }

    try {
      const updates: Record<string, unknown> = {};
      if (parsed.data.clickedCarId) updates.clicked_car_id = parsed.data.clickedCarId;
      if (parsed.data.enquiryConverted !== undefined) {
        updates.enquiry_converted = parsed.data.enquiryConverted;
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('ai_search_analytics').update(updates).eq('id', parsed.data.analyticsId);
      }
      res.json({ updated: true });
    } catch {
      res.json({ updated: false });
    }
  }
);

aiRouter.post(
  '/transcribe',
  optionalAuth,
  aiVoiceLimiter,
  (req: Request, res: Response, next) => {
    uploadAudio.single('audio')(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({
            error: 'Audio clip exceeds the 4 MB limit. Keep voice queries under 60 seconds.',
            code: 'AUDIO_TOO_LARGE',
          });
          return;
        }
        res.status(400).json({ error: 'Unable to read uploaded audio file.' });
        return;
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = makeRequestId();
    const started = Date.now();
    const setting = await getModuleSetting('voice_transcribe', req.auth?.supabase);

    if (!setting.enabled) {
      res.status(503).json({
        error: 'Voice Search transcription has been temporarily disabled by Admin.',
        code: 'MODULE_DISABLED',
      });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file || !file.buffer) {
      res.status(400).json({
        error: 'No audio file received. Record a voice query via your microphone and try again.',
        code: 'MISSING_AUDIO',
      });
      return;
    }

    try {
      const result = await processVoiceSearchAudio({
        buffer: file.buffer,
        originalName: file.originalname || 'voice-search.webm',
        mimeType: file.mimetype || 'audio/webm',
        modelOverride: setting.model_override,
      });

      // Audio buffer is never persisted to disk or database; GC cleans it after response.
      await recordAiUsage(
        {
          request_id: requestId,
          user_id: req.auth?.user?.id || null,
          user_role: req.auth?.role || 'anonymous',
          dealer_id: req.auth?.dealerId || null,
          feature_module: 'voice_transcribe',
          model: result.model,
          input_tokens: 120,
          output_tokens: Math.max(10, Math.ceil(result.transcript.length / 4)),
          total_tokens: 120 + Math.max(10, Math.ceil(result.transcript.length / 4)),
          latency_ms: result.latencyMs,
          success: true,
          metadata: { audioBytes: result.estimatedAudioBytes },
        },
        req.auth?.supabase
      );

      res.json({
        requestId,
        transcript: result.transcript,
        model: result.model,
        latencyMs: result.latencyMs,
      });
    } catch (err) {
      const safe = sanitizeOpenAiError(err);
      await recordAiUsage(
        {
          request_id: requestId,
          user_id: req.auth?.user?.id || null,
          user_role: req.auth?.role || 'anonymous',
          feature_module: 'voice_transcribe',
          model: setting.model_override || getOpenAiConfigStatus().transcriptionModel || 'unconfigured',
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          latency_ms: Date.now() - started,
          success: false,
          error_code: safe.code,
          error_message: safe.message,
        },
        req.auth?.supabase
      );
      res.status(safe.status).json({ error: safe.message, code: safe.code, requestId });
    }
  }
);

// ==============================================================================
// 5. PRICE INTELLIGENCE (Published buyers, approved dealers, admins)
// ==============================================================================

aiRouter.post(
  '/price-intelligence',
  optionalAuth,
  aiPricingLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = makeRequestId();
    const started = Date.now();
    const setting = await getModuleSetting('price_intelligence', req.auth?.supabase);

    const parsed = PriceIntelligenceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid price request.' });
      return;
    }

    const wantAiCommentary = parsed.data.includeAiCommentary && setting.enabled;

    try {
      const result = await runVehiclePriceIntelligence({
        input: { ...parsed.data, includeAiCommentary: wantAiCommentary },
        role: req.auth?.role || 'anonymous',
        supabase: req.auth?.supabase,
        modelOverride: setting.model_override,
        maxOutputTokens: setting.max_output_tokens,
      });

      if (result.usage) {
        await recordAiUsage(
          {
            request_id: requestId,
            user_id: req.auth?.user?.id || null,
            user_role: req.auth?.role || 'anonymous',
            dealer_id: req.auth?.dealerId || null,
            feature_module: 'price_intelligence',
            model: result.usage.model,
            input_tokens: result.usage.inputTokens,
            output_tokens: result.usage.outputTokens,
            total_tokens: result.usage.totalTokens,
            latency_ms: result.usage.latencyMs,
            success: true,
            metadata: {
              make: parsed.data.make,
              model: parsed.data.model,
              sampleCount: result.stats.sampleCount,
            },
          },
          req.auth?.supabase
        );
      }

      res.json({
        requestId,
        aiCommentaryEnabled: setting.enabled,
        ...result,
      });
    } catch (err) {
      const safe = sanitizeOpenAiError(err);
      await recordAiUsage(
        {
          request_id: requestId,
          user_id: req.auth?.user?.id || null,
          user_role: req.auth?.role || 'anonymous',
          feature_module: 'price_intelligence',
          model: setting.model_override || getOpenAiConfigStatus().configuredModel || 'unconfigured',
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          latency_ms: Date.now() - started,
          success: false,
          error_code: safe.code,
          error_message: safe.message,
        },
        req.auth?.supabase
      );

      // Even if OpenAI commentary fails/unconfigured, still return deterministic stats when available
      try {
        const deterministicOnly = await runVehiclePriceIntelligence({
          input: { ...parsed.data, includeAiCommentary: false },
          role: req.auth?.role || 'anonymous',
          supabase: req.auth?.supabase,
        });
        res.json({
          requestId,
          aiCommentaryEnabled: false,
          aiWarning: safe.message,
          ...deterministicOnly,
        });
      } catch {
        res.status(safe.status).json({ error: safe.message, code: safe.code, requestId });
      }
    }
  }
);

// ==============================================================================
// 6. MARKET INTELLIGENCE SYNTHESIS (Strictly Admin OR Approved Dealer)
// ==============================================================================

const MarketInsightsBodySchema = z.object({
  includeAiSummary: z.boolean().default(true),
  focusTopic: z.string().trim().max(240).optional(),
});

aiRouter.post(
  '/market-insights',
  requireAuth,
  standardApiLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.auth?.user || !req.auth.supabase) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    // Determine authoritative server role (Admin OR Approved Dealer)
    const { verifyActiveAdmin, verifyDealerAccount } = await import('../lib/supabaseServer.js');
    const adminCheck = await verifyActiveAdmin(req.auth.supabase, req.auth.user);
    let authorizedRole: 'admin' | 'dealer' | null = adminCheck.isAdmin ? 'admin' : null;
    let dealerId: string | undefined;
    let dealerBusinessName: string | undefined;

    if (!authorizedRole) {
      const dealerCheck = await verifyDealerAccount(req.auth.supabase, req.auth.user);
      if (dealerCheck.hasAccount && dealerCheck.isApproved && dealerCheck.dealerId) {
        authorizedRole = 'dealer';
        dealerId = dealerCheck.dealerId;
        dealerBusinessName = dealerCheck.businessName;
      }
    }

    if (!authorizedRole) {
      res.status(403).json({
        error: 'Market Intelligence analytics require an active Admin or Approved Dealer account.',
        code: 'ROLE_FORBIDDEN',
      });
      return;
    }

    const parsed = MarketInsightsBodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid market insights request.' });
      return;
    }

    const requestId = makeRequestId();
    const started = Date.now();
    const setting = await getModuleSetting('market_insights', req.auth.supabase);

    if (parsed.data.includeAiSummary && !setting.enabled) {
      res.status(503).json({
        error: 'AI Market Intelligence Synthesis has been disabled by Admin.',
        code: 'MODULE_DISABLED',
      });
      return;
    }

    try {
      const result = await generateMarketIntelligenceInsights({
        role: authorizedRole,
        dealerId,
        dealerBusinessName,
        includeAiSummary: parsed.data.includeAiSummary,
        focusTopic: parsed.data.focusTopic,
        supabase: req.auth.supabase,
        modelOverride: setting.model_override,
        maxOutputTokens: setting.max_output_tokens,
      });

      if (result.usage) {
        await recordAiUsage(
          {
            request_id: requestId,
            user_id: req.auth.user.id,
            user_role: authorizedRole,
            dealer_id: dealerId || null,
            feature_module: 'market_insights',
            model: result.usage.model,
            input_tokens: result.usage.inputTokens,
            output_tokens: result.usage.outputTokens,
            total_tokens: result.usage.totalTokens,
            latency_ms: result.usage.latencyMs,
            success: true,
          },
          req.auth.supabase
        );
      }

      res.json({
        requestId,
        roleScope: authorizedRole,
        ...result,
      });
    } catch (err) {
      const safe = sanitizeOpenAiError(err);
      await recordAiUsage(
        {
          request_id: requestId,
          user_id: req.auth.user.id,
          user_role: authorizedRole,
          dealer_id: dealerId || null,
          feature_module: 'market_insights',
          model: setting.model_override || getOpenAiConfigStatus().configuredModel || 'unconfigured',
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          latency_ms: Date.now() - started,
          success: false,
          error_code: safe.code,
          error_message: safe.message,
        },
        req.auth.supabase
      );
      res.status(safe.status).json({ error: safe.message, code: safe.code, requestId });
    }
  }
);

// ==============================================================================
// 7. GROUNDED AI AUTOMOTIVE ASSISTANT (Buyers & Dealers with Role Isolation)
// ==============================================================================

aiRouter.post(
  '/assistant',
  optionalAuth,
  aiAssistantLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = makeRequestId();
    const started = Date.now();
    const setting = await getModuleSetting('assistant', req.auth?.supabase);

    if (!setting.enabled) {
      res.status(503).json({
        error: 'MANIFOLD AI Automotive Assistant is temporarily unavailable.',
        code: 'MODULE_DISABLED',
      });
      return;
    }

    const parsed = AssistantChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid assistant message.' });
      return;
    }

    try {
      const result = await runAutomotiveAssistant({
        messages: parsed.data.messages,
        focusedCarSlug: parsed.data.focusedCarSlug,
        surface: parsed.data.surface,
        role: req.auth?.role || 'anonymous',
        dealerId: req.auth?.dealerId,
        dealerBusinessName: req.auth?.dealerBusinessName,
        supabase: req.auth?.supabase,
        modelOverride: setting.model_override,
        maxOutputTokens: setting.max_output_tokens,
      });

      await recordAiUsage(
        {
          request_id: requestId,
          user_id: req.auth?.user?.id || null,
          user_role: req.auth?.role || 'anonymous',
          dealer_id: req.auth?.dealerId || null,
          feature_module: 'assistant',
          model: result.usage.model,
          input_tokens: result.usage.inputTokens,
          output_tokens: result.usage.outputTokens,
          total_tokens: result.usage.totalTokens,
          latency_ms: result.usage.latencyMs,
          success: true,
          metadata: { surface: parsed.data.surface },
        },
        req.auth?.supabase
      );

      res.json({
        requestId,
        ...result,
      });
    } catch (err) {
      const safe = sanitizeOpenAiError(err);
      await recordAiUsage(
        {
          request_id: requestId,
          user_id: req.auth?.user?.id || null,
          user_role: req.auth?.role || 'anonymous',
          feature_module: 'assistant',
          model: setting.model_override || getOpenAiConfigStatus().configuredModel || 'unconfigured',
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          latency_ms: Date.now() - started,
          success: false,
          error_code: safe.code,
          error_message: safe.message,
        },
        req.auth?.supabase
      );
      res.status(safe.status).json({ error: safe.message, code: safe.code, requestId });
    }
  }
);
