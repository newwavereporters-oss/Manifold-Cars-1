import React from 'react';
import {
  Video,
  Sparkles,
  Users,
  TrendingUp,
  SlidersHorizontal,
  Building2,
  Megaphone,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  PlusCircle,
  LayoutDashboard,
  ArrowLeft,
  DollarSign,
  HelpCircle,
  Eye,
  Check,
} from 'lucide-react';
import { useDealerAuth } from '../../context/DealerAuthContext';

interface DealerOfferPageProps {
  navigate: (route: string) => void;
}

export const DealerOfferPage: React.FC<DealerOfferPageProps> = ({ navigate }) => {
  const { user } = useDealerAuth();

  const handleListFirstCar = () => {
    if (user) {
      navigate('/dealer/cars/new');
    } else {
      navigate('/dealer/sign-in');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-[#111827] flex flex-col antialiased">
      {/* TOP BRAND HEADER */}
      <header className="bg-[#071A2B] text-white border-b border-white/10 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition"
              title="Back to MANIFOLD Marketplace"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div
              onClick={() => navigate('/')}
              className="cursor-pointer flex items-center gap-1.5 group"
            >
              <span className="text-xl font-extrabold tracking-tight text-white font-display">
                MANIFOLD
              </span>
              <span className="w-2 h-2 rounded-full bg-[#EF233C]" />
            </div>

            <div className="hidden sm:block h-4 w-[1px] bg-white/10" />

            <span className="text-[11px] font-bold uppercase tracking-widest text-[#EF233C] bg-red-950/60 border border-red-500/20 px-2 py-0.5 rounded">
              Dealer Partnership
            </span>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate('/dealer/dashboard')}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 border border-white/10"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>My Dashboard</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/dealer/sign-in')}
                  className="text-xs font-semibold text-gray-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/dealer/register')}
                  className="px-4 py-2 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-lg shadow-red-900/30"
                >
                  Register Dealership
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="bg-[#071A2B] text-white py-16 sm:py-24 relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-500/30 text-[#EF233C] text-xs font-bold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" />
            <span>The MANIFOLD Dealer Advantage</span>
          </div>

          {/* Section 15 Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white font-display leading-[1.15] max-w-4xl mx-auto">
            More Than a Listing.<br />
            <span className="text-[#EF233C]">A Better Way to Sell Your Cars.</span>
          </h1>

          {/* Section 15 Subtitle */}
          <p className="text-sm sm:text-base text-gray-300 max-w-2xl mx-auto leading-relaxed">
            MANIFOLD gives professional automobile dealers a better way to present their vehicles, reach serious buyers and understand where their inventory sits in the market.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleListFirstCar}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-xl shadow-red-900/40 group"
            >
              <PlusCircle className="w-4 h-4" />
              <span>List My First Car</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {user ? (
              <button
                onClick={() => navigate('/dealer/dashboard')}
                className="w-full sm:w-auto px-8 py-3.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 border border-white/10"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Go to My Dashboard</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/dealer/register')}
                className="w-full sm:w-auto px-8 py-3.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 border border-white/10"
              >
                <span>Register Dealership</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* CORE PROPOSITION SECTIONS */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* SECTION A: VIDEO-FIRST VEHICLE PRESENTATION */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#EF233C] flex items-center justify-center">
              <Video className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#071A2B] tracking-tight">
              A. Video-First Vehicle Presentation
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              MANIFOLD doesn't simply put another car card online. We present vehicles through professionally structured video content designed to make buyers understand the vehicle before they enquire.
            </p>
            <ul className="space-y-2.5 text-xs text-gray-700 font-medium pt-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#EF233C] shrink-0" />
                <span><strong>Dedicated Video Walkarounds:</strong> High-definition video showing engine sound, body condition, and interior trim.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#EF233C] shrink-0" />
                <span><strong>YouTube Distribution:</strong> Reaching Nigeria's vast audience of car enthusiasts and serious buyers.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#EF233C] shrink-0" />
                <span><strong>Stronger Vehicle Storytelling:</strong> Highlighting special packages, duty clearance, and service history.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#EF233C] shrink-0" />
                <span><strong>Elevated Buyer Confidence:</strong> Eliminating guesswork before inspection visits.</span>
              </li>
            </ul>
          </div>

          <div className="md:col-span-5 bg-[#071A2B] rounded-2xl p-6 text-white space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#EF233C]">
              Video Walkaround Standard
            </div>
            <div className="aspect-video rounded-xl bg-black/60 border border-white/10 flex flex-col items-center justify-center p-4 text-center">
              <Video className="w-8 h-8 text-[#EF233C] mb-2" />
              <span className="text-xs font-bold">100% Video-Backed Listings</span>
              <span className="text-[10px] text-gray-400 mt-1">Every vehicle featured on MANIFOLD includes YouTube video review capability.</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-normal">
              Listings with real walkaround reviews receive over 3x higher conversion from enquiry to completed purchase.
            </p>
          </div>
        </div>

        {/* SECTION B: MANIFOLD BUYER DISCOVERY */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-gray-200 shadow-sm space-y-6">
          <div className="max-w-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#071A2B] tracking-tight">
              B. MANIFOLD Buyer Discovery
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              MANIFOLD is building an automotive discovery experience where buyers can search naturally for what they actually want, rather than battling endless rigid dropdown menus.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Natural Discovery Query</span>
              <p className="text-xs font-bold text-gray-900 leading-snug">
                "Reliable SUV for a family of five under ₦35 million."
              </p>
              <p className="text-[11px] text-gray-500">
                Matches vetted Japanese and German 5-seaters with verified reliability scores.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Cross-Shopping Query</span>
              <p className="text-xs font-bold text-gray-900 leading-snug">
                "I want something like a 2021 Highlander but cheaper."
              </p>
              <p className="text-[11px] text-gray-500">
                Surfaces comparable Explorers, Pilots, and Pathfinders matching budget parameters.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Luxury Budget Query</span>
              <p className="text-xs font-bold text-gray-900 leading-snug">
                "Best luxury SUV around ₦50 million."
              </p>
              <p className="text-[11px] text-gray-500">
                Matches premium Lexus RX, Range Rover Velar, and Mercedes GLE options.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900 leading-relaxed">
              MANIFOLD is actively engineering technology around this conversational discovery process so your dealership's inventory is presented precisely when high-intent buyers describe their practical needs.
            </p>
          </div>
        </div>

        {/* SECTION C & G: MANIFOLD-DRIVEN ENQUIRIES + AUDIENCE PROMOTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#071A2B] tracking-tight">
              C. MANIFOLD-Driven Enquiries
            </h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              MANIFOLD's role is not simply to give dealers a dashboard. MANIFOLD actively builds audience, vehicle content and buyer discovery around listed inventory.
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">
              The objective is qualified buyer interest: connecting dealers to purchasers who have already seen the walkaround video, inspected the specs, and confirmed pricing feasibility.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#EF233C] flex items-center justify-center">
              <Megaphone className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#071A2B] tracking-tight">
              G. MANIFOLD Audience + Promotion
            </h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              MANIFOLD continuously invests in building its automotive audience and content ecosystem across YouTube, digital media, and concierge advisory channels.
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">
              As a verified partner, your dealership benefits from being an integral part of that ecosystem without spending tens of thousands on independent ad campaigns.
            </p>
          </div>
        </div>

        {/* SECTION D & E: MARKET PRICING INTELLIGENCE & PRICE REVIEW */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-gray-200 shadow-sm space-y-6">
          <div className="max-w-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold text-[#071A2B] tracking-tight">
                D. Market Pricing Intelligence & E. Price Review
              </h2>
            </div>
            <div className="inline-block text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
              Coming to your MANIFOLD dealer intelligence suite
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Automotive inventory turns faster when priced accurately relative to real-time market shifts. MANIFOLD is building intelligent price positioning tools for professional dealers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
              <strong className="text-xs font-bold text-gray-900 block">Asking Price Positioning</strong>
              <p className="text-[11px] text-gray-500">Understand where your vehicle price sits compared to recent Lagos transactions.</p>
            </div>
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
              <strong className="text-xs font-bold text-gray-900 block">Comparable Vehicles</strong>
              <p className="text-[11px] text-gray-500">Monitor competing stock across trim levels, mileage brackets, and conditions.</p>
            </div>
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
              <strong className="text-xs font-bold text-gray-900 block">Pricing Review Alerts</strong>
              <p className="text-[11px] text-gray-500">Identify vehicles whose pricing may need attention to accelerate qualified enquiry velocity.</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 leading-relaxed">
              <strong>Dealer Autonomy:</strong> Price recommendations do NOT automatically alter your vehicle price or change your dealership's commission rate. You retain full control over your pricing decisions.
            </p>
          </div>
        </div>

        {/* SECTION F & H: PROFESSIONAL DEALER PRESENCE & MARKET INTELLIGENCE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#071A2B] tracking-tight">
              F. Professional Dealer Presence
            </h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              MANIFOLD gives dealers a structured digital presence rather than simply placing inventory into an unverified directory.
            </p>
            <ul className="space-y-2 text-xs text-gray-600 font-medium">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#EF233C]" />
                <span>Verified Dealership Profile and Trust Badging</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#EF233C]" />
                <span>Dedicated showroom catalog presentation</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#EF233C]" />
                <span>Structured vehicle spec sheets and video player</span>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#071A2B] tracking-tight">
              H. Market Intelligence Layer
            </h2>
            <div className="inline-block text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              In Active Development
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              MANIFOLD is building an automotive intelligence layer around vehicle specs, pricing dynamics, buyer behaviour, market movement, and automotive content engagement.
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">
              This intelligence will feed directly into your dealer portal to help guide purchasing decisions and sourcing strategy.
            </p>
          </div>
        </div>

        {/* SECTION I & J: COMMISSION MODEL & WHY PROFESSIONAL DEALERS */}
        <div className="bg-[#071A2B] text-white rounded-3xl p-8 sm:p-10 border border-white/10 shadow-xl space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-[#EF233C]">
                <DollarSign className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                I. Success-Based Commission Model
              </h2>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                "MANIFOLD operates on a success-based commission model when a MANIFOLD-driven vehicle sale is completed."
              </p>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs text-gray-300">
                <p>• Zero upfront listing subscription fees.</p>
                <p>• Zero charges for video presentation or audience reach.</p>
                <p>• Complete alignment: we succeed strictly when your vehicle sells.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-[#EF233C]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                J. Built for Professional Dealers
              </h2>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                MANIFOLD is designed specifically around professional automotive businesses that value vehicle quality, transparent pricing, and serious buyers.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-300 pt-1">
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                  <strong className="text-white block">Better Presentation</strong>
                  <span className="text-[11px] text-gray-400">Video-first fidelity</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                  <strong className="text-white block">Better Discovery</strong>
                  <span className="text-[11px] text-gray-400">Natural buyer matching</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                  <strong className="text-white block">Better Conversations</strong>
                  <span className="text-[11px] text-gray-400">Pre-vetted buyers</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                  <strong className="text-white block">Better Presence</strong>
                  <span className="text-[11px] text-gray-400">Verified reputation</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 16: BOTTOM CALL TO ACTION */}
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-gray-200 shadow-sm text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#EF233C] bg-red-50 border border-red-200 px-3 py-1 rounded-full">
            Immediate Platform Access
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#071A2B] tracking-tight">
            Ready to put your inventory on MANIFOLD?
          </h2>

          <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            Your dealer account is active immediately upon registration. List your first car today and experience the difference of a video-first automotive concierge.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleListFirstCar}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
            >
              <PlusCircle className="w-4 h-4" />
              <span>List My First Car</span>
            </button>

            {user ? (
              <button
                onClick={() => navigate('/dealer/dashboard')}
                className="w-full sm:w-auto px-8 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Go to My Dashboard</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/dealer/sign-in')}
                className="w-full sm:w-auto px-8 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2"
              >
                <span>Dealer Sign In</span>
              </button>
            )}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-[#071A2B] text-white py-8 border-t border-white/10 mt-auto text-xs text-gray-400 text-center">
        <p>© 2026 MANIFOLD. Nigeria's Automotive Concierge. All rights reserved.</p>
      </footer>
    </div>
  );
};
