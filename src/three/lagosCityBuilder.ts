// MANIFOLD WORLD - THREE.JS ELEVATED BRIDGES & FLYOVERS BUILDER
// Generates all elevated coastal bridges and grade-separated flyovers using InstancedMesh
// and unified ELEVATED_SPANS geometry from lagosCityData.ts:
// 1. Third Mainland Bridge (repaired 4-lane dual-carriageway + ramps + Adekunle exit gore)
// 2. Adekunle Ramp (smooth southbound off-ramp viaduct to Adekunle Interchange)
// 3. Ikoyi-Lekki Link Bridge (iconic cable-stayed A-frame pylon bridge over lagoon channel)
// 4. Ajah Multi-Level Express Flyover (5.25m clear underpass over Ajah crossroad)
// 5. Epe Lagoon Bridge (coastal steel-arch bridge along Lekki-Epe Expressway)

import * as THREE from 'three';
import { ELEVATED_SPANS, ElevatedSpanDef, ElevatedSpanPiece } from '../components/world/lagosCityData';
import type { LagosTexturePack } from '../components/world/lagosTextures';

export interface BridgeBuildOptions {
  texPack?: LagosTexturePack;
  trackGeo?: <T extends THREE.BufferGeometry>(g: T) => T;
  trackMat?: <T extends THREE.Material>(m: T) => T;
}

export type ThirdMainlandBridgeOptions = BridgeBuildOptions;

interface SharedBridgeMats {
  asphaltMat: THREE.Material;
  whiteMarkMat: THREE.Material;
  yellowMarkMat: THREE.Material;
  lampBulbMat: THREE.Material;
  concretePierMat: THREE.Material;
  seawallMat: THREE.Material;
  parapetConcreteMat: THREE.Material;
  steelDarkMat: THREE.Material;
  steelSilverMat: THREE.Material;
  archBlueMat: THREE.Material;
  pylonWhiteMat: THREE.Material;
}

function createSharedMats(options: BridgeBuildOptions): SharedBridgeMats {
  const trackMat = options.trackMat ?? (<T extends THREE.Material>(m: T): T => m);
  const texPack = options.texPack;

  return {
    asphaltMat:
      texPack?.expresswayRoadMat ??
      trackMat(new THREE.MeshStandardMaterial({ color: 0x2c3440, roughness: 0.78, metalness: 0.08 })),
    whiteMarkMat:
      texPack?.whiteMarkMat ??
      trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 })),
    yellowMarkMat:
      texPack?.yellowMarkMat ??
      trackMat(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55 })),
    lampBulbMat:
      texPack?.streetlightBulbMat ??
      trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xfef3c7,
          emissive: 0xfde68a,
          emissiveIntensity: 0.65,
        })
      ),
    concretePierMat: trackMat(
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85, metalness: 0.08 })
    ),
    seawallMat: trackMat(
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88, metalness: 0.08 })
    ),
    parapetConcreteMat: trackMat(
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.78, metalness: 0.1 })
    ),
    steelDarkMat: trackMat(
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.42, metalness: 0.72 })
    ),
    steelSilverMat: trackMat(
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.32, metalness: 0.82 })
    ),
    archBlueMat: trackMat(
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.36, metalness: 0.62 })
    ),
    pylonWhiteMat: trackMat(
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.38, metalness: 0.15 })
    ),
  };
}

/**
 * Builds an arbitrarily oriented 3D deck + box girder + lane markings between P0 and P1
 * using Euler order 'YXZ' so local -Z aims from P0 -> P1 and pitch tilts cleanly without roll.
 */
