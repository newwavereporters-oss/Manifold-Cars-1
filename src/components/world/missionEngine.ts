// MANIFOLD WORLD - EXPANDED MISSION ENGINE & OBJECTIVES SYSTEM
// 12 verified Lagos missions across NEAR, FAR, and VERY_FAR tiers:
//   - Multi-checkpoint progression + final destination beacons
//   - Cargo delivery integrity tracking (DELIVERY / SHOWROOM)
//   - Zero-collision executive runs (requiresNoCollision)
//   - Park-gear precision stops (requireParkGear -> requires selectedGear === 'P' inside destination)
//   - 10-checkpoint Mainland Grand Prix street race (STREET_RACE)

import { TransmissionGear } from './worldModels';

export type MissionDistanceTier = 'NEAR' | 'FAR' | 'VERY_FAR';
export type MissionCategory =
  | 'DELIVERY'
  | 'PASSENGER'
  | 'SHOWROOM'
  | 'PARKING'
  | 'CHECKPOINT'
  | 'STREET_RACE'
  | 'ENDURANCE';
export type MissionDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Master';
export type MissionId = string;
export type MissionState = 'IDLE' | 'BRIEFING' | 'COUNTDOWN' | 'ACTIVE' | 'COMPLETED' | 'FAILED';

export interface MissionCheckpoint {
  x: number;
  z: number;
  radius: number;
  name: string;
}

export interface MissionDef {
  id: MissionId;
  title: string;
  category: MissionCategory;
  distanceCategory: MissionDistanceTier;
  subTitle: string;
  briefing: string;
  startLocationName: string;
  destinationName: string;
  startX: number;
  startZ: number;
  destX: number;
  destZ: number;
  destRadius: number;
  checkpoints: MissionCheckpoint[];
  distanceMeters: number;
  estimatedMinutes: number;
  timeLimitSec: number;
  baseRewardCredits: number;
  reputationXP: number;
  rewardBadge?: string;
  difficulty: MissionDifficulty;
  cooldownSec: number;
  requiresNoCollision?: boolean;
  requireParkGear?: boolean;
}

