import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WorldCanvas, CameraViewMode, TimeOfDay } from '../components/world/WorldCanvas';
import { WorldHUD } from '../components/world/WorldHUD';
import { CustomizerDrawer } from '../components/world/CustomizerDrawer';
import { MarketplaceGatewayModal } from '../components/world/MarketplaceGatewayModal';
import { VehicleInspectorModal } from '../components/world/VehicleInspectorModal';
import { DealerLoungeModal } from '../components/world/DealerLoungeModal';
import { CityMapModal } from '../components/world/CityMapModal';
import { MissionHUDOverlay } from '../components/world/MissionHUDOverlay';
import {
  MissionManager,
  ActiveMissionSession,
  MissionId,
  MISSIONS_CATALOG,
} from '../components/world/missionEngine';
import {
  CarCustomization,
  VehicleModelType,
  VEHICLE_SPEC_PROFILES,
} from '../components/world/worldModels';
import { HeadlightState, TurnSignalState, CockpitHotspot } from '../components/world/CockpitDashboardOverlay';
import { AudioDriveMode, engineAudio } from '../utils/engineAudio';
import { Car } from '../types';
import {
  Compass,
  ShoppingBag,
  Palette,
  Flag,
  Building2,
  Map as MapIcon,
} from 'lucide-react';

interface ManifoldWorldPageProps {
  cars: Car[];
  navigate: (route: string) => void;
  onSelectCar: (car: Car) => void;
  onPlayVideo: (car: Car) => void;
  onInterested: (car: Car) => void;
}

