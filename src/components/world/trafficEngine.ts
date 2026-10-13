// MANIFOLD WORLD - AUTONOMOUS LAGOS TRAFFIC AI ENGINE
// Simulates autonomous moving road traffic with lane-following, car-following spacing,
// braking for the player, intersection navigation, and collision bounding volumes.

import * as THREE from 'three';
import { LAGOS_ROAD_NODES, RoadNode } from './lagosCityData';

export type TrafficVehicleType = 'DANFO_BUS' | 'CITY_SEDAN' | 'URBAN_SUV' | 'DELIVERY_VAN';

export interface TrafficCar {
  id: string;
  type: TrafficVehicleType;
  group: THREE.Group;
  x: number;
  z: number;
  rotation: number;
  speed: number; // units/sec (~4.6 km/h per unit)
  targetSpeed: number;
  currentNodeId: string;
  targetNodeId: string;
  progress: number; // 0 to 1 along segment
  segmentLength: number;
  length: number;
  width: number;
  height: number;
  color: number;
  brakeLights: THREE.MeshStandardMaterial[];
  isBraking: boolean;
}

export class TrafficEngine {
  public vehicles: TrafficCar[] = [];
  public group: THREE.Group = new THREE.Group();
  private maxVehicles: number = 8; // Performance-conscious sweet spot for WebGL 60FPS

  constructor() {
    this.initTraffic();
  }

  private initTraffic() {
    const types: TrafficVehicleType[] = [
      'DANFO_BUS',
      'CITY_SEDAN',
      'DANFO_BUS',
      'URBAN_SUV',
      'CITY_SEDAN',
      'DELIVERY_VAN',
      'DANFO_BUS',
      'CITY_SEDAN',
    ];

    const startNodePairs = [
      { from: 'N_NORTH_GATE', to: 'N_YABA_TECH_JCT' },
      { from: 'N_EAST_AVE_1', to: 'N_EAST_AVE_2' },
      { from: 'N_SOUTH_AVE_1', to: 'N_SOUTH_GATE' },
      { from: 'N_WEST_AVE_1', to: 'N_SURULERE_MID' },
      { from: 'N_YABA_TECH_JCT', to: 'N_EAST_RING_N' },
      { from: 'N_EAST_RING_S', to: 'N_SOUTH_GATE' },
      { from: 'N_SURULERE_EXPRESS_N', to: 'N_WEST_CORNER_N' },
      { from: 'N_DEPOT_APPROACH', to: 'N_DEPOT_JCT' },
    ];

    for (let i = 0; i < this.maxVehicles; i++) {
      const pair = startNodePairs[i % startNodePairs.length];
      const type = types[i % types.length];
      const car = this.createTrafficVehicle(`traffic_${i}`, type, pair.from, pair.to, (i * 0.3) % 1);
      this.vehicles.push(car);
      this.group.add(car.group);
    }
  }

