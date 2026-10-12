import React from 'react';
import { X, Building2, UserPlus, LogIn, Search, ArrowRight, ShieldCheck, CheckCircle } from 'lucide-react';
import loungeImage from '../../assets/images/world_vip_lounge_1791804030387.jpg';
import pilotImage from '../../assets/images/world_avatar_pilot_1791804039598.jpg';

interface DealerLoungeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
}

export const DealerLoungeModal: React.FC<DealerLoungeModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#071A2B] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-[#071A2B]/80 hover:bg-[#071A2B] text-white rounded-full border border-white/20 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero image banner */}
        <div className="relative h-52 sm:h-64 w-full overflow-hidden shrink-0">
          <img
            src={loungeImage}
            alt="MANIFOLD VIP Dealer Concierge Lounge"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071A2B] via-[#071A2B]/60 to-transparent" />

          <div className="absolute bottom-4 left-6 right-6">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#EF233C] bg-[#EF233C]/20 border border-[#EF233C]/40 px-2.5 py-0.5 rounded-full">
              Automotive Commercial Suite
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 font-display">
              VIP Concierge & Dealer Lounge
            </h2>
          </div>
        </div>

        {/* Lounge Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Pilot concierge introduction */}
          <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 mb-6">
            <img
              src={pilotImage}
              alt="MANIFOLD Automotive Concierge Lead"
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0"
            />
            <div>
              <h4 className="text-sm font-bold text-white">MANIFOLD Private Client Services</h4>
              <p className="text-xs text-gray-300 mt-0.5">
                Welcome to the executive lounge. Whether you are an accredited Nigerian automotive dealer looking to list premium stock, or a private collector commissioning a bespoke vehicle import, our verified workflows safeguard every transaction.
              </p>
            </div>
          </div>

          {/* Action Portals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dealer Portal Actions */}
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                  <Building2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white">Accredited Dealer Portal</h4>
                <p className="text-xs text-gray-400 mt-1">
                  Manage vehicle inventory, list verified cars, respond to buyer enquiries, and track escrow sales.
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    onClose();
                    onNavigate('/dealer/sign-in');
                  }}
                  className="flex-1 py-2.5 bg-[#EF233C] hover:bg-[#d90429] text-white text-xs font-bold uppercase rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Dealer Sign In</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onNavigate('/dealer/register');
                  }}
                  className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </button>
              </div>
            </div>

            {/* Car Hunt Concierge */}
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-red-500/20 text-[#EF233C] flex items-center justify-center mb-3">
                  <Search className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white">Car Hunt Concierge</h4>
                <p className="text-xs text-gray-400 mt-1">
                  Looking for a specific model not in current inventory? Our team inspects and sources verified vehicles across Nigeria and international ports.
                </p>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => {
                    onClose();
                    onNavigate('/car-hunt');
                  }}
                  className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Commission Car Hunt</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#05111d] border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Escrow verified · Anti-tamper inspection guarantees
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase rounded-xl transition-colors"
          >
            Return to World
          </button>
        </div>
      </div>
    </div>
  );
};
