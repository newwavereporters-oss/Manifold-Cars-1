// MANIFOLD WORLD — PARAMETRIC AUTOMOTIVE SURFACE & WHEEL GEOMETRY BUILDERS
// Builds compound-curved sculpted car hulls (with real semicircular wheel-arch cutouts
// and open cabin apertures), bowed windscreens/roofs, contoured LatheGeometry tyres,
// concave sculpted alloy rims, cross-drilled rotors, and stationary calipers.

import * as THREE from 'three';
import type { CarCustomization } from '../components/world/worldModels';
import type { VehicleTextureBank } from './vehicleTextures';

export interface HullStation {
  z: number;
  ySill: number;
  wSill: number;
  yCrease: number;
  wCrease: number;
  yBelt: number;
  wBelt: number;
  yDeck: number;
  wDeck: number;
  yCrown: number;
  isCabin?: boolean; // true = left/right door & quarter skins only (leaves cabin interior open)
}

export interface WheelStyleSpec {
  spokePattern: 'Y_SPLIT_5' | 'TWIN_5' | 'TURBINE_10' | 'OFFROAD_6';
  radius: number;
  width: number;
  rimRadius: number;
  isRightSide: boolean;
  isOffroad?: boolean;
}

/**
 * Helper to compute wheel-arch cutout Y height along Z for a given axle
 */
export function computeWheelArchY(
  z: number,
  baseSillY: number,
  frontZ: number,
  rearZ: number,
  wheelCenterY: number,
  archRadius: number
): number {
  let y = baseSillY;
  const dFront = Math.abs(z - frontZ);
  if (dFront < archRadius) {
    const archY = wheelCenterY + Math.sqrt(Math.max(0, archRadius * archRadius - dFront * dFront));
    if (archY > y) y = archY;
  }
  const dRear = Math.abs(z - rearZ);
  if (dRear < archRadius) {
    const archY = wheelCenterY + Math.sqrt(Math.max(0, archRadius * archRadius - dRear * dRear));
    if (archY > y) y = archY;
  }
  return y;
}

/**
 * Generates clean longitudinal Z stations with tight sampling across both wheel arches
 * so circular cutouts wrap smoothly around tyres without jagged steps.
 */
export function buildArchAwareZStations(
  zMin: number,
  zMax: number,
  rearZ: number,
  frontZ: number,
  archRadius: number,
  cabinEndZ: number,
  cabinStartZ: number
): number[] {
  const raw: number[] = [zMin, zMin + 0.1, zMin + 0.24];

  // Rear arch fine points
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const angle = Math.PI - t * Math.PI;
    raw.push(rearZ + Math.cos(angle) * archRadius);
  }
  raw.push(rearZ - archRadius - 0.08, rearZ + archRadius + 0.08);

  // Mid-cabin door stations
  const midSpan = (frontZ - archRadius) - (rearZ + archRadius);
  for (let i = 1; i <= 5; i++) {
    raw.push(rearZ + archRadius + (midSpan * i) / 6);
  }
  raw.push(cabinEndZ - 0.01, cabinEndZ, cabinStartZ, cabinStartZ + 0.01);

  // Front arch fine points
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const angle = Math.PI - t * Math.PI;
    raw.push(frontZ + Math.cos(angle) * archRadius);
  }
  raw.push(frontZ - archRadius - 0.08, frontZ + archRadius + 0.08);

  // Hood / nose taper points
  const noseSpan = zMax - (frontZ + archRadius + 0.08);
  if (noseSpan > 0.15) {
    raw.push(frontZ + archRadius + 0.08 + noseSpan * 0.45);
    raw.push(frontZ + archRadius + 0.08 + noseSpan * 0.8);
  }
  raw.push(zMax - 0.08, zMax);

  // Clamp, sort ascending, deduplicate close stations
  const sorted = raw
    .filter((z) => z >= zMin - 0.001 && z <= zMax + 0.001)
    .map((z) => Math.max(zMin, Math.min(zMax, z)))
    .sort((a, b) => a - b);

  const dedup: number[] = [];
  for (const z of sorted) {
    if (dedup.length === 0 || Math.abs(z - dedup[dedup.length - 1]) > 0.012) {
      dedup.push(z);
    }
  }
  if (dedup[dedup.length - 1] < zMax) dedup.push(zMax);
  return dedup;
}

