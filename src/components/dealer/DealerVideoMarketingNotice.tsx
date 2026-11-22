import React from 'react';
import { Video, Camera, Share2, Youtube, MessageCircle, CheckCircle2 } from 'lucide-react';
import {
  DEALER_MARKETING_SERVICES,
  DEALER_MARKETING_WHATSAPP_NUMBER,
  DEALER_MARKETING_WHATSAPP_URL,
} from '../../utils/carMedia';

interface DealerVideoMarketingNoticeProps {
  compact?: boolean;
}

export const DealerVideoMarketingNotice: React.FC<DealerVideoMarketingNoticeProps> = ({
  compact = false,
}) => {
  return (
    <div className="rounded-2xl border border-[#071A2B]/15 bg-gradient-to-br from-[#071A2B] via-[#0B2239] to-[#071A2B] text-white p-5 sm:p-6 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#EF233C]">
            <Video className="w-3.5 h-3.5" />
            <span>Video Optional on Submission · Add Anytime Later</span>
          </div>
          <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-white uppercase">
            MANIFOLD IS A VIDEO-FIRST CAR LISTING PLATFORM
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed max-w-2xl">
            Walkaround videos help serious buyers inspect condition and close faster — yet you can{' '}
            <strong className="text-white">save or submit your listing now without a video</strong>{' '}
            using your vehicle photos and attach a YouTube video link anytime later from Edit Listing.
          </p>
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {[
            { icon: Share2, label: DEALER_MARKETING_SERVICES[0] },
            { icon: Camera, label: DEALER_MARKETING_SERVICES[1] },
            { icon: Youtube, label: DEALER_MARKETING_SERVICES[2] },
          ].map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.label}
                className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start gap-2.5"
              >
                <Icon className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-gray-100 leading-snug">
                  {service.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {compact && (
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-gray-200">
          {DEALER_MARKETING_SERVICES.map((service) => (
            <li key={service} className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#EF233C] shrink-0" />
              <span>{service}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-gray-300">
          Need our crew to shoot your inventory or grow your dealership channels? Reach us on WhatsApp:{' '}
          <strong className="text-white font-mono">{DEALER_MARKETING_WHATSAPP_NUMBER}</strong>
        </div>

        <a
          href={DEALER_MARKETING_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-slate-950 text-xs font-extrabold uppercase tracking-wider transition shrink-0 shadow-md"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Book Dealer Media &amp; Marketing</span>
        </a>
      </div>
    </div>
  );
};
