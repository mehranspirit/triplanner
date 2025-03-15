const Activity = require('../models/Activity');

/**
 * Log a user activity
 * @param {Object} params - Activity parameters
 * @param {string} params.userId - ID of the user performing the action
 * @param {string} params.tripId - ID of the trip being acted upon
 * @param {string} [params.eventId] - ID of the event being acted upon (optional)
 * @param {string} params.actionType - Type of action (from enum in Activity model)
 * @param {string} params.description - Human-readable description of the activity
 * @param {Object} [params.details] - Additional details about the activity (optional)
 * @returns {Promise<Activity>} - The created activity document
 */
async function logActivity(params) {
  try {
    const { userId, tripId, eventId, actionType, description, details = {} } = params;
    
    if (!userId || !tripId || !actionType || !description) {
      console.error('Missing required parameters for activity logging:', params);
      return null;
    }

    console.log('Logging activity:', {
      actionType,
      userId,
      tripId,
      eventId: eventId || 'none',
      description: description.substring(0, 50) + (description.length > 50 ? '...' : '')
    });

    const activity = new Activity({
      user: userId,
      trip: tripId,
      event: eventId || undefined, // Store the event ID as a string
      actionType,
      description,
      details
    });

    await activity.save();
    console.log(`Activity logged: ${actionType} by user ${userId} on trip ${tripId}`);
    return activity;
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw - we don't want activity logging failures to break the app
    return null;
  }
}

module.exports = { logActivity }; 