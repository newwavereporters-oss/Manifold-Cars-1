import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { ManifoldWorldPage } from './pages/ManifoldWorldPage';
import { ListingsPage } from './pages/ListingsPage';
import { CarDetailPage } from './pages/CarDetailPage';
import { DealersDirectoryPage } from './pages/DealersDirectoryPage';
import { DealerStorefrontPage } from './pages/DealerStorefrontPage';
import { CarHuntPage } from './pages/CarHuntPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { SellCarPage } from './pages/SellCarPage';
import { ServicesPage } from './pages/ServicesPage';
import { AboutPage } from './pages/AboutPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminEditCarPage } from './pages/admin/AdminEditCarPage';
import { AdminGuard } from './components/AdminGuard';
import { AdminLoginModal } from './components/AdminLoginModal';
import { DealerGuard } from './components/dealer/DealerGuard';
import { DealerSignInPage } from './pages/dealer/DealerSignInPage';
import { DealerRegisterPage } from './pages/dealer/DealerRegisterPage';
import { DealerBusinessInfoPage } from './pages/dealer/DealerBusinessInfoPage';
import { DealerOnboardingSuccessPage } from './pages/dealer/DealerOnboardingSuccessPage';
import { DealerDashboardPage } from './pages/dealer/DealerDashboardPage';
import { DealerCarsPage } from './pages/dealer/DealerCarsPage';
import { DealerAddCarPage } from './pages/dealer/DealerAddCarPage';
import { DealerEditCarPage } from './pages/dealer/DealerEditCarPage';
import { DealerOfferPage } from './pages/dealer/DealerOfferPage';
import { DealerEnquiriesPage } from './pages/dealer/DealerEnquiriesPage';
import { DealerBusinessProfilePage } from './pages/dealer/DealerBusinessProfilePage';
import { carService, isPublicMarketplaceCar } from './services/carService';
import { InquiryModal } from './components/InquiryModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { FavoritesDrawer } from './components/FavoritesDrawer';
import { AdvancedSearchModal } from './components/AdvancedSearchModal';
import { NotFoundView } from './components/NotFoundView';
import { AiAutomotiveAssistant } from './components/ai/AiAutomotiveAssistant';
import {
  normalizeBrowserLocation,
  parseManifoldRoute,
  ParsedRouteResult,
} from './utils/routing';
import { engineAudio } from './utils/engineAudio';
import { musicLibrary } from './utils/musicLibraryService';
import { Car, FilterState } from './types';
import { YouTubeMediaItem } from './data/brandsAndTypes';
import { Loader2 } from 'lucide-react';

