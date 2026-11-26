import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRole } from '../context/RoleContext';
import { supabase } from '../lib/supabase';
import { Loader2, ShieldAlert, ArrowRight, Gamepad2, Building2, LogOut } from 'lucide-react';

interface AdminGuardProps {
  children: React.ReactNode;
  navigate: (route: string) => void;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children, navigate }) => {
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();

  const loading = authLoading || roleLoading;

  useEffect(() => {
    if (!loading && !isAuthenticated && role === 'anonymous') {
      navigate('/admin/login');
    }
  }, [loading, isAuthenticated, role, navigate]);

  if (loading) {
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
          Verifying Admin Authorization...
        </p>
      </div>
    );
  }

  if (!isAuthenticated && role === 'anonymous') {
    return (
      <div className="min-h-screen bg-[#071A2B] flex flex-col items-center justify-center text-white p-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-[#EF233C]">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-gray-200">
          Redirecting to Admin Login...
        </p>
      </div>
    );
  }

  // Strict RBAC: reject Game Players, Dealers, and any non-admin session with zero Admin UI rendered
  if (!isAuthenticated || !isAdmin || role !== 'admin') {
    const isPlayer = role === 'player';
    const isDealer = role === 'dealer' || role === 'dealer_onboarding';

    return (
      <div className="min-h-screen bg-[#071A2B] flex flex-col items-center justify-center text-white p-4">
        <div className="max-w-md w-full bg-[#0D233A] border border-red-500/25 rounded-2xl p-8 text-center shadow-2xl space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-[#EF233C]">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-[10px] font-extrabold uppercase tracking-widest text-red-300">
              Access Denied · Admin Area
            </span>
            <h2 className="text-xl font-bold text-white font-display">
              Administrator Authorization Required
            </h2>
            <p className="text-sm text-gray-300 leading-relaxed">
              {isPlayer
                ? 'Game Player accounts cannot access the MANIFOLD Admin Dashboard. Please return to 3D World or browse the public Car Marketplace.'
                : isDealer
                ? 'Dealer accounts cannot access the MANIFOLD Admin Dashboard. Please return to your Dealer Dashboard.'
                : 'Your current account does not have active MANIFOLD Administrator privileges.'}
            </p>
          </div>

          <div className="space-y-2.5 pt-1">
            {isPlayer && (
              <button
                type="button"
                onClick={() => navigate('/3d-world')}
                className="w-full py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Gamepad2 className="w-4 h-4" />
                <span>Return to 3D World</span>
              </button>
            )}

            {isDealer && (
              <button
                type="button"
                onClick={() => navigate(role === 'dealer' ? '/dealer/dashboard' : '/dealer/business-information')}
                className="w-full py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Building2 className="w-4 h-4" />
                <span>Return to Dealer Portal</span>
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
                await supabase.auth.signOut().catch(() => {});
                navigate('/admin/login');
              }}
              className="w-full py-2 text-xs text-gray-400 hover:text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out &amp; Switch to Admin Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

