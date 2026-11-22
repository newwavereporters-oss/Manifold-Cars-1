import React, { useState, useEffect, useRef } from 'react';
import { DealerLayout } from '../../components/dealer/DealerLayout';
import { useDealerAuth } from '../../context/DealerAuthContext';
import {
  dealerVehicleService,
  DealerCarFormInput,
  DealerCarRecord,
} from '../../services/dealerVehicleService';
import { brandService } from '../../services/brandService';
import { modelService } from '../../services/modelService';
import { categoryService } from '../../services/categoryService';
import { carService } from '../../services/carService';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from '../../utils/youtube';
import { buildVehicleModelTitle, normalizeVehicleCondition } from '../../utils/carMedia';
import { DealerVideoMarketingNotice } from '../../components/dealer/DealerVideoMarketingNotice';
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
  ArrowLeft,
  X,
  Info,
  ShieldAlert,
  TrendingUp,
  Lock,
} from 'lucide-react';
import { CarBrand, BodyTypeCategory } from '../../types';
import { commissionService, CommissionCalculationResult } from '../../services/commissionService';
import { resolveDealerApprovalState } from '../../services/dealerOnboardingService';
import { PriceIntelligenceCard } from '../../components/ai/PriceIntelligenceCard';
import { DealerListingAiPanel } from '../../components/ai/DealerListingAiPanel';

interface DealerEditCarPageProps {
  carId: string;
  navigate: (route: string) => void;
}