function buildSlopedDeckPiece(
  parent: THREE.Group,
  piece: ElevatedSpanPiece,
  mats: SharedBridgeMats,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  options: {
    isFourLane: boolean;
    girderDepth?: number;
  }
) {
  const dx = piece.x1 - piece.x0;
  const dy = piece.y1 - piece.y0;
  const dz = piece.z1 - piece.z0;
  const horizLen = Math.hypot(dx, dz);
  const spanLen = Math.hypot(horizLen, dy);
  if (spanLen < 0.5) return;

  const yaw = Math.atan2(-dx, -dz);
  const pitch = Math.atan2(dy, horizLen);
  const deckW = piece.halfWidth * 2;
  const girderDepth = options.girderDepth ?? 1.05;

  const deckGroup = new THREE.Group();
  deckGroup.rotation.order = 'YXZ';
  deckGroup.position.set(
    (piece.x0 + piece.x1) / 2,
    (piece.y0 + piece.y1) / 2,
    (piece.z0 + piece.z1) / 2
  );
  deckGroup.rotation.y = yaw;
  deckGroup.rotation.x = pitch;

  // Asphalt top surface (DoubleSide safety + crisp offset above girder)
  const surf = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(deckW, spanLen)),
    mats.asphaltMat
  );
  surf.rotation.x = -Math.PI / 2;
  surf.position.y = 0.02;
  surf.receiveShadow = true;
  deckGroup.add(surf);

  // Structural concrete box girder beneath surface
  const soffit = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(deckW + 0.35, girderDepth, spanLen)),
    mats.concretePierMat
  );
  soffit.position.y = -girderDepth / 2;
  soffit.castShadow = true;
  soffit.receiveShadow = true;
  deckGroup.add(soffit);

  // Center yellow dividing lines
  [-0.56, 0.56].forEach((off) => {
    const yLine = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(0.16, spanLen)),
      mats.yellowMarkMat
    );
    yLine.rotation.x = -Math.PI / 2;
    yLine.position.set(off, 0.032, 0);
    deckGroup.add(yLine);
  });

  // Outer white shoulder lines
  [-1, 1].forEach((s) => {
    const edge = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(0.2, spanLen)),
      mats.whiteMarkMat
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(s * (piece.halfWidth - 1.15), 0.032, 0);
    deckGroup.add(edge);
  });

  parent.add(deckGroup);
}

/**
 * Instanced guardrails, concrete parapets, central Jersey barrier, and lane dashes
 * sampled smoothly along every piece of an ElevatedSpanDef.
 */
