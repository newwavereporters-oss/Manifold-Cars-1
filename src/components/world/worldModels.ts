import * as THREE from 'three';
import { VehicleModelFactory } from '../../three/VehicleModelFactory';

export { VehicleModelFactory };
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
export type InteriorTheme = 'BLACK' | 'CREAM' | 'BROWN' | 'GREY' | 'SPORT';
export type MusicPreference =
  | 'AFROBEATS'
  | 'HIP_HOP'
  | 'RNB'
  | 'GOSPEL'
  | 'INSTRUMENTAL'
  | 'ELECTRONIC_HOUSE'
  | 'NO_MUSIC';

export interface InteriorThemeOption {
  id: InteriorTheme;
  label: string;
  seatHex: string;
  trimHex: string;
  accentHex: string;
  desc: string;
}

export const INTERIOR_THEME_OPTIONS: InteriorThemeOption[] = [
  {
    id: 'BLACK',
    label: 'Black Leather',
    seatHex: '#11151C',
    trimHex: '#181C24',
    accentHex: '#64748B',
    desc: 'Obsidian perforated hide with satin charcoal trim',
  },
  {
    id: 'CREAM',
    label: 'Cream Ivory',
    seatHex: '#EDE6D6',
    trimHex: '#3D352B',
    accentHex: '#D4B98C',
    desc: 'Light beige Nappa upholstery with warm espresso dash',
  },
  {
    id: 'BROWN',
    label: 'Saddle Brown',
    seatHex: '#6B3E26',
    trimHex: '#261810',
    accentHex: '#C27D48',
    desc: 'Heritage cognac leather with dark walnut console',
  },
  {
    id: 'GREY',
    label: 'Slate Grey',
    seatHex: '#64748B',
    trimHex: '#1E293B',
    accentHex: '#CBD5E1',
    desc: 'Architectural titanium grey leather & brushed aluminum',
  },
  {
    id: 'SPORT',
    label: 'Sport Alcantara',
    seatHex: '#151821',
    trimHex: '#0D1017',
    accentHex: '#EF233C',
    desc: 'Carbon weave bolsters with Crimson contrast stitching',
  },
];

export interface MusicPreferenceOption {
  id: MusicPreference;
  label: string;
  stationIndex: number;
  vibe: string;
}

export const MUSIC_PREFERENCE_OPTIONS: MusicPreferenceOption[] = [
  { id: 'AFROBEATS', label: 'Afrobeats', stationIndex: 1, vibe: 'Lagos Mainland groove & warm percussion' },
  { id: 'HIP_HOP', label: 'Hip-hop', stationIndex: 2, vibe: 'Deep 808 bassline & crisp street pulse' },
  { id: 'RNB', label: 'R&B', stationIndex: 3, vibe: 'Smooth late-night electric Rhodes chords' },
  { id: 'GOSPEL', label: 'Gospel', stationIndex: 4, vibe: 'Uplifting organ & warm harmonic keys' },
  { id: 'INSTRUMENTAL', label: 'Instrumental', stationIndex: 5, vibe: 'Ambient lo-fi acoustic cruising focus' },
  { id: 'ELECTRONIC_HOUSE', label: 'Electronic / House', stationIndex: 6, vibe: 'High-tempo coastal bridge synth drive' },
  { id: 'NO_MUSIC', label: 'No music', stationIndex: 0, vibe: 'Pure V8/exhaust & Lagos street acoustics' },
];

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
  interiorTheme?: InteriorTheme;
  musicPreference?: MusicPreference;
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
  chassisGroup?: THREE.Group;
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  rearLeftWheel: THREE.Group;
  rearRightWheel: THREE.Group;
  wheelSteeringGroups?: {
    frontLeft: THREE.Group;
    frontRight: THREE.Group;
  };
  wheelSpinGroups?: {
    frontLeft: THREE.Group;
    frontRight: THREE.Group;
    rearLeft: THREE.Group;
    rearRight: THREE.Group;
  };
  wheelRadius?: number;
  steeringWheelGroup?: THREE.Group;
  driverGroup?: THREE.Group;
  driverHeadGroup?: THREE.Group;
  driverArmGroups?: [THREE.Group, THREE.Group];
  bodyMesh: THREE.Mesh;
  paintMaterial: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
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
  reverseLights?: THREE.Mesh[];
  brakeLightMats?: THREE.MeshStandardMaterial[];
}

/**
 * Factory to create vehicle model by type using modular VehicleModelFactory
 */
export function createVehicleByType(custom: CarCustomization): Vehicle3DResult {
  return VehicleModelFactory.create(custom);
}

export function createSportsCar(custom: CarCustomization): Vehicle3DResult {
  return VehicleModelFactory.createSportsCoupe(custom);
}

export function createLuxurySUV(custom: CarCustomization): Vehicle3DResult {
  return VehicleModelFactory.createLuxurySUV(custom);
}

export function createExecutiveSedan(custom: CarCustomization): Vehicle3DResult {
  return VehicleModelFactory.createExecutiveSedan(custom);
}

