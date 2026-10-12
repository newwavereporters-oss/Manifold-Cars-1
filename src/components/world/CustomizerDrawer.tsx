import React from 'react';
import { X, Check, Sparkles, Car as CarIcon } from 'lucide-react';
import {
  CarCustomization,
  CAR_COLOR_PALETTES,
  VehicleModelType,
  VEHICLE_SPEC_PROFILES,
} from './worldModels';

interface CustomizerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  customization: CarCustomization;
  onChange: (updated: CarCustomization) => void;
}

const RIM_OPTIONS = [
  { name: 'Liquid Silver', hex: '#E2E8F0' },
  { name: 'Satin Bronze', hex: '#B45309' },
  { name: 'Gloss Black', hex: '#0F172A' },
  { name: 'Chrome Titanium', hex: '#94A3B8' },
];

const CALIPER_OPTIONS = [
  { name: 'MANIFOLD Red', hex: '#EF233C' },
  { name: 'Acid Yellow', hex: '#FACC15' },
  { name: 'Electric Blue', hex: '#3B82F6' },
  { name: 'Emerald Green', hex: '#10B981' },
];

const VEHICLE_TYPES: { type: VehicleModelType; label: string; desc: string; topSpeed: string }[] = [
  {
    type: 'SPORTS_COUPE',
    label: 'MANIFOLD GT Coupe',
    desc: 'V8 Twin-Turbo Track Coupe',
    topSpeed: '220 km/h',
  },
  {
    type: 'LUXURY_SUV',
    label: 'Apex Luxury SUV',
    desc: 'AWD Twin-Turbo 7-Seater',
    topSpeed: '195 km/h',
  },
  {
    type: 'EXECUTIVE_SEDAN',
    label: 'Prestige Executive',
    desc: 'V6 Luxury Comfort Cruiser',
    topSpeed: '205 km/h',
  },
  {
    type: 'RUGGED_4X4',
    label: 'Highland Safari 4x4',
    desc: 'Heavy-Duty Overland V8',
    topSpeed: '175 km/h',
  },
];

export const CustomizerDrawer: React.FC<CustomizerDrawerProps> = ({
  isOpen,
  onClose,
  customization,
  onChange,
}) => {
  if (!isOpen) return null;

  const currentType = customization.vehicleType || 'SPORTS_COUPE';

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-[#071A2B]/95 backdrop-blur-2xl border-l border-white/10 z-50 p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200 overflow-y-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#EF233C]" />
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              Garage & Tuning Studio
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Vehicle Garage Class Selector */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-2.5 flex items-center gap-1.5">
            <CarIcon className="w-3.5 h-3.5 text-[#EF233C]" />
            Vehicle Class & Engine Setup
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            {VEHICLE_TYPES.map((v) => {
              const isSelected = currentType === v.type;
              return (
                <button
                  key={v.type}
                  onClick={() => onChange({ ...customization, vehicleType: v.type })}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#EF233C] bg-white/10 shadow-lg scale-[1.02]'
                      : 'border-white/10 hover:border-white/30 bg-white/5'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white leading-tight">{v.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#EF233C] shrink-0" />}
                    </div>
                    <span className="text-[10px] text-gray-400 block mt-1 leading-tight">{v.desc}</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 mt-2">Max {v.topSpeed}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Paint Colors */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-3">
            Exterior Coachwork Paint
          </span>
          <div className="grid grid-cols-4 gap-3">
            {CAR_COLOR_PALETTES.map((palette) => {
              const isSelected = customization.paintColor.toLowerCase() === palette.hex.toLowerCase();
              return (
                <button
                  key={palette.name}
                  onClick={() =>
                    onChange({
                      ...customization,
                      paintColor: palette.hex,
                      finish: palette.finish as 'gloss' | 'matte' | 'metallic',
                    })
                  }
                  className={`group relative flex flex-col items-center p-2 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-[#EF233C] bg-white/10 shadow-lg scale-105'
                      : 'border-white/10 hover:border-white/30 bg-white/5'
                  }`}
                  title={`${palette.name} (${palette.finish})`}
                >
                  <div
                    className="w-9 h-9 rounded-full shadow-inner border border-white/20 flex items-center justify-center"
                    style={{ backgroundColor: palette.hex }}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                  </div>
                  <span className="text-[10px] text-gray-300 mt-1.5 truncate max-w-full text-center">
                    {palette.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Finish Selector */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-3">
            Paint Surface Finish
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(['gloss', 'metallic', 'matte'] as const).map((finish) => (
              <button
                key={finish}
                onClick={() => onChange({ ...customization, finish })}
                className={`py-2 text-xs font-semibold uppercase rounded-lg border transition-all ${
                  customization.finish === finish
                    ? 'bg-[#EF233C] border-[#EF233C] text-white shadow-md'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {finish}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Rim Finish */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-3">
            Forged Alloy Wheels
          </span>
          <div className="grid grid-cols-4 gap-2">
            {RIM_OPTIONS.map((rim) => {
              const isSelected = customization.rimColor.toLowerCase() === rim.hex.toLowerCase();
              return (
                <button
                  key={rim.name}
                  onClick={() => onChange({ ...customization, rimColor: rim.hex })}
                  className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-[#EF233C] bg-white/10'
                      : 'border-white/10 hover:border-white/30 bg-white/5'
                  }`}
                  title={rim.name}
                >
                  <div
                    className="w-7 h-7 rounded-full border border-white/20"
                    style={{ backgroundColor: rim.hex }}
                  />
                  <span className="text-[9px] text-gray-300 mt-1 truncate max-w-full text-center">
                    {rim.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Caliper Finish */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-3">
            Performance Brake Calipers
          </span>
          <div className="grid grid-cols-4 gap-2">
            {CALIPER_OPTIONS.map((caliper) => {
              const isSelected = customization.caliperColor.toLowerCase() === caliper.hex.toLowerCase();
              return (
                <button
                  key={caliper.name}
                  onClick={() => onChange({ ...customization, caliperColor: caliper.hex })}
                  className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-[#EF233C] bg-white/10'
                      : 'border-white/10 hover:border-white/30 bg-white/5'
                  }`}
                  title={caliper.name}
                >
                  <div
                    className="w-7 h-7 rounded-full border border-white/20"
                    style={{ backgroundColor: caliper.hex }}
                  />
                  <span className="text-[9px] text-gray-300 mt-1 truncate max-w-full text-center">
                    {caliper.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pt-6 mt-6 border-t border-white/10">
        <button
          onClick={onClose}
          className="w-full py-3 bg-[#EF233C] hover:bg-[#d90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-lg"
        >
          Confirm & Drive
        </button>
      </div>
    </div>
  );
};
