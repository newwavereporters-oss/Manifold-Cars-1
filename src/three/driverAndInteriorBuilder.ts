// MANIFOLD WORLD — DETAILED AUTOMOTIVE CABIN INTERIOR & HUMAN DRIVER BUILDER
// Builds contoured multi-seat upholstery, sculpted dashboard with illuminated gauges,
// center console + infotainment + gear selector, door cards, animated steering wheel,
// and an articulated seated 3D human driver gripping the wheel naturally.

import * as THREE from 'three';
import type { InteriorTheme, VehicleModelType } from '../components/world/worldModels';
import type { VehicleTextureBank } from './vehicleTextures';

export interface InteriorDriverConfig {
  vehicleType: VehicleModelType;
  seatOffsetZ: number;
  seatY: number;
  cabinFloorY: number;
  cabinWidth: number;
  steerOffset: THREE.Vector3;
  interiorTheme: InteriorTheme;
  textures: VehicleTextureBank | null;
}

export interface InteriorDriverResult {
  interiorGroup: THREE.Group;
  steeringWheelGroup: THREE.Group;
  driverGroup: THREE.Group;
  driverHeadGroup: THREE.Group;
  driverArmGroups: [THREE.Group, THREE.Group];
}

const INTERIOR_PALETTES: Record<
  InteriorTheme,
  { seat: number; bolster: number; trim: number; stitching: number; screen: number }
> = {
  BLACK: { seat: 0x151922, bolster: 0x0e1118, trim: 0x1b202b, stitching: 0x94a3b8, screen: 0x0ea5e9 },
  CREAM: { seat: 0xeae1ce, bolster: 0xd6cab2, trim: 0x3f362c, stitching: 0xfef3c7, screen: 0xf59e0b },
  BROWN: { seat: 0x734329, bolster: 0x542e1b, trim: 0x261710, stitching: 0xd99b66, screen: 0xf59e0b },
  GREY: { seat: 0x64748b, bolster: 0x475569, trim: 0x1e293b, stitching: 0xe2e8f0, screen: 0x38bdf8 },
  SPORT: { seat: 0x171b24, bolster: 0x0f1219, trim: 0x10131b, stitching: 0xef233c, screen: 0xef233c },
};

