const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { autocompletePlaces, getPlaceDetails } = require('../services/places');

router.get('/places/autocomplete', auth, async (req, res) => {
  try {
    const input = String(req.query.input || '').trim();
    if (!input) {
      return res.status(400).json({ message: 'Input is required' });
    }

    const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;

    const sessionToken = String(req.query.sessionToken || '').trim() || undefined;

    const results = await autocompletePlaces(input, { lat, lng, sessionToken });
    res.json({ results });
  } catch (error) {
    console.error('Error autocompleting places:', {
      message: error.message,
      userId: req.user?._id,
    });
    res.status(500).json({ message: 'Failed to search places' });
  }
});

router.get('/places/details', auth, async (req, res) => {
  try {
    const placeId = String(req.query.placeId || '').trim();
    if (!placeId) {
      return res.status(400).json({ message: 'placeId is required' });
    }

    const sessionToken = String(req.query.sessionToken || '').trim() || undefined;

    const details = await getPlaceDetails(placeId, { sessionToken });
    if (!details) {
      return res.status(404).json({ message: 'Place not found' });
    }

    res.json(details);
  } catch (error) {
    console.error('Error fetching place details:', {
      message: error.message,
      placeId: req.query.placeId,
      userId: req.user?._id,
    });
    res.status(500).json({ message: 'Failed to fetch place details' });
  }
});

module.exports = router;
