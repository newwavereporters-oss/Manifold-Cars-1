import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  MarketDataSource,
  MarketDataSubmission,
  MarketCrawlJob,
  MarketPriceObservation,
  MarketObservationRevision,
  MarketIntelligenceMetrics,
  ExtractedVehicleItem,
  ObservationStatus,
} from '../types/marketIntelligence';

const LOCAL_STORAGE_KEY_OBS = 'manifold_market_observations_cache';
const LOCAL_STORAGE_KEY_SOURCES = 'manifold_market_sources_cache';
const LOCAL_STORAGE_KEY_SUBMISSIONS = 'manifold_market_submissions_cache';
const LOCAL_STORAGE_KEY_REVISIONS = 'manifold_market_revisions_cache';

const DEFAULT_SOURCES: MarketDataSource[] = [
  {
    id: 'src-jiji-ng',
    name: 'Jiji Autos Nigeria',
    base_url: 'https://jiji.ng/cars',
    source_type: 'marketplace',
    trust_level: 'verified',
    is_active: true,
    crawl_enabled: true,
    crawl_frequency: 'daily',
    last_successful_fetch: new Date(Date.now() - 3600000 * 4).toISOString(),
    last_error: null,
    notes: 'Major classifieds platform with verified dealership inventories across Lagos and Abuja.',
  },
  {
    id: 'src-autochek-ng',
    name: 'Cars45 / Autochek Africa',
    base_url: 'https://autochek.africa/ng/cars-for-sale',
    source_type: 'marketplace',
    trust_level: 'verified',
    is_active: true,
    crawl_enabled: true,
    crawl_frequency: 'daily',
    last_successful_fetch: new Date(Date.now() - 3600000 * 8).toISOString(),
    last_error: null,
    notes: 'Standardized 150-point inspected retail and auction vehicles.',
  },
  {
    id: 'src-carmart-ng',
    name: 'Carmart Nigeria',
    base_url: 'https://carmart.ng',
    source_type: 'marketplace',
    trust_level: 'verified',
    is_active: true,
    crawl_enabled: true,
    crawl_frequency: 'weekly',
    last_successful_fetch: new Date(Date.now() - 3600000 * 24).toISOString(),
    last_error: null,
    notes: 'Automotive classifieds portal with dealer direct listings.',
  },
  {
    id: 'src-naijauto-ng',
    name: 'Naijauto Direct',
    base_url: 'https://naijauto.com/cars-for-sale',
    source_type: 'classifieds',
    trust_level: 'unverified',
    is_active: true,
    crawl_enabled: true,
    crawl_frequency: 'weekly',
    last_successful_fetch: null,
    last_error: null,
    notes: 'Consumer vehicle aggregator.',
  },
  {
    id: 'src-dealer-network',
    name: 'MANIFOLD Partner Dealer Desk',
    base_url: 'https://manifold.ng',
    source_type: 'dealer_site',
    trust_level: 'official',
    is_active: true,
    crawl_enabled: false,
    crawl_frequency: 'manual',
    last_successful_fetch: new Date().toISOString(),
    last_error: null,
    notes: 'Physical on-ground verified inventories in Lekki, Ikeja, and Abuja.',
  },
];

