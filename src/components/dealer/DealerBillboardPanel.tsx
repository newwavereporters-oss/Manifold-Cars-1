import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CarFront,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  ADMIN_BILLBOARD_WHATSAPP_NUMBER,
  billboardService,
  type DealerBillboardState,
  getDealerBillboardUpgradeWhatsAppUrl,
} from '../../services/billboardService';
import { type DealerCarRecord } from '../../services/dealerVehicleService';

interface DealerBillboardPanelProps {
  dealerId?: string;
  dealerName?: string;
  cars: DealerCarRecord[];
  navigate: (route: string) => void;
}

export const DealerBillboardPanel: React.FC<DealerBillboardPanelProps> = ({
  dealerId,
  dealerName,
  cars,
  navigate,
}) => {
  const [state, setState] = useState<DealerBillboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyCarId, setBusyCarId] = useState<string | null>(null);
  const [busyRemoveId, setBusyRemoveId] = useState<string | null>(null);
  const [replacePromptCar, setReplacePromptCar] = useState<DealerCarRecord | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const res = await billboardService.getMyDealerBillboardState();
      setState(res);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Unable to load billboard status.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dealerId) {
      void loadState();
    } else {
      setLoading(false);
    }
  }, [dealerId, loadState]);

  const activeAssignments = (state?.assignments || []).filter((a) => a.status === 'active');
  const activeVehicleIds = new Set(activeAssignments.map((a) => a.vehicle_id));
  const publishedCars = cars.filter((c) => c.status === 'PUBLISHED');

  const handleAssign = async (car: DealerCarRecord, replaceExisting = false) => {
    setBusyCarId(car.id);
    setFeedback(null);
    try {
      const res = await billboardService.assignVehicleToBillboard(car.id, replaceExisting);
      if (res.success) {
        setReplacePromptCar(null);
        setFeedback({
          type: 'success',
          text: replaceExisting
            ? `Replaced billboard slot with "${car.title}". Live in MANIFOLD 3D World!`
            : `"${car.title}" is now live on the MANIFOLD Game Billboard!`,
        });
        await loadState();
      } else if (res.errorCode === 'BILLBOARD_SLOT_LIMIT_REACHED' && !replaceExisting) {
        setReplacePromptCar(car);
      } else {
        setFeedback({
          type: 'error',
          text: res.message || 'Unable to assign vehicle to Game Billboard.',
        });
      }
    } finally {
      setBusyCarId(null);
    }
  };

  const handleRemoveSlot = async (assignmentId: string, title?: string) => {
    setBusyRemoveId(assignmentId);
    setFeedback(null);
    try {
      const res = await billboardService.removeMyBillboardSlot(assignmentId);
      if (res.success) {
        setFeedback({
          type: 'success',
          text: title
            ? `Removed "${title}" from your Game Billboard slot.`
            : 'Removed vehicle from Game Billboard.',
        });
        await loadState();
      } else {
        setFeedback({ type: 'error', text: res.message || 'Failed to remove billboard slot.' });
      }
    } finally {
      setBusyRemoveId(null);
    }
  };

  const whatsAppUrl = getDealerBillboardUpgradeWhatsAppUrl(dealerName);

  return (
    <div className="space-y-6">
      {/* HERO HEADER */}
      <div className="bg-[#071A2B] text-white rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300 bg-amber-500/15 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                MANIFOLD 3D Advertising
              </span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs font-semibold text-emerald-400">
                {state?.plan_name || 'Standard Plan (1 Slot)'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-display">
              Game World Dealer Billboard
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              Showcase one of your published vehicles on the suspended top promotional billboard
              inside MANIFOLD CARS 3D. Every driver sees your price, discount, and can open your
              listing directly.
            </p>
          </div>

          <div className="bg-white/5 border border-white/15 rounded-2xl p-4 min-w-[200px] text-center shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
              Billboard Slot Usage
            </span>
            <div className="text-3xl font-black text-white font-mono mt-1">
              {state?.active_slots_used ?? activeAssignments.length}
              <span className="text-base text-gray-400 font-bold">
                {' '}
                / {state?.max_active_slots ?? 1}
              </span>
            </div>
            <span className="text-[11px] text-amber-300 font-semibold block mt-0.5">
              {(state?.remaining_slots ?? 1) > 0
                ? `${state?.remaining_slots ?? 1} slot available`
                : 'Slot limit active'}
            </span>
          </div>
        </div>
      </div>

      {state?.schemaNotApplied && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Game Billboard Database Migration Required</p>
            <p className="mt-0.5 text-amber-800">
              Apply <code className="font-mono font-bold">src/db/manifold-game-expansion-migration.sql</code> in
              your Supabase SQL Editor to enable live dealership billboard assignments.
            </p>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* CURRENTLY ACTIVE BILLBOARD SLOT */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#EF233C]" />
            <h2 className="text-sm font-bold text-gray-900">Active Game Billboard Slot</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadState()}
            className="text-xs font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin text-[#EF233C]" />
            <span>Loading active billboard placement...</span>
          </div>
        ) : activeAssignments.length === 0 ? (
          <div className="py-8 text-center space-y-2 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <p className="text-sm font-bold text-gray-800">No vehicle currently on the Game Billboard</p>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Select any published vehicle from your inventory below and click{' '}
              <strong className="text-gray-800">ASSIGN TO GAME BILLBOARD</strong>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {activeAssignments.map((slot) => (
              <div
                key={slot.id}
                className="p-4 rounded-2xl bg-[#071A2B]/5 border border-[#071A2B]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {slot.vehicle_image ? (
                    <img
                      src={slot.vehicle_image}
                      alt={slot.vehicle_title || 'Billboard vehicle'}
                      className="w-20 h-14 object-cover rounded-xl bg-gray-100 border border-gray-200 shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                      <CarFront className="w-6 h-6" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                        Live on Billboard
                      </span>
                      <span className="text-[11px] text-gray-500 font-mono">
                        Order #{slot.priority_order}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 truncate mt-1">
                      {slot.vehicle_title || 'Assigned Vehicle'}
                    </h3>
                    <div className="flex items-center gap-2 text-xs mt-0.5">
                      {slot.vehicle_price != null && (
                        <span className="font-extrabold text-[#071A2B]">
                          ₦{slot.vehicle_price.toLocaleString()}
                        </span>
                      )}
                      {slot.vehicle_previous_price != null &&
                        slot.vehicle_price != null &&
                        slot.vehicle_previous_price > slot.vehicle_price && (
                          <span className="text-gray-400 line-through">
                            ₦{slot.vehicle_previous_price.toLocaleString()}
                          </span>
                        )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {slot.vehicle_slug && (
                    <button
                      type="button"
                      onClick={() => navigate(`/cars/${slot.vehicle_slug}`)}
                      className="px-3 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyRemoveId === slot.id}
                    onClick={() => void handleRemoveSlot(slot.id, slot.vehicle_title)}
                    className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-[#EF233C] text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                  >
                    {busyRemoveId === slot.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PUBLISHED INVENTORY PICKER */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              Select a Published Vehicle to Advertise ({publishedCars.length})
            </h2>
            <p className="text-xs text-gray-500">
              Only published vehicles belonging to {dealerName || 'your dealership'} can be
              assigned to the in-game billboard.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dealer/cars/new')}
            className="text-xs font-bold text-[#EF233C] hover:underline self-start sm:self-auto"
          >
            + Add New Vehicle
          </button>
        </div>

        {publishedCars.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              You currently have no published vehicles. Publish a vehicle listing first, then assign
              it to the MANIFOLD Game Billboard.
            </p>
            <button
              type="button"
              onClick={() => navigate('/dealer/cars')}
              className="px-4 py-2 rounded-xl bg-[#071A2B] text-white text-xs font-bold uppercase"
            >
              Manage My Vehicles
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {publishedCars.map((car) => {
              const isAssigned = activeVehicleIds.has(car.id);
              const thumb = car.gallery_image_1_url || car.youtube_thumbnail_url;
              return (
                <div
                  key={car.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={car.title}
                        className="w-16 h-11 object-cover rounded-xl bg-gray-100 border border-gray-200 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                        <CarFront className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-gray-900 truncate">{car.title}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <span className="font-bold text-gray-800">
                          ₦{car.price.toLocaleString()}
                        </span>
                        {car.previous_price && car.previous_price > car.price && (
                          <span className="line-through text-gray-400">
                            ₦{car.previous_price.toLocaleString()}
                          </span>
                        )}
                        <span>·</span>
                        <span>{car.year}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 self-end sm:self-center">
                    {isAssigned ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Active on Billboard</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busyCarId === car.id}
                        onClick={() => void handleAssign(car, false)}
                        className="px-4 py-2 rounded-xl bg-[#EF233C] hover:bg-[#D90429] text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        {busyCarId === car.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Megaphone className="w-3.5 h-3.5" />
                        )}
                        <span>ASSIGN TO GAME BILLBOARD</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MANDATORY UPGRADE CTA CARD */}
      <div className="bg-gradient-to-r from-[#071A2B] to-[#0D2C48] text-white rounded-3xl p-6 sm:p-8 border border-amber-400/25 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
            Dealership Billboard Expansion
          </span>
          <h3 className="text-xl font-extrabold text-white tracking-tight">
            WANT TO ADVERTISE MORE VEHICLES?
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            Every verified dealer includes 1 active Game Billboard slot by default. To promote
            multiple vehicles simultaneously across MANIFOLD CARS 3D, reach out to Admin on
            WhatsApp ({ADMIN_BILLBOARD_WHATSAPP_NUMBER}) to upgrade your billboard quota.
          </p>
        </div>

        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-3 rounded-2xl bg-[#25D366] hover:bg-[#1ebe5d] text-slate-950 text-xs font-black uppercase tracking-wider inline-flex items-center justify-center gap-2 shadow-lg shrink-0 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          <span>CHAT WITH ADMIN ON WHATSAPP</span>
        </a>
      </div>

      {/* REPLACE EXISTING SLOT CONFIRMATION MODAL */}
      {replacePromptCar && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <Megaphone className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-extrabold text-gray-900 text-base">
                Replace Existing Billboard Vehicle?
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Your dealership is already using its{' '}
                <strong>
                  {state?.active_slots_used ?? 1} / {state?.max_active_slots ?? 1}
                </strong>{' '}
                active Game Billboard slot. Replace your current billboard advertisement with{' '}
                <strong>{replacePromptCar.title}</strong>?
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={busyCarId === replacePromptCar.id}
                onClick={() => void handleAssign(replacePromptCar, true)}
                className="w-full py-2.5 rounded-xl bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                {busyCarId === replacePromptCar.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Replace Active Billboard Slot</span>
              </button>

              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-emerald-900 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                <span>CHAT WITH ADMIN ON WHATSAPP (Add More Slots)</span>
              </a>

              <button
                type="button"
                onClick={() => setReplacePromptCar(null)}
                className="w-full py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
