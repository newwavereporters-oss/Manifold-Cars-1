// MANIFOLD WORLD - COMPUTER-CONTROLLED RIVAL DRIVERS ENGINE
// Controls autonomous rival racers along the Surulere & Yaba street race circuit
// with tuned GT aero specs, surface elevation tracking, and real collision denting.

import * as THREE from 'three';
import {
  RIVAL_RACE_CHECKPOINTS,
  resolveSurfaceY,
  getBridgePitchAt,
} from './lagosCityData';
import { createVehicleByType, CarCustomization, Vehicle3DResult } from './worldModels';
import { animateVehicleModel } from '../../three/VehicleModelFactory';
import { applyVehicleDent, resetVehicleDamage } from '../../three/vehicleDamage';
import { disposeObject3D } from '../../utils/webglPerformance';

export interface RivalDriver {
  id: string;
  name: string;
  carName: string;
  vehicleType: 'SPORTS_COUPE' | 'LUXURY_SUV' | 'EXECUTIVE_SEDAN';
  paintColor: string;
  group: THREE.Group;
  vehicle: Vehicle3DResult;
  wheelSpinAngle: number;
  x: number;
  y: number;
  z: number;
  width: number;
  length: number;
  rotation: number;
  speed: number;
  maxSpeed: number; // units/sec
  accel: number;
  cornerSpeed: number;
  currentCheckpointIdx: number;
  lapsCompleted: number;
  distanceToNextCP: number;
  isFinished: boolean;
  finishTime: number | null;
  gridOffsetX: number;
  gridOffsetZ: number;
}

const _hitVec = new THREE.Vector3();
const _dirVec = new THREE.Vector3();

export class RivalsEngine {
  public rivals: RivalDriver[] = [];
  public group: THREE.Group = new THREE.Group();
  public isRaceActive: boolean = false;
  private raceStartTime: number = 0;

  constructor() {
    this.initRivals();
  }

  private initRivals() {
    const rivalConfigs: {
      id: string;
      name: string;
      carName: string;
      vehicleType: 'SPORTS_COUPE' | 'LUXURY_SUV' | 'EXECUTIVE_SEDAN';
      paintColor: string;
      rimColor: string;
      caliperColor: string;
      spoiler: CarCustomization['spoiler'];
      interiorTheme: CarCustomization['interiorTheme'];
      width: number;
      length: number;
      maxSpeed: number;
      accel: number;
      cornerSpeed: number;
      gridOffsetX: number;
      gridOffsetZ: number;
    }[] = [
      {
        id: 'rival_tariq',
        name: 'Tariq',
        carName: 'MANIFOLD GT Competizione (Track Spec)',
        vehicleType: 'SPORTS_COUPE',
        paintColor: '#DC2626', // Rosso Corsa Metallic
        rimColor: '#1E293B', // Satin Gunmetal
        caliperColor: '#FACC15', // Gold Ceramic Calipers
        spoiler: 'GT_WING',
        interiorTheme: 'SPORT',
        width: 1.9,
        length: 4.35,
        maxSpeed: 40, // ~185 km/h
        accel: 21,
        cornerSpeed: 19,
        gridOffsetX: -4.2,
        gridOffsetZ: -4.5,
      },
      {
        id: 'rival_chidi',
        name: 'Chidi',
        carName: 'Apex Vanguard Bi-Turbo',
        vehicleType: 'LUXURY_SUV',
        paintColor: '#1D4ED8', // Monaco Metallic Blue
        rimColor: '#E2E8F0', // Machined Alloy
        caliperColor: '#EF233C',
        spoiler: 'NONE',
        interiorTheme: 'BROWN',
        width: 2.06,
        length: 4.82,
        maxSpeed: 36, // ~165 km/h
        accel: 18,
        cornerSpeed: 16,
        gridOffsetX: 4.2,
        gridOffsetZ: -8.5,
      },
      {
        id: 'rival_amara',
        name: 'Amara',
        carName: 'Prestige Sovereign GT-Line',
        vehicleType: 'EXECUTIVE_SEDAN',
        paintColor: '#0F172A', // Midnight Carbon
        rimColor: '#D4AF37', // Champagne Gold
        caliperColor: '#10B981',
        spoiler: 'DUCKTAIL',
        interiorTheme: 'CREAM',
        width: 1.92,
        length: 4.7,
        maxSpeed: 38, // ~175 km/h
        accel: 19,
        cornerSpeed: 20,
        gridOffsetX: -4.2,
        gridOffsetZ: -12.5,
      },
    ];

    rivalConfigs.forEach((cfg) => {
      const custom: CarCustomization = {
        vehicleType: cfg.vehicleType,
        paintColor: cfg.paintColor,
        finish: 'metallic',
        rimColor: cfg.rimColor,
        caliperColor: cfg.caliperColor,
        headlightTint: '#ffffff',
        windowTint: 0.34,
        spoiler: cfg.spoiler,
        interiorTheme: cfg.interiorTheme,
        ecuStage: 2,
      };

      const vehObj = createVehicleByType(custom);
      vehObj.carGroup.rotation.order = 'YXZ';
      const startCP = RIVAL_RACE_CHECKPOINTS[0];
      const startX = startCP.x + cfg.gridOffsetX;
      const startZ = startCP.z + cfg.gridOffsetZ;
      const startY = resolveSurfaceY(startX, startZ, 0);

      vehObj.carGroup.position.set(startX, startY, startZ);
      vehObj.carGroup.rotation.y = Math.PI / 2; // Facing towards checkpoint 2

      const rival: RivalDriver = {
        id: cfg.id,
        name: cfg.name,
        carName: cfg.carName,
        vehicleType: cfg.vehicleType,
        paintColor: cfg.paintColor,
        group: vehObj.carGroup,
        vehicle: vehObj,
        wheelSpinAngle: 0,
        x: startX,
        y: startY,
        z: startZ,
        width: cfg.width,
        length: cfg.length,
        rotation: Math.PI / 2,
        speed: 0,
        maxSpeed: cfg.maxSpeed,
        accel: cfg.accel,
        cornerSpeed: cfg.cornerSpeed,
        currentCheckpointIdx: 1, // Heading towards CP 1 (id 2)
        lapsCompleted: 0,
        distanceToNextCP: 50,
        isFinished: false,
        finishTime: null,
        gridOffsetX: cfg.gridOffsetX,
        gridOffsetZ: cfg.gridOffsetZ,
      };

      this.rivals.push(rival);
      this.group.add(vehObj.carGroup);
    });
  }

