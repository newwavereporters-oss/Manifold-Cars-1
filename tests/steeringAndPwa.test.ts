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
import {
  UnifiedDrivingStore,
  isScrollPreventableDrivingKey,
  normalizeDrivingAction,
} from '../src/components/world/unifiedDrivingInput';

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

runTest('UnifiedDrivingStore synchronizes Arrow keys with steering wheel rotation and self-centering', () => {
  assert.equal(normalizeDrivingAction('ArrowLeft', 'ArrowLeft'), 'left');
  assert.equal(normalizeDrivingAction('ArrowRight', 'ArrowRight'), 'right');
  assert.equal(normalizeDrivingAction('ArrowUp', 'ArrowUp'), 'forward');
  assert.equal(normalizeDrivingAction('ArrowDown', 'ArrowDown'), 'backward');
  assert.equal(isScrollPreventableDrivingKey('ArrowUp', 'ArrowUp'), true);
  assert.equal(isScrollPreventableDrivingKey('ArrowDown', 'ArrowDown'), true);
  assert.equal(isScrollPreventableDrivingKey('ArrowLeft', 'ArrowLeft'), true);
  assert.equal(isScrollPreventableDrivingKey('ArrowRight', 'ArrowRight'), true);
  assert.equal(isScrollPreventableDrivingKey('h', 'KeyH'), false);

  const store = new UnifiedDrivingStore();
  store.setKeyboardKey('ArrowLeft', true, 'ArrowLeft');
  store.setKeyboardKey('ArrowUp', true, 'ArrowUp');

  for (let i = 0; i < 30; i++) {
    store.step(0.016);
  }
  const leftHeld = store.getSnapshot();
  assert.equal(leftHeld.resolved.forward, true);
  assert.ok(leftHeld.wheelAngleDeg < -110, `Expected wheel rotated left, got ${leftHeld.wheelAngleDeg}`);
  assert.ok(leftHeld.steerAxis > 0.8, `Expected positive left steerAxis, got ${leftHeld.steerAxis}`);

  // Release ArrowLeft while keeping ArrowUp held -> throttle stays active, steering smoothly returns to 0
  store.setKeyboardKey('ArrowLeft', false, 'ArrowLeft');
  const firstRelease = store.step(0.016);
  assert.equal(firstRelease.resolved.forward, true);
  assert.ok(firstRelease.wheelAngleDeg > leftHeld.wheelAngleDeg && firstRelease.wheelAngleDeg < 0);

  for (let i = 0; i < 40; i++) {
    store.step(0.025);
  }
  const centered = store.getSnapshot();
  assert.equal(centered.wheelAngleDeg, 0);
  assert.equal(centered.steerAxis, 0);
  assert.equal(centered.resolved.forward, true);
});

runTest('UnifiedDrivingStore prioritizes active wheel drag over keyboard and resumes smoothly on release', () => {
  const store = new UnifiedDrivingStore();
  store.setKeyboardKey('ArrowLeft', true, 'ArrowLeft');
  for (let i = 0; i < 30; i++) store.step(0.016);
  assert.ok(store.getSnapshot().steerAxis > 0.8);

  // User grabs steering wheel with mouse and turns right (+90 deg) while ArrowLeft stays held
  store.beginWheelDrag(1, 'mouse');
  store.updateWheelDragAngle(90, 1);
  const duringDrag = store.step(0.016);
  assert.equal(duringDrag.isWheelDragging, true);
  assert.equal(duringDrag.wheelAngleDeg, 90);
  assert.ok(duringDrag.steerAxis < -0.5, `Drag must override held ArrowLeft, got ${duringDrag.steerAxis}`);

  // User releases mouse drag while ArrowLeft is still held -> smoothly transitions back left without instant jump
  store.endWheelDrag(1);
  const justAfterRelease = store.step(0.016);
  assert.equal(justAfterRelease.isWheelDragging, false);
  assert.ok(justAfterRelease.wheelAngleDeg > 50 && justAfterRelease.wheelAngleDeg < 90, 'Must transition smoothly without snapping instantly to -135');

  for (let i = 0; i < 40; i++) store.step(0.02);
  const resumedLeft = store.getSnapshot();
  assert.ok(resumedLeft.wheelAngleDeg < -120 && resumedLeft.steerAxis > 0.85, 'Held keyboard steer resumes cleanly after drag release');
});

