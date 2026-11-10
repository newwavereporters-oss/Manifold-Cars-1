// MANIFOLD WORLD - LAGOS MAINLAND 3D ENVIRONMENT BUILDER
// Procedural architectural generation for Yaba Tech, Commercial Avenue, Surulere Express & Logistics Depot

import * as THREE from 'three';
import {
  LAGOS_ROAD_NODES,
  LAGOS_BUILDINGS,
  CITY_LANDMARKS,
  RIVAL_RACE_CHECKPOINTS,
  BuildingBox,
} from './lagosCityData';

export interface LagosCityResult {
  cityGroup: THREE.Group;
  collidableBuildings: BuildingBox[];
  checkpointMeshes: { id: number; mesh: THREE.Group; active: boolean }[];
  landmarkMarkers: { id: string; group: THREE.Group }[];
  gpsRouteLine: THREE.Line;
  updateGPSRoute: (path: { x: number; z: number }[]) => void;
}

export function buildLagosCityDistrict(
  options: { includeGround?: boolean } = {}
): LagosCityResult {
  const cityGroup = new THREE.Group();

 // 1. TERRAIN & GROUND PLANE
// The existing world already supplies terrain, so the city ground is optional.
if (options.includeGround !== false) {
  const groundGeo = new THREE.PlaneGeometry(600, 600, 16, 16);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.85,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  cityGroup.add(ground);
}


  // EPE CORRIDOR: lightweight tropical roadside greenery.
  // Keep vegetation outside the expressway and away from the bridge.
  const epeGreenery = new THREE.Group();

  const palmTrunkMat = new THREE.MeshStandardMaterial({
    color: 0x806044,
    roughness: 0.95,
  });

  const palmLeafMat = new THREE.MeshStandardMaterial({
    color: 0x287447,
    roughness: 0.9,
  });

  const grassMats = [
    new THREE.MeshStandardMaterial({ color: 0x477a39, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x668b42, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x355f32, roughness: 1 }),
  ];

  // Seeded positions make the scenery stable between builds.
  for (let i = 0; i < 38; i++) {
    const z = -145 - i * 27;

    // Alternate sides of the road. Keep clear of the road surface.
    const side = i % 2 === 0 ? -1 : 1;
    const x = 180 + side * (11 + (i % 3) * 2);

    const trunkHeight = 4.5 + (i % 4) * 0.55;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.28, trunkHeight, 5),
      palmTrunkMat
    );
    trunk.position.set(x, trunkHeight / 2, z);
    trunk.castShadow = false;
    trunk.receiveShadow = false;
    epeGreenery.add(trunk);

    // Five simple tapered leaves per palm, with low polygon counts.
    for (let leaf = 0; leaf < 5; leaf++) {
      const angle = (leaf / 5) * Math.PI * 2;
      const length = 2.3 + (leaf % 2) * 0.35;

      const frond = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, length, 3),
        palmLeafMat
      );

      frond.position.set(
        x + Math.cos(angle) * 1.05,
        trunkHeight + 0.25 - (leaf % 2) * 0.15,
        z + Math.sin(angle) * 1.05
      );

      frond.rotation.z = Math.cos(angle) * 0.75;
      frond.rotation.x = Math.sin(angle) * 0.75;
      frond.rotation.y = angle;
      frond.castShadow = false;
      epeGreenery.add(frond);
    }
  }

  // Small patches of tropical grass along both shoulders.
  for (let i = 0; i < 100; i++) {
    const z = -140 - ((i * 37) % 1040);
    const side = i % 2 === 0 ? -1 : 1;
    const x = 180 + side * (8.5 + ((i * 13) % 45) / 10);

    const patch = new THREE.Mesh(
      new THREE.ConeGeometry(
        0.45 + (i % 3) * 0.12,
        0.35 + (i % 4) * 0.08,
        4
      ),
      grassMats[i % grassMats.length]
    );

    patch.position.set(x, 0.12, z);
    patch.rotation.y = (i % 6) * 0.7;
    patch.castShadow = false;
    patch.receiveShadow = false;
    epeGreenery.add(patch);
  }

  cityGroup.add(epeGreenery);


  // EPE CORRIDOR: lightweight double-arm expressway streetlights.
  const epeStreetlights = new THREE.Group();

  const lightPoleMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.65,
    metalness: 0.45,
  });

  const lightHeadMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });

  for (let i = 0; i < 27; i++) {
    const z = -155 - i * 38;
    const side = i % 2 === 0 ? -1 : 1;
    const x = 180 + side * 7.5;
    const poleHeight = 6.5;

    // Vertical pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.15, poleHeight, 6),
      lightPoleMat
    );

    pole.position.set(x, poleHeight / 2, z);
    pole.castShadow = false;
    pole.receiveShadow = false;
    epeStreetlights.add(pole);

    // Curved-looking arm, built from a lightweight cylinder
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.07, 1.5, 5),
      lightPoleMat
    );

    arm.rotation.z = -Math.PI / 2;
    arm.position.set(x + side * 0.65, poleHeight - 0.15, z);
    epeStreetlights.add(arm);

    // Lamp head
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.12, 0.28),
      lightHeadMat
    );

    lamp.position.set(x + side * 1.25, poleHeight - 0.18, z);
    epeStreetlights.add(lamp);
  }

  cityGroup.add(epeStreetlights);

  
  // EPE CORRIDOR: lightweight roadside bus shelters and kiosks.
  const epeRoadsideFacilities = new THREE.Group();

  const shelterFrameMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.8,
    metalness: 0.25,
  });

  const shelterRoofMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.85,
  });

  const benchMat = new THREE.MeshStandardMaterial({
    color: 0x9a6b43,
    roughness: 0.9,
  });

  const kioskWallMats = [
    new THREE.MeshStandardMaterial({ color: 0xe8c547, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x3f8f68, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xd97745, roughness: 0.9 }),
  ];

  const kioskRoofMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.85,
    metalness: 0.15,
  });

  // Three shelters distributed along the Epe corridor.
  for (let i = 0; i < 3; i++) {
    const z = -260 - i * 340;
    const x = 180 + (i % 2 === 0 ? -1 : 1) * 13;

    // Four slim support posts.
    for (const dx of [-1.5, 1.5]) {
      for (const dz of [-1.2, 1.2]) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 2.5, 0.12),
          shelterFrameMat
        );
        post.position.set(x + dx, 1.25, z + dz);
        epeRoadsideFacilities.add(post);
      }
    }

    // Roof.
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.18, 3.1),
      shelterRoofMat
    );
    roof.position.set(x, 2.55, z);
    epeRoadsideFacilities.add(roof);

    // Bench.
    const benchSeat = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.12, 0.45),
      benchMat
    );
    benchSeat.position.set(x, 0.65, z + 0.45);
    epeRoadsideFacilities.add(benchSeat);

    const benchLegs = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.55, 0.12),
      shelterFrameMat
    );
    benchLegs.position.set(x, 0.35, z + 0.45);
    epeRoadsideFacilities.add(benchLegs);
  }

  // Four small roadside kiosks with coloured walls and metal roofs.
  for (let i = 0; i < 4; i++) {
    const z = -390 - i * 235;
    const side = i % 2 === 0 ? -1 : 1;
    const x = 180 + side * 19;

    const wallMat = kioskWallMats[i % kioskWallMats.length];

    const kiosk = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 2.4, 2.6),
      wallMat
    );
    kiosk.position.set(x, 1.2, z);
    epeRoadsideFacilities.add(kiosk);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.18, 2.9),
      kioskRoofMat
    );
    roof.position.set(x, 2.49, z);
    epeRoadsideFacilities.add(roof);

    // Front counter.
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.65, 0.22),
      benchMat
    );
    counter.position.set(x, 0.85, z + 1.38);
    epeRoadsideFacilities.add(counter);

    // Simple signboard above the shop front.
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.35, 0.12),
      shelterFrameMat
    );
    sign.position.set(x, 2.05, z + 1.38);
    epeRoadsideFacilities.add(sign);
  }

  cityGroup.add(epeRoadsideFacilities);


  // 2. ROAD NETWORK GEOMETRY
  
