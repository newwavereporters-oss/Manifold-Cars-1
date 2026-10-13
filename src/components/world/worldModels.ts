import * as THREE from 'three';

export type VehicleModelType = 'SPORTS_COUPE' | 'LUXURY_SUV' | 'EXECUTIVE_SEDAN' | 'RUGGED_4X4';

export interface VehicleSpecProfile {
  id: VehicleModelType;
  name: string;
  make: string;
  model: string;
  year: number;
  trim: string;
  category: string;
  engineType: string;
  horsepower: number;
  torqueNm: number;
  drivenWheels: 'AWD' | 'RWD' | '4WD';
  acceleration0To100: number; // seconds
  curbWeightKg: number;
  maxSpeed: number; // units/sec (~ 1 unit ≈ 1.5 meter, ~ 4.6 km/h)
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
  marketplaceMatchId: string;
  marketplaceMatchTitle: string;
}

export const VEHICLE_SPEC_PROFILES: Record<VehicleModelType, VehicleSpecProfile> = {
  SPORTS_COUPE: {
    id: 'SPORTS_COUPE',
    name: 'MANIFOLD GT Coupe',
    make: 'MANIFOLD',
    model: 'GT Competizione',
    year: 2024,
    trim: 'Carbon Track Edition',
    category: 'V8 Twin-Turbo Track Coupe',
    engineType: '4.0L Twin-Turbo Flat-Plane V8',
    horsepower: 680,
    torqueNm: 820,
    drivenWheels: 'RWD',
    acceleration0To100: 3.1,
    curbWeightKg: 1530,
    maxSpeed: 48, // ~220 km/h baseline
    acceleration: 24,
    deceleration: 14,
    brakeDecel: 44,
    maxSteer: 0.54,
    steerSpeed: 3.4,
    gearRatios: [3.4, 2.2, 1.6, 1.2, 0.95, 0.78],
    redlineRpm: 7800,
    idleRpm: 850,
    cockpitOffset: new THREE.Vector3(-0.35, 0.88, 0.22),
    lookTargetHeight: 0.85,
    chaseDistance: 7.6,
    chaseHeight: 2.2,
    chaseLookAhead: 5.0,
    bodyLength: 4.3,
    bodyWidth: 1.88,
    bodyHeight: 1.15,
    marketplaceMatchId: 'car-c63-amg-2021',
    marketplaceMatchTitle: '2021 Mercedes-AMG C63 S Coupe V8 Biturbo',
  },
  LUXURY_SUV: {
    id: 'LUXURY_SUV',
    name: 'Apex Luxury SUV',
    make: 'Apex',
    model: 'Vanguard Bi-Turbo',
    year: 2023,
    trim: 'Executive First Edition',
    category: 'Twin-Turbo AWD 7-Seater',
    engineType: '4.4L Twin-Turbo Dynamic V8',
    horsepower: 530,
    torqueNm: 750,
    drivenWheels: 'AWD',
    acceleration0To100: 4.3,
    curbWeightKg: 2480,
    maxSpeed: 42, // ~195 km/h
    acceleration: 19,
    deceleration: 12,
    brakeDecel: 38,
    maxSteer: 0.46,
    steerSpeed: 2.7,
    gearRatios: [3.8, 2.4, 1.7, 1.25, 0.98, 0.82],
    redlineRpm: 6600,
    idleRpm: 750,
    cockpitOffset: new THREE.Vector3(-0.42, 1.45, 0.35),
    lookTargetHeight: 1.25,
    chaseDistance: 8.8,
    chaseHeight: 2.9,
    chaseLookAhead: 5.5,
    bodyLength: 4.8,
    bodyWidth: 2.05,
    bodyHeight: 1.72,
    marketplaceMatchId: 'car-highlander-2021',
    marketplaceMatchTitle: '2021 Toyota Highlander Platinum AWD V6',
  },
  EXECUTIVE_SEDAN: {
    id: 'EXECUTIVE_SEDAN',
    name: 'Prestige Executive Sedan',
    make: 'Prestige',
    model: 'Sovereign Grand Touring',
    year: 2024,
    trim: 'Limousine Package',
    category: 'V6 Luxury Comfort Cruiser',
    engineType: '3.0L Inline-6 Twin-Scroll Turbo',
    horsepower: 440,
    torqueNm: 600,
    drivenWheels: 'AWD',
    acceleration0To100: 4.6,
    curbWeightKg: 1940,
    maxSpeed: 44, // ~205 km/h
    acceleration: 21,
    deceleration: 13,
    brakeDecel: 40,
    maxSteer: 0.5,
    steerSpeed: 3.0,
    gearRatios: [3.5, 2.3, 1.65, 1.22, 0.96, 0.8],
    redlineRpm: 6900,
    idleRpm: 800,
    cockpitOffset: new THREE.Vector3(-0.38, 1.05, 0.3),
    lookTargetHeight: 0.95,
    chaseDistance: 8.0,
    chaseHeight: 2.4,
    chaseLookAhead: 5.2,
    bodyLength: 4.7,
    bodyWidth: 1.9,
    bodyHeight: 1.35,
    marketplaceMatchId: 'car-e350-2020',
    marketplaceMatchTitle: '2020 Mercedes-Benz E350 AMG Line Sedan',
  },
  RUGGED_4X4: {
    id: 'RUGGED_4X4',
    name: 'Highland Safari 4x4',
    make: 'Highland',
    model: 'Expedition Defender 110',
    year: 2023,
    trim: 'Overland Wilderness Spec',
    category: 'Heavy-Duty Overland V8',
    engineType: '5.0L Supercharged All-Terrain V8',
    horsepower: 518,
    torqueNm: 625,
    drivenWheels: '4WD',
    acceleration0To100: 5.2,
    curbWeightKg: 2650,
    maxSpeed: 38, // ~175 km/h
    acceleration: 17,
    deceleration: 11,
    brakeDecel: 36,
    maxSteer: 0.44,
    steerSpeed: 2.4,
    gearRatios: [4.1, 2.6, 1.8, 1.3, 1.0, 0.84],
    redlineRpm: 6200,
    idleRpm: 700,
    cockpitOffset: new THREE.Vector3(-0.44, 1.62, 0.25),
    lookTargetHeight: 1.4,
    chaseDistance: 9.2,
    chaseHeight: 3.2,
    chaseLookAhead: 6.0,
    bodyLength: 4.65,
    bodyWidth: 2.1,
    bodyHeight: 1.95,
    marketplaceMatchId: 'car-prado-txl-2022',
    marketplaceMatchTitle: '2022 Toyota Land Cruiser Prado TX-L 4x4',
  },
};

