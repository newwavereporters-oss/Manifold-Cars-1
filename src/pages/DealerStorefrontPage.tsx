import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CarFront,
  Check,
  Compass,
  MapPin,
  PhoneCall,
  Search,
  Share2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Car } from '../types';
import { VideoCarCard } from '../components/VideoCarCard';
import { dealerService, PublicDealerRecord } from '../services/dealerService';
import { isPublicMarketplaceCar } from '../services/carService';
import {
  assignDealerPermalinkSlugs,
  resolveDealerByPermalinkSlug,
  slugifyBusinessName,
} from '../utils/dealerSlug';

interface DealerStorefrontPageProps {
  dealerSlug: string;
  cars: Car[];
  favorites: string[];
  onToggleFavorite: (carId: string) => void;
  onSelectCar: (car: Car) => void;
  onPlayVideo: (car: Car) => void;
  onInterested: (car?: Car) => void;
  navigate: (route: string) => void;
}

export const DealerStorefrontPage: React.FC<DealerStorefrontPageProps> = ({
  dealerSlug,
  cars,
  favorites,
  onToggleFavorite,
  onSelectCar,
  onPlayVideo,
  onInterested,
  navigate,
}) => {
  const [dealers, setDealers] = useState<PublicDealerRecord[]>(() =>
    dealerService.getPublicDealersSync()
  );
  const [loadingDealers, setLoadingDealers] = useState<boolean>(
    () => dealerService.getPublicDealersSync().length === 0
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoadingDealers(dealers.length === 0);
    dealerService
      .getPublicDealers()
      .then((list) => {
        if (mounted) {
          setDealers(list);
          setLoadingDealers(false);
        }
      })
      .catch(() => {
        if (mounted) setLoadingDealers(false);
      });
    return () => {
      mounted = false;
    };
  }, [dealerSlug]);

  const publicCars = useMemo(
    () => cars.filter((car) => isPublicMarketplaceCar(car)),
    [cars]
  );

  // Merge dealers from public.dealers plus any dealer info attached to public cars
  const allResolvableDealers = useMemo(() => {
    const map = new Map<string, Omit<PublicDealerRecord, 'permalinkSlug'>>();
    for (const d of dealers) {
      map.set(String(d.id), {
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
    for (const car of publicCars) {
      const did = String(car.dealer?.id || '').trim();
      if (did && !map.has(did) && car.dealer?.name) {
        map.set(did, {
          id: did,
          name: car.dealer.name,
          city: car.dealer.city || 'Lagos',
          state: car.dealer.state || 'Lagos',
          verified_partner: Boolean(car.dealer.verified_partner),
          joined_year: car.dealer.joined_year || 2024,
        });
      }
    }
    return assignDealerPermalinkSlugs(Array.from(map.values()));
  }, [dealers, publicCars]);

  const resolvedDealer = useMemo(
    () => resolveDealerByPermalinkSlug(dealerSlug, allResolvableDealers),
    [dealerSlug, allResolvableDealers]
  );

  const dealerCars = useMemo(() => {
    if (!resolvedDealer) return [];
    const targetNameSlug = slugifyBusinessName(resolvedDealer.name);
    return publicCars.filter((car) => {
      const carDealerId = String(car.dealer?.id || '').trim();
      if (carDealerId) {
        return carDealerId === String(resolvedDealer.id);
      }
      if (car.dealer?.name && slugifyBusinessName(car.dealer.name) === targetNameSlug) {
        return true;
      }
      return false;
    });
  }, [publicCars, resolvedDealer]);

  const filteredDealerCars = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dealerCars
      .filter((car) => {
        if (conditionFilter && car.condition !== conditionFilter) return false;
        if (q) {
          const hit =
            car.title.toLowerCase().includes(q) ||
            car.make.toLowerCase().includes(q) ||
            car.model.toLowerCase().includes(q) ||
            String(car.year).includes(q) ||
            car.location.toLowerCase().includes(q);
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.price - b.price;
        if (sortBy === 'price_desc') return b.price - a.price;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [dealerCars, searchQuery, conditionFilter, sortBy]);

  const shareUrl =
    typeof window !== 'undefined' && resolvedDealer
      ? `${window.location.origin}/dealers/${resolvedDealer.permalinkSlug}`
      : '';

  const handleCopyShareLink = () => {
    if (!shareUrl || !navigator.clipboard) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (loadingDealers && !resolvedDealer) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-pulse">
          <div className="h-44 rounded-2xl bg-[#071A2B]/90" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-80 rounded-xl bg-white border border-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!resolvedDealer) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] pt-28 pb-20 px-4">
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm p-8 sm:p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-[#EF233C] mx-auto flex items-center justify-center">
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#071A2B] font-display uppercase">
            Dealership Not Found
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            We couldn&apos;t find a dealership showroom at{' '}
            <span className="font-mono text-gray-800 font-semibold">/dealers/{dealerSlug}</span>.
            Browse the full Dealers Directory or view all verified cars on MANIFOLD.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/dealers')}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#071A2B] hover:bg-[#0B2239] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition whitespace-nowrap cursor-pointer"
            >
              View Dealers Directory
            </button>
            <button
              type="button"
              onClick={() => navigate('/cars')}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition whitespace-nowrap cursor-pointer"
            >
              Browse All Cars
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Top Navigation Back / Breadcrumbs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <button onClick={() => navigate('/')} className="hover:text-gray-900 cursor-pointer">
              Home
            </button>
            <span>/</span>
            <button
              onClick={() => navigate('/dealers')}
              className="hover:text-gray-900 cursor-pointer"
            >
              Dealers
            </button>
            <span>/</span>
            <span className="text-gray-900 font-semibold truncate max-w-[200px] sm:max-w-xs">
              {resolvedDealer.name}
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate('/dealers')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-[#EF233C] transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Dealers</span>
          </button>
        </div>

        {/* Bold Dealer Storefront Banner */}
        <section className="bg-[#071A2B] text-white rounded-2xl p-6 sm:p-8 lg:p-10 border border-white/10 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3 min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-300">
                <span className="font-extrabold uppercase tracking-[0.18em] text-[#EF233C]">
                  Dealer Showroom
                </span>
                <span aria-hidden="true" className="text-white/25">·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {[resolvedDealer.city, resolvedDealer.state].filter(Boolean).join(', ')}
                </span>
                <span aria-hidden="true" className="text-white/25">·</span>
                {resolvedDealer.verified_partner ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    MANIFOLD Verified Partner
                  </span>
                ) : (
                  <span className="text-gray-300 font-medium">Registered Dealership</span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight font-display uppercase text-white break-words">
                {resolvedDealer.name}
              </h1>

              <p className="text-xs sm:text-sm text-gray-300 max-w-2xl leading-relaxed">
                Showing verified vehicle listings from <strong className="text-white">{resolvedDealer.name}</strong>.
                All viewings, inspections, and negotiations are coordinated safely through the MANIFOLD concierge.
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
              <div className="px-4 py-2.5 rounded-lg bg-white/10 border border-white/15 text-xs font-bold tabular-nums whitespace-nowrap">
                {dealerCars.length} {dealerCars.length === 1 ? 'Vehicle' : 'Vehicles'}
              </div>

              <button
                type="button"
                onClick={handleCopyShareLink}
                className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedLink ? 'Link Copied!' : 'Share Showroom'}</span>
              </button>

              <button
                type="button"
                onClick={() => onInterested()}
                className="h-10 px-4 bg-[#EF233C] hover:bg-[#d91b32] text-white rounded-lg text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 shadow transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Talk to Concierge</span>
              </button>
            </div>
          </div>
        </section>

        {/* Dealer Inventory Controls */}
        {dealerCars.length > 0 && (
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${resolvedDealer.name} inventory...`}
                className="w-full h-11 pl-9 pr-9 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between md:justify-end gap-2.5">
              <select
                value={conditionFilter}
                onChange={(e) => setConditionFilter(e.target.value)}
                aria-label="Filter by condition"
                className="h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:bg-white focus:border-[#071A2B] outline-none cursor-pointer"
              >
                <option value="">All Conditions</option>
                <option value="Foreign Used">Foreign Used</option>
                <option value="Brand New">Brand New</option>
                <option value="Nigerian Used">Nigerian Used</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Sort dealer cars"
                className="h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:bg-white focus:border-[#071A2B] outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        )}

        {/* Dealer Car Cards Grid */}
        {dealerCars.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 sm:p-12 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 mx-auto flex items-center justify-center">
              <CarFront className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-[#071A2B] font-display">
              No Live Vehicles Listed Yet
            </h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              {resolvedDealer.name} has not published active vehicles to this showroom yet. You can
              explore other verified cars across MANIFOLD or request a custom Car Hunt.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/cars')}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#071A2B] hover:bg-[#0B2239] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition whitespace-nowrap cursor-pointer"
              >
                Browse All Vehicles
              </button>
              <button
                type="button"
                onClick={() => navigate('/car-hunt')}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition whitespace-nowrap cursor-pointer"
              >
                Start a Car Hunt
              </button>
            </div>
          </div>
        ) : filteredDealerCars.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center space-y-3 shadow-sm">
            <Compass className="w-8 h-8 text-[#EF233C] mx-auto" />
            <h3 className="text-lg font-bold text-[#071A2B]">No matching vehicles</h3>
            <p className="text-xs text-gray-500">
              Try clearing your search or condition filter for {resolvedDealer.name}.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setConditionFilter('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Reset Showroom Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {filteredDealerCars.map((car) => (
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
        )}
      </div>
    </div>
  );
};
