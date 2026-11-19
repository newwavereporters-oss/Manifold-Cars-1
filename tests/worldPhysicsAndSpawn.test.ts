import assert from 'node:assert/strict';
import { CollisionEngine } from '../src/components/world/collisionEngine';
import {
  enforceBridgeAndWaterBarriers,
  getEdgeDistToElevatedRamps,
  WORLD_XZ_SCALE,
  BarricadeCollider,
  BuildingBox,
} from '../src/components/world/lagosCityData';
import {
  findFreeSharedSpawnPose,
  isSpawnPoseClear,
  toColliderBoxes,
} from '../src/components/world/spawnUtils';

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

runTest('Substepped OBB collision prevents tunneling through thin guardrails and houses', () => {
  const engine = new CollisionEngine();
  const thinWall: BarricadeCollider = {
    id: 'THIN_WALL_TEST',
    x: 0,
    y: 0,
    z: -20,
    halfW: 30,
    halfD: 0.35,
    angle: 0,
    kind: 'GUARDRAIL',
  };
  const iyanobaHouse: BarricadeCollider = {
    id: 'IYANOBA_HOUSE_0',
    x: 20,
    y: 0,
    z: -20,
    halfW: 4.85,
    halfD: 4.2,
    angle: 0,
    kind: 'WALL',
  };
  const building: BuildingBox = {
    id: 'TEST_BLDG',
    x: -20,
    z: -20,
    width: 12,
    depth: 12,
    height: 18,
    name: 'Test Tower',
    type: 'commercial',
    color: 0xffffff,
    roofColor: 0x111111,
  };

  // Simulate car barreling toward z = -20 at 60 units/sec (pi heading -> moving toward -z)
  const cs = { x: 0, y: 0, z: -16.5, speed: 60, rotation: Math.PI };
  const vx = Math.sin(cs.rotation) * cs.speed * 0.08;
  const vz = Math.cos(cs.rotation) * cs.speed * 0.08; // -4.8 units in one frame
  const substeps = Math.max(1, Math.min(8, Math.ceil(Math.hypot(vx, vz) / 0.65)));

  for (let s = 0; s < substeps; s++) {
    cs.x += vx / substeps;
    cs.z += vz / substeps;
    for (let iter = 0; iter < 2; iter++) {
      engine.resolveWorldCollisions(
        cs,
        1.0,
        2.3,
        [building],
        [],
        [],
        [thinWall, iyanobaHouse],
        []
      );
    }
  }

  // Must remain strictly on approach side (z > -20 + 0.35) and never tunnel past z = -20
  assert.ok(cs.z > -19.5, `Car tunneled across thin wall: z=${cs.z}`);
  assert.ok(cs.speed <= 0, `Head-on impact should rebound/stop forward motion: speed=${cs.speed}`);

  // Verify Iyanoba house solidity as well (house south face is at -20 + 4.2 = -15.8; car nose at -14.2 - 2.3 = -16.5)
  const csHouse = { x: 20, y: 0, z: -14.2, speed: 30, rotation: Math.PI };
  const hRes = engine.resolveWorldCollisions(
    csHouse,
    1.0,
    2.3,
    [],
    [],
    [],
    [iyanobaHouse],
    []
  );
  assert.equal(hRes.primaryHit?.type, 'BARRICADE');
  assert.ok(csHouse.z >= -13.6, `Car clipped into Iyanoba house: z=${csHouse.z}`);
});

runTest('Online PLAYER vehicles collide solidly and never pass through one another', () => {
  const engine = new CollisionEngine();
  const remotePeers = toColliderBoxes([
    {
      id: 'peer_1',
      x: 0,
      y: 0,
      z: 10,
      width: 2.0,
      length: 4.5,
      rotation: Math.PI,
      speed: 0,
    },
  ]);

  const cs = { x: 0, y: 0, z: 13.2, speed: 25, rotation: Math.PI };
  const result = engine.resolveWorldCollisions(
    cs,
    1.0,
    2.25,
    [],
    [],
    [],
    [],
    [],
    remotePeers
  );

  assert.equal(result.vehicleHits.length, 1);
  assert.equal(result.vehicleHits[0].otherKind, 'PLAYER');
  assert.equal(result.vehicleHits[0].otherId, 'peer_1');
  assert.ok(cs.z > 13.2, `Player car was not pushed back along Z from peer car: z=${cs.z}`);
  assert.ok((result.vehicleHits[0].otherPushZ ?? 0) < 0, 'Peer should receive opposite Z push');
});

