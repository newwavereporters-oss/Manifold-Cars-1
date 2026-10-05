import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, Phone, MessageSquare, Mail, Loader2, AlertCircle } from 'lucide-react';
import { Car } from '../types';
import { FORMAT_CURRENCY } from '../data/mockCars';
import { inquiryService } from '../services/inquiryService';

interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  car?: Car | null;
  generalInquiry?: boolean;
}

export const InquiryModal: React.FC<InquiryModalProps> = ({
  isOpen,
  onClose,
  car,
  generalInquiry = false,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('Lagos');
  const [contactMethod, setContactMethod] = useState<'call' | 'whatsapp' | 'email'>('whatsapp');
  const [needsFinancing, setNeedsFinancing] = useState(false);
  const [needsInspection, setNeedsInspection] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone) return;
    setErrorMsg(null);
    setSubmitting(true);

    try {
      await inquiryService.createInquiry({
        car_id: car?.id,
        car_title: car?.title || (generalInquiry ? 'General Vehicle Concierge' : 'Vehicle Assistance'),
        car_price: car?.price || 0,
        full_name: fullName.trim(),
        phone_number: phone.trim(),
        email: email.trim() || 'concierge-lead@manifold.ng',
        location: location.trim(),
        preferred_contact: contactMethod,
        needs_financing: needsFinancing,
        needs_inspection: needsInspection,
        notes: notes.trim(),
      });
      setSubmitting(false);
      setSubmitted(true);
    } catch (err: any) {
      setSubmitting(false);
      setErrorMsg(err.message || 'Failed to submit enquiry to MANIFOLD database.');
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-200 relative">
        {/* Header Bar */}
        <div className="bg-[#071A2B] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-wider text-sm font-display">MANIFOLD</span>
            <span className="text-gray-400">·</span>
            <span className="text-xs text-gray-200 font-medium">Concierge Assistance</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-xl font-bold text-[#071A2B] font-display">
              Enquiry Received by MANIFOLD
            </h3>

            <p className="text-sm text-gray-600 leading-relaxed max-w-sm mx-auto">
              Thank you, <span className="font-semibold text-gray-900">{fullName}</span>. A MANIFOLD
              concierge advisor is reviewing your request regarding{' '}
              <span className="font-semibold text-gray-900">
                {car ? car.title : 'vehicle assistance'}
              </span>
              . We will contact you via {contactMethod.toUpperCase()} shortly.
            </p>

            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 border border-gray-200 max-w-sm mx-auto text-left">
              <p className="font-semibold text-gray-700 mb-1">What happens next?</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>We verify the current physical presence and price of the car.</li>
                <li>We arrange an accompanied viewing at your convenience.</li>
                <li>Zero unsolicited spam from outside dealers.</li>
              </ul>
            </div>

            <button
              onClick={handleReset}
              className="mt-4 px-6 py-2.5 bg-[#071A2B] hover:bg-[#0B2239] text-white text-xs font-bold uppercase tracking-wider rounded"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Target Car Summary or General Concierge */}
            {car ? (
              <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={car.video.youtube_thumbnail_url}
                    alt={car.title}
                    className="w-16 h-11 object-cover rounded shrink-0 border border-gray-200"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#071A2B] truncate">{car.title}</p>
                    <p className="text-[11px] text-gray-500">{car.location}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-extrabold text-[#071A2B] tabular-nums font-display">
                    {FORMAT_CURRENCY(car.price)}
                  </span>
                  <div className="text-[10px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Verified</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-50/70 border border-red-100 rounded-lg p-3 text-xs text-gray-700">
                <p className="font-bold text-[#071A2B] mb-0.5">Speak with MANIFOLD Concierge</p>
                <p className="text-gray-600">
                  Tell us what you're looking for, or ask questions about inspection, customs clearance,
                  financing, or vehicle availability.
                </p>
              </div>
            )}

            {/* Strict Notice: Direct Dealer Contact Protected */}
            <div className="flex items-start gap-2 text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded border border-gray-100">
              <ShieldCheck className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
              <span>
                <strong>MANIFOLD Concierge Guarantee:</strong> The buyer relationship belongs to MANIFOLD.
                We protect you from direct dealer harassment and supervise viewings.
              </span>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Babatunde Adeleke"
                  className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] focus:ring-1 focus:ring-[#071A2B] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Phone / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0803 000 0000"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] focus:ring-1 focus:ring-[#071A2B] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] focus:ring-1 focus:ring-[#071A2B] outline-none"
                  />
                </div>
              </div>

              {/* Preferred Contact Method */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Preferred Contact Channel
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setContactMethod('whatsapp')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded border transition ${
                      contactMethod === 'whatsapp'
                        ? 'bg-[#071A2B] text-white border-[#071A2B]'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContactMethod('call')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded border transition ${
                      contactMethod === 'call'
                        ? 'bg-[#071A2B] text-white border-[#071A2B]'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Phone Call</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContactMethod('email')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded border transition ${
                      contactMethod === 'email'
                        ? 'bg-[#071A2B] text-white border-[#071A2B]'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email</span>
                  </button>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needsInspection}
                    onChange={(e) => setNeedsInspection(e.target.checked)}
                    className="w-4 h-4 text-[#EF233C] rounded border-gray-300 focus:ring-[#EF233C]"
                  />
                  <span>I would like an independent physical inspection before viewing</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needsFinancing}
                    onChange={(e) => setNeedsFinancing(e.target.checked)}
                    className="w-4 h-4 text-[#EF233C] rounded border-gray-300 focus:ring-[#EF233C]"
                  />
                  <span>I need auto financing or flexible payment assistance</span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Questions or specific requirements
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Can you confirm if customs duty was cleared at Tin Can, or if you can arrange viewing this Saturday in Lekki?"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] focus:ring-1 focus:ring-[#071A2B] outline-none"
                />
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded shadow transition duration-150 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting to Database...</span>
                  </>
                ) : (
                  <span>Submit Enquiry to MANIFOLD</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
