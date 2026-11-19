import {
  BarricadeCollider,
  BuildingBox,
  WORLD_XZ_SCALE,
  resolveSurfaceY,
} from './lagosCityData';
import type { VehicleColliderBox } from './collisionEngine';

export interface SpawnPose {
  x: number;
  y: number;
  z: number;
  rotation: number;
}

export interface FindSpawnOptions {
  baseX?: number;
  baseZ?: number;
  rotation?: number;
  carHalfWidth?: number;
  carHalfLength?: number;
  occupiedVehicles?: Array<{
    x: number;
    y?: number;
    z: number;
    width?: number;
    length?: number;
    rotation?: number;
  }>;
  buildings?: BuildingBox[];
  barricades?: BarricadeCollider[];
  preferSlotSeed?: number;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Checks yaw-aware OBB separation between two vehicles with an optional clearance padding.
 */
function obbsOverlap(
  ax: number,
  az: number,
  aHalfW: number,
  aHalfD: number,
  aAngle: number,
  bx: number,
  bz: number,
  bHalfW: number,
  bHalfD: number,
  bAngle: number
): boolean {
  const dx = ax - bx;
  const dz = az - bz;
  const broadR = Math.hypot(aHalfW, aHalfD) + Math.hypot(bHalfW, bHalfD);
  if (dx * dx + dz * dz > broadR * broadR) return false;

  const aXx = Math.cos(aAngle);
  const aXz = -Math.sin(aAngle);
  const aZx = Math.sin(aAngle);
  const aZz = Math.cos(aAngle);

  const bXx = Math.cos(bAngle);
  const bXz = -Math.sin(bAngle);
  const bZx = Math.sin(bAngle);
  const bZz = Math.cos(bAngle);

  const axes: [number, number][] = [
    [aXx, aXz],
    [aZx, aZz],
    [bXx, bXz],
    [bZx, bZz],
  ];

  for (let i = 0; i < 4; i++) {
    const [ux, uz] = axes[i];
    const dist = Math.abs(dx * ux + dz * uz);
    const projA = aHalfW * Math.abs(aXx * ux + aXz * uz) + aHalfD * Math.abs(aZx * ux + aZz * uz);
    const projB = bHalfW * Math.abs(bXx * ux + bXz * uz) + bHalfD * Math.abs(bZx * ux + bZz * uz);
    if (projA + projB - dist <= 0) {
      return false;
    }
  }
  return true;
}

/**
 * Returns true if placing a vehicle at (x, y, z, rotation) clears all other cars,
 * buildings, and hardened barricades with comfortable spawn padding.
 */
export function isSpawnPoseClear(
  x: number,
  z: number,
  rotation: number,
  options: {
    y?: number;
    carHalfWidth?: number;
    carHalfLength?: number;
    occupiedVehicles?: Array<{
      x: number;
      y?: number;
      z: number;
      width?: number;
      length?: number;
      rotation?: number;
    }>;
    buildings?: BuildingBox[];
    barricades?: BarricadeCollider[];
    lateralMargin?: number;
    longitudinalMargin?: number;
  } = {}
): boolean {
  const y = options.y ?? 0;
  const halfW = (options.carHalfWidth ?? 1.05) + (options.lateralMargin ?? 0.55);
  const halfD = (options.carHalfLength ?? 2.35) + (options.longitudinalMargin ?? 0.9);
  const vehicles = options.occupiedVehicles ?? [];
  const buildings = options.buildings ?? [];
  const barricades = options.barricades ?? [];

  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    if (Math.abs((v.y ?? 0) - y) > 2.8) continue;
    const vHalfW = (v.width ?? 2.1) * 0.5;
    const vHalfD = (v.length ?? 4.7) * 0.5;
    if (obbsOverlap(x, z, halfW, halfD, rotation, v.x, v.z, vHalfW, vHalfD, v.rotation ?? 0)) {
      return false;
    }
  }

  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (y > b.height + 1.0) continue;
    if (obbsOverlap(x, z, halfW, halfD, rotation, b.x, b.z, b.width * 0.5, b.depth * 0.5, 0)) {
      return false;
    }
  }

  for (let i = 0; i < barricades.length; i++) {
    const bar = barricades[i];
    if (Math.abs(bar.y - y) > 3.2) continue;
    if (obbsOverlap(x, z, halfW, halfD, rotation, bar.x, bar.z, bar.halfW, bar.halfD, bar.angle)) {
      return false;
    }
  }

  return true;
}

