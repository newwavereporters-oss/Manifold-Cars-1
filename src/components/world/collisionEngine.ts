// MANIFOLD WORLD - HARDENED 2D OBB COLLISION & IMPACT DYNAMICS ENGINE
// Resolves yaw-aware OBB-vs-OBB collisions against buildings, barricades, traffic,
// rival racers, and knockable poles/trees, computing exact contact points for
// bidirectional vehicle denting, pushback, and physical impact feedback.

import { BarricadeCollider, BarricadeKind, BuildingBox, DynamicPropCollider } from './lagosCityData';
import { engineAudio } from '../../utils/engineAudio';

export interface VehicleColliderBox {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  speed: number;
  x: number;
  z: number;
  y?: number;
  width?: number;
  length?: number;
  rotation?: number;
}

export interface CollisionEvent {
  type: 'VEHICLE' | 'BUILDING' | 'PERIMETER' | 'BARRICADE' | 'PROP';
  otherKind?: 'TRAFFIC' | 'RIVAL' | 'BUILDING' | 'BARRICADE' | 'PROP';
  otherId: string;
  impactVelocity: number;
  pushbackX: number;
  pushbackZ: number;
  otherPushX?: number;
  otherPushZ?: number;
  normalX: number;
  normalZ: number;
  hitX: number;
  hitZ: number;
  barricadeKind?: BarricadeKind;
  prop?: DynamicPropCollider;
}

export interface FrameCollisionResult {
  primaryHit: CollisionEvent | null;
  vehicleHits: CollisionEvent[];
  propHits: CollisionEvent[];
  maxImpactVelocity: number;
}

interface SatResult {
  overlap: number;
  nx: number;
  nz: number;
  hitX: number;
  hitZ: number;
}

const _satOut: SatResult = { overlap: 0, nx: 0, nz: 0, hitX: 0, hitZ: 0 };

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Exact 2D Separating Axis Theorem (SAT) test between two Y-rotated OBBs
 * matching Three.js Euler('YXZ') rotation.y:
 *   local +X -> (cos(a), -sin(a))
 *   local +Z -> (sin(a),  cos(a))
 * Writes Minimum Translation Vector pushing Box A out of Box B into `out`.
 */
function testObbOverlap(
  ax: number,
  az: number,
  aHalfW: number,
  aHalfD: number,
  aXx: number,
  aXz: number,
  aZx: number,
  aZz: number,
  bx: number,
  bz: number,
  bHalfW: number,
  bHalfD: number,
  bAngle: number,
  out: SatResult
): boolean {
  const bXx = Math.cos(bAngle);
  const bXz = -Math.sin(bAngle);
  const bZx = Math.sin(bAngle);
  const bZz = Math.cos(bAngle);

  const dx = ax - bx;
  const dz = az - bz;

  // Broadphase bounding circle check
  const broadR =
    Math.hypot(aHalfW, aHalfD) + Math.hypot(bHalfW, bHalfD);
  if (dx * dx + dz * dz > broadR * broadR) {
    return false;
  }

  let minOverlap = Infinity;
  let bestNx = 0;
  let bestNz = 1;

  // Axis 0: A's local X
  {
    const ux = aXx;
    const uz = aXz;
    const dist = Math.abs(dx * ux + dz * uz);
    const projA = aHalfW;
    const projB =
      bHalfW * Math.abs(bXx * ux + bXz * uz) + bHalfD * Math.abs(bZx * ux + bZz * uz);
    const ov = projA + projB - dist;
    if (ov <= 0) return false;
    if (ov < minOverlap) {
      minOverlap = ov;
      const sign = dx * ux + dz * uz >= 0 ? 1 : -1;
      bestNx = ux * sign;
      bestNz = uz * sign;
    }
  }

  // Axis 1: A's local Z
  {
    const ux = aZx;
    const uz = aZz;
    const dist = Math.abs(dx * ux + dz * uz);
    const projA = aHalfD;
    const projB =
      bHalfW * Math.abs(bXx * ux + bXz * uz) + bHalfD * Math.abs(bZx * ux + bZz * uz);
    const ov = projA + projB - dist;
    if (ov <= 0) return false;
    if (ov < minOverlap) {
      minOverlap = ov;
      const sign = dx * ux + dz * uz >= 0 ? 1 : -1;
      bestNx = ux * sign;
      bestNz = uz * sign;
    }
  }

  // Axis 2: B's local X
  {
    const ux = bXx;
    const uz = bXz;
    const dist = Math.abs(dx * ux + dz * uz);
    const projA =
      aHalfW * Math.abs(aXx * ux + aXz * uz) + aHalfD * Math.abs(aZx * ux + aZz * uz);
    const projB = bHalfW;
    const ov = projA + projB - dist;
    if (ov <= 0) return false;
    if (ov < minOverlap) {
      minOverlap = ov;
      const sign = dx * ux + dz * uz >= 0 ? 1 : -1;
      bestNx = ux * sign;
      bestNz = uz * sign;
    }
  }

  // Axis 3: B's local Z
  {
    const ux = bZx;
    const uz = bZz;
    const dist = Math.abs(dx * ux + dz * uz);
    const projA =
      aHalfW * Math.abs(aXx * ux + aXz * uz) + aHalfD * Math.abs(aZx * ux + aZz * uz);
    const projB = bHalfD;
    const ov = projA + projB - dist;
    if (ov <= 0) return false;
    if (ov < minOverlap) {
      minOverlap = ov;
      const sign = dx * ux + dz * uz >= 0 ? 1 : -1;
      bestNx = ux * sign;
      bestNz = uz * sign;
    }
  }

  // Estimate surface contact patch point by clamping B's center onto A and A's center onto B
  const relBAx = bx - ax;
  const relBAz = bz - az;
  const locAx = clamp(relBAx * aXx + relBAz * aXz, -aHalfW, aHalfW);
  const locAz = clamp(relBAx * aZx + relBAz * aZz, -aHalfD, aHalfD);
  const onAx = ax + locAx * aXx + locAz * aZx;
  const onAz = az + locAx * aXz + locAz * aZz;

  const locBx = clamp(dx * bXx + dz * bXz, -bHalfW, bHalfW);
  const locBz = clamp(dx * bZx + dz * bZz, -bHalfD, bHalfD);
  const onBx = bx + locBx * bXx + locBz * bZx;
  const onBz = bz + locBx * bXz + locBz * bZz;

  out.overlap = minOverlap;
  out.nx = bestNx;
  out.nz = bestNz;
  out.hitX = (onAx + onBx) * 0.5;
  out.hitZ = (onAz + onBz) * 0.5;
  return true;
}