runTest('UnifiedDrivingStore handles simultaneous opposing keys, alias releases, and clearAllInputs reset', () => {
  const store = new UnifiedDrivingStore();

  // Simultaneous ArrowLeft + a, releasing 'a' must keep ArrowLeft active
  store.setKeyboardKey('ArrowLeft', true, 'ArrowLeft');
  store.setKeyboardKey('a', true, 'KeyA');
  assert.equal(store.getKeyboardSteerDirection(), 1);
  store.setKeyboardKey('a', false, 'KeyA');
  assert.equal(store.getKeyboardSteerDirection(), 1);

  // Simultaneous opposing ArrowLeft + ArrowRight cancels to 0; releasing ArrowLeft yields right (-1)
  store.setKeyboardKey('ArrowRight', true, 'ArrowRight');
  assert.equal(store.getKeyboardSteerDirection(), 0);
  store.setKeyboardKey('ArrowLeft', false, 'ArrowLeft');
  assert.equal(store.getKeyboardSteerDirection(), -1);

  // Blur / modal clear resets everything cleanly
  store.beginWheelDrag(2, 'mouse');
  store.updateWheelDragAngle(65, 2);
  store.setPedal('forward', true);
  store.clearAllInputs(true);
  const cleared = store.getSnapshot();
  assert.equal(cleared.isWheelDragging, false);
  assert.equal(cleared.wheelAngleDeg, 0);
  assert.equal(cleared.steerAxis, 0);
  assert.equal(cleared.resolved.forward, false);
  assert.equal(cleared.resolved.left, false);
  assert.equal(cleared.resolved.right, false);
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
  const worldCanvasSrc = fs.readFileSync(
    path.resolve('src/components/world/WorldCanvas.tsx'),
    'utf8'
  );

  assert.equal(touchControlsSrc.includes('◀'), false, 'Old left arrow button should be removed');
  assert.equal(touchControlsSrc.includes('▶'), false, 'Old right arrow button should be removed');
  assert.equal(touchControlsSrc.includes('SteeringWheelControl'), true, 'MobileTouchControls must render SteeringWheelControl');

  assert.equal(/toyota/i.test(wheelSrc), false, 'SteeringWheelControl must not contain Toyota branding');
  assert.equal(/\bgr\b/i.test(wheelSrc), false, 'SteeringWheelControl must not contain GR branding');
  assert.equal(wheelSrc.includes('e.stopPropagation()'), true, 'Center horn must isolate pointer events from wheel drag');
  assert.equal(wheelSrc.includes('MANIFOLD'), true, 'Steering wheel should display MANIFOLD identity');
  assert.equal(wheelSrc.includes('onLostPointerCapture={endWheelDrag}'), false, 'Must not abort desktop mouse drag on lostpointercapture');
  assert.equal(wheelSrc.includes("window.addEventListener('pointermove'"), true, 'Desktop drag must track pointermove on window');
  assert.equal(worldCanvasSrc.includes('isScrollPreventableDrivingKey'), true, 'WorldCanvas must prevent Arrow keys from scrolling page');
  assert.equal(worldCanvasSrc.includes('unifiedDrivingInput'), true, 'WorldCanvas must read from single unified steering state');
});

import {
  PWAInstallStore,
  PWA_INSTALLED_STORAGE_KEY,
  resolvePWAInstallStatus,
  type BeforeInstallPromptEvent,
  type PWAStorageLike,
} from '../src/hooks/usePWAInstall';

