import React, { useState, useEffect } from 'react';
import { DealerLayout } from '../../components/dealer/DealerLayout';
import { useDealerAuth } from '../../context/DealerAuthContext';
import { dealerVehicleService, DealerCarRecord } from '../../services/dealerVehicleService';
import {
  billboardService,
  type DealerBillboardState,
  getDealerBillboardUpgradeWhatsAppUrl,
} from '../../services/billboardService';
import {
  CarFront,
  PlusCircle,
  Search,
  Filter,
  ExternalLink,
  Edit,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Calendar,
  Layers,
  Megaphone,
  MessageCircle,
  Loader2,
} from 'lucide-react';

interface DealerCarsPageProps {
  navigate: (route: string) => void;
}

export const DealerCarsPage: React.FC<DealerCarsPageProps> = ({ navigate }) => {
  const { dealerAccount } = useDealerAuth();
  const [cars, setCars] = useState<DealerCarRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [billboardState, setBillboardState] = useState<DealerBillboardState | null>(null);
  const [assigningCarId, setAssigningCarId] = useState<string | null>(null);
  const [replacePromptCar, setReplacePromptCar] = useState<DealerCarRecord | null>(null);
  const [billboardToast, setBillboardToast] = useState<string | null>(null);

  const loadBillboardState = async () => {
    try {
      const s = await billboardService.getMyDealerBillboardState();
      setBillboardState(s);
    } catch {}
  };

  useEffect(() => {
    let mounted = true;
    async function loadCars() {
      if (dealerAccount?.dealerId) {
        setLoading(true);
        const [list, bState] = await Promise.all([
          dealerVehicleService.getDealerCars(dealerAccount.dealerId),
          billboardService.getMyDealerBillboardState().catch(() => null),
        ]);
        if (mounted) {
          setCars(list);
          if (bState) setBillboardState(bState);
          setLoading(false);
        }
      } else {
        if (mounted) setLoading(false);
      }
    }
    loadCars();
    return () => {
      mounted = false;
    };
  }, [dealerAccount?.dealerId]);

  const activeBillboardVehicleIds = new Set(
    (billboardState?.assignments || []).filter((a) => a.status === 'active').map((a) => a.vehicle_id)
  );

  const handleAssignBillboard = async (car: DealerCarRecord, replaceExisting = false) => {
    setAssigningCarId(car.id);
    setBillboardToast(null);
    try {
      const res = await billboardService.assignVehicleToBillboard(car.id, replaceExisting);
      if (res.success) {
        setReplacePromptCar(null);
        setBillboardToast(
          `"${car.title}" is now promoted on the MANIFOLD CARS 3D Game Billboard!`
        );
        await loadBillboardState();
      } else if (res.errorCode === 'BILLBOARD_SLOT_LIMIT_REACHED' && !replaceExisting) {
        setReplacePromptCar(car);
      } else {
        setBillboardToast(res.message || 'Could not assign vehicle to Game Billboard.');
      }
    } finally {
      setAssigningCarId(null);
    }
  };

  const filteredCars = cars.filter((car) => {
    if (statusFilter !== 'ALL' && car.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = car.title.toLowerCase().includes(q);
      const matchMake = car.make.toLowerCase().includes(q);
      const matchModel = car.model.toLowerCase().includes(q);
      const matchYear = String(car.year).includes(q);
      if (!matchTitle && !matchMake && !matchModel && !matchYear) return false;
    }
    return true;
  });

  return (
    <DealerLayout currentRoute="/dealer/cars" navigate={navigate}>
      <div className="space-y-6">
        {/* HEADER & TOP CTA */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#EF233C] bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                Inventory Management
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#071A2B] tracking-tight">
              My Vehicles
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage your active showroom inventory, drafts, and vehicles in review.
            </p>
          </div>

          <button
            onClick={() => navigate('/dealer/cars/new')}
            className="px-5 py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>List a Vehicle</span>
          </button>
        </div>

        {/* GAME BILLBOARD QUOTA & WHATSAPP UPGRADE BAR */}
        <div className="bg-[#071A2B] text-white rounded-2xl p-4 sm:p-5 border border-white/10 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Game World Billboard Slot: {billboardState?.active_slots_used ?? 0} /{' '}
                  {billboardState?.max_active_slots ?? 1}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-amber-300">
                  {billboardState?.plan_name || 'Standard Plan (1 Slot)'}
                </span>
              </div>
              <p className="text-[11px] text-gray-300 mt-0.5">
                WANT TO ADVERTISE MORE VEHICLES? Chat with Admin on WhatsApp (08169664607) to unlock extra slots.
              </p>
            </div>
          </div>

          <a
            href={getDealerBillboardUpgradeWhatsAppUrl(dealerAccount?.businessName)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-slate-950 text-[11px] font-black uppercase tracking-wider inline-flex items-center justify-center gap-1.5 shrink-0 self-start md:self-center"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>CHAT WITH ADMIN ON WHATSAPP</span>
          </a>
        </div>

        {billboardToast && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{billboardToast}</span>
          </div>
        )}

        {/* SEARCH & STATUS FILTER BAR */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by make, model, year..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#EF233C]"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'PUBLISHED', label: 'Published' },
              { id: 'PENDING_REVIEW', label: 'In Review' },
              { id: 'DRAFT', label: 'Drafts' },
              { id: 'SOLD', label: 'Sold' },
              { id: 'ARCHIVED', label: 'Archived' },
            ].map((f) => {
              const active = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    active
                      ? 'bg-[#071A2B] text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* VEHICLE LIST TABLE / CARDS */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-xs text-gray-400">Loading dealership inventory...</div>
          ) : filteredCars.length === 0 ? (
            <div className="py-16 text-center space-y-3 px-4">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto text-gray-400">
                <CarFront className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">No vehicles match your criteria</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                {cars.length === 0
                  ? 'Your dealership has not listed any vehicles yet. Click below to add your first car.'
                  : 'Try adjusting your search query or status filter.'}
              </p>
              {cars.length === 0 && (
                <button
                  onClick={() => navigate('/dealer/cars/new')}
                  className="mt-2 px-5 py-2.5 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase rounded-xl inline-flex items-center gap-2 transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>List First Vehicle</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold uppercase text-gray-500 tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Vehicle</th>
                    <th className="py-3.5 px-4">Price (NGN)</th>
                    <th className="py-3.5 px-4">Year & Specs</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Added</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredCars.map((car) => {
                    const thumb = car.gallery_image_1_url || car.youtube_thumbnail_url;
                    return (
                      <tr key={car.id} className="hover:bg-gray-50/60 transition">
                        {/* Vehicle Title & Photo */}
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={car.title}
                                className="w-16 h-11 object-cover rounded-xl bg-gray-100 shrink-0 border border-gray-200"
                              />
                            ) : (
                              <div className="w-16 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                                <CarFront className="w-5 h-5" />
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-gray-900 leading-snug hover:text-[#EF233C] transition">
                                {car.title}
                              </div>
                              <span className="text-[11px] text-gray-500 font-normal">
                                {car.body_type} · {car.condition}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900">
                            ₦{car.price.toLocaleString()}
                          </div>
                          {car.previous_price && (
                            <div className="text-[10px] text-gray-400 line-through">
                              ₦{car.previous_price.toLocaleString()}
                            </div>
                          )}
                        </td>

                        {/* Year & Specs */}
                        <td className="py-3.5 px-4">
                          <div className="text-gray-800 font-semibold">{car.year}</div>
                          <div className="text-[11px] text-gray-500 font-normal">
                            {car.transmission} · {car.mileage.toLocaleString()} km
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full tracking-wider ${
                              car.status === 'PUBLISHED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : car.status === 'PENDING_REVIEW'
                                ? 'bg-amber-100 text-amber-800'
                                : car.status === 'DRAFT'
                                ? 'bg-gray-100 text-gray-700'
                                : car.status === 'SOLD'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {car.status === 'PENDING_REVIEW' ? 'In Review' : car.status}
                          </span>
                        </td>

                        {/* Added Date */}
                        <td className="py-3.5 px-4 text-gray-500 text-[11px]">
                          {new Date(car.created_at).toLocaleDateString()}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {car.status === 'PUBLISHED' && (
                              activeBillboardVehicleIds.has(car.id) ? (
                                <span className="px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>On Billboard</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={assigningCarId === car.id}
                                  onClick={() => void handleAssignBillboard(car, false)}
                                  className="px-2.5 py-1.5 bg-[#071A2B] hover:bg-[#0f2c47] text-amber-300 text-[10px] font-black uppercase tracking-wider rounded-lg transition flex items-center gap-1 disabled:opacity-50"
                                  title="Promote on Game World Billboard"
                                >
                                  {assigningCarId === car.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Megaphone className="w-3 h-3" />
                                  )}
                                  <span>ASSIGN TO GAME BILLBOARD</span>
                                </button>
                              )
                            )}

                            <button
                              onClick={() => navigate(`/dealer/cars/${car.id}/edit`)}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition flex items-center gap-1"
                              title="Edit listing"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            {car.status === 'PUBLISHED' && (
                              <button
                                onClick={() => navigate(`/cars/${car.slug}`)}
                                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
                                title="View on public marketplace"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* REPLACE EXISTING BILLBOARD SLOT CONFIRMATION */}
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
                  You already have an active Game Billboard advertisement. Replace it with{' '}
                  <strong>{replacePromptCar.title}</strong>?
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  disabled={assigningCarId === replacePromptCar.id}
                  onClick={() => void handleAssignBillboard(replacePromptCar, true)}
                  className="w-full py-2.5 rounded-xl bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-black uppercase tracking-wider"
                >
                  Confirm Replace Slot
                </button>
                <a
                  href={getDealerBillboardUpgradeWhatsAppUrl(dealerAccount?.businessName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl bg-[#25D366]/15 border border-[#25D366]/40 text-emerald-900 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                  <span>CHAT WITH ADMIN ON WHATSAPP</span>
                </a>
                <button
                  type="button"
                  onClick={() => setReplacePromptCar(null)}
                  className="w-full py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DealerLayout>
  );
};
