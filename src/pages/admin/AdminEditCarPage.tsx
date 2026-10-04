import React, { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Car } from '../../types';
import { carService } from '../../services/carService';
import { CarForm } from '../../components/admin/CarForm';

interface AdminEditCarPageProps {
  carId: string;
  navigate: (route: string) => void;
}

export const AdminEditCarPage: React.FC<AdminEditCarPageProps> = ({ carId, navigate }) => {
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    carService
      .getCarById(carId)
      .then((found) => {
        if (!isMounted) return;
        if (found) {
          setCar(found);
        } else {
          setError(`Vehicle with ID "${carId}" was not found in inventory.`);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load vehicle record.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [carId]);

  const handleSave = async (updatedData: Partial<Car>) => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      const saved = await carService.updateCar(carId, updatedData);
      setCar(saved);
      setIsSaving(false);
      setSaveSuccessMsg('Vehicle updated successfully.');
      setTimeout(() => {
        setSaveSuccessMsg(null);
      }, 4000);
    } catch (err: any) {
      setIsSaving(false);
      setError(err.message || 'Failed to update vehicle record.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] p-6 sm:p-10 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-[#EF233C] animate-spin" />
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Loading Vehicle Information...
        </p>
      </div>
    );
  }

  if (error || !car) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] p-6 sm:p-10">
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl border border-red-200 shadow-sm text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-[#EF233C] mx-auto" />
          <h2 className="text-xl font-bold text-gray-900 font-display">Vehicle Not Found</h2>
          <p className="text-sm text-gray-600 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => navigate('/admin')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#071A2B] text-white text-xs font-bold rounded-lg uppercase tracking-wider hover:bg-[#0B2239] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Cars Inventory</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#111827] pb-20">
      {/* Top Header Bar */}
      <header className="bg-[#071A2B] text-white border-b border-white/10 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition"
              title="Return to Admin Cars"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                MANIFOLD Operations
              </span>
              <span className="text-gray-500">/</span>
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Edit Vehicle
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {car.status === 'PUBLISHED' && (
              <button
                onClick={() => navigate(`/cars/${car.slug}`)}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-300 hover:text-white px-3 py-1.5 rounded hover:bg-white/10 transition"
              >
                <span>View Public Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => navigate('/admin')}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-bold uppercase tracking-wider transition"
            >
              Return to Cars
            </button>
          </div>
        </div>
      </header>

      {/* Success Notification Banner */}
      {saveSuccessMsg && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl flex items-center justify-between text-emerald-900 shadow-sm animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold">{saveSuccessMsg}</p>
                <p className="text-[11px] text-emerald-700">
                  Vehicle listing details and media have been updated.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/admin')}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition"
              >
                Return to Cars
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Title & Metadata Header */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider bg-gray-100 text-gray-700">
                ID: {car.id}
              </span>
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider ${
                  car.status === 'PUBLISHED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {car.status}
              </span>
              {car.is_featured && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider bg-[#EF233C]/10 text-[#EF233C]">
                  FEATURED
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#071A2B] font-display">
              {car.title}
            </h1>
            <p className="text-xs text-gray-500">
              {car.year} · {car.make} {car.model} · {car.location} · Slug: <code className="text-[11px]">{car.slug}</code>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/cars/${car.slug}`)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Preview Live</span>
            </button>
          </div>
        </div>

        {/* The Reusable Car Form populated with existing vehicle data */}
        <CarForm
          initialCar={car}
          isEditMode={true}
          isSaving={isSaving}
          onSave={handleSave}
          onCancel={() => navigate('/admin')}
        />
      </div>
    </div>
  );
};
