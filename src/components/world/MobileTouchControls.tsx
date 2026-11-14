import React, { useRef, useEffect, useCallback } from 'react';
import { CameraViewMode } from './WorldCanvas';
import { engineAudio, AudioDriveMode } from '../../utils/engineAudio';

type VirtualControlKey = 'forward' | 'backward' | 'left' | 'right' | 'handbrake';

export interface VirtualDrivingInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
}

export interface MobileTouchControlsProps {
  onVirtualInput: (input: VirtualDrivingInput) => void;
  virtualInputState: VirtualDrivingInput;
  cameraMode: CameraViewMode;
  driveMode: AudioDriveMode;
  speedKmh?: number;
  disabled?: boolean;
}

const EMPTY_INPUT: VirtualDrivingInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
};

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  onVirtualInput,
  virtualInputState,
  cameraMode,
  driveMode,
  speedKmh = 0,
  disabled = false,
}) => {
  // Per-control active pointer IDs guarantee true simultaneous multi-touch without cross-talk or stuck inputs
  const activePointersRef = useRef<Record<VirtualControlKey, Set<number>>>({
    forward: new Set(),
    backward: new Set(),
    left: new Set(),
    right: new Set(),
    handbrake: new Set(),
  });

  const activeKeysRef = useRef<VirtualDrivingInput>({ ...EMPTY_INPUT });

  const emitSnapshot = useCallback(() => {
    const next: VirtualDrivingInput = {
      forward: activePointersRef.current.forward.size > 0,
      backward: activePointersRef.current.backward.size > 0,
      left: activePointersRef.current.left.size > 0,
      right: activePointersRef.current.right.size > 0,
      handbrake: activePointersRef.current.handbrake.size > 0,
    };

    const prev = activeKeysRef.current;
    if (
      prev.forward === next.forward &&
      prev.backward === next.backward &&
      prev.left === next.left &&
      prev.right === next.right &&
      prev.handbrake === next.handbrake
    ) {
      return;
    }
    activeKeysRef.current = next;
    onVirtualInput(next);
  }, [onVirtualInput]);

  const releaseAllControls = useCallback(() => {
    (Object.keys(activePointersRef.current) as VirtualControlKey[]).forEach((k) => {
      activePointersRef.current[k].clear();
    });
    const prev = activeKeysRef.current;
    if (prev.forward || prev.backward || prev.left || prev.right || prev.handbrake) {
      activeKeysRef.current = { ...EMPTY_INPUT };
      onVirtualInput({ ...EMPTY_INPUT });
    }
  }, [onVirtualInput]);

  // Safety release on blur, tab hide, camera switch, or disable
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) releaseAllControls();
    };
    window.addEventListener('blur', releaseAllControls);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('blur', releaseAllControls);
      document.removeEventListener('visibilitychange', handleVisibility);
      releaseAllControls();
    };
  }, [releaseAllControls]);

  useEffect(() => {
    releaseAllControls();
  }, [cameraMode, disabled, releaseAllControls]);

  const showDriftButton =
    driveMode === 'DRIFT' ||
    driveMode === 'TRACK' ||
    (driveMode === 'SPORT' && speedKmh >= 18);

  // Release handbrake cleanly if Drift button hides due to mode/speed shift
  useEffect(() => {
    if (!showDriftButton && activePointersRef.current.handbrake.size > 0) {
      activePointersRef.current.handbrake.clear();
      emitSnapshot();
    }
  }, [showDriftButton, emitSnapshot]);

  const triggerHaptic = (duration = 14) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {}
    }
  };

  const bindPointerControl = (key: VirtualControlKey) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      const set = activePointersRef.current[key];
      const wasEmpty = set.size === 0;
      set.add(e.pointerId);
      if (wasEmpty) {
        triggerHaptic(14);
        engineAudio.init();
      }
      emitSnapshot();
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {}
      activePointersRef.current[key].delete(e.pointerId);
      emitSnapshot();
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      activePointersRef.current[key].delete(e.pointerId);
      emitSnapshot();
    },
    onLostPointerCapture: (e: React.PointerEvent<HTMLButtonElement>) => {
      activePointersRef.current[key].delete(e.pointerId);
      emitSnapshot();
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    style: {
      touchAction: 'none' as const,
      userSelect: 'none' as const,
      WebkitUserSelect: 'none' as const,
    },
  });

  if (disabled) return null;

  const isLeftActive = virtualInputState.left;
  const isRightActive = virtualInputState.right;
  const isForwardActive = virtualInputState.forward;
  const isBackwardActive = virtualInputState.backward;
  const isHandbrakeActive = virtualInputState.handbrake;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 pointer-events-none select-none touch-none pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]"
      aria-label="Mobile Driving Controls"
    >
      <div className="flex items-end justify-between w-full max-w-5xl mx-auto gap-2">
        {/* LEFT THUMB ZONE: STEERING */}
        <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            {...bindPointerControl('left')}
            className={`w-[66px] h-[66px] sm:w-20 sm:h-20 rounded-2xl border-2 transition-transform duration-75 flex flex-col items-center justify-center shadow-2xl ${
              isLeftActive
                ? 'bg-[#EF233C] border-red-300 text-white scale-95 ring-4 ring-[#EF233C]/30'
                : 'bg-[#071A2B]/85 backdrop-blur-md border-white/25 text-white'
            }`}
            aria-label="Steer Left"
          >
            <span className="text-xl sm:text-2xl leading-none font-black">◀</span>
            <span className="text-[9px] font-mono opacity-75 mt-1 tracking-wider font-bold">
              LEFT
            </span>
          </button>

          <button
            type="button"
            {...bindPointerControl('right')}
            className={`w-[66px] h-[66px] sm:w-20 sm:h-20 rounded-2xl border-2 transition-transform duration-75 flex flex-col items-center justify-center shadow-2xl ${
              isRightActive
                ? 'bg-[#EF233C] border-red-300 text-white scale-95 ring-4 ring-[#EF233C]/30'
                : 'bg-[#071A2B]/85 backdrop-blur-md border-white/25 text-white'
            }`}
            aria-label="Steer Right"
          >
            <span className="text-xl sm:text-2xl leading-none font-black">▶</span>
            <span className="text-[9px] font-mono opacity-75 mt-1 tracking-wider font-bold">
              RIGHT
            </span>
          </button>
        </div>

        {/* RIGHT THUMB ZONE: OPTIONAL DRIFT + BRAKE/REVERSE + GAS */}
        <div className="pointer-events-auto flex items-end gap-2 sm:gap-3">
          {showDriftButton && (
            <button
              type="button"
              {...bindPointerControl('handbrake')}
              className={`w-13 h-15 sm:w-16 sm:h-18 rounded-2xl border-2 transition-transform duration-75 flex flex-col items-center justify-center shadow-2xl ${
                isHandbrakeActive
                  ? 'bg-amber-400 border-amber-200 text-slate-950 scale-95 ring-4 ring-amber-400/35'
                  : 'bg-[#071A2B]/85 backdrop-blur-md border-amber-400/45 text-amber-300'
              }`}
              aria-label="Drift Handbrake"
            >
              <span className="text-[10px] sm:text-xs font-black tracking-wider">DRIFT</span>
            </button>
          )}

          <button
            type="button"
            {...bindPointerControl('backward')}
            className={`w-[64px] h-[74px] sm:w-18 sm:h-24 rounded-2xl border-2 transition-transform duration-75 flex flex-col items-center justify-center shadow-2xl ${
              isBackwardActive
                ? 'bg-red-600 border-red-300 text-white scale-95 ring-4 ring-red-500/35'
                : 'bg-[#071A2B]/88 backdrop-blur-md border-white/25 text-red-400'
            }`}
            aria-label="Brake and Reverse"
          >
            <span className="text-lg sm:text-xl leading-none font-black">▼</span>
            <span className="text-[10px] sm:text-[11px] font-mono mt-1 font-black tracking-wider">
              BRAKE
            </span>
            <span className="text-[8px] font-mono opacity-65">REV</span>
          </button>

          <button
            type="button"
            {...bindPointerControl('forward')}
            className={`w-[74px] h-[88px] sm:w-20 sm:h-28 rounded-2xl border-2 transition-transform duration-75 flex flex-col items-center justify-center shadow-2xl ${
              isForwardActive
                ? 'bg-emerald-500 border-emerald-200 text-slate-950 scale-95 ring-4 ring-emerald-400/40'
                : 'bg-gradient-to-t from-[#071A2B]/92 via-slate-800/88 to-slate-700/80 backdrop-blur-md border-emerald-400/65 text-emerald-300'
            }`}
            aria-label="Gas Throttle"
          >
            <span className="text-xl sm:text-2xl leading-none font-black">▲</span>
            <span className="text-xs sm:text-sm font-mono mt-1 font-black tracking-widest text-white">
              GAS
            </span>
            <span className="text-[8px] font-mono text-emerald-300 font-bold">DRIVE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
