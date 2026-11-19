import React from 'react';
import { CheckCircle2, Clock, PlusCircle, ArrowRight, LayoutDashboard, Compass } from 'lucide-react';
import { useDealerAuth } from '../../context/DealerAuthContext';
import { resolveDealerApprovalState } from '../../services/dealerOnboardingService';

interface DealerOnboardingSuccessPageProps {
  navigate: (route: string) => void;
}

export const DealerOnboardingSuccessPage: React.FC<DealerOnboardingSuccessPageProps> = ({ navigate }) => {
  const { user, dealerAccount } = useDealerAuth();
  const businessName = dealerAccount?.businessName || 'Your Dealership';
  const resolved = resolveDealerApprovalState(
    dealerAccount?.accountStatus,
    dealerAccount?.isVerified
  );
  const isApproved = dealerAccount?.isApproved ?? resolved.isApproved;

  const handlePrimaryDashboardAction = () => {
    const target = isApproved ? '/dealer/cars/new' : '/dealer/dashboard';
    if (user) {
      navigate(target);
    } else {
      navigate(`/dealer/sign-in?next=${encodeURIComponent(target)}`);
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
          {/* Status Icon */}
          {isApproved ? (
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center mx-auto text-amber-300">
              <Clock className="w-8 h-8" />
            </div>
          )}

          {/* Headline & Supporting Message */}
          <div>
            {isApproved ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
                <span>APPROVED DEALERSHIP</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-3">
                <span>PENDING ADMIN APPROVAL</span>
              </div>
            )}

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2 font-display">
              WELCOME TO MANIFOLD
            </h1>

            <p className="text-base text-gray-200 font-medium">
              {businessName} is now registered on MANIFOLD.
            </p>
          </div>

          {/* Explanation */}
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-lg mx-auto">
            {isApproved
              ? 'MANIFOLD gives professional automobile dealers a better way to present their vehicles, reach serious buyers and understand where their inventory sits in the market.'
              : 'Your dealer dashboard is ready now. You can sign in, review your business profile, and explore the MANIFOLD dealer tools immediately. Vehicle listing will unlock as soon as Admin approves your dealership account.'}
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

            {/* OPTION 2: LIST MY FIRST CAR OR ENTER DASHBOARD */}
            <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/20 hover:border-red-500/40 transition flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-[#EF233C]">
                  {isApproved ? <PlusCircle className="w-5 h-5" /> : <LayoutDashboard className="w-5 h-5" />}
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  {isApproved ? 'OPTION 2 — LIST MY FIRST CAR' : 'OPTION 2 — ENTER DEALER DASHBOARD'}
                </h2>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {isApproved
                    ? 'Start building your MANIFOLD inventory by listing your first vehicle.'
                    : 'Access your dealership dashboard and business profile now while Admin reviews your account for car listing.'}
                </p>
              </div>

              <button
                onClick={handlePrimaryDashboardAction}
                className="w-full py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 group"
              >
                <span>{isApproved ? 'List My First Car' : 'Go to My Dealer Dashboard'}</span>
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
              <span>Go directly to My Dealer Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
