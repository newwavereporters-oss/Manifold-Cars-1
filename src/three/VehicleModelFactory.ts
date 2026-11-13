// MANIFOLD WORLD - MODULAR PROCEDURAL AUTOMOTIVE MODEL FACTORY
// Builds realistic Three.js Group geometries for Sports Coupe, Luxury SUV,
// Executive Sedan, and Rugged 4x4 using modular BoxGeometry and CylinderGeometry components
// representing accurate body contours, recessed wheel wells, and cabin proportions.

import * as THREE from 'three';
import type {
  CarCustomization,
  Vehicle3DResult,
  VehicleModelType,
} from '../components/world/worldModels';

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
  windowTint: 0.45,
};

function normalizeCustom(input: CarCustomization | VehicleModelType): CarCustomization {
  if (typeof input === 'string') {
    return { ...DEFAULT_CUSTOMIZATION, vehicleType: input };
  }
  return { ...DEFAULT_CUSTOMIZATION, ...input };
}

function createPaintMaterial(custom: CarCustomization): THREE.MeshStandardMaterial {
  const isMatte = custom.finish === 'matte';
  const isMetallic = custom.finish === 'metallic';
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.paintColor || '#DC2626'),
    roughness: isMatte ? 0.58 : isMetallic ? 0.2 : 0.14,
    metalness: isMatte ? 0.24 : isMetallic ? 0.72 : 0.48,
    envMapIntensity: isMatte ? 0.85 : 1.65,
  });
}

function createGlassMaterial(windowTint: number): THREE.MeshPhysicalMaterial {
  const opacity = 0.42 + (windowTint ?? 0.45) * 0.46;
  return new THREE.MeshPhysicalMaterial({
    color: 0x0b1220,
    roughness: 0.08,
    metalness: 0.2,
    transmission: 0.24,
    transparent: true,
    opacity: Math.min(0.92, Math.max(0.35, opacity)),
    envMapIntensity: 1.9,
  });
}

function createSharedMaterials(custom: CarCustomization) {
  const paintMat = createPaintMaterial(custom);
  const glassMat = createGlassMaterial(custom.windowTint);
  const trimBlackMat = new THREE.MeshStandardMaterial({
    color: 0x11151d,
    roughness: 0.56,
    metalness: 0.28,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x181c24,
    roughness: 0.36,
    metalness: 0.46,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.16,
    metalness: 0.92,
  });
  const meshGrilleMat = new THREE.MeshStandardMaterial({
    color: 0x090d14,
    roughness: 0.62,
    metalness: 0.45,
  });
  const wheelWellLinerMat = new THREE.MeshStandardMaterial({
    color: 0x090b10,
    roughness: 0.92,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.headlightTint || '#ffffff'),
    emissive: new THREE.Color(custom.headlightTint || '#f8fafc'),
    emissiveIntensity: 2.2,
    roughness: 0.12,
  });
  const drlMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xe0f2fe,
    emissiveIntensity: 2.0,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef233c,
    emissive: 0xef233c,
    emissiveIntensity: 1.75,
    roughness: 0.2,
  });
  const amberSignalMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.1,
    roughness: 0.25,
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
    trimBlackMat,
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

/**
 * Helper to place a modular BoxGeometry part cleanly
 */
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

/**
 * Helper to place a modular CylinderGeometry part cleanly
 */
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
 * Builds a realistic multi-part wheel using CylinderGeometry (tire tread, sidewall shoulders,
 * rim barrel, alloy lip, hub, lug nuts, brake rotor) and BoxGeometry (twin 5-spoke alloys, caliper).
 * Local outward wheel face points towards +X (right wheels rotate Y = Math.PI in world space).
 */
function buildModularWheel(
  custom: CarCustomization,
  radius: number,
  width: number,
  rimRadius: number
): THREE.Group {
  const wheelGroup = new THREE.Group();
  const isSemiSlick = custom.tires === 'SEMI_SLICK';

  const tireMat = new THREE.MeshStandardMaterial({
    color: isSemiSlick ? 0x101318 : 0x1b1f26,
    roughness: isSemiSlick ? 0.62 : 0.84,
    metalness: 0.06,
  });
  const sidewallMat = new THREE.MeshStandardMaterial({
    color: 0x14171d,
    roughness: 0.78,
    metalness: 0.05,
  });
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.38,
    metalness: 0.72,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(custom.rimColor || '#e2e8f0'),
    metalness: 0.92,
    roughness: 0.16,
  });
  const rotorMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.86,
    roughness: 0.28,
  });
  const isCarbonCeramic = custom.brakes === 'CARBON_CERAMIC';
  const caliperMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(isCarbonCeramic ? '#f59e0b' : custom.caliperColor || '#ef233c'),
    metalness: 0.72,
    roughness: 0.26,
  });

  // 1. Main Cylindrical Tire Tread
  const tread = addCyl(
    wheelGroup,
    radius,
    radius,
    width * 0.84,
    28,
    tireMat,
    0,
    0,
    0,
    0,
    0,
    Math.PI / 2,
    true
  );
  tread.receiveShadow = true;

  // 2. Stepped Cylindrical Tire Sidewalls (rounded automotive tire shoulder contour)
  const shoulderOut = addCyl(
    wheelGroup,
    radius * 0.94,
    radius,
    width * 0.08,
    28,
    sidewallMat,
    width * 0.45,
    0,
    0,
    0,
    0,
    Math.PI / 2,
    false
  );
  const shoulderIn = shoulderOut.clone();
  shoulderIn.position.x = -width * 0.45;
  shoulderIn.rotation.z = -Math.PI / 2;
  wheelGroup.add(shoulderIn);

  // 3. Recessed Rim Barrel Cylinder
  addCyl(
    wheelGroup,
    rimRadius * 0.95,
    rimRadius * 0.95,
    width * 0.9,
    24,
    barrelMat,
    0,
    0,
    0,
    0,
    0,
    Math.PI / 2,
    false
  );

  // 4. Outer Alloy Rim Collar Ring (open-ended cylinder lip)
  const lipGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, width * 0.1, 24, 1, true);
  lipGeo.rotateZ(Math.PI / 2);
  const rimLip = new THREE.Mesh(lipGeo, rimMat);
  rimLip.position.x = width * 0.44;
  wheelGroup.add(rimLip);

  // 5. Center Hub Cap & Lug Nuts (CylinderGeometry)
  addCyl(
    wheelGroup,
    rimRadius * 0.27,
    rimRadius * 0.3,
    0.06,
    16,
    rimMat,
    width * 0.42,
    0,
    0,
    0,
    0,
    Math.PI / 2,
    false
  );
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    const lugR = rimRadius * 0.16;
    addCyl(
      wheelGroup,
      0.015,
      0.015,
      0.04,
      8,
      rotorMat,
      width * 0.44,
      Math.cos(a) * lugR,
      Math.sin(a) * lugR,
      0,
      0,
      Math.PI / 2,
      false
    );
  }

  // 6. Twin 5-Spoke Alloy Arms (BoxGeometry)
  for (let i = 0; i < 5; i++) {
    const baseAng = (i * Math.PI * 2) / 5;
    [-0.14, 0.14].forEach((offsetAng) => {
      const a = baseAng + offsetAng;
      const rMid = rimRadius * 0.56;
      addBox(
        wheelGroup,
        0.028,
        rimRadius * 0.82,
        0.026,
        rimMat,
        width * 0.42,
        Math.cos(a) * rMid,
        Math.sin(a) * rMid,
        -a,
        0,
        0,
        false
      );
    });
  }

  // 7. Ventilated Brake Rotor (CylinderGeometry) & Caliper (BoxGeometry)
  addCyl(
    wheelGroup,
    rimRadius * 0.78,
    rimRadius * 0.78,
    0.032,
    20,
    rotorMat,
    width * 0.18,
    0,
    0,
    0,
    0,
    Math.PI / 2,
    false
  );
  addBox(
    wheelGroup,
    0.075,
    radius * 0.35,
    radius * 0.24,
    caliperMat,
    width * 0.2,
    radius * 0.23,
    radius * 0.25,
    0,
    0,
    0,
    false
  );

  return wheelGroup;
}

