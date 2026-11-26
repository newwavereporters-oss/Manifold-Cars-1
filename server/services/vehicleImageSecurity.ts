import sharp, { type Metadata } from 'sharp';

// Bound Sharp/libvips resources safely for Node & Vercel serverless runtimes
sharp.concurrency(1);
sharp.cache(false);

export const MAX_RAW_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB raw limit (fits inside Vercel serverless payload cap)
export const MAX_FINAL_IMAGE_BYTES = 102_400; // 100 KB exact Supabase bucket limit
export const MAX_INPUT_WIDTH = 6000;
export const MAX_INPUT_HEIGHT = 6000;
export const MAX_INPUT_PIXELS = 24_000_000; // 24 MP decompression bomb limit
export const TARGET_MAX_WIDTH = 1200;
export const TARGET_MAX_HEIGHT = 900;
export const PROCESSING_TIMEOUT_MS = 10_000;
export const PROCESSING_TIMEOUT_SECONDS = 10;

export type VehicleImageSecurityErrorCode =
  | 'EMPTY_FILE'
  | 'RAW_FILE_TOO_LARGE'
  | 'UNSUPPORTED_IMAGE_FORMAT'
  | 'SVG_NOT_ALLOWED'
  | 'ANIMATED_IMAGE_NOT_ALLOWED'
  | 'EXCESSIVE_DIMENSIONS'
  | 'DECODE_FAILED'
  | 'PROCESSING_TIMEOUT'
  | 'IMAGE_TOO_LARGE_AFTER_COMPRESSION';

export class VehicleImageSecurityError extends Error {
  public readonly code: VehicleImageSecurityErrorCode;
  public readonly statusCode: number;

  constructor(
    message: string,
    code: VehicleImageSecurityErrorCode,
    statusCode = 400
  ) {
    super(message);
    this.name = 'VehicleImageSecurityError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface ProcessedVehicleImage {
  buffer: Buffer;
  mimeType: 'image/webp' | 'image/jpeg';
  extension: 'webp' | 'jpg';
  width: number;
  height: number;
  inputFormat: 'jpeg' | 'png' | 'webp';
  originalBytes: number;
  outputBytes: number;
}

const ALLOWED_INPUT_FORMATS = new Set(['jpeg', 'png', 'webp']);

/**
 * Early non-image signature pre-filter.
 * NOTE: This is ONLY an early fast-reject heuristic; real validation ALWAYS requires
 * full libvips/Sharp decoding and metadata verification below.
 */
function inspectDisallowedPayloadSignatures(buffer: Buffer): void {
  const head = buffer.subarray(0, 512);
  const headText = head
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .trimStart()
    .toLowerCase();

  if (
    headText.startsWith('<svg') ||
    headText.startsWith('<?xml') ||
    headText.includes('<svg')
  ) {
    throw new VehicleImageSecurityError(
      'SVG images are not allowed. Upload a static JPEG, PNG, or WebP photo.',
      'SVG_NOT_ALLOWED',
      400
    );
  }

  if (
    headText.startsWith('<!doctype') ||
    headText.startsWith('<html') ||
    headText.startsWith('<script') ||
    headText.startsWith('<head') ||
    headText.startsWith('<body')
  ) {
    throw new VehicleImageSecurityError(
      'HTML or script content is not a valid vehicle image.',
      'UNSUPPORTED_IMAGE_FORMAT',
      400
    );
  }

  const ascii6 = head.subarray(0, 6).toString('ascii');
  if (ascii6 === 'GIF87a' || ascii6 === 'GIF89a') {
    throw new VehicleImageSecurityError(
      'GIF images are not supported. Upload a static JPEG, PNG, or WebP photo.',
      'ANIMATED_IMAGE_NOT_ALLOWED',
      400
    );
  }

  if (head.subarray(0, 5).toString('ascii') === '%PDF-') {
    throw new VehicleImageSecurityError(
      'PDF files are not allowed. Upload a static JPEG, PNG, or WebP photo.',
      'UNSUPPORTED_IMAGE_FORMAT',
      400
    );
  }

  // ZIP / OOXML / JAR
  if (
    head.length >= 4 &&
    head[0] === 0x50 &&
    head[1] === 0x4b &&
    (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07)
  ) {
    throw new VehicleImageSecurityError(
      'Archive files are not valid vehicle images.',
      'UNSUPPORTED_IMAGE_FORMAT',
      400
    );
  }

  // PE (MZ), ELF (\x7fELF), Mach-O executables
  if (
    (head.length >= 2 && head[0] === 0x4d && head[1] === 0x5a) ||
    (head.length >= 4 &&
      head[0] === 0x7f &&
      head[1] === 0x45 &&
      head[2] === 0x4c &&
      head[3] === 0x46) ||
    (head.length >= 4 &&
      ((head[0] === 0xfe && head[1] === 0xed && head[2] === 0xfa && (head[3] === 0xce || head[3] === 0xcf)) ||
        (head[0] === 0xcf && head[1] === 0xfa && head[2] === 0xed && head[3] === 0xfe)))
  ) {
    throw new VehicleImageSecurityError(
      'Executable binaries are not valid vehicle images.',
      'UNSUPPORTED_IMAGE_FORMAT',
      400
    );
  }
}

function withProcessingTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new VehicleImageSecurityError(
          'Image processing timed out. Please upload a smaller standard JPEG, PNG, or WebP image.',
          'PROCESSING_TIMEOUT',
          408
        )
      );
    }, PROCESSING_TIMEOUT_MS);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function encodeAndVerify(
  inputBuffer: Buffer,
  maxWidth: number,
  maxHeight: number,
  format: 'webp' | 'jpeg',
  quality: number
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const pipeline = sharp(inputBuffer, {
    failOn: 'truncated',
    limitInputPixels: MAX_INPUT_PIXELS,
    pages: 1,
  })
    .timeout({ seconds: PROCESSING_TIMEOUT_SECONDS })
    .rotate()
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    });

  // Never call .keepMetadata() or .withMetadata(): Sharp strips EXIF/XMP/IPTC/comments
  // and trailing payloads during full raster decode + fresh encode.
  const result =
    format === 'webp'
      ? await pipeline.webp({ quality, effort: 4 }).toBuffer({ resolveWithObject: true })
      : await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer({ resolveWithObject: true });

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

