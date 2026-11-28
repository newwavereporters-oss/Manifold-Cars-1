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
  HeadlightState,
  TurnSignalState,
  TransmissionGear,
  TRANSMISSION_GEAR_PROFILES,
  computeTargetSteerAngle,
  stepSteeringAngle,
} from './worldModels';
import { animateVehicleModel } from '../../three/VehicleModelFactory';
import { engineAudio, AudioDriveMode } from '../../utils/engineAudio';
import { resolveSafeCameraPosition, isTargetOccludedByBuildings } from '../../utils/cameraCollision';
import { buildLagosCityDistrict, LagosCityResult } from './lagosCityBuilder';
import { TrafficEngine } from './trafficEngine';
import { RivalsEngine, type CoastalRaceState } from './rivalsEngine';
import { CollisionEngine, VehicleColliderBox } from './collisionEngine';
import {
  findFreeSharedSpawnPose,
  isSpawnPoseClear,
} from './spawnUtils';
import {
  findShortestRoadPath,
  RIVAL_RACE_CHECKPOINTS,
  resolveSurfaceY,
  getBridgePitchAt,
  enforceBridgeAndWaterBarriers,
  WORLD_BOUNDS,
  WORLD_XZ_SCALE,
} from './lagosCityData';
import {
  applyVehicleDent,
  computeImpactSeverity,
  resetVehicleDamage,
} from '../../three/vehicleDamage';
import { ActiveMissionSession, MISSIONS_CATALOG } from './missionEngine';
import type { RemotePlayerPeer } from '../../services/worldMultiplayerService';
import {
  disposeObject3D,
  resolveWebGLProfile,
  type WebGLQualityMode,
} from '../../utils/webglPerformance';

export type CameraViewMode = 'CHASE' | 'DRONE';
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
  qualityMode?: WebGLQualityMode;
  isCityMapOpen?: boolean;
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
  onMotionSample?: (pos: { x: number; y?: number; z: number; heading: number; speed?: number }) => void;
  onInitStageChange?: (stage: { step: string; progress: number }) => void;
  onContextLost?: (lost: boolean) => void;
  isCustomizerOpen?: boolean;
  virtualInput?: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    handbrake: boolean;
    steerAxis?: number;
  };
  isEngineRunning?: boolean;
  driveMode?: AudioDriveMode;
  selectedGear?: TransmissionGear;
  onSelectGear?: (gear: TransmissionGear) => void;
  headlightState?: HeadlightState;
  turnSignal?: TurnSignalState;
  hazardLights?: boolean;
  hornActive?: boolean;
  onAwardCredits?: (amount: number, reason: string) => void;
  activeDestination?: { x: number; z: number; name: string } | null;
  activeMissionTarget?: { x: number; z: number; radius: number; isFinalDestination: boolean } | null;
  activeMissionSession?: ActiveMissionSession | null;
  onMissionUpdate?: (
    delta: number,
    playerPos: { x: number; z: number; speed: number; gear?: TransmissionGear },
    onCollisionImpact?: boolean
  ) => void;
  onRaceCheckpointPassed?: (
    cpIdx: number,
    rank: number,
    coords?: { x: number; z: number; gear?: TransmissionGear }
  ) => void;
  onTrafficPositionsUpdate?: (positions: { x: number; z: number }[]) => void;
  onRivalPositionsUpdate?: (positions: { name: string; x: number; z: number }[]) => void;
  resetVehicleTrigger?: number;
  coastalRaceCommand?: { action: 'START' | 'EXIT'; seq: number } | null;
  onCoastalRaceUpdate?: (state: CoastalRaceState | null) => void;
  onStartCoastalRace?: () => void;
}

