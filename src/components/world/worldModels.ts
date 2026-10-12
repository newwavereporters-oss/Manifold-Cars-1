import * as THREE from 'three';

export type VehicleModelType = 'SPORTS_COUPE' | 'LUXURY_SUV' | 'EXECUTIVE_SEDAN' | 'RUGGED_4X4';

export interface VehicleSpecProfile {
  id: VehicleModelType;
  name: string;
  category: string;
  maxSpeed: number; // units/sec (~ 1 unit ≈ 1.5 meter)
  acceleration: number;
  deceleration: number;
  brakeDecel: number;
  maxSteer: number;
  steerSpeed: number;
  gearRatios: number[];
  redlineRpm: number;
  idleRpm: number;
  cockpitOffset: THREE.Vector3;
  lookTargetHeight: number;
  chaseDistance: number;
  chaseHeight: number;
  chaseLookAhead: number;
  bodyLength: number;
  bodyWidth: number;
  bodyHeight: number;
}

export const VEHICLE_SPEC_PROFILES: Record<VehicleModelType, VehicleSpecProfile> = {
  SPORTS_COUPE: {
    id: 'SPORTS_COUPE',
    name: 'MANIFOLD GT Coupe',
    category: 'V8 Twin-Turbo Track Coupe',
    maxSpeed: 48, // ~220 km/h
    acceleration: 24,
    deceleration: 14,
    brakeDecel: 42,
    maxSteer: 0.54,
    steerSpeed: 3.4,
    gearRatios: [3.4, 2.2, 1.6, 1.2, 0.95, 0.78],
    redlineRpm: 7500,
    idleRpm: 850,
    cockpitOffset: new THREE.Vector3(-0.35, 0.95, 0.25),
    lookTargetHeight: 0.85,
    chaseDistance: 7.6,
    chaseHeight: 2.2,
    chaseLookAhead: 5.0,
    bodyLength: 4.3,
    bodyWidth: 1.88,
    bodyHeight: 1.15,
  },
  LUXURY_SUV: {
    id: 'LUXURY_SUV',
    name: 'Apex Luxury SUV',
    category: 'Twin-Turbo AWD 7-Seater',
    maxSpeed: 42, // ~195 km/h
    acceleration: 19,
    deceleration: 12,
    brakeDecel: 36,
    maxSteer: 0.46,
    steerSpeed: 2.7,
    gearRatios: [3.8, 2.4, 1.7, 1.25, 0.98, 0.82],
    redlineRpm: 6500,
    idleRpm: 750,
    cockpitOffset: new THREE.Vector3(-0.42, 1.48, 0.35),
    lookTargetHeight: 1.25,
    chaseDistance: 8.8,
    chaseHeight: 2.9,
    chaseLookAhead: 5.5,
    bodyLength: 4.8,
    bodyWidth: 2.05,
    bodyHeight: 1.72,
  },
  EXECUTIVE_SEDAN: {
    id: 'EXECUTIVE_SEDAN',
    name: 'Prestige Executive Sedan',
    category: 'V6 Luxury Comfort Cruiser',
    maxSpeed: 44, // ~205 km/h
    acceleration: 21,
    deceleration: 13,
    brakeDecel: 39,
    maxSteer: 0.5,
    steerSpeed: 3.0,
    gearRatios: [3.5, 2.3, 1.65, 1.22, 0.96, 0.8],
    redlineRpm: 6800,
    idleRpm: 800,
    cockpitOffset: new THREE.Vector3(-0.38, 1.08, 0.3),
    lookTargetHeight: 0.95,
    chaseDistance: 8.0,
    chaseHeight: 2.4,
    chaseLookAhead: 5.2,
    bodyLength: 4.7,
    bodyWidth: 1.9,
    bodyHeight: 1.35,
  },
  RUGGED_4X4: {
    id: 'RUGGED_4X4',
    name: 'Highland Safari 4x4',
    category: 'Heavy-Duty Overland V8',
    maxSpeed: 38, // ~175 km/h
    acceleration: 17,
    deceleration: 11,
    brakeDecel: 34,
    maxSteer: 0.44,
    steerSpeed: 2.4,
    gearRatios: [4.1, 2.6, 1.8, 1.3, 1.0, 0.84],
    redlineRpm: 6000,
    idleRpm: 700,
    cockpitOffset: new THREE.Vector3(-0.44, 1.62, 0.25),
    lookTargetHeight: 1.4,
    chaseDistance: 9.2,
    chaseHeight: 3.2,
    chaseLookAhead: 6.0,
    bodyLength: 4.65,
    bodyWidth: 2.1,
    bodyHeight: 1.95,
  },
};

export interface CarCustomization {
  vehicleType?: VehicleModelType;
  paintColor: string;
  finish: 'gloss' | 'matte' | 'metallic';
  rimColor: string;
  caliperColor: string;
  headlightTint: string;
  windowTint: number;
}

