const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Trip = require('../models/Trip');
const { geocodeTripEvents } = require('../services/geocoding');

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

    const result = await geocodeTripEvents(trip);
    res.json({
      trip,
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
