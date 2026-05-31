const TimelineTransferLeg = require('../models/TimelineTransferLeg');
const { getDrivingLegsForPairs } = require('./distanceMatrix');
const { discoverTimelineTransferLegs } = require('./timelineTransferLegDiscovery');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PROVIDER = 'google_distance_matrix';

const buildLegId = (leg) => `${leg.fromEventId}:${leg.toEventId}:${leg.dayKey}`;

const serializeLeg = (doc) => ({
  fromEventId: doc.fromEventId,
  toEventId: doc.toEventId,
  dayKey: doc.dayKey,
  driveDistanceMeters: doc.driveDistanceMeters ?? null,
  driveDurationSeconds: doc.driveDurationSeconds ?? null,
  driveDistanceLabel: doc.driveDistanceLabel ?? null,
  driveDurationLabel: doc.driveDurationLabel ?? null,
  status: doc.status,
  gapMinutes: doc.gapMinutes ?? null,
});

const getTripTimelineTransferLegs = async ({ trip, refresh = false }) => {
  const configured = !!GOOGLE_MAPS_API_KEY;
  const discoveredLegs = await discoverTimelineTransferLegs(trip.events || []);

  if (refresh) {
    await TimelineTransferLeg.deleteMany({ tripId: trip._id });
  }

  if (discoveredLegs.length === 0) {
    return {
      provider: PROVIDER,
      configured,
      legs: [],
      diagnostics: {
        status: 'no_targets',
        message: 'No timeline transfer legs with resolvable locations were found.',
        discoveredLegs: 0,
        cachedLegs: 0,
        fetchedLegs: 0,
      },
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

  const existingDocs = await TimelineTransferLeg.find({
    tripId: trip._id,
    expiresAt: { $gt: now },
  }).lean();

  const cacheByKey = new Map(
    existingDocs.map((doc) => [
      `${doc.fromEventId}:${doc.toEventId}:${doc.dayKey}:${doc.locationKey}`,
      doc,
    ]),
  );

  const legsToFetch = [];
  const resolvedLegs = [];

  discoveredLegs.forEach((leg) => {
    const cacheKey = `${leg.fromEventId}:${leg.toEventId}:${leg.dayKey}:${leg.locationKey}`;
    const cached = cacheByKey.get(cacheKey);

    if (cached && !refresh) {
      resolvedLegs.push({
        ...cached,
        gapMinutes: leg.gapMinutes,
      });
      return;
    }

    legsToFetch.push({
      ...leg,
      legId: buildLegId(leg),
    });
  });

  let fetchedCount = 0;

  if (configured && legsToFetch.length > 0) {
    const drivingResults = await getDrivingLegsForPairs(legsToFetch);
    fetchedCount = legsToFetch.length;

    for (const leg of legsToFetch) {
      const driving = drivingResults.get(leg.legId) || { status: 'unavailable' };
      const doc = await TimelineTransferLeg.findOneAndUpdate(
        {
          tripId: trip._id,
          fromEventId: leg.fromEventId,
          toEventId: leg.toEventId,
          dayKey: leg.dayKey,
          locationKey: leg.locationKey,
        },
        {
          tripId: trip._id,
          fromEventId: leg.fromEventId,
          toEventId: leg.toEventId,
          dayKey: leg.dayKey,
          locationKey: leg.locationKey,
          originLat: leg.fromPoint.lat,
          originLng: leg.fromPoint.lng,
          destinationLat: leg.toPoint.lat,
          destinationLng: leg.toPoint.lng,
          driveDistanceMeters: driving.driveDistanceMeters,
          driveDurationSeconds: driving.driveDurationSeconds,
          driveDistanceLabel: driving.driveDistanceLabel,
          driveDurationLabel: driving.driveDurationLabel,
          status: driving.status,
          provider: PROVIDER,
          fetchedAt: now,
          expiresAt,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();

      resolvedLegs.push({
        ...doc,
        gapMinutes: leg.gapMinutes,
      });
    }
  } else if (legsToFetch.length > 0) {
    legsToFetch.forEach((leg) => {
      resolvedLegs.push({
        fromEventId: leg.fromEventId,
        toEventId: leg.toEventId,
        dayKey: leg.dayKey,
        status: 'unavailable',
        gapMinutes: leg.gapMinutes,
      });
    });
  }

  const legs = resolvedLegs.map(serializeLeg);
  let status = 'available';
  let message = 'Driving distances are available for timeline legs.';

  if (!configured) {
    status = 'not_configured';
    message = 'Google Maps API key is not configured.';
  } else if (legs.length === 0) {
    status = 'no_data';
    message = 'No driving distances could be resolved for this itinerary.';
  } else if (legs.some((leg) => leg.status !== 'ok')) {
    status = 'partial';
    message = 'Driving distances are available for some timeline legs.';
  }

  return {
    provider: PROVIDER,
    configured,
    legs,
    diagnostics: {
      status,
      message,
      discoveredLegs: discoveredLegs.length,
      cachedLegs: discoveredLegs.length - legsToFetch.length,
      fetchedLegs: fetchedCount,
    },
  };
};

module.exports = {
  getTripTimelineTransferLegs,
};
