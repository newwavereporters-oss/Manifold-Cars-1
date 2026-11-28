// MANIFOLD WORLD — SHARED PROCEDURAL SHIPPING CONTAINER TEXTURE BANK
// Generates cached, high-DPI sRGB CanvasTextures + linear corrugated steel bump map
// for the 5 real-world maritime carriers: MAERSK, EVERGREEN, MSC, CMA CGM, Hapag-Lloyd.

import * as THREE from 'three';

export type ContainerBrand = 'MAERSK' | 'EVERGREEN' | 'MSC' | 'CMA_CGM' | 'HAPAG_LLOYD';

export interface ContainerTextureSet {
  brand: ContainerBrand;
  label: string;
  baseHex: number;
  sideMap: THREE.CanvasTexture;
  endMap: THREE.CanvasTexture;
}

export interface ContainerTextureBank {
  corrugationBump: THREE.CanvasTexture;
  brands: Record<ContainerBrand, ContainerTextureSet>;
  brandOrder: ContainerBrand[];
}

let cachedContainerBank: ContainerTextureBank | null = null;

function createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')];
}

function finalizeTex(canvas: HTMLCanvasElement, isColor: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function drawCorrugationRibs(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ribStep = 14,
  alphaDark = 0.22,
  alphaLight = 0.14
) {
  for (let x = 10; x < w - 10; x += ribStep) {
    ctx.fillStyle = `rgba(0, 0, 0, ${alphaDark})`;
    ctx.fillRect(x, 8, 5, h - 16);
    ctx.fillStyle = `rgba(255, 255, 255, ${alphaLight})`;
    ctx.fillRect(x + 5, 8, 3, h - 16);
  }
  // Top and bottom steel structural rail bands
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(0, 0, w, 10);
  ctx.fillRect(0, h - 10, w, 10);
  ctx.fillRect(0, 0, 12, h);
  ctx.fillRect(w - 12, 0, 12, h);

  // Subtle industrial weathering streaks
  for (let i = 0; i < 180; i++) {
    const sx = (i * 97) % w;
    const sy = (i * 53) % h;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(30,20,10,0.06)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(sx, sy, 3, 14 + (i % 18));
  }
}

function drawCorrugationBump(): THREE.CanvasTexture {
  const [c, ctx] = createCanvas(512, 128);
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 128);
    for (let x = 10; x < 502; x += 14) {
      ctx.fillStyle = '#383838';
      ctx.fillRect(x, 8, 5, 112);
      ctx.fillStyle = '#dcdcdc';
      ctx.fillRect(x + 5, 8, 5, 112);
    }
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 512, 10);
    ctx.fillRect(0, 118, 512, 10);
    ctx.fillRect(0, 0, 12, 128);
    ctx.fillRect(500, 0, 12, 128);
  }
  return finalizeTex(c, false);
}

function drawMaerskStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, rOuter: number) {
  const rInner = rOuter * 0.36;
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const angle = (i * Math.PI) / 7 - Math.PI / 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function createSideAndEndTextures(opts: {
  brand: ContainerBrand;
  label: string;
  bg: string;
  textColor: string;
  stripeColor?: string;
  code: string;
  drawEmblem?: (ctx: CanvasRenderingContext2D) => void;
}): { sideMap: THREE.CanvasTexture; endMap: THREE.CanvasTexture } {
  const [sc, sctx] = createCanvas(512, 160);
  if (sctx) {
    sctx.fillStyle = opts.bg;
    sctx.fillRect(0, 0, 512, 160);
    drawCorrugationRibs(sctx, 512, 160);

    if (opts.stripeColor) {
      sctx.fillStyle = opts.stripeColor;
      sctx.fillRect(12, 118, 488, 12);
    }

    if (opts.drawEmblem) {
      opts.drawEmblem(sctx);
    }

    // Main brand typography
    sctx.fillStyle = opts.textColor;
    sctx.textBaseline = 'middle';
    sctx.textAlign = 'center';
    sctx.font = '900 44px "Plus Jakarta Sans", Arial, sans-serif';
    sctx.fillText(opts.label, opts.drawEmblem ? 290 : 256, 74);

    // ISO container tare/serial markings (top-right corner)
    sctx.fillStyle = opts.textColor;
    sctx.globalAlpha = 0.85;
    sctx.textAlign = 'right';
    sctx.font = 'bold 12px monospace';
    sctx.fillText(`${opts.code}  45G1`, 494, 24);
    sctx.fillText('MAX GROSS 32,500 KG', 494, 39);
    sctx.globalAlpha = 1;
  }

  // Container doors end texture
  const [ec, ectx] = createCanvas(192, 192);
  if (ectx) {
    ectx.fillStyle = opts.bg;
    ectx.fillRect(0, 0, 192, 192);
    // Double door center seam & steel frame
    ectx.strokeStyle = 'rgba(0,0,0,0.45)';
    ectx.lineWidth = 4;
    ectx.strokeRect(8, 8, 176, 176);
    ectx.beginPath();
    ectx.moveTo(96, 8);
    ectx.lineTo(96, 184);
    ectx.stroke();

    // 4 vertical locking bars
    ectx.fillStyle = '#cbd5e1';
    [42, 74, 118, 150].forEach((bx) => {
      ectx.fillRect(bx - 2, 14, 4, 164);
      ectx.fillStyle = '#334155';
      ectx.fillRect(bx - 4, 110, 8, 12);
      ectx.fillStyle = '#cbd5e1';
    });

    // Top-right ISO code plate
    ectx.fillStyle = opts.textColor;
    ectx.font = 'bold 11px monospace';
    ectx.textAlign = 'right';
    ectx.fillText(opts.code, 174, 28);
  }

  return {
    sideMap: finalizeTex(sc, true),
    endMap: finalizeTex(ec, true),
  };
}

export function getContainerTextureBank(): ContainerTextureBank | null {
  if (typeof document === 'undefined') return null;
  if (cachedContainerBank) return cachedContainerBank;

  const corrugationBump = drawCorrugationBump();

  const maerskTex = createSideAndEndTextures({
    brand: 'MAERSK',
    label: 'MAERSK',
    bg: '#38A3D0',
    textColor: '#FFFFFF',
    code: 'MSKU 904821',
    drawEmblem: (ctx) => {
      ctx.fillStyle = '#0F2B46';
      ctx.fillRect(40, 44, 64, 64);
      drawMaerskStar(ctx, 72, 76, 25);
    },
  });

  const evergreenTex = createSideAndEndTextures({
    brand: 'EVERGREEN',
    label: 'EVERGREEN',
    bg: '#0E6B47',
    textColor: '#FFFFFF',
    stripeColor: '#FFFFFF',
    code: 'EGHU 742190',
  });

  const mscTex = createSideAndEndTextures({
    brand: 'MSC',
    label: 'MSC',
    bg: '#232830',
    textColor: '#EAB308',
    stripeColor: '#D4AF37',
    code: 'MSCU 618304',
    drawEmblem: (ctx) => {
      ctx.strokeStyle = '#EAB308';
      ctx.lineWidth = 4;
      ctx.strokeRect(42, 46, 58, 58);
      ctx.fillStyle = '#EAB308';
      ctx.font = '900 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('m s c', 71, 76);
    },
  });

  const cmaTex = createSideAndEndTextures({
    brand: 'CMA_CGM',
    label: 'CMA CGM',
    bg: '#102A5C',
    textColor: '#FFFFFF',
    stripeColor: '#EF233C',
    code: 'CMAU 503912',
    drawEmblem: (ctx) => {
      ctx.fillStyle = '#EF233C';
      ctx.fillRect(36, 48, 22, 54);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(58, 48, 22, 54);
    },
  });

  const hapagTex = createSideAndEndTextures({
    brand: 'HAPAG_LLOYD',
    label: 'Hapag-Lloyd',
    bg: '#EA580C',
    textColor: '#FFFFFF',
    stripeColor: '#0F294A',
    code: 'HLXU 812645',
    drawEmblem: (ctx) => {
      ctx.fillStyle = '#0F294A';
      ctx.beginPath();
      ctx.arc(70, 76, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.arc(70, 76, 16, 0, Math.PI * 2);
      ctx.fill();
    },
  });

  cachedContainerBank = {
    corrugationBump,
    brandOrder: ['MAERSK', 'EVERGREEN', 'MSC', 'CMA_CGM', 'HAPAG_LLOYD'],
    brands: {
      MAERSK: { brand: 'MAERSK', label: 'MAERSK', baseHex: 0x38a3d0, ...maerskTex },
      EVERGREEN: { brand: 'EVERGREEN', label: 'EVERGREEN', baseHex: 0x0e6b47, ...evergreenTex },
      MSC: { brand: 'MSC', label: 'MSC', baseHex: 0x232830, ...mscTex },
      CMA_CGM: { brand: 'CMA_CGM', label: 'CMA CGM', baseHex: 0x102a5c, ...cmaTex },
      HAPAG_LLOYD: { brand: 'HAPAG_LLOYD', label: 'Hapag-Lloyd', baseHex: 0xea580c, ...hapagTex },
    },
  };

  return cachedContainerBank;
}
