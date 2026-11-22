import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  Play,
  Heart,
  Share2,
  PhoneCall,
  FileCheck,
  ArrowLeft,
  Video,
  Image as ImageIcon,
  CarFront,
  ExternalLink,
} from 'lucide-react';
import { Car } from '../types';
import { FORMAT_CURRENCY, FORMAT_NUMBER } from '../data/mockCars';
import { VideoCarCard } from '../components/VideoCarCard';
import { PriceIntelligenceCard } from '../components/ai/PriceIntelligenceCard';
import { resolveCarYouTubeVideoId } from '../utils/carMedia';
import { dealerService } from '../services/dealerService';
import { getDealerPermalinkSlug } from '../utils/dealerSlug';

interface CarDetailPageProps {
  car: Car;
  allCars: Car[];
  isFavorite: boolean;
  onToggleFavorite: (carId: string) => void;
  onInterested: (car: Car) => void;
  onPlayVideo: (car: Car) => void;
  onSelectCar: (car: Car) => void;
  onAskAi?: () => void;
  navigate: (route: string) => void;
}

export const CarDetailPage: React.FC<CarDetailPageProps> = ({
  car,
  allCars,
  isFavorite,
  onToggleFavorite,
  onInterested,
  onPlayVideo,
  onSelectCar,
  onAskAi,
  navigate,
}) => {
  const videoId = resolveCarYouTubeVideoId(car);
  const hasVideo = Boolean(videoId);
  const hasPhoto1 = Boolean((car.gallery_image_1_url || '').trim());
  const hasPhoto2 = Boolean((car.gallery_image_2_url || '').trim());

  const getDefaultTab = (): 'video' | 'gallery1' | 'gallery2' => {
    if (hasVideo) return 'video';
    if (hasPhoto1) return 'gallery1';
    if (hasPhoto2) return 'gallery2';
    return 'video';
  };

  const [activeMediaTab, setActiveMediaTab] = useState<'video' | 'gallery1' | 'gallery2'>(
    getDefaultTab
  );
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; title: string } | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [videoPlaybackFailed, setVideoPlaybackFailed] = useState(false);
  const [photo1Error, setPhoto1Error] = useState(false);
  const [photo2Error, setPhoto2Error] = useState(false);

  useEffect(() => {
    setActiveMediaTab(getDefaultTab());
    setVideoPlaybackFailed(false);
    setPhoto1Error(false);
    setPhoto2Error(false);
  }, [car.id]);

  const [dealerPermalinkSlug, setDealerPermalinkSlug] = useState<string>(() =>
    getDealerPermalinkSlug(
      { id: car.dealer.id, name: car.dealer.name },
      dealerService.getPublicDealersSync()
    )
  );

  useEffect(() => {
    let mounted = true;
    const syncList = dealerService.getPublicDealersSync();
    if (syncList.length > 0) {
      setDealerPermalinkSlug(
        getDealerPermalinkSlug({ id: car.dealer.id, name: car.dealer.name }, syncList)
      );
    } else {
      dealerService
        .getPublicDealers()
        .then((list) => {
          if (mounted) {
            setDealerPermalinkSlug(
              getDealerPermalinkSlug({ id: car.dealer.id, name: car.dealer.name }, list)
            );
          }
        })
        .catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, [car.dealer.id, car.dealer.name]);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    }
  };

  const similarCars = allCars
    .filter((c) => c.id !== car.id && (c.body_type === car.body_type || c.make === car.make))
    .slice(0, 3);

  const specsList = [
    { label: 'Year', value: car.year.toString() },
    { label: 'Make', value: car.make },
    { label: 'Model', value: car.model },
    { label: 'Trim', value: car.trim },
    { label: 'Body Type', value: car.body_type },
    { label: 'Condition', value: car.condition },
    { label: 'Mileage', value: `${FORMAT_NUMBER(car.mileage)} km` },
    { label: 'Transmission', value: car.transmission },
    { label: 'Fuel Type', value: car.fuel_type },
    { label: 'Drive Type', value: car.drive_type },
    { label: 'Engine', value: car.engine },
    { label: 'Exterior Color', value: car.exterior_color },
    { label: 'Interior Color', value: car.interior_color },
    { label: 'Seats', value: `${car.seats} Seats` },
    { label: 'Doors', value: `${car.doors} Doors` },
    { label: 'Location', value: car.location },
  ].filter((item) => Boolean(item.value && String(item.value).trim()));

  return (
    <div className="min-h-screen bg-[#F7F8FA] pt-24 pb-24 md:pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 overflow-x-auto whitespace-nowrap pb-1">
          <button onClick={() => navigate('/')} className="hover:text-gray-900 shrink-0 cursor-pointer">
            Home
          </button>
          <span className="shrink-0">/</span>
          <button onClick={() => navigate('/cars')} className="hover:text-gray-900 shrink-0 cursor-pointer">
            Cars
          </button>
          <span className="shrink-0">/</span>
          <button
            onClick={() => navigate(`/cars?make=${encodeURIComponent(car.make)}`)}
            className="hover:text-gray-900 shrink-0 cursor-pointer"
          >
            {car.make}
          </button>
          <span className="shrink-0">/</span>
          <span className="text-gray-900 font-medium truncate max-w-[200px] sm:max-w-xs">
            {car.title}
          </span>
        </div>

        {/* Back Link */}
        <button
          type="button"
          onClick={() => navigate('/cars')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-[#EF233C] mb-5 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Vehicles</span>
        </button>

        {/* Top Title & Price Block */}
        <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-[#EF233C]">
                {car.condition}
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-xs font-bold text-[#071A2B] tabular-nums">{car.year}</span>
              {car.trim && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs font-semibold text-gray-600">{car.trim}</span>
                </>
              )}
              <span className="text-gray-300">·</span>
              <span className="text-xs font-medium text-gray-500">{car.location}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#071A2B] tracking-tight font-display break-words">
              {car.title}
            </h1>

            <div className="flex items-center gap-2 text-xs text-gray-500 mt-2 font-medium flex-wrap">
              <span>{car.transmission}</span>
              <span className="text-gray-300">·</span>
              <span>{car.fuel_type}</span>
              <span className="text-gray-300">·</span>
              <span className="tabular-nums">{FORMAT_NUMBER(car.mileage)} km</span>
              <span className="text-gray-300">·</span>
              <span>{car.drive_type}</span>
            </div>
          </div>

          <div className="flex flex-col md:items-end pt-3 md:pt-0 border-t md:border-t-0 border-gray-100">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#071A2B] tabular-nums font-display whitespace-nowrap">
              {FORMAT_CURRENCY(car.price)}
            </span>
            {car.original_price && (
              <span className="text-xs text-gray-400 line-through tabular-nums mt-0.5 whitespace-nowrap">
                Was {FORMAT_CURRENCY(car.original_price)}
              </span>
            )}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => onToggleFavorite(car.id)}
                className={`h-10 sm:h-9 px-3.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
                  isFavorite
                    ? 'bg-red-50 text-[#EF233C] border-red-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
                <span>{isFavorite ? 'Saved' : 'Save'}</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="h-10 sm:h-9 px-3.5 rounded-lg border bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200 text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{copiedShare ? 'Link Copied!' : 'Share'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* SIGNATURE MANIFOLD MEDIA HIERARCHY:
            1. PRIMARY VIDEO FIRST (16:9 dominant embed/player)
            2. TWO STATIC GALLERY IMAGES SECOND
        */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
          {/* Main Media Viewer (Col 8) */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
            <div className="relative aspect-video w-full bg-[#071A2B]">
              {activeMediaTab === 'video' ? (
                hasVideo && !videoPlaybackFailed ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0`}
                    title={car.video.video_title || car.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onError={() => setVideoPlaybackFailed(true)}
                  />
                ) : (
                  <div className="w-full h-full relative flex flex-col items-center justify-center text-white p-6 text-center">
                    {(hasPhoto1 || hasPhoto2) && (
                      <img
                        src={car.gallery_image_1_url || car.gallery_image_2_url}
                        alt={car.title}
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover opacity-25"
                      />
                    )}
                    <div className="relative z-10 max-w-md space-y-2.5 bg-[#071A2B]/85 backdrop-blur-sm p-5 rounded-2xl border border-white/15">
                      <Video className="w-7 h-7 text-[#EF233C] mx-auto" />
                      <p className="text-sm font-bold text-white">
                        {videoPlaybackFailed ? 'Video playback unavailable' : 'Video loading...'}
                      </p>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        {videoPlaybackFailed
                          ? 'The embedded video could not load in this view. You can inspect vehicle photos or request a fresh walkaround via Concierge.'
                          : 'A walkaround video has not been attached to this listing yet. Browse all available photos and full specifications below.'}
                      </p>
                      {(hasPhoto1 || hasPhoto2) && (
                        <button
                          type="button"
                          onClick={() => setActiveMediaTab(hasPhoto1 ? 'gallery1' : 'gallery2')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>View Vehicle Photos</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              ) : activeMediaTab === 'gallery1' && hasPhoto1 && !photo1Error ? (
                <img
                  src={car.gallery_image_1_url}
                  alt={`${car.title} gallery exterior`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setPhoto1Error(true)}
                />
              ) : activeMediaTab === 'gallery2' && hasPhoto2 && !photo2Error ? (
                <img
                  src={car.gallery_image_2_url}
                  alt={`${car.title} gallery interior showroom`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setPhoto2Error(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 p-6 text-center">
                  <CarFront className="w-10 h-10 text-gray-400 mb-2" />
                  <span className="text-xs font-semibold">Vehicle preview photo unavailable</span>
                </div>
              )}
            </div>

            {/* Media Selector Strip (Photos & Video) */}
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-0.5">
                <button
                  type="button"
                  onClick={() => setActiveMediaTab('video')}
                  className={`h-10 flex items-center gap-2 px-3.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer whitespace-nowrap shrink-0 ${
                    activeMediaTab === 'video'
                      ? 'bg-[#EF233C] text-white shadow'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {hasVideo ? (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Video Review ({car.video.video_duration || '12:00'})</span>
                    </>
                  ) : (
                    <>
                      <Video className="w-3.5 h-3.5" />
                      <span>Video loading...</span>
                    </>
                  )}
                </button>

                {hasPhoto1 && (
                  <button
                    type="button"
                    onClick={() => setActiveMediaTab('gallery1')}
                    className={`h-10 flex items-center gap-2 px-3.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer whitespace-nowrap shrink-0 ${
                      activeMediaTab === 'gallery1'
                        ? 'bg-[#071A2B] text-white shadow'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span>Photo 1</span>
                  </button>
                )}

                {hasPhoto2 && (
                  <button
                    type="button"
                    onClick={() => setActiveMediaTab('gallery2')}
                    className={`h-10 flex items-center gap-2 px-3.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer whitespace-nowrap shrink-0 ${
                      activeMediaTab === 'gallery2'
                        ? 'bg-[#071A2B] text-white shadow'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span>Photo 2</span>
                  </button>
                )}
              </div>

              {activeMediaTab !== 'video' &&
                ((activeMediaTab === 'gallery1' && hasPhoto1 && !photo1Error) ||
                  (activeMediaTab === 'gallery2' && hasPhoto2 && !photo2Error)) && (
                  <button
                    type="button"
                    onClick={() =>
                      setEnlargedImage({
                        url:
                          activeMediaTab === 'gallery1'
                            ? car.gallery_image_1_url
                            : car.gallery_image_2_url,
                        title: `${car.title} - ${
                          activeMediaTab === 'gallery1' ? 'Gallery Photo 1' : 'Gallery Photo 2'
                        }`,
                      })
                    }
                    className="text-xs font-bold text-[#071A2B] hover:text-[#EF233C] flex items-center gap-1 cursor-pointer"
                  >
                    <span>Enlarge Full Resolution</span>
                  </button>
                )}
            </div>

            {/* Gallery Preview Tiles */}
            {(hasPhoto1 || hasPhoto2) && (
              <div className={`p-3 bg-white border-t border-gray-100 grid gap-3 ${hasPhoto1 && hasPhoto2 ? 'grid-cols-2' : 'grid-cols-1 max-w-sm'}`}>
                {hasPhoto1 && (
                  <div
                    onClick={() =>
                      setEnlargedImage({
                        url: car.gallery_image_1_url,
                        title: `${car.title} - Gallery Image 1`,
                      })
                    }
                    className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 cursor-pointer group bg-gray-100"
                  >
                    <img
                      src={car.gallery_image_1_url}
                      alt={`${car.title} gallery 1`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition bg-black/75 text-white text-[10px] font-bold px-2 py-1 rounded">
                        Click to Enlarge Photo 1
                      </span>
                    </div>
                    <span className="absolute bottom-1.5 left-1.5 bg-[#071A2B]/85 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      Gallery Photo 1
                    </span>
                  </div>
                )}

                {hasPhoto2 && (
                  <div
                    onClick={() =>
                      setEnlargedImage({
                        url: car.gallery_image_2_url,
                        title: `${car.title} - Gallery Image 2`,
                      })
                    }
                    className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 cursor-pointer group bg-gray-100"
                  >
                    <img
                      src={car.gallery_image_2_url}
                      alt={`${car.title} gallery 2`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition bg-black/75 text-white text-[10px] font-bold px-2 py-1 rounded">
                        Click to Enlarge Photo 2
                      </span>
                    </div>
                    <span className="absolute bottom-1.5 left-1.5 bg-[#071A2B]/85 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      Gallery Photo 2
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Concierge Action Box & Verification (Col 4 — 2-col side-by-side on tablet md) */}
          <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-5 items-start">
            {/* MANIFOLD Verification Badge Card */}
            <div className="bg-white rounded-xl p-5 border border-emerald-200 shadow-sm space-y-3 h-full">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span className="font-extrabold text-xs uppercase tracking-wider text-[#071A2B]">
                  MANIFOLD VERIFIED VEHICLE
                </span>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                This vehicle has been physically inspected by our automotive audit team. Verified
                information:
              </p>

              <ul className="space-y-2 text-xs text-gray-700">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Dealer partner vetted & registered</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Vehicle physically inspected on lot</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {hasVideo
                      ? 'Full video walkaround recorded'
                      : 'Video walkaround upload pending'}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Price confirmed & customs documents audited</span>
                </li>
              </ul>

              <div className="pt-2 text-[11px] text-gray-400 border-t border-gray-100 flex items-center justify-between">
                <span>Verified: {car.verification.verified_date}</span>
                <span className="font-semibold text-emerald-700 tabular-nums">
                  Audit Score: {car.verification.inspection_score}/100
                </span>
              </div>
            </div>

            {/* Concierge Engagement Card (No Direct Dealer Phone Numbers!) */}
            <div className="bg-[#071A2B] text-white rounded-xl p-5 sm:p-6 shadow-xl space-y-4 h-full">
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#EF233C]">
                  PURCHASE CONCIERGE
                </span>
                <h3 className="text-lg font-bold font-display text-white">
                  MANIFOLD Manages Your Enquiry
                </h3>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Listed by partner dealer{' '}
                  <button
                    type="button"
                    onClick={() => navigate(`/${dealerPermalinkSlug}`)}
                    className="inline-flex items-center gap-1 font-bold text-white underline decoration-[#EF233C]/70 hover:text-[#EF233C] transition cursor-pointer"
                  >
                    <span>{car.dealer.name}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </button>
                  . We supervise physical viewings, coordinate technical diagnostics, and negotiate
                  directly on your behalf.
                </p>
              </div>

              <div className="pt-1 space-y-2.5">
                <button
                  type="button"
                  onClick={() => onInterested(car)}
                  className="w-full h-12 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>I'm Interested in This Car</span>
                </button>

                <button
                  type="button"
                  onClick={() => (onAskAi ? onAskAi() : onInterested(car))}
                  className="w-full h-11 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider rounded-lg border border-white/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Ask MANIFOLD AI About This Car</span>
                </button>
              </div>

              <div className="pt-3 border-t border-white/10 text-[11px] text-gray-400 space-y-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>No pushy dealer calls</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Escrow & custody options available</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Specifications Grid */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm mb-8 sm:mb-10">
          <div className="flex items-center gap-2 pb-4 mb-5 border-b border-gray-200">
            <FileCheck className="w-5 h-5 text-[#EF233C]" />
            <h2 className="text-base font-extrabold uppercase tracking-wider text-[#071A2B]">
              Vehicle Specifications
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {specsList.map((item, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-[10px] font-bold uppercase text-gray-500 block">
                  {item.label}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-[#071A2B] mt-0.5 block break-words">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Description & Features */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
          {/* Description */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold uppercase tracking-wider text-[#071A2B]">
              MANIFOLD Overview
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {car.description}
            </p>
          </div>

          {/* Key Features */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold uppercase tracking-wider text-[#071A2B]">
              Installed Equipment & Features
            </h3>
            <ul className="space-y-2">
              {car.features.map((feat, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                  <CheckCircle className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Fair Market Price Intelligence Benchmark */}
        <div className="mb-12">
          <PriceIntelligenceCard
            mode="buyer"
            carId={car.id}
            make={car.make}
            model={car.model}
            year={car.year}
            trim={car.trim}
            condition={car.condition}
            mileage={car.mileage}
            location={car.location}
            askingPrice={car.price}
          />
        </div>

        {/* Similar Vehicles */}
        {similarCars.length > 0 && (
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#EF233C]">
                  Recommendations
                </span>
                <h3 className="text-xl sm:text-2xl font-bold font-display text-[#071A2B] uppercase">
                  Similar Verified Cars
                </h3>
              </div>
              <button
                onClick={() => navigate('/cars')}
                className="text-xs font-bold text-[#071A2B] hover:text-[#EF233C] uppercase tracking-wider"
              >
                View all →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {similarCars.map((simCar) => (
                <VideoCarCard
                  key={simCar.id}
                  car={simCar}
                  isFavorite={false}
                  onToggleFavorite={onToggleFavorite}
                  onSelectCar={onSelectCar}
                  onPlayVideo={onPlayVideo}
                  onInterested={onInterested}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Mobile Bottom CTA Bar (compact <= 64px) */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-2.5 flex items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
            {car.condition}
          </span>
          <span className="text-base font-black text-[#071A2B] tabular-nums font-display truncate block">
            {FORMAT_CURRENCY(car.price)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onInterested(car)}
          className="h-10 px-4 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>I'm Interested</span>
        </button>
      </div>

      {/* Lightbox Modal for Gallery Images */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setEnlargedImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between gap-3">
              <p className="text-white text-xs font-semibold truncate">{enlargedImage.title}</p>
              <button
                type="button"
                onClick={() => setEnlargedImage(null)}
                className="text-white hover:text-gray-200 text-xs font-bold uppercase tracking-wider py-2 px-3.5 bg-white/15 hover:bg-white/25 rounded-lg cursor-pointer shrink-0"
              >
                ✕ Close
              </button>
            </div>
            <img
              src={enlargedImage.url}
              alt={enlargedImage.title}
              className="max-w-full max-h-[78vh] object-contain rounded-lg shadow-2xl border border-white/15"
            />
          </div>
        </div>
      )}
    </div>
  );
};
