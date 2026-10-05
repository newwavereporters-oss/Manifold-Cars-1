import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { ListingsPage } from './pages/ListingsPage';
import { CarDetailPage } from './pages/CarDetailPage';
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
import { carService } from './services/carService';
import { InquiryModal } from './components/InquiryModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { FavoritesDrawer } from './components/FavoritesDrawer';
import { AdvancedSearchModal } from './components/AdvancedSearchModal';
import { Car, FilterState } from './types';
import { YouTubeMediaItem } from './data/brandsAndTypes';
import { Loader2 } from 'lucide-react';

export function App() {
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const [cars, setCars] = useState<Car[]>(() => carService.getCarsSync());
  const [selectedCarSlug, setSelectedCarSlug] = useState<string | null>(null);
  const [editingCarId, setEditingCarId] = useState<string | null>(null);
  const [slugCar, setSlugCar] = useState<Car | null>(null);
  const [slugCarLoading, setSlugCarLoading] = useState(false);

  useEffect(() => {
    const unsub = carService.subscribe((updated) => {
      setCars(updated);
    });
    return () => unsub();
  }, []);

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

  // Client-side Navigation routing
  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    parseRoute(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const parseRoute = (path: string) => {
    // 1. Admin Edit Car Route
    if (path.startsWith('/admin/cars/') && path.endsWith('/edit')) {
      const id = path.replace('/admin/cars/', '').replace('/edit', '').split('?')[0];
      setEditingCarId(id);
      setSelectedCarSlug(null);
      setCurrentRoute('/admin/cars/:id/edit');
      return;
    }

    // 2. Admin Protected Routes (Section 3: Route Protection)
    if (path.startsWith('/admin')) {
      setSelectedCarSlug(null);
      setCurrentRoute(path.split('?')[0] || '/admin');
      return;
    }

    // 3. Vehicle Detail Route (Section 13: Live Car Detail)
    if (path.startsWith('/cars/')) {
      const slug = path.replace('/cars/', '').split('?')[0];
      setSelectedCarSlug(slug);
      setCurrentRoute('/cars/:slug');
      return;
    }

    if (path.startsWith('/cars')) {
      const searchParams = new URLSearchParams(window.location.search);
      const makeParam = searchParams.get('make');
      const typeParam = searchParams.get('type');
      if (makeParam) {
        setFilters((prev) => ({ ...prev, make: makeParam }));
      }
      if (typeParam) {
        setFilters((prev) => ({ ...prev, bodyType: typeParam }));
      }
      setSelectedCarSlug(null);
      setCurrentRoute('/cars');
      return;
    }

    setSelectedCarSlug(null);
    setCurrentRoute(path.split('?')[0] || '/');
  };

  useEffect(() => {
    const handlePopState = () => {
      parseRoute(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    parseRoute(window.location.pathname);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Live Vehicle Resolution for /cars/:slug
  useEffect(() => {
    if (selectedCarSlug) {
      const foundInList = cars.find(
        (c) => c.slug === selectedCarSlug || c.id === selectedCarSlug
      );
      if (foundInList) {
        setSlugCar(foundInList);
      } else {
        setSlugCarLoading(true);
        carService
          .getCarBySlug(selectedCarSlug)
          .then((car) => {
            setSlugCar(car);
            setSlugCarLoading(false);
          })
          .catch(() => {
            setSlugCar(null);
            setSlugCarLoading(false);
          });
      }
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

  const favoriteCars = cars.filter((c) => favorites.includes(c.id));

  // Determine active car for details page
  const activeCar = slugCar || cars.find((c) => c.slug === selectedCarSlug) || cars[0];

  // Section 3: Admin Route Protection
  if (currentRoute === '/admin/login') {
    return (
      <div className="min-h-screen bg-[#071A2B]">
        <AdminLoginPage navigate={navigate} />
      </div>
    );
  }

  if (currentRoute.startsWith('/admin')) {
    return (
      <AdminGuard navigate={navigate}>
        {currentRoute === '/admin/cars/:id/edit' && editingCarId ? (
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
        {currentRoute === '/' && (
          <HomePage
            cars={cars}
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

        {currentRoute === '/cars' && (
          <ListingsPage
            cars={cars}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onSelectCar={handleSelectCar}
            onPlayVideo={handlePlayCarVideo}
            onInterested={(car) => handleOpenInquiry(car)}
            navigate={navigate}
            initialFilters={filters}
          />
        )}

        {currentRoute === '/cars/:slug' && (
          slugCarLoading ? (
            <div className="min-h-screen bg-[#F7F8FA] pt-32 pb-20 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#EF233C] mb-3" />
              <p className="text-xs uppercase tracking-widest font-bold text-gray-500">
                Retrieving Verified Vehicle from Supabase...
              </p>
            </div>
          ) : activeCar ? (
            <CarDetailPage
              car={activeCar}
              allCars={cars}
              isFavorite={favorites.includes(activeCar.id)}
              onToggleFavorite={toggleFavorite}
              onInterested={(car) => handleOpenInquiry(car)}
              onPlayVideo={handlePlayCarVideo}
              onSelectCar={handleSelectCar}
              navigate={navigate}
            />
          ) : (
            <div className="min-h-screen bg-[#F7F8FA] pt-32 pb-20 text-center px-4">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Vehicle Not Found</h2>
              <p className="text-xs text-gray-500 mb-4">
                The requested vehicle record could not be found in the live MANIFOLD inventory.
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

        {currentRoute === '/car-hunt' && <CarHuntPage navigate={navigate} />}

        {currentRoute === '/reviews' && (
          <ReviewsPage
            cars={cars}
            onPlayMedia={handlePlayMediaVideo}
            onSelectCar={handleSelectCar}
            navigate={navigate}
          />
        )}

        {currentRoute === '/sell-a-car' && <SellCarPage navigate={navigate} />}

        {currentRoute === '/services' && (
          <ServicesPage navigate={navigate} onOpenInquiry={() => handleOpenInquiry()} />
        )}

        {currentRoute === '/about' && (
          <AboutPage navigate={navigate} onOpenInquiry={() => handleOpenInquiry()} />
        )}
      </main>

      {/* Global Footer */}
      <Footer
        navigate={navigate}
        onFilterBrand={(brand) => {
          setFilters((prev) => ({ ...prev, make: brand }));
          navigate(`/cars?make=${encodeURIComponent(brand)}`);
        }}
        onOpenAdminLogin={() => setAdminLoginModalOpen(true)}
      />

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
        totalMatchingCars={cars.length}
        onApply={() => navigate('/cars')}
      />
    </div>
  );
}

export default App;
