// MANIFOLD WORLD - COMPUTER-CONTROLLED RIVAL DRIVERS ENGINE
// Controls autonomous rival racers along the Lagos Coastal Highway (Victoria Island -> Epe)
// with tuned GT aero specs, 4-lane positioning, surface elevation tracking, and collision denting.

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

export interface CoastalRaceLeaderboardEntry {
  name: string;
  position: number;
  cpIdx: number;
  isPlayer: boolean;
  finishTime: number | null;
}

export interface CoastalRaceState {
  phase: 'COUNTDOWN' | 'ACTIVE' | 'FINISHED';
  countdownSeconds: number;
  elapsedSec: number;
  rank: number;
  totalRacers: number;
  checkpointIdx: number;
  totalCheckpoints: number;
  distanceRemainingMeters: number;
  leaderboard: CoastalRaceLeaderboardEntry[];
  prizeCredits: number;
}

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
  preferredLaneOffset: number;
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
      preferredLaneOffset: number;
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
        maxSpeed: 68, // ~313 km/h hyper coastal pace
        accel: 42,
        cornerSpeed: 54,
        gridOffsetX: -4.5,
        gridOffsetZ: -10.5,
        preferredLaneOffset: -10.5,
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
        maxSpeed: 60, // ~276 km/h
        accel: 35,
        cornerSpeed: 46,
        gridOffsetX: -11.5,
        gridOffsetZ: -3.8,
        preferredLaneOffset: -3.8,
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
        maxSpeed: 63, // ~290 km/h
        accel: 37,
        cornerSpeed: 49,
        gridOffsetX: -5.5,
        gridOffsetZ: 10.6,
        preferredLaneOffset: 10.6,
      },
      {
        id: 'rival_tunde',
        name: 'Tunde',
        carName: 'Lagos Coastal RS Coupe',
        vehicleType: 'SPORTS_COUPE',
        paintColor: '#F59E0B', // Solar Amber
        rimColor: '#0F172A', // Matte Carbon
        caliperColor: '#38BDF8',
        spoiler: 'GT_WING',
        interiorTheme: 'SPORT',
        width: 1.9,
        length: 4.35,
        maxSpeed: 66, // ~304 km/h
        accel: 40,
        cornerSpeed: 52,
        gridOffsetX: -12.5,
        gridOffsetZ: 4.0,
        preferredLaneOffset: 4.0,
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
      vehObj.carGroup.rotation.y = Math.PI / 2; // Facing east down the Coastal Highway

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
        preferredLaneOffset: cfg.preferredLaneOffset,
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

  public update(
    delta: number,
    currentTime: number,
    playerState?: { x: number; z: number; speed: number }
  ) {
    if (!this.isRaceActive) return;
    const dt = Math.min(delta, 0.06);
    const laneChoices = [-10.8, -4.0, 4.0, 10.8];

    this.rivals.forEach((rival) => {
      if (rival.isFinished) {
        rival.speed = Math.max(0, rival.speed - 12 * dt);
        return;
      }

      const targetCP = RIVAL_RACE_CHECKPOINTS[rival.currentCheckpointIdx];
      if (!targetCP) return;

      // Dynamic aggressive overtaking: if player or another rival blocks right ahead in same lane, swerve to clearest lane
      let desiredLaneOffset = rival.preferredLaneOffset;
      let laneBlocked = false;
      const blockers: { x: number; z: number }[] = [];
      for (let i = 0; i < this.rivals.length; i++) {
        const other = this.rivals[i];
        if (other.id !== rival.id) blockers.push({ x: other.x, z: other.z });
      }
      if (playerState) blockers.push({ x: playerState.x, z: playerState.z });

      for (let b = 0; b < blockers.length; b++) {
        const relX = blockers[b].x - rival.x;
        const relZ = blockers[b].z - rival.z;
        if (relX > 0.5 && relX < 17 && Math.abs(relZ) < 2.9) {
          laneBlocked = true;
          break;
        }
      }

      if (laneBlocked) {
        let bestLane = desiredLaneOffset;
        let bestClearScore = -Infinity;
        for (let l = 0; l < laneChoices.length; l++) {
          const candZ = targetCP.z + laneChoices[l];
          let minClear = 999;
          for (let b = 0; b < blockers.length; b++) {
            const relX = blockers[b].x - rival.x;
            if (relX > -4 && relX < 22) {
              const latGap = Math.abs(blockers[b].z - candZ);
              if (latGap < minClear) minClear = latGap;
            }
          }
          if (minClear > bestClearScore) {
            bestClearScore = minClear;
            bestLane = laneChoices[l];
          }
        }
        desiredLaneOffset = bestLane;
      }

      const dx = targetCP.x - rival.x;
      const targetZ = targetCP.z + desiredLaneOffset;
      const dz = targetZ - rival.z;
      const dist = Math.hypot(dx, targetCP.z - rival.z);
      rival.distanceToNextCP = dist;

      // Target steering heading along assigned coastal highway lane
      const targetAngle = Math.atan2(dx, dz);

      // Smooth steering rotation towards target lane point
      let angleDiff = targetAngle - rival.rotation;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      rival.rotation += Math.min(Math.max(angleDiff * 5.2 * dt, -3.4 * dt), 3.4 * dt);

      // Competitive pace adaptation: crazy speed on straights + aggressive catch-up surge when behind
      let competitivePaceFactor = 1.0;
      let accelBoost = 1.0;
      if (playerState) {
        const xGap = rival.x - playerState.x;
        if (xGap < -10) {
          // Behind player: engage high-boost slipstream/turbo catch-up
          competitivePaceFactor = 1.15;
          accelBoost = 1.35;
        } else if (xGap > 70) {
          // Slightly ease off only when very far ahead so battles remain intense & competitive
          competitivePaceFactor = 0.88;
        }
      }

      const isSharpTurn = Math.abs(angleDiff) > 0.45;
      const baseTarget = isSharpTurn ? rival.cornerSpeed : rival.maxSpeed;
      const effectiveMax = baseTarget * competitivePaceFactor;
      const isBraking = rival.speed > effectiveMax + 1.5;

      if (rival.speed < effectiveMax) {
        rival.speed = Math.min(effectiveMax, rival.speed + rival.accel * accelBoost * dt);
      } else {
        rival.speed = Math.max(effectiveMax, rival.speed - 20 * dt);
      }

      if (rival.vehicle.brakeLightMats) {
        const targetIntensity = isBraking ? 3.8 : 1.4;
        for (let b = 0; b < rival.vehicle.brakeLightMats.length; b++) {
          rival.vehicle.brakeLightMats[b].emissiveIntensity = targetIntensity;
        }
      }

      // Move along heading vector + keep cleanly inside 4-lane Coastal Highway asphalt
      rival.x += Math.sin(rival.rotation) * rival.speed * dt;
      rival.z = THREE.MathUtils.clamp(
        rival.z + Math.cos(rival.rotation) * rival.speed * dt,
        targetCP.z - 13.5,
        targetCP.z + 13.5
      );
      rival.y = resolveSurfaceY(rival.x, rival.z, rival.y);

      rival.group.position.set(rival.x, rival.y, rival.z);
      rival.group.rotation.y = rival.rotation;
      rival.group.rotation.x = getBridgePitchAt(rival.x, rival.z, rival.rotation, rival.y);

      const rivalWheelR = rival.vehicle.wheelRadius || 0.38;
      rival.wheelSpinAngle += (rival.speed * dt) / rivalWheelR;
      animateVehicleModel(rival.vehicle, {
        speed: rival.speed,
        steeringAngle: THREE.MathUtils.clamp(angleDiff * 0.65, -0.4, 0.4),
        wheelSpinAngle: rival.wheelSpinAngle,
        accelLoad: isBraking ? -0.6 : 1.0,
        delta: dt,
        isCockpitCamera: false,
      });

      // Checkpoint passing detection
      if (dist < targetCP.radius + 4.0) {
        rival.currentCheckpointIdx++;

        // Completed final checkpoint (Epe Finish Gantry)
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