function createMemoryStorage(): PWAStorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, val) => {
      map.set(key, val);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

runTest('PWAInstallStore distinguishes all 5 install states, persists installation across visits, and handles standalone & iOS flows', () => {
  assert.equal(
    resolvePWAInstallStatus({
      isStandalone: true,
      persistedInstalled: false,
      hasDeferredPrompt: true,
      isIOS: false,
      dismissedForSession: true,
    }),
    'standalone'
  );
  assert.equal(
    resolvePWAInstallStatus({
      isStandalone: false,
      persistedInstalled: true,
      hasDeferredPrompt: true,
      isIOS: false,
      dismissedForSession: false,
    }),
    'installed'
  );

  // Chromium browser flow: unavailable -> available -> dismissed -> installed -> persisted on next visit
  const localStore = createMemoryStorage();
  const sessionStore = createMemoryStorage();
  const store = new PWAInstallStore({
    localStorage: localStore,
    sessionStorage: sessionStore,
    navigator: { userAgent: 'Mozilla/5.0 Chrome/126.0' },
  });

  assert.equal(store.getSnapshot().status, 'unavailable');
  assert.equal(store.getSnapshot().isInstalled, false);

  let prevented = false;
  const fakePromptEvent = {
    preventDefault() {
      prevented = true;
    },
    prompt: async () => {},
    userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
  } as unknown as BeforeInstallPromptEvent;

  store.handleBeforeInstallPrompt(fakePromptEvent);
  assert.equal(prevented, true);
  assert.equal(store.getSnapshot().status, 'available');

  store.dismissInstall();
  assert.equal(store.getSnapshot().status, 'dismissed');
  assert.equal(store.getSnapshot().dismissedForSession, true);

  store.confirmInstalled('appinstalled');
  assert.equal(store.getSnapshot().status, 'installed');
  assert.equal(store.getSnapshot().isInstalled, true);
  assert.equal(store.getSnapshot().deferredPrompt, null);
  assert.ok(localStore.getItem(PWA_INSTALLED_STORAGE_KEY), 'Installed state must persist for origin');

  // Subsequent visit in same browser profile stays installed even if browser fires beforeinstallprompt
  const nextVisitStore = new PWAInstallStore({
    localStorage: localStore,
    sessionStorage: createMemoryStorage(),
    navigator: { userAgent: 'Mozilla/5.0 Chrome/126.0' },
  });
  assert.equal(nextVisitStore.getSnapshot().status, 'installed');
  assert.equal(nextVisitStore.getSnapshot().isInstalled, true);
  nextVisitStore.handleBeforeInstallPrompt(fakePromptEvent);
  assert.equal(nextVisitStore.getSnapshot().isInstalled, true);
  assert.equal(nextVisitStore.getSnapshot().deferredPrompt, null);

  // Standalone launch immediately confirms & persists installed state
  const standaloneLocal = createMemoryStorage();
  const standaloneStore = new PWAInstallStore({
    localStorage: standaloneLocal,
    sessionStorage: createMemoryStorage(),
    matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }),
  });
  assert.equal(standaloneStore.getSnapshot().status, 'standalone');
  assert.equal(standaloneStore.getSnapshot().isStandalone, true);
  assert.equal(standaloneStore.getSnapshot().isInstalled, true);
  assert.ok(standaloneLocal.getItem(PWA_INSTALLED_STORAGE_KEY));

  // iOS Safari flow: available -> open modal -> complete flow stops repeated instructions
  const iosLocal = createMemoryStorage();
  const iosStore = new PWAInstallStore({
    localStorage: iosLocal,
    sessionStorage: createMemoryStorage(),
    navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)' },
  });
  assert.equal(iosStore.getSnapshot().isIOS, true);
  assert.equal(iosStore.getSnapshot().status, 'available');
  iosStore.setShowIOSGuide(true);
  assert.equal(iosStore.getSnapshot().showIOSGuide, true);
  iosStore.completeIOSInstallFlow();
  assert.equal(iosStore.getSnapshot().status, 'installed');
  assert.equal(iosStore.getSnapshot().isInstalled, true);
  assert.equal(iosStore.getSnapshot().showIOSGuide, false);
});

runTest('PWA icons, favicon, offline page, prompt update flow, and secure Workbox rules are configured', () => {
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
  assert.equal(viteCfg.includes("registerType: 'prompt'"), true, 'Must use prompt mode so installed apps nudge for updates cleanly');
  assert.equal(viteCfg.includes('skipWaiting: true'), false, 'Must not force skipWaiting: true over prompt update nudge');
  assert.equal(viteCfg.includes("display: 'standalone'"), true);
  assert.equal(viteCfg.includes("purpose: 'maskable'"), true);
  assert.equal(viteCfg.includes("handler: 'NetworkOnly'"), true, 'Private APIs & Supabase must stay NetworkOnly');
  assert.equal(viteCfg.includes('supabase'), true);

  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.equal(indexHtml.includes('/favicon.ico'), true);
  assert.equal(indexHtml.includes('/apple-touch-icon.png'), true);
  assert.equal(indexHtml.includes('name="theme-color"'), true);
});

