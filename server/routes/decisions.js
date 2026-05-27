const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();
const auth = require('../middleware/auth');
const Trip = require('../models/Trip');
const { logActivity } = require('../utils/activityLogger');
const { generateComparisonOverview } = require('../services/decisionComparison');

const VOTEABLE_EVENT_TYPES = new Set(['activity', 'destination', 'stay']);
const VALID_LOSER_ACTIONS = new Set(['archive', 'delete', 'keep_exploring']);
const VALID_STATUSES = new Set(['open', 'decided', 'deferred']);

const serializeUserRef = (user) => {
  if (!user) return undefined;
  const plain = user.toObject ? user.toObject() : user;
  return {
    _id: plain._id?.toString?.() || plain._id,
    name: plain.name,
    email: plain.email,
    photoUrl: plain.photoUrl ?? null,
  };
};

const serializeComparisonOverview = (overview) => {
  if (!overview) return undefined;
  const plain = overview.toObject ? overview.toObject() : overview;
  return {
    ...plain,
    generatedAt: plain.generatedAt?.toISOString?.() || plain.generatedAt,
  };
};

const serializeDecision = (decision, tripId) => {
  const plain = decision.toObject ? decision.toObject() : decision;
  return {
    id: plain.id,
    tripId,
    title: plain.title,
    slot: plain.slot || undefined,
    optionEventIds: plain.optionEventIds || [],
    status: plain.status,
    winnerEventId: plain.winnerEventId || undefined,
    decidedAt: plain.decidedAt?.toISOString?.() || plain.decidedAt || undefined,
    decidedBy: serializeUserRef(plain.decidedBy),
    createdBy: serializeUserRef(plain.createdBy),
    createdAt: plain.createdAt?.toISOString?.() || plain.createdAt,
    comparisonOverview: serializeComparisonOverview(plain.comparisonOverview),
  };
};

const serializeDecisions = (decisions = [], tripId) => (
  decisions.map((decision) => serializeDecision(decision, tripId))
);

const getEventName = (event) => {
  if (!event) return 'Event';
  if (event.type === 'stay') return event.accommodationName || 'Stay';
  if (event.type === 'destination') return event.placeName || 'Destination';
  if (event.type === 'activity') return event.title || 'Activity';
  return event.title || event.placeName || event.accommodationName || 'Event';
};

const canEditTrip = (trip, userId) => {
  const accessRole = trip.hasAccess(userId);
  return Boolean(accessRole && accessRole !== 'viewer');
};

const getOpenDecisionEventIds = (decisions = [], excludeDecisionId) => {
  const ids = new Set();
  decisions.forEach((decision) => {
    if (decision.status !== 'open' || decision.id === excludeDecisionId) return;
    (decision.optionEventIds || []).forEach((eventId) => ids.add(eventId));
  });
  return ids;
};

const findTripEvent = (trip, eventId) => trip.events.find((event) => event.id === eventId);

const validateOptionEvents = (trip, eventIds, excludeDecisionId) => {
  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    return 'At least one option event is required';
  }

  const uniqueIds = [...new Set(eventIds.filter((id) => typeof id === 'string' && id.trim()))];
  if (uniqueIds.length !== eventIds.length) {
    return 'Duplicate option event ids are not allowed';
  }

  const reservedIds = getOpenDecisionEventIds(trip.decisions, excludeDecisionId);

  for (const eventId of uniqueIds) {
    const event = findTripEvent(trip, eventId);
    if (!event) {
      return `Event not found: ${eventId}`;
    }
    if (!VOTEABLE_EVENT_TYPES.has(event.type)) {
      return `Only activity, destination, and stay events can be decision options`;
    }
    if (event.status !== 'exploring') {
      return `${getEventName(event)} must be in exploring status`;
    }
    if (reservedIds.has(eventId)) {
      return `${getEventName(event)} is already in another open decision`;
    }
  }

  return null;
};

const markComparisonStale = (decision) => {
  if (decision.comparisonOverview) {
    decision.comparisonOverview.stale = true;
  }
};

const loadEditableTrip = async (tripId, userId, res) => {
  const trip = await Trip.findById(tripId);
  if (!trip) {
    res.status(404).json({ message: 'Trip not found' });
    return null;
  }

  if (!canEditTrip(trip, userId)) {
    res.status(403).json({ message: 'You do not have permission to manage decisions on this trip' });
    return null;
  }

  if (!Array.isArray(trip.decisions)) {
    trip.decisions = [];
  }

  return trip;
};

const loadReadableTrip = async (tripId, userId, res) => {
  const trip = await Trip.findById(tripId);
  if (!trip) {
    res.status(404).json({ message: 'Trip not found' });
    return null;
  }

  const accessRole = trip.hasAccess(userId);
  if (!accessRole) {
    res.status(403).json({ message: 'You do not have access to this trip' });
    return null;
  }

  if (!Array.isArray(trip.decisions)) {
    trip.decisions = [];
  }

  return trip;
};

