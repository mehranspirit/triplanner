const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const { getTripFlightStatuses } = require('./flightStatus');

const parseEventDateTime = (dateValue, timeValue) => {
  if (!dateValue) return null;
  const normalizedDate = dateValue.includes('T') ? dateValue : `${dateValue}T${timeValue || '00:00'}`;
  const date = new Date(normalizedDate);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getEventStart = (event) => {
  switch (event.type) {
    case 'arrival':
    case 'departure':
      return parseEventDateTime(event.date || event.startDate, event.time);
    case 'stay':
      return parseEventDateTime(event.checkIn || event.startDate, event.checkInTime);
    case 'rental_car':
      return parseEventDateTime(event.date || event.startDate, event.pickupTime);
    case 'flight':
    case 'train':
    case 'bus':
      return parseEventDateTime(event.startDate || event.departureDate, event.departureTime);
    case 'activity':
    case 'destination':
      return parseEventDateTime(event.startDate, event.startTime);
    default:
      return parseEventDateTime(event.startDate);
  }
};

const getEventEnd = (event) => {
  switch (event.type) {
    case 'arrival':
    case 'departure':
      return parseEventDateTime(event.date || event.endDate || event.startDate, event.time);
    case 'stay':
      return parseEventDateTime(event.checkOut || event.endDate, event.checkOutTime);
    case 'rental_car':
      return parseEventDateTime(event.dropoffDate || event.endDate, event.dropoffTime);
    case 'flight':
    case 'train':
    case 'bus':
      return parseEventDateTime(event.endDate || event.arrivalDate, event.arrivalTime);
    case 'activity':
    case 'destination':
      return parseEventDateTime(event.endDate, event.endTime);
    default:
      return parseEventDateTime(event.endDate || event.startDate);
  }
};

const getEventName = (event) => {
  switch (event.type) {
    case 'flight':
      return event.flightNumber ? `Flight ${event.flightNumber}` : 'Flight';
    case 'stay':
      return event.accommodationName || 'Stay';
    case 'rental_car':
      return event.carCompany ? `${event.carCompany} rental car` : 'Rental car';
    case 'activity':
      return event.title || 'Activity';
    case 'destination':
      return event.placeName || 'Destination';
    default:
      return event.type;
  }
};

const getBookingReference = (event) => event.bookingReference || event.reservationNumber;

const hasNearbyGroundTransport = (events, flight) => {
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

const toNotification = ({ userId, tripId, ...notification }) => ({
  userId,
  tripId,
  ...notification
});

const buildFlightStatusNotifications = ({ trip, userId, flightStatusSnapshots = [] }) => {
  const eventsById = new Map((trip.events || []).map((event) => [event.id, event]));
  const notifications = [];

  flightStatusSnapshots.forEach((snapshot) => {
    const event = eventsById.get(snapshot.eventId);
    if (!event) return;

    const normalizedStatus = (snapshot.status || '').toLowerCase();
    const departureDelay = snapshot.departure?.delayMinutes || 0;
    const arrivalDelay = snapshot.arrival?.delayMinutes || 0;
    const delayMinutes = Math.max(departureDelay, arrivalDelay);
    const gateInfo = [
      snapshot.departure?.terminal ? `terminal ${snapshot.departure.terminal}` : null,
      snapshot.departure?.gate ? `gate ${snapshot.departure.gate}` : null
    ].filter(Boolean).join(', ');

    if (/cancel/.test(normalizedStatus)) {
      notifications.push(toNotification({
        userId,
        tripId: trip._id,
        eventId: event.id,
        dedupeKey: `flight-cancelled:${event.id}:${snapshot.dateLocal}`,
        type: 'reminder',
        severity: 'critical',
        title: 'Flight may be cancelled',
        message: `${getEventName(event)} is showing status "${snapshot.status}". Check with the airline before heading to the airport.`,
        actionLabel: 'Open Today',
        actionTarget: 'today'
      }));
      return;
    }

    if (delayMinutes >= 30 || /delay/.test(normalizedStatus)) {
      notifications.push(toNotification({
        userId,
        tripId: trip._id,
        eventId: event.id,
        dedupeKey: `flight-delayed:${event.id}:${snapshot.dateLocal}`,
        type: 'reminder',
        severity: delayMinutes >= 90 ? 'warning' : 'info',
        title: 'Flight delay reported',
        message: `${getEventName(event)} is showing ${delayMinutes ? `about ${delayMinutes} minutes of delay` : `status "${snapshot.status}"`}. Recheck connections, airport pickup, and arrival plans.`,
        actionLabel: 'Open Today',
        actionTarget: 'today'
      }));
    }

    if (gateInfo) {
      notifications.push(toNotification({
        userId,
        tripId: trip._id,
        eventId: event.id,
        dedupeKey: `flight-gate:${event.id}:${snapshot.dateLocal}:${gateInfo}`,
        type: 'reminder',
        severity: 'info',
        title: 'Flight gate details available',
        message: `${getEventName(event)} currently shows departure ${gateInfo}. Verify in the airline app before boarding.`,
        actionLabel: 'Open Today',
        actionTarget: 'today'
      }));
    }
  });

  return notifications;
};

const buildCandidateNotifications = async ({ trip, userId, now = new Date() }) => {
  const tripId = trip._id;
  const events = trip.events || [];
  const notifications = [];
  const hasTravel = events.some((event) => ['arrival', 'departure', 'flight', 'train', 'bus'].includes(event.type));
  const hasStay = events.some((event) => event.type === 'stay');

  if (hasTravel && !hasStay) {
    notifications.push(toNotification({
      userId,
      tripId,
      dedupeKey: `missing-stay:${tripId}`,
      type: 'insight',
      severity: 'warning',
      title: 'No stay added',
      message: 'This trip has transportation but no lodging yet.',
      actionLabel: 'Add stay',
      actionTarget: 'add_event'
    }));
  }

  events.forEach((event) => {
    if (['flight', 'train', 'bus', 'rental_car', 'stay'].includes(event.type) && !getBookingReference(event)) {
      notifications.push(toNotification({
        userId,
        tripId,
        eventId: event.id,
        dedupeKey: `missing-confirmation:${event.id}`,
        type: 'insight',
        severity: 'info',
        title: 'Confirmation missing',
        message: `${getEventName(event)} is missing a booking or reservation reference.`,
        actionLabel: 'Edit event',
        actionTarget: 'event'
      }));
    }

    if (event.type === 'flight' && event.arrivalAirport && !hasNearbyGroundTransport(events, event)) {
      notifications.push(toNotification({
        userId,
        tripId,
        eventId: event.id,
        dedupeKey: `ground-transport:${event.id}`,
        type: 'insight',
        severity: 'info',
        title: 'Plan ground transport',
        message: `${getEventName(event)} arrives at ${event.arrivalAirport}. Add how you will get from the airport to your next stop.`,
        actionLabel: 'Add transport',
        actionTarget: 'add_event'
      }));
    }

    const start = getEventStart(event);
    if (start) {
      const hoursUntil = (start.getTime() - now.getTime()) / (60 * 60 * 1000);
      if (hoursUntil > 0 && hoursUntil <= 24) {
        notifications.push(toNotification({
          userId,
          tripId,
          eventId: event.id,
          dedupeKey: `upcoming-event:${event.id}`,
          type: 'reminder',
          severity: 'info',
          title: 'Upcoming trip event',
          message: `${getEventName(event)} is coming up within 24 hours.`,
          actionLabel: 'Open Today',
          actionTarget: 'today',
          scheduledFor: start
        }));
      }
    }
  });

  const flightStatuses = await getTripFlightStatuses({ trip });
  return [
    ...notifications,
    ...buildFlightStatusNotifications({
      trip,
      userId,
      flightStatusSnapshots: flightStatuses.snapshots || []
    })
  ];
};

const generateTripNotifications = async ({ trip, userId }) => {
  const preferences = await NotificationPreference.findOne({ tripId: trip._id, userId });
  const inAppEnabled = preferences?.inAppEnabled !== false;
  const disabledTypes = new Set(preferences?.disabledTypes || []);
  const candidates = inAppEnabled
    ? (await buildCandidateNotifications({ trip, userId })).filter((candidate) => !disabledTypes.has(candidate.type))
    : [];
  const activeDedupeKeys = candidates.map((candidate) => candidate.dedupeKey);

  for (const candidate of candidates) {
    const {
      userId: candidateUserId,
      tripId,
      dedupeKey,
      type,
      title,
      message,
      severity,
      actionLabel,
      actionTarget,
      eventId,
      scheduledFor
    } = candidate;

    await Notification.updateOne(
      {
        userId,
        tripId: trip._id,
        dedupeKey
      },
      {
        $setOnInsert: {
          userId: candidateUserId,
          tripId,
          dedupeKey,
          type
        },
        $set: {
          title,
          message,
          severity,
          actionLabel,
          actionTarget,
          eventId,
          scheduledFor
        }
      },
      { upsert: true }
    );
  }

  await Notification.updateMany(
    {
      userId,
      tripId: trip._id,
      type: { $in: ['insight', 'reminder'] },
      dismissedAt: { $exists: false },
      dedupeKey: { $nin: activeDedupeKeys }
    },
    {
      $set: {
        dismissedAt: new Date()
      }
    }
  );

  return candidates.length;
};

module.exports = {
  generateTripNotifications,
};