export const ManifoldWorldPage: React.FC<ManifoldWorldPageProps> = ({
  cars,
  navigate,
  onSelectCar,
  onPlayVideo,
  onInterested,
}) => {
  // Vehicle Customization & Active Model State
  const [customization, setCustomization] = useState<CarCustomization>(() => {
    try {
      const saved = localStorage.getItem('manifold_world_custom');
      return saved
        ? JSON.parse(saved)
        : {
            vehicleType: 'SPORTS_COUPE' as VehicleModelType,
            paintColor: '#DC2626', // Signature Rosso Corsa
            finish: 'metallic',
            rimColor: '#E2E8F0',
            caliperColor: '#EF233C',
            headlightTint: '#ffffff',
            windowTint: 0.45,
            spoiler: 'GT_WING',
            underglow: 'NONE',
            ecuStage: 0,
            suspension: 'STOCK',
            brakes: 'OEM',
            tires: 'ALL_SEASON',
          };
    } catch {
      return {
        vehicleType: 'SPORTS_COUPE' as VehicleModelType,
        paintColor: '#DC2626',
        finish: 'metallic',
        rimColor: '#E2E8F0',
        caliperColor: '#EF233C',
        headlightTint: '#ffffff',
        windowTint: 0.45,
        spoiler: 'GT_WING',
        underglow: 'NONE',
        ecuStage: 0,
        suspension: 'STOCK',
        brakes: 'OEM',
        tires: 'ALL_SEASON',
      };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('manifold_world_custom', JSON.stringify(customization));
    } catch {}
  }, [customization]);

  // Virtual Economy (MANIFOLD Credits)
  const [playerCredits, setPlayerCredits] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('manifold_player_credits');
      return saved ? parseInt(saved, 10) : 5000;
    } catch {
      return 5000;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('manifold_player_credits', playerCredits.toString());
    } catch {}
  }, [playerCredits]);

  const [creditNotification, setCreditNotification] = useState<{
    amount: number;
    reason: string;
  } | null>(null);

  const handleAwardCredits = (amount: number, reason: string) => {
    setPlayerCredits((prev) => prev + amount);
    setCreditNotification({ amount, reason });
    setTimeout(() => {
      setCreditNotification(null);
    }, 3500);
  };

  const handlePurchaseUpgrade = (cost: number, newCustom: CarCustomization) => {
    if (cost > 0) {
      if (playerCredits < cost) return;
      setPlayerCredits((prev) => prev - cost);
    }
    setCustomization(newCustom);
  };

  // World & Camera State (Default: DAYLIGHT and CHASE)
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('CHASE');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('DAYLIGHT');
  const [activeZone, setActiveZone] = useState<string | null>(null);

  // Cockpit & Vehicle Systems State
  const [isEngineRunning, setIsEngineRunning] = useState<boolean>(true);
  const [driveMode, setDriveMode] = useState<AudioDriveMode>('SPORT');
  const [headlightState, setHeadlightState] = useState<HeadlightState>('LOW');
  const [turnSignal, setTurnSignal] = useState<TurnSignalState>('OFF');
  const [hazardLights, setHazardLights] = useState<boolean>(false);
  const [hornActive, setHornActive] = useState<boolean>(false);
  const [radioStation, setRadioStation] = useState<number>(1);
  const [radioVolume, setRadioVolume] = useState<number>(0.7);
  const [cockpitHotspot, setCockpitHotspot] = useState<CockpitHotspot>('DRIVER');

  // Vehicle Telemetry
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [rpm, setRpm] = useState<number>(850);
  const [gear, setGear] = useState<string>('P');
  const [speedTrapRecord, setSpeedTrapRecord] = useState<number | null>(null);
  const [carPosition, setCarPosition] = useState<{ x: number; z: number; heading: number }>({
    x: 0,
    z: 10,
    heading: Math.PI,
  });

  // Virtual Touch Input
  const [virtualInputState, setVirtualInputState] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
  });

  // Modals & Drawers
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isMarketplaceModalOpen, setIsMarketplaceModalOpen] = useState(false);
  const [isDealerLoungeOpen, setIsDealerLoungeOpen] = useState(false);
  const [isCityMapOpen, setIsCityMapOpen] = useState(false);
  const [isMissionDrawerOpen, setIsMissionDrawerOpen] = useState(false);
  const [inspectingCar, setInspectingCar] = useState<Car | null>(null);
  const [resetVehicleTrigger, setResetVehicleTrigger] = useState<number>(0);

  // Lagos GPS Waypoint, Traffic/Rival Radar & Active Mission Engine
  const [activeDestination, setActiveDestination] = useState<{
    x: number;
    z: number;
    name: string;
  } | null>(null);
  const [trafficPositions, setTrafficPositions] = useState<{ x: number; z: number }[]>([]);
  const [rivalPositions, setRivalPositions] = useState<{ name: string; x: number; z: number }[]>([]);
  const [missionSession, setMissionSession] = useState<ActiveMissionSession | null>(null);
  const missionManagerRef = useRef<MissionManager>(new MissionManager());
  const lastMissionUiHashRef = useRef<string>('');

  useEffect(() => {
    missionManagerRef.current.setRewardCallback(handleAwardCredits);
  });

  const syncMissionUi = useCallback((session: ActiveMissionSession | null, force = false) => {
    if (!session) {
      if (lastMissionUiHashRef.current !== 'NONE') {
        lastMissionUiHashRef.current = 'NONE';
        setMissionSession(null);
      }
      return;
    }
    const hash = `${session.missionId}|${session.state}|${Math.ceil(
      session.timeRemainingSec
    )}|${session.cargoIntegrityPercent}|${Math.ceil(session.countdownVal)}|${
      session.currentRaceCheckpointIdx
    }|${session.playerRaceRank}`;
    if (force || hash !== lastMissionUiHashRef.current) {
      lastMissionUiHashRef.current = hash;
      setMissionSession({ ...session });
    }
  }, []);

  const handleOpenMissionBriefing = useCallback(
    (id: MissionId) => {
      const s = missionManagerRef.current.openBriefing(id);
      syncMissionUi(s, true);
    },
    [syncMissionUi]
  );

  const handleStartMission = useCallback(() => {
    const s = missionManagerRef.current.startMission();
    if (s) {
      const def = MISSIONS_CATALOG[s.missionId];
      setActiveDestination({ x: def.destX, z: def.destZ, name: def.destinationName });
    }
    syncMissionUi(s, true);
  }, [syncMissionUi]);

  const handleAbandonMission = useCallback(() => {
    missionManagerRef.current.abandonMission();
    setActiveDestination(null);
    syncMissionUi(null, true);
  }, [syncMissionUi]);

  const handleMissionUpdate = useCallback(
    (
      delta: number,
      playerPos: { x: number; z: number; speed: number },
      onCollisionImpact?: boolean
    ) => {
      const updated = missionManagerRef.current.update(delta, playerPos, onCollisionImpact);
      syncMissionUi(updated);
    },
    [syncMissionUi]
  );

  const handleRaceCheckpointPassed = useCallback(
    (cpIdx: number, rank: number) => {
      const updated = missionManagerRef.current.onPlayerReachRaceCheckpoint(cpIdx + 1, rank);
      syncMissionUi(updated, true);
    },
    [syncMissionUi]
  );

  const handleSpeedTrap = (recordedSpeed: number) => {
    setSpeedTrapRecord(recordedSpeed);
    setTimeout(() => {
      setSpeedTrapRecord(null);
    }, 4500);
  };

  const handleInspectShowroomCar = (carIdentifier: string) => {
    const matched =
      cars.find((c) => c.id === carIdentifier || c.slug === carIdentifier) || cars[0];
    if (matched) {
      setInspectingCar(matched);
    }
  };

  const handleSelectVehicleType = (type: VehicleModelType) => {
    setCustomization((prev) => ({
      ...prev,
      vehicleType: type,
    }));
  };

  const handleToggleEngine = () => {
    const newState = !isEngineRunning;
    setIsEngineRunning(newState);
    engineAudio.setEngineRunning(newState);
  };

  const handleCycleHeadlights = () => {
    setHeadlightState((prev) => (prev === 'OFF' ? 'LOW' : prev === 'LOW' ? 'HIGH' : 'OFF'));
  };

  const handleToggleTurnSignal = (signal: 'LEFT' | 'RIGHT') => {
    setTurnSignal((prev) => (prev === signal ? 'OFF' : signal));
  };

  const handleToggleHazard = () => {
    setHazardLights((prev) => !prev);
  };

  const handleRadioStation = (st: number) => {
    setRadioStation(st);
    engineAudio.setRadioStation(st);
  };

  const handleRadioVolume = (vol: number) => {
    setRadioVolume(vol);
    engineAudio.setRadioVolume(vol);
  };

  // Keyboard shortcut listener for cockpit systems
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'q') {
        handleToggleTurnSignal('LEFT');
      } else if (k === 'h') {
        setHornActive(e.type === 'keydown');
      } else if (k === 'm' && e.type === 'keydown') {
        setIsCityMapOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
    };
  }, []);

  return (
    <div className="relative w-full h-[calc(100vh-76px)] mt-[76px] bg-[#071A2B] overflow-hidden select-none">
      {/* 3D WebGL Canvas Layer */}
      <WorldCanvas
        customization={customization}
        cameraMode={cameraMode}
        timeOfDay={timeOfDay}
        onZoneChange={(zone) => setActiveZone(zone)}
        onSpeedChange={(speed, revs, g) => {
          setSpeedKmh(speed);
          setRpm(revs);
          setGear(g);
        }}
        onSpeedTrapTrigger={handleSpeedTrap}
        onInspectCar={handleInspectShowroomCar}
        onEnterMarketplace={() => setIsMarketplaceModalOpen(true)}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}
        onOpenDealerLounge={() => setIsDealerLoungeOpen(true)}
        onCarPositionUpdate={(pos) => setCarPosition(pos)}
        isCustomizerOpen={isCustomizerOpen}
        virtualInput={virtualInputState}
        isEngineRunning={isEngineRunning}
        driveMode={driveMode}
        headlightState={headlightState}
        turnSignal={turnSignal}
        hazardLights={hazardLights}
        hornActive={hornActive}
        cockpitHotspot={cockpitHotspot}
        onAwardCredits={handleAwardCredits}
        activeDestination={activeDestination}
        activeMissionSession={missionSession}
        onMissionUpdate={handleMissionUpdate}
        onRaceCheckpointPassed={handleRaceCheckpointPassed}
        onTrafficPositionsUpdate={setTrafficPositions}
        onRivalPositionsUpdate={setRivalPositions}
        resetVehicleTrigger={resetVehicleTrigger}
      />

      {/* Heads-Up Display & Gaming UI */}
      <WorldHUD
        speedKmh={speedKmh}
        rpm={rpm}
        gear={gear}
        activeZone={activeZone}
        cameraMode={cameraMode}
        onCameraChange={(mode) => setCameraMode(mode)}
        timeOfDay={timeOfDay}
        onTimeOfDayChange={(time) => setTimeOfDay(time)}
        selectedVehicleType={customization.vehicleType || 'SPORTS_COUPE'}
        onSelectVehicleType={handleSelectVehicleType}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}
        onEnterMarketplace={() => setIsMarketplaceModalOpen(true)}
        onInspectCar={handleInspectShowroomCar}
        onOpenDealerLounge={() => setIsDealerLoungeOpen(true)}
        carPosition={carPosition}
        speedTrapRecord={speedTrapRecord}
        onVirtualInput={(input) => setVirtualInputState(input)}
        virtualInputState={virtualInputState}
        playerCredits={playerCredits}
        creditNotification={creditNotification}
        isEngineRunning={isEngineRunning}
        onToggleEngine={handleToggleEngine}
        driveMode={driveMode}
        onSelectDriveMode={(mode) => setDriveMode(mode)}
        headlightState={headlightState}
        onCycleHeadlights={handleCycleHeadlights}
        turnSignal={turnSignal}
        onToggleTurnSignal={handleToggleTurnSignal}
        hazardLights={hazardLights}
        onToggleHazard={handleToggleHazard}
        hornActive={hornActive}
        onHornDown={() => setHornActive(true)}
        onHornUp={() => setHornActive(false)}
        radioStation={radioStation}
        onSelectRadioStation={handleRadioStation}
        radioVolume={radioVolume}
        onRadioVolumeChange={handleRadioVolume}
        cockpitHotspot={cockpitHotspot}
        onSelectHotspot={(spot) => setCockpitHotspot(spot)}
        onOpenCityMap={() => setIsCityMapOpen(true)}
        onOpenMissions={() => setIsMissionDrawerOpen(true)}
        onResetVehicle={() => setResetVehicleTrigger((prev) => prev + 1)}
        activeDestination={activeDestination}
        onClearDestination={() => setActiveDestination(null)}
      />

      {/* Mission Operations HUD Overlay */}
      <MissionHUDOverlay
        session={missionSession}
        onStartMission={handleStartMission}
        onAbandonMission={handleAbandonMission}
        onOpenMissionBriefing={handleOpenMissionBriefing}
        isMissionDrawerOpen={isMissionDrawerOpen}
        onCloseMissionDrawer={() => setIsMissionDrawerOpen(false)}
      />

      {/* Quick World Navigation Dock (Floating Top-Left) */}
      <div className="absolute top-20 left-4 z-40 hidden md:flex flex-col gap-2 pointer-events-auto">
        <div className="bg-[#071A2B]/85 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-2xl flex flex-col gap-1 text-[11px] font-bold">
          <span className="px-2.5 py-1 text-[9px] uppercase tracking-wider text-gray-400 font-semibold">
            Lagos Mainland & POIs
          </span>
          <button
            onClick={() => setIsCityMapOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-left text-white hover:bg-white/10 rounded-xl transition-colors group"
          >
            <MapIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>City GPS Map [M]</span>
          </button>
          <button
            onClick={() => setIsMissionDrawerOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-left text-white hover:bg-white/10 rounded-xl transition-colors group"
          >
            <Flag className="w-3.5 h-3.5 text-amber-400" />
            <span>Missions & Races</span>
          </button>
          <button
            onClick={() => setIsMarketplaceModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-left text-white hover:bg-white/10 rounded-xl transition-colors group"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#EF233C]" />
            <span>Marketplace Gateway</span>
          </button>
          <button
            onClick={() => handleInspectShowroomCar('car-highlander-2021')}
            className="flex items-center gap-2 px-3 py-2 text-left text-white hover:bg-white/10 rounded-xl transition-colors group"
          >
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            <span>Showroom Pavilion</span>
          </button>
          <button
            onClick={() => setIsDealerLoungeOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-left text-white hover:bg-white/10 rounded-xl transition-colors group"
          >
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>VIP Dealer Lounge</span>
          </button>
          <button
            onClick={() => setIsCustomizerOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-left text-white hover:bg-white/10 rounded-xl transition-colors group"
          >
            <Palette className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tuning & Upgrades Studio</span>
          </button>
        </div>
      </div>

      {/* Interactive Drawers and Modals */}
      <CustomizerDrawer
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        customization={customization}
        onChange={(updated) => setCustomization(updated)}
        playerCredits={playerCredits}
        onPurchaseUpgrade={handlePurchaseUpgrade}
        onViewMarketplaceCar={(carId) => {
          setIsCustomizerOpen(false);
          handleInspectShowroomCar(carId);
        }}
      />

      <MarketplaceGatewayModal
        isOpen={isMarketplaceModalOpen}
        onClose={() => setIsMarketplaceModalOpen(false)}
        onNavigateToMarketplace={() => {
          setIsMarketplaceModalOpen(false);
          navigate('/car-marketplace');
        }}
        onSelectCar={onSelectCar}
        cars={cars}
      />

      <VehicleInspectorModal
        isOpen={Boolean(inspectingCar)}
        onClose={() => setInspectingCar(null)}
        car={inspectingCar}
        onViewDetails={(c) => {
          setInspectingCar(null);
          onSelectCar(c);
        }}
        onPlayVideo={onPlayVideo}
        onInterested={onInterested}
      />

      <DealerLoungeModal
        isOpen={isDealerLoungeOpen}
        onClose={() => setIsDealerLoungeOpen(false)}
        onNavigate={navigate}
      />

      <CityMapModal
        isOpen={isCityMapOpen}
        onClose={() => setIsCityMapOpen(false)}
        playerPos={carPosition}
        activeDestination={activeDestination}
        onSelectDestination={(dest) => {
          setActiveDestination(dest);
          setIsCityMapOpen(false);
        }}
        onClearDestination={() => setActiveDestination(null)}
        trafficPositions={trafficPositions}
        rivalPositions={rivalPositions}
      />
    </div>
  );
};
