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
        [-5.4, 5.4].forEach((latOff) => {
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
 * 1. THIRD MAINLAND BRIDGE (22m Wide 4-Lane Dual Carriageway Across Lagos Lagoon)
 */
export function createThirdMainlandBridge(options: BridgeBuildOptions = {}): THREE.Group {
  const trackGeo = options.trackGeo ?? (<T extends THREE.BufferGeometry>(g: T): T => g);
  const mats = createSharedMats(options);
  const span = ELEVATED_SPANS.find((s) => s.id === 'TMB')!;

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

  // Instanced Concrete Piers & Water Pile Caps along Main Span (z = -205 .. -555)
  const dummy = new THREE.Object3D();
  const pierZs: number[] = [];
  for (let z = -205; z >= -555; z -= 25) {
    pierZs.push(z);
  }
  const colGeo = trackGeo(new THREE.CylinderGeometry(1.0, 1.2, 8.0, 12));
  const capGeo = trackGeo(new THREE.BoxGeometry(20.2, 1.15, 2.5));
  const pileGeo = trackGeo(new THREE.BoxGeometry(19.4, 1.4, 2.9));

  const colInst = new THREE.InstancedMesh(colGeo, mats.concretePierMat, pierZs.length * 2);
  const capInst = new THREE.InstancedMesh(capGeo, mats.concretePierMat, pierZs.length);
  const pileInst = new THREE.InstancedMesh(pileGeo, mats.seawallMat, pierZs.length);
  colInst.castShadow = true;

  pierZs.forEach((z, idx) => {
    [-6.6, 6.6].forEach((px, sIdx) => {
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

  // Steel Expansion Joints every 32m along Main Span
  const jointGeo = trackGeo(new THREE.BoxGeometry(20.6, 0.04, 0.35));
  const jointZs: number[] = [];
  for (let z = -220; z >= -540; z -= 32) {
    jointZs.push(z);
  }
  const jointInst = new THREE.InstancedMesh(jointGeo, mats.steelDarkMat, jointZs.length);
  jointZs.forEach((z, idx) => {
    dummy.position.set(0, 6.02, z);
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

  // Skip parapet right inside the TMB gore splice (t < 0.09)
  buildSpanInstancedHardware(group, span, mats, trackGeo, {
    hasMedianBarrier: false,
    hasLaneDashes: false,
    skipStartT: 0.09,
  });

  // Concrete Viaduct Support Columns along the ramp over lagoon shoreline
  const piece = span.pieces[0];
  const dummy = new THREE.Object3D();
  const pierTs = [0.18, 0.36, 0.54, 0.72];
  const yaw = Math.atan2(-(piece.x1 - piece.x0), -(piece.z1 - piece.z0));

  pierTs.forEach((t) => {
    const px = piece.x0 + (piece.x1 - piece.x0) * t;
    const py = piece.y0 + (piece.y1 - piece.y0) * t;
    const pz = piece.z0 + (piece.z1 - piece.z0) * t;
    const h = py + 1.2;

    const col = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.85, 1.05, h, 10)),
      mats.concretePierMat
    );
    col.position.set(px, py / 2 - 0.6, pz);
    col.castShadow = true;

    const cap = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(12.6, 0.75, 1.9)),
      mats.concretePierMat
    );
    cap.position.set(px, py - 0.95, pz);
    cap.rotation.y = yaw;
    group.add(col, cap);
  });

  void dummy;
  return group;
}

/**
 * 3. IKOYI-LEKKI LINK BRIDGE (Iconic Cable-Stayed Elevated Bridge Over Lagoon Channel)
 */
export function createIkoyiLinkBridge(options: BridgeBuildOptions = {}): THREE.Group {
  const trackGeo = options.trackGeo ?? (<T extends THREE.BufferGeometry>(g: T): T => g);
  const mats = createSharedMats(options);
  const span = ELEVATED_SPANS.find((s) => s.id === 'IKOYI_LINK')!;

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

  // Twin Lagoon Piers along Ikoyi Link span (x = 460..580, z = -20)
  const dummy = new THREE.Object3D();
  const pierXs = [460, 490, 520, 550, 580];
  const colGeo = trackGeo(new THREE.CylinderGeometry(0.95, 1.15, 8.8, 12));
  const capGeo = trackGeo(new THREE.BoxGeometry(2.4, 1.1, 20.2));
  const pileGeo = trackGeo(new THREE.BoxGeometry(2.8, 1.4, 19.4));

  const colInst = new THREE.InstancedMesh(colGeo, mats.concretePierMat, pierXs.length * 2);
  const capInst = new THREE.InstancedMesh(capGeo, mats.concretePierMat, pierXs.length);
  const pileInst = new THREE.InstancedMesh(pileGeo, mats.seawallMat, pierXs.length);
  colInst.castShadow = true;

  pierXs.forEach((x, idx) => {
    [-6.6, 6.6].forEach((pz, sIdx) => {
      dummy.position.set(x, 1.6, -20 + pz);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      colInst.setMatrixAt(idx * 2 + sIdx, dummy.matrix);
    });
    dummy.position.set(x, 5.65, -20);
    dummy.updateMatrix();
    capInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(x, -1.5, -20);
    dummy.updateMatrix();
    pileInst.setMatrixAt(idx, dummy.matrix);
  });
  colInst.computeBoundingSphere();
  capInst.computeBoundingSphere();
  pileInst.computeBoundingSphere();
  group.add(colInst, capInst, pileInst);

  // Iconic Central White Cable-Stayed Pylon Tower at (x = 520, z = -20)
  const pylonBaseX = 520;
  const pylonZ = -20;
  const pylonTopY = 38.0;

  // Center tapered concrete-white mast standing on median island
  const lowerPedestal = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(3.2, 8.6, 2.2)),
    mats.pylonWhiteMat
  );
  lowerPedestal.position.set(pylonBaseX, 4.3, pylonZ);

  const upperTower = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.75, 1.35, 31.5, 12)),
    mats.pylonWhiteMat
  );
  upperTower.position.set(pylonBaseX, 7.0 + 15.75, pylonZ);
  upperTower.castShadow = true;

  // Sculptural golden/blue crown ring on pylon tip
  const pylonCrown = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.95, 0.95, 2.2, 12)),
    mats.archBlueMat
  );
  pylonCrown.position.set(pylonBaseX, pylonTopY, pylonZ);
  group.add(lowerPedestal, upperTower, pylonCrown);

  // Fanning Diagonal Steel Stay Cables (10 each side along X)
  const cableOffsets = [10, 18, 26, 34, 42, 50, 58];
  const cableMat = mats.steelSilverMat;
  cableOffsets.forEach((dxAbs, idx) => {
    [-1, 1].forEach((dir) => {
      const anchorX = pylonBaseX + dir * dxAbs;
      const anchorY = 7.35;
      const topY = pylonTopY - 1.5 - idx * 1.45;
      const cDx = anchorX - pylonBaseX;
      const cDy = anchorY - topY;
      const cableLen = Math.hypot(cDx, cDy);

      const cable = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.09, 0.09, cableLen, 6)),
        cableMat
      );
      cable.position.set((pylonBaseX + anchorX) / 2, (topY + anchorY) / 2, pylonZ);
      cable.rotation.z = Math.atan2(-cDx, -cDy);
      group.add(cable);
    });
  });

  return group;
}