export const CAR_COLOR_PALETTES = [
  { name: 'Obsidian Black', hex: '#0B0D11', finish: 'metallic' },
  { name: 'Rosso Corsa', hex: '#DC2626', finish: 'gloss' },
  { name: 'Monaco Blue', hex: '#1D4ED8', finish: 'metallic' },
  { name: 'Pearl White', hex: '#F8FAFC', finish: 'metallic' },
  { name: 'Nardo Grey', hex: '#64748B', finish: 'matte' },
  { name: 'British Racing Green', hex: '#14532D', finish: 'metallic' },
  { name: 'Solar Gold', hex: '#D97706', finish: 'metallic' },
  { name: 'Liquid Silver', hex: '#94A3B8', finish: 'metallic' },
];

export interface Vehicle3DResult {
  carGroup: THREE.Group;
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  rearLeftWheel: THREE.Group;
  rearRightWheel: THREE.Group;
  bodyMesh: THREE.Mesh;
  paintMaterial: THREE.MeshStandardMaterial;
  headlightsGroup: THREE.Group;
  vehicleType: VehicleModelType;
}

/**
 * Creates wheel group with alloy rim, spokes, and performance caliper
 */
function buildWheel(
  custom: CarCustomization,
  radius: number,
  width: number,
  rimDiameter: number
): THREE.Group {
  const wheelGroup = new THREE.Group();

  // Rubber Tire (PBR physical realistic response)
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1f242d,
    roughness: 0.8,
    metalness: 0.05,
  });
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 32);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMesh = new THREE.Mesh(tireGeo, tireMat);
  tireMesh.castShadow = true;
  wheelGroup.add(tireMesh);

  // Rim Alloy
  const rimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.rimColor || '#e2e8f0'),
    metalness: 0.9,
    roughness: 0.18,
  });
  const rimCenterGeo = new THREE.CylinderGeometry(rimDiameter, rimDiameter, width + 0.01, 24);
  rimCenterGeo.rotateZ(Math.PI / 2);
  const rimCenter = new THREE.Mesh(rimCenterGeo, rimMat);
  wheelGroup.add(rimCenter);

  // Rim Spokes (5-spoke twin pattern)
  for (let i = 0; i < 5; i++) {
    const spokeGeo = new THREE.BoxGeometry(0.035, rimDiameter * 1.5, 0.05);
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.rotation.x = (i * Math.PI * 2) / 5;
    wheelGroup.add(spoke);
  }

  // Performance Brake Caliper
  const caliperMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.caliperColor || '#ef233c'),
    metalness: 0.7,
    roughness: 0.3,
  });
  const caliperGeo = new THREE.BoxGeometry(0.08, radius * 0.48, radius * 0.36);
  const caliper = new THREE.Mesh(caliperGeo, caliperMat);
  caliper.position.set(0.06, radius * 0.38, 0);
  wheelGroup.add(caliper);

  return wheelGroup;
}

/**
 * Creates a high-fidelity sports coupe 3D model
 */
