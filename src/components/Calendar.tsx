import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTrip } from '../context/TripContext';
import { Trip, Event, StayEvent } from '../types/eventTypes';
import { Link } from 'react-router-dom';
import CalendarMap from './CalendarMap';
import { format, parseISO, isValid, startOfMonth, endOfMonth, isSameMonth, isToday } from 'date-fns';
import { cn } from '../lib/utils';

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
  startDate: Date;
  endDate: Date;
  duration: number;
  tripId: string;
  trip: Trip;
}

interface TripDurations {
  [key: string]: TripDuration;
}

interface CategorizedTrips {
  ongoing: Trip[];
  upcoming: Trip[];
  past: Trip[];
}

const categorizeTripsByDate = (trips: Trip[], durations: TripDurations): CategorizedTrips => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return trips.reduce((acc: CategorizedTrips, trip: Trip) => {
    const duration = durations[trip._id];
    if (!duration) return acc;

    const { startDate, endDate } = duration;
    
    if (startDate <= today && today <= endDate) {
      acc.ongoing.push(trip);
    } else if (startDate > today) {
      acc.upcoming.push(trip);
    } else {
      acc.past.push(trip);
    }
    
    return acc;
  }, { ongoing: [], upcoming: [], past: [] });
};

// Update SEASON_COLORS with more vibrant colors and hover states
const SEASON_COLORS = {
  winter: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-900',
    hover: 'hover:bg-blue-100'
  },
  spring: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
    hover: 'hover:bg-emerald-100'
  },
  summer: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    hover: 'hover:bg-amber-100'
  },
  autumn: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-900',
    hover: 'hover:bg-orange-100'
  }
};

const getSeasonColors = (month: number) => {
  if (month >= 11 || month <= 1) return SEASON_COLORS.winter;
  if (month >= 2 && month <= 4) return SEASON_COLORS.spring;
  if (month >= 5 && month <= 7) return SEASON_COLORS.summer;
  return SEASON_COLORS.autumn;
};

const TripBar: React.FC<{
  trip: Trip;
  position: { left: string; width: string; top: string };
  monthStart: Date;
  monthEnd: Date;
  zIndex: number;
  formatDateRange: (start: Date, end: Date) => string;
  hasOverlap: boolean;
  height: number;
  duration: TripDuration;
}> = ({ trip, position, monthStart, monthEnd, zIndex, formatDateRange, hasOverlap, height, duration }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const dateRangeRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const [minWidth, setMinWidth] = useState<string | undefined>(undefined);
  const [showFullDateRange, setShowFullDateRange] = useState(true);
  const [showDateText, setShowDateText] = useState(true);

  // Check if trip is in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPastTrip = duration.endDate < today;

  useEffect(() => {
    if (contentRef.current && dateRangeRef.current && titleRef.current) {
      const monthWidth = contentRef.current.parentElement?.clientWidth || 0;
      const titleWidth = titleRef.current.scrollWidth + 16;
      const dateHeight = dateRangeRef.current.scrollHeight;
      const titleHeight = titleRef.current.scrollHeight;
      const topHalfHeight = height / 2;
      
      setShowDateText(titleHeight + dateHeight <= topHalfHeight - 4);
      
      let finalWidth = (monthWidth * parseFloat(position.width)) / 100;
      if (finalWidth < titleWidth) {
        finalWidth = titleWidth;
        setMinWidth(`${titleWidth}px`);
      } else {
        setMinWidth(undefined);
      }

      if (showDateText) {
        const dateRangeElement = dateRangeRef.current;
        setShowFullDateRange(dateRangeElement.scrollWidth <= finalWidth);
      }
    }
  }, [position.width, height, showDateText]);

  const formatStartDate = (date: Date) => {
    return format(date, 'MMM d');
  };

  const formatTooltipDate = (date: Date) => {
    return format(date, 'EEE, MMM d, yyyy');
  };

  const tooltipText = `${trip.name}
${formatTooltipDate(duration.startDate)} - ${formatTooltipDate(duration.endDate)}
${duration.duration} day${duration.duration !== 1 ? 's' : ''}`;

  return (
    <Link
      to={`/trips/${duration.tripId}`}
      className={cn(
        "absolute bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 group overflow-hidden",
        isPastTrip ? 'opacity-75' : 'opacity-100'
      )}
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
      <div ref={contentRef} className="absolute top-0 left-0 right-0 h-1/2 bg-white/95 backdrop-blur-sm p-1.5 z-10">
        <div ref={titleRef} className={cn(
          "font-medium text-xs whitespace-nowrap",
          isPastTrip ? 'text-gray-600' : 'text-gray-900'
        )}>
          {trip.name}
        </div>
        {showDateText && (
          <div ref={dateRangeRef} className={cn(
            "text-xs truncate",
            isPastTrip ? 'text-gray-400' : 'text-gray-500'
          )}>
            {showFullDateRange 
              ? formatDateRange(duration.startDate, duration.endDate)
              : formatStartDate(duration.startDate)
            }
          </div>
        )}
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-1/2 overflow-hidden">
        <img
          src={trip.thumbnailUrl || PREDEFINED_THUMBNAILS.default}
          alt={trip.name}
          className={cn(
            "w-full h-full object-cover transition-all duration-200",
            isPastTrip ? 'grayscale' : '',
            "group-hover:scale-105"
          )}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = PREDEFINED_THUMBNAILS.default;
          }}
        />
      </div>

      <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity z-20"></div>
    </Link>
  );
};

