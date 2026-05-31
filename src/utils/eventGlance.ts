import { differenceInCalendarDays, format, parse } from 'date-fns';
import { Event, EventType, RentalCarEvent, StayEvent } from '@/types/eventTypes';
import { WeatherSnapshot } from '@/types/weatherTypes';
import { getEventDisplayName, getEventEnd, getEventStart } from '@/utils/eventTime';
import {
  getMultidayEndpointDetails,
  MultidayEventDayRole,
} from '@/utils/timelineDates';

export const EVENT_TYPE_ACCENT_CLASSES: Partial<Record<EventType, string>> = {
  activity: 'border-l-indigo-500',
  flight: 'border-l-sky-500',
  stay: 'border-l-amber-500',
  rental_car: 'border-l-orange-500',
  train: 'border-l-slate-500',
  bus: 'border-l-slate-500',
  destination: 'border-l-emerald-500',
  arrival: 'border-l-sky-500',
  departure: 'border-l-sky-500',
};

export const EXPLORING_ACCENT_CLASS = 'border-l-[6px] border-l-stone-500/75 border-dashed';

/** Warm manilla paper — sketchbook draft treatment on the timeline. */
export const EXPLORING_CARD_CLASS = [
  '!border-2 !border-dashed !border-stone-300/90',
  'bg-[#F7F2E8]',
  'shadow-sm shadow-stone-400/20',
  '[background-image:repeating-linear-gradient(-45deg,transparent,transparent_11px,rgb(168_152_120_/_0.1)_11px,rgb(168_152_120_/_0.1)_12px)]',
].join(' ');

/** Title styling shared across timeline glance layouts. */
export const EXPLORING_TITLE_CLASS = 'italic text-stone-700';

/** Thumbnail treatment for draft events. */
export const EXPLORING_THUMBNAIL_IMAGE_CLASS = 'opacity-80 sepia-[0.18] saturate-[0.88]';

export const EXPLORING_THUMBNAIL_FRAME_CLASS =
  'ring-2 ring-dashed ring-stone-400/70 ring-offset-2 ring-offset-[#F7F2E8]';

export const formatEventGlanceTimeRange = (event: Event): string => {
  const start = getEventStart(event);
  const end = getEventEnd(event);
  if (!start) return 'Time not set';

  const sameDay = end && format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd');
  if (end && sameDay) {
    return `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`;
  }
  if (end) {
    return `${format(start, 'MMM d, h:mm a')} – ${format(end, 'MMM d, h:mm a')}`;
  }
  return format(start, 'MMM d · h:mm a');
};

export const formatEventDetailTimeRange = (event: Event): string => {
  const start = getEventStart(event);
  const end = getEventEnd(event);
  if (!start) return 'Time not set';

  const sameDay = end && format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd');
  if (end && sameDay) {
    return `${format(start, 'EEE, MMM d · h:mm a')} – ${format(end, 'h:mm a')}`;
  }
  if (end) {
    return `${format(start, 'EEE, MMM d · h:mm a')} – ${format(end, 'EEE, MMM d · h:mm a')}`;
  }
  return format(start, 'EEE, MMM d · h:mm a');
};

export const getWeatherGlanceLabelForEvent = (
  event: Event,
  weatherSnapshots: WeatherSnapshot[] = [],
): string | null => {
  const start = getEventStart(event);
  if (!start || weatherSnapshots.length === 0) return null;

  const dateKey = format(start, 'yyyy-MM-dd');
  for (const snapshot of weatherSnapshots) {
    const day = snapshot.daily?.find((entry) => entry.date === dateKey);
    if (!day) continue;

    if (typeof day.temperatureMax === 'number') {
      const temp = `${Math.round(day.temperatureMax)}°`;
      return day.condition ? `${day.condition} ${temp}` : temp;
    }
    return day.condition || null;
  }

  return null;
};

export const getEventCostGlanceLabel = (event: Event): string | null => {
  const data = event as unknown as { cost?: unknown; estimatedCost?: unknown };
  if (typeof data.cost === 'number' && Number.isFinite(data.cost)) {
    return `$${Math.round(data.cost)}`;
  }
  if (typeof data.estimatedCost === 'number' && Number.isFinite(data.estimatedCost)) {
    return `$${Math.round(data.estimatedCost)}`;
  }
  return null;
};

export const getEventVoteGlanceLabel = (event: Event): string | null => {
  if (event.status !== 'exploring') return null;
  const likes = event.likes?.length ?? 0;
  const dislikes = event.dislikes?.length ?? 0;
  if (likes === 0 && dislikes === 0) return null;
  if (dislikes === 0) return `${likes} like${likes === 1 ? '' : 's'}`;
  return `${likes}↑ ${dislikes}↓`;
};

const TRANSPORT_ROUTE_TYPES = new Set<EventType>(['flight', 'train', 'bus', 'rental_car']);

export const isTransportRouteEvent = (event: Event): boolean => (
  TRANSPORT_ROUTE_TYPES.has(event.type)
);