/**
 * Builds a compound-curved automotive body shell from cross-sectional HullStations.
 * Smooth normals along curved hoods/fenders/haunches with crisp door/creased character lines
 * and real open cabin interior along stations marked `isCabin = true`.
 */
export function buildSculptedCarBodyGeometry(stations: HullStation[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];

  const zStart = stations[0].z;
  const zSpan = Math.max(0.1, stations[stations.length - 1].z - zStart);

  const pushTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    ua: [number, number],
    ub: [number, number],
    uc: [number, number]
  ) => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uvs.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  };

  // Helper to get cross-section curves for a station
  // Full closed hood/deck cross-section (11 points from +X sill -> center crown -> -X sill)
  const getFullCrossSection = (s: HullStation): [number, number, number][] => [
    [s.wSill, s.ySill, s.z],                     // 0: Right rocker/arch edge
    [s.wCrease, s.yCrease, s.z],                 // 1: Right mid-door crease
    [s.wBelt, s.yBelt, s.z],                     // 2: Right beltline flare
    [s.wDeck, s.yDeck, s.z],                     // 3: Right hood/deck shoulder
    [s.wDeck * 0.48, (s.yDeck + s.yCrown) * 0.52, s.z], // 4: Right crown curve
    [0, s.yCrown, s.z],                          // 5: Center hood/boot crown
    [-s.wDeck * 0.48, (s.yDeck + s.yCrown) * 0.52, s.z], // 6: Left crown curve
    [-s.wDeck, s.yDeck, s.z],                    // 7: Left hood/deck shoulder
    [-s.wBelt, s.yBelt, s.z],                    // 8: Left beltline flare
    [-s.wCrease, s.yCrease, s.z],                // 9: Left mid-door crease
    [-s.wSill, s.ySill, s.z],                    // 10: Left rocker/arch edge
  ];

  // Side-only cross-sections when station is inside open cabin aperture
  const getRightDoorSection = (s: HullStation): [number, number, number][] => [
    [s.wSill, s.ySill, s.z],
    [s.wCrease, s.yCrease, s.z],
    [s.wBelt, s.yBelt, s.z],
    [s.wDeck, s.yDeck, s.z],
    [s.wDeck - 0.08, s.yDeck - 0.03, s.z], // inner window sill lip
  ];

  const getLeftDoorSection = (s: HullStation): [number, number, number][] => [
    [-s.wDeck + 0.08, s.yDeck - 0.03, s.z], // inner window sill lip
    [-s.wDeck, s.yDeck, s.z],
    [-s.wBelt, s.yBelt, s.z],
    [-s.wCrease, s.yCrease, s.z],
    [-s.wSill, s.ySill, s.z],
  ];

  const emitStripQuad = (
    p00: [number, number, number],
    p01: [number, number, number],
    p10: [number, number, number],
    p11: [number, number, number],
    u0: number,
    u1: number,
    v0: number,
    v1: number
  ) => {
    // Outward winding: (p00, p01, p10) & (p01, p11, p10)
    pushTri(p00, p01, p10, [u0, v0], [u0, v1], [u1, v0]);
    pushTri(p01, p11, p10, [u0, v1], [u1, v1], [u1, v0]);
  };

  for (let i = 0; i < stations.length - 1; i++) {
    const s0 = stations[i];
    const s1 = stations[i + 1];
    const u0 = (s0.z - zStart) / zSpan;
    const u1 = (s1.z - zStart) / zSpan;

    if (!s0.isCabin && !s1.isCabin) {
      const c0 = getFullCrossSection(s0);
      const c1 = getFullCrossSection(s1);
      for (let j = 0; j < c0.length - 1; j++) {
        emitStripQuad(c0[j], c0[j + 1], c1[j], c1[j + 1], u0, u1, j / 10, (j + 1) / 10);
      }
    } else {
      // At least one station is open-cabin -> loft left & right side body skins separately
      const r0 = s0.isCabin ? getRightDoorSection(s0) : getFullCrossSection(s0).slice(0, 5);
      const r1 = s1.isCabin ? getRightDoorSection(s1) : getFullCrossSection(s1).slice(0, 5);
      for (let j = 0; j < 4; j++) {
        emitStripQuad(r0[j], r0[j + 1], r1[j], r1[j + 1], u0, u1, j / 4, (j + 1) / 4);
      }

      const l0 = s0.isCabin ? getLeftDoorSection(s0) : getFullCrossSection(s0).slice(6, 11);
      const l1 = s1.isCabin ? getLeftDoorSection(s1) : getFullCrossSection(s1).slice(6, 11);
      for (let j = 0; j < 4; j++) {
        emitStripQuad(l0[j], l0[j + 1], l1[j], l1[j + 1], u0, u1, j / 4, (j + 1) / 4);
      }
    }
  }

  // Cap front nose face (+Z) and rear tail face (-Z) cleanly so no open ends show
  const capEnd = (s: HullStation, isFront: boolean) => {
    const pts = getFullCrossSection(s);
    const center: [number, number, number] = [0, (s.ySill + s.yCrown) * 0.45, s.z];
    for (let j = 0; j < pts.length - 1; j++) {
      if (isFront) {
        pushTri(center, pts[j], pts[j + 1], [0.5, 0.5], [j / 10, 0], [(j + 1) / 10, 0]);
      } else {
        pushTri(center, pts[j + 1], pts[j], [0.5, 0.5], [(j + 1) / 10, 0], [j / 10, 0]);
      }
    }
    // Bottom chin/valance cap segment between left & right sill
    if (isFront) {
      pushTri(center, pts[10], pts[0], [0.5, 0.5], [1, 0], [0, 0]);
    } else {
      pushTri(center, pts[0], pts[10], [0.5, 0.5], [0, 0], [1, 0]);
    }
  };
  capEnd(stations[0], false);
  capEnd(stations[stations.length - 1], true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  // Smooth normals within curved patches while keeping crisp edges by welding close vertices
  geo.computeVertexNormals();
  return geo;
}

