const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// Admin email for permission checks
const ADMIN_EMAIL = 'mehran.rajaian@gmail.com';

// Get activities for the current user
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Find trips the user has access to (either as owner or collaborator)
    const userTrips = await mongoose.model('Trip').find({
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    }).select('_id');

    const tripIds = userTrips.map(trip => trip._id);

    // Find activities for these trips
    const activities = await Activity.find({
      trip: { $in: tripIds }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email photoUrl')
      .populate('trip', 'name description')
      .lean();

    // Get total count for pagination
    const totalActivities = await Activity.countDocuments({
      trip: { $in: tripIds }
    });

    res.json({
      activities,
      pagination: {
        total: totalActivities,
        page,
        limit,
        pages: Math.ceil(totalActivities / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get activities for a specific trip
router.get('/trip/:tripId', auth, async (req, res) => {
  try {
    const { tripId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Check if user has access to this trip
    const trip = await mongoose.model('Trip').findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    const hasAccess = trip.owner.equals(req.user._id) || 
      trip.collaborators.some(c => c.user.equals(req.user._id));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have access to this trip' });
    }

    // Find activities for this trip
    const activities = await Activity.find({ trip: tripId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email photoUrl')
      .populate('trip', 'name description')
      .lean();

    // Get total count for pagination
    const totalActivities = await Activity.countDocuments({ trip: tripId });

    res.json({
      activities,
      pagination: {
        total: totalActivities,
        page,
        limit,
        pages: Math.ceil(totalActivities / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching trip activities:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete a single activity (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ message: 'Only admin can delete activities' });
    }

    const { id } = req.params;
    
    // Validate activity ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid activity ID' });
    }

    // Find and delete the activity
    const activity = await Activity.findByIdAndDelete(id);
    
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    console.log(`Activity deleted by admin: ${id}`);
    res.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ message: error.message });
  }
});

// Clear all activities for a trip (admin only)
router.delete('/trip/:tripId/clear', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ message: 'Only admin can clear activity logs' });
    }

    const { tripId } = req.params;
    
    // Validate trip ID
    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ message: 'Invalid trip ID' });
    }

    // Check if trip exists
    const trip = await mongoose.model('Trip').findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Delete all activities for this trip
    const result = await Activity.deleteMany({ trip: tripId });
    
    console.log(`Activities cleared for trip ${tripId} by admin. Deleted count: ${result.deletedCount}`);
    res.json({ 
      message: 'Activity log cleared successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error clearing trip activities:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 