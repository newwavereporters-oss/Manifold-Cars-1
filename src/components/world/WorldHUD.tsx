import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Camera,
  Sun,
  Moon,
  Sunset,
  Palette,
  ExternalLink,
  HelpCircle,
  Sparkles,
  ShoppingBag,
  Car as CarIcon,
  Navigation,
  Compass,
  Coins,
  Sliders,
  Power,
  Zap,
  Smartphone,
} from 'lucide-react';
import { CameraViewMode, TimeOfDay } from './WorldCanvas';
import { VehicleModelType, VEHICLE_SPEC_PROFILES } from './worldModels';
import { engineAudio, AudioDriveMode } from '../../utils/engineAudio';
import { CockpitDashboardOverlay, HeadlightState, TurnSignalState, CockpitHotspot } from './CockpitDashboardOverlay';
import { MobileTouchControls } from './MobileTouchControls';

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
  onVirtualInput?: (input: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    handbrake: boolean;
  }) => void;
  virtualInputState?: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    handbrake: boolean;
  };
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
  cockpitHotspot: CockpitHotspot;
  onSelectHotspot: (spot: CockpitHotspot) => void;
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
  onSelectVehicleType,
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
  cockpitHotspot,
  onSelectHotspot,
}) => {
  const [isMuted, setIsMuted] = useState(() => engineAudio.getMuted());
  const [showControlsHelp, setShowControlsHelp] = useState(false);
  const [showGarageDropdown, setShowGarageDropdown] = useState(false);
  const [touchControlsEnabled, setTouchControlsEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        window.innerWidth < 1024 ||
        'ontouchstart' in window ||
        (navigator.maxTouchPoints || 0) > 0
      );
    }
    return true;
  });

  const currentProfile =
    VEHICLE_SPEC_PROFILES[selectedVehicleType] || VEHICLE_SPEC_PROFILES.SPORTS_COUPE;

  const toggleSound = () => {
    engineAudio.init();
    const muted = engineAudio.toggleMute();
    setIsMuted(muted);
  };

  const cameraOptions: { mode: CameraViewMode; label: string }[] = [
    { mode: 'CHASE', label: 'Chase' },
    { mode: 'COCKPIT', label: 'Cockpit' },
    { mode: 'ORBIT', label: 'Orbit' },
    { mode: 'DRONE', label: 'Drone' },
  ];

  const cycleCamera = () => {
    const list: CameraViewMode[] = ['CHASE', 'COCKPIT', 'ORBIT', 'DRONE'];
    const idx = list.indexOf(cameraMode);
    const next = list[(idx + 1) % list.length];
    onCameraChange(next);
  };

  const cycleDriveMode = () => {
    const modes: AudioDriveMode[] = ['COMFORT', 'SPORT', 'TRACK', 'ECO', 'DRIFT'];
    const idx = modes.indexOf(driveMode);
    const next = modes[(idx + 1) % modes.length];
    onSelectDriveMode(next);
  };

  // Minimap Coordinates Translation: Track is [-180, 180] in world space
  const worldRadius = 180;
  const mapXPercent = Math.max(5, Math.min(95, 50 + (carPosition.x / worldRadius) * 45));
  const mapZPercent = Math.max(5, Math.min(95, 50 + (carPosition.z / worldRadius) * 45));

  const showroomX = 50 + (0 / worldRadius) * 45;
  const showroomY = 50 + (-45 / worldRadius) * 45;
  const portalX = 50 + (0 / worldRadius) * 45;
  const portalY = 50 + (32 / worldRadius) * 45;
  const speedTrapX = 50 + (-55 / worldRadius) * 45;
  const speedTrapY = 50 + (0 / worldRadius) * 45;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-6 select-none z-20">
      {/* 1. TOP STATUS BAR */}
      <header className="flex items-center justify-between w-full pointer-events-auto gap-2">
        {/* Left: Brand Badge & Vehicle Garage Selector */}
        <div className="relative flex items-center gap-2">
          <div className="flex items-center gap-2.5 bg-[#071A2B]/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 shadow-2xl">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF233C] animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-bold tracking-widest text-gray-400">
                PROVING GROUND
              </span>
              <span className="text-xs font-black tracking-wider text-white">MANIFOLD WORLD</span>
            </div>
          </div>

          {/* Quick Vehicle Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowGarageDropdown(!showGarageDropdown)}
              className="flex items-center gap-2 bg-[#071A2B]/90 hover:bg-[#071A2B] backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 shadow-2xl text-xs font-bold text-white transition-all group"
            >
              <CarIcon className="w-3.5 h-3.5 text-[#EF233C]" />
              <span className="hidden sm:inline">{currentProfile.name}</span>
              <span className="sm:hidden">{currentProfile.make}</span>
              <span className="text-[10px] text-gray-400 font-mono">▾</span>
            </button>

            {showGarageDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-[#071A2B]/98 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                <span className="px-2.5 py-1 text-[9px] uppercase font-bold text-gray-400 tracking-wider">
                  Select Active Vehicle
                </span>
                {(
                  [
                    'SPORTS_COUPE',
                    'LUXURY_SUV',
                    'EXECUTIVE_SEDAN',
                    'RUGGED_4X4',
                  ] as VehicleModelType[]
                ).map((vKey) => {
                  const prof = VEHICLE_SPEC_PROFILES[vKey];
                  const isSel = selectedVehicleType === vKey;
                  return (
                    <button
                      key={vKey}
                      onClick={() => {
                        onSelectVehicleType(vKey);
                        setShowGarageDropdown(false);
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors ${
                        isSel
                          ? 'bg-[#EF233C] text-white font-bold'
                          : 'text-gray-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div>
                        <span className="block font-bold leading-tight">{prof.name}</span>
                        <span className="text-[9px] opacity-75 block">{prof.engineType}</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold">{prof.horsepower} HP</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Credits, Time of Day, Mute & Settings */}
        <div className="flex items-center gap-2">
          {/* Virtual Credits Balance Badge */}
          <div className="bg-[#071A2B]/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-1.5 text-xs font-mono font-black text-amber-400">
            <Coins className="w-3.5 h-3.5" />
            <span className="tabular-nums">{playerCredits.toLocaleString()}</span>
            <span className="text-[9px] text-gray-400 font-sans font-bold">MC</span>
          </div>

          {/* Time of Day Cycle Button */}
          <div className="hidden sm:flex items-center gap-1 bg-[#071A2B]/90 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-2xl">
            <button
              onClick={() => onTimeOfDayChange('DAYLIGHT')}
              className={`p-1.5 rounded-xl transition-colors ${
                timeOfDay === 'DAYLIGHT' ? 'bg-amber-400 text-black' : 'text-gray-400 hover:text-white'
              }`}
              title="Sunny Daylight (Default)"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => onTimeOfDayChange('SUNSET')}
              className={`p-1.5 rounded-xl transition-colors ${
                timeOfDay === 'SUNSET' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Sunset Warm Glow"
            >
              <Sunset className="w-4 h-4" />
            </button>
            <button
              onClick={() => onTimeOfDayChange('MIDNIGHT')}
              className={`p-1.5 rounded-xl transition-colors ${
                timeOfDay === 'MIDNIGHT' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Midnight Track Lighting"
            >
              <Moon className="w-4 h-4" />
            </button>
          </div>

          {/* Tuning Studio Shortcut */}
          <button
            onClick={onOpenCustomizer}
            className="flex items-center gap-1.5 bg-[#071A2B]/90 hover:bg-white/10 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/10 shadow-2xl text-xs font-bold text-white transition-colors"
            title="Open Tuning Studio [C]"
          >
            <Palette className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Tuning Studio</span>
          </button>

          {/* Marketplace Portal Shortcut */}
          <button
            onClick={onEnterMarketplace}
            className="flex items-center gap-1.5 bg-[#EF233C] hover:bg-[#d90429] px-3.5 py-2 rounded-2xl shadow-2xl text-xs font-black uppercase text-white transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Marketplace</span>
          </button>

          {/* Procedural Audio Mute Button */}
          <button
            onClick={toggleSound}
            className="p-2 bg-[#071A2B]/90 hover:bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl text-gray-300 hover:text-white transition-colors"
            title={isMuted ? 'Unmute Audio Engine' : 'Mute Audio Engine'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* On-Screen Touch Controls Toggle */}
          <button
            onClick={() => setTouchControlsEnabled(!touchControlsEnabled)}
            className={`p-2 backdrop-blur-md rounded-2xl border transition-all ${
              touchControlsEnabled
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400 shadow-lg shadow-emerald-500/20'
                : 'bg-[#071A2B]/90 hover:bg-white/10 border-white/10 text-gray-400 hover:text-white'
            }`}
            title={touchControlsEnabled ? 'Hide Touch Driving Controls' : 'Show Touch Driving Controls'}
          >
            <Smartphone className="w-4 h-4" />
          </button>

          {/* Controls Help */}
          <button
            onClick={() => setShowControlsHelp(!showControlsHelp)}
            className="p-2 bg-[#071A2B]/90 hover:bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl text-gray-300 hover:text-white transition-colors"
            title="Controls Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. CONTROLS MODAL OVERLAY */}
      {showControlsHelp && (
        <div className="pointer-events-auto self-center max-w-lg w-full bg-[#071A2B]/95 backdrop-blur-2xl border border-white/15 p-6 rounded-3xl shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-150 z-50">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-[#EF233C]" />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Proving Ground Flight & Drive Controls
              </h3>
            </div>
            <button
              onClick={() => setShowControlsHelp(false)}
              className="text-gray-400 hover:text-white text-xs font-bold"
            >
              Close [ESC]
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 mt-4 text-xs">
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-[#EF233C] block mb-0.5">W / Arrow Up / Gas</span>
              <span className="text-gray-300 text-[11px]">Throttle & Dynamic Acceleration</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-[#EF233C] block mb-0.5">S / Arrow Down / Brake</span>
              <span className="text-gray-300 text-[11px]">Braking & Reverse Gear</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-[#EF233C] block mb-0.5">A / D or Left / Right</span>
              <span className="text-gray-300 text-[11px]">Steering Authority</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-amber-400 block mb-0.5">Spacebar / DRIFT</span>
              <span className="text-gray-300 text-[11px]">Handbrake Drift Slide</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-yellow-400 block mb-0.5">H / Horn Button</span>
              <span className="text-gray-300 text-[11px]">Polyphonic Dual-Tone Horn</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-white block mb-0.5">E / Ignition</span>
              <span className="text-gray-300 text-[11px]">Push-to-Start Engine / Hotspots</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-emerald-400 block mb-0.5">Q / E (Blinkers)</span>
              <span className="text-gray-300 text-[11px]">Left / Right Turn Signals</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
              <span className="font-bold text-blue-400 block mb-0.5">C</span>
              <span className="text-gray-300 text-[11px]">Tuning & Upgrades Studio</span>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-gray-400 text-center">
            Procedural audio synthesizes dynamically as your vehicle accelerates through 6 gears.
          </p>
        </div>
      )}

      {/* 3. CENTER NOTIFICATION BANNERS */}
      <div className="self-center flex flex-col items-center gap-2">
        {/* Speed Trap Banner */}
        {speedTrapRecord && (
          <div className="bg-[#10b981]/95 backdrop-blur-md border border-[#10b981] px-6 py-2.5 rounded-2xl shadow-2xl animate-bounce">
            <p className="text-xs font-extrabold uppercase tracking-widest text-black flex items-center gap-2">
              <span>⚡ SPEED TRAP RECORDED:</span>
              <span className="text-base font-black font-mono tabular-nums">{speedTrapRecord} KM/H</span>
            </p>
          </div>
        )}

        {/* Economy Reward Notification */}
        {creditNotification && (
          <div className="bg-amber-400 text-black px-5 py-2 rounded-2xl shadow-2xl border border-amber-300 animate-in slide-in-from-top duration-200 flex items-center gap-2 text-xs font-black">
            <Coins className="w-4 h-4 text-black" />
            <span>+{creditNotification.amount} MC EARNED:</span>
            <span className="font-normal">{creditNotification.reason}</span>
          </div>
        )}

        {/* Proximity Interactive Action Prompt */}
        {activeZone && (
          <div className="pointer-events-auto bg-[#071A2B]/90 backdrop-blur-xl border border-[#EF233C] px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 transition-all">
            <div className="w-9 h-9 rounded-xl bg-[#EF233C]/20 border border-[#EF233C]/40 flex items-center justify-center text-[#EF233C] font-black text-sm">
              E
            </div>
            <div>
              <div className="text-xs font-bold text-white uppercase tracking-wider">
                {activeZone === 'marketplace'
                  ? 'Grand Marketplace Gateway'
                  : activeZone === 'customizer'
                  ? 'Custom Tuning Studio'
                  : activeZone === 'dealer-lounge'
                  ? 'VIP Concierge & Dealer Lounge'
                  : 'Showroom Vehicle Showcase'}
              </div>
              <div className="text-[11px] text-gray-300">
                {activeZone === 'marketplace'
                  ? 'Drive through or click to explore verified live inventory'
                  : activeZone === 'customizer'
                  ? 'Upgrade ECU stages, suspension, tires, and neon underglow'
                  : activeZone === 'dealer-lounge'
                  ? 'Access dealer inventory onboarding, enquiries & financing'
                  : 'Inspect vehicle specs, verified Naira price & video review'}
              </div>
            </div>
            <button
              onClick={() => {
                if (activeZone === 'marketplace') onEnterMarketplace();
                else if (activeZone === 'customizer') onOpenCustomizer();
                else if (activeZone === 'dealer-lounge') onOpenDealerLounge?.();
                else onInspectCar?.(activeZone);
              }}
              className="px-4 py-2 bg-[#EF233C] hover:bg-[#d90429] text-white text-xs font-bold uppercase rounded-xl transition-colors shrink-0"
            >
              Open
            </button>
          </div>
        )}
      </div>

      {/* 4. COCKPIT DASHBOARD OVERLAY (Active when in COCKPIT mode) */}
      {cameraMode === 'COCKPIT' && (
        <CockpitDashboardOverlay
          speedKmh={speedKmh}
          rpm={rpm}
          gear={gear}
          spec={currentProfile}
          isEngineRunning={isEngineRunning}
          onToggleEngine={onToggleEngine}
          headlightState={headlightState}
          onCycleHeadlights={onCycleHeadlights}
          turnSignal={turnSignal}
          onToggleTurnSignal={onToggleTurnSignal}
          hazardLights={hazardLights}
          onToggleHazard={onToggleHazard}
          hornActive={hornActive}
          onHornDown={onHornDown}
          onHornUp={onHornUp}
          driveMode={driveMode}
          onSelectDriveMode={onSelectDriveMode}
          radioStation={radioStation}
          onSelectRadioStation={onSelectRadioStation}
          radioVolume={radioVolume}
          onRadioVolumeChange={onRadioVolumeChange}
          cockpitHotspot={cockpitHotspot}
          onSelectHotspot={onSelectHotspot}
        />
      )}

      {/* 5. MOBILE & ON-SCREEN TOUCH CONTROLS */}
      {touchControlsEnabled && (
        <MobileTouchControls
          onVirtualInput={onVirtualInput || (() => {})}
          virtualInputState={virtualInputState}
          isEngineRunning={isEngineRunning}
          onToggleEngine={onToggleEngine}
          headlightState={headlightState}
          onCycleHeadlights={onCycleHeadlights}
          hazardLights={hazardLights}
          onToggleHazard={onToggleHazard}
          onHornDown={onHornDown}
          onHornUp={onHornUp}
          cameraMode={cameraMode}
          onCycleCamera={cycleCamera}
          driveMode={driveMode}
          onCycleDriveMode={cycleDriveMode}
          speedKmh={speedKmh}
          gear={gear}
          rpm={rpm}
        />
      )}

      {/* 6. BOTTOM DESKTOP HUD BAR: TELEMETRY & CONTROLS + MINIMAP */}
      <footer
        className={`${
          touchControlsEnabled ? 'hidden xl:flex' : 'hidden sm:flex'
        } items-end justify-between w-full pointer-events-auto gap-4`}
      >
        {/* Left: Camera Selector & Navigation Mini-Compass */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 bg-[#071A2B]/85 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-lg">
            <div className="px-2 py-1 text-gray-400 text-xs font-bold uppercase flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              <span>Cam</span>
            </div>
            {cameraOptions.map((opt) => (
              <button
                key={opt.mode}
                onClick={() => onCameraChange(opt.mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                  cameraMode === opt.mode
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Vehicle Stats Badge */}
          <div className="flex items-center gap-2 bg-[#071A2B]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-gray-400 font-mono">
            <span>MODE: {driveMode}</span>
            <span>•</span>
            <span>TOP: {Math.round(currentProfile.maxSpeed * 4.6)} KM/H</span>
            <span>•</span>
            <span>ACCEL: {currentProfile.acceleration} M/S²</span>
            <span>•</span>
            <span>REDLINE: {currentProfile.redlineRpm} RPM</span>
          </div>
        </div>

        {/* Center: Interactive High-Precision Minimap Radar */}
        <div className="hidden lg:flex flex-col items-center bg-[#071A2B]/85 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-2xl">
          <div className="w-32 h-32 relative rounded-xl bg-slate-900/90 overflow-hidden border border-white/15">
            <div className="absolute inset-2 rounded-full border border-dashed border-white/20" />

            {/* Showroom POI Dot */}
            <div
              className="absolute w-2 h-2 rounded-full bg-blue-400 -translate-x-1/2 -translate-y-1/2 shadow-sm"
              style={{ left: `${showroomX}%`, top: `${showroomY}%` }}
              title="Showroom Pavilion"
            />
            {/* Marketplace Portal POI Dot */}
            <div
              className="absolute w-2.5 h-2.5 rounded-full bg-[#EF233C] -translate-x-1/2 -translate-y-1/2 shadow-md animate-pulse"
              style={{ left: `${portalX}%`, top: `${portalY}%` }}
              title="Marketplace Gate"
            />
            {/* Speed Trap POI Dot */}
            <div
              className="absolute w-2 h-2 rounded-full bg-emerald-400 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${speedTrapX}%`, top: `${speedTrapY}%` }}
              title="Speed Trap Gate"
            />

            {/* Player Car Arrow Position and Heading */}
            <div
              className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
              style={{
                left: `${mapXPercent}%`,
                top: `${mapZPercent}%`,
                transform: `translate(-50%, -50%) rotate(${carPosition.heading}rad)`,
              }}
            >
              <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[9px] border-b-yellow-400" />
            </div>

            {/* Radar Coordinates Label */}
            <div className="absolute bottom-1 right-1 text-[8px] font-mono text-gray-400">
              {Math.round(carPosition.x)}, {Math.round(carPosition.z)}
            </div>
          </div>
          <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mt-1">
            Proving Ground Radar
          </span>
        </div>

        {/* Right: Racing Cluster (Speedometer & RPM) */}
        <div className="bg-[#071A2B]/90 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-6">
          {/* Gear Shift Box */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Gear</span>
            <span className="text-2xl font-black text-[#EF233C] font-mono">{gear}</span>
          </div>

          {/* Speed Number & Unit */}
          <div className="flex flex-col items-end">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white font-mono tabular-nums tracking-tight">
                {speedKmh}
              </span>
              <span className="text-xs font-extrabold text-gray-400 uppercase">KM/H</span>
            </div>

            {/* RPM Progress Bar */}
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
