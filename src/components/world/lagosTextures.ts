// MANIFOLD WORLD - PROCEDURAL TEXTURE & MATERIAL LIBRARY FOR LAGOS MAINLAND
// Zero-404, deterministic high-DPI CanvasTextures with proper sRGB/Linear color management & disposal tracking.

import * as THREE from 'three';

export interface LagosTexturePack {
  expresswayRoadMat: THREE.MeshStandardMaterial;
  commercialRoadMat: THREE.MeshStandardMaterial;
  sidewalkMat: THREE.MeshStandardMaterial;
  curbMat: THREE.MeshStandardMaterial;
  drainageMat: THREE.MeshStandardMaterial;
  groundTerrainMat: THREE.MeshStandardMaterial;
  medianGrassMat: THREE.MeshStandardMaterial;
  glassTowerMat: THREE.MeshStandardMaterial;
  bankGlassMat: THREE.MeshStandardMaterial;
  stuccoCreamMat: THREE.MeshStandardMaterial;
  stuccoOchreMat: THREE.MeshStandardMaterial;
  stuccoSlateMat: THREE.MeshStandardMaterial;
  corrugatedDepotMat: THREE.MeshStandardMaterial;
  roofConcreteMat: THREE.MeshStandardMaterial;
  yellowMarkMat: THREE.MeshStandardMaterial;
  whiteMarkMat: THREE.MeshStandardMaterial;
  streetlightBulbMat: THREE.MeshStandardMaterial;
  nightWindowWarmMat: THREE.MeshStandardMaterial;
  nightWindowCoolMat: THREE.MeshStandardMaterial;
  createSignTexture: (
    title: string,
    subtitle: string,
    opts?: { bg?: string; border?: string; accent?: string; text?: string }
  ) => THREE.CanvasTexture;
  createPavementStencilTexture: (label: string, bgAlpha?: boolean) => THREE.CanvasTexture;
  updateTimeOfDay: (mode: 'DAYLIGHT' | 'SUNSET' | 'MIDNIGHT' | 'GOLDEN_HOUR') => void;
  dispose: () => void;
}

function makeNoiseCanvas(
  size: number,
  drawFn: (ctx: CanvasRenderingContext2D, size: number) => void
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawFn(ctx, size);
  }
  return canvas;
}

