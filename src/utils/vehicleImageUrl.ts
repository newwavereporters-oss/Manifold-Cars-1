export const VEHICLE_IMAGES_BUCKET = 'vehicle-images';
const VEHICLE_IMAGES_PUBLIC_MARKER = `/storage/v1/object/public/${VEHICLE_IMAGES_BUCKET}/`;

const APPROVED_STORAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.webp']);
const APPROVED_LOCAL_ASSET_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const BLOCKED_DANGEROUS_EXTENSIONS = [
  '.svg',
  '.svgz',
  '.html',
  '.htm',
  '.xhtml',
  '.xml',
  '.js',
  '.mjs',
  '.cjs',
  '.php',
  '.asp',
  '.aspx',
  '.jsp',
  '.exe',
  '.dll',
  '.bat',
  '.sh',
  '.pdf',
  '.zip',
];

const APPROVED_YOUTUBE_IMAGE_HOSTS = new Set([
  'i.ytimg.com',
  'img.youtube.com',
  'i1.ytimg.com',
  'i2.ytimg.com',
  'i3.ytimg.com',
  'i4.ytimg.com',
]);

function getNormalizedPathname(rawUrl: string): string {
  const withoutHash = rawUrl.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  return withoutQuery.trim().toLowerCase();
}

function hasDangerousExtension(pathnameLower: string): boolean {
  return BLOCKED_DANGEROUS_EXTENSIONS.some((ext) => pathnameLower.endsWith(ext));
}

function hasExtensionInSet(pathnameLower: string, allowed: Set<string>): boolean {
  for (const ext of allowed) {
    if (pathnameLower.endsWith(ext)) {
      return true;
    }
  }
  return false;
}

export function extractVehicleImageStoragePath(rawUrl?: string | null): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf(VEHICLE_IMAGES_PUBLIC_MARKER);
  if (idx === -1) return null;

  const afterMarker = trimmed.slice(idx + VEHICLE_IMAGES_PUBLIC_MARKER.length);
  const withoutQuery = afterMarker.split('?')[0].split('#')[0];
  let decoded = withoutQuery;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    return null;
  }

  const normalized = decoded.replace(/^\/+/, '');
  if (!normalized || normalized.includes('..') || normalized.includes('\\')) {
    return null;
  }
  return normalized;
}

export function isVerifiedManifoldStorageImageUrl(
  rawUrl?: string | null,
  expectedSupabaseUrl?: string | null
): boolean {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return false;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:')
  ) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, 'https://manifold.local');
  } catch {
    return false;
  }

  const isRelativeStorageUrl = trimmed.startsWith('/');
  if (!isRelativeStorageUrl && parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  if (!isRelativeStorageUrl) {
    if (expectedSupabaseUrl) {
      try {
        const expected = new URL(expectedSupabaseUrl.trim());
        if (parsed.origin !== expected.origin) {
          return false;
        }
      } catch {
        return false;
      }
    } else if (!parsed.hostname.toLowerCase().endsWith('.supabase.co')) {
      return false;
    }
  }

  const pathnameLower = parsed.pathname.toLowerCase();
  if (!pathnameLower.startsWith(VEHICLE_IMAGES_PUBLIC_MARKER) && !pathnameLower.includes(VEHICLE_IMAGES_PUBLIC_MARKER)) {
    return false;
  }

  const storagePath = extractVehicleImageStoragePath(trimmed);
  if (!storagePath) return false;

  const pathLower = storagePath.toLowerCase();
  if (hasDangerousExtension(pathLower)) return false;
  return hasExtensionInSet(pathLower, APPROVED_STORAGE_EXTENSIONS);
}

export function isApprovedVehicleImageUrl(
  rawUrl?: string | null,
  expectedSupabaseUrl?: string | null
): boolean {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return false;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('ftp:') ||
    lower.startsWith('blob:') ||
    trimmed.startsWith('//')
  ) {
    return false;
  }

  if (isVerifiedManifoldStorageImageUrl(trimmed, expectedSupabaseUrl)) {
    return true;
  }

  // Same-origin bundled static raster assets (Vite build/dev assets only, never SVG/HTML)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    const pathnameLower = getNormalizedPathname(trimmed);
    if (pathnameLower.includes('..') || hasDangerousExtension(pathnameLower)) {
      return false;
    }
    return hasExtensionInSet(pathnameLower, APPROVED_LOCAL_ASSET_EXTENSIONS);
  }

  // Official YouTube thumbnail endpoints for video-first car cards
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    const hostLower = parsed.hostname.toLowerCase();
    if (!APPROVED_YOUTUBE_IMAGE_HOSTS.has(hostLower)) {
      return false;
    }
    const pathnameLower = parsed.pathname.toLowerCase();
    if (hasDangerousExtension(pathnameLower)) return false;
    return hasExtensionInSet(pathnameLower, new Set(['.jpg', '.jpeg', '.webp']));
  } catch {
    return false;
  }
}
