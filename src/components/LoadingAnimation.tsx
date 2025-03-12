import React from 'react';

const LoadingAnimation: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px]">
      <div className="animate-spin-slow w-16 h-16 rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
      <p className="mt-4 text-lg text-indigo-600 font-medium animate-pulse">Taking off...</p>
    </div>
  );
};

export default LoadingAnimation; 