function buildSpanInstancedHardware(
  parent: THREE.Group,
  span: ElevatedSpanDef,
  mats: SharedBridgeMats,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  config: {
    hasMedianBarrier: boolean;
    hasLaneDashes: boolean;
    skipStartT?: number;
    skipEndT?: number;
  }
) {
  const step = 4.0;
  const wallMatricesL: THREE.Matrix4[] = [];
  const wallMatricesR: THREE.Matrix4[] = [];
  const medianMatrices: THREE.Matrix4[] = [];
  const dashMatrices: THREE.Matrix4[] = [];
  const lampMatrices: THREE.Matrix4[] = [];

  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';

  span.pieces.forEach((piece, pIdx) => {
    const dx = piece.x1 - piece.x0;
    const dy = piece.y1 - piece.y0;
    const dz = piece.z1 - piece.z0;
    const horizLen = Math.hypot(dx, dz);
    const spanLen = Math.hypot(horizLen, dy);
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(dy, horizLen);

    const rx = -dz / horizLen;
    const rz = dx / horizLen;

    const count = Math.max(2, Math.floor(spanLen / step));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      if (pIdx === 0 && config.skipStartT && t < config.skipStartT) continue;
      if (pIdx === span.pieces.length - 1 && config.skipEndT && t > config.skipEndT) continue;

      const cx = piece.x0 + dx * t;
      const cy = piece.y0 + dy * t;
      const cz = piece.z0 + dz * t;

      const inExitGapR =
        piece.exitGapRightT !== undefined &&
        t >= piece.exitGapRightT[0] &&
        t <= piece.exitGapRightT[1];

      // Left parapet (always built)
      dummy.position.set(
        cx - rx * (piece.halfWidth - 0.2),
        cy + 0.45,
        cz - rz * (piece.halfWidth - 0.2)
      );
      dummy.rotation.set(pitch, yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      wallMatricesL.push(dummy.matrix.clone());

      // Right parapet (respects exit gore gap if present)
      if (!inExitGapR) {
        dummy.position.set(
          cx + rx * (piece.halfWidth - 0.2),
          cy + 0.45,
          cz + rz * (piece.halfWidth - 0.2)
        );
        dummy.rotation.set(pitch, yaw, 0);
        dummy.updateMatrix();
        wallMatricesR.push(dummy.matrix.clone());
      }

      // Central Jersey barrier on 4-lane dual-carriageway bridges
      if (config.hasMedianBarrier && !inExitGapR) {
        dummy.position.set(cx, cy + 0.36, cz);
        dummy.rotation.set(pitch, yaw, 0);
        dummy.updateMatrix();
        medianMatrices.push(dummy.matrix.clone());
      }

      // Dashed lane dividers on each side of median every 8m
      if (config.hasLaneDashes && i % 2 === 0) {
        const laneOff = piece.halfWidth * 0.45;
        [-laneOff, laneOff].forEach((latOff) => {
          dummy.position.set(cx + rx * latOff, cy + 0.036, cz + rz * latOff);
          dummy.rotation.set(pitch, yaw, 0);
          dummy.updateMatrix();
          dashMatrices.push(dummy.matrix.clone());
        });
      }

      // Streetlights every 28m (every 7th step) on both outer parapets
      if (i % 7 === 3 && !inExitGapR) {
        [-1, 1].forEach((side) => {
          const edgeDist = piece.halfWidth - 0.22;
          dummy.position.set(cx + rx * edgeDist * side, cy + 0.9, cz + rz * edgeDist * side);
          dummy.rotation.set(0, yaw + (side === 1 ? Math.PI : 0), 0);
          dummy.updateMatrix();
          lampMatrices.push(dummy.matrix.clone());
        });
      }
    }
  });

  const allWalls = [...wallMatricesL, ...wallMatricesR];
  if (allWalls.length > 0) {
    const wallGeo = trackGeo(new THREE.BoxGeometry(0.46, 0.9, step + 0.12));
    const railGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.12, step + 0.12));
    railGeo.translate(0, 0.72, 0);
    const postGeo = trackGeo(new THREE.BoxGeometry(0.12, 0.48, 0.12));
    postGeo.translate(0, 0.56, 0);

    const wallInst = new THREE.InstancedMesh(wallGeo, mats.parapetConcreteMat, allWalls.length);
    const railInst = new THREE.InstancedMesh(railGeo, mats.steelSilverMat, allWalls.length);
    const postInst = new THREE.InstancedMesh(postGeo, mats.steelSilverMat, allWalls.length);
    wallInst.receiveShadow = true;

    allWalls.forEach((m, idx) => {
      wallInst.setMatrixAt(idx, m);
      railInst.setMatrixAt(idx, m);
      postInst.setMatrixAt(idx, m);
    });
    wallInst.computeBoundingSphere();
    railInst.computeBoundingSphere();
    postInst.computeBoundingSphere();
    parent.add(wallInst, railInst, postInst);
  }

  if (medianMatrices.length > 0) {
    const medGeo = trackGeo(new THREE.BoxGeometry(0.76, 0.72, step + 0.12));
    const medInst = new THREE.InstancedMesh(medGeo, mats.parapetConcreteMat, medianMatrices.length);
    medianMatrices.forEach((m, idx) => medInst.setMatrixAt(idx, m));
    medInst.computeBoundingSphere();
    parent.add(medInst);
  }

  if (dashMatrices.length > 0) {
    const dashGeo = trackGeo(new THREE.PlaneGeometry(0.22, 3.2));
    dashGeo.rotateX(-Math.PI / 2);
    const dashInst = new THREE.InstancedMesh(dashGeo, mats.whiteMarkMat, dashMatrices.length);
    dashMatrices.forEach((m, idx) => dashInst.setMatrixAt(idx, m));
    dashInst.computeBoundingSphere();
    parent.add(dashInst);
  }

  if (lampMatrices.length > 0) {
    const poleGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.16, 6.4, 8));
    poleGeo.translate(0, 3.2, 0);
    const armGeo = trackGeo(new THREE.BoxGeometry(1.7, 0.14, 0.16));
    armGeo.translate(0.75, 6.35, 0);
    const bulbGeo = trackGeo(new THREE.BoxGeometry(0.85, 0.16, 0.34));
    bulbGeo.translate(1.35, 6.25, 0);

    const poleInst = new THREE.InstancedMesh(poleGeo, mats.steelSilverMat, lampMatrices.length);
    const armInst = new THREE.InstancedMesh(armGeo, mats.steelSilverMat, lampMatrices.length);
    const bulbInst = new THREE.InstancedMesh(bulbGeo, mats.lampBulbMat, lampMatrices.length);
    lampMatrices.forEach((m, idx) => {
      poleInst.setMatrixAt(idx, m);
      armInst.setMatrixAt(idx, m);
      bulbInst.setMatrixAt(idx, m);
    });
    poleInst.computeBoundingSphere();
    armInst.computeBoundingSphere();
    bulbInst.computeBoundingSphere();
    parent.add(poleInst, armInst, bulbInst);
  }
}

