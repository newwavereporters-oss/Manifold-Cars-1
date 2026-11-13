import React, { useState } from 'react';
import {
  ShieldCheck,
  BookOpen,
  Compass,
  Lightbulb,
  CheckSquare,
  Square,
  ArrowRight,
  LogOut,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { acceptGameBriefing, type PlayerProfile } from '../../services/playerService';

interface WorldBriefingPortalProps {
  profile: PlayerProfile;
  onAccepted: (updatedProfile: PlayerProfile, serverClockOffsetMs: number) => void;
  onLogout: () => void;
}

const BRIEFING_SECTIONS = [
  {
    num: '1',
    title: 'Acceptance of Terms',
    body: 'By creating an account and clicking "I Agree and Continue", you enter a binding agreement to follow MANIFOLD CARS 3D community rules, fair-play standards, and safety policies while accessing the game world.',
  },
  {
    num: '2',
    title: 'Platform Overview & Purpose',
    body: 'MANIFOLD is an automotive discovery, marketplace, dealer showcase, and interactive 3D driving platform centered on verified Nigerian and regional vehicle inventory alongside free-roam Lagos driving.',
  },
  {
    num: '3',
    title: 'Eligibility & Account Registration',
    body: 'You must register with accurate account information, maintain only one active driver identity per session, and keep your login credentials secure. You are responsible for all activity under your account.',
  },
  {
    num: '4',
    title: 'User Conduct & Fair Play',
    body: 'Drive respectfully, avoid intentional disruption of other players, and never attempt to exploit game telemetry, missions, virtual credits, or multiplayer communications.',
  },
  {
    num: '5',
    title: 'Player Safety & Anti-Harassment Policy',
    body: 'Threats, hate speech, intimidation, impersonation, or targeted harassment toward any driver, dealer, or staff member is strictly prohibited and results in immediate restriction or suspension.',
  },
  {
    num: '6',
    title: 'Prohibited Activities in Chat & Social Interactions',
    body: 'MANIFOLD real-time driving chat enforces automated server moderation. You must not share personal phone numbers, email addresses, external URLs, WhatsApp/Telegram/Snapchat/Instagram/TikTok handles, dating propositions, or sexually explicit content.',
  },
  {
    num: '7',
    title: 'Privacy & Public Visibility (Nickname-Only Exposure Rule)',
    body: 'Inside the 3D driving world, only your public Nickname, vehicle choice, and active nearby driving presence are visible to nearby drivers. Your full name, email address, and phone number are never broadcast to other players.',
  },
  {
    num: '8',
    title: 'Interactive Features (Chat Invitation, Block, Report)',
    body: 'Drivers within proximity may send a 30-second chat invitation that requires explicit acceptance before opening a conversation. You may block or report any driver at any time; blocking terminates the chat and hides both players from each other.',
  },
  {
    num: '9',
    title: 'Vehicle Configuration & 24-Hour Setting Lock',
    body: 'Your chosen vehicle model, exterior paint color, interior finish, and in-car music preference are locked for 24 hours once confirmed. You will be able to reconfigure those four choices again once the countdown expires.',
  },
  {
    num: '10',
    title: 'Virtual Economy & Non-Monetary Credits',
    body: 'MANIFOLD Credits (MC) earned from cruises, speed traps, and driving missions are in-game progression units with zero cash value, no withdrawal rights, and no real-world currency equivalence.',
  },
  {
    num: '11',
    title: 'Real-World Vehicle Marketplace Disclaimer',
    body: 'Showroom displays and marketplace links showcase verified dealership listings. Real-world vehicle purchases, inspections, and financing occur exclusively through official MANIFOLD Marketplace workflows outside in-game chat.',
  },
  {
    num: '12',
    title: 'Intellectual Property',
    body: 'All MANIFOLD branding, 3D city layouts, vehicle configurations, UI systems, and platform software remain the property of MANIFOLD. Do not redistribute, scrape, or reverse-engineer platform assets.',
  },
  {
    num: '13',
    title: 'Service Availability & Updates',
    body: 'Features, road districts, vehicles, and multiplayer rules may be updated or temporarily paused for maintenance without prior notice.',
  },
  {
    num: '14',
    title: 'Moderation, Suspension & Account Termination',
    body: 'Automated filters and administrators monitor chat safety incidents and player reports. Repeated violations trigger progressive chat restrictions and permanent account suspension.',
  },
  {
    num: '15',
    title: 'Limitation of Liability',
    body: 'MANIFOLD CARS 3D is provided "as is". To the fullest extent permitted by law, MANIFOLD is not liable for indirect losses, temporary service interruptions, or user-generated conduct.',
  },
  {
    num: '16',
    title: 'Changes to Terms',
    body: 'Updated versions of these terms may be presented in-game when material rules change; continued access requires acceptance of the latest terms version.',
  },
  {
    num: '17',
    title: 'Contact Information',
    body: 'For safety appeals, account questions, or dealership enquiries, use official MANIFOLD support and concierge channels available through the Marketplace Portal.',
  },
];

export const WorldBriefingPortal: React.FC<WorldBriefingPortalProps> = ({
  profile,
  onAccepted,
  onLogout,
}) => {
  const [activeSection, setActiveSection] = useState<'OVERVIEW' | 'TERMS' | 'HINTS'>('OVERVIEW');
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!agreed) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await acceptGameBriefing();
      if (!res.success || !res.profile) {
        setErrorMsg(res.error || 'Could not record agreement. Please try again.');
        return;
      }
      onAccepted(res.profile, res.serverClockOffsetMs || 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative z-20 flex items-center justify-center min-h-full w-full px-3 sm:px-6 py-6 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#071A2B]/94 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-[#091f34]">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 block">
              Mandatory Driver Briefing • Welcome, {profile.nickname}
            </span>
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
              MANIFOLD CARS 3D — World Briefing & Terms
            </h1>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 hover:text-white transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Navigation Pills */}
        <div className="px-6 pt-3 pb-2 border-b border-white/10 flex flex-wrap gap-2 bg-black/20">
          <button
            type="button"
            onClick={() => setActiveSection('OVERVIEW')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeSection === 'OVERVIEW'
                ? 'bg-[#EF233C] text-white'
                : 'bg-white/5 text-gray-300 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>About & How to Play</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('TERMS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeSection === 'TERMS'
                ? 'bg-[#EF233C] text-white'
                : 'bg-white/5 text-gray-300 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Terms & Conditions (17 Sections)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('HINTS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeSection === 'HINTS'
                ? 'bg-[#EF233C] text-white'
                : 'bg-white/5 text-gray-300 hover:text-white'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Quick Game Hints</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-gray-200 leading-relaxed">
          {activeSection === 'OVERVIEW' && (
            <>
              <section className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#EF233C]" />
                  <span>About MANIFOLD</span>
                </h2>
                <p>
                  MANIFOLD connects car enthusiasts and buyers across Nigeria with verified dealer inventory, interactive 3D automotive exploration, and an authentic Lagos open-world driving experience.
                </p>
                <p className="text-gray-400">
                  Drive across Victoria Island, Lagos Island, the Third Mainland Bridge, Ikoyi Link Bridge, Lekki Peninsula, Ajah, and Epe while discovering real dealer vehicles along Showroom Boulevard and connecting safely with nearby drivers.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  How to Play MANIFOLD CARS 3D
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                    <span className="font-black text-white block mb-1">1. Configure Your Ride</span>
                    <span className="text-gray-300">
                      Next up, pick your Sports Coupe, Luxury SUV, Executive Sedan, or Rugged 4x4, plus paint color, interior trim, and music channel (locked for 24 hours once confirmed).
                    </span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                    <span className="font-black text-white block mb-1">2. Driving & Touch Controls</span>
                    <span className="text-gray-300">
                      Desktop: W/A/S/D or Arrow Keys, Space to drift, H for horn, C for Tuning, M for Lagos Map, R to recover. Mobile: dedicated Gas, Brake, Left/Right, Drift, Ignition & Headlights.
                    </span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                    <span className="font-black text-white block mb-1">3. Lagos Bridges & City Map</span>
                    <span className="text-gray-300">
                      Open the Lagos GPS Map to route across the Third Mainland Bridge, Adekunle Interchange, Ikoyi Link Bridge, Lekki-Epe Expressway, and Mainland districts.
                    </span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                    <span className="font-black text-white block mb-1">4. Nearby Drivers & Safe Chat</span>
                    <span className="text-gray-300">
                      Only drivers online nearby appear with their public Nickname badge. Tap a nearby vehicle or open Nearby Drivers to send a 30-second chat invitation. Always follow chat safety rules.
                    </span>
                  </div>
                </div>
              </section>

              <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-between gap-3">
                <span className="text-sky-200">
                  Please review the full 17-section Terms & Conditions before accepting.
                </span>
                <button
                  type="button"
                  onClick={() => setActiveSection('TERMS')}
                  className="px-3 py-1.5 rounded-xl bg-sky-500 text-slate-950 font-black uppercase text-[10px] shrink-0 whitespace-nowrap"
                >
                  Read Terms
                </button>
              </div>
            </>
          )}

          {activeSection === 'TERMS' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 text-emerald-200">
                All 17 sections below apply to your registered MANIFOLD CARS 3D driver account and community interactions.
              </div>
              {BRIEFING_SECTIONS.map((sec) => (
                <div key={sec.num} className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                  <h3 className="font-black text-white text-xs mb-1">
                    {sec.num}. {sec.title}
                  </h3>
                  <p className="text-gray-300 text-xs">{sec.body}</p>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'HINTS' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  title: '24-Hour Configuration Lock',
                  body: 'Once you confirm your vehicle, color, interior, and music, those 4 settings stay locked for 24 hours. Preview them carefully in 3D before entering Lagos.',
                },
                {
                  title: 'Cockpit & Exterior Inspection',
                  body: 'Switch cameras in-game between Chase, Cockpit, Orbit, and Drone views to admire your selected cabin leather and dashboard gauges.',
                },
                {
                  title: 'Nearby Drivers Only',
                  body: 'There is no global user directory. Drive closer to active drivers on Lagos roads to reveal their public Nickname tag and send a chat invitation.',
                },
                {
                  title: 'Zero Private Info in Chat',
                  body: 'Keep chats about cars, driving routes, and music. Sharing phone numbers, emails, social handles, dating solicitations, or inappropriate text is blocked.',
                },
                {
                  title: 'Missions & Speed Traps',
                  body: 'Pass Speed Traps or accept VIP Delivery and Street Race missions to earn MANIFOLD Credits (MC) for performance upgrades.',
                },
                {
                  title: 'Instant Block & Report',
                  body: 'Every chat window includes Block and Report controls. Blocking disconnects immediately and hides both players.',
                },
              ].map((hint) => (
                <div key={hint.title} className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                  <span className="font-black text-amber-300 block mb-1">{hint.title}</span>
                  <span className="text-gray-300">{hint.body}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Consent & Continue */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#05121f] space-y-3">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setAgreed((prev) => !prev)}
              className="flex items-start gap-2.5 text-left group cursor-pointer"
            >
              {agreed ? (
                <CheckSquare className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Square className="w-5 h-5 text-gray-400 group-hover:text-white shrink-0 mt-0.5" />
              )}
              <span className="text-xs text-gray-200">
                I have read and agree to the <strong className="text-white">MANIFOLD CARS 3D</strong> Briefing, Conduct Policy, Privacy Rules, and Terms & Conditions.
              </span>
            </button>

            <button
              type="button"
              disabled={!agreed || isSubmitting}
              onClick={handleContinue}
              className="px-6 h-11 rounded-xl bg-[#EF233C] hover:bg-[#d90429] disabled:bg-white/10 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shrink-0 whitespace-nowrap cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>I Agree and Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