export class CollisionEngine {
  private lastImpactTime = 0;

  /**
   * Resolves all collisions for the active frame against buildings, hardened barricades,
   * AI traffic, rival racers, and dynamic knockable street poles/trees.
   */
  public resolveWorldCollisions(
    carState: { x: number; y?: number; z: number; speed: number; rotation: number },
    carHalfWidth = 1.0,
    carHalfLength = 2.3,
    buildings: BuildingBox[] = [],
    trafficBoxes: VehicleColliderBox[] = [],
    rivalBoxes: VehicleColliderBox[] = [],
    barricades: BarricadeCollider[] = [],
    dynamicProps: DynamicPropCollider[] = []
  ): FrameCollisionResult {
    const now = performance.now();
    const playerY = carState.y ?? 0;

    let aXx = Math.cos(carState.rotation);
    let aXz = -Math.sin(carState.rotation);
    let aZx = Math.sin(carState.rotation);
    let aZz = Math.cos(carState.rotation);

    let primaryHit: CollisionEvent | null = null;
    let maxImpactVelocity = 0;
    const vehicleHits: CollisionEvent[] = [];
    const propHits: CollisionEvent[] = [];

    const recordPrimary = (ev: CollisionEvent) => {
      if (!primaryHit || ev.impactVelocity > primaryHit.impactVelocity) {
        primaryHit = ev;
      }
      if (ev.impactVelocity > maxImpactVelocity) {
        maxImpactVelocity = ev.impactVelocity;
      }
    };

    const applyStaticBarrierResponse = (
      evType: 'BUILDING' | 'BARRICADE',
      otherKind: 'BUILDING' | 'BARRICADE',
      otherId: string,
      barricadeKind?: BarricadeKind
    ) => {
      const ov = _satOut.overlap + 0.03;
      const nx = _satOut.nx;
      const nz = _satOut.nz;
      const pushX = nx * ov;
      const pushZ = nz * ov;

      carState.x += pushX;
      carState.z += pushZ;

      const pVx = aZx * carState.speed;
      const pVz = aZz * carState.speed;
      // Normal speed moving into the barrier (negative when approaching)
      const vn = pVx * nx + pVz * nz;
      const absSpeed = Math.abs(carState.speed);
      const impactVel = vn < 0 ? Math.max(Math.abs(vn), absSpeed * 0.45) : absSpeed * 0.35;

      if (vn < 0) {
        const headOnDot = Math.abs(aZx * nx + aZz * nz);
        if (headOnDot > 0.58) {
          // Head-on or steep impact: hardened rebound + energy loss
          carState.speed = -carState.speed * 0.28;
        } else {
          // Glancing scrape along wall / median / guardrail: slide cleanly with friction
          carState.speed *= 0.82;
        }
      }

      this.triggerImpactAudio(now, impactVel);

      recordPrimary({
        type: evType,
        otherKind,
        otherId,
        barricadeKind,
        impactVelocity: impactVel,
        pushbackX: pushX,
        pushbackZ: pushZ,
        normalX: nx,
        normalZ: nz,
        hitX: _satOut.hitX,
        hitZ: _satOut.hitZ,
      });
    };

    // 1. Hardened Static Buildings (Y-aware OBB vs AABB)
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (playerY > b.height + 1.0) continue;
      if (
        testObbOverlap(
          carState.x,
          carState.z,
          carHalfWidth,
          carHalfLength,
          aXx,
          aXz,
          aZx,
          aZz,
          b.x,
          b.z,
          b.width * 0.5,
          b.depth * 0.5,
          0,
          _satOut
        )
      ) {
        applyStaticBarrierResponse('BUILDING', 'BUILDING', b.id);
      }
    }

