import { differenceInCalendarDays, format, parse } from 'date-fns';
import {
  ActivityEvent,
  ArrivalDepartureEvent,
  BusEvent,
  DestinationEvent,
  Event,
  FlightEvent,
  RentalCarEvent,
  StayEvent,
  TrainEvent,
} from '@/types/eventTypes';
import { TimelineTransferLeg } from '@/types/timelineTransferLegTypes';
import { WeatherSnapshot } from '@/types/weatherTypes';
import { getEventBookingReference, getEventDisplayName, sortEventsByStart } from '@/utils/eventTime';
import { getWeatherGlanceLabelForEvent } from '@/utils/eventGlance';
import { formatCurrency } from '@/utils/format';
import {
  getTimelineDateKey,
  groupEventsByTimelineDateKeys,
} from '@/utils/timelineDates';
import {
  getTimelineDayTransferLeg,
  resolveTimelineTransferLeg,
  TransferSummary,
} from '@/utils/transferAnalysis';

export interface DetailRow {
  label: string;
  value: string;
}

export interface DetailSection {
  title?: string;
  rows: DetailRow[];
}

export interface EventDetailNotes {
  description?: string;
  notes?: string;
}

export interface OutboundTransferContext {
  transfer: TransferSummary;
  drivingLeg: TimelineTransferLeg | null;
  nextEvent: Event;
}

const addRow = (rows: DetailRow[], label: string, value?: string | null) => {
  const trimmed = value?.trim();
  if (trimmed) {
    rows.push({ label, value: trimmed });
  }
};

const formatDetailDateTime = (date?: string, time?: string): string | null => {
  if (!date) return null;
  try {
    const datePart = date.split('T')[0];
    const parsed = parse(datePart, 'yyyy-MM-dd', new Date());
    if (time) {
      const [hours, minutes] = time.split(':').map(Number);
      parsed.setHours(hours, minutes);
      return format(parsed, 'MMM d, yyyy · h:mm a');
    }
    return format(parsed, 'MMM d, yyyy');
  } catch {
    return null;
  }
};

const formatCost = (cost: number | undefined, currency: string): string | null => {
  if (typeof cost !== 'number' || !Number.isFinite(cost)) return null;
  return formatCurrency(cost, currency);
};

export const getEventDetailNotes = (event: Event): EventDetailNotes => {
  const data = event as unknown as { notes?: string; description?: string };
  return {
    description: data.description?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
  };
};

