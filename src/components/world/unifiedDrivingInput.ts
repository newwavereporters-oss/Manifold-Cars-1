import {
  MAX_STEERING_WHEEL_DEG,
  clampSteeringWheelDeg,
  mapWheelAngleToSteerAxis,
  stepVisualWheelReturn,
} from './steeringWheelMath';

export type DrivingKeyAction = 'forward' | 'backward' | 'left' | 'right' | 'handbrake';
export type PedalInputKey = 'forward' | 'backward' | 'handbrake';

export interface UnifiedDrivingSnapshot {
  wheelAngleDeg: number;
  steerAxis: number;
  isWheelDragging: boolean;
  keyboard: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    handbrake: boolean;
  };
  pedals: {
    forward: boolean;
    backward: boolean;
    handbrake: boolean;
  };
  resolved: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    handbrake: boolean;
    steerAxis: number;
    wheelAngleDeg: number;
  };
}

export function normalizeDrivingAction(key: string, code?: string): DrivingKeyAction | null {
  const k = (key || '').toLowerCase();
  const c = (code || '').toLowerCase();

  if (k === 'arrowup' || c === 'arrowup' || k === 'w' || c === 'keyw') {
    return 'forward';
  }
  if (k === 'arrowdown' || c === 'arrowdown' || k === 's' || c === 'keys') {
    return 'backward';
  }
  if (k === 'arrowleft' || c === 'arrowleft' || k === 'a' || c === 'keya') {
    return 'left';
  }
  if (k === 'arrowright' || c === 'arrowright' || k === 'd' || c === 'keyd') {
    return 'right';
  }
  if (k === ' ' || k === 'space' || k === 'spacebar' || c === 'space') {
    return 'handbrake';
  }
  return null;
}

export function isScrollPreventableDrivingKey(key: string, code?: string): boolean {
  const k = (key || '').toLowerCase();
  const c = (code || '').toLowerCase();
  return (
    k === 'arrowup' ||
    k === 'arrowdown' ||
    k === 'arrowleft' ||
    k === 'arrowright' ||
    k === ' ' ||
    k === 'space' ||
    k === 'spacebar' ||
    c === 'arrowup' ||
    c === 'arrowdown' ||
    c === 'arrowleft' ||
    c === 'arrowright' ||
    c === 'space'
  );
}

export function isEditableInputTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined') return false;
  const el = target instanceof HTMLElement ? target : null;
  if (!el) return false;
  const tag = el.tagName?.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el.isContentEditable);
}

export class UnifiedDrivingStore {
  private wheelAngleDeg = 0;
  private steerAxis = 0;
  private isWheelDragging = false;
  private dragPointerId: number | null = null;
  private dragPointerType: string | null = null;
  private lastExternalStepMs = 0;

  private keyboardCodes: Record<DrivingKeyAction, Set<string>> = {
    forward: new Set(),
    backward: new Set(),
    left: new Set(),
    right: new Set(),
    handbrake: new Set(),
  };

  private pedals: Record<PedalInputKey, boolean> = {
    forward: false,
    backward: false,
    handbrake: false,
  };

  private listeners = new Set<(snapshot: UnifiedDrivingSnapshot) => void>();

  private buildSnapshot(): UnifiedDrivingSnapshot {
    const kbForward = this.keyboardCodes.forward.size > 0;
    const kbBackward = this.keyboardCodes.backward.size > 0;
    const kbLeft = this.keyboardCodes.left.size > 0;
    const kbRight = this.keyboardCodes.right.size > 0;
    const kbHandbrake = this.keyboardCodes.handbrake.size > 0;

    const pForward = this.pedals.forward;
    const pBackward = this.pedals.backward;
    const pHandbrake = this.pedals.handbrake;

    return {
      wheelAngleDeg: this.wheelAngleDeg,
      steerAxis: this.steerAxis,
      isWheelDragging: this.isWheelDragging,
      keyboard: {
        forward: kbForward,
        backward: kbBackward,
        left: kbLeft,
        right: kbRight,
        handbrake: kbHandbrake,
      },
      pedals: {
        forward: pForward,
        backward: pBackward,
        handbrake: pHandbrake,
      },
      resolved: {
        forward: kbForward || pForward,
        backward: kbBackward || pBackward,
        left: this.steerAxis > 0.08,
        right: this.steerAxis < -0.08,
        handbrake: kbHandbrake || pHandbrake,
        steerAxis: this.steerAxis,
        wheelAngleDeg: this.wheelAngleDeg,
      },
    };
  }

  private emit(): void {
    if (this.listeners.size === 0) return;
    const snap = this.buildSnapshot();
    this.listeners.forEach((listener) => {
      listener(snap);
    });
  }

  public getSnapshot(): UnifiedDrivingSnapshot {
    return this.buildSnapshot();
  }

  public subscribe(listener: (snapshot: UnifiedDrivingSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setKeyboardKey(key: string, pressed: boolean, code?: string): DrivingKeyAction | null {
    const action = normalizeDrivingAction(key, code);
    if (!action) return null;

    const id = (code || key || action).toLowerCase();
    const set = this.keyboardCodes[action];
    const prevSize = set.size;

    if (pressed) {
      set.add(id);
    } else {
      // Remove by physical code AND key alias so modifier/layout transitions never stick keys
      set.delete(id);
      if (key) set.delete(key.toLowerCase());
      if (code) set.delete(code.toLowerCase());
    }

    if (set.size !== prevSize) {
      this.emit();
    }
    return action;
  }

  public setPedal(pedal: PedalInputKey, pressed: boolean): void {
    if (this.pedals[pedal] === pressed) return;
    this.pedals[pedal] = pressed;
    this.emit();
  }

  public setAllPedals(next: Partial<Record<PedalInputKey, boolean>>): void {
    let changed = false;
    (Object.keys(this.pedals) as PedalInputKey[]).forEach((k) => {
      if (typeof next[k] === 'boolean' && this.pedals[k] !== next[k]) {
        this.pedals[k] = next[k] as boolean;
        changed = true;
      }
    });
    if (changed) {
      this.emit();
    }
  }

  public beginWheelDrag(pointerId: number, pointerType?: string): void {
    this.isWheelDragging = true;
    this.dragPointerId = pointerId;
    this.dragPointerType = pointerType ?? null;
    this.emit();
  }

  public updateWheelDragAngle(nextAngleDeg: number, pointerId?: number): void {
    if (!this.isWheelDragging) return;
    if (pointerId !== undefined && this.dragPointerId !== null && this.dragPointerId !== pointerId) {
      return;
    }
    const clamped = clampSteeringWheelDeg(nextAngleDeg, MAX_STEERING_WHEEL_DEG);
    const nextAxis = mapWheelAngleToSteerAxis(clamped, MAX_STEERING_WHEEL_DEG);
    const angleChanged = Math.abs(clamped - this.wheelAngleDeg) > 0.01;
    const axisChanged = Math.abs(nextAxis - this.steerAxis) > 0.001;
    this.wheelAngleDeg = clamped;
    this.steerAxis = nextAxis;
    if (angleChanged || axisChanged) {
      this.emit();
    }
  }

  public endWheelDrag(pointerId?: number): boolean {
    if (!this.isWheelDragging && this.dragPointerId === null) return false;
    if (
      pointerId !== undefined &&
      this.dragPointerId !== null &&
      this.dragPointerId !== pointerId
    ) {
      return false;
    }
    this.isWheelDragging = false;
    this.dragPointerId = null;
    this.dragPointerType = null;
    this.emit();
    return true;
  }

  public getActiveDragPointer(): { pointerId: number | null; pointerType: string | null } {
    return {
      pointerId: this.dragPointerId,
      pointerType: this.dragPointerType,
    };
  }

  public getKeyboardSteerDirection(): -1 | 0 | 1 {
    const left = this.keyboardCodes.left.size > 0;
    const right = this.keyboardCodes.right.size > 0;
    if (left && !right) return 1;
    if (right && !left) return -1;
    return 0;
  }

  public step(deltaSec: number, markExternal = false): UnifiedDrivingSnapshot {
    if (markExternal && typeof performance !== 'undefined') {
      this.lastExternalStepMs = performance.now();
    }

    if (this.isWheelDragging) {
      // Active pointer drag takes priority over keyboard steering
      const expectedAxis = mapWheelAngleToSteerAxis(this.wheelAngleDeg, MAX_STEERING_WHEEL_DEG);
      if (Math.abs(expectedAxis - this.steerAxis) > 0.001) {
        this.steerAxis = expectedAxis;
        this.emit();
      }
      return this.buildSnapshot();
    }

    const dt = Math.max(0, Math.min(0.1, Number.isFinite(deltaSec) ? deltaSec : 0));
    const kbDir = this.getKeyboardSteerDirection();
    // Positive kbDir (+1 left) => counter-clockwise wheelAngleDeg (-MAX_STEERING_WHEEL_DEG)
    const targetDeg = kbDir === 0 ? 0 : -kbDir * MAX_STEERING_WHEEL_DEG;

    const prevDeg = this.wheelAngleDeg;
    const prevAxis = this.steerAxis;

    if (targetDeg === 0) {
      this.wheelAngleDeg = stepVisualWheelReturn(this.wheelAngleDeg, dt);
    } else if (Math.abs(this.wheelAngleDeg - targetDeg) < 0.25) {
      this.wheelAngleDeg = targetDeg;
    } else {
      const isCounterSteering =
        this.wheelAngleDeg !== 0 && Math.sign(targetDeg) !== Math.sign(this.wheelAngleDeg);
      const rate = isCounterSteering ? 10.5 : 9.5;
      const alpha = 1 - Math.exp(-rate * dt);
      const next = this.wheelAngleDeg + (targetDeg - this.wheelAngleDeg) * alpha;
      this.wheelAngleDeg = Math.abs(targetDeg - next) < 0.25 ? targetDeg : next;
    }

    this.steerAxis = mapWheelAngleToSteerAxis(this.wheelAngleDeg, MAX_STEERING_WHEEL_DEG);

    if (
      Math.abs(this.wheelAngleDeg - prevDeg) > 0.02 ||
      (this.wheelAngleDeg === 0 && prevDeg !== 0) ||
      Math.abs(this.steerAxis - prevAxis) > 0.002 ||
      (this.steerAxis === 0 && prevAxis !== 0)
    ) {
      this.emit();
    }

    return this.buildSnapshot();
  }

  public hasRecentExternalStep(nowMs?: number): boolean {
    const now = nowMs ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
    return this.lastExternalStepMs > 0 && now - this.lastExternalStepMs < 50;
  }

  public clearKeyboardKeys(): void {
    let changed = false;
    (Object.keys(this.keyboardCodes) as DrivingKeyAction[]).forEach((action) => {
      if (this.keyboardCodes[action].size > 0) {
        this.keyboardCodes[action].clear();
        changed = true;
      }
    });
    if (changed) {
      this.emit();
    }
  }

  public clearAllInputs(resetWheelImmediately = false): void {
    let changed = false;
    (Object.keys(this.keyboardCodes) as DrivingKeyAction[]).forEach((action) => {
      if (this.keyboardCodes[action].size > 0) {
        this.keyboardCodes[action].clear();
        changed = true;
      }
    });
    (Object.keys(this.pedals) as PedalInputKey[]).forEach((pedal) => {
      if (this.pedals[pedal]) {
        this.pedals[pedal] = false;
        changed = true;
      }
    });
    if (this.isWheelDragging || this.dragPointerId !== null) {
      this.isWheelDragging = false;
      this.dragPointerId = null;
      this.dragPointerType = null;
      changed = true;
    }
    if (resetWheelImmediately && (this.wheelAngleDeg !== 0 || this.steerAxis !== 0)) {
      this.wheelAngleDeg = 0;
      this.steerAxis = 0;
      changed = true;
    }
    if (changed) {
      this.emit();
    }
  }
}

export const unifiedDrivingInput = new UnifiedDrivingStore();
