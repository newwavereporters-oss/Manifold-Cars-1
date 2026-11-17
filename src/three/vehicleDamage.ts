import * as THREE from 'three';

let cachedContactShadowTex: THREE.CanvasTexture | null = null;
let sharedContactShadowGeo: THREE.PlaneGeometry | null = null;

// Pre-allocated scratch math helpers (zero allocation during impact deformation)
const _invWorldMat = new THREE.Matrix4();
const _localHit = new THREE.Vector3();
const _localDir = new THREE.Vector3();
const _meshCenter = new THREE.Vector3();

/**
 * Returns a cached radial gradient CanvasTexture for soft vehicle ground contact shadows.
 */
export function getVehicleContactShadowTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (cachedContactShadowTex) return cachedContactShadowTex;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.12,
    size / 2,
    size / 2,
    size * 0.5
  );
  grad.addColorStop(0.0, 'rgba(3, 6, 12, 0.72)');
  grad.addColorStop(0.55, 'rgba(3, 6, 12, 0.44)');
  grad.addColorStop(0.82, 'rgba(3, 6, 12, 0.14)');
  grad.addColorStop(1.0, 'rgba(3, 6, 12, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cachedContactShadowTex = tex;
  return tex;
}

/**
 * Creates a ground contact shadow plane sitting just above y = 0 so cars feel firmly planted.
 */
export function createVehicleContactShadowMesh(
  width: number,
  length: number,
  y = 0.015
): THREE.Mesh {
  if (!sharedContactShadowGeo) {
    sharedContactShadowGeo = new THREE.PlaneGeometry(1, 1);
    sharedContactShadowGeo.rotateX(-Math.PI / 2);
  }
  const tex = getVehicleContactShadowTexture();
  const mat = new THREE.MeshBasicMaterial({
    color: 0x050811,
    map: tex,
    transparent: true,
    opacity: tex ? 0.85 : 0.32,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(sharedContactShadowGeo, mat);
  mesh.scale.set(width, 1, length);
  mesh.position.y = y;
  mesh.renderOrder = 1;
  mesh.userData.isContactShadow = true;
  return mesh;
}

/**
 * Marks a single mesh as eligible for real-time vertex denting.
 */
export function markDeformable<T extends THREE.Mesh>(mesh: T, weight = 1.0): T {
  mesh.userData.deformable = true;
  mesh.userData.damageWeight = weight;
  return mesh;
}

/**
 * Marks all child meshes of a group as deformable.
 */
export function markGroupDeformable(obj: THREE.Object3D, weight = 1.0): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.userData.deformable = true;
      child.userData.damageWeight = weight;
    }
  });
}

/**
 * Converts a collision velocity (units/s) into normalized dent severity in [0, 1].
 * Returns 0 if impact is too gentle to cause visible sheetmetal damage.
 */
export function computeImpactSeverity(impactSpeedUnitsPerSec: number): number {
  if (!Number.isFinite(impactSpeedUnitsPerSec) || impactSpeedUnitsPerSec < 2.2) {
    return 0;
  }
  return THREE.MathUtils.clamp((impactSpeedUnitsPerSec - 2.0) / 26.0, 0.2, 1.0);
}

export interface DentOptions {
  /**
   * When true, clones shared BufferGeometry on the mesh's first hit so pooled
   * vehicles (like TrafficEngine) don't deform sibling cars.
   */
  lazyClone?: boolean;
  /** Optional array to collect lazily cloned geometries for clean disposal. */
  ownedGeos?: THREE.BufferGeometry[];
  /** Minimum distance in meters from impact point to deform (multiplied by severity curve). */
  radiusBoost?: number;
}

/**
 * Applies physical inward crumple & metallic crease deformation to deformable meshes
 * near `hitWorldPoint`, pushing vertices along `impactDirWorld`.
 */