/**
 * Builds 4 recessed wheel wells with CylinderGeometry semicircular wheelhouse liners
 * and segmented BoxGeometry fender-flare arch lips.
 */
function buildRecessedWheelWells(
  carGroup: THREE.Group,
  archRadius: number,
  wellWidth: number,
  halfTrackX: number,
  frontZ: number,
  rearZ: number,
  yCenter: number,
  linerMat: THREE.Material,
  flareMat: THREE.Material,
  flareThickness = 0.085,
  flareRadialDepth = 0.075
) {
  // Semicircular wheelhouse barrel (open bottom, covers upper 180 deg around wheel)
  const linerGeo = new THREE.CylinderGeometry(
    archRadius,
    archRadius,
    wellWidth,
    18,
    1,
    true,
    -Math.PI / 2,
    Math.PI
  );
  linerGeo.rotateZ(Math.PI / 2);

  // Inner backing bulkhead plate inside wheelhouse
  const bulkheadGeo = new THREE.CylinderGeometry(
    archRadius,
    archRadius,
    0.03,
    16,
    1,
    false,
    -Math.PI / 2,
    Math.PI
  );
  bulkheadGeo.rotateZ(Math.PI / 2);

  const flareSegCount = 9;
  const flareSegLen = ((Math.PI * archRadius) / flareSegCount) * 1.18;
  const flareSegGeo = new THREE.BoxGeometry(flareThickness, flareRadialDepth, flareSegLen);

  const corners: [number, number, number][] = [
    [-halfTrackX, frontZ, -1],
    [halfTrackX, frontZ, 1],
    [-halfTrackX, rearZ, -1],
    [halfTrackX, rearZ, 1],
  ];

  corners.forEach(([ax, az, sideSign]) => {
    const well = new THREE.Group();
    well.position.set(ax, yCenter, az);

    const liner = new THREE.Mesh(linerGeo, linerMat);
    liner.position.x = -sideSign * (wellWidth * 0.08);
    well.add(liner);

    const bulkhead = new THREE.Mesh(bulkheadGeo, linerMat);
    bulkhead.position.x = -sideSign * (wellWidth * 0.56);
    well.add(bulkhead);

    // Sculpted multi-segment BoxGeometry arch flare lip framing the wheel well
    for (let i = 0; i < flareSegCount; i++) {
      const t = (i + 0.5) / flareSegCount; // 0..1 across semicircle
      const theta = t * Math.PI; // 0 (front) .. PI (rear)
      const rimR = archRadius + flareRadialDepth * 0.42;
      const seg = new THREE.Mesh(flareSegGeo, flareMat);
      seg.position.set(
        sideSign * (wellWidth * 0.46),
        Math.sin(theta) * rimR,
        Math.cos(theta) * rimR
      );
      seg.rotation.x = theta - Math.PI / 2;
      seg.castShadow = true;
      well.add(seg);
    }

    carGroup.add(well);
  });
}

/**
 * Builds front & rear Lagos license plates using BoxGeometry + CanvasTexture
 */
function addLicensePlates(
  carGroup: THREE.Group,
  frontPos: [number, number, number],
  rearPos: [number, number, number],
  plateText = 'LAGOS • MFD 01'
) {
  let plateMat: THREE.MeshStandardMaterial;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = '#065f46';
      ctx.fillRect(0, 0, 256, 12);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, 252, 60);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(plateText, 128, 39);
    }
    const plateTex = new THREE.CanvasTexture(canvas);
    plateTex.colorSpace = THREE.SRGBColorSpace;
    plateMat = new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.4 });
  } else {
    plateMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
  }

  const plateGeo = new THREE.BoxGeometry(0.48, 0.12, 0.025);
  const frontPlate = new THREE.Mesh(plateGeo, plateMat);
  frontPlate.position.set(frontPos[0], frontPos[1], frontPos[2]);
  const rearPlate = new THREE.Mesh(plateGeo, plateMat);
  rearPlate.position.set(rearPos[0], rearPos[1], rearPos[2]);
  rearPlate.rotation.y = Math.PI;
  carGroup.add(frontPlate, rearPlate);
}

/**
 * Builds modular cockpit interior (dashboard, binnacle, screen, console,
 * multi-segment Cylinder/Box steering wheel, and bolstered seats).
 */
function buildCockpitInterior(
  seatOffsetZ: number,
  seatY: number,
  steerOffset: THREE.Vector3
): THREE.Group {
  const interior = new THREE.Group();

  const interiorTrimMat = new THREE.MeshStandardMaterial({
    color: 0x181c24,
    roughness: 0.72,
    metalness: 0.18,
  });
  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x11151c,
    roughness: 0.62,
    metalness: 0.1,
  });
  const stitchingMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.5,
  });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.65,
    roughness: 0.2,
  });

  // Dashboard upper cowl + lower knee bolster + binnacle hood
  addBox(interior, 1.48, 0.24, 0.54, interiorTrimMat, 0, seatY + 0.36, seatOffsetZ + 0.68, 0.08, 0, 0, false);
  addBox(
    interior,
    0.42,
    0.16,
    0.26,
    interiorTrimMat,
    steerOffset.x,
    seatY + 0.44,
    seatOffsetZ + 0.56,
    0.05,
    0,
    0,
    false
  );
  addBox(interior, 0.28, 0.14, 0.04, screenMat, 0, seatY + 0.46, seatOffsetZ + 0.56, -0.15, 0, 0, false);
  addBox(interior, 0.26, 0.2, 1.35, interiorTrimMat, 0, seatY + 0.1, seatOffsetZ + 0.1, 0, 0, 0, false);

  // Steering column (CylinderGeometry) + modular steering wheel (CylinderGeometry rim & hub + BoxGeometry spokes)
  const steeringGroup = new THREE.Group();
  steeringGroup.position.set(steerOffset.x, steerOffset.y, steerOffset.z);
  steeringGroup.rotation.x = -0.35;

  addCyl(steeringGroup, 0.032, 0.038, 0.28, 12, interiorTrimMat, 0, 0, 0.12, Math.PI / 2, 0, 0, false);
  addCyl(steeringGroup, 0.058, 0.058, 0.045, 16, interiorTrimMat, 0, 0, 0.01, Math.PI / 2, 0, 0, false);

  // Segmented steering wheel rim built from CylinderGeometry collar + 12 BoxGeometry grip segments
  const rimSegs = 12;
  const wheelR = 0.155;
  for (let i = 0; i < rimSegs; i++) {
    const a = (i / rimSegs) * Math.PI * 2;
    addBox(
      steeringGroup,
      0.028,
      (Math.PI * 2 * wheelR) / rimSegs + 0.012,
      0.028,
      i === 0 ? stitchingMat : interiorTrimMat,
      Math.cos(a) * wheelR,
      Math.sin(a) * wheelR,
      0,
      0,
      0,
      a,
      false
    );
  }
  // 3 Steering wheel spokes
  addBox(steeringGroup, 0.28, 0.03, 0.018, interiorTrimMat, 0, 0, 0.005, 0, 0, 0, false);
  addBox(steeringGroup, 0.032, 0.15, 0.018, interiorTrimMat, 0, -0.075, 0.005, 0, 0, 0, false);
  interior.add(steeringGroup);

  // Front & Rear/Pair Bucket Seats (BoxGeometry + CylinderGeometry headrests)
  [-0.4, 0.4].forEach((sx) => {
    addBox(interior, 0.44, 0.1, 0.48, seatMat, sx, seatY, seatOffsetZ, 0, 0, 0, false);
    addBox(interior, 0.42, 0.56, 0.12, seatMat, sx, seatY + 0.29, seatOffsetZ - 0.2, -0.2, 0, 0, false);
    addBox(interior, 0.08, 0.34, 0.12, seatMat, sx - 0.19, seatY + 0.22, seatOffsetZ - 0.14, -0.2, 0, 0, false);
    addBox(interior, 0.08, 0.34, 0.12, seatMat, sx + 0.19, seatY + 0.22, seatOffsetZ - 0.14, -0.2, 0, 0, false);
    addCyl(interior, 0.095, 0.105, 0.16, 12, seatMat, sx, seatY + 0.62, seatOffsetZ - 0.28, -0.15, 0, 0, false);
  });

  return interior;
}