export const WorldCanvas: React.FC<WorldCanvasProps> = ({
  customization,
  cameraMode,
  timeOfDay,
  qualityMode = 'AUTO',
  isCityMapOpen = false,
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
  onMotionSample,
  onInitStageChange,
  onContextLost,
  isCustomizerOpen = false,
  virtualInput,
  isEngineRunning = true,
  driveMode = 'SPORT',
  selectedGear = 'D2',
  onSelectGear,
  headlightState = 'LOW',
  turnSignal = 'OFF',
  hazardLights = false,
  hornActive = false,
  onAwardCredits,
  activeDestination,
  activeMissionTarget,
  activeMissionSession,
  onMissionUpdate,
  onRaceCheckpointPassed,
  onTrafficPositionsUpdate,
  onRivalPositionsUpdate,
  resetVehicleTrigger,
  coastalRaceCommand,
  onCoastalRaceUpdate,
  onStartCoastalRace,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // References to preserve Three.js state across re-renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const envRenderTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
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
  const lastHudEmitTime = useRef<number>(0);
  const lastPosUiEmitTime = useRef<number>(0);
  const lastEmittedGear = useRef<string>('');
  const prevMissionStateKey = useRef<string>('');
  const contextLostRef = useRef<boolean>(false);
  const coastalRaceSessionRef = useRef<{
    phase: 'COUNTDOWN' | 'ACTIVE' | 'FINISHED';
    countdownRemaining: number;
    startTimeMs: number;
    checkpointIdx: number;
    prizeAwarded: boolean;
  } | null>(null);
  const lastCoastalEmitRef = useRef<number>(0);
  const lastHandledRaceCmdSeqRef = useRef<number>(-1);
  const raceBadgeContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const raceBadgeBoxRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const raceBadgeNumRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const raceBadgePrevRankRef = useRef<Record<string, number>>({});
  const raceBadgePopTimeRef = useRef<Record<string, number>>({});
  const raceBadgeLastStyleKeyRef = useRef<Record<string, string>>({});

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

  const selectedGearRef = useRef<TransmissionGear>(selectedGear);
  selectedGearRef.current = selectedGear;

  const onSelectGearRef = useRef(onSelectGear);
  onSelectGearRef.current = onSelectGear;

  const customizationRef = useRef(customization);
  customizationRef.current = customization;

  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  const isCustomizerOpenRef = useRef(isCustomizerOpen);
  isCustomizerOpenRef.current = isCustomizerOpen;

  // Chase & Drone Camera State Refs (zero re-render smooth framing + interactive drone inspection)
  const chaseCamRef = useRef({
    yaw: Math.PI,
    fov: 56,
    initialized: false,
  });
  const droneCamRef = useRef({
    yawOffset: 0.35,
    pitch: 0.46,
    distance: 22,
    isDragging: false,
    lastPointerX: 0,
    lastPointerY: 0,
  });

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

  const onMotionSampleRef = useRef(onMotionSample);
  onMotionSampleRef.current = onMotionSample;

  const onInitStageChangeRef = useRef(onInitStageChange);
  onInitStageChangeRef.current = onInitStageChange;

  const onContextLostRef = useRef(onContextLost);
  onContextLostRef.current = onContextLost;

  const qualityModeRef = useRef<WebGLQualityMode>(qualityMode);
  qualityModeRef.current = qualityMode;
  const perfProfileRef = useRef(resolveWebGLProfile(qualityMode));
  perfProfileRef.current = resolveWebGLProfile(qualityMode);

  const isCityMapOpenRef = useRef(isCityMapOpen);
  isCityMapOpenRef.current = isCityMapOpen;

  const onAwardCreditsRef = useRef(onAwardCredits);
  onAwardCreditsRef.current = onAwardCredits;

  const activeDestinationRef = useRef(activeDestination);
  activeDestinationRef.current = activeDestination;

  const activeMissionTargetRef = useRef(activeMissionTarget);
  activeMissionTargetRef.current = activeMissionTarget;

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

  const onCoastalRaceUpdateRef = useRef(onCoastalRaceUpdate);
  onCoastalRaceUpdateRef.current = onCoastalRaceUpdate;

  const onStartCoastalRaceRef = useRef(onStartCoastalRace);
  onStartCoastalRaceRef.current = onStartCoastalRace;

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
        paintColor: string;
        width: number;
        length: number;
        x: number;
        y: number;
        z: number;
        heading: number;
        speed: number;
        nickname: string;
        vehicleModel: VehicleModelType;
        worldRegion: string;
        distance: number;
        speedKmh: number;
      }
    >
  >(new Map());
  const lastRemoteProjTime = useRef<number>(0);
  const relocatedSpawnRef = useRef<boolean>(false);
  const impactJoltRef = useRef<{ intensity: number; dirX: number; dirZ: number }>({
    intensity: 0,
    dirX: 0,
    dirZ: 1,
  });

  // Vehicle Physics & Dynamics State
  const carState = useRef({
    x: 0,
    y: 0,
    z: 10 * WORLD_XZ_SCALE,
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

  // Rebuild car model when customization vehicleType or key components change (dispose old GPU buffers!)
  useEffect(() => {
    if (!sceneRef.current || !playerCarGroupRef.current) return;

    const oldGroup = playerCarGroupRef.current;
    sceneRef.current.remove(oldGroup);
    disposeObject3D(oldGroup);

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

  // Lighting, Time-of-Day & WebGL Quality Profile synchronization
  useEffect(() => {
    if (!sceneRef.current || !dirLightRef.current || !hemiLightRef.current || !ambientLightRef.current)
      return;

    const dirLight = dirLightRef.current;
    const hemiLight = hemiLightRef.current;
    const ambLight = ambientLightRef.current;
    const scene = sceneRef.current;
    const skyMat = skyMatRef.current;
    const spot = showroomSpotRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const perfProfile = resolveWebGLProfile(qualityMode);
    perfProfileRef.current = perfProfile;

    if (renderer) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, perfProfile.maxDpr));
      renderer.shadowMap.enabled = perfProfile.shadowsEnabled;
    }
    dirLight.castShadow = perfProfile.shadowsEnabled;
    if (camera) {
      camera.far = perfProfile.farPlane;
      camera.updateProjectionMatrix();
    }

    const fogMult = perfProfile.fogDensityMultiplier;

    switch (timeOfDay) {
      case 'SUNSET':
        scene.background = new THREE.Color(0xf9a875);
        scene.fog = new THREE.FogExp2(0xfdba74, 0.00042 * fogMult);
        scene.environment = perfProfile.useEnvMap ? envRenderTargetRef.current?.texture || null : null;
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
        scene.fog = new THREE.FogExp2(0x091326, 0.00085 * fogMult);
        scene.environment = perfProfile.useEnvMap ? envRenderTargetRef.current?.texture || null : null;
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
        scene.fog = new THREE.FogExp2(0xfef3c7, 0.00035 * fogMult);
        scene.environment = perfProfile.useEnvMap ? envRenderTargetRef.current?.texture || null : null;
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
        scene.fog = new THREE.FogExp2(0xd2e8f7, 0.00028 * fogMult);
        scene.environment = perfProfile.useEnvMap ? envRenderTargetRef.current?.texture || null : null;
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
  }, [timeOfDay, qualityMode]);

  // Synchronize Mission Lifecycle (Start positions, Rivals Grid, Checkpoints visibility)
  useEffect(() => {
    const key = activeMissionSession
      ? `${activeMissionSession.missionId}:${activeMissionSession.state}`
      : 'NONE';
    const prevKey = prevMissionStateKey.current;
    const prevState = prevKey.includes(':') ? prevKey.split(':')[1] : prevKey;
    const stateChanged = key !== prevKey;
    prevMissionStateKey.current = key;

    const cityData = cityDataRef.current;
    const rivals = rivalsEngineRef.current;
    const cs = carState.current;

    if (!activeMissionSession) {
      if (!stateChanged) return;
      rivals?.resetToGrid();
      if (rivals) rivals.group.visible = false;
      cityData?.checkpointMeshes.forEach((cp) => {
        cp.mesh.visible = false;
      });
      return;
    }

    if (activeMissionSession.missionId === 'MISSION_B_RACE') {
      if (stateChanged && activeMissionSession.state === 'COUNTDOWN') {
        onSelectGearRef.current?.('D1');
        const startCP = RIVAL_RACE_CHECKPOINTS[0];
        cs.x = startCP.x - 2.0;
        cs.z = startCP.z + 4.0;
        cs.y = resolveSurfaceY(cs.x, cs.z, 0);
        cs.rotation = Math.PI / 2;
        cs.speed = 0;
        cs.steeringAngle = 0;
        chaseCamRef.current.yaw = cs.rotation;
        if (playerCarGroupRef.current) {
          playerCarGroupRef.current.position.set(cs.x, cs.y, cs.z);
          playerCarGroupRef.current.rotation.y = cs.rotation;
          playerCarGroupRef.current.rotation.x = 0;
          resetVehicleDamage(playerCarGroupRef.current);
        }
        trafficEngineRef.current?.clearArea(
          140 * WORLD_XZ_SCALE,
          2300 * WORLD_XZ_SCALE,
          295 * WORLD_XZ_SCALE,
          345 * WORLD_XZ_SCALE
        );
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
        if (stateChanged && rivals) {
          rivals.group.visible = true;
          rivals.startRace();
        }
        // Rewind race checkpoint meshes if permanent-checkpoint recovery rolled back index
        if (activeMissionSession.currentRaceCheckpointIdx < playerRaceCheckpointIdx.current) {
          const targetIdx = Math.max(0, activeMissionSession.currentRaceCheckpointIdx);
          playerRaceCheckpointIdx.current = targetIdx;
          cityData?.checkpointMeshes.forEach((cp, idx) => {
            cp.mesh.visible = idx >= targetIdx;
            cp.mesh.scale.setScalar(idx === targetIdx ? 1.15 : 0.9);
          });
        }
      } else if (
        stateChanged &&
        (activeMissionSession.state === 'VERIFYING' ||
          activeMissionSession.state === 'COMPLETED' ||
          activeMissionSession.state === 'FAILING' ||
          activeMissionSession.state === 'FAILED' ||
          activeMissionSession.state === 'FAILURE_SYNC_FAILED' ||
          activeMissionSession.state === 'VERIFICATION_FAILED' ||
          activeMissionSession.state === 'ABANDONING' ||
          activeMissionSession.state === 'ABANDON_FAILED')
      ) {
        rivals?.resetToGrid();
        cityData?.checkpointMeshes.forEach((cp) => {
          cp.mesh.visible = false;
        });
      }
    } else if (stateChanged) {
      if (rivals && !coastalRaceSessionRef.current) rivals.group.visible = false;
      if (!coastalRaceSessionRef.current) {
        cityData?.checkpointMeshes.forEach((cp) => {
          cp.mesh.visible = false;
        });
      }
      const isInitialEntry =
        !prevState || prevState === 'NONE' || prevState === 'BRIEFING' || prevState === 'COUNTDOWN';
      if (activeMissionSession.state === 'ACTIVE' && isInitialEntry) {
        const missionDef = MISSIONS_CATALOG[activeMissionSession.missionId];
        if (missionDef) {
          const firstTarget = missionDef.checkpoints[0] || {
            x: missionDef.destX,
            z: missionDef.destZ,
          };
          cs.x = missionDef.startX;
          cs.z = missionDef.startZ;
          cs.y = resolveSurfaceY(cs.x, cs.z, 0);
          cs.rotation = Math.atan2(firstTarget.x - cs.x, firstTarget.z - cs.z);
          cs.speed = 0;
          cs.steeringAngle = 0;
          chaseCamRef.current.yaw = cs.rotation;
          if (playerCarGroupRef.current) {
            playerCarGroupRef.current.position.set(cs.x, cs.y, cs.z);
            playerCarGroupRef.current.rotation.y = cs.rotation;
          }
        }
      }
    }
  }, [
    activeMissionSession?.missionId,
    activeMissionSession?.state,
    activeMissionSession?.currentRaceCheckpointIdx,
  ]);

  // Standalone Coastal Highway Race Command Handler (Victoria Island -> Epe 4-lane AI Race)
  useEffect(() => {
    if (!coastalRaceCommand || coastalRaceCommand.seq === lastHandledRaceCmdSeqRef.current) {
      return;
    }
    lastHandledRaceCmdSeqRef.current = coastalRaceCommand.seq;

    const cityData = cityDataRef.current;
    const rivals = rivalsEngineRef.current;
    const cs = carState.current;

    if (coastalRaceCommand.action === 'START') {
      const startCP = RIVAL_RACE_CHECKPOINTS[0];
      const finishCP = RIVAL_RACE_CHECKPOINTS[RIVAL_RACE_CHECKPOINTS.length - 1];
      trafficEngineRef.current?.clearArea(
        140 * WORLD_XZ_SCALE,
        2300 * WORLD_XZ_SCALE,
        295 * WORLD_XZ_SCALE,
        345 * WORLD_XZ_SCALE
      );

      onSelectGearRef.current?.('D1');
      cs.x = startCP.x - 2.0;
      cs.z = startCP.z + 4.0;
      cs.y = resolveSurfaceY(cs.x, cs.z, 0);
      cs.rotation = Math.PI / 2;
      cs.speed = 0;
      cs.steeringAngle = 0;
      chaseCamRef.current.yaw = Math.PI / 2;

      if (playerCarGroupRef.current) {
        playerCarGroupRef.current.position.set(cs.x, cs.y, cs.z);
        playerCarGroupRef.current.rotation.y = cs.rotation;
        playerCarGroupRef.current.rotation.x = 0;
        resetVehicleDamage(playerCarGroupRef.current);
      }

      if (rivals) {
        rivals.group.visible = true;
        rivals.resetToGrid();
      }
      cityData?.checkpointMeshes.forEach((cp, idx) => {
        cp.mesh.visible = idx >= 1;
        cp.mesh.scale.setScalar(idx === 1 ? 1.15 : 0.9);
      });

      coastalRaceSessionRef.current = {
        phase: 'COUNTDOWN',
        countdownRemaining: 3.2,
        startTimeMs: 0,
        checkpointIdx: 1,
        prizeAwarded: false,
      };
      lastCoastalEmitRef.current = 0;

      const standings = rivals
        ? rivals.getRaceStandings({
            checkpointIdx: 1,
            distToNext: Math.hypot(
              RIVAL_RACE_CHECKPOINTS[1].x - cs.x,
              RIVAL_RACE_CHECKPOINTS[1].z - cs.z
            ),
            isFinished: false,
          })
        : { rank: 1, leaderboard: [] };

      onCoastalRaceUpdateRef.current?.({
        phase: 'COUNTDOWN',
        countdownSeconds: 3,
        elapsedSec: 0,
        rank: standings.rank,
        totalRacers: (rivals?.rivals.length ?? 4) + 1,
        checkpointIdx: 1,
        totalCheckpoints: RIVAL_RACE_CHECKPOINTS.length,
        distanceRemainingMeters: Math.round(Math.hypot(finishCP.x - cs.x, finishCP.z - cs.z) * 1.5),
        leaderboard: standings.leaderboard,
        prizeCredits: 0,
      });
    } else if (coastalRaceCommand.action === 'EXIT') {
      coastalRaceSessionRef.current = null;
      if (activeMissionSessionRef.current?.missionId !== 'MISSION_B_RACE') {
        rivals?.resetToGrid();
        if (rivals) rivals.group.visible = false;
        cityData?.checkpointMeshes.forEach((cp) => {
          cp.mesh.visible = false;
        });
      }
      onCoastalRaceUpdateRef.current?.(null);
    }
  }, [coastalRaceCommand]);

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
        } else if (activeZoneRef.current === 'coastal-race') {
          onStartCoastalRaceRef.current?.();
        } else {
          onInspectCar?.(activeZoneRef.current);
        }
      }

      // Customizer shortcut on 'C'
      if (k === 'c') {
        onOpenCustomizer?.();
      }

      // Transmission gear shortcuts: 1 (P), 2 (D0), 3 (D2), 4 (D1), 5 (R)
      if (k === '1') onSelectGearRef.current?.('P');
      else if (k === '2') onSelectGearRef.current?.('D0');
      else if (k === '3') onSelectGearRef.current?.('D2');
      else if (k === '4') onSelectGearRef.current?.('D1');
      else if (k === '5') onSelectGearRef.current?.('R');

      // Vehicle Recovery / Reset on 'R' (places vehicle in nearest clear shared slot)
      if (k === 'r') {
        const cs = carState.current;
        const spec = vehicleSpecRef.current;
        const isRace =
          activeMissionSessionRef.current?.missionId === 'MISSION_B_RACE' ||
          Boolean(coastalRaceSessionRef.current);
        const raceStart = RIVAL_RACE_CHECKPOINTS[0];
        const occupied = [
          ...Array.from(remoteCarMeshesRef.current.values()).map((r) => ({
            x: r.x,
            y: r.y,
            z: r.z,
            width: r.width,
            length: r.length,
            rotation: r.heading,
          })),
          ...(trafficEngineRef.current?.getTrafficBoundingBoxes() ?? []),
          ...(rivalsEngineRef.current?.isRaceActive || coastalRaceSessionRef.current
            ? rivalsEngineRef.current?.getRivalsBoundingBoxes() ?? []
            : []),
        ];
        const freePose = findFreeSharedSpawnPose({
          baseX: isRace ? raceStart.x - 2.0 : 0,
          baseZ: isRace ? raceStart.z + 4.0 : 10 * WORLD_XZ_SCALE,
          rotation: isRace ? Math.PI / 2 : Math.PI,
          carHalfWidth: spec.bodyWidth * 0.5,
          carHalfLength: spec.bodyLength * 0.5,
          occupiedVehicles: occupied,
          buildings: cityDataRef.current?.collidableBuildings ?? [],
          barricades: cityDataRef.current?.barricades ?? [],
        });
        cs.speed = 0;
        cs.steeringAngle = 0;
        cs.x = freePose.x;
        cs.y = freePose.y;
        cs.z = freePose.z;
        cs.rotation = freePose.rotation;
        if (playerCarGroupRef.current) {
          playerCarGroupRef.current.position.set(cs.x, cs.y, cs.z);
          playerCarGroupRef.current.rotation.y = cs.rotation;
          playerCarGroupRef.current.rotation.x = 0;
          resetVehicleDamage(playerCarGroupRef.current);
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

  // Reset Drone Orbit framing cleanly whenever entering DRONE mode
  useEffect(() => {
    if (cameraMode === 'DRONE') {
      droneCamRef.current.yawOffset = 0.32;
      droneCamRef.current.pitch = 0.46;
      droneCamRef.current.distance = 22;
      droneCamRef.current.isDragging = false;
    } else {
      chaseCamRef.current.yaw = carState.current.rotation;
    }
  }, [cameraMode]);

  // Reset Vehicle Trigger Prop Effect
  useEffect(() => {
    if (!resetVehicleTrigger) return;
    const cs = carState.current;
    const spec = vehicleSpecRef.current;
    const isRace =
      activeMissionSessionRef.current?.missionId === 'MISSION_B_RACE' ||
      Boolean(coastalRaceSessionRef.current);
    const raceStart = RIVAL_RACE_CHECKPOINTS[0];
    const occupied = [
      ...Array.from(remoteCarMeshesRef.current.values()).map((r) => ({
        x: r.x,
        y: r.y,
        z: r.z,
        width: r.width,
        length: r.length,
        rotation: r.heading,
      })),
      ...(trafficEngineRef.current?.getTrafficBoundingBoxes() ?? []),
      ...(rivalsEngineRef.current?.isRaceActive || coastalRaceSessionRef.current
        ? rivalsEngineRef.current?.getRivalsBoundingBoxes() ?? []
        : []),
    ];
    const freePose = findFreeSharedSpawnPose({
      baseX: isRace ? raceStart.x - 2.0 : 0,
      baseZ: isRace ? raceStart.z + 4.0 : 10 * WORLD_XZ_SCALE,
      rotation: isRace ? Math.PI / 2 : Math.PI,
      carHalfWidth: spec.bodyWidth * 0.5,
      carHalfLength: spec.bodyLength * 0.5,
      occupiedVehicles: occupied,
      buildings: cityDataRef.current?.collidableBuildings ?? [],
      barricades: cityDataRef.current?.barricades ?? [],
    });
    cs.speed = 0;
    cs.steeringAngle = 0;
    cs.x = freePose.x;
    cs.y = freePose.y;
    cs.z = freePose.z;
    cs.rotation = freePose.rotation;
    chaseCamRef.current.yaw = cs.rotation;
    if (playerCarGroupRef.current) {
      playerCarGroupRef.current.position.set(cs.x, cs.y, cs.z);
      playerCarGroupRef.current.rotation.y = cs.rotation;
      playerCarGroupRef.current.rotation.x = 0;
      resetVehicleDamage(playerCarGroupRef.current);
    }
  }, [resetVehicleTrigger]);

  // Main Three.js Lifecycle
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const perfProfile = resolveWebGLProfile(qualityModeRef.current);
    perfProfileRef.current = perfProfile;
    onInitStageChangeRef.current?.({ step: 'Initializing 3D renderer...', progress: 25 });

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    scene.background = new THREE.Color(0xbfe3f7);
    scene.fog = new THREE.FogExp2(0xd2e8f7, 0.00028 * perfProfile.fogDensityMultiplier);

    const camera = new THREE.PerspectiveCamera(
      56,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      perfProfile.farPlane
    );
    cameraRef.current = camera;

    // 2. Device-Aware Renderer Setup with ACES Filmic & sRGB Color Management
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: perfProfile.antialias,
        powerPreference: 'high-performance',
      });
    } catch {
      onContextLostRef.current?.(true);
      return;
    }

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, perfProfile.maxDpr));
    renderer.shadowMap.enabled = perfProfile.shadowsEnabled;
    renderer.shadowMap.type = perfProfile.shadowType;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    const domEl = renderer.domElement;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLostRef.current = true;
      onContextLostRef.current?.(true);
    };
    const handleContextRestored = () => {
      contextLostRef.current = false;
      onContextLostRef.current?.(false);
    };
    domEl.addEventListener('webglcontextlost', handleContextLost);
    domEl.addEventListener('webglcontextrestored', handleContextRestored);

    // Interactive Drone Camera Drag-Orbit & Wheel Zoom (strictly active in DRONE mode, zero physics conflict)
    const handleDronePointerDown = (e: PointerEvent) => {
      if (cameraModeRef.current !== 'DRONE' || presentationModeRef.current) return;
      droneCamRef.current.isDragging = true;
      droneCamRef.current.lastPointerX = e.clientX;
      droneCamRef.current.lastPointerY = e.clientY;
    };
    const handleDronePointerMove = (e: PointerEvent) => {
      if (!droneCamRef.current.isDragging || cameraModeRef.current !== 'DRONE') return;
      const dx = e.clientX - droneCamRef.current.lastPointerX;
      const dy = e.clientY - droneCamRef.current.lastPointerY;
      droneCamRef.current.lastPointerX = e.clientX;
      droneCamRef.current.lastPointerY = e.clientY;
      droneCamRef.current.yawOffset -= dx * 0.0065;
      droneCamRef.current.pitch = THREE.MathUtils.clamp(
        droneCamRef.current.pitch + dy * 0.005,
        0.14,
        1.25
      );
    };
    const handleDronePointerUp = () => {
      droneCamRef.current.isDragging = false;
    };
    const handleDroneWheel = (e: WheelEvent) => {
      if (cameraModeRef.current !== 'DRONE' || presentationModeRef.current) return;
      e.preventDefault();
      droneCamRef.current.distance = THREE.MathUtils.clamp(
        droneCamRef.current.distance + e.deltaY * 0.02,
        10,
        52
      );
    };
    domEl.addEventListener('pointerdown', handleDronePointerDown);
    window.addEventListener('pointermove', handleDronePointerMove);
    window.addEventListener('pointerup', handleDronePointerUp);
    window.addEventListener('pointercancel', handleDronePointerUp);
    domEl.addEventListener('wheel', handleDroneWheel, { passive: false });

    // PMREM RoomEnvironment for physically plausible metallic & glass PBR reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    envRenderTargetRef.current = envRT;
    scene.environment = perfProfile.useEnvMap ? envRT.texture : null;
    scene.environmentIntensity = 0.85;
    roomEnv.dispose();

    // Atmospheric Sky Dome (tracks player XZ in animate() for seamless horizon everywhere)
    const skyGeo = new THREE.SphereGeometry(4600, 24, 16);
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
    dirLight.castShadow = perfProfile.shadowsEnabled;
    dirLight.shadow.mapSize.width = perfProfile.shadowMapSize;
    dirLight.shadow.mapSize.height = perfProfile.shadowMapSize;
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
    const showroomSpot = new THREE.SpotLight(0xffffff, 4, 75, Math.PI / 3.5, 0.35);
    showroomSpot.position.set(0, 18, -48 * WORLD_XZ_SCALE);
    showroomSpot.target.position.set(0, 0, -48 * WORLD_XZ_SCALE);
    scene.add(showroomSpot);
    scene.add(showroomSpot.target);
    showroomSpotRef.current = showroomSpot;

    onInitStageChangeRef.current?.({ step: 'Building Lagos roads & bridges...', progress: 55 });

    // 4. Build Lagos Mainland City District + Showroom & Interactive Environment
    const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const cityData = buildLagosCityDistrict(maxAnisotropy);
    cityDataRef.current = cityData;
    scene.add(cityData.cityGroup);

    const { environmentGroup, podiums } = createWorldEnvironment();
    scene.add(environmentGroup);

    onInitStageChangeRef.current?.({ step: 'Preparing traffic & player vehicle...', progress: 82 });

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

    const initialRemoteOccupied = remotePlayersRef.current.map((p) => {
      const pSpec = VEHICLE_SPEC_PROFILES[p.vehicleModel] || VEHICLE_SPEC_PROFILES.SPORTS_COUPE;
      return {
        x: p.x,
        y: p.y,
        z: p.z,
        width: pSpec.bodyWidth,
        length: pSpec.bodyLength,
        rotation: p.heading,
      };
    });
    const initPose = findFreeSharedSpawnPose({
      baseX: 0,
      baseZ: 10 * WORLD_XZ_SCALE,
      rotation: Math.PI,
      carHalfWidth: vehicleSpecRef.current.bodyWidth * 0.5,
      carHalfLength: vehicleSpecRef.current.bodyLength * 0.5,
      occupiedVehicles: [...initialRemoteOccupied, ...trafficEngine.getTrafficBoundingBoxes()],
      buildings: cityData.collidableBuildings,
      barricades: cityData.barricades,
    });
    playerCar.carGroup.position.set(initPose.x, initPose.y, initPose.z);
    carState.current.x = initPose.x;
    carState.current.y = initPose.y;
    carState.current.z = initPose.z;
    carState.current.rotation = initPose.rotation;

    // Floating Interactive 3D Holographic Marker Above Marketplace Gate [0, 100 * S]
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
    marketplaceMarkerSprite.position.set(0, 13.0, 100 * WORLD_XZ_SCALE);
    marketplaceMarkerSprite.scale.set(13, 3.2, 1);
    scene.add(marketplaceMarkerSprite);

    // Dynamic 3D Mission Checkpoint / Destination Waypoint Beacon
    const missionBeaconGroup = new THREE.Group();
    missionBeaconGroup.visible = false;
    const beaconRingGeo = new THREE.RingGeometry(4.2, 5.4, 32);
    const beaconRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const beaconRing = new THREE.Mesh(beaconRingGeo, beaconRingMat);
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.y = 0.25;
    missionBeaconGroup.add(beaconRing);

    const beaconPillarGeo = new THREE.CylinderGeometry(1.1, 1.1, 24, 16, 1, true);
    const beaconPillarMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beaconPillar = new THREE.Mesh(beaconPillarGeo, beaconPillarMat);
    beaconPillar.position.y = 12;
    missionBeaconGroup.add(beaconPillar);
    scene.add(missionBeaconGroup);

    // Zero-GC Pooled 3D Car-Part Debris Splash & Friction Sparks System
    const MAX_DEBRIS = 96;
    const MAX_SPARKS = 48;
    const debrisGeo = new THREE.BoxGeometry(0.32, 0.13, 0.22);
    const debrisMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.42,
      metalness: 0.38,
    });
    const debrisInst = new THREE.InstancedMesh(debrisGeo, debrisMat, MAX_DEBRIS);
    debrisInst.frustumCulled = false;
    debrisInst.castShadow = false;

    const sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.36);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sparkInst = new THREE.InstancedMesh(sparkGeo, sparkMat, MAX_SPARKS);
    sparkInst.frustumCulled = false;

    const debrisDummy = new THREE.Object3D();
    const tmpDebrisColor = new THREE.Color(0xffffff);
    debrisDummy.scale.set(0, 0, 0);
    debrisDummy.updateMatrix();
    for (let i = 0; i < MAX_DEBRIS; i++) {
      debrisInst.setMatrixAt(i, debrisDummy.matrix);
      debrisInst.setColorAt(i, tmpDebrisColor);
    }
    debrisInst.instanceMatrix.needsUpdate = true;
    if (debrisInst.instanceColor) debrisInst.instanceColor.needsUpdate = true;
    for (let i = 0; i < MAX_SPARKS; i++) {
      sparkInst.setMatrixAt(i, debrisDummy.matrix);
      sparkInst.setColorAt(i, tmpDebrisColor);
    }
    sparkInst.instanceMatrix.needsUpdate = true;
    if (sparkInst.instanceColor) sparkInst.instanceColor.needsUpdate = true;
    scene.add(debrisInst, sparkInst);

    const debrisPool = Array.from({ length: MAX_DEBRIS }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      vrx: 0,
      vry: 0,
      vrz: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      age: 0,
      maxLife: 1.4,
      colorHex: 0xffffff,
    }));
    const sparkPool = Array.from({ length: MAX_SPARKS }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      maxLife: 0.45,
      colorHex: 0xfacc15,
    }));
    let debrisCursor = 0;
    let sparkCursor = 0;
    let lastSplashTime = 0;

    const parseHexColor = (val: string | number | undefined, fallback: number): number => {
      if (typeof val === 'number' && Number.isFinite(val)) return val;
      if (typeof val === 'string') {
        const clean = val.trim().replace('#', '');
        const parsed = parseInt(clean, 16);
        if (!Number.isNaN(parsed)) return parsed;
      }
      return fallback;
    };

    const spawnCrashSplash = (
      hitX: number,
      hitY: number,
      hitZ: number,
      normalX: number,
      normalZ: number,
      impactSpeed: number,
      primaryHex: string | number,
      secondaryHex?: string | number
    ) => {
      const nowMs = performance.now();
      if (impactSpeed < 2.6 || nowMs - lastSplashTime < 75) return;
      lastSplashTime = nowMs;

      const cPrimary = parseHexColor(primaryHex, 0xef233c);
      const cSecondary = parseHexColor(secondaryHex, 0x1e293b);
      const shardCount = Math.min(24, Math.max(10, Math.round(impactSpeed * 0.9)));
      const sparkCount = Math.min(14, Math.max(6, Math.round(impactSpeed * 0.55)));
      const speedScale = Math.max(5.5, Math.min(20, impactSpeed * 0.72));

      // Trigger camera impact jolt
      impactJoltRef.current.intensity = Math.min(0.62, impactSpeed * 0.025);
      impactJoltRef.current.dirX = normalX;
      impactJoltRef.current.dirZ = normalZ;

      for (let i = 0; i < shardCount; i++) {
        const p = debrisPool[debrisCursor];
        debrisCursor = (debrisCursor + 1) % MAX_DEBRIS;

        const spread = (Math.random() - 0.5) * 2.1;
        const perpX = -normalZ;
        const perpZ = normalX;
        const ejectSpeed = speedScale * (0.45 + Math.random() * 0.75);

        p.active = true;
        p.x = hitX + (Math.random() - 0.5) * 0.55;
        p.y = hitY + 0.35 + Math.random() * 0.45;
        p.z = hitZ + (Math.random() - 0.5) * 0.55;
        p.vx = (normalX * 0.65 + perpX * spread) * ejectSpeed + (Math.random() - 0.5) * 3.5;
        p.vy = 4.2 + Math.random() * (4.0 + speedScale * 0.42);
        p.vz = (normalZ * 0.65 + perpZ * spread) * ejectSpeed + (Math.random() - 0.5) * 3.5;
        p.rx = Math.random() * Math.PI * 2;
        p.ry = Math.random() * Math.PI * 2;
        p.rz = Math.random() * Math.PI * 2;
        p.vrx = (Math.random() - 0.5) * 14;
        p.vry = (Math.random() - 0.5) * 14;
        p.vrz = (Math.random() - 0.5) * 14;
        p.scaleX = 0.65 + Math.random() * 1.15;
        p.scaleY = 0.55 + Math.random() * 0.9;
        p.scaleZ = 0.7 + Math.random() * 1.25;
        p.age = 0;
        p.maxLife = 1.15 + Math.random() * 0.85;

        const rCol = Math.random();
        p.colorHex =
          rCol < 0.42
            ? cPrimary
            : rCol < 0.76
            ? cSecondary
            : rCol < 0.9
            ? 0x334155
            : 0xdc2626;
      }

      for (let i = 0; i < sparkCount; i++) {
        const sp = sparkPool[sparkCursor];
        sparkCursor = (sparkCursor + 1) % MAX_SPARKS;
        const spread = (Math.random() - 0.5) * 2.6;
        const perpX = -normalZ;
        const perpZ = normalX;
        const spVel = speedScale * (0.75 + Math.random() * 0.85);
        sp.active = true;
        sp.x = hitX + (Math.random() - 0.5) * 0.4;
        sp.y = hitY + 0.4 + Math.random() * 0.35;
        sp.z = hitZ + (Math.random() - 0.5) * 0.4;
        sp.vx = (normalX * 0.4 + perpX * spread) * spVel;
        sp.vy = 2.8 + Math.random() * 7.5;
        sp.vz = (normalZ * 0.4 + perpZ * spread) * spVel;
        sp.age = 0;
        sp.maxLife = 0.28 + Math.random() * 0.25;
        sp.colorHex = Math.random() < 0.55 ? 0xfef08a : 0xf97316;
      }
    };

    // Pre-allocated scratch vectors for zero-GC animation loop
    const tmpPodWorldPos = new THREE.Vector3();
    const tmpLookTarget = new THREE.Vector3();
    const tmpProjVec = new THREE.Vector3();
    const tmpDentHit = new THREE.Vector3();
    const tmpDentDir = new THREE.Vector3();
    const remoteBoxesScratch: VehicleColliderBox[] = [];

    // 6. Animation & Physics Game Loop
    let animationFrameId = 0;
    let lastTime = performance.now();
    let readyReported = false;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        lastTime = performance.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);

      if (document.hidden || contextLostRef.current) {
        lastTime = currentTime;
        return;
      }

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
        trafficEngine.update(delta, 0, -40 * WORLD_XZ_SCALE, 0, perfProfileRef.current.trafficCullDistance);
        cityData.updateTrafficSignals?.(currentTime / 1000);
        cityData.updateDynamicWorld?.(delta, currentTime / 1000);
        const orbitAngle = currentTime * 0.00012;
        const camX = Math.sin(orbitAngle) * 165;
        const camZ = -35 * WORLD_XZ_SCALE + Math.cos(orbitAngle) * 165;
        camera.position.set(camX, 58, camZ);
        camera.lookAt(0, 4, -35 * WORLD_XZ_SCALE);
        const sunOff = sunOffsetRef.current;
        dirLight.position.set(sunOff.x, sunOff.y, sunOff.z);
        dirLight.target.position.set(0, 0, 0);
        if (skyDomeRef.current) skyDomeRef.current.position.set(0, 0, 0);
        renderer.render(scene, camera);
        if (!readyReported) {
          readyReported = true;
          onInitStageChangeRef.current?.({ step: 'World ready', progress: 100 });
        }
        return;
      }

      if (playerCarGroupRef.current) playerCarGroupRef.current.visible = true;

      // Input Resolution (Keyboard + Touch), locked during Race Countdown
      const isRaceCountdown =
        activeMissionSessionRef.current?.state === 'COUNTDOWN' ||
        coastalRaceSessionRef.current?.phase === 'COUNTDOWN';
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

      const currentGear = selectedGearRef.current || 'D2';
      const gearProfile =
        TRANSMISSION_GEAR_PROFILES[currentGear] || TRANSMISSION_GEAR_PROFILES.D2;

      const rawGearMaxSpeed = baseSpec.maxSpeed * ecuSpeedBonus * modeSpeedMod * gearProfile.maxSpeedMultiplier;
      const effectiveMaxSpeed = currentGear === 'P' ? 0 : Math.max(4, rawGearMaxSpeed);
      const effectiveAccel = baseSpec.acceleration * ecuAccelBonus * modeAccelMod * gearProfile.accelMultiplier;
      const effectiveSteerSpeed = baseSpec.steerSpeed * steerSpeedMultiplier * modeSteerMod;

      // Transmission-Governed Throttle & Braking Dynamics
      // Strict hierarchy: D1 (Fast) > D2 (Moderate) > D0 (Slow); P locks vehicle; R governs reverse
      if (currentGear === 'P' || isRaceCountdown) {
        if (Math.abs(cs.speed) > 0.1) {
          const decel = brakeDecelEffective * delta;
          cs.speed = cs.speed > 0 ? Math.max(0, cs.speed - decel) : Math.min(0, cs.speed + decel);
        } else {
          cs.speed = 0;
        }
      } else if (currentGear === 'R') {
        const maxReverseSpeed = -(baseSpec.maxSpeed * ecuSpeedBonus * gearProfile.maxSpeedMultiplier);
        if (input.backward) {
          // Pressing Brake pedal slows down smoothly
          if (cs.speed < 0) {
            cs.speed = Math.min(0, cs.speed + brakeDecelEffective * delta);
          } else if (cs.speed > 0) {
            cs.speed = Math.max(0, cs.speed - brakeDecelEffective * delta);
          }
        } else if (input.forward && isEngineOn) {
          // Pressing GAS in Reverse gear drives backward smoothly
          if (cs.speed > 0.1) {
            cs.speed = Math.max(0, cs.speed - brakeDecelEffective * delta);
          } else {
            cs.speed = Math.max(cs.speed - effectiveAccel * delta, maxReverseSpeed);
          }
        } else {
          if (cs.speed > 0) {
            cs.speed = Math.max(0, cs.speed - baseSpec.deceleration * delta);
          } else if (cs.speed < 0) {
            cs.speed = Math.min(0, cs.speed + baseSpec.deceleration * delta);
          }
        }
      } else {
        // Forward Drive Gears (D0 Slow, D2 Moderate, D1 Fast)
        if (input.backward) {
          if (cs.speed > 0.1) {
            cs.speed = Math.max(0, cs.speed - brakeDecelEffective * delta);
          } else if (cs.speed < -0.1) {
            cs.speed = Math.min(0, cs.speed + brakeDecelEffective * delta);
          } else {
            cs.speed = 0;
          }
        } else if (input.forward) {
          if (cs.speed < -0.1) {
            cs.speed = Math.min(0, cs.speed + brakeDecelEffective * delta);
          } else if (isEngineOn) {
            if (cs.speed > effectiveMaxSpeed) {
              // Smooth engine braking down to newly selected lower gear cap (e.g. D1 -> D0)
              cs.speed = Math.max(effectiveMaxSpeed, cs.speed - baseSpec.deceleration * 1.4 * delta);
            } else {
              cs.speed = Math.min(cs.speed + effectiveAccel * delta, effectiveMaxSpeed);
            }
          }
        } else {
          if (cs.speed > 0) {
            cs.speed = Math.max(0, cs.speed - baseSpec.deceleration * delta);
          } else if (cs.speed < 0) {
            cs.speed = Math.min(0, cs.speed + baseSpec.deceleration * delta);
          }
        }
      }

      // Handbrake drift
      if (input.handbrake && currentGear !== 'P') {
        cs.isDrifting = Math.abs(cs.speed) > 9;
        cs.speed *= Math.pow(0.89, delta * 30);
      } else {
        cs.isDrifting = false;
      }

      // Smooth, full-lock exponential steering (analog steering wheel + keyboard priority)
      const keyboardLeft = Boolean(!isRaceCountdown && (keys.current['a'] || keys.current['arrowleft']));
      const keyboardRight = Boolean(!isRaceCountdown && (keys.current['d'] || keys.current['arrowright']));
      const keyboardSteer = keyboardLeft && !keyboardRight ? 1 : keyboardRight && !keyboardLeft ? -1 : 0;
      const virtualSteerAxis =
        !isRaceCountdown && typeof currentVirtual?.steerAxis === 'number'
          ? Math.max(-1, Math.min(1, currentVirtual.steerAxis))
          : 0;
      const steerInput =
        keyboardSteer !== 0
          ? keyboardSteer
          : Math.abs(virtualSteerAxis) > 0.005
          ? virtualSteerAxis
          : input.left && !input.right
          ? 1
          : input.right && !input.left
          ? -1
          : 0;
      const targetSteer = computeTargetSteerAngle({
        steerInput,
        maxSteer: baseSpec.maxSteer,
        speed: cs.speed,
        effectiveMaxSpeed,
      });

      cs.steeringAngle = stepSteeringAngle({
        currentAngle: cs.steeringAngle,
        targetAngle: targetSteer,
        effectiveSteerSpeed,
        delta,
      });

      // Heading rotation with drift authority (calibrated for wider full-lock front wheel angle)
      if (Math.abs(cs.speed) > 0.05) {
        const turnDirection = cs.speed > 0 ? 1 : -1;
        const driftMultiplier = (cs.isDrifting ? 1.65 : 1.0) * modeDriftMod * driftControlMultiplier;
        const turnRefSpeed = Math.max(16, baseSpec.maxSpeed * 0.68);
        cs.rotation +=
          (cs.steeringAngle * (cs.speed / turnRefSpeed) * 2.35 * turnDirection * delta) *
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

      // Autonomous Traffic AI, Rival Racers, Falling Poles/Trees & Live Traffic Signals Update
      trafficEngine.update(
        delta,
        cs.x,
        cs.z,
        cs.speed,
        perfProfileRef.current.trafficCullDistance
      );
      rivalsEngine.update(delta, currentTime, {
        x: cs.x,
        z: cs.z,
        speed: cs.speed,
      });
      cityData.updateTrafficSignals?.(currentTime / 1000);
      cityData.updateFallingProps(delta);
      cityData.updateDynamicWorld?.(delta, currentTime / 1000);

      // Step Standalone Coastal Highway Race (Victoria Island -> Epe 4-lane AI Race)
      const coastalRace = coastalRaceSessionRef.current;
      if (coastalRace) {
        const finishCP = RIVAL_RACE_CHECKPOINTS[RIVAL_RACE_CHECKPOINTS.length - 1];
        if (coastalRace.phase === 'COUNTDOWN') {
          coastalRace.countdownRemaining -= delta;
          if (coastalRace.countdownRemaining <= 0) {
            coastalRace.phase = 'ACTIVE';
            coastalRace.startTimeMs = currentTime;
            rivalsEngine.startRace();
            cs.speed = 0;
            lastCoastalEmitRef.current = 0;
          }
        } else if (coastalRace.phase === 'ACTIVE') {
          const targetCP = RIVAL_RACE_CHECKPOINTS[coastalRace.checkpointIdx];
          if (targetCP) {
            const distToCP = Math.hypot(cs.x - targetCP.x, cs.z - targetCP.z);
            if (distToCP < targetCP.radius + 4.5) {
              const completedMesh = cityData.checkpointMeshes[coastalRace.checkpointIdx];
              if (completedMesh) completedMesh.mesh.visible = false;

              if (coastalRace.checkpointIdx < RIVAL_RACE_CHECKPOINTS.length - 1) {
                coastalRace.checkpointIdx += 1;
                const nextMesh = cityData.checkpointMeshes[coastalRace.checkpointIdx];
                if (nextMesh) nextMesh.mesh.scale.setScalar(1.15);
              } else {
                coastalRace.phase = 'FINISHED';
                const elapsedSec = Math.max(
                  0.1,
                  (currentTime - coastalRace.startTimeMs) / 1000
                );
                const standings = rivalsEngine.getRaceStandings({
                  checkpointIdx: RIVAL_RACE_CHECKPOINTS.length,
                  distToNext: 0,
                  isFinished: true,
                });
                const prizeCredits =
                  standings.rank === 1
                    ? 1500
                    : standings.rank === 2
                    ? 900
                    : standings.rank === 3
                    ? 500
                    : 250;
                if (!coastalRace.prizeAwarded) {
                  coastalRace.prizeAwarded = true;
                  onAwardCreditsRef.current?.(
                    prizeCredits,
                    `Coastal Highway Grand Prix P${standings.rank}`
                  );
                }
                onCoastalRaceUpdateRef.current?.({
                  phase: 'FINISHED',
                  countdownSeconds: 0,
                  elapsedSec,
                  rank: standings.rank,
                  totalRacers: rivalsEngine.rivals.length + 1,
                  checkpointIdx: RIVAL_RACE_CHECKPOINTS.length,
                  totalCheckpoints: RIVAL_RACE_CHECKPOINTS.length,
                  distanceRemainingMeters: 0,
                  leaderboard: standings.leaderboard,
                  prizeCredits,
                });
              }
            }
          }
        }

        if (
          coastalRace.phase !== 'FINISHED' &&
          (lastCoastalEmitRef.current === 0 || currentTime - lastCoastalEmitRef.current > 160)
        ) {
          lastCoastalEmitRef.current = currentTime;
          const activeCP =
            RIVAL_RACE_CHECKPOINTS[coastalRace.checkpointIdx] || finishCP;
          const distToNext = Math.hypot(activeCP.x - cs.x, activeCP.z - cs.z);
          const standings = rivalsEngine.getRaceStandings({
            checkpointIdx: coastalRace.checkpointIdx,
            distToNext,
            isFinished: false,
          });
          onCoastalRaceUpdateRef.current?.({
            phase: coastalRace.phase,
            countdownSeconds: Math.max(1, Math.ceil(coastalRace.countdownRemaining)),
            elapsedSec:
              coastalRace.phase === 'ACTIVE'
                ? Math.max(0, (currentTime - coastalRace.startTimeMs) / 1000)
                : 0,
            rank: standings.rank,
            totalRacers: rivalsEngine.rivals.length + 1,
            checkpointIdx: coastalRace.checkpointIdx,
            totalCheckpoints: RIVAL_RACE_CHECKPOINTS.length,
            distanceRemainingMeters: Math.max(
              0,
              Math.round(Math.hypot(finishCP.x - cs.x, finishCP.z - cs.z) * 1.5)
            ),
            leaderboard: standings.leaderboard,
            prizeCredits: 0,
          });
        }
      }

      // Build collider boxes for visible nearby remote online players so no cars ever clip through each other
      remoteBoxesScratch.length = 0;
      const remotePool = remoteCarMeshesRef.current;
      for (const [pid, rEntry] of remotePool.entries()) {
        if (
          Math.abs(rEntry.x - cs.x) < 280 &&
          Math.abs(rEntry.z - cs.z) < 280
        ) {
          remoteBoxesScratch.push({
            id: pid,
            x: rEntry.x,
            y: rEntry.y,
            z: rEntry.z,
            width: rEntry.width,
            length: rEntry.length,
            rotation: rEntry.heading,
            speed: rEntry.speed,
            minX: rEntry.x - rEntry.width * 0.5,
            maxX: rEntry.x + rEntry.width * 0.5,
            minZ: rEntry.z - rEntry.length * 0.5,
            maxZ: rEntry.z + rEntry.length * 0.5,
          });
        }
      }

      const trafficBoxes = trafficEngine.getTrafficBoundingBoxes();
      const rivalBoxes =
        rivalsEngine.isRaceActive || coastalRaceSessionRef.current
          ? rivalsEngine.getRivalsBoundingBoxes()
          : [];

      // Substepped + Multi-Iteration Physics Loop (prevents tunneling through thin walls, dividers & cars at any speed)
      const substeps = Math.max(1, Math.min(8, Math.ceil(stepDistance / 0.65)));
      const subVx = vx / substeps;
      const subVz = vz / substeps;

      let strongestBarrierHit: ReturnType<typeof enforceBridgeAndWaterBarriers> = null;
      let strongestStaticHit: ReturnType<CollisionEngine['resolveWorldCollisions']>['primaryHit'] = null;
      const strongestVehicleHits = new Map<
        string,
        ReturnType<CollisionEngine['resolveWorldCollisions']>['vehicleHits'][number]
      >();
      const triggeredPropIds = new Set<string>();
      const collectedPropHits: ReturnType<CollisionEngine['resolveWorldCollisions']>['propHits'] = [];
      let frameMaxImpactVelocity = 0;

      for (let stepIdx = 0; stepIdx < substeps; stepIdx++) {
        const nextX = cs.x + subVx;
        const nextZ = cs.z + subVz;

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

        // 2 constraint-solver iterations per substep so sliding into walls + traffic stays 100% solid
        for (let iter = 0; iter < 2; iter++) {
          const bHit = enforceBridgeAndWaterBarriers(cs, cs.y, baseSpec.bodyWidth * 0.5);
          if (bHit) {
            if (!strongestBarrierHit || bHit.impactVelocity > strongestBarrierHit.impactVelocity) {
              strongestBarrierHit = bHit;
            }
            if (bHit.impactVelocity > frameMaxImpactVelocity) {
              frameMaxImpactVelocity = bHit.impactVelocity;
            }
          }

          const subCol = collisionEngine.resolveWorldCollisions(
            cs,
            baseSpec.bodyWidth * 0.5,
            baseSpec.bodyLength * 0.5,
            cityData.collidableBuildings,
            trafficBoxes,
            rivalBoxes,
            cityData.barricades,
            cityData.dynamicProps,
            remoteBoxesScratch
          );

          if (subCol.maxImpactVelocity > frameMaxImpactVelocity) {
            frameMaxImpactVelocity = subCol.maxImpactVelocity;
          }

          if (
            subCol.primaryHit &&
            (subCol.primaryHit.type === 'BUILDING' || subCol.primaryHit.type === 'BARRICADE') &&
            (!strongestStaticHit ||
              subCol.primaryHit.impactVelocity > strongestStaticHit.impactVelocity)
          ) {
            strongestStaticHit = subCol.primaryHit;
          }

          for (let vh = 0; vh < subCol.vehicleHits.length; vh++) {
            const ev = subCol.vehicleHits[vh];
            const prev = strongestVehicleHits.get(ev.otherId);
            if (!prev || ev.impactVelocity > prev.impactVelocity) {
              strongestVehicleHits.set(ev.otherId, ev);
            }
          }

          for (let ph = 0; ph < subCol.propHits.length; ph++) {
            const pEv = subCol.propHits[ph];
            if (!triggeredPropIds.has(pEv.otherId)) {
              triggeredPropIds.add(pEv.otherId);
              collectedPropHits.push(pEv);
            }
          }

          cs.y = resolveSurfaceY(cs.x, cs.z, cs.y);
        }
      }

      // Compute exact level-aware road/bridge/ramp elevation Y and heading-aligned pitch
      const carY = resolveSurfaceY(cs.x, cs.z, cs.y);
      cs.y = carY;
      const bridgePitch = getBridgePitchAt(cs.x, cs.z, cs.rotation, carY);

      // Sync 3D model with physics state BEFORE applying vertex deformation so world transforms match
      if (playerCarGroupRef.current) {
        playerCarGroupRef.current.position.set(cs.x, carY, cs.z);
        playerCarGroupRef.current.rotation.y = cs.rotation;
        playerCarGroupRef.current.rotation.x = bridgePitch;
      }

      // Real-Time Car Denting, Car-Part Splash Debris & Physics Consequences
      const playerGroup = playerCarGroupRef.current;
      const playerPaintHex = currentCustom.paintColor || '#ef233c';

      if (strongestBarrierHit && playerGroup) {
        const bSev = computeImpactSeverity(strongestBarrierHit.impactVelocity);
        if (bSev > 0) {
          tmpDentHit.set(strongestBarrierHit.hitX, carY + 0.58, strongestBarrierHit.hitZ);
          tmpDentDir.set(strongestBarrierHit.normalX, -0.06, strongestBarrierHit.normalZ);
          applyVehicleDent(playerGroup, tmpDentHit, tmpDentDir, bSev);
        }
        spawnCrashSplash(
          strongestBarrierHit.hitX,
          carY,
          strongestBarrierHit.hitZ,
          strongestBarrierHit.normalX,
          strongestBarrierHit.normalZ,
          strongestBarrierHit.impactVelocity,
          playerPaintHex,
          0x64748b
        );
      }

      if (strongestStaticHit && playerGroup) {
        const sHit = strongestStaticHit;
        const sSev = computeImpactSeverity(sHit.impactVelocity);
        if (sSev > 0) {
          tmpDentHit.set(sHit.hitX, carY + 0.58, sHit.hitZ);
          tmpDentDir.set(sHit.normalX, -0.06, sHit.normalZ);
          applyVehicleDent(playerGroup, tmpDentHit, tmpDentDir, sSev);
        }
        spawnCrashSplash(
          sHit.hitX,
          carY,
          sHit.hitZ,
          sHit.normalX,
          sHit.normalZ,
          sHit.impactVelocity,
          playerPaintHex,
          0x475569
        );
      }

      for (const vHit of strongestVehicleHits.values()) {
        const vSev = computeImpactSeverity(vHit.impactVelocity);
        if (vSev > 0 && playerGroup) {
          tmpDentHit.set(vHit.hitX, carY + 0.58, vHit.hitZ);
          tmpDentDir.set(vHit.normalX, -0.05, vHit.normalZ);
          applyVehicleDent(playerGroup, tmpDentHit, tmpDentDir, vSev);
        }

        let otherColor: string | number | undefined = 0x334155;
        if (vHit.otherKind === 'TRAFFIC') {
          const tCar = trafficEngine.vehicles.find((v) => v.id === vHit.otherId);
          otherColor = tCar?.color;
          trafficEngine.applyImpactAndDent(
            vHit.otherId,
            vHit.otherPushX ?? 0,
            vHit.otherPushZ ?? 0,
            vHit.hitX,
            vHit.hitZ,
            vSev
          );
        } else if (vHit.otherKind === 'RIVAL') {
          const rCar = rivalsEngine.rivals.find((r) => r.id === vHit.otherId);
          otherColor = rCar?.paintColor;
          rivalsEngine.applyImpactAndDent(
            vHit.otherId,
            vHit.otherPushX ?? 0,
            vHit.otherPushZ ?? 0,
            vHit.hitX,
            vHit.hitZ,
            vSev
          );
        } else if (vHit.otherKind === 'PLAYER') {
          const pEntry = remotePool.get(vHit.otherId);
          if (pEntry) {
            otherColor = pEntry.paintColor;
            pEntry.x += vHit.otherPushX ?? 0;
            pEntry.z += vHit.otherPushZ ?? 0;
            pEntry.group.position.set(pEntry.x, pEntry.y, pEntry.z);
            if (vSev > 0.05) {
              tmpDentHit.set(vHit.hitX, pEntry.y + 0.58, vHit.hitZ);
              tmpDentDir.set(-vHit.normalX, -0.05, -vHit.normalZ);
              applyVehicleDent(pEntry.group, tmpDentHit, tmpDentDir, vSev);
            }
          }
        }

        spawnCrashSplash(
          vHit.hitX,
          carY,
          vHit.hitZ,
          vHit.normalX,
          vHit.normalZ,
          Math.max(4.5, vHit.impactVelocity),
          playerPaintHex,
          otherColor
        );
      }

      for (let i = 0; i < collectedPropHits.length; i++) {
        const pHit = collectedPropHits[i];
        if (pHit.prop) {
          cityData.triggerPropFall(pHit.prop, -pHit.normalX, -pHit.normalZ, pHit.impactVelocity);
        }
        const pSev = computeImpactSeverity(pHit.impactVelocity);
        if (pSev > 0 && playerGroup) {
          tmpDentHit.set(pHit.hitX, carY + 0.58, pHit.hitZ);
          tmpDentDir.set(pHit.normalX, -0.04, pHit.normalZ);
          applyVehicleDent(playerGroup, tmpDentHit, tmpDentDir, pSev * 0.85);
        }
        spawnCrashSplash(
          pHit.hitX,
          carY,
          pHit.hitZ,
          pHit.normalX,
          pHit.normalZ,
          pHit.impactVelocity,
          playerPaintHex,
          pHit.prop?.kind === 'STREETLIGHT' ? 0x94a3b8 : 0x7c5338
        );
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
              onRaceCheckpointPassedRef.current?.(cpIdx, standings.rank, {
                x: cs.x,
                z: cs.z,
                gear: currentGear,
              });

              const completedMesh = cityData.checkpointMeshes[cpIdx];
              if (completedMesh) completedMesh.mesh.visible = false;

              if (cpIdx < RIVAL_RACE_CHECKPOINTS.length - 1) {
                playerRaceCheckpointIdx.current = cpIdx + 1;
                const nextMesh = cityData.checkpointMeshes[cpIdx + 1];
                if (nextMesh) nextMesh.mesh.scale.setScalar(1.15);
              } else {
                playerRaceCheckpointIdx.current = RIVAL_RACE_CHECKPOINTS.length;
              }
            }
          }
        }

        const maxImpactVel = frameMaxImpactVelocity;
        const hasHeavyImpact = maxImpactVel > 6;
        onMissionUpdateRef.current?.(
          delta,
          { x: cs.x, z: cs.z, speed: cs.speed, gear: currentGear },
          hasHeavyImpact
        );
      }

      // Update 3D Mission Target Waypoint Beacon visibility & pulse
      const mTarget = activeMissionTargetRef.current;
      if (mTarget) {
        const beaconY = resolveSurfaceY(mTarget.x, mTarget.z, 0);
        missionBeaconGroup.visible = true;
        missionBeaconGroup.position.set(mTarget.x, beaconY, mTarget.z);
        const pulseScale = (mTarget.radius / 5) * (1 + 0.08 * Math.sin(currentTime * 0.005));
        beaconRing.scale.set(pulseScale, pulseScale, 1);
        const targetColor = mTarget.isFinalDestination ? 0x10b981 : 0x38bdf8;
        beaconRingMat.color.setHex(targetColor);
        beaconPillarMat.color.setHex(targetColor);
      } else {
        missionBeaconGroup.visible = false;
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

      // Throttled Traffic & Rival Map Radar Updates ONLY when City Map modal is open
      if (isCityMapOpenRef.current && currentTime - lastTelemetrySendTime.current > 240) {
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
          isCockpitCamera: false,
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

      // Engine, Braking, Road Surface & Tyre Audio Synthesis Update
      const steerIntensity = Math.min(1, Math.abs(cs.steeringAngle) / Math.max(0.1, baseSpec.maxSteer));
      const audioSpeedCap = Math.max(12, baseSpec.maxSpeed * ecuSpeedBonus);
      engineAudio.update(
        cs.speed,
        audioSpeedCap,
        isEngineOn && input.forward && currentGear !== 'P',
        isBrakingNow,
        cs.isDrifting,
        currentDriveMode,
        currentVehicleType,
        {
          steerRatio: steerIntensity,
          onBridge: carY > 0.35,
          brakeIntensity: isBrakingNow ? (input.handbrake ? 0.95 : 0.78) : 0,
          transmissionGear: currentGear,
        }
      );

      // HUD Telemetry (Throttled to ~10Hz to prevent 60fps React reconciliation storm; instant gear shifts)
      const speedKmh = Math.round(Math.abs(cs.speed) * 4.6);
      const speedRatio = Math.min(1, Math.abs(cs.speed) / Math.max(12, effectiveMaxSpeed || baseSpec.maxSpeed));
      const rpm = !isEngineOn
        ? 0
        : Math.round(baseSpec.idleRpm + speedRatio * (baseSpec.redlineRpm - baseSpec.idleRpm));
      const gear = !isEngineOn ? 'OFF' : currentGear;

      if (gear !== lastEmittedGear.current || currentTime - lastHudEmitTime.current > 95) {
        lastHudEmitTime.current = currentTime;
        lastEmittedGear.current = gear;
        onSpeedChangeRef.current?.(speedKmh, rpm, gear);
      }

      // Direct non-state motion callback for multiplayer publishing + throttled UI position updates
      onMotionSampleRef.current?.({
        x: cs.x,
        y: cs.y,
        z: cs.z,
        heading: cs.rotation,
        speed: cs.speed,
      });
      if (currentTime - lastPosUiEmitTime.current > 105) {
        lastPosUiEmitTime.current = currentTime;
        onCarPositionUpdateRef.current?.({
          x: cs.x,
          y: cs.y,
          z: cs.z,
          heading: cs.rotation,
          speed: cs.speed,
        });
      }

      // Zone Detection & Proximity Hotspots
      let detectedZone: string | null = null;

      // 1. Marketplace Grand Gate Check (at [0, 0, 100 * S])
      const distToPortal = Math.hypot(cs.x - 0, cs.z - 100 * WORLD_XZ_SCALE);
      if (distToPortal < 13) {
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

      // 3. Customization Garage Check (at [35 * S, 0, 10 * S])
      const distToCustomizer = Math.hypot(cs.x - 35 * WORLD_XZ_SCALE, cs.z - 10 * WORLD_XZ_SCALE);
      if (distToCustomizer < 9.5) {
        detectedZone = 'customizer';
      }

      // 4. VIP Concierge Lounge Check (forecourt of [57 * S, 0, 22 * S])
      const distToLounge = Math.hypot(
        cs.x - 57 * WORLD_XZ_SCALE,
        cs.z - (22 * WORLD_XZ_SCALE - 6.5)
      );
      if (distToLounge < 11.5) {
        detectedZone = 'dealer-lounge';
      }

      // 5. Speed Trap Trigger (at [-55 * S, 0, 0])
      const distToSpeedTrap = Math.hypot(cs.x - -55 * WORLD_XZ_SCALE, cs.z - 0);
      if (distToSpeedTrap < 9.5 && speedKmh > 20) {
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

      // 6. Victoria Island Coastal Highway Race Grid (strictly on Coastal Highway)
      if (!coastalRaceSessionRef.current && !activeMissionSessionRef.current) {
        const coastalStart = RIVAL_RACE_CHECKPOINTS[0];
        const distToCoastalRace = Math.hypot(cs.x - coastalStart.x, cs.z - coastalStart.z);
        if (distToCoastalRace < 18) {
          detectedZone = 'coastal-race';
        }
      }

      if (detectedZone !== activeZoneRef.current) {
        activeZoneRef.current = detectedZone;
        onZoneChangeRef.current?.(detectedZone);
      }

      // CAMERA MODES ORCHESTRATION: ONLY CHASE (Default) & DRONE (Interactive Aerial)
      const currentCameraMode = cameraModeRef.current;
      const isCustomizerOpen = isCustomizerOpenRef.current;

      if (isCustomizerOpen) {
        // Internal showroom angle strictly when tuning drawer is open
        const orbitAngle = currentTime * 0.00055;
        const orbitDistance = 7.6;
        camera.position.set(
          cs.x + Math.sin(orbitAngle) * orbitDistance,
          carY + 2.4,
          cs.z + Math.cos(orbitAngle) * orbitDistance
        );
        camera.lookAt(cs.x, carY + 0.75, cs.z);
      } else if (currentCameraMode === 'DRONE') {
        const dc = droneCamRef.current;
        const droneAngle = cs.rotation + Math.PI + dc.yawOffset;
        const horizDist = Math.cos(dc.pitch) * dc.distance;
        const vertHeight = Math.sin(dc.pitch) * dc.distance + 1.4;

        const desiredPos = {
          x: cs.x + Math.sin(droneAngle) * horizDist,
          y: carY + vertHeight,
          z: cs.z + Math.cos(droneAngle) * horizDist,
        };
        const safePos = resolveSafeCameraPosition(
          { x: cs.x, y: carY + 1.4, z: cs.z },
          desiredPos,
          cityData.collidableBuildings,
          resolveSurfaceY,
          carY,
          1.6
        );

        const droneSmooth = 1 - Math.exp(-5.8 * delta);
        camera.position.x += (safePos.x - camera.position.x) * droneSmooth;
        camera.position.y += (safePos.y - camera.position.y) * droneSmooth;
        camera.position.z += (safePos.z - camera.position.z) * droneSmooth;

        const droneGroundFloor = Math.max(
          resolveSurfaceY(camera.position.x, camera.position.z, carY) + 1.5,
          carY + 0.9
        );
        if (camera.position.y < droneGroundFloor) {
          camera.position.y = droneGroundFloor;
        }

        if (Math.abs(camera.fov - 56) > 0.05) {
          camera.fov += (56 - camera.fov) * droneSmooth;
          camera.updateProjectionMatrix();
        }
        camera.lookAt(cs.x, carY + 0.75, cs.z);
      } else {
        // DEFAULT: SMOOTH ANTI-CLIP CHASE CAMERA
        const cc = chaseCamRef.current;
        if (!cc.initialized) {
          cc.yaw = cs.rotation;
          cc.initialized = true;
        }

        // Smooth angular turn tracking (frame-rate independent exponential damping)
        let yawDiff = cs.rotation - cc.yaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        const yawFollowRate = cs.speed < -0.5 ? 2.4 : 6.4;
        cc.yaw += yawDiff * (1 - Math.exp(-yawFollowRate * delta));

        // Smooth acceleration & braking distance / FOV response (no shake)
        const absSpeedRatio = Math.min(1, Math.abs(cs.speed) / Math.max(1, effectiveMaxSpeed));
        const speedLagOffset = input.forward && isEngineOn ? 0.95 * absSpeedRatio : isBrakingNow ? -0.45 : 0.4 * absSpeedRatio;
        const targetDist = baseSpec.chaseDistance + speedLagOffset;
        const targetHeight = carY + baseSpec.chaseHeight + absSpeedRatio * 0.35;

        const desiredCam = {
          x: cs.x - Math.sin(cc.yaw) * targetDist,
          y: targetHeight,
          z: cs.z - Math.cos(cc.yaw) * targetDist,
        };
        const pivotPoint = {
          x: cs.x,
          y: carY + 1.25,
          z: cs.z,
        };
        const safeCam = resolveSafeCameraPosition(
          pivotPoint,
          desiredCam,
          cityData.collidableBuildings,
          resolveSurfaceY,
          carY,
          1.2
        );

        const posAlpha = 1 - Math.exp(-9.5 * delta);
        const yAlpha = 1 - Math.exp(-6.5 * delta);
        camera.position.x += (safeCam.x - camera.position.x) * posAlpha;
        camera.position.y += (safeCam.y - camera.position.y) * yAlpha;
        camera.position.z += (safeCam.z - camera.position.z) * posAlpha;

        // Clamp final smoothed camera height above road/bridge deck so lerp never dips below surface
        const camGroundFloor = Math.max(
          resolveSurfaceY(camera.position.x, camera.position.z, carY) + 1.15,
          carY + 0.85
        );
        if (camera.position.y < camGroundFloor) {
          camera.position.y = camGroundFloor;
        }

        const targetFov = 56 + absSpeedRatio * 5.5 - (isBrakingNow ? 1.5 : 0);
        if (Math.abs(camera.fov - targetFov) > 0.04) {
          camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-5.0 * delta));
          camera.updateProjectionMatrix();
        }

        tmpLookTarget.set(
          cs.x + Math.sin(cc.yaw) * baseSpec.chaseLookAhead,
          carY + 0.95,
          cs.z + Math.cos(cc.yaw) * baseSpec.chaseLookAhead
        );
        camera.lookAt(tmpLookTarget);
      }

      // Damped camera impact jolt on collisions
      const jolt = impactJoltRef.current;
      if (jolt.intensity > 0.004) {
        const shakeWave = Math.sin(currentTime * 0.065);
        camera.position.x += jolt.dirX * jolt.intensity * shakeWave;
        camera.position.y += Math.abs(shakeWave) * jolt.intensity * 0.42;
        camera.position.z += jolt.dirZ * jolt.intensity * shakeWave;
        jolt.intensity *= Math.exp(-15 * delta);
      } else {
        jolt.intensity = 0;
      }

      // Remote Active Player Vehicles (Smooth interpolation + collision sizes + anti-stacking spawn relocation)
      const incomingPeers = remotePlayersRef.current;
      const activeIds = new Set(incomingPeers.map((p) => p.playerId));

      // One-shot check upon initial multiplayer presence hydration: if still parked at initial spawn
      // and overlapping another online driver, slide immediately to a free Showroom Boulevard bay.
      if (!relocatedSpawnRef.current && incomingPeers.length > 0) {
        if (cs.distanceDriven < 1.2 && Math.abs(cs.speed) < 0.35) {
          const peerOcc = incomingPeers.map((p) => {
            const pSpec = VEHICLE_SPEC_PROFILES[p.vehicleModel] || VEHICLE_SPEC_PROFILES.SPORTS_COUPE;
            return {
              x: p.x,
              y: p.y,
              z: p.z,
              width: pSpec.bodyWidth,
              length: pSpec.bodyLength,
              rotation: p.heading,
            };
          });
          const clearHere = isSpawnPoseClear(cs.x, cs.z, cs.rotation, {
            y: cs.y,
            carHalfWidth: baseSpec.bodyWidth * 0.5,
            carHalfLength: baseSpec.bodyLength * 0.5,
            occupiedVehicles: peerOcc,
            lateralMargin: 0.45,
            longitudinalMargin: 0.75,
          });
          if (!clearHere) {
            const freePose = findFreeSharedSpawnPose({
              baseX: 0,
              baseZ: 10 * WORLD_XZ_SCALE,
              rotation: Math.PI,
              carHalfWidth: baseSpec.bodyWidth * 0.5,
              carHalfLength: baseSpec.bodyLength * 0.5,
              occupiedVehicles: [...peerOcc, ...trafficBoxes],
              buildings: cityData.collidableBuildings,
              barricades: cityData.barricades,
            });
            cs.x = freePose.x;
            cs.y = freePose.y;
            cs.z = freePose.z;
            cs.rotation = freePose.rotation;
            if (playerCarGroupRef.current) {
              playerCarGroupRef.current.position.set(cs.x, cs.y, cs.z);
              playerCarGroupRef.current.rotation.y = cs.rotation;
            }
            onMotionSampleRef.current?.({
              x: cs.x,
              y: cs.y,
              z: cs.z,
              heading: cs.rotation,
              speed: 0,
            });
          }
        }
        relocatedSpawnRef.current = true;
      }

      for (const [pid, entry] of remotePool.entries()) {
        if (!activeIds.has(pid)) {
          scene.remove(entry.group);
          disposeObject3D(entry.group);
          remotePool.delete(pid);
        }
      }

      for (const peer of incomingPeers) {
        const mKey = `${peer.vehicleModel}|${peer.paintColor}`;
        const pSpec = VEHICLE_SPEC_PROFILES[peer.vehicleModel] || VEHICLE_SPEC_PROFILES.SPORTS_COUPE;
        let entry = remotePool.get(peer.playerId);
        if (!entry || entry.modelKey !== mKey) {
          if (entry) {
            scene.remove(entry.group);
            disposeObject3D(entry.group);
          }
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
            paintColor: peer.paintColor || '#ef233c',
            width: pSpec.bodyWidth,
            length: pSpec.bodyLength,
            x: peer.x,
            y: peer.y,
            z: peer.z,
            heading: peer.heading,
            speed: peer.speed,
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
          entry.speed = peer.speed;
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

      // Advance Pooled 3D Crash Debris & Friction Sparks (zero per-frame heap allocation)
      let debrisDirty = false;
      for (let i = 0; i < MAX_DEBRIS; i++) {
        const p = debrisPool[i];
        if (!p.active) continue;
        debrisDirty = true;
        p.age += delta;
        if (p.age >= p.maxLife) {
          p.active = false;
          debrisDummy.scale.set(0, 0, 0);
          debrisDummy.updateMatrix();
          debrisInst.setMatrixAt(i, debrisDummy.matrix);
          continue;
        }
        p.vy -= 24.0 * delta;
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.z += p.vz * delta;
        p.rx += p.vrx * delta;
        p.ry += p.vry * delta;
        p.rz += p.vrz * delta;

        const floorY = resolveSurfaceY(p.x, p.z, p.y) + 0.07;
        if (p.y < floorY) {
          p.y = floorY;
          p.vy = Math.abs(p.vy) * 0.42;
          p.vx *= 0.72;
          p.vz *= 0.72;
          p.vrx *= 0.65;
          p.vry *= 0.65;
          p.vrz *= 0.65;
        }

        const lifeFrac = p.age / p.maxLife;
        const shrink = lifeFrac > 0.7 ? Math.max(0, 1 - (lifeFrac - 0.7) / 0.3) : 1;
        debrisDummy.position.set(p.x, p.y, p.z);
        debrisDummy.rotation.set(p.rx, p.ry, p.rz);
        debrisDummy.scale.set(p.scaleX * shrink, p.scaleY * shrink, p.scaleZ * shrink);
        debrisDummy.updateMatrix();
        debrisInst.setMatrixAt(i, debrisDummy.matrix);
        tmpDebrisColor.setHex(p.colorHex);
        debrisInst.setColorAt(i, tmpDebrisColor);
      }
      if (debrisDirty) {
        debrisInst.instanceMatrix.needsUpdate = true;
        if (debrisInst.instanceColor) debrisInst.instanceColor.needsUpdate = true;
      }

      let sparksDirty = false;
      for (let i = 0; i < MAX_SPARKS; i++) {
        const sp = sparkPool[i];
        if (!sp.active) continue;
        sparksDirty = true;
        sp.age += delta;
        if (sp.age >= sp.maxLife) {
          sp.active = false;
          debrisDummy.scale.set(0, 0, 0);
          debrisDummy.updateMatrix();
          sparkInst.setMatrixAt(i, debrisDummy.matrix);
          continue;
        }
        sp.vy -= 18.0 * delta;
        sp.x += sp.vx * delta;
        sp.y += sp.vy * delta;
        sp.z += sp.vz * delta;
        const shrink = Math.max(0, 1 - sp.age / sp.maxLife);
        debrisDummy.position.set(sp.x, sp.y, sp.z);
        debrisDummy.rotation.set(0, Math.atan2(sp.vx, sp.vz), 0);
        debrisDummy.scale.set(shrink, shrink, shrink);
        debrisDummy.updateMatrix();
        sparkInst.setMatrixAt(i, debrisDummy.matrix);
        tmpDebrisColor.setHex(sp.colorHex);
        sparkInst.setColorAt(i, tmpDebrisColor);
      }
      if (sparksDirty) {
        sparkInst.instanceMatrix.needsUpdate = true;
        if (sparkInst.instanceColor) sparkInst.instanceColor.needsUpdate = true;
      }

      renderer.render(scene, camera);
      if (!readyReported) {
        readyReported = true;
        onInitStageChangeRef.current?.({ step: 'World ready', progress: 100 });
      }

      // Emit throttled screen-projected coordinates for clickable driver tags (with distance & building-occlusion culling)
      if (onProjectedRemotePlayersRef.current && currentTime - lastRemoteProjTime.current > 45) {
        lastRemoteProjTime.current = currentTime;
        const w = container.clientWidth;
        const h = container.clientHeight;
        const projected: ProjectedRemotePlayer[] = [];
        const entries = Array.from(remotePool.entries()).sort((a, b) => a[1].distance - b[1].distance);
        let visibleCount = 0;

        for (const [pid, entry] of entries) {
          const camDist = Math.hypot(
            entry.x - camera.position.x,
            entry.y + 1.8 - camera.position.y,
            entry.z - camera.position.z
          );
          if (camDist > 260 || visibleCount >= 12) {
            continue;
          }

          tmpProjVec.set(entry.x, entry.y + 2.75, entry.z);
          tmpProjVec.project(camera);

          const inViewFrustum =
            tmpProjVec.z > -1 &&
            tmpProjVec.z < 1 &&
            tmpProjVec.x >= -0.95 &&
            tmpProjVec.x <= 0.95 &&
            tmpProjVec.y >= -0.95 &&
            tmpProjVec.y <= 0.95;

          const occluded =
            inViewFrustum &&
            isTargetOccludedByBuildings(
              { x: camera.position.x, y: camera.position.y, z: camera.position.z },
              { x: entry.x, y: entry.y + 2.45, z: entry.z },
              cityData.collidableBuildings
            );

          const visible = inViewFrustum && !occluded;
          if (visible) visibleCount += 1;

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

      // 60fps Overhead Animated Race Position Numbers (above every racer's roof during race)
      const isMissionRaceActive =
        activeMissionSessionRef.current?.missionId === 'MISSION_B_RACE' &&
        (activeMissionSessionRef.current.state === 'COUNTDOWN' ||
          activeMissionSessionRef.current.state === 'ACTIVE');
      const activeCoastalRace = coastalRaceSessionRef.current;
      const isCoastalRaceLive =
        Boolean(activeCoastalRace) && activeCoastalRace?.phase !== 'FINISHED';
      const showOverheadRanks = isCoastalRaceLive || isMissionRaceActive;

      if (showOverheadRanks) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const raceCpIdx = isCoastalRaceLive
          ? activeCoastalRace!.checkpointIdx
          : playerRaceCheckpointIdx.current;
        const raceTargetCP =
          RIVAL_RACE_CHECKPOINTS[Math.min(raceCpIdx, RIVAL_RACE_CHECKPOINTS.length - 1)];
        const playerDistToCp = raceTargetCP
          ? Math.hypot(raceTargetCP.x - cs.x, raceTargetCP.z - cs.z)
          : 0;
        const liveStandings = rivalsEngine.getRaceStandings({
          checkpointIdx: raceCpIdx,
          distToNext: playerDistToCp,
          isFinished: false,
        });

        const getRankStyleClasses = (pos: number, isPlayerSlot: boolean) => {
          if (pos === 1) {
            return isPlayerSlot
              ? 'px-2.5 py-0.5 rounded-xl border-2 shadow-[0_0_18px_rgba(251,191,36,0.9)] flex items-center gap-1 font-mono font-black bg-amber-400 text-slate-950 border-white'
              : 'px-2 py-0.5 rounded-xl border-2 shadow-[0_0_14px_rgba(251,191,36,0.7)] flex items-center gap-1 font-mono font-black bg-amber-400 text-slate-950 border-amber-100';
          }
          if (pos === 2) {
            return 'px-2 py-0.5 rounded-xl border-2 shadow-xl flex items-center gap-1 font-mono font-black bg-slate-100 text-slate-950 border-sky-300';
          }
          if (pos === 3) {
            return 'px-2 py-0.5 rounded-xl border-2 shadow-xl flex items-center gap-1 font-mono font-black bg-orange-500 text-white border-amber-200';
          }
          return isPlayerSlot
            ? 'px-2.5 py-0.5 rounded-xl border-2 shadow-xl flex items-center gap-1 font-mono font-black bg-[#EF233C] text-white border-white/80'
            : 'px-2 py-0.5 rounded-xl border-2 shadow-xl flex items-center gap-1 font-mono font-black bg-[#071A2B]/92 text-white border-[#EF233C]';
        };

        const racerEntries: Array<{
          key: string;
          x: number;
          y: number;
          z: number;
          pos: number;
          isPlayer: boolean;
          bobPhase: number;
        }> = [
          {
            key: 'player',
            x: cs.x,
            y: carY,
            z: cs.z,
            pos: liveStandings.rank,
            isPlayer: true,
            bobPhase: 0,
          },
          ...rivalsEngine.rivals.map((r, idx) => {
            const lbEntry = liveStandings.leaderboard.find(
              (entry) => !entry.isPlayer && entry.name === r.name
            );
            return {
              key: r.id,
              x: r.x,
              y: r.y,
              z: r.z,
              pos: lbEntry?.position ?? idx + 2,
              isPlayer: false,
              bobPhase: (idx + 1) * 1.35,
            };
          }),
        ];

        for (let i = 0; i < racerEntries.length; i++) {
          const item = racerEntries[i];
          const el = raceBadgeContainerRefs.current[item.key];
          const boxEl = raceBadgeBoxRefs.current[item.key];
          const numEl = raceBadgeNumRefs.current[item.key];
          if (!el || !numEl || !boxEl) continue;

          if (raceBadgePrevRankRef.current[item.key] !== item.pos) {
            raceBadgePrevRankRef.current[item.key] = item.pos;
            raceBadgePopTimeRef.current[item.key] = currentTime;
          }

          const headHeight = item.isPlayer ? 2.45 : 2.55;
          tmpProjVec.set(item.x, item.y + headHeight, item.z);
          tmpProjVec.project(camera);

          const inFront =
            tmpProjVec.z > -1 &&
            tmpProjVec.z < 1 &&
            tmpProjVec.x >= -1.06 &&
            tmpProjVec.x <= 1.06 &&
            tmpProjVec.y >= -1.06 &&
            tmpProjVec.y <= 1.06;

          if (!inFront || w <= 0 || h <= 0) {
            el.style.opacity = '0';
            continue;
          }

          const camDist = Math.hypot(
            item.x - camera.position.x,
            item.y + headHeight - camera.position.y,
            item.z - camera.position.z
          );
          if (camDist > 420) {
            el.style.opacity = '0';
            continue;
          }

          const sx = (tmpProjVec.x * 0.5 + 0.5) * w;
          const floatOffsetPx = Math.sin(currentTime * 0.0075 + item.bobPhase) * 6;
          const sy = (-tmpProjVec.y * 0.5 + 0.5) * h + floatOffsetPx;

          const popElapsed = currentTime - (raceBadgePopTimeRef.current[item.key] || 0);
          const popScale =
            popElapsed >= 0 && popElapsed < 420
              ? 1 + 0.38 * Math.sin((popElapsed / 420) * Math.PI)
              : 1;
          const distScale = item.isPlayer
            ? 1.05
            : THREE.MathUtils.clamp(22 / Math.max(8, camDist), 0.72, 1.05);
          const pulseScale = 1 + 0.05 * Math.sin(currentTime * 0.009 + item.bobPhase);
          const finalScale = distScale * popScale * pulseScale;

          const rankLabel = `#${item.pos}`;
          if (numEl.textContent !== rankLabel) {
            numEl.textContent = rankLabel;
          }
          const styleKey = `${item.pos}:${item.isPlayer ? 1 : 0}`;
          if (raceBadgeLastStyleKeyRef.current[item.key] !== styleKey) {
            raceBadgeLastStyleKeyRef.current[item.key] = styleKey;
            boxEl.className = getRankStyleClasses(item.pos, item.isPlayer);
          }

          el.style.opacity = '1';
          el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(
            1
          )}px, 0) translate(-50%, -100%) scale(${finalScale.toFixed(3)})`;
        }
      } else {
        for (const key of Object.keys(raceBadgeContainerRefs.current)) {
          const el = raceBadgeContainerRefs.current[key];
          if (el && el.style.opacity !== '0') {
            el.style.opacity = '0';
          }
        }
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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      domEl.removeEventListener('webglcontextlost', handleContextLost);
      domEl.removeEventListener('webglcontextrestored', handleContextRestored);
      domEl.removeEventListener('pointerdown', handleDronePointerDown);
      window.removeEventListener('pointermove', handleDronePointerMove);
      window.removeEventListener('pointerup', handleDronePointerUp);
      window.removeEventListener('pointercancel', handleDronePointerUp);
      domEl.removeEventListener('wheel', handleDroneWheel);
      cancelAnimationFrame(animationFrameId);
      if (playerCarGroupRef.current) {
        scene.remove(playerCarGroupRef.current);
        disposeObject3D(playerCarGroupRef.current);
        playerCarGroupRef.current = null;
      }
      for (const entry of remoteCarMeshesRef.current.values()) {
        scene.remove(entry.group);
        disposeObject3D(entry.group);
      }
      remoteCarMeshesRef.current.clear();
      cityData.dispose?.();
      trafficEngine.dispose?.();
      rivalsEngine.dispose?.();
      skyGeo.dispose();
      skyMat.dispose();
      scene.remove(debrisInst, sparkInst);
      debrisGeo.dispose();
      debrisMat.dispose();
      debrisInst.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      sparkInst.dispose();
      markerTex.dispose();
      markerSpriteMat.dispose();
      beaconRingGeo.dispose();
      beaconRingMat.dispose();
      beaconPillarGeo.dispose();
      beaconPillarMat.dispose();
      envRT.dispose();
      envRenderTargetRef.current = null;
      pmremGenerator.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      engineAudio.stop();
    };
  }, []);

  const raceBadgeSlots: Array<{ key: string; label: string }> = [
    { key: 'player', label: 'YOU' },
    { key: 'rival_tariq', label: 'TARIQ' },
    { key: 'rival_chidi', label: 'CHIDI' },
    { key: 'rival_amara', label: 'AMARA' },
    { key: 'rival_tunde', label: 'TUNDE' },
  ];

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full overflow-hidden touch-none cursor-grab active:cursor-grabbing"
        tabIndex={0}
        title="MANIFOLD WORLD 3D Proving Ground"
      />
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {raceBadgeSlots.map((slot) => (
          <div
            key={slot.key}
            ref={(el) => {
              raceBadgeContainerRefs.current[slot.key] = el;
            }}
            className="absolute top-0 left-0 will-change-transform opacity-0 transition-opacity duration-150"
          >
            <div className="flex flex-col items-center">
              <div
                ref={(el) => {
                  raceBadgeBoxRefs.current[slot.key] = el;
                }}
                className="px-2 py-0.5 rounded-xl border-2 shadow-xl flex items-center gap-1 font-mono font-black bg-[#071A2B]/92 text-white border-amber-400"
              >
                <span
                  ref={(el) => {
                    raceBadgeNumRefs.current[slot.key] = el;
                  }}
                  className="text-base sm:text-lg leading-none tracking-tight"
                >
                  #1
                </span>
                <span className="text-[9px] uppercase tracking-wider opacity-90">
                  {slot.label}
                </span>
              </div>
              <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-white/80" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
