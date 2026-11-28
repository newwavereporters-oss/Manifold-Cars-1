import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  MAX_STEERING_WHEEL_DEG,
  clampSteeringWheelDeg,
  mapWheelAngleToSteerAxis,
  stepVisualWheelReturn,
  unwrapPointerAngleDelta,
} from '../src/components/world/steeringWheelMath';
import {
  VEHICLE_SPEC_PROFILES,
  computeTargetSteerAngle,
} from '../src/components/world/worldModels';

let passed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    throw err;
  }
}

runTest('Steering wheel angle clamps within realistic lock bounds and unwraps +/-180 deg cleanly', () => {
  assert.equal(clampSteeringWheelDeg(250), MAX_STEERING_WHEEL_DEG);
  assert.equal(clampSteeringWheelDeg(-250), -MAX_STEERING_WHEEL_DEG);
  assert.equal(clampSteeringWheelDeg(Number.NaN), 0);

  // Crossing +179 -> -179 clockwise is +2 deg, NOT -358 deg
  assert.equal(unwrapPointerAngleDelta(179, -179), 2);
  // Crossing -179 -> +179 counter-clockwise is -2 deg, NOT +358 deg
  assert.equal(unwrapPointerAngleDelta(-179, 179), -2);
});

runTest('Steering wheel maps clockwise/right and counter-clockwise/left proportionally with deadzone', () => {
  assert.equal(mapWheelAngleToSteerAxis(0), 0);
  assert.equal(mapWheelAngleToSteerAxis(1.5), 0);
  assert.equal(mapWheelAngleToSteerAxis(-1.5), 0);

  // Clockwise (+deg) -> right turn => negative steerAxis in WorldCanvas convention
  const fullRightAxis = mapWheelAngleToSteerAxis(MAX_STEERING_WHEEL_DEG);
  assert.equal(fullRightAxis, -1);

  // Counter-clockwise (-deg) -> left turn => positive steerAxis in WorldCanvas convention
  const fullLeftAxis = mapWheelAngleToSteerAxis(-MAX_STEERING_WHEEL_DEG);
  assert.equal(fullLeftAxis, 1);

  const halfRightAxis = mapWheelAngleToSteerAxis(MAX_STEERING_WHEEL_DEG * 0.5);
  assert.ok(halfRightAxis < -0.35 && halfRightAxis > -0.65, `Expected proportional half-right axis, got ${halfRightAxis}`);

  const coupe = VEHICLE_SPEC_PROFILES.SPORTS_COUPE;
  const fullSteer = computeTargetSteerAngle({
    steerInput: fullLeftAxis,
    maxSteer: coupe.maxSteer,
    speed: 5,
    effectiveMaxSpeed: 48,
  });
  const halfSteer = computeTargetSteerAngle({
    steerInput: -halfRightAxis,
    maxSteer: coupe.maxSteer,
    speed: 5,
    effectiveMaxSpeed: 48,
  });
  assert.ok(halfSteer > 0 && halfSteer < fullSteer, 'Analog steering wheel produces proportional wheel angle');
});

runTest('Released steering wheel returns smoothly toward center without overshoot', () => {
  let deg = 120;
  for (let i = 0; i < 40; i++) {
    const next = stepVisualWheelReturn(deg, 0.033);
    assert.ok(next >= 0 && next <= deg, `Expected monotonic return toward 0: prev=${deg}, next=${next}`);
    deg = next;
  }
  assert.equal(deg, 0, 'Wheel should settle cleanly back to 0 deg');
});

runTest('SteeringWheelControl and MobileTouchControls replace arrow buttons cleanly without Toyota/GR marks', () => {
  const touchControlsSrc = fs.readFileSync(
    path.resolve('src/components/world/MobileTouchControls.tsx'),
    'utf8'
  );
  const wheelSrc = fs.readFileSync(
    path.resolve('src/components/world/SteeringWheelControl.tsx'),
    'utf8'
  );

  assert.equal(touchControlsSrc.includes('◀'), false, 'Old left arrow button should be removed');
  assert.equal(touchControlsSrc.includes('▶'), false, 'Old right arrow button should be removed');
  assert.equal(touchControlsSrc.includes('SteeringWheelControl'), true, 'MobileTouchControls must render SteeringWheelControl');

  assert.equal(/toyota/i.test(wheelSrc), false, 'SteeringWheelControl must not contain Toyota branding');
  assert.equal(/\bgr\b/i.test(wheelSrc), false, 'SteeringWheelControl must not contain GR branding');
  assert.equal(wheelSrc.includes('e.stopPropagation()'), true, 'Center horn must isolate pointer events from wheel drag');
  assert.equal(wheelSrc.includes('MANIFOLD'), true, 'Steering wheel should display MANIFOLD identity');
});

