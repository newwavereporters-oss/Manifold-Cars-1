import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../lib/supabaseServer';
import { sendMigrationSqlFile } from '../lib/migrationSql';
import { requireAuth } from '../middleware/auth';
import { chatModerationLimiter, standardApiLimiter } from '../middleware/rateLimit';
import { validateModerateChatBody } from '../middleware/validate';
import { getGenAI } from '../services/marketIntelligenceBackend';

const router = Router();

router.get('/db-status', standardApiLimiter, async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const supabase = getSupabaseClient(authHeader);

  if (!supabase) {
    return res.json({
      configured: false,
      tablesExist: false,
      migrationRequired: true,
      error: 'Supabase URL or Key not configured in environment.',
    });
  }

  const worldTables = [
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
  ];

  const checks: Record<string, { exists: boolean; code?: string; error?: string }> = {};
  const checkOneTable = async (t: string) => {
    try {
      const cols = t === 'player_profiles' ? 'created_at, chat_status' : 'created_at';
      const result = await Promise.race([
        supabase.from(t).select(cols).limit(1),
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
        (error.code === 'PGRST205' ||
          error.code === '42P01' ||
          error.code === '42703' ||
          error.message?.includes('does not exist'))
      ) {
        checks[t] = { exists: false, code: error.code, error: error.message };
      } else if (error && error.code !== '42501' && error.code !== 'PGRST116') {
        checks[t] = { exists: false, code: error.code, error: error.message };
      } else {
        checks[t] = { exists: true };
      }
    } catch (err: any) {
      checks[t] = { exists: false, code: 'FETCH_ERROR', error: err?.message || 'Fetch failed' };
    }
  };

  await Promise.all(worldTables.map((t) => checkOneTable(t)));

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
        checks[`rpc:${fnName}`] = { exists: false, code: error.code, error: error.message };
      } else if (error && (error.code === 'TIMEOUT' || error.code === 'FETCH_ERROR')) {
        checks[`rpc:${fnName}`] = { exists: false, code: error.code, error: error.message };
      } else {
        checks[`rpc:${fnName}`] = { exists: true };
      }
    } catch (err: any) {
      checks[`rpc:${fnName}`] = { exists: false, code: 'FETCH_ERROR', error: err?.message || 'Fetch failed' };
    }
  };

  await Promise.all([
    checkRpcExists('check_player_registration_available', { p_email: '', p_nickname: '' }),
    checkRpcExists('admin_get_players_directory', {}),
  ]);

  const timedOut = Object.values(checks).every((c) => c.code === 'TIMEOUT' || c.code === 'FETCH_ERROR');
  const allExist = Object.values(checks).every((c) => c.exists);
  return res.json({
    configured: true,
    tablesExist: timedOut ? true : allExist,
    migrationRequired: timedOut ? false : !allExist,
    checks,
    networkUnreachable: timedOut,
    migrationFilePath: 'src/db/game-world-social-migration.sql',
  });
});

router.get('/migration-sql', standardApiLimiter, (_req: Request, res: Response) => {
  sendMigrationSqlFile('game-world-social-migration.sql', '-- Game world migration SQL not found.', res);
});

router.post(
  '/moderate-chat',
  requireAuth,
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