const roadMat = new THREE.MeshStandardMaterial({
  color: 0x45474a, // Natural charcoal-grey asphalt
  roughness: 0.96,
  metalness: 0.0,
});

const curbMat = new THREE.MeshStandardMaterial({
  color: 0x85837c, // Weathered concrete
  roughness: 0.92,
  metalness: 0.0,
});


  const yellowLineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const whiteLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // Render road corridors between connected nodes
  const processedEdges = new Set<string>();

  Object.values(LAGOS_ROAD_NODES).forEach((node) => {
    node.neighbors.forEach((neighborId) => {
      const neighbor = LAGOS_ROAD_NODES[neighborId];
      if (!neighbor) return;

      const edgeKey = [node.id, neighbor.id].sort().join('--');
      if (processedEdges.has(edgeKey)) return;
      processedEdges.add(edgeKey);

      const dx = neighbor.x - node.x;
      const dz = neighbor.z - node.z;
      const length = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, dz);
      const midX = (node.x + neighbor.x) / 2;
      const midZ = (node.z + neighbor.z) / 2;
      const roadWidth = 14.0; // 2-lane road with generous shoulders

      // Dedicated divided carriageways for the Lekki-Epe corridor
      
const epeRouteNodes = new Set([
  'N_OUTER_EXPRESS_EAST',
  'N_EPE_CORRIDOR',
  'N_EPE_AJAH',
  'N_EPE_SANGOTEDO',
  'N_EPE_ELEKO',
  'N_EPE_ARRIVAL',
  'N_BRIDGE_ENTRY',
  'N_BRIDGE_EXIT',
  'N_OGUN_GATE',
  'N_OGUN_TURNAROUND',
]);


      const isEpeExpressway =
        epeRouteNodes.has(node.id) &&
        epeRouteNodes.has(neighbor.id);

      if (isEpeExpressway) {
        const carriagewayWidth = 7.5;
        const medianWidth = 1.4;
        const medianMat = new THREE.MeshStandardMaterial({
  color: 0x999991,
  roughness: 0.96,
  metalness: 0.0,
});


        // Perpendicular direction for separating the two roadways
        const sideX = Math.cos(angle);
        const sideZ = -Math.sin(angle);

        // Two separate asphalt carriageways
        for (const direction of [-1, 1]) {
          const offset = direction * (carriagewayWidth / 2 + medianWidth / 2);

          const carriageway = new THREE.Mesh(
            new THREE.PlaneGeometry(carriagewayWidth, length),
            roadMat
          );

          carriageway.rotation.x = -Math.PI / 2;
          carriageway.rotation.z = -angle;
          carriageway.position.set(
            midX + sideX * offset,
            0.025,
            midZ + sideZ * offset
          );
          carriageway.receiveShadow = true;
          cityGroup.add(carriageway);

          // Outer shoulder line
          const edgeLine = new THREE.Mesh(
            new THREE.PlaneGeometry(0.2, length),
            whiteLineMat
          );
          edgeLine.rotation.x = -Math.PI / 2;
          edgeLine.rotation.z = -angle;
          edgeLine.position.set(
            midX + sideX * (offset + direction * carriagewayWidth / 2 - direction * 0.4),
            0.04,
            midZ + sideZ * (offset + direction * carriagewayWidth / 2 - direction * 0.4)
          );
          cityGroup.add(edgeLine);

          // Dashed lane divider within each carriageway
          for (let distance = 12; distance < length - 6; distance += 18) {
            const t = distance / length;
            const dash = new THREE.Mesh(
              new THREE.PlaneGeometry(0.18, 7),
              whiteLineMat
            );
            dash.rotation.x = -Math.PI / 2;
            dash.rotation.z = -angle;
            dash.position.set(
              node.x + dx * t + sideX * offset,
              0.045,
              node.z + dz * t + sideZ * offset
            );
            cityGroup.add(dash);
          }
        }

        // Continuous raised concrete median barrier
        const barrier = new THREE.Mesh(
          new THREE.BoxGeometry(medianWidth, 0.9, length),
          medianMat
        );
        barrier.rotation.y = angle;
        barrier.position.set(midX, 0.45, midZ);
        barrier.castShadow = true;
        barrier.receiveShadow = true;
        cityGroup.add(barrier);

        // Do not draw the old single-carriageway road over this section.
        return;
      }

      // Road Segment Mesh
      const roadGeo = new THREE.PlaneGeometry(roadWidth, length);
      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.rotation.z = -angle;
      roadMesh.position.set(midX, 0.01, midZ);
      roadMesh.receiveShadow = true;
      cityGroup.add(roadMesh);

      // Road Curbs (Left & Right)
      const curbLeftGeo = new THREE.BoxGeometry(0.8, 0.25, length);
      const curbLeft = new THREE.Mesh(curbLeftGeo, curbMat);
      curbLeft.rotation.y = angle;
      curbLeft.position.set(
        midX - Math.cos(angle) * (roadWidth / 2 + 0.4),
        0.12,
        midZ + Math.sin(angle) * (roadWidth / 2 + 0.4)
      );
      cityGroup.add(curbLeft);

      const curbRight = curbLeft.clone();
      curbRight.position.set(
        midX + Math.cos(angle) * (roadWidth / 2 + 0.4),
        0.12,
        midZ - Math.sin(angle) * (roadWidth / 2 + 0.4)
      );
      cityGroup.add(curbRight);

      // Center Double Yellow Lines
      const yellowLineGeo = new THREE.PlaneGeometry(0.35, length);
      const yellowLine = new THREE.Mesh(yellowLineGeo, yellowLineMat);
      yellowLine.rotation.x = -Math.PI / 2;
      yellowLine.rotation.z = -angle;
      yellowLine.position.set(midX, 0.02, midZ);
      cityGroup.add(yellowLine);

      // Streetlights along road segment
      const numLights = Math.max(1, Math.floor(length / 35));
      for (let i = 1; i <= numLights; i++) {
        const t = i / (numLights + 1);
        const lx = node.x + dx * t + Math.cos(angle) * (roadWidth / 2 + 1.8);
        const lz = node.z + dz * t - Math.sin(angle) * (roadWidth / 2 + 1.8);

        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.16, 7.5, 8),
          curbMat
        );
        pole.position.set(lx, 3.75, lz);
        cityGroup.add(pole);

        const lampHead = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.25, 1.4),
          new THREE.MeshStandardMaterial({
            color: 0xfef08a,
            emissive: 0xfef08a,
            emissiveIntensity: 1.8,
          })
        );
        lampHead.position.set(lx - Math.cos(angle) * 0.7, 7.4, lz + Math.sin(angle) * 0.7);
        cityGroup.add(lampHead);
      }
    });
  });

  // ============================================================
  // LAGOS–OGUN CROSSING: RIVER, BANKS & BRIDGE SUPPORTS
  // ============================================================

  const borderBridgeGroup = new THREE.Group();
  cityGroup.add(borderBridgeGroup);

 const riverCenterZ = -1035;
