import React from 'react';
import {
  Power,
  Volume2,
  VolumeX,
  Radio,
  Eye,
  Sliders,
  AlertTriangle,
  Lightbulb,
  ArrowLeft,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { VehicleSpecProfile } from './worldModels';
import { AudioDriveMode } from '../../utils/engineAudio';

export type HeadlightState = 'OFF' | 'LOW' | 'HIGH';
export type TurnSignalState = 'OFF' | 'LEFT' | 'RIGHT';
export type CockpitHotspot = 'DRIVER' | 'DASHBOARD' | 'CONSOLE' | 'WINDSHIELD';

interface CockpitDashboardOverlayProps {
  speedKmh: number;
  rpm: number;
  gear: string;
  spec: VehicleSpecProfile;
  isEngineRunning: boolean;
  onToggleEngine: () => void;
  headlightState: HeadlightState;
  onCycleHeadlights: () => void;
  turnSignal: TurnSignalState;
  onToggleTurnSignal: (signal: 'LEFT' | 'RIGHT') => void;
  hazardLights: boolean;
  onToggleHazard: () => void;
  hornActive: boolean;
  onHornDown: () => void;
  onHornUp: () => void;
  driveMode: AudioDriveMode;
  onSelectDriveMode: (mode: AudioDriveMode) => void;
  radioStation: number;
  onSelectRadioStation: (st: number) => void;
  radioVolume: number;
  onRadioVolumeChange: (vol: number) => void;
  cockpitHotspot: CockpitHotspot;
  onSelectHotspot: (spot: CockpitHotspot) => void;
}

const RADIO_STATION_NAMES: Record<number, string> = {
  0: 'Radio Off (Acoustic)',
  1: 'Manifold FM • Synthwave Midnight',
  2: 'Apex Lounge • Cyber Lo-Fi',
  3: 'Turbine Beats • Apex Adrenaline',
};

export const CockpitDashboardOverlay: React.FC<CockpitDashboardOverlayProps> = ({
  speedKmh,
  rpm,
  gear,
  spec,
  isEngineRunning,
  onToggleEngine,
  headlightState,
  onCycleHeadlights,
  turnSignal,
  onToggleTurnSignal,
  hazardLights,
  onToggleHazard,
  hornActive,
  onHornDown,
  onHornUp,
  driveMode,
  onSelectDriveMode,
  radioStation,
  onSelectRadioStation,
  radioVolume,
  onRadioVolumeChange,
  cockpitHotspot,
  onSelectHotspot,
}) => {
  // Speedometer needle angle calculation (-120 deg to +120 deg)
  const maxDisplaySpeed = 280;
  const speedRatio = Math.min(speedKmh / maxDisplaySpeed, 1);
  const speedNeedleDeg = -120 + speedRatio * 240;

  // Tachometer needle angle calculation (-120 deg to +120 deg)
  const rpmRatio = Math.min((rpm - 600) / (spec.redlineRpm - 600), 1);
  const rpmNeedleDeg = -120 + Math.max(0, rpmRatio) * 240;
  const isRedline = rpm > spec.redlineRpm * 0.88;

  const isBlinkerLeftActive = (turnSignal === 'LEFT' || hazardLights) && (Math.floor(Date.now() / 450) % 2 === 0);
  const isBlinkerRightActive = (turnSignal === 'RIGHT' || hazardLights) && (Math.floor(Date.now() / 450) % 2 === 0);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-5 select-none z-30">
      {/* Top Banner: Cockpit Status & Drive Mode Selection */}
      <div className="flex items-start justify-between gap-3 pointer-events-auto">
        {/* Drive Mode Selector Switch */}
        <div className="bg-[#071A2B]/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1 flex items-center gap-1">
            <Sliders className="w-3 h-3 text-[#EF233C]" />
            <span className="hidden sm:inline">Drive Mode:</span>
          </span>
          {(['COMFORT', 'SPORT', 'TRACK', 'ECO', 'DRIFT'] as AudioDriveMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onSelectDriveMode(mode)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                driveMode === mode
                  ? mode === 'TRACK'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                    : mode === 'DRIFT'
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                    : mode === 'ECO'
                    ? 'bg-emerald-500 text-black'
                    : 'bg-[#EF233C] text-white shadow-lg'
                  : 'text-gray-400 hover:text-white bg-white/5'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Cockpit Inspection Hotspots */}
        <div className="bg-[#071A2B]/90 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-1">
          <Eye className="w-3.5 h-3.5 text-blue-400 mr-1 hidden sm:inline" />
          {(
            [
              { id: 'DRIVER', label: 'Driver' },
              { id: 'DASHBOARD', label: 'Cluster' },
              { id: 'CONSOLE', label: 'Console' },
              { id: 'WINDSHIELD', label: 'Road' },
            ] as const
          ).map((spot) => (
            <button
              key={spot.id}
              onClick={() => onSelectHotspot(spot.id)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                cockpitHotspot === spot.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {spot.label}
            </button>
          ))}
        </div>
      </div>

      {/* Center Left Floating Cockpit Controls: Ignition, Lights, Horn, Hazards */}
      <div className="self-start my-auto flex flex-col gap-2.5 pointer-events-auto">
        {/* Engine Start / Stop Button */}
        <button
          onClick={onToggleEngine}
          className={`group flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border transition-all shadow-2xl ${
            isEngineRunning
              ? 'bg-gradient-to-r from-red-600/90 to-red-700/90 border-red-500 text-white shadow-red-500/30'
              : 'bg-slate-900/90 border-white/20 text-gray-400 hover:border-red-500 hover:text-white animate-pulse'
          }`}
          title="Toggle Ignition Start / Stop"
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
              isEngineRunning ? 'bg-white/20 text-white' : 'bg-red-500/20 text-red-400'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
          </div>
          <div className="text-left">
            <span className="block text-[9px] font-extrabold uppercase tracking-widest text-white/70">
              Engine
            </span>
            <span className="block text-xs font-black uppercase tracking-wider text-white">
              {isEngineRunning ? 'RUNNING' : 'START [E]'}
            </span>
          </div>
        </button>

        {/* Headlights Selector (Off / Low / High) */}
        <button
          onClick={onCycleHeadlights}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl border transition-all bg-[#071A2B]/85 backdrop-blur-md shadow-lg ${
            headlightState === 'HIGH'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : headlightState === 'LOW'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
              : 'border-white/10 text-gray-400 hover:text-white'
          }`}
          title="Toggle Headlights: Off / Low Beam / High Beam"
        >
          <Lightbulb
            className={`w-4 h-4 ${
              headlightState === 'HIGH'
                ? 'text-blue-400'
                : headlightState === 'LOW'
                ? 'text-emerald-400'
                : 'text-gray-400'
            }`}
          />
          <div className="text-left">
            <span className="block text-[8px] font-bold uppercase text-gray-400">Headlights</span>
            <span className="block text-[10px] font-extrabold uppercase">
              {headlightState === 'HIGH' ? 'HIGH BEAM' : headlightState === 'LOW' ? 'LOW BEAM' : 'OFF'}
            </span>
          </div>
        </button>

        {/* Hazard Lights Button */}
        <button
          onClick={onToggleHazard}
          className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all bg-[#071A2B]/85 backdrop-blur-md shadow-lg ${
            hazardLights
              ? 'border-red-500 text-red-400 bg-red-500/20 animate-pulse'
              : 'border-white/10 text-gray-400 hover:text-white'
          }`}
          title="Toggle Emergency Hazard Flasher"
        >
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-[10px] font-bold uppercase">Hazards</span>
        </button>

        {/* Automotive Dual-Tone Horn Button */}
        <button
          onMouseDown={onHornDown}
          onMouseUp={onHornUp}
          onTouchStart={onHornDown}
          onTouchEnd={onHornUp}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border transition-all bg-[#071A2B]/85 backdrop-blur-md shadow-lg ${
            hornActive
              ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300 scale-95'
              : 'border-white/10 text-gray-300 hover:text-white'
          }`}
          title="Press & Hold for Dual-Tone Horn [H]"
        >
          <Volume2 className="w-4 h-4 text-yellow-400" />
          <span className="text-xs font-black uppercase tracking-wider">HORN [H]</span>
        </button>
      </div>

      {/* Center Bottom: Precision Analog & Digital Instrument Cluster Overlay */}
      <div className="self-center flex flex-col items-center pointer-events-auto max-w-full">
        {/* Turn Signal Arrows Bar */}
        <div className="flex items-center justify-between w-64 px-4 py-1 mb-1.5 bg-[#071A2B]/80 backdrop-blur-md rounded-full border border-white/10 text-xs">
          <button
            onClick={() => onToggleTurnSignal('LEFT')}
            className={`p-1 rounded-full transition-all ${
              isBlinkerLeftActive
                ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)] scale-125'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Left Turn Signal [Q]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                headlightState !== 'OFF' ? 'bg-blue-400 shadow-[0_0_6px_#60a5fa]' : 'bg-gray-700'
              }`}
              title="Headlights On Indicator"
            />
            <span
              className={`w-2 h-2 rounded-full ${
                !isEngineRunning ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : 'bg-gray-700'
              }`}
              title="Engine Check Indicator"
            />
            <span
              className={`w-2 h-2 rounded-full ${
                driveMode === 'TRACK' ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]' : 'bg-gray-700'
              }`}
              title="Track Mode Active"
            />
          </div>

          <button
            onClick={() => onToggleTurnSignal('RIGHT')}
            className={`p-1 rounded-full transition-all ${
              isBlinkerRightActive
                ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)] scale-125'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Right Turn Signal [E]"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Gauges Frame */}
        <div className="bg-[#071A2B]/95 backdrop-blur-2xl border border-white/15 px-6 py-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center gap-6 sm:gap-8">
          {/* 1. ANALOG TACHOMETER (RPM) GAUGE */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
            {/* Outer Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-white/15 bg-slate-900/80 shadow-inner" />

            {/* Redline Arc Indicator */}
            <div className="absolute inset-2 rounded-full border-t-2 border-r-2 border-red-500/50" />

            {/* RPM Needle */}
            <div
              className="absolute w-full h-full flex items-center justify-center transition-transform duration-75"
              style={{ transform: `rotate(${rpmNeedleDeg}deg)` }}
            >
              <div className="w-1 h-12 bg-gradient-to-t from-red-500 to-red-400 rounded-t -translate-y-5 shadow-[0_0_8px_rgba(239,35,60,0.8)]" />
            </div>

            {/* Center Dial Hub */}
            <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-white/20 z-10 flex items-center justify-center shadow-md">
              <div className="w-2 h-2 rounded-full bg-red-500" />
            </div>

            {/* RPM Readout in Dial */}
            <div className="absolute bottom-2.5 flex flex-col items-center">
              <span
                className={`text-xs font-mono font-black tabular-nums ${
                  isRedline ? 'text-red-400 animate-pulse' : 'text-gray-200'
                }`}
              >
                {rpm}
              </span>
              <span className="text-[7px] text-gray-400 uppercase font-bold tracking-widest">
                RPM ×1000
              </span>
            </div>
          </div>

          {/* 2. CENTER TRANSMISSION CLUSTER & GEAR */}
          <div className="flex flex-col items-center justify-center min-w-[70px]">
            <span className="text-[9px] text-gray-400 uppercase font-extrabold tracking-widest">
              GEAR
            </span>
            <div className="my-1 w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
              <span className="text-3xl sm:text-4xl font-black font-mono text-[#EF233C] drop-shadow-[0_0_12px_rgba(239,35,60,0.6)]">
                {gear}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[9px] font-mono text-gray-400 mt-1">
              <Zap className="w-2.5 h-2.5 text-amber-400" />
              <span>{spec.horsepower} BHP</span>
            </div>
          </div>

          {/* 3. ANALOG SPEEDOMETER (KM/H) GAUGE */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
            {/* Outer Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-white/15 bg-slate-900/80 shadow-inner" />

            {/* Speed Needle */}
            <div
              className="absolute w-full h-full flex items-center justify-center transition-transform duration-75"
              style={{ transform: `rotate(${speedNeedleDeg}deg)` }}
            >
              <div className="w-1 h-12 bg-gradient-to-t from-white to-blue-400 rounded-t -translate-y-5 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            </div>

            {/* Center Dial Hub */}
            <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-white/20 z-10 flex items-center justify-center shadow-md">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
            </div>

            {/* Digital Speed Value */}
            <div className="absolute bottom-2.5 flex flex-col items-center">
              <span className="text-base sm:text-lg font-mono font-black text-white tabular-nums tracking-tight">
                {speedKmh}
              </span>
              <span className="text-[7px] text-gray-400 uppercase font-bold tracking-widest">
                KM/H
              </span>
            </div>
          </div>
        </div>

        {/* Infotainment Audio Station Pill */}
        <div className="mt-2 bg-[#071A2B]/85 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-3 text-xs shadow-lg">
          <div className="flex items-center gap-1.5 text-gray-300">
            <Radio className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-bold text-white max-w-[180px] sm:max-w-[240px] truncate">
              {RADIO_STATION_NAMES[radioStation] || 'Radio'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {[0, 1, 2, 3].map((st) => (
              <button
                key={st}
                onClick={() => onSelectRadioStation(st)}
                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${
                  radioStation === st ? 'bg-blue-500 text-white shadow' : 'bg-white/5 text-gray-400'
                }`}
              >
                {st === 0 ? 'Off' : `CH ${st}`}
              </button>
            ))}
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={radioVolume}
            onChange={(e) => onRadioVolumeChange(parseFloat(e.target.value))}
            className="w-16 h-1 accent-blue-400 bg-white/20 rounded-lg cursor-pointer hidden sm:block"
            title="Cockpit Infotainment Volume"
          />
        </div>
      </div>
    </div>
  );
};
