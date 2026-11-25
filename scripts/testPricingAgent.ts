import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';
import {
  fetchListingPageSafe,
  type FetchResult,
} from '../server/services/marketIntelligenceBackend.js';
import {
  calculateMarketPriceEstimate,
  detectStatisticalOutliers,
} from '../server/services/pricingAgent/calculator.js';
import {
  deduplicateBatch,
  detectDuplicateObservation,
  extractSourceListingId,
  normalizeListingUrl,
} from '../server/services/pricingAgent/deduplicator.js';
import {
  extractFromStructuredJsonLd,
  extractListingDetails,
  parseAccessibleListingHtml,
} from '../server/services/pricingAgent/extractor.js';
import {
  computeVehicleMatchScore,
  filterComparableVehicles,
  normalizeBrandName,
  normalizeMarketCategory,
  normalizeModelName,
} from '../server/services/pricingAgent/matcher.js';
import {
  executeProviderSearch,
  extractNairaPriceFromText,
  getProvidersStatus,
  parseBraveSearchResponse,
  parseGoogleCseResponse,
  parseSerperResponse,
} from '../server/services/pricingAgent/providers.js';
import {
  DEFAULT_AGENT_CONFIG,
  runPricingAgentResearch,
} from '../server/services/pricingAgent/agentRunner.js';
import { computeNextScheduledRunAt } from '../server/services/pricingAgent/scheduler.js';
import type { MatchCandidate } from '../server/services/pricingAgent/types.js';
import {
  marketIntelligenceService,
  MarketSourceSaveError,
} from '../src/services/marketIntelligenceService.js';

let passed = 0;

async function runCase(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`PASS [${passed}]: ${name}`);
}