export function createSportsCar(custom: CarCustomization): Vehicle3DResult {
  const carGroup = new THREE.Group();

  const paintMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.paintColor),
    metalness: custom.finish === 'metallic' ? 0.85 : custom.finish === 'matte' ? 0.15 : 0.45,
    roughness: custom.finish === 'matte' ? 0.55 : custom.finish === 'metallic' ? 0.22 : 0.18,
    envMapIntensity: 1.4,
  });

  const carbonMaterial = new THREE.MeshStandardMaterial({
    color: 0x181a20,
    roughness: 0.35,
    metalness: 0.75,
  });

  // Cockpit-transparent glass with balanced visibility
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    metalness: 0.1,
    roughness: 0.08,
    transmission: 0.82,
    thickness: 0.2,
    transparent: true,
    opacity: 0.45,
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.95,
    roughness: 0.1,
  });

  // Main Chassis lower body
  const bodyGeo = new THREE.BoxGeometry(1.85, 0.48, 4.3);
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMaterial);
  bodyMesh.position.y = 0.42;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  carGroup.add(bodyMesh);

  // Aerodynamic Hood Slope & Nose
  const noseGeo = new THREE.BoxGeometry(1.82, 0.28, 1.1);
  const noseMesh = new THREE.Mesh(noseGeo, paintMaterial);
  noseMesh.position.set(0, 0.36, 1.85);
  noseMesh.rotation.x = 0.08;
  noseMesh.castShadow = true;
  carGroup.add(noseMesh);

  // Front Splitter / Carbon Air Dam
  const splitterGeo = new THREE.BoxGeometry(1.92, 0.06, 0.65);
  const splitterMesh = new THREE.Mesh(splitterGeo, carbonMaterial);
  splitterMesh.position.set(0, 0.18, 2.15);
  carGroup.add(splitterMesh);

  // Front Grille
  const grilleGeo = new THREE.BoxGeometry(1.2, 0.22, 0.08);
  const grilleMesh = new THREE.Mesh(grilleGeo, carbonMaterial);
  grilleMesh.position.set(0, 0.33, 2.38);
  carGroup.add(grilleMesh);

  // Cabin / Glass Cockpit Greenhouse (High transparency)
  const cabinGeo = new THREE.BoxGeometry(1.5, 0.52, 2.2);
  const cabinMesh = new THREE.Mesh(cabinGeo, glassMaterial);
  cabinMesh.position.set(0, 0.86, -0.15);
  cabinMesh.castShadow = true;
  carGroup.add(cabinMesh);

  // Roof Panel
  const roofGeo = new THREE.BoxGeometry(1.42, 0.05, 1.7);
  const roofMesh = new THREE.Mesh(roofGeo, paintMaterial);
  roofMesh.position.set(0, 1.13, -0.15);
  roofMesh.castShadow = true;
  carGroup.add(roofMesh);

  // Rear Fastback Trunk & Decklid
  const trunkGeo = new THREE.BoxGeometry(1.78, 0.34, 1.1);
  const trunkMesh = new THREE.Mesh(trunkGeo, paintMaterial);
  trunkMesh.position.set(0, 0.55, -1.65);
  trunkMesh.rotation.x = -0.06;
  trunkMesh.castShadow = true;
  carGroup.add(trunkMesh);

  // Rear Carbon Diffuser
  const diffuserGeo = new THREE.BoxGeometry(1.86, 0.14, 0.5);
  const diffuserMesh = new THREE.Mesh(diffuserGeo, carbonMaterial);
  diffuserMesh.position.set(0, 0.2, -2.15);
  carGroup.add(diffuserMesh);

  // Rear GT Wing / Aerofoil Spoiler
  const wingBladeGeo = new THREE.BoxGeometry(1.84, 0.04, 0.32);
  const wingBlade = new THREE.Mesh(wingBladeGeo, carbonMaterial);
  wingBlade.position.set(0, 0.96, -2.05);
  wingBlade.castShadow = true;
  carGroup.add(wingBlade);

  const wingPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.08), carbonMaterial);
  wingPillarL.position.set(-0.6, 0.82, -2.02);
  const wingPillarR = wingPillarL.clone();
  wingPillarR.position.x = 0.6;
  carGroup.add(wingPillarL, wingPillarR);

  // Dual Exhaust Outlets
  const exhaustGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.22, 16);
  exhaustGeo.rotateX(Math.PI / 2);
  const exhaustL = new THREE.Mesh(exhaustGeo, chromeMaterial);
  exhaustL.position.set(-0.55, 0.22, -2.22);
  const exhaustR = exhaustL.clone();
  exhaustR.position.x = 0.55;
  carGroup.add(exhaustL, exhaustR);

  // Side Mirrors
  const mirrorGeo = new THREE.BoxGeometry(0.24, 0.12, 0.16);
  const mirrorL = new THREE.Mesh(mirrorGeo, paintMaterial);
  mirrorL.position.set(-0.95, 0.82, 0.72);
  const mirrorR = mirrorL.clone();
  mirrorR.position.x = 0.95;
  carGroup.add(mirrorL, mirrorR);

  // Interior steering wheel silhouette
  const wheelHubGeo = new THREE.TorusGeometry(0.16, 0.025, 8, 24);
  const wheelHub = new THREE.Mesh(wheelHubGeo, carbonMaterial);
  wheelHub.position.set(-0.35, 0.78, 0.42);
  wheelHub.rotation.x = Math.PI / 4;
  carGroup.add(wheelHub);

  // Headlights
  const headlightsGroup = new THREE.Group();
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2.5,
    roughness: 0.1,
  });
  const headlightGeo = new THREE.BoxGeometry(0.36, 0.08, 0.12);
  const headlightL = new THREE.Mesh(headlightGeo, headlightMat);
  headlightL.position.set(-0.65, 0.44, 2.36);
  headlightL.rotation.y = -0.15;
  const headlightR = headlightL.clone();
  headlightR.position.x = 0.65;
  headlightR.rotation.y = 0.15;
  headlightsGroup.add(headlightL, headlightR);
  carGroup.add(headlightsGroup);

  // Taillights
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef233c,
    emissive: 0xef233c,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });
  const taillightBarGeo = new THREE.BoxGeometry(1.68, 0.06, 0.08);
  const taillightBar = new THREE.Mesh(taillightBarGeo, taillightMat);
  taillightBar.position.set(0, 0.62, -2.16);
  carGroup.add(taillightBar);

  // 4 Wheels
  const frontLeftWheel = buildWheel(custom, 0.36, 0.28, 0.24);
  frontLeftWheel.position.set(-0.95, 0.36, 1.35);

  const frontRightWheel = buildWheel(custom, 0.36, 0.28, 0.24);
  frontRightWheel.position.set(0.95, 0.36, 1.35);
  frontRightWheel.rotation.y = Math.PI;

  const rearLeftWheel = buildWheel(custom, 0.36, 0.28, 0.24);
  rearLeftWheel.position.set(-0.95, 0.36, -1.35);

  const rearRightWheel = buildWheel(custom, 0.36, 0.28, 0.24);
  rearRightWheel.position.set(0.95, 0.36, -1.35);
  rearRightWheel.rotation.y = Math.PI;

  carGroup.add(frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel);

  return {
    carGroup,
    frontLeftWheel,
    frontRightWheel,
    rearLeftWheel,
    rearRightWheel,
    bodyMesh,
    paintMaterial,
    headlightsGroup,
    vehicleType: 'SPORTS_COUPE',
  };
}