function addPart(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function buildSeat(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  recline: number,
  seatMat: THREE.Material,
  bolsterMat: THREE.Material,
  stitchMat: THREE.Material,
  chromeMat: THREE.Material,
  isSport: boolean
) {
  const seat = new THREE.Group();
  seat.position.set(x, y, z);

  // Contoured seat cushion base + side thigh bolsters
  addPart(seat, new THREE.BoxGeometry(0.32, 0.09, 0.46), seatMat, 0, 0.045, 0.04, 0.06, 0, 0);
  addPart(seat, new THREE.BoxGeometry(0.08, 0.12, 0.44), bolsterMat, -0.18, 0.065, 0.04, 0.06, 0, -0.18);
  addPart(seat, new THREE.BoxGeometry(0.08, 0.12, 0.44), bolsterMat, 0.18, 0.065, 0.04, 0.06, 0, 0.18);

  // Reclined seat backrest pivot
  const backrest = new THREE.Group();
  backrest.position.set(0, 0.07, -0.17);
  backrest.rotation.x = recline; // negative pitches top backward (-Z)
  seat.add(backrest);

  addPart(backrest, new THREE.BoxGeometry(0.32, 0.54, 0.1), seatMat, 0, 0.27, 0);
  // Lateral shoulder & torso bolsters
  addPart(backrest, new THREE.BoxGeometry(0.085, 0.5, 0.14), bolsterMat, -0.18, 0.26, 0.03, 0, -0.22, 0);
  addPart(backrest, new THREE.BoxGeometry(0.085, 0.5, 0.14), bolsterMat, 0.18, 0.26, 0.03, 0, 0.22, 0);

  if (isSport) {
    // Accent center stripe on backrest
    addPart(backrest, new THREE.BoxGeometry(0.05, 0.48, 0.106), stitchMat, 0, 0.27, 0);
  }

  // Dual steel headrest posts + contoured headrest cushion
  [-0.065, 0.065].forEach((px) => {
    addPart(backrest, new THREE.CylinderGeometry(0.011, 0.011, 0.1, 8), chromeMat, px, 0.56, 0);
  });
  addPart(backrest, new THREE.BoxGeometry(0.21, 0.15, 0.1), bolsterMat, 0, 0.65, 0.02, 0.12, 0, 0);

  parent.add(seat);
}

function buildHumanDriver(
  driverX: number,
  seatY: number,
  cabinFloorY: number,
  seatOffsetZ: number,
  recline: number,
  steerOffset: THREE.Vector3,
  isCoupe: boolean
): {
  driverGroup: THREE.Group;
  driverHeadGroup: THREE.Group;
  driverArmGroups: [THREE.Group, THREE.Group];
} {
  const driverGroup = new THREE.Group();

  // Natural skin, tailored jacket, dark trousers, hair & polarized sunglasses materials
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0x7b4c33,
    roughness: 0.62,
    metalness: 0.04,
  });
  const jacketMat = new THREE.MeshStandardMaterial({
    color: 0x1c2536,
    roughness: 0.78,
    metalness: 0.08,
  });
  const collarShirtMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.72,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x11151d,
    roughness: 0.84,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x171412,
    roughness: 0.52,
    metalness: 0.1,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x0f1116,
    roughness: 0.88,
  });
  const glassesMat = new THREE.MeshStandardMaterial({
    color: 0x070a10,
    roughness: 0.12,
    metalness: 0.85,
  });

  // Pelvis seated cleanly on cushion
  const hipY = seatY + 0.11;
  const hipZ = seatOffsetZ - 0.05;
  addPart(driverGroup, new THREE.BoxGeometry(0.28, 0.12, 0.22), pantsMat, driverX, hipY, hipZ);

  // Thighs + knees + lower legs reaching naturally into pedal footwell (never below floor pan)
  const footY = Math.max(cabinFloorY + 0.075, hipY - 0.25);
  [-0.085, 0.085].forEach((lx) => {
    const hipV = new THREE.Vector3(driverX + lx, hipY + 0.01, hipZ + 0.04);
    const kneeV = new THREE.Vector3(driverX + lx, hipY + 0.03, hipZ + 0.34);
    const footV = new THREE.Vector3(driverX + lx, footY, hipZ + 0.54);

    const addSeg = (pA: THREE.Vector3, pB: THREE.Vector3, r: number) => {
      const dir = pB.clone().sub(pA);
      const seg = new THREE.Mesh(
        new THREE.CapsuleGeometry(r, Math.max(0.06, dir.length() - r * 0.5), 6, 10),
        pantsMat
      );
      seg.position.copy(pA).lerp(pB, 0.5);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      driverGroup.add(seg);
    };

    addSeg(hipV, kneeV, 0.056);
    addSeg(kneeV, footV, 0.044);

    // Driving shoe seated neatly in footwell
    addPart(
      driverGroup,
      new THREE.BoxGeometry(0.08, 0.055, 0.14),
      gloveMat,
      footV.x,
      footV.y,
      footV.z + 0.04,
      0.32,
      0,
      0
    );
  });

  // Reclined torso aligned with seatback angle
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(driverX, hipY + 0.04, hipZ - 0.02);
  torsoPivot.rotation.x = recline * 0.92;
  driverGroup.add(torsoPivot);

  // Chest & upper back
  addPart(torsoPivot, new THREE.BoxGeometry(0.29, 0.38, 0.18), jacketMat, 0, 0.2, 0.02);
  // Broadened rounded shoulder yoke
  addPart(
    torsoPivot,
    new THREE.CapsuleGeometry(0.072, 0.27, 6, 10),
    jacketMat,
    0,
    0.37,
    0.02,
    0,
    0,
    Math.PI / 2
  );
  // Shirt front & collar visible at V-neck
  addPart(torsoPivot, new THREE.BoxGeometry(0.11, 0.15, 0.185), collarShirtMat, 0, 0.34, 0.028);
  addPart(torsoPivot, new THREE.CylinderGeometry(0.052, 0.058, 0.09, 12), skinMat, 0, 0.44, 0.02);

  // Sculpted Head Group (head, jawline, ears, hair, sunglasses)
  const driverHeadGroup = new THREE.Group();
  driverHeadGroup.position.set(0, 0.54, 0.03);
  // Slight counter-tilt so driver looks straight ahead down the road (+Z)
  driverHeadGroup.rotation.x = -recline * 0.55;
  torsoPivot.add(driverHeadGroup);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.092, 16, 14), skinMat);
  cranium.scale.set(0.92, 1.08, 1.02);
  driverHeadGroup.add(cranium);

  // Jawline & chin
  addPart(driverHeadGroup, new THREE.BoxGeometry(0.105, 0.075, 0.1), skinMat, 0, -0.05, 0.025, 0.12, 0, 0);
  // Nose bridge
  addPart(driverHeadGroup, new THREE.BoxGeometry(0.024, 0.042, 0.035), skinMat, 0, -0.005, 0.088, -0.2, 0, 0);
  // Ears
  [-0.086, 0.086].forEach((ex) => {
    addPart(driverHeadGroup, new THREE.BoxGeometry(0.02, 0.048, 0.032), skinMat, ex, -0.005, -0.005);
  });

  // Natural close-cropped hair cap + back taper
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.096, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairMat
  );
  hairCap.scale.set(0.94, 1.06, 1.04);
  hairCap.position.set(0, 0.015, -0.01);
  hairCap.rotation.x = -0.18;
  driverHeadGroup.add(hairCap);
  addPart(driverHeadGroup, new THREE.BoxGeometry(0.145, 0.08, 0.055), hairMat, 0, 0.01, -0.075);

  // Polarized Aviator/Sport Driving Sunglasses
  [-0.036, 0.036].forEach((gx) => {
    addPart(driverHeadGroup, new THREE.BoxGeometry(0.055, 0.03, 0.022), glassesMat, gx, 0.014, 0.086);
  });
  addPart(driverHeadGroup, new THREE.BoxGeometry(0.155, 0.009, 0.015), glassesMat, 0, 0.024, 0.088);

  // Articulated Arms (shoulders -> steering wheel 9 & 3 o'clock grip!)
  const wheelR = isCoupe ? 0.15 : 0.165;
  const shoulderWorldY = hipY + 0.04 + Math.cos(recline * 0.92) * 0.37;
  const shoulderWorldZ = hipZ - 0.02 - Math.sin(recline * 0.92) * 0.37;

  const buildArm = (sideSign: -1 | 1): THREE.Group => {
    const armPivot = new THREE.Group();
    const sx = driverX + sideSign * 0.175;
    armPivot.position.set(sx, shoulderWorldY, shoulderWorldZ);
    driverGroup.add(armPivot);

    // Target hand position on wheel rim (9 o'clock / 3 o'clock)
    const targetHand = new THREE.Vector3(
      steerOffset.x + sideSign * wheelR,
      steerOffset.y + 0.01,
      steerOffset.z - 0.01
    );
    const localHand = targetHand.sub(armPivot.position);

    // Natural elbow bent downward & slightly outward
    const localElbow = new THREE.Vector3(
      localHand.x * 0.55 + sideSign * 0.045,
      localHand.y * 0.42 - 0.11,
      localHand.z * 0.45
    );

    const addLimbSegment = (pA: THREE.Vector3, pB: THREE.Vector3, radius: number, mat: THREE.Material) => {
      const mid = pA.clone().lerp(pB, 0.5);
      const dir = pB.clone().sub(pA);
      const len = dir.length();
      const seg = new THREE.Mesh(
        new THREE.CapsuleGeometry(radius, Math.max(0.04, len - radius * 0.6), 6, 10),
        mat
      );
      seg.position.copy(mid);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      armPivot.add(seg);
    };

    addLimbSegment(new THREE.Vector3(0, 0, 0), localElbow, 0.046, jacketMat);
    addLimbSegment(localElbow, localHand, 0.037, jacketMat);

    // Wrist & gloved hand wrapped around steering rim
    const handMesh = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.055, 0.075), gloveMat);
    handMesh.position.copy(localHand);
    armPivot.add(handMesh);

    return armPivot;
  };

  const rightOrPosXArm = buildArm(1);
  const leftOrNegXArm = buildArm(-1);

  return {
    driverGroup,
    driverHeadGroup,
    driverArmGroups: [leftOrNegXArm, rightOrPosXArm],
  };
}