async function main() {
  // 1. Provider status & unconfigured honest reporting
  await runCase('1. Provider status reports configured/unconfigured honestly', () => {
    const statuses = getProvidersStatus({ serper: 2 }, 50);
    assert.equal(statuses.length, 5);
    const serper = statuses.find((p) => p.key === 'serper')!;
    assert.equal(serper.queriesToday, 2);
    assert.equal(serper.dailyQuotaLimit, 50);
    if (!process.env.SERPER_API_KEY) {
      assert.equal(serper.configured, false);
      assert.ok(serper.missingEnvVars.includes('SERPER_API_KEY'));
    }
  });

  // 2. Search result parsing (Serper, Google CSE, Brave, Naira extraction)
  await runCase('2. Search provider response & Naira price parsing', () => {
    const serperHits = parseSerperResponse({
      organic: [
        {
          title: '2021 Toyota Camry XSE Foreign Used - ₦34,500,000',
          link: 'https://example-autos.ng/cars/2021-toyota-camry-123456',
          snippet: 'Clean Tokunbo 2021 Camry XSE in Lekki Lagos. Price: ₦34.5m',
        },
      ],
    });
    assert.equal(serperHits.length, 1);
    assert.equal(serperHits[0].detectedPriceNgn, 34_500_000);

    const cseHits = parseGoogleCseResponse({
      items: [
        {
          title: '2020 Lexus RX 350 Nigerian Used',
          link: 'https://dealer-portal.ng/lexus-rx350-987654',
          snippet: 'Abuja registered 2020 RX350 going for NGN 42,000,000',
        },
      ],
    });
    assert.equal(cseHits[0].detectedPriceNgn, 42_000_000);

    const braveHits = parseBraveSearchResponse({
      web: {
        results: [
          {
            title: '2019 Honda Accord EX-L',
            url: 'https://cars-nigeria.ng/accord-2019',
            description: 'Asking ₦19.8 million in Ikeja',
          },
        ],
      },
    });
    assert.equal(braveHits[0].detectedPriceNgn, 19_800_000);
    assert.equal(extractNairaPriceFromText('Asking ₦27,500,000 in Abuja'), 27_500_000);
  });

  // 3. Accessible HTML & JSON-LD parsing + missing field preservation (mileage/year)
  await runCase('3. Accessible HTML + JSON-LD extraction & null preservation for missing fields', async () => {
    const htmlFixture = `
      <!doctype html>
      <html>
        <head>
          <title>2021 Toyota Camry SE Foreign Used in Lekki, Lagos</title>
          <meta property="og:image" content="https://cdn.example-autos.ng/camry-2021.jpg" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Car",
              "name": "2021 Toyota Camry SE",
              "brand": { "@type": "Brand", "name": "Toyota" },
              "model": "Camry",
              "vehicleModelDate": "2021",
              "vehicleConfiguration": "SE",
              "itemCondition": "https://schema.org/UsedCondition",
              "description": "Clean Tokunbo 2021 Toyota Camry SE Direct Belgium duty paid in Lekki Lagos",
              "image": "https://cdn.example-autos.ng/camry-2021.jpg",
              "offers": {
                "@type": "Offer",
                "price": "32500000",
                "priceCurrency": "NGN",
                "areaServed": { "@type": "Place", "name": "Lekki, Lagos" }
              }
            }
          </script>
        </head>
        <body><h1>2021 Toyota Camry SE Foreign Used</h1><p>Price: ₦32,500,000</p></body>
      </html>
    `;

    const parsed = parseAccessibleListingHtml(htmlFixture);
    assert.equal(parsed.jsonLdItems.length, 1);
    const extracted = extractFromStructuredJsonLd(
      parsed.jsonLdItems,
      'https://example-autos.ng/cars/camry-2021-998877?utm_source=fb',
      parsed.cleanText,
      parsed.title
    );
    assert.equal(extracted.length, 1);
    assert.equal(extracted[0].askingPrice, 32_500_000);
    assert.equal(extracted[0].marketCategory, 'foreign_used');
    assert.equal(extracted[0].mileage, null); // Preserved null rather than guessing 0 or 50,000
    assert.ok(extracted[0].missingFields.includes('mileage'));
    assert.equal(extracted[0].normalizedUrl, 'https://example-autos.ng/cars/camry-2021-998877');
  });

  // 4. Anti-bot / Cloudflare / 403 / 429 protection detection & skipping without bypass
  await runCase('4. Anti-bot Cloudflare/403 block triggers BLOCKED_BY_PROTECTION cleanly', async () => {
    const blockedFetchFixture: FetchResult = {
      success: false,
      status: 'BLOCKED_BY_PROTECTION',
      httpStatus: 403,
      submittedUrl: 'https://protected-site.ng/car-1',
      finalUrl: 'https://protected-site.ng/car-1',
      fetchTimestamp: new Date().toISOString(),
      error: 'Target website is protected by anti-bot firewall / Cloudflare challenge.',
    };

    const res = await extractListingDetails({
      url: blockedFetchFixture.submittedUrl,
      preFetchedResult: blockedFetchFixture,
    });

    assert.equal(res.fetchStatus, 'BLOCKED_BY_PROTECTION');
    assert.equal(res.httpStatus, 403);
    assert.equal(res.observations.length, 0);
  });

  // 5. SSRF protection rejects localhost & cloud metadata endpoints
  await runCase('5. SSRF protection blocks localhost and AWS/GCP metadata IPs', async () => {
    const localhostRes = await fetchListingPageSafe('http://127.0.0.1:3000/api/health');
    assert.equal(localhostRes.success, false);
    assert.equal(localhostRes.status, 'SSRF_BLOCKED');

    const metadataRes = await fetchListingPageSafe('http://169.254.169.254/latest/meta-data/');
    assert.equal(metadataRes.success, false);
    assert.equal(metadataRes.status, 'SSRF_BLOCKED');
  });

  // 6. Comparable matching rules (2018 vs 2023 rejected, Foreign vs Nigerian Used isolated, RX 350 vs ES 350 rejected)
  await runCase('6. Comparable matching strictly enforces model, ±2yr window & category isolation', () => {
    assert.equal(normalizeBrandName('Mercedes Benz'), 'mercedes-benz');
    assert.equal(normalizeModelName('RX 350'), 'rx350');
    assert.equal(normalizeMarketCategory('Tokunbo Direct Belgium'), 'foreign_used');
    assert.equal(normalizeMarketCategory('Nigerian Used'), 'nigerian_used');

    const subject = {
      make: 'Toyota',
      model: 'Camry',
      year: 2023,
      trim: 'XSE',
      marketCategory: 'foreign_used' as const,
      location: 'Lagos',
    };

    const tooOld = computeVehicleMatchScore(subject, {
      id: 'c-old',
      make: 'Toyota',
      model: 'Camry',
      year: 2018,
      trim: 'XSE',
      marketCategory: 'foreign_used',
      price: 21_000_000,
      observedAt: new Date().toISOString(),
      sourceType: 'external_observation',
    });
    assert.equal(tooOld.isComparable, false);

    const wrongCategory = computeVehicleMatchScore(subject, {
      id: 'c-naija',
      make: 'Toyota',
      model: 'Camry',
      year: 2023,
      trim: 'XSE',
      marketCategory: 'nigerian_used',
      price: 25_000_000,
      observedAt: new Date().toISOString(),
      sourceType: 'external_observation',
    });
    assert.equal(wrongCategory.isComparable, false);

    const wrongModel = computeVehicleMatchScore(
      { make: 'Lexus', model: 'RX 350', year: 2021, marketCategory: 'foreign_used' },
      {
        id: 'c-es350',
        make: 'Lexus',
        model: 'ES 350',
        year: 2021,
        marketCategory: 'foreign_used',
        price: 38_000_000,
        observedAt: new Date().toISOString(),
        sourceType: 'external_observation',
      }
    );
    assert.equal(wrongModel.isComparable, false);

    const exactMatch = computeVehicleMatchScore(subject, {
      id: 'c-ok',
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
      trim: 'XSE',
      marketCategory: 'foreign_used',
      location: 'Lekki, Lagos',
      price: 36_000_000,
      observedAt: new Date().toISOString(),
      sourceType: 'external_observation',
    });
    assert.equal(exactMatch.isComparable, true);
    assert.ok(exactMatch.score >= 80);
  });

  // 7. Duplicate detection (URL normalization, listing ID, fingerprint hash, cross-post similarity)
  await runCase('7. Deduplication catches tracking URLs, shared listing IDs & cross-post clones', () => {
    const u1 = normalizeListingUrl('https://www.jiji.ng/cars/camry-123456.html/?utm_source=ig&fbclid=xyz');
    const u2 = normalizeListingUrl('http://jiji.ng/cars/camry-123456.html');
    assert.equal(u1, u2);
    assert.equal(extractSourceListingId(u1), '123456');

    const { unique, duplicates } = deduplicateBatch([
      {
        id: 'a1',
        normalizedUrl: u1,
        sourceListingId: '123456',
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        marketCategory: 'foreign_used',
        price: 33_000_000,
        mileage: 42000,
        location: 'Lagos',
        description: 'Tokunbo 2021 Toyota Camry XSE clean duty paid Lekki',
        imageUrls: ['https://cdn.site.ng/img1.jpg'],
      },
      {
        id: 'a2-same-url',
        normalizedUrl: u2,
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        marketCategory: 'foreign_used',
        price: 33_000_000,
        location: 'Lagos',
      },
      {
        id: 'a3-cross-post',
        normalizedUrl: 'https://another-site.ng/listings/camry-xse-999',
        sourceListingId: '999',
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        marketCategory: 'foreign_used',
        price: 33_200_000,
        mileage: 42500,
        location: 'Lekki, Lagos',
        description: 'Tokunbo 2021 Toyota Camry XSE clean duty paid Lekki direct buy',
        imageUrls: ['https://cdn.site.ng/img1.jpg'],
      },
    ]);

    assert.equal(unique.length, 1);
    assert.equal(duplicates.length, 2);

    const singleCheck = detectDuplicateObservation(
      {
        normalizedUrl: 'https://third.ng/ad-55',
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        marketCategory: 'foreign_used',
        price: 33_000_000,
        mileage: 42000,
        location: 'Lagos',
      },
      unique
    );
    assert.equal(singleCheck.isDuplicate, true);
  });

  // 8 & 9. Deterministic stats, MAD/IQR outlier rejection, confidence breakdown, and insufficient data (<2 comps)
  await runCase('8. MAD/IQR outlier rejection, quartiles, confidence & insufficient-data handling', () => {
    const nowIso = new Date().toISOString();
    const samples: MatchCandidate[] = [
      { id: '1', make: 'Toyota', model: 'Camry', year: 2021, trim: 'SE', marketCategory: 'foreign_used', mileage: 40000, location: 'Lagos', price: 31_000_000, observedAt: nowIso, sourceType: 'internal_asking', sourceWebsite: 'manifold.ng' },
      { id: '2', make: 'Toyota', model: 'Camry', year: 2021, trim: 'SE', marketCategory: 'foreign_used', mileage: 44000, location: 'Lagos', price: 32_000_000, observedAt: nowIso, sourceType: 'external_observation', sourceWebsite: 'dealerA.ng', sourceTrustLevel: 'verified' },
      { id: '3', make: 'Toyota', model: 'Camry', year: 2021, trim: 'XSE', marketCategory: 'foreign_used', mileage: 38000, location: 'Abuja', price: 33_000_000, observedAt: nowIso, sourceType: 'external_observation', sourceWebsite: 'dealerB.ng', sourceTrustLevel: 'verified' },
      { id: '4', make: 'Toyota', model: 'Camry', year: 2021, trim: 'XLE', marketCategory: 'foreign_used', mileage: 35000, location: 'Lagos', price: 33_500_000, observedAt: nowIso, sourceType: 'external_observation', sourceWebsite: 'dealerC.ng', sourceTrustLevel: 'partner' },
      { id: '5', make: 'Toyota', model: 'Camry', year: 2021, trim: 'SE', marketCategory: 'foreign_used', mileage: 41000, location: 'Lagos', price: 32_500_000, observedAt: nowIso, sourceType: 'external_observation', sourceWebsite: 'dealerD.ng', sourceTrustLevel: 'verified' },
      // Extreme scam/typo outlier (₦4.5M vs ~₦32.5M median)
      { id: 'outlier-scam', make: 'Toyota', model: 'Camry', year: 2021, trim: 'SE', marketCategory: 'foreign_used', mileage: 41000, location: 'Lagos', price: 4_500_000, observedAt: nowIso, sourceType: 'external_observation', sourceWebsite: 'spam.ng' },
    ];

    const outRes = detectStatisticalOutliers(samples);
    assert.equal(outRes.excluded.length, 1);
    assert.equal(outRes.excluded[0].id, 'outlier-scam');

    const estimate = calculateMarketPriceEstimate({
      subject: { make: 'Toyota', model: 'Camry', year: 2021, marketCategory: 'foreign_used', location: 'Lagos' },
      candidates: samples,
    });
    assert.equal(estimate.insufficientData, false);
    assert.equal(estimate.validObservationCount, 5);
    assert.equal(estimate.medianPrice, 32_500_000);
    assert.equal(estimate.priceDistribution.outliersExcludedCount, 1);
    assert.ok(estimate.confidenceScore >= 70);
    assert.equal(estimate.confidenceLevel, 'high');

    // Insufficient data check (< 2 valid comparables)
    const scarce = calculateMarketPriceEstimate({
      subject: { make: 'Porsche', model: 'Taycan', year: 2023, marketCategory: 'brand_new' },
      candidates: [
        { id: 'p1', make: 'Porsche', model: 'Taycan', year: 2023, marketCategory: 'brand_new', price: 240_000_000, observedAt: nowIso, sourceType: 'external_observation' },
      ],
    });
    assert.equal(scarce.insufficientData, true);
    assert.equal(scarce.marketEstimate, null);
    assert.equal(scarce.confidenceLevel, 'insufficient');
  });

  // 10. Scheduler frequency math & manual agent run sanity
  await runCase('9. Scheduler next-run computation & agent dry/fallback execution', async () => {
    const base = new Date('2026-11-25T03:00:00.000Z');
    assert.equal(computeNextScheduledRunAt('daily', base), '2026-11-26T03:00:00.000Z');
    assert.equal(computeNextScheduledRunAt('weekly', base), '2026-12-02T03:00:00.000Z');
    assert.equal(computeNextScheduledRunAt('manual', base), null);
    assert.ok(DEFAULT_AGENT_CONFIG.monthly_provider_budget_usd > 0);

    const dryRun = await runPricingAgentResearch({
      triggerType: 'targeted',
      explicitTargets: [{ make: 'Toyota', model: 'Camry', year: 2021, marketCategory: 'foreign_used' }],
      forceRefresh: true,
    });
    assert.ok(dryRun.runId);
    assert.equal(dryRun.targetsProcessed.length, 1);
  });

  // 11. Live Express route security & authorization verification (no server leak)
  await runCase('10. Express API endpoints enforce admin auth, CRON_SECRET & return honest estimates', async () => {
    const app = createApp();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
      // Unauthenticated admin routes must reject with 401
      const statusUnauth = await fetch(`${baseUrl}/api/market-intelligence/agent/status`);
      assert.equal(statusUnauth.status, 401);

      const runUnauth = await fetch(`${baseUrl}/api/market-intelligence/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(runUnauth.status, 401);

      const cronUnauth = await fetch(`${baseUrl}/api/market-intelligence/agent/cron`, {
        method: 'POST',
      });
      assert.equal(cronUnauth.status, 401);

      // Public migration SQL endpoint & public estimates endpoint succeed cleanly
      const sqlRes = await fetch(`${baseUrl}/api/market-intelligence/agent/migration-sql`);
      assert.equal(sqlRes.status, 200);
      const sqlBody = await sqlRes.text();
      assert.ok(sqlBody.includes('market_price_estimates'));
      assert.ok(sqlBody.includes('pricing_agent_config'));

      const estRes = await fetch(`${baseUrl}/api/market-intelligence/agent/estimates`);
      assert.equal(estRes.status, 200);
      const estJson = (await estRes.json()) as any;
      assert.ok(Array.isArray(estJson.estimates));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // 12. approved_feed schema alignment, empty source handling & query failure propagation
  await runCase('11. approved_feed uses source_name schema and fails honestly on DB error', async () => {
    const selectedColumns: string[] = [];
    const target = {
      make: 'Toyota',
      model: 'Camry',
      year: 2021,
      trim: null,
      marketCategory: 'foreign_used' as const,
      location: 'Lagos',
      queryText: '2021 Toyota Camry foreign used Lagos',
      demandScore: 10,
      reason: 'test',
    };

    const makeMockSupabase = (sourcesResult: { data: any; error: any }) =>
      ({
        from: (table: string) => {
          const chain: any = {
            select: (cols: string) => {
              if (table === 'market_data_sources') selectedColumns.push(cols);
              return chain;
            },
            eq: () => chain,
            limit: async () => sourcesResult,
          };
          return chain;
        },
      } as any);

    // Case A: Query error must return ok: false and preserve error message
    const failRes = await executeProviderSearch({
      providerKey: 'approved_feed',
      target,
      maxResults: 4,
      supabase: makeMockSupabase({
        data: null,
        error: { message: 'permission denied for table market_data_sources' },
      }),
    });
    assert.equal(failRes.ok, false);
    assert.equal(failRes.results.length, 0);
    assert.ok(failRes.error?.includes('permission denied for table market_data_sources'));
    assert.ok(selectedColumns[0]?.includes('source_name'));
    assert.ok(!/\bname\b/.test(selectedColumns[0] || ''));
    assert.ok(!/\bdomain\b/.test(selectedColumns[0] || ''));

    // Case B: Empty market_data_sources table returns ok: true with honest notice
    const emptyRes = await executeProviderSearch({
      providerKey: 'approved_feed',
      target,
      maxResults: 4,
      supabase: makeMockSupabase({ data: [], error: null }),
    });
    assert.equal(emptyRes.ok, true);
    assert.equal(emptyRes.results.length, 0);
    assert.ok(emptyRes.notice?.includes('No active crawl-enabled sources configured'));
  });

  // 13. agentRunner logs success: false and preserves error_message in pricing_provider_usage on query failure
  await runCase('12. agentRunner records success=false and error_message in pricing_provider_usage on query failure', async () => {
    const insertedUsageRows: any[] = [];
    const updatedRuns: any[] = [];

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === 'pricing_agent_config') {
          const chain: any = {
            select: () => chain,
            order: () => chain,
            limit: () => chain,
            maybeSingle: async () => ({
              data: {
                ...DEFAULT_AGENT_CONFIG,
                provider_priority: ['approved_feed'],
              },
              error: null,
            }),
          };
          return chain;
        }
        if (table === 'pricing_provider_usage') {
          return {
            select: () => ({
              gte: async () => ({ data: [], error: null }),
            }),
            insert: async (row: any) => {
              insertedUsageRows.push(row);
              return { error: null };
            },
          };
        }
        if (table === 'pricing_agent_runs') {
          return {
            insert: async () => ({ error: null }),
            update: (payload: any) => ({
              eq: async () => {
                updatedRuns.push(payload);
                return { error: null };
              },
            }),
          };
        }
        if (table === 'market_data_sources') {
          const chain: any = {
            select: () => chain,
            eq: () => chain,
            limit: async () => ({
              data: null,
              error: { message: 'simulated database query failure on market_data_sources' },
            }),
          };
          return chain;
        }
        // Baseline observations / cars / estimates tables
        const genericChain: any = {
          select: () => genericChain,
          eq: () => genericChain,
          ilike: () => genericChain,
          in: () => genericChain,
          order: () => genericChain,
          limit: async () => ({ data: [], error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
          insert: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
        return genericChain;
      },
    };

    const prevUrl = process.env.VITE_SUPABASE_URL;
    const prevKey = process.env.VITE_SUPABASE_ANON_KEY;
    process.env.VITE_SUPABASE_URL = prevUrl || 'https://example-test.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = prevKey || 'test-anon-key';

    let runRes;
    try {
      runRes = await runPricingAgentResearch({
        triggerType: 'targeted',
        explicitTargets: [{ make: 'Toyota', model: 'Camry', year: 2021, marketCategory: 'foreign_used' }],
        forceRefresh: true,
        supabaseOverride: mockSupabase,
      });
    } finally {
      if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL;
      else process.env.VITE_SUPABASE_URL = prevUrl;
      if (prevKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
      else process.env.VITE_SUPABASE_ANON_KEY = prevKey;
    }

    assert.equal(runRes.status, 'partial');
    assert.equal(runRes.providerUsage.approved_feed?.errors, 1);
    assert.ok(runRes.notice?.includes('simulated database query failure on market_data_sources'));

    assert.equal(insertedUsageRows.length, 1);
    assert.equal(insertedUsageRows[0].provider_key, 'approved_feed');
    assert.equal(insertedUsageRows[0].success, false);
    assert.ok(
      String(insertedUsageRows[0].error_message || '').includes(
        'simulated database query failure on market_data_sources'
      )
    );
    assert.equal(updatedRuns.length, 1);
    assert.equal(updatedRuns[0].status, 'partial');
    assert.ok(
      String(updatedRuns[0].error_summary || '').includes(
        'simulated database query failure on market_data_sources'
      )
    );
  });

  // 14. createSource populates created_by/updated_by from Supabase Auth and uses valid market_data_sources columns
  await runCase('13. createSource populates created_by from Supabase Auth and maps actual schema columns', async () => {
    const capturedInserts: any[] = [];
    const authUserId = '9c4e7f21-6c8b-4d4e-9b7a-1234567890ab';

    const mockSupabase: any = {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: authUserId, email: 'admin@manifold.ng' } } },
          error: null,
        }),
        getUser: async () => ({
          data: { user: { id: authUserId, email: 'admin@manifold.ng' } },
          error: null,
        }),
      },
      from: (table: string) => {
        assert.equal(table, 'market_data_sources');
        return {
          insert: (payload: any) => {
            capturedInserts.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'src-uuid-1',
                    ...payload,
                    crawl_frequency_hours: payload.crawl_frequency_hours ?? null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      },
    };

    const created = await marketIntelligenceService.createSource(
      {
        name: '  Carmart Nigeria  ',
        base_url: '   ',
        source_type: 'marketplace',
        trust_level: 'unverified',
        crawl_frequency: 'manual',
        is_active: true,
        crawl_enabled: false,
        notes: '   ',
        last_successful_fetch: null,
        last_error: null,
      },
      mockSupabase
    );

    assert.equal(capturedInserts.length, 1);
    const ins = capturedInserts[0];
    assert.equal(ins.source_name, 'Carmart Nigeria');
    assert.equal(ins.base_url, null);
    assert.equal(ins.notes, null);
    assert.equal(ins.created_by, authUserId);
    assert.equal(ins.updated_by, authUserId);
    assert.equal('crawl_frequency_hours' in ins, false);
    assert.equal('name' in ins, false);
    assert.equal('crawl_frequency' in ins, false);
    assert.equal('settings' in ins, false);
    assert.equal(created.source_name, 'Carmart Nigeria');
    assert.equal(created.crawl_frequency, 'manual');
  });

  // 15. createSource rejects missing auth session and preserves RLS code/details/hint on insert failure
  await runCase('14. createSource rejects missing Auth session and preserves RLS error code, details & hint', async () => {
    const noSessionClient: any = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    };

    await assert.rejects(
      () =>
        marketIntelligenceService.createSource(
          {
            name: 'Carmart Nigeria',
            base_url: 'https://carmart.ng',
            source_type: 'marketplace',
            trust_level: 'unverified',
            crawl_frequency: 'weekly',
            is_active: true,
            crawl_enabled: false,
            notes: null,
            last_successful_fetch: null,
            last_error: null,
          },
          noSessionClient
        ),
      (err: any) => err instanceof MarketSourceSaveError && err.code === 'AUTH_SESSION_MISSING'
    );

    const authUserId = '9c4e7f21-6c8b-4d4e-9b7a-1234567890ab';
    const rlsFailClient: any = {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: authUserId } } }, error: null }),
        getUser: async () => ({ data: { user: { id: authUserId } }, error: null }),
      },
      rpc: async (fn: string) => {
        assert.equal(fn, 'is_active_admin');
        return { data: false, error: null };
      },
      from: (table: string) => {
        if (table === 'admin_users') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          };
        }
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: {
                  code: '42501',
                  message: 'new row violates row-level security policy for table "market_data_sources"',
                  details: 'Failing row contains (id, source_name, ...).',
                  hint: null,
                },
              }),
            }),
          }),
        };
      },
    };

    await assert.rejects(
      () =>
        marketIntelligenceService.createSource(
          {
            name: 'Carmart Nigeria',
            base_url: 'https://carmart.ng',
            source_type: 'marketplace',
            trust_level: 'unverified',
            crawl_frequency: 'weekly',
            is_active: true,
            crawl_enabled: false,
            notes: 'Notes',
            last_successful_fetch: null,
            last_error: null,
          },
          rlsFailClient
        ),
      (err: any) =>
        err instanceof MarketSourceSaveError &&
        err.code === '42501' &&
        err.message.includes('[42501]') &&
        err.message.includes('new row violates row-level security policy') &&
        err.message.includes('is_active_admin()=false') &&
        err.message.includes('no matching row in public.admin_users')
    );
  });

  console.log(`\nALL ${passed} PRICING AGENT VERIFICATION SUITES PASSED.`);
}

main().catch((err) => {
  console.error('PRICING AGENT TEST FAILURE:', err);
  process.exit(1);
});
