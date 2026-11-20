// MANIFOLD WORLD - LAGOS ISLAND, THIRD MAINLAND BRIDGE, ADEKUNLE, OBALENDE, IKOYI,
// IKOYI LINK BRIDGE, LEKKI PENINSULA, IKATE, ELEGANZA, VGC, AJAH FLYOVER, EPE BRIDGE & MAINLAND CITY GRAPH.

export type RoadProfile = 'STANDARD' | 'COASTAL_4LANE' | 'INLET_2LANE';

export interface RoadNode {
  id: string;
  x: number;
  z: number;
  y?: number; // Optional road surface elevation (0 = ground level)
  name?: string;
  roadName?: string;
  district?: string;
  neighbors: string[]; // Connected node IDs (bidirectional)
  speedLimit?: number; // km/h
  isDualCarriageway?: boolean;
  isBridge?: boolean;
  roadProfile?: RoadProfile;
}

export interface CityLandmark {
  id: string;
  name: string;
  subTitle: string;
  district:
    | 'YABA_TECH'
    | 'COMMERCIAL_ROW'
    | 'SURULERE_EXPRESS'
    | 'SHOWROOM_HUB'
    | 'LOGISTICS_DEPOT'
    | 'MARKETPLACE'
    | 'OBALENDE'
    | 'IKOYI'
    | 'LEKKI'
    | 'AJAH'
    | 'EPE'
    | 'COASTAL'
    | 'BRIDGE'
    | 'MAINLAND'
    | 'LASU'
    | 'MARINA'
    | 'AIRPORT'
    | 'MILE2'
    | 'IYANOBA';
  x: number;
  z: number;
  radius: number;
  description: string;
  color: string;
  iconType:
    | 'showroom'
    | 'delivery'
    | 'race'
    | 'bank'
    | 'tech'
    | 'portal'
    | 'bridge'
    | 'campus'
    | 'district'
    | 'epe'
    | 'airport'
    | 'train';
}

export interface BuildingBox {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  name: string;
  type: 'commercial' | 'tech_hub' | 'bank' | 'residential' | 'depot' | 'showroom' | 'campus';
  color: number;
  roofColor: number;
  hasSign?: boolean;
  signText?: string;
}

export interface ElevatedSpanPiece {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  halfWidth: number;
  parapetHalfWidth: number;
  // Optional exit opening along span longitudinal ratio t in [tMin, tMax] on positive side (+right)
  exitGapRightT?: [number, number];
}

export interface ElevatedSpanDef {
  id: string;
  name: string;
  pieces: ElevatedSpanPiece[];
}

export interface SignalizedIntersectionDef {
  nodeId: string;
  phaseOffsetSec: number;
}

export type BarricadeKind =
  | 'GUARDRAIL'
  | 'MEDIAN'
  | 'WALL'
  | 'SEAWALL'
  | 'TOLL_BOOTH'
  | 'SHELTER'
  | 'GANTRY_PILLAR';

export interface BarricadeCollider {
  id: string;
  x: number;
  y: number;
  z: number;
  halfW: number;
  halfD: number;
  angle: number;
  kind: BarricadeKind;
}

export interface InstancedPropPart {
  mesh: {
    setMatrixAt: (index: number, matrix: any) => void;
    instanceMatrix: { needsUpdate: boolean };
  };
  index: number;
  /** 4x4 column-major transform relative to the prop ground base (p.x, p.y, p.z) */
  localMatrix: number[];
}

export type DynamicPropKind = 'STREETLIGHT' | 'UTILITY_POLE' | 'PALM_TREE' | 'SHADE_TREE';

export interface DynamicPropCollider {
  id: string;
  kind: DynamicPropKind;
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
  parts: InstancedPropPart[];
  state: 'STANDING' | 'FALLING' | 'FALLEN';
  fallAngle: number;
  fallVel: number;
  fallAxisX: number;
  fallAxisZ: number;
}

export interface BarrierHitResult {
  hit: boolean;
  impactVelocity: number;
  normalX: number;
  normalZ: number;
  hitX: number;
  hitZ: number;
  kind: 'PARAPET' | 'SEAWALL' | 'BOUNDARY';
}

export type SignalColor = 'GREEN' | 'AMBER' | 'RED';

/**
 * Horizontal XZ expansion multiplier extending every road straight & bridge span
 * for smoother high-speed driving and cleaner corner approaches.
 */
export const WORLD_XZ_SCALE = 1.65;

// World geographic bounds for map & collision clamp
export const WORLD_BOUNDS = {
  minX: Math.round(-1340 * WORLD_XZ_SCALE),
  maxX: Math.round(2440 * WORLD_XZ_SCALE),
  minZ: Math.round(-1460 * WORLD_XZ_SCALE),
  maxZ: Math.round(420 * WORLD_XZ_SCALE),
  lagoonSouthZ: -165 * WORLD_XZ_SCALE,
  lagoonNorthZ: -585 * WORLD_XZ_SCALE,
  ikoyiChannelMinX: 445 * WORLD_XZ_SCALE,
  ikoyiChannelMaxX: 595 * WORLD_XZ_SCALE,
  epeCreekMinX: 1350 * WORLD_XZ_SCALE,
  epeCreekMaxX: 1425 * WORLD_XZ_SCALE,
  epeBayMinX: 1600 * WORLD_XZ_SCALE,
  coastalLandNorthZ: 240 * WORLD_XZ_SCALE,
  coastalRoadZ: 320 * WORLD_XZ_SCALE,
  coastalEastCoastX: 2420 * WORLD_XZ_SCALE,
  southOceanZ: 356 * WORLD_XZ_SCALE,
  bridgeDeckHeight: 6.0,
  bridgeHalfWidth: 14.0,
};

// =========================================================================
// UNIFIED ELEVATED BRIDGE / FLYOVER / RAMP SPANS (SINGLE SOURCE OF TRUTH)
// =========================================================================
export const ELEVATED_SPANS: ElevatedSpanDef[] = [
  {
    id: 'TMB',
    name: 'Third Mainland Bridge',
    pieces: [
      {
        // South Island Approach Ramp: y=0 -> y=6.0
        // Right/East parapet leaves clean exit opening around t in [0.42, 0.86] for Adekunle Ramp
        x0: 0,
        y0: 0,
        z0: -145 * WORLD_XZ_SCALE,
        x1: 0,
        y1: 6.0,
        z1: -205 * WORLD_XZ_SCALE,
        halfWidth: 14.0,
        parapetHalfWidth: 12.8,
        exitGapRightT: [0.42, 0.86],
      },
      {
        // Main Elevated Lagoon Span at y = 6.0
        x0: 0,
        y0: 6.0,
        z0: -205 * WORLD_XZ_SCALE,
        x1: 0,
        y1: 6.0,
        z1: -555 * WORLD_XZ_SCALE,
        halfWidth: 14.0,
        parapetHalfWidth: 12.8,
      },
      {
        // North Iyana-Oworo Descent Ramp: y=6.0 -> y=0
        x0: 0,
        y0: 6.0,
        z0: -555 * WORLD_XZ_SCALE,
        x1: 0,
        y1: 0,
        z1: -615 * WORLD_XZ_SCALE,
        halfWidth: 14.0,
        parapetHalfWidth: 12.8,
      },
    ],
  },
  {
    id: 'ADEKUNLE_RAMP',
    name: 'Adekunle Ramp',
    pieces: [
      {
        // Sloped connector ramp flush with widened TMB East shoulder (13.5, 3.84, -183.4*S) down to Adekunle (160*S, 0, -130*S)
        x0: 13.5,
        y0: 3.84,
        z0: -183.4 * WORLD_XZ_SCALE,
        x1: 160 * WORLD_XZ_SCALE,
        y1: 0,
        z1: -130 * WORLD_XZ_SCALE,
        halfWidth: 9.8,
        parapetHalfWidth: 8.7,
      },
    ],
  },
  {
    id: 'IKOYI_LINK',
    name: 'Ikoyi-Lekki Link Bridge',
    pieces: [
      {
        // West Approach Ramp (Ikoyi side)
        x0: 415 * WORLD_XZ_SCALE,
        y0: 0,
        z0: -20 * WORLD_XZ_SCALE,
        x1: 460 * WORLD_XZ_SCALE,
        y1: 7.0,
        z1: -20 * WORLD_XZ_SCALE,
        halfWidth: 14.0,
        parapetHalfWidth: 12.8,
      },
      {
        // Cable-Stayed Elevated Main Span over Ikoyi-Lekki Channel
        x0: 460 * WORLD_XZ_SCALE,
        y0: 7.0,
        z0: -20 * WORLD_XZ_SCALE,
        x1: 580 * WORLD_XZ_SCALE,
        y1: 7.0,
        z1: -20 * WORLD_XZ_SCALE,
        halfWidth: 14.0,
        parapetHalfWidth: 12.8,
      },
      {
        // East Approach Ramp (Lekki side)
        x0: 580 * WORLD_XZ_SCALE,
        y0: 7.0,
        z0: -20 * WORLD_XZ_SCALE,
        x1: 625 * WORLD_XZ_SCALE,
        y1: 0,
        z1: -20 * WORLD_XZ_SCALE,
        halfWidth: 14.0,
        parapetHalfWidth: 12.8,
      },
    ],
  },
  {
    id: 'AJAH_FLYOVER',
    name: 'Ajah Express Flyover',
    pieces: [
      {
        // West Flyover Ramp
        x0: 1055 * WORLD_XZ_SCALE,
        y0: 0,
        z0: 100 * WORLD_XZ_SCALE,
        x1: 1100 * WORLD_XZ_SCALE,
        y1: 6.2,
        z1: 100 * WORLD_XZ_SCALE,
        halfWidth: 11.5,
        parapetHalfWidth: 10.5,
      },
      {
        // Elevated Flyover Deck above Ajah Ground Crossroad
        x0: 1100 * WORLD_XZ_SCALE,
        y0: 6.2,
        z0: 100 * WORLD_XZ_SCALE,
        x1: 1170 * WORLD_XZ_SCALE,
        y1: 6.2,
        z1: 100 * WORLD_XZ_SCALE,
        halfWidth: 11.5,
        parapetHalfWidth: 10.5,
      },
      {
        // East Flyover Ramp
        x0: 1170 * WORLD_XZ_SCALE,
        y0: 6.2,
        z0: 100 * WORLD_XZ_SCALE,
        x1: 1215 * WORLD_XZ_SCALE,
        y1: 0,
        z1: 100 * WORLD_XZ_SCALE,
        halfWidth: 11.5,
        parapetHalfWidth: 10.5,
      },
    ],
  },
  {
    id: 'EPE_BRIDGE',
    name: 'Epe Lagoon Bridge',
    pieces: [
      {
        // West Ramp over Epe Creek bank
        x0: 1325 * WORLD_XZ_SCALE,
        y0: 0,
        z0: 100 * WORLD_XZ_SCALE,
        x1: 1360 * WORLD_XZ_SCALE,
        y1: 5.8,
        z1: 100 * WORLD_XZ_SCALE,
        halfWidth: 14.0,
        parapetHalfWidth: 12.8,
      },
      {
        // Main Span across Epe Creek
        x0: 1360 * WORLD_XZ_SCALE,
        y0: 5.8,
        z0: 100 * WORLD_XZ_SCALE,
        x1: 1415 * WORLD_XZ_SCALE,
        y1: 5.8,
        z1: 100 * WORLD_XZ_SCALE,
        halfWidth: 14.0,
        parapetHalfWidth: 12.8,
      },
      {
        // East Ramp into Epe Town
        x0: 1415 * WORLD_XZ_SCALE,
        y0: 5.8,
        z0: 100 * WORLD_XZ_SCALE,
        x1: 1450 * WORLD_XZ_SCALE,
        y1: 0,
        z1: 100 * WORLD_XZ_SCALE,
        halfWidth: 14.0,
        parapetHalfWidth: 12.8,
      },
    ],
  },
];

interface SpanCandidate {
  spanId: string;
  piece: ElevatedSpanPiece;
  t: number;
  rawT: number;
  y: number;
  slopeX: number;
  slopeZ: number;
  signedLat: number;
  absLat: number;
  ux: number;
  uz: number;
}

function getSpanCandidatesAt(x: number, z: number, latMargin = 0.5): SpanCandidate[] {
  const candidates: SpanCandidate[] = [];
  for (let i = 0; i < ELEVATED_SPANS.length; i++) {
    const span = ELEVATED_SPANS[i];
    for (let pIdx = 0; pIdx < span.pieces.length; pIdx++) {
      const piece = span.pieces[pIdx];
      const dx = piece.x1 - piece.x0;
      const dz = piece.z1 - piece.z0;
      const lenSq = dx * dx + dz * dz;
      if (lenSq < 1e-6) continue;
      const len = Math.sqrt(lenSq);
      const t = ((x - piece.x0) * dx + (z - piece.z0) * dz) / lenSq;
      if (t < -0.0015 || t > 1.0015) continue;

      const ux = dx / len;
      const uz = dz / len;
      // Right normal for F = (ux, uz) on XZ plane is (-uz, ux)
      const rx = -uz;
      const rz = ux;
      const signedLat = (x - piece.x0) * rx + (z - piece.z0) * rz;
      const absLat = Math.abs(signedLat);

      if (absLat <= piece.halfWidth + latMargin) {
        const tc = Math.max(0, Math.min(1, t));
        const y = piece.y0 + tc * (piece.y1 - piece.y0);
        const dyPerM = (piece.y1 - piece.y0) / len;
        candidates.push({
          spanId: span.id,
          piece,
          t: tc,
          rawT: t,
          y,
          slopeX: dyPerM * ux,
          slopeZ: dyPerM * uz,
          signedLat,
          absLat,
          ux,
          uz,
        });
      }
    }
  }
  return candidates;
}

