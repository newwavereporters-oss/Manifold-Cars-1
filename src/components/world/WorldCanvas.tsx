import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

type RemotePlayerState = {
  playerId: string;
  x: number;
  z: number;
  heading: number;
};

type MultiplayerMessage = {
  type: 'connected' | 'players' | 'playerMoved' | 'playerLeft';
  playerId?: string;
  x?: number;
  z?: number;
  heading?: number;
  players?: RemotePlayerState[];
};

import {
  createVehicleByType,
  createWorldEnvironment,
  CarCustomization,
  VehicleModelType,
  Vehicle3DResult,
  VEHICLE_SPEC_PROFILES,
} from './worldModels';
import { engineAudio, AudioDriveMode } from '../../utils/engineAudio';
import { HeadlightState, TurnSignalState, CockpitHotspot } from './CockpitDashboardOverlay';
import { buildLagosCityDistrict, LagosCityResult } from './lagosCityBuilder';
import { TrafficEngine } from './trafficEngine';
import { BirdsSystem } from './birdsSystem';
import { AircraftSystem } from './aircraftSystem';
import { RivalsEngine } from './rivalsEngine';
import { CollisionEngine } from './collisionEngine';
import { findShortestRoadPath, RIVAL_RACE_CHECKPOINTS } from './lagosCityData';
import { ActiveMissionSession } from './missionEngine';

export type CameraViewMode = 'CHASE' | 'COCKPIT' | 'ORBIT' | 'DRONE';
export type TimeOfDay = 'DAYLIGHT' | 'SUNSET' | 'MIDNIGHT' | 'GOLDEN_HOUR';

export interface WorldCanvasProps {
  customization: CarCustomization;
  cameraMode: CameraViewMode;
  timeOfDay: TimeOfDay;
  onZoneChange?: (zone: string | null) => void;
  onSpeedChange?: (speedKmh: number, rpm: number, gear: string) => void;
  onSpeedTrapTrigger?: (speedKmh: number) => void;
  onInspectCar?: (carId: string) => void;
  onEnterMarketplace?: () => void;
  onOpenCustomizer?: () => void;
  onOpenDealerLounge?: () => void;
  onCarPositionUpdate?: (pos: { x: number; z: number; heading: number }) => void;
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
  // Interactive cockpit steering handlers
const handleCockpitSteeringPointerDown = (
  event: React.PointerEvent<HTMLElement>
) => {
  cockpitSteeringDraggingRef.current = true;
  steeringPointerStartXRef.current = event.clientX;
  steeringPointerStartAngleRef.current = cockpitSteeringInputRef.current;

  event.currentTarget.setPointerCapture(event.pointerId);
};

const handleCockpitSteeringPointerMove = (
  event: React.PointerEvent<HTMLElement>
) => {
  if (!cockpitSteeringDraggingRef.current) return;

  const dragDistance = event.clientX - steeringPointerStartXRef.current;
  const sensitivity = 0.012;

  cockpitSteeringInputRef.current = THREE.MathUtils.clamp(
    steeringPointerStartAngleRef.current + dragDistance * sensitivity,
    -0.65,
    0.65
  );
};

const handleCockpitSteeringPointerUp = () => {
  cockpitSteeringDraggingRef.current = false;
};

  // References to preserve Three.js state across re-renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerCarGroupRef = useRef<THREE.Group | null>(null);
  const activeVehicleRef = useRef<Vehicle3DResult | null>(null);
  const activeZoneRef = useRef<string | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  
const multiplayerSocketRef = useRef<WebSocket | null>(null);
const lastMultiplayerSendTimeRef = useRef<number>(0);

const remotePlayersRef = useRef(
  new Map<string, {
    group: THREE.Group;
    targetX: number;
    targetZ: number;
    targetHeading: number;
  }>()
);


  // Engines and City Subsystems Refs
  const trafficEngineRef = useRef<TrafficEngine | null>(null);
  const rivalsEngineRef = useRef<RivalsEngine | null>(null);
  const collisionEngineRef = useRef<CollisionEngine | null>(null);
  const cityDataRef = useRef<LagosCityResult | null>(null);
  const playerRaceCheckpointIdx = useRef<number>(1);
  const lastGPSCalcTime = useRef<number>(0);
  const lastTelemetrySendTime = useRef<number>(0);

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

