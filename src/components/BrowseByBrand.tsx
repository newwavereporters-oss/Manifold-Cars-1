import React from 'react';
import { ArrowRight } from 'lucide-react';
import { CAR_BRANDS } from '../data/brandsAndTypes';
import { FORMAT_NUMBER } from '../data/mockCars';

interface BrowseByBrandProps {
  onSelectBrand: (brandName: string) => void;
  onViewAllBrands: () => void;
}

export const BrowseByBrand: React.FC<BrowseByBrandProps> = ({
  onSelectBrand,
  onViewAllBrands,
}) => {
  return (
    <section className="py-12 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-7">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#071A2B] tracking-tight font-display uppercase">
              Browse Cars By Brand
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Explore inventory from Nigeria's most trusted automotive manufacturers.
            </p>
          </div>

          <button
            onClick={onViewAllBrands}
            className="mt-3 sm:mt-0 inline-flex items-center gap-1.5 text-xs font-bold text-[#071A2B] hover:text-[#EF233C] transition-colors uppercase tracking-wider group"
          >
            <span>View all brands</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Brand Snap Scrollable Row on Mobile, Grid on Tablet/Desktop */}
        <div className="flex sm:grid sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-3.5 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 py-1">
          {CAR_BRANDS.map((brand) => (
            <button
              key={brand.id}
              onClick={() => onSelectBrand(brand.name)}
              className="min-w-[120px] sm:min-w-0 snap-start shrink-0 sm:shrink flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-lg border border-gray-200 bg-white hover:border-[#071A2B] hover:shadow-md transition-all duration-150 group text-center cursor-pointer"
            >
              {/* Brand Initial Badge */}
              <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mb-2 group-hover:border-[#EF233C]/40 group-hover:bg-red-50/50 transition-colors">
                <span className="font-extrabold text-sm text-[#071A2B] group-hover:text-[#EF233C] font-display">
                  {brand.name.charAt(0)}
                </span>
              </div>

              <span className="text-xs sm:text-sm font-bold text-[#071A2B] group-hover:text-[#EF233C] transition-colors truncate w-full">
                {brand.name}
              </span>

              <span className="text-[10px] sm:text-[11px] font-medium text-gray-400 mt-0.5 tabular-nums whitespace-nowrap">
                {FORMAT_NUMBER(brand.car_count)} cars
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