const INITIAL_OBSERVATIONS: MarketPriceObservation[] = [
  {
    id: 'obs-001',
    submission_id: 'sub-demo-1',
    source_id: 'src-jiji-ng',
    crawl_job_id: null,
    make: 'Toyota',
    model: 'Camry',
    year: 2021,
    trim: 'XSE',
    price: 33500000,
    currency: 'NGN',
    mileage: 48000,
    mileage_unit: 'km',
    condition: 'Foreign Used',
    location: 'Lekki Phase 1, Lagos',
    transmission: 'Automatic',
    fuel_type: 'Petrol',
    engine: '2.5L 4-Cyl',
    vin: '4T1B11HK5MU******',
    source_url: 'https://jiji.ng/cars/toyota-camry-2021-xse',
    publisher: 'Jiji Autos Nigeria',
    observed_at: new Date().toISOString().split('T')[0],
    confidence_score: 0.94,
    status: 'approved',
    rejection_reason: null,
    notes: 'Full panoramic roof, red leather interior, clean Carfax title.',
    is_synced_to_knowledge_base: true,
    knowledge_base_id: 'kb-001',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    source_name: 'Jiji Autos Nigeria',
  },
  {
    id: 'obs-002',
    submission_id: 'sub-demo-1',
    source_id: 'src-autochek-ng',
    crawl_job_id: null,
    make: 'Lexus',
    model: 'RX 350',
    year: 2020,
    trim: 'F-Sport',
    price: 49000000,
    currency: 'NGN',
    mileage: 62000,
    mileage_unit: 'km',
    condition: 'Foreign Used',
    location: 'Victoria Island, Lagos',
    transmission: 'Automatic',
    fuel_type: 'Petrol',
    engine: '3.5L V6',
    vin: '2T2BZMCA7LC******',
    source_url: 'https://autochek.africa/ng/cars-for-sale/lexus-rx-350-2020',
    publisher: 'Cars45 / Autochek Africa',
    observed_at: new Date().toISOString().split('T')[0],
    confidence_score: 0.96,
    status: 'pending_review',
    rejection_reason: null,
    notes: 'Grade A rating, 360 camera, heads-up display, duty fully paid.',
    is_synced_to_knowledge_base: false,
    knowledge_base_id: null,
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    source_name: 'Cars45 / Autochek Africa',
  },
  {
    id: 'obs-003',
    submission_id: 'sub-demo-2',
    source_id: 'src-carmart-ng',
    crawl_job_id: null,
    make: 'Mercedes-Benz',
    model: 'GLE 450',
    year: 2022,
    trim: 'AMG Line 4MATIC',
    price: 92000000,
    currency: 'NGN',
    mileage: 31000,
    mileage_unit: 'km',
    condition: 'Foreign Used',
    location: 'Maitama, Abuja',
    transmission: 'Automatic',
    fuel_type: 'Petrol',
    engine: '3.0L Turbo Inline-6 Mild Hybrid',
    vin: '4JGFF5KE1NA******',
    source_url: 'https://carmart.ng/gle-450-2022',
    publisher: 'Carmart Nigeria',
    observed_at: new Date().toISOString().split('T')[0],
    confidence_score: 0.91,
    status: 'pending_review',
    rejection_reason: null,
    notes: 'Burmester Sound, 21-inch AMG multi-spoke wheels, ambient lighting.',
    is_synced_to_knowledge_base: false,
    knowledge_base_id: null,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    source_name: 'Carmart Nigeria',
  },
  {
    id: 'obs-004',
    submission_id: 'sub-demo-3',
    source_id: 'src-naijauto-ng',
    crawl_job_id: null,
    make: 'Toyota',
    model: 'Corolla',
    year: 2018,
    trim: 'LE',
    price: 14800000,
    currency: 'NGN',
    mileage: 95000,
    mileage_unit: 'km',
    condition: 'Nigerian Used',
    location: 'Ikeja, Lagos',
    transmission: 'Automatic',
    fuel_type: 'Petrol',
    engine: '1.8L 4-Cyl',
    vin: null,
    source_url: 'https://naijauto.com/toyota-corolla-2018',
    publisher: 'Naijauto Direct',
    observed_at: new Date(Date.now() - 86400000 * 45).toISOString().split('T')[0],
    confidence_score: 0.78,
    status: 'stale',
    rejection_reason: null,
    notes: 'Listing over 40 days old without active price refresh.',
    is_synced_to_knowledge_base: false,
    knowledge_base_id: null,
    created_at: new Date(Date.now() - 86400000 * 45).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 45).toISOString(),
    source_name: 'Naijauto Direct',
  },
  {
    id: 'obs-005',
    submission_id: 'sub-demo-4',
    source_id: 'src-jiji-ng',
    crawl_job_id: null,
    make: 'Honda',
    model: 'Accord',
    year: 2019,
    trim: 'Sport 1.5T',
    price: 8500000,
    currency: 'NGN',
    mileage: 78000,
    mileage_unit: 'km',
    condition: 'Nigerian Used',
    location: 'Alaba, Lagos',
    transmission: 'Automatic',
    fuel_type: 'Petrol',
    engine: '1.5L Turbo',
    vin: null,
    source_url: 'https://jiji.ng/cars/honda-accord-2019-unrealistically-low',
    publisher: 'Jiji Autos Nigeria',
    observed_at: new Date().toISOString().split('T')[0],
    confidence_score: 0.42,
    status: 'rejected',
    rejection_reason: 'Unrealistically low price for 2019 Accord; suspected salvage damage or deposit advance fee fraud.',
    notes: 'Flagged by price boundary heuristic.',
    is_synced_to_knowledge_base: false,
    knowledge_base_id: null,
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    source_name: 'Jiji Autos Nigeria',
  },
];

class MarketIntelligenceService {
  private localSources: MarketDataSource[] = [];
  private localObservations: MarketPriceObservation[] = [];
  private localSubmissions: MarketDataSubmission[] = [];
  private localCrawlJobs: MarketCrawlJob[] = [];
  private localRevisions: MarketObservationRevision[] = [];
  private hasCheckedDb: boolean = false;
  private dbHasTables: boolean = false;

