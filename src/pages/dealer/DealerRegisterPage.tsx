import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
  Video,
  Users,
  TrendingUp,
  ShieldCheck,
  Building,
  Check,
  X,
  ArrowLeft,
} from 'lucide-react';
import { useDealerAuth } from '../../context/DealerAuthContext';

interface DealerRegisterPageProps {
  navigate: (route: string) => void;
}

export const DealerRegisterPage: React.FC<DealerRegisterPageProps> = ({ navigate }) => {
  const { signUp, user, dealerAccount } = useDealerAuth();

  // Section 6: Pre-signup Information Modal (defaults to true before registration starts)
  const [showPreSignupModal, setShowPreSignupModal] = useState(true);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmedMinimumInventory, setConfirmedMinimumInventory] = useState(false);

  // Submission State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);

  // If already authenticated and has a dealer account, redirect
  React.useEffect(() => {
    if (user && dealerAccount?.hasAccount) {
      navigate('/dealer/dashboard');
    }
  }, [user, dealerAccount, navigate]);

  // Validation feedback helpers
  const isPasswordLongEnough = password.length >= 8;
  const hasLetterAndNumber = /[A-Za-z]/.test(password) && /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Please provide your full legal name.');
      return;
    }
    if (!email.trim()) {
      setError('Please provide a valid business email address.');
      return;
    }
    if (!phone.trim()) {
      setError('Please provide your Phone / WhatsApp number.');
      return;
    }
    if (!isPasswordLongEnough) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!hasLetterAndNumber) {
      setError('Password must contain both letters and at least one number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }
    if (!confirmedMinimumInventory) {
      setError('You must confirm that your dealership has at least 5 vehicles available for listing.');
      return;
    }

    setLoading(true);

    try {
      const res = await signUp(email, password, fullName, phone);
      if (!res.success) {
        setError(res.error || 'Registration failed. Please check your information.');
        setLoading(false);
        return;
      }

      if (res.requiresConfirmation) {
        setEmailConfirmationRequired(true);
        setLoading(false);
      } else {
        // Successful signup with active session -> Go directly to Step 2: Business Information
        navigate('/dealer/business-information');
      }
    } catch {
      setError('An unexpected connection error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#071A2B] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-[#111827] relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent pointer-events-none" />

      {/* Back to Marketplace */}
      <div className="absolute top-6 left-6 z-20">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to MANIFOLD Marketplace</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* SECTION 6: PRE-SIGNUP INFORMATION MODAL: "Why list with MANIFOLD?" */}
      {/* ============================================================ */}
      {showPreSignupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0B2239] border border-white/10 rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl text-white relative animate-in zoom-in-95">
            <button
              onClick={() => setShowPreSignupModal(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition"
              title="Close and continue"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[#EF233C] bg-red-950/60 border border-red-500/20 px-2.5 py-0.5 rounded-full">
                Partnership Briefing
              </span>
            </div>

            <h3 className="text-2xl font-bold tracking-tight text-white mb-2">
              Why list with MANIFOLD?
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed mb-6">
              MANIFOLD is not simply a vehicle listing classifieds website. We are Nigeria's premium automotive discovery and concierge engine designed for serious dealerships.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-xs text-gray-200">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                <CheckCircle2 className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold">Professional dealer marketplace</strong>
                  <span className="text-[11px] text-gray-400">Curated, verified automobile inventory with zero clutter.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                <Video className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold">Video-first vehicle presentation</strong>
                  <span className="text-[11px] text-gray-400">High-definition walkaround video reviews for every car.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                <Users className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold">MANIFOLD-driven buyer enquiries</strong>
                  <span className="text-[11px] text-gray-400">Qualified leads vetted directly by the MANIFOLD concierge.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                <Sparkles className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold">AI-powered vehicle discovery</strong>
                  <span className="text-[11px] text-gray-400">Intelligent buyer matching based on exact preferences.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                <TrendingUp className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold">Market pricing intelligence</strong>
                  <span className="text-[11px] text-gray-400">Automated price review recommendations tailored to Lagos.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                <Building className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold">Professional dealer presence</strong>
                  <span className="text-[11px] text-gray-400">Dedicated dealership profile with verified partner status.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                <ShieldCheck className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold">Automotive market intelligence</strong>
                  <span className="text-[11px] text-gray-400">Exclusive inventory turnover and demand analytics.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/5">
                <Check className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold">Commission-based sales model</strong>
                  <span className="text-[11px] text-gray-400">No upfront listing fees. We succeed when you sell.</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowPreSignupModal(false)}
              className="w-full py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
            >
              <span>Continue to Dealer Registration</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header Lockup */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10 px-4">
        <div
          onClick={() => navigate('/')}
          className="cursor-pointer inline-flex flex-col items-center group mb-4"
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

        {/* Section 5 Title */}
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Create your dealer account
        </h2>
        <p className="mt-1.5 text-xs text-gray-400 max-w-sm mx-auto">
          Step 1 of 2 — General Account Information
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-[#0B2239] py-8 px-6 sm:px-8 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-sm">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
              <p className="text-xs text-red-200 leading-relaxed font-medium">{error}</p>
            </div>
          )}

          {emailConfirmationRequired ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white">Verification Link Sent</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                We have sent an authentication link to <strong className="text-white">{email}</strong>. Please check your inbox and confirm your address to complete dealership onboarding.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => navigate('/dealer/sign-in')}
                  className="w-full py-2.5 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase rounded-xl transition"
                >
                  Proceed to Sign In
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-[#EF233C]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alhaji Babatunde Alabi"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#EF233C] focus:ring-1 focus:ring-[#EF233C] transition"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Business Email <span className="text-[#EF233C]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="dealers@prestizemotors.ng"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#EF233C] focus:ring-1 focus:ring-[#EF233C] transition"
                  />
                </div>
              </div>

              {/* Phone / WhatsApp */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Phone / WhatsApp <span className="text-[#EF233C]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0803 000 1122"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#EF233C] focus:ring-1 focus:ring-[#EF233C] transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Password <span className="text-[#EF233C]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#EF233C] focus:ring-1 focus:ring-[#EF233C] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Confirm Password <span className="text-[#EF233C]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#EF233C] focus:ring-1 focus:ring-[#EF233C] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password strength helper feedback */}
              <div className="space-y-1 py-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className={isPasswordLongEnough ? 'text-emerald-400' : 'text-gray-500'}>
                    {isPasswordLongEnough ? '✓' : '•'} At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={hasLetterAndNumber ? 'text-emerald-400' : 'text-gray-500'}>
                    {hasLetterAndNumber ? '✓' : '•'} Contains both letters and numbers
                  </span>
                </div>
                {confirmPassword && (
                  <div className="flex items-center gap-1.5">
                    <span className={passwordsMatch ? 'text-emerald-400' : 'text-red-400'}>
                      {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
                    </span>
                  </div>
                )}
              </div>

              {/* REQUIRED INVENTORY CONFIRMATION CHECKBOX */}
              <div className="pt-2">
                <label className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/[0.07] transition">
                  <input
                    type="checkbox"
                    checked={confirmedMinimumInventory}
                    onChange={(e) => setConfirmedMinimumInventory(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[#EF233C] focus:ring-[#EF233C] bg-black/40 border-white/20"
                    required
                  />
                  <span className="text-xs text-gray-300 leading-relaxed font-medium">
                    I confirm that my dealership currently has at least 5 vehicles available for listing on MANIFOLD. <span className="text-[#EF233C]">*</span>
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !confirmedMinimumInventory}
                className="w-full mt-4 py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Dealer Account...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Business Information</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Secondary Link: Sign In */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <p className="text-xs text-gray-400">
              Already have a dealership account?{' '}
              <button
                onClick={() => navigate('/dealer/sign-in')}
                className="font-bold text-white hover:text-[#EF233C] transition underline underline-offset-4 ml-1"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>

        {/* Why list with MANIFOLD trigger */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowPreSignupModal(true)}
            className="text-[11px] text-gray-400 hover:text-white transition underline"
          >
            Review: Why list with MANIFOLD?
          </button>
        </div>
      </div>
    </div>
  );
};
