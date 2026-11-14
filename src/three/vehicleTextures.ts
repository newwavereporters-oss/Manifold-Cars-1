// MANIFOLD WORLD — PROCEDURAL AUTOMOTIVE TEXTURE & MATERIAL CACHE
// Generates cached, high-sharpness CanvasTextures once per runtime for zero-404,
// 60-FPS PBR automotive rendering (tyre treads, sidewalls, brake rotors, grilles, gauges).

import * as THREE from 'three';

export interface VehicleTextureBank {
  tireTreadColor: THREE.CanvasTexture;
  tireTreadBump: THREE.CanvasTexture;
  tireOffroadBump: THREE.CanvasTexture;
  tireSemiSlickBump: THREE.CanvasTexture;
  tireSidewallColor: THREE.CanvasTexture;
  tireSidewallBump: THREE.CanvasTexture;
  brakeRotorColor: THREE.CanvasTexture;
  brakeRotorBump: THREE.CanvasTexture;
  grilleMeshColor: THREE.CanvasTexture;
  grilleMeshBump: THREE.CanvasTexture;
  carbonWeaveColor: THREE.CanvasTexture;
  carbonWeaveBump: THREE.CanvasTexture;
  dashboardGauge: THREE.CanvasTexture;
  infotainmentScreen: THREE.CanvasTexture;
  licensePlate: THREE.CanvasTexture;
  headlightOptics: THREE.CanvasTexture;
}

let cachedBank: VehicleTextureBank | null = null;

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  if (typeof document === 'undefined') {
    throw new Error('Canvas unavailable outside browser');
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = repeatX > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeatY > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.repeat.set(repeatX, repeatY);
  }
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function createTreadTextures(): {
  color: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
  offroadBump: THREE.CanvasTexture;
  semiSlickBump: THREE.CanvasTexture;
} {
  // 1. All-season directional performance tread (Color + Bump)
  const [cCol, ctxCol] = makeCanvas(256, 256);
  const [cBmp, ctxBmp] = makeCanvas(256, 256);

  if (ctxCol && ctxBmp) {
    ctxCol.fillStyle = '#181b21';
    ctxCol.fillRect(0, 0, 256, 256);
    ctxBmp.fillStyle = '#d4d4d4'; // raised rubber blocks
    ctxBmp.fillRect(0, 0, 256, 256);

    // 4 longitudinal drainage channels (v runs across tyre width in LatheGeometry? No: u is around circumference, v is across width)
    // Wait: in Three.js LatheGeometry, u = theta/(2*PI) (around circumference), v = profile index (0..1 across tread width).
    // So circumferential channels run along U (horizontal X on texture), transverse sipes run along Y!
    const channelsY = [56, 108, 148, 200];
    channelsY.forEach((cy) => {
      ctxCol.fillStyle = '#0a0c10';
      ctxCol.fillRect(0, cy - 6, 256, 12);
      ctxBmp.fillStyle = '#1a1a1a';
      ctxBmp.fillRect(0, cy - 6, 256, 12);
    });

    // Diagonal shoulder & center tread sipes repeating cleanly across 256px
    for (let x = 0; x < 256; x += 32) {
      // Top shoulder blocks
      ctxCol.strokeStyle = '#0b0d11';
      ctxCol.lineWidth = 6;
      ctxBmp.strokeStyle = '#242424';
      ctxBmp.lineWidth = 6;

      [ctxCol, ctxBmp].forEach((ctx) => {
        ctx.beginPath();
        ctx.moveTo(x, 4);
        ctx.lineTo(x + 14, 52);
        ctx.moveTo(x + 6, 62);
        ctx.lineTo(x + 18, 104);
        // Center rib chevron
        ctx.moveTo(x + 4, 114);
        ctx.lineTo(x + 16, 128);
        ctx.lineTo(x + 4, 142);
        // Bottom shoulder mirror
        ctx.moveTo(x + 6, 194);
        ctx.lineTo(x + 18, 152);
        ctx.moveTo(x, 252);
        ctx.lineTo(x + 14, 204);
        ctx.stroke();
      });
    }
  }

  // 2. Off-road mud-terrain lug bump
  const [cOff, ctxOff] = makeCanvas(256, 256);
  if (ctxOff) {
    ctxOff.fillStyle = '#222222';
    ctxOff.fillRect(0, 0, 256, 256);
    ctxOff.fillStyle = '#efefef';
    for (let x = 0; x < 256; x += 32) {
      ctxOff.fillRect(x + 2, 6, 20, 48);
      ctxOff.fillRect(x + 14, 66, 20, 44);
      ctxOff.fillRect(x + 4, 122, 22, 22);
      ctxOff.fillRect(x + 14, 154, 20, 44);
      ctxOff.fillRect(x + 2, 208, 20, 42);
    }
  }

  // 3. Semi-slick track tread bump
  const [cSemi, ctxSemi] = makeCanvas(256, 256);
  if (ctxSemi) {
    ctxSemi.fillStyle = '#dedede';
    ctxSemi.fillRect(0, 0, 256, 256);
    [76, 180].forEach((cy) => {
      ctxSemi.fillStyle = '#262626';
      ctxSemi.fillRect(0, cy - 5, 256, 10);
    });
    ctxSemi.strokeStyle = '#363636';
    ctxSemi.lineWidth = 4;
    for (let x = 0; x < 256; x += 64) {
      ctxSemi.beginPath();
      ctxSemi.moveTo(x, 12);
      ctxSemi.lineTo(x + 22, 70);
      ctxSemi.moveTo(x + 32, 244);
      ctxSemi.lineTo(x + 54, 186);
      ctxSemi.stroke();
    }
  }

  return {
    color: finalizeTexture(cCol, true, 16, 1),
    bump: finalizeTexture(cBmp, false, 16, 1),
    offroadBump: finalizeTexture(cOff, false, 14, 1),
    semiSlickBump: finalizeTexture(cSemi, false, 12, 1),
  };
}