const riverWidth = 340;
const riverLength = 520;

  const riverMat = new THREE.MeshStandardMaterial({
    color: 0x167fa5,
    roughness: 0.28,
    metalness: 0.18,
    transparent: true,
    opacity: 0.94,
  });

  // Broad water surface beneath the bridge.
  
  // EPE LAGOON: two broad water surfaces, leaving the road corridor clear.
  const lagoonWidth = 150;
  const lagoonLength = 520;
  const lagoonSurfaceY = 0.02;

  [-1, 1].forEach((side) => {
    const lagoon = new THREE.Mesh(
      new THREE.PlaneGeometry(lagoonWidth, lagoonLength, 16, 32),
      riverMat
    );

    lagoon.rotation.x = -Math.PI / 2;

    // Keep a central corridor clear for the expressway.
    lagoon.position.set(
      180 + side * (22 + lagoonWidth / 2),
      lagoonSurfaceY,
      riverCenterZ
    );

    lagoon.receiveShadow = false;
lagoon.renderOrder = -1;
    borderBridgeGroup.add(lagoon);
  });


  // EPE LAGOON: dry sandy shoreline separating land from water.
  const lagoonShoreMat = new THREE.MeshStandardMaterial({
    color: 0xb6a27b,
    roughness: 1,
    metalness: 0,
  });

  [-1, 1].forEach((side) => {
    const shore = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.3, lagoonLength),
      lagoonShoreMat
    );

    // Shoreline follows the inner edge of each water surface.
    shore.position.set(
      180 + side * 19.5,
      0.02,
      riverCenterZ
    );

    shore.receiveShadow = true;
    borderBridgeGroup.add(shore);
  });


  // River banks on both sides of the crossing.
  const bankMat = new THREE.MeshStandardMaterial({
    color: 0x657b48,
    roughness: 1,
  });

  [-1, 1].forEach((side) => {
    const bank = new THREE.Mesh(
      new THREE.BoxGeometry(riverWidth, 1.4, 7),
      bankMat
    );

    bank.position.set(
      180,
      -1.3,
      riverCenterZ + side * (riverLength / 2 + 3.5)
    );

    bank.receiveShadow = true;
    borderBridgeGroup.add(bank);
  });

  // Concrete bridge supports, positioned outside the carriageways.
  const bridgeSupportMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.85,
  });

  [-1, 1].forEach((side) => {
    [-1060, -1035, -1010].forEach((z) => {
      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 7.0, 2.8),
        bridgeSupportMat
      );

      pier.position.set(180 + side * 12.5, -0.4, z);
      pier.castShadow = true;
      pier.receiveShadow = true;
      borderBridgeGroup.add(pier);
    });
  });

  
  // EPE BRIDGE: realistic metal guardrails with vertical support posts.
  const bridgeRailMat = new THREE.MeshStandardMaterial({
    color: 0x89949c,
    metalness: 0.72,
    roughness: 0.32,
  });

  const bridgePostMat = new THREE.MeshStandardMaterial({
    color: 0x64717a,
    metalness: 0.65,
    roughness: 0.4,
  });

  [-1, 1].forEach((side) => {
    const railX = 180 + side * 9.4;

    // Continuous upper metal rail.
    const upperRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 88),
      bridgeRailMat
    );
    upperRail.position.set(railX, 1.15, -1035);
    upperRail.castShadow = true;
    borderBridgeGroup.add(upperRail);

    // Lower metal rail.
    const lowerRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.12, 88),
      bridgeRailMat
    );
    lowerRail.position.set(railX, 0.48, -1035);
    borderBridgeGroup.add(lowerRail);

    // Evenly spaced vertical supports.
    for (let i = 0; i <= 22; i++) {
      const z = -1079 + i * 4;

      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 1.05, 0.16),
        bridgePostMat
      );
      post.position.set(railX, 0.78, z);
      post.castShadow = true;
      borderBridgeGroup.add(post);
    }
  });


  // Subtle surface streaks suggest the direction of the river current.
  const currentMat = new THREE.MeshBasicMaterial({
    color: 0x83d8e8,
    transparent: true,
    opacity: 0.42,
  });

  for (let i = 0; i < 22; i++) {
    const streakLength = 3 + (i % 4) * 1.5;

    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(streakLength, 0.12),
      currentMat
    );

    streak.rotation.x = -Math.PI / 2;
    streak.position.set(
      115 + ((i * 17) % 130),
      -2.12,
      riverCenterZ - 32 + ((i * 13) % 65)
    );

    borderBridgeGroup.add(streak);
  }


  // EPE LAGOON: lightweight cargo ships and boats at varied distances.
  const epeShipsGroup = new THREE.Group();
  borderBridgeGroup.add(epeShipsGroup);

  const shipHullMat = new THREE.MeshStandardMaterial({
    color: 0x263b4a,
    roughness: 0.72,
    metalness: 0.22,
  });

  const shipDeckMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.8,
  });

  const shipCabinMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.75,
  });

  const shipAccentMat = new THREE.MeshStandardMaterial({
    color: 0xc24135,
    roughness: 0.75,
  });

  // x is across the lagoon; z is along the Epe corridor.
  // Larger vessels are nearer; smaller vessels sit farther away.
  const shipPlacements = [
    { x: 72, z: -990, scale: 1.35, accent: false },
    { x: 288, z: -1015, scale: 1.15, accent: true },
    { x: 105, z: -900, scale: 0.9, accent: false },
    { x: 260, z: -1160, scale: 0.82, accent: true },
    { x: 45, z: -1210, scale: 0.62, accent: false },
    { x: 315, z: -850, scale: 0.58, accent: true },
    { x: 125, z: -790, scale: 0.48, accent: false },
    { x: 235, z: -1270, scale: 0.42, accent: true },
  ];

  shipPlacements.forEach((shipData) => {
    const ship = new THREE.Group();
    const s = shipData.scale;

    // Tapered-looking hull, with its length aligned along Z.
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(5.2 * s, 1.15 * s, 12 * s),
      shipHullMat
    );
    hull.position.y = 0.35 * s;
    ship.add(hull);

    // Upper deck.
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(4.8 * s, 0.25 * s, 9.2 * s),
      shipData.accent ? shipAccentMat : shipDeckMat
    );
    deck.position.set(0, 0.95 * s, 0);
    ship.add(deck);

    // Bridge cabin toward the rear.
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.1 * s, 1.7 * s, 2.2 * s),
      shipCabinMat
    );
    cabin.position.set(0, 1.8 * s, 2.6 * s);
    ship.add(cabin);

    // Small dark windows on the cabin's visible side.
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x183b50 });
    for (let i = 0; i < 3; i++) {
      const windowMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.42 * s, 0.35 * s, 0.06 * s),
        windowMat
      );
      windowMesh.position.set(
        (i - 1) * 0.58 * s,
        2.0 * s,
        1.46 * s
      );
      ship.add(windowMesh);
    }

    ship.position.set(shipData.x, -0.15, shipData.z);
    ship.rotation.y = shipData.x < 180 ? 0.12 : -0.12;

    ship.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });

    epeShipsGroup.add(ship);
  });


  // Intersection nodes asphalt caps & crosswalk markings
