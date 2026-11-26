import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  MAX_VEHICLE_IMAGE_BYTES,
  OptimizedVehicleImageResult,
  optimizeVehicleImage,
  VehicleImageErrorCode,
} from '../utils/imageOptimizer';

export const VEHICLE_IMAGES_BUCKET = 'vehicle-images';
export type VehicleImageSlot = 'front-exterior' | 'cabin';

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
  const trimmed = (url || '').trim();
  if (!trimmed) return null;

  const marker = `/storage/v1/object/public/${VEHICLE_IMAGES_BUCKET}/`;
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return null;

  const afterMarker = trimmed.slice(idx + marker.length);
  const withoutQuery = afterMarker.split('?')[0].split('#')[0];
  const decoded = decodeURIComponent(withoutQuery).replace(/^\/+/, '');
  if (!decoded || decoded.includes('..')) return null;
  return decoded;
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

export async function deleteVehicleImageByUrl(url?: string | null): Promise<void> {
  if (!isSupabaseConfigured) return;
  const storagePath = extractStoragePathFromPublicUrl(url);
  if (!storagePath) return;

  try {
    const { error } = await supabase.storage.from(VEHICLE_IMAGES_BUCKET).remove([storagePath]);
    if (error) {
      console.warn('[vehicleImageService.deleteVehicleImageByUrl] Remove warning:', error.message);
    }
  } catch (err) {
    console.warn('[vehicleImageService.deleteVehicleImageByUrl] Remove exception:', err);
  }
}

export async function uploadVehicleImage(params: {
  file: File;
  dealerId: string;
  vehicleId: string;
  slot: VehicleImageSlot;
  previousUrl?: string | null;
}): Promise<VehicleImageUploadResult> {
  if (!isSupabaseConfigured) {
    throw new VehicleImageUploadError(
      'Supabase Storage is not configured. Please check connection settings.',
      'UPLOAD_FAILED'
    );
  }

  let optimized: OptimizedVehicleImageResult;
  try {
    optimized = await optimizeVehicleImage(params.file);
  } catch (err: any) {
    if (err?.code) {
      throw err;
    }
    throw new VehicleImageUploadError(
      err?.message || 'Unable to process this image before upload.',
      'UPLOAD_FAILED'
    );
  }

  if (optimized.optimizedSizeBytes > MAX_VEHICLE_IMAGE_BYTES) {
    throw new VehicleImageUploadError(
      'Image is still too large to upload. You can reduce its size using TinyPNG and try again.',
      'IMAGE_TOO_LARGE_AFTER_COMPRESSION'
    );
  }

  const storagePath = buildVehicleImageStoragePath(
    params.dealerId,
    params.vehicleId,
    params.slot,
    optimized.mimeType
  );

  const { data: sessionRes } = await supabase.auth.getSession();
  if (!sessionRes?.session?.user) {
    throw new VehicleImageUploadError(
      'Your sign-in session has expired. Please sign in again before uploading photos.',
      'UPLOAD_FAILED'
    );
  }

  const { error: uploadError } = await supabase.storage
    .from(VEHICLE_IMAGES_BUCKET)
    .upload(storagePath, optimized.file, {
      cacheControl: '3600',
      contentType: optimized.mimeType,
      upsert: true,
    });

  if (uploadError) {
    const msg = uploadError.message || 'Storage upload failed.';
    if (/row-level security|permission|unauthorized|forbidden|403/i.test(msg)) {
      throw new VehicleImageUploadError(
        'Upload permission denied. Please verify your dealership account is active and approved.',
        'UPLOAD_FAILED'
      );
    }
    throw new VehicleImageUploadError(`Upload failed: ${msg}`, 'UPLOAD_FAILED');
  }

  const { data: publicUrlData } = supabase.storage
    .from(VEHICLE_IMAGES_BUCKET)
    .getPublicUrl(storagePath);

  const rawPublicUrl = publicUrlData?.publicUrl || '';
  if (!rawPublicUrl) {
    throw new VehicleImageUploadError(
      'Photo uploaded, but its public URL could not be resolved.',
      'UPLOAD_FAILED'
    );
  }

  // Delete previous Storage object if it used a different extension/path
  const previousStoragePath = extractStoragePathFromPublicUrl(params.previousUrl);
  if (previousStoragePath && previousStoragePath !== storagePath) {
    await deleteVehicleImageByUrl(params.previousUrl);
  }

  const cacheBustedUrl = `${rawPublicUrl}${rawPublicUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;

  return {
    publicUrl: cacheBustedUrl,
    storagePath,
    originalSizeBytes: optimized.originalSizeBytes,
    optimizedSizeBytes: optimized.optimizedSizeBytes,
    width: optimized.width,
    height: optimized.height,
    mimeType: optimized.mimeType,
  };
}
