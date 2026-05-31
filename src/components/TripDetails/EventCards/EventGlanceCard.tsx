import React from 'react';
import {
  FaBus,
  FaCar,
  FaHotel,
  FaMapMarkerAlt,
  FaMountain,
  FaPlane,
  FaTrain,
} from 'react-icons/fa';
import { ChevronRight } from 'lucide-react';
import { Event } from '@/types/eventTypes';
import { WeatherSnapshot } from '@/types/weatherTypes';
import { cn } from '@/lib/utils';
import { tripSurfaces } from '@/styles/tripSurfaces';
import { getEventLocationLabel } from '@/utils/eventTime';
import { isEventCurrentlyActive } from '@/utils/eventGlow';
import { useTripReferenceNow } from '@/components/TripDetails/TripReferenceNowContext';
import {
  EVENT_TYPE_ACCENT_CLASSES,
  EXPLORING_ACCENT_CLASS,
} from '@/utils/eventGlance';
import { MultidayEventDayRole } from '@/utils/timelineDates';
import EventGlanceMetaChips from '@/components/TripDetails/EventCards/EventGlanceMetaChips';
import EventGlanceAttentionChips from '@/components/TripDetails/EventCards/EventGlanceAttentionChips';
import { EventGlanceContent } from '@/components/TripDetails/EventCards/glances/eventGlanceLayouts';
import { EventGlanceAttention } from '@/components/TripDetails/EventCards/glances/EventGlanceContentProps';

const getEventIcon = (event: Event) => {
  switch (event.type) {
    case 'flight':
      return <FaPlane className="h-4 w-4 text-sky-600" />;
    case 'arrival':
      return <FaPlane className="h-4 w-4 rotate-45 text-sky-600" />;
    case 'departure':
      return <FaPlane className="h-4 w-4 -rotate-45 text-sky-600" />;
    case 'train':
      return <FaTrain className="h-4 w-4 text-slate-600" />;
    case 'bus':
      return <FaBus className="h-4 w-4 text-slate-600" />;
    case 'rental_car':
      return <FaCar className="h-4 w-4 text-orange-600" />;
    case 'stay':
      return <FaHotel className="h-4 w-4 text-amber-600" />;
    case 'destination':
      return <FaMapMarkerAlt className="h-4 w-4 text-emerald-600" />;
    case 'activity':
      return <FaMountain className="h-4 w-4 text-indigo-600" />;
    default:
      return <FaMapMarkerAlt className="h-4 w-4 text-slate-500" />;
  }
};

export interface EventGlanceCardProps {
  event: Event;
  thumbnail: string;
  weatherSnapshots?: WeatherSnapshot[];
  onOpenDetail?: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  isSelectable?: boolean;
  onToggleSelected?: () => void;
  showTimeInBody?: boolean;
  multidayRole?: MultidayEventDayRole | null;
  viewDateKey?: string;
  attention?: EventGlanceAttention;
  onOpenDecision?: () => void;
  onReviewLocation?: () => void;
}

const EventGlanceCard: React.FC<EventGlanceCardProps> = ({
  event,
  thumbnail,
  weatherSnapshots = [],
  onOpenDetail,
  isSelectionMode = false,
  isSelected = false,
  isSelectable = false,
  onToggleSelected,
  showTimeInBody = true,
  multidayRole = null,
  viewDateKey,
  attention,
  onOpenDecision,
  onReviewLocation,
}) => {
  const { referenceNow } = useTripReferenceNow();
  const isExploring = event.status === 'exploring';
  const isActive = isEventCurrentlyActive(event, referenceNow);
  const location = getEventLocationLabel(event)
    || (event as { address?: string }).address
    || undefined;
  const accentClass = isExploring
    ? EXPLORING_ACCENT_CLASS
    : (EVENT_TYPE_ACCENT_CLASSES[event.type] ?? 'border-l-slate-300');
  const isMultidayMiddle = multidayRole === 'middle';

  return (
    <div>
      <div
      role={!isSelectionMode && onOpenDetail ? 'button' : undefined}
      tabIndex={!isSelectionMode && onOpenDetail ? 0 : undefined}
      className={cn(
        tripSurfaces.content,
        tripSurfaces.contentHover,
        'relative flex min-w-0 items-center gap-3 border-l-4 p-3 pl-2.5',
        accentClass,
        isExploring && 'bg-amber-50/35',
        isMultidayMiddle && 'border-dashed bg-slate-50/70',
        isActive && !isExploring && 'bg-blue-50/45 ring-1 ring-blue-100/80',
        !isExploring && 'hover:border-slate-300/80',
        isSelectionMode && isSelected && 'ring-2 ring-violet-300',
        isSelectionMode && isSelectable && 'cursor-pointer',
        !isSelectionMode && onOpenDetail && 'cursor-pointer',
      )}
      onClick={
        isSelectionMode && isSelectable
          ? onToggleSelected
          : !isSelectionMode
            ? onOpenDetail
            : undefined
      }
      onKeyDown={
        !isSelectionMode && onOpenDetail
          ? (keyboardEvent) => {
            if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
              keyboardEvent.preventDefault();
              onOpenDetail();
            }
          }
          : undefined
      }
    >
      {isSelectionMode && isSelectable && (
        <div className="absolute left-3 top-2.5 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelected}
            onClick={(eventClick) => eventClick.stopPropagation()}
            className="h-4 w-4 rounded border-slate-300"
          />
        </div>
      )}

      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
        <img src={thumbnail} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-950/25" />
        <div className="absolute bottom-1 right-1 rounded-full bg-white/95 p-1 shadow-sm">
          {getEventIcon(event)}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <EventGlanceContent
          event={event}
          isExploring={isExploring}
          isActive={isActive}
          location={location}
          showTimeInBody={showTimeInBody}
          multidayRole={multidayRole}
          viewDateKey={viewDateKey}
        />

        <EventGlanceMetaChips
          event={event}
          weatherSnapshots={weatherSnapshots}
          className="mt-1.5"
        />

        <EventGlanceAttentionChips
          attention={attention}
          className="mt-1.5"
          onOpenDecision={onOpenDecision}
          onReviewLocation={onReviewLocation}
        />
      </div>

      {!isSelectionMode && onOpenDetail && (
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      )}
      </div>
    </div>
  );
};

export default EventGlanceCard;
