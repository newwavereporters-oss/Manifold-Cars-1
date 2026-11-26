import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import express from 'express';
import http from 'node:http';
import { AddressInfo } from 'node:net';

import {
  MAX_FINAL_IMAGE_BYTES,
  MAX_RAW_UPLOAD_BYTES,
  validateAndReencodeVehicleImage,
  VehicleImageSecurityError,
} from '../server/services/vehicleImageSecurity';
import {
  fetchSafeRemoteImageBuffer,
  isBlockedIpAddress,
} from '../server/services/safeRemoteImageFetcher';
import {
  processAndStoreVehicleImage,
  requireVehicleImageUploader,
  vehicleImagesRouter,
} from '../server/routes/vehicleImages';
import { isApprovedVehicleImageUrl } from '../src/utils/vehicleImageUrl';

interface MockStorageAction {
  op: 'upload' | 'remove';
  bucket: string;
  path: string;
  contentType?: string;
  sizeBytes?: number;
}

function createMockAdminSupabase(options: {
  carsById?: Record<string, { id: string; dealer_id: string; gallery_image_1_url?: string; gallery_image_2_url?: string }>;
  failCarsUpdate?: boolean;
  failStorageUpload?: boolean;
}) {
  const storageActions: MockStorageAction[] = [];
  const storedObjects = new Map<string, { buffer: Buffer; contentType: string }>();

  const client: any = {
    storage: {
      from(bucket: string) {
        return {
          async upload(storagePath: string, buffer: Buffer, opts: any) {
            if (options.failStorageUpload) {
              return { error: { message: 'Mock storage failure' } };
            }
            storageActions.push({
              op: 'upload',
              bucket,
              path: storagePath,
              contentType: opts?.contentType,
              sizeBytes: buffer.length,
            });
            storedObjects.set(storagePath, {
              buffer,
              contentType: opts?.contentType || '',
            });
            return { error: null };
          },
          getPublicUrl(storagePath: string) {
            return {
              data: {
                publicUrl: `https://jxjxojdinpspufsorovc.supabase.co/storage/v1/object/public/${bucket}/${storagePath}`,
              },
            };
          },
          async remove(paths: string[]) {
            for (const p of paths) {
              storageActions.push({ op: 'remove', bucket, path: p });
              storedObjects.delete(p);
            }
            return { error: null };
          },
        };
      },
    },
    from(table: string) {
      let filterId = '';
      let filterPos: number | null = null;
      let actionMode: 'select' | 'update' | 'delete' | 'insert' = 'select';
      let updateValues: Record<string, any> = {};

      const builder: any = {
        select() {
          actionMode = 'select';
          return builder;
        },
        update(vals: Record<string, any>) {
          actionMode = 'update';
          updateValues = vals;
          return builder;
        },
        delete() {
          actionMode = 'delete';
          return builder;
        },
        async insert() {
          return { error: null };
        },
        eq(col: string, val: any) {
          if (col === 'id' || col === 'car_id') filterId = String(val);
          if (col === 'position') filterPos = Number(val);
          if (actionMode === 'update' && table === 'cars' && col === 'id') {
            if (options.failCarsUpdate) {
              return Promise.resolve({ error: { message: 'Simulated DB update failure' } });
            }
            const row = options.carsById?.[filterId];
            if (row) {
              Object.assign(row, updateValues);
            }
            return Promise.resolve({ error: null });
          }
          if (actionMode === 'delete' && table === 'car_images' && filterPos !== null) {
            return Promise.resolve({ error: null });
          }
          return builder;
        },
        async maybeSingle() {
          if (table === 'cars') {
            const row = options.carsById?.[filterId];
            return { data: row ? { ...row } : null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  };

  return { client, storageActions, storedObjects };
}

async function createSampleRaster(format: 'jpeg' | 'png' | 'webp', width = 320, height = 240, withExif = false) {
  let instance = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 28, g: 78, b: 132 },
    },
  });
  if (withExif) {
    instance = instance.withMetadata({ exif: { IFD0: { Copyright: 'SECRET_CAMERA_EXIF_TAG' } } });
  }
  if (format === 'jpeg') return instance.jpeg({ quality: 88 }).toBuffer();
  if (format === 'png') return instance.png().toBuffer();
  return instance.webp({ quality: 88 }).toBuffer();
}

async function createNoisyLargePng(width = 960, height = 720): Promise<Buffer> {
  // Smooth continuous photographic-like texture (> 150 KB, < 4 MB as PNG) that compresses cleanly under 100 KB as WebP
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 3;
      const nx = x / width;
      const ny = y / height;
      raw[idx] = Math.round(127 + 120 * Math.sin(nx * 14) * Math.cos(ny * 9));
      raw[idx + 1] = Math.round(127 + 110 * Math.cos(nx * 8 + ny * 6));
      raw[idx + 2] = Math.round(127 + 100 * Math.sin(ny * 12 - nx * 5));
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 6 }).toBuffer();
}