export type UnderglowColor = 'NONE' | 'ICE_BLUE' | 'ACID_GREEN' | 'HOT_PINK' | 'CYBER_AMBER' | 'WHITE';
export type SpoilerOption = 'NONE' | 'DUCKTAIL' | 'GT_WING';
export type SuspensionTune = 'STOCK' | 'SPORT' | 'TRACK';
export type BrakeTune = 'OEM' | 'CARBON_CERAMIC';
export type TireTune = 'ALL_SEASON' | 'SEMI_SLICK';

export interface CarCustomization {
  vehicleType?: VehicleModelType;
  paintColor: string;
  finish: 'gloss' | 'matte' | 'metallic';
  rimColor: string;
  caliperColor: string;
  headlightTint: string;
  windowTint: number; // 0 to 1
  spoiler?: SpoilerOption;
  underglow?: UnderglowColor;
  ecuStage?: number; // 0, 1, 2
  suspension?: SuspensionTune;
  brakes?: BrakeTune;
  tires?: TireTune;
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

export const UNDERGLOW_PALETTE: Record<UnderglowColor, { label: string; hex: string }> = {
  NONE: { label: 'Off', hex: '#000000' },
  ICE_BLUE: { label: 'Ice Blue', hex: '#00d2ff' },
  ACID_GREEN: { label: 'Acid Green', hex: '#10b981' },
  HOT_PINK: { label: 'Hot Pink', hex: '#ec4899' },
  CYBER_AMBER: { label: 'Cyber Amber', hex: '#f59e0b' },
  WHITE: { label: 'Hyper White', hex: '#ffffff' },
};

export interface Vehicle3DResult {
  carGroup: THREE.Group;
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  rearLeftWheel: THREE.Group;
  rearRightWheel: THREE.Group;
  bodyMesh: THREE.Mesh;
  paintMaterial: THREE.MeshStandardMaterial;
  headlightsGroup: THREE.Group;
  taillightsGroup: THREE.Group;
  turnSignalMeshes: {
    frontLeft: THREE.Mesh;
    frontRight: THREE.Mesh;
    rearLeft: THREE.Mesh;
    rearRight: THREE.Mesh;
  };
  underglowLight: THREE.PointLight | null;
  headlightSpotL: THREE.SpotLight | null;
  headlightSpotR: THREE.SpotLight | null;
  spoilerGroup: THREE.Group | null;
  interiorGroup: THREE.Group;
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

