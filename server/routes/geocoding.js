const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Trip = require('../models/Trip');
const { serializeTrip } = require('../utils/tripSerializer');
const {
  geocodeLocation,
  geocodeTripEvents,
  previewEventGeocode,
  applyEventLocation,
  withTripGeocodeLock,
} = require('../services/geocoding');

router.get('/geocode', auth, async (req, res) => {
  try {
    const query = String(req.query.query || '').trim();
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }

    const geocoded = await geocodeLocation(query);
    if (!geocoded) {
      return res.status(404).json({ message: 'No geocode result found' });
    }

    res.json({
      lat: geocoded.lat,
      lng: geocoded.lng,
      displayName: geocoded.displayName || query,
      confidence: geocoded.confidence,
    });
  } catch (error) {
    console.error('Error geocoding query:', {
      message: error.message,
      query: req.query.query,
      userId: req.user?._id,
    });
    res.status(500).json({ message: 'Failed to geocode location' });
  }
});

router.post('/geocode/preview', auth, async (req, res) => {
  try {
    const event = req.body?.event;
    if (!event || !event.id) {
      return res.status(400).json({ message: 'Event with id is required' });
    }

    const preview = await previewEventGeocode(event);
    res.json(preview);
  } catch (error) {
    console.error('Error previewing event geocode:', {
      message: error.message,
      eventId: req.body?.event?.id,
      userId: req.user?._id,
    });
    res.status(500).json({ message: 'Failed to preview event location' });
  }
});

router.post('/trips/:tripId/events/:eventId/location', auth, async (req, res) => {
  try {
    const isTransportApply = !!(req.body?.departure || req.body?.arrival);
    if (!isTransportApply) {
      const { lat, lng } = req.body || {};
      if (lat === undefined || lng === undefined || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
        return res.status(400).json({ message: 'Valid lat and lng are required' });
      }
    } else if (!req.body.departure && !req.body.arrival) {
      return res.status(400).json({ message: 'At least one endpoint location is required' });
    }

    const { trip, event } = await applyEventLocation(
      req.params.tripId,
      req.params.eventId,
      req.body,
      req.user._id,
    );

    const populatedTrip = await Trip.findById(trip._id)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl');

    res.json({
      trip: serializeTrip(populatedTrip),
      event,
    });
  } catch (error) {
    if (error.message === 'Trip not found' || error.message === 'Event not found') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'Access denied') {
      return res.status(403).json({ message: error.message });
    }

    console.error('Error applying event location:', {
      message: error.message,
      tripId: req.params.tripId,
      eventId: req.params.eventId,
      userId: req.user?._id,
    });
    res.status(500).json({ message: 'Failed to apply event location' });
  }
});

router.post('/trips/:tripId/geocode-events', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    const access = trip.hasAccess(req.user._id);
    if (!access || (access !== 'owner' && access !== 'editor')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const eventIds = Array.isArray(req.body?.eventIds) ? req.body.eventIds : undefined;
    const result = await withTripGeocodeLock(trip._id, async () => {
      const freshTrip = await Trip.findById(trip._id);
      if (!freshTrip) {
        throw new Error('Trip not found');
      }
      return geocodeTripEvents(freshTrip, { eventIds });
    });
    const populatedTrip = await Trip.findById(trip._id)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl');

    res.json({
      trip: serializeTrip(populatedTrip),
      ...result
    });
  } catch (error) {
    console.error('Error geocoding trip events:', {
      message: error.message,
      tripId: req.params.tripId,
      userId: req.user?._id
    });
    res.status(500).json({ message: 'Failed to improve event locations' });
  }
});

module.exports = router;
