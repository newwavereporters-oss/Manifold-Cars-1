import React from 'react';
import { X, ShieldCheck, PhoneCall, ArrowRight, Video, Image as ImageIcon } from 'lucide-react';
import { Car } from '../types';
import { FORMAT_CURRENCY } from '../data/mockCars';
import { getCarCardPrimaryImage, resolveCarYouTubeVideoId } from '../utils/carMedia';

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  car?: Car | null;
  customVideo?: {
    title: string;
    youtube_video_id: string;
    duration: string;
    description?: string;
  } | null;
  onInterested: (car: Car) => void;
  onViewDetails: (car: Car) => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  isOpen,
  onClose,
  car,
  customVideo,
  onInterested,
  onViewDetails,
}) => {
  if (!isOpen) return null;

  const videoId = car
    ? resolveCarYouTubeVideoId(car)
    : customVideo?.youtube_video_id?.trim() || '';
  const hasVideo = Boolean(videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId));
  const title = car ? car.video?.video_title || car.title : customVideo ? customVideo.title : '';
  const fallbackCover = car ? getCarCardPrimaryImage(car) : '';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[#071A2B] rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl border border-white/15 relative flex flex-col">
        {/* Top Bar */}
        <div className="px-5 py-3.5 bg-[#0B2239] flex items-center justify-between border-b border-white/10 text-white">
          <div className="flex items-center gap-2">
            <span className="bg-[#EF233C] text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded">
              MANIFOLD VIDEO
            </span>
            <span className="text-xs font-semibold text-gray-200 truncate max-w-md">
              {title}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 16:9 Responsive Video Player or Clean Video-Loading Fallback */}
        <div className="relative aspect-video w-full bg-black">
          {hasVideo ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full relative flex flex-col items-center justify-center bg-[#071A2B] text-white p-6 text-center">
              {fallbackCover && (
                <img
                  src={fallbackCover}
                  alt={title}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover opacity-25"
                />
              )}
              <div className="relative z-10 max-w-md space-y-3 bg-[#071A2B]/85 backdrop-blur-sm p-6 rounded-2xl border border-white/15">
                <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center mx-auto">
                  <Video className="w-5 h-5 text-[#EF233C]" />
                </div>
                <h4 className="text-base font-bold text-white">Video loading...</h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  The walkaround video for this vehicle is not attached yet. You can inspect full specifications and available gallery photos on the vehicle detail page.
                </p>
                {car && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewDetails(car);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Open Photos &amp; Specs</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Video Bottom Details & Concierge Actions */}
        <div className="p-5 sm:p-6 bg-[#071A2B] text-white space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg sm:text-xl font-bold font-display text-white">
                {car ? car.title : title}
              </h3>
              {car ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-1 flex-wrap">
                  <span className="text-white font-semibold">{car.year}{car.trim ? ` · ${car.trim}` : ''}</span>
                  <span>·</span>
                  <span className="text-white font-semibold">{car.location}</span>
                  <span>·</span>
                  <span>{car.transmission}</span>
                  <span>·</span>
                  <span>{car.fuel_type}</span>
                  <span>·</span>
                  <span>{car.mileage.toLocaleString()} km</span>
                  <span>·</span>
                  <span className="text-[#EF233C] font-semibold">{car.condition}</span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-1">{customVideo?.description}</p>
              )}
            </div>

            {car && (
              <div className="text-left sm:text-right shrink-0">
                <span className="text-xl sm:text-2xl font-extrabold text-white tabular-nums font-display">
                  {FORMAT_CURRENCY(car.price)}
                </span>
                <p className="text-[11px] text-emerald-400 font-semibold flex items-center sm:justify-end gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>MANIFOLD Verified</span>
                </p>
              </div>
            )}
          </div>

          {/* Action Row */}
          {car && (
            <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-gray-400">
                <span>Dealer: {car.dealer.name}</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onViewDetails(car);
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider rounded border border-white/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Vehicle Specs &amp; Gallery</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onInterested(car);
                  }}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded shadow transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>I'm Interested in This Car</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
