const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const AISuggestion = require('../models/AISuggestion');
const Trip = require('../models/Trip');
const DreamTrip = require('../models/DreamTrip');

// Get AI suggestions for a regular trip
router.get('/trips/:tripId/ai-suggestions/:userId', auth, async (req, res) => {
  try {
    const { tripId, userId } = req.params;
    console.log('Fetching AI suggestions for regular trip:', { tripId, userId });
    
    // Verify user has access to the trip
    const trip = await Trip.findOne({
      _id: tripId,
      $or: [
        { owner: userId },
        { 'collaborators.user': userId }
      ]
    });

    if (!trip) {
      console.log('Trip not found or access denied:', { tripId, userId });
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    console.log('User has access to trip, fetching suggestions');
    
    // Get all suggestions for the trip, regardless of who created them
    const suggestions = await AISuggestion.find({
      tripId
    }).sort({ createdAt: -1 });

    console.log(`Found ${suggestions.length} suggestions for trip ${tripId}`);
    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching AI suggestions:', error);
    res.status(500).json({ message: 'Error fetching AI suggestions' });
  }
});

// Get AI suggestions for a dream trip
router.get('/trips/dream/:tripId/ai-suggestions/:userId', auth, async (req, res) => {
  try {
    const { tripId, userId } = req.params;
    console.log('Fetching AI suggestions for dream trip:', { tripId, userId });
    
    // Verify user has access to the dream trip
    const trip = await DreamTrip.findOne({
      _id: tripId,
      $or: [
        { owner: userId },
        { 'collaborators.user': userId }
      ]
    });

    if (!trip) {
      console.log('Dream trip not found or access denied:', { tripId, userId });
      return res.status(404).json({ message: 'Dream trip not found or access denied' });
    }

    console.log('User has access to dream trip, fetching suggestions');
    
    // Get all suggestions for the trip, regardless of who created them
    const suggestions = await AISuggestion.find({
      tripId
    }).sort({ createdAt: -1 });

    console.log(`Found ${suggestions.length} suggestions for dream trip ${tripId}`);
    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching AI suggestions for dream trip:', error);
    res.status(500).json({ message: 'Error fetching AI suggestions' });
  }
});

// Save a new AI suggestion for a regular trip
router.post('/trips/:tripId/ai-suggestions', auth, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { userId, places, activities, suggestions } = req.body;
    console.log('Saving new AI suggestion for regular trip:', { tripId, userId, places, activities });

    // Verify user has access to the trip
    const trip = await Trip.findOne({
      _id: tripId,
      $or: [
        { owner: userId },
        { 'collaborators.user': userId }
      ]
    });

    if (!trip) {
      console.log('Trip not found or access denied:', { tripId, userId });
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    console.log('User has access to trip, creating new suggestion');
    
    const newSuggestion = new AISuggestion({
      userId,
      tripId,
      places,
      activities,
      suggestions
    });

    await newSuggestion.save();
    console.log('Successfully saved new suggestion:', newSuggestion._id);
    res.status(201).json(newSuggestion);
  } catch (error) {
    console.error('Error saving AI suggestion:', error);
    res.status(500).json({ message: 'Error saving AI suggestion' });
  }
});

// Save a new AI suggestion for a dream trip
router.post('/trips/dream/:tripId/ai-suggestions', auth, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { userId, places, activities, suggestions } = req.body;
    console.log('Saving new AI suggestion for dream trip:', { tripId, userId, places, activities });

    // Verify user has access to the dream trip
    const trip = await DreamTrip.findOne({
      _id: tripId,
      $or: [
        { owner: userId },
        { 'collaborators.user': userId }
      ]
    });

    if (!trip) {
      console.log('Dream trip not found or access denied:', { tripId, userId });
      return res.status(404).json({ message: 'Dream trip not found or access denied' });
    }

    console.log('User has access to dream trip, creating new suggestion');
    
    const newSuggestion = new AISuggestion({
      userId,
      tripId,
      places,
      activities,
      suggestions
    });

    await newSuggestion.save();
    console.log('Successfully saved new suggestion:', newSuggestion._id);
    res.status(201).json(newSuggestion);
  } catch (error) {
    console.error('Error saving AI suggestion for dream trip:', error);
    res.status(500).json({ message: 'Error saving AI suggestion' });
  }
});

// Delete an AI suggestion
router.delete('/trips/ai-suggestions/:suggestionId', auth, async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const userId = req.user._id;
    console.log('Deleting AI suggestion:', { suggestionId, userId });

    // Find the suggestion to get the trip ID
    const suggestion = await AISuggestion.findById(suggestionId);
    if (!suggestion) {
      console.log('Suggestion not found:', suggestionId);
      return res.status(404).json({ message: 'Suggestion not found' });
    }

    // Check if this is a dream trip by looking at the path
    const isDreamTrip = req.path.includes('/dream/');
    const TripModel = isDreamTrip ? DreamTrip : Trip;

    // Verify user has access to the trip
    const trip = await TripModel.findOne({
      _id: suggestion.tripId,
      $or: [
        { owner: userId },
        { 'collaborators.user': userId }
      ]
    });

    if (!trip) {
      console.log('Access denied to trip:', { tripId: suggestion.tripId, userId });
      return res.status(403).json({ message: 'Access denied' });
    }

    await AISuggestion.findByIdAndDelete(suggestionId);
    console.log('Successfully deleted suggestion:', suggestionId);
    res.json({ message: 'Suggestion deleted successfully' });
  } catch (error) {
    console.error('Error deleting AI suggestion:', error);
    res.status(500).json({ message: 'Error deleting AI suggestion' });
  }
});

// Delete an AI suggestion for a dream trip
router.delete('/trips/dream/ai-suggestions/:suggestionId', auth, async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const userId = req.user._id;
    console.log('Deleting AI suggestion for dream trip:', { suggestionId, userId });

    // Find the suggestion to get the trip ID
    const suggestion = await AISuggestion.findById(suggestionId);
    if (!suggestion) {
      console.log('Suggestion not found:', suggestionId);
      return res.status(404).json({ message: 'Suggestion not found' });
    }

    // Verify user has access to the dream trip
    const trip = await DreamTrip.findOne({
      _id: suggestion.tripId,
      $or: [
        { owner: userId },
        { 'collaborators.user': userId }
      ]
    });

    if (!trip) {
      console.log('Access denied to dream trip:', { tripId: suggestion.tripId, userId });
      return res.status(403).json({ message: 'Access denied' });
    }

    await AISuggestion.findByIdAndDelete(suggestionId);
    console.log('Successfully deleted suggestion:', suggestionId);
    res.json({ message: 'Suggestion deleted successfully' });
  } catch (error) {
    console.error('Error deleting AI suggestion for dream trip:', error);
    res.status(500).json({ message: 'Error deleting AI suggestion' });
  }
});

module.exports = router; 