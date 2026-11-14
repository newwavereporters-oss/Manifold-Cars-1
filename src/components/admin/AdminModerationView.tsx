import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Flag,
  AlertTriangle,
  Users,
  Sliders,
  RefreshCw,
  CheckCircle2,
  Ban,
  Clock,
  ShieldCheck,
  Loader2,
  Copy,
  Check,
  Database,
  History,
  X,
} from 'lucide-react';
import {
  adminExecutePlayerAction,
  adminFetchModerationOverview,
  adminSaveModerationConfig,
  checkWorldDbStatus,
  type AdminModerationOverview,
  type AdminPlayerActionType,
  type WorldDbStatus,
} from '../../services/playerService';

type ModerationSubTab = 'reports' | 'incidents' | 'flagged' | 'auditLogs' | 'config';

interface PendingModerationConfirm {
  playerId: string;
  nickname: string;
  action: AdminPlayerActionType;
  restrictMinutes?: number | null;
  reportId?: string | null;
  reportStatus?: 'reviewed' | 'action_taken' | 'dismissed' | null;
  title: string;
  defaultReason: string;
  label: string;
  tone: 'danger' | 'warning' | 'success' | 'neutral';
}

export const AdminModerationView: React.FC = () => {
  const [subTab, setSubTab] = useState<ModerationSubTab>('reports');
  const [overview, setOverview] = useState<AdminModerationOverview | null>(null);
  const [dbStatus, setDbStatus] = useState<WorldDbStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Admin report note draft per report id
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  // Mandatory confirmation + reason modal
  const [pendingConfirm, setPendingConfirm] = useState<PendingModerationConfirm | null>(null);
  const [confirmReason, setConfirmReason] = useState('');

  // Moderation config form state
  const [cfgRadius, setCfgRadius] = useState(110);
  const [cfgTimeoutMins, setCfgTimeoutMins] = useState(10);
  const [cfgWarnThresh, setCfgWarnThresh] = useState(2);
  const [cfgRestrictMins, setCfgRestrictMins] = useState(15);
  const [cfgSuspendThresh, setCfgSuspendThresh] = useState(6);
  const [savingConfig, setSavingConfig] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    const status = await checkWorldDbStatus();
    setDbStatus(status);

    if (status.migrationRequired) {
      setLoading(false);
      return;
    }

    const res = await adminFetchModerationOverview();
    if (!res.success || !res.data) {
      setErrorMsg(res.error || 'Unable to load moderation overview.');
      setLoading(false);
      return;
    }

    setOverview(res.data);
    if (res.data.config) {
      setCfgRadius(res.data.config.discovery_radius);
      setCfgTimeoutMins(res.data.config.heartbeat_timeout_minutes);
      setCfgWarnThresh(res.data.config.warning_threshold);
      setCfgRestrictMins(res.data.config.temp_restriction_minutes);
      setCfgSuspendThresh(res.data.config.suspension_threshold);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCopyMigrationSql = async () => {
    try {
      const res = await fetch('/api/world/migration-sql');
      if (res.ok) {
        const sql = await res.text();
        await navigator.clipboard.writeText(sql);
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 3000);
      }
    } catch {}
  };

  const requestModerationConfirmation = (item: PendingModerationConfirm) => {
    setConfirmReason(item.defaultReason);
    setPendingConfirm(item);
  };

  const executeConfirmedModeration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingConfirm) return;
    const cleanReason = confirmReason.trim();
    if (cleanReason.length < 3) {
      setErrorMsg('An audit reason (at least 3 characters) is required.');
      return;
    }

    const key = pendingConfirm.reportId || pendingConfirm.playerId;
    setBusyId(key);
    setActionBanner(null);
    setErrorMsg(null);
    try {
      const res = await adminExecutePlayerAction({
        playerId: pendingConfirm.playerId,
        action: pendingConfirm.action,
        reason: cleanReason,
        restrictMinutes: pendingConfirm.restrictMinutes ?? null,
        reportId: pendingConfirm.reportId ?? null,
        reportStatus: pendingConfirm.reportStatus ?? null,
      });
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to apply moderation action.');
      } else {
        setActionBanner(pendingConfirm.label);
        setPendingConfirm(null);
        await loadData();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setErrorMsg(null);
    setActionBanner(null);
    try {
      const res = await adminSaveModerationConfig({
        discoveryRadius: Math.max(30, Math.min(200, cfgRadius)),
        heartbeatTimeoutMinutes: Math.max(2, Math.min(30, cfgTimeoutMins)),
        warningThreshold: Math.max(1, Math.min(10, cfgWarnThresh)),
        tempRestrictionMinutes: Math.max(5, Math.min(1440, cfgRestrictMins)),
        suspensionThreshold: Math.max(3, Math.min(20, cfgSuspendThresh)),
      });
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to update moderation configuration.');
      } else {
        setActionBanner('Safety & discovery configuration updated.');
        await loadData();
      }
    } finally {
      setSavingConfig(false);
    }
  };

  const pendingReportsCount =
    overview?.reports.filter((r) => r.review_status === 'pending').length || 0;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-[#EF233C]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-gray-900">
              Game World Safety &amp; Chat Moderation
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Review in-world player reports, audit server-blocked and flagged-for-review chat incidents,
              enforce separated chat restrictions or account suspensions with mandatory audit reasons, and tune discovery rules.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Migration Notice */}
      {dbStatus?.migrationRequired && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <h3 className="text-sm font-black text-amber-950">
                Game World Database Migration Required
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                The social &amp; moderation tables (<code>player_profiles</code>,{' '}
                <code>player_reports</code>, <code>moderation_incidents</code>,{' '}
                <code>player_admin_audit_logs</code>, <code>chat_moderation_config</code>) have not yet been applied in Supabase. Run{' '}
                <code>src/db/game-world-social-migration.sql</code> in your Supabase SQL Editor.
              </p>
            </div>
          </div>
          <button
            onClick={() => void handleCopyMigrationSql()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>
              {copiedSql ? 'Copied Migration SQL to Clipboard' : 'Copy Migration SQL'}
            </span>
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-700 font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {actionBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800 font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionBanner}</span>
        </div>
      )}

      {/* Sub-navigation */}
      {!dbStatus?.migrationRequired && (
        <>
          <div className="flex flex-wrap gap-2">
            {[
              {
                id: 'reports' as const,
                label: `Player Reports (${overview?.reports.length || 0})`,
                badge: pendingReportsCount,
                icon: Flag,
              },
              {
                id: 'incidents' as const,
                label: `Chat Incidents (${overview?.incidents.length || 0})`,
                badge: 0,
                icon: AlertTriangle,
              },
              {
                id: 'flagged' as const,
                label: `Restricted / Flagged (${overview?.flaggedPlayers.length || 0})`,
                badge: 0,
                icon: Users,
              },
              {
                id: 'auditLogs' as const,
                label: `Admin Audit Log (${overview?.auditLogs?.length || 0})`,
                badge: 0,
                icon: History,
              },
              {
                id: 'config' as const,
                label: 'Safety & Discovery Rules',
                badge: 0,
                icon: Sliders,
              },
            ].map((item) => {
              const Icon = item.icon;
              const active = subTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSubTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    active
                      ? 'bg-[#071A2B] text-white border-[#071A2B] shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#EF233C] text-white text-[10px] font-black">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 flex flex-col items-center justify-center gap-3 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin text-[#EF233C]" />
              <span className="text-xs font-semibold">Loading safety telemetry...</span>
            </div>
          ) : (
            <>
              {/* 1. PLAYER REPORTS */}
              {subTab === 'reports' && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {(!overview?.reports || overview.reports.length === 0) ? (
                    <div className="p-12 text-center space-y-2">
                      <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
                      <p className="text-sm font-bold text-gray-900">No player reports logged</p>
                      <p className="text-xs text-gray-500">
                        Driver safety reports submitted from in-game chat will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {overview.reports.map((rep) => {
                        const isBusy = busyId === rep.id;
                        return (
                          <div key={rep.id} className="p-5 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    rep.review_status === 'pending'
                                      ? 'bg-red-100 text-red-700'
                                      : rep.review_status === 'action_taken'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {rep.review_status.replace('_', ' ')}
                                </span>
                                <span className="text-sm font-black text-gray-900">
                                  Reported: {rep.reported_nickname}
                                </span>
                                <span className="text-xs text-gray-500">
                                  by <strong>{rep.reporter_nickname}</strong>
                                </span>
                                <span className="text-[11px] font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                                  Acct: {rep.reported_account_status} | Chat: {rep.reported_chat_status || 'enabled'} ({rep.reported_violation_count} strikes)
                                </span>
                              </div>
                              <span className="text-[11px] text-gray-400">
                                {new Date(rep.created_at).toLocaleString()}
                              </span>
                            </div>

                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200/80 space-y-1">
                              <p className="text-xs font-bold text-gray-800">{rep.reason}</p>
                              {rep.description && (
                                <p className="text-xs text-gray-600">{rep.description}</p>
                              )}
                              {rep.admin_notes && (
                                <p className="text-[11px] text-indigo-700 font-semibold pt-1">
                                  Audit note: {rep.admin_notes}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
                              <input
                                type="text"
                                placeholder="Reason / review note (min 3 chars required for audit)..."
                                value={noteDrafts[rep.id] ?? rep.admin_notes ?? ''}
                                onChange={(e) =>
                                  setNoteDrafts((prev) => ({ ...prev, [rep.id]: e.target.value }))
                                }
                                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-gray-400"
                              />
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  disabled={isBusy}
                                  onClick={() =>
                                    requestModerationConfirmation({
                                      playerId: rep.reported_player_id,
                                      nickname: rep.reported_nickname,
                                      action: 'restrict_chat_temp',
                                      restrictMinutes: 60,
                                      reportId: rep.id,
                                      reportStatus: 'action_taken',
                                      title: 'Restrict Chat (1 Hour)',
                                      defaultReason:
                                        noteDrafts[rep.id]?.trim() ||
                                        `Temporary 1h chat restriction following player report: ${rep.reason}`,
                                      label: `Restricted ${rep.reported_nickname} chat for 60 minutes (audit logged).`,
                                      tone: 'warning',
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                >
                                  <Clock className="w-3 h-3" />
                                  <span>Restrict Chat 1h</span>
                                </button>
                                <button
                                  disabled={isBusy}
                                  onClick={() =>
                                    requestModerationConfirmation({
                                      playerId: rep.reported_player_id,
                                      nickname: rep.reported_nickname,
                                      action: 'restrict_chat_temp',
                                      restrictMinutes: 1440,
                                      reportId: rep.id,
                                      reportStatus: 'action_taken',
                                      title: 'Restrict Chat (24 Hours)',
                                      defaultReason:
                                        noteDrafts[rep.id]?.trim() ||
                                        `Temporary 24h chat restriction following player report: ${rep.reason}`,
                                      label: `Restricted ${rep.reported_nickname} chat for 24 hours (audit logged).`,
                                      tone: 'warning',
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                                >
                                  Restrict Chat 24h
                                </button>
                                <button
                                  disabled={isBusy}
                                  onClick={() =>
                                    requestModerationConfirmation({
                                      playerId: rep.reported_player_id,
                                      nickname: rep.reported_nickname,
                                      action: 'suspend_account',
                                      restrictMinutes: null,
                                      reportId: rep.id,
                                      reportStatus: 'action_taken',
                                      title: 'Suspend Game Account',
                                      defaultReason:
                                        noteDrafts[rep.id]?.trim() ||
                                        `Account suspended due to confirmed report: ${rep.reason}`,
                                      label: `Suspended ${rep.reported_nickname} from MANIFOLD World (audit logged).`,
                                      tone: 'danger',
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-[#EF233C] hover:bg-red-700 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                >
                                  <Ban className="w-3 h-3" />
                                  <span>Suspend Account</span>
                                </button>
                                <button
                                  disabled={isBusy}
                                  onClick={() =>
                                    requestModerationConfirmation({
                                      playerId: rep.reported_player_id,
                                      nickname: rep.reported_nickname,
                                      action: 'dismiss_report',
                                      restrictMinutes: null,
                                      reportId: rep.id,
                                      reportStatus: 'dismissed',
                                      title: 'Dismiss Player Report',
                                      defaultReason:
                                        noteDrafts[rep.id]?.trim() ||
                                        'Reviewed report — no policy violation substantiated.',
                                      label: `Report dismissed and logged to audit trail.`,
                                      tone: 'neutral',
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                                >
                                  Dismiss
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 2. CHAT MODERATION INCIDENTS (Blocked + Flagged for Review) */}
              {subTab === 'incidents' && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
                  {(!overview?.incidents || overview.incidents.length === 0) ? (
                    <div className="p-12 text-center space-y-2">
                      <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
                      <p className="text-sm font-bold text-gray-900">
                        No automated moderation incidents recorded
                      </p>
                      <p className="text-xs text-gray-500">
                        Blocked policy violations and conservatively flagged borderline messages appear here.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                          <th className="py-3 px-4">Driver Nickname</th>
                          <th className="py-3 px-4">Severity</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Action Taken</th>
                          <th className="py-3 px-4">Intercepted Content</th>
                          <th className="py-3 px-4">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {overview.incidents.map((inc) => (
                          <tr key={inc.id} className="hover:bg-gray-50/70">
                            <td className="py-3 px-4 font-bold text-gray-900">{inc.nickname}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  inc.severity === 'flagged_for_review'
                                    ? 'bg-amber-100 text-amber-800'
                                    : inc.severity === 'cleared'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {(inc.severity || 'blocked').replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-800 font-mono text-[10px] font-bold">
                                {inc.violation_category}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-gray-700">
                              {inc.action_taken}
                            </td>
                            <td className="py-3 px-4 text-gray-600 max-w-md break-words">
                              {inc.attempted_content}
                            </td>
                            <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                              {new Date(inc.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* 3. RESTRICTED / FLAGGED PLAYERS */}
              {subTab === 'flagged' && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
                  {(!overview?.flaggedPlayers || overview.flaggedPlayers.length === 0) ? (
                    <div className="p-12 text-center space-y-2">
                      <Users className="w-8 h-8 text-emerald-500 mx-auto" />
                      <p className="text-sm font-bold text-gray-900">No flagged or restricted drivers</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                          <th className="py-3 px-4">Nickname</th>
                          <th className="py-3 px-4">Account Status</th>
                          <th className="py-3 px-4">Chat Status</th>
                          <th className="py-3 px-4">Strikes</th>
                          <th className="py-3 px-4">Restricted Until</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {overview.flaggedPlayers.map((pl) => {
                          const isBusy = busyId === pl.id;
                          return (
                            <tr key={pl.id} className="hover:bg-gray-50/70">
                              <td className="py-3 px-4 font-bold text-gray-900">{pl.nickname}</td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    pl.account_status === 'suspended'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-emerald-100 text-emerald-700'
                                  }`}
                                >
                                  {pl.account_status}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    pl.chat_status === 'permanently_restricted'
                                      ? 'bg-red-100 text-red-700'
                                      : pl.chat_status === 'temporarily_restricted'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-700'
                                  }`}
                                >
                                  {(pl.chat_status || 'enabled').replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-gray-800">
                                {pl.chat_violation_count}
                              </td>
                              <td className="py-3 px-4 text-gray-500">
                                {pl.chat_restricted_until
                                  ? new Date(pl.chat_restricted_until).toLocaleString()
                                  : '—'}
                              </td>
                              <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                                {pl.chat_status !== 'enabled' && (
                                  <button
                                    disabled={isBusy}
                                    onClick={() =>
                                      requestModerationConfirmation({
                                        playerId: pl.id,
                                        nickname: pl.nickname,
                                        action: 'restore_chat',
                                        title: 'Restore Chat Access',
                                        defaultReason: 'Admin restored chat privileges after review.',
                                        label: `Restored chat access for ${pl.nickname}.`,
                                        tone: 'success',
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                                  >
                                    Restore Chat
                                  </button>
                                )}
                                {pl.account_status === 'suspended' ? (
                                  <button
                                    disabled={isBusy}
                                    onClick={() =>
                                      requestModerationConfirmation({
                                        playerId: pl.id,
                                        nickname: pl.nickname,
                                        action: 'reactivate_account',
                                        title: 'Reactivate Account',
                                        defaultReason: 'Admin reactivated game account after review.',
                                        label: `Reactivated ${pl.nickname}.`,
                                        tone: 'success',
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                                  >
                                    Reactivate Account
                                  </button>
                                ) : (
                                  <button
                                    disabled={isBusy}
                                    onClick={() =>
                                      requestModerationConfirmation({
                                        playerId: pl.id,
                                        nickname: pl.nickname,
                                        action: 'suspend_account',
                                        title: 'Suspend Game Account',
                                        defaultReason: 'Account suspended due to repeated safety violations.',
                                        label: `Suspended ${pl.nickname}.`,
                                        tone: 'danger',
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-[#EF233C] hover:bg-red-700 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                                  >
                                    Suspend Account
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* 4. IMMUTABLE ADMIN AUDIT LOGS */}
              {subTab === 'auditLogs' && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
                  {(!overview?.auditLogs || overview.auditLogs.length === 0) ? (
                    <div className="p-12 text-center space-y-2">
                      <History className="w-8 h-8 text-gray-400 mx-auto" />
                      <p className="text-sm font-bold text-gray-900">No admin audit entries recorded yet</p>
                      <p className="text-xs text-gray-500">
                        Every administrative account or chat governance action creates an immutable audit record here.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                          <th className="py-3 px-4">Timestamp</th>
                          <th className="py-3 px-4">Administrator</th>
                          <th className="py-3 px-4">Target Driver</th>
                          <th className="py-3 px-4">Action</th>
                          <th className="py-3 px-4">Recorded Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {overview.auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50/70">
                            <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 font-semibold text-gray-700">{log.admin_email}</td>
                            <td className="py-3 px-4 font-bold text-gray-900">{log.player_nickname}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-[#071A2B] font-mono text-[10px] font-bold uppercase">
                                {log.action.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-700">{log.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* 5. MODERATION & DISCOVERY CONFIGURATION */}
              {subTab === 'config' && (
                <form
                  onSubmit={handleSaveConfig}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5 max-w-2xl"
                >
                  <div>
                    <h3 className="text-sm font-black text-gray-900">
                      Authoritative Multiplayer &amp; Safety Rules
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      These parameters govern server-side proximity discovery distance, inactivity timeout,
                      and automated chat moderation thresholds inside Postgres RPCs.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1.5 block">
                      <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                        Discovery Radius (Meters / Units)
                      </span>
                      <input
                        type="number"
                        min={30}
                        max={200}
                        value={cfgRadius}
                        onChange={(e) => setCfgRadius(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#EF233C]"
                      />
                    </label>

                    <label className="space-y-1.5 block">
                      <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                        Inactivity Presence Timeout (Minutes)
                      </span>
                      <input
                        type="number"
                        min={2}
                        max={30}
                        value={cfgTimeoutMins}
                        onChange={(e) => setCfgTimeoutMins(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#EF233C]"
                      />
                    </label>

                    <label className="space-y-1.5 block">
                      <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                        Temp Chat Restriction Strike Threshold
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={cfgWarnThresh}
                        onChange={(e) => setCfgWarnThresh(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#EF233C]"
                      />
                    </label>

                    <label className="space-y-1.5 block">
                      <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                        Auto Chat Restriction (Minutes)
                      </span>
                      <input
                        type="number"
                        min={5}
                        max={1440}
                        value={cfgRestrictMins}
                        onChange={(e) => setCfgRestrictMins(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#EF233C]"
                      />
                    </label>

                    <label className="space-y-1.5 block sm:col-span-2">
                      <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                        Extended 24h Chat Restriction Threshold
                      </span>
                      <input
                        type="number"
                        min={3}
                        max={20}
                        value={cfgSuspendThresh}
                        onChange={(e) => setCfgSuspendThresh(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#EF233C]"
                      />
                    </label>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={savingConfig}
                      className="px-5 py-2.5 rounded-xl bg-[#071A2B] hover:bg-[#0c2740] text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                    >
                      {savingConfig && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Save Safety Configuration</span>
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </>
      )}

      {/* MANDATORY CONFIRMATION + AUDIT REASON MODAL */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={executeConfirmedModeration}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-gray-900">{pendingConfirm.title}</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Target driver: <strong>{pendingConfirm.nickname}</strong>. This action will be permanently logged.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Audit Reason <span className="text-[#EF233C]">*</span>
              </label>
              <textarea
                required
                minLength={3}
                rows={3}
                value={confirmReason}
                onChange={(e) => setConfirmReason(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-300 text-xs text-gray-900 outline-none focus:border-[#071A2B] resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId !== null || confirmReason.trim().length < 3}
                className={`px-4 py-2 rounded-xl text-white text-xs font-black uppercase flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                  pendingConfirm.tone === 'danger'
                    ? 'bg-[#EF233C] hover:bg-red-700'
                    : pendingConfirm.tone === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : pendingConfirm.tone === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-[#071A2B] hover:bg-[#0d2842]'
                }`}
              >
                {busyId !== null && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm &amp; Record Audit</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
