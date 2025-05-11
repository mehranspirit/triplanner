import React from 'react';
import { cn } from '@/lib/utils';
import { FaPlane, FaTrain, FaBus, FaCar, FaHotel, FaMapMarkerAlt, FaMountain } from 'react-icons/fa';

interface TripLoadingProps {
  className?: string;
}

const TripLoading: React.FC<TripLoadingProps> = ({ className }) => {
  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[400px] space-y-8", className)}>
      <div className="relative w-48 h-48 mt-28">
        {/* Animated plane */}
        <div className="absolute inset-0 animate-[orbit_3s_linear_infinite]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <FaPlane className="w-8 h-8 text-blue-500 transform -rotate-45" />
          </div>
        </div>
        
        {/* Animated train */}
        <div className="absolute inset-0 animate-[orbit_4s_linear_infinite]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <FaTrain className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        {/* Animated bus */}
        <div className="absolute inset-0 animate-[orbit_5s_linear_infinite]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <FaBus className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        
        {/* Animated car */}
        <div className="absolute inset-0 animate-[orbit_6s_linear_infinite]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <FaCar className="w-8 h-8 text-red-500" />
          </div>
        </div>
        
        {/* Animated hotel */}
        <div className="absolute inset-0 animate-[orbit_7s_linear_infinite]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <FaHotel className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        
        {/* Animated destination */}
        <div className="absolute inset-0 animate-[orbit_8s_linear_infinite]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <FaMapMarkerAlt className="w-8 h-8 text-pink-500" />
          </div>
        </div>
        
        {/* Animated activity */}
        <div className="absolute inset-0 animate-[orbit_9s_linear_infinite]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <FaMountain className="w-8 h-8 text-indigo-500" />
          </div>
        </div>
      </div>
      
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-gray-800">Loading your trip...</h3>
        <p className="text-sm text-gray-500">Gathering all the details for your adventure</p>
      </div>
    </div>
  );
};

export default TripLoading; 