Object.values(LAGOS_ROAD_NODES).forEach((node) => {
  // Keep the central plaza and showroom surfaces clear.
  if (node.id === 'N_CENTRAL_JCT' || node.id === 'N_SHOWROOM') {
    return;
  }

  const jctGeo = new THREE.CircleGeometry(10.5, 24);
    const jctMesh = new THREE.Mesh(jctGeo, roadMat);
    jctMesh.rotation.x = -Math.PI / 2;
    jctMesh.position.set(node.x, 0.015, node.z);
    jctMesh.receiveShadow = true;
    cityGroup.add(jctMesh);

    // Crosswalk Zebra Striping on intersection approaches
    for (let i = -3; i <= 3; i++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3.2), whiteLineMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(node.x + i * 1.4, 0.025, node.z + 8.5);
      cityGroup.add(stripe);
    }
  });

  // ============================================================
  // EPE EXPRESSWAY: PEDESTRIAN BRIDGES & LOCATION SIGNAGE
  // ============================================================

  const epeFeatureGroup = new THREE.Group();
  cityGroup.add(epeFeatureGroup);

  const epeConcreteMat = new THREE.MeshStandardMaterial({
    color: 0xb8b8b0,
    roughness: 0.88,
  });

  const epeSteelMat = new THREE.MeshStandardMaterial({
    color: 0x59636b,
    metalness: 0.55,
    roughness: 0.48,
  });

  const epeSignMat = new THREE.MeshStandardMaterial({
    color: 0x075b35,
    roughness: 0.7,
  });

  const epeWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.75,
  });

  // All locations follow the expressway toward Epe.
  // These are visual sign locations, not GPS-accurate coordinates.
  
