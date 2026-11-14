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
  Car as CarIcon,
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
  ShieldCheck,
  Lightbulb,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Radio,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { CameraViewMode, TimeOfDay } from './WorldCanvas';
import {
  VehicleModelType,
  VEHICLE_SPEC_PROFILES,
  HeadlightState,
  TurnSignalState,
} from './worldModels';
import { engineAudio, AudioDriveMode } from '../../utils/engineAudio';
import { MobileTouchControls, VirtualDrivingInput } from './MobileTouchControls';
import {
  LAGOS_ROAD_NODES,
  CITY_LANDMARKS,
  findShortestRoadPathDetailed,
} from './lagosCityData';

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
  onResetVehicle?: () => void;
  activeDestination?: { x: number; z: number; name: string } | null;
  onClearDestination?: () => void;
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
  onResetVehicle,
  activeDestination,
  onClearDestination,
  playerNickname = 'DRIVER',
  nearbyPlayersCount = 0,
  lockStatus,
  onOpenNearbyDrivers,
  onOpenVehicleConfig,
  onOpenBlockedDrivers,
  onOpenShowroomSample,
  onLogout,
}) => {
  const [isMuted, setIsMuted] = useState(() => engineAudio.getMuted());
  const [masterVolume, setMasterVolume] = useState(() =>
    Math.round(engineAudio.getMasterVolume() * 100)
  );
  const [showControlsHelp, setShowControlsHelp] = useState(false);
  const [showGameMenu, setShowGameMenu] = useState(false);
  const [showPlayerMenu, setShowPlayerMenu] = useState(false);
  const [showVehiclePanel, setShowVehiclePanel] = useState(false);
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

  // Deduplicated Road Segments for Live Centered Minimap
  const radarRoadEdges = useMemo(() => {
    const seen = new Set<string>();
    const list: {
      key: string;
      x1: number;
      z1: number;
      x2: number;
      z2: number;
      isDual: boolean;
      isBridge: boolean;
    }[] = [];
    Object.values(LAGOS_ROAD_NODES).forEach((node) => {
      node.neighbors.forEach((nId) => {
        const nb = LAGOS_ROAD_NODES[nId];
        if (!nb) return;
        const key = [node.id, nb.id].sort().join('--');
        if (seen.has(key)) return;
        seen.add(key);
        list.push({
          key,
          x1: node.x,
          z1: node.z,
          x2: nb.x,
          z2: nb.z,
          isDual: Boolean(node.isDualCarriageway && nb.isDualCarriageway),
          isBridge: Boolean(node.isBridge || nb.isBridge),
        });
      });
    });
    return list;
  }, []);

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

  const radarHalfSpan = 140;
  const vbLeft = carPosition.x - radarHalfSpan;
  const vbTop = carPosition.z - radarHalfSpan;
  const vbSize = radarHalfSpan * 2;
  const formatDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between pt-[max(0.5rem,env(safe-area-inset-top))] px-[max(0.65rem,env(safe-area-inset-left))] pr-[max(0.65rem,env(safe-area-inset-right))] pb-3 sm:p-5 select-none z-20">
      {/* 1. COMPACT TOP HUD BAR + FLOATING VEHICLE STATUS PILL */}
      <div className="flex flex-col gap-2 w-full">
        <header className="flex items-center justify-between w-full pointer-events-auto gap-1.5 sm:gap-2">
          {/* Left: Compact Brand + Game Menu */}
          <div className="relative flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 bg-[#071A2B]/88 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/12 shadow-lg">
              <CarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#EF233C] shrink-0" />
              <span className="text-[11px] sm:text-xs font-black tracking-wider text-white">
                MANIFOLD
              </span>
              <span className="hidden md:inline text-[9px] uppercase font-bold tracking-wider text-gray-400 border-l border-white/15 pl-2 truncate max-w-[140px]">
                {currentProfile.name}
              </span>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowGameMenu((p) => !p);
                  setShowPlayerMenu(false);
                  setShowVehiclePanel(false);
                }}
                className="flex items-center gap-1.5 bg-[#071A2B]/90 hover:bg-[#0b233a] backdrop-blur-md px-2.5 sm:px-3 py-1.5 rounded-xl border border-white/15 shadow-lg text-[11px] sm:text-xs font-black uppercase tracking-wider text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <Menu className="w-3.5 h-3.5 text-[#EF233C]" />
                <span>Menu</span>
                {nearbyPlayersCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-400 text-slate-950 text-[9px] font-black leading-tight">
                    {nearbyPlayersCount}
                  </span>
                )}
              </button>

              {showGameMenu && (
                <div className="absolute top-full left-0 mt-2 w-68 max-w-[calc(100vw-1.5rem)] bg-[#071A2B]/98 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-2 z-50 space-y-1 text-xs">
                  {onOpenNearbyDrivers && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGameMenu(false);
                        onOpenNearbyDrivers();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-white hover:bg-white/10 font-bold"
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

                  {onOpenCityMap && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGameMenu(false);
                        onOpenCityMap();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-white hover:bg-white/10 font-bold"
                    >
                      <MapIcon className="w-3.5 h-3.5 text-sky-400" />
                      <span>Lagos City GPS Map [M]</span>
                    </button>
                  )}

                  {onOpenMissions && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGameMenu(false);
                        onOpenMissions();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-white hover:bg-white/10 font-bold"
                    >
                      <Flag className="w-3.5 h-3.5 text-amber-400" />
                      <span>Missions & Street Races</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowGameMenu(false);
                      onOpenCustomizer();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-white hover:bg-white/10 font-bold"
                  >
                    <Palette className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tuning & Upgrades [C]</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowGameMenu(false);
                      onCameraChange(cameraMode === 'CHASE' ? 'DRONE' : 'CHASE');
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-white hover:bg-white/10 font-bold"
                  >
                    <span className="flex items-center gap-2">
                      <Camera className="w-3.5 h-3.5 text-blue-400" />
                      <span>Camera View</span>
                    </span>
                    <span className="text-[10px] font-mono text-sky-300">{cameraMode}</span>
                  </button>

                  <div className="px-3 py-1.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-400">
                      Time of Day
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onTimeOfDayChange('DAYLIGHT')}
                        className={`p-1 rounded-lg ${
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
                        className={`p-1 rounded-lg ${
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
                        className={`p-1 rounded-lg ${
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
                    onClick={() => {
                      setTouchControlsEnabled((p) => !p);
                      setShowGameMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-white hover:bg-white/10 font-bold"
                  >
                    <span className="flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Touch Pedals</span>
                    </span>
                    <span className="text-[10px] font-mono text-gray-300">
                      {touchControlsEnabled ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {onResetVehicle && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGameMenu(false);
                        onResetVehicle();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-white hover:bg-white/10 font-bold"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-gray-300" />
                      <span>Reset Vehicle [R]</span>
                    </button>
                  )}

                  <div className="border-t border-white/10 pt-1 mt-1 space-y-1">
                    {onOpenShowroomSample && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowGameMenu(false);
                          onOpenShowroomSample();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-gray-200 hover:bg-white/10 font-semibold"
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
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-gray-200 hover:bg-white/10 font-semibold"
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
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-[#EF233C] hover:bg-white/10 font-black"
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
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left text-gray-300 hover:bg-white/10 font-semibold"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Controls Guide</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Credits (Desktop+) + Player Status + Mute Toggle */}
          <div className="relative flex items-center gap-1.5 sm:gap-2">
            <div className="hidden md:flex bg-[#071A2B]/88 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/12 shadow-lg items-center gap-1.5 text-xs font-mono font-black text-amber-400">
              <Coins className="w-3.5 h-3.5" />
              <span className="tabular-nums">{playerCredits.toLocaleString()}</span>
              <span className="text-[9px] text-gray-400 font-sans font-bold">MC</span>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowPlayerMenu((p) => !p);
                  setShowGameMenu(false);
                  setShowVehiclePanel(false);
                }}
                className="flex items-center gap-1.5 bg-[#071A2B]/90 hover:bg-[#0b233a] backdrop-blur-md px-2.5 sm:px-3 py-1.5 rounded-xl border border-white/15 shadow-lg text-[11px] sm:text-xs font-bold text-white cursor-pointer whitespace-nowrap"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <User className="w-3.5 h-3.5 text-sky-400 hidden sm:inline" />
                <span className="max-w-[78px] sm:max-w-[110px] truncate font-black">
                  {playerNickname}
                </span>
              </button>

              {showPlayerMenu && (
                <div className="absolute top-full right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-[#071A2B]/98 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-3 z-50 space-y-2.5 text-xs">
                  <div className="pb-2 border-b border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-white">{playerNickname}</span>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase">
                        Online
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-400 font-mono font-bold block mt-0.5">
                      {playerCredits.toLocaleString()} MC Balance
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase">
                      <span className="flex items-center gap-1 text-gray-300">
                        {lockStatus?.isLocked ? (
                          <Lock className="w-3 h-3 text-amber-400" />
                        ) : (
                          <Unlock className="w-3 h-3 text-emerald-400" />
                        )}
                        <span>Vehicle Setup</span>
                      </span>
                      <span
                        className={`font-mono ${
                          lockStatus?.isLocked ? 'text-amber-300' : 'text-emerald-400'
                        }`}
                      >
                        {lockStatus?.isLocked ? lockStatus.hhmmss : 'Unlocked'}
                      </span>
                    </div>

                    {onOpenVehicleConfig && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowPlayerMenu(false);
                          onOpenVehicleConfig();
                        }}
                        className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold"
                      >
                        {lockStatus?.isLocked ? 'View Lock Countdown' : 'Reconfigure Vehicle'}
                      </button>
                    )}
                  </div>

                  {onOpenBlockedDrivers && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlayerMenu(false);
                        onOpenBlockedDrivers();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-gray-200 hover:bg-white/10 font-bold"
                    >
                      <Ban className="w-3.5 h-3.5 text-red-400" />
                      <span>Blocked Drivers</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowPlayerMenu(false);
                      setShowControlsHelp(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-gray-200 hover:bg-white/10 font-bold"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                    <span>Driving & Community Guide</span>
                  </button>

                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlayerMenu(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-red-300 hover:bg-red-500/15 font-black"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out of Game</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleSound}
              className="p-1.5 sm:p-2 bg-[#071A2B]/90 hover:bg-white/10 backdrop-blur-md rounded-xl border border-white/15 shadow-lg text-gray-300 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>
          </div>
        </header>

        {/* COMPACT FLOATING VEHICLE STATUS BAR & EXPANDABLE PANEL */}
        <div className="flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="relative pointer-events-auto flex items-center gap-1.5">
            {/* Always-compact Speed + Gear + Expand Drawer Pill */}
            <button
              type="button"
              onClick={() => {
                setShowVehiclePanel((p) => !p);
                setShowGameMenu(false);
                setShowPlayerMenu(false);
              }}
              className="flex items-center gap-2 bg-[#071A2B]/86 hover:bg-[#0b233a] backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 shadow-lg cursor-pointer"
              title="Toggle Vehicle Controls"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isEngineRunning ? 'bg-emerald-400' : 'bg-red-400'
                }`}
              />
              <span className="text-xs font-black text-[#EF233C] font-mono">{gear}</span>
              <span className="w-px h-3.5 bg-white/15" />
              <div className="flex items-baseline gap-0.5 font-mono">
                <span className="text-sm font-black text-white tabular-nums">{speedKmh}</span>
                <span className="text-[8px] text-gray-400 font-bold">KM/H</span>
              </div>
              <span className="hidden sm:inline w-px h-3.5 bg-white/15" />
              <span className="hidden sm:inline text-[10px] font-black text-sky-300 uppercase">
                {driveMode}
              </span>
              {showVehiclePanel ? (
                <ChevronUp className="w-3.5 h-3.5 text-gray-300" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-300" />
              )}
            </button>

            {/* Quick Camera Mode Toggle / Return to Chase CTA */}
            {cameraMode === 'DRONE' ? (
              <button
                type="button"
                onClick={() => onCameraChange('CHASE')}
                className="flex items-center gap-1.5 bg-[#EF233C] hover:bg-[#d90429] text-white px-3 py-1.5 rounded-xl shadow-lg text-[10px] sm:text-xs font-black uppercase tracking-wider cursor-pointer animate-in fade-in duration-150"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Return to Chase</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onCameraChange('DRONE')}
                className="flex items-center gap-1.5 bg-[#071A2B]/84 hover:bg-[#0b233a] backdrop-blur-md text-gray-200 px-2.5 py-1.5 rounded-xl border border-white/12 shadow-lg text-[10px] sm:text-[11px] font-bold uppercase cursor-pointer"
                title="Switch to Drone Aerial Camera"
              >
                <Camera className="w-3.5 h-3.5 text-sky-400" />
                <span>Drone</span>
              </button>
            )}

            {/* Expandable Vehicle Systems Drawer */}
            {showVehiclePanel && (
              <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-[#071A2B]/96 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-3 z-50 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#EF233C]" />
                    <span>Vehicle Systems</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">
                    {rpm} RPM
                  </span>
                </div>

                {/* Primary Electrical & Horn Controls */}
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

                {/* Turn Indicators */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase text-gray-400">
                    Indicators
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onToggleTurnSignal('LEFT')}
                      className={`px-2.5 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 ${
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
                      className={`px-2.5 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 ${
                        turnSignal === 'RIGHT'
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-white/5 border-white/10 text-gray-300'
                      }`}
                    >
                      R<ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Camera Mode Selector (Chase / Drone ONLY) */}
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1.5">
                    Camera Perspective
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {cameraOptions.map((opt) => (
                      <button
                        key={opt.mode}
                        type="button"
                        onClick={() => onCameraChange(opt.mode)}
                        className={`py-1.5 rounded-xl text-[11px] font-black uppercase transition-colors cursor-pointer ${
                          cameraMode === opt.mode
                            ? 'bg-white text-slate-950'
                            : 'bg-white/8 text-gray-300 hover:bg-white/15'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Driving Mode Selector */}
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

                {/* Sound & Audio Volume */}
                <div className="space-y-1.5 pt-1 border-t border-white/10">
                  <div className="flex items-center justify-between text-[10px] font-bold text-gray-300">
                    <span>Master Audio Volume</span>
                    <span className="font-mono">{isMuted ? 'MUTED' : `${masterVolume}%`}</span>
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
                      className="w-16 accent-emerald-400 h-1 bg-white/15 rounded-lg cursor-pointer"
                      title="Radio Volume"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Drone Mode Subtle Interactive Guide */}
          {cameraMode === 'DRONE' && (
            <div className="hidden sm:flex items-center gap-2 bg-[#071A2B]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-sky-400/30 text-[10px] font-bold text-sky-200 pointer-events-none">
              <span>DRONE VIEW — Drag anywhere to orbit • Scroll to zoom</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. CONTROLS GUIDE MODAL OVERLAY */}
      {showControlsHelp && (
        <div className="pointer-events-auto self-center max-w-lg w-full bg-[#071A2B]/96 backdrop-blur-2xl border border-white/15 p-5 sm:p-6 rounded-3xl shadow-2xl my-auto z-50">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-[#EF233C]" />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                MANIFOLD Driving & Camera Guide
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowControlsHelp(false)}
              className="text-gray-400 hover:text-white text-xs font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 mt-4 text-xs">
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-[#EF233C] block mb-0.5">W / ↑ / GAS</span>
              <span className="text-gray-300 text-[11px]">Throttle & Dynamic Acceleration</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-[#EF233C] block mb-0.5">S / ↓ / BRAKE</span>
              <span className="text-gray-300 text-[11px]">Braking & Reverse Gear</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-[#EF233C] block mb-0.5">A / D or ◀ / ▶</span>
              <span className="text-gray-300 text-[11px]">Steering Authority</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-amber-400 block mb-0.5">Spacebar / DRIFT</span>
              <span className="text-gray-300 text-[11px]">Handbrake Drift (Sport/Drift)</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-sky-400 block mb-0.5">Chase & Drone Cameras</span>
              <span className="text-gray-300 text-[11px]">Drag to orbit in Drone view</span>
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
          <div className="pointer-events-auto bg-[#071A2B]/90 backdrop-blur-xl border border-emerald-500/50 px-3.5 py-2 rounded-2xl shadow-2xl flex items-center gap-3 w-full">
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
          <div className="bg-[#10b981]/95 backdrop-blur-md border border-[#10b981] px-5 py-2 rounded-2xl shadow-2xl">
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

        {activeZone && (
          <div className="pointer-events-auto bg-[#071A2B]/92 backdrop-blur-xl border border-[#EF233C] px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 w-full">
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
                  : 'Showroom Vehicle Showcase'}
              </div>
              <div className="text-[10px] text-gray-300 truncate">
                {activeZone === 'marketplace'
                  ? 'Explore verified live vehicle inventory'
                  : activeZone === 'customizer'
                  ? 'Upgrade ECU stages, suspension & rims'
                  : activeZone === 'dealer-lounge'
                  ? 'Dealer inventory, enquiries & financing'
                  : 'Inspect specs & verified Naira pricing'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (activeZone === 'marketplace') onEnterMarketplace();
                else if (activeZone === 'customizer') onOpenCustomizer();
                else if (activeZone === 'dealer-lounge') onOpenDealerLounge?.();
                else onInspectCar?.(activeZone);
              }}
              className="px-3.5 py-1.5 bg-[#EF233C] hover:bg-[#d90429] text-white text-xs font-bold uppercase rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              Open
            </button>
          </div>
        )}
      </div>

      {/* 4. MOBILE THUMB DRIVING CONTROLS (Clean, Ergonomic, Safe-Area Bounded) */}
      {touchControlsEnabled && (
        <MobileTouchControls
          onVirtualInput={onVirtualInput || (() => {})}
          virtualInputState={virtualInputState}
          cameraMode={cameraMode}
          driveMode={driveMode}
          speedKmh={speedKmh}
          disabled={showGameMenu || showPlayerMenu || showControlsHelp}
        />
      )}

      {/* 5. DESKTOP BOTTOM HUD BAR (Hidden when touch pedals active on compact viewports) */}
      <footer
        className={`${
          touchControlsEnabled ? 'hidden xl:flex' : 'hidden sm:flex'
        } items-end justify-between w-full pointer-events-auto gap-4`}
      >
        {/* Left: Simplified 2-Mode Camera Selector (Chase / Drone) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 bg-[#071A2B]/85 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-lg">
            <div className="px-2 py-1 text-gray-400 text-xs font-bold uppercase flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              <span>Cam</span>
            </div>
            {cameraOptions.map((opt) => (
              <button
                key={opt.mode}
                type="button"
                onClick={() => onCameraChange(opt.mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  cameraMode === opt.mode
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-[#071A2B]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-gray-400 font-mono">
            <span>MODE: {driveMode}</span>
            <span>•</span>
            <span>TOP: {Math.round(currentProfile.maxSpeed * 4.6)} KM/H</span>
            <span>•</span>
            <span>{currentProfile.horsepower} HP</span>
          </div>
        </div>

        {/* Center: Live Centered Vector Road & GPS Minimap Radar */}
        <div className="hidden lg:flex flex-col items-center bg-[#071A2B]/88 backdrop-blur-md p-2 rounded-2xl border border-white/15 shadow-2xl">
          <div
            onClick={onOpenCityMap}
            className="w-36 h-36 relative rounded-xl bg-[#04101d] overflow-hidden border border-white/15 cursor-pointer group"
            title="Click to open Full Lagos Metro GPS Map [M]"
          >
            <svg viewBox={`${vbLeft} ${vbTop} ${vbSize} ${vbSize}`} className="w-full h-full">
              <rect x={-1200} y={-585} width={3050} height={420} fill="#0b3b59" fillOpacity="0.65" />
              <rect x={445} y={-165} width={150} height={420} fill="#0b3b59" fillOpacity="0.65" />
              <rect x={1350} y={-165} width={75} height={420} fill="#0b3b59" fillOpacity="0.65" />
              <rect x={1600} y={-165} width={450} height={420} fill="#0b3b59" fillOpacity="0.6" />
              <rect x={-1200} y={250} width={3250} height={260} fill="#0b3b59" fillOpacity="0.6" />

              {radarRoadEdges.map((e) => (
                <line
                  key={e.key}
                  x1={e.x1}
                  y1={e.z1}
                  x2={e.x2}
                  y2={e.z2}
                  stroke={e.isBridge ? '#38bdf8' : e.isDual ? '#64748b' : '#475569'}
                  strokeWidth={e.isDual ? 13 : 9}
                  strokeLinecap="round"
                />
              ))}

              {gpsRouteInfo && gpsRouteInfo.path.length >= 2 && (
                <polyline
                  points={gpsRouteInfo.path
                    .map((pt) => `${pt.x.toFixed(1)},${pt.z.toFixed(1)}`)
                    .join(' ')}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="6"
                  strokeDasharray="10 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {CITY_LANDMARKS.map((lm) => (
                <circle
                  key={lm.id}
                  cx={lm.x}
                  cy={lm.z}
                  r="7"
                  fill={lm.color}
                  stroke="#071A2B"
                  strokeWidth="2"
                />
              ))}

              <g
                transform={`translate(${carPosition.x}, ${carPosition.z}) rotate(${
                  180 - (carPosition.heading * 180) / Math.PI
                })`}
              >
                <circle cx="0" cy="0" r="14" fill="rgba(250, 204, 21, 0.22)" />
                <polygon
                  points="0,-13 9,9 0,3 -9,9"
                  fill="#facc15"
                  stroke="#071A2B"
                  strokeWidth="2"
                />
              </g>
            </svg>

            <div className="absolute top-1 left-1.5 px-1.5 py-0.5 rounded bg-black/55 text-[8px] font-extrabold uppercase text-sky-300 truncate max-w-[125px]">
              {nearestAreaLabel}
            </div>
          </div>
          <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mt-1">
            Lagos GPS Radar [M]
          </span>
        </div>

        {/* Right: Racing Telemetry Cluster (Speedometer & RPM) */}
        <div className="bg-[#071A2B]/90 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-6">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Gear</span>
            <span className="text-2xl font-black text-[#EF233C] font-mono">{gear}</span>
          </div>

          <div className="flex flex-col items-end">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white font-mono tabular-nums tracking-tight">
                {speedKmh}
              </span>
              <span className="text-xs font-extrabold text-gray-400 uppercase">KM/H</span>
            </div>

            <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full transition-all duration-75 rounded-full ${
                  rpm > currentProfile.redlineRpm * 0.85 ? 'bg-red-500' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, (rpm / currentProfile.redlineRpm) * 100)}%` }}
              />
            </div>
            <span className="text-[9px] text-gray-400 font-mono mt-0.5 tabular-nums">
              {rpm} RPM
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