router.get('/trips/:tripId/decisions', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    const accessRole = trip.hasAccess(req.user._id);
    if (!accessRole) {
      return res.status(403).json({ message: 'You do not have access to this trip' });
    }

    res.json(serializeDecisions(trip.decisions || [], trip._id.toString()));
  } catch (error) {
    console.error('Error fetching decisions:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/trips/:tripId/decisions', auth, async (req, res) => {
  try {
    const { title, slot, optionEventIds } = req.body || {};
    const trip = await loadEditableTrip(req.params.tripId, req.user._id, res);
    if (!trip) return;

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'title is required' });
    }

    if (!Array.isArray(optionEventIds) || optionEventIds.length < 2) {
      return res.status(400).json({ message: 'At least two option events are required' });
    }

    const validationError = validateOptionEvents(trip, optionEventIds);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const decision = {
      id: randomUUID(),
      title: title.trim(),
      slot: slot && typeof slot === 'object' ? {
        date: typeof slot.date === 'string' ? slot.date : undefined,
        endDate: typeof slot.endDate === 'string' ? slot.endDate : undefined,
        startTime: typeof slot.startTime === 'string' ? slot.startTime : undefined,
        endTime: typeof slot.endTime === 'string' ? slot.endTime : undefined,
        label: typeof slot.label === 'string' ? slot.label : undefined,
      } : undefined,
      optionEventIds: [...new Set(optionEventIds)],
      status: 'open',
      createdBy: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        photoUrl: req.user.photoUrl ?? null,
      },
      createdAt: new Date(),
    };

    trip.decisions.push(decision);
    trip.markModified('decisions');
    await trip.save();

    try {
      await generateComparisonOverview(trip, decision.id, { forceRefresh: true });
    } catch (overviewError) {
      console.warn('Comparison overview generation on create failed:', overviewError.message);
    }

    await logActivity({
      userId: req.user._id,
      tripId: trip._id,
      actionType: 'decision_created',
      description: `Created decision "${decision.title}" with ${decision.optionEventIds.length} options on "${trip.name}"`,
      details: {
        decisionId: decision.id,
        title: decision.title,
        optionEventIds: decision.optionEventIds,
      },
    });

    res.status(201).json(serializeDecisions(trip.decisions, trip._id.toString()));
  } catch (error) {
    console.error('Error creating decision:', error);
    res.status(500).json({ message: error.message });
  }
});