  // Rubber Tire
  const isSemiSlick = custom.tires === 'SEMI_SLICK';
  const tireMat = new THREE.MeshStandardMaterial({
    color: isSemiSlick ? 0x111317 : 0x1f242d,
    roughness: isSemiSlick ? 0.65 : 0.85,
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

  // Performance Brake Caliper & Rotor
  const isCarbonCeramic = custom.brakes === 'CARBON_CERAMIC';
  const caliperMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(isCarbonCeramic ? '#f59e0b' : custom.caliperColor || '#ef233c'),
    metalness: 0.8,
    roughness: 0.25,
  });
  const caliperGeo = new THREE.BoxGeometry(0.08, radius * 0.48, radius * 0.36);
  const caliper = new THREE.Mesh(caliperGeo, caliperMat);
  caliper.position.set(0.06, radius * 0.38, 0);
  wheelGroup.add(caliper);

  return wheelGroup;
}

/**
 * Creates high-detail cockpit interior (dashboard dials, glowing center infotainment, sport steering wheel, bucket seats)
 */
function buildCockpitInterior(
  seatOffsetZ: number,
  seatY: number,
  steerOffset: THREE.Vector3
): THREE.Group {
  const interior = new THREE.Group();

  const interiorTrimMat = new THREE.MeshStandardMaterial({
    color: 0x181c24,
    roughness: 0.7,
    metalness: 0.2,
  });

  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x0f1218,
    roughness: 0.6,
    metalness: 0.1,
  });

  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });

  const clusterMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xef233c,
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });

  // Dashboard Main Arch
  const dashGeo = new THREE.BoxGeometry(1.6, 0.36, 0.65);
  const dashMesh = new THREE.Mesh(dashGeo, interiorTrimMat);
  dashMesh.position.set(0, steerOffset.y + 0.05, steerOffset.z + 0.32);
  interior.add(dashMesh);

  // Digital Gauge Cluster behind steering wheel
  const clusterGeo = new THREE.BoxGeometry(0.42, 0.16, 0.02);
  const clusterMesh = new THREE.Mesh(clusterGeo, clusterMat);
  clusterMesh.position.set(steerOffset.x, steerOffset.y + 0.12, steerOffset.z + 0.08);
  interior.add(clusterMesh);

  // Center Console Infotainment Display
  const screenGeo = new THREE.BoxGeometry(0.32, 0.22, 0.02);
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.position.set(0, steerOffset.y + 0.08, steerOffset.z + 0.06);
  interior.add(screenMesh);

  // Center Transmission Tunnel & Shifter
  const tunnelGeo = new THREE.BoxGeometry(0.38, 0.32, 1.4);
  const tunnelMesh = new THREE.Mesh(tunnelGeo, interiorTrimMat);
  tunnelMesh.position.set(0, seatY + 0.12, seatOffsetZ);
  interior.add(tunnelMesh);

  // Sport Steering Wheel
  const wheelHubGeo = new THREE.TorusGeometry(0.18, 0.028, 12, 28);
  const wheelHubMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, roughness: 0.4, metalness: 0.6 });
  const wheelHub = new THREE.Mesh(wheelHubGeo, wheelHubMat);
  wheelHub.position.copy(steerOffset);
  wheelHub.rotation.x = Math.PI / 4.5;

  // Steering wheel top center red racing stripe
  const stripeGeo = new THREE.BoxGeometry(0.04, 0.03, 0.06);
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xef233c, emissive: 0xef233c, emissiveIntensity: 2.0 });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.set(0, 0.18, 0);
  wheelHub.add(stripe);
  interior.add(wheelHub);

  // Driver Bucket Seat
  const seatGeo = new THREE.BoxGeometry(0.55, 0.65, 0.55);
  const driverSeat = new THREE.Mesh(seatGeo, seatMat);
  driverSeat.position.set(steerOffset.x, seatY + 0.25, seatOffsetZ);
  driverSeat.castShadow = true;

  // Driver Headrest
  const headrestGeo = new THREE.BoxGeometry(0.28, 0.22, 0.18);
  const headrest = new THREE.Mesh(headrestGeo, seatMat);
  headrest.position.set(0, 0.42, 0);
  driverSeat.add(headrest);
  interior.add(driverSeat);

  // Passenger Bucket Seat
  const passengerSeat = driverSeat.clone();
  passengerSeat.position.x = -steerOffset.x;
  interior.add(passengerSeat);

  return interior;
}