export function createLagosTexturePack(maxAnisotropy: number = 4): LagosTexturePack {
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];

  const registerTex = (
    canvas: HTMLCanvasElement,
    {
      srgb = true,
      repeatX = 1,
      repeatY = 1,
    }: { srgb?: boolean; repeatX?: number; repeatY?: number } = {}
  ): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
    tex.needsUpdate = true;
    textures.push(tex);
    return tex;
  };

  const registerMat = <T extends THREE.Material>(mat: T): T => {
    materials.push(mat);
    return mat;
  };

  // 1. ASPHALT TEXTURES (Expressway dark tarmac + wear streaks & street aggregate)
  const asphaltCanvas = makeNoiseCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#252c36';
    ctx.fillRect(0, 0, s, s);
    // Subtle wheel track darkening
    ctx.fillStyle = 'rgba(12, 16, 22, 0.22)';
    ctx.fillRect(42, 0, 36, s);
    ctx.fillRect(178, 0, 36, s);
    // Mineral aggregate speckles
    for (let i = 0; i < 3200; i++) {
      const x = (i * 73) % s;
      const y = (i * 137 + Math.floor(i / 4) * 19) % s;
      const v = 28 + ((i * 29) % 36);
      ctx.fillStyle = `rgb(${v},${v + 3},${v + 7})`;
      ctx.fillRect(x, y, 2, 2);
    }
  });
  const asphaltTex = registerTex(asphaltCanvas, { srgb: true, repeatX: 2, repeatY: 10 });

  const asphaltRoughCanvas = makeNoiseCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#9e9e9e';
    ctx.fillRect(42, 0, 36, s);
    ctx.fillRect(178, 0, 36, s);
    for (let i = 0; i < 2000; i++) {
      const x = (i * 97) % s;
      const y = (i * 53 + i) % s;
      const g = 150 + ((i * 41) % 85);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(x, y, 2, 2);
    }
  });
  const asphaltRoughTex = registerTex(asphaltRoughCanvas, { srgb: false, repeatX: 2, repeatY: 10 });

  const expresswayRoadMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0x2c3440,
      map: asphaltTex,
      roughnessMap: asphaltRoughTex,
      roughness: 0.78,
      metalness: 0.08,
    })
  );

  const commercialRoadMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b4452,
      map: asphaltTex,
      roughnessMap: asphaltRoughTex,
      roughness: 0.84,
      metalness: 0.06,
    })
  );

  // 2. SIDEWALK INTERLOCK CONCRETE PAVING
  const sidewalkCanvas = makeNoiseCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#9aa5b4';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(55, 65, 81, 0.35)';
    ctx.lineWidth = 2;
    const step = 32;
    for (let y = 0; y < s; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s, y);
      ctx.stroke();
      const offset = (y / step) % 2 === 0 ? 0 : step / 2;
      for (let x = offset; x < s; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + step);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 900; i++) {
      const x = (i * 89) % s;
      const y = (i * 149) % s;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(30,41,59,0.07)';
      ctx.fillRect(x, y, 2, 2);
    }
  });
  const sidewalkTex = registerTex(sidewalkCanvas, { srgb: true, repeatX: 2, repeatY: 14 });
  const sidewalkMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0xbac4d0,
      map: sidewalkTex,
      roughness: 0.88,
      metalness: 0.04,
    })
  );

  const curbMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0x8794a5,
      roughness: 0.8,
      metalness: 0.08,
    })
  );

  const drainageMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9,
      metalness: 0.15,
    })
  );

  // 3. CITY GROUND & TROPICAL MEDIAN GRASS
  const terrainCanvas = makeNoiseCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#6f7c6b';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2400; i++) {
      const x = (i * 61) % s;
      const y = (i * 113) % s;
      ctx.fillStyle =
        i % 3 === 0 ? 'rgba(90, 108, 82, 0.35)' : i % 3 === 1 ? 'rgba(128, 118, 96, 0.22)' : 'rgba(64, 78, 62, 0.25)';
      ctx.fillRect(x, y, 4, 4);
    }
  });
  const terrainTex = registerTex(terrainCanvas, { srgb: true, repeatX: 26, repeatY: 26 });
  const groundTerrainMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0x7c8a76,
      map: terrainTex,
      roughness: 0.92,
      metalness: 0.02,
    })
  );

  const medianGrassMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0x3f7d44,
      roughness: 0.88,
      metalness: 0.02,
    })
  );

  // 4. ARCHITECTURAL FACADE TEXTURES (Glass Curtain Wall, Stucco, Corrugated Industrial)
  const glassFacadeCanvas = makeNoiseCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#14314f';
    ctx.fillRect(0, 0, s, s);
    // Subtle sky gradient per pane
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const px = col * 64 + 4;
        const py = row * 64 + 4;
        const grad = ctx.createLinearGradient(px, py, px, py + 56);
        grad.addColorStop(0, '#3876a8');
        grad.addColorStop(1, '#183b5c');
        ctx.fillStyle = grad;
        ctx.fillRect(px, py, 56, 56);
      }
    }
    // Aluminum mullions
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 6;
    for (let i = 0; i <= s; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(s, i);
      ctx.stroke();
    }
  });
  const glassTex = registerTex(glassFacadeCanvas, { srgb: true, repeatX: 3, repeatY: 4 });

  const glassEmissiveCanvas = makeNoiseCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, s, s);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        // Deterministic pattern of lit vs dark rooms
        const lit = (row * 7 + col * 11) % 5 !== 0;
        if (lit) {
          ctx.fillStyle = (row + col) % 2 === 0 ? '#93c5fd' : '#fde68a';
          ctx.fillRect(col * 64 + 7, row * 64 + 7, 50, 50);
        }
      }
    }
  });
  const glassEmissiveTex = registerTex(glassEmissiveCanvas, { srgb: true, repeatX: 3, repeatY: 4 });

  const glassTowerMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      map: glassTex,
      emissive: 0xffffff,
      emissiveMap: glassEmissiveTex,
      emissiveIntensity: 0.18,
      roughness: 0.14,
      metalness: 0.72,
    })
  );

  const bankGlassMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      map: glassTex,
      emissive: 0xfef3c7,
      emissiveMap: glassEmissiveTex,
      emissiveIntensity: 0.16,
      roughness: 0.12,
      metalness: 0.8,
    })
  );

  const makeStuccoTexture = (baseHex: string, trimHex: string) => {
    const c = makeNoiseCanvas(256, (ctx, s) => {
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, s, s);
      // Subtle plaster grain
      for (let i = 0; i < 1600; i++) {
        const x = (i * 83) % s;
        const y = (i * 151) % s;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)';
        ctx.fillRect(x, y, 3, 3);
      }
      // Architectural floor band reveals
      ctx.fillStyle = trimHex;
      for (let y = 0; y < s; y += 64) {
        ctx.fillRect(0, y, s, 4);
      }
    });
    return registerTex(c, { srgb: true, repeatX: 2, repeatY: 3 });
  };

  const stuccoCreamMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1ece1,
      map: makeStuccoTexture('#e6dfd1', '#cbbba2'),
      roughness: 0.82,
      metalness: 0.04,
    })
  );

  const stuccoOchreMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2b98a,
      map: makeStuccoTexture('#d8ad7b', '#b88958'),
      roughness: 0.8,
      metalness: 0.05,
    })
  );

  const stuccoSlateMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      map: makeStuccoTexture('#94a3b8', '#64748b'),
      roughness: 0.72,
      metalness: 0.12,
    })
  );

  const corrugatedCanvas = makeNoiseCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(x, 0, 7, s);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(x + 7, 0, 3, s);
    }
  });
  const corrugatedTex = registerTex(corrugatedCanvas, { srgb: true, repeatX: 4, repeatY: 2 });
  const corrugatedDepotMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      map: corrugatedTex,
      roughness: 0.48,
      metalness: 0.55,
    })
  );

  const roofConcreteMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.86,
      metalness: 0.08,
    })
  );

  // 5. ROAD MARKING & EMISSIVE MATERIALS (polygonOffset prevents any coplanar Z-fighting)
  const yellowMarkMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.55,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );

  const whiteMarkMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.55,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );

  const streetlightBulbMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde68a,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    })
  );

  const nightWindowWarmMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0xbfe3f7,
      emissive: 0xfde68a,
      emissiveIntensity: 0.2,
      roughness: 0.15,
      metalness: 0.7,
    })
  );

  const nightWindowCoolMat = registerMat(
    new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.22,
      roughness: 0.12,
      metalness: 0.78,
    })
  );

  const createSignTexture = (
    title: string,
    subtitle: string,
    opts: { bg?: string; border?: string; accent?: string; text?: string } = {}
  ): THREE.CanvasTexture => {
    const {
      bg = '#071A2B',
      border = '#EF233C',
      accent = '#FDE047',
      text = '#FFFFFF',
    } = opts;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = border;
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, 504, 120);

      ctx.fillStyle = text;
      ctx.font = 'bold 34px "Plus Jakarta Sans", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, 256, subtitle ? 46 : 64);

      if (subtitle) {
        ctx.fillStyle = accent;
        ctx.font = 'bold 20px "Plus Jakarta Sans", Arial, sans-serif';
        ctx.fillText(subtitle, 256, 92);
      }
    }
    return registerTex(canvas, { srgb: true, repeatX: 1, repeatY: 1 });
  };

  const createPavementStencilTexture = (label: string, bgAlpha = true): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (!bgAlpha) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 256, 256);
      } else {
        ctx.clearRect(0, 0, 256, 256);
      }

      if (label === 'ARROW_STRAIGHT') {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(114, 72, 28, 152);
        ctx.beginPath();
        ctx.moveTo(128, 22);
        ctx.lineTo(182, 92);
        ctx.lineTo(74, 92);
        ctx.closePath();
        ctx.fill();
      } else if (label === 'SPEED_80') {
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.arc(128, 128, 92, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 94px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('80', 128, 134);
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 58px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 128, 128);
      }
    }
    return registerTex(canvas, { srgb: true, repeatX: 1, repeatY: 1 });
  };

  const updateTimeOfDay = (mode: 'DAYLIGHT' | 'SUNSET' | 'MIDNIGHT' | 'GOLDEN_HOUR') => {
    switch (mode) {
      case 'MIDNIGHT':
        streetlightBulbMat.emissiveIntensity = 4.6;
        glassTowerMat.emissiveIntensity = 1.65;
        bankGlassMat.emissiveIntensity = 1.85;
        nightWindowWarmMat.emissiveIntensity = 1.9;
        nightWindowCoolMat.emissiveIntensity = 1.75;
        break;
      case 'SUNSET':
      case 'GOLDEN_HOUR':
        streetlightBulbMat.emissiveIntensity = 2.2;
        glassTowerMat.emissiveIntensity = 0.75;
        bankGlassMat.emissiveIntensity = 0.85;
        nightWindowWarmMat.emissiveIntensity = 0.9;
        nightWindowCoolMat.emissiveIntensity = 0.8;
        break;
      case 'DAYLIGHT':
      default:
        streetlightBulbMat.emissiveIntensity = 0.25;
        glassTowerMat.emissiveIntensity = 0.14;
        bankGlassMat.emissiveIntensity = 0.12;
        nightWindowWarmMat.emissiveIntensity = 0.16;
        nightWindowCoolMat.emissiveIntensity = 0.18;
        break;
    }
  };

  const dispose = () => {
    textures.forEach((t) => t.dispose());
    materials.forEach((m) => m.dispose());
  };

  return {
    expresswayRoadMat,
    commercialRoadMat,
    sidewalkMat,
    curbMat,
    drainageMat,
    groundTerrainMat,
    medianGrassMat,
    glassTowerMat,
    bankGlassMat,
    stuccoCreamMat,
    stuccoOchreMat,
    stuccoSlateMat,
    corrugatedDepotMat,
    roofConcreteMat,
    yellowMarkMat,
    whiteMarkMat,
    streetlightBulbMat,
    nightWindowWarmMat,
    nightWindowCoolMat,
    createSignTexture,
    createPavementStencilTexture,
    updateTimeOfDay,
    dispose,
  };
}
