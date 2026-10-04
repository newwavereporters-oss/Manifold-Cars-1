import React from 'react';
import { Video, ShieldCheck, Headphones, Key, Play } from 'lucide-react';
import { HeroSearchBox } from './HeroSearchBox';

interface HeroProps {
  onSearch: (filters: {
    make: string;
    model: string;
    location: string;
    minPrice: number | '';
    maxPrice: number | '';
  }) => void;
  onOpenAdvancedSearch: () => void;
  navigate: (route: string) => void;
  onPlayHeroVideo: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  onSearch,
  onOpenAdvancedSearch,
  navigate,
  onPlayHeroVideo,
}) => {
  return (
    <section className="relative bg-[#071A2B] pt-24 pb-12 sm:pt-28 md:pt-32 lg:pt-36 overflow-hidden">
      {/* Background Cinematic Image with Deep Gradients */}
      <div className="absolute inset-0 z-0">
        <img
          src="/src/assets/images/hero_manifold_dealership_1791137893826.jpg"
          alt="MANIFOLD Luxury Dealership Sunset Showroom in Lagos"
          className="w-full h-full object-cover object-center scale-105 filter brightness-90 transform duration-1000 ease-out"
          referrerPolicy="no-referrer"
        />
        {/* Measured Scrim & Gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#071A2B]/95 via-[#071A2B]/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#071A2B] via-transparent to-[#071A2B]/60" />
      </div>

      {/* Hero Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center min-h-[440px] md:min-h-[500px]">
          {/* Left Column: Brand & Hero Headline */}
          <div className="lg:col-span-7 pt-4 pb-8 space-y-5">
            {/* Brand Lockup */}
            <div className="inline-flex flex-col space-y-1">
              <span className="text-xs sm:text-sm font-extrabold tracking-[0.25em] text-[#EF233C] uppercase font-display">
                MANIFOLD
              </span>
              <span className="text-[10px] sm:text-xs font-semibold tracking-[0.3em] text-gray-300 uppercase">
                FIND · VERIFY · DRIVE
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.05] font-display text-balance">
              Find Your <br />
              <span className="text-[#EF233C]">Next</span> Car
            </h1>

            {/* Supporting Copy */}
            <p className="text-base sm:text-lg text-gray-200 font-normal max-w-xl leading-relaxed">
              Verified cars. Real video reviews. Expert guidance. All in one place.
            </p>

            {/* Quick Micro Badges */}
            <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs font-medium text-gray-300">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#EF233C]" />
                <span>Zero Unknown Dealers</span>
              </div>
              <span className="text-gray-500">·</span>
              <div className="flex items-center gap-1.5">
                <Video className="w-4 h-4 text-[#EF233C]" />
                <span>100% Video Reviewed</span>
              </div>
              <span className="text-gray-500">·</span>
              <div className="flex items-center gap-1.5">
                <Key className="w-4 h-4 text-[#EF233C]" />
                <span>Concierge Buying</span>
              </div>
            </div>
          </div>

          {/* Right Column: Signature MANIFOLD Trust Card & Presenter Video Teaser */}
          <div className="lg:col-span-5 flex justify-end">
            <div className="w-full max-w-md bg-[#071A2B]/85 backdrop-blur-md rounded-xl border border-white/15 p-5 shadow-2xl space-y-4">
              {/* Video Review Interactive Teaser */}
              <div
                onClick={onPlayHeroVideo}
                className="relative rounded-lg overflow-hidden group cursor-pointer aspect-video bg-black/60 border border-white/10"
              >
                <img
                  src="/src/assets/images/manifold_presenter_showcase_1791137904318.jpg"
                  alt="MANIFOLD Presenter Automotive Video Review"
                  className="w-full h-full object-cover filter brightness-90 group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-between p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="bg-[#EF233C] text-white text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded">
                      MANIFOLD REVIEW
                    </span>
                    <span className="text-[11px] font-semibold text-white/90 bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
                      14:32
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#EF233C] text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-snug line-clamp-1">
                        Watch How MANIFOLD Verifies Every Car
                      </p>
                      <p className="text-[10px] text-gray-300">
                        Presented by MANIFOLD Automotive Team
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Trust Points */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="flex items-start gap-2 text-xs text-gray-200">
                  <Video className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
                  <span className="font-medium text-[11px] leading-tight">
                    Video Reviews on Every Car
                  </span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-200">
                  <ShieldCheck className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
                  <span className="font-medium text-[11px] leading-tight">
                    Verified Dealers & Physical Status
                  </span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-200">
                  <Headphones className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
                  <span className="font-medium text-[11px] leading-tight">
                    Expert Support from MANIFOLD
                  </span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-200">
                  <Key className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
                  <span className="font-medium text-[11px] leading-tight">
                    Safe & Guided Buying Process
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Search Interface at bottom */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <HeroSearchBox
          onSearch={onSearch}
          onOpenAdvancedSearch={onOpenAdvancedSearch}
          navigate={navigate}
        />
      </div>
    </section>
  );
};
