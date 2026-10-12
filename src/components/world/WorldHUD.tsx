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
} from 'lucide-react';
import { CameraViewMode, TimeOfDay } from './WorldCanvas';
import { VehicleModelType, VEHICLE_SPEC_PROFILES } from './worldModels';
import { engineAudio } from '../../utils/engineAudio';

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
  virtualInputState,
}) => {
  const [isMuted, setIsMuted] = useState(() => engineAudio.getMuted());
  const [showControlsHelp, setShowControlsHelp] = useState(false);
  const [showGarageDropdown, setShowGarageDropdown] = useState(false);

  const currentProfile = VEHICLE_SPEC_PROFILES[selectedVehicleType] || VEHICLE_SPEC_PROFILES.SPORTS_COUPE;

  const toggleSound = () => {
    engineAudio.init();
    const muted = engineAudio.toggleMute();
    setIsMuted(muted);
  };

  const handleTouch = (key: 'forward' | 'backward' | 'left' | 'right' | 'handbrake', active: boolean) => {
    if (!onVirtualInput || !virtualInputState) return;
    engineAudio.init();
    onVirtualInput({
      ...virtualInputState,
      [key]: active,
    });
  };

  const cameraOptions: { mode: CameraViewMode; label: string }[] = [
    { mode: 'CHASE', label: 'Chase' },
    { mode: 'COCKPIT', label: 'Cockpit' },
    { mode: 'ORBIT', label: 'Orbit' },
    { mode: 'DRONE', label: 'Drone' },
  ];

  const vehicleOptions: { type: VehicleModelType; label: string; desc: string }[] = [
    { type: 'SPORTS_COUPE', label: 'MANIFOLD GT Coupe', desc: 'V8 Twin-Turbo Track Coupe' },
    { type: 'LUXURY_SUV', label: 'Apex Luxury SUV', desc: 'AWD Twin-Turbo 7-Seater' },
    { type: 'EXECUTIVE_SEDAN', label: 'Prestige Executive', desc: 'V6 Luxury Comfort Cruiser' },
    { type: 'RUGGED_4X4', label: 'Highland Safari 4x4', desc: 'Heavy-Duty Overland V8' },
  ];

  // Minimap coordinate normalization (-160..160 map range to 0..100% SVG box)
  const mapExtent = 160;
  const mapXPercent = Math.min(Math.max(((carPosition.x + mapExtent) / (mapExtent * 2)) * 100, 4), 96);
  const mapZPercent = Math.min(Math.max(((carPosition.z + mapExtent) / (mapExtent * 2)) * 100, 4), 96);

  // Landmark coordinates on minimap
  // Marketplace Portal: [0, 32]
  const portalX = 50;
  const portalY = ((32 + mapExtent) / (mapExtent * 2)) * 100;

  // Showroom: [0, -45]
  const showroomX = 50;
  const showroomY = ((-45 + mapExtent) / (mapExtent * 2)) * 100;

  // Speed Trap: [-55, 0]
  const speedTrapX = ((-55 + mapExtent) / (mapExtent * 2)) * 100;
  const speedTrapY = 50;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-6 overflow-hidden select-none">
      {/* 1. TOP STATUS BAR & FAST NAVIGATION */}
      <header className="flex items-center justify-between w-full pointer-events-auto gap-4">
        {/* Brand & Vehicle Profile Pill */}
        <div className="flex items-center gap-3 bg-[#071A2B]/85 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-lg">
          <div className="flex items-center gap-1.5">
            <span className="text-base sm:text-lg font-extrabold tracking-tight text-white font-display">
              MANIFOLD WORLD
            </span>
            <span className="w-2 h-2 rounded-full bg-[#EF233C]" />
          </div>

          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-white/15">
            <span className="text-xs font-bold text-emerald-400">
              {currentProfile.name}
            </span>
            <span className="text-[10px] text-gray-400">
              ({currentProfile.category})
            </span>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-2">
          {/* Vehicle Garage Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowGarageDropdown(!showGarageDropdown)}
              className="flex items-center gap-2 px-3 py-2 bg-[#071A2B]/90 hover:bg-[#0b243d] text-white text-xs font-bold uppercase tracking-wider rounded-xl border border-white/15 backdrop-blur-md shadow-lg transition-colors"
              title="Select Vehicle Type"
            >
              <CarIcon className="w-4 h-4 text-[#EF233C]" />
              <span className="hidden sm:inline">Garage</span>
              <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
                {selectedVehicleType === 'SPORTS_COUPE'
                  ? 'Coupe'
                  : selectedVehicleType === 'LUXURY_SUV'
                  ? 'SUV'
                  : selectedVehicleType === 'EXECUTIVE_SEDAN'
                  ? 'Sedan'
                  : '4x4'}
              </span>
            </button>

            {/* Garage Dropdown Menu */}
            {showGarageDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-[#071A2B]/95 backdrop-blur-xl border border-white/20 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Select Player Vehicle
                  </span>
                </div>
                {vehicleOptions.map((v) => (
                  <button
                    key={v.type}
                    onClick={() => {
                      onSelectVehicleType(v.type);
                      setShowGarageDropdown(false);
                      engineAudio.playChime(640);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex flex-col ${
                      selectedVehicleType === v.type
                        ? 'bg-[#EF233C] text-white shadow-md'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-bold">{v.label}</span>
                    <span className={`text-[10px] ${selectedVehicleType === v.type ? 'text-white/80' : 'text-gray-400'}`}>
                      {v.desc}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Jump to Real Marketplace */}
          <button
            onClick={onEnterMarketplace}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#EF233C] hover:bg-[#d90429] text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95"
            title="Go to Real Car Marketplace (/car-marketplace)"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Marketplace</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </button>

          {/* Controls Help Toggle */}
          <button
            onClick={() => setShowControlsHelp(!showControlsHelp)}
            className="p-2.5 bg-[#071A2B]/80 hover:bg-[#071A2B] text-gray-300 hover:text-white rounded-xl border border-white/10 backdrop-blur-md transition-colors"
            title="Controls & Keys"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Time of Day Cycle (Daylight Default) */}
          <div className="hidden sm:flex items-center bg-[#071A2B]/80 backdrop-blur-md p-1 rounded-xl border border-white/10">
            <button
              onClick={() => onTimeOfDayChange('DAYLIGHT')}
              className={`p-1.5 rounded-lg transition-colors ${
                timeOfDay === 'DAYLIGHT' ? 'bg-amber-400 text-slate-900 shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
              title="Bright Daylight (Default)"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => onTimeOfDayChange('GOLDEN_HOUR')}
              className={`p-1.5 rounded-lg transition-colors ${
                timeOfDay === 'GOLDEN_HOUR' ? 'bg-amber-500/30 text-amber-300' : 'text-gray-400 hover:text-white'
              }`}
              title="Golden Hour"
            >
              <Sunset className="w-4 h-4" />
            </button>
            <button
              onClick={() => onTimeOfDayChange('SUNSET')}
              className={`p-1.5 rounded-lg transition-colors ${
                timeOfDay === 'SUNSET' ? 'bg-rose-500/30 text-rose-300' : 'text-gray-400 hover:text-white'
              }`}
              title="Sunset Dusk"
            >
              <Sunset className="w-4 h-4" />
            </button>
            <button
              onClick={() => onTimeOfDayChange('MIDNIGHT')}
              className={`p-1.5 rounded-lg transition-colors ${
                timeOfDay === 'MIDNIGHT' ? 'bg-blue-500/30 text-blue-300' : 'text-gray-400 hover:text-white'
              }`}
              title="Midnight Track"
            >
              <Moon className="w-4 h-4" />
            </button>
          </div>

          {/* Audio Engine Mute */}
          <button
            onClick={toggleSound}
            className={`p-2.5 rounded-xl border backdrop-blur-md transition-colors ${
              isMuted
                ? 'bg-red-500/20 border-red-500/40 text-red-300'
                : 'bg-[#071A2B]/80 border-white/10 text-gray-300 hover:text-white'
            }`}
            title={isMuted ? 'Unmute Engine Sound' : 'Mute Engine Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Customizer Button */}
          <button
            onClick={onOpenCustomizer}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#071A2B]/80 hover:bg-[#071A2B] text-gray-200 hover:text-white text-xs font-semibold rounded-xl border border-white/10 backdrop-blur-md transition-colors"
          >
            <Palette className="w-4 h-4 text-[#EF233C]" />
            <span className="hidden md:inline">Paint & Tuning</span>
          </button>
        </div>
      </header>

      {/* 2. CONTROLS HELPER MODAL POPUP */}
      {showControlsHelp && (
        <div className="pointer-events-auto self-center bg-[#071A2B]/95 backdrop-blur-xl border border-white/15 p-6 rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#EF233C]" />
              Vehicle & World Controls
            </h3>
            <button
              onClick={() => setShowControlsHelp(false)}
              className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded"
            >
              Close [ESC]
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
            <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
              <span className="font-bold text-[#EF233C] block mb-1">W / Arrow Up</span>
              <span className="text-gray-300">Throttle & Accelerate</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
              <span className="font-bold text-[#EF233C] block mb-1">S / Arrow Down</span>
              <span className="text-gray-300">Brake & Reverse Gear</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
              <span className="font-bold text-[#EF233C] block mb-1">A / D or Left / Right</span>
              <span className="text-gray-300">Steer Wheels</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
              <span className="font-bold text-[#EF233C] block mb-1">Spacebar</span>
              <span className="text-gray-300">Handbrake Drift</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
              <span className="font-bold text-white block mb-1">E</span>
              <span className="text-gray-300">Interact with Gate / Cars</span>
            </div>
            <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
              <span className="font-bold text-white block mb-1">C</span>
              <span className="text-gray-300">Tuning & Paint Studio</span>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-gray-400 text-center">
            Click anywhere in the 3D world to activate procedural audio synthesis.
          </p>
        </div>
      )}

      {/* 3. SPEED TRAP NOTIFICATION BANNER */}
      {speedTrapRecord && (
        <div className="self-center bg-[#10b981]/90 backdrop-blur-md border border-[#10b981] px-6 py-2.5 rounded-xl shadow-2xl animate-bounce">
          <p className="text-xs font-extrabold uppercase tracking-widest text-black flex items-center gap-2">
            <span>⚡ SPEED TRAP RECORDED:</span>
            <span className="text-base font-black font-mono tabular-nums">{speedTrapRecord} KM/H</span>
          </p>
        </div>
      )}

      {/* 4. PROXIMITY INTERACTIVE ACTION PROMPT */}
      {activeZone && (
        <div className="pointer-events-auto self-center bg-[#071A2B]/90 backdrop-blur-xl border border-[#EF233C] px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 transition-all">
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
                ? 'Modify metallic paint, rims, and brake caliper finishes'
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

      {/* 5. BOTTOM HUD BAR: TELEMETRY & CONTROLS + MINIMAP */}
      <footer className="flex items-end justify-between w-full pointer-events-auto gap-4">
        {/* Left: Camera Selector & Navigation Mini-Compass */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 bg-[#071A2B]/85 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-lg">
            <div className="px-2 py-1 text-gray-400 text-xs font-bold uppercase flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cam</span>
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
          <div className="hidden sm:flex items-center gap-2 bg-[#071A2B]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-gray-400 font-mono">
            <span>TOP: {Math.round(currentProfile.maxSpeed * 4.6)} KM/H</span>
            <span>•</span>
            <span>ACCEL: {currentProfile.acceleration} M/S²</span>
            <span>•</span>
            <span>REDLINE: {currentProfile.redlineRpm} RPM</span>
          </div>
        </div>

        {/* Mobile Virtual Touch Controls */}
        <div className="flex sm:hidden items-center gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onTouchStart={() => handleTouch('left', true)}
                onTouchEnd={() => handleTouch('left', false)}
                className="w-12 h-12 bg-[#071A2B]/90 active:bg-[#EF233C] text-white rounded-xl border border-white/20 flex items-center justify-center font-bold text-lg"
              >
                ◀
              </button>
              <button
                onTouchStart={() => handleTouch('right', true)}
                onTouchEnd={() => handleTouch('right', false)}
                className="w-12 h-12 bg-[#071A2B]/90 active:bg-[#EF233C] text-white rounded-xl border border-white/20 flex items-center justify-center font-bold text-lg"
              >
                ▶
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onTouchStart={() => handleTouch('forward', true)}
              onTouchEnd={() => handleTouch('forward', false)}
              className="w-12 h-12 bg-[#071A2B]/90 active:bg-[#10b981] text-white rounded-xl border border-white/20 flex items-center justify-center font-bold text-lg"
            >
              ▲
            </button>
            <button
              onTouchStart={() => handleTouch('backward', true)}
              onTouchEnd={() => handleTouch('backward', false)}
              className="w-12 h-12 bg-[#071A2B]/90 active:bg-[#EF233C] text-white rounded-xl border border-white/20 flex items-center justify-center font-bold text-lg"
            >
              ▼
            </button>
          </div>
        </div>

        {/* Center: Interactive High-Precision Minimap Radar */}
        <div className="hidden lg:flex flex-col items-center bg-[#071A2B]/85 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-2xl">
          <div className="w-32 h-32 relative rounded-xl bg-slate-900/90 overflow-hidden border border-white/15">
            {/* Track boundary ring outline */}
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