const epeLocations = [
  { name: 'AJAH', z: -230 },
  { name: 'ABRAHAM ADESANYA', z: -350 },
  { name: 'SANGOTEDO', z: -480 },
  { name: 'LAKOWE', z: -610 },
  { name: 'ELEKO', z: -750 },
  { name: 'IBEJU-LEKKI', z: -870 },
  { name: 'EPE', z: -940 },
];


  // Paired directional signs on both sides of the expressway.
  epeLocations.forEach((location, index) => {
    if (location.name === 'EPE') return;
    [-1, 1].forEach((side) => {
      const pole = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 4.4, 0.35),
        epeSteelMat
      );
      pole.position.set(180 + side * 11, 2.2, location.z);
      pole.castShadow = true;
      epeFeatureGroup.add(pole);

      const board = new THREE.Mesh(
        new THREE.BoxGeometry(4.8, 1.8, 0.18),
        epeSignMat
      );
      board.position.set(180 + side * 11, 4.8, location.z);
      board.castShadow = true;
      epeFeatureGroup.add(board);

      // White location text rendered onto a canvas.
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 160;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#075b35';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 7;
        ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

        ctx.fillStyle = '#ffffff';
        ctx.font = location.name.length > 12
          ? 'bold 35px Arial'
          : 'bold 46px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(location.name, 256, 80, 470);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;

      const textBoard = new THREE.Mesh(
        new THREE.PlaneGeometry(4.55, 1.55),
        new THREE.MeshBasicMaterial({ map: texture })
      );

      textBoard.position.set(
        180 + side * 10.89,
        4.8,
        location.z
      );

      // Face the sign inward toward the road.
      textBoard.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
      epeFeatureGroup.add(textBoard);
    });
  });

  // Three overhead pedestrian bridges across the expressway.
  // Each bridge has piers, a raised deck, parapets and access stairs.
  
  // ============================================================
  // EPE DESTINATION GANTRY — VISIBLE FROM THE LAGOS APPROACH
  // ============================================================

  const epeGantryGroup = new THREE.Group();
  cityGroup.add(epeGantryGroup);

  const epeGantryZ = -915;

  const gantrySteelMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.65,
    roughness: 0.4,
  });

  const gantryGreenMat = new THREE.MeshStandardMaterial({
    color: 0x075b35,
    roughness: 0.55,
  });

  // Two tall steel support columns outside the carriageways.
  [-1, 1].forEach((side) => {
    const column = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 9.2, 0.8),
      gantrySteelMat
    );

    column.position.set(180 + side * 12, 4.6, epeGantryZ);
    column.castShadow = true;
    column.receiveShadow = true;
    epeGantryGroup.add(column);
  });

  // Overhead crossbeam spanning both carriageways.
  const crossbeam = new THREE.Mesh(
    new THREE.BoxGeometry(25, 0.8, 0.8),
    gantrySteelMat
  );

  crossbeam.position.set(180, 9.0, epeGantryZ);
  crossbeam.castShadow = true;
  epeGantryGroup.add(crossbeam);

  // Large green destination board.
  const epeBoard = new THREE.Mesh(
    new THREE.BoxGeometry(17, 4.2, 0.5),
    gantryGreenMat
  );

  epeBoard.position.set(180, 6.7, epeGantryZ);
  epeBoard.castShadow = true;
  epeGantryGroup.add(epeBoard);

  // High-resolution sign face. A PlaneGeometry faces +Z by default,
  // toward drivers approaching from Lagos at higher Z coordinates.
  const epeCanvas = document.createElement('canvas');
  epeCanvas.width = 1400;
  epeCanvas.height = 340;

  const epeContext = epeCanvas.getContext('2d');

  if (epeContext) {
    epeContext.fillStyle = '#075b35';
    epeContext.fillRect(0, 0, 1400, 340);

    // Double white border for a highway-sign appearance.
    epeContext.strokeStyle = '#ffffff';
    epeContext.lineWidth = 10;
    epeContext.strokeRect(10, 10, 1380, 320);

    epeContext.lineWidth = 3;
    epeContext.strokeRect(24, 24, 1352, 292);

    epeContext.textAlign = 'center';
    epeContext.textBaseline = 'middle';
    epeContext.fillStyle = '#ffffff';

    epeContext.font = 'bold 180px Arial';
    epeContext.fillText('EPE', 700, 145);

    epeContext.font = 'bold 48px Arial';
    epeContext.fillText('DESTINATION', 700, 265);
  }

  const epeTexture = new THREE.CanvasTexture(epeCanvas);
  epeTexture.colorSpace = THREE.SRGBColorSpace;
  epeTexture.anisotropy = 8;

  const epeSignFace = new THREE.Mesh(
    new THREE.PlaneGeometry(16.6, 3.8),
    new THREE.MeshBasicMaterial({
      map: epeTexture,
      side: THREE.FrontSide,
    })
  );

  // Place the text on the Lagos-facing side of the sign.
  epeSignFace.position.set(180, 6.7, epeGantryZ + 0.27);
  epeGantryGroup.add(epeSignFace);

  const pedestrianBridgeZ = [-320, -570, -820];

  pedestrianBridgeZ.forEach((z, index) => {
    // Support piers on the outside shoulders.
    [-1, 1].forEach((side) => {
      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 5.8, 1.5),
        epeConcreteMat
      );
      pier.position.set(180 + side * 9.4, 2.9, z);
      pier.castShadow = true;
      pier.receiveShadow = true;
      epeFeatureGroup.add(pier);
    });

    // Elevated pedestrian deck spanning both carriageways.
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.65, 2.8),
      epeConcreteMat
    );
    deck.position.set(180, 6.0, z);
    deck.castShadow = true;
    deck.receiveShadow = true;
    epeFeatureGroup.add(deck);

    // Metal safety railings along both sides of the walkway.
    [-1, 1].forEach((side) => {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(22, 0.9, 0.12),
        epeSteelMat
      );
      rail.position.set(180, 6.75, z + side * 1.25);
      epeFeatureGroup.add(rail);
    });

    // Stair flights descending toward both road shoulders.
    [-1, 1].forEach((side) => {
      const stair = new THREE.Mesh(
        new THREE.BoxGeometry(3.0, 0.22, 7.0),
        epeConcreteMat
      );
      stair.position.set(180 + side * 10.5, 3.3, z + 4.2);
      stair.rotation.x = -0.48;
      stair.castShadow = true;
      epeFeatureGroup.add(stair);
    });

    // Small bridge identification plate.
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.65, 0.12),
      epeSignMat
    );
    plate.position.set(180, 5.15, z - 1.55);
    epeFeatureGroup.add(plate);
  });

  // ============================================================
  // OGUN STATE ARRIVAL: DESTINATION SIGN & RURAL LANDSCAPE
  // ============================================================

  const ogunArrivalGroup = new THREE.Group();
  cityGroup.add(ogunArrivalGroup);

  const ogunGreenMat = new THREE.MeshStandardMaterial({
    color: 0x176b3a,
    roughness: 0.85,
  });

  const ogunWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
  });

  const ogunConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.9,
  });

  // Large roadside arrival sign beyond the bridge.
  const ogunSignZ = -1138;

  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 6.0, 0.5),
      ogunConcreteMat
    );

    post.position.set(180 + side * 10, 3, ogunSignZ);
    post.castShadow = true;
    ogunArrivalGroup.add(post);
  });

  const ogunBoard = new THREE.Mesh(
    new THREE.BoxGeometry(12, 3.4, 0.35),
    ogunGreenMat
  );

  ogunBoard.position.set(180, 6.0, ogunSignZ);
  ogunBoard.castShadow = true;
  ogunArrivalGroup.add(ogunBoard);

  // Render readable sign text.
  const ogunCanvas = document.createElement('canvas');
  ogunCanvas.width = 1024;
  ogunCanvas.height = 300;

  const ogunContext = ogunCanvas.getContext('2d');

  if (ogunContext) {
    ogunContext.fillStyle = '#176b3a';
    ogunContext.fillRect(0, 0, 1024, 300);

    ogunContext.strokeStyle = '#ffffff';
    ogunContext.lineWidth = 10;
    ogunContext.strokeRect(8, 8, 1008, 284);

    ogunContext.fillStyle = '#ffffff';
    ogunContext.textAlign = 'center';
    ogunContext.textBaseline = 'middle';
    ogunContext.font = 'bold 65px Arial';
    ogunContext.fillText('WELCOME TO', 512, 90);

    ogunContext.font = 'bold 86px Arial';
    ogunContext.fillText('OGUN STATE', 512, 180);

    ogunContext.font = 'bold 40px Arial';
    ogunContext.fillText('NIGERIA', 512, 248);
  }

  const ogunTexture = new THREE.CanvasTexture(ogunCanvas);
  ogunTexture.colorSpace = THREE.SRGBColorSpace;

  const ogunSignFace = new THREE.Mesh(
    new THREE.PlaneGeometry(11.6, 3.0),
    new THREE.MeshBasicMaterial({ map: ogunTexture })
  );

  ogunSignFace.position.set(180, 6.0, ogunSignZ + 0.19);
  ogunArrivalGroup.add(ogunSignFace);

  // Rural vegetation and distant rolling hills.
  const hillMat = new THREE.MeshStandardMaterial({
    color: 0x587b43,
    roughness: 1,
  });

  const hillPositions = [
    { x: 125, z: -1220, sx: 70, sy: 24, sz: 48 },
    { x: 245, z: -1250, sx: 85, sy: 32, sz: 55 },
    { x: 180, z: -1320, sx: 110, sy: 40, sz: 65 },
  ];

  hillPositions.forEach((hill) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 18, 12),
      hillMat
    );

    mesh.position.set(hill.x, hill.sy * 0.65 - 1, hill.z);
    mesh.scale.set(hill.sx, hill.sy, hill.sz);
    mesh.receiveShadow = true;
    ogunArrivalGroup.add(mesh);
  });

  // Small rural houses visible beyond the border.
  const houseWallMat = new THREE.MeshStandardMaterial({
    color: 0xc9b99b,
    roughness: 0.95,
  });

  const houseRoofMat = new THREE.MeshStandardMaterial({
    color: 0x874b32,
    roughness: 0.9,
  });

  const ruralHousePositions = [
    { x: 125, z: -1195 },
    { x: 235, z: -1210 },
    { x: 145, z: -1250 },
    { x: 255, z: -1280 },
    { x: 95, z: -1270 },
  ];

  ruralHousePositions.forEach((house, index) => {
    const width = index % 2 === 0 ? 7 : 9;
    const height = index % 2 === 0 ? 4 : 5;

    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 7),
      houseWallMat
    );

    walls.position.set(house.x, height / 2 - 1, house.z);
    walls.castShadow = true;
    walls.receiveShadow = true;
    ogunArrivalGroup.add(walls);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(width * 0.78, 3.5, 4),
      houseRoofMat
    );

    roof.position.set(house.x, height + 0.25, house.z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    ogunArrivalGroup.add(roof);
  });

  // ============================================================
  // OGUN BORDER VIEWING POINT & VEHICLE TURNAROUND
  // ============================================================

  const ogunTurnaroundGroup = new THREE.Group();
  cityGroup.add(ogunTurnaroundGroup);

  const turnaroundZ = -1170;

  const turnaroundAsphaltMat = new THREE.MeshStandardMaterial({
    color: 0x263341,
    roughness: 0.88,
    metalness: 0.05,
  });

  const turnaroundShoulderMat = new THREE.MeshStandardMaterial({
    color: 0xb8b0a0,
    roughness: 0.95,
  });

  const turnaroundMarkingMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
  });

  // Wider paved area connected to the end of the expressway.
  const turnaroundSurface = new THREE.Mesh(
    new THREE.CircleGeometry(25, 64),
    turnaroundAsphaltMat
  );

  turnaroundSurface.rotation.x = -Math.PI / 2;
  turnaroundSurface.position.set(180, 0.035, turnaroundZ);
  turnaroundSurface.receiveShadow = true;
  ogunTurnaroundGroup.add(turnaroundSurface);

  // Light-colored outer shoulder.
  const turnaroundShoulder = new THREE.Mesh(
    new THREE.RingGeometry(25, 29, 64),
    turnaroundShoulderMat
  );

  turnaroundShoulder.rotation.x = -Math.PI / 2;
  turnaroundShoulder.position.set(180, 0.025, turnaroundZ);
  turnaroundShoulder.receiveShadow = true;
  ogunTurnaroundGroup.add(turnaroundShoulder);

  // Painted perimeter marking.
  const turnaroundPerimeter = new THREE.Mesh(
    new THREE.RingGeometry(23.8, 24.2, 64),
    turnaroundMarkingMat
  );

  turnaroundPerimeter.rotation.x = -Math.PI / 2;
  turnaroundPerimeter.position.set(180, 0.065, turnaroundZ);
  ogunTurnaroundGroup.add(turnaroundPerimeter);

  // Small central island to give the turning area a finished appearance.
  const islandMat = new THREE.MeshStandardMaterial({
    color: 0x477342,
    roughness: 1,
  });

  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 5.2, 0.35, 32),
    islandMat
  );

  island.position.set(180, 0.2, turnaroundZ);
  island.receiveShadow = true;
  ogunTurnaroundGroup.add(island);

  // Low shrubs on the island.
  const shrubMat = new THREE.MeshStandardMaterial({
    color: 0x2f6d35,
    roughness: 1,
  });

  [
    { x: 177, z: -1170 },
    { x: 183, z: -1172 },
    { x: 180, z: -1167 },
  ].forEach((position, index) => {
    const shrub = new THREE.Mesh(
      new THREE.SphereGeometry(index === 1 ? 1.8 : 1.4, 10, 8),
      shrubMat
    );

    shrub.position.set(position.x, 1.25, position.z);
    shrub.scale.y = 0.85;
    shrub.castShadow = true;
    ogunTurnaroundGroup.add(shrub);
  });

  
  // ============================================================
  // OGUN STATE: ROAD CLOSED — ONGOING CONSTRUCTION
  // ============================================================

  const constructionZoneGroup = new THREE.Group();
  cityGroup.add(constructionZoneGroup);

  const barricadeZ = -1202;

  const barricadeWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.8,
  });

  const barricadeRedMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.7,
  });

  const barricadeSteelMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.35,
    roughness: 0.65,
  });

  // Three linked road-closure barricade sections.
  [-1, 0, 1].forEach((section) => {
    const x = 180 + section * 5.5;

    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(5.3, 1.6, 0.65),
      barricadeWhiteMat
    );

    barrier.position.set(x, 1.0, barricadeZ);
    barrier.castShadow = true;
    barrier.receiveShadow = true;
    constructionZoneGroup.add(barrier);

    // Diagonal red warning panels on the front face.
    for (let stripe = 0; stripe < 4; stripe++) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 1.35, 0.08),
        barricadeRedMat
      );

      panel.position.set(
        x - 1.8 + stripe * 1.15,
        1.0,
        barricadeZ + 0.37
      );

      panel.rotation.z = -0.55;
      constructionZoneGroup.add(panel);
    }

    // Short support legs.
    [-1.8, 1.8].forEach((offset) => {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.8, 0.45),
        barricadeSteelMat
      );

      leg.position.set(x + offset, 0.4, barricadeZ);
      leg.castShadow = true;
      constructionZoneGroup.add(leg);
    });
  });

  // Construction warning sign above the barrier.
  const warningBoard = new THREE.Mesh(
    new THREE.BoxGeometry(11, 1.8, 0.3),
    barricadeRedMat
  );

  warningBoard.position.set(180, 3.2, barricadeZ);
  constructionZoneGroup.add(warningBoard);

  const warningCanvas = document.createElement('canvas');
  warningCanvas.width = 1024;
  warningCanvas.height = 180;

  const warningContext = warningCanvas.getContext('2d');

  if (warningContext) {
    warningContext.fillStyle = '#dc2626';
    warningContext.fillRect(0, 0, 1024, 180);

    warningContext.strokeStyle = '#ffffff';
    warningContext.lineWidth = 8;
    warningContext.strokeRect(6, 6, 1012, 168);

    warningContext.fillStyle = '#ffffff';
    warningContext.font = 'bold 64px Arial';
    warningContext.textAlign = 'center';
    warningContext.textBaseline = 'middle';
    warningContext.fillText('ROAD CLOSED', 512, 90);
  }

  const warningTexture = new THREE.CanvasTexture(warningCanvas);
  warningTexture.colorSpace = THREE.SRGBColorSpace;

  const warningFace = new THREE.Mesh(
    new THREE.PlaneGeometry(10.7, 1.65),
    new THREE.MeshBasicMaterial({ map: warningTexture })
  );

  warningFace.position.set(180, 3.2, barricadeZ + 0.17);
  constructionZoneGroup.add(warningFace);


  // EPE CORRIDOR: modern high-rise skyline.

