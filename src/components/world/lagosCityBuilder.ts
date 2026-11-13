// MANIFOLD WORLD - PREMIUM LAGOS MAINLAND 3D ENVIRONMENT BUILDER
// Procedural architectural generation for Yaba Tech, Commercial Avenue, Surulere Express,
// Logistics Depot, Grand Marketplace Portal, Street Character, and Tropical Landscaping.

import * as THREE from 'three';
import {
  LAGOS_ROAD_NODES,
  LAGOS_BUILDINGS,
  CITY_LANDMARKS,
  RIVAL_RACE_CHECKPOINTS,
  BuildingBox,
} from './lagosCityData';
import { createLagosTexturePack } from './lagosTextures';
import type { TimeOfDay } from './WorldCanvas';

export interface LagosCityResult {
  cityGroup: THREE.Group;
  collidableBuildings: BuildingBox[];
  checkpointMeshes: { id: number; mesh: THREE.Group; active: boolean }[];
  landmarkMarkers: { id: string; group: THREE.Group }[];
  gpsRouteLine: THREE.Line;
  updateGPSRoute: (path: { x: number; z: number }[]) => void;
  updateTimeOfDay?: (mode: TimeOfDay) => void;
  dispose?: () => void;
}

interface RoadSegment {
  aX: number;
  aZ: number;
  bX: number;
  bZ: number;
  isExpressway: boolean;
  width: number;
  length: number;
  angle: number;
}

function pointToSegmentDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq <= 1e-6) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / lenSq));
  const projX = ax + t * vx;
  const projZ = az + t * vz;
  return Math.hypot(px - projX, pz - projZ);
}

