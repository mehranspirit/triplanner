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
import { Event, Trip } from '@/types/eventTypes';
import { WeatherSnapshot } from '@/types/weatherTypes';
import { cn } from '@/lib/utils';
import { tripSurfaces } from '@/styles/tripSurfaces';
import { getEventLocationLabel } from '@/utils/eventTime';
import { isEventCurrentlyActive } from '@/utils/eventGlow';
import { isVoteableEvent } from '@/utils/decisionHelpers';
import { useTripReferenceNow } from '@/components/TripDetails/TripReferenceNowContext';
import { EventVoteAction } from '@/components/TripDetails/hooks/useEventVotes';
import {
  EVENT_TYPE_ACCENT_CLASSES,
  EXPLORING_ACCENT_CLASS,
  EXPLORING_CARD_CLASS,
  EXPLORING_THUMBNAIL_FRAME_CLASS,
  EXPLORING_THUMBNAIL_IMAGE_CLASS,
} from '@/utils/eventGlance';
import { MultidayEventDayRole } from '@/utils/timelineDates';
import EventDraftBanner from '@/components/TripDetails/EventCards/EventDraftBanner';
import EventVoteControls from '@/components/TripDetails/EventCards/EventVoteControls';
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
  trip?: Trip;
  currentUserId?: string;
  onVote?: (eventId: string, voteType: EventVoteAction) => void;
  canVote?: boolean;
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
  trip,
  currentUserId,
  onVote,
  canVote = false,
}) => {
  const { referenceNow } = useTripReferenceNow();
  const isExploring = event.status === 'exploring';
  const showVoteControls = isExploring && isVoteableEvent(event) && Boolean(trip && onVote);
  const isActive = isEventCurrentlyActive(event, referenceNow);
  const location = getEventLocationLabel(event)
    || (event as { address?: string }).address
    || undefined;
  const accentClass = EVENT_TYPE_ACCENT_CLASSES[event.type] ?? 'border-l-slate-300';
  const isMultidayMiddle = multidayRole === 'middle';

  return (
    <div>
      <div
      role={!isSelectionMode && onOpenDetail ? 'button' : undefined}
      tabIndex={!isSelectionMode && onOpenDetail ? 0 : undefined}
      className={cn(
        tripSurfaces.content,
        !isExploring && tripSurfaces.contentHover,
        'relative min-w-0 overflow-hidden',
        isExploring ? 'flex flex-col' : 'flex items-center gap-3 border-l-4 p-3 pl-2.5',
        !isExploring && accentClass,
        isExploring && EXPLORING_CARD_CLASS,
        isExploring && 'hover:!border-stone-400',
        isMultidayMiddle && !isExploring && 'border-dashed bg-slate-50/70',
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
      {isExploring && <EventDraftBanner />}

      <div
        className={cn(
          'relative flex min-w-0 gap-3',
          isExploring
            ? cn(
              'p-3 pl-2.5',
              EXPLORING_ACCENT_CLASS,
              showVoteControls ? 'items-start' : 'items-center',
            )
            : 'contents',
        )}
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

      <div className={cn('relative h-14 w-14 shrink-0 overflow-hidden rounded-xl', isExploring && EXPLORING_THUMBNAIL_FRAME_CLASS)}>
        <img
          src={thumbnail}
          alt=""
          className={cn('h-full w-full object-cover', isExploring && EXPLORING_THUMBNAIL_IMAGE_CLASS)}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-950/25" />
        <div className="absolute bottom-1 right-1 rounded-full bg-white/95 p-1 shadow-sm">
          {getEventIcon(event)}
        </div>
      </div>

      <div className={cn('min-w-0 flex-1', showVoteControls && 'pr-14')}>
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
          hideStatusChip={isExploring}
          hideVoteChip={showVoteControls}
        />

        <EventGlanceAttentionChips
          attention={attention}
          className={cn('mt-1.5', showVoteControls && 'pr-16')}
          onOpenDecision={onOpenDecision}
          onReviewLocation={onReviewLocation}
        />
      </div>

      {showVoteControls ? (
        <div className="absolute bottom-2.5 right-2.5 z-10">
          <EventVoteControls
            event={event}
            trip={trip!}
            currentUserId={currentUserId}
            onVote={onVote!}
            readOnly={!canVote}
            variant="timeline"
            size="compact"
          />
        </div>
      ) : (
        !isSelectionMode && onOpenDetail && (
          <ChevronRight className="h-4 w-4 shrink-0 self-center text-slate-400" aria-hidden />
        )
      )}

      {showVoteControls && !isSelectionMode && onOpenDetail && (
        <ChevronRight className="absolute right-2.5 top-2.5 z-10 h-4 w-4 text-slate-400" aria-hidden />
      )}
      </div>
      </div>
    </div>
  );
};

export default EventGlanceCard;
