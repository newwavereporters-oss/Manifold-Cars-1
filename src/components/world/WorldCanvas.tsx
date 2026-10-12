import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createVehicleByType,
  createWorldEnvironment,
  CarCustomization,
  VehicleModelType,
  VEHICLE_SPEC_PROFILES,
} from './worldModels';
import { engineAudio } from '../../utils/engineAudio';

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
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // References to preserve Three.js state across re-renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerCarGroupRef = useRef<THREE.Group | null>(null);
  const carPaintMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const activeZoneRef = useRef<string | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);

  // Wheels and dynamic components
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
  });

  // Keyboard input tracker
  const keys = useRef<{ [key: string]: boolean }>({});

  // Speed trap debounce
  const lastSpeedTrapTrigger = useRef<number>(0);

  // Rebuild or update car paint material when customization changes
  useEffect(() => {
    if (carPaintMatRef.current) {
      carPaintMatRef.current.color.set(customization.paintColor);
      carPaintMatRef.current.metalness =
        customization.finish === 'metallic' ? 0.85 : customization.finish === 'matte' ? 0.15 : 0.45;
      carPaintMatRef.current.roughness =
        customization.finish === 'matte' ? 0.55 : customization.finish === 'metallic' ? 0.22 : 0.18;
    }
  }, [customization.paintColor, customization.finish]);

  // Handle vehicle type switch (swaps the 3D car mesh in the scene while maintaining location)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old car mesh if exists
    if (playerCarGroupRef.current) {
      scene.remove(playerCarGroupRef.current);
    }

    // Build new vehicle model
    const newVehicle = createVehicleByType(customization);
    scene.add(newVehicle.carGroup);
    playerCarGroupRef.current = newVehicle.carGroup;
    carPaintMatRef.current = newVehicle.paintMaterial;

    wheelsRef.current = {
      frontLeftWheel: newVehicle.frontLeftWheel,
      frontRightWheel: newVehicle.frontRightWheel,
      rearLeftWheel: newVehicle.rearLeftWheel,
      rearRightWheel: newVehicle.rearRightWheel,
    };

    // Reapply current position and rotation
    newVehicle.carGroup.position.set(carState.current.x, 0, carState.current.z);
    newVehicle.carGroup.rotation.y = carState.current.rotation;
  }, [customization.vehicleType]);

  // Lighting updates based on timeOfDay (Bright Daylight Default)
  useEffect(() => {
    if (!dirLightRef.current || !hemiLightRef.current || !sceneRef.current || !rendererRef.current) return;

    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const dirLight = dirLightRef.current;
    const hemiLight = hemiLightRef.current;
    const ambLight = ambientLightRef.current;

    if (timeOfDay === 'DAYLIGHT') {
      // Natural, bright, high-contrast daylight
      scene.background = new THREE.Color(0xbfe3f7);
      scene.fog = new THREE.FogExp2(0xd6eaf8, 0.0018); // very subtle atmospheric horizon haze
      renderer.toneMappingExposure = 1.25;

      dirLight.color.set(0xfffaed);
      dirLight.intensity = 2.4;
      dirLight.position.set(65, 85, 45);

      hemiLight.color.set(0xdbeafe); // Sky tint
      hemiLight.groundColor.set(0x94a3b8); // Road bounce
      hemiLight.intensity = 1.35;

      if (ambLight) {
        ambLight.color.set(0xf1f5f9);
        ambLight.intensity = 0.65;
      }
    } else if (timeOfDay === 'GOLDEN_HOUR') {
      // Warm late-afternoon golden glow
      scene.background = new THREE.Color(0xfde68a);
      scene.fog = new THREE.FogExp2(0xfef3c7, 0.0028);
      renderer.toneMappingExposure = 1.2;

      dirLight.color.set(0xf59e0b);
      dirLight.intensity = 2.5;
      dirLight.position.set(80, 45, 60);

      hemiLight.color.set(0xfde047);
      hemiLight.groundColor.set(0x78350f);
      hemiLight.intensity = 1.1;

      if (ambLight) {
        ambLight.color.set(0xfef08a);
        ambLight.intensity = 0.55;
      }
    } else if (timeOfDay === 'SUNSET') {
      // Crimson dusk sunset
      scene.background = new THREE.Color(0x311b38);
      scene.fog = new THREE.FogExp2(0x311b38, 0.0035);
      renderer.toneMappingExposure = 1.15;

      dirLight.color.set(0xf87171);
      dirLight.intensity = 2.0;
      dirLight.position.set(50, 40, 40);

      hemiLight.color.set(0xc084fc);
      hemiLight.groundColor.set(0x1e1b4b);
      hemiLight.intensity = 0.95;

      if (ambLight) {
        ambLight.color.set(0xfca5a5);
        ambLight.intensity = 0.5;
      }
    } else {
      // MIDNIGHT: Illuminated neon track with legible ambient fill
      scene.background = new THREE.Color(0x0a1128);
      scene.fog = new THREE.FogExp2(0x0a1128, 0.0045);
      renderer.toneMappingExposure = 1.1;

      dirLight.color.set(0x38bdf8);
      dirLight.intensity = 1.0;
      dirLight.position.set(40, 50, 30);

      hemiLight.color.set(0x3b82f6);
      hemiLight.groundColor.set(0x0f172a);
      hemiLight.intensity = 0.8;

      if (ambLight) {
        ambLight.color.set(0x60a5fa);
        ambLight.intensity = 0.45;
      }
    }
  }, [timeOfDay]);

  // Keyboard Event Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      keys.current[e.key.toLowerCase()] = true;
      keys.current[e.code] = true;

      // Interaction key triggers
      if (e.key.toLowerCase() === 'e') {
        const zone = activeZoneRef.current;
        if (zone === 'marketplace' && onEnterMarketplace) {
          onEnterMarketplace();
        } else if (zone?.startsWith('car-') && onInspectCar) {
          onInspectCar(zone);
        } else if (zone === 'dealer-lounge' && onOpenDealerLounge) {
          onOpenDealerLounge();
        }
      }

      if (e.key.toLowerCase() === 'c' && onOpenCustomizer) {
        onOpenCustomizer();
      }

      // Audio init on first user keypress
      engineAudio.init();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
      keys.current[e.code] = false;
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

    // Natural daylight defaults
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
    const { environmentGroup, podiums, speedTrapGate } = createWorldEnvironment();
    scene.add(environmentGroup);

    // 5. Build Drivable Player Car (from active customization type)
    const playerCar = createVehicleByType(customization);
    scene.add(playerCar.carGroup);
    playerCarGroupRef.current = playerCar.carGroup;
    carPaintMatRef.current = playerCar.paintMaterial;

    wheelsRef.current = {
      frontLeftWheel: playerCar.frontLeftWheel,
      frontRightWheel: playerCar.frontRightWheel,
      rearLeftWheel: playerCar.rearLeftWheel,
      rearRightWheel: playerCar.rearRightWheel,
    };

    // Initial position on plaza facing Showroom
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
      const spec = vehicleSpecRef.current;

      // Throttle & Braking Dynamics
      if (input.forward) {
        if (cs.speed < 0) {
          cs.speed += spec.brakeDecel * delta;
        } else {
          cs.speed = Math.min(cs.speed + spec.acceleration * delta, spec.maxSpeed);
        }
      } else if (input.backward) {
        if (cs.speed > 0) {
          cs.speed -= spec.brakeDecel * delta;
        } else {
          cs.speed = Math.max(cs.speed - spec.acceleration * 0.55 * delta, -16);
        }
      } else {
        // Natural deceleration / Rolling resistance
        if (cs.speed > 0) {
          cs.speed = Math.max(0, cs.speed - spec.deceleration * delta);
        } else if (cs.speed < 0) {
          cs.speed = Math.min(0, cs.speed + spec.deceleration * delta);
        }
      }

      // Handbrake drift
      if (input.handbrake) {
        cs.isDrifting = Math.abs(cs.speed) > 10;
        cs.speed *= Math.pow(0.88, delta * 30);
      } else {
        cs.isDrifting = false;
      }

      // Speed-based steering damping (prevents high-speed rollover)
      const speedSteerFactor = Math.max(0.32, 1 - Math.abs(cs.speed) / (spec.maxSpeed * 1.35));
      const targetSteer = input.left
        ? spec.maxSteer * speedSteerFactor
        : input.right
        ? -spec.maxSteer * speedSteerFactor
        : 0;

      cs.steeringAngle += (targetSteer - cs.steeringAngle) * spec.steerSpeed * delta * 4;

      // Heading rotation with drift authority
      if (Math.abs(cs.speed) > 0.05) {
        const turnDirection = cs.speed > 0 ? 1 : -1;
        const driftMultiplier = cs.isDrifting ? 1.6 : 1.0;
        cs.rotation +=
          (cs.steeringAngle * (cs.speed / spec.maxSpeed) * 2.8 * turnDirection * delta) * driftMultiplier;
      }

      // Calculate translation vector
      const vx = Math.sin(cs.rotation) * cs.speed * delta;
      const vz = Math.cos(cs.rotation) * cs.speed * delta;

      // Track boundaries: -175 to 175
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

      // Engine audio synthesis update
      engineAudio.update(
        cs.speed,
        spec.maxSpeed,
        input.forward || input.backward,
        input.backward && cs.speed > 0,
        cs.isDrifting
      );

      // HUD Telemetry (Speed km/h, RPM, Gear)
      const speedKmh = Math.round(Math.abs(cs.speed) * 4.6);
      const speedRatio = Math.abs(cs.speed) / spec.maxSpeed;
      const rpm = Math.round(spec.idleRpm + speedRatio * (spec.redlineRpm - spec.idleRpm));
      const gear =
        cs.speed < -0.5
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
          : 'D5';

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

      // 4. VIP Concierge Lounge Check (at [-30, 0, -45])
      const distToLounge = Math.hypot(cs.x - (-30), cs.z - (-45));
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
        }
      }

      if (detectedZone !== activeZoneRef.current) {
        activeZoneRef.current = detectedZone;
        if (onZoneChange) {
          onZoneChange(detectedZone);
        }
      }

      // CAMERA MODES ORCHESTRATION WITH REALISTIC FORWARD-FACING HEADING
      if (cameraMode === 'COCKPIT') {
        // First-person driver cockpit view with clear unobstructed forward horizon
        const offset = spec.cockpitOffset;
        const driverOffset = new THREE.Vector3(offset.x, offset.y, offset.z).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          cs.rotation
        );
        camera.position.set(cs.x + driverOffset.x, driverOffset.y, cs.z + driverOffset.z);

        // Look straight forward in vehicle heading direction
        const lookTarget = new THREE.Vector3(
          cs.x + Math.sin(cs.rotation) * 28,
          spec.lookTargetHeight,
          cs.z + Math.cos(cs.rotation) * 28
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
        // Positioned behind the vehicle (opposite to velocity heading) looking directly ahead of the car
        const targetCamX = cs.x - Math.sin(cs.rotation) * spec.chaseDistance;
        const targetCamZ = cs.z - Math.cos(cs.rotation) * spec.chaseDistance;

        // Smooth camera follow dampening
        camera.position.x += (targetCamX - camera.position.x) * delta * 6.5;
        camera.position.y += (spec.chaseHeight - camera.position.y) * delta * 4.5;
        camera.position.z += (targetCamZ - camera.position.z) * delta * 6.5;

        // Points toward travel direction ahead of the car
        const lookAtTarget = new THREE.Vector3(
          cs.x + Math.sin(cs.rotation) * spec.chaseLookAhead,
          0.7,
          cs.z + Math.cos(cs.rotation) * spec.chaseLookAhead
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
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      engineAudio.stop();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="w-full h-full relative cursor-grab active:cursor-grabbing select-none overflow-hidden"
      onClick={() => engineAudio.init()}
    />
  );
};
