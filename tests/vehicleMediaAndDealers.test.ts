import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  MAX_VEHICLE_IMAGE_BYTES,
  TINYPNG_HINT_MESSAGE,
  TINYPNG_URL,
  calculateFitDimensions,
  shouldShowTinyPngHint,
  validateVehicleImageFile,
  InvalidImageTypeError,
  CorruptImageError,
  ImageTooLargeAfterCompressionError,
} from '../src/utils/imageOptimizer';
import {
  VEHICLE_IMAGES_BUCKET,
  buildVehicleImageStoragePath,
  extractStoragePathFromPublicUrl,
  canActorModifyVehicleImages,
} from '../src/services/vehicleImageService';
import { WatermarkedVehicleImage } from '../src/components/WatermarkedVehicleImage';
import { isPublicMarketplaceCar } from '../src/services/carService';
import { isPublicCarStatus } from '../server/routes/cars';
import {
  slugifyBusinessName,
  assignDealerPermalinkSlugs,
  resolveDealerByPermalinkSlug,
} from '../src/utils/dealerSlug';
import { parseManifoldRoute } from '../src/utils/routing';

function testImageOptimizerValidationAndSizing() {
  assert.equal(MAX_VEHICLE_IMAGE_BYTES, 102400, 'Strict 100 KB (102,400 bytes) limit enforced');
  assert.equal(
    TINYPNG_HINT_MESSAGE,
    'Image is still too large to upload. You can reduce its size using TinyPNG and try again.'
  );
  assert.equal(TINYPNG_URL, 'https://tinypng.com/');

  assert.equal(
    validateVehicleImageFile({ name: 'front.jpg', type: 'image/jpeg', size: 45000 }),
    'image/jpeg'
  );
  assert.equal(
    validateVehicleImageFile({ name: 'cabin.png', type: 'image/png', size: 65000 }),
    'image/png'
  );
  assert.equal(
    validateVehicleImageFile({ name: 'angle.webp', type: 'image/webp', size: 55000 }),
    'image/webp'
  );
  assert.equal(
    validateVehicleImageFile({ name: 'mobile-photo.JPEG', type: '', size: 40000 }),
    'image/jpeg'
  );

  assert.throws(
    () => validateVehicleImageFile({ name: 'vector.svg', type: 'image/svg+xml', size: 1200 }),
    InvalidImageTypeError
  );
  assert.throws(
    () => validateVehicleImageFile({ name: 'anim.gif', type: 'image/gif', size: 50000 }),
    InvalidImageTypeError
  );
  assert.throws(
    () => validateVehicleImageFile({ name: 'empty.jpg', type: 'image/jpeg', size: 0 }),
    CorruptImageError
  );

  assert.deepEqual(calculateFitDimensions(2400, 1800), { width: 1200, height: 900 });
  assert.deepEqual(calculateFitDimensions(1600, 900), { width: 1200, height: 675 });
  assert.deepEqual(calculateFitDimensions(900, 1800), { width: 450, height: 900 });
  assert.deepEqual(calculateFitDimensions(800, 600), { width: 800, height: 600 });

  // Strict conditional TinyPNG rule
  const tooLargeErr = new ImageTooLargeAfterCompressionError(142000);
  assert.equal(tooLargeErr.code, 'IMAGE_TOO_LARGE_AFTER_COMPRESSION');
  assert.equal(tooLargeErr.message, TINYPNG_HINT_MESSAGE);
  assert.equal(shouldShowTinyPngHint('IMAGE_TOO_LARGE_AFTER_COMPRESSION'), true);
  assert.equal(shouldShowTinyPngHint('INVALID_IMAGE_TYPE'), false);
  assert.equal(shouldShowTinyPngHint('CORRUPT_IMAGE'), false);
  assert.equal(shouldShowTinyPngHint('UPLOAD_FAILED'), false);
  assert.equal(shouldShowTinyPngHint(null), false);
  assert.equal(shouldShowTinyPngHint(undefined), false);

  console.log('✓ Image optimizer validation, aspect-fit sizing & conditional TinyPNG checks passed');
}