  // Vehicle Physics & Dynamics State
  const carState = useRef({
    x: 0,
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

// Interactive cockpit steering state
const cockpitSteeringInputRef = useRef(0);
const cockpitSteeringDraggingRef = useRef(false);
const steeringPointerStartXRef = useRef(0);
const steeringPointerStartAngleRef = useRef(0);

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
    sceneRef.current.add(newCar.carGroup);
    playerCarGroupRef.current = newCar.carGroup;
    activeVehicleRef.current = newCar;

    wheelsRef.current = {
      frontLeftWheel: newCar.frontLeftWheel,
      frontRightWheel: newCar.frontRightWheel,
      rearLeftWheel: newCar.rearLeftWheel,
      rearRightWheel: newCar.rearRightWheel,
    };

    // Restore position & heading
    newCar.carGroup.position.set(carState.current.x, 0, carState.current.z);
    newCar.carGroup.rotation.y = carState.current.rotation;
  }, [
    customization.vehicleType,
    customization.paintColor,
    customization.finish,
    customization.rimColor,
    customization.caliperColor,
    customization.spoiler,
    customization.underglow,
    customization.windowTint,
  ]);

  // Lighting & Time-of-Day updates
  useEffect(() => {
    if (!sceneRef.current || !dirLightRef.current || !hemiLightRef.current || !ambientLightRef.current)
      return;

    const dirLight = dirLightRef.current;
    const hemiLight = hemiLightRef.current;
    const ambLight = ambientLightRef.current;
    const scene = sceneRef.current;

    switch (timeOfDay) {
      case 'SUNSET':
        scene.background = new THREE.Color(0xfb923c);
        scene.fog = new THREE.FogExp2(0xfdba74, 0.0022);
        dirLight.color.setHex(0xf97316);
        dirLight.intensity = 2.0;
        dirLight.position.set(80, 25, 60);
        hemiLight.color.setHex(0xfdba74);
        hemiLight.groundColor.setHex(0x431407);
        hemiLight.intensity = 1.1;
        ambLight.color.setHex(0xffedd5);
        ambLight.intensity = 0.55;
        break;

      case 'MIDNIGHT':
        scene.background = new THREE.Color(0x020617);
        scene.fog = new THREE.FogExp2(0x0f172a, 0.0035);
        dirLight.color.setHex(0x60a5fa);
        dirLight.intensity = 0.6;
        dirLight.position.set(40, 70, 30);
        hemiLight.color.setHex(0x1e293b);
        hemiLight.groundColor.setHex(0x020617);
        hemiLight.intensity = 0.45;
        ambLight.color.setHex(0x1e1b4b);
        ambLight.intensity = 0.25;
        break;

      case 'GOLDEN_HOUR':
        scene.background = new THREE.Color(0xfef08a);
        scene.fog = new THREE.FogExp2(0xfef9c3, 0.002);
        dirLight.color.setHex(0xfacc15);
        dirLight.intensity = 2.6;
        dirLight.position.set(70, 45, 50);
        hemiLight.color.setHex(0xfef08a);
        hemiLight.groundColor.setHex(0x713f12);
        hemiLight.intensity = 1.25;
        ambLight.color.setHex(0xfef9c3);
        ambLight.intensity = 0.6;
        break;

      case 'DAYLIGHT':
      default:
        scene.background = new THREE.Color(0xbfe3f7);
        scene.fog = new THREE.FogExp2(0xd6eaf8, 0.0018);
        dirLight.color.setHex(0xfffaed);
        dirLight.intensity = 2.4;
        dirLight.position.set(65, 85, 45);
        hemiLight.color.setHex(0xdbeafe);
        hemiLight.groundColor.setHex(0x94a3b8);
        hemiLight.intensity = 1.35;
        ambLight.color.setHex(0xf1f5f9);
        ambLight.intensity = 0.65;
        break;
    }
  }, [timeOfDay]);

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

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current[k] = false;
      keys.current[e.code] = false;

