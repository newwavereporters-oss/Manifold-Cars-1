// MANIFOLD WORLD - LAGOS MAINLAND CITY GRAPH & DISTRICT DATA
// Inspired by the vibrant commercial and tech corridors of Lagos Mainland (Yaba, Commercial Ave, Surulere)

export interface RoadNode {
  id: string;
  x: number;
  z: number;
  name?: string;
  neighbors: string[]; // Connected node IDs
  speedLimit?: number; // km/h
}

export interface CityLandmark {
  id: string;
  name: string;
  subTitle: string;
  district: 'YABA_TECH' | 'COMMERCIAL_ROW' | 'SURULERE_EXPRESS' | 'SHOWROOM_HUB' | 'LOGISTICS_DEPOT' | 'MARKETPLACE';
  x: number;
  z: number;
  radius: number;
  description: string;
  color: string;
  iconType: 'showroom' | 'delivery' | 'race' | 'bank' | 'tech' | 'portal';
}

export interface BuildingBox {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  name: string;
  type: 'commercial' | 'tech_hub' | 'bank' | 'residential' | 'depot' | 'showroom';
  color: number;
  roofColor: number;
  hasSign?: boolean;
  signText?: string;
}

// 1. Core Road Network Nodes for Lagos Mainland District
export const LAGOS_ROAD_NODES: Record<string, RoadNode> = {
  // Showroom Hub & Proving Plaza
  'N_SHOWROOM': { id: 'N_SHOWROOM', x: 0, z: -35, name: 'Showroom Esplanade', neighbors: ['N_CENTRAL_JCT', 'N_NORTH_GATE'], speedLimit: 50 },
  'N_CENTRAL_JCT': { id: 'N_CENTRAL_JCT', x: 0, z: 0, name: 'Sabo Central Roundabout', neighbors: ['N_SHOWROOM', 'N_EAST_AVE_1', 'N_SOUTH_AVE_1', 'N_WEST_AVE_1'], speedLimit: 45 },
  
  // North Corridor (Herbert Macaulay Way / Yaba Tech)
  'N_NORTH_GATE': { id: 'N_NORTH_GATE', x: 0, z: -80, name: 'Herbert Macaulay North', neighbors: ['N_SHOWROOM', 'N_YABA_TECH_JCT'], speedLimit: 60 },
  'N_YABA_TECH_JCT': { id: 'N_YABA_TECH_JCT', x: 0, z: -130, name: 'Yaba Innovation Junction', neighbors: ['N_NORTH_GATE', 'N_RACE_START', 'N_EAST_RING_N'], speedLimit: 50 },
  'N_RACE_START': { id: 'N_RACE_START', x: -50, z: -130, name: 'Surulere Grid Start', neighbors: ['N_YABA_TECH_JCT', 'N_WEST_CORNER_N'], speedLimit: 80 },
  'N_WEST_CORNER_N': { id: 'N_WEST_CORNER_N', x: -110, z: -130, name: 'Expressway Turn 1', neighbors: ['N_RACE_START', 'N_SURULERE_EXPRESS_N'], speedLimit: 75 },

  // East Corridor (Commercial Avenue / Banking Row)
  'N_EAST_AVE_1': { id: 'N_EAST_AVE_1', x: 50, z: 0, name: 'Commercial Ave West', neighbors: ['N_CENTRAL_JCT', 'N_EAST_AVE_2', 'N_TECH_PLAZA_S'], speedLimit: 50 },
  'N_EAST_AVE_2': { id: 'N_EAST_AVE_2', x: 105, z: 0, name: 'Bank Row Junction', neighbors: ['N_EAST_AVE_1', 'N_EAST_RING_N', 'N_EAST_RING_S'], speedLimit: 50 },
  'N_EAST_RING_N': { id: 'N_EAST_RING_N', x: 105, z: -130, name: 'Tech Boulevard East', neighbors: ['N_YABA_TECH_JCT', 'N_EAST_AVE_2'], speedLimit: 65 },
  'N_TECH_PLAZA_S': { id: 'N_TECH_PLAZA_S', x: 50, z: -65, name: 'Alaba Tech Corridor', neighbors: ['N_EAST_AVE_1', 'N_NORTH_GATE'], speedLimit: 40 },

  // South Corridor (Broad Street / Grand Marketplace Boulevard)
  'N_SOUTH_AVE_1': { id: 'N_SOUTH_AVE_1', x: 0, z: 45, name: 'Marketplace Boulevard North', neighbors: ['N_CENTRAL_JCT', 'N_SOUTH_GATE'], speedLimit: 50 },
  'N_SOUTH_GATE': { id: 'N_SOUTH_GATE', x: 0, z: 100, name: 'Grand Marketplace Gateway', neighbors: ['N_SOUTH_AVE_1', 'N_DEPOT_JCT', 'N_EAST_RING_S'], speedLimit: 45 },
  'N_EAST_RING_S': { id: 'N_EAST_RING_S', x: 105, z: 100, name: 'Commercial Sector East', neighbors: ['N_EAST_AVE_2', 'N_SOUTH_GATE'], speedLimit: 55 },

  // West Corridor (Surulere Express & Mainland Logistics Depot)
  'N_WEST_AVE_1': { id: 'N_WEST_AVE_1', x: -55, z: 0, name: 'Surulere Link West', neighbors: ['N_CENTRAL_JCT', 'N_DEPOT_APPROACH', 'N_SURULERE_MID'], speedLimit: 55 },
  'N_SURULERE_MID': { id: 'N_SURULERE_MID', x: -110, z: 0, name: 'Surulere Bypass Junction', neighbors: ['N_WEST_AVE_1', 'N_SURULERE_EXPRESS_N', 'N_DEPOT_WEST'], speedLimit: 70 },
  'N_SURULERE_EXPRESS_N': { id: 'N_SURULERE_EXPRESS_N', x: -110, z: -65, name: 'Surulere Straightaway', neighbors: ['N_WEST_CORNER_N', 'N_SURULERE_MID'], speedLimit: 85 },
  
  // Logistics Depot Access
  'N_DEPOT_APPROACH': { id: 'N_DEPOT_APPROACH', x: -55, z: 65, name: 'Logistics Way North', neighbors: ['N_WEST_AVE_1', 'N_DEPOT_JCT'], speedLimit: 45 },
  'N_DEPOT_JCT': { id: 'N_DEPOT_JCT', x: -55, z: 100, name: 'Mainland Cargo Depot Entry', neighbors: ['N_DEPOT_APPROACH', 'N_SOUTH_GATE', 'N_DEPOT_WEST'], speedLimit: 40 },
  'N_DEPOT_WEST': { id: 'N_DEPOT_WEST', x: -110, z: 100, name: 'Depot Warehouse Loop', neighbors: ['N_SURULERE_MID', 'N_DEPOT_JCT'], speedLimit: 45 },
};

