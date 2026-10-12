import React from 'react';
import { X, ArrowRight, ShieldCheck, Video, ExternalLink, Car as CarIcon, CheckCircle2 } from 'lucide-react';
import { Car } from '../../types';
import pavilionImage from '../../assets/images/world_dealership_pavilion_1791804008874.jpg';

interface MarketplaceGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMarketplace: () => void;
  onSelectCar: (car: Car) => void;
  cars: Car[];
}

export const MarketplaceGatewayModal: React.FC<MarketplaceGatewayModalProps> = ({
  isOpen,
  onClose,
  onNavigateToMarketplace,
  onSelectCar,
  cars,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#071A2B] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Banner with generated pavilion asset */}
        <div className="relative h-48 sm:h-64 w-full overflow-hidden shrink-0">
          <img
            src={pavilionImage}
            alt="MANIFOLD Automotive Pavilion"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071A2B] via-[#071A2B]/60 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-[#071A2B]/80 hover:bg-[#071A2B] text-white rounded-full border border-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Title Overlay */}
          <div className="absolute bottom-4 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#EF233C] bg-[#EF233C]/20 border border-[#EF233C]/40 px-2.5 py-0.5 rounded-full">
                  Real Commercial Layer
                </span>
                <span className="text-xs text-gray-300 font-medium">Lagos & Abuja Inventory</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display">
                MANIFOLD Car Marketplace
              </h2>
            </div>
            <button
              onClick={onNavigateToMarketplace}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#EF233C] hover:bg-[#d90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shrink-0"
            >
              <span>Enter Full Marketplace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Value Props Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-[#EF233C] shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-white">100% Physically Verified</h4>
                <p className="text-[11px] text-gray-400">Verified VIN, pricing & mechanicals</p>
              </div>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3">
              <Video className="w-5 h-5 text-[#EF233C] shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-white">Real Video Walkarounds</h4>
                <p className="text-[11px] text-gray-400">Cinematic 4K test drives & reviews</p>
              </div>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#EF233C] shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-white">Zero Dealer Hassle</h4>
                <p className="text-[11px] text-gray-400">Dedicated concierge escrow support</p>
              </div>
            </div>
          </div>

          {/* Quick Vehicle Showcase */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Featured Verified Vehicles ({cars.length})
            </h3>
            <button
              onClick={onNavigateToMarketplace}
              className="text-xs font-bold text-[#EF233C] hover:underline flex items-center gap-1"
            >
              <span>View All Listings</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cars.slice(0, 6).map((car) => (
              <div
                key={car.id}
                onClick={() => {
                  onSelectCar(car);
                  onClose();
                }}
                className="group cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#EF233C]/50 rounded-2xl overflow-hidden transition-all flex flex-col"
              >
                <div className="relative h-28 w-full bg-slate-900 overflow-hidden">
                  <img
                    src={car.gallery_image_1_url}
                    alt={car.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase">
                    {car.condition}
                  </div>
                </div>
                <div className="p-3 flex flex-col justify-between flex-1">
                  <div>
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-[#EF233C] transition-colors">
                      {car.title}
                    </h4>
                    <span className="text-[11px] text-gray-400 block mt-0.5">
                      {car.location} · {car.mileage.toLocaleString()} km
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs font-black text-white font-mono">
                      ₦{car.price.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors">
                      View Details →
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#05111d] border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Route: <code className="text-gray-300">/car-marketplace</code>
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase rounded-xl transition-colors"
            >
              Resume 3D World
            </button>
            <button
              onClick={onNavigateToMarketplace}
              className="px-5 py-2 bg-[#EF233C] hover:bg-[#d90429] text-white text-xs font-bold uppercase rounded-xl transition-colors"
            >
              Proceed to Marketplace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
