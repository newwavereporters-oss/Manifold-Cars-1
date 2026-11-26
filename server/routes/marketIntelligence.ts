import { Router } from 'express';
import type { Request, Response } from 'express';
import { getServerEnv } from '../config/env.js';
import { getSupabaseClient } from '../lib/supabaseServer.js';
import { sendMigrationSqlFile } from '../lib/migrationSql.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { aiIngestionLimiter, standardApiLimiter } from '../middleware/rateLimit.js';
import {
  validateEmbedBody,
  validateExtractTextBody,
  validateFetchUrlBody,
  validateSearchKnowledgeBody,
} from '../middleware/validate.js';
import {
  extractVehiclesWithGemini,
  fetchListingPageSafe,
  getGenAI,
  isGeminiConfigured,
  persistExtractionTrace,
} from '../services/marketIntelligenceBackend.js';
import { pricingAgentRouter } from './pricingAgent.js';

const router = Router();
router.use('/agent', pricingAgentRouter);

// Health Check
router.get('/health', standardApiLimiter, (_req: Request, res: Response) => {
  const { supabaseUrl, supabaseAnonKey } = getServerEnv();
  res.json({
    status: 'ok',
    geminiConfigured: isGeminiConfigured(),
    geminiModel: 'gemini-2.5-flash',
    embeddingModel: 'gemini-embedding-2-preview',
    heuristicFallbackEnabled: false,
    supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    timestamp: new Date().toISOString(),
  });
});

// Database Migration & Table Verification Diagnostic Route (Admin-only)
router.get('/db-migration-status', requireAdmin, standardApiLimiter, async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const supabase = getSupabaseClient(authHeader);

  if (!supabase) {
    return res.json({
      configured: false,
      tablesExist: false,
      error: 'Supabase URL or Key not set in environment.',
    });
  }

  const tableChecks: Record<string, { exists: boolean; code?: string; error?: string; count?: number | null }> = {};
  const tables = [
    'knowledge_base',
    'market_data_sources',
    'market_data_submissions',
    'market_crawl_jobs',
    'market_price_observations',
    'market_observation_revisions',
  ];

  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1);
    if (error) {
      const msg =
        error.code === '42501'
          ? 'Permission denied (table requires least-privilege migration grants)'
          : error.message || `Table not accessible (code: ${error.code})`;
      tableChecks[t] = { exists: false, code: error.code, error: msg };
    } else {
      const { count } = await supabase.from(t).select('id', { count: 'exact', head: true });
      tableChecks[t] = { exists: true, count: count ?? 0 };
    }
  }

  const { data: _rpcData, error: rpcError } = await supabase.rpc('match_knowledge', {
    query_embedding: Array(768).fill(0),
    match_threshold: 0.1,
    match_count: 1,
  });

  const rpcExists = !rpcError || !rpcError.message.includes('Could not find the function');
  const allTablesExist = Object.values(tableChecks).every((c) => c.exists);

  return res.json({
    configured: true,
    tablesExist: allTablesExist,
    migrationRequired: !allTablesExist,
    tableChecks,
    rpcMatchKnowledge: {
      exists: rpcExists,
      error: rpcError ? rpcError.message : null,
    },
    migrationFilePath: 'src/db/market-intelligence-migration.sql',
  });
});

// Serve full SQL Migration for 1-click clipboard in Admin UI
router.get('/migration-sql', standardApiLimiter, (_req: Request, res: Response) => {
  sendMigrationSqlFile('market-intelligence-migration.sql', '-- Migration file not found.', res);
});

