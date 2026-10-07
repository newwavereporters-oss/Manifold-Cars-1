import React, { useState, useEffect } from 'react';
import { DealerLayout } from '../../components/dealer/DealerLayout';
import { useDealerAuth } from '../../context/DealerAuthContext';
import {
  dealerOperationsService,
  DealerBusinessProfileData,
} from '../../services/dealerOperationsService';
import {
  Building2,
  MapPin,
  FileText,
  Globe,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Phone,
  Mail,
  Info,
} from 'lucide-react';

interface DealerBusinessProfilePageProps {
  navigate: (route: string) => void;
}

export const DealerBusinessProfilePage: React.FC<DealerBusinessProfilePageProps> = ({
  navigate,
}) => {
  const { dealerAccount, user } = useDealerAuth();
  const dealerId = dealerAccount?.dealerId;

  // Form State
  const [businessName, setBusinessName] = useState('');
  const [tradingName, setTradingName] = useState('');
  const [businessType, setBusinessType] = useState('Automobile Dealership');
  const [businessDescription, setBusinessDescription] = useState('');
  const [website, setWebsite] = useState('');

  // Business Address
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('Lagos');
  const [state, setState] = useState('Lagos');
  const [country, setCountry] = useState('Nigeria');

  // Business Registration
  const [cacRegNumber, setCacRegNumber] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchProfile() {
      if (!dealerId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await dealerOperationsService.getBusinessProfile(dealerId);
      if (mounted) {
        if (data) {
          setBusinessName(data.business_name || dealerAccount?.businessName || '');
          setTradingName(data.trading_name || '');
          setBusinessType(data.business_type || 'Automobile Dealership');
          setBusinessDescription(data.business_description || '');
          setWebsite(data.website || '');
          setAddressLine1(data.address_line_1 || '');
          setAddressLine2(data.address_line_2 || '');
          setCity(data.city || 'Lagos');
          setState(data.state || 'Lagos');
          setCountry(data.country || 'Nigeria');
          setCacRegNumber(data.cac_registration_number || '');
        } else {
          setBusinessName(dealerAccount?.businessName || '');
        }
        setLoading(false);
      }
    }
    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [dealerId, dealerAccount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealerId) return;

    if (!businessName.trim()) {
      setErrorMessage('Business Name is required.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSavedSuccess(false);

    const payload: DealerBusinessProfileData = {
      business_name: businessName.trim(),
      trading_name: tradingName.trim() || businessName.trim(),
      business_type: businessType.trim(),
      business_description: businessDescription.trim(),
      website: website.trim(),
      address_line_1: addressLine1.trim(),
      address_line_2: addressLine2.trim(),
      city: city.trim() || 'Lagos',
      state: state.trim() || 'Lagos',
      country: country.trim() || 'Nigeria',
      cac_registration_number: cacRegNumber.trim(),
    };

    const res = await dealerOperationsService.saveBusinessProfile(dealerId, payload);
    setSaving(false);

    if (res.success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } else {
      setErrorMessage(res.error || 'Failed to save business profile.');
    }
  };

  return (
    <DealerLayout currentRoute="/dealer/business-profile" navigate={navigate}>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* HEADER */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#EF233C] bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                Account Settings
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#071A2B] tracking-tight font-display">
              Business Profile
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Manage your verified dealership credentials and administrative details.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dealer/dashboard')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* FEEDBACK BANNERS */}
        {savedSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">Dealership business profile saved successfully.</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-xs text-red-800 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-[#EF233C] shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* PRIVACY PROTECTION NOTICE (Section 14) */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 leading-relaxed">
            <strong>MANIFOLD Dealership Privacy Protection:</strong> Your private contact details, address,
            and business registration are securely stored for internal operational records and partner compliance.
            Public marketplace visitors connect through the dedicated MANIFOLD concierge (08169664607) to ensure verified buyer screening.
          </div>
        </div>

        {/* PROFILE FORM */}
        {loading ? (
          <div className="py-20 text-center text-xs text-gray-400 bg-white rounded-3xl border border-gray-200 p-8 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#EF233C]" />
            <span>Loading dealership business profile...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* SECTION 1: DEALERSHIP */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
                <Building2 className="w-5 h-5 text-[#EF233C]" />
                <h2 className="text-base font-bold text-[#071A2B] uppercase tracking-wide">
                  Dealership
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Apex Luxury Motors"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#EF233C] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Trading Name
                  </label>
                  <input
                    type="text"
                    value={tradingName}
                    onChange={(e) => setTradingName(e.target.value)}
                    placeholder="e.g. Apex Motors Lekki"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#EF233C] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Business Type
                  </label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#EF233C] focus:bg-white transition"
                  >
                    <option value="Automobile Dealership">Automobile Dealership</option>
                    <option value="Luxury Car Importer">Luxury Car Importer</option>
                    <option value="Certified Pre-Owned Dealer">Certified Pre-Owned Dealer</option>
                    <option value="Authorized Distributor">Authorized Distributor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Website
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://yourdealership.com"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#EF233C] focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Business Description
                  </label>
                  <textarea
                    rows={3}
                    value={businessDescription}
                    onChange={(e) => setBusinessDescription(e.target.value)}
                    placeholder="Describe your dealership, inventory specialization, and services..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#EF233C] focus:bg-white transition"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: BUSINESS ADDRESS */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
                <MapPin className="w-5 h-5 text-[#EF233C]" />
                <h2 className="text-base font-bold text-[#071A2B] uppercase tracking-wide">
                  Business Address
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Address Line 1 *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    placeholder="e.g. Plot 14 Admiralty Way"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#EF233C] focus:bg-white transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Address Line 2 (Optional)
                  </label>
                  <input
                    type="text"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    placeholder="Suite, building number, showroom bay..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#EF233C] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Lagos"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#EF233C] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    State
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Lagos"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#EF233C] focus:bg-white transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Country
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Nigeria"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#EF233C] focus:bg-white transition"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: BUSINESS REGISTRATION */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
                <FileText className="w-5 h-5 text-[#EF233C]" />
                <h2 className="text-base font-bold text-[#071A2B] uppercase tracking-wide">
                  Business Registration
                </h2>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  CAC Registration Number (Optional)
                </label>
                <input
                  type="text"
                  value={cacRegNumber}
                  onChange={(e) => setCacRegNumber(e.target.value)}
                  placeholder="e.g. RC-1928374 or BN-987654"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#EF233C] focus:bg-white transition"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Optional. CAC registration is not required to maintain an active dealership on MANIFOLD.
                </p>
              </div>
            </div>

            {/* SAVE BUTTON (Section 21) */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3.5 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center gap-2 shadow-lg shadow-red-900/30 disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : savedSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </DealerLayout>
  );
};