    // 2. Hardened Barricades (Guardrails, Medians, Estate/LASU Walls, Toll Booths, Shelters, Seawalls, Gantry Pillars)
    for (let i = 0; i < barricades.length; i++) {
      const bar = barricades[i];
      if (Math.abs(bar.y - playerY) > 3.2) continue;
      if (
        testObbOverlap(
          carState.x,
          carState.z,
          carHalfWidth,
          carHalfLength,
          aXx,
          aXz,
          aZx,
          aZz,
          bar.x,
          bar.z,
          bar.halfW,
          bar.halfD,
          bar.angle,
          _satOut
        )
      ) {
        applyStaticBarrierResponse('BARRICADE', 'BARRICADE', bar.id, bar.kind);
      }
    }

    // 3. Hardened Vehicle-to-Vehicle Collisions (Traffic + Rivals)
    const resolveVehicleList = (
      list: VehicleColliderBox[],
      otherKind: 'TRAFFIC' | 'RIVAL'
    ) => {
      for (let i = 0; i < list.length; i++) {
        const v = list[i];
        const vY = v.y ?? 0;
        if (Math.abs(vY - playerY) > 2.6) continue;

        const vHalfW = v.width !== undefined ? v.width * 0.5 : (v.maxX - v.minX) * 0.5;
        const vHalfD = v.length !== undefined ? v.length * 0.5 : (v.maxZ - v.minZ) * 0.5;
        const vAngle = v.rotation ?? 0;

        if (
          testObbOverlap(
            carState.x,
            carState.z,
            carHalfWidth,
            carHalfLength,
            aXx,
            aXz,
            aZx,
            aZz,
            v.x,
            v.z,
            vHalfW,
            vHalfD,
            vAngle,
            _satOut
          )
        ) {
          const nx = _satOut.nx;
          const nz = _satOut.nz;
          const sepTotal = _satOut.overlap + 0.08;
          const pushPlayer = sepTotal * 0.55;
          const pushOther = sepTotal * 0.55 + 0.14;

          const pushX = nx * pushPlayer;
          const pushZ = nz * pushPlayer;
          const otherPushX = -nx * pushOther;
          const otherPushZ = -nz * pushOther;

          // Compute closing velocity along impact normal
          const pVx = aZx * carState.speed;
          const pVz = aZz * carState.speed;
          const oVx = Math.sin(vAngle) * v.speed;
          const oVz = Math.cos(vAngle) * v.speed;
          const relVn = (pVx - oVx) * nx + (pVz - oVz) * nz;
          const impactVel =
            relVn < 0
              ? Math.max(Math.abs(relVn), Math.abs(carState.speed) * 0.4)
              : Math.max(Math.abs(carState.speed - v.speed) * 0.35, 2.5);

          // Separate player car immediately so vehicles cannot clip through
          carState.x += pushX;
          carState.z += pushZ;

          if (relVn < 0) {
            const headOnDot = Math.abs(aZx * nx + aZz * nz);
            if (headOnDot > 0.56) {
              // Hardened bumper-to-bumper rebound & momentum transfer
              const impulse = -(1 + 0.32) * relVn * 0.72;
              const newVx = pVx + impulse * nx;
              const newVz = pVz + impulse * nz;
              carState.speed = newVx * aZx + newVz * aZz;
            } else {
              // Side-to-side rub/T-bone: significant scrape damping + lateral deflection
              carState.speed *= 0.68;
            }
          } else {
            carState.speed *= 0.85;
          }

          this.triggerImpactAudio(now, impactVel);

          const ev: CollisionEvent = {
            type: 'VEHICLE',
            otherKind,
            otherId: v.id,
            impactVelocity: impactVel,
            pushbackX: pushX,
            pushbackZ: pushZ,
            otherPushX,
            otherPushZ,
            normalX: nx,
            normalZ: nz,
            hitX: _satOut.hitX,
            hitZ: _satOut.hitZ,
          };
          vehicleHits.push(ev);
          recordPrimary(ev);
        }
      }
    };

