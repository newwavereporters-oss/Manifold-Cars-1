// MANIFOLD WORLD - EXPANDED LAGOS REGIONS, BRIDGES, OBALENDE, IKOYI, LEKKI, AJAH, EPE & MAINLAND
// Generates continuous coastal water & seawalls, mounts all 5 elevated bridges/flyovers
// (Third Mainland Bridge, Adekunle Ramp, Ikoyi-Lekki Link Bridge, Ajah Flyover, Epe Bridge),
// green highway gantries, Obalende commercial market & Danfo terminal, Ikoyi gated estates & towers,
// Lekki/Ikate/Eleganza/VGC, Ajah interchange, preserved Epe Waterfront, and Mainland -> LASU.

import * as THREE from 'three';
import { BuildingBox } from './lagosCityData';
import type { LagosTexturePack } from './lagosTextures';
import {
  createThirdMainlandBridge,
  createAdekunleRamp,
  createIkoyiLinkBridge,
  createAjahFlyover,
  createEpeBridge,
} from '../../three/lagosCityBuilder';

export interface RegionBuildContext {
  cityGroup: THREE.Group;
  texPack: LagosTexturePack;
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T;
  trackMat: <T extends THREE.Material>(m: T) => T;
  distToNearestRoad: (px: number, pz: number) => number;
  allCollidableBuildings: BuildingBox[];
  buildCompositeBuilding: (b: BuildingBox) => void;
}

