// Pure 3D camera anti-clipping and line-of-sight building obstruction helpers
// Zero-allocation math used inside WorldCanvas frame loop and verification suites.

export interface BuildingAABB {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Computes the earliest intersection fraction t in [0, 1] along segment P0 -> P1
 * with an axis-aligned building bounding box (padded by radiusPadding).
 * Returns null if the segment does not intersect the box.
 */
export function intersectSegmentAABB(
  p0x: number,
  p0y: number,
  p0z: number,
  p1x: number,
  p1y: number,
  p1z: number,
  box: BuildingAABB,
  radiusPadding = 0.75
): number | null {
  const halfW = box.width * 0.5 + radiusPadding;
  const halfD = box.depth * 0.5 + radiusPadding;
  const minX = box.x - halfW;
  const maxX = box.x + halfW;
  const minY = -1.0;
  const maxY = box.height + radiusPadding;
  const minZ = box.z - halfD;
  const maxZ = box.z + halfD;

  const dx = p1x - p0x;
  const dy = p1y - p0y;
  const dz = p1z - p0z;

  let tMin = 0;
  let tMax = 1;

  // X slab
  if (Math.abs(dx) < 1e-8) {
    if (p0x < minX || p0x > maxX) return null;
  } else {
    const invD = 1 / dx;
    let t1 = (minX - p0x) * invD;
    let t2 = (maxX - p0x) * invD;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  // Y slab
  if (Math.abs(dy) < 1e-8) {
    if (p0y < minY || p0y > maxY) return null;
  } else {
    const invD = 1 / dy;
    let t1 = (minY - p0y) * invD;
    let t2 = (maxY - p0y) * invD;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  // Z slab
  if (Math.abs(dz) < 1e-8) {
    if (p0z < minZ || p0z > maxZ) return null;
  } else {
    const invD = 1 / dz;
    let t1 = (minZ - p0z) * invD;
    let t2 = (maxZ - p0z) * invD;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  return tMin;
}

/**
 * Resolves a safe camera position along Pivot -> DesiredCam that stops cleanly
 * before clipping into any collidable building and maintains surface floor clearance.
 */
export function resolveSafeCameraPosition(
  pivot: Point3D,
  desired: Point3D,
  buildings: BuildingAABB[],
  resolveSurfaceY: (x: number, z: number, refY: number) => number,
  refCarY: number,
  minSurfaceClearance = 1.2
): Point3D {
  let closestT = 1.0;

  const segMidX = (pivot.x + desired.x) * 0.5;
  const segMidZ = (pivot.z + desired.z) * 0.5;
  const segHalfSpan = Math.hypot(desired.x - pivot.x, desired.z - pivot.z) * 0.5 + 32;

  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    // Fast broadphase cull
    if (
      Math.abs(b.x - segMidX) > segHalfSpan + b.width * 0.5 ||
      Math.abs(b.z - segMidZ) > segHalfSpan + b.depth * 0.5
    ) {
      continue;
    }
    const hitT = intersectSegmentAABB(
      pivot.x,
      pivot.y,
      pivot.z,
      desired.x,
      desired.y,
      desired.z,
      b,
      0.85
    );
    if (hitT !== null && hitT > 0.01 && hitT < closestT) {
      closestT = hitT;
    }
  }

  // Pull camera slightly forward of the surface hit so near-plane never clips inside facade
  const safeT = closestT < 1.0 ? Math.max(0.22, closestT - 0.06) : 1.0;

  const safeX = pivot.x + (desired.x - pivot.x) * safeT;
  const safeZ = pivot.z + (desired.z - pivot.z) * safeT;
  const rawSafeY = pivot.y + (desired.y - pivot.y) * safeT;

  const groundY = resolveSurfaceY(safeX, safeZ, refCarY);
  const minAllowedY = Math.max(groundY + minSurfaceClearance, refCarY + 0.85);

  return {
    x: safeX,
    y: Math.max(rawSafeY, minAllowedY),
    z: safeZ,
  };
}

/**
 * Returns true if any solid building blocks direct line-of-sight between the camera
 * and a target vehicle roof point (used to prevent remote name tags showing through buildings).
 */
export function isTargetOccludedByBuildings(
  cam: Point3D,
  target: Point3D,
  buildings: BuildingAABB[]
): boolean {
  const segMidX = (cam.x + target.x) * 0.5;
  const segMidZ = (cam.z + target.z) * 0.5;
  const segHalfSpan = Math.hypot(target.x - cam.x, target.z - cam.z) * 0.5 + 24;

  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (
      Math.abs(b.x - segMidX) > segHalfSpan + b.width * 0.5 ||
      Math.abs(b.z - segMidZ) > segHalfSpan + b.depth * 0.5
    ) {
      continue;
    }
    const hitT = intersectSegmentAABB(
      cam.x,
      cam.y,
      cam.z,
      target.x,
      target.y,
      target.z,
      b,
      0.0
    );
    if (hitT !== null && hitT > 0.02 && hitT < 0.96) {
      return true;
    }
  }
  return false;
}
