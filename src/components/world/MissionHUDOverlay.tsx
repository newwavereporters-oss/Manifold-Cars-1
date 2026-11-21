// MANIFOLD WORLD - MISSION HUD OVERLAY, CATEGORY FILTERS & RESULTS SYSTEM
import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  Award,
  Car,
  CheckCircle2,
  Clock,
  Compass,
  Flag,
  Loader2,
  MapPin,
  Package,
  ParkingCircle,
  Play,
  RefreshCw,
  ShieldAlert,
  Trophy,
  X,
} from 'lucide-react';
import {
  ActiveMissionSession,
  MissionDef,
  MissionDistanceTier,
  MissionId,
  MISSIONS_CATALOG,
  MISSIONS_CATALOG_LIST,
} from './missionEngine';
import { MissionProgressStat } from '../../services/missionService';
import { TransmissionGear } from './worldModels';

interface MissionHUDOverlayProps {
  session: ActiveMissionSession | null;
  missionOverrides?: Record<string, Partial<MissionDef>>;
  missionProgress?: Record<string, MissionProgressStat>;
  serverClockOffsetMs?: number;
  selectedGear?: TransmissionGear;
  onStartMission: () => void;
  onAbandonMission: () => void;
  onRetryCheckpointSync?: () => void;
  onRecoverPermanentCheckpoint?: () => void;
  onRetryCompletion?: () => void;
  onRetryFailureSync?: () => void;
  onRetryAbandonment?: () => void;
  onOpenMissionBriefing: (id: MissionId) => void;
  isMissionDrawerOpen: boolean;
  onCloseMissionDrawer: () => void;
  distToDestMeters?: number;
  activeTargetName?: string;
}