export const DealerEditCarPage: React.FC<DealerEditCarPageProps> = ({ carId, navigate }) => {
  const { dealerAccount } = useDealerAuth();
  const resolvedApproval = resolveDealerApprovalState(
    dealerAccount?.accountStatus,
    dealerAccount?.isVerified,
    dealerAccount?.dealerStatus
  );
  const approvalStatus = dealerAccount?.approvalStatus ?? resolvedApproval.approvalStatus;
  const currentDealerStatus = dealerAccount?.dealerStatus ?? resolvedApproval.dealerStatus;
  const isApproved =
    currentDealerStatus === 'approved' && (dealerAccount?.isApproved ?? resolvedApproval.isApproved);

  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [originalCar, setOriginalCar] = useState<DealerCarRecord | null>(null);

  // Dynamic Options
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [bodyTypes, setBodyTypes] = useState<BodyTypeCategory[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [typesError, setTypesError] = useState<string | null>(null);
  const modelRequestSeqRef = React.useRef(0);

  // Form State
  const [brandId, setBrandId] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [trim, setTrim] = useState('');
  const [year, setYear] = useState<number>(2021);
  const [typeId, setTypeId] = useState('');
  const [bodyType, setBodyType] = useState('');
  const [condition, setCondition] = useState('Foreign Used');
  const [mileage, setMileage] = useState<string>('0');
  const [fuelType, setFuelType] = useState('Petrol');
  const [transmission, setTransmission] = useState('Automatic');
  const [driveType, setDriveType] = useState('AWD');
  const [engine, setEngine] = useState('');
  const [horsepower, setHorsepower] = useState('');
  const [exteriorColor, setExteriorColor] = useState('Metallic Black');
  const [interiorColor, setInteriorColor] = useState('Black Leather');
  const [seats, setSeats] = useState(5);
  const [doors, setDoors] = useState(4);

  // Pricing
  const [price, setPrice] = useState('');
  const [previousPrice, setPreviousPrice] = useState('');

  // Location
  const [location, setLocation] = useState('Lagos');
  const [state, setState] = useState('Lagos');

  // Description
  const [description, setDescription] = useState('');

  // Video-First (YouTube)
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [derivedVideoId, setDerivedVideoId] = useState('');

  // Two Image Gallery
  const [image1Url, setImage1Url] = useState('');
  const [image2Url, setImage2Url] = useState('');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [priceCalc, setPriceCalc] = useState<CommissionCalculationResult | null>(null);
  const submitLockRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const cleanNum = Number(price.replace(/[^0-9.]/g, '')) || 0;
    if (cleanNum > 0) {
      commissionService.calculateCommission(cleanNum).then((res) => {
        if (mounted) setPriceCalc(res);
      });
    } else {
      setPriceCalc(null);
    }
    return () => {
      mounted = false;
    };
  }, [price]);

  const reloadDropdownOptions = React.useCallback(
    async (carFallback?: DealerCarRecord | null) => {
      setLoadingBrands(true);
      setLoadingTypes(true);
      setBrandsError(null);
      setTypesError(null);

      const [brandsResult, typesResult] = await Promise.allSettled([
        brandService.getActiveBrands(),
        categoryService.getActiveBodyTypes(),
      ]);

      const refCar = carFallback ?? originalCar;

      if (brandsResult.status === 'fulfilled') {
        const activeBrands = brandsResult.value;
        setBrands(activeBrands);
        if (refCar) {
          const matchedBrand =
            (refCar.brand_id ? activeBrands.find((br) => br.id === refCar.brand_id) : undefined) ||
            activeBrands.find((br) => br.name.toLowerCase() === refCar.make.toLowerCase());
          if (matchedBrand) {
            setBrandId(matchedBrand.id);
            setMake(matchedBrand.name);
          } else if (refCar.brand_id) {
            setBrandId(refCar.brand_id);
          }
        }
      } else {
        console.error('[DealerEditCarPage] Brand / Make load failed:', brandsResult.reason);
        setBrands([]);
        setBrandsError('Unable to load vehicle brands. Please retry.');
      }
      setLoadingBrands(false);

      if (typesResult.status === 'fulfilled') {
        const activeTypes = typesResult.value;
        setBodyTypes(activeTypes);
        if (refCar) {
          const matchedType =
            (refCar.type_id ? activeTypes.find((ty) => ty.id === refCar.type_id) : undefined) ||
            activeTypes.find((ty) => ty.name.toLowerCase() === refCar.body_type.toLowerCase());
          if (matchedType) {
            setTypeId(matchedType.id);
            setBodyType(matchedType.name);
          } else if (refCar.type_id) {
            setTypeId(refCar.type_id);
          }
        }
      } else {
        console.error('[DealerEditCarPage] Vehicle Type load failed:', typesResult.reason);
        setBodyTypes([]);
        setTypesError('Unable to load vehicle types. Please retry.');
      }
      setLoadingTypes(false);
    },
    [originalCar]
  );

  // Load car and options independently
  useEffect(() => {
    let mounted = true;
    async function loadCarAndMetadata() {
      if (!dealerAccount?.dealerId) return;

      setLoading(true);
      setLoadingBrands(true);
      setLoadingTypes(true);
      setBrandsError(null);
      setTypesError(null);

      try {
        const [carResult, brandsResult, typesResult] = await Promise.allSettled([
          dealerVehicleService.getDealerCarById(carId, dealerAccount.dealerId),
          brandService.getActiveBrands(),
          categoryService.getActiveBodyTypes(),
        ]);

        if (!mounted) return;

        const car = carResult.status === 'fulfilled' ? carResult.value : null;
        if (carResult.status === 'rejected') {
          console.error('[DealerEditCarPage] Failed to load vehicle record:', carResult.reason);
        }

        if (!car) {
          setUnauthorized(true);
          setLoading(false);
          setLoadingBrands(false);
          setLoadingTypes(false);
          return;
        }

        setOriginalCar(car);

        // Prepopulate form fields
        setBrandId(car.brand_id || '');
        setMake(car.make);
        setModel(car.model);
        setTrim(car.trim || '');
        setYear(car.year);
        setTypeId(car.type_id || '');
        setBodyType(car.body_type);
        setCondition(normalizeVehicleCondition(car.condition));
        setMileage(String(car.mileage));
        setFuelType(car.fuel_type);
        setTransmission(car.transmission);
        setDriveType(car.drive_type);
        setEngine(car.engine || '');
        setHorsepower(car.horsepower ? String(car.horsepower) : '');
        setExteriorColor(car.exterior_color);
        setInteriorColor(car.interior_color);
        setSeats(car.seats || 5);
        setDoors(car.doors || 4);
        setPrice(car.price ? car.price.toLocaleString() : '');
        setPreviousPrice(car.previous_price ? car.previous_price.toLocaleString() : '');
        setLocation(car.location);
        setState(car.state);
        setDescription(car.description);
        setYoutubeUrl(car.youtube_url || '');
        setImage1Url(car.gallery_image_1_url || '');
        setImage2Url(car.gallery_image_2_url || '');

        let resolvedBrandId = car.brand_id || '';
        if (brandsResult.status === 'fulfilled') {
          const activeBrands = brandsResult.value;
          setBrands(activeBrands);
          const matchedBrand =
            (car.brand_id ? activeBrands.find((br) => br.id === car.brand_id) : undefined) ||
            activeBrands.find((br) => br.name.toLowerCase() === car.make.toLowerCase());
          if (matchedBrand) {
            setBrandId(matchedBrand.id);
            setMake(matchedBrand.name);
            resolvedBrandId = matchedBrand.id;
          }
        } else {
          console.error('[DealerEditCarPage] Brand / Make load failed:', brandsResult.reason);
          setBrands([]);
          setBrandsError('Unable to load vehicle brands. Please retry.');
        }
        setLoadingBrands(false);

        if (typesResult.status === 'fulfilled') {
          const activeTypes = typesResult.value;
          setBodyTypes(activeTypes);
          const matchedType =
            (car.type_id ? activeTypes.find((ty) => ty.id === car.type_id) : undefined) ||
            activeTypes.find((ty) => ty.name.toLowerCase() === car.body_type.toLowerCase());
          if (matchedType) {
            setTypeId(matchedType.id);
            setBodyType(matchedType.name);
          }
        } else {
          console.error('[DealerEditCarPage] Vehicle Type load failed:', typesResult.reason);
          setBodyTypes([]);
          setTypesError('Unable to load vehicle types. Please retry.');
        }
        setLoadingTypes(false);

        setLoading(false);

        // Load models for this make
        setLoadingModels(true);
        const modelList = await modelService.getModelsByBrand(car.make, resolvedBrandId || undefined);
        if (mounted) {
          setModels(modelList);
          setLoadingModels(false);
        }
      } catch (e) {
        console.error('[DealerEditCarPage] Unexpected error loading vehicle for editing:', e);
        if (mounted) {
          setUnauthorized(true);
          setLoading(false);
          setLoadingBrands(false);
          setLoadingTypes(false);
          setLoadingModels(false);
        }
      }
    }

    loadCarAndMetadata();
    return () => {
      mounted = false;
    };
  }, [carId, dealerAccount?.dealerId]);

  // Derive YouTube video ID in real-time
  useEffect(() => {
    if (youtubeUrl) {
      const vidId = extractYouTubeVideoId(youtubeUrl);
      setDerivedVideoId(vidId || '');
    } else {
      setDerivedVideoId('');
    }
  }, [youtubeUrl]);

  const handleBrandChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const seq = ++modelRequestSeqRef.current;

    // Clear dependent model selection immediately
    setModels([]);
    setModel('');

    if (!selectedId) {
      setBrandId('');
      setMake('');
      setLoadingModels(false);
      return;
    }

    const selected = brands.find((b) => b.id === selectedId);
    if (!selected) {
      if (selectedId.startsWith('__legacy__:')) {
        setBrandId('');
        setMake(selectedId.slice('__legacy__:'.length));
      }
      return;
    }

    setBrandId(selected.id);
    setMake(selected.name);
    setLoadingModels(true);

    try {
      const modelList = await modelService.getModelsByBrand(selected.name, selected.id);
      if (modelRequestSeqRef.current !== seq) return;
      setModels(modelList);
      setModel(modelList.length > 0 ? modelList[0] : '');
    } catch (err) {
      console.error('[DealerEditCarPage] Error loading models on brand change:', err);
      if (modelRequestSeqRef.current === seq) {
        setModels([]);
        setModel('');
      }
    } finally {
      if (modelRequestSeqRef.current === seq) {
        setLoadingModels(false);
      }
    }
  };

  const handleBodyTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      setTypeId('');
      setBodyType('');
      return;
    }
    if (selectedId.startsWith('__legacy__:')) {
      setTypeId('');
      setBodyType(selectedId.slice('__legacy__:'.length));
      return;
    }
    const found = bodyTypes.find((t) => t.id === selectedId);
    if (found) {
      setTypeId(found.id);
      setBodyType(found.name);
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
      condition: normalizeVehicleCondition(condition),
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

  const handleSave = async (isDraft: boolean) => {
    if (submitLockRef.current) return;
    if (!dealerAccount?.dealerId) return;

    if (!isDraft && !isApproved) {
      setSubmitError(
        'Your dealership account must be approved by an administrator before publishing vehicles.'
      );
      return;
    }

    if (!isDraft) {
      if (!make.trim()) {
        setSubmitError('Please select a Vehicle Brand / Make.');
        return;
      }
      if (!model.trim()) {
        setSubmitError('Please select or enter a Vehicle Model.');
        return;
      }
      if (!bodyType.trim()) {
        setSubmitError('Please select a Vehicle Type.');
        return;
      }
      if (!price.trim() || Number(price.replace(/[^0-9.]/g, '')) <= 0) {
        setSubmitError('Please specify a valid vehicle price.');
        return;
      }
      if (youtubeUrl.trim() && !derivedVideoId) {
        setSubmitError('The YouTube URL entered is invalid. Clear the field or provide a valid YouTube link.');
        return;
      }
      if (!image1Url.trim() && !image2Url.trim()) {
        setSubmitError('Please provide at least one vehicle photo before publishing.');
        return;
      }
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload = preparePayload();
      const res = await dealerVehicleService.updateDealerCar(carId, payload, dealerAccount.dealerId, isDraft);

      if (res.error || !res.car?.id) {
        setSubmitError(res.error || 'Unable to save vehicle changes. Please try again.');
      } else {
        if (!isDraft) {
          void carService.getCars().catch(() => {});
        }
        const params = new URLSearchParams({
          updated: res.car.id,
          status: res.car.status,
          title: res.car.title,
        });
        if (res.partialMediaError) {
          params.set('mediaWarning', res.partialMediaError);
        }
        navigate(`/dealer/cars?${params.toString()}`);
      }
    } catch (err) {
      console.error('[DealerEditCarPage] Update vehicle exception:', err);
      setSubmitError('Failed to update vehicle. Please try again.');
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DealerLayout currentRoute="/dealer/cars/:id/edit" navigate={navigate}>
        <div className="py-20 text-center text-xs text-gray-400">Loading vehicle details...</div>
      </DealerLayout>
    );
  }

  if (unauthorized) {
    return (
      <DealerLayout currentRoute="/dealer/cars/:id/edit" navigate={navigate}>
        <div className="max-w-md mx-auto py-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-[#EF233C] flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Vehicle Not Accessible</h2>
          <p className="text-xs text-gray-500">
            This vehicle either does not exist or does not belong to your authenticated dealership.
          </p>
          <button
            onClick={() => navigate('/dealer/cars')}
            className="px-4 py-2 bg-[#071A2B] text-white text-xs font-bold uppercase rounded-xl"
          >
            Back to My Cars
          </button>
        </div>
      </DealerLayout>
    );
  }

  return (
    <DealerLayout currentRoute="/dealer/cars/:id/edit" navigate={navigate}>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Back Link */}
        <button
          onClick={() => navigate('/dealer/cars')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Cars</span>
        </button>

        {/* Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#EF233C] bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                Listing Editor
              </span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Current Status: {originalCar?.status}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#071A2B] tracking-tight">
              Edit: {buildVehicleModelTitle(originalCar?.make, originalCar?.model) || originalCar?.title}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Modify permitted vehicle specifications, update pricing, or refresh video walkarounds.
            </p>
          </div>
        </div>

        {!isApproved && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 leading-relaxed">
              <p className="font-bold">
                {approvalStatus === 'disapproved'
                  ? 'Dealership Account Disapproved for Listing'
                  : 'Dealership Account Pending Admin Approval'}
              </p>
              <p className="mt-0.5">
                You can update draft notes on existing listings, but publishing vehicles is disabled until Admin approves your dealership account.
              </p>
            </div>
          </div>
        )}

        {submitError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#EF233C] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-red-800 font-semibold leading-relaxed">{submitError}</p>
            </div>
          </div>
        )}

        {/* FORM BLOCKS */}
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
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Brand / Make <span className="text-[#EF233C]">*</span>
                </label>
                <select
                  aria-label="Brand / Make"
                  value={brandId || (make ? `__legacy__:${make}` : '')}
                  onChange={handleBrandChange}
                  disabled={loadingBrands}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C] disabled:opacity-60"
                >
                  <option value="">
                    {loadingBrands
                      ? 'Loading brands...'
                      : brandsError
                      ? 'Failed to load brands'
                      : brands.length === 0
                      ? 'No active brands available'
                      : 'Select Brand / Make'}
                  </option>
                  {make && !brands.some((b) => b.id === brandId || b.name.toLowerCase() === make.toLowerCase()) && (
                    <option value={`__legacy__:${make}`}>{make}</option>
                  )}
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {brandsError && (
                  <p className="mt-1 text-[11px] text-[#EF233C] flex items-center justify-between gap-2">
                    <span className="truncate">{brandsError}</span>
                    <button
                      type="button"
                      onClick={() => reloadDropdownOptions()}
                      className="font-bold underline shrink-0"
                    >
                      Retry
                    </button>
                  </p>
                )}
              </div>

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
                    aria-label="Model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                  >
                    <option value="">Select Model</option>
                    {model && !models.includes(model) && (
                      <option value={model}>{model}</option>
                    )}
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

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Variant / Trim
                </label>
                <input
                  type="text"
                  value={trim}
                  onChange={(e) => setTrim(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Year
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

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Vehicle Type <span className="text-[#EF233C]">*</span>
                </label>
                <select
                  aria-label="Vehicle Type"
                  value={typeId || (bodyType ? `__legacy__:${bodyType}` : '')}
                  onChange={handleBodyTypeChange}
                  disabled={loadingTypes}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C] disabled:opacity-60"
                >
                  <option value="">
                    {loadingTypes
                      ? 'Loading vehicle types...'
                      : typesError
                      ? 'Failed to load vehicle types'
                      : bodyTypes.length === 0
                      ? 'No active vehicle types available'
                      : 'Select Vehicle Type'}
                  </option>
                  {bodyType &&
                    !bodyTypes.some((t) => t.id === typeId || t.name.toLowerCase() === bodyType.toLowerCase()) && (
                      <option value={`__legacy__:${bodyType}`}>{bodyType}</option>
                    )}
                  {bodyTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {typesError && (
                  <p className="mt-1 text-[11px] text-[#EF233C] flex items-center justify-between gap-2">
                    <span className="truncate">{typesError}</span>
                    <button
                      type="button"
                      onClick={() => reloadDropdownOptions()}
                      className="font-bold underline shrink-0"
                    >
                      Retry
                    </button>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                >
                  <option value="Foreign Used">Foreign Used (Tokunbo)</option>
                  <option value="Nigerian Used">Nigerian Used</option>
                  <option value="Brand New">Brand New</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Mileage (km)
                </label>
                <input
                  type="text"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>

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

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Engine
                </label>
                <input
                  type="text"
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Horsepower (HP)
                </label>
                <input
                  type="text"
                  value={horsepower}
                  onChange={(e) => setHorsepower(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Exterior Color
                </label>
                <input
                  type="text"
                  value={exteriorColor}
                  onChange={(e) => setExteriorColor(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Interior Color
                </label>
                <input
                  type="text"
                  value={interiorColor}
                  onChange={(e) => setInteriorColor(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: PRICING */}
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
                    required
                    className="w-full h-10 pl-8 pr-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 focus:outline-none focus:border-[#EF233C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Previous Price (NGN)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-bold text-gray-500">
                    ₦
                  </span>
                  <input
                    type="text"
                    value={previousPrice}
                    onChange={(e) => setPreviousPrice(e.target.value)}
                    className="w-full h-10 pl-8 pr-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-600 focus:outline-none focus:border-[#EF233C]"
                  />
                </div>
              </div>
            </div>

            {/* DEALER PRICING INTELLIGENCE LIVE PREVIEW */}
            {priceCalc && priceCalc.applicable && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-red-50/70 to-slate-50 border border-red-100 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-[#EF233C]" />
                    <span className="text-xs font-bold text-gray-900 font-display">
                      Pricing Intelligence · {priceCalc.ruleName || 'Commission Tier'}
                    </span>
                  </div>
                  <span className="text-[11px] font-extrabold text-[#EF233C] bg-red-100/70 border border-red-200 px-2.5 py-0.5 rounded-full">
                    {priceCalc.commissionPercentage}% Success Fee
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200/60 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">
                      Estimated MANIFOLD Fee
                    </span>
                    <span className="font-extrabold text-gray-800 text-sm">
                      ₦{priceCalc.estimatedCommission.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">
                      Estimated Dealership Net Proceeds
                    </span>
                    <span className="font-extrabold text-emerald-600 text-sm">
                      ₦{priceCalc.estimatedDealerProceeds.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <PriceIntelligenceCard
              mode="dealer"
              carId={carId}
              make={make}
              model={model}
              year={year}
              trim={trim}
              condition={condition}
              mileage={Number(mileage.replace(/[^0-9.]/g, '')) || undefined}
              location={location}
              askingPrice={Number(price.replace(/[^0-9.]/g, '')) || undefined}
            />
          </div>

          {/* SECTION 3: LOCATION */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <MapPin className="w-5 h-5 text-[#EF233C]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                3. Location
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Location / Area
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  State
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                >
                  <option value="Lagos">Lagos</option>
                  <option value="Abuja (FCT)">Abuja (FCT)</option>
                  <option value="Rivers">Rivers</option>
                  <option value="Oyo">Oyo</option>
                  <option value="Edo">Edo</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 4: DESCRIPTION */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <FileText className="w-5 h-5 text-[#EF233C]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                4. Description
              </h2>
            </div>

            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3.5 text-xs bg-gray-50 border border-gray-200 rounded-xl font-normal text-gray-800 focus:outline-none focus:border-[#EF233C] leading-relaxed"
            />

            <DealerListingAiPanel
              carId={carId}
              make={make}
              model={model}
              trim={trim}
              year={year}
              bodyType={bodyType}
              condition={condition}
              mileage={Number(mileage.replace(/[^0-9.]/g, '')) || undefined}
              transmission={transmission}
              fuelType={fuelType}
              driveType={driveType}
              engine={engine}
              horsepower={horsepower ? Number(horsepower.replace(/[^0-9.]/g, '')) || null : null}
              exteriorColor={exteriorColor}
              interiorColor={interiorColor}
              seats={seats}
              doors={doors}
              price={Number(price.replace(/[^0-9.]/g, '')) || undefined}
              previousPrice={previousPrice ? Number(previousPrice.replace(/[^0-9.]/g, '')) || null : null}
              location={location}
              state={state}
              currentDescription={description}
              onApplyDescription={setDescription}
            />
          </div>

          {/* SECTION 5: VIDEO-FIRST (OPTIONAL) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-[#EF233C]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                  5. Video Review <span className="text-gray-400 font-normal normal-case">(Optional — attach or update anytime)</span>
                </h2>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded">
                Optional
              </span>
            </div>

            <DealerVideoMarketingNotice compact />

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                YouTube Video URL <span className="text-gray-400 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... (optional)"
                className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
              />
            </div>

            {derivedVideoId ? (
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black max-w-md mx-auto">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${derivedVideoId}`}
                  title="YouTube video preview"
                  className="w-full h-full border-0"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-center text-xs text-gray-500">
                No YouTube video linked yet. Buyers see a clean <strong>&ldquo;Video loading...&rdquo;</strong> status until you paste a video link here.
              </div>
            )}
          </div>

          {/* SECTION 6: TWO IMAGE GALLERY */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#EF233C]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                  6. Two Image Gallery (2 Max)
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Image 1 */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Image 1 (Front Exterior)
                </label>
                <input
                  type="url"
                  value={image1Url}
                  onChange={(e) => setImage1Url(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
                {image1Url && (
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                    <img src={image1Url} alt="Image 1" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImage1Url('')}
                      className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Image 2 */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Image 2 (Cabin / Cockpit)
                </label>
                <input
                  type="url"
                  value={image2Url}
                  onChange={(e) => setImage2Url(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                />
                {image2Url && (
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                    <img src={image2Url} alt="Image 2" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImage2Url('')}
                      className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500">
              Save Changes keeps drafts private. Publish Vehicle makes your listing live on MANIFOLD immediately.
            </p>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={submitting}
                className="flex-1 sm:flex-initial px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold uppercase rounded-xl transition flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </button>

              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={submitting || !isApproved}
                title={!isApproved ? 'Admin approval required before publishing' : undefined}
                className="flex-1 sm:flex-initial px-6 py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : !isApproved ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{isApproved ? 'Publish Vehicle' : 'Approval Required'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DealerLayout>
  );
};
