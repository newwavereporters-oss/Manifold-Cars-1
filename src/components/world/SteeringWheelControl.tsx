import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { engineAudio } from '../../utils/engineAudio';
import {
  MAX_STEERING_WHEEL_DEG,
  clampSteeringWheelDeg,
  unwrapPointerAngleDelta,
} from './steeringWheelMath';
import { unifiedDrivingInput } from './unifiedDrivingInput';

export interface SteeringWheelControlProps {
  onSteerAxisChange?: (axis: number) => void;
  hornActive?: boolean;
  onHornDown?: () => void;
  onHornUp?: () => void;
  /** Optional external steer override (-1 right, 0 center, +1 left) */
  externalSteerHint?: number;
  disabled?: boolean;
  sizeClassName?: string;
}

export const SteeringWheelControl: React.FC<SteeringWheelControlProps> = ({
  onSteerAxisChange,
  hornActive = false,
  onHornDown,
  onHornUp,
  externalSteerHint = 0,
  disabled = false,
  sizeClassName = 'w-[144px] h-[144px] sm:w-[168px] sm:h-[168px] [@media(max-height:480px)]:w-[122px] [@media(max-height:480px)]:h-[122px]',
}) => {
  const wheelContainerRef = useRef<HTMLDivElement | null>(null);
  const activeDragPointerIdRef = useRef<number | null>(null);
  const activeDragPointerTypeRef = useRef<string | null>(null);
  const activeHornPointerIdRef = useRef<number | null>(null);
  const lastRawPointerDegRef = useRef<number | null>(null);
  const lastClientXRef = useRef<number>(0);
  const lastEmittedAxisRef = useRef<number>(0);

  const onSteerAxisChangeRef = useRef(onSteerAxisChange);
  onSteerAxisChangeRef.current = onSteerAxisChange;

  const onHornUpRef = useRef(onHornUp);
  onHornUpRef.current = onHornUp;

  const initialSnap = unifiedDrivingInput.getSnapshot();
  const [displayAngleDeg, setDisplayAngleDeg] = useState<number>(initialSnap.wheelAngleDeg);
  const [isDragging, setIsDragging] = useState<boolean>(initialSnap.isWheelDragging);

  const computePointerDegFromCenter = useCallback(
    (clientX: number, clientY: number): { rawDeg: number | null; dist: number } => {
      const el = wheelContainerRef.current;
      if (!el) return { rawDeg: null, dist: 0 };
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < 14) {
        return { rawDeg: null, dist };
      }
      return {
        rawDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
        dist,
      };
    },
    []
  );

  const finishWheelDrag = useCallback((pointerId?: number) => {
    if (activeDragPointerIdRef.current === null) return;
    if (pointerId !== undefined && activeDragPointerIdRef.current !== pointerId) return;

    const pid = activeDragPointerIdRef.current;
    const el = wheelContainerRef.current;
    if (el) {
      try {
        if (el.hasPointerCapture(pid)) {
          el.releasePointerCapture(pid);
        }
      } catch {}
    }

    activeDragPointerIdRef.current = null;
    activeDragPointerTypeRef.current = null;
    lastRawPointerDegRef.current = null;
    unifiedDrivingInput.endWheelDrag(pid);
  }, []);

  const resetWheelAndHorn = useCallback(() => {
    finishWheelDrag();
    if (activeHornPointerIdRef.current !== null) {
      activeHornPointerIdRef.current = null;
      onHornUpRef.current?.();
    }
  }, [finishWheelDrag]);

  // Subscribe to single unified driving state so wheel visual & physics never diverge
  useEffect(() => {
    const applySnapshot = (snap: ReturnType<typeof unifiedDrivingInput.getSnapshot>) => {
      setDisplayAngleDeg((prev) =>
        Math.abs(prev - snap.wheelAngleDeg) > 0.02 || (snap.wheelAngleDeg === 0 && prev !== 0)
          ? snap.wheelAngleDeg
          : prev
      );
      setIsDragging((prev) => (prev !== snap.isWheelDragging ? snap.isWheelDragging : prev));

      if (
        Math.abs(snap.steerAxis - lastEmittedAxisRef.current) > 0.002 ||
        (snap.steerAxis === 0 && lastEmittedAxisRef.current !== 0)
      ) {
        lastEmittedAxisRef.current = snap.steerAxis;
        onSteerAxisChangeRef.current?.(snap.steerAxis);
      }
    };

    applySnapshot(unifiedDrivingInput.getSnapshot());
    return unifiedDrivingInput.subscribe(applySnapshot);
  }, []);

  // Optional external steer hint sync (only when caller explicitly drives externalSteerHint)
  useEffect(() => {
    if (disabled || externalSteerHint === 0) return;
    const snap = unifiedDrivingInput.getSnapshot();
    if (!snap.isWheelDragging && !snap.keyboard.left && !snap.keyboard.right) {
      const targetDeg = clampSteeringWheelDeg(-externalSteerHint * MAX_STEERING_WHEEL_DEG);
      setDisplayAngleDeg(targetDeg);
    }
  }, [disabled, externalSteerHint]);

  // Fallback RAF stepper strictly when WorldCanvas animation loop is not stepping
  useEffect(() => {
    if (disabled) return;
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.max(0.001, Math.min(0.05, (now - lastTs) / 1000));
      lastTs = now;

      if (!unifiedDrivingInput.hasRecentExternalStep(now)) {
        const snap = unifiedDrivingInput.getSnapshot();
        const needsStep =
          !snap.isWheelDragging &&
          (Math.abs(snap.wheelAngleDeg) > 0.01 || snap.keyboard.left || snap.keyboard.right);
        if (needsStep) {
          unifiedDrivingInput.step(dt, false);
        }
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [disabled]);

  // Window-level pointer move/end listeners guarantee smooth desktop mouse dragging even outside wheel bounds
  useEffect(() => {
    if (disabled) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      if (activeDragPointerIdRef.current !== e.pointerId) return;

      // Safety check: if mouse button was released outside viewport without pointerup, finish drag cleanly
      if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
        finishWheelDrag(e.pointerId);
        return;
      }

      if (e.cancelable) e.preventDefault();

      const { rawDeg } = computePointerDegFromCenter(e.clientX, e.clientY);
      const horizontalDelta = (e.clientX - lastClientXRef.current) * 1.1;
      lastClientXRef.current = e.clientX;

      let deltaDeg = 0;
      if (rawDeg !== null) {
        if (lastRawPointerDegRef.current !== null) {
          deltaDeg = unwrapPointerAngleDelta(lastRawPointerDegRef.current, rawDeg);
        } else {
          // Smooth transition when emerging from inner center zone without 180-degree snap
          deltaDeg = horizontalDelta;
        }
        lastRawPointerDegRef.current = rawDeg;
      } else {
        // Inside inner center radius: fall back smoothly to horizontal delta without losing drag
        lastRawPointerDegRef.current = null;
        deltaDeg = horizontalDelta;
      }

      const currentDeg = unifiedDrivingInput.getSnapshot().wheelAngleDeg;
      const nextAngle = clampSteeringWheelDeg(currentDeg + deltaDeg, MAX_STEERING_WHEEL_DEG);
      unifiedDrivingInput.updateWheelDragAngle(nextAngle, e.pointerId);
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      if (activeDragPointerIdRef.current === e.pointerId) {
        finishWheelDrag(e.pointerId);
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [disabled, computePointerDegFromCenter, finishWheelDrag]);

  useEffect(() => {
    if (disabled) {
      resetWheelAndHorn();
    }
  }, [disabled, resetWheelAndHorn]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) resetWheelAndHorn();
    };
    window.addEventListener('blur', resetWheelAndHorn);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('blur', resetWheelAndHorn);
      document.removeEventListener('visibilitychange', handleVisibility);
      resetWheelAndHorn();
    };
  }, [resetWheelAndHorn]);

  const triggerHaptic = (ms = 12) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {}
    }
  };

  const handleWheelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    // For mouse, replace any stale drag ID so desktop mouse drag never locks up; for touch, track single wheel finger
    if (activeDragPointerIdRef.current !== null && e.pointerType !== 'mouse') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const { rawDeg } = computePointerDegFromCenter(e.clientX, e.clientY);
    activeDragPointerIdRef.current = e.pointerId;
    activeDragPointerTypeRef.current = e.pointerType;
    lastClientXRef.current = e.clientX;
    lastRawPointerDegRef.current = rawDeg;

    unifiedDrivingInput.beginWheelDrag(e.pointerId, e.pointerType);
    engineAudio.init();
    triggerHaptic(10);

    // Use pointer capture on touch for multi-touch pedal isolation; desktop mouse uses window listeners directly
    if (e.pointerType !== 'mouse') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleHornPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    activeHornPointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    engineAudio.init();
    triggerHaptic(18);
    onHornDown?.();
  };

  const handleHornPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (activeHornPointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
    activeHornPointerIdRef.current = null;
    onHornUpRef.current?.();
  };

  const normalizedSteerPct = Math.round(
    (Math.abs(displayAngleDeg) / MAX_STEERING_WHEEL_DEG) * 100
  );
  const steerDirectionLabel =
    displayAngleDeg < -3 ? 'L' : displayAngleDeg > 3 ? 'R' : 'C';

  return (
    <div
      className="relative flex flex-col items-center select-none"
      style={{
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Subtle Live Steering Telemetry Readout */}
      <div className="mb-1 px-2 py-0.5 rounded-md bg-[#071A2B]/85 border border-white/12 text-[9px] font-mono font-bold tracking-wider text-slate-300 flex items-center gap-1.5 shadow">
        <span className={displayAngleDeg !== 0 ? 'text-[#EF233C]' : 'text-emerald-400'}>
          {steerDirectionLabel}
        </span>
        <span className="tabular-nums text-white">
          {Math.round(Math.abs(displayAngleDeg))}°
        </span>
        <span className="text-slate-500">·</span>
        <span className="tabular-nums text-slate-400">{normalizedSteerPct}%</span>
      </div>

      {/* Interactive Steering Wheel Housing */}
      <div
        ref={wheelContainerRef}
        onPointerDown={handleWheelPointerDown}
        onTouchStart={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        data-dragging={isDragging ? 'true' : 'false'}
        role="slider"
        aria-label="Steering Wheel"
        aria-valuemin={-MAX_STEERING_WHEEL_DEG}
        aria-valuemax={MAX_STEERING_WHEEL_DEG}
        aria-valuenow={Math.round(displayAngleDeg)}
        style={{
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        className={`relative ${sizeClassName} rounded-full cursor-grab active:cursor-grabbing flex items-center justify-center drop-shadow-[0_14px_26px_rgba(0,0,0,0.68)]`}
      >
        {/* Rotating Flat-Bottom Sport Steering Wheel SVG */}
        <svg
          viewBox="0 0 240 240"
          className="w-full h-full pointer-events-none will-change-transform"
          style={{
            transform: `rotate(${displayAngleDeg.toFixed(2)}deg)`,
          }}
          aria-hidden="true"
        >
          <defs>
            {/* Piano Black Rim Gradient */}
            <linearGradient id="manifoldWheelPianoRim" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#262c36" />
              <stop offset="28%" stopColor="#0b0e13" />
              <stop offset="68%" stopColor="#171c24" />
              <stop offset="100%" stopColor="#07090d" />
            </linearGradient>

            {/* Specular Edge Rim Highlight */}
            <linearGradient id="manifoldWheelHighlight" x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
              <stop offset="35%" stopColor="rgba(255,255,255,0.08)" />
              <stop offset="70%" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
            </linearGradient>

            {/* Brushed Gunmetal Spoken Alloy */}
            <linearGradient id="manifoldSpokeAlloy" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2b3342" />
              <stop offset="50%" stopColor="#1b202b" />
              <stop offset="100%" stopColor="#12161f" />
            </linearGradient>

            {/* Perforated Leather Side Grip Pattern */}
            <pattern
              id="manifoldPerforatedLeather"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
            >
              <rect width="6" height="6" fill="#171b22" />
              <circle cx="2" cy="2" r="0.85" fill="#07090d" />
              <circle cx="5" cy="5" r="0.85" fill="#07090d" />
              <circle cx="2.1" cy="2.1" r="0.35" fill="rgba(255,255,255,0.06)" />
            </pattern>

            {/* Center Airbag Hub Leather Shading */}
            <radialGradient id="manifoldHubSurface" cx="45%" cy="35%" r="68%">
              <stop offset="0%" stopColor="#29303d" />
              <stop offset="55%" stopColor="#161b24" />
              <stop offset="100%" stopColor="#0c1016" />
            </radialGradient>
          </defs>

          {/* Subtle Rear Shifter Paddle Accents */}
          <path
            d="M 46 82 L 32 76 C 28 74 26 78 27 83 L 33 108 L 48 106 Z"
            fill="#1f2531"
            stroke="#3a4354"
            strokeWidth="1.2"
          />
          <path
            d="M 194 82 L 208 76 C 212 74 214 78 213 83 L 207 108 L 192 106 Z"
            fill="#1f2531"
            stroke="#3a4354"
            strokeWidth="1.2"
          />

          {/* Three Structural Spokes (Left, Right, Flat-Bottom Lower V-Spoke) */}
          <path
            d="M 27 104 L 84 106 L 84 134 L 27 136 Z"
            fill="url(#manifoldSpokeAlloy)"
            stroke="#090c11"
            strokeWidth="1.5"
          />
          <path
            d="M 156 106 L 213 104 L 213 136 L 156 134 Z"
            fill="url(#manifoldSpokeAlloy)"
            stroke="#090c11"
            strokeWidth="1.5"
          />
          {/* Lower V-Spoke Framing Cutout */}
          <path
            d="M 76 146 L 164 146 L 150 202 L 90 202 Z"
            fill="url(#manifoldSpokeAlloy)"
            stroke="#353f52"
            strokeWidth="1.6"
          />
          {/* Satin Dark Inner Opening inside Lower Spoke */}
          <path
            d="M 103 160 L 137 160 L 133 176 L 107 176 Z"
            fill="#0b0e14"
            stroke="#2a3242"
            strokeWidth="1.2"
          />

          {/* Subtle Spoke Trim Accents */}
          <line x1="42" y1="112" x2="72" y2="112" stroke="#3c4659" strokeWidth="2" strokeLinecap="round" />
          <line x1="42" y1="128" x2="68" y2="128" stroke="#3c4659" strokeWidth="2" strokeLinecap="round" />
          <line x1="168" y1="112" x2="198" y2="112" stroke="#3c4659" strokeWidth="2" strokeLinecap="round" />
          <line x1="172" y1="128" x2="198" y2="128" stroke="#3c4659" strokeWidth="2" strokeLinecap="round" />

          {/* Outer Flat-Bottom Rim Base Shadow */}
          <path
            d="M 64 198 A 96 96 0 1 1 176 198 C 154 205 86 205 64 198 Z"
            fill="none"
            stroke="#05070a"
            strokeWidth="28"
            strokeLinejoin="round"
          />

          {/* Main Piano-Black Outer Rim */}
          <path
            d="M 64 198 A 96 96 0 1 1 176 198 C 154 205 86 205 64 198 Z"
            fill="none"
            stroke="url(#manifoldWheelPianoRim)"
            strokeWidth="24"
            strokeLinejoin="round"
          />

          {/* Specular Top & Flat-Bottom Bevel Highlight */}
          <path
            d="M 64 198 A 96 96 0 1 1 176 198 C 154 205 86 205 64 198 Z"
            fill="none"
            stroke="url(#manifoldWheelHighlight)"
            strokeWidth="2.2"
            strokeLinejoin="round"
            opacity="0.7"
          />

          {/* Perforated Charcoal Leather Side Bolsters (9 & 3 O'Clock Grips) */}
          <path
            d="M 41 65 A 96 96 0 0 0 43 177"
            fill="none"
            stroke="url(#manifoldPerforatedLeather)"
            strokeWidth="27"
            strokeLinecap="round"
          />
          <path
            d="M 199 65 A 96 96 0 0 1 197 177"
            fill="none"
            stroke="url(#manifoldPerforatedLeather)"
            strokeWidth="27"
            strokeLinecap="round"
          />

          {/* Subtle Inner Crimson Performance Stitching on Side Grips */}
          <path
            d="M 48 72 A 86 86 0 0 0 49 170"
            fill="none"
            stroke="#EF233C"
            strokeWidth="1.2"
            strokeDasharray="3 3"
            opacity="0.7"
          />
          <path
            d="M 192 72 A 86 86 0 0 1 191 170"
            fill="none"
            stroke="#EF233C"
            strokeWidth="1.2"
            strokeDasharray="3 3"
            opacity="0.7"
          />

          {/* Thumb Grip Contours */}
          <ellipse cx="42" cy="100" rx="8" ry="12" fill="#1b2029" stroke="#303847" strokeWidth="1" />
          <ellipse cx="198" cy="100" rx="8" ry="12" fill="#1b2029" stroke="#303847" strokeWidth="1" />

          {/* 12 O'Clock Anodized Crimson Center Alignment Ring */}
          <rect
            x="116.5"
            y="11"
            width="7"
            height="25"
            rx="2.5"
            fill="#EF233C"
            stroke="#fca5a5"
            strokeWidth="0.7"
          />

          {/* Lower Center Bezel MANIFOLD Micro-Crest */}
          <rect
            x="98"
            y="185"
            width="44"
            height="14"
            rx="4"
            fill="#0b0e14"
            stroke="#374151"
            strokeWidth="1"
          />
          <rect x="103" y="189" width="6" height="6" rx="1.5" fill="#EF233C" />
          <text
            x="124"
            y="194.5"
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize="6.5"
            fontWeight="800"
            letterSpacing="0.9"
            fontFamily="Plus Jakarta Sans, sans-serif"
          >
            MANIFOLD
          </text>

          {/* Center Sculpted Horn Hub Cover */}
          <path
            d="M 85 88 C 85 78 96 73 120 73 C 144 73 155 78 155 88 L 151 142 C 149 152 138 158 120 158 C 102 158 91 152 89 142 Z"
            fill="url(#manifoldHubSurface)"
            stroke={hornActive ? '#facc15' : '#3b4456'}
            strokeWidth={hornActive ? '2.6' : '2'}
          />
          {/* Subtle Inner Hub Metallic Bevel */}
          <path
            d="M 91 92 C 91 84 100 80 120 80 C 140 80 149 84 149 92 L 146 139 C 144 147 135 152 120 152 C 105 152 96 147 94 139 Z"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />

          {/* Bold Red M Center Crest */}
          <path
            d="M 103 114 L 107 93 L 114 93 L 120 105 L 126 93 L 133 93 L 137 114 L 130.5 114 L 128 102 L 120 114 L 112 102 L 109.5 114 Z"
            fill="#EF233C"
            stroke="#fca5a5"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          <path
            d="M 104 111 Q 120 105 136 111"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>

        {/* Dedicated Center Horn Button (Isolated from Rim Drag Rotation) */}
        {onHornDown && onHornUp && (
          <button
            type="button"
            onPointerDown={handleHornPointerDown}
            onPointerUp={handleHornPointerEnd}
            onPointerCancel={handleHornPointerEnd}
            onLostPointerCapture={handleHornPointerEnd}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
            aria-label="Car Horn"
            title="Press & Hold Center Hub to Honk (or press H)"
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[31%] h-[31%] rounded-full flex flex-col items-center justify-end pb-1.5 transition-transform duration-75 cursor-pointer ${
              hornActive
                ? 'bg-amber-400/25 ring-2 ring-amber-300 scale-95'
                : 'bg-transparent hover:bg-white/5 active:scale-95'
            }`}
          >
            <span
              className={`inline-flex items-center gap-0.5 text-[7px] font-mono font-black tracking-widest uppercase ${
                hornActive ? 'text-amber-300' : 'text-slate-300/80'
              }`}
            >
              <Volume2 className="w-2.5 h-2.5" />
              <span>Horn</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
