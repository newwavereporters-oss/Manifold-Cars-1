import React from 'react';
import { X, Heart, Trash2, ArrowRight, ShieldCheck } from 'lucide-react';
import { Car } from '../types';
import { FORMAT_CURRENCY } from '../data/mockCars';

interface FavoritesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: Car[];
  onRemoveFavorite: (carId: string) => void;
  onSelectCar: (car: Car) => void;
  onInterested: (car: Car) => void;
}

export const FavoritesDrawer: React.FC<FavoritesDrawerProps> = ({
  isOpen,
  onClose,
  favorites,
  onRemoveFavorite,
  onSelectCar,
  onInterested,
}) => {
  if (!isOpen) return null;

  const totalValue = favorites.reduce((acc, car) => acc + car.price, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-gray-200">
          {/* Header */}
          <div className="p-5 bg-[#071A2B] text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-[#EF233C] fill-current" />
              <h2 className="text-base font-bold font-display uppercase tracking-wide">
                Saved Vehicles ({favorites.length})
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded text-gray-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {favorites.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                <Heart className="w-12 h-12 text-gray-300 stroke-1 mb-3" />
                <p className="text-base font-bold text-gray-800">No saved vehicles yet</p>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">
                  Click the heart icon on any video-first car card to shortlist vehicles for comparison.
                </p>
              </div>
            ) : (
              favorites.map((car) => (
                <div
                  key={car.id}
                  className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow transition flex gap-3 relative group"
                >
                  <img
                    src={car.video.youtube_thumbnail_url}
                    alt={car.title}
                    className="w-24 h-16 object-cover rounded shrink-0 cursor-pointer"
                    onClick={() => {
                      onClose();
                      onSelectCar(car);
                    }}
                    referrerPolicy="no-referrer"
                  />

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4
                        onClick={() => {
                          onClose();
                          onSelectCar(car);
                        }}
                        className="text-xs font-bold text-[#071A2B] hover:text-[#EF233C] cursor-pointer truncate"
                      >
                        {car.title}
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {car.location.split(',')[0]} · {car.transmission}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-100">
                      <span className="text-xs font-extrabold text-[#071A2B] tabular-nums font-display">
                        {FORMAT_CURRENCY(car.price)}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onRemoveFavorite(car.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            onClose();
                            onInterested(car);
                          }}
                          className="px-2 py-1 bg-[#EF233C] hover:bg-[#d91b32] text-white text-[10px] font-bold uppercase tracking-wider rounded"
                        >
                          Enquire
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {favorites.length > 0 && (
            <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Total Shortlist Valuation:</span>
                <span className="text-base font-extrabold text-[#071A2B] font-display tabular-nums">
                  {FORMAT_CURRENCY(totalValue)}
                </span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onInterested(favorites[0]);
                }}
                className="w-full py-3 bg-[#071A2B] hover:bg-[#0B2239] text-white text-xs font-bold uppercase tracking-wider rounded shadow transition flex items-center justify-center gap-2"
              >
                <span>Request Comparison Consultation</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
