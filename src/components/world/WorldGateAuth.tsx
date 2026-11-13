import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  User,
  Car,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import {
  loginPlayerAccount,
  registerPlayerAccount,
  requestPlayerPasswordReset,
  type PlayerProfile,
  type WorldDbStatus,
} from '../../services/playerService';

interface WorldGateAuthProps {
  dbStatus: WorldDbStatus | null;
  onAuthenticated: (profile: PlayerProfile, serverClockOffsetMs: number) => void;
  onNavigateMarketplace: () => void;
}

type AuthScreenMode = 'LOGIN' | 'REGISTER' | 'FORGOT';

export const WorldGateAuth: React.FC<WorldGateAuthProps> = ({
  dbStatus,
  onAuthenticated,
  onNavigateMarketplace,
}) => {
  const [mode, setMode] = useState<AuthScreenMode>('LOGIN');

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register fields
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Forgot password field
  const [resetEmail, setResetEmail] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginPlayerAccount(loginEmail, loginPassword);
      if (!res.success || !res.profile) {
        setErrorMsg(res.error || 'Unable to sign in. Verify your credentials and try again.');
        return;
      }
      onAuthenticated(res.profile, res.serverClockOffsetMs || 0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const nameTrim = fullName.trim();
    const nickTrim = nickname.trim();
    const emailTrim = regEmail.trim().toLowerCase();
    const phoneDigits = phoneNumber.replace(/[^0-9+]/g, '');

    if (nameTrim.length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!/^[a-zA-Z0-9_ ]{3,20}$/.test(nickTrim)) {
      setErrorMsg('Nickname must be 3–20 characters using letters, numbers, spaces, or underscores.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (phoneDigits.replace(/\D/g, '').length < 7 || phoneDigits.replace(/\D/g, '').length > 15) {
      setErrorMsg('Please enter a valid phone number (7–15 digits).');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== confirmPassword) {
      setErrorMsg('Password and Confirm Password do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerPlayerAccount({
        fullName: nameTrim,
        nickname: nickTrim,
        email: emailTrim,
        phoneNumber: phoneNumber.trim(),
        password: regPassword,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Registration failed.');
        return;
      }

      setLoginEmail(emailTrim);
      setLoginPassword('');
      setMode('LOGIN');
      setSuccessMsg(
        res.needsEmailVerification
          ? 'Account created! Check your email inbox to confirm your address, then sign in below.'
          : 'Account registered successfully! Sign in with your email and password to enter Lagos.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setErrorMsg('Enter a valid email address to receive a password reset link.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await requestPlayerPasswordReset(resetEmail);
      if (!res.success) {
        setErrorMsg(res.error || 'Unable to send reset email.');
        return;
      }
      setSuccessMsg('Password recovery instructions have been sent to your email address.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative z-20 flex items-center justify-center min-h-full w-full px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-md bg-[#071A2B]/92 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-2xl overflow-hidden">
        {/* Top Automotive Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/10 bg-gradient-to-br from-[#0b233a] to-[#071A2B]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#EF233C] flex items-center justify-center shadow-lg shadow-[#EF233C]/30 shrink-0">
                <Car className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 block">
                  Lagos Open-World Driving
                </span>
                <h1 className="text-lg font-black tracking-tight text-white">MANIFOLD CARS 3D</h1>
              </div>
            </div>

            <button
              type="button"
              onClick={onNavigateMarketplace}
              className="text-[11px] font-bold text-gray-300 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors whitespace-nowrap"
            >
              Marketplace
            </button>
          </div>

          <p className="mt-3 text-xs text-gray-300 leading-relaxed">
            {mode === 'LOGIN'
              ? 'Sign in with your registered MANIFOLD driver account to enter Lagos Mainland, Victoria Island, Ikoyi & Lekki.'
              : mode === 'REGISTER'
              ? 'Create your registered MANIFOLD driver profile. Choose your public nickname and start driving.'
              : 'Enter the email registered with your MANIFOLD driver account to reset your password.'}
          </p>
        </div>

        {/* Migration Notice if DB schema hasn't been applied */}
        {dbStatus && dbStatus.configured && dbStatus.migrationRequired && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[11px] leading-relaxed">
            <strong className="font-bold block text-amber-300 mb-0.5">Supabase World Migration Pending</strong>
            Run <code className="font-mono bg-black/30 px-1 rounded">src/db/game-world-social-migration.sql</code> in your Supabase SQL Editor to activate player profiles and live multiplayer.
          </div>
        )}

        {/* Mode Switcher Tabs */}
        {mode !== 'FORGOT' && (
          <div className="grid grid-cols-2 gap-1.5 mx-6 mt-5 p-1 rounded-2xl bg-black/30 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode('LOGIN');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                mode === 'LOGIN'
                  ? 'bg-[#EF233C] text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Driver Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('REGISTER');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                mode === 'REGISTER'
                  ? 'bg-[#EF233C] text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        <div className="p-6 pt-4 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="driver@example.com"
                    autoComplete="email"
                    className="w-full h-10 pl-10 pr-3.5 bg-white/5 border border-white/15 rounded-xl text-sm text-white placeholder-gray-500 focus:border-[#EF233C] focus:bg-white/10 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(loginEmail);
                      setMode('FORGOT');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full h-10 pl-10 pr-10 bg-white/5 border border-white/15 rounded-xl text-sm text-white placeholder-gray-500 focus:border-[#EF233C] focus:bg-white/10 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((p) => !p)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-[#EF233C] hover:bg-[#d90429] disabled:opacity-60 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#EF233C]/30 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Enter MANIFOLD World</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-center text-xs text-gray-400 pt-1">
                New to MANIFOLD World?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('REGISTER');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-white font-bold hover:text-[#EF233C] underline underline-offset-2"
                >
                  Create Account
                </button>
              </p>
            </form>
          )}

          {/* REGISTRATION FORM */}
          {mode === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Sanni Adeyemi"
                      className="w-full h-9 pl-9 pr-3 bg-white/5 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:border-[#EF233C] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">
                    Public Nickname
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="SANNI"
                    className="w-full h-9 px-3 bg-white/5 border border-white/15 rounded-xl text-xs font-bold text-white placeholder-gray-500 focus:border-[#EF233C] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">
                  Email Address (Private)
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-9 pl-9 pr-3 bg-white/5 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:border-[#EF233C] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">
                  Phone Number (Private)
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+234 803 000 0000"
                    className="w-full h-9 pl-9 pr-3 bg-white/5 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:border-[#EF233C] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className="w-full h-9 pl-3 pr-8 bg-white/5 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:border-[#EF233C] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword((p) => !p)}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white"
                      aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full h-9 px-3 bg-white/5 border border-white/15 rounded-xl text-xs text-white placeholder-gray-500 focus:border-[#EF233C] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 text-[11px] text-gray-400 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Only your public <strong className="text-white">Nickname</strong> appears to other drivers in Lagos. Your full name, email, and phone remain private.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-[#EF233C] hover:bg-[#d90429] disabled:opacity-60 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#EF233C]/30 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Profile...</span>
                  </>
                ) : (
                  <>
                    <span>Register Driver Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'FORGOT' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                  Registered Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="driver@example.com"
                    className="w-full h-10 pl-10 pr-3.5 bg-white/5 border border-white/15 rounded-xl text-sm text-white placeholder-gray-500 focus:border-[#EF233C] outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Send Reset Link</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('LOGIN');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="w-full text-center text-xs font-semibold text-gray-400 hover:text-white"
              >
                Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