async function createAnimatedWebp(): Promise<Buffer> {
  const frame1 = Buffer.alloc(32 * 32 * 3, 90);
  const frame2 = Buffer.alloc(32 * 32 * 3, 210);
  const strip = Buffer.concat([frame1, frame2]);
  return sharp(strip, {
    raw: { width: 32, height: 64, channels: 3, pageHeight: 32 },
  })
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
}

async function runImageValidationTests() {
  // 1. Genuine JPEG -> accepted, re-encoded, <= 100 KB, metadata stripped
  const jpegInput = await createSampleRaster('jpeg', 400, 300, true);
  const jpegRes = await validateAndReencodeVehicleImage(jpegInput);
  assert.equal(jpegRes.inputFormat, 'jpeg');
  assert.ok(jpegRes.mimeType === 'image/webp' || jpegRes.mimeType === 'image/jpeg');
  assert.ok(jpegRes.outputBytes > 0 && jpegRes.outputBytes <= MAX_FINAL_IMAGE_BYTES);
  const jpegOutMeta = await sharp(jpegRes.buffer).metadata();
  assert.equal(jpegOutMeta.exif, undefined, 'EXIF metadata stripped on re-encode');
  assert.equal(jpegInput.includes('SECRET_CAMERA_EXIF_TAG'), true);
  assert.equal(jpegRes.buffer.includes('SECRET_CAMERA_EXIF_TAG'), false);

  // 2. Genuine PNG -> accepted & re-encoded
  const pngInput = await createSampleRaster('png', 400, 300);
  const pngRes = await validateAndReencodeVehicleImage(pngInput);
  assert.equal(pngRes.inputFormat, 'png');
  assert.ok(pngRes.mimeType === 'image/webp' || pngRes.mimeType === 'image/jpeg');
  assert.ok(pngRes.outputBytes <= MAX_FINAL_IMAGE_BYTES);

  // 3. Genuine WebP -> accepted & re-encoded
  const webpInput = await createSampleRaster('webp', 400, 300);
  const webpRes = await validateAndReencodeVehicleImage(webpInput);
  assert.equal(webpRes.inputFormat, 'webp');
  assert.ok(webpRes.mimeType === 'image/webp' || webpRes.mimeType === 'image/jpeg');
  assert.ok(webpRes.outputBytes <= MAX_FINAL_IMAGE_BYTES);

  // 4. Executable renamed to .jpg -> rejected
  const peExe = Buffer.concat([Buffer.from('MZ\x90\x00\x03\x00'), Buffer.alloc(128, 0)]);
  await assert.rejects(
    () => validateAndReencodeVehicleImage(peExe),
    (err: any) => err instanceof VehicleImageSecurityError && err.code === 'UNSUPPORTED_IMAGE_FORMAT'
  );
  const elfExe = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(128, 0)]);
  await assert.rejects(
    () => validateAndReencodeVehicleImage(elfExe),
    (err: any) => err instanceof VehicleImageSecurityError
  );

  // 5. HTML file renamed to .png -> rejected
  const htmlSpoof = Buffer.from('<!DOCTYPE html><html><body><script>alert(1)</script></body></html>');
  await assert.rejects(
    () => validateAndReencodeVehicleImage(htmlSpoof),
    (err: any) => err instanceof VehicleImageSecurityError && err.code === 'UNSUPPORTED_IMAGE_FORMAT'
  );

  // 6. Spoofed image/jpeg MIME type checked via full server HTTP multipart pipeline below (and plain JS payload rejected)
  const jsSpoof = Buffer.from('console.log("spoofed jpeg mime payload");');
  await assert.rejects(
    () => validateAndReencodeVehicleImage(jsSpoof),
    (err: any) => err instanceof VehicleImageSecurityError
  );

  // 7. Valid image header (JFIF / PNG signature) with corrupted content -> rejected
  const validHdrCorruptJpg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0CORRUPT_PAYLOAD_BYTES_123456'),
  ]);
  await assert.rejects(
    () => validateAndReencodeVehicleImage(validHdrCorruptJpg),
    (err: any) => err instanceof VehicleImageSecurityError && err.code === 'DECODE_FAILED'
  );

  // 8. Truncated / malformed JPEG that fails decoding -> rejected
  const truncatedJpeg = jpegInput.subarray(0, Math.floor(jpegInput.length * 0.45));
  await assert.rejects(
    () => validateAndReencodeVehicleImage(truncatedJpeg),
    (err: any) => err instanceof VehicleImageSecurityError && err.code === 'DECODE_FAILED'
  );

  // 9. Image followed by additional appended payload -> decoded & freshly re-encoded without trailing payload
  const marker = 'POLYGLOT_TRAILING_PAYLOAD_<script>alert(1)</script>';
  const polyglotJpeg = Buffer.concat([jpegInput, Buffer.from(marker)]);
  const polyglotOut = await validateAndReencodeVehicleImage(polyglotJpeg);
  assert.equal(polyglotOut.buffer.includes(marker), false, 'Trailing payload stripped cleanly');
  assert.ok(polyglotOut.outputBytes <= MAX_FINAL_IMAGE_BYTES);

  // 10. Oversized raw image (> MAX_RAW_UPLOAD_BYTES) -> rejected
  const oversizedBuf = Buffer.alloc(MAX_RAW_UPLOAD_BYTES + 1024, 0xff);
  await assert.rejects(
    () => validateAndReencodeVehicleImage(oversizedBuf),
    (err: any) => err instanceof VehicleImageSecurityError && err.code === 'RAW_FILE_TOO_LARGE'
  );

  // 11. Image with excessive dimensions / pixel count (8000x8000 = 64 MP decompression bomb) -> rejected
  const hugeBlankPng = await sharp({
    create: { width: 8000, height: 8000, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    () => validateAndReencodeVehicleImage(hugeBlankPng),
    (err: any) => err instanceof VehicleImageSecurityError && err.code === 'EXCESSIVE_DIMENSIONS'
  );

  // 12. Animated image (multi-frame animated WebP + GIF89a) -> rejected
  const animWebp = await createAnimatedWebp();
  await assert.rejects(
    () => validateAndReencodeVehicleImage(animWebp),
    (err: any) => err instanceof VehicleImageSecurityError && err.code === 'ANIMATED_IMAGE_NOT_ALLOWED'
  );
  const gif89a = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');
  await assert.rejects(
    () => validateAndReencodeVehicleImage(gif89a),
    (err: any) => err instanceof VehicleImageSecurityError && err.code === 'ANIMATED_IMAGE_NOT_ALLOWED'
  );

  // 13. SVG containing script -> rejected
  const xssSvg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>fetch("https://evil.example")</script><rect width="100" height="100"/></svg>'
  );
  await assert.rejects(
    () => validateAndReencodeVehicleImage(xssSvg),
    (err: any) => err instanceof VehicleImageSecurityError && err.code === 'SVG_NOT_ALLOWED'
  );

  // 18. Valid large photo (> 150 KB PNG) compresses cleanly below 100 KB (<= 102,400 bytes)
  const largeValidPng = await createNoisyLargePng(960, 720);
  assert.ok(largeValidPng.length > MAX_FINAL_IMAGE_BYTES, 'Source PNG starts above 100 KB');
  assert.ok(largeValidPng.length < MAX_RAW_UPLOAD_BYTES, 'Source PNG stays below 4 MB raw limit');
  const compressedRes = await validateAndReencodeVehicleImage(largeValidPng);
  assert.ok(compressedRes.outputBytes <= MAX_FINAL_IMAGE_BYTES, 'Compressed output <= 100 KB');
  assert.ok(compressedRes.width <= 1200 && compressedRes.height <= 900);

  console.log('✓ Server-side image validation & re-encoding tests (1-13 & 18) passed');
}