/**
 * 1. THIRD MAINLAND BRIDGE (28m Wide 4-Lane Dual Carriageway Across Lagos Lagoon)
 */
export function createThirdMainlandBridge(options: BridgeBuildOptions = {}): THREE.Group {
  const trackGeo = options.trackGeo ?? (<T extends THREE.BufferGeometry>(g: T): T => g);
  const mats = createSharedMats(options);
  const span = ELEVATED_SPANS.find((s) => s.id === 'TMB')!;
  const mainPiece = span.pieces[1];

  const group = new THREE.Group();
  group.name = 'ThirdMainlandBridge';

  // Build exact flushed South Ramp, Main Span, North Ramp
  span.pieces.forEach((piece) => {
    buildSlopedDeckPiece(group, piece, mats, trackGeo, {
      isFourLane: true,
      girderDepth: 1.25,
    });
  });

  // Instanced railings, parapets, central median, lane dashes & streetlights
  buildSpanInstancedHardware(group, span, mats, trackGeo, {
    hasMedianBarrier: true,
    hasLaneDashes: true,
  });

  // Instanced Concrete Piers & Water Pile Caps along Main Span
  const dummy = new THREE.Object3D();
  const zStart = Math.max(mainPiece.z0, mainPiece.z1);
  const zEnd = Math.min(mainPiece.z0, mainPiece.z1);
  const spanLen = Math.abs(zStart - zEnd);
  const pierCount = Math.max(10, Math.round(spanLen / 34) + 1);
  const pierZs: number[] = [];
  for (let i = 0; i < pierCount; i++) {
    const t = pierCount > 1 ? i / (pierCount - 1) : 0;
    pierZs.push(zStart - t * spanLen);
  }

  const deckWidth = mainPiece.halfWidth * 2;
  const colOffX = mainPiece.halfWidth - 4.4;
  const colGeo = trackGeo(new THREE.CylinderGeometry(1.05, 1.25, 8.0, 12));
  const capGeo = trackGeo(new THREE.BoxGeometry(deckWidth - 1.8, 1.15, 2.6));
  const pileGeo = trackGeo(new THREE.BoxGeometry(deckWidth - 2.6, 1.4, 3.0));

  const colInst = new THREE.InstancedMesh(colGeo, mats.concretePierMat, pierZs.length * 2);
  const capInst = new THREE.InstancedMesh(capGeo, mats.concretePierMat, pierZs.length);
  const pileInst = new THREE.InstancedMesh(pileGeo, mats.seawallMat, pierZs.length);
  colInst.castShadow = true;

  pierZs.forEach((z, idx) => {
    [-colOffX, colOffX].forEach((px, sIdx) => {
      dummy.position.set(px, 1.2, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      colInst.setMatrixAt(idx * 2 + sIdx, dummy.matrix);
    });
    dummy.position.set(0, 4.6, z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    capInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(0, -1.5, z);
    dummy.updateMatrix();
    pileInst.setMatrixAt(idx, dummy.matrix);
  });
  colInst.computeBoundingSphere();
  capInst.computeBoundingSphere();
  pileInst.computeBoundingSphere();
  group.add(colInst, capInst, pileInst);

  // Steel Expansion Joints every ~38m along Main Span
  const jointGeo = trackGeo(new THREE.BoxGeometry(deckWidth - 1.4, 0.04, 0.35));
  const jointZs: number[] = [];
  for (let z = zStart - 16; z >= zEnd + 16; z -= 38) {
    jointZs.push(z);
  }
  const jointInst = new THREE.InstancedMesh(jointGeo, mats.steelDarkMat, jointZs.length);
  jointZs.forEach((z, idx) => {
    dummy.position.set(0, mainPiece.y0 + 0.02, z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    jointInst.setMatrixAt(idx, dummy.matrix);
  });
  jointInst.computeBoundingSphere();
  group.add(jointInst);

  return group;
}

/**
 * 2. ADEKUNLE OFF-RAMP (Elevated Southbound Viaduct Branching East to Adekunle / Obalende / Ikoyi)
 */
export function createAdekunleRamp(options: BridgeBuildOptions = {}): THREE.Group {
  const trackGeo = options.trackGeo ?? (<T extends THREE.BufferGeometry>(g: T): T => g);
  const mats = createSharedMats(options);
  const span = ELEVATED_SPANS.find((s) => s.id === 'ADEKUNLE_RAMP')!;

  const group = new THREE.Group();
  group.name = 'AdekunleRamp';

  span.pieces.forEach((piece) => {
    buildSlopedDeckPiece(group, piece, mats, trackGeo, {
      isFourLane: false,
      girderDepth: 0.9,
    });
  });

  // Skip parapets inside TMB gore splice (t < 0.10) and inside N_ADEKUNLE touchdown intersection (t > 0.90)
  buildSpanInstancedHardware(group, span, mats, trackGeo, {
    hasMedianBarrier: false,
    hasLaneDashes: false,
    skipStartT: 0.10,
    skipEndT: 0.90,
  });

  // Concrete Viaduct Support Columns along the ramp over lagoon shoreline
  const piece = span.pieces[0];
  const pierTs = [0.16, 0.32, 0.48, 0.64, 0.8];
  const yaw = Math.atan2(-(piece.x1 - piece.x0), -(piece.z1 - piece.z0));
  const capWidth = piece.halfWidth * 2 - 2.6;

  pierTs.forEach((t) => {
    const px = piece.x0 + (piece.x1 - piece.x0) * t;
    const py = piece.y0 + (piece.y1 - piece.y0) * t;
    const pz = piece.z0 + (piece.z1 - piece.z0) * t;
    const h = py + 1.2;

    const col = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.88, 1.08, h, 10)),
      mats.concretePierMat
    );
    col.position.set(px, py / 2 - 0.6, pz);
    col.castShadow = true;

    const cap = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(capWidth, 0.75, 2.0)),
      mats.concretePierMat
    );
    cap.position.set(px, py - 0.95, pz);
    cap.rotation.y = yaw;
    group.add(col, cap);
  });

  return group;
}

