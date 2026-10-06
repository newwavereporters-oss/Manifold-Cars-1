import React, { useState, useEffect } from 'react';
import { DealerLayout } from '../../components/dealer/DealerLayout';
import { useDealerAuth } from '../../context/DealerAuthContext';
import { dealerVehicleService, DealerCarRecord } from '../../services/dealerVehicleService';
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
} from 'lucide-react';

interface DealerDashboardPageProps {
  navigate: (route: string) => void;
}

export const DealerDashboardPage: React.FC<DealerDashboardPageProps> = ({ navigate }) => {
  const { user, dealerAccount } = useDealerAuth();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [cars, setCars] = useState<DealerCarRecord[]>([]);
  const [loadingCars, setLoadingCars] = useState<boolean>(true);

  const businessName = dealerAccount?.businessName || 'Your Dealership';
  const status = dealerAccount?.accountStatus || 'pending';

  useEffect(() => {
    let mounted = true;
    async function loadDealerInventory() {
      if (dealerAccount?.dealerId) {
        setLoadingCars(true);
        const list = await dealerVehicleService.getDealerCars(dealerAccount.dealerId);
        if (mounted) {
          setCars(list);
          setLoadingCars(false);
        }
      } else {
        if (mounted) setLoadingCars(false);
      }
    }
    loadDealerInventory();
    return () => {
      mounted = false;
    };
  }, [dealerAccount?.dealerId]);

  // Real inventory metrics derived strictly from actual database rows
  const totalVehicles = cars.length;
  const publishedVehicles = cars.filter((c) => c.status === 'PUBLISHED').length;
  const inReviewVehicles = cars.filter((c) => c.status === 'PENDING_REVIEW').length;
  const draftVehicles = cars.filter((c) => c.status === 'DRAFT').length;

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
                    <span>List a Vehicle</span>
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
                    <span>List First Car</span>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

              {loadingCars ? (
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
                    <span>List First Vehicle</span>
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
          </div>
        )}

        {/* COMING SOON PROFESSIONAL CARDS FOR UNBUILT SECTIONS (Section 10 Requirement) */}
        {activeTab !== 'overview' && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto text-[#EF233C]">
              {activeTab === 'pricing-intel' && <TrendingUp className="w-7 h-7" />}
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
