import React from 'react';
import { Compass, ArrowLeft, CarFront, Sparkles } from 'lucide-react';

interface NotFoundViewProps {
  path: string;
  navigate: (route: string) => void;
  scope?: 'public' | 'dealer' | 'admin';
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({ path, navigate, scope = 'public' }) => {
  const primaryAction =
    scope === 'admin'
      ? { label: 'Return to Admin Dashboard', route: '/admin/dashboard' }
      : scope === 'dealer'
      ? { label: 'Return to Dealer Dashboard', route: '/dealer/dashboard' }
      : { label: 'Browse Car Marketplace', route: '/car-marketplace' };

  return (
    <div className="min-h-[70vh] bg-[#F7F8FA] pt-28 pb-20 px-4 flex items-center justify-center">
      <div className="max-w-lg w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 sm:p-10 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 text-[#EF233C] mx-auto flex items-center justify-center">
          <Compass className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-[#EF233C] bg-red-50 border border-red-200 px-3 py-1 rounded-full">
            404 · Page Not Found
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#071A2B] tracking-tight font-display">
            Route Not Found
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
            The MANIFOLD page <span className="font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{path}</span> does not exist or may have moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(primaryAction.route)}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#071A2B] hover:bg-[#0B2239] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{primaryAction.label}</span>
          </button>

          {scope === 'public' && (
            <>
              <button
                type="button"
                onClick={() => navigate('/cars')}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <CarFront className="w-4 h-4" />
                <span>View Verified Cars</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/3d-world')}
                className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider rounded-xl transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#EF233C]" />
                <span>3D World</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
