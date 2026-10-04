import React from 'react';
import { Play, Youtube, ArrowRight } from 'lucide-react';
import { MEDIA_REVIEWS, YouTubeMediaItem } from '../data/brandsAndTypes';
import presenterShowcaseImg from '@/src/assets/images/manifold_presenter_showcase_1791137904318.jpg';

interface YouTubeSectionProps {
  onPlayMedia: (item: YouTubeMediaItem) => void;
}

export const YouTubeSection: React.FC<YouTubeSectionProps> = ({ onPlayMedia }) => {
  return (
    <section className="py-16 bg-[#071A2B] text-white overflow-hidden relative border-y border-white/10">
      {/* Background Subtle Ambience */}
      <div className="absolute inset-0 bg-radial-gradient from-blue-950/30 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Top Media Banner Box */}
        <div className="bg-[#0B2239] rounded-2xl border border-white/10 p-6 sm:p-8 lg:p-10 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left: MANIFOLD Presenter Portrait & Editorial Branding */}
            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col items-center sm:items-start lg:items-center text-center sm:text-left lg:text-center gap-6">
              <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl sm:rounded-3xl overflow-hidden border-3 border-[#EF233C] shadow-xl shrink-0">
                <img
                  src={presenterShowcaseImg}
                  alt="MANIFOLD Automotive Video Presenter"
                  className="w-full h-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-1 right-2 bg-[#EF233C] text-white p-1 rounded-full shadow">
                  <Youtube className="w-4 h-4" />
                </div>
              </div>

              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#EF233C]">
                  MANIFOLD MEDIA
                </span>
                <h3 className="text-xl sm:text-2xl font-bold font-display text-white mt-1">
                  Car Reviews, Car Hunts, Buying Tips and More.
                </h3>
                <p className="text-xs sm:text-sm text-gray-300 mt-2 max-w-sm">
                  Watch on YouTube and get deeper insights on the Nigerian car market.
                </p>

                <a
                  href="https://www.youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded shadow transition-all hover:scale-105 active:scale-95"
                >
                  <Youtube className="w-4 h-4" />
                  <span>Visit MANIFOLD on YouTube</span>
                </a>
              </div>
            </div>

            {/* Right: Featured Video Episodes Cards */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MEDIA_REVIEWS.slice(0, 2).map((item) => (
                <div
                  key={item.id}
                  onClick={() => onPlayMedia(item)}
                  className="group bg-[#071A2B] rounded-xl border border-white/10 overflow-hidden hover:border-[#EF233C]/50 transition-all duration-200 cursor-pointer flex flex-col shadow-lg"
                >
                  {/* Thumbnail with 16:9 ratio */}
                  <div className="relative aspect-video w-full bg-black overflow-hidden">
                    <img
                      src={item.thumbnail_url}
                      alt={item.title}
                      className="w-full h-full object-cover filter brightness-90 group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                    {/* Category Tag */}
                    <span className="absolute top-2 left-2 bg-[#EF233C] text-white text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded">
                      {item.category}
                    </span>

                    {/* Duration */}
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums">
                      {item.duration}
                    </span>

                    {/* Play Icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-[#EF233C]/90 group-hover:bg-[#EF233C] text-white flex items-center justify-center shadow group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#EF233C] transition-colors line-clamp-2 leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
                      <span>{item.views}</span>
                      <span className="text-[#EF233C] font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Watch Review <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
