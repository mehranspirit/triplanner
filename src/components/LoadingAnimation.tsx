import React from 'react';

const LoadingAnimation: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8">
      <div className="relative w-48 h-48">
        {/* Globe */}
        <div className="absolute inset-0 rounded-full border-4 border-indigo-200 border-dashed animate-spin-slow"></div>
        
        {/* Continents (simplified) */}
        <div className="absolute top-6 left-10 w-12 h-8 bg-indigo-300 rounded-full opacity-60"></div>
        <div className="absolute top-14 right-10 w-16 h-10 bg-indigo-300 rounded-full opacity-60"></div>
        <div className="absolute bottom-12 left-16 w-14 h-8 bg-indigo-300 rounded-full opacity-60"></div>
        
        {/* Latitude lines */}
        <div className="absolute inset-4 rounded-full border border-indigo-100 opacity-70"></div>
        <div className="absolute inset-10 rounded-full border border-indigo-100 opacity-70"></div>
        <div className="absolute inset-16 rounded-full border border-indigo-100 opacity-70"></div>
        
        {/* Longitude lines */}
        <div className="absolute top-0 bottom-0 left-1/2 -ml-px w-0.5 h-full bg-indigo-100 opacity-70"></div>
        <div className="absolute top-1/2 -mt-px left-0 right-0 h-0.5 w-full bg-indigo-100 opacity-70"></div>
        <div className="absolute top-0 bottom-0 left-1/2 -ml-px w-0.5 h-full bg-indigo-100 opacity-70 transform rotate-45"></div>
        <div className="absolute top-0 bottom-0 left-1/2 -ml-px w-0.5 h-full bg-indigo-100 opacity-70 transform -rotate-45"></div>
        
        {/* Airplane animation */}
        <div className="absolute w-full h-full animate-orbit">
          <div className="absolute -top-5 left-1/2 -ml-5 w-10 h-10 text-indigo-600 transform -rotate-90">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22,16.21V14.6a1,1,0,0,0-.47-.85l-9.31-5.4V6.28A1.81,1.81,0,0,0,10.4,4.5,1.77,1.77,0,0,0,8.64,6.28V8.35L2.5,12.2A1,1,0,0,0,2,13.08v1.13a.5.5,0,0,0,.5.5.5.5,0,0,0,.5-.5v-.58l5.49-2.25v2.87a.5.5,0,0,0,.5.5.5.5,0,0,0,.5-.5V11.38l9.52,5.5a.5.5,0,0,0,.68-.18A.51.51,0,0,0,20,16.5.5.5,0,0,0,22,16.21Z"/>
            </svg>
          </div>
        </div>
        
        {/* Flight path */}
        <div className="absolute inset-2 rounded-full border-2 border-indigo-200 border-dashed opacity-40"></div>
        
        {/* Cloud decorations */}
        <div className="absolute -top-8 -left-8 animate-float" style={{ animationDelay: '0.2s' }}>
          <div className="w-16 h-8 bg-white rounded-full opacity-80"></div>
          <div className="w-10 h-6 bg-white rounded-full opacity-80 -mt-4 ml-4"></div>
        </div>
        
        <div className="absolute -bottom-6 -right-10 animate-float" style={{ animationDelay: '1.2s' }}>
          <div className="w-20 h-10 bg-white rounded-full opacity-80"></div>
          <div className="w-12 h-8 bg-white rounded-full opacity-80 -mt-5 ml-6"></div>
        </div>
        
        <div className="absolute top-1/4 -right-8 animate-float" style={{ animationDelay: '0.7s' }}>
          <div className="w-14 h-7 bg-white rounded-full opacity-80"></div>
          <div className="w-8 h-5 bg-white rounded-full opacity-80 -mt-3 ml-3"></div>
        </div>
      </div>
      
      <div className="mt-8 text-center">
        <p className="text-xl text-indigo-600 font-medium animate-pulse">Taking off...</p>
        <p className="text-sm text-indigo-400 mt-2">Preparing your journey</p>
      </div>
    </div>
  );
};

export default LoadingAnimation; 