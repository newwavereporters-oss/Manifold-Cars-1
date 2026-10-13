import React, { useRef, useEffect } from 'react';
import {
  Volume2,
  Power,
  Lightbulb,
  AlertTriangle,
  Camera,
  Sliders,
} from 'lucide-react';
import { HeadlightState } from './CockpitDashboardOverlay';
import { CameraViewMode } from './WorldCanvas';
import { engineAudio, AudioDriveMode } from '../../utils/engineAudio';

export interface MobileTouchControlsProps {
  onVirtualInput: (input: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    handbrake: boolean;
  }) => void;
  virtualInputState: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    handbrake: boolean;
  };
  isEngineRunning: boolean;
  onToggleEngine: () => void;
  headlightState: HeadlightState;
  onCycleHeadlights: () => void;
  hazardLights: boolean;
  onToggleHazard: () => void;
  onHornDown: () => void;
  onHornUp: () => void;
  cameraMode: CameraViewMode;
  onCycleCamera: () => void;
  driveMode: AudioDriveMode;
  onCycleDriveMode: () => void;
  speedKmh?: number;
  gear?: string;
  rpm?: number;
}

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  onVirtualInput,
  virtualInputState,
  isEngineRunning,
  onToggleEngine,
  headlightState,
  onCycleHeadlights,
  hazardLights,
  onToggleHazard,
  onHornDown,
  onHornUp,
  cameraMode,
  onCycleCamera,
  driveMode,
  onCycleDriveMode,
  speedKmh = 0,
  gear = 'P',
}) => {
  // Direct mutable ref to track simultaneous multi-touch states (e.g. thumb 1 steering, thumb 2 throttle)
  const activeKeysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
  });

  // Keep ref synchronized with incoming parent state if modified externally
  useEffect(() => {
    activeKeysRef.current = { ...virtualInputState };
  }, [virtualInputState]);

  // Window blur release safety
  useEffect(() => {
    const handleReleaseAll = () => {
      const keys = activeKeysRef.current;
      if (keys.forward || keys.backward || keys.left || keys.right || keys.handbrake) {
        activeKeysRef.current = {
          forward: false,
          backward: false,
          left: false,
          right: false,
          handbrake: false,
        };
        onVirtualInput({ ...activeKeysRef.current });
      }
    };

    window.addEventListener('blur', handleReleaseAll);
    return () => {
      window.removeEventListener('blur', handleReleaseAll);
    };
  }, [onVirtualInput]);

  const triggerHaptic = (duration = 15) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {}
    }
  };

  const setKeyActive = (
    key: 'forward' | 'backward' | 'left' | 'right' | 'handbrake',
    active: boolean
  ) => {
    if (activeKeysRef.current[key] === active) return;
    activeKeysRef.current[key] = active;

    if (active) {
      triggerHaptic(18);
      // Ensure Web Audio context is initialized on first user touch gesture
      engineAudio.init();
    }

    onVirtualInput({
      ...activeKeysRef.current,
      [key]: active,
    });
  };

  // Helper factory that creates bulletproof touch and pointer listeners
  const bindControl = (key: 'forward' | 'backward' | 'left' | 'right' | 'handbrake') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      setKeyActive(key, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setKeyActive(key, false);
    },
    onPointerCancel: (e: React.PointerEvent) => {
      e.preventDefault();
      setKeyActive(key, false);
    },
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault();
      setKeyActive(key, true);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault();
      setKeyActive(key, false);
    },
    onTouchCancel: (e: React.TouchEvent) => {
      e.preventDefault();
      setKeyActive(key, false);
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
    },
    style: {
      touchAction: 'none' as const,
      userSelect: 'none' as const,
      WebkitUserSelect: 'none' as const,
    },
  });

  const isLeftActive = activeKeysRef.current.left || virtualInputState.left;
  const isRightActive = activeKeysRef.current.right || virtualInputState.right;
  const isForwardActive = activeKeysRef.current.forward || virtualInputState.forward;
  const isBackwardActive = activeKeysRef.current.backward || virtualInputState.backward;
  const isHandbrakeActive = activeKeysRef.current.handbrake || virtualInputState.handbrake;

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none z-30 flex flex-col justify-end p-2 sm:p-3 pb-4 select-none touch-none">
      {/* Mobile Top Quick Actions Strip */}
      <div className="flex items-center justify-between w-full mb-2.5 px-1 pointer-events-auto">
        {/* Left Systems Bar */}
        <div className="flex items-center gap-1.5 bg-[#071A2B]/90 backdrop-blur-md p-1 rounded-2xl border border-white/15 shadow-xl">
          {/* Engine Ignition */}
          <button
            onClick={() => {
              triggerHaptic(25);
              engineAudio.init();
              onToggleEngine();
            }}
            className={`p-2 sm:p-2.5 rounded-xl transition-all ${
              isEngineRunning
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/40 ring-1 ring-red-400'
                : 'bg-white/10 text-gray-400 hover:text-white'
            }`}
            title="Ignition Engine Start/Stop"
          >
            <Power className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Headlights */}
          <button
            onClick={() => {
              triggerHaptic(15);
              onCycleHeadlights();
            }}
            className={`p-2 sm:p-2.5 rounded-xl transition-all ${
              headlightState === 'HIGH'
                ? 'bg-blue-500 text-white shadow-md'
                : headlightState === 'LOW'
                ? 'bg-emerald-500 text-white'
                : 'bg-white/10 text-gray-400'
            }`}
            title="Headlights"
          >
            <Lightbulb className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Hazard Lights */}
          <button
            onClick={() => {
              triggerHaptic(15);
              onToggleHazard();
            }}
            className={`p-2 sm:p-2.5 rounded-xl transition-all ${
              hazardLights ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 text-gray-400'
            }`}
            title="Hazards"
          >
            <AlertTriangle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Dual Horn */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              triggerHaptic(25);
              engineAudio.init();
              onHornDown();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              onHornUp();
            }}
            onPointerCancel={onHornUp}
            onTouchStart={(e) => {
              e.preventDefault();
              triggerHaptic(25);
              engineAudio.init();
              onHornDown();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              onHornUp();
            }}
            onTouchCancel={onHornUp}
            className="p-2 sm:p-2.5 rounded-xl bg-white/10 active:bg-yellow-400 active:text-black text-yellow-400 transition-all select-none"
            title="Horn"
          >
            <Volume2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>

        {/* Center: Live Mobile Telemetry Cluster */}
        <div className="flex items-center gap-2 bg-[#071A2B]/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/15 shadow-xl">
          <span className="text-xs font-black text-[#EF233C] font-mono">{gear}</span>
          <span className="w-px h-3 bg-white/20" />
          <div className="flex items-baseline gap-0.5 font-mono">
            <span className="text-sm font-black text-white tabular-nums">{speedKmh}</span>
            <span className="text-[8px] text-gray-400 font-bold uppercase">KM/H</span>
          </div>
        </div>

        {/* Right Settings Bar */}
        <div className="flex items-center gap-1.5 bg-[#071A2B]/90 backdrop-blur-md p-1 rounded-2xl border border-white/15 shadow-xl">
          {/* Drive Mode Quick Switcher */}
          <button
            onClick={() => {
              triggerHaptic(15);
              onCycleDriveMode();
            }}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 text-[10px] font-black uppercase text-white flex items-center gap-1 active:bg-white/20 transition-all"
            title="Drive Mode"
          >
            <Sliders className="w-3.5 h-3.5 text-[#EF233C]" />
            <span>{driveMode}</span>
          </button>

          {/* Camera View Switcher */}
          <button
            onClick={() => {
              triggerHaptic(15);
              onCycleCamera();
            }}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 text-[10px] font-black uppercase text-white flex items-center gap-1 active:bg-white/20 transition-all"
            title="Camera View"
          >
            <Camera className="w-3.5 h-3.5 text-blue-400" />
            <span>{cameraMode}</span>
          </button>
        </div>
      </div>

      {/* Main Driving Controls: Left Steering Thumb Cluster & Right Pedals Thumb Cluster */}
      <div className="flex items-end justify-between w-full pointer-events-auto px-1 gap-2">
        {/* Left Thumb: Steering Controls */}
        <div className="flex items-center gap-2.5">
          {/* Steer Left Button */}
          <button
            {...bindControl('left')}
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 transition-all flex flex-col items-center justify-center font-black text-2xl shadow-2xl active:scale-95 ${
              isLeftActive
                ? 'bg-[#EF233C] border-[#EF233C] text-white scale-95 shadow-[#EF233C]/60 ring-4 ring-[#EF233C]/30'
                : 'bg-[#071A2B]/95 backdrop-blur-md border-white/25 text-white active:bg-white/20'
            }`}
            title="Steer Left"
          >
            <span>◀</span>
            <span className="text-[9px] font-mono opacity-60 mt-0.5 tracking-wider">LEFT</span>
          </button>

          {/* Steer Right Button */}
          <button
            {...bindControl('right')}
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 transition-all flex flex-col items-center justify-center font-black text-2xl shadow-2xl active:scale-95 ${
              isRightActive
                ? 'bg-[#EF233C] border-[#EF233C] text-white scale-95 shadow-[#EF233C]/60 ring-4 ring-[#EF233C]/30'
                : 'bg-[#071A2B]/95 backdrop-blur-md border-white/25 text-white active:bg-white/20'
            }`}
            title="Steer Right"
          >
            <span>▶</span>
            <span className="text-[9px] font-mono opacity-60 mt-0.5 tracking-wider">RIGHT</span>
          </button>
        </div>

        {/* Handbrake / Drift Pill (Center) */}
        <div className="pb-1">
          <button
            {...bindControl('handbrake')}
            className={`px-3.5 py-3 sm:px-4 sm:py-3.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center font-black text-[11px] sm:text-xs uppercase tracking-wider shadow-2xl active:scale-95 ${
              isHandbrakeActive
                ? 'bg-amber-500 border-amber-500 text-black scale-95 shadow-amber-500/60 ring-4 ring-amber-400/30'
                : 'bg-[#071A2B]/95 backdrop-blur-md border-white/25 text-amber-400 active:bg-white/20'
            }`}
            title="Handbrake Drift"
          >
            <span>DRIFT</span>
            <span className="text-[8px] font-mono opacity-70">BRAKE</span>
          </button>
        </div>

        {/* Right Thumb: Sport Pedals (Brake/Reverse & Gas Throttle) */}
        <div className="flex items-end gap-3">
          {/* Brake / Reverse Pedal */}
          <button
            {...bindControl('backward')}
            className={`w-16 h-20 sm:w-18 sm:h-24 rounded-2xl border-2 transition-all flex flex-col items-center justify-center font-black uppercase shadow-2xl active:scale-95 ${
              isBackwardActive
                ? 'bg-red-600 border-red-500 text-white scale-95 shadow-red-600/70 ring-4 ring-red-500/30'
                : 'bg-[#071A2B]/95 backdrop-blur-md border-white/25 text-red-400 active:bg-white/20'
            }`}
            title="Brake / Reverse Pedal"
          >
            <span className="text-xl sm:text-2xl leading-none">▼</span>
            <span className="text-[10px] sm:text-[11px] font-mono mt-1.5 font-black tracking-wider">
              BRAKE
            </span>
            <span className="text-[8px] font-mono opacity-60">REV</span>
          </button>

          {/* Gas Throttle Pedal */}
          <button
            {...bindControl('forward')}
            className={`w-18 h-24 sm:w-20 sm:h-28 rounded-2xl border-2 transition-all flex flex-col items-center justify-center font-black uppercase shadow-2xl active:scale-95 ${
              isForwardActive
                ? 'bg-emerald-500 border-emerald-400 text-black scale-95 shadow-emerald-500/70 ring-4 ring-emerald-400/40'
                : 'bg-gradient-to-t from-[#071A2B]/95 via-slate-800/90 to-slate-700/80 backdrop-blur-md border-emerald-500/60 text-emerald-400 active:bg-emerald-900/40'
            }`}
            title="Throttle Accelerate Pedal"
          >
            <span className="text-2xl sm:text-3xl leading-none">▲</span>
            <span className="text-xs sm:text-sm font-mono mt-1.5 font-black tracking-widest text-white">
              GAS
            </span>
            <span className="text-[8px] font-mono text-emerald-300 font-bold">DRIVE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
