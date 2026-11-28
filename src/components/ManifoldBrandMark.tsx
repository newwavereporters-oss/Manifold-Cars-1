import React from 'react';

interface ManifoldBrandMarkProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ManifoldBrandMarkProps['size']>, string> = {
  xs: 'w-6 h-6 rounded-md',
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-9 h-9 rounded-xl',
  lg: 'w-12 h-12 rounded-2xl',
};

export const ManifoldBrandMark: React.FC<ManifoldBrandMarkProps> = ({
  size = 'sm',
  className = '',
}) => {
  return (
    <img
      src="/icons/icon-128.png"
      alt="MANIFOLD Red M"
      width={48}
      height={48}
      className={`${SIZE_CLASSES[size]} object-cover shrink-0 shadow-sm ring-1 ring-red-500/35 select-none ${className}`}
      decoding="async"
    />
  );
};
