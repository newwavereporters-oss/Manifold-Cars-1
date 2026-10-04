import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Save,
  X,
  Sparkles,
  Loader2,
  Info,
} from 'lucide-react';
import { Car, ListingStatus } from '../../types';
import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  isValidYouTubeUrl,
  formatStandardYouTubeUrl,
} from '../../utils/youtube';
import { brandService } from '../../services/brandService';
import { modelService } from '../../services/modelService';
import { categoryService } from '../../services/categoryService';

export interface CarFormProps {
  initialCar?: Partial<Car>;
  isEditMode?: boolean;
  onSave: (carData: Partial<Car>) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

export const CarForm: React.FC<CarFormProps> = ({
  initialCar,
  isEditMode = false,
  onSave,
  onCancel,
  isSaving = false,
}) => {
  // Basic Information State
  const [title, setTitle] = useState(initialCar?.title || '');
  const [make, setMake] = useState(initialCar?.make || 'Toyota');
  const [model, setModel] = useState(initialCar?.model || 'Highlander');
  const [trim, setTrim] = useState(initialCar?.trim || 'XLE AWD');
  const [year, setYear] = useState<number>(initialCar?.year || 2022);
  const [price, setPrice] = useState<string>(initialCar?.price ? String(initialCar.price) : '');
  const [originalPrice, setOriginalPrice] = useState<string>(
    initialCar?.original_price ? String(initialCar.original_price) : ''
  );
  const [mileage, setMileage] = useState<string>(
    initialCar?.mileage ? String(initialCar.mileage) : '32000'
  );
  const [condition, setCondition] = useState<Car['condition']>(
    initialCar?.condition || 'Foreign Used'
  );
  const [bodyType, setBodyType] = useState<Car['body_type']>(
    initialCar?.body_type || 'SUV'
  );
  const [fuelType, setFuelType] = useState<Car['fuel_type']>(
    initialCar?.fuel_type || 'Petrol'
  );
  const [transmission, setTransmission] = useState<Car['transmission']>(
    initialCar?.transmission || 'Automatic'
  );
  const [driveType, setDriveType] = useState<Car['drive_type']>(
    initialCar?.drive_type || 'AWD'
  );
  const [engine, setEngine] = useState(initialCar?.engine || '3.5L V6');
  const [exteriorColor, setExteriorColor] = useState(initialCar?.exterior_color || 'Metallic Black');
  const [interiorColor, setInteriorColor] = useState(initialCar?.interior_color || 'Black Leather');
  const [seats, setSeats] = useState<number>(initialCar?.seats || 5);
  const [doors, setDoors] = useState<number>(initialCar?.doors || 4);
  const [location, setLocation] = useState(initialCar?.location || 'Lekki Phase 1, Lagos');
  const [state, setState] = useState(initialCar?.state || 'Lagos');
  const [description, setDescription] = useState(initialCar?.description || '');
  const [status, setStatus] = useState<ListingStatus>(initialCar?.status || 'DRAFT');
  const [isFeatured, setIsFeatured] = useState<boolean>(!!initialCar?.is_featured);
  const [isVerified, setIsVerified] = useState<boolean>(
    initialCar?.verification?.is_verified ?? true
  );
  const [inspectionScore, setInspectionScore] = useState<number>(
    initialCar?.verification?.inspection_score || 96
  );
  const [dealerName, setDealerName] = useState(
    initialCar?.dealer?.name || 'Prestige Motors Lekki'
  );

  // Media State
  const [youtubeUrl, setYoutubeUrl] = useState(initialCar?.video?.youtube_url || '');
  const [videoTitle, setVideoTitle] = useState(
    initialCar?.video?.video_title || ''
  );
  const [videoDuration, setVideoDuration] = useState(
    initialCar?.video?.video_duration || '12:30'
  );
  const [videoPresenter, setVideoPresenter] = useState(
    initialCar?.video?.presenter_name || 'MANIFOLD Presenter'
  );
  const [galleryImage1Url, setGalleryImage1Url] = useState(
    initialCar?.gallery_image_1_url || ''
  );
  const [galleryImage2Url, setGalleryImage2Url] = useState(
    initialCar?.gallery_image_2_url || ''
  );

  // Derived YouTube state
  const [detectedVideoId, setDetectedVideoId] = useState<string | null>(null);
  const [youtubeThumbnail, setYoutubeThumbnail] = useState<string>('');
  const [isVideoValid, setIsVideoValid] = useState<boolean>(false);
  const [youtubeInputTouched, setYoutubeInputTouched] = useState<boolean>(false);

  // Gallery error states
  const [img1Error, setImg1Error] = useState(false);
  const [img2Error, setImg2Error] = useState(false);

  // Form Validation & Feedback
  const [validationError, setValidationError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isInitialMount = useRef(true);

  // Popular Models for current brand
  const [popularModels, setPopularModels] = useState<string[]>([]);
  const brands = brandService.getBrandsSync();
  const bodyTypes = categoryService.getBodyTypesSync();

  // Load models on make change
  useEffect(() => {
    modelService.getModelsByBrand(make).then(setPopularModels);
  }, [make]);

  // YouTube URL parsing effect
  useEffect(() => {
    if (!youtubeUrl.trim()) {
      setDetectedVideoId(null);
      setYoutubeThumbnail('');
      setIsVideoValid(false);
      return;
    }

    const id = extractYouTubeVideoId(youtubeUrl);
    if (id) {
      setDetectedVideoId(id);
      setYoutubeThumbnail(getYouTubeThumbnailUrl(id, 'maxres'));
      setIsVideoValid(true);
      if (!videoTitle && title) {
        setVideoTitle(`${title} MANIFOLD Walkaround & Inspection Review`);
      }
    } else {
      setDetectedVideoId(null);
      setYoutubeThumbnail('');
      setIsVideoValid(false);
    }
  }, [youtubeUrl, title, videoTitle]);

  // Track unsaved changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setHasUnsavedChanges(true);
  }, [
    title,
    make,
    model,
    trim,
    year,
    price,
    originalPrice,
    mileage,
    condition,
    bodyType,
    fuelType,
    transmission,
    driveType,
    engine,
    exteriorColor,
    interiorColor,
    seats,
    doors,
    location,
    state,
    description,
    status,
    isFeatured,
    isVerified,
    inspectionScore,
    dealerName,
    youtubeUrl,
    videoTitle,
    videoDuration,
    videoPresenter,
    galleryImage1Url,
    galleryImage2Url,
  ]);

