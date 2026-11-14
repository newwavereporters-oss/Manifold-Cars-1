import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Eye,
  Ban,
  CheckCircle2,
  MessageSquareOff,
  MessageSquare,
  Clock,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Car,
  Mail,
  Phone,
  Calendar,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  History,
  Flag,
  Database,
  Copy,
  Check,
  Wifi,
  WifiOff,
  UserPlus,
} from 'lucide-react';
import {
  adminExecutePlayerAction,
  adminFetchPlayerDetail,
  adminFetchPlayersDirectory,
  checkWorldDbStatus,
  type AdminPlayerActionType,
  type AdminPlayerDetailResponse,
  type AdminPlayerDirectoryItem,
  type AdminPlayersDirectoryResponse,
  type WorldDbStatus,
} from '../../services/playerService';

interface PendingActionModalState {
  playerId: string;
  nickname: string;
  action: AdminPlayerActionType;
  title: string;
  description: string;
  restrictMinutes?: number | null;
  confirmTone: 'danger' | 'warning' | 'success';
}

export const AdminGamePlayersView: React.FC = () => {
  const [dbStatus, setDbStatus] = useState<WorldDbStatus | null>(null);
  const [directory, setDirectory] = useState<AdminPlayersDirectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Filters & Pagination
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [chatFilter, setChatFilter] = useState('all');
  const [onboardingFilter, setOnboardingFilter] = useState('all');
  const [onlineFilter, setOnlineFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Detail Drawer State
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<AdminPlayerDetailResponse | null>(null);
  const [tempRestrictMinutes, setTempRestrictMinutes] = useState<number>(60);

  // Mandatory Confirmation + Reason Modal
  const [pendingAction, setPendingAction] = useState<PendingActionModalState | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [executingAction, setExecutingAction] = useState(false);

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const status = await checkWorldDbStatus();
    setDbStatus(status);

    if (status.migrationRequired) {
      setLoading(false);
      return;
    }

    const res = await adminFetchPlayersDirectory({
      search: appliedSearch,
      accountStatus: accountFilter,
      chatStatus: chatFilter,
      onboardingStatus: onboardingFilter,
      onlineFilter,
      page,
      pageSize,
    });

    if (!res.success || !res.data) {
      setErrorMsg(res.error || 'Unable to load Game Players directory.');
    } else {
      setDirectory(res.data);
    }
    setLoading(false);
  }, [appliedSearch, accountFilter, chatFilter, onboardingFilter, onlineFilter, page]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const handleOpenDetail = async (player: AdminPlayerDirectoryItem) => {
    setDetailLoading(true);
    setErrorMsg(null);
    const res = await adminFetchPlayerDetail(player.id);
    setDetailLoading(false);
    if (!res.success || !res.data) {
      setErrorMsg(res.error || `Failed to inspect player ${player.nickname}.`);
      return;
    }
    setSelectedDetail(res.data);
  };

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

  const openActionConfirm = (modal: PendingActionModalState) => {
    setActionReason('');
    setPendingAction(modal);
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAction) return;
    if (actionReason.trim().length < 3) {
      setErrorMsg('Please enter an audit reason (at least 3 characters).');
      return;
    }
    setExecutingAction(true);
    setErrorMsg(null);
    setBannerMsg(null);

    const res = await adminExecutePlayerAction({
      playerId: pendingAction.playerId,
      action: pendingAction.action,
      reason: actionReason.trim(),
      restrictMinutes: pendingAction.restrictMinutes ?? null,
    });

    setExecutingAction(false);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to apply administrative action.');
      return;
    }

    const doneMsg = `Audit logged: ${pendingAction.title} for ${pendingAction.nickname}.`;
    const targetId = pendingAction.playerId;
    setPendingAction(null);
    setBannerMsg(doneMsg);

    await loadDirectory();
    if (selectedDetail && selectedDetail.player.id === targetId) {
      const refreshed = await adminFetchPlayerDetail(targetId);
      if (refreshed.success && refreshed.data) {
        setSelectedDetail(refreshed.data);
      }
    }
  };

  const totalPages = directory ? Math.max(1, Math.ceil(directory.totalCount / directory.pageSize)) : 1;
  const s = directory?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#071A2B] flex items-center justify-center shrink-0 text-white">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-gray-900">
              MANIFOLD CARS 3D — Game Players Directory
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Authorised admin directory of registered drivers, live session presence, onboarding &amp; vehicle setup,
              separated account/chat status controls, and immutable audit logs. Private chat transcripts remain protected.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadDirectory()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold transition cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Players</span>
        </button>
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
                Apply <code>src/db/game-world-social-migration.sql</code> in your Supabase SQL Editor to enable
                the <code>GAME PLAYERS</code> directory, audit logs, and player presence telemetry.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleCopyMigrationSql()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSql ? 'Copied Migration SQL' : 'Copy Migration SQL'}</span>
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-700 font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {bannerMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800 font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{bannerMsg}</span>
        </div>
      )}

      {/* 8 KPI Cards */}
      {!dbStatus?.migrationRequired && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {[
              { label: 'Total Registered', value: s?.totalRegistered ?? 0, icon: Users, tone: 'text-[#071A2B] bg-slate-100' },
              { label: 'Online Players', value: s?.onlineCount ?? 0, icon: Wifi, tone: 'text-emerald-700 bg-emerald-50' },
              { label: 'Offline Players', value: s?.offlineCount ?? 0, icon: WifiOff, tone: 'text-gray-600 bg-gray-100' },
              { label: 'New (24h)', value: s?.newRegistrations24h ?? 0, icon: UserPlus, tone: 'text-sky-700 bg-sky-50' },
              { label: 'Completed Onboarding', value: s?.completedOnboarding ?? 0, icon: ShieldCheck, tone: 'text-indigo-700 bg-indigo-50' },
              { label: 'Incomplete Onboarding', value: s?.incompleteOnboarding ?? 0, icon: Clock, tone: 'text-amber-700 bg-amber-50' },
              { label: 'Suspended Accounts', value: s?.suspendedCount ?? 0, icon: Ban, tone: 'text-red-700 bg-red-50' },
              { label: 'Chat-Restricted', value: s?.chatRestrictedCount ?? 0, icon: MessageSquareOff, tone: 'text-orange-700 bg-orange-50' },
            ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${kpi.tone}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block truncate">
                      {kpi.label}
                    </span>
                    <span className="text-xl font-black text-gray-900 tabular-nums">
                      {kpi.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
            <div className="flex flex-col lg:flex-row gap-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(1);
                  setAppliedSearch(searchInput.trim());
                }}
                className="flex-1 flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search nickname, full name, email, or phone..."
                    className="w-full h-10 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 h-10 rounded-xl bg-[#071A2B] hover:bg-[#0d2842] text-white text-xs font-bold cursor-pointer shrink-0"
                >
                  Search
                </button>
              </form>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <select
                  value={accountFilter}
                  onChange={(e) => {
                    setAccountFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by account status"
                  className="h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 outline-none"
                >
                  <option value="all">Account: All</option>
                  <option value="active">Account: Active</option>
                  <option value="suspended">Account: Suspended</option>
                </select>

                <select
                  value={chatFilter}
                  onChange={(e) => {
                    setChatFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by chat status"
                  className="h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 outline-none"
                >
                  <option value="all">Chat: All</option>
                  <option value="enabled">Chat: Enabled</option>
                  <option value="restricted">Chat: Any Restricted</option>
                  <option value="temporarily_restricted">Chat: Temp Restricted</option>
                  <option value="permanently_restricted">Chat: Permanent Restricted</option>
                </select>

                <select
                  value={onboardingFilter}
                  onChange={(e) => {
                    setOnboardingFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by onboarding status"
                  className="h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 outline-none"
                >
                  <option value="all">Onboarding: All</option>
                  <option value="active">Completed</option>
                  <option value="incomplete">Incomplete</option>
                  <option value="briefing_accepted">Briefing Accepted</option>
                  <option value="registered">Registered Only</option>
                </select>

                <select
                  value={onlineFilter}
                  onChange={(e) => {
                    setOnlineFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by online state"
                  className="h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 outline-none"
                >
                  <option value="all">Presence: All</option>
                  <option value="online">Online Now</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
            </div>
          </div>

          {/* Players Directory Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin text-[#EF233C]" />
                <span className="text-xs font-semibold">Loading registered game players...</span>
              </div>
            ) : !directory || directory.players.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Users className="w-8 h-8 text-gray-400 mx-auto" />
                <p className="text-sm font-bold text-gray-900">No matching game players found</p>
                <p className="text-xs text-gray-500">
                  Players registered in MANIFOLD CARS 3D will appear here with full operational controls.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                        <th className="py-3 px-4">Driver</th>
                        <th className="py-3 px-4">Private Contact (Admin)</th>
                        <th className="py-3 px-4">Vehicle</th>
                        <th className="py-3 px-4">Onboarding</th>
                        <th className="py-3 px-4">Account</th>
                        <th className="py-3 px-4">Chat Status</th>
                        <th className="py-3 px-4">Last Activity</th>
                        <th className="py-3 px-4 text-right">Manage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {directory.players.map((pl) => (
                        <tr key={pl.id} className="hover:bg-gray-50/75">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                  pl.is_online ? 'bg-emerald-500' : 'bg-gray-300'
                                }`}
                                title={pl.is_online ? 'Online' : 'Offline'}
                              />
                              <div>
                                <p className="font-black text-gray-900">{pl.nickname}</p>
                                <p className="text-[11px] text-gray-500">{pl.full_name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-gray-600">
                            <p className="font-medium text-gray-800">{pl.email}</p>
                            <p className="text-gray-500">{pl.phone_number}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            {pl.selected_vehicle ? (
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0"
                                  style={{ backgroundColor: pl.selected_vehicle_color || '#DC2626' }}
                                />
                                <div>
                                  <p className="font-bold text-gray-800">{pl.selected_vehicle}</p>
                                  <p className="text-[10px] text-gray-500">
                                    {pl.selected_interior || '—'} · {pl.selected_music_preference || '—'}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">Not configured</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                pl.onboarding_status === 'active'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : pl.onboarding_status === 'briefing_accepted'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {pl.onboarding_status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
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
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                pl.chat_status === 'permanently_restricted'
                                  ? 'bg-red-100 text-red-700'
                                  : pl.chat_status === 'temporarily_restricted'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {pl.chat_status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-gray-500 whitespace-nowrap">
                            {new Date(pl.last_activity_at).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => void handleOpenDetail(pl)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#071A2B] hover:bg-[#0d2842] text-white text-[11px] font-bold transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Bar */}
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between text-xs text-gray-600">
                  <span>
                    Showing <strong>{directory.players.length}</strong> of{' '}
                    <strong>{directory.totalCount}</strong> matching players (Page {directory.page} of{' '}
                    {totalPages})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* PLAYER DETAIL LOADING OVERLAY */}
      {detailLoading && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-xl flex items-center gap-3 text-xs font-bold text-gray-800">
            <Loader2 className="w-5 h-5 animate-spin text-[#EF233C]" />
            <span>Loading protected player telemetry...</span>
          </div>
        </div>
      )}

      {/* PLAYER DETAIL INSPECTOR & GOVERNANCE DRAWER */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-gray-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Drawer Header */}
            <div className="bg-[#071A2B] px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span
                  className={`w-3 h-3 rounded-full ${
                    selectedDetail.player.is_online ? 'bg-emerald-400' : 'bg-gray-400'
                  }`}
                />
                <div>
                  <h3 className="font-black text-base tracking-tight">
                    {selectedDetail.player.nickname}
                  </h3>
                  <p className="text-[11px] text-gray-300">
                    {selectedDetail.player.full_name} · Registered{' '}
                    {new Date(selectedDetail.player.registration_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* PII & Config Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2.5 text-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 block">
                    Identity &amp; Protected Contact (Admin Only)
                  </span>
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-2 text-gray-800">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <strong>{selectedDetail.player.full_name}</strong> ({selectedDetail.player.nickname})
                    </p>
                    <p className="flex items-center gap-2 text-gray-700">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      <span>{selectedDetail.player.email}</span>
                    </p>
                    <p className="flex items-center gap-2 text-gray-700">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      <span>{selectedDetail.player.phone_number}</span>
                    </p>
                    <p className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        Last activity: {new Date(selectedDetail.player.last_activity_at).toLocaleString()}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2.5 text-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 block">
                    Onboarding &amp; Vehicle Configuration
                  </span>
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-2 text-gray-800">
                      <Car className="w-3.5 h-3.5 text-gray-400" />
                      <strong>{selectedDetail.player.selected_vehicle || 'Unselected'}</strong>
                      {selectedDetail.player.selected_vehicle_color && (
                        <span
                          className="inline-block w-3 h-3 rounded-full border border-gray-300"
                          style={{ backgroundColor: selectedDetail.player.selected_vehicle_color }}
                        />
                      )}
                    </p>
                    <p className="text-gray-700">
                      Interior: <strong>{selectedDetail.player.selected_interior || '—'}</strong> · Music:{' '}
                      <strong>{selectedDetail.player.selected_music_preference || '—'}</strong>
                    </p>
                    <p className="text-gray-700">
                      Onboarding: <strong>{selectedDetail.player.onboarding_status}</strong> · Terms:{' '}
                      <strong>{selectedDetail.player.terms_accepted ? 'Accepted' : 'Pending'}</strong>
                    </p>
                    <p className="text-gray-600">
                      Region: <strong>{selectedDetail.player.world_region || 'Offline'}</strong> · Credits:{' '}
                      <strong>{selectedDetail.player.credits_balance}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Separated Status & Administrative Governance Actions */}
              <div className="p-4 rounded-2xl border border-gray-200 bg-white space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-black text-gray-900">Account Status:</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        selectedDetail.player.account_status === 'suspended'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {selectedDetail.player.account_status}
                    </span>

                    <span className="font-black text-gray-900 ml-2">Chat Status:</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        selectedDetail.player.chat_status === 'permanently_restricted'
                          ? 'bg-red-100 text-red-700'
                          : selectedDetail.player.chat_status === 'temporarily_restricted'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {selectedDetail.player.chat_status.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] text-gray-500 font-mono">
                      ({selectedDetail.player.chat_violation_count} violations)
                    </span>
                  </div>
                </div>

                {selectedDetail.player.suspended_reason && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <strong>Suspension Reason:</strong> {selectedDetail.player.suspended_reason}
                  </p>
                )}

                {selectedDetail.player.chat_restriction_reason && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <strong>Chat Restriction Reason:</strong> {selectedDetail.player.chat_restriction_reason}
                    {selectedDetail.player.chat_restricted_until &&
                      ` (Until ${new Date(selectedDetail.player.chat_restricted_until).toLocaleString()})`}
                  </p>
                )}

                {/* Action Buttons (All require Confirmation + Reason -> Immutable Audit Log) */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {selectedDetail.player.account_status === 'active' ? (
                    <button
                      type="button"
                      onClick={() =>
                        openActionConfirm({
                          playerId: selectedDetail.player.id,
                          nickname: selectedDetail.player.nickname,
                          action: 'suspend_account',
                          title: 'Suspend Game Account',
                          description: 'Player will be blocked from entering MANIFOLD CARS 3D and disconnected immediately.',
                          confirmTone: 'danger',
                        })
                      }
                      className="px-3.5 py-2 rounded-xl bg-[#EF233C] hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Suspend Account</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        openActionConfirm({
                          playerId: selectedDetail.player.id,
                          nickname: selectedDetail.player.nickname,
                          action: 'reactivate_account',
                          title: 'Reactivate Game Account',
                          description: 'Restores game world entry for this player.',
                          confirmTone: 'success',
                        })
                      }
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Reactivate Account</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
                    <select
                      value={tempRestrictMinutes}
                      onChange={(e) => setTempRestrictMinutes(Number(e.target.value))}
                      className="h-7 px-2 rounded-lg bg-white border border-gray-200 text-[11px] font-bold text-gray-800 outline-none"
                    >
                      <option value={15}>15 mins</option>
                      <option value={60}>1 hour</option>
                      <option value={1440}>24 hours</option>
                      <option value={10080}>7 days</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        openActionConfirm({
                          playerId: selectedDetail.player.id,
                          nickname: selectedDetail.player.nickname,
                          action: 'restrict_chat_temp',
                          restrictMinutes: tempRestrictMinutes,
                          title: `Temporarily Restrict Chat (${tempRestrictMinutes}m)`,
                          description: 'Restricts chat invitations & messaging only. Player can still drive.',
                          confirmTone: 'warning',
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Restrict Chat</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openActionConfirm({
                        playerId: selectedDetail.player.id,
                        nickname: selectedDetail.player.nickname,
                        action: 'restrict_chat_permanent',
                        title: 'Permanently Restrict Chat',
                        description: 'Permanently revokes in-game chat privileges while keeping driving account separate.',
                        confirmTone: 'danger',
                      })
                    }
                    className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquareOff className="w-3.5 h-3.5" />
                    <span>Perm Restrict Chat</span>
                  </button>

                  {selectedDetail.player.chat_status !== 'enabled' && (
                    <button
                      type="button"
                      onClick={() =>
                        openActionConfirm({
                          playerId: selectedDetail.player.id,
                          nickname: selectedDetail.player.nickname,
                          action: 'restore_chat',
                          title: 'Restore Chat Access',
                          description: 'Re-enables chat access and clears active restriction.',
                          confirmTone: 'success',
                        })
                      }
                      className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Restore Chat</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Moderation Incidents + Player Reports */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#EF233C]" />
                    <span className="text-xs font-black text-gray-900">
                      Moderation Incidents ({selectedDetail.incidents.length})
                    </span>
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 text-xs">
                    {selectedDetail.incidents.length === 0 ? (
                      <p className="p-4 text-gray-400 text-center">No moderation incidents recorded.</p>
                    ) : (
                      selectedDetail.incidents.map((inc) => (
                        <div key={inc.id} className="p-3 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-mono text-[10px] font-bold">
                              {inc.violation_category} ({inc.severity})
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(inc.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-gray-700 break-words">{inc.attempted_content}</p>
                          <p className="text-[10px] text-gray-500">Action: {inc.action_taken}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                    <Flag className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-black text-gray-900">
                      Reports Against Player ({selectedDetail.reports.length})
                    </span>
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 text-xs">
                    {selectedDetail.reports.length === 0 ? (
                      <p className="p-4 text-gray-400 text-center">No player reports filed.</p>
                    ) : (
                      selectedDetail.reports.map((rep) => (
                        <div key={rep.id} className="p-3 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-gray-900">{rep.reason}</span>
                            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-bold uppercase">
                              {rep.review_status}
                            </span>
                          </div>
                          {rep.description && <p className="text-gray-600">{rep.description}</p>}
                          <p className="text-[10px] text-gray-400">
                            By {rep.reporter_nickname} · {new Date(rep.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Immutable Admin Audit History */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <History className="w-4 h-4 text-[#071A2B]" />
                  <span className="text-xs font-black text-gray-900">
                    Immutable Administrative Audit Log ({selectedDetail.auditLogs.length})
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 text-xs">
                  {selectedDetail.auditLogs.length === 0 ? (
                    <p className="p-4 text-gray-400 text-center">No administrative actions recorded yet.</p>
                  ) : (
                    selectedDetail.auditLogs.map((al) => (
                      <div key={al.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="font-black text-gray-900 uppercase text-[11px]">{al.action.replace(/_/g, ' ')}</span>
                          <span className="text-gray-500 ml-2">by {al.admin_email}</span>
                          <p className="text-gray-700 mt-0.5">Reason: {al.reason}</p>
                        </div>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {new Date(al.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANDATORY CONFIRMATION + AUDIT REASON MODAL */}
      {pendingAction && (
        <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmAction}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-gray-900">{pendingAction.title}</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Target player: <strong>{pendingAction.nickname}</strong>. {pendingAction.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Mandatory Audit Reason <span className="text-[#EF233C]">*</span>
              </label>
              <textarea
                required
                minLength={3}
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Document specific policy/operational reason for immutable audit log..."
                className="w-full p-3 rounded-xl border border-gray-300 text-xs text-gray-900 outline-none focus:border-[#071A2B] resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={executingAction || actionReason.trim().length < 3}
                className={`px-4 py-2 rounded-xl text-white text-xs font-black uppercase flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                  pendingAction.confirmTone === 'danger'
                    ? 'bg-[#EF233C] hover:bg-red-700'
                    : pendingAction.confirmTone === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {executingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm &amp; Log Audit</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
