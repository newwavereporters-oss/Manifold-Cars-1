export const MAX_VEHICLE_IMAGE_BYTES = 102400; // Strictly 100 KB (102,400 bytes)
export const TARGET_MIN_VEHICLE_IMAGE_BYTES = 80 * 1024;
export const TARGET_MAX_VEHICLE_IMAGE_BYTES = 95 * 1024;
export const MAX_VEHICLE_IMAGE_WIDTH = 1200;
export const MAX_VEHICLE_IMAGE_HEIGHT = 900;

export const ALLOWED_VEHICLE_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedVehicleImageMimeType = (typeof ALLOWED_VEHICLE_IMAGE_MIME_TYPES)[number];

export const TINYPNG_URL = 'https://tinypng.com/';
export const TINYPNG_HINT_MESSAGE =
  'Image is still too large to upload. You can reduce its size using TinyPNG and try again.';

export type VehicleImageErrorCode =
  | 'INVALID_IMAGE_TYPE'
  | 'CORRUPT_IMAGE'
  | 'IMAGE_TOO_LARGE_AFTER_COMPRESSION'
  | 'UPLOAD_FAILED';

export class InvalidImageTypeError extends Error {
  public readonly code: VehicleImageErrorCode = 'INVALID_IMAGE_TYPE';
  constructor(message = 'Please select a valid JPG, JPEG, PNG, or WebP image.') {
    super(message);
    this.name = 'InvalidImageTypeError';
  }
}

export class CorruptImageError extends Error {
  public readonly code: VehicleImageErrorCode = 'CORRUPT_IMAGE';
  constructor(message = 'This image file appears empty or unreadable. Please choose another photo.') {
    super(message);
    this.name = 'CorruptImageError';
  }
}

export class ImageTooLargeAfterCompressionError extends Error {
  public readonly code: VehicleImageErrorCode = 'IMAGE_TOO_LARGE_AFTER_COMPRESSION';
  public readonly compressedSizeBytes?: number;
  constructor(compressedSizeBytes?: number) {
    super(TINYPNG_HINT_MESSAGE);
    this.name = 'ImageTooLargeAfterCompressionError';
    this.compressedSizeBytes = compressedSizeBytes;
  }
}

export function shouldShowTinyPngHint(errorCode?: string | null): boolean {
  return errorCode === 'IMAGE_TOO_LARGE_AFTER_COMPRESSION';
}

export function validateVehicleImageFile(file: {
  name: string;
  type?: string;
  size: number;
}): AllowedVehicleImageMimeType {
  if (!file || typeof file.size !== 'number' || file.size <= 0) {
    throw new CorruptImageError();
  }

  const normalizedType = (file.type || '').trim().toLowerCase();
  if (normalizedType === 'image/jpg' || normalizedType === 'image/jpeg') {
    return 'image/jpeg';
  }
  if (normalizedType === 'image/png') {
    return 'image/png';
  }
  if (normalizedType === 'image/webp') {
    return 'image/webp';
  }

  // Some mobile pickers leave file.type empty; allow extension match only when MIME is absent
  if (!normalizedType) {
    const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
  }

  throw new InvalidImageTypeError(
    'Unsupported image format. Only JPG, JPEG, PNG, and WebP photos are allowed.'
  );
}

export function calculateFitDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth = MAX_VEHICLE_IMAGE_WIDTH,
  maxHeight = MAX_VEHICLE_IMAGE_HEIGHT
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    throw new CorruptImageError('Image has invalid dimensions.');
  }

  const ratio = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);
  return {
    width: Math.max(1, Math.round(naturalWidth * ratio)),
    height: Math.max(1, Math.round(naturalHeight * ratio)),
  };
}

export function formatFileSizeKb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export interface OptimizedVehicleImageResult {
  file: File;
  blob: Blob;
  mimeType: AllowedVehicleImageMimeType;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  width: number;
  height: number;
}

interface DecodedImageSource {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  cleanup: () => void;
}

async function decodeImageFile(file: File): Promise<DecodedImageSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      if (bitmap.width > 0 && bitmap.height > 0) {
        return {
          width: bitmap.width,
          height: bitmap.height,
          draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
          cleanup: () => {
            try {
              bitmap.close();
            } catch {
              // ignore
            }
          },
        };
      }
      bitmap.close();
    } catch {
      // Fallback to HTMLImageElement
    }
  }

  if (typeof Image === 'undefined' || typeof URL === 'undefined') {
    throw new CorruptImageError('Browser image decoding is unavailable.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new CorruptImageError());
      el.src = objectUrl;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w <= 0 || h <= 0) {
      throw new CorruptImageError();
    }

    return {
      width: w,
      height: h,
      draw: (ctx, targetW, targetH) => ctx.drawImage(img, 0, 0, targetW, targetH),
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err instanceof CorruptImageError ? err : new CorruptImageError();
  }
}