function selectActiveSurface(
  x: number,
  z: number,
  currentY = 0,
  latMargin = 0.5
): SpanCandidate | null {
  const candidates = getSpanCandidatesAt(x, z, latMargin);
  if (candidates.length === 0) return null;

  const overWater = isOverOpenWater(x, z);
  let best: SpanCandidate | null = null;
  let bestScore = Infinity;

  const computeScore = (c: SpanCandidate, diff: number) => {
    const outPenalty = c.rawT < 0 || c.rawT > 1 ? 5.0 : 0;
    return diff + c.absLat * 0.04 + outPenalty;
  };

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const diff = Math.abs(c.y - currentY);

    // If vehicle is on the ground (currentY <= 1.2) and approaching a sloped ramp toe (c.y <= 1.35),
    // smoothly attach to the ramp so the car drives UP rather than clipping under.
    const isSlopedRamp = Math.abs(c.piece.y1 - c.piece.y0) > 0.25;
    if (currentY <= 1.2 && isSlopedRamp && c.y <= 1.35) {
      const score = computeScore(c, diff);
      if (score < bestScore) {
        best = c;
        bestScore = score;
      }
      continue;
    }

    // If over open water (no ground road underneath), keep vehicle on the elevated span.
    if (overWater) {
      const score = computeScore(c, diff);
      if (score < bestScore) {
        best = c;
        bestScore = score;
      }
      continue;
    }

    // On land (e.g. Ajah underpass where flyover is at 6.2m and ground road is at 0m),
    // only pick an elevated span if currentY is already near that deck height.
    if (diff <= 1.85) {
      const score = computeScore(c, diff);
      if (score < bestScore) {
        best = c;
        bestScore = score;
      }
    }
  }

  return best;
}

/**
 * Exact level-aware continuous surface elevation Y at world (x, z) given previous elevation currentY.
 * Supports true multi-level overpasses (drive both over and under Ajah Flyover cleanly).
 */
export function resolveSurfaceY(x: number, z: number, currentY = 0): number {
  const active = selectActiveSurface(x, z, currentY);
  if (active) return active.y;
  return 0;
}

/**
 * Signed distance OUTSIDE ground-level elevated bridge/flyover ramp touchdowns (y <= maxDeckY).
 * Keeps roadside curbs, poles, guardrails, and trees off sloped approach ramps while
 * preserving the passable ground crossroad underneath tall overpasses (e.g. Ajah Flyover at 6.2m).
 */
export function getEdgeDistToElevatedRamps(
  px: number,
  pz: number,
  maxDeckY = 4.2
): number {
  let minEdge = Infinity;
  for (let i = 0; i < ELEVATED_SPANS.length; i++) {
    const span = ELEVATED_SPANS[i];
    for (let pIdx = 0; pIdx < span.pieces.length; pIdx++) {
      const piece = span.pieces[pIdx];
      if (Math.min(piece.y0, piece.y1) > maxDeckY) continue;
      const dx = piece.x1 - piece.x0;
      const dz = piece.z1 - piece.z0;
      const lenSq = dx * dx + dz * dz;
      if (lenSq < 1e-6) continue;
      const rawT = ((px - piece.x0) * dx + (pz - piece.z0) * dz) / lenSq;
      const tc = Math.max(0, Math.min(1, rawT));
      const yAtT = piece.y0 + tc * (piece.y1 - piece.y0);
      if (yAtT > maxDeckY) continue;
      const projX = piece.x0 + tc * dx;
      const projZ = piece.z0 + tc * dz;
      const d = Math.hypot(px - projX, pz - projZ) - piece.halfWidth;
      if (d < minEdge) minEdge = d;
    }
  }
  return minEdge;
}

/**
 * Backward-compatible elevation query at (x, z) (prefers upper bridge deck when called without currentY).
 */
export function getRoadSurfaceY(x: number, z: number): number {
  const candidates = getSpanCandidatesAt(x, z);
  if (candidates.length === 0) return 0;
  let maxY = 0;
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i].y > maxY) maxY = candidates[i].y;
  }
  return maxY;
}

/**
 * Computes exact pitch angle (radians) around local X-axis (for Euler order 'YXZ')
 * along any bridge/flyover/ramp regardless of compass heading.
 */
export function getBridgePitchAt(
  x: number,
  z: number,
  heading: number,
  currentY = 0
): number {
  const active = selectActiveSurface(x, z, currentY);
  if (!active) return 0;

  const fwdX = Math.sin(heading);
  const fwdZ = Math.cos(heading);
  const dYds = active.slopeX * fwdX + active.slopeZ * fwdZ;
  if (Math.abs(dYds) < 1e-5) return 0;
  // With Euler order 'YXZ', negative rotation around local +X tilts +Z nose upward.
  return -Math.atan(dYds);
}

export function isOverOpenWater(x: number, z: number): boolean {
  if (z < WORLD_BOUNDS.lagoonSouthZ && z > WORLD_BOUNDS.lagoonNorthZ) return true;
  // Reclaimed Lagos Coastal Highway corridor (Victoria Island -> Epe) has continuous solid landmass south of z = 240*S
  if (
    z >= WORLD_BOUNDS.coastalLandNorthZ &&
    z <= WORLD_BOUNDS.southOceanZ &&
    x >= -460 * WORLD_XZ_SCALE &&
    x <= WORLD_BOUNDS.coastalEastCoastX
  ) {
    return false;
  }
  if (
    x > WORLD_BOUNDS.ikoyiChannelMinX &&
    x < WORLD_BOUNDS.ikoyiChannelMaxX &&
    z >= WORLD_BOUNDS.lagoonSouthZ &&
    z < WORLD_BOUNDS.coastalLandNorthZ
  )
    return true;
  if (
    x > WORLD_BOUNDS.epeCreekMinX &&
    x < WORLD_BOUNDS.epeCreekMaxX &&
    z >= WORLD_BOUNDS.lagoonSouthZ &&
    z < WORLD_BOUNDS.coastalLandNorthZ
  )
    return true;
  if (x > WORLD_BOUNDS.epeBayMinX && z < WORLD_BOUNDS.coastalLandNorthZ) return true;
  if (x > WORLD_BOUNDS.coastalEastCoastX && z >= WORLD_BOUNDS.coastalLandNorthZ) return true;
  if (z > WORLD_BOUNDS.southOceanZ) return true;
  return false;
}

export function isInsideLagoonWater(x: number, z: number): boolean {
  return isOverOpenWater(x, z) && getSpanCandidatesAt(x, z).length === 0;
}

export function isOnBridgeCorridor(x: number, z: number, currentY = 0): boolean {
  return selectActiveSurface(x, z, currentY) !== null;
}

/**
 * Enforces elevated bridge parapet guardrails and coastal seawall shorelines
 * without blocking vehicles driving underneath flyovers at ground level.
 * Returns structured hit details when a hard barrier impact occurs (for car denting & audio).
 */
export function enforceBridgeAndWaterBarriers(
  cs: { x: number; z: number; speed: number },
  currentY: number,
  carHalfWidth = 0.95
): BarrierHitResult | null {
  const active = selectActiveSurface(cs.x, cs.z, currentY, currentY > 1.5 ? 4.5 : 0.5);

  if (active && (active.y > 0.35 || isOverOpenWater(cs.x, cs.z))) {
    const piece = active.piece;
    const inExitGapRight =
      piece.exitGapRightT !== undefined &&
      active.t >= piece.exitGapRightT[0] &&
      active.t <= piece.exitGapRightT[1];

    // Lateral right-normal vector (F x Up = (-uz, ux))
    const rx = -active.uz;
    const rz = active.ux;
    const maxLat = Math.max(2.0, active.piece.parapetHalfWidth - carHalfWidth * 0.45);
    let hitResult: BarrierHitResult | null = null;

    if (active.signedLat > maxLat && !inExitGapRight) {
      const excess = active.signedLat - maxLat;
      const impactVel = Math.abs(cs.speed);
      cs.x -= rx * excess;
      cs.z -= rz * excess;
      cs.speed *= 0.62;
      hitResult = {
        hit: true,
        impactVelocity: impactVel,
        normalX: -rx,
        normalZ: -rz,
        hitX: cs.x + rx * carHalfWidth,
        hitZ: cs.z + rz * carHalfWidth,
        kind: 'PARAPET',
      };
    } else if (active.signedLat < -maxLat) {
      const excess = active.signedLat + maxLat; // negative
      const impactVel = Math.abs(cs.speed);
      cs.x -= rx * excess;
      cs.z -= rz * excess;
      cs.speed *= 0.62;
      hitResult = {
        hit: true,
        impactVelocity: impactVel,
        normalX: rx,
        normalZ: rz,
        hitX: cs.x - rx * carHalfWidth,
        hitZ: cs.z - rz * carHalfWidth,
        kind: 'PARAPET',
      };
    }

    // Solid Central Concrete Jersey Divider on all 4-lane elevated bridges (matches 0.76m visual divider)
    const hasCenterMedian = active.spanId !== 'ADEKUNLE_RAMP' && active.y > 0.25;
    if (hasCenterMedian) {
      const medianHalfW = 0.38;
      const minAbsLat = medianHalfW + carHalfWidth * 0.48;
      const absLat = Math.abs(active.signedLat);
      if (absLat < minAbsLat) {
        const sideSign = active.signedLat >= 0 ? 1 : -1;
        const pushOut = minAbsLat - absLat;
        const impactVel = Math.abs(cs.speed);
        cs.x += rx * sideSign * pushOut;
        cs.z += rz * sideSign * pushOut;
        cs.speed *= 0.62;
        if (!hitResult || impactVel > hitResult.impactVelocity) {
          hitResult = {
            hit: true,
            impactVelocity: impactVel,
            normalX: rx * sideSign,
            normalZ: rz * sideSign,
            hitX: cs.x - rx * sideSign * carHalfWidth,
            hitZ: cs.z - rz * sideSign * carHalfWidth,
            kind: 'PARAPET',
          };
        }
      }
    }

    return hitResult;
  }

  // Ground-level coastal seawall water clamps (only when NOT on a bridge deck)
  const lagSouthGuard = WORLD_BOUNDS.lagoonSouthZ + 5;
  const lagNorthGuard = WORLD_BOUNDS.lagoonNorthZ - 5;
  if (cs.z < lagSouthGuard && cs.z > lagNorthGuard) {
    const distSouth = Math.abs(cs.z - lagSouthGuard);
    const distNorth = Math.abs(cs.z - lagNorthGuard);
    const impactVel = Math.abs(cs.speed);
    const pushNorth = distSouth < distNorth;
    cs.z = pushNorth ? lagSouthGuard : lagNorthGuard;
    cs.speed = -cs.speed * 0.32;
    return {
      hit: true,
      impactVelocity: impactVel,
      normalX: 0,
      normalZ: pushNorth ? 1 : -1,
      hitX: cs.x,
      hitZ: cs.z + (pushNorth ? -carHalfWidth : carHalfWidth),
      kind: 'SEAWALL',
    };
  }

  // 2. Ikoyi-Lekki Lagoon Channel (only north of Coastal Highway landmass)
  const ikMin = WORLD_BOUNDS.ikoyiChannelMinX - 5;
  const ikMax = WORLD_BOUNDS.ikoyiChannelMaxX + 5;
  if (
    cs.z >= WORLD_BOUNDS.lagoonSouthZ &&
    cs.z < WORLD_BOUNDS.coastalLandNorthZ - 4 &&
    cs.x > ikMin &&
    cs.x < ikMax
  ) {
    const dWest = Math.abs(cs.x - ikMin);
    const dEast = Math.abs(cs.x - ikMax);
    const impactVel = Math.abs(cs.speed);
    const pushWest = dWest < dEast;
    cs.x = pushWest ? ikMin : ikMax;
    cs.speed = -cs.speed * 0.32;
    return {
      hit: true,
      impactVelocity: impactVel,
      normalX: pushWest ? -1 : 1,
      normalZ: 0,
      hitX: cs.x + (pushWest ? carHalfWidth : -carHalfWidth),
      hitZ: cs.z,
      kind: 'SEAWALL',
    };
  }

  // 3. Epe Creek Channel (only north of Coastal Highway landmass)
  const epMin = WORLD_BOUNDS.epeCreekMinX - 5;
  const epMax = WORLD_BOUNDS.epeCreekMaxX + 5;
  if (
    cs.z >= WORLD_BOUNDS.lagoonSouthZ &&
    cs.z < WORLD_BOUNDS.coastalLandNorthZ - 4 &&
    cs.x > epMin &&
    cs.x < epMax
  ) {
    const dWest = Math.abs(cs.x - epMin);
    const dEast = Math.abs(cs.x - epMax);
    const impactVel = Math.abs(cs.speed);
    const pushWest = dWest < dEast;
    cs.x = pushWest ? epMin : epMax;
    cs.speed = -cs.speed * 0.32;
    return {
      hit: true,
      impactVelocity: impactVel,
      normalX: pushWest ? -1 : 1,
      normalZ: 0,
      hitX: cs.x + (pushWest ? carHalfWidth : -carHalfWidth),
      hitZ: cs.z,
      kind: 'SEAWALL',
    };
  }

  // 4. Eastern Epe Bay north of Coastal Road + Epe Coastal Terminus East Seawall + Single South Atlantic Coastline
  const eastBayGuard = WORLD_BOUNDS.epeBayMinX - 5;
  if (cs.z < WORLD_BOUNDS.coastalLandNorthZ - 4 && cs.x > eastBayGuard) {
    const impactVel = Math.abs(cs.speed);
    cs.x = eastBayGuard;
    cs.speed = -cs.speed * 0.32;
    return {
      hit: true,
      impactVelocity: impactVel,
      normalX: -1,
      normalZ: 0,
      hitX: cs.x + carHalfWidth,
      hitZ: cs.z,
      kind: 'SEAWALL',
    };
  }

  const coastEastGuard = WORLD_BOUNDS.coastalEastCoastX - 5;
  if (cs.z >= WORLD_BOUNDS.coastalLandNorthZ - 4 && cs.x > coastEastGuard) {
    const impactVel = Math.abs(cs.speed);
    cs.x = coastEastGuard;
    cs.speed = -cs.speed * 0.32;
    return {
      hit: true,
      impactVelocity: impactVel,
      normalX: -1,
      normalZ: 0,
      hitX: cs.x + carHalfWidth,
      hitZ: cs.z,
      kind: 'SEAWALL',
    };
  }

  const southGuard = WORLD_BOUNDS.southOceanZ - 5;
  if (cs.z > southGuard) {
    const impactVel = Math.abs(cs.speed);
    cs.z = southGuard;
    cs.speed = -cs.speed * 0.32;
    return {
      hit: true,
      impactVelocity: impactVel,
      normalX: 0,
      normalZ: -1,
      hitX: cs.x,
      hitZ: cs.z + carHalfWidth,
      kind: 'SEAWALL',
    };
  }

  return null;
}

