import React, { useState, useEffect } from 'react';
import { DealerLayout } from '../../components/dealer/DealerLayout';
import { useDealerAuth } from '../../context/DealerAuthContext';
import { dealerVehicleService, DealerCarFormInput } from '../../services/dealerVehicleService';
import { brandService } from '../../services/brandService';
import { modelService } from '../../services/modelService';
import { categoryService } from '../../services/categoryService';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from '../../utils/youtube';
import {
  CarFront,
  Video,
  Image as ImageIcon,
  DollarSign,
  MapPin,
  FileText,
  Save,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  X,
  Upload,
  Info,
  ArrowLeft,
} from 'lucide-react';
import { CarBrand, BodyTypeCategory } from '../../types';

interface DealerAddCarPageProps {
  navigate: (route: string) => void;
}

export const DealerAddCarPage: React.FC<DealerAddCarPageProps> = ({ navigate }) => {
  const { dealerAccount } = useDealerAuth();

  // Dynamic Options Loaded from authoritative Supabase tables
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [bodyTypes, setBodyTypes] = useState<BodyTypeCategory[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);

  // Form State
  const [brandId, setBrandId] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [trim, setTrim] = useState('');
  const [year, setYear] = useState<number>(2021);
  const [typeId, setTypeId] = useState('');
  const [bodyType, setBodyType] = useState('SUV');
  const [condition, setCondition] = useState('Foreign Used (Tokunbo)');
  const [mileage, setMileage] = useState<string>('45000');
  const [fuelType, setFuelType] = useState('Petrol');
  const [transmission, setTransmission] = useState('Automatic');
  const [driveType, setDriveType] = useState('AWD');
  const [engine, setEngine] = useState('3.5L V6');
  const [horsepower, setHorsepower] = useState('');
  const [exteriorColor, setExteriorColor] = useState('Metallic Black');
  const [interiorColor, setInteriorColor] = useState('Black Leather');
  const [seats, setSeats] = useState(5);
  const [doors, setDoors] = useState(4);

  // Pricing
  const [price, setPrice] = useState('');
  const [previousPrice, setPreviousPrice] = useState('');

  // Location
  const [location, setLocation] = useState('Lekki Phase 1');
  const [state, setState] = useState('Lagos');

  // Description
  const [description, setDescription] = useState('');

  // Video-First (YouTube)
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [derivedVideoId, setDerivedVideoId] = useState('');

  // Two Image Gallery (2 images maximum)
  const [image1Url, setImage1Url] = useState('');
  const [image2Url, setImage2Url] = useState('');

  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Load Brands and Body Types dynamically from Supabase
  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      try {
        const [brandsData, typesData] = await Promise.all([
          brandService.getBrands(),
          categoryService.getBodyTypes(),
        ]);
        if (mounted) {
          setBrands(brandsData);
          setBodyTypes(typesData);
          if (brandsData.length > 0 && !make) {
            setBrandId(brandsData[0].id);
            setMake(brandsData[0].name);
          }
          if (typesData.length > 0) {
            setTypeId(typesData[0].id);
            setBodyType(typesData[0].name);
          }
          setLoadingBrands(false);
        }
      } catch (err) {
        console.warn('Error loading vehicle options:', err);
        if (mounted) setLoadingBrands(false);
      }
    }
    loadOptions();
    return () => {
      mounted = false;
    };
  }, []);

  // When Make changes, dynamically load Models from car_models
  useEffect(() => {
    let mounted = true;
    if (!make) {
      setModels([]);
      return;
    }

    async function loadModels() {
      setLoadingModels(true);
      try {
        const modelList = await modelService.getModelsByBrand(make);
        if (mounted) {
          setModels(modelList);
          if (modelList.length > 0) {
            setModel(modelList[0]);
          } else {
            setModel('');
          }
        }
      } catch (err) {
        console.warn('Error loading models:', err);
      } finally {
        if (mounted) setLoadingModels(false);
      }
    }

    loadModels();
    return () => {
      mounted = false;
    };
  }, [make]);

  // Derive YouTube video ID in real-time
  useEffect(() => {
    if (youtubeUrl) {
      const vidId = extractYouTubeVideoId(youtubeUrl);
      setDerivedVideoId(vidId || '');
    } else {
      setDerivedVideoId('');
    }
  }, [youtubeUrl]);

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = brands.find((b) => b.id === e.target.value);
    if (selected) {
      setBrandId(selected.id);
      setMake(selected.name);
    }
  };

  const handleBodyTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = bodyTypes.find((t) => t.id === e.target.value);
    if (selected) {
      setTypeId(selected.id);
      setBodyType(selected.name);
    }
  };

  const preparePayload = (): DealerCarFormInput => {
    const cleanPrice = Number(price.replace(/[^0-9.]/g, '')) || 0;
    const cleanPrevPrice = previousPrice ? Number(previousPrice.replace(/[^0-9.]/g, '')) : null;
    const cleanMileage = Number(mileage.replace(/[^0-9.]/g, '')) || 0;
    const cleanHp = horsepower ? Number(horsepower.replace(/[^0-9.]/g, '')) : null;

    return {
      brand_id: brandId || undefined,
      make: make || 'Vehicle',
      model: model || 'Model',
      trim: trim.trim() || undefined,
      year: Number(year) || 2024,
      type_id: typeId || undefined,
      body_type: bodyType,
      condition,
      mileage: cleanMileage,
      fuel_type: fuelType,
      transmission,
      drive_type: driveType,
      engine: engine.trim() || undefined,
      horsepower: cleanHp,
      exterior_color: exteriorColor.trim() || 'Black',
      interior_color: interiorColor.trim() || 'Black',
      seats: Number(seats) || 5,
      doors: Number(doors) || 4,
      price: cleanPrice,
      previous_price: cleanPrevPrice,
      location: location.trim() || 'Lagos',
      state: state.trim() || 'Lagos',
      description: description.trim(),
      youtube_url: youtubeUrl.trim() || undefined,
      youtube_title: youtubeTitle.trim() || undefined,
      gallery_image_1_url: image1Url.trim() || undefined,
      gallery_image_2_url: image2Url.trim() || undefined,
    };
  };

  // Section 22: SAVE DRAFT (incomplete information allowed)
  const handleSaveDraft = async () => {
    if (!dealerAccount?.dealerId) {
      setSubmitError('Dealer identity not found. Please complete dealership onboarding.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload = preparePayload();
      const res = await dealerVehicleService.createDealerCar(payload, dealerAccount.dealerId, true);

      if (res.error) {
        setSubmitError(res.error);
        setSubmitting(false);
      } else {
        navigate('/dealer/cars');
      }
    } catch {
      setSubmitError('Failed to save vehicle draft. Please check your network and try again.');
      setSubmitting(false);
    }
  };

  // Section 21 & 23: VALIDATE AND OPEN REVIEW SUMMARY
  const handleInitiateReview = () => {
    setSubmitError(null);

    if (!make.trim()) {
      setSubmitError('Vehicle Brand is required.');
      return;
    }
    if (!model.trim()) {
      setSubmitError('Vehicle Model is required.');
      return;
    }
    if (!price.trim() || Number(price.replace(/[^0-9.]/g, '')) <= 0) {
      setSubmitError('Please enter a valid retail price (NGN).');
      return;
    }
    if (!description.trim() || description.trim().length < 20) {
      setSubmitError('Please provide a detailed vehicle description (at least 20 characters).');
      return;
    }
    if (!youtubeUrl.trim() || !derivedVideoId) {
      setSubmitError('A valid YouTube walkaround video URL is required for vehicle review submission.');
      return;
    }
    if (!image1Url.trim()) {
      setSubmitError('Image 1 (Front Exterior) is required for submission.');
      return;
    }
    if (!image2Url.trim()) {
      setSubmitError('Image 2 (Interior Cockpit) is required for submission.');
      return;
    }

    setShowReviewModal(true);
  };

  // Section 23: SUBMIT VEHICLE FOR REVIEW
  const handleConfirmSubmitForReview = async () => {
    if (!dealerAccount?.dealerId) {
      setSubmitError('Dealership authorization missing.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload = preparePayload();
      const res = await dealerVehicleService.createDealerCar(payload, dealerAccount.dealerId, false);

      if (res.error) {
        setSubmitError(res.error);
        setSubmitting(false);
        setShowReviewModal(false);
      } else {
        setShowReviewModal(false);
        navigate('/dealer/cars');
      }
    } catch {
      setSubmitError('Failed to submit vehicle for review. Please try again.');
      setSubmitting(false);
      setShowReviewModal(false);
    }
  };

  return (
    <DealerLayout currentRoute="/dealer/cars/new" navigate={navigate}>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Back Link */}
        <button
          onClick={() => navigate('/dealer/cars')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Cars</span>
        </button>

        {/* Section 12 Title & Supporting text */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#EF233C] bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
              Automotive Listing Engine
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#071A2B] tracking-tight">
            List a Vehicle
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            Present your vehicle professionally to serious buyers on MANIFOLD.
          </p>
        </div>

        {submitError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-[#EF233C] shrink-0 mt-0.5" />
            <p className="text-xs text-red-800 font-medium leading-relaxed">{submitError}</p>
          </div>
        )}

        {/* FORM CONTAINER */}
        <div className="space-y-6">
          {/* SECTION 1: VEHICLE DETAILS */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <CarFront className="w-5 h-5 text-[#EF233C]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                1. Vehicle Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Brand (Dynamic) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Brand / Make <span className="text-[#EF233C]">*</span>
                </label>
                <select
                  value={brandId}
                  onChange={handleBrandChange}
                  disabled={loadingBrands}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Model (Dynamic based on Brand) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Model <span className="text-[#EF233C]">*</span>
                </label>
                {loadingModels ? (
                  <div className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center text-xs text-gray-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Loading models...
                  </div>
                ) : models.length > 0 ? (
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                  >
                    {models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. Camry, RX350, GLE450"
                    className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                  />
                )}
              </div>

              {/* Variant / Trim */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Variant / Trim
                </label>
                <input
                  type="text"
                  value={trim}
                  onChange={(e) => setTrim(e.target.value)}
                  placeholder="e.g. Platinum, F-Sport, AMG Line"
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>

              {/* Year */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Year <span className="text-[#EF233C]">*</span>
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                >
                  {Array.from({ length: 22 }, (_, i) => 2026 - i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vehicle Type (Dynamic) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Vehicle Type <span className="text-[#EF233C]">*</span>
                </label>
                <select
                  value={typeId}
                  onChange={handleBodyTypeChange}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                >
                  {bodyTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Condition */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Condition <span className="text-[#EF233C]">*</span>
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                >
                  <option value="Foreign Used (Tokunbo)">Foreign Used (Tokunbo)</option>
                  <option value="Nigerian Used">Nigerian Used</option>
                  <option value="Brand New">Brand New</option>
                </select>
              </div>

              {/* Mileage */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Mileage (km) <span className="text-[#EF233C]">*</span>
                </label>
                <input
                  type="text"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  placeholder="e.g. 45000"
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>

              {/* Fuel Type */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Fuel Type
                </label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                >
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Electric">Electric</option>
                </select>
              </div>

              {/* Transmission */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Transmission
                </label>
                <select
                  value={transmission}
                  onChange={(e) => setTransmission(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                >
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>

              {/* Drive Type */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Drive Type
                </label>
                <select
                  value={driveType}
                  onChange={(e) => setDriveType(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                >
                  <option value="AWD">AWD (All-Wheel Drive)</option>
                  <option value="4WD">4WD (Four-Wheel Drive)</option>
                  <option value="FWD">FWD (Front-Wheel Drive)</option>
                  <option value="RWD">RWD (Rear-Wheel Drive)</option>
                </select>
              </div>

              {/* Engine */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Engine
                </label>
                <input
                  type="text"
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                  placeholder="e.g. 3.5L V6, 2.0L Turbo"
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>

              {/* Horsepower */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Horsepower (HP)
                </label>
                <input
                  type="text"
                  value={horsepower}
                  onChange={(e) => setHorsepower(e.target.value)}
                  placeholder="e.g. 295"
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>

              {/* Exterior Color */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Exterior Color <span className="text-[#EF233C]">*</span>
                </label>
                <input
                  type="text"
                  value={exteriorColor}
                  onChange={(e) => setExteriorColor(e.target.value)}
                  placeholder="e.g. Pearl White, Obsidian Black"
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>

              {/* Interior Color */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Interior Color <span className="text-[#EF233C]">*</span>
                </label>
                <input
                  type="text"
                  value={interiorColor}
                  onChange={(e) => setInteriorColor(e.target.value)}
                  placeholder="e.g. Tan Leather, Black Leather"
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>

              {/* Seats & Doors */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Seats & Doors
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={seats}
                    onChange={(e) => setSeats(Number(e.target.value))}
                    className="h-10 px-2 text-xs bg-gray-50 border border-gray-200 rounded-xl text-gray-800"
                  >
                    {[2, 4, 5, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        {s} Seats
                      </option>
                    ))}
                  </select>
                  <select
                    value={doors}
                    onChange={(e) => setDoors(Number(e.target.value))}
                    className="h-10 px-2 text-xs bg-gray-50 border border-gray-200 rounded-xl text-gray-800"
                  >
                    {[2, 4, 5].map((d) => (
                      <option key={d} value={d}>
                        {d} Doors
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: PRICING (Section 14) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <DollarSign className="w-5 h-5 text-[#EF233C]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                2. Pricing
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Price (NGN) <span className="text-[#EF233C]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-bold text-gray-500">
                    ₦
                  </span>
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="45,000,000"
                    required
                    className="w-full h-10 pl-8 pr-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 focus:outline-none focus:border-[#EF233C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Previous Price <span className="text-gray-400 font-normal lowercase">(optional for price drops)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-bold text-gray-500">
                    ₦
                  </span>
                  <input
                    type="text"
                    value={previousPrice}
                    onChange={(e) => setPreviousPrice(e.target.value)}
                    placeholder="48,000,000"
                    className="w-full h-10 pl-8 pr-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-600 focus:outline-none focus:border-[#EF233C]"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Enter competitive market pricing for the Nigerian audience. Note: Dealership commissions and agreements are managed privately by MANIFOLD upon verified transaction closure.
              </p>
            </div>
          </div>

          {/* SECTION 3: LOCATION (Section 15) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <MapPin className="w-5 h-5 text-[#EF233C]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                3. Vehicle Location
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Location / Area <span className="text-[#EF233C]">*</span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Lekki Phase 1, Victoria Island, Ikeja GRA"
                  required
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  State <span className="text-[#EF233C]">*</span>
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                >
                  <option value="Lagos">Lagos</option>
                  <option value="Abuja (FCT)">Abuja (FCT)</option>
                  <option value="Rivers">Rivers (Port Harcourt)</option>
                  <option value="Oyo">Oyo (Ibadan)</option>
                  <option value="Edo">Edo (Benin City)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 4: DESCRIPTION (Section 16) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <FileText className="w-5 h-5 text-[#EF233C]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                4. Vehicle Description
              </h2>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Detailed Vehicle Description <span className="text-[#EF233C]">*</span>
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the vehicle accurately. Mention notable features, condition, service history and anything a serious buyer should know."
                className="w-full p-3.5 text-xs bg-gray-50 border border-gray-200 rounded-xl font-normal text-gray-800 focus:outline-none focus:border-[#EF233C] leading-relaxed"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Mention key packages, panoramic roof, duty papers status, accident-free history, etc.
              </p>
            </div>
          </div>

          {/* SECTION 5: VIDEO-FIRST LISTING (Section 17) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Video className="w-5 h-5 text-[#EF233C]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                5. Vehicle Video (Video-First)
              </h2>
            </div>

            <p className="text-xs text-gray-500">
              MANIFOLD is a video-first platform. Every car featured prominently on the homepage and detail view requires a dedicated walkaround video.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  YouTube Video URL <span className="text-[#EF233C]">*</span>
                </label>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Video Review Title <span className="text-gray-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  value={youtubeTitle}
                  onChange={(e) => setYoutubeTitle(e.target.value)}
                  placeholder="e.g. Full Walkaround & Engine Sound Review"
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>
            </div>

            {/* Video Preview */}
            {derivedVideoId ? (
              <div className="p-4 rounded-2xl bg-[#071A2B] text-white space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#EF233C]">
                  Live Video Preview (ID: {derivedVideoId})
                </span>
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black max-w-md mx-auto">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${derivedVideoId}`}
                    title="YouTube video preview"
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-center text-xs text-gray-400">
                Enter a YouTube link above to preview video embed.
              </div>
            )}
          </div>

          {/* SECTION 6: TWO IMAGE GALLERY (Section 18) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#EF233C]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                  6. Two Image Gallery
                </h2>
              </div>
              <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-red-100 text-[#EF233C]">
                2 Images Maximum
              </span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              In accordance with MANIFOLD's video-first design philosophy, exactly two static images are featured: Image 1 for the front exterior signature card, and Image 2 for the cockpit / cabin.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Image 1: Exterior */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Image 1 (Front Exterior) <span className="text-[#EF233C]">*</span>
                </label>
                <input
                  type="url"
                  value={image1Url}
                  onChange={(e) => setImage1Url(e.target.value)}
                  placeholder="https://images.unsplash.com/... or hosted image URL"
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
                {image1Url ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group">
                    <img
                      src={image1Url}
                      alt="Gallery Preview 1"
                      className="w-full h-full object-cover"
                      onError={() => setSubmitError('Image 1 URL failed to load. Please verify link.')}
                    />
                    <button
                      type="button"
                      onClick={() => setImage1Url('')}
                      className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black text-white rounded-lg transition"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="aspect-video rounded-xl bg-gray-50 border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                    <ImageIcon className="w-6 h-6 mb-1" />
                    <span className="text-[11px]">Primary exterior photo preview</span>
                  </div>
                )}
              </div>

              {/* Image 2: Interior */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Image 2 (Cabin / Cockpit) <span className="text-[#EF233C]">*</span>
                </label>
                <input
                  type="url"
                  value={image2Url}
                  onChange={(e) => setImage2Url(e.target.value)}
                  placeholder="https://images.unsplash.com/... or hosted image URL"
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
                {image2Url ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group">
                    <img
                      src={image2Url}
                      alt="Gallery Preview 2"
                      className="w-full h-full object-cover"
                      onError={() => setSubmitError('Image 2 URL failed to load. Please verify link.')}
                    />
                    <button
                      type="button"
                      onClick={() => setImage2Url('')}
                      className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black text-white rounded-lg transition"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="aspect-video rounded-xl bg-gray-50 border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                    <ImageIcon className="w-6 h-6 mb-1" />
                    <span className="text-[11px]">Cockpit / interior photo preview</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ACTIONS: SAVE DRAFT vs SUBMIT FOR REVIEW (Sections 22 & 23) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold uppercase text-gray-900 tracking-wider">
                Submission Options
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Drafts remain private to your dealership. Submitting sends the vehicle into the MANIFOLD inspection queue.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={submitting}
                className="flex-1 sm:flex-initial px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-gray-600" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={handleInitiateReview}
                disabled={submitting}
                className="flex-1 sm:flex-initial px-6 py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Submit Vehicle for Review</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 23: REVIEW SUMMARY MODAL */}
      {/* ============================================================ */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowReviewModal(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#EF233C] bg-red-100 px-2.5 py-0.5 rounded-full">
                Review Summary
              </span>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-1">
              Ready to submit vehicle?
            </h3>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              Please verify your listing details before submitting to the MANIFOLD dealer desk.
            </p>

            <div className="space-y-3 p-4 rounded-2xl bg-gray-50 border border-gray-100 text-xs mb-6">
              <div className="flex justify-between pb-2 border-b border-gray-200">
                <span className="text-gray-500">Vehicle:</span>
                <strong className="text-gray-900">{year} {make} {model} {trim}</strong>
              </div>
              <div className="flex justify-between pb-2 border-b border-gray-200">
                <span className="text-gray-500">Price:</span>
                <strong className="text-emerald-700">₦{Number(price.replace(/[^0-9.]/g, '')).toLocaleString()}</strong>
              </div>
              <div className="flex justify-between pb-2 border-b border-gray-200">
                <span className="text-gray-500">Condition & Mileage:</span>
                <strong className="text-gray-900">{condition} · {mileage} km</strong>
              </div>
              <div className="flex justify-between pb-2 border-b border-gray-200">
                <span className="text-gray-500">Location:</span>
                <strong className="text-gray-900">{location}, {state}</strong>
              </div>
              <div className="flex justify-between pb-2 border-b border-gray-200">
                <span className="text-gray-500">YouTube Video:</span>
                <strong className="text-gray-900 truncate max-w-[200px]">{youtubeUrl}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Static Images:</span>
                <strong className="text-gray-900">2 Gallery Photos Attached</strong>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase rounded-xl transition"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmitForReview}
                disabled={submitting}
                className="flex-1 py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Confirm & Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DealerLayout>
  );
};
