import { Event, Trip } from '@/types/eventTypes';
import { PrepSuggestion } from '@/types/prepSuggestionTypes';
import { getEventEnd, getEventStart } from '@/utils/eventTime';

interface PrepSuggestionInput {
  trip: Trip;
  existingItems?: string[];
}

const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const hasExistingItem = (existingItems: string[], title: string) => {
  const normalizedTitle = normalizeText(title);
  return existingItems.some((item) => {
    const normalizedItem = normalizeText(item);
    if (!normalizedItem) return false;
    return normalizedItem.includes(normalizedTitle) || normalizedTitle.includes(normalizedItem);
  });
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const getTripStart = (trip: Trip, events: Event[]) => {
  const datedEvents = events
    .map(getEventStart)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());

  if (datedEvents[0]) {
    return datedEvents[0];
  }

  return trip.startDate ? new Date(trip.startDate) : null;
};

const getTripDurationDays = (trip: Trip, events: Event[]) => {
  const start = getTripStart(trip, events);
  const end = trip.endDate
    ? new Date(trip.endDate)
    : events
        .map(getEventEnd)
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => b.getTime() - a.getTime())[0];

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
};

const getAirportCountryHint = (value?: string) => {
  if (!value) return undefined;
  const countryMatch = value.match(/,\s*([A-Z]{2})\s*(?:\(|$)/);
  return countryMatch?.[1];
};

const hasInternationalFlight = (events: Event[]) => {
  return events.some((event) => {
    if (event.type !== 'flight') return false;
    const eventData = event as any;
    const departureCountry = getAirportCountryHint(eventData.departureAirport);
    const arrivalCountry = getAirportCountryHint(eventData.arrivalAirport);
    return !!departureCountry && !!arrivalCountry && departureCountry !== arrivalCountry;
  });
};

const hasGroundTransportAfterFlight = (events: Event[], flight: Event) => {
  const arrivalTime = getEventEnd(flight);
  if (!arrivalTime) return false;

  return events.some((event) => {
    if (!['rental_car', 'train', 'bus'].includes(event.type)) return false;
    const start = getEventStart(event);
    if (!start) return false;
    const hoursAfterArrival = (start.getTime() - arrivalTime.getTime()) / (60 * 60 * 1000);
    return hoursAfterArrival >= -1 && hoursAfterArrival <= 12;
  });
};

const getCollaboratorCount = (trip: Trip) => {
  return (trip.collaborators || []).filter(Boolean).length;
};

export const generatePrepSuggestions = ({
  trip,
  existingItems = [],
}: PrepSuggestionInput): PrepSuggestion[] => {
  const events = trip.events || [];
  const tripStart = getTripStart(trip, events);
  const dueBeforeTrip = tripStart ? toDateOnly(addDays(tripStart, -7)) : undefined;
  const suggestions: PrepSuggestion[] = [];
  const hasFlights = events.some((event) => event.type === 'flight');
  const hasStay = events.some((event) => event.type === 'stay');
  const durationDays = getTripDurationDays(trip, events);

  if (hasInternationalFlight(events)) {
    suggestions.push({
      id: `prep-passport-${trip._id}`,
      title: 'Check passport validity',
      reason: 'International flights usually require a passport that is valid beyond your travel dates.',
      category: 'documents',
      scope: 'personal',
      dueDate: dueBeforeTrip,
      priority: 'high',
    });
  }

  if (hasFlights) {
    suggestions.push({
      id: `prep-baggage-${trip._id}`,
      title: 'Check baggage allowance',
      reason: 'Your itinerary includes flights, so baggage rules and fees are worth confirming before packing.',
      category: 'packing',
      scope: 'personal',
      dueDate: dueBeforeTrip,
      priority: 'medium',
    });
  }

  const flightMissingTransport = events.find((event) => event.type === 'flight' && !hasGroundTransportAfterFlight(events, event));
  if (flightMissingTransport) {
    suggestions.push({
      id: `prep-airport-transfer-${flightMissingTransport.id}`,
      title: 'Plan airport transfer',
      reason: 'There is a flight arrival without nearby ground transport in the itinerary.',
      category: 'transport',
      scope: 'shared',
      dueDate: dueBeforeTrip,
      priority: 'high',
    });
  }

  if (hasStay) {
    suggestions.push({
      id: `prep-check-in-${trip._id}`,
      title: 'Confirm lodging check-in details',
      reason: 'A stay is booked, so check-in time, address, and access instructions should be easy to find.',
      category: 'lodging',
      scope: 'shared',
      dueDate: dueBeforeTrip,
      priority: 'medium',
    });
  }

  if (events.length > 0) {
    suggestions.push({
      id: `prep-offline-maps-${trip._id}`,
      title: 'Download offline maps',
      reason: 'Offline maps are useful when mobile data is unreliable in transit.',
      category: 'offline',
      scope: 'personal',
      dueDate: dueBeforeTrip,
      priority: 'medium',
    });
  }

  if (durationDays >= 3 || hasFlights) {
    suggestions.push({
      id: `prep-packing-list-${trip._id}`,
      title: 'Create packing list',
      reason: 'A trip with travel logistics benefits from a dedicated packing checklist.',
      category: 'packing',
      scope: 'personal',
      dueDate: dueBeforeTrip,
      priority: 'medium',
    });
  }

  if (getCollaboratorCount(trip) > 0) {
    suggestions.push({
      id: `prep-expense-plan-${trip._id}`,
      title: 'Agree on expense splitting',
      reason: 'Shared trips go more smoothly when everyone knows how costs will be tracked.',
      category: 'money',
      scope: 'shared',
      dueDate: dueBeforeTrip,
      priority: 'low',
    });
  }

  return suggestions.filter((suggestion) => !hasExistingItem(existingItems, suggestion.title));
};
