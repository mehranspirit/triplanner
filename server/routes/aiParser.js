const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Trip = require('../models/Trip');
const { parseEventText } = require('../services/eventParser');

router.post('/trips/:tripId/parse-event', auth, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: 'Text is required' });
    }

    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    const access = trip.hasAccess(req.user._id);
    if (!access) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await parseEventText({
      text,
      trip: trip.toObject(),
      user: req.user,
    });

    res.json(result);
  } catch (error) {
    console.error('Error parsing event text:', {
      message: error.message,
      tripId: req.params.tripId,
      userId: req.user?._id,
    });
    res.status(500).json({ message: 'Failed to parse event details. Please try again or enter details manually.' });
  }
});

module.exports = router;
