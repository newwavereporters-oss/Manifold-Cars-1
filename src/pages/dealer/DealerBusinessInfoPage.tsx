import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  FileText,
  Globe,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { useDealerAuth } from '../../context/DealerAuthContext';
import { dealerOnboardingService } from '../../services/dealerOnboardingService';

interface DealerBusinessInfoPageProps {
  navigate: (route: string) => void;
}

export const DealerBusinessInfoPage: React.FC<DealerBusinessInfoPageProps> = ({ navigate }) => {
  const { user, dealerAccount, refreshDealerStatus } = useDealerAuth();

  // If already completed onboarding, redirect to dashboard
  useEffect(() => {
    if (dealerAccount?.hasAccount) {
      navigate('/dealer/dashboard');
    }
  }, [dealerAccount, navigate]);

  // Form Fields
  const [businessName, setBusinessName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('Lagos');
  const [state, setState] = useState('Lagos');
  const [country, setCountry] = useState('Nigeria');
  const [cacRegNumber, setCacRegNumber] = useState('');
  const [businessType, setBusinessType] = useState('Automobile Dealership');
  const [businessDescription, setBusinessDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [contactName, setContactName] = useState(
    user?.user_metadata?.full_name || user?.user_metadata?.contact_name || ''
  );
  const [phone, setPhone] = useState(user?.user_metadata?.phone || '');

  // Submission State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!businessName.trim()) {
      setError('Business Name is required.');
      return;
    }
    if (!addressLine1.trim()) {
      setError('Primary Business Address is required.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        business_name: businessName.trim(),
        contact_name: contactName.trim() || businessName.trim(),
        phone: phone.trim() || '08000000000',
        address_line_1: addressLine1.trim(),
        address_line_2: addressLine2.trim() || null,
        city: city.trim() || 'Lagos',
        state: state.trim() || 'Lagos',
        country: country.trim() || 'Nigeria',
        cac_registration_number: cacRegNumber.trim() || null,
        business_type: businessType.trim() || null,
        business_description: businessDescription.trim() || null,
        website: website.trim() || null,
        minimum_inventory_confirmed: true,
      };

      // Call the authoritative PostgreSQL SECURITY DEFINER RPC
      const result = await dealerOnboardingService.submitOnboarding(payload);

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // Refresh dealer account state
      await refreshDealerStatus();

      // Navigate to Section 9: Onboarding Success
      navigate('/dealer/onboarding-success');
    } catch (err: any) {
      console.error('Onboarding submission error:', err);
      setError('An unexpected error occurred while saving your dealership profile. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#071A2B] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-[#111827] relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent pointer-events-none" />

      {/* Header Lockup */}
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center relative z-10 px-4">
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
            Automobile Dealer Onboarding
          </span>
        </div>

        {/* Section 7 Title */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Tell us about your dealership
        </h2>
        <p className="mt-1.5 text-xs text-gray-400 max-w-lg mx-auto">
          Step 2 of 2 — Provide verified dealership information for the MANIFOLD marketplace.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-2xl relative z-10 px-4">
        <div className="bg-[#0B2239] py-8 px-6 sm:px-10 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-sm">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
              <p className="text-xs text-red-200 leading-relaxed font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* SECTION: BASIC BUSINESS INFO */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 border-b border-white/10 pb-2 mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#EF233C]" />
                <span>Primary Dealership Information</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Business Name (REQUIRED) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Dealership Business Name <span className="text-[#EF233C]">*</span>
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Prestige Motors Lekki Ltd"
                    required
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#EF233C] focus:ring-1 focus:ring-[#EF233C] transition"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Your public trading brand name as displayed to prospective buyers.
                  </p>
                </div>

                {/* Business Type (OPTIONAL) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Business Type <span className="text-gray-400 font-normal lowercase">(optional)</span>
                  </label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#EF233C] focus:ring-1 focus:ring-[#EF233C] transition"
                  >
                    <option value="Automobile Dealership">Automobile Dealership</option>
                    <option value="Independent Importer">Direct Automobile Importer</option>
                    <option value="Luxury Consignment">Luxury Consignment Showroom</option>
                    <option value="Certified Pre-Owned">Certified Pre-Owned Specialist</option>
                    <option value="Corporate Fleet Distributor">Corporate Fleet Distributor</option>
                  </select>
                </div>

                {/* CAC Registration Number (OPTIONAL) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    CAC Registration Number <span className="text-gray-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={cacRegNumber}
                    onChange={(e) => setCacRegNumber(e.target.value)}
                    placeholder="e.g. RC 1849202"
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#EF233C] focus:ring-1 focus:ring-[#EF233C] transition"
                  />
                </div>
              </div>
            </div>

            {/* SECTION: ADDRESS INFORMATION */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 border-b border-white/10 pb-2 mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#EF233C]" />
                <span>Physical Location & Showroom Address</span>
              </h3>

              <div className="space-y-4">
                {/* Primary Address (REQUIRED) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Primary Business Address <span className="text-[#EF233C]">*</span>
                  </label>
                  <input
                    type="text"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    placeholder="e.g. Plot 14, Admiralty Way, Lekki Phase 1"
                    required
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#EF233C] focus:ring-1 focus:ring-[#EF233C] transition"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Private dealership address is never exposed publicly to website visitors.
                  </p>
                </div>

                {/* Address 2 (OPTIONAL) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Address Line 2 <span className="text-gray-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    placeholder="Suite, Bay or Landmark"
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#EF233C] focus:ring-1 focus:ring-[#EF233C] transition"
                  />
                </div>

                {/* City & State & Country */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      City <span className="text-gray-400 font-normal lowercase">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Lekki"
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#EF233C] focus:ring-1 focus:ring-[#EF233C] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      State <span className="text-gray-400 font-normal lowercase">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="Lagos"
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#EF233C] focus:ring-1 focus:ring-[#EF233C] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      Country <span className="text-gray-400 font-normal lowercase">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Nigeria"
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#EF233C] focus:ring-1 focus:ring-[#EF233C] transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION: PROFILE & WEB PRESENCE */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 border-b border-white/10 pb-2 mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#EF233C]" />
                <span>Online Presence & Description</span>
              </h3>

              <div className="space-y-4">
                {/* Website (OPTIONAL) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Website or Instagram URL <span className="text-gray-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://prestigemotors.ng or https://instagram.com/dealership"
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#EF233C] focus:ring-1 focus:ring-[#EF233C] transition"
                  />
                </div>

                {/* Description (OPTIONAL) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                    Dealership Description <span className="text-gray-400 font-normal lowercase">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={businessDescription}
                    onChange={(e) => setBusinessDescription(e.target.value)}
                    placeholder="Brief summary of your showroom specializations, years in business, and vehicle sourcing standards."
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#EF233C] focus:ring-1 focus:ring-[#EF233C] transition"
                  />
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Onboarding to MANIFOLD...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Dealership Onboarding Application</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Security / Verification Assurance */}
        <div className="mt-4 text-center text-[11px] text-gray-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Application processed via PostgreSQL Security Definer RPC</span>
        </div>
      </div>
    </div>
  );
};