function testStoragePathAndOwnershipChecks() {
  assert.equal(VEHICLE_IMAGES_BUCKET, 'vehicle-images');

  const path1 = buildVehicleImageStoragePath(
    'dealer-123',
    'vehicle-abc',
    'front-exterior',
    'image/webp'
  );
  assert.equal(path1, 'dealer-123/vehicle-abc/front-exterior.webp');

  const path2 = buildVehicleImageStoragePath(
    '../dealer_99',
    'veh_1',
    'cabin',
    'image/jpeg'
  );
  assert.equal(path2, 'dealer_99/veh_1/cabin.jpg');

  const extracted = extractStoragePathFromPublicUrl(
    'https://jxjxojdinpspufsorovc.supabase.co/storage/v1/object/public/vehicle-images/dealer-123/vehicle-abc/front-exterior.webp?v=1730000000'
  );
  assert.equal(extracted, 'dealer-123/vehicle-abc/front-exterior.webp');
  assert.equal(extractStoragePathFromPublicUrl('https://external.example.com/car.jpg'), null);

  // Ownership & Role isolation
  assert.equal(
    canActorModifyVehicleImages({
      isAdmin: false,
      isGamePlayer: false,
      isApprovedDealer: true,
      actorDealerId: 'dealer-123',
      targetDealerId: 'dealer-123',
    }).allowed,
    true
  );
  assert.equal(
    canActorModifyVehicleImages({
      isAdmin: false,
      isGamePlayer: false,
      isApprovedDealer: true,
      actorDealerId: 'dealer-999',
      targetDealerId: 'dealer-123',
    }).allowed,
    false
  );
  assert.equal(
    canActorModifyVehicleImages({
      isAdmin: false,
      isGamePlayer: false,
      isApprovedDealer: false,
      actorDealerId: 'dealer-123',
      targetDealerId: 'dealer-123',
    }).allowed,
    false
  );
  assert.equal(
    canActorModifyVehicleImages({
      isAdmin: false,
      isGamePlayer: true,
      isApprovedDealer: true,
      actorDealerId: 'dealer-123',
      targetDealerId: 'dealer-123',
    }).allowed,
    false
  );
  assert.equal(
    canActorModifyVehicleImages({
      isAdmin: true,
      isGamePlayer: false,
      isApprovedDealer: false,
      actorDealerId: null,
      targetDealerId: 'dealer-123',
    }).allowed,
    true
  );

  console.log('✓ Vehicle storage path & dealer/admin/player isolation checks passed');
}

function testWatermarkedVehicleImageComponent() {
  const html = renderToStaticMarkup(
    React.createElement(WatermarkedVehicleImage, {
      src: 'https://cdn.example.com/2022-camry.webp',
      alt: '2022 Toyota Camry',
    })
  );

  assert.ok(html.includes('data-manifold-watermarked="true"'), 'Marks watermarked container');
  assert.ok(html.includes('pointer-events-none'), 'Watermark must not intercept pointer clicks');
  assert.ok(html.includes('select-none'), 'Watermark text must not be selectable');
  const manifoldMatches = html.match(/>MANIFOLD</g) || [];
  assert.equal(manifoldMatches.length, 1, 'Renders exactly one MANIFOLD watermark overlay');

  const unwatermarkedHtml = renderToStaticMarkup(
    React.createElement(WatermarkedVehicleImage, {
      src: 'https://cdn.example.com/2022-camry.webp',
      alt: '2022 Toyota Camry',
      showWatermark: false,
    })
  );
  assert.equal(unwatermarkedHtml.includes('>MANIFOLD<'), false);

  const emptyFallbackHtml = renderToStaticMarkup(
    React.createElement(WatermarkedVehicleImage, {
      src: '',
      alt: 'Missing car photo',
    })
  );
  assert.equal(emptyFallbackHtml.includes('<img'), false, 'Empty src renders clean fallback');

  console.log('✓ WatermarkedVehicleImage component rendering & anti-duplication checks passed');
}

