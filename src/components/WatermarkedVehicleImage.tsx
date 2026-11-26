import React, { useEffect, useState } from 'react';
import { CarFront } from 'lucide-react';

interface WatermarkedVehicleImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallback?: React.ReactNode;
  loading?: 'lazy' | 'eager';
  showWatermark?: boolean;
  watermarkSize?: 'sm' | 'md' | 'lg';
  onError?: () => void;
}

export const WatermarkedVehicleImage: React.FC<WatermarkedVehicleImageProps> = ({
  src,
  alt,
  className = '',
  imgClassName = 'w-full h-full object-cover',
  fallback,
  loading = 'lazy',
  showWatermark = true,
  watermarkSize = 'md',
  onError,
}) => {
  const [hasError, setHasError] = useState(false);
  const cleanSrc = (src || '').trim();

  useEffect(() => {
    setHasError(false);
  }, [cleanSrc]);

  if (!cleanSrc || hasError) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div
        className={`relative overflow-hidden bg-slate-100 flex flex-col items-center justify-center text-slate-400 ${className}`}
        aria-label={alt}
      >
        <CarFront className="w-7 h-7 opacity-60" />
      </div>
    );
  }

  const textSizeClass =
    watermarkSize === 'sm'
      ? 'text-[11px] sm:text-xs tracking-[0.26em]'
      : watermarkSize === 'lg'
        ? 'text-2xl sm:text-4xl md:text-5xl tracking-[0.34em]'
        : 'text-base sm:text-xl md:text-2xl tracking-[0.3em]';

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      data-manifold-watermarked={showWatermark ? 'true' : 'false'}
    >
      <img
        src={cleanSrc}
        alt={alt}
        loading={loading}
        className={imgClassName}
        onError={() => {
          setHasError(true);
          onError?.();
        }}
      />
      {showWatermark && (
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-0 flex items-center justify-center overflow-hidden"
        >
          <span
            className={`-rotate-12 font-black uppercase text-white/[0.11] drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)] whitespace-nowrap ${textSizeClass}`}
          >
            MANIFOLD
          </span>
        </div>
      )}
    </div>
  );
};
