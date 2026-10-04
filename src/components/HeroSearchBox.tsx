import React, { useState } from 'react';
import { Search, SlidersHorizontal, ChevronDown, CheckCircle2 } from 'lucide-react';
import { CAR_BRANDS, NIGERIAN_LOCATIONS, PRICE_OPTIONS } from '../data/brandsAndTypes';

interface HeroSearchBoxProps {
  onSearch: (filters: {
    make: string;
    model: string;
    location: string;
    minPrice: number | '';
    maxPrice: number | '';
  }) => void;
  onOpenAdvancedSearch: () => void;
  navigate: (route: string) => void;
}

export const HeroSearchBox: React.FC<HeroSearchBoxProps> = ({
  onSearch,
  onOpenAdvancedSearch,
  navigate,
}) => {
  const [activeTab, setActiveTab] = useState<'buy' | 'hunt' | 'sell'>('buy');
  const [selectedMake, setSelectedMake] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');

  const currentBrand = CAR_BRANDS.find((b) => b.name === selectedMake);
  const availableModels = currentBrand ? currentBrand.popular_models : [];

  const handleMakeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMake(e.target.value);
    setSelectedModel('');
  };

  const handlePrimaryAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'buy') {
      onSearch({
        make: selectedMake,
        model: selectedModel,
        location: selectedLocation === 'All Locations' ? '' : selectedLocation,
        minPrice,
        maxPrice,
      });
    } else if (activeTab === 'hunt') {
      navigate('/car-hunt');
    } else if (activeTab === 'sell') {
      navigate('/sell-a-car');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden transform -translate-y-6 md:-translate-y-12 relative z-20">
      {/* Top Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50/70">
        <button
          type="button"
          onClick={() => setActiveTab('buy')}
          className={`flex-1 sm:flex-none px-6 py-3.5 text-xs sm:text-sm font-bold tracking-wider uppercase transition-colors relative ${
            activeTab === 'buy'
              ? 'text-[#071A2B] bg-white border-r border-gray-200'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
          }`}
        >
          <span>Buy a Car</span>
          {activeTab === 'buy' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#EF233C]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hunt')}
          className={`flex-1 sm:flex-none px-6 py-3.5 text-xs sm:text-sm font-bold tracking-wider uppercase transition-colors relative ${
            activeTab === 'hunt'
              ? 'text-[#071A2B] bg-white border-x border-gray-200'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
          }`}
        >
          <span>Car Hunt (Let Us Find)</span>
          {activeTab === 'hunt' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#EF233C]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sell')}
          className={`flex-1 sm:flex-none px-6 py-3.5 text-xs sm:text-sm font-bold tracking-wider uppercase transition-colors relative ${
            activeTab === 'sell'
              ? 'text-[#071A2B] bg-white border-l border-gray-200'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
          }`}
        >
          <span>Sell a Car</span>
          {activeTab === 'sell' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#EF233C]" />
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 lg:p-7">
        {activeTab === 'buy' ? (
          <form onSubmit={handlePrimaryAction}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
              {/* Make */}
              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Make
                </label>
                <div className="relative">
                  <select
                    value={selectedMake}
                    onChange={handleMakeChange}
                    className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] focus:ring-1 focus:ring-[#071A2B] outline-none transition appearance-none cursor-pointer"
                  >
                    <option value="">Any Make</option>
                    {CAR_BRANDS.map((brand) => (
                      <option key={brand.id} value={brand.name}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Model */}
              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Model
                </label>
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={!selectedMake}
                    className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] focus:ring-1 focus:ring-[#071A2B] outline-none transition appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">{selectedMake ? 'Any Model' : 'Select Make First'}</option>
                    {availableModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Location */}
              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Location
                </label>
                <div className="relative">
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] focus:ring-1 focus:ring-[#071A2B] outline-none transition appearance-none cursor-pointer"
                  >
                    <option value="">Any Location</option>
                    {NIGERIAN_LOCATIONS.filter((l) => l !== 'All Locations').map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Price Range: Min & Max */}
              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Max Price
                </label>
                <div className="relative">
                  <select
                    value={maxPrice}
                    onChange={(e) =>
                      setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] focus:ring-1 focus:ring-[#071A2B] outline-none transition appearance-none cursor-pointer"
                  >
                    <option value="">Any Price</option>
                    <option value="20000000">Up to ₦20,000,000</option>
                    <option value="30000000">Up to ₦30,000,000</option>
                    <option value="40000000">Up to ₦40,000,000</option>
                    <option value="60000000">Up to ₦60,000,000</option>
                    <option value="80000000">Up to ₦80,000,000</option>
                    <option value="150000000">Up to ₦150,000,000</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Search Button (Red) */}
              <button
                type="submit"
                className="w-full h-11 bg-[#EF233C] hover:bg-[#d91b32] text-white text-sm font-bold uppercase tracking-wider rounded flex items-center justify-center gap-2 shadow-sm hover:shadow-red-500/20 transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Search className="w-4 h-4" />
                <span>Search Cars</span>
              </button>
            </div>

            {/* Bottom Row: Advanced Search trigger */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={onOpenAdvancedSearch}
                className="inline-flex items-center gap-1.5 text-gray-600 hover:text-[#071A2B] font-semibold transition-colors group cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#EF233C] group-hover:rotate-45 transition-transform" />
                <span>Advanced Search (Body type, Year, Mileage, Transmission)</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:translate-y-0.5 transition-transform" />
              </button>

              <div className="hidden sm:flex items-center gap-2 text-gray-400">
                <span>Over 12,400+ verified vehicles reviewed across Lagos & Abuja</span>
              </div>
            </div>
          </form>
        ) : activeTab === 'hunt' ? (
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-2">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#071A2B] font-display">
                Can't find your specific dream car?
              </h3>
              <p className="text-sm text-gray-600 max-w-xl">
                Tell MANIFOLD your exact specs, trim, and budget. Our physical field inspection
                agents will source, inspect, and present direct video walkarounds from verified
                dealers.
              </p>
            </div>
            <button
              onClick={() => navigate('/car-hunt')}
              className="w-full md:w-auto px-6 py-3 bg-[#EF233C] hover:bg-[#d91b32] text-white font-bold text-xs uppercase tracking-wider rounded shadow transition-all whitespace-nowrap"
            >
              Start a Car Hunt Request →
            </button>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-2">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#071A2B] font-display">
                Sell your car with MANIFOLD concierge verification
              </h3>
              <p className="text-sm text-gray-600 max-w-xl">
                Get an objective physical inspection, professional video review production, and
                direct access to serious buyers without receiving 100 nuisance phone calls.
              </p>
            </div>
            <button
              onClick={() => navigate('/sell-a-car')}
              className="w-full md:w-auto px-6 py-3 bg-[#071A2B] hover:bg-[#0B2239] text-white font-bold text-xs uppercase tracking-wider rounded shadow transition-all whitespace-nowrap"
            >
              List with MANIFOLD →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