// =========================================================================
// COORDINATED TRAFFIC SIGNAL CONTROLLER (SHARED BETWEEN AI & 3D POLES)
// =========================================================================
export const SIGNALIZED_INTERSECTIONS: SignalizedIntersectionDef[] = [
  { nodeId: 'N_CENTRAL_JCT', phaseOffsetSec: 0 },
  { nodeId: 'N_YABA_TECH_JCT', phaseOffsetSec: 4 },
  { nodeId: 'N_ADEKUNLE', phaseOffsetSec: 8 },
  { nodeId: 'N_OBALENDE', phaseOffsetSec: 2 },
  { nodeId: 'N_IKOYI_CENTER', phaseOffsetSec: 6 },
  { nodeId: 'N_IKOYI_EAST', phaseOffsetSec: 10 },
  { nodeId: 'N_LEKKI_ADMIRALTY', phaseOffsetSec: 4 },
  { nodeId: 'N_IKATE', phaseOffsetSec: 8 },
  { nodeId: 'N_VGC', phaseOffsetSec: 0 },
  { nodeId: 'N_AJAH_GROUND', phaseOffsetSec: 6 },
  { nodeId: 'N_IYANA_OWORO', phaseOffsetSec: 2 },
  { nodeId: 'N_EPE_TOWN', phaseOffsetSec: 10 },
  { nodeId: 'N_MARINA_CENTRAL', phaseOffsetSec: 2 },
  { nodeId: 'N_MILE2', phaseOffsetSec: 4 },
  { nodeId: 'N_IYANOBA', phaseOffsetSec: 8 },
];

const SIGNAL_MAP: Record<string, SignalizedIntersectionDef> = Object.fromEntries(
  SIGNALIZED_INTERSECTIONS.map((s) => [s.nodeId, s])
);

/**
 * Returns the live traffic signal color ('GREEN' | 'AMBER' | 'RED') for a travel axis
 * ('NS' or 'EW') at a signalized intersection at elapsed time `timeSec`.
 */
export function getTrafficSignalState(
  nodeId: string,
  axis: 'NS' | 'EW',
  timeSec: number
): SignalColor {
  const def = SIGNAL_MAP[nodeId];
  if (!def) return 'GREEN';
  const cycle = 16.0;
  const t = ((timeSec + def.phaseOffsetSec) % cycle + cycle) % cycle;
  if (axis === 'NS') {
    if (t < 6.5) return 'GREEN';
    if (t < 8.0) return 'AMBER';
    return 'RED';
  }
  if (t >= 8.0 && t < 14.5) return 'GREEN';
  if (t >= 14.5) return 'AMBER';
  return 'RED';
}

