// MANIFOLD WORLD - AUTONOMOUS LAGOS TRAFFIC AI ENGINE
// Realistic procedural traffic vehicles (Danfo, City Sedan, Urban SUV, Delivery Van)
// with right-hand-drive dual-carriageway lane discipline, bridge elevation tracking,
// car-following braking, and smooth intersection navigation across all Lagos districts.

import * as THREE from 'three';
import {
  LAGOS_ROAD_NODES,
  resolveSurfaceY,
  getBridgePitchAt,
  getTrafficSignalState,
} from './lagosCityData';

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
  isBraking: boolean;
}

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

  private wheelTireGeo: THREE.CylinderGeometry;
  private wheelRimGeo: THREE.CylinderGeometry;
  private wheelSpokeGeo: THREE.BoxGeometry;
  private tireMat: THREE.MeshStandardMaterial;
  private rimMat: THREE.MeshStandardMaterial;
  private glassMat: THREE.MeshStandardMaterial;
  private darkTrimMat: THREE.MeshStandardMaterial;
  private chromeMat: THREE.MeshStandardMaterial;
  private headLightMat: THREE.MeshBasicMaterial;

  private bodyGeos: Record<TrafficVehicleType, THREE.BufferGeometry>;
  private glassGeos: Record<TrafficVehicleType, THREE.BufferGeometry>;

  constructor() {
    this.tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85, metalness: 0.05 });
    this.rimMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.85 });
    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0x0b1f33,
      roughness: 0.08,
      metalness: 0.85,
      transparent: true,
      opacity: 0.86,
    });
    this.darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.65, metalness: 0.25 });
    this.chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.9 });
    this.headLightMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });

    this.sharedMats.push(
      this.tireMat,
      this.rimMat,
      this.glassMat,
      this.darkTrimMat,
      this.chromeMat,
      this.headLightMat
    );

    this.wheelTireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16);
    this.wheelTireGeo.rotateZ(Math.PI / 2);
    this.wheelRimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.26, 14);
    this.wheelRimGeo.rotateZ(Math.PI / 2);
    this.wheelSpokeGeo = new THREE.BoxGeometry(0.27, 0.05, 0.4);
    this.sharedGeos.push(this.wheelTireGeo, this.wheelRimGeo, this.wheelSpokeGeo);

    // Note: in createExtrudedCarShell, Shape -X = FRONT (+Z), Shape +X = REAR (-Z)
    this.bodyGeos = {
      DANFO_BUS: createExtrudedCarShell(
        [
          [-2.35, 0.34],
          [-2.32, 0.88], // Cab nose
          [-1.98, 1.48], // Raked bus windscreen
          [-1.65, 2.02], // High roof front
          [2.15, 2.02],  // Flat van roofline
          [2.32, 1.65],
          [2.36, 0.38],
        ],
        1.96,
        0.05
      ),
      CITY_SEDAN: createExtrudedCarShell(
        [
          [-2.18, 0.28],
          [-2.12, 0.62],
          [-1.25, 0.78], // Hood
          [-0.58, 1.24], // Front pillar
          [0.52, 1.26],  // Roofline
          [1.38, 0.86],  // Rear glass
          [2.08, 0.78],  // Boot deck
          [2.14, 0.32],
        ],
        1.8,
        0.045
      ),
      URBAN_SUV: createExtrudedCarShell(
        [
          [-2.3, 0.38],
          [-2.24, 0.86],
          [-1.28, 1.02], // Tall hood
          [-0.68, 1.62], // Windshield
          [1.52, 1.6],   // SUV roof
          [2.14, 1.06],  // Tailgate
          [2.22, 0.42],
        ],
        1.94,
        0.05
      ),
      DELIVERY_VAN: createExtrudedCarShell(
        [
          [-2.5, 0.36],
          [-2.42, 0.94],
          [-1.82, 1.56], // Van cab windshield
          [-1.35, 2.18], // Cargo box roof
          [2.42, 2.18],  // Rear box roof
          [2.48, 0.38],
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
          [-0.56, 1.21],
          [0.5, 1.22],
          [1.34, 0.84],
        ],
        1.58,
        0.015
      ),
      URBAN_SUV: createExtrudedCarShell(
        [
          [-1.2, 1.04],
          [-0.65, 1.56],
          [1.46, 1.54],
          [2.02, 1.08],
        ],
        1.72,
        0.015
      ),
      DELIVERY_VAN: createExtrudedCarShell(
        [
          [-2.1, 1.02],
          [-1.75, 1.58],
          [-1.1, 1.58],
          [-1.1, 1.02],
        ],
        1.86,
        0.015
      ),
    };

    Object.values(this.bodyGeos).forEach((g) => this.sharedGeos.push(g));
    Object.values(this.glassGeos).forEach((g) => this.sharedGeos.push(g));

    this.initTraffic();
  }

  private initTraffic() {
    const sedanPalette = [0x2563eb, 0xdc2626, 0x94a3b8, 0x0f766e, 0x1e293b, 0xf8fafc];
    const suvPalette = [0x334155, 0x1e3a8a, 0x064e3b, 0x78350f, 0x0f172a];

    // Spread traffic evenly across Island, TMB, Adekunle, Obalende, Ikoyi, Ikoyi Link Bridge,
    // Lekki, Ikate, Eleganza, VGC, Ajah (Flyover & Ground Underpass), Epe Bridge, Epe Town, and Mainland -> LASU
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

  private addTrafficWheel(group: THREE.Group, x: number, y: number, z: number, scale = 1.0) {
    const w = new THREE.Group();
    w.position.set(x, y, z);
    w.scale.setScalar(scale);

    const tire = new THREE.Mesh(this.wheelTireGeo, this.tireMat);
    const rim = new THREE.Mesh(this.wheelRimGeo, this.rimMat);
    const s1 = new THREE.Mesh(this.wheelSpokeGeo, this.darkTrimMat);
    const s2 = new THREE.Mesh(this.wheelSpokeGeo, this.darkTrimMat);
    s2.rotation.x = Math.PI / 2;

    w.add(tire, rim, s1, s2);
    group.add(w);
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

    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: type === 'DANFO_BUS' || type === 'DELIVERY_VAN' ? 0.38 : 0.24,
      metalness: type === 'CITY_SEDAN' || type === 'URBAN_SUV' ? 0.62 : 0.25,
    });
    this.sharedMats.push(bodyMat);

    // Sculpted extruded body shell
    const bodyMesh = new THREE.Mesh(this.bodyGeos[type], bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Recessed cabin/windshield glass
    const glassMesh = new THREE.Mesh(this.glassGeos[type], this.glassMat);
    group.add(glassMesh);

    // Front & rear bumpers + front grille
    const bumperF = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.96, 0.2, 0.16),
      this.darkTrimMat
    );
    bumperF.position.set(0, 0.34, length / 2 - 0.04);
    const bumperR = bumperF.clone();
    bumperR.position.z = -length / 2 + 0.04;

    const grille = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.48, 0.22, 0.08),
      this.darkTrimMat
    );
    grille.position.set(0, type === 'CITY_SEDAN' ? 0.5 : 0.62, length / 2 - 0.01);
    const grilleBar = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.44, 0.04, 0.1),
      this.chromeMat
    );
    grilleBar.position.copy(grille.position);
    group.add(bumperF, bumperR, grille, grilleBar);

    // Side mirrors
    [-1, 1].forEach((side) => {
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.1), this.darkTrimMat);
      mirror.position.set(
        side * (width / 2 + 0.04),
        type === 'CITY_SEDAN' ? 0.92 : 1.15,
        type === 'DANFO_BUS' ? 1.55 : 0.65
      );
      group.add(mirror);
    });

    // Danfo Signature Dual Black Racing Stripes & Roof Indicator
    if (type === 'DANFO_BUS') {
      [-0.5, 0.5].forEach((sideSign) => {
        const sign = sideSign > 0 ? 1 : -1;
        const stripeUpper = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.12, length * 0.88),
          this.darkTrimMat
        );
        stripeUpper.position.set(sign * (width / 2 - 0.01), 0.95, 0);
        const stripeLower = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.08, length * 0.88),
          this.darkTrimMat
        );
        stripeLower.position.set(sign * (width / 2 - 0.01), 0.72, 0);
        group.add(stripeUpper, stripeLower);
      });
      const destBoard = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.08), this.darkTrimMat);
      destBoard.position.set(0, 1.92, 1.72);
      group.add(destBoard);
    }

    // Delivery Van Rear Roll-up Door Seams
    if (type === 'DELIVERY_VAN') {
      const doorFrame = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.84, 1.45, 0.06),
        this.chromeMat
      );
      doorFrame.position.set(0, 1.18, -length / 2 + 0.04);
      group.add(doorFrame);
    }

    // 4 Realistic Multi-Spoke Wheels positioned inside fenders
    const wheelScale = type === 'URBAN_SUV' || type === 'DELIVERY_VAN' ? 1.06 : 0.96;
    const wheelY = 0.35 * wheelScale;
    const wheelX = width / 2 - 0.06;
    const wheelZF = type === 'DANFO_BUS' ? 1.45 : length * 0.31;
    const wheelZR = -length * 0.31;

    this.addTrafficWheel(group, -wheelX, wheelY, wheelZF, wheelScale);
    this.addTrafficWheel(group, wheelX, wheelY, wheelZF, wheelScale);
    this.addTrafficWheel(group, -wheelX, wheelY, wheelZR, wheelScale);
    this.addTrafficWheel(group, wheelX, wheelY, wheelZR, wheelScale);

    // Headlight Housings
    const headY = type === 'CITY_SEDAN' ? 0.56 : 0.68;
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), this.headLightMat);
    headL.position.set(-width * 0.34, headY, length / 2 - 0.02);
    const headR = headL.clone();
    headR.position.x = width * 0.34;
    group.add(headL, headR);

    // Tail / Brake Lights (Red Emissive)
    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0xdc2626,
      emissiveIntensity: 0.6,
      roughness: 0.2,
    });
    this.sharedMats.push(brakeMat);

    const brakeY = type === 'CITY_SEDAN' ? 0.62 : 0.72;
    const brakeL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), brakeMat);
    brakeL.position.set(-width * 0.34, brakeY, -length / 2 + 0.01);
    const brakeR = brakeL.clone();
    brakeR.position.x = width * 0.34;
    group.add(brakeL, brakeR);

    const fromNode = LAGOS_ROAD_NODES[fromId];
    const toNode = LAGOS_ROAD_NODES[toId];
    const segLen = Math.hypot(toNode.x - fromNode.x, toNode.z - fromNode.z);
    const speed =
      type === 'DANFO_BUS' ? 7.2 : type === 'DELIVERY_VAN' ? 7.6 : type === 'URBAN_SUV' ? 9.5 : 10.2;

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
      isBraking: false,
    };
  }

  public update(delta: number, playerX: number, playerZ: number, _playerSpeed: number) {
    const dt = Math.min(delta, 0.06);
    this.elapsedSec += dt;

    for (let index = 0; index < this.vehicles.length; index++) {
      const car = this.vehicles[index];
      const fromNode = LAGOS_ROAD_NODES[car.currentNodeId];
      const toNode = LAGOS_ROAD_NODES[car.targetNodeId];
      if (!fromNode || !toNode) continue;

      const dx = toNode.x - fromNode.x;
      const dz = toNode.z - fromNode.z;
      const heading = Math.atan2(dx, dz);

      // Right-hand side vector for F = (sin h, 0, cos h): F x Up = (-cos h, 0, sin h)
      // 22m dual carriageways comfortably support 2 full parallel lanes per direction (3.0m & 7.4m).
      const isDual = Boolean(fromNode.isDualCarriageway && toNode.isDualCarriageway);
      const laneOffset = isDual ? (car.laneSlot === 0 ? 3.0 : 7.4) : 3.4;
      const rightX = -Math.cos(heading);
      const rightZ = Math.sin(heading);
      const lateralX = rightX * laneOffset;
      const lateralZ = rightZ * laneOffset;

      const fwdX = Math.sin(heading);
      const fwdZ = Math.cos(heading);

      // 1. Check distance to player ahead in same lane/elevation
      let obstacleAhead = false;
      const pDx = playerX - car.x;
      const pDz = playerZ - car.z;
      const distToPlayer = Math.hypot(pDx, pDz);
      if (distToPlayer < 15) {
        const dotFwd = pDx * fwdX + pDz * fwdZ;
        const dotSide = Math.abs(pDx * rightX + pDz * rightZ);
        if (dotFwd > 0 && dotFwd < 13 && dotSide < 2.6) {
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
          if (dOther < 13 && Math.abs(other.y - car.y) < 2.2) {
            const dotFwd = oDx * fwdX + oDz * fwdZ;
            const dotSide = Math.abs(oDx * rightX + oDz * rightZ);
            if (dotFwd > 0 && dotSide < 2.3) {
              obstacleAhead = true;
              break;
            }
          }
        }
      }

      // 3. Signalized intersection compliance (ground intersections only)
      if (!obstacleAhead && (toNode.y ?? 0) < 0.5 && (fromNode.y ?? 0) < 0.5) {
        const distToJct = (1 - car.progress) * car.segmentLength;
        if (distToJct > 12 && distToJct < 25) {
          const axis: 'NS' | 'EW' = Math.abs(dx) > Math.abs(dz) ? 'EW' : 'NS';
          const sigState = getTrafficSignalState(car.targetNodeId, axis, this.elapsedSec);
          if (sigState === 'RED' || sigState === 'AMBER') {
            obstacleAhead = true;
          }
        }
      }

      // 4. Speed Adaptation
      const segLimit = Math.min(fromNode.speedLimit || 60, toNode.speedLimit || 60);
      const highwayBoost = segLimit >= 75 ? 1.28 : 1.0;
      const desiredSpeed = car.targetSpeed * highwayBoost;

      if (obstacleAhead) {
        car.isBraking = true;
        car.speed = Math.max(0, car.speed - 18 * dt);
        for (let b = 0; b < car.brakeLights.length; b++) {
          car.brakeLights[b].emissiveIntensity = 3.8;
        }
      } else {
        car.isBraking = false;
        car.speed = Math.min(desiredSpeed, car.speed + 6.5 * dt);
        for (let b = 0; b < car.brakeLights.length; b++) {
          car.brakeLights[b].emissiveIntensity = 0.55;
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
      const aOffset = aIsDual ? (car.laneSlot === 0 ? 3.0 : 7.4) : 3.4;
      const aLatX = -Math.cos(aHeading) * aOffset;
      const aLatZ = Math.sin(aHeading) * aOffset;

      const currentX = activeFrom.x + adx * car.progress + aLatX;
      const currentZ = activeFrom.z + adz * car.progress + aLatZ;
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

      car.group.position.set(currentX, currentY, currentZ);
      car.group.rotation.y = car.rotation;
      car.group.rotation.x = getBridgePitchAt(currentX, currentZ, car.rotation, currentY);
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
  }[] {
    return this.vehicles.map((car) => ({
      id: car.id,
      x: car.x,
      y: car.y,
      z: car.z,
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
  }
}