export const truncateGlanceLabel = (value: string, maxLength = 28): string => {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
};

export interface TransportRouteEndpoints {
  from: string;
  to: string;
}

export const getTransportRouteEndpoints = (event: Event): TransportRouteEndpoints | null => {
  const data = event as unknown as Record<string, string | undefined>;

  switch (event.type) {
    case 'flight':
      return {
        from: data.departureAirport?.trim() || 'Depart',
        to: data.arrivalAirport?.trim() || 'Arrive',
      };
    case 'train':
      return {
        from: data.departureStation?.trim() || 'Depart',
        to: data.arrivalStation?.trim() || 'Arrive',
      };
    case 'bus':
      return {
        from: data.departureStation?.trim() || 'Depart',
        to: data.arrivalStation?.trim() || 'Arrive',
      };
    case 'rental_car': {
      const rental = event as RentalCarEvent;
      return {
        from: rental.pickupLocation?.trim() || 'Pickup',
        to: rental.dropoffLocation?.trim() || 'Drop-off',
      };
    }
    default:
      return null;
  }
};

export const getTransportGlanceTitle = (event: Event): string => {
  const data = event as unknown as Record<string, string | undefined>;

  switch (event.type) {
    case 'flight': {
      const parts = [data.airline, data.flightNumber].filter(Boolean);
      return parts.length > 0 ? parts.join(' ') : getEventDisplayName(event);
    }
    case 'train':
      return data.trainOperator?.trim()
        || (data.trainNumber ? `Train ${data.trainNumber}` : getEventDisplayName(event));
    case 'bus':
      return data.busOperator?.trim()
        || (data.busNumber ? `Bus ${data.busNumber}` : getEventDisplayName(event));
    case 'rental_car': {
      const rental = event as RentalCarEvent;
      if (rental.carCompany?.trim() && rental.carType?.trim()) {
        return `${rental.carCompany} · ${rental.carType}`;
      }
      return rental.carCompany?.trim() || getEventDisplayName(event);
    }
    default:
      return getEventDisplayName(event);
  }
};

export const formatTransportGlanceTime = (event: Event): string | null => {
  const start = getEventStart(event);
  if (!start) return null;

  const end = getEventEnd(event);
  const departureTime = format(start, 'h:mm a');
  if (!end) return departureTime;

  const sameDay = format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd');
  if (sameDay) {
    return `${departureTime} – ${format(end, 'h:mm a')}`;
  }

  return `${format(start, 'MMM d, h:mm a')} – ${format(end, 'MMM d, h:mm a')}`;
};

export const getStayNightCount = (event: Event): number | null => {
  if (event.type !== 'stay') return null;

  const stay = event as StayEvent;
  const nights = differenceInCalendarDays(
    parse(stay.checkOut, 'yyyy-MM-dd', new Date()),
    parse(stay.checkIn, 'yyyy-MM-dd', new Date()),
  );
  return nights > 0 ? nights : null;
};

export const formatStayGlanceMeta = (event: Event): string => {
  if (event.type !== 'stay') return formatEventGlanceTimeRange(event);

  const stay = event as StayEvent;
  const nights = getStayNightCount(event);
  const checkIn = parse(stay.checkIn, 'yyyy-MM-dd', new Date());
  const checkOut = parse(stay.checkOut, 'yyyy-MM-dd', new Date());
  const dateRange = `${format(checkIn, 'MMM d')} – ${format(checkOut, 'MMM d')}`;

  if (nights) {
    return `${nights} night${nights === 1 ? '' : 's'} · ${dateRange}`;
  }

  return dateRange;
};

export const formatStayGlanceSchedule = (event: Event): string | null => {
  if (event.type !== 'stay') return null;

  const stay = event as StayEvent;
  const checkIn = parse(stay.checkIn, 'yyyy-MM-dd', new Date());
  const checkOut = parse(stay.checkOut, 'yyyy-MM-dd', new Date());

  if (stay.checkInTime) {
    const [hours, minutes] = stay.checkInTime.split(':').map(Number);
    checkIn.setHours(hours, minutes);
  }
  if (stay.checkOutTime) {
    const [hours, minutes] = stay.checkOutTime.split(':').map(Number);
    checkOut.setHours(hours, minutes);
  }

  return `${format(checkIn, 'MMM d, h:mm a')} → ${format(checkOut, 'MMM d, h:mm a')}`;
};

export const getEventGlanceRailTime = (
  event: Event,
  multidayRole?: MultidayEventDayRole | null,
): string | null => {
  if (multidayRole === 'middle') return '—';

  if (multidayRole === 'end') {
    return getMultidayEndpointDetails(event, 'end')?.time ?? null;
  }

  if (multidayRole === 'start') {
    return getMultidayEndpointDetails(event, 'start')?.time ?? null;
  }

  const start = getEventStart(event);
  if (!start) return null;
  return format(start, 'h:mm a');
};
