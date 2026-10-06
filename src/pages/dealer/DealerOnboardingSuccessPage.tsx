import React from 'react';
import { CheckCircle2, Clock, PlusCircle, LayoutDashboard, ShieldCheck, Phone, ArrowRight } from 'lucide-react';
import { useDealerAuth } from '../../context/DealerAuthContext';

interface DealerOnboardingSuccessPageProps {
  navigate: (route: string) => void;
}

export const DealerOnboardingSuccessPage: React.FC<DealerOnboardingSuccessPageProps> = ({ navigate }) => {
  const { dealerAccount } = useDealerAuth();
  const businessName = dealerAccount?.businessName || 'Your Dealership';

  return (
    <div className="min-h-screen bg-[#071A2B] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-[#111827] relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center relative z-10 px-4">
        {/* Brand Lockup */}
        <div
          onClick={() => navigate('/')}
          className="cursor-pointer inline-flex flex-col items-center group mb-6"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-3xl font-extrabold tracking-tight text-white font-display">
              MANIFOLD
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF233C]" />
          </div>
          <span className="text-[10px] font-bold tracking-[0.25em] text-[#EF233C] uppercase mt-1">
            Automobile Dealer Portal
          </span>
        </div>

        {/* Card */}
        <div className="bg-[#0B2239] py-10 px-6 sm:px-10 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-sm text-center">
          {/* Animated Status Icon */}
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5 text-amber-400">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>

          {/* Section 9 Title */}
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Welcome to MANIFOLD
          </h2>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold mb-5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Application under review</span>
          </div>

          {/* Section 9 Required Supporting Text */}
          <p className="text-sm text-gray-300 leading-relaxed max-w-md mx-auto mb-6">
            Your dealer application for <strong className="text-white">{businessName}</strong> has been received. Our team will review your dealership information and activate your account when approved.
          </p>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left mb-8 space-y-2">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
              <p className="text-xs text-gray-300">
                <strong className="text-white font-semibold">Account Status: Pending</strong> — You can immediately prepare vehicle draft listings. Full public vehicle publishing becomes active upon compliance verification.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <Phone className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
              <p className="text-xs text-gray-400">
                A MANIFOLD dealer partner manager may reach out via Phone / WhatsApp for rapid catalog onboarding.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/dealer/cars/new')}
              className="w-full sm:w-auto px-6 py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
            >
              <PlusCircle className="w-4 h-4" />
              <span>List My First Car</span>
            </button>

            <button
              onClick={() => navigate('/dealer/dashboard')}
              className="w-full sm:w-auto px-6 py-3 bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 border border-white/10"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Go to My Dashboard</span>
            </button>
          </div>
        </div>

        {/* Support Footer */}
        <p className="mt-6 text-xs text-gray-400">
          Need immediate onboarding assistance?{' '}
          <a
            href="https://wa.me/2348169664607?text=MANIFOLD%20Dealer%20Onboarding%20Follow-up"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-[#EF233C] underline ml-1 font-semibold"
          >
            WhatsApp Support: 08169664607
          </a>
        </p>
      </div>
    </div>
  );
};
