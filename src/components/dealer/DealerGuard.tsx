import React, { useEffect } from 'react';
import { useDealerAuth } from '../../context/DealerAuthContext';
import { useRole } from '../../context/RoleContext';
import {
  Loader2,
  ShieldAlert,
  ArrowRight,
  Phone,
  Lock,
  Building2,
  LayoutDashboard,
  Gamepad2,
  LogOut,
} from 'lucide-react';
import { resolveDealerApprovalState } from '../../services/dealerOnboardingService';

interface DealerGuardProps {
  children: React.ReactNode;
  navigate: (route: string) => void;
  currentRoute: string;
}

export const DealerGuard: React.FC<DealerGuardProps> = ({ children, navigate, currentRoute }) => {
  const { user, dealerAccount, loading, signOut } = useDealerAuth();
  const { role, loading: roleLoading } = useRole();

  const isPlayerRole = role === 'player';
  const isAdminRole = role === 'admin';
  const isBuyerRole = role === 'buyer';
  const isAuthorizedDealerOrOnboarding = role === 'dealer' || role === 'dealer_onboarding';

  // Wait until both session/role and (for dealer roles) dealerAccount are resolved
  const isResolvingAccount =
    loading ||
    roleLoading ||
    (Boolean(user) && isAuthorizedDealerOrOnboarding && dealerAccount === null);

  useEffect(() => {
    if (isResolvingAccount) return;

    if (!user || role === 'anonymous') {
      navigate('/dealer/sign-in');
      return;
    }

    if (isPlayerRole || isAdminRole || isBuyerRole) {
      // Never redirect Game Players or Admins into dealer onboarding; render explicit access denied below
      return;
    }

    if (!dealerAccount?.hasAccount) {
      if (
        role === 'dealer_onboarding' &&
        currentRoute !== '/dealer/business-information' &&
        currentRoute !== '/dealer/onboarding-success' &&
        currentRoute !== '/dealer/offer'
      ) {
        navigate('/dealer/business-information');
      }
    } else if (currentRoute === '/dealer/business-information') {
      navigate('/dealer/dashboard');
    }
  }, [
    user,
    role,
    dealerAccount,
    isResolvingAccount,
    isPlayerRole,
    isAdminRole,
    isBuyerRole,
    currentRoute,
    navigate,
  ]);

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

  if (!user || role === 'anonymous') {
    return null;
  }

  // Strict RBAC denial for Game Players, Admins, and non-dealer accounts
  if (isPlayerRole || isAdminRole || isBuyerRole) {
    return (
      <div className="min-h-screen bg-[#071A2B] flex flex-col items-center justify-center text-white p-4">
        <div className="max-w-md w-full bg-[#0D233A] border border-red-500/25 rounded-2xl p-8 text-center shadow-2xl space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-[#EF233C]">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-[10px] font-extrabold uppercase tracking-widest text-red-300">
              Access Denied · Dealer Portal
            </span>
            <h2 className="text-xl font-bold text-white font-display">
              Dealer Account Required
            </h2>
            <p className="text-sm text-gray-300 leading-relaxed">
              {isPlayerRole
                ? 'Game Player accounts cannot access the MANIFOLD Dealer Dashboard or dealership onboarding. Please return to 3D World or browse the public Car Marketplace.'
                : isAdminRole
                ? 'Dealer Dashboard routes are restricted to authorized MANIFOLD Dealer accounts.'
                : 'Your current account does not have Dealer Portal authorization.'}
            </p>
          </div>

          <div className="space-y-2.5 pt-1">
            {isPlayerRole && (
              <button
                type="button"
                onClick={() => navigate('/3d-world')}
                className="w-full py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Gamepad2 className="w-4 h-4" />
                <span>Return to 3D World</span>
              </button>
            )}

            {isAdminRole && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="w-full py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>Return to Admin Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/car-marketplace')}
              className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>Browse Car Marketplace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate('/dealer/sign-in');
              }}
              className="w-full py-2 text-xs text-gray-400 hover:text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out &amp; Switch to Dealer Account</span>
            </button>
          </div>
        </div>
      </div>
    );
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

  // Listing gate: only dealers with dealer_status === 'approved' may post listings on /dealer/cars/new
  // Dashboard, existing inventory views, enquiries, and business profile remain accessible.
  if (dealerAccount?.hasAccount && role === 'dealer' && currentRoute === '/dealer/cars/new') {
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
                  : `${businessName} has active Dealer Dashboard access, but posting new vehicle listings is enabled only after an administrator approves your dealership account.`}
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