/**
 * 4. AJAH MULTI-LEVEL EXPRESS FLYOVER (True Vertical Separation Over Ajah Crossroad)
 */
export function createAjahFlyover(options: BridgeBuildOptions = {}): THREE.Group {
  const trackGeo = options.trackGeo ?? (<T extends THREE.BufferGeometry>(g: T): T => g);
  const mats = createSharedMats(options);
  const span = ELEVATED_SPANS.find((s) => s.id === 'AJAH_FLYOVER')!;

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

  // Portal bents positioned strictly OUTSIDE the 22m-wide ground crossroad at x = 1135
  // Leaves a clear 34m wide x 5.25m high underpass beneath the flyover!
  const pierXs = [1098, 1117, 1153, 1172];
  pierXs.forEach((px) => {
    [-6.2, 6.2].forEach((pz) => {
      const col = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.72, 0.85, 5.4, 10)),
        mats.concretePierMat
      );
      col.position.set(px, 2.7, 100 + pz);
      col.castShadow = true;
      group.add(col);
    });
    const cap = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.9, 0.85, 16.5)),
      mats.concretePierMat
    );
    cap.position.set(px, 5.15, 100);
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

  // Twin Lagoon Piers in Epe Creek (x = 1360..1415, z = 100)
  [1360, 1388, 1415].forEach((px) => {
    [-6.6, 6.6].forEach((pz) => {
      const col = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.9, 1.1, 7.6, 12)),
        mats.concretePierMat
      );
      col.position.set(px, 1.3, 100 + pz);
      col.castShadow = true;
      group.add(col);
    });
    const cap = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.2, 1.0, 19.5)),
      mats.concretePierMat
    );
    cap.position.set(px, 4.6, 100);
    group.add(cap);
  });

  // Twin Coastal Tied-Arch Blue Steel Ribs Spanning Main Creek Section (1360..1415)
  const archSpan = 55;
  const archCenter = 1387.5;
  const segs = 14;
  [-9.9, 9.9].forEach((rz) => {
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs;
      const t1 = (i + 1) / segs;
      const x0 = archCenter - archSpan / 2 + t0 * archSpan;
      const x1 = archCenter - archSpan / 2 + t1 * archSpan;
      const y0 = 5.8 + 11.5 * Math.sin(t0 * Math.PI);
      const y1 = 5.8 + 11.5 * Math.sin(t1 * Math.PI);
      const segLen = Math.hypot(x1 - x0, y1 - y0);

      const rib = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(segLen + 0.25, 0.85, 0.75)),
        mats.archBlueMat
      );
      rib.position.set((x0 + x1) / 2, (y0 + y1) / 2, 100 + rz);
      rib.rotation.z = Math.atan2(y1 - y0, x1 - x0);
      rib.castShadow = true;
      group.add(rib);

      // Vertical hanger cables from arch down to deck parapet
      if (i > 0 && i % 2 === 0) {
        const hH = y0 - 5.8;
        const hanger = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.08, 0.08, hH, 6)),
          mats.steelSilverMat
        );
        hanger.position.set(x0, 5.8 + hH / 2, 100 + rz);
        group.add(hanger);
      }
    }
  });

  return group;
}
