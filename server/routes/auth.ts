import { Router } from 'express';
import type { Response } from 'express';
import {
  requireAdmin,
  requireAuth,
  requireDealer,
  requirePlayer,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import { standardApiLimiter } from '../middleware/rateLimit.js';

const router = Router();

/**
 * GET /api/auth/me
 * Authoritative database-verified role inspection for the current Bearer session.
 */
router.get('/me', standardApiLimiter, requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');

  return res.json({
    authenticated: true,
    userId: req.auth?.user?.id || null,
    email: req.auth?.user?.email || null,
    role: req.auth?.role || 'buyer',
    adminRole: req.auth?.adminRole || null,
    dealerId: req.auth?.dealerId || null,
    dealerBusinessName: req.auth?.dealerBusinessName || null,
    dealerAccountStatus: req.auth?.dealerAccountStatus || null,
    dealerApproved: Boolean(req.auth?.dealerApproved),
    playerId: req.auth?.playerId || null,
    playerNickname: req.auth?.playerNickname || null,
    playerAccountStatus: req.auth?.playerAccountStatus || null,
  });
});

/**
 * GET /api/auth/admin-check
 * Server-side authorization gate for Admin routes. Rejects Game Players and Dealers with 403.
 */
router.get('/admin-check', standardApiLimiter, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return res.json({
    authorized: true,
    role: 'admin',
    adminRole: req.auth?.adminRole || 'admin',
    userId: req.auth?.user?.id || null,
  });
});

/**
 * GET /api/auth/dealer-check
 * Server-side authorization gate for Dealer routes. Rejects Game Players and Admins with 403.
 */
router.get('/dealer-check', standardApiLimiter, requireDealer, (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return res.json({
    authorized: true,
    role: 'dealer',
    dealerId: req.auth?.dealerId || null,
    dealerBusinessName: req.auth?.dealerBusinessName || null,
    dealerAccountStatus: req.auth?.dealerAccountStatus || null,
    dealerApproved: Boolean(req.auth?.dealerApproved),
    userId: req.auth?.user?.id || null,
  });
});

/**
 * GET /api/auth/player-check
 * Server-side authorization gate for Game Player routes. Rejects non-players with 403.
 */
router.get('/player-check', standardApiLimiter, requirePlayer, (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return res.json({
    authorized: true,
    role: 'player',
    playerId: req.auth?.playerId || null,
    playerNickname: req.auth?.playerNickname || null,
    playerAccountStatus: req.auth?.playerAccountStatus || null,
    userId: req.auth?.user?.id || null,
  });
});

export const authRouter = router;
