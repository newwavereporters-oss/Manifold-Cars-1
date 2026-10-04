import React, { useState } from 'react';
import { Play, Youtube, ArrowRight, Eye, Calendar, ShieldCheck } from 'lucide-react';
import { MEDIA_REVIEWS, YouTubeMediaItem } from '../data/brandsAndTypes';
import { Car } from '../types';

interface ReviewsPageProps {
  cars: Car[];
  onPlayMedia: (item: YouTubeMediaItem) => void;
  onSelectCar: (car: Car) => void;
  navigate: (route: string) => void;
}

export const ReviewsPage: React.FC<ReviewsPageProps> = ({
  cars,
  onPlayMedia,
  onSelectCar,
  navigate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Car Review', 'Car Hunt', 'Buying Tips', 'Market Insights'];

  const filteredMedia =
    selectedCategory === 'All'
      ? MEDIA_REVIEWS
      : MEDIA_REVIEWS.filter((m) => m.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[#F7F8FA] pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <button onClick={() => navigate('/')} className="hover:text-gray-900">
            Home
          </button>
          <span>/</span>
          <span className="text-gray-900 font-medium">Car Reviews & Media</span>
        </div>

        {/* Media Hero */}
        <div className="bg-[#071A2B] text-white rounded-2xl p-8 mb-8 border border-white/10 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-xl space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#EF233C]">
              MANIFOLD AUTOMOTIVE MEDIA
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display">
              Real Reviews. Real Lagos Roads. Real Nigeria Insights.
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              We inspect, test-drive, and break down maintenance costs, Nigerian road suitability,
              and customs traps on every vehicle.
            </p>
          </div>

          <a
            href="https://www.youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider px-6 py-3.5 rounded shadow transition-all hover:scale-105"
          >
            <Youtube className="w-5 h-5" />
            <span>Subscribe on YouTube</span>
          </a>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-[#071A2B] text-white shadow'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {filteredMedia.map((item) => (
            <div
              key={item.id}
              onClick={() => onPlayMedia(item)}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col group"
            >
              <div className="relative aspect-video w-full bg-black overflow-hidden">
                <img
                  src={item.thumbnail_url}
                  alt={item.title}
                  className="w-full h-full object-cover filter brightness-90 group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                <span className="absolute top-3 left-3 bg-[#EF233C] text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded shadow">
                  {item.category}
                </span>

                <span className="absolute bottom-3 right-3 bg-black/80 text-white text-xs font-semibold px-2 py-0.5 rounded tabular-nums">
                  {item.duration}
                </span>

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-[#EF233C]/95 group-hover:bg-[#EF233C] text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-base font-bold text-[#071A2B] group-hover:text-[#EF233C] transition-colors leading-snug line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                  <span>{item.views}</span>
                  <span className="text-[#EF233C] font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Watch Full Review <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Also Browse Current Inventory With Walkarounds */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#EF233C]">
                On The Lot
              </span>
              <h2 className="text-2xl font-bold font-display text-[#071A2B] uppercase">
                Inventory With Video Walkarounds
              </h2>
            </div>
            <button
              onClick={() => navigate('/cars')}
              className="text-xs font-bold text-[#071A2B] hover:text-[#EF233C] uppercase tracking-wider"
            >
              View all inventory →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cars.slice(0, 3).map((car) => (
              <div
                key={car.id}
                onClick={() => onSelectCar(car)}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden p-3 hover:shadow-md cursor-pointer flex gap-4"
              >
                <img
                  src={car.video.youtube_thumbnail_url}
                  alt={car.title}
                  className="w-28 h-20 object-cover rounded shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#071A2B] truncate">{car.title}</h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">{car.location}</p>
                  </div>
                  <span className="text-xs font-extrabold text-[#EF233C] tabular-nums">
                    ₦{(car.price / 1000000).toFixed(1)}M
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
