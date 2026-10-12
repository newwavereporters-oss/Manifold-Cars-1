import React from 'react';
import { X, ShieldCheck, Play, ArrowRight, CheckCircle2, MapPin, Gauge, Fuel, Cog } from 'lucide-react';
import { Car } from '../../types';

interface VehicleInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  car: Car | null;
  onViewDetails: (car: Car) => void;
  onPlayVideo: (car: Car) => void;
  onInterested: (car: Car) => void;
  onDriveThisCar?: (car: Car) => void;
}

export const VehicleInspectorModal: React.FC<VehicleInspectorModalProps> = ({
  isOpen,
  onClose,
  car,
  onViewDetails,
  onPlayVideo,
  onInterested,
  onDriveThisCar,
}) => {
  if (!isOpen || !car) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#071A2B] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-[#071A2B]/80 hover:bg-[#071A2B] text-white rounded-full border border-white/20 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Vehicle Image Header */}
        <div className="relative h-60 w-full bg-slate-900 overflow-hidden">
          <img
            src={car.gallery_image_1_url}
            alt={car.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071A2B] via-transparent to-transparent" />

          {/* Condition & Verification Badge */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="px-2.5 py-1 bg-black/70 backdrop-blur-sm text-white text-xs font-bold uppercase rounded-lg border border-white/10">
              {car.condition}
            </span>
            {car.verification?.is_verified && (
              <span className="px-2.5 py-1 bg-[#EF233C] text-white text-xs font-bold uppercase rounded-lg flex items-center gap-1 shadow-md">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Physically Verified</span>
              </span>
            )}
          </div>

          {/* Video Preview Button Overlay */}
          {car.video && (
            <button
              onClick={() => {
                onClose();
                onPlayVideo(car);
              }}
              className="absolute bottom-4 right-4 flex items-center gap-2 px-3.5 py-2 bg-white/90 hover:bg-white text-slate-900 text-xs font-bold uppercase rounded-xl shadow-lg transition-transform hover:scale-105"
            >
              <Play className="w-4 h-4 fill-slate-900" />
              <span>Watch Video Walkaround</span>
            </button>
          )}
        </div>

        {/* Vehicle Details */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#EF233C]">
                Showroom Featured Model
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                {car.title}
              </h3>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span>{car.location} · Dealer: {car.dealer?.name || 'Verified Dealer'}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                Verified Price
              </span>
              <span className="text-xl sm:text-2xl font-black text-white font-mono">
                ₦{car.price.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Key Specs Pills */}
          <div className="grid grid-cols-4 gap-2.5 mt-5">
            <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 text-center">
              <Gauge className="w-4 h-4 text-gray-400 mx-auto mb-1" />
              <span className="text-[10px] text-gray-400 block uppercase">Mileage</span>
              <span className="text-xs font-bold text-white font-mono">
                {car.mileage.toLocaleString()} km
              </span>
            </div>
            <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 text-center">
              <Cog className="w-4 h-4 text-gray-400 mx-auto mb-1" />
              <span className="text-[10px] text-gray-400 block uppercase">Gearbox</span>
              <span className="text-xs font-bold text-white truncate block">
                {car.transmission}
              </span>
            </div>
            <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 text-center">
              <Fuel className="w-4 h-4 text-gray-400 mx-auto mb-1" />
              <span className="text-[10px] text-gray-400 block uppercase">Fuel</span>
              <span className="text-xs font-bold text-white truncate block">
                {car.fuel_type}
              </span>
            </div>
            <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 text-center">
              <ShieldCheck className="w-4 h-4 text-[#EF233C] mx-auto mb-1" />
              <span className="text-[10px] text-gray-400 block uppercase">Inspection</span>
              <span className="text-xs font-bold text-emerald-400">Passed</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 pt-5 border-t border-white/10">
            <button
              onClick={() => {
                onClose();
                onViewDetails(car);
              }}
              className="py-3 px-4 bg-[#EF233C] hover:bg-[#d90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2"
            >
              <span>View Full Marketplace Listing</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                onClose();
                onInterested(car);
              }}
              className="py-3 px-4 bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <span>Request Concierge Inspection</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
