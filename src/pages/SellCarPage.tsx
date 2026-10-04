import React, { useState } from 'react';
import { ShieldCheck, Video, PhoneCall, CheckCircle2, ArrowRight } from 'lucide-react';
import { CAR_BRANDS } from '../data/brandsAndTypes';

interface SellCarPageProps {
  navigate: (route: string) => void;
}

export const SellCarPage: React.FC<SellCarPageProps> = ({ navigate }) => {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('2021');
  const [mileage, setMileage] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [condition, setCondition] = useState('Foreign Used');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('Lagos');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!make || !model || !askingPrice || !name || !phone) return;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <button onClick={() => navigate('/')} className="hover:text-gray-900">
            Home
          </button>
          <span>/</span>
          <span className="text-gray-900 font-medium">Sell a Car</span>
        </div>

        {/* Hero */}
        <div className="bg-[#071A2B] text-white rounded-2xl p-8 mb-8 border border-white/10 shadow-xl space-y-3">
          <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#EF233C]">
            VERIFIED SELLER CONCIERGE
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display">
            Sell Your Car Fast. No Endless Unscreened Phone Calls.
          </h1>
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-xl">
            MANIFOLD audits your vehicle physically, shoots a signature video walkaround, and
            manages qualified buyer enquiries from start to finish.
          </p>
        </div>

        {submitted ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h2 className="text-2xl font-bold text-[#071A2B] font-display">
              Listing Submission Received
            </h2>

            <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
              Thank you, <span className="font-semibold text-gray-900">{name}</span>. A MANIFOLD
              inspection coordinator will call you at{' '}
              <span className="font-semibold text-gray-900">{phone}</span> to schedule the physical
              audit and video walkaround session for your {year} {make} {model}.
            </p>

            <button
              onClick={() => navigate('/')}
              className="mt-4 px-6 py-2.5 bg-[#071A2B] text-white text-xs font-bold uppercase tracking-wider rounded"
            >
              Return to Home
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-6"
          >
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#071A2B] pb-2 border-b border-gray-200 mb-4">
                Vehicle Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Make *
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
                    Model & Trim *
                  </label>
                  <input
                    type="text"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. Camry XSE, RX 350 F-Sport"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Year of Manufacture
                  </label>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-medium focus:bg-white focus:border-[#071A2B] outline-none"
                  >
                    {[2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map(
                      (y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      )
                    )}
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
                    <option value="Nigerian Used">Clean Nigerian Used</option>
                    <option value="Brand New">Brand New</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Mileage (km)
                  </label>
                  <input
                    type="number"
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    placeholder="e.g. 45000"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Target Asking Price (NGN) *
                  </label>
                  <input
                    type="text"
                    required
                    value={askingPrice}
                    onChange={(e) => setAskingPrice(e.target.value)}
                    placeholder="e.g. ₦25,000,000"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#071A2B] pb-2 border-b border-gray-200 mb-4">
                Owner Contact Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alhaji Sanusi"
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
                    placeholder="0802 000 0000"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Car Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Lekki Phase 1, Lagos"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-12 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded shadow transition flex items-center justify-center gap-2"
            >
              <span>Schedule Inspection & Video Production</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
