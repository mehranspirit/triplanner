const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Trip = require('../models/Trip');

const VALID_DISMISSAL_REASONS = new Set([
  'intentional_rest_day',
  'planning_deferred',
  'day_trip',
  'red_eye',
  'alternate_lodging',
  'overnight_transport',
  'connection_ok',
  'ad_hoc_ground_transport',
  'location_optional',
  'booking_not_required',
  'other',
]);

const serializeDismissals = (dismissals = []) => dismissals.map((entry) => {
  const plain = entry.toObject ? entry.toObject() : entry;
  return {
    issueKey: plain.issueKey,
    reason: plain.reason,
    note: plain.note,
    dismissedAt: plain.dismissedAt,
    dismissedBy: plain.dismissedBy
      ? {
          _id: plain.dismissedBy._id?.toString?.() || plain.dismissedBy._id,
          name: plain.dismissedBy.name,
          email: plain.dismissedBy.email,
          photoUrl: plain.dismissedBy.photoUrl ?? null,
        }
      : undefined,
    reopenBeforeTripDays: plain.reopenBeforeTripDays,
  };
});

router.get('/trips/:tripId/health-dismissals', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    const accessRole = trip.hasAccess(req.user._id);
    if (!accessRole) {
      return res.status(403).json({ message: 'You do not have access to this trip' });
    }

    res.json(serializeDismissals(trip.healthDismissals || []));
  } catch (error) {
    console.error('Error fetching health dismissals:', error);
    res.status(500).json({ message: error.message });
  }
});

router.patch('/trips/:tripId/health-dismissals', auth, async (req, res) => {
  try {
    const { issueKey, reason, note, reopenBeforeTripDays, removeIssueKeys } = req.body || {};

    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    const accessRole = trip.hasAccess(req.user._id);
    if (!accessRole || accessRole === 'viewer') {
      return res.status(403).json({ message: 'You do not have permission to update health dismissals' });
    }

    if (!Array.isArray(trip.healthDismissals)) {
      trip.healthDismissals = [];
    }

    if (Array.isArray(removeIssueKeys) && removeIssueKeys.length > 0) {
      const removeSet = new Set(removeIssueKeys.filter((key) => typeof key === 'string' && key.trim()));
      trip.healthDismissals = trip.healthDismissals.filter(
        (entry) => !removeSet.has(entry.issueKey)
      );
    }

    if (issueKey) {
      if (typeof issueKey !== 'string' || !issueKey.trim()) {
        return res.status(400).json({ message: 'issueKey is required' });
      }

      if (!reason || !VALID_DISMISSAL_REASONS.has(reason)) {
        return res.status(400).json({ message: 'Invalid dismissal reason' });
      }

      const dismissal = {
        issueKey: issueKey.trim(),
        reason,
        note: typeof note === 'string' && note.trim() ? note.trim() : undefined,
        dismissedAt: new Date(),
        dismissedBy: {
          _id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          photoUrl: req.user.photoUrl ?? null,
        },
        reopenBeforeTripDays: typeof reopenBeforeTripDays === 'number' ? reopenBeforeTripDays : undefined,
      };

      const existingIndex = trip.healthDismissals.findIndex(
        (entry) => entry.issueKey === dismissal.issueKey
      );

      if (existingIndex >= 0) {
        trip.healthDismissals[existingIndex] = dismissal;
      } else {
        trip.healthDismissals.push(dismissal);
      }
    } else if (!Array.isArray(removeIssueKeys) || removeIssueKeys.length === 0) {
      return res.status(400).json({ message: 'issueKey or removeIssueKeys is required' });
    }

    await trip.save();
    res.json(serializeDismissals(trip.healthDismissals));
  } catch (error) {
    console.error('Error updating health dismissals:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