    resolveVehicleList(trafficBoxes, 'TRAFFIC');
    resolveVehicleList(rivalBoxes, 'RIVAL');

    // 4. Knockable Streetlights, Utility Poles & Trees (OBB vs Circle)
    if (dynamicProps.length > 0) {
      // Refresh local basis if rotation ever adjusted
      aXx = Math.cos(carState.rotation);
      aXz = -Math.sin(carState.rotation);
      aZx = Math.sin(carState.rotation);
      aZz = Math.cos(carState.rotation);

      for (let i = 0; i < dynamicProps.length; i++) {
        const prop = dynamicProps[i];
        if (prop.state !== 'STANDING') continue;
        if (Math.abs(prop.y - playerY) > 3.0) continue;

        const relX = prop.x - carState.x;
        const relZ = prop.z - carState.z;
        const broadR = carHalfLength + carHalfWidth + prop.radius;
        if (relX * relX + relZ * relZ > broadR * broadR) continue;

        // Transform prop center into player's local vehicle coordinates
        const lx = relX * aXx + relZ * aXz;
        const lz = relX * aZx + relZ * aZz;

        const cx = clamp(lx, -carHalfWidth, carHalfWidth);
        const cz = clamp(lz, -carHalfLength, carHalfLength);
        const dx = lx - cx;
        const dz = lz - cz;
        const distSq = dx * dx + dz * dz;

        if (distSq < prop.radius * prop.radius) {
          const absSpeed = Math.max(3.2, Math.abs(carState.speed));
          const hitX = carState.x + cx * aXx + cz * aZx;
          const hitZ = carState.z + cx * aXz + cz * aZz;

          // Impact direction pointing from contact into the prop (or along car motion)
          const pVx = aZx * carState.speed;
          const pVz = aZz * carState.speed;
          let dirX = pVx + (prop.x - hitX) * 2.5;
          let dirZ = pVz + (prop.z - hitZ) * 2.5;
          const dirLen = Math.hypot(dirX, dirZ) || 1;
          dirX /= dirLen;
          dirZ /= dirLen;

          // Prop yields & falls, damping car momentum noticeably (heavier trees slow more than lamps)
          const speedRetain =
            prop.kind === 'SHADE_TREE' ? 0.72 : prop.kind === 'PALM_TREE' ? 0.78 : 0.86;
          carState.speed *= speedRetain;

          this.triggerImpactAudio(now, absSpeed);

          const ev: CollisionEvent = {
            type: 'PROP',
            otherKind: 'PROP',
            otherId: prop.id,
            impactVelocity: absSpeed,
            pushbackX: -dirX * 0.15,
            pushbackZ: -dirZ * 0.15,
            normalX: -dirX,
            normalZ: -dirZ,
            hitX,
            hitZ,
            prop,
          };
          propHits.push(ev);
          recordPrimary(ev);
        }
      }
    }

    return {
      primaryHit,
      vehicleHits,
      propHits,
      maxImpactVelocity,
    };
  }

  /**
   * Backward-compatible single-event entry point.
   */
  public checkAndResolvePlayerCollisions(
    carState: { x: number; y?: number; z: number; speed: number; rotation: number },
    carHalfWidth = 1.0,
    carHalfLength = 2.3,
    buildings: BuildingBox[] = [],
    trafficBoxes: VehicleColliderBox[] = [],
    rivalBoxes: VehicleColliderBox[] = [],
    barricades: BarricadeCollider[] = [],
    dynamicProps: DynamicPropCollider[] = []
  ): CollisionEvent | null {
    return this.resolveWorldCollisions(
      carState,
      carHalfWidth,
      carHalfLength,
      buildings,
      trafficBoxes,
      rivalBoxes,
      barricades,
      dynamicProps
    ).primaryHit;
  }

  private triggerImpactAudio(now: number, speed: number) {
    if (now - this.lastImpactTime > 320 && speed > 3.5) {
      this.lastImpactTime = now;
      try {
        engineAudio.playHorn(true);
        setTimeout(() => engineAudio.playHorn(false), 85);
      } catch {
        // Ignore audio context restriction errors before user gesture
      }
    }
  }
}
