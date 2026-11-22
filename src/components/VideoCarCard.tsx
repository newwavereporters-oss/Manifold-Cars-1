import React, { useState } from 'react';
import { Play, Heart, ShieldCheck, Eye, Video, CarFront } from 'lucide-react';
import { Car } from '../types';
import { FORMAT_CURRENCY, FORMAT_NUMBER } from '../data/mockCars';
import {
  getCarCardPrimaryImage,
  getCarVideoAvailability,
  resolveCarYouTubeVideoId,
} from '../utils/carMedia';
import { getYouTubeFallbackThumbnailUrl } from '../utils/youtube';

interface VideoCarCardProps {
  car: Car;
  isFavorite: boolean;
  onToggleFavorite: (carId: string) => void;
  onSelectCar: (car: Car) => void;
  onPlayVideo: (car: Car) => void;
  onInterested: (car: Car) => void;
}

export const VideoCarCard: React.FC<VideoCarCardProps> = ({
  car,
  isFavorite,
  onToggleFavorite,
  onSelectCar,
  onPlayVideo,
  onInterested,
}) => {
  const videoId = resolveCarYouTubeVideoId(car);
  const videoAvailability = getCarVideoAvailability(car);
  const hasVideo = videoAvailability === 'available';

  const initialImage = getCarCardPrimaryImage(car);
  const [imgSrc, setImgSrc] = useState<string>(initialImage);
  const [imgExhausted, setImgExhausted] = useState<boolean>(!initialImage);

  const handleMediaClick = () => {
    if (hasVideo) {
      onPlayVideo(car);
    } else {
      onSelectCar(car);
    }
  };

  const handleImageError = () => {
    const ytFallback = videoId ? getYouTubeFallbackThumbnailUrl(videoId) : '';
    const photo1 = (car.gallery_image_1_url || '').trim();
    const photo2 = (car.gallery_image_2_url || '').trim();

    if (ytFallback && imgSrc !== ytFallback && !imgSrc.includes('hqdefault.jpg')) {
      setImgSrc(ytFallback);
      return;
    }
    if (photo1 && imgSrc !== photo1) {
      setImgSrc(photo1);
      return;
    }
    if (photo2 && imgSrc !== photo2) {
      setImgSrc(photo2);
      return;
    }
    setImgExhausted(true);
  };

  const subtitleMeta = [car.year, car.trim].filter(Boolean).join(' · ');

  return (
    <div className="group bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-xl hover:border-gray-300 transition-all duration-200 flex flex-col">
      {/* 16:9 MEDIA CONTAINER */}
      <div
        onClick={handleMediaClick}
        className="relative aspect-[16/9] w-full bg-[#071A2B] overflow-hidden cursor-pointer"
      >
        {!imgExhausted && imgSrc ? (
          <img
            src={imgSrc}
            alt={car.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover filter brightness-[0.92] group-hover:scale-105 transition-transform duration-300 ease-out"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#071A2B] to-[#0B2239] text-gray-300 p-4 text-center">
            <CarFront className="w-10 h-10 text-gray-400 mb-1.5" />
            <span className="text-xs font-bold text-white">{car.title}</span>
          </div>
        )}

        {/* Video Scrim & Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5">
            {car.is_featured && (
              <span className="bg-[#EF233C] text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded shadow">
                FEATURED
              </span>
            )}
            {car.verification.is_verified && (
              <span className="bg-[#071A2B]/90 backdrop-blur-sm text-gray-100 text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 border border-white/10">
                <ShieldCheck className="w-3 h-3 text-[#EF233C]" />
                <span>VERIFIED</span>
              </span>
            )}
          </div>

          {hasVideo ? (
            <span className="bg-black/70 backdrop-blur-sm text-white text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded">
              {car.video.video_duration || '12:00'}
            </span>
          ) : (
            <span className="bg-[#071A2B]/85 backdrop-blur-sm text-gray-200 text-[10px] font-semibold px-2 py-0.5 rounded border border-white/15">
              Photos Ready
            </span>
          )}
        </div>

        {/* Center Overlay: Play Video vs Video Loading Placeholder */}
        {hasVideo ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
            <div className="w-13 h-13 rounded-full bg-[#EF233C]/95 group-hover:bg-[#EF233C] text-white flex items-center justify-center shadow-xl group-hover:scale-110 active:scale-95 transition-all duration-150">
              <Play className="w-6 h-6 fill-current ml-0.5" />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
            <div className="bg-[#071A2B]/80 backdrop-blur-sm border border-white/15 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg">
              <Video className="w-3.5 h-3.5 text-[#EF233C] shrink-0" />
              <span className="text-[11px] font-semibold tracking-wide">Video loading...</span>
            </div>
          </div>
        )}

        {/* Bottom Video Kicker */}
        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between pointer-events-none text-white/90">
          <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide">
            <span
              className={`w-1.5 h-1.5 rounded-full ${hasVideo ? 'bg-[#EF233C]' : 'bg-amber-400'}`}
            />
            <span className="drop-shadow-sm font-semibold">
              {hasVideo ? 'MANIFOLD REVIEW' : 'VIDEO LOADING...'}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-medium text-gray-300">
            <Eye className="w-3.5 h-3.5" />
            <span className="tabular-nums">{FORMAT_NUMBER(car.views_count)}</span>
          </div>
        </div>
      </div>

      {/* Card Body Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        {/* Title & Dedicated Year/Trim Metadata */}
        <div>
          <button
            type="button"
            onClick={() => onSelectCar(car)}
            className="text-left font-bold text-base text-[#071A2B] group-hover:text-[#EF233C] transition-colors leading-snug line-clamp-1 cursor-pointer"
          >
            {car.title}
          </button>

          {subtitleMeta && (
            <div className="text-[11px] font-semibold text-gray-500 mt-0.5 tabular-nums">
              {subtitleMeta}
            </div>
          )}

          {/* Clean Specs Row with typographic dot separators */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1.5 font-medium flex-wrap">
            <span className="text-gray-700">{car.location.split(',')[0]}</span>
            <span aria-hidden="true" className="text-gray-300">·</span>
            <span>{car.transmission}</span>
            <span aria-hidden="true" className="text-gray-300">·</span>
            <span>{car.fuel_type}</span>
            <span aria-hidden="true" className="text-gray-300">·</span>
            <span className="tabular-nums">{FORMAT_NUMBER(car.mileage)} km</span>
          </div>
        </div>

        {/* Price & Primary Action Row */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">
              {car.condition}
            </div>
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-base sm:text-xl font-extrabold text-[#071A2B] tabular-nums font-display whitespace-nowrap">
                {FORMAT_CURRENCY(car.price)}
              </span>
              {car.original_price && car.original_price > car.price && (
                <span className="text-[11px] sm:text-xs text-gray-400 line-through tabular-nums whitespace-nowrap hidden min-[400px]:inline">
                  {FORMAT_CURRENCY(car.original_price)}
                </span>
              )}
            </div>
          </div>

          {/* Actions: Favorite & Primary 'I'm Interested' */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onToggleFavorite(car.id)}
              className={`p-2 rounded border transition-colors shrink-0 ${
                isFavorite
                  ? 'bg-red-50 border-red-200 text-[#EF233C]'
                  : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
              aria-label={isFavorite ? 'Remove from saved' : 'Save vehicle'}
              title="Save vehicle"
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => onInterested(car)}
              className="px-2.5 sm:px-3.5 py-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-[11px] sm:text-xs font-bold uppercase tracking-wider rounded shadow-sm hover:shadow transition-all whitespace-nowrap shrink-0 active:scale-95 cursor-pointer"
            >
              I'm Interested
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
