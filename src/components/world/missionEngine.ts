// MANIFOLD WORLD - EXPANDED MISSION ENGINE & OBJECTIVES SYSTEM
// 12 verified Lagos missions across NEAR, FAR, and VERY_FAR tiers:
//   - Multi-checkpoint progression + final destination beacons
//   - Cargo delivery integrity tracking (DELIVERY / SHOWROOM)
//   - Zero-collision executive runs (requiresNoCollision)
//   - Park-gear precision stops (requireParkGear -> requires selectedGear === 'P' inside destination)
//   - 10-checkpoint Mainland Grand Prix street race (STREET_RACE)

import { TransmissionGear } from './worldModels';
import { RIVAL_RACE_CHECKPOINTS, WORLD_XZ_SCALE } from './lagosCityData';

const S = WORLD_XZ_SCALE;
const sc = (val: number) => Math.round(val * S * 100) / 100;

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
export type MissionState =
  | 'IDLE'
  | 'BRIEFING'
  | 'COUNTDOWN'
  | 'ACTIVE'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILING'
  | 'FAILED'
  | 'FAILURE_SYNC_FAILED'
  | 'VERIFICATION_FAILED'
  | 'ABANDONING'
  | 'ABANDON_FAILED';

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
  is_active?: boolean;
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
    startZ: sc(-125),
    destX: sc(-55),
    destZ: sc(100),
    destRadius: 15,
    checkpoints: [],
    distanceMeters: Math.round(480 * S),
    estimatedMinutes: 2,
    timeLimitSec: Math.round(95 * 1.45),
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
    startZ: sc(-80),
    destX: sc(160),
    destZ: sc(30),
    destRadius: 16,
    checkpoints: [{ x: sc(105), z: 0, radius: 14, name: 'Bank Row Junction' }],
    distanceMeters: Math.round(420 * S),
    estimatedMinutes: 2,
    timeLimitSec: Math.round(90 * 1.45),
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
    startZ: sc(10),
    destX: sc(56),
    destZ: sc(16),
    destRadius: 12,
    checkpoints: [{ x: 0, z: sc(100), radius: 14, name: 'Grand Marketplace Gate' }],
    distanceMeters: Math.round(340 * S),
    estimatedMinutes: 1,
    timeLimitSec: Math.round(85 * 1.45),
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
    startX: sc(105),
    startZ: 0,
    destX: 0,
    destZ: sc(-35),
    destRadius: 11,
    checkpoints: [],
    distanceMeters: Math.round(260 * S),
    estimatedMinutes: 1,
    timeLimitSec: Math.round(70 * 1.45),
    baseRewardCredits: 420,
    reputationXP: 140,
    difficulty: 'Easy',
    cooldownSec: 60,
    requireParkGear: true,
  },
  {
    id: 'MISSION_B_RACE',
    title: 'Lagos Coastal Highway Grand Prix',
    category: 'STREET_RACE',
    distanceCategory: 'NEAR',
    subTitle: 'Victoria Island -> Epe 4-Lane Oceanfront Race',
    briefing:
      'Line up against Tariq, Chidi, Amara, and Tunde across the 10-checkpoint Lagos Coastal Highway from Victoria Island to Epe.',
    startLocationName: 'Victoria Island Coastal Grid',
    destinationName: 'Epe Coastal Finish Gantry',
    startX: sc(198),
    startZ: sc(320) + 4,
    destX: sc(2220),
    destZ: sc(320),
    destRadius: 16,
    checkpoints: RIVAL_RACE_CHECKPOINTS.map((cp) => ({
      x: cp.x,
      z: cp.z,
      radius: cp.radius,
      name: cp.name,
    })),
    distanceMeters: Math.round(2020 * S * 1.5),
    estimatedMinutes: 3,
    timeLimitSec: Math.round(220 * 1.45),
    baseRewardCredits: 1500,
    reputationXP: 400,
    rewardBadge: 'Coastal Highway Grand Prix Finisher',
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
      'Transport diplomatic guests via Adekunle Interchange straight to Bourdillon Towers in Ikoyi. Fixed participation credits/XP apply.',
    startLocationName: 'Showroom Esplanade',
    destinationName: 'Ikoyi Bourdillon Towers',
    startX: 0,
    startZ: sc(10),
    destX: sc(365),
    destZ: sc(-130),
    destRadius: 16,
    checkpoints: [{ x: sc(160), z: sc(-130), radius: 16, name: 'Adekunle Interchange' }],
    distanceMeters: Math.round(1050 * S),
    estimatedMinutes: 3,
    timeLimitSec: Math.round(135 * 1.45),
    baseRewardCredits: 1200,
    reputationXP: 340,
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
    startX: sc(160),
    startZ: sc(30),
    destX: sc(660),
    destZ: sc(-20),
    destRadius: 16,
    checkpoints: [
      { x: sc(365), z: sc(-20), radius: 16, name: 'Ikoyi Link Bridgehead' },
      { x: sc(520), z: sc(-20), radius: 18, name: 'Cable Pylon Crest' },
    ],
    distanceMeters: Math.round(1180 * S),
    estimatedMinutes: 3,
    timeLimitSec: Math.round(140 * 1.45),
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
    startZ: sc(-130),
    destX: 0,
    destZ: sc(-880),
    destRadius: 16,
    checkpoints: [
      { x: 0, z: sc(-320), radius: 18, name: 'TMB Center South' },
      { x: 0, z: sc(-555), radius: 18, name: 'TMB North Deck' },
      { x: 0, z: sc(-640), radius: 18, name: 'Iyana-Oworo Interchange' },
    ],
    distanceMeters: Math.round(1450 * S),
    estimatedMinutes: 2,
    timeLimitSec: Math.round(125 * 1.45),
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
    startZ: sc(-880),
    destX: sc(-260),
    destZ: sc(-640),
    destRadius: 16,
    checkpoints: [
      { x: sc(-130), z: sc(-880), radius: 16, name: 'Ikeja Along' },
      { x: sc(-260), z: sc(-760), radius: 16, name: 'Dopemu Bridge Link' },
    ],
    distanceMeters: Math.round(1120 * S),
    estimatedMinutes: 3,
    timeLimitSec: Math.round(150 * 1.45),
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
    startZ: sc(-35),
    destX: sc(1565),
    destZ: sc(100),
    destRadius: 18,
    checkpoints: [
      { x: sc(260), z: sc(-20), radius: 18, name: 'Ikoyi Estates Blvd' },
      { x: sc(660), z: sc(-20), radius: 18, name: 'Lekki Phase 1' },
      { x: sc(1135), z: sc(100), radius: 18, name: 'Ajah Express Overpass' },
      { x: sc(1388), z: sc(100), radius: 18, name: 'Epe Lagoon Bridge' },
    ],
    distanceMeters: Math.round(3150 * S),
    estimatedMinutes: 5,
    timeLimitSec: Math.round(260 * 1.45),
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
    startZ: sc(10),
    destX: sc(-875),
    destZ: sc(-660),
    destRadius: 18,
    checkpoints: [
      { x: 0, z: sc(-640), radius: 18, name: 'Iyana-Oworo' },
      { x: sc(-260), z: sc(-640), radius: 18, name: 'Oshodi Terminal' },
      { x: sc(-550), z: sc(-790), radius: 18, name: 'Igando Transit Hub' },
    ],
    distanceMeters: Math.round(3400 * S),
    estimatedMinutes: 5,
    timeLimitSec: Math.round(290 * 1.45),
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
    startX: sc(1495),
    startZ: sc(100),
    destX: sc(-790),
    destZ: sc(-660),
    destRadius: 18,
    checkpoints: [
      { x: sc(1015), z: sc(100), radius: 18, name: 'VGC Interchange' },
      { x: sc(520), z: sc(-20), radius: 18, name: 'Ikoyi-Lekki Bridge' },
      { x: 0, z: sc(-130), radius: 18, name: 'Yaba Approach' },
      { x: 0, z: sc(-640), radius: 18, name: 'Iyana-Oworo' },
    ],
    distanceMeters: Math.round(4450 * S),
    estimatedMinutes: 6,
    timeLimitSec: Math.round(360 * 1.45),
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

export interface MissionCompletionTelemetry {
  finalX: number;
  finalZ: number;
  gear: TransmissionGear;
  collisionCount: number;
  finishRank?: number | null;
  cargoIntegrityPercent?: number;
}

export type CheckpointFailureType = 'NETWORK' | 'PERMANENT';

export interface PendingCheckpointSync {
  index: number;
  x: number;
  z: number;
  name: string;
  status: 'PENDING' | 'FAILED';
  failureType?: CheckpointFailureType;
  retryable?: boolean;
  attempts: number;
  errorMessage?: string;
}

export interface ActiveMissionSession {
  missionId: MissionId;
  state: MissionState;
  timeRemainingSec: number;
  cargoIntegrityPercent: number;
  collisionCount: number;
  countdownVal: number;
  currentCheckpointIdx: number; // local reached count: 0 .. def.checkpoints.length
  acknowledgedCheckpointIdx: number; // server-acknowledged count: 0 .. totalCheckpointsRequired
  totalCheckpointsRequired: number;
  pendingCheckpoint: PendingCheckpointSync | null;
  bufferedCheckpoints: Array<{ index: number; x: number; z: number; name: string }>;
  currentRaceCheckpointIdx: number;
  playerRaceRank: number;
  totalRaceCheckpoints: number;
  runToken?: string;
  completionSubmitted?: boolean;
  rewardClaimed?: boolean;
  insideDestAwaitingPark?: boolean;
  pendingCompletion?: {
    provisionalReason: string;
    telemetry: MissionCompletionTelemetry;
    finishPosition?: number;
  };
  pendingFailure?: {
    failureReason: string;
    telemetry: MissionCompletionTelemetry;
  };
  provisionalRewardPreview: {
    credits: number;
    xp: number;
    badge: string | null;
  };
  resultSummary?: {
    success: boolean;
    persisted?: boolean;
    checkpointReportsAccepted?: boolean;
    serverVerified?: boolean;
    creditsEarned: number;
    xpEarned: number;
    rewardBadge?: string | null;
    message: string;
    finishPosition?: number;
  };
}

export type MissionCompletedCallback = (
  missionId: MissionId,
  success: boolean,
  credits: number,
  xp: number,
  reason: string,
  runToken: string | undefined,
  telemetry: MissionCompletionTelemetry,
  rewardBadge?: string | null
) => void;

export type MissionCheckpointCallback = (
  missionId: MissionId,
  checkpointIdx: number,
  x: number,
  z: number,
  runToken?: string
) => void;

export type MissionAbandonCallback = (
  missionId: MissionId,
  runToken: string
) => void;

export class MissionManager {
  public session: ActiveMissionSession | null = null;
  private onMissionCompletedCallback?: MissionCompletedCallback;
  private onCheckpointReachedCallback?: MissionCheckpointCallback;
  private onAbandonMissionCallback?: MissionAbandonCallback;

  constructor(onMissionCompleted?: MissionCompletedCallback) {
    this.onMissionCompletedCallback = onMissionCompleted;
  }

  public setCompletionCallback(cb: MissionCompletedCallback) {
    this.onMissionCompletedCallback = cb;
  }

  public setCheckpointCallback(cb: MissionCheckpointCallback) {
    this.onCheckpointReachedCallback = cb;
  }

  public setAbandonCallback(cb: MissionAbandonCallback) {
    this.onAbandonMissionCallback = cb;
  }

  public getMissionDef(missionId: MissionId, overrides?: Record<string, Partial<MissionDef>>): MissionDef {
    const base = MISSIONS_CATALOG[missionId] || MISSIONS_CATALOG_LIST[0];
    if (!overrides || !overrides[missionId]) return base;
    return { ...base, ...overrides[missionId] };
  }

  public hasUnfinalizedServerRun(): boolean {
    if (!this.session || !this.session.runToken) return false;
    return (
      this.session.state !== 'IDLE' &&
      this.session.state !== 'BRIEFING' &&
      this.session.state !== 'COMPLETED' &&
      this.session.state !== 'FAILED'
    );
  }

  public openBriefing(missionId: MissionId, overrides?: Record<string, Partial<MissionDef>>): ActiveMissionSession {
    const def = this.getMissionDef(missionId, overrides);
    const totalRaceCheckpoints =
      def.category === 'STREET_RACE' && def.checkpoints.length > 0
        ? def.checkpoints.length
        : RIVAL_RACE_CHECKPOINTS.length;
    const totalCheckpointsRequired =
      def.category === 'STREET_RACE' ? totalRaceCheckpoints : def.checkpoints.length;

    this.session = {
      missionId,
      state: 'BRIEFING',
      timeRemainingSec: def.timeLimitSec,
      cargoIntegrityPercent: 100,
      collisionCount: 0,
      countdownVal: 3,
      currentCheckpointIdx: 0,
      acknowledgedCheckpointIdx: 0,
      totalCheckpointsRequired,
      pendingCheckpoint: null,
      bufferedCheckpoints: [],
      currentRaceCheckpointIdx: 0,
      playerRaceRank: 1,
      totalRaceCheckpoints,
      completionSubmitted: false,
      rewardClaimed: false,
      insideDestAwaitingPark: false,
      provisionalRewardPreview: {
        credits: def.baseRewardCredits,
        xp: def.reputationXP,
        badge:
          def.id === 'MISSION_B_RACE'
            ? 'Mainland Circuit Participant'
            : def.requiresNoCollision || def.requireParkGear
            ? null
            : def.rewardBadge || null,
      },
    };
    return this.session;
  }

  public startMission(
    runToken: string,
    timeLimitOverrideSec?: number,
    overrides?: Record<string, Partial<MissionDef>>
  ): ActiveMissionSession | null {
    if (!this.session || !runToken) return null;
    const def = this.getMissionDef(this.session.missionId, overrides);
    const totalRaceCheckpoints =
      def.category === 'STREET_RACE' && def.checkpoints.length > 0
        ? def.checkpoints.length
        : RIVAL_RACE_CHECKPOINTS.length;
    const totalCheckpointsRequired =
      def.category === 'STREET_RACE' ? totalRaceCheckpoints : def.checkpoints.length;

    this.session.runToken = runToken;
    this.session.completionSubmitted = false;
    this.session.rewardClaimed = false;
    this.session.collisionCount = 0;
    this.session.currentCheckpointIdx = 0;
    this.session.acknowledgedCheckpointIdx = 0;
    this.session.totalCheckpointsRequired = totalCheckpointsRequired;
    this.session.pendingCheckpoint = null;
    this.session.bufferedCheckpoints = [];
    this.session.pendingCompletion = undefined;
    this.session.pendingFailure = undefined;
    this.session.resultSummary = undefined;
    this.session.timeRemainingSec =
      typeof timeLimitOverrideSec === 'number' && timeLimitOverrideSec > 0
        ? timeLimitOverrideSec
        : def.timeLimitSec;

    if (def.category === 'STREET_RACE') {
      this.session.state = 'COUNTDOWN';
      this.session.countdownVal = 3;
      this.session.currentRaceCheckpointIdx = 0;
      this.session.totalRaceCheckpoints = totalRaceCheckpoints;
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

  private enqueueCheckpoint(index: number, x: number, z: number, name: string) {
    if (!this.session || !this.session.runToken) return;
    if (index < this.session.acknowledgedCheckpointIdx) return;
    if (this.session.pendingCheckpoint?.index === index) return;
    if (this.session.bufferedCheckpoints.some((b) => b.index === index)) return;

    this.session.bufferedCheckpoints.push({ index, x, z, name });
    this.session.bufferedCheckpoints.sort((a, b) => a.index - b.index);
    this.dispatchNextCheckpoint();
  }

  private dispatchNextCheckpoint() {
    if (!this.session || !this.session.runToken) return;
    if (
      this.session.state === 'FAILING' ||
      this.session.state === 'FAILED' ||
      this.session.state === 'FAILURE_SYNC_FAILED' ||
      this.session.state === 'COMPLETED' ||
      this.session.state === 'ABANDONING' ||
      this.session.state === 'ABANDON_FAILED'
    ) {
      return;
    }

    // Do not submit next checkpoint while an earlier checkpoint is still PENDING or FAILED
    if (this.session.pendingCheckpoint) return;

    // Discard any already-acknowledged entries from queue head
    while (
      this.session.bufferedCheckpoints.length > 0 &&
      this.session.bufferedCheckpoints[0].index < this.session.acknowledgedCheckpointIdx
    ) {
      this.session.bufferedCheckpoints.shift();
    }

    const next = this.session.bufferedCheckpoints[0];
    if (!next || next.index !== this.session.acknowledgedCheckpointIdx) {
      return;
    }

    this.session.bufferedCheckpoints.shift();
    this.session.pendingCheckpoint = {
      index: next.index,
      x: next.x,
      z: next.z,
      name: next.name,
      status: 'PENDING',
      attempts: 1,
    };

    this.onCheckpointReachedCallback?.(
      this.session.missionId,
      next.index,
      next.x,
      next.z,
      this.session.runToken
    );
  }

  public applyCheckpointSyncResult(
    missionId: MissionId,
    runToken: string | undefined,
    checkpointIndex: number,
    result: {
      recorded: boolean;
      alreadyRecorded?: boolean;
      expired?: boolean;
      rejected?: boolean;
      networkError?: boolean;
      message?: string;
    }
  ): ActiveMissionSession | null {
    if (!this.session || this.session.missionId !== missionId || this.session.runToken !== runToken) {
      return this.session;
    }

    if (result.recorded || result.alreadyRecorded) {
      const nextAck = Math.min(
        this.session.totalCheckpointsRequired,
        Math.max(this.session.acknowledgedCheckpointIdx, checkpointIndex + 1)
      );
      this.session.acknowledgedCheckpointIdx = nextAck;
      this.session.bufferedCheckpoints = this.session.bufferedCheckpoints.filter(
        (b) => b.index >= nextAck
      );
      if (
        this.session.pendingCheckpoint &&
        this.session.pendingCheckpoint.index <= checkpointIndex
      ) {
        this.session.pendingCheckpoint = null;
      }

      if (this.session.state === 'ACTIVE' || this.session.state === 'VERIFYING') {
        this.dispatchNextCheckpoint();
      }

      if (
        this.session.state === 'VERIFYING' &&
        this.session.pendingCompletion &&
        !this.session.pendingCheckpoint &&
        this.session.acknowledgedCheckpointIdx >= this.session.totalCheckpointsRequired
      ) {
        this.dispatchCompletionSubmission();
      }

      return this.session;
    }

    if (result.expired) {
      // Server checkpoint RPC already marked the DB row as 'failed' due to expiration.
      // Expired runs are terminal and must never resume.
      this.session.pendingCheckpoint = null;
      this.session.bufferedCheckpoints = [];
      this.session.pendingCompletion = undefined;
      this.session.completionSubmitted = true;
      this.session.rewardClaimed = false;
      this.session.state = 'FAILED';
      this.session.resultSummary = {
        success: false,
        persisted: true,
        checkpointReportsAccepted: false,
        serverVerified: false,
        creditsEarned: 0,
        xpEarned: 0,
        rewardBadge: null,
        message: result.message || 'Server time limit exceeded before checkpoint.',
      };
      return this.session;
    }

    const rawMsg = result.message || '';
    const lowerMsg = rawMsg.toLowerCase();
    const isPermanent = !result.networkError && Boolean(result.rejected);
    const isTerminalInactive =
      isPermanent &&
      (lowerMsg.includes('no longer active') ||
        lowerMsg.includes('run record not found') ||
        lowerMsg.includes('mission not found or inactive'));

    if (isTerminalInactive) {
      this.session.pendingCheckpoint = null;
      this.session.bufferedCheckpoints = [];
      this.session.pendingCompletion = undefined;
      this.session.completionSubmitted = true;
      this.session.rewardClaimed = false;
      this.session.state = 'FAILED';
      this.session.resultSummary = {
        success: false,
        persisted: true,
        checkpointReportsAccepted: false,
        serverVerified: false,
        creditsEarned: 0,
        xpEarned: 0,
        rewardBadge: null,
        message: rawMsg || 'Mission run is no longer active on the server.',
      };
      return this.session;
    }

    if (this.session.pendingCheckpoint && this.session.pendingCheckpoint.index === checkpointIndex) {
      this.session.pendingCheckpoint = {
        ...this.session.pendingCheckpoint,
        status: 'FAILED',
        failureType: isPermanent ? 'PERMANENT' : 'NETWORK',
        retryable: !isPermanent,
        errorMessage:
          rawMsg ||
          (isPermanent
            ? 'Checkpoint rejected by server. Re-drive through the checkpoint or abandon the run.'
            : 'Checkpoint sync failed. Check connection and retry.'),
      };
    }

    return this.session;
  }

  public retryPendingCheckpoint(): ActiveMissionSession | null {
    if (!this.session || !this.session.runToken || !this.session.pendingCheckpoint) {
      return this.session;
    }
    if (this.session.state !== 'ACTIVE' && this.session.state !== 'VERIFYING') {
      return this.session;
    }
    const cp = this.session.pendingCheckpoint;
    if (cp.status !== 'FAILED') {
      return this.session;
    }
    // Only transient network failures may retry the exact same checkpoint coordinates.
    // Permanent rejections must use recoverPermanentCheckpoint() (fresh drive-through) or abandon.
    if (cp.failureType !== 'NETWORK' || !cp.retryable) {
      return this.session;
    }

    this.session.pendingCheckpoint = {
      ...cp,
      status: 'PENDING',
      failureType: undefined,
      retryable: undefined,
      attempts: cp.attempts + 1,
      errorMessage: undefined,
    };

    this.onCheckpointReachedCallback?.(
      this.session.missionId,
      cp.index,
      cp.x,
      cp.z,
      this.session.runToken
    );

    return this.session;
  }

  /**
   * Safe recovery path after a permanent checkpoint rejection (e.g., outside zone,
   * implausible travel speed, out-of-order). Rewinds local waypoint progress back to the
   * last server-acknowledged checkpoint so the player must physically re-drive through
   * the checkpoint to emit fresh coordinates. Never allowed on expired/FAILED runs.
   */
  public recoverPermanentCheckpoint(): ActiveMissionSession | null {
    if (!this.session || !this.session.runToken) {
      return this.session;
    }
    if (
      this.session.state === 'FAILED' ||
      this.session.state === 'FAILING' ||
      this.session.state === 'FAILURE_SYNC_FAILED' ||
      this.session.state === 'COMPLETED' ||
      this.session.state === 'ABANDONING' ||
      this.session.state === 'ABANDON_FAILED'
    ) {
      return this.session;
    }
    if (this.session.timeRemainingSec <= 0) {
      return this.session;
    }
    const cp = this.session.pendingCheckpoint;
    if (!cp || cp.status !== 'FAILED' || cp.failureType !== 'PERMANENT') {
      return this.session;
    }

    const ackIdx = this.session.acknowledgedCheckpointIdx;
    this.session.pendingCheckpoint = null;
    this.session.bufferedCheckpoints = this.session.bufferedCheckpoints.filter(
      (b) => b.index < ackIdx
    );
    this.session.currentCheckpointIdx = ackIdx;
    this.session.currentRaceCheckpointIdx = ackIdx;
    this.session.insideDestAwaitingPark = false;

    if (this.session.state === 'VERIFYING') {
      this.session.state = 'ACTIVE';
      this.session.completionSubmitted = false;
      this.session.pendingCompletion = undefined;
      this.session.resultSummary = undefined;
    }

    return this.session;
  }

  private finalizeFailure(def: MissionDef, message: string, telemetry: MissionCompletionTelemetry) {
    if (
      !this.session ||
      this.session.completionSubmitted ||
      this.session.state === 'FAILING' ||
      this.session.state === 'FAILED' ||
      this.session.state === 'FAILURE_SYNC_FAILED' ||
      this.session.state === 'COMPLETED' ||
      this.session.state === 'ABANDONING'
    ) {
      return;
    }
    this.session.completionSubmitted = true;
    this.session.rewardClaimed = false;
    this.session.pendingCompletion = undefined;
    this.session.pendingFailure = {
      failureReason: message,
      telemetry,
    };

    if (!this.session.runToken) {
      this.session.state = 'FAILED';
      this.session.resultSummary = {
        success: false,
        persisted: false,
        creditsEarned: 0,
        xpEarned: 0,
        rewardBadge: null,
        message,
      };
      return;
    }

    this.session.state = 'FAILING';
    this.session.resultSummary = {
      success: false,
      persisted: false,
      creditsEarned: 0,
      xpEarned: 0,
      rewardBadge: null,
      message,
    };
    this.onMissionCompletedCallback?.(
      this.session.missionId,
      false,
      0,
      0,
      message || `Mission Failed: ${def.title}`,
      this.session.runToken,
      telemetry,
      null
    );
  }

  public applyServerFailureResult(
    missionId: MissionId,
    runToken: string | undefined,
    result: {
      persisted: boolean;
      alreadyFinalized?: boolean;
      status?: string;
      failureReason?: string;
      creditsAwarded?: number;
      xpAwarded?: number;
      rewardBadge?: string | null;
      message?: string;
    }
  ): ActiveMissionSession | null {
    if (!this.session || this.session.missionId !== missionId || this.session.runToken !== runToken) {
      return this.session;
    }

    const fallbackReason =
      this.session.pendingFailure?.failureReason ||
      this.session.resultSummary?.message ||
      'Mission failed.';
    const normalizedStatus =
      typeof result.status === 'string' ? result.status.trim().toLowerCase() : '';

    if (result.alreadyFinalized) {
      if (normalizedStatus === 'failed') {
        this.session.rewardClaimed = false;
        this.session.pendingFailure = undefined;
        this.session.pendingCompletion = undefined;
        this.session.pendingCheckpoint = null;
        this.session.state = 'FAILED';
        this.session.resultSummary = {
          success: false,
          persisted: true,
          checkpointReportsAccepted: false,
          serverVerified: false,
          creditsEarned: 0,
          xpEarned: 0,
          rewardBadge: null,
          message: result.failureReason || result.message || fallbackReason,
        };
        return this.session;
      }

      if (normalizedStatus === 'completed') {
        // Run already completed on server: reconcile locally as COMPLETED without submitting another reward.
        this.session.completionSubmitted = true;
        this.session.rewardClaimed = true;
        this.session.pendingFailure = undefined;
        this.session.pendingCompletion = undefined;
        this.session.pendingCheckpoint = null;
        this.session.state = 'COMPLETED';
        this.session.resultSummary = {
          success: true,
          persisted: true,
          checkpointReportsAccepted: true,
          serverVerified: false,
          creditsEarned: result.creditsAwarded ?? 0,
          xpEarned: result.xpAwarded ?? 0,
          rewardBadge: result.rewardBadge ?? null,
          message:
            result.message ||
            'Mission run was already completed and saved on the server.',
        };
        return this.session;
      }

      if (normalizedStatus === 'abandoned') {
        this.session = null;
        return null;
      }

      // Unknown or inconsistent status: preserve session and surface reconciliation error.
      this.session.rewardClaimed = false;
      this.session.state = 'FAILURE_SYNC_FAILED';
      this.session.resultSummary = {
        success: false,
        persisted: false,
        checkpointReportsAccepted: false,
        serverVerified: false,
        creditsEarned: 0,
        xpEarned: 0,
        rewardBadge: null,
        message: normalizedStatus
          ? `Reconciliation error: server reported unexpected finalized status "${result.status}" while recording failure.`
          : result.message ||
            'Reconciliation error: server reported run already finalized without a valid status.',
      };
      return this.session;
    }

    if (result.persisted && (!normalizedStatus || normalizedStatus === 'failed')) {
      this.session.rewardClaimed = false;
      this.session.pendingFailure = undefined;
      this.session.pendingCompletion = undefined;
      this.session.pendingCheckpoint = null;
      this.session.state = 'FAILED';
      this.session.resultSummary = {
        success: false,
        persisted: true,
        checkpointReportsAccepted: false,
        serverVerified: false,
        creditsEarned: 0,
        xpEarned: 0,
        rewardBadge: null,
        message: result.failureReason || result.message || fallbackReason,
      };
    } else if (result.persisted && normalizedStatus !== 'failed') {
      this.session.rewardClaimed = false;
      this.session.state = 'FAILURE_SYNC_FAILED';
      this.session.resultSummary = {
        success: false,
        persisted: false,
        checkpointReportsAccepted: false,
        serverVerified: false,
        creditsEarned: 0,
        xpEarned: 0,
        rewardBadge: null,
        message: `Reconciliation error: server returned inconsistent status "${result.status}" while persisting failure.`,
      };
    } else {
      this.session.rewardClaimed = false;
      this.session.state = 'FAILURE_SYNC_FAILED';
      this.session.resultSummary = {
        success: false,
        persisted: false,
        checkpointReportsAccepted: false,
        serverVerified: false,
        creditsEarned: 0,
        xpEarned: 0,
        rewardBadge: null,
        message:
          result.message ||
          `Unable to record mission failure on server (${fallbackReason}). Retry or abandon.`,
      };
    }

    return this.session;
  }

  public retryFailureSubmission(): ActiveMissionSession | null {
    if (
      !this.session ||
      this.session.state !== 'FAILURE_SYNC_FAILED' ||
      !this.session.pendingFailure ||
      !this.session.runToken
    ) {
      return this.session;
    }

    const pending = this.session.pendingFailure;
    this.session.state = 'FAILING';
    this.session.resultSummary = {
      success: false,
      persisted: false,
      creditsEarned: 0,
      xpEarned: 0,
      rewardBadge: null,
      message: pending.failureReason,
    };

    this.onMissionCompletedCallback?.(
      this.session.missionId,
      false,
      0,
      0,
      pending.failureReason,
      this.session.runToken,
      pending.telemetry,
      null
    );

    return this.session;
  }

  private dispatchCompletionSubmission() {
    if (!this.session || !this.session.pendingCompletion) return;
    if (this.session.pendingCheckpoint) return;
    if (this.session.acknowledgedCheckpointIdx < this.session.totalCheckpointsRequired) return;

    const def = this.getMissionDef(this.session.missionId);
    const pending = this.session.pendingCompletion;

    // Never pass local provisional credits/XP/badges into completion callback;
    // rewards come exclusively from the server's persisted response.
    this.onMissionCompletedCallback?.(
      this.session.missionId,
      true,
      0,
      0,
      `Mission: ${def.title}`,
      this.session.runToken,
      pending.telemetry,
      null
    );
  }

  private submitForServerVerification(
    def: MissionDef,
    provisionalReason: string,
    telemetry: MissionCompletionTelemetry,
    finishPosition?: number
  ) {
    if (!this.session || this.session.completionSubmitted) return;
    this.session.completionSubmitted = true;
    this.session.rewardClaimed = false;
    this.session.state = 'VERIFYING';
    this.session.pendingCompletion = {
      provisionalReason,
      telemetry,
      finishPosition,
    };
    this.session.resultSummary = {
      success: false,
      persisted: false,
      creditsEarned: 0,
      xpEarned: 0,
      rewardBadge: null,
      message: provisionalReason,
      finishPosition,
    };

    if (!this.session.runToken) {
      this.onMissionCompletedCallback?.(
        this.session.missionId,
        true,
        0,
        0,
        `Mission: ${def.title}`,
        undefined,
        telemetry,
        null
      );
      return;
    }

    if (
      !this.session.pendingCheckpoint &&
      this.session.acknowledgedCheckpointIdx >= this.session.totalCheckpointsRequired
    ) {
      this.dispatchCompletionSubmission();
    } else {
      this.dispatchNextCheckpoint();
    }
  }

  public retryCompletionSubmission(): ActiveMissionSession | null {
    if (
      !this.session ||
      this.session.state !== 'VERIFICATION_FAILED' ||
      !this.session.pendingCompletion ||
      !this.session.runToken
    ) {
      return this.session;
    }

    this.session.state = 'VERIFYING';
    if (
      !this.session.pendingCheckpoint &&
      this.session.acknowledgedCheckpointIdx >= this.session.totalCheckpointsRequired
    ) {
      this.dispatchCompletionSubmission();
    } else {
      this.dispatchNextCheckpoint();
    }
    return this.session;
  }

  public applyServerVerificationResult(
    missionId: MissionId,
    runToken: string | undefined,
    result: {
      persisted: boolean;
      rejected?: boolean;
      reason?: string;
      creditsAwarded?: number;
      xpAwarded?: number;
      rewardBadge?: string | null;
      checkpointReportsAccepted?: boolean;
      serverVerified?: boolean;
    }
  ): ActiveMissionSession | null {
    if (!this.session || this.session.missionId !== missionId || this.session.runToken !== runToken) {
      return this.session;
    }

    const prevFinishPos = this.session.resultSummary?.finishPosition;
    const prevMsg = this.session.resultSummary?.message;

    if (result.persisted && !result.rejected) {
      this.session.rewardClaimed = true;
      this.session.pendingCompletion = undefined;
      this.session.state = 'COMPLETED';
      this.session.resultSummary = {
        success: true,
        persisted: true,
        checkpointReportsAccepted: Boolean(result.checkpointReportsAccepted),
        serverVerified: Boolean(result.serverVerified),
        creditsEarned: result.creditsAwarded ?? 0,
        xpEarned: result.xpAwarded ?? 0,
        rewardBadge: result.rewardBadge ?? null,
        finishPosition: prevFinishPos,
        message:
          prevMsg ||
          'Run accepted by server (run token, deadline & checkpoint reports logged; driving physics simulated client-side).',
      };
    } else if (result.rejected) {
      this.session.rewardClaimed = false;
      this.session.pendingCompletion = undefined;
      this.session.state = 'FAILED';
      this.session.resultSummary = {
        success: false,
        persisted: result.persisted,
        checkpointReportsAccepted: false,
        serverVerified: false,
        creditsEarned: 0,
        xpEarned: 0,
        rewardBadge: null,
        finishPosition: prevFinishPos,
        message: result.reason || 'Mission run failed server validation.',
      };
    } else {
      this.session.rewardClaimed = false;
      this.session.state = 'VERIFICATION_FAILED';
      this.session.resultSummary = {
        success: false,
        persisted: false,
        checkpointReportsAccepted: false,
        serverVerified: false,
        creditsEarned: 0,
        xpEarned: 0,
        rewardBadge: null,
        finishPosition: prevFinishPos,
        message:
          result.reason ||
          'Unable to persist mission run with the server. No rewards were credited.',
      };
    }

    return this.session;
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
        const def = this.getMissionDef(this.session.missionId, overrides);
        if (def.category === 'STREET_RACE' && this.session.currentRaceCheckpointIdx === 0) {
          this.onPlayerReachRaceCheckpoint(1, this.session.playerRaceRank, overrides, {
            x: playerPos.x,
            z: playerPos.z,
            gear: playerPos.gear,
          });
        }
      }
      return this.session;
    }

    if (this.session.state !== 'ACTIVE') return this.session;

    const def = this.getMissionDef(this.session.missionId, overrides);
    const gear = playerPos.gear || 'D1';

    if (onCollisionImpact) {
      this.session.collisionCount += 1;
    }

    const baseTelemetry: MissionCompletionTelemetry = {
      finalX: playerPos.x,
      finalZ: playerPos.z,
      gear,
      collisionCount: this.session.collisionCount,
      cargoIntegrityPercent: this.session.cargoIntegrityPercent,
    };

    // Decrement timer
    this.session.timeRemainingSec = Math.max(0, this.session.timeRemainingSec - delta);
    if (this.session.timeRemainingSec <= 0) {
      this.finalizeFailure(def, 'Time expired before completing the objective.', baseTelemetry);
      return this.session;
    }

    // Zero-collision rule check
    if (onCollisionImpact && def.requiresNoCollision) {
      this.finalizeFailure(
        def,
        'Heavy collision violated the zero-impact VIP escort requirement.',
        baseTelemetry
      );
      return this.session;
    }

    // Cargo health check for logistics runs
    if (onCollisionImpact && (def.category === 'DELIVERY' || def.category === 'SHOWROOM')) {
      this.session.cargoIntegrityPercent = Math.max(0, this.session.cargoIntegrityPercent - 14);
      if (this.session.cargoIntegrityPercent <= 0) {
        this.finalizeFailure(def, 'Cargo was destroyed due to excessive vehicle collisions.', {
          ...baseTelemetry,
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
      const cpIdx = this.session.currentCheckpointIdx;
      const cp = def.checkpoints[cpIdx];
      const distToCp = Math.hypot(playerPos.x - cp.x, playerPos.z - cp.z);
      if (distToCp <= cp.radius) {
        this.session.currentCheckpointIdx += 1;
        this.enqueueCheckpoint(cpIdx, playerPos.x, playerPos.z, cp.name);
      }
      return this.session;
    }

    // Final destination zone check
    const distToDest = Math.hypot(playerPos.x - def.destX, playerPos.z - def.destZ);
    const absSpeed = Math.abs(playerPos.speed);

    if (def.requireParkGear) {
      this.session.insideDestAwaitingPark = distToDest <= def.destRadius;
      if (distToDest <= def.destRadius && absSpeed < 2.2 && gear === 'P') {
        this.submitForServerVerification(
          def,
          `Precision arrival locked in Park (P) gear at ${def.destinationName}!`,
          baseTelemetry
        );
      }
    } else if (distToDest <= def.destRadius && absSpeed < 16) {
      this.submitForServerVerification(
        def,
        `Arrived safely at ${def.destinationName}!`,
        baseTelemetry
      );
    }

    return this.session;
  }

  public onPlayerReachRaceCheckpoint(
    checkpointIdx1Based: number,
    rank: number,
    overrides?: Record<string, Partial<MissionDef>>,
    playerCoords?: { x: number; z: number; gear?: TransmissionGear }
  ): ActiveMissionSession | null {
    if (!this.session || this.session.state !== 'ACTIVE') return this.session;
    const def = this.getMissionDef(this.session.missionId, overrides);
    if (def.category !== 'STREET_RACE') return this.session;
    if (checkpointIdx1Based <= this.session.currentRaceCheckpointIdx) return this.session;

    const cpZeroIdx = Math.max(0, checkpointIdx1Based - 1);
    const cpDef = def.checkpoints[cpZeroIdx] || RIVAL_RACE_CHECKPOINTS[cpZeroIdx];
    const rx = playerCoords?.x ?? cpDef?.x ?? def.destX;
    const rz = playerCoords?.z ?? cpDef?.z ?? def.destZ;

    this.session.currentRaceCheckpointIdx = checkpointIdx1Based;
    this.session.playerRaceRank = rank;

    this.enqueueCheckpoint(
      cpZeroIdx,
      rx,
      rz,
      cpDef?.name || `Checkpoint ${checkpointIdx1Based}`
    );

    if (checkpointIdx1Based >= this.session.totalRaceCheckpoints) {
      this.submitForServerVerification(
        def,
        `Race finished (local HUD P${rank}). Fixed circuit participation rewards apply.`,
        {
          finalX: rx,
          finalZ: rz,
          gear: playerCoords?.gear || 'D1',
          collisionCount: this.session.collisionCount,
          finishRank: rank,
        },
        rank
      );
    }

    return this.session;
  }

  public abandonMission(): { cleared: boolean; pendingServer: boolean } {
    if (!this.session) {
      return { cleared: true, pendingServer: false };
    }

    const { state, missionId, runToken, pendingCheckpoint } = this.session;

    // Non-server states (briefing, missing token) or already-finalized server results clear immediately
    if (state === 'BRIEFING' || !runToken || state === 'COMPLETED' || state === 'FAILED') {
      this.session = null;
      return { cleared: true, pendingServer: false };
    }

    // Do not abandon concurrently while complete_game_mission RPC is actively in-flight
    if (state === 'VERIFYING' && !pendingCheckpoint) {
      return { cleared: false, pendingServer: false };
    }

    // Deduplicate in-flight abandonment
    if (state === 'ABANDONING') {
      return { cleared: false, pendingServer: true };
    }

    this.session.state = 'ABANDONING';
    this.onAbandonMissionCallback?.(missionId, runToken);
    return { cleared: false, pendingServer: true };
  }

  public applyServerAbandonResult(
    missionId: MissionId,
    runToken: string,
    result: {
      abandoned?: boolean;
      alreadyFinalized?: boolean;
      status?: string;
      failureReason?: string | null;
      creditsAwarded?: number;
      xpAwarded?: number;
      rewardBadge?: string | null;
      message?: string;
    }
  ): ActiveMissionSession | null {
    if (!this.session || this.session.missionId !== missionId || this.session.runToken !== runToken) {
      return this.session;
    }

    if (result.alreadyFinalized) {
      const normalizedStatus =
        typeof result.status === 'string' ? result.status.trim().toLowerCase() : '';

      if (normalizedStatus === 'abandoned') {
        this.session = null;
        return null;
      }

      if (normalizedStatus === 'completed') {
        this.session.completionSubmitted = true;
        this.session.rewardClaimed = true;
        this.session.pendingFailure = undefined;
        this.session.pendingCompletion = undefined;
        this.session.pendingCheckpoint = null;
        this.session.state = 'COMPLETED';
        this.session.resultSummary = {
          success: true,
          persisted: true,
          checkpointReportsAccepted: true,
          serverVerified: false,
          creditsEarned: result.creditsAwarded ?? 0,
          xpEarned: result.xpAwarded ?? 0,
          rewardBadge: result.rewardBadge ?? null,
          message:
            result.message ||
            'Mission run was already completed on the server.',
        };
        return this.session;
      }

      if (normalizedStatus === 'failed') {
        this.session.completionSubmitted = true;
        this.session.rewardClaimed = false;
        this.session.pendingFailure = undefined;
        this.session.pendingCompletion = undefined;
        this.session.pendingCheckpoint = null;
        this.session.state = 'FAILED';
        this.session.resultSummary = {
          success: false,
          persisted: true,
          checkpointReportsAccepted: false,
          serverVerified: false,
          creditsEarned: 0,
          xpEarned: 0,
          rewardBadge: null,
          message:
            result.failureReason ||
            result.message ||
            'Mission run had already failed on the server.',
        };
        return this.session;
      }

      this.session.state = 'ABANDON_FAILED';
      this.session.resultSummary = {
        success: false,
        persisted: false,
        creditsEarned: 0,
        xpEarned: 0,
        rewardBadge: null,
        message: normalizedStatus
          ? `Reconciliation error: server reported unexpected finalized status "${result.status}" during abandonment.`
          : result.message ||
            'Reconciliation error: server reported run already finalized without a valid status.',
      };
      return this.session;
    }

    if (result.abandoned) {
      this.session = null;
      return null;
    }

    this.session.state = 'ABANDON_FAILED';
    this.session.resultSummary = {
      success: false,
      persisted: false,
      creditsEarned: 0,
      xpEarned: 0,
      rewardBadge: null,
      message:
        result.message ||
        'Unable to confirm mission abandonment with the server. Please retry.',
    };
    return this.session;
  }

  public retryAbandonment(): { cleared: boolean; pendingServer: boolean } {
    if (!this.session || this.session.state !== 'ABANDON_FAILED') {
      return { cleared: false, pendingServer: false };
    }
    return this.abandonMission();
  }

  public forceClearSession() {
    this.session = null;
  }
}