// Add this helper function at the top level
const parseSafeDate = (dateStr: string | undefined): Date | null => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch (e) {
    return null;
  }
};

// Update formatDateRange function
const formatDateRange = (start: Date, end: Date) => {
  try {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric',
      year: start.getFullYear() !== end.getFullYear() ? 'numeric' : undefined
    };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}${end.getFullYear() !== start.getFullYear() ? `, ${end.getFullYear()}` : ''}`;
  } catch (e) {
    return 'Invalid date range';
  }
};

const Calendar: React.FC = () => {
  const { state } = useTrip();
  const [tripDurations, setTripDurations] = useState<TripDurations>({});
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    const calculateTripDurations = () => {
      const durations: TripDurations = {};
      
      state.trips.forEach(trip => {
        let startDate: Date | null = null;
        let endDate: Date | null = null;

        // Sort events by date
        const sortedEvents = [...trip.events].sort((a, b) => {
          const getEventDate = (event: Event): Date | null => {
            if (event.type === 'stay' && (event as StayEvent).checkIn) {
              return parseSafeDate((event as StayEvent).checkIn);
            } else if (event.startDate) {
              return parseSafeDate(event.startDate);
            }
            return null;
          };

          const dateA = getEventDate(a) || new Date(0);
          const dateB = getEventDate(b) || new Date(0);
          return dateA.getTime() - dateB.getTime();
        });

        sortedEvents.forEach(event => {
          let eventStartDate: Date | null = null;
          let eventEndDate: Date | null = null;

          if (event.type === 'stay') {
            eventStartDate = parseSafeDate((event as StayEvent).checkIn);
            eventEndDate = parseSafeDate((event as StayEvent).checkOut);
          } else {
            eventStartDate = parseSafeDate(event.startDate);
            eventEndDate = parseSafeDate(event.endDate) || eventStartDate;
          }

          if (eventStartDate && (!startDate || eventStartDate < startDate)) {
            startDate = eventStartDate;
          }
          if (eventEndDate && (!endDate || eventEndDate > endDate)) {
            endDate = eventEndDate;
          }
        });

        // If no valid dates found from events, try trip dates
        if (!startDate && trip.startDate) {
          startDate = parseSafeDate(trip.startDate);
        }
        if (!endDate && trip.endDate) {
          endDate = parseSafeDate(trip.endDate);
        }

        // Final fallback to current date if still no valid dates
        if (!startDate) startDate = new Date();
        if (!endDate) endDate = startDate;

        const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        durations[trip._id] = {
          startDate,
          endDate,
          duration: Math.max(duration, 1), // Ensure duration is at least 1 day
          tripId: trip._id,
          trip: trip
        };
      });

      setTripDurations(durations);
    };

    calculateTripDurations();
  }, [state.trips]);

  const getMonthName = (month: number) => {
    return format(new Date(2000, month), 'MMMM');
  };

  const formatDateRange = (start: Date, end: Date) => {
    const sameYear = start.getFullYear() === end.getFullYear();
    const formatStr = sameYear ? 'MMM d' : 'MMM d, yyyy';
    return `${format(start, formatStr)} - ${format(end, formatStr)}`;
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
          positions.set(trip.tripId, layerIndex);
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

  // Move monthTrips calculation outside renderMonth
  const monthTrips = useMemo(() => {
    const monthTripsMap = new Array(12).fill(null).map((_, month) => {
      const monthStart = startOfMonth(new Date(selectedYear, month));
      const monthEnd = endOfMonth(monthStart);
      
      return Object.values(tripDurations)
        .filter(trip => trip.startDate <= monthEnd && trip.endDate >= monthStart)
        .sort((a, b) => {
          const aDuration = a.endDate.getTime() - a.startDate.getTime();
          const bDuration = b.endDate.getTime() - b.startDate.getTime();
          return bDuration - aDuration;
        });
    });
    return monthTripsMap;
  }, [tripDurations, selectedYear]);

  const renderMonth = (month: number) => {
    const monthStart = startOfMonth(new Date(selectedYear, month));
    const monthEnd = endOfMonth(monthStart);
    
    const monthTripData = monthTrips[month];

    const { positions: verticalPositions, hasOverlap } = calculateVerticalPositions(monthTripData, monthStart, monthEnd);
    const layerCount = hasOverlap ? 
      Math.max(...Array.from(verticalPositions.values())) + 1 : 
      1;

    // Dynamic sizing based on number of trips
    const CONTAINER_MIN_HEIGHT = 140;
    const CONTAINER_MAX_HEIGHT = 240;
    const MIN_BAR_HEIGHT = 28;
    const MIN_SPACING = 6;

    // Calculate optimal bar height and spacing
    const availableHeight = Math.min(CONTAINER_MAX_HEIGHT, Math.max(CONTAINER_MIN_HEIGHT, layerCount * 40));
    const barHeight = Math.max(MIN_BAR_HEIGHT, Math.floor((availableHeight - (layerCount + 1) * MIN_SPACING) / layerCount));
    const spacing = Math.max(MIN_SPACING, Math.floor((availableHeight - layerCount * barHeight) / (layerCount + 1)));

    const seasonColors = getSeasonColors(month);

    // Calculate today's position if it's in this month
    const today = new Date();
    const isCurrentMonth = isSameMonth(today, monthStart);
    const todayPosition = isCurrentMonth ? 
      ((today.getTime() - monthStart.getTime()) / (monthEnd.getTime() - monthStart.getTime())) * 100 : 
      null;

    return (
      <div key={month} className="rounded-lg shadow overflow-hidden h-full bg-white">
        <div className={cn("p-2 border-b", seasonColors.border)}>
          <h3 className={cn("text-base font-semibold", seasonColors.text)}>
            {getMonthName(month)}
          </h3>
        </div>
        <div className="p-2">
          <div className={cn(
            "relative rounded-lg transition-colors duration-200",
            seasonColors.bg,
            seasonColors.hover
          )} 
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
            {monthTripData.map((tripDuration, index) => {
              const position = calculateTripPosition(tripDuration, monthStart, monthEnd);
              const verticalPosition = verticalPositions.get(tripDuration.tripId) || 0;
              return (
                <TripBar
                  key={tripDuration.tripId}
                  trip={tripDuration.trip}
                  position={{
                    ...position,
                    top: hasOverlap 
                      ? `${verticalPosition * (barHeight + spacing) + spacing}px`
                      : `${(availableHeight - barHeight) / 2}px` // Center single bar vertically
                  }}
                  monthStart={monthStart}
                  monthEnd={monthEnd}
                  zIndex={monthTripData.length - index}
                  formatDateRange={formatDateRange}
                  hasOverlap={hasOverlap}
                  height={barHeight}
                  duration={tripDuration}
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
          ) : Object.keys(tripDurations).length === 0 ? (
            <div className="text-gray-500 text-center py-8">No trips found</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 12 }, (_, i) => renderMonth(i))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calendar; 