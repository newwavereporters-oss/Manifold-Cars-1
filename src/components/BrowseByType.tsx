import React from 'react';
import { ArrowRight } from 'lucide-react';
import { BODY_TYPES } from '../data/brandsAndTypes';
import { FORMAT_NUMBER } from '../data/mockCars';

interface BrowseByTypeProps {
  onSelectType: (type: string) => void;
  onViewAll: () => void;
}

export const BrowseByType: React.FC<BrowseByTypeProps> = ({ onSelectType, onViewAll }) => {
  // Clean SVG icons representing automotive body silhouettes
  const renderSilhouette = (type: string) => {
    switch (type) {
      case 'SUV':
        return (
          <svg className="w-12 h-6 text-gray-700 group-hover:text-[#EF233C] transition-colors" viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 16h40M6 16l3-6h12l6 4h15v2H6z" />
            <circle cx="12" cy="17" r="3" />
            <circle cx="36" cy="17" r="3" />
          </svg>
        );
      case 'Sedan':
        return (
          <svg className="w-12 h-6 text-gray-700 group-hover:text-[#EF233C] transition-colors" viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 16h42M5 16l5-4h14l8 4h12v2H3z" />
            <circle cx="11" cy="17" r="3" />
            <circle cx="37" cy="17" r="3" />
          </svg>
        );
      case 'Hatchback':
        return (
          <svg className="w-12 h-6 text-gray-700 group-hover:text-[#EF233C] transition-colors" viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 16h40M6 16l4-5h14l4 5h14v2H4z" />
            <circle cx="12" cy="17" r="3" />
            <circle cx="34" cy="17" r="3" />
          </svg>
        );
      case 'Pickup':
        return (
          <svg className="w-12 h-6 text-gray-700 group-hover:text-[#EF233C] transition-colors" viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 16h40M6 16l3-6h14v6h20v2H4z" />
            <circle cx="12" cy="17" r="3" />
            <circle cx="36" cy="17" r="3" />
          </svg>
        );
      case 'Coupe':
        return (
          <svg className="w-12 h-6 text-gray-700 group-hover:text-[#EF233C] transition-colors" viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 16h40M6 16l6-5h12l8 5h12v2H4z" />
            <circle cx="12" cy="17" r="3" />
            <circle cx="36" cy="17" r="3" />
          </svg>
        );
      case 'Van':
        return (
          <svg className="w-12 h-6 text-gray-700 group-hover:text-[#EF233C] transition-colors" viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 16h40M5 16l2-8h22l9 8h6v2H4z" />
            <circle cx="11" cy="17" r="3" />
            <circle cx="35" cy="17" r="3" />
          </svg>
        );
      case 'Truck':
        return (
          <svg className="w-12 h-6 text-gray-700 group-hover:text-[#EF233C] transition-colors" viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 16h42M5 16l2-9h16v9h22v2H3z" />
            <circle cx="10" cy="17" r="3" />
            <circle cx="32" cy="17" r="3" />
            <circle cx="39" cy="17" r="3" />
          </svg>
        );
      case 'Luxury':
      default:
        return (
          <svg className="w-12 h-6 text-gray-700 group-hover:text-[#EF233C] transition-colors" viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 16h40M7 16l4-5h16l7 5h10v2H4z" />
            <circle cx="13" cy="17" r="3" />
            <circle cx="37" cy="17" r="3" />
          </svg>
        );
    }
  };

  return (
    <section className="py-12 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-7">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#071A2B] tracking-tight font-display uppercase">
              Browse Cars By Type
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Find the right body style for the way you drive.
            </p>
          </div>

          <button
            onClick={onViewAll}
            className="mt-3 sm:mt-0 inline-flex items-center gap-1.5 text-xs font-bold text-[#071A2B] hover:text-[#EF233C] transition-colors uppercase tracking-wider group"
          >
            <span>View all types</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Horizontal Scrollable Types Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-3.5">
          {BODY_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => onSelectType(type.name)}
              className="flex flex-col items-center justify-center p-4 rounded-lg border border-gray-200 bg-white hover:border-[#071A2B] hover:shadow-md transition-all duration-150 group text-center cursor-pointer"
            >
              <div className="h-10 flex items-center justify-center mb-2">
                {renderSilhouette(type.name)}
              </div>
              <span className="text-sm font-bold text-[#071A2B] group-hover:text-[#EF233C] transition-colors">
                {type.name}
              </span>
              <span className="text-[11px] font-medium text-gray-400 mt-0.5 tabular-nums">
                {FORMAT_NUMBER(type.car_count)} cars
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