export function applyVehicleDent(
  root: THREE.Object3D,
  hitWorldPoint: THREE.Vector3,
  impactDirWorld: THREE.Vector3,
  severity: number,
  opts?: DentOptions
): boolean {
  const clampedSeverity = THREE.MathUtils.clamp(severity, 0.08, 1.0);
  if (clampedSeverity <= 0.01) return false;

  root.updateMatrixWorld(true);
  let deformedAny = false;

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.userData.deformable || !obj.geometry) {
      return;
    }

    const weight = typeof obj.userData.damageWeight === 'number' ? obj.userData.damageWeight : 1.0;
    const radius = (0.58 + 0.62 * clampedSeverity + (opts?.radiusBoost ?? 0)) * Math.max(0.65, weight);

    let geo = obj.geometry as THREE.BufferGeometry;
    if (!geo.boundingSphere) {
      geo.computeBoundingSphere();
    }

    _invWorldMat.copy(obj.matrixWorld).invert();
    _localHit.copy(hitWorldPoint).applyMatrix4(_invWorldMat);
    _localDir.copy(impactDirWorld).transformDirection(_invWorldMat);
    if (_localDir.lengthSq() < 1e-6) {
      _localDir.set(0, 0, -1);
    } else {
      _localDir.normalize();
    }

    if (geo.boundingSphere) {
      _meshCenter.copy(geo.boundingSphere.center);
      const maxReach = geo.boundingSphere.radius + radius;
      if (_meshCenter.distanceToSquared(_localHit) > maxReach * maxReach) {
        return;
      }
    }

    const posAttr = geo.getAttribute('position');
    if (!(posAttr instanceof THREE.BufferAttribute)) return;

    // Check if any vertex lies inside the impact radius before cloning geometry
    let hasAffectedVertex = false;
    const arr = posAttr.array as Float32Array;
    const rSq = radius * radius;
    for (let i = 0; i < arr.length; i += 3) {
      const dx = arr[i] - _localHit.x;
      const dy = arr[i + 1] - _localHit.y;
      const dz = arr[i + 2] - _localHit.z;
      if (dx * dx + dy * dy + dz * dz < rSq) {
        hasAffectedVertex = true;
        break;
      }
    }
    if (!hasAffectedVertex) return;

    if (opts?.lazyClone && !geo.userData.clonedForDamage) {
      const cloned = geo.clone();
      cloned.userData = { ...geo.userData, clonedForDamage: true };
      obj.geometry = cloned;
      geo = cloned;
      opts.ownedGeos?.push(cloned);
    }

    const activePos = geo.getAttribute('position') as THREE.BufferAttribute;
    const activeArr = activePos.array as Float32Array;

    if (!geo.userData.restPositions) {
      geo.userData.restPositions = new Float32Array(activeArr);
    }
    const rest = geo.userData.restPositions as Float32Array;

    const maxInwardDepth = (0.1 + 0.25 * clampedSeverity) * weight;
    const maxTotalDisplacement = 0.34 * Math.max(0.8, weight);
    const maxDispSq = maxTotalDisplacement * maxTotalDisplacement;

    for (let i = 0; i < activeArr.length; i += 3) {
      const vx = activeArr[i];
      const vy = activeArr[i + 1];
      const vz = activeArr[i + 2];

      const dx = vx - _localHit.x;
      const dy = vy - _localHit.y;
      const dz = vz - _localHit.z;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq >= rSq) continue;

      const d = Math.sqrt(dSq);
      const u = 1.0 - d / radius;
      const falloff = u * u;
      // Deterministic metallic fold/crease variation
      const crease = 0.78 + 0.34 * Math.sin(vx * 11.7 + vy * 17.3 + vz * 9.4);
      const depth = maxInwardDepth * falloff * crease;
      // Subtle upward/outward sheetmetal rim buckle around the dent center
      const buckleY = u * (1.0 - u) * 0.055 * clampedSeverity;

      let nx = vx + _localDir.x * depth;
      let ny = vy + _localDir.y * depth + buckleY;
      let nz = vz + _localDir.z * depth;

      // Clamp total cumulative displacement from factory rest shape
      const rx = rest[i];
      const ry = rest[i + 1];
      const rz = rest[i + 2];
      const ox = nx - rx;
      const oy = ny - ry;
      const oz = nz - rz;
      const oSq = ox * ox + oy * oy + oz * oz;
      if (oSq > maxDispSq) {
        const scale = maxTotalDisplacement / Math.sqrt(oSq);
        nx = rx + ox * scale;
        ny = ry + oy * scale;
        nz = rz + oz * scale;
      }

      activeArr[i] = nx;
      activeArr[i + 1] = Math.max(ry - 0.14, ny);
      activeArr[i + 2] = nz;
      deformedAny = true;
    }

    if (deformedAny) {
      activePos.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    }
  });

  if (deformedAny) {
    const prev = typeof root.userData.totalDamage === 'number' ? root.userData.totalDamage : 0;
    root.userData.totalDamage = Math.min(1, prev + clampedSeverity * 0.22);
  }
  return deformedAny;
}

/**
 * Restores all deformable geometries on a vehicle back to factory rest positions.
 */
export function resetVehicleDamage(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.geometry) return;
    const rest = obj.geometry.userData?.restPositions as Float32Array | undefined;
    if (!rest) return;
    const pos = obj.geometry.getAttribute('position');
    if (!(pos instanceof THREE.BufferAttribute)) return;
    const arr = pos.array as Float32Array;
    if (arr.length === rest.length) {
      arr.set(rest);
      pos.needsUpdate = true;
      obj.geometry.computeVertexNormals();
      obj.geometry.computeBoundingSphere();
    }
  });
  root.userData.totalDamage = 0;
}
