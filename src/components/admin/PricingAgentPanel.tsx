import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import {
  pricingAgentService,
  type PricingAgentConfigDto,
  type PricingAgentProviderKey,
  type PricingAgentStatusResponse,
} from '../../services/marketIntelligenceService';

interface PricingAgentPanelProps {
  onDataUpdated?: () => void;
}

export const PricingAgentPanel: React.FC<PricingAgentPanelProps> = ({ onDataUpdated }) => {
  const [status, setStatus] = useState<PricingAgentStatusResponse | null>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Targeted run form
  const [targetMake, setTargetMake] = useState('');
  const [targetModel, setTargetModel] = useState('');
  const [targetYear, setTargetYear] = useState('');
  const [targetCategory, setTargetCategory] = useState<'foreign_used' | 'nigerian_used' | 'brand_new'>(
    'foreign_used'
  );
  const [targetLocation, setTargetLocation] = useState('');
  const [forceRefresh, setForceRefresh] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<any | null>(null);

  // Provider testing state
  const [testingProvider, setTestingProvider] = useState<PricingAgentProviderKey | null>(null);
  const [providerTestResults, setProviderTestResults] = useState<Record<string, any>>({});

  // Config editing state
  const [savingConfig, setSavingConfig] = useState(false);
  const [draftConfig, setDraftConfig] = useState<Partial<PricingAgentConfigDto>>({});

  const loadAgentData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, runsRes, estRes] = await Promise.all([
        pricingAgentService.getStatus(),
        pricingAgentService.getRuns(),
        pricingAgentService.getEstimates(),
      ]);
      setStatus(statusRes);
      setDraftConfig(statusRes.config);
      setRuns(runsRes.runs || []);
      setEstimates(estRes.estimates || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load AI Pricing Agent status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAgentData();
  }, []);

  const handleCopyMigrationSql = async () => {
    const sql = await pricingAgentService.getMigrationSql();
    if (!sql) return;
    await navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleTestProvider = async (providerKey: PricingAgentProviderKey) => {
    setTestingProvider(providerKey);
    try {
      const res = await pricingAgentService.testProvider(providerKey);
      setProviderTestResults((prev) => ({ ...prev, [providerKey]: res }));
    } catch (err: any) {
      setProviderTestResults((prev) => ({
        ...prev,
        [providerKey]: { connected: false, message: err?.message || 'Test failed.' },
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSaveConfig = async (overridePatch?: Partial<PricingAgentConfigDto>) => {
    setSavingConfig(true);
    setNotice(null);
    try {
      const payload = overridePatch ?? {
        schedule_enabled: draftConfig.schedule_enabled,
        is_paused: draftConfig.is_paused,
        default_frequency: draftConfig.default_frequency,
        high_demand_interval_hours: Number(draftConfig.high_demand_interval_hours || 24),
        standard_interval_hours: Number(draftConfig.standard_interval_hours || 72),
        insufficient_retry_hours: Number(draftConfig.insufficient_retry_hours || 12),
        max_vehicles_per_run: Number(draftConfig.max_vehicles_per_run || 5),
        max_daily_provider_queries: Number(draftConfig.max_daily_provider_queries || 50),
        monthly_provider_budget_usd: Number(draftConfig.monthly_provider_budget_usd || 25),
      };
      const res = await pricingAgentService.updateConfig(payload);
      setDraftConfig(res.config);
      setNotice(
        res.persistedToDb
          ? 'Pricing Agent schedule & budget configuration saved.'
          : res.warning || 'Config updated in memory; run SQL migration to persist.'
      );
      await loadAgentData();
    } catch (err: any) {
      setError(err?.message || 'Failed saving pricing agent settings.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunAgent = async (targeted: boolean) => {
    setIsRunning(true);
    setError(null);
    setNotice(null);
    try {
      const payload =
        targeted && targetMake.trim() && targetModel.trim()
          ? {
              forceRefresh,
              targets: [
                {
                  make: targetMake.trim(),
                  model: targetModel.trim(),
                  year: targetYear.trim() ? parseInt(targetYear.trim(), 10) : null,
                  marketCategory: targetCategory,
                  location: targetLocation.trim() || null,
                },
              ],
            }
          : { forceRefresh };

      const res = await pricingAgentService.runResearch(payload);
      setLastRunResult(res);
      setNotice(
        res.notice ||
          `Run ${res.status}: ${res.targetsProcessed?.length || 0} vehicle(s) evaluated, ${res.estimatesUpdated || 0} estimate(s) updated.`
      );
      await loadAgentData();
      onDataUpdated?.();
    } catch (err: any) {
      setError(err?.message || 'Pricing agent run failed.');
    } finally {
      setIsRunning(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-10 flex items-center justify-center gap-2 text-xs text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin text-[#EF233C]" />
        <span>Loading AI Automotive Pricing Agent status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Migration Banner if pricing-agent-migration.sql hasn't been executed yet */}
      {status?.migrationRequired && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <Database className="w-4 h-4 text-amber-700" />
              <span>Pricing Agent Database Migration Required</span>
            </div>
            <p className="text-[11px] text-amber-800">
              Run <code className="font-mono font-bold">{status.migrationFilePath}</code> in Supabase SQL Editor to persist market estimates, run logs, provider quotas, and price history.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyMigrationSql}
            className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold transition cursor-pointer"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSql ? 'Copied Migration SQL' : 'Copy Agent SQL'}</span>
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Schedule State
          </span>
          <div className="flex items-center justify-between">
            <span className="text-lg font-extrabold text-gray-900">
              {status?.config.is_paused
                ? 'Paused'
                : status?.config.schedule_enabled
                ? `${status.config.default_frequency.toUpperCase()} Active`
                : 'Manual Only'}
            </span>
            <Bot className="w-4 h-4 text-[#EF233C]" />
          </div>
          <p className="text-[11px] text-gray-500 tabular-nums">
            CRON_SECRET: {status?.cronSecretConfigured ? 'Configured' : 'Not Set'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Daily Provider Quota
          </span>
          <div className="text-lg font-extrabold text-gray-900 tabular-nums">
            {status?.usage.queriesTodayTotal ?? 0} / {status?.config.max_daily_provider_queries ?? 50}
          </div>
          <p className="text-[11px] text-gray-500 tabular-nums">
            Month spend: ${(status?.usage.monthSpendUsd ?? 0).toFixed(3)} / $
            {status?.config.monthly_provider_budget_usd ?? 25}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Stored Estimates
          </span>
          <div className="text-lg font-extrabold text-gray-900 tabular-nums">{estimates.length}</div>
          <p className="text-[11px] text-gray-500">
            Category-isolated asking benchmarks
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Last Scheduled Run
          </span>
          <div className="text-sm font-extrabold text-gray-900 tabular-nums">
            {status?.config.last_scheduled_run_at
              ? new Date(status.config.last_scheduled_run_at).toLocaleString()
              : 'Never run'}
          </div>
          <p className="text-[11px] text-gray-500 tabular-nums">
            Next:{' '}
            {status?.config.next_scheduled_run_at
              ? new Date(status.config.next_scheduled_run_at).toLocaleDateString()
              : 'Not scheduled'}
          </p>
        </div>
      </div>

      {/* Targeted & Full Research Runner + Schedule Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manual & Targeted Research Runner */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <Search className="w-4 h-4 text-[#EF233C]" />
                <span>Run Market Price Research</span>
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Trigger automated Nigerian market collection &amp; deterministic estimation on demand.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleRunAgent(false)}
              disabled={isRunning}
              className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#071A2B] hover:bg-[#0B2239] disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer"
            >
              {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>Run Inventory Batch</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-gray-100">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Make</label>
              <input
                type="text"
                value={targetMake}
                onChange={(e) => setTargetMake(e.target.value)}
                placeholder="e.g. Toyota"
                className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#EF233C]"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Model</label>
              <input
                type="text"
                value={targetModel}
                onChange={(e) => setTargetModel(e.target.value)}
                placeholder="e.g. Camry"
                className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#EF233C]"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Model Year (optional)</label>
              <input
                type="number"
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                placeholder="e.g. 2021"
                className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#EF233C] tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Market Category</label>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value as any)}
                className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#EF233C]"
              >
                <option value="foreign_used">Foreign Used (Tokunbo)</option>
                <option value="nigerian_used">Nigerian Used</option>
                <option value="brand_new">Brand New</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Location (optional)</label>
              <input
                type="text"
                value={targetLocation}
                onChange={(e) => setTargetLocation(e.target.value)}
                placeholder="e.g. Lagos or Abuja"
                className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#EF233C]"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer text-gray-700 font-semibold">
                <input
                  type="checkbox"
                  checked={forceRefresh}
                  onChange={(e) => setForceRefresh(e.target.checked)}
                  className="rounded text-[#EF233C]"
                />
                <span>Force refresh fresh estimates</span>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleRunAgent(true)}
            disabled={isRunning || !targetMake.trim() || !targetModel.trim()}
            className="w-full whitespace-nowrap inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#EF233C] hover:bg-[#D90429] disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer"
          >
            {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
            <span>Research Selected Vehicle</span>
          </button>
        </div>

        {/* Scheduling & Budget Configuration */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#EF233C]" />
                <span>Schedule, Quotas &amp; Budget Guardrails</span>
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Control Vercel Cron execution, staleness intervals, and monthly API cost limits.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                void handleSaveConfig({ is_paused: !draftConfig.is_paused })
              }
              disabled={savingConfig}
              className={`whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                draftConfig.is_paused
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
            >
              {draftConfig.is_paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{draftConfig.is_paused ? 'Resume Schedule' : 'Pause Schedule'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-gray-100">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Frequency</label>
              <select
                value={draftConfig.default_frequency || 'daily'}
                onChange={(e) =>
                  setDraftConfig((d) => ({ ...d, default_frequency: e.target.value as any }))
                }
                className="w-full h-9 px-2.5 bg-gray-50 border border-gray-200 rounded-xl"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="manual">Manual Only</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Max Daily Queries</label>
              <input
                type="number"
                value={draftConfig.max_daily_provider_queries ?? 50}
                onChange={(e) =>
                  setDraftConfig((d) => ({
                    ...d,
                    max_daily_provider_queries: parseInt(e.target.value || '50', 10),
                  }))
                }
                className="w-full h-9 px-2.5 bg-gray-50 border border-gray-200 rounded-xl tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Monthly Cap ($)</label>
              <input
                type="number"
                step="0.5"
                value={draftConfig.monthly_provider_budget_usd ?? 25}
                onChange={(e) =>
                  setDraftConfig((d) => ({
                    ...d,
                    monthly_provider_budget_usd: parseFloat(e.target.value || '25'),
                  }))
                }
                className="w-full h-9 px-2.5 bg-gray-50 border border-gray-200 rounded-xl tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">High-Demand TTL (h)</label>
              <input
                type="number"
                value={draftConfig.high_demand_interval_hours ?? 24}
                onChange={(e) =>
                  setDraftConfig((d) => ({
                    ...d,
                    high_demand_interval_hours: parseInt(e.target.value || '24', 10),
                  }))
                }
                className="w-full h-9 px-2.5 bg-gray-50 border border-gray-200 rounded-xl tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Standard TTL (h)</label>
              <input
                type="number"
                value={draftConfig.standard_interval_hours ?? 72}
                onChange={(e) =>
                  setDraftConfig((d) => ({
                    ...d,
                    standard_interval_hours: parseInt(e.target.value || '72', 10),
                  }))
                }
                className="w-full h-9 px-2.5 bg-gray-50 border border-gray-200 rounded-xl tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Vehicles / Run</label>
              <input
                type="number"
                value={draftConfig.max_vehicles_per_run ?? 5}
                onChange={(e) =>
                  setDraftConfig((d) => ({
                    ...d,
                    max_vehicles_per_run: parseInt(e.target.value || '5', 10),
                  }))
                }
                className="w-full h-9 px-2.5 bg-gray-50 border border-gray-200 rounded-xl tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(draftConfig.schedule_enabled)}
                onChange={(e) =>
                  setDraftConfig((d) => ({ ...d, schedule_enabled: e.target.checked }))
                }
                className="rounded text-[#EF233C]"
              />
              <span>Enable Automated Scheduled Research</span>
            </label>

            <button
              type="button"
              onClick={() => void handleSaveConfig()}
              disabled={savingConfig}
              className="whitespace-nowrap inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#071A2B] hover:bg-[#0B2239] text-white text-xs font-bold transition cursor-pointer"
            >
              {savingConfig && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Latest Run Live Result Breakdown */}
      {lastRunResult && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#EF233C]" />
              <span>Latest Research Run Summary</span>
            </h3>
            <span className="text-xs font-semibold text-gray-500 tabular-nums">
              Queries: {lastRunResult.queriesExecuted} · URLs Fetched: {lastRunResult.urlsFetched} · Collected:{' '}
              {lastRunResult.observationsCollected} · Duplicates Filtered: {lastRunResult.duplicatesDetected} · Restricted Sources:{' '}
              {lastRunResult.restrictedSourcesCount}
            </span>
          </div>

          {Array.isArray(lastRunResult.sourceOutcomes) && lastRunResult.sourceOutcomes.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="py-2 px-3">Domain / URL</th>
                    <th className="py-2 px-3">Provider</th>
                    <th className="py-2 px-3">Fetch Status</th>
                    <th className="py-2 px-3 text-right">Valid / Dupes / Rejected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lastRunResult.sourceOutcomes.map((out: any, i: number) => (
                    <tr key={`${out.url}-${i}`}>
                      <td className="py-2 px-3 max-w-[280px] truncate font-medium text-gray-800" title={out.url}>
                        {out.domain} · {out.url}
                      </td>
                      <td className="py-2 px-3 text-gray-600">{out.providerKey}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            out.status === 'BLOCKED_BY_PROTECTION' || out.status === 'SSRF_BLOCKED'
                              ? 'bg-red-50 text-red-700'
                              : out.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {out.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                        {out.validCount} / {out.duplicateCount} / {out.rejectedCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Search & Data Providers Registry (Honest Config Reporting) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-gray-900">
              Permitted Data &amp; Search API Providers
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Only providers with verified server-side credentials are active. Anti-bot protected sites are automatically skipped without bypass attempts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAgentData()}
            className="whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b border-gray-200">
              <tr>
                <th className="py-2.5 px-3">Provider</th>
                <th className="py-2.5 px-3">Config Status</th>
                <th className="py-2.5 px-3">Required Server Env Vars</th>
                <th className="py-2.5 px-3 text-right">Today</th>
                <th className="py-2.5 px-3 text-right">Test</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(status?.providers || []).map((prov) => {
                const testRes = providerTestResults[prov.key];
                return (
                  <tr key={prov.key}>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-gray-900">{prov.displayName}</div>
                      <div className="text-[11px] text-gray-500">{prov.statusNote}</div>
                      {testRes && (
                        <div
                          className={`text-[11px] mt-1 font-semibold ${
                            testRes.connected ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {testRes.message}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          prov.configured
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {prov.configured ? 'Configured' : 'Not Configured'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-gray-600">
                      {prov.requiredEnvVars.length > 0 ? prov.requiredEnvVars.join(', ') : 'None (Supabase)'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                      {prov.queriesToday}
                      {prov.dailyQuotaLimit ? ` / ${prov.dailyQuotaLimit}` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleTestProvider(prov.key)}
                        disabled={testingProvider === prov.key}
                        className="whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-[11px] font-bold text-gray-800 cursor-pointer"
                      >
                        {testingProvider === prov.key && <Loader2 className="w-3 h-3 animate-spin" />}
                        <span>Test</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stored Current Market Price Estimates */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-extrabold text-gray-900">
          Published Asking-Price Benchmarks (Category Isolated)
        </h3>
        <div className="border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b border-gray-200">
              <tr>
                <th className="py-2.5 px-3">Vehicle Segment</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Median Estimate</th>
                <th className="py-2.5 px-3 text-right">Fair Band</th>
                <th className="py-2.5 px-3 text-right">Valid Comps</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Researched</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {estimates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    No stored estimates yet. Run a vehicle or inventory research batch above.
                  </td>
                </tr>
              ) : (
                estimates.map((est) => (
                  <tr key={est.id}>
                    <td className="py-2.5 px-3 font-bold text-gray-900">
                      {est.target_year ? `${est.target_year} ` : ''}
                      {est.make} {est.model}
                    </td>
                    <td className="py-2.5 px-3 text-gray-700">
                      {String(est.market_category || '').replace('_', ' ')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-[#071A2B] tabular-nums">
                      {est.insufficient_data || !est.median_price
                        ? 'Insufficient'
                        : `₦${Number(est.median_price).toLocaleString()}`}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700 font-semibold">
                      {est.price_range_low && est.price_range_high
                        ? `₦${(Number(est.price_range_low) / 1_000_000).toFixed(1)}M–₦${(
                            Number(est.price_range_high) / 1_000_000
                          ).toFixed(1)}M`
                        : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                      {est.valid_observation_count} ({est.duplicate_observation_count} dup)
                    </td>
                    <td className="py-2.5 px-3 capitalize tabular-nums text-gray-700">
                      {est.confidence_level} ({est.confidence_score}/100)
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 tabular-nums">
                      {est.last_research_at ? new Date(est.last_research_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Execution History */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-gray-500" />
          <span>Recent Agent Execution Logs</span>
        </h3>
        <div className="border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b border-gray-200">
              <tr>
                <th className="py-2.5 px-3">Started</th>
                <th className="py-2.5 px-3">Trigger</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Queries / Fetched</th>
                <th className="py-2.5 px-3 text-right">Valid / Dupes / Blocked</th>
                <th className="py-2.5 px-3 text-right">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    No agent runs logged yet.
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id}>
                    <td className="py-2.5 px-3 tabular-nums text-gray-700">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 capitalize text-gray-800">{run.trigger_type}</td>
                    <td className="py-2.5 px-3 font-semibold capitalize text-gray-800">{run.status}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                      {run.queries_executed} / {run.urls_fetched}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                      {run.observations_collected} / {run.duplicates_detected} / {run.restricted_sources_count}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                      ${Number(run.estimated_cost_usd || 0).toFixed(4)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
