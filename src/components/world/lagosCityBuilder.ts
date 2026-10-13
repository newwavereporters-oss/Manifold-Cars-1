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

export function buildLagosCityDistrict(): LagosCityResult {
  const cityGroup = new THREE.Group();

  // 1. TERRAIN & GROUND PLANE
  const groundGeo = new THREE.PlaneGeometry(600, 600, 16, 16);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8, // Balanced slate ground
    roughness: 0.85,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  cityGroup.add(ground);

  // 2. ROAD NETWORK GEOMETRY
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b, // Dark durable asphalt
    roughness: 0.7,
    metalness: 0.15,
  });

  const curbMat = new THREE.MeshStandardMaterial({
    color: 0x64748b, // Concrete curb
    roughness: 0.6,
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

  // Intersection nodes asphalt caps & crosswalk markings
  Object.values(LAGOS_ROAD_NODES).forEach((node) => {
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

  // 3. URBAN BUILDINGS & RESIDENTIAL COMPOUNDS
  LAGOS_BUILDINGS.forEach((b) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(b.x, 0, b.z);

    // Main Architectural Block
    const bGeo = new THREE.BoxGeometry(b.width, b.height, b.depth);
    const bMat = new THREE.MeshStandardMaterial({
      color: b.color,
      roughness: 0.65,
      metalness: 0.25,
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

    // Window Grids
    const rows = Math.floor(b.height / 3.8);
    const cols = Math.floor(b.width / 4.2);
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.1,
      metalness: 0.8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.35,
    });

    for (let r = 1; r <= rows; r++) {
      for (let c = 0; c < cols; c++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), winMat);
        win.position.set(
          -b.width / 2 + 2.5 + c * 4.0,
          r * 3.6,
          b.depth / 2 + 0.05
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