/**
 * Selects a non-overlapping spawn slot in the shared Showroom Boulevard starting zone
 * around (0, 0, 10 * WORLD_XZ_SCALE) so all drivers start in the same place without
 * stacking on top of each other or clipping into traffic/buildings/barricades.
 */
export function findFreeSharedSpawnPose(options: FindSpawnOptions = {}): SpawnPose {
  const baseX = options.baseX ?? 0;
  const baseZ = options.baseZ ?? 10 * WORLD_XZ_SCALE;
  const rotation = options.rotation ?? Math.PI;
  const carHalfWidth = options.carHalfWidth ?? 1.05;
  const carHalfLength = options.carHalfLength ?? 2.35;
  const occupiedVehicles = options.occupiedVehicles ?? [];
  const buildings = options.buildings ?? [];
  const barricades = options.barricades ?? [];

  // Candidate offsets arrayed cleanly across Showroom Boulevard lanes (-6.4m..+6.4m)
  // and staggered fore/aft rows so up to 40+ concurrent players get clear road slots.
  const dxOffsets = [0, -3.5, 3.5, -6.2, 6.2];
  const dzOffsets = [0, 6.8, -6.8, 13.6, -13.6, 20.4, -20.4, 27.2, 34.0];

  const baseY = resolveSurfaceY(baseX, baseZ, 0);

  // Check exact center slot first when free
  if (
    isSpawnPoseClear(baseX, baseZ, rotation, {
      y: baseY,
      carHalfWidth,
      carHalfLength,
      occupiedVehicles,
      buildings,
      barricades,
    })
  ) {
    return { x: baseX, y: baseY, z: baseZ, rotation };
  }

  // Build ordered candidates favoring close proximity to base (0, 10*S)
  const candidates: { x: number; z: number; score: number }[] = [];
  for (let zi = 0; zi < dzOffsets.length; zi++) {
    for (let xi = 0; xi < dxOffsets.length; xi++) {
      const dx = dxOffsets[xi];
      const dz = dzOffsets[zi];
      if (dx === 0 && dz === 0) continue;
      const cx = baseX + dx;
      const cz = baseZ + dz;
      const score = Math.abs(dz) + Math.abs(dx) * 1.15;
      candidates.push({ x: cx, z: cz, score });
    }
  }
  candidates.sort((a, b) => a.score - b.score);

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const cy = resolveSurfaceY(c.x, c.z, baseY);
    if (
      isSpawnPoseClear(c.x, c.z, rotation, {
        y: cy,
        carHalfWidth,
        carHalfLength,
        occupiedVehicles,
        buildings,
        barricades,
      })
    ) {
      return { x: c.x, y: cy, z: c.z, rotation };
    }
  }

  // Fallback with deterministic jittered ring along boulevard if grid saturated
  const seed = clamp(options.preferSlotSeed ?? occupiedVehicles.length + 1, 1, 64);
  const fallbackDx = dxOffsets[seed % dxOffsets.length];
  const fallbackDz = 38 + Math.floor(seed / dxOffsets.length) * 7.0;
  const fx = baseX + fallbackDx;
  const fz = baseZ + fallbackDz;
  return {
    x: fx,
    y: resolveSurfaceY(fx, fz, baseY),
    z: fz,
    rotation,
  };
}

/**
 * Helper to build VehicleColliderBox snapshots from any lightweight position array.
 */
export function toColliderBoxes(
  list: Array<{ id: string; x: number; y?: number; z: number; width?: number; length?: number; rotation?: number; speed?: number }>
): VehicleColliderBox[] {
  return list.map((v) => {
    const w = v.width ?? 2.05;
    const l = v.length ?? 4.6;
    return {
      id: v.id,
      x: v.x,
      y: v.y ?? 0,
      z: v.z,
      width: w,
      length: l,
      rotation: v.rotation ?? 0,
      speed: v.speed ?? 0,
      minX: v.x - w * 0.5,
      maxX: v.x + w * 0.5,
      minZ: v.z - l * 0.5,
      maxZ: v.z + l * 0.5,
    };
  });
}
