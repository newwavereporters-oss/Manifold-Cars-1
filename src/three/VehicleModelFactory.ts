// MANIFOLD WORLD — HIGH-DETAIL PROCEDURAL AUTOMOTIVE MODEL FACTORY
// Builds realistic sculpted 3D vehicles for Sports Coupe, Luxury SUV, Executive Sedan, and Rugged 4x4
// with compound-curved bodywork, real wheel-arch cutouts, LatheGeometry contoured tyres,
// concave alloy rims, stationary calipers, bowed automotive glass, visible 2-tone cabin interiors,
// and an articulated seated 3D human driver.

import * as THREE from 'three';
import type {
  CarCustomization,
  Vehicle3DResult,
  VehicleModelType,
} from '../components/world/worldModels';
import { getVehicleTextureBank, type VehicleTextureBank } from './vehicleTextures';
import {
  buildArchAwareZStations,
  buildCurvedPanelMesh,
  buildCurvedPillar,
  buildDetailedWheelAssembly,
  buildSculptedCarBodyGeometry,
  buildSculptedWheelWells,
  computeSmoothBodyNormals,
  computeWheelArchY,
  type HullStation,
  type WheelStyleSpec,
} from './vehicleSurfaceBuilder';
import { buildDetailedInteriorAndDriver } from './driverAndInteriorBuilder';

const UNDERGLOW_HEX: Record<string, string> = {
  NONE: '#000000',
  ICE_BLUE: '#00d2ff',
  ACID_GREEN: '#10b981',
  HOT_PINK: '#ec4899',
  CYBER_AMBER: '#f59e0b',
  WHITE: '#ffffff',
};

const DEFAULT_CUSTOMIZATION: CarCustomization = {
  vehicleType: 'SPORTS_COUPE',
  paintColor: '#DC2626',
  finish: 'metallic',
  rimColor: '#E2E8F0',
  caliperColor: '#EF233C',
  headlightTint: '#ffffff',
  windowTint: 0.4,
};

function normalizeCustom(input: CarCustomization | VehicleModelType): CarCustomization {
  if (typeof input === 'string') {
    return { ...DEFAULT_CUSTOMIZATION, vehicleType: input };
  }
  return { ...DEFAULT_CUSTOMIZATION, ...input };
}

function createPaintMaterial(custom: CarCustomization): THREE.MeshPhysicalMaterial {
  const isMatte = custom.finish === 'matte';
  const isMetallic = custom.finish === 'metallic';
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(custom.paintColor || '#DC2626'),
    roughness: isMatte ? 0.54 : isMetallic ? 0.22 : 0.14,
    metalness: isMatte ? 0.24 : isMetallic ? 0.68 : 0.22,
    clearcoat: isMatte ? 0.16 : 1.0,
    clearcoatRoughness: isMatte ? 0.42 : isMetallic ? 0.08 : 0.05,
    reflectivity: isMatte ? 0.35 : 0.92,
    envMapIntensity: isMatte ? 0.85 : 1.75,
  });
}

function createGlassMaterial(windowTint: number): THREE.MeshPhysicalMaterial {
  // Keep automotive glass cleanly transparent so cabin upholstery and driver remain visible
  const opacity = 0.2 + (windowTint ?? 0.4) * 0.36;
  return new THREE.MeshPhysicalMaterial({
    color: 0x0b1626,
    roughness: 0.05,
    metalness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: Math.min(0.64, Math.max(0.18, opacity)),
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 2.1,
  });
}

function createSharedMaterials(custom: CarCustomization, textures: VehicleTextureBank | null) {
  const paintMat = createPaintMaterial(custom);
  const glassMat = createGlassMaterial(custom.windowTint);
  const clearLensMat = new THREE.MeshPhysicalMaterial({
    color: 0xeff6ff,
    roughness: 0.04,
    metalness: 0.05,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    envMapIntensity: 2.2,
  });
  const trimBlackMat = new THREE.MeshStandardMaterial({
    color: 0x12161f,
    roughness: 0.56,
    metalness: 0.22,
  });
  const matteCladdingMat = new THREE.MeshStandardMaterial({
    color: 0x161a22,
    roughness: 0.78,
    metalness: 0.08,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x1f2430,
    map: textures?.carbonWeaveColor ?? null,
    bumpMap: textures?.carbonWeaveBump ?? null,
    bumpScale: 0.004,
    roughness: 0.3,
    metalness: 0.42,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe6edf5,
    roughness: 0.12,
    metalness: 0.94,
    envMapIntensity: 1.7,
  });
  const meshGrilleMat = new THREE.MeshStandardMaterial({
    color: 0x0a0d14,
    map: textures?.grilleMeshColor ?? null,
    bumpMap: textures?.grilleMeshBump ?? null,
    bumpScale: 0.01,
    roughness: 0.55,
    metalness: 0.45,
  });
  const wheelWellLinerMat = new THREE.MeshStandardMaterial({
    color: 0x080a0e,
    roughness: 0.94,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.headlightTint || '#ffffff'),
    map: textures?.headlightOptics ?? null,
    emissive: new THREE.Color(custom.headlightTint || '#f8fafc'),
    emissiveMap: textures?.headlightOptics ?? null,
    emissiveIntensity: 2.1,
    roughness: 0.14,
  });
  const drlMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xe0f2fe,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef233c,
    emissive: 0xef233c,
    emissiveIntensity: 1.65,
    roughness: 0.18,
  });
  const amberSignalMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.08,
    roughness: 0.24,
  });
  const reverseMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xffffff,
    emissiveIntensity: 0.08,
    roughness: 0.2,
  });

  return {
    paintMat,
    glassMat,
    clearLensMat,
    trimBlackMat,
    matteCladdingMat,
    carbonMat,
    chromeMat,
    meshGrilleMat,
    wheelWellLinerMat,
    headlightMat,
    drlMat,
    taillightMat,
    amberSignalMat,
    reverseMat,
  };
}

function addBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  rotX = 0,
  rotY = 0,
  rotZ = 0,
  castShadow = true
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rotX, rotY, rotZ);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCyl(
  parent: THREE.Object3D,
  rTop: number,
  rBot: number,
  len: number,
  segs: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  rotX = 0,
  rotY = 0,
  rotZ = 0,
  castShadow = true
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, segs), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rotX, rotY, rotZ);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/**
 * Builds flush tapered side greenhouse glass connecting beltline points to curved roof rails.
 */
function buildFlushSideGlass(
  parent: THREE.Group,
  frontBotX: number,
  frontBotY: number,
  frontBotZ: number,
  rearBotX: number,
  rearBotY: number,
  rearBotZ: number,
  frontTopX: number,
  frontTopY: number,
  frontTopZ: number,
  rearTopX: number,
  rearTopY: number,
  rearTopZ: number,
  glassMat: THREE.Material
) {
  [-1, 1].forEach((side) => {
    const positions = new Float32Array([
      side * frontBotX, frontBotY, frontBotZ,
      side * rearBotX, rearBotY, rearBotZ,
      side * rearTopX, rearTopY, rearTopZ,
      side * frontTopX, frontTopY, frontTopZ,
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(side > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, glassMat);
    parent.add(mesh);
  });
}

/**
 * Builds aerodynamic mirrors with painted shells, gloss black stalks, and reflective glass inset
 */
function buildSideMirrors(
  parent: THREE.Group,
  paintMat: THREE.Material,
  trimMat: THREE.Material,
  chromeMat: THREE.Material,
  xPos: number,
  yPos: number,
  zPos: number
) {
  [-1, 1].forEach((s) => {
    const g = new THREE.Group();
    g.position.set(s * xPos, yPos, zPos);
    addBox(g, 0.11, 0.036, 0.055, trimMat, s * 0.02, -0.02, 0, 0, 0, s * 0.28);
    addBox(g, 0.17, 0.088, 0.105, paintMat, s * 0.09, 0.01, -0.02, 0, s * -0.14, 0);
    // Reflective inner mirror face
    addBox(g, 0.14, 0.068, 0.015, chromeMat, s * 0.09, 0.01, -0.07, 0, s * -0.14, 0, false);
    parent.add(g);
  });
}

/**
 * Builds subtle door seam accents and flush metallic/painted door handles
 */
function buildDoorHandlesAndSeams(
  parent: THREE.Group,
  xWidthAtBelt: number,
  yHandle: number,
  frontHandleZ: number,
  rearHandleZ: number | null,
  handleMat: THREE.Material,
  seamMat: THREE.Material,
  doorCutZs: number[]
) {
  [-1, 1].forEach((side) => {
    addBox(parent, 0.032, 0.032, 0.15, handleMat, side * (xWidthAtBelt + 0.008), yHandle, frontHandleZ);
    if (rearHandleZ !== null) {
      addBox(parent, 0.032, 0.032, 0.15, handleMat, side * (xWidthAtBelt + 0.008), yHandle, rearHandleZ);
    }
    doorCutZs.forEach((dz) => {
      addBox(parent, 0.016, 0.36, 0.01, seamMat, side * (xWidthAtBelt - 0.006), yHandle - 0.12, dz, 0, 0, 0, false);
    });
  });
}

/**
 * Builds dual front windshield wiper blades at the cowl base
 */
function buildWindshieldWipers(
  parent: THREE.Group,
  yPos: number,
  zPos: number,
  trimMat: THREE.Material
) {
  [-0.32, 0.18].forEach((wx) => {
    addBox(parent, 0.44, 0.016, 0.022, trimMat, wx, yPos, zPos, -0.1, 0, 0.08, false);
  });
}

/**
 * Builds front & rear Lagos Nigeria license plates using shared texture bank
 */
function addLicensePlates(
  parent: THREE.Group,
  frontPos: [number, number, number],
  rearPos: [number, number, number],
  textures: VehicleTextureBank | null,
  trimMat: THREE.Material
) {
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    map: textures?.licensePlate ?? null,
    roughness: 0.38,
  });

  const backingGeo = new THREE.BoxGeometry(0.5, 0.135, 0.02);
  const plateGeo = new THREE.PlaneGeometry(0.47, 0.115);

  const fBack = new THREE.Mesh(backingGeo, trimMat);
  fBack.position.set(frontPos[0], frontPos[1], frontPos[2]);
  const fFace = new THREE.Mesh(plateGeo, plateMat);
  fFace.position.set(frontPos[0], frontPos[1], frontPos[2] + 0.012);

  const rBack = new THREE.Mesh(backingGeo, trimMat);
  rBack.position.set(rearPos[0], rearPos[1], rearPos[2]);
  const rFace = new THREE.Mesh(plateGeo, plateMat);
  rFace.position.set(rearPos[0], rearPos[1], rearPos[2] - 0.012);
  rFace.rotation.y = Math.PI;

  parent.add(fBack, fFace, rBack, rFace);
}

