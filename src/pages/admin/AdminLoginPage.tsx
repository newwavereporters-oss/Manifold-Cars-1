import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, ArrowRight, AlertCircle, Loader2, ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { supabase } from '../../lib/supabase';
import { ManifoldBrandMark } from '../../components/ManifoldBrandMark';

interface AdminLoginPageProps {
  navigate: (route: string) => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ navigate }) => {
  const { signIn, isAuthenticated } = useAuth();
  const { role, isGamePlayer, isDealerAccount } = useRole();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated as admin, redirect
  React.useEffect(() => {
    if (isAuthenticated && role === 'admin') {
      navigate('/admin');
    }
  }, [isAuthenticated, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn(email, password);
      if (res.error) {
        setError(res.error);
        setLoading(false);
      } else {
        navigate('/admin');
      }
    } catch {
      setError('An unexpected authentication error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#071A2B] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-[#111827] relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-radial-gradient from-blue-900/20 via-transparent to-transparent pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10 px-4">
        {/* Brand Wordmark Lockup */}
        <div
          onClick={() => navigate('/car-marketplace')}
          className="cursor-pointer inline-flex flex-col items-center group mb-4"
        >
          <ManifoldBrandMark size="lg" className="mb-2.5" />
          <div className="flex items-center gap-1.5">
            <span className="text-3xl font-extrabold tracking-tight text-white font-display">
              MANIFOLD
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF233C]" />
          </div>
          <span className="text-[10px] font-bold tracking-[0.25em] text-gray-400 uppercase mt-0.5">
            FIND · VERIFY · DRIVE
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
          MANIFOLD ADMIN PORTAL
        </h1>
        <p className="mt-1 text-xs text-gray-300">
          Secure administration portal for inventory & concierge operations
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md px-4 relative z-10">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-gray-100">
          {(isGamePlayer || isDealerAccount || role === 'dealer_onboarding') && (
            <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs text-amber-900">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-bold">Active Non-Admin Session Detected</p>
                  <p className="text-amber-800 mt-0.5 leading-relaxed">
                    {isGamePlayer
                      ? 'You are currently signed in with a Game Player account. Game Players cannot access the Admin Dashboard.'
                      : 'You are currently signed in with a Dealer account. Dealers cannot access the Admin Dashboard.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => navigate(isGamePlayer ? '/3d-world' : '/dealer/dashboard')}
                  className="px-3 py-1.5 bg-[#071A2B] hover:bg-[#0b253d] text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
                >
                  {isGamePlayer ? 'Return to 3D World' : 'Return to Dealer Portal'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut().catch(() => {});
                  }}
                  className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-[11px] font-bold rounded-lg inline-flex items-center gap-1 transition cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Sign Out Session</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#EF233C]" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Admin Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="w-full h-11 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] focus:ring-1 focus:ring-[#071A2B] outline-none transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-9 pr-10 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] focus:ring-1 focus:ring-[#071A2B] outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer active:scale-98"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Role-Protected Session</span>
            </div>
            <button
              onClick={() => navigate('/car-marketplace')}
              className="text-gray-500 hover:text-gray-900 font-medium transition"
            >
              ← Back to Marketplace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