export function buildExpandedLagosRegions(ctx: RegionBuildContext): void {
  const {
    cityGroup,
    texPack,
    trackGeo,
    trackMat,
    distToNearestRoad,
    allCollidableBuildings,
    buildCompositeBuilding,
  } = ctx;

  // Shared materials for regional hardware & districts
  const parapetMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.78, metalness: 0.1 })
  );
  const steelDarkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.42, metalness: 0.72 })
  );
  const steelSilverMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.78 })
  );
  const greenHwyMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.45, metalness: 0.12 })
  );
  const lasuEmeraldMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.48, metalness: 0.12 })
  );
  const lasuGoldMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.75 })
  );
  const barrierYellowMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5, metalness: 0.15 })
  );
  const waterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0e4d6e,
      roughness: 0.16,
      metalness: 0.45,
    })
  );
  const seawallMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88, metalness: 0.08 })
  );
  const estateWallMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.72, metalness: 0.08 })
  );
  const terraceBrickMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.68, metalness: 0.1 })
  );
  const marketRedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.62, metalness: 0.08 })
  );
  const marketBlueMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.62, metalness: 0.08 })
  );
  const marketGreenMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.62, metalness: 0.08 })
  );
  const woodDeckMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x7c5338, roughness: 0.85, metalness: 0.05 })
  );

  // =========================================================================
  // 1. CONTINUOUS LAGOS LAGOON OCEAN PLANE & COASTAL SEAWALLS
  // =========================================================================
  {
    // Single seamless lagoon ocean plane sitting below all 4 coastal landmass slabs (y = -1.65)
    const oceanGeo = trackGeo(new THREE.PlaneGeometry(3600, 1250));
    const oceanMesh = new THREE.Mesh(oceanGeo, waterMat);
    oceanMesh.rotation.x = -Math.PI / 2;
    oceanMesh.position.set(400, -1.65, -75);
    oceanMesh.receiveShadow = true;
    cityGroup.add(oceanMesh);

    const buildSeawallZ = (xStart: number, xEnd: number, zPos: number) => {
      const len = xEnd - xStart;
      if (len <= 2) return;
      const wall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(len, 2.4, 3.8)), seawallMat);
      wall.position.set((xStart + xEnd) / 2, -0.8, zPos);
      wall.receiveShadow = true;
      cityGroup.add(wall);

      const coping = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(len, 0.35, 1.0)), parapetMat);
      coping.position.set((xStart + xEnd) / 2, 0.55, zPos);
      cityGroup.add(coping);
    };

    const buildSeawallX = (xPos: number, zStart: number, zEnd: number) => {
      const len = zEnd - zStart;
      if (len <= 2) return;
      const wall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.8, 2.4, len)), seawallMat);
      wall.position.set(xPos, -0.8, (zStart + zEnd) / 2);
      wall.receiveShadow = true;
      cityGroup.add(wall);

      const coping = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.0, 0.35, len)), parapetMat);
      coping.position.set(xPos, 0.55, (zStart + zEnd) / 2);
      cityGroup.add(coping);
    };

    // Main South Shore (z = -165) — openings around TMB [-13..13], Ikoyi Channel [445..595], Epe Creek [1350..1425]
    buildSeawallZ(-460, -13, -165);
    buildSeawallZ(13, 445, -165);
    buildSeawallZ(595, 1350, -165);
    buildSeawallZ(1425, 1600, -165);

    // North Mainland Shore (z = -585)
    buildSeawallZ(-1200, -13, -585);
    buildSeawallZ(13, 1800, -585);

    // Ikoyi-Lekki Lagoon Channel Shores (x = 445 & x = 595, gap for bridge z in [-33, -7])
    buildSeawallX(445, -165, -33);
    buildSeawallX(445, -7, 270);
    buildSeawallX(595, -165, -33);
    buildSeawallX(595, -7, 270);

    // Epe Creek Shores (x = 1350 & x = 1425, gap for Epe Bridge z in [87, 113])
    buildSeawallX(1350, -165, 87);
    buildSeawallX(1350, 113, 270);
    buildSeawallX(1425, -165, 87);
    buildSeawallX(1425, 113, 270);

    // East Epe Waterfront Bay Shore (x = 1600, opening at Marina Pier z in [86, 114])
    buildSeawallX(1600, -165, 86);
    buildSeawallX(1600, 114, 270);
  }

  // =========================================================================
  // 2. MOUNT ALL 5 ELEVATED BRIDGES & MULTI-LEVEL FLYOVERS
  // =========================================================================
  const bridgeOpts = { texPack, trackGeo, trackMat };
  cityGroup.add(createThirdMainlandBridge(bridgeOpts));
  cityGroup.add(createAdekunleRamp(bridgeOpts));
  cityGroup.add(createIkoyiLinkBridge(bridgeOpts));
  cityGroup.add(createAjahFlyover(bridgeOpts));
  cityGroup.add(createEpeBridge(bridgeOpts));

  // =========================================================================
  // 3. GREEN HIGHWAY GANTRIES & DIRECTIONAL ROAD SIGNS
  // =========================================================================
  const addHighwayGantry = (
    x: number,
    y: number,
    z: number,
    yaw: number,
    title: string,
    subtitle: string,
    span = 23.2
  ) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;

    const pL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.28, 0.34, 8.2, 10)), steelSilverMat);
    pL.position.set(-span / 2, 4.1, 0);
    const pR = pL.clone();
    pR.position.x = span / 2;

    const beam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(span + 1.0, 0.6, 0.55)), steelSilverMat);
    beam.position.set(0, 8.0, 0);

    const boardFrame = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(13.8, 3.2, 0.35)),
      greenHwyMat
    );
    boardFrame.position.set(0, 8.0, 0);

    const signTex = texPack.createSignTexture(title, subtitle, {
      bg: '#065F46',
      border: '#FFFFFF',
      accent: '#FDE047',
      text: '#FFFFFF',
    });
    const signMat = trackMat(new THREE.MeshBasicMaterial({ map: signTex }));
    const faceF = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(13.4, 2.9)), signMat);
    faceF.position.set(0, 8.0, 0.21);
    const faceB = faceF.clone();
    faceB.position.z = -0.21;
    faceB.rotation.y = Math.PI;

    g.add(pL, pR, beam, boardFrame, faceF, faceB);
    cityGroup.add(g);
  };

  const addRoadsideSign = (
    x: number,
    z: number,
    yaw: number,
    title: string,
    subtitle: string
  ) => {
    const sg = new THREE.Group();
    sg.position.set(x, 0, z);
    sg.rotation.y = yaw;

    const postL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.1, 0.12, 4.8, 8)), steelSilverMat);
    postL.position.set(-1.6, 2.4, 0);
    const postR = postL.clone();
    postR.position.x = 1.6;

    const backing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.6, 2.1, 0.16)), greenHwyMat);
    backing.position.set(0, 4.1, 0);

    const tex = texPack.createSignTexture(title, subtitle, {
      bg: '#065F46',
      border: '#FFFFFF',
      accent: '#FDE047',
    });
    const mat = trackMat(new THREE.MeshBasicMaterial({ map: tex }));
    const faceF = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(5.3, 1.85)), mat);
    faceF.position.set(0, 4.1, 0.1);
    const faceB = faceF.clone();
    faceB.position.z = -0.1;
    faceB.rotation.y = Math.PI;

    sg.add(postL, postR, backing, faceF, faceB);
    cityGroup.add(sg);
  };

  // Third Mainland Bridge, Adekunle, Obalende, Ikoyi, Lekki, Ajah & Epe Gantries
  addHighwayGantry(0, 0, -140, 0, 'THIRD MAINLAND BRIDGE ▲', 'IYANA-OWORO • ADEKUNLE • MAINLAND', 23.6);
  addHighwayGantry(0, 6.0, -225, 0, 'LAGOS ISLAND ▲  |  ADEKUNLE RAMP ▶', 'KEEP RIGHT SOUTHBOUND FOR OBALENDE & IKOYI', 23.0);
  addHighwayGantry(0, 6.0, -548, 0, 'IYANA-OWORO INTERCHANGE', '◀ OSHODI   |   IKEJA ▲   |   LASU', 23.0);
  addHighwayGantry(195, 0, -130, Math.PI / 2, 'ADEKUNLE INTERCHANGE', '◀ LAGOS ISLAND   |   IKOYI ▶   |   OBALENDE ▼', 23.4);
  addHighwayGantry(396, 0, -20, Math.PI / 2, 'IKOYI - LEKKI LINK BRIDGE ▲', 'LEKKI PENINSULA • IKATE • AJAH • EPE', 23.6);
  addHighwayGantry(692, 0, 100, Math.PI / 2, 'LEKKI - EPE EXPRESSWAY ▲', 'IKATE • ELEGANZA • VGC • AJAH • EPE', 23.6);
  addHighwayGantry(1042, 0, 100, Math.PI / 2, 'AJAH EXPRESS FLYOVER ▲', 'OVERPASS TO EPE   |   SLIP ROAD: AJAH MARKET', 23.6);
  addHighwayGantry(1310, 0, 100, Math.PI / 2, 'EPE LAGOON BRIDGE ▲', 'EPE TOWN • WATERFRONT MARINA', 23.6);

  // Mainland & LASU Corridor Gantries
  addHighwayGantry(-90, 0, -640, Math.PI / 2, '◀ OSHODI   |   IKEJA ▲', 'CONNECTS TO IYANA IPAJA • EGBEDA', 23.6);
  addHighwayGantry(0, 0, -720, 0, 'IKEJA BUSINESS DISTRICT ▲', 'ALAUSA SECRETARIAT • IKEJA MALL', 23.6);
  addHighwayGantry(-215, 0, -880, Math.PI / 2, 'IYANA IPAJA JUNCTION', '◀ EGBEDA • IGANDO   |   OSHODI ▼', 23.6);
  addHighwayGantry(-355, 0, -855, Math.PI * 0.43, 'EGBEDA COMMERCIAL AVE', '◀ IGANDO • AKESAN • LASU CAMPUS', 23.6);
  addHighwayGantry(-615, 0, -755, Math.PI * 0.36, 'AKESAN & IGANDO EXPRESS', '◀ LASU MAIN GATE   |   EGBEDA ▶', 23.6);

  // Roadside Confirmation Signs
  addRoadsideSign(175, 16, Math.PI / 2, 'OBALENDE', 'COMMERCIAL MARKET & BUS HUB');
  addRoadsideSign(276, -114, 0, 'IKOYI BOURDILLON', '◀ ADEKUNLE   |   LINK BRIDGE ▶');
  addRoadsideSign(790, 84, 0, 'IKATE CHISCO', 'LEKKI-EPE EXPRESSWAY');
  addRoadsideSign(905, 84, 0, 'ELEGANZA PLAZA', '◀ LEKKI   |   VGC & AJAH ▶');
  addRoadsideSign(1000, 84, 0, 'VICTORIA GARDEN CITY', 'VGC GATED ESTATE ▲');
  addRoadsideSign(1152, 16, Math.PI / 2, 'AJAH UNDERPASS', 'BADORE / JUBILEE MARKET');
  addRoadsideSign(1476, 84, 0, 'EPE TOWN', 'EPE WATERFRONT & MARINA ▶');
  addRoadsideSign(-16, -622, 0, 'IYANA-OWORO', 'MAINLAND GATEWAY');
  addRoadsideSign(-246, -624, 0, 'OSHODI', 'TRANSIT TERMINAL');
  addRoadsideSign(-16, -862, 0, 'IKEJA', 'CENTRAL BUSINESS DISTRICT');
  addRoadsideSign(-245, -864, 0, 'IYANA IPAJA', '◀ EGBEDA   |   OSHODI ▼');
  addRoadsideSign(-425, -824, 0, 'EGBEDA', '◀ IGANDO • LASU');
  addRoadsideSign(-565, -772, 0, 'IGANDO', '◀ AKESAN • LASU');
  addRoadsideSign(-695, -702, 0, 'AKESAN', 'LASU CAMPUS AHEAD ◀');

  // =========================================================================
  // 4. OBALENDE COMMERCIAL MARKET STALLS & OFF-LANE DANFO INTERCHANGE BAY
  // =========================================================================
  {
    // Off-lane Obalende Danfo Bus Interchange Bay at [132, 0, 56] (clear of x=160 carriageway!)
    const term = new THREE.Group();
    term.position.set(132, 0, 56);

    const apron = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(18, 0.14, 28)), texPack.commercialRoadMat);
    apron.position.y = 0.05;
    apron.receiveShadow = true;
    term.add(apron);

    const canopy = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12, 0.55, 22)), barrierYellowMat);
    canopy.position.set(-2, 4.8, 0);
    canopy.castShadow = true;
    term.add(canopy);

    [-8, 0, 8].forEach((bz) => {
      const col = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.2, 0.25, 4.8, 8)), steelDarkMat);
      col.position.set(-6.5, 2.4, bz);
      const colR = col.clone();
      colR.position.x = 2.5;
      term.add(col, colR);

      // Parked static yellow Danfo shelter bays along back apron
      const parkedBus = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.1, 2.0, 4.8)), barrierYellowMat);
      parkedBus.position.set(4.5, 1.15, bz);
      parkedBus.castShadow = true;
      const busStripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.16, 0.18, 4.84)), steelDarkMat);
      busStripe.position.set(4.5, 1.0, bz);
      term.add(parkedBus, busStripe);
    });

    const termTex = texPack.createSignTexture('OBALENDE BUS TERMINAL', 'DANFO INTERCHANGE • IKOYI • ISLAND', {
      bg: '#111827',
      border: '#FACC15',
      accent: '#FFFFFF',
    });
    const termSign = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(14, 1.6)),
      trackMat(new THREE.MeshBasicMaterial({ map: termTex }))
    );
    termSign.position.set(4.1, 4.8, 0);
    termSign.rotation.y = Math.PI / 2;
    term.add(termSign);
    cityGroup.add(term);

    // Colorful Street Market Stalls & Umbrellas along Obalende East Sidewalk (x = 182..192)
    const canopyMats = [marketRedMat, marketBlueMat, marketGreenMat, barrierYellowMat];
    const stallCoords = [
      { x: 183, z: -48 },
      { x: 183, z: -38 },
      { x: 183, z: -6 },
      { x: 183, z: 4 },
      { x: 183, z: 46 },
      { x: 183, z: 56 },
      { x: 183, z: 66 },
      { x: 183, z: 76 },
    ];
    stallCoords.forEach((sc, idx) => {
      if (distToNearestRoad(sc.x, sc.z) < 13.5) return;
      const sg = new THREE.Group();
      sg.position.set(sc.x, 0, sc.z);

      const kiosk = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.6, 2.7, 5.4)), texPack.stuccoCreamMat);
      kiosk.position.set(2.2, 1.35, 0);
      kiosk.castShadow = true;

      const awning = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(3.4, 0.16, 5.6)),
        canopyMats[idx % canopyMats.length]
      );
      awning.position.set(-0.8, 2.55, 0);
      awning.rotation.z = 0.18;

      const table = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.4, 0.9, 4.2)), woodDeckMat);
      table.position.set(-1.3, 0.45, 0);

      const umbrella = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(1.75, 0.85, 6)),
        canopyMats[(idx + 1) % canopyMats.length]
      );
      umbrella.position.set(-2.6, 2.9, 0);
      const pole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6)), steelSilverMat);
      pole.position.set(-2.6, 1.4, 0);

      sg.add(kiosk, awning, table, umbrella, pole);
      cityGroup.add(sg);
    });
  }

  // =========================================================================
  // 5. IKOYI GATED ESTATES, PERIMETER WALLS & VGC ARCHED GATEHOUSE
  // =========================================================================
  {
    const buildGatedCompound = (
      cx: number,
      cz: number,
      w: number,
      d: number,
      gateSide: 'NORTH' | 'SOUTH',
      label: string
    ) => {
      const g = new THREE.Group();
      g.position.set(cx, 0, cz);
      const wallH = 2.6;
      const gateGap = 11.0;

      // Left, Right & Back perimeter walls
      const sideGeo = trackGeo(new THREE.BoxGeometry(0.65, wallH, d));
      const wallL = new THREE.Mesh(sideGeo, estateWallMat);
      wallL.position.set(-w / 2, wallH / 2, 0);
      wallL.castShadow = true;
      const wallR = wallL.clone();
      wallR.position.x = w / 2;

      const backZ = gateSide === 'SOUTH' ? -d / 2 : d / 2;
      const frontZ = gateSide === 'SOUTH' ? d / 2 : -d / 2;
      const backWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, wallH, 0.65)), estateWallMat);
      backWall.position.set(0, wallH / 2, backZ);

      // Front walls flanking entrance gatehouse
      const wingW = (w - gateGap) / 2;
      if (wingW > 1) {
        const wingGeo = trackGeo(new THREE.BoxGeometry(wingW, wallH, 0.65));
        const fL = new THREE.Mesh(wingGeo, estateWallMat);
        fL.position.set(-w / 2 + wingW / 2, wallH / 2, frontZ);
        const fR = fL.clone();
        fR.position.x = w / 2 - wingW / 2;
        g.add(fL, fR);
      }

      // Estate Gatehouse Arch
      const pillarGeo = trackGeo(new THREE.BoxGeometry(1.4, 5.2, 1.6));
      const gpL = new THREE.Mesh(pillarGeo, terraceBrickMat);
      gpL.position.set(-gateGap / 2, 2.6, frontZ);
      const gpR = gpL.clone();
      gpR.position.x = gateGap / 2;
      const lintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(gateGap + 2.4, 1.3, 1.8)), steelDarkMat);
      lintel.position.set(0, 5.4, frontZ);

      const eTex = texPack.createSignTexture(label, 'PRIVATE GATED RESIDENCE', {
        bg: '#064E3B',
        border: '#FDE047',
        accent: '#FFFFFF',
      });
      const eSign = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(8.6, 1.1)),
        trackMat(new THREE.MeshBasicMaterial({ map: eTex }))
      );
      eSign.position.set(0, 5.4, frontZ + (gateSide === 'SOUTH' ? 0.95 : -0.95));
      if (gateSide === 'NORTH') eSign.rotation.y = Math.PI;

      // 4 Luxury Private Estate Villas inside compound
      const villaCoords = [
        [-w * 0.25, -d * 0.22],
        [w * 0.25, -d * 0.22],
        [-w * 0.25, d * 0.18],
        [w * 0.25, d * 0.18],
      ];
      villaCoords.forEach(([vx, vz]) => {
        const villa = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(11.5, 7.2, 10.0)), texPack.stuccoCreamMat);
        villa.position.set(vx, 3.6, vz);
        villa.castShadow = true;
        villa.receiveShadow = true;
        const vRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12.4, 0.75, 10.9)), terraceBrickMat);
        vRoof.position.set(vx, 7.55, vz);
        const vGlass = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(6.5, 2.8)), texPack.nightWindowCoolMat);
        vGlass.position.set(vx, 4.2, vz + 5.05);
        g.add(villa, vRoof, vGlass);
      });

      g.add(wallL, wallR, backWall, gpL, gpR, lintel, eSign);
      cityGroup.add(g);
    };

    // Ikoyi Gated Luxury Communities (between x=260..365 boulevards)
    buildGatedCompound(312.5, -75, 58, 56, 'SOUTH', 'BOURDILLON COURT ESTATE');
    buildGatedCompound(312.5, 40, 58, 66, 'NORTH', 'PARKVIEW IKOYI ESTATE');

    // Victoria Garden City (VGC) Iconic Expressway Arched Estate Gatehouse spanning [1015, 0, 44]
    const vgcGate = new THREE.Group();
    vgcGate.position.set(1015, 0, 44);
    [-12.2, 12.2].forEach((gx) => {
      const tower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 9.6, 2.8)), texPack.stuccoCreamMat);
      tower.position.set(gx, 4.8, 0);
      tower.castShadow = true;
      const cap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.0, 0.85, 3.2)), lasuEmeraldMat);
      cap.position.set(gx, 9.8, 0);
      vgcGate.add(tower, cap);
    });
    const vgcBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(27.0, 2.1, 2.4)), lasuEmeraldMat);
    vgcBeam.position.set(0, 8.2, 0);
    const vgcTex = texPack.createSignTexture(
      'VICTORIA GARDEN CITY (VGC)',
      'RESIDENTIAL ESTATE  •  LEKKI PENINSULA',
      { bg: '#064E3B', border: '#FDE047', accent: '#FFFFFF' }
    );
    const vgcMat = trackMat(new THREE.MeshBasicMaterial({ map: vgcTex }));
    const vSignF = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(18, 1.85)), vgcMat);
    vSignF.position.set(0, 8.2, 1.24);
    const vSignB = vSignF.clone();
    vSignB.position.z = -1.24;
    vSignB.rotation.y = Math.PI;
    vgcGate.add(vgcBeam, vSignF, vSignB);
    cityGroup.add(vgcGate);

    // VGC Estate Perimeter Wall & Villas flanking VGC Boulevard
    const buildVgcWall = (wx: number, wz: number, lx: number, lz: number) => {
      const w = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(lx, 2.5, lz)), estateWallMat);
      w.position.set(wx, 1.25, wz);
      const top = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(lx + 0.15, 0.25, lz + 0.15)), lasuEmeraldMat);
      top.position.set(wx, 2.6, wz);
      cityGroup.add(w, top);
    };
    buildVgcWall(982, 44, 42, 0.65);
    buildVgcWall(1048, 44, 42, 0.65);
    buildVgcWall(961, -24, 0.65, 136);
    buildVgcWall(1069, -24, 0.65, 136);

    [
      [984, -8],
      [1046, -8],
      [984, -46],
      [1046, -46],
      [1015, -62],
    ].forEach(([vx, vz]) => {
      const villa = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(14, 7.6, 12)), texPack.stuccoCreamMat);
      villa.position.set(vx, 3.8, vz);
      villa.castShadow = true;
      const vRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(15, 0.8, 13)), terraceBrickMat);
      vRoof.position.set(vx, 7.9, vz);
      cityGroup.add(villa, vRoof);
    });
  }

  // =========================================================================
  // 6. LEKKI TOLL PLAZA & PRESERVED EPE WATERFRONT MARINA PIER
  // =========================================================================
  {
    // Lekki-Epe Admiralty Toll Plaza at [725, 0, 100] (fits 22m dual carriageway cleanly!)
    const tollGroup = new THREE.Group();
    tollGroup.position.set(725, 0, 100);
    tollGroup.rotation.y = Math.PI / 2;

    const canopy = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(26.5, 1.3, 6.4)), greenHwyMat);
    canopy.position.set(0, 6.2, 0);
    canopy.castShadow = true;

    const canopyTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(26.8, 0.35, 6.6)), barrierYellowMat);
    canopyTrim.position.set(0, 6.85, 0);

    [-11.2, 0, 11.2].forEach((bx) => {
      const booth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.0, 3.2, 4.4)), texPack.stuccoCreamMat);
      booth.position.set(bx, 1.6, 0);
      const pillar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.65, 6.0, 0.8)), steelDarkMat);
      pillar.position.set(bx, 3.0, 0);
      tollGroup.add(booth, pillar);
    });

    const tollTex = texPack.createSignTexture('LEKKI - EPE TOLL PLAZA', 'OPEN EXPRESSWAY PASS • IKATE • AJAH • EPE', {
      bg: '#064E3B',
      border: '#FACC15',
      accent: '#FFFFFF',
    });
    const tollMat = trackMat(new THREE.MeshBasicMaterial({ map: tollTex }));
    const tSignF = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(18, 1.8)), tollMat);
    tSignF.position.set(0, 6.2, 3.24);
    const tSignB = tSignF.clone();
    tSignB.position.z = -3.24;
    tSignB.rotation.y = Math.PI;
    tollGroup.add(canopy, canopyTrim, tSignF, tSignB);
    cityGroup.add(tollGroup);

    // Preserved Epe Waterfront Marina Pier & Monument at [1594, 0, 100]
    const epeGroup = new THREE.Group();
    epeGroup.position.set(1594, 0, 100);

    const plazaSlab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(18, 0.35, 28)), texPack.sidewalkMat);
    plazaSlab.position.y = 0.15;
    plazaSlab.receiveShadow = true;

    // Scenic wooden marina boardwalk extending east out over Epe Lagoon Bay
    const boardwalk = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(22, 0.4, 14)), woodDeckMat);
    boardwalk.position.set(14, 0.25, 0);
    boardwalk.receiveShadow = true;

    const archL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.4, 8.2, 1.4)), lasuEmeraldMat);
    archL.position.set(0, 4.1, -9);
    const archR = archL.clone();
    archR.position.z = 9;
    const archTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.8, 1.8, 20)), steelDarkMat);
    archTop.position.set(0, 8.4, 0);

    const epeTex = texPack.createSignTexture('EPE WATERFRONT', 'LAGOON MARINA & RESORT TERMINUS', {
      bg: '#0C4A6E',
      border: '#38BDF8',
      accent: '#FDE047',
    });
    const epeSign = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(13.5, 1.8)),
      trackMat(new THREE.MeshBasicMaterial({ map: epeTex }))
    );
    epeSign.position.set(-0.95, 8.4, 0);
    epeSign.rotation.y = -Math.PI / 2;

    epeGroup.add(plazaSlab, boardwalk, archL, archR, archTop, epeSign);
    cityGroup.add(epeGroup);
  }

  // =========================================================================
  // 7. EXPANDED REGIONAL BUILDINGS (Obalende, Ikoyi, Lekki, Ikate, Eleganza, Ajah, Epe, Mainland, LASU)
  // =========================================================================
  const regionalBuildingSpecs: BuildingBox[] = [
    // Obalende Commercial Shops & Buildings
    {
      id: 'B_OBALENDE_PLAZA_N',
      x: 194,
      z: -74,
      width: 24,
      depth: 22,
      height: 18,
      name: 'Obalende Commercial Trade Hub',
      type: 'commercial',
      color: 0xd97706,
      roofColor: 0x0f172a,
      hasSign: true,
      signText: 'OBALENDE TRADE HUB',
    },
    {
      id: 'B_OBALENDE_MARKET_HALL',
      x: 194,
      z: 58,
      width: 22,
      depth: 28,
      height: 14,
      name: 'Obalende Market Arcade',
      type: 'commercial',
      color: 0x475569,
      roofColor: 0xdc2626,
      hasSign: true,
      signText: 'OBALENDE MARKET ARCADE',
    },
    {
      id: 'B_OBALENDE_RES',
      x: 130,
      z: -72,
      width: 22,
      depth: 24,
      height: 20,
      name: 'McGregor Terrace Apartments',
      type: 'residential',
      color: 0xf1ece1,
      roofColor: 0x334155,
      hasSign: false,
    },

    // Ikoyi High-Rise Towers & Private Mansions
    {
      id: 'B_IKOYI_TOWER_W',
      x: 212,
      z: -75,
      width: 26,
      depth: 26,
      height: 44,
      name: 'Bourdillon Sovereign Tower',
      type: 'bank',
      color: 0x0f172a,
      roofColor: 0x38bdf8,
      hasSign: true,
      signText: 'BOURDILLON TOWER',
    },
    {
      id: 'B_IKOYI_TOWER_E',
      x: 405,
      z: -76,
      width: 26,
      depth: 26,
      height: 48,
      name: 'Ikoyi Pearl Lagoon Residence',
      type: 'tech_hub',
      color: 0x1e293b,
      roofColor: 0x10b981,
      hasSign: true,
      signText: 'IKOYI PEARL TOWERS',
    },
    {
      id: 'B_IKOYI_FALOMO_PLAZA',
      x: 212,
      z: 40,
      width: 26,
      depth: 28,
      height: 30,
      name: 'Kingsway Corporate Centre',
      type: 'bank',
      color: 0x1e293b,
      roofColor: 0xd97706,
      hasSign: true,
      signText: 'KINGSWAY IKOYI',
    },
    {
      id: 'B_IKOYI_CLUB_HOUSE',
      x: 404,
      z: 42,
      width: 28,
      depth: 24,
      height: 16,
      name: 'Ikoyi Waterfront Club',
      type: 'commercial',
      color: 0xe2e8f0,
      roofColor: 0x059669,
      hasSign: true,
      signText: 'IKOYI CLUB & SUITES',
    },

    // Lekki Peninsula Phase 1, Ikate, Eleganza & Ajah
    {
      id: 'B_LEKKI_ADMIRALTY_MALL',
      x: 725,
      z: 42,
      width: 34,
      depth: 24,
      height: 22,
      name: 'Lekki Admiralty Mall',
      type: 'commercial',
      color: 0x1e293b,
      roofColor: 0x0284c7,
      hasSign: true,
      signText: 'ADMIRALTY MALL',
    },
    {
      id: 'B_LEKKI_WATERFRONT_TOWER',
      x: 718,
      z: -74,
      width: 28,
      depth: 24,
      height: 36,
      name: 'Lekki Peninsula Sky Tower',
      type: 'tech_hub',
      color: 0x0f172a,
      roofColor: 0x38bdf8,
      hasSign: true,
      signText: 'LEKKI SKY TOWERS',
    },
    {
      id: 'B_LEKKI_PALMS_RES',
      x: 626,
      z: 144,
      width: 28,
      depth: 22,
      height: 20,
      name: 'Admiralty Gate Residences',
      type: 'residential',
      color: 0xf1ece1,
      roofColor: 0x0f172a,
      hasSign: false,
    },
    {
      id: 'B_IKATE_PLAZA',
      x: 825,
      z: 56,
      width: 30,
      depth: 22,
      height: 20,
      name: 'Ikate Commercial Hub',
      type: 'commercial',
      color: 0x334155,
      roofColor: 0x0ea5e9,
      hasSign: true,
      signText: 'IKATE CHISCO HUB',
    },
    {
      id: 'B_IKATE_RES',
      x: 790,
      z: 146,
      width: 26,
      depth: 20,
      height: 18,
      name: 'Ikate Gardens Apartments',
      type: 'residential',
      color: 0xe2e8f0,
      roofColor: 0x7c2d12,
      hasSign: false,
    },
    {
      id: 'B_ELEGANZA_MALL',
      x: 905,
      z: 54,
      width: 34,
      depth: 22,
      height: 18,
      name: 'Eleganza Trade Centre',
      type: 'commercial',
      color: 0xd97706,
      roofColor: 0x6366f1,
      hasSign: true,
      signText: 'ELEGANZA PLAZA',
    },
    {
      id: 'B_ELEGANZA_AUTO',
      x: 905,
      z: 146,
      width: 28,
      depth: 22,
      height: 16,
      name: 'Chevron & Eleganza Auto Mall',
      type: 'commercial',
      color: 0x1e293b,
      roofColor: 0xf59e0b,
      hasSign: true,
      signText: 'ELEGANZA AUTO GALLERY',
    },
    {
      id: 'B_AJAH_JUBILEE_PLAZA',
      x: 1086,
      z: 162,
      width: 28,
      depth: 22,
      height: 18,
      name: 'Ajah Jubilee Market Plaza',
      type: 'commercial',
      color: 0xd97706,
      roofColor: 0x0f172a,
      hasSign: true,
      signText: 'AJAH JUBILEE MARKET',
    },
    {
      id: 'B_AJAH_BADORE_SUITES',
      x: 1184,
      z: 24,
      width: 28,
      depth: 22,
      height: 20,
      name: 'Badore Lagoon Business Suites',
      type: 'bank',
      color: 0x0f172a,
      roofColor: 0x14b8a6,
      hasSign: true,
      signText: 'AJAH BADORE CENTRE',
    },
    {
      id: 'B_AJAH_GRAND_MALL',
      x: 1188,
      z: 162,
      width: 30,
      depth: 22,
      height: 16,
      name: 'Sangotedo & Ajah Galleria',
      type: 'commercial',
      color: 0x334155,
      roofColor: 0x0ea5e9,
      hasSign: true,
      signText: 'AJAH GRAND MALL',
    },

    // Eleko & Preserved Epe Waterfront Architecture (x = 1265..1555)
    {
      id: 'B_EPE_ELEKO_RESORT',
      x: 1280,
      z: 54,
      width: 28,
      depth: 20,
      height: 14,
      name: 'Eleko Coastal Suites',
      type: 'residential',
      color: 0xe2e8f0,
      roofColor: 0x059669,
      hasSign: true,
      signText: 'ELEKO BEACH SUITES',
    },
    {
      id: 'B_EPE_CIVIC',
      x: 1545,
      z: 56,
      width: 26,
      depth: 22,
      height: 16,
      name: 'Epe Waterfront Civic Hall',
      type: 'commercial',
      color: 0xf1ece1,
      roofColor: 0x0284c7,
      hasSign: true,
      signText: 'EPE WATERFRONT HALL',
    },
    {
      id: 'B_EPE_RESORT_CLUB',
      x: 1545,
      z: 144,
      width: 30,
      depth: 22,
      height: 14,
      name: 'Epe Lagoon Marina Club',
      type: 'commercial',
      color: 0x334155,
      roofColor: 0x0ea5e9,
      hasSign: true,
      signText: 'EPE MARINA CLUB',
    },
    {
      id: 'B_EPE_PROMENADE_HOTEL',
      x: 1538,
      z: -6,
      width: 26,
      depth: 20,
      height: 18,
      name: 'Epe Lagoon Promenade Resort',
      type: 'residential',
      color: 0xf8fafc,
      roofColor: 0x047857,
      hasSign: true,
      signText: 'EPE LAGOON RESORT',
    },

    // Iyana-Oworo Interchange
    {
      id: 'B_OWORO_PLAZA_E',
      x: 36,
      z: -672,
      width: 26,
      depth: 22,
      height: 20,
      name: 'Oworo Bridgehead Tower',
      type: 'commercial',
      color: 0x334155,
      roofColor: 0xf97316,
      hasSign: true,
      signText: 'IYANA-OWORO PLAZA',
    },
    {
      id: 'B_OWORO_MKT_W',
      x: -44,
      z: -676,
      width: 24,
      depth: 20,
      height: 14,
      name: 'Oworonshoki Transit Mall',
      type: 'commercial',
      color: 0xd97706,
      roofColor: 0x1e293b,
      hasSign: true,
      signText: 'OWORO TRANSIT MALL',
    },

    // Oshodi Corridor
    {
      id: 'B_OSHODI_TERMINAL',
      x: -220,
      z: -678,
      width: 38,
      depth: 22,
      height: 16,
      name: 'Oshodi Transport Terminal',
      type: 'depot',
      color: 0x1e293b,
      roofColor: 0xeab308,
      hasSign: true,
      signText: 'OSHODI TERMINAL',
    },
    {
      id: 'B_OSHODI_ARENA',
      x: -292,
      z: -612,
      width: 28,
      depth: 22,
      height: 18,
      name: 'Oshodi Trade & Auto Arena',
      type: 'commercial',
      color: 0x475569,
      roofColor: 0xdc2626,
      hasSign: true,
      signText: 'OSHODI TRADE ARENA',
    },

    // Ikeja Central Business District & Alausa
    {
      id: 'B_IKEJA_TOWER_1',
      x: 34,
      z: -855,
      width: 26,
      depth: 26,
      height: 40,
      name: 'Ikeja Commerce Tower',
      type: 'bank',
      color: 0x0f172a,
      roofColor: 0x38bdf8,
      hasSign: true,
      signText: 'IKEJA COMMERCE TOWER',
    },
    {
      id: 'B_IKEJA_MALL',
      x: -42,
      z: -914,
      width: 36,
      depth: 24,
      height: 20,
      name: 'Ikeja City Galleria',
      type: 'commercial',
      color: 0x334155,
      roofColor: 0x6366f1,
      hasSign: true,
      signText: 'IKEJA CITY GALLERIA',
    },
    {
      id: 'B_IKEJA_HOTEL',
      x: -102,
      z: -846,
      width: 26,
      depth: 24,
      height: 30,
      name: 'Ikeja Continental Hotel',
      type: 'tech_hub',
      color: 0x1e293b,
      roofColor: 0xf59e0b,
      hasSign: true,
      signText: 'IKEJA GRAND HOTEL',
    },
    {
      id: 'B_IKEJA_SECRETARIAT',
      x: -95,
      z: -726,
      width: 28,
      depth: 22,
      height: 22,
      name: 'Alausa Civic Complex',
      type: 'bank',
      color: 0x1e293b,
      roofColor: 0x10b981,
      hasSign: true,
      signText: 'ALAUSA SECRETARIAT',
    },

    // Iyana Ipaja
    {
      id: 'B_IPAJA_PLAZA',
      x: -232,
      z: -914,
      width: 30,
      depth: 22,
      height: 18,
      name: 'Iyana Ipaja Commercial Hub',
      type: 'commercial',
      color: 0x475569,
      roofColor: 0xec4899,
      hasSign: true,
      signText: 'IYANA IPAJA PLAZA',
    },
    {
      id: 'B_IPAJA_RES',
      x: -294,
      z: -848,
      width: 24,
      depth: 22,
      height: 18,
      name: 'Alimosho Skyline Apartments',
      type: 'residential',
      color: 0xe2e8f0,
      roofColor: 0x334155,
      hasSign: false,
    },

    // Egbeda
    {
      id: 'B_EGBEDA_PLAZA',
      x: -410,
      z: -876,
      width: 30,
      depth: 20,
      height: 16,
      name: 'Egbeda Town Square',
      type: 'commercial',
      color: 0xd97706,
      roofColor: 0xf43f5e,
      hasSign: true,
      signText: 'EGBEDA TOWN SQUARE',
    },
    {
      id: 'B_EGBEDA_ESTATE',
      x: -445,
      z: -805,
      width: 24,
      depth: 22,
      height: 16,
      name: 'Gowon Estate Flats',
      type: 'residential',
      color: 0xf1ece1,
      roofColor: 0x475569,
      hasSign: false,
    },

    // Igando
    {
      id: 'B_IGANDO_CENTRE',
      x: -550,
      z: -826,
      width: 28,
      depth: 20,
      height: 16,
      name: 'Igando Trade & General Plaza',
      type: 'commercial',
      color: 0x475569,
      roofColor: 0x22c55e,
      hasSign: true,
      signText: 'IGANDO PLAZA',
    },
    {
      id: 'B_IGANDO_RES',
      x: -592,
      z: -740,
      width: 24,
      depth: 22,
      height: 15,
      name: 'Igando Gardens',
      type: 'residential',
      color: 0xe2e8f0,
      roofColor: 0x0f172a,
      hasSign: false,
    },

    // Akesan
    {
      id: 'B_AKESAN_COURT',
      x: -680,
      z: -756,
      width: 26,
      depth: 20,
      height: 14,
      name: 'Akesan Suburban Terrace',
      type: 'residential',
      color: 0xf1ece1,
      roofColor: 0x84cc16,
      hasSign: true,
      signText: 'AKESAN COURT',
    },
    {
      id: 'B_AKESAN_MKT',
      x: -718,
      z: -678,
      width: 24,
      depth: 18,
      height: 12,
      name: 'Akesan Auto & Provisions',
      type: 'commercial',
      color: 0x475569,
      roofColor: 0xd97706,
      hasSign: true,
      signText: 'AKESAN PLAZA',
    },

    // === LAGOS STATE UNIVERSITY (LASU) CAMPUS BUILDINGS ===
    {
      id: 'B_LASU_SENATE',
      x: -964,
      z: -660,
      width: 24,
      depth: 36,
      height: 22,
      name: 'LASU Senate & Administration Building',
      type: 'campus',
      color: 0xf8fafc,
      roofColor: 0x047857,
      hasSign: true,
      signText: 'LASU SENATE BUILDING',
    },
    {
      id: 'B_LASU_LIBRARY',
      x: -905,
      z: -756,
      width: 30,
      depth: 20,
      height: 18,
      name: 'Fatiu Ademola Akesode Library',
      type: 'campus',
      color: 0xf1ece1,
      roofColor: 0x065f46,
      hasSign: true,
      signText: 'LASU MAIN LIBRARY',
    },
    {
      id: 'B_LASU_FACULTY_ENG',
      x: -835,
      z: -690,
      width: 26,
      depth: 22,
      height: 16,
      name: 'Faculty of Engineering & Tech',
      type: 'campus',
      color: 0xe2e8f0,
      roofColor: 0x047857,
      hasSign: true,
      signText: 'FACULTY OF ENGINEERING',
    },
    {
      id: 'B_LASU_AUDITORIUM',
      x: -905,
      z: -624,
      width: 32,
      depth: 20,
      height: 15,
      name: 'Buba Marwa University Auditorium',
      type: 'campus',
      color: 0xf8fafc,
      roofColor: 0xd97706,
      hasSign: true,
      signText: 'LASU LECTURE AUDITORIUM',
    },
    {
      id: 'B_LASU_HOSTEL_1',
      x: -835,
      z: -756,
      width: 26,
      depth: 18,
      height: 14,
      name: 'LASU Student Hostels Hall A',
      type: 'residential',
      color: 0xf1ece1,
      roofColor: 0x047857,
      hasSign: true,
      signText: 'STUDENT HOSTELS',
    },
    {
      id: 'B_LASU_SECURITY',
      x: -796,
      z: -636,
      width: 10,
      depth: 8,
      height: 6,
      name: 'LASU Campus Security Gatehouse',
      type: 'campus',
      color: 0xf8fafc,
      roofColor: 0x047857,
      hasSign: true,
      signText: 'CAMPUS SECURITY',
    },
  ];

  regionalBuildingSpecs.forEach((b) => {
    // 11.5m guarantees zero overlap with widened 22m dual carriageways
    const clearMargin = Math.max(b.width, b.depth) / 2 + 11.5;
    if (distToNearestRoad(b.x, b.z) < clearMargin) return;
    allCollidableBuildings.push(b);
    buildCompositeBuilding(b);
  });

  // =========================================================================
  // 8. LAGOS STATE UNIVERSITY (LASU) ARCHED GATE, PERIMETER WALL & QUAD
  // =========================================================================
  {
    const gate = new THREE.Group();
    gate.position.set(-790, 0, -660);
    gate.rotation.y = Math.PI / 2;

    [-11.8, 11.8].forEach((gx) => {
      const tower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 11.2, 2.8)), texPack.stuccoCreamMat);
      tower.position.set(gx, 5.6, 0);
      tower.castShadow = true;

      const cap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.1, 0.8, 3.2)), lasuEmeraldMat);
      cap.position.set(gx, 11.4, 0);

      const trim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.8, 0.35, 3.0)), lasuGoldMat);
      trim.position.set(gx, 8.2, 0);
      gate.add(tower, cap, trim);
    });

    const portalSpan = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(26.4, 2.4, 2.4)), lasuEmeraldMat);
    portalSpan.position.set(0, 9.6, 0);
    portalSpan.castShadow = true;

    const archPediment = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(15.5, 1.4, 2.6)), texPack.stuccoCreamMat);
    archPediment.position.set(0, 11.4, 0);

    const goldCrown = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.1, 1.1, 0.45, 18)), lasuGoldMat);
    goldCrown.rotation.x = Math.PI / 2;
    goldCrown.position.set(0, 12.6, 0);

    const lasuGateTex = texPack.createSignTexture(
      'LAGOS STATE UNIVERSITY (LASU)',
      'OJO MAIN CAMPUS  •  WISDOM & EXCELLENCE',
      { bg: '#064E3B', border: '#FACC15', accent: '#FDE047', text: '#FFFFFF' }
    );
    const lasuMat = trackMat(new THREE.MeshBasicMaterial({ map: lasuGateTex }));
    const signF = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(18.5, 2.1)), lasuMat);
    signF.position.set(0, 9.6, 1.24);
    const signB = signF.clone();
    signB.position.z = -1.24;
    signB.rotation.y = Math.PI;

    gate.add(portalSpan, archPediment, goldCrown, signF, signB);
    cityGroup.add(gate);

    const buildPerimeterWall = (wx: number, wz: number, lenX: number, lenZ: number) => {
      const wall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(lenX, 2.6, lenZ)), texPack.stuccoCreamMat);
      wall.position.set(wx, 1.3, wz);
      wall.castShadow = true;
      wall.receiveShadow = true;
      const coping = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(lenX + 0.18, 0.25, lenZ + 0.18)),
        lasuEmeraldMat
      );
      coping.position.set(wx, 2.7, wz);
      cityGroup.add(wall, coping);
    };

    buildPerimeterWall(-790, -722, 0.7, 94);
    buildPerimeterWall(-790, -616, 0.7, 60);
    buildPerimeterWall(-885, -772, 190, 0.7);
    buildPerimeterWall(-885, -584, 190, 0.7);

    const quadLawn = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(36, 0.12, 22)), texPack.medianGrassMat);
    quadLawn.position.set(-905, 0.05, -690);
    quadLawn.receiveShadow = true;
    cityGroup.add(quadLawn);

    const walkway = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(38, 0.14, 3.6)), texPack.sidewalkMat);
    walkway.position.set(-905, 0.06, -690);
    walkway.receiveShadow = true;
    cityGroup.add(walkway);

    [-4, 0, 4].forEach((fz, idx) => {
      const pole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.09, 8.5, 8)), steelSilverMat);
      pole.position.set(-947, 4.25, -660 + fz);
      const flag = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.08, 1.1, 1.8)),
        idx === 1 ? lasuEmeraldMat : lasuGoldMat
      );
      flag.position.set(-947, 7.8, -659.1 + fz);
      cityGroup.add(pole, flag);
    });
  }

  // =========================================================================
  // 9. REGIONAL DANFO BUS STOPS ACROSS ALL DISTRICTS
  // =========================================================================
  {
    const danfoYellowMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.15 })
    );
    const darkMetalMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.65 })
    );

    const regionalStops = [
      { x: 18, z: -656, angle: 0, label: 'IYANA-OWORO BRIDGEHEAD' },
      { x: -245, z: -656, angle: 0, label: 'OSHODI BUS TERMINAL' },
      { x: 16, z: -862, angle: -Math.PI / 2, label: 'IKEJA CBD / ALAUSA' },
      { x: -245, z: -896, angle: 0, label: 'IYANA IPAJA FLYOVER' },
      { x: -395, z: -856, angle: 0, label: 'EGBEDA MARKET STOP' },
      { x: -535, z: -806, angle: 0, label: 'IGANDO BUS STOP' },
      { x: -668, z: -736, angle: 0, label: 'AKESAN EXPRESS STOP' },
      { x: -815, z: -644, angle: 0, label: 'LASU CAMPUS SHUTTLE' },
      { x: 175, z: -55, angle: -Math.PI / 2, label: 'ADEKUNLE / OBALENDE' },
      { x: 295, z: -145, angle: 0, label: 'IKOYI BOURDILLON STOP' },
      { x: 676, z: 42, angle: -Math.PI / 2, label: 'LEKKI ADMIRALTY STOP' },
      { x: 790, z: 116, angle: Math.PI, label: 'IKATE CHISCO STOP' },
      { x: 905, z: 116, angle: Math.PI, label: 'ELEGANZA BUS STOP' },
      { x: 1285, z: 84, angle: 0, label: 'ELEKO BEACH JUNCTION' },
      { x: 1495, z: 116, angle: Math.PI, label: 'EPE TOWN TERMINUS' },
    ];

    regionalStops.forEach((loc) => {
      if (distToNearestRoad(loc.x, loc.z) < 12.2) return;
      const sg = new THREE.Group();
      sg.position.set(loc.x, 0, loc.z);
      sg.rotation.y = loc.angle;

      const pad = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.2, 0.16, 3.4)), texPack.sidewalkMat);
      pad.position.y = 0.08;
      const roof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.0, 0.26, 3.2)), danfoYellowMat);
      roof.position.set(0, 3.2, 0);
      roof.castShadow = true;

      const stripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.05, 0.12, 0.35)), darkMetalMat);
      stripe.position.set(0, 3.2, 0.9);
      const back = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.6, 2.0, 0.12)), texPack.nightWindowCoolMat);
      back.position.set(0, 1.5, -1.1);

      const sTex = texPack.createSignTexture('BRT / DANFO STOP', loc.label, {
        bg: '#111827',
        border: '#FACC15',
        accent: '#FDE047',
      });
      const sSign = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(4.4, 0.85)),
        trackMat(new THREE.MeshBasicMaterial({ map: sTex }))
      );
      sSign.position.set(0, 3.68, 0);

      sg.add(pad, roof, stripe, back, sSign);
      cityGroup.add(sg);
    });
  }

  // =========================================================================
  // 10. EXPANDED REGIONAL PALM & SHADE VEGETATION (INSTANCED)
  // =========================================================================
  {
    const palmCoords: { x: number; z: number; scale: number; yaw: number }[] = [];
    const shadeCoords: { x: number; z: number; scale: number; yaw: number }[] = [];

    let seed = 9187;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const isClear = (x: number, z: number): boolean => {
      if (z < -158 && z > -590) return false; // Lagoon channel
      if (x > 440 && x < 600 && z >= -165) return false; // Ikoyi-Lekki channel
      if (x > 1345 && x < 1430 && z >= -165) return false; // Epe creek
      if (x > 1592) return false; // East Epe bay
      if (z > 235) return false;
      if (distToNearestRoad(x, z) < 14.8) return false;
      for (let i = 0; i < allCollidableBuildings.length; i++) {
        const b = allCollidableBuildings[i];
        if (Math.abs(x - b.x) < b.width / 2 + 4.5 && Math.abs(z - b.z) < b.depth / 2 + 4.5) {
          return false;
        }
      }
      return true;
    };

    // Obalende & Ikoyi Boulevards + VGC Palms
    for (let x = 145; x <= 430; x += 26) {
      for (let z = -148; z <= 145; z += 28) {
        const px = x + (rand() - 0.5) * 8;
        const pz = z + (rand() - 0.5) * 8;
        if (!isClear(px, pz)) continue;
        if (rand() < 0.6) {
          palmCoords.push({ x: px, z: pz, scale: 0.9 + rand() * 0.3, yaw: rand() * Math.PI * 2 });
        } else {
          shadeCoords.push({ x: px, z: pz, scale: 0.85 + rand() * 0.3, yaw: rand() * Math.PI * 2 });
        }
      }
    }

    // Lekki Peninsula -> Ikate -> Eleganza -> VGC -> Ajah -> Eleko -> Epe Coastal Palms
    for (let x = 610; x <= 1580; x += 28) {
      [-95, -45, 25, 76, 124, 175].forEach((zBase) => {
        const px = x + (rand() - 0.5) * 8;
        const pz = zBase + (rand() - 0.5) * 8;
        if (isClear(px, pz)) {
          palmCoords.push({ x: px, z: pz, scale: 0.9 + rand() * 0.35, yaw: rand() * Math.PI * 2 });
        }
      });
    }

    // Mainland Highways & LASU Campus Shade/Palm Trees
    const mainlandBands: [number, number, number, number][] = [
      [-320, 40, -915, -605],
      [-760, -320, -895, -620],
      [-960, -780, -765, -595],
    ];
    mainlandBands.forEach(([x0, x1, z0, z1]) => {
      for (let x = x0; x <= x1; x += 36) {
        for (let z = z0; z <= z1; z += 36) {
          const tx = x + (rand() - 0.5) * 14;
          const tz = z + (rand() - 0.5) * 14;
          if (!isClear(tx, tz)) continue;
          if (rand() < 0.45) {
            palmCoords.push({ x: tx, z: tz, scale: 0.85 + rand() * 0.3, yaw: rand() * Math.PI * 2 });
          } else {
            shadeCoords.push({ x: tx, z: tz, scale: 0.85 + rand() * 0.35, yaw: rand() * Math.PI * 2 });
          }
        }
      }
    });

    if (palmCoords.length > 0) {
      const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.32, 7.6, 7));
      trunkGeo.translate(0, 3.8, 0);
      const trunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x7c6248, roughness: 0.9 }));

      const frondGeo = trackGeo(new THREE.ConeGeometry(0.55, 3.4, 5));
      frondGeo.rotateX(Math.PI * 0.42);
      frondGeo.translate(0, 7.4, 1.4);
      const frondMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.72 }));

      const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCoords.length);
      const frondsPerPalm = 6;
      const frondInst = new THREE.InstancedMesh(frondGeo, frondMat, palmCoords.length * frondsPerPalm);
      const dummy = new THREE.Object3D();

      palmCoords.forEach((p, idx) => {
        dummy.position.set(p.x, 0, p.z);
        dummy.rotation.set(0.05, p.yaw, 0.04);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        trunkInst.setMatrixAt(idx, dummy.matrix);

        for (let f = 0; f < frondsPerPalm; f++) {
          dummy.position.set(p.x, 0, p.z);
          dummy.rotation.set(0, p.yaw + (f / frondsPerPalm) * Math.PI * 2, 0);
          dummy.scale.setScalar(p.scale);
          dummy.updateMatrix();
          frondInst.setMatrixAt(idx * frondsPerPalm + f, dummy.matrix);
        }
      });
      trunkInst.computeBoundingSphere();
      frondInst.computeBoundingSphere();
      cityGroup.add(trunkInst, frondInst);
    }

    if (shadeCoords.length > 0) {
      const sTrunkGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.38, 4.0, 7));
      sTrunkGeo.translate(0, 2.0, 0);
      const sTrunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x5c4330, roughness: 0.9 }));
      const canopyGeo = trackGeo(new THREE.IcosahedronGeometry(2.55, 1));
      canopyGeo.translate(0, 5.1, 0);
      const canopyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b873e, roughness: 0.8 }));

      const sTrunkInst = new THREE.InstancedMesh(sTrunkGeo, sTrunkMat, shadeCoords.length);
      const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, shadeCoords.length);
      const dummy = new THREE.Object3D();

      shadeCoords.forEach((t, idx) => {
        dummy.position.set(t.x, 0, t.z);
        dummy.rotation.set(0, t.yaw, 0);
        dummy.scale.setScalar(t.scale);
        dummy.updateMatrix();
        sTrunkInst.setMatrixAt(idx, dummy.matrix);
        canopyInst.setMatrixAt(idx, dummy.matrix);
      });
      sTrunkInst.computeBoundingSphere();
      canopyInst.computeBoundingSphere();
      cityGroup.add(sTrunkInst, canopyInst);
    }
  }
}
