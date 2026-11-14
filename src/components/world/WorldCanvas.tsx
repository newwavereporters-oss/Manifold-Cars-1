import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createVehicleByType,
  createWorldEnvironment,
  CarCustomization,
  VehicleModelType,
  Vehicle3DResult,
  VEHICLE_SPEC_PROFILES,
} from './worldModels';
import { animateVehicleModel } from '../../three/VehicleModelFactory';
import { engineAudio, AudioDriveMode } from '../../utils/engineAudio';
import { HeadlightState, TurnSignalState, CockpitHotspot } from './CockpitDashboardOverlay';
import { buildLagosCityDistrict, LagosCityResult } from './lagosCityBuilder';
import { TrafficEngine } from './trafficEngine';
import { RivalsEngine } from './rivalsEngine';
import { CollisionEngine } from './collisionEngine';
import {
  findShortestRoadPath,
  RIVAL_RACE_CHECKPOINTS,
  resolveSurfaceY,
  getBridgePitchAt,
  enforceBridgeAndWaterBarriers,
  WORLD_BOUNDS,
} from './lagosCityData';
import { ActiveMissionSession } from './missionEngine';
import type { RemotePlayerPeer } from '../../services/worldMultiplayerService';

export type CameraViewMode = 'CHASE' | 'COCKPIT' | 'ORBIT' | 'DRONE';
export type TimeOfDay = 'DAYLIGHT' | 'SUNSET' | 'MIDNIGHT' | 'GOLDEN_HOUR';

export interface ProjectedRemotePlayer {
  playerId: string;
  nickname: string;
  vehicleModel: VehicleModelType;
  worldRegion: string;
  distance: number;
  screenX: number;
  screenY: number;
  visible: boolean;
  speedKmh: number;
}

export interface WorldCanvasProps {
  customization: CarCustomization;
  cameraMode: CameraViewMode;
  timeOfDay: TimeOfDay;
  presentationMode?: boolean;
  remotePlayers?: RemotePlayerPeer[];
  onProjectedRemotePlayers?: (projected: ProjectedRemotePlayer[]) => void;
  onZoneChange?: (zone: string | null) => void;
  onSpeedChange?: (speedKmh: number, rpm: number, gear: string) => void;
  onSpeedTrapTrigger?: (speedKmh: number) => void;
  onInspectCar?: (carId: string) => void;
  onEnterMarketplace?: () => void;
  onOpenCustomizer?: () => void;
  onOpenDealerLounge?: () => void;
  onCarPositionUpdate?: (pos: { x: number; y?: number; z: number; heading: number; speed?: number }) => void;
  isCustomizerOpen?: boolean;
  virtualInput?: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    handbrake: boolean;
  };
  isEngineRunning?: boolean;
  driveMode?: AudioDriveMode;
  headlightState?: HeadlightState;
  turnSignal?: TurnSignalState;
  hazardLights?: boolean;
  hornActive?: boolean;
  cockpitHotspot?: CockpitHotspot;
  onAwardCredits?: (amount: number, reason: string) => void;
  activeDestination?: { x: number; z: number; name: string } | null;
  activeMissionSession?: ActiveMissionSession | null;
  onMissionUpdate?: (delta: number, playerPos: { x: number; z: number; speed: number }, onCollisionImpact?: boolean) => void;
  onRaceCheckpointPassed?: (cpIdx: number, rank: number) => void;
  onTrafficPositionsUpdate?: (positions: { x: number; z: number }[]) => void;
  onRivalPositionsUpdate?: (positions: { name: string; x: number; z: number }[]) => void;
  resetVehicleTrigger?: number;
}