// EPE CORRIDOR: DENSE MIXED-HEIGHT URBAN DISTRICT.
// Buildings on both sides of the expressway.
// Keep the central road and lagoon crossing clear.

const epeSkylineGroup = new THREE.Group();
cityGroup.add(epeSkylineGroup);

const epeTowerMaterials = [
  new THREE.MeshStandardMaterial({
    color: 0x416b86,
    roughness: 0.4,
    metalness: 0.3,
  }),
  new THREE.MeshStandardMaterial({
    color: 0x7897a8,
    roughness: 0.45,
    metalness: 0.2,
  }),
  new THREE.MeshStandardMaterial({
    color: 0x334e68,
    roughness: 0.4,
    metalness: 0.3,
  }),
];

const epeLowRiseMaterials = [
  new THREE.MeshStandardMaterial({
    color: 0xd1c6b5,
    roughness: 0.9,
  }),
  new THREE.MeshStandardMaterial({
    color: 0xb8b0a2,
    roughness: 0.9,
  }),
  new THREE.MeshStandardMaterial({
    color: 0xc6cbd0,
    roughness: 0.9,
  }),
  new THREE.MeshStandardMaterial({
    color: 0xd6d0c5,
    roughness: 0.9,
  }),
];

const epeRoofMaterial = new THREE.MeshStandardMaterial({
  color: 0x64748b,
  roughness: 0.8,
});

const epeWindowMaterial = new THREE.MeshStandardMaterial({
  color: 0x536875,
  roughness: 0.3,
  metalness: 0.15,
});

const epeWindowFrameMaterial = new THREE.MeshStandardMaterial({
  color: 0x77766f,
  roughness: 0.8,
  metalness: 0.05,
});

let epeBuildingIndex = 0;

