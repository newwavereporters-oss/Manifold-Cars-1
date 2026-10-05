import React, { useState, useEffect } from 'react';
import {
  Car as CarIcon,
  ShieldCheck,
  Compass,
  Video,
  LogOut,
  ExternalLink,
  Plus,
  CheckCircle2,
  AlertCircle,
  Eye,
  TrendingUp,
  FileCheck,
  Users,
  Search,
  DollarSign,
  ChevronRight,
  Filter,
  Copy,
  Archive,
  Trash2,
  Edit,
  Image as ImageIcon,
  Play,
  X,
  Star,
  Database,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { FORMAT_CURRENCY, FORMAT_NUMBER } from '../../data/mockCars';
import { Car } from '../../types';
import { carService } from '../../services/carService';
import { mediaService, MediaVideoItem } from '../../services/mediaService';
import { isSupabaseConfigured } from '../../lib/supabase';
import { CarForm } from '../../components/admin/CarForm';
import { MediaVideoModal } from '../../components/admin/MediaVideoModal';
import { SupabaseSettingsModal } from '../../components/admin/SupabaseSettingsModal';

interface AdminDashboardPageProps {
  navigate: (route: string) => void;
  defaultTab?: 'inventory' | 'concierge' | 'media';
}

interface ConciergeLead {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  carRequested: string;
  budget: string;
  date: string;
  status: 'NEW' | 'CONTACTED' | 'INSPECTION_SET' | 'COMPLETED';
}

const INITIAL_LEADS: ConciergeLead[] = [
  {
    id: 'lead-1',
    fullName: 'Chinedu Okonkwo',
    phone: '+234 803 234 8812',
    email: 'c.okonkwo@lagosexec.ng',
    carRequested: '2021 Toyota Highlander XLE AWD',
    budget: '₦24,500,000',
    date: 'Today, 11:20 AM',
    status: 'NEW',
  },
  {
    id: 'lead-2',
    fullName: 'Dr. Fatima Aliyu',
    phone: '+234 812 994 1002',
    email: 'dr.aliyu@medabuja.org',
    carRequested: '2020 Lexus RX 350 Luxury AWD',
    budget: '₦32,000,000',
    date: 'Today, 09:45 AM',
    status: 'CONTACTED',
  },
  {
    id: 'lead-3',
    fullName: 'Tunde Babatunde',
    phone: '+234 802 443 9081',
    email: 'tunde.b@investlagos.com',
    carRequested: '2019 Mercedes-Benz GLE 43 AMG Coupe',
    budget: '₦46,000,000',
    date: 'Yesterday, 04:15 PM',
    status: 'INSPECTION_SET',
  },
  {
    id: 'lead-4',
    fullName: 'Grace Eke',
    phone: '+234 901 321 0044',
    email: 'grace.eke@vi-ventures.ng',
    carRequested: 'Custom Car Hunt: 2022 Land Cruiser 300 VXR',
    budget: '₦125,000,000',
    date: 'Yesterday, 02:00 PM',
    status: 'CONTACTED',
  },
];

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  navigate,
  defaultTab = 'inventory',
}) => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'inventory' | 'concierge' | 'media'>(defaultTab);
  const [inventoryList, setInventoryList] = useState<Car[]>([]);
  const [mediaList, setMediaList] = useState<MediaVideoItem[]>([]);
  const [leads, setLeads] = useState<ConciergeLead[]>(INITIAL_LEADS);
  const [searchTerm, setSearchTerm] = useState('');
  const [mediaSearchTerm, setMediaSearchTerm] = useState('');

  // Modals
  const [showAddCarModal, setShowAddCarModal] = useState(false);
  const [showAddMediaModal, setShowAddMediaModal] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [supabaseActive, setSupabaseActive] = useState(() => isSupabaseConfigured());
  const [editingMedia, setEditingMedia] = useState<MediaVideoItem | null>(null);

  // Safety Confirmation Modals (PART 22 & PART 23)
  const [carToDelete, setCarToDelete] = useState<Car | null>(null);
  const [carToDuplicate, setCarToDuplicate] = useState<Car | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<MediaVideoItem | null>(null);

  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [isSavingCar, setIsSavingCar] = useState(false);

  // Subscribe to carService and mediaService
  useEffect(() => {
    const unsubCars = carService.subscribe((updatedCars) => {
      setInventoryList(updatedCars);
    });
    const unsubMedia = mediaService.subscribe((updatedMedia) => {
      setMediaList(updatedMedia);
    });

    return () => {
      unsubCars();
      unsubMedia();
    };
  }, []);

  const notify = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 3500);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Car Actions
  const toggleCarStatus = async (carId: string) => {
    const car = inventoryList.find((c) => c.id === carId);
    if (!car) return;
    const nextStatus = car.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      await carService.updateCar(carId, { status: nextStatus });
      notify(`Vehicle "${car.title}" status changed to ${nextStatus}`);
    } catch (e: any) {
      notify(`Error: ${e.message}`);
    }
  };

  const handleArchiveCar = async (car: Car) => {
    const nextStatus = car.status === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED';
    try {
      await carService.updateCar(car.id, { status: nextStatus });
      notify(`Vehicle "${car.title}" marked as ${nextStatus}`);
    } catch (e: any) {
      notify(`Error: ${e.message}`);
    }
  };

  const confirmDuplicateCar = async () => {
    if (!carToDuplicate) return;
    try {
      const duplicated = await carService.duplicateCar(carToDuplicate.id);
      setCarToDuplicate(null);
      notify(`Duplicated vehicle as DRAFT: "${duplicated.title}"`);
    } catch (e: any) {
      notify(`Failed to duplicate: ${e.message}`);
    }
  };

  const confirmDeleteCar = async () => {
    if (!carToDelete) return;
    try {
      await carService.deleteCar(carToDelete.id);
      setCarToDelete(null);
      notify(`Vehicle "${carToDelete.title}" removed from inventory.`);
    } catch (e: any) {
      notify(`Failed to delete: ${e.message}`);
    }
  };

  const handleCreateCarSave = async (carData: Partial<Car>) => {
    setIsSavingCar(true);
    try {
      const created = await carService.createCar(carData);
      setIsSavingCar(false);
      setShowAddCarModal(false);
      notify(`Vehicle "${created.title}" successfully added to inventory!`);
    } catch (e: any) {
      setIsSavingCar(false);
      notify(`Error creating vehicle: ${e.message}`);
    }
  };

  // Media Actions
  const handleSaveMedia = async (videoData: Partial<MediaVideoItem>) => {
    if (editingMedia) {
      await mediaService.updateVideo(editingMedia.id, videoData);
      notify(`Video review "${videoData.title}" updated.`);
    } else {
      await mediaService.createVideo(videoData);
      notify(`Video review "${videoData.title}" added to Media CMS.`);
    }
    setEditingMedia(null);
  };

  const confirmDeleteVideo = async () => {
    if (!videoToDelete) return;
    try {
      await mediaService.deleteVideo(videoToDelete.id);
      setVideoToDelete(null);
      notify(`Video review removed from Media CMS.`);
    } catch (e: any) {
      notify(`Failed to delete video: ${e.message}`);
    }
  };

  const handleSetPrimaryVideo = async (video: MediaVideoItem) => {
    if (!video.car_id) {
      notify('This video is not associated with any vehicle.');
      return;
    }
    try {
      await mediaService.updateVideo(video.id, { is_primary: true });
      notify(`Video set as primary for associated vehicle!`);
    } catch (e: any) {
      notify(`Error setting primary video: ${e.message}`);
    }
  };

  // Concierge Leads
  const updateLeadStatus = (leadId: string, nextStatus: ConciergeLead['status']) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: nextStatus } : l))
    );
    notify(`Lead status updated to ${nextStatus}`);
  };

  const filteredInventory = inventoryList.filter(
    (c) =>
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMedia = mediaList.filter(
    (m) =>
      m.title.toLowerCase().includes(mediaSearchTerm.toLowerCase()) ||
      (m.car_title && m.car_title.toLowerCase().includes(mediaSearchTerm.toLowerCase())) ||
      m.video_type.toLowerCase().includes(mediaSearchTerm.toLowerCase())
  );

  const totalValuation = inventoryList.reduce((acc, c) => acc + c.price, 0);

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#111827]">
      {/* Top Header Navigation */}
      <header className="bg-[#071A2B] text-white border-b border-white/10 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              onClick={() => navigate('/')}
              className="cursor-pointer flex items-center gap-1.5 group"
            >
              <span className="text-xl font-extrabold tracking-tight text-white font-display">
                MANIFOLD
              </span>
              <span className="w-2 h-2 rounded-full bg-[#EF233C]" />
            </div>
            <span className="text-gray-500">/</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
                Operations Portal
              </span>
              <span className="text-[10px] font-extrabold bg-[#EF233C] text-white px-2 py-0.5 rounded tracking-widest uppercase">
                ADMIN
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-white">
                {user?.name || 'MANIFOLD Administrator'}
              </span>
              <span className="text-[10px] text-gray-400">
                {user?.email || 'admin@manifold.ng'}
              </span>
            </div>

            {/* Supabase Connection Button */}
            <button
              onClick={() => setShowSupabaseModal(true)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition font-medium cursor-pointer border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 text-white"
              title="Configure Supabase Database"
            >
              <Database className="w-3.5 h-3.5 text-[#3ECF8E]" />
              <span className="hidden sm:inline">
                {supabaseActive ? 'Supabase Connected' : 'Connect Supabase'}
              </span>
              <span className={`w-2 h-2 rounded-full ${supabaseActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            </button>

            <button
              onClick={() => navigate('/')}
              className="hidden md:inline-flex items-center gap-1 text-xs text-gray-300 hover:text-white px-3 py-1.5 rounded hover:bg-white/10 transition"
            >
              <span>Marketplace</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 text-xs text-white bg-white/10 hover:bg-[#EF233C] px-3 py-1.5 rounded transition font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Notification Toast */}
      {statusNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#071A2B] text-white px-4 py-3 rounded-xl shadow-2xl border border-white/20 flex items-center gap-2 text-xs font-medium animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusNotification}</span>
        </div>
      )}

      {/* Main Dashboard Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Title and Top Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#071A2B] font-display tracking-tight">
              Administrative Control Center
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Real-time verified inventory management, concierge car hunt tracking, and YouTube reviews.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'media' ? (
              <button
                onClick={() => {
                  setEditingMedia(null);
                  setShowAddMediaModal(true);
                }}
                className="inline-flex items-center gap-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg shadow transition transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Review Video</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAddCarModal(true)}
                className="inline-flex items-center gap-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg shadow transition transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Verified Car</span>
              </button>
            )}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#071A2B] flex items-center justify-center shrink-0">
              <CarIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Active Listings
              </p>
              <p className="text-2xl font-extrabold text-[#071A2B]">
                {inventoryList.filter((c) => c.status === 'PUBLISHED').length}
                <span className="text-xs font-normal text-gray-400 ml-1.5">
                  / {inventoryList.length} total
                </span>
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Portfolio Valuation
              </p>
              <p className="text-2xl font-extrabold text-[#071A2B]">
                {FORMAT_CURRENCY(totalValuation)}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-[#EF233C] flex items-center justify-center shrink-0">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Concierge Inquiries
              </p>
              <p className="text-2xl font-extrabold text-[#071A2B]">
                {leads.length}
                <span className="text-xs font-semibold text-[#EF233C] ml-1.5">
                  ({leads.filter((l) => l.status === 'NEW').length} new)
                </span>
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Review Videos CMS
              </p>
              <p className="text-2xl font-extrabold text-[#071A2B]">{mediaList.length}</p>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`py-3 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'inventory'
                  ? 'border-[#EF233C] text-[#EF233C]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <CarIcon className="w-4 h-4" />
              <span>Inventory Management ({inventoryList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('concierge')}
              className={`py-3 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'concierge'
                  ? 'border-[#EF233C] text-[#EF233C]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Concierge & Car Hunt ({leads.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('media')}
              className={`py-3 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'media'
                  ? 'border-[#EF233C] text-[#EF233C]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Media & Reviews CMS ({mediaList.length})</span>
            </button>
          </nav>
        </div>

        {/* TAB 1: INVENTORY MANAGEMENT */}
        {activeTab === 'inventory' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-0">
            {/* Table Search & Filters */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by make, model, location..."
                  className="w-full h-10 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
                />
              </div>

              <div className="text-xs text-gray-500 flex items-center gap-3">
                <span>
                  Showing <span className="font-semibold text-gray-900">{filteredInventory.length}</span> vehicles
                </span>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => setShowAddCarModal(true)}
                  className="text-xs font-bold text-[#EF233C] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Car</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Vehicle</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Price (NGN)</th>
                    <th className="py-3 px-4">Mileage</th>
                    <th className="py-3 px-4">Media Status</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInventory.map((car) => {
                    const hasVideo = !!(car.video?.youtube_url && car.video?.youtube_video_id);
                    const hasGallery = !!(car.gallery_image_1_url && car.gallery_image_2_url);

                    return (
                      <tr key={car.id} className="hover:bg-gray-50/80 transition">
                        {/* Vehicle Title & Thumbnail */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={car.video?.youtube_thumbnail_url || car.gallery_image_1_url}
                              alt={car.title}
                              className="w-16 h-10 object-cover rounded-md bg-gray-100 border border-gray-200 shrink-0"
                            />
                            <div>
                              <p className="font-bold text-gray-900 leading-snug hover:text-[#EF233C] transition cursor-pointer"
                                 onClick={() => navigate(`/cars/${car.slug}`)}>
                                {car.title}
                              </p>
                              <p className="text-[11px] text-gray-400">
                                {car.year} · {car.condition} · {car.transmission}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-medium text-gray-700">{car.location}</td>

                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          {FORMAT_CURRENCY(car.price)}
                        </td>

                        <td className="py-3.5 px-4 text-gray-600">
                          {FORMAT_NUMBER(car.mileage)} km
                        </td>

                        {/* PART 20: Media Indicators */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1">
                            {hasVideo ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
                                <Video className="w-3 h-3" />
                                Video
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 w-fit">
                                <AlertCircle className="w-3 h-3" />
                                Video Missing
                              </span>
                            )}

                            {hasGallery ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 w-fit">
                                <ImageIcon className="w-3 h-3" />
                                2 Images
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 w-fit">
                                <AlertCircle className="w-3 h-3" />
                                Gallery Incomplete
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              car.status === 'PUBLISHED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : car.status === 'ARCHIVED'
                                ? 'bg-gray-200 text-gray-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {car.status}
                          </span>
                        </td>

                        {/* PART 21: Full Action Bar (View, Edit, Duplicate, Archive, Delete) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View */}
                            <button
                              onClick={() => navigate(`/cars/${car.slug}`)}
                              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition"
                              title="View Public Listing"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Edit (PART 7 & 8) */}
                            <button
                              onClick={() => navigate(`/admin/cars/${car.id}/edit`)}
                              className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition flex items-center gap-1"
                              title="Edit Vehicle & Media"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            {/* Duplicate (PART 23) */}
                            <button
                              onClick={() => setCarToDuplicate(car)}
                              className="p-1.5 text-gray-500 hover:text-purple-700 hover:bg-purple-50 rounded transition"
                              title="Duplicate Vehicle"
                            >
                              <Copy className="w-4 h-4" />
                            </button>

                            {/* Archive */}
                            <button
                              onClick={() => handleArchiveCar(car)}
                              className="p-1.5 text-gray-500 hover:text-amber-700 hover:bg-amber-50 rounded transition"
                              title={car.status === 'ARCHIVED' ? 'Restore Vehicle' : 'Archive Vehicle'}
                            >
                              <Archive className="w-4 h-4" />
                            </button>

                            {/* Delete (PART 22) */}
                            <button
                              onClick={() => setCarToDelete(car)}
                              className="p-1.5 text-gray-400 hover:text-[#EF233C] hover:bg-red-50 rounded transition"
                              title="Delete Vehicle"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: CONCIERGE & CAR HUNT REQUESTS */}
        {activeTab === 'concierge' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">
                Incoming Buyer Requests & Car Hunt Leads
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Every request goes through the MANIFOLD concierge team before contacting partner dealers.
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/60 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 text-sm">{lead.fullName}</span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider ${
                          lead.status === 'NEW'
                            ? 'bg-red-100 text-[#EF233C]'
                            : lead.status === 'CONTACTED'
                            ? 'bg-blue-100 text-blue-800'
                            : lead.status === 'INSPECTION_SET'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {lead.status.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-gray-400">· {lead.date}</span>
                    </div>

                    <p className="text-xs font-semibold text-[#071A2B]">
                      Request: <span className="font-normal text-gray-700">{lead.carRequested}</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>Phone: <strong className="text-gray-800">{lead.phone}</strong></span>
                      <span>Email: <strong className="text-gray-800">{lead.email}</strong></span>
                      <span>Budget: <strong className="text-gray-800">{lead.budget}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={lead.status}
                      onChange={(e) =>
                        updateLeadStatus(lead.id, e.target.value as ConciergeLead['status'])
                      }
                      className="h-8 px-2 text-xs bg-gray-50 border border-gray-200 rounded font-medium text-gray-700 outline-none"
                    >
                      <option value="NEW">Mark: NEW</option>
                      <option value="CONTACTED">Mark: CONTACTED</option>
                      <option value="INSPECTION_SET">Mark: INSPECTION SET</option>
                      <option value="COMPLETED">Mark: COMPLETED</option>
                    </select>

                    <a
                      href={`tel:${lead.phone}`}
                      className="h-8 px-3 bg-[#071A2B] hover:bg-[#0B2239] text-white text-xs font-bold rounded flex items-center transition"
                    >
                      Call Buyer
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MEDIA & VIDEO REVIEWS CMS (PART 11 & 12) */}
        {activeTab === 'media' && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={mediaSearchTerm}
                  onChange={(e) => setMediaSearchTerm(e.target.value)}
                  placeholder="Search reviews by title, car, or type..."
                  className="w-full h-10 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  Total Reviews: <strong className="text-gray-900">{mediaList.length}</strong>
                </span>
                <button
                  onClick={() => {
                    setEditingMedia(null);
                    setShowAddMediaModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Review Video</span>
                </button>
              </div>
            </div>

            {/* Video Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMedia.map((video) => (
                <div
                  key={video.id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition"
                >
                  <div>
                    {/* Thumbnail & Badges */}
                    <div className="relative aspect-video bg-black overflow-hidden group">
                      <img
                        src={video.youtube_thumbnail_url}
                        alt={video.title}
                        className="w-full h-full object-cover filter brightness-90 group-hover:scale-105 transition duration-300"
                        onError={(e) => {
                          e.currentTarget.src = `https://img.youtube.com/vi/${video.youtube_video_id}/hqdefault.jpg`;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                      {/* Top Badges */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className="bg-[#EF233C] text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded">
                          {video.video_type}
                        </span>
                        {video.is_primary && (
                          <span className="bg-amber-400 text-gray-900 text-[9px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1 shadow">
                            <Star className="w-3 h-3 fill-current" />
                            Primary
                          </span>
                        )}
                      </div>

                      {/* Duration */}
                      <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                        {video.duration || '12:00'}
                      </span>

                      {/* Play Hover */}
                      <a
                        href={video.youtube_url}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40"
                      >
                        <div className="w-11 h-11 rounded-full bg-[#EF233C] text-white flex items-center justify-center shadow-lg">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </a>
                    </div>

                    {/* Details */}
                    <div className="p-4 space-y-2">
                      <h4 className="text-xs font-bold text-gray-900 line-clamp-1 leading-snug">
                        {video.title}
                      </h4>

                      {video.car_title ? (
                        <div className="text-[11px] font-semibold text-[#071A2B] bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center gap-1.5">
                          <CarIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">Vehicle: {video.car_title}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">
                          No vehicle association (General Editorial)
                        </span>
                      )}

                      <p className="text-[11px] text-gray-500 line-clamp-2">
                        {video.description || 'Verified MANIFOLD automotive review.'}
                      </p>
                    </div>
                  </div>

                  {/* Actions Strip */}
                  <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {video.car_id && !video.is_primary && (
                        <button
                          onClick={() => handleSetPrimaryVideo(video)}
                          className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-200 transition cursor-pointer"
                        >
                          Make Primary
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <a
                        href={video.youtube_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-gray-500 hover:text-gray-900 rounded"
                        title="Watch on YouTube"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => {
                          setEditingMedia(video);
                          setShowAddMediaModal(true);
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit Video"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setVideoToDelete(video)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        title="Delete Video"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FULL ADD CAR MODAL (PART 2 - PART 6) */}
      {showAddCarModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm p-4 sm:p-6 lg:p-10 flex items-start justify-center animate-in fade-in duration-200">
          <div className="bg-[#F7F8FA] w-full max-w-5xl rounded-3xl shadow-2xl border border-gray-200 overflow-hidden my-auto">
            {/* Header */}
            <div className="bg-[#071A2B] px-6 py-5 text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EF233C] flex items-center justify-center text-white shadow">
                  <CarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base font-display">Add Verified Vehicle</h3>
                  <p className="text-[10px] text-gray-300 uppercase tracking-widest mt-0.5">
                    MANIFOLD Video-First Inventory CMS
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddCarModal(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form Container */}
            <div className="p-6 sm:p-8">
              <CarForm
                isEditMode={false}
                isSaving={isSavingCar}
                onSave={handleCreateCarSave}
                onCancel={() => setShowAddCarModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT MEDIA VIDEO MODAL (PART 12) */}
      <MediaVideoModal
        isOpen={showAddMediaModal}
        onClose={() => {
          setShowAddMediaModal(false);
          setEditingMedia(null);
        }}
        cars={inventoryList}
        initialVideo={editingMedia}
        onSave={handleSaveMedia}
      />

      {/* DELETE VEHICLE SAFETY MODAL (PART 22) */}
      {carToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 text-[#EF233C] flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-bold text-gray-900 text-lg font-display">Delete Vehicle?</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                This will permanently remove <strong>{carToDelete.title}</strong> from the MANIFOLD inventory.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => setCarToDelete(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteCar}
                className="flex-1 py-2.5 bg-[#EF233C] hover:bg-[#d91b32] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow"
              >
                Delete Vehicle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE VEHICLE CONFIRMATION MODAL (PART 23) */}
      {carToDuplicate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
              <Copy className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-bold text-gray-900 text-lg font-display">Duplicate Vehicle Listing?</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Creates a new <strong>DRAFT</strong> listing based on <strong>{carToDuplicate.title}</strong>. You can review and modify all details before publishing.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => setCarToDuplicate(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDuplicateCar}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow"
              >
                Duplicate as Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MEDIA SAFETY MODAL */}
      {videoToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 text-[#EF233C] flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-bold text-gray-900 text-lg font-display">Delete Video Review?</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Remove <strong>{videoToDelete.title}</strong> from the Media CMS?
              </p>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => setVideoToDelete(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteVideo}
                className="flex-1 py-2.5 bg-[#EF233C] hover:bg-[#d91b32] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow"
              >
                Delete Video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPABASE CONNECTION SETTINGS MODAL */}
      <SupabaseSettingsModal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
        onStatusChange={() => setSupabaseActive(isSupabaseConfigured())}
      />
    </div>
  );
};
