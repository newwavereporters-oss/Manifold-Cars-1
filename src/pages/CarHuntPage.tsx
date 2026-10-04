import React, { useState } from 'react';
import { Compass, ShieldCheck, CheckCircle2, Phone, ArrowRight, UserCheck } from 'lucide-react';
import { CAR_BRANDS, BODY_TYPES, NIGERIAN_LOCATIONS } from '../data/brandsAndTypes';

interface CarHuntPageProps {
  navigate: (route: string) => void;
}

export const CarHuntPage: React.FC<CarHuntPageProps> = ({ navigate }) => {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [budget, setBudget] = useState('');
  const [yearMin, setYearMin] = useState('2019');
  const [bodyType, setBodyType] = useState('SUV');
  const [condition, setCondition] = useState('Foreign Used');
  const [location, setLocation] = useState('Lagos');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [timeframe, setTimeframe] = useState('Within 2 weeks');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!make || !budget || !name || !phone) return;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <button onClick={() => navigate('/')} className="hover:text-gray-900">
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

        {submitted ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h2 className="text-2xl font-bold text-[#071A2B] font-display">
              Car Hunt Request Initialized!
            </h2>

            <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
              Thank you, <span className="font-semibold text-gray-900">{name}</span>. A MANIFOLD
              Sourcing Concierge specialist has been assigned to your request for a{' '}
              <span className="font-semibold text-gray-900">
                {yearMin}+ {make} {model || 'any trim'}
              </span>
              . We will contact you at <span className="font-semibold text-gray-900">{phone}</span> within 24 hours.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600 max-w-md mx-auto text-left space-y-1.5">
              <p className="font-bold text-gray-800">Our Next Steps:</p>
              <p>1. We search unlisted arrivals at our top verified dealership partners.</p>
              <p>2. We physically inspect candidates for paint thickness, chassis integrity, and customs papers.</p>
              <p>3. We send you an unedited video walkaround with our recommendation.</p>
            </div>

            <button
              onClick={() => navigate('/cars')}
              className="mt-4 px-6 py-2.5 bg-[#071A2B] text-white text-xs font-bold uppercase tracking-wider rounded"
            >
              Browse Existing Inventory
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-6"
          >
            {/* Step 1: Vehicle Target */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#071A2B] pb-2 border-b border-gray-200 mb-4">
                1. Target Vehicle Specifications
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Preferred Make *
                  </label>
                  <select
                    required
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
                  >
                    <option value="">Select Make</option>
                    {CAR_BRANDS.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Model / Trim
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. Highlander XLE, Prado TXL, RX 350"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
                  />
                </div>

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
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Minimum Year
                  </label>
                  <select
                    value={yearMin}
                    onChange={(e) => setYearMin(e.target.value)}
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
                  >
                    {[2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
                      <option key={y} value={y}>
                        {y}+
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Body Type
                  </label>
                  <select
                    value={bodyType}
                    onChange={(e) => setBodyType(e.target.value)}
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
                  >
                    {BODY_TYPES.map((bt) => (
                      <option key={bt.id} value={bt.name}>
                        {bt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
                  >
                    <option value="Foreign Used">Foreign Used (Tokunbo)</option>
                    <option value="Brand New">Brand New</option>
                    <option value="Nigerian Used">Clean Nigerian Used</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 2: Contact Details */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#071A2B] pb-2 border-b border-gray-200 mb-4">
                2. Your Contact Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Chukwuma Obi"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
                  />
                </div>

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
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="chukwuma@example.com"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Target Buying Timeframe
                  </label>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
                  >
                    <option value="Ready now / this week">Ready now / this week</option>
                    <option value="Within 2 weeks">Within 2 weeks</option>
                    <option value="Within 1 month">Within 1 month</option>
                    <option value="Just researching">Just researching</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                  Specific preferences (Color, interior, options, customs requirement)
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Must have panoramic sunroof, black or beige leather interior, original customs duty paper verified."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full h-12 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded shadow transition flex items-center justify-center gap-2"
              >
                <span>Submit Car Hunt Request to MANIFOLD</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