/**
 * Creates dynamic underglow point light & ground reflection mesh
 */
function buildUnderglow(custom: CarCustomization): {
  underglowLight: THREE.PointLight | null;
  underglowGroup: THREE.Group;
} {
  const group = new THREE.Group();
  const colorKey = custom.underglow || 'NONE';
  if (colorKey === 'NONE') {
    return { underglowLight: null, underglowGroup: group };
  }

  const hexColor = UNDERGLOW_PALETTE[colorKey].hex;
  const light = new THREE.PointLight(new THREE.Color(hexColor), 4.5, 6.0, 1.8);
  light.position.set(0, 0.12, 0);
  group.add(light);

  // Diffuse neon ground projection ring
  const glowGeo = new THREE.PlaneGeometry(2.4, 4.4);
  glowGeo.rotateX(-Math.PI / 2);
  const glowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(hexColor),
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.position.set(0, 0.05, 0);
  group.add(glowMesh);

  return { underglowLight: light, underglowGroup: group };
}

/**
 * Creates front headlights spotlights projecting on road ahead
 */
function buildHeadlightSpotlights(): {
  spotL: THREE.SpotLight;
  spotR: THREE.SpotLight;
  spotGroup: THREE.Group;
} {
  const spotGroup = new THREE.Group();

  const spotL = new THREE.SpotLight(0xfffaed, 3.5, 45, Math.PI / 5, 0.35, 1.2);
  spotL.position.set(-0.65, 0.5, 2.3);
  spotL.target.position.set(-0.65, 0, 25);

  const spotR = new THREE.SpotLight(0xfffaed, 3.5, 45, Math.PI / 5, 0.35, 1.2);
  spotR.position.set(0.65, 0.5, 2.3);
  spotR.target.position.set(0.65, 0, 25);

  spotGroup.add(spotL, spotL.target, spotR, spotR.target);

  return { spotL, spotR, spotGroup };
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

  // Cockpit-transparent glass with customizable window tint
  const tintOpacity = 0.35 + (custom.windowTint || 0.45) * 0.5;
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    metalness: 0.1,
    roughness: 0.08,
    transmission: 0.82,
    thickness: 0.2,
    transparent: true,
    opacity: tintOpacity,
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

  // Dynamic Rear Spoiler Wing Option
  const spoilerGroup = new THREE.Group();
  const spoilerOpt = custom.spoiler ?? 'GT_WING';
  if (spoilerOpt === 'GT_WING') {
    const wingBladeGeo = new THREE.BoxGeometry(1.84, 0.04, 0.32);
    const wingBlade = new THREE.Mesh(wingBladeGeo, carbonMaterial);
    wingBlade.position.set(0, 0.96, -2.05);
    wingBlade.castShadow = true;
    spoilerGroup.add(wingBlade);

    const wingPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.08), carbonMaterial);
    wingPillarL.position.set(-0.6, 0.82, -2.02);
    const wingPillarR = wingPillarL.clone();
    wingPillarR.position.x = 0.6;
    spoilerGroup.add(wingPillarL, wingPillarR);
    carGroup.add(spoilerGroup);
  } else if (spoilerOpt === 'DUCKTAIL') {
    const ducktailGeo = new THREE.BoxGeometry(1.72, 0.12, 0.22);
    const ducktail = new THREE.Mesh(ducktailGeo, carbonMaterial);
    ducktail.position.set(0, 0.76, -2.12);
    ducktail.rotation.x = -0.22;
    spoilerGroup.add(ducktail);
    carGroup.add(spoilerGroup);
  }

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

  // Cockpit Detailed Interior
  const interiorGroup = buildCockpitInterior(-0.15, 0.35, new THREE.Vector3(-0.35, 0.76, 0.42));
  carGroup.add(interiorGroup);

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

  // Turn Signals (Amber Blinker LEDs)
  const amberSignalMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.1,
  });
  const turnSignalGeo = new THREE.BoxGeometry(0.14, 0.06, 0.06);
  const turnFrontL = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnFrontL.position.set(-0.84, 0.44, 2.34);
  const turnFrontR = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnFrontR.position.set(0.84, 0.44, 2.34);

  const turnRearL = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnRearL.position.set(-0.84, 0.62, -2.16);
  const turnRearR = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnRearR.position.set(0.84, 0.62, -2.16);
  carGroup.add(turnFrontL, turnFrontR, turnRearL, turnRearR);

  // Taillights
  const taillightsGroup = new THREE.Group();
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef233c,
    emissive: 0xef233c,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });
  const taillightBarGeo = new THREE.BoxGeometry(1.68, 0.06, 0.08);
  const taillightBar = new THREE.Mesh(taillightBarGeo, taillightMat);
  taillightBar.position.set(0, 0.62, -2.16);
  taillightsGroup.add(taillightBar);
  carGroup.add(taillightsGroup);

  // Underglow System
  const { underglowLight, underglowGroup } = buildUnderglow(custom);
  carGroup.add(underglowGroup);

  // Headlight Projection Spotlights
  const { spotL, spotR, spotGroup } = buildHeadlightSpotlights();
  carGroup.add(spotGroup);

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
    interiorGroup,
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

  const tintOpacity = 0.35 + (custom.windowTint || 0.45) * 0.5;
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x93c5fd,
    transmission: 0.8,
    thickness: 0.2,
    transparent: true,
    opacity: tintOpacity,
    roughness: 0.08,
  });

  // Lower Body Shell
  const bodyGeo = new THREE.BoxGeometry(2.02, 0.65, 4.8);
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMaterial);
  bodyMesh.position.y = 0.68;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  carGroup.add(bodyMesh);

  // High Hood
  const hoodGeo = new THREE.BoxGeometry(1.98, 0.32, 1.55);
  const hoodMesh = new THREE.Mesh(hoodGeo, paintMaterial);
  hoodMesh.position.set(0, 0.82, 1.62);
  hoodMesh.castShadow = true;
  carGroup.add(hoodMesh);

  // Prestige Chrome Grille
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.1), chromeMaterial);
  grille.position.set(0, 0.65, 2.42);
  carGroup.add(grille);

  // Upright Greenhouse Cabin
  const cabinGeo = new THREE.BoxGeometry(1.78, 0.68, 2.8);
  const cabinMesh = new THREE.Mesh(cabinGeo, glassMaterial);
  cabinMesh.position.set(0, 1.34, -0.22);
  cabinMesh.castShadow = true;
  carGroup.add(cabinMesh);

  // High Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 2.75), paintMaterial);
  roof.position.set(0, 1.7, -0.22);
  roof.castShadow = true;
  carGroup.add(roof);

  // Chrome Roof Rails
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 2.4), chromeMaterial);
  railL.position.set(-0.85, 1.76, -0.22);
  const railR = railL.clone();
  railR.position.x = 0.85;
  carGroup.add(railL, railR);

  // Tailgate
  const tailgate = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.72, 0.3), paintMaterial);
  tailgate.position.set(0, 0.85, -2.25);
  tailgate.castShadow = true;
  carGroup.add(tailgate);

  // Cockpit Detailed Interior
  const interiorGroup = buildCockpitInterior(-0.2, 0.58, new THREE.Vector3(-0.42, 1.25, 0.45));
  carGroup.add(interiorGroup);

  // Headlights
  const headlightsGroup = new THREE.Group();
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2.8,
  });
  const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.12), headlightMat);
  headlightL.position.set(-0.72, 0.78, 2.38);
  const headlightR = headlightL.clone();
  headlightR.position.x = 0.72;
  headlightsGroup.add(headlightL, headlightR);
  carGroup.add(headlightsGroup);

  // Turn Signals (Amber Blinker LEDs)
  const amberSignalMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.1,
  });
  const turnSignalGeo = new THREE.BoxGeometry(0.15, 0.08, 0.06);
  const turnFrontL = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnFrontL.position.set(-0.92, 0.78, 2.36);
  const turnFrontR = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnFrontR.position.set(0.92, 0.78, 2.36);

  const turnRearL = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnRearL.position.set(-0.92, 1.15, -2.35);
  const turnRearR = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnRearR.position.set(0.92, 1.15, -2.35);
  carGroup.add(turnFrontL, turnFrontR, turnRearL, turnRearR);

  // Taillights
  const taillightsGroup = new THREE.Group();
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef233c,
    emissive: 0xef233c,
    emissiveIntensity: 2.2,
  });
  const taillightL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.42, 0.08), taillightMat);
  taillightL.position.set(-0.78, 1.15, -2.35);
  const taillightR = taillightL.clone();
  taillightR.position.x = 0.78;
  taillightsGroup.add(taillightL, taillightR);
  carGroup.add(taillightsGroup);

  // Underglow System
  const { underglowLight, underglowGroup } = buildUnderglow(custom);
  carGroup.add(underglowGroup);

  // Headlight Spotlights
  const { spotL, spotR, spotGroup } = buildHeadlightSpotlights();
  spotL.position.set(-0.72, 0.78, 2.4);
  spotR.position.set(0.72, 0.78, 2.4);
  carGroup.add(spotGroup);

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
    interiorGroup,
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

  const tintOpacity = 0.35 + (custom.windowTint || 0.45) * 0.5;
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    transmission: 0.82,
    thickness: 0.2,
    transparent: true,
    opacity: tintOpacity,
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

  // Cockpit Detailed Interior
  const interiorGroup = buildCockpitInterior(-0.15, 0.38, new THREE.Vector3(-0.38, 0.88, 0.35));
  carGroup.add(interiorGroup);

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

  // Turn Signals (Amber Blinker LEDs)
  const amberSignalMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.1,
  });
  const turnSignalGeo = new THREE.BoxGeometry(0.14, 0.07, 0.06);
  const turnFrontL = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnFrontL.position.set(-0.86, 0.52, 2.3);
  const turnFrontR = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnFrontR.position.set(0.86, 0.52, 2.3);

  const turnRearL = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnRearL.position.set(-0.86, 0.64, -2.32);
  const turnRearR = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnRearR.position.set(0.86, 0.64, -2.32);
  carGroup.add(turnFrontL, turnFrontR, turnRearL, turnRearR);

  // Taillights
  const taillightsGroup = new THREE.Group();
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef233c,
    emissive: 0xef233c,
    emissiveIntensity: 2.2,
  });
  const taillight = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 0.08), taillightMat);
  taillight.position.set(0, 0.64, -2.32);
  taillightsGroup.add(taillight);
  carGroup.add(taillightsGroup);

  // Underglow System
  const { underglowLight, underglowGroup } = buildUnderglow(custom);
  carGroup.add(underglowGroup);

  // Headlight Spotlights
  const { spotL, spotR, spotGroup } = buildHeadlightSpotlights();
  spotL.position.set(-0.68, 0.52, 2.35);
  spotR.position.set(0.68, 0.52, 2.35);
  carGroup.add(spotGroup);

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
    interiorGroup,
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

  const tintOpacity = 0.35 + (custom.windowTint || 0.45) * 0.5;
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    transmission: 0.78,
    thickness: 0.25,
    transparent: true,
    opacity: tintOpacity,
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

  // Cockpit Detailed Interior
  const interiorGroup = buildCockpitInterior(-0.35, 0.82, new THREE.Vector3(-0.44, 1.48, 0.35));
  carGroup.add(interiorGroup);

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

  // Turn Signals (Amber Blinker LEDs)
  const amberSignalMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.1,
  });
  const turnSignalGeo = new THREE.BoxGeometry(0.16, 0.1, 0.08);
  const turnFrontL = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnFrontL.position.set(-0.95, 1.05, 2.24);
  const turnFrontR = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnFrontR.position.set(0.95, 1.05, 2.24);

  const turnRearL = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnRearL.position.set(-0.95, 1.1, -2.22);
  const turnRearR = new THREE.Mesh(turnSignalGeo, amberSignalMat.clone());
  turnRearR.position.set(0.95, 1.1, -2.22);
  carGroup.add(turnFrontL, turnFrontR, turnRearL, turnRearR);

  // Taillights
  const taillightsGroup = new THREE.Group();
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef233c,
    emissive: 0xef233c,
    emissiveIntensity: 2.2,
  });
  const taillightL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.08), taillightMat);
  taillightL.position.set(-0.85, 1.1, -2.22);
  const taillightR = taillightL.clone();
  taillightR.position.x = 0.85;
  taillightsGroup.add(taillightL, taillightR);
  carGroup.add(taillightsGroup);

  // Underglow System
  const { underglowLight, underglowGroup } = buildUnderglow(custom);
  carGroup.add(underglowGroup);

  // Headlight Spotlights
  const { spotL, spotR, spotGroup } = buildHeadlightSpotlights();
  spotL.position.set(-0.72, 1.05, 2.28);
  spotR.position.set(0.72, 1.05, 2.28);
  carGroup.add(spotGroup);

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
    interiorGroup,
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

  // 2. MODERN TEST TRACK RING AROUND PROVING GROUND
  const trackOuterGeo = new THREE.RingGeometry(85, 145, 64);
  const trackMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.3,
  });
  const track = new THREE.Mesh(trackOuterGeo, trackMat);
  track.rotation.x = -Math.PI / 2;
  track.position.y = 0.01;
  track.receiveShadow = true;
  environmentGroup.add(track);

  // Track Curbs (Red and White Racing Kerbs)
  const curbGeo = new THREE.RingGeometry(83.5, 85, 64);
  const curbMat = new THREE.MeshStandardMaterial({
    color: 0xef233c,
    roughness: 0.4,
  });
  const curb = new THREE.Mesh(curbGeo, curbMat);
  curb.rotation.x = -Math.PI / 2;
  curb.position.y = 0.02;
  environmentGroup.add(curb);

  const outerCurbGeo = new THREE.RingGeometry(145, 146.5, 64);
  const outerCurb = new THREE.Mesh(outerCurbGeo, curbMat);
  outerCurb.rotation.x = -Math.PI / 2;
  outerCurb.position.y = 0.02;
  environmentGroup.add(outerCurb);

  // Center Line Markings
  const centerLineGeo = new THREE.RingGeometry(114.6, 115.4, 64);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const centerLine = new THREE.Mesh(centerLineGeo, lineMat);
  centerLine.rotation.x = -Math.PI / 2;
  centerLine.position.y = 0.03;
  environmentGroup.add(centerLine);

  // 3. SHOWROOM ARCHITECTURAL PAVILION (North at [0, 0, -45])
  const pavilionGroup = new THREE.Group();
  pavilionGroup.position.set(0, 0, -45);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.1,
    roughness: 0.12,
  });
  const pavilionFloor = new THREE.Mesh(new THREE.BoxGeometry(50, 0.4, 30), floorMat);
  pavilionFloor.position.y = 0.2;
  pavilionFloor.receiveShadow = true;
  pavilionGroup.add(pavilionFloor);

  // Glass Walls
  const pavilionGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    transmission: 0.92,
    opacity: 0.35,
    transparent: true,
    roughness: 0.05,
    metalness: 0.1,
  });

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(50, 8, 0.4), pavilionGlassMat);
  backWall.position.set(0, 4.2, -15);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 30), pavilionGlassMat);
  leftWall.position.set(-25, 4.2, 0);
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 30), pavilionGlassMat);
  rightWall.position.set(25, 4.2, 0);
  pavilionGroup.add(backWall, leftWall, rightWall);

  // Modern Cantilevered Roof
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.8,
    roughness: 0.2,
  });
  const pavilionRoof = new THREE.Mesh(new THREE.BoxGeometry(54, 0.8, 34), roofMat);
  pavilionRoof.position.set(0, 8.4, 0);
  pavilionRoof.castShadow = true;
  pavilionGroup.add(pavilionRoof);

  // Neon Showroom Sign
  const signMesh = new THREE.Mesh(
    new THREE.BoxGeometry(22, 1.4, 0.2),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 3.0,
    })
  );
  signMesh.position.set(0, 7.2, 14.8);
  pavilionGroup.add(signMesh);

  environmentGroup.add(pavilionGroup);

  // 4. SHOWROOM DISPLAY VEHICLES (Rotating Turntable Podiums)
  const displayConfigs = [
    {
      carId: 'car-highlander-2021',
      x: -14,
      z: -45,
      type: 'LUXURY_SUV' as VehicleModelType,
      color: '#F8FAFC',
    },
    {
      carId: 'car-c63-amg-2021',
      x: 0,
      z: -45,
      type: 'SPORTS_COUPE' as VehicleModelType,
      color: '#DC2626',
    },
    {
      carId: 'car-e350-2020',
      x: 14,
      z: -45,
      type: 'EXECUTIVE_SEDAN' as VehicleModelType,
      color: '#0B0D11',
    },
  ];

  displayConfigs.forEach((cfg) => {
    const podGroup = new THREE.Group();
    podGroup.position.set(cfg.x, 0.4, cfg.z);

    const turntableGeo = new THREE.CylinderGeometry(4.2, 4.4, 0.25, 32);
    const turntableMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.7,
      roughness: 0.25,
    });
    const turntable = new THREE.Mesh(turntableGeo, turntableMat);
    turntable.receiveShadow = true;
    podGroup.add(turntable);

    // Illuminated edge ring
    const ringGeo = new THREE.RingGeometry(4.1, 4.35, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.13;
    podGroup.add(ring);

    // Display Vehicle
    const displayCar = createVehicleByType({
      vehicleType: cfg.type,
      paintColor: cfg.color,
      finish: 'metallic',
      rimColor: '#E2E8F0',
      caliperColor: '#EF233C',
      headlightTint: '#ffffff',
      windowTint: 0.45,
    });
    displayCar.carGroup.position.set(0, 0.13, 0);
    podGroup.add(displayCar.carGroup);

    podiums.push({
      group: podGroup,
      carMesh: displayCar.carGroup,
      carId: cfg.carId,
    });
    environmentGroup.add(podGroup);
  });

  // 5. VIP DEALER LOUNGE & CONCIERGE BUILDING (East at [50, 0, 0])
  const loungeGroup = new THREE.Group();
  loungeGroup.position.set(50, 0, 0);
  loungeGroup.rotation.y = -Math.PI / 2;

  const loungeBase = new THREE.Mesh(
    new THREE.BoxGeometry(26, 6.5, 18),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.5 })
  );
  loungeBase.position.y = 3.25;
  loungeBase.castShadow = true;
  loungeGroup.add(loungeBase);

  // Illuminated Sign
  const loungeSign = new THREE.Mesh(
    new THREE.BoxGeometry(14, 1.2, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 2.5 })
  );
  loungeSign.position.set(0, 5.8, 9.1);
  loungeGroup.add(loungeSign);
  environmentGroup.add(loungeGroup);

  // 6. GRAND MARKETPLACE GATEWAY (South at [0, 0, 32])
  const marketplacePortal = new THREE.Group();
  marketplacePortal.position.set(0, 0, 32);

  const portalMat = new THREE.MeshStandardMaterial({
    color: 0x071a2b,
    metalness: 0.85,
    roughness: 0.15,
  });

  const pillarL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 9.5, 2.2), portalMat);
  pillarL.position.set(-6.5, 4.75, 0);
  pillarL.castShadow = true;

  const pillarR = pillarL.clone();
  pillarR.position.x = 6.5;

  const archTop = new THREE.Mesh(new THREE.BoxGeometry(15.2, 1.8, 2.4), portalMat);
  archTop.position.set(0, 9.2, 0);
  archTop.castShadow = true;

  // Holographic Drive-Through Energy Portal
  const holoPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(10.8, 7.6),
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
    color: 0x38bdf8,
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