/**
 * Builds twin side mirrors using BoxGeometry stalks + aerodynamic caps
 */
function buildSideMirrors(
  carGroup: THREE.Group,
  paintMat: THREE.Material,
  trimMat: THREE.Material,
  xPos: number,
  yPos: number,
  zPos: number
) {
  [-1, 1].forEach((s) => {
    addBox(carGroup, 0.11, 0.04, 0.06, trimMat, s * (xPos - 0.04), yPos - 0.02, zPos, 0, 0, s * 0.25);
    addBox(carGroup, 0.17, 0.09, 0.11, paintMat, s * (xPos + 0.04), yPos + 0.01, zPos - 0.02);
  });
}

/**
 * Builds spoiler attachment for Sports Coupe / Sedan
 */
function buildSpoiler(
  custom: CarCustomization,
  paintMat: THREE.Material,
  carbonMat: THREE.Material,
  yPos: number,
  zPos: number,
  width = 1.68
): THREE.Group | null {
  const spoiler = custom.spoiler || 'NONE';
  if (spoiler === 'NONE') return null;

  const sg = new THREE.Group();
  if (spoiler === 'DUCKTAIL') {
    addBox(sg, width * 0.88, 0.1, 0.18, paintMat, 0, yPos + 0.03, zPos - 0.02, -0.35);
    addBox(sg, width * 0.86, 0.025, 0.08, carbonMat, 0, yPos + 0.07, zPos - 0.06, -0.35);
  } else {
    // GT_WING
    [-0.48, 0.48].forEach((sx) => {
      addBox(sg, 0.04, 0.26, 0.15, carbonMat, sx, yPos + 0.12, zPos, -0.18);
    });
    addBox(sg, width, 0.04, 0.26, carbonMat, 0, yPos + 0.26, zPos - 0.03, 0.1);
    [-width / 2, width / 2].forEach((ex) => {
      addBox(sg, 0.035, 0.16, 0.34, paintMat, ex, yPos + 0.26, zPos - 0.03);
    });
  }
  return sg;
}