export function buildLagosCityDistrict(maxAnisotropy: number = 4): LagosCityResult {
  const cityGroup = new THREE.Group();
  const texPack = createLagosTexturePack(maxAnisotropy);

  const localGeometries: THREE.BufferGeometry[] = [];
  const localMaterials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    localGeometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    localMaterials.push(m);
    return m;
  };

  // Shared materials for street hardware & accents
  const steelDarkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.42, metalness: 0.72 })
  );
  const steelSilverMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.78 })
  );
  const barrierYellowMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5, metalness: 0.15 })
  );
  const redPaintMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.48, metalness: 0.18 })
  );
  const darkMetalMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.65 })
  );
  const waterTankBlueMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.42, metalness: 0.1 })
  );
  const goldAccentMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.25, metalness: 0.85 })
  );
  const greenSignMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.45, metalness: 0.12 })
  );
  const woodCrateMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x7c5338, roughness: 0.85, metalness: 0.05 })
  );
  const catEyeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    })
  );

  // =========================================================================
  // 1. TERRAIN, HORIZON & ROAD NETWORK EXTRACTION
  // =========================================================================
  const groundGeo = trackGeo(new THREE.PlaneGeometry(760, 760, 12, 12));
  const ground = new THREE.Mesh(groundGeo, texPack.groundTerrainMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  cityGroup.add(ground);

  // Inner district concrete-earth base slab
  const districtBaseGeo = trackGeo(new THREE.PlaneGeometry(360, 360));
  const districtBase = new THREE.Mesh(districtBaseGeo, texPack.groundTerrainMat);
  districtBase.rotation.x = -Math.PI / 2;
  districtBase.position.y = -0.06;
  districtBase.receiveShadow = true;
  cityGroup.add(districtBase);

  const roadSegments: RoadSegment[] = [];
  const processedEdges = new Set<string>();

  Object.values(LAGOS_ROAD_NODES).forEach((node) => {
    node.neighbors.forEach((neighborId) => {
      const neighbor = LAGOS_ROAD_NODES[neighborId];
      if (!neighbor) return;

      const edgeKey = [node.id, neighbor.id].sort().join('--');
      if (processedEdges.has(edgeKey)) return;
      processedEdges.add(edgeKey);

      const dx = neighbor.x - node.x;
      const dz = neighbor.z - node.z;
      const length = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, dz);
      const isExpressway =
        (node.speedLimit || 50) >= 65 || (neighbor.speedLimit || 50) >= 65;

      roadSegments.push({
        aX: node.x,
        aZ: node.z,
        bX: neighbor.x,
        bZ: neighbor.z,
        isExpressway,
        width: isExpressway ? 15.6 : 13.8,
        length,
        angle,
      });
    });
  });

  const distToNearestRoad = (px: number, pz: number): number => {
    let minD = Infinity;
    for (let i = 0; i < roadSegments.length; i++) {
      const s = roadSegments[i];
      const d = pointToSegmentDist(px, pz, s.aX, s.aZ, s.bX, s.bZ);
      if (d < minD) minD = d;
    }
    return minD;
  };

  // =========================================================================
  // 2. ROADWAYS, SIDEWALKS, DRAINAGE, MARKINGS & STREET INFRASTRUCTURE
  // =========================================================================
  const lightTransforms: { x: number; y: number; z: number; angle: number }[] = [];
  const utilityPoleTransforms: { x: number; z: number; angle: number }[] = [];
  const catEyeTransforms: { x: number; z: number }[] = [];
  const dashGeo = trackGeo(new THREE.PlaneGeometry(0.24, 3.0));
  const stencilArrowTex = texPack.createPavementStencilTexture('ARROW_STRAIGHT');
  const stencilArrowMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: stencilArrowTex,
      transparent: true,
      roughness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const stencil80Tex = texPack.createPavementStencilTexture('SPEED_80');
  const stencil80Mat = trackMat(
    new THREE.MeshStandardMaterial({
      map: stencil80Tex,
      transparent: true,
      roughness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const stencilGeo = trackGeo(new THREE.PlaneGeometry(2.8, 3.4));

  roadSegments.forEach((seg) => {
    const midX = (seg.aX + seg.bX) / 2;
    const midZ = (seg.aZ + seg.bZ) / 2;
    const roadWidth = seg.width;
    const roadLength = seg.length;
    const angle = seg.angle;

    // Right-hand perpendicular vector for lateral offsets
    const rightX = Math.cos(angle);
    const rightZ = -Math.sin(angle);
    const fwdX = Math.sin(angle);
    const fwdZ = Math.cos(angle);

    // Asphalt carriageway
    const roadGeo = trackGeo(new THREE.PlaneGeometry(roadWidth, roadLength));
    const roadMesh = new THREE.Mesh(
      roadGeo,
      seg.isExpressway ? texPack.expresswayRoadMat : texPack.commercialRoadMat
    );
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.rotation.z = -angle;
    roadMesh.position.set(midX, 0.01, midZ);
    roadMesh.receiveShadow = true;
    cityGroup.add(roadMesh);

    // Trim lengths for sidewalks & curbs so they stop cleanly before junction circles
    const trimLen = Math.max(4, roadLength - 18.5);

    // Sunken Concrete Drainage Channels + Raised Curbs + Sidewalks
    [-1, 1].forEach((side) => {
      // Drainage gutter (between road edge and curb)
      const drainOffset = side * (roadWidth / 2 + 0.35);
      const drainGeo = trackGeo(new THREE.BoxGeometry(0.65, 0.08, trimLen));
      const drainMesh = new THREE.Mesh(drainGeo, texPack.drainageMat);
      drainMesh.rotation.y = angle;
      drainMesh.position.set(midX + rightX * drainOffset, -0.02, midZ + rightZ * drainOffset);
      drainMesh.receiveShadow = true;
      cityGroup.add(drainMesh);

      // Raised Concrete Curb
      const curbOffset = side * (roadWidth / 2 + 0.85);
      const curbGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.24, trimLen));
      const curbMesh = new THREE.Mesh(curbGeo, texPack.curbMat);
      curbMesh.rotation.y = angle;
      curbMesh.position.set(midX + rightX * curbOffset, 0.12, midZ + rightZ * curbOffset);
      curbMesh.receiveShadow = true;
      cityGroup.add(curbMesh);

      // Paved Pedestrian Sidewalk
      const walkOffset = side * (roadWidth / 2 + 2.45);
      const walkGeo = trackGeo(new THREE.BoxGeometry(2.8, 0.18, trimLen));
      const walkMesh = new THREE.Mesh(walkGeo, texPack.sidewalkMat);
      walkMesh.rotation.y = angle;
      walkMesh.position.set(midX + rightX * walkOffset, 0.09, midZ + rightZ * walkOffset);
      walkMesh.receiveShadow = true;
      cityGroup.add(walkMesh);

      // Shoulder solid white edge line
      const edgeOffset = side * (roadWidth / 2 - 0.55);
      const edgeLineGeo = trackGeo(new THREE.PlaneGeometry(0.18, roadLength - 14));
      const edgeLine = new THREE.Mesh(edgeLineGeo, texPack.whiteMarkMat);
      edgeLine.rotation.x = -Math.PI / 2;
      edgeLine.rotation.z = -angle;
      edgeLine.position.set(midX + rightX * edgeOffset, 0.022, midZ + rightZ * edgeOffset);
      cityGroup.add(edgeLine);

      // Expressway outer steel guardrails along straight stretches
      if (seg.isExpressway && trimLen > 24) {
        const railOffset = side * (roadWidth / 2 + 1.25);
        const railGeo = trackGeo(new THREE.BoxGeometry(0.12, 0.42, trimLen - 4));
        const railMesh = new THREE.Mesh(railGeo, steelSilverMat);
        railMesh.rotation.y = angle;
        railMesh.position.set(midX + rightX * railOffset, 0.52, midZ + rightZ * railOffset);
        railMesh.castShadow = true;
        cityGroup.add(railMesh);
      }
    });

    // Center Markings: Double yellow centerline + lane dividers
    const centerLineLen = Math.max(4, roadLength - 19);
    [-0.22, 0.22].forEach((offset) => {
      const yGeo = trackGeo(new THREE.PlaneGeometry(0.16, centerLineLen));
      const yMesh = new THREE.Mesh(yGeo, texPack.yellowMarkMat);
      yMesh.rotation.x = -Math.PI / 2;
      yMesh.rotation.z = -angle;
      yMesh.position.set(midX + rightX * offset, 0.024, midZ + rightZ * offset);
      cityGroup.add(yMesh);
    });

    // Raised median curb along long Expressways (breaks safely outside intersections)
    if (seg.isExpressway && centerLineLen > 26) {
      const medianGeo = trackGeo(new THREE.BoxGeometry(0.46, 0.28, centerLineLen - 8));
      const medianMesh = new THREE.Mesh(medianGeo, texPack.curbMat);
      medianMesh.rotation.y = angle;
      medianMesh.position.set(midX, 0.14, midZ);
      cityGroup.add(medianMesh);
    }

    // Dashed white lane dividers & reflective road studs
    const dashStep = 7.0;
    const numDashes = Math.floor(centerLineLen / dashStep);
    for (let i = -Math.floor(numDashes / 2); i <= Math.floor(numDashes / 2); i++) {
      const along = i * dashStep;
      const px = midX + fwdX * along;
      const pz = midZ + fwdZ * along;

      // Reflective cat-eye stud along centerline
      catEyeTransforms.push({ x: px, z: pz });

      // Expressway 4-lane dashed splits
      if (seg.isExpressway) {
        [-roadWidth * 0.24, roadWidth * 0.24].forEach((laneOff) => {
          const dash = new THREE.Mesh(dashGeo, texPack.whiteMarkMat);
          dash.rotation.x = -Math.PI / 2;
          dash.rotation.z = -angle;
          dash.position.set(px + rightX * laneOff, 0.024, pz + rightZ * laneOff);
          cityGroup.add(dash);
        });
      }
    }

    // Pavement Direction Arrows & Speed-Limit 80 Markings
    if (roadLength >= 40) {
      const arrow1 = new THREE.Mesh(stencilGeo, stencilArrowMat);
      arrow1.rotation.x = -Math.PI / 2;
      arrow1.rotation.z = -angle;
      arrow1.position.set(
        midX + rightX * (roadWidth * 0.22) + fwdX * (roadLength * 0.18),
        0.026,
        midZ + rightZ * (roadWidth * 0.22) + fwdZ * (roadLength * 0.18)
      );
      cityGroup.add(arrow1);

      const arrow2 = new THREE.Mesh(stencilGeo, stencilArrowMat);
      arrow2.rotation.x = -Math.PI / 2;
      arrow2.rotation.z = -angle + Math.PI;
      arrow2.position.set(
        midX - rightX * (roadWidth * 0.22) - fwdX * (roadLength * 0.18),
        0.026,
        midZ - rightZ * (roadWidth * 0.22) - fwdZ * (roadLength * 0.18)
      );
      cityGroup.add(arrow2);

      if (seg.isExpressway) {
        const speedMark = new THREE.Mesh(stencilGeo, stencil80Mat);
        speedMark.rotation.x = -Math.PI / 2;
        speedMark.rotation.z = -angle;
        speedMark.position.set(midX + rightX * (roadWidth * 0.24), 0.026, midZ + rightZ * (roadWidth * 0.24));
        cityGroup.add(speedMark);
      }
    }

    // Stop Bars near Junction Approaches
    [-1, 1].forEach((endDir) => {
      const stopDist = roadLength / 2 - 11.2;
      if (stopDist > 6) {
        const sx = midX + fwdX * (stopDist * endDir) + rightX * (endDir * roadWidth * 0.23);
        const sz = midZ + fwdZ * (stopDist * endDir) + rightZ * (endDir * roadWidth * 0.23);
        const stopGeo = trackGeo(new THREE.PlaneGeometry(roadWidth * 0.42, 0.55));
        const stopMesh = new THREE.Mesh(stopGeo, texPack.whiteMarkMat);
        stopMesh.rotation.x = -Math.PI / 2;
        stopMesh.rotation.z = -angle;
        stopMesh.position.set(sx, 0.026, sz);
        cityGroup.add(stopMesh);
      }
    });

    // Streetlight & Utility Pole Coordinates (strictly on sidewalks)
    const numLights = Math.max(1, Math.floor(roadLength / 30));
    for (let i = 1; i <= numLights; i++) {
      const t = i / (numLights + 1);
      const baseX = seg.aX + (seg.bX - seg.aX) * t;
      const baseZ = seg.aZ + (seg.bZ - seg.aZ) * t;

      // Alternate or bilateral streetlights on expressways
      const sides = seg.isExpressway ? [-1, 1] : [i % 2 === 0 ? 1 : -1];
      sides.forEach((s) => {
        const lx = baseX + rightX * (s * (roadWidth / 2 + 1.45));
        const lz = baseZ + rightZ * (s * (roadWidth / 2 + 1.45));
        // Only place if not inside another intersection
        if (Math.hypot(lx - seg.aX, lz - seg.aZ) > 12 && Math.hypot(lx - seg.bX, lz - seg.bZ) > 12) {
          lightTransforms.push({
            x: lx,
            y: 0,
            z: lz,
            angle: s === 1 ? angle + Math.PI / 2 : angle - Math.PI / 2,
          });
        }
      });

      // Utility pole on opposite sidewalk for non-expressways
      if (!seg.isExpressway) {
        const uSide = i % 2 === 0 ? -1 : 1;
        const ux = baseX + rightX * (uSide * (roadWidth / 2 + 3.4));
        const uz = baseZ + rightZ * (uSide * (roadWidth / 2 + 3.4));
        if (Math.hypot(ux - seg.aX, uz - seg.aZ) > 13 && Math.hypot(ux - seg.bX, uz - seg.bZ) > 13) {
          utilityPoleTransforms.push({ x: ux, z: uz, angle });
        }
      }
    }
  });

  // Render Instanced Streetlights (Poles + Horizontal Arms + Emissive Lamps)
  if (lightTransforms.length > 0) {
    const poleGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.18, 7.6, 8));
    poleGeo.translate(0, 3.8, 0);
    const armGeo = trackGeo(new THREE.BoxGeometry(1.6, 0.14, 0.16));
    armGeo.translate(0.7, 7.55, 0);
    const lampGeo = trackGeo(new THREE.BoxGeometry(0.85, 0.16, 0.38));
    lampGeo.translate(1.35, 7.45, 0);

    const poleInst = new THREE.InstancedMesh(poleGeo, steelDarkMat, lightTransforms.length);
    const armInst = new THREE.InstancedMesh(armGeo, steelSilverMat, lightTransforms.length);
    const lampInst = new THREE.InstancedMesh(lampGeo, texPack.streetlightBulbMat, lightTransforms.length);
    poleInst.castShadow = true;

    const dummy = new THREE.Object3D();
    lightTransforms.forEach((lt, idx) => {
      dummy.position.set(lt.x, 0, lt.z);
      dummy.rotation.set(0, lt.angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poleInst.setMatrixAt(idx, dummy.matrix);
      armInst.setMatrixAt(idx, dummy.matrix);
      lampInst.setMatrixAt(idx, dummy.matrix);
    });
    poleInst.computeBoundingSphere();
    armInst.computeBoundingSphere();
    lampInst.computeBoundingSphere();
    cityGroup.add(poleInst, armInst, lampInst);
  }

  // Render Instanced Utility Poles + Crossarms
  if (utilityPoleTransforms.length > 0) {
    const uPoleGeo = trackGeo(new THREE.CylinderGeometry(0.12, 0.16, 8.8, 8));
    uPoleGeo.translate(0, 4.4, 0);
    const crossArmGeo = trackGeo(new THREE.BoxGeometry(1.9, 0.14, 0.14));
    crossArmGeo.translate(0, 8.2, 0);

    const uPoleInst = new THREE.InstancedMesh(uPoleGeo, woodCrateMat, utilityPoleTransforms.length);
    const uArmInst = new THREE.InstancedMesh(crossArmGeo, steelDarkMat, utilityPoleTransforms.length);
    const dummy = new THREE.Object3D();

    utilityPoleTransforms.forEach((ut, idx) => {
      dummy.position.set(ut.x, 0, ut.z);
      dummy.rotation.set(0, ut.angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      uPoleInst.setMatrixAt(idx, dummy.matrix);
      uArmInst.setMatrixAt(idx, dummy.matrix);
    });
    uPoleInst.computeBoundingSphere();
    uArmInst.computeBoundingSphere();
    cityGroup.add(uPoleInst, uArmInst);

    // Overhead power lines between nearby poles on the same side corridor
    const wireMat = trackMat(new THREE.LineBasicMaterial({ color: 0x1e293b }));
    for (let i = 0; i < utilityPoleTransforms.length; i++) {
      for (let j = i + 1; j < utilityPoleTransforms.length; j++) {
        const p1 = utilityPoleTransforms[i];
        const p2 = utilityPoleTransforms[j];
        const d = Math.hypot(p1.x - p2.x, p1.z - p2.z);
        if (d > 14 && d < 36) {
          const midX = (p1.x + p2.x) / 2;
          const midZ = (p1.z + p2.z) / 2;
          if (distToNearestRoad(midX, midZ) > 6.8) {
            const curve = new THREE.QuadraticBezierCurve3(
              new THREE.Vector3(p1.x, 8.2, p1.z),
              new THREE.Vector3(midX, 7.4, midZ),
              new THREE.Vector3(p2.x, 8.2, p2.z)
            );
            const wGeo = trackGeo(new THREE.BufferGeometry().setFromPoints(curve.getPoints(6)));
            cityGroup.add(new THREE.Line(wGeo, wireMat));
          }
        }
      }
    }
  }

  // Render Instanced Reflective Road Studs (Cat-eyes)
  if (catEyeTransforms.length > 0) {
    const studGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.05, 0.18));
    studGeo.translate(0, 0.025, 0);
    const studInst = new THREE.InstancedMesh(studGeo, catEyeMat, catEyeTransforms.length);
    const dummy = new THREE.Object3D();
    catEyeTransforms.forEach((st, idx) => {
      dummy.position.set(st.x, 0, st.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      studInst.setMatrixAt(idx, dummy.matrix);
    });
    studInst.computeBoundingSphere();
    cityGroup.add(studInst);
  }

  // Intersection Junction Pads, Zebra Crosswalks & Traffic Signals
  const zebraStripeGeo = trackGeo(new THREE.PlaneGeometry(0.65, 3.0));
  const majorSignalNodes = new Set(['N_CENTRAL_JCT', 'N_EAST_AVE_2', 'N_YABA_TECH_JCT', 'N_SOUTH_GATE']);

  Object.values(LAGOS_ROAD_NODES).forEach((node) => {
    const isExpress = (node.speedLimit || 50) >= 65;
    const jctGeo = trackGeo(new THREE.CircleGeometry(isExpress ? 11.4 : 10.6, 28));
    const jctMesh = new THREE.Mesh(
      jctGeo,
      isExpress ? texPack.expresswayRoadMat : texPack.commercialRoadMat
    );
    jctMesh.rotation.x = -Math.PI / 2;
    jctMesh.position.set(node.x, 0.014, node.z);
    jctMesh.receiveShadow = true;
    cityGroup.add(jctMesh);

    // Crosswalks along connected neighbor approaches
    node.neighbors.forEach((nId) => {
      const nb = LAGOS_ROAD_NODES[nId];
      if (!nb) return;
      const dx = nb.x - node.x;
      const dz = nb.z - node.z;
      const ang = Math.atan2(dx, dz);
      const dist = Math.hypot(dx, dz);
      if (dist < 25) return;

      const dirX = dx / dist;
      const dirZ = dz / dist;
      const rightX = Math.cos(ang);
      const rightZ = -Math.sin(ang);

      for (let i = -3; i <= 3; i++) {
        const cx = node.x + dirX * 9.5 + rightX * (i * 1.45);
        const cz = node.z + dirZ * 9.5 + rightZ * (i * 1.45);
        const stripe = new THREE.Mesh(zebraStripeGeo, texPack.whiteMarkMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.rotation.z = -ang;
        stripe.position.set(cx, 0.025, cz);
        cityGroup.add(stripe);
      }
    });

    // Traffic Signal Poles at Major 3/4-Way Intersections
    if (majorSignalNodes.has(node.id)) {
      const sigCorners = [
        { ox: 9.2, oz: 9.2, rot: Math.PI / 4 },
        { ox: -9.2, oz: -9.2, rot: -Math.PI * 0.75 },
      ];
      sigCorners.forEach((sc, idx) => {
        const sigGroup = new THREE.Group();
        sigGroup.position.set(node.x + sc.ox, 0, node.z + sc.oz);
        sigGroup.rotation.y = sc.rot;

        const sigPole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.12, 0.15, 5.2, 8)), steelDarkMat);
        sigPole.position.y = 2.6;
        const sigArm = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 0.14, 0.14)), steelDarkMat);
        sigArm.position.set(-1.1, 5.0, 0);
        const headBox = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 1.25, 0.35)), darkMetalMat);
        headBox.position.set(-2.1, 4.5, 0);

        const redLamp = new THREE.Mesh(
          trackGeo(new THREE.CircleGeometry(0.13, 12)),
          trackMat(new THREE.MeshBasicMaterial({ color: idx === 0 ? 0x22c55e : 0xef4444 }))
        );
        redLamp.position.set(-2.1, idx === 0 ? 4.15 : 4.85, 0.19);
        const redLampBack = redLamp.clone();
        redLampBack.position.z = -0.19;
        redLampBack.rotation.y = Math.PI;

        sigGroup.add(sigPole, sigArm, headBox, redLamp, redLampBack);
        cityGroup.add(sigGroup);
      });
    }
  });

  // Sabo Central Roundabout Architectural Island (Center of N_CENTRAL_JCT [0, 0])
  {
    const islandGroup = new THREE.Group();
    islandGroup.position.set(0, 0, 0);
    const islandCurb = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(2.8, 3.0, 0.32, 24)),
      texPack.curbMat
    );
    islandCurb.position.y = 0.16;
    const islandTurf = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(2.45, 2.45, 0.36, 24)),
      texPack.medianGrassMat
    );
    islandTurf.position.y = 0.18;
    const monumentPlinth = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.95, 1.2, 0.9, 12)),
      steelDarkMat
    );
    monumentPlinth.position.y = 0.65;
    const monumentFin = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.55, 2.4, 6)),
      goldAccentMat
    );
    monumentFin.position.y = 2.25;
    islandGroup.add(islandCurb, islandTurf, monumentPlinth, monumentFin);
    cityGroup.add(islandGroup);
  }

  // =========================================================================
  // 3. ARCHITECTURAL BUILDINGS (EXISTING + PLAYABLE INFILL BLOCKS)
  // =========================================================================
  const extraInfillBuildings: BuildingBox[] = [
    {
      id: 'B_INFILL_HOTEL',
      x: 28,
      z: -68,
      width: 20,
      depth: 18,
      height: 26,
      name: 'Eko Palms Boutique Hotel',
      type: 'commercial',
      color: 0xe2e8f0,
      roofColor: 0x0f172a,
      hasSign: true,
      signText: 'EKO PALMS HOTEL',
    },
    {
      id: 'B_INFILL_SABO_PLAZA',
      x: -30,
      z: 32,
      width: 22,
      depth: 20,
      height: 15,
      name: 'Sabo Digital & Auto Plaza',
      type: 'commercial',
      color: 0xd97706,
      roofColor: 0x1e293b,
      hasSign: true,
      signText: 'SABO AUTO PLAZA',
    },
    {
      id: 'B_INFILL_YABA_ANNEX',
      x: 76,
      z: -88,
      width: 24,
      depth: 24,
      height: 28,
      name: 'Yaba Fiber & Cloud Annex',
      type: 'tech_hub',
      color: 0x1e293b,
      roofColor: 0x0284c7,
      hasSign: true,
      signText: 'MAINLAND CLOUD DATA',
    },
    {
      id: 'B_INFILL_RES_SURULERE',
      x: 32,
      z: 66,
      width: 24,
      depth: 22,
      height: 18,
      name: 'Bode Thomas Terrace Flats',
      type: 'residential',
      color: 0xcbd5e1,
      roofColor: 0x7c2d12,
      hasSign: false,
    },
    {
      id: 'B_INFILL_RES_NORTH',
      x: -28,
      z: -70,
      width: 18,
      depth: 20,
      height: 16,
      name: 'Herbert Macaulay Courts',
      type: 'residential',
      color: 0xe6dfd1,
      roofColor: 0x334155,
      hasSign: false,
    },
  ];

  // Validate that no infill building overlaps any road
  const validatedInfill = extraInfillBuildings.filter((b) => {
    const clearMargin = Math.max(b.width, b.depth) / 2 + 8.5;
    return distToNearestRoad(b.x, b.z) >= clearMargin;
  });

  const allCollidableBuildings: BuildingBox[] = [...LAGOS_BUILDINGS, ...validatedInfill];

  const buildCompositeBuilding = (b: BuildingBox) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(b.x, 0, b.z);

    // Choose architectural material palette by building type
    let facadeMat: THREE.Material = texPack.stuccoCreamMat;
    if (b.type === 'tech_hub') facadeMat = texPack.glassTowerMat;
    else if (b.type === 'bank') facadeMat = texPack.bankGlassMat;
    else if (b.type === 'depot') facadeMat = texPack.corrugatedDepotMat;
    else if (b.type === 'commercial') {
      facadeMat = b.id.includes('HOTEL') || b.id.includes('GALLERIA')
        ? texPack.stuccoSlateMat
        : texPack.stuccoOchreMat;
    } else if (b.type === 'residential') {
      facadeMat = b.id.includes('2') ? texPack.stuccoCreamMat : texPack.stuccoOchreMat;
    }

    const trimMat = trackMat(
      new THREE.MeshStandardMaterial({ color: b.roofColor, roughness: 0.42, metalness: 0.45 })
    );

    if (b.type === 'tech_hub' || b.type === 'bank') {
      // Modern Multi-Tiered Tower: Granite Podium + Glazed Tower + Roof Crown & Comms Mast
      const podiumH = Math.min(5.2, b.height * 0.25);
      const podiumMesh = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width, podiumH, b.depth)),
        steelDarkMat
      );
      podiumMesh.position.y = podiumH / 2;
      podiumMesh.castShadow = true;
      podiumMesh.receiveShadow = true;
      bGroup.add(podiumMesh);

      const towerH = b.height - podiumH;
      const towerMesh = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.9, towerH, b.depth * 0.9)),
        facadeMat
      );
      towerMesh.position.y = podiumH + towerH / 2;
      towerMesh.castShadow = true;
      towerMesh.receiveShadow = true;
      bGroup.add(towerMesh);

      // Vertical architectural fins along front & back facades
      const finCount = Math.max(3, Math.floor(b.width / 5));
      for (let i = 0; i < finCount; i++) {
        const fx = -b.width * 0.42 + (i / Math.max(1, finCount - 1)) * (b.width * 0.84);
        const finFront = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.45, towerH + 1.0, 0.7)),
          trimMat
        );
        finFront.position.set(fx, podiumH + towerH / 2 + 0.5, b.depth * 0.45 + 0.2);
        const finBack = finFront.clone();
        finBack.position.z = -b.depth * 0.45 - 0.2;
        bGroup.add(finFront, finBack);
      }

      // Roof crown parapet & HVAC mechanical unit + telecom spire
      const crown = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.94, 1.1, b.depth * 0.94)),
        trimMat
      );
      crown.position.y = b.height + 0.55;
      const hvac = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.35, 1.8, b.depth * 0.3)),
        texPack.roofConcreteMat
      );
      hvac.position.set(-b.width * 0.15, b.height + 1.9, 0);
      const spire = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.08, 0.18, 6.5, 6)),
        steelSilverMat
      );
      spire.position.set(b.width * 0.22, b.height + 4.0, 0);
      bGroup.add(crown, hvac, spire);

      // Entrance Porte-Cochère Canopy
      const canopy = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.45, 0.4, 3.2)),
        trimMat
      );
      canopy.position.set(0, 3.8, b.depth / 2 + 1.3);
      const doorGlass = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(b.width * 0.32, 3.2)),
        texPack.nightWindowCoolMat
      );
      doorGlass.position.set(0, 1.6, b.depth / 2 + 0.06);
      bGroup.add(canopy, doorGlass);
    } else if (b.type === 'depot') {
      // Industrial Cargo Warehouse with Corrugated Cladding, Loading Bays, Dock Bumpers & Roof Vents
      const body = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width, b.height, b.depth)),
        facadeMat
      );
      body.position.y = b.height / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      bGroup.add(body);

      // Colored corporate fascia band
      const fascia = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width + 0.6, 1.6, b.depth + 0.6)),
        trimMat
      );
      fascia.position.y = b.height - 0.5;
      bGroup.add(fascia);

      // Pitched industrial roof cap
      const roof = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.85, 1.2, b.depth * 0.85)),
        texPack.roofConcreteMat
      );
      roof.position.y = b.height + 0.6;
      bGroup.add(roof);

      // Loading Bay Roll-up Doors + Yellow Safety Bollards
      const numBays = Math.max(2, Math.floor(b.width / 8));
      for (let i = 0; i < numBays; i++) {
        const bx = -b.width * 0.35 + (i / Math.max(1, numBays - 1)) * (b.width * 0.7);
        const bayDoor = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(4.2, 4.0, 0.25)),
          steelDarkMat
        );
        bayDoor.position.set(bx, 2.1, b.depth / 2 + 0.08);
        const bayAwning = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(4.8, 0.25, 1.6)),
          trimMat
        );
        bayAwning.position.set(bx, 4.35, b.depth / 2 + 0.75);
        bGroup.add(bayDoor, bayAwning);
      }
    } else {
      // Commercial Plazas & Nigerian Residential Apartments (Balconies, AC Units, Overhead Tanks, Compound Wall)
      const groundH = 4.0;
      const groundFloor = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width, groundH, b.depth)),
        steelDarkMat
      );
      groundFloor.position.y = groundH / 2;
      groundFloor.castShadow = true;
      groundFloor.receiveShadow = true;
      bGroup.add(groundFloor);

      const upperH = Math.max(4, b.height - groundH);
      const upperBody = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.96, upperH, b.depth * 0.96)),
        facadeMat
      );
      upperBody.position.y = groundH + upperH / 2;
      upperBody.castShadow = true;
      upperBody.receiveShadow = true;
      bGroup.add(upperBody);

      // Parapet / cornice
      const roof = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width + 0.8, 0.9, b.depth + 0.8)),
        trimMat
      );
      roof.position.y = b.height + 0.45;
      bGroup.add(roof);

      // Windows on all 4 facades + Balconies on Front/Back
      const floors = Math.max(1, Math.floor(upperH / 3.6));
      const cols = Math.max(2, Math.floor((b.width - 3) / 4.2));
      const winGeo = trackGeo(new THREE.PlaneGeometry(1.7, 1.7));

      for (let f = 0; f < floors; f++) {
        const wy = groundH + 2.0 + f * 3.5;
        if (wy > b.height - 1.2) break;

        for (let c = 0; c < cols; c++) {
          const wx = -b.width * 0.38 + (c / Math.max(1, cols - 1)) * (b.width * 0.76);
          const wMat = (f + c) % 3 === 0 ? texPack.nightWindowWarmMat : texPack.nightWindowCoolMat;

          const winFront = new THREE.Mesh(winGeo, wMat);
          winFront.position.set(wx, wy, b.depth * 0.48 + 0.06);
          const winBack = new THREE.Mesh(winGeo, wMat);
          winBack.position.set(wx, wy, -b.depth * 0.48 - 0.06);
          winBack.rotation.y = Math.PI;
          bGroup.add(winFront, winBack);

          // Projecting Concrete Balcony + Railing on alternating bays
          if (b.type === 'residential' && c % 2 === 0) {
            const balcSlab = new THREE.Mesh(
              trackGeo(new THREE.BoxGeometry(2.6, 0.2, 1.1)),
              texPack.curbMat
            );
            balcSlab.position.set(wx, wy - 0.95, b.depth * 0.48 + 0.55);
            const balcRail = new THREE.Mesh(
              trackGeo(new THREE.BoxGeometry(2.6, 0.65, 0.08)),
              steelDarkMat
            );
            balcRail.position.set(wx, wy - 0.55, b.depth * 0.48 + 1.05);
            bGroup.add(balcSlab, balcRail);
          }

          // External Split-Unit AC Condenser on residential/commercial facade
          if ((f + c) % 2 === 1) {
            const acBox = new THREE.Mesh(
              trackGeo(new THREE.BoxGeometry(0.75, 0.5, 0.35)),
              steelSilverMat
            );
            acBox.position.set(wx + 1.15, wy - 0.4, b.depth * 0.48 + 0.2);
            bGroup.add(acBox);
          }
        }
      }

      // Iconic Lagos Roof Overhead Water Tank on Steel Frame
      if (b.type === 'residential' || b.type === 'commercial') {
        const tankStand = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(2.2, 1.6, 2.2)),
          steelDarkMat
        );
        tankStand.position.set(b.width * 0.26, b.height + 1.7, -b.depth * 0.22);
        const waterTank = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.9, 0.9, 1.8, 12)),
          waterTankBlueMat
        );
        waterTank.position.set(b.width * 0.26, b.height + 3.4, -b.depth * 0.22);
        bGroup.add(tankStand, waterTank);
      }

      // Ground-floor shopfront canopy & entrance
      const shopCanopy = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(b.width * 0.72, 0.28, 2.2)),
        trimMat
      );
      shopCanopy.position.set(0, 3.6, b.depth / 2 + 1.05);
      bGroup.add(shopCanopy);
    }

    // Crisp Business Signboard (Front + Side visibility)
    if (b.hasSign && b.signText) {
      const signTex = texPack.createSignTexture(b.signText, b.name.toUpperCase(), {
        bg: b.type === 'bank' ? '#06202A' : '#071A2B',
        border: b.type === 'bank' ? '#F59E0B' : b.type === 'tech_hub' ? '#38BDF8' : '#EF233C',
        accent: '#E2E8F0',
      });
      const signMat = trackMat(new THREE.MeshBasicMaterial({ map: signTex }));
      const signW = Math.min(b.width * 0.78, 18);
      const signMesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(signW, 2.8)), signMat);
      signMesh.position.set(0, b.type === 'depot' ? b.height - 2.6 : 5.4, b.depth / 2 + 0.18);
      bGroup.add(signMesh);
    }

    cityGroup.add(bGroup);
  };

  allCollidableBuildings.forEach(buildCompositeBuilding);

  // =========================================================================
  // 4. IN-WORLD SPECIALTY: PETROL & EV STATION + HORIZON SKYLINE TOWERS
  // =========================================================================
  {
    // Lagos Fuel & EV Charging Forecourt at [-30, -28] (Clear of Showroom & North Road)
    const stX = -30;
    const stZ = -28;
    if (distToNearestRoad(stX, stZ) > 15) {
      const stGroup = new THREE.Group();
      stGroup.position.set(stX, 0, stZ);

      const pad = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(16, 0.14, 14)),
        texPack.sidewalkMat
      );
      pad.position.y = 0.07;
      pad.receiveShadow = true;

      const canopyRoof = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(13, 0.9, 9)),
        greenSignMat
      );
      canopyRoof.position.set(0, 5.2, 1.5);
      canopyRoof.castShadow = true;

      const canopyTrim = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(13.2, 0.35, 9.2)),
        barrierYellowMat
      );
      canopyTrim.position.set(0, 5.55, 1.5);

      // 4 Columns
      [
        [-4.5, -1.5],
        [4.5, -1.5],
        [-4.5, 4.5],
        [4.5, 4.5],
      ].forEach(([cx, cz]) => {
        const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.28, 5.0, 10)), steelSilverMat);
        col.position.set(cx, 2.5, cz);
        stGroup.add(col);
      });

      // Fuel/EV Dispensers
      [-2.2, 2.2].forEach((px) => {
        const pump = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 1.9, 0.7)), barrierYellowMat);
        pump.position.set(px, 1.0, 1.5);
        const screen = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.7, 0.5)), texPack.nightWindowCoolMat);
        screen.position.set(px, 1.35, 1.87);
        stGroup.add(pump, screen);
      });

      // Station Mart Kiosk behind canopy
      const mart = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(11, 3.8, 4.2)), texPack.stuccoCreamMat);
      mart.position.set(0, 1.9, -4.6);
      mart.castShadow = true;

      const stSignTex = texPack.createSignTexture('MAINLAND ENERGY', 'FUEL • EV FAST CHARGE', {
        bg: '#065F46',
        border: '#FACC15',
        accent: '#FFFFFF',
      });
      const stSign = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(9.5, 1.4)),
        trackMat(new THREE.MeshBasicMaterial({ map: stSignTex }))
      );
      stSign.position.set(0, 5.2, 6.06);

      stGroup.add(pad, canopyRoof, canopyTrim, mart, stSign);
      cityGroup.add(stGroup);
    }
  }

  // Distant Outer Horizon Skyline Silhouette (framed smoothly into FogExp2 so world feels vast)
  {
    const skylineMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.75,
        metalness: 0.25,
      })
    );
    const skylineConfigs: [number, number, number, number, number][] = [
      [-210, -195, 32, 30, 58],
      [-120, -215, 28, 28, 46],
      [-35, -220, 36, 30, 68],
      [75, -215, 30, 28, 52],
      [185, -195, 34, 34, 62],
      [215, -80, 28, 32, 48],
      [220, 40, 32, 34, 64],
      [205, 165, 30, 30, 44],
      [90, 215, 34, 28, 54],
      [-25, 220, 38, 30, 60],
      [-145, 210, 32, 32, 42],
      [-215, 120, 30, 30, 50],
      [-220, -20, 34, 34, 66],
    ];

    skylineConfigs.forEach(([sx, sz, w, d, h]) => {
      const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), skylineMat);
      mesh.position.set(sx, h / 2 - 0.1, sz);
      cityGroup.add(mesh);
    });
  }

  // =========================================================================
  // 5. LAGOS STREET CHARACTER: DANFO BUS STOPS, KIOSKS, BILLBOARDS, GANTRIES
  // =========================================================================
  const danfoYellowMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.15 })
  );

  const busStopLocations = [
    { x: 10.5, z: -22, angle: -Math.PI / 2, label: 'SHOWROOM / SABO STOP' },
    { x: 75, z: 9.8, angle: Math.PI, label: 'COMMERCIAL AVE BANK ROW' },
    { x: -75, z: 9.8, angle: Math.PI, label: 'SURULERE EXPRESS LINK' },
    { x: -10.5, z: 68, angle: Math.PI / 2, label: 'MARKETPLACE BLVD STOP' },
  ];

  busStopLocations.forEach((loc) => {
    const stopGroup = new THREE.Group();
    stopGroup.position.set(loc.x, 0, loc.z);
    stopGroup.rotation.y = loc.angle;

    const basePad = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.6, 0.16, 3.6)), texPack.sidewalkMat);
    basePad.position.y = 0.08;
    const roof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.4, 0.28, 3.4)), danfoYellowMat);
    roof.position.set(0, 3.25, 0);
    roof.castShadow = true;

    const stripe1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.45, 0.12, 0.35)), darkMetalMat);
    stripe1.position.set(0, 3.25, 1.0);
    const stripe2 = stripe1.clone();
    stripe2.position.z = -1.0;

    [-3.1, 3.1].forEach((px) => {
      const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 8)), steelDarkMat);
      col.position.set(px, 1.6, -1.1);
      stopGroup.add(col);
    });

    const backGlass = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(6.0, 2.1, 0.12)),
      texPack.nightWindowCoolMat
    );
    backGlass.position.set(0, 1.5, -1.2);
    const bench = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.8, 0.45, 0.75)), steelSilverMat);
    bench.position.set(0, 0.48, -0.75);

    const stopTex = texPack.createSignTexture('BRT / DANFO BUS STOP', loc.label, {
      bg: '#111827',
      border: '#FACC15',
      accent: '#FDE047',
    });
    const stopSign = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(4.4, 0.85)),
      trackMat(new THREE.MeshBasicMaterial({ map: stopTex }))
    );
    stopSign.position.set(0, 3.7, 0);

    stopGroup.add(basePad, roof, stripe1, stripe2, backGlass, bench, stopSign);
    cityGroup.add(stopGroup);
  });

  // Roadside Kiosks & Corner Shops
  const kioskSpecs = [
    { x: 16, z: 16, rot: -Math.PI / 4, title: 'SABO PROVISIONS', sub: 'SNACKS • DRINKS • AIRTIME', color: 0x0284c7 },
    { x: -16, z: -18, rot: Math.PI / 4, title: 'MAINLAND SPARES', sub: 'TYRES • OIL • ACCESSORIES', color: 0xdc2626 },
    { x: 64, z: -14, rot: 0, title: 'LAGOS ROASTERY', sub: 'ESPRESSO & BAKERY', color: 0x059669 },
    { x: -42, z: 86, rot: Math.PI / 2, title: 'DOCKSIDE CAFE', sub: 'FREIGHT CREW CANTEEN', color: 0xd97706 },
  ];

  kioskSpecs.forEach((k) => {
    if (distToNearestRoad(k.x, k.z) < 12.2) return;
    const kGroup = new THREE.Group();
    kGroup.position.set(k.x, 0, k.z);
    kGroup.rotation.y = k.rot;

    const kBodyMat = trackMat(new THREE.MeshStandardMaterial({ color: k.color, roughness: 0.55 }));
    const kBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.4, 2.9, 3.0)), kBodyMat);
    kBody.position.y = 1.45;
    kBody.castShadow = true;

    const counter = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.8, 1.0, 0.7)), texPack.stuccoCreamMat);
    counter.position.set(0, 0.5, 1.7);

    const awning = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.8, 0.2, 2.0)), barrierYellowMat);
    awning.position.set(0, 2.7, 1.9);
    awning.rotation.x = 0.2;

    const kTex = texPack.createSignTexture(k.title, k.sub, { bg: '#0F172A', border: '#FACC15' });
    const kSign = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(4.0, 0.9)),
      trackMat(new THREE.MeshBasicMaterial({ map: kTex }))
    );
    kSign.position.set(0, 3.4, 1.45);

    kGroup.add(kBody, counter, awning, kSign);
    cityGroup.add(kGroup);
  });

  // Elevated Billboards along Expressways & Commercial Ave
  const billboardSpecs = [
    { x: -92, z: -112, rot: Math.PI / 4, title: 'MANIFOLD CERTIFIED', sub: 'VERIFIED DEALERSHIPS • LAGOS' },
    { x: 64, z: -112, rot: -Math.PI / 4, title: 'YABA TECH CORRIDOR', sub: 'NEXT-GEN MOBILITY & TELEMATICS' },
    { x: 18, z: 82, rot: -Math.PI / 3, title: 'GRAND MARKETPLACE', sub: 'INSPECT • TEST DRIVE • OWN' },
  ];

  billboardSpecs.forEach((bb) => {
    if (distToNearestRoad(bb.x, bb.z) < 12) return;
    const bbGroup = new THREE.Group();
    bbGroup.position.set(bb.x, 0, bb.z);
    bbGroup.rotation.y = bb.rot;

    const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.42, 9.5, 10)), steelDarkMat);
    post.position.y = 4.75;
    const frame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10.8, 4.4, 0.5)), darkMetalMat);
    frame.position.y = 10.2;
    frame.castShadow = true;

    const bbTex = texPack.createSignTexture(bb.title, bb.sub, {
      bg: '#071A2B',
      border: '#EF233C',
      accent: '#38BDF8',
    });
    const faceMat = trackMat(new THREE.MeshBasicMaterial({ map: bbTex }));
    const faceF = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(10.2, 3.8)), faceMat);
    faceF.position.set(0, 10.2, 0.28);
    const faceB = faceF.clone();
    faceB.position.z = -0.28;
    faceB.rotation.y = Math.PI;

    bbGroup.add(post, frame, faceF, faceB);
    cityGroup.add(bbGroup);
  });

  // Overhead Highway Navigation Gantry at Herbert Macaulay North [0, 0, -80]
  {
    const gantryGroup = new THREE.Group();
    gantryGroup.position.set(0, 0, -80);

    const gPillarL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.28, 0.34, 8.6, 12)), steelSilverMat);
    gPillarL.position.set(-8.6, 4.3, 0);
    const gPillarR = gPillarL.clone();
    gPillarR.position.x = 8.6;
    const gBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(18.2, 0.65, 0.65)), steelSilverMat);
    gBeam.position.set(0, 8.3, 0);

    const gantrySignTex = texPack.createSignTexture(
      '▲ SURULERE EXPRESSWAY',
      '◀ YABA TECH HUB   |   CARGO DEPOT ▶',
      { bg: '#065F46', border: '#FFFFFF', accent: '#FDE047' }
    );
    const gantrySignMat = trackMat(new THREE.MeshBasicMaterial({ map: gantrySignTex }));
    const gantrySignF = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(12.2, 3.0)), gantrySignMat);
    gantrySignF.position.set(0, 8.1, 0.38);
    const gantrySignB = gantrySignF.clone();
    gantrySignB.position.z = -0.38;
    gantrySignB.rotation.y = Math.PI;

    gantryGroup.add(gPillarL, gPillarR, gBeam, gantrySignF, gantrySignB);
    cityGroup.add(gantryGroup);
  }

  // =========================================================================
  // 6. UPGRADED 6 LANDMARK ARCHITECTURES (EXACT COORDINATES PRESERVED)
  // =========================================================================
  const landmarkMarkers: { id: string; group: THREE.Group }[] = [];

  CITY_LANDMARKS.forEach((lm) => {
    const lmGroup = new THREE.Group();
    lmGroup.position.set(lm.x, 0.04, lm.z);

    // Sleek ground objective zone ring (non-Z-fighting)
    const ringGeo = trackGeo(new THREE.RingGeometry(lm.radius * 0.84, lm.radius, 36));
    const ringMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(lm.color),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    lmGroup.add(ringMesh);

    landmarkMarkers.push({ id: lm.id, group: lmGroup });
    cityGroup.add(lmGroup);
  });

  // Landmark 2 Upgrade: YABA TECH INNOVATION HUB Totem & Archway ([0, -130] shoulder)
  {
    const techMonolith = new THREE.Group();
    techMonolith.position.set(13, 0, -117);
    techMonolith.rotation.y = -Math.PI / 4;
    const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.2, 0.6, 1.6)), steelDarkMat);
    base.position.y = 0.3;
    const screen = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.8, 5.2, 0.5)), texPack.nightWindowCoolMat);
    screen.position.y = 3.1;
    const yabaTex = texPack.createSignTexture('YABA TECH HUB', 'ECU LABS & TELEMATICS', {
      bg: '#082F49',
      border: '#38BDF8',
      accent: '#BAE6FD',
    });
    const yabaFace = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(2.6, 1.2)),
      trackMat(new THREE.MeshBasicMaterial({ map: yabaTex }))
    );
    yabaFace.position.set(0, 4.4, 0.28);
    techMonolith.add(base, screen, yabaFace);
    cityGroup.add(techMonolith);
  }

  // Landmark 3 Upgrade: COMMERCIAL AVENUE BANKING ROW Plaza Monument ([105, 0] shoulder)
  {
    const bankPlaza = new THREE.Group();
    bankPlaza.position.set(92, 0, -13);
    bankPlaza.rotation.y = Math.PI / 4;
    const plinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.2, 0.6, 4.2)), steelDarkMat);
    plinth.position.y = 0.3;
    const fin1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.5, 6.2, 1.6)), goldAccentMat);
    fin1.position.set(-0.9, 3.4, 0);
    const fin2 = fin1.clone();
    fin2.position.x = 0.9;
    bankPlaza.add(plinth, fin1, fin2);
    cityGroup.add(bankPlaza);
  }

  // Landmark 4 Upgrade: MAINLAND CARGO LOGISTICS DEPOT Containers & Freight Gantry ([-55, 100])
  {
    const freightGantry = new THREE.Group();
    freightGantry.position.set(-55, 0, 88);
    const fColL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.6, 7.2, 0.6)), barrierYellowMat);
    fColL.position.set(-8.2, 3.6, 0);
    const fColR = fColL.clone();
    fColR.position.x = 8.2;
    const fBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(17.4, 1.2, 0.8)), steelDarkMat);
    fBeam.position.set(0, 7.2, 0);
    const fTex = texPack.createSignTexture('MAINLAND CARGO DEPOT', 'FREIGHT BAY 1 - 4', {
      bg: '#064E3B',
      border: '#10B981',
      accent: '#FDE047',
    });
    const fSign = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(11, 2.2)),
      trackMat(new THREE.MeshBasicMaterial({ map: fTex }))
    );
    fSign.position.set(0, 7.2, 0.45);
    freightGantry.add(fColL, fColR, fBeam, fSign);
    cityGroup.add(freightGantry);

    // Shipping Containers stacked in Depot Compound [-68, 72] and [-68, 122]
    const containerGeo = trackGeo(new THREE.BoxGeometry(6.2, 2.6, 2.5));
    const cColors = [0xdc2626, 0x0284c7, 0x059669, 0xd97706];
    const containerCoords = [
      { x: -64, y: 1.3, z: 62, c: 0, rot: 0 },
      { x: -64, y: 1.3, z: 65.2, c: 1, rot: 0 },
      { x: -64, y: 3.9, z: 62, c: 2, rot: 0 },
      { x: -65, y: 1.3, z: 120, c: 3, rot: Math.PI / 2 },
      { x: -68.5, y: 1.3, z: 120, c: 1, rot: Math.PI / 2 },
    ];
    containerCoords.forEach((cc) => {
      const cMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: cColors[cc.c % cColors.length],
          roughness: 0.55,
          metalness: 0.45,
        })
      );
      const cMesh = new THREE.Mesh(containerGeo, cMat);
      cMesh.position.set(cc.x, cc.y, cc.z);
      cMesh.rotation.y = cc.rot;
      cMesh.castShadow = true;
      cityGroup.add(cMesh);
    });
  }

  // Landmark 5 Upgrade: SURULERE STREET CIRCUIT STARTING GRID ([-50, -130])
  {
    const raceGantry = new THREE.Group();
    raceGantry.position.set(-50, 0, -130);
    raceGantry.rotation.y = Math.PI / 2; // Spans East-West Expressway cleanly

    const rColL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.38, 8.2, 10)), redPaintMat);
    rColL.position.set(-8.5, 4.1, 0);
    const rColR = rColL.clone();
    rColR.position.x = 8.5;
    const rTruss = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(18.2, 1.3, 1.0)), darkMetalMat);
    rTruss.position.set(0, 7.9, 0);

    const startTex = texPack.createSignTexture('SURULERE GRAND PRIX', 'STARTING GRID • SECTOR 1', {
      bg: '#111827',
      border: '#EF233C',
      accent: '#FACC15',
    });
    const rBanner = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(12.5, 2.1)),
      trackMat(new THREE.MeshBasicMaterial({ map: startTex }))
    );
    rBanner.position.set(0, 7.9, 0.55);
    const rBannerB = rBanner.clone();
    rBannerB.position.z = -0.55;
    rBannerB.rotation.y = Math.PI;

    // 5-Lamp Race Starting Light Pod
    for (let i = -2; i <= 2; i++) {
      const lamp = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.24, 10, 10)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.2 }))
      );
      lamp.position.set(i * 0.9, 6.8, 0.55);
      raceGantry.add(lamp);
    }

    // Painted Starting Grid Checkered Boxes on Asphalt
    for (let slot = 0; slot < 4; slot++) {
      const gx = slot % 2 === 0 ? -3.0 : 3.0;
      const gz = -2.5 - slot * 5.0;
      const box = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(3.2, 0.28)), texPack.whiteMarkMat);
      box.rotation.x = -Math.PI / 2;
      box.position.set(gx, 0.028, gz);
      raceGantry.add(box);
    }

    raceGantry.add(rColL, rColR, rTruss, rBanner, rBannerB);
    cityGroup.add(raceGantry);
  }

  // Landmark 6 Upgrade: MANIFOLD GRAND MARKETPLACE PORTAL ([0, 100])
  {
    const portalGroup = new THREE.Group();
    portalGroup.position.set(0, 0, 100);

    const pPillarGeo = trackGeo(new THREE.BoxGeometry(2.0, 10.2, 2.4));
    const pPillarL = new THREE.Mesh(pPillarGeo, darkMetalMat);
    pPillarL.position.set(-7.8, 5.1, 0);
    pPillarL.castShadow = true;
    const pPillarR = pPillarL.clone();
    pPillarR.position.x = 7.8;

    const pArch = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(17.8, 2.0, 2.8)), darkMetalMat);
    pArch.position.set(0, 10.0, 0);
    pArch.castShadow = true;

    const neonTrim = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(16.6, 0.28, 3.0)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xef233c, emissive: 0xef233c, emissiveIntensity: 3.2 }))
    );
    neonTrim.position.set(0, 8.95, 0);

    const portalTex = texPack.createSignTexture('MANIFOLD MARKETPLACE', 'DRIVE THROUGH TO BROWSE REAL CARS', {
      bg: '#071A2B',
      border: '#EF233C',
      accent: '#FACC15',
    });
    const portalSignMat = trackMat(new THREE.MeshBasicMaterial({ map: portalTex }));
    const portalSignF = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(13.6, 2.2)), portalSignMat);
    portalSignF.position.set(0, 10.2, 1.45);
    const portalSignB = portalSignF.clone();
    portalSignB.position.z = -1.45;
    portalSignB.rotation.y = Math.PI;

    // Translucent holographic drive-through energy veil (does NOT block physics)
    const veilMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xef233c,
        emissive: 0xef233c,
        emissiveIntensity: 0.75,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        roughness: 0.15,
      })
    );
    const veil = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(13.4, 8.6)), veilMat);
    veil.position.set(0, 4.3, 0);

    portalGroup.add(pPillarL, pPillarR, pArch, neonTrim, portalSignF, portalSignB, veil);
    cityGroup.add(portalGroup);
  }

  // =========================================================================
  // 7. TROPICAL LAGOS VEGETATION & LANDSCAPING (INSTANCED, ZERO ROAD OVERLAP)
  // =========================================================================
  const isInsideAnyBuilding = (px: number, pz: number, margin = 2.5): boolean => {
    for (let i = 0; i < allCollidableBuildings.length; i++) {
      const b = allCollidableBuildings[i];
      if (
        Math.abs(px - b.x) < b.width / 2 + margin &&
        Math.abs(pz - b.z) < b.depth / 2 + margin
      ) {
        return true;
      }
    }
    // Keep Showroom Pavilion esplanade clear [-28..28, -62..-32] and fuel station [-40..-20, -38..-18]
    if (Math.abs(px) < 28 && pz > -64 && pz < -30) return true;
    if (px > -40 && px < -20 && pz > -38 && pz < -18) return true;
    // Keep customizer [35, 10] & VIP lounge [57, 22] clear
    if (Math.hypot(px - 35, pz - 10) < 10) return true;
    if (Math.hypot(px - 57, pz - 22) < 14) return true;
    return false;
  };

  // Deterministic pseudo-random generator
  let seed = 4219;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const palmPlacements: { x: number; z: number; scale: number; yaw: number }[] = [];
  const shadePlacements: { x: number; z: number; scale: number; yaw: number }[] = [];
  const shrubPlacements: { x: number; z: number; scale: number; yaw: number }[] = [];

  // Place curated boulevard palms & shade trees around city blocks + perimeter parkland
  for (let gx = -165; gx <= 165; gx += 18) {
    for (let gz = -165; gz <= 165; gz += 18) {
      const jx = gx + (rand() - 0.5) * 8;
      const jz = gz + (rand() - 0.5) * 8;
      const roadDist = distToNearestRoad(jx, jz);
      if (roadDist < 12.6) continue;
      if (isInsideAnyBuilding(jx, jz, 3.2)) continue;

      const r = rand();
      if (roadDist < 16.5) {
        // Boulevard edge: Palm trees or roadside shrubs
        if (r < 0.45) {
          palmPlacements.push({ x: jx, z: jz, scale: 0.88 + rand() * 0.28, yaw: rand() * Math.PI * 2 });
        } else if (r < 0.8) {
          shrubPlacements.push({ x: jx, z: jz, scale: 0.85 + rand() * 0.35, yaw: rand() * Math.PI * 2 });
        }
      } else {
        // Inner block green spaces & outskirts: Tropical shade trees + palms
        if (r < 0.38) {
          shadePlacements.push({ x: jx, z: jz, scale: 0.86 + rand() * 0.3, yaw: rand() * Math.PI * 2 });
        } else if (r < 0.68) {
          palmPlacements.push({ x: jx, z: jz, scale: 0.88 + rand() * 0.28, yaw: rand() * Math.PI * 2 });
        } else if (r < 0.9) {
          shrubPlacements.push({ x: jx, z: jz, scale: 0.85 + rand() * 0.4, yaw: rand() * Math.PI * 2 });
        }
      }
    }
  }

  // Instanced Coconut Palm Trees (Trunk + 6-frond radial crown)
  if (palmPlacements.length > 0) {
    const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.32, 7.4, 7));
    trunkGeo.translate(0, 3.7, 0);
    const trunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x7c6248, roughness: 0.9 }));

    const frondGeo = trackGeo(new THREE.ConeGeometry(0.55, 3.4, 5));
    frondGeo.rotateX(Math.PI * 0.42);
    frondGeo.translate(0, 7.2, 1.4);
    const frondMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.72 }));

    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palmPlacements.length);
    trunkInst.castShadow = true;
    const frondsPerPalm = 6;
    const frondInst = new THREE.InstancedMesh(
      frondGeo,
      frondMat,
      palmPlacements.length * frondsPerPalm
    );
    frondInst.castShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    palmPlacements.forEach((p, idx) => {
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(0.05, p.yaw, 0.04);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);

      for (let f = 0; f < frondsPerPalm; f++) {
        const fYaw = p.yaw + (f / frondsPerPalm) * Math.PI * 2;
        dummy.position.set(p.x, 0, p.z);
        dummy.rotation.set(0, fYaw, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        const fIdx = idx * frondsPerPalm + f;
        frondInst.setMatrixAt(fIdx, dummy.matrix);
        color.setHSL(0.32 + (f % 3) * 0.02, 0.52, 0.3 + (idx % 4) * 0.03);
        frondInst.setColorAt(fIdx, color);
      }
    });

    trunkInst.computeBoundingSphere();
    frondInst.computeBoundingSphere();
    if (frondInst.instanceColor) frondInst.instanceColor.needsUpdate = true;
    cityGroup.add(trunkInst, frondInst);
  }

  // Instanced Tropical Shade Trees (Trunk + Double-Lobe Crown)
  if (shadePlacements.length > 0) {
    const sTrunkGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.38, 3.8, 7));
    sTrunkGeo.translate(0, 1.9, 0);
    const sTrunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x5c4330, roughness: 0.9 }));

    const canopyGeo = trackGeo(new THREE.IcosahedronGeometry(2.45, 1));
    canopyGeo.translate(0, 4.9, 0);
    const canopyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b873e, roughness: 0.8 }));

    const sTrunkInst = new THREE.InstancedMesh(sTrunkGeo, sTrunkMat, shadePlacements.length);
    sTrunkInst.castShadow = true;
    const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, shadePlacements.length);
    canopyInst.castShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    shadePlacements.forEach((t, idx) => {
      dummy.position.set(t.x, 0, t.z);
      dummy.rotation.set(0, t.yaw, 0);
      dummy.scale.setScalar(t.scale);
      dummy.updateMatrix();
      sTrunkInst.setMatrixAt(idx, dummy.matrix);
      canopyInst.setMatrixAt(idx, dummy.matrix);
      color.setHSL(0.31 + ((idx % 5) - 2) * 0.015, 0.48, 0.28 + (idx % 3) * 0.04);
      canopyInst.setColorAt(idx, color);
    });

    sTrunkInst.computeBoundingSphere();
    canopyInst.computeBoundingSphere();
    if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
    cityGroup.add(sTrunkInst, canopyInst);
  }

  // Instanced Roadside Shrubs
  if (shrubPlacements.length > 0) {
    const shrubGeo = trackGeo(new THREE.DodecahedronGeometry(0.85, 0));
    shrubGeo.translate(0, 0.55, 0);
    const shrubMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x438a40, roughness: 0.85 }));
    const shrubInst = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubPlacements.length);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    shrubPlacements.forEach((sh, idx) => {
      dummy.position.set(sh.x, 0, sh.z);
      dummy.rotation.set(0, sh.yaw, 0);
      dummy.scale.set(sh.scale * 1.25, sh.scale * 0.85, sh.scale * 1.15);
      dummy.updateMatrix();
      shrubInst.setMatrixAt(idx, dummy.matrix);
      color.setHSL(0.3 + (idx % 4) * 0.02, 0.5, 0.34);
      shrubInst.setColorAt(idx, color);
    });
    shrubInst.computeBoundingSphere();
    if (shrubInst.instanceColor) shrubInst.instanceColor.needsUpdate = true;
    cityGroup.add(shrubInst);
  }

  // =========================================================================
  // 8. STREET RACE CHECKPOINTS (Mission B: City Rival Challenge)
  // =========================================================================
  const checkpointMeshes: { id: number; mesh: THREE.Group; active: boolean }[] = [];

  RIVAL_RACE_CHECKPOINTS.forEach((cp) => {
    const cpGroup = new THREE.Group();
    cpGroup.position.set(cp.x, 0.15, cp.z);

    const torusGeo = trackGeo(new THREE.TorusGeometry(cp.radius * 0.82, 0.28, 10, 32));
    const torusMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xef233c,
        transparent: true,
        opacity: 0.65,
      })
    );
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.rotation.x = Math.PI / 2;
    cpGroup.add(torus);

    checkpointMeshes.push({
      id: cp.id,
      mesh: cpGroup,
      active: false,
    });
    // Hidden in free-drive until race mission activates; visible on demand
    cpGroup.visible = false;
    cityGroup.add(cpGroup);
  });

  // =========================================================================
  // 9. IN-WORLD DYNAMIC GPS NAVIGATION RIBBON
  // =========================================================================
  const gpsLineGeo = trackGeo(new THREE.BufferGeometry());
  gpsLineGeo.setFromPoints([
    new THREE.Vector3(0, 0.25, -35),
    new THREE.Vector3(0, 0.25, 0),
  ]);
  const gpsLineMat = trackMat(
    new THREE.LineBasicMaterial({
      color: 0x10b981,
      linewidth: 4,
    })
  );
  const gpsRouteLine = new THREE.Line(gpsLineGeo, gpsLineMat);
  gpsRouteLine.visible = false;
  cityGroup.add(gpsRouteLine);

  const updateGPSRoute = (path: { x: number; z: number }[]) => {
    if (!path || path.length < 2) {
      gpsRouteLine.visible = false;
      return;
    }
    gpsRouteLine.visible = true;
    const pts = path.map((p) => new THREE.Vector3(p.x, 0.26, p.z));
    gpsRouteLine.geometry.dispose();
    gpsRouteLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  };

  const updateTimeOfDay = (mode: TimeOfDay) => {
    texPack.updateTimeOfDay(mode);
  };

  const dispose = () => {
    gpsRouteLine.geometry.dispose();
    localGeometries.forEach((g) => g.dispose());
    localMaterials.forEach((m) => m.dispose());
    texPack.dispose();
  };

  return {
    cityGroup,
    collidableBuildings: allCollidableBuildings,
    checkpointMeshes,
    landmarkMarkers,
    gpsRouteLine,
    updateGPSRoute,
    updateTimeOfDay,
    dispose,
  };
}