/**
 * 3. IKOYI-LEKKI LINK BRIDGE (Iconic Cable-Stayed Elevated Bridge Over Lagoon Channel)
 */
export function createIkoyiLinkBridge(options: BridgeBuildOptions = {}): THREE.Group {
  const trackGeo = options.trackGeo ?? (<T extends THREE.BufferGeometry>(g: T): T => g);
  const mats = createSharedMats(options);
  const span = ELEVATED_SPANS.find((s) => s.id === 'IKOYI_LINK')!;
  const mainPiece = span.pieces[1];

  const group = new THREE.Group();
  group.name = 'IkoyiLinkBridge';

  span.pieces.forEach((piece) => {
    buildSlopedDeckPiece(group, piece, mats, trackGeo, {
      isFourLane: true,
      girderDepth: 1.25,
    });
  });

  buildSpanInstancedHardware(group, span, mats, trackGeo, {
    hasMedianBarrier: true,
    hasLaneDashes: true,
  });

  // Twin Lagoon Piers along Ikoyi Link span
  const dummy = new THREE.Object3D();
  const xMin = Math.min(mainPiece.x0, mainPiece.x1);
  const xMax = Math.max(mainPiece.x0, mainPiece.x1);
  const mainSpanLen = xMax - xMin;
  const pierCount = 7;
  const pierXs: number[] = [];
  for (let i = 0; i < pierCount; i++) {
    pierXs.push(xMin + (mainSpanLen * i) / (pierCount - 1));
  }
  const deckWidth = mainPiece.halfWidth * 2;
  const colOffZ = mainPiece.halfWidth - 4.4;
  const colGeo = trackGeo(new THREE.CylinderGeometry(1.0, 1.2, 8.8, 12));
  const capGeo = trackGeo(new THREE.BoxGeometry(2.5, 1.1, deckWidth - 1.8));
  const pileGeo = trackGeo(new THREE.BoxGeometry(2.9, 1.4, deckWidth - 2.6));

  const colInst = new THREE.InstancedMesh(colGeo, mats.concretePierMat, pierXs.length * 2);
  const capInst = new THREE.InstancedMesh(capGeo, mats.concretePierMat, pierXs.length);
  const pileInst = new THREE.InstancedMesh(pileGeo, mats.seawallMat, pierXs.length);
  colInst.castShadow = true;

  pierXs.forEach((x, idx) => {
    [-colOffZ, colOffZ].forEach((pz, sIdx) => {
      dummy.position.set(x, 1.6, mainPiece.z0 + pz);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      colInst.setMatrixAt(idx * 2 + sIdx, dummy.matrix);
    });
    dummy.position.set(x, 5.65, mainPiece.z0);
    dummy.updateMatrix();
    capInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(x, -1.5, mainPiece.z0);
    dummy.updateMatrix();
    pileInst.setMatrixAt(idx, dummy.matrix);
  });
  colInst.computeBoundingSphere();
  capInst.computeBoundingSphere();
  pileInst.computeBoundingSphere();
  group.add(colInst, capInst, pileInst);

  // Iconic Central White Cable-Stayed Pylon Tower centered on main span
  const pylonBaseX = (xMin + xMax) * 0.5;
  const pylonZ = mainPiece.z0;
  const pylonTopY = 44.0;

  // Center tapered concrete-white mast standing on median island
  const lowerPedestal = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(3.4, 8.6, 2.4)),
    mats.pylonWhiteMat
  );
  lowerPedestal.position.set(pylonBaseX, 4.3, pylonZ);

  const upperTower = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.82, 1.45, 37.5, 12)),
    mats.pylonWhiteMat
  );
  upperTower.position.set(pylonBaseX, 7.0 + 18.75, pylonZ);
  upperTower.castShadow = true;

  // Sculptural blue crown ring on pylon tip
  const pylonCrown = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(1.05, 1.05, 2.4, 12)),
    mats.archBlueMat
  );
  pylonCrown.position.set(pylonBaseX, pylonTopY, pylonZ);
  group.add(lowerPedestal, upperTower, pylonCrown);

  // Fanning Diagonal Steel Stay Cables (9 each side along extended X span)
  const cableCount = 9;
  const maxReach = mainSpanLen * 0.48;
  const minReach = 14;
  const cableMat = mats.steelSilverMat;
  for (let idx = 0; idx < cableCount; idx++) {
    const frac = cableCount > 1 ? idx / (cableCount - 1) : 0;
    const dxAbs = minReach + frac * (maxReach - minReach);
    [-1, 1].forEach((dir) => {
      const anchorX = pylonBaseX + dir * dxAbs;
      const anchorY = 7.35;
      const topY = pylonTopY - 1.6 - idx * 1.45;
      const cDx = anchorX - pylonBaseX;
      const cDy = anchorY - topY;
      const cableLen = Math.hypot(cDx, cDy);

      const cable = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.095, 0.095, cableLen, 6)),
        cableMat
      );
      cable.position.set((pylonBaseX + anchorX) / 2, (topY + anchorY) / 2, pylonZ);
      cable.rotation.z = Math.atan2(-cDx, -cDy);
      group.add(cable);
    });
  }

  return group;
}

