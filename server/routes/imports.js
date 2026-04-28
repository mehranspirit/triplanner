const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Trip = require('../models/Trip');
const TravelImport = require('../models/TravelImport');

const findAccessibleTrip = async (tripId, userId) => {
  const trip = await Trip.findById(tripId);

  if (!trip || !trip.hasAccess(userId)) {
    return null;
  }

  return trip;
};

router.get('/trips/:tripId/imports', auth, async (req, res) => {
  try {
    const { tripId } = req.params;
    const trip = await findAccessibleTrip(tripId, req.user._id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const imports = await TravelImport.find({ tripId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(imports);
  } catch (error) {
    console.error('Error fetching travel imports:', error);
    res.status(500).json({ message: 'Error fetching travel imports' });
  }
});

router.post('/trips/:tripId/imports', auth, async (req, res) => {
  try {
    const { tripId } = req.params;
    const trip = await findAccessibleTrip(tripId, req.user._id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const {
      sourceType = 'manual_text',
      sourceHash,
      sourceTitle,
      sourceExcerpt,
      status = 'parsed',
      model,
      parsedEvents = [],
      validationErrors = [],
      createdEventIds = []
    } = req.body;

    const duplicateImport = sourceHash
      ? await TravelImport.findOne({
          tripId,
          userId: req.user._id,
          sourceHash,
          status: { $ne: 'dismissed' }
        }).sort({ createdAt: -1 })
      : null;
    const resolvedStatus = duplicateImport && !['failed', 'accepted', 'partially_accepted'].includes(status)
      ? 'duplicate'
      : status;

    const travelImport = new TravelImport({
      tripId,
      userId: req.user._id,
      sourceType,
      sourceHash,
      sourceTitle,
      sourceExcerpt,
      status: resolvedStatus,
      duplicateOfImportId: duplicateImport?._id,
      model,
      parsedEvents,
      validationErrors,
      createdEventIds
    });

    await travelImport.save();
    res.status(201).json(travelImport);
  } catch (error) {
    console.error('Error creating travel import:', error);
    res.status(500).json({ message: 'Error creating travel import' });
  }
});

router.patch('/trips/:tripId/imports/:importId', auth, async (req, res) => {
  try {
    const { tripId, importId } = req.params;
    const trip = await findAccessibleTrip(tripId, req.user._id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const allowedUpdates = ['status', 'createdEventIds', 'validationErrors'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowedUpdates.includes(key))
    );

    const travelImport = await TravelImport.findOneAndUpdate(
      { _id: importId, tripId },
      updates,
      { new: true, runValidators: true }
    );

    if (!travelImport) {
      return res.status(404).json({ message: 'Travel import not found' });
    }

    res.json(travelImport);
  } catch (error) {
    console.error('Error updating travel import:', error);
    res.status(500).json({ message: 'Error updating travel import' });
  }
});

module.exports = router;