runTest('PWAInstallButton, FloatingInstallButton, OfflineIndicator update nudge, and Header navigation organization meet spec', () => {
  const buttonSrc = fs.readFileSync(path.resolve('src/components/pwa/PWAInstallButton.tsx'), 'utf8');
  const floatingSrc = fs.readFileSync(path.resolve('src/components/pwa/FloatingInstallButton.tsx'), 'utf8');
  const hookSrc = fs.readFileSync(path.resolve('src/hooks/usePWAInstall.ts'), 'utf8');
  const offlineSrc = fs.readFileSync(path.resolve('src/components/pwa/OfflineIndicator.tsx'), 'utf8');
  const headerSrc = fs.readFileSync(path.resolve('src/components/Header.tsx'), 'utf8');
  const heroSrc = fs.readFileSync(path.resolve('src/components/Hero.tsx'), 'utf8');
  const appSrc = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');

  // Exact button label & complete suppression when installed
  const labelMatches = buttonSrc.match(/<span>Install MANIFOLD<\/span>/g) ?? [];
  assert.equal(labelMatches.length, 3, 'PWAInstallButton header/drawer/compact variants must use exact label Install MANIFOLD');
  assert.equal(floatingSrc.includes('<span>Install MANIFOLD</span>'), true, 'FloatingInstallButton must use exact label Install MANIFOLD');
  assert.equal(floatingSrc.includes('fixed right-4 sm:right-5 bottom-'), true, 'FloatingInstallButton must use fixed bottom-right positioning');
  assert.equal(buttonSrc.includes('if (isInstalled || !canInstall)'), true, 'Must return null everywhere once installed');
  assert.equal(buttonSrc.includes('App Installed'), false, 'Must not show App Installed badge inside navigation');
  assert.equal(floatingSrc.includes('isInstalled || !canInstall || dismissedForSession'), true);
  assert.equal(buttonSrc.includes('completeIOSInstallFlow'), true);
  assert.equal(buttonSrc.includes('Add to Home Screen'), true);

  // Centralized PWA store & SW update nudge without reinstall
  assert.equal(hookSrc.includes('useSyncExternalStore'), true);
  assert.equal(hookSrc.includes("window.addEventListener('beforeinstallprompt'"), true);
  assert.equal(hookSrc.includes("window.addEventListener('appinstalled'"), true);
  assert.equal(hookSrc.includes('(display-mode: standalone)'), true);
  assert.equal(hookSrc.includes(PWA_INSTALLED_STORAGE_KEY), true);
  assert.equal(offlineSrc.includes('<IOSInstallModal />'), true);
  assert.equal(offlineSrc.includes('MANIFOLD Update Ready'), true);
  assert.equal(offlineSrc.includes('Refresh App'), true);
  assert.equal(offlineSrc.includes('reg.update()'), true);

  // Visitor-first Header cleanup & role-aware hamburger organization
  assert.equal(headerSrc.includes('<PWAInstallButton variant="header" />'), false, 'Desktop header must stay clean without competing install button');
  assert.equal(headerSrc.includes('variant="drawer"'), true);
  assert.equal(headerSrc.includes('Browse Cars'), true);
  assert.equal(headerSrc.includes('Explore'), true);
  assert.equal(headerSrc.includes('Account Access'), true);
  assert.equal(headerSrc.includes('Dealer Login'), true);
  assert.equal(headerSrc.includes('Player Login'), true);
  assert.equal(headerSrc.includes('aria-expanded={menuOpen}'), true);
  assert.equal(headerSrc.includes('aria-controls="manifold-nav-menu"'), true);
  assert.equal(heroSrc.includes('<PWAInstallButton variant="compact" />'), true);
  assert.equal(appSrc.includes('<FloatingInstallButton />'), true);
});

console.log(`ALL ${passed} STEERING & PWA TESTS PASSED`);
