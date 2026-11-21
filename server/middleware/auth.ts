import type { NextFunction, Request, Response } from 'express';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  getSupabaseClient,
  verifyActiveAdmin,
  verifyDealerAccount,
  verifySupabaseUser,
} from '../lib/supabaseServer.js';

export interface AuthContext {
  user?: User;
  token?: string;
  authHeader?: string;
  supabase: SupabaseClient | null;
  role: 'admin' | 'dealer' | 'buyer' | 'anonymous';
  adminRole?: string;
  dealerId?: string;
  dealerBusinessName?: string;
  dealerApproved?: boolean;
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

  const adminCheck = await verifyActiveAdmin(verified.supabase, verified.user);
  if (adminCheck.isAdmin) {
    req.auth = {
      user: verified.user,
      token: verified.token,
      authHeader: verified.authHeader,
      supabase: verified.supabase,
      role: 'admin',
      adminRole: adminCheck.role,
    };
    next();
    return;
  }

  const dealerCheck = await verifyDealerAccount(verified.supabase, verified.user);
  if (dealerCheck.hasAccount && dealerCheck.dealerId) {
    req.auth = {
      user: verified.user,
      token: verified.token,
      authHeader: verified.authHeader,
      supabase: verified.supabase,
      role: 'dealer',
      dealerId: dealerCheck.dealerId,
      dealerBusinessName: dealerCheck.businessName,
      dealerApproved: dealerCheck.isApproved,
    };
    next();
    return;
  }

  req.auth = {
    user: verified.user,
    token: verified.token,
    authHeader: verified.authHeader,
    supabase: verified.supabase,
    role: 'buyer',
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

  req.auth = {
    user: result.user,
    token: result.token,
    authHeader: result.authHeader,
    supabase: result.supabase,
    role: 'buyer',
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
    req.auth = {
      user: result.user,
      token: result.token,
      authHeader: result.authHeader,
      supabase: result.supabase,
      role: 'buyer',
    };
  }

  const adminCheck = await verifyActiveAdmin(req.auth.supabase!, req.auth.user!);
  if (!adminCheck.isAdmin) {
    res.status(403).json({
      error: 'Administrator privileges required to access this endpoint.',
    });
    return;
  }

  req.auth.role = 'admin';
  req.auth.adminRole = adminCheck.role;
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

  const dealerCheck = await verifyDealerAccount(result.supabase, result.user);
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
    dealerApproved: true,
  };
  next();
}