/**
 * Smooths vertex normals across shared vertex positions so curved automotive sheet metal
 * reflects light smoothly like stamped bodywork rather than faceted triangles.
 */
export function computeSmoothBodyNormals(geo: THREE.BufferGeometry, creaseAngleDeg = 42): THREE.BufferGeometry {
  geo.computeVertexNormals();
  const posAttr = geo.getAttribute('position');
  const normAttr = geo.getAttribute('normal');
  const count = posAttr.count;
  const cosThreshold = Math.cos((creaseAngleDeg * Math.PI) / 180);

  // Bucket vertices by quantized spatial position
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(posAttr.getX(i) * 500)}_${Math.round(posAttr.getY(i) * 500)}_${Math.round(posAttr.getZ(i) * 500)}`;
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
    }
    list.push(i);
  }

  const outNormals = new Float32Array(count * 3);
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const sum = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    vA.fromBufferAttribute(normAttr, i);
    const key = `${Math.round(posAttr.getX(i) * 500)}_${Math.round(posAttr.getY(i) * 500)}_${Math.round(posAttr.getZ(i) * 500)}`;
    const list = buckets.get(key) || [i];
    sum.copy(vA);

    for (const otherIdx of list) {
      if (otherIdx === i) continue;
      vB.fromBufferAttribute(normAttr, otherIdx);
      if (vA.dot(vB) >= cosThreshold) {
        sum.add(vB);
      }
    }
    sum.normalize();
    outNormals[i * 3] = sum.x;
    outNormals[i * 3 + 1] = sum.y;
    outNormals[i * 3 + 2] = sum.z;
  }

  geo.setAttribute('normal', new THREE.BufferAttribute(outNormals, 3));
  return geo;
}

/**
 * Builds a smoothly bowed 3D curved windshield, rear window, or roof surface
 * between bottom edge and top edge with realistic lateral curvature (`bowZ` & `crownY`).
 */
export function buildCurvedPanelMesh(
  bottomHalfW: number,
  bottomY: number,
  bottomZ: number,
  topHalfW: number,
  topY: number,
  topZ: number,
  bowZ: number,
  crownY: number,
  material: THREE.Material,
  segX = 12,
  segY = 6,
  castShadow = false
): THREE.Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= segY; iy++) {
    const v = iy / segY;
    const hw = THREE.MathUtils.lerp(bottomHalfW, topHalfW, v);
    const baseY = THREE.MathUtils.lerp(bottomY, topY, v);
    const baseZ = THREE.MathUtils.lerp(bottomZ, topZ, v);
    const archCurve = Math.sin(v * Math.PI); // slight camber along slope

    for (let ix = 0; ix <= segX; ix++) {
      const u = ix / segX;
      const t = u * 2 - 1; // -1..+1
      const x = t * hw;
      const curveFactor = 1 - t * t; // parabolic crown at centerline
      const y = baseY + crownY * curveFactor + archCurve * 0.02;
      const z = baseZ + bowZ * curveFactor;

      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  const stride = segX + 1;
  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iy * stride + ix;
      const b = a + 1;
      const c = (iy + 1) * stride + ix;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds an exact curved structural pillar (A/B/C/D pillar) connecting two 3D points
 * along a slightly bowed automotive trajectory using TubeGeometry.
 */
export function buildCurvedPillar(
  start: THREE.Vector3,
  midOffset: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  castShadow = true
): THREE.Mesh {
  const mid = start.clone().lerp(end, 0.5).add(midOffset);
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  const geo = new THREE.TubeGeometry(curve, 10, radius, 8, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds sculpted semicircular wheelhouse inner tubs + beveled ExtrudeGeometry
 * fender-arch flare moldings framing each of the 4 wheel wells.
 */
export function buildSculptedWheelWells(
  parent: THREE.Group,
  archRadius: number,
  wellWidth: number,
  halfTrackX: number,
  frontZ: number,
  rearZ: number,
  wheelCenterY: number,
  linerMat: THREE.Material,
  flareMat: THREE.Material,
  flareRadialWidth = 0.068,
  flareProtrusion = 0.055
) {
  // Deep semicircular wheelhouse liner tub
  const linerGeo = new THREE.CylinderGeometry(
    archRadius * 0.99,
    archRadius * 0.99,
    wellWidth,
    24,
    1,
    true,
    -Math.PI / 2,
    Math.PI
  );
  linerGeo.rotateZ(Math.PI / 2);

  // Inner backing shield inside wheel well (prevents seeing straight through under the car)
  const bulkheadGeo = new THREE.CylinderGeometry(
    archRadius * 0.98,
    archRadius * 0.98,
    0.03,
    20,
    1,
    false,
    -Math.PI / 2,
    Math.PI
  );
  bulkheadGeo.rotateZ(Math.PI / 2);

  // Sculpted beveled wheel-arch flare molding using ExtrudeGeometry half-ring
  const archShape = new THREE.Shape();
  const rIn = archRadius - 0.005;
  const rOut = archRadius + flareRadialWidth;
  const segs = 22;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI;
    const x = Math.cos(a) * rOut;
    const y = Math.sin(a) * rOut;
    if (i === 0) archShape.moveTo(x, y);
    else archShape.lineTo(x, y);
  }
  for (let i = segs; i >= 0; i--) {
    const a = (i / segs) * Math.PI;
    archShape.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
  }
  archShape.closePath();

  const flareGeo = new THREE.ExtrudeGeometry(archShape, {
    depth: flareProtrusion,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.014,
    bevelSegments: 2,
    curveSegments: 20,
  });
  // Orient shape's XY (arch semicircle) into YZ plane extruded along X
  flareGeo.rotateY(Math.PI / 2);
  flareGeo.computeVertexNormals();

  const corners: [number, number, number][] = [
    [-halfTrackX, frontZ, -1],
    [halfTrackX, frontZ, 1],
    [-halfTrackX, rearZ, -1],
    [halfTrackX, rearZ, 1],
  ];

  corners.forEach(([ax, az, sideSign]) => {
    const well = new THREE.Group();
    well.position.set(ax, wheelCenterY, az);

    const liner = new THREE.Mesh(linerGeo, linerMat);
    liner.position.x = -sideSign * (wellWidth * 0.14);
    well.add(liner);

    const bulkhead = new THREE.Mesh(bulkheadGeo, linerMat);
    bulkhead.position.x = -sideSign * (wellWidth * 0.62);
    well.add(bulkhead);

    const flare = new THREE.Mesh(flareGeo, flareMat);
    flare.position.x =
      sideSign > 0
        ? wellWidth * 0.44 - flareProtrusion * 0.5
        : -wellWidth * 0.44 - flareProtrusion * 0.5;
    flare.castShadow = true;
    flare.receiveShadow = true;
    well.add(flare);

    parent.add(well);
  });
}

/**
 * Builds a complete, articulated Wheel Assembly:
 * - `steerGroup` (outer group, steers around Y on front axle, holds stationary brake caliper)
 * - `spinGroup` (inner group, spins around +X for all 4 wheels cleanly without Euler clash)
 *   - Contoured LatheGeometry rubber tyre tread (with procedural tread texture + bumpMap)
 *   - Curved LatheGeometry inner & outer sidewalls (with sidewall markings + bumpMap)
 *   - Concave LatheGeometry alloy rim barrel + machined outer flange
 *   - Sculpted 3D alloy spokes (`Y_SPLIT_5` | `TWIN_5` | `TURBINE_10` | `OFFROAD_6`)
 *   - Center cap + 5 recessed chrome lug nuts
 *   - Cross-drilled steel brake rotor
 */
export function buildDetailedWheelAssembly(
  custom: CarCustomization,
  spec: WheelStyleSpec,
  textures: VehicleTextureBank | null
): {
  steerGroup: THREE.Group;
  spinGroup: THREE.Group;
} {
  const { radius, width, rimRadius, spokePattern, isRightSide, isOffroad } = spec;
  const steerGroup = new THREE.Group();
  const spinGroup = new THREE.Group();
  steerGroup.add(spinGroup);

  const isSemiSlick = custom.tires === 'SEMI_SLICK';
  const isCarbonCeramic = custom.brakes === 'CARBON_CERAMIC';

  // Tyre materials
  const treadBump = isSemiSlick
    ? textures?.tireSemiSlickBump ?? null
    : isOffroad
    ? textures?.tireOffroadBump ?? null
    : textures?.tireTreadBump ?? null;

  const treadMat = new THREE.MeshStandardMaterial({
    color: isSemiSlick ? 0x16191f : 0x1c2026,
    map: textures?.tireTreadColor ?? null,
    bumpMap: treadBump,
    bumpScale: isOffroad ? 0.022 : isSemiSlick ? 0.008 : 0.015,
    roughness: isSemiSlick ? 0.62 : 0.86,
    metalness: 0.04,
  });

  const sidewallMat = new THREE.MeshStandardMaterial({
    color: 0x14171c,
    map: textures?.tireSidewallColor ?? null,
    bumpMap: textures?.tireSidewallBump ?? null,
    bumpScale: 0.007,
    roughness: 0.78,
    metalness: 0.05,
  });

  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.34,
    metalness: 0.78,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.rimColor || '#E2E8F0'),
    metalness: 0.92,
    roughness: 0.16,
    envMapIntensity: 1.5,
  });

  const rotorMat = new THREE.MeshStandardMaterial({
    color: isCarbonCeramic ? 0x475569 : 0x94a3b8,
    map: textures?.brakeRotorColor ?? null,
    bumpMap: textures?.brakeRotorBump ?? null,
    bumpScale: 0.006,
    metalness: isCarbonCeramic ? 0.45 : 0.88,
    roughness: isCarbonCeramic ? 0.38 : 0.24,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.12,
  });

  const caliperMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(isCarbonCeramic ? '#f59e0b' : custom.caliperColor || '#ef233c'),
    metalness: 0.65,
    roughness: 0.25,
  });

  const halfW = width * 0.5;
  const shoulderW = width * 0.38;
  const shoulderR = radius * 0.965;
  const sidewallMidR = (rimRadius + radius) * 0.52;

  // 1. Contoured LatheGeometry Tyre Tread Band (clean circumferential UV mapping)
  const treadPts = [
    new THREE.Vector2(shoulderR, -shoulderW),
    new THREE.Vector2(radius * 0.996, -width * 0.28),
    new THREE.Vector2(radius, 0),
    new THREE.Vector2(radius * 0.996, width * 0.28),
    new THREE.Vector2(shoulderR, shoulderW),
  ];
  const treadGeo = new THREE.LatheGeometry(treadPts, 36);
  treadGeo.rotateZ(Math.PI / 2);
  treadGeo.computeVertexNormals();
  const treadMesh = new THREE.Mesh(treadGeo, treadMat);
  treadMesh.castShadow = true;
  treadMesh.receiveShadow = true;
  spinGroup.add(treadMesh);

  // 2. Curved Tyre Sidewall Rings (outer + inner bulge)
  const makeSidewallGeo = (sign: number) => {
    const pts =
      sign > 0
        ? [
            new THREE.Vector2(rimRadius * 0.97, sign * halfW * 0.86),
            new THREE.Vector2(sidewallMidR, sign * halfW * 1.02),
            new THREE.Vector2(shoulderR, sign * shoulderW),
          ]
        : [
            new THREE.Vector2(shoulderR, sign * shoulderW),
            new THREE.Vector2(sidewallMidR, sign * halfW * 1.02),
            new THREE.Vector2(rimRadius * 0.97, sign * halfW * 0.86),
          ];
    const g = new THREE.LatheGeometry(pts, 36);
    g.rotateZ(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  };
  const swPos = new THREE.Mesh(makeSidewallGeo(1), sidewallMat);
  const swNeg = new THREE.Mesh(makeSidewallGeo(-1), sidewallMat);
  swPos.castShadow = true;
  swNeg.castShadow = true;
  spinGroup.add(swPos, swNeg);

  // 3. Rim + Spokes + Rotor Container (oriented outward according to side without rotating spinGroup!)
  const wheelFaceGroup = new THREE.Group();
  if (!isRightSide) {
    // Left side outward face points toward -X; our helper builds outward toward +X, so rotate Y = Math.PI
    wheelFaceGroup.rotation.y = Math.PI;
  }
  spinGroup.add(wheelFaceGroup);

  // Concave stepped rim barrel + outer machined flange lip (LatheGeometry)
  const rimPts = [
    new THREE.Vector2(rimRadius * 0.86, -halfW * 0.82),
    new THREE.Vector2(rimRadius * 0.88, 0),
    new THREE.Vector2(rimRadius * 0.91, halfW * 0.56),
    new THREE.Vector2(rimRadius * 0.985, halfW * 0.85),
    new THREE.Vector2(rimRadius * 0.985, halfW * 0.92),
    new THREE.Vector2(rimRadius * 0.89, halfW * 0.88),
  ];
  const barrelGeo = new THREE.LatheGeometry(rimPts, 32);
  barrelGeo.rotateZ(Math.PI / 2);
  barrelGeo.computeVertexNormals();
  const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
  wheelFaceGroup.add(barrelMesh);

  // Bright machined outer rim lip ring
  const lipGeo = new THREE.TorusGeometry(rimRadius * 0.955, 0.013, 10, 32);
  lipGeo.rotateY(Math.PI / 2);
  const lipMesh = new THREE.Mesh(lipGeo, rimMat);
  lipMesh.position.x = halfW * 0.86;
  wheelFaceGroup.add(lipMesh);

  // 4. Sculpted Concave 3D Alloy Spokes (ExtrudeGeometry tapered spoke arms)
  const spokeOuterR = rimRadius * 0.9;
  const spokeInnerR = rimRadius * 0.24;
  const buildSpoke = (angle: number, widthRoot: number, widthTip: number, thickness = 0.024, tiltDish = 0.14) => {
    const len = spokeOuterR - spokeInnerR;
    const s = new THREE.Shape();
    s.moveTo(-widthRoot / 2, 0);
    s.lineTo(widthRoot / 2, 0);
    s.lineTo(widthTip / 2, len);
    s.lineTo(-widthTip / 2, len);
    s.closePath();

    const geo = new THREE.ExtrudeGeometry(s, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.004,
      bevelSegments: 1,
    });
    geo.rotateY(Math.PI / 2);
    // Pivot sits at inner hub radius, radial outward along +Y, rotated by angle around X
    const spokeHolder = new THREE.Group();
    spokeHolder.rotation.x = angle;

    const spokeMesh = new THREE.Mesh(geo, rimMat);
    spokeMesh.position.set(halfW * 0.56 - thickness * 0.5, spokeInnerR, 0);
    spokeMesh.rotation.z = -tiltDish; // Dish outward from recessed hub toward outer rim lip!
    spokeHolder.add(spokeMesh);
    wheelFaceGroup.add(spokeHolder);
  };

  if (spokePattern === 'Y_SPLIT_5') {
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      buildSpoke(a - 0.14, 0.026, 0.017, 0.022, 0.16);
      buildSpoke(a + 0.14, 0.026, 0.017, 0.022, 0.16);
    }
  } else if (spokePattern === 'TURBINE_10') {
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI * 2) / 10;
      buildSpoke(a, 0.022, 0.015, 0.02, 0.12);
    }
  } else if (spokePattern === 'OFFROAD_6') {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI * 2) / 6;
      buildSpoke(a, 0.048, 0.04, 0.03, 0.1);
    }
    // Simulated beadlock bolts along rim lip
    const boltGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.018, 6);
    boltGeo.rotateZ(Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      const b = new THREE.Mesh(boltGeo, chromeMat);
      b.position.set(halfW * 0.89, Math.cos(a) * rimRadius * 0.94, Math.sin(a) * rimRadius * 0.94);
      wheelFaceGroup.add(b);
    }
  } else {
    // TWIN_5
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      buildSpoke(a - 0.09, 0.032, 0.024, 0.024, 0.14);
      buildSpoke(a + 0.09, 0.032, 0.024, 0.024, 0.14);
    }
  }

  // 5. Recessed Center Hub Cap + Chrome Lug Nuts
  const hubCap = new THREE.Mesh(
    new THREE.CylinderGeometry(rimRadius * 0.27, rimRadius * 0.3, 0.055, 20),
    rimMat
  );
  hubCap.rotation.z = Math.PI / 2;
  hubCap.position.x = halfW * 0.52;
  wheelFaceGroup.add(hubCap);

  const emblemRing = new THREE.Mesh(
    new THREE.TorusGeometry(rimRadius * 0.13, 0.007, 8, 16),
    chromeMat
  );
  emblemRing.rotation.y = Math.PI / 2;
  emblemRing.position.x = halfW * 0.58;
  wheelFaceGroup.add(emblemRing);

  const lugGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.035, 6);
  lugGeo.rotateZ(Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    const lr = rimRadius * 0.19;
    const lug = new THREE.Mesh(lugGeo, chromeMat);
    lug.position.set(halfW * 0.56, Math.cos(a) * lr, Math.sin(a) * lr);
    wheelFaceGroup.add(lug);
  }

  // 6. Cross-Drilled Ventilated Brake Rotor (spins with wheel!)
  const rotorR = rimRadius * 0.78;
  const rotorMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rotorR, rotorR, 0.028, 28),
    rotorMat
  );
  rotorMesh.rotation.z = Math.PI / 2;
  rotorMesh.position.x = halfW * 0.18;
  wheelFaceGroup.add(rotorMesh);

  // 7. Stationary Curved Multi-Piston Brake Caliper (mounted on steerGroup — NEVER spins with wheel!)
  const calShape = new THREE.Shape();
  const calIn = rotorR * 0.62;
  const calOut = rotorR * 1.06;
  const startA = -0.35;
  const endA = 0.65;
  for (let i = 0; i <= 8; i++) {
    const a = THREE.MathUtils.lerp(startA, endA, i / 8);
    const px = Math.cos(a) * calOut;
    const py = Math.sin(a) * calOut;
    if (i === 0) calShape.moveTo(px, py);
    else calShape.lineTo(px, py);
  }
  for (let i = 8; i >= 0; i--) {
    const a = THREE.MathUtils.lerp(startA, endA, i / 8);
    calShape.lineTo(Math.cos(a) * calIn, Math.sin(a) * calIn);
  }
  calShape.closePath();

  const calGeo = new THREE.ExtrudeGeometry(calShape, {
    depth: 0.075,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 1,
  });
  calGeo.rotateY(Math.PI / 2);

  const caliperMesh = new THREE.Mesh(calGeo, caliperMat);
  // Position caliper toward the upper-rear quadrant of the rotor
  caliperMesh.position.x = isRightSide ? halfW * 0.18 - 0.038 : -(halfW * 0.18 + 0.038);
  steerGroup.add(caliperMesh);

  return { steerGroup, spinGroup };
}
