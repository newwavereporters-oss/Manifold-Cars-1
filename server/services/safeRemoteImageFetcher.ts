import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import {
  MAX_RAW_UPLOAD_BYTES,
  VehicleImageSecurityError,
} from './vehicleImageSecurity.js';

export const REMOTE_FETCH_TIMEOUT_MS = 10_000;
export const MAX_REMOTE_REDIRECTS = 3;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.localdomain',
  '.home.arpa',
  '.arpa',
];

function ipv4ToUint32(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const num = Number(part);
    if (!Number.isInteger(num) || num < 0 || num > 255) return null;
    result = ((result << 8) | num) >>> 0;
  }
  return result;
}

function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToUint32(ip);
  if (n === null) return true;

  const inRange = (cidrBase: string, prefixLen: number): boolean => {
    const base = ipv4ToUint32(cidrBase);
    if (base === null) return true;
    const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
    return (n & mask) === (base & mask);
  };

  return (
    inRange('0.0.0.0', 8) || // Current network / unspecified
    inRange('10.0.0.0', 8) || // RFC1918 private
    inRange('100.64.0.0', 10) || // CGNAT / Alibaba cloud metadata 100.100.100.200
    inRange('127.0.0.0', 8) || // Loopback
    inRange('169.254.0.0', 16) || // Link-local & AWS/GCP/Azure IMDS (169.254.169.254)
    inRange('172.16.0.0', 12) || // RFC1918 private
    inRange('192.0.0.0', 24) || // IETF protocol assignments
    inRange('192.0.2.0', 24) || // TEST-NET-1
    inRange('192.88.99.0', 24) || // 6to4 relay anycast
    inRange('192.168.0.0', 16) || // RFC1918 private
    inRange('198.18.0.0', 15) || // Benchmarking
    inRange('198.51.100.0', 24) || // TEST-NET-2
    inRange('203.0.113.0', 24) || // TEST-NET-3
    inRange('224.0.0.0', 4) || // Multicast
    inRange('240.0.0.0', 4) // Reserved / 255.255.255.255 broadcast
  );
}

