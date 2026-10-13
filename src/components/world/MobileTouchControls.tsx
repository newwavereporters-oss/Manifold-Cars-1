import React from 'react';
import {
  Volume2,
  Power,
  Lightbulb,
  AlertTriangle,
  Camera,
  Sliders,
  Zap,
} from 'lucide-react';
import { HeadlightState } from './CockpitDashboardOverlay';
import { CameraViewMode } from './WorldCanvas';
import { AudioDriveMode } from '../../utils/engineAudio';

interface MobileTouchControlsProps {
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
}) => {
  const triggerHaptic = (duration = 15) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {}
    }
  };

  const handleTouch = (key: 'forward' | 'backward' | 'left' | 'right' | 'handbrake', active: boolean) => {
    if (active) triggerHaptic(12);
    onVirtualInput({
      ...virtualInputState,
      [key]: active,
    });
  };

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none z-35 flex flex-col justify-end p-3 pb-6 select-none md:hidden">
      {/* Mobile Top Quick Actions Strip */}
      <div className="flex items-center justify-between w-full mb-3 px-1 pointer-events-auto">
        <div className="flex items-center gap-1.5 bg-[#071A2B]/85 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-lg">
          {/* Engine Ignition */}
          <button
            onClick={() => {
              triggerHaptic(25);
              onToggleEngine();
            }}
            className={`p-2 rounded-xl transition-all ${
              isEngineRunning
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'bg-white/10 text-gray-400'
            }`}
            title="Ignition Engine Start/Stop"
          >
            <Power className="w-4 h-4" />
          </button>

          {/* Headlights */}
          <button
            onClick={() => {
              triggerHaptic(15);
              onCycleHeadlights();
            }}
            className={`p-2 rounded-xl transition-all ${
              headlightState === 'HIGH'
                ? 'bg-blue-500 text-white shadow-md'
                : headlightState === 'LOW'
                ? 'bg-emerald-500 text-white'
                : 'bg-white/10 text-gray-400'
            }`}
            title="Headlights"
          >
            <Lightbulb className="w-4 h-4" />
          </button>

          {/* Hazard Lights */}
          <button
            onClick={() => {
              triggerHaptic(15);
              onToggleHazard();
            }}
            className={`p-2 rounded-xl transition-all ${
              hazardLights ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 text-gray-400'
            }`}
            title="Hazards"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>

          {/* Horn */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              triggerHaptic(20);
              onHornDown();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              onHornUp();
            }}
            onMouseDown={onHornDown}
            onMouseUp={onHornUp}
            className="p-2 rounded-xl bg-white/10 active:bg-yellow-400 active:text-black text-yellow-400 transition-all"
            title="Horn"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 bg-[#071A2B]/85 backdrop-blur-md p-1 rounded-2xl border border-white/10 shadow-lg">
          {/* Drive Mode Quick Switcher */}
          <button
            onClick={() => {
              triggerHaptic(15);
              onCycleDriveMode();
            }}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 text-[10px] font-black uppercase text-white flex items-center gap-1"
          >
            <Sliders className="w-3 h-3 text-[#EF233C]" />
            <span>{driveMode}</span>
          </button>

          {/* Camera View Switcher */}
          <button
            onClick={() => {
              triggerHaptic(15);
              onCycleCamera();
            }}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 text-[10px] font-black uppercase text-white flex items-center gap-1"
          >
            <Camera className="w-3 h-3 text-blue-400" />
            <span>{cameraMode}</span>
          </button>
        </div>
      </div>

      {/* Main Driving Controls: Left Steering thumb cluster & Right Pedals thumb cluster */}
      <div className="flex items-end justify-between w-full pointer-events-auto px-1">
        {/* Left Thumb: Steering Wheels Controls */}
        <div className="flex items-center gap-2">
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              handleTouch('left', true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleTouch('left', false);
            }}
            className={`w-16 h-16 rounded-2xl border transition-all flex items-center justify-center font-black text-2xl shadow-2xl ${
              virtualInputState.left
                ? 'bg-[#EF233C] border-[#EF233C] text-white scale-95 shadow-[#EF233C]/40'
                : 'bg-[#071A2B]/90 backdrop-blur-md border-white/20 text-white'
            }`}
            title="Steer Left"
          >
            ◀
          </button>

          <button
            onTouchStart={(e) => {
              e.preventDefault();
              handleTouch('right', true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleTouch('right', false);
            }}
            className={`w-16 h-16 rounded-2xl border transition-all flex items-center justify-center font-black text-2xl shadow-2xl ${
              virtualInputState.right
                ? 'bg-[#EF233C] border-[#EF233C] text-white scale-95 shadow-[#EF233C]/40'
                : 'bg-[#071A2B]/90 backdrop-blur-md border-white/20 text-white'
            }`}
            title="Steer Right"
          >
            ▶
          </button>
        </div>

        {/* Handbrake / Drift Pill (Center-Right) */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            handleTouch('handbrake', true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleTouch('handbrake', false);
          }}
          className={`px-3 py-3 rounded-2xl border transition-all flex items-center justify-center font-black text-[11px] uppercase tracking-wider shadow-2xl ${
            virtualInputState.handbrake
              ? 'bg-amber-500 border-amber-500 text-black scale-95 shadow-amber-500/40'
              : 'bg-[#071A2B]/90 backdrop-blur-md border-white/20 text-amber-400'
          }`}
          title="Handbrake Drift"
        >
          DRIFT
        </button>

        {/* Right Thumb: Sport Pedals (Brake/Reverse & Gas Throttle) */}
        <div className="flex items-end gap-2.5">
          {/* Brake / Reverse Pedal */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              handleTouch('backward', true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleTouch('backward', false);
            }}
            className={`w-14 h-20 rounded-2xl border transition-all flex flex-col items-center justify-center font-black text-sm uppercase shadow-2xl ${
              virtualInputState.backward
                ? 'bg-red-600 border-red-600 text-white scale-95 shadow-red-600/40'
                : 'bg-[#071A2B]/90 backdrop-blur-md border-white/20 text-red-400'
            }`}
            title="Brake / Reverse Pedal"
          >
            <span className="text-lg">▼</span>
            <span className="text-[9px] font-mono mt-1">BRAKE</span>
          </button>

          {/* Gas Throttle Pedal */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              handleTouch('forward', true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleTouch('forward', false);
            }}
            className={`w-16 h-24 rounded-2xl border transition-all flex flex-col items-center justify-center font-black text-base uppercase shadow-2xl ${
              virtualInputState.forward
                ? 'bg-emerald-500 border-emerald-500 text-black scale-95 shadow-emerald-500/50'
                : 'bg-gradient-to-t from-[#071A2B]/95 to-slate-800/90 backdrop-blur-md border-emerald-500/50 text-emerald-400 shadow-lg'
            }`}
            title="Throttle Accelerate Pedal"
          >
            <span className="text-2xl">▲</span>
            <span className="text-[10px] font-mono mt-1 font-black tracking-widest text-white">
              GAS
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
