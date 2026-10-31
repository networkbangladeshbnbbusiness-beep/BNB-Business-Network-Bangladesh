import React from 'react';

interface BNBLogoProps {
  className?: string;
  size?: number | string;
  variant?: 'white' | 'emerald' | 'currentColor' | 'black';
}

export const BNBLogo: React.FC<BNBLogoProps> = ({ 
  className = '', 
  size = '100%'
}) => {
  const dimensionStyle =
    typeof size === 'number'
      ? { width: `${size}px`, height: `${size}px` }
      : size !== '100%'
        ? { width: size, height: size }
        : undefined;

  return (
    <img
      src="/logo.png"
      alt="BNB Official Logo"
      style={dimensionStyle}
      className={`${className} object-contain select-none rounded-lg`}
      referrerPolicy="no-referrer"
    />
  );
};
