import React, { useEffect } from 'react';
import { useDealerAuth } from '../../context/DealerAuthContext';
import { Loader2, ShieldAlert, ArrowRight, Phone } from 'lucide-react';

interface DealerGuardProps {
  children: React.ReactNode;
  navigate: (route: string) => void;
  currentRoute: string;
}

export const DealerGuard: React.FC<DealerGuardProps> = ({ children, navigate, currentRoute }) => {
  const { user, dealerAccount, loading } = useDealerAuth();

  // If user is authenticated, we must wait until dealerAccount is resolved before making routing decisions
  const isResolvingAccount = loading || (Boolean(user) && dealerAccount === null);

  useEffect(() => {
    if (!isResolvingAccount) {
      if (!user) {
        navigate('/dealer/sign-in');
      } else if (!dealerAccount?.hasAccount) {
        // Authenticated user genuinely has no dealer account
        if (
          currentRoute !== '/dealer/business-information' &&
          currentRoute !== '/dealer/onboarding-success'
        ) {
          navigate('/dealer/business-information');
        }
      } else if (dealerAccount?.hasAccount) {
        // Authenticated dealer already has completed onboarding
        // Do not force them through business-information again
        if (currentRoute === '/dealer/business-information') {
          navigate('/dealer/dashboard');
        }
      }
    }
  }, [user, dealerAccount, isResolvingAccount, currentRoute, navigate]);

  if (isResolvingAccount) {
    return (
      <div className="min-h-screen bg-[#071A2B] flex flex-col items-center justify-center text-white p-4">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <Loader2 className="w-6 h-6 animate-spin text-[#EF233C]" />
        </div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xl font-extrabold tracking-tight text-white font-display">
            MANIFOLD
          </span>
          <span className="w-2 h-2 rounded-full bg-[#EF233C]" />
        </div>
        <p className="text-xs uppercase tracking-widest font-bold text-gray-300">
          Verifying Dealership Authorization...
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Suspended account screen
  if (dealerAccount?.accountStatus === 'suspended') {
    return (
      <div className="min-h-screen bg-[#071A2B] flex flex-col items-center justify-center text-white p-4">
        <div className="max-w-md w-full bg-[#0D233A] border border-red-500/20 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4 text-[#EF233C]">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Dealership Account Suspended</h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            Your MANIFOLD dealership privileges have been temporarily paused. Please contact our dealer desk for compliance review and reactivation.
          </p>
          <div className="space-y-3">
            <a
              href="https://wa.me/2348169664607?text=MANIFOLD%20Dealer%20Account%20Suspension%20Inquiry"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition"
            >
              <Phone className="w-4 h-4" />
              Contact MANIFOLD Dealer Support
            </a>
            <button
              onClick={() => navigate('/dealer/sign-in')}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold rounded-xl transition"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
