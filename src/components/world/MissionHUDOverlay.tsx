// MANIFOLD WORLD - MISSION HUD OVERLAY & RESULTS SYSTEM
// Renders active mission objectives, delivery cargo health, race 3-2-1 countdown,
// race standings leaderboard, briefing modals, and victory/defeat reward screens.

import React from 'react';
import {
  Package,
  Flag,
  Clock,
  ShieldAlert,
  Trophy,
  AlertOctagon,
  CheckCircle2,
  X,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  ActiveMissionSession,
  MISSIONS_CATALOG,
  MissionId,
} from './missionEngine';

interface MissionHUDOverlayProps {
  session: ActiveMissionSession | null;
  onStartMission: () => void;
  onAbandonMission: () => void;
  onOpenMissionBriefing: (id: MissionId) => void;
  isMissionDrawerOpen: boolean;
  onCloseMissionDrawer: () => void;
  distToDestMeters?: number;
}

export const MissionHUDOverlay: React.FC<MissionHUDOverlayProps> = ({
  session,
  onStartMission,
  onAbandonMission,
  onOpenMissionBriefing,
  isMissionDrawerOpen,
  onCloseMissionDrawer,
  distToDestMeters = 0,
}) => {
  // 1. Mission Selection Drawer (When opened from HUD)
  if (isMissionDrawerOpen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-2xl bg-[#071A2B] border border-white/20 rounded-3xl p-6 shadow-2xl text-white">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#EF233C]/20 text-[#EF233C] flex items-center justify-center">
                <Flag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider">Mainland Mission Operations</h3>
                <p className="text-xs text-gray-400">Select an active Lagos Mainland driving objective</p>
              </div>
            </div>
            <button
              onClick={onCloseMissionDrawer}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mission A Card */}
            <div className="bg-white/5 border border-white/10 hover:border-emerald-500/50 p-4 rounded-2xl flex flex-col justify-between transition-all group">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    LOGISTICS FREIGHT
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400">500 MC</span>
                </div>
                <h4 className="text-base font-black text-white group-hover:text-emerald-400 transition-colors">
                  {MISSIONS_CATALOG.MISSION_A_DELIVERY.title}
                </h4>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  {MISSIONS_CATALOG.MISSION_A_DELIVERY.briefing}
                </p>
              </div>

              <button
                onClick={() => {
                  onCloseMissionDrawer();
                  onOpenMissionBriefing('MISSION_A_DELIVERY');
                }}
                className="mt-4 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-black text-xs uppercase tracking-wider text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
              >
                <Package className="w-4 h-4" />
                <span>View Mission Briefing</span>
              </button>
            </div>

            {/* Mission B Card */}
            <div className="bg-white/5 border border-white/10 hover:border-[#EF233C]/50 p-4 rounded-2xl flex flex-col justify-between transition-all group">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-lg bg-[#EF233C]/20 text-[#EF233C] border border-[#EF233C]/30">
                    STREET CIRCUIT RACE
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400">1,000 MC</span>
                </div>
                <h4 className="text-base font-black text-white group-hover:text-[#EF233C] transition-colors">
                  {MISSIONS_CATALOG.MISSION_B_RACE.title}
                </h4>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  {MISSIONS_CATALOG.MISSION_B_RACE.briefing}
                </p>
              </div>

              <button
                onClick={() => {
                  onCloseMissionDrawer();
                  onOpenMissionBriefing('MISSION_B_RACE');
                }}
                className="mt-4 w-full py-2.5 rounded-xl bg-[#EF233C] hover:bg-[#d90429] font-black text-xs uppercase tracking-wider text-white flex items-center justify-center gap-2 shadow-lg shadow-[#EF233C]/30 transition-all"
              >
                <Flag className="w-4 h-4" />
                <span>View Mission Briefing</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const def = MISSIONS_CATALOG[session.missionId];

  // 2. Mission Briefing Modal
  if (session.state === 'BRIEFING') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in zoom-in-95 duration-200">
        <div className="relative w-full max-w-lg bg-[#071A2B] border border-white/20 rounded-3xl p-6 shadow-2xl text-white">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <span className="text-xs font-mono font-black text-[#EF233C] uppercase tracking-wider">
              {def.category} OPERATION
            </span>
            <button onClick={onAbandonMission} className="p-1.5 rounded-xl hover:bg-white/10 text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-2xl font-black mb-1">{def.title}</h3>
          <p className="text-xs text-gray-400 mb-4 font-bold">{def.subTitle}</p>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 text-xs text-gray-300 leading-relaxed">
            {def.briefing}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Time Limit</span>
              <span className="text-base font-black font-mono text-white">{def.timeLimitSec}s</span>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Reward</span>
              <span className="text-base font-black font-mono text-amber-400">{def.baseRewardCredits} MC</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onAbandonMission}
              className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-bold text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onStartMission}
              className="flex-1 py-3 rounded-2xl bg-[#EF233C] hover:bg-[#d90429] text-xs font-black uppercase text-white shadow-xl shadow-[#EF233C]/30 flex items-center justify-center gap-2 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Launch Mission</span>
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
        <div className="flex flex-col items-center animate-in zoom-in-75 duration-300">
          <span className="text-8xl sm:text-9xl font-black font-mono text-yellow-400 drop-shadow-[0_10px_25px_rgba(234,179,8,0.7)]">
            {countDisplay > 0 ? countDisplay : 'GO!'}
          </span>
          <span className="text-xl font-black tracking-widest text-white uppercase mt-2 drop-shadow-md">
            MAINLAND GRAND PRIX
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in zoom-in-95 duration-200">
        <div
          className={`relative w-full max-w-md bg-[#071A2B] border rounded-3xl p-6 shadow-2xl text-white ${
            isSuccess ? 'border-emerald-500/50' : 'border-red-500/50'
          }`}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 ${
                isSuccess
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-lg shadow-red-500/30'
              }`}
            >
              {isSuccess ? <Trophy className="w-8 h-8" /> : <AlertOctagon className="w-8 h-8" />}
            </div>

            <h3 className="text-2xl font-black tracking-tight mb-1">
              {isSuccess ? 'OBJECTIVE COMPLETE!' : 'MISSION FAILED'}
            </h3>
            <p className="text-xs text-gray-400 font-bold mb-4">{def.title}</p>

            <p className="text-sm text-gray-300 leading-relaxed mb-6 px-4">
              {sum?.message || (isSuccess ? 'Well done, driver!' : 'Better luck next time.')}
            </p>

            {isSuccess && (
              <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-3 rounded-2xl mb-6">
                <div className="text-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Reward</span>
                  <span className="text-xl font-black font-mono text-amber-400">+{sum?.creditsEarned} MC</span>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Reputation</span>
                  <span className="text-xl font-black font-mono text-emerald-400">+{sum?.xpEarned} XP</span>
                </div>
              </div>
            )}

            <button
              onClick={onAbandonMission}
              className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider text-white shadow-xl transition-all ${
                isSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                  : 'bg-red-600 hover:bg-red-500 shadow-red-600/30'
              }`}
            >
              {isSuccess ? 'Claim & Continue' : 'Return to Free Drive'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Active In-Game Mission HUD Bar (Top Center)
  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-3 bg-[#071A2B]/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 shadow-2xl select-none">
      {/* Objective Title */}
      <div className="flex items-center gap-2 pr-3 border-r border-white/15">
        {session.missionId === 'MISSION_A_DELIVERY' ? (
          <Package className="w-4 h-4 text-emerald-400" />
        ) : (
          <Flag className="w-4 h-4 text-[#EF233C]" />
        )}
        <div className="flex flex-col">
          <span className="text-[9px] uppercase font-bold text-gray-400 leading-none">ACTIVE OBJECTIVE</span>
          <span className="text-xs font-black text-white">{def.title}</span>
        </div>
      </div>

      {/* Delivery Cargo Health OR Race Standings */}
      {session.missionId === 'MISSION_A_DELIVERY' ? (
        <div className="flex items-center gap-2 pr-3 border-r border-white/15">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-gray-400 leading-none">CARGO INTEGRITY</span>
            <span
              className={`text-xs font-black font-mono ${
                session.cargoIntegrityPercent > 60
                  ? 'text-emerald-400'
                  : session.cargoIntegrityPercent > 30
                  ? 'text-amber-400'
                  : 'text-red-500 animate-pulse'
              }`}
            >
              {session.cargoIntegrityPercent}%
            </span>
          </div>
          <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                session.cargoIntegrityPercent > 60
                  ? 'bg-emerald-500'
                  : session.cargoIntegrityPercent > 30
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${session.cargoIntegrityPercent}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 pr-3 border-r border-white/15">
          {/* Race Standing */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold text-gray-400 leading-none">POSITION</span>
            <span
              className={`text-sm font-black font-mono ${
                session.playerRaceRank === 1
                  ? 'text-yellow-400'
                  : session.playerRaceRank === 2
                  ? 'text-gray-300'
                  : 'text-amber-500'
              }`}
            >
              {session.playerRaceRank}
              <span className="text-[9px]">{session.playerRaceRank === 1 ? 'ST' : session.playerRaceRank === 2 ? 'ND' : session.playerRaceRank === 3 ? 'RD' : 'TH'}</span> / 4
            </span>
          </div>

          {/* Checkpoint Progress */}
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-gray-400 leading-none">CHECKPOINT</span>
            <span className="text-xs font-black font-mono text-white">
              {session.currentRaceCheckpointIdx} / {session.totalRaceCheckpoints}
            </span>
          </div>
        </div>
      )}

      {/* Timer Remaining */}
      <div className="flex items-center gap-1.5 font-mono">
        <Clock className="w-3.5 h-3.5 text-gray-400" />
        <span
          className={`text-sm font-black tabular-nums ${
            session.timeRemainingSec < 20 ? 'text-red-400 animate-pulse' : 'text-white'
          }`}
        >
          {Math.floor(session.timeRemainingSec / 60)}:
          {Math.floor(session.timeRemainingSec % 60)
            .toString()
            .padStart(2, '0')}
        </span>
      </div>

      {/* Abandon Button */}
      <button
        onClick={onAbandonMission}
        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white transition-colors"
        title="Abandon Mission"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