export const getEventDetailSections = (event: Event, currency = 'USD'): DetailSection[] => {
  const sections: DetailSection[] = [];

  switch (event.type) {
    case 'flight': {
      const flight = event as FlightEvent;
      const rows: DetailRow[] = [];
      addRow(rows, 'Airline', flight.airline);
      addRow(rows, 'Flight number', flight.flightNumber);
      addRow(rows, 'Departure', [
        flight.departureAirport,
        formatDetailDateTime(event.startDate, flight.departureTime),
      ].filter(Boolean).join(' · '));
      addRow(rows, 'Arrival', [
        flight.arrivalAirport,
        formatDetailDateTime(event.endDate, flight.arrivalTime),
      ].filter(Boolean).join(' · '));
      addRow(rows, 'Terminal', flight.terminal);
      addRow(rows, 'Gate', flight.gate);
      addRow(rows, 'Booking reference', flight.bookingReference || getEventBookingReference(event));
      addRow(rows, 'Cost', formatCost(flight.cost, currency));
      if (rows.length > 0) sections.push({ title: 'Flight details', rows });
      break;
    }
    case 'train': {
      const train = event as TrainEvent;
      const rows: DetailRow[] = [];
      addRow(rows, 'Operator', train.trainOperator);
      addRow(rows, 'Train number', train.trainNumber);
      addRow(rows, 'Departure', [
        train.departureStation,
        formatDetailDateTime(event.startDate, train.departureTime),
      ].filter(Boolean).join(' · '));
      addRow(rows, 'Arrival', [
        train.arrivalStation,
        formatDetailDateTime(event.endDate, train.arrivalTime),
      ].filter(Boolean).join(' · '));
      addRow(rows, 'Carriage', train.carriageNumber);
      addRow(rows, 'Seat', train.seatNumber);
      addRow(rows, 'Booking reference', train.bookingReference || getEventBookingReference(event));
      addRow(rows, 'Cost', formatCost(train.cost, currency));
      if (rows.length > 0) sections.push({ title: 'Train details', rows });
      break;
    }
    case 'bus': {
      const bus = event as BusEvent;
      const rows: DetailRow[] = [];
      addRow(rows, 'Operator', bus.busOperator);
      addRow(rows, 'Bus number', bus.busNumber);
      addRow(rows, 'Departure', [
        bus.departureStation,
        formatDetailDateTime(bus.departureDate || event.startDate, bus.departureTime),
      ].filter(Boolean).join(' · '));
      addRow(rows, 'Arrival', [
        bus.arrivalStation,
        formatDetailDateTime(bus.arrivalDate || event.endDate, bus.arrivalTime),
      ].filter(Boolean).join(' · '));
      addRow(rows, 'Seat', bus.seatNumber);
      addRow(rows, 'Booking reference', bus.bookingReference || getEventBookingReference(event));
      addRow(rows, 'Cost', formatCost(bus.cost, currency));
      if (rows.length > 0) sections.push({ title: 'Bus details', rows });
      break;
    }
    case 'stay': {
      const stay = event as StayEvent;
      const rows: DetailRow[] = [];
      const nights = differenceInCalendarDays(
        parse(stay.checkOut, 'yyyy-MM-dd', new Date()),
        parse(stay.checkIn, 'yyyy-MM-dd', new Date()),
      );
      addRow(rows, 'Check-in', formatDetailDateTime(stay.checkIn, stay.checkInTime));
      addRow(rows, 'Check-out', formatDetailDateTime(stay.checkOut, stay.checkOutTime));
      if (nights > 0) addRow(rows, 'Nights', `${nights}`);
      addRow(rows, 'Address', stay.address);
      addRow(rows, 'Reservation', stay.reservationNumber || getEventBookingReference(event));
      addRow(rows, 'Contact', stay.contactInfo);
      addRow(rows, 'Cost', formatCost(stay.cost, currency));
      if (rows.length > 0) sections.push({ title: 'Stay details', rows });
      break;
    }
    case 'rental_car': {
      const rental = event as RentalCarEvent;
      const rows: DetailRow[] = [];
      addRow(rows, 'Company', rental.carCompany);
      addRow(rows, 'Vehicle', rental.carType);
      addRow(rows, 'Pickup', [
        rental.pickupLocation,
        formatDetailDateTime(rental.date, rental.pickupTime),
      ].filter(Boolean).join(' · '));
      addRow(rows, 'Drop-off', [
        rental.dropoffLocation,
        formatDetailDateTime(rental.dropoffDate, rental.dropoffTime),
      ].filter(Boolean).join(' · '));
      addRow(rows, 'License plate', rental.licensePlate);
      addRow(rows, 'Booking reference', rental.bookingReference || getEventBookingReference(event));
      addRow(rows, 'Cost', formatCost(rental.cost, currency));
      if (rows.length > 0) sections.push({ title: 'Rental details', rows });
      break;
    }
    case 'activity': {
      const activity = event as ActivityEvent;
      const rows: DetailRow[] = [];
      addRow(rows, 'Type', activity.activityType);
      addRow(rows, 'Address', activity.address);
      addRow(rows, 'Contact', activity.contactInfo);
      addRow(rows, 'Cost', formatCost(activity.cost, currency));
      if (rows.length > 0) sections.push({ title: 'Activity details', rows });
      break;
    }
    case 'destination': {
      const destination = event as DestinationEvent;
      const rows: DetailRow[] = [];
      addRow(rows, 'Address', destination.address);
      addRow(rows, 'Contact', destination.contactInfo);
      addRow(rows, 'Hours', destination.openingHours);
      if (rows.length > 0) sections.push({ title: 'Place details', rows });
      break;
    }
    case 'arrival':
    case 'departure': {
      const leg = event as ArrivalDepartureEvent;
      const rows: DetailRow[] = [];
      addRow(rows, 'Airport', leg.airport);
      addRow(rows, 'Time', formatDetailDateTime(leg.date, leg.time));
      addRow(rows, 'Airline', leg.airline);
      addRow(rows, 'Flight number', leg.flightNumber);
      addRow(rows, 'Terminal', leg.terminal);
      addRow(rows, 'Gate', leg.gate);
      addRow(rows, 'Booking reference', leg.bookingReference || getEventBookingReference(event));
      if (rows.length > 0) {
        sections.push({
          title: event.type === 'arrival' ? 'Arrival details' : 'Departure details',
          rows,
        });
      }
      break;
    }
    default:
      break;
  }

  const bookingReference = getEventBookingReference(event);
  const alreadyHasBooking = sections.some((section) => (
    section.rows.some((row) => row.label === 'Booking reference' || row.label === 'Reservation')
  ));
  if (bookingReference && !alreadyHasBooking) {
    sections.push({
      title: 'Booking',
      rows: [{ label: 'Reference', value: bookingReference }],
    });
  }

  return sections;
};

export const resolveOutboundTransferForEvent = (
  event: Event,
  tripEvents: Event[],
  weatherSnapshots: WeatherSnapshot[] = [],
  timelineTransferLegs: TimelineTransferLeg[] = [],
): OutboundTransferContext | null => {
  const visibleEvents = tripEvents.filter((candidate) => candidate.status !== 'alternative');
  const sortedEvents = sortEventsByStart(visibleEvents);
  const eventIndex = sortedEvents.findIndex((candidate) => candidate.id === event.id);
  if (eventIndex < 0 || eventIndex >= sortedEvents.length - 1) return null;

  const nextEvent = sortedEvents[eventIndex + 1];
  const nextDayKey = getTimelineDateKey(nextEvent);
  if (!nextDayKey) return null;

  const grouped = groupEventsByTimelineDateKeys(sortedEvents);
  const dayEvents = sortEventsByStart(grouped[nextDayKey] ?? []);
  const nextIndex = dayEvents.findIndex((candidate) => candidate.id === nextEvent.id);
  if (nextIndex < 0) return null;

  const resolved = resolveTimelineTransferLeg(
    sortedEvents,
    dayEvents,
    nextIndex,
    nextEvent,
    nextDayKey,
    weatherSnapshots,
  );

  let transfer: TransferSummary | null = resolved?.previousEvent.id === event.id
    ? resolved.transfer
    : null;

  if (!transfer) {
    const eventDayKey = getTimelineDateKey(event);
    transfer = (eventDayKey
      ? getTimelineDayTransferLeg(event, nextEvent, eventDayKey, weatherSnapshots)
      : null)
      ?? getTimelineDayTransferLeg(event, nextEvent, nextDayKey, weatherSnapshots);
  }

  if (!transfer) return null;

  const drivingLeg = timelineTransferLegs.find(
    (leg) => leg.fromEventId === event.id && leg.toEventId === nextEvent.id,
  ) ?? null;

  return { transfer, drivingLeg, nextEvent };
};

export const getEventDetailWeatherLabel = (
  event: Event,
  weatherSnapshots: WeatherSnapshot[] = [],
): string | null => getWeatherGlanceLabelForEvent(event, weatherSnapshots);
