const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Trip = require('../models/Trip');
const { getTripWeather } = require('../services/weather');

router.get('/trips/:tripId/weather', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    const access = trip.hasAccess(req.user._id);
    if (!access) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await getTripWeather({
      trip,
      refresh: req.query.refresh === 'true'
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching trip weather:', {
      message: error.message,
      tripId: req.params.tripId,
      userId: req.user?._id
    });
    res.status(500).json({ message: 'Failed to fetch trip weather' });
  }
});

module.exports = router;
