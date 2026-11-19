import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldX,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { AdminDealerAccountRecord, dealerService } from '../../services/dealerService';

interface AdminDealerManagementProps {
  onNotify?: (type: 'success' | 'error', text: string) => void;
  onStatusChanged?: () => void | Promise<void>;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'disapproved';

export const AdminDealerManagement: React.FC<AdminDealerManagementProps> = ({
  onNotify,
  onStatusChanged,
}) => {
  const [dealers, setDealers] = useState<AdminDealerAccountRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [migrationRequired, setMigrationRequired] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [busyDealerId, setBusyDealerId] = useState<string | null>(null);

  const loadDealers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await dealerService.getAllDealerAccountsForAdmin();
      setDealers(res.accounts || []);
      setMigrationRequired(Boolean(res.migrationRequired));
      if (res.error) {
        setFetchError(res.error);
      }
    } catch (err: any) {
      setFetchError(err?.message || 'Failed to load registered dealers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDealers();
  }, [loadDealers]);

  const counts = useMemo(() => {
    const approved = dealers.filter(
      (d) => d.dealerStatus === 'approved' && d.canListCars
    ).length;
    const pending = dealers.filter((d) => d.dealerStatus === 'pending').length;
    const disapproved = dealers.filter(
      (d) => d.dealerStatus === 'disapproved' || d.approvalStatus === 'suspended'
    ).length;
    return { total: dealers.length, approved, pending, disapproved };
  }, [dealers]);

