import React from 'react';
import {
  Compass,
  ShieldCheck,
  Headphones,
  RefreshCw,
  Landmark,
  FileCheck2,
  ArrowRight,
  PhoneCall,
} from 'lucide-react';

interface ServicesPageProps {
  navigate: (route: string) => void;
  onOpenInquiry: () => void;
}

export const ServicesPage: React.FC<ServicesPageProps> = ({ navigate, onOpenInquiry }) => {
  const services = [
    {
      icon: Compass,
      title: 'Car Sourcing (Car Hunt)',
      desc: 'Looking for a rare spec, custom interior, or specific model? MANIFOLD scouts physically across verified partner dealerships in Lagos and Abuja, auditing the vehicle before presenting video walkarounds to you.',
      cta: 'Start a Car Hunt',
      action: () => navigate('/car-hunt'),
    },
    {
      icon: ShieldCheck,
      title: 'Vehicle Physical Inspection',
      desc: 'A comprehensive 150-point diagnostic audit including electronic OBD2 scan, paint depth meter analysis for hidden accident resprays, flood damage checks, chassis alignment, and Nigerian Customs duty validation.',
      cta: 'Book Inspection',
      action: onOpenInquiry,
    },
    {
      icon: Headphones,
      title: 'Buying Concierge & Escrow',
      desc: 'You never deal with pushy, unvetted dealers. A dedicated MANIFOLD advisor handles negotiation, organizes accompanied viewings, and protects your funds with secure escrow arrangements.',
      cta: 'Talk to Concierge',
      action: onOpenInquiry,
    },
    {
      icon: RefreshCw,
      title: 'Trade-in & Upgrade',
      desc: 'Upgrade from your current ride to a verified foreign-used vehicle seamlessly. We evaluate your existing car honestly and credit the approved valuation toward your next purchase.',
      cta: 'Request Trade-in',
      action: onOpenInquiry,
    },
    {
      icon: Landmark,
      title: 'Auto Financing Assistance',
      desc: 'Partnered with reputable Nigerian tier-1 commercial lenders and auto credit institutions to provide structured repayment terms with competitive interest rates.',
      cta: 'Explore Financing',
      action: onOpenInquiry,
    },
    {
      icon: FileCheck2,
      title: 'Customs & Registration Support',
      desc: 'Direct validation with Nigeria Customs Service to ensure genuine single-goods declaration (SGD) documents, plate number issuance, and genuine vehicle licensing.',
      cta: 'Verify Customs Duty',
      action: onOpenInquiry,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <button onClick={() => navigate('/')} className="hover:text-gray-900">
            Home
          </button>
          <span>/</span>
          <span className="text-gray-900 font-medium">Services</span>
        </div>

        {/* Hero */}
        <div className="bg-[#071A2B] text-white rounded-2xl p-8 sm:p-12 mb-12 border border-white/10 shadow-xl space-y-3">
          <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#EF233C]">
            FULL AUTOMOTIVE LIFECYCLE
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-display">
            The MANIFOLD Concierge Ecosystem
          </h1>
          <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl">
            From discovering your next car through honest video reviews to physical inspection,
            negotiation, and registration, we protect Nigerian car buyers at every stage.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {services.map((svc, idx) => {
            const Icon = svc.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-lg bg-red-50 text-[#EF233C] flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-[#071A2B] uppercase tracking-wide">
                    {svc.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">
                    {svc.desc}
                  </p>
                </div>

                <div className="pt-6 mt-4 border-t border-gray-100">
                  <button
                    onClick={svc.action}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#071A2B] hover:text-[#EF233C] uppercase tracking-wider transition group"
                  >
                    <span>{svc.cta}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Talk to Manifold Bottom Banner */}
        <div className="bg-[#0B2239] text-white rounded-xl p-8 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-1">
            <h3 className="text-xl font-bold font-display">Have a custom question or fleet enquiry?</h3>
            <p className="text-xs sm:text-sm text-gray-300">
              Speak directly with a senior automotive advisor at MANIFOLD.
            </p>
          </div>
          <button
            onClick={onOpenInquiry}
            className="px-6 py-3 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded shadow transition flex items-center gap-2 whitespace-nowrap"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Talk to MANIFOLD</span>
          </button>
        </div>
      </div>
    </div>
  );
};