/**
 * Builds complete visible interior cabin (floor tub, firewall, dashboard + glowing cluster,
 * infotainment screen, center console, interior door cards, front + rear seats, steering wheel,
 * and articulated seated 3D human driver).
 */
export function buildDetailedInteriorAndDriver(
  config: InteriorDriverConfig
): InteriorDriverResult {
  const {
    vehicleType,
    seatOffsetZ,
    seatY,
    cabinFloorY,
    cabinWidth,
    steerOffset,
    interiorTheme,
    textures,
  } = config;

  const interiorGroup = new THREE.Group();
  const palette = INTERIOR_PALETTES[interiorTheme] || INTERIOR_PALETTES.BLACK;
  const isCoupe = vehicleType === 'SPORTS_COUPE';
  const is4x4 = vehicleType === 'RUGGED_4X4';
  const isSuv = vehicleType === 'LUXURY_SUV';
  const recline = isCoupe ? -0.26 : is4x4 ? -0.15 : -0.2;

  const carpetMat = new THREE.MeshStandardMaterial({
    color: 0x0b0e14,
    roughness: 0.94,
    metalness: 0.02,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: palette.trim,
    roughness: 0.66,
    metalness: 0.14,
  });
  const seatMat = new THREE.MeshStandardMaterial({
    color: palette.seat,
    roughness: 0.54,
    metalness: 0.08,
  });
  const bolsterMat = new THREE.MeshStandardMaterial({
    color: palette.bolster,
    roughness: 0.58,
    metalness: 0.1,
  });
  const stitchMat = new THREE.MeshStandardMaterial({
    color: palette.stitching,
    roughness: 0.45,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xdbe3ec,
    roughness: 0.18,
    metalness: 0.9,
  });

  const gaugeMat = new THREE.MeshStandardMaterial({
    color: 0x0b1220,
    map: textures?.dashboardGauge ?? null,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: textures?.dashboardGauge ?? null,
    emissiveIntensity: 0.95,
    roughness: 0.25,
  });
  const infoMat = new THREE.MeshStandardMaterial({
    color: 0x0b1220,
    map: textures?.infotainmentScreen ?? null,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: textures?.infotainmentScreen ?? null,
    emissiveIntensity: 0.72,
    roughness: 0.2,
  });

  const seatSpanX = isCoupe ? 0.36 : isSuv || is4x4 ? 0.43 : 0.39;
  const innerDoorX = cabinWidth * 0.5 - 0.08;

  // 1. Sealed Interior Floor Tub + Front Firewall & Rear Parcel/Cargo Bulkhead
  const cabinLen = isSuv || is4x4 ? 2.1 : 1.75;
  const cabinCenterZ = seatOffsetZ - (isSuv || is4x4 ? 0.18 : 0.06);
  addPart(interiorGroup, new THREE.BoxGeometry(cabinWidth - 0.12, 0.06, cabinLen), carpetMat, 0, cabinFloorY, cabinCenterZ);
  // Front firewall blocking engine-bay light leak
  addPart(
    interiorGroup,
    new THREE.BoxGeometry(cabinWidth - 0.1, 0.48, 0.08),
    carpetMat,
    0,
    cabinFloorY + 0.24,
    seatOffsetZ + 0.72
  );
  // Rear bulkhead / cargo shelf
  addPart(
    interiorGroup,
    new THREE.BoxGeometry(cabinWidth - 0.14, 0.36, 0.12),
    carpetMat,
    0,
    cabinFloorY + 0.18,
    cabinCenterZ - cabinLen * 0.48
  );

  // Footwell Brake & Accelerator Pedals
  addPart(interiorGroup, new THREE.BoxGeometry(0.06, 0.09, 0.02), chromeMat, steerOffset.x + 0.04, cabinFloorY + 0.14, seatOffsetZ + 0.62, -0.35);
  addPart(interiorGroup, new THREE.BoxGeometry(0.035, 0.11, 0.02), chromeMat, steerOffset.x - 0.05, cabinFloorY + 0.13, seatOffsetZ + 0.63, -0.45);

  // 2. Sculpted Multi-Tier Dashboard + Instrument Binnacle + Infotainment + Console
  const dashZ = seatOffsetZ + 0.6;
  const dashY = seatY + 0.36;
  addPart(interiorGroup, new THREE.BoxGeometry(cabinWidth - 0.08, 0.22, 0.48), trimMat, 0, dashY, dashZ + 0.08, 0.06);
  // Upper soft-touch stitched dash brow
  addPart(interiorGroup, new THREE.BoxGeometry(cabinWidth - 0.1, 0.05, 0.46), bolsterMat, 0, dashY + 0.11, dashZ + 0.06, 0.05);
  // Instrument cluster hood + illuminated gauge dial plane facing driver
  addPart(interiorGroup, new THREE.BoxGeometry(0.38, 0.15, 0.24), trimMat, steerOffset.x, dashY + 0.12, dashZ - 0.02);
  addPart(interiorGroup, new THREE.PlaneGeometry(0.32, 0.12), gaugeMat, steerOffset.x, dashY + 0.115, dashZ - 0.142, 0, Math.PI, 0);

  // Center Infotainment Screen + Metallic Trim Bezel + Air Vents
  addPart(interiorGroup, new THREE.BoxGeometry(0.34, 0.19, 0.045), chromeMat, 0, dashY + 0.13, dashZ - 0.06, -0.14);
  addPart(interiorGroup, new THREE.PlaneGeometry(0.31, 0.16), infoMat, 0, dashY + 0.13, dashZ - 0.085, 0.14, Math.PI, 0);

  if (is4x4) {
    // Rugged passenger-side dashboard grab handle
    addPart(interiorGroup, new THREE.CylinderGeometry(0.016, 0.016, 0.32, 8), chromeMat, 0.36, dashY + 0.06, dashZ - 0.16, 0, 0, Math.PI / 2);
  }

  // Center Tunnel Console + Padded Armrest + Cupholders + Gear Selector
  addPart(interiorGroup, new THREE.BoxGeometry(0.26, 0.24, 1.28), trimMat, 0, cabinFloorY + 0.18, seatOffsetZ + 0.06);
  addPart(interiorGroup, new THREE.BoxGeometry(0.22, 0.07, 0.44), bolsterMat, 0, cabinFloorY + 0.32, seatOffsetZ - 0.14);
  addPart(interiorGroup, new THREE.BoxGeometry(0.07, 0.11, 0.09), chromeMat, 0, cabinFloorY + 0.34, seatOffsetZ + 0.22, 0.15);
  [-0.05, 0.05].forEach((cx) => {
    addPart(interiorGroup, new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), chromeMat, cx, cabinFloorY + 0.3, seatOffsetZ + 0.08);
  });

  // 3. Interior Door Cards (Armrests, trim strips, chrome door handles)
  [-1, 1].forEach((side) => {
    addPart(interiorGroup, new THREE.BoxGeometry(0.06, 0.34, 1.35), trimMat, side * innerDoorX, seatY + 0.18, seatOffsetZ + 0.02);
    addPart(interiorGroup, new THREE.BoxGeometry(0.09, 0.065, 0.65), bolsterMat, side * (innerDoorX - 0.03), seatY + 0.16, seatOffsetZ + 0.04);
    addPart(interiorGroup, new THREE.BoxGeometry(0.025, 0.025, 0.12), chromeMat, side * (innerDoorX - 0.04), seatY + 0.27, seatOffsetZ + 0.22);
  });

  // 4. Front Seats (Driver & Passenger)
  buildSeat(interiorGroup, steerOffset.x, seatY, seatOffsetZ, recline, seatMat, bolsterMat, stitchMat, chromeMat, interiorTheme === 'SPORT' || isCoupe);
  buildSeat(interiorGroup, -steerOffset.x, seatY, seatOffsetZ, recline, seatMat, bolsterMat, stitchMat, chromeMat, interiorTheme === 'SPORT' || isCoupe);

  // Rear Seats (2+2 buckets in Coupe; 3-across executive bench in Sedan/SUV/4x4)
  const rearZ = seatOffsetZ - (isCoupe ? 0.66 : 0.78);
  const rearY = seatY + 0.03;
  if (isCoupe) {
    [-0.33, 0.33].forEach((rx) => {
      addPart(interiorGroup, new THREE.BoxGeometry(0.36, 0.09, 0.36), seatMat, rx, rearY + 0.04, rearZ);
      addPart(interiorGroup, new THREE.BoxGeometry(0.36, 0.4, 0.1), bolsterMat, rx, rearY + 0.24, rearZ - 0.16, -0.24);
    });
  } else {
    addPart(interiorGroup, new THREE.BoxGeometry(cabinWidth - 0.26, 0.11, 0.46), seatMat, 0, rearY + 0.05, rearZ);
    addPart(interiorGroup, new THREE.BoxGeometry(cabinWidth - 0.28, 0.48, 0.11), bolsterMat, 0, rearY + 0.28, rearZ - 0.21, -0.18);
    [-seatSpanX, 0, seatSpanX].forEach((hx) => {
      addPart(interiorGroup, new THREE.BoxGeometry(0.2, 0.13, 0.08), seatMat, hx, rearY + 0.56, rearZ - 0.26, 0.05);
    });
  }

  // 5. Animated Steering Wheel Group (`steeringWheelGroup.rotation.z` rotates cleanly around column axis)
  const steeringColumnBase = new THREE.Group();
  steeringColumnBase.position.copy(steerOffset);
  steeringColumnBase.rotation.x = -0.34;
  interiorGroup.add(steeringColumnBase);

  // Column shroud + indicator stalks (stationary)
  addPart(steeringColumnBase, new THREE.CylinderGeometry(0.034, 0.04, 0.28, 12), trimMat, 0, 0, 0.13, Math.PI / 2);
  addPart(steeringColumnBase, new THREE.BoxGeometry(0.14, 0.014, 0.018), trimMat, 0.09, 0.02, 0.06, 0, 0, 0.15);
  addPart(steeringColumnBase, new THREE.BoxGeometry(0.14, 0.014, 0.018), trimMat, -0.09, 0.02, 0.06, 0, 0, -0.15);

  const steeringWheelGroup = new THREE.Group();
  steeringColumnBase.add(steeringWheelGroup);

  const wheelR = isCoupe ? 0.15 : 0.165;
  // Sculpted Torus leather rim + 12-o'clock top racing marker stripe
  const rimTorus = new THREE.Mesh(new THREE.TorusGeometry(wheelR, 0.019, 10, 28), bolsterMat);
  steeringWheelGroup.add(rimTorus);
  addPart(steeringWheelGroup, new THREE.BoxGeometry(0.03, 0.044, 0.044), stitchMat, 0, wheelR, 0);

  // Center Airbag Hub + Chrome MANIFOLD Horn Ring + 3 Brushed Aluminum Spokes
  addPart(steeringWheelGroup, new THREE.CylinderGeometry(0.054, 0.058, 0.045, 16), trimMat, 0, 0, 0.006, Math.PI / 2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.004, 8, 16), chromeMat);
  ring.position.z = -0.019;
  steeringWheelGroup.add(ring);

  addPart(steeringWheelGroup, new THREE.BoxGeometry(wheelR * 1.85, 0.028, 0.018), chromeMat, 0, 0, 0.008);
  addPart(steeringWheelGroup, new THREE.BoxGeometry(0.032, wheelR * 0.92, 0.018), chromeMat, 0, -wheelR * 0.48, 0.008);

  // 6. Articulated Seated 3D Human Driver
  const { driverGroup, driverHeadGroup, driverArmGroups } = buildHumanDriver(
    steerOffset.x,
    seatY,
    cabinFloorY,
    seatOffsetZ,
    recline,
    steerOffset,
    isCoupe
  );
  interiorGroup.add(driverGroup);

  return {
    interiorGroup,
    steeringWheelGroup,
    driverGroup,
    driverHeadGroup,
    driverArmGroups,
  };
}
