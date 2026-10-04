import React from 'react';
import { ArrowRight, Compass, ShieldCheck } from 'lucide-react';

interface CarHuntBannerProps {
  onStartHunt: () => void;
  variant?: 'inline' | 'hero-bottom';
}

export const CarHuntBanner: React.FC<CarHuntBannerProps> = ({
  onStartHunt,
  variant = 'hero-bottom',
}) => {
  if (variant === 'inline') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-10">
        <div className="bg-[#0B2239] rounded-xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-white/10 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#EF233C]/20 border border-[#EF233C]/30 text-[#EF233C] flex items-center justify-center shrink-0">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white font-display">
                Can't find what you're looking for?
              </h3>
              <p className="text-xs sm:text-sm text-gray-300 mt-0.5">
                Tell us what you need. We'll source and inspect it directly from our verified dealer
                network.
              </p>
            </div>
          </div>

          <button
            onClick={onStartHunt}
            className="w-full md:w-auto px-6 py-3 bg-[#EF233C] hover:bg-[#d91b32] text-white font-bold text-xs uppercase tracking-wider rounded shadow transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
          >
            Start a Car Hunt
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="relative py-20 lg:py-24 bg-[#071A2B] text-white overflow-hidden">
      {/* Background Dark G-Wagon Banner */}
      <div className="absolute inset-0 z-0">
        <img
          src="/src/assets/images/dark_gwagon_dusk_banner_1791137913608.jpg"
          alt="MANIFOLD Car Hunt Sourcing Concierge"
          className="w-full h-full object-cover object-center filter brightness-50"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#071A2B] via-[#071A2B]/85 to-transparent" />
        <div className="absolute inset-0 bg-[#071A2B]/40" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/15 text-xs text-gray-300">
            <ShieldCheck className="w-3.5 h-3.5 text-[#EF233C]" />
            <span>MANIFOLD Bespoke Sourcing Service</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight font-display">
            Let <span className="text-[#EF233C]">MANIFOLD</span> Find <br />
            The Perfect Car For You.
          </h2>

          <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
            Tell us your budget, preferred make, model, and trim. Our field automotive inspectors
            will source and present verified options from our trusted dealer network with video
            walkarounds.
          </p>

          <div className="pt-2">
            <button
              onClick={onStartHunt}
              className="inline-flex items-center gap-2.5 bg-[#EF233C] hover:bg-[#d91b32] text-white font-bold text-xs uppercase tracking-wider px-7 py-4 rounded shadow-xl hover:shadow-red-500/25 transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Start My Car Hunt</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
