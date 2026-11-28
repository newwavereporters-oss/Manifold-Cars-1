import React, { useState, useMemo } from 'react';
import {
  Volume2,
  VolumeX,
  Camera,
  Sun,
  Moon,
  Sunset,
  Palette,
  HelpCircle,
  ShoppingBag,
  Navigation,
  Compass,
  Coins,
  Sliders,
  Power,
  Smartphone,
  Map as MapIcon,
  Flag,
  RotateCcw,
  Route,
  X,
  Menu,
  User,
  Lock,
  Unlock,
  Users,
  Ban,
  LogOut,
  Building2,
  Lightbulb,
  AlertTriangle,
  Radio,
  ArrowLeft,
  ArrowRight,
  Music,
} from 'lucide-react';
import { CameraViewMode, TimeOfDay } from './WorldCanvas';
import {
  VehicleModelType,
  VEHICLE_SPEC_PROFILES,
  HeadlightState,
  TurnSignalState,
  TransmissionGear,
  TRANSMISSION_GEAR_ORDER,
  TRANSMISSION_GEAR_PROFILES,
} from './worldModels';
import { engineAudio, AudioDriveMode } from '../../utils/engineAudio';
import { MobileTouchControls, VirtualDrivingInput } from './MobileTouchControls';
import { GameBillboardOverlay } from './GameBillboardOverlay';
import { GameBillboardItem } from '../../services/billboardService';
import {
  LAGOS_ROAD_NODES,
  findShortestRoadPathDetailed,
} from './lagosCityData';
import type { CoastalRaceState } from './rivalsEngine';
import type { WebGLQualityMode } from '../../utils/webglPerformance';

const RADIO_STATION_NAMES: Record<number, string> = {
  0: 'Acoustic (Off)',
  1: 'Afrobeats FM',
  2: 'Hip-Hop Street',
  3: 'R&B Midnight',
  4: 'Gospel Praise',
  5: 'Chill Lounge',
  6: 'Electronic House',
};

interface WorldHUDProps {
  speedKmh: number;
  rpm: number;
  gear: string;
  activeZone: string | null;
  cameraMode: CameraViewMode;
  onCameraChange: (mode: CameraViewMode) => void;
  timeOfDay: TimeOfDay;
  onTimeOfDayChange: (time: TimeOfDay) => void;
  selectedVehicleType: VehicleModelType;
  onSelectVehicleType: (type: VehicleModelType) => void;
  onOpenCustomizer: () => void;
  onEnterMarketplace: () => void;
  onInspectCar?: (carId: string) => void;
  onOpenDealerLounge?: () => void;
  carPosition?: { x: number; z: number; heading: number };
  speedTrapRecord: number | null;
  onVirtualInput?: (input: VirtualDrivingInput) => void;
  virtualInputState?: VirtualDrivingInput;
  playerCredits: number;
  creditNotification: { amount: number; reason: string } | null;
  isEngineRunning: boolean;
  onToggleEngine: () => void;
  driveMode: AudioDriveMode;
  onSelectDriveMode: (mode: AudioDriveMode) => void;
  selectedGear: TransmissionGear;
  onSelectGear: (gear: TransmissionGear) => void;
  headlightState: HeadlightState;
  onCycleHeadlights: () => void;
  turnSignal: TurnSignalState;
  onToggleTurnSignal: (signal: 'LEFT' | 'RIGHT') => void;
  hazardLights: boolean;
  onToggleHazard: () => void;
  hornActive: boolean;
  onHornDown: () => void;
  onHornUp: () => void;
  radioStation: number;
  onSelectRadioStation: (st: number) => void;
  radioVolume: number;
  onRadioVolumeChange: (vol: number) => void;
  onOpenCityMap?: () => void;
  onOpenMissions?: () => void;
  onOpenMusicLibrary?: () => void;
  isMusicPlaying?: boolean;
  onResetVehicle?: () => void;
  activeDestination?: { x: number; z: number; name: string } | null;
  onClearDestination?: () => void;
  billboardItems?: GameBillboardItem[];
  onOpenBillboardListing?: (slug: string) => void;
  playerNickname?: string;
  nearbyPlayersCount?: number;
  lockStatus?: {
    isLocked: boolean;
    hhmmss: string;
    unlockFormatted: string;
  };
  onOpenNearbyDrivers?: () => void;
  onOpenVehicleConfig?: () => void;
  onOpenBlockedDrivers?: () => void;
  onOpenShowroomSample?: () => void;
  onLogout?: () => void;
  qualityMode?: WebGLQualityMode;
  onQualityModeChange?: (mode: WebGLQualityMode) => void;
  coastalRaceState?: CoastalRaceState | null;
  onStartCoastalRace?: () => void;
  onExitCoastalRace?: () => void;
  drivingDisabled?: boolean;
  onOverlayOpenChange?: (open: boolean) => void;
}