export const MISSIONS_CATALOG_LIST: MissionDef[] = [
  // ============================================================================
  // NEAR MISSIONS (Mainland / Showroom / Obalende Quick Runs)
  // ============================================================================
  {
    id: 'MISSION_A_DELIVERY',
    title: 'Mainland Cargo Rush',
    category: 'DELIVERY',
    distanceCategory: 'NEAR',
    subTitle: 'High-Priority ECU Component Delivery',
    briefing:
      'Transport prototype ECU hardware from Yaba Innovation Hub to Mainland Express Depot in Surulere. Avoid heavy traffic collisions to protect cargo integrity.',
    startLocationName: 'Yaba Innovation Hub',
    destinationName: 'Mainland Express Cargo Terminal',
    startX: 0,
    startZ: -125,
    destX: -55,
    destZ: 100,
    destRadius: 15,
    checkpoints: [],
    distanceMeters: 480,
    estimatedMinutes: 2,
    timeLimitSec: 95,
    baseRewardCredits: 500,
    reputationXP: 150,
    difficulty: 'Easy',
    cooldownSec: 60,
  },
  {
    id: 'NEAR_OBALENDE_PARCEL',
    title: 'Obalende Express Parcel',
    category: 'DELIVERY',
    distanceCategory: 'NEAR',
    subTitle: 'Commercial Row Courier Dispatch',
    briefing:
      'Deliver urgent vehicle registration documents from Herbert Macaulay North through Bank Row Junction into Obalende Commercial Terminal.',
    startLocationName: 'Herbert Macaulay North',
    destinationName: 'Obalende Market & Terminal',
    startX: 0,
    startZ: -80,
    destX: 160,
    destZ: 30,
    destRadius: 16,
    checkpoints: [{ x: 105, z: 0, radius: 14, name: 'Bank Row Junction' }],
    distanceMeters: 420,
    estimatedMinutes: 2,
    timeLimitSec: 90,
    baseRewardCredits: 450,
    reputationXP: 120,
    difficulty: 'Easy',
    cooldownSec: 60,
  },
  {
    id: 'NEAR_DEALER_VIP_PICKUP',
    title: 'VIP Showroom Chauffeur',
    category: 'PASSENGER',
    distanceCategory: 'NEAR',
    subTitle: 'Marketplace Pickup & Lounge Transfer',
    briefing:
      'Pick up an executive client at the Grand Marketplace Gate and chauffeur them smoothly into the VIP Concierge & Dealer Lounge.',
    startLocationName: 'Showroom Esplanade',
    destinationName: 'VIP Dealer Lounge',
    startX: 0,
    startZ: 10,
    destX: 56,
    destZ: 16,
    destRadius: 12,
    checkpoints: [{ x: 0, z: 100, radius: 14, name: 'Grand Marketplace Gate' }],
    distanceMeters: 340,
    estimatedMinutes: 1,
    timeLimitSec: 85,
    baseRewardCredits: 550,
    reputationXP: 160,
    difficulty: 'Easy',
    cooldownSec: 60,
  },
  {
    id: 'NEAR_PRECISION_PARK',
    title: 'Proving Ground Precision Bay',
    category: 'PARKING',
    distanceCategory: 'NEAR',
    subTitle: 'Park-Gear Inspection Challenge',
    briefing:
      'Drive cleanly from Bank Row Junction into the central MANIFOLD Showroom bay, bring the car to a gentle stop, and engage P (Park) gear.',
    startLocationName: 'Bank Row Junction',
    destinationName: 'MANIFOLD Showroom Bay',
    startX: 105,
    startZ: 0,
    destX: 0,
    destZ: -35,
    destRadius: 11,
    checkpoints: [],
    distanceMeters: 260,
    estimatedMinutes: 1,
    timeLimitSec: 70,
    baseRewardCredits: 420,
    reputationXP: 140,
    rewardBadge: 'Precision Parker',
    difficulty: 'Easy',
    cooldownSec: 60,
    requireParkGear: true,
  },
  {
    id: 'MISSION_B_RACE',
    title: 'City Rival Challenge',
    category: 'STREET_RACE',
    distanceCategory: 'NEAR',
    subTitle: 'Mainland Grand Prix Street Race',
    briefing:
      'Line up against Tariq, Chidi, and Amara across the 10-checkpoint Surulere and Yaba street circuit.',
    startLocationName: 'Surulere Grid Start',
    destinationName: 'Mainland Grand Prix Finish',
    startX: -50,
    startZ: -130,
    destX: -50,
    destZ: -130,
    destRadius: 12,
    checkpoints: [],
    distanceMeters: 780,
    estimatedMinutes: 2,
    timeLimitSec: 180,
    baseRewardCredits: 1000,
    reputationXP: 300,
    rewardBadge: 'Mainland Street Champion',
    difficulty: 'Medium',
    cooldownSec: 90,
  },

  // ============================================================================
  // FAR MISSIONS (Ikoyi / Lekki Phase 1 / Third Mainland / Ikeja / Oshodi)
  // ============================================================================
  {
    id: 'FAR_IKOYI_CLEAN_TRANSFER',
    title: 'Bourdillon Diplomatic Escort',
    category: 'PASSENGER',
    distanceCategory: 'FAR',
    subTitle: 'Zero-Collision Executive Run',
    briefing:
      'Transport diplomatic guests via Adekunle Interchange straight to Bourdillon Towers in Ikoyi. Any heavy collision fails the mission immediately.',
    startLocationName: 'Showroom Esplanade',
    destinationName: 'Ikoyi Bourdillon Towers',
    startX: 0,
    startZ: 10,
    destX: 365,
    destZ: -130,
    destRadius: 16,
    checkpoints: [{ x: 160, z: -130, radius: 16, name: 'Adekunle Interchange' }],
    distanceMeters: 1050,
    estimatedMinutes: 3,
    timeLimitSec: 135,
    baseRewardCredits: 1200,
    reputationXP: 340,
    rewardBadge: 'Zero-Impact Chauffeur',
    difficulty: 'Medium',
    cooldownSec: 120,
    requiresNoCollision: true,
  },
  {
    id: 'FAR_LEKKI_COURIER',
    title: 'Ikoyi-Lekki Bridge Courier',
    category: 'SHOWROOM',
    distanceCategory: 'FAR',
    subTitle: 'Cross-Channel High-Priority Run',
    briefing:
      'Drive from Obalende Terminal across the cable-stayed Ikoyi-Lekki Link Bridge into Lekki Phase 1 Admiralty Hub.',
    startLocationName: 'Obalende Terminal',
    destinationName: 'Lekki Phase 1 Admiralty Hub',
    startX: 160,
    startZ: 30,
    destX: 660,
    destZ: -20,
    destRadius: 16,
    checkpoints: [
      { x: 365, z: -20, radius: 16, name: 'Ikoyi Link Bridgehead' },
      { x: 520, z: -20, radius: 18, name: 'Cable Pylon Crest' },
    ],
    distanceMeters: 1180,
    estimatedMinutes: 3,
    timeLimitSec: 140,
    baseRewardCredits: 1300,
    reputationXP: 360,
    difficulty: 'Medium',
    cooldownSec: 120,
  },
  {
    id: 'FAR_TMB_CHECKPOINT_SPRINT',
    title: 'Third Mainland Express Run',
    category: 'CHECKPOINT',
    distanceCategory: 'FAR',
    subTitle: 'Multi-Checkpoint Bridge Time Trial',
    briefing:
      'Blast north across Third Mainland Bridge through Iyana-Oworo all the way to Ikeja Central Business District before the timer expires.',
    startLocationName: 'Yaba Bridge South Approach',
    destinationName: 'Ikeja Central Business District',
    startX: 0,
    startZ: -130,
    destX: 0,
    destZ: -880,
    destRadius: 16,
    checkpoints: [
      { x: 0, z: -320, radius: 18, name: 'TMB Center South' },
      { x: 0, z: -555, radius: 18, name: 'TMB North Deck' },
      { x: 0, z: -640, radius: 18, name: 'Iyana-Oworo Interchange' },
    ],
    distanceMeters: 1450,
    estimatedMinutes: 2,
    timeLimitSec: 125,
    baseRewardCredits: 1450,
    reputationXP: 420,
    rewardBadge: 'Bridge Sprinter',
    difficulty: 'Hard',
    cooldownSec: 120,
  },
  {
    id: 'FAR_OSHODI_FREIGHT',
    title: 'Ikeja-Oshodi Supply Line',
    category: 'PARKING',
    distanceCategory: 'FAR',
    subTitle: 'Mainland Freight & Terminal Park',
    briefing:
      'Haul commercial dealership equipment from Ikeja CBD via Ikeja Along and Dopemu to Oshodi Interchange, then lock P (Park) gear on arrival.',
    startLocationName: 'Ikeja Central Business District',
    destinationName: 'Oshodi Transport Interchange',
    startX: 0,
    startZ: -880,
    destX: -260,
    destZ: -640,
    destRadius: 16,
    checkpoints: [
      { x: -130, z: -880, radius: 16, name: 'Ikeja Along' },
      { x: -260, z: -760, radius: 16, name: 'Dopemu Bridge Link' },
    ],
    distanceMeters: 1120,
    estimatedMinutes: 3,
    timeLimitSec: 150,
    baseRewardCredits: 1250,
    reputationXP: 350,
    difficulty: 'Medium',
    cooldownSec: 120,
    requireParkGear: true,
  },

  // ============================================================================
  // VERY_FAR MISSIONS (Cross-Region Epe / LASU / Trans-Lagos Endurance)
  // ============================================================================
  {
    id: 'VFAR_ISLAND_TO_EPE',
    title: 'Cross-Lagos Epe Waterfront Haul',
    category: 'DELIVERY',
    distanceCategory: 'VERY_FAR',
    subTitle: 'Long-Range Eastern Coastal Logistics',
    briefing:
      'Complete a flagship long-haul delivery from MANIFOLD Showroom through Ikoyi, Lekki Phase 1, and Ajah Flyover to Epe Waterfront Marina.',
    startLocationName: 'MANIFOLD Showroom',
    destinationName: 'Epe Waterfront Marina',
    startX: 0,
    startZ: -35,
    destX: 1565,
    destZ: 100,
    destRadius: 18,
    checkpoints: [
      { x: 260, z: -20, radius: 18, name: 'Ikoyi Estates Blvd' },
      { x: 660, z: -20, radius: 18, name: 'Lekki Phase 1' },
      { x: 1135, z: 100, radius: 18, name: 'Ajah Express Overpass' },
      { x: 1388, z: 100, radius: 18, name: 'Epe Lagoon Bridge' },
    ],
    distanceMeters: 3150,
    estimatedMinutes: 5,
    timeLimitSec: 260,
    baseRewardCredits: 2800,
    reputationXP: 750,
    rewardBadge: 'Epe Voyager',
    difficulty: 'Expert',
    cooldownSec: 180,
  },
  {
    id: 'VFAR_MAINLAND_TO_LASU',
    title: 'Island-to-LASU Campus Marathon',
    category: 'ENDURANCE',
    distanceCategory: 'VERY_FAR',
    subTitle: 'Inter-District Endurance Run',
    briefing:
      'Drive across Lagos Lagoon via Third Mainland Bridge, navigate Oshodi and Igando corridors, and reach LASU Academic Quad in Ojo.',
    startLocationName: 'Showroom Esplanade',
    destinationName: 'LASU Academic Quad',
    startX: 0,
    startZ: 10,
    destX: -875,
    destZ: -660,
    destRadius: 18,
    checkpoints: [
      { x: 0, z: -640, radius: 18, name: 'Iyana-Oworo' },
      { x: -260, z: -640, radius: 18, name: 'Oshodi Terminal' },
      { x: -550, z: -790, radius: 18, name: 'Igando Transit Hub' },
    ],
    distanceMeters: 3400,
    estimatedMinutes: 5,
    timeLimitSec: 290,
    baseRewardCredits: 3200,
    reputationXP: 850,
    rewardBadge: 'LASU Express Legend',
    difficulty: 'Expert',
    cooldownSec: 180,
  },
  {
    id: 'VFAR_EPE_TO_LASU_GRAND_TOUR',
    title: 'Lagos Grand Coast-to-Campus Tour',
    category: 'ENDURANCE',
    distanceCategory: 'VERY_FAR',
    subTitle: 'Master Cross-Region Precision Endurance',
    briefing:
      'Traverse the full width of MANIFOLD Lagos from Epe Town Gateway through VGC, Ikoyi Link Bridge, Yaba, and Mainland to LASU Gate — then engage P gear!',
    startLocationName: 'Epe Town Gateway',
    destinationName: 'LASU Main Entrance Gate',
    startX: 1495,
    startZ: 100,
    destX: -790,
    destZ: -660,
    destRadius: 18,
    checkpoints: [
      { x: 1015, z: 100, radius: 18, name: 'VGC Interchange' },
      { x: 520, z: -20, radius: 18, name: 'Ikoyi-Lekki Bridge' },
      { x: 0, z: -130, radius: 18, name: 'Yaba Approach' },
      { x: 0, z: -640, radius: 18, name: 'Iyana-Oworo' },
    ],
    distanceMeters: 4450,
    estimatedMinutes: 6,
    timeLimitSec: 360,
    baseRewardCredits: 4500,
    reputationXP: 1200,
    rewardBadge: 'Trans-Lagos Sovereign',
    difficulty: 'Master',
    cooldownSec: 240,
    requireParkGear: true,
  },
];

