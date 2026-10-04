import React from 'react';
import { X, RotateCcw, Check, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { CAR_BRANDS, BODY_TYPES, NIGERIAN_LOCATIONS, PRICE_OPTIONS } from '../data/brandsAndTypes';
import { FilterState } from '../types';

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: any) => void;
  onResetFilters: () => void;
  totalMatchingCars: number;
  onApply: () => void;
}

export const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onResetFilters,
  totalMatchingCars,
  onApply,
}) => {
  if (!isOpen) return null;

  const currentBrand = CAR_BRANDS.find((b) => b.name === filters.make);
  const models = currentBrand ? currentBrand.popular_models : [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-gray-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#071A2B] text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-[#EF233C]" />
            <h3 className="text-base font-bold font-display uppercase tracking-wide">
              Advanced Vehicle Search
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Filters Form */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Make & Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1.5">
                Make
              </label>
              <select
                value={filters.make}
                onChange={(e) => {
                  onFilterChange('make', e.target.value);
                  onFilterChange('model', '');
                }}
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="">Any Make</option>
                {CAR_BRANDS.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1.5">
                Model
              </label>
              <select
                value={filters.model}
                onChange={(e) => onFilterChange('model', e.target.value)}
                disabled={!filters.make}
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none disabled:opacity-50"
              >
                <option value="">{filters.make ? 'Any Model' : 'Select Make First'}</option>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Price Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1.5">
                Min Price
              </label>
              <select
                value={filters.minPrice}
                onChange={(e) =>
                  onFilterChange('minPrice', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="">No Minimum</option>
                <option value="15000000">₦15,000,000</option>
                <option value="20000000">₦20,000,000</option>
                <option value="30000000">₦30,000,000</option>
                <option value="50000000">₦50,000,000</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1.5">
                Max Price
              </label>
              <select
                value={filters.maxPrice}
                onChange={(e) =>
                  onFilterChange('maxPrice', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="">No Maximum</option>
                <option value="25000000">₦25,000,000</option>
                <option value="40000000">₦40,000,000</option>
                <option value="75000000">₦75,000,000</option>
                <option value="150000000">₦150,000,000</option>
              </select>
            </div>
          </div>

          {/* Year Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1.5">
                Year From
              </label>
              <select
                value={filters.yearFrom}
                onChange={(e) =>
                  onFilterChange('yearFrom', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="">Any Year</option>
                {[2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1.5">
                Year To
              </label>
              <select
                value={filters.yearTo}
                onChange={(e) =>
                  onFilterChange('yearTo', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="">Any Year</option>
                {[2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Body Type & Condition */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1.5">
                Body Type
              </label>
              <select
                value={filters.bodyType}
                onChange={(e) => onFilterChange('bodyType', e.target.value)}
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="">All Body Types</option>
                {BODY_TYPES.map((bt) => (
                  <option key={bt.id} value={bt.name}>
                    {bt.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1.5">
                Condition
              </label>
              <select
                value={filters.condition}
                onChange={(e) => onFilterChange('condition', e.target.value)}
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="">Any Condition</option>
                <option value="Foreign Used">Foreign Used (Tokunbo)</option>
                <option value="Brand New">Brand New</option>
                <option value="Nigerian Used">Nigerian Used</option>
              </select>
            </div>
          </div>

          {/* Transmission & Fuel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1.5">
                Transmission
              </label>
              <select
                value={filters.transmission}
                onChange={(e) => onFilterChange('transmission', e.target.value)}
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="">Any</option>
                <option value="Automatic">Automatic</option>
                <option value="Manual">Manual</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1.5">
                Fuel Type
              </label>
              <select
                value={filters.fuelType}
                onChange={(e) => onFilterChange('fuelType', e.target.value)}
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="">Any</option>
                <option value="Petrol">Petrol</option>
                <option value="Diesel">Diesel</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Electric">Electric</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1.5">
                Location
              </label>
              <select
                value={filters.location}
                onChange={(e) => onFilterChange('location', e.target.value)}
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="">Any Location</option>
                {NIGERIAN_LOCATIONS.filter((l) => l !== 'All Locations').map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
          <button
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-[#EF233C] transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-700 tabular-nums">
              {totalMatchingCars} cars found
            </span>

            <button
              onClick={() => {
                onApply();
                onClose();
              }}
              className="px-6 py-2.5 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded shadow transition"
            >
              Show Cars
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
