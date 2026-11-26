import type { NextFunction, Request, Response } from 'express';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  getSupabaseClient,
  resolveAuthenticatedRole,
  verifyActiveAdmin,
  verifyDealerAccount,
  verifyPlayerProfile,
  verifySupabaseUser,
  type ManifoldAccountRole,
} from '../lib/supabaseServer.js';

export interface AuthContext {
  user?: User;
  token?: string;
  authHeader?: string;
  supabase: SupabaseClient | null;
  role: ManifoldAccountRole | 'anonymous';
  adminRole?: string;
  dealerId?: string;
  dealerBusinessName?: string;
  dealerAccountStatus?: string;
  dealerApproved?: boolean;
  playerId?: string;
  playerNickname?: string;
  playerAccountStatus?: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.auth = {
      supabase: getSupabaseClient(),
      role: 'anonymous',
    };
    next();
    return;
  }

  const verified = await verifySupabaseUser(authHeader);
  if (!verified.ok) {
    // Public endpoints degrade cleanly to anonymous buyer context without granting privileged roles
    req.auth = {
      supabase: getSupabaseClient(),
      role: 'anonymous',
    };
    next();
    return;
  }

  const resolved = await resolveAuthenticatedRole(verified.supabase, verified.user);
  req.auth = {
    user: verified.user,
    token: verified.token,
    authHeader: verified.authHeader,
    supabase: verified.supabase,
    ...resolved,
  };
  next();
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await verifySupabaseUser(req.headers.authorization);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const resolved = await resolveAuthenticatedRole(result.supabase, result.user);
  req.auth = {
    user: result.user,
    token: result.token,
    authHeader: result.authHeader,
    supabase: result.supabase,
    ...resolved,
  };
  next();
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.auth?.user || !req.auth.supabase) {
    const result = await verifySupabaseUser(req.headers.authorization);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const resolved = await resolveAuthenticatedRole(result.supabase, result.user);
    req.auth = {
      user: result.user,
      token: result.token,
      authHeader: result.authHeader,
      supabase: result.supabase,
      ...resolved,
    };
  }

  const adminCheck = await verifyActiveAdmin(req.auth.supabase!, req.auth.user!);
  if (!adminCheck.isAdmin) {
    const isPlayer = req.auth.role === 'player';
    res.status(403).json({
      error: isPlayer
        ? 'Game Player accounts are not authorized to access MANIFOLD Admin endpoints.'
        : 'Administrator privileges required to access this endpoint.',
      code: isPlayer ? 'PLAYER_ROLE_FORBIDDEN' : 'ADMIN_ROLE_REQUIRED',
    });
    return;
  }

  req.auth.role = 'admin';
  req.auth.adminRole = adminCheck.role;
  next();
}

export async function requireDealer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await verifySupabaseUser(req.headers.authorization);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const [adminCheck, playerCheck, dealerCheck] = await Promise.all([
    verifyActiveAdmin(result.supabase, result.user),
    verifyPlayerProfile(result.supabase, result.user),
    verifyDealerAccount(result.supabase, result.user),
  ]);

  if (playerCheck.isPlayer) {
    res.status(403).json({
      error: 'Game Player accounts cannot access MANIFOLD Dealer endpoints.',
      code: 'PLAYER_ROLE_FORBIDDEN',
    });
    return;
  }

  if (adminCheck.isAdmin && !dealerCheck.hasAccount) {
    res.status(403).json({
      error: 'Dealer account authorization required.',
      code: 'DEALER_ROLE_REQUIRED',
    });
    return;
  }

  if (!dealerCheck.hasAccount || !dealerCheck.dealerId) {
    res.status(403).json({
      error: dealerCheck.reason || 'Registered MANIFOLD dealership authorization required.',
      code: 'DEALER_ROLE_REQUIRED',
    });
    return;
  }

  if (dealerCheck.accountStatus === 'suspended') {
    res.status(403).json({
      error: dealerCheck.reason || 'Your dealership account is suspended.',
      code: 'DEALER_ACCOUNT_SUSPENDED',
    });
    return;
  }

  req.auth = {
    user: result.user,
    token: result.token,
    authHeader: result.authHeader,
    supabase: result.supabase,
    role: 'dealer',
    dealerId: dealerCheck.dealerId,
    dealerBusinessName: dealerCheck.businessName,
    dealerAccountStatus: dealerCheck.accountStatus,
    dealerApproved: dealerCheck.isApproved,
  };
  next();
}

export async function requireApprovedDealer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await verifySupabaseUser(req.headers.authorization);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const [playerCheck, dealerCheck] = await Promise.all([
    verifyPlayerProfile(result.supabase, result.user),
    verifyDealerAccount(result.supabase, result.user),
  ]);

  if (playerCheck.isPlayer) {
    res.status(403).json({
      error: 'Game Player accounts cannot access MANIFOLD Dealer endpoints.',
      code: 'PLAYER_ROLE_FORBIDDEN',
    });
    return;
  }

  if (!dealerCheck.hasAccount || !dealerCheck.isApproved || !dealerCheck.dealerId) {
    res.status(403).json({
      error: dealerCheck.reason || 'Approved dealership authorization required.',
      code: 'DEALER_APPROVAL_REQUIRED',
    });
    return;
  }

  req.auth = {
    user: result.user,
    token: result.token,
    authHeader: result.authHeader,
    supabase: result.supabase,
    role: 'dealer',
    dealerId: dealerCheck.dealerId,
    dealerBusinessName: dealerCheck.businessName,
    dealerAccountStatus: dealerCheck.accountStatus,
    dealerApproved: true,
  };
  next();
}

export async function requirePlayer(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const result = await verifySupabaseUser(req.headers.authorization);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const resolved = await resolveAuthenticatedRole(result.supabase, result.user);
  if (resolved.role !== 'player' || !resolved.playerId) {
    res.status(403).json({
      error: 'Active MANIFOLD Game Player account required.',
      code: 'PLAYER_ROLE_REQUIRED',
    });
    return;
  }

  req.auth = {
    user: result.user,
    token: result.token,
    authHeader: result.authHeader,
    supabase: result.supabase,
    ...resolved,
  };
  next();
}

