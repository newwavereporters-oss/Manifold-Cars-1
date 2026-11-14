import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Megaphone, Sparkles } from 'lucide-react';
import { GameBillboardItem } from '../../services/billboardService';

interface GameBillboardOverlayProps {
  items: GameBillboardItem[];
  onOpenListing: (slug: string) => void;
  onBrowseMarketplace?: () => void;
  hidden?: boolean;
}

function formatNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString('en-NG')}`;
}

export const GameBillboardOverlay: React.FC<GameBillboardOverlayProps> = ({
  items,
  onOpenListing,
  onBrowseMarketplace,
  hidden = false,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [brokenImageIds, setBrokenImageIds] = useState<Record<string, boolean>>({});
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeIndex >= items.length) {
      setActiveIndex(0);
    }
  }, [items.length, activeIndex]);

  // Smooth auto-sliding carousel; pauses while hovering, swiping, or interacting
  useEffect(() => {
    if (hidden || items.length <= 1 || isPaused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [hidden, items.length, isPaused]);

  if (hidden) return null;

  // Graceful compact fallback when no active dealer promotion exists yet
  if (items.length === 0) {
    return (
      <div
        className="pointer-events-auto w-[min(94vw,470px)] mx-auto"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onBrowseMarketplace?.()}
          className="w-full h-[54px] sm:h-[60px] px-3.5 rounded-2xl bg-[#071A2B]/85 hover:bg-[#0B2339]/90 backdrop-blur-md border border-white/15 shadow-2xl flex items-center justify-between gap-3 text-left transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <Megaphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Dealership Spotlight Billboard
              </div>
              <p className="text-xs text-slate-300 truncate">
                Verified dealer offers appear here · Explore live marketplace inventory
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1.5 rounded-lg bg-[#EF233C] text-white text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0">
            Marketplace
          </span>
        </button>
      </div>
    );
  }

  const current = items[activeIndex % items.length];
  const hasDiscount =
    typeof current.previous_price === 'number' && current.previous_price > current.price;
  const imgBroken = Boolean(brokenImageIds[current.assignment_id]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev + 1) % items.length);
  };

  return (
    <div
      className="pointer-events-auto w-[min(94vw,560px)] mx-auto select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => {
        setIsPaused(true);
        touchStartXRef.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const startX = touchStartXRef.current;
        const endX = e.changedTouches[0]?.clientX ?? null;
        if (startX !== null && endX !== null && Math.abs(endX - startX) > 36 && items.length > 1) {
          if (endX < startX) {
            setActiveIndex((prev) => (prev + 1) % items.length);
          } else {
            setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
          }
        }
        touchStartXRef.current = null;
        window.setTimeout(() => setIsPaused(false), 1800);
      }}
      aria-label="Dealer Promotional Billboard"
    >
      {/* Suspended Automotive Gantry / Frame */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpenListing(current.slug)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenListing(current.slug);
          }
        }}
        className="group relative rounded-2xl bg-[#061523]/92 hover:bg-[#081D30]/95 backdrop-blur-md border border-amber-400/35 shadow-[0_14px_34px_rgba(0,0,0,0.55)] overflow-hidden cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2.5 sm:gap-3.5 p-2 sm:p-2.5">
          {/* Prev Slide Arrow */}
          {items.length > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              className="w-7 h-10 sm:w-8 sm:h-12 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center shrink-0 transition-colors"
              aria-label="Previous featured vehicle"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Vehicle Thumbnail */}
          <div className="relative w-16 h-12 sm:w-24 sm:h-14 rounded-xl overflow-hidden bg-slate-900 border border-white/10 shrink-0">
            {!imgBroken && current.image_url ? (
              <img
                src={current.image_url}
                alt={current.title}
                referrerPolicy="no-referrer"
                onError={() =>
                  setBrokenImageIds((prev) => ({ ...prev, [current.assignment_id]: true }))
                }
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 text-amber-300">
                <Sparkles className="w-5 h-5" />
              </div>
            )}
          </div>

          {/* Core Vehicle Deal Copy */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] text-amber-300 font-semibold truncate">
              <span className="truncate">{current.dealer_name}</span>
              {current.location && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-400 truncate hidden sm:inline">{current.location}</span>
                </>
              )}
              {items.length > 1 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-400 tabular-nums shrink-0">
                    {(activeIndex % items.length) + 1}/{items.length}
                  </span>
                </>
              )}
            </div>

            <div className="text-xs sm:text-sm font-black text-white truncate mt-0.5">
              {current.title}
            </div>

            <p className="text-[10px] sm:text-[11px] text-slate-300 truncate hidden sm:block">
              {current.short_description}
            </p>
          </div>

          {/* Price + CTA Column */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-baseline gap-1.5">
              {hasDiscount && current.previous_price && (
                <span className="text-[10px] font-mono text-slate-400 line-through tabular-nums hidden sm:inline">
                  {formatNaira(current.previous_price)}
                </span>
              )}
              <span className="text-xs sm:text-sm font-black font-mono text-emerald-300 tabular-nums">
                {formatNaira(current.price)}
              </span>
            </div>

            <span className="px-2.5 py-1 rounded-lg bg-[#EF233C] group-hover:bg-[#d90429] text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1 whitespace-nowrap shadow-md">
              <span>See Discounted Price</span>
              <ExternalLink className="w-2.5 h-2.5 hidden sm:inline" />
            </span>
          </div>

          {/* Next Slide Arrow */}
          {items.length > 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="w-7 h-10 sm:w-8 sm:h-12 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center shrink-0 transition-colors"
              aria-label="Next featured vehicle"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
