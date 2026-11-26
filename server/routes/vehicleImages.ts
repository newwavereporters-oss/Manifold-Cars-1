import crypto from 'node:crypto';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import multer from 'multer';
import {
  getSupabaseAdminClient,
  verifyActiveAdmin,
  verifyDealerAccount,
  verifyPlayerProfile,
  verifySupabaseUser,
} from '../lib/supabaseServer.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { vehicleImageUploadLimiter } from '../middleware/rateLimit.js';
import {
  MAX_RAW_UPLOAD_BYTES,
  validateAndReencodeVehicleImage,
  VehicleImageSecurityError,
} from '../services/vehicleImageSecurity.js';
import { fetchSafeRemoteImageBuffer } from '../services/safeRemoteImageFetcher.js';
import {
  extractVehicleImageStoragePath,
  VEHICLE_IMAGES_BUCKET,
} from '../../src/utils/vehicleImageUrl.js';

export type VehicleImageSlot = 'front-exterior' | 'cabin';

const VALID_VEHICLE_ID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;
const VALID_SLOTS = new Set<VehicleImageSlot>(['front-exterior', 'cabin']);

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_RAW_UPLOAD_BYTES,
    files: 1,
    fields: 10,
  },
});

export interface AuthorizedVehicleImageActor {
  userId: string;
  role: 'dealer' | 'admin';
  dealerId?: string;
  supabase: SupabaseClient;
}

export async function requireVehicleImageUploader(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const verified = await verifySupabaseUser(req.headers.authorization);
  if (!verified.ok) {
    res.status(verified.status).json({ error: verified.error, code: 'UNAUTHORIZED' });
    return;
  }

  const [adminCheck, playerCheck, dealerCheck] = await Promise.all([
    verifyActiveAdmin(verified.supabase, verified.user),
    verifyPlayerProfile(verified.supabase, verified.user),
    verifyDealerAccount(verified.supabase, verified.user),
  ]);

  if (playerCheck.isPlayer) {
    res.status(403).json({
      error: 'Game Player accounts are not permitted to upload or modify vehicle images.',
      code: 'PLAYER_ROLE_FORBIDDEN',
    });
    return;
  }

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

  if (!dealerCheck.hasAccount || !dealerCheck.dealerId) {
    res.status(403).json({
      error: dealerCheck.reason || 'Authorized dealership or active administrator account required.',
      code: 'DEALER_ROLE_REQUIRED',
    });
    return;
  }

  if (!dealerCheck.isApproved) {
    res.status(403).json({
      error: dealerCheck.reason || 'Approved dealership status is required before uploading vehicle images.',
      code: 'DEALER_APPROVAL_REQUIRED',
    });
    return;
  }

  req.auth = {
    user: verified.user,
    token: verified.token,
    authHeader: verified.authHeader,
    supabase: verified.supabase,
    role: 'dealer',
    dealerId: dealerCheck.dealerId,
    dealerBusinessName: dealerCheck.businessName,
    dealerAccountStatus: dealerCheck.accountStatus,
    dealerApproved: true,
  };
  next();
}