// Dense rows running along the Epe expressway.
// The buildings begin outside the road and roadside furniture.
const epeBuildingRows = [
  { z: -180, count: 7 },
  { z: -220, count: 7 },
  { z: -280, count: 7 },
  { z: -330, count: 7 },
  { z: -380, count: 7 },
  { z: -430, count: 7 },
  { z: -480, count: 7 },
  { z: -530, count: 7 },
  { z: -580, count: 7 },
  { z: -630, count: 7 },
  { z: -680, count: 7 },
  { z: -730, count: 7 },
  { z: -780, count: 7 },
  { z: -830, count: 7 },
  { z: -880, count: 7 },
  { z: -925, count: 6 },
];

epeBuildingRows.forEach((row, rowIndex) => {
  [-1, 1].forEach((side) => {
    for (let i = 0; i < row.count; i++) {
      const width = 8 + ((i + rowIndex) % 3) * 1.2;
      const depth = 9 + ((i * 2 + rowIndex) % 3) * 1.5;

      const pattern =
        (i + rowIndex * 2 + (side === 1 ? 1 : 0)) % 10;

      let height = 10;

      if (pattern <= 2) {
        height = 8 + pattern * 2;
      } else if (pattern <= 6) {
        height = 16 + (pattern % 3) * 4;
      } else {
        height = 32 + (pattern % 3) * 8;
      }

      // Move each row outward from the expressway.
      // Alternating spacing creates a compact, irregular skyline.
      const xDistance =
        15 + i * 10.5 + (rowIndex % 2) * 2.5;

      const x = 180 + side * (xDistance + width / 2);
      const z = row.z + (i % 2) * 3;

      const building = new THREE.Group();
      building.position.set(x, 0, z);

      const isTallBuilding = height >= 32;

      const bodyMaterial = isTallBuilding
        ? epeTowerMaterials[
            epeBuildingIndex % epeTowerMaterials.length
          ]
        : epeLowRiseMaterials[
            epeBuildingIndex % epeLowRiseMaterials.length
          ];

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        bodyMaterial
      );

      body.position.y = height / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      building.add(body);

      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.35, 0.5, depth + 0.35),
        epeRoofMaterial
      );

      roof.position.y = height + 0.25;
      building.add(roof);

     
   // Lightweight facade windows.
const floors = Math.floor(height / 5);
const columns = Math.max(2, Math.floor(width / 4));

for (let floor = 0; floor < floors; floor++) {
  for (let column = 0; column < columns; column++) {
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.5),
      epeWindowMaterial
    );

    glass.position.set(
      -width / 2 + 1.5 + column * 4,
      2 + floor * 5,
      depth / 2 + 0.04
    );

    building.add(glass);
  }
}


      epeSkylineGroup.add(building);
      epeBuildingIndex++;
    }
  });
});


  // 3. URBAN BUILDINGS & RESIDENTIAL COMPOUNDS
  LAGOS_BUILDINGS.forEach((b) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(b.x, 0, b.z);

       // Main Architectural Block
    const bGeo = new THREE.BoxGeometry(b.width, b.height, b.depth); 
const bMat = new THREE.MeshStandardMaterial({
  color: b.color,
  roughness: 0.88,
  metalness: 0.03,
});

    const bMesh = new THREE.Mesh(bGeo, bMat);
    bMesh.position.y = b.height / 2;
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    bGroup.add(bMesh);

    // Roof parapet / roof cap
    const roofGeo = new THREE.BoxGeometry(b.width + 0.8, 0.8, b.depth + 0.8);
    const roofMat = new THREE.MeshStandardMaterial({ color: b.roofColor, roughness: 0.4 });
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.y = b.height + 0.4;
    bGroup.add(roofMesh);
    // Lightweight ground-floor commercial storefront.
    if (b.hasSign) {
      const shopGlassMat = new THREE.MeshStandardMaterial({
        color: 0x354955,
        roughness: 0.35,
        metalness: 0.08,
      });

      const shopFrameMat = new THREE.MeshStandardMaterial({
        color: 0x353535,
        roughness: 0.8,
      });

      // Front-facing glass shopfront.
      const shopWidth = Math.min(b.width * 0.72, b.width - 0.8);
      const shopHeight = Math.min(2.8, b.height * 0.3);

      const shopGlass = new THREE.Mesh(
        new THREE.PlaneGeometry(shopWidth, shopHeight),
        shopGlassMat
      );

      shopGlass.position.set(
        0,
        Math.max(1.6, shopHeight / 2 + 0.15),
        b.depth / 2 + 0.025
      );

      bGroup.add(shopGlass);

            // Slim canopy above the shopfront.
      const canopyMat = new THREE.MeshStandardMaterial({
        color: b.roofColor,
        roughness: 0.85,
        metalness: 0.0,
      });

      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(shopWidth + 0.3, 0.16, 0.65),
        canopyMat
      );

      canopy.position.set(
        0,
        shopGlass.position.y + shopHeight / 2 + 0.12,
        b.depth / 2 + 0.3
      );

      bGroup.add(canopy);

      
      // Small entrance platform in front of the shop.
      const entranceMat = new THREE.MeshStandardMaterial({
        color: 0x99958b,
        roughness: 0.95,
        metalness: 0.0,
      });

      const entranceWidth = Math.min(b.width * 0.8, b.width - 0.5);

      const entrance = new THREE.Mesh(
        new THREE.BoxGeometry(entranceWidth, 0.16, 1.1),
        entranceMat
      );

      entrance.position.set(
        0,
        0.08,
        b.depth / 2 + 0.55
      );

      entrance.receiveShadow = true;
      bGroup.add(entrance);

      // One low step leading onto the entrance platform.
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(entranceWidth * 0.65, 0.12, 0.3),
        entranceMat
      );

      step.position.set(
        0,
        0.06,
        b.depth / 2 + 1.2
      );

      bGroup.add(step);


      // Simple central door frame.
      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, shopHeight),
        shopFrameMat
      );

      door.position.set(
        0,
        Math.max(1.6, shopHeight / 2 + 0.15),
        b.depth / 2 + 0.04
      );

      bGroup.add(door);
    }
    
    // Realistic architectural window grids
    const rows = Math.floor(b.height / 3.8);
    const cols = Math.floor(b.width / 4.2);

    const winMat = new THREE.MeshStandardMaterial({
      color: 0x667985,
      roughness: 0.38,
      metalness: 0.12,
      emissive: 0x101820,
      emissiveIntensity: 0.08,
    });

    const windowFrameMat = new THREE.MeshStandardMaterial({
      color: 0x77766f,
      roughness: 0.82,
      metalness: 0.02,
    });

    for (let r = 1; r <= rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -b.width / 2 + 2.5 + c * 4.0;
        const y = r * 3.6;

        // Recessed-looking window frame
        const frame = new THREE.Mesh(
          new THREE.PlaneGeometry(1.85, 2.05),
          windowFrameMat
        );

        frame.position.set(
          x,
          y,
          b.depth / 2 + 0.045
        );

        bGroup.add(frame);

        // Glass panel
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(1.55, 1.72),
          winMat
        );

        win.position.set(
          x,
          y,
          b.depth / 2 + 0.055
        );

        bGroup.add(win);
      }
    }


    // Commercial Storefront Signboard
    if (b.hasSign && b.signText) {
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 512;
      signCanvas.height = 128;
      const ctx = signCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#071A2B';
        ctx.fillRect(0, 0, 512, 128);
        ctx.strokeStyle = '#EF233C';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, 504, 120);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.signText, 256, 64);
      }
      const signTex = new THREE.CanvasTexture(signCanvas);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex });
      const signMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(b.width * 0.75, 3.2),
        signMat
      );
      signMesh.position.set(0, 4.2, b.depth / 2 + 0.1);
      bGroup.add(signMesh);
    }

    cityGroup.add(bGroup);
  });

  // 4. LAGOS URBAN PROPS: DANFO BUS STOPS & HIGHWAY GANTRIES
  const danfoShelterMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15, // Danfo iconic yellow
    roughness: 0.3,
  });
  const blackStripeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });

  // Danfo bus stops along Herbert Macaulay & Commercial Ave
  const busStopLocations = [
    { x: 10, z: -40, angle: 0 },
    { x: 75, z: 9, angle: Math.PI / 2 },
    { x: -75, z: 9, angle: -Math.PI / 2 },
  ];

  busStopLocations.forEach((loc) => {
    const stopGroup = new THREE.Group();
    stopGroup.position.set(loc.x, 0, loc.z);
    stopGroup.rotation.y = loc.angle;

    // Yellow Canopy
    const roof = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.3, 3.5), danfoShelterMat);
    roof.position.set(0, 3.2, 0);
    stopGroup.add(roof);

    // Danfo Signature Black Stripes
    const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.08, 0.35), blackStripeMat);
    stripe1.position.set(0, 3.2, 0.8);
    const stripe2 = stripe1.clone();
    stripe2.position.z = -0.8;
    stopGroup.add(stripe1, stripe2);

    // Pillars & Bench
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 8), curbMat);
    p1.position.set(-3.0, 1.6, -1.2);
    const p2 = p1.clone();
    p2.position.x = 3.0;
    stopGroup.add(p1, p2);

    const bench = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.45, 0.8), curbMat);
    bench.position.set(0, 0.45, -1.0);
    stopGroup.add(bench);

    cityGroup.add(stopGroup);
  });

  // Overhead Highway Navigation Gantry at North Gateway
  const gantryGroup = new THREE.Group();
  gantryGroup.position.set(0, 0, -80);

  const gantryPillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 8.5, 12), curbMat);
  gantryPillarL.position.set(-8.5, 4.25, 0);
  const gantryPillarR = gantryPillarL.clone();
  gantryPillarR.position.x = 8.5;

  const gantryBeam = new THREE.Mesh(new THREE.BoxGeometry(18.0, 0.6, 0.6), curbMat);
  gantryBeam.position.set(0, 8.2, 0);

  const gantrySignCanvas = document.createElement('canvas');
  gantrySignCanvas.width = 512;
  gantrySignCanvas.height = 128;
  const gctx = gantrySignCanvas.getContext('2d');
  if (gctx) {
    gctx.fillStyle = '#065F46'; // Lagos highway green sign
    gctx.fillRect(0, 0, 512, 128);
    gctx.strokeStyle = '#FFFFFF';
    gctx.lineWidth = 6;
    gctx.strokeRect(6, 6, 500, 116);
    gctx.fillStyle = '#FFFFFF';
    gctx.font = 'bold 32px sans-serif';
    gctx.textAlign = 'center';
    gctx.fillText('▲ SURULERE EXPRESSWAY', 256, 45);
    gctx.font = 'bold 26px sans-serif';
    gctx.fillStyle = '#FDE047';
    gctx.fillText('◀ YABA TECH HUB | CARGO DEPOT ▶', 256, 95);
  }
  const gantrySignTex = new THREE.CanvasTexture(gantrySignCanvas);
  const gantrySign = new THREE.Mesh(
    new THREE.PlaneGeometry(12.0, 3.0),
    new THREE.MeshBasicMaterial({ map: gantrySignTex })
  );
  gantrySign.position.set(0, 8.0, 0.35);

  gantryGroup.add(gantryPillarL, gantryPillarR, gantryBeam, gantrySign);
  cityGroup.add(gantryGroup);

  // 5. LANDMARK ZONES AND OBJECTIVE CIRCLES
  const landmarkMarkers: { id: string; group: THREE.Group }[] = [];

  CITY_LANDMARKS.forEach((lm) => {
    const lmGroup = new THREE.Group();
    lmGroup.position.set(lm.x, 0.15, lm.z);

    // Concentric glowing trigger pads
    const ringGeo = new THREE.RingGeometry(lm.radius * 0.75, lm.radius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(lm.color),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    lmGroup.add(ringMesh);

    // Center pulsating beacon pillar
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 14, 8),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(lm.color),
        transparent: true,
        opacity: 0.45,
      })
    );
    beacon.position.y = 7;
    lmGroup.add(beacon);

    landmarkMarkers.push({ id: lm.id, group: lmGroup });
    cityGroup.add(lmGroup);
  });

  // 6. STREET RACE CHECKPOINTS (Mission B: City Rival Challenge)
  const checkpointMeshes: { id: number; mesh: THREE.Group; active: boolean }[] = [];

  RIVAL_RACE_CHECKPOINTS.forEach((cp) => {
    const cpGroup = new THREE.Group();
    cpGroup.position.set(cp.x, 0.2, cp.z);

    // Glowing Gate Ring
    const torusGeo = new THREE.TorusGeometry(cp.radius * 0.85, 0.3, 12, 32);
    const torusMat = new THREE.MeshBasicMaterial({
      color: 0xef233c,
      transparent: true,
      opacity: 0.7,
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.rotation.x = Math.PI / 2;
    cpGroup.add(torus);

    checkpointMeshes.push({
      id: cp.id,
      mesh: cpGroup,
      active: true,
    });
    cityGroup.add(cpGroup);
  });

  // 7. IN-WORLD DYNAMIC GPS NAVIGATION RIBBON
  const gpsLineGeo = new THREE.BufferGeometry();
  const initialPoints = [
    new THREE.Vector3(0, 0.25, -35),
    new THREE.Vector3(0, 0.25, 0),
  ];
  gpsLineGeo.setFromPoints(initialPoints);
  const gpsLineMat = new THREE.LineBasicMaterial({
    color: 0x10b981, // Vibrant GPS emerald
    linewidth: 5,
  });
  const gpsRouteLine = new THREE.Line(gpsLineGeo, gpsLineMat);
  cityGroup.add(gpsRouteLine);

  const updateGPSRoute = (path: { x: number; z: number }[]) => {
    if (!path || path.length < 2) {
      gpsRouteLine.visible = false;
      return;
    }
    gpsRouteLine.visible = true;
    const pts = path.map((p) => new THREE.Vector3(p.x, 0.3, p.z));
    gpsRouteLine.geometry.dispose();
    gpsRouteLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  };

  return {
    cityGroup,
    collidableBuildings: LAGOS_BUILDINGS,
    checkpointMeshes,
    landmarkMarkers,
    gpsRouteLine,
    updateGPSRoute,
  };
}