function expandIpv6ToWords(ip: string): number[] | null {
  const zoneIdx = ip.indexOf('%');
  const clean = (zoneIdx !== -1 ? ip.slice(0, zoneIdx) : ip).toLowerCase();

  if (clean.includes('.')) {
    const lastColon = clean.lastIndexOf(':');
    if (lastColon === -1) return null;
    const v4Part = clean.slice(lastColon + 1);
    const v4Num = ipv4ToUint32(v4Part);
    if (v4Num === null) return null;
    const hi = ((v4Num >>> 16) & 0xffff).toString(16);
    const lo = (v4Num & 0xffff).toString(16);
    return expandIpv6ToWords(`${clean.slice(0, lastColon)}:${hi}:${lo}`);
  }

  const halves = clean.split('::');
  if (halves.length > 2) return null;

  const parseSide = (side: string): number[] | null => {
    if (!side) return [];
    const groups = side.split(':');
    const out: number[] = [];
    for (const g of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };

  const left = parseSide(halves[0]);
  if (!left) return null;

  if (halves.length === 1) {
    return left.length === 8 ? left : null;
  }

  const right = parseSide(halves[1]);
  if (!right) return null;

  const missing = 8 - (left.length + right.length);
  if (missing < 1) return null;

  return [...left, ...new Array<number>(missing).fill(0), ...right];
}

function isBlockedIpv6(ip: string): boolean {
  const words = expandIpv6ToWords(ip);
  if (!words || words.length !== 8) return true;

  // ::/128 (unspecified) or ::1/128 (loopback)
  const allZeroPrefix = words.slice(0, 7).every((w) => w === 0);
  if (allZeroPrefix && (words[7] === 0 || words[7] === 1)) {
    return true;
  }

  // IPv4-mapped ::ffff:0:0/96 or IPv4-compatible ::/96 or NAT64 64:ff9b::/96
  const isV4Mapped =
    words[0] === 0 &&
    words[1] === 0 &&
    words[2] === 0 &&
    words[3] === 0 &&
    words[4] === 0 &&
    words[5] === 0xffff;
  const isV4Compat =
    words[0] === 0 &&
    words[1] === 0 &&
    words[2] === 0 &&
    words[3] === 0 &&
    words[4] === 0 &&
    words[5] === 0;
  const isNat64 =
    words[0] === 0x0064 &&
    words[1] === 0xff9b &&
    words[2] === 0 &&
    words[3] === 0 &&
    words[4] === 0 &&
    words[5] === 0;

  if (isV4Mapped || isV4Compat || isNat64) {
    const embeddedV4 = `${(words[6] >> 8) & 0xff}.${words[6] & 0xff}.${(words[7] >> 8) & 0xff}.${words[7] & 0xff}`;
    return isBlockedIpv4(embeddedV4);
  }

  // fc00::/7 Unique Local Addresses
  if ((words[0] & 0xfe00) === 0xfc00) return true;

  // fe80::/10 Link-Local
  if ((words[0] & 0xffc0) === 0xfe80) return true;

  // fec0::/10 Deprecated Site-Local
  if ((words[0] & 0xffc0) === 0xfec0) return true;

  // ff00::/8 Multicast
  if ((words[0] & 0xff00) === 0xff00) return true;

  // 100::/64 Discard-Only
  if (words[0] === 0x0100 && words[1] === 0 && words[2] === 0 && words[3] === 0) return true;

  // 2001:db8::/32 Documentation
  if (words[0] === 0x2001 && words[1] === 0x0db8) return true;

  return false;
}

export function isBlockedIpAddress(rawIp: string): boolean {
  const ip = (rawIp || '').trim().replace(/^\[|\]$/g, '');
  const version = net.isIP(ip);
  if (version === 4) return isBlockedIpv4(ip);
  if (version === 6) return isBlockedIpv6(ip);
  return true;
}

export type DnsResolverFn = (
  hostname: string
) => Promise<Array<{ address: string; family: 4 | 6 }>>;

const defaultDnsResolver: DnsResolverFn = async (hostname: string) => {
  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  return results.map((entry) => ({
    address: entry.address,
    family: entry.family === 6 ? 6 : 4,
  }));
};

export async function validateRemoteImageTarget(
  rawUrl: string,
  dnsResolver: DnsResolverFn = defaultDnsResolver
): Promise<{ url: URL; resolvedAddress: string; family: 4 | 6 }> {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    throw new VehicleImageSecurityError(
      'Please enter a valid HTTPS image URL.',
      'UNSUPPORTED_IMAGE_FORMAT',
      400
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new VehicleImageSecurityError(
      'Invalid image URL format.',
      'UNSUPPORTED_IMAGE_FORMAT',
      400
    );
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new VehicleImageSecurityError(
      'Only HTTP and HTTPS image URLs are allowed.',
      'UNSUPPORTED_IMAGE_FORMAT',
      400
    );
  }

  if (parsed.username || parsed.password) {
    throw new VehicleImageSecurityError(
      'Image URLs containing embedded credentials are not permitted.',
      'UNSUPPORTED_IMAGE_FORMAT',
      400
    );
  }

  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw new VehicleImageSecurityError(
      'Image URLs using non-standard ports are not permitted.',
      'UNSUPPORTED_IMAGE_FORMAT',
      400
    );
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname) {
    throw new VehicleImageSecurityError('Image URL hostname is missing.', 'UNSUPPORTED_IMAGE_FORMAT', 400);
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new VehicleImageSecurityError(
      'Internal, localhost, and cloud metadata image URLs are strictly prohibited.',
      'UNSUPPORTED_IMAGE_FORMAT',
      400
    );
  }

  const literalFamily = net.isIP(hostname);
  if (literalFamily === 4 || literalFamily === 6) {
    if (isBlockedIpAddress(hostname)) {
      throw new VehicleImageSecurityError(
        'Private, loopback, and reserved IP image URLs are strictly prohibited.',
        'UNSUPPORTED_IMAGE_FORMAT',
        400
      );
    }
    return {
      url: parsed,
      resolvedAddress: hostname,
      family: literalFamily,
    };
  }

  let addresses: Array<{ address: string; family: 4 | 6 }>;
  try {
    addresses = await dnsResolver(hostname);
  } catch {
    throw new VehicleImageSecurityError(
      'Unable to resolve the image URL hostname.',
      'UNSUPPORTED_IMAGE_FORMAT',
      400
    );
  }

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new VehicleImageSecurityError(
      'Image URL hostname did not resolve to a valid public IP address.',
      'UNSUPPORTED_IMAGE_FORMAT',
      400
    );
  }

  for (const entry of addresses) {
    if (isBlockedIpAddress(entry.address)) {
      throw new VehicleImageSecurityError(
        'The remote image host resolved to a restricted internal or private network address.',
        'UNSUPPORTED_IMAGE_FORMAT',
        400
      );
    }
  }

  return {
    url: parsed,
    resolvedAddress: addresses[0].address,
    family: addresses[0].family,
  };
}