  // Warn on browser tab close if unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Auto-generate title if empty
  const handleAutoTitle = () => {
    const generated = `${year} ${make} ${model} ${trim}`.trim();
    setTitle(generated);
    if (!videoTitle) {
      setVideoTitle(`${generated} In-Depth Nigerian Market Review`);
    }
  };

  // Sample media filler for quick testing
  const handleFillDemoMedia = () => {
    setYoutubeUrl('https://www.youtube.com/watch?v=w4-z4_h1wR0');
    setVideoTitle(`${title || '2022 Toyota Highlander'} MANIFOLD Review`);
    setGalleryImage1Url(
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80'
    );
    setGalleryImage2Url(
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80'
    );
    setImg1Error(false);
    setImg2Error(false);
    setValidationError(null);
  };

  const handleCancelClick = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        'You have unsaved changes. Leave without saving?'
      );
      if (!confirmLeave) return;
    }
    onCancel();
  };

  const handleSubmit = async (targetStatus: ListingStatus) => {
    setValidationError(null);

    // 1. Basic Information Validation
    if (!title.trim()) {
      setValidationError('Please enter a vehicle title.');
      return;
    }
    const parsedPrice = parseInt(String(price).replace(/[^0-9]/g, ''), 10);
    if (!parsedPrice || parsedPrice <= 0) {
      setValidationError('Please enter a valid listing price in Naira.');
      return;
    }

    // 2. Publish Validation (PART 6 & PART 27)
    // "A car cannot be published unless it contains:
    // • YouTube video URL
    // • Valid YouTube video ID
    // • Gallery image 1 URL
    // • Gallery image 2 URL
    // If any are missing: Do not allow PUBLISH. Display specific message."
    if (targetStatus === 'PUBLISHED') {
      if (!youtubeUrl.trim() || !detectedVideoId || !isVideoValid) {
        setValidationError('Add a primary YouTube review video before publishing this vehicle.');
        return;
      }
      if (!galleryImage1Url.trim()) {
        setValidationError('Gallery Image 1 is required before publishing this vehicle.');
        return;
      }
      if (!galleryImage2Url.trim()) {
        setValidationError('Gallery Image 2 is required before publishing this vehicle.');
        return;
      }
    }

    const parsedOriginalPrice = originalPrice
      ? parseInt(String(originalPrice).replace(/[^0-9]/g, ''), 10)
      : undefined;
    const parsedMileage = parseInt(String(mileage).replace(/[^0-9]/g, ''), 10) || 0;

    const carPayload: Partial<Car> = {
      title: title.trim(),
      make: make.trim(),
      model: model.trim(),
      trim: trim.trim(),
      year: Number(year),
      price: parsedPrice,
      original_price: parsedOriginalPrice,
      is_price_reduced: !!(parsedOriginalPrice && parsedOriginalPrice > parsedPrice),
      mileage: parsedMileage,
      condition,
      body_type: bodyType,
      fuel_type: fuelType,
      transmission,
      drive_type: driveType,
      engine: engine.trim(),
      exterior_color: exteriorColor.trim(),
      interior_color: interiorColor.trim(),
      seats: Number(seats),
      doors: Number(doors),
      location: location.trim(),
      state: state.trim(),
      description: description.trim(),
      status: targetStatus,
      is_featured: isFeatured,
      video: {
        youtube_url: youtubeUrl ? formatStandardYouTubeUrl(detectedVideoId || youtubeUrl) : '',
        youtube_video_id: detectedVideoId || '',
        youtube_thumbnail_url: youtubeThumbnail,
        video_title: videoTitle.trim() || `${title} Video Review`,
        video_duration: videoDuration.trim() || '12:00',
        video_type: 'full_review',
        is_primary: true,
        presenter_name: videoPresenter.trim() || 'MANIFOLD Presenter',
      },
      gallery_image_1_url: galleryImage1Url.trim(),
      gallery_image_2_url: galleryImage2Url.trim(),
      verification: {
        is_verified: isVerified,
        dealer_verified: isVerified,
        vehicle_physically_seen: isVerified,
        video_reviewed: !!detectedVideoId,
        price_confirmed: true,
        vin_checked: isVerified,
        inspection_score: inspectionScore,
        verified_date: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        verified_by: 'MANIFOLD Field Unit',
      },
      dealer: {
        id: initialCar?.dealer?.id || 'dlr-partner-01',
        name: dealerName.trim(),
        city: location.split(',')[0]?.trim() || 'Lagos',
        state: state.trim(),
        verified_partner: true,
        joined_year: initialCar?.dealer?.joined_year || 2023,
      },
    };

    setHasUnsavedChanges(false);
    await onSave(carPayload);
  };

  return (
    <div className="space-y-8">
      {/* Validation Banner */}
      {validationError && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl flex items-start gap-3 text-sm text-red-800 animate-in fade-in duration-200 shadow-sm">
          <AlertCircle className="w-5 h-5 text-[#EF233C] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Action Required to Proceed</p>
            <p className="text-xs text-red-700 mt-0.5">{validationError}</p>
          </div>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-red-500 hover:text-red-800 font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Test Demo Helper Banner */}
      <div className="p-3.5 bg-[#071A2B]/5 border border-[#071A2B]/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-gray-700">
          <Sparkles className="w-4 h-4 text-[#EF233C] shrink-0" />
          <span>
            <strong>Testing helper:</strong> Need sample media URLs to test YouTube detection & gallery images?
          </span>
        </div>
        <button
          type="button"
          onClick={handleFillDemoMedia}
          className="px-3 py-1.5 bg-[#071A2B] hover:bg-[#0B2239] text-white rounded text-xs font-bold whitespace-nowrap transition cursor-pointer self-start sm:self-auto"
        >
          Fill Sample Media
        </button>
      </div>

      {/* SECTION 1: BASIC VEHICLE INFORMATION */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-[#071A2B] font-display">
              1. Basic Vehicle Information
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Standard automotive identification, pricing, and specification attributes.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAutoTitle}
            className="text-[11px] font-bold text-[#EF233C] hover:underline cursor-pointer"
          >
            Auto-generate Title from Specs
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Title (Full width) */}
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Vehicle Title <span className="text-[#EF233C]">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 2021 Toyota Highlander XLE AWD"
              className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            />
          </div>

          {/* Make / Brand */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Brand / Make <span className="text-[#EF233C]">*</span>
            </label>
            <select
              value={make}
              onChange={(e) => setMake(e.target.value)}
              className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            >
              {brands.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Model <span className="text-[#EF233C]">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                list="popular-models"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Highlander, RX 350, GLE"
                className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
              />
              <datalist id="popular-models">
                {popularModels.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Variant / Trim */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Variant / Trim
            </label>
            <input
              type="text"
              value={trim}
              onChange={(e) => setTrim(e.target.value)}
              placeholder="e.g. XLE AWD, F-Sport, AMG"
              className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            />
          </div>

          {/* Year */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Year <span className="text-[#EF233C]">*</span>
            </label>
            <input
              type="number"
              min="1990"
              max="2027"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            />
          </div>

          {/* Price (NGN) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Price (NGN) <span className="text-[#EF233C]">*</span>
            </label>
            <input
              type="text"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 24500000"
              className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none font-semibold tabular-nums"
            />
          </div>

          {/* Previous Price (Optional) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Previous / Original Price (NGN)
            </label>
            <input
              type="text"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(e.target.value)}
              placeholder="e.g. 26000000 (shows strike-through)"
              className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none tabular-nums"
            />
          </div>

          {/* Mileage */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Mileage (Kilometers)
            </label>
            <input
              type="text"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="e.g. 34000"
              className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none tabular-nums"
            />
          </div>

          {/* Condition */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Condition <span className="text-[#EF233C]">*</span>
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as Car['condition'])}
              className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            >
              <option value="Foreign Used">Foreign Used (Tokunbo)</option>
              <option value="Brand New">Brand New</option>
              <option value="Nigerian Used">Nigerian Used</option>
            </select>
          </div>

          {/* Body Type */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Body Type <span className="text-[#EF233C]">*</span>
            </label>
            <select
              value={bodyType}
              onChange={(e) => setBodyType(e.target.value as Car['body_type'])}
              className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            >
              {bodyTypes.map((bt) => (
                <option key={bt.id} value={bt.name}>
                  {bt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Fuel Type */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Fuel Type
            </label>
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value as Car['fuel_type'])}
              className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            >
              <option value="Petrol">Petrol</option>
              <option value="Diesel">Diesel</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Electric">Electric</option>
            </select>
          </div>

          {/* Transmission */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Transmission
            </label>
            <select
              value={transmission}
              onChange={(e) => setTransmission(e.target.value as Car['transmission'])}
              className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            >
              <option value="Automatic">Automatic</option>
              <option value="Manual">Manual</option>
            </select>
          </div>

          {/* Drive Type */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Drive Type
            </label>
            <select
              value={driveType}
              onChange={(e) => setDriveType(e.target.value as Car['drive_type'])}
              className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            >
              <option value="AWD">AWD (All-Wheel Drive)</option>
              <option value="4WD">4WD (Four-Wheel Drive)</option>
              <option value="FWD">FWD (Front-Wheel Drive)</option>
              <option value="RWD">RWD (Rear-Wheel Drive)</option>
            </select>
          </div>

          {/* Engine */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Engine Specs
            </label>
            <input
              type="text"
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              placeholder="e.g. 3.5L V6 DOHC 24V"
              className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            />
          </div>

          {/* Exterior Color */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Exterior Color
            </label>
            <input
              type="text"
              value={exteriorColor}
              onChange={(e) => setExteriorColor(e.target.value)}
              placeholder="e.g. Blizzard Pearl White"
              className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            />
          </div>

          {/* Interior Color */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Interior Color
            </label>
            <input
              type="text"
              value={interiorColor}
              onChange={(e) => setInteriorColor(e.target.value)}
              placeholder="e.g. Black Leather"
              className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            />
          </div>

          {/* Seats & Doors */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Seats
              </label>
              <input
                type="number"
                min="2"
                max="16"
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Doors
              </label>
              <input
                type="number"
                min="2"
                max="6"
                value={doors}
                onChange={(e) => setDoors(Number(e.target.value))}
                className="w-full h-11 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
              />
            </div>
          </div>

          {/* Location & State */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Location (City/Hub)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Lekki Phase 1, Lagos"
              className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            />
          </div>

          {/* Partner Dealer */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Partner Dealership
            </label>
            <input
              type="text"
              value={dealerName}
              onChange={(e) => setDealerName(e.target.value)}
              placeholder="e.g. Prestige Motors Lekki"
              className="w-full h-11 px-3.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            />
          </div>

          {/* Status & Featured */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Listing Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ListingStatus)}
                className="w-full h-11 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="ARCHIVED">ARCHIVED</option>
                <option value="SOLD">SOLD</option>
              </select>
            </div>
            <div className="flex flex-col justify-end pb-2">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 text-[#EF233C] rounded border-gray-300 focus:ring-[#EF233C]"
                />
                <span>Featured Car</span>
              </label>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
            Vehicle Editorial Description
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description of physical condition, inspection notes, features, and customs documentation..."
            className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
          />
        </div>
      </div>

      {/* SECTION 2: MEDIA & REVIEW (VIDEO FIRST + TWO GALLERY IMAGES) */}
      <div className="bg-white rounded-2xl border-2 border-[#071A2B]/15 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EF233C] text-white flex items-center justify-center shadow">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#071A2B] font-display">
                2. MEDIA & REVIEW (Mandatory for Publishing)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                MANIFOLD architecture is <strong>Video First + Two Gallery Images</strong>.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-extrabold px-2.5 py-1 bg-red-100 text-[#EF233C] rounded-full uppercase tracking-wider">
            Required For Live
          </span>
        </div>

        {/* 2A: PRIMARY YOUTUBE VIDEO */}
        <div className="space-y-4 p-5 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#071A2B]">
              Primary Car YouTube Video URL <span className="text-[#EF233C]">*</span>
            </label>
            {isVideoValid && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Valid YouTube Video ({detectedVideoId})
              </span>
            )}
          </div>

          <div className="relative">
            <input
              type="url"
              value={youtubeUrl}
              onFocus={() => setYoutubeInputTouched(true)}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=XXXXXXXX or https://youtu.be/XXXXXXXX"
              className="w-full h-11 pl-3.5 pr-24 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-[#071A2B] outline-none"
            />
            {youtubeUrl && (
              <button
                type="button"
                onClick={() => setYoutubeUrl('')}
                className="absolute right-3 top-3 text-xs text-gray-400 hover:text-gray-700 font-semibold"
              >
                Clear
              </button>
            )}
          </div>

          <p className="text-[11px] text-gray-500">
            Supports: <code className="bg-gray-200 px-1 rounded">youtube.com/watch?v=</code>,{' '}
            <code className="bg-gray-200 px-1 rounded">youtu.be/</code>,{' '}
            <code className="bg-gray-200 px-1 rounded">youtube.com/shorts/</code>. Video ID is automatically extracted.
          </p>

          {/* YouTube Video Preview Card */}
          {detectedVideoId && isVideoValid ? (
            <div className="mt-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-start">
              <div className="relative aspect-video w-full md:w-64 bg-black rounded-lg overflow-hidden shrink-0 border border-gray-200">
                <img
                  src={youtubeThumbnail}
                  alt="YouTube video preview thumbnail"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to hqdefault if maxresdefault 404s
                    e.currentTarget.src = `https://img.youtube.com/vi/${detectedVideoId}/hqdefault.jpg`;
                  }}
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#EF233C] text-white flex items-center justify-center shadow-lg">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>
                <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                  {videoDuration || '12:00'}
                </span>
              </div>

              <div className="flex-1 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="bg-[#EF233C] text-white text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded">
                    MANIFOLD REVIEW
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="font-mono text-[11px] text-gray-600">ID: {detectedVideoId}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500 block mb-0.5">
                      Review Title
                    </label>
                    <input
                      type="text"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="e.g. 2021 Toyota Highlander Review"
                      className="w-full h-8 px-2 bg-gray-50 border border-gray-200 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500 block mb-0.5">
                      Presenter / Host
                    </label>
                    <input
                      type="text"
                      value={videoPresenter}
                      onChange={(e) => setVideoPresenter(e.target.value)}
                      placeholder="e.g. MANIFOLD Presenter"
                      className="w-full h-8 px-2 bg-gray-50 border border-gray-200 rounded text-xs"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3 text-[11px]">
                  <a
                    href={`https://www.youtube.com/watch?v=${detectedVideoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#EF233C] hover:underline font-bold inline-flex items-center gap-1"
                  >
                    Open on YouTube <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            youtubeInputTouched &&
            youtubeUrl && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Enter a valid YouTube video URL to automatically generate preview.</span>
              </div>
            )
          )}
        </div>

        {/* 2B: GALLERY IMAGES 1 & 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gallery Image 1 */}
          <div className="p-5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#071A2B]">
                Gallery Image 1 URL <span className="text-[#EF233C]">*</span>
              </label>
              {galleryImage1Url && !img1Error && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ Ready
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="url"
                value={galleryImage1Url}
                onChange={(e) => {
                  setGalleryImage1Url(e.target.value);
                  setImg1Error(false);
                }}
                placeholder="https://example.com/car-exterior-photo.jpg"
                className="w-full h-10 px-3 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:border-[#071A2B] outline-none"
              />
            </div>

            {/* Image 1 Preview Box */}
            <div className="relative aspect-video w-full bg-gray-200 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center">
              {galleryImage1Url && !img1Error ? (
                <>
                  <img
                    src={galleryImage1Url}
                    alt="Gallery 1 preview"
                    className="w-full h-full object-cover"
                    onError={() => setImg1Error(true)}
                  />
                  <div className="absolute top-2 left-2 bg-[#071A2B]/80 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">
                    GALLERY IMAGE 1
                  </div>
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGalleryImage1Url('')}
                      className="px-2 py-1 bg-black/75 hover:bg-red-600 text-white text-[10px] font-bold rounded flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                </>
              ) : img1Error ? (
                <div className="text-center p-4 text-xs text-red-600">
                  <AlertCircle className="w-6 h-6 mx-auto mb-1 text-red-500" />
                  <p className="font-semibold">Unable to load image from URL</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Please check the image link</p>
                </div>
              ) : (
                <div className="text-center p-4 text-gray-400 text-xs">
                  <ImageIcon className="w-7 h-7 mx-auto mb-1 text-gray-300" />
                  <p className="font-semibold">Gallery Image 1 Preview</p>
                  <p className="text-[10px] text-gray-400">Enter a direct image URL above</p>
                </div>
              )}
            </div>
          </div>

          {/* Gallery Image 2 */}
          <div className="p-5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#071A2B]">
                Gallery Image 2 URL <span className="text-[#EF233C]">*</span>
              </label>
              {galleryImage2Url && !img2Error && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ Ready
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="url"
                value={galleryImage2Url}
                onChange={(e) => {
                  setGalleryImage2Url(e.target.value);
                  setImg2Error(false);
                }}
                placeholder="https://example.com/car-interior-photo.jpg"
                className="w-full h-10 px-3 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:border-[#071A2B] outline-none"
              />
            </div>

            {/* Image 2 Preview Box */}
            <div className="relative aspect-video w-full bg-gray-200 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center">
              {galleryImage2Url && !img2Error ? (
                <>
                  <img
                    src={galleryImage2Url}
                    alt="Gallery 2 preview"
                    className="w-full h-full object-cover"
                    onError={() => setImg2Error(true)}
                  />
                  <div className="absolute top-2 left-2 bg-[#071A2B]/80 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">
                    GALLERY IMAGE 2
                  </div>
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGalleryImage2Url('')}
                      className="px-2 py-1 bg-black/75 hover:bg-red-600 text-white text-[10px] font-bold rounded flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                </>
              ) : img2Error ? (
                <div className="text-center p-4 text-xs text-red-600">
                  <AlertCircle className="w-6 h-6 mx-auto mb-1 text-red-500" />
                  <p className="font-semibold">Unable to load image from URL</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Please check the image link</p>
                </div>
              ) : (
                <div className="text-center p-4 text-gray-400 text-xs">
                  <ImageIcon className="w-7 h-7 mx-auto mb-1 text-gray-300" />
                  <p className="font-semibold">Gallery Image 2 Preview</p>
                  <p className="text-[10px] text-gray-400">Enter a direct image URL above</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2C: CUSTOMER-FACING COMPOSITE MEDIA PREVIEW (PART 5) */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-[#071A2B]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#071A2B]">
              Customer Media View Preview
            </h3>
          </div>

          <div className="bg-[#071A2B] p-4 sm:p-5 rounded-xl border border-white/10 text-white space-y-3">
            <div className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
              Live Listing Layout Preview (Video First + 2 Gallery Images)
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
              {/* Primary Video (Col 8) */}
              <div className="lg:col-span-8 relative aspect-video bg-black rounded-lg overflow-hidden border border-white/15">
                {detectedVideoId ? (
                  <>
                    <img
                      src={youtubeThumbnail}
                      alt="Customer video preview"
                      className="w-full h-full object-cover filter brightness-90"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-[#EF233C] text-white flex items-center justify-center shadow-2xl">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>
                    <span className="absolute bottom-2 left-2 bg-black/80 text-[10px] font-bold px-2 py-0.5 rounded">
                      PRIMARY VIDEO REVIEW ({videoDuration || '12:00'})
                    </span>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 text-xs">
                    <Video className="w-8 h-8 mb-1 text-gray-600" />
                    <span>No YouTube video set yet</span>
                  </div>
                )}
              </div>

              {/* Two Gallery Images (Col 4) */}
              <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-2.5">
                <div className="relative aspect-video bg-black/40 rounded-lg overflow-hidden border border-white/10">
                  {galleryImage1Url ? (
                    <img
                      src={galleryImage1Url}
                      alt="Customer gallery 1"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">
                      Gallery 1
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1 bg-black/70 text-[9px] px-1.5 py-0.2 rounded text-white/90">
                    Photo 1
                  </span>
                </div>

                <div className="relative aspect-video bg-black/40 rounded-lg overflow-hidden border border-white/10">
                  {galleryImage2Url ? (
                    <img
                      src={galleryImage2Url}
                      alt="Customer gallery 2"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">
                      Gallery 2
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1 bg-black/70 text-[9px] px-1.5 py-0.2 rounded text-white/90">
                    Photo 2
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STICKY BOTTOM ACTION BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 z-20">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>
            {hasUnsavedChanges ? (
              <strong className="text-amber-600">Unsaved changes pending</strong>
            ) : (
              'All changes ready'
            )}
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={isSaving}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSubmit('DRAFT')}
            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save as Draft</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSubmit('PUBLISHED')}
            className="px-6 py-2.5 bg-[#EF233C] hover:bg-[#d91b32] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{isEditMode ? 'Save & Publish' : 'Publish Listing'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
