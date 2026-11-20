import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CarFront,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Eye,
  Globe,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
  XCircle,
} from 'lucide-react';
import {
  AdminDealerAccountRecord,
  AdminDealerApprovalAction,
  dealerService,
} from '../../services/dealerService';

interface AdminDealersViewProps {
  accounts: AdminDealerAccountRecord[];
  migrationRequired: boolean;
  loading: boolean;
  error?: string;
  onRefresh: () => Promise<void> | void;
  onOpenAddDealer: () => void;
  onNotify: (message: string) => void;
}

type FilterTab = 'all' | 'pending' | 'approved' | 'disapproved' | 'suspended';

interface PendingActionModal {
  account: AdminDealerAccountRecord;
  action: AdminDealerApprovalAction;
  title: string;
  description: string;
}

export const AdminDealersView: React.FC<AdminDealersViewProps> = ({
  accounts,
  migrationRequired,
  loading,
  error,
  onRefresh,
  onOpenAddDealer,
  onNotify,
}) => {
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [busyDealerId, setBusyDealerId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<AdminDealerAccountRecord | null>(null);
  const [actionModal, setActionModal] = useState<PendingActionModal | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  const counts = useMemo(() => {
    return {
      all: accounts.length,
      pending: accounts.filter((a) => a.approvalStatus === 'pending').length,
      approved: accounts.filter((a) => a.approvalStatus === 'approved').length,
      disapproved: accounts.filter((a) => a.approvalStatus === 'disapproved').length,
      suspended: accounts.filter((a) => a.approvalStatus === 'suspended').length,
    };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return accounts.filter((acc) => {
      if (filterTab !== 'all' && acc.approvalStatus !== filterTab) return false;
      if (!q) return true;
      return (
        acc.businessName.toLowerCase().includes(q) ||
        (acc.tradingName && acc.tradingName.toLowerCase().includes(q)) ||
        (acc.contactName && acc.contactName.toLowerCase().includes(q)) ||
        (acc.email && acc.email.toLowerCase().includes(q)) ||
        (acc.phone && acc.phone.toLowerCase().includes(q)) ||
        acc.city.toLowerCase().includes(q) ||
        acc.state.toLowerCase().includes(q) ||
        (acc.cacRegistrationNumber && acc.cacRegistrationNumber.toLowerCase().includes(q)) ||
        acc.dealerId.toLowerCase().includes(q)
      );
    });
  }, [accounts, filterTab, searchTerm]);

  const handleCopyMigrationSql = async () => {
    try {
      const res = await fetch('/api/dealers/migration-sql');
      if (!res.ok) throw new Error('Unable to load SQL file');
      const sql = await res.text();
      await navigator.clipboard.writeText(sql);
      setCopiedSql(true);
      onNotify('Copied src/db/dealer-approval-migration.sql to clipboard.');
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      onNotify('Could not copy SQL automatically. Please open src/db/dealer-approval-migration.sql.');
    }
  };

  const executeApprovalAction = async (
    account: AdminDealerAccountRecord,
    action: AdminDealerApprovalAction,
    reason?: string
  ) => {
    setBusyDealerId(account.dealerId);
    try {
      const res = await dealerService.setDealerApprovalStatus(account.dealerId, action, reason);
      if (!res.success) {
        onNotify(`Error: ${res.error || 'Unable to update dealer approval status.'}`);
        return;
      }

      const verb =
        action === 'approve'
          ? 'approved for vehicle listing'
          : action === 'disapprove'
          ? 'disapproved (dashboard login preserved, car listing blocked)'
          : action === 'suspend'
          ? 'suspended from dealer portal'
          : 'moved to pending review';

      onNotify(`Dealership "${account.businessName}" ${verb}.`);
      setActionModal(null);
      setActionReason('');
      if (selectedDetail?.dealerId === account.dealerId) {
        setSelectedDetail(null);
      }
      await onRefresh();
    } finally {
      setBusyDealerId(null);
    }
  };

  const openActionPrompt = (
    account: AdminDealerAccountRecord,
    action: AdminDealerApprovalAction
  ) => {
    setActionReason(account.approvalNotes || '');
    if (action === 'disapprove') {
      setActionModal({
        account,
        action,
        title: `Disapprove "${account.businessName}"?`,
        description:
          'This dealer will still be able to sign in and access their dashboard and business profile, but they will NOT be able to list new cars or submit vehicles for review until approved.',
      });
    } else if (action === 'suspend') {
      setActionModal({
        account,
        action,
        title: `Suspend "${account.businessName}"?`,
        description:
          'Suspending blocks both vehicle listing and dealer portal dashboard login. If you only want to block car listing, use Disapprove instead.',
      });
    } else {
      void executeApprovalAction(account, action);
    }
  };

  const renderApprovalBadge = (acc: AdminDealerAccountRecord) => {
    if (acc.approvalStatus === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
          <ShieldCheck className="w-3 h-3" />
          <span>Approved</span>
        </span>
      );
    }
    if (acc.approvalStatus === 'disapproved') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
          <XCircle className="w-3 h-3" />
          <span>Disapproved</span>
        </span>
      );
    }
    if (acc.approvalStatus === 'suspended') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300">
          <ShieldAlert className="w-3 h-3" />
          <span>Suspended</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
        <Clock className="w-3 h-3" />
        <span>Pending Approval</span>
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Migration Helper Banner (only shown if DB migration RPC is not installed yet) */}
      {migrationRequired && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <p className="font-bold">Dealer Approval Database Migration Recommended</p>
              <p className="mt-0.5 leading-relaxed">
                Run <code className="font-mono font-semibold">src/db/dealer-approval-migration.sql</code> in Supabase SQL Editor to activate full Admin dealer-account RLS/RPCs and database-level vehicle listing enforcement.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyMigrationSql}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSql ? 'SQL Copied' : 'Copy Migration SQL'}</span>
          </button>
        </div>
      )}

      {/* Header & Top Action */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 text-base">
              Dealership Accounts & Listing Approvals
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
              {accounts.length} total
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Houses all registered portal dealer accounts and partner dealerships. Approval controls vehicle listing access without blocking dashboard login.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddDealer}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#EF233C] hover:bg-[#D90429] px-3.5 py-2 rounded-xl shadow transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Partner Dealer</span>
          </button>
        </div>
      </div>

      {/* Filter Pills + Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'all', label: 'All Accounts', count: counts.all },
              { id: 'pending', label: 'Pending Approval', count: counts.pending },
              { id: 'approved', label: 'Approved', count: counts.approved },
              { id: 'disapproved', label: 'Disapproved', count: counts.disapproved },
              { id: 'suspended', label: 'Suspended', count: counts.suspended },
            ] as { id: FilterTab; label: string; count: number }[]
          ).map((tab) => {
            const active = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${
                  active
                    ? 'bg-[#071A2B] text-white shadow-sm'
                    : tab.id === 'pending' && tab.count > 0
                    ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    active ? 'bg-white/20 text-white' : 'bg-white text-gray-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search dealership, email, phone, CAC..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#EF233C]"
          />
        </div>
      </div>

      {/* Dealer Accounts List */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#EF233C] shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="px-3 py-1 rounded-lg bg-white border border-red-200 text-[#EF233C] font-bold hover:bg-red-100 transition shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && accounts.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-500 flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#EF233C]" />
            <span>Loading dealership accounts...</span>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Building2 className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-gray-800">No dealership accounts match this view</p>
            <p className="text-xs text-gray-500">
              {searchTerm ? 'Try clearing your search filter.' : 'No dealerships in this status category yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredAccounts.map((acc) => {
              const isBusy = busyDealerId === acc.dealerId;
              return (
                <div
                  key={acc.dealerId}
                  className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-gray-50/70 transition"
                >
                  {/* Left: Identity & Contact */}
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-extrabold text-sm text-[#071A2B]">
                        {acc.businessName}
                      </h4>
                      {renderApprovalBadge(acc)}
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          acc.hasPortalAccount
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                      >
                        {acc.hasPortalAccount ? 'Portal Account' : 'Directory Partner'}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          acc.canListCars
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {acc.canListCars ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Can List Cars</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3" />
                            <span>Listing Disabled · Dashboard Open</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                      {acc.contactName && (
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span>{acc.contactName}</span>
                        </span>
                      )}
                      {acc.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          <span>{acc.email}</span>
                        </span>
                      )}
                      {acc.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>{acc.phone}</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span>
                          {acc.city}, {acc.state}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CarFront className="w-3.5 h-3.5 text-gray-400" />
                        <span>
                          {acc.totalVehicles} vehicles ({acc.publishedVehicles} published)
                        </span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                      {acc.cacRegistrationNumber && (
                        <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                          CAC: {acc.cacRegistrationNumber}
                        </span>
                      )}
                      {acc.businessType && <span>{acc.businessType}</span>}
                      <span>Joined {new Date(acc.createdAt).toLocaleDateString()}</span>
                      <span className="font-mono text-gray-400">ID: {acc.dealerId.slice(0, 12)}</span>
                    </div>

                    {acc.approvalNotes && (
                      <div className="text-[11px] bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 inline-flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
                        <span>
                          <strong>Admin Note:</strong> {acc.approvalNotes}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: Approval Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {acc.approvalStatus !== 'approved' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openActionPrompt(acc, 'approve')}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Approve</span>
                      </button>
                    )}

                    {acc.approvalStatus !== 'disapproved' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openActionPrompt(acc, 'disapprove')}
                        className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-[#EF233C] border border-red-200 text-xs font-bold inline-flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Disapprove</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedDetail(acc)}
                      className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DEALER DETAIL MODAL */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#071A2B] text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base">{selectedDetail.businessName}</h3>
                  {renderApprovalBadge(selectedDetail)}
                </div>
                <p className="text-[11px] text-gray-300 mt-0.5 font-mono">
                  Dealer ID: {selectedDetail.dealerId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 text-gray-300 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">
                    Vehicle Listing Privilege
                  </span>
                  <span className="font-bold text-gray-900">
                    {selectedDetail.canListCars
                      ? 'Approved — Dealer can list vehicles & submit for review'
                      : 'Restricted — Dealer can access dashboard, cannot list cars'}
                  </span>
                </div>
                {selectedDetail.canListCars ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Lock className="w-5 h-5 text-amber-600" />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">Contact Person</span>
                  <span className="font-semibold text-gray-900">{selectedDetail.contactName || '—'}</span>
                </div>
                <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">Phone / WhatsApp</span>
                  <span className="font-semibold text-gray-900">{selectedDetail.phone || '—'}</span>
                </div>
                <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">Email Address</span>
                  <span className="font-semibold text-gray-900 break-all">{selectedDetail.email || '—'}</span>
                </div>
                <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">CAC Reg. Number</span>
                  <span className="font-semibold text-gray-900">{selectedDetail.cacRegistrationNumber || '—'}</span>
                </div>
                <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">Showroom Address</span>
                  <span className="font-semibold text-gray-900">
                    {[
                      selectedDetail.addressLine1,
                      selectedDetail.addressLine2,
                      selectedDetail.city,
                      selectedDetail.state,
                      selectedDetail.country,
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </span>
                </div>
                {selectedDetail.website && (
                  <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 sm:col-span-2">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">Website / Social</span>
                    <span className="font-semibold text-blue-700 inline-flex items-center gap-1 break-all">
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span>{selectedDetail.website}</span>
                    </span>
                  </div>
                )}
              </div>

              {selectedDetail.businessDescription && (
                <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">
                    Business Description
                  </span>
                  <p className="text-gray-700 leading-relaxed">{selectedDetail.businessDescription}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="text-lg font-extrabold text-[#071A2B]">{selectedDetail.totalVehicles}</div>
                  <div className="text-[10px] font-bold uppercase text-gray-500">Total Cars</div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="text-lg font-extrabold text-emerald-700">
                    {selectedDetail.publishedVehicles}
                  </div>
                  <div className="text-[10px] font-bold uppercase text-emerald-700">Published</div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="text-lg font-extrabold text-amber-700">
                    {selectedDetail.inReviewVehicles}
                  </div>
                  <div className="text-[10px] font-bold uppercase text-amber-700">In Review</div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
              <div>
                {selectedDetail.hasPortalAccount && (
                  selectedDetail.approvalStatus === 'suspended' ? (
                    <button
                      type="button"
                      disabled={busyDealerId === selectedDetail.dealerId}
                      onClick={() => openActionPrompt(selectedDetail, 'pending')}
                      className="px-3 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold transition"
                    >
                      Lift Suspension (Set Pending)
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyDealerId === selectedDetail.dealerId}
                      onClick={() => openActionPrompt(selectedDetail, 'suspend')}
                      className="px-3 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold transition"
                    >
                      Suspend Portal Access
                    </button>
                  )
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedDetail.approvalStatus !== 'disapproved' && (
                  <button
                    type="button"
                    disabled={busyDealerId === selectedDetail.dealerId}
                    onClick={() => openActionPrompt(selectedDetail, 'disapprove')}
                    className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-[#EF233C] border border-red-200 text-xs font-bold transition"
                  >
                    Disapprove
                  </button>
                )}
                {selectedDetail.approvalStatus !== 'approved' && (
                  <button
                    type="button"
                    disabled={busyDealerId === selectedDetail.dealerId}
                    onClick={() => openActionPrompt(selectedDetail, 'approve')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                  >
                    Approve Account
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DISAPPROVE / SUSPEND CONFIRMATION MODAL */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{actionModal.title}</h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{actionModal.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Reason / Note for Dealer (Optional)
              </label>
              <textarea
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="e.g. Please complete CAC verification or showroom address review in Business Profile."
                className="w-full p-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#EF233C]"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyDealerId === actionModal.account.dealerId}
                onClick={() =>
                  void executeApprovalAction(
                    actionModal.account,
                    actionModal.action,
                    actionReason
                  )
                }
                className="flex-1 py-2.5 bg-[#EF233C] hover:bg-[#D90429] text-white rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {busyDealerId === actionModal.account.dealerId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : null}
                <span>
                  {actionModal.action === 'suspend' ? 'Confirm Suspend' : 'Confirm Disapprove'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
