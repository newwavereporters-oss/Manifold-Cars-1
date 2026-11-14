import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Car,
  Check,
  Lock,
  Music,
  Palette,
  Armchair,
  ArrowRight,
  RotateCw,
  Eye,
  Volume2,
  VolumeX,
  LogOut,
  Loader2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import {
  CAR_COLOR_PALETTES,
  INTERIOR_THEME_OPTIONS,
  MUSIC_PREFERENCE_OPTIONS,
  VEHICLE_SPEC_PROFILES,
  VehicleModelFactory,
  type CarCustomization,
  type InteriorTheme,
  type MusicPreference,
  type VehicleModelType,
} from './worldModels';
import { engineAudio } from '../../utils/engineAudio';
import {
  computeLockStatus,
  confirmVehicleConfiguration,
  type PlayerProfile,
} from '../../services/playerService';

interface VehicleConfigPortalProps {
  profile: PlayerProfile;
  serverClockOffsetMs: number;
  onConfirmed: (updatedProfile: PlayerProfile, serverClockOffsetMs: number) => void;
  onCancelToGame?: () => void;
  onLogout: () => void;
}

export const VehicleConfigPortal: React.FC<VehicleConfigPortalProps> = ({
  profile,
  serverClockOffsetMs,
  onConfirmed,
  onCancelToGame,
  onLogout,
}) => {
  const [vehicleType, setVehicleType] = useState<VehicleModelType>(
    profile.selected_vehicle || 'SPORTS_COUPE'
  );
  const [paintColor, setPaintColor] = useState<string>(
    profile.selected_vehicle_color || '#DC2626'
  );
  const [finish, setFinish] = useState<'gloss' | 'matte' | 'metallic'>('metallic');
  const [interiorTheme, setInteriorTheme] = useState<InteriorTheme>(
    profile.selected_interior || 'BLACK'
  );
  const [musicPref, setMusicPref] = useState<MusicPreference>(
    profile.selected_music_preference || 'AFROBEATS'
  );
  const [cameraFocus, setCameraFocus] = useState<'EXTERIOR' | 'INTERIOR'>('EXTERIOR');
  const [isAudioPreviewing, setIsAudioPreviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  // Live 1s countdown state for 24-hour lock
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      clearInterval(id);
      engineAudio.setRadioStation(0);
    };
  }, []);

  void tick;
  const lockStatus = computeLockStatus(profile.settings_lock_expires_at, serverClockOffsetMs);

  // 3D Showroom Preview Canvas Refs
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const carHolderRef = useRef<THREE.Group | null>(null);
  const orbitYawRef = useRef<number>(0.65);
  const cameraFocusRef = useRef(cameraFocus);
  cameraFocusRef.current = cameraFocus;
  const vehicleTypeRef = useRef(vehicleType);
  vehicleTypeRef.current = vehicleType;
  const draggingRef = useRef<{ active: boolean; lastX: number }>({ active: false, lastX: 0 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x061524);
    scene.fog = new THREE.FogExp2(0x061524, 0.018);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      44,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      200
    );

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 1.05;
    roomEnv.dispose();

    // Lighting
    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 1.3);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xfffbeb, 2.4);
    keyLight.position.set(7, 11, 8);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rimLight.position.set(-8, 6, -7);
    scene.add(rimLight);

    // Showroom Turntable Platform
    const stageGroup = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 4.1, 0.28, 48),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.25, metalness: 0.78 })
    );
    disc.position.y = -0.14;
    disc.receiveShadow = true;
    stageGroup.add(disc);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.68, 3.82, 48),
      new THREE.MeshBasicMaterial({ color: 0xef233c, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    stageGroup.add(ring);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(30, 32),
      new THREE.MeshStandardMaterial({ color: 0x07121e, roughness: 0.6, metalness: 0.35 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.28;
    floor.receiveShadow = true;
    stageGroup.add(floor);
    scene.add(stageGroup);

    const holder = new THREE.Group();
    scene.add(holder);
    carHolderRef.current = holder;

    let rafId = 0;
    let lastMs = performance.now();
    const animate = (nowMs: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min((nowMs - lastMs) / 1000, 0.08);
      lastMs = nowMs;

      if (!draggingRef.current.active && cameraFocusRef.current === 'EXTERIOR') {
        orbitYawRef.current += dt * 0.28;
      }

      if (cameraFocusRef.current === 'INTERIOR') {
        const spec = VEHICLE_SPEC_PROFILES[vehicleTypeRef.current];
        const eyePos = new THREE.Vector3(
          0.36,
          spec.cockpitOffset.y + 0.08,
          spec.cockpitOffset.z - 0.14
        );
        camera.position.lerp(eyePos, Math.min(1, dt * 5));
        camera.lookAt(
          spec.cockpitOffset.x * 0.6,
          spec.cockpitOffset.y - 0.16,
          spec.cockpitOffset.z + 0.44
        );
      } else {
        const radius = 5.9;
        const targetPos = new THREE.Vector3(
          Math.sin(orbitYawRef.current) * radius,
          2.05,
          Math.cos(orbitYawRef.current) * radius
        );
        camera.position.lerp(targetPos, Math.min(1, dt * 6));
        camera.lookAt(0, 0.78, 0);
      }

      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(animate);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafId);
      envRT.dispose();
      pmrem.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Rebuild 3D model when vehicle, color, or interior changes
  useEffect(() => {
    const holder = carHolderRef.current;
    if (!holder) return;
    while (holder.children.length > 0) {
      holder.remove(holder.children[0]);
    }

    const custom: CarCustomization = {
      vehicleType,
      paintColor,
      finish,
      rimColor: '#E2E8F0',
      caliperColor: '#EF233C',
      headlightTint: '#ffffff',
      windowTint: cameraFocus === 'INTERIOR' ? 0.1 : 0.35,
      spoiler: vehicleType === 'SPORTS_COUPE' ? 'GT_WING' : 'NONE',
      underglow: 'NONE',
      interiorTheme,
      musicPreference: musicPref,
    };
    const model = VehicleModelFactory.create(custom);
    holder.add(model.carGroup);
  }, [vehicleType, paintColor, finish, interiorTheme, cameraFocus, musicPref]);

  const handleToggleMusicPreview = (pref: MusicPreference) => {
    setMusicPref(pref);
    if (pref === 'NO_MUSIC') {
      engineAudio.setRadioStation(0);
      setIsAudioPreviewing(false);
    } else {
      engineAudio.init();
      engineAudio.setMusicPreference(pref);
      setIsAudioPreviewing(true);
    }
  };

  const handleConfirm = async () => {
    if (lockStatus.isLocked) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await confirmVehicleConfiguration({
        vehicle: vehicleType,
        color: paintColor,
        interior: interiorTheme,
        music: musicPref,
      });
      if (!res.success || !res.profile) {
        setErrorMsg(res.error || 'Could not confirm vehicle setup.');
        return;
      }
      onConfirmed(res.profile, res.serverClockOffsetMs || 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSpec = VEHICLE_SPEC_PROFILES[vehicleType];
  const activeColorObj =
    CAR_COLOR_PALETTES.find((c) => c.hex.toLowerCase() === paintColor.toLowerCase()) ||
    CAR_COLOR_PALETTES[1];
  const activeInteriorObj =
    INTERIOR_THEME_OPTIONS.find((i) => i.id === interiorTheme) || INTERIOR_THEME_OPTIONS[0];
  const activeMusicObj =
    MUSIC_PREFERENCE_OPTIONS.find((m) => m.id === musicPref) || MUSIC_PREFERENCE_OPTIONS[0];

  return (
    <div className="relative z-20 flex flex-col lg:flex-row h-full w-full bg-[#061524] overflow-hidden">
      {/* LEFT / TOP: Interactive 3D Vehicle Turntable Showcase */}
      <div className="relative flex-1 min-h-[300px] lg:min-h-0 flex flex-col justify-between overflow-hidden">
        {!webglUnavailable ? (
          <div
            ref={mountRef}
            onPointerDown={(e) => {
              draggingRef.current = { active: true, lastX: e.clientX };
            }}
            onPointerMove={(e) => {
              if (!draggingRef.current.active) return;
              const dx = e.clientX - draggingRef.current.lastX;
              draggingRef.current.lastX = e.clientX;
              orbitYawRef.current -= dx * 0.01;
            }}
            onPointerUp={() => {
              draggingRef.current.active = false;
            }}
            onPointerLeave={() => {
              draggingRef.current.active = false;
            }}
            className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#071A2B] text-gray-300 text-sm p-6 text-center">
            3D WebGL preview unavailable on this device — configuration selections below remain fully active.
          </div>
        )}

        {/* Top Showroom Overlay Bar */}
        <div className="relative z-10 p-4 sm:p-6 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
          <div className="pointer-events-auto bg-[#071A2B]/85 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/15 shadow-xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 block">
              Driver Garage • {profile.nickname}
            </span>
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
              {activeSpec.name}
            </h1>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCameraFocus((prev) => (prev === 'EXTERIOR' ? 'INTERIOR' : 'EXTERIOR'))
              }
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                cameraFocus === 'INTERIOR'
                  ? 'bg-[#EF233C] border-[#EF233C] text-white'
                  : 'bg-[#071A2B]/85 border-white/15 text-white hover:bg-white/10'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{cameraFocus === 'INTERIOR' ? 'Exterior 360°' : 'Inspect Interior'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isAudioPreviewing) {
                  engineAudio.setRadioStation(0);
                  setIsAudioPreviewing(false);
                } else {
                  handleToggleMusicPreview(musicPref);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#071A2B]/85 border border-white/15 text-xs font-bold text-gray-200 hover:text-white cursor-pointer whitespace-nowrap"
            >
              {isAudioPreviewing ? (
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span>{isAudioPreviewing ? 'Audio On' : 'Preview Audio'}</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="p-2 rounded-xl bg-[#071A2B]/85 border border-white/15 text-gray-300 hover:text-white cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom 3D Spec Strip */}
        <div className="relative z-10 p-4 sm:p-6 pointer-events-none flex flex-wrap items-end justify-between gap-3">
          <div className="bg-[#071A2B]/85 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/15 flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-[9px] text-gray-400 uppercase block">Power</span>
              <span className="font-black text-white">{activeSpec.horsepower} HP</span>
            </div>
            <div>
              <span className="text-[9px] text-gray-400 uppercase block">0–100 km/h</span>
              <span className="font-black text-emerald-400">{activeSpec.acceleration0To100}s</span>
            </div>
            <div>
              <span className="text-[9px] text-gray-400 uppercase block">Drivetrain</span>
              <span className="font-black text-amber-300">{activeSpec.drivenWheels}</span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 bg-[#071A2B]/80 px-3 py-1.5 rounded-xl border border-white/10 text-[11px] text-gray-300">
            <RotateCw className="w-3.5 h-3.5 text-sky-400" />
            <span>Drag vehicle to rotate 360°</span>
          </div>
        </div>
      </div>

      {/* RIGHT: Configuration Controls & 24-Hour Lock Gate */}
      <div className="w-full lg:w-[460px] bg-[#071A2B]/98 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col max-h-[60vh] lg:max-h-full">
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 24-Hour Lock Banner when active */}
          {lockStatus.isLocked ? (
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-400/50 space-y-2.5">
              <div className="flex items-center gap-2 text-amber-300">
                <Lock className="w-4 h-4 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider">
                  YOUR VEHICLE CONFIGURATION IS LOCKED.
                </span>
              </div>
              <p className="text-xs text-gray-200 leading-relaxed">
                Vehicle model, exterior paint, interior theme, and music preference are locked for 24 hours after confirmation.
              </p>
              <div className="bg-black/35 rounded-xl p-3 flex items-center justify-between border border-white/10">
                <div>
                  <span className="text-[10px] uppercase text-gray-400 block font-bold">
                    Remaining Lock Time
                  </span>
                  <span className="text-xl font-black font-mono text-amber-300 tabular-nums">
                    {lockStatus.hhmmss}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-gray-400 block font-bold">
                    Unlocks At
                  </span>
                  <span className="text-xs font-bold text-white">{lockStatus.unlockFormatted}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-400/30 text-xs text-sky-200 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                Select your vehicle, exterior paint, cabin interior, and music station. Once confirmed, these settings lock for <strong className="text-white">24 hours</strong>.
              </span>
            </div>
          )}

          {/* 1. Vehicle Model Selector */}
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-[#EF233C]" />
              <span>1. Select Vehicle</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(
                ['SPORTS_COUPE', 'LUXURY_SUV', 'EXECUTIVE_SEDAN', 'RUGGED_4X4'] as VehicleModelType[]
              ).map((vKey) => {
                const prof = VEHICLE_SPEC_PROFILES[vKey];
                const isSelected = vehicleType === vKey;
                return (
                  <button
                    key={vKey}
                    type="button"
                    disabled={lockStatus.isLocked}
                    onClick={() => setVehicleType(vKey)}
                    className={`p-2.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#EF233C] bg-[#EF233C]/15 text-white'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/25'
                    } ${lockStatus.isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className="text-xs font-black block truncate">{prof.name}</span>
                    <span className="text-[10px] text-gray-400 block truncate">
                      {prof.horsepower} HP • {prof.drivenWheels}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Vehicle Paint Color */}
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-emerald-400" />
              <span>2. Exterior Paint ({activeColorObj.name})</span>
            </span>
            <div className="grid grid-cols-4 gap-2">
              {CAR_COLOR_PALETTES.map((c) => {
                const isSelected = paintColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.name}
                    type="button"
                    disabled={lockStatus.isLocked}
                    onClick={() => {
                      setPaintColor(c.hex);
                      setFinish(c.finish as 'gloss' | 'matte' | 'metallic');
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      isSelected
                        ? 'border-[#EF233C] bg-white/10'
                        : 'border-white/10 bg-white/5 hover:border-white/25'
                    } ${lockStatus.isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className="w-6 h-6 rounded-full border border-white/25 flex items-center justify-center"
                      style={{ backgroundColor: c.hex }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white mix-blend-difference" />}
                    </span>
                    <span className="text-[9px] text-gray-300 truncate max-w-full">
                      {c.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Interior Finish */}
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <Armchair className="w-3.5 h-3.5 text-amber-400" />
              <span>3. Cabin Interior Trim</span>
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {INTERIOR_THEME_OPTIONS.map((opt) => {
                const isSelected = interiorTheme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={lockStatus.isLocked}
                    onClick={() => {
                      setInteriorTheme(opt.id);
                      setCameraFocus('INTERIOR');
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      isSelected
                        ? 'border-[#EF233C] bg-white/10'
                        : 'border-white/10 bg-white/5 hover:border-white/25'
                    } ${lockStatus.isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    title={opt.desc}
                  >
                    <span
                      className="w-5 h-5 rounded-md border border-white/30"
                      style={{
                        background: `linear-gradient(135deg, ${opt.seatHex} 55%, ${opt.accentHex} 100%)`,
                      }}
                    />
                    <span className="text-[9px] font-bold text-gray-200 truncate max-w-full">
                      {opt.id === 'SPORT' ? 'Sport' : opt.label.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. In-Car Music Preference */}
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-sky-400" />
              <span>4. In-Car Music Station</span>
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {MUSIC_PREFERENCE_OPTIONS.map((m) => {
                const isSelected = musicPref === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={lockStatus.isLocked}
                    onClick={() => handleToggleMusicPreview(m.id)}
                    className={`px-3 py-2 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#EF233C] bg-[#EF233C]/15 text-white'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/25'
                    } ${lockStatus.isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className="text-[11px] font-bold block">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary Card */}
          <div className="p-3.5 rounded-2xl bg-black/30 border border-white/10 text-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
              Build Summary
            </span>
            <div className="flex justify-between">
              <span className="text-gray-400">Vehicle</span>
              <span className="font-bold text-white">{activeSpec.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Exterior</span>
              <span className="font-bold text-white">{activeColorObj.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Interior</span>
              <span className="font-bold text-white">{activeInteriorObj.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Music</span>
              <span className="font-bold text-white">{activeMusicObj.label}</span>
            </div>
          </div>
        </div>

        {/* Sticky Confirm CTA */}
        <div className="p-4 border-t border-white/10 bg-[#05121f] space-y-2">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {lockStatus.isLocked ? (
            <button
              type="button"
              onClick={onCancelToGame}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Return to Lagos World</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirm}
              className="w-full h-11 rounded-xl bg-[#EF233C] hover:bg-[#d90429] disabled:opacity-60 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#EF233C]/30 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Locking & Entering Lagos...</span>
                </>
              ) : (
                <>
                  <span>Confirm My Vehicle and Enter Game</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