  const filteredDealers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dealers.filter((d) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'approved' && !(d.dealerStatus === 'approved' && d.canListCars)) {
          return false;
        }
        if (statusFilter === 'pending' && d.dealerStatus !== 'pending') {
          return false;
        }
        if (
          statusFilter === 'disapproved' &&
          d.dealerStatus !== 'disapproved' &&
          d.approvalStatus !== 'suspended'
        ) {
          return false;
        }
      }

      if (!q) return true;
      return (
        d.businessName.toLowerCase().includes(q) ||
        (d.contactName || '').toLowerCase().includes(q) ||
        (d.email || '').toLowerCase().includes(q) ||
        (d.phone || '').toLowerCase().includes(q) ||
        d.city.toLowerCase().includes(q) ||
        d.state.toLowerCase().includes(q)
      );
    });
  }, [dealers, searchQuery, statusFilter]);

  const handleToggleVerification = async (dealer: AdminDealerAccountRecord) => {
    if (busyDealerId) return;
    const isCurrentlyApproved = dealer.dealerStatus === 'approved' && dealer.canListCars;
    setBusyDealerId(dealer.dealerId);

    try {
      const res = await dealerService.toggleDealerVerification(
        dealer.dealerId,
        isCurrentlyApproved,
        isCurrentlyApproved
          ? 'Verification revoked from Admin Dealer Management table.'
          : 'Verified and approved for vehicle listing in Admin Dealer Management.'
      );

      if (!res.success) {
        onNotify?.('error', res.error || 'Unable to update dealer verification status.');
        return;
      }

      onNotify?.(
        'success',
        isCurrentlyApproved
          ? `${dealer.businessName} marked as disapproved (dashboard remains accessible, listing locked).`
          : `${dealer.businessName} approved — vehicle listing enabled.`
      );

      await loadDealers();
      await onStatusChanged?.();
    } catch (err: any) {
      onNotify?.('error', err?.message || 'Error updating dealer verification status.');
    } finally {
      setBusyDealerId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Summary */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#EF233C]" />
            <h2 className="text-base sm:text-lg font-extrabold text-[#071A2B]">
              Dealer Management &amp; Verification
            </h2>
          </div>
          <p className="text-xs text-gray-500">
            Toggle account verification (<code className="text-[#071A2B] font-semibold">dealer_status</code>). All dealers can access their dashboard; only <strong>approved</strong> dealers may post vehicle listings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-gray-100 text-xs font-bold text-gray-700">
            Total: {counts.total}
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
            Approved: {counts.approved}
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
            Pending: {counts.pending}
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-[#EF233C]">
            Disapproved: {counts.disapproved}
          </div>
          <button
            type="button"
            onClick={() => void loadDealers()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {migrationRequired && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Database Migration Recommended</p>
            <p className="mt-0.5 text-amber-800">
              Run <code className="font-mono font-semibold">src/db/dealer-approval-migration.sql</code> in Supabase SQL Editor to ensure the <code className="font-mono font-semibold">dealer_status</code> column and approval RPCs are active.
            </p>
          </div>
        </div>
      )}

      {fetchError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
          {fetchError}
        </div>
      )}

      {/* Search + Filter Controls */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dealership, contact, email, phone, city..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-[#071A2B]"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: 'all', label: 'All Dealers' },
              { id: 'pending', label: 'Pending' },
              { id: 'approved', label: 'Approved' },
              { id: 'disapproved', label: 'Disapproved' },
            ] as { id: StatusFilter; label: string }[]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-[#071A2B] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                <th className="py-3.5 px-4">Dealership</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Location</th>
                <th className="py-3.5 px-4 text-center">Inventory</th>
                <th className="py-3.5 px-4">Dealer Status</th>
                <th className="py-3.5 px-4">Listing Access</th>
                <th className="py-3.5 px-4 text-right">Verification Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {loading && dealers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <div className="inline-flex items-center gap-2 font-semibold">
                      <Loader2 className="w-4 h-4 animate-spin text-[#EF233C]" />
                      <span>Fetching registered dealers...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDealers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    No dealers match the current filter.
                  </td>
                </tr>
              ) : (
                filteredDealers.map((dealer) => {
                  const isApproved = dealer.dealerStatus === 'approved' && dealer.canListCars;
                  const isDisapproved =
                    dealer.dealerStatus === 'disapproved' ||
                    dealer.approvalStatus === 'disapproved' ||
                    dealer.approvalStatus === 'suspended';
                  const isBusy = busyDealerId === dealer.dealerId;

                  return (
                    <tr key={dealer.dealerId} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#071A2B]/5 text-[#071A2B] flex items-center justify-center shrink-0 mt-0.5">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{dealer.businessName}</p>
                            <p className="text-[11px] text-gray-500">
                              {dealer.contactName || 'Primary Contact'} •{' '}
                              <span className="font-medium">
                                {dealer.hasPortalAccount ? 'Portal Account' : 'Directory Entry'}
                              </span>
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top text-gray-600">
                        <p className="font-medium text-gray-800">{dealer.email || '—'}</p>
                        <p className="text-[11px] text-gray-500">{dealer.phone || '—'}</p>
                      </td>

                      <td className="py-3.5 px-4 align-top text-gray-700">
                        <span className="font-medium">
                          {dealer.city}, {dealer.state}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 align-top text-center">
                        <span className="font-bold text-gray-900">{dealer.totalVehicles}</span>
                        <span className="block text-[10px] text-gray-500">
                          {dealer.publishedVehicles} live / {dealer.inReviewVehicles} review
                        </span>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[11px] uppercase">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>approved</span>
                          </span>
                        ) : isDisapproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-[#EF233C] font-bold text-[11px] uppercase">
                            <XCircle className="w-3 h-3" />
                            <span>disapproved</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold text-[11px] uppercase">
                            <Clock className="w-3 h-3" />
                            <span>pending</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <span
                          className={`text-[11px] font-bold ${
                            isApproved ? 'text-emerald-700' : 'text-gray-500'
                          }`}
                        >
                          {isApproved ? 'Can List Cars' : 'Dashboard Only'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 align-top text-right">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleToggleVerification(dealer)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition cursor-pointer disabled:opacity-50 ${
                            isApproved
                              ? 'bg-red-50 hover:bg-red-100 text-[#EF233C] border border-red-200'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                          }`}
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isApproved ? (
                            <ShieldX className="w-3.5 h-3.5" />
                          ) : (
                            <ShieldCheck className="w-3.5 h-3.5" />
                          )}
                          <span>{isApproved ? 'Disapprove' : 'Approve'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