async function encodeCanvasBlob(
  canvas: HTMLCanvasElement,
  mimeType: 'image/webp' | 'image/jpeg',
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function mimeToExt(mime: AllowedVehicleImageMimeType): string {
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/png') return 'png';
  return 'jpg';
}

export async function optimizeVehicleImage(file: File): Promise<OptimizedVehicleImageResult> {
  const inputMime = validateVehicleImageFile(file);
  const decoded = await decodeImageFile(file);

  try {
    const baseDims = calculateFitDimensions(decoded.width, decoded.height);

    // Preserve already-optimal WebP/JPEG/PNG files when both dimensions and file size are within bounds
    if (
      file.size <= MAX_VEHICLE_IMAGE_BYTES &&
      decoded.width <= MAX_VEHICLE_IMAGE_WIDTH &&
      decoded.height <= MAX_VEHICLE_IMAGE_HEIGHT
    ) {
      return {
        file,
        blob: file,
        mimeType: inputMime,
        originalSizeBytes: file.size,
        optimizedSizeBytes: file.size,
        width: decoded.width,
        height: decoded.height,
      };
    }

    if (typeof document === 'undefined') {
      throw new CorruptImageError('Image canvas processing is unavailable in this environment.');
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new CorruptImageError('Unable to initialize image processor.');
    }

    let smallestBlob: {
      blob: Blob;
      mimeType: AllowedVehicleImageMimeType;
      width: number;
      height: number;
    } | null = null;

    const scalePasses = [1, 0.85, 0.72, 0.6];
    const webpQualities = [0.86, 0.78, 0.7, 0.62, 0.54];
    const jpegQualities = [0.82, 0.72, 0.62, 0.54];

    for (const scale of scalePasses) {
      const targetW = Math.max(1, Math.round(baseDims.width * scale));
      const targetH = Math.max(1, Math.round(baseDims.height * scale));
      if (scale < 1 && Math.max(targetW, targetH) < 560 && Math.max(baseDims.width, baseDims.height) >= 560) {
        continue;
      }

      canvas.width = targetW;
      canvas.height = targetH;
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      decoded.draw(ctx, targetW, targetH);

      for (const quality of webpQualities) {
        const blob = await encodeCanvasBlob(canvas, 'image/webp', quality);
        if (!blob || blob.size <= 0) continue;
        // Verify browser actually encoded WebP (Safari fallback encodes image/png)
        const actualMime = (blob.type || 'image/webp').toLowerCase();
        if (actualMime === 'image/webp') {
          if (!smallestBlob || blob.size < smallestBlob.blob.size) {
            smallestBlob = { blob, mimeType: 'image/webp', width: targetW, height: targetH };
          }
          if (blob.size <= TARGET_MAX_VEHICLE_IMAGE_BYTES) {
            const outFile = new File([blob], `vehicle.${mimeToExt('image/webp')}`, {
              type: 'image/webp',
            });
            return {
              file: outFile,
              blob,
              mimeType: 'image/webp',
              originalSizeBytes: file.size,
              optimizedSizeBytes: blob.size,
              width: targetW,
              height: targetH,
            };
          }
          if (blob.size <= MAX_VEHICLE_IMAGE_BYTES) {
            const outFile = new File([blob], `vehicle.${mimeToExt('image/webp')}`, {
              type: 'image/webp',
            });
            return {
              file: outFile,
              blob,
              mimeType: 'image/webp',
              originalSizeBytes: file.size,
              optimizedSizeBytes: blob.size,
              width: targetW,
              height: targetH,
            };
          }
        }
      }

      for (const quality of jpegQualities) {
        const blob = await encodeCanvasBlob(canvas, 'image/jpeg', quality);
        if (!blob || blob.size <= 0) continue;
        if (!smallestBlob || blob.size < smallestBlob.blob.size) {
          smallestBlob = { blob, mimeType: 'image/jpeg', width: targetW, height: targetH };
        }
        if (blob.size <= MAX_VEHICLE_IMAGE_BYTES) {
          const outFile = new File([blob], 'vehicle.jpg', { type: 'image/jpeg' });
          return {
            file: outFile,
            blob,
            mimeType: 'image/jpeg',
            originalSizeBytes: file.size,
            optimizedSizeBytes: blob.size,
            width: targetW,
            height: targetH,
          };
        }
      }
    }

    // If original file itself is <= 100 KB and canvas outputs grew slightly, keep original
    if (file.size <= MAX_VEHICLE_IMAGE_BYTES) {
      return {
        file,
        blob: file,
        mimeType: inputMime,
        originalSizeBytes: file.size,
        optimizedSizeBytes: file.size,
        width: decoded.width,
        height: decoded.height,
      };
    }

    throw new ImageTooLargeAfterCompressionError(smallestBlob?.blob.size);
  } finally {
    decoded.cleanup();
  }
}