/**
 * Builds rear aerodynamic spoiler options
 */
function buildSpoiler(
  custom: CarCustomization,
  paintMat: THREE.Material,
  carbonMat: THREE.Material,
  yPos: number,
  zPos: number,
  width = 1.66
): THREE.Group | null {
  const spoiler = custom.spoiler || 'NONE';
  if (spoiler === 'NONE') return null;

  const sg = new THREE.Group();
  if (spoiler === 'DUCKTAIL') {
    addBox(sg, width * 0.88, 0.09, 0.16, paintMat, 0, yPos + 0.02, zPos - 0.01, -0.38);
    addBox(sg, width * 0.86, 0.024, 0.08, carbonMat, 0, yPos + 0.06, zPos - 0.05, -0.38);
  } else {
    [-0.46, 0.46].forEach((sx) => {
      addBox(sg, 0.036, 0.25, 0.14, carbonMat, sx, yPos + 0.12, zPos, -0.18);
    });
    addBox(sg, width, 0.036, 0.24, carbonMat, 0, yPos + 0.25, zPos - 0.03, 0.09);
    [-width / 2, width / 2].forEach((ex) => {
      addBox(sg, 0.03, 0.15, 0.32, paintMat, ex, yPos + 0.25, zPos - 0.03);
    });
  }
  return sg;
}

/**
 * Builds chassis underglow lighting
 */
function buildUnderglow(custom: CarCustomization, zSpread = 1.25): {
  underglowLight: THREE.PointLight | null;
  underglowGroup: THREE.Group;
} {
  const underglowGroup = new THREE.Group();
  const glowKey = custom.underglow || 'NONE';
  if (glowKey === 'NONE') return { underglowLight: null, underglowGroup };

  const hex = UNDERGLOW_HEX[glowKey] || '#00d2ff';
  const color = new THREE.Color(hex);
  const underglowLight = new THREE.PointLight(color, 3.2, 8.5, 1.5);
  underglowLight.position.set(0, 0.18, 0);
  underglowGroup.add(underglowLight);

  const tubeMat = new THREE.MeshBasicMaterial({ color });
  [-0.78, 0.78].forEach((lx) => {
    addCyl(underglowGroup, 0.02, 0.02, zSpread * 2, 8, tubeMat, lx, 0.15, 0, Math.PI / 2, 0, 0, false);
  });

  return { underglowLight, underglowGroup };
}

/**
 * Builds dual front headlights SpotLights
 */
function buildHeadlightSpotlights() {
  const spotGroup = new THREE.Group();
  const spotL = new THREE.SpotLight(0xfffbeb, 0, 48, Math.PI / 4.8, 0.45, 1.2);
  const targetL = new THREE.Object3D();
  targetL.position.set(-0.75, 0.2, 16);
  spotL.target = targetL;

  const spotR = new THREE.SpotLight(0xfffbeb, 0, 48, Math.PI / 4.8, 0.45, 1.2);
  const targetR = new THREE.Object3D();
  targetR.position.set(0.75, 0.2, 16);
  spotR.target = targetR;

  spotGroup.add(spotL, targetL, spotR, targetR);
  return { spotL, spotR, spotGroup };
}

/**
 * Places 4 articulated wheel assemblies cleanly with wheel-center Y = wheelRadius (tyres sit flush on y = 0).
 */
function attachFourWheels(
  carGroup: THREE.Group,
  custom: CarCustomization,
  textures: VehicleTextureBank | null,
  trackX: number,
  frontZ: number,
  rearZ: number,
  radius: number,
  frontWidth: number,
  rearWidth: number,
  rimRadius: number,
  spokePattern: WheelStyleSpec['spokePattern'],
  isOffroad = false
) {
  const fl = buildDetailedWheelAssembly(
    custom,
    { spokePattern, radius, width: frontWidth, rimRadius, isRightSide: false, isOffroad },
    textures
  );
  fl.steerGroup.position.set(-trackX, radius, frontZ);

  const fr = buildDetailedWheelAssembly(
    custom,
    { spokePattern, radius, width: frontWidth, rimRadius, isRightSide: true, isOffroad },
    textures
  );
  fr.steerGroup.position.set(trackX, radius, frontZ);

  const rl = buildDetailedWheelAssembly(
    custom,
    { spokePattern, radius, width: rearWidth, rimRadius, isRightSide: false, isOffroad },
    textures
  );
  rl.steerGroup.position.set(-trackX, radius, rearZ);

  const rr = buildDetailedWheelAssembly(
    custom,
    { spokePattern, radius, width: rearWidth, rimRadius, isRightSide: true, isOffroad },
    textures
  );
  rr.steerGroup.position.set(trackX, radius, rearZ);

  carGroup.add(fl.steerGroup, fr.steerGroup, rl.steerGroup, rr.steerGroup);

  return {
    frontLeftWheel: fl.steerGroup,
    frontRightWheel: fr.steerGroup,
    rearLeftWheel: rl.steerGroup,
    rearRightWheel: rr.steerGroup,
    wheelSteeringGroups: {
      frontLeft: fl.steerGroup,
      frontRight: fr.steerGroup,
    },
    wheelSpinGroups: {
      frontLeft: fl.spinGroup,
      frontRight: fr.spinGroup,
      rearLeft: rl.spinGroup,
      rearRight: rr.spinGroup,
    },
  };
}

/**
 * Shared vehicle chassis animation helper (zero GC).
 * Handles front steering, 4-wheel forward/reverse rolling spin, steering wheel rotation,
 * subtle driver head & arm motion, subtle suspension squat/dive/roll, and COCKPIT camera driver culling.
 */
export function animateVehicleModel(
  vehicle: Vehicle3DResult,
  params: {
    speed: number;
    steeringAngle: number;
    wheelSpinAngle: number;
    accelLoad?: number;
    delta?: number;
    isCockpitCamera?: boolean;
  }
) {
  const { steeringAngle, wheelSpinAngle, accelLoad = 0, delta = 0.016, isCockpitCamera = false } = params;

  if (vehicle.wheelSteeringGroups) {
    vehicle.wheelSteeringGroups.frontLeft.rotation.y = steeringAngle;
    vehicle.wheelSteeringGroups.frontRight.rotation.y = steeringAngle;
  } else {
    vehicle.frontLeftWheel.rotation.y = steeringAngle;
    vehicle.frontRightWheel.rotation.y = Math.PI + steeringAngle;
  }

  if (vehicle.wheelSpinGroups) {
    vehicle.wheelSpinGroups.frontLeft.rotation.x = wheelSpinAngle;
    vehicle.wheelSpinGroups.frontRight.rotation.x = wheelSpinAngle;
    vehicle.wheelSpinGroups.rearLeft.rotation.x = wheelSpinAngle;
    vehicle.wheelSpinGroups.rearRight.rotation.x = wheelSpinAngle;
  } else {
    vehicle.frontLeftWheel.rotation.x = wheelSpinAngle;
    vehicle.frontRightWheel.rotation.x = -wheelSpinAngle;
    vehicle.rearLeftWheel.rotation.x = wheelSpinAngle;
    vehicle.rearRightWheel.rotation.x = -wheelSpinAngle;
  }

  if (vehicle.steeringWheelGroup) {
    vehicle.steeringWheelGroup.rotation.z = -steeringAngle * 2.1;
  }

  if (vehicle.driverGroup) {
    vehicle.driverGroup.visible = !isCockpitCamera;
  }
  if (vehicle.driverHeadGroup) {
    const targetHeadYaw = steeringAngle * 0.45;
    vehicle.driverHeadGroup.rotation.y += (targetHeadYaw - vehicle.driverHeadGroup.rotation.y) * Math.min(1, delta * 8);
  }
  if (vehicle.driverArmGroups) {
    const [armNeg, armPos] = vehicle.driverArmGroups;
    armNeg.rotation.x = steeringAngle * 0.22;
    armPos.rotation.x = -steeringAngle * 0.22;
  }

  if (vehicle.chassisGroup) {
    // Subtle pitch under accel/braking and body roll in corners while tyres remain planted at y = 0
    const targetRoll = THREE.MathUtils.clamp(-steeringAngle * (params.speed * 0.0022), -0.045, 0.045);
    const targetPitch = THREE.MathUtils.clamp(-accelLoad * 0.02, -0.028, 0.028);
    vehicle.chassisGroup.rotation.z += (targetRoll - vehicle.chassisGroup.rotation.z) * Math.min(1, delta * 9);
    vehicle.chassisGroup.rotation.x += (targetPitch - vehicle.chassisGroup.rotation.x) * Math.min(1, delta * 9);
  }
}