function createSidewallTextures(): {
  color: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const [cCol, ctxCol] = makeCanvas(512, 512);
  const [cBmp, ctxBmp] = makeCanvas(512, 512);

  if (ctxCol && ctxBmp) {
    ctxCol.fillStyle = '#14171d';
    ctxCol.fillRect(0, 0, 512, 512);
    ctxBmp.fillStyle = '#808080';
    ctxBmp.fillRect(0, 0, 512, 512);

    const cx = 256;
    const cy = 256;

    // Subtle concentric molded sidewall rings
    [168, 186, 212, 232].forEach((r, idx) => {
      ctxCol.strokeStyle = idx % 2 === 0 ? '#1c2028' : '#0f1217';
      ctxCol.lineWidth = 3;
      ctxCol.beginPath();
      ctxCol.arc(cx, cy, r, 0, Math.PI * 2);
      ctxCol.stroke();

      ctxBmp.strokeStyle = idx % 2 === 0 ? '#b8b8b8' : '#505050';
      ctxBmp.lineWidth = 3;
      ctxBmp.beginPath();
      ctxBmp.arc(cx, cy, r, 0, Math.PI * 2);
      ctxBmp.stroke();
    });

    // Radial sidewall shoulder ribs
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const x1 = cx + Math.cos(a) * 214;
      const y1 = cy + Math.sin(a) * 214;
      const x2 = cx + Math.cos(a) * 244;
      const y2 = cy + Math.sin(a) * 244;
      ctxCol.strokeStyle = '#1b1f27';
      ctxCol.lineWidth = 2;
      ctxCol.beginPath();
      ctxCol.moveTo(x1, y1);
      ctxCol.lineTo(x2, y2);
      ctxCol.stroke();

      ctxBmp.strokeStyle = '#a8a8a8';
      ctxBmp.lineWidth = 2;
      ctxBmp.beginPath();
      ctxBmp.moveTo(x1, y1);
      ctxBmp.lineTo(x2, y2);
      ctxBmp.stroke();
    }

    // Subtle embossed sidewall lettering arcs
    ctxCol.fillStyle = '#262b35';
    ctxCol.font = 'bold 16px sans-serif';
    ctxCol.textAlign = 'center';
    ctxCol.fillText('MANIFOLD SPORT PILOT', cx, cy - 196);
    ctxCol.fillText('285 / 35 ZR20  •  RADIAL', cx, cy + 206);
  }

  return {
    color: finalizeTexture(cCol, true),
    bump: finalizeTexture(cBmp, false),
  };
}

