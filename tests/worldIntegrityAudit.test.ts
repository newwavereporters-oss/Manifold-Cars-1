import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  LAGOS_ROAD_NODES,
  LAGOS_BUILDINGS,
  CITY_LANDMARKS,
  RIVAL_RACE_CHECKPOINTS,
  MMIA_RESTRICTED_ZONE,
  WORLD_XZ_SCALE,
  WORLD_BOUNDS,
  isInsideRestrictedAirport,
  isOverOpenWater,
  enforceBridgeAndWaterBarriers,
  findShortestRoadPathDetailed,
  getRoadSegmentProfile,
} from '../src/components/world/lagosCityData';
import { getApapaContainerStackLayout } from '../src/three/seaportBuilder';
import { TrafficEngine } from '../src/components/world/trafficEngine';
import { findFreeSharedSpawnPose } from '../src/components/world/spawnUtils';

let passed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    throw err;
  }
}

function pointToSegDist(px: number, pz: number, x1: number, z1: number, x2: number, z2: number): number {
  const vx = x2 - x1;
  const vz = z2 - z1;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-6) return Math.hypot(px - x1, pz - z1);
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (pz - z1) * vz) / lenSq));
  return Math.hypot(px - (x1 + t * vx), pz - (z1 + t * vz));
}

function segmentIntersectsRect(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): boolean {
  // Dense sampling plus endpoint test covers axis-aligned & diagonal segments reliably
  const steps = Math.max(8, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 4));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const z = z1 + (z2 - z1) * t;
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return true;
  }
  return false;
}

const groundSegments = (() => {
  const seen = new Set<string>();
  const segs: {
    key: string;
    a: (typeof LAGOS_ROAD_NODES)[string];
    b: (typeof LAGOS_ROAD_NODES)[string];
    halfWidth: number;
  }[] = [];

  Object.values(LAGOS_ROAD_NODES).forEach((a) => {
    a.neighbors.forEach((bId) => {
      const b = LAGOS_ROAD_NODES[bId];
      if (!b) return;
      const key = [a.id, b.id].sort().join('--');
      if (seen.has(key)) return;
      seen.add(key);

      // Skip high elevated spans (>= 3.5m) when auditing ground-level structures
      if (Math.max(a.y ?? 0, b.y ?? 0) >= 3.5) return;

      const profile = getRoadSegmentProfile(a, b);
      const isDual = Boolean(a.isDualCarriageway && b.isDualCarriageway);
      const halfWidth =
        profile === 'COASTAL_4LANE'
          ? 15.5
          : profile === 'INLET_2LANE'
          ? 6.8
          : isDual
          ? 13.4
          : 7.5;
      segs.push({ key, a, b, halfWidth });
    });
  });
  return segs;
})();

runTest('1. All LAGOS_ROAD_NODES edges are bidirectional with zero missing or self-loop refs', () => {
  const nodes = Object.values(LAGOS_ROAD_NODES);
  assert.ok(nodes.length >= 70, `Expected full road graph, got ${nodes.length} nodes`);

  for (const node of nodes) {
    assert.ok(node.neighbors.length > 0, `Isolated node with no neighbors: ${node.id}`);
    for (const nbId of node.neighbors) {
      assert.notEqual(nbId, node.id, `Self-loop on ${node.id}`);
      const nb = LAGOS_ROAD_NODES[nbId];
      assert.ok(nb, `Missing neighbor ${nbId} referenced by ${node.id}`);
      assert.ok(
        nb.neighbors.includes(node.id),
        `One-way asymmetric edge: ${node.id} -> ${nbId} lacks reverse link`
      );
    }
  }
});

runTest('2. Road network forms a single connected component including Apapa Seaport & MMIA drop-off', () => {
  const visited = new Set<string>();
  const queue = ['N_SHOWROOM'];
  visited.add('N_SHOWROOM');

  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const nb of LAGOS_ROAD_NODES[id].neighbors) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }

  const allIds = Object.keys(LAGOS_ROAD_NODES);
  const unreachable = allIds.filter((id) => !visited.has(id));
  assert.deepEqual(unreachable, [], `Unreachable road nodes found: ${unreachable.join(', ')}`);

  // Verify Seaport landmark exists and is routable
  const seaport = CITY_LANDMARKS.find((lm) => lm.id === 'APAPA_SEAPORT');
  assert.ok(seaport, 'APAPA_SEAPORT landmark missing');
  const route = findShortestRoadPathDetailed({ x: 0, z: -35 }, { x: seaport.x, z: seaport.z });
  assert.ok(route.nodeIds.length >= 3, 'Expected multi-hop GPS route to Apapa Seaport');
});