export class VehicleModelFactory {
  public static create(input: CarCustomization | VehicleModelType): Vehicle3DResult {
    const custom = normalizeCustom(input);
    switch (custom.vehicleType) {
      case 'LUXURY_SUV':
        return VehicleModelFactory.createLuxurySUV(custom);
      case 'EXECUTIVE_SEDAN':
        return VehicleModelFactory.createExecutiveSedan(custom);
      case 'RUGGED_4X4':
        return VehicleModelFactory.createRugged4x4(custom);
      case 'SPORTS_COUPE':
      default:
        return VehicleModelFactory.createSportsCoupe(custom);
    }
  }

  public static createGroup(input: CarCustomization | VehicleModelType): THREE.Group {
    return VehicleModelFactory.create(input).carGroup;
  }

  /**
   * 1. SPORTS COUPE — Low-slung sculpted track grand tourer, fastback glass, wide rear haunches
   */
  public static createSportsCoupe(input: CarCustomization): Vehicle3DResult {
    const custom = normalizeCustom({ ...input, vehicleType: 'SPORTS_COUPE' });
    const textures = getVehicleTextureBank();
    const mats = createSharedMaterials(custom, textures);

    const carGroup = new THREE.Group();
    const chassisGroup = new THREE.Group();
    carGroup.add(chassisGroup);

    const frontZ = 1.4;
    const rearZ = -1.36;
    const wheelR = 0.36;
    const wheelW = 0.28;
    const trackX = 0.9;
    const archR = wheelR + 0.068;

    // 1. Sculpted Compound-Curved Coupe Hull with Real Wheel-Arch Cutouts & Open Cabin
    const zMin = -2.14;
    const zMax = 2.18;
    const cabinEndZ = -1.04;
    const cabinStartZ = 0.72;
    const zStations = buildArchAwareZStations(zMin, zMax, rearZ, frontZ, archR, cabinEndZ, cabinStartZ);

    const stations: HullStation[] = zStations.map((z) => {
      const t = (z - zMin) / (zMax - zMin); // 0 = rear tail, 1 = front nose
      const isFrontNose = z > 1.7;
      const isRearTail = z < -1.65;
      const haunchBoost = Math.exp(-Math.pow((z - -1.25) / 0.55, 2)) * 0.055;
      const noseTaper = isFrontNose ? Math.pow((z - 1.7) / (zMax - 1.7), 1.55) * 0.18 : 0;
      const tailTaper = isRearTail ? Math.pow((-1.65 - z) / (-1.65 - zMin), 1.4) * 0.1 : 0;

      const baseSillY = 0.18 + (isFrontNose ? noseTaper * 0.28 : 0) + (isRearTail ? tailTaper * 0.6 : 0);
      const ySill = computeWheelArchY(z, baseSillY, frontZ, rearZ, wheelR, archR);

      const yCrease = Math.max(ySill + 0.02, 0.54 - noseTaper * 0.5 + (1 - t) * 0.05);
      const yBelt = Math.max(ySill + 0.04, 0.76 - noseTaper * 1.15 + (1 - t) * 0.08);
      const yDeck = Math.max(yBelt + 0.03, 0.81 - noseTaper * 1.4 + (1 - t) * 0.09);
      const yCrown = yDeck + (z > 0.72 ? 0.065 * (1 - noseTaper * 2) : 0.045);

      const wBelt = 0.94 + haunchBoost - noseTaper * 0.9 - tailTaper * 0.65;
      const wCrease = wBelt + 0.025;
      const wSill = wBelt - 0.03;
      const wDeck = wBelt - 0.12;

      return {
        z,
        ySill,
        wSill,
        yCrease,
        wCrease,
        yBelt,
        wBelt,
        yDeck,
        wDeck,
        yCrown,
        isCabin: z >= cabinEndZ && z <= cabinStartZ,
      };
    });

    const bodyGeo = computeSmoothBodyNormals(buildSculptedCarBodyGeometry(stations), 40);
    const bodyMesh = new THREE.Mesh(bodyGeo, mats.paintMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    chassisGroup.add(bodyMesh);

    // 2. Wheelhouse Tubs & Sculpted Fender-Arch Flares
    buildSculptedWheelWells(
      chassisGroup,
      archR,
      wheelW + 0.11,
      trackX,
      frontZ,
      rearZ,
      wheelR,
      mats.wheelWellLinerMat,
      mats.paintMat,
      0.06,
      0.045
    );

    // 3. Carbon Aero Kit (Undertray, Front Splitter, Side Skirts, Rear Diffuser, Quad Titanium Exhausts)
    addBox(chassisGroup, 1.54, 0.06, 4.1, mats.trimBlackMat, 0, 0.16, 0.02);
    addBox(chassisGroup, 1.84, 0.035, 0.38, mats.carbonMat, 0, 0.165, 2.04, 0.03);
    [-0.93, 0.93].forEach((sx) => {
      addBox(chassisGroup, 0.09, 0.045, 1.72, mats.carbonMat, sx, 0.17, 0.02);
      // Carbon side intake gill scoop
      addBox(chassisGroup, 0.045, 0.19, 0.16, mats.meshGrilleMat, sx * 1.0, 0.56, 0.72);
    });
    addBox(chassisGroup, 1.66, 0.14, 0.28, mats.carbonMat, 0, 0.23, -2.02, -0.1);
    [-0.48, -0.24, 0, 0.24, 0.48].forEach((fx) => {
      addBox(chassisGroup, 0.024, 0.13, 0.26, mats.carbonMat, fx, 0.22, -2.08);
    });
    [-0.56, -0.43, 0.43, 0.56].forEach((ex) => {
      addCyl(chassisGroup, 0.045, 0.045, 0.15, 14, mats.chromeMat, ex, 0.24, -2.14, Math.PI / 2);
      addCyl(chassisGroup, 0.034, 0.034, 0.05, 10, mats.trimBlackMat, ex, 0.24, -2.2, Math.PI / 2, 0, 0, false);
    });

    // 4. Sculpted Hood Power Dome & Vents + Honeycomb Grille
    addBox(chassisGroup, 0.56, 0.045, 0.92, mats.paintMat, 0, 0.878, 1.32, 0.08);
    [-0.36, 0.36].forEach((vx) => {
      addBox(chassisGroup, 0.18, 0.022, 0.28, mats.carbonMat, vx, 0.865, 1.35, 0.08);
    });
    addBox(chassisGroup, 1.04, 0.24, 0.07, mats.meshGrilleMat, 0, 0.36, 2.175, 0.08);
    addBox(chassisGroup, 1.08, 0.024, 0.08, mats.chromeMat, 0, 0.37, 2.185);
    [-0.66, 0.66].forEach((ix) => {
      addBox(chassisGroup, 0.32, 0.18, 0.08, mats.meshGrilleMat, ix, 0.34, 2.12, 0, ix > 0 ? -0.22 : 0.22);
    });

    // 5. Bowed Fastback Greenhouse (Curved Windshield, Bowed Roof, Fastback Rear Glass, Tube Pillars, Flush Side Glass)
    const windshield = buildCurvedPanelMesh(0.79, 0.81, 0.72, 0.67, 1.17, 0.06, 0.1, 0.02, mats.glassMat, 14, 6);
    const roofPanel = buildCurvedPanelMesh(0.67, 1.17, 0.06, 0.65, 1.17, -0.78, 0.02, 0.035, mats.paintMat, 12, 6, true);
    const rearGlass = buildCurvedPanelMesh(0.65, 1.17, -0.78, 0.77, 0.87, -1.56, -0.07, 0.02, mats.glassMat, 12, 6);
    chassisGroup.add(windshield, roofPanel, rearGlass);

    // Curved A/C Pillars + Subtle Door Window Frames
    [-1, 1].forEach((s) => {
      chassisGroup.add(
        buildCurvedPillar(
          new THREE.Vector3(s * 0.79, 0.81, 0.72),
          new THREE.Vector3(s * 0.02, 0.03, 0.04),
          new THREE.Vector3(s * 0.67, 1.17, 0.06),
          0.032,
          mats.trimBlackMat
        ),
        buildCurvedPillar(
          new THREE.Vector3(s * 0.65, 1.17, -0.78),
          new THREE.Vector3(s * 0.02, 0.02, -0.03),
          new THREE.Vector3(s * 0.77, 0.87, -1.56),
          0.038,
          mats.paintMat
        ),
        buildCurvedPillar(
          new THREE.Vector3(s * 0.67, 1.17, 0.06),
          new THREE.Vector3(0, 0.015, 0),
          new THREE.Vector3(s * 0.65, 1.17, -0.78),
          0.026,
          mats.trimBlackMat
        )
      );
    });
    buildFlushSideGlass(chassisGroup, 0.81, 0.81, 0.56, 0.81, 0.86, -1.04, 0.67, 1.16, 0.04, 0.65, 1.16, -0.78, mats.glassMat);

    // 6. Mirrors, Wipers, Door Handles, License Plates & Spoiler
    buildSideMirrors(chassisGroup, mats.paintMat, mats.trimBlackMat, mats.chromeMat, 0.86, 0.84, 0.48);
    buildWindshieldWipers(chassisGroup, 0.82, 0.71, mats.trimBlackMat);
    buildDoorHandlesAndSeams(chassisGroup, 0.93, 0.7, -0.34, null, mats.chromeMat, mats.trimBlackMat, [0.5, -0.58]);
    addLicensePlates(chassisGroup, [0, 0.3, 2.19], [0, 0.48, -2.15], textures, mats.trimBlackMat);

    const spoilerGroup = buildSpoiler(custom, mats.paintMat, mats.carbonMat, 0.88, -1.96, 1.72);
    if (spoilerGroup) chassisGroup.add(spoilerGroup);

    // 7. Recessed Projector Headlights + Clear Lenses + OLED Taillights + Signals
    const headlightsGroup = new THREE.Group();
    [-0.63, 0.63].forEach((lx) => {
      const yaw = lx > 0 ? -0.2 : 0.2;
      addBox(headlightsGroup, 0.32, 0.095, 0.1, mats.headlightMat, lx, 0.54, 2.08, 0, yaw, 0, false);
      addBox(headlightsGroup, 0.34, 0.022, 0.12, mats.drlMat, lx, 0.49, 2.1, 0, yaw, 0, false);
      addBox(headlightsGroup, 0.35, 0.12, 0.13, mats.clearLensMat, lx, 0.53, 2.1, 0, yaw, 0, false);
    });
    chassisGroup.add(headlightsGroup);

    const turnFrontL = addBox(chassisGroup, 0.11, 0.032, 0.08, mats.amberSignalMat.clone(), -0.8, 0.53, 2.03, 0, 0.24, 0, false);
    const turnFrontR = addBox(chassisGroup, 0.11, 0.032, 0.08, mats.amberSignalMat.clone(), 0.8, 0.53, 2.03, 0, -0.24, 0, false);
    const turnRearL = addBox(chassisGroup, 0.18, 0.036, 0.05, mats.amberSignalMat.clone(), -0.74, 0.66, -2.14, 0, 0, 0, false);
    const turnRearR = addBox(chassisGroup, 0.18, 0.036, 0.05, mats.amberSignalMat.clone(), 0.74, 0.66, -2.14, 0, 0, 0, false);

    const taillightsGroup = new THREE.Group();
    addBox(taillightsGroup, 1.54, 0.055, 0.06, mats.taillightMat, 0, 0.71, -2.14, 0, 0, 0, false);
    chassisGroup.add(taillightsGroup);

    const revL = addBox(chassisGroup, 0.16, 0.036, 0.05, mats.reverseMat, -0.56, 0.62, -2.14, 0, 0, 0, false);
    const revR = addBox(chassisGroup, 0.16, 0.036, 0.05, mats.reverseMat, 0.56, 0.62, -2.14, 0, 0, 0, false);

    const { underglowLight, underglowGroup } = buildUnderglow(custom);
    chassisGroup.add(underglowGroup);
    const { spotL, spotR, spotGroup } = buildHeadlightSpotlights();
    spotL.position.set(-0.65, 0.54, 2.14);
    spotR.position.set(0.65, 0.54, 2.14);
    chassisGroup.add(spotGroup);

    // 8. Detailed Cabin Interior + Articulated Seated Driver
    const interiorResult = buildDetailedInteriorAndDriver({
      vehicleType: 'SPORTS_COUPE',
      seatOffsetZ: -0.06,
      seatY: 0.24,
      cabinFloorY: 0.2,
      cabinWidth: 1.5,
      steerOffset: new THREE.Vector3(-0.35, 0.72, 0.25),
      interiorTheme: custom.interiorTheme || 'BLACK',
      textures,
    });
    chassisGroup.add(interiorResult.interiorGroup);

    // 9. Contoured Tyres + Y-Split 5-Spoke Rims + Cross-Drilled Rotors + Stationary Calipers
    const wheels = attachFourWheels(
      carGroup,
      custom,
      textures,
      trackX,
      frontZ,
      rearZ,
      wheelR,
      wheelW,
      wheelW + 0.03,
      0.255,
      'Y_SPLIT_5'
    );

    return {
      carGroup,
      chassisGroup,
      ...wheels,
      wheelRadius: wheelR,
      steeringWheelGroup: interiorResult.steeringWheelGroup,
      driverGroup: interiorResult.driverGroup,
      driverHeadGroup: interiorResult.driverHeadGroup,
      driverArmGroups: interiorResult.driverArmGroups,
      bodyMesh,
      paintMaterial: mats.paintMat,
      headlightsGroup,
      taillightsGroup,
      turnSignalMeshes: {
        frontLeft: turnFrontL,
        frontRight: turnFrontR,
        rearLeft: turnRearL,
        rearRight: turnRearR,
      },
      underglowLight,
      headlightSpotL: spotL,
      headlightSpotR: spotR,
      spoilerGroup,
      interiorGroup: interiorResult.interiorGroup,
      vehicleType: 'SPORTS_COUPE',
      reverseLights: [revL, revR],
      brakeLightMats: [mats.taillightMat],
    };
  }

  /**
   * 2. LUXURY SUV — Commanding upright proportions, muscular clamshell hood, panoramic glass roof
   */
  public static createLuxurySUV(input: CarCustomization): Vehicle3DResult {
    const custom = normalizeCustom({ ...input, vehicleType: 'LUXURY_SUV' });
    const textures = getVehicleTextureBank();
    const mats = createSharedMaterials(custom, textures);

    const carGroup = new THREE.Group();
    const chassisGroup = new THREE.Group();
    carGroup.add(chassisGroup);

    const frontZ = 1.5;
    const rearZ = -1.46;
    const wheelR = 0.43;
    const wheelW = 0.31;
    const trackX = 0.98;
    const archR = wheelR + 0.082;

    const zMin = -2.38;
    const zMax = 2.4;
    const cabinEndZ = -1.86;
    const cabinStartZ = 0.96;
    const zStations = buildArchAwareZStations(zMin, zMax, rearZ, frontZ, archR, cabinEndZ, cabinStartZ);

    const stations: HullStation[] = zStations.map((z) => {
      const isFrontNose = z > 1.95;
      const isRearTail = z < -2.0;
      const noseTaper = isFrontNose ? Math.pow((z - 1.95) / (zMax - 1.95), 1.45) * 0.14 : 0;
      const tailTaper = isRearTail ? Math.pow((-2.0 - z) / (-2.0 - zMin), 1.35) * 0.09 : 0;

      const baseSillY = 0.28 + (isFrontNose ? noseTaper * 0.4 : 0) + (isRearTail ? tailTaper * 0.55 : 0);
      const ySill = computeWheelArchY(z, baseSillY, frontZ, rearZ, wheelR, archR);

      const yCrease = Math.max(ySill + 0.03, 0.74 - noseTaper * 0.4);
      const yBelt = Math.max(ySill + 0.05, 1.07 - noseTaper * 0.8);
      const yDeck = Math.max(yBelt + 0.03, 1.13 - noseTaper * 0.95);
      const yCrown = yDeck + (z > 0.96 ? 0.055 * (1 - noseTaper * 2) : 0.04);

      const wBelt = 1.01 - noseTaper * 0.72 - tailTaper * 0.55;
      const wCrease = wBelt + 0.025;
      const wSill = wBelt - 0.035;
      const wDeck = wBelt - 0.11;

      return {
        z,
        ySill,
        wSill,
        yCrease,
        wCrease,
        yBelt,
        wBelt,
        yDeck,
        wDeck,
        yCrown,
        isCabin: z >= cabinEndZ && z <= cabinStartZ,
      };
    });

    const bodyGeo = computeSmoothBodyNormals(buildSculptedCarBodyGeometry(stations), 42);
    const bodyMesh = new THREE.Mesh(bodyGeo, mats.paintMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    chassisGroup.add(bodyMesh);

    // Wheel wells with SUV protective matte cladding flares
    buildSculptedWheelWells(
      chassisGroup,
      archR,
      wheelW + 0.12,
      trackX,
      frontZ,
      rearZ,
      wheelR,
      mats.wheelWellLinerMat,
      mats.matteCladdingMat,
      0.075,
      0.055
    );

    // Chassis Underbody, Skid Plates & Aluminum Running Boards
    addBox(chassisGroup, 1.72, 0.1, 4.5, mats.trimBlackMat, 0, 0.27, 0.0);
    addBox(chassisGroup, 1.24, 0.065, 0.26, mats.chromeMat, 0, 0.29, 2.33, 0.18);
    addBox(chassisGroup, 1.44, 0.08, 0.25, mats.matteCladdingMat, 0, 0.31, -2.32, -0.14);
    [-1.02, 1.02].forEach((sx) => {
      addBox(chassisGroup, 0.16, 0.05, 1.88, mats.chromeMat, sx, 0.28, 0.02);
    });
    [-0.68, 0.68].forEach((ex) => {
      addBox(chassisGroup, 0.18, 0.085, 0.14, mats.chromeMat, ex, 0.34, -2.38);
      addBox(chassisGroup, 0.14, 0.06, 0.06, mats.trimBlackMat, ex, 0.34, -2.42, 0, 0, 0, false);
    });

    // Sculpted Clamshell Hood Creases & Vertical-Slat Chrome Grille
    [-0.44, 0.44].forEach((rx) => {
      addBox(chassisGroup, 0.18, 0.032, 1.15, mats.paintMat, rx, 1.165, 1.62, 0.03);
    });
    addBox(chassisGroup, 1.14, 0.42, 0.08, mats.meshGrilleMat, 0, 0.78, 2.385);
    addBox(chassisGroup, 1.18, 0.46, 0.03, mats.chromeMat, 0, 0.78, 2.355);
    for (let gx = -0.44; gx <= 0.44; gx += 0.11) {
      addBox(chassisGroup, 0.024, 0.38, 0.05, mats.chromeMat, gx, 0.78, 2.415);
    }

    // Upright Panoramic Greenhouse + Roof Rails + Rear Tailgate Glass
    const windshield = buildCurvedPanelMesh(0.88, 1.13, 0.96, 0.77, 1.69, 0.28, 0.09, 0.02, mats.glassMat, 14, 6);
    const roofPanel = buildCurvedPanelMesh(0.77, 1.69, 0.28, 0.74, 1.68, -2.02, 0.02, 0.03, mats.paintMat, 12, 8, true);
    const panoGlass = buildCurvedPanelMesh(0.56, 1.71, -0.05, 0.55, 1.71, -1.55, 0.01, 0.02, mats.glassMat, 10, 6);
    const rearGlass = buildCurvedPanelMesh(0.74, 1.68, -2.02, 0.85, 1.21, -2.35, -0.05, 0.02, mats.glassMat, 12, 6);
    const tailgateLower = buildCurvedPanelMesh(0.85, 1.21, -2.35, 0.92, 0.8, -2.38, -0.04, 0.02, mats.paintMat, 12, 4, true);
    chassisGroup.add(windshield, roofPanel, panoGlass, rearGlass, tailgateLower);

    // Anodized Roof Rails + Rear Spoiler Lip
    [-0.68, 0.68].forEach((rx) => {
      addBox(chassisGroup, 0.045, 0.055, 2.15, mats.chromeMat, rx, 1.74, -0.88);
    });
    addBox(chassisGroup, 1.56, 0.075, 0.26, mats.paintMat, 0, 1.68, -2.14, -0.06);

    // A/B/C/D Pillars & Flush Side Greenhouse Glass
    [-1, 1].forEach((s) => {
      chassisGroup.add(
        buildCurvedPillar(new THREE.Vector3(s * 0.88, 1.13, 0.96), new THREE.Vector3(s * 0.02, 0.03, 0.03), new THREE.Vector3(s * 0.77, 1.69, 0.28), 0.036, mats.paintMat),
        buildCurvedPillar(new THREE.Vector3(s * 0.88, 1.13, -0.25), new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.76, 1.69, -0.25), 0.04, mats.trimBlackMat),
        buildCurvedPillar(new THREE.Vector3(s * 0.88, 1.13, -1.2), new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.75, 1.69, -1.2), 0.04, mats.trimBlackMat),
        buildCurvedPillar(new THREE.Vector3(s * 0.74, 1.68, -2.02), new THREE.Vector3(s * 0.02, 0.02, -0.02), new THREE.Vector3(s * 0.85, 1.21, -2.35), 0.048, mats.paintMat),
        buildCurvedPillar(new THREE.Vector3(s * 0.77, 1.69, 0.28), new THREE.Vector3(0, 0.015, 0), new THREE.Vector3(s * 0.74, 1.68, -2.02), 0.03, mats.paintMat)
      );
    });
    buildFlushSideGlass(chassisGroup, 0.88, 1.14, 0.86, 0.86, 1.18, -1.98, 0.77, 1.67, 0.26, 0.74, 1.67, -1.96, mats.glassMat);

    // Mirrors, Wipers, Handles & Plates
    buildSideMirrors(chassisGroup, mats.paintMat, mats.trimBlackMat, mats.chromeMat, 0.96, 1.19, 0.76);
    buildWindshieldWipers(chassisGroup, 1.15, 0.94, mats.trimBlackMat);
    buildDoorHandlesAndSeams(chassisGroup, 1.0, 0.99, 0.04, -0.9, mats.chromeMat, mats.trimBlackMat, [0.74, -0.26, -1.2]);
    addLicensePlates(chassisGroup, [0, 0.45, 2.41], [0, 0.82, -2.39], textures, mats.trimBlackMat);

    // Lights
    const headlightsGroup = new THREE.Group();
    [-0.72, 0.72].forEach((lx) => {
      const yaw = lx > 0 ? -0.14 : 0.14;
      addBox(headlightsGroup, 0.34, 0.12, 0.12, mats.headlightMat, lx, 0.88, 2.35, 0, yaw, 0, false);
      addBox(headlightsGroup, 0.34, 0.028, 0.13, mats.drlMat, lx, 0.81, 2.36, 0, yaw, 0, false);
      addBox(headlightsGroup, 0.36, 0.14, 0.14, mats.clearLensMat, lx, 0.87, 2.37, 0, yaw, 0, false);
    });
    chassisGroup.add(headlightsGroup);

    const turnFrontL = addBox(chassisGroup, 0.11, 0.038, 0.09, mats.amberSignalMat.clone(), -0.91, 0.87, 2.26, 0, 0.2, 0, false);
    const turnFrontR = addBox(chassisGroup, 0.11, 0.038, 0.09, mats.amberSignalMat.clone(), 0.91, 0.87, 2.26, 0, -0.2, 0, false);
    const turnRearL = addBox(chassisGroup, 0.22, 0.042, 0.05, mats.amberSignalMat.clone(), -0.78, 0.97, -2.38, 0, 0, 0, false);
    const turnRearR = addBox(chassisGroup, 0.22, 0.042, 0.05, mats.amberSignalMat.clone(), 0.78, 0.97, -2.38, 0, 0, 0, false);

    const taillightsGroup = new THREE.Group();
    [-0.76, 0.76].forEach((lx) => {
      addBox(taillightsGroup, 0.38, 0.1, 0.07, mats.taillightMat, lx, 1.05, -2.38, 0, 0, 0, false);
    });
    addBox(taillightsGroup, 1.2, 0.035, 0.055, mats.taillightMat, 0, 1.05, -2.38, 0, 0, 0, false);
    chassisGroup.add(taillightsGroup);

    const revL = addBox(chassisGroup, 0.18, 0.042, 0.05, mats.reverseMat, -0.62, 0.91, -2.38, 0, 0, 0, false);
    const revR = addBox(chassisGroup, 0.18, 0.042, 0.05, mats.reverseMat, 0.62, 0.91, -2.38, 0, 0, 0, false);

    const { underglowLight, underglowGroup } = buildUnderglow(custom, 1.38);
    chassisGroup.add(underglowGroup);
    const { spotL, spotR, spotGroup } = buildHeadlightSpotlights();
    spotL.position.set(-0.74, 0.88, 2.42);
    spotR.position.set(0.74, 0.88, 2.42);
    chassisGroup.add(spotGroup);

    // Interior + Driver
    const interiorResult = buildDetailedInteriorAndDriver({
      vehicleType: 'LUXURY_SUV',
      seatOffsetZ: 0.12,
      seatY: 0.76,
      cabinFloorY: 0.42,
      cabinWidth: 1.66,
      steerOffset: new THREE.Vector3(-0.42, 1.24, 0.44),
      interiorTheme: custom.interiorTheme || 'BLACK',
      textures,
    });
    chassisGroup.add(interiorResult.interiorGroup);

    // Wheels
    const wheels = attachFourWheels(
      carGroup,
      custom,
      textures,
      trackX,
      frontZ,
      rearZ,
      wheelR,
      wheelW,
      wheelW,
      0.29,
      'TWIN_5'
    );

    return {
      carGroup,
      chassisGroup,
      ...wheels,
      wheelRadius: wheelR,
      steeringWheelGroup: interiorResult.steeringWheelGroup,
      driverGroup: interiorResult.driverGroup,
      driverHeadGroup: interiorResult.driverHeadGroup,
      driverArmGroups: interiorResult.driverArmGroups,
      bodyMesh,
      paintMaterial: mats.paintMat,
      headlightsGroup,
      taillightsGroup,
      turnSignalMeshes: {
        frontLeft: turnFrontL,
        frontRight: turnFrontR,
        rearLeft: turnRearL,
        rearRight: turnRearR,
      },
      underglowLight,
      headlightSpotL: spotL,
      headlightSpotR: spotR,
      spoilerGroup: null,
      interiorGroup: interiorResult.interiorGroup,
      vehicleType: 'LUXURY_SUV',
      reverseLights: [revL, revR],
      brakeLightMats: [mats.taillightMat],
    };
  }