/**
 * 4. AJAH MULTI-LEVEL EXPRESS FLYOVER (True Vertical Separation Over Ajah Crossroad)
 */
export function createAjahFlyover(options: BridgeBuildOptions = {}): THREE.Group {
  const trackGeo = options.trackGeo ?? (<T extends THREE.BufferGeometry>(g: T): T => g);
  const mats = createSharedMats(options);
  const span = ELEVATED_SPANS.find((s) => s.id === 'AJAH_FLYOVER')!;
  const mainPiece = span.pieces[1];

  const group = new THREE.Group();
  group.name = 'AjahFlyover';

  span.pieces.forEach((piece) => {
    buildSlopedDeckPiece(group, piece, mats, trackGeo, {
      isFourLane: true,
      girderDepth: 0.95,
    });
  });

  buildSpanInstancedHardware(group, span, mats, trackGeo, {
    hasMedianBarrier: true,
    hasLaneDashes: true,
  });

  // Portal bents positioned strictly OUTSIDE the 27.6m-wide ground crossroad at centerX
  const centerX = (mainPiece.x0 + mainPiece.x1) * 0.5;
  const halfMain = Math.abs(mainPiece.x1 - mainPiece.x0) * 0.5;
  const pierXs = [
    centerX - halfMain + 3,
    centerX - 24,
    centerX + 24,
    centerX + halfMain - 3,
  ];
  const colOffZ = mainPiece.halfWidth - 2.9;
  const capDepth = mainPiece.halfWidth * 2 - 1.4;

  pierXs.forEach((px) => {
    [-colOffZ, colOffZ].forEach((pz) => {
      const col = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.76, 0.9, 5.4, 10)),
        mats.concretePierMat
      );
      col.position.set(px, 2.7, mainPiece.z0 + pz);
      col.castShadow = true;
      group.add(col);
    });
    const cap = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.0, 0.85, capDepth)),
      mats.concretePierMat
    );
    cap.position.set(px, 5.15, mainPiece.z0);
    group.add(cap);
  });

  return group;
}

