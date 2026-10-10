export type SourceType =
  | 'marketplace'
  | 'dealer_site'
  | 'auction'
  | 'classifieds'
  | 'report'
  | 'other';

export type TrustLevel = 'unverified' | 'verified' | 'partner' | 'official';

export type CrawlFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'manual';

export type SubmissionType = 'url' | 'text' | 'file_import';

export type SubmissionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type CrawlJobStatus = 'queued' | 'fetching' | 'extracting' | 'completed' | 'failed';

export type ObservationStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'stale'
  | 'archived';

export interface MarketDataSource {
  id: string;
  name: string;
  base_url: string | null;
  source_type: SourceType;
  trust_level: TrustLevel;
  is_active: boolean;
  crawl_enabled: boolean;
  crawl_frequency: CrawlFrequency;
  last_successful_fetch: string | null;
  last_error: string | null;
  notes: string | null;
  settings?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface MarketDataSubmission {
  id: string;
  source_id: string | null;
  submission_type: SubmissionType;
  raw_content: string | null;
  url: string | null;
  publisher: string | null;
  capture_date: string;
  notes: string | null;
  status: SubmissionStatus;
  items_count: number;
  error_message: string | null;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
  // Resolved display metadata
  source_name?: string;
}

export interface MarketCrawlJob {
  id: string;
  submission_id: string;
  source_id: string | null;
  target_url: string;
  status: CrawlJobStatus;
  attempts: number;
  extracted_count: number;
  last_error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  // Resolved display metadata
  source_name?: string;
}

export interface MarketPriceObservation {
  id: string;
  submission_id: string | null;
  source_id: string | null;
  crawl_job_id: string | null;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  price: number;
  currency: string;
  mileage: number | null;
  mileage_unit: string;
  condition: string; // 'Foreign Used', 'Nigerian Used', 'Brand New'
  location: string | null;
  transmission: string | null;
  fuel_type: string | null;
  engine: string | null;
  vin: string | null;
  source_url: string | null;
  publisher: string | null;
  observed_at: string;
  confidence_score: number;
  status: ObservationStatus;
  rejection_reason: string | null;
  notes: string | null;
  is_synced_to_knowledge_base: boolean;
  knowledge_base_id: string | null;
  created_at: string;
  updated_at: string;
  // Resolved display metadata
  source_name?: string;
  storage_tier?: 'persisted_supabase' | 'local_session_cache';
  evidence_text?: string;
  extraction_method?: string;
}

export interface MarketObservationRevision {
  id: string;
  observation_id: string;
  revised_by: string;
  change_summary: string | null;
  previous_state: Partial<MarketPriceObservation>;
  new_state: Partial<MarketPriceObservation>;
  created_at: string;
}

export interface KnowledgeBaseItem {
  id: string;
  title: string;
  content: string;
  category: string;
  metadata: Record<string, any>;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketIntelligenceMetrics {
  totalObservations: number;
  approvedObservations: number;
  pendingReview: number;
  failedOrRejected: number;
  staleObservations: number;
  activeSources: number;
  queuedOrActiveJobs: number;
  failedJobs: number;
  recentObservations: MarketPriceObservation[];
}

export interface ExtractedVehicleItem {
  make: string;
  model: string;
  year: number;
  trim?: string;
  price: number;
  currency?: string;
  mileage?: number;
  mileage_unit?: string;
  condition?: string;
  location?: string;
  transmission?: string;
  fuel_type?: string;
  engine?: string;
  vin?: string;
  confidence_score?: number;
  notes?: string;
}
