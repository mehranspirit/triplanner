const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Trip = require('../models/Trip');
const { logActivity } = require('../utils/activityLogger');

// Get trip notes
router.get('/trips/:tripId/notes', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl')
      .populate('note.edits.user._id', 'name email photoUrl')
      .populate('note.lastEditedBy._id', 'name email photoUrl');
    
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if user has access
    const accessRole = trip.hasAccess(req.user._id);
    if (!accessRole) {
      return res.status(403).json({ message: 'You do not have access to this trip' });
    }

    res.json(trip.note || { content: '', edits: [] });
  } catch (error) {
    console.error('Error fetching trip notes:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update trip notes
router.put('/trips/:tripId/notes', auth, async (req, res) => {
  try {
    const { content } = req.body;
    
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if user has edit access
    const accessRole = trip.hasAccess(req.user._id);
    if (!accessRole || (accessRole === 'viewer')) {
      return res.status(403).json({ message: 'You do not have permission to edit notes' });
    }

    // Initialize note if it doesn't exist
    if (!trip.note) {
      trip.note = {
        content: '',
        edits: []
      };
    }

    // Add the edit to history
    trip.note.edits.push({
      content,
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        photoUrl: req.user.photoUrl
      },
      timestamp: new Date()
    });

    // Update the current content and last edited info
    trip.note.content = content;
    trip.note.lastEditedBy = {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      photoUrl: req.user.photoUrl
    };
    trip.note.lastEditedAt = new Date();

    await trip.save();

    // Log activity
    await logActivity({
      userId: req.user._id,
      tripId: trip._id,
      actionType: 'note_update',
      description: `Updated notes for trip "${trip.name}"`,
      details: {
        tripName: trip.name
      }
    });

    res.json(trip.note);
  } catch (error) {
    console.error('Error updating trip notes:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 