/**
 * Builds underglow illumination under chassis
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
    addCyl(underglowGroup, 0.022, 0.022, zSpread * 2, 8, tubeMat, lx, 0.15, 0, Math.PI / 2, 0, 0, false);
  });

  return { underglowLight, underglowGroup };
}

/**
 * Builds dual headlights SpotLights
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
 * Modular Vehicle Model Factory
 * Creates Sports Coupe, Luxury SUV, Executive Sedan, and Rugged 4x4 using modular
 * BoxGeometry and CylinderGeometry assemblies.
 */
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
   * 1. SPORTS COUPE — Low-slung widebody track stance, sloped bonnet, recessed wheel wells, fastback cabin
   */
  public static createSportsCoupe(input: CarCustomization): Vehicle3DResult {
    const custom = normalizeCustom({ ...input, vehicleType: 'SPORTS_COUPE' });
    const carGroup = new THREE.Group();
    const mats = createSharedMaterials(custom);

    const frontZ = 1.4;
    const rearZ = -1.36;
    const wheelR = 0.36;
    const wheelW = 0.28;
    const trackX = 0.92;

    // 1. Recessed Wheel Wells (CylinderGeometry liners + BoxGeometry flared lips)
    buildRecessedWheelWells(
      carGroup,
      wheelR + 0.075,
      wheelW + 0.1,
      trackX,
      frontZ,
      rearZ,
      wheelR,
      mats.wheelWellLinerMat,
      mats.paintMat,
      0.09,
      0.065
    );

    // 2. Chassis Undertray, Front Splitter, Side Skirts & Rear Diffuser
    addBox(carGroup, 1.56, 0.08, 4.18, mats.trimBlackMat, 0, 0.18, 0.02);
    addBox(carGroup, 1.94, 0.045, 0.42, mats.carbonMat, 0, 0.16, 2.08, 0.04);
    [-0.95, 0.95].forEach((sx) => {
      addBox(carGroup, 0.1, 0.06, 1.72, mats.carbonMat, sx, 0.16, 0.02);
    });
    addBox(carGroup, 1.78, 0.14, 0.32, mats.carbonMat, 0, 0.24, -2.02, -0.12);
    [-0.5, -0.25, 0, 0.25, 0.5].forEach((fx) => {
      addBox(carGroup, 0.028, 0.14, 0.28, mats.carbonMat, fx, 0.22, -2.1);
    });

    // 3. Sculpted Lower Body Shell (Split around wheel wells for clean wheel clearance)
    // Central cabin tub & side door lower panels between wheel wells
    const bodyMesh = addBox(carGroup, 1.84, 0.46, 1.76, mats.paintMat, 0, 0.48, 0.02);
    // Upper fender beltline continuous strip above wheel wells
    addBox(carGroup, 1.88, 0.18, 4.12, mats.paintMat, 0, 0.72, 0.03);
    // Sculpted door aero character trim & side intake gills
    [-0.94, 0.94].forEach((sx) => {
      addBox(carGroup, 0.05, 0.28, 1.56, mats.paintMat, sx, 0.52, 0.02);
      addBox(carGroup, 0.04, 0.2, 0.16, mats.meshGrilleMat, sx * 0.99, 0.52, 0.78);
    });

    // 4. Sculpted Sloped Hood / Bonnet & Front Quarter Nose
    addBox(carGroup, 1.46, 0.12, 1.24, mats.paintMat, 0, 0.78, 1.34, 0.14);
    addBox(carGroup, 0.62, 0.055, 0.95, mats.paintMat, 0, 0.85, 1.28, 0.14); // Hood power dome
    [-0.36, 0.36].forEach((vx) => {
      addBox(carGroup, 0.18, 0.02, 0.28, mats.carbonMat, vx, 0.84, 1.32, 0.14); // Hood vents
    });
    // Tapered front nose bumper & wide hexagonal mesh grille
    addBox(carGroup, 1.78, 0.34, 0.46, mats.paintMat, 0, 0.42, 1.98, 0.08);
    addBox(carGroup, 1.06, 0.24, 0.1, mats.meshGrilleMat, 0, 0.39, 2.2);
    addBox(carGroup, 1.08, 0.025, 0.11, mats.chromeMat, 0, 0.4, 2.21);
    [-0.7, 0.7].forEach((ix) => {
      addBox(carGroup, 0.34, 0.2, 0.1, mats.meshGrilleMat, ix, 0.36, 2.16, 0, ix > 0 ? -0.18 : 0.18);
    });

    // 5. Rear Haunches, Sculpted Boot / Trunk & Quad Cylindrical Exhausts
    addBox(carGroup, 1.82, 0.42, 0.48, mats.paintMat, 0, 0.52, -1.96, -0.05);
    addBox(carGroup, 1.56, 0.12, 0.58, mats.paintMat, 0, 0.82, -1.78, -0.08);
    [-0.58, -0.44, 0.44, 0.58].forEach((ex) => {
      addCyl(carGroup, 0.048, 0.048, 0.16, 12, mats.chromeMat, ex, 0.24, -2.18, Math.PI / 2);
      addCyl(carGroup, 0.036, 0.036, 0.06, 10, mats.meshGrilleMat, ex, 0.24, -2.24, Math.PI / 2, 0, 0, false);
    });

    // 6. Fastback Cabin Greenhouse (Raked Windshield, Tapered Roof, Pillars, Side Glass)
    // Dark cabin inner core
    addBox(carGroup, 1.36, 0.34, 1.55, mats.trimBlackMat, 0, 0.94, -0.15, 0, 0, 0, false);
    // Raked front windshield & A-pillars
    addBox(carGroup, 1.38, 0.04, 0.9, mats.glassMat, 0, 0.99, 0.44, -0.58, 0, 0, false);
    [-0.69, 0.69].forEach((ax) => {
      addBox(carGroup, 0.06, 0.06, 0.92, mats.paintMat, ax, 0.99, 0.44, -0.58);
    });
    // Tapered Coupe Roof Crown
    addBox(carGroup, 1.32, 0.07, 1.02, mats.paintMat, 0, 1.19, -0.28);
    // Fastback rear window sweeping to decklid + C-pillars
    addBox(carGroup, 1.28, 0.04, 0.94, mats.glassMat, 0, 1.01, -1.16, 0.44, 0, 0, false);
    [-0.66, 0.66].forEach((cx) => {
      addBox(carGroup, 0.08, 0.08, 0.96, mats.paintMat, cx, 1.01, -1.16, 0.44);
      // Side greenhouse windows
      addBox(carGroup, 0.03, 0.28, 1.24, mats.glassMat, cx * 1.02, 0.97, -0.32, 0, 0, cx > 0 ? 0.14 : -0.14, false);
    });

    // 7. Side Mirrors, Interior, Spoiler, Plates & Lighting
    buildSideMirrors(carGroup, mats.paintMat, mats.trimBlackMat, 0.88, 0.85, 0.48);
    const interiorGroup = buildCockpitInterior(-0.1, 0.44, new THREE.Vector3(-0.35, 0.72, 0.25));
    carGroup.add(interiorGroup);

    const spoilerGroup = buildSpoiler(custom, mats.paintMat, mats.carbonMat, 0.87, -1.96, 1.72);
    if (spoilerGroup) carGroup.add(spoilerGroup);

    addLicensePlates(carGroup, [0, 0.33, 2.23], [0, 0.46, -2.21]);

    // Headlights + DRL + Turn Signals
    const headlightsGroup = new THREE.Group();
    [-0.68, 0.68].forEach((lx) => {
      addBox(headlightsGroup, 0.34, 0.09, 0.14, mats.headlightMat, lx, 0.57, 2.13, 0, lx > 0 ? -0.18 : 0.18, 0, false);
      addBox(headlightsGroup, 0.32, 0.025, 0.15, mats.drlMat, lx, 0.52, 2.14, 0, lx > 0 ? -0.18 : 0.18, 0, false);
    });
    carGroup.add(headlightsGroup);

    const turnFrontL = addBox(carGroup, 0.12, 0.035, 0.09, mats.amberSignalMat.clone(), -0.84, 0.56, 2.09, 0, 0.2, 0, false);
    const turnFrontR = addBox(carGroup, 0.12, 0.035, 0.09, mats.amberSignalMat.clone(), 0.84, 0.56, 2.09, 0, -0.2, 0, false);
    const turnRearL = addBox(carGroup, 0.18, 0.04, 0.06, mats.amberSignalMat.clone(), -0.76, 0.64, -2.19, 0, 0, 0, false);
    const turnRearR = addBox(carGroup, 0.18, 0.04, 0.06, mats.amberSignalMat.clone(), 0.76, 0.64, -2.19, 0, 0, 0, false);

    // Full-Width Taillight Strip + Reverse Lights
    const taillightsGroup = new THREE.Group();
    addBox(taillightsGroup, 1.56, 0.065, 0.07, mats.taillightMat, 0, 0.69, -2.19, 0, 0, 0, false);
    carGroup.add(taillightsGroup);

    const revL = addBox(carGroup, 0.16, 0.04, 0.05, mats.reverseMat, -0.58, 0.61, -2.19, 0, 0, 0, false);
    const revR = addBox(carGroup, 0.16, 0.04, 0.05, mats.reverseMat, 0.58, 0.61, -2.19, 0, 0, 0, false);

    const { underglowLight, underglowGroup } = buildUnderglow(custom);
    carGroup.add(underglowGroup);
    const { spotL, spotR, spotGroup } = buildHeadlightSpotlights();
    spotL.position.set(-0.68, 0.58, 2.2);
    spotR.position.set(0.68, 0.58, 2.2);
    carGroup.add(spotGroup);

    // 8. Modular Cylinder + Box Wheels
    const frontLeftWheel = buildModularWheel(custom, wheelR, wheelW, 0.25);
    frontLeftWheel.position.set(-trackX, wheelR, frontZ);
    const frontRightWheel = buildModularWheel(custom, wheelR, wheelW, 0.25);
    frontRightWheel.position.set(trackX, wheelR, frontZ);
    frontRightWheel.rotation.y = Math.PI;
    const rearLeftWheel = buildModularWheel(custom, wheelR, wheelW + 0.03, 0.25);
    rearLeftWheel.position.set(-trackX, wheelR, rearZ);
    const rearRightWheel = buildModularWheel(custom, wheelR, wheelW + 0.03, 0.25);
    rearRightWheel.position.set(trackX, wheelR, rearZ);
    rearRightWheel.rotation.y = Math.PI;
    carGroup.add(frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel);

    return {
      carGroup,
      frontLeftWheel,
      frontRightWheel,
      rearLeftWheel,
      rearRightWheel,
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
      interiorGroup,
      vehicleType: 'SPORTS_COUPE',
      reverseLights: [revL, revR],
      brakeLightMats: [mats.taillightMat],
    };
  }

  /**
   * 2. LUXURY SUV — Commanding upright stance, panoramic roof, recessed cladding wheel wells, sculpted tailgate
   */
  public static createLuxurySUV(input: CarCustomization): Vehicle3DResult {
    const custom = normalizeCustom({ ...input, vehicleType: 'LUXURY_SUV' });
    const carGroup = new THREE.Group();
    const mats = createSharedMaterials(custom);

    const frontZ = 1.48;
    const rearZ = -1.46;
    const wheelR = 0.43;
    const wheelW = 0.31;
    const trackX = 0.99;

    // 1. Recessed Wheel Wells with protective SUV cladding flares
    buildRecessedWheelWells(
      carGroup,
      wheelR + 0.09,
      wheelW + 0.12,
      trackX,
      frontZ,
      rearZ,
      wheelR,
      mats.wheelWellLinerMat,
      mats.trimBlackMat,
      0.1,
      0.08
    );

    // 2. Underbody Chassis, Skid Plates & Aluminum Running Boards
    addBox(carGroup, 1.72, 0.12, 4.48, mats.trimBlackMat, 0, 0.28, 0.0);
    addBox(carGroup, 1.24, 0.07, 0.28, mats.chromeMat, 0, 0.29, 2.34, 0.18); // Front skid plate
    addBox(carGroup, 1.38, 0.08, 0.26, mats.trimBlackMat, 0, 0.3, -2.32, -0.15); // Rear diffuser
    [-1.02, 1.02].forEach((sx) => {
      addBox(carGroup, 0.18, 0.06, 1.88, mats.chromeMat, sx, 0.28, 0.01); // Running boards
    });

    // 3. Sculpted Muscular Lower & Beltline Body Panels
    const bodyMesh = addBox(carGroup, 1.98, 0.54, 1.86, mats.paintMat, 0, 0.64, 0.01);
    addBox(carGroup, 2.0, 0.26, 4.42, mats.paintMat, 0, 0.95, 0.02);
    // Door crease sculpting & chrome lower garnish
    [-1.0, 1.0].forEach((sx) => {
      addBox(carGroup, 0.05, 0.4, 1.74, mats.paintMat, sx, 0.66, 0.01);
      addBox(carGroup, 0.055, 0.05, 1.7, mats.chromeMat, sx, 0.42, 0.01);
    });

    // 4. Elevated Sculpted Hood, Front Bumper & Vertical-Slat Luxury Grille
    addBox(carGroup, 1.66, 0.16, 1.32, mats.paintMat, 0, 1.07, 1.54, 0.06);
    [-0.45, 0.45].forEach((rx) => {
      addBox(carGroup, 0.22, 0.04, 1.15, mats.paintMat, rx, 1.15, 1.52, 0.06);
    });
    addBox(carGroup, 1.96, 0.48, 0.44, mats.paintMat, 0, 0.62, 2.18, 0.04);
    addBox(carGroup, 1.12, 0.44, 0.1, mats.meshGrilleMat, 0, 0.78, 2.41);
    addBox(carGroup, 1.16, 0.48, 0.04, mats.chromeMat, 0, 0.78, 2.38);
    for (let gx = -0.44; gx <= 0.44; gx += 0.11) {
      addBox(carGroup, 0.025, 0.4, 0.06, mats.chromeMat, gx, 0.78, 2.44);
    }

    // 5. Rear Quarter Panels, Tailgate & Twin Chrome Exhausts
    addBox(carGroup, 1.96, 0.56, 0.52, mats.paintMat, 0, 0.68, -2.14);
    addBox(carGroup, 1.78, 0.45, 0.24, mats.paintMat, 0, 1.14, -2.26, 0.08);
    [-0.68, 0.68].forEach((ex) => {
      addCyl(carGroup, 0.065, 0.065, 0.18, 12, mats.chromeMat, ex, 0.34, -2.38, Math.PI / 2);
    });

    // 6. Upright Panoramic SUV Greenhouse (Windshield, Roof, Panoramic Glass, A/B/C/D Pillars, Roof Rails)
    addBox(carGroup, 1.62, 0.48, 2.65, mats.trimBlackMat, 0, 1.3, -0.42, 0, 0, 0, false);
    // Raked front windshield & A-pillars
    addBox(carGroup, 1.62, 0.045, 0.92, mats.glassMat, 0, 1.38, 0.72, -0.5, 0, 0, false);
    [-0.81, 0.81].forEach((ax) => {
      addBox(carGroup, 0.075, 0.075, 0.94, mats.paintMat, ax, 1.38, 0.72, -0.5);
    });
    // Long SUV Roof + Tinted Panoramic Glass Insert + Chrome Roof Rails
    addBox(carGroup, 1.64, 0.07, 2.52, mats.paintMat, 0, 1.66, -0.82);
    addBox(carGroup, 1.14, 0.03, 1.72, mats.glassMat, 0, 1.69, -0.78, 0, 0, 0, false);
    [-0.68, 0.68].forEach((rx) => {
      addBox(carGroup, 0.05, 0.06, 2.32, mats.chromeMat, rx, 1.72, -0.82);
    });
    // Rear Tailgate Glass & C/D-Pillars + Rear Roof Spoiler
    addBox(carGroup, 1.54, 0.045, 0.58, mats.glassMat, 0, 1.44, -2.14, 0.34, 0, 0, false);
    [-0.78, 0.78].forEach((dx) => {
      addBox(carGroup, 0.1, 0.08, 0.6, mats.paintMat, dx, 1.44, -2.14, 0.34);
      addBox(carGroup, 0.08, 0.44, 0.14, mats.trimBlackMat, dx * 1.03, 1.36, -0.55); // B-pillar
      addBox(carGroup, 0.035, 0.4, 2.28, mats.glassMat, dx * 1.03, 1.36, -0.88, 0, 0, dx > 0 ? 0.1 : -0.1, false);
    });
    addBox(carGroup, 1.64, 0.08, 0.28, mats.paintMat, 0, 1.66, -2.16, -0.06); // Roof spoiler lip

    // 7. Side Mirrors, Cockpit Interior, Plates & Lighting
    buildSideMirrors(carGroup, mats.paintMat, mats.trimBlackMat, 0.98, 1.18, 0.74);
    const interiorGroup = buildCockpitInterior(0.08, 0.86, new THREE.Vector3(-0.42, 1.18, 0.42));
    carGroup.add(interiorGroup);
    addLicensePlates(carGroup, [0, 0.48, 2.42], [0, 0.8, -2.4]);

    const headlightsGroup = new THREE.Group();
    [-0.74, 0.74].forEach((lx) => {
      addBox(headlightsGroup, 0.34, 0.12, 0.14, mats.headlightMat, lx, 0.88, 2.38, 0, lx > 0 ? -0.12 : 0.12, 0, false);
      addBox(headlightsGroup, 0.34, 0.03, 0.15, mats.drlMat, lx, 0.81, 2.39, 0, lx > 0 ? -0.12 : 0.12, 0, false);
    });
    carGroup.add(headlightsGroup);

    const turnFrontL = addBox(carGroup, 0.1, 0.04, 0.1, mats.amberSignalMat.clone(), -0.92, 0.87, 2.32, 0, 0.2, 0, false);
    const turnFrontR = addBox(carGroup, 0.1, 0.04, 0.1, mats.amberSignalMat.clone(), 0.92, 0.87, 2.32, 0, -0.2, 0, false);
    const turnRearL = addBox(carGroup, 0.22, 0.045, 0.06, mats.amberSignalMat.clone(), -0.78, 0.96, -2.39, 0, 0, 0, false);
    const turnRearR = addBox(carGroup, 0.22, 0.045, 0.06, mats.amberSignalMat.clone(), 0.78, 0.96, -2.39, 0, 0, 0, false);

    const taillightsGroup = new THREE.Group();
    [-0.78, 0.78].forEach((lx) => {
      addBox(taillightsGroup, 0.4, 0.11, 0.08, mats.taillightMat, lx, 1.04, -2.39, 0, 0, 0, false);
    });
    addBox(taillightsGroup, 1.2, 0.035, 0.06, mats.taillightMat, 0, 1.04, -2.39, 0, 0, 0, false);
    carGroup.add(taillightsGroup);

    const revL = addBox(carGroup, 0.18, 0.045, 0.05, mats.reverseMat, -0.62, 0.91, -2.39, 0, 0, 0, false);
    const revR = addBox(carGroup, 0.18, 0.045, 0.05, mats.reverseMat, 0.62, 0.91, -2.39, 0, 0, 0, false);

    const { underglowLight, underglowGroup } = buildUnderglow(custom, 1.38);
    carGroup.add(underglowGroup);
    const { spotL, spotR, spotGroup } = buildHeadlightSpotlights();
    spotL.position.set(-0.74, 0.88, 2.45);
    spotR.position.set(0.74, 0.88, 2.45);
    carGroup.add(spotGroup);

    // 8. Modular SUV Wheels
    const frontLeftWheel = buildModularWheel(custom, wheelR, wheelW, 0.28);
    frontLeftWheel.position.set(-trackX, wheelR, frontZ);
    const frontRightWheel = buildModularWheel(custom, wheelR, wheelW, 0.28);
    frontRightWheel.position.set(trackX, wheelR, frontZ);
    frontRightWheel.rotation.y = Math.PI;
    const rearLeftWheel = buildModularWheel(custom, wheelR, wheelW, 0.28);
    rearLeftWheel.position.set(-trackX, wheelR, rearZ);
    const rearRightWheel = buildModularWheel(custom, wheelR, wheelW, 0.28);
    rearRightWheel.position.set(trackX, wheelR, rearZ);
    rearRightWheel.rotation.y = Math.PI;
    carGroup.add(frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel);

    return {
      carGroup,
      frontLeftWheel,
      frontRightWheel,
      rearLeftWheel,
      rearRightWheel,
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
      interiorGroup,
      vehicleType: 'LUXURY_SUV',
      reverseLights: [revL, revR],
      brakeLightMats: [mats.taillightMat],
    };
  }

  /**
   * 3. EXECUTIVE SEDAN — Sleek 3-box luxury proportions, long hood, chrome grille, refined trunk
   */
  public static createExecutiveSedan(input: CarCustomization): Vehicle3DResult {
    const custom = normalizeCustom({ ...input, vehicleType: 'EXECUTIVE_SEDAN' });
    const carGroup = new THREE.Group();
    const mats = createSharedMaterials(custom);

    const frontZ = 1.48;
    const rearZ = -1.42;
    const wheelR = 0.37;
    const wheelW = 0.26;
    const trackX = 0.92;

    // 1. Recessed Wheel Wells
    buildRecessedWheelWells(
      carGroup,
      wheelR + 0.075,
      wheelW + 0.1,
      trackX,
      frontZ,
      rearZ,
      wheelR,
      mats.wheelWellLinerMat,
      mats.paintMat,
      0.08,
      0.06
    );

    // 2. Undertray, Chrome Rocker Trim & Rear Valance
    addBox(carGroup, 1.6, 0.09, 4.44, mats.trimBlackMat, 0, 0.2, 0.02);
    [-0.93, 0.93].forEach((sx) => {
      addBox(carGroup, 0.06, 0.04, 1.88, mats.chromeMat, sx, 0.22, 0.03);
    });
    addBox(carGroup, 1.72, 0.15, 0.26, mats.trimBlackMat, 0, 0.26, -2.22);

    // 3. 3-Box Sculpted Body Panels
    const bodyMesh = addBox(carGroup, 1.84, 0.48, 1.94, mats.paintMat, 0, 0.52, 0.03);
    addBox(carGroup, 1.86, 0.2, 4.38, mats.paintMat, 0, 0.78, 0.04);
    [-0.93, 0.93].forEach((sx) => {
      addBox(carGroup, 0.045, 0.3, 1.82, mats.paintMat, sx, 0.55, 0.03);
      addBox(carGroup, 0.03, 0.03, 1.82, mats.chromeMat, sx, 0.89, -0.15); // Chrome beltline
    });

    // 4. Long Sculpted Hood & Signature Executive Chrome Grille
    addBox(carGroup, 1.56, 0.13, 1.38, mats.paintMat, 0, 0.86, 1.48, 0.08);
    addBox(carGroup, 0.5, 0.035, 1.15, mats.paintMat, 0, 0.92, 1.46, 0.08);
    addBox(carGroup, 1.82, 0.36, 0.46, mats.paintMat, 0, 0.46, 2.15, 0.05);
    addBox(carGroup, 0.98, 0.3, 0.09, mats.meshGrilleMat, 0, 0.58, 2.38);
    addBox(carGroup, 1.02, 0.34, 0.04, mats.chromeMat, 0, 0.58, 2.35);
    [-0.08, 0, 0.08].forEach((gy) => {
      addBox(carGroup, 0.92, 0.02, 0.05, mats.chromeMat, 0, 0.58 + gy, 2.41);
    });

    // 5. Distinct Sedan Trunk Deck & Dual Exhausts
    addBox(carGroup, 1.8, 0.44, 0.56, mats.paintMat, 0, 0.55, -2.06);
    addBox(carGroup, 1.58, 0.14, 0.84, mats.paintMat, 0, 0.88, -1.86, -0.04);
    [-0.6, 0.6].forEach((ex) => {
      addCyl(carGroup, 0.058, 0.058, 0.16, 12, mats.chromeMat, ex, 0.27, -2.35, Math.PI / 2);
    });

    // 6. Sedan Greenhouse Cabin (Windshield, Roof, B-pillar, Rear Window, C-pillars)
    addBox(carGroup, 1.46, 0.38, 1.85, mats.trimBlackMat, 0, 1.05, -0.18, 0, 0, 0, false);
    addBox(carGroup, 1.46, 0.04, 0.92, mats.glassMat, 0, 1.12, 0.58, -0.52, 0, 0, false);
    [-0.73, 0.73].forEach((ax) => {
      addBox(carGroup, 0.065, 0.065, 0.94, mats.paintMat, ax, 1.12, 0.58, -0.52);
    });
    // Roof crown + shark-fin antenna
    addBox(carGroup, 1.42, 0.075, 1.24, mats.paintMat, 0, 1.34, -0.26);
    addBox(carGroup, 0.05, 0.09, 0.18, mats.trimBlackMat, 0, 1.4, -0.78, -0.3);
    // Raked rear window & C-pillars
    addBox(carGroup, 1.4, 0.04, 0.82, mats.glassMat, 0, 1.14, -1.16, 0.5, 0, 0, false);
    [-0.71, 0.71].forEach((cx) => {
      addBox(carGroup, 0.085, 0.075, 0.84, mats.paintMat, cx, 1.14, -1.16, 0.5);
      addBox(carGroup, 0.07, 0.34, 0.12, mats.trimBlackMat, cx * 1.02, 1.1, -0.22); // B-pillar
      addBox(carGroup, 0.03, 0.32, 1.54, mats.glassMat, cx * 1.02, 1.1, -0.28, 0, 0, cx > 0 ? 0.12 : -0.12, false);
    });

    // 7. Side Mirrors, Interior, Spoiler, Plates & Lighting
    buildSideMirrors(carGroup, mats.paintMat, mats.trimBlackMat, 0.91, 0.96, 0.58);
    const interiorGroup = buildCockpitInterior(-0.08, 0.56, new THREE.Vector3(-0.38, 0.88, 0.34));
    carGroup.add(interiorGroup);

    const spoilerGroup = buildSpoiler(custom, mats.paintMat, mats.carbonMat, 0.94, -2.18, 1.62);
    if (spoilerGroup) carGroup.add(spoilerGroup);

    addLicensePlates(carGroup, [0, 0.38, 2.39], [0, 0.62, -2.35]);

    const headlightsGroup = new THREE.Group();
    [-0.68, 0.68].forEach((lx) => {
      addBox(headlightsGroup, 0.32, 0.1, 0.14, mats.headlightMat, lx, 0.66, 2.32, 0, lx > 0 ? -0.14 : 0.14, 0, false);
      addBox(headlightsGroup, 0.32, 0.025, 0.15, mats.drlMat, lx, 0.71, 2.33, 0, lx > 0 ? -0.14 : 0.14, 0, false);
    });
    carGroup.add(headlightsGroup);

    const turnFrontL = addBox(carGroup, 0.1, 0.035, 0.09, mats.amberSignalMat.clone(), -0.84, 0.65, 2.27, 0, 0.2, 0, false);
    const turnFrontR = addBox(carGroup, 0.1, 0.035, 0.09, mats.amberSignalMat.clone(), 0.84, 0.65, 2.27, 0, -0.2, 0, false);
    const turnRearL = addBox(carGroup, 0.22, 0.038, 0.06, mats.amberSignalMat.clone(), -0.7, 0.72, -2.35, 0, 0, 0, false);
    const turnRearR = addBox(carGroup, 0.22, 0.038, 0.06, mats.amberSignalMat.clone(), 0.7, 0.72, -2.35, 0, 0, 0, false);

    const taillightsGroup = new THREE.Group();
    [-0.68, 0.68].forEach((lx) => {
      addBox(taillightsGroup, 0.38, 0.09, 0.08, mats.taillightMat, lx, 0.77, -2.35, 0, 0, 0, false);
    });
    addBox(taillightsGroup, 0.9, 0.025, 0.06, mats.chromeMat, 0, 0.79, -2.35, 0, 0, 0, false);
    carGroup.add(taillightsGroup);

    const revL = addBox(carGroup, 0.16, 0.04, 0.05, mats.reverseMat, -0.54, 0.68, -2.35, 0, 0, 0, false);
    const revR = addBox(carGroup, 0.16, 0.04, 0.05, mats.reverseMat, 0.54, 0.68, -2.35, 0, 0, 0, false);

    const { underglowLight, underglowGroup } = buildUnderglow(custom, 1.32);
    carGroup.add(underglowGroup);
    const { spotL, spotR, spotGroup } = buildHeadlightSpotlights();
    spotL.position.set(-0.68, 0.66, 2.38);
    spotR.position.set(0.68, 0.66, 2.38);
    carGroup.add(spotGroup);

    // 8. Modular Sedan Wheels
    const frontLeftWheel = buildModularWheel(custom, wheelR, wheelW, 0.26);
    frontLeftWheel.position.set(-trackX, wheelR, frontZ);
    const frontRightWheel = buildModularWheel(custom, wheelR, wheelW, 0.26);
    frontRightWheel.position.set(trackX, wheelR, frontZ);
    frontRightWheel.rotation.y = Math.PI;
    const rearLeftWheel = buildModularWheel(custom, wheelR, wheelW, 0.26);
    rearLeftWheel.position.set(-trackX, wheelR, rearZ);
    const rearRightWheel = buildModularWheel(custom, wheelR, wheelW, 0.26);
    rearRightWheel.position.set(trackX, wheelR, rearZ);
    rearRightWheel.rotation.y = Math.PI;
    carGroup.add(frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel);

    return {
      carGroup,
      frontLeftWheel,
      frontRightWheel,
      rearLeftWheel,
      rearRightWheel,
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
      interiorGroup,
      vehicleType: 'EXECUTIVE_SEDAN',
      reverseLights: [revL, revR],
      brakeLightMats: [mats.taillightMat],
    };
  }

  /**
   * 4. RUGGED 4x4 — High ground clearance, bull bar, snorkel, roof rack + light pods, spare tire
   */
  public static createRugged4x4(input: CarCustomization): Vehicle3DResult {
    const custom = normalizeCustom({ ...input, vehicleType: 'RUGGED_4X4' });
    const carGroup = new THREE.Group();
    const mats = createSharedMaterials(custom);

    const frontZ = 1.38;
    const rearZ = -1.35;
    const wheelR = 0.48;
    const wheelW = 0.36;
    const trackX = 1.04;

    // 1. High-Clearance Recessed Wheel Wells with rugged wide flares
    buildRecessedWheelWells(
      carGroup,
      wheelR + 0.11,
      wheelW + 0.12,
      trackX,
      frontZ,
      rearZ,
      wheelR,
      mats.wheelWellLinerMat,
      mats.trimBlackMat,
      0.13,
      0.09
    );

    // 2. Heavy Ladder Frame Chassis, Rock Sliders & Front Steel Bull Bar + Winch
    addBox(carGroup, 1.5, 0.15, 4.38, mats.trimBlackMat, 0, 0.42, 0.0);
    [-1.02, 1.02].forEach((rx) => {
      addCyl(carGroup, 0.045, 0.045, 1.72, 10, mats.trimBlackMat, rx, 0.42, 0.02, Math.PI / 2);
    });
    // Heavy front bumper + tubular bull bar + winch cylinder
    addBox(carGroup, 1.98, 0.28, 0.32, mats.trimBlackMat, 0, 0.56, 2.2);
    addBox(carGroup, 1.1, 0.14, 0.24, mats.chromeMat, 0, 0.44, 2.28, 0.25);
    addCyl(carGroup, 0.075, 0.075, 0.42, 12, mats.chromeMat, 0, 0.68, 2.32, 0, 0, Math.PI / 2); // Winch
    addCyl(carGroup, 0.036, 0.036, 1.32, 10, mats.trimBlackMat, 0, 1.12, 2.34, 0, 0, Math.PI / 2); // Bull bar top
    [-0.58, 0.58].forEach((bx) => {
      addCyl(carGroup, 0.036, 0.036, 0.48, 10, mats.trimBlackMat, bx, 0.9, 2.34);
    });

    // 3. Boxy Expedition Body Shell (Split around wheel wells)
    const bodyMesh = addBox(carGroup, 1.96, 0.54, 1.66, mats.paintMat, 0, 0.78, 0.02);
    addBox(carGroup, 1.98, 0.28, 4.32, mats.paintMat, 0, 1.06, 0.02);
    [-1.0, 1.0].forEach((sx) => {
      addBox(carGroup, 0.045, 0.42, 1.56, mats.paintMat, sx, 0.8, 0.02);
    });

    // 4. Utilitarian Hood + Chequer Tread Plates + Defender Mesh Grille
    addBox(carGroup, 1.72, 0.2, 1.24, mats.paintMat, 0, 1.22, 1.5, 0.03);
    [-0.64, 0.64].forEach((tx) => {
      addBox(carGroup, 0.26, 0.03, 0.92, mats.trimBlackMat, tx, 1.33, 1.5, 0.03);
    });
    addBox(carGroup, 1.9, 0.44, 0.34, mats.paintMat, 0, 0.98, 2.08);
    addBox(carGroup, 0.96, 0.36, 0.1, mats.meshGrilleMat, 0, 0.98, 2.23);
    [-0.1, 0, 0.1].forEach((gy) => {
      addBox(carGroup, 0.92, 0.03, 0.05, mats.trimBlackMat, 0, 0.98 + gy, 2.27);
    });

    // 5. Rear Body, Heavy Bumper & Tailgate Mounted Full-Size Spare Wheel
    addBox(carGroup, 1.94, 0.62, 0.48, mats.paintMat, 0, 0.94, -2.02);
    addBox(carGroup, 2.0, 0.24, 0.28, mats.trimBlackMat, 0, 0.56, -2.22);
    const spareWheel = buildModularWheel(custom, 0.44, 0.32, 0.24);
    spareWheel.rotation.y = Math.PI / 2;
    spareWheel.position.set(0, 1.18, -2.35);
    carGroup.add(spareWheel);

    // 6. Expedition Cabin, Snorkel & Tubular Roof Rack + Auxiliary LED Pods
    addBox(carGroup, 1.68, 0.56, 2.75, mats.trimBlackMat, 0, 1.48, -0.58, 0, 0, 0, false);
    addBox(carGroup, 1.66, 0.045, 0.72, mats.glassMat, 0, 1.52, 0.68, -0.3, 0, 0, false);
    [-0.86, 0.86].forEach((ax) => {
      addBox(carGroup, 0.09, 0.09, 0.74, mats.paintMat, ax, 1.52, 0.68, -0.3);
    });
    // Flat rugged safari roof
    addBox(carGroup, 1.72, 0.09, 2.58, mats.paintMat, 0, 1.84, -0.82);
    // Side windows + rugged B/C/D pillars
    [-0.87, 0.87].forEach((sx) => {
      addBox(carGroup, 0.035, 0.44, 2.38, mats.glassMat, sx, 1.5, -0.92, 0, 0, 0, false);
      addBox(carGroup, 0.08, 0.52, 0.14, mats.paintMat, sx, 1.5, -0.45);
      addBox(carGroup, 0.08, 0.52, 0.22, mats.paintMat, sx, 1.5, -1.96);
    });
    addBox(carGroup, 1.42, 0.44, 0.045, mats.glassMat, 0, 1.5, -2.18, 0, 0, 0, false);

    // Tubular Roof Rack + 4 Round CylinderGeometry LED Light Pods
    [-0.78, 0.78].forEach((rx) => {
      addCyl(carGroup, 0.03, 0.03, 2.46, 8, mats.trimBlackMat, rx, 1.94, -0.82, Math.PI / 2);
    });
    for (let z = 0.28; z >= -1.92; z -= 0.44) {
      addBox(carGroup, 1.56, 0.035, 0.055, mats.trimBlackMat, 0, 1.94, z);
    }
    [-0.48, -0.16, 0.16, 0.48].forEach((lx) => {
      addCyl(carGroup, 0.075, 0.075, 0.09, 12, mats.trimBlackMat, lx, 1.96, 0.42, Math.PI / 2);
      addCyl(carGroup, 0.06, 0.06, 0.03, 12, mats.drlMat, lx, 1.96, 0.46, Math.PI / 2, 0, 0, false);
    });

    // Raised A-pillar Safari Snorkel (CylinderGeometry stack + intake head)
    addCyl(carGroup, 0.055, 0.055, 0.85, 10, mats.trimBlackMat, 0.96, 1.46, 0.68, -0.25);
    addBox(carGroup, 0.12, 0.13, 0.17, mats.trimBlackMat, 0.96, 1.88, 0.56);

    // 7. Side Mirrors, Interior, Plates & Lighting
    buildSideMirrors(carGroup, mats.trimBlackMat, mats.trimBlackMat, 0.98, 1.32, 0.68);
    const interiorGroup = buildCockpitInterior(0.0, 1.02, new THREE.Vector3(-0.44, 1.35, 0.36));
    carGroup.add(interiorGroup);
    addLicensePlates(carGroup, [0, 0.56, 2.38], [-0.66, 0.88, -2.28]);

    // Round Defender CylinderGeometry Headlights + Turn Signals
    const headlightsGroup = new THREE.Group();
    [-0.74, 0.74].forEach((lx) => {
      addCyl(headlightsGroup, 0.125, 0.125, 0.08, 16, mats.headlightMat, lx, 1.02, 2.24, Math.PI / 2, 0, 0, false);
    });
    carGroup.add(headlightsGroup);

    const turnFrontL = addBox(carGroup, 0.1, 0.07, 0.08, mats.amberSignalMat.clone(), -0.91, 1.02, 2.21, 0, 0, 0, false);
    const turnFrontR = addBox(carGroup, 0.1, 0.07, 0.08, mats.amberSignalMat.clone(), 0.91, 1.02, 2.21, 0, 0, 0, false);
    const turnRearL = addBox(carGroup, 0.12, 0.09, 0.06, mats.amberSignalMat.clone(), -0.84, 1.15, -2.26, 0, 0, 0, false);
    const turnRearR = addBox(carGroup, 0.12, 0.09, 0.06, mats.amberSignalMat.clone(), 0.84, 1.15, -2.26, 0, 0, 0, false);

    const taillightsGroup = new THREE.Group();
    [-0.84, 0.84].forEach((lx) => {
      addBox(taillightsGroup, 0.18, 0.34, 0.07, mats.taillightMat, lx, 0.94, -2.26, 0, 0, 0, false);
    });
    carGroup.add(taillightsGroup);

    const revL = addBox(carGroup, 0.14, 0.08, 0.06, mats.reverseMat, -0.84, 0.7, -2.26, 0, 0, 0, false);
    const revR = addBox(carGroup, 0.14, 0.08, 0.06, mats.reverseMat, 0.84, 0.7, -2.26, 0, 0, 0, false);

    const { underglowLight, underglowGroup } = buildUnderglow(custom);
    carGroup.add(underglowGroup);
    const { spotL, spotR, spotGroup } = buildHeadlightSpotlights();
    spotL.position.set(-0.74, 1.02, 2.28);
    spotR.position.set(0.74, 1.02, 2.28);
    carGroup.add(spotGroup);

    // 8. Heavy-Duty All-Terrain Wheels
    const frontLeftWheel = buildModularWheel(custom, wheelR, wheelW, 0.26);
    frontLeftWheel.position.set(-trackX, wheelR, frontZ);
    const frontRightWheel = buildModularWheel(custom, wheelR, wheelW, 0.26);
    frontRightWheel.position.set(trackX, wheelR, frontZ);
    frontRightWheel.rotation.y = Math.PI;
    const rearLeftWheel = buildModularWheel(custom, wheelR, wheelW, 0.26);
    rearLeftWheel.position.set(-trackX, wheelR, rearZ);
    const rearRightWheel = buildModularWheel(custom, wheelR, wheelW, 0.26);
    rearRightWheel.position.set(trackX, wheelR, rearZ);
    rearRightWheel.rotation.y = Math.PI;
    carGroup.add(frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel);

    return {
      carGroup,
      frontLeftWheel,
      frontRightWheel,
      rearLeftWheel,
      rearRightWheel,
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
      interiorGroup,
      vehicleType: 'RUGGED_4X4',
      reverseLights: [revL, revR],
      brakeLightMats: [mats.taillightMat],
    };
  }
}
