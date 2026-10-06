import React from 'react';
import { CheckCircle2, Sparkles, PlusCircle, ArrowRight, LayoutDashboard, Compass } from 'lucide-react';
import { useDealerAuth } from '../../context/DealerAuthContext';

interface DealerOnboardingSuccessPageProps {
  navigate: (route: string) => void;
}

export const DealerOnboardingSuccessPage: React.FC<DealerOnboardingSuccessPageProps> = ({ navigate }) => {
  const { user, dealerAccount } = useDealerAuth();
  const businessName = dealerAccount?.businessName || 'Your Dealership';

  const handleListFirstCar = () => {
    if (user) {
      navigate('/dealer/cars/new');
    } else {
      navigate('/dealer/sign-in');
    }
  };

  return (
    <div className="min-h-screen bg-[#071A2B] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-[#111827] relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center relative z-10 px-4">
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
        <div className="bg-[#0B2239] py-10 px-6 sm:px-12 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-sm text-center space-y-6">
          {/* Active Verified Icon */}
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          {/* Section 2 Required Headline & Supporting Message */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
              <span>ACTIVE DEALERSHIP</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2 font-display">
              WELCOME TO MANIFOLD
            </h1>

            <p className="text-base text-gray-200 font-medium">
              Your dealership is now set up on MANIFOLD.
            </p>
          </div>

          {/* Section 2 Required Brief Explanation */}
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-lg mx-auto">
            MANIFOLD gives professional automobile dealers a better way to present their vehicles, reach serious buyers and understand where their inventory sits in the market.
          </p>

          {/* TWO PRIMARY PATHS: OPTION 1 & OPTION 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-2">
            {/* OPTION 1: EXPLORE MANIFOLD */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#EF233C]">
                  <Compass className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  OPTION 1 — EXPLORE MANIFOLD
                </h2>
                <p className="text-xs text-gray-300 leading-relaxed">
                  See exactly how MANIFOLD works for professional dealers and what you get when you list with us.
                </p>
              </div>

              <button
                onClick={() => navigate('/dealer/offer')}
                className="w-full py-3 bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 border border-white/10 group"
              >
                <span>Explore the MANIFOLD Dealer Offer</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* OPTION 2: LIST MY FIRST CAR */}
            <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/20 hover:border-red-500/40 transition flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-[#EF233C]">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  OPTION 2 — LIST MY FIRST CAR
                </h2>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Start building your MANIFOLD inventory by listing your first vehicle.
                </p>
              </div>

              <button
                onClick={handleListFirstCar}
                className="w-full py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 group"
              >
                <span>List My First Car</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* DASHBOARD LINK */}
          <div className="pt-2">
            <button
              onClick={() => navigate('/dealer/dashboard')}
              className="text-xs font-semibold text-gray-400 hover:text-white transition flex items-center justify-center gap-1.5 mx-auto py-2"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Or go directly to My Dealer Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