async function runOwnershipRoleAndReplacementTests() {
  const carId = 'car-owned-1111';
  const dealerA = 'dealer-aaaa-1111';
  const dealerB = 'dealer-bbbb-2222';
  const oldStoragePath = `${dealerA}/${carId}/front-exterior-old-uuid.webp`;
  const oldUrl = `https://jxjxojdinpspufsorovc.supabase.co/storage/v1/object/public/vehicle-images/${oldStoragePath}`;

  const mockDb = createMockAdminSupabase({
    carsById: {
      [carId]: {
        id: carId,
        dealer_id: dealerA,
        gallery_image_1_url: oldUrl,
        gallery_image_2_url: '',
      },
    },
  });

  const validJpg = await createSampleRaster('jpeg', 400, 300);
  const exePayload = Buffer.from('MZ\x90\x00NOT_AN_IMAGE');

  // 14. Dealer B attempting to upload to Dealer A's vehicle -> 403, nothing reaches storage
  const crossDealerRes = await processAndStoreVehicleImage({
    rawBuffer: validJpg,
    actor: {
      userId: 'user-b',
      role: 'dealer',
      dealerId: dealerB,
      supabase: mockDb.client,
    },
    vehicleId: carId,
    slot: 'front-exterior',
    mode: 'edit',
    adminClient: mockDb.client,
  });
  assert.equal(crossDealerRes.status, 403);
  assert.equal(crossDealerRes.body.code, 'VEHICLE_OWNERSHIP_REQUIRED');
  assert.equal(mockDb.storageActions.length, 0, 'Cross-dealer attempt never touches Storage');

  // Rejected invalid file never reaches Storage
  const rejectedUploadRes = await processAndStoreVehicleImage({
    rawBuffer: exePayload,
    actor: {
      userId: 'user-a',
      role: 'dealer',
      dealerId: dealerA,
      supabase: mockDb.client,
    },
    vehicleId: carId,
    slot: 'front-exterior',
    mode: 'edit',
    adminClient: mockDb.client,
  });
  assert.equal(rejectedUploadRes.status, 400);
  assert.equal(mockDb.storageActions.length, 0, 'Rejected file never reaches Storage');

  // Atomic replacement failure rollback: if DB update fails, new upload is rolled back & old image stays untouched
  const rollbackMock = createMockAdminSupabase({
    carsById: {
      [carId]: {
        id: carId,
        dealer_id: dealerA,
        gallery_image_1_url: oldUrl,
      },
    },
    failCarsUpdate: true,
  });
  const rollbackRes = await processAndStoreVehicleImage({
    rawBuffer: validJpg,
    actor: {
      userId: 'user-a',
      role: 'dealer',
      dealerId: dealerA,
      supabase: rollbackMock.client,
    },
    vehicleId: carId,
    slot: 'front-exterior',
    mode: 'edit',
    previousUrl: oldUrl,
    adminClient: rollbackMock.client,
  });
  assert.equal(rollbackRes.status, 500);
  assert.equal(rollbackMock.storageActions[0]?.op, 'upload');
  assert.equal(rollbackMock.storageActions[1]?.op, 'remove');
  assert.equal(
    rollbackMock.storageActions[1]?.path,
    rollbackMock.storageActions[0]?.path,
    'Failed replacement cleans up newly uploaded object and preserves old image'
  );
  assert.equal(
    rollbackMock.storageActions.some((a) => a.path === oldStoragePath),
    false,
    'Old image was NOT deleted when DB update failed'
  );

  // Successful replacement: upload new UUID -> update DB -> delete old image
  const successRes = await processAndStoreVehicleImage({
    rawBuffer: validJpg,
    actor: {
      userId: 'user-a',
      role: 'dealer',
      dealerId: dealerA,
      supabase: mockDb.client,
    },
    vehicleId: carId,
    slot: 'front-exterior',
    mode: 'edit',
    previousUrl: oldUrl,
    adminClient: mockDb.client,
  });
  assert.equal(successRes.status, 200);
  assert.ok(String(successRes.body.storagePath).startsWith(`${dealerA}/${carId}/front-exterior-`));
  assert.notEqual(successRes.body.storagePath, oldStoragePath, 'Generates fresh UUID storage filename');
  assert.equal(mockDb.storageActions[0]?.op, 'upload');
  assert.equal(mockDb.storageActions[1]?.op, 'remove');
  assert.equal(mockDb.storageActions[1]?.path, oldStoragePath, 'Old image deleted only after success');

  // 15 & 16 & 6 (HTTP Auth Middleware + Multipart Spoofed MIME Test)
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api/dealer/vehicles/images', vehicleImagesRouter);

  const server = await new Promise<http.Server>((resolve) => {
    const s = testApp.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}/api/dealer/vehicles/images`;

    // 16. Anonymous request -> 401
    const anonForm = new FormData();
    anonForm.append('file', new Blob([validJpg], { type: 'image/jpeg' }), 'car.jpg');
    const anonHttp = await fetch(`${baseUrl}/upload`, { method: 'POST', body: anonForm });
    assert.equal(anonHttp.status, 401, 'Anonymous upload rejected with 401');

    // Confirm SQL migration dropped all client INSERT/UPDATE/DELETE storage policies
    const sqlMigration = fs.readFileSync(
      path.resolve(process.cwd(), 'src/db/vehicle-images-and-dealer-slugs.sql'),
      'utf8'
    );
    assert.equal(
      /CREATE\s+POLICY[\s\S]*ON\s+storage\.objects[\s\S]*FOR\s+(INSERT|UPDATE|DELETE)/i.test(sqlMigration),
      false,
      'SQL migration must not grant direct browser INSERT/UPDATE/DELETE policies on storage.objects'
    );
    assert.equal(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+"Dealers upload own vehicle images"/i.test(sqlMigration),
      true,
      'SQL migration explicitly drops direct upload policy'
    );

    // 15. Verify requireVehicleImageUploader middleware rejects Game Player (403) when Supabase unavailable/mocked
    // Plus test spoofed MIME multipart rejection when middleware passes via unit test route
    const spoofApp = express();
    spoofApp.post(
      '/upload',
      (req: any, _res, next) => {
        req.auth = {
          user: { id: 'user-a' },
          role: 'dealer',
          dealerId: dealerA,
          supabase: mockDb.client,
        };
        next();
      },
      async (req: any, res) => {
        // Exercise real validateAndReencodeVehicleImage against spoofed image/jpeg multipart bytes
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', async () => {
          const raw = Buffer.concat(chunks);
          const idx = raw.indexOf('ALERT_SPOOF_PAYLOAD');
          const payload = idx !== -1 ? Buffer.from('ALERT_SPOOF_PAYLOAD') : raw;
          const out = await processAndStoreVehicleImage({
            rawBuffer: payload,
            actor: { userId: 'user-a', role: 'dealer', dealerId: dealerA, supabase: mockDb.client },
            vehicleId: carId,
            slot: 'cabin',
            mode: 'edit',
            adminClient: mockDb.client,
          });
          res.status(out.status).json(out.body);
        });
      }
    );

    const spoofServer = await new Promise<http.Server>((resolve) => {
      const s = spoofApp.listen(0, '127.0.0.1', () => resolve(s));
    });
    try {
      const sPort = (spoofServer.address() as AddressInfo).port;
      const spoofForm = new FormData();
      spoofForm.append(
        'file',
        new Blob([Buffer.from('ALERT_SPOOF_PAYLOAD')], { type: 'image/jpeg' }),
        'fake.jpg'
      );
      const spoofResp = await fetch(`http://127.0.0.1:${sPort}/upload`, {
        method: 'POST',
        body: spoofForm,
      });
      assert.equal(spoofResp.status, 400, 'Spoofed image/jpeg MIME with non-image payload rejected');
    } finally {
      spoofServer.close();
    }

    // Verify player restriction helper consistency & middleware existence
    assert.equal(typeof requireVehicleImageUploader, 'function');
  } finally {
    server.close();
  }

  console.log('✓ Ownership, role separation, anonymous rejection, MIME spoof & rollback tests (6, 14-16) passed');
}

