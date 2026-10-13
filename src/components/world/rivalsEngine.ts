// MANIFOLD WORLD - COMPUTER-CONTROLLED RIVAL DRIVERS ENGINE
// Controls autonomous rival racers along the Surulere & Yaba street race circuit

import * as THREE from 'three';
import { RIVAL_RACE_CHECKPOINTS, RaceCheckpoint } from './lagosCityData';
import { createVehicleByType, CarCustomization } from './worldModels';

export interface RivalDriver {
  id: string;
  name: string;
  carName: string;
  vehicleType: 'SPORTS_COUPE' | 'LUXURY_SUV' | 'EXECUTIVE_SEDAN';
  paintColor: string;
  group: THREE.Group;
  x: number;
  z: number;
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
      maxSpeed: number;
      accel: number;
      cornerSpeed: number;
      gridOffsetX: number;
      gridOffsetZ: number;
    }[] = [
      {
        id: 'rival_tariq',
        name: 'Tariq',
        carName: 'MANIFOLD GT Coupe (Tuned)',
        vehicleType: 'SPORTS_COUPE',
        paintColor: '#DC2626', // Crimson Red
        maxSpeed: 38, // ~175 km/h
        accel: 20,
        cornerSpeed: 18,
        gridOffsetX: -4,
        gridOffsetZ: -4,
      },
      {
        id: 'rival_chidi',
        name: 'Chidi',
        carName: 'Apex Vanguard Bi-Turbo',
        vehicleType: 'LUXURY_SUV',
        paintColor: '#1E3A8A', // Deep Blue
        maxSpeed: 34, // ~155 km/h
        accel: 17,
        cornerSpeed: 15,
        gridOffsetX: 4,
        gridOffsetZ: -8,
      },
      {
        id: 'rival_amara',
        name: 'Amara',
        carName: 'Prestige Sovereign Turbo',
        vehicleType: 'EXECUTIVE_SEDAN',
        paintColor: '#0F172A', // Midnight Carbon
        maxSpeed: 36, // ~165 km/h
        accel: 18,
        cornerSpeed: 19,
        gridOffsetX: -4,
        gridOffsetZ: -12,
      },
    ];

    rivalConfigs.forEach((cfg) => {
      const custom: CarCustomization = {
        vehicleType: cfg.vehicleType,
        paintColor: cfg.paintColor,
        finish: 'metallic',
        rimColor: '#E2E8F0',
        caliperColor: '#EF233C',
        headlightTint: '#ffffff',
        windowTint: 0.5,
      };

      const vehObj = createVehicleByType(custom);
      const startCP = RIVAL_RACE_CHECKPOINTS[0];
      const startX = startCP.x + cfg.gridOffsetX;
      const startZ = startCP.z + cfg.gridOffsetZ;

      vehObj.carGroup.position.set(startX, 0, startZ);
      vehObj.carGroup.rotation.y = Math.PI / 2; // Facing towards checkpoint 2

      const rival: RivalDriver = {
        id: cfg.id,
        name: cfg.name,
        carName: cfg.carName,
        vehicleType: cfg.vehicleType,
        paintColor: cfg.paintColor,
        group: vehObj.carGroup,
        x: startX,
        z: startZ,
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
      rival.rotation = Math.PI / 2;
      rival.speed = 0;
      rival.currentCheckpointIdx = 1;
      rival.lapsCompleted = 0;
      rival.isFinished = false;
      rival.finishTime = null;
      rival.group.position.set(rival.x, 0, rival.z);
      rival.group.rotation.y = rival.rotation;
    });
  }

  public startRace() {
    this.isRaceActive = true;
    this.raceStartTime = performance.now();
  }

  public update(delta: number, currentTime: number) {
    if (!this.isRaceActive) return;

    this.rivals.forEach((rival) => {
      if (rival.isFinished) {
        // Slow down to a stop after crossing finish line
        rival.speed = Math.max(0, rival.speed - 12 * delta);
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

      rival.rotation += Math.min(Math.max(angleDiff * 4.5 * delta, -2.8 * delta), 2.8 * delta);

      // Brake if entering a sharp corner, accelerate on straights
      const isSharpTurn = Math.abs(angleDiff) > 0.45;
      const effectiveMax = isSharpTurn ? rival.cornerSpeed : rival.maxSpeed;

      if (rival.speed < effectiveMax) {
        rival.speed = Math.min(effectiveMax, rival.speed + rival.accel * delta);
      } else {
        rival.speed = Math.max(effectiveMax, rival.speed - 22 * delta);
      }

      // Move along heading vector
      rival.x += Math.sin(rival.rotation) * rival.speed * delta;
      rival.z += Math.cos(rival.rotation) * rival.speed * delta;

      rival.group.position.set(rival.x, 0, rival.z);
      rival.group.rotation.y = rival.rotation;

      // Checkpoint passing detection
      if (dist < targetCP.radius + 2.5) {
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

    // Sort by:
    // 1. Finished status
    // 2. Checkpoint index descending
    // 3. Distance to next checkpoint ascending
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

  public getRivalsBoundingBoxes(): { id: string; minX: number; maxX: number; minZ: number; maxZ: number; speed: number; x: number; z: number }[] {
    return this.rivals.map((r) => ({
      id: r.id,
      x: r.x,
      z: r.z,
      minX: r.x - 1.1,
      maxX: r.x + 1.1,
      minZ: r.z - 2.4,
      maxZ: r.z + 2.4,
      speed: r.speed,
    }));
  }
}