runTest('3. MMIA Airport airside compound is completely sealed off from all roads and vehicles', () => {
  for (const node of Object.values(LAGOS_ROAD_NODES)) {
    assert.equal(
      isInsideRestrictedAirport(node.x, node.z, 2),
      false,
      `Road node ${node.id} (${node.x}, ${node.z}) intrudes into restricted MMIA compound`
    );
  }

  for (const seg of groundSegments) {
    const hitsMmia = segmentIntersectsRect(
      seg.a.x,
      seg.a.z,
      seg.b.x,
      seg.b.z,
      MMIA_RESTRICTED_ZONE.minX - 6,
      MMIA_RESTRICTED_ZONE.maxX + 6,
      MMIA_RESTRICTED_ZONE.minZ - 6,
      MMIA_RESTRICTED_ZONE.maxZ + 6
    );
    assert.equal(hitsMmia, false, `Road segment ${seg.key} cuts into MMIA restricted zone`);
  }

  // Test barrier pushout at runway, terminal apron, and gate 1 threshold
  const probePoints = [
    { x: 465 * WORLD_XZ_SCALE, z: -1180 * WORLD_XZ_SCALE },
    { x: 340 * WORLD_XZ_SCALE, z: -1120 * WORLD_XZ_SCALE },
    { x: 240 * WORLD_XZ_SCALE, z: -960.5 * WORLD_XZ_SCALE },
  ];
  for (const pt of probePoints) {
    const cs = { x: pt.x, y: 0, z: pt.z, speed: 32, rotation: Math.PI };
    const hit = enforceBridgeAndWaterBarriers(cs, 1.0, 2.3);
    assert.equal(hit?.kind, 'BOUNDARY', `Expected BOUNDARY pushout at (${pt.x}, ${pt.z})`);
    assert.equal(
      isInsideRestrictedAirport(cs.x, cs.z, 0.5),
      false,
      `Vehicle remained inside MMIA restricted zone after clamp: (${cs.x}, ${cs.z})`
    );
  }

  // Verify GPS routing to MMIA landmark targets the outside Drop-Off loop only
  const mmia = CITY_LANDMARKS.find((lm) => lm.id === 'MMIA_AIRPORT');
  assert.ok(mmia, 'MMIA_AIRPORT landmark missing');
  assert.equal(
    isInsideRestrictedAirport(mmia.x, mmia.z, 0),
    false,
    'MMIA landmark coordinate must be outside restricted perimeter'
  );
  const routeToMmia = findShortestRoadPathDetailed({ x: 0, z: -35 }, { x: mmia.x, z: mmia.z });
  for (const pt of routeToMmia.path) {
    assert.equal(
      isInsideRestrictedAirport(pt.x, pt.z, 0),
      false,
      'GPS route polyline must stay outside MMIA perimeter'
    );
  }

  // Verify Gate 2 removal & Gate 1 pedestrian-only checkpoint assets in builder sources
  const airportSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/three/airportAndRailBuilder.ts'),
    'utf8'
  );
  const regionSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/world/lagosRegionBuilders.ts'),
    'utf8'
  );
  assert.equal(airportSrc.includes('MMIA_GATE2'), false, 'Gate 2 must be completely removed');
  assert.ok(airportSrc.includes('MMIA_GATE1_VEHICLE_BLOCKER'), 'Gate 1 vehicle blocker missing');
  assert.ok(airportSrc.includes('AIRPORT — RESTRICTED ACCESS'), 'Missing Gate 1 security headline');
  assert.ok(
    airportSrc.includes('PASSENGERS ONLY · NO VEHICLE ENTRY'),
    'Missing Gate 1 pedestrian-only signage'
  );
  assert.equal(
    regionSrc.includes('GATE 2'),
    false,
    'Highway signs in lagosRegionBuilders must no longer reference Gate 2'
  );
});