  public resetToGrid() {
    this.isRaceActive = false;
    const startCP = RIVAL_RACE_CHECKPOINTS[0];

    this.rivals.forEach((rival) => {
      rival.x = startCP.x + rival.gridOffsetX;
      rival.z = startCP.z + rival.gridOffsetZ;
      rival.y = resolveSurfaceY(rival.x, rival.z, 0);
      rival.rotation = Math.PI / 2;
      rival.speed = 0;
      rival.currentCheckpointIdx = 1;
      rival.lapsCompleted = 0;
      rival.isFinished = false;
      rival.finishTime = null;
      rival.group.position.set(rival.x, rival.y, rival.z);
      rival.group.rotation.y = rival.rotation;
      rival.group.rotation.x = 0;
      resetVehicleDamage(rival.group);
    });
  }

  public startRace() {
    this.isRaceActive = true;
    this.raceStartTime = performance.now();
  }

  /**
   * Called when the player collides with a rival racer: separates & slows the rival
   * and visibly dents the rival's exterior bodywork.
   */
  public applyImpactAndDent(
    id: string,
    pushX: number,
    pushZ: number,
    hitX: number,
    hitZ: number,
    severity: number
  ): void {
    const rival = this.rivals.find((r) => r.id === id);
    if (!rival) return;

    rival.x += pushX;
    rival.z += pushZ;
    rival.y = resolveSurfaceY(rival.x, rival.z, rival.y);
    rival.speed *= 0.45;
    rival.group.position.set(rival.x, rival.y, rival.z);
    rival.group.rotation.y = rival.rotation;

    if (severity > 0.05) {
      _hitVec.set(hitX, rival.y + 0.65, hitZ);
      _dirVec.set(rival.x - hitX, -0.08, rival.z - hitZ);
      if (_dirVec.lengthSq() < 1e-4) _dirVec.set(pushX, -0.05, pushZ);
      if (_dirVec.lengthSq() < 1e-4) _dirVec.set(0, 0, 1);
      applyVehicleDent(rival.group, _hitVec, _dirVec, severity);
    }
  }

