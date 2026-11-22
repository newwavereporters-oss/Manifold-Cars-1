import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CarFront,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Car } from '../types';
import { dealerService, PublicDealerRecord } from '../services/dealerService';
import { isPublicMarketplaceCar } from '../services/carService';
import { assignDealerPermalinkSlugs } from '../utils/dealerSlug';

interface DealersDirectoryPageProps {
  cars: Car[];
  navigate: (route: string) => void;
}

export const DealersDirectoryPage: React.FC<DealersDirectoryPageProps> = ({
  cars,
  navigate,
}) => {
  const [dealers, setDealers] = useState<PublicDealerRecord[]>(() =>
    dealerService.getPublicDealersSync()
  );
  const [loading, setLoading] = useState<boolean>(() => dealerService.getPublicDealersSync().length === 0);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [onlyWithStock, setOnlyWithStock] = useState<boolean>(false);

  const loadDirectory = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await dealerService.getPublicDealers();
      setDealers(list);
    } catch (err: any) {
      setError(err?.message || 'Unable to load the dealers directory right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDirectory();
  }, []);

  const publicCars = useMemo(
    () => cars.filter((car) => isPublicMarketplaceCar(car)),
    [cars]
  );

  // Count active vehicles per dealership AND backfill any dealer seen on public cars
  const enrichedDealers = useMemo(() => {
    const carCountByDealerId = new Map<string, number>();
    const fallbackDealerMap = new Map<string, Omit<PublicDealerRecord, 'permalinkSlug'>>();

    for (const car of publicCars) {
      const did = String(car.dealer?.id || '').trim();
      if (!did) continue;
      carCountByDealerId.set(did, (carCountByDealerId.get(did) || 0) + 1);
      if (!fallbackDealerMap.has(did) && car.dealer?.name) {
        fallbackDealerMap.set(did, {
          id: did,
          name: car.dealer.name,
          city: car.dealer.city || 'Lagos',
          state: car.dealer.state || 'Lagos',
          verified_partner: Boolean(car.dealer.verified_partner),
          joined_year: car.dealer.joined_year || 2024,
        });
      }
    }

    const mergedMap = new Map<string, Omit<PublicDealerRecord, 'permalinkSlug'>>();
    for (const d of dealers) {
      mergedMap.set(String(d.id), {
        id: d.id,
        name: d.name,
        slug: d.slug,
        city: d.city,
        state: d.state,
        verified_partner: d.verified_partner,
        dealer_status: d.dealer_status,
        joined_year: d.joined_year,
      });
    }
    for (const [did, fallback] of fallbackDealerMap.entries()) {
      if (!mergedMap.has(did)) {
        mergedMap.set(did, fallback);
      }
    }

    const withPermalinks = assignDealerPermalinkSlugs(Array.from(mergedMap.values()));

    return withPermalinks
      .map((d) => ({
        ...d,
        carCount: carCountByDealerId.get(String(d.id)) || 0,
      }))
      .sort((a, b) => {
        if (b.carCount !== a.carCount) return b.carCount - a.carCount;
        return a.name.localeCompare(b.name);
      });
  }, [dealers, publicCars]);

  const availableStates = useMemo(() => {
    const states = new Set<string>();
    enrichedDealers.forEach((d) => {
      if (d.state) states.add(d.state.trim());
    });
    return ['ALL', ...Array.from(states).sort((a, b) => a.localeCompare(b))];
  }, [enrichedDealers]);

  const filteredDealers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedDealers.filter((dealer) => {
      if (onlyWithStock && dealer.carCount === 0) return false;
      if (
        selectedState !== 'ALL' &&
        dealer.state.trim().toLowerCase() !== selectedState.trim().toLowerCase()
      ) {
        return false;
      }
      if (q) {
        const matchName = dealer.name.toLowerCase().includes(q);
        const matchCity = dealer.city.toLowerCase().includes(q);
        const matchState = dealer.state.toLowerCase().includes(q);
        if (!matchName && !matchCity && !matchState) return false;
      }
      return true;
    });
  }, [enrichedDealers, searchQuery, selectedState, onlyWithStock]);

  return (
    <div className="min-h-screen bg-[#F7F8FA] pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Breadcrumb & Header */}
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            <button onClick={() => navigate('/')} className="hover:text-gray-900 cursor-pointer">
              Home
            </button>
            <span>/</span>
            <span className="text-gray-900 font-medium">Dealers</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#071A2B] tracking-tight font-display uppercase">
                Dealers Directory
              </h1>
              <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                Explore listed and registered dealerships on MANIFOLD. Select any dealership to view
                its dedicated vehicle showroom.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => navigate('/cars')}
                className="px-4 py-2.5 bg-white hover:bg-gray-50 text-[#071A2B] border border-gray-200 rounded-lg text-xs font-bold uppercase tracking-wider transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                Browse All Cars
              </button>
              <button
                type="button"
                onClick={() => navigate('/dealer/register')}
                className="px-4 py-2.5 bg-[#EF233C] hover:bg-[#d91b32] text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                List Your Dealership
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dealerships by business name, city, or state..."
                className="w-full h-11 pl-9 pr-9 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                aria-label="Filter by state"
                className="h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:bg-white focus:border-[#071A2B] outline-none cursor-pointer"
              >
                {availableStates.map((st) => (
                  <option key={st} value={st}>
                    {st === 'ALL' ? 'All States' : st}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setOnlyWithStock((prev) => !prev)}
                className={`h-11 px-3.5 rounded-lg border text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  onlyWithStock
                    ? 'bg-[#071A2B] text-white border-[#071A2B]'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                With Live Cars Only
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
            <span className="font-semibold text-gray-700 tabular-nums">
              {filteredDealers.length} {filteredDealers.length === 1 ? 'dealership' : 'dealerships'}
            </span>
            <span>All customer enquiries handled securely through MANIFOLD Concierge</span>
          </div>
        </div>

        {/* Directory Content */}
        {loading && enrichedDealers.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-9 bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : error && enrichedDealers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center space-y-4 shadow-sm">
            <Building2 className="w-10 h-10 text-[#EF233C] mx-auto" />
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#071A2B]">Unable to Load Dealers</h2>
              <p className="text-xs text-gray-500 max-w-md mx-auto">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadDirectory()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#071A2B] hover:bg-[#0B2239] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredDealers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center space-y-3 shadow-sm">
            <Building2 className="w-10 h-10 text-gray-400 mx-auto" />
            <h3 className="text-lg font-bold text-[#071A2B]">No Dealerships Found</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Try clearing your search or switching your state filter to see more dealerships.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedState('ALL');
                setOnlyWithStock(false);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDealers.map((dealer) => {
              const initials = dealer.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() || '')
                .join('') || 'MD';

              return (
                <button
                  key={dealer.id}
                  type="button"
                  onClick={() => navigate(`/${dealer.permalinkSlug}`)}
                  className="group bg-white rounded-xl border border-gray-200 hover:border-[#071A2B]/40 hover:shadow-lg transition-all duration-200 p-5 text-left flex flex-col justify-between gap-4 cursor-pointer"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-lg bg-[#071A2B] text-white font-display font-extrabold text-sm flex items-center justify-center shrink-0 group-hover:bg-[#EF233C] transition-colors">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-bold text-base text-[#071A2B] group-hover:text-[#EF233C] transition-colors leading-snug line-clamp-2">
                            {dealer.name}
                          </h2>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="truncate">
                              {[dealer.city, dealer.state].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-600 pt-1">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#071A2B] tabular-nums">
                        <CarFront className="w-3.5 h-3.5 text-[#EF233C]" />
                        {dealer.carCount} {dealer.carCount === 1 ? 'Car' : 'Cars'} Listed
                      </span>
                      <span aria-hidden="true" className="text-gray-300">·</span>
                      {dealer.verified_partner ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Verified
                        </span>
                      ) : (
                        <span className="text-gray-500 font-medium">Registered Dealer</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
                    <span className="text-gray-400 font-mono truncate">
                      /{dealer.permalinkSlug}
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-[#071A2B] group-hover:text-[#EF233C] uppercase tracking-wider whitespace-nowrap shrink-0">
                      <span>View Cars</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