// =========================================================================
// 1. CONNECTED LAGOS METRO ROAD NETWORK GRAPH
// =========================================================================
export const LAGOS_ROAD_NODES: Record<string, RoadNode> = {
  // === SHOWROOM HUB & LAGOS ISLAND CORE ===
  N_SHOWROOM: {
    id: 'N_SHOWROOM',
    x: 0,
    z: -35,
    name: 'Showroom Esplanade',
    roadName: 'Showroom Boulevard',
    district: 'Lagos Island',
    neighbors: ['N_CENTRAL_JCT', 'N_NORTH_GATE'],
    speedLimit: 50,
  },
  N_CENTRAL_JCT: {
    id: 'N_CENTRAL_JCT',
    x: 0,
    z: 0,
    name: 'Sabo Central Roundabout',
    roadName: 'Sabo Roundabout',
    district: 'Lagos Island',
    neighbors: ['N_SHOWROOM', 'N_EAST_AVE_1', 'N_SOUTH_AVE_1', 'N_WEST_AVE_1'],
    speedLimit: 45,
  },
  N_NORTH_GATE: {
    id: 'N_NORTH_GATE',
    x: 0,
    z: -80,
    name: 'Herbert Macaulay North',
    roadName: 'Herbert Macaulay Way',
    district: 'Lagos Island',
    neighbors: ['N_SHOWROOM', 'N_YABA_TECH_JCT', 'N_TECH_PLAZA_S'],
    speedLimit: 60,
  },
  N_YABA_TECH_JCT: {
    id: 'N_YABA_TECH_JCT',
    x: 0,
    z: -130,
    name: 'Yaba & Bridge South Approach',
    roadName: 'Third Mainland Approach',
    district: 'Lagos Island',
    neighbors: ['N_NORTH_GATE', 'N_RACE_START', 'N_EAST_RING_N', 'N_TMB_FORK'],
    speedLimit: 65,
    isDualCarriageway: true,
  },
  N_RACE_START: {
    id: 'N_RACE_START',
    x: -50,
    z: -130,
    name: 'Surulere Grid Start',
    roadName: 'Surulere Circuit Straight',
    district: 'Lagos Island',
    neighbors: ['N_YABA_TECH_JCT', 'N_WEST_CORNER_N'],
    speedLimit: 80,
  },
  N_WEST_CORNER_N: {
    id: 'N_WEST_CORNER_N',
    x: -110,
    z: -130,
    name: 'Expressway Turn 1',
    roadName: 'Surulere Expressway',
    district: 'Lagos Island',
    neighbors: ['N_RACE_START', 'N_SURULERE_EXPRESS_N'],
    speedLimit: 75,
  },
  N_EAST_AVE_1: {
    id: 'N_EAST_AVE_1',
    x: 50,
    z: 0,
    name: 'Commercial Ave West',
    roadName: 'Commercial Avenue',
    district: 'Lagos Island',
    neighbors: ['N_CENTRAL_JCT', 'N_EAST_AVE_2', 'N_TECH_PLAZA_S'],
    speedLimit: 50,
  },
  N_EAST_AVE_2: {
    id: 'N_EAST_AVE_2',
    x: 105,
    z: 0,
    name: 'Bank Row Junction',
    roadName: 'Commercial Avenue East',
    district: 'Lagos Island',
    neighbors: ['N_EAST_AVE_1', 'N_EAST_RING_N', 'N_EAST_RING_S', 'N_OBALENDE'],
    speedLimit: 55,
  },
  N_EAST_RING_N: {
    id: 'N_EAST_RING_N',
    x: 105,
    z: -130,
    name: 'Tech Boulevard East',
    roadName: 'Tech Boulevard',
    district: 'Lagos Island',
    neighbors: ['N_YABA_TECH_JCT', 'N_EAST_AVE_2', 'N_ADEKUNLE'],
    speedLimit: 65,
    isDualCarriageway: true,
  },
  N_TECH_PLAZA_S: {
    id: 'N_TECH_PLAZA_S',
    x: 50,
    z: -65,
    name: 'Alaba Tech Corridor',
    roadName: 'Tech Corridor',
    district: 'Lagos Island',
    neighbors: ['N_EAST_AVE_1', 'N_NORTH_GATE'],
    speedLimit: 45,
  },
  N_SOUTH_AVE_1: {
    id: 'N_SOUTH_AVE_1',
    x: 0,
    z: 45,
    name: 'Marketplace Boulevard North',
    roadName: 'Marketplace Boulevard',
    district: 'Lagos Island',
    neighbors: ['N_CENTRAL_JCT', 'N_SOUTH_GATE'],
    speedLimit: 50,
  },
  N_SOUTH_GATE: {
    id: 'N_SOUTH_GATE',
    x: 0,
    z: 100,
    name: 'Grand Marketplace Gateway',
    roadName: 'Broad Street',
    district: 'Lagos Island',
    neighbors: ['N_SOUTH_AVE_1', 'N_DEPOT_JCT', 'N_EAST_RING_S', 'N_MARINA_WEST'],
    speedLimit: 50,
  },
  N_EAST_RING_S: {
    id: 'N_EAST_RING_S',
    x: 105,
    z: 100,
    name: 'Eastern Gateway Interchange',
    roadName: 'Ring Road East',
    district: 'Lagos Island',
    neighbors: ['N_EAST_AVE_2', 'N_SOUTH_GATE', 'N_OBALENDE_S', 'N_MARINA_CENTRAL'],
    speedLimit: 65,
    isDualCarriageway: true,
  },
  N_WEST_AVE_1: {
    id: 'N_WEST_AVE_1',
    x: -55,
    z: 0,
    name: 'Surulere Link West',
    roadName: 'Surulere Avenue',
    district: 'Lagos Island',
    neighbors: ['N_CENTRAL_JCT', 'N_DEPOT_APPROACH', 'N_SURULERE_MID'],
    speedLimit: 55,
  },
  N_SURULERE_MID: {
    id: 'N_SURULERE_MID',
    x: -110,
    z: 0,
    name: 'Surulere Bypass Junction',
    roadName: 'Surulere Expressway',
    district: 'Lagos Island',
    neighbors: ['N_WEST_AVE_1', 'N_SURULERE_EXPRESS_N', 'N_DEPOT_WEST'],
    speedLimit: 70,
  },
  N_SURULERE_EXPRESS_N: {
    id: 'N_SURULERE_EXPRESS_N',
    x: -110,
    z: -65,
    name: 'Surulere Straightaway',
    roadName: 'Surulere Expressway',
    district: 'Lagos Island',
    neighbors: ['N_WEST_CORNER_N', 'N_SURULERE_MID'],
    speedLimit: 85,
  },
  N_DEPOT_APPROACH: {
    id: 'N_DEPOT_APPROACH',
    x: -55,
    z: 65,
    name: 'Logistics Way North',
    roadName: 'Logistics Way',
    district: 'Lagos Island',
    neighbors: ['N_WEST_AVE_1', 'N_DEPOT_JCT'],
    speedLimit: 45,
  },
  N_DEPOT_JCT: {
    id: 'N_DEPOT_JCT',
    x: -55,
    z: 100,
    name: 'Mainland Cargo Depot Entry',
    roadName: 'Depot Road',
    district: 'Lagos Island',
    neighbors: ['N_DEPOT_APPROACH', 'N_SOUTH_GATE', 'N_DEPOT_WEST'],
    speedLimit: 45,
  },
  N_DEPOT_WEST: {
    id: 'N_DEPOT_WEST',
    x: -110,
    z: 100,
    name: 'Depot Warehouse Loop',
    roadName: 'Depot Loop',
    district: 'Lagos Island',
    neighbors: ['N_SURULERE_MID', 'N_DEPOT_JCT', 'N_MARINA_TAIL'],
    speedLimit: 45,
  },

  // === MARINA FINANCIAL DISTRICT & BLUE LINE RAIL TERMINUS ===
  N_MARINA_E: {
    id: 'N_MARINA_E',
    x: 160,
    z: 185,
    name: 'Marina East / CMS Junction',
    roadName: 'Marina Boulevard',
    district: 'Marina',
    neighbors: ['N_OBALENDE_S', 'N_MARINA_CENTRAL', 'N_COASTAL_VI_START'],
    speedLimit: 55,
    isDualCarriageway: true,
  },
  N_MARINA_CENTRAL: {
    id: 'N_MARINA_CENTRAL',
    x: 105,
    z: 185,
    name: 'Marina Banking Hub (UBA / Wema / UAC)',
    roadName: 'Marina Boulevard',
    district: 'Marina',
    neighbors: ['N_MARINA_E', 'N_EAST_RING_S', 'N_MARINA_WEST'],
    speedLimit: 55,
    isDualCarriageway: true,
  },
  N_MARINA_WEST: {
    id: 'N_MARINA_WEST',
    x: 0,
    z: 185,
    name: 'Marina Financial West',
    roadName: 'Marina Boulevard',
    district: 'Marina',
    neighbors: ['N_MARINA_CENTRAL', 'N_SOUTH_GATE', 'N_MARINA_TAIL'],
    speedLimit: 55,
    isDualCarriageway: true,
  },
  N_MARINA_TAIL: {
    id: 'N_MARINA_TAIL',
    x: -110,
    z: 185,
    name: 'Marina Blue Line Rail Terminus',
    roadName: 'Marina Waterfront Way',
    district: 'Marina',
    neighbors: ['N_MARINA_WEST', 'N_DEPOT_WEST'],
    speedLimit: 50,
    isDualCarriageway: true,
  },

  // === THIRD MAINLAND BRIDGE & ADEKUNLE RAMP INTERCHANGE ===
  N_TMB_FORK: {
    id: 'N_TMB_FORK',
    x: 0,
    y: 4.0,
    z: -185,
    name: 'Third Mainland / Adekunle Ramp Fork',
    roadName: 'Third Mainland Bridge',
    district: 'Lagos Lagoon',
    neighbors: ['N_YABA_TECH_JCT', 'N_TMB_SOUTH', 'N_ADEKUNLE_EXIT'],
    speedLimit: 75,
    isDualCarriageway: true,
    isBridge: true,
  },
  N_TMB_SOUTH: {
    id: 'N_TMB_SOUTH',
    x: 0,
    y: 6.0,
    z: -205,
    name: 'Third Mainland Bridge South Deck',
    roadName: 'Third Mainland Bridge',
    district: 'Lagos Lagoon',
    neighbors: ['N_TMB_FORK', 'N_TMB_MID_S'],
    speedLimit: 90,
    isDualCarriageway: true,
    isBridge: true,
  },
  N_TMB_MID_S: {
    id: 'N_TMB_MID_S',
    x: 0,
    y: 6.0,
    z: -320,
    name: 'Third Mainland Bridge Center South',
    roadName: 'Third Mainland Bridge',
    district: 'Lagos Lagoon',
    neighbors: ['N_TMB_SOUTH', 'N_TMB_MID_N'],
    speedLimit: 95,
    isDualCarriageway: true,
    isBridge: true,
  },
  N_TMB_MID_N: {
    id: 'N_TMB_MID_N',
    x: 0,
    y: 6.0,
    z: -445,
    name: 'Third Mainland Bridge Center North',
    roadName: 'Third Mainland Bridge',
    district: 'Lagos Lagoon',
    neighbors: ['N_TMB_MID_S', 'N_TMB_NORTH'],
    speedLimit: 95,
    isDualCarriageway: true,
    isBridge: true,
  },
  N_TMB_NORTH: {
    id: 'N_TMB_NORTH',
    x: 0,
    y: 6.0,
    z: -555,
    name: 'Third Mainland Bridge North Deck',
    roadName: 'Third Mainland Bridge',
    district: 'Lagos Lagoon',
    neighbors: ['N_TMB_MID_N', 'N_IYANA_OWORO'],
    speedLimit: 85,
    isDualCarriageway: true,
    isBridge: true,
  },
  N_ADEKUNLE_EXIT: {
    id: 'N_ADEKUNLE_EXIT',
    x: 11,
    y: 3.84,
    z: -183.4,
    name: 'Adekunle Ramp Exit',
    roadName: 'Adekunle Ramp',
    district: 'Adekunle',
    neighbors: ['N_TMB_FORK', 'N_ADEKUNLE_RAMP'],
    speedLimit: 60,
    isDualCarriageway: false,
    isBridge: true,
  },
  N_ADEKUNLE_RAMP: {
    id: 'N_ADEKUNLE_RAMP',
    x: 85,
    y: 1.92,
    z: -156.7,
    name: 'Adekunle Coastal Flyover Ramp',
    roadName: 'Adekunle Ramp',
    district: 'Adekunle',
    neighbors: ['N_ADEKUNLE_EXIT', 'N_ADEKUNLE'],
    speedLimit: 65,
    isDualCarriageway: false,
    isBridge: true,
  },
  N_ADEKUNLE: {
    id: 'N_ADEKUNLE',
    x: 160,
    y: 0,
    z: -130,
    name: 'Adekunle Interchange',
    roadName: 'Adekunle / Adeniji Way',
    district: 'Adekunle',
    neighbors: ['N_ADEKUNLE_RAMP', 'N_EAST_RING_N', 'N_OBALENDE_N', 'N_IKOYI_WEST'],
    speedLimit: 60,
    isDualCarriageway: true,
  },

  // === OBALENDE COMMERCIAL & TRANSIT DISTRICT ===
  N_OBALENDE_N: {
    id: 'N_OBALENDE_N',
    x: 160,
    z: -20,
    name: 'Obalende North Link',
    roadName: 'Obalende Road',
    district: 'Obalende',
    neighbors: ['N_ADEKUNLE', 'N_OBALENDE', 'N_IKOYI_ESTATE'],
    speedLimit: 50,
    isDualCarriageway: true,
  },
  N_OBALENDE: {
    id: 'N_OBALENDE',
    x: 160,
    z: 30,
    name: 'Obalende Market & Bus Terminal',
    roadName: 'Obalende Commercial Street',
    district: 'Obalende',
    neighbors: ['N_OBALENDE_N', 'N_EAST_AVE_2', 'N_OBALENDE_S'],
    speedLimit: 45,
    isDualCarriageway: true,
  },
  N_OBALENDE_S: {
    id: 'N_OBALENDE_S',
    x: 160,
    z: 100,
    name: 'Obalende / McGregor Junction',
    roadName: 'Awolowo Road Link',
    district: 'Obalende',
    neighbors: ['N_OBALENDE', 'N_EAST_RING_S', 'N_IKOYI_SOUTH_W', 'N_MARINA_E'],
    speedLimit: 55,
    isDualCarriageway: true,
  },

  // === IKOYI HIGH-END RESIDENTIAL & CORPORATE DISTRICT ===
  N_IKOYI_WEST: {
    id: 'N_IKOYI_WEST',
    x: 260,
    z: -130,
    name: 'Bourdillon / Kingsway West',
    roadName: 'Bourdillon Road',
    district: 'Ikoyi',
    neighbors: ['N_ADEKUNLE', 'N_IKOYI_CENTER', 'N_IKOYI_ESTATE'],
    speedLimit: 65,
    isDualCarriageway: true,
  },
  N_IKOYI_CENTER: {
    id: 'N_IKOYI_CENTER',
    x: 365,
    z: -130,
    name: 'Ikoyi Bourdillon Towers',
    roadName: 'Bourdillon / Gerard Road',
    district: 'Ikoyi',
    neighbors: ['N_IKOYI_WEST', 'N_IKOYI_EAST'],
    speedLimit: 65,
    isDualCarriageway: true,
  },
  N_IKOYI_ESTATE: {
    id: 'N_IKOYI_ESTATE',
    x: 260,
    z: -20,
    name: 'Ikoyi Gated Estates Boulevard',
    roadName: 'Queens Drive / Alexander Ave',
    district: 'Ikoyi',
    neighbors: ['N_OBALENDE_N', 'N_IKOYI_WEST', 'N_IKOYI_EAST', 'N_IKOYI_SOUTH_W'],
    speedLimit: 60,
    isDualCarriageway: true,
  },
  N_IKOYI_EAST: {
    id: 'N_IKOYI_EAST',
    x: 365,
    z: -20,
    name: 'Ikoyi Link Bridgehead',
    roadName: 'Admiralty Bridge Way',
    district: 'Ikoyi',
    neighbors: ['N_IKOYI_CENTER', 'N_IKOYI_ESTATE', 'N_IKOYI_SOUTH_E', 'N_IKOYI_BRIDGE_W'],
    speedLimit: 65,
    isDualCarriageway: true,
  },
  N_IKOYI_SOUTH_W: {
    id: 'N_IKOYI_SOUTH_W',
    x: 260,
    z: 100,
    name: 'Falomo / South Ikoyi Link',
    roadName: 'Awolowo-Falomo Way',
    district: 'Ikoyi',
    neighbors: ['N_OBALENDE_S', 'N_IKOYI_ESTATE', 'N_IKOYI_SOUTH_E'],
    speedLimit: 60,
    isDualCarriageway: true,
  },
  N_IKOYI_SOUTH_E: {
    id: 'N_IKOYI_SOUTH_E',
    x: 365,
    z: 100,
    name: 'Ikoyi South Club Drive',
    roadName: 'Ikoyi Crescent',
    district: 'Ikoyi',
    neighbors: ['N_IKOYI_SOUTH_W', 'N_IKOYI_EAST', 'N_COASTAL_IKOYI_S'],
    speedLimit: 55,
    isDualCarriageway: true,
  },

  // === IKOYI-LEKKI LINK BRIDGE (OVER LAGOON CHANNEL) ===
  N_IKOYI_BRIDGE_W: {
    id: 'N_IKOYI_BRIDGE_W',
    x: 415,
    y: 0,
    z: -20,
    name: 'Ikoyi Link Bridge West Approach',
    roadName: 'Ikoyi Link Bridge',
    district: 'Ikoyi Link Bridge',
    neighbors: ['N_IKOYI_EAST', 'N_IKOYI_BRIDGE_MID'],
    speedLimit: 75,
    isDualCarriageway: true,
  },
  N_IKOYI_BRIDGE_MID: {
    id: 'N_IKOYI_BRIDGE_MID',
    x: 520,
    y: 7.0,
    z: -20,
    name: 'Ikoyi Link Bridge Cable Pylon',
    roadName: 'Ikoyi Link Bridge',
    district: 'Ikoyi Link Bridge',
    neighbors: ['N_IKOYI_BRIDGE_W', 'N_LEKKI_LINK_E'],
    speedLimit: 85,
    isDualCarriageway: true,
    isBridge: true,
  },
  N_LEKKI_LINK_E: {
    id: 'N_LEKKI_LINK_E',
    x: 625,
    y: 0,
    z: -20,
    name: 'Lekki Link Bridge East Touchdown',
    roadName: 'Ikoyi Link Bridge',
    district: 'Lekki Peninsula',
    neighbors: ['N_IKOYI_BRIDGE_MID', 'N_LEKKI_PHASE1'],
    speedLimit: 75,
    isDualCarriageway: true,
  },

  // === LEKKI PENINSULA DISTRICT ===
  N_LEKKI_PHASE1: {
    id: 'N_LEKKI_PHASE1',
    x: 660,
    z: -20,
    name: 'Lekki Phase 1 Admiralty Hub',
    roadName: 'Admiralty Way',
    district: 'Lekki Peninsula',
    neighbors: ['N_LEKKI_LINK_E', 'N_LEKKI_NORTH', 'N_LEKKI_ADMIRALTY', 'N_LEKKI_EAST'],
    speedLimit: 65,
    isDualCarriageway: true,
  },
  N_LEKKI_NORTH: {
    id: 'N_LEKKI_NORTH',
    x: 660,
    z: -110,
    name: 'Lekki Waterfront Promenade',
    roadName: 'Fola Osibo Drive',
    district: 'Lekki Peninsula',
    neighbors: ['N_LEKKI_PHASE1'],
    speedLimit: 55,
    isDualCarriageway: true,
  },
  N_LEKKI_EAST: {
    id: 'N_LEKKI_EAST',
    x: 790,
    z: -20,
    name: 'Lekki Estates & Ikate North',
    roadName: 'Freedom Way',
    district: 'Lekki Peninsula',
    neighbors: ['N_LEKKI_PHASE1', 'N_IKATE'],
    speedLimit: 60,
    isDualCarriageway: true,
  },
  N_LEKKI_ADMIRALTY: {
    id: 'N_LEKKI_ADMIRALTY',
    x: 660,
    z: 100,
    name: 'Lekki Peninsula Admiralty Gate',
    roadName: 'Lekki-Epe Expressway',
    district: 'Lekki Peninsula',
    neighbors: ['N_LEKKI_PHASE1', 'N_IKATE'],
    speedLimit: 80,
    isDualCarriageway: true,
  },

  // === LEKKI-EPE EXPRESSWAY: IKATE -> ELEGANZA -> VGC -> AJAH FLYOVER -> ELEKO -> EPE ===
  N_IKATE: {
    id: 'N_IKATE',
    x: 790,
    z: 100,
    name: 'Ikate Chisco Junction',
    roadName: 'Lekki-Epe Expressway',
    district: 'Ikate',
    neighbors: ['N_LEKKI_ADMIRALTY', 'N_LEKKI_EAST', 'N_ELEGANZA', 'N_COASTAL_LEKKI'],
    speedLimit: 85,
    isDualCarriageway: true,
  },
  N_ELEGANZA: {
    id: 'N_ELEGANZA',
    x: 905,
    z: 100,
    name: 'Eleganza Commercial Plaza',
    roadName: 'Lekki-Epe Expressway',
    district: 'Eleganza',
    neighbors: ['N_IKATE', 'N_VGC'],
    speedLimit: 85,
    isDualCarriageway: true,
  },
  N_VGC: {
    id: 'N_VGC',
    x: 1015,
    z: 100,
    name: 'VGC Expressway Interchange',
    roadName: 'Lekki-Epe Expressway',
    district: 'VGC',
    neighbors: ['N_ELEGANZA', 'N_VGC_ESTATE', 'N_AJAH_W_APPROACH'],
    speedLimit: 80,
    isDualCarriageway: true,
  },
  N_VGC_ESTATE: {
    id: 'N_VGC_ESTATE',
    x: 1015,
    z: -15,
    name: 'Victoria Garden City (VGC) Estate',
    roadName: 'VGC Boulevard',
    district: 'VGC',
    neighbors: ['N_VGC'],
    speedLimit: 45,
    isDualCarriageway: true,
  },

  // Ajah Multi-Level Flyover + Ground Underpass Interchange
  N_AJAH_W_APPROACH: {
    id: 'N_AJAH_W_APPROACH',
    x: 1055,
    y: 0,
    z: 100,
    name: 'Ajah West Flyover Approach',
    roadName: 'Lekki-Epe Expressway',
    district: 'Ajah',
    neighbors: ['N_VGC', 'N_AJAH_FLYOVER', 'N_AJAH_SLIP_N', 'N_AJAH_SLIP_S'],
    speedLimit: 80,
    isDualCarriageway: true,
  },
  N_AJAH_FLYOVER: {
    id: 'N_AJAH_FLYOVER',
    x: 1135,
    y: 6.2,
    z: 100,
    name: 'Ajah Express Overpass Deck',
    roadName: 'Ajah Flyover',
    district: 'Ajah',
    neighbors: ['N_AJAH_W_APPROACH', 'N_AJAH_E_APPROACH'],
    speedLimit: 90,
    isDualCarriageway: true,
    isBridge: true,
  },
  N_AJAH_E_APPROACH: {
    id: 'N_AJAH_E_APPROACH',
    x: 1215,
    y: 0,
    z: 100,
    name: 'Ajah East Flyover Touchdown',
    roadName: 'Lekki-Epe Expressway',
    district: 'Ajah',
    neighbors: ['N_AJAH_FLYOVER', 'N_AJAH_SLIP_NE', 'N_AJAH_SLIP_SE', 'N_ELEKO_RD'],
    speedLimit: 80,
    isDualCarriageway: true,
  },
  N_AJAH_SLIP_N: {
    id: 'N_AJAH_SLIP_N',
    x: 1095,
    y: 0,
    z: 72,
    name: 'Ajah North Service Slip',
    roadName: 'Ajah Service Road',
    district: 'Ajah',
    neighbors: ['N_AJAH_W_APPROACH', 'N_AJAH_GROUND'],
    speedLimit: 50,
  },
  N_AJAH_SLIP_S: {
    id: 'N_AJAH_SLIP_S',
    x: 1095,
    y: 0,
    z: 128,
    name: 'Ajah South Service Slip',
    roadName: 'Ajah Service Road',
    district: 'Ajah',
    neighbors: ['N_AJAH_W_APPROACH', 'N_AJAH_GROUND'],
    speedLimit: 50,
  },
  N_AJAH_SLIP_NE: {
    id: 'N_AJAH_SLIP_NE',
    x: 1175,
    y: 0,
    z: 72,
    name: 'Ajah Eastbound Slip North',
    roadName: 'Ajah Service Road',
    district: 'Ajah',
    neighbors: ['N_AJAH_GROUND', 'N_AJAH_E_APPROACH'],
    speedLimit: 50,
  },
  N_AJAH_SLIP_SE: {
    id: 'N_AJAH_SLIP_SE',
    x: 1175,
    y: 0,
    z: 128,
    name: 'Ajah Eastbound Slip South',
    roadName: 'Ajah Service Road',
    district: 'Ajah',
    neighbors: ['N_AJAH_GROUND', 'N_AJAH_E_APPROACH'],
    speedLimit: 50,
  },
  N_AJAH_GROUND: {
    id: 'N_AJAH_GROUND',
    x: 1135,
    y: 0,
    z: 100,
    name: 'Ajah Underpass & Jubilee Junction',
    roadName: 'Addo-Badore / Ajah Crossroad',
    district: 'Ajah',
    neighbors: [
      'N_AJAH_SLIP_N',
      'N_AJAH_SLIP_S',
      'N_AJAH_SLIP_NE',
      'N_AJAH_SLIP_SE',
      'N_AJAH_NORTH',
      'N_AJAH_BADORE_S',
    ],
    speedLimit: 50,
    isDualCarriageway: true,
  },
  N_AJAH_NORTH: {
    id: 'N_AJAH_NORTH',
    x: 1135,
    z: -15,
    name: 'Ajah Lagoon Drive North',
    roadName: 'Badore Coastal Road',
    district: 'Ajah',
    neighbors: ['N_AJAH_GROUND'],
    speedLimit: 60,
    isDualCarriageway: true,
  },
  N_AJAH_BADORE_S: {
    id: 'N_AJAH_BADORE_S',
    x: 1135,
    z: 195,
    name: 'Ajah / Sangotedo South Link',
    roadName: 'Addo Road South',
    district: 'Ajah',
    neighbors: ['N_AJAH_GROUND', 'N_COASTAL_AJAH'],
    speedLimit: 60,
    isDualCarriageway: true,
  },

  // === ELEKO & PRESERVED EPE CORRIDOR + EPE LAGOON BRIDGE ===
  N_ELEKO_RD: {
    id: 'N_ELEKO_RD',
    x: 1285,
    z: 100,
    name: 'Eleko / Lekki-Epe Expressway',
    roadName: 'Lekki-Epe Expressway',
    district: 'Epe Corridor',
    neighbors: ['N_AJAH_E_APPROACH', 'N_EPE_BRIDGE_W'],
    speedLimit: 90,
    isDualCarriageway: true,
  },
  N_EPE_BRIDGE_W: {
    id: 'N_EPE_BRIDGE_W',
    x: 1325,
    y: 0,
    z: 100,
    name: 'Epe Bridge West Approach',
    roadName: 'Epe Lagoon Bridge',
    district: 'Epe Corridor',
    neighbors: ['N_ELEKO_RD', 'N_EPE_BRIDGE_MID'],
    speedLimit: 75,
    isDualCarriageway: true,
  },
  N_EPE_BRIDGE_MID: {
    id: 'N_EPE_BRIDGE_MID',
    x: 1388,
    y: 5.8,
    z: 100,
    name: 'Epe Lagoon Bridge Center Span',
    roadName: 'Epe Lagoon Bridge',
    district: 'Epe Corridor',
    neighbors: ['N_EPE_BRIDGE_W', 'N_EPE_BRIDGE_E'],
    speedLimit: 80,
    isDualCarriageway: true,
    isBridge: true,
  },
  N_EPE_BRIDGE_E: {
    id: 'N_EPE_BRIDGE_E',
    x: 1450,
    y: 0,
    z: 100,
    name: 'Epe Bridge East Touchdown',
    roadName: 'Epe Lagoon Bridge',
    district: 'Epe Corridor',
    neighbors: ['N_EPE_BRIDGE_MID', 'N_EPE_TOWN'],
    speedLimit: 75,
    isDualCarriageway: true,
  },
  N_EPE_TOWN: {
    id: 'N_EPE_TOWN',
    x: 1495,
    z: 100,
    name: 'Epe Town Gateway',
    roadName: 'Epe Expressway',
    district: 'Epe Corridor',
    neighbors: ['N_EPE_BRIDGE_E', 'N_EPE_WATERFRONT', 'N_EPE_RESORT'],
    speedLimit: 70,
    isDualCarriageway: true,
  },
  N_EPE_RESORT: {
    id: 'N_EPE_RESORT',
    x: 1495,
    z: 25,
    name: 'Epe Lagoon Promenade',
    roadName: 'Epe Marina Road',
    district: 'Epe Corridor',
    neighbors: ['N_EPE_TOWN'],
    speedLimit: 60,
  },
  N_EPE_WATERFRONT: {
    id: 'N_EPE_WATERFRONT',
    x: 1565,
    z: 100,
    name: 'Epe Waterfront Marina',
    roadName: 'Epe Waterfront Road',
    district: 'Epe Corridor',
    neighbors: ['N_EPE_TOWN', 'N_COASTAL_ELEKO'],
    speedLimit: 55,
    isDualCarriageway: true,
  },

  // === IYANA-OWORO INTERCHANGE & MAINLAND CORRIDOR (NORTH -Z) ===
  N_IYANA_OWORO: {
    id: 'N_IYANA_OWORO',
    x: 0,
    z: -640,
    name: 'Iyana-Oworo Interchange',
    roadName: 'Oworonshoki Expressway',
    district: 'Iyana-Oworo',
    neighbors: ['N_TMB_NORTH', 'N_OSHODI_EAST', 'N_IKEJA_SOUTH'],
    speedLimit: 70,
    isDualCarriageway: true,
  },
  N_OSHODI_EAST: {
    id: 'N_OSHODI_EAST',
    x: -130,
    z: -640,
    name: 'Anthony / Gbagada Express',
    roadName: 'Oworonshoki-Oshodi Exp',
    district: 'Oshodi Corridor',
    neighbors: ['N_IYANA_OWORO', 'N_OSHODI', 'N_ALAUSA_LINK'],
    speedLimit: 80,
    isDualCarriageway: true,
  },
  N_OSHODI: {
    id: 'N_OSHODI',
    x: -260,
    z: -640,
    name: 'Oshodi Transport Interchange',
    roadName: 'Oshodi Expressway',
    district: 'Oshodi',
    neighbors: ['N_OSHODI_EAST', 'N_IPAJA_LINK', 'N_AKESAN_LINK', 'N_MILE2'],
    speedLimit: 70,
    isDualCarriageway: true,
  },
  N_IKEJA_SOUTH: {
    id: 'N_IKEJA_SOUTH',
    x: 0,
    z: -760,
    name: 'Oregun / Ikeja South',
    roadName: 'Ikeja Avenue',
    district: 'Ikeja',
    neighbors: ['N_IYANA_OWORO', 'N_IKEJA', 'N_ALAUSA_LINK'],
    speedLimit: 70,
    isDualCarriageway: true,
  },
  N_ALAUSA_LINK: {
    id: 'N_ALAUSA_LINK',
    x: -130,
    z: -760,
    name: 'Alausa Secretariat Link',
    roadName: 'Obafemi Awolowo Way',
    district: 'Ikeja',
    neighbors: ['N_IKEJA_SOUTH', 'N_OSHODI_EAST', 'N_IKEJA_WEST', 'N_IPAJA_LINK'],
    speedLimit: 65,
    isDualCarriageway: true,
  },
  N_IKEJA: {
    id: 'N_IKEJA',
    x: 0,
    z: -880,
    name: 'Ikeja Central Business District',
    roadName: 'Mobolaji Bank Anthony / Ikeja',
    district: 'Ikeja',
    neighbors: ['N_IKEJA_SOUTH', 'N_IKEJA_WEST', 'N_MMIA_LINK'],
    speedLimit: 65,
    isDualCarriageway: true,
  },
  N_IKEJA_WEST: {
    id: 'N_IKEJA_WEST',
    x: -130,
    z: -880,
    name: 'Ikeja Along / Agege Motor Rd',
    roadName: 'Abeokuta Expressway',
    district: 'Ikeja',
    neighbors: ['N_IKEJA', 'N_ALAUSA_LINK', 'N_IYANA_IPAJA'],
    speedLimit: 75,
    isDualCarriageway: true,
  },
  N_IPAJA_LINK: {
    id: 'N_IPAJA_LINK',
    x: -260,
    z: -760,
    name: 'Dopemu Bridge Link',
    roadName: 'Lagos-Abeokuta Exp',
    district: 'Iyana Ipaja',
    neighbors: ['N_OSHODI', 'N_ALAUSA_LINK', 'N_IYANA_IPAJA'],
    speedLimit: 80,
    isDualCarriageway: true,
  },
  N_IYANA_IPAJA: {
    id: 'N_IYANA_IPAJA',
    x: -260,
    z: -880,
    name: 'Iyana Ipaja Flyover Junction',
    roadName: 'Iyana Ipaja / Egbeda Rd',
    district: 'Iyana Ipaja',
    neighbors: ['N_IKEJA_WEST', 'N_IPAJA_LINK', 'N_EGBEDA'],
    speedLimit: 75,
    isDualCarriageway: true,
  },
  N_EGBEDA: {
    id: 'N_EGBEDA',
    x: -410,
    z: -840,
    name: 'Egbeda Commercial Junction',
    roadName: 'Idimu-Egbeda Road',
    district: 'Egbeda',
    neighbors: ['N_IYANA_IPAJA', 'N_AKESAN_LINK', 'N_IGANDO'],
    speedLimit: 70,
    isDualCarriageway: true,
  },
  N_AKESAN_LINK: {
    id: 'N_AKESAN_LINK',
    x: -410,
    z: -690,
    name: 'Ikotun / Ejigbo Bypass',
    roadName: 'Ikotun-Egbeda Road',
    district: 'Egbeda',
    neighbors: ['N_OSHODI', 'N_EGBEDA', 'N_ISHERI_OLOFIN', 'N_MILE2'],
    speedLimit: 70,
    isDualCarriageway: true,
  },
  N_IGANDO: {
    id: 'N_IGANDO',
    x: -550,
    z: -790,
    name: 'Igando Transit Hub',
    roadName: 'LASU-Isheri Expressway',
    district: 'Igando',
    neighbors: ['N_EGBEDA', 'N_AKESAN', 'N_ISHERI_OLOFIN'],
    speedLimit: 75,
    isDualCarriageway: true,
  },
  N_ISHERI_OLOFIN: {
    id: 'N_ISHERI_OLOFIN',
    x: -550,
    z: -690,
    name: 'Isheri-Olofin Link',
    roadName: 'Igando-Ikotun Link',
    district: 'Igando',
    neighbors: ['N_AKESAN_LINK', 'N_IGANDO', 'N_AKESAN', 'N_MILE2_W'],
    speedLimit: 65,
    isDualCarriageway: true,
  },
  N_AKESAN: {
    id: 'N_AKESAN',
    x: -680,
    z: -720,
    name: 'Akesan Suburban Plaza',
    roadName: 'LASU-Iba Expressway',
    district: 'Akesan',
    neighbors: ['N_IGANDO', 'N_ISHERI_OLOFIN', 'N_LASU_GATE', 'N_BADAGRY_BYPASS_E'],
    speedLimit: 75,
    isDualCarriageway: true,
  },
  N_LASU_GATE: {
    id: 'N_LASU_GATE',
    x: -790,
    z: -660,
    name: 'LASU Main Entrance Gate',
    roadName: 'Badagry / LASU Gate Blvd',
    district: 'LASU Campus',
    neighbors: ['N_AKESAN', 'N_LASU_CAMPUS', 'N_MILE2_W'],
    speedLimit: 55,
    isDualCarriageway: true,
  },
  N_LASU_CAMPUS: {
    id: 'N_LASU_CAMPUS',
    x: -875,
    z: -660,
    name: 'LASU Academic Quad',
    roadName: 'University Senate Way',
    district: 'LASU Campus',
    neighbors: ['N_LASU_GATE', 'N_LASU_ADMIN', 'N_LASU_NORTH'],
    speedLimit: 40,
  },
  N_LASU_ADMIN: {
    id: 'N_LASU_ADMIN',
    x: -935,
    z: -660,
    name: 'LASU Senate & Central Library',
    roadName: 'Senate Square',
    district: 'LASU Campus',
    neighbors: ['N_LASU_CAMPUS', 'N_LASU_ADMIN_N'],
    speedLimit: 35,
  },
  N_LASU_NORTH: {
    id: 'N_LASU_NORTH',
    x: -875,
    z: -720,
    name: 'LASU Faculties & Hostels North',
    roadName: 'Campus Ring Road',
    district: 'LASU Campus',
    neighbors: ['N_LASU_CAMPUS', 'N_LASU_ADMIN_N'],
    speedLimit: 35,
  },
  N_LASU_ADMIN_N: {
    id: 'N_LASU_ADMIN_N',
    x: -935,
    z: -720,
    name: 'LASU Auditorium & Lecture Hall',
    roadName: 'Campus Ring Road',
    district: 'LASU Campus',
    neighbors: ['N_LASU_NORTH', 'N_LASU_ADMIN'],
    speedLimit: 35,
  },

  // === MURTALA MUHAMMED INTERNATIONAL AIRPORT (MMIA - MAINLAND CLOSE TO IKEJA) ===
  N_MMIA_LINK: {
    id: 'N_MMIA_LINK',
    x: 120,
    z: -880,
    name: 'Airport Road / Ikeja East Approach',
    roadName: 'Murtala Muhammed Airport Rd',
    district: 'Ikeja Airport',
    neighbors: ['N_IKEJA', 'N_MMIA_GATE1_EXT', 'N_MMIA_WEST_RD'],
    speedLimit: 75,
    isDualCarriageway: true,
  },
  N_MMIA_GATE1_EXT: {
    id: 'N_MMIA_GATE1_EXT',
    x: 240,
    z: -880,
    name: 'MMIA Main Gate Approach',
    roadName: 'MMIA Terminal Access',
    district: 'Murtala Muhammed Airport',
    neighbors: ['N_MMIA_LINK', 'N_MMIA_GATE1'],
    speedLimit: 65,
    isDualCarriageway: true,
  },
  N_MMIA_GATE1: {
    id: 'N_MMIA_GATE1',
    x: 240,
    z: -960,
    name: 'MMIA South Security Gate 1',
    roadName: 'MMIA Terminal Boulevard',
    district: 'Murtala Muhammed Airport',
    neighbors: ['N_MMIA_GATE1_EXT', 'N_MMIA_TERMINAL'],
    speedLimit: 45,
    isDualCarriageway: true,
  },
  N_MMIA_WEST_RD: {
    id: 'N_MMIA_WEST_RD',
    x: 120,
    z: -1080,
    name: 'MMIA West Executive Perimeter Road',
    roadName: 'Private Aviation Approach',
    district: 'Murtala Muhammed Airport',
    neighbors: ['N_MMIA_LINK', 'N_MMIA_GATE2'],
    speedLimit: 60,
    isDualCarriageway: true,
  },
  N_MMIA_GATE2: {
    id: 'N_MMIA_GATE2',
    x: 165,
    z: -1080,
    name: 'MMIA Executive Gate 2 (Private Jets)',
    roadName: 'MMIA Executive Drive',
    district: 'Murtala Muhammed Airport',
    neighbors: ['N_MMIA_WEST_RD', 'N_MMIA_PRIVATE_JETS'],
    speedLimit: 45,
    isDualCarriageway: true,
  },
  N_MMIA_TERMINAL: {
    id: 'N_MMIA_TERMINAL',
    x: 240,
    z: -1030,
    name: 'MMIA International Terminal Forecourt',
    roadName: 'Terminal Concourse Drive',
    district: 'Murtala Muhammed Airport',
    neighbors: ['N_MMIA_GATE1', 'N_MMIA_PRIVATE_JETS', 'N_MMIA_APRON'],
    speedLimit: 40,
    isDualCarriageway: true,
  },
  N_MMIA_PRIVATE_JETS: {
    id: 'N_MMIA_PRIVATE_JETS',
    x: 240,
    z: -1120,
    name: 'MMIA Private Jet & Exec Apron',
    roadName: 'Private Aviation Apron Rd',
    district: 'Murtala Muhammed Airport',
    neighbors: ['N_MMIA_GATE2', 'N_MMIA_TERMINAL'],
    speedLimit: 35,
  },
  N_MMIA_APRON: {
    id: 'N_MMIA_APRON',
    x: 345,
    z: -1030,
    name: 'MMIA Hangar & Airside Service Rd',
    roadName: 'Airside Hangar Road',
    district: 'Murtala Muhammed Airport',
    neighbors: ['N_MMIA_TERMINAL'],
    speedLimit: 35,
  },

  // === MILE 2 RAIL INTERCHANGE & IYANOBA LOW-RISE MAINLAND TOWN ===
  N_MILE2: {
    id: 'N_MILE2',
    x: -455,
    z: -622,
    name: 'Mile 2 Blue Line Station & Interchange',
    roadName: 'Lagos-Badagry / Apapa Exp',
    district: 'Mile 2',
    neighbors: ['N_OSHODI', 'N_AKESAN_LINK', 'N_MILE2_W'],
    speedLimit: 70,
    isDualCarriageway: true,
  },
  N_MILE2_W: {
    id: 'N_MILE2_W',
    x: -620,
    z: -622,
    name: 'Festac / Alakija Link',
    roadName: 'Lagos-Badagry Expressway',
    district: 'Mile 2',
    neighbors: ['N_MILE2', 'N_ISHERI_OLOFIN', 'N_LASU_GATE'],
    speedLimit: 75,
    isDualCarriageway: true,
  },
  N_BADAGRY_BYPASS_E: {
    id: 'N_BADAGRY_BYPASS_E',
    x: -790,
    z: -818,
    name: 'LASU North Expressway Bypass East',
    roadName: 'LASU-Iyanoba Express',
    district: 'Iyanoba Corridor',
    neighbors: ['N_AKESAN', 'N_BADAGRY_BYPASS_W'],
    speedLimit: 80,
    isDualCarriageway: true,
  },
  N_BADAGRY_BYPASS_W: {
    id: 'N_BADAGRY_BYPASS_W',
    x: -1035,
    z: -818,
    name: 'Iyanoba North Express Junction',
    roadName: 'LASU-Iyanoba Express',
    district: 'Iyanoba',
    neighbors: ['N_BADAGRY_BYPASS_E', 'N_IYANOBA_E'],
    speedLimit: 75,
    isDualCarriageway: true,
  },
  N_IYANOBA_E: {
    id: 'N_IYANOBA_E',
    x: -1035,
    z: -640,
    name: 'Iyanoba East Bus Park',
    roadName: 'Badagry Exp / Iyanoba Entry',
    district: 'Iyanoba',
    neighbors: ['N_BADAGRY_BYPASS_W', 'N_IYANOBA'],
    speedLimit: 60,
    isDualCarriageway: true,
  },
  N_IYANOBA: {
    id: 'N_IYANOBA',
    x: -1160,
    z: -640,
    name: 'Iyanoba Town Center & Station',
    roadName: 'Iyanoba Central Road',
    district: 'Iyanoba',
    neighbors: ['N_IYANOBA_E', 'N_IYANOBA_W', 'N_IYANOBA_N'],
    speedLimit: 50,
    isDualCarriageway: true,
  },
  N_IYANOBA_W: {
    id: 'N_IYANOBA_W',
    x: -1260,
    z: -640,
    name: 'Iyanoba West Residential Quarter',
    roadName: 'Iyanoba Central Road',
    district: 'Iyanoba',
    neighbors: ['N_IYANOBA', 'N_IYANOBA_NW'],
    speedLimit: 45,
  },
  N_IYANOBA_N: {
    id: 'N_IYANOBA_N',
    x: -1160,
    z: -740,
    name: 'Iyanoba North Market Street',
    roadName: 'Iyanoba Market Street',
    district: 'Iyanoba',
    neighbors: ['N_IYANOBA', 'N_IYANOBA_NW'],
    speedLimit: 45,
  },
  N_IYANOBA_NW: {
    id: 'N_IYANOBA_NW',
    x: -1260,
    z: -740,
    name: 'Iyanoba Northwest Quarter',
    roadName: 'Iyanoba Residential Lane',
    district: 'Iyanoba',
    neighbors: ['N_IYANOBA_W', 'N_IYANOBA_N'],
    speedLimit: 45,
  },

  // === LAGOS COASTAL HIGHWAY (4-LANE EXPRESSWAY: VICTORIA ISLAND -> EPE) ===
  // Flat continuous paved coastal road with Atlantic Ocean strictly on the South (+Z) side and 5 two-lane inlets branching North (-Z).
  N_COASTAL_VI_START: {
    id: 'N_COASTAL_VI_START',
    x: 160,
    z: 320,
    name: 'Victoria Island Coastal Highway Start',
    roadName: 'Lagos-Calabar Coastal Highway',
    district: 'Victoria Island Coastal',
    neighbors: ['N_MARINA_E', 'N_COASTAL_IKOYI_S'],
    speedLimit: 110,
    isDualCarriageway: true,
    roadProfile: 'COASTAL_4LANE',
  },
  N_COASTAL_IKOYI_S: {
    id: 'N_COASTAL_IKOYI_S',
    x: 365,
    z: 320,
    name: 'Coastal Road / Ikoyi South Inlet',
    roadName: 'Lagos-Calabar Coastal Highway',
    district: 'Victoria Island Coastal',
    neighbors: ['N_IKOYI_SOUTH_E', 'N_COASTAL_VI_START', 'N_COASTAL_LEKKI'],
    speedLimit: 110,
    isDualCarriageway: true,
    roadProfile: 'COASTAL_4LANE',
  },
  N_COASTAL_LEKKI: {
    id: 'N_COASTAL_LEKKI',
    x: 790,
    z: 320,
    name: 'Coastal Road / Lekki-Ikate Inlet',
    roadName: 'Lagos-Calabar Coastal Highway',
    district: 'Lekki Coastal',
    neighbors: ['N_IKATE', 'N_COASTAL_IKOYI_S', 'N_COASTAL_AJAH'],
    speedLimit: 110,
    isDualCarriageway: true,
    roadProfile: 'COASTAL_4LANE',
  },
  N_COASTAL_AJAH: {
    id: 'N_COASTAL_AJAH',
    x: 1135,
    z: 320,
    name: 'Coastal Road / Ajah-Sangotedo Inlet',
    roadName: 'Lagos-Calabar Coastal Highway',
    district: 'Ajah Coastal',
    neighbors: ['N_AJAH_BADORE_S', 'N_COASTAL_LEKKI', 'N_COASTAL_ELEKO'],
    speedLimit: 110,
    isDualCarriageway: true,
    roadProfile: 'COASTAL_4LANE',
  },
  N_COASTAL_ELEKO: {
    id: 'N_COASTAL_ELEKO',
    x: 1565,
    z: 320,
    name: 'Coastal Road / Eleko-Epe Inlet',
    roadName: 'Lagos-Calabar Coastal Highway',
    district: 'Epe Coastal',
    neighbors: ['N_EPE_WATERFRONT', 'N_COASTAL_AJAH', 'N_COASTAL_EPE_MID'],
    speedLimit: 110,
    isDualCarriageway: true,
    roadProfile: 'COASTAL_4LANE',
  },
  N_COASTAL_EPE_MID: {
    id: 'N_COASTAL_EPE_MID',
    x: 1920,
    z: 320,
    name: 'Epe Coastal Expressway KM 4',
    roadName: 'Lagos-Calabar Coastal Highway',
    district: 'Epe Coastal',
    neighbors: ['N_COASTAL_ELEKO', 'N_COASTAL_EPE_END'],
    speedLimit: 110,
    isDualCarriageway: true,
    roadProfile: 'COASTAL_4LANE',
  },
  N_COASTAL_EPE_END: {
    id: 'N_COASTAL_EPE_END',
    x: 2260,
    z: 320,
    name: 'Epe Coastal Highway Terminus',
    roadName: 'Lagos-Calabar Coastal Highway',
    district: 'Epe Coastal',
    neighbors: ['N_COASTAL_EPE_MID'],
    speedLimit: 110,
    isDualCarriageway: true,
    roadProfile: 'COASTAL_4LANE',
  },
};