/**
 * Creates Luxury SUV model (High clearance, upright cabin, roof rails, dual exhaust)
 */
export function createLuxurySUV(custom: CarCustomization): Vehicle3DResult {
  const carGroup = new THREE.Group();

  const paintMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.paintColor),
    metalness: custom.finish === 'metallic' ? 0.82 : custom.finish === 'matte' ? 0.15 : 0.45,
    roughness: custom.finish === 'matte' ? 0.52 : custom.finish === 'metallic' ? 0.24 : 0.2,
    envMapIntensity: 1.4,
  });

  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f242d,
    roughness: 0.4,
    metalness: 0.6,
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.95,
    roughness: 0.1,
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x93c5fd,
    transmission: 0.8,
    thickness: 0.2,
    transparent: true,
    opacity: 0.4,
    roughness: 0.08,
  });

  // Lower rugged body & skid guards
  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.36, 4.75), trimMaterial);
  lowerBody.position.y = 0.46;
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  carGroup.add(lowerBody);

  // Main SUV Body
  const bodyGeo = new THREE.BoxGeometry(2.0, 0.68, 4.65);
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMaterial);
  bodyMesh.position.y = 0.88;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  carGroup.add(bodyMesh);

  // High Hood
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.26, 1.55), paintMaterial);
  hood.position.set(0, 1.15, 1.45);
  hood.castShadow = true;
  carGroup.add(hood);

  // Chrome Bold Grille
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.1), chromeMaterial);
  grille.position.set(0, 0.92, 2.36);
  carGroup.add(grille);

  // Tall Glass Cabin Greenhouse
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.72, 2.7), glassMaterial);
  cabin.position.set(0, 1.52, -0.3);
  cabin.castShadow = true;
  carGroup.add(cabin);

  // Full Length Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 2.65), paintMaterial);
  roof.position.set(0, 1.9, -0.3);
  roof.castShadow = true;
  carGroup.add(roof);

  // Roof Rails
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 2.3), chromeMaterial);
  railL.position.set(-0.76, 1.96, -0.3);
  const railR = railL.clone();
  railR.position.x = 0.76;
  carGroup.add(railL, railR);

  // Side Steps
  const stepL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 2.4), chromeMaterial);
  stepL.position.set(-1.08, 0.38, -0.1);
  const stepR = stepL.clone();
  stepR.position.x = 1.08;
  carGroup.add(stepL, stepR);

  // Headlights
  const headlightsGroup = new THREE.Group();
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2.6,
  });
  const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.1), headlightMat);
  headlightL.position.set(-0.75, 1.05, 2.35);
  const headlightR = headlightL.clone();
  headlightR.position.x = 0.75;
  headlightsGroup.add(headlightL, headlightR);
  carGroup.add(headlightsGroup);

  // Taillights
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef233c,
    emissive: 0xef233c,
    emissiveIntensity: 2.2,
  });
  const taillightL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.42, 0.08), taillightMat);
  taillightL.position.set(-0.78, 1.15, -2.35);
  const taillightR = taillightL.clone();
  taillightR.position.x = 0.78;
  carGroup.add(taillightL, taillightR);

  // SUV Wheels (Larger 20-inch 0.44m radius)
  const frontLeftWheel = buildWheel(custom, 0.44, 0.32, 0.28);
  frontLeftWheel.position.set(-1.06, 0.44, 1.45);

  const frontRightWheel = buildWheel(custom, 0.44, 0.32, 0.28);
  frontRightWheel.position.set(1.06, 0.44, 1.45);
  frontRightWheel.rotation.y = Math.PI;

  const rearLeftWheel = buildWheel(custom, 0.44, 0.32, 0.28);
  rearLeftWheel.position.set(-1.06, 0.44, -1.45);

  const rearRightWheel = buildWheel(custom, 0.44, 0.32, 0.28);
  rearRightWheel.position.set(1.06, 0.44, -1.45);
  rearRightWheel.rotation.y = Math.PI;

  carGroup.add(frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel);

  return {
    carGroup,
    frontLeftWheel,
    frontRightWheel,
    rearLeftWheel,
    rearRightWheel,
    bodyMesh,
    paintMaterial,
    headlightsGroup,
    vehicleType: 'LUXURY_SUV',
  };
}

/**
 * Creates Executive Sedan model (Sleek elongated proportions, 4-door profile, chrome accents)
 */