function createBrakeRotorTextures(): {
  color: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const [cCol, ctxCol] = makeCanvas(256, 256);
  const [cBmp, ctxBmp] = makeCanvas(256, 256);

  if (ctxCol && ctxBmp) {
    const cx = 128;
    const cy = 128;

    const grad = ctxCol.createRadialGradient(cx, cy, 28, cx, cy, 126);
    grad.addColorStop(0, '#334155');
    grad.addColorStop(0.32, '#475569');
    grad.addColorStop(0.38, '#cbd5e1');
    grad.addColorStop(0.75, '#94a3b8');
    grad.addColorStop(1, '#64748b');
    ctxCol.fillStyle = grad;
    ctxCol.fillRect(0, 0, 256, 256);

    ctxBmp.fillStyle = '#909090';
    ctxBmp.fillRect(0, 0, 256, 256);

    // Fine lathe scoring rings
    for (let r = 54; r < 120; r += 4) {
      ctxCol.strokeStyle = r % 8 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.16)';
      ctxCol.lineWidth = 1;
      ctxCol.beginPath();
      ctxCol.arc(cx, cy, r, 0, Math.PI * 2);
      ctxCol.stroke();
    }

    // Cross-drilled cooling holes
    for (let i = 0; i < 16; i++) {
      const baseA = (i / 16) * Math.PI * 2;
      [68, 86, 104].forEach((r, rowIdx) => {
        const a = baseA + rowIdx * 0.08;
        const hx = cx + Math.cos(a) * r;
        const hy = cy + Math.sin(a) * r;
        ctxCol.fillStyle = '#0f172a';
        ctxCol.beginPath();
        ctxCol.arc(hx, hy, 2.8, 0, Math.PI * 2);
        ctxCol.fill();

        ctxBmp.fillStyle = '#151515';
        ctxBmp.beginPath();
        ctxBmp.arc(hx, hy, 3.0, 0, Math.PI * 2);
        ctxBmp.fill();
      });
    }
  }

  return {
    color: finalizeTexture(cCol, true),
    bump: finalizeTexture(cBmp, false),
  };
}

function createGrilleTextures(): {
  color: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const [cCol, ctxCol] = makeCanvas(128, 128);
  const [cBmp, ctxBmp] = makeCanvas(128, 128);

  if (ctxCol && ctxBmp) {
    ctxCol.fillStyle = '#07090d';
    ctxCol.fillRect(0, 0, 128, 128);
    ctxBmp.fillStyle = '#1a1a1a';
    ctxBmp.fillRect(0, 0, 128, 128);

    const stepX = 16;
    const stepY = 14;
    [
      { ctx: ctxCol, stroke: '#1f2937' },
      { ctx: ctxBmp, stroke: '#e5e5e5' },
    ].forEach(({ ctx, stroke }) => {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.4;
      for (let row = -1; row < 11; row++) {
        for (let col = -1; col < 10; col++) {
          const ox = col * stepX + (row % 2 === 0 ? 0 : stepX / 2);
          const oy = row * stepY;
          ctx.beginPath();
          ctx.moveTo(ox + 4, oy);
          ctx.lineTo(ox + 12, oy);
          ctx.lineTo(ox + 16, oy + 7);
          ctx.lineTo(ox + 12, oy + 14);
          ctx.lineTo(ox + 4, oy + 14);
          ctx.lineTo(ox, oy + 7);
          ctx.closePath();
          ctx.stroke();
        }
      }
    });
  }

  return {
    color: finalizeTexture(cCol, true, 6, 3),
    bump: finalizeTexture(cBmp, false, 6, 3),
  };
}

function createCarbonTextures(): {
  color: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const [cCol, ctxCol] = makeCanvas(64, 64);
  const [cBmp, ctxBmp] = makeCanvas(64, 64);

  if (ctxCol && ctxBmp) {
    ctxCol.fillStyle = '#151820';
    ctxCol.fillRect(0, 0, 64, 64);
    ctxBmp.fillStyle = '#707070';
    ctxBmp.fillRect(0, 0, 64, 64);

    for (let y = 0; y < 64; y += 8) {
      for (let x = 0; x < 64; x += 8) {
        const alt = ((x + y) / 8) % 2 === 0;
        ctxCol.fillStyle = alt ? '#232834' : '#0f1218';
        ctxCol.fillRect(x, y, 6, 6);
        ctxBmp.fillStyle = alt ? '#b8b8b8' : '#404040';
        ctxBmp.fillRect(x, y, 6, 6);
      }
    }
  }

  return {
    color: finalizeTexture(cCol, true, 8, 8),
    bump: finalizeTexture(cBmp, false, 8, 8),
  };
}

function createDashboardGaugeTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 192);
  if (ctx) {
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, 512, 192);

    const drawDial = (cx: number, cy: number, r: number, label: string, needleAngle: number, redlineStart: number) => {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 0.78, Math.PI * 2.22);
      ctx.stroke();

      ctx.strokeStyle = '#ef233c';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, redlineStart, Math.PI * 2.22);
      ctx.stroke();

      // Tick marks
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI * 0.78 + (i / 12) * Math.PI * 1.44;
        ctx.strokeStyle = i >= 10 ? '#ef233c' : '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12));
        ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
        ctx.stroke();
      }

      // Needle
      ctx.strokeStyle = '#ef233c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(needleAngle) * (r - 10), cy + Math.sin(needleAngle) * (r - 10));
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, cy + 36);
    };

    drawDial(118, 102, 68, 'RPM x1000', Math.PI * 1.15, Math.PI * 1.9);
    drawDial(394, 102, 68, 'KM/H', Math.PI * 0.92, Math.PI * 2.02);

    // Center digital telemetry box
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(202, 42, 108, 108);
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    ctx.strokeRect(202, 42, 108, 108);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MANIFOLD', 256, 68);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px monospace';
    ctx.fillText('D1', 256, 108);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('LAGOS GPS', 256, 134);
  }
  return finalizeTexture(c, true);
}

function createInfotainmentTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 128);
  if (ctx) {
    ctx.fillStyle = '#071426';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 124);

    // Mini Lagos coastal map lines
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(16, 98);
    ctx.quadraticCurveTo(90, 62, 154, 48);
    ctx.lineTo(232, 34);
    ctx.stroke();

    ctx.fillStyle = '#ef233c';
    ctx.beginPath();
    ctx.arc(96, 68, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('LAGOS NAV  •  LIVE', 16, 26);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText('THIRD MAINLAND CORRIDOR', 16, 114);
  }
  return finalizeTexture(c, true);
}

function createLicensePlateTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 64);
  if (ctx) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#065f46';
    ctx.fillRect(0, 0, 256, 13);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 60);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CENTRE OF EXCELLENCE', 128, 9.5);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('LAGOS • MFD 01', 128, 41);
  }
  return finalizeTexture(c, true);
}

function createHeadlightOpticsTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 128);
  if (ctx) {
    ctx.fillStyle = '#0a0f18';
    ctx.fillRect(0, 0, 256, 128);

    // Dual projector rings
    [76, 180].forEach((px) => {
      const grad = ctx.createRadialGradient(px, 56, 4, px, 56, 36);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.45, '#e0f2fe');
      grad.addColorStop(0.75, '#38bdf8');
      grad.addColorStop(1, '#0b1220');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, 56, 36, 0, Math.PI * 2);
      ctx.fill();
    });

    // Sleek bottom DRL blade
    ctx.fillStyle = '#f0f9ff';
    ctx.fillRect(16, 102, 224, 10);
  }
  return finalizeTexture(c, true);
}

export function getVehicleTextureBank(): VehicleTextureBank | null {
  if (typeof document === 'undefined') return null;
  if (cachedBank) return cachedBank;

  const tread = createTreadTextures();
  const sidewall = createSidewallTextures();
  const rotor = createBrakeRotorTextures();
  const grille = createGrilleTextures();
  const carbon = createCarbonTextures();

  cachedBank = {
    tireTreadColor: tread.color,
    tireTreadBump: tread.bump,
    tireOffroadBump: tread.offroadBump,
    tireSemiSlickBump: tread.semiSlickBump,
    tireSidewallColor: sidewall.color,
    tireSidewallBump: sidewall.bump,
    brakeRotorColor: rotor.color,
    brakeRotorBump: rotor.bump,
    grilleMeshColor: grille.color,
    grilleMeshBump: grille.bump,
    carbonWeaveColor: carbon.color,
    carbonWeaveBump: carbon.bump,
    dashboardGauge: createDashboardGaugeTexture(),
    infotainmentScreen: createInfotainmentTexture(),
    licensePlate: createLicensePlateTexture(),
    headlightOptics: createHeadlightOpticsTexture(),
  };

  return cachedBank;
}