export function App() {
  const [routeState, setRouteState] = useState<ParsedRouteResult>(() => {
    const { cleanUrl } = normalizeBrowserLocation(
      window.location.pathname,
      window.location.search,
      window.location.hash
    );
    return parseManifoldRoute(cleanUrl);
  });
  const currentRoute = routeState.normalizedRoute;

  const [cars, setCars] = useState<Car[]>(() => carService.getCarsSync());
  const [selectedCarSlug, setSelectedCarSlug] = useState<string | null>(() => routeState.slug);
  const [editingCarId, setEditingCarId] = useState<string | null>(() => routeState.editingCarId);
  const [dealerEditingCarId, setDealerEditingCarId] = useState<string | null>(
    () => routeState.dealerEditingCarId
  );
  const [aiSearchQuery, setAiSearchQuery] = useState<string>('');
  const [assistantSignal, setAssistantSignal] = useState<number>(0);
  const [slugCar, setSlugCar] = useState<Car | null>(null);
  const [slugCarLoading, setSlugCarLoading] = useState(false);
  const [slugCarError, setSlugCarError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = carService.subscribe((updated) => {
      setCars(updated);
    });
    return () => unsub();
  }, []);

  // Ensure all 3D game engine and music audio stop immediately when leaving `/3d-world`
  useEffect(() => {
    if (currentRoute !== '/3d-world') {
      engineAudio.stop();
      musicLibrary.pause();
    }
  }, [currentRoute]);

  const publicCars = React.useMemo(() => cars.filter(isPublicMarketplaceCar), [cars]);

  // Favorites state with localStorage persistence (harmless UI preference)
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('manifold_favorites');
      return saved ? JSON.parse(saved) : ['car-highlander-2021'];
    } catch {
      return ['car-highlander-2021'];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('manifold_favorites', JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }, [favorites]);

  const toggleFavorite = (carId: string) => {
    setFavorites((prev) =>
      prev.includes(carId) ? prev.filter((id) => id !== carId) : [...prev, carId]
    );
  };

  // Filter state for search
  const [filters, setFilters] = useState<FilterState>({
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

  // Modals state
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [inquiryCar, setInquiryCar] = useState<Car | null>(null);
  const [isGeneralInquiry, setIsGeneralInquiry] = useState(false);

  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoCar, setVideoCar] = useState<Car | null>(null);
  const [customVideo, setCustomVideo] = useState<YouTubeMediaItem | null>(null);

  const [favoritesDrawerOpen, setFavoritesDrawerOpen] = useState(false);
  const [advancedSearchModalOpen, setAdvancedSearchModalOpen] = useState(false);
  const [adminLoginModalOpen, setAdminLoginModalOpen] = useState(false);

  // Sync URL query parameters and sub-route identifiers cleanly
  const parseRoute = (rawPathWithQuery: string) => {
    const parsed = parseManifoldRoute(rawPathWithQuery);
    setRouteState(parsed);
    setSelectedCarSlug(parsed.slug);
    setEditingCarId(parsed.editingCarId);
    setDealerEditingCarId(parsed.dealerEditingCarId);

    if (parsed.normalizedRoute === '/cars') {
      const searchParams = new URLSearchParams(parsed.queryString || window.location.search);
      const makeParam = searchParams.get('make') || '';
      const typeParam = searchParams.get('type') || '';
      const qParam = searchParams.get('q') || '';
      const aiParam = searchParams.get('ai') || '';

      if (makeParam || typeParam || qParam) {
        setFilters((prev) => ({
          ...prev,
          ...(makeParam ? { make: makeParam } : {}),
          ...(typeParam ? { bodyType: typeParam } : {}),
          ...(qParam ? { searchQuery: qParam } : {}),
        }));
      }
      setAiSearchQuery(aiParam);
    } else {
      setAiSearchQuery('');
    }
  };

  // Client-side Navigation routing (strict History API, never writes hash URLs)
  const navigate = (path: string) => {
    const trimmed = (path || '/').trim();
    const withoutHash = trimmed.startsWith('/#/')
      ? trimmed.slice(2)
      : trimmed.startsWith('#/')
      ? trimmed.slice(1)
      : trimmed;
    const [rawPathname, rawSearch] = withoutHash.split('?');
    const { cleanUrl } = normalizeBrowserLocation(
      rawPathname || '/',
      rawSearch ? `?${rawSearch}` : '',
      ''
    );

    window.history.pushState({}, '', cleanUrl);
    parseRoute(cleanUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const syncFromWindowLocation = () => {
      const { cleanUrl, changed } = normalizeBrowserLocation(
        window.location.pathname,
        window.location.search,
        window.location.hash
      );
      if (changed) {
        window.history.replaceState({}, '', cleanUrl);
      }
      parseRoute(cleanUrl);
    };

    window.addEventListener('popstate', syncFromWindowLocation);
    window.addEventListener('hashchange', syncFromWindowLocation);
    syncFromWindowLocation();
    return () => {
      window.removeEventListener('popstate', syncFromWindowLocation);
      window.removeEventListener('hashchange', syncFromWindowLocation);
    };
  }, []);

  // Live Vehicle Resolution for /cars/:slug (never falls back to unrelated car)
  useEffect(() => {
    if (!selectedCarSlug) {
      setSlugCar(null);
      setSlugCarLoading(false);
      setSlugCarError(null);
      return;
    }

    const foundInList = cars.find(
      (c) => c.slug === selectedCarSlug || c.id === selectedCarSlug
    );
    if (foundInList) {
      setSlugCar(foundInList);
      setSlugCarLoading(false);
      setSlugCarError(null);
    } else {
      setSlugCarLoading(true);
      setSlugCarError(null);
      carService
        .getCarBySlug(selectedCarSlug)
        .then((car) => {
          setSlugCar(car);
          setSlugCarLoading(false);
        })
        .catch((err: any) => {
          setSlugCar(null);
          setSlugCarError(err?.message || 'Unable to load requested vehicle.');
          setSlugCarLoading(false);
        });
    }
  }, [selectedCarSlug, cars]);

  // Action handlers
  const handleOpenInquiry = (car?: Car) => {
    if (car) {
      setInquiryCar(car);
      setIsGeneralInquiry(false);
    } else {
      setInquiryCar(null);
      setIsGeneralInquiry(true);
    }
    setInquiryModalOpen(true);
  };

  const handlePlayCarVideo = (car: Car) => {
    setVideoCar(car);
    setCustomVideo(null);
    setVideoModalOpen(true);
  };

  const handlePlayMediaVideo = (item: YouTubeMediaItem) => {
    setCustomVideo(item);
    setVideoCar(null);
    setVideoModalOpen(true);
  };

  const handleSelectCar = (car: Car) => {
    setSelectedCarSlug(car.slug);
    navigate(`/cars/${car.slug}`);
  };

  const handleHeroSearch = (searchFilters: {
    make: string;
    model: string;
    location: string;
    minPrice: number | '';
    maxPrice: number | '';
  }) => {
    setFilters((prev) => ({
      ...prev,
      make: searchFilters.make,
      model: searchFilters.model,
      location: searchFilters.location,
      minPrice: searchFilters.minPrice,
      maxPrice: searchFilters.maxPrice,
    }));
    navigate('/cars');
  };

  const favoriteCars = publicCars.filter((c) => favorites.includes(c.id));

  // Strictly resolve requested vehicle; never fall back to cars[0]
  const activeCar = selectedCarSlug
    ? slugCar || cars.find((c) => c.slug === selectedCarSlug || c.id === selectedCarSlug) || null
    : null;

  // Section 3: Admin Route Protection
  if (currentRoute === '/admin/login') {
    return (
      <div className="min-h-screen bg-[#071A2B]">
        <AdminLoginPage navigate={navigate} />
      </div>
    );
  }

  if (routeState.scope === 'admin') {
    return (
      <AdminGuard navigate={navigate}>
        {!routeState.isKnownRoute ? (
          <div className="min-h-screen bg-[#F7F8FA]">
            <NotFoundView path={currentRoute} navigate={navigate} scope="admin" />
          </div>
        ) : currentRoute === '/admin/cars/:id/edit' && editingCarId ? (
          <div className="min-h-screen bg-[#F7F8FA]">
            <AdminEditCarPage carId={editingCarId} navigate={navigate} />
          </div>
        ) : (
          <div className="min-h-screen bg-[#F7F8FA]">
            <AdminDashboardPage navigate={navigate} activeRoute={currentRoute} />
          </div>
        )}
      </AdminGuard>
    );
  }

  // Section 3: Dealer Portal Routes
  if (routeState.scope === 'dealer') {
    const isAuthDealerSubPage =
      currentRoute !== '/dealer/sign-in' &&
      currentRoute !== '/dealer/register' &&
      currentRoute !== '/dealer/offer';

    return (
      <>
        {currentRoute === '/dealer/sign-in' ? (
          <DealerSignInPage navigate={navigate} />
        ) : currentRoute === '/dealer/register' ? (
          <DealerRegisterPage navigate={navigate} />
        ) : currentRoute === '/dealer/offer' ? (
          <DealerOfferPage navigate={navigate} />
        ) : (
          <DealerGuard navigate={navigate} currentRoute={currentRoute}>
            {!routeState.isKnownRoute ? (
              <NotFoundView path={currentRoute} navigate={navigate} scope="dealer" />
            ) : currentRoute === '/dealer/business-information' ? (
              <DealerBusinessInfoPage navigate={navigate} />
            ) : currentRoute === '/dealer/enquiries' ? (
              <DealerEnquiriesPage navigate={navigate} />
            ) : currentRoute === '/dealer/business-profile' || currentRoute === '/dealer/profile' ? (
              <DealerBusinessProfilePage navigate={navigate} />
            ) : currentRoute === '/dealer/onboarding-success' ? (
              <DealerOnboardingSuccessPage navigate={navigate} />
            ) : currentRoute === '/dealer/cars/new' ? (
              <DealerAddCarPage navigate={navigate} />
            ) : currentRoute === '/dealer/cars/:id/edit' && dealerEditingCarId ? (
              <DealerEditCarPage carId={dealerEditingCarId} navigate={navigate} />
            ) : currentRoute === '/dealer/cars' ? (
              <DealerCarsPage navigate={navigate} />
            ) : (
              <DealerDashboardPage navigate={navigate} />
            )}
          </DealerGuard>
        )}
        {isAuthDealerSubPage && routeState.isKnownRoute && (
          <AiAutomotiveAssistant
            surface="dealer_portal"
            allCars={cars}
            navigate={navigate}
            onOpenInquiry={handleOpenInquiry}
            externalOpenSignal={assistantSignal}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col min-h-screen text-[#111827]">
      {/* Sticky Header with Signature Lockup & Brand Actions */}
      <Header
        currentRoute={currentRoute}
        navigate={navigate}
        favoritesCount={favorites.length}
        onOpenFavorites={() => setFavoritesDrawerOpen(true)}
        onOpenInquiry={() => handleOpenInquiry()}
        onOpenSearch={() => setAdvancedSearchModalOpen(true)}
        onOpenAdminLogin={() => setAdminLoginModalOpen(true)}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {!routeState.isKnownRoute && (
          <NotFoundView path={currentRoute} navigate={navigate} scope="public" />
        )}

        {routeState.isKnownRoute && currentRoute === '/3d-world' && (
          <ManifoldWorldPage
            cars={cars}
            navigate={navigate}
            onSelectCar={handleSelectCar}
            onPlayVideo={handlePlayCarVideo}
            onInterested={(car) => handleOpenInquiry(car)}
          />
        )}

        {routeState.isKnownRoute &&
          (currentRoute === '/' || currentRoute === '/car-marketplace' || currentRoute === '/marketplace') && (
            <HomePage
              cars={publicCars}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              onSelectCar={handleSelectCar}
              onPlayVideo={handlePlayCarVideo}
              onPlayMedia={handlePlayMediaVideo}
              onInterested={(car) => handleOpenInquiry(car)}
              onSearch={handleHeroSearch}
              onOpenAdvancedSearch={() => setAdvancedSearchModalOpen(true)}
              navigate={navigate}
            />
          )}

        {routeState.isKnownRoute && currentRoute === '/cars' && (
          <ListingsPage
            key={`cars-${routeState.queryString}-${filters.make}-${filters.bodyType}-${filters.searchQuery}`}
            cars={publicCars}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onSelectCar={handleSelectCar}
            onPlayVideo={handlePlayCarVideo}
            onInterested={(car) => handleOpenInquiry(car)}
            navigate={navigate}
            initialFilters={filters}
            initialAiQuery={aiSearchQuery}
          />
        )}

        {routeState.isKnownRoute && currentRoute === '/cars/:slug' && (
          slugCarLoading ? (
            <div className="min-h-screen bg-[#F7F8FA] pt-32 pb-20 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#EF233C] mb-3" />
              <p className="text-xs uppercase tracking-widest font-bold text-gray-500">
                Loading Verified Vehicle...
              </p>
            </div>
          ) : activeCar ? (
            <CarDetailPage
              car={activeCar}
              allCars={publicCars}
              isFavorite={favorites.includes(activeCar.id)}
              onToggleFavorite={toggleFavorite}
              onInterested={(car) => handleOpenInquiry(car)}
              onPlayVideo={handlePlayCarVideo}
              onSelectCar={handleSelectCar}
              onAskAi={() => setAssistantSignal((s) => s + 1)}
              navigate={navigate}
            />
          ) : (
            <div className="min-h-screen bg-[#F7F8FA] pt-32 pb-20 text-center px-4">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {slugCarError ? 'Unable to Load Vehicle' : 'Vehicle Not Found'}
              </h2>
              <p className="text-xs text-gray-500 mb-4 max-w-md mx-auto">
                {slugCarError
                  ? slugCarError
                  : 'The requested vehicle record could not be found in the live MANIFOLD inventory.'}
              </p>
              <button
                onClick={() => navigate('/cars')}
                className="px-4 py-2 bg-[#071A2B] text-white text-xs font-bold uppercase rounded-lg"
              >
                Browse All Vehicles
              </button>
            </div>
          )
        )}

        {routeState.isKnownRoute && currentRoute === '/dealers' && (
          <DealersDirectoryPage cars={publicCars} navigate={navigate} />
        )}

        {routeState.isKnownRoute &&
          (currentRoute === '/dealers/:dealerSlug' || currentRoute === '/:dealerSlug') &&
          routeState.dealerSlug && (
          <DealerStorefrontPage
            dealerSlug={routeState.dealerSlug}
            cars={publicCars}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onSelectCar={handleSelectCar}
            onPlayVideo={handlePlayCarVideo}
            onInterested={(car) => handleOpenInquiry(car)}
            navigate={navigate}
          />
        )}

        {routeState.isKnownRoute && currentRoute === '/car-hunt' && (
          <CarHuntPage navigate={navigate} />
        )}

        {routeState.isKnownRoute && currentRoute === '/reviews' && (
          <ReviewsPage
            cars={publicCars}
            onPlayMedia={handlePlayMediaVideo}
            onSelectCar={handleSelectCar}
            navigate={navigate}
          />
        )}

        {routeState.isKnownRoute && currentRoute === '/sell-a-car' && (
          <SellCarPage navigate={navigate} />
        )}

        {routeState.isKnownRoute && currentRoute === '/services' && (
          <ServicesPage navigate={navigate} onOpenInquiry={() => handleOpenInquiry()} />
        )}

        {routeState.isKnownRoute && currentRoute === '/about' && (
          <AboutPage navigate={navigate} onOpenInquiry={() => handleOpenInquiry()} />
        )}
      </main>

      {/* AI Automotive Concierge Assistant (Non-3D Public Marketplace Surfaces) */}
      {currentRoute !== '/3d-world' && routeState.isKnownRoute && (
        <AiAutomotiveAssistant
          surface={currentRoute === '/cars/:slug' ? 'car_detail' : 'marketplace'}
          focusedCar={currentRoute === '/cars/:slug' ? activeCar : null}
          allCars={publicCars}
          navigate={navigate}
          onOpenInquiry={handleOpenInquiry}
          externalOpenSignal={assistantSignal}
        />
      )}

      {/* Global Footer (Rendered on non-3D world pages for full viewport gaming experience) */}
      {currentRoute !== '/3d-world' && (
        <Footer
          navigate={navigate}
          onFilterBrand={(brand) => {
            setFilters((prev) => ({ ...prev, make: brand }));
            navigate(`/cars?make=${encodeURIComponent(brand)}`);
          }}
          onOpenAdminLogin={() => setAdminLoginModalOpen(true)}
        />
      )}

      {/* Admin Sign In Modal */}
      <AdminLoginModal
        isOpen={adminLoginModalOpen}
        onClose={() => setAdminLoginModalOpen(false)}
        onSuccessNavigate={(route) => navigate(route)}
      />

      {/* Inquiry Concierge Modal */}
      <InquiryModal
        isOpen={inquiryModalOpen}
        onClose={() => setInquiryModalOpen(false)}
        car={inquiryCar}
        generalInquiry={isGeneralInquiry}
      />

      {/* Video Walkaround Player Modal */}
      <VideoPlayerModal
        isOpen={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        car={videoCar}
        customVideo={customVideo}
        onInterested={(car) => handleOpenInquiry(car)}
        onViewDetails={(car) => handleSelectCar(car)}
      />

      {/* Saved Vehicles Drawer */}
      <FavoritesDrawer
        isOpen={favoritesDrawerOpen}
        onClose={() => setFavoritesDrawerOpen(false)}
        favorites={favoriteCars}
        onRemoveFavorite={toggleFavorite}
        onSelectCar={handleSelectCar}
        onInterested={(car) => handleOpenInquiry(car)}
      />

      {/* Advanced Filter Modal */}
      <AdvancedSearchModal
        isOpen={advancedSearchModalOpen}
        onClose={() => setAdvancedSearchModalOpen(false)}
        filters={filters}
        onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
        onResetFilters={() =>
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
          })
        }
        totalMatchingCars={publicCars.length}
        onApply={() => navigate('/cars')}
      />
    </div>
  );
}

export default App;