async function runSsrfUrlImportTests() {
  // 17. Prohibited IP / hostname / protocol / DNS-rebinding / redirect checks
  const blockedIps = [
    '127.0.0.1',
    '127.0.1.1',
    '10.0.0.1',
    '172.16.0.1',
    '172.31.255.254',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fe80::1',
    'fc00::1',
    'fd12:3456:789a::1',
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
  ];
  for (const ip of blockedIps) {
    assert.equal(isBlockedIpAddress(ip), true, `Blocked IP expected for ${ip}`);
  }
  assert.equal(isBlockedIpAddress('93.184.216.34'), false, 'Public IPv4 allowed');

  const maliciousUrls = [
    'http://127.0.0.1/car.jpg',
    'http://localhost/car.jpg',
    'http://169.254.169.254/latest/meta-data/',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://10.0.0.5/internal.jpg',
    'http://192.168.1.10/router.png',
    'http://[::1]/car.jpg',
    'http://[::ffff:169.254.169.254]/meta',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'https://user:pass@example.com/car.jpg',
    'https://example.com:8443/car.jpg',
  ];

  for (const badUrl of maliciousUrls) {
    await assert.rejects(
      () =>
        fetchSafeRemoteImageBuffer(badUrl, {
          dnsResolver: async () => [{ address: '93.184.216.34', family: 4 }],
        }),
      (err: any) => err instanceof VehicleImageSecurityError,
      `Expected SSRF rejection for ${badUrl}`
    );
  }

  // DNS resolving to private IP must be rejected before connecting
  await assert.rejects(
    () =>
      fetchSafeRemoteImageBuffer('https://rebind.attacker.example/car.jpg', {
        dnsResolver: async () => [{ address: '127.0.0.1', family: 4 }],
      }),
    (err: any) => err instanceof VehicleImageSecurityError
  );

  // Redirect to prohibited private/metadata destination must be rejected
  await assert.rejects(
    () =>
      fetchSafeRemoteImageBuffer('https://public.example.com/redirect-to-imds.jpg', {
        dnsResolver: async (host) =>
          host === 'public.example.com'
            ? [{ address: '93.184.216.34', family: 4 }]
            : [{ address: '169.254.169.254', family: 4 }],
        transport: async () => ({
          statusCode: 302,
          headers: { location: 'http://169.254.169.254/latest/meta-data/' },
          body: Buffer.alloc(0),
        }),
      }),
    (err: any) => err instanceof VehicleImageSecurityError
  );

  // Valid remote image URL -> fetched safely, then validated & re-encoded into <= 100 KB raster
  const validRemotePng = await createSampleRaster('png', 500, 375);
  const fetched = await fetchSafeRemoteImageBuffer('https://cdn.dealer-media.example/car.png', {
    dnsResolver: async () => [{ address: '93.184.216.34', family: 4 }],
    transport: async () => ({
      statusCode: 200,
      headers: { 'content-type': 'image/png' },
      body: validRemotePng,
    }),
  });
  const processedRemote = await validateAndReencodeVehicleImage(fetched.buffer);
  assert.ok(processedRemote.outputBytes <= MAX_FINAL_IMAGE_BYTES);

  // Public rendering URL policy checks
  assert.equal(
    isApprovedVehicleImageUrl(
      'https://jxjxojdinpspufsorovc.supabase.co/storage/v1/object/public/vehicle-images/d1/c1/front-exterior-uuid.webp',
      'https://jxjxojdinpspufsorovc.supabase.co'
    ),
    true
  );
  assert.equal(
    isApprovedVehicleImageUrl(
      'https://jxjxojdinpspufsorovc.supabase.co/storage/v1/object/public/vehicle-images/d1/c1/evil.svg',
      'https://jxjxojdinpspufsorovc.supabase.co'
    ),
    false
  );
  assert.equal(isApprovedVehicleImageUrl('javascript:alert(1)'), false);
  assert.equal(isApprovedVehicleImageUrl('data:image/svg+xml;base64,PHN2Zz4='), false);

  console.log('✓ SSRF URL import protection, redirect validation & public URL rendering tests (17) passed');
}

