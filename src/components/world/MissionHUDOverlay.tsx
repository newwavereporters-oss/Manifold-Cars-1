// MANIFOLD WORLD - MISSION HUD OVERLAY, CATEGORY FILTERS & RESULTS SYSTEM
import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  Award,
  Car,
  Clock,
  Compass,
  Flag,
  MapPin,
  Package,
  ParkingCircle,
  Play,
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
    ).filter((m) => (m as any).is_active !== false);
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
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md"
        onClick={onCloseMissionDrawer}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          className="relative w-full max-w-4xl bg-[#071A2B] border border-white/20 rounded-3xl p-4 sm:p-6 shadow-2xl text-white max-h-[88vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#EF233C]/20 text-[#EF233C] flex items-center justify-center">
                <Flag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">Mainland & Cross-Lagos Missions</h3>
                <p className="text-xs text-slate-400">
                  12 routes across Near, Far, and Very Far corridors with Credits, XP, and Badges
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCloseMissionDrawer}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center"
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

  // 2. Mission Briefing Modal
  if (session.state === 'BRIEFING') {
    const cooldownSec = getCooldownRemainingSec(def);
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="relative w-full max-w-lg bg-[#071A2B] border border-white/20 rounded-3xl p-6 shadow-2xl text-white">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
              {def.distanceCategory.replace('_', ' ')} · {def.category.replace('_', ' ')}
            </span>
            <button
              type="button"
              onClick={onAbandonMission}
              className="p-1.5 rounded-xl hover:bg-white/10 text-gray-400"
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
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Payout</span>
              <span className="text-sm font-black font-mono text-amber-400 tabular-nums">
                {def.baseRewardCredits} MC
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

  // 4. Mission Result Screen (Completed or Failed)
  if (session.state === 'COMPLETED' || session.state === 'FAILED') {
    const isSuccess = session.state === 'COMPLETED';
    const sum = session.resultSummary;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          className={`relative w-full max-w-md bg-[#071A2B] border rounded-3xl p-6 shadow-2xl text-white ${
            isSuccess ? 'border-emerald-500/50' : 'border-red-500/50'
          }`}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 ${
                isSuccess
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-red-500/20 text-red-400 border border-red-500/40'
              }`}
            >
              {isSuccess ? <Trophy className="w-8 h-8" /> : <AlertOctagon className="w-8 h-8" />}
            </div>

            <h3 className="text-2xl font-black tracking-tight mb-1">
              {isSuccess ? 'OBJECTIVE COMPLETE' : 'MISSION FAILED'}
            </h3>
            <p className="text-xs text-slate-400 font-bold mb-3">{def.title}</p>

            <p className="text-sm text-slate-300 leading-relaxed mb-5 px-2">
              {sum?.message || (isSuccess ? 'Well done, driver!' : 'Try another run.')}
            </p>

            {isSuccess && (
              <div className="w-full space-y-3 mb-6">
                <div className="flex items-center justify-center gap-5 bg-white/5 border border-white/10 px-6 py-3 rounded-2xl">
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Credits
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
              </div>
            )}

            <button
              type="button"
              onClick={onAbandonMission}
              className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider text-white shadow-xl transition-colors ${
                isSuccess ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
              }`}
            >
              {isSuccess ? 'Claim & Continue' : 'Return to Free Drive'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Active In-Game Mission HUD Bar (compact pill positioned cleanly below billboard on mobile/desktop)
  const totalWaypoints = def.checkpoints.length + 1;
  const currentWaypointNum = Math.min(totalWaypoints, session.currentCheckpointIdx + 1);

  return (
    <div
      className="fixed bottom-[120px] sm:bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-2.5 sm:gap-3 bg-[#071A2B]/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/20 shadow-2xl select-none max-w-[94vw]"
      onPointerDown={(e) => e.stopPropagation()}
    >
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
              ? `P${session.playerRaceRank}/4 · CP ${session.currentRaceCheckpointIdx}/${session.totalRaceCheckpoints}`
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
        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors shrink-0"
        title="Abandon Mission"
        aria-label="Abandon Mission"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