function sanitizeSegment(value: string): string {
  return (value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

export interface TargetVehicleAuthResult {
  ok: true;
  folderDealerId: string;
  isExistingVehicle: boolean;
  existingCar: Record<string, any> | null;
}

export interface TargetVehicleAuthError {
  ok: false;
  status: number;
  code: string;
  error: string;
}

export async function authorizeVehicleTarget(params: {
  actor: AuthorizedVehicleImageActor;
  vehicleId: string;
  mode?: string;
  requestedDealerId?: string;
  lookupClient: SupabaseClient;
}): Promise<TargetVehicleAuthResult | TargetVehicleAuthError> {
  const cleanVehicleId = (params.vehicleId || '').trim();
  if (!VALID_VEHICLE_ID_REGEX.test(cleanVehicleId)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_VEHICLE_ID',
      error: 'A valid vehicle identifier is required.',
    };
  }

  const { data: existingCar, error: carLookupError } = await params.lookupClient
    .from('cars')
    .select('id, dealer_id, gallery_image_1_url, gallery_image_2_url')
    .eq('id', cleanVehicleId)
    .maybeSingle();

  if (carLookupError) {
    return {
      ok: false,
      status: 500,
      code: 'VEHICLE_LOOKUP_FAILED',
      error: 'Unable to verify vehicle ownership at this time.',
    };
  }

  if (existingCar) {
    const ownerDealerId = String((existingCar as any).dealer_id || '').trim();
    if (params.actor.role === 'dealer') {
      if (!params.actor.dealerId || ownerDealerId !== String(params.actor.dealerId)) {
        return {
          ok: false,
          status: 403,
          code: 'VEHICLE_OWNERSHIP_REQUIRED',
          error: 'You do not have permission to upload or modify images for another dealership’s vehicle.',
        };
      }
    }

    const folderDealerId = sanitizeSegment(ownerDealerId || params.actor.dealerId || 'admin');
    return {
      ok: true,
      folderDealerId: folderDealerId || 'admin',
      isExistingVehicle: true,
      existingCar: existingCar as Record<string, any>,
    };
  }

  if (params.mode === 'edit') {
    return {
      ok: false,
      status: 404,
      code: 'VEHICLE_NOT_FOUND',
      error: 'The selected vehicle listing could not be found.',
    };
  }

  // New draft vehicle upload: Dealers are strictly pinned to their own dealer_id folder.
  if (params.actor.role === 'dealer') {
    const safeDealerFolder = sanitizeSegment(params.actor.dealerId || '');
    if (!safeDealerFolder) {
      return {
        ok: false,
        status: 403,
        code: 'DEALER_ROLE_REQUIRED',
        error: 'Valid dealership identifier is required.',
      };
    }
    return {
      ok: true,
      folderDealerId: safeDealerFolder,
      isExistingVehicle: false,
      existingCar: null,
    };
  }

  const requestedFolder = sanitizeSegment(params.requestedDealerId || '');
  return {
    ok: true,
    folderDealerId: requestedFolder || 'admin',
    isExistingVehicle: false,
    existingCar: null,
  };
}

async function persistVehicleSlotImage(params: {
  adminClient: SupabaseClient;
  vehicleId: string;
  slot: VehicleImageSlot;
  publicUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const column = params.slot === 'cabin' ? 'gallery_image_2_url' : 'gallery_image_1_url';
  const position = params.slot === 'cabin' ? 2 : 1;

  const { error: carUpdateError } = await params.adminClient
    .from('cars')
    .update({
      [column]: params.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.vehicleId);

  if (carUpdateError) {
    return {
      ok: false,
      error: carUpdateError.message || 'Failed to update vehicle image record.',
    };
  }

  try {
    await params.adminClient
      .from('car_images')
      .delete()
      .eq('car_id', params.vehicleId)
      .eq('position', position);

    if (params.publicUrl) {
      await params.adminClient.from('car_images').insert({
        car_id: params.vehicleId,
        image_url: params.publicUrl,
        position,
      });
    }
  } catch (err) {
    console.warn('[vehicleImages] Non-fatal car_images sync notice:', err);
  }

  return { ok: true };
}

export async function processAndStoreVehicleImage(params: {
  rawBuffer: Buffer;
  actor: AuthorizedVehicleImageActor;
  vehicleId: string;
  slot: VehicleImageSlot;
  mode?: string;
  requestedDealerId?: string;
  previousUrl?: string | null;
  adminClient: SupabaseClient | null;
}): Promise<{
  status: number;
  body: Record<string, any>;
}> {
  if (!VALID_SLOTS.has(params.slot)) {
    return {
      status: 400,
      body: { error: 'Invalid image slot. Expected front-exterior or cabin.', code: 'INVALID_SLOT' },
    };
  }

  const lookupClient = params.adminClient ?? params.actor.supabase;
  const authTarget = await authorizeVehicleTarget({
    actor: params.actor,
    vehicleId: params.vehicleId,
    mode: params.mode,
    requestedDealerId: params.requestedDealerId,
    lookupClient,
  });

  if (authTarget.ok === false) {
    return {
      status: authTarget.status,
      body: { error: authTarget.error, code: authTarget.code },
    };
  }

  // 1. Validate, decode, strip metadata & re-encode on server BEFORE touching Storage or credentials
  let processed;
  try {
    processed = await validateAndReencodeVehicleImage(params.rawBuffer);
  } catch (err: any) {
    if (err instanceof VehicleImageSecurityError) {
      return {
        status: err.statusCode,
        body: { error: err.message, code: err.code },
      };
    }
    return {
      status: 400,
      body: {
        error: 'Unable to validate or process the uploaded image.',
        code: 'DECODE_FAILED',
      },
    };
  }

  if (!params.adminClient) {
    return {
      status: 503,
      body: {
        error:
          'Server storage credentials (SUPABASE_SERVICE_ROLE_KEY) must be configured to upload verified vehicle images.',
        code: 'SERVER_STORAGE_CREDENTIALS_MISSING',
      },
    };
  }

  // 2. Upload newly generated UUID-named file into Storage (never overwrites old image prematurely)
  const cleanVehicleId = sanitizeSegment(params.vehicleId);
  const generatedFileName = `${params.slot}-${crypto.randomUUID()}.${processed.extension}`;
  const storagePath = authTarget.isExistingVehicle
    ? `${authTarget.folderDealerId}/${cleanVehicleId}/${generatedFileName}`
    : `${authTarget.folderDealerId}/drafts/${cleanVehicleId}/${generatedFileName}`;

  const { error: uploadError } = await params.adminClient.storage
    .from(VEHICLE_IMAGES_BUCKET)
    .upload(storagePath, processed.buffer, {
      contentType: processed.mimeType,
      cacheControl: '31536000',
      upsert: false,
    });

  if (uploadError) {
    return {
      status: 502,
      body: {
        error: uploadError.message || 'Failed to store validated image in Storage.',
        code: 'STORAGE_UPLOAD_FAILED',
      },
    };
  }

  const { data: publicUrlData } = params.adminClient.storage
    .from(VEHICLE_IMAGES_BUCKET)
    .getPublicUrl(storagePath);

  const publicUrl = publicUrlData?.publicUrl || '';
  if (!publicUrl) {
    await params.adminClient.storage.from(VEHICLE_IMAGES_BUCKET).remove([storagePath]).catch(() => {});
    return {
      status: 500,
      body: {
        error: 'Validated photo was uploaded, but its public URL could not be resolved.',
        code: 'PUBLIC_URL_RESOLUTION_FAILED',
      },
    };
  }

  const existingPreviousUrl = authTarget.isExistingVehicle
    ? (params.slot === 'cabin'
        ? authTarget.existingCar?.gallery_image_2_url
        : authTarget.existingCar?.gallery_image_1_url) || params.previousUrl
    : params.previousUrl;

  // 3. If editing an existing vehicle, update the DB record BEFORE deleting the old image
  if (authTarget.isExistingVehicle) {
    const dbSync = await persistVehicleSlotImage({
      adminClient: params.adminClient,
      vehicleId: cleanVehicleId,
      slot: params.slot,
      publicUrl,
    });

    if (dbSync.ok === false) {
      // Roll back newly uploaded object cleanly so failed replacements leave old record intact
      await params.adminClient.storage.from(VEHICLE_IMAGES_BUCKET).remove([storagePath]).catch(() => {});
      return {
        status: 500,
        body: {
          error: dbSync.error,
          code: 'VEHICLE_RECORD_UPDATE_FAILED',
        },
      };
    }
  }

  // 4. Only after new upload (and DB update) succeeded, remove previous Storage object inside same dealer folder
  const previousStoragePath = extractVehicleImageStoragePath(existingPreviousUrl);
  if (
    previousStoragePath &&
    previousStoragePath !== storagePath &&
    previousStoragePath.startsWith(`${authTarget.folderDealerId}/`)
  ) {
    await params.adminClient.storage
      .from(VEHICLE_IMAGES_BUCKET)
      .remove([previousStoragePath])
      .catch((err) => {
        console.warn('[vehicleImages] Non-fatal previous image cleanup notice:', err);
      });
  }

  return {
    status: 200,
    body: {
      publicUrl,
      storagePath,
      originalSizeBytes: processed.originalBytes,
      optimizedSizeBytes: processed.outputBytes,
      width: processed.width,
      height: processed.height,
      mimeType: processed.mimeType,
    },
  };
}

const router = Router();

router.post(
  '/upload',
  requireVehicleImageUploader,
  vehicleImageUploadLimiter,
  (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware.single('file')(req, res, (err: any) => {
      if (!err) {
        next();
        return;
      }
      if (err?.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          error: `Raw image upload exceeds the ${Math.round(MAX_RAW_UPLOAD_BYTES / (1024 * 1024))} MB limit.`,
          code: 'RAW_FILE_TOO_LARGE',
        });
        return;
      }
      res.status(400).json({
        error: err?.message || 'Invalid multipart image upload request.',
        code: 'INVALID_MULTIPART_UPLOAD',
      });
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = req.auth;
    if (!auth?.user || !auth.supabase || (auth.role !== 'dealer' && auth.role !== 'admin')) {
      res.status(403).json({ error: 'Authorized dealership session required.', code: 'FORBIDDEN' });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file || !Buffer.isBuffer(file.buffer)) {
      res.status(400).json({ error: 'Image file is required.', code: 'EMPTY_FILE' });
      return;
    }

    const slot = String(req.body?.slot || '') as VehicleImageSlot;
    const vehicleId = String(req.body?.vehicleId || '');
    const mode = req.body?.mode ? String(req.body.mode) : undefined;
    const requestedDealerId = req.body?.dealerId ? String(req.body.dealerId) : undefined;
    const previousUrl = req.body?.previousUrl ? String(req.body.previousUrl) : null;

    const result = await processAndStoreVehicleImage({
      rawBuffer: file.buffer,
      actor: {
        userId: auth.user.id,
        role: auth.role,
        dealerId: auth.dealerId,
        supabase: auth.supabase,
      },
      vehicleId,
      slot,
      mode,
      requestedDealerId,
      previousUrl,
      adminClient: getSupabaseAdminClient(),
    });

    res.status(result.status).json(result.body);
  }
);

router.post(
  '/import-url',
  requireVehicleImageUploader,
  vehicleImageUploadLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = req.auth;
    if (!auth?.user || !auth.supabase || (auth.role !== 'dealer' && auth.role !== 'admin')) {
      res.status(403).json({ error: 'Authorized dealership session required.', code: 'FORBIDDEN' });
      return;
    }

    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const slot = String(req.body?.slot || '') as VehicleImageSlot;
    const vehicleId = String(req.body?.vehicleId || '');
    const mode = req.body?.mode ? String(req.body.mode) : undefined;
    const requestedDealerId = req.body?.dealerId ? String(req.body.dealerId) : undefined;
    const previousUrl = req.body?.previousUrl ? String(req.body.previousUrl) : null;

    if (!VALID_SLOTS.has(slot)) {
      res.status(400).json({
        error: 'Invalid image slot. Expected front-exterior or cabin.',
        code: 'INVALID_SLOT',
      });
      return;
    }

    // Verify ownership/role BEFORE making any outbound network call
    const adminClient = getSupabaseAdminClient();
    const authTarget = await authorizeVehicleTarget({
      actor: {
        userId: auth.user.id,
        role: auth.role,
        dealerId: auth.dealerId,
        supabase: auth.supabase,
      },
      vehicleId,
      mode,
      requestedDealerId,
      lookupClient: adminClient ?? auth.supabase,
    });

    if (authTarget.ok === false) {
      res.status(authTarget.status).json({ error: authTarget.error, code: authTarget.code });
      return;
    }

    let fetchedBuffer: Buffer;
    try {
      const remote = await fetchSafeRemoteImageBuffer(rawUrl);
      fetchedBuffer = remote.buffer;
    } catch (err: any) {
      if (err instanceof VehicleImageSecurityError) {
        res.status(err.statusCode).json({ error: err.message, code: err.code });
        return;
      }
      res.status(400).json({
        error: 'Unable to fetch the remote image URL safely.',
        code: 'REMOTE_IMAGE_FETCH_FAILED',
      });
      return;
    }

    const result = await processAndStoreVehicleImage({
      rawBuffer: fetchedBuffer,
      actor: {
        userId: auth.user.id,
        role: auth.role,
        dealerId: auth.dealerId,
        supabase: auth.supabase,
      },
      vehicleId,
      slot,
      mode,
      requestedDealerId,
      previousUrl,
      adminClient,
    });

    res.status(result.status).json(result.body);
  }
);

router.delete(
  '/',
  requireVehicleImageUploader,
  vehicleImageUploadLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = req.auth;
    if (!auth?.user || !auth.supabase || (auth.role !== 'dealer' && auth.role !== 'admin')) {
      res.status(403).json({ error: 'Authorized dealership session required.', code: 'FORBIDDEN' });
      return;
    }

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) {
      res.status(503).json({
        error: 'Server storage credentials (SUPABASE_SERVICE_ROLE_KEY) must be configured.',
        code: 'SERVER_STORAGE_CREDENTIALS_MISSING',
      });
      return;
    }

    const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
    const rawPath = typeof req.body?.storagePath === 'string' ? req.body.storagePath : '';
    const vehicleId = typeof req.body?.vehicleId === 'string' ? req.body.vehicleId.trim() : '';
    const slot = typeof req.body?.slot === 'string' ? (req.body.slot as VehicleImageSlot) : undefined;

    const storagePath = rawPath.trim() || extractVehicleImageStoragePath(rawUrl) || '';
    if (!storagePath || storagePath.includes('..') || storagePath.includes('\\')) {
      res.status(400).json({ error: 'Valid storage path is required.', code: 'INVALID_STORAGE_PATH' });
      return;
    }

    if (auth.role === 'dealer') {
      const safeDealerFolder = sanitizeSegment(auth.dealerId || '');
      if (!safeDealerFolder || !storagePath.startsWith(`${safeDealerFolder}/`)) {
        res.status(403).json({
          error: 'You can only remove images inside your own dealership folder.',
          code: 'VEHICLE_OWNERSHIP_REQUIRED',
        });
        return;
      }
    }

    if (vehicleId && VALID_VEHICLE_ID_REGEX.test(vehicleId)) {
      const authTarget = await authorizeVehicleTarget({
        actor: {
          userId: auth.user.id,
          role: auth.role,
          dealerId: auth.dealerId,
          supabase: auth.supabase,
        },
        vehicleId,
        mode: 'edit',
        lookupClient: adminClient,
      });

      if (authTarget.ok === false && authTarget.code === 'VEHICLE_OWNERSHIP_REQUIRED') {
        res.status(403).json({ error: authTarget.error, code: authTarget.code });
        return;
      }

      if (authTarget.ok && authTarget.isExistingVehicle && slot && VALID_SLOTS.has(slot)) {
        const dbSync = await persistVehicleSlotImage({
          adminClient,
          vehicleId,
          slot,
          publicUrl: '',
        });
        if (dbSync.ok === false) {
          res.status(500).json({ error: dbSync.error, code: 'VEHICLE_RECORD_UPDATE_FAILED' });
          return;
        }
      }
    }

    const { error: removeError } = await adminClient.storage
      .from(VEHICLE_IMAGES_BUCKET)
      .remove([storagePath]);

    if (removeError) {
      res.status(502).json({
        error: removeError.message || 'Failed to delete vehicle image from Storage.',
        code: 'STORAGE_DELETE_FAILED',
      });
      return;
    }

    res.json({ deleted: true, storagePath });
  }
);

export const vehicleImagesRouter = router;
