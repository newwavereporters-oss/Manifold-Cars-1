import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Megaphone,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Save,
  Sliders,
  Trash2,
} from 'lucide-react';
import {
  billboardService,
  type AdminBillboardAssignmentRow,
  type AdminBillboardOverview,
  type AdminDealerQuotaRow,
} from '../../services/billboardService';

export const AdminBillboardView: React.FC = () => {
  const [overview, setOverview] = useState<AdminBillboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [orderDrafts, setOrderDrafts] = useState<Record<string, number>>({});
  const [quotaDrafts, setQuotaDrafts] = useState<
    Record<string, { slots: number; planCode: string; notes: string }>
  >({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await billboardService.adminGetBillboardOverview();
      setOverview(res);

      const orders: Record<string, number> = {};
      res.assignments.forEach((a) => {
        orders[a.assignment_id] = a.priority_order;
      });
      setOrderDrafts(orders);

      const quotas: Record<string, { slots: number; planCode: string; notes: string }> = {};
      res.dealer_quotas.forEach((d) => {
        quotas[d.dealer_id] = {
          slots: d.max_active_slots,
          planCode: d.max_active_slots > 1 ? 'featured_pro' : 'standard',
          notes: d.notes || '',
        };
      });
      setQuotaDrafts(quotas);
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Unable to load billboard overview.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const handleAssignmentAction = async (
    row: AdminBillboardAssignmentRow,
    status: 'active' | 'paused' | 'removed'
  ) => {
    setBusyId(row.assignment_id);
    setBanner(null);
    try {
      const orderVal = orderDrafts[row.assignment_id] ?? row.priority_order;
      await billboardService.adminManageBillboardAssignment(row.assignment_id, status, orderVal);
      setBanner({
        type: 'success',
        text: `Updated billboard placement for "${row.vehicle_title}" (${status.toUpperCase()}).`,
      });
      await loadOverview();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to update assignment.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveQuota = async (dealer: AdminDealerQuotaRow) => {
    const draft = quotaDrafts[dealer.dealer_id] || {
      slots: dealer.max_active_slots,
      planCode: dealer.max_active_slots > 1 ? 'featured_pro' : 'standard',
      notes: dealer.notes || '',
    };
    setBusyId(`quota-${dealer.dealer_id}`);
    setBanner(null);
    try {
      await billboardService.adminSetDealerBillboardSlots(
        dealer.dealer_id,
        draft.slots,
        draft.slots > 1 ? 'featured_pro' : 'standard',
        draft.notes
      );
      setBanner({
        type: 'success',
        text: `Updated "${dealer.dealer_name}" billboard limit to ${draft.slots} active slot(s).`,
      });
      await loadOverview();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to update dealer quota.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#071A2B]">
              Game World Dealer Billboard Manager
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Control active vehicle placements in MANIFOLD CARS 3D, adjust rotation order, and
              upgrade per-dealer advertising slot quotas after WhatsApp verification.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadOverview()}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {overview?.schemaNotApplied && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Game Expansion SQL Migration Pending</p>
            <p className="mt-0.5">
              Run <code className="font-mono font-bold">src/db/manifold-game-expansion-migration.sql</code> in
              Supabase SQL Editor to activate Game Billboard tables and RPCs.
            </p>
          </div>
        </div>
      )}

      {banner && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* ASSIGNMENTS TABLE */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              In-Game Billboard Vehicle Placements ({overview?.assignments.length || 0})
            </h3>
            <p className="text-xs text-gray-500">
              Lower priority numbers display earlier in the in-game carousel.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin text-[#EF233C]" />
            <span>Loading billboard placements...</span>
          </div>
        ) : !overview || overview.assignments.length === 0 ? (
          <div className="py-10 text-center text-xs text-gray-500">
            No dealer billboard assignments created yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Dealership</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Display Order</th>
                  <th className="py-3 px-4 text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {overview.assignments.map((row) => {
                  const isBusy = busyId === row.assignment_id;
                  return (
                    <tr key={row.assignment_id} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {row.image_url && (
                            <img
                              src={row.image_url}
                              alt={row.vehicle_title}
                              className="w-14 h-10 object-cover rounded-lg bg-gray-100 border border-gray-200 shrink-0"
                            />
                          )}
                          <div>
                            <div className="font-bold text-gray-900">{row.vehicle_title}</div>
                            <div className="text-[10px] text-gray-400">
                              Listing status: {row.vehicle_status}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-800">{row.dealer_name}</td>
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">
                        ₦{row.price.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            row.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.status === 'paused'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={orderDrafts[row.assignment_id] ?? row.priority_order}
                          onChange={(e) =>
                            setOrderDrafts((prev) => ({
                              ...prev,
                              [row.assignment_id]: Math.max(1, Number(e.target.value) || 1),
                            }))
                          }
                          className="w-20 h-8 px-2 rounded-lg border border-gray-200 text-xs font-mono text-gray-900"
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleAssignmentAction(row, 'active')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase flex items-center gap-1 disabled:opacity-50"
                            title="Activate & Save Order"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>Activate</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleAssignmentAction(row, 'paused')}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold uppercase flex items-center gap-1 disabled:opacity-50"
                          >
                            <PauseCircle className="w-3.5 h-3.5" />
                            <span>Pause</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleAssignmentAction(row, 'removed')}
                            className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold uppercase flex items-center gap-1 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
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

      {/* DEALER QUOTA CONTROL TABLE */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#EF233C]" />
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Dealer Billboard Slot Quotas ({overview?.dealer_quotas.length || 0})
            </h3>
            <p className="text-xs text-gray-500">
              Default quota is 1 active vehicle slot. Increase slots for verified upgrading dealers.
            </p>
          </div>
        </div>

        {!overview || overview.dealer_quotas.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-500">No dealers loaded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Dealership</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Used / Max Slots</th>
                  <th className="py-3 px-4">Set Max Slots</th>
                  <th className="py-3 px-4">Admin Notes</th>
                  <th className="py-3 px-4 text-right">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {overview.dealer_quotas.map((d) => {
                  const draft = quotaDrafts[d.dealer_id] || {
                    slots: d.max_active_slots,
                    planCode: d.max_active_slots > 1 ? 'featured_pro' : 'standard',
                    notes: d.notes || '',
                  };
                  const isBusy = busyId === `quota-${d.dealer_id}`;
                  return (
                    <tr key={d.dealer_id} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{d.dealer_name}</div>
                        <div className="text-[10px] text-gray-400">{d.dealer_city}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            d.max_active_slots > 1
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {d.plan_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">
                        {d.active_slots_used} / {d.max_active_slots}
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min={1}
                          max={25}
                          value={draft.slots}
                          onChange={(e) =>
                            setQuotaDrafts((prev) => ({
                              ...prev,
                              [d.dealer_id]: {
                                ...draft,
                                slots: Math.max(1, Math.min(25, Number(e.target.value) || 1)),
                              },
                            }))
                          }
                          className="w-20 h-8 px-2 rounded-lg border border-gray-200 text-xs font-mono text-gray-900"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={draft.notes}
                          placeholder="e.g. WhatsApp upgrade"
                          onChange={(e) =>
                            setQuotaDrafts((prev) => ({
                              ...prev,
                              [d.dealer_id]: { ...draft, notes: e.target.value },
                            }))
                          }
                          className="w-48 h-8 px-2.5 rounded-lg border border-gray-200 text-xs text-gray-800"
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleSaveQuota(d)}
                          className="px-3 py-1.5 rounded-lg bg-[#071A2B] hover:bg-[#0d2a44] text-white text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          <span>Save</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
