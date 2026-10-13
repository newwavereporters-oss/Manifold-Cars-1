// MANIFOLD WORLD - COLLISION & IMPACT DYNAMICS ENGINE
// Detects vehicle-to-vehicle, vehicle-to-building, and barrier impacts,
// applies physics pushback, speed damping, audio feedback, and cargo damage consequences.

import { BuildingBox } from './lagosCityData';
import { engineAudio } from '../../utils/engineAudio';

export interface CollisionEvent {
  type: 'VEHICLE' | 'BUILDING' | 'PERIMETER';
  otherId: string;
  impactVelocity: number;
  pushbackX: number;
  pushbackZ: number;
}

export class CollisionEngine {
  private lastImpactTime: number = 0;

  // Checks and resolves collisions between the player car and the surrounding world
  public checkAndResolvePlayerCollisions(
    carState: { x: number; z: number; speed: number; rotation: number },
    carHalfWidth: number = 1.05,
    carHalfLength: number = 2.3,
    buildings: BuildingBox[],
    trafficBoxes: { id: string; minX: number; maxX: number; minZ: number; maxZ: number; speed: number; x: number; z: number }[],
    rivalBoxes: { id: string; minX: number; maxX: number; minZ: number; maxZ: number; speed: number; x: number; z: number }[]
  ): CollisionEvent | null {
    const px = carState.x;
    const pz = carState.z;
    const playerSpeed = Math.abs(carState.speed);
    const now = performance.now();

    // 1. Check Buildings Collisions (AABB Bounding Boxes)
    for (const b of buildings) {
      const bMinX = b.x - b.width / 2;
      const bMaxX = b.x + b.width / 2;
      const bMinZ = b.z - b.depth / 2;
      const bMaxZ = b.z + b.depth / 2;

      // Overlap test
      if (
        px + carHalfWidth > bMinX &&
        px - carHalfWidth < bMaxX &&
        pz + carHalfLength > bMinZ &&
        pz - carHalfLength < bMaxZ
      ) {
        // Calculate penetration depths
        const overlapL = px + carHalfWidth - bMinX;
        const overlapR = bMaxX - (px - carHalfWidth);
        const overlapT = pz + carHalfLength - bMinZ;
        const overlapB = bMaxZ - (pz - carHalfLength);

        const minOverlapX = Math.min(overlapL, overlapR);
        const minOverlapZ = Math.min(overlapT, overlapB);

        let pushX = 0;
        let pushZ = 0;

        if (minOverlapX < minOverlapZ) {
          pushX = overlapL < overlapR ? -overlapL : overlapR;
        } else {
          pushZ = overlapT < overlapB ? -overlapT : overlapB;
        }

        // Apply physical pushback
        carState.x += pushX * 1.1;
        carState.z += pushZ * 1.1;
        carState.speed = -carState.speed * 0.3; // Elastic rebound with deceleration

        this.triggerImpactAudio(now, playerSpeed);

        return {
          type: 'BUILDING',
          otherId: b.id,
          impactVelocity: playerSpeed,
          pushbackX: pushX,
          pushbackZ: pushZ,
        };
      }
    }

    // 2. Check Traffic Vehicles Collisions
    for (const t of trafficBoxes) {
      const overlapX = Math.abs(px - t.x) < carHalfWidth + 1.1;
      const overlapZ = Math.abs(pz - t.z) < carHalfLength + 2.5;

      if (overlapX && overlapZ) {
        const dx = px - t.x;
        const dz = pz - t.z;
        const dist = Math.hypot(dx, dz) || 1;
        const pushMag = 1.8;

        const pushX = (dx / dist) * pushMag;
        const pushZ = (dz / dist) * pushMag;

        carState.x += pushX;
        carState.z += pushZ;
        carState.speed *= 0.35; // Significant momentum loss

        this.triggerImpactAudio(now, playerSpeed);

        return {
          type: 'VEHICLE',
          otherId: t.id,
          impactVelocity: playerSpeed,
          pushbackX: pushX,
          pushbackZ: pushZ,
        };
      }
    }

    // 3. Check Rival Racers Collisions
    for (const r of rivalBoxes) {
      const overlapX = Math.abs(px - r.x) < carHalfWidth + 1.1;
      const overlapZ = Math.abs(pz - r.z) < carHalfLength + 2.4;

      if (overlapX && overlapZ) {
        const dx = px - r.x;
        const dz = pz - r.z;
        const dist = Math.hypot(dx, dz) || 1;
        const pushMag = 1.6;

        const pushX = (dx / dist) * pushMag;
        const pushZ = (dz / dist) * pushMag;

        carState.x += pushX;
        carState.z += pushZ;
        carState.speed *= 0.45;

        this.triggerImpactAudio(now, playerSpeed);

        return {
          type: 'VEHICLE',
          otherId: r.id,
          impactVelocity: playerSpeed,
          pushbackX: pushX,
          pushbackZ: pushZ,
        };
      }
    }

    return null;
  }

  private triggerImpactAudio(now: number, speed: number) {
    if (now - this.lastImpactTime > 400 && speed > 5) {
      this.lastImpactTime = now;
      try {
        // Trigger horn / tire squeal audio spike for impact sensation
        engineAudio.playHorn(true);
        setTimeout(() => engineAudio.playHorn(false), 90);
      } catch {}
    }
  }
}
