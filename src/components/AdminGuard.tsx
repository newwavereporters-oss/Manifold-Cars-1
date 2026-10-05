import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';

interface AdminGuardProps {
  children: React.ReactNode;
  navigate: (route: string) => void;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children, navigate }) => {
  const { user, isAdmin, isAuthenticated, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        navigate('/admin/login');
      } else if (!isAdmin) {
        // Authenticated in Supabase but not an authorized active MANIFOLD admin
        signOut().then(() => {
          navigate('/admin/login');
        });
      }
    }
  }, [loading, isAuthenticated, isAdmin, navigate, signOut]);

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

  // Block rendering protected admin content completely if unauthorized
  if (!isAuthenticated || !isAdmin) {
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

  return <>{children}</>;
};
