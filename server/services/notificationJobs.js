const Trip = require('../models/Trip');
const { generateTripNotifications } = require('./notificationGenerator');

const getTripUserIds = (trip) => {
  const userIds = new Set();

  if (trip.owner) {
    userIds.add(trip.owner.toString());
  }

  (trip.collaborators || []).forEach((collaborator) => {
    if (collaborator.user) {
      userIds.add(collaborator.user.toString());
    }
  });

  return Array.from(userIds);
};

const generateNotificationsForTrip = async (trip) => {
  const userIds = getTripUserIds(trip);
  let generatedCount = 0;

  for (const userId of userIds) {
    generatedCount += await generateTripNotifications({ trip, userId });
  }

  return {
    tripId: trip._id.toString(),
    userCount: userIds.length,
    generatedCount
  };
};

const generateScheduledNotifications = async ({ now = new Date(), windowDays = 30 } = {}) => {
  const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
  const trips = await Trip.find({
    $or: [
      { startDate: { $lte: windowEnd.toISOString() }, endDate: { $gte: now.toISOString() } },
      { 'events.startDate': { $lte: windowEnd.toISOString(), $gte: now.toISOString() } },
      { 'events.date': { $gte: now.toISOString().slice(0, 10), $lte: windowEnd.toISOString().slice(0, 10) } }
    ]
  }).limit(500);

  const results = [];

  for (const trip of trips) {
    results.push(await generateNotificationsForTrip(trip));
  }

  return {
    tripCount: trips.length,
    userTripCount: results.reduce((total, result) => total + result.userCount, 0),
    generatedCount: results.reduce((total, result) => total + result.generatedCount, 0),
    results
  };
};

module.exports = {
  generateNotificationsForTrip,
  generateScheduledNotifications,
};
