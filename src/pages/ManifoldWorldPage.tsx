import React, { useState, useEffect } from 'react';
import { WorldCanvas, CameraViewMode, TimeOfDay } from '../components/world/WorldCanvas';
import { WorldHUD } from '../components/world/WorldHUD';
import { CustomizerDrawer } from '../components/world/CustomizerDrawer';
import { MarketplaceGatewayModal } from '../components/world/MarketplaceGatewayModal';
import { VehicleInspectorModal } from '../components/world/VehicleInspectorModal';
import { DealerLoungeModal } from '../components/world/DealerLoungeModal';
import { CarCustomization, VehicleModelType } from '../components/world/worldModels';
import { Car } from '../types';
import {
  Compass,
  ShoppingBag,
  Palette,
  Flag,
  Building2,
  Car as CarIcon,
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
      };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('manifold_world_custom', JSON.stringify(customization));
    } catch {
      // ignore
    }
  }, [customization]);

  // World & Camera State (Default: DAYLIGHT and CHASE)
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('CHASE');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('DAYLIGHT');
  const [activeZone, setActiveZone] = useState<string | null>(null);

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
  const [inspectingCar, setInspectingCar] = useState<Car | null>(null);

  const handleSpeedTrap = (recordedSpeed: number) => {
    setSpeedTrapRecord(recordedSpeed);
    setTimeout(() => {
      setSpeedTrapRecord(null);
    }, 4500);
  };

  const handleInspectShowroomCar = (carIdentifier: string) => {
    // Map zone id to real car
    const matched =
      cars.find((c) => c.id === carIdentifier || c.slug === carIdentifier) ||
      cars[0];
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
      />

      {/* Quick World Navigation Dock (Floating Top-Left) */}
      <div className="absolute top-20 left-4 z-40 hidden md:flex flex-col gap-2 pointer-events-auto">
        <div className="bg-[#071A2B]/85 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-2xl flex flex-col gap-1 text-[11px] font-bold">
          <span className="px-2.5 py-1 text-[9px] uppercase tracking-wider text-gray-400 font-semibold">
            World POIs
          </span>
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
            <span>Tuning & Garage Studio</span>
          </button>
        </div>
      </div>

      {/* Interactive Drawers and Modals */}
      <CustomizerDrawer
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        customization={customization}
        onChange={(updated) => setCustomization(updated)}
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
    </div>
  );
};
