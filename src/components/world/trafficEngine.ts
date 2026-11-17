// MANIFOLD WORLD - AUTONOMOUS LAGOS TRAFFIC AI ENGINE
// High-detail procedural traffic vehicles (Danfo, City Sedan, Urban SUV, Delivery Van)
// with semi-transparent cabins & interiors, 5-spoke alloys, wheel arches, multi-element lights,
// widened right-hand-drive lane discipline, real collision knockback & per-car vertex denting.

import * as THREE from 'three';
import {
  LAGOS_ROAD_NODES,
  resolveSurfaceY,
  getBridgePitchAt,
  getTrafficSignalState,
} from './lagosCityData';
import { getVehicleTextureBank } from '../../three/vehicleTextures';
import {
  applyVehicleDent,
  createVehicleContactShadowMesh,
  markDeformable,
} from '../../three/vehicleDamage';

export type TrafficVehicleType = 'DANFO_BUS' | 'CITY_SEDAN' | 'URBAN_SUV' | 'DELIVERY_VAN';

export interface TrafficCar {
  id: string;
  type: TrafficVehicleType;
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  rotation: number;
  speed: number;
  targetSpeed: number;
  currentNodeId: string;
  targetNodeId: string;
  progress: number;
  segmentLength: number;
  laneSlot: 0 | 1; // 0 = inner lane, 1 = outer lane on dual carriageways
  length: number;
  width: number;
  height: number;
  color: number;
  brakeLights: THREE.MeshStandardMaterial[];
  wheels: THREE.Group[];
  wheelRadius: number;
  wheelSpinAngle: number;
  isBraking: boolean;
  knockX: number;
  knockZ: number;
  stunTimer: number;
}

const _hitVec = new THREE.Vector3();
const _dirVec = new THREE.Vector3();

