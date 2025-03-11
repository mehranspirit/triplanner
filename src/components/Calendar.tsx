import React, { useState, useEffect, useRef } from 'react';
import { useTrip } from '../context/TripContext';
import { Trip, Event, StayEvent } from '../types';
import { Link } from 'react-router-dom';
import CalendarMap from './CalendarMap';

// Add the default thumbnail constant
const PREDEFINED_THUMBNAILS = {
  beach: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=800',
  mountain: 'https://images.pexels.com/photos/417173/pexels-photo-417173.jpeg?auto=compress&cs=tinysrgb&w=800',
  city: 'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=800',
  paris: 'https://images.pexels.com/photos/699466/pexels-photo-699466.jpeg?auto=compress&cs=tinysrgb&w=800',
  italy: 'https://images.pexels.com/photos/1797161/pexels-photo-1797161.jpeg?auto=compress&cs=tinysrgb&w=800',
  japan: 'https://images.pexels.com/photos/590478/pexels-photo-590478.jpeg?auto=compress&cs=tinysrgb&w=800',
  camping: 'https://images.pexels.com/photos/2666598/pexels-photo-2666598.jpeg?auto=compress&cs=tinysrgb&w=800',
  ski: 'https://images.pexels.com/photos/848599/pexels-photo-848599.jpeg?auto=compress&cs=tinysrgb&w=800',
  default: 'https://images.pexels.com/photos/1051073/pexels-photo-1051073.jpeg?auto=compress&cs=tinysrgb&w=800'
};

// Cache for storing thumbnail URLs
const thumbnailCache: { [key: string]: string } = {};

const getDefaultThumbnail = async (tripName: string): Promise<string> => {
  // Check cache first
  if (thumbnailCache[tripName]) {
    return thumbnailCache[tripName];
  }

  // Check predefined thumbnails
  const lowercaseName = tripName.toLowerCase();
  for (const [keyword, url] of Object.entries(PREDEFINED_THUMBNAILS)) {
    if (lowercaseName.includes(keyword)) {
      thumbnailCache[tripName] = url;
      return url;
    }
  }

  try {
    // Remove common words and get keywords from trip name
    const keywords = tripName
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter(word => !['trip', 'to', 'in', 'at', 'the', 'a', 'an'].includes(word))
      .join(' ');

    // Try to fetch from Pexels API
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keywords)}&per_page=1&orientation=landscape`,
      {
        headers: {
          'Authorization': import.meta.env.VITE_PEXELS_API_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from Pexels');
    }

    const data = await response.json();
    if (data.photos && data.photos.length > 0) {
      const imageUrl = data.photos[0].src.large2x;
      thumbnailCache[tripName] = imageUrl;
      return imageUrl;
    }
  } catch (error) {
    console.warn('Failed to fetch custom thumbnail:', error);
  }

  // Fallback to default travel image
  return PREDEFINED_THUMBNAILS.default;
};

interface TripDuration {
  trip: Trip;
  startDate: Date;
  endDate: Date;
  duration: number;
  thumbnail: string;
}

// Update SEASON_COLORS with more vibrant colors
const SEASON_COLORS = {
  winter: {
    bg: 'bg-blue-100',
    border: 'border-blue-200',
    text: 'text-blue-900'
  },
  spring: {
    bg: 'bg-emerald-100',
    border: 'border-emerald-200',
    text: 'text-emerald-900'
  },
  summer: {
    bg: 'bg-amber-100',
    border: 'border-amber-200',
    text: 'text-amber-900'
  },
  autumn: {
    bg: 'bg-orange-100',
    border: 'border-orange-200',
    text: 'text-orange-900'
  }
};

const getSeasonColors = (month: number) => {
  if (month >= 11 || month <= 1) return SEASON_COLORS.winter;
  if (month >= 2 && month <= 4) return SEASON_COLORS.spring;
  if (month >= 5 && month <= 7) return SEASON_COLORS.summer;
  return SEASON_COLORS.autumn;
};

const TripBar: React.FC<{
  trip: TripDuration;
  position: { left: string; width: string; top: string };
  monthStart: Date;
  monthEnd: Date;
  zIndex: number;
  formatDateRange: (start: Date, end: Date) => string;
  hasOverlap: boolean;
  height: number;
}> = ({ trip, position, monthStart, monthEnd, zIndex, formatDateRange, hasOverlap, height }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const dateRangeRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const [minWidth, setMinWidth] = useState<string | undefined>(undefined);
  const [showFullDateRange, setShowFullDateRange] = useState(true);
  const [showDateText, setShowDateText] = useState(true);

  // Check if trip is in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPastTrip = trip.endDate < today;

  useEffect(() => {
    if (contentRef.current && dateRangeRef.current && titleRef.current) {
      const monthWidth = contentRef.current.parentElement?.clientWidth || 0;
      const titleWidth = titleRef.current.scrollWidth + 16; // Add padding
      const dateHeight = dateRangeRef.current.scrollHeight;
      const titleHeight = titleRef.current.scrollHeight;
      const topHalfHeight = height / 2;
      
      // Check if there's enough space for both title and date
      const totalTextHeight = titleHeight + dateHeight;
      setShowDateText(totalTextHeight <= topHalfHeight - 4); // 4px buffer
      
      // 1. Calculate natural width based on date range
      const percentWidth = parseFloat(position.width);
      const naturalWidth = (monthWidth * percentWidth) / 100;

      // 2. Check if we need to expand for title
      let finalWidth = naturalWidth;
      if (naturalWidth < titleWidth) {
        finalWidth = titleWidth;
        setMinWidth(`${titleWidth}px`);
      } else {
        setMinWidth(undefined);
      }

      // 3. Check if date range fits in the final width
      if (showDateText) {
        const dateRangeElement = dateRangeRef.current;
        const dateRangeNeededWidth = dateRangeElement.scrollWidth;
        setShowFullDateRange(dateRangeNeededWidth <= finalWidth);
      }
    }
  }, [position.width, trip.trip.name, height]);

  const formatStartDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    };
    return date.toLocaleDateString('en-US', options);
  };

  const formatTooltipDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  };

  const tooltipText = `${trip.trip.name}