// URL Crawl & Ingestion Endpoint (Protected: Active Admin + Rate Limited + Validated)
router.post(
  '/fetch-url',
  requireAuth,
  requireAdmin,
  aiIngestionLimiter,
  validateFetchUrlBody,
  async (req: Request, res: Response) => {
    const { url } = req.body;
    const authHeader = req.headers.authorization;

    const fetchResult = await fetchListingPageSafe(url);

    if (!fetchResult.success) {
      return res.status(200).json({
        success: false,
        status: fetchResult.status,
        httpStatus: fetchResult.httpStatus,
        submittedUrl: fetchResult.submittedUrl,
        finalUrl: fetchResult.finalUrl,
        error: fetchResult.error,
        items: [],
      });
    }

    const extractionResult = await extractVehiclesWithGemini(
      fetchResult.extractedText || '',
      fetchResult.finalUrl,
      fetchResult.title || '',
      fetchResult.jsonLdItems
    );

    const dbTrace = await persistExtractionTrace(
      authHeader,
      'url',
      url,
      fetchResult,
      extractionResult.observations,
      extractionResult.error
    );

    return res.json({
      success: extractionResult.success,
      status: fetchResult.status,
      httpStatus: fetchResult.httpStatus,
      submittedUrl: fetchResult.submittedUrl,
      finalUrl: fetchResult.finalUrl,
      fetchTimestamp: fetchResult.fetchTimestamp,
      contentLength: fetchResult.contentLength,
      extractionMethod: extractionResult.method,
      extractionError: extractionResult.error,
      traceableSubmissionId: dbTrace.submissionId,
      observationIds: dbTrace.observationIds,
      supabaseSynced: dbTrace.supabaseSynced,
      dbNotice: dbTrace.dbError,
      itemsCount: extractionResult.observations.length,
      items: extractionResult.observations,
    });
  }
);

// Manual Text Ingestion Endpoint (Protected: Active Admin + Rate Limited + Validated)
router.post(
  '/extract-text',
  requireAuth,
  requireAdmin,
  aiIngestionLimiter,
  validateExtractTextBody,
  async (req: Request, res: Response) => {
    const { text, sourceUrl, publisher } = req.body;
    const authHeader = req.headers.authorization;

    const extractionResult = await extractVehiclesWithGemini(
      text,
      sourceUrl || 'manual-paste',
      publisher || 'Pasted Market Listing'
    );

    const dbTrace = await persistExtractionTrace(
      authHeader,
      'text',
      text,
      null,
      extractionResult.observations,
      extractionResult.error
    );

    return res.json({
      success: extractionResult.success,
      extractionMethod: extractionResult.method,
      extractionError: extractionResult.error,
      traceableSubmissionId: dbTrace.submissionId,
      observationIds: dbTrace.observationIds,
      supabaseSynced: dbTrace.supabaseSynced,
      dbNotice: dbTrace.dbError,
      itemsCount: extractionResult.observations.length,
      items: extractionResult.observations,
    });
  }
);

// 768-Dimensional Gemini Embeddings Endpoint (Protected: Active Admin + Rate Limited + Validated)
router.post(
  '/embed',
  requireAuth,
  requireAdmin,
  aiIngestionLimiter,
  validateEmbedBody,
  async (req: Request, res: Response) => {
    const { text } = req.body;
    const genAI = getGenAI();

    if (!genAI) {
      return res.status(503).json({
        error: 'Gemini API is not configured. Embeddings require process.env.GEMINI_API_KEY.',
      });
    }

    try {
      const result = await genAI.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: text,
        config: {
          outputDimensionality: 768,
        },
      });

      const values = result.embeddings?.[0]?.values || [];
      return res.json({
        success: true,
        model: 'gemini-embedding-2-preview',
        dimensions: values.length,
        embedding: values,
      });
    } catch (err: any) {
      console.error('[MANIFOLD Server] Embedding generation error:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to generate embedding with gemini-embedding-2-preview',
      });
    }
  }
);

// Knowledge Base Search Endpoint
router.post(
  '/search-knowledge',
  standardApiLimiter,
  validateSearchKnowledgeBody,
  async (req: Request, res: Response) => {
    const { query, limit = 5 } = req.body;
    const authHeader = req.headers.authorization;

    const supabase = getSupabaseClient(authHeader);
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase client not configured.' });
    }

    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('id, title, content, category, metadata, source_url')
        .eq('status', 'approved')
        .ilike('content', `%${query}%`)
        .limit(limit);

      if (error) {
        return res.status(200).json({
          success: false,
          gap: 'TABLE_MISSING_OR_RESTRICTED',
          error: error.message,
          results: [],
        });
      }

      return res.json({
        success: true,
        query,
        results: data || [],
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message });
    }
  }
);

export const marketIntelligenceRouter = router;
