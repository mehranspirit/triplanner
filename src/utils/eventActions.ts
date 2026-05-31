import {
  Calendar,
  CheckCircle2,
  CircleDashed,
  Edit,
  Map,
  MapPin,
  Navigation,
  Plane,
  Share,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { Event, FlightEvent } from '@/types/eventTypes';
import {
  eventHasGoogleMapsLocation,
  eventHasLocationAttention,
  getGoogleMapsSearchUrl,
  openEventInGoogleMaps,
} from '@/utils/eventLocation';
import { EXPLORING_EVENT_UI_LABEL } from '@/utils/eventStatusLabels';
import { getEventDisplayName, getEventStart, getEventEnd } from '@/utils/eventTime';

export type EventActionTier = 'primary' | 'status' | 'secondary' | 'destructive';
export type EventActionSurface = 'sheet-primary' | 'sheet-overflow' | 'sheet-footer';

export interface EventAction {
  id: string;
  label: string;
  icon: LucideIcon;
  tier: EventActionTier;
  surfaces: EventActionSurface[];
  visible?: (ctx: EventActionContext) => boolean;
  handler: () => void;
}

export interface EventActionContext {
  event: Event;
  canEdit: boolean;
}

export interface EventActionHandlers {
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: 'confirmed' | 'exploring') => void;
  onReviewLocation?: () => void;
}

const getDirectionsToEventUrl = (event: Event): string | null => {
  const query = getGoogleMapsSearchUrl(event);
  if (!query) return null;
  const destination = query.split('query=')[1];
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
};