export const MISSIONS_CATALOG: Record<MissionId, MissionDef> = Object.fromEntries(
  MISSIONS_CATALOG_LIST.map((m) => [m.id, m])
);

export interface ActiveMissionSession {
  missionId: MissionId;
  state: MissionState;
  timeRemainingSec: number;
  cargoIntegrityPercent: number;
  countdownVal: number;
  currentCheckpointIdx: number; // 0 .. def.checkpoints.length (when === checkpoints.length, target is final dest)
  currentRaceCheckpointIdx: number;
  playerRaceRank: number;
  totalRaceCheckpoints: number;
  runToken?: string;
  rewardClaimed?: boolean;
  insideDestAwaitingPark?: boolean;
  resultSummary?: {
    success: boolean;
    creditsEarned: number;
    xpEarned: number;
    rewardBadge?: string | null;
    message: string;
    finishPosition?: number;
  };
}

export class MissionManager {
  public session: ActiveMissionSession | null = null;
  private onMissionCompletedCallback?: (
    missionId: MissionId,
    success: boolean,
    credits: number,
    xp: number,
    reason: string,
    runToken?: string,
    runData?: Record<string, unknown>,
    rewardBadge?: string | null
  ) => void;

  constructor(
    onMissionCompleted?: (
      missionId: MissionId,
      success: boolean,
      credits: number,
      xp: number,
      reason: string,
      runToken?: string,
      runData?: Record<string, unknown>,
      rewardBadge?: string | null
    ) => void
  ) {
    this.onMissionCompletedCallback = onMissionCompleted;
  }

