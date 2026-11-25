import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, RotateCcw, Compass, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import { VideoCarCard } from '../components/VideoCarCard';
import { BodyTypeCategory, Car, CarBrand, FilterState } from '../types';
import { BODY_TYPES, NIGERIAN_LOCATIONS } from '../data/brandsAndTypes';
import { brandService } from '../services/brandService';
import { categoryService } from '../services/categoryService';
import { modelService } from '../services/modelService';
import { carService, CarServiceLoadState } from '../services/carService';
import { VehicleIntelligenceSearchBar } from '../components/ai/VehicleIntelligenceSearchBar';

interface ListingsPageProps {
  cars: Car[];
  favorites: string[];
  onToggleFavorite: (carId: string) => void;
  onSelectCar: (car: Car) => void;
  onPlayVideo: (car: Car) => void;
  onInterested: (car: Car) => void;
  navigate: (route: string) => void;
  initialFilters?: Partial<FilterState>;
  initialAiQuery?: string;
}

export const ListingsPage: React.FC<ListingsPageProps> = ({
  cars,
  favorites,
  onToggleFavorite,
  onSelectCar,
  onPlayVideo,
  onInterested,
  navigate,
  initialFilters,
  initialAiQuery,
}) => {
  const [filters, setFilters] = useState<FilterState>({
    make: initialFilters?.make || '',
    model: initialFilters?.model || '',
    location: initialFilters?.location || '',
    minPrice: initialFilters?.minPrice ?? '',
    maxPrice: initialFilters?.maxPrice ?? '',
    yearFrom: initialFilters?.yearFrom ?? '',
    yearTo: initialFilters?.yearTo ?? '',
    bodyType: initialFilters?.bodyType || '',
    condition: initialFilters?.condition || '',
    transmission: initialFilters?.transmission || '',
    fuelType: initialFilters?.fuelType || '',
    driveType: initialFilters?.driveType || '',
    maxMileage: initialFilters?.maxMileage ?? '',
    searchQuery: initialFilters?.searchQuery || '',
  });

  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'views' | 'featured'>('newest');
  const [visibleCount, setVisibleCount] = useState<number>(9);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [brands, setBrands] = useState<CarBrand[]>(() =>
    brandService.getBrandsSync().filter((b) => b.is_active !== false)
  );
  const [bodyTypes, setBodyTypes] = useState<BodyTypeCategory[]>(() => {
    const syncTypes = categoryService.getBodyTypesSync().filter((t) => t.is_active !== false);
    return syncTypes.length > 0 ? syncTypes : (BODY_TYPES as unknown as BodyTypeCategory[]);
  });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadState, setLoadState] = useState<CarServiceLoadState>(() => carService.getLoadState());

  useEffect(() => {
    const unsubLoad = carService.subscribeLoadState((state) => {
      setLoadState(state);
    });
    if (!carService.getLoadState().hasLoaded || cars.length === 0) {
      carService.getCars().catch(() => {});
    }
    return () => unsubLoad();
  }, []);

  useEffect(() => {
    let mounted = true;
    brandService
      .getActiveBrands()
      .then((data) => {
        if (mounted) setBrands(data);
      })
      .catch(() => {});
    categoryService
      .getActiveBodyTypes()
      .then((data) => {
        if (mounted && data.length > 0) setBodyTypes(data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!filters.make) {
      setAvailableModels([]);
      return;
    }

    const selectedBrandObj = brands.find((b) => b.name === filters.make);
    modelService
      .getModelsByBrand(filters.make)
      .then((list) => {
        if (mounted) {
          setAvailableModels(
            list.length > 0 ? list : selectedBrandObj?.popular_models || []
          );
        }
      })
      .catch(() => {
        if (mounted) {
          setAvailableModels(selectedBrandObj?.popular_models || []);
        }
      });

    return () => {
      mounted = false;
    };
  }, [filters.make, brands]);

  // Update filter helper
  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearAllFilters = () => {
    setFilters({
      make: '',
      model: '',
      location: '',
      minPrice: '',
      maxPrice: '',
      yearFrom: '',
      yearTo: '',
      bodyType: '',
      condition: '',
      transmission: '',
      fuelType: '',
      driveType: '',
      maxMileage: '',
      searchQuery: '',
    });
  };

  // Filter and sort computation
  const filteredCars = useMemo(() => {
    return cars.filter((car) => {
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const matches =
          car.title.toLowerCase().includes(q) ||
          car.make.toLowerCase().includes(q) ||
          car.model.toLowerCase().includes(q) ||
          car.location.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (filters.make && car.make !== filters.make) return false;
      if (filters.model && car.model !== filters.model) return false;
      if (filters.location && !car.location.toLowerCase().includes(filters.location.toLowerCase()))
        return false;
      if (filters.minPrice !== '' && car.price < Number(filters.minPrice)) return false;
      if (filters.maxPrice !== '' && car.price > Number(filters.maxPrice)) return false;
      if (filters.yearFrom !== '' && car.year < Number(filters.yearFrom)) return false;
      if (filters.yearTo !== '' && car.year > Number(filters.yearTo)) return false;
      if (
        filters.bodyType &&
        (car.body_type || '').trim().toLowerCase() !== filters.bodyType.trim().toLowerCase()
      ) {
        return false;
      }
      if (filters.condition && car.condition !== filters.condition) return false;
      if (filters.transmission && car.transmission !== filters.transmission) return false;
      if (filters.fuelType && car.fuel_type !== filters.fuelType) return false;
      if (filters.maxMileage !== '' && car.mileage > Number(filters.maxMileage)) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'views') return b.views_count - a.views_count;
      if (sortBy === 'featured') return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
      return 0;
    });
  }, [cars, filters, sortBy]);

  const activeChips: { key: keyof FilterState; label: string }[] = [];
  if (filters.make) activeChips.push({ key: 'make', label: `Make: ${filters.make}` });
  if (filters.model) activeChips.push({ key: 'model', label: `Model: ${filters.model}` });
  if (filters.bodyType) activeChips.push({ key: 'bodyType', label: `Type: ${filters.bodyType}` });
  if (filters.condition) activeChips.push({ key: 'condition', label: filters.condition });
  if (filters.location) activeChips.push({ key: 'location', label: filters.location });
  if (filters.transmission) activeChips.push({ key: 'transmission', label: filters.transmission });
  if (filters.fuelType) activeChips.push({ key: 'fuelType', label: filters.fuelType });
  if (filters.minPrice !== '' || filters.maxPrice !== '') {
    const minText = filters.minPrice ? `₦${(Number(filters.minPrice) / 1000000).toFixed(0)}m` : '₦0';
    const maxText = filters.maxPrice ? `₦${(Number(filters.maxPrice) / 1000000).toFixed(0)}m` : 'Any';
    activeChips.push({ key: 'maxPrice', label: `${minText} – ${maxText}` });
  }

  // Models are dynamically fetched via modelService effect above

  return (
    <div className="min-h-screen bg-[#F7F8FA] pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Breadcrumbs & Title */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            <button onClick={() => navigate('/')} className="hover:text-gray-900">
              Home
            </button>
            <span>/</span>
            <span className="text-gray-900 font-medium">Cars</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#071A2B] tracking-tight font-display uppercase">
            Find Your Next Car
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Browse verified vehicles with real video reviews. No direct dealer contact required.
          </p>
        </div>

        {/* MANIFOLD Vehicle Intelligence Natural-Language & Voice Search */}
        <VehicleIntelligenceSearchBar
          initialQuery={initialAiQuery}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          onSelectCar={onSelectCar}
          onPlayVideo={onPlayVideo}
          onInterested={onInterested}
          navigate={navigate}
        />

        {/* Top Search & Filter Bar */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => updateFilter('searchQuery', e.target.value)}
              placeholder="Search make, model, trim or location (e.g. Prado, Lekki, AMG)..."
              className="w-full h-11 pl-9 pr-9 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            />
            {filters.searchQuery && (
              <button
                type="button"
                onClick={() => updateFilter('searchQuery', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between md:justify-end gap-2.5 sm:gap-3">
            {/* Mobile Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden h-11 inline-flex items-center gap-1.5 px-3.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Filter className="w-4 h-4" />
              <span>Filters{activeChips.length > 0 ? ` (${activeChips.length})` : ''}</span>
            </button>

            {/* Results Counter */}
            <span className="text-xs font-semibold text-gray-600 tabular-nums whitespace-nowrap">
              {filteredCars.length} {filteredCars.length === 1 ? 'car' : 'cars'} found
            </span>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 hidden sm:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Sort vehicles"
                className="h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:bg-white focus:border-[#071A2B] outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="views">Most Viewed</option>
                <option value="featured">Featured First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeChips.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 mr-1">Active filters:</span>
            {activeChips.map((chip, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 text-gray-800 text-xs px-2.5 py-1 rounded-full font-medium"
              >
                <span>{chip.label}</span>
                <button
                  onClick={() => updateFilter(chip.key, '')}
                  className="hover:text-[#EF233C]"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={clearAllFilters}
              className="text-xs font-bold text-[#EF233C] hover:underline ml-2"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Main Content Layout: Sidebar + Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block lg:col-span-1 space-y-6 bg-white p-5 rounded-xl border border-gray-200 self-start shadow-sm sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#071A2B]">
                Filter Inventory
              </span>
              <button
                onClick={clearAllFilters}
                className="text-xs text-gray-400 hover:text-[#EF233C] flex items-center gap-1 transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            {/* Make */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                Make
              </label>
              <select
                value={filters.make}
                onChange={(e) => {
                  updateFilter('make', e.target.value);
                  updateFilter('model', '');
                }}
                className="w-full h-9 px-2.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-800 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="">All Makes</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name} ({b.car_count ?? 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                Model
              </label>
              <select
                value={filters.model}
                onChange={(e) => updateFilter('model', e.target.value)}
                disabled={!filters.make}
                className="w-full h-9 px-2.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-800 font-medium focus:bg-white focus:border-[#071A2B] outline-none disabled:opacity-50"
              >
                <option value="">{filters.make ? 'All Models' : 'Select Make First'}</option>
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Body Type */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                Body Type
              </label>
              <select
                value={filters.bodyType}
                onChange={(e) => updateFilter('bodyType', e.target.value)}
                className="w-full h-9 px-2.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-800 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="">All Body Types</option>
                {bodyTypes.map((bt) => (
                  <option key={bt.id} value={bt.name}>
                    {bt.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Condition */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                Condition
              </label>
              <select
                value={filters.condition}
                onChange={(e) => updateFilter('condition', e.target.value)}
                className="w-full h-9 px-2.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-800 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="">Any Condition</option>
                <option value="Foreign Used">Foreign Used (Tokunbo)</option>
                <option value="Brand New">Brand New</option>
                <option value="Nigerian Used">Nigerian Used</option>
              </select>
            </div>

            {/* Max Price */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                Max Price
              </label>
              <select
                value={filters.maxPrice}
                onChange={(e) =>
                  updateFilter('maxPrice', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full h-9 px-2.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-800 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="">Any Price</option>
                <option value="20000000">Up to ₦20,000,000</option>
                <option value="30000000">Up to ₦30,000,000</option>
                <option value="40000000">Up to ₦40,000,000</option>
                <option value="60000000">Up to ₦60,000,000</option>
                <option value="80000000">Up to ₦80,000,000</option>
                <option value="150000000">Up to ₦150,000,000</option>
              </select>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                Location
              </label>
              <select
                value={filters.location}
                onChange={(e) => updateFilter('location', e.target.value)}
                className="w-full h-9 px-2.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-800 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="">All Locations</option>
                {NIGERIAN_LOCATIONS.filter((l) => l !== 'All Locations').map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Transmission & Fuel */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">
                  Gearbox
                </label>
                <select
                  value={filters.transmission}
                  onChange={(e) => updateFilter('transmission', e.target.value)}
                  className="w-full h-8 px-2 bg-gray-50 border border-gray-200 rounded text-[11px]"
                >
                  <option value="">Any</option>
                  <option value="Automatic">Auto</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">
                  Fuel
                </label>
                <select
                  value={filters.fuelType}
                  onChange={(e) => updateFilter('fuelType', e.target.value)}
                  className="w-full h-8 px-2 bg-gray-50 border border-gray-200 rounded text-[11px]"
                >
                  <option value="">Any</option>
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>
            </div>
          </aside>

          {/* Right: Video-First Vehicle Grid */}
          <div className="lg:col-span-3 space-y-8">
            {loadState.error && cars.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3 text-xs text-red-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loadState.error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void carService.getCars().catch(() => {})}
                  className="px-3 py-1.5 rounded-lg bg-white border border-red-200 font-bold hover:bg-red-100 shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {loadState.loading && cars.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse"
                  >
                    <div className="aspect-[16/9] bg-gray-200" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                      <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                        <div className="h-5 bg-gray-200 rounded w-1/3" />
                        <div className="h-9 bg-gray-200 rounded w-1/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : loadState.error && cars.length === 0 ? (
              <div className="bg-white rounded-xl border border-red-200 p-8 sm:p-10 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 rounded-full bg-red-50 text-[#EF233C] mx-auto flex items-center justify-center">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-[#071A2B] font-display">
                  Unable to Load Live Inventory
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
                  {loadState.error}
                </p>
                <button
                  type="button"
                  onClick={() => void carService.getCars().catch(() => {})}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#071A2B] hover:bg-[#0B2239] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Loading Cars</span>
                </button>
              </div>
            ) : cars.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 sm:p-12 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-red-50 text-[#EF233C] mx-auto flex items-center justify-center">
                  <Compass className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-[#071A2B] font-display">
                  No public vehicles available yet.
                </h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  No public listings were returned from inventory. Refresh inventory or submit a
                  Car Hunt request and our team will source a verified vehicle for you.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => void carService.getCars().catch(() => {})}
                    className="inline-flex items-center gap-1.5 h-10 px-4 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 whitespace-nowrap cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh Inventory</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/car-hunt')}
                    className="h-10 px-5 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow whitespace-nowrap cursor-pointer"
                  >
                    Start a Car Hunt
                  </button>
                </div>
              </div>
            ) : filteredCars.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 sm:p-12 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-red-50 text-[#EF233C] mx-auto flex items-center justify-center">
                  <Compass className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-[#071A2B] font-display">
                  No cars match your search.
                </h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  Try changing your filters or let MANIFOLD source and physically inspect one for you
                  from our verified dealer network.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="h-10 px-4 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 whitespace-nowrap cursor-pointer"
                  >
                    Reset Filters
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/car-hunt')}
                    className="h-10 px-5 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow whitespace-nowrap cursor-pointer"
                  >
                    Start a Car Hunt
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
                  {filteredCars.slice(0, visibleCount).map((car) => (
                    <VideoCarCard
                      key={car.id}
                      car={car}
                      isFavorite={favorites.includes(car.id)}
                      onToggleFavorite={onToggleFavorite}
                      onSelectCar={onSelectCar}
                      onPlayVideo={onPlayVideo}
                      onInterested={onInterested}
                    />
                  ))}
                </div>

                {/* Load More Button */}
                {visibleCount < filteredCars.length && (
                  <div className="text-center pt-4">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 6)}
                      className="px-8 py-3 bg-white hover:bg-gray-50 text-[#071A2B] text-xs font-bold uppercase tracking-wider rounded-lg border border-gray-300 shadow-sm transition cursor-pointer"
                    >
                      Load More Vehicles ({filteredCars.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Slide-Over Drawer (Full parity with Desktop filters) */}
      {mobileFilterOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden flex justify-end"
          onClick={() => setMobileFilterOpen(false)}
        >
          <div
            className="w-full max-w-xs sm:max-w-sm bg-white h-full overflow-y-auto p-5 space-y-5 shadow-2xl flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <span className="font-bold text-sm text-[#071A2B] uppercase">Filter Cars</span>
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  className="p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100"
                  aria-label="Close filters"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Make</label>
                  <select
                    value={filters.make}
                    onChange={(e) => {
                      updateFilter('make', e.target.value);
                      updateFilter('model', '');
                    }}
                    className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  >
                    <option value="">All Makes</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name} ({b.car_count ?? 0})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Model</label>
                  <select
                    value={filters.model}
                    onChange={(e) => updateFilter('model', e.target.value)}
                    disabled={!filters.make}
                    className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs disabled:opacity-50"
                  >
                    <option value="">{filters.make ? 'All Models' : 'Select Make First'}</option>
                    {availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Body Type</label>
                  <select
                    value={filters.bodyType}
                    onChange={(e) => updateFilter('bodyType', e.target.value)}
                    className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  >
                    <option value="">All Types</option>
                    {bodyTypes.map((bt) => (
                      <option key={bt.id} value={bt.name}>
                        {bt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Condition</label>
                  <select
                    value={filters.condition}
                    onChange={(e) => updateFilter('condition', e.target.value)}
                    className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  >
                    <option value="">Any Condition</option>
                    <option value="Foreign Used">Foreign Used (Tokunbo)</option>
                    <option value="Brand New">Brand New</option>
                    <option value="Nigerian Used">Nigerian Used</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Max Price</label>
                  <select
                    value={filters.maxPrice}
                    onChange={(e) =>
                      updateFilter('maxPrice', e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  >
                    <option value="">Any Price</option>
                    <option value="20000000">Up to ₦20,000,000</option>
                    <option value="30000000">Up to ₦30,000,000</option>
                    <option value="40000000">Up to ₦40,000,000</option>
                    <option value="60000000">Up to ₦60,000,000</option>
                    <option value="80000000">Up to ₦80,000,000</option>
                    <option value="150000000">Up to ₦150,000,000</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-600 block mb-1">Location</label>
                  <select
                    value={filters.location}
                    onChange={(e) => updateFilter('location', e.target.value)}
                    className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  >
                    <option value="">All Locations</option>
                    {NIGERIAN_LOCATIONS.filter((l) => l !== 'All Locations').map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="font-bold text-gray-600 block mb-1">Gearbox</label>
                    <select
                      value={filters.transmission}
                      onChange={(e) => updateFilter('transmission', e.target.value)}
                      className="w-full h-11 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                    >
                      <option value="">Any</option>
                      <option value="Automatic">Automatic</option>
                      <option value="Manual">Manual</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-gray-600 block mb-1">Fuel</label>
                    <select
                      value={filters.fuelType}
                      onChange={(e) => updateFilter('fuelType', e.target.value)}
                      className="w-full h-11 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                    >
                      <option value="">Any</option>
                      <option value="Petrol">Petrol</option>
                      <option value="Diesel">Diesel</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 flex gap-2.5 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex-1 h-11 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="flex-1 h-11 bg-[#EF233C] text-white rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Apply ({filteredCars.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