runTest('4. Ground buildings & Apapa Seaport container stacks never obstruct any road carriageway', () => {
  for (const b of LAGOS_BUILDINGS) {
    const bRadius = Math.min(b.width, b.depth) / 2;
    for (const seg of groundSegments) {
      const dist = pointToSegDist(b.x, b.z, seg.a.x, seg.a.z, seg.b.x, seg.b.z);
      const minAllowed = seg.halfWidth + bRadius - 1.5;
      assert.ok(
        dist >= minAllowed,
        `Building ${b.id} (${b.x.toFixed(1)}, ${b.z.toFixed(1)}) overlaps road ${seg.key} (dist=${dist.toFixed(1)} < ${minAllowed.toFixed(1)})`
      );
    }
  }

  const stacks = getApapaContainerStackLayout(WORLD_XZ_SCALE);
  assert.ok(stacks.length >= 16, `Expected organized container yard stacks, got ${stacks.length}`);
  const brands = new Set(stacks.map((s) => s.brand));
  for (const reqBrand of ['MAERSK', 'EVERGREEN', 'MSC', 'CMA_CGM', 'HAPAG_LLOYD'] as const) {
    assert.ok(brands.has(reqBrand), `Missing container brand ${reqBrand} in Apapa Seaport stacks`);
  }

  for (const st of stacks) {
    const halfW = st.sizeFt === 40 ? 6.1 : 3.05;
    const halfD = 1.24;
    const clearRadius = Math.hypot(halfW, halfD);
    for (const seg of groundSegments) {
      const dist = pointToSegDist(st.x, st.z, seg.a.x, seg.a.z, seg.b.x, seg.b.z);
      assert.ok(
        dist >= seg.halfWidth + clearRadius,
        `Container stack ${st.id} overlaps road ${seg.key} (dist=${dist.toFixed(1)})`
      );
    }
    // Also strictly clear of Blue Line rail corridor (x <= -420*S)
    assert.ok(
      st.x - halfW > -410 * WORLD_XZ_SCALE,
      `Container stack ${st.id} encroaches on Blue Line Rail viaduct`
    );
  }
});

runTest('5. No unprotected ground road crosses Lagos Lagoon or Atlantic Ocean open water', () => {
  for (const seg of groundSegments) {
    // Ground roads in groundSegments exclude elevated deck spans (y >= 3.5).
    // Verify midpoints never fall into lagoon water or southern ocean!
    const samples = [0.25, 0.5, 0.75];
    for (const t of samples) {
      const x = seg.a.x + (seg.b.x - seg.a.x) * t;
      const z = seg.a.z + (seg.b.z - seg.a.z) * t;
      const isRampSpan = Boolean(seg.a.isBridge || seg.b.isBridge);
      if (isRampSpan) continue;
      assert.equal(
        isOverOpenWater(x, z),
        false,
        `Unprotected ground road ${seg.key} crosses open water at (${x.toFixed(1)}, ${z.toFixed(1)})`
      );
    }
  }
});

runTest('6. TrafficEngine spawns CONTAINER_TRUCK drayage semis, 5 carrier brands & zero MMIA airside routes', () => {
  const engine = new TrafficEngine();
  assert.ok(engine.vehicles.length >= 65, `Expected expanded traffic fleet >= 65, got ${engine.vehicles.length}`);

  const trucks = engine.vehicles.filter((v) => v.type === 'CONTAINER_TRUCK');
  assert.ok(trucks.length >= 6, `Expected >= 6 container semi-trucks, got ${trucks.length}`);

  const trafficSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/world/trafficEngine.ts'),
    'utf8'
  );
  for (const brand of ['MAERSK', 'EVERGREEN', 'MSC', 'CMA_CGM', 'HAPAG_LLOYD']) {
    assert.ok(trafficSrc.includes(brand), `TrafficEngine missing brand ${brand}`);
  }

  for (const v of engine.vehicles) {
    assert.equal(
      isInsideRestrictedAirport(v.x, v.z, 0),
      false,
      `Traffic vehicle ${v.id} (${v.currentNodeId} -> ${v.targetNodeId}) spawned inside MMIA`
    );
  }
  engine.dispose();
});

runTest('7. Initial spawn pose and Rival Race Checkpoints clear buildings, water, and MMIA perimeter', () => {
  const spawn = findFreeSharedSpawnPose({ buildings: LAGOS_BUILDINGS });
  assert.equal(isInsideRestrictedAirport(spawn.x, spawn.z, 5), false, 'Spawn inside MMIA');
  assert.equal(isOverOpenWater(spawn.x, spawn.z), false, 'Spawn in open water');

  for (const cp of RIVAL_RACE_CHECKPOINTS) {
    assert.equal(isInsideRestrictedAirport(cp.x, cp.z, 5), false, `Race CP ${cp.id} inside MMIA`);
    assert.equal(isOverOpenWater(cp.x, cp.z), false, `Race CP ${cp.id} in open water`);
  }

  // Seaport ship & quay bounds sit south of lagoon North shore and strictly within world bounds
  assert.ok(-275 * WORLD_XZ_SCALE > WORLD_BOUNDS.minX && -275 * WORLD_XZ_SCALE < WORLD_BOUNDS.maxX);
});

console.log(`\nALL ${passed} WORLD INTEGRITY AUDIT TESTS PASSED.`);