  /**
   * 3. EXECUTIVE SEDAN — Long 3-box sculpted limousine proportions, multi-slat chrome grille, crisp notched trunk
   */
  public static createExecutiveSedan(input: CarCustomization): Vehicle3DResult {
    const custom = normalizeCustom({ ...input, vehicleType: 'EXECUTIVE_SEDAN' });
    const textures = getVehicleTextureBank();
    const mats = createSharedMaterials(custom, textures);

    const carGroup = new THREE.Group();
    const chassisGroup = new THREE.Group();
    carGroup.add(chassisGroup);

    const frontZ = 1.48;
    const rearZ = -1.44;
    const wheelR = 0.37;
    const wheelW = 0.26;
    const trackX = 0.91;
    const archR = wheelR + 0.068;

    const zMin = -2.32;
    const zMax = 2.34;
    const cabinEndZ = -1.25;
    const cabinStartZ = 0.85;
    const zStations = buildArchAwareZStations(zMin, zMax, rearZ, frontZ, archR, cabinEndZ, cabinStartZ);

    const stations: HullStation[] = zStations.map((z) => {
      const isFrontNose = z > 1.88;
      const isRearTail = z < -1.85;
      const noseTaper = isFrontNose ? Math.pow((z - 1.88) / (zMax - 1.88), 1.5) * 0.15 : 0;
      const tailTaper = isRearTail ? Math.pow((-1.85 - z) / (-1.85 - zMin), 1.4) * 0.1 : 0;

      const baseSillY = 0.2 + (isFrontNose ? noseTaper * 0.35 : 0) + (isRearTail ? tailTaper * 0.65 : 0);
      const ySill = computeWheelArchY(z, baseSillY, frontZ, rearZ, wheelR, archR);

      const yCrease = Math.max(ySill + 0.02, 0.58 - noseTaper * 0.45);
      const yBelt = Math.max(ySill + 0.04, 0.86 - noseTaper * 0.95);
      const yDeck = Math.max(yBelt + 0.03, 0.91 - noseTaper * 1.15);
      const yCrown = yDeck + (z > 0.85 ? 0.055 * (1 - noseTaper * 2) : 0.035);

      const wBelt = 0.94 - noseTaper * 0.78 - tailTaper * 0.62;
      const wCrease = wBelt + 0.02;
      const wSill = wBelt - 0.03;
      const wDeck = wBelt - 0.11;

      return {
        z,
        ySill,
        wSill,
        yCrease,
        wCrease,
        yBelt,
        wBelt,
        yDeck,
        wDeck,
        yCrown,
        isCabin: z >= cabinEndZ && z <= cabinStartZ,
      };
    });

    const bodyGeo = computeSmoothBodyNormals(buildSculptedCarBodyGeometry(stations), 40);
    const bodyMesh = new THREE.Mesh(bodyGeo, mats.paintMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    chassisGroup.add(bodyMesh);

    buildSculptedWheelWells(
      chassisGroup,
      archR,
      wheelW + 0.1,
      trackX,
      frontZ,
      rearZ,
      wheelR,
      mats.wheelWellLinerMat,
      mats.paintMat,
      0.055,
      0.04
    );

    // Chrome Rocker Moldings, Rear Valance & Dual Exhausts
    addBox(chassisGroup, 1.56, 0.07, 4.4, mats.trimBlackMat, 0, 0.2, 0.02);
    [-0.92, 0.92].forEach((sx) => {
      addBox(chassisGroup, 0.05, 0.035, 1.88, mats.chromeMat, sx, 0.22, 0.02);
      addBox(chassisGroup, 0.026, 0.026, 1.92, mats.chromeMat, sx, 0.9, -0.2);
    });
    addBox(chassisGroup, 1.66, 0.14, 0.24, mats.trimBlackMat, 0, 0.26, -2.22);
    [-0.6, 0.6].forEach((ex) => {
      addCyl(chassisGroup, 0.054, 0.054, 0.15, 12, mats.chromeMat, ex, 0.27, -2.33, Math.PI / 2);
    });

    // Multi-Slat Chrome Executive Grille + Hood Crest Line
    addBox(chassisGroup, 0.98, 0.3, 0.08, mats.meshGrilleMat, 0, 0.57, 2.33);
    addBox(chassisGroup, 1.02, 0.34, 0.03, mats.chromeMat, 0, 0.57, 2.3);
    [-0.08, 0, 0.08].forEach((gy) => {
      addBox(chassisGroup, 0.92, 0.02, 0.04, mats.chromeMat, 0, 0.57 + gy, 2.36);
    });

    // Bowed 3-Box Executive Greenhouse + Shark-Fin Antenna
    const windshield = buildCurvedPanelMesh(0.81, 0.91, 0.85, 0.7, 1.35, 0.2, 0.09, 0.02, mats.glassMat, 14, 6);
    const roofPanel = buildCurvedPanelMesh(0.7, 1.35, 0.2, 0.68, 1.35, -0.82, 0.02, 0.032, mats.paintMat, 12, 6, true);
    const rearGlass = buildCurvedPanelMesh(0.68, 1.35, -0.82, 0.78, 0.94, -1.56, -0.06, 0.02, mats.glassMat, 12, 6);
    chassisGroup.add(windshield, roofPanel, rearGlass);
    addBox(chassisGroup, 0.045, 0.085, 0.17, mats.trimBlackMat, 0, 1.4, -0.75, -0.32);

    [-1, 1].forEach((s) => {
      chassisGroup.add(
        buildCurvedPillar(new THREE.Vector3(s * 0.81, 0.91, 0.85), new THREE.Vector3(s * 0.02, 0.03, 0.03), new THREE.Vector3(s * 0.7, 1.35, 0.2), 0.032, mats.paintMat),
        buildCurvedPillar(new THREE.Vector3(s * 0.81, 0.91, -0.26), new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.69, 1.35, -0.26), 0.035, mats.trimBlackMat),
        buildCurvedPillar(new THREE.Vector3(s * 0.68, 1.35, -0.82), new THREE.Vector3(s * 0.02, 0.02, -0.02), new THREE.Vector3(s * 0.78, 0.94, -1.56), 0.04, mats.paintMat),
        buildCurvedPillar(new THREE.Vector3(s * 0.7, 1.35, 0.2), new THREE.Vector3(0, 0.015, 0), new THREE.Vector3(s * 0.68, 1.35, -0.82), 0.026, mats.chromeMat)
      );
    });
    buildFlushSideGlass(chassisGroup, 0.82, 0.91, 0.76, 0.8, 0.94, -1.25, 0.7, 1.34, 0.18, 0.68, 1.34, -0.82, mats.glassMat);

    // Mirrors, Wipers, Handles, Spoiler & Plates
    buildSideMirrors(chassisGroup, mats.paintMat, mats.trimBlackMat, mats.chromeMat, 0.9, 0.96, 0.6);
    buildWindshieldWipers(chassisGroup, 0.93, 0.83, mats.trimBlackMat);
    buildDoorHandlesAndSeams(chassisGroup, 0.93, 0.82, -0.02, -0.86, mats.chromeMat, mats.trimBlackMat, [0.68, -0.26, -1.16]);
    addLicensePlates(chassisGroup, [0, 0.36, 2.34], [0, 0.6, -2.33], textures, mats.trimBlackMat);

    const spoilerGroup = buildSpoiler(custom, mats.paintMat, mats.carbonMat, 0.96, -2.18, 1.6);
    if (spoilerGroup) chassisGroup.add(spoilerGroup);

    // Lights
    const headlightsGroup = new THREE.Group();
    [-0.66, 0.66].forEach((lx) => {
      const yaw = lx > 0 ? -0.15 : 0.15;
      addBox(headlightsGroup, 0.32, 0.1, 0.11, mats.headlightMat, lx, 0.66, 2.27, 0, yaw, 0, false);
      addBox(headlightsGroup, 0.32, 0.024, 0.12, mats.drlMat, lx, 0.71, 2.28, 0, yaw, 0, false);
      addBox(headlightsGroup, 0.34, 0.12, 0.13, mats.clearLensMat, lx, 0.66, 2.29, 0, yaw, 0, false);
    });
    chassisGroup.add(headlightsGroup);

    const turnFrontL = addBox(chassisGroup, 0.1, 0.034, 0.08, mats.amberSignalMat.clone(), -0.84, 0.65, 2.19, 0, 0.2, 0, false);
    const turnFrontR = addBox(chassisGroup, 0.1, 0.034, 0.08, mats.amberSignalMat.clone(), 0.84, 0.65, 2.19, 0, -0.2, 0, false);
    const turnRearL = addBox(chassisGroup, 0.22, 0.036, 0.05, mats.amberSignalMat.clone(), -0.7, 0.73, -2.32, 0, 0, 0, false);
    const turnRearR = addBox(chassisGroup, 0.22, 0.036, 0.05, mats.amberSignalMat.clone(), 0.7, 0.73, -2.32, 0, 0, 0, false);

    const taillightsGroup = new THREE.Group();
    [-0.68, 0.68].forEach((lx) => {
      addBox(taillightsGroup, 0.38, 0.088, 0.07, mats.taillightMat, lx, 0.78, -2.32, 0, 0, 0, false);
    });
    addBox(taillightsGroup, 0.9, 0.024, 0.05, mats.chromeMat, 0, 0.8, -2.32, 0, 0, 0, false);
    chassisGroup.add(taillightsGroup);

    const revL = addBox(chassisGroup, 0.16, 0.038, 0.05, mats.reverseMat, -0.54, 0.69, -2.32, 0, 0, 0, false);
    const revR = addBox(chassisGroup, 0.16, 0.038, 0.05, mats.reverseMat, 0.54, 0.69, -2.32, 0, 0, 0, false);

    const { underglowLight, underglowGroup } = buildUnderglow(custom, 1.32);
    chassisGroup.add(underglowGroup);
    const { spotL, spotR, spotGroup } = buildHeadlightSpotlights();
    spotL.position.set(-0.68, 0.66, 2.35);
    spotR.position.set(0.68, 0.66, 2.35);
    chassisGroup.add(spotGroup);

    // Interior + Driver
    const interiorResult = buildDetailedInteriorAndDriver({
      vehicleType: 'EXECUTIVE_SEDAN',
      seatOffsetZ: 0.04,
      seatY: 0.39,
      cabinFloorY: 0.24,
      cabinWidth: 1.54,
      steerOffset: new THREE.Vector3(-0.38, 0.89, 0.36),
      interiorTheme: custom.interiorTheme || 'BLACK',
      textures,
    });
    chassisGroup.add(interiorResult.interiorGroup);

    // Wheels
    const wheels = attachFourWheels(
      carGroup,
      custom,
      textures,
      trackX,
      frontZ,
      rearZ,
      wheelR,
      wheelW,
      wheelW,
      0.265,
      'TURBINE_10'
    );

    return {
      carGroup,
      chassisGroup,
      ...wheels,
      wheelRadius: wheelR,
      steeringWheelGroup: interiorResult.steeringWheelGroup,
      driverGroup: interiorResult.driverGroup,
      driverHeadGroup: interiorResult.driverHeadGroup,
      driverArmGroups: interiorResult.driverArmGroups,
      bodyMesh,
      paintMaterial: mats.paintMat,
      headlightsGroup,
      taillightsGroup,
      turnSignalMeshes: {
        frontLeft: turnFrontL,
        frontRight: turnFrontR,
        rearLeft: turnRearL,
        rearRight: turnRearR,
      },
      underglowLight,
      headlightSpotL: spotL,
      headlightSpotR: spotR,
      spoilerGroup,
      interiorGroup: interiorResult.interiorGroup,
      vehicleType: 'EXECUTIVE_SEDAN',
      reverseLights: [revL, revR],
      brakeLightMats: [mats.taillightMat],
    };
  }