${formatTooltipDate(trip.startDate)} - ${formatTooltipDate(trip.endDate)}
${trip.duration} day${trip.duration !== 1 ? 's' : ''}`;

  return (
    <Link
      to={`/trips/${trip.trip._id}`}
      className="absolute bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow group overflow-hidden"
      style={{
        left: position.left,
        width: position.width,
        top: position.top,
        height: `${height}px`,
        minWidth,
        maxWidth: minWidth ? "calc(100% - 8px)" : undefined,
        zIndex
      }}
      title={tooltipText}
    >
      {/* Top half - Text content */}
      <div ref={contentRef} className="absolute top-0 left-0 right-0 h-1/2 bg-white p-2 z-10">
        <div ref={titleRef} className={`font-medium text-sm ${isPastTrip ? 'text-gray-600' : 'text-gray-900'} whitespace-nowrap`}>
          {trip.trip.name}
        </div>
        {showDateText && (
          <div ref={dateRangeRef} className={`text-xs ${isPastTrip ? 'text-gray-400' : 'text-gray-500'} truncate`}>
            {showFullDateRange 
              ? formatDateRange(trip.startDate, trip.endDate)
              : formatStartDate(trip.startDate)
            }
          </div>
        )}
      </div>
      
      {/* Bottom half - Thumbnail */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 overflow-hidden">
        <img
          src={trip.thumbnail}
          alt={trip.trip.name}
          className={`w-full h-full object-cover ${isPastTrip ? 'grayscale' : ''}`}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = PREDEFINED_THUMBNAILS.default;
          }}
        />
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity z-20"></div>
    </Link>
  );
};

const Calendar: React.FC = () => {
  const { state } = useTrip();
  const [tripDurations, setTripDurations] = useState<TripDuration[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const calculateTripDurations = async (trips: Trip[]): Promise<TripDuration[]> => {
    const durations = await Promise.all(trips.map(async trip => {
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      const sortedEvents = [...trip.events].sort((a, b) => {
        const dateA = a.type === 'stay' ? new Date((a as StayEvent).checkIn).getTime() : new Date(a.date).getTime();
        const dateB = b.type === 'stay' ? new Date((b as StayEvent).checkIn).getTime() : new Date(b.date).getTime();
        return dateA - dateB;
      });

      sortedEvents.forEach(event => {
        const eventDate = event.type === 'stay' 
          ? new Date((event as StayEvent).checkIn)
          : new Date(event.date);

        if (!startDate || eventDate < startDate) {
          startDate = eventDate;
        }

        if (event.type === 'stay') {
          const checkoutDate = new Date((event as StayEvent).checkOut);
          if (!endDate || checkoutDate > endDate) {
            endDate = checkoutDate;
          }
        } else {
          if (!endDate || eventDate > endDate) {
            endDate = eventDate;
          }
        }
      });

      if (!startDate) startDate = new Date();
      if (!endDate) endDate = startDate;

      const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Get thumbnail, using trip's thumbnail if available, otherwise fetch a default one
      const thumbnail = trip.thumbnailUrl || await getDefaultThumbnail(trip.name);

      return {
        trip,
        startDate,
        endDate,
        duration,
        thumbnail
      };
    }));

    return durations.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  };

  useEffect(() => {
    const loadTripDurations = async () => {
      const durations = await calculateTripDurations(state.trips);
      setTripDurations(durations);
    };
    loadTripDurations();
  }, [state.trips]);

  const getMonthName = (month: number) => {
    return new Date(2000, month).toLocaleString('default', { month: 'long' });
  };

  const formatDateRange = (start: Date, end: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric',
      year: start.getFullYear() !== end.getFullYear() ? 'numeric' : undefined
    };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}${end.getFullYear() !== start.getFullYear() ? `, ${end.getFullYear()}` : ''}`;
  };

  const calculateTripPosition = (trip: TripDuration, monthStart: Date, monthEnd: Date) => {
    const monthLength = monthEnd.getTime() - monthStart.getTime();
    
    // Calculate the visible portion of the trip within this month
    const visibleStart = Math.max(trip.startDate.getTime(), monthStart.getTime());
    const visibleEnd = Math.min(trip.endDate.getTime(), monthEnd.getTime());
    
    // Calculate position as percentage of month width
    const left = ((visibleStart - monthStart.getTime()) / monthLength) * 100;
    const width = ((visibleEnd - visibleStart) / monthLength) * 100;

    // Ensure minimum percentage for very short trips
    const finalWidth = Math.max(width, 5); // At least 5% of month width

    return {
      left: `${left}%`,
      width: `${finalWidth}%`
    };
  };

  // Update calculateVerticalPositions to be more strict with overlap detection
  const calculateVerticalPositions = (trips: TripDuration[], monthStart: Date, monthEnd: Date) => {
    if (trips.length <= 1) return { positions: new Map<string, number>(), hasOverlap: false };

    const positions = new Map<string, number>();
    const layers: { start: number; end: number; width: number }[][] = [[]];

    trips.forEach(trip => {
      const visibleStart = Math.max(trip.startDate.getTime(), monthStart.getTime());
      const visibleEnd = Math.min(trip.endDate.getTime(), monthEnd.getTime());
      const monthLength = monthEnd.getTime() - monthStart.getTime();
      const left = ((visibleStart - monthStart.getTime()) / monthLength) * 100;
      const width = ((visibleEnd - visibleStart) / monthLength) * 100;

      // Find a layer where this trip doesn't overlap with any existing trips
      let layerIndex = 0;
      let foundLayer = false;

      while (!foundLayer) {
        const currentLayer = layers[layerIndex];
        const hasOverlap = currentLayer.some(
          existing => {
            // Check if the trips overlap in time and space
            const horizontalOverlap = (
              (left < (existing.start + existing.width)) && 
              ((left + width) > existing.start)
            );
            return horizontalOverlap;
          }
        );

        if (!hasOverlap) {
          currentLayer.push({ 
            start: left,
            end: left + width,
            width: width
          });
          positions.set(trip.trip._id, layerIndex);
          foundLayer = true;
        } else {
          layerIndex++;
          if (layerIndex === layers.length) {
            layers.push([]);
          }
        }
      }
    });

    return { 
      positions,
      hasOverlap: layers.length > 1
    };
  };

  // Update renderMonth function
  const renderMonth = (month: number) => {
    const monthStart = new Date(selectedYear, month, 1);
    const monthEnd = new Date(selectedYear, month + 1, 0);
    const monthTrips = tripDurations.filter(trip => 
      trip.startDate <= monthEnd && trip.endDate >= monthStart
    ).sort((a, b) => {
      const aDuration = a.endDate.getTime() - a.startDate.getTime();
      const bDuration = b.endDate.getTime() - b.startDate.getTime();
      return bDuration - aDuration;
    });

    const { positions: verticalPositions, hasOverlap } = calculateVerticalPositions(monthTrips, monthStart, monthEnd);
    const layerCount = hasOverlap ? 
      Math.max(...Array.from(verticalPositions.values())) + 1 : 
      1;

    // Dynamic sizing based on number of trips
    const CONTAINER_MIN_HEIGHT = 160;
    const CONTAINER_MAX_HEIGHT = 300;
    const MIN_BAR_HEIGHT = 32;
    const MIN_SPACING = 8;

    // Calculate optimal bar height and spacing
    const availableHeight = Math.min(CONTAINER_MAX_HEIGHT, Math.max(CONTAINER_MIN_HEIGHT, layerCount * 50));
    const barHeight = Math.max(MIN_BAR_HEIGHT, Math.floor((availableHeight - (layerCount + 1) * MIN_SPACING) / layerCount));
    const spacing = Math.max(MIN_SPACING, Math.floor((availableHeight - layerCount * barHeight) / (layerCount + 1)));

    const seasonColors = getSeasonColors(month);

    // Calculate today's position if it's in this month
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === selectedYear;
    const todayPosition = isCurrentMonth ? 
      ((today.getTime() - monthStart.getTime()) / (monthEnd.getTime() - monthStart.getTime())) * 100 : 
      null;

    return (
      <div key={month} className="rounded-lg shadow overflow-hidden h-full bg-white">
        <div className={`p-3 border-b ${seasonColors.border}`}>
          <h3 className={`text-lg font-semibold ${seasonColors.text}`}>
            {getMonthName(month)}
          </h3>
        </div>
        <div className="p-3">
          <div className={`relative rounded-lg ${seasonColors.bg} bg-opacity-75`} 
               style={{ height: `${availableHeight}px` }}>
            {/* Today's date line */}
            {todayPosition !== null && (
              <div 
                className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-30"
                style={{ 
                  left: `${todayPosition}%`,
                  boxShadow: '0 0 4px rgba(239, 68, 68, 0.5)'
                }}
              >
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-1 py-0.5 rounded">
                  Today
                </div>
              </div>
            )}
            {monthTrips.map((trip, index) => {
              const position = calculateTripPosition(trip, monthStart, monthEnd);
              const verticalPosition = verticalPositions.get(trip.trip._id) || 0;
              return (
                <TripBar
                  key={trip.trip._id}
                  trip={trip}
                  position={{
                    ...position,
                    top: hasOverlap 
                      ? `${verticalPosition * (barHeight + spacing) + spacing}px`
                      : `${(availableHeight - barHeight) / 2}px` // Center single bar vertically
                  }}
                  monthStart={monthStart}
                  monthEnd={monthEnd}
                  zIndex={monthTrips.length - index}
                  formatDateRange={formatDateRange}
                  hasOverlap={hasOverlap}
                  height={barHeight}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Map View */}
      <div className="bg-white shadow rounded-lg overflow-hidden relative" style={{ zIndex: 0 }}>
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Trip Locations</h2>
          <CalendarMap trips={state.trips} />
        </div>
      </div>

      {/* Trip List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Trip Calendar</h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedYear(selectedYear - 1)}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                ←
              </button>
              <span className="text-lg font-medium">{selectedYear}</span>
              <button
                onClick={() => setSelectedYear(selectedYear + 1)}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                →
              </button>
            </div>
          </div>
          
          {state.loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : state.error ? (
            <div className="text-red-600 text-center">{state.error}</div>
          ) : tripDurations.length === 0 ? (
            <div className="text-gray-500 text-center py-8">No trips found</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 12 }, (_, i) => renderMonth(i))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calendar; 