export function getRoadSegmentProfile(a: RoadNode, b: RoadNode): RoadProfile {
  if (a.roadProfile === 'COASTAL_4LANE' && b.roadProfile === 'COASTAL_4LANE') {
    return 'COASTAL_4LANE';
  }
  if (a.roadProfile === 'COASTAL_4LANE' || b.roadProfile === 'COASTAL_4LANE') {
    return 'INLET_2LANE';
  }
  return 'STANDARD';
}

export const COASTAL_KM_MARKERS = [
  { km: 0, label: 'KM 0', subtitle: 'VICTORIA ISLAND START · EPE 5 KM', x: 180 * WORLD_XZ_SCALE },
  { km: 1, label: 'KM 1', subtitle: 'IKOYI SOUTH BEACHFRONT · EPE 4 KM', x: 596 * WORLD_XZ_SCALE },
  { km: 2, label: 'KM 2', subtitle: 'LEKKI / IKATE COASTAL · EPE 3 KM', x: 1012 * WORLD_XZ_SCALE },
  { km: 3, label: 'KM 3', subtitle: 'AJAH OCEANFRONT · EPE 2 KM', x: 1428 * WORLD_XZ_SCALE },
  { km: 4, label: 'KM 4', subtitle: 'ELEKO COASTAL RUN · EPE 1 KM', x: 1844 * WORLD_XZ_SCALE },
  { km: 5, label: 'KM 5', subtitle: 'EPE COASTAL TERMINUS', x: 2235 * WORLD_XZ_SCALE },
];

