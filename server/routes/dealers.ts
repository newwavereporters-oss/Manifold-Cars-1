import { Router } from 'express';
import type { Request, Response } from 'express';
import { getServerEnv } from '../config/env.js';
import { getSupabaseClient } from '../lib/supabaseServer.js';
import { sendMigrationSqlFile } from '../lib/migrationSql.js';
import { requireAdmin } from '../middleware/auth.js';
import { standardApiLimiter } from '../middleware/rateLimit.js';
import { sanitizePublicDealerPayload } from './cars.js';
import { extractSupabaseHost } from './world.js';

const router = Router();

const PUBLIC_DEALER_COLUMN_CANDIDATES = [
  'id, business_name, slug, city, state, is_verified, dealer_status, joined_year',
  'id, name, business_name, slug, city, state, is_verified, dealer_status, joined_year',
  'id, business_name, slug, city, state, is_verified, joined_year',
  'id, name, slug, city, state, is_verified, joined_year',
  'id, business_name, city, state, is_verified, joined_year',
  'id, name, city, state, is_verified, joined_year',
];

let resolvedPublicDealerColumns: string | null = null;

router.get('/public', standardApiLimiter, async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');

  const env = getServerEnv();
  const supabaseHost = extractSupabaseHost(env.supabaseUrl);
  const supabase = getSupabaseClient();

  if (!supabase) {
    return res.status(503).json({
      error: 'Supabase is not configured on the API server.',
      code: 'SUPABASE_NOT_CONFIGURED',
      supabaseHost,
    });
  }

  const candidates = resolvedPublicDealerColumns
    ? [
        resolvedPublicDealerColumns,
        ...PUBLIC_DEALER_COLUMN_CANDIDATES.filter((c) => c !== resolvedPublicDealerColumns),
      ]
    : PUBLIC_DEALER_COLUMN_CANDIDATES;

  let query: any = null;
  for (const cols of candidates) {
    query = await supabase.from('dealers').select(cols);
    if (!query.error) {
      resolvedPublicDealerColumns = cols;
      break;
    }
    if (query.error?.code !== '42703') {
      break;
    }
  }

  if (query?.error) {
    return res.status(502).json({
      error: query.error.message,
      code: query.error.code,
      details: query.error.details,
      hint: query.error.hint,
      supabaseHost,
    });
  }

  const dealers = (query.data || [])
    .filter((d: any) => {
      const st = String(d?.dealer_status || '').trim().toLowerCase();
      return st !== 'disapproved' && st !== 'suspended';
    })
    .map((d: any) => sanitizePublicDealerPayload(d))
    .filter(Boolean);

  return res.json({ dealers, supabaseHost });
});

router.get('/db-status', requireAdmin, standardApiLimiter, async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');

  const authHeader = req.headers.authorization;
  const supabase = getSupabaseClient(authHeader);

  if (!supabase) {
    return res.json({
      configured: false,
      migrationRequired: true,
      error: 'Supabase URL or Key not configured in environment.',
    });
  }

  const checkRpcExists = async (fnName: string, args: Record<string, any>) => {
    try {
      const result = await Promise.race([
        supabase.rpc(fnName, args),
        new Promise<{ error: { code: string; message: string } }>((resolve) =>
          setTimeout(
            () => resolve({ error: { code: 'TIMEOUT', message: 'Supabase check timed out' } }),
            2500
          )
        ),
      ]);
      const error = (result as any)?.error;
      if (
        error &&
        (error.code === 'PGRST202' ||
          error.code === '42883' ||
          error.message?.includes('Could not find the function') ||
          (error.message?.includes('function') && error.message?.includes('does not exist')))
      ) {
        return { exists: false, code: error.code, error: error.message };
      }
      if (error && (error.code === 'TIMEOUT' || error.code === 'FETCH_ERROR')) {
        return { exists: false, code: error.code, error: error.message };
      }
      return { exists: true };
    } catch (err: any) {
      return { exists: false, code: 'FETCH_ERROR', error: err?.message || 'Fetch failed' };
    }
  };

  const [listCheck, setStatusCheck, approvedFnCheck] = await Promise.all([
    checkRpcExists('admin_list_dealer_accounts', {}),
    checkRpcExists('admin_set_dealer_approval_status', { p_dealer_id: '', p_action: 'pending', p_reason: null }),
    checkRpcExists('is_approved_dealer', {}),
  ]);

  const checks = {
    'rpc:admin_list_dealer_accounts': listCheck,
    'rpc:admin_set_dealer_approval_status': setStatusCheck,
    'rpc:is_approved_dealer': approvedFnCheck,
  };

  const timedOut = Object.values(checks).every((c) => c.code === 'TIMEOUT' || c.code === 'FETCH_ERROR');
  const allExist = Object.values(checks).every((c) => c.exists);

  return res.json({
    configured: true,
    migrationRequired: timedOut ? false : !allExist,
    networkUnreachable: timedOut,
    checks,
    migrationFilePath: 'src/db/dealer-approval-migration.sql',
  });
});

router.get('/migration-sql', standardApiLimiter, (_req: Request, res: Response) => {
  sendMigrationSqlFile('dealer-approval-migration.sql', '-- Dealer approval migration SQL not found.', res);
});

export const dealersRouter = router;
