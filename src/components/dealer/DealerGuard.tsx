import React, { useEffect, useState } from 'react';
import { useDealerAuth } from '../../context/DealerAuthContext';
import { authService } from '../../services/authService';
import { Loader2, ShieldAlert, ArrowRight, Phone, Lock, Building2, LayoutDashboard } from 'lucide-react';
import { resolveDealerApprovalState } from '../../services/dealerOnboardingService';

interface DealerGuardProps {
  children: React.ReactNode;
  navigate: (route: string) => void;
  currentRoute: string;
}

export const DealerGuard: React.FC<DealerGuardProps> = ({ children, navigate, currentRoute }) => {
  const { user, dealerAccount, loading } = useDealerAuth();
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const admin = authService.getCurrentUser();
    if (admin && admin.role === 'ADMIN') {
      setIsAdminUser(true);
    } else if (user?.email === 'newwavereporters@gmail.com') {
      setIsAdminUser(true);
    } else {
      setIsAdminUser(false);
    }
  }, [user]);

  // If user is authenticated, we must wait until dealerAccount is resolved before making routing decisions
  const isResolvingAccount = loading || (Boolean(user) && dealerAccount === null);

  useEffect(() => {
    if (!isResolvingAccount) {
      if (!user) {
        navigate('/dealer/sign-in');
      } else if (isAdminUser && currentRoute === '/dealer/cars/new') {
        // Admin is restricted on vehicle listing flow
        return;
      } else if (!dealerAccount?.hasAccount && !isAdminUser) {
        // Authenticated user genuinely has no dealer account
        if (
          currentRoute !== '/dealer/business-information' &&
          currentRoute !== '/dealer/onboarding-success' &&
          currentRoute !== '/dealer/offer'
        ) {
          navigate('/dealer/business-information');
        }
      } else if (dealerAccount?.hasAccount) {
        // Authenticated dealer with valid dealer_accounts record
        // All dealer routes (dashboard, cars, cars/new, enquiries, profile, offer) are permitted
        // Never redirect them back to business-information
        if (currentRoute === '/dealer/business-information') {
          navigate('/dealer/dashboard');
        }
      }
    }
  }, [user, dealerAccount, isResolvingAccount, isAdminUser, currentRoute, navigate]);

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

  // Admin vehicle listing restriction (Section 1 & 2 Requirement)
  if (isAdminUser && currentRoute === '/dealer/cars/new') {
    return (
      <div className="min-h-screen bg-[#071A2B] flex flex-col items-center justify-center text-white p-4">
        <div className="max-w-md w-full bg-[#0D233A] border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-400">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Dealership Restricted</h2>
          <p className="text-sm text-gray-300 mb-6 leading-relaxed">
            Vehicle listing is available to MANIFOLD dealer accounts.
          </p>
          <button
            onClick={() => navigate('/admin')}
            className="w-full py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-red-900/30"
          >
            <span>Return to Admin Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Listing gate: only dealers with dealer_status === 'approved' may post listings on /dealer/cars/new
  // Dashboard, existing inventory views, enquiries, and business profile remain accessible.
  if (dealerAccount?.hasAccount && !isAdminUser && currentRoute === '/dealer/cars/new') {
    const resolved = resolveDealerApprovalState(
      dealerAccount.accountStatus,
      dealerAccount.isVerified,
      dealerAccount.dealerStatus
    );
    const dealerStatusApproved = resolved.dealerStatus === 'approved' && resolved.isApproved;
    if (!dealerStatusApproved) {
      const isDisapproved = resolved.dealerStatus === 'disapproved';
      const businessName = dealerAccount.businessName || 'Your Dealership';
      return (
        <div className="min-h-screen bg-[#071A2B] flex flex-col items-center justify-center text-white p-4">
          <div className="max-w-lg w-full bg-[#0D233A] border border-white/15 rounded-2xl p-8 text-center shadow-2xl space-y-5">
            <div
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center border ${
                isDisapproved
                  ? 'bg-red-500/15 border-red-400/30 text-[#EF233C]'
                  : 'bg-amber-500/15 border-amber-400/30 text-amber-400'
              }`}
            >
              <Lock className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${
                  isDisapproved
                    ? 'bg-red-500/15 border-red-400/30 text-red-300'
                    : 'bg-amber-500/15 border-amber-400/30 text-amber-300'
                }`}
              >
                Status: {resolved.dealerStatus.toUpperCase()}
              </span>
              <h2 className="text-xl font-bold text-white">
                Approval Required to List Vehicles
              </h2>
              <p className="text-sm text-gray-300 leading-relaxed">
                {isDisapproved
                  ? `${businessName} is currently disapproved for posting new car listings. You can continue using your Dealer Dashboard and update your Business Profile until an administrator approves your account.`
                  : `${businessName} has active Dealer Dashboard access, but posting new vehicle listings is enabled only after an administrator sets dealer_status to approved.`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={() => navigate('/dealer/dashboard')}
                className="flex-1 py-3 px-4 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Go to Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/dealer/business-profile')}
                className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/15 text-gray-200 text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Building2 className="w-4 h-4" />
                <span>Business Profile</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};