export function createExecutiveSedan(custom: CarCustomization): Vehicle3DResult {
  const carGroup = new THREE.Group();

  const paintMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.paintColor),
    metalness: custom.finish === 'metallic' ? 0.85 : custom.finish === 'matte' ? 0.15 : 0.45,
    roughness: custom.finish === 'matte' ? 0.55 : custom.finish === 'metallic' ? 0.22 : 0.18,
    envMapIntensity: 1.4,
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.95,
    roughness: 0.1,
  });

  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x181a20,
    roughness: 0.35,
    metalness: 0.75,
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    transmission: 0.82,
    thickness: 0.2,
    transparent: true,
    opacity: 0.45,
    roughness: 0.08,
  });

  // Main Lower Body
  const bodyGeo = new THREE.BoxGeometry(1.88, 0.5, 4.65);
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMaterial);
  bodyMesh.position.y = 0.46;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  carGroup.add(bodyMesh);

  // Long Front Hood
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.22, 1.4), paintMaterial);
  hood.position.set(0, 0.56, 1.6);
  hood.castShadow = true;
  carGroup.add(hood);

  // Chrome Signature Grille
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.26, 0.08), chromeMaterial);
  grille.position.set(0, 0.46, 2.34);
  carGroup.add(grille);

  // 4-Door Glass Cabin Greenhouse
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.54, 2.45), glassMaterial);
  cabin.position.set(0, 0.94, -0.15);
  cabin.castShadow = true;
  carGroup.add(cabin);

  // Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 1.8), paintMaterial);
  roof.position.set(0, 1.22, -0.15);
  roof.castShadow = true;
  carGroup.add(roof);

  // Trunk
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.28, 1.05), paintMaterial);
  trunk.position.set(0, 0.58, -1.78);
  trunk.castShadow = true;
  carGroup.add(trunk);

  // Chrome Window Surrounds
  const windowTrimL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 2.4), chromeMaterial);
  windowTrimL.position.set(-0.8, 1.18, -0.15);
  const windowTrimR = windowTrimL.clone();
  windowTrimR.position.x = 0.8;
  carGroup.add(windowTrimL, windowTrimR);

  // Headlights
  const headlightsGroup = new THREE.Group();
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2.5,
  });
  const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.1), headlightMat);
  headlightL.position.set(-0.68, 0.52, 2.32);
  const headlightR = headlightL.clone();
  headlightR.position.x = 0.68;
  headlightsGroup.add(headlightL, headlightR);
  carGroup.add(headlightsGroup);

  // Taillights
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef233c,
    emissive: 0xef233c,
    emissiveIntensity: 2.2,
  });
  const taillight = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 0.08), taillightMat);
  taillight.position.set(0, 0.64, -2.32);
  carGroup.add(taillight);

  // 4 Wheels
  const frontLeftWheel = buildWheel(custom, 0.38, 0.28, 0.26);
  frontLeftWheel.position.set(-0.98, 0.38, 1.45);

  const frontRightWheel = buildWheel(custom, 0.38, 0.28, 0.26);
  frontRightWheel.position.set(0.98, 0.38, 1.45);
  frontRightWheel.rotation.y = Math.PI;

  const rearLeftWheel = buildWheel(custom, 0.38, 0.28, 0.26);
  rearLeftWheel.position.set(-0.98, 0.38, -1.45);

  const rearRightWheel = buildWheel(custom, 0.38, 0.28, 0.26);
  rearRightWheel.position.set(0.98, 0.38, -1.45);
  rearRightWheel.rotation.y = Math.PI;

  carGroup.add(frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel);

  return {
    carGroup,
    frontLeftWheel,
    frontRightWheel,
    rearLeftWheel,
    rearRightWheel,
    bodyMesh,
    paintMaterial,
    headlightsGroup,
    vehicleType: 'EXECUTIVE_SEDAN',
  };
}

/**
 * Creates Rugged 4x4 Off-roader model (Boxy overland design, spare wheel, bull bar, snorkel)
 */