  public setCompletionCallback(
    cb: (
      missionId: MissionId,
      success: boolean,
      credits: number,
      xp: number,
      reason: string,
      runToken?: string,
      runData?: Record<string, unknown>,
      rewardBadge?: string | null
    ) => void
  ) {
    this.onMissionCompletedCallback = cb;
  }

  public getMissionDef(missionId: MissionId, overrides?: Record<string, Partial<MissionDef>>): MissionDef {
    const base = MISSIONS_CATALOG[missionId] || MISSIONS_CATALOG_LIST[0];
    if (!overrides || !overrides[missionId]) return base;
    return { ...base, ...overrides[missionId] };
  }

  public openBriefing(missionId: MissionId, overrides?: Record<string, Partial<MissionDef>>): ActiveMissionSession {
    const def = this.getMissionDef(missionId, overrides);
    this.session = {
      missionId,
      state: 'BRIEFING',
      timeRemainingSec: def.timeLimitSec,
      cargoIntegrityPercent: 100,
      countdownVal: 3,
      currentCheckpointIdx: 0,
      currentRaceCheckpointIdx: 0,
      playerRaceRank: 1,
      totalRaceCheckpoints: 10,
      rewardClaimed: false,
      insideDestAwaitingPark: false,
    };
    return this.session;
  }

