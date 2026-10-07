import React, { useState, useEffect } from 'react';
import { DealerLayout } from '../../components/dealer/DealerLayout';
import { useDealerAuth } from '../../context/DealerAuthContext';
import {
  dealerOperationsService,
  DealerEnquiryRecord,
} from '../../services/dealerOperationsService';
import {
  MessageSquare,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  User,
  Phone,
  Mail,
  Calendar,
  CarFront,
  ArrowRight,
  X,
  ExternalLink,
  ShieldCheck,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface DealerEnquiriesPageProps {
  navigate: (route: string) => void;
}

export const DealerEnquiriesPage: React.FC<DealerEnquiriesPageProps> = ({ navigate }) => {
  const { dealerAccount } = useDealerAuth();
  const [enquiries, setEnquiries] = useState<DealerEnquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEnquiry, setSelectedEnquiry] = useState<DealerEnquiryRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  const dealerId = dealerAccount?.dealerId;

  const loadEnquiries = async () => {
    if (!dealerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await dealerOperationsService.getDealerEnquiries(dealerId, statusFilter);
    setEnquiries(data);
    setLoading(false);
  };

  useEffect(() => {
    loadEnquiries();
  }, [dealerId, statusFilter]);

  const handleUpdateStatus = async (
    enquiryId: string,
    newStatus: DealerEnquiryRecord['status']
  ) => {
    if (!dealerId) return;
    setActionLoading(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    const res = await dealerOperationsService.updateEnquiryStatus(enquiryId, newStatus, dealerId);
    setActionLoading(false);

    if (res.success) {
      setActionSuccessMsg(`Status updated to ${newStatus.replace('_', ' ')}.`);
      // Update local state
      setEnquiries((prev) =>
        prev.map((e) => (e.id === enquiryId ? { ...e, status: newStatus } : e))
      );
      if (selectedEnquiry && selectedEnquiry.id === enquiryId) {
        setSelectedEnquiry({ ...selectedEnquiry, status: newStatus });
      }
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } else {
      setActionErrorMsg(res.error || 'Failed to update enquiry status.');
      setTimeout(() => setActionErrorMsg(null), 4000);
    }
  };

  const filteredEnquiries = enquiries.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.customer_name.toLowerCase().includes(q);
      const matchCar = item.car_title.toLowerCase().includes(q);
      const matchPhone = item.customer_phone.toLowerCase().includes(q);
      const matchMsg = item.message.toLowerCase().includes(q);
      return matchName || matchCar || matchPhone || matchMsg;
    }
    return true;
  });

  const getStatusBadge = (status: DealerEnquiryRecord['status']) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-red-100 text-[#EF233C] border border-red-200 tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF233C] animate-ping" />
            <span>New</span>
          </span>
        );
      case 'contacted':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 tracking-wider">
            <span>Contacted</span>
          </span>
        );
      case 'qualified':
      case 'viewing_scheduled':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 tracking-wider">
            <span>Qualified</span>
          </span>
        );
      case 'closed':
      case 'won':
      case 'lost':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200 tracking-wider">
            <span>Closed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 tracking-wider">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <DealerLayout currentRoute="/dealer/enquiries" navigate={navigate}>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#EF233C] bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                Buyer Relations
              </span>
            </div>
            {/* Section 9 Title & Supporting Text */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#071A2B] tracking-tight font-display">
              Buyer Enquiries
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Manage buyer interest in your MANIFOLD inventory.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dealer/cars')}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center gap-1.5"
            >
              <CarFront className="w-4 h-4 text-gray-500" />
              <span>View My Cars</span>
            </button>
          </div>
        </div>

        {/* CONTROLS BAR: SEARCH & STATUS FILTERS */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by buyer name, car, phone..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#EF233C] focus:bg-white transition"
            />
          </div>

          {/* Section 9 Filters: All, New, Contacted, Qualified, Closed */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'new', label: 'New' },
              { id: 'contacted', label: 'Contacted' },
              { id: 'viewing', label: 'Qualified' },
              { id: 'closed', label: 'Closed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  statusFilter === tab.id
                    ? 'bg-[#071A2B] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* FEEDBACK BANNERS */}
        {actionSuccessMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}
        {actionErrorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-[#EF233C] shrink-0" />
            <span>{actionErrorMsg}</span>
          </div>
        )}

        {/* ENQUIRIES LIST */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#EF233C]" />
              <span>Loading buyer enquiries from database...</span>
            </div>
          ) : filteredEnquiries.length === 0 ? (
            <div className="py-16 text-center space-y-3 px-4">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">No buyer enquiries found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'No enquiries match your current filter criteria.'
                  : 'Once serious buyers watch your walkaround videos and submit interest, their enquiries will appear here in real time.'}
              </p>
              <button
                onClick={() => navigate('/dealer/cars/new')}
                className="mt-2 px-4 py-2 bg-[#071A2B] hover:bg-[#0B2239] text-white text-xs font-bold uppercase rounded-xl transition inline-flex items-center gap-1.5"
              >
                <span>List a Vehicle</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredEnquiries.map((inq) => (
                <div
                  key={inq.id}
                  onClick={() => setSelectedEnquiry(inq)}
                  className="p-5 sm:p-6 hover:bg-gray-50/70 transition cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 group"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(inq.status)}
                      <span className="text-xs font-bold text-gray-900">
                        {inq.customer_name}
                      </span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs font-semibold text-[#EF233C]">
                        {inq.car_title}
                      </span>
                      <span className="text-gray-300">·</span>
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(inq.created_at).toLocaleDateString('en-NG', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                      "{inq.message}"
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-gray-400" />
                        {inq.customer_phone}
                      </span>
                      {inq.customer_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-gray-400" />
                          {inq.customer_email}
                        </span>
                      )}
                      <span className="text-gray-400">via {inq.source}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEnquiry(inq);
                      }}
                      className="px-3.5 py-1.5 bg-gray-100 group-hover:bg-[#071A2B] group-hover:text-white text-gray-700 text-xs font-bold rounded-xl transition flex items-center gap-1"
                    >
                      <span>View Detail</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 10: ENQUIRY DETAIL MODAL / DRAWER */}
        {selectedEnquiry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative text-gray-900 space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(selectedEnquiry.status)}
                    <span className="text-[11px] font-semibold text-gray-400">
                      Enquiry ID: {selectedEnquiry.id.slice(0, 8)}...
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-[#071A2B]">
                    Buyer Enquiry Details
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedEnquiry(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Vehicle Section */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Target Vehicle
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CarFront className="w-5 h-5 text-[#EF233C]" />
                    <span className="text-sm font-bold text-[#071A2B]">
                      {selectedEnquiry.car_title}
                    </span>
                  </div>
                  {selectedEnquiry.car_price && (
                    <span className="text-xs font-extrabold text-[#071A2B]">
                      ₦{selectedEnquiry.car_price.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Buyer Contact Information */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Buyer Information
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Buyer Name</span>
                    <p className="font-bold text-gray-900">{selectedEnquiry.customer_name}</p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Phone / WhatsApp</span>
                    <p className="font-bold text-gray-900">{selectedEnquiry.customer_phone}</p>
                  </div>

                  {selectedEnquiry.customer_email && (
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1 sm:col-span-2">
                      <span className="text-[10px] text-gray-400 uppercase font-bold">Email Address</span>
                      <p className="font-bold text-gray-900">{selectedEnquiry.customer_email}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Buyer Message
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-800 leading-relaxed italic">
                  "{selectedEnquiry.message}"
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                <span>Received: {new Date(selectedEnquiry.created_at).toLocaleString()}</span>
                <span>Channel: {selectedEnquiry.source}</span>
              </div>

              {/* Permitted Workflow Actions */}
              <div className="pt-2 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Update Enquiry Status
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    disabled={actionLoading || selectedEnquiry.status === 'contacted'}
                    onClick={() => handleUpdateStatus(selectedEnquiry.id, 'contacted')}
                    className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-xl transition border border-blue-200 disabled:opacity-50"
                  >
                    Mark as Contacted
                  </button>

                  <button
                    disabled={actionLoading || selectedEnquiry.status === 'qualified'}
                    onClick={() => handleUpdateStatus(selectedEnquiry.id, 'qualified')}
                    className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl transition border border-emerald-200 disabled:opacity-50"
                  >
                    Mark as Qualified
                  </button>

                  <button
                    disabled={actionLoading || selectedEnquiry.status === 'closed'}
                    onClick={() => handleUpdateStatus(selectedEnquiry.id, 'closed')}
                    className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition border border-gray-200 disabled:opacity-50"
                  >
                    Mark as Closed
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DealerLayout>
  );
};
