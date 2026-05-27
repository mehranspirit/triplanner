const WeatherSnapshot = require('../models/WeatherSnapshot');
const { generateAiText, hasConfiguredAiProvider, getModelName } = require('./aiProvider');
const { getTravelTimesFromReference, buildStaticMapUrl } = require('./distanceMatrix');

const HIGHLIGHTS = new Set(['best', 'worst', 'neutral']);
const CONFIDENCE_LEVELS = new Set(['low', 'medium', 'high']);

const extractJsonObject = (text) => {
  const stripped = text
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response did not contain a complete JSON object');
  }

  return stripped.slice(start, end + 1);
};

const asString = (value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const asEnum = (value, allowedValues, fallback) => (
  typeof value === 'string' && allowedValues.has(value) ? value : fallback
);
const asArray = (value) => (Array.isArray(value) ? value : []);

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getEventCoords = (event) => {
  if (event?.location?.lat != null && event?.location?.lng != null) {
    return { lat: event.location.lat, lng: event.location.lng };
  }
  return null;
};

const getEventName = (event) => {
  if (!event) return 'Option';
  if (event.type === 'stay') return event.accommodationName || 'Stay';
  if (event.type === 'destination') return event.placeName || 'Destination';
  if (event.type === 'activity') return event.title || 'Activity';
  return event.title || event.placeName || event.accommodationName || 'Option';
};

const getEventDateKey = (event) => {
  if (event?.type === 'stay') {
    const raw = event?.checkIn || event?.startDate;
    if (!raw) return undefined;
    return String(raw).slice(0, 10);
  }

  const raw = event?.startDate || event?.date;
  if (!raw) return undefined;
  return String(raw).slice(0, 10);
};

const getStayCheckOutKey = (event) => {
  if (event?.type !== 'stay') return undefined;
  const raw = event?.checkOut || event?.endDate;
  if (!raw) return undefined;
  return String(raw).slice(0, 10);
};

const countStayNights = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return null;
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return diff > 0 ? diff : null;
};