export const WorldCanvas: React.FC<WorldCanvasProps> = ({
  customization,
  cameraMode,
  timeOfDay,
  presentationMode = false,
  remotePlayers = [],
  onProjectedRemotePlayers,
  onZoneChange,
  onSpeedChange,
  onSpeedTrapTrigger,
  onInspectCar,
  onEnterMarketplace,
  onOpenCustomizer,
  onOpenDealerLounge,
  onCarPositionUpdate,
  isCustomizerOpen = false,
  virtualInput,
  isEngineRunning = true,
  driveMode = 'SPORT',
  headlightState = 'LOW',
  turnSignal = 'OFF',
  hazardLights = false,
  hornActive = false,
  cockpitHotspot = 'DRIVER',
  onAwardCredits,
  activeDestination,
  activeMissionSession,
  onMissionUpdate,
  onRaceCheckpointPassed,
  onTrafficPositionsUpdate,
  onRivalPositionsUpdate,
  resetVehicleTrigger,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // References to preserve Three.js state across re-renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerCarGroupRef = useRef<THREE.Group | null>(null);
  const activeVehicleRef = useRef<Vehicle3DResult | null>(null);
  const activeZoneRef = useRef<string | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const skyMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const skyDomeRef = useRef<THREE.Mesh | null>(null);
  const showroomSpotRef = useRef<THREE.SpotLight | null>(null);
  const sunOffsetRef = useRef<{ x: number; y: number; z: number }>({ x: 75, y: 95, z: 50 });

  // Engines and City Subsystems Refs
  const trafficEngineRef = useRef<TrafficEngine | null>(null);
  const rivalsEngineRef = useRef<RivalsEngine | null>(null);
  const collisionEngineRef = useRef<CollisionEngine | null>(null);
  const cityDataRef = useRef<LagosCityResult | null>(null);
  const playerRaceCheckpointIdx = useRef<number>(1);
  const lastGPSCalcTime = useRef<number>(0);
  const lastTelemetrySendTime = useRef<number>(0);
  const prevMissionStateKey = useRef<string>('');

  // Dynamic Component Refs
  const wheelsRef = useRef<{
    frontLeftWheel: THREE.Group | null;
    frontRightWheel: THREE.Group | null;
    rearLeftWheel: THREE.Group | null;
    rearRightWheel: THREE.Group | null;
  }>({
    frontLeftWheel: null,
    frontRightWheel: null,
    rearLeftWheel: null,
    rearRightWheel: null,
  });

  // Current active vehicle profile for dynamic physics
  const currentVehicleType = customization.vehicleType || 'SPORTS_COUPE';
  const vehicleSpecRef = useRef(VEHICLE_SPEC_PROFILES[currentVehicleType]);
  vehicleSpecRef.current = VEHICLE_SPEC_PROFILES[currentVehicleType];

  // Dynamic prop refs to prevent stale closure in requestAnimationFrame loop
  const virtualInputRef = useRef(virtualInput);
  virtualInputRef.current = virtualInput;

  const isEngineRunningRef = useRef(isEngineRunning);
  isEngineRunningRef.current = isEngineRunning;

  const driveModeRef = useRef(driveMode);
  driveModeRef.current = driveMode;

  const customizationRef = useRef(customization);
  customizationRef.current = customization;

  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  const cockpitHotspotRef = useRef(cockpitHotspot);
  cockpitHotspotRef.current = cockpitHotspot;

  const isCustomizerOpenRef = useRef(isCustomizerOpen);
  isCustomizerOpenRef.current = isCustomizerOpen;

  const turnSignalRef = useRef(turnSignal);
  turnSignalRef.current = turnSignal;

  const hazardLightsRef = useRef(hazardLights);
  hazardLightsRef.current = hazardLights;

  const onZoneChangeRef = useRef(onZoneChange);
  onZoneChangeRef.current = onZoneChange;

  const onSpeedChangeRef = useRef(onSpeedChange);
  onSpeedChangeRef.current = onSpeedChange;

  const onSpeedTrapTriggerRef = useRef(onSpeedTrapTrigger);
  onSpeedTrapTriggerRef.current = onSpeedTrapTrigger;

  const onCarPositionUpdateRef = useRef(onCarPositionUpdate);
  onCarPositionUpdateRef.current = onCarPositionUpdate;

  const onAwardCreditsRef = useRef(onAwardCredits);
  onAwardCreditsRef.current = onAwardCredits;

  const activeDestinationRef = useRef(activeDestination);
  activeDestinationRef.current = activeDestination;

  const activeMissionSessionRef = useRef(activeMissionSession);
  activeMissionSessionRef.current = activeMissionSession;

  const onMissionUpdateRef = useRef(onMissionUpdate);
  onMissionUpdateRef.current = onMissionUpdate;

  const onRaceCheckpointPassedRef = useRef(onRaceCheckpointPassed);
  onRaceCheckpointPassedRef.current = onRaceCheckpointPassed;

  const onTrafficPositionsUpdateRef = useRef(onTrafficPositionsUpdate);
  onTrafficPositionsUpdateRef.current = onTrafficPositionsUpdate;

  const onRivalPositionsUpdateRef = useRef(onRivalPositionsUpdate);
  onRivalPositionsUpdateRef.current = onRivalPositionsUpdate;

  const presentationModeRef = useRef(presentationMode);
  presentationModeRef.current = presentationMode;

  const remotePlayersRef = useRef<RemotePlayerPeer[]>(remotePlayers);
  remotePlayersRef.current = remotePlayers;

  const onProjectedRemotePlayersRef = useRef(onProjectedRemotePlayers);
  onProjectedRemotePlayersRef.current = onProjectedRemotePlayers;

  const remoteCarMeshesRef = useRef<
    Map<
      string,
      {
        group: THREE.Group;
        vehicle: Vehicle3DResult;
        wheelSpinAngle: number;
        modelKey: string;
        x: number;
        y: number;
        z: number;
        heading: number;
        nickname: string;
        vehicleModel: VehicleModelType;
        worldRegion: string;
        distance: number;
        speedKmh: number;
      }
    >
  >(new Map());
  const lastRemoteProjTime = useRef<number>(0);

  // Vehicle Physics & Dynamics State
  const carState = useRef({
    x: 0,
    y: 0,
    z: 10,
    rotation: Math.PI, // yaw in radians (facing showroom towards z-minus)
    speed: 0, // units/sec (~ 1 unit ≈ 1.5 meter)
    steeringAngle: 0,
    wheelSpinAngle: 0,
    isDrifting: false,
    distanceDriven: 0,
    lastDistanceMilestone: 0,
  });

  // Keyboard input tracker
  const keys = useRef<{ [key: string]: boolean }>({});
  const lastHornState = useRef<boolean>(false);

  // Speed trap & indicator timers
  const lastSpeedTrapTrigger = useRef<number>(0);
  const lastBlinkerTick = useRef<number>(0);
  const blinkerPhase = useRef<boolean>(false);

  // Rebuild car model when customization vehicleType or key components change
  useEffect(() => {
    if (!sceneRef.current || !playerCarGroupRef.current) return;

    // Remove old car group
    sceneRef.current.remove(playerCarGroupRef.current);

    // Build new car group with latest customization (spoiler, underglow, paint, wheels)
    const newCar = createVehicleByType(customization);
    newCar.carGroup.rotation.order = 'YXZ';
    sceneRef.current.add(newCar.carGroup);
    playerCarGroupRef.current = newCar.carGroup;
    activeVehicleRef.current = newCar;

    wheelsRef.current = {
      frontLeftWheel: newCar.frontLeftWheel,
      frontRightWheel: newCar.frontRightWheel,
      rearLeftWheel: newCar.rearLeftWheel,
      rearRightWheel: newCar.rearRightWheel,
    };

    // Restore position, elevation & heading
    const restoreY = resolveSurfaceY(carState.current.x, carState.current.z, carState.current.y);
    carState.current.y = restoreY;
    newCar.carGroup.position.set(carState.current.x, restoreY, carState.current.z);
    newCar.carGroup.rotation.y = carState.current.rotation;
    newCar.carGroup.rotation.x = getBridgePitchAt(
      carState.current.x,
      carState.current.z,
      carState.current.rotation,
      restoreY
    );
  }, [
    customization.vehicleType,
    customization.paintColor,
    customization.finish,
    customization.rimColor,
    customization.caliperColor,
    customization.spoiler,
    customization.underglow,
    customization.windowTint,
    customization.interiorTheme,
  ]);

  // Lighting & Time-of-Day updates
  useEffect(() => {
    if (!sceneRef.current || !dirLightRef.current || !hemiLightRef.current || !ambientLightRef.current)
      return;

    const dirLight = dirLightRef.current;
    const hemiLight = hemiLightRef.current;
    const ambLight = ambientLightRef.current;
    const scene = sceneRef.current;
    const skyMat = skyMatRef.current;
    const spot = showroomSpotRef.current;

    switch (timeOfDay) {
      case 'SUNSET':
        scene.background = new THREE.Color(0xf9a875);
        scene.fog = new THREE.FogExp2(0xfdba74, 0.00042);
        scene.environmentIntensity = 0.72;
        if (skyMat) skyMat.color.setHex(0xfb923c);
        dirLight.color.setHex(0xf97316);
        dirLight.intensity = 2.1;
        sunOffsetRef.current = { x: 85, y: 28, z: 65 };
        hemiLight.color.setHex(0xfdba74);
        hemiLight.groundColor.setHex(0x431407);
        hemiLight.intensity = 1.05;
        ambLight.color.setHex(0xffedd5);
        ambLight.intensity = 0.48;
        if (spot) spot.intensity = 7.5;
        break;

      case 'MIDNIGHT':
        scene.background = new THREE.Color(0x050b1a);
        scene.fog = new THREE.FogExp2(0x091326, 0.00085);
        scene.environmentIntensity = 0.36;
        if (skyMat) skyMat.color.setHex(0x050b1a);
        dirLight.color.setHex(0x93c5fd);
        dirLight.intensity = 0.65;
        sunOffsetRef.current = { x: 45, y: 75, z: 35 };
        hemiLight.color.setHex(0x1e293b);
        hemiLight.groundColor.setHex(0x020617);
        hemiLight.intensity = 0.45;
        ambLight.color.setHex(0x1e1b4b);
        ambLight.intensity = 0.25;
        if (spot) spot.intensity = 12.0;
        break;

      case 'GOLDEN_HOUR':
        scene.background = new THREE.Color(0xfde68a);
        scene.fog = new THREE.FogExp2(0xfef3c7, 0.00035);
        scene.environmentIntensity = 0.78;
        if (skyMat) skyMat.color.setHex(0xfacc15);
        dirLight.color.setHex(0xfacc15);
        dirLight.intensity = 2.5;
        sunOffsetRef.current = { x: 75, y: 42, z: 55 };
        hemiLight.color.setHex(0xfef08a);
        hemiLight.groundColor.setHex(0x713f12);
        hemiLight.intensity = 1.15;
        ambLight.color.setHex(0xfef9c3);
        ambLight.intensity = 0.52;
        if (spot) spot.intensity = 6.0;
        break;

      case 'DAYLIGHT':
      default:
        scene.background = new THREE.Color(0xbfe3f7);
        scene.fog = new THREE.FogExp2(0xd2e8f7, 0.00028);
        scene.environmentIntensity = 0.85;
        if (skyMat) skyMat.color.setHex(0x7dd3fc);
        dirLight.color.setHex(0xfffaed);
        dirLight.intensity = 2.4;
        sunOffsetRef.current = { x: 75, y: 95, z: 50 };
        hemiLight.color.setHex(0xdbeafe);
        hemiLight.groundColor.setHex(0x64748b);
        hemiLight.intensity = 1.25;
        ambLight.color.setHex(0xf1f5f9);
        ambLight.intensity = 0.55;
        if (spot) spot.intensity = 4.0;
        break;
    }

    dirLight.position.set(
      carState.current.x + sunOffsetRef.current.x,
      sunOffsetRef.current.y,
      carState.current.z + sunOffsetRef.current.z
    );
    cityDataRef.current?.updateTimeOfDay?.(timeOfDay);
  }, [timeOfDay]);

  // Synchronize Mission Lifecycle (Start positions, Rivals Grid, Checkpoints visibility)
  useEffect(() => {
    const key = activeMissionSession
      ? `${activeMissionSession.missionId}:${activeMissionSession.state}`
      : 'NONE';
    if (key === prevMissionStateKey.current) return;
    prevMissionStateKey.current = key;

    const cityData = cityDataRef.current;
    const rivals = rivalsEngineRef.current;
    const cs = carState.current;

    if (!activeMissionSession) {
      rivals?.resetToGrid();
      if (rivals) rivals.group.visible = false;
      cityData?.checkpointMeshes.forEach((cp) => {
        cp.mesh.visible = false;
      });
      return;
    }

    if (activeMissionSession.missionId === 'MISSION_B_RACE') {
      if (activeMissionSession.state === 'COUNTDOWN') {
        cs.x = -50;
        cs.z = -130;
        cs.rotation = Math.PI / 2;
        cs.speed = 0;
        cs.steeringAngle = 0;
        if (playerCarGroupRef.current) {
          playerCarGroupRef.current.position.set(cs.x, 0, cs.z);
          playerCarGroupRef.current.rotation.y = cs.rotation;
        }
        playerRaceCheckpointIdx.current = 1;
        if (rivals) {
          rivals.group.visible = true;
          rivals.resetToGrid();
        }
        cityData?.checkpointMeshes.forEach((cp, idx) => {
          cp.mesh.visible = idx >= 1;
          cp.mesh.scale.setScalar(idx === 1 ? 1.15 : 0.9);
        });
      } else if (activeMissionSession.state === 'ACTIVE') {
        if (rivals) {
          rivals.group.visible = true;
          rivals.startRace();
        }
      } else if (
        activeMissionSession.state === 'COMPLETED' ||
        activeMissionSession.state === 'FAILED'
      ) {
        rivals?.resetToGrid();
        cityData?.checkpointMeshes.forEach((cp) => {
          cp.mesh.visible = false;
        });
      }
    } else if (activeMissionSession.missionId === 'MISSION_A_DELIVERY') {
      if (rivals) rivals.group.visible = false;
      cityData?.checkpointMeshes.forEach((cp) => {
        cp.mesh.visible = false;
      });
      if (activeMissionSession.state === 'ACTIVE') {
        cs.x = 0;
        cs.z = -124;
        cs.rotation = 0; // Facing South down Herbert Macaulay Way
        cs.speed = 0;
        cs.steeringAngle = 0;
        if (playerCarGroupRef.current) {
          playerCarGroupRef.current.position.set(cs.x, 0, cs.z);
          playerCarGroupRef.current.rotation.y = cs.rotation;
        }
      }
    }
  }, [activeMissionSession?.missionId, activeMissionSession?.state]);

  // Headlights & Exterior Spotlights state sync
  useEffect(() => {
    const v = activeVehicleRef.current;
    if (!v) return;

    if (headlightState === 'HIGH') {
      if (v.headlightSpotL) {
        v.headlightSpotL.intensity = 5.0;
        v.headlightSpotL.distance = 75;
        v.headlightSpotL.angle = 0.65;
      }
      if (v.headlightSpotR) {
        v.headlightSpotR.intensity = 5.0;
        v.headlightSpotR.distance = 75;
        v.headlightSpotR.angle = 0.65;
      }
      v.headlightsGroup.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.emissiveIntensity = 4.0;
        }
      });
    } else if (headlightState === 'LOW') {
      if (v.headlightSpotL) {
        v.headlightSpotL.intensity = 2.2;
        v.headlightSpotL.distance = 40;
        v.headlightSpotL.angle = 0.5;
      }
      if (v.headlightSpotR) {
        v.headlightSpotR.intensity = 2.2;
        v.headlightSpotR.distance = 40;
        v.headlightSpotR.angle = 0.5;
      }
      v.headlightsGroup.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.emissiveIntensity = 2.2;
        }
      });
    } else {
      // OFF
      if (v.headlightSpotL) v.headlightSpotL.intensity = 0;
      if (v.headlightSpotR) v.headlightSpotR.intensity = 0;
      v.headlightsGroup.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.emissiveIntensity = 0.05;
        }
      });
    }
  }, [headlightState]);

  // Horn keyboard & prop synchronization
  useEffect(() => {
    const isHornActiveNow = Boolean(keys.current['h'] || hornActive);
    if (isHornActiveNow !== lastHornState.current) {
      lastHornState.current = isHornActiveNow;
      engineAudio.playHorn(isHornActiveNow);
    }
  }, [hornActive]);

  // Keyboard Listeners (guarded when typing in chat/auth inputs or in presentationMode)
  useEffect(() => {
    const isEditableFocused = (target: EventTarget | null) => {
      const el = (target as HTMLElement | null) || (document.activeElement as HTMLElement | null);
      if (!el) return false;
      const tag = el.tagName?.toUpperCase();
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el.isContentEditable);
    };

    const clearHeldKeys = () => {
      keys.current = {};
      if (lastHornState.current) {
        lastHornState.current = false;
        engineAudio.playHorn(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (presentationModeRef.current || isEditableFocused(e.target)) {
        clearHeldKeys();
        return;
      }
      engineAudio.init();
      const k = e.key.toLowerCase();
      keys.current[k] = true;
      keys.current[e.code] = true;

      // Horn on 'h'
      if (k === 'h' && !lastHornState.current) {
        lastHornState.current = true;
        engineAudio.playHorn(true);
      }

      // Proximity Action on 'E'
      if (k === 'e' && activeZoneRef.current) {
        if (activeZoneRef.current === 'marketplace') {
          onEnterMarketplace?.();
        } else if (activeZoneRef.current === 'customizer') {
          onOpenCustomizer?.();
        } else if (activeZoneRef.current === 'dealer-lounge') {
          onOpenDealerLounge?.();
        } else {
          onInspectCar?.(activeZoneRef.current);
        }
      }

      // Customizer shortcut on 'C'
      if (k === 'c') {
        onOpenCustomizer?.();
      }

      // Vehicle Recovery / Reset on 'R'
      if (k === 'r') {
        const cs = carState.current;
        cs.speed = 0;
        cs.steeringAngle = 0;
        cs.y = 0;
        if (activeMissionSessionRef.current?.missionId === 'MISSION_B_RACE') {
          cs.x = -50;
          cs.z = -130;
          cs.rotation = Math.PI / 2;
        } else {
          cs.x = 0;
          cs.z = 10;
          cs.rotation = Math.PI;
        }
        if (playerCarGroupRef.current) {
          playerCarGroupRef.current.position.set(cs.x, 0, cs.z);
          playerCarGroupRef.current.rotation.y = cs.rotation;
          playerCarGroupRef.current.rotation.x = 0;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current[k] = false;
      keys.current[e.code] = false;

      if (k === 'h' && lastHornState.current) {
        lastHornState.current = false;
        engineAudio.playHorn(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearHeldKeys);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearHeldKeys);
    };
  }, [onEnterMarketplace, onInspectCar, onOpenCustomizer, onOpenDealerLounge]);

  // Reset Vehicle Trigger Prop Effect
  useEffect(() => {
    if (!resetVehicleTrigger) return;
    const cs = carState.current;
    cs.speed = 0;
    cs.steeringAngle = 0;
    cs.y = 0;
    if (activeMissionSessionRef.current?.missionId === 'MISSION_B_RACE') {
      cs.x = -50;
      cs.z = -130;
      cs.rotation = Math.PI / 2;
    } else {
      cs.x = 0;
      cs.z = 10;
      cs.rotation = Math.PI;
    }
    if (playerCarGroupRef.current) {
      playerCarGroupRef.current.position.set(cs.x, 0, cs.z);
      playerCarGroupRef.current.rotation.y = cs.rotation;
      playerCarGroupRef.current.rotation.x = 0;
    }
  }, [resetVehicleTrigger]);

  // Main Three.js Lifecycle
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    scene.background = new THREE.Color(0xbfe3f7);
    scene.fog = new THREE.FogExp2(0xd2e8f7, 0.00028);

    const camera = new THREE.PerspectiveCamera(
      56,
      container.clientWidth / container.clientHeight,
      0.1,
      3600
    );

    // 2. Software WebGL Guard + Renderer Setup with ACES Filmic & sRGB Color Management
    let isSoftwareGl = false;
    try {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
      const rName = dbg && gl ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      isSoftwareGl = /SwiftShader|llvmpipe|WARP/i.test(rName);
    } catch {}

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = isSoftwareGl ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // PMREM RoomEnvironment for physically plausible metallic & glass PBR reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.85;
    roomEnv.dispose();

    // Atmospheric Sky Dome (tracks player XZ in animate() for seamless horizon everywhere)
    const skyGeo = new THREE.SphereGeometry(2400, 28, 18);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      side: THREE.BackSide,
      fog: false,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);
    skyMatRef.current = skyMat;
    skyDomeRef.current = skyDome;

    // 3. Balanced Lighting Setup (Hemisphere + Sun + Ambient Fill)
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x64748b, 1.25);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    const ambLight = new THREE.AmbientLight(0xf1f5f9, 0.55);
    scene.add(ambLight);
    ambientLightRef.current = ambLight;

    const dirLight = new THREE.DirectionalLight(0xfffaed, 2.4);
    dirLight.position.set(75, 95, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = isSoftwareGl ? 1024 : 2048;
    dirLight.shadow.mapSize.height = isSoftwareGl ? 1024 : 2048;
    dirLight.shadow.camera.near = 1.0;
    dirLight.shadow.camera.far = 340;
    dirLight.shadow.camera.left = -135;
    dirLight.shadow.camera.right = 135;
    dirLight.shadow.camera.top = 135;
    dirLight.shadow.camera.bottom = -135;
    dirLight.shadow.bias = -0.0004;
    dirLight.shadow.normalBias = 0.025;
    scene.add(dirLight);
    scene.add(dirLight.target);
    dirLightRef.current = dirLight;

    // Accent Showroom Spotlight
    const showroomSpot = new THREE.SpotLight(0xffffff, 4, 70, Math.PI / 3.5, 0.35);
    showroomSpot.position.set(0, 18, -48);
    showroomSpot.target.position.set(0, 0, -48);
    scene.add(showroomSpot);
    scene.add(showroomSpot.target);
    showroomSpotRef.current = showroomSpot;

    // 4. Build Lagos Mainland City District + Showroom & Interactive Environment
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const cityData = buildLagosCityDistrict(maxAnisotropy);
    cityDataRef.current = cityData;
    scene.add(cityData.cityGroup);

    const { environmentGroup, podiums } = createWorldEnvironment();
    scene.add(environmentGroup);

    // Initialize Traffic AI, Rivals AI, and Collision Engine
    const trafficEngine = new TrafficEngine();
    trafficEngineRef.current = trafficEngine;
    scene.add(trafficEngine.group);

    const rivalsEngine = new RivalsEngine();
    rivalsEngineRef.current = rivalsEngine;
    rivalsEngine.group.visible = false; // Visible when race mission active
    scene.add(rivalsEngine.group);

    const collisionEngine = new CollisionEngine();
    collisionEngineRef.current = collisionEngine;

    // 5. Build Drivable Player Car (from active customization type)
    const playerCar = createVehicleByType(customization);
    playerCar.carGroup.rotation.order = 'YXZ';
    scene.add(playerCar.carGroup);
    playerCarGroupRef.current = playerCar.carGroup;
    activeVehicleRef.current = playerCar;

    wheelsRef.current = {
      frontLeftWheel: playerCar.frontLeftWheel,
      frontRightWheel: playerCar.frontRightWheel,
      rearLeftWheel: playerCar.rearLeftWheel,
      rearRightWheel: playerCar.rearRightWheel,
    };

    playerCar.carGroup.position.set(0, 0, 10);
    carState.current.x = 0;
    carState.current.y = 0;
    carState.current.z = 10;
    carState.current.rotation = Math.PI;

    // Floating Interactive 3D Holographic Marker Above Marketplace Gate [0, 100]
    const markerCanvas = document.createElement('canvas');
    markerCanvas.width = 512;
    markerCanvas.height = 128;
    const mctx = markerCanvas.getContext('2d');
    if (mctx) {
      mctx.fillStyle = '#071A2B';
      mctx.roundRect(10, 10, 492, 108, 16);
      mctx.fill();
      mctx.strokeStyle = '#EF233C';
      mctx.lineWidth = 6;
      mctx.stroke();
      mctx.fillStyle = '#FFFFFF';
      mctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
      mctx.textAlign = 'center';
      mctx.fillText('MANIFOLD MARKETPLACE', 256, 56);
      mctx.fillStyle = '#EF233C';
      mctx.font = 'bold 24px monospace';
      mctx.fillText('[ DRIVE IN OR PRESS E ]', 256, 92);
    }
    const markerTex = new THREE.CanvasTexture(markerCanvas);
    markerTex.colorSpace = THREE.SRGBColorSpace;
    const markerSpriteMat = new THREE.SpriteMaterial({ map: markerTex, transparent: true });
    const marketplaceMarkerSprite = new THREE.Sprite(markerSpriteMat);
    marketplaceMarkerSprite.position.set(0, 13.0, 100);
    marketplaceMarkerSprite.scale.set(13, 3.2, 1);
    scene.add(marketplaceMarkerSprite);

    // Pre-allocated scratch vectors for zero-GC animation loop
    const tmpPodWorldPos = new THREE.Vector3();
    const tmpDriverOffset = new THREE.Vector3();
    const tmpUpAxis = new THREE.Vector3(0, 1, 0);
    const tmpLookTarget = new THREE.Vector3();
    const tmpProjVec = new THREE.Vector3();

    // 6. Animation & Physics Game Loop
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = Math.min((currentTime - lastTime) / 1000, 0.08);
      lastTime = currentTime;

      // Turntables continuous rotation
      podiums.forEach((pod, index) => {
        pod.group.rotation.y += delta * (0.35 + index * 0.05);
      });

      // Holographic marker float pulse
      marketplaceMarkerSprite.position.y = 13.0 + Math.sin(currentTime * 0.003) * 0.35;

      // Presentation / Unauthenticated Aerial Mode (Background world only — no driving session)
      if (presentationModeRef.current) {
        if (playerCarGroupRef.current) playerCarGroupRef.current.visible = false;
        trafficEngine.update(delta, 0, -40, 0);
        cityData.updateTrafficSignals?.(currentTime / 1000);
        const orbitAngle = currentTime * 0.00012;
        const camX = Math.sin(orbitAngle) * 165;
        const camZ = -35 + Math.cos(orbitAngle) * 165;
        camera.position.set(camX, 58, camZ);
        camera.lookAt(0, 4, -35);
        const sunOff = sunOffsetRef.current;
        dirLight.position.set(sunOff.x, sunOff.y, sunOff.z);
        dirLight.target.position.set(0, 0, 0);
        if (skyDomeRef.current) skyDomeRef.current.position.set(0, 0, 0);
        renderer.render(scene, camera);
        return;
      }

      if (playerCarGroupRef.current) playerCarGroupRef.current.visible = true;

      // Input Resolution (Keyboard + Touch), locked during Race Countdown
      const isRaceCountdown = activeMissionSessionRef.current?.state === 'COUNTDOWN';
      const currentVirtual = virtualInputRef.current;
      const input = isRaceCountdown
        ? { forward: false, backward: false, left: false, right: false, handbrake: false }
        : {
            forward: Boolean(keys.current['w'] || keys.current['arrowup'] || currentVirtual?.forward),
            backward: Boolean(keys.current['s'] || keys.current['arrowdown'] || currentVirtual?.backward),
            left: Boolean(keys.current['a'] || keys.current['arrowleft'] || currentVirtual?.left),
            right: Boolean(keys.current['d'] || keys.current['arrowright'] || currentVirtual?.right),
            handbrake: Boolean(keys.current[' '] || keys.current['space'] || currentVirtual?.handbrake),
          };

      const cs = carState.current;
      const baseSpec = vehicleSpecRef.current;
      const currentCustom = customizationRef.current;
      const currentDriveMode = driveModeRef.current;
      const isEngineOn = isEngineRunningRef.current;

      // Calculate installed tuning upgrades modifiers
      const ecu = currentCustom.ecuStage || 0;
      const ecuAccelBonus = ecu === 2 ? 1.45 : ecu === 1 ? 1.2 : 1.0;
      const ecuSpeedBonus = ecu === 2 ? 1.22 : ecu === 1 ? 1.12 : 1.0;

      const isTrackSuspension = currentCustom.suspension === 'TRACK';
      const isSportSuspension = currentCustom.suspension === 'SPORT';
      const steerSpeedMultiplier = isTrackSuspension ? 1.45 : isSportSuspension ? 1.25 : 1.0;

      const isCarbonBrakes = currentCustom.brakes === 'CARBON_CERAMIC';
      const brakeDecelEffective = isCarbonBrakes ? 64 : baseSpec.brakeDecel;

      const isSemiSlick = currentCustom.tires === 'SEMI_SLICK';
      const driftControlMultiplier = isSemiSlick ? 0.75 : 1.0;

      // Drive Mode Adjustments
      let modeAccelMod = 1.0;
      let modeSpeedMod = 1.0;
      let modeSteerMod = 1.0;
      let modeDriftMod = 1.0;

      if (currentDriveMode === 'TRACK') {
        modeAccelMod = 1.28;
        modeSpeedMod = 1.14;
        modeSteerMod = 1.2;
      } else if (currentDriveMode === 'SPORT') {
        modeAccelMod = 1.12;
        modeSpeedMod = 1.06;
      } else if (currentDriveMode === 'ECO') {
        modeAccelMod = 0.75;
        modeSpeedMod = 0.82;
      } else if (currentDriveMode === 'DRIFT') {
        modeAccelMod = 1.1;
        modeDriftMod = 2.4;
      }

      const effectiveAccel = baseSpec.acceleration * ecuAccelBonus * modeAccelMod;
      const effectiveMaxSpeed = baseSpec.maxSpeed * ecuSpeedBonus * modeSpeedMod;
      const effectiveSteerSpeed = baseSpec.steerSpeed * steerSpeedMultiplier * modeSteerMod;

      // Throttle & Braking Dynamics
      // Forward input: brakes if reversing, accelerates if moving forward/stopped and engine is running
      // Backward input: brakes if moving forward, reverses if stopped/reversing and engine is running
      if (input.forward) {
        if (cs.speed < -0.1) {
          // Brakes reverse motion towards zero
          cs.speed = Math.min(0, cs.speed + brakeDecelEffective * delta);
        } else if (isEngineOn) {
          // Accelerate forward
          cs.speed = Math.min(cs.speed + effectiveAccel * delta, effectiveMaxSpeed);
        }
      } else if (input.backward) {
        if (cs.speed > 0.1) {
          // Brakes forward motion towards zero
          cs.speed = Math.max(0, cs.speed - brakeDecelEffective * delta);
        } else if (isEngineOn) {
          // Reverse acceleration
          const maxReverseSpeed = -20;
          cs.speed = Math.max(cs.speed - effectiveAccel * 0.6 * delta, maxReverseSpeed);
        }
      } else {
        // Natural rolling resistance
        if (cs.speed > 0) {
          cs.speed = Math.max(0, cs.speed - baseSpec.deceleration * delta);
        } else if (cs.speed < 0) {
          cs.speed = Math.min(0, cs.speed + baseSpec.deceleration * delta);
        }
      }

      // Handbrake drift
      if (input.handbrake) {
        cs.isDrifting = Math.abs(cs.speed) > 9;
        cs.speed *= Math.pow(0.89, delta * 30);
      } else {
        cs.isDrifting = false;
      }

      // Speed-based steering damping
      const speedSteerFactor = Math.max(0.32, 1 - Math.abs(cs.speed) / (effectiveMaxSpeed * 1.35));
      const targetSteer = input.left
        ? baseSpec.maxSteer * speedSteerFactor
        : input.right
        ? -baseSpec.maxSteer * speedSteerFactor
        : 0;

      cs.steeringAngle += (targetSteer - cs.steeringAngle) * effectiveSteerSpeed * delta * 4;

      // Heading rotation with drift authority
      if (Math.abs(cs.speed) > 0.05) {
        const turnDirection = cs.speed > 0 ? 1 : -1;
        const driftMultiplier = (cs.isDrifting ? 1.7 : 1.0) * modeDriftMod * driftControlMultiplier;
        cs.rotation +=
          (cs.steeringAngle * (cs.speed / effectiveMaxSpeed) * 2.8 * turnDirection * delta) *
          driftMultiplier;
      }

      // Calculate translation vector
      const vx = Math.sin(cs.rotation) * cs.speed * delta;
      const vz = Math.cos(cs.rotation) * cs.speed * delta;

      // Track distance driven for economy rewards
      const stepDistance = Math.hypot(vx, vz);
      cs.distanceDriven += stepDistance;
      if (cs.distanceDriven - cs.lastDistanceMilestone > 250) {
        cs.lastDistanceMilestone = cs.distanceDriven;
        onAwardCreditsRef.current?.(25, 'Distance Cruise Bonus');
      }

      // Expanded World Boundaries (Island + Epe + Third Mainland Bridge + Mainland + LASU)
      let nextX = cs.x + vx;
      let nextZ = cs.z + vz;

      if (nextX >= WORLD_BOUNDS.minX && nextX <= WORLD_BOUNDS.maxX) {
        cs.x = nextX;
      } else {
        cs.x = Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, nextX));
        cs.speed = -cs.speed * 0.25;
      }

      if (nextZ >= WORLD_BOUNDS.minZ && nextZ <= WORLD_BOUNDS.maxZ) {
        cs.z = nextZ;
      } else {
        cs.z = Math.max(WORLD_BOUNDS.minZ, Math.min(WORLD_BOUNDS.maxZ, nextZ));
        cs.speed = -cs.speed * 0.25;
      }

      // Bridge Parapet Guardrails (respecting Adekunle Exit Gore) & Coastal Seawall Barriers
      enforceBridgeAndWaterBarriers(cs, cs.y);

      // Autonomous Traffic AI, Rival Racers & Live Traffic Signals Update
      trafficEngine.update(delta, cs.x, cs.z, cs.speed);
      rivalsEngine.update(delta, currentTime);
      cityData.updateTrafficSignals?.(currentTime / 1000);

      // Building, Traffic & Rival Collision Resolution matched to actual vehicle dimensions
      const collisionEvent = collisionEngine.checkAndResolvePlayerCollisions(
        cs,
        baseSpec.bodyWidth * 0.5,
        baseSpec.bodyLength * 0.5,
        cityData.collidableBuildings,
        trafficEngine.getTrafficBoundingBoxes(),
        rivalsEngine.isRaceActive ? rivalsEngine.getRivalsBoundingBoxes() : []
      );

      // Compute exact level-aware road/bridge/ramp elevation Y and heading-aligned pitch
      const carY = resolveSurfaceY(cs.x, cs.z, cs.y);
      cs.y = carY;
      const bridgePitch = getBridgePitchAt(cs.x, cs.z, cs.rotation, carY);

      // Sync 3D model with physics state
      if (playerCarGroupRef.current) {
        playerCarGroupRef.current.position.set(cs.x, carY, cs.z);
        playerCarGroupRef.current.rotation.y = cs.rotation;
        playerCarGroupRef.current.rotation.x = bridgePitch;
      }

      // Track sun shadow frustum & skyDome to player position (texel-snapped to prevent shimmer)
      const snapX = Math.round(cs.x / 2) * 2;
      const snapZ = Math.round(cs.z / 2) * 2;
      const sunOff = sunOffsetRef.current;
      dirLight.position.set(snapX + sunOff.x, sunOff.y, snapZ + sunOff.z);
      dirLight.target.position.set(snapX, carY, snapZ);
      if (skyDomeRef.current) {
        skyDomeRef.current.position.set(cs.x, 0, cs.z);
      }

      // Mission Update & Street Race Checkpoint Detection
      const activeSession = activeMissionSessionRef.current;
      if (activeSession) {
        if (activeSession.missionId === 'MISSION_B_RACE' && activeSession.state === 'ACTIVE') {
          const cpIdx = playerRaceCheckpointIdx.current;
          const targetCP = RIVAL_RACE_CHECKPOINTS[cpIdx];
          if (targetCP) {
            const distToCP = Math.hypot(cs.x - targetCP.x, cs.z - targetCP.z);
            if (distToCP < targetCP.radius + 3.5) {
              const standings = rivalsEngine.getRaceStandings({
                checkpointIdx: cpIdx + 1,
                distToNext: 0,
                isFinished: cpIdx >= RIVAL_RACE_CHECKPOINTS.length - 1,
              });
              onRaceCheckpointPassedRef.current?.(cpIdx, standings.rank);

              const completedMesh = cityData.checkpointMeshes[cpIdx];
              if (completedMesh) completedMesh.mesh.visible = false;

              if (cpIdx < RIVAL_RACE_CHECKPOINTS.length - 1) {
                playerRaceCheckpointIdx.current = cpIdx + 1;
                const nextMesh = cityData.checkpointMeshes[cpIdx + 1];
                if (nextMesh) nextMesh.mesh.scale.setScalar(1.15);
              }
            }
          }
        }

        const hasHeavyImpact = Boolean(collisionEvent && collisionEvent.impactVelocity > 6);
        onMissionUpdateRef.current?.(
          delta,
          { x: cs.x, z: cs.z, speed: cs.speed },
          hasHeavyImpact
        );
      }

      // Throttled Dynamic GPS Road Guidance Ribbon (every 250ms)
      if (currentTime - lastGPSCalcTime.current > 250) {
        lastGPSCalcTime.current = currentTime;
        const dest = activeDestinationRef.current;
        if (dest) {
          const path = findShortestRoadPath({ x: cs.x, z: cs.z, y: cs.y }, dest);
          cityData.updateGPSRoute(path);
        } else {
          cityData.updateGPSRoute([]);
        }
      }

      // Throttled Traffic & Rival Map Radar Updates (every 160ms)
      if (currentTime - lastTelemetrySendTime.current > 160) {
        lastTelemetrySendTime.current = currentTime;
        if (onTrafficPositionsUpdateRef.current) {
          onTrafficPositionsUpdateRef.current(
            trafficEngine.vehicles.map((v) => ({ x: v.x, z: v.z }))
          );
        }
        if (onRivalPositionsUpdateRef.current) {
          onRivalPositionsUpdateRef.current(
            rivalsEngine.isRaceActive
              ? rivalsEngine.rivals.map((r) => ({ name: r.name, x: r.x, z: r.z }))
              : []
          );
        }
      }

      // Wheels, steering wheel, driver animation, suspension squat/roll & COCKPIT driver culling
      const activeVehicle = activeVehicleRef.current;
      const wheelRadius = activeVehicle?.wheelRadius || 0.38;
      const wheelCircumference = 2 * Math.PI * wheelRadius;
      const wheelDelta = (cs.speed * delta) / wheelCircumference;
      cs.wheelSpinAngle += wheelDelta * Math.PI * 2;

      const accelLoad =
        input.forward && isEngineOn
          ? 1
          : input.backward && cs.speed > 0.1
          ? -1.2
          : input.backward && isEngineOn
          ? -0.7
          : 0;

      if (activeVehicle) {
        animateVehicleModel(activeVehicle, {
          speed: cs.speed,
          steeringAngle: cs.steeringAngle,
          wheelSpinAngle: cs.wheelSpinAngle,
          accelLoad,
          delta,
          isCockpitCamera: cameraModeRef.current === 'COCKPIT',
        });
      } else {
        const wheels = wheelsRef.current;
        if (wheels.frontLeftWheel && wheels.frontRightWheel) {
          wheels.frontLeftWheel.rotation.y = cs.steeringAngle;
          wheels.frontRightWheel.rotation.y = Math.PI + cs.steeringAngle;
        }
        if (wheels.frontLeftWheel && wheels.frontRightWheel && wheels.rearLeftWheel && wheels.rearRightWheel) {
          wheels.frontLeftWheel.rotation.x = cs.wheelSpinAngle;
          wheels.frontRightWheel.rotation.x = -cs.wheelSpinAngle;
          wheels.rearLeftWheel.rotation.x = cs.wheelSpinAngle;
          wheels.rearRightWheel.rotation.x = -cs.wheelSpinAngle;
        }
      }

      // Exterior Turn Signals & Hazard Blinking sync
      const currentTurnSignal = turnSignalRef.current;
      const currentHazard = hazardLightsRef.current;
      const isBlinkingNow =
        (currentTurnSignal !== 'OFF' || currentHazard) && Math.floor(currentTime / 450) % 2 === 0;

      if (activeVehicleRef.current?.turnSignalMeshes) {
        const { frontLeft, frontRight, rearLeft, rearRight } = activeVehicleRef.current.turnSignalMeshes;
        const leftBlink = (currentTurnSignal === 'LEFT' || currentHazard) && isBlinkingNow;
        const rightBlink = (currentTurnSignal === 'RIGHT' || currentHazard) && isBlinkingNow;

        (frontLeft.material as THREE.MeshStandardMaterial).emissiveIntensity = leftBlink ? 3.5 : 0.05;
        (rearLeft.material as THREE.MeshStandardMaterial).emissiveIntensity = leftBlink ? 3.5 : 0.05;

        (frontRight.material as THREE.MeshStandardMaterial).emissiveIntensity = rightBlink ? 3.5 : 0.05;
        (rearRight.material as THREE.MeshStandardMaterial).emissiveIntensity = rightBlink ? 3.5 : 0.05;

        // Audio Tick on phase switch
        if (isBlinkingNow !== blinkerPhase.current) {
          blinkerPhase.current = isBlinkingNow;
          if (currentTime - lastBlinkerTick.current > 350) {
            lastBlinkerTick.current = currentTime;
            engineAudio.playTurnSignalClick(isBlinkingNow ? 'on' : 'off');
          }
        }
      }

      // Player Brake Lights & Reverse Lights Feedback
      const isBrakingNow = Boolean((input.backward && cs.speed > 0.15) || (input.forward && cs.speed < -0.15) || input.handbrake);
      const isReversingNow = cs.speed < -0.15;
      if (activeVehicleRef.current?.brakeLightMats) {
        activeVehicleRef.current.brakeLightMats.forEach((mat) => {
          mat.emissiveIntensity = isBrakingNow ? 4.2 : 0.75;
        });
      }
      if (activeVehicleRef.current?.reverseLights) {
        activeVehicleRef.current.reverseLights.forEach((mesh) => {
          mesh.visible = isReversingNow;
        });
      }

      // Engine audio synthesis update with dynamic acceleration load and vehicle profile
      engineAudio.update(
        cs.speed,
        effectiveMaxSpeed,
        isEngineOn && (input.forward || input.backward),
        input.backward && cs.speed > 0,
        cs.isDrifting,
        currentDriveMode,
        currentVehicleType
      );

      // HUD Telemetry (Speed km/h, RPM, Gear)
      const speedKmh = Math.round(Math.abs(cs.speed) * 4.6);
      const speedRatio = Math.abs(cs.speed) / effectiveMaxSpeed;
      const rpm = Math.round(baseSpec.idleRpm + speedRatio * (baseSpec.redlineRpm - baseSpec.idleRpm));
      const gear = !isEngineOn
        ? 'OFF'
        : cs.speed < -0.5
        ? 'R'
        : Math.abs(cs.speed) < 0.2
        ? 'P'
        : speedKmh < 35
        ? 'D1'
        : speedKmh < 70
        ? 'D2'
        : speedKmh < 110
        ? 'D3'
        : speedKmh < 155
        ? 'D4'
        : speedKmh < 205
        ? 'D5'
        : 'D6';

      onSpeedChangeRef.current?.(speedKmh, rpm, gear);
      onCarPositionUpdateRef.current?.({ x: cs.x, y: cs.y, z: cs.z, heading: cs.rotation, speed: cs.speed });

      // Zone Detection & Proximity Hotspots
      let detectedZone: string | null = null;

      // 1. Marketplace Grand Gate Check (at [0, 0, 100])
      const distToPortal = Math.hypot(cs.x - 0, cs.z - 100);
      if (distToPortal < 12) {
        detectedZone = 'marketplace';
      }

      // 2. Showroom Podiums Check
      podiums.forEach((pod) => {
        pod.group.getWorldPosition(tmpPodWorldPos);
        const distToPod = Math.hypot(cs.x - tmpPodWorldPos.x, cs.z - tmpPodWorldPos.z);
        if (distToPod < 8.5) {
          detectedZone = pod.carId;
        }
      });

      // 3. Customization Garage Check (at [35, 0, 10])
      const distToCustomizer = Math.hypot(cs.x - 35, cs.z - 10);
      if (distToCustomizer < 8.5) {
        detectedZone = 'customizer';
      }

      // 4. VIP Concierge Lounge Check (at [56, 0, 16] forecourt of [57, 0, 22])
      const distToLounge = Math.hypot(cs.x - 56, cs.z - 16);
      if (distToLounge < 10.5) {
        detectedZone = 'dealer-lounge';
      }

      // 5. Speed Trap Trigger (at [-55, 0, 0])
      const distToSpeedTrap = Math.hypot(cs.x - (-55), cs.z - 0);
      if (distToSpeedTrap < 6.0 && speedKmh > 20) {
        const now = performance.now();
        if (now - lastSpeedTrapTrigger.current > 4000) {
          lastSpeedTrapTrigger.current = now;
          onSpeedTrapTriggerRef.current?.(speedKmh);
          if (speedKmh > 160) {
            onAwardCreditsRef.current?.(350, 'High-Speed Trap Milestone (>160 km/h)');
          } else if (speedKmh > 100) {
            onAwardCreditsRef.current?.(150, 'Speed Trap Record Passed');
          }
        }
      }

      if (detectedZone !== activeZoneRef.current) {
        activeZoneRef.current = detectedZone;
        onZoneChangeRef.current?.(detectedZone);
      }

      // CAMERA MODES ORCHESTRATION (Zero-GC using pre-allocated scratch vectors)
      const currentCameraMode = cameraModeRef.current;
      const currentCockpitHotspot = cockpitHotspotRef.current;
      const isCustomizerOpen = isCustomizerOpenRef.current;

      if (currentCameraMode === 'COCKPIT') {
        const baseOffset = baseSpec.cockpitOffset;
        let ox = baseOffset.x;
        let oy = baseOffset.y;
        let oz = baseOffset.z;
        let lookTargetDist = 28;
        let lookTargetY = baseSpec.lookTargetHeight;

        if (currentCockpitHotspot === 'DASHBOARD') {
          oy = baseOffset.y - 0.12;
          oz = baseOffset.z + 0.18;
          lookTargetDist = 1.2;
          lookTargetY = baseOffset.y - 0.05;
        } else if (currentCockpitHotspot === 'CONSOLE') {
          ox = 0;
          oy = baseOffset.y - 0.1;
          oz = baseOffset.z + 0.1;
          lookTargetDist = 1.5;
          lookTargetY = baseOffset.y - 0.15;
        } else if (currentCockpitHotspot === 'WINDSHIELD') {
          ox = 0;
          oy = baseOffset.y + 0.1;
          oz = baseOffset.z + 0.6;
          lookTargetDist = 35;
          lookTargetY = baseSpec.lookTargetHeight;
        }

        tmpDriverOffset.set(ox, oy, oz).applyAxisAngle(tmpUpAxis, cs.rotation);
        camera.position.set(
          cs.x + tmpDriverOffset.x,
          carY + tmpDriverOffset.y,
          cs.z + tmpDriverOffset.z
        );

        tmpLookTarget.set(
          cs.x + Math.sin(cs.rotation) * lookTargetDist,
          carY + lookTargetY,
          cs.z + Math.cos(cs.rotation) * lookTargetDist
        );
        camera.lookAt(tmpLookTarget);
      } else if (currentCameraMode === 'ORBIT' || isCustomizerOpen) {
        const orbitAngle = currentTime * 0.0006;
        const orbitDistance = 8.0;
        camera.position.set(
          cs.x + Math.sin(orbitAngle) * orbitDistance,
          carY + 2.6,
          cs.z + Math.cos(orbitAngle) * orbitDistance
        );
        camera.lookAt(cs.x, carY + 0.7, cs.z);
      } else if (currentCameraMode === 'DRONE') {
        const droneDist = 20;
        const targetCamX = cs.x - Math.sin(cs.rotation) * droneDist;
        const targetCamZ = cs.z - Math.cos(cs.rotation) * droneDist;

        camera.position.x += (targetCamX - camera.position.x) * delta * 2.2;
        camera.position.y += (carY + 14 - camera.position.y) * delta * 2.2;
        camera.position.z += (targetCamZ - camera.position.z) * delta * 2.2;
        camera.lookAt(cs.x, carY + 0.5, cs.z);
      } else {
        const targetCamX = cs.x - Math.sin(cs.rotation) * baseSpec.chaseDistance;
        const targetCamZ = cs.z - Math.cos(cs.rotation) * baseSpec.chaseDistance;

        camera.position.x += (targetCamX - camera.position.x) * delta * 6.5;
        camera.position.y += (carY + baseSpec.chaseHeight - camera.position.y) * delta * 4.5;
        camera.position.z += (targetCamZ - camera.position.z) * delta * 6.5;

        tmpLookTarget.set(
          cs.x + Math.sin(cs.rotation) * baseSpec.chaseLookAhead,
          carY + 0.7,
          cs.z + Math.cos(cs.rotation) * baseSpec.chaseLookAhead
        );
        camera.lookAt(tmpLookTarget);
      }

      // Remote Active Player Vehicles (Smooth interpolation + projected roof badge coords)
      const remotePool = remoteCarMeshesRef.current;
      const incomingPeers = remotePlayersRef.current;
      const activeIds = new Set(incomingPeers.map((p) => p.playerId));

      for (const [pid, entry] of remotePool.entries()) {
        if (!activeIds.has(pid)) {
          scene.remove(entry.group);
          remotePool.delete(pid);
        }
      }

      for (const peer of incomingPeers) {
        const mKey = `${peer.vehicleModel}|${peer.paintColor}`;
        let entry = remotePool.get(peer.playerId);
        if (!entry || entry.modelKey !== mKey) {
          if (entry) scene.remove(entry.group);
          const remoteModel = createVehicleByType({
            vehicleType: peer.vehicleModel,
            paintColor: peer.paintColor,
            finish: 'metallic',
            rimColor: '#E2E8F0',
            caliperColor: '#EF233C',
            headlightTint: '#ffffff',
            windowTint: 0.4,
          });
          remoteModel.carGroup.rotation.order = 'YXZ';
          remoteModel.carGroup.position.set(peer.x, peer.y, peer.z);
          remoteModel.carGroup.rotation.y = peer.heading;
          scene.add(remoteModel.carGroup);
          entry = {
            group: remoteModel.carGroup,
            vehicle: remoteModel,
            wheelSpinAngle: 0,
            modelKey: mKey,
            x: peer.x,
            y: peer.y,
            z: peer.z,
            heading: peer.heading,
            nickname: peer.nickname,
            vehicleModel: peer.vehicleModel,
            worldRegion: peer.worldRegion,
            distance: peer.distance,
            speedKmh: Math.round(Math.abs(peer.speed) * 4.6),
          };
          remotePool.set(peer.playerId, entry);
        } else {
          const lerpAlpha = Math.min(1, delta * 8.5);
          entry.x += (peer.x - entry.x) * lerpAlpha;
          entry.z += (peer.z - entry.z) * lerpAlpha;
          let angleDiff = peer.heading - entry.heading;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          entry.heading += angleDiff * lerpAlpha;
          entry.y = resolveSurfaceY(entry.x, entry.z, peer.y);
          entry.distance = peer.distance;
          entry.worldRegion = peer.worldRegion;
          entry.speedKmh = Math.round(Math.abs(peer.speed) * 4.6);

          const peerWheelR = entry.vehicle.wheelRadius || 0.38;
          entry.wheelSpinAngle += (peer.speed * delta) / peerWheelR;
          animateVehicleModel(entry.vehicle, {
            speed: peer.speed,
            steeringAngle: THREE.MathUtils.clamp(angleDiff * 0.65, -0.35, 0.35),
            wheelSpinAngle: entry.wheelSpinAngle,
            delta,
            isCockpitCamera: false,
          });

          entry.group.position.set(entry.x, entry.y, entry.z);
          entry.group.rotation.y = entry.heading;
          entry.group.rotation.x = getBridgePitchAt(entry.x, entry.z, entry.heading, entry.y);
        }
      }

      renderer.render(scene, camera);

      // Emit throttled screen-projected coordinates for clickable driver tags
      if (onProjectedRemotePlayersRef.current && currentTime - lastRemoteProjTime.current > 45) {
        lastRemoteProjTime.current = currentTime;
        const w = container.clientWidth;
        const h = container.clientHeight;
        const projected: ProjectedRemotePlayer[] = [];
        for (const [pid, entry] of remotePool.entries()) {
          tmpProjVec.set(entry.x, entry.y + 2.45, entry.z);
          tmpProjVec.project(camera);
          const visible =
            tmpProjVec.z > -1 &&
            tmpProjVec.z < 1 &&
            tmpProjVec.x >= -0.92 &&
            tmpProjVec.x <= 0.92 &&
            tmpProjVec.y >= -0.92 &&
            tmpProjVec.y <= 0.92;
          projected.push({
            playerId: pid,
            nickname: entry.nickname,
            vehicleModel: entry.vehicleModel,
            worldRegion: entry.worldRegion,
            distance: entry.distance,
            screenX: (tmpProjVec.x * 0.5 + 0.5) * w,
            screenY: (-tmpProjVec.y * 0.5 + 0.5) * h,
            visible,
            speedKmh: entry.speedKmh,
          });
        }
        onProjectedRemotePlayersRef.current(projected);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width <= 0 || height <= 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      for (const entry of remoteCarMeshesRef.current.values()) {
        scene.remove(entry.group);
      }
      remoteCarMeshesRef.current.clear();
      cityData.dispose?.();
      trafficEngine.dispose?.();
      skyGeo.dispose();
      skyMat.dispose();
      markerTex.dispose();
      markerSpriteMat.dispose();
      envRT.dispose();
      pmremGenerator.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      engineAudio.stop();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
      tabIndex={0}
      title="MANIFOLD WORLD 3D Proving Ground"
    />
  );
};
