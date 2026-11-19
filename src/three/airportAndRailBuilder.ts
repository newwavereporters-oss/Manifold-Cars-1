// MANIFOLD WORLD - MURTALA MUHAMMED INTL AIRPORT, MARINA SKYLINE,
// ELEVATED BLUE LINE RAIL BRIDGE (MARINA -> MILE 2 -> IYANOBA) & IYANOBA LOW-RISE TOWN
// High-performance Three.js builder using InstancedMesh & zero per-frame allocations.

import * as THREE from 'three';
import type { BuildingBox, BarricadeKind } from '../components/world/lagosCityData';
import type { LagosTexturePack } from '../components/world/lagosTextures';

export interface AirportAndRailContext {
  cityGroup: THREE.Group;
  texPack: LagosTexturePack;
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T;
  trackMat: <T extends THREE.Material>(m: T) => T;
  distToNearestRoad: (px: number, pz: number) => number;
  allCollidableBuildings: BuildingBox[];
  buildCompositeBuilding: (b: BuildingBox) => void;
  addBarricade: (
    id: string,
    x: number,
    y: number,
    z: number,
    halfW: number,
    halfD: number,
    angle: number,
    kind: BarricadeKind
  ) => void;
  S: number;
}

export interface AirportAndRailController {
  update: (delta: number, timeSec: number) => void;
}

