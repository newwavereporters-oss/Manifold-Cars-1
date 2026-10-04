import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  Play,
  Heart,
  Share2,
  PhoneCall,
  Calendar,
  Gauge,
  Fuel,
  Compass,
  FileCheck,
  ArrowLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Car } from '../types';
import { FORMAT_CURRENCY, FORMAT_NUMBER } from '../data/mockCars';
import { VideoCarCard } from '../components/VideoCarCard';

interface CarDetailPageProps {
  car: Car;
  allCars: Car[];
  isFavorite: boolean;
  onToggleFavorite: (carId: string) => void;
  onInterested: (car: Car) => void;
  onPlayVideo: (car: Car) => void;
  onSelectCar: (car: Car) => void;
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
  navigate,
}) => {
  const [activeMediaTab, setActiveMediaTab] = useState<'video' | 'gallery1' | 'gallery2'>('video');
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; title: string } | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

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
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <button onClick={() => navigate('/')} className="hover:text-gray-900">
            Home
          </button>
          <span>/</span>
          <button onClick={() => navigate('/cars')} className="hover:text-gray-900">
            Cars
          </button>
          <span>/</span>
          <button
            onClick={() => navigate(`/cars?make=${encodeURIComponent(car.make)}`)}
            className="hover:text-gray-900"
          >
            {car.make}
          </button>
          <span>/</span>
          <span className="text-gray-900 font-medium truncate max-w-xs">{car.title}</span>
        </div>

        {/* Back Link */}
        <button
          onClick={() => navigate('/cars')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-[#EF233C] mb-6 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Vehicles</span>
        </button>

        {/* Top Title & Price Block */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#EF233C]">
                {car.condition}
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-xs font-medium text-gray-500">{car.location}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#071A2B] tracking-tight font-display">
              {car.title}
            </h1>

            <div className="flex items-center gap-2 text-xs text-gray-500 mt-2 font-medium">
              <span>{car.transmission}</span>
              <span className="text-gray-300">·</span>
              <span>{car.fuel_type}</span>
              <span className="text-gray-300">·</span>
              <span>{FORMAT_NUMBER(car.mileage)} km</span>
              <span className="text-gray-300">·</span>
              <span>{car.drive_type}</span>
            </div>
          </div>

          <div className="flex flex-col md:items-end">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#071A2B] tabular-nums font-display">
              {FORMAT_CURRENCY(car.price)}
            </span>
            {car.original_price && (
              <span className="text-xs text-gray-400 line-through tabular-nums mt-0.5">
                Was {FORMAT_CURRENCY(car.original_price)}
              </span>
            )}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => onToggleFavorite(car.id)}
                className={`px-3 py-1.5 rounded border text-xs font-bold flex items-center gap-1.5 transition ${
                  isFavorite
                    ? 'bg-red-50 text-[#EF233C] border-red-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
                <span>{isFavorite ? 'Saved' : 'Save'}</span>
              </button>

              <button
                onClick={handleShare}
                className="px-3 py-1.5 rounded border bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200 text-xs font-bold flex items-center gap-1.5 transition"
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
            <div className="relative aspect-video w-full bg-black">
              {activeMediaTab === 'video' ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${car.video.youtube_video_id}?autoplay=0&rel=0`}
                  title={car.video.video_title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : activeMediaTab === 'gallery1' ? (
                <img
                  src={car.gallery_image_1_url}
                  alt={`${car.title} gallery exterior`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <img
                  src={car.gallery_image_2_url}
                  alt={`${car.title} gallery interior showroom`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            {/* Media Selector Strip (Video First, Two Gallery Images Second) */}
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveMediaTab('video')}
                  className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
                    activeMediaTab === 'video'
                      ? 'bg-[#EF233C] text-white shadow'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Primary Video Review ({car.video.video_duration})</span>
                </button>

                <button
                  onClick={() => setActiveMediaTab('gallery1')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
                    activeMediaTab === 'gallery1'
                      ? 'bg-[#071A2B] text-white shadow'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>Photo 1</span>
                </button>

                <button
                  onClick={() => setActiveMediaTab('gallery2')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
                    activeMediaTab === 'gallery2'
                      ? 'bg-[#071A2B] text-white shadow'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>Photo 2</span>
                </button>
              </div>

              {activeMediaTab !== 'video' && (
                <button
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

            {/* PART 19: Gallery Two Images Preview Tiles (Click to enlarge) */}
            <div className="p-3 bg-white border-t border-gray-100 grid grid-cols-2 gap-3">
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
            </div>
          </div>

          {/* Concierge Action Box & Verification (Col 4) */}
          <div className="lg:col-span-4 space-y-5">
            {/* MANIFOLD Verification Badge Card */}
            <div className="bg-white rounded-xl p-5 border border-emerald-200 shadow-sm space-y-3">
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
                  <span>Full video walkaround recorded</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Price confirmed & customs documents audited</span>
                </li>
              </ul>

              <div className="pt-2 text-[11px] text-gray-400 border-t border-gray-100 flex items-center justify-between">
                <span>Verified: {car.verification.verified_date}</span>
                <span className="font-semibold text-emerald-700">Audit Score: {car.verification.inspection_score}/100</span>
              </div>
            </div>

            {/* Concierge Engagement Card (No Direct Dealer Phone Numbers!) */}
            <div className="bg-[#071A2B] text-white rounded-xl p-6 shadow-xl space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#EF233C]">
                  PURCHASE CONCIERGE
                </span>
                <h3 className="text-lg font-bold font-display text-white">
                  MANIFOLD Manages Your Enquiry
                </h3>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Listed by partner dealer <strong className="text-white">{car.dealer.name}</strong>.
                  We supervise physical viewings, coordinate technical diagnostics, and negotiate
                  directly on your behalf.
                </p>
              </div>

              <div className="pt-2 space-y-2.5">
                <button
                  onClick={() => onInterested(car)}
                  className="w-full h-12 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded shadow transition flex items-center justify-center gap-2"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>I'm Interested in This Car</span>
                </button>

                <button
                  onClick={() => onInterested(car)}
                  className="w-full h-11 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider rounded border border-white/20 transition flex items-center justify-center gap-2"
                >
                  <span>Talk to MANIFOLD Advisor</span>
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
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-10">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-gray-200">
            <FileCheck className="w-5 h-5 text-[#EF233C]" />
            <h2 className="text-base font-extrabold uppercase tracking-wider text-[#071A2B]">
              Vehicle Specifications
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {specsList.map((item, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-100">
                <span className="text-[10px] font-bold uppercase text-gray-500 block">
                  {item.label}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-[#071A2B] mt-0.5 block truncate">
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

      {/* Lightbox Modal for Gallery Images */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setEnlargedImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-xs font-bold uppercase tracking-wider py-1 px-3 bg-white/10 rounded cursor-pointer"
            >
              ✕ Close
            </button>
            <img
              src={enlargedImage.url}
              alt={enlargedImage.title}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-white/15"
            />
            <p className="text-white text-xs font-semibold mt-3 text-center">
              {enlargedImage.title}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