      // Release Horn on 'h'
      if (k === 'h' && lastHornState.current) {
        lastHornState.current = false;
        engineAudio.playHorn(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onEnterMarketplace, onInspectCar, onOpenCustomizer, onOpenDealerLounge]);

  // Reset Vehicle Trigger Prop Effect
  useEffect(() => {
    if (!resetVehicleTrigger) return;
    const cs = carState.current;
    cs.speed = 0;
    cs.steeringAngle = 0;
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
    scene.fog = new THREE.FogExp2(0xd6eaf8, 0.0018);

    const camera = new THREE.PerspectiveCamera(
      56,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );

    // 2. Renderer Setup with Balanced PBR Tone Mapping
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 3. Balanced Lighting Setup (Hemisphere + Sun + Ambient Fill)
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x94a3b8, 1.35);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    const ambLight = new THREE.AmbientLight(0xf1f5f9, 0.65);
    scene.add(ambLight);
    ambientLightRef.current = ambLight;

    const dirLight = new THREE.DirectionalLight(0xfffaed, 2.4);
    dirLight.position.set(65, 85, 45);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1.0;
    dirLight.shadow.camera.far = 300;
    dirLight.shadow.camera.left = -90;
    dirLight.shadow.camera.right = 90;
    dirLight.shadow.camera.top = 90;
    dirLight.shadow.camera.bottom = -90;
    dirLight.shadow.bias = -0.0004;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    // Accent Showroom Spotlight
    const showroomSpot = new THREE.SpotLight(0xffffff, 4, 60, Math.PI / 4, 0.3);
    showroomSpot.position.set(0, 16, -45);
    showroomSpot.target.position.set(0, 0, -45);
    scene.add(showroomSpot);
    scene.add(showroomSpot.target);

    // 4. Build Procedural Environment & Assets
    const { environmentGroup, podiums } = createWorldEnvironment();
    scene.add(environmentGroup);
    
const birdsSystem = new BirdsSystem();
scene.add(birdsSystem.group);

const aircraftSystem = new AircraftSystem();
scene.add(aircraftSystem.group);



// 4.1 Build Lagos City District
const cityData = buildLagosCityDistrict({ includeGround: false });
scene.add(cityData.cityGroup);
cityDataRef.current = cityData;

    // 4.2 Initialize autonomous traffic
    const trafficEngine = new TrafficEngine();
    scene.add(trafficEngine.group);
    trafficEngineRef.current = trafficEngine;


    // 5. Build Drivable Player Car (from active customization type)
    const playerCar = createVehicleByType(customization);
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
    carState.current.z = 10;
    carState.current.rotation = Math.PI;

    // Floating Interactive 3D Holographic Marker Above Marketplace Gate
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
    const markerSpriteMat = new THREE.SpriteMaterial({ map: markerTex, transparent: true });
    const marketplaceMarkerSprite = new THREE.Sprite(markerSpriteMat);
    marketplaceMarkerSprite.position.set(0, 8.2, 32);
    marketplaceMarkerSprite.scale.set(11, 2.8, 1);
    scene.add(marketplaceMarkerSprite);

    
    // 5.1 MANIFOLD Multiplayer Connection
    const multiplayerUrl =
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

    const multiplayerSocket = new WebSocket(multiplayerUrl);
    multiplayerSocketRef.current = multiplayerSocket;
    let myMultiplayerPlayerId: string | null = null;
    
    // Create a simple prototype avatar for each remote player
    const addOrUpdateRemotePlayer = (player: RemotePlayerState) => {
      // Never create an avatar for our own connection
      if (player.playerId === myMultiplayerPlayerId) return;

      let remote = remotePlayersRef.current.get(player.playerId);

      if (!remote) {
        const group = new THREE.Group();

        const bodyMaterial = new THREE.MeshStandardMaterial({
          color: 0x16a34a,
          roughness: 0.8,
        });

        const headMaterial = new THREE.MeshStandardMaterial({
          color: 0xd6a078,
          roughness: 0.9,
        });

        const body = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.28, 0.65, 4, 8),
          bodyMaterial
        );
        body.position.y = 0.75;
        body.castShadow = true;
        group.add(body);

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 12, 10),
          headMaterial
        );
        head.position.y = 1.35;
        head.castShadow = true;
        group.add(head);

        scene.add(group);

        remote = {
          group,
          targetX: player.x,
          targetZ: player.z,
          targetHeading: player.heading,
        };

        remotePlayersRef.current.set(player.playerId, remote);
      }

      remote.targetX = player.x;
      remote.targetZ = player.z;
      remote.targetHeading = player.heading;
    };




    multiplayerSocket.onopen = () => {
      console.log('[MANIFOLD Multiplayer] Connected to server');
    };

    multiplayerSocket.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as MultiplayerMessage;

        if (message.type === 'connected' && message.playerId) {
  myMultiplayerPlayerId = message.playerId;
  console.log('[MANIFOLD Multiplayer] My player ID:', myMultiplayerPlayerId);
}


       
        if (message.type === 'players' && message.players) {
          message.players.forEach((player) => {
            addOrUpdateRemotePlayer(player);
          });
        }


        
        if (
          message.type === 'playerMoved' &&
          message.playerId &&
          typeof message.x === 'number' &&
          typeof message.z === 'number' &&
          typeof message.heading === 'number'
        ) {
          addOrUpdateRemotePlayer({
            playerId: message.playerId,
            x: message.x,
            z: message.z,
            heading: message.heading,
          });
        }


        
        if (message.type === 'playerLeft' && message.playerId) {
          const remote = remotePlayersRef.current.get(message.playerId);

          if (remote) {
            scene.remove(remote.group);

            remote.group.traverse((object) => {
              if (object instanceof THREE.Mesh) {
                object.geometry.dispose();

                const materials = Array.isArray(object.material)
                  ? object.material
                  : [object.material];

                materials.forEach((material) => material.dispose());
              }
            });

            remotePlayersRef.current.delete(message.playerId);
          }
        }



        // We will add remote-player handling in the next step.
      } catch (error) {
        console.warn('[MANIFOLD Multiplayer] Invalid message:', error);
      }
    };

    multiplayerSocket.onerror = () => {
      console.warn('[MANIFOLD Multiplayer] Connection error');
    };


    // 6. Animation & Physics Game Loop
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = Math.min((currentTime - lastTime) / 1000, 0.08);

      // Smoothly move remote-player avatars toward their latest positions
      remotePlayersRef.current.forEach((remote) => {
        const smoothing = Math.min(1, delta * 10);

        remote.group.position.x +=
          (remote.targetX - remote.group.position.x) * smoothing;

        remote.group.position.z +=
          (remote.targetZ - remote.group.position.z) * smoothing;

        const headingDifference = Math.atan2(
          Math.sin(remote.targetHeading - remote.group.rotation.y),
          Math.cos(remote.targetHeading - remote.group.rotation.y)
        );

        remote.group.rotation.y += headingDifference * smoothing;
      });


      birdsSystem.update(delta);
      aircraftSystem.update(delta);
      
      // Update autonomous traffic every animation frame
      if (trafficEngineRef.current) {
        trafficEngineRef.current.update(
          delta,
          carState.current.x,
          carState.current.z,
          carState.current.speed
        );
      }
    
      lastTime = currentTime;

      // Turntables continuous rotation
      podiums.forEach((pod, index) => {
        pod.group.rotation.y += delta * (0.35 + index * 0.05);
      });

      // Holographic marker float pulse
      marketplaceMarkerSprite.position.y = 8.2 + Math.sin(currentTime * 0.003) * 0.35;

      // Input Resolution (Keyboard + Touch)
      const currentVirtual = virtualInputRef.current;
      const input = {
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
      // Combine keyboard, touchscreen and cockpit steering.

// Combine keyboard, touchscreen and cockpit steering.
const keyboardSteer = input.left
  ? 1
  : input.right
  ? -1
  : 0;

const cockpitSteer = cockpitSteeringInputRef.current / 0.65;

// Keyboard/touch steering takes priority when pressed.
// Otherwise, use the cockpit steering wheel.
const combinedSteer =
  keyboardSteer !== 0
    ? keyboardSteer
    : cockpitSteer;

const targetSteer =
  combinedSteer * baseSpec.maxSteer * speedSteerFactor;

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

      
      // Extended MANIFOLD WORLD driving boundaries.
      // Keep the original lateral limit while extending the Epe route.
      const nextX = cs.x + vx;
const nextZ = cs.z + vz;

// Prevent the car from entering building footprints.
const buildings = cityDataRef.current?.collidableBuildings ?? [];
const carClearance = 2.2;

const hitsBuilding = (x: number, z: number) =>
  buildings.some((building) => {
    const halfWidth = building.width / 2 + carClearance;
    const halfDepth = building.depth / 2 + carClearance;

    return (
      x > building.x - halfWidth &&
      x < building.x + halfWidth &&
      z > building.z - halfDepth &&
      z < building.z + halfDepth
    );
  });

const blockedX = hitsBuilding(nextX, cs.z);
const blockedZ = hitsBuilding(cs.x, nextZ);

      const WORLD_X_LIMIT = 185;
      const WORLD_Z_MIN = -1205;
      const WORLD_Z_MAX = 185;

    

if (
  nextX > -WORLD_X_LIMIT &&
  nextX < WORLD_X_LIMIT &&
  !blockedX
) {
  cs.x = nextX;
} else if (blockedX) {
  cs.speed *= 0.65;
} else {
  cs.speed = -cs.speed * 0.25;
}

if (
  nextZ > WORLD_Z_MIN &&
  nextZ < WORLD_Z_MAX &&
  !blockedZ
) {
  cs.z = nextZ;
} else if (blockedZ) {
  cs.speed *= 0.65;
} else {
  cs.speed = -cs.speed * 0.25;
}




      // Epe expressway central median protection.
      // Keep both carriageways drivable while preventing crossings
      // through the physical central divider.
      const onEpeExpressway =
        cs.z < -135 &&
        cs.z > -1205 &&
        Math.abs(cs.x - 180) < 30;

      if (onEpeExpressway) {
        const MEDIAN_CENTER_X = 180;
        const MEDIAN_CLEARANCE = 2.0;

        // Prevent a vehicle from entering or crossing the median.
        if (
          cs.x < MEDIAN_CENTER_X &&
          cs.x > MEDIAN_CENTER_X - 30 &&
          cs.x + vx >= MEDIAN_CENTER_X - MEDIAN_CLEARANCE
        ) {
          cs.x = MEDIAN_CENTER_X - MEDIAN_CLEARANCE;
          cs.speed *= 0.65;
        } else if (
          cs.x > MEDIAN_CENTER_X &&
          cs.x < MEDIAN_CENTER_X + 30 &&
          cs.x + vx <= MEDIAN_CENTER_X + MEDIAN_CLEARANCE
        ) {
          cs.x = MEDIAN_CENTER_X + MEDIAN_CLEARANCE;
          cs.speed *= 0.65;
        }
      }


      // Sync 3D model with physics state
      if (playerCarGroupRef.current) {
        playerCarGroupRef.current.position.set(cs.x, 0, cs.z);
        playerCarGroupRef.current.rotation.y = cs.rotation;
      }

      // Wheels physics: front wheel steering and spin rotation
      const wheels = wheelsRef.current;
      if (wheels.frontLeftWheel && wheels.frontRightWheel) {
        wheels.frontLeftWheel.rotation.y = cs.steeringAngle;
        wheels.frontRightWheel.rotation.y = Math.PI + cs.steeringAngle;
      }
// Animate the steering wheel inside the active cockpit.
const cockpitSteeringWheel =
  activeVehicleRef.current?.interiorGroup.getObjectByName(
    'cockpitSteeringWheel'
  );

if (cockpitSteeringWheel) {
  cockpitSteeringWheel.rotation.z = -cs.steeringAngle * 3.5;
}

      const wheelCircumference = 2 * Math.PI * 0.38;
      const wheelDelta = (cs.speed * delta) / wheelCircumference;
      cs.wheelSpinAngle += wheelDelta * Math.PI * 2;

      if (wheels.frontLeftWheel && wheels.frontRightWheel && wheels.rearLeftWheel && wheels.rearRightWheel) {
        wheels.frontLeftWheel.rotation.x = cs.wheelSpinAngle;
        wheels.frontRightWheel.rotation.x = -cs.wheelSpinAngle;
        wheels.rearLeftWheel.rotation.x = cs.wheelSpinAngle;
        wheels.rearRightWheel.rotation.x = -cs.wheelSpinAngle;
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
      onCarPositionUpdateRef.current?.({ x: cs.x, z: cs.z, heading: cs.rotation });

      
      // Send our car position to other connected players (10 times per second)
      if (
        multiplayerSocketRef.current?.readyState === WebSocket.OPEN &&
        currentTime - lastMultiplayerSendTimeRef.current >= 100
      ) {
        multiplayerSocketRef.current.send(
          JSON.stringify({
            type: 'playerState',
            x: cs.x,
            z: cs.z,
            heading: cs.rotation,
          })
        );

        lastMultiplayerSendTimeRef.current = currentTime;
      }


      // Zone Detection & Proximity Hotspots
      let detectedZone: string | null = null;

      // 1. Marketplace Grand Gate Check (at [0, 0, 32])
      const distToPortal = Math.hypot(cs.x - 0, cs.z - 32);
      if (distToPortal < 8) {
        detectedZone = 'marketplace';
      }

      // 2. Showroom Podiums Check
      podiums.forEach((pod) => {
        const podWorldPos = new THREE.Vector3();
        pod.group.getWorldPosition(podWorldPos);
        const distToPod = Math.hypot(cs.x - podWorldPos.x, cs.z - podWorldPos.z);
        if (distToPod < 7) {
          detectedZone = pod.carId;
        }
      });

      // 3. Customization Garage Check (at [35, 0, 10])
      const distToCustomizer = Math.hypot(cs.x - 35, cs.z - 10);
      if (distToCustomizer < 8.5) {
        detectedZone = 'customizer';
      }

      // 4. VIP Concierge Lounge Check (at [50, 0, 0])
      const distToLounge = Math.hypot(cs.x - 50, cs.z - 0);
      if (distToLounge < 9.5) {
        detectedZone = 'dealer-lounge';
      }

      // 5. Speed Trap Trigger (at [-55, 0, 0])
      const distToSpeedTrap = Math.hypot(cs.x - (-55), cs.z - 0);
      if (distToSpeedTrap < 5.5 && speedKmh > 20) {
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

      // CAMERA MODES ORCHESTRATION
      const currentCameraMode = cameraModeRef.current;
      const currentCockpitHotspot = cockpitHotspotRef.current;
      const isCustomizerOpen = isCustomizerOpenRef.current;

      if (currentCameraMode === 'COCKPIT') {
        // Cockpit Camera with Hotspot Focusing
        const baseOffset = baseSpec.cockpitOffset;
       // Keep the driver's camera clear of the seat geometry.
let hotspotOffset = new THREE.Vector3(
  baseOffset.x,
  baseOffset.y + 0.05,
  baseOffset.z + 0.05
);
        let lookTargetDist = 50;
let lookTargetY = baseSpec.cockpitOffset.y - 0.30;

        if (currentCockpitHotspot === 'DASHBOARD') {
          hotspotOffset = new THREE.Vector3(baseOffset.x, baseOffset.y - 0.12, baseOffset.z + 0.18);
          lookTargetDist = 1.2;
          lookTargetY = baseOffset.y - 0.05;
        } else if (currentCockpitHotspot === 'CONSOLE') {
          hotspotOffset = new THREE.Vector3(0, baseOffset.y - 0.1, baseOffset.z + 0.1);
          lookTargetDist = 1.5;
          lookTargetY = baseOffset.y - 0.15;
        } else if (currentCockpitHotspot === 'WINDSHIELD') {
          hotspotOffset = new THREE.Vector3(0, baseOffset.y + 0.1, baseOffset.z + 0.6);
          lookTargetDist = 35;
          lookTargetY = baseSpec.lookTargetHeight;
        }

        const driverOffset = hotspotOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), cs.rotation);
        camera.position.set(cs.x + driverOffset.x, driverOffset.y, cs.z + driverOffset.z);

       const lookTarget = new THREE.Vector3(
  cs.x + Math.sin(cs.rotation) * lookTargetDist,
  lookTargetY,
  cs.z + Math.cos(cs.rotation) * lookTargetDist
);
        camera.lookAt(lookTarget);
      } else if (currentCameraMode === 'ORBIT' || isCustomizerOpen) {
        // Showcase Orbit Camera around Vehicle
        const orbitAngle = currentTime * 0.0006;
        const orbitDistance = 8.0;
        camera.position.set(
          cs.x + Math.sin(orbitAngle) * orbitDistance,
          2.6,
          cs.z + Math.cos(orbitAngle) * orbitDistance
        );
        camera.lookAt(cs.x, 0.7, cs.z);
      } else if (currentCameraMode === 'DRONE') {
        // High-angle tactical tracking drone
        const droneDist = 20;
        const targetCamX = cs.x - Math.sin(cs.rotation) * droneDist;
        const targetCamZ = cs.z - Math.cos(cs.rotation) * droneDist;

        camera.position.x += (targetCamX - camera.position.x) * delta * 2.2;
        camera.position.y += (14 - camera.position.y) * delta * 2.2;
        camera.position.z += (targetCamZ - camera.position.z) * delta * 2.2;
        camera.lookAt(cs.x, 0.5, cs.z);
      } else {
        // CHASE CAMERA (Forward-facing responsive 3rd-person)
        const targetCamX = cs.x - Math.sin(cs.rotation) * baseSpec.chaseDistance;
        const targetCamZ = cs.z - Math.cos(cs.rotation) * baseSpec.chaseDistance;

        camera.position.x += (targetCamX - camera.position.x) * delta * 6.5;
        camera.position.y += (baseSpec.chaseHeight - camera.position.y) * delta * 4.5;
        camera.position.z += (targetCamZ - camera.position.z) * delta * 6.5;

        const lookAtTarget = new THREE.Vector3(
          cs.x + Math.sin(cs.rotation) * baseSpec.chaseLookAhead,
          0.7,
          cs.z + Math.cos(cs.rotation) * baseSpec.chaseLookAhead
        );
        camera.lookAt(lookAtTarget);
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);

      // Close the multiplayer connection
      if (multiplayerSocketRef.current) {
        multiplayerSocketRef.current.close();
        multiplayerSocketRef.current = null;
      }

      // Remove remote-player avatars and release their resources
      remotePlayersRef.current.forEach((remote) => {
        scene.remove(remote.group);

        remote.group.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();

            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];

            materials.forEach((material) => material.dispose());
          }
        });
      });

      remotePlayersRef.current.clear();

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      renderer.dispose();
      engineAudio.stop();
    };
  }, []);


  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      {/* 3D driving world */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        tabIndex={0}
        title="MANIFOLD WORLD 3D Proving Ground"
      />

      {/* Interactive steering control */}
      {cameraMode === 'COCKPIT' && (
        <div
          className="absolute bottom-8 left-8 z-50 flex h-28 w-28 items-center justify-center rounded-full border-4 border-white/40 bg-black/60 shadow-2xl touch-none select-none"
          style={{ touchAction: 'none' }}
          onPointerDown={handleCockpitSteeringPointerDown}
          onPointerMove={handleCockpitSteeringPointerMove}
          onPointerUp={handleCockpitSteeringPointerUp}
          onPointerCancel={handleCockpitSteeringPointerUp}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-[8px] border-gray-300">
            <div className="h-3 w-12 rounded-full bg-red-500" />
          </div>
        </div>
      )}
    </div>
  );
};