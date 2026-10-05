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
  Building2,
  Layers,
  Tag,
  CheckCircle,
  Phone,
  Mail,
  Calendar,
  Award,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { FORMAT_CURRENCY, FORMAT_NUMBER } from '../../data/mockCars';
import { Car, CarBrand, BodyTypeCategory } from '../../types';
import { carService } from '../../services/carService';
import { mediaService, MediaVideoItem } from '../../services/mediaService';
import { brandService } from '../../services/brandService';
import { modelService } from '../../services/modelService';
import { categoryService } from '../../services/categoryService';
import { dealerService, DealerFullRecord } from '../../services/dealerService';
import { inquiryService, InquiryRecord, InquiryDetailedStatus } from '../../services/inquiryService';
import { inspectionService, InspectionRecord } from '../../services/inspectionService';
import { salesService, SaleRecord, CommissionRecord } from '../../services/salesService';
import { checkIsSupabaseConfigured } from '../../lib/supabase';
import { CarForm } from '../../components/admin/CarForm';
import { MediaVideoModal } from '../../components/admin/MediaVideoModal';
import { SupabaseSettingsModal } from '../../components/admin/SupabaseSettingsModal';

export type AdminTabType =
  | 'inventory'
  | 'concierge'
  | 'inspections'
  | 'media'
  | 'brands'
  | 'models'
  | 'types'
  | 'dealers'
  | 'sales'
  | 'settings';