const TIER_TABS: { id: 'ALL' | MissionDistanceTier; label: string }[] = [
  { id: 'ALL', label: 'All Operations' },
  { id: 'NEAR', label: 'Near' },
  { id: 'FAR', label: 'Far' },
  { id: 'VERY_FAR', label: 'Very Far' },
];

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const MissionHUDOverlay: React.FC<MissionHUDOverlayProps> = ({
  session,
  missionOverrides,
  missionProgress = {},
  serverClockOffsetMs = 0,
  selectedGear = 'D2',
  onStartMission,
  onAbandonMission,
  onRetryCheckpointSync,
  onRecoverPermanentCheckpoint,
  onRetryCompletion,
  onRetryFailureSync,
  onRetryAbandonment,
  onOpenMissionBriefing,
  isMissionDrawerOpen,
  onCloseMissionDrawer,
  distToDestMeters = 0,
  activeTargetName,
}) => {
  const [selectedTier, setSelectedTier] = useState<'ALL' | MissionDistanceTier>('ALL');

  const resolvedCatalog = useMemo(() => {
    return MISSIONS_CATALOG_LIST.map((m) =>
      missionOverrides?.[m.id] ? { ...m, ...missionOverrides[m.id] } : m
    ).filter((m) => m.is_active !== false);
  }, [missionOverrides]);

  const filteredMissions = useMemo(() => {
    if (selectedTier === 'ALL') return resolvedCatalog;
    return resolvedCatalog.filter((m) => m.distanceCategory === selectedTier);
  }, [resolvedCatalog, selectedTier]);

  const getCooldownRemainingSec = (m: MissionDef): number => {
    const stat = missionProgress[m.id];
    if (!stat?.lastRewardClaimedAt || m.cooldownSec <= 0) return 0;
    const claimedMs = Date.parse(stat.lastRewardClaimedAt);
    if (Number.isNaN(claimedMs)) return 0;
    const unlockAtMs = claimedMs + m.cooldownSec * 1000;
    const nowMs = Date.now() + serverClockOffsetMs;
    return Math.max(0, Math.ceil((unlockAtMs - nowMs) / 1000));
  };

  // 1. Mission Selection Drawer
  if (isMissionDrawerOpen) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85"
        onClick={onCloseMissionDrawer}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          className="relative w-full max-w-4xl bg-[#071A2B] border border-white/20 rounded-3xl p-4 sm:p-6 shadow-2xl text-white max-h-[92dvh] sm:max-h-[88dvh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#EF233C]/20 text-[#EF233C] flex items-center justify-center shrink-0">
                <Flag className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black tracking-tight truncate">Mainland &amp; Cross-Lagos Missions</h3>
                <p className="text-xs text-slate-400 truncate">
                  12 routes across Near, Far, and Very Far corridors with Credits, XP, and Badges
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCloseMissionDrawer}
              className="min-w-[44px] min-h-[44px] rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
              aria-label="Close Mission Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Distance Category Filter Tabs */}
          <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1">
            {TIER_TABS.map((tab) => {
              const count =
                tab.id === 'ALL'
                  ? resolvedCatalog.length
                  : resolvedCatalog.filter((m) => m.distanceCategory === tab.id).length;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedTier(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                    selectedTier === tab.id
                      ? 'bg-[#EF233C] text-white'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Missions Grid */}
          <div className="mt-4 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3.5 pr-1">
            {filteredMissions.map((m) => {
              const stat = missionProgress[m.id];
              const cooldownSec = getCooldownRemainingSec(m);
              const isCooling = cooldownSec > 0;

              return (
                <div
                  key={m.id}
                  className="bg-white/5 border border-white/10 hover:border-white/25 p-4 rounded-2xl flex flex-col justify-between transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>
                        {m.distanceCategory.replace('_', ' ')} · {m.difficulty} ·{' '}
                        <span className="tabular-nums">{m.distanceMeters}m</span>
                      </span>
                      <span className="font-mono font-bold text-amber-300 tabular-nums shrink-0">
                        {m.baseRewardCredits.toLocaleString()} MC · +{m.reputationXP} XP
                      </span>
                    </div>

                    <h4 className="text-base font-black text-white mt-1">{m.title}</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{m.briefing}</p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      <span>
                        Route: {m.startLocationName} → {m.destinationName}
                      </span>
                      <span>· Limit {m.timeLimitSec}s</span>
                      {m.requireParkGear && <span className="text-cyan-300">· Requires Gear P</span>}
                      {m.requiresNoCollision && <span className="text-amber-300">· Zero Crash</span>}
                      {(stat?.completedCount ?? 0) > 0 && (
                        <span className="text-emerald-400">· Completed {stat.completedCount}×</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isCooling}
                    onClick={() => {
                      onCloseMissionDrawer();
                      onOpenMissionBriefing(m.id);
                    }}
                    className={`mt-4 w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                      isCooling
                        ? 'bg-white/10 text-slate-400 cursor-not-allowed'
                        : 'bg-[#EF233C] hover:bg-[#d90429] text-white'
                    }`}
                  >
                    {m.requireParkGear ? (
                      <ParkingCircle className="w-4 h-4" />
                    ) : m.category === 'DELIVERY' ? (
                      <Package className="w-4 h-4" />
                    ) : (
                      <Flag className="w-4 h-4" />
                    )}
                    <span>
                      {isCooling ? `Cooldown (${formatTimer(cooldownSec)})` : 'View Briefing'}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const baseDef = MISSIONS_CATALOG[session.missionId] || MISSIONS_CATALOG_LIST[0];
  const def = missionOverrides?.[session.missionId]
    ? { ...baseDef, ...missionOverrides[session.missionId] }
    : baseDef;

  // 2. Mission Briefing Modal (rewards shown here are strictly provisional until persisted by server)
  if (session.state === 'BRIEFING') {
    const cooldownSec = getCooldownRemainingSec(def);
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-[#071A2B] border border-white/20 rounded-3xl p-5 sm:p-6 shadow-2xl text-white">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
              {def.distanceCategory.replace('_', ' ')} · {def.category.replace('_', ' ')}
            </span>
            <button
              type="button"
              onClick={onAbandonMission}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 text-gray-400 cursor-pointer"
              aria-label="Close briefing"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-2xl font-black mb-1">{def.title}</h3>
          <p className="text-xs text-slate-400 mb-4 font-bold">{def.subTitle}</p>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 text-xs text-slate-300 leading-relaxed space-y-2">
            <p>{def.briefing}</p>
            <p className="text-slate-400">
              Start: <span className="text-white font-semibold">{def.startLocationName}</span> →
              Destination: <span className="text-emerald-300 font-semibold">{def.destinationName}</span>
            </p>
            {def.checkpoints.length > 0 && (
              <p className="text-cyan-300">
                Checkpoints: {def.checkpoints.map((c) => c.name).join(' → ')}
              </p>
            )}
            {def.requireParkGear && (
              <p className="text-amber-300 font-semibold">
                Special Requirement: Stop inside the destination zone and shift transmission into P (Park).
              </p>
            )}
            {def.requiresNoCollision && (
              <p className="text-red-300 font-semibold">
                Special Requirement: Zero heavy collisions allowed.
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5 mb-6">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Distance</span>
              <span className="text-sm font-black font-mono text-white tabular-nums">
                {def.distanceMeters}m
              </span>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Time Limit</span>
              <span className="text-sm font-black font-mono text-white tabular-nums">
                {def.timeLimitSec}s
              </span>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">
                Provisional Payout
              </span>
              <span className="text-sm font-black font-mono text-amber-400 tabular-nums">
                {session.provisionalRewardPreview.credits} MC
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onAbandonMission}
              className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-bold text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={cooldownSec > 0}
              onClick={onStartMission}
              className="flex-1 py-3 rounded-2xl bg-[#EF233C] hover:bg-[#d90429] disabled:bg-white/10 disabled:text-slate-400 text-xs font-black uppercase text-white shadow-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{cooldownSec > 0 ? `Wait ${cooldownSec}s` : 'Launch Mission'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Race 3-2-1 Countdown Overlay
  if (session.state === 'COUNTDOWN') {
    const countDisplay = Math.ceil(session.countdownVal);
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center">
          <span className="text-8xl sm:text-9xl font-black font-mono text-yellow-400 drop-shadow-[0_10px_25px_rgba(234,179,8,0.7)]">
            {countDisplay > 0 ? countDisplay : 'GO!'}
          </span>
          <span className="text-xl font-black tracking-widest text-white uppercase mt-2 drop-shadow-md">
            {def.title}
          </span>
        </div>
      </div>
    );
  }

  // 4. Server Submission Pending Screen (also handles checkpoint sync failure blocking final submission)
  if (session.state === 'VERIFYING') {
    const failedCp =
      session.pendingCheckpoint?.status === 'FAILED' ? session.pendingCheckpoint : null;
    const isPermanentCpFailure = failedCp?.failureType === 'PERMANENT';

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/88"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          className={`relative w-full max-w-md bg-[#071A2B] border rounded-3xl p-6 shadow-2xl text-white text-center space-y-4 ${
            isPermanentCpFailure
              ? 'border-red-500/50'
              : failedCp
              ? 'border-amber-500/50'
              : 'border-cyan-500/40'
          }`}
        >
          <div
            className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto border ${
              isPermanentCpFailure
                ? 'bg-red-500/20 border-red-500/40 text-red-300'
                : failedCp
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-cyan-500/15 border-cyan-500/35 text-cyan-300'
            }`}
          >
            {failedCp ? (
              <AlertOctagon className="w-8 h-8" />
            ) : (
              <Loader2 className="w-8 h-8 animate-spin" />
            )}
          </div>
          <h3 className="text-xl font-black tracking-tight">
            {isPermanentCpFailure
              ? 'CHECKPOINT REJECTED'
              : failedCp
              ? 'CHECKPOINT SYNC REQUIRED'
              : 'SUBMITTING RUN LOG'}
          </h3>
          <p className="text-xs text-slate-400 font-bold">{def.title}</p>
          {failedCp ? (
            <>
              <p
                className={`text-sm leading-relaxed ${
                  isPermanentCpFailure ? 'text-red-200' : 'text-amber-200'
                }`}
              >
                Checkpoint {failedCp.index + 1} ({failedCp.name}){' '}
                {isPermanentCpFailure
                  ? 'was rejected by the server:'
                  : 'could not be confirmed with the server:'}{' '}
                {failedCp.errorMessage ||
                  (isPermanentCpFailure
                    ? 'Coordinates or timing rejected.'
                    : 'Connection interrupted.')}
              </p>
              <p className="text-xs text-slate-400">
                {isPermanentCpFailure
                  ? 'Retrying identical coordinates is disabled. Re-drive cleanly through the checkpoint to capture fresh coordinates, or abandon the run.'
                  : `Server-acknowledged checkpoints: ${session.acknowledgedCheckpointIdx}/${session.totalCheckpointsRequired}. Completion cannot be submitted until every checkpoint is acknowledged.`}
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                {isPermanentCpFailure
                  ? onRecoverPermanentCheckpoint && (
                      <button
                        type="button"
                        onClick={onRecoverPermanentCheckpoint}
                        className="flex-1 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 font-black text-xs uppercase tracking-wider text-white flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Compass className="w-4 h-4" />
                        <span>Re-drive Checkpoint</span>
                      </button>
                    )
                  : onRetryCheckpointSync && (
                      <button
                        type="button"
                        onClick={onRetryCheckpointSync}
                        className="flex-1 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 font-black text-xs uppercase tracking-wider text-white flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Retry Checkpoint Sync</span>
                      </button>
                    )}
                <button
                  type="button"
                  onClick={onAbandonMission}
                  className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 font-bold text-xs uppercase tracking-wider text-slate-200 cursor-pointer"
                >
                  Abandon Run
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-300 leading-relaxed">
              {session.pendingCheckpoint
                ? `Confirming checkpoint ${session.pendingCheckpoint.index + 1} of ${session.totalCheckpointsRequired} before saving completion...`
                : 'Checking server run token, deadline, and accepted checkpoint reports before saving fixed participation rewards...'}
            </p>
          )}
        </div>
      </div>
    );
  }

  // 4b. Server Failure Persistence Pending / Failed Screens
  if (session.state === 'FAILING' || session.state === 'FAILURE_SYNC_FAILED') {
    const isSyncFailed = session.state === 'FAILURE_SYNC_FAILED';
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/88"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          className={`relative w-full max-w-md bg-[#071A2B] border rounded-3xl p-6 shadow-2xl text-white text-center space-y-4 ${
            isSyncFailed ? 'border-amber-500/50' : 'border-red-500/40'
          }`}
        >
          <div
            className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto border ${
              isSyncFailed
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-red-500/15 border-red-500/35 text-red-300'
            }`}
          >
            {isSyncFailed ? (
              <AlertOctagon className="w-8 h-8" />
            ) : (
              <Loader2 className="w-8 h-8 animate-spin" />
            )}
          </div>
          <h3 className="text-xl font-black tracking-tight">
            {isSyncFailed ? 'FAILURE REPORT NOT SAVED' : 'SAVING MISSION RESULT'}
          </h3>
          <p className="text-xs text-slate-400 font-bold">{def.title}</p>
          <p className="text-sm text-slate-300 leading-relaxed">
            {session.resultSummary?.message ||
              (isSyncFailed
                ? 'Could not reach the server to record your failed run. No rewards were credited.'
                : 'Recording failed mission outcome with the server...')}
          </p>
          {isSyncFailed && (
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              {onRetryFailureSync && (
                <button
                  type="button"
                  onClick={onRetryFailureSync}
                  className="flex-1 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 font-black text-xs uppercase tracking-wider text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Failure Sync</span>
                </button>
              )}
              <button
                type="button"
                onClick={onAbandonMission}
                className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 font-bold text-xs uppercase tracking-wider text-slate-200 cursor-pointer"
              >
                Abandon Run
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4c. Server Abandonment Pending / Failed Screens
  if (session.state === 'ABANDONING' || session.state === 'ABANDON_FAILED') {
    const isAbandonFailed = session.state === 'ABANDON_FAILED';
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/88"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          className={`relative w-full max-w-md bg-[#071A2B] border rounded-3xl p-6 shadow-2xl text-white text-center space-y-4 ${
            isAbandonFailed ? 'border-amber-500/50' : 'border-white/25'
          }`}
        >
          <div
            className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto border ${
              isAbandonFailed
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-white/10 border-white/20 text-slate-200'
            }`}
          >
            {isAbandonFailed ? (
              <AlertOctagon className="w-8 h-8" />
            ) : (
              <Loader2 className="w-8 h-8 animate-spin" />
            )}
          </div>
          <h3 className="text-xl font-black tracking-tight">
            {isAbandonFailed ? 'ABANDONMENT NOT CONFIRMED' : 'ABANDONING MISSION'}
          </h3>
          <p className="text-xs text-slate-400 font-bold">{def.title}</p>
          <p className="text-sm text-slate-300 leading-relaxed">
            {session.resultSummary?.message ||
              (isAbandonFailed
                ? 'Server confirmation failed. Your active mission session cannot be discarded silently without server confirmation.'
                : 'Confirming mission abandonment with the server...')}
          </p>
          {isAbandonFailed && onRetryAbandonment && (
            <button
              type="button"
              onClick={onRetryAbandonment}
              className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 font-black text-xs uppercase tracking-wider text-white flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Abandonment</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 5. Mission Result Screen (Completed, Failed, or Submission Unavailable)
  if (
    session.state === 'COMPLETED' ||
    session.state === 'FAILED' ||
    session.state === 'VERIFICATION_FAILED'
  ) {
    const isSuccess = session.state === 'COMPLETED' && Boolean(session.resultSummary?.persisted);
    const isUnpersisted = session.state === 'VERIFICATION_FAILED';
    const sum = session.resultSummary;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-3 pt-14 pb-36 sm:pb-24 bg-black/70"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          className={`relative w-full max-w-md max-h-[60dvh] overflow-y-auto bg-[#071A2B] border rounded-3xl p-5 sm:p-6 shadow-2xl text-white ${
            isSuccess
              ? 'border-emerald-500/50'
              : isUnpersisted
              ? 'border-amber-500/50'
              : 'border-red-500/50'
          }`}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 ${
                isSuccess
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : isUnpersisted
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-red-500/20 text-red-400 border border-red-500/40'
              }`}
            >
              {isSuccess ? <Trophy className="w-8 h-8" /> : <AlertOctagon className="w-8 h-8" />}
            </div>

            <h3 className="text-2xl font-black tracking-tight mb-1">
              {isSuccess
                ? 'OBJECTIVE COMPLETE'
                : isUnpersisted
                ? 'RUN SUBMISSION FAILED'
                : 'MISSION FAILED'}
            </h3>
            <p className="text-xs text-slate-400 font-bold mb-3">{def.title}</p>

            <p className="text-sm text-slate-300 leading-relaxed mb-4 px-2">
              {sum?.message ||
                (isSuccess
                  ? 'Run accepted and fixed participation rewards saved.'
                  : isUnpersisted
                  ? 'Could not reach the server to record your run. No rewards were credited.'
                  : 'No rewards were earned. Try another run.')}
            </p>

            {isSuccess && (
              <div className="w-full space-y-3 mb-6">
                <div className="flex items-center justify-center gap-5 bg-white/5 border border-white/10 px-6 py-3 rounded-2xl">
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Credits Saved
                    </span>
                    <span className="text-xl font-black font-mono text-amber-400 tabular-nums">
                      +{sum?.creditsEarned} MC
                    </span>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Reputation
                    </span>
                    <span className="text-xl font-black font-mono text-emerald-400 tabular-nums">
                      +{sum?.xpEarned} XP
                    </span>
                  </div>
                </div>
                {sum?.rewardBadge && (
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-300">
                    <Award className="w-4 h-4" />
                    <span>Badge Unlocked: {sum.rewardBadge}</span>
                  </div>
                )}
                <p className="text-[10px] text-slate-400 leading-snug px-2">
                  Run token, server deadline &amp; checkpoint reports accepted · Driving physics,
                  gear &amp; collisions simulated client-side.
                </p>
              </div>
            )}

            {isUnpersisted ? (
              <div className="w-full flex flex-col sm:flex-row gap-2.5">
                {onRetryCompletion && (
                  <button
                    type="button"
                    onClick={onRetryCompletion}
                    className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-wider text-white bg-amber-600 hover:bg-amber-500 shadow-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Retry Submission</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onAbandonMission}
                  className="flex-1 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider text-slate-200 bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                >
                  Abandon Run
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onAbandonMission}
                className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider text-white shadow-xl transition-colors cursor-pointer ${
                  isSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {isSuccess ? 'Continue' : 'Return to Free Drive'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 6. Active In-Game Mission HUD Bar (compact widget below billboard on mobile/desktop)
  const totalWaypoints = def.checkpoints.length + 1;
  const currentWaypointNum = Math.min(totalWaypoints, session.currentCheckpointIdx + 1);
  const pendingCp = session.pendingCheckpoint;

  return (
    <div
      className="fixed top-[126px] right-2.5 [@media(max-height:480px)]:top-[102px] lg:top-auto lg:right-auto lg:bottom-6 lg:left-1/2 lg:-translate-x-1/2 z-30 pointer-events-auto flex flex-col items-end lg:items-center gap-1.5 select-none max-w-[calc(100vw-8.5rem)] lg:max-w-[94vw]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 sm:gap-3 bg-[#071A2B]/96 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl border border-white/20 shadow-2xl w-full">
        <div className="flex items-center gap-2 pr-2.5 border-r border-white/15 min-w-0">
          {def.category === 'DELIVERY' ? (
            <Package className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : def.requireParkGear ? (
            <ParkingCircle className="w-4 h-4 text-cyan-300 shrink-0" />
          ) : def.requiresNoCollision ? (
            <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0" />
          ) : (
            <Compass className="w-4 h-4 text-[#EF233C] shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-[10px] font-black text-white truncate max-w-[140px] sm:max-w-[200px]">
              {def.title}
            </div>
            <div className="text-[9px] text-slate-400 truncate max-w-[140px] sm:max-w-[200px]">
              {def.category === 'STREET_RACE'
                ? `P${session.playerRaceRank}/4 · CP ${session.currentRaceCheckpointIdx}/${session.totalRaceCheckpoints} (Synced ${session.acknowledgedCheckpointIdx})`
                : session.insideDestAwaitingPark && def.requireParkGear
                ? selectedGear === 'P'
                  ? 'Parking verified...'
                  : 'Shift to P (Park) gear!'
                : `${activeTargetName || def.destinationName} (${currentWaypointNum}/${totalWaypoints})`}
            </div>
          </div>
        </div>

        {def.category === 'DELIVERY' && (
          <div className="hidden sm:flex items-center gap-2 pr-2.5 border-r border-white/15">
            <Car className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-mono font-black text-emerald-300 tabular-nums">
              {session.cargoIntegrityPercent}%
            </span>
          </div>
        )}

        {distToDestMeters > 0 && def.category !== 'STREET_RACE' && (
          <div className="flex items-center gap-1 pr-2.5 border-r border-white/15 text-[11px] font-mono text-cyan-300 tabular-nums">
            <MapPin className="w-3 h-3 shrink-0" />
            <span>{Math.round(distToDestMeters)}m</span>
          </div>
        )}

        <div className="flex items-center gap-1 font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span
            className={`text-xs sm:text-sm font-black tabular-nums ${
              session.timeRemainingSec < 20 ? 'text-red-400' : 'text-white'
            }`}
          >
            {formatTimer(session.timeRemainingSec)}
          </span>
        </div>

        <button
          type="button"
          onClick={onAbandonMission}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
          title="Abandon Mission"
          aria-label="Abandon Mission"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Server Checkpoint Acknowledgement Status Indicator */}
      {pendingCp ? (
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-[10px] font-bold shadow-lg ${
            pendingCp.status === 'FAILED'
              ? pendingCp.failureType === 'PERMANENT'
                ? 'bg-red-950/95 border-red-500/60 text-red-200'
                : 'bg-amber-950/95 border-amber-500/60 text-amber-200'
              : 'bg-[#071A2B]/95 border-cyan-500/40 text-cyan-200'
          }`}
        >
          {pendingCp.status === 'FAILED' ? (
            pendingCp.failureType === 'PERMANENT' ? (
              <>
                <AlertOctagon className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="truncate max-w-[165px]">
                  CP {pendingCp.index + 1} rejected
                </span>
                {onRecoverPermanentCheckpoint && (
                  <button
                    type="button"
                    onClick={onRecoverPermanentCheckpoint}
                    className="px-2 py-0.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Compass className="w-2.5 h-2.5" />
                    <span>Re-drive</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <AlertOctagon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate max-w-[190px]">
                  CP {pendingCp.index + 1} sync failed
                </span>
                {onRetryCheckpointSync && (
                  <button
                    type="button"
                    onClick={onRetryCheckpointSync}
                    className="px-2 py-0.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Retry</span>
                  </button>
                )}
              </>
            )
          ) : (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-cyan-300 shrink-0" />
              <span>
                Syncing CP {pendingCp.index + 1}/{session.totalCheckpointsRequired}...
              </span>
            </>
          )}
        </div>
      ) : session.totalCheckpointsRequired > 0 && session.acknowledgedCheckpointIdx > 0 ? (
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#071A2B]/90 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>
            Checkpoints synced: {session.acknowledgedCheckpointIdx}/
            {session.totalCheckpointsRequired}
          </span>
        </div>
      ) : null}
    </div>
  );
};
