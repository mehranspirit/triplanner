const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Trip = require('../models/Trip');
const SuggestionFeedback = require('../models/SuggestionFeedback');
const {
  answerTripQuestion,
  generateTripAssistantBriefing,
  generateTripReplanBriefing,
  generateTripTodayBriefing
} = require('../services/assistantBriefing');

const findAccessibleTrip = async (tripId, userId) => {
  const trip = await Trip.findById(tripId);
  if (!trip || !trip.hasAccess(userId)) return null;
  return trip;
};

const allowedSuggestionTypes = new Set([
  'assistant_checklist_item',
  'assistant_action',
  'assistant_backup_event'
]);

const allowedStatuses = new Set(['accepted', 'dismissed']);

router.post('/trips/:tripId/assistant-briefing', auth, async (req, res) => {
  try {
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const result = await generateTripAssistantBriefing({
      trip: trip.toObject(),
      user: req.user,
    });

    res.json(result);
  } catch (error) {
    console.error('Error generating assistant briefing:', {
      message: error.message,
      tripId: req.params.tripId,
      userId: req.user?._id,
    });
    res.status(500).json({ message: 'Failed to generate assistant briefing' });
  }
});

router.post('/trips/:tripId/today-briefing', auth, async (req, res) => {
  try {
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const result = await generateTripTodayBriefing({
      trip: trip.toObject(),
      user: req.user,
    });

    res.json(result);
  } catch (error) {
    console.error('Error generating Today briefing:', {
      message: error.message,
      tripId: req.params.tripId,
      userId: req.user?._id,
    });
    res.status(500).json({ message: 'Failed to generate Today briefing' });
  }
});

router.post('/trips/:tripId/replan-day', auth, async (req, res) => {
  try {
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const result = await generateTripReplanBriefing({
      trip: trip.toObject(),
      user: req.user,
    });

    res.json(result);
  } catch (error) {
    console.error('Error generating day replan briefing:', {
      message: error.message,
      tripId: req.params.tripId,
      userId: req.user?._id,
    });
    res.status(500).json({ message: 'Failed to generate day replan briefing' });
  }
});

router.post('/trips/:tripId/ask', auth, async (req, res) => {
  try {
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const { question } = req.body;
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ message: 'Question is required' });
    }

    const result = await answerTripQuestion({
      trip: trip.toObject(),
      question,
      user: req.user,
    });

    res.json(result);
  } catch (error) {
    console.error('Error answering trip question:', {
      message: error.message,
      tripId: req.params.tripId,
      userId: req.user?._id,
    });
    res.status(500).json({ message: 'Failed to answer trip question' });
  }
});

router.get('/trips/:tripId/assistant-feedback', auth, async (req, res) => {
  try {
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const feedback = await SuggestionFeedback.find({
      tripId: req.params.tripId,
      userId: req.user._id
    }).sort({ updatedAt: -1 }).limit(200);

    res.json(feedback);
  } catch (error) {
    console.error('Error fetching assistant feedback:', {
      message: error.message,
      tripId: req.params.tripId,
      userId: req.user?._id,
    });
    res.status(500).json({ message: 'Failed to fetch assistant feedback' });
  }
});

router.post('/trips/:tripId/assistant-feedback', auth, async (req, res) => {
  try {
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const {
      suggestionId,
      suggestionType,
      status,
      scope,
      title,
      reason,
      payload
    } = req.body;

    if (!suggestionId || typeof suggestionId !== 'string') {
      return res.status(400).json({ message: 'suggestionId is required' });
    }
    if (!allowedSuggestionTypes.has(suggestionType)) {
      return res.status(400).json({ message: 'Invalid suggestionType' });
    }
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const timestampField = status === 'accepted'
      ? { acceptedAt: new Date() }
      : { dismissedAt: new Date() };
    const unsetField = status === 'accepted'
      ? { dismissedAt: '' }
      : { acceptedAt: '' };

    const feedback = await SuggestionFeedback.findOneAndUpdate(
      {
        userId: req.user._id,
        tripId: req.params.tripId,
        suggestionId
      },
      {
        $setOnInsert: {
          userId: req.user._id,
          tripId: req.params.tripId,
          suggestionId
        },
        $set: {
          suggestionType,
          status,
          scope: scope === 'shared' ? 'shared' : 'personal',
          title,
          reason,
          payload,
          ...timestampField
        },
        $unset: unsetField
      },
      { new: true, upsert: true }
    );

    res.json(feedback);
  } catch (error) {
    console.error('Error saving assistant feedback:', {
      message: error.message,
      tripId: req.params.tripId,
      userId: req.user?._id,
    });
    res.status(500).json({ message: 'Failed to save assistant feedback' });
  }
});

module.exports = router;
