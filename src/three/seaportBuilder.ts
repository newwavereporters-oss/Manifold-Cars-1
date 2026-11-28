// MANIFOLD WORLD — APAPA COMMERCIAL SEAPORT & CONTAINER TERMINAL BUILDER
// Builds the deepwater Lagos Lagoon quay wall & concrete terminal apron, moored Cargo Ship
// (MV LAGOS TRADER), 2 Ship-to-Shore (STS) gantry cranes with lightweight container offloading
// animation onto a waiting port drayage trailer chassis, RTG crane, reach stacker,
// Customs & Bonded Freight warehouses, Port Gate Arch, and systematic multi-tier grounded
// 20ft/40ft branded shipping container stacks (MAERSK, EVERGREEN, MSC, CMA CGM, Hapag-Lloyd).

import * as THREE from 'three';
import { BuildingBox, BarricadeKind, WORLD_XZ_SCALE } from '../components/world/lagosCityData';
import type { LagosTexturePack } from '../components/world/lagosTextures';
import { ContainerBrand, getContainerTextureBank } from './containerTextures';

export interface SeaportBuildParams {
  cityGroup: THREE.Group;
  texPack: LagosTexturePack;
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T;
  trackMat: <T extends THREE.Material>(m: T) => T;
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

export interface SeaportController {
  update: (delta: number, timeSec: number) => void;
}

export interface ContainerStackBlueprint {
  id: string;
  x: number;
  z: number;
  sizeFt: 20 | 40;
  tiers: 1 | 2 | 3;
  brand: ContainerBrand;
  yaw: number;
}

/**
 * Pure deterministic container stack layout inside Apapa Seaport yard
 * (x: -340*S .. -206*S, z: -108*S .. -22*S) — strictly clear of all port perimeter roads.
 * Exported so automated world integrity tests verify zero overlap with every road & rail segment.
 */
export function getApapaContainerStackLayout(S = WORLD_XZ_SCALE): ContainerStackBlueprint[] {
  const brands: ContainerBrand[] = ['MAERSK', 'EVERGREEN', 'MSC', 'CMA_CGM', 'HAPAG_LLOYD'];
  const stacks: ContainerStackBlueprint[] = [];

  // 4 Organized Bays (West/East rows separated by wide RTG/truck aisles)
  const bayCols = [-325, -296, -264, -234];
  const bayRows = [-96, -82, -62, -48, -32];

  let idx = 0;
  for (let c = 0; c < bayCols.length; c++) {
    for (let r = 0; r < bayRows.length; r++) {
      // Leave central aisle open at row index 2 on middle columns for RTG & reach stacker showcase
      if (r === 2 && (c === 1 || c === 2)) continue;
      // Leave space for reach stacker showcase at Bay C south-east
      if (c === 3 && r === 4) continue;

      const sizeFt: 20 | 40 = (c + r) % 3 === 0 ? 20 : 40;
      const tiers: 1 | 2 | 3 = ((c * 2 + r) % 3 === 0 ? 3 : (c + r) % 2 === 0 ? 2 : 1) as 1 | 2 | 3;
      const brand = brands[(idx * 3 + c) % brands.length];
      // Slight realistic placement micro-variation (never overlaps neighboring bays)
      const jitterX = (((idx * 17) % 7) - 3) * 0.22;
      const jitterZ = (((idx * 13) % 5) - 2) * 0.14;
      const yaw = (((idx * 19) % 5) - 2) * 0.014;

      if (sizeFt === 20) {
        // Pair two 20ft containers cleanly end-to-end with gap
        stacks.push({
          id: `PORT_CONT_${idx}_A`,
          x: bayCols[c] * S - 3.6 + jitterX,
          z: bayRows[r] * S + jitterZ,
          sizeFt: 20,
          tiers,
          brand,
          yaw,
        });
        stacks.push({
          id: `PORT_CONT_${idx}_B`,
          x: bayCols[c] * S + 3.6 + jitterX,
          z: bayRows[r] * S - jitterZ,
          sizeFt: 20,
          tiers: tiers === 3 ? 2 : 1,
          brand: brands[(idx + 2) % brands.length],
          yaw: -yaw,
        });
      } else {
        stacks.push({
          id: `PORT_CONT_${idx}`,
          x: bayCols[c] * S + jitterX,
          z: bayRows[r] * S + jitterZ,
          sizeFt: 40,
          tiers,
          brand,
          yaw,
        });
      }
      idx++;
    }
  }

  return stacks;
}

export function buildApapaSeaport({
  cityGroup,
  texPack,
  trackGeo,
  trackMat,
  allCollidableBuildings,
  buildCompositeBuilding,
  addBarricade,
  S,
}: SeaportBuildParams): SeaportController {
  const portGroup = new THREE.Group();
  portGroup.name = 'APAPA_MARITIME_SEAPORT';
  const containerBank = getContainerTextureBank();

  // Shared Port Materials
  const apronConcreteMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9, metalness: 0.05 })
  );
  const yardSlabMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.88, metalness: 0.06 })
  );
  const craneRedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.36, metalness: 0.45 })
  );
  const craneYellowMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.38, metalness: 0.35 })
  );
  const steelDarkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.46, metalness: 0.72 })
  );
  const steelLightMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.32, metalness: 0.78 })
  );
  const hullNavyMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0f2744, roughness: 0.42, metalness: 0.32 })
  );
  const hullOxideMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.55, metalness: 0.18 })
  );
  const shipSuperMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.38, metalness: 0.12 })
  );
  const glassCabMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.12, metalness: 0.75 })
  );
  const fenderRubberMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, metalness: 0.05 })
  );

  // Build reusable materials per shipping line brand (6 faces: side, side, top, bottom, doors, front)
  const brandMaterials: Record<ContainerBrand, THREE.MeshStandardMaterial[]> = {} as Record<
    ContainerBrand,
    THREE.MeshStandardMaterial[]
  >;
  const bump = containerBank?.corrugationBump ?? null;
  (['MAERSK', 'EVERGREEN', 'MSC', 'CMA_CGM', 'HAPAG_LLOYD'] as ContainerBrand[]).forEach((b) => {
    const entry = containerBank?.brands[b];
    const sideMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: entry ? 0xffffff : 0x38a3d0,
        map: entry?.sideMap ?? null,
        bumpMap: bump,
        bumpScale: 0.04,
        roughness: 0.56,
        metalness: 0.35,
      })
    );
    const roofMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: entry?.baseHex ?? 0x38a3d0,
        bumpMap: bump,
        bumpScale: 0.03,
        roughness: 0.62,
        metalness: 0.32,
      })
    );
    const endMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: entry ? 0xffffff : 0x38a3d0,
        map: entry?.endMap ?? null,
        roughness: 0.52,
        metalness: 0.38,
      })
    );
    // BoxGeometry face order: +X (right/end), -X (left/end), +Y (top), -Y (bottom), +Z (side), -Z (side)
    brandMaterials[b] = [endMat, endMat, roofMat, roofMat, sideMat, sideMat];
  });

  // Helper to create a properly proportioned 20ft or 40ft container box
  // Length runs along X so East-West yard rows match naturally
  const geo40 = trackGeo(new THREE.BoxGeometry(12.2, 2.6, 2.48));
  const geo20 = trackGeo(new THREE.BoxGeometry(6.1, 2.6, 2.48));

  const createContainerMesh = (sizeFt: 20 | 40, brand: ContainerBrand): THREE.Mesh => {
    const mesh = new THREE.Mesh(sizeFt === 40 ? geo40 : geo20, brandMaterials[brand]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // =========================================================================
  // 1. DEEPWATER CONCRETE QUAY APRON, CONTAINER YARD PAD & MOORING BOLLARDS
  // =========================================================================
  {
    // Waterside Quay Apron (strictly north of N_PORT_QUAY_W..E road: z = -165*S .. -140*S)
    const quayW = 235 * S;
    const quayD = 25 * S;
    const quayApron = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(quayW, 0.24, quayD)), apronConcreteMat);
    quayApron.position.set(-280 * S, -0.04, -152.5 * S);
    quayApron.receiveShadow = true;
    portGroup.add(quayApron);

    // Crane Rail Track pair along quay apron (z = -160*S & z = -146*S)
    [-160 * S, -146 * S].forEach((rz) => {
      const rail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(205 * S, 0.16, 0.36)), steelLightMat);
      rail.position.set(-275 * S, 0.12, rz);
      portGroup.add(rail);
    });

    // Yellow Quay Edge Safety Striping & Marine Timber/Rubber Fenders + Mooring Bollards
    const safetyEdge = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(235 * S, 0.08, 0.8)),
      texPack.yellowMarkMat
    );
    safetyEdge.position.set(-280 * S, 0.11, -163.5 * S);
    portGroup.add(safetyEdge);

    for (let bx = -385 * S; bx <= -175 * S; bx += 26) {
      const bollardBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.45, 0.55, 0.3, 10)), steelDarkMat);
      bollardBase.position.set(bx, 0.18, -163.6 * S);
      const bollardHead = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.32, 0.26, 0.72, 10)),
        craneYellowMat
      );
      bollardHead.position.set(bx, 0.65, -163.6 * S);
      const fender = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.8, 1.8, 1.1)), fenderRubberMat);
      fender.position.set(bx + 10, -0.45, -165.4 * S);
      portGroup.add(bollardBase, bollardHead, fender);
    }

    // Central Container Yard Concrete Pad (between North & South Seaport Roads)
    const yardPad = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(156 * S, 0.16, 98 * S)), yardSlabMat);
    yardPad.position.set(-274 * S, -0.02, -65 * S);
    yardPad.receiveShadow = true;
    portGroup.add(yardPad);

    // Terminal Yard Bay Lane Paint Lines
    [-108 * S, -73 * S, -22 * S].forEach((lz) => {
      const stripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(148 * S, 0.04, 0.4)), texPack.yellowMarkMat);
      stripe.position.set(-274 * S, 0.07, lz);
      portGroup.add(stripe);
    });
  }

  // =========================================================================
  // 2. MOORED CONTAINER CARGO VESSEL ("MV LAGOS TRADER") ALONGSIDE QUAY
  // =========================================================================
  {
    const ship = new THREE.Group();
    ship.position.set(-275 * S, -1.5, -187 * S);

    // Lower oxide anti-fouling hull + upper deep navy hull
    const lowerHull = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(132, 4.2, 22)), hullOxideMat);
    lowerHull.position.set(0, 1.8, 0);
    const upperHull = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(136, 6.2, 23)), hullNavyMat);
    upperHull.position.set(0, 6.6, 0);
    upperHull.castShadow = true;

    // Tapered Bow Forecastle
    const bowShape = new THREE.Shape();
    bowShape.moveTo(0, -11.5);
    bowShape.lineTo(24, 0);
    bowShape.lineTo(0, 11.5);
    bowShape.closePath();
    const bowGeo = trackGeo(
      new THREE.ExtrudeGeometry(bowShape, {
        depth: 6.4,
        bevelEnabled: true,
        bevelThickness: 0.4,
        bevelSize: 0.4,
        bevelSegments: 2,
      })
    );
    bowGeo.rotateX(-Math.PI / 2);
    const bow = new THREE.Mesh(bowGeo, hullNavyMat);
    bow.position.set(67.5, 3.6, 0);
    bow.castShadow = true;

    // Main Cargo Deck Plate + Coaming Borders
    const deck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(130, 0.6, 21.6)), steelDarkMat);
    deck.position.set(0, 9.9, 0);
    deck.receiveShadow = true;

    // Aft Bridge Superstructure (Multi-level white command tower + funnel + radar mast)
    const bridgeLower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(16, 10, 19.5)), shipSuperMat);
    bridgeLower.position.set(-48, 15.0, 0);
    bridgeLower.castShadow = true;

    const bridgeUpper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(11, 5.5, 22)), shipSuperMat);
    bridgeUpper.position.set(-46, 22.4, 0);
    bridgeUpper.castShadow = true;

    const bridgeGlass = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(11.3, 1.8, 22.3)), glassCabMat);
    bridgeGlass.position.set(-46, 23.1, 0);

    const funnel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.7, 2.2, 6.2, 12)), craneRedMat);
    funnel.position.set(-56, 21.5, 0);
    const funnelCap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.75, 1.75, 1.1, 12)), steelDarkMat);
    funnelCap.position.set(-56, 24.9, 0);

    const mast = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.18, 0.35, 8, 8)), steelLightMat);
    mast.position.set(-45, 28.8, 0);

    ship.add(lowerHull, upperHull, bow, deck, bridgeLower, bridgeUpper, bridgeGlass, funnel, funnelCap, mast);

    // Stacked Deck Containers on Ship Cargo Holds (all 5 brands represented!)
    const deckBaysX = [-26, -12, 2, 16, 30, 44];
    const deckLanesZ = [-6.0, -3.0, 0, 3.0, 6.0];
    const brandList: ContainerBrand[] = ['MAERSK', 'EVERGREEN', 'MSC', 'CMA_CGM', 'HAPAG_LLOYD'];
    let deckIdx = 0;

    for (let bx = 0; bx < deckBaysX.length; bx++) {
      for (let lz = 0; lz < deckLanesZ.length; lz++) {
        // Leave Crane 1 active target bay (bx=1, lz=2) at 1 tier so crane hovers over open slot cleanly
        const tiers = bx === 1 && lz === 2 ? 1 : ((bx + lz) % 3) + 1;
        for (let t = 0; t < tiers; t++) {
          const cont = createContainerMesh(40, brandList[(deckIdx + t) % brandList.length]);
          cont.position.set(deckBaysX[bx], 10.2 + 1.3 + t * 2.6, deckLanesZ[lz]);
          ship.add(cont);
        }
        deckIdx++;
      }
    }

    // Thick Mooring Hawsers from ship bow & stern to quay bollards
    [-54, 52].forEach((mx) => {
      const lineGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 28, 6));
      lineGeo.rotateX(Math.PI / 2);
      const line = new THREE.Mesh(lineGeo, craneYellowMat);
      line.position.set(-275 * S + mx, 3.2, -171 * S);
      line.rotation.x = 0.22;
      portGroup.add(line);
    });

    portGroup.add(ship);
  }

  // =========================================================================
  // 3. TWO STS SHIP-TO-SHORE GANTRY CRANES + ANIMATED CONTAINER OFFLOADING
  // =========================================================================
  let crane1Trolley: THREE.Group | null = null;
  let crane1HoistCableL: THREE.Mesh | null = null;
  let crane1HoistCableR: THREE.Mesh | null = null;
  let crane1SpreaderGroup: THREE.Group | null = null;
  let crane1LoadContainer: THREE.Mesh | null = null;

  const buildSTSCrane = (cx: number, cz: number, animated: boolean) => {
    const cg = new THREE.Group();
    cg.position.set(cx, 0, cz);

    // 4 Massive Portal Legs straddling crane rails (rail spacing +/- 11.5m along Z, span 14m along X)
    const legH = 26;
    const legOffsets: [number, number][] = [
      [-7.2, -11.0],
      [7.2, -11.0],
      [-7.2, 11.0],
      [7.2, 11.0],
    ];
    legOffsets.forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.5, legH, 1.5)), craneRedMat);
      leg.position.set(lx, legH / 2, lz);
      leg.castShadow = true;
      const bogie = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.4, 1.4, 2.2)), steelDarkMat);
      bogie.position.set(lx, 0.7, lz);
      cg.add(leg, bogie);
    });

    // Cross Portal Bracing (overhead clearance y = 10.5m, completely off-road on apron)
    [-11.0, 11.0].forEach((lz) => {
      const sill = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(16.2, 1.6, 1.6)), craneRedMat);
      sill.position.set(0, 11.5, lz);
      cg.add(sill);
    });
    [-7.2, 7.2].forEach((lx) => {
      const tie = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.4, 1.6, 24)), craneRedMat);
      tie.position.set(lx, 25.5, 0);
      cg.add(tie);
    });

    // Apex A-Frame Mast & Stay Cables
    const mastH = 14;
    [-7.2, 7.2].forEach((lx) => {
      const apex = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.2, mastH, 1.4)), craneRedMat);
      apex.position.set(lx, 26 + mastH / 2, 2.0);
      cg.add(apex);
    });
    const apexBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(16, 1.2, 1.8)), craneRedMat);
    apexBeam.position.set(0, 40, 2.0);
    cg.add(apexBeam);

    // Main Horizontal Cantilever Boom (extends from +14m inland out to -44m over cargo ship!)
    [-4.2, 4.2].forEach((bx) => {
      const girder = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 1.8, 58)), craneRedMat);
      girder.position.set(bx, 27.2, -15);
      girder.castShadow = true;
      cg.add(girder);
    });

    // White Machinery House on Backreach
    const machHouse = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10.5, 4.4, 8.2)), shipSuperMat);
    machHouse.position.set(0, 29.8, 12.0);
    cg.add(machHouse);

    // Stay Rods from Apex to Boom Tips
    [-4.2, 4.2].forEach((bx) => {
      const stayF = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 41, 6)), steelLightMat);
      stayF.position.set(bx, 33.8, -17.5);
      stayF.rotation.x = 1.25;
      cg.add(stayF);
    });

    if (animated) {
      // Moving Trolley + Operator Cab + Spreader + Offloaded 40ft MAERSK Container
      const trolley = new THREE.Group();
      trolley.position.set(0, 26.1, -28);

      const carriage = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.4, 0.9, 5.4)), craneYellowMat);
      const opCab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 2.4, 2.8)), shipSuperMat);
      opCab.position.set(3.8, -1.6, 1.2);
      const cabGlass = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.7, 1.2, 2.9)), glassCabMat);
      cabGlass.position.set(3.8, -1.8, 1.2);
      trolley.add(carriage, opCab, cabGlass);

      // Vertical hoist cables (scaled dynamically along Y without allocations)
      const cableGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 6));
      const cableL = new THREE.Mesh(cableGeo, steelDarkMat);
      cableL.position.set(-3.2, -4.0, 0);
      const cableR = new THREE.Mesh(cableGeo, steelDarkMat);
      cableR.position.set(3.2, -4.0, 0);
      trolley.add(cableL, cableR);

      // Spreader Head + 40ft MAERSK Container
      const spreaderGroup = new THREE.Group();
      spreaderGroup.position.set(0, -8.0, 0);
      const spreaderBar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12.3, 0.7, 2.55)), craneYellowMat);
      const loadCont = createContainerMesh(40, 'MAERSK');
      loadCont.position.set(0, -1.65, 0);
      spreaderGroup.add(spreaderBar, loadCont);
      trolley.add(spreaderGroup);

      cg.add(trolley);
      crane1Trolley = trolley;
      crane1HoistCableL = cableL;
      crane1HoistCableR = cableR;
      crane1SpreaderGroup = spreaderGroup;
      crane1LoadContainer = loadCont;
    } else {
      // Static parked trolley on Crane 2
      const trolley2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.0, 1.2, 5.0)), craneYellowMat);
      trolley2.position.set(0, 26.0, -18.0);
      cg.add(trolley2);
    }

    portGroup.add(cg);

    // Register Crane Leg Bases as colliders
    legOffsets.forEach(([lx, lz], lIdx) => {
      addBarricade(`PORT_STS_${Math.round(cx)}_${lIdx}`, cx + lx, 0, cz + lz, 1.9, 1.3, 0, 'GANTRY_PILLAR');
    });
  };

  // Place both STS Cranes cleanly along quay apron (z = -153*S, well north of N_PORT_QUAY road)
  const crane1X = -296 * S;
  const crane1Z = -153 * S;
  buildSTSCrane(crane1X, crane1Z, true);
  buildSTSCrane(-248 * S, -153 * S, false);

  // =========================================================================
  // 4. WAITING PORT DRAYAGE TRACTOR + SKELETAL CHASSIS UNDER CRANE 1 (OFF-ROAD)
  // =========================================================================
  {
    const parkX = crane1X;
    const parkZ = crane1Z;
    const yardTruck = new THREE.Group();
    yardTruck.position.set(parkX, 0, parkZ);

    const chassisMat = steelDarkMat;
    const cabMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.35, metalness: 0.4 }));
    const tireMat = fenderRubberMat;

    // Skeletal 40ft container trailer chassis facing +X along apron
    const beam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12.6, 0.35, 2.2)), chassisMat);
    beam.position.set(0, 1.05, 0);
    const tractorCab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.2, 2.9, 2.35)), cabMat);
    tractorCab.position.set(7.8, 1.85, 0);
    tractorCab.castShadow = true;
    const tractorWindshield = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 1.0, 2.1)), glassCabMat);
    tractorWindshield.position.set(9.42, 2.25, 0);

    const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.5, 0.5, 0.38, 12));
    wheelGeo.rotateX(Math.PI / 2);
    [-4.6, -3.2, 5.8, 8.6].forEach((wx) => {
      [-1.1, 1.1].forEach((wz) => {
        const w = new THREE.Mesh(wheelGeo, tireMat);
        w.position.set(wx, 0.5, wz);
        yardTruck.add(w);
      });
    });

    yardTruck.add(beam, tractorCab, tractorWindshield);
    portGroup.add(yardTruck);
    addBarricade('PORT_YARD_TRAILER_CHASSIS', parkX + 1.5, 0, parkZ, 8.4, 1.5, 0, 'WALL');
  }

  // =========================================================================
  // 5. ORGANIZED MULTI-TIER 20FT & 40FT CONTAINER STACKS + RTG & REACH STACKER
  // =========================================================================
  {
    const stackLayout = getApapaContainerStackLayout(S);
    stackLayout.forEach((st) => {
      const halfL = st.sizeFt === 40 ? 6.15 : 3.1;
      for (let t = 0; t < st.tiers; t++) {
        const cont = createContainerMesh(st.sizeFt, st.brand);
        cont.position.set(st.x, 1.3 + t * 2.6, st.z);
        cont.rotation.y = st.yaw;
        portGroup.add(cont);
      }
      // Solid grounded collider for every stack footprint
      addBarricade(st.id, st.x, 0, st.z, halfL, 1.28, st.yaw, 'WALL');
    });

    // Rubber-Tyred Gantry (RTG) Yard Crane straddling Bay B (x = -296*S, z = -70*S)
    const rtgX = -296 * S;
    const rtgZ = -70 * S;
    const rtg = new THREE.Group();
    rtg.position.set(rtgX, 0, rtgZ);
    [
      [-7.2, -5.2],
      [7.2, -5.2],
      [-7.2, 5.2],
      [7.2, 5.2],
    ].forEach(([lx, lz], idx) => {
      const leg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.95, 13.5, 0.95)), craneYellowMat);
      leg.position.set(lx, 6.75, lz);
      leg.castShadow = true;
      const wheel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.75, 0.75, 0.65, 12)), fenderRubberMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(lx, 0.75, lz);
      rtg.add(leg, wheel);
      addBarricade(`PORT_RTG_LEG_${idx}`, rtgX + lx, 0, rtgZ + lz, 0.7, 0.7, 0, 'GANTRY_PILLAR');
    });
    const rtgBridge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(16.2, 1.4, 11.8)), craneYellowMat);
    rtgBridge.position.set(0, 14.0, 0);
    rtgBridge.castShadow = true;
    const rtgTrolley = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.2, 1.0, 3.6)), craneRedMat);
    rtgTrolley.position.set(1.2, 13.0, 0);
    rtg.add(rtgBridge, rtgTrolley);
    portGroup.add(rtg);

    // Reach Stacker Container Handler near Bay D (x = -234*S, z = -32*S)
    const rsX = -234 * S;
    const rsZ = -32 * S;
    const rs = new THREE.Group();
    rs.position.set(rsX, 0, rsZ);
    rs.rotation.y = Math.PI * 0.18;
    const rsBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.2, 2.2, 6.2)), craneYellowMat);
    rsBody.position.set(0, 1.5, 0);
    const rsCab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.9, 1.9, 2.2)), glassCabMat);
    rsCab.position.set(0, 2.9, 0.4);
    const rsBoom = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.85, 0.95, 7.6)), craneRedMat);
    rsBoom.position.set(0, 4.4, 2.2);
    rsBoom.rotation.x = -0.45;
    const rsSpreader = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.4, 0.55, 2.5)), steelDarkMat);
    rsSpreader.position.set(0, 6.2, 5.1);
    const rsCont = createContainerMesh(20, 'HAPAG_LLOYD');
    rsCont.position.set(0, 4.65, 5.1);
    rs.add(rsBody, rsCab, rsBoom, rsSpreader, rsCont);
    portGroup.add(rs);
    addBarricade('PORT_REACH_STACKER', rsX, 0, rsZ, 2.2, 4.0, Math.PI * 0.18, 'WALL');
  }

  // =========================================================================
  // 6. CUSTOMS / PORT AUTHORITY COMPLEX, FREIGHT SHED & PORT GATE ARCH
  // =========================================================================
  {
    const portBuildings: BuildingBox[] = [
      {
        id: 'B_APAPA_CUSTOMS',
        x: -235 * S,
        z: 42 * S,
        width: 34,
        depth: 24,
        height: 16,
        name: 'NPA Apapa Seaport Customs & Control',
        type: 'depot',
        color: 0x0f2744,
        roofColor: 0x0284c7,
        hasSign: true,
        signText: 'APAPA PORT AUTHORITY & CUSTOMS',
      },
      {
        id: 'B_APAPA_FREIGHT_SHED',
        x: -305 * S,
        z: 42 * S,
        width: 44,
        depth: 26,
        height: 12,
        name: 'Apapa Bonded Container Freight Warehouse',
        type: 'depot',
        color: 0x334155,
        roofColor: 0xea580c,
        hasSign: true,
        signText: 'BONDED CONTAINER TERMINAL',
      },
    ];

    portBuildings.forEach((pb) => {
      allCollidableBuildings.push(pb);
      buildCompositeBuilding(pb);
    });

    // Port Entry Gate Arch spanning N_PORT_ACCESS_E <-> N_SURULERE_MID at x = -146*S, z = 0
    const archX = -146 * S;
    const archZ = 0;
    const arch = new THREE.Group();
    arch.position.set(archX, 0, archZ);
    arch.rotation.y = Math.PI / 2;

    [-17.2, 17.2].forEach((px, idx) => {
      const col = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.2, 9.6, 2.4)), steelDarkMat);
      col.position.set(px, 4.8, 0);
      col.castShadow = true;
      arch.add(col);
      // Gate rotated PI/2: local X -> world -Z
      addBarricade(`APAPA_PORT_ARCH_${idx}`, archX, 0, archZ - px, 1.3, 1.3, 0, 'GANTRY_PILLAR');
    });

    const beam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(36.8, 2.2, 2.2)), hullNavyMat);
    beam.position.set(0, 9.4, 0);
    beam.castShadow = true;

    const gateTex = texPack.createSignTexture(
      'APAPA COMMERCIAL SEAPORT',
      'CONTAINER TERMINAL • TRUCK LOGISTICS HUB',
      { bg: '#0F2744', border: '#FACC15', accent: '#38BDF8', text: '#FFFFFF' }
    );
    const gateMat = trackMat(new THREE.MeshBasicMaterial({ map: gateTex }));
    const signF = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(24, 2.2)), gateMat);
    signF.position.set(0, 9.4, 1.15);
    const signB = signF.clone();
    signB.position.z = -1.15;
    signB.rotation.y = Math.PI;
    arch.add(beam, signF, signB);
    portGroup.add(arch);

    // High-Mast Port Floodlight Towers (strictly on container yard corners, off road)
    [
      [-342 * S, -108 * S],
      [-206 * S, -108 * S],
      [-342 * S, -22 * S],
      [-206 * S, -22 * S],
    ].forEach(([fx, fz], fIdx) => {
      const pole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.28, 0.45, 22, 8)), steelLightMat);
      pole.position.set(fx, 11, fz);
      const head = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.2, 0.8, 1.6)), texPack.streetlightBulbMat);
      head.position.set(fx, 22.2, fz);
      portGroup.add(pole, head);
      addBarricade(`PORT_FLOOD_MAST_${fIdx}`, fx, 0, fz, 0.65, 0.65, 0, 'GANTRY_PILLAR');
    });
  }

  cityGroup.add(portGroup);

  // =========================================================================
  // 7. LIGHTWEIGHT STABLE CONTAINER OFFLOADING ANIMATION (ZERO GC)
  // =========================================================================
  const update = (_delta: number, timeSec: number) => {
    if (!crane1Trolley || !crane1SpreaderGroup || !crane1HoistCableL || !crane1HoistCableR || !crane1LoadContainer) {
      return;
    }
    // 18-second smooth offloading cycle:
    // 0.00..0.20: Hoist up from Ship Cargo Hold (z=-34)
    // 0.20..0.55: Trolley travels shoreward along boom (z=-34 -> z=0 over waiting truck chassis)
    // 0.55..0.72: Lower container down onto waiting trailer bed (y=1.25)
    // 0.72..0.82: Pause & release/pickup, raise spreader slightly
    // 0.82..1.00: Trolley glides back over ship hold
    const cycle = (timeSec % 18) / 18;
    let trolleyZ = -34;
    let spreaderDrop = 4.5; // positive drop below trolley (y=26.1)
    let hasLoad = true;

    if (cycle < 0.2) {
      const k = cycle / 0.2;
      const smooth = k * k * (3 - 2 * k);
      trolleyZ = -34;
      spreaderDrop = 11.2 - smooth * 6.7; // 11.2 -> 4.5
      hasLoad = true;
    } else if (cycle < 0.52) {
      const k = (cycle - 0.2) / 0.32;
      const smooth = k * k * (3 - 2 * k);
      trolleyZ = -34 + smooth * 34; // -34 -> 0
      spreaderDrop = 4.5;
      hasLoad = true;
    } else if (cycle < 0.72) {
      const k = (cycle - 0.52) / 0.2;
      const smooth = k * k * (3 - 2 * k);
      trolleyZ = 0;
      // Trolley is at y=26.1; container center is -1.65 below spreader; trailer top is ~1.25 -> container center at y=2.55 -> spreader at y=4.2 -> drop = 21.9
      spreaderDrop = 4.5 + smooth * 17.4;
      hasLoad = true;
    } else if (cycle < 0.82) {
      const k = (cycle - 0.72) / 0.1;
      const smooth = k * k * (3 - 2 * k);
      trolleyZ = 0;
      spreaderDrop = 21.9 - smooth * 17.4;
      hasLoad = false;
    } else {
      const k = (cycle - 0.82) / 0.18;
      const smooth = k * k * (3 - 2 * k);
      trolleyZ = -smooth * 34; // 0 -> -34
      spreaderDrop = 4.5 + (k > 0.7 ? ((k - 0.7) / 0.3) * 6.7 : 0);
      hasLoad = false;
    }

    crane1Trolley.position.z = trolleyZ;
    crane1SpreaderGroup.position.y = -spreaderDrop;
    crane1HoistCableL.position.y = -spreaderDrop * 0.5;
    crane1HoistCableL.scale.y = Math.max(0.5, spreaderDrop);
    crane1HoistCableR.position.y = -spreaderDrop * 0.5;
    crane1HoistCableR.scale.y = Math.max(0.5, spreaderDrop);
    crane1LoadContainer.visible = hasLoad;
  };

  return { update };
}