export function createRugged4x4(custom: CarCustomization): Vehicle3DResult {
  const carGroup = new THREE.Group();

  const paintMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.paintColor),
    metalness: custom.finish === 'metallic' ? 0.75 : custom.finish === 'matte' ? 0.1 : 0.4,
    roughness: custom.finish === 'matte' ? 0.6 : custom.finish === 'metallic' ? 0.28 : 0.25,
    envMapIntensity: 1.3,
  });

  const heavyTrim = new THREE.MeshStandardMaterial({
    color: 0x14171d,
    roughness: 0.6,
    metalness: 0.4,
  });

  const steelMaterial = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.3,
    metalness: 0.85,
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    transmission: 0.78,
    thickness: 0.25,
    transparent: true,
    opacity: 0.45,
    roughness: 0.08,
  });

  // Heavy Boxy Body
  const bodyGeo = new THREE.BoxGeometry(2.05, 0.82, 4.4);
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMaterial);
  bodyMesh.position.y = 0.95;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  carGroup.add(bodyMesh);

  // Upright Safari Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.85, 2.6), glassMaterial);
  cabin.position.set(0, 1.68, -0.35);
  cabin.castShadow = true;
  carGroup.add(cabin);

  // Safari Roof with Rack
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.1, 2.65), paintMaterial);
  roof.position.set(0, 2.12, -0.35);
  roof.castShadow = true;
  carGroup.add(roof);

  // Steel Roof Rack
  const rack = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 2.4), steelMaterial);
  rack.position.set(0, 2.22, -0.35);
  carGroup.add(rack);

  // Front Heavy Steel Bull Bar
  const bullBar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.14), steelMaterial);
  bullBar.position.set(0, 0.85, 2.3);
  carGroup.add(bullBar);

  // Rear Mounted Spare Tire
  const spareWheel = buildWheel(custom, 0.46, 0.28, 0.26);
  spareWheel.position.set(0, 1.1, -2.35);
  carGroup.add(spareWheel);

  // Round Retro Headlights
  const headlightsGroup = new THREE.Group();
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfef08a,
    emissiveIntensity: 2.8,
  });
  const headlightGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16);
  headlightGeo.rotateX(Math.PI / 2);
  const headlightL = new THREE.Mesh(headlightGeo, headlightMat);
  headlightL.position.set(-0.72, 1.05, 2.24);
  const headlightR = headlightL.clone();
  headlightR.position.x = 0.72;
  headlightsGroup.add(headlightL, headlightR);
  carGroup.add(headlightsGroup);

  // Taillights
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef233c,
    emissive: 0xef233c,
    emissiveIntensity: 2.2,
  });
  const taillightL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.08), taillightMat);
  taillightL.position.set(-0.85, 1.1, -2.22);
  const taillightR = taillightL.clone();
  taillightR.position.x = 0.85;
  carGroup.add(taillightL, taillightR);

  // Overland Deep-Tread Wheels (0.48m radius)
  const frontLeftWheel = buildWheel(custom, 0.48, 0.36, 0.26);
  frontLeftWheel.position.set(-1.12, 0.48, 1.35);

  const frontRightWheel = buildWheel(custom, 0.48, 0.36, 0.26);
  frontRightWheel.position.set(1.12, 0.48, 1.35);
  frontRightWheel.rotation.y = Math.PI;

  const rearLeftWheel = buildWheel(custom, 0.48, 0.36, 0.26);
  rearLeftWheel.position.set(-1.12, 0.48, -1.35);

  const rearRightWheel = buildWheel(custom, 0.48, 0.36, 0.26);
  rearRightWheel.position.set(1.12, 0.48, -1.35);
  rearRightWheel.rotation.y = Math.PI;

  carGroup.add(frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel);

  return {
    carGroup,
    frontLeftWheel,
    frontRightWheel,
    rearLeftWheel,
    rearRightWheel,
    bodyMesh,
    paintMaterial,
    headlightsGroup,
    vehicleType: 'RUGGED_4X4',
  };
}

/**
 * Factory to create vehicle model by type
 */
export function createVehicleByType(custom: CarCustomization): Vehicle3DResult {
  const type = custom.vehicleType || 'SPORTS_COUPE';
  switch (type) {
    case 'LUXURY_SUV':
      return createLuxurySUV(custom);
    case 'EXECUTIVE_SEDAN':
      return createExecutiveSedan(custom);
    case 'RUGGED_4X4':
      return createRugged4x4(custom);
    case 'SPORTS_COUPE':
    default:
      return createSportsCar(custom);
  }
}

/**
 * Builds the MANIFOLD WORLD Showroom Pavilion, Plaza, Track & Landmarks
 */
