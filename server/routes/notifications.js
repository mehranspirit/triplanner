const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Trip = require('../models/Trip');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const { generateTripNotifications } = require('../services/notificationGenerator');

const findAccessibleTrip = async (tripId, userId) => {
  const trip = await Trip.findById(tripId);
  if (!trip || !trip.hasAccess(userId)) return null;
  return trip;
};

router.get('/trips/:tripId/notifications', auth, async (req, res) => {
  try {
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    if (req.query.generate !== 'false') {
      await generateTripNotifications({ trip, userId: req.user._id });
    }

    const notifications = await Notification.find({
      tripId: req.params.tripId,
      userId: req.user._id,
      dismissedAt: { $exists: false }
    }).sort({ readAt: 1, createdAt: -1 }).limit(50);

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

router.get('/trips/:tripId/notification-preferences', auth, async (req, res) => {
  try {
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const preferences = await NotificationPreference.findOneAndUpdate(
      { tripId: req.params.tripId, userId: req.user._id },
      {
        $setOnInsert: {
          tripId: req.params.tripId,
          userId: req.user._id,
          inAppEnabled: true,
          disabledTypes: []
        }
      },
      { new: true, upsert: true }
    );

    res.json(preferences);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ message: 'Error fetching notification preferences' });
  }
});

router.patch('/trips/:tripId/notification-preferences', auth, async (req, res) => {
  try {
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const allowedTypes = new Set(['insight', 'reminder', 'prep', 'sync', 'system']);
    const updates = {};

    if (typeof req.body.inAppEnabled === 'boolean') {
      updates.inAppEnabled = req.body.inAppEnabled;
    }

    if (Array.isArray(req.body.disabledTypes)) {
      updates.disabledTypes = req.body.disabledTypes.filter((type) => allowedTypes.has(type));
    }

    const preferences = await NotificationPreference.findOneAndUpdate(
      { tripId: req.params.tripId, userId: req.user._id },
      {
        $setOnInsert: {
          tripId: req.params.tripId,
          userId: req.user._id
        },
        $set: updates
      },
      { new: true, upsert: true }
    );

    await generateTripNotifications({ trip, userId: req.user._id });

    res.json(preferences);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ message: 'Error updating notification preferences' });
  }
});

router.patch('/trips/:tripId/notifications/:notificationId', auth, async (req, res) => {
  try {
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const updates = {};
    if (req.body.read === true) updates.readAt = new Date();
    if (req.body.read === false) updates.$unset = { readAt: '' };
    if (req.body.dismissed === true) updates.dismissedAt = new Date();

    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.notificationId,
        tripId: req.params.tripId,
        userId: req.user._id
      },
      updates,
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ message: 'Error updating notification' });
  }
});

module.exports = router;
