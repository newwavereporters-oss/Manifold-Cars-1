import React, { useState, useEffect } from 'react';
import { DealerLayout } from '../../components/dealer/DealerLayout';
import { useDealerAuth } from '../../context/DealerAuthContext';
import { dealerVehicleService, DealerCarFormInput, DealerCarRecord } from '../../services/dealerVehicleService';
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
  ArrowLeft,
  X,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { CarBrand, BodyTypeCategory } from '../../types';

interface DealerEditCarPageProps {
  carId: string;
  navigate: (route: string) => void;
}

export const DealerEditCarPage: React.FC<DealerEditCarPageProps> = ({ carId, navigate }) => {
  const { dealerAccount } = useDealerAuth();

  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [originalCar, setOriginalCar] = useState<DealerCarRecord | null>(null);

  // Dynamic Options
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [bodyTypes, setBodyTypes] = useState<BodyTypeCategory[]>([]);

  // Form State
  const [brandId, setBrandId] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [trim, setTrim] = useState('');
  const [year, setYear] = useState<number>(2021);
  const [typeId, setTypeId] = useState('');
  const [bodyType, setBodyType] = useState('SUV');
  const [condition, setCondition] = useState('Foreign Used (Tokunbo)');
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

  // Load car and options
  useEffect(() => {
    let mounted = true;
    async function loadCarAndMetadata() {
      if (!dealerAccount?.dealerId) return;

      try {
        const [car, brandsData, typesData] = await Promise.all([
          dealerVehicleService.getDealerCarById(carId, dealerAccount.dealerId),
          brandService.getBrands(),
          categoryService.getBodyTypes(),
        ]);

        if (!mounted) return;

        if (!car) {
          setUnauthorized(true);
          setLoading(false);
          return;
        }

        setOriginalCar(car);
        setBrands(brandsData);
        setBodyTypes(typesData);

        // Prepopulate form fields
        setMake(car.make);
        setModel(car.model);
        setTrim(car.trim || '');
        setYear(car.year);
        setBodyType(car.body_type);
        setCondition(car.condition);
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

        const b = brandsData.find((br) => br.name.toLowerCase() === car.make.toLowerCase());
        if (b) setBrandId(b.id);

        const t = typesData.find((ty) => ty.name.toLowerCase() === car.body_type.toLowerCase());
        if (t) setTypeId(t.id);

        // Load models for this make
        const modelList = await modelService.getModelsByBrand(car.make);
        if (mounted) setModels(modelList);

        setLoading(false);
      } catch (e) {
        console.error('Failed to load vehicle for editing:', e);
        if (mounted) {
          setUnauthorized(true);
          setLoading(false);
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
    const selected = brands.find((b) => b.id === e.target.value);
    if (selected) {
      setBrandId(selected.id);
      setMake(selected.name);
      const modelList = await modelService.getModelsByBrand(selected.name);
      setModels(modelList);
      if (modelList.length > 0) setModel(modelList[0]);
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

  const handleSave = async (isDraft: boolean) => {
    if (!dealerAccount?.dealerId) return;

    if (!isDraft) {
      if (!price.trim() || Number(price.replace(/[^0-9.]/g, '')) <= 0) {
        setSubmitError('Please specify a valid vehicle price.');
        return;
      }
      if (!youtubeUrl.trim() || !derivedVideoId) {
        setSubmitError('A valid YouTube video walkaround is required for review submission.');
        return;
      }
      if (!image1Url.trim() || !image2Url.trim()) {
        setSubmitError('Both gallery images (Exterior & Interior) are required for review submission.');
        return;
      }
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload = preparePayload();
      const res = await dealerVehicleService.updateDealerCar(carId, payload, dealerAccount.dealerId, isDraft);

      if (res.error) {
        setSubmitError(res.error);
        setSubmitting(false);
      } else {
        navigate('/dealer/cars');
      }
    } catch {
      setSubmitError('Failed to update vehicle record.');
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
              Edit: {originalCar?.title}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Modify permitted vehicle specifications, update pricing, or refresh video walkarounds.
            </p>
          </div>
        </div>

        {submitError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#EF233C] shrink-0 mt-0.5" />
            <p className="text-xs text-red-800 font-medium leading-relaxed">{submitError}</p>
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
                  Brand / Make
                </label>
                <select
                  value={brandId}
                  onChange={handleBrandChange}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Model
                </label>
                {models.length > 0 ? (
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
                  Vehicle Type
                </label>
                <select
                  value={typeId}
                  onChange={(e) => {
                    const found = bodyTypes.find((t) => t.id === e.target.value);
                    if (found) {
                      setTypeId(found.id);
                      setBodyType(found.name);
                    }
                  }}
                  className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
                >
                  {bodyTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
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
                  <option value="Foreign Used (Tokunbo)">Foreign Used (Tokunbo)</option>
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
          </div>

          {/* SECTION 5: VIDEO-FIRST */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Video className="w-5 h-5 text-[#EF233C]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                5. Video Review
              </h2>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                YouTube Video URL
              </label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 focus:outline-none focus:border-[#EF233C]"
              />
            </div>

            {derivedVideoId && (
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black max-w-md mx-auto">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${derivedVideoId}`}
                  title="YouTube video preview"
                  className="w-full h-full border-0"
                  allowFullScreen
                />
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
              Saving updates maintains draft state. Submitting sends modifications to MANIFOLD review.
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
                disabled={submitting}
                className="flex-1 sm:flex-initial px-6 py-3 bg-[#EF233C] hover:bg-[#D90429] text-white text-xs font-bold uppercase rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Submit for Review</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DealerLayout>
  );
};
