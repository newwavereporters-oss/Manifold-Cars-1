import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  Activity,
  DollarSign,
  Sliders,
  Zap,
  Save,
  ShieldCheck,
} from 'lucide-react';
import {
  aiService,
  AdminAiOverviewResponse,
  AiFeatureModuleKey,
  AiFeatureSetting,
  OpenAiTestResponse,
} from '../../services/aiService';

export const AdminAiControlCentreView: React.FC = () => {
  const [overview, setOverview] = useState<AdminAiOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<OpenAiTestResponse | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [draftSettings, setDraftSettings] = useState<Record<string, AiFeatureSetting>>({});

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await aiService.getAdminOverview();
      setOverview(data);
      const map: Record<string, AiFeatureSetting> = {};
      for (const s of data.settings) {
        map[s.module_key] = { ...s };
      }
      setDraftSettings(map);
    } catch (err: any) {
      setError(err?.message || 'Unable to load AI Control Centre data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const handleRunTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await aiService.testConnection();
      setTestResult(res);
      await loadOverview();
    } catch (err: any) {
      setTestResult({
        connected: false,
        requestId: 'client_err',
        latencyMs: 0,
        error: err?.message || 'OpenAI test failed.',
        code: err?.code,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleCopySql = async () => {
    const sql = await aiService.getMigrationSql();
    if (sql) {
      await navigator.clipboard.writeText(sql);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    }
  };

  const handleDraftChange = (
    moduleKey: AiFeatureModuleKey,
    patch: Partial<AiFeatureSetting>
  ) => {
    setDraftSettings((prev) => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        ...patch,
      },
    }));
  };

  const handleSaveSetting = async (moduleKey: AiFeatureModuleKey) => {
    const item = draftSettings[moduleKey];
    if (!item) return;
    setSavingKey(moduleKey);
    setSaveNotice(null);
    try {
      const res = await aiService.updateModuleSetting({
        moduleKey,
        enabled: item.enabled,
        modelOverride: item.model_override?.trim() || null,
        maxRequestsPerMin: Number(item.max_requests_per_min) || 25,
        maxOutputTokens: Number(item.max_output_tokens) || 800,
        monthlyBudgetUsd: Number(item.monthly_budget_usd) || 100,
      });
      setSaveNotice(
        res.warning || `Saved governance policy for ${res.setting.display_name}.`
      );
      await loadOverview();
    } catch (err: any) {
      setSaveNotice(`Error saving ${moduleKey}: ${err?.message || 'Failed'}`);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#071A2B] text-white rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#EF233C] bg-red-950/80 border border-red-500/20 px-2.5 py-0.5 rounded-full">
              OpenAI Platform Operations
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Server-Side Key &amp; Role Governance
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-[#EF233C]" />
            <span>AI Control Centre</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
            Monitor OpenAI token usage, latency, estimated spend, module feature toggles, model overrides, rate limits, and voice/search telemetry across MANIFOLD.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRunTest}
            disabled={testing}
            className="px-4 py-2.5 bg-[#EF233C] hover:bg-[#d91b32] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl inline-flex items-center gap-2 shadow-lg shadow-red-900/30 cursor-pointer"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            <span>Test OpenAI Connection</span>
          </button>

          <button
            type="button"
            onClick={loadOverview}
            disabled={loading}
            className="p-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl border border-white/15 cursor-pointer"
            title="Refresh AI metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Supabase AI Migration Banner */}
      {overview && !overview.dbStatus.tablesExist && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Supabase AI Platform Migration Pending</p>
              <p className="text-amber-800 mt-0.5">
                Missing tables: <span className="font-mono">{overview.dbStatus.missingTables.join(', ')}</span>. Telemetry is running via runtime fallback buffer until you execute <code className="bg-amber-100 px-1 rounded">src/db/ai-platform-migration.sql</code> in Supabase SQL Editor.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopySql}
            className="shrink-0 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSql ? 'SQL Copied' : 'Copy AI Migration SQL'}</span>
          </button>
        </div>
      )}

      {saveNotice && (
        <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 font-medium flex items-center justify-between">
          <span>{saveNotice}</span>
          <button type="button" onClick={() => setSaveNotice(null)} className="text-xs font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-[#EF233C] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Environment Config & Live Connection Test Result */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 shadow-sm">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
            Server Environment Configuration
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">
                OPENAI_API_KEY
              </span>
              <span
                className={`font-bold flex items-center gap-1.5 mt-0.5 ${
                  overview?.config.apiKeyConfigured ? 'text-emerald-700' : 'text-[#EF233C]'
                }`}
              >
                {overview?.config.apiKeyConfigured ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>{overview?.config.apiKeyConfigured ? 'Configured (Server-Only)' : 'Missing in Env'}</span>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">
                OPENAI_MODEL
              </span>
              <span className="font-bold text-gray-900 block mt-0.5 font-mono">
                {overview?.config.configuredModel || 'Not Set (503 until set)'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">
                Transcription Model
              </span>
              <span className="font-semibold text-gray-800 block mt-0.5 font-mono">
                {overview?.config.transcriptionModel || 'gpt-4o-mini-transcribe'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">
                Gemini Market Extraction
              </span>
              <span className="font-semibold text-emerald-700 block mt-0.5">
                Preserved (Knowledge Base)
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 shadow-sm">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
            Live OpenAI Connection Verification
          </h3>
          {testResult ? (
            <div
              className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                testResult.connected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  {testResult.connected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[#EF233C]" />
                  )}
                  <span>
                    {testResult.connected ? 'Live OpenAI Response Verified' : 'Connection Verification Failed'}
                  </span>
                </span>
                <span>{testResult.latencyMs}ms</span>
              </div>
              {testResult.connected ? (
                <p className="text-[11px] font-mono">
                  Model: {testResult.model} · Tokens: {testResult.usage?.totalTokens ?? 0} · Output: {testResult.output}
                </p>
              ) : (
                <p className="text-[11px]">
                  {testResult.error} {testResult.code ? `(${testResult.code})` : ''}
                </p>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-xs text-gray-500">
              Click <strong>Test OpenAI Connection</strong> above to execute a genuine server-side API check and record latency.
            </div>
          )}
        </div>
      </div>

      {/* KPI Metrics Grid */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-[10px] font-bold uppercase text-gray-400 block">Total Requests</span>
            <span className="text-2xl font-extrabold text-[#071A2B]">{overview.summary.totalRequests}</span>
            <span className="text-[11px] text-emerald-600 block">
              {overview.summary.successCount} ok · {overview.summary.failureCount} failed
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-[10px] font-bold uppercase text-gray-400 block">Total Tokens</span>
            <span className="text-2xl font-extrabold text-[#071A2B]">
              {overview.summary.totalTokens.toLocaleString()}
            </span>
            <span className="text-[11px] text-gray-500 block">
              {overview.summary.totalInputTokens.toLocaleString()} in / {overview.summary.totalOutputTokens.toLocaleString()} out
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-600" />
              <span>Est. Spend (USD)</span>
            </span>
            <span className="text-2xl font-extrabold text-emerald-700">
              ${overview.summary.estimatedSpendUsd.toFixed(4)}
            </span>
            <span className="text-[11px] text-gray-500 block">Logged requests</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-1">
              <Activity className="w-3 h-3 text-blue-600" />
              <span>Avg Latency</span>
            </span>
            <span className="text-2xl font-extrabold text-[#071A2B]">{overview.summary.avgLatencyMs}ms</span>
            <span className="text-[11px] text-gray-500 block">
              {overview.summary.rateLimitEvents} rate-limit events
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-[10px] font-bold uppercase text-gray-400 block">Search vs Voice</span>
            <span className="text-2xl font-extrabold text-[#071A2B]">
              {overview.summary.textSearchCount} / {overview.summary.voiceSearchCount}
            </span>
            <span className="text-[11px] text-amber-700 block">
              {overview.summary.zeroResultSearches} zero-result queries
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-[10px] font-bold uppercase text-gray-400 block">Dealer Copy Gen</span>
            <span className="text-2xl font-extrabold text-[#071A2B]">{overview.summary.listingGenerations}</span>
            <span className="text-[11px] text-gray-500 block">
              {overview.summary.assistantRequests} assistant chats
            </span>
          </div>
        </div>
      )}

      {/* Module Governance Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#EF233C]" />
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                AI Feature Toggles, Model Overrides &amp; Rate/Token Governance
              </h3>
              <p className="text-xs text-gray-500">
                Enable/disable AI modules independently or override the default OpenAI model per workflow.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Model Override</th>
                <th className="py-3 px-4">Max RPM</th>
                <th className="py-3 px-4">Max Output Tokens</th>
                <th className="py-3 px-4">Budget (USD)</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.values(draftSettings).map((item) => (
                <tr key={item.module_key} className="hover:bg-gray-50/70">
                  <td className="py-3 px-4">
                    <p className="font-bold text-gray-900">{item.display_name}</p>
                    <p className="text-[11px] text-gray-400">{item.description}</p>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleDraftChange(item.module_key, { enabled: !item.enabled })}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase cursor-pointer ${
                        item.enabled
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {item.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="text"
                      value={item.model_override || ''}
                      onChange={(e) =>
                        handleDraftChange(item.module_key, { model_override: e.target.value })
                      }
                      placeholder="Use OPENAI_MODEL"
                      className="w-36 h-8 px-2 bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-mono"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      min={1}
                      max={300}
                      value={item.max_requests_per_min}
                      onChange={(e) =>
                        handleDraftChange(item.module_key, {
                          max_requests_per_min: Number(e.target.value),
                        })
                      }
                      className="w-20 h-8 px-2 bg-gray-50 border border-gray-200 rounded-lg text-[11px]"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      min={128}
                      max={2000}
                      value={item.max_output_tokens}
                      onChange={(e) =>
                        handleDraftChange(item.module_key, {
                          max_output_tokens: Number(e.target.value),
                        })
                      }
                      className="w-24 h-8 px-2 bg-gray-50 border border-gray-200 rounded-lg text-[11px]"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      min={0}
                      step="10"
                      value={item.monthly_budget_usd}
                      onChange={(e) =>
                        handleDraftChange(item.module_key, {
                          monthly_budget_usd: Number(e.target.value),
                        })
                      }
                      className="w-20 h-8 px-2 bg-gray-50 border border-gray-200 rounded-lg text-[11px]"
                    />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSaveSetting(item.module_key)}
                      disabled={savingKey === item.module_key}
                      className="px-3 py-1.5 bg-[#071A2B] hover:bg-[#0B2239] text-white text-[11px] font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {savingKey === item.module_key ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3" />
                      )}
                      <span>Save</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Breakdown by Module & Failed Request Log */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                Usage by Feature Module
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-4">Module</th>
                    <th className="py-2.5 px-4">Requests</th>
                    <th className="py-2.5 px-4">Avg Latency</th>
                    <th className="py-2.5 px-4 text-right">Tokens / Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {overview.byModule.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-400">
                        No AI usage events logged yet.
                      </td>
                    </tr>
                  ) : (
                    overview.byModule.map((m) => (
                      <tr key={m.module}>
                        <td className="py-2.5 px-4 font-bold text-gray-900">{m.module}</td>
                        <td className="py-2.5 px-4">
                          {m.requests} ({m.failures} err)
                        </td>
                        <td className="py-2.5 px-4">{m.avgLatencyMs}ms</td>
                        <td className="py-2.5 px-4 text-right font-mono">
                          {m.tokens.toLocaleString()} · ${m.spendUsd.toFixed(4)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                Recent Failed AI Requests
              </h3>
            </div>
            <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {overview.failedRequests.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  Zero failed AI requests logged.
                </div>
              ) : (
                overview.failedRequests.map((f) => (
                  <div key={f.request_id} className="p-3 text-xs space-y-0.5">
                    <div className="flex items-center justify-between font-bold text-gray-900">
                      <span>
                        {f.feature_module} ({f.error_code || 'ERROR'})
                      </span>
                      <span className="text-[10px] font-normal text-gray-400">
                        {f.created_at ? new Date(f.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-red-700">{f.error_message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