router.patch('/trips/:tripId/decisions/:decisionId', auth, async (req, res) => {
  try {
    const { title, slot, status, addOptionEventIds, removeOptionEventIds } = req.body || {};
    const trip = await loadEditableTrip(req.params.tripId, req.user._id, res);
    if (!trip) return;

    const decision = trip.decisions.find((entry) => entry.id === req.params.decisionId);
    if (!decision) {
      return res.status(404).json({ message: 'Decision not found' });
    }

    if (decision.status === 'decided') {
      return res.status(400).json({ message: 'Decided sets cannot be edited' });
    }

    let optionsChanged = false;
    let slotChanged = false;

    if (typeof title === 'string' && title.trim()) {
      decision.title = title.trim();
    }

    if (slot !== undefined) {
      slotChanged = true;
      if (slot === null) {
        decision.slot = undefined;
      } else if (typeof slot === 'object') {
        decision.slot = {
          date: typeof slot.date === 'string' ? slot.date : undefined,
          endDate: typeof slot.endDate === 'string' ? slot.endDate : undefined,
          startTime: typeof slot.startTime === 'string' ? slot.startTime : undefined,
          endTime: typeof slot.endTime === 'string' ? slot.endTime : undefined,
          label: typeof slot.label === 'string' ? slot.label : undefined,
        };
      }
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.has(status) || status === 'decided') {
        return res.status(400).json({ message: 'Invalid decision status' });
      }
      decision.status = status;
    }

    if (Array.isArray(removeOptionEventIds) && removeOptionEventIds.length > 0) {
      const removeSet = new Set(removeOptionEventIds);
      decision.optionEventIds = decision.optionEventIds.filter((eventId) => !removeSet.has(eventId));
      optionsChanged = true;
    }

    if (Array.isArray(addOptionEventIds) && addOptionEventIds.length > 0) {
      const validationError = validateOptionEvents(
        trip,
        addOptionEventIds,
        decision.id,
      );
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const merged = [...new Set([...decision.optionEventIds, ...addOptionEventIds])];
      if (merged.length !== decision.optionEventIds.length + addOptionEventIds.length) {
        return res.status(400).json({ message: 'Cannot add duplicate option events to the same decision' });
      }
      decision.optionEventIds = merged;
      optionsChanged = true;
    }

    if (decision.optionEventIds.length < 2 && decision.status === 'open') {
      return res.status(400).json({ message: 'Open decisions must include at least two options' });
    }

    if (optionsChanged || slotChanged) {
      markComparisonStale(decision);
    }

    trip.markModified('decisions');
    await trip.save();

    if (status === 'deferred') {
      await logActivity({
        userId: req.user._id,
        tripId: trip._id,
        actionType: 'decision_closed',
        description: `Deferred decision "${decision.title}" on "${trip.name}"`,
        details: {
          decisionId: decision.id,
          status: decision.status,
        },
      });
    }

    res.json(serializeDecisions(trip.decisions, trip._id.toString()));
  } catch (error) {
    console.error('Error updating decision:', error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/trips/:tripId/decisions/:decisionId', auth, async (req, res) => {
  try {
    const trip = await loadEditableTrip(req.params.tripId, req.user._id, res);
    if (!trip) return;

    const decisionIndex = trip.decisions.findIndex((entry) => entry.id === req.params.decisionId);
    if (decisionIndex === -1) {
      return res.status(404).json({ message: 'Decision not found' });
    }

    const decision = trip.decisions[decisionIndex];

    if (decision.status === 'decided') {
      return res.status(400).json({ message: 'Decided sets cannot be deleted' });
    }

    trip.decisions.splice(decisionIndex, 1);
    trip.markModified('decisions');
    await trip.save();

    await logActivity({
      userId: req.user._id,
      tripId: trip._id,
      actionType: 'decision_deleted',
      description: `Deleted decision "${decision.title}" on "${trip.name}"`,
      details: {
        decisionId: decision.id,
        title: decision.title,
        optionEventIds: decision.optionEventIds,
        status: decision.status,
      },
    });

    res.json(serializeDecisions(trip.decisions, trip._id.toString()));
  } catch (error) {
    console.error('Error deleting decision:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/trips/:tripId/decisions/:decisionId/comparison-overview', auth, async (req, res) => {
  try {
    const { refresh } = req.body || {};
    const trip = await loadReadableTrip(req.params.tripId, req.user._id, res);
    if (!trip) return;

    const decision = trip.decisions.find((entry) => entry.id === req.params.decisionId);
    if (!decision) {
      return res.status(404).json({ message: 'Decision not found' });
    }

    const overview = await generateComparisonOverview(trip, decision.id, {
      forceRefresh: Boolean(refresh),
    });

    res.json({
      decisionId: decision.id,
      comparisonOverview: serializeComparisonOverview(overview),
      decisions: serializeDecisions(trip.decisions, trip._id.toString()),
    });
  } catch (error) {
    console.error('Error generating comparison overview:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/trips/:tripId/decisions/:decisionId/confirm', auth, async (req, res) => {
  try {
    const { winnerEventId, loserAction = 'archive' } = req.body || {};
    const trip = await loadEditableTrip(req.params.tripId, req.user._id, res);
    if (!trip) return;

    const decision = trip.decisions.find((entry) => entry.id === req.params.decisionId);
    if (!decision) {
      return res.status(404).json({ message: 'Decision not found' });
    }

    if (decision.status !== 'open' && decision.status !== 'deferred') {
      return res.status(400).json({ message: 'Only open or deferred decisions can be confirmed' });
    }

    if (typeof winnerEventId !== 'string' || !winnerEventId.trim()) {
      return res.status(400).json({ message: 'winnerEventId is required' });
    }

    if (!decision.optionEventIds.includes(winnerEventId)) {
      return res.status(400).json({ message: 'Winner must be one of the decision options' });
    }

    if (!VALID_LOSER_ACTIONS.has(loserAction)) {
      return res.status(400).json({ message: 'Invalid loserAction' });
    }

    const winnerIndex = trip.events.findIndex((event) => event.id === winnerEventId);
    if (winnerIndex === -1) {
      return res.status(404).json({ message: 'Winner event not found' });
    }

    trip.events[winnerIndex].status = 'confirmed';

    const loserIds = decision.optionEventIds.filter((eventId) => eventId !== winnerEventId);

    if (loserAction === 'archive') {
      loserIds.forEach((eventId) => {
        const index = trip.events.findIndex((event) => event.id === eventId);
        if (index >= 0) {
          trip.events[index].status = 'alternative';
        }
      });
    } else if (loserAction === 'delete') {
      trip.events = trip.events.filter((event) => !loserIds.includes(event.id));
    }

    decision.status = 'decided';
    decision.winnerEventId = winnerEventId;
    decision.decidedAt = new Date();
    decision.decidedBy = {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      photoUrl: req.user.photoUrl ?? null,
    };
    markComparisonStale(decision);

    trip.markModified('events');
    trip.markModified('decisions');
    await trip.save();

    const winnerName = getEventName(trip.events.find((event) => event.id === winnerEventId));

    await logActivity({
      userId: req.user._id,
      tripId: trip._id,
      eventId: winnerEventId,
      actionType: 'winner_confirmed',
      description: `Confirmed "${winnerName}" as the winner for "${decision.title}" on "${trip.name}"`,
      details: {
        decisionId: decision.id,
        winnerEventId,
        loserAction,
        loserEventIds: loserIds,
      },
    });

    await logActivity({
      userId: req.user._id,
      tripId: trip._id,
      actionType: 'decision_closed',
      description: `Closed decision "${decision.title}" on "${trip.name}"`,
      details: {
        decisionId: decision.id,
        status: 'decided',
        winnerEventId,
      },
    });

    res.json({
      decisions: serializeDecisions(trip.decisions, trip._id.toString()),
      events: trip.events,
    });
  } catch (error) {
    console.error('Error confirming decision:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