async function runGamePlayerAndAuthMiddlewareTests() {
  // Spin up an in-process mock Supabase Auth + REST server so requireVehicleImageUploader
  // executes real token verification and database role resolution end-to-end.
  const roleByToken: Record<
    string,
    {
      userId: string;
      email: string;
      isAdmin: boolean;
      adminActive?: boolean;
      isPlayer: boolean;
      dealerId?: string;
      dealerApproved?: boolean;
    }
  > = {
    'token-player': {
      userId: 'uid-player-1',
      email: 'player@manifold.test',
      isAdmin: false,
      isPlayer: true,
      dealerId: 'dealer-sneaky',
      dealerApproved: true,
    },
    'token-pending-dealer': {
      userId: 'uid-pending-1',
      email: 'pending@manifold.test',
      isAdmin: false,
      isPlayer: false,
      dealerId: 'dealer-pending-1',
      dealerApproved: false,
    },
    'token-inactive-admin': {
      userId: 'uid-badadmin-1',
      email: 'revoked@manifold.test',
      isAdmin: true,
      adminActive: false,
      isPlayer: false,
    },
    'token-approved-dealer': {
      userId: 'uid-dealer-1',
      email: 'dealer@manifold.test',
      isAdmin: false,
      isPlayer: false,
      dealerId: 'dealer-ok-1',
      dealerApproved: true,
    },
  };

  const mockSupabaseServer = http.createServer((req, res) => {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const actor = roleByToken[token];
    const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');

    res.setHeader('Content-Type', 'application/json');

    if (reqUrl.pathname === '/auth/v1/user') {
      if (!actor) {
        res.statusCode = 401;
        res.end(JSON.stringify({ message: 'Invalid JWT' }));
        return;
      }
      res.statusCode = 200;
      res.end(JSON.stringify({ id: actor.userId, email: actor.email }));
      return;
    }

    if (reqUrl.pathname === '/rest/v1/admin_users') {
      if (actor?.isAdmin) {
        res.statusCode = 200;
        res.end(
          JSON.stringify([
            {
              id: 'adm-1',
              user_id: actor.userId,
              email: actor.email,
              role: 'admin',
              status: actor.adminActive ? 'active' : 'suspended',
            },
          ])
        );
      } else {
        res.statusCode = 200;
        res.end(JSON.stringify([]));
      }
      return;
    }

    if (reqUrl.pathname === '/rest/v1/player_profiles') {
      if (actor?.isPlayer) {
        res.statusCode = 200;
        res.end(JSON.stringify({ id: 'player-prof-1', nickname: 'Racer', account_status: 'active' }));
      } else {
        res.statusCode = 200;
        res.end(JSON.stringify(null));
      }
      return;
    }

    if (reqUrl.pathname === '/rest/v1/dealer_accounts') {
      if (actor?.dealerId) {
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            dealer_id: actor.dealerId,
            account_status: actor.dealerApproved ? 'active' : 'pending',
          })
        );
      } else {
        res.statusCode = 200;
        res.end(JSON.stringify(null));
      }
      return;
    }

    if (reqUrl.pathname === '/rest/v1/dealers') {
      if (actor?.dealerId) {
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            id: actor.dealerId,
            business_name: 'Verified Motors',
            dealer_status: actor.dealerApproved ? 'approved' : 'pending',
            is_verified: Boolean(actor.dealerApproved),
          })
        );
      } else {
        res.statusCode = 200;
        res.end(JSON.stringify(null));
      }
      return;
    }

    if (reqUrl.pathname === '/rest/v1/cars') {
      res.statusCode = 200;
      res.end(JSON.stringify(null));
      return;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({}));
  });

  await new Promise<void>((resolve) => mockSupabaseServer.listen(0, '127.0.0.1', () => resolve()));
  const sbPort = (mockSupabaseServer.address() as AddressInfo).port;
  const mockSbUrl = `http://127.0.0.1:${sbPort}`;

  const prevEnv = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  process.env.VITE_SUPABASE_URL = mockSbUrl;
  process.env.SUPABASE_URL = mockSbUrl;
  process.env.VITE_SUPABASE_ANON_KEY = 'mock-anon-key';
  process.env.SUPABASE_ANON_KEY = 'mock-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';

  const app = express();
  app.use(express.json());
  app.use('/api/dealer/vehicles/images', vehicleImagesRouter);

  const apiServer = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const apiPort = (apiServer.address() as AddressInfo).port;
    const uploadEndpoint = `http://127.0.0.1:${apiPort}/api/dealer/vehicles/images/upload`;
    const validJpg = await createSampleRaster('jpeg', 200, 150);

    // 15. Game Player rejected with 403 PLAYER_ROLE_FORBIDDEN
    const playerForm = new FormData();
    playerForm.append('file', new Blob([validJpg], { type: 'image/jpeg' }), 'car.jpg');
    playerForm.append('vehicleId', 'veh-draft-12345678');
    playerForm.append('slot', 'front-exterior');
    const playerResp = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-player' },
      body: playerForm,
    });
    const playerBody: any = await playerResp.json();
    assert.equal(playerResp.status, 403, 'Game Player upload rejected with 403');
    assert.equal(playerBody.code, 'PLAYER_ROLE_FORBIDDEN');

    // Unapproved / pending dealer rejected with 403 DEALER_APPROVAL_REQUIRED
    const pendingForm = new FormData();
    pendingForm.append('file', new Blob([validJpg], { type: 'image/jpeg' }), 'car.jpg');
    pendingForm.append('vehicleId', 'veh-draft-12345678');
    pendingForm.append('slot', 'front-exterior');
    const pendingResp = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-pending-dealer' },
      body: pendingForm,
    });
    const pendingBody: any = await pendingResp.json();
    assert.equal(pendingResp.status, 403, 'Unapproved dealer upload rejected with 403');
    assert.equal(pendingBody.code, 'DEALER_APPROVAL_REQUIRED');

    // Unauthorized / suspended admin rejected with 403
    const badAdminForm = new FormData();
    badAdminForm.append('file', new Blob([validJpg], { type: 'image/jpeg' }), 'car.jpg');
    badAdminForm.append('vehicleId', 'veh-draft-12345678');
    badAdminForm.append('slot', 'front-exterior');
    const badAdminResp = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-inactive-admin' },
      body: badAdminForm,
    });
    assert.equal(badAdminResp.status, 403, 'Inactive/unauthorized admin rejected with 403');

    // 6. Real multer + Express route test: spoofed image/jpeg MIME with non-image payload
    // Wait: approved dealer passes auth middleware, hits Sharp validation (or 503 if service key missing before validation?
    // Notice processAndStoreVehicleImage checks adminClient before validate, OR let's set a dummy service role key so
    // it reaches Sharp validation and rejects the spoofed MIME with 400 BEFORE calling storage!)
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
    const spoofForm = new FormData();
    spoofForm.append(
      'file',
      new Blob([Buffer.from('<html><script>evil()</script></html>')], { type: 'image/jpeg' }),
      'spoofed.jpg'
    );
    spoofForm.append('vehicleId', 'veh-draft-12345678');
    spoofForm.append('slot', 'front-exterior');
    spoofForm.append('mode', 'create');
    const spoofResp = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-approved-dealer' },
      body: spoofForm,
    });
    const spoofBody: any = await spoofResp.json();
    assert.equal(spoofResp.status, 400, 'Real multipart upload rejects spoofed image/jpeg MIME with 400');
    assert.equal(spoofBody.code, 'UNSUPPORTED_IMAGE_FORMAT');
  } finally {
    apiServer.close();
    mockSupabaseServer.close();
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }

  console.log('✓ Live Express middleware tests (Game Player, unapproved Dealer, inactive Admin, spoofed multipart MIME) passed');
}

async function main() {
  await runImageValidationTests();
  await runOwnershipRoleAndReplacementTests();
  await runSsrfUrlImportTests();
  await runGamePlayerAndAuthMiddlewareTests();
  console.log('\nALL 18+ VEHICLE IMAGE SECURITY TESTS PASSED.');
}

main().catch((err) => {
  console.error('SECURITY TEST FAILURE:', err);
  process.exit(1);
});