runTest('PWA icons, favicon, offline page, and secure Workbox rules are configured', () => {
  const requiredAssets = [
    'public/favicon.ico',
    'public/apple-touch-icon.png',
    'public/offline.html',
    'public/icons/icon-16.png',
    'public/icons/icon-32.png',
    'public/icons/icon-48.png',
    'public/icons/icon-192.png',
    'public/icons/icon-512.png',
    'public/icons/maskable-icon-192.png',
    'public/icons/maskable-icon-512.png',
  ];

  for (const rel of requiredAssets) {
    const abs = path.resolve(rel);
    assert.equal(fs.existsSync(abs), true, `Missing required PWA asset: ${rel}`);
    assert.ok(fs.statSync(abs).size > 0, `PWA asset must not be empty: ${rel}`);
  }

  const viteCfg = fs.readFileSync(path.resolve('vite.config.ts'), 'utf8');
  assert.equal(viteCfg.includes('VitePWA'), true);
  assert.equal(viteCfg.includes("display: 'standalone'"), true);
  assert.equal(viteCfg.includes("purpose: 'maskable'"), true);
  assert.equal(viteCfg.includes("handler: 'NetworkOnly'"), true, 'Private APIs & Supabase must stay NetworkOnly');
  assert.equal(viteCfg.includes('supabase'), true);

  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.equal(indexHtml.includes('/favicon.ico'), true);
  assert.equal(indexHtml.includes('/apple-touch-icon.png'), true);
  assert.equal(indexHtml.includes('name="theme-color"'), true);
});

runTest('PWAInstallButton and FloatingInstallButton use red MANIFOLD styling, exact Install MANIFOLD label, shared store, iOS guide, and guards', () => {
  const buttonSrc = fs.readFileSync(path.resolve('src/components/pwa/PWAInstallButton.tsx'), 'utf8');
  const floatingSrc = fs.readFileSync(path.resolve('src/components/pwa/FloatingInstallButton.tsx'), 'utf8');
  const hookSrc = fs.readFileSync(path.resolve('src/hooks/usePWAInstall.ts'), 'utf8');
  const offlineSrc = fs.readFileSync(path.resolve('src/components/pwa/OfflineIndicator.tsx'), 'utf8');
  const headerSrc = fs.readFileSync(path.resolve('src/components/Header.tsx'), 'utf8');
  const heroSrc = fs.readFileSync(path.resolve('src/components/Hero.tsx'), 'utf8');
  const appSrc = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');

  // Exact button label & red white-text styling across all variants (header, drawer, compact + FloatingInstallButton)
  const labelMatches = buttonSrc.match(/<span>Install MANIFOLD<\/span>/g) ?? [];
  assert.equal(labelMatches.length, 3, 'PWAInstallButton header/drawer/compact variants must use exact label Install MANIFOLD');
  assert.equal(floatingSrc.includes('<span>Install MANIFOLD</span>'), true, 'FloatingInstallButton must use exact label Install MANIFOLD');
  assert.equal(floatingSrc.includes('fixed right-4 sm:right-5 bottom-'), true, 'FloatingInstallButton must use fixed bottom-right positioning');
  assert.equal(buttonSrc.includes('bg-[#EF233C] hover:bg-[#d91b32] active:scale-[0.98] text-white'), true);
  assert.equal(floatingSrc.includes('bg-[#EF233C] hover:bg-[#d91b32] active:scale-[0.98] text-white'), true);
  assert.equal(buttonSrc.includes('App Installed'), true, 'Drawer variant must render subtle App Installed status when standalone');
  assert.equal(buttonSrc.includes('if (!canInstall) return null'), true, 'Unavailable browsers must not render broken/inactive button');
  assert.equal(floatingSrc.includes('isInstalled || !canInstall || dismissedForSession'), true, 'FloatingInstallButton must guard installed, unavailable, and session dismissal');
  assert.equal(floatingSrc.includes('setShowIOSGuide(true)'), true, 'FloatingInstallButton must support opening iOS guidance modal');
  assert.equal(buttonSrc.includes('Add to Home Screen'), true, 'iOS Safari guide must reference Share -> Add to Home Screen');
  assert.equal(buttonSrc.includes('<strong>Share</strong>'), true);

  // Shared external store prevents missed beforeinstallprompt and duplicate prompts + persists session dismissal
  assert.equal(hookSrc.includes('useSyncExternalStore'), true);
  assert.equal(hookSrc.includes("window.addEventListener('beforeinstallprompt'"), true);
  assert.equal(hookSrc.includes('e.preventDefault()'), true);
  assert.equal(hookSrc.includes('await promptEvent.prompt()'), true);
  assert.equal(hookSrc.includes('manifold_pwa_dismissed_session'), true);
  assert.equal(hookSrc.includes('dismissInstall'), true);

  // Global IOSInstallModal mounted inside OfflineIndicator so closing mobile drawer cannot unmount it
  assert.equal(offlineSrc.includes('<IOSInstallModal />'), true);

  // Desktop Header + Mobile Drawer + Compact Mobile Homepage + Floating Public Marketplace placement
  assert.equal(headerSrc.includes('<PWAInstallButton variant="header" />'), true);
  assert.equal(headerSrc.includes('variant="drawer"'), true);
  assert.equal(heroSrc.includes('<PWAInstallButton variant="compact" />'), true);
  assert.equal(appSrc.includes('<FloatingInstallButton />'), true);
});

console.log(`ALL ${passed} STEERING & PWA TESTS PASSED`);
