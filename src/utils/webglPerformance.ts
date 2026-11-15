// MANIFOLD WORLD — DEVICE-AWARE WEBGL PERFORMANCE PROFILES & MEMORY DISPOSAL

import * as THREE from 'three';

export type WebGLQualityMode = 'AUTO' | 'HIGH' | 'BALANCED' | 'PERFORMANCE';
export type ResolvedWebGLProfileName = 'HIGH' | 'BALANCED' | 'PERFORMANCE';

export interface WebGLPerformanceProfile {
  name: ResolvedWebGLProfileName;
  label: string;
  maxDpr: number;
  antialias: boolean;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  shadowType: THREE.ShadowMapType;
  farPlane: number;
  fogDensityMultiplier: number;
  useEnvMap: boolean;
  trafficCullDistance: number;
  maxVisibleBuildingsCastShadow: boolean;
  isSoftwareRenderer: boolean;
  rendererName: string;
  isLowEndDevice: boolean;
  isMobileViewport: boolean;
}

const STORAGE_KEY = 'manifold_webgl_quality_mode';

let cachedProbe: { isSoftwareRenderer: boolean; rendererName: string } | null = null;

export function probeWebGLRenderer(): { isSoftwareRenderer: boolean; rendererName: string } {
  if (cachedProbe) return cachedProbe;
  if (typeof document === 'undefined') {
    cachedProbe = { isSoftwareRenderer: false, rendererName: 'unknown' };
    return cachedProbe;
  }

  let canvas: HTMLCanvasElement | null = null;
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  try {
    canvas = document.createElement('canvas');
    gl =
      (canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) as WebGLRenderingContext | null);
    if (!gl) {
      cachedProbe = { isSoftwareRenderer: true, rendererName: 'unavailable' };
      return cachedProbe;
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const raw = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
    const isSoftwareRenderer = /SwiftShader|llvmpipe|WARP|Software|Mesa OffScreen/i.test(raw);
    cachedProbe = { isSoftwareRenderer, rendererName: raw || 'hardware-webgl' };
  } catch {
    cachedProbe = { isSoftwareRenderer: false, rendererName: 'probe-restricted' };
  } finally {
    try {
      const loseCtx = gl?.getExtension('WEBGL_lose_context');
      loseCtx?.loseContext();
    } catch {}
    canvas = null;
    gl = null;
  }
  return cachedProbe;
}

export function getSavedQualityMode(): WebGLQualityMode {
  try {
    const val = window.localStorage.getItem(STORAGE_KEY);
    if (val === 'HIGH' || val === 'BALANCED' || val === 'PERFORMANCE' || val === 'AUTO') {
      return val;
    }
  } catch {}
  return 'AUTO';
}

export function saveQualityMode(mode: WebGLQualityMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
}

export function resolveWebGLProfile(mode: WebGLQualityMode = 'AUTO'): WebGLPerformanceProfile {
  const probe = probeWebGLRenderer();
  const isTouch =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024);
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= 860;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const deviceMemory =
    typeof navigator !== 'undefined' ? Number((navigator as any).deviceMemory || 4) : 4;
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const isLowEndDevice =
    probe.isSoftwareRenderer || cores <= 4 || deviceMemory <= 3 || Boolean(reducedMotion);

  let resolved: ResolvedWebGLProfileName;
  if (mode === 'HIGH' || mode === 'BALANCED' || mode === 'PERFORMANCE') {
    resolved = mode;
  } else {
    if (probe.isSoftwareRenderer || (isMobileViewport && (cores <= 4 || deviceMemory <= 4))) {
      resolved = 'PERFORMANCE';
    } else if (isTouch || isMobileViewport || isLowEndDevice) {
      resolved = 'BALANCED';
    } else {
      resolved = 'HIGH';
    }
  }

  if (resolved === 'PERFORMANCE') {
    return {
      name: 'PERFORMANCE',
      label: 'Smooth / Battery',
      maxDpr: 1,
      antialias: false,
      shadowsEnabled: false,
      shadowMapSize: 512,
      shadowType: THREE.BasicShadowMap,
      farPlane: 1850,
      fogDensityMultiplier: 1.45,
      useEnvMap: false,
      trafficCullDistance: 170,
      maxVisibleBuildingsCastShadow: false,
      isSoftwareRenderer: probe.isSoftwareRenderer,
      rendererName: probe.rendererName,
      isLowEndDevice,
      isMobileViewport,
    };
  }

  if (resolved === 'BALANCED') {
    return {
      name: 'BALANCED',
      label: 'Balanced',
      maxDpr: isMobileViewport ? 1.25 : 1.5,
      antialias: !probe.isSoftwareRenderer,
      shadowsEnabled: !probe.isSoftwareRenderer,
      shadowMapSize: 1024,
      shadowType: THREE.PCFShadowMap,
      farPlane: 2600,
      fogDensityMultiplier: 1.15,
      useEnvMap: !probe.isSoftwareRenderer,
      trafficCullDistance: 240,
      maxVisibleBuildingsCastShadow: false,
      isSoftwareRenderer: probe.isSoftwareRenderer,
      rendererName: probe.rendererName,
      isLowEndDevice,
      isMobileViewport,
    };
  }

  return {
    name: 'HIGH',
    label: 'High Fidelity',
    maxDpr: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1.5,
    antialias: !probe.isSoftwareRenderer,
    shadowsEnabled: true,
    shadowMapSize: probe.isSoftwareRenderer ? 1024 : 2048,
    shadowType: probe.isSoftwareRenderer ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap,
    farPlane: 3600,
    fogDensityMultiplier: 1,
    useEnvMap: true,
    trafficCullDistance: 360,
    maxVisibleBuildingsCastShadow: true,
    isSoftwareRenderer: probe.isSoftwareRenderer,
    rendererName: probe.rendererName,
    isLowEndDevice,
    isMobileViewport,
  };
}

/**
 * Recursively disposes geometries and materials owned by a dynamically created Three.js object
 * (such as swapped player/remote car models). Skips shared cached textures unless explicitly requested.
 */
export function disposeObject3D(root: THREE.Object3D | null | undefined, disposeTextures = false): void {
  if (!root) return;
  const disposedGeos = new Set<THREE.BufferGeometry>();
  const disposedMats = new Set<THREE.Material>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !disposedGeos.has(mesh.geometry)) {
      disposedGeos.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const mat = (mesh as any).material as THREE.Material | THREE.Material[] | undefined;
    if (mat) {
      const matList = Array.isArray(mat) ? mat : [mat];
      for (const m of matList) {
        if (!m || disposedMats.has(m)) continue;
        disposedMats.add(m);
        if (disposeTextures) {
          for (const key of Object.keys(m)) {
            const val = (m as any)[key];
            if (val && typeof val === 'object' && val.isTexture) {
              (val as THREE.Texture).dispose();
            }
          }
        }
        m.dispose();
      }
    }
  });
}
