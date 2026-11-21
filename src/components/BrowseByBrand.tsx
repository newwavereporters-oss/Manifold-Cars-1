import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { brandService } from '../services/brandService';
import { CarBrand } from '../types';
import { FORMAT_NUMBER } from '../data/mockCars';

interface BrowseByBrandProps {
  onSelectBrand: (brandName: string) => void;
  onViewAllBrands: () => void;
}

export const BrowseByBrand: React.FC<BrowseByBrandProps> = ({
  onSelectBrand,
  onViewAllBrands,
}) => {
  const [brands, setBrands] = useState<CarBrand[]>(() =>
    brandService.getBrandsSync().filter((b) => b.is_active !== false)
  );
  const [loading, setLoading] = useState<boolean>(() => brandService.getBrandsSync().length === 0);

  useEffect(() => {
    let mounted = true;

    brandService
      .getActiveBrands()
      .then((data) => {
        if (mounted) {
          setBrands(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

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

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-3.5 py-1">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="h-28 rounded-lg border border-gray-100 bg-gray-50 animate-pulse"
              />
            ))}
          </div>
        ) : brands.length === 0 ? (
          <div className="py-8 px-4 rounded-lg border border-dashed border-gray-200 text-center">
            <p className="text-xs sm:text-sm text-gray-500">
              No active car brands are currently listed.
            </p>
          </div>
        ) : (
          <div className="flex sm:grid sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-3.5 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 py-1">
            {brands.map((brand) => {
              const count = brand.car_count ?? 0;
              return (
                <button
                  key={brand.id}
                  onClick={() => onSelectBrand(brand.name)}
                  className="min-w-[120px] sm:min-w-0 snap-start shrink-0 sm:shrink flex flex-col items-center justify-center p-3.5 sm:p-4 rounded-lg border border-gray-200 bg-white hover:border-[#071A2B] hover:shadow-md transition-all duration-150 group text-center cursor-pointer"
                >
                  {/* Brand Logo or Initial Badge */}
                  <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mb-2 group-hover:border-[#EF233C]/40 group-hover:bg-red-50/50 transition-colors overflow-hidden">
                    {brand.logo_url ? (
                      <img
                        src={brand.logo_url}
                        alt={brand.name}
                        className="w-full h-full object-contain p-1.5"
                        onError={(ev) => {
                          ev.currentTarget.style.display = 'none';
                          const fallback = ev.currentTarget.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = 'inline';
                        }}
                      />
                    ) : null}
                    <span
                      style={{ display: brand.logo_url ? 'none' : 'inline' }}
                      className="font-extrabold text-sm text-[#071A2B] group-hover:text-[#EF233C] font-display"
                    >
                      {brand.name.charAt(0)}
                    </span>
                  </div>

                  <span className="text-xs sm:text-sm font-bold text-[#071A2B] group-hover:text-[#EF233C] transition-colors truncate w-full">
                    {brand.name}
                  </span>

                  <span className="text-[10px] sm:text-[11px] font-medium text-gray-400 mt-0.5 tabular-nums whitespace-nowrap">
                    {FORMAT_NUMBER(count)} {count === 1 ? 'car' : 'cars'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