  private createTrafficVehicle(
    id: string,
    type: TrafficVehicleType,
    fromId: string,
    toId: string,
    progress: number
  ): TrafficCar {
    const group = new THREE.Group();
    let length = 4.4;
    let width = 1.9;
    let height = 1.4;
    let color = 0x3b82f6;

    if (type === 'DANFO_BUS') {
      length = 5.2;
      width = 2.1;
      height = 2.2;
      color = 0xfacc15; // Lagos Danfo Yellow
    } else if (type === 'URBAN_SUV') {
      length = 4.8;
      width = 2.0;
      height = 1.7;
      color = 0x475569;
    } else if (type === 'DELIVERY_VAN') {
      length = 5.4;
      width = 2.1;
      height = 2.4;
      color = 0xffffff;
    }

    // Vehicle Body Mesh
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.25,
    });
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), bodyMat);
    bodyMesh.position.y = height / 2 + 0.35;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Danfo Signature Black Stripes
    if (type === 'DANFO_BUS') {
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
      const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, length + 0.02), stripeMat);
      stripeL.position.set(-width / 2 - 0.02, height / 2 + 0.35, 0);
      const stripeR = stripeL.clone();
      stripeR.position.x = width / 2 + 0.02;
      group.add(stripeL, stripeR);
    }

    // Cabin Glass
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x071a2b,
      roughness: 0.1,
      metalness: 0.8,
    });
    const cabinMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.92, height * 0.55, length * 0.55),
      glassMat
    );
    cabinMesh.position.set(0, height + 0.05, -length * 0.05);
    group.add(cabinMesh);

    // Wheels (4 wheels)
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 14);
    wheelGeo.rotateZ(Math.PI / 2);

    const wFL = new THREE.Mesh(wheelGeo, wheelMat);
    wFL.position.set(-width / 2 - 0.05, 0.35, length * 0.32);
    const wFR = new THREE.Mesh(wheelGeo, wheelMat);
    wFR.position.set(width / 2 + 0.05, 0.35, length * 0.32);
    const wRL = new THREE.Mesh(wheelGeo, wheelMat);
    wRL.position.set(-width / 2 - 0.05, 0.35, -length * 0.32);
    const wRR = new THREE.Mesh(wheelGeo, wheelMat);
    wRR.position.set(width / 2 + 0.05, 0.35, -length * 0.32);
    group.add(wFL, wFR, wRL, wRR);

    // Headlights (Front White)
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfffaed });
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.08), headMat);
    headL.position.set(-width * 0.35, 0.65, length / 2 + 0.02);
    const headR = headL.clone();
    headR.position.x = width * 0.35;
    group.add(headL, headR);

    // Brake Lights (Rear Red)
    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0xdc2626,
      emissiveIntensity: 0.5,
    });
    const brakeL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.08), brakeMat);
    brakeL.position.set(-width * 0.35, 0.7, -length / 2 - 0.02);
    const brakeR = brakeL.clone();
    brakeR.position.x = width * 0.35;
    group.add(brakeL, brakeR);

    const fromNode = LAGOS_ROAD_NODES[fromId];
    const toNode = LAGOS_ROAD_NODES[toId];
    const segLen = Math.hypot(toNode.x - fromNode.x, toNode.z - fromNode.z);

    const speed = type === 'DANFO_BUS' ? 6.5 : type === 'DELIVERY_VAN' ? 7.0 : 8.5; // ~30-40 km/h

    return {
      id,
      type,
      group,
      x: fromNode.x,
      z: fromNode.z,
      rotation: 0,
      speed,
      targetSpeed: speed,
      currentNodeId: fromId,
      targetNodeId: toId,
      progress,
      segmentLength: segLen,
      length,
      width,
      height,
      color,
      brakeLights: [brakeMat],
      isBraking: false,
    };
  }

  public update(delta: number, playerX: number, playerZ: number, playerSpeed: number) {
    this.vehicles.forEach((car, index) => {
      const fromNode = LAGOS_ROAD_NODES[car.currentNodeId];
      const toNode = LAGOS_ROAD_NODES[car.targetNodeId];
      if (!fromNode || !toNode) return;

      const dx = toNode.x - fromNode.x;
      const dz = toNode.z - fromNode.z;
      const heading = Math.atan2(dx, dz);

      // Lane offset: driving on the right-hand side of the road
      const laneOffset = 3.4; // Lateral shift to stay in right-hand lane
      const lateralX = Math.cos(heading) * laneOffset;
      const lateralZ = -Math.sin(heading) * laneOffset;

      // 1. Check distance to player (Avoidance & Braking)
      const distToPlayer = Math.hypot(playerX - car.x, playerZ - car.z);
      let obstacleAhead = false;

      // Is player directly in front of this traffic car?
      if (distToPlayer < 14) {
        const dotToPlayer = (playerX - car.x) * Math.sin(heading) + (playerZ - car.z) * Math.cos(heading);
        if (dotToPlayer > 0 && distToPlayer < 12) {
          obstacleAhead = true;
        }
      }

      // 2. Check distance to other traffic cars ahead
      this.vehicles.forEach((other, otherIdx) => {
        if (index === otherIdx) return;
        const dOther = Math.hypot(other.x - car.x, other.z - car.z);
        if (dOther < 12) {
          const dotToOther = (other.x - car.x) * Math.sin(heading) + (other.z - car.z) * Math.cos(heading);
          if (dotToOther > 0) {
            obstacleAhead = true;
          }
        }
      });

      // 3. Speed Adaptation
      if (obstacleAhead) {
        car.isBraking = true;
        car.speed = Math.max(0, car.speed - 16 * delta);
        car.brakeLights.forEach((mat) => (mat.emissiveIntensity = 3.5));
      } else {
        car.isBraking = false;
        car.speed = Math.min(car.targetSpeed, car.speed + 6 * delta);
        car.brakeLights.forEach((mat) => (mat.emissiveIntensity = 0.5));
      }

      // 4. Move along segment
      if (car.segmentLength > 0) {
        car.progress += (car.speed * delta) / car.segmentLength;
      }

      // Reached target intersection node: choose next node
      if (car.progress >= 1.0) {
        car.currentNodeId = car.targetNodeId;
        const nextNode = LAGOS_ROAD_NODES[car.currentNodeId];
        if (nextNode && nextNode.neighbors.length > 0) {
          // Avoid immediately reversing back to fromNode unless dead-end
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

      // 5. Calculate interpolated world coordinates
      const currentX = fromNode.x + dx * car.progress + lateralX;
      const currentZ = fromNode.z + dz * car.progress + lateralZ;

      car.x = currentX;
      car.z = currentZ;
      car.rotation = heading;

      car.group.position.set(currentX, 0, currentZ);
      car.group.rotation.y = heading;
    });
  }

  public getTrafficBoundingBoxes(): { id: string; minX: number; maxX: number; minZ: number; maxZ: number; speed: number; x: number; z: number }[] {
    return this.vehicles.map((car) => ({
      id: car.id,
      x: car.x,
      z: car.z,
      minX: car.x - car.width / 2,
      maxX: car.x + car.width / 2,
      minZ: car.z - car.length / 2,
      maxZ: car.z + car.length / 2,
      speed: car.speed,
    }));
  }
}
