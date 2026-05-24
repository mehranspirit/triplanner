const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  generateTravelSuggestions,
  generateDreamTripSuggestions,
  generateDestinationSuggestions,
} = require('../services/aiSuggestionGenerator');

router.post('/ai/travel-suggestions', auth, async (req, res) => {
  try {
    const suggestions = await generateTravelSuggestions(req.body || {});
    res.json({ suggestions });
  } catch (error) {
    console.error('Error generating travel suggestions:', error);
    res.status(500).json({ message: error.message || 'Failed to generate suggestions' });
  }
});

router.post('/ai/dream-trip-suggestions', auth, async (req, res) => {
  try {
    const suggestions = await generateDreamTripSuggestions(req.body || {});
    res.json({ suggestions });
  } catch (error) {
    console.error('Error generating dream trip suggestions:', error);
    res.status(500).json({ message: error.message || 'Failed to generate dream trip suggestions' });
  }
});

router.post('/ai/destination-suggestions', auth, async (req, res) => {
  try {
    const suggestions = await generateDestinationSuggestions({
      ...(req.body || {}),
      user: {
        _id: req.user._id.toString(),
        name: req.user.name,
        email: req.user.email,
        photoUrl: req.user.photoUrl || null,
      },
    });
    res.json({ suggestions });
  } catch (error) {
    console.error('Error generating destination suggestions:', error);
    res.status(500).json({ message: error.message || 'Failed to generate destination suggestions' });
  }
});

module.exports = router;