  public update(delta: number, currentTime: number) {
    if (!this.isRaceActive) return;
    const dt = Math.min(delta, 0.06);

    this.rivals.forEach((rival) => {
      if (rival.isFinished) {
        rival.speed = Math.max(0, rival.speed - 12 * dt);
        return;
      }

      const targetCP = RIVAL_RACE_CHECKPOINTS[rival.currentCheckpointIdx];
      if (!targetCP) return;

      const dx = targetCP.x - rival.x;
      const dz = targetCP.z - rival.z;
      const dist = Math.hypot(dx, dz);
      rival.distanceToNextCP = dist;

      // Target steering heading towards checkpoint
      const targetAngle = Math.atan2(dx, dz);

      // Smooth steering rotation towards target checkpoint
      let angleDiff = targetAngle - rival.rotation;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      rival.rotation += Math.min(Math.max(angleDiff * 4.5 * dt, -2.8 * dt), 2.8 * dt);

      // Brake if entering a sharp corner, accelerate on straights
      const isSharpTurn = Math.abs(angleDiff) > 0.45;
      const effectiveMax = isSharpTurn ? rival.cornerSpeed : rival.maxSpeed;
      const isBraking = rival.speed > effectiveMax + 1.0;

      if (rival.speed < effectiveMax) {
        rival.speed = Math.min(effectiveMax, rival.speed + rival.accel * dt);
      } else {
        rival.speed = Math.max(effectiveMax, rival.speed - 22 * dt);
      }

      if (rival.vehicle.brakeLightMats) {
        const targetIntensity = isBraking ? 3.8 : 1.4;
        for (let b = 0; b < rival.vehicle.brakeLightMats.length; b++) {
          rival.vehicle.brakeLightMats[b].emissiveIntensity = targetIntensity;
        }
      }

      // Move along heading vector + track surface elevation & ramp pitch
      rival.x += Math.sin(rival.rotation) * rival.speed * dt;
      rival.z += Math.cos(rival.rotation) * rival.speed * dt;
      rival.y = resolveSurfaceY(rival.x, rival.z, rival.y);

      rival.group.position.set(rival.x, rival.y, rival.z);
      rival.group.rotation.y = rival.rotation;
      rival.group.rotation.x = getBridgePitchAt(rival.x, rival.z, rival.rotation, rival.y);

      const rivalWheelR = rival.vehicle.wheelRadius || 0.38;
      rival.wheelSpinAngle += (rival.speed * dt) / rivalWheelR;
      animateVehicleModel(rival.vehicle, {
        speed: rival.speed,
        steeringAngle: THREE.MathUtils.clamp(angleDiff * 0.6, -0.38, 0.38),
        wheelSpinAngle: rival.wheelSpinAngle,
        accelLoad: isBraking ? -0.6 : 0.4,
        delta: dt,
        isCockpitCamera: false,
      });

      // Checkpoint passing detection
      if (dist < targetCP.radius + 3.0) {
        rival.currentCheckpointIdx++;

        // Completed final checkpoint (finish line)
        if (rival.currentCheckpointIdx >= RIVAL_RACE_CHECKPOINTS.length) {
          rival.isFinished = true;
          rival.finishTime = (currentTime - this.raceStartTime) / 1000;
        }
      }
    });
  }

  // Calculate real-time standings between Player and 3 Rivals based on actual progress
  public getRaceStandings(playerProgress: { checkpointIdx: number; distToNext: number; isFinished: boolean }): {
    rank: number;
    leaderboard: { name: string; position: number; cpIdx: number; isPlayer: boolean; finishTime: number | null }[];
  } {
    const competitors = [
      {
        name: 'Player',
        cpIdx: playerProgress.checkpointIdx,
        distToNext: playerProgress.distToNext,
        isPlayer: true,
        isFinished: playerProgress.isFinished,
        finishTime: null as number | null,
      },
      ...this.rivals.map((r) => ({
        name: r.name,
        cpIdx: r.currentCheckpointIdx,
        distToNext: r.distanceToNextCP,
        isPlayer: false,
        isFinished: r.isFinished,
        finishTime: r.finishTime,
      })),
    ];

    competitors.sort((a, b) => {
      if (a.isFinished && !b.isFinished) return -1;
      if (!a.isFinished && b.isFinished) return 1;
      if (a.isFinished && b.isFinished) {
        return (a.finishTime || 0) - (b.finishTime || 0);
      }
      if (a.cpIdx !== b.cpIdx) {
        return b.cpIdx - a.cpIdx;
      }
      return a.distToNext - b.distToNext;
    });

    const leaderboard = competitors.map((c, idx) => ({
      name: c.name,
      position: idx + 1,
      cpIdx: c.cpIdx,
      isPlayer: c.isPlayer,
      finishTime: c.finishTime,
    }));

    const playerRank = leaderboard.find((c) => c.isPlayer)?.position || 1;

    return { rank: playerRank, leaderboard };
  }

  public getRivalsBoundingBoxes(): {
    id: string;
    name: string;
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
    return this.rivals.map((r) => ({
      id: r.id,
      name: r.name,
      x: r.x,
      y: r.y,
      z: r.z,
      width: r.width,
      length: r.length,
      rotation: r.rotation,
      minX: r.x - r.width / 2,
      maxX: r.x + r.width / 2,
      minZ: r.z - r.length / 2,
      maxZ: r.z + r.length / 2,
      speed: r.speed,
    }));
  }

  public dispose(): void {
    this.rivals.forEach((r) => disposeObject3D(r.group, false));
  }
}