function createExtrudedCarShell(
  points: [number, number][],
  width: number,
  bevelSize = 0.045
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.2, width - bevelSize * 2),
    bevelEnabled: true,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geo.rotateY(Math.PI / 2);
  geo.translate(-(width - bevelSize * 2) / 2, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

export class TrafficEngine {
  public vehicles: TrafficCar[] = [];
  public group: THREE.Group = new THREE.Group();
  private elapsedSec = 0;

  // Shared geometries & materials for crisp 60FPS performance across expanded world
  private sharedGeos: THREE.BufferGeometry[] = [];
  private sharedMats: THREE.Material[] = [];
  private ownedGeos: THREE.BufferGeometry[] = [];

  private wheelTireGeo: THREE.CylinderGeometry;
  private wheelSidewallGeo: THREE.TorusGeometry;
  private wheelRimGeo: THREE.CylinderGeometry;
  private wheelRotorGeo: THREE.CylinderGeometry;
  private wheelSpokeGeo: THREE.BoxGeometry;
  private wheelHubGeo: THREE.CylinderGeometry;
  private wheelArchGeo: THREE.TorusGeometry;

  private seatBaseGeo: THREE.BoxGeometry;
  private seatBackGeo: THREE.BoxGeometry;
  private dashGeo: THREE.BoxGeometry;
  private steerGeo: THREE.TorusGeometry;
  private plateBackGeo: THREE.BoxGeometry;
  private plateFaceGeo: THREE.PlaneGeometry;

  private tireMat: THREE.MeshStandardMaterial;
  private rimMat: THREE.MeshStandardMaterial;
  private darkRimMat: THREE.MeshStandardMaterial;
  private glassMat: THREE.MeshPhysicalMaterial;
  private clearLensMat: THREE.MeshPhysicalMaterial;
  private darkTrimMat: THREE.MeshStandardMaterial;
  private claddingMat: THREE.MeshStandardMaterial;
  private chromeMat: THREE.MeshStandardMaterial;
  private interiorMat: THREE.MeshStandardMaterial;
  private headLightMat: THREE.MeshStandardMaterial;
  private drlMat: THREE.MeshStandardMaterial;
  private amberMat: THREE.MeshStandardMaterial;
  private reverseMat: THREE.MeshStandardMaterial;
  private plateMat: THREE.MeshStandardMaterial;

  private bodyGeos: Record<TrafficVehicleType, THREE.BufferGeometry>;
  private glassGeos: Record<TrafficVehicleType, THREE.BufferGeometry>;

  constructor() {
    const texBank = getVehicleTextureBank();

    this.tireMat = new THREE.MeshStandardMaterial({ color: 0x11151d, roughness: 0.88, metalness: 0.04 });
    this.rimMat = new THREE.MeshStandardMaterial({ color: 0xdbe4ef, roughness: 0.18, metalness: 0.88 });
    this.darkRimMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.28, metalness: 0.82 });
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b1c2e,
      roughness: 0.06,
      metalness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      envMapIntensity: 1.85,
    });
    this.clearLensMat = new THREE.MeshPhysicalMaterial({
      color: 0xeff6ff,
      roughness: 0.05,
      metalness: 0.05,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.62, metalness: 0.25 });
    this.claddingMat = new THREE.MeshStandardMaterial({ color: 0x171c26, roughness: 0.78, metalness: 0.1 });
    this.chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.16, metalness: 0.92 });
    this.interiorMat = new THREE.MeshStandardMaterial({ color: 0x1c212b, roughness: 0.82, metalness: 0.05 });
    this.headLightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffbeb,
      emissiveIntensity: 2.0,
      roughness: 0.12,
    });
    this.drlMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe0f2fe,
      emissiveIntensity: 1.9,
      roughness: 0.1,
    });
    this.amberMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.5,
      roughness: 0.24,
    });
    this.reverseMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xffffff,
      emissiveIntensity: 0.12,
      roughness: 0.2,
    });
    this.plateMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      map: texBank?.licensePlate ?? null,
      roughness: 0.4,
    });

    this.sharedMats.push(
      this.tireMat,
      this.rimMat,
      this.darkRimMat,
      this.glassMat,
      this.clearLensMat,
      this.darkTrimMat,
      this.claddingMat,
      this.chromeMat,
      this.interiorMat,
      this.headLightMat,
      this.drlMat,
      this.amberMat,
      this.reverseMat,
      this.plateMat
    );

    // Detailed Wheel Assembly Geos (shared across all traffic vehicles)
    this.wheelTireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.26, 20);
    this.wheelTireGeo.rotateZ(Math.PI / 2);
    this.wheelSidewallGeo = new THREE.TorusGeometry(0.28, 0.068, 8, 20);
    this.wheelSidewallGeo.rotateY(Math.PI / 2);
    this.wheelRimGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.22, 18);
    this.wheelRimGeo.rotateZ(Math.PI / 2);
    this.wheelRotorGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16);
    this.wheelRotorGeo.rotateZ(Math.PI / 2);
    this.wheelSpokeGeo = new THREE.BoxGeometry(0.05, 0.036, 0.42);
    this.wheelHubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.25, 12);
    this.wheelHubGeo.rotateZ(Math.PI / 2);
    this.wheelArchGeo = new THREE.TorusGeometry(0.43, 0.055, 8, 16, Math.PI);
    this.wheelArchGeo.rotateY(Math.PI / 2);

    // Interior & License Plate shared geos
    this.seatBaseGeo = new THREE.BoxGeometry(0.46, 0.14, 0.48);
    this.seatBackGeo = new THREE.BoxGeometry(0.44, 0.48, 0.12);
    this.dashGeo = new THREE.BoxGeometry(1.48, 0.22, 0.34);
    this.steerGeo = new THREE.TorusGeometry(0.15, 0.022, 8, 16);
    this.plateBackGeo = new THREE.BoxGeometry(0.48, 0.13, 0.02);
    this.plateFaceGeo = new THREE.PlaneGeometry(0.45, 0.11);

    this.sharedGeos.push(
      this.wheelTireGeo,
      this.wheelSidewallGeo,
      this.wheelRimGeo,
      this.wheelRotorGeo,
      this.wheelSpokeGeo,
      this.wheelHubGeo,
      this.wheelArchGeo,
      this.seatBaseGeo,
      this.seatBackGeo,
      this.dashGeo,
      this.steerGeo,
      this.plateBackGeo,
      this.plateFaceGeo
    );

    // Note: in createExtrudedCarShell, Shape -X = FRONT (+Z), Shape +X = REAR (-Z)
    this.bodyGeos = {
      DANFO_BUS: createExtrudedCarShell(
        [
          [-2.35, 0.32],
          [-2.33, 0.88], // Cab nose
          [-1.98, 1.48], // Raked windscreen
          [-1.65, 2.02], // High roof front
          [2.15, 2.02],  // Flat van roofline
          [2.32, 1.65],
          [2.36, 0.36],
        ],
        1.96,
        0.05
      ),
      CITY_SEDAN: createExtrudedCarShell(
        [
          [-2.18, 0.26],
          [-2.14, 0.62],
          [-1.24, 0.78], // Hood
          [-0.56, 1.25], // Front pillar
          [0.54, 1.27],  // Roofline
          [1.38, 0.86],  // Rear glass
          [2.08, 0.79],  // Boot deck
          [2.15, 0.3],
        ],
        1.82,
        0.048
      ),
      URBAN_SUV: createExtrudedCarShell(
        [
          [-2.32, 0.36],
          [-2.25, 0.86],
          [-1.26, 1.03], // Tall hood
          [-0.66, 1.63], // Windshield
          [1.54, 1.61],  // SUV roof
          [2.15, 1.06],  // Tailgate
          [2.24, 0.4],
        ],
        1.96,
        0.05
      ),
      DELIVERY_VAN: createExtrudedCarShell(
        [
          [-2.5, 0.34],
          [-2.43, 0.94],
          [-1.82, 1.56], // Van cab windshield
          [-1.35, 2.18], // Cargo box roof
          [2.42, 2.18],  // Rear box roof
          [2.48, 0.36],
        ],
        2.02,
        0.045
      ),
    };

    this.glassGeos = {
      DANFO_BUS: createExtrudedCarShell(
        [
          [-2.04, 1.02],
          [-1.72, 1.88],
          [2.05, 1.88],
          [2.15, 1.15],
        ],
        1.98,
        0.015
      ),
      CITY_SEDAN: createExtrudedCarShell(
        [
          [-1.16, 0.82],
          [-0.56, 1.22],
          [0.52, 1.23],
          [1.34, 0.84],
        ],
        1.64,
        0.015
      ),
      URBAN_SUV: createExtrudedCarShell(
        [
          [-1.2, 1.05],
          [-0.65, 1.58],
          [1.48, 1.56],
          [2.04, 1.08],
        ],
        1.78,
        0.015
      ),
      DELIVERY_VAN: createExtrudedCarShell(
        [
          [-2.1, 1.02],
          [-1.75, 1.58],
          [-1.1, 1.58],
          [-1.1, 1.02],
        ],
        1.88,
        0.015
      ),
    };

    Object.values(this.bodyGeos).forEach((g) => this.sharedGeos.push(g));
    Object.values(this.glassGeos).forEach((g) => this.sharedGeos.push(g));

    this.initTraffic();
  }

  private initTraffic() {
    const sedanPalette = [0x2563eb, 0xdc2626, 0x94a3b8, 0x0f766e, 0x1e293b, 0xf8fafc, 0x7c2d12];
    const suvPalette = [0x334155, 0x1e3a8a, 0x064e3b, 0x78350f, 0x0f172a, 0x475569];

    const routeSeeds: { from: string; to: string; type: TrafficVehicleType; progress: number; lane: 0 | 1 }[] = [
      // Lagos Island Core
      { from: 'N_NORTH_GATE', to: 'N_YABA_TECH_JCT', type: 'DANFO_BUS', progress: 0.3, lane: 1 },
      { from: 'N_EAST_AVE_1', to: 'N_EAST_AVE_2', type: 'CITY_SEDAN', progress: 0.5, lane: 0 },
      { from: 'N_SOUTH_AVE_1', to: 'N_SOUTH_GATE', type: 'URBAN_SUV', progress: 0.25, lane: 0 },
      { from: 'N_WEST_AVE_1', to: 'N_SURULERE_MID', type: 'DELIVERY_VAN', progress: 0.6, lane: 1 },
      { from: 'N_YABA_TECH_JCT', to: 'N_EAST_RING_N', type: 'CITY_SEDAN', progress: 0.4, lane: 0 },
      { from: 'N_EAST_RING_S', to: 'N_SOUTH_GATE', type: 'DANFO_BUS', progress: 0.7, lane: 1 },
      { from: 'N_SURULERE_EXPRESS_N', to: 'N_WEST_CORNER_N', type: 'URBAN_SUV', progress: 0.5, lane: 0 },

      // Third Mainland Bridge (Two-way 2-lane-per-direction + Adekunle Off-Ramp)
      { from: 'N_YABA_TECH_JCT', to: 'N_TMB_FORK', type: 'CITY_SEDAN', progress: 0.45, lane: 0 },
      { from: 'N_TMB_SOUTH', to: 'N_TMB_MID_S', type: 'DANFO_BUS', progress: 0.35, lane: 1 },
      { from: 'N_TMB_MID_S', to: 'N_TMB_MID_N', type: 'URBAN_SUV', progress: 0.6, lane: 0 },
      { from: 'N_TMB_NORTH', to: 'N_TMB_MID_N', type: 'CITY_SEDAN', progress: 0.35, lane: 0 },
      { from: 'N_TMB_MID_S', to: 'N_TMB_SOUTH', type: 'DANFO_BUS', progress: 0.55, lane: 1 },
      { from: 'N_ADEKUNLE_EXIT', to: 'N_ADEKUNLE_RAMP', type: 'CITY_SEDAN', progress: 0.4, lane: 0 },

      // Obalende & Ikoyi
      { from: 'N_ADEKUNLE', to: 'N_OBALENDE_N', type: 'DANFO_BUS', progress: 0.35, lane: 1 },
      { from: 'N_OBALENDE_N', to: 'N_OBALENDE', type: 'DANFO_BUS', progress: 0.55, lane: 1 },
      { from: 'N_OBALENDE_S', to: 'N_OBALENDE', type: 'CITY_SEDAN', progress: 0.4, lane: 0 },
      { from: 'N_ADEKUNLE', to: 'N_IKOYI_WEST', type: 'URBAN_SUV', progress: 0.5, lane: 0 },
      { from: 'N_IKOYI_WEST', to: 'N_IKOYI_CENTER', type: 'URBAN_SUV', progress: 0.4, lane: 1 },
      { from: 'N_IKOYI_EAST', to: 'N_IKOYI_ESTATE', type: 'CITY_SEDAN', progress: 0.5, lane: 0 },
      { from: 'N_IKOYI_SOUTH_W', to: 'N_IKOYI_SOUTH_E', type: 'CITY_SEDAN', progress: 0.6, lane: 1 },

      // Ikoyi-Lekki Link Bridge & Lekki Peninsula
      { from: 'N_IKOYI_BRIDGE_W', to: 'N_IKOYI_BRIDGE_MID', type: 'URBAN_SUV', progress: 0.45, lane: 0 },
      { from: 'N_LEKKI_LINK_E', to: 'N_IKOYI_BRIDGE_MID', type: 'CITY_SEDAN', progress: 0.5, lane: 1 },
      { from: 'N_LEKKI_PHASE1', to: 'N_LEKKI_ADMIRALTY', type: 'CITY_SEDAN', progress: 0.4, lane: 0 },
      { from: 'N_LEKKI_ADMIRALTY', to: 'N_IKATE', type: 'DANFO_BUS', progress: 0.55, lane: 1 },

      // Ikate -> Eleganza -> VGC -> Ajah Flyover & Ground Underpass -> Eleko -> Epe Bridge -> Epe Town
      { from: 'N_IKATE', to: 'N_ELEGANZA', type: 'URBAN_SUV', progress: 0.35, lane: 0 },
      { from: 'N_ELEGANZA', to: 'N_VGC', type: 'DELIVERY_VAN', progress: 0.65, lane: 1 },
      { from: 'N_VGC', to: 'N_AJAH_W_APPROACH', type: 'CITY_SEDAN', progress: 0.5, lane: 0 },
      { from: 'N_AJAH_W_APPROACH', to: 'N_AJAH_FLYOVER', type: 'CITY_SEDAN', progress: 0.45, lane: 0 },
      { from: 'N_AJAH_E_APPROACH', to: 'N_AJAH_FLYOVER', type: 'URBAN_SUV', progress: 0.5, lane: 1 },
      { from: 'N_AJAH_NORTH', to: 'N_AJAH_GROUND', type: 'DANFO_BUS', progress: 0.4, lane: 1 },
      { from: 'N_AJAH_GROUND', to: 'N_AJAH_BADORE_S', type: 'CITY_SEDAN', progress: 0.5, lane: 0 },
      { from: 'N_AJAH_E_APPROACH', to: 'N_ELEKO_RD', type: 'DELIVERY_VAN', progress: 0.45, lane: 1 },
      { from: 'N_EPE_BRIDGE_W', to: 'N_EPE_BRIDGE_MID', type: 'URBAN_SUV', progress: 0.4, lane: 0 },
      { from: 'N_EPE_BRIDGE_E', to: 'N_EPE_BRIDGE_MID', type: 'CITY_SEDAN', progress: 0.6, lane: 1 },
      { from: 'N_EPE_TOWN', to: 'N_EPE_WATERFRONT', type: 'DANFO_BUS', progress: 0.45, lane: 1 },

      // Iyana-Oworo, Oshodi & Ikeja
      { from: 'N_IYANA_OWORO', to: 'N_OSHODI_EAST', type: 'DANFO_BUS', progress: 0.3, lane: 1 },
      { from: 'N_OSHODI', to: 'N_OSHODI_EAST', type: 'CITY_SEDAN', progress: 0.5, lane: 0 },
      { from: 'N_IYANA_OWORO', to: 'N_IKEJA_SOUTH', type: 'URBAN_SUV', progress: 0.45, lane: 0 },
      { from: 'N_IKEJA', to: 'N_IKEJA_WEST', type: 'CITY_SEDAN', progress: 0.6, lane: 0 },
      { from: 'N_IKEJA_SOUTH', to: 'N_ALAUSA_LINK', type: 'DELIVERY_VAN', progress: 0.5, lane: 1 },

      // Iyana Ipaja, Egbeda, Igando, Akesan, LASU
      { from: 'N_IKEJA_WEST', to: 'N_IYANA_IPAJA', type: 'DANFO_BUS', progress: 0.4, lane: 1 },
      { from: 'N_IYANA_IPAJA', to: 'N_EGBEDA', type: 'URBAN_SUV', progress: 0.5, lane: 0 },
      { from: 'N_EGBEDA', to: 'N_IGANDO', type: 'DANFO_BUS', progress: 0.35, lane: 1 },
      { from: 'N_IGANDO', to: 'N_AKESAN', type: 'CITY_SEDAN', progress: 0.65, lane: 0 },
      { from: 'N_AKESAN', to: 'N_LASU_GATE', type: 'DANFO_BUS', progress: 0.45, lane: 1 },
      { from: 'N_OSHODI', to: 'N_AKESAN_LINK', type: 'DELIVERY_VAN', progress: 0.5, lane: 1 },
    ];

    routeSeeds.forEach((seed, i) => {
      if (!LAGOS_ROAD_NODES[seed.from] || !LAGOS_ROAD_NODES[seed.to]) return;
      const customColor =
        seed.type === 'DANFO_BUS'
          ? 0xfacc15
          : seed.type === 'DELIVERY_VAN'
          ? 0xf8fafc
          : seed.type === 'URBAN_SUV'
          ? suvPalette[i % suvPalette.length]
          : sedanPalette[i % sedanPalette.length];

      const car = this.createTrafficVehicle(
        `traffic_${i}`,
        seed.type,
        seed.from,
        seed.to,
        seed.progress,
        seed.lane,
        customColor
      );
      this.vehicles.push(car);
      this.group.add(car.group);
    });
  }

  private addTrafficWheel(
    group: THREE.Group,
    x: number,
    y: number,
    z: number,
    scale = 1.0,
    isDarkAlloy = false
  ): THREE.Group {
    const spinGroup = new THREE.Group();
    spinGroup.position.set(x, y, z);
    spinGroup.scale.setScalar(scale);

    const isRightSide = x > 0;
    const faceSign = isRightSide ? 1 : -1;

    const tire = new THREE.Mesh(this.wheelTireGeo, this.tireMat);
    const sidewall = new THREE.Mesh(this.wheelSidewallGeo, this.tireMat);
    sidewall.position.x = faceSign * 0.08;
    const rotor = new THREE.Mesh(this.wheelRotorGeo, this.chromeMat);
    rotor.position.x = faceSign * 0.02;

    const rimMat = isDarkAlloy ? this.darkRimMat : this.rimMat;
    const rim = new THREE.Mesh(this.wheelRimGeo, rimMat);
    const hub = new THREE.Mesh(this.wheelHubGeo, rimMat);
    spinGroup.add(tire, sidewall, rotor, rim, hub);

    // 5-spoke radial alloy geometry
    for (let s = 0; s < 5; s++) {
      const spoke = new THREE.Mesh(this.wheelSpokeGeo, rimMat);
      spoke.position.x = faceSign * 0.115;
      spoke.rotation.x = (s * Math.PI * 2) / 5;
      spinGroup.add(spoke);
    }

    // Protective wheel arch flare mounted on car group just above wheel
    const arch = new THREE.Mesh(this.wheelArchGeo, this.claddingMat);
    arch.position.set(x + faceSign * 0.04, y + 0.05, z);
    arch.scale.setScalar(scale);
    group.add(arch, spinGroup);

    return spinGroup;
  }

  private addSeatAndInterior(
    group: THREE.Group,
    type: TrafficVehicleType,
    isDarkCar: boolean
  ) {
    const seatY = type === 'CITY_SEDAN' ? 0.56 : 0.74;
    const frontZ = type === 'DANFO_BUS' ? 1.15 : type === 'DELIVERY_VAN' ? 1.45 : 0.15;
    const rearZ = type === 'DANFO_BUS' ? -0.35 : -0.68;

    const dash = new THREE.Mesh(this.dashGeo, this.darkTrimMat);
    dash.position.set(0, seatY + 0.25, frontZ + 0.42);
    group.add(dash);

    const steer = new THREE.Mesh(this.steerGeo, this.darkTrimMat);
    steer.position.set(-0.36, seatY + 0.34, frontZ + 0.26);
    steer.rotation.x = 0.35;
    group.add(steer);

    [-0.36, 0.36].forEach((sx) => {
      const baseF = new THREE.Mesh(this.seatBaseGeo, this.interiorMat);
      baseF.position.set(sx, seatY, frontZ);
      const backF = new THREE.Mesh(this.seatBackGeo, this.interiorMat);
      backF.position.set(sx, seatY + 0.25, frontZ - 0.18);
      backF.rotation.x = -0.18;
      group.add(baseF, backF);

      if (type !== 'DELIVERY_VAN') {
        const baseR = new THREE.Mesh(this.seatBaseGeo, this.interiorMat);
        baseR.position.set(sx, seatY, rearZ);
        const backR = new THREE.Mesh(this.seatBackGeo, this.interiorMat);
        backR.position.set(sx, seatY + 0.25, rearZ - 0.18);
        backR.rotation.x = -0.15;
        group.add(baseR, backR);
      }
    });

    if (isDarkCar && type !== 'DANFO_BUS') {
      // Subtle B-pillar frame between side windows
      [-0.81, 0.81].forEach((px) => {
        const bp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, 0.1), this.darkTrimMat);
        bp.position.set(px, type === 'CITY_SEDAN' ? 1.02 : 1.28, -0.05);
        this.ownedGeos.push(bp.geometry);
        group.add(bp);
      });
    }
  }

  private createTrafficVehicle(
    id: string,
    type: TrafficVehicleType,
    fromId: string,
    toId: string,
    progress: number,
    laneSlot: 0 | 1,
    color: number
  ): TrafficCar {
    const group = new THREE.Group();
    group.rotation.order = 'YXZ';
    let length = 4.4;
    let width = 1.9;
    let height = 1.32;

    if (type === 'DANFO_BUS') {
      length = 4.8;
      width = 2.02;
      height = 2.05;
    } else if (type === 'URBAN_SUV') {
      length = 4.65;
      width = 2.0;
      height = 1.68;
    } else if (type === 'DELIVERY_VAN') {
      length = 5.1;
      width = 2.08;
      height = 2.2;
    }

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color,
      roughness: type === 'DANFO_BUS' || type === 'DELIVERY_VAN' ? 0.34 : 0.18,
      metalness: type === 'CITY_SEDAN' || type === 'URBAN_SUV' ? 0.65 : 0.22,
      clearcoat: type === 'CITY_SEDAN' || type === 'URBAN_SUV' ? 0.9 : 0.35,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.5,
    });
    this.sharedMats.push(bodyMat);

    // Ground contact shadow
    group.add(createVehicleContactShadowMesh(width * 1.22, length * 1.12, 0.015));

    // Sculpted extruded body shell (tagged deformable so collisions dent this car lazily)
    const bodyMesh = markDeformable(new THREE.Mesh(this.bodyGeos[type], bodyMat), 1.15);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Recessed cabin/windshield glass + realistic seats & steering wheel inside
    const glassMesh = new THREE.Mesh(this.glassGeos[type], this.glassMat);
    group.add(glassMesh);
    this.addSeatAndInterior(group, type, type === 'CITY_SEDAN' || type === 'URBAN_SUV');

    // Front & rear bumpers + front splitter / lower grille + rear diffuser & exhausts
    const bumperFGeo = new THREE.BoxGeometry(width * 0.96, 0.22, 0.18);
    const bumperRGeo = new THREE.BoxGeometry(width * 0.96, 0.22, 0.18);
    this.ownedGeos.push(bumperFGeo, bumperRGeo);

    const bumperF = markDeformable(new THREE.Mesh(bumperFGeo, this.claddingMat), 1.0);
    bumperF.position.set(0, 0.34, length / 2 - 0.03);
    const bumperR = markDeformable(new THREE.Mesh(bumperRGeo, this.claddingMat), 1.0);
    bumperR.position.set(0, 0.36, -length / 2 + 0.03);

    const grilleGeo = new THREE.BoxGeometry(width * 0.52, 0.24, 0.08);
    const grilleBarGeo = new THREE.BoxGeometry(width * 0.48, 0.038, 0.1);
    const exhaustGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.14, 10);
    exhaustGeo.rotateX(Math.PI / 2);
    this.ownedGeos.push(grilleGeo, grilleBarGeo, exhaustGeo);

    const grille = markDeformable(new THREE.Mesh(grilleGeo, this.darkTrimMat), 0.8);
    grille.position.set(0, type === 'CITY_SEDAN' ? 0.5 : 0.62, length / 2 - 0.01);
    const grilleBar = new THREE.Mesh(grilleBarGeo, this.chromeMat);
    grilleBar.position.copy(grille.position);
    group.add(bumperF, bumperR, grille, grilleBar);

    const exOffsets = type === 'CITY_SEDAN' || type === 'URBAN_SUV' ? [-0.54, 0.54] : [-0.52];
    exOffsets.forEach((ex) => {
      const tip = new THREE.Mesh(exhaustGeo, this.chromeMat);
      tip.position.set(ex, 0.25, -length / 2 - 0.03);
      group.add(tip);
    });

    // Wing mirrors with chrome reflective backs & painted door handles
    const mirrorGeo = new THREE.BoxGeometry(0.15, 0.09, 0.1);
    const mirrorFaceGeo = new THREE.BoxGeometry(0.12, 0.065, 0.02);
    const handleGeo = new THREE.BoxGeometry(0.03, 0.032, 0.14);
    this.ownedGeos.push(mirrorGeo, mirrorFaceGeo, handleGeo);

    [-1, 1].forEach((side) => {
      const mirrorMat = type === 'CITY_SEDAN' || type === 'URBAN_SUV' ? bodyMat : this.darkTrimMat;
      const mirror = new THREE.Mesh(mirrorGeo, mirrorMat);
      mirror.position.set(
        side * (width / 2 + 0.05),
        type === 'CITY_SEDAN' ? 0.92 : 1.15,
        type === 'DANFO_BUS' ? 1.55 : 0.65
      );
      const face = new THREE.Mesh(mirrorFaceGeo, this.chromeMat);
      face.position.set(mirror.position.x, mirror.position.y, mirror.position.z - 0.045);
      group.add(mirror, face);

      const hFront = new THREE.Mesh(handleGeo, this.chromeMat);
      hFront.position.set(
        side * (width / 2 - 0.01),
        type === 'CITY_SEDAN' ? 0.74 : 0.95,
        type === 'DANFO_BUS' ? 0.95 : 0.15
      );
      group.add(hFront);
      if (type === 'CITY_SEDAN' || type === 'URBAN_SUV') {
        const hRear = new THREE.Mesh(handleGeo, this.chromeMat);
        hRear.position.set(side * (width / 2 - 0.01), hFront.position.y, -0.7);
        group.add(hRear);
      }
    });

    // License plates front & rear
    const fBack = new THREE.Mesh(this.plateBackGeo, this.darkTrimMat);
    fBack.position.set(0, 0.34, length / 2 + 0.06);
    const fFace = new THREE.Mesh(this.plateFaceGeo, this.plateMat);
    fFace.position.set(0, 0.34, length / 2 + 0.072);

    const rBack = new THREE.Mesh(this.plateBackGeo, this.darkTrimMat);
    rBack.position.set(0, type === 'CITY_SEDAN' ? 0.56 : 0.68, -length / 2 + 0.02);
    const rFace = new THREE.Mesh(this.plateFaceGeo, this.plateMat);
    rFace.position.set(0, rBack.position.y, -length / 2 + 0.008);
    rFace.rotation.y = Math.PI;
    group.add(fBack, fFace, rBack, rFace);

    // Danfo Signature Dual Black Racing Stripes, Roof Rack & Route Board
    if (type === 'DANFO_BUS') {
      const sU = new THREE.BoxGeometry(0.03, 0.12, length * 0.88);
      const sL = new THREE.BoxGeometry(0.03, 0.08, length * 0.88);
      const rackRail = new THREE.BoxGeometry(0.05, 0.06, 2.8);
      const boardGeo = new THREE.BoxGeometry(1.16, 0.2, 0.09);
      this.ownedGeos.push(sU, sL, rackRail, boardGeo);

      [-1, 1].forEach((sign) => {
        const stripeUpper = new THREE.Mesh(sU, this.darkTrimMat);
        stripeUpper.position.set(sign * (width / 2 - 0.01), 0.95, 0);
        const stripeLower = new THREE.Mesh(sL, this.darkTrimMat);
        stripeLower.position.set(sign * (width / 2 - 0.01), 0.72, 0);
        const rail = new THREE.Mesh(rackRail, this.darkTrimMat);
        rail.position.set(sign * 0.72, 2.08, -0.2);
        group.add(stripeUpper, stripeLower, rail);
      });
      const destBoard = new THREE.Mesh(boardGeo, this.darkTrimMat);
      destBoard.position.set(0, 1.92, 1.72);
      const routeStrip = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.09, 0.02), this.amberMat);
      routeStrip.position.set(0, 1.92, 1.77);
      this.ownedGeos.push(routeStrip.geometry);
      group.add(destBoard, routeStrip);
    }

    // Delivery Van Rear Roll-up Door Seams + Amber Roof Markers
    if (type === 'DELIVERY_VAN') {
      const doorFrame = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.84, 1.45, 0.06),
        this.chromeMat
      );
      doorFrame.position.set(0, 1.18, -length / 2 + 0.04);
      this.ownedGeos.push(doorFrame.geometry);
      group.add(doorFrame);
    }

    // 4 Realistic 5-Spoke Wheels with Arch Flares
    const wheelScale = type === 'URBAN_SUV' || type === 'DELIVERY_VAN' ? 1.07 : 0.96;
    const wheelRadius = 0.35 * wheelScale;
    const wheelX = width / 2 - 0.06;
    const wheelZF = type === 'DANFO_BUS' ? 1.45 : length * 0.31;
    const wheelZR = -length * 0.31;
    const useDarkRims = type === 'URBAN_SUV';

    const wheels = [
      this.addTrafficWheel(group, -wheelX, wheelRadius, wheelZF, wheelScale, useDarkRims),
      this.addTrafficWheel(group, wheelX, wheelRadius, wheelZF, wheelScale, useDarkRims),
      this.addTrafficWheel(group, -wheelX, wheelRadius, wheelZR, wheelScale, useDarkRims),
      this.addTrafficWheel(group, wheelX, wheelRadius, wheelZR, wheelScale, useDarkRims),
    ];

    // Multi-Element Headlight Housings (LED core + DRL bar + clear lens)
    const headY = type === 'CITY_SEDAN' ? 0.56 : 0.68;
    const headCoreGeo = new THREE.BoxGeometry(0.3, 0.1, 0.07);
    const drlGeo = new THREE.BoxGeometry(0.32, 0.025, 0.08);
    const lensGeo = new THREE.BoxGeometry(0.34, 0.14, 0.09);
    this.ownedGeos.push(headCoreGeo, drlGeo, lensGeo);

    [-1, 1].forEach((side) => {
      const hx = side * width * 0.34;
      const head = new THREE.Mesh(headCoreGeo, this.headLightMat);
      head.position.set(hx, headY, length / 2 - 0.02);
      const drl = new THREE.Mesh(drlGeo, this.drlMat);
      drl.position.set(hx, headY - 0.055, length / 2 - 0.015);
      const lens = new THREE.Mesh(lensGeo, this.clearLensMat);
      lens.position.set(hx, headY - 0.01, length / 2);
      group.add(head, drl, lens);
    });

    // Tail / Brake Lights + Amber Indicators + Reverse Lenses
    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0xdc2626,
      emissiveIntensity: 0.65,
      roughness: 0.18,
    });
    this.sharedMats.push(brakeMat);

    const brakeY = type === 'CITY_SEDAN' ? 0.63 : 0.74;
    const brakeGeo = new THREE.BoxGeometry(0.34, 0.11, 0.08);
    const amberGeo = new THREE.BoxGeometry(0.16, 0.04, 0.07);
    const revGeo = new THREE.BoxGeometry(0.14, 0.04, 0.07);
    this.ownedGeos.push(brakeGeo, amberGeo, revGeo);

    [-1, 1].forEach((side) => {
      const bx = side * width * 0.34;
      const brake = new THREE.Mesh(brakeGeo, brakeMat);
      brake.position.set(bx, brakeY, -length / 2 + 0.01);
      const amb = new THREE.Mesh(amberGeo, this.amberMat);
      amb.position.set(bx, brakeY - 0.065, -length / 2 + 0.01);
      const rev = new THREE.Mesh(revGeo, this.reverseMat);
      rev.position.set(bx * 0.72, brakeY - 0.065, -length / 2 + 0.01);
      group.add(brake, amb, rev);
    });

    const fromNode = LAGOS_ROAD_NODES[fromId];
    const toNode = LAGOS_ROAD_NODES[toId];
    const segLen = Math.hypot(toNode.x - fromNode.x, toNode.z - fromNode.z);
    const speed =
      type === 'DANFO_BUS' ? 7.8 : type === 'DELIVERY_VAN' ? 8.2 : type === 'URBAN_SUV' ? 10.2 : 11.2;

    const initY = (fromNode.y ?? 0) + ((toNode.y ?? 0) - (fromNode.y ?? 0)) * progress;
    return {
      id,
      type,
      group,
      x: fromNode.x,
      y: resolveSurfaceY(fromNode.x, fromNode.z, initY),
      z: fromNode.z,
      rotation: Math.atan2(toNode.x - fromNode.x, toNode.z - fromNode.z),
      speed,
      targetSpeed: speed,
      currentNodeId: fromId,
      targetNodeId: toId,
      progress,
      segmentLength: segLen,
      laneSlot,
      length,
      width,
      height,
      color,
      brakeLights: [brakeMat],
      wheels,
      wheelRadius,
      wheelSpinAngle: 0,
      isBraking: false,
      knockX: 0,
      knockZ: 0,
      stunTimer: 0,
    };
  }

  /**
   * Called by collision resolution when player impacts this traffic car:
   * pushes the traffic vehicle physically, brakes it briefly, and dents its exterior shell.
   */
  public applyImpactAndDent(
    id: string,
    pushX: number,
    pushZ: number,
    hitX: number,
    hitZ: number,
    severity: number
  ): void {
    const car = this.vehicles.find((v) => v.id === id);
    if (!car) return;

    car.knockX += pushX;
    car.knockZ += pushZ;
    car.x += pushX;
    car.z += pushZ;
    car.speed *= 0.25;
    car.stunTimer = Math.max(car.stunTimer, 1.35);

    if (severity > 0.05) {
      _hitVec.set(hitX, car.y + car.height * 0.42, hitZ);
      _dirVec.set(car.x - hitX, -0.08, car.z - hitZ);
      if (_dirVec.lengthSq() < 1e-4) _dirVec.set(pushX, -0.05, pushZ);
      if (_dirVec.lengthSq() < 1e-4) _dirVec.set(0, 0, 1);

      car.group.position.set(car.x, car.y, car.z);
      car.group.rotation.y = car.rotation;
      applyVehicleDent(car.group, _hitVec, _dirVec, severity, {
        lazyClone: true,
        ownedGeos: this.ownedGeos,
      });
    }
  }

  public update(
    delta: number,
    playerX: number,
    playerZ: number,
    _playerSpeed: number,
    cullDistance = 320
  ) {
    const dt = Math.min(delta, 0.06);
    this.elapsedSec += dt;
    const cullDistSq = cullDistance * cullDistance;

    for (let index = 0; index < this.vehicles.length; index++) {
      const car = this.vehicles[index];
      const fromNode = LAGOS_ROAD_NODES[car.currentNodeId];
      const toNode = LAGOS_ROAD_NODES[car.targetNodeId];
      if (!fromNode || !toNode) continue;

      const dx = toNode.x - fromNode.x;
      const dz = toNode.z - fromNode.z;
      const heading = Math.atan2(dx, dz);

      // Right-hand side vector for F = (sin h, 0, cos h): F x Up = (-cos h, 0, sin h)
      // Widened 27.6m dual carriageways support 2 spacious lanes per direction (3.8m & 9.2m).
      const isDual = Boolean(fromNode.isDualCarriageway && toNode.isDualCarriageway);
      const laneOffset = isDual ? (car.laneSlot === 0 ? 3.8 : 9.2) : 4.3;
      const rightX = -Math.cos(heading);
      const rightZ = Math.sin(heading);

      const fwdX = Math.sin(heading);
      const fwdZ = Math.cos(heading);

      // Decay any collision displacement smoothly as the traffic driver recovers lane control
      if (Math.abs(car.knockX) > 0.005 || Math.abs(car.knockZ) > 0.005) {
        const decay = Math.exp(-dt * 1.4);
        car.knockX *= decay;
        car.knockZ *= decay;
      } else {
        car.knockX = 0;
        car.knockZ = 0;
      }
      if (car.stunTimer > 0) {
        car.stunTimer = Math.max(0, car.stunTimer - dt);
      }

      // 1. Check distance to player ahead in same lane/elevation
      let obstacleAhead = car.stunTimer > 0.35;
      const pDx = playerX - car.x;
      const pDz = playerZ - car.z;
      const distToPlayer = Math.hypot(pDx, pDz);
      if (!obstacleAhead && distToPlayer < 16) {
        const dotFwd = pDx * fwdX + pDz * fwdZ;
        const dotSide = Math.abs(pDx * rightX + pDz * rightZ);
        if (dotFwd > 0 && dotFwd < 14 && dotSide < 2.8) {
          obstacleAhead = true;
        }
      }

      // 2. Check distance to other traffic cars ahead in same lane & elevation
      if (!obstacleAhead) {
        for (let otherIdx = 0; otherIdx < this.vehicles.length; otherIdx++) {
          if (index === otherIdx) continue;
          const other = this.vehicles[otherIdx];
          const oDx = other.x - car.x;
          const oDz = other.z - car.z;
          const dOther = Math.hypot(oDx, oDz);
          if (dOther < 14 && Math.abs(other.y - car.y) < 2.2) {
            const dotFwd = oDx * fwdX + oDz * fwdZ;
            const dotSide = Math.abs(oDx * rightX + oDz * rightZ);
            if (dotFwd > 0 && dotSide < 2.5) {
              obstacleAhead = true;
              break;
            }
          }
        }
      }

      // 3. Signalized intersection compliance (ground intersections only)
      if (!obstacleAhead && (toNode.y ?? 0) < 0.5 && (fromNode.y ?? 0) < 0.5) {
        const distToJct = (1 - car.progress) * car.segmentLength;
        if (distToJct > 12 && distToJct < 26) {
          const axis: 'NS' | 'EW' = Math.abs(dx) > Math.abs(dz) ? 'EW' : 'NS';
          const sigState = getTrafficSignalState(car.targetNodeId, axis, this.elapsedSec);
          if (sigState === 'RED' || sigState === 'AMBER') {
            obstacleAhead = true;
          }
        }
      }

      // 4. Speed Adaptation
      const segLimit = Math.min(fromNode.speedLimit || 60, toNode.speedLimit || 60);
      const highwayBoost = segLimit >= 75 ? 1.32 : 1.0;
      const desiredSpeed = car.targetSpeed * highwayBoost;

      if (obstacleAhead) {
        car.isBraking = true;
        car.speed = Math.max(0, car.speed - 20 * dt);
        for (let b = 0; b < car.brakeLights.length; b++) {
          car.brakeLights[b].emissiveIntensity = 4.0;
        }
      } else {
        car.isBraking = false;
        car.speed = Math.min(desiredSpeed, car.speed + 7.2 * dt);
        for (let b = 0; b < car.brakeLights.length; b++) {
          car.brakeLights[b].emissiveIntensity = 0.6;
        }
      }

      // 5. Advance along segment
      if (car.segmentLength > 0) {
        car.progress += (car.speed * dt) / car.segmentLength;
      }

      // Reached intersection node: choose next node without U-turning unless dead-end
      if (car.progress >= 1.0) {
        car.currentNodeId = car.targetNodeId;
        const nextNode = LAGOS_ROAD_NODES[car.currentNodeId];
        if (nextNode && nextNode.neighbors.length > 0) {
          const eligible = nextNode.neighbors.filter((n) => n !== fromNode.id);
          const nextChoice =
            eligible.length > 0
              ? eligible[Math.floor(Math.random() * eligible.length)]
              : nextNode.neighbors[0];

          car.targetNodeId = nextChoice;
          const nextTarget = LAGOS_ROAD_NODES[nextChoice];
          car.segmentLength = Math.hypot(nextTarget.x - nextNode.x, nextTarget.z - nextNode.z);
          car.progress = 0;
        }
      }

      // 6. Interpolate world coordinates + level-aware bridge deck height + ramp pitch
      const activeFrom = LAGOS_ROAD_NODES[car.currentNodeId] || fromNode;
      const activeTo = LAGOS_ROAD_NODES[car.targetNodeId] || toNode;
      const adx = activeTo.x - activeFrom.x;
      const adz = activeTo.z - activeFrom.z;
      const aHeading = Math.atan2(adx, adz);
      const aIsDual = Boolean(activeFrom.isDualCarriageway && activeTo.isDualCarriageway);
      const aOffset = aIsDual ? (car.laneSlot === 0 ? 3.8 : 9.2) : 4.3;
      const aLatX = -Math.cos(aHeading) * aOffset;
      const aLatZ = Math.sin(aHeading) * aOffset;

      const currentX = activeFrom.x + adx * car.progress + aLatX + car.knockX;
      const currentZ = activeFrom.z + adz * car.progress + aLatZ + car.knockZ;
      const approxY = (activeFrom.y ?? 0) + ((activeTo.y ?? 0) - (activeFrom.y ?? 0)) * car.progress;
      const currentY = resolveSurfaceY(currentX, currentZ, approxY);

      // Smooth yaw transition at corners
      let yawDiff = aHeading - car.rotation;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      car.rotation += yawDiff * Math.min(1, dt * 8);

      car.x = currentX;
      car.y = currentY;
      car.z = currentZ;

      const distSqToFocus = (currentX - playerX) * (currentX - playerX) + (currentZ - playerZ) * (currentZ - playerZ);
      const isVisible = distSqToFocus <= cullDistSq;
      if (car.group.visible !== isVisible) {
        car.group.visible = isVisible;
      }
      if (isVisible) {
        car.wheelSpinAngle += (car.speed * dt) / car.wheelRadius;
        for (let w = 0; w < car.wheels.length; w++) {
          car.wheels[w].rotation.x = car.wheelSpinAngle;
        }
        car.group.position.set(currentX, currentY, currentZ);
        car.group.rotation.y = car.rotation;
        car.group.rotation.x = getBridgePitchAt(currentX, currentZ, car.rotation, currentY);
      }
    }
  }

  public getTrafficBoundingBoxes(): {
    id: string;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    speed: number;
    x: number;
    y: number;
    z: number;
    width: number;
    length: number;
    rotation: number;
  }[] {
    return this.vehicles.map((car) => ({
      id: car.id,
      x: car.x,
      y: car.y,
      z: car.z,
      width: car.width,
      length: car.length,
      rotation: car.rotation,
      minX: car.x - car.width / 2,
      maxX: car.x + car.width / 2,
      minZ: car.z - car.length / 2,
      maxZ: car.z + car.length / 2,
      speed: car.speed,
    }));
  }

  public dispose() {
    this.sharedGeos.forEach((g) => g.dispose());
    this.sharedMats.forEach((m) => m.dispose());
    this.ownedGeos.forEach((g) => g.dispose());
    this.ownedGeos = [];
  }
}
