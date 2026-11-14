import React, { useRef, useEffect, useCallback } from 'react';
import { CameraViewMode } from './WorldCanvas';
import { TransmissionGear, TRANSMISSION_GEAR_ORDER } from './worldModels';
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
  selectedGear: TransmissionGear;
  onSelectGear: (gear: TransmissionGear) => void;
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

const GEAR_SHORT_LABELS: Record<TransmissionGear, { badge: string; pedalHint: string }> = {
  P: { badge: 'P', pedalHint: 'PARKED' },
  D0: { badge: 'D0', pedalHint: 'SLOW' },
  D2: { badge: 'D2', pedalHint: 'DRIVE' },
  D1: { badge: 'D1', pedalHint: 'FAST' },
  R: { badge: 'R', pedalHint: 'REV' },
};

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  onVirtualInput,
  virtualInputState,
  cameraMode,
  driveMode,
  selectedGear,
  onSelectGear,
  speedKmh = 0,
  disabled = false,
}) => {
  // Stable callback ref prevents per-frame parent re-renders (speed/GPS telemetry)
  // from recreating releaseAllControls and clearing active touch pointers.
  const onVirtualInputRef = useRef(onVirtualInput);
  onVirtualInputRef.current = onVirtualInput;

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
    onVirtualInputRef.current(next);
  }, []);

  const releaseAllControls = useCallback(() => {
    (Object.keys(activePointersRef.current) as VirtualControlKey[]).forEach((k) => {
      activePointersRef.current[k].clear();
    });
    const prev = activeKeysRef.current;
    if (prev.forward || prev.backward || prev.left || prev.right || prev.handbrake) {
      activeKeysRef.current = { ...EMPTY_INPUT };
      onVirtualInputRef.current({ ...EMPTY_INPUT });
    }
  }, []);

  // Global safety cleanup on blur, visibility change, or stray window pointer release
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) releaseAllControls();
    };
    const handleWindowPointerEnd = (ev: PointerEvent) => {
      let changed = false;
      (Object.keys(activePointersRef.current) as VirtualControlKey[]).forEach((k) => {
        if (activePointersRef.current[k].delete(ev.pointerId)) {
          changed = true;
        }
      });
      if (changed) emitSnapshot();
    };

    window.addEventListener('blur', releaseAllControls);
    window.addEventListener('pointerup', handleWindowPointerEnd, { passive: true });
    window.addEventListener('pointercancel', handleWindowPointerEnd, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('blur', releaseAllControls);
      window.removeEventListener('pointerup', handleWindowPointerEnd);
      window.removeEventListener('pointercancel', handleWindowPointerEnd);
      document.removeEventListener('visibilitychange', handleVisibility);
      releaseAllControls();
    };
  }, [releaseAllControls, emitSnapshot]);

  // Release stuck holds only when camera switches or controls become disabled
  useEffect(() => {
    releaseAllControls();
  }, [cameraMode, disabled, releaseAllControls]);

  const showDriftButton =
    selectedGear !== 'P' &&
    selectedGear !== 'R' &&
    (driveMode === 'DRIFT' ||
      driveMode === 'TRACK' ||
      (driveMode === 'SPORT' && speedKmh >= 18));

  // Release handbrake cleanly if Drift button hides due to mode/speed/gear shift
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
      e.stopPropagation();
      activePointersRef.current[key].delete(e.pointerId);
      emitSnapshot();
    },
    onLostPointerCapture: (e: React.PointerEvent<HTMLButtonElement>) => {
      activePointersRef.current[key].delete(e.pointerId);
      emitSnapshot();
    },
    onTouchStart: (e: React.TouchEvent) => {
      e.stopPropagation();
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
  const gearMeta = GEAR_SHORT_LABELS[selectedGear];

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 pointer-events-none select-none touch-none pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]"
      aria-label="Mobile Driving Controls"
    >
      <div className="flex items-end justify-between w-full max-w-5xl mx-auto gap-2">
        {/* LEFT THUMB ZONE: STEERING */}
        <div
          className="pointer-events-auto flex items-center gap-2.5 sm:gap-3"
          onPointerDown={(e) => e.stopPropagation()}
        >
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

        {/* RIGHT THUMB ZONE: COMPACT GEAR STRIP + PEDALS */}
        <div
          className="pointer-events-auto flex flex-col items-end gap-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Compact Transmission Selector Strip (P / D0 / D2 / D1 / R) */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl bg-[#071A2B]/90 backdrop-blur-md border border-white/20 shadow-xl"
            role="group"
            aria-label="Transmission Gear Selector"
          >
            {TRANSMISSION_GEAR_ORDER.map((gear) => {
              const active = selectedGear === gear;
              const activeStyle =
                gear === 'P'
                  ? 'bg-slate-200 text-slate-950'
                  : gear === 'R'
                  ? 'bg-red-500 text-white'
                  : gear === 'D1'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-emerald-400 text-slate-950';
              return (
                <button
                  key={gear}
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    triggerHaptic(10);
                    onSelectGear(gear);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className={`min-w-[34px] h-[34px] sm:min-w-[38px] sm:h-[36px] px-1.5 rounded-lg font-mono text-[11px] font-black tracking-tight transition-colors whitespace-nowrap shrink-0 flex items-center justify-center ${
                    active ? activeStyle : 'text-slate-300 hover:bg-white/10'
                  }`}
                  aria-pressed={active}
                  aria-label={`Gear ${gear}`}
                >
                  {gear}
                </button>
              );
            })}
          </div>

          <div className="flex items-end gap-2 sm:gap-3">
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
              aria-label="Brake"
            >
              <span className="text-lg sm:text-xl leading-none font-black">▼</span>
              <span className="text-[10px] sm:text-[11px] font-mono mt-1 font-black tracking-wider">
                BRAKE
              </span>
              <span className="text-[8px] font-mono opacity-65">STOP</span>
            </button>

            <button
              type="button"
              {...bindPointerControl('forward')}
              className={`w-[74px] h-[88px] sm:w-20 sm:h-28 rounded-2xl border-2 transition-transform duration-75 flex flex-col items-center justify-center shadow-2xl ${
                selectedGear === 'P'
                  ? 'bg-slate-800/80 border-slate-500/50 text-slate-400 opacity-75'
                  : isForwardActive
                  ? 'bg-emerald-500 border-emerald-200 text-slate-950 scale-95 ring-4 ring-emerald-400/40'
                  : 'bg-gradient-to-t from-[#071A2B]/92 via-slate-800/88 to-slate-700/80 backdrop-blur-md border-emerald-400/65 text-emerald-300'
              }`}
              aria-label={selectedGear === 'R' ? 'Reverse Throttle' : 'Gas Throttle'}
            >
              <span className="text-xl sm:text-2xl leading-none font-black">
                {selectedGear === 'R' ? '▼' : '▲'}
              </span>
              <span className="text-xs sm:text-sm font-mono mt-1 font-black tracking-widest text-white">
                {selectedGear === 'P' ? 'PARK' : selectedGear === 'R' ? 'REV' : 'GAS'}
              </span>
              <span className="text-[8px] font-mono text-emerald-300 font-bold">
                {gearMeta.pedalHint}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
