import React from 'react';

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ width = 200, height = 200, className = '' }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 200 200" 
      width={width} 
      height={height}
      className={`transition-transform duration-300 hover:scale-110 ${className}`}
    >
      <defs>
        {/* Background gradient for the pin */}
        <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4CAF50" stopOpacity="1" />
          <stop offset="100%" stopColor="#2196F3" stopOpacity="1" />
        </linearGradient>
        {/* Radial gradient for the sunset sun */}
        <radialGradient id="sunsetGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF4500" stopOpacity="1" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="1" />
        </radialGradient>
      </defs>
      {/* Location pin shape with hover effect */}
      <path 
        d="M100 20 C70 20 40 50 40 80 C40 130 100 180 100 180 C100 180 160 130 160 80 C160 50 130 20 100 20 Z" 
        fill="url(#grad1)"
        className="transition-transform origin-bottom duration-300 hover:scale-105"
      />
      {/* Slightly smaller sunset circle with hover effect */}
      <circle 
        cx="100" 
        cy="80" 
        r="25" 
        fill="url(#sunsetGradient)"
        className="transition-transform duration-300 hover:scale-110"
      />
    </svg>
  );
};

export default Logo; 