runTest('Bridge center concrete Jersey divider and outer parapets are solid while Ajah underpass is clear', () => {
  // On TMB elevated main span (y=6.0, z=-350*S), crossing center x=0.1 must push outward
  const csMedian = { x: 0.15, z: -350 * WORLD_XZ_SCALE, speed: 30 };
  const hitMedian = enforceBridgeAndWaterBarriers(csMedian, 6.0, 1.0);
  assert.ok(hitMedian?.hit, 'Center Jersey barrier should trigger solid collision');
  assert.ok(
    Math.abs(csMedian.x) >= 0.85,
    `Car should be pushed outside 0.76m median divider, got x=${csMedian.x}`
  );

  // Outer TMB parapet check
  const csParapet = { x: 13.5, z: -350 * WORLD_XZ_SCALE, speed: 30 };
  const hitParapet = enforceBridgeAndWaterBarriers(csParapet, 6.0, 1.0);
  assert.ok(hitParapet?.hit, 'Outer bridge parapet should clamp vehicle');
  assert.ok(csParapet.x < 12.8, `Car escaped outer parapet: x=${csParapet.x}`);

  // Elevated ramp clearance helper catches Adekunle Ramp touchdown (y=0 at 160*S, -130*S)
  const onRampEdge = getEdgeDistToElevatedRamps(155 * WORLD_XZ_SCALE, -132 * WORLD_XZ_SCALE, 4.2);
  assert.ok(onRampEdge < 0, `Expected negative edge dist on Adekunle ramp touchdown, got ${onRampEdge}`);

  // Ground underpass underneath Ajah Flyover center (1135*S, 100*S, deck at y=6.2) stays unobstructed
  const ajahUnderpass = getEdgeDistToElevatedRamps(1135 * WORLD_XZ_SCALE, 100 * WORLD_XZ_SCALE, 4.2);
  assert.ok(ajahUnderpass > 0, `Ajah ground underpass should stay clear, got ${ajahUnderpass}`);
});

runTest('Shared Showroom Boulevard spawn assigns distinct non-overlapping slots to consecutive players', () => {
  const placed: Array<{ x: number; y: number; z: number; rotation: number; width: number; length: number }> = [];

  for (let i = 0; i < 10; i++) {
    const pose = findFreeSharedSpawnPose({
      baseX: 0,
      baseZ: 10 * WORLD_XZ_SCALE,
      rotation: Math.PI,
      carHalfWidth: 1.0,
      carHalfLength: 2.3,
      occupiedVehicles: placed,
    });

    // All slots remain within Showroom Boulevard starting district zone
    assert.ok(Math.abs(pose.x) <= 7.0, `Spawn slot x=${pose.x} drifted off boulevard`);
    assert.ok(
      Math.abs(pose.z - 10 * WORLD_XZ_SCALE) <= 35,
      `Spawn slot z=${pose.z} left shared start zone`
    );

    // Must not overlap any already-spawned car
    const clear = isSpawnPoseClear(pose.x, pose.z, pose.rotation, {
      y: pose.y,
      carHalfWidth: 1.0,
      carHalfLength: 2.3,
      occupiedVehicles: placed,
      lateralMargin: 0.4,
      longitudinalMargin: 0.8,
    });
    assert.ok(clear, `Spawned player ${i} overlapped an existing car`);

    placed.push({
      x: pose.x,
      y: pose.y,
      z: pose.z,
      rotation: pose.rotation,
      width: 2.0,
      length: 4.6,
    });
  }
});

console.log(`ALL ${passed} WORLD PHYSICS & SPAWN TESTS PASSED`);