export const WorldHUD: React.FC<WorldHUDProps> = ({
  speedKmh,
  rpm,
  gear,
  activeZone,
  cameraMode,
  onCameraChange,
  timeOfDay,
  onTimeOfDayChange,
  selectedVehicleType,
  onOpenCustomizer,
  onEnterMarketplace,
  onInspectCar,
  onOpenDealerLounge,
  carPosition = { x: 0, z: 10, heading: Math.PI },
  speedTrapRecord,
  onVirtualInput,
  virtualInputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
  },
  playerCredits,
  creditNotification,
  isEngineRunning,
  onToggleEngine,
  driveMode,
  onSelectDriveMode,
  selectedGear,
  onSelectGear,
  headlightState,
  onCycleHeadlights,
  turnSignal,
  onToggleTurnSignal,
  hazardLights,
  onToggleHazard,
  hornActive,
  onHornDown,
  onHornUp,
  radioStation,
  onSelectRadioStation,
  radioVolume,
  onRadioVolumeChange,
  onOpenCityMap,
  onOpenMissions,
  onOpenMusicLibrary,
  isMusicPlaying = false,
  onResetVehicle,
  activeDestination,
  onClearDestination,
  billboardItems = [],
  onOpenBillboardListing,
  playerNickname = 'DRIVER',
  nearbyPlayersCount = 0,
  lockStatus,
  onOpenNearbyDrivers,
  onOpenVehicleConfig,
  onOpenBlockedDrivers,
  onOpenShowroomSample,
  onLogout,
  qualityMode = 'AUTO',
  onQualityModeChange,
  coastalRaceState = null,
  onStartCoastalRace,
  onExitCoastalRace,
  drivingDisabled = false,
  onOverlayOpenChange,
}) => {
  const [isMuted, setIsMuted] = useState(() => engineAudio.getMuted());
  const [masterVolume, setMasterVolume] = useState(() =>
    Math.round(engineAudio.getMasterVolume() * 100)
  );
  const [showControlsHelp, setShowControlsHelp] = useState(false);
  const [showGameMenu, setShowGameMenu] = useState(false);

  React.useEffect(() => {
    onOverlayOpenChange?.(showGameMenu || showControlsHelp);
  }, [showGameMenu, showControlsHelp, onOverlayOpenChange]);

  const [touchControlsEnabled, setTouchControlsEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        window.innerWidth < 1024 ||
        'ontouchstart' in window ||
        (navigator.maxTouchPoints || 0) > 0
      );
    }
    return false;
  });

  const currentProfile =
    VEHICLE_SPEC_PROFILES[selectedVehicleType] || VEHICLE_SPEC_PROFILES.SPORTS_COUPE;

  const toggleSound = () => {
    engineAudio.init();
    const muted = engineAudio.toggleMute();
    setIsMuted(muted);
  };

  const handleMasterVolumeChange = (pct: number) => {
    engineAudio.init();
    setMasterVolume(pct);
    engineAudio.setMasterVolume(pct / 100);
    if (pct > 0 && isMuted) {
      setIsMuted(engineAudio.setMuted(false));
    }
  };

  const cameraOptions: { mode: CameraViewMode; label: string }[] = [
    { mode: 'CHASE', label: 'Chase' },
    { mode: 'DRONE', label: 'Drone' },
  ];

  const driveModes: AudioDriveMode[] = ['ECO', 'COMFORT', 'SPORT', 'TRACK', 'DRIFT'];

  // Live shortest-path GPS route & turn-by-turn guidance
  const gpsRouteInfo = useMemo(() => {
    if (!activeDestination) return null;
    return findShortestRoadPathDetailed(carPosition, activeDestination);
  }, [Math.round(carPosition.x / 3), Math.round(carPosition.z / 3), activeDestination]);

  const nearestAreaLabel = useMemo(() => {
    let bestName = 'Lagos Island';
    let bestDist = Infinity;
    for (const node of Object.values(LAGOS_ROAD_NODES)) {
      const d = Math.hypot(node.x - carPosition.x, node.z - carPosition.z);
      if (d < bestDist) {
        bestDist = d;
        bestName = node.district || node.name || 'Lagos';
      }
    }
    return bestName;
  }, [Math.round(carPosition.x / 10), Math.round(carPosition.z / 10)]);

  const formatDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between pt-[max(0.45rem,env(safe-area-inset-top))] px-[max(0.6rem,env(safe-area-inset-left))] pr-[max(0.6rem,env(safe-area-inset-right))] pb-2.5 sm:p-5 select-none z-20">
      {/* 1. MINIMAL TOP CORNER MENU BUTTON + COLLAPSIBLE GAME DRAWER */}
      <div className="flex flex-col gap-1.5 sm:gap-2 w-full">
        <header className="flex items-center justify-between w-full pointer-events-auto gap-2">
          <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowGameMenu((p) => !p)}
              className="min-h-[40px] flex items-center gap-2 bg-[#071A2B]/96 hover:bg-[#0b233a] px-3 py-1.5 rounded-xl border border-white/15 shadow-lg text-xs font-black uppercase tracking-wider text-white transition-colors cursor-pointer whitespace-nowrap"
              aria-expanded={showGameMenu}
              aria-label="Open Game Menu"
            >
              {showGameMenu ? (
                <X className="w-4 h-4 text-[#EF233C]" />
              ) : (
                <Menu className="w-4 h-4 text-[#EF233C]" />
              )}
              <span>Menu</span>
              <span className="text-[10px] font-mono font-bold text-slate-300 border-l border-white/15 pl-2 tabular-nums">
                {speedKmh} KM/H · {selectedGear}
              </span>
              {nearbyPlayersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-400 text-slate-950 text-[9px] font-black leading-tight">
                  {nearbyPlayersCount}
                </span>
              )}
            </button>

            {showGameMenu && (
              <div className="absolute top-full left-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-110px)] overflow-y-auto bg-[#071A2B]/98 border border-white/15 rounded-2xl shadow-2xl p-3 z-50 space-y-3 text-xs">
                {/* Driver Profile, Credits & Live Telemetry */}
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="font-black text-white truncate">{playerNickname}</span>
                    </div>
                    <span className="text-[10px] font-mono font-black text-amber-400 flex items-center gap-1 shrink-0">
                      <Coins className="w-3 h-3" />
                      {playerCredits.toLocaleString()} MC
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-300 font-mono">
                    <span className="truncate">{currentProfile.name}</span>
                    <span className="shrink-0">
                      {speedKmh} KM/H · {rpm} RPM · {gear}
                    </span>
                  </div>
                  <div className="text-[10px] text-sky-300 font-semibold">
                    Area: {nearestAreaLabel}
                  </div>
                  {onOpenVehicleConfig && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGameMenu(false);
                        onOpenVehicleConfig();
                      }}
                      className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center justify-between px-2.5 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        {lockStatus?.isLocked ? (
                          <Lock className="w-3 h-3 text-amber-400" />
                        ) : (
                          <Unlock className="w-3 h-3 text-emerald-400" />
                        )}
                        <span>{lockStatus?.isLocked ? 'View Vehicle Lock' : 'Reconfigure Vehicle'}</span>
                      </span>
                      <span className="font-mono text-[10px] text-amber-300">
                        {lockStatus?.isLocked ? lockStatus.hhmmss : 'Unlocked'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Transmission Gear & Drive Mode */}
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1.5">
                      Transmission Gear [1–5]
                    </span>
                    <div className="grid grid-cols-5 gap-1">
                      {TRANSMISSION_GEAR_ORDER.map((g) => {
                        const prof = TRANSMISSION_GEAR_PROFILES[g];
                        const active = selectedGear === g;
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => onSelectGear(g)}
                            title={`${prof.label} — ${prof.shortDesc}`}
                            className={`py-1.5 rounded-lg text-[10px] font-black font-mono transition-colors cursor-pointer ${
                              active
                                ? g === 'D1'
                                  ? 'bg-[#EF233C] text-white'
                                  : g === 'P'
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-sky-500 text-slate-950'
                                : 'bg-white/8 text-gray-300 hover:bg-white/15'
                            }`}
                          >
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1.5">
                      Driving Mode
                    </span>
                    <div className="grid grid-cols-5 gap-1">
                      {driveModes.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => onSelectDriveMode(m)}
                          className={`py-1.5 rounded-lg text-[9px] font-black uppercase transition-colors cursor-pointer ${
                            driveMode === m
                              ? 'bg-[#EF233C] text-white'
                              : 'bg-white/8 text-gray-300 hover:bg-white/15'
                          }`}
                        >
                          {m === 'COMFORT' ? 'CMFT' : m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Vehicle Systems (Engine, Lights, Indicators, Horn) */}
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-gray-300">
                    <span className="flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-[#EF233C]" />
                      <span>Vehicle Systems</span>
                    </span>
                    <span className="font-mono text-gray-400">{currentProfile.horsepower} HP</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        engineAudio.init();
                        onToggleEngine();
                      }}
                      className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 text-[10px] font-black uppercase transition-colors cursor-pointer ${
                        isEngineRunning
                          ? 'bg-red-600/90 border-red-400 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{isEngineRunning ? 'Engine' : 'Off'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onCycleHeadlights}
                      className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 text-[10px] font-black uppercase transition-colors cursor-pointer ${
                        headlightState === 'HIGH'
                          ? 'bg-blue-600 border-blue-400 text-white'
                          : headlightState === 'LOW'
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400'
                      }`}
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>{headlightState}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onToggleHazard}
                      className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 text-[10px] font-black uppercase transition-colors cursor-pointer ${
                        hazardLights
                          ? 'bg-amber-500 border-amber-300 text-slate-950'
                          : 'bg-white/5 border-white/10 text-gray-400'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Hazard</span>
                    </button>

                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        engineAudio.init();
                        onHornDown();
                      }}
                      onPointerUp={onHornUp}
                      onPointerCancel={onHornUp}
                      onPointerLeave={onHornUp}
                      className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 text-[10px] font-black uppercase transition-colors cursor-pointer ${
                        hornActive
                          ? 'bg-yellow-400 border-yellow-200 text-slate-950'
                          : 'bg-white/5 border-white/10 text-yellow-400'
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Horn</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[10px] font-bold uppercase text-gray-400">Indicators</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleTurnSignal('LEFT')}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 cursor-pointer ${
                          turnSignal === 'LEFT'
                            ? 'bg-amber-500 text-slate-950 border-amber-300'
                            : 'bg-white/5 border-white/10 text-gray-300'
                        }`}
                      >
                        <ArrowLeft className="w-3 h-3" />L
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleTurnSignal('RIGHT')}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 cursor-pointer ${
                          turnSignal === 'RIGHT'
                            ? 'bg-amber-500 text-slate-950 border-amber-300'
                            : 'bg-white/5 border-white/10 text-gray-300'
                        }`}
                      >
                        R<ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Audio & FM Radio */}
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold text-gray-300">
                    <button
                      type="button"
                      onClick={toggleSound}
                      className="flex items-center gap-1.5 text-white hover:text-emerald-300 cursor-pointer"
                    >
                      {isMuted ? (
                        <VolumeX className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>{isMuted ? 'Audio Muted (Tap to Unmute)' : 'Master Audio'}</span>
                    </button>
                    <span className="font-mono">{isMuted ? '0%' : `${masterVolume}%`}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={isMuted ? 0 : masterVolume}
                    onChange={(e) => handleMasterVolumeChange(Number(e.target.value))}
                    className="w-full accent-[#EF233C] h-1.5 bg-white/15 rounded-lg cursor-pointer"
                  />

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[10px] font-bold text-gray-300 flex items-center gap-1 shrink-0">
                      <Radio className="w-3 h-3 text-emerald-400" />
                      <span>Radio</span>
                    </span>
                    <select
                      value={radioStation}
                      onChange={(e) => {
                        engineAudio.init();
                        onSelectRadioStation(Number(e.target.value));
                      }}
                      className="flex-1 h-7 px-2 rounded-lg bg-white/10 border border-white/15 text-[10px] font-bold text-white outline-none"
                    >
                      {Object.entries(RADIO_STATION_NAMES).map(([id, name]) => (
                        <option key={id} value={id} className="bg-[#071A2B] text-white">
                          {name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(radioVolume * 100)}
                      onChange={(e) => onRadioVolumeChange(Number(e.target.value) / 100)}
                      className="w-14 accent-emerald-400 h-1 bg-white/15 rounded-lg cursor-pointer"
                      title="Radio Volume"
                    />
                  </div>
                </div>

                {/* World Actions: Map, Missions, Music, Tuning, Drivers */}
                <div className="space-y-1">
                  {onOpenCityMap && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGameMenu(false);
                        onOpenCityMap();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-white hover:bg-white/10 font-bold cursor-pointer"
                    >
                      <MapIcon className="w-3.5 h-3.5 text-sky-400" />
                      <span>Lagos City GPS Map [M]</span>
                    </button>
                  )}

                  {onStartCoastalRace && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGameMenu(false);
                        onStartCoastalRace();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left bg-[#EF233C]/18 hover:bg-[#EF233C]/30 border border-[#EF233C]/35 text-white font-black cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Flag className="w-3.5 h-3.5 text-[#EF233C]" />
                        <span>Coastal Highway Race</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase">
                        VI -&gt; Epe
                      </span>
                    </button>
                  )}

                  {onOpenMissions && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGameMenu(false);
                        onOpenMissions();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-white hover:bg-white/10 font-bold cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5 text-amber-400" />
                      <span>Missions &amp; Street Races</span>
                    </button>
                  )}

                  {onOpenMusicLibrary && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGameMenu(false);
                        onOpenMusicLibrary();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-white hover:bg-white/10 font-bold cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Music className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Music Library</span>
                      </span>
                      {isMusicPlaying && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-black uppercase">
                          Playing
                        </span>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowGameMenu(false);
                      onOpenCustomizer();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-white hover:bg-white/10 font-bold cursor-pointer"
                  >
                    <Palette className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tuning &amp; Upgrades [C]</span>
                  </button>

                  {onOpenNearbyDrivers && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGameMenu(false);
                        onOpenNearbyDrivers();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-white hover:bg-white/10 font-bold cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Nearby Drivers</span>
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {nearbyPlayersCount} online
                      </span>
                    </button>
                  )}

                  {onOpenBlockedDrivers && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGameMenu(false);
                        onOpenBlockedDrivers();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-gray-200 hover:bg-white/10 font-bold cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5 text-red-400" />
                      <span>Blocked Drivers</span>
                    </button>
                  )}
                </div>

                {/* Camera, Time, Touch Pedals, Quality & Reset */}
                <div className="border-t border-white/10 pt-2 space-y-2">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-blue-400" />
                      <span>Camera</span>
                    </span>
                    <div className="flex items-center gap-1">
                      {cameraOptions.map((opt) => (
                        <button
                          key={opt.mode}
                          type="button"
                          onClick={() => onCameraChange(opt.mode)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer ${
                            cameraMode === opt.mode
                              ? 'bg-white text-slate-950'
                              : 'bg-white/10 text-gray-300 hover:bg-white/20'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="px-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-400">
                      Time of Day
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onTimeOfDayChange('DAYLIGHT')}
                        className={`p-1 rounded-lg cursor-pointer ${
                          timeOfDay === 'DAYLIGHT'
                            ? 'bg-amber-400 text-black'
                            : 'text-gray-400 hover:text-white'
                        }`}
                        title="Daylight"
                      >
                        <Sun className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onTimeOfDayChange('SUNSET')}
                        className={`p-1 rounded-lg cursor-pointer ${
                          timeOfDay === 'SUNSET'
                            ? 'bg-orange-500 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                        title="Sunset"
                      >
                        <Sunset className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onTimeOfDayChange('MIDNIGHT')}
                        className={`p-1 rounded-lg cursor-pointer ${
                          timeOfDay === 'MIDNIGHT'
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                        title="Midnight"
                      >
                        <Moon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setTouchControlsEnabled((p) => !p)}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left text-white hover:bg-white/10 font-bold cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>On-Screen Gas &amp; Brake Pedals</span>
                    </span>
                    <span className="text-[10px] font-mono text-gray-300">
                      {touchControlsEnabled ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {onQualityModeChange && (
                    <div className="px-1 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">
                        3D Graphics Quality
                      </span>
                      <div className="grid grid-cols-4 gap-1">
                        {(
                          [
                            { id: 'AUTO', label: 'Auto' },
                            { id: 'HIGH', label: 'High' },
                            { id: 'BALANCED', label: 'Bal' },
                            { id: 'PERFORMANCE', label: 'Smooth' },
                          ] as { id: WebGLQualityMode; label: string }[]
                        ).map((q) => (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => onQualityModeChange(q.id)}
                            className={`py-1 rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer ${
                              qualityMode === q.id
                                ? 'bg-[#EF233C] text-white'
                                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                            }`}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {onResetVehicle && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGameMenu(false);
                        onResetVehicle();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-white hover:bg-white/10 font-bold cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-gray-300" />
                      <span>Reset Vehicle [R]</span>
                    </button>
                  )}
                </div>

                {/* Portals, Marketplace, Guide & Sign Out */}
                <div className="border-t border-white/10 pt-2 space-y-1">
                  {onOpenShowroomSample && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGameMenu(false);
                        onOpenShowroomSample();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-gray-200 hover:bg-white/10 font-semibold cursor-pointer"
                    >
                      <Compass className="w-3.5 h-3.5 text-blue-400" />
                      <span>Showroom Pavilion</span>
                    </button>
                  )}
                  {onOpenDealerLounge && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGameMenu(false);
                        onOpenDealerLounge();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-gray-200 hover:bg-white/10 font-semibold cursor-pointer"
                    >
                      <Building2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>VIP Dealer Lounge</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowGameMenu(false);
                      onEnterMarketplace();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-[#EF233C] hover:bg-white/10 font-black cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>MANIFOLD Marketplace</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGameMenu(false);
                      setShowControlsHelp(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-gray-300 hover:bg-white/10 font-semibold cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Driving &amp; Community Guide</span>
                  </button>
                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGameMenu(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-red-300 hover:bg-red-500/15 font-black cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out of Game</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {coastalRaceState && coastalRaceState.phase === 'ACTIVE' && (
            <div
              className="pointer-events-auto flex items-center gap-3 bg-[#071A2B]/96 px-3.5 py-2 rounded-xl border border-[#EF233C]/45 shadow-xl text-xs"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 font-mono">
                <span className="px-2 py-0.5 rounded-md bg-[#EF233C] text-white font-black">
                  P{coastalRaceState.rank}/{coastalRaceState.totalRacers}
                </span>
                <span className="text-sky-300 font-bold">
                  CP {coastalRaceState.checkpointIdx}/{coastalRaceState.totalCheckpoints}
                </span>
                <span className="hidden sm:inline text-emerald-300 font-bold">
                  {formatDist(coastalRaceState.distanceRemainingMeters)} to Epe
                </span>
                <span className="text-gray-300 tabular-nums">
                  {coastalRaceState.elapsedSec.toFixed(1)}s
                </span>
              </div>
              {onExitCoastalRace && (
                <button
                  type="button"
                  onClick={onExitCoastalRace}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-red-500/30 text-[10px] font-black uppercase text-gray-200 hover:text-white cursor-pointer"
                >
                  Exit
                </button>
              )}
            </div>
          )}
        </header>

        {/* SUSPENDED DEALER ADVERTISING BILLBOARD */}
        <GameBillboardOverlay
          items={billboardItems}
          onOpenListing={(slug) => onOpenBillboardListing?.(slug)}
          onBrowseMarketplace={onEnterMarketplace}
          hidden={showGameMenu || showControlsHelp}
        />

        {cameraMode === 'DRONE' && (
          <div className="hidden sm:flex self-center items-center gap-2 bg-[#071A2B]/92 px-3 py-1 rounded-xl border border-sky-400/30 text-[10px] font-bold text-sky-200 pointer-events-none">
            <span>DRONE VIEW — Drag anywhere to orbit · Scroll to zoom</span>
          </div>
        )}
      </div>

      {/* 2. CONTROLS GUIDE MODAL OVERLAY */}
      {showControlsHelp && (
        <div className="pointer-events-auto self-center max-w-lg w-full max-h-[84dvh] overflow-y-auto bg-[#071A2B]/98 border border-white/15 p-5 sm:p-6 rounded-3xl shadow-2xl my-auto z-50">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-[#EF233C]" />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                MANIFOLD Driving &amp; Camera Guide
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowControlsHelp(false)}
              className="min-h-[40px] px-3 text-gray-300 hover:text-white text-xs font-bold cursor-pointer rounded-xl hover:bg-white/10"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 mt-4 text-xs">
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-[#EF233C] block mb-0.5">W / ↑ / GAS</span>
              <span className="text-gray-300 text-[11px]">Throttle &amp; Dynamic Acceleration</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-[#EF233C] block mb-0.5">S / ↓ / BRAKE</span>
              <span className="text-gray-300 text-[11px]">Braking &amp; Reverse Gear</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-[#EF233C] block mb-0.5">A / D · ← / → · Wheel</span>
              <span className="text-gray-300 text-[11px]">Drag Wheel or Press Keys · Hub / H = Horn</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-amber-400 block mb-0.5">Spacebar</span>
              <span className="text-gray-300 text-[11px]">Handbrake Drift</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-sky-400 block mb-0.5">1–5 Keys: Transmission</span>
              <span className="text-gray-300 text-[11px]">
                P (Park), D0 (Slow), D2 (Moderate), D1 (Fastest), R (Reverse)
              </span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-emerald-400 block mb-0.5">R / C / M / E</span>
              <span className="text-gray-300 text-[11px]">Reset, Tuning, GPS Map, Interact</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. CENTER NOTIFICATION & LIVE GPS GUIDANCE BANNERS */}
      <div className="self-center flex flex-col items-center gap-2 max-w-md w-full px-2">
        {activeDestination && gpsRouteInfo && (
          <div className="pointer-events-auto bg-[#071A2B]/96 border border-emerald-500/50 px-3.5 py-2 rounded-2xl shadow-2xl flex items-center gap-3 w-full">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Navigation className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                <span className="truncate">{activeDestination.name}</span>
                <span>•</span>
                <span className="font-mono shrink-0">{formatDist(gpsRouteInfo.totalMeters)}</span>
              </div>
              <div className="text-xs font-bold text-white flex items-center gap-1 truncate">
                <Route className="w-3 h-3 text-amber-300 shrink-0" />
                <span className="truncate">{gpsRouteInfo.nextTurnText}</span>
              </div>
            </div>
            {onClearDestination && (
              <button
                type="button"
                onClick={onClearDestination}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/30 text-gray-300 hover:text-white transition-colors shrink-0"
                title="Clear GPS Route"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {speedTrapRecord && (
          <div className="bg-[#10b981] border border-emerald-300 px-5 py-2 rounded-2xl shadow-2xl">
            <p className="text-xs font-extrabold uppercase tracking-widest text-black flex items-center gap-2">
              <span>⚡ SPEED TRAP:</span>
              <span className="text-base font-black font-mono tabular-nums">
                {speedTrapRecord} KM/H
              </span>
            </p>
          </div>
        )}

        {creditNotification && (
          <div className="bg-amber-400 text-black px-4 py-1.5 rounded-2xl shadow-2xl border border-amber-300 flex items-center gap-2 text-xs font-black">
            <Coins className="w-4 h-4 text-black" />
            <span>+{creditNotification.amount} MC:</span>
            <span className="font-semibold">{creditNotification.reason}</span>
          </div>
        )}

        {activeZone && !coastalRaceState && (
          <div className="pointer-events-auto bg-[#071A2B]/96 border border-[#EF233C] px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 w-full">
            <div className="w-8 h-8 rounded-xl bg-[#EF233C]/20 border border-[#EF233C]/40 flex items-center justify-center text-[#EF233C] font-black text-xs shrink-0">
              E
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white uppercase tracking-wider truncate">
                {activeZone === 'marketplace'
                  ? 'Grand Marketplace Gateway'
                  : activeZone === 'customizer'
                  ? 'Custom Tuning Studio'
                  : activeZone === 'dealer-lounge'
                  ? 'VIP Concierge & Dealer Lounge'
                  : activeZone === 'coastal-race'
                  ? 'Victoria Island Coastal Race Grid'
                  : 'Showroom Vehicle Showcase'}
              </div>
              <div className="text-[10px] text-gray-300 truncate">
                {activeZone === 'marketplace'
                  ? 'Explore verified live vehicle inventory'
                  : activeZone === 'customizer'
                  ? 'Upgrade ECU stages, suspension & rims'
                  : activeZone === 'dealer-lounge'
                  ? 'Dealer inventory, enquiries & financing'
                  : activeZone === 'coastal-race'
                  ? '4-Lane Grand Prix vs 4 AI Racers to Epe'
                  : 'Inspect specs & verified Naira pricing'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (activeZone === 'marketplace') onEnterMarketplace();
                else if (activeZone === 'customizer') onOpenCustomizer();
                else if (activeZone === 'dealer-lounge') onOpenDealerLounge?.();
                else if (activeZone === 'coastal-race') onStartCoastalRace?.();
                else onInspectCar?.(activeZone);
              }}
              className="px-3.5 py-1.5 bg-[#EF233C] hover:bg-[#d90429] text-white text-xs font-bold uppercase rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              {activeZone === 'coastal-race' ? 'Start Race' : 'Open'}
            </button>
          </div>
        )}
      </div>

      {/* CENTERED COASTAL RACE COUNTDOWN & FINISH RESULT MODAL (WELL CLEAR OF CAR CONTROLS) */}
      {coastalRaceState && coastalRaceState.phase === 'COUNTDOWN' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 pb-28 sm:pb-16 pointer-events-none">
          <div className="bg-[#071A2B]/96 border-2 border-[#EF233C] px-8 py-5 rounded-3xl shadow-2xl text-center space-y-1.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">
              Coastal Highway Grand Prix
            </div>
            <div className="text-6xl font-black font-mono text-white animate-pulse">
              {coastalRaceState.countdownSeconds}
            </div>
            <div className="text-[11px] font-semibold text-sky-200">
              Victoria Island -&gt; Epe 4-Lane Express vs 4 AI Racers
            </div>
          </div>
        </div>
      )}

      {coastalRaceState && coastalRaceState.phase === 'FINISHED' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-14 pb-36 sm:pb-24 bg-black/50 pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="bg-[#071A2B]/98 border border-emerald-400/50 p-4 sm:p-5 rounded-3xl shadow-2xl max-w-md w-full max-h-[58dvh] overflow-y-auto space-y-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  Epe Coastal Finish Gantry
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Finished P{coastalRaceState.rank} of {coastalRaceState.totalRacers}
                </h3>
              </div>
              <div className="text-right font-mono">
                <div className="text-sm font-black text-amber-400">
                  +{coastalRaceState.prizeCredits.toLocaleString()} MC
                </div>
                <div className="text-xs text-gray-300">
                  {coastalRaceState.elapsedSec.toFixed(1)}s
                </div>
              </div>
            </div>

            <div className="space-y-1">
              {coastalRaceState.leaderboard.map((entry) => (
                <div
                  key={`${entry.position}-${entry.name}`}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold ${
                    entry.isPlayer
                      ? 'bg-[#EF233C]/25 border border-[#EF233C]/50 text-white'
                      : 'bg-white/5 text-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-amber-300 w-5">#{entry.position}</span>
                    <span>{entry.isPlayer ? `${playerNickname} (You)` : entry.name}</span>
                  </span>
                  <span className="font-mono text-[11px] text-sky-300">
                    {entry.finishTime != null
                      ? `${entry.finishTime.toFixed(1)}s`
                      : `CP ${entry.cpIdx}/${coastalRaceState.totalCheckpoints}`}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              {onStartCoastalRace && (
                <button
                  type="button"
                  onClick={onStartCoastalRace}
                  className="flex-1 py-2 rounded-xl bg-[#EF233C] hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Race Again
                </button>
              )}
              {onExitCoastalRace && (
                <button
                  type="button"
                  onClick={onExitCoastalRace}
                  className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Exit to Free Roam
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. ON-SCREEN DRIVING CONTROLS: INTERACTIVE STEERING WHEEL + CENTER HORN + GEARS + OPTIONAL PEDALS */}
      <MobileTouchControls
        onVirtualInput={onVirtualInput || (() => {})}
        virtualInputState={virtualInputState}
        cameraMode={cameraMode}
        selectedGear={selectedGear}
        onSelectGear={onSelectGear}
        hornActive={hornActive}
        onHornDown={onHornDown}
        onHornUp={onHornUp}
        disabled={drivingDisabled || showGameMenu || showControlsHelp}
        showPedals={touchControlsEnabled}
      />
    </div>
  );
};
