import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
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
      marketplaceMarkerSprite.position.y = 8.2 + Math.sin(currentTime * 0.003) * 0.35;

      // Input Resolution (Keyboard + Touch)
      const input = {
        forward: Boolean(keys.current['w'] || keys.current['arrowup'] || virtualInput?.forward),
        backward: Boolean(keys.current['s'] || keys.current['arrowdown'] || virtualInput?.backward),
        left: Boolean(keys.current['a'] || keys.current['arrowleft'] || virtualInput?.left),
        right: Boolean(keys.current['d'] || keys.current['arrowright'] || virtualInput?.right),
        handbrake: Boolean(keys.current[' '] || keys.current['space'] || virtualInput?.handbrake),
      };

      const cs = carState.current;
      const baseSpec = vehicleSpecRef.current;

      // Calculate installed tuning upgrades modifiers
      const ecu = customization.ecuStage || 0;
      const ecuAccelBonus = ecu === 2 ? 1.45 : ecu === 1 ? 1.2 : 1.0;
      const ecuSpeedBonus = ecu === 2 ? 1.22 : ecu === 1 ? 1.12 : 1.0;

      const isTrackSuspension = customization.suspension === 'TRACK';
      const isSportSuspension = customization.suspension === 'SPORT';
      const steerSpeedMultiplier = isTrackSuspension ? 1.45 : isSportSuspension ? 1.25 : 1.0;

      const isCarbonBrakes = customization.brakes === 'CARBON_CERAMIC';
      const brakeDecelEffective = isCarbonBrakes ? 64 : baseSpec.brakeDecel;

      const isSemiSlick = customization.tires === 'SEMI_SLICK';
      const driftControlMultiplier = isSemiSlick ? 0.75 : 1.0;

      // Drive Mode Adjustments
      let modeAccelMod = 1.0;
      let modeSpeedMod = 1.0;
      let modeSteerMod = 1.0;
      let modeDriftMod = 1.0;

      if (driveMode === 'TRACK') {
        modeAccelMod = 1.28;
        modeSpeedMod = 1.14;
        modeSteerMod = 1.2;
      } else if (driveMode === 'SPORT') {
        modeAccelMod = 1.12;
        modeSpeedMod = 1.06;
      } else if (driveMode === 'ECO') {
        modeAccelMod = 0.75;
        modeSpeedMod = 0.82;
      } else if (driveMode === 'DRIFT') {
        modeAccelMod = 1.1;
        modeDriftMod = 2.4;
      }

      const effectiveAccel = baseSpec.acceleration * ecuAccelBonus * modeAccelMod;
      const effectiveMaxSpeed = baseSpec.maxSpeed * ecuSpeedBonus * modeSpeedMod;
      const effectiveSteerSpeed = baseSpec.steerSpeed * steerSpeedMultiplier * modeSteerMod;

      // If Engine is OFF, car cannot accelerate
      const canThrottle = isEngineRunning;

      // Throttle & Braking Dynamics
      if (input.forward && canThrottle) {
        if (cs.speed < 0) {
          cs.speed += brakeDecelEffective * delta;
        } else {
          cs.speed = Math.min(cs.speed + effectiveAccel * delta, effectiveMaxSpeed);
        }
      } else if (input.backward && canThrottle) {
        if (cs.speed > 0) {
          cs.speed -= brakeDecelEffective * delta;
        } else {
          cs.speed = Math.max(cs.speed - effectiveAccel * 0.55 * delta, -18);
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
        onAwardCredits?.(25, 'Distance Cruise Bonus');
      }

      // Track boundaries: -185 to 185
      const nextX = cs.x + vx;
      const nextZ = cs.z + vz;

      if (Math.abs(nextX) < 185) {
        cs.x = nextX;
      } else {
        cs.speed = -cs.speed * 0.25;
      }

      if (Math.abs(nextZ) < 185) {
        cs.z = nextZ;
      } else {
        cs.speed = -cs.speed * 0.25;
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
      const isBlinkingNow =
        (turnSignal !== 'OFF' || hazardLights) && Math.floor(currentTime / 450) % 2 === 0;

      if (activeVehicleRef.current?.turnSignalMeshes) {
        const { frontLeft, frontRight, rearLeft, rearRight } = activeVehicleRef.current.turnSignalMeshes;
        const leftBlink = (turnSignal === 'LEFT' || hazardLights) && isBlinkingNow;
        const rightBlink = (turnSignal === 'RIGHT' || hazardLights) && isBlinkingNow;

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
        canThrottle && (input.forward || input.backward),
        canThrottle && input.backward && cs.speed > 0,
        cs.isDrifting,
        driveMode,
        currentVehicleType
      );

      // HUD Telemetry (Speed km/h, RPM, Gear)
      const speedKmh = Math.round(Math.abs(cs.speed) * 4.6);
      const speedRatio = Math.abs(cs.speed) / effectiveMaxSpeed;
      const rpm = Math.round(baseSpec.idleRpm + speedRatio * (baseSpec.redlineRpm - baseSpec.idleRpm));
      const gear = !isEngineRunning
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

      if (onSpeedChange) {
        onSpeedChange(speedKmh, rpm, gear);
      }

      if (onCarPositionUpdate) {
        onCarPositionUpdate({ x: cs.x, z: cs.z, heading: cs.rotation });
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
          if (onSpeedTrapTrigger) {
            onSpeedTrapTrigger(speedKmh);
          }
          if (speedKmh > 160) {
            onAwardCredits?.(350, 'High-Speed Trap Milestone (>160 km/h)');
          } else if (speedKmh > 100) {
            onAwardCredits?.(150, 'Speed Trap Record Passed');
          }
        }
      }

      if (detectedZone !== activeZoneRef.current) {
        activeZoneRef.current = detectedZone;
        if (onZoneChange) {
          onZoneChange(detectedZone);
        }
      }

      // CAMERA MODES ORCHESTRATION
      if (cameraMode === 'COCKPIT') {
        // Cockpit Camera with Hotspot Focusing
        const baseOffset = baseSpec.cockpitOffset;
        let hotspotOffset = new THREE.Vector3(baseOffset.x, baseOffset.y, baseOffset.z);
        let lookTargetDist = 28;
        let lookTargetY = baseSpec.lookTargetHeight;

        if (cockpitHotspot === 'DASHBOARD') {
          hotspotOffset = new THREE.Vector3(baseOffset.x, baseOffset.y - 0.12, baseOffset.z + 0.18);
          lookTargetDist = 1.2;
          lookTargetY = baseOffset.y - 0.05;
        } else if (cockpitHotspot === 'CONSOLE') {
          hotspotOffset = new THREE.Vector3(0, baseOffset.y - 0.1, baseOffset.z + 0.1);
          lookTargetDist = 1.5;
          lookTargetY = baseOffset.y - 0.15;
        } else if (cockpitHotspot === 'WINDSHIELD') {
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
      } else if (cameraMode === 'ORBIT' || isCustomizerOpen) {
        // Showcase Orbit Camera around Vehicle
        const orbitAngle = currentTime * 0.0006;
        const orbitDistance = 8.0;
        camera.position.set(
          cs.x + Math.sin(orbitAngle) * orbitDistance,
          2.6,
          cs.z + Math.cos(orbitAngle) * orbitDistance
        );
        camera.lookAt(cs.x, 0.7, cs.z);
      } else if (cameraMode === 'DRONE') {
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
