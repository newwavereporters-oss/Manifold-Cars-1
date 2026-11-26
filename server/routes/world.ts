import { Router } from 'express';
import type { Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '../config/env.js';
import {
  extractBearerToken,
  getSupabaseAdminClient,
  getSupabaseClient,
} from '../lib/supabaseServer.js';
import { sendMigrationSqlFile } from '../lib/migrationSql.js';
import { requirePlayer } from '../middleware/auth.js';
import { chatModerationLimiter, standardApiLimiter } from '../middleware/rateLimit.js';
import { validateModerateChatBody } from '../middleware/validate.js';
import { getGenAI } from '../services/marketIntelligenceBackend.js';

const router = Router();

export const WORLD_REQUIRED_TABLES = [
  'player_profiles',
  'player_presence',
  'chat_invitations',
  'chat_conversations',
  'chat_messages',
  'player_blocks',
  'player_reports',
  'moderation_incidents',
  'player_admin_audit_logs',
  'chat_moderation_config',
] as const;

export const WORLD_TABLE_CHECK_COLUMNS: Record<(typeof WORLD_REQUIRED_TABLES)[number], string> = {
  player_profiles: 'created_at, chat_status',
  player_presence: 'player_id, is_online, last_heartbeat_at, updated_at',
  chat_invitations: 'created_at',
  chat_conversations: 'created_at',
  chat_messages: 'created_at',
  player_blocks: 'created_at',
  player_reports: 'created_at',
  moderation_incidents: 'created_at, severity',
  player_admin_audit_logs: 'created_at',
  chat_moderation_config: 'id, discovery_radius, heartbeat_timeout_minutes, updated_at',
};

const AUTH_ONLY_WORLD_RPCS = new Set([
  'admin_get_players_directory',
  'admin_get_player_detail',
  'admin_get_moderation_overview',
]);

export function extractSupabaseHost(rawUrl?: string | null): string | null {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).host;
  } catch {
    return null;
  }
}

export interface WorldDbCheckEntry {
  exists: boolean;
  unverifiedAnonRestricted?: boolean;
  code?: string;
  error?: string;
}

export type WorldVerificationMode = 'service_role' | 'authenticated_user' | 'anon';

export interface WorldDbStatusPayload {
  configured: boolean;
  tablesExist: boolean;
  migrationRequired: boolean;
  verificationMode: WorldVerificationMode;
  supabaseHost: string | null;
  checks: Record<string, WorldDbCheckEntry>;
  networkUnreachable?: boolean;
  migrationFilePath: string;
  error?: string;
}

function isSchemaMissingError(error: any, isRpc: boolean): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  if (isRpc) {
    return (
      code === 'PGRST202' ||
      code === '42883' ||
      msg.includes('could not find the function') ||
      (msg.includes('function') && msg.includes('does not exist'))
    );
  }
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    code === '42703' ||
    msg.includes('does not exist')
  );
}

export async function evaluateWorldDbStatus(params: {
  client: SupabaseClient | null;
  verificationMode: WorldVerificationMode;
  supabaseUrl?: string | null;
}): Promise<WorldDbStatusPayload> {
  const { client, verificationMode, supabaseUrl } = params;
  const supabaseHost = extractSupabaseHost(supabaseUrl);

  if (!client) {
    return {
      configured: false,
      tablesExist: false,
      migrationRequired: true,
      verificationMode,
      supabaseHost,
      checks: {},
      migrationFilePath: 'src/db/game-world-social-migration.sql',
      error: 'Supabase URL or Key not configured in server environment.',
    };
  }

  const checks: Record<string, WorldDbCheckEntry> = {};

  const checkOneTable = async (t: (typeof WORLD_REQUIRED_TABLES)[number]) => {
    try {
      const cols = WORLD_TABLE_CHECK_COLUMNS[t];
      const result = await Promise.race([
        client.from(t).select(cols).limit(1),
        new Promise<{ error: { code: string; message: string } }>((resolve) =>
          setTimeout(
            () => resolve({ error: { code: 'TIMEOUT', message: 'Supabase check timed out' } }),
            2500
          )
        ),
      ]);
      const error = (result as any)?.error;
      if (!error || error.code === 'PGRST116') {
        checks[t] = { exists: true };
        return;
      }

      if (isSchemaMissingError(error, false)) {
        checks[t] = { exists: false, code: error.code, error: error.message };
        return;
      }

      // 42501 = permission denied / RLS restriction on an existing table
      if (error.code === '42501') {
        checks[t] = {
          exists: true,
          unverifiedAnonRestricted: verificationMode === 'anon',
          code: error.code,
          error: error.message,
        };
        return;
      }

      if (error.code === 'TIMEOUT' || error.code === 'FETCH_ERROR') {
        checks[t] = { exists: false, code: error.code, error: error.message };
        return;
      }

      // Other PostgreSQL/PostgREST runtime errors mean the table exists in schema
      checks[t] = { exists: true, code: error.code, error: error.message };
    } catch (err: any) {
      checks[t] = { exists: false, code: 'FETCH_ERROR', error: err?.message || 'Fetch failed' };
    }
  };

  const checkRpcExists = async (fnName: string, args: Record<string, any>) => {
    try {
      const result = await Promise.race([
        client.rpc(fnName, args),
        new Promise<{ error: { code: string; message: string } }>((resolve) =>
          setTimeout(
            () => resolve({ error: { code: 'TIMEOUT', message: 'Supabase check timed out' } }),
            2500
          )
        ),
      ]);
      const error = (result as any)?.error;
      if (!error) {
        checks[`rpc:${fnName}`] = { exists: true };
        return;
      }

      // PostgREST omits functions revoked from `anon` from anon's schema cache (returning PGRST202/42501).
      // That is expected privilege isolation, NOT a missing migration.
      if (
        verificationMode === 'anon' &&
        AUTH_ONLY_WORLD_RPCS.has(fnName) &&
        (error.code === 'PGRST202' || error.code === '42501')
      ) {
        checks[`rpc:${fnName}`] = {
          exists: true,
          unverifiedAnonRestricted: true,
          code: error.code,
          error:
            'Restricted from anonymous RPC schema cache (expected for authenticated-only admin RPCs).',
        };
        return;
      }

      if (isSchemaMissingError(error, true)) {
        checks[`rpc:${fnName}`] = { exists: false, code: error.code, error: error.message };
        return;
      }

      if (error.code === 'TIMEOUT' || error.code === 'FETCH_ERROR') {
        checks[`rpc:${fnName}`] = { exists: false, code: error.code, error: error.message };
        return;
      }

      // e.g. P0001 ("Admin privileges required") proves the RPC exists and executed!
      checks[`rpc:${fnName}`] = { exists: true, code: error.code, error: error.message };
    } catch (err: any) {
      checks[`rpc:${fnName}`] = {
        exists: false,
        code: 'FETCH_ERROR',
        error: err?.message || 'Fetch failed',
      };
    }
  };

  await Promise.all([
    ...WORLD_REQUIRED_TABLES.map((t) => checkOneTable(t)),
    checkRpcExists('check_player_registration_available', { p_email: '', p_nickname: '' }),
    checkRpcExists('admin_get_players_directory', {}),
  ]);

  const entries = Object.values(checks);
  const timedOut =
    entries.length > 0 && entries.every((c) => c.code === 'TIMEOUT' || c.code === 'FETCH_ERROR');
  const allExist = entries.every((c) => c.exists);

  return {
    configured: true,
    tablesExist: timedOut ? true : allExist,
    migrationRequired: timedOut ? false : !allExist,
    verificationMode,
    supabaseHost,
    checks,
    networkUnreachable: timedOut,
    migrationFilePath: 'src/db/game-world-social-migration.sql',
  };
}

router.get('/db-status', standardApiLimiter, async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');

  const env = getServerEnv();
  const authHeader = req.headers.authorization;
  const adminClient = getSupabaseAdminClient();
  const bearerToken = extractBearerToken(authHeader);
  const userClient = getSupabaseClient(authHeader);

  const client = adminClient || userClient;
  const verificationMode: WorldVerificationMode = adminClient
    ? 'service_role'
    : bearerToken
    ? 'authenticated_user'
    : 'anon';

  const status = await evaluateWorldDbStatus({
    client,
    verificationMode,
    supabaseUrl: env.supabaseUrl,
  });

  return res.json(status);
});

router.get('/migration-sql', standardApiLimiter, (_req: Request, res: Response) => {
  sendMigrationSqlFile('game-world-social-migration.sql', '-- Game world migration SQL not found.', res);
});

router.post(
  '/moderate-chat',
  requirePlayer,
  chatModerationLimiter,
  validateModerateChatBody,
  async (req: Request, res: Response) => {
    const { content } = req.body;
    const trimmed = content.trim();
    if (trimmed.length === 0 || trimmed.length > 500) {
      return res.json({
        allowed: false,
        severity: 'block',
        action: 'block',
        category: 'INVALID_LENGTH',
        reason: 'Message must be 1 to 500 characters.',
      });
    }

    const lower = trimmed.toLowerCase();
    const collapsed = lower.replace(/[^a-z0-9@.+]/g, '');
    const phonePattern = /(\+?234[\s\-.]?[0-9]{2,4}[\s\-.]?[0-9]{3,4}[\s\-.]?[0-9]{3,4}|0[789][01][\s\-.]?[0-9]{3,4}[\s\-.]?[0-9]{4})/;
    const phoneSpanPattern = /(?:^|[^0-9,])(\+?[0-9](?:[\s\-.()]*[0-9]){7,14})(?:[^0-9]|$)/;
    const spokenPhonePattern = /(zero|oh)\s*(eight|seven|nine)\s*(zero|one|two|three|four|five|six|seven|eight|nine)/i;
    const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
    const obfuscatedEmailPattern = /[a-z0-9._%+-]+\s*(at|\(at\)|\[at\])\s*(gmail|yahoo|outlook|hotmail|icloud|proton)\s*(dot|\.)\s*(com|net|org|ng)/i;
    const linkPattern = /(https?:\/\/|www\.|wa\.me\/|t\.me\/|bit\.ly\/|instagram\.com|tiktok\.com|snapchat\.com|discord\.gg)/i;
    const offPlatformAppsPattern = /\b(whatsapp|whatsap|watsapp|whats app|telegram|snapchat|signal app|viber|wechat)\b/i;
    const socialPlatformInvite =
      /\b(instagram|insta|tiktok|discord)\b/i.test(lower) &&
      /\b(add|dm|follow|reach|text|chat|message|handle|me|my)\b/i.test(lower);
    const contactSolicitPattern = /\b(call me|text me|ring me|drop your number|send your number|here is my number|take my number|dm me on|hit me up on|add me on)\b/i;
    const handleInvitePattern = /(@[a-z0-9_.]{3,})/i.test(lower) && /\b(add|dm|follow|reach|text|chat|message|handle|snap|ig|tg)\b/i.test(lower);
    const datingPattern = /\b(hookup|hook up|wanna link tonight|link up tonight|date me|be my girlfriend|be my boyfriend|sugar daddy|sugar mommy|looking for a girlfriend|looking for a boyfriend|netflix and chill|come over to my place)\b/i;
    const sexualPattern = /\b(send nudes|send me nudes|nudes|horny|sexting|erotic|blowjob|handjob|fuck me|suck my|orgasm|porn|onlyfans)\b/i;
    const harassmentScamPattern = /\b(kill yourself|i will kill you|stab you|shoot you|wire transfer|send me your bank|bank details|bvn|otp code|motherfucker|retard|faggot)\b/i;
    const ambiguousReviewPattern = /\b(send pics|my digits|drop your @|meet in person alone|bank account)\b/i;

    if (phonePattern.test(trimmed) || phoneSpanPattern.test(trimmed) || spokenPhonePattern.test(lower)) {
      return res.json({
        allowed: false,
        severity: 'block',
        action: 'block',
        category: 'PERSONAL_CONTACT_PHONE',
        reason: 'Sharing phone numbers or numeric contact details is not permitted in MANIFOLD community chat.',
      });
    }
    if (emailPattern.test(trimmed) || obfuscatedEmailPattern.test(lower)) {
      return res.json({
        allowed: false,
        severity: 'block',
        action: 'block',
        category: 'PERSONAL_CONTACT_EMAIL',
        reason: 'Sharing email addresses is not permitted in MANIFOLD community chat.',
      });
    }
    if (linkPattern.test(trimmed) || /(wame|tme|http|https)[a-z0-9]{3,}/.test(collapsed)) {
      return res.json({
        allowed: false,
        severity: 'block',
        action: 'block',
        category: 'EXTERNAL_LINK',
        reason: 'Sharing external links or URLs is not permitted.',
      });
    }
    if (offPlatformAppsPattern.test(lower) || socialPlatformInvite || contactSolicitPattern.test(lower) || handleInvitePattern) {
      return res.json({
        allowed: false,
        severity: 'block',
        action: 'block',
        category: 'OFF_PLATFORM_SOLICITATION',
        reason: 'Sharing social handles or moving conversations off MANIFOLD is not allowed.',
      });
    }
    if (datingPattern.test(lower)) {
      return res.json({
        allowed: false,
        severity: 'block',
        action: 'block',
        category: 'DATING_SOLICITATION',
        reason: 'Dating or personal meetup solicitation is not allowed in MANIFOLD driving chat.',
      });
    }
    if (sexualPattern.test(lower)) {
      return res.json({
        allowed: false,
        severity: 'block',
        action: 'block',
        category: 'SEXUAL_EXPLICIT',
        reason: 'Sexually explicit content is strictly prohibited.',
      });
    }
    if (harassmentScamPattern.test(lower)) {
      return res.json({
        allowed: false,
        severity: 'block',
        action: 'block',
        category: 'HARASSMENT_OR_SCAM',
        reason: 'Threats, hate speech, harassment, or financial solicitation is prohibited.',
      });
    }
    if (ambiguousReviewPattern.test(lower)) {
      return res.json({
        allowed: true,
        severity: 'flagged_for_review',
        action: 'flag_review',
        category: 'AMBIGUOUS_REVIEW',
        reason: 'Flagged conservatively for safety review without penalizing the player.',
      });
    }

    const genAI = getGenAI();
    if (genAI) {
      try {
        const result = await Promise.race([
          genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Evaluate this in-game car-driving chat message.
ALLOW normal everyday conversation about cars, driving, Lagos routes, music, sports, entertainment, everyday hobbies, and MANIFOLD marketplace discoveries (including benign slang like "killing it on Third Mainland Bridge", "shoot a clip of that AMG", "my number 1 dream car", "love this song").
BLOCK ONLY clear, unambiguous violations: (1) phone/email/off-platform handle sharing or external links, (2) dating or sexually explicit solicitation, (3) genuine threats, hate speech, severe abuse, or financial scams.
If borderline/ambiguous, set action="flag_review" and allowed=true instead of blocking.
Respond ONLY with JSON {"allowed": boolean, "action": "allow"|"flag_review"|"block", "category": string, "reason": string|null}.
Message: ${JSON.stringify(trimmed)}`,
            config: { responseMimeType: 'application/json' },
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2200)),
        ]);
        if (result && 'text' in result && result.text) {
          const parsed = JSON.parse(result.text.replace(/```json|```/gi, '').trim());
          if (parsed && parsed.allowed === false && parsed.action === 'block') {
            return res.json({
              allowed: false,
              severity: 'block',
              action: 'block',
              category: parsed.category || 'CONTEXTUAL_POLICY_VIOLATION',
              reason: parsed.reason || 'This message violates MANIFOLD community chat safety guidelines.',
            });
          }
          if (parsed && parsed.action === 'flag_review') {
            return res.json({
              allowed: true,
              severity: 'flagged_for_review',
              action: 'flag_review',
              category: parsed.category || 'AMBIGUOUS_REVIEW',
              reason: parsed.reason || 'Flagged conservatively for safety review.',
            });
          }
        }
      } catch {
        // Non-fatal: DB RPC remains authoritative
      }
    }

    return res.json({ allowed: true, severity: 'clean', action: 'allow', category: 'CLEAN', reason: null });
  }
);

export const worldRouter = router;
