import React, { useState, useEffect } from 'react';
import { DealerLayout } from '../../components/dealer/DealerLayout';
import { useDealerAuth } from '../../context/DealerAuthContext';
import { dealerVehicleService, DealerCarRecord } from '../../services/dealerVehicleService';
import {
  dealerOperationsService,
  DealerDashboardOverview,
  DealerEnquiryRecord,
} from '../../services/dealerOperationsService';
import {
  commissionService,
  CommissionRule,
  CommissionCalculationResult,
} from '../../services/commissionService';
import {
  CarFront,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Newspaper,
  LineChart,
  BadgeDollarSign,
  Wallet,
  Building2,
  BookOpen,
  MessageSquare,
  Sparkles,
  Phone,
  ShieldCheck,
  ExternalLink,
  User,
  Calendar,
  Loader2,
} from 'lucide-react';

interface DealerDashboardPageProps {
  navigate: (route: string) => void;
}

export const DealerDashboardPage: React.FC<DealerDashboardPageProps> = ({ navigate }) => {
  const { user, dealerAccount } = useDealerAuth();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [cars, setCars] = useState<DealerCarRecord[]>([]);
  const [overview, setOverview] = useState<DealerDashboardOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const businessName = dealerAccount?.businessName || 'Your Dealership';

  // Dealer Pricing Intelligence State
  const [intelPrice, setIntelPrice] = useState<string>('25,000,000');
  const [intelCalc, setIntelCalc] = useState<CommissionCalculationResult | null>(null);
  const [activeCommissionRules, setActiveCommissionRules] = useState<CommissionRule[]>([]);

  useEffect(() => {
    commissionService.getActiveRules('NGN').then((rules) => {
      setActiveCommissionRules(rules);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const cleanNum = Number(intelPrice.replace(/[^0-9.]/g, '')) || 0;
    if (cleanNum > 0) {
      commissionService.calculateCommission(cleanNum).then((res) => {
        if (mounted) setIntelCalc(res);
      });
    } else {
      setIntelCalc(null);
    }
    return () => {
      mounted = false;
    };
  }, [intelPrice]);

  useEffect(() => {
    let mounted = true;
    async function loadDealerData() {
      if (dealerAccount?.dealerId) {
        setLoading(true);
        try {
          const [overviewData, carsList] = await Promise.all([
            dealerOperationsService.getDashboardOverview(dealerAccount.dealerId),
            dealerVehicleService.getDealerCars(dealerAccount.dealerId),
          ]);
          if (mounted) {
            setOverview(overviewData);
            setCars(carsList);
            setLoading(false);
          }
        } catch (err) {
          console.error('Failed to load dealer data:', err);
          if (mounted) setLoading(false);
        }
      } else {
        if (mounted) setLoading(false);
      }
    }
    loadDealerData();
    return () => {
      mounted = false;
    };
  }, [dealerAccount?.dealerId]);

  // Real inventory and enquiry metrics derived strictly from actual database rows
  const totalVehicles = overview ? overview.totalVehicles : cars.length;
  const publishedVehicles = overview
    ? overview.publishedVehicles
    : cars.filter((c) => c.status === 'PUBLISHED').length;
  const inReviewVehicles = overview
    ? overview.inReviewVehicles
    : cars.filter((c) => c.status === 'PENDING_REVIEW').length;
  const draftVehicles = overview
    ? overview.draftVehicles
    : cars.filter((c) => c.status === 'DRAFT').length;
  const newEnquiriesCount = overview ? overview.newEnquiriesCount : 0;
  const recentEnquiries = overview?.recentEnquiries || [];

  return (
    <DealerLayout
      currentRoute="/dealer/dashboard"
      navigate={navigate}
      activeNavTab={activeTab}
      onSelectNavTab={(tab) => setActiveTab(tab)}
    >
      <div className="space-y-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* WELCOME / BANNER */}
            <div className="bg-[#071A2B] text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden border border-white/10 shadow-xl">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-600/10 via-transparent to-transparent pointer-events-none" />

              <div className="max-w-2xl relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#EF233C] bg-red-950/80 border border-red-500/20 px-2.5 py-0.5 rounded-full">
                    Dealership Portal
                  </span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active Dealership</span>
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                  Welcome to {businessName}
                </h1>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6">
                  Manage your vehicle catalog, track inventory performance, and connect with serious automotive buyers on the MANIFOLD network.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => navigate('/dealer/cars/new')}
                    className="px-5 py-2.5 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center gap-2 shadow-lg shadow-red-900/30"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{totalVehicles === 0 ? 'List Your First Car' : 'List a Vehicle'}</span>
                  </button>

                  <button
                    onClick={() => navigate('/dealer/cars')}
                    className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center gap-2 border border-white/10"
                  >
                    <CarFront className="w-4 h-4" />
                    <span>View My Inventory ({totalVehicles})</span>
                  </button>

                  <button
                    onClick={() => navigate('/dealer/offer')}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-medium rounded-xl transition flex items-center gap-1.5 border border-white/10"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#EF233C]" />
                    <span>Explore Dealer Offer</span>
                  </button>
                </div>
              </div>
            </div>

            {/* DEALER WELCOME & QUICK START BANNER IF INVENTORY IS EMPTY */}
            {totalVehicles === 0 && (
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-blue-950/80 to-[#0B2239] border border-blue-500/20 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-lg">
                <div className="space-y-2 max-w-xl">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Dealership Ready</span>
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Start Building Your MANIFOLD Showroom
                  </h3>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Present your vehicles through structured YouTube walkaround videos, 
                    detailed technical specifications, and transparent market pricing to reach serious automotive buyers.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
                  <button
                    onClick={() => navigate('/dealer/cars/new')}
                    className="w-full sm:w-auto px-5 py-2.5 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>List Your First Car</span>
                  </button>
                  <button
                    onClick={() => navigate('/dealer/offer')}
                    className="w-full sm:w-auto px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 border border-white/10"
                  >
                    <span>View Dealer Offer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* REAL STATS COUNTERS (NO FAKE DATA) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Listed</span>
                  <CarFront className="w-4 h-4 text-gray-500" />
                </div>
                <div className="text-2xl font-extrabold text-[#071A2B]">{totalVehicles}</div>
                <p className="text-[11px] text-gray-500 mt-1">Vehicles in your catalog</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between text-emerald-600 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Published</span>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-2xl font-extrabold text-[#071A2B]">{publishedVehicles}</div>
                <p className="text-[11px] text-gray-500 mt-1">Live on MANIFOLD</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between text-amber-600 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">In Review</span>
                  <Clock className="w-4 h-4" />
                </div>
                <div className="text-2xl font-extrabold text-[#071A2B]">{inReviewVehicles}</div>
                <p className="text-[11px] text-gray-500 mt-1">Awaiting inspection check</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Drafts</span>
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div className="text-2xl font-extrabold text-[#071A2B]">{draftVehicles}</div>
                <p className="text-[11px] text-gray-500 mt-1">Unsubmitted listings</p>
              </div>

              <div
                onClick={() => navigate('/dealer/enquiries')}
                className="bg-white p-5 rounded-2xl border border-red-100 hover:border-red-300 shadow-sm cursor-pointer transition group"
              >
                <div className="flex items-center justify-between text-[#EF233C] mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">New Enquiries</span>
                  <MessageSquare className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl font-extrabold text-[#EF233C]">{newEnquiriesCount}</div>
                <p className="text-[11px] text-gray-500 mt-1 group-hover:text-gray-700 transition">
                  Prospective buyers waiting
                </p>
              </div>
            </div>

            {/* RECENT VEHICLES PREVIEW */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Your Recent Vehicles</h3>
                  <p className="text-xs text-gray-500">Latest listings added to your dealership</p>
                </div>
                <button
                  onClick={() => navigate('/dealer/cars')}
                  className="text-xs font-bold text-[#EF233C] hover:text-[#D90429] flex items-center gap-1"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-gray-400">Loading catalog...</div>
              ) : cars.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
                    <CarFront className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-800">No vehicles listed yet</h4>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Start by listing your first vehicle with YouTube walkaround video and high-resolution images.
                  </p>
                  <button
                    onClick={() => navigate('/dealer/cars/new')}
                    className="mt-2 px-4 py-2 bg-[#071A2B] hover:bg-[#0B2239] text-white text-xs font-bold uppercase rounded-xl inline-flex items-center gap-1.5 transition"
                  >
                    <PlusCircle className="w-4 h-4 text-[#EF233C]" />
                    <span>List Your First Car</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {cars.slice(0, 3).map((car) => (
                    <div
                      key={car.id}
                      className="py-3 flex items-center justify-between gap-4 hover:bg-gray-50/50 rounded-xl px-2 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {car.gallery_image_1_url || car.youtube_thumbnail_url ? (
                          <img
                            src={car.gallery_image_1_url || car.youtube_thumbnail_url}
                            alt={car.title}
                            className="w-14 h-10 object-cover rounded-lg bg-gray-100 shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                            <CarFront className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-gray-900 truncate">{car.title}</h5>
                          <p className="text-[11px] text-gray-500">
                            ₦{car.price.toLocaleString()} · {car.condition}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider ${
                            car.status === 'PUBLISHED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : car.status === 'PENDING_REVIEW'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {car.status.replace('_', ' ')}
                        </span>

                        <button
                          onClick={() => navigate(`/dealer/cars/${car.id}/edit`)}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RECENT BUYER ENQUIRIES (SECTION 5 REQUIREMENT) */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-[#EF233C]">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-sm">Recent Buyer Enquiries</h3>
                      {newEnquiriesCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-[#EF233C] text-[10px] font-bold">
                          {newEnquiriesCount} New
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">Latest interest and requests from prospective buyers</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/dealer/enquiries')}
                  className="text-xs font-bold text-[#EF233C] hover:text-[#D90429] flex items-center gap-1"
                >
                  <span>View All Enquiries</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#EF233C]" />
                  <span>Loading buyer enquiries...</span>
                </div>
              ) : recentEnquiries.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-800">No buyer enquiries yet</h4>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    When prospective buyers send messages or request physical inspections for your cars, they will appear here in real time.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentEnquiries.slice(0, 5).map((inq) => (
                    <div
                      key={inq.id}
                      onClick={() => navigate('/dealer/enquiries')}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/70 rounded-xl px-2.5 transition cursor-pointer"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 shrink-0 font-bold text-xs">
                          {inq.customer_name ? inq.customer_name.substring(0, 2).toUpperCase() : 'BY'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="text-xs font-bold text-gray-900">{inq.customer_name}</h5>
                            <span className="text-[11px] text-gray-400 font-medium">·</span>
                            <span className="text-[11px] text-gray-500">{inq.customer_phone}</span>
                          </div>
                          <p className="text-xs text-gray-700 truncate mt-0.5">
                            <span className="font-semibold text-gray-900">{inq.car_title}:</span> {inq.message}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider ${
                            inq.status === 'new'
                              ? 'bg-red-100 text-[#EF233C]'
                              : inq.status === 'contacted'
                              ? 'bg-blue-100 text-blue-800'
                              : inq.status === 'qualified' || inq.status === 'viewing_scheduled'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {inq.status.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {new Date(inq.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: DEALER PRICING INTELLIGENCE (PHASE 4 REQUIREMENT) */}
        {activeTab === 'pricing-intel' && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-[#071A2B] text-white rounded-3xl p-6 sm:p-8 border border-white/10 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-600/10 via-transparent to-transparent pointer-events-none" />
              <div className="relative z-10 max-w-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#EF233C] bg-red-950/80 border border-red-500/20 px-2.5 py-0.5 rounded-full">
                    Dealer Intelligence Suite
                  </span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs font-semibold text-emerald-400">
                    Live Active Rules (public.commission_rules)
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-display">
                  Pricing Intelligence & Commission Calculator
                </h1>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                  Model vehicle asking prices against MANIFOLD's active commission rules. Understand exact platform fees and determine your net dealership payout before listing vehicles.
                </p>
              </div>
            </div>

            {/* Interactive Calculator Card */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Vehicle Asking Price Simulator
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Enter any asking price (in NGN) or click a quick benchmark preset below.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/dealer/cars/new')}
                  className="px-4 py-2 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 shadow-md shadow-red-900/20 self-start sm:self-auto"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>List Vehicle Now</span>
                </button>
              </div>

              {/* Price Input & Presets */}
              <div className="space-y-4">
                <div className="max-w-md">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Simulate Vehicle Asking Price (NGN)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-sm font-bold text-gray-500">
                      ₦
                    </span>
                    <input
                      type="text"
                      value={intelPrice}
                      onChange={(e) => setIntelPrice(e.target.value)}
                      placeholder="25,000,000"
                      className="w-full h-12 pl-10 pr-4 text-base font-extrabold text-gray-900 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:border-[#EF233C]"
                    />
                  </div>
                </div>

                {/* Benchmark Presets */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-2">
                    Quick Benchmark Presets:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '₦8.5M (Tier 1 Tokunbo)', val: '8,500,000' },
                      { label: '₦15M (Tier 2 Mid SUV)', val: '15,000,000' },
                      { label: '₦28M (Tier 3 Luxury Sedan)', val: '28,000,000' },
                      { label: '₦45M (Tier 4 Premium SUV)', val: '45,000,000' },
                      { label: '₦85M (Tier 5 Exotic/Supercar)', val: '85,000,000' },
                    ].map((p) => (
                      <button
                        key={p.val}
                        onClick={() => setIntelPrice(p.val)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                          intelPrice.replace(/[^0-9]/g, '') === p.val.replace(/[^0-9]/g, '')
                            ? 'bg-red-50 text-[#EF233C] border-red-200'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Calculator Results Grid */}
              {intelCalc && (
                <div className="pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Tier Card */}
                    <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                        Applicable Tier Bracket
                      </span>
                      <div className="text-lg font-bold text-gray-900 font-display">
                        {intelCalc.ruleName || 'Custom Tier'}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Calculated by active platform rules
                      </p>
                    </div>

                    {/* Rate Card */}
                    <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                        Commission Take Rate
                      </span>
                      <div className="text-2xl font-extrabold text-[#EF233C] font-display">
                        {intelCalc.commissionPercentage}%
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Success-based upon verified sale
                      </p>
                    </div>

                    {/* Estimated Commission */}
                    <div className="p-5 rounded-2xl bg-red-50/50 border border-red-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 block mb-1">
                        Estimated MANIFOLD Fee
                      </span>
                      <div className="text-2xl font-extrabold text-gray-900 font-display">
                        ₦{intelCalc.estimatedCommission.toLocaleString()}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Includes inspection & concierge
                      </p>
                    </div>

                    {/* Dealership Payout */}
                    <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">
                        Guaranteed Dealership Net
                      </span>
                      <div className="text-2xl font-extrabold text-emerald-700 font-display">
                        ₦{intelCalc.estimatedDealerProceeds.toLocaleString()}
                      </div>
                      <p className="text-[11px] text-emerald-600 mt-1">
                        {(
                          100 - intelCalc.commissionPercentage
                        ).toFixed(1)}% of total retail price
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Commission Rules Reference Table */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <BadgeDollarSign className="w-5 h-5 text-[#EF233C]" />
                  <h3 className="text-base font-bold text-gray-900">
                    Official MANIFOLD Commission Fee Schedule
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Platform tiers are transparent and volume-weighted. Higher value inventory incurs lower percentage rates.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="py-3.5 px-6">Tier Name</th>
                      <th className="py-3.5 px-6">Price Bracket (NGN)</th>
                      <th className="py-3.5 px-6">Brokerage Commission</th>
                      <th className="py-3.5 px-6">Fixed Fee</th>
                      <th className="py-3.5 px-6">Dealership Retains</th>
                      <th className="py-3.5 px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeCommissionRules.map((rule) => {
                      const isCurrentMatch =
                        intelCalc && intelCalc.ruleId === rule.id;
                      return (
                        <tr
                          key={rule.id}
                          className={`transition ${
                            isCurrentMatch
                              ? 'bg-red-50/60 font-semibold'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="py-4 px-6 font-bold text-gray-900">
                            {rule.name}
                            {isCurrentMatch && (
                              <span className="ml-2 text-[10px] bg-[#EF233C] text-white px-2 py-0.5 rounded-full font-bold uppercase">
                                Selected
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            ₦{rule.min_price.toLocaleString()} –{' '}
                            {rule.max_price
                              ? `₦${rule.max_price.toLocaleString()}`
                              : 'Above'}
                          </td>
                          <td className="py-4 px-6 font-extrabold text-[#EF233C]">
                            {rule.commission_percentage}%
                          </td>
                          <td className="py-4 px-6 text-gray-500">
                            {rule.fixed_fee > 0
                              ? `₦${rule.fixed_fee.toLocaleString()}`
                              : '₦0'}
                          </td>
                          <td className="py-4 px-6 text-emerald-700 font-bold">
                            {(100 - rule.commission_percentage).toFixed(2)}%
                          </td>
                          <td className="py-4 px-6">
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Strategic Pricing Insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-gray-900">
                  Sliding Scale Incentive
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Vehicles priced above ₦50M automatically drop to 0.8% commission, rewarding dealers who bring flagship luxury models to MANIFOLD.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-gray-900">
                  Zero Upfront Listing Fees
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Listing your vehicle catalog on MANIFOLD is 100% free. No monthly subscription or upfront listing deposit is ever required.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-[#EF233C] flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-gray-900">
                  High-Trust Video Conversion
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Listings with YouTube video walkarounds attract serious buyers ready to close, reducing negotiation friction and speeding up turnaround.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* COMING SOON PROFESSIONAL CARDS FOR OTHER UNBUILT SECTIONS */}
        {activeTab !== 'overview' && activeTab !== 'pricing-intel' && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto text-[#EF233C]">
              {activeTab === 'market-intel' && <BarChart3 className="w-7 h-7" />}
              {activeTab === 'news' && <Newspaper className="w-7 h-7" />}
              {activeTab === 'performance' && <LineChart className="w-7 h-7" />}
              {activeTab === 'sales' && <BadgeDollarSign className="w-7 h-7" />}
              {activeTab === 'earnings' && <Wallet className="w-7 h-7" />}
              {activeTab === 'enquiries' && <MessageSquare className="w-7 h-7" />}
              {activeTab === 'profile' && <Building2 className="w-7 h-7" />}
              {activeTab === 'guide' && <BookOpen className="w-7 h-7" />}
            </div>

            <div className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#EF233C] bg-red-50 border border-red-200 px-3 py-1 rounded-full">
              Phase 3 Intelligence · Coming Soon
            </div>

            <h3 className="text-xl font-bold text-gray-900 capitalize">
              {activeTab.replace('-', ' ')}
            </h3>

            <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
              This module is currently being finalized for the MANIFOLD dealer intelligence suite. It will unlock algorithmic market valuation, lead attribution, and turnover analytics for your dealership.
            </p>

            <div className="pt-2">
              <button
                onClick={() => setActiveTab('overview')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition"
              >
                Back to Dealership Overview
              </button>
            </div>
          </div>
        )}
      </div>
    </DealerLayout>
  );
};