  constructor() {
    this.initLocalCache();
  }

  private initLocalCache() {
    try {
      const storedSources = localStorage.getItem(LOCAL_STORAGE_KEY_SOURCES);
      this.localSources = storedSources ? JSON.parse(storedSources) : DEFAULT_SOURCES;

      const storedObs = localStorage.getItem(LOCAL_STORAGE_KEY_OBS);
      this.localObservations = storedObs ? JSON.parse(storedObs) : INITIAL_OBSERVATIONS;

      const storedSubs = localStorage.getItem(LOCAL_STORAGE_KEY_SUBMISSIONS);
      this.localSubmissions = storedSubs ? JSON.parse(storedSubs) : [];

      const storedRevs = localStorage.getItem(LOCAL_STORAGE_KEY_REVISIONS);
      this.localRevisions = storedRevs ? JSON.parse(storedRevs) : [];
    } catch {
      this.localSources = DEFAULT_SOURCES;
      this.localObservations = INITIAL_OBSERVATIONS;
      this.localSubmissions = [];
      this.localRevisions = [];
    }
  }

  private saveLocalCache() {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_SOURCES, JSON.stringify(this.localSources));
      localStorage.setItem(LOCAL_STORAGE_KEY_OBS, JSON.stringify(this.localObservations));
      localStorage.setItem(LOCAL_STORAGE_KEY_SUBMISSIONS, JSON.stringify(this.localSubmissions));
      localStorage.setItem(LOCAL_STORAGE_KEY_REVISIONS, JSON.stringify(this.localRevisions));
    } catch {
      // storage unavailable or full
    }
  }

  // 1. Verify Supabase tables status
  public async checkDatabaseStatus(): Promise<{
    configured: boolean;
    tablesExist: boolean;
    error?: string;
  }> {
    if (!isSupabaseConfigured) {
      return { configured: false, tablesExist: false };
    }

    try {
      const { data, error } = await supabase
        .from('market_price_observations')
        .select('id')
        .limit(1);

      if (error) {
        this.dbHasTables = false;
        return {
          configured: true,
          tablesExist: false,
          error: error.message || 'Table public.market_price_observations not found.',
        };
      }

      this.dbHasTables = true;
      return { configured: true, tablesExist: true };
    } catch (err: any) {
      this.dbHasTables = false;
      return { configured: true, tablesExist: false, error: err?.message };
    }
  }

  // 2. Overview metrics
  public async getMetrics(): Promise<MarketIntelligenceMetrics> {
    const status = await this.checkDatabaseStatus();

    if (status.tablesExist) {
      try {
        const [
          obsRes,
          appRes,
          penRes,
          rejRes,
          staRes,
          srcRes,
          jobRes,
          failJobRes,
          recRes,
        ] = await Promise.all([
          supabase.from('market_price_observations').select('*', { count: 'exact', head: true }),
          supabase.from('market_price_observations').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
          supabase.from('market_price_observations').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
          supabase.from('market_price_observations').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
          supabase.from('market_price_observations').select('*', { count: 'exact', head: true }).eq('status', 'stale'),
          supabase.from('market_data_sources').select('*', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('market_crawl_jobs').select('*', { count: 'exact', head: true }).in('status', ['queued', 'fetching', 'extracting']),
          supabase.from('market_crawl_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
          supabase.from('market_price_observations').select('*').order('created_at', { ascending: false }).limit(6),
        ]);

        return {
          totalObservations: obsRes.count ?? this.localObservations.length,
          approvedObservations: appRes.count ?? 0,
          pendingReview: penRes.count ?? 0,
          failedOrRejected: rejRes.count ?? 0,
          staleObservations: staRes.count ?? 0,
          activeSources: srcRes.count ?? this.localSources.length,
          queuedOrActiveJobs: jobRes.count ?? 0,
          failedJobs: failJobRes.count ?? 0,
          recentObservations: (recRes.data as MarketPriceObservation[]) || this.localObservations.slice(0, 6),
        };
      } catch (err) {
        console.warn('Error reading live metrics from Supabase, using local cache:', err);
      }
    }

    // Local cache fallback
    const total = this.localObservations.length;
    const approved = this.localObservations.filter((o) => o.status === 'approved').length;
    const pending = this.localObservations.filter((o) => o.status === 'pending_review').length;
    const rejected = this.localObservations.filter((o) => o.status === 'rejected').length;
    const stale = this.localObservations.filter((o) => o.status === 'stale').length;
    const activeSrc = this.localSources.filter((s) => s.is_active).length;

    return {
      totalObservations: total,
      approvedObservations: approved,
      pendingReview: pending,
      failedOrRejected: rejected,
      staleObservations: stale,
      activeSources: activeSrc,
      queuedOrActiveJobs: this.localCrawlJobs.filter((j) => ['queued', 'fetching', 'extracting'].includes(j.status)).length,
      failedJobs: this.localCrawlJobs.filter((j) => j.status === 'failed').length,
      recentObservations: this.localObservations.slice(0, 6),
    };
  }

  // 3. Data Sources management
  public async getSources(): Promise<MarketDataSource[]> {
    const status = await this.checkDatabaseStatus();
    if (status.tablesExist) {
      try {
        const { data, error } = await supabase
          .from('market_data_sources')
          .select('*')
          .order('name');
        if (!error && data && data.length > 0) {
          return data as MarketDataSource[];
        }
      } catch (err) {
        console.warn('Failed to fetch sources from Supabase, using local:', err);
      }
    }
    return this.localSources;
  }

  public async createSource(source: Omit<MarketDataSource, 'id' | 'created_at' | 'updated_at'>): Promise<MarketDataSource> {
    const newId = `src-${Date.now()}`;
    const newSource: MarketDataSource = {
      ...source,
      id: newId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const status = await this.checkDatabaseStatus();
    if (status.tablesExist) {
      try {
        const { data, error } = await supabase
          .from('market_data_sources')
          .insert({
            name: source.name,
            base_url: source.base_url,
            source_type: source.source_type,
            trust_level: source.trust_level,
            is_active: source.is_active,
            crawl_enabled: source.crawl_enabled,
            crawl_frequency: source.crawl_frequency,
            notes: source.notes,
          })
          .select()
          .single();

        if (!error && data) {
          this.localSources.push(data);
          this.saveLocalCache();
          return data;
        }
      } catch (err) {
        console.warn('Error inserting source into Supabase:', err);
      }
    }

    this.localSources.push(newSource);
    this.saveLocalCache();
    return newSource;
  }

  public async updateSource(id: string, updates: Partial<MarketDataSource>): Promise<MarketDataSource | null> {
    const status = await this.checkDatabaseStatus();
    if (status.tablesExist) {
      try {
        const { data, error } = await supabase
          .from('market_data_sources')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          this.localSources = this.localSources.map((s) => (s.id === id ? data : s));
          this.saveLocalCache();
          return data;
        }
      } catch (err) {
        console.warn('Error updating source in Supabase:', err);
      }
    }

    this.localSources = this.localSources.map((s) => (s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s));
    this.saveLocalCache();
    return this.localSources.find((s) => s.id === id) || null;
  }

  // 4. Submissions & Crawl Jobs
  public async getSubmissions(): Promise<MarketDataSubmission[]> {
    const status = await this.checkDatabaseStatus();
    if (status.tablesExist) {
      try {
        const { data, error } = await supabase
          .from('market_data_submissions')
          .select('*, market_data_sources(name)')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((sub: any) => ({
            ...sub,
            source_name: sub.market_data_sources?.name || 'Direct Submission',
          }));
        }
      } catch (err) {
        console.warn('Error fetching submissions from Supabase:', err);
      }
    }
    return this.localSubmissions;
  }

  // Submit URLs
  public async submitUrls(params: {
    urls: string[];
    sourceId: string | null;
    immediate: boolean;
    publisher?: string;
  }): Promise<{
    submissionId: string;
    jobs: MarketCrawlJob[];
    extractedObservations: MarketPriceObservation[];
    error?: string;
  }> {
    const submissionId = `sub-url-${Date.now()}`;
    const sourceObj = this.localSources.find((s) => s.id === params.sourceId);
    const publisherName = params.publisher || sourceObj?.name || 'Web Crawler';

    const submission: MarketDataSubmission = {
      id: submissionId,
      source_id: params.sourceId,
      submission_type: 'url',
      raw_content: params.urls.join('\n'),
      url: params.urls[0] || null,
      publisher: publisherName,
      capture_date: new Date().toISOString().split('T')[0],
      notes: `Batch of ${params.urls.length} vehicle listing URLs submitted.`,
      status: params.immediate ? 'processing' : 'pending',
      items_count: 0,
      error_message: null,
      submitted_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source_name: publisherName,
    };

    this.localSubmissions.unshift(submission);
    this.saveLocalCache();

    // Create crawl jobs
    const jobs: MarketCrawlJob[] = params.urls.map((u, i) => ({
      id: `job-${Date.now()}-${i}`,
      submission_id: submissionId,
      source_id: params.sourceId,
      target_url: u,
      status: 'queued',
      attempts: 0,
      extracted_count: 0,
      last_error: null,
      started_at: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      source_name: publisherName,
    }));

    this.localCrawlJobs.push(...jobs);

    const extractedObservations: MarketPriceObservation[] = [];

    // If immediate execution requested, trigger server-side fetch & extraction for each URL
    if (params.immediate) {
      for (const job of jobs) {
        job.status = 'fetching';
        job.started_at = new Date().toISOString();
        job.attempts += 1;

        try {
          const { data: { session } } = await supabase.auth.getSession();
          const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
          if (session?.access_token) {
            authHeaders['Authorization'] = `Bearer ${session.access_token}`;
          }

          const res = await fetch('/api/market-intelligence/fetch-url', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              url: job.target_url,
              sourceId: job.source_id,
              publisher: publisherName,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.items) && data.items.length > 0) {
              job.status = 'completed';
              job.completed_at = new Date().toISOString();
              job.extracted_count = data.items.length;

              // Convert items to observations
              for (const item of data.items) {
                const obs = await this.saveExtractedObservation({
                  submission_id: submissionId,
                  source_id: job.source_id,
                  crawl_job_id: job.id,
                  item,
                  sourceUrl: job.target_url,
                  publisher: publisherName,
                });
                extractedObservations.push(obs);
              }
            } else {
              job.status = 'failed';
              job.last_error = data.error || 'No vehicle prices extracted from page.';
            }
          } else {
            job.status = 'failed';
            job.last_error = `Server responded with HTTP ${res.status}`;
          }
        } catch (fetchErr: any) {
          job.status = 'failed';
          job.last_error = fetchErr?.message || 'Network request failed';
        }
      }

      submission.status = jobs.every((j) => j.status === 'completed')
        ? 'completed'
        : jobs.some((j) => j.status === 'completed')
        ? 'completed'
        : 'failed';
      submission.items_count = extractedObservations.length;
      this.saveLocalCache();
    }

    return { submissionId, jobs, extractedObservations };
  }

  // Submit Text (Paste listing copy, market reports, catalogues)
  public async submitText(params: {
    text: string;
    sourceId: string | null;
    publisher?: string;
    captureDate?: string;
    notes?: string;
    sourceUrl?: string;
  }): Promise<{
    submissionId: string;
    items: MarketPriceObservation[];
    error?: string;
  }> {
    const submissionId = `sub-txt-${Date.now()}`;
    const sourceObj = this.localSources.find((s) => s.id === params.sourceId);
    const publisherName = params.publisher || sourceObj?.name || 'Manual Paste Submission';

    const submission: MarketDataSubmission = {
      id: submissionId,
      source_id: params.sourceId,
      submission_type: 'text',
      raw_content: params.text,
      url: params.sourceUrl || null,
      publisher: publisherName,
      capture_date: params.captureDate || new Date().toISOString().split('T')[0],
      notes: params.notes || 'Copied vehicle listing text.',
      status: 'processing',
      items_count: 0,
      error_message: null,
      submitted_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source_name: publisherName,
    };

    this.localSubmissions.unshift(submission);
    this.saveLocalCache();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        authHeaders['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/market-intelligence/extract-text', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          text: params.text,
          sourceUrl: params.sourceUrl,
          publisher: publisherName,
          captureDate: params.captureDate,
          notes: params.notes,
        }),
      });

      if (!res.ok) {
        throw new Error(`Extraction service returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const extracted: MarketPriceObservation[] = [];

      if (data.success && Array.isArray(data.items)) {
        for (const item of data.items) {
          const obs = await this.saveExtractedObservation({
            submission_id: submissionId,
            source_id: params.sourceId,
            crawl_job_id: null,
            item,
            sourceUrl: params.sourceUrl || null,
            publisher: publisherName,
          });
          extracted.push(obs);
        }

        if (extracted.length > 0) {
          submission.status = 'completed';
          submission.items_count = extracted.length;
        } else {
          submission.status = 'failed';
          submission.error_message = data.extractionError || data.error || data.warning || 'No vehicle observations detected.';
        }
      } else {
        submission.status = 'failed';
        submission.error_message = data.extractionError || data.error || 'No vehicle observations detected.';
      }

      this.saveLocalCache();
      return { submissionId, items: extracted, error: submission.error_message || undefined };
    } catch (err: any) {
      submission.status = 'failed';
      submission.error_message = err?.message || 'Extraction failed.';
      this.saveLocalCache();
      return { submissionId, items: [], error: err?.message };
    }
  }

  // Submit File Import (CSV)
  public async submitFileImport(params: {
    records: Partial<MarketPriceObservation>[];
    filename: string;
    sourceId: string | null;
  }): Promise<{
    submissionId: string;
    importedCount: number;
    observations: MarketPriceObservation[];
    error?: string;
  }> {
    const submissionId = `sub-file-${Date.now()}`;
    const sourceObj = this.localSources.find((s) => s.id === params.sourceId);
    const publisherName = sourceObj?.name || `CSV: ${params.filename}`;

    const submission: MarketDataSubmission = {
      id: submissionId,
      source_id: params.sourceId,
      submission_type: 'file_import',
      raw_content: `Imported file: ${params.filename} (${params.records.length} parsed records)`,
      url: null,
      publisher: publisherName,
      capture_date: new Date().toISOString().split('T')[0],
      notes: `Batch spreadsheet import of ${params.records.length} vehicles.`,
      status: 'processing',
      items_count: params.records.length,
      error_message: null,
      submitted_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source_name: publisherName,
    };

    this.localSubmissions.unshift(submission);

    const observations: MarketPriceObservation[] = [];
    for (const rec of params.records) {
      if (!rec.make || !rec.model || !rec.price) continue;
      const obs = await this.saveExtractedObservation({
        submission_id: submissionId,
        source_id: params.sourceId,
        crawl_job_id: null,
        item: {
          make: rec.make,
          model: rec.model,
          year: rec.year && rec.year > 1990 ? rec.year : 0,
          trim: rec.trim || undefined,
          price: rec.price,
          currency: rec.currency || 'NGN',
          mileage: rec.mileage || undefined,
          condition: rec.condition || 'Unknown',
          location: rec.location ? rec.location.trim() : undefined,
          transmission: rec.transmission ? rec.transmission.trim() : undefined,
          fuel_type: rec.fuel_type ? rec.fuel_type.trim() : undefined,
          engine: rec.engine || undefined,
          vin: rec.vin || undefined,
          confidence_score: 0.95,
          notes: rec.notes || `Imported from ${params.filename}`,
        },
        sourceUrl: rec.source_url || null,
        publisher: publisherName,
      });
      observations.push(obs);
    }

    submission.status = 'completed';
    submission.items_count = observations.length;
    this.saveLocalCache();

    return {
      submissionId,
      importedCount: observations.length,
      observations,
    };
  }

  // 5. Save an extracted observation into Supabase or local cache
  private async saveExtractedObservation(params: {
    submission_id: string | null;
    source_id: string | null;
    crawl_job_id: string | null;
    item: ExtractedVehicleItem;
    sourceUrl: string | null;
    publisher: string;
  }): Promise<MarketPriceObservation> {
    const newId = `obs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const sourceObj = this.localSources.find((s) => s.id === params.source_id);

    const obs: MarketPriceObservation = {
      id: newId,
      submission_id: params.submission_id,
      source_id: params.source_id,
      crawl_job_id: params.crawl_job_id,
      make: params.item.make,
      model: params.item.model,
      year: Number(params.item.year) > 1990 ? Number(params.item.year) : 0,
      trim: params.item.trim || null,
      price: Number(params.item.price) || 0,
      currency: params.item.currency || 'NGN',
      mileage: params.item.mileage ? Number(params.item.mileage) : null,
      mileage_unit: params.item.mileage_unit || 'km',
      condition: params.item.condition || 'Unknown',
      location: params.item.location ? params.item.location.trim() : null,
      transmission: params.item.transmission ? params.item.transmission.trim() : null,
      fuel_type: params.item.fuel_type ? params.item.fuel_type.trim() : null,
      engine: params.item.engine || null,
      vin: params.item.vin || null,
      source_url: params.sourceUrl,
      publisher: params.publisher,
      observed_at: new Date().toISOString().split('T')[0],
      confidence_score: params.item.confidence_score ?? 0.88,
      status: 'pending_review',
      rejection_reason: null,
      notes: params.item.notes || null,
      is_synced_to_knowledge_base: false,
      knowledge_base_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source_name: sourceObj?.name || params.publisher,
      storage_tier: 'local_session_cache',
      evidence_text: params.item.notes || undefined,
    };

    const status = await this.checkDatabaseStatus();
    if (status.tablesExist) {
      try {
        const { data, error } = await supabase
          .from('market_price_observations')
          .insert({
            submission_id: obs.submission_id,
            source_id: obs.source_id,
            crawl_job_id: obs.crawl_job_id,
            make: obs.make,
            model: obs.model,
            year: obs.year,
            trim: obs.trim,
            price: obs.price,
            currency: obs.currency,
            mileage: obs.mileage,
            mileage_unit: obs.mileage_unit,
            condition: obs.condition,
            location: obs.location,
            transmission: obs.transmission,
            fuel_type: obs.fuel_type,
            engine: obs.engine,
            vin: obs.vin,
            source_url: obs.source_url,
            publisher: obs.publisher,
            observed_at: obs.observed_at,
            confidence_score: obs.confidence_score,
            status: obs.status,
            notes: obs.notes,
          })
          .select()
          .single();

        if (!error && data) {
          const liveObs = { ...data, source_name: obs.source_name, storage_tier: 'persisted_supabase' as const };
          this.localObservations.unshift(liveObs);
          this.saveLocalCache();
          return liveObs;
        }
      } catch (err) {
        console.warn('Error saving observation to Supabase:', err);
      }
    }

    this.localObservations.unshift(obs);
    this.saveLocalCache();
    return obs;
  }

  // 6. Observation Review & Queue Queries
  public async getObservations(filters?: {
    status?: ObservationStatus | 'all';
    search?: string;
    make?: string;
    condition?: string;
  }): Promise<MarketPriceObservation[]> {
    const status = await this.checkDatabaseStatus();
    if (status.tablesExist) {
      try {
        let query = supabase
          .from('market_price_observations')
          .select('*, market_data_sources(name)')
          .order('created_at', { ascending: false });

        if (filters?.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }
        if (filters?.make) {
          query = query.ilike('make', `%${filters.make}%`);
        }
        if (filters?.condition) {
          query = query.eq('condition', filters.condition);
        }

        const { data, error } = await query;
        if (!error && data) {
          let list: MarketPriceObservation[] = data.map((d: any) => ({
            ...d,
            source_name: d.market_data_sources?.name || d.publisher || 'External Listing',
          }));

          if (filters?.search) {
            const s = filters.search.toLowerCase();
            list = list.filter(
              (o) =>
                o.make.toLowerCase().includes(s) ||
                o.model.toLowerCase().includes(s) ||
                (o.trim && o.trim.toLowerCase().includes(s)) ||
                (o.location && o.location.toLowerCase().includes(s))
            );
          }
          return list;
        }
      } catch (err) {
        console.warn('Error querying observations from Supabase:', err);
      }
    }

    // Filter local observations
    let results = [...this.localObservations];
    if (filters?.status && filters.status !== 'all') {
      results = results.filter((o) => o.status === filters.status);
    }
    if (filters?.make) {
      results = results.filter((o) => o.make.toLowerCase().includes(filters.make!.toLowerCase()));
    }
    if (filters?.condition) {
      results = results.filter((o) => o.condition === filters.condition);
    }
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      results = results.filter(
        (o) =>
          o.make.toLowerCase().includes(s) ||
          o.model.toLowerCase().includes(s) ||
          (o.trim && o.trim.toLowerCase().includes(s)) ||
          (o.location && o.location.toLowerCase().includes(s))
      );
    }

    return results;
  }

  // 7. Update Observation (Full Edit Modal + Revision Tracking)
  public async updateObservation(
    id: string,
    updates: Partial<MarketPriceObservation>,
    adminName: string = 'Administrator'
  ): Promise<MarketPriceObservation | null> {
    const existing = this.localObservations.find((o) => o.id === id);
    if (!existing) return null;

    // Track revision
    const revision: MarketObservationRevision = {
      id: `rev-${Date.now()}`,
      observation_id: id,
      revised_by: adminName,
      change_summary: `Updated: ${Object.keys(updates).join(', ')}`,
      previous_state: { ...existing },
      new_state: { ...updates },
      created_at: new Date().toISOString(),
    };
    this.localRevisions.unshift(revision);

    const updatedObs: MarketPriceObservation = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const status = await this.checkDatabaseStatus();
    if (status.tablesExist) {
      try {
        await supabase
          .from('market_observation_revisions')
          .insert({
            observation_id: id,
            revised_by: adminName,
            change_summary: revision.change_summary,
            previous_state: revision.previous_state,
            new_state: revision.new_state,
          });

        const { data, error } = await supabase
          .from('market_price_observations')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          this.localObservations = this.localObservations.map((o) => (o.id === id ? { ...data, source_name: existing.source_name } : o));
          this.saveLocalCache();
          return this.localObservations.find((o) => o.id === id) || null;
        }
      } catch (err) {
        console.warn('Error writing observation update to Supabase:', err);
      }
    }

    this.localObservations = this.localObservations.map((o) => (o.id === id ? updatedObs : o));
    this.saveLocalCache();
    return updatedObs;
  }

  // 8. Update Observation Status (Approve, Reject, Mark Stale, Archive)
  public async updateObservationStatus(
    id: string,
    statusVal: ObservationStatus,
    rejectionReason?: string,
    adminName: string = 'Administrator'
  ): Promise<MarketPriceObservation | null> {
    const updates: Partial<MarketPriceObservation> = {
      status: statusVal,
      rejection_reason: rejectionReason || null,
    };

    const updated = await this.updateObservation(id, updates, adminName);
    if (updated && statusVal === 'approved') {
      await this.syncToKnowledgeBase([id]);
    }
    return updated;
  }

  // 9. Batch Status Update
  public async batchUpdateStatus(
    ids: string[],
    statusVal: ObservationStatus,
    adminName: string = 'Administrator'
  ): Promise<number> {
    let successCount = 0;
    for (const id of ids) {
      const res = await this.updateObservationStatus(id, statusVal, undefined, adminName);
      if (res) successCount += 1;
    }
    return successCount;
  }

  // 10. Fetch Observation Revisions History
  public async getObservationRevisions(observationId: string): Promise<MarketObservationRevision[]> {
    const status = await this.checkDatabaseStatus();
    if (status.tablesExist) {
      try {
        const { data, error } = await supabase
          .from('market_observation_revisions')
          .select('*')
          .eq('observation_id', observationId)
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data as MarketObservationRevision[];
        }
      } catch (err) {
        console.warn('Error fetching revisions from Supabase:', err);
      }
    }

    return this.localRevisions.filter((r) => r.observation_id === observationId);
  }

  // 11. Sync Approved Observations to Knowledge Base
  public async syncToKnowledgeBase(observationIds: string[]): Promise<{
    syncedCount: number;
    error?: string;
  }> {
    const status = await this.checkDatabaseStatus();
    let count = 0;

    for (const id of observationIds) {
      const obs = this.localObservations.find((o) => o.id === id);
      if (!obs || obs.status !== 'approved') continue;

      const title = `[Market Pricing] ${obs.year} ${obs.make} ${obs.model}${obs.trim ? ` ${obs.trim}` : ''} — ₦${obs.price.toLocaleString()}`;
      const content = `
### MANIFOLD Automotive Market Observation
- **Vehicle**: ${obs.year} ${obs.make} ${obs.model} ${obs.trim || ''}
- **Advertised Price**: ₦${obs.price.toLocaleString()} ${obs.currency}
- **Condition**: ${obs.condition}
- **Mileage**: ${obs.mileage ? `${obs.mileage.toLocaleString()} ${obs.mileage_unit}` : 'Not Specified'}
- **Location**: ${obs.location || 'Nigeria'}
- **Transmission**: ${obs.transmission || 'Automatic'}
- **Engine / Fuel**: ${obs.engine || 'Standard'} / ${obs.fuel_type || 'Petrol'}
- **Source Platform**: ${obs.publisher || obs.source_name || 'Market Listing'}
- **Observed Date**: ${obs.observed_at}
- **Verification Confidence**: ${(obs.confidence_score * 100).toFixed(0)}%
- **Notes**: ${obs.notes || 'Inspected market data point.'}
      `.trim();

      const metadata = {
        observation_id: obs.id,
        make: obs.make,
        model: obs.model,
        year: obs.year,
        trim: obs.trim,
        price: obs.price,
        currency: obs.currency,
        condition: obs.condition,
        mileage: obs.mileage,
        location: obs.location,
        publisher: obs.publisher,
        observed_at: obs.observed_at,
        confidence_score: obs.confidence_score,
      };

      if (status.tablesExist) {
        try {
          const { data: kbData } = await supabase
            .from('knowledge_base')
            .upsert({
              title,
              content,
              category: 'market_pricing',
              metadata,
              source_url: obs.source_url,
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (kbData) {
            await supabase
              .from('market_price_observations')
              .update({
                is_synced_to_knowledge_base: true,
                knowledge_base_id: kbData.id,
              })
              .eq('id', obs.id);
          }
        } catch (err) {
          console.warn('Error syncing observation to knowledge_base:', err);
        }
      }

      obs.is_synced_to_knowledge_base = true;
      obs.knowledge_base_id = `kb-${obs.id}`;
      count += 1;
    }

    this.saveLocalCache();
    return { syncedCount: count };
  }
}

export const marketIntelligenceService = new MarketIntelligenceService();
