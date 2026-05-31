const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Trip = require('../models/Trip');
const { getTripTimelineTransferLegs } = require('../services/timelineTransferLegs');

router.get('/trips/:tripId/timeline-legs', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    const access = trip.hasAccess(req.user._id);
    if (!access) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await getTripTimelineTransferLegs({
      trip,
      refresh: req.query.refresh === 'true',
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching timeline transfer legs:', {
      message: error.message,
      tripId: req.params.tripId,
      userId: req.user?._id,
    });
    res.status(500).json({ message: 'Failed to fetch timeline transfer legs' });
  }
});

module.exports = router;