function downloadPinnedHttp(params: {
  url: URL;
  resolvedAddress: string;
  family: 4 | 6;
  timeoutMs: number;
}): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}> {
  return new Promise((resolve, reject) => {
    const isHttps = params.url.protocol === 'https:';
    const transport = isHttps ? https : http;
    const hostname = params.url.hostname.replace(/^\[|\]$/g, '');

    let settled = false;
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const req = transport.request(
      {
        protocol: params.url.protocol,
        hostname,
        port: params.url.port ? Number(params.url.port) : isHttps ? 443 : 80,
        path: `${params.url.pathname}${params.url.search}`,
        method: 'GET',
        timeout: params.timeoutMs,
        ...(isHttps ? { servername: hostname } : {}),
        // Pin DNS resolution directly to the validated public IP to prevent DNS rebinding
        lookup: ((_host: string, _opts: any, cb: any) => {
          cb(null, params.resolvedAddress, params.family);
        }) as any,
        headers: {
          Host: params.url.host,
          Accept: 'image/webp,image/png,image/jpeg,*/*;q=0.1',
          'User-Agent': 'MANIFOLD-ImageImporter/1.0',
        },
      },
      (res) => {
        const statusCode = res.statusCode || 0;

        // Redirects are handled manually by caller so every hop is re-validated
        if (statusCode >= 300 && statusCode < 400) {
          res.resume();
          if (!settled) {
            settled = true;
            resolve({
              statusCode,
              headers: res.headers,
              body: Buffer.alloc(0),
            });
          }
          return;
        }

        const contentLengthHeader = res.headers['content-length'];
        const declaredLen =
          typeof contentLengthHeader === 'string'
            ? Number(contentLengthHeader)
            : NaN;
        if (Number.isFinite(declaredLen) && declaredLen > MAX_RAW_UPLOAD_BYTES) {
          req.destroy();
          fail(
            new VehicleImageSecurityError(
              `Remote image exceeds the ${Math.round(MAX_RAW_UPLOAD_BYTES / (1024 * 1024))} MB raw size limit.`,
              'RAW_FILE_TOO_LARGE',
              413
            )
          );
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;

        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > MAX_RAW_UPLOAD_BYTES) {
            req.destroy();
            fail(
              new VehicleImageSecurityError(
                `Remote image exceeds the ${Math.round(MAX_RAW_UPLOAD_BYTES / (1024 * 1024))} MB raw size limit.`,
                'RAW_FILE_TOO_LARGE',
                413
              )
            );
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          if (settled) return;
          settled = true;
          resolve({
            statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks, totalBytes),
          });
        });

        res.on('error', () => {
          fail(
            new VehicleImageSecurityError(
              'Failed while downloading the remote image.',
              'DECODE_FAILED',
              400
            )
          );
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      fail(
        new VehicleImageSecurityError(
          'Downloading the remote image timed out.',
          'PROCESSING_TIMEOUT',
          408
        )
      );
    });

    req.on('error', (err) => {
      if (err instanceof VehicleImageSecurityError) {
        fail(err);
      } else {
        fail(
          new VehicleImageSecurityError(
            'Unable to connect to the remote image server.',
            'DECODE_FAILED',
            400
          )
        );
      }
    });

    req.end();
  });
}

export async function fetchSafeRemoteImageBuffer(
  rawUrl: string,
  options?: {
    dnsResolver?: DnsResolverFn;
    transport?: typeof downloadPinnedHttp;
  }
): Promise<{ buffer: Buffer; finalUrl: string }> {
  const dnsResolver = options?.dnsResolver ?? defaultDnsResolver;
  const transport = options?.transport ?? downloadPinnedHttp;

  let currentUrl = rawUrl;
  for (let hop = 0; hop <= MAX_REMOTE_REDIRECTS; hop += 1) {
    const validated = await validateRemoteImageTarget(currentUrl, dnsResolver);
    const response = await transport({
      url: validated.url,
      resolvedAddress: validated.resolvedAddress,
      family: validated.family,
      timeoutMs: REMOTE_FETCH_TIMEOUT_MS,
    });

    if (response.statusCode >= 300 && response.statusCode < 400) {
      const locationHeader = response.headers.location;
      const location = Array.isArray(locationHeader)
        ? locationHeader[0]
        : locationHeader;
      if (!location) {
        throw new VehicleImageSecurityError(
          'Remote image URL returned an invalid redirect.',
          'UNSUPPORTED_IMAGE_FORMAT',
          400
        );
      }
      if (hop >= MAX_REMOTE_REDIRECTS) {
        throw new VehicleImageSecurityError(
          'Remote image URL exceeded maximum allowed redirects.',
          'UNSUPPORTED_IMAGE_FORMAT',
          400
        );
      }
      try {
        currentUrl = new URL(location, validated.url).toString();
      } catch {
        throw new VehicleImageSecurityError(
          'Remote image URL redirected to an invalid location.',
          'UNSUPPORTED_IMAGE_FORMAT',
          400
        );
      }
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new VehicleImageSecurityError(
        `Remote server returned HTTP ${response.statusCode} when fetching image.`,
        'DECODE_FAILED',
        400
      );
    }

    const rawContentType = String(response.headers['content-type'] || '')
      .split(';')[0]
      .trim()
      .toLowerCase();

    if (
      rawContentType &&
      (rawContentType.includes('svg') ||
        rawContentType.startsWith('text/') ||
        rawContentType === 'application/json' ||
        rawContentType === 'application/pdf' ||
        rawContentType === 'application/zip' ||
        rawContentType === 'application/javascript')
    ) {
      throw new VehicleImageSecurityError(
        `Remote URL returned disallowed content type (${rawContentType}).`,
        rawContentType.includes('svg') ? 'SVG_NOT_ALLOWED' : 'UNSUPPORTED_IMAGE_FORMAT',
        400
      );
    }

    return {
      buffer: response.body,
      finalUrl: validated.url.toString(),
    };
  }

  throw new VehicleImageSecurityError(
    'Remote image URL could not be retrieved.',
    'UNSUPPORTED_IMAGE_FORMAT',
    400
  );
}