function testPublicVisibilityStrictFiltering() {
  assert.equal(isPublicMarketplaceCar({ status: 'PUBLISHED' }), true);
  assert.equal(isPublicMarketplaceCar({ status: 'published' as any }), true);
  assert.equal(isPublicMarketplaceCar({ status: 'DRAFT' }), false);
  assert.equal(isPublicMarketplaceCar({ status: 'PENDING_REVIEW' as any }), false);
  assert.equal(isPublicMarketplaceCar({ status: 'REJECTED' as any }), false);
  assert.equal(isPublicMarketplaceCar({ status: 'ARCHIVED' }), false);
  assert.equal(isPublicMarketplaceCar({ status: 'DELETED' as any }), false);
  assert.equal(isPublicMarketplaceCar({ status: 'UNPUBLISHED' as any }), false);

  assert.equal(isPublicCarStatus('PUBLISHED'), true);
  assert.equal(isPublicCarStatus('DRAFT'), false);
  assert.equal(isPublicCarStatus('PENDING_REVIEW'), false);
  assert.equal(isPublicCarStatus('REJECTED'), false);
  assert.equal(isPublicCarStatus('ARCHIVED'), false);
  assert.equal(isPublicCarStatus('DELETED'), false);

  console.log('✓ Public marketplace strict PUBLISHED-only visibility checks passed');
}

function testDealerSlugsAndCanonicalRouting() {
  assert.equal(slugifyBusinessName('ABC Motors'), 'abc-motors');
  assert.equal(slugifyBusinessName('Apex Luxury & Auto Hub'), 'apex-luxury-and-auto-hub');

  const dealers = [
    { id: '1', name: 'ABC Motors', slug: 'abc-motors-a1b2c3' },
    { id: '2', name: 'ABC Motors', slug: null },
    { id: '3', name: 'Zenith Auto Group', slug: 'zenith-auto-group' },
  ];

  const assigned = assignDealerPermalinkSlugs(dealers);
  assert.equal(assigned[0].permalinkSlug, 'abc-motors');
  assert.equal(assigned[1].permalinkSlug, 'abc-motors-2');
  assert.equal(assigned[2].permalinkSlug, 'zenith-auto-group');

  // Resolution works for canonical clean slug, collided slug, AND legacy 6-hex bookmark
  assert.equal(resolveDealerByPermalinkSlug('abc-motors', dealers)?.id, '1');
  assert.equal(resolveDealerByPermalinkSlug('abc-motors-2', dealers)?.id, '2');
  assert.equal(resolveDealerByPermalinkSlug('abc-motors-a1b2c3', dealers)?.id, '1');
  assert.equal(resolveDealerByPermalinkSlug('unknown-dealer', dealers), null);

  // Canonical /dealers/:dealerSlug routing & 404 boundaries
  const dirRoute = parseManifoldRoute('/dealers');
  assert.equal(dirRoute.normalizedRoute, '/dealers');
  assert.equal(dirRoute.scope, 'public');
  assert.equal(dirRoute.isKnownRoute, true);

  const profileRoute = parseManifoldRoute('/dealers/abc-motors');
  assert.equal(profileRoute.normalizedRoute, '/dealers/:dealerSlug');
  assert.equal(profileRoute.scope, 'public');
  assert.equal(profileRoute.isKnownRoute, true);
  assert.equal(profileRoute.dealerSlug, 'abc-motors');

  const nestedInvalidDealer = parseManifoldRoute('/dealers/abc-motors/extra');
  assert.equal(nestedInvalidDealer.isKnownRoute, false);

  const legacyProfileRoute = parseManifoldRoute('/abc-motors');
  assert.equal(legacyProfileRoute.normalizedRoute, '/:dealerSlug');
  assert.equal(legacyProfileRoute.scope, 'public');
  assert.equal(legacyProfileRoute.isKnownRoute, true);
  assert.equal(legacyProfileRoute.dealerSlug, 'abc-motors');

  console.log('✓ Dealer slug collision handling & /dealers/:dealerSlug routing checks passed');
}

function main() {
  testImageOptimizerValidationAndSizing();
  testStoragePathAndOwnershipChecks();
  testWatermarkedVehicleImageComponent();
  testPublicVisibilityStrictFiltering();
  testDealerSlugsAndCanonicalRouting();
  console.log('\nALL VEHICLE MEDIA, WATERMARK & DEALER DIRECTORY TESTS PASSED.');
}

main();