/**
 * 5. EPE LAGOON BRIDGE (Preserved & Upgraded Coastal Steel-Arch Bridge Into Epe)
 */
export function createEpeBridge(options: BridgeBuildOptions = {}): THREE.Group {
  const trackGeo = options.trackGeo ?? (<T extends THREE.BufferGeometry>(g: T): T => g);
  const mats = createSharedMats(options);
  const span = ELEVATED_SPANS.find((s) => s.id === 'EPE_BRIDGE')!;
  const mainPiece = span.pieces[1];

  const group = new THREE.Group();
  group.name = 'EpeBridge';

  span.pieces.forEach((piece) => {
    buildSlopedDeckPiece(group, piece, mats, trackGeo, {
      isFourLane: true,
      girderDepth: 1.15,
    });
  });

  buildSpanInstancedHardware(group, span, mats, trackGeo, {
    hasMedianBarrier: true,
    hasLaneDashes: true,
  });

  // Twin Lagoon Piers in Epe Creek
  const xMin = Math.min(mainPiece.x0, mainPiece.x1);
  const xMax = Math.max(mainPiece.x0, mainPiece.x1);
  const pierXs = [xMin, xMin + (xMax - xMin) * 0.33, xMin + (xMax - xMin) * 0.67, xMax];
  const colOffZ = mainPiece.halfWidth - 4.4;
  const capDepth = mainPiece.halfWidth * 2 - 1.8;

  pierXs.forEach((px) => {
    [-colOffZ, colOffZ].forEach((pz) => {
      const col = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.95, 1.15, 7.6, 12)),
        mats.concretePierMat
      );
      col.position.set(px, 1.3, mainPiece.z0 + pz);
      col.castShadow = true;
      group.add(col);
    });
    const cap = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.3, 1.0, capDepth)),
      mats.concretePierMat
    );
    cap.position.set(px, 4.6, mainPiece.z0);
    group.add(cap);
  });

  // Twin Coastal Tied-Arch Blue Steel Ribs Spanning Main Creek Section
  const archSpan = xMax - xMin;
  const archCenter = (xMin + xMax) * 0.5;
  const segs = 18;
  const archZ = mainPiece.halfWidth - 1.15;
  [-archZ, archZ].forEach((rz) => {
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs;
      const t1 = (i + 1) / segs;
      const x0 = archCenter - archSpan / 2 + t0 * archSpan;
      const x1 = archCenter - archSpan / 2 + t1 * archSpan;
      const y0 = mainPiece.y0 + 14.5 * Math.sin(t0 * Math.PI);
      const y1 = mainPiece.y0 + 14.5 * Math.sin(t1 * Math.PI);
      const segLen = Math.hypot(x1 - x0, y1 - y0);

      const rib = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(segLen + 0.3, 0.9, 0.78)),
        mats.archBlueMat
      );
      rib.position.set((x0 + x1) / 2, (y0 + y1) / 2, mainPiece.z0 + rz);
      rib.rotation.z = Math.atan2(y1 - y0, x1 - x0);
      rib.castShadow = true;
      group.add(rib);

      // Vertical hanger cables from arch down to deck parapet
      if (i > 0 && i % 2 === 0) {
        const hH = y0 - mainPiece.y0;
        const hanger = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.085, 0.085, hH, 6)),
          mats.steelSilverMat
        );
        hanger.position.set(x0, mainPiece.y0 + hH / 2, mainPiece.z0 + rz);
        group.add(hanger);
      }
    }
  });

  return group;
}
