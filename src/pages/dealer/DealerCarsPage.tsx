import React, { useState, useEffect } from 'react';
import { DealerLayout } from '../../components/dealer/DealerLayout';
import { useDealerAuth } from '../../context/DealerAuthContext';
import { dealerVehicleService, DealerCarRecord } from '../../services/dealerVehicleService';
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

  useEffect(() => {
    let mounted = true;
    async function loadCars() {
      if (dealerAccount?.dealerId) {
        setLoading(true);
        const list = await dealerVehicleService.getDealerCars(dealerAccount.dealerId);
        if (mounted) {
          setCars(list);
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
      </div>
    </DealerLayout>
  );
};