interface AdminDashboardPageProps {
  navigate: (route: string) => void;
  activeRoute?: string;
  defaultTab?: AdminTabType;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  navigate,
  activeRoute = '/admin',
  defaultTab = 'inventory',
}) => {
  const { user, signOut } = useAuth();

  // Resolve initial tab based on URL route
  const getTabFromRoute = (route: string): AdminTabType => {
    if (route.startsWith('/admin/brands')) return 'brands';
    if (route.startsWith('/admin/models')) return 'models';
    if (route.startsWith('/admin/types')) return 'types';
    if (route.startsWith('/admin/dealers')) return 'dealers';
    if (route.startsWith('/admin/media')) return 'media';
    if (route.startsWith('/admin/enquiries')) return 'concierge';
    if (route.startsWith('/admin/inspections')) return 'inspections';
    if (route.startsWith('/admin/sales') || route.startsWith('/admin/commissions')) return 'sales';
    if (route.startsWith('/admin/settings')) return 'settings';
    return defaultTab;
  };

  const [activeTab, setActiveTab] = useState<AdminTabType>(() => getTabFromRoute(activeRoute));

  useEffect(() => {
    setActiveTab(getTabFromRoute(activeRoute));
    if (activeRoute === '/admin/cars/new') {
      setShowAddCarModal(true);
    }
  }, [activeRoute]);

  // Tab change handler that keeps URL in sync
  const handleTabChange = (tab: AdminTabType) => {
    setActiveTab(tab);
    const routeMap: Record<AdminTabType, string> = {
      inventory: '/admin/cars',
      concierge: '/admin/enquiries',
      inspections: '/admin/inspections',
      media: '/admin/media',
      brands: '/admin/brands',
      models: '/admin/models',
      types: '/admin/types',
      dealers: '/admin/dealers',
      sales: '/admin/sales',
      settings: '/admin/settings',
    };
    navigate(routeMap[tab]);
  };

  // State from authoritative Supabase Services
  const [inventoryList, setInventoryList] = useState<Car[]>([]);
  const [mediaList, setMediaList] = useState<MediaVideoItem[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [bodyTypes, setBodyTypes] = useState<BodyTypeCategory[]>([]);
  const [dealers, setDealers] = useState<DealerFullRecord[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [mediaSearchTerm, setMediaSearchTerm] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  // Modals
  const [showAddCarModal, setShowAddCarModal] = useState(false);
  const [showAddMediaModal, setShowAddMediaModal] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [supabaseActive, setSupabaseActive] = useState(() => checkIsSupabaseConfigured());
  const [editingMedia, setEditingMedia] = useState<MediaVideoItem | null>(null);

  // Safety Confirmation Modals
  const [carToDelete, setCarToDelete] = useState<Car | null>(null);
  const [carToDuplicate, setCarToDuplicate] = useState<Car | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<MediaVideoItem | null>(null);

  // Create Modals for other entities
  const [newBrandModal, setNewBrandModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandCountry, setNewBrandCountry] = useState('Japan');

  const [newTypeModal, setNewTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');

  const [newDealerModal, setNewDealerModal] = useState(false);
  const [newDealerName, setNewDealerName] = useState('');
  const [newDealerCity, setNewDealerCity] = useState('Lekki');
  const [newDealerPhone, setNewDealerPhone] = useState('');
  const [newDealerEmail, setNewDealerEmail] = useState('');

  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [isSavingCar, setIsSavingCar] = useState(false);

  // Subscriptions & Initial Loads
  useEffect(() => {
    const unsubCars = carService.subscribe((updatedCars) => {
      setInventoryList(updatedCars);
    });
    const unsubMedia = mediaService.subscribe((updatedMedia) => {
      setMediaList(updatedMedia);
    });

    loadLiveSupabaseData();

    return () => {
      unsubCars();
      unsubMedia();
    };
  }, []);

  const loadLiveSupabaseData = async () => {
    setLoadingData(true);
    try {
      const [
        inqRes,
        inspRes,
        brandsRes,
        typesRes,
        dealersRes,
        salesRes,
        commRes,
      ] = await Promise.allSettled([
        inquiryService.getInquiries(),
        inspectionService.getInspections(),
        brandService.getBrands(),
        categoryService.getBodyTypes(),
        dealerService.getDealers(),
        salesService.getSales(),
        salesService.getCommissions(),
      ]);

      if (inqRes.status === 'fulfilled') setInquiries(inqRes.value);
      if (inspRes.status === 'fulfilled') setInspections(inspRes.value);
      if (brandsRes.status === 'fulfilled') setBrands(brandsRes.value);
      if (typesRes.status === 'fulfilled') setBodyTypes(typesRes.value);
      if (dealersRes.status === 'fulfilled') setDealers(dealersRes.value);
      if (salesRes.status === 'fulfilled') setSales(salesRes.value);
      if (commRes.status === 'fulfilled') setCommissions(commRes.value);
    } catch (e: any) {
      console.warn('Notice loading Supabase auxiliary datasets:', e.message);
    } finally {
      setLoadingData(false);
    }
  };

  const notify = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 3500);
  };

  /**
   * Section 5: Real Logout
   * Signs out of Supabase Auth and redirects to /admin/login
   */
  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
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
      notify(`Vehicle "${carToDelete.title}" removed from Supabase inventory.`);
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
      notify(`Vehicle "${created.title}" successfully persisted to Supabase!`);
    } catch (e: any) {
      setIsSavingCar(false);
      notify(`Error creating vehicle: ${e.message}`);
    }
  };

  // Media Actions
  const handleSaveMedia = async (videoData: Partial<MediaVideoItem>) => {
    try {
      if (editingMedia) {
        await mediaService.updateVideo(editingMedia.id, videoData);
        notify(`Video review "${videoData.title}" updated in Supabase.`);
      } else {
        await mediaService.createVideo(videoData);
        notify(`Video review "${videoData.title}" persisted to public.car_media.`);
      }
      setEditingMedia(null);
    } catch (e: any) {
      notify(`Error saving video: ${e.message}`);
    }
  };

  const confirmDeleteVideo = async () => {
    if (!videoToDelete) return;
    try {
      await mediaService.deleteVideo(videoToDelete.id);
      setVideoToDelete(null);
      notify(`Video review removed from public.car_media.`);
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

  // Inquiry Status Updates
  const updateInquiryStatus = async (inquiryId: string, nextStatus: InquiryDetailedStatus) => {
    try {
      await inquiryService.updateInquiryStatus(inquiryId, nextStatus);
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === inquiryId ? { ...inq, status: nextStatus } : inq))
      );
      notify(`Inquiry updated to "${nextStatus}"`);
    } catch (e: any) {
      notify(`Failed to update inquiry: ${e.message}`);
    }
  };

  // Brand Actions
  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    try {
      const created = await brandService.createBrand({
        name: newBrandName.trim(),
        country: newBrandCountry,
        is_active: true,
      });
      setBrands((prev) => [...prev, created]);
      setNewBrandName('');
      setNewBrandModal(false);
      notify(`Brand "${created.name}" created in public.car_brands!`);
    } catch (e: any) {
      notify(`Error: ${e.message}`);
    }
  };

  // Type Actions
  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    try {
      const created = await categoryService.createBodyType({
        name: newTypeName.trim(),
        description: newTypeDescription.trim(),
        is_active: true,
      });
      setBodyTypes((prev) => [...prev, created]);
      setNewTypeName('');
      setNewTypeDescription('');
      setNewTypeModal(false);
      notify(`Body type "${created.name}" created in public.car_types!`);
    } catch (e: any) {
      notify(`Error: ${e.message}`);
    }
  };

  // Dealer Actions
  const handleCreateDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDealerName.trim()) return;
    try {
      const created = await dealerService.createDealer({
        name: newDealerName.trim(),
        city: newDealerCity.trim(),
        state: 'Lagos',
        phone: newDealerPhone.trim(),
        email: newDealerEmail.trim(),
        verified_partner: true,
      });
      setDealers((prev) => [...prev, created]);
      setNewDealerName('');
      setNewDealerPhone('');
      setNewDealerEmail('');
      setNewDealerModal(false);
      notify(`Dealer "${created.name}" persisted to public.dealers!`);
    } catch (e: any) {
      notify(`Error: ${e.message}`);
    }
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
                {user?.email || 'newwavereporters@gmail.com'}
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
              <span
                className={`w-2 h-2 rounded-full ${
                  supabaseActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
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
              className="inline-flex items-center gap-1.5 text-xs text-white bg-white/10 hover:bg-[#EF233C] px-3 py-1.5 rounded transition font-medium cursor-pointer"
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
              Live Supabase operations for verified inventory, buyer leads, technical inspections, and video reviews.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={loadLiveSupabaseData}
              disabled={loadingData}
              className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg shadow-sm transition"
              title="Refresh all Supabase tables"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Data</span>
            </button>

            {activeTab === 'media' && (
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
            )}

            {activeTab === 'brands' && (
              <button
                onClick={() => setNewBrandModal(true)}
                className="inline-flex items-center gap-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg shadow transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Brand</span>
              </button>
            )}

            {activeTab === 'types' && (
              <button
                onClick={() => setNewTypeModal(true)}
                className="inline-flex items-center gap-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg shadow transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Vehicle Type</span>
              </button>
            )}

            {activeTab === 'dealers' && (
              <button
                onClick={() => setNewDealerModal(true)}
                className="inline-flex items-center gap-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg shadow transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Partner Dealer</span>
              </button>
            )}

            {(activeTab === 'inventory' || activeTab === 'concierge' || activeTab === 'inspections' || activeTab === 'sales' || activeTab === 'settings' || activeTab === 'models') && (
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
                Buyer Inquiries
              </p>
              <p className="text-2xl font-extrabold text-[#071A2B]">
                {inquiries.length}
                <span className="text-xs font-semibold text-[#EF233C] ml-1.5">
                  ({inquiries.filter((l) => l.status === 'new').length} new)
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

        {/* Tab Controls Navigation */}
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex space-x-6 min-w-max pb-0.5">
            <button
              onClick={() => handleTabChange('inventory')}
              className={`py-3 px-1 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'inventory'
                  ? 'border-[#EF233C] text-[#EF233C]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <CarIcon className="w-4 h-4" />
              <span>Cars ({inventoryList.length})</span>
            </button>

            <button
              onClick={() => handleTabChange('concierge')}
              className={`py-3 px-1 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'concierge'
                  ? 'border-[#EF233C] text-[#EF233C]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Enquiries ({inquiries.length})</span>
            </button>

            <button
              onClick={() => handleTabChange('inspections')}
              className={`py-3 px-1 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'inspections'
                  ? 'border-[#EF233C] text-[#EF233C]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Inspections ({inspections.length})</span>
            </button>

            <button
              onClick={() => handleTabChange('media')}
              className={`py-3 px-1 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'media'
                  ? 'border-[#EF233C] text-[#EF233C]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Media & Reviews ({mediaList.length})</span>
            </button>

            <button
              onClick={() => handleTabChange('brands')}
              className={`py-3 px-1 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'brands'
                  ? 'border-[#EF233C] text-[#EF233C]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>Brands ({brands.length})</span>
            </button>

            <button
              onClick={() => handleTabChange('types')}
              className={`py-3 px-1 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'types'
                  ? 'border-[#EF233C] text-[#EF233C]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Vehicle Types ({bodyTypes.length})</span>
            </button>

            <button
              onClick={() => handleTabChange('dealers')}
              className={`py-3 px-1 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'dealers'
                  ? 'border-[#EF233C] text-[#EF233C]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Dealers ({dealers.length})</span>
            </button>

            <button
              onClick={() => handleTabChange('sales')}
              className={`py-3 px-1 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'sales'
                  ? 'border-[#EF233C] text-[#EF233C]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Sales & Commissions</span>
            </button>

            <button
              onClick={() => handleTabChange('settings')}
              className={`py-3 px-1 border-b-2 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'settings'
                  ? 'border-[#EF233C] text-[#EF233C]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Database & Settings</span>
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
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={car.video?.youtube_thumbnail_url || car.gallery_image_1_url}
                              alt={car.title}
                              className="w-16 h-10 object-cover rounded-md bg-gray-100 border border-gray-200 shrink-0"
                            />
                            <div>
                              <p
                                className="font-bold text-gray-900 leading-snug hover:text-[#EF233C] transition cursor-pointer"
                                onClick={() => navigate(`/cars/${car.slug}`)}
                              >
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

                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => toggleCarStatus(car.id)}
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition ${
                              car.status === 'PUBLISHED'
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : car.status === 'ARCHIVED'
                                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            }`}
                          >
                            {car.status}
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => navigate(`/cars/${car.slug}`)}
                              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition"
                              title="View Public Listing"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => navigate(`/admin/cars/${car.id}/edit`)}
                              className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition flex items-center gap-1"
                              title="Edit Vehicle & Media"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              onClick={() => setCarToDuplicate(car)}
                              className="p-1.5 text-gray-500 hover:text-purple-700 hover:bg-purple-50 rounded transition"
                              title="Duplicate Vehicle"
                            >
                              <Copy className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleArchiveCar(car)}
                              className="p-1.5 text-gray-500 hover:text-amber-700 hover:bg-amber-50 rounded transition"
                              title={car.status === 'ARCHIVED' ? 'Restore Vehicle' : 'Archive Vehicle'}
                            >
                              <Archive className="w-4 h-4" />
                            </button>

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

        {/* TAB 2: BUYER INQUIRIES & CONCIERGE */}
        {activeTab === 'concierge' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  Live Buyer Inquiries (public.buyer_inquiries)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Direct requests submitted via "I'm Interested" and concierge inquiry forms.
                </p>
              </div>
              <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded">
                Total: {inquiries.length}
              </span>
            </div>

            {inquiries.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                No buyer inquiries in database yet. Inquiries submitted on vehicle pages appear here in real time.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {inquiries.map((inq) => (
                  <div
                    key={inq.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/60 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">{inq.full_name}</span>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider ${
                            inq.status === 'new'
                              ? 'bg-red-100 text-[#EF233C]'
                              : inq.status === 'contacted'
                              ? 'bg-blue-100 text-blue-800'
                              : inq.status === 'viewing_scheduled'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {inq.status}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          · {new Date(inq.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-[#071A2B]">
                        Vehicle: <span className="font-normal text-gray-700">{inq.car_title || 'General Enquiry'}</span>
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>Phone: <strong className="text-gray-800">{inq.phone_number}</strong></span>
                        <span>Email: <strong className="text-gray-800">{inq.email}</strong></span>
                        <span>Location: <strong className="text-gray-800">{inq.location}</strong></span>
                      </div>

                      {inq.notes && (
                        <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded border border-gray-100 mt-1">
                          "{inq.notes}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={inq.status}
                        onChange={(e) =>
                          updateInquiryStatus(inq.id, e.target.value as InquiryDetailedStatus)
                        }
                        className="h-8 px-2 text-xs bg-gray-50 border border-gray-200 rounded font-medium text-gray-700 outline-none"
                      >
                        <option value="new">Status: NEW</option>
                        <option value="contacted">Status: CONTACTED</option>
                        <option value="qualified">Status: QUALIFIED</option>
                        <option value="viewing_scheduled">Status: VIEWING SCHEDULED</option>
                        <option value="negotiating">Status: NEGOTIATING</option>
                        <option value="won">Status: WON</option>
                        <option value="lost">Status: LOST</option>
                        <option value="closed">Status: CLOSED</option>
                      </select>

                      <a
                        href={`tel:${inq.phone_number}`}
                        className="h-8 px-3 bg-[#071A2B] hover:bg-[#0B2239] text-white text-xs font-bold rounded flex items-center transition"
                      >
                        Call Buyer
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: VEHICLE INSPECTIONS (public.vehicle_inspections) */}
        {activeTab === 'inspections' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  Vehicle Inspections & Audit Logs (public.vehicle_inspections)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  150+ point physical inspections conducted by MANIFOLD technicians before vehicle listing.
                </p>
              </div>
              <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded">
                Audited Vehicles: {inspections.length}
              </span>
            </div>

            {inspections.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                No inspection reports filed yet. All published vehicles pass through physical inspection before launch.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4">Vehicle</th>
                      <th className="py-3 px-4">Inspector</th>
                      <th className="py-3 px-4">Overall Score</th>
                      <th className="py-3 px-4">Engine / Trans</th>
                      <th className="py-3 px-4">Electrical / Body</th>
                      <th className="py-3 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {inspections.map((insp) => (
                      <tr key={insp.id} className="hover:bg-gray-50 transition">
                        <td className="py-3.5 px-4 font-bold text-gray-900">{insp.car_title}</td>
                        <td className="py-3.5 px-4">{insp.inspector_name}</td>
                        <td className="py-3.5 px-4 font-extrabold text-emerald-600">
                          {insp.overall_score}/100
                        </td>
                        <td className="py-3.5 px-4">
                          {insp.engine_score}% / {insp.transmission_score}%
                        </td>
                        <td className="py-3.5 px-4">
                          {insp.electrical_score}% / {insp.body_frame_score}%
                        </td>
                        <td className="py-3.5 px-4 text-gray-400">
                          {new Date(insp.inspection_date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MEDIA & VIDEO REVIEWS CMS */}
        {activeTab === 'media' && (
          <div className="space-y-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMedia.map((video) => (
                <div
                  key={video.id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition"
                >
                  <div>
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

                      <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                        {video.duration || '12:00'}
                      </span>

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

        {/* TAB 5: BRANDS (public.car_brands) */}
        {activeTab === 'brands' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  Active Car Brands (public.car_brands)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Manufacturers indexed for search, filtering, and video catalogues.
                </p>
              </div>
              <button
                onClick={() => setNewBrandModal(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-white bg-[#EF233C] px-3 py-1.5 rounded-lg shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Brand</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 p-5">
              {brands.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white hover:shadow transition flex flex-col items-center text-center space-y-2"
                >
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center font-bold text-gray-800 text-sm">
                    {b.name.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="font-bold text-xs text-gray-900">{b.name}</span>
                  <span className="text-[10px] text-gray-400">{b.country}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: VEHICLE TYPES (public.car_types) */}
        {activeTab === 'types' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  Body Types & Categories (public.car_types)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Classification taxonomy used by homepage browsables and search filters.
                </p>
              </div>
              <button
                onClick={() => setNewTypeModal(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-white bg-[#EF233C] px-3 py-1.5 rounded-lg shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Type</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-5">
              {bodyTypes.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex items-start justify-between"
                >
                  <div>
                    <h4 className="font-bold text-xs text-gray-900">{t.name}</h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">{t.description || 'Vehicle category'}</p>
                  </div>
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: PARTNER DEALERS (public.dealers) */}
        {activeTab === 'dealers' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  Partner Dealers (public.dealers)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Confidential dealer contact details. NEVER exposed to public consumers on vehicle pages.
                </p>
              </div>
              <button
                onClick={() => setNewDealerModal(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-white bg-[#EF233C] px-3 py-1.5 rounded-lg shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Dealer</span>
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {dealers.map((d) => (
                <div
                  key={d.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/60 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-gray-900">{d.name}</h4>
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Verified Partner
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {d.city}, {d.state} · Partner since {d.joined_year}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-600 mt-1">
                      {d.phone && <span>Phone: {d.phone}</span>}
                      {d.email && <span>Email: {d.email}</span>}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">
                    ID: {d.id}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 8: SALES & COMMISSIONS */}
        {activeTab === 'sales' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Completed & Escrow Sales (public.sales)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Transactions facilitated through MANIFOLD brokerage.
                  </p>
                </div>
                <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded">
                  Total Sales: {sales.length}
                </span>
              </div>

              {sales.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  No vehicle sales finalized yet. Completed deals and 2.5% brokerage commissions will be listed here.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-600">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
                      <tr>
                        <th className="py-3 px-4">Vehicle</th>
                        <th className="py-3 px-4">Buyer</th>
                        <th className="py-3 px-4">Sale Price</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-gray-50 transition">
                          <td className="py-3.5 px-4 font-bold text-gray-900">{sale.car_title}</td>
                          <td className="py-3.5 px-4">{sale.buyer_name}</td>
                          <td className="py-3.5 px-4 font-bold text-gray-900">
                            {FORMAT_CURRENCY(sale.sale_price)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                              {sale.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-gray-400">
                            {new Date(sale.sale_date).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Commissions */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 text-sm">
                  Brokerage Commissions (public.commissions)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  MANIFOLD commission ledger (2.5% brokerage on verified sales).
                </p>
              </div>

              {commissions.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  No commission entries recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {commissions.map((c) => (
                    <div key={c.id} className="p-4 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono text-gray-400 text-[11px] block">{c.id}</span>
                        <span className="font-bold text-gray-900">
                          {c.commission_rate}% Brokerage Fee
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-emerald-600 block">
                          {FORMAT_CURRENCY(c.commission_amount)}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-gray-400">
                          {c.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 9: DATABASE & SETTINGS */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">
                Supabase Authoritative Architecture
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                MANIFOLD connects directly to Supabase PostgreSQL. RLS ensures client-side security.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                  Authoritative Admin
                </span>
                <p className="font-bold text-gray-900 text-sm">newwavereporters@gmail.com</p>
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                  Active in public.admin_users
                </span>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                  Connection Status
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      supabaseActive ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <span className="font-bold text-gray-900 text-sm">
                    {supabaseActive ? 'Live & Connected' : 'Configuration Pending'}
                  </span>
                </div>
                <button
                  onClick={() => setShowSupabaseModal(true)}
                  className="text-xs text-blue-600 font-bold hover:underline block"
                >
                  Configure Supabase Keys →
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 text-xs space-y-1">
              <span className="font-bold block">Authoritative Schema Tables:</span>
              <p className="text-[11px] leading-relaxed text-blue-800">
                profiles, admin_users, car_brands, car_models, car_types, dealers, cars, car_media,
                car_images, vehicle_verifications, vehicle_inspections, buyer_inquiries, car_hunt_requests,
                viewings, sales, commissions, favorites, saved_searches, notifications, audit_logs.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* FULL ADD CAR MODAL */}
      {showAddCarModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm p-4 sm:p-6 lg:p-10 flex items-start justify-center animate-in fade-in duration-200">
          <div className="bg-[#F7F8FA] w-full max-w-5xl rounded-3xl shadow-2xl border border-gray-200 overflow-hidden my-auto">
            <div className="bg-[#071A2B] px-6 py-5 text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EF233C] flex items-center justify-center text-white shadow">
                  <CarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base font-display">Add Verified Vehicle</h3>
                  <p className="text-[10px] text-gray-300 uppercase tracking-widest mt-0.5">
                    MANIFOLD Video-First Inventory CMS (public.cars)
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

      {/* ADD / EDIT MEDIA VIDEO MODAL */}
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

      {/* ADD BRAND MODAL */}
      {newBrandModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-sm">Add New Car Brand</h3>
            <form onSubmit={handleCreateBrand} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-700 uppercase block mb-1">
                  Brand Name
                </label>
                <input
                  type="text"
                  required
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="e.g. Porsche, Bentley"
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-700 uppercase block mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={newBrandCountry}
                  onChange={(e) => setNewBrandCountry(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-xs"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewBrandModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#EF233C] rounded-lg"
                >
                  Save Brand
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD VEHICLE TYPE MODAL */}
      {newTypeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-sm">Add Vehicle Type</h3>
            <form onSubmit={handleCreateType} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-700 uppercase block mb-1">
                  Type Name
                </label>
                <input
                  type="text"
                  required
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="e.g. Convertible, Crossover"
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-700 uppercase block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newTypeDescription}
                  onChange={(e) => setNewTypeDescription(e.target.value)}
                  placeholder="e.g. Open-top luxury cruisers"
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-xs"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewTypeModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#EF233C] rounded-lg"
                >
                  Save Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD DEALER MODAL */}
      {newDealerModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-sm">Add Partner Dealer</h3>
            <form onSubmit={handleCreateDealer} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-700 uppercase block mb-1">
                  Dealership Name
                </label>
                <input
                  type="text"
                  required
                  value={newDealerName}
                  onChange={(e) => setNewDealerName(e.target.value)}
                  placeholder="e.g. Apex Luxury Victoria Island"
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-700 uppercase block mb-1">
                  City / Location
                </label>
                <input
                  type="text"
                  value={newDealerCity}
                  onChange={(e) => setNewDealerCity(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-700 uppercase block mb-1">
                  Confidential Phone (Admin Only)
                </label>
                <input
                  type="text"
                  value={newDealerPhone}
                  onChange={(e) => setNewDealerPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-700 uppercase block mb-1">
                  Confidential Email (Admin Only)
                </label>
                <input
                  type="email"
                  value={newDealerEmail}
                  onChange={(e) => setNewDealerEmail(e.target.value)}
                  placeholder="inventory@dealer.ng"
                  className="w-full h-10 px-3 border border-gray-200 rounded-lg text-xs"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewDealerModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#EF233C] rounded-lg"
                >
                  Save Dealer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE VEHICLE SAFETY MODAL */}
      {carToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 text-[#EF233C] flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-bold text-gray-900 text-lg font-display">Delete Vehicle?</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                This will permanently delete <strong>{carToDelete.title}</strong> from Supabase.
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

      {/* DUPLICATE VEHICLE CONFIRMATION MODAL */}
      {carToDuplicate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
              <Copy className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-bold text-gray-900 text-lg font-display">Duplicate Vehicle Listing?</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Creates a new <strong>DRAFT</strong> listing based on <strong>{carToDuplicate.title}</strong> in Supabase. You can review and modify all details before publishing.
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
                Remove <strong>{videoToDelete.title}</strong> from public.car_media?
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
        onStatusChange={() => setSupabaseActive(checkIsSupabaseConfigured())}
      />
    </div>
  );
};
