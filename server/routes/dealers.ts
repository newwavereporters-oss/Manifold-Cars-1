import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../lib/supabaseServer';
import { sendMigrationSqlFile } from '../lib/migrationSql';
import { standardApiLimiter } from '../middleware/rateLimit';

const router = Router();

router.get('/db-status', standardApiLimiter, async (req: Request, res: Response) => {
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