  public startMission(runToken?: string): ActiveMissionSession | null {
    if (!this.session) return null;
    this.session.runToken = runToken;
    this.session.rewardClaimed = false;

    const def = MISSIONS_CATALOG[this.session.missionId];
    if (def?.category === 'STREET_RACE') {
      this.session.state = 'COUNTDOWN';
      this.session.countdownVal = 3;
    } else {
      this.session.state = 'ACTIVE';
    }
    return this.session;
  }

  public getActiveTarget(overrides?: Record<string, Partial<MissionDef>>): {
    x: number;
    z: number;
    radius: number;
    name: string;
    isFinalDestination: boolean;
  } | null {
    if (!this.session || (this.session.state !== 'ACTIVE' && this.session.state !== 'COUNTDOWN')) {
      return null;
    }
    const def = this.getMissionDef(this.session.missionId, overrides);
    if (def.category === 'STREET_RACE') return null;

    if (this.session.currentCheckpointIdx < def.checkpoints.length) {
      const cp = def.checkpoints[this.session.currentCheckpointIdx];
      return {
        x: cp.x,
        z: cp.z,
        radius: cp.radius,
        name: cp.name,
        isFinalDestination: false,
      };
    }

    return {
      x: def.destX,
      z: def.destZ,
      radius: def.destRadius,
      name: def.destinationName,
      isFinalDestination: true,
    };
  }

  private finalizeFailure(def: MissionDef, message: string, runData?: Record<string, unknown>) {
    if (!this.session || this.session.rewardClaimed) return;
    this.session.rewardClaimed = true;
    this.session.state = 'FAILED';
    this.session.resultSummary = {
      success: false,
      creditsEarned: 0,
      xpEarned: 0,
      message,
    };
    this.onMissionCompletedCallback?.(
      this.session.missionId,
      false,
      0,
      0,
      `Mission Failed: ${def.title}`,
      this.session.runToken,
      runData
    );
  }

  private finalizeSuccess(
    def: MissionDef,
    credits: number,
    xp: number,
    message: string,
    runData?: Record<string, unknown>,
    finishPosition?: number
  ) {
    if (!this.session || this.session.rewardClaimed) return;
    this.session.rewardClaimed = true;
    this.session.state = 'COMPLETED';
    this.session.resultSummary = {
      success: true,
      creditsEarned: credits,
      xpEarned: xp,
      rewardBadge: def.rewardBadge || null,
      message,
      finishPosition,
    };
    this.onMissionCompletedCallback?.(
      this.session.missionId,
      true,
      credits,
      xp,
      `Mission: ${def.title} Completed`,
      this.session.runToken,
      runData,
      def.rewardBadge || null
    );
  }

