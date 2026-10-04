import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Hero } from '../components/Hero';
import { BrowseByType } from '../components/BrowseByType';
import { BrowseByBrand } from '../components/BrowseByBrand';
import { VideoCarCard } from '../components/VideoCarCard';
import { YouTubeSection } from '../components/YouTubeSection';
import { WhyManifold } from '../components/WhyManifold';
import { HowItWorks } from '../components/HowItWorks';
import { CarHuntBanner } from '../components/CarHuntBanner';
import { Car } from '../types';
import { YouTubeMediaItem } from '../data/brandsAndTypes';

interface HomePageProps {
  cars: Car[];
  favorites: string[];
  onToggleFavorite: (carId: string) => void;
  onSelectCar: (car: Car) => void;
  onPlayVideo: (car: Car) => void;
  onPlayMedia: (item: YouTubeMediaItem) => void;
  onInterested: (car: Car) => void;
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

export const HomePage: React.FC<HomePageProps> = ({
  cars,
  favorites,
  onToggleFavorite,
  onSelectCar,
  onPlayVideo,
  onPlayMedia,
  onInterested,
  onSearch,
  onOpenAdvancedSearch,
  navigate,
}) => {
  const featuredCars = cars.filter((c) => c.is_featured);
  const latestCars = cars.slice().reverse();

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* 1. Hero with Cinematic Lagos Dealership Visual & Search Experience */}
      <Hero
        onSearch={onSearch}
        onOpenAdvancedSearch={onOpenAdvancedSearch}
        navigate={navigate}
        onPlayHeroVideo={() => {
          if (featuredCars[0]) onPlayVideo(featuredCars[0]);
        }}
      />

      {/* 2. Browse By Body Type */}
      <BrowseByType
        onSelectType={(type) => {
          navigate(`/cars?type=${encodeURIComponent(type)}`);
        }}
        onViewAll={() => navigate('/cars')}
      />

      {/* 3. Featured Cars (VIDEO FIRST CAR CARDS) */}
      <section className="py-14 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#EF233C]">
                Handpicked Inventory
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#071A2B] tracking-tight font-display mt-0.5 uppercase">
                Featured Cars
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Handpicked cars with detailed video reviews from MANIFOLD.
              </p>
            </div>

            <button
              onClick={() => navigate('/cars?featured=true')}
              className="mt-3 sm:mt-0 inline-flex items-center gap-1.5 text-xs font-bold text-[#071A2B] hover:text-[#EF233C] transition-colors uppercase tracking-wider group"
            >
              <span>View all featured cars</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* 4 Cards Grid - Dominant Video Presentation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredCars.slice(0, 4).map((car) => (
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
        </div>
      </section>

      {/* 4. YouTube / MANIFOLD Media Section */}
      <YouTubeSection onPlayMedia={onPlayMedia} />

      {/* 5. Browse By Brand */}
      <BrowseByBrand
        onSelectBrand={(brandName) => {
          navigate(`/cars?make=${encodeURIComponent(brandName)}`);
        }}
        onViewAllBrands={() => navigate('/cars')}
      />

      {/* 6. Latest Cars From Verified Dealers */}
      <section className="py-14 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#EF233C]">
                Verified Arrivals
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#071A2B] tracking-tight font-display mt-0.5 uppercase">
                Latest Cars From Verified Dealers
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Fresh arrivals with video walkarounds and MANIFOLD insights.
              </p>
            </div>

            <button
              onClick={() => navigate('/cars')}
              className="mt-3 sm:mt-0 inline-flex items-center gap-1.5 text-xs font-bold text-[#071A2B] hover:text-[#EF233C] transition-colors uppercase tracking-wider group"
            >
              <span>View all cars</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {latestCars.slice(0, 4).map((car) => (
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
        </div>
      </section>

      {/* 7. Mid-Page Car Hunt Banner */}
      <CarHuntBanner
        variant="inline"
        onStartHunt={() => {
          navigate('/car-hunt');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* 8. Why MANIFOLD */}
      <WhyManifold />

      {/* 9. How It Works */}
      <HowItWorks />

      {/* 10. Final Cinematic Full-Width Car Hunt Banner */}
      <CarHuntBanner
        variant="hero-bottom"
        onStartHunt={() => {
          navigate('/car-hunt');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
};
