import React, { useRef, useEffect, useCallback } from 'react';
import { CameraViewMode } from './WorldCanvas';
import { TransmissionGear, TRANSMISSION_GEAR_ORDER } from './worldModels';
import { engineAudio, AudioDriveMode } from '../../utils/engineAudio';
import { SteeringWheelControl } from './SteeringWheelControl';
import { unifiedDrivingInput } from './unifiedDrivingInput';

type PedalControlKey = 'forward' | 'backward';

export interface VirtualDrivingInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
  steerAxis?: number;
}

export interface MobileTouchControlsProps {
  onVirtualInput: (input: VirtualDrivingInput) => void;
  virtualInputState: VirtualDrivingInput;
  cameraMode: CameraViewMode;
  driveMode?: AudioDriveMode;
  selectedGear: TransmissionGear;
  onSelectGear: (gear: TransmissionGear) => void;
  hornActive?: boolean;
  onHornDown?: () => void;
  onHornUp?: () => void;
  speedKmh?: number;
  disabled?: boolean;
  showPedals?: boolean;
}

const EMPTY_INPUT: VirtualDrivingInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
  steerAxis: 0,
};

const GEAR_PEDAL_HINTS: Record<TransmissionGear, string> = {
  P: 'PARKED',
  D0: 'SLOW',
  D2: 'DRIVE',
  D1: 'FAST',
  R: 'REV',
};

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  onVirtualInput,
  virtualInputState,
  cameraMode,
  selectedGear,
  onSelectGear,
  hornActive = false,
  onHornDown,
  onHornUp,
  disabled = false,
  showPedals = true,
}) => {
  const onVirtualInputRef = useRef(onVirtualInput);
  onVirtualInputRef.current = onVirtualInput;

  const onHornUpRef = useRef(onHornUp);
  onHornUpRef.current = onHornUp;

  // Per-pedal active pointer IDs guarantee true simultaneous multi-touch alongside SteeringWheelControl
  const activePointersRef = useRef<Record<PedalControlKey, Set<number>>>({
    forward: new Set(),
    backward: new Set(),
  });
  const activeKeysRef = useRef<VirtualDrivingInput>({ ...EMPTY_INPUT });

  const emitSnapshot = useCallback(() => {
    const forward = activePointersRef.current.forward.size > 0;
    const backward = activePointersRef.current.backward.size > 0;

    unifiedDrivingInput.setAllPedals({
      forward,
      backward,
      handbrake: false,
    });

    const next: VirtualDrivingInput = {
      forward,
      backward,
      left: false,
      right: false,
      handbrake: false,
      steerAxis: 0,
    };

    const prev = activeKeysRef.current;
    if (
      prev.forward === next.forward &&
      prev.backward === next.backward &&
      prev.handbrake === next.handbrake
    ) {
      return;
    }
    activeKeysRef.current = next;
    onVirtualInputRef.current(next);
  }, []);

  const releaseAllControls = useCallback(() => {
    (Object.keys(activePointersRef.current) as PedalControlKey[]).forEach((k) => {
      activePointersRef.current[k].clear();
    });
    unifiedDrivingInput.setAllPedals({
      forward: false,
      backward: false,
      handbrake: false,
    });
    const prev = activeKeysRef.current;
    if (prev.forward || prev.backward || prev.handbrake) {
      activeKeysRef.current = { ...EMPTY_INPUT };
      onVirtualInputRef.current({ ...EMPTY_INPUT });
    }
    onHornUpRef.current?.();
  }, []);

  // Global safety cleanup on blur, visibility change, or stray window pointer release
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) releaseAllControls();
    };
    const handleWindowPointerEnd = (ev: PointerEvent) => {
      let changed = false;
      (Object.keys(activePointersRef.current) as PedalControlKey[]).forEach((k) => {
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

  const triggerHaptic = (duration = 14) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {}
    }
  };

  const bindPointerControl = (key: PedalControlKey) => ({
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

  const isForwardActive = virtualInputState.forward;
  const isBackwardActive = virtualInputState.backward;
  const pedalHint = GEAR_PEDAL_HINTS[selectedGear] || 'DRIVE';

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 pointer-events-none select-none touch-none pb-[max(0.6rem,env(safe-area-inset-bottom))] [@media(max-height:480px)]:pb-2 pl-[max(0.65rem,env(safe-area-inset-left))] pr-[max(0.65rem,env(safe-area-inset-right))]"
      aria-label="Driving Controls"
    >
      <div className="flex items-end justify-between w-full max-w-6xl mx-auto gap-2">
        {/* LEFT ZONE: INTERACTIVE STEERING WHEEL WITH INTEGRATED CENTER HORN HUB */}
        <div
          className="pointer-events-auto flex flex-col items-start"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <SteeringWheelControl
            hornActive={hornActive}
            onHornDown={onHornDown}
            onHornUp={onHornUp}
            disabled={disabled}
          />
        </div>

        {/* RIGHT ZONE: TRANSMISSION GEAR STRIP + OPTIONAL ON-SCREEN PEDALS */}
        <div
          className="pointer-events-auto flex flex-col items-end gap-1.5 sm:gap-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Compact Transmission Selector Strip (P / D0 / D2 / D1 / R) */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl bg-[#071A2B]/96 border border-white/20 shadow-xl"
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
                  className={`min-w-[38px] h-[42px] sm:min-w-[42px] sm:h-[44px] [@media(max-height:480px)]:h-[36px] px-1.5 rounded-lg font-mono text-[11px] font-black tracking-tight transition-colors whitespace-nowrap shrink-0 flex items-center justify-center cursor-pointer ${
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

          {showPedals && (
            <div className="flex items-end gap-2 sm:gap-3">
              <button
                type="button"
                {...bindPointerControl('backward')}
                className={`w-[62px] h-[72px] sm:w-18 sm:h-24 [@media(max-height:480px)]:h-[62px] rounded-2xl border-2 transition-transform duration-75 flex flex-col items-center justify-center shadow-2xl cursor-pointer ${
                  isBackwardActive
                    ? 'bg-red-600 border-red-300 text-white scale-95 ring-4 ring-red-500/35'
                    : 'bg-[#071A2B]/94 border-white/25 text-red-400'
                }`}
                aria-label="Brake"
              >
                <span className="text-lg sm:text-xl leading-none font-black">▼</span>
                <span className="text-[10px] sm:text-[11px] font-mono mt-0.5 font-black tracking-wider">
                  BRAKE
                </span>
                <span className="text-[8px] font-mono opacity-65 [@media(max-height:480px)]:hidden">STOP</span>
              </button>

              <button
                type="button"
                {...bindPointerControl('forward')}
                className={`w-[72px] h-[84px] sm:w-20 sm:h-28 [@media(max-height:480px)]:h-[72px] rounded-2xl border-2 transition-transform duration-75 flex flex-col items-center justify-center shadow-2xl cursor-pointer ${
                  selectedGear === 'P'
                    ? 'bg-slate-800/94 border-slate-500/50 text-slate-400 opacity-80'
                    : isForwardActive
                    ? 'bg-emerald-500 border-emerald-200 text-slate-950 scale-95 ring-4 ring-emerald-400/40'
                    : 'bg-gradient-to-t from-[#071A2B] via-[#0d2a44] to-[#133859] border-emerald-400/70 text-emerald-300'
                }`}
                aria-label={selectedGear === 'R' ? 'Reverse Throttle' : 'Gas Throttle'}
              >
                <span className="text-xl sm:text-2xl leading-none font-black">
                  {selectedGear === 'R' ? '▼' : '▲'}
                </span>
                <span className="text-xs sm:text-sm font-mono mt-0.5 font-black tracking-widest text-white">
                  {selectedGear === 'P' ? 'PARK' : selectedGear === 'R' ? 'REV' : 'GAS'}
                </span>
                <span className="text-[8px] font-mono text-emerald-300 font-bold">
                  {pedalHint}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
