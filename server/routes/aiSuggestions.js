const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const AISuggestion = require('../models/AISuggestion');
const Trip = require('../models/Trip');

// Get AI suggestions for a trip
router.get('/trips/:tripId/ai-suggestions/:userId', auth, async (req, res) => {
  try {
    const { tripId, userId } = req.params;
    
    // Verify user has access to the trip
    const trip = await Trip.findOne({
      _id: tripId,
      $or: [
        { owner: userId },
        { 'collaborators.user': userId }
      ]
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const suggestions = await AISuggestion.find({
      tripId,
      userId
    }).sort({ createdAt: -1 });

    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching AI suggestions:', error);
    res.status(500).json({ message: 'Error fetching AI suggestions' });
  }
});

// Save a new AI suggestion
router.post('/trips/:tripId/ai-suggestions', auth, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { userId, places, activities, suggestions } = req.body;

    // Verify user has access to the trip
    const trip = await Trip.findOne({
      _id: tripId,
      $or: [
        { owner: userId },
        { 'collaborators.user': userId }
      ]
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const newSuggestion = new AISuggestion({
      userId,
      tripId,
      places,
      activities,
      suggestions
    });

    await newSuggestion.save();
    res.status(201).json(newSuggestion);
  } catch (error) {
    console.error('Error saving AI suggestion:', error);
    res.status(500).json({ message: 'Error saving AI suggestion' });
  }
});

module.exports = router; 