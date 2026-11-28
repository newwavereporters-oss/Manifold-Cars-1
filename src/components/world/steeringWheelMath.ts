export const MAX_STEERING_WHEEL_DEG = 135;
export const STEERING_CENTER_DEADZONE_DEG = 2.0;

/**
 * Clamps visual steering wheel rotation in degrees to realistic lock limits.
 */
export function clampSteeringWheelDeg(
  deg: number,
  maxDeg: number = MAX_STEERING_WHEEL_DEG
): number {
  if (!Number.isFinite(deg)) return 0;
  return Math.max(-maxDeg, Math.min(maxDeg, deg));
}

/**
 * Computes shortest signed angular delta across the +/- 180 degree atan2 wrap boundary.
 */
export function unwrapPointerAngleDelta(prevRawDeg: number, nextRawDeg: number): number {
  let delta = nextRawDeg - prevRawDeg;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

/**
 * Maps visual steering wheel rotation in degrees (clockwise = positive = right turn)
 * to WorldCanvas steerInput axis in [-1, 1] where:
 *   +1 = full LEFT turn (counter-clockwise wheel rotation, wheelDeg < 0)
 *   -1 = full RIGHT turn (clockwise wheel rotation, wheelDeg > 0)
 */
export function mapWheelAngleToSteerAxis(
  wheelDeg: number,
  maxDeg: number = MAX_STEERING_WHEEL_DEG,
  deadzoneDeg: number = STEERING_CENTER_DEADZONE_DEG
): number {
  const clamped = clampSteeringWheelDeg(wheelDeg, maxDeg);
  const absDeg = Math.abs(clamped);
  if (absDeg <= deadzoneDeg || maxDeg <= deadzoneDeg) {
    return 0;
  }
  const normalized = (absDeg - deadzoneDeg) / (maxDeg - deadzoneDeg);
  // Subtle progressive curve preserves fine highway lane control while reaching full lock cleanly
  const curved = Math.pow(Math.min(1, Math.max(0, normalized)), 1.08);
  // Positive wheelDeg (clockwise / right) => negative steerAxis (turns vehicle right in WorldCanvas)
  return clamped > 0 ? -curved : curved;
}

/**
 * Smooth frame-rate-independent exponential return toward 0 deg when user releases the wheel.
 */
export function stepVisualWheelReturn(currentDeg: number, deltaSec: number): number {
  if (Math.abs(currentDeg) < 0.25) return 0;
  const dt = Math.max(0, Math.min(0.1, deltaSec));
  const alpha = 1 - Math.exp(-11.5 * dt);
  const next = currentDeg * (1 - alpha);
  return Math.abs(next) < 0.25 ? 0 : next;
}
