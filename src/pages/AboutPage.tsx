import React from 'react';
import { ShieldCheck, Video, Users, CheckCircle2, PhoneCall } from 'lucide-react';

interface AboutPageProps {
  navigate: (route: string) => void;
  onOpenInquiry: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ navigate, onOpenInquiry }) => {
  return (
    <div className="min-h-screen bg-[#F7F8FA] pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <button onClick={() => navigate('/')} className="hover:text-gray-900">
            Home
          </button>
          <span>/</span>
          <span className="text-gray-900 font-medium">About MANIFOLD</span>
        </div>

        {/* Hero */}
        <div className="bg-[#071A2B] text-white rounded-2xl p-8 sm:p-12 border border-white/10 shadow-xl space-y-4">
          <span className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#EF233C]">
            FIND · VERIFY · DRIVE
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display">
            The Story Behind MANIFOLD
          </h1>
          <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl">
            Buying a car in Nigeria has historically been riddled with guesswork, hidden accident
            damage, forged customs declarations, and high-pressure unvetted dealers. MANIFOLD was
            founded to transform automotive discovery through real video reviews, physical
            verifications, and an obsessive concierge buying model.
          </p>
        </div>

        {/* Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-2">
            <Video className="w-6 h-6 text-[#EF233C]" />
            <h3 className="text-sm font-bold uppercase text-[#071A2B]">Video-First Media</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              We never rely on misleading Photoshop stills. Every listed vehicle undergoes a video
              inspection walkaround with engine sound and cold start.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-2">
            <ShieldCheck className="w-6 h-6 text-[#EF233C]" />
            <h3 className="text-sm font-bold uppercase text-[#071A2B]">Physical Verification</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              We visit physical car dealerships in Lagos and Abuja, check chassis VINs, test paint
              thickness, and audit customs single-goods declarations.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-2">
            <Users className="w-6 h-6 text-[#EF233C]" />
            <h3 className="text-sm font-bold uppercase text-[#071A2B]">The Buyer Belongs to Us</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              We never post raw dealer numbers. MANIFOLD acts as your personal concierge, arranging
              viewings, negotiating fair pricing, and ensuring peaceful handover.
            </p>
          </div>
        </div>

        {/* Contact info card */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-[#071A2B] font-display uppercase">
            Get In Touch With MANIFOLD
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            For vehicle enquiries, dealer partnerships, or media inquiries:
          </p>
          <div className="text-xs text-gray-700 space-y-2">
            <p><strong>Headquarters:</strong> Lekki Phase 1, Lagos, Nigeria</p>
            <p><strong>Abuja Branch:</strong> Maitama District, Abuja, FCT</p>
            <p><strong>Email:</strong> concierge@manifold.ng</p>
            <p><strong>YouTube:</strong> youtube.com/@manifoldcars</p>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={onOpenInquiry}
              className="px-6 py-3 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded shadow transition flex items-center gap-2"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Talk to MANIFOLD</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
