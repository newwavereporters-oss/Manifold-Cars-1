import React, { useState } from 'react';
import {
  X,
  Check,
  Sparkles,
  Car as CarIcon,
  Zap,
  Sliders,
  Shield,
  Gauge,
  ExternalLink,
  Coins,
} from 'lucide-react';
import {
  CarCustomization,
  CAR_COLOR_PALETTES,
  UNDERGLOW_PALETTE,
  UnderglowColor,
  SpoilerOption,
  SuspensionTune,
  BrakeTune,
  TireTune,
  VehicleModelType,
  VEHICLE_SPEC_PROFILES,
} from './worldModels';

interface CustomizerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  customization: CarCustomization;
  onChange: (updated: CarCustomization) => void;
  playerCredits: number;
  onPurchaseUpgrade: (cost: number, newCustom: CarCustomization) => void;
  onViewMarketplaceCar: (carId: string) => void;
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

const SPOILER_OPTIONS: { id: SpoilerOption; label: string; desc: string }[] = [
  { id: 'NONE', label: 'Clean / Stock', desc: 'Sleek factory aerodynamic profile' },
  { id: 'DUCKTAIL', label: 'Lip Ducktail', desc: 'Subtle low-drag ducktail spoiler' },
  { id: 'GT_WING', label: 'Carbon GT Wing', desc: 'High-downforce twin-pillar carbon aerofoil' },
];

const TINT_OPTIONS: { value: number; label: string }[] = [
  { value: 0.1, label: '0% Clear' },
  { value: 0.35, label: '35% Smoke' },
  { value: 0.7, label: '5% Limo' },
  { value: 0.9, label: 'Chameleon' },
];

