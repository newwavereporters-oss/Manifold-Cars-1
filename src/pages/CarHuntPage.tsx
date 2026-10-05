import React, { useState, useEffect } from 'react';
import { CheckCircle2, ArrowRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CAR_BRANDS, BODY_TYPES } from '../data/brandsAndTypes';

interface CarHuntPageProps {
  navigate: (route: string) => void;
}

interface BrandOption {
  id: string;
  name: string;
}

interface ModelOption {
  id: string;
  name: string;
}

interface TypeOption {
  id: string;
  name: string;
}

export const CarHuntPage: React.FC<CarHuntPageProps> = ({ navigate }) => {
  // Database option lists
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [bodyTypes, setBodyTypes] = useState<TypeOption[]>([]);
  const [loadingBrands, setLoadingBrands] = useState<boolean>(true);
  const [loadingModels, setLoadingModels] = useState<boolean>(false);

  // Form State
  const [preferredBrandId, setPreferredBrandId] = useState<string>('');
  const [preferredModelId, setPreferredModelId] = useState<string>('');
  const [trim, setTrim] = useState<string>('');
  const [budget, setBudget] = useState<string>('');
  const [yearMin, setYearMin] = useState<string>('2019');
  const [bodyTypeId, setBodyTypeId] = useState<string>('');
  const [condition, setCondition] = useState<string>('Foreign Used (Tokunbo)');
  const [location, setLocation] = useState<string>('');

  const [customerName, setCustomerName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [buyingTimeframe, setBuyingTimeframe] = useState<string>('Within 2 weeks');
  const [requirements, setRequirements] = useState<string>('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<any | null>(null);

  // 1. Load active brands from public.car_brands and body types from public.car_types
  useEffect(() => {
    let isMounted = true;

    async function loadInitialOptions() {
      setLoadingBrands(true);
      try {
        // Load active brands
        const { data: brandsData, error: brandsError } = await supabase
          .from('car_brands')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (!brandsError && brandsData && brandsData.length > 0) {
          if (isMounted) setBrands(brandsData);
        } else {
          // Fallback to static brands if table is unseeded
          if (isMounted) {
            setBrands(CAR_BRANDS.map((b) => ({ id: b.id, name: b.name })));
          }
        }

        // Load active body types
        const { data: typesData, error: typesError } = await supabase
          .from('car_types')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (!typesError && typesData && typesData.length > 0) {
          if (isMounted) {
            setBodyTypes(typesData);
            setBodyTypeId(typesData[0].id);
          }
        } else {
          if (isMounted) {
            setBodyTypes(BODY_TYPES.map((t) => ({ id: t.id, name: t.name })));
            setBodyTypeId(BODY_TYPES[0].id);
          }
        }
      } catch (err) {
        console.warn('Could not load options from Supabase:', err);
        if (isMounted) {
          setBrands(CAR_BRANDS.map((b) => ({ id: b.id, name: b.name })));
          setBodyTypes(BODY_TYPES.map((t) => ({ id: t.id, name: t.name })));
          setBodyTypeId(BODY_TYPES[0].id);
        }
      } finally {
        if (isMounted) setLoadingBrands(false);
      }
    }

    loadInitialOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Load models dynamically when brand changes
  useEffect(() => {
    let isMounted = true;
    setPreferredModelId('');

    if (!preferredBrandId) {
      setModels([]);
      return;
    }

    async function loadModelsForBrand() {
      setLoadingModels(true);
      try {
        const { data, error } = await supabase
          .from('car_models')
          .select('id, name')
          .eq('brand_id', preferredBrandId)
          .eq('is_active', true)
          .order('name');

        if (!error && data && data.length > 0) {
          if (isMounted) setModels(data);
        } else {
          // Fallback check against static CAR_BRANDS popular models
          const matchedStatic = CAR_BRANDS.find(
            (b) => b.id === preferredBrandId || b.name.toLowerCase() === preferredBrandId.toLowerCase()
          );
          if (matchedStatic && matchedStatic.popular_models?.length) {
            if (isMounted) {
              setModels(
                matchedStatic.popular_models.map((m, idx) => ({
                  id: `model-${preferredBrandId}-${idx}`,
                  name: m,
                }))
              );
            }
          } else {
            if (isMounted) setModels([]);
          }
        }
      } catch (err) {
        console.warn('Failed to load models:', err);
        if (isMounted) setModels([]);
      } finally {
        if (isMounted) setLoadingModels(false);
      }
    }

    loadModelsForBrand();

    return () => {
      isMounted = false;
    };
  }, [preferredBrandId]);

  // Form submission directly to Supabase
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validation checks
    if (!preferredBrandId) {
      setSubmitError('Please select a Preferred Make.');
      return;
    }
    if (!budget.trim()) {
      setSubmitError('Please enter your Maximum Budget.');
      return;
    }
    if (!customerName.trim()) {
      setSubmitError('Please provide your Full Name.');
      return;
    }
    if (!phone.trim()) {
      setSubmitError('Please provide your Phone / WhatsApp number.');
      return;
    }

    // Immediately disable button to prevent double submissions
    setIsSubmitting(true);

    try {
      const parsedBudget = budget ? Number(budget.replace(/[^0-9.]/g, '')) : null;
      const parsedYear = yearMin ? Number(yearMin) : null;

      const payload = {
        customer_name: customerName.trim(),
        email: email?.trim() || null,
        phone: phone.trim(),
        budget_max: parsedBudget,
        preferred_brand_id: preferredBrandId || null,
        preferred_model_id: preferredModelId || null,
        body_type_id: bodyTypeId || null,
        year_min: parsedYear,
        location: location?.trim() || null,
        requirements: requirements?.trim() || null,
        trim: trim?.trim() || null,
        preferred_condition: condition || null,
        buying_timeframe: buyingTimeframe || null,
        status: 'new',
        assigned_to: null,
      };

      const { data, error } = await supabase
        .from('car_hunt_requests')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('MANIFOLD Car Hunt Error:', error);
        setSubmitError("We couldn't submit your request right now. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Success
      setSubmittedRecord(data || { id: `MHF-${Date.now()}`, ...payload });
      setIsSubmitting(false);
    } catch (err: any) {
      console.error('MANIFOLD Car Hunt Error:', err);
      setSubmitError("We couldn't submit your request right now. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedRecord(null);
    setSubmitError(null);
    setPreferredBrandId('');
    setPreferredModelId('');
    setTrim('');
    setBudget('');
    setCustomerName('');
    setPhone('');
    setEmail('');
    setLocation('');
    setRequirements('');
  };

  const selectedBrand = brands.find((b) => b.id === preferredBrandId);
  const selectedModel = models.find((m) => m.id === preferredModelId);
  const selectedType = bodyTypes.find((t) => t.id === bodyTypeId);

  const referenceCode = submittedRecord?.id
    ? `MHF-HUNT-${submittedRecord.id.slice(0, 8).toUpperCase()}`
    : `MHF-HUNT-${Date.now().toString().slice(-6)}`;

  return (
    <div className="min-h-screen bg-[#F7F8FA] pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <button onClick={() => navigate('/')} className="hover:text-gray-900 transition">
            Home
          </button>
          <span>/</span>
          <span className="text-gray-900 font-medium">Car Hunt (Concierge Sourcing)</span>
        </div>

        {/* Hero Banner */}
        <div className="bg-[#071A2B] text-white rounded-2xl p-8 mb-8 relative overflow-hidden border border-white/10 shadow-xl">
          <div className="max-w-xl space-y-3 relative z-10">
            <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#EF233C]">
              MANIFOLD SOURCING CONCIERGE
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display">
              Can't Find Your Exact Car? Let MANIFOLD Hunt It Down.
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              Tell us your exact target trim, specs, and budget. Our automotive inspectors will audit
              verified dealer inventories across Lagos and Abuja, perform physical checks, record
              video walkarounds, and present options directly to you.
            </p>
          </div>
        </div>

        {/* SUCCESS STATE */}
        {submittedRecord ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 sm:p-10 text-center space-y-5 shadow-sm animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                REQUEST RECEIVED
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#071A2B] font-display mt-2">
                Your MANIFOLD Car Hunt request has been received.
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 max-w-lg mx-auto leading-relaxed mt-2">
                Our sourcing team will review your requirements and contact you shortly.
              </p>
            </div>

            {/* Reference Badge */}
            <div className="inline-flex items-center gap-2 bg-[#071A2B]/5 border border-[#071A2B]/10 px-4 py-2 rounded-lg text-xs">
              <span className="text-gray-500 font-medium">Tracking Reference:</span>
              <span className="font-mono font-bold text-[#071A2B] tracking-wider">
                {referenceCode}
              </span>
            </div>

            {/* Summary Card */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-xs text-gray-700 max-w-lg mx-auto text-left space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                <span className="text-gray-500">Customer:</span>
                <span className="font-bold text-gray-900">{customerName}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                <span className="text-gray-500">Contact Phone:</span>
                <span className="font-bold text-gray-900">{phone}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                <span className="text-gray-500">Target Vehicle:</span>
                <span className="font-bold text-gray-900">
                  {yearMin}+ {selectedBrand?.name || 'Selected Make'}{' '}
                  {selectedModel?.name ? selectedModel.name : ''}
                  {trim ? ` (${trim})` : ''}
                </span>
              </div>
              {budget && (
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-gray-500">Budget Limit:</span>
                  <span className="font-bold text-emerald-700">
                    ₦{Number(budget.replace(/[^0-9.]/g, '')).toLocaleString()}
                  </span>
                </div>
              )}
              {location && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Preferred Location:</span>
                  <span className="font-semibold text-gray-800">{location}</span>
                </div>
              )}
            </div>

            {/* Steps Info */}
            <div className="bg-gray-50/80 border border-gray-200 rounded-lg p-4 text-xs text-gray-600 max-w-lg mx-auto text-left space-y-1.5">
              <p className="font-bold text-gray-800 uppercase tracking-wider text-[10px]">
                MANIFOLD Sourcing Protocol:
              </p>
              <p>1. We search unlisted arrivals at our top verified dealership partners.</p>
              <p>
                2. We physically inspect candidates for paint thickness, chassis integrity, and
                customs papers.
              </p>
              <p>3. We send you an unedited video walkaround with our recommendation.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => navigate('/cars')}
                className="w-full sm:w-auto px-6 py-3 bg-[#071A2B] hover:bg-[#0B2239] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow transition"
              >
                Browse Existing Inventory
              </button>
              <button
                onClick={handleResetForm}
                className="w-full sm:w-auto px-5 py-3 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition inline-flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                <span>Submit Another Request</span>
              </button>
            </div>
          </div>
        ) : (
          /* FORM */
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-6"
          >
            {/* Error Notification */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-start gap-3 text-xs animate-in fade-in duration-200">
                <AlertCircle className="w-5 h-5 text-[#EF233C] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-[#EF233C]">Submission Notice</p>
                  <p className="leading-relaxed">{submitError}</p>
                </div>
              </div>
            )}

            {/* SECTION 1: TARGET VEHICLE SPECIFICATIONS */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#071A2B] pb-2 border-b border-gray-200 mb-4">
                1. Target Vehicle Specifications
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* PREFERRED MAKE */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Preferred Make *
                  </label>
                  <select
                    required
                    value={preferredBrandId}
                    onChange={(e) => setPreferredBrandId(e.target.value)}
                    disabled={loadingBrands}
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none disabled:opacity-60 transition"
                  >
                    <option value="">
                      {loadingBrands ? 'Loading Makes...' : 'Select Make'}
                    </option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* MODEL */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Model
                  </label>
                  <select
                    value={preferredModelId}
                    onChange={(e) => setPreferredModelId(e.target.value)}
                    disabled={!preferredBrandId || loadingModels}
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none disabled:opacity-50 transition"
                  >
                    <option value="">
                      {!preferredBrandId
                        ? 'Select Make First'
                        : loadingModels
                        ? 'Loading Models...'
                        : 'Any Model / All Models'}
                    </option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* TRIM / VARIANT */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Trim / Variant
                  </label>
                  <input
                    type="text"
                    value={trim}
                    onChange={(e) => setTrim(e.target.value)}
                    placeholder="e.g. XLE, TXL, Sport, Luxury"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none transition"
                  />
                </div>

                {/* MAXIMUM BUDGET */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Maximum Budget (NGN) *
                  </label>
                  <input
                    type="text"
                    required
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. ₦30,000,000"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none transition"
                  />
                </div>

                {/* MINIMUM YEAR */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Minimum Year
                  </label>
                  <select
                    value={yearMin}
                    onChange={(e) => setYearMin(e.target.value)}
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none transition"
                  >
                    {[2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
                      <option key={y} value={y}>
                        {y}+
                      </option>
                    ))}
                  </select>
                </div>

                {/* BODY TYPE */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Body Type
                  </label>
                  <select
                    value={bodyTypeId}
                    onChange={(e) => setBodyTypeId(e.target.value)}
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none transition"
                  >
                    {bodyTypes.map((bt) => (
                      <option key={bt.id} value={bt.id}>
                        {bt.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* CONDITION */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none transition"
                  >
                    <option value="Foreign Used (Tokunbo)">Foreign Used (Tokunbo)</option>
                    <option value="Brand New">Brand New</option>
                    <option value="Nigerian Used">Clean Nigerian Used</option>
                    <option value="Any">Any Condition</option>
                  </select>
                </div>

                {/* CUSTOMER LOCATION */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Customer Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Lagos, Abuja, Port Harcourt"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none transition"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: YOUR CONTACT INFORMATION */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#071A2B] pb-2 border-b border-gray-200 mb-4">
                2. Your Contact Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* FULL NAME */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Chukwuma Obi"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none transition"
                  />
                </div>

                {/* PHONE / WHATSAPP */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Phone / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0803 000 0000"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none transition"
                  />
                </div>

                {/* EMAIL */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="chukwuma@example.com"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none transition"
                  />
                </div>

                {/* TARGET BUYING TIMEFRAME */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Target Buying Timeframe
                  </label>
                  <select
                    value={buyingTimeframe}
                    onChange={(e) => setBuyingTimeframe(e.target.value)}
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none transition"
                  >
                    <option value="Ready now / this week">Ready now / this week</option>
                    <option value="Within 2 weeks">Within 2 weeks</option>
                    <option value="Within 1 month">Within 1 month</option>
                    <option value="1–3 months">1–3 months</option>
                    <option value="Just researching">Just researching</option>
                  </select>
                </div>
              </div>

              {/* SPECIFIC PREFERENCES */}
              <div className="mt-4">
                <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                  Specific Preferences
                </label>
                <textarea
                  rows={3}
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="e.g. Must have panoramic sunroof, black or beige leather interior, original customs duty paper verified."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none transition"
                />
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-[#EF233C] hover:bg-[#d91b32] disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded shadow transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Car Hunt Request to MANIFOLD</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