export const openDirectionsToEvent = (event: Event): void => {
  const url = getDirectionsToEventUrl(event);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

export const addEventToCalendar = (event: Event): void => {
  const title = getEventDisplayName(event);
  const eventData = event as unknown as Record<string, string | undefined>;
  let details = '';
  let startDate = '';
  let endDate = '';

  switch (event.type) {
    case 'activity': {
      details = `${eventData.description || ''}\n${eventData.notes || ''}\n${eventData.address || ''}`;
      startDate = (eventData.startDate || '').replace(/-/g, '');
      endDate = (eventData.endDate || eventData.startDate || '').replace(/-/g, '');
      break;
    }
    case 'destination': {
      details = `${eventData.description || ''}\n${eventData.notes || ''}\n${eventData.address || ''}`;
      startDate = (eventData.startDate || '').replace(/-/g, '');
      endDate = (eventData.endDate || eventData.startDate || '').replace(/-/g, '');
      break;
    }
    case 'stay': {
      details = `Check-in: ${eventData.checkInTime || ''}\nCheck-out: ${eventData.checkOutTime || ''}\n${eventData.address || ''}\n${eventData.notes || ''}`;
      startDate = (eventData.checkIn || '').replace(/-/g, '');
      endDate = (eventData.checkOut || eventData.checkIn || '').replace(/-/g, '');
      break;
    }
    case 'flight': {
      const flight = event as FlightEvent;
      details = `From: ${flight.departureAirport || ''}\nTo: ${flight.arrivalAirport || ''}\n${flight.notes || ''}`;
      startDate = (flight.startDate || '').split('T')[0].replace(/-/g, '');
      endDate = (flight.endDate || flight.startDate || '').split('T')[0].replace(/-/g, '');
      break;
    }
    default: {
      details = eventData.notes || '';
      const start = getEventStart(event);
      const end = getEventEnd(event);
      startDate = start ? start.toISOString().slice(0, 10).replace(/-/g, '') : '';
      endDate = end ? end.toISOString().slice(0, 10).replace(/-/g, '') : startDate;
    }
  }

  if (!startDate) return;

  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startDate}/${endDate || startDate}&details=${encodeURIComponent(details.trim())}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

export const shareEvent = async (event: Event): Promise<void> => {
  const name = getEventDisplayName(event);
  const start = getEventStart(event);
  const end = getEventEnd(event);
  const eventData = event as unknown as Record<string, string | undefined>;
  const lines = [
    name,
    start ? `Starts: ${start.toLocaleString()}` : null,
    end ? `Ends: ${end.toLocaleString()}` : null,
    eventData.address ? `Location: ${eventData.address}` : null,
    eventData.notes ? eventData.notes : null,
  ].filter(Boolean);

  const text = lines.join('\n');

  if (navigator.share) {
    try {
      await navigator.share({ title: name, text });
      return;
    } catch {
      // fall through to clipboard
    }
  }

  await navigator.clipboard.writeText(text);
};

const trackFlight = (event: Event): void => {
  const flight = event as FlightEvent;
  if (!flight.flightNumber || !flight.airline) return;
  window.open(
    `https://flightaware.com/live/flight/${flight.airline}${flight.flightNumber}`,
    '_blank',
    'noopener,noreferrer',
  );
};

export const buildEventActions = (
  event: Event,
  handlers: EventActionHandlers,
  canEdit: boolean,
): EventAction[] => {
  const ctx: EventActionContext = { event, canEdit };
  const isExploring = event.status === 'exploring';
  const actions: EventAction[] = [];

  if (getDirectionsToEventUrl(event)) {
    actions.push({
      id: 'directions',
      label: 'Directions',
      icon: Navigation,
      tier: 'primary',
      surfaces: ['sheet-primary'],
      handler: () => openDirectionsToEvent(event),
    });
  }

  if (eventHasGoogleMapsLocation(event)) {
    actions.push({
      id: 'open-maps',
      label: 'Open in Maps',
      icon: Map,
      tier: 'primary',
      surfaces: ['sheet-primary'],
      handler: () => openEventInGoogleMaps(event),
    });
  }

  actions.push({
    id: 'add-to-calendar',
    label: 'Add to calendar',
    icon: Calendar,
    tier: 'primary',
    surfaces: ['sheet-primary', 'sheet-overflow'],
    handler: () => addEventToCalendar(event),
  });

  actions.push({
    id: 'share',
    label: 'Share',
    icon: Share,
    tier: 'primary',
    surfaces: ['sheet-primary', 'sheet-overflow'],
    handler: () => { void shareEvent(event); },
  });

  if (event.type === 'flight') {
    const flight = event as FlightEvent;
    if (flight.flightNumber && flight.airline) {
      actions.push({
        id: 'track-flight',
        label: 'Track flight',
        icon: Plane,
        tier: 'secondary',
        surfaces: ['sheet-overflow'],
        handler: () => trackFlight(event),
      });
    }
  }

  if (canEdit && eventHasLocationAttention(event) && handlers.onReviewLocation) {
    actions.push({
      id: 'review-location',
      label: 'Review location',
      icon: MapPin,
      tier: 'secondary',
      surfaces: ['sheet-overflow'],
      handler: handlers.onReviewLocation,
    });
  }

  if (canEdit && handlers.onStatusChange) {
    actions.push({
      id: 'toggle-status',
      label: isExploring ? 'Mark as confirmed' : `Save as ${EXPLORING_EVENT_UI_LABEL.toLowerCase()}`,
      icon: isExploring ? CheckCircle2 : CircleDashed,
      tier: 'status',
      surfaces: ['sheet-overflow'],
      handler: () => handlers.onStatusChange!(isExploring ? 'confirmed' : 'exploring'),
    });
  }

  if (canEdit && handlers.onEdit) {
    actions.push({
      id: 'edit',
      label: 'Edit event',
      icon: Edit,
      tier: 'secondary',
      surfaces: ['sheet-overflow', 'sheet-footer'],
      handler: handlers.onEdit,
    });
  }

  if (canEdit && handlers.onDelete) {
    actions.push({
      id: 'delete',
      label: 'Delete event',
      icon: Trash2,
      tier: 'destructive',
      surfaces: ['sheet-overflow'],
      handler: handlers.onDelete,
    });
  }

  return actions.filter((action) => !action.visible || action.visible(ctx));
};

export const filterEventActions = (
  actions: EventAction[],
  surface: EventActionSurface,
): EventAction[] => actions.filter((action) => action.surfaces.includes(surface));