// Apply horizontal road/bridge extension cleanly while preserving exact Adekunle Ramp splice
for (const [id, node] of Object.entries(LAGOS_ROAD_NODES)) {
  if (id === 'N_ADEKUNLE_EXIT') {
    node.x = 14.0;
    node.z = -183.4 * WORLD_XZ_SCALE;
  } else if (id === 'N_ADEKUNLE_RAMP') {
    node.x = (14.0 + 160 * WORLD_XZ_SCALE) * 0.5;
    node.z = (-183.4 * WORLD_XZ_SCALE + -130 * WORLD_XZ_SCALE) * 0.5;
  } else {
    node.x *= WORLD_XZ_SCALE;
    node.z *= WORLD_XZ_SCALE;
  }
}

// =========================================================================
// 2. CITY DISTRICTS & MEANINGFUL INTERACTIVE LANDMARKS (15+ REGIONS)
// =========================================================================
export const CITY_LANDMARKS: CityLandmark[] = [
  {
    id: 'SHOWROOM_HUB',
    name: 'MANIFOLD Proving Grounds',
    subTitle: 'Automotive Showcase & Performance Garage',
    district: 'SHOWROOM_HUB',
    x: 0,
    z: -35,
    radius: 12,
    description: 'Central vehicle pavilion featuring premier turntable exhibits and customizer workshop.',
    color: '#EF233C',
    iconType: 'showroom',
  },
  {
    id: 'YABA_TECH',
    name: 'Yaba Innovation Hub',
    subTitle: 'Technology & Hardware Development Center',
    district: 'YABA_TECH',
    x: 0,
    z: -130,
    radius: 15,
    description: 'Tech cluster building high-performance automotive ECUs and Third Mainland south approach.',
    color: '#38BDF8',
    iconType: 'tech',
  },
  {
    id: 'COMMERCIAL_BANK',
    name: 'Commercial Avenue Banking Row',
    subTitle: 'Financial & Corporate Corridor',
    district: 'COMMERCIAL_ROW',
    x: 105,
    z: 0,
    radius: 15,
    description: 'Banking headquarters and commercial trade houses lining Commercial Avenue.',
    color: '#F59E0B',
    iconType: 'bank',
  },
  {
    id: 'LOGISTICS_DEPOT',
    name: 'Mainland Cargo Logistics Depot',
    subTitle: 'Surulere Freight & Distribution Dock',
    district: 'LOGISTICS_DEPOT',
    x: -55,
    z: 100,
    radius: 14,
    description: 'Busy shipping distribution center receiving urgent freight across Lagos.',
    color: '#10B981',
    iconType: 'delivery',
  },
  {
    id: 'COASTAL_RACE_GRID',
    name: 'Coastal Highway Race Grid (Victoria Island)',
    subTitle: '4-Lane Oceanfront Grand Prix Start',
    district: 'COASTAL',
    x: 200,
    z: 320,
    radius: 16,
    description: 'High-speed 4-lane Lagos Coastal Road racing grid. Compete head-to-head to Epe Terminus.',
    color: '#DC2626',
    iconType: 'race',
  },
  {
    id: 'MARKETPLACE_GATEWAY',
    name: 'MANIFOLD Grand Marketplace Portal',
    subTitle: 'National Automotive Dealership Exchange',
    district: 'MARKETPLACE',
    x: 0,
    z: 100,
    radius: 14,
    description: 'Direct entry into verified dealer inventory, physical car listings, and purchase financing.',
    color: '#8B5CF6',
    iconType: 'portal',
  },

  // === THIRD MAINLAND BRIDGE, ADEKUNLE, OBALENDE & IKOYI ===
  {
    id: 'THIRD_MAINLAND_BRIDGE',
    name: 'Third Mainland Bridge',
    subTitle: '4-Lane Dual-Carriageway Over Lagos Lagoon',
    district: 'BRIDGE',
    x: 0,
    z: -380,
    radius: 18,
    description: 'Long straight continuous dual-carriageway bridge linking Lagos Island to Iyana-Oworo.',
    color: '#38BDF8',
    iconType: 'bridge',
  },
  {
    id: 'ADEKUNLE_INTERCHANGE',
    name: 'Adekunle Ramp Interchange',
    subTitle: 'Bridge Return Flyover to Obalende & Ikoyi',
    district: 'OBALENDE',
    x: 160,
    z: -130,
    radius: 16,
    description: 'Elevated southbound exit ramp branching east toward Obalende commercial hub and Ikoyi.',
    color: '#F59E0B',
    iconType: 'bridge',
  },
  {
    id: 'OBALENDE_TERMINAL',
    name: 'Obalende Market & Bus Terminal',
    subTitle: 'Commercial Shops, Kiosks & Danfo Interchange',
    district: 'OBALENDE',
    x: 160,
    z: 30,
    radius: 16,
    description: 'Vibrant Lagos street market, roadside kiosks, and off-lane Danfo transit interchange.',
    color: '#FACC15',
    iconType: 'district',
  },
  {
    id: 'IKOYI_DISTRICT',
    name: 'Ikoyi Estates & Towers',
    subTitle: 'Bourdillon High-Rises & Gated Communities',
    district: 'IKOYI',
    x: 315,
    z: -75,
    radius: 18,
    description: 'Affluent district with glass towers, gated estates, perimeter walls, and wide boulevards.',
    color: '#10B981',
    iconType: 'bank',
  },
  {
    id: 'IKOYI_LINK_BRIDGE',
    name: 'Ikoyi-Lekki Link Bridge',
    subTitle: 'Cable-Stayed Elevated Bridge Over Lagoon Channel',
    district: 'BRIDGE',
    x: 520,
    z: -20,
    radius: 18,
    description: 'Iconic cable-stayed two-way bridge connecting Ikoyi directly into Lekki Peninsula.',
    color: '#06B6D4',
    iconType: 'bridge',
  },

  // === LEKKI PENINSULA, IKATE, ELEGANZA, VGC, AJAH & EPE ===
  {
    id: 'LEKKI_PENINSULA',
    name: 'Lekki Peninsula Phase 1',
    subTitle: 'Admiralty Towers, Malls & Coastal Boulevards',
    district: 'LEKKI',
    x: 660,
    z: 40,
    radius: 18,
    description: 'Modern coastal city district featuring malls, hotels, gated residences, and expressway gateway.',
    color: '#06B6D4',
    iconType: 'district',
  },
  {
    id: 'IKATE_CHISCO',
    name: 'Ikate Commercial Hub',
    subTitle: 'Lekki-Epe Expressway Sector 1',
    district: 'LEKKI',
    x: 790,
    z: 100,
    radius: 16,
    description: 'Bustling expressway intersection linking Lekki Peninsula, Ikate, and Freedom Way.',
    color: '#0EA5E9',
    iconType: 'district',
  },
  {
    id: 'ELEGANZA_PLAZA',
    name: 'Eleganza Plaza & Junction',
    subTitle: 'Lekki-Epe Mid-Corridor Trade Center',
    district: 'LEKKI',
    x: 905,
    z: 100,
    radius: 16,
    description: 'Major commercial plaza and bus corridor between Ikate and Victoria Garden City.',
    color: '#8B5CF6',
    iconType: 'district',
  },
  {
    id: 'VGC_ESTATE',
    name: 'Victoria Garden City (VGC)',
    subTitle: 'Gated Luxury Residential Estate & Gatehouse',
    district: 'LEKKI',
    x: 1015,
    z: 20,
    radius: 18,
    description: 'Premier gated residential estate along the Lekki-Epe Expressway with landscaped palm avenues.',
    color: '#22C55E',
    iconType: 'district',
  },
  {
    id: 'AJAH_INTERCHANGE',
    name: 'Ajah Multi-Level Flyover',
    subTitle: 'Elevated Express Overpass & Underpass Market',
    district: 'AJAH',
    x: 1135,
    z: 100,
    radius: 18,
    description: 'Grade-separated multi-level interchange: drive over the Ajah Flyover or through the underpass below.',
    color: '#14B8A6',
    iconType: 'bridge',
  },
  {
    id: 'EPE_BRIDGE',
    name: 'Epe Lagoon Bridge',
    subTitle: 'Coastal Bridge Along Lekki-Epe Expressway',
    district: 'EPE',
    x: 1388,
    z: 100,
    radius: 16,
    description: 'Scenic elevated coastal bridge crossing the Epe lagoon inlet toward Epe Town.',
    color: '#38BDF8',
    iconType: 'bridge',
  },
  {
    id: 'EPE_TOWN',
    name: 'Epe Town & Waterfront Marina',
    subTitle: 'Eastern Lagoon Terminus & Resort',
    district: 'EPE',
    x: 1555,
    z: 100,
    radius: 18,
    description: 'Preserved eastern waterfront promenade and lagoon resort at the end of the Lekki-Epe Expressway.',
    color: '#0EA5E9',
    iconType: 'epe',
  },
  {
    id: 'COASTAL_EPE_FINISH',
    name: 'Epe Coastal Highway Terminus (KM 5)',
    subTitle: 'Atlantic Coast Express Finish Line',
    district: 'COASTAL',
    x: 2220,
    z: 320,
    radius: 18,
    description: 'Eastern finish gantry of the 4-lane Lagos Coastal Road overlooking the Atlantic Ocean.',
    color: '#10B981',
    iconType: 'epe',
  },

  // === MAINLAND & LASU ===
  {
    id: 'IYANA_OWORO',
    name: 'Iyana-Oworo Interchange',
    subTitle: 'Mainland Bridgehead & Highway Hub',
    district: 'MAINLAND',
    x: 0,
    z: -640,
    radius: 16,
    description: 'Major northern bridge landing splitting traffic west to Oshodi and north to Ikeja.',
    color: '#F97316',
    iconType: 'district',
  },
  {
    id: 'OSHODI_HUB',
    name: 'Oshodi Transport Interchange',
    subTitle: 'Central Mainland Transit Terminal',
    district: 'MAINLAND',
    x: -260,
    z: -640,
    radius: 16,
    description: 'Busy multi-lane transit terminal connecting Iyana-Oworo, Ipaja, and Ikotun corridors.',
    color: '#EAB308',
    iconType: 'district',
  },
  {
    id: 'IKEJA_CBD',
    name: 'Ikeja Business District',
    subTitle: 'Lagos State Administrative & Corporate Hub',
    district: 'MAINLAND',
    x: 0,
    z: -880,
    radius: 16,
    description: 'Capital business district featuring corporate towers, shopping plazas, and hotels.',
    color: '#6366F1',
    iconType: 'bank',
  },
  {
    id: 'IYANA_IPAJA',
    name: 'Iyana Ipaja Junction',
    subTitle: 'Alimosho-Abeokuta Highway Interchange',
    district: 'MAINLAND',
    x: -260,
    z: -880,
    radius: 16,
    description: 'High-volume junction linking Ikeja West, Oshodi, and Egbeda dual carriageways.',
    color: '#EC4899',
    iconType: 'district',
  },
  {
    id: 'EGBEDA_JCT',
    name: 'Egbeda Commercial Avenue',
    subTitle: 'Alimosho Shopping & Bus Hub',
    district: 'MAINLAND',
    x: -410,
    z: -840,
    radius: 15,
    description: 'Vibrant dual-carriageway district with plazas, bus stops, and street lighting.',
    color: '#F43F5E',
    iconType: 'district',
  },
  {
    id: 'IGANDO_TOWN',
    name: 'Igando Transit District',
    subTitle: 'LASU-Isheri Expressway Corridor',
    district: 'MAINLAND',
    x: -550,
    z: -790,
    radius: 15,
    description: 'Commercial-residential corridor leading southwest toward Akesan and Ojo.',
    color: '#22C55E',
    iconType: 'district',
  },
  {
    id: 'AKESAN_SUBURB',
    name: 'Akesan Expressway',
    subTitle: 'LASU Approach Suburban Town',
    district: 'MAINLAND',
    x: -680,
    z: -720,
    radius: 15,
    description: 'Suburban development corridor and final approach before Lagos State University.',
    color: '#84CC16',
    iconType: 'district',
  },
  {
    id: 'LASU_UNIVERSITY',
    name: 'Lagos State University (LASU)',
    subTitle: 'Main Ojo Campus • Senate, Faculties & Quad',
    district: 'LASU',
    x: -875,
    z: -660,
    radius: 18,
    description: 'Iconic university campus featuring the grand LASU arch gate, Senate Building, lecture halls, and green lawns.',
    color: '#10B981',
    iconType: 'campus',
  },

  // === MARINA, BLUE LINE RAIL, MMIA AIRPORT, MILE 2 & IYANOBA ===
  {
    id: 'MARINA_FINANCIAL',
    name: 'Marina Financial District (UBA / Wema / UAC)',
    subTitle: 'UBA Bank Skyscraper, Wema Tower & UAC House',
    district: 'MARINA',
    x: 80,
    z: 185,
    radius: 18,
    description: 'Tightly clustered Lagos Island banking skyline anchored by UBA Bank House (tallest), Wema Bank Tower, and UAC House.',
    color: '#DC2626',
    iconType: 'bank',
  },
  {
    id: 'MARINA_RAIL_STATION',
    name: 'Marina Blue Line Terminus Station',
    subTitle: 'Elevated 2nd-Floor Lagoon Rail Bridge',
    district: 'MARINA',
    x: -110,
    z: 185,
    radius: 18,
    description: 'Gigantic Marina multi-level station launching the Blue Line elevated train bridge west across Lagos Lagoon to Mile 2 and Iyanoba.',
    color: '#0EA5E9',
    iconType: 'train',
  },
  {
    id: 'MMIA_AIRPORT',
    name: 'Murtala Muhammed International Airport',
    subTitle: '2 Gates • ATC Tower • Hangars • Private Jets & Runway',
    district: 'AIRPORT',
    x: 240,
    z: -1030,
    radius: 22,
    description: 'Wide international airport near Ikeja with two perimeter drive-in gates, visible ATC tower, airliner hangars, private jet apron, and active runway.',
    color: '#38BDF8',
    iconType: 'airport',
  },
  {
    id: 'MILE2_STATION',
    name: 'Mile 2 Blue Line Rail Interchange',
    subTitle: 'Elevated Rail Station & Badagry Express Hub',
    district: 'MILE2',
    x: -455,
    z: -622,
    radius: 18,
    description: 'Major Mainland rail and highway interchange where the Blue Line elevated passenger train stops before continuing to Iyanoba.',
    color: '#0284C7',
    iconType: 'train',
  },
  {
    id: 'IYANOBA_TOWN',
    name: 'Iyanoba Town & Transit Park',
    subTitle: 'Low-Rise Mainland Suburb · Danfo, Coaster & Okada Hub',
    district: 'IYANOBA',
    x: -1160,
    z: -640,
    radius: 18,
    description: 'Bustling low-rise western Lagos town beyond LASU served by Blue Line rail, yellow Danfos, Coaster buses, cars, and Okadas.',
    color: '#FACC15',
    iconType: 'district',
  },
];

for (const lm of CITY_LANDMARKS) {
  lm.x *= WORLD_XZ_SCALE;
  lm.z *= WORLD_XZ_SCALE;
  lm.radius = Math.max(lm.radius, 14);
}

// 3. Street Race Circuit Checkpoints (For Mission B: City Rival Challenge - Preserved)
export interface RaceCheckpoint {
  id: number;
  x: number;
  z: number;
  name: string;
  radius: number;
}

export const RIVAL_RACE_CHECKPOINTS: RaceCheckpoint[] = [
  { id: 1, x: 200 * WORLD_XZ_SCALE, z: 320 * WORLD_XZ_SCALE, name: 'Victoria Island Coastal Grid', radius: 16 },
  { id: 2, x: 425 * WORLD_XZ_SCALE, z: 320 * WORLD_XZ_SCALE, name: 'KM 1 Ikoyi Oceanfront', radius: 16 },
  { id: 3, x: 650 * WORLD_XZ_SCALE, z: 320 * WORLD_XZ_SCALE, name: 'Kuramo Coastal Straight', radius: 16 },
  { id: 4, x: 875 * WORLD_XZ_SCALE, z: 320 * WORLD_XZ_SCALE, name: 'KM 2 Lekki-Ikate Beach', radius: 16 },
  { id: 5, x: 1100 * WORLD_XZ_SCALE, z: 320 * WORLD_XZ_SCALE, name: 'Ajah Coastal Approach', radius: 16 },
  { id: 6, x: 1325 * WORLD_XZ_SCALE, z: 320 * WORLD_XZ_SCALE, name: 'KM 3 Atlantic Express', radius: 16 },
  { id: 7, x: 1550 * WORLD_XZ_SCALE, z: 320 * WORLD_XZ_SCALE, name: 'Eleko Inlet Straightaway', radius: 16 },
  { id: 8, x: 1775 * WORLD_XZ_SCALE, z: 320 * WORLD_XZ_SCALE, name: 'KM 4 Epe Ocean Boulevard', radius: 16 },
  { id: 9, x: 2000 * WORLD_XZ_SCALE, z: 320 * WORLD_XZ_SCALE, name: 'Epe Final Sprint', radius: 16 },
  { id: 10, x: 2220 * WORLD_XZ_SCALE, z: 320 * WORLD_XZ_SCALE, name: 'Epe Coastal Finish Gantry', radius: 16 },
];

