/**
 * MANIFOLD YouTube URL Utility
 * Supports extracting video IDs from all standard YouTube URL formats:
 * - https://www.youtube.com/watch?v=XXXXXXXX
 * - https://m.youtube.com/watch?v=XXXXXXXX
 * - https://youtu.be/XXXXXXXX
 * - https://www.youtube.com/shorts/XXXXXXXX
 * - https://www.youtube.com/embed/XXXXXXXX
 * - youtu.be/XXXXXXXX
 */

export function extractYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  // If the user already provided a raw 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    // 1. Regex for youtu.be/VIDEO_ID
    const shortMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed|shorts|v)\/)([a-zA-Z0-9_-]{11})/i);
    if (shortMatch && shortMatch[1]) {
      return shortMatch[1];
    }

    // 2. Standard watch URL parsing
    if (trimmed.includes('youtube.com/watch')) {
      const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      const v = urlObj.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
        return v;
      }
    }

    // 3. Fallback regex for any YouTube URL with v=
    const vMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
    if (vMatch && vMatch[1]) {
      return vMatch[1];
    }

    // 4. Fallback for shorts or embed without protocol
    const genericMatch = trimmed.match(/(?:shorts|embed)\/([a-zA-Z0-9_-]{11})/i);
    if (genericMatch && genericMatch[1]) {
      return genericMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

export function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}

export function getYouTubeThumbnailUrl(
  videoIdOrUrl: string,
  quality: 'maxres' | 'hq' | 'mq' = 'maxres'
): string {
  const videoId = extractYouTubeVideoId(videoIdOrUrl) || videoIdOrUrl;
  if (!videoId) return '';

  if (quality === 'hq') {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }
  if (quality === 'mq') {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

export function getYouTubeFallbackThumbnailUrl(videoIdOrUrl: string): string {
  const videoId = extractYouTubeVideoId(videoIdOrUrl) || videoIdOrUrl;
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function formatStandardYouTubeUrl(videoIdOrUrl: string): string {
  const videoId = extractYouTubeVideoId(videoIdOrUrl) || videoIdOrUrl;
  return `https://www.youtube.com/watch?v=${videoId}`;
}