const formatShortDate = (dateKey) => {
  if (!dateKey) return 'Not set';
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const listDatesInSlot = (startDate, endDate) => {
  if (!startDate) return [];
  if (!endDate || endDate === startDate) return [startDate];

  const dates = [];
  const current = new Date(`${startDate}T12:00:00`);
  const last = new Date(`${endDate}T12:00:00`);

  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

const stayCoversDate = (stay, dateKey) => {
  const checkIn = (stay.checkIn || stay.startDate || '').slice(0, 10);
  const checkOut = (stay.checkOut || stay.endDate || '').slice(0, 10);
  return Boolean(checkIn && checkOut && dateKey >= checkIn && dateKey < checkOut);
};

const getComparisonType = (optionEvents) => {
  if (optionEvents.length === 0) return 'mixed';
  const firstType = optionEvents[0].type;
  if (!['activity', 'destination', 'stay'].includes(firstType)) return 'mixed';
  return optionEvents.every((event) => event.type === firstType) ? firstType : 'mixed';
};

const buildLocationQuery = (event) => {
  if (event?.location?.lat != null && event?.location?.lng != null) {
    return `${event.location.lat},${event.location.lng}`;
  }

  const address = event?.location?.address || event?.address;
  if (address) return address;

  if (event?.type === 'stay') return event.accommodationName || null;
  if (event?.type === 'destination') return event.placeName || null;
  if (event?.type === 'activity') return event.title || null;
  return null;
};

const buildGoogleMapsSearchUrl = (event) => {
  const query = buildLocationQuery(event);
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

const buildGoogleMapsDirectionsUrl = (originQuery, destinationQuery) => {
  if (!originQuery || !destinationQuery) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originQuery)}&destination=${encodeURIComponent(destinationQuery)}`;
};

const REFERENCE_TYPE_PRIORITY = {
  stay: 0,
  destination: 1,
  activity: 2,
};

const findReferencePoint = (tripEvents, slotDate, slotEndDate, excludeIds) => {
  const slotDates = listDatesInSlot(slotDate, slotEndDate);

  for (const dateKey of slotDates) {
    const coveringStay = tripEvents.find((event) => (
      event.type === 'stay'
      && event.status === 'confirmed'
      && !excludeIds.has(event.id)
      && stayCoversDate(event, dateKey)
    ));

    if (coveringStay) {
      return {
        event: coveringStay,
        type: 'stay',
        label: getEventName(coveringStay),
        dateKey,
        coords: getEventCoords(coveringStay),
        description: `Confirmed stay covering ${formatShortDate(dateKey)}`,
        mapsQuery: buildLocationQuery(coveringStay),
      };
    }
  }

  const primaryDate = slotDates[0] || slotDate;
  if (!primaryDate) return null;

  const sameDayEvents = tripEvents
    .filter((event) => (
      !excludeIds.has(event.id)
      && event.status === 'confirmed'
      && getEventCoords(event)
      && getEventDateKey(event) === primaryDate
    ))
    .sort((left, right) => (
      (REFERENCE_TYPE_PRIORITY[left.type] ?? 99) - (REFERENCE_TYPE_PRIORITY[right.type] ?? 99)
    ));

  if (sameDayEvents.length > 0) {
    const referenceEvent = sameDayEvents[0];
    return {
      event: referenceEvent,
      type: referenceEvent.type,
      label: getEventName(referenceEvent),
      dateKey: primaryDate,
      coords: getEventCoords(referenceEvent),
      description: `Confirmed ${referenceEvent.type} on ${formatShortDate(primaryDate)}`,
      mapsQuery: buildLocationQuery(referenceEvent),
    };
  }

  return null;
};

const findNeighboringConfirmedEvents = (tripEvents, slotDate, slotEndDate, excludeIds, limit = 6) => {
  const slotDates = new Set(listDatesInSlot(slotDate, slotEndDate));
  if (slotDates.size === 0) return [];

  return tripEvents
    .filter((event) => {
      if (excludeIds.has(event.id)) return false;
      if (event.status !== 'confirmed') return false;
      const dateKey = getEventDateKey(event);
      return dateKey && slotDates.has(dateKey);
    })
    .slice(0, limit)
    .map((event) => ({
      eventId: event.id,
      name: getEventName(event),
      type: event.type,
      dateKey: getEventDateKey(event),
      address: event.location?.address || event.address || null,
      mapsUrl: buildGoogleMapsSearchUrl(event),
      coords: getEventCoords(event),
    }));
};

const buildWeatherSummaryForDates = (snapshots, dateKeys) => {
  const uniqueDates = [...new Set(dateKeys.filter(Boolean))];
  if (uniqueDates.length === 0) return null;

  const labels = uniqueDates
    .map((dateKey) => {
      const weather = getWeatherForDate(snapshots, dateKey);
      if (!weather) return null;
      return uniqueDates.length === 1 ? weather : `${formatShortDate(dateKey)}: ${weather}`;
    })
    .filter(Boolean);

  if (labels.length === 0) return null;
  return labels.join(' · ');
};

const buildSlotLabel = (slotDate, slotEndDate) => {
  if (!slotDate) return null;
  if (slotEndDate && slotEndDate !== slotDate) {
    return `${formatShortDate(slotDate)} – ${formatShortDate(slotEndDate)}`;
  }
  return formatShortDate(slotDate);
};

const parseNumericCost = (cost) => {
  if (typeof cost === 'number' && Number.isFinite(cost)) return cost;
  if (cost == null) return null;
  const match = String(cost).replace(/[^\d.]/g, '');
  const parsed = Number(match);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildTripMemberNames = (trip) => {
  const names = new Map();

  if (trip.owner) {
    const ownerId = trip.owner._id?.toString?.() || String(trip.owner._id || trip.owner);
    names.set(ownerId, trip.owner.name || 'Trip owner');
  }

  (trip.collaborators || []).forEach((collaborator) => {
    const user = collaborator.user || collaborator;
    const userId = user._id?.toString?.() || String(user._id || user);
    if (userId) {
      names.set(userId, user.name || 'Collaborator');
    }
  });

  return names;
};

const getVoteDetailsForEvent = (event, memberNames) => {
  const likeNames = (event.likes || [])
    .map((userId) => memberNames.get(String(userId)) || 'Collaborator')
    .filter(Boolean);
  const dislikeNames = (event.dislikes || [])
    .map((userId) => memberNames.get(String(userId)) || 'Collaborator')
    .filter(Boolean);

  const voteLabel = `${likeNames.length} like${likeNames.length === 1 ? '' : 's'}, ${dislikeNames.length} dislike${dislikeNames.length === 1 ? '' : 's'}`;
  let voteDetailLabel = voteLabel;

  if (likeNames.length > 0) {
    voteDetailLabel += ` (${likeNames.join(', ')})`;
  }
  if (dislikeNames.length > 0) {
    voteDetailLabel += dislikeNames.length > 0 && likeNames.length > 0
      ? `; dislikes: ${dislikeNames.join(', ')}`
      : ` (dislikes: ${dislikeNames.join(', ')})`;
  }

  return {
    likes: likeNames.length,
    dislikes: dislikeNames.length,
    likeNames,
    dislikeNames,
    voteLabel,
    voteDetailLabel,
  };
};

const getSlotAlignment = (slotDate, slotEndDate, event) => {
  if (!slotDate) return 'unknown';

  const slotStart = slotDate;
  const slotEnd = slotEndDate || slotDate;

  if (event.type === 'stay') {
    const checkIn = getEventDateKey(event);
    const checkOut = getStayCheckOutKey(event);
    if (!checkIn || !checkOut) return 'unknown';

    const overlaps = checkIn <= slotEnd && checkOut >= slotStart;
    if (!overlaps) return 'misaligned';

    const contained = checkIn >= slotStart && checkOut <= slotEnd;
    return contained ? 'aligned' : 'partial';
  }

  const eventDate = getEventDateKey(event);
  if (!eventDate) return 'unknown';
  return eventDate >= slotStart && eventDate <= slotEnd ? 'aligned' : 'misaligned';
};

const slotAlignmentLabel = (alignment) => {
  if (alignment === 'aligned') return 'Matches decision slot';
  if (alignment === 'partial') return 'Partially overlaps decision slot';
  if (alignment === 'misaligned') return 'Outside decision slot';
  return 'Slot alignment unknown';
};

const getEventTimeLabel = (event) => {
  const start = event?.startTime || (event?.startDate?.includes('T') ? event.startDate.split('T')[1]?.slice(0, 5) : undefined);
  const end = event?.endTime || (event?.endDate?.includes('T') ? event.endDate.split('T')[1]?.slice(0, 5) : undefined);
  if (start && end) return `${start}–${end}`;
  if (start) return start;
  return 'Not set';
};

const buildPrecomputedFacts = async (trip, decision) => {
  const optionEvents = decision.optionEventIds
    .map((eventId) => trip.events.find((event) => event.id === eventId))
    .filter(Boolean);

  const excludeIds = new Set(decision.optionEventIds);
  const slotDate = decision.slot?.date || getEventDateKey(optionEvents[0]);
  const slotEndDate = decision.slot?.endDate;
  const slotDates = listDatesInSlot(slotDate, slotEndDate);
  const comparisonType = getComparisonType(optionEvents);
  const isStayComparison = comparisonType === 'stay';
  const referencePoint = isStayComparison
    ? null
    : findReferencePoint(trip.events, slotDate, slotEndDate, excludeIds);
  const referenceCoords = referencePoint?.coords ?? null;
  const neighboringEvents = findNeighboringConfirmedEvents(
    trip.events,
    slotDate,
    slotEndDate,
    excludeIds,
  );

  const weatherSnapshots = await WeatherSnapshot.find({ tripId: trip._id }).sort({ fetchedAt: -1 }).lean();
  const weatherLabel = isStayComparison
    ? null
    : buildWeatherSummaryForDates(weatherSnapshots, slotDates.length > 0 ? slotDates : [slotDate]);

  const memberNames = buildTripMemberNames(trip);

  let perOption = optionEvents.map((event) => {
    const coords = getEventCoords(event);
    let distanceKm = null;
    if (!isStayComparison && referenceCoords && coords) {
      distanceKm = haversineKm(referenceCoords.lat, referenceCoords.lng, coords.lat, coords.lng);
    }

    let nearbyContextLabel = null;
    if (isStayComparison && coords) {
      const checkInKey = getEventDateKey(event);
      const nearby = neighboringEvents
        .filter((entry) => entry.dateKey === checkInKey && entry.coords)
        .map((entry) => ({
          ...entry,
          distanceKm: haversineKm(entry.coords.lat, entry.coords.lng, coords.lat, coords.lng),
        }))
        .sort((left, right) => left.distanceKm - right.distanceKm)[0];

      if (nearby) {
        nearbyContextLabel = `${formatDistance(nearby.distanceKm)} from ${nearby.name}`;
      }
    }

    const voteDetails = getVoteDetailsForEvent(event, memberNames);
    const cost = event.cost ?? event.estimatedCost;
    const numericCost = parseNumericCost(cost);
    const checkInKey = getEventDateKey(event);
    const checkOutKey = getStayCheckOutKey(event);
    const nights = countStayNights(checkInKey, checkOutKey);
    const mapsQuery = buildLocationQuery(event);
    const slotAlignment = getSlotAlignment(slotDate, slotEndDate, event);
    const perNightCostLabel = event.type === 'stay' && nights && numericCost
      ? `$${Math.round(numericCost / nights)}/night`
      : null;

    return {
      eventId: event.id,
      name: getEventName(event),
      type: event.type,
      activityType: event.type === 'activity' ? (event.activityType || null) : null,
      dateKey: checkInKey,
      checkInKey,
      checkOutKey,
      checkInLabel: formatShortDate(checkInKey),
      checkOutLabel: formatShortDate(checkOutKey),
      nights,
      nightsLabel: nights != null ? `${nights} night${nights === 1 ? '' : 's'}` : 'Unknown',
      timeLabel: getEventTimeLabel(event),
      address: event.location?.address || event.address || null,
      coords,
      mapsQuery,
      googleMapsUrl: buildGoogleMapsSearchUrl(event),
      directionsFromReferenceUrl: referencePoint?.mapsQuery && mapsQuery
        ? buildGoogleMapsDirectionsUrl(referencePoint.mapsQuery, mapsQuery)
        : null,
      distanceKm,
      distanceReferenceLabel: referencePoint?.label || null,
      nearbyContextLabel,
      distanceLabel: isStayComparison
        ? (nearbyContextLabel || event.location?.address || event.address || 'No nearby confirmed plans')
        : (referenceCoords ? formatDistance(distanceKm) : 'No reference point'),
      driveTimeLabel: null,
      transitTimeLabel: null,
      weatherLabel: weatherLabel || 'No forecast',
      voteLabel: voteDetails.voteLabel,
      voteDetailLabel: voteDetails.voteDetailLabel,
      likeNames: voteDetails.likeNames,
      dislikeNames: voteDetails.dislikeNames,
      likes: voteDetails.likes,
      dislikes: voteDetails.dislikes,
      costLabel: typeof cost === 'number' ? `$${cost}` : (cost ? String(cost) : 'Unknown'),
      perNightCostLabel,
      openingHoursLabel: event.openingHours || null,
      reservationLabel: event.reservationNumber || event.bookingReference || null,
      slotAlignment,
      slotAlignmentLabel: slotAlignmentLabel(slotAlignment),
      notes: event.notes || event.description || null,
    };
  });

  if (!isStayComparison && referencePoint) {
    const travelTimes = await getTravelTimesFromReference(
      referencePoint,
      perOption.map((option) => ({
        eventId: option.eventId,
        coords: option.coords,
        mapsQuery: option.mapsQuery,
      })),
    );

    perOption = perOption.map((option) => {
      const travel = travelTimes.get(option.eventId);
      if (!travel) return option;
      return {
        ...option,
        driveTimeLabel: travel.driveTimeLabel,
        transitTimeLabel: travel.transitTimeLabel,
      };
    });
  }

  const staticMapUrl = buildStaticMapUrl(
    referencePoint,
    perOption.map((option) => ({ coords: option.coords })),
  );

  return {
    slotDate,
    slotEndDate,
    slotLabel: buildSlotLabel(slotDate, slotEndDate),
    slotDates,
    comparisonType,
    isStayComparison,
    referencePoint,
    neighboringEvents,
    staticMapUrl,
    anchorStayName: referencePoint?.type === 'stay' ? referencePoint.label : referencePoint?.label || null,
    perOption,
  };
};

const formatDistance = (distanceKm) => {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return 'Unknown';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
};

const getWeatherForDate = (snapshots, dateKey) => {
  if (!dateKey) return null;

  for (const snapshot of snapshots) {
    const day = (snapshot.daily || []).find((entry) => entry.date === dateKey);
    if (!day) continue;

    const parts = [
      day.condition,
      typeof day.temperatureMax === 'number' && typeof day.temperatureMin === 'number'
        ? `${Math.round(day.temperatureMax)}/${Math.round(day.temperatureMin)}°F`
        : null,
      typeof day.precipitationProbabilityMax === 'number'
        ? `${day.precipitationProbabilityMax}% rain`
        : null,
    ].filter(Boolean);

    return parts.join(', ') || null;
  }

  return null;
};

const getVoteStats = (event) => {
  const likes = event?.likes?.length ?? 0;
  const dislikes = event?.dislikes?.length ?? 0;
  return { likes, dislikes };
};

const buildVoteDimension = (perOption) => ({
  key: 'votes',
  label: 'Group votes',
  values: perOption.map((option) => ({
    eventId: option.eventId,
    display: option.voteDetailLabel || option.voteLabel,
    highlight: 'neutral',
  })),
});

const buildTimeDimension = (perOption) => ({
  key: 'time',
  label: 'Time',
  values: perOption.map((option) => ({
    eventId: option.eventId,
    display: option.timeLabel,
    highlight: 'neutral',
  })),
});

const buildDistanceDimension = (perOption, referenceLabel) => {
  const distances = perOption.map((option) => option.distanceKm).filter((value) => value != null);
  const minDistance = distances.length > 0 ? Math.min(...distances) : null;

  return {
    key: 'distance',
    label: referenceLabel ? `From ${referenceLabel}` : 'From reference',
    values: perOption.map((option) => ({
      eventId: option.eventId,
      display: option.distanceLabel,
      highlight: option.distanceKm != null && option.distanceKm === minDistance ? 'best' : 'neutral',
    })),
  };
};

const buildWeatherDimension = (perOption, weatherLabel) => ({
  key: 'weather',
  label: 'Weather',
  values: perOption.map((option) => ({
    eventId: option.eventId,
    display: weatherLabel || option.weatherLabel,
    highlight: 'neutral',
  })),
});

const buildCostDimension = (perOption) => {
  const numericCosts = perOption
    .map((option) => parseNumericCost(option.costLabel))
    .filter((value) => value != null);
  const minCost = numericCosts.length > 0 ? Math.min(...numericCosts) : null;

  return {
    key: 'cost',
    label: 'Cost',
    values: perOption.map((option) => {
      const parsed = parseNumericCost(option.costLabel);
      const highlight = minCost != null && parsed === minCost ? 'best' : 'neutral';
      const display = option.perNightCostLabel
        ? `${option.costLabel} (${option.perNightCostLabel})`
        : option.costLabel;
      return {
        eventId: option.eventId,
        display,
        highlight,
      };
    }),
  };
};

const buildPerNightCostDimension = (perOption) => ({
  key: 'per_night_cost',
  label: 'Per night',
  values: perOption.map((option) => {
    const numericPerNight = option.perNightCostLabel
      ? parseNumericCost(option.perNightCostLabel)
      : null;
    const allPerNight = perOption
      .map((entry) => (entry.perNightCostLabel ? parseNumericCost(entry.perNightCostLabel) : null))
      .filter((value) => value != null);
    const minPerNight = allPerNight.length > 0 ? Math.min(...allPerNight) : null;

    return {
      eventId: option.eventId,
      display: option.perNightCostLabel || '—',
      highlight: numericPerNight != null && numericPerNight === minPerNight ? 'best' : 'neutral',
    };
  }),
});

const buildDriveTimeDimension = (perOption) => ({
  key: 'drive_time',
  label: 'Drive time',
  values: perOption.map((option) => ({
    eventId: option.eventId,
    display: option.driveTimeLabel || '—',
    highlight: 'neutral',
  })),
});

const buildTransitTimeDimension = (perOption) => ({
  key: 'transit_time',
  label: 'Transit time',
  values: perOption.map((option) => ({
    eventId: option.eventId,
    display: option.transitTimeLabel || '—',
    highlight: 'neutral',
  })),
});

const buildOpeningHoursDimension = (perOption) => ({
  key: 'opening_hours',
  label: 'Hours',
  values: perOption.map((option) => ({
    eventId: option.eventId,
    display: option.openingHoursLabel || '—',
    highlight: 'neutral',
  })),
});

const buildBookingDimension = (perOption) => ({
  key: 'booking',
  label: 'Booking ref',
  values: perOption.map((option) => ({
    eventId: option.eventId,
    display: option.reservationLabel || '—',
    highlight: 'neutral',
  })),
});

const buildSlotAlignmentDimension = (perOption) => ({
  key: 'slot_alignment',
  label: 'Slot fit',
  values: perOption.map((option) => ({
    eventId: option.eventId,
    display: option.slotAlignmentLabel,
    highlight: option.slotAlignment === 'aligned'
      ? 'best'
      : option.slotAlignment === 'misaligned'
        ? 'worst'
        : 'neutral',
  })),
});

const hasDimensionData = (perOption, field) => (
  perOption.some((option) => option[field] && option[field] !== '—')
);

const buildStayCheckInDimension = (perOption) => ({
  key: 'check_in',
  label: 'Check-in',
  values: perOption.map((option) => ({
    eventId: option.eventId,
    display: option.checkInLabel,
    highlight: 'neutral',
  })),
});

const buildStayCheckOutDimension = (perOption) => ({
  key: 'check_out',
  label: 'Check-out',
  values: perOption.map((option) => ({
    eventId: option.eventId,
    display: option.checkOutLabel,
    highlight: 'neutral',
  })),
});

const buildStayNightsDimension = (perOption) => ({
  key: 'nights',
  label: 'Nights',
  values: perOption.map((option) => ({
    eventId: option.eventId,
    display: option.nightsLabel,
    highlight: 'neutral',
  })),
});

const buildStayLocationDimension = (perOption) => ({
  key: 'location',
  label: 'Location context',
  values: perOption.map((option) => ({
    eventId: option.eventId,
    display: option.nearbyContextLabel || option.address || option.distanceLabel,
    highlight: 'neutral',
  })),
});

const buildOverviewContext = (precomputed) => ({
  comparisonType: precomputed.comparisonType,
  slotLabel: precomputed.slotLabel || undefined,
  referenceLabel: precomputed.referencePoint?.label || undefined,
  referenceDescription: precomputed.referencePoint?.description || undefined,
  staticMapUrl: precomputed.staticMapUrl || undefined,
});

const buildStayDimensions = (perOption) => {
  const dimensions = [
    buildVoteDimension(perOption),
    buildSlotAlignmentDimension(perOption),
    buildStayCheckInDimension(perOption),
    buildStayCheckOutDimension(perOption),
    buildStayNightsDimension(perOption),
    buildCostDimension(perOption),
  ];

  if (hasDimensionData(perOption, 'perNightCostLabel')) {
    dimensions.push(buildPerNightCostDimension(perOption));
  }
  if (hasDimensionData(perOption, 'reservationLabel')) {
    dimensions.push(buildBookingDimension(perOption));
  }
  dimensions.push(buildStayLocationDimension(perOption));

  return dimensions;
};

const buildActivityDestinationDimensions = (perOption, referenceLabel, weatherLabel) => {
  const dimensions = [
    buildVoteDimension(perOption),
    buildSlotAlignmentDimension(perOption),
    buildTimeDimension(perOption),
    buildDistanceDimension(perOption, referenceLabel),
  ];

  if (hasDimensionData(perOption, 'driveTimeLabel')) {
    dimensions.push(buildDriveTimeDimension(perOption));
  }
  if (hasDimensionData(perOption, 'transitTimeLabel')) {
    dimensions.push(buildTransitTimeDimension(perOption));
  }
  if (weatherLabel && weatherLabel !== 'No forecast') {
    dimensions.push(buildWeatherDimension(perOption, weatherLabel));
  }

  dimensions.push(buildCostDimension(perOption));

  if (hasDimensionData(perOption, 'openingHoursLabel')) {
    dimensions.push(buildOpeningHoursDimension(perOption));
  }
  if (hasDimensionData(perOption, 'reservationLabel')) {
    dimensions.push(buildBookingDimension(perOption));
  }

  return dimensions;
};

const buildDeterministicOverview = (decision, precomputed) => {
  const {
    perOption,
    slotDate,
    slotEndDate,
    slotLabel,
    isStayComparison,
    referencePoint,
    neighboringEvents,
  } = precomputed;
  const weatherLabel = perOption[0]?.weatherLabel;
  const referenceLabel = referencePoint?.label || null;

  const sortedByVotes = [...perOption].sort((left, right) => {
    if (right.likes !== left.likes) return right.likes - left.likes;
    return left.dislikes - right.dislikes;
  });
  const leader = sortedByVotes[0];

  const dimensions = isStayComparison
    ? buildStayDimensions(perOption)
    : buildActivityDestinationDimensions(perOption, referenceLabel, weatherLabel);

  const optionSummaries = perOption.map((option) => ({
    eventId: option.eventId,
    bestFor: option.likes > 0 ? [`${option.likes} collaborator like${option.likes === 1 ? '' : 's'}`] : [],
    watchOuts: [
      ...(option.dislikes > 0 ? [`${option.dislikes} dislike${option.dislikes === 1 ? '' : 's'}`] : []),
      ...(option.costLabel === 'Unknown' ? ['No cost listed'] : []),
      ...(option.slotAlignment === 'misaligned' ? ['Dates do not match the decision slot'] : []),
      ...(option.slotAlignment === 'partial' ? ['Only partially overlaps the decision slot'] : []),
      ...(isStayComparison
        ? [
          ...(option.checkOutKey ? [] : ['No check-out date']),
          ...(option.nights == null ? ['Night count unknown'] : []),
        ]
        : [
          ...(option.distanceLabel === 'Unknown' ? ['Distance unknown'] : []),
        ]),
    ],
    oneLiner: option.notes
      ? String(option.notes).slice(0, 120)
      : isStayComparison
        ? `${option.name}: ${option.checkInLabel} – ${option.checkOutLabel} (${option.nightsLabel}).`
        : `${option.name} on ${option.dateKey || slotDate || 'this trip'}.`,
  }));

  const tradeoffs = [];
  if (leader && sortedByVotes[1] && leader.likes === sortedByVotes[1].likes) {
    tradeoffs.push('Votes are tied — ask collaborators to revote before confirming.');
  } else if (leader && leader.likes > 0) {
    tradeoffs.push(`${leader.name} currently leads on likes (${leader.likes}).`);
  }

  if (isStayComparison) {
    const uniqueCheckIns = new Set(perOption.map((option) => option.checkInKey).filter(Boolean));
    const uniqueCheckOuts = new Set(perOption.map((option) => option.checkOutKey).filter(Boolean));
    if (uniqueCheckIns.size > 1) {
      tradeoffs.push('Check-in dates differ across options — confirm everyone is comparing the same stay window.');
    }
    if (uniqueCheckOuts.size > 1) {
      tradeoffs.push('Check-out dates differ across options — total cost and nights may not be apples-to-apples.');
    }
  }

  const misalignedOptions = perOption.filter((option) => option.slotAlignment === 'misaligned');
  if (misalignedOptions.length > 0) {
    tradeoffs.push(`${misalignedOptions.length} option${misalignedOptions.length === 1 ? '' : 's'} fall outside the decision slot dates.`);
  }

  const splitVotes = perOption.filter((option) => option.likes > 0 && option.dislikes > 0);
  if (splitVotes.length > 0) {
    tradeoffs.push('Some options have both likes and dislikes — preferences may be split within the group.');
    splitVotes.slice(0, 2).forEach((option) => {
      const parts = [];
      if (option.likeNames.length > 0) parts.push(`liked by ${option.likeNames.join(', ')}`);
      if (option.dislikeNames.length > 0) parts.push(`disliked by ${option.dislikeNames.join(', ')}`);
      if (parts.length > 0) {
        tradeoffs.push(`${option.name}: ${parts.join('; ')}.`);
      }
    });
  }

  const missingInfo = [];
  if (isStayComparison) {
    if (perOption.some((option) => !option.checkOutKey)) {
      missingInfo.push('Some stay options are missing check-out dates.');
    }
    if (perOption.some((option) => option.nights == null)) {
      missingInfo.push('Some stay options are missing night counts.');
    }
    if (perOption.some((option) => option.costLabel === 'Unknown')) {
      missingInfo.push('Some options are missing cost estimates.');
    }
  } else {
    if (!referencePoint) {
      missingInfo.push('No confirmed stay or same-day plan found to anchor distance comparisons.');
    }
    if (perOption.some((option) => option.distanceLabel === 'Unknown' || option.distanceLabel === 'No reference point')) {
      missingInfo.push('Some options are missing map coordinates for distance comparisons.');
    }
    if (perOption.some((option) => option.costLabel === 'Unknown')) {
      missingInfo.push('Some options are missing cost estimates.');
    }
    if (weatherLabel === 'No forecast') missingInfo.push('Weather forecast is unavailable for this slot.');
  }

  const slotRangeLabel = slotLabel
    || (slotEndDate && slotEndDate !== slotDate
      ? `${formatShortDate(slotDate)} – ${formatShortDate(slotEndDate)}`
      : (slotDate ? formatShortDate(slotDate) : null));

  const optionNames = perOption.map((option) => option.name).join(', ');
  const summaryParts = [];

  if (isStayComparison) {
    summaryParts.push(
      slotRangeLabel
        ? `${decision.title} for ${slotRangeLabel}: comparing ${perOption.length} stay option${perOption.length === 1 ? '' : 's'} (${optionNames}).`
        : `${decision.title}: comparing ${perOption.length} stay option${perOption.length === 1 ? '' : 's'} (${optionNames}).`,
    );
  } else {
    summaryParts.push(
      slotRangeLabel
        ? `${decision.title} on ${slotRangeLabel}: comparing ${perOption.length} option${perOption.length === 1 ? '' : 's'} (${optionNames}).`
        : `${decision.title}: comparing ${perOption.length} option${perOption.length === 1 ? '' : 's'} (${optionNames}).`,
    );
    if (referenceLabel) {
      summaryParts.push(`Distance and travel time are measured from ${referenceLabel}.`);
    }
    if (weatherLabel && weatherLabel !== 'No forecast') {
      summaryParts.push(`Forecast for this slot: ${weatherLabel}.`);
    }
  }

  if (leader && sortedByVotes[1] && leader.likes === sortedByVotes[1].likes && leader.likes > 0) {
    summaryParts.push(`Votes are tied between ${leader.name} and ${sortedByVotes[1].name} (${leader.likes} likes each) — the group should revote before confirming.`);
  } else if (leader && leader.likes > 0) {
    const leaderDetail = isStayComparison
      ? `${leader.name} leads with ${leader.likes} like${leader.likes === 1 ? '' : 's'}.`
      : `${leader.name} leads with ${leader.likes} like${leader.likes === 1 ? '' : 's'}${referenceLabel && leader.distanceKm != null ? ` and is ${formatDistance(leader.distanceKm)} from ${referenceLabel}` : ''}.`;
    summaryParts.push(leaderDetail);
    if (leader.dislikes > 0) {
      summaryParts.push(`${leader.name} also has ${leader.dislikes} dislike${leader.dislikes === 1 ? '' : 's'}, so preferences may not be unanimous.`);
    }
  } else {
    summaryParts.push('No votes yet — review the comparison below and have collaborators vote before confirming a winner.');
  }

  if (misalignedOptions.length > 0) {
    summaryParts.push(`${misalignedOptions.length} option${misalignedOptions.length === 1 ? '' : 's'} ${misalignedOptions.length === 1 ? 'falls' : 'fall'} outside the decision slot dates, so timing may not be apples-to-apples.`);
  }

  if (splitVotes.length > 0) {
    const namedSplit = splitVotes
      .slice(0, 2)
      .map((option) => {
        const parts = [];
        if (option.likeNames.length > 0) parts.push(`liked by ${option.likeNames.join(', ')}`);
        if (option.dislikeNames.length > 0) parts.push(`disliked by ${option.dislikeNames.join(', ')}`);
        return parts.length > 0 ? `${option.name} (${parts.join('; ')})` : null;
      })
      .filter(Boolean);
    if (namedSplit.length > 0) {
      summaryParts.push(`Split preferences: ${namedSplit.join('; ')}.`);
    }
  }

  const summary = summaryParts.join(' ');

  if (!isStayComparison && neighboringEvents.length > 0 && !leader) {
    tradeoffs.push(`Confirmed plans nearby during this slot: ${neighboringEvents.slice(0, 3).map((entry) => entry.name).join(', ')}.`);
  }

  const overview = {
    generatedAt: new Date(),
    generatedBy: 'deterministic',
    stale: false,
    summary,
    context: buildOverviewContext(precomputed),
    dimensions,
    optionSummaries,
    tradeoffs,
    missingInfo,
  };

  if (leader && (leader.likes > 0 || perOption.length === 2)) {
    overview.softRecommendation = {
      eventId: leader.eventId,
      label: leader.name,
      reason: leader.likes > 0
        ? `Most likes (${leader.likes}) among the options.`
        : 'Default pick when no votes are in yet — confirm only when the group agrees.',
      confidence: leader.likes >= 2 ? 'medium' : 'low',
      caveats: leader.dislikes > 0 ? [`${leader.dislikes} dislike${leader.dislikes === 1 ? '' : 's'} recorded`] : [],
    };
  }

  return overview;
};

const normalizeAiOverview = (parsed, decision, precomputed) => {
  const optionIds = new Set(decision.optionEventIds);
  const perOptionById = new Map(precomputed.perOption.map((option) => [option.eventId, option]));

  const dimensions = asArray(parsed.dimensions)
    .map((dimension) => ({
      key: asString(dimension.key) || 'custom',
      label: asString(dimension.label) || 'Details',
      values: asArray(dimension.values)
        .filter((value) => optionIds.has(value.eventId))
        .map((value) => ({
          eventId: value.eventId,
          display: asString(value.display) || '—',
          highlight: asEnum(value.highlight, HIGHLIGHTS, 'neutral'),
        })),
    }))
    .filter((dimension) => dimension.values.length > 0);

  const deterministicDimensions = precomputed.isStayComparison
    ? buildStayDimensions(precomputed.perOption)
    : buildActivityDestinationDimensions(
      precomputed.perOption,
      precomputed.referencePoint?.label || null,
      precomputed.perOption[0]?.weatherLabel,
    );

  const mergedDimensionKeys = new Set(dimensions.map((dimension) => dimension.key));
  deterministicDimensions.forEach((dimension) => {
    if (!mergedDimensionKeys.has(dimension.key)) {
      dimensions.unshift(dimension);
    }
  });

  const optionSummaries = decision.optionEventIds.map((eventId) => {
    const fromAi = asArray(parsed.optionSummaries).find((entry) => entry.eventId === eventId);
    const fallback = perOptionById.get(eventId);
    return {
      eventId,
      bestFor: asArray(fromAi?.bestFor).map((entry) => String(entry)).filter(Boolean).slice(0, 4),
      watchOuts: asArray(fromAi?.watchOuts).map((entry) => String(entry)).filter(Boolean).slice(0, 4),
      oneLiner: asString(fromAi?.oneLiner) || fallback?.notes?.slice(0, 120) || fallback?.name || 'Option',
    };
  });

  const softRecommendationRaw = parsed.softRecommendation;
  let softRecommendation;
  if (softRecommendationRaw && optionIds.has(softRecommendationRaw.eventId)) {
    softRecommendation = {
      eventId: softRecommendationRaw.eventId,
      label: asString(softRecommendationRaw.label) || getEventName({ id: softRecommendationRaw.eventId }),
      reason: asString(softRecommendationRaw.reason) || 'Suggested based on available trip data.',
      confidence: asEnum(softRecommendationRaw.confidence, CONFIDENCE_LEVELS, 'low'),
      caveats: asArray(softRecommendationRaw.caveats).map((entry) => String(entry)).filter(Boolean).slice(0, 4),
    };
  }

  return {
    generatedAt: new Date(),
    generatedBy: 'ai',
    model: getModelName(),
    stale: false,
    summary: asString(parsed.summary) || buildDeterministicOverview(decision, precomputed).summary,
    context: buildOverviewContext(precomputed),
    dimensions,
    optionSummaries,
    tradeoffs: asArray(parsed.tradeoffs).map((entry) => String(entry)).filter(Boolean).slice(0, 6),
    missingInfo: asArray(parsed.missingInfo).map((entry) => String(entry)).filter(Boolean).slice(0, 6),
    softRecommendation,
  };
};

const buildComparisonPrompt = (decision, precomputed) => {
  const optionsBlock = precomputed.perOption.map((option) => (
    `- ${option.name} (${option.eventId})
  type: ${option.type}${option.activityType ? ` (${option.activityType})` : ''}
  date: ${option.dateKey || 'unknown'}${option.checkOutKey ? ` to ${option.checkOutKey}` : ''}
  slotAlignment: ${option.slotAlignmentLabel}
  time: ${option.timeLabel}
  address: ${option.address || 'unknown'}
  googleMaps: ${option.googleMapsUrl || 'none'}
  directionsFromReference: ${option.directionsFromReferenceUrl || 'none'}
  distanceContext: ${option.distanceLabel}
  driveTime: ${option.driveTimeLabel || 'unknown'}
  transitTime: ${option.transitTimeLabel || 'unknown'}
  nearbyContext: ${option.nearbyContextLabel || 'none'}
  weather: ${option.weatherLabel}
  votes: ${option.voteDetailLabel}
  likesFrom: ${option.likeNames.length > 0 ? option.likeNames.join(', ') : 'none'}
  dislikesFrom: ${option.dislikeNames.length > 0 ? option.dislikeNames.join(', ') : 'none'}
  cost: ${option.costLabel}${option.perNightCostLabel ? ` (${option.perNightCostLabel})` : ''}
  openingHours: ${option.openingHoursLabel || 'none'}
  bookingReference: ${option.reservationLabel || 'none'}
  notes: ${option.notes || 'none'}`
  )).join('\n');

  const neighboringBlock = precomputed.neighboringEvents.length > 0
    ? precomputed.neighboringEvents.map((entry) => (
      `- ${entry.name} (${entry.type}) on ${entry.dateKey}${entry.address ? ` · ${entry.address}` : ''}${entry.mapsUrl ? ` · ${entry.mapsUrl}` : ''}`
    )).join('\n')
    : 'none';

  const comparisonGuidance = precomputed.isStayComparison
    ? 'Compare stay lodging options for the slot window. Focus on location relative to confirmed plans, total cost, nights, and check-in/out alignment.'
    : 'Compare same-type options for a specific day or slot. Focus on distance from the reference point, timing, weather, cost, and votes.';

  return `You are helping a travel group compare decision options. Return ONLY valid JSON matching this shape:
{
  "summary": "3-5 sentence overview paragraph",
  "dimensions": [{ "key": "string", "label": "string", "values": [{ "eventId": "string", "display": "string", "highlight": "best|worst|neutral" }] }],
  "optionSummaries": [{ "eventId": "string", "bestFor": ["string"], "watchOuts": ["string"], "oneLiner": "string" }],
  "tradeoffs": ["string"],
  "missingInfo": ["string"],
  "softRecommendation": { "eventId": "string", "label": "string", "reason": "string", "confidence": "low|medium|high", "caveats": ["string"] }
}

Rules:
1. Ground every claim in the option facts below — do not invent prices, distances, or votes.
2. Use the decision slot date/range and reference point when discussing location, timing, and convenience.
3. Google Maps links are for location context only — do not claim live traffic, ratings, or hours from them.
4. Keep dimensions scannable (cost, location, time, effort, weather, nights, booking, etc.).
5. softRecommendation is non-binding; prefer the vote leader only when votes exist.
6. Use highlight "best"/"worst" sparingly and only when supported by the facts.
7. Mention split preferences by name when collaborators disagree on an option.
8. Write summary as a 3-5 sentence paragraph that covers: what is being decided and when, how the options differ on the main factors (cost, location, timing, votes), current group sentiment, and the key thing the group should weigh before confirming.
9. ${comparisonGuidance}

Decision title: ${decision.title}
Comparison category: ${precomputed.comparisonType}
Decision slot: ${precomputed.slotLabel || precomputed.slotDate || 'unknown'}${precomputed.slotEndDate ? ` (${precomputed.slotDate} to ${precomputed.slotEndDate})` : ''}
Reference point: ${precomputed.referencePoint?.label || 'none'}${precomputed.referencePoint?.description ? ` — ${precomputed.referencePoint.description}` : ''}
Reference maps: ${precomputed.referencePoint?.mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(precomputed.referencePoint.mapsQuery)}` : 'none'}
Weather during slot: ${precomputed.perOption[0]?.weatherLabel || 'unknown'}

Confirmed plans during this slot:
${neighboringBlock}

Options:
${optionsBlock}`;
};

const generateAiOverview = async (decision, precomputed) => {
  const { text } = await generateAiText({
    prompt: buildComparisonPrompt(decision, precomputed),
    temperature: 0.4,
    maxOutputTokens: 2500,
    responseMimeType: 'application/json',
  });

  if (!text) throw new Error('Empty AI response');
  const parsed = JSON.parse(extractJsonObject(text));
  return normalizeAiOverview(parsed, decision, precomputed);
};

const generateComparisonOverview = async (trip, decisionId, { forceRefresh = false } = {}) => {
  const decision = (trip.decisions || []).find((entry) => entry.id === decisionId);
  if (!decision) {
    throw new Error('Decision not found');
  }

  if (
    !forceRefresh
    && decision.comparisonOverview
    && !decision.comparisonOverview.stale
  ) {
    return decision.comparisonOverview;
  }

  const precomputed = await buildPrecomputedFacts(trip, decision);

  let overview;
  if (hasConfiguredAiProvider()) {
    try {
      overview = await generateAiOverview(decision, precomputed);
    } catch (error) {
      console.warn('AI comparison overview failed, using deterministic fallback:', error.message);
      overview = buildDeterministicOverview(decision, precomputed);
    }
  } else {
    overview = buildDeterministicOverview(decision, precomputed);
  }

  decision.comparisonOverview = overview;
  trip.markModified('decisions');
  await trip.save();

  return overview;
};

module.exports = {
  generateComparisonOverview,
  buildDeterministicOverview,
  buildPrecomputedFacts,
  __test: {
    haversineKm,
    buildDeterministicOverview,
    normalizeAiOverview,
  },
};