  /**
   * 4. RUGGED 4X4 — High-clearance expedition Defender with bull bar, snorkel, roof light rack & tailgate spare wheel
   */
  public static createRugged4x4(input: CarCustomization): Vehicle3DResult {
    const custom = normalizeCustom({ ...input, vehicleType: 'RUGGED_4X4' });
    const textures = getVehicleTextureBank();
    const mats = createSharedMaterials(custom, textures);

    const carGroup = new THREE.Group();
    const chassisGroup = new THREE.Group();
    carGroup.add(chassisGroup);

    const frontZ = 1.48;
    const rearZ = -1.44;
    const wheelR = 0.46;
    const wheelW = 0.33;
    const trackX = 1.0;
    const archR = wheelR + 0.095;

    const zMin = -2.26;
    const zMax = 2.3;
    const cabinEndZ = -1.98;
    const cabinStartZ = 0.94;
    const zStations = buildArchAwareZStations(zMin, zMax, rearZ, frontZ, archR, cabinEndZ, cabinStartZ);

    const stations: HullStation[] = zStations.map((z) => {
      const isFrontNose = z > 1.98;
      const isRearTail = z < -2.02;
      const noseTaper = isFrontNose ? Math.pow((z - 1.98) / (zMax - 1.98), 1.3) * 0.1 : 0;
      const tailTaper = isRearTail ? Math.pow((-2.02 - z) / (-2.02 - zMin), 1.3) * 0.06 : 0;

      const baseSillY = 0.4 + (isFrontNose ? 0.08 : 0) + (isRearTail ? 0.06 : 0);
      const ySill = computeWheelArchY(z, baseSillY, frontZ, rearZ, wheelR, archR);

      const yCrease = Math.max(ySill + 0.03, 0.92 - noseTaper * 0.3);
      const yBelt = Math.max(ySill + 0.05, 1.25 - noseTaper * 0.5);
      const yDeck = Math.max(yBelt + 0.02, 1.29 - noseTaper * 0.6);
      const yCrown = yDeck + (z > 0.94 ? 0.045 : 0.03);

      const wBelt = 1.01 - noseTaper * 0.55 - tailTaper * 0.4;
      const wCrease = wBelt + 0.02;
      const wSill = wBelt - 0.03;
      const wDeck = wBelt - 0.08;

      return {
        z,
        ySill,
        wSill,
        yCrease,
        wCrease,
        yBelt,
        wBelt,
        yDeck,
        wDeck,
        yCrown,
        isCabin: z >= cabinEndZ && z <= cabinStartZ,
      };
    });

    const bodyGeo = computeSmoothBodyNormals(buildSculptedCarBodyGeometry(stations), 36);
    const bodyMesh = new THREE.Mesh(bodyGeo, mats.paintMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    chassisGroup.add(bodyMesh);

    // Wide protective bolt-on fender flares
    buildSculptedWheelWells(
      chassisGroup,
      archR,
      wheelW + 0.14,
      trackX,
      frontZ,
      rearZ,
      wheelR,
      mats.wheelWellLinerMat,
      mats.matteCladdingMat,
      0.09,
      0.07
    );

    // Ladder-frame underbody, front bash plate, rock sliders & recovery tow hooks
    addBox(chassisGroup, 1.66, 0.14, 4.35, mats.matteCladdingMat, 0, 0.38, 0);
    addBox(chassisGroup, 1.24, 0.08, 0.42, mats.chromeMat, 0, 0.39, 2.26, 0.38);
    [-1.04, 1.04].forEach((sx) => {
      addCyl(chassisGroup, 0.045, 0.045, 1.84, 10, mats.matteCladdingMat, sx, 0.39, 0.02, Math.PI / 2);
      // Diamond chequer hood armor plates
      addBox(chassisGroup, 0.28, 0.022, 1.02, mats.matteCladdingMat, sx * 0.72, 1.32, 1.62, 0.04);
    });

    // Heavy Steel Expedition Bull Bar + Winch Drum
    addBox(chassisGroup, 1.98, 0.19, 0.22, mats.matteCladdingMat, 0, 0.66, 2.4, 0.04);
    addBox(chassisGroup, 0.88, 0.06, 0.06, mats.matteCladdingMat, 0, 1.02, 2.42);
    [-0.44, 0.44].forEach((bx) => {
      addBox(chassisGroup, 0.055, 0.36, 0.06, mats.matteCladdingMat, bx, 0.84, 2.41);
    });
    addCyl(chassisGroup, 0.065, 0.065, 0.36, 12, mats.chromeMat, 0, 0.72, 2.38, 0, 0, Math.PI / 2);

    // Slatted Overland Grille
    addBox(chassisGroup, 1.04, 0.34, 0.09, mats.meshGrilleMat, 0, 1.03, 2.305);
    [-0.08, 0, 0.08].forEach((gy) => {
      addBox(chassisGroup, 0.96, 0.028, 0.05, mats.chromeMat, 0, 1.03 + gy, 2.345);
    });

    // Raised A-pillar Safari Snorkel (+X passenger side)
    addCyl(chassisGroup, 0.045, 0.045, 0.82, 10, mats.matteCladdingMat, 0.94, 1.48, 0.96, -0.32);
    addBox(chassisGroup, 0.1, 0.14, 0.14, mats.matteCladdingMat, 0.94, 1.88, 0.76);
    addBox(chassisGroup, 0.08, 0.06, 0.52, mats.matteCladdingMat, 0.95, 1.18, 1.24);

    // Upright Overland Greenhouse + Roof Expedition Rack + 4 Auxiliary Rally Light Pods
    const windshield = buildCurvedPanelMesh(0.86, 1.29, 0.94, 0.78, 1.87, 0.56, 0.06, 0.018, mats.glassMat, 14, 5);
    const roofPanel = buildCurvedPanelMesh(0.78, 1.87, 0.56, 0.77, 1.87, -2.14, 0.02, 0.025, mats.paintMat, 12, 8, true);
    const rearGlass = buildCurvedPanelMesh(0.77, 1.87, -2.14, 0.85, 1.38, -2.26, -0.03, 0.015, mats.glassMat, 12, 4);
    const tailgateLower = buildCurvedPanelMesh(0.85, 1.38, -2.26, 0.92, 0.88, -2.26, -0.02, 0.015, mats.paintMat, 12, 4, true);
    chassisGroup.add(windshield, roofPanel, rearGlass, tailgateLower);

    // Expedition Roof Rack + Rally Light Bar + Side Recovery Traction Boards
    [-0.7, 0.7].forEach((rx) => {
      addBox(chassisGroup, 0.05, 0.07, 2.46, mats.matteCladdingMat, rx, 1.94, -0.82);
      // Orange traction recovery board mounted on rear side window armor
      addBox(chassisGroup, 0.04, 0.24, 0.72, mats.amberSignalMat, rx > 0 ? 0.91 : -0.91, 1.56, -1.62);
    });
    for (let rz = -1.9; rz <= 0.35; rz += 0.45) {
      addBox(chassisGroup, 1.42, 0.032, 0.045, mats.matteCladdingMat, 0, 1.94, rz);
    }
    addBox(chassisGroup, 1.32, 0.04, 0.05, mats.matteCladdingMat, 0, 1.95, 0.46);
    const headlightsGroup = new THREE.Group();
    [-0.45, -0.15, 0.15, 0.45].forEach((lx) => {
      addCyl(headlightsGroup, 0.072, 0.072, 0.06, 14, mats.matteCladdingMat, lx, 2.02, 0.46, Math.PI / 2);
      addCyl(headlightsGroup, 0.06, 0.06, 0.02, 14, mats.drlMat, lx, 2.02, 0.495, Math.PI / 2, 0, 0, false);
    });

    // Iconic Round Halo Headlights in Recessed Housings
    [-0.68, 0.68].forEach((lx) => {
      addCyl(headlightsGroup, 0.115, 0.115, 0.08, 18, mats.headlightMat, lx, 1.03, 2.3, Math.PI / 2, 0, 0, false);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.015, 8, 22), mats.drlMat);
      halo.position.set(lx, 1.03, 2.34);
      headlightsGroup.add(halo);
    });
    chassisGroup.add(headlightsGroup);