// 2. City Districts & Meaningful Interactive Landmarks
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
    description: 'Tech cluster building high-performance automotive ECUs and digital telematics.',
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
    description: 'Busy shipping distribution center receiving urgent freight across Lagos Mainland.',
    color: '#10B981',
    iconType: 'delivery',
  },
  {
    id: 'RACEWAY_GRID',
    name: 'Surulere Street Circuit Starting Grid',
    subTitle: 'Underground Mainland Grand Prix',
    district: 'SURULERE_EXPRESS',
    x: -50,
    z: -130,
    radius: 14,
    description: 'High-speed street racing starting grid. Compete against top rival drivers.',
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
];

// 3. Street Race Circuit Checkpoints (For Mission B: City Rival Challenge)
export interface RaceCheckpoint {
  id: number;
  x: number;
  z: number;
  name: string;
  radius: number;
}

export const RIVAL_RACE_CHECKPOINTS: RaceCheckpoint[] = [
  { id: 1, x: -50, z: -130, name: 'Starting Grid / Sector 1', radius: 10 },
  { id: 2, x: 0, z: -130, name: 'Yaba Tech Apex Turn', radius: 11 },
  { id: 3, x: 105, z: -130, name: 'Tech Blvd Sweeper', radius: 12 },
  { id: 4, x: 105, z: 0, name: 'Bank Row Chicane', radius: 11 },
  { id: 5, x: 105, z: 100, name: 'Commercial Sector South', radius: 11 },
  { id: 6, x: 0, z: 100, name: 'Marketplace Boulevard', radius: 11 },
  { id: 7, x: -55, z: 100, name: 'Depot S-Bend', radius: 11 },
  { id: 8, x: -110, z: 0, name: 'Surulere Express Straightaway', radius: 12 },
  { id: 9, x: -110, z: -130, name: 'Expressway Final Hairpin', radius: 12 },
  { id: 10, x: -50, z: -130, name: 'Finish Line Gantry', radius: 10 },
];

// 4. Urban Buildings & Collision Footprints for Lagos Mainland
export const LAGOS_BUILDINGS: BuildingBox[] = [
  // Yaba Tech Cluster (North)
  {
    id: 'B_TECH_1',
    x: 35,
    z: -105,
    width: 28,
    depth: 26,
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
    z: -105,
    width: 26,
    depth: 24,
    height: 24,
    name: 'Hardware Accelerators Labs',
    type: 'tech_hub',
    color: 0x334155,
    roofColor: 0x1e293b,
    hasSign: true,
    signText: 'ECU SYSTEMS',
  },

  // Bank Row & Commercial Avenue (East)
  {
    id: 'B_BANK_1',
    x: 80,
    z: -35,
    width: 24,
    depth: 30,
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
    width: 24,
    depth: 32,
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

  // Logistics & Freight District (South-West)
  {
    id: 'B_DEPOT_MAIN',
    x: -85,
    z: 75,
    width: 38,
    depth: 32,
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
    width: 34,
    depth: 26,
    height: 12,
    name: 'Customs Transit Warehouse',
    type: 'depot',
    color: 0x475569,
    roofColor: 0x0f172a,
    hasSign: false,
  },

  // Surulere Corridor Residential & Commercial Blocks (West)
  {
    id: 'B_RESIDENTIAL_1',
    x: -80,
    z: -35,
    width: 26,
    depth: 28,
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
    depth: 30,
    height: 20,
    name: 'Mainland Heights Apartments',
    type: 'residential',
    color: 0x64748b,
    roofColor: 0x334155,
    hasSign: false,
  },

  // Southern Gateway Commercial Plaza (South-East)
  {
    id: 'B_SOUTH_COMMERCIAL',
    x: 55,
    z: 100,
    width: 28,
    depth: 24,
    height: 18,
    name: 'Marina Trade Galleria',
    type: 'commercial',
    color: 0x1e293b,
    roofColor: 0x9333ea,
    hasSign: true,
    signText: 'MARINA TRADE GALLERIA',
  },
];

// 5. Shortest Road Graph Pathfinding (Dijkstra) for In-Game GPS Navigation
export function findShortestRoadPath(startPos: { x: number; z: number }, targetPos: { x: number; z: number }): { x: number; z: number }[] {
  // Find nearest start node
  let startNodeId = 'N_SHOWROOM';
  let minStartDist = Infinity;
  for (const [id, node] of Object.entries(LAGOS_ROAD_NODES)) {
    const d = Math.hypot(node.x - startPos.x, node.z - startPos.z);
    if (d < minStartDist) {
      minStartDist = d;
      startNodeId = id;
    }
  }

  // Find nearest target node
  let targetNodeId = 'N_CENTRAL_JCT';
  let minTargetDist = Infinity;
  for (const [id, node] of Object.entries(LAGOS_ROAD_NODES)) {
    const d = Math.hypot(node.x - targetPos.x, node.z - targetPos.z);
    if (d < minTargetDist) {
      minTargetDist = d;
      targetNodeId = id;
    }
  }

  if (startNodeId === targetNodeId) {
    return [{ x: startPos.x, z: startPos.z }, { x: targetPos.x, z: targetPos.z }];
  }

  // Dijkstra Algorithm
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
      const edgeWeight = Math.hypot(neighborNode.x - currentNode.x, neighborNode.z - currentNode.z);
      const altDist = distances[closestNodeId] + edgeWeight;

      if (altDist < distances[neighborId]) {
        distances[neighborId] = altDist;
        previous[neighborId] = closestNodeId;
      }
    }
  }

  // Reconstruct path
  const path: { x: number; z: number }[] = [];
  let curr: string | null = targetNodeId;
  while (curr) {
    const node = LAGOS_ROAD_NODES[curr];
    path.unshift({ x: node.x, z: node.z });
    curr = previous[curr];
  }

  // Prepend current player location and append exact target
  return [{ x: startPos.x, z: startPos.z }, ...path, { x: targetPos.x, z: targetPos.z }];
}
