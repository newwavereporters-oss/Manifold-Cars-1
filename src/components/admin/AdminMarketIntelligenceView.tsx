import React, { useState, useEffect } from 'react';
import {
  marketIntelligenceService,
} from '../../services/marketIntelligenceService';
import {
  MarketDataSource,
  MarketPriceObservation,
  MarketCrawlJob,
  MarketObservationRevision,
  MarketIntelligenceMetrics,
  ObservationStatus,
  SourceType,
  TrustLevel,
  CrawlFrequency,
} from '../../types/marketIntelligence';
import {
  Database,
  Globe,
  Upload,
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  ExternalLink,
  Plus,
  Edit2,
  History,
  Sparkles,
  Layers,
  TrendingUp,
  ShieldCheck,
  Check,
  Copy,
  ChevronRight,
  Filter,
  CheckSquare,
  Square,
  BookOpen,
} from 'lucide-react';

export const AdminMarketIntelligenceView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'submit' | 'sources' | 'review'>('overview');
  const [submitMethod, setSubmitMethod] = useState<'url' | 'text' | 'file'>('url');
  
  // Data state
  const [metrics, setMetrics] = useState<MarketIntelligenceMetrics | null>(null);
  const [sources, setSources] = useState<MarketDataSource[]>([]);
  const [observations, setObservations] = useState<MarketPriceObservation[]>([]);
  const [recentCrawlJobs, setRecentCrawlJobs] = useState<MarketCrawlJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ configured: boolean; tablesExist: boolean; error?: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Review Queue filters
  const [statusFilter, setStatusFilter] = useState<ObservationStatus | 'all'>('pending_review');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedObsIds, setSelectedObsIds] = useState<string[]>([]);

  // Modals & Drawers
  const [editingObs, setEditingObs] = useState<MarketPriceObservation | null>(null);
  const [rejectingObsId, setRejectingObsId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [historyObsId, setHistoryObsId] = useState<string | null>(null);
  const [historyRevisions, setHistoryRevisions] = useState<MarketObservationRevision[]>([]);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [editingSource, setEditingSource] = useState<MarketDataSource | null>(null);

  // Form State: Submit URLs
  const [urlInput, setUrlInput] = useState('');
  const [urlSourceId, setUrlSourceId] = useState('');
  const [urlImmediate, setUrlImmediate] = useState(true);
  const [isUrlSubmitting, setIsUrlSubmitting] = useState(false);
  const [activeUrlJobs, setActiveUrlJobs] = useState<MarketCrawlJob[]>([]);

  // Form State: Submit Text
  const [textInput, setTextInput] = useState('');
  const [textSourceId, setTextSourceId] = useState('');
  const [textPublisher, setTextPublisher] = useState('');
  const [textSourceUrl, setTextSourceUrl] = useState('');
  const [textNotes, setTextNotes] = useState('');
  const [isTextExtracting, setIsTextExtracting] = useState(false);
  const [extractedFromText, setExtractedFromText] = useState<MarketPriceObservation[]>([]);

  // Form State: File Import
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedCsvRows, setParsedCsvRows] = useState<Partial<MarketPriceObservation>[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [fileSourceId, setFileSourceId] = useState('');
  const [isFileImporting, setIsFileImporting] = useState(false);

  // Source Form State
  const [srcName, setSrcName] = useState('');
  const [srcBaseUrl, setSrcBaseUrl] = useState('');
  const [srcType, setSrcType] = useState<SourceType>('marketplace');
  const [srcTrust, setSrcTrust] = useState<TrustLevel>('verified');
  const [srcFreq, setSrcFreq] = useState<CrawlFrequency>('daily');
  const [srcActive, setSrcActive] = useState(true);
  const [srcCrawlEnabled, setSrcCrawlEnabled] = useState(true);
  const [srcNotes, setSrcNotes] = useState('');

  const showNotify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4500);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [dbStat, m, s, obsList] = await Promise.all([
        marketIntelligenceService.checkDatabaseStatus(),
        marketIntelligenceService.getMetrics(),
        marketIntelligenceService.getSources(),
        marketIntelligenceService.getObservations({ status: statusFilter, search: searchFilter }),
      ]);
      setDbStatus(dbStat);
      setMetrics(m);
      setSources(s);
      setObservations(obsList);
    } catch (err) {
      console.error('Error loading market intelligence data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [statusFilter]);

  const handleSearchTrigger = async () => {
    setLoading(true);
    try {
      const obsList = await marketIntelligenceService.getObservations({
        status: statusFilter,
        search: searchFilter,
      });
      setObservations(obsList);
    } finally {
      setLoading(false);
    }
  };

  // Submit URLs Handler
  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = urlInput
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http'));

    if (urls.length === 0) {
      showNotify('Please enter at least one valid HTTP/HTTPS vehicle listing URL.');
      return;
    }

    setIsUrlSubmitting(true);
    try {
      const result = await marketIntelligenceService.submitUrls({
        urls,
        sourceId: urlSourceId || null,
        immediate: urlImmediate,
      });

      setActiveUrlJobs(result.jobs);
      setRecentCrawlJobs(result.jobs);
      showNotify(`Submitted ${urls.length} URLs for processing.`);
      setUrlInput('');
      await loadAllData();
    } catch (err: any) {
      showNotify(`URL submission error: ${err?.message || 'Failed'}`);
    } finally {
      setIsUrlSubmitting(false);
    }
  };

  // Submit Text Handler
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || textInput.length < 20) {
      showNotify('Please provide vehicle listing text or market copy (at least 20 characters).');
      return;
    }

    setIsTextExtracting(true);
    try {
      const result = await marketIntelligenceService.submitText({
        text: textInput,
        sourceId: textSourceId || null,
        publisher: textPublisher,
        sourceUrl: textSourceUrl,
        notes: textNotes,
      });

      if (result.items.length > 0) {
        setExtractedFromText(result.items);
        showNotify(`Successfully extracted ${result.items.length} verified vehicle observations with Gemini AI!`);
        setTextInput('');
        await loadAllData();
      } else {
        showNotify(result.error || 'No verified vehicle price records met the strict extraction criteria.');
      }
    } catch (err: any) {
      showNotify(`Extraction error: ${err?.message || 'Processing failed'}`);
    } finally {
      setIsTextExtracting(false);
    }
  };

  // CSV Parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseCsvText(content);
    };
    reader.readAsText(file);
  };

  const parseCsvText = (csv: string) => {
    setFileContent(csv);
    const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      setCsvErrors(['CSV must contain a header row and at least one data row.']);
      setParsedCsvRows([]);
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
    const rows: Partial<MarketPriceObservation>[] = [];
    const errors: string[] = [];

    // Identify header positions
    const makeIdx = headers.findIndex((h) => h.includes('make') || h.includes('brand'));
    const modelIdx = headers.findIndex((h) => h.includes('model'));
    const yearIdx = headers.findIndex((h) => h.includes('year'));
    const priceIdx = headers.findIndex((h) => h.includes('price') || h.includes('amount'));
    const trimIdx = headers.findIndex((h) => h.includes('trim') || h.includes('variant'));
    const conditionIdx = headers.findIndex((h) => h.includes('condition'));
    const mileageIdx = headers.findIndex((h) => h.includes('mileage') || h.includes('km') || h.includes('odometer'));
    const locationIdx = headers.findIndex((h) => h.includes('location') || h.includes('city') || h.includes('state'));
    const urlIdx = headers.findIndex((h) => h.includes('url') || h.includes('link'));

    if (makeIdx === -1 || modelIdx === -1 || priceIdx === -1) {
      errors.push('Missing required column headers: CSV must include Make, Model, and Price.');
    }

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 3) continue;

      const make = makeIdx !== -1 ? cols[makeIdx] : '';
      const model = modelIdx !== -1 ? cols[modelIdx] : '';
      const year = yearIdx !== -1 ? parseInt(cols[yearIdx], 10) : 2020;
      const rawPrice = priceIdx !== -1 ? cols[priceIdx].replace(/[^0-9.]/g, '') : '0';
      const price = parseFloat(rawPrice);

      if (!make || !model || !price || isNaN(price)) {
        errors.push(`Row ${i + 1}: Missing make, model, or valid numeric price.`);
        continue;
      }

      rows.push({
        make,
        model,
        year: isNaN(year) ? 0 : year,
        price,
        currency: 'NGN',
        trim: trimIdx !== -1 ? cols[trimIdx] : undefined,
        condition: conditionIdx !== -1 && cols[conditionIdx] ? cols[conditionIdx] : 'Unknown',
        mileage: mileageIdx !== -1 && !isNaN(parseInt(cols[mileageIdx], 10)) ? parseInt(cols[mileageIdx], 10) : undefined,
        location: locationIdx !== -1 && cols[locationIdx] ? cols[locationIdx].trim() : undefined,
        source_url: urlIdx !== -1 ? cols[urlIdx] : undefined,
      });
    }

    setParsedCsvRows(rows);
    setCsvErrors(errors);
  };

  const handleFileImportSubmit = async () => {
    if (parsedCsvRows.length === 0) {
      showNotify('No valid rows available to import.');
      return;
    }

    setIsFileImporting(true);
    try {
      const res = await marketIntelligenceService.submitFileImport({
        records: parsedCsvRows,
        filename: fileName || 'manual_import.csv',
        sourceId: fileSourceId || null,
      });

      showNotify(`Successfully imported ${res.importedCount} vehicle price observations into Review Queue!`);
      setParsedCsvRows([]);
      setFileContent('');
      setFileName('');
      await loadAllData();
    } catch (err: any) {
      showNotify(`Import failed: ${err?.message || 'Error importing records'}`);
    } finally {
      setIsFileImporting(false);
    }
  };

  // Review Queue Actions
  const handleApproveObservation = async (id: string) => {
    try {
      await marketIntelligenceService.updateObservationStatus(id, 'approved', undefined, 'MANIFOLD Admin');
      showNotify('Observation approved and indexed to Knowledge Base.');
      await loadAllData();
    } catch (err) {
      showNotify('Failed to approve observation.');
    }
  };

  const handleRejectObservation = async (id: string) => {
    setRejectingObsId(id);
    setRejectionReason('Outlier pricing or duplicate entry.');
  };

  const confirmRejection = async () => {
    if (!rejectingObsId) return;
    try {
      await marketIntelligenceService.updateObservationStatus(
        rejectingObsId,
        'rejected',
        rejectionReason,
        'MANIFOLD Admin'
      );
      showNotify('Observation marked as rejected.');
      setRejectingObsId(null);
      setRejectionReason('');
      await loadAllData();
    } catch (err) {
      showNotify('Failed to reject observation.');
    }
  };

  const handleMarkStale = async (id: string) => {
    try {
      await marketIntelligenceService.updateObservationStatus(id, 'stale', undefined, 'MANIFOLD Admin');
      showNotify('Observation marked as stale.');
      await loadAllData();
    } catch (err) {
      showNotify('Failed to update status.');
    }
  };

  const handleBatchAction = async (newStatus: ObservationStatus) => {
    if (selectedObsIds.length === 0) return;
    try {
      await marketIntelligenceService.batchUpdateStatus(selectedObsIds, newStatus, 'MANIFOLD Admin');
      showNotify(`Updated ${selectedObsIds.length} observations to ${newStatus}.`);
      setSelectedObsIds([]);
      await loadAllData();
    } catch (err) {
      showNotify('Failed batch operation.');
    }
  };

  const handleOpenEdit = (obs: MarketPriceObservation) => {
    setEditingObs({ ...obs });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingObs) return;

    try {
      await marketIntelligenceService.updateObservation(
        editingObs.id,
        {
          make: editingObs.make,
          model: editingObs.model,
          year: editingObs.year,
          trim: editingObs.trim,
          price: editingObs.price,
          currency: editingObs.currency,
          condition: editingObs.condition,
          mileage: editingObs.mileage,
          location: editingObs.location,
          transmission: editingObs.transmission,
          notes: editingObs.notes,
          confidence_score: editingObs.confidence_score,
        },
        'MANIFOLD Admin'
      );
      showNotify('Observation details updated and revision logged.');
      setEditingObs(null);
      await loadAllData();
    } catch (err) {
      showNotify('Failed to update observation.');
    }
  };

  const handleOpenHistory = async (obsId: string) => {
    setHistoryObsId(obsId);
    const revs = await marketIntelligenceService.getObservationRevisions(obsId);
    setHistoryRevisions(revs);
  };

  // Source Actions
  const handleOpenAddSource = () => {
    setEditingSource(null);
    setSrcName('');
    setSrcBaseUrl('');
    setSrcType('marketplace');
    setSrcTrust('verified');
    setSrcFreq('daily');
    setSrcActive(true);
    setSrcCrawlEnabled(true);
    setSrcNotes('');
    setShowSourceModal(true);
  };

  const handleOpenEditSource = (src: MarketDataSource) => {
    setEditingSource(src);
    setSrcName(src.name);
    setSrcBaseUrl(src.base_url || '');
    setSrcType(src.source_type);
    setSrcTrust(src.trust_level);
    setSrcFreq(src.crawl_frequency);
    setSrcActive(src.is_active);
    setSrcCrawlEnabled(src.crawl_enabled);
    setSrcNotes(src.notes || '');
    setShowSourceModal(true);
  };

  const handleSaveSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srcName.trim()) {
      showNotify('Source name is required.');
      return;
    }

    try {
      if (editingSource) {
        await marketIntelligenceService.updateSource(editingSource.id, {
          name: srcName,
          base_url: srcBaseUrl,
          source_type: srcType,
          trust_level: srcTrust,
          crawl_frequency: srcFreq,
          is_active: srcActive,
          crawl_enabled: srcCrawlEnabled,
          notes: srcNotes,
        });
        showNotify(`Updated source "${srcName}".`);
      } else {
        await marketIntelligenceService.createSource({
          name: srcName,
          base_url: srcBaseUrl,
          source_type: srcType,
          trust_level: srcTrust,
          crawl_frequency: srcFreq,
          is_active: srcActive,
          crawl_enabled: srcCrawlEnabled,
          notes: srcNotes,
          last_successful_fetch: null,
          last_error: null,
        });
        showNotify(`Created trusted data source "${srcName}".`);
      }

      setShowSourceModal(false);
      await loadAllData();
    } catch (err) {
      showNotify('Failed to save data source.');
    }
  };

  const handleToggleSourceActive = async (src: MarketDataSource) => {
    try {
      await marketIntelligenceService.updateSource(src.id, { is_active: !src.is_active });
      showNotify(`Source "${src.name}" ${!src.is_active ? 'activated' : 'deactivated'}.`);
      await loadAllData();
    } catch (err) {
      showNotify('Failed to update source status.');
    }
  };

  const handleCopyMigrationSql = async () => {
    try {
      const res = await fetch('/api/market-intelligence/migration-sql');
      const sqlText = res.ok ? await res.text() : '';
      if (sqlText && sqlText.length > 50) {
        await navigator.clipboard.writeText(sqlText);
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 3000);
        showNotify('Full Supabase migration SQL (220 lines) copied! Paste into Supabase SQL Editor and execute.');
      } else {
        await navigator.clipboard.writeText('src/db/market-intelligence-migration.sql');
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 3000);
        showNotify('Migration path copied: src/db/market-intelligence-migration.sql');
      }
    } catch {
      await navigator.clipboard.writeText('src/db/market-intelligence-migration.sql');
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
      showNotify('Check src/db/market-intelligence-migration.sql');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#071A2B] text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-2 h-2 rounded-full bg-[#EF233C]" />
          <span className="text-xs font-semibold">{notification}</span>
        </div>
      )}

      {/* Migration / Database Notice Banner (Phase 1 Requirement) */}
      {dbStatus && !dbStatus.tablesExist && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-950">
                Supabase Market Intelligence Migration Pending
              </p>
              <p className="text-amber-800 mt-0.5 leading-relaxed">
                Tables <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">market_data_sources</code>,{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">market_price_observations</code>, and{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">knowledge_base</code> are queued for execution in Supabase. The platform is running with local fallback persistence and live Gemini extraction.
              </p>
            </div>
          </div>
          <button
            onClick={handleCopyMigrationSql}
            className="shrink-0 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition text-xs shadow-sm cursor-pointer"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSql ? 'Copied' : 'Copy SQL Migration'}</span>
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#071A2B] text-white rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-600/15 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#EF233C] bg-red-950/80 border border-red-500/20 px-2.5 py-0.5 rounded-full">
                Admin Engine
              </span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Gemini AI Ingestion & Knowledge Base Sync
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-display">
              Market Intelligence Centre
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              Ingest Nigerian automotive listing URLs, pasted market reports, and spreadsheet data. Extract structured pricing observations with Gemini, review confidence scores, and sync authoritative benchmark values to MANIFOLD's knowledge base.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveSubTab('submit')}
              className="px-4 py-2.5 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center gap-2 transition shadow-lg shadow-red-900/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Submit Market Data</span>
            </button>
            <button
              onClick={loadAllData}
              disabled={loading}
              className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition border border-white/10 cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#EF233C]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="flex items-center gap-1 mt-6 pt-4 border-t border-white/10 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'overview'
                ? 'bg-white/15 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveSubTab('submit')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'submit'
                ? 'bg-white/15 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Submit Market Data</span>
          </button>

          <button
            onClick={() => setActiveSubTab('review')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'review'
                ? 'bg-white/15 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Review Queue</span>
            {metrics && metrics.pendingReview > 0 && (
              <span className="bg-[#EF233C] text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                {metrics.pendingReview}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('sources')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'sources'
                ? 'bg-white/15 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Data Sources ({sources.length})</span>
          </button>
        </div>
      </div>

      {/* VIEW A: OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Grid (Live database counts) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                Total Observations
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-display">
                  {metrics?.totalObservations ?? 0}
                </span>
                <span className="text-xs font-semibold text-gray-400">Records</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Approved & Synced
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-display">
                  {metrics?.approvedObservations ?? 0}
                </span>
                <span className="text-xs font-semibold text-emerald-600/70">In Knowledge</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm space-y-1 bg-amber-50/20">
              <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Pending Review
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-amber-700 font-display">
                  {metrics?.pendingReview ?? 0}
                </span>
                <button
                  onClick={() => {
                    setStatusFilter('pending_review');
                    setActiveSubTab('review');
                  }}
                  className="text-xs font-bold text-[#EF233C] hover:underline"
                >
                  Review Queue →
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center gap-1">
                <Globe className="w-3 h-3" />
                Active Sources
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-display">
                  {metrics?.activeSources ?? 0}
                </span>
                <span className="text-xs font-semibold text-gray-400">
                  {metrics?.queuedOrActiveJobs ?? 0} Queued Crawls
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Recent Observations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions Panel */}
            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#EF233C]" />
                <span>Ingestion Actions</span>
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Add new price data into MANIFOLD's intelligence model through URLs, copied reports, or spreadsheet imports.
              </p>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    setSubmitMethod('url');
                    setActiveSubTab('submit');
                  }}
                  className="w-full p-3 rounded-xl border border-gray-200 hover:border-gray-900 bg-gray-50/70 hover:bg-white text-left transition flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-xs font-bold text-gray-900">URL Submission</p>
                      <p className="text-[11px] text-gray-500">Scrape & extract online vehicle ads</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition" />
                </button>

                <button
                  onClick={() => {
                    setSubmitMethod('text');
                    setActiveSubTab('submit');
                  }}
                  className="w-full p-3 rounded-xl border border-gray-200 hover:border-gray-900 bg-gray-50/70 hover:bg-white text-left transition flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-gray-900">Paste Text / Catalogue</p>
                      <p className="text-[11px] text-gray-500">Extract unstructured listings via Gemini</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition" />
                </button>

                <button
                  onClick={() => {
                    setSubmitMethod('file');
                    setActiveSubTab('submit');
                  }}
                  className="w-full p-3 rounded-xl border border-gray-200 hover:border-gray-900 bg-gray-50/70 hover:bg-white text-left transition flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Upload className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-xs font-bold text-gray-900">CSV & Spreadsheet Import</p>
                      <p className="text-[11px] text-gray-500">Bulk upload inspected market data</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition" />
                </button>
              </div>
            </div>

            {/* Recent Observations Stream */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                    Recent Market Observations
                  </h3>
                  <p className="text-xs text-gray-500">Live vehicle records logged across all data sources</p>
                </div>
                <button
                  onClick={() => setActiveSubTab('review')}
                  className="text-xs font-bold text-[#EF233C] hover:underline"
                >
                  View All ({metrics?.totalObservations ?? 0}) →
                </button>
              </div>

              <div className="divide-y divide-gray-100">
                {(metrics?.recentObservations || []).map((obs) => (
                  <div key={obs.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 truncate">
                          {obs.year} {obs.make} {obs.model} {obs.trim || ''}
                        </span>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                            obs.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : obs.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : obs.status === 'stale'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {obs.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        {obs.source_name || obs.publisher || 'Market Listing'} · {obs.condition} · {obs.location || 'Nigeria'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-gray-900 block">
                        ₦{obs.price.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Confidence: {(obs.confidence_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW B: SUBMIT MARKET DATA */}
      {activeSubTab === 'submit' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          {/* Method selector */}
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-4">
            <button
              onClick={() => setSubmitMethod('url')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                submitMethod === 'url'
                  ? 'bg-[#071A2B] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Method 1: URL Submission</span>
            </button>

            <button
              onClick={() => setSubmitMethod('text')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                submitMethod === 'text'
                  ? 'bg-[#071A2B] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Method 2: Paste Listings / Text</span>
            </button>

            <button
              onClick={() => setSubmitMethod('file')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                submitMethod === 'file'
                  ? 'bg-[#071A2B] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Method 3: CSV & Spreadsheet Import</span>
            </button>
          </div>

          {/* METHOD 1: URL SUBMISSION */}
          {submitMethod === 'url' && (
            <form onSubmit={handleUrlSubmit} className="space-y-4 max-w-3xl">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Automotive Listing URLs (One per line) <span className="text-[#EF233C]">*</span>
                </label>
                <textarea
                  rows={5}
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://jiji.ng/cars/toyota-camry-2021-xse&#10;https://autochek.africa/ng/cars-for-sale/lexus-rx-350-2020&#10;https://carmart.ng/gle-450-2022"
                  required
                  className="w-full p-3.5 text-xs font-mono bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:bg-white focus:border-[#EF233C] outline-none"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  Enter one or multiple vehicle advertisement URLs from supported automotive portals.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Associate with Data Source
                  </label>
                  <select
                    value={urlSourceId}
                    onChange={(e) => setUrlSourceId(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl text-gray-800 font-medium outline-none focus:border-[#EF233C]"
                  >
                    <option value="">Select or auto-detect from domain</option>
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.source_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-5">
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={urlImmediate}
                      onChange={(e) => setUrlImmediate(e.target.checked)}
                      className="w-4 h-4 rounded text-[#EF233C] focus:ring-0"
                    />
                    <span>Fetch webpage and run AI extraction immediately</span>
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isUrlSubmitting}
                  className="px-5 py-2.5 bg-[#EF233C] hover:bg-[#D90429] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center gap-2 transition shadow-md shadow-red-900/20 cursor-pointer"
                >
                  {isUrlSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Fetching & Extracting...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4" />
                      <span>Process URLs</span>
                    </>
                  )}
                </button>
              </div>

              {/* URL Jobs live status */}
              {activeUrlJobs.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-100 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                    Crawl & Extraction Processing Status
                  </h4>
                  <div className="space-y-2">
                    {activeUrlJobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-3 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-3">
                          <p className="font-mono text-[11px] text-gray-900 truncate">
                            {job.target_url}
                          </p>
                          {job.last_error && (
                            <p className="text-[10px] text-red-600 mt-0.5">{job.last_error}</p>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider shrink-0 ${
                            job.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : job.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {job.status} {job.extracted_count > 0 ? `(${job.extracted_count} cars)` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          )}

          {/* METHOD 2: PASTE TEXT */}
          {submitMethod === 'text' && (
            <form onSubmit={handleTextSubmit} className="space-y-4 max-w-3xl">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Copied Vehicle Listing Text / Price Catalogue <span className="text-[#EF233C]">*</span>
                </label>
                <textarea
                  rows={8}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={`Paste unstructured vehicle descriptions, WhatsApp dealer broadcast lists, or price bulletins. Example:&#10;&#10;Foreign used 2021 Toyota Camry XSE red interior, panoramic roof. ₦34,000,000 negotiable. Lekki Lagos. Automatic, 48k km. Clean Carfax.&#10;&#10;Tokunbo 2020 Lexus RX350 F-Sport full option, 360 camera, heads up display. Asking ₦48,500,000. Abuja Maitama.`}
                  required
                  className="w-full p-3.5 text-xs font-sans bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:bg-white focus:border-[#EF233C] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Publisher / Source
                  </label>
                  <input
                    type="text"
                    value={textPublisher}
                    onChange={(e) => setTextPublisher(e.target.value)}
                    placeholder="e.g. Lekki Dealer Broadcast"
                    className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:border-[#EF233C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Original URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={textSourceUrl}
                    onChange={(e) => setTextSourceUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:border-[#EF233C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Internal Notes
                  </label>
                  <input
                    type="text"
                    value={textNotes}
                    onChange={(e) => setTextNotes(e.target.value)}
                    placeholder="e.g. Q4 2024 pricing audit"
                    className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:border-[#EF233C]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isTextExtracting}
                  className="px-5 py-2.5 bg-[#EF233C] hover:bg-[#D90429] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center gap-2 transition shadow-md shadow-red-900/20 cursor-pointer"
                >
                  {isTextExtracting ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      <span>Gemini AI Extracting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Run AI Extraction (Gemini)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Extracted preview */}
              {extractedFromText.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Extracted {extractedFromText.length} Observations</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('review')}
                      className="text-xs font-bold text-[#EF233C] hover:underline"
                    >
                      Open in Review Queue →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {extractedFromText.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/30 text-xs space-y-1"
                      >
                        <div className="flex justify-between font-bold text-gray-900">
                          <span>{item.year} {item.make} {item.model} {item.trim || ''}</span>
                          <span className="text-emerald-700">₦{item.price.toLocaleString()}</span>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          {item.condition} · {item.location || 'Lagos'} · Confidence: {(item.confidence_score * 100).toFixed(0)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          )}

          {/* METHOD 3: FILE IMPORT */}
          {submitMethod === 'file' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Upload CSV File or Spreadsheet Export
                </label>
                <div className="border-2 border-dashed border-gray-200 hover:border-gray-400 rounded-2xl p-6 text-center bg-gray-50/50 transition">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-700">
                    Click to browse or drop your CSV file here
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Columns supported: Make, Model, Year, Trim, Price, Condition, Mileage, Location, Source URL
                  </p>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="mt-3 text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#071A2B] file:text-white hover:file:bg-black cursor-pointer"
                  />
                </div>
              </div>

              {/* CSV Validation errors */}
              {csvErrors.length > 0 && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-1">
                  <p className="font-bold">Validation Warnings ({csvErrors.length}):</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {csvErrors.slice(0, 5).map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Table Preview */}
              {parsedCsvRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                        CSV Preview ({parsedCsvRows.length} Valid Records)
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        Verify mapped columns before committing to Supabase
                      </p>
                    </div>

                    <button
                      onClick={handleFileImportSubmit}
                      disabled={isFileImporting}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      {isFileImporting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Commit Import to Review Queue</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b border-gray-200">
                        <tr>
                          <th className="p-2.5">Make & Model</th>
                          <th className="p-2.5">Year</th>
                          <th className="p-2.5">Price (NGN)</th>
                          <th className="p-2.5">Condition</th>
                          <th className="p-2.5">Location</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsedCsvRows.slice(0, 10).map((r, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="p-2.5 font-medium text-gray-900">
                              {r.make} {r.model} {r.trim || ''}
                            </td>
                            <td className="p-2.5 text-gray-600">{r.year}</td>
                            <td className="p-2.5 font-bold text-gray-900">
                              ₦{r.price?.toLocaleString()}
                            </td>
                            <td className="p-2.5 text-gray-600">{r.condition}</td>
                            <td className="p-2.5 text-gray-600">{r.location}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW C: DATA SOURCES MANAGEMENT */}
      {activeSubTab === 'sources' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                Authoritative Market Data Sources
              </h3>
              <p className="text-xs text-gray-500">
                Manage trusted listing portals, partner dealer networks, and crawling configurations.
              </p>
            </div>

            <button
              onClick={handleOpenAddSource}
              className="px-4 py-2 bg-[#071A2B] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Data Source</span>
            </button>
          </div>

          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Source Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Trust Level</th>
                    <th className="py-3 px-4">Crawl Frequency</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sources.map((src) => (
                    <tr key={src.id} className="hover:bg-gray-50/60 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{src.name}</div>
                        {src.base_url && (
                          <a
                            href={src.base_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <span>{src.base_url}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-700 capitalize">
                        {src.source_type.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider ${
                            src.trust_level === 'official' || src.trust_level === 'verified'
                              ? 'bg-emerald-100 text-emerald-800'
                              : src.trust_level === 'partner'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {src.trust_level}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 capitalize">
                        {src.crawl_frequency}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider ${
                            src.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {src.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleToggleSourceActive(src)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 cursor-pointer"
                        >
                          {src.is_active ? 'Disable' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleOpenEditSource(src)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-900 cursor-pointer"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW D: OBSERVATION REVIEW QUEUE */}
      {activeSubTab === 'review' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                Observation Review & Knowledge Sync Queue
              </h3>
              <p className="text-xs text-gray-500">
                Inspect AI extracted details, refine fields, approve benchmark values, or reject outliers.
              </p>
            </div>

            {/* Batch actions bar */}
            {selectedObsIds.length > 0 && (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 p-1.5 rounded-2xl">
                <span className="text-xs font-bold text-gray-700 px-2">
                  {selectedObsIds.length} Selected
                </span>
                <button
                  onClick={() => handleBatchAction('approved')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Approve All
                </button>
                <button
                  onClick={() => handleBatchAction('rejected')}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Reject All
                </button>
              </div>
            )}
          </div>

          {/* Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'pending_review', 'approved', 'rejected', 'stale'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${
                    statusFilter === st
                      ? 'bg-[#071A2B] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchTrigger()}
                  placeholder="Filter make, model, trim..."
                  className="w-full h-9 pl-8 pr-3 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#EF233C]"
                />
              </div>
              <button
                onClick={handleSearchTrigger}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Search
              </button>
            </div>
          </div>

          {/* Observations Table */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={
                          observations.length > 0 &&
                          selectedObsIds.length === observations.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedObsIds(observations.map((o) => o.id));
                          } else {
                            setSelectedObsIds([]);
                          }
                        }}
                        className="rounded text-[#EF233C]"
                      />
                    </th>
                    <th className="py-3 px-4">Vehicle Details</th>
                    <th className="py-3 px-4">Observed Price</th>
                    <th className="py-3 px-4">Condition & Specs</th>
                    <th className="py-3 px-4">Source & Date</th>
                    <th className="py-3 px-4">Status & Sync</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {observations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400 text-xs">
                        No vehicle observations found matching current filter.
                      </td>
                    </tr>
                  ) : (
                    observations.map((obs) => {
                      const isSelected = selectedObsIds.includes(obs.id);
                      return (
                        <tr
                          key={obs.id}
                          className={`hover:bg-gray-50/70 transition ${
                            isSelected ? 'bg-red-50/20' : ''
                          }`}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedObsIds([...selectedObsIds, obs.id]);
                                } else {
                                  setSelectedObsIds(selectedObsIds.filter((id) => id !== obs.id));
                                }
                              }}
                              className="rounded text-[#EF233C]"
                            />
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-extrabold text-gray-900 text-sm">
                              {obs.year} {obs.make} {obs.model}
                            </div>
                            <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                              {obs.trim && <span className="font-semibold text-gray-700">{obs.trim}</span>}
                              {obs.location && <span>· {obs.location}</span>}
                            </div>
                            {obs.notes && (
                              <div className="text-[10px] text-gray-400 mt-1 italic truncate max-w-[260px]" title={obs.notes}>
                                {obs.notes}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-extrabold text-gray-900 text-sm">
                              ₦{obs.price.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              Confidence: {(obs.confidence_score * 100).toFixed(0)}%
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-semibold text-gray-800 block">
                              {obs.condition}
                            </span>
                            <span className="text-[11px] text-gray-500">
                              {obs.mileage ? `${obs.mileage.toLocaleString()} ${obs.mileage_unit}` : 'Mileage Unspecified'} · {obs.transmission || 'Automatic'}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-800 truncate max-w-[140px]">
                              {obs.source_name || obs.publisher || 'Listing'}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {obs.observed_at}
                            </div>
                            {obs.source_url && (
                              <a
                                href={obs.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 mt-0.5"
                              >
                                <span>Source</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <span
                                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider block w-fit ${
                                  obs.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : obs.status === 'rejected'
                                    ? 'bg-red-100 text-red-800'
                                    : obs.status === 'stale'
                                    ? 'bg-gray-100 text-gray-600'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {obs.status.replace('_', ' ')}
                              </span>

                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 w-fit ${
                                  obs.storage_tier === 'persisted_supabase'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                <Database className="w-2.5 h-2.5" />
                                <span>{obs.storage_tier === 'persisted_supabase' ? 'Supabase DB' : 'Local (Pending Migration)'}</span>
                              </span>

                              {obs.is_synced_to_knowledge_base && (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-1 w-fit">
                                  <BookOpen className="w-2.5 h-2.5" />
                                  <span>Knowledge Synced</span>
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                            {obs.status === 'pending_review' && (
                              <>
                                <button
                                  onClick={() => handleApproveObservation(obs.id)}
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                                  title="Approve & Index to Knowledge Base"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRejectObservation(obs.id)}
                                  className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition cursor-pointer"
                                  title="Reject Observation"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {obs.status === 'approved' && (
                              <button
                                onClick={() => handleMarkStale(obs.id)}
                                className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition cursor-pointer"
                                title="Mark as Stale"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenEdit(obs)}
                              className="p-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition cursor-pointer"
                              title="Edit Observation"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleOpenHistory(obs.id)}
                              className="p-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition cursor-pointer"
                              title="Audit History & Revisions"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EDIT OBSERVATION MODAL */}
      {editingObs && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 font-display">
                  Edit Market Price Observation
                </h3>
                <p className="text-xs text-gray-500">
                  Edits are logged to the audit revision ledger in Supabase.
                </p>
              </div>
              <button
                onClick={() => setEditingObs(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Make</label>
                  <input
                    type="text"
                    value={editingObs.make}
                    onChange={(e) => setEditingObs({ ...editingObs, make: e.target.value })}
                    required
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={editingObs.model}
                    onChange={(e) => setEditingObs({ ...editingObs, model: e.target.value })}
                    required
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    value={editingObs.year}
                    onChange={(e) => setEditingObs({ ...editingObs, year: parseInt(e.target.value, 10) })}
                    required
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Trim</label>
                  <input
                    type="text"
                    value={editingObs.trim || ''}
                    onChange={(e) => setEditingObs({ ...editingObs, trim: e.target.value })}
                    placeholder="e.g. XSE, F-Sport"
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Price (NGN)</label>
                  <input
                    type="number"
                    value={editingObs.price}
                    onChange={(e) => setEditingObs({ ...editingObs, price: parseFloat(e.target.value) })}
                    required
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Condition</label>
                  <select
                    value={editingObs.condition}
                    onChange={(e) => setEditingObs({ ...editingObs, condition: e.target.value })}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                  >
                    <option value="Foreign Used">Foreign Used</option>
                    <option value="Nigerian Used">Nigerian Used</option>
                    <option value="Brand New">Brand New</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Mileage (km)</label>
                  <input
                    type="number"
                    value={editingObs.mileage || ''}
                    onChange={(e) => setEditingObs({ ...editingObs, mileage: parseInt(e.target.value, 10) || null })}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={editingObs.location || ''}
                    onChange={(e) => setEditingObs({ ...editingObs, location: e.target.value })}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Confidence (0 - 1.0)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1.0"
                    value={editingObs.confidence_score}
                    onChange={(e) => setEditingObs({ ...editingObs, confidence_score: parseFloat(e.target.value) })}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Inspection Notes</label>
                <textarea
                  rows={2}
                  value={editingObs.notes || ''}
                  onChange={(e) => setEditingObs({ ...editingObs, notes: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingObs(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#EF233C] hover:bg-[#D90429] text-white rounded-xl font-bold cursor-pointer"
                >
                  Save Changes & Log Revision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectingObsId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-gray-900">
              Reject Observation
            </h3>
            <p className="text-xs text-gray-500">
              Provide a reason for rejecting this vehicle observation from the pricing model.
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Unrealistic price, salvage/write-off, salvage flood title..."
              className="w-full p-3 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingObsId(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmRejection}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVISION AUDIT DRAWER */}
      {historyObsId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-end">
          <div className="bg-white h-full max-w-md w-full p-6 sm:p-8 space-y-6 overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-sm font-extrabold text-gray-900 font-display">
                  Observation Audit History
                </h3>
                <p className="text-xs text-gray-400">
                  Revision trail from <code>market_observation_revisions</code>
                </p>
              </div>
              <button
                onClick={() => setHistoryObsId(null)}
                className="p-2 text-gray-400 hover:text-gray-900 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {historyRevisions.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-10">
                No manual revisions recorded for this observation. It remains in its original extracted state.
              </p>
            ) : (
              <div className="space-y-4">
                {historyRevisions.map((rev) => (
                  <div key={rev.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-gray-900">{rev.revised_by}</span>
                      <span className="text-gray-400">{new Date(rev.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-[11px] font-medium text-gray-700">{rev.change_summary}</p>
                    <div className="bg-white p-2.5 rounded-xl border border-gray-100 font-mono text-[10px] space-y-1">
                      <div className="text-red-600 truncate">
                        Prev: {JSON.stringify(rev.previous_state)}
                      </div>
                      <div className="text-emerald-700 truncate">
                        New: {JSON.stringify(rev.new_state)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD / EDIT SOURCE MODAL */}
      {showSourceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900">
                {editingSource ? 'Edit Data Source' : 'Add New Data Source'}
              </h3>
              <button
                onClick={() => setShowSourceModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSource} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Source Name <span className="text-[#EF233C]">*</span></label>
                <input
                  type="text"
                  value={srcName}
                  onChange={(e) => setSrcName(e.target.value)}
                  placeholder="e.g. Carmart Nigeria"
                  required
                  className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Base URL</label>
                <input
                  type="url"
                  value={srcBaseUrl}
                  onChange={(e) => setSrcBaseUrl(e.target.value)}
                  placeholder="https://carmart.ng"
                  className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Source Type</label>
                  <select
                    value={srcType}
                    onChange={(e) => setSrcType(e.target.value as SourceType)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                  >
                    <option value="marketplace">Marketplace</option>
                    <option value="dealer_site">Dealer Site</option>
                    <option value="auction">Auction</option>
                    <option value="classifieds">Classifieds</option>
                    <option value="report">Industry Report</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Trust Level</label>
                  <select
                    value={srcTrust}
                    onChange={(e) => setSrcTrust(e.target.value as TrustLevel)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                  >
                    <option value="official">Official (Highest)</option>
                    <option value="verified">Verified</option>
                    <option value="partner">Partner</option>
                    <option value="unverified">Unverified</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Crawl Frequency</label>
                <select
                  value={srcFreq}
                  onChange={(e) => setSrcFreq(e.target.value as CrawlFrequency)}
                  className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="manual">Manual Ingestion Only</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={srcNotes}
                  onChange={(e) => setSrcNotes(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={srcActive}
                    onChange={(e) => setSrcActive(e.target.checked)}
                    className="rounded text-[#EF233C]"
                  />
                  <span className="font-semibold text-gray-800">Source Active</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowSourceModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#EF233C] text-white rounded-xl font-bold cursor-pointer"
                >
                  Save Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