/**
 * Validates, decodes, strips metadata, resizes, and re-encodes an untrusted image buffer
 * using Sharp/libvips. Rejects non-images, SVGs, GIFs, animated images, decompression bombs,
 * corrupted/truncated buffers, and oversized inputs.
 */
export async function validateAndReencodeVehicleImage(
  rawBuffer: Buffer
): Promise<ProcessedVehicleImage> {
  if (!Buffer.isBuffer(rawBuffer) || rawBuffer.length === 0) {
    throw new VehicleImageSecurityError(
      'Uploaded image file is empty.',
      'EMPTY_FILE',
      400
    );
  }

  if (rawBuffer.length > MAX_RAW_UPLOAD_BYTES) {
    throw new VehicleImageSecurityError(
      `Raw image upload exceeds the ${Math.round(MAX_RAW_UPLOAD_BYTES / (1024 * 1024))} MB limit.`,
      'RAW_FILE_TOO_LARGE',
      413
    );
  }

  inspectDisallowedPayloadSignatures(rawBuffer);

  return withProcessingTimeout(
    (async (): Promise<ProcessedVehicleImage> => {
      let metadata: Metadata;
      try {
        metadata = await sharp(rawBuffer, {
          failOn: 'truncated',
          limitInputPixels: MAX_INPUT_PIXELS,
          animated: true,
        })
          .timeout({ seconds: PROCESSING_TIMEOUT_SECONDS })
          .metadata();
      } catch (err: any) {
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('pixel limit') || msg.includes('exceeds image size')) {
          throw new VehicleImageSecurityError(
            'Image dimensions exceed safe processing limits.',
            'EXCESSIVE_DIMENSIONS',
            413
          );
        }
        throw new VehicleImageSecurityError(
          'Unable to decode image file. Only genuine static JPEG, PNG, or WebP photos are accepted.',
          'DECODE_FAILED',
          400
        );
      }

      const detectedFormat = String(metadata.format || '').toLowerCase();
      if (detectedFormat === 'svg') {
        throw new VehicleImageSecurityError(
          'SVG images are not allowed. Upload a static JPEG, PNG, or WebP photo.',
          'SVG_NOT_ALLOWED',
          400
        );
      }

      if (detectedFormat === 'gif') {
        throw new VehicleImageSecurityError(
          'GIF images are not supported. Upload a static JPEG, PNG, or WebP photo.',
          'ANIMATED_IMAGE_NOT_ALLOWED',
          400
        );
      }

      if (!ALLOWED_INPUT_FORMATS.has(detectedFormat)) {
        throw new VehicleImageSecurityError(
          'Unsupported image format. Only genuine static JPEG, PNG, and WebP images are allowed.',
          'UNSUPPORTED_IMAGE_FORMAT',
          400
        );
      }

      const pageCount = Number(metadata.pages || 1);
      if (pageCount > 1 || (Array.isArray(metadata.delay) && metadata.delay.length > 1)) {
        throw new VehicleImageSecurityError(
          'Animated images are not permitted. Upload a static JPEG, PNG, or WebP photo.',
          'ANIMATED_IMAGE_NOT_ALLOWED',
          400
        );
      }

      const width = Number(metadata.width || 0);
      const height = Number(metadata.height || 0);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new VehicleImageSecurityError(
          'Image has invalid dimensions and could not be decoded.',
          'DECODE_FAILED',
          400
        );
      }

      if (
        width > MAX_INPUT_WIDTH ||
        height > MAX_INPUT_HEIGHT ||
        width * height > MAX_INPUT_PIXELS
      ) {
        throw new VehicleImageSecurityError(
          `Image dimensions (${width}x${height}) exceed maximum allowed size (${MAX_INPUT_WIDTH}x${MAX_INPUT_HEIGHT} / 24 MP).`,
          'EXCESSIVE_DIMENSIONS',
          413
        );
      }

      // Full decode + adaptive re-encode attempts to fit strictly <= 100 KB (102,400 bytes)
      const attempts: Array<{
        maxW: number;
        maxH: number;
        format: 'webp' | 'jpeg';
        quality: number;
      }> = [
        { maxW: TARGET_MAX_WIDTH, maxH: TARGET_MAX_HEIGHT, format: 'webp', quality: 82 },
        { maxW: TARGET_MAX_WIDTH, maxH: TARGET_MAX_HEIGHT, format: 'webp', quality: 72 },
        { maxW: TARGET_MAX_WIDTH, maxH: TARGET_MAX_HEIGHT, format: 'webp', quality: 60 },
        { maxW: TARGET_MAX_WIDTH, maxH: TARGET_MAX_HEIGHT, format: 'webp', quality: 48 },
        { maxW: TARGET_MAX_WIDTH, maxH: TARGET_MAX_HEIGHT, format: 'jpeg', quality: 74 },
        { maxW: TARGET_MAX_WIDTH, maxH: TARGET_MAX_HEIGHT, format: 'jpeg', quality: 58 },
        { maxW: 960, maxH: 720, format: 'webp', quality: 64 },
        { maxW: 960, maxH: 720, format: 'webp', quality: 46 },
        { maxW: 800, maxH: 600, format: 'webp', quality: 52 },
        { maxW: 800, maxH: 600, format: 'jpeg', quality: 52 },
        { maxW: 640, maxH: 480, format: 'webp', quality: 42 },
        { maxW: 640, maxH: 480, format: 'webp', quality: 30 },
        { maxW: 480, maxH: 360, format: 'webp', quality: 28 },
      ];

      let bestCandidate:
        | {
            buffer: Buffer;
            width: number;
            height: number;
            format: 'webp' | 'jpeg';
          }
        | null = null;

      for (const attempt of attempts) {
        let encoded: { buffer: Buffer; width: number; height: number };
        try {
          encoded = await encodeAndVerify(
            rawBuffer,
            attempt.maxW,
            attempt.maxH,
            attempt.format,
            attempt.quality
          );
        } catch (err: any) {
          const msg = String(err?.message || '').toLowerCase();
          if (msg.includes('pixel limit') || msg.includes('exceeds image size')) {
            throw new VehicleImageSecurityError(
              'Image dimensions exceed safe decoding limits.',
              'EXCESSIVE_DIMENSIONS',
              413
            );
          }
          throw new VehicleImageSecurityError(
            'Image data is corrupted or malformed and failed decoding.',
            'DECODE_FAILED',
            400
          );
        }

        if (encoded.buffer.length <= MAX_FINAL_IMAGE_BYTES) {
          bestCandidate = {
            ...encoded,
            format: attempt.format,
          };
          break;
        }
      }

      if (!bestCandidate) {
        throw new VehicleImageSecurityError(
          'Image is still too large to upload. You can reduce its size using TinyPNG and try again.',
          'IMAGE_TOO_LARGE_AFTER_COMPRESSION',
          413
        );
      }

      // Final verification pass on generated bytes
      const finalMeta = await sharp(bestCandidate.buffer, {
        failOn: 'truncated',
        limitInputPixels: MAX_INPUT_PIXELS,
      }).metadata();
      const finalFormat = String(finalMeta.format || '').toLowerCase();
      if (finalFormat !== 'webp' && finalFormat !== 'jpeg') {
        throw new VehicleImageSecurityError(
          'Re-encoded output failed final image verification.',
          'DECODE_FAILED',
          500
        );
      }

      const ext = bestCandidate.format === 'webp' ? 'webp' : 'jpg';
      const mimeType = bestCandidate.format === 'webp' ? 'image/webp' : 'image/jpeg';

      return {
        buffer: bestCandidate.buffer,
        mimeType,
        extension: ext,
        width: bestCandidate.width,
        height: bestCandidate.height,
        inputFormat: detectedFormat as 'jpeg' | 'png' | 'webp',
        originalBytes: rawBuffer.length,
        outputBytes: bestCandidate.buffer.length,
      };
    })()
  );
}