export function buildAirportMarinaAndRail(ctx: AirportAndRailContext): AirportAndRailController {
  const {
    cityGroup,
    texPack,
    trackGeo,
    trackMat,
    distToNearestRoad,
    allCollidableBuildings,
    buildCompositeBuilding,
    addBarricade,
    S,
  } = ctx;

  // Shared Architectural & Aviation Materials
  const steelDarkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.72 })
  );
  const steelSilverMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.32, metalness: 0.82 })
  );
  const concreteMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.86, metalness: 0.08 })
  );
  const apronMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85, metalness: 0.08 })
  );
  const runwayMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.88, metalness: 0.06 })
  );
  const blueLineMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.36, metalness: 0.45 })
  );
  const blueLineTrimMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.45 })
  );
  const whiteGlossMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.22 })
  );
  const jetNavyMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.28, metalness: 0.55 })
  );
  const jetRedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.32, metalness: 0.3 })
  );
  const jetGoldMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.28, metalness: 0.75 })
  );
  const glassCabMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x064e3b,
      roughness: 0.08,
      metalness: 0.25,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.78,
    })
  );
  const cockpitGlassMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.85 })
  );
  const hangarRoofMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.55, metalness: 0.55 })
  );
  const navRedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 3.0 })
  );
  const navGreenMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 3.0 })
  );
  const navAmberMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 2.2 })
  );
  const papiRedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.0 })
  );
  const taxiBlueMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 2.2 })
  );

  // Reusable Plane Builder (Commercial Airliner or Executive Private Jet)
  const buildAircraftMesh = (kind: 'AIRLINER' | 'BIZJET', liveryMat: THREE.Material) => {
    const plane = new THREE.Group();
    const isJet = kind === 'BIZJET';
    const scale = isJet ? 0.58 : 1.0;

    // Fuselage (+Z = nose, -Z = tail)
    const fuseLen = 28.0 * scale;
    const fuseR = 1.95 * scale;
    const fuseGeo = trackGeo(new THREE.CylinderGeometry(fuseR, fuseR * 0.92, fuseLen, 16));
    fuseGeo.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuseGeo, whiteGlossMat);
    fuselage.position.y = 3.2 * scale;
    fuselage.castShadow = true;

    // Nose cone + Tail cone
    const noseGeo = trackGeo(new THREE.ConeGeometry(fuseR, 5.4 * scale, 16));
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, whiteGlossMat);
    nose.position.set(0, 3.12 * scale, fuseLen / 2 + 2.65 * scale);
    nose.castShadow = true;

    const tailConeGeo = trackGeo(new THREE.ConeGeometry(fuseR * 0.92, 6.8 * scale, 16));
    tailConeGeo.rotateX(-Math.PI / 2);
    const tailCone = new THREE.Mesh(tailConeGeo, whiteGlossMat);
    tailCone.position.set(0, 3.28 * scale, -fuseLen / 2 - 3.35 * scale);

    // Cockpit wrap-around windshield
    const cockpit = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.1 * scale, 0.85 * scale, 1.9 * scale)),
      cockpitGlassMat
    );
    cockpit.position.set(0, 3.95 * scale, fuseLen / 2 + 0.65 * scale);
    cockpit.rotation.x = 0.28;

    // Cheatline livery stripe
    const stripe = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(fuseR * 2.04, 0.42 * scale, fuseLen * 0.92)),
      liveryMat
    );
    stripe.position.set(0, 3.15 * scale, 0);

    // Swept Main Wings (Left & Right) + Winglets
    const wingSpanHalf = 15.5 * scale;
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 3.6 * scale);
    wingShape.lineTo(wingSpanHalf, -2.8 * scale);
    wingShape.lineTo(wingSpanHalf, -4.6 * scale);
    wingShape.lineTo(0, -1.6 * scale);
    wingShape.closePath();

    const wingGeo = trackGeo(
      new THREE.ExtrudeGeometry(wingShape, { depth: 0.36 * scale, bevelEnabled: false })
    );
    wingGeo.rotateX(-Math.PI / 2);
    const wingR = new THREE.Mesh(wingGeo, steelSilverMat);
    wingR.position.set(fuseR * 0.55, 2.35 * scale, 0.5 * scale);
    wingR.castShadow = true;

    const wingL = wingR.clone();
    wingL.scale.x = -1;
    wingL.position.x = -fuseR * 0.55;

    // Winglets
    const wingletGeo = trackGeo(new THREE.BoxGeometry(0.18 * scale, 1.65 * scale, 1.45 * scale));
    const wlR = new THREE.Mesh(wingletGeo, liveryMat);
    wlR.position.set(fuseR * 0.55 + wingSpanHalf - 0.1 * scale, 3.1 * scale, -3.1 * scale);
    wlR.rotation.z = -0.22;
    const wlL = wlR.clone();
    wlL.position.x = -wlR.position.x;
    wlL.rotation.z = 0.22;

    // Wingtip Nav Lights
    const navGeo = trackGeo(new THREE.SphereGeometry(0.22 * scale, 8, 8));
    const navPort = new THREE.Mesh(navGeo, navRedMat);
    navPort.position.set(-wlR.position.x, 2.45 * scale, -3.1 * scale);
    const navStbd = new THREE.Mesh(navGeo, navGreenMat);
    navStbd.position.set(wlR.position.x, 2.45 * scale, -3.1 * scale);

    // Vertical Tail Stabilizer + Rudder Livery
    const vTailShape = new THREE.Shape();
    vTailShape.moveTo(0, 0);
    vTailShape.lineTo(4.6 * scale, 0);
    vTailShape.lineTo(2.4 * scale, 6.2 * scale);
    vTailShape.lineTo(-0.4 * scale, 6.2 * scale);
    vTailShape.closePath();
    const vTailGeo = trackGeo(
      new THREE.ExtrudeGeometry(vTailShape, { depth: 0.32 * scale, bevelEnabled: false })
    );
    vTailGeo.rotateY(Math.PI / 2);
    const vTail = new THREE.Mesh(vTailGeo, liveryMat);
    vTail.position.set(-0.16 * scale, 4.3 * scale, -fuseLen / 2 + 1.2 * scale);
    vTail.castShadow = true;

    // Horizontal Tailplanes
    const hTailGeo = trackGeo(new THREE.BoxGeometry(10.6 * scale, 0.22 * scale, 2.4 * scale));
    const hTail = new THREE.Mesh(hTailGeo, steelSilverMat);
    hTail.position.set(
      0,
      isJet ? 9.8 * scale : 3.8 * scale,
      -fuseLen / 2 - 1.9 * scale
    );

    // Turbofan Engines (Under-wing for Airliner; Rear-fuselage twin pods for BizJet)
    const engCowlingGeo = trackGeo(new THREE.CylinderGeometry(0.92 * scale, 0.85 * scale, 3.6 * scale, 14));
    engCowlingGeo.rotateX(Math.PI / 2);
    const engIntakeGeo = trackGeo(new THREE.CylinderGeometry(0.75 * scale, 0.75 * scale, 0.25 * scale, 12));
    engIntakeGeo.rotateX(Math.PI / 2);

    const engPositions: [number, number, number][] = isJet
      ? [
          [-2.35 * scale, 3.85 * scale, -fuseLen / 2 + 1.5 * scale],
          [2.35 * scale, 3.85 * scale, -fuseLen / 2 + 1.5 * scale],
        ]
      : [
          [-5.8 * scale, 1.55 * scale, 2.2 * scale],
          [5.8 * scale, 1.55 * scale, 2.2 * scale],
        ];
    engPositions.forEach(([ex, ey, ez]) => {
      const cowl = new THREE.Mesh(engCowlingGeo, whiteGlossMat);
      cowl.position.set(ex, ey, ez);
      cowl.castShadow = true;
      const intake = new THREE.Mesh(engIntakeGeo, steelDarkMat);
      intake.position.set(ex, ey, ez + 1.75 * scale);
      const lip = new THREE.Mesh(engIntakeGeo, steelSilverMat);
      lip.position.set(ex, ey, ez + 1.82 * scale);
      plane.add(cowl, intake, lip);
    });

    // Landing Gear Assembly (Nose + Dual Main Bogies)
    const gearGroup = new THREE.Group();
    const strutGeo = trackGeo(new THREE.CylinderGeometry(0.14 * scale, 0.14 * scale, 1.65 * scale, 8));
    const tireGeo = trackGeo(new THREE.CylinderGeometry(0.45 * scale, 0.45 * scale, 0.34 * scale, 12));
    tireGeo.rotateZ(Math.PI / 2);
    const gearCoords: [number, number][] = [
      [0, fuseLen / 2 - 1.2 * scale],
      [-2.6 * scale, -0.8 * scale],
      [2.6 * scale, -0.8 * scale],
    ];
    gearCoords.forEach(([gx, gz]) => {
      const strut = new THREE.Mesh(strutGeo, steelSilverMat);
      strut.position.set(gx, 0.92 * scale, gz);
      const wheelL = new THREE.Mesh(tireGeo, jetNavyMat);
      wheelL.position.set(gx - 0.25 * scale, 0.45 * scale, gz);
      const wheelR = new THREE.Mesh(tireGeo, jetNavyMat);
      wheelR.position.set(gx + 0.25 * scale, 0.45 * scale, gz);
      gearGroup.add(strut, wheelL, wheelR);
    });

    plane.add(
      fuselage,
      nose,
      tailCone,
      cockpit,
      stripe,
      wingR,
      wingL,
      wlR,
      wlL,
      navPort,
      navStbd,
      vTail,
      hTail,
      gearGroup
    );
    return { plane, gearGroup };
  };

  // =========================================================================
  // 1. MURTALA MUHAMMED INTERNATIONAL AIRPORT (MMIA - MAINLAND NEAR IKEJA)
  // =========================================================================
  let rotatingRadarMesh: THREE.Group | null = null;
  let animatedAirliner: { plane: THREE.Group; gearGroup: THREE.Group } | null = null;

  {
    const minX = 165 * S;
    const maxX = 600 * S;
    const minZ = -1420 * S;
    const maxZ = -960 * S;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const compW = maxX - minX;
    const compD = maxZ - minZ;

    // Wide Airport Concrete Apron & Tarmac Base Pad
    const tarmacPad = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(compW, compD)),
      apronMat
    );
    tarmacPad.rotation.x = -Math.PI / 2;
    tarmacPad.position.set(centerX, 0.008, centerZ);
    tarmacPad.receiveShadow = true;
    cityGroup.add(tarmacPad);

    // Clear grassy infield strips between apron/taxiway and Runway 01L/19R
    const infieldGrass = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(36 * S, 360 * S)),
      texPack.medianGrassMat
    );
    infieldGrass.rotation.x = -Math.PI / 2;
    infieldGrass.position.set(418 * S, 0.012, -1190 * S);
    infieldGrass.receiveShadow = true;
    cityGroup.add(infieldGrass);

    // Long Illuminated Runway 01L / 19R at x = 465*S, z = -1395*S .. -980*S
    const rwX = 465 * S;
    const rwLen = 415 * S;
    const rwWidth = 46;
    const rwCenterZ = (-1395 * S + -980 * S) / 2;

    const runwayMesh = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(rwWidth, rwLen)),
      runwayMat
    );
    runwayMesh.rotation.x = -Math.PI / 2;
    runwayMesh.position.set(rwX, 0.016, rwCenterZ);
    runwayMesh.receiveShadow = true;
    cityGroup.add(runwayMesh);

    // Parallel Taxiway Alpha & 2 Connector Taxiways
    const taxiwayAlpha = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(20, 380 * S)),
      runwayMat
    );
    taxiwayAlpha.rotation.x = -Math.PI / 2;
    taxiwayAlpha.position.set(385 * S, 0.014, -1190 * S);
    cityGroup.add(taxiwayAlpha);

    [-1375 * S, -1005 * S].forEach((tz) => {
      const crossTaxi = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(84 * S, 18)),
        runwayMat
      );
      crossTaxi.rotation.x = -Math.PI / 2;
      crossTaxi.position.set(424 * S, 0.015, tz);
      cityGroup.add(crossTaxi);
    });

    // Instanced Runway Centerline Stripes + Threshold Piano Keys + Edge Lights
    const stripePositions: number[] = [];
    for (let z = -1382 * S; z <= -993 * S; z += 18) {
      stripePositions.push(z);
    }
    const rwStripeGeo = trackGeo(new THREE.PlaneGeometry(1.1, 10.0));
    rwStripeGeo.rotateX(-Math.PI / 2);
    const rwStripeInst = new THREE.InstancedMesh(rwStripeGeo, texPack.whiteMarkMat, stripePositions.length);
    const rwDummy = new THREE.Object3D();
    stripePositions.forEach((sz, idx) => {
      rwDummy.position.set(rwX, 0.025, sz);
      rwDummy.rotation.set(0, 0, 0);
      rwDummy.scale.set(1, 1, 1);
      rwDummy.updateMatrix();
      rwStripeInst.setMatrixAt(idx, rwDummy.matrix);
    });
    rwStripeInst.computeBoundingSphere();
    cityGroup.add(rwStripeInst);

    // Runway Threshold Piano Keys (South 01L & North 19R)
    const keyGeo = trackGeo(new THREE.PlaneGeometry(1.8, 12.0));
    keyGeo.rotateX(-Math.PI / 2);
    const keyInst = new THREE.InstancedMesh(keyGeo, texPack.whiteMarkMat, 16);
    let kIdx = 0;
    [-1390 * S, -985 * S].forEach((kz) => {
      [-17, -12, -7, -2, 2, 7, 12, 17].forEach((kx) => {
        rwDummy.position.set(rwX + kx, 0.025, kz);
        rwDummy.updateMatrix();
        keyInst.setMatrixAt(kIdx++, rwDummy.matrix);
      });
    });
    keyInst.computeBoundingSphere();
    cityGroup.add(keyInst);

    // Runway Edge Lights (InstancedMesh)
    const edgeLightGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.35, 0.42));
    const edgeZList: number[] = [];
    for (let z = -1392 * S; z <= -982 * S; z += 22) {
      edgeZList.push(z);
    }
    const edgeLightInst = new THREE.InstancedMesh(
      edgeLightGeo,
      texPack.streetlightBulbMat,
      edgeZList.length * 2
    );
    let elIdx = 0;
    edgeZList.forEach((ez) => {
      [-rwWidth / 2 + 0.8, rwWidth / 2 - 0.8].forEach((ex) => {
        rwDummy.position.set(rwX + ex, 0.18, ez);
        rwDummy.updateMatrix();
        edgeLightInst.setMatrixAt(elIdx++, rwDummy.matrix);
      });
    });
    edgeLightInst.computeBoundingSphere();
    cityGroup.add(edgeLightInst);

    // PAPI Approach Lights (South & North Thresholds)
    [-1365 * S, -1010 * S].forEach((pz) => {
      for (let i = 0; i < 4; i++) {
        const papi = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.8, 0.45, 0.6)),
          i < 2 ? papiRedMat : whiteGlossMat
        );
        papi.position.set(rwX - rwWidth / 2 - 5.5 - i * 2.2, 0.25, pz);
        cityGroup.add(papi);
      }
    });

    // Taxiway Blue Edge Markers
    const taxiMarkerGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.38, 6));
    const taxiMarkerZ: number[] = [];
    for (let z = -1370 * S; z <= -1005 * S; z += 26) taxiMarkerZ.push(z);
    const taxiMarkerInst = new THREE.InstancedMesh(taxiMarkerGeo, taxiBlueMat, taxiMarkerZ.length * 2);
    let tmIdx = 0;
    taxiMarkerZ.forEach((tz) => {
      [-10.6, 10.6].forEach((tx) => {
        rwDummy.position.set(385 * S + tx, 0.19, tz);
        rwDummy.updateMatrix();
        taxiMarkerInst.setMatrixAt(tmIdx++, rwDummy.matrix);
      });
    });
    taxiMarkerInst.computeBoundingSphere();
    cityGroup.add(taxiMarkerInst);

    // Airport International Terminal Building (clear north of Terminal Forecourt road)
    const terminalBox: BuildingBox = {
      id: 'B_MMIA_TERMINAL',
      x: 292 * S,
      z: -992 * S,
      width: 68,
      depth: 26,
      height: 18,
      name: 'Murtala Muhammed International Terminal',
      type: 'tech_hub',
      color: 0x0f172a,
      roofColor: 0x0284c7,
      hasSign: true,
      signText: 'MURTALA MUHAMMED INTL AIRPORT',
    };
    allCollidableBuildings.push(terminalBox);
    buildCompositeBuilding(terminalBox);

    // Passenger Boarding Jetbridges extending from Terminal to Apron
    [-20, 0, 20].forEach((jx) => {
      const bridge = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(3.4, 2.8, 16)),
        steelSilverMat
      );
      bridge.position.set(292 * S + jx, 5.2, -992 * S - 20);
      bridge.castShadow = true;
      cityGroup.add(bridge);
    });

    // Tall Visible ATC Control Tower (at [295*S, 0, -1180*S])
    {
      const atcX = 295 * S;
      const atcZ = -1180 * S;
      const atcGroup = new THREE.Group();
      atcGroup.position.set(atcX, 0, atcZ);

      const podium = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(16, 7.5, 16)), concreteMat);
      podium.position.y = 3.75;
      podium.castShadow = true;
      podium.receiveShadow = true;

      const shaft = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(3.2, 4.4, 44, 12)), concreteMat);
      shaft.position.y = 29.5;
      shaft.castShadow = true;

      const collar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(6.8, 3.8, 3.2, 16)), steelDarkMat);
      collar.position.y = 51.5;

      const cab = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(7.6, 6.4, 5.2, 16)), glassCabMat);
      cab.position.y = 55.5;

      const roof = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(8.2, 8.2, 1.2, 16)), steelSilverMat);
      roof.position.y = 58.6;
      roof.castShadow = true;

      // Rotating Airport Surveillance Radar Dome
      const radarSpinner = new THREE.Group();
      radarSpinner.position.y = 61.5;
      const mast = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.28, 0.35, 3.4, 8)), steelDarkMat);
      mast.position.y = -1.2;
      const dish = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.6, 1.4, 0.55)), jetGoldMat);
      dish.position.y = 0.6;
      const beacon = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.38, 8, 8)), navRedMat);
      beacon.position.set(0, 1.7, 0);
      radarSpinner.add(mast, dish, beacon);
      rotatingRadarMesh = radarSpinner;

      const atcTex = texPack.createSignTexture('MMIA CONTROL TOWER', 'MURTALA MUHAMMED INTL • LOS', {
        bg: '#082F49',
        border: '#38BDF8',
        accent: '#FDE047',
      });
      const atcSign = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(13.5, 2.8)),
        trackMat(new THREE.MeshBasicMaterial({ map: atcTex }))
      );
      atcSign.position.set(0, 11.2, 8.2);

      atcGroup.add(podium, shaft, collar, cab, roof, radarSpinner, atcSign);
      cityGroup.add(atcGroup);

      allCollidableBuildings.push({
        id: 'B_MMIA_ATC_TOWER',
        x: atcX,
        z: atcZ,
        width: 16,
        depth: 16,
        height: 62,
        name: 'MMIA Air Traffic Control Tower',
        type: 'tech_hub',
        color: 0x94a3b8,
        roofColor: 0x0f172a,
      });
    }

    // Two Giant Aircraft Hangars with Commercial Airliners Parked Inside
    [
      { x: 298 * S, z: -1325 * S, label: 'AIRCRAFT HANGAR 01', livery: blueLineMat },
      { x: 352 * S, z: -1325 * S, label: 'AIRCRAFT HANGAR 02', livery: jetRedMat },
    ].forEach((h, hIdx) => {
      const hg = new THREE.Group();
      hg.position.set(h.x, 0, h.z);

      const hW = 50;
      const hD = 44;
      const hH = 20;

      // Left, Right & Back structural hangar walls (Front +Z open so parked airliner is clearly visible!)
      const sideWallGeo = trackGeo(new THREE.BoxGeometry(1.8, hH, hD));
      const wallL = new THREE.Mesh(sideWallGeo, hangarRoofMat);
      wallL.position.set(-hW / 2 + 0.9, hH / 2, 0);
      wallL.castShadow = true;
      const wallR = wallL.clone();
      wallR.position.x = hW / 2 - 0.9;

      const backWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(hW, hH, 1.8)), hangarRoofMat);
      backWall.position.set(0, hH / 2, -hD / 2 + 0.9);
      backWall.castShadow = true;

      // Arched Steel Hangar Roof
      const roofGeo = trackGeo(new THREE.CylinderGeometry(hW / 2, hW / 2, hD, 16, 1, false, 0, Math.PI));
      roofGeo.rotateZ(Math.PI / 2);
      roofGeo.rotateY(Math.PI / 2);
      const roof = new THREE.Mesh(roofGeo, steelSilverMat);
      roof.position.set(0, hH - 2.0, 0);
      roof.scale.y = 0.28;
      roof.castShadow = true;

      // Retracted Front Hangar Sliding Doors + Facia Sign
      [-hW / 2 + 4.5, hW / 2 - 4.5].forEach((dx) => {
        const doorLeaf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8.0, hH - 2, 0.9)), steelDarkMat);
        doorLeaf.position.set(dx, (hH - 2) / 2, hD / 2 - 0.5);
        hg.add(doorLeaf);
      });

      const hTex = texPack.createSignTexture(h.label, 'MMIA LINE MAINTENANCE BAY', {
        bg: '#0F172A',
        border: '#38BDF8',
        accent: '#FACC15',
      });
      const hSign = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(24, 3.4)),
        trackMat(new THREE.MeshBasicMaterial({ map: hTex }))
      );
      hSign.position.set(0, hH - 1.2, hD / 2 + 0.35);

      // Parked Commercial Airliner inside Hangar
      const { plane } = buildAircraftMesh('AIRLINER', h.livery);
      plane.position.set(0, 0, -2.5);
      plane.rotation.y = 0; // Facing out of the hangar toward taxiway/apron (+Z)

      hg.add(wallL, wallR, backWall, roof, hSign, plane);
      cityGroup.add(hg);

      // Register Hangar structural walls as barriers so player cannot clip through side/back walls
      addBarricade(`HANGAR_${hIdx}_L`, h.x - hW / 2 + 0.9, 0, h.z, 1.0, hD / 2, 0, 'WALL');
      addBarricade(`HANGAR_${hIdx}_R`, h.x + hW / 2 - 0.9, 0, h.z, 1.0, hD / 2, 0, 'WALL');
      addBarricade(`HANGAR_${hIdx}_B`, h.x, 0, h.z - hD / 2 + 0.9, hW / 2, 1.0, 0, 'WALL');
    });

    // Separate Private Jet Terminal & Parked Business Jets Section (near Gate 2: x=190..265*S, z=-1170..-1275*S)
    {
      const fboBox: BuildingBox = {
        id: 'B_MMIA_PRIVATE_FBO',
        x: 205 * S,
        z: -1175 * S,
        width: 26,
        depth: 18,
        height: 11,
        name: 'MMIA Executive Private Jet Lounge',
        type: 'commercial',
        color: 0xf8fafc,
        roofColor: 0xf59e0b,
        hasSign: true,
        signText: 'PRIVATE JET TERMINAL',
      };
      allCollidableBuildings.push(fboBox);
      buildCompositeBuilding(fboBox);

      const jetStands: { x: number; z: number; yaw: number; livery: THREE.Material }[] = [
        { x: 242 * S, z: -1185 * S, yaw: Math.PI * 0.12, livery: jetGoldMat },
        { x: 242 * S, z: -1225 * S, yaw: Math.PI * 0.12, livery: jetNavyMat },
        { x: 242 * S, z: -1265 * S, yaw: Math.PI * 0.12, livery: jetRedMat },
      ];
      jetStands.forEach((js, jIdx) => {
        const { plane } = buildAircraftMesh('BIZJET', js.livery);
        plane.position.set(js.x, 0, js.z);
        plane.rotation.y = js.yaw;
        cityGroup.add(plane);
        addBarricade(`MMIA_BIZJET_${jIdx}`, js.x, 0, js.z, 7.2, 8.5, js.yaw, 'SHELTER');
      });
    }

    // Perimeter Security Fencing (InstancedMesh + Colliders) with TWO Big Drivable Gates
    // Gate 1 (Main Terminal): South Fence z = maxZ (-960*S), open around x = 240*S +/- 18
    // Gate 2 (Executive Jets): West Fence x = minX (165*S), open around z = -1080*S +/- 18
    const gate1X = 240 * S;
    const gate2Z = -1080 * S;
    const gateHalfGap = 18.0;

    const buildGateArch = (
      x: number,
      z: number,
      yaw: number,
      title: string,
      subtitle: string,
      tag: string
    ) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = yaw;

      const pL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.2, 9.6, 2.4)), steelDarkMat);
      pL.position.set(-18.5, 4.8, 0);
      pL.castShadow = true;
      const pR = pL.clone();
      pR.position.x = 18.5;

      const beam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(39.4, 2.2, 2.4)), blueLineMat);
      beam.position.set(0, 9.2, 0);
      beam.castShadow = true;

      const signTex = texPack.createSignTexture(title, subtitle, {
        bg: '#071A2B',
        border: '#38BDF8',
        accent: '#FACC15',
      });
      const signF = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(24, 2.2)),
        trackMat(new THREE.MeshBasicMaterial({ map: signTex }))
      );
      signF.position.set(0, 9.2, 1.25);
      const signB = signF.clone();
      signB.position.z = -1.25;
      signB.rotation.y = Math.PI;

      // Gatehouse guard booth
      const booth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.4, 3.2, 3.4)), whiteGlossMat);
      booth.position.set(-22.2, 1.6, 0);

      g.add(pL, pR, beam, signF, signB, booth);
      cityGroup.add(g);

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      addBarricade(`${tag}_L`, x - 18.5 * cosY, 0, z + 18.5 * sinY, 1.2, 1.2, yaw, 'GANTRY_PILLAR');
      addBarricade(`${tag}_R`, x + 18.5 * cosY, 0, z - 18.5 * sinY, 1.2, 1.2, yaw, 'GANTRY_PILLAR');
    };

    buildGateArch(
      gate1X,
      maxZ,
      0,
      'MURTALA MUHAMMED INTL AIRPORT',
      'GATE 1 • MAIN TERMINAL & DEPARTURES',
      'MMIA_GATE1'
    );
    buildGateArch(
      minX,
      gate2Z,
      Math.PI / 2,
      'MMIA EXECUTIVE AVIATION',
      'GATE 2 • PRIVATE JETS & HANGARS',
      'MMIA_GATE2'
    );

    // Instanced Perimeter Fence Posts + Panels
    const fenceSegments: { ax: number; az: number; bx: number; bz: number }[] = [
      // South wall (split by Gate 1)
      { ax: minX, az: maxZ, bx: gate1X - gateHalfGap, bz: maxZ },
      { ax: gate1X + gateHalfGap, az: maxZ, bx: maxX, bz: maxZ },
      // West wall (split by Gate 2)
      { ax: minX, az: minZ, bx: minX, bz: gate2Z - gateHalfGap },
      { ax: minX, az: gate2Z + gateHalfGap, bx: minX, bz: maxZ },
      // North wall & East wall
      { ax: minX, az: minZ, bx: maxX, bz: minZ },
      { ax: maxX, az: minZ, bx: maxX, bz: maxZ },
    ];

    const fencePosts: { x: number; z: number }[] = [];
    const fenceSpans: { x: number; z: number; len: number; yaw: number }[] = [];

    fenceSegments.forEach((seg, segIdx) => {
      const dx = seg.bx - seg.ax;
      const dz = seg.bz - seg.az;
      const len = Math.hypot(dx, dz);
      if (len < 2) return;
      const yaw = Math.atan2(dx, dz);
      const midX = (seg.ax + seg.bx) / 2;
      const midZ = (seg.az + seg.bz) / 2;

      addBarricade(
        `MMIA_FENCE_${segIdx}`,
        midX,
        0,
        midZ,
        Math.abs(dx) > Math.abs(dz) ? len / 2 : 0.65,
        Math.abs(dx) > Math.abs(dz) ? 0.65 : len / 2,
        0,
        'WALL'
      );

      const step = 8.0;
      const count = Math.max(1, Math.floor(len / step));
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        fencePosts.push({ x: seg.ax + dx * t, z: seg.az + dz * t });
        if (i < count) {
          const tn = (i + 0.5) / count;
          fenceSpans.push({
            x: seg.ax + dx * tn,
            z: seg.az + dz * tn,
            len: len / count,
            yaw,
          });
        }
      }
    });

    if (fencePosts.length > 0) {
      const postGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.14, 3.8, 6));
      postGeo.translate(0, 1.9, 0);
      const postInst = new THREE.InstancedMesh(postGeo, steelSilverMat, fencePosts.length);
      const fd = new THREE.Object3D();
      fencePosts.forEach((fp, i) => {
        fd.position.set(fp.x, 0, fp.z);
        fd.rotation.set(0, 0, 0);
        fd.scale.set(1, 1, 1);
        fd.updateMatrix();
        postInst.setMatrixAt(i, fd.matrix);
      });
      postInst.computeBoundingSphere();
      cityGroup.add(postInst);
    }

    if (fenceSpans.length > 0) {
      const meshPanelGeo = trackGeo(new THREE.BoxGeometry(0.18, 2.8, 1.0));
      meshPanelGeo.translate(0, 1.65, 0);
      const panelInst = new THREE.InstancedMesh(meshPanelGeo, steelDarkMat, fenceSpans.length);
      const barGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.16, 1.0));
      barGeo.translate(0, 3.35, 0);
      const barInst = new THREE.InstancedMesh(barGeo, jetGoldMat, fenceSpans.length);

      const fd = new THREE.Object3D();
      fenceSpans.forEach((fs, i) => {
        fd.position.set(fs.x, 0, fs.z);
        fd.rotation.set(0, fs.yaw, 0);
        fd.scale.set(1, 1, fs.len);
        fd.updateMatrix();
        panelInst.setMatrixAt(i, fd.matrix);
        barInst.setMatrixAt(i, fd.matrix);
      });
      panelInst.computeBoundingSphere();
      barInst.computeBoundingSphere();
      cityGroup.add(panelInst, barInst);
    }

    // Active Commercial Airliner (Taxiing -> Takeoff -> Climb -> Approach & Touchdown)
    animatedAirliner = buildAircraftMesh('AIRLINER', jetRedMat);
    animatedAirliner.plane.rotation.order = 'YXZ';
    cityGroup.add(animatedAirliner.plane);
  }

  // =========================================================================
  // 2. MARINA HIGHRISE FINANCIAL CANYON (UBA BANK TALLEST, WEMA BANK, UAC HOUSE)
  // =========================================================================
  {
    const marinaTowers: BuildingBox[] = [
      // Tallest Marina Skyscraper: UBA Bank House (98m)
      {
        id: 'B_MARINA_UBA',
        x: 78,
        z: 150,
        width: 24,
        depth: 24,
        height: 98,
        name: 'UBA Bank Head Office Marina',
        type: 'bank',
        color: 0x991b1b,
        roofColor: 0xdc2626,
        hasSign: true,
        signText: 'UBA BANK PLC (HEADQUARTERS)',
      },
      // Wema Bank Tower
      {
        id: 'B_MARINA_WEMA',
        x: 64,
        z: 218,
        width: 22,
        depth: 20,
        height: 62,
        name: 'Wema Bank Tower Marina',
        type: 'bank',
        color: 0x3b0764,
        roofColor: 0x9333ea,
        hasSign: true,
        signText: 'WEMA BANK TOWER',
      },
      // UAC House Marina
      {
        id: 'B_MARINA_UAC',
        x: 132,
        z: 150,
        width: 22,
        depth: 20,
        height: 64,
        name: 'UAC House Marina',
        type: 'commercial',
        color: 0x1e293b,
        roofColor: 0x0284c7,
        hasSign: true,
        signText: 'UAC HOUSE MARINA',
      },
      // Tightly clustered neighboring highrises along Marina Financial Row
      {
        id: 'B_MARINA_TOWER_N1',
        x: 56,
        z: 150,
        width: 22,
        depth: 22,
        height: 70,
        name: 'Marina Commerce Plaza',
        type: 'tech_hub',
        color: 0x0f172a,
        roofColor: 0x38bdf8,
        hasSign: true,
        signText: 'MARINA COMMERCE PLAZA',
      },
      {
        id: 'B_MARINA_TOWER_N2',
        x: 34,
        z: 150,
        width: 20,
        depth: 20,
        height: 54,
        name: 'Sterling Maritime House',
        type: 'bank',
        color: 0x1e293b,
        roofColor: 0xf59e0b,
        hasSign: false,
      },
      {
        id: 'B_MARINA_TOWER_S1',
        x: 132,
        z: 218,
        width: 22,
        depth: 20,
        height: 58,
        name: 'CMS Financial Exchange',
        type: 'bank',
        color: 0x0f172a,
        roofColor: 0x10b981,
        hasSign: true,
        signText: 'CMS FINANCIAL HOUSE',
      },
      {
        id: 'B_MARINA_TOWER_S2',
        x: 92,
        z: 218,
        width: 22,
        depth: 20,
        height: 74,
        name: 'Lagos House Marina',
        type: 'tech_hub',
        color: 0x1e293b,
        roofColor: 0x0ea5e9,
        hasSign: true,
        signText: 'LAGOS HOUSE MARINA',
      },
      {
        id: 'B_MARINA_TOWER_S3',
        x: 38,
        z: 218,
        width: 20,
        depth: 20,
        height: 50,
        name: 'National Assurance Tower',
        type: 'bank',
        color: 0x334155,
        roofColor: 0xf59e0b,
        hasSign: false,
      },
      {
        id: 'B_MARINA_TOWER_S4',
        x: 12,
        z: 218,
        width: 22,
        depth: 20,
        height: 66,
        name: 'Marina Waterfront Tower',
        type: 'tech_hub',
        color: 0x0f172a,
        roofColor: 0xef4444,
        hasSign: true,
        signText: 'MARINA WATERFRONT TOWER',
      },
      {
        id: 'B_MARINA_TOWER_S5',
        x: -24,
        z: 218,
        width: 22,
        depth: 20,
        height: 52,
        name: 'Atlantic Trade House',
        type: 'bank',
        color: 0x1e293b,
        roofColor: 0x38bdf8,
        hasSign: false,
      },
      {
        id: 'B_MARINA_TOWER_S6',
        x: -56,
        z: 218,
        width: 22,
        depth: 20,
        height: 46,
        name: 'Apongbon Maritime Suites',
        type: 'commercial',
        color: 0x334155,
        roofColor: 0xf59e0b,
        hasSign: false,
      },
    ];

    marinaTowers.forEach((b) => {
      const scaled: BuildingBox = { ...b, x: b.x * S, z: b.z * S };
      const clearMargin = Math.max(scaled.width, scaled.depth) / 2 + 15.0;
      if (distToNearestRoad(scaled.x, scaled.z) < clearMargin) return;
      allCollidableBuildings.push(scaled);
      buildCompositeBuilding(scaled);
    });

    // Illuminated UBA Crown Beacon Sign atop UBA Bank House (tallest tower in Marina)
    const ubaCrown = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(20, 4.2, 20)),
      jetRedMat
    );
    ubaCrown.position.set(78 * S, 99.5, 150 * S);
    const ubaTex = texPack.createSignTexture('UBA', 'UNITED BANK FOR AFRICA • MARINA', {
      bg: '#991B1B',
      border: '#FFFFFF',
      accent: '#FACC15',
    });
    const ubaSignMat = trackMat(new THREE.MeshBasicMaterial({ map: ubaTex }));
    const ubaCrownSignF = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(18.5, 3.6)), ubaSignMat);
    ubaCrownSignF.position.set(78 * S, 99.5, 150 * S + 10.2);
    const ubaCrownSignB = ubaCrownSignF.clone();
    ubaCrownSignB.position.z = 150 * S - 10.2;
    ubaCrownSignB.rotation.y = Math.PI;
    cityGroup.add(ubaCrown, ubaCrownSignF, ubaCrownSignB);
  }

  // =========================================================================
  // 3. GIGANTIC MARINA STATION + BLUE LINE ELEVATED RAIL -> MILE 2 -> IYANOBA
  // =========================================================================
  let railCurve: THREE.CatmullRomCurve3 | null = null;
  let trainCars: THREE.Group[] = [];
  let mile2U = 0.54;

  {
    const DECK_Y = 7.6;

    // A. Gigantic Marina Blue Line Terminus Station (x = -148*S, z = 185*S)
    const mStX = -148 * S;
    const mStZ = 185 * S;
    const stGroup = new THREE.Group();
    stGroup.position.set(mStX, 0, mStZ);

    // Ground level concourse base + entrance lobby
    const baseHall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(46, 6.8, 30)), steelDarkMat);
    baseHall.position.y = 3.4;
    baseHall.castShadow = true;
    baseHall.receiveShadow = true;

    // 2nd Floor Elevated Rail Platform & Glass Atrium (directly connected to Elevated Rail Bridge!)
    const upperHall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(58, 5.4, 34)), texPack.glassTowerMat);
    upperHall.position.y = 9.5;
    upperHall.castShadow = true;

    // Vaulted Curved Station Roof Canopy
    const stRoofGeo = trackGeo(
      new THREE.CylinderGeometry(18, 18, 62, 16, 1, false, 0, Math.PI)
    );
    stRoofGeo.rotateZ(Math.PI / 2);
    const stRoof = new THREE.Mesh(stRoofGeo, blueLineMat);
    stRoof.position.set(0, 12.2, 0);
    stRoof.scale.y = 0.25;
    stRoof.castShadow = true;

    // Glowing Blue Line Station Header Signs (North, South & East Plaza facing Marina Road)
    const mStTex = texPack.createSignTexture(
      'MARINA RAIL STATION',
      'BLUE LINE ELEVATED  •  MILE 2 & IYANOBA',
      { bg: '#071A2B', border: '#38BDF8', accent: '#FACC15' }
    );
    const mStSignMat = trackMat(new THREE.MeshBasicMaterial({ map: mStTex }));
    const signEast = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(24, 3.8)), mStSignMat);
    signEast.position.set(23.3, 10.2, 0);
    signEast.rotation.y = Math.PI / 2;
    const signNorth = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(26, 3.8)), mStSignMat);
    signNorth.position.set(0, 10.2, -17.3);
    signNorth.rotation.y = Math.PI;
    const signSouth = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(26, 3.8)), mStSignMat);
    signSouth.position.set(0, 10.2, 17.3);

    stGroup.add(baseHall, upperHall, stRoof, signEast, signNorth, signSouth);
    cityGroup.add(stGroup);

    allCollidableBuildings.push({
      id: 'B_MARINA_RAIL_STATION',
      x: mStX,
      z: mStZ,
      width: 48,
      depth: 32,
      height: 16,
      name: 'Marina Blue Line Rail Station',
      type: 'tech_hub',
      color: 0x0284c7,
      roofColor: 0x38bdf8,
    });

    // B. Continuous Elevated Blue Line Rail Bridge (2nd floor of Marina -> Western Lagoon -> Mile 2 -> Iyanoba)
    const railWaypoints = [
      new THREE.Vector3(-152 * S, DECK_Y, 185 * S), // Connected into Marina Station 2nd floor
      new THREE.Vector3(-290 * S, DECK_Y, 176 * S),
      new THREE.Vector3(-435 * S, DECK_Y, 72 * S),
      new THREE.Vector3(-455 * S, DECK_Y, -145 * S), // Western Lagoon crossing (far west of TMB x=0!)
      new THREE.Vector3(-455 * S, DECK_Y, -410 * S),
      new THREE.Vector3(-455 * S, DECK_Y, -596 * S), // Mile 2 Station elevated dock
      new THREE.Vector3(-540 * S, DECK_Y, -568 * S), // Along Badagry shore cleanly south of LASU fence
      new THREE.Vector3(-1010 * S, DECK_Y, -568 * S),
      new THREE.Vector3(-1160 * S, DECK_Y, -606 * S), // Iyanoba Terminus Station
    ];
    railCurve = new THREE.CatmullRomCurve3(railWaypoints, false, 'catmullrom', 0.25);

    // Find exact curve u parameter closest to Mile 2 Station (-455*S, DECK_Y, -596*S)
    const mile2Target = new THREE.Vector3(-455 * S, DECK_Y, -596 * S);
    let bestMile2Dist = Infinity;
    for (let i = 0; i <= 200; i++) {
      const u = i / 200;
      const pt = railCurve.getPointAt(u);
      const d = pt.distanceTo(mile2Target);
      if (d < bestMile2Dist) {
        bestMile2Dist = d;
        mile2U = u;
      }
    }

    // Extruded Elevated Rail Viaduct Deck along curve
    const deckShape = new THREE.Shape();
    // Cross-section extruded along curve (in ExtrudeGeometry, shape X = up/down, Y = left/right)
    deckShape.moveTo(-1.1, -5.2);
    deckShape.lineTo(0.0, -5.2);
    deckShape.lineTo(0.0, -4.6);
    deckShape.lineTo(-0.3, -4.6);
    deckShape.lineTo(-0.3, 4.6);
    deckShape.lineTo(0.0, 4.6);
    deckShape.lineTo(0.0, 5.2);
    deckShape.lineTo(-1.1, 5.2);
    deckShape.closePath();

    const deckGeo = trackGeo(
      new THREE.ExtrudeGeometry(deckShape, {
        steps: 190,
        bevelEnabled: false,
        extrudePath: railCurve,
      })
    );
    const deckMesh = new THREE.Mesh(deckGeo, concreteMat);
    deckMesh.castShadow = true;
    deckMesh.receiveShadow = true;
    cityGroup.add(deckMesh);

    // Left & Right Blue Line Safety Rails extruded above deck edges + Twin Steel Rails
    const totalLen = railCurve.getLength();
    const pierStep = 36;
    const numPiers = Math.floor(totalLen / pierStep);
    const pierPositions: { x: number; z: number; yaw: number }[] = [];

    const sleeperStep = 2.6;
    const numSleepers = Math.floor(totalLen / sleeperStep);
    const sleeperTransforms: { x: number; z: number; yaw: number }[] = [];

    for (let i = 2; i < numPiers; i++) {
      const u = i / numPiers;
      const pt = railCurve.getPointAt(u);
      const tan = railCurve.getTangentAt(u);
      // Skip piers on ground roads
      if (distToNearestRoad(pt.x, pt.z) < 18.5) continue;
      pierPositions.push({ x: pt.x, z: pt.z, yaw: Math.atan2(tan.x, tan.z) });
    }

    for (let i = 0; i <= numSleepers; i++) {
      const u = i / numSleepers;
      const pt = railCurve.getPointAt(u);
      const tan = railCurve.getTangentAt(u);
      sleeperTransforms.push({ x: pt.x, z: pt.z, yaw: Math.atan2(tan.x, tan.z) });
    }

    if (pierPositions.length > 0) {
      const pierColGeo = trackGeo(new THREE.CylinderGeometry(1.15, 1.45, DECK_Y + 1.2, 10));
      pierColGeo.translate(0, (DECK_Y - 1.2) / 2, 0);
      const pierCapGeo = trackGeo(new THREE.BoxGeometry(9.6, 1.1, 2.4));
      pierCapGeo.translate(0, DECK_Y - 1.5, 0);

      const pierInst = new THREE.InstancedMesh(pierColGeo, concreteMat, pierPositions.length);
      const capInst = new THREE.InstancedMesh(pierCapGeo, steelDarkMat, pierPositions.length);
      const pd = new THREE.Object3D();

      pierPositions.forEach((pp, i) => {
        pd.position.set(pp.x, 0, pp.z);
        pd.rotation.set(0, pp.yaw, 0);
        pd.scale.set(1, 1, 1);
        pd.updateMatrix();
        pierInst.setMatrixAt(i, pd.matrix);
        capInst.setMatrixAt(i, pd.matrix);
        addBarricade(`BLUE_LINE_PIER_${i}`, pp.x, 0, pp.z, 1.4, 1.4, pp.yaw, 'GANTRY_PILLAR');
      });
      pierInst.computeBoundingSphere();
      capInst.computeBoundingSphere();
      cityGroup.add(pierInst, capInst);
    }

    if (sleeperTransforms.length > 0) {
      const sleeperGeo = trackGeo(new THREE.BoxGeometry(7.2, 0.22, 0.42));
      const railPieceGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.22, 2.7));
      const slInst = new THREE.InstancedMesh(sleeperGeo, steelDarkMat, sleeperTransforms.length);
      const railLInst = new THREE.InstancedMesh(railPieceGeo, steelSilverMat, sleeperTransforms.length);
      const railRInst = new THREE.InstancedMesh(railPieceGeo, steelSilverMat, sleeperTransforms.length);
      const blueEdgeGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.55, 2.65));
      const edgeLInst = new THREE.InstancedMesh(blueEdgeGeo, blueLineMat, sleeperTransforms.length);
      const edgeRInst = new THREE.InstancedMesh(blueEdgeGeo, blueLineMat, sleeperTransforms.length);

      const sd = new THREE.Object3D();
      sleeperTransforms.forEach((st, i) => {
        const rightX = Math.cos(st.yaw);
        const rightZ = -Math.sin(st.yaw);

        sd.position.set(st.x, DECK_Y - 0.15, st.z);
        sd.rotation.set(0, st.yaw, 0);
        sd.updateMatrix();
        slInst.setMatrixAt(i, sd.matrix);

        sd.position.set(st.x - rightX * 1.4, DECK_Y + 0.05, st.z - rightZ * 1.4);
        sd.updateMatrix();
        railLInst.setMatrixAt(i, sd.matrix);

        sd.position.set(st.x + rightX * 1.4, DECK_Y + 0.05, st.z + rightZ * 1.4);
        sd.updateMatrix();
        railRInst.setMatrixAt(i, sd.matrix);

        sd.position.set(st.x - rightX * 4.9, DECK_Y + 0.28, st.z - rightZ * 4.9);
        sd.updateMatrix();
        edgeLInst.setMatrixAt(i, sd.matrix);

        sd.position.set(st.x + rightX * 4.9, DECK_Y + 0.28, st.z + rightZ * 4.9);
        sd.updateMatrix();
        edgeRInst.setMatrixAt(i, sd.matrix);
      });

      slInst.computeBoundingSphere();
      railLInst.computeBoundingSphere();
      railRInst.computeBoundingSphere();
      edgeLInst.computeBoundingSphere();
      edgeRInst.computeBoundingSphere();
      cityGroup.add(slInst, railLInst, railRInst, edgeLInst, edgeRInst);
    }

    // C. Mile 2 & Iyanoba Elevated Blue Line Stations
    const buildElevatedStation = (
      x: number,
      z: number,
      yaw: number,
      title: string,
      subtitle: string,
      tag: string
    ) => {
      const sg = new THREE.Group();
      sg.position.set(x, 0, z);
      sg.rotation.y = yaw;

      // Ground support pillars flanking the deck
      [-14, 14].forEach((px, pIdx) => {
        [-7.5, 7.5].forEach((pz, zIdx) => {
          const col = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.4, 13.4, 1.4)), concreteMat);
          col.position.set(px, 6.7, pz);
          col.castShadow = true;
          sg.add(col);

          const sinY = Math.sin(yaw);
          const cosY = Math.cos(yaw);
          const wx = x + px * cosY + pz * sinY;
          const wz = z - px * sinY + pz * cosY;
          addBarricade(`${tag}_COL_${pIdx}_${zIdx}`, wx, 0, wz, 0.85, 0.85, yaw, 'GANTRY_PILLAR');
        });
      });

      // Side passenger platforms flanking elevated track at y = DECK_Y + 0.45
      [-6.8, 6.8].forEach((pz) => {
        const plat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(36, 1.0, 4.2)), concreteMat);
        plat.position.set(0, DECK_Y + 0.1, pz);
        plat.receiveShadow = true;
        sg.add(plat);
      });

      // Canopy roof over elevated station
      const canopy = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(38, 0.9, 17.5)), blueLineMat);
      canopy.position.set(0, DECK_Y + 6.2, 0);
      canopy.castShadow = true;

      const trim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(38.4, 0.3, 17.9)), blueLineTrimMat);
      trim.position.set(0, DECK_Y + 5.7, 0);

      const sTex = texPack.createSignTexture(title, subtitle, {
        bg: '#071A2B',
        border: '#38BDF8',
        accent: '#FACC15',
      });
      const sMat = trackMat(new THREE.MeshBasicMaterial({ map: sTex }));
      const sF = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(18, 2.4)), sMat);
      sF.position.set(0, DECK_Y + 6.6, 9.05);
      const sB = sF.clone();
      sB.position.z = -9.05;
      sB.rotation.y = Math.PI;

      sg.add(canopy, trim, sF, sB);
      cityGroup.add(sg);
    };

    buildElevatedStation(
      -455 * S,
      -596 * S,
      Math.PI / 2,
      'MILE 2 RAIL STATION',
      'LAGOS BLUE LINE • TRAIN STOP',
      'MILE2_ST'
    );
    buildElevatedStation(
      -1160 * S,
      -606 * S,
      0,
      'IYANOBA RAIL STATION',
      'LAGOS BLUE LINE • WESTERN TERMINUS',
      'IYANOBA_ST'
    );

    // D. Animated 5-Car Lagos Blue Line Electric Passenger Train
    const carBodyGeo = trackGeo(new THREE.BoxGeometry(3.4, 3.2, 13.8));
    const carWinGeo = trackGeo(new THREE.BoxGeometry(3.46, 1.1, 11.4));
    const carStripeGeo = trackGeo(new THREE.BoxGeometry(3.48, 0.35, 13.9));
    const carRoofGeo = trackGeo(new THREE.BoxGeometry(2.6, 0.45, 9.5));

    for (let c = 0; c < 5; c++) {
      const car = new THREE.Group();
      const shell = new THREE.Mesh(carBodyGeo, c === 0 || c === 4 ? blueLineMat : whiteGlossMat);
      shell.position.y = 1.85;
      shell.castShadow = true;

      const stripe = new THREE.Mesh(
        carStripeGeo,
        c === 0 || c === 4 ? whiteGlossMat : blueLineMat
      );
      stripe.position.y = 1.1;

      const windows = new THREE.Mesh(carWinGeo, cockpitGlassMat);
      windows.position.y = 2.25;

      const roofHvac = new THREE.Mesh(carRoofGeo, steelSilverMat);
      roofHvac.position.y = 3.6;

      car.add(shell, stripe, windows, roofHvac);
      if (c === 0) {
        const headGlow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.4, 0.4, 0.25)), navAmberMat);
        headGlow.position.set(0, 1.1, 6.95);
        car.add(headGlow);
      }
      if (c === 4) {
        const tailGlow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.4, 0.4, 0.25)), navRedMat);
        tailGlow.position.set(0, 1.1, -6.95);
        car.add(tailGlow);
      }
      cityGroup.add(car);
      trainCars.push(car);
    }
  }

  // =========================================================================
  // 4. IYANOBA LOW-RISE MAINLAND TOWN (1-2 FLOORS ONLY — ZERO HIGHRISES)
  // =========================================================================
  {
    const houses: { x: number; z: number; yaw: number; scaleX: number; scaleY: number; scaleZ: number; colorIdx: number }[] = [];
    let hSeed = 7731;
    const hRand = () => {
      hSeed = (hSeed * 1664525 + 1013904223) % 4294967296;
      return hSeed / 4294967296;
    };

    for (let x = -1300 * S; x <= -1015 * S; x += 26) {
      for (let z = -795 * S; z <= -615 * S; z += 26) {
        const hx = x + (hRand() - 0.5) * 6;
        const hz = z + (hRand() - 0.5) * 6;
        if (distToNearestRoad(hx, hz) < 17.5) continue;
        // Keep clear of Iyanoba Rail Station footprint
        if (Math.hypot(hx - -1160 * S, hz - -606 * S) < 32) continue;

        houses.push({
          x: hx,
          z: hz,
          yaw: Math.floor(hRand() * 4) * (Math.PI / 2),
          scaleX: 0.9 + hRand() * 0.45,
          scaleY: 0.85 + (hRand() > 0.68 ? 0.58 : 0.12), // 1 or 2 stories max (low-rise!)
          scaleZ: 0.9 + hRand() * 0.45,
          colorIdx: Math.floor(hRand() * 4),
        });
      }
    }

    if (houses.length > 0) {
      const wallGeo = trackGeo(new THREE.BoxGeometry(9.5, 4.2, 8.2));
      wallGeo.translate(0, 2.1, 0);
      const roofGeo = trackGeo(new THREE.ConeGeometry(7.2, 2.5, 4));
      roofGeo.rotateY(Math.PI / 4);
      roofGeo.translate(0, 5.4, 0);

      const wallMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf1ece1, roughness: 0.82 }));
      const roofMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.65 }));

      const wallInst = new THREE.InstancedMesh(wallGeo, wallMat, houses.length);
      wallInst.castShadow = true;
      wallInst.receiveShadow = true;
      const roofInst = new THREE.InstancedMesh(roofGeo, roofMat, houses.length);
      roofInst.castShadow = true;

      const hd = new THREE.Object3D();
      const wallPalette = [0xf5efe2, 0xfde68a, 0xe2e8f0, 0xfed7aa];
      const roofPalette = [0x9a3412, 0x065f46, 0x334155, 0x7c2d12];
      const wCol = new THREE.Color();
      const rCol = new THREE.Color();

      houses.forEach((h, i) => {
        hd.position.set(h.x, 0, h.z);
        hd.rotation.set(0, h.yaw, 0);
        hd.scale.set(h.scaleX, h.scaleY, h.scaleZ);
        hd.updateMatrix();
        wallInst.setMatrixAt(i, hd.matrix);
        roofInst.setMatrixAt(i, hd.matrix);

        wCol.setHex(wallPalette[h.colorIdx]);
        rCol.setHex(roofPalette[(h.colorIdx + 1) % roofPalette.length]);
        wallInst.setColorAt(i, wCol);
        roofInst.setColorAt(i, rCol);

        // Make every Iyanoba residential house 100% solid
        addBarricade(
          `IYANOBA_HOUSE_${i}`,
          h.x,
          0,
          h.z,
          4.85 * h.scaleX,
          4.2 * h.scaleZ,
          h.yaw,
          'WALL'
        );
      });

      wallInst.computeBoundingSphere();
      roofInst.computeBoundingSphere();
      if (wallInst.instanceColor) wallInst.instanceColor.needsUpdate = true;
      if (roofInst.instanceColor) roofInst.instanceColor.needsUpdate = true;
      cityGroup.add(wallInst, roofInst);
    }
  }

  // =========================================================================
  // 5. ZERO-ALLOCATION DYNAMIC WORLD ANIMATION (AIRCRAFT + BLUE LINE TRAIN)
  // =========================================================================
  const tmpTrainPos = new THREE.Vector3();
  const tmpTrainTan = new THREE.Vector3();

  // Blue Line Train State Machine (Marina <-> Mile 2 Stop <-> Iyanoba)
  let trainU = 0.08;
  let trainDir = 1; // +1 toward Iyanoba, -1 toward Marina
  let trainDwellSec = 0;
  let stoppedAtMile2ThisLeg = false;

  const update = (delta: number, timeSec: number) => {
    const dt = Math.min(0.05, Math.max(0, delta));

    // A. ATC Surveillance Radar Rotation
    if (rotatingRadarMesh) {
      rotatingRadarMesh.rotation.y += dt * 1.15;
    }

    // B. Active Commercial Jetliner Taxi / Takeoff / Climb / Landing Loop
    if (animatedAirliner) {
      const rwX = 465 * S;
      const cycle = 38.0;
      const t = ((timeSec % cycle) + cycle) % cycle;
      const p = animatedAirliner.plane;

      if (t < 7.0) {
        // Phase 1: Taxi out from North Taxiway onto Runway 19R Threshold (-1385*S)
        const k = t / 7.0;
        const startX = 390 * S;
        const px = startX + (rwX - startX) * k;
        const pz = -1378 * S;
        p.position.set(px, 0, pz);
        p.rotation.y = Math.PI / 2 - k * (Math.PI / 2); // Turns cleanly from +X onto +Z south takeoff
        p.rotation.x = 0;
        p.rotation.z = 0;
        animatedAirliner.gearGroup.visible = true;
      } else if (t < 17.5) {
        // Phase 2: Accelerating Takeoff Roll along Long Runway (z: -1378*S -> -1080*S) + Rotation
        const k = (t - 7.0) / 10.5;
        const kSq = k * k;
        const pz = -1378 * S + kSq * (320 * S);
        const rotateRatio = Math.max(0, (k - 0.72) / 0.28);
        const liftY = rotateRatio > 0 ? rotateRatio * rotateRatio * 14 : 0;
        p.position.set(rwX, liftY, pz);
        p.rotation.y = 0; // Heading +Z down runway
        p.rotation.x = -rotateRatio * 0.2;
        p.rotation.z = 0;
        animatedAirliner.gearGroup.visible = true;
      } else if (t < 27.5) {
        // Phase 3: Climb & Wide Scenic Right-Hand Circuit Back Around North Approach
        const k = (t - 17.5) / 10.0;
        const ang = k * Math.PI * 1.35;
        const radius = 140 * S;
        const px = rwX + Math.sin(ang) * radius;
        const pz = -1058 * S + (1 - Math.cos(ang)) * 65 * S - k * (680 * S);
        const py = 14 + Math.sin(Math.min(1, k * 1.15) * Math.PI * 0.65) * 95;
        p.position.set(px, py, pz);
        p.rotation.y = -ang * 0.75;
        p.rotation.x = -0.14 * (1 - k * 0.6);
        p.rotation.z = -0.22 * Math.sin(k * Math.PI);
        animatedAirliner.gearGroup.visible = k < 0.25 || k > 0.85;
      } else {
        // Phase 4: Final Approach Alignment from North -> Touchdown & Rollout on Runway 19R
        const k = (t - 27.5) / 10.5;
        const startZ = -1730 * S;
        const endZ = -1378 * S;
        const pz = startZ + (endZ - startZ) * k;
        const descK = Math.max(0, 1 - k * 1.25);
        const py = descK * descK * 68;
        p.position.set(rwX, py, pz);
        p.rotation.y = 0;
        p.rotation.x = descK > 0.05 ? 0.09 : -0.04 * (1 - descK);
        p.rotation.z = 0;
        animatedAirliner.gearGroup.visible = true;
      }
    }

    // C. Blue Line Elevated Passenger Train (Marina <-> Mile 2 Stop <-> Iyanoba)
    if (railCurve && trainCars.length > 0) {
      if (trainDwellSec > 0) {
        trainDwellSec = Math.max(0, trainDwellSec - dt);
      } else {
        const curveLen = railCurve.getLength();
        const speedMps = 42.0; // Smooth realistic commuter rail speed
        const du = (speedMps * dt) / Math.max(1, curveLen);
        const prevU = trainU;
        trainU += du * trainDir;

        // Mandatory Passenger Station Stop at Mile 2 (~4.5 seconds)
        if (
          !stoppedAtMile2ThisLeg &&
          ((trainDir > 0 && prevU < mile2U && trainU >= mile2U) ||
            (trainDir < 0 && prevU > mile2U && trainU <= mile2U))
        ) {
          trainU = mile2U;
          stoppedAtMile2ThisLeg = true;
          trainDwellSec = 4.5;
        }

        // Terminal Stops at Iyanoba & Marina
        if (trainU >= 0.96) {
          trainU = 0.96;
          trainDir = -1;
          stoppedAtMile2ThisLeg = false;
          trainDwellSec = 3.5;
        } else if (trainU <= 0.04) {
          trainU = 0.04;
          trainDir = 1;
          stoppedAtMile2ThisLeg = false;
          trainDwellSec = 3.5;
        }
      }

      const curveLen = railCurve.getLength();
      const carSpacingU = 15.2 / Math.max(1, curveLen);
      for (let c = 0; c < trainCars.length; c++) {
        const cu = Math.max(0.01, Math.min(0.99, trainU - c * carSpacingU * trainDir));
        railCurve.getPointAt(cu, tmpTrainPos);
        railCurve.getTangentAt(cu, tmpTrainTan);
        const car = trainCars[c];
        car.position.set(tmpTrainPos.x, tmpTrainPos.y, tmpTrainPos.z);
        car.rotation.y = Math.atan2(tmpTrainTan.x * trainDir, tmpTrainTan.z * trainDir);
      }
    }
  };

  return { update };
}