export function createWorldEnvironment(): {
  environmentGroup: THREE.Group;
  podiums: { group: THREE.Group; carMesh: THREE.Group; carId: string }[];
  marketplacePortal: THREE.Group;
  speedTrapGate: THREE.Group;
} {
  const environmentGroup = new THREE.Group();
  const podiums: { group: THREE.Group; carMesh: THREE.Group; carId: string }[] = [];

  // 1. HIGH-VISIBILITY DAYLIGHT GROUND PLAZA & SURROUNDING LANDSCAPE
  // Bright modern pavers texture and contrast
  const terrainGeo = new THREE.PlaneGeometry(600, 600, 32, 32);
  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8, // Balanced slate neutral ground
    roughness: 0.75,
    metalness: 0.1,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -0.05;
  terrain.receiveShadow = true;
  environmentGroup.add(terrain);

  // Central Plaza Island
  const plazaGeo = new THREE.PlaneGeometry(280, 280, 24, 24);
  const plazaMat = new THREE.MeshStandardMaterial({
    color: 0x334155, // Clean dark slate asphalt for sharp road contrast
    roughness: 0.6,
    metalness: 0.2,
  });
  const plaza = new THREE.Mesh(plazaGeo, plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.receiveShadow = true;
  environmentGroup.add(plaza);

  // Subtle architectural grid for distance perception
  const gridHelper = new THREE.GridHelper(280, 70, 0xef233c, 0x475569);
  gridHelper.position.y = 0.01;
  environmentGroup.add(gridHelper);

  // 2. CLEAR ROAD NETWORK & TRACK WITH WHITE/YELLOW PAINTED MARKINGS
  // Main Entrance Avenue connecting Plaza to Marketplace Gate & Showroom
  const mainAvenueGeo = new THREE.PlaneGeometry(24, 140);
  const mainAvenueMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.25,
  });
  const mainAvenue = new THREE.Mesh(mainAvenueGeo, mainAvenueMat);
  mainAvenue.rotation.x = -Math.PI / 2;
  mainAvenue.position.set(0, 0.02, 0);
  mainAvenue.receiveShadow = true;
  environmentGroup.add(mainAvenue);

  // Bright Yellow Center Line Markings along Main Avenue
  for (let z = -60; z <= 60; z += 8) {
    const dash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 4.5),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15, // High-contrast amber/yellow
        roughness: 0.3,
        emissive: 0xca8a04,
        emissiveIntensity: 0.4,
      })
    );
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.03, z);
    environmentGroup.add(dash);
  }

  // White Outer Lane Edge Markings
  [-11, 11].forEach((x) => {
    const laneLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 130),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.2,
        emissive: 0xffffff,
        emissiveIntensity: 0.3,
      })
    );
    laneLine.rotation.x = -Math.PI / 2;
    laneLine.position.set(x, 0.03, 0);
    environmentGroup.add(laneLine);
  });

  // 3. COASTAL TEST TRACK CIRCUIT ROAD (Ring with curbs and apex stripes)
  const trackRadiusX = 90;
  const trackRadiusZ = 80;

  // Track Asphalt Ribbon
  const ringGeo = new THREE.RingGeometry(76, 102, 64);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.55,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  const trackRing = new THREE.Mesh(ringGeo, ringMat);
  trackRing.rotation.x = -Math.PI / 2;
  trackRing.position.y = 0.015;
  trackRing.receiveShadow = true;
  environmentGroup.add(trackRing);

  // Red and White Racing Apex Curbs
  const trackCurve = new THREE.EllipseCurve(0, 0, trackRadiusX, trackRadiusZ, 0, 2 * Math.PI, false, 0);
  const trackPoints = trackCurve.getPoints(120);

  trackPoints.forEach((pt, idx) => {
    if (idx % 2 === 0) {
      const isRed = (idx / 2) % 2 === 0;
      const curbGeo = new THREE.BoxGeometry(1.6, 0.18, 0.8);
      const curbMat = new THREE.MeshStandardMaterial({
        color: isRed ? 0xef233c : 0xffffff,
        roughness: 0.3,
      });
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(pt.x, 0.09, pt.y);
      curb.rotation.y = -Math.atan2(pt.y, pt.x) + Math.PI / 2;
      environmentGroup.add(curb);
    }
  });

  // Track Lampposts with clear daylight fixtures
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
    const lx = Math.cos(angle) * 105;
    const lz = Math.sin(angle) * 92;

    const postGroup = new THREE.Group();
    postGroup.position.set(lx, 0, lz);

    const postPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.2, 9.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.2 })
    );
    postPole.position.y = 4.75;
    postPole.castShadow = true;
    postGroup.add(postPole);

    const lampHead = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.2, 0.45),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xfef08a,
        emissiveIntensity: 1.5,
      })
    );
    lampHead.position.set(0, 9.5, 0);
    postGroup.add(lampHead);

    environmentGroup.add(postGroup);
  }

  // 4. MANIFOLD SHOWROOM PAVILION STRUCTURE
  const showroomGroup = new THREE.Group();
  showroomGroup.position.set(0, 0, -45);

  // Showroom Floor (Polished White/Grey Terrazzo for bright daylight reflection)
  const floorGeo = new THREE.BoxGeometry(68, 0.4, 42);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0, // Bright terrazzo showroom floor
    roughness: 0.15,
    metalness: 0.35,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = 0.2;
  floor.receiveShadow = true;
  showroomGroup.add(floor);

  // Showroom Roof
  const roofGeo = new THREE.BoxGeometry(70, 1.2, 44);
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.4,
    metalness: 0.6,
  });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 12.5;
  roof.castShadow = true;
  showroomGroup.add(roof);

  // High-Transparency Glass Front & Side Walls
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    transmission: 0.88,
    opacity: 0.3,
    transparent: true,
    roughness: 0.05,
    metalness: 0.1,
  });

  const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(66, 11.5, 0.3), glassMat);
  frontGlass.position.set(0, 6.2, 20.8);
  showroomGroup.add(frontGlass);

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(68, 12, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
  );
  backWall.position.set(0, 6.2, -20.8);
  showroomGroup.add(backWall);

  // Structural Titanium Columns
  const columnMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.8,
    roughness: 0.2,
  });
  const colPositions = [
    [-32, 21], [32, 21], [-16, 21], [16, 21],
    [-32, -21], [32, -21], [-16, -21], [16, -21],
  ];
  colPositions.forEach(([x, z]) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 12, 16), columnMat);
    col.position.set(x, 6.2, z);
    col.castShadow = true;
    showroomGroup.add(col);
  });

  // Neon Light Strips along ceiling
  for (let z = -15; z <= 15; z += 7.5) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(62, 0.1, 0.25),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 2.2,
      })
    );
    strip.position.set(0, 11.8, z);
    showroomGroup.add(strip);
  }

  // Large 3D Marquee Sign on Showroom Header
  const marqueeGroup = new THREE.Group();
  marqueeGroup.position.set(0, 14.2, 21.5);

  const signBacking = new THREE.Mesh(
    new THREE.BoxGeometry(34, 2.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x050c17, roughness: 0.3 })
  );
  marqueeGroup.add(signBacking);

  const brandTitleBar = new THREE.Mesh(
    new THREE.BoxGeometry(28, 0.9, 0.2),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.8,
    })
  );
  brandTitleBar.position.z = 0.25;
  marqueeGroup.add(brandTitleBar);

  const redAccentBar = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 0.9, 0.22),
    new THREE.MeshStandardMaterial({
      color: 0xef233c,
      emissive: 0xef233c,
      emissiveIntensity: 3.5,
    })
  );
  redAccentBar.position.set(13.8, 0, 0.25);
  marqueeGroup.add(redAccentBar);
  showroomGroup.add(marqueeGroup);

  // 5. ROTATING SHOWROOM PODIUMS (Display vehicles with different classes)
  const podiumCoords = [
    { x: -18, z: 0, carId: 'car-gle450-2022', color: '#0B0D11', name: 'Mercedes-Benz GLE 450', type: 'LUXURY_SUV' as VehicleModelType },
    { x: 0, z: 2, carId: 'car-highlander-2021', color: '#F8FAFC', name: 'Toyota Highlander', type: 'SPORTS_COUPE' as VehicleModelType },
    { x: 18, z: 0, carId: 'car-lexus-rx-2020', color: '#1D4ED8', name: 'Lexus RX 350', type: 'EXECUTIVE_SEDAN' as VehicleModelType },
  ];

  podiumCoords.forEach((p) => {
    const podGroup = new THREE.Group();
    podGroup.position.set(p.x, 0.4, p.z);

    const podMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.6, 0.4, 32),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 })
    );
    podMesh.receiveShadow = true;
    podGroup.add(podMesh);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.42, 0.08, 8, 48).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xef233c, emissive: 0xef233c, emissiveIntensity: 2.6 })
    );
    ring.position.y = 0.2;
    podGroup.add(ring);

    const showcaseCar = createVehicleByType({
      vehicleType: p.type,
      paintColor: p.color,
      finish: 'metallic',
      rimColor: '#e2e8f0',
      caliperColor: '#ef233c',
      headlightTint: '#ffffff',
      windowTint: 0.4,
    });
    showcaseCar.carGroup.position.y = 0.2;
    podGroup.add(showcaseCar.carGroup);

    showroomGroup.add(podGroup);
    podiums.push({ group: podGroup, carMesh: showcaseCar.carGroup, carId: p.carId });
  });

  environmentGroup.add(showroomGroup);

  // 6. GRAND MARKETPLACE PORTAL GATE (Prominent Landmark at [0, 0, 32])
  const marketplacePortal = new THREE.Group();
  marketplacePortal.position.set(0, 0, 32);

  const archMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.85,
    roughness: 0.15,
  });
  const pillarL = new THREE.Mesh(new THREE.BoxGeometry(1.8, 8.0, 2.4), archMat);
  pillarL.position.set(-7.0, 4.0, 0);
  pillarL.castShadow = true;

  const pillarR = pillarL.clone();
  pillarR.position.x = 7.0;

  const archTop = new THREE.Mesh(new THREE.BoxGeometry(15.8, 1.6, 2.4), archMat);
  archTop.position.set(0, 8.4, 0);

  // Holographic Portal Plane
  const holoPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(12.2, 7.2),
    new THREE.MeshPhysicalMaterial({
      color: 0xef233c,
      emissive: 0xef233c,
      emissiveIntensity: 0.9,
      transmission: 0.6,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
    })
  );
  holoPlane.position.set(0, 3.8, 0);

  // Neon Portal Frame
  const neonFrame = new THREE.Mesh(
    new THREE.BoxGeometry(13.5, 0.18, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xef233c, emissive: 0xef233c, emissiveIntensity: 3.8 })
  );
  neonFrame.position.set(0, 7.5, 0.1);

  // Portal Signboard
  const portalSign = new THREE.Mesh(
    new THREE.BoxGeometry(11, 1.1, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.5 })
  );
  portalSign.position.set(0, 9.4, 0);

  marketplacePortal.add(pillarL, pillarR, archTop, holoPlane, neonFrame, portalSign);
  environmentGroup.add(marketplacePortal);

  // 7. SPEED TRAP GATE (On the test track at [-55, 0, 0])
  const speedTrapGate = new THREE.Group();
  speedTrapGate.position.set(-55, 0, 0);
  speedTrapGate.rotation.y = Math.PI / 2;

  const trapGantryMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.7,
    roughness: 0.3,
  });
  const trapColL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 6.5, 12), trapGantryMat);
  trapColL.position.set(-5.5, 3.25, 0);
  const trapColR = trapColL.clone();
  trapColR.position.x = 5.5;

  const trapTop = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.7, 0.7), trapGantryMat);
  trapTop.position.set(0, 6.5, 0);

  const speedDisplay = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 1.3, 0.2),
    new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 2.8,
    })
  );
  speedDisplay.position.set(0, 5.6, 0);

  speedTrapGate.add(trapColL, trapColR, trapTop, speedDisplay);
  environmentGroup.add(speedTrapGate);

  // 8. DAYLIGHT ATMOSPHERIC SKY DOME
  const skyGeo = new THREE.SphereGeometry(320, 32, 24);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8, // Vibrant sunny daylight sky
    side: THREE.BackSide,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  environmentGroup.add(skyDome);

  return {
    environmentGroup,
    podiums,
    marketplacePortal,
    speedTrapGate,
  };
}