  public update(
    delta: number,
    playerPos: { x: number; z: number; speed: number; gear?: TransmissionGear },
    onCollisionImpact?: boolean,
    overrides?: Record<string, Partial<MissionDef>>
  ): ActiveMissionSession | null {
    if (!this.session) return null;

    if (this.session.state === 'COUNTDOWN') {
      this.session.countdownVal -= delta;
      if (this.session.countdownVal <= 0) {
        this.session.state = 'ACTIVE';
      }
      return this.session;
    }

    if (this.session.state !== 'ACTIVE') return this.session;

    const def = this.getMissionDef(this.session.missionId, overrides);

    // Decrement timer
    this.session.timeRemainingSec = Math.max(0, this.session.timeRemainingSec - delta);
    if (this.session.timeRemainingSec <= 0) {
      this.finalizeFailure(def, 'Time expired before completing the objective.');
      return this.session;
    }

    // Zero-collision rule check
    if (onCollisionImpact && def.requiresNoCollision) {
      this.finalizeFailure(def, 'Heavy collision violated the zero-impact VIP escort requirement.');
      return this.session;
    }

    // Cargo health check for logistics runs
    if (onCollisionImpact && (def.category === 'DELIVERY' || def.category === 'SHOWROOM')) {
      this.session.cargoIntegrityPercent = Math.max(0, this.session.cargoIntegrityPercent - 14);
      if (this.session.cargoIntegrityPercent <= 0) {
        this.finalizeFailure(def, 'Cargo was destroyed due to excessive vehicle collisions.', {
          cargoIntegrityPercent: 0,
        });
        return this.session;
      }
    }

    if (def.category === 'STREET_RACE') {
      return this.session;
    }

    // Sequential intermediate checkpoints
    if (this.session.currentCheckpointIdx < def.checkpoints.length) {
      const cp = def.checkpoints[this.session.currentCheckpointIdx];
      const distToCp = Math.hypot(playerPos.x - cp.x, playerPos.z - cp.z);
      if (distToCp <= cp.radius) {
        this.session.currentCheckpointIdx += 1;
      }
      return this.session;
    }

    // Final destination zone check
    const distToDest = Math.hypot(playerPos.x - def.destX, playerPos.z - def.destZ);
    const absSpeed = Math.abs(playerPos.speed);

    if (def.requireParkGear) {
      this.session.insideDestAwaitingPark = distToDest <= def.destRadius;
      if (distToDest <= def.destRadius && absSpeed < 2.2 && playerPos.gear === 'P') {
        this.finalizeSuccess(
          def,
          def.baseRewardCredits,
          def.reputationXP,
          `Precision arrival locked in Park (P) gear at ${def.destinationName}!`,
          { parkedInP: true }
        );
      }
    } else if (distToDest <= def.destRadius && absSpeed < 16) {
      const integrityRatio =
        def.category === 'DELIVERY' ? Math.max(0.1, this.session.cargoIntegrityPercent / 100) : 1;
      const earned = Math.round(def.baseRewardCredits * integrityRatio);
      this.finalizeSuccess(
        def,
        earned,
        def.reputationXP,
        def.category === 'DELIVERY'
          ? `Delivery completed with ${this.session.cargoIntegrityPercent}% cargo integrity!`
          : `Arrived safely at ${def.destinationName}!`,
        { cargoIntegrityPercent: this.session.cargoIntegrityPercent }
      );
    }

    return this.session;
  }

  public onPlayerReachRaceCheckpoint(
    checkpointIdx: number,
    rank: number,
    overrides?: Record<string, Partial<MissionDef>>
  ): ActiveMissionSession | null {
    if (!this.session || this.session.state !== 'ACTIVE') return this.session;
    const def = this.getMissionDef(this.session.missionId, overrides);
    if (def.category !== 'STREET_RACE') return this.session;

    this.session.currentRaceCheckpointIdx = checkpointIdx;
    this.session.playerRaceRank = rank;

    if (checkpointIdx >= this.session.totalRaceCheckpoints) {
      let reward = def.baseRewardCredits;
      let xp = def.reputationXP;
      if (rank === 2) {
        reward = Math.round(def.baseRewardCredits * 0.6);
        xp = Math.round(def.reputationXP * 0.6);
      } else if (rank === 3) {
        reward = Math.round(def.baseRewardCredits * 0.3);
        xp = Math.round(def.reputationXP * 0.35);
      } else if (rank >= 4) {
        reward = Math.round(def.baseRewardCredits * 0.1);
        xp = Math.round(def.reputationXP * 0.15);
      }

      if (!this.session.rewardClaimed) {
        this.session.rewardClaimed = true;
        this.session.state = 'COMPLETED';
        this.session.resultSummary = {
          success: rank <= 3,
          creditsEarned: reward,
          xpEarned: xp,
          rewardBadge: rank === 1 ? def.rewardBadge || null : null,
          finishPosition: rank,
          message:
            rank === 1
              ? 'Victory! You took 1st Place in the Mainland Grand Prix!'
              : `Race Finished! You crossed the finish line in P${rank}.`,
        };
        this.onMissionCompletedCallback?.(
          this.session.missionId,
          true,
          reward,
          xp,
          `Race Result: P${rank}`,
          this.session.runToken,
          { rank },
          rank === 1 ? def.rewardBadge || null : null
        );
      }
    }

    return this.session;
  }

  public abandonMission() {
    this.session = null;
  }
}