export function createRugged4x4(custom: CarCustomization): Vehicle3DResult {
  return VehicleModelFactory.createRugged4x4(custom);
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

  // 1. SHOWROOM BOULEVARD PAVILION (Open Drive-Through Canopy straddling [0, 0, -48])
  const pavilionGroup = new THREE.Group();
  pavilionGroup.position.set(0, 0, -48);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.15,
    roughness: 0.25,
  });

  // Left and right flanking showroom esplanade decks (leaving x: -8.5..+8.5 clear for road!)
  const deckGeo = new THREE.BoxGeometry(16, 0.3, 28);
  const leftDeck = new THREE.Mesh(deckGeo, floorMat);
  leftDeck.position.set(-18, 0.15, 0);
  leftDeck.receiveShadow = true;

  const rightDeck = new THREE.Mesh(deckGeo, floorMat);
  rightDeck.position.set(18, 0.15, 0);
  rightDeck.receiveShadow = true;
  pavilionGroup.add(leftDeck, rightDeck);

  // Outer Glass Gallery Side Walls (Open North & South ends for drive-through)
  const pavilionGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    transmission: 0.72,
    opacity: 0.42,
    transparent: true,
    roughness: 0.08,
    metalness: 0.12,
  });

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8.2, 28), pavilionGlassMat);
  leftWall.position.set(-25.8, 4.2, 0);
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8.2, 28), pavilionGlassMat);
  rightWall.position.set(25.8, 4.2, 0);
  pavilionGroup.add(leftWall, rightWall);

  // Structural Steel Support Columns flanking road shoulders (outside 14m road + curbs)
  const colMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.8,
    roughness: 0.25,
  });
  const colPositions: [number, number][] = [
    [-10.2, -13],
    [10.2, -13],
    [-10.2, 13],
    [10.2, 13],
    [-25.6, -13],
    [25.6, -13],
    [-25.6, 13],
    [25.6, 13],
  ];
  colPositions.forEach(([cx, cz]) => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.65, 8.5, 0.65), colMat);
    col.position.set(cx, 4.25, cz);
    col.castShadow = true;
    pavilionGroup.add(col);
  });

  // Modern Cantilevered Steel Roof Spanning the Boulevard
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.75,
    roughness: 0.25,
  });
  const pavilionRoof = new THREE.Mesh(new THREE.BoxGeometry(54, 0.85, 30), roofMat);
  pavilionRoof.position.set(0, 8.8, 0);
  pavilionRoof.castShadow = true;
  pavilionGroup.add(pavilionRoof);

  // Illuminated Showroom Facade Frieze (Front & Back)
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 96;
  const sctx = signCanvas.getContext('2d');
  if (sctx) {
    sctx.fillStyle = '#071A2B';
    sctx.fillRect(0, 0, 512, 96);
    sctx.strokeStyle = '#EF233C';
    sctx.lineWidth = 6;
    sctx.strokeRect(3, 3, 506, 90);
    sctx.fillStyle = '#FFFFFF';
    sctx.font = 'bold 34px "Plus Jakarta Sans", Arial, sans-serif';
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText('MANIFOLD SHOWROOM PAVILION', 256, 48);
  }
  const pavilionSignTex = new THREE.CanvasTexture(signCanvas);
  pavilionSignTex.colorSpace = THREE.SRGBColorSpace;
  const pavilionSignMat = new THREE.MeshBasicMaterial({ map: pavilionSignTex });
  const signMeshF = new THREE.Mesh(new THREE.PlaneGeometry(18, 2.2), pavilionSignMat);
  signMeshF.position.set(0, 8.2, 15.1);
  const signMeshB = signMeshF.clone();
  signMeshB.position.z = -15.1;
  signMeshB.rotation.y = Math.PI;
  pavilionGroup.add(signMeshF, signMeshB);

  environmentGroup.add(pavilionGroup);

  // 2. SHOWROOM DISPLAY VEHICLES (Flanking Esplanade Turntable Podiums)
  const displayConfigs = [
    {
      carId: 'car-highlander-2021',
      x: -18,
      z: -42,
      type: 'LUXURY_SUV' as VehicleModelType,
      color: '#F8FAFC',
    },
    {
      carId: 'car-c63-amg-2021',
      x: 18,
      z: -42,
      type: 'SPORTS_COUPE' as VehicleModelType,
      color: '#DC2626',
    },
    {
      carId: 'car-e350-2020',
      x: -18,
      z: -56,
      type: 'EXECUTIVE_SEDAN' as VehicleModelType,
      color: '#0B0D11',
    },
  ];

  displayConfigs.forEach((cfg) => {
    const podGroup = new THREE.Group();
    podGroup.position.set(cfg.x, 0.3, cfg.z);

    const turntableGeo = new THREE.CylinderGeometry(4.0, 4.2, 0.25, 32);
    const turntableMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.7,
      roughness: 0.25,
    });
    const turntable = new THREE.Mesh(turntableGeo, turntableMat);
    turntable.receiveShadow = true;
    podGroup.add(turntable);

    const ringGeo = new THREE.RingGeometry(3.9, 4.15, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.13;
    podGroup.add(ring);

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

  // 3. TUNING & CUSTOMIZATION SERVICE BAY (at [35, 0, 10], clear of roads & buildings)
  {
    const tuningBay = new THREE.Group();
    tuningBay.position.set(35, 0, 10);

    const bayPad = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, 0.14, 9.0),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.2 })
    );
    bayPad.position.y = 0.07;
    bayPad.receiveShadow = true;

    const bayCanopy = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, 0.35, 8.8),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.75 })
    );
    bayCanopy.position.set(0, 4.8, 0);
    bayCanopy.castShadow = true;

    const emeraldStrip = new THREE.Mesh(
      new THREE.BoxGeometry(10.6, 0.18, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 2.2 })
    );
    emeraldStrip.position.set(0, 4.65, -4.4);

    [
      [-4.8, -3.8],
      [4.8, -3.8],
      [-4.8, 3.8],
      [4.8, 3.8],
    ].forEach(([px, pz]) => {
      const p = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 4.7, 8),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 })
      );
      p.position.set(px, 2.35, pz);
      tuningBay.add(p);
    });

    tuningBay.add(bayPad, bayCanopy, emeraldStrip);
    environmentGroup.add(tuningBay);
  }

  // 4. VIP DEALER LOUNGE & CONCIERGE PAVILION (Relocated off intersection to [57, 0, 22])
  {
    const loungeGroup = new THREE.Group();
    loungeGroup.position.set(57, 0, 22);
    loungeGroup.rotation.y = Math.PI; // Faces North towards Commercial Ave [z=0]

    const loungeBase = new THREE.Mesh(
      new THREE.BoxGeometry(16, 6.8, 12),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.32, metalness: 0.55 })
    );
    loungeBase.position.y = 3.4;
    loungeBase.castShadow = true;
    loungeBase.receiveShadow = true;
    loungeGroup.add(loungeBase);

    const loungeCanopy = new THREE.Mesh(
      new THREE.BoxGeometry(11, 0.35, 3.5),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35, metalness: 0.65 })
    );
    loungeCanopy.position.set(0, 3.8, 7.2);
    loungeGroup.add(loungeCanopy);

    const loungeSignCanvas = document.createElement('canvas');
    loungeSignCanvas.width = 512;
    loungeSignCanvas.height = 128;
    const lctx = loungeSignCanvas.getContext('2d');
    if (lctx) {
      lctx.fillStyle = '#0F172A';
      lctx.fillRect(0, 0, 512, 128);
      lctx.strokeStyle = '#F59E0B';
      lctx.lineWidth = 8;
      lctx.strokeRect(4, 4, 504, 120);
      lctx.fillStyle = '#F59E0B';
      lctx.font = 'bold 34px "Plus Jakarta Sans", Arial, sans-serif';
      lctx.textAlign = 'center';
      lctx.textBaseline = 'middle';
      lctx.fillText('VIP DEALER LOUNGE', 256, 48);
      lctx.fillStyle = '#FFFFFF';
      lctx.font = 'bold 20px Arial, sans-serif';
      lctx.fillText('CONCIERGE & FINANCING', 256, 92);
    }
    const loungeTex = new THREE.CanvasTexture(loungeSignCanvas);
    loungeTex.colorSpace = THREE.SRGBColorSpace;
    const loungeSign = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 2.4),
      new THREE.MeshBasicMaterial({ map: loungeTex })
    );
    loungeSign.position.set(0, 5.5, 6.08);
    loungeGroup.add(loungeSign);
    environmentGroup.add(loungeGroup);
  }

  // 5. MARKETPLACE PORTAL REFERENCE GROUP (3D Arch rendered by lagosCityBuilder at [0, 0, 100])
  const marketplacePortal = new THREE.Group();
  marketplacePortal.position.set(0, 0, 100);
  environmentGroup.add(marketplacePortal);

  // 6. SPEED TRAP GATE (Spanning West Surulere Corridor at [-55, 0, 0])
  const speedTrapGate = new THREE.Group();
  speedTrapGate.position.set(-55, 0, 0);
  speedTrapGate.rotation.y = Math.PI / 2;

  const trapGantryMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.7,
    roughness: 0.3,
  });
  const trapColL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 6.8, 12), trapGantryMat);
  trapColL.position.set(-7.4, 3.4, 0);
  const trapColR = trapColL.clone();
  trapColR.position.x = 7.4;

  const trapTop = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.7, 0.7), trapGantryMat);
  trapTop.position.set(0, 6.8, 0);

  const speedDisplay = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 1.3, 0.25),
    new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 2.6,
    })
  );
  speedDisplay.position.set(0, 5.85, 0);

  speedTrapGate.add(trapColL, trapColR, trapTop, speedDisplay);
  environmentGroup.add(speedTrapGate);

  return {
    environmentGroup,
    podiums,
    marketplacePortal,
    speedTrapGate,
  };
}
