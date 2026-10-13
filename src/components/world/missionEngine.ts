// MANIFOLD WORLD - MISSION ENGINE & OBJECTIVES SYSTEM
// Manages mission states, briefings, timers, checkpoint detection, cargo integrity, and rewards

export type MissionId = 'MISSION_A_DELIVERY' | 'MISSION_B_RACE';
export type MissionState = 'IDLE' | 'BRIEFING' | 'COUNTDOWN' | 'ACTIVE' | 'COMPLETED' | 'FAILED';

export interface MissionDef {
  id: MissionId;
  title: string;
  category: 'LOGISTICS' | 'STREET_RACE';
  subTitle: string;
  briefing: string;
  startLocationName: string;
  destinationName: string;
  startX: number;
  startZ: number;
  destX: number;
  destZ: number;
  destRadius: number;
  timeLimitSec: number;
  baseRewardCredits: number;
  reputationXP: number;
}

export const MISSIONS_CATALOG: Record<MissionId, MissionDef> = {
  MISSION_A_DELIVERY: {
    id: 'MISSION_A_DELIVERY',
    title: 'Mainland Cargo Rush',
    category: 'LOGISTICS',
    subTitle: 'High-Priority ECU Component Delivery',
    briefing:
      'Transport high-performance prototype ECU hardware from Yaba Innovation Hub to Mainland Express Depot in Surulere. Avoid heavy traffic collisions to prevent cargo damage, and deliver before the shipping bay closes.',
    startLocationName: 'Yaba Innovation Hub (North)',
    destinationName: 'Mainland Express Cargo Terminal (South-West)',
    startX: 0,
    startZ: -125,
    destX: -55,
    destZ: 100,
    destRadius: 15,
    timeLimitSec: 95,
    baseRewardCredits: 500,
    reputationXP: 150,
  },
  MISSION_B_RACE: {
    id: 'MISSION_B_RACE',
    title: 'City Rival Challenge',
    category: 'STREET_RACE',
    subTitle: 'Mainland Grand Prix Street Race',
    briefing:
      'Line up at the Surulere street circuit starting grid against three of Lagos Mainland’s most notorious rival drivers: Tariq in his GT Coupe, Chidi in the heavy Vanguard SUV, and Amara in the Prestige Turbo. Race through 10 checkpoints across Yaba and Surulere to claim victory.',
    startLocationName: 'Surulere Grid Start',
    destinationName: 'Mainland Grand Prix Finish Line',
    startX: -50,
    startZ: -130,
    destX: -50,
    destZ: -130,
    destRadius: 12,
    timeLimitSec: 180,
    baseRewardCredits: 1000,
    reputationXP: 300,
  },
};

export interface ActiveMissionSession {
  missionId: MissionId;
  state: MissionState;
  timeRemainingSec: number;
  cargoIntegrityPercent: number; // For Delivery Mission
  countdownVal: number; // 3, 2, 1, 0 for Race
  currentRaceCheckpointIdx: number; // For Race Mission (0 to 9)
  playerRaceRank: number; // 1 to 4
  totalRaceCheckpoints: number;
  resultSummary?: {
    success: boolean;
    creditsEarned: number;
    xpEarned: number;
    message: string;
    finishPosition?: number;
  };
}

export class MissionManager {
  public session: ActiveMissionSession | null = null;
  private onAwardCreditsCallback?: (credits: number, reason: string) => void;

  constructor(onAwardCredits?: (credits: number, reason: string) => void) {
    this.onAwardCreditsCallback = onAwardCredits;
  }

  public setRewardCallback(cb: (credits: number, reason: string) => void) {
    this.onAwardCreditsCallback = cb;
  }

  public openBriefing(missionId: MissionId): ActiveMissionSession {
    const def = MISSIONS_CATALOG[missionId];
    this.session = {
      missionId,
      state: 'BRIEFING',
      timeRemainingSec: def.timeLimitSec,
      cargoIntegrityPercent: 100,
      countdownVal: 3,
      currentRaceCheckpointIdx: 0,
      playerRaceRank: 1,
      totalRaceCheckpoints: 10,
    };
    return this.session;
  }

  public startMission(): ActiveMissionSession | null {
    if (!this.session) return null;

    if (this.session.missionId === 'MISSION_B_RACE') {
      this.session.state = 'COUNTDOWN';
      this.session.countdownVal = 3;
    } else {
      this.session.state = 'ACTIVE';
    }
    return this.session;
  }

  public update(
    delta: number,
    playerPos: { x: number; z: number; speed: number },
    onCollisionImpact?: boolean
  ): ActiveMissionSession | null {
    if (!this.session) return null;

    // Handle Countdown State
    if (this.session.state === 'COUNTDOWN') {
      this.session.countdownVal -= delta;
      if (this.session.countdownVal <= 0) {
        this.session.state = 'ACTIVE';
      }
      return this.session;
    }

    if (this.session.state !== 'ACTIVE') return this.session;

    const def = MISSIONS_CATALOG[this.session.missionId];

    // Decrement Timer
    this.session.timeRemainingSec = Math.max(0, this.session.timeRemainingSec - delta);

    // Fail if time ran out
    if (this.session.timeRemainingSec <= 0) {
      this.session.state = 'FAILED';
      this.session.resultSummary = {
        success: false,
        creditsEarned: 0,
        xpEarned: 0,
        message: 'Time expired before completing the objective.',
      };
      return this.session;
    }

    // 1. DELIVERY MISSION LOGIC
    if (this.session.missionId === 'MISSION_A_DELIVERY') {
      // Reduce cargo health on heavy collision
      if (onCollisionImpact) {
        this.session.cargoIntegrityPercent = Math.max(0, this.session.cargoIntegrityPercent - 14);
        if (this.session.cargoIntegrityPercent <= 0) {
          this.session.state = 'FAILED';
          this.session.resultSummary = {
            success: false,
            creditsEarned: 0,
            xpEarned: 0,
            message: 'Cargo was destroyed due to excessive vehicle collisions.',
          };
          return this.session;
        }
      }

      // Check arrival at Mainland Cargo Depot
      const distToDest = Math.hypot(playerPos.x - def.destX, playerPos.z - def.destZ);
      if (distToDest < def.destRadius && Math.abs(playerPos.speed) < 14) {
        // Complete mission
        this.session.state = 'COMPLETED';
        const earned = Math.round(def.baseRewardCredits * (this.session.cargoIntegrityPercent / 100));
        this.session.resultSummary = {
          success: true,
          creditsEarned: earned,
          xpEarned: def.reputationXP,
          message: `Delivery successfully completed with ${this.session.cargoIntegrityPercent}% cargo integrity!`,
        };
        this.onAwardCreditsCallback?.(earned, `Mission: ${def.title} Completed`);
        return this.session;
      }
    }

    return this.session;
  }

  // Handle Race Checkpoint trigger for Mission B
  public onPlayerReachRaceCheckpoint(checkpointIdx: number, rank: number): ActiveMissionSession | null {
    if (!this.session || this.session.missionId !== 'MISSION_B_RACE' || this.session.state !== 'ACTIVE') {
      return this.session;
    }

    this.session.currentRaceCheckpointIdx = checkpointIdx;
    this.session.playerRaceRank = rank;

    // If final checkpoint (Finish Line) reached
    if (checkpointIdx >= this.session.totalRaceCheckpoints) {
      this.session.state = 'COMPLETED';
      const def = MISSIONS_CATALOG.MISSION_B_RACE;

      let reward = 1000;
      if (rank === 2) reward = 600;
      else if (rank === 3) reward = 300;
      else if (rank >= 4) reward = 100;

      this.session.resultSummary = {
        success: rank <= 3,
        creditsEarned: reward,
        xpEarned: rank === 1 ? 300 : rank === 2 ? 180 : 100,
        finishPosition: rank,
        message:
          rank === 1
            ? 'Victory! You took 1st Place in the Mainland Grand Prix!'
            : `Race Finished! You crossed the line in ${rank}th place.`,
      };

      this.onAwardCreditsCallback?.(reward, `Race Result: ${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : 'rd'} Place`);
    }

    return this.session;
  }

  public abandonMission() {
    this.session = null;
  }
}
