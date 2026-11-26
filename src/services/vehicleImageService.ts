import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  MAX_VEHICLE_IMAGE_BYTES,
  optimizeVehicleImage,
  VehicleImageErrorCode,
} from '../utils/imageOptimizer';
import {
  extractVehicleImageStoragePath,
  VEHICLE_IMAGES_BUCKET,
} from '../utils/vehicleImageUrl';

export { VEHICLE_IMAGES_BUCKET };
export type VehicleImageSlot = 'front-exterior' | 'cabin';

const MAX_CLIENT_RAW_TRANSFER_BYTES = 4 * 1024 * 1024; // 4 MB server raw upload limit

export interface VehicleImageUploadResult {
  publicUrl: string;
  storagePath: string;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  width: number;
  height: number;
  mimeType: string;
}

export class VehicleImageUploadError extends Error {
  public readonly code: VehicleImageErrorCode;
  constructor(message: string, code: VehicleImageErrorCode = 'UPLOAD_FAILED') {
    super(message);
    this.name = 'VehicleImageUploadError';
    this.code = code;
  }
}

function sanitizePathSegment(value: string): string {
  return (value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
}

function getExtensionFromMimeType(mimeType: string): string {
  const normalized = (mimeType || '').toLowerCase();
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/png') return 'png';
  return 'jpg';
}

export function buildVehicleImageStoragePath(
  dealerId: string,
  vehicleId: string,
  slot: VehicleImageSlot,
  mimeType: string
): string {
  const safeDealerId = sanitizePathSegment(dealerId);
  const safeVehicleId = sanitizePathSegment(vehicleId);
  if (!safeDealerId || !safeVehicleId) {
    throw new VehicleImageUploadError(
      'Missing dealer or vehicle identifier for image upload.',
      'UPLOAD_FAILED'
    );
  }
  const safeSlot: VehicleImageSlot = slot === 'cabin' ? 'cabin' : 'front-exterior';
  const ext = getExtensionFromMimeType(mimeType);
  return `${safeDealerId}/${safeVehicleId}/${safeSlot}.${ext}`;
}

export function extractStoragePathFromPublicUrl(url?: string | null): string | null {
  return extractVehicleImageStoragePath(url);
}

export function canActorModifyVehicleImages(params: {
  isAdmin: boolean;
  isGamePlayer: boolean;
  isApprovedDealer: boolean;
  actorDealerId?: string | null;
  targetDealerId: string;
}): { allowed: boolean; reason?: string } {
  if (params.isGamePlayer) {
    return {
      allowed: false,
      reason: 'Game Player accounts cannot upload or modify dealership vehicle photos.',
    };
  }
  if (params.isAdmin) {
    return { allowed: true };
  }
  if (!params.isApprovedDealer) {
    return {
      allowed: false,
      reason: 'Only approved active dealerships can upload vehicle photos.',
    };
  }
  const actorFolder = sanitizePathSegment(params.actorDealerId || '');
  const targetFolder = sanitizePathSegment(params.targetDealerId || '');
  if (!actorFolder || !targetFolder || actorFolder !== targetFolder) {
    return {
      allowed: false,
      reason: 'You can only upload or modify vehicle photos inside your own dealership folder.',
    };
  }
  return { allowed: true };
}

async function getAccessTokenOrThrow(): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new VehicleImageUploadError(
      'Supabase authentication is not configured. Please check connection settings.',
      'UPLOAD_FAILED'
    );
  }

  const { data: sessionRes } = await supabase.auth.getSession();
  const accessToken = sessionRes?.session?.access_token;
  if (!accessToken) {
    throw new VehicleImageUploadError(
      'Your sign-in session has expired. Please sign in again before uploading photos.',
      'UPLOAD_FAILED'
    );
  }
  return accessToken;
}

function mapServerErrorToUploadError(
  body: any,
  fallbackMessage: string
): VehicleImageUploadError {
  const code = String(body?.code || '');
  const msg = String(body?.error || fallbackMessage);

  if (code === 'IMAGE_TOO_LARGE_AFTER_COMPRESSION') {
    return new VehicleImageUploadError(
      'Image is still too large to upload. You can reduce its size using TinyPNG and try again.',
      'IMAGE_TOO_LARGE_AFTER_COMPRESSION'
    );
  }
  if (
    code === 'SVG_NOT_ALLOWED' ||
    code === 'ANIMATED_IMAGE_NOT_ALLOWED' ||
    code === 'UNSUPPORTED_IMAGE_FORMAT'
  ) {
    return new VehicleImageUploadError(msg, 'INVALID_IMAGE_TYPE');
  }
  if (code === 'DECODE_FAILED' || code === 'EMPTY_FILE') {
    return new VehicleImageUploadError(msg, 'CORRUPT_IMAGE');
  }
  return new VehicleImageUploadError(msg, 'UPLOAD_FAILED');
}