export const CustomizerDrawer: React.FC<CustomizerDrawerProps> = ({
  isOpen,
  onClose,
  customization,
  onChange,
  playerCredits,
  onPurchaseUpgrade,
  onViewMarketplaceCar,
}) => {
  const [activeTab, setActiveTab] = useState<'GARAGE' | 'AESTHETICS' | 'PERFORMANCE'>('GARAGE');

  if (!isOpen) return null;

  const currentType = customization.vehicleType || 'SPORTS_COUPE';
  const currentProfile = VEHICLE_SPEC_PROFILES[currentType];

  // Calculated upgraded metrics
  const ecuStage = customization.ecuStage || 0;
  const hpMultiplier = ecuStage === 2 ? 1.45 : ecuStage === 1 ? 1.2 : 1.0;
  const currentBhp = Math.round(currentProfile.horsepower * hpMultiplier);
  const current0To100 = (currentProfile.acceleration0To100 / hpMultiplier).toFixed(1);
  const currentTopSpeedKmh = Math.round(
    currentProfile.maxSpeed * 4.6 * (ecuStage === 2 ? 1.22 : ecuStage === 1 ? 1.12 : 1.0)
  );

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-[#071A2B]/98 backdrop-blur-2xl border-l border-white/10 z-50 p-5 sm:p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200 overflow-y-auto">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-[#EF233C]" />
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                MANIFOLD Tuning & Garage
              </h2>
              <span className="text-[10px] text-gray-400 block font-mono">
                Interactive Vehicle Workshop & Upgrades
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Player Credits & Benchmark Strip */}
        <div className="bg-gradient-to-r from-slate-900 to-[#0c253d] p-3 rounded-2xl border border-white/10 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-[9px] uppercase font-bold text-gray-400 block">
                Virtual Balance
              </span>
              <span className="text-sm font-black font-mono text-amber-400 tabular-nums">
                {playerCredits.toLocaleString()} MC
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-right">
            <div>
              <span className="text-[8px] uppercase font-bold text-gray-400 block">Output</span>
              <span className="text-xs font-black font-mono text-white">{currentBhp} BHP</span>
            </div>
            <div>
              <span className="text-[8px] uppercase font-bold text-gray-400 block">0-100</span>
              <span className="text-xs font-black font-mono text-emerald-400">{current0To100}s</span>
            </div>
            <div>
              <span className="text-[8px] uppercase font-bold text-gray-400 block">V-Max</span>
              <span className="text-xs font-black font-mono text-[#EF233C]">{currentTopSpeedKmh} KM/H</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded-xl border border-white/5 text-xs font-bold uppercase">
          <button
            onClick={() => setActiveTab('GARAGE')}
            className={`py-2 rounded-lg transition-all ${
              activeTab === 'GARAGE' ? 'bg-[#EF233C] text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            Garage Specs
          </button>
          <button
            onClick={() => setActiveTab('AESTHETICS')}
            className={`py-2 rounded-lg transition-all ${
              activeTab === 'AESTHETICS' ? 'bg-[#EF233C] text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            Coachwork
          </button>
          <button
            onClick={() => setActiveTab('PERFORMANCE')}
            className={`py-2 rounded-lg transition-all ${
              activeTab === 'PERFORMANCE' ? 'bg-[#EF233C] text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            Upgrades
          </button>
        </div>

        {/* TAB 1: GARAGE & VEHICLE SELECTOR */}
        {activeTab === 'GARAGE' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2.5">
              {(
                [
                  'SPORTS_COUPE',
                  'LUXURY_SUV',
                  'EXECUTIVE_SEDAN',
                  'RUGGED_4X4',
                ] as VehicleModelType[]
              ).map((typeKey) => {
                const profile = VEHICLE_SPEC_PROFILES[typeKey];
                const isSelected = currentType === typeKey;

                return (
                  <div
                    key={typeKey}
                    onClick={() => onChange({ ...customization, vehicleType: typeKey })}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#EF233C] bg-white/10 shadow-xl'
                        : 'border-white/10 hover:border-white/20 bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white">{profile.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#EF233C]" />}
                        </div>
                        <span className="text-[10px] text-gray-400 block mt-0.5">
                          {profile.year} • {profile.engineType}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 bg-white/5 text-[9px] font-mono font-bold text-emerald-400 rounded-md">
                        {profile.drivenWheels}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mt-3 text-center bg-black/20 p-2 rounded-xl text-[10px] font-mono">
                      <div>
                        <span className="text-[8px] text-gray-500 uppercase block">Power</span>
                        <span className="text-white font-bold">{profile.horsepower} HP</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-gray-500 uppercase block">Torque</span>
                        <span className="text-white font-bold">{profile.torqueNm} Nm</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-gray-500 uppercase block">0-100</span>
                        <span className="text-emerald-400 font-bold">{profile.acceleration0To100}s</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-gray-500 uppercase block">Weight</span>
                        <span className="text-gray-300 font-bold">{profile.curbWeightKg} kg</span>
                      </div>
                    </div>

                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewMarketplaceCar(profile.marketplaceMatchId);
                        }}
                        className="w-full mt-2.5 py-1.5 px-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-bold text-gray-200 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3 text-blue-400" />
                        <span>View Verified Marketplace Listing</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: AESTHETICS & COACHWORK */}
        {activeTab === 'AESTHETICS' && (
          <div className="space-y-4">
            {/* 1. Paint Colors */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-300 block mb-2.5">
                Coachwork Paint
              </span>
              <div className="grid grid-cols-4 gap-2.5">
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
                      className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-[#EF233C] bg-white/10 shadow-lg scale-105'
                          : 'border-white/10 hover:border-white/20 bg-white/5'
                      }`}
                      title={`${palette.name} (${palette.finish})`}
                    >
                      <div
                        className="w-7 h-7 rounded-full shadow border border-white/20 flex items-center justify-center"
                        style={{ backgroundColor: palette.hex }}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className="text-[9px] text-gray-300 mt-1 truncate max-w-full text-center">
                        {palette.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Paint Finish */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-300 block mb-2">
                Surface Finish
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(['gloss', 'metallic', 'matte'] as const).map((finish) => (
                  <button
                    key={finish}
                    onClick={() => onChange({ ...customization, finish })}
                    className={`py-1.5 text-xs font-bold uppercase rounded-lg border transition-all ${
                      customization.finish === finish
                        ? 'bg-[#EF233C] border-[#EF233C] text-white shadow'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {finish}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Aero Spoiler */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-300 block mb-2">
                Aero Wing & Spoiler
              </span>
              <div className="grid grid-cols-3 gap-2">
                {SPOILER_OPTIONS.map((spoiler) => (
                  <button
                    key={spoiler.id}
                    onClick={() => onChange({ ...customization, spoiler: spoiler.id })}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      (customization.spoiler || 'NONE') === spoiler.id
                        ? 'border-[#EF233C] bg-white/10 shadow'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="text-[10px] font-bold block text-white">{spoiler.label}</span>
                    <span className="text-[8px] text-gray-400 block mt-0.5 leading-tight">
                      {spoiler.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Neon Underglow */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-300 block mb-2">
                Neon Chassis Underglow
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    'NONE',
                    'ICE_BLUE',
                    'ACID_GREEN',
                    'HOT_PINK',
                    'CYBER_AMBER',
                    'WHITE',
                  ] as UnderglowColor[]
                ).map((uKey) => {
                  const item = UNDERGLOW_PALETTE[uKey];
                  const isSelected = (customization.underglow || 'NONE') === uKey;
                  return (
                    <button
                      key={uKey}
                      onClick={() => onChange({ ...customization, underglow: uKey })}
                      className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-[#EF233C] bg-white/10 shadow'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: item.hex }}
                      />
                      <span className="text-[10px] font-bold text-white truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Window Tint */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-300 block mb-2">
                Privacy Glass Tint
              </span>
              <div className="grid grid-cols-4 gap-2">
                {TINT_OPTIONS.map((tint) => (
                  <button
                    key={tint.label}
                    onClick={() => onChange({ ...customization, windowTint: tint.value })}
                    className={`py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                      Math.abs((customization.windowTint || 0.45) - tint.value) < 0.15
                        ? 'bg-[#EF233C] border-[#EF233C] text-white shadow'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {tint.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Alloy Wheels & Calipers */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[11px] font-bold uppercase text-gray-300 block mb-1.5">
                  Rim Alloy
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {RIM_OPTIONS.map((rim) => (
                    <button
                      key={rim.name}
                      onClick={() => onChange({ ...customization, rimColor: rim.hex })}
                      className={`p-1.5 rounded-lg border text-center transition-all ${
                        customization.rimColor === rim.hex
                          ? 'border-[#EF233C] bg-white/10'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full mx-auto border border-white/20"
                        style={{ backgroundColor: rim.hex }}
                      />
                      <span className="text-[8px] text-gray-300 mt-1 block truncate">
                        {rim.name.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase text-gray-300 block mb-1.5">
                  Calipers
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {CALIPER_OPTIONS.map((caliper) => (
                    <button
                      key={caliper.name}
                      onClick={() => onChange({ ...customization, caliperColor: caliper.hex })}
                      className={`p-1.5 rounded-lg border text-center transition-all ${
                        customization.caliperColor === caliper.hex
                          ? 'border-[#EF233C] bg-white/10'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full mx-auto border border-white/20"
                        style={{ backgroundColor: caliper.hex }}
                      />
                      <span className="text-[8px] text-gray-300 mt-1 block truncate">
                        {caliper.name.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PERFORMANCE TUNING UPGRADES */}
        {activeTab === 'PERFORMANCE' && (
          <div className="space-y-3.5">
            {/* ECU Tuning Stage */}
            <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  ECU Engine Remap
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  {ecuStage === 2 ? 'Stage 2 Race' : ecuStage === 1 ? 'Stage 1 Street' : 'Stock OEM'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { stage: 0, label: 'Stock', cost: 0, desc: 'Factory boost' },
                  { stage: 1, label: 'Stage 1', cost: 1200, desc: '+20% HP' },
                  { stage: 2, label: 'Stage 2', cost: 3500, desc: '+45% HP + Pops' },
                ].map((item) => (
                  <button
                    key={item.stage}
                    disabled={ecuStage === item.stage}
                    onClick={() => {
                      if (item.cost <= playerCredits || ecuStage > item.stage) {
                        onPurchaseUpgrade(item.cost, { ...customization, ecuStage: item.stage });
                      }
                    }}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      ecuStage === item.stage
                        ? 'border-[#EF233C] bg-white/10 text-white'
                        : 'border-white/10 bg-white/5 hover:border-white/20 text-gray-300'
                    }`}
                  >
                    <span className="text-[10px] font-bold block">{item.label}</span>
                    <span className="text-[8px] text-gray-400 block mt-0.5">{item.desc}</span>
                    <span className="text-[9px] font-mono text-amber-400 font-bold block mt-1">
                      {item.cost === 0 ? 'Free' : `${item.cost} MC`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Suspension Tuning */}
            <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-400" />
                  Chassis Suspension
                </span>
                <span className="text-[10px] font-mono text-blue-400 font-bold">
                  {customization.suspension || 'STOCK'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'STOCK' as SuspensionTune, label: 'Touring', cost: 0, desc: 'Comfort baseline' },
                  { id: 'SPORT' as SuspensionTune, label: 'Sport', cost: 1000, desc: '-20mm Stance' },
                  { id: 'TRACK' as SuspensionTune, label: 'Track', cost: 2800, desc: 'Coilovers + Grip' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.cost <= playerCredits || customization.suspension === item.id) {
                        onPurchaseUpgrade(item.cost, { ...customization, suspension: item.id });
                      }
                    }}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      (customization.suspension || 'STOCK') === item.id
                        ? 'border-[#EF233C] bg-white/10 text-white'
                        : 'border-white/10 bg-white/5 hover:border-white/20 text-gray-300'
                    }`}
                  >
                    <span className="text-[10px] font-bold block">{item.label}</span>
                    <span className="text-[8px] text-gray-400 block mt-0.5">{item.desc}</span>
                    <span className="text-[9px] font-mono text-amber-400 font-bold block mt-1">
                      {item.cost === 0 ? 'Free' : `${item.cost} MC`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Brakes & Tires */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                <span className="text-[11px] font-bold uppercase text-white block mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-red-400" />
                  Brakes
                </span>
                <div className="space-y-1.5">
                  {[
                    { id: 'OEM' as BrakeTune, label: 'Steel OEM', cost: 0 },
                    { id: 'CARBON_CERAMIC' as BrakeTune, label: 'Carbon Ceramic', cost: 1500 },
                  ].map((b) => (
                    <button
                      key={b.id}
                      onClick={() => onPurchaseUpgrade(b.cost, { ...customization, brakes: b.id })}
                      className={`w-full p-1.5 rounded-lg border text-left text-[9px] font-bold transition-all ${
                        (customization.brakes || 'OEM') === b.id
                          ? 'border-[#EF233C] bg-white/10 text-white'
                          : 'border-white/10 bg-white/5 text-gray-400'
                      }`}
                    >
                      <span>{b.label}</span>
                      <span className="block font-mono text-amber-400">{b.cost === 0 ? 'Free' : `${b.cost} MC`}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                <span className="text-[11px] font-bold uppercase text-white block mb-1 flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-emerald-400" />
                  Tires
                </span>
                <div className="space-y-1.5">
                  {[
                    { id: 'ALL_SEASON' as TireTune, label: 'All-Season', cost: 0 },
                    { id: 'SEMI_SLICK' as TireTune, label: 'Semi-Slick GT', cost: 1800 },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onPurchaseUpgrade(t.cost, { ...customization, tires: t.id })}
                      className={`w-full p-1.5 rounded-lg border text-left text-[9px] font-bold transition-all ${
                        (customization.tires || 'ALL_SEASON') === t.id
                          ? 'border-[#EF233C] bg-white/10 text-white'
                          : 'border-white/10 bg-white/5 text-gray-400'
                      }`}
                    >
                      <span>{t.label}</span>
                      <span className="block font-mono text-amber-400">{t.cost === 0 ? 'Free' : `${t.cost} MC`}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Button */}
      <div className="pt-4 mt-4 border-t border-white/10">
        <button
          onClick={onClose}
          className="w-full py-3 bg-[#EF233C] hover:bg-[#d90429] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-xl hover:shadow-[#EF233C]/30"
        >
          Confirm Setup & Drive
        </button>
      </div>
    </div>
  );
};