    // Pillars & Flush Side Glass
    [-1, 1].forEach((s) => {
      chassisGroup.add(
        buildCurvedPillar(new THREE.Vector3(s * 0.86, 1.29, 0.94), new THREE.Vector3(s * 0.02, 0.02, 0.02), new THREE.Vector3(s * 0.78, 1.87, 0.56), 0.036, mats.paintMat),
        buildCurvedPillar(new THREE.Vector3(s * 0.86, 1.29, -0.25), new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.78, 1.87, -0.25), 0.044, mats.paintMat),
        buildCurvedPillar(new THREE.Vector3(s * 0.86, 1.29, -1.2), new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.77, 1.87, -1.2), 0.046, mats.paintMat),
        buildCurvedPillar(new THREE.Vector3(s * 0.77, 1.87, -2.14), new THREE.Vector3(s * 0.01, 0.01, -0.01), new THREE.Vector3(s * 0.85, 1.38, -2.26), 0.048, mats.paintMat),
        buildCurvedPillar(new THREE.Vector3(s * 0.78, 1.87, 0.56), new THREE.Vector3(0, 0.01, 0), new THREE.Vector3(s * 0.77, 1.87, -2.14), 0.032, mats.paintMat)
      );
    });
    buildFlushSideGlass(chassisGroup, 0.86, 1.3, 0.88, 0.85, 1.34, -2.05, 0.78, 1.85, 0.54, 0.77, 1.85, -2.05, mats.glassMat);

    // Tailgate-Mounted Full-Size Spare Wheel!
    const spareWheel = buildDetailedWheelAssembly(
      custom,
      { spokePattern: 'OFFROAD_6', radius: wheelR * 0.92, width: wheelW * 0.92, rimRadius: 0.26, isRightSide: true, isOffroad: true },
      textures
    );
    spareWheel.steerGroup.rotation.y = -Math.PI / 2;
    spareWheel.steerGroup.position.set(0, 1.15, -2.44);
    chassisGroup.add(spareWheel.steerGroup);
    addBox(chassisGroup, 0.9, 0.14, 0.14, mats.matteCladdingMat, 0, 0.58, -2.28);
    addCyl(chassisGroup, 0.055, 0.055, 0.14, 12, mats.chromeMat, -0.64, 0.45, -2.26, Math.PI / 2);

    // Mirrors, Wipers, Handles & Plates
    buildSideMirrors(chassisGroup, mats.matteCladdingMat, mats.matteCladdingMat, mats.chromeMat, 0.96, 1.37, 0.76);
    buildWindshieldWipers(chassisGroup, 1.31, 0.92, mats.trimBlackMat);
    buildDoorHandlesAndSeams(chassisGroup, 1.0, 1.17, 0.02, -0.88, mats.matteCladdingMat, mats.trimBlackMat, [0.72, -0.25, -1.2]);
    addLicensePlates(chassisGroup, [0, 0.66, 2.51], [-0.56, 0.82, -2.29], textures, mats.trimBlackMat);

    const turnFrontL = addBox(chassisGroup, 0.1, 0.05, 0.07, mats.amberSignalMat.clone(), -0.86, 1.03, 2.25, 0, 0.12, 0, false);
    const turnFrontR = addBox(chassisGroup, 0.1, 0.05, 0.07, mats.amberSignalMat.clone(), 0.86, 1.03, 2.25, 0, -0.12, 0, false);
    const turnRearL = addBox(chassisGroup, 0.12, 0.09, 0.06, mats.amberSignalMat.clone(), -0.82, 0.94, -2.27, 0, 0, 0, false);
    const turnRearR = addBox(chassisGroup, 0.12, 0.09, 0.06, mats.amberSignalMat.clone(), 0.82, 0.94, -2.27, 0, 0, 0, false);

    const taillightsGroup = new THREE.Group();
    [-0.82, 0.82].forEach((lx) => {
      addBox(taillightsGroup, 0.12, 0.24, 0.07, mats.taillightMat, lx, 1.12, -2.27, 0, 0, 0, false);
    });
    chassisGroup.add(taillightsGroup);

    const revL = addBox(chassisGroup, 0.12, 0.07, 0.05, mats.reverseMat, -0.82, 0.82, -2.27, 0, 0, 0, false);
    const revR = addBox(chassisGroup, 0.12, 0.07, 0.05, mats.reverseMat, 0.82, 0.82, -2.27, 0, 0, 0, false);

    const { underglowLight, underglowGroup } = buildUnderglow(custom, 1.38);
    chassisGroup.add(underglowGroup);
    const { spotL, spotR, spotGroup } = buildHeadlightSpotlights();
    spotL.position.set(-0.68, 1.03, 2.38);
    spotR.position.set(0.68, 1.03, 2.38);
    chassisGroup.add(spotGroup);

    // Interior + Driver
    const interiorResult = buildDetailedInteriorAndDriver({
      vehicleType: 'RUGGED_4X4',
      seatOffsetZ: 0.02,
      seatY: 0.92,
      cabinFloorY: 0.56,
      cabinWidth: 1.66,
      steerOffset: new THREE.Vector3(-0.44, 1.4, 0.34),
      interiorTheme: custom.interiorTheme || 'BLACK',
      textures,
    });
    chassisGroup.add(interiorResult.interiorGroup);

    // Mud-Terrain Offroad Beadlock Wheels
    const wheels = attachFourWheels(
      carGroup,
      custom,
      textures,
      trackX,
      frontZ,
      rearZ,
      wheelR,
      wheelW,
      wheelW,
      0.285,
      'OFFROAD_6',
      true
    );

    return {
      carGroup,
      chassisGroup,
      ...wheels,
      wheelRadius: wheelR,
      steeringWheelGroup: interiorResult.steeringWheelGroup,
      driverGroup: interiorResult.driverGroup,
      driverHeadGroup: interiorResult.driverHeadGroup,
      driverArmGroups: interiorResult.driverArmGroups,
      bodyMesh,
      paintMaterial: mats.paintMat,
      headlightsGroup,
      taillightsGroup,
      turnSignalMeshes: {
        frontLeft: turnFrontL,
        frontRight: turnFrontR,
        rearLeft: turnRearL,
        rearRight: turnRearR,
      },
      underglowLight,
      headlightSpotL: spotL,
      headlightSpotR: spotR,
      spoilerGroup: null,
      interiorGroup: interiorResult.interiorGroup,
      vehicleType: 'RUGGED_4X4',
      reverseLights: [revL, revR],
      brakeLightMats: [mats.taillightMat],
    };
  }
}