// 4. Core Island Urban Buildings (Additional regional buildings registered in lagosRegionBuilders.ts)
export const LAGOS_BUILDINGS: BuildingBox[] = [
  {
    id: 'B_TECH_1',
    x: 35,
    z: -102,
    width: 26,
    depth: 22,
    height: 32,
    name: 'Yaba Tech Innovation Tower',
    type: 'tech_hub',
    color: 0x1e293b,
    roofColor: 0x0f172a,
    hasSign: true,
    signText: 'YABA TECH HUB',
  },
  {
    id: 'B_TECH_2',
    x: -35,
    z: -102,
    width: 26,
    depth: 22,
    height: 24,
    name: 'Hardware Accelerators Labs',
    type: 'tech_hub',
    color: 0x334155,
    roofColor: 0x1e293b,
    hasSign: true,
    signText: 'ECU SYSTEMS',
  },
  {
    id: 'B_BANK_1',
    x: 80,
    z: -35,
    width: 22,
    depth: 28,
    height: 38,
    name: 'Eko Merchant Bank Plaza',
    type: 'bank',
    color: 0x0f172a,
    roofColor: 0xd97706,
    hasSign: true,
    signText: 'EKO MERCHANT BANK',
  },
  {
    id: 'B_BANK_2',
    x: 80,
    z: 35,
    width: 22,
    depth: 28,
    height: 30,
    name: 'Continental Financial Centre',
    type: 'bank',
    color: 0x1e293b,
    roofColor: 0x059669,
    hasSign: true,
    signText: 'CONTINENTAL TRUST',
  },
  {
    id: 'B_COMMERCIAL_STORE',
    x: 35,
    z: 22,
    width: 22,
    depth: 18,
    height: 14,
    name: 'Alaba Electronics & Spares',
    type: 'commercial',
    color: 0x475569,
    roofColor: 0xdc2626,
    hasSign: true,
    signText: 'ALABA AUTO SPARES',
  },
  {
    id: 'B_DEPOT_MAIN',
    x: -85,
    z: 75,
    width: 34,
    depth: 28,
    height: 16,
    name: 'Mainland Express Cargo Terminal',
    type: 'depot',
    color: 0x334155,
    roofColor: 0x0284c7,
    hasSign: true,
    signText: 'MAINLAND EXPRESS FREIGHT',
  },
  {
    id: 'B_DEPOT_WAREHOUSE',
    x: -85,
    z: 125,
    width: 32,
    depth: 24,
    height: 12,
    name: 'Customs Transit Warehouse',
    type: 'depot',
    color: 0x475569,
    roofColor: 0x0f172a,
    hasSign: false,
  },
  {
    id: 'B_RESIDENTIAL_1',
    x: -80,
    z: -35,
    width: 24,
    depth: 26,
    height: 22,
    name: 'Adeniran Commercial Suites',
    type: 'commercial',
    color: 0x475569,
    roofColor: 0xca8a04,
    hasSign: true,
    signText: 'ADENIRAN SUITES',
  },
  {
    id: 'B_RESIDENTIAL_2',
    x: -80,
    z: -85,
    width: 24,
    depth: 26,
    height: 20,
    name: 'Mainland Heights Apartments',
    type: 'residential',
    color: 0x64748b,
    roofColor: 0x334155,
    hasSign: false,
  },
  {
    id: 'B_SOUTH_COMMERCIAL',
    x: 55,
    z: 128,
    width: 26,
    depth: 22,
    height: 18,
    name: 'Marina Trade Galleria',
    type: 'commercial',
    color: 0x1e293b,
    roofColor: 0x9333ea,
    hasSign: true,
    signText: 'MARINA TRADE GALLERIA',
  },
];

for (const b of LAGOS_BUILDINGS) {
  b.x *= WORLD_XZ_SCALE;
  b.z *= WORLD_XZ_SCALE;
}

// Helper: picks nearest connected road node respecting lagoon channels & current elevation level
function findNearestNodeId(pos: { x: number; z: number }, currentY = 0): string {
  let bestId = 'N_SHOWROOM';
  let bestScore = Infinity;

  const onMainlandNorth = pos.z <= WORLD_BOUNDS.lagoonNorthZ + 10;
  const onSouthLand = pos.z >= WORLD_BOUNDS.lagoonSouthZ - 10;

  for (const [id, node] of Object.entries(LAGOS_ROAD_NODES)) {
    const nodeY = node.y ?? 0;

    // Prevent snapping straight across Lagos Lagoon unless actually on TMB corridor
    if (!isOnBridgeCorridor(pos.x, pos.z, currentY)) {
      if (onMainlandNorth && node.z > WORLD_BOUNDS.lagoonSouthZ) continue;
      if (onSouthLand && node.z < WORLD_BOUNDS.lagoonNorthZ) continue;

      // Prevent snapping straight across Ikoyi-Lekki channel without using bridge (unless on Coastal Highway landmass)
      if (
        pos.z < WORLD_BOUNDS.coastalLandNorthZ &&
        node.z < WORLD_BOUNDS.coastalLandNorthZ &&
        pos.x <= WORLD_BOUNDS.ikoyiChannelMinX &&
        node.x >= WORLD_BOUNDS.ikoyiChannelMaxX &&
        pos.z >= WORLD_BOUNDS.lagoonSouthZ
      )
        continue;
      if (
        pos.z < WORLD_BOUNDS.coastalLandNorthZ &&
        node.z < WORLD_BOUNDS.coastalLandNorthZ &&
        pos.x >= WORLD_BOUNDS.ikoyiChannelMaxX &&
        node.x <= WORLD_BOUNDS.ikoyiChannelMinX &&
        pos.z >= WORLD_BOUNDS.lagoonSouthZ
      )
        continue;

      // Prevent snapping straight across Epe Creek without using Epe Bridge (unless on Coastal Highway landmass)
      if (
        pos.z < WORLD_BOUNDS.coastalLandNorthZ &&
        node.z < WORLD_BOUNDS.coastalLandNorthZ &&
        pos.x <= WORLD_BOUNDS.epeCreekMinX &&
        node.x >= WORLD_BOUNDS.epeCreekMaxX &&
        pos.z >= WORLD_BOUNDS.lagoonSouthZ
      )
        continue;
      if (
        pos.z < WORLD_BOUNDS.coastalLandNorthZ &&
        node.z < WORLD_BOUNDS.coastalLandNorthZ &&
        pos.x >= WORLD_BOUNDS.epeCreekMaxX &&
        node.x <= WORLD_BOUNDS.epeCreekMinX &&
        pos.z >= WORLD_BOUNDS.lagoonSouthZ
      )
        continue;
    }

    const horizDist = Math.hypot(node.x - pos.x, node.z - pos.z);
    const vertPenalty = Math.abs(nodeY - currentY) * 14;
    const score = horizDist + vertPenalty;

    if (score < bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId;
}

export interface DetailedGPSRoute {
  path: { x: number; z: number; y?: number }[];
  nodeIds: string[];
  totalMeters: number;
  nextTurnText: string;
  nextJunctionName: string;
  distToNextTurnMeters: number;
}

/**
 * Shortest Road Graph Pathfinding (Dijkstra) with 3D level awareness and turn-by-turn guidance.
 */
export function findShortestRoadPathDetailed(
  startPos: { x: number; z: number; y?: number },
  targetPos: { x: number; z: number; y?: number }
): DetailedGPSRoute {
  const startY = startPos.y ?? 0;
  const targetY = targetPos.y ?? 0;
  const startNodeId = findNearestNodeId(startPos, startY);
  const targetNodeId = findNearestNodeId(targetPos, targetY);

  if (startNodeId === targetNodeId) {
    const dist = Math.round(Math.hypot(targetPos.x - startPos.x, targetPos.z - startPos.z) * 1.5);
    const node = LAGOS_ROAD_NODES[startNodeId];
    return {
      path: [
        { x: startPos.x, z: startPos.z, y: startY },
        { x: targetPos.x, z: targetPos.z, y: targetY },
      ],
      nodeIds: [startNodeId],
      totalMeters: dist,
      nextTurnText:
        dist < 35 ? 'Arriving at Destination' : `Continue to ${node?.name || 'Destination'}`,
      nextJunctionName: node?.name || 'Destination',
      distToNextTurnMeters: dist,
    };
  }

  // Dijkstra Algorithm across connected road network
  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const unvisited = new Set<string>();

  for (const id of Object.keys(LAGOS_ROAD_NODES)) {
    distances[id] = Infinity;
    previous[id] = null;
    unvisited.add(id);
  }

  distances[startNodeId] = 0;

  while (unvisited.size > 0) {
    let closestNodeId: string | null = null;
    let closestDist = Infinity;

    for (const id of unvisited) {
      if (distances[id] < closestDist) {
        closestDist = distances[id];
        closestNodeId = id;
      }
    }

    if (!closestNodeId || closestDist === Infinity || closestNodeId === targetNodeId) {
      break;
    }

    unvisited.delete(closestNodeId);
    const currentNode = LAGOS_ROAD_NODES[closestNodeId];

    for (const neighborId of currentNode.neighbors) {
      if (!unvisited.has(neighborId)) continue;
      const neighborNode = LAGOS_ROAD_NODES[neighborId];
      if (!neighborNode) continue;
      const dy = (neighborNode.y ?? 0) - (currentNode.y ?? 0);
      const edgeWeight = Math.hypot(
        neighborNode.x - currentNode.x,
        neighborNode.z - currentNode.z,
        dy
      );
      const altDist = distances[closestNodeId] + edgeWeight;

      if (altDist < distances[neighborId]) {
        distances[neighborId] = altDist;
        previous[neighborId] = closestNodeId;
      }
    }
  }

  const nodeIds: string[] = [];
  const nodePoints: { x: number; z: number; y: number }[] = [];
  let curr: string | null = targetNodeId;
  while (curr) {
    const node = LAGOS_ROAD_NODES[curr];
    nodeIds.unshift(curr);
    nodePoints.unshift({ x: node.x, z: node.z, y: node.y ?? 0 });
    curr = previous[curr];
  }

  // Drop start node if player is already past it heading toward nodeIds[1]
  if (nodePoints.length >= 2) {
    const d0 = Math.hypot(nodePoints[0].x - startPos.x, nodePoints[0].z - startPos.z);
    const d1 = Math.hypot(nodePoints[1].x - startPos.x, nodePoints[1].z - startPos.z);
    const segLen = Math.hypot(
      nodePoints[1].x - nodePoints[0].x,
      nodePoints[1].z - nodePoints[0].z
    );
    if (d0 + d1 <= segLen + 8 && d0 > 12) {
      nodePoints.shift();
      nodeIds.shift();
    }
  }

  const path: { x: number; z: number; y?: number }[] = [
    { x: startPos.x, z: startPos.z, y: startY },
    ...nodePoints,
  ];
  const lastNode = nodePoints[nodePoints.length - 1];
  if (!lastNode || Math.hypot(lastNode.x - targetPos.x, lastNode.z - targetPos.z) > 2) {
    path.push({ x: targetPos.x, z: targetPos.z, y: targetY });
  }

  let rawLen = 0;
  for (let i = 0; i < path.length - 1; i++) {
    rawLen += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
  }
  const totalMeters = Math.round(rawLen * 1.5);

  // Compute next turn instruction
  let nextTurnText = 'Follow GPS Route';
  let nextJunctionName = LAGOS_ROAD_NODES[nodeIds[0]]?.name || 'Next Junction';
  let distToNextTurnMeters =
    path.length >= 2
      ? Math.round(Math.hypot(path[1].x - path[0].x, path[1].z - path[0].z) * 1.5)
      : totalMeters;

  if (nodeIds.length >= 2) {
    const n0 = LAGOS_ROAD_NODES[nodeIds[0]];
    const n1 = LAGOS_ROAD_NODES[nodeIds[1]];
    nextJunctionName = n0.name || n0.id;
    distToNextTurnMeters = Math.round(
      Math.hypot(n0.x - startPos.x, n0.z - startPos.z) * 1.5
    );

    const v1x = n0.x - startPos.x;
    const v1z = n0.z - startPos.z;
    const v2x = n1.x - n0.x;
    const v2z = n1.z - n0.z;
    const mag1 = Math.hypot(v1x, v1z);
    const mag2 = Math.hypot(v2x, v2z);
    if (mag1 > 1 && mag2 > 1) {
      const cross = (v1x * v2z - v1z * v2x) / (mag1 * mag2);
      const dot = (v1x * v2x + v1z * v2z) / (mag1 * mag2);
      if (dot > 0.85) {
        nextTurnText = `Continue straight onto ${n1.roadName || n1.name}`;
      } else if (cross < -0.25) {
        nextTurnText = `Turn LEFT at ${n0.name} toward ${n1.district || n1.name}`;
      } else if (cross > 0.25) {
        nextTurnText = `Turn RIGHT at ${n0.name} toward ${n1.district || n1.name}`;
      } else {
        nextTurnText = `Head toward ${n1.name}`;
      }
    } else {
      nextTurnText = `Head onto ${n1.roadName || n1.name}`;
    }
  } else if (nodeIds.length === 1) {
    const n0 = LAGOS_ROAD_NODES[nodeIds[0]];
    nextTurnText = totalMeters < 35 ? 'Arriving at Destination' : `Proceed to ${n0.name}`;
  }

  return {
    path,
    nodeIds,
    totalMeters,
    nextTurnText,
    nextJunctionName,
    distToNextTurnMeters,
  };
}

export function findShortestRoadPath(
  startPos: { x: number; z: number; y?: number },
  targetPos: { x: number; z: number; y?: number }
): { x: number; z: number; y?: number }[] {
  return findShortestRoadPathDetailed(startPos, targetPos).path;
}
