import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  normalizeBrowserLocation,
  parseManifoldRoute,
} from '../src/utils/routing.js';

interface TestUserProfile {
  id: string;
  email: string;
  user_metadata: Record<string, any>;
}

const USERS: Record<string, TestUserProfile> = {
  'token-player': {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'player@manifold.test',
    user_metadata: { role: 'player', nickname: 'LagosDrifter' },
  },
  // Attempted privilege escalation: player has dealer metadata too! DB player_profiles MUST win.
  'token-player-spoofed-dealer': {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'spoof@manifold.test',
    user_metadata: { role: 'dealer', nickname: 'Spoofer' },
  },
  'token-admin': {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'admin@manifold.test',
    user_metadata: {},
  },
  'token-dealer': {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'dealer@manifold.test',
    user_metadata: { role: 'dealer' },
  },
  'token-dealer-onboarding': {
    id: '55555555-5555-4555-8555-555555555555',
    email: 'onboarding@manifold.test',
    user_metadata: { role: 'dealer' },
  },
  'token-buyer': {
    id: '66666666-6666-4666-8666-666666666666',
    email: 'buyer@manifold.test',
    user_metadata: {},
  },
};

function startMockSupabaseServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const authHeader = String(req.headers.authorization || '');
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const user = USERS[token] || null;

      res.setHeader('Content-Type', 'application/json');

      // 1. Supabase Auth: GET /auth/v1/user
      if (url.pathname === '/auth/v1/user') {
        if (!user) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'invalid_token', message: 'Invalid JWT' }));
          return;
        }
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            id: user.id,
            aud: 'authenticated',
            role: 'authenticated',
            email: user.email,
            user_metadata: user.user_metadata,
          })
        );
        return;
      }

      // 2. PostgREST RPC fallbacks
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const rpcName = url.pathname.slice('/rest/v1/rpc/'.length);
        if (rpcName === 'is_active_admin' || rpcName === 'is_admin') {
          res.statusCode = 200;
          res.end(JSON.stringify(user?.id === USERS['token-admin'].id));
          return;
        }
        res.statusCode = 200;
        res.end(JSON.stringify(null));
        return;
      }

      // 3. PostgREST Tables
      const accept = String(req.headers.accept || '');
      const isSingleObject = accept.includes('application/vnd.pgrst.object+json');
      const userIdFilter = url.searchParams.get('user_id') || '';
      const idFilter = url.searchParams.get('id') || '';

      const sendSingleOrArray = (rows: any[]) => {
        if (isSingleObject) {
          if (rows.length === 0) {
            res.statusCode = 200;
            // PostgREST maybeSingle uses vnd.pgrst.object+json with 406 or empty check;
            // wait: supabase-js maybeSingle sends Accept: application/vnd.pgrst.object+json and handles 406 PGRST116
            res.statusCode = 406;
            res.end(JSON.stringify({ code: 'PGRST116', message: '0 rows' }));
            return;
          }
          res.statusCode = 200;
          res.end(JSON.stringify(rows[0]));
          return;
        }
        res.statusCode = 200;
        res.end(JSON.stringify(rows));
      };

      if (url.pathname === '/rest/v1/admin_users') {
        const isMatchedAdmin =
          user?.id === USERS['token-admin'].id &&
          (userIdFilter === `eq.${user.id}` || url.searchParams.has('email'));
        sendSingleOrArray(
          isMatchedAdmin
            ? [{ id: 'adm-1', user_id: user.id, email: user.email, status: 'active', role: 'admin' }]
            : []
        );
        return;
      }

      if (url.pathname === '/rest/v1/player_profiles') {
        const isPlayer =
          user &&
          (user.id === USERS['token-player'].id ||
            user.id === USERS['token-player-spoofed-dealer'].id) &&
          userIdFilter === `eq.${user.id}`;
        sendSingleOrArray(
          isPlayer
            ? [{ id: `pl-${user.id.slice(0, 4)}`, user_id: user.id, nickname: 'LagosDriver', account_status: 'active' }]
            : []
        );
        return;
      }

      if (url.pathname === '/rest/v1/dealer_accounts') {
        const hasDealer =
          user &&
          (user.id === USERS['token-dealer'].id ||
            user.id === USERS['token-player-spoofed-dealer'].id) &&
          userIdFilter === `eq.${user.id}`;
        sendSingleOrArray(
          hasDealer
            ? [{ dealer_id: 'dlr-001', user_id: user.id, account_status: 'active' }]
            : []
        );
        return;
      }

      if (url.pathname === '/rest/v1/dealers') {
        if (idFilter === 'eq.dlr-001' || url.pathname === '/rest/v1/dealers') {
          const dealerRows = [
            {
              id: 'dlr-001',
              name: 'Apex Autos Lagos',
              business_name: 'Apex Autos Lagos',
              slug: 'apex-autos-lagos',
              dealer_status: 'approved',
              is_verified: true,
              account_status: 'active',
            },
          ];
          sendSingleOrArray(dealerRows);
          return;
        }
      }

      if (url.pathname === '/rest/v1/cars') {
        res.statusCode = 200;
        res.end(
          JSON.stringify([
            {
              id: 'car-1',
              slug: 'toyota-highlander-2021',
              title: '2021 Toyota Highlander Limited',
              make: 'Toyota',
              model: 'Highlander',
              year: 2021,
              price_ngn: 48500000,
              status: 'published',
              moderation_status: 'approved',
              verification_status: 'verified',
              is_verified: true,
            },
          ])
        );
        return;
      }

      // Default empty JSON array for non-auth metadata tables
      res.statusCode = 200;
      res.end(JSON.stringify([]));
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        throw new Error('Failed to bind mock Supabase server');
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function runTests() {
  console.log('1. Verifying Main App Marketplace & 3D World URL routing...');
  // Root '/' and legacy '/#/' redirect to '/car-marketplace'
  assert.equal(normalizeBrowserLocation('/', '', '').cleanUrl, '/car-marketplace');
  assert.equal(normalizeBrowserLocation('/', '', '#/').cleanUrl, '/car-marketplace');
  assert.equal(normalizeBrowserLocation('/', '', '#/cars?make=Lexus').cleanUrl, '/cars?make=Lexus');

  const rootParsed = parseManifoldRoute('/');
  assert.equal(rootParsed.normalizedRoute, '/car-marketplace');
  assert.equal(rootParsed.scope, 'public');
  assert.equal(rootParsed.isKnownRoute, true);

  // '/3d-world' and '/world' alias resolve cleanly to '/3d-world' without hitting /:dealerSlug
  const worldParsed = parseManifoldRoute('/3d-world');
  assert.equal(worldParsed.normalizedRoute, '/3d-world');
  assert.equal(worldParsed.scope, 'public');
  assert.equal(worldParsed.isKnownRoute, true);
  assert.equal(worldParsed.dealerSlug, null);

  const worldAliasParsed = parseManifoldRoute('/world');
  assert.equal(worldAliasParsed.normalizedRoute, '/3d-world');
  assert.equal(worldAliasParsed.isKnownRoute, true);
  assert.equal(worldAliasParsed.dealerSlug, null);

  // Public car marketplace and dealer storefronts still work
  const carsParsed = parseManifoldRoute('/cars');
  assert.equal(carsParsed.normalizedRoute, '/cars');
  assert.equal(carsParsed.scope, 'public');
  assert.equal(carsParsed.isKnownRoute, true);

  const storefrontParsed = parseManifoldRoute('/apex-autos-lagos');
  assert.equal(storefrontParsed.normalizedRoute, '/:dealerSlug');
  assert.equal(storefrontParsed.dealerSlug, 'apex-autos-lagos');

  // Admin & Dealer routes stay in their scopes
  assert.equal(parseManifoldRoute('/admin').scope, 'admin');
  assert.equal(parseManifoldRoute('/admin/players').scope, 'admin');
  assert.equal(parseManifoldRoute('/dealer/dashboard').scope, 'dealer');
  assert.equal(parseManifoldRoute('/dealer/business-information').scope, 'dealer');

  console.log('2. Starting ephemeral Supabase mock & Express app for HTTP RBAC tests...');
  const { server: mockSbServer, baseUrl: sbUrl } = await startMockSupabaseServer();

  // Configure server env to point to our ephemeral mock Supabase server
  process.env.VITE_SUPABASE_URL = sbUrl;
  process.env.SUPABASE_URL = sbUrl;
  process.env.VITE_SUPABASE_ANON_KEY = 'mock-anon-key';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'mock-anon-key';
  process.env.SUPABASE_ANON_KEY = 'mock-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';

  const { createApp } = await import('../server/app.js');
  const app = createApp();

  const apiServer = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const addr = apiServer.address();
    assert(addr && typeof addr !== 'string');
    const apiBase = `http://127.0.0.1:${addr.port}`;

    const callApi = async (
      endpoint: string,
      opts: { method?: string; token?: string; body?: any } = {}
    ) => {
      const headers: Record<string, string> = {};
      if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
      if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
      const res = await fetch(`${apiBase}${endpoint}`, {
        method: opts.method || 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      return { status: res.status, json };
    };

    // Scenario 1: Game Player logs in & verifies player role
    console.log('3. Scenario 1 — Game Player verified role & player endpoint access...');
    const playerMe = await callApi('/api/auth/me', { token: 'token-player' });
    assert.equal(playerMe.status, 200);
    assert.equal(playerMe.json.role, 'player');
    assert.ok(playerMe.json.playerId);

    const playerCheck = await callApi('/api/auth/player-check', { token: 'token-player' });
    assert.equal(playerCheck.status, 200);
    assert.equal(playerCheck.json.authorized, true);

    // Privilege escalation test: player with spoofed dealer metadata & even dealer_accounts row still resolves to 'player'
    const spoofedMe = await callApi('/api/auth/me', { token: 'token-player-spoofed-dealer' });
    assert.equal(spoofedMe.status, 200);
    assert.equal(spoofedMe.json.role, 'player');

    // Scenario 2: Game Player blocked from Admin APIs
    console.log('4. Scenario 2 — Game Player rejected from all Admin API endpoints...');
    for (const ep of [
      { path: '/api/auth/admin-check', method: 'GET' },
      { path: '/api/ai/admin/overview', method: 'GET' },
      { path: '/api/market-intelligence/agent/status', method: 'GET' },
      { path: '/api/dealers/db-status', method: 'GET' },
      { path: '/api/market-intelligence/db-migration-status', method: 'GET' },
    ]) {
      const res = await callApi(ep.path, { method: ep.method, token: 'token-player' });
      assert.equal(res.status, 403, `Expected 403 on ${ep.path} for Game Player, got ${res.status}`);
      assert.equal(res.json.code, 'PLAYER_ROLE_FORBIDDEN');
    }

    // Scenario 3: Game Player blocked from Dealer APIs (including spoofed metadata player!)
    console.log('5. Scenario 3 — Game Player rejected from all Dealer API endpoints...');
    for (const token of ['token-player', 'token-player-spoofed-dealer']) {
      for (const ep of [
        { path: '/api/auth/dealer-check', method: 'GET', body: undefined },
        { path: '/api/ai/dealer/listing-copy', method: 'POST', body: { make: 'Toyota', model: 'Camry', year: 2020 } },
        { path: '/api/ai/market-insights', method: 'POST', body: { make: 'Toyota', model: 'Camry' } },
      ]) {
        const res = await callApi(ep.path, { method: ep.method, token, body: ep.body });
        assert.equal(res.status, 403, `Expected 403 on ${ep.path} for ${token}, got ${res.status}`);
        assert.equal(res.json.code, 'PLAYER_ROLE_FORBIDDEN');
      }
    }

    // Scenario 5: Admin authorized on Admin routes, rejected on Dealer/Player routes
    console.log('6. Scenario 5 — Admin authorization & separation from Dealer/Player routes...');
    const adminMe = await callApi('/api/auth/me', { token: 'token-admin' });
    assert.equal(adminMe.status, 200);
    assert.equal(adminMe.json.role, 'admin');

    const adminOk = await callApi('/api/auth/admin-check', { token: 'token-admin' });
    assert.equal(adminOk.status, 200);
    assert.equal(adminOk.json.authorized, true);

    const adminOnDealer = await callApi('/api/auth/dealer-check', { token: 'token-admin' });
    assert.equal(adminOnDealer.status, 403);
    assert.equal(adminOnDealer.json.code, 'DEALER_ROLE_REQUIRED');

    const adminOnPlayer = await callApi('/api/auth/player-check', { token: 'token-admin' });
    assert.equal(adminOnPlayer.status, 403);
    assert.equal(adminOnPlayer.json.code, 'PLAYER_ROLE_REQUIRED');

    // Scenario 6: Dealer authorized on Dealer routes, rejected on Admin/Player routes
    console.log('7. Scenario 6 — Dealer authorization & separation from Admin/Player routes...');
    const dealerMe = await callApi('/api/auth/me', { token: 'token-dealer' });
    assert.equal(dealerMe.status, 200);
    assert.equal(dealerMe.json.role, 'dealer');
    assert.equal(dealerMe.json.dealerApproved, true);

    const dealerOk = await callApi('/api/auth/dealer-check', { token: 'token-dealer' });
    assert.equal(dealerOk.status, 200);
    assert.equal(dealerOk.json.authorized, true);

    const dealerOnAdmin = await callApi('/api/auth/admin-check', { token: 'token-dealer' });
    assert.equal(dealerOnAdmin.status, 403);
    assert.equal(dealerOnAdmin.json.code, 'ADMIN_ROLE_REQUIRED');

    const dealerOnPlayer = await callApi('/api/auth/player-check', { token: 'token-dealer' });
    assert.equal(dealerOnPlayer.status, 403);
    assert.equal(dealerOnPlayer.json.code, 'PLAYER_ROLE_REQUIRED');

    // Scenario 7: Logged-out visitor blocked from protected routes, allowed on public routes
    console.log('8. Scenario 7 — Anonymous visitor access control & public marketplace routes...');
    for (const ep of ['/api/auth/me', '/api/auth/admin-check', '/api/auth/dealer-check', '/api/auth/player-check']) {
      const res = await callApi(ep);
      assert.equal(res.status, 401, `Expected 401 on ${ep} without auth, got ${res.status}`);
    }

    const publicCarsRes = await callApi('/api/cars');
    assert.equal(publicCarsRes.status, 200);

    const publicDealersRes = await callApi('/api/dealers/public');
    assert.equal(publicDealersRes.status, 200);

    // Scenario 4 & 8: Frontend RBAC guards, menu hiding, and 3D World audio/routing contract checks
    console.log('9. Scenarios 4 & 8 — Frontend RBAC guards, menu hiding & 3D World navigation...');
    const headerSrc = fs.readFileSync(path.resolve('src/components/Header.tsx'), 'utf8');
    const footerSrc = fs.readFileSync(path.resolve('src/components/Footer.tsx'), 'utf8');
    const dealerGuardSrc = fs.readFileSync(path.resolve('src/components/dealer/DealerGuard.tsx'), 'utf8');
    const adminGuardSrc = fs.readFileSync(path.resolve('src/components/AdminGuard.tsx'), 'utf8');
    const appSrc = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
    const worldLoungeSrc = fs.readFileSync(path.resolve('src/components/world/DealerLoungeModal.tsx'), 'utf8');
    const heroSrc = fs.readFileSync(path.resolve('src/components/Hero.tsx'), 'utf8');

    // Header has Marketplace (/car-marketplace) & 3D World (/3d-world) and hides Admin/Dealer from Game Players
    assert.ok(headerSrc.includes("route: '/car-marketplace'"));
    assert.ok(headerSrc.includes("route: '/3d-world'"));
    assert.ok(headerSrc.includes('isGamePlayer'));
    assert.ok(headerSrc.includes('!isGamePlayer && !showDealer'));

    // Footer hides Dealer Portal, Register Dealership & Admin Sign In from Game Players, links 3D World to /3d-world
    assert.ok(footerSrc.includes("handleNav('/3d-world')"));
    assert.ok(footerSrc.includes("handleNav('/car-marketplace')"));
    assert.ok(footerSrc.includes('!isGamePlayer'));

    // DealerGuard removes hardcoded email backdoor & blocks Game Players
    assert.ok(!dealerGuardSrc.includes('newwavereporters@gmail.com'), 'Hardcoded email bypass must be removed');
    assert.ok(dealerGuardSrc.includes('isPlayerRole'));
    assert.ok(dealerGuardSrc.includes('Access Denied'));

    // AdminGuard blocks Game Players with explicit Access Denied & redirect to /3d-world
    assert.ok(adminGuardSrc.includes("role !== 'admin'"));
    assert.ok(adminGuardSrc.includes("navigate('/3d-world')"));

    // DealerLoungeModal hides Dealer Portal card for Game Players
    assert.ok(worldLoungeSrc.includes('hideDealerPortalActions'));

    // App.tsx mounts ManifoldWorldPage on /3d-world, stops audio when leaving /3d-world, mounts HomePage on /car-marketplace
    assert.ok(appSrc.includes("currentRoute === '/3d-world'"));
    assert.ok(appSrc.includes("currentRoute !== '/3d-world'"));
    assert.ok(appSrc.includes("currentRoute === '/car-marketplace'"));
    assert.ok(heroSrc.includes("navigate('/3d-world')"));

    console.log('✅ All 8 RBAC, API security, and navigation regression tests passed!');
  } finally {
    apiServer.close();
    mockSbServer.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Role separation & navigation test failed:', err);
  process.exit(1);
});
