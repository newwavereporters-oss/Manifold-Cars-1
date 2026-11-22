import { extractYouTubeVideoId, getYouTubeFallbackThumbnailUrl } from './youtube';

export const DEALER_MARKETING_WHATSAPP_NUMBER = '+2348169664607';
export const DEALER_MARKETING_WHATSAPP_URL =
  'https://wa.me/2348169664607?text=Hello%20MANIFOLD%2C%20I%27m%20interested%20in%20your%20dealer%20marketing%20and%20professional%20car%20content%20services.';

export const DEALER_MARKETING_SERVICES = [
  'Car Social Media Setup and Management',
  'Professional Vehicle Photography and Video Production',
  'Car Listing YouTube Channel Management',
] as const;

export function generateUuid(): string {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Fall through to deterministic RFC-4122 v4 fallback
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

export function normalizeVehicleCondition(raw?: string | null): 'Foreign Used' | 'Nigerian Used' | 'Brand New' {
  const cleaned = (raw || '').trim().toLowerCase();
  if (!cleaned || cleaned.includes('foreign') || cleaned.includes('tokunbo')) {
    return 'Foreign Used';
  }
  if (cleaned.includes('nigerian') || cleaned.includes('local')) {
    return 'Nigerian Used';
  }
  if (cleaned.includes('brand') || cleaned === 'new') {
    return 'Brand New';
  }
  return 'Foreign Used';
}

/**
 * MANIFOLD Title Rule (Part 9):
 * Vehicle listing title must strictly represent the actual vehicle Make + Model
 * (e.g., "Toyota Camry"). Year and trim/variant belong in dedicated metadata fields.
 */
export function buildVehicleModelTitle(make?: string | null, model?: string | null): string {
  const cleanMake = (make || '').trim();
  const cleanModel = (model || '').trim();
  if (cleanMake && cleanModel) {
    if (cleanModel.toLowerCase().startsWith(cleanMake.toLowerCase())) {
      return cleanModel;
    }
    return `${cleanMake} ${cleanModel}`;
  }
  return cleanMake || cleanModel || 'Vehicle';
}

export type CarVideoAvailability = 'available' | 'missing';

export interface CarMediaLike {
  video?: {
    youtube_video_id?: string | null;
    youtube_url?: string | null;
    youtube_thumbnail_url?: string | null;
    video_duration?: string | null;
  } | null;
  youtube_video_id?: string | null;
  youtube_url?: string | null;
  youtube_thumbnail_url?: string | null;
  gallery_image_1_url?: string | null;
  gallery_image_2_url?: string | null;
}

export function resolveCarYouTubeVideoId(car?: CarMediaLike | null): string {
  if (!car) return '';
  const directId = (car.video?.youtube_video_id || car.youtube_video_id || '').trim();
  if (directId && /^[a-zA-Z0-9_-]{11}$/.test(directId)) {
    return directId;
  }
  const urlCandidate = (car.video?.youtube_url || car.youtube_url || '').trim();
  return extractYouTubeVideoId(urlCandidate) || '';
}

export function getCarVideoAvailability(car?: CarMediaLike | null): CarVideoAvailability {
  return resolveCarYouTubeVideoId(car) ? 'available' : 'missing';
}

export function getCarCardPrimaryImage(car?: CarMediaLike | null): string {
  if (!car) return '';
  const videoId = resolveCarYouTubeVideoId(car);
  if (videoId) {
    return (
      car.video?.youtube_thumbnail_url ||
      car.youtube_thumbnail_url ||
      getYouTubeFallbackThumbnailUrl(videoId)
    );
  }
  return (car.gallery_image_1_url || car.gallery_image_2_url || '').trim();
}
