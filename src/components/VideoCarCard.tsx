import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    setImgSrc(initialImage);
    setImgExhausted(!initialImage);
  }, [car.id, initialImage]);

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

  const primaryLocation = (car.location || car.state || 'Lagos').split(',')[0].trim();
  const subtitleMeta = [car.year, car.trim, primaryLocation].filter(Boolean).join(' · ');

  return (
    <article className="group h-full bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-xl hover:border-gray-300 transition-all duration-200 flex flex-col">
      {/* 16:9 MEDIA CONTAINER */}
      <div
        onClick={handleMediaClick}
        className="relative aspect-[16/9] w-full bg-[#071A2B] overflow-hidden cursor-pointer shrink-0"
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
            <span className="text-xs font-bold text-white line-clamp-1">{car.title}</span>
          </div>
        )}

        {/* Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/35 pointer-events-none" />

        {/* Top Bar */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
          <div className="flex items-center gap-1.5 min-w-0">
            {car.is_featured && (
              <span className="bg-[#EF233C] text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded shadow whitespace-nowrap">
                FEATURED
              </span>
            )}
            {car.verification.is_verified && (
              <span className="bg-[#071A2B]/90 backdrop-blur-sm text-gray-100 text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 border border-white/10 whitespace-nowrap">
                <ShieldCheck className="w-3 h-3 text-[#EF233C] shrink-0" />
                <span>VERIFIED</span>
              </span>
            )}
          </div>

          {hasVideo ? (
            <span className="bg-black/75 backdrop-blur-sm text-white text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded whitespace-nowrap shrink-0">
              {car.video.video_duration || '12:00'}
            </span>
          ) : (
            <span className="bg-[#071A2B]/85 backdrop-blur-sm text-gray-200 text-[10px] font-semibold px-2 py-0.5 rounded border border-white/15 whitespace-nowrap shrink-0">
              Photos Ready
            </span>
          )}
        </div>

        {/* Center Overlay */}
        {hasVideo ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
            <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#EF233C]/95 group-hover:bg-[#EF233C] text-white flex items-center justify-center shadow-xl group-hover:scale-110 active:scale-95 transition-all duration-150">
              <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
            <div className="bg-[#071A2B]/85 backdrop-blur-sm border border-white/15 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg">
              <Video className="w-3.5 h-3.5 text-[#EF233C] shrink-0" />
              <span className="text-[11px] font-semibold tracking-wide">Video loading...</span>
            </div>
          </div>
        )}

        {/* Bottom Kicker */}
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
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => onSelectCar(car)}
            className="w-full text-left font-bold text-base text-[#071A2B] group-hover:text-[#EF233C] transition-colors leading-snug line-clamp-1 cursor-pointer"
          >
            {car.title}
          </button>

          <div className="text-[11px] font-semibold text-gray-500 mt-0.5 tabular-nums line-clamp-1">
            {subtitleMeta}
          </div>

          {/* Clean Specs Row with typographic dot separators */}
          <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-1.5 font-medium flex-wrap">
            <span>{car.transmission}</span>
            <span aria-hidden="true" className="text-gray-300">·</span>
            <span>{car.fuel_type}</span>
            <span aria-hidden="true" className="text-gray-300">·</span>
            <span className="tabular-nums">{FORMAT_NUMBER(car.mileage)} km</span>
          </div>
        </div>

        {/* Price & Action Zone — Responsive so narrow mobile viewports never squeeze text */}
        <div className="pt-2.5 border-t border-gray-100 flex flex-col min-[380px]:flex-row min-[380px]:items-center justify-between gap-2.5">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {car.condition}
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg sm:text-xl font-extrabold text-[#071A2B] tabular-nums font-display whitespace-nowrap">
                {FORMAT_CURRENCY(car.price)}
              </span>
              {car.original_price && car.original_price > car.price && (
                <span className="text-[11px] text-gray-400 line-through tabular-nums whitespace-nowrap">
                  {FORMAT_CURRENCY(car.original_price)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleFavorite(car.id)}
              className={`h-10 w-10 sm:h-9 sm:w-9 flex items-center justify-center rounded-lg border transition-colors shrink-0 cursor-pointer ${
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
              className="flex-1 min-[380px]:flex-initial h-10 sm:h-9 px-3.5 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm hover:shadow transition-all whitespace-nowrap shrink-0 active:scale-95 cursor-pointer flex items-center justify-center"
            >
              I'm Interested
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