export async function deleteVehicleImageByUrl(
  url?: string | null,
  options?: { vehicleId?: string; slot?: VehicleImageSlot }
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const storagePath = extractStoragePathFromPublicUrl(url);
  if (!storagePath) return;

  try {
    const { data: sessionRes } = await supabase.auth.getSession();
    const accessToken = sessionRes?.session?.access_token;
    if (!accessToken) return;

    const res = await fetch('/api/dealer/vehicles/images', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        storagePath,
        url,
        vehicleId: options?.vehicleId,
        slot: options?.slot,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.warn(
        '[vehicleImageService.deleteVehicleImageByUrl] Remove warning:',
        body?.error || `HTTP ${res.status}`
      );
    }
  } catch (err) {
    console.warn('[vehicleImageService.deleteVehicleImageByUrl] Remove exception:', err);
  }
}

/**
 * Uploads a vehicle image strictly through the authenticated MANIFOLD backend pipeline
 * (/api/dealer/vehicles/images/upload). Client-side optimization runs only as a UX
 * pre-shrink step so large camera files fit cleanly under the 4 MB server raw cap.
 */
export async function uploadVehicleImage(params: {
  file: File;
  dealerId: string;
  vehicleId: string;
  slot: VehicleImageSlot;
  mode?: 'create' | 'edit';
  previousUrl?: string | null;
}): Promise<VehicleImageUploadResult> {
  const accessToken = await getAccessTokenOrThrow();

  let fileToUpload: File = params.file;
  let originalSizeBytes = params.file.size;

  // Client-side optimization is strictly UX; the server re-validates, decodes, strips metadata,
  // and enforces the 100 KB limit authoritatively.
  try {
    const optimized = await optimizeVehicleImage(params.file);
    if (optimized.optimizedSizeBytes <= MAX_VEHICLE_IMAGE_BYTES) {
      fileToUpload = optimized.file;
    } else if (params.file.size > MAX_CLIENT_RAW_TRANSFER_BYTES) {
      throw new VehicleImageUploadError(
        'Image is still too large to upload. You can reduce its size using TinyPNG and try again.',
        'IMAGE_TOO_LARGE_AFTER_COMPRESSION'
      );
    }
  } catch (err: any) {
    if (
      err?.code === 'INVALID_IMAGE_TYPE' ||
      err?.code === 'CORRUPT_IMAGE'
    ) {
      throw err;
    }
    if (
      err?.code === 'IMAGE_TOO_LARGE_AFTER_COMPRESSION' &&
      params.file.size > MAX_CLIENT_RAW_TRANSFER_BYTES
    ) {
      throw err;
    }
    if (params.file.size > MAX_CLIENT_RAW_TRANSFER_BYTES) {
      throw new VehicleImageUploadError(
        'Selected image exceeds the 4 MB upload transfer limit. Please choose a smaller photo.',
        'UPLOAD_FAILED'
      );
    }
  }

  const formData = new FormData();
  formData.append('file', fileToUpload);
  formData.append('dealerId', params.dealerId);
  formData.append('vehicleId', params.vehicleId);
  formData.append('slot', params.slot);
  if (params.mode) {
    formData.append('mode', params.mode);
  }
  if (params.previousUrl) {
    formData.append('previousUrl', params.previousUrl);
  }

  const response = await fetch('/api/dealer/vehicles/images/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw mapServerErrorToUploadError(
      body,
      `Image upload failed (HTTP ${response.status}).`
    );
  }

  return {
    publicUrl: String(body.publicUrl),
    storagePath: String(body.storagePath),
    originalSizeBytes: Number(body.originalSizeBytes || originalSizeBytes),
    optimizedSizeBytes: Number(body.optimizedSizeBytes || 0),
    width: Number(body.width || 0),
    height: Number(body.height || 0),
    mimeType: String(body.mimeType || 'image/webp'),
  };
}

/**
 * Imports an external image URL strictly through the SSRF-protected server endpoint
 * (/api/dealer/vehicles/images/import-url), which downloads, validates, decodes,
 * re-encodes <= 100 KB, and stores the verified output in MANIFOLD Storage.
 */
export async function importVehicleImageFromUrl(params: {
  url: string;
  dealerId: string;
  vehicleId: string;
  slot: VehicleImageSlot;
  mode?: 'create' | 'edit';
  previousUrl?: string | null;
}): Promise<VehicleImageUploadResult> {
  const accessToken = await getAccessTokenOrThrow();

  const response = await fetch('/api/dealer/vehicles/images/import-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      url: params.url,
      dealerId: params.dealerId,
      vehicleId: params.vehicleId,
      slot: params.slot,
      mode: params.mode,
      previousUrl: params.previousUrl || undefined,
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw mapServerErrorToUploadError(
      body,
      `Remote image verification failed (HTTP ${response.status}).`
    );
  }

  return {
    publicUrl: String(body.publicUrl),
    storagePath: String(body.storagePath),
    originalSizeBytes: Number(body.originalSizeBytes || 0),
    optimizedSizeBytes: Number(body.optimizedSizeBytes || 0),
    width: Number(body.width || 0),
    height: Number(body.height || 0),
    mimeType: String(body.mimeType || 'image/webp'),
